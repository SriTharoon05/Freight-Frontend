import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import NetInfo from "@react-native-community/netinfo";
import {
  getMessaging,
  setBackgroundMessageHandler,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from "./messaging";
import "./tracking";
import { api, ApiError, configured, supabase, completeGoogleSignIn } from "./auth";
import { alerts as Alert } from "./alerts";
import { cache, remember, localTask, pending, wipe } from "./store";
import { synchronize } from "./sync";
import { reconcileTracking, suspendTracking } from "./tracking";
import {
  installationId,
  registerPush,
  invalidatePush,
} from "./notifications";
import type { Json, Task } from "./types";
if (configured)
  setBackgroundMessageHandler(getMessaging(), async () => {
    await reconcileTracking();
  });
export function useWorkspace() {
  const [booting, setBooting] = useState(true), [loading, setLoading] = useState(false),
    [profileLoaded, setProfileLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Json | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [selected, setSelected] = useState<Task | null>(null);
  const [tab, setTab] = useState("Tasks"),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(true);
  const [space, setSpace] = useState<Json[]>([]),
    [reservations, setReservations] = useState<Json[]>([]),
    [inbox, setInbox] = useState<Json[]>([]),
    [warehouses, setWarehouses] = useState<Json[]>([]);
  const refreshing = useRef<Promise<void> | null>(null),
    generation = useRef(0);
  function refresh(): Promise<void> {
    if (refreshing.current) return refreshing.current;
    setLoading(true);
    refreshing.current = refreshHome().catch((failure) => {
      setError(failure instanceof Error ? failure.message : "Unable to load saved work. Allow browser storage and retry.");
    }).finally(() => {
      refreshing.current = null;
      setLoading(false);
    });
    return refreshing.current;
  }
  async function refreshHome() {
    const epoch = generation.current;
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    if (!current) return;
    const owner = await cache<string>("owner");
    if (owner && owner !== current.user.id) {
      if ((await pending()).length) {
        setError(
          "Unsent work belongs to the previous account. Sign in to that account to synchronize or review it.",
        );
        await supabase.auth.signOut();
        return;
      }
      await wipe();
    }
    await remember("owner", current.user.id);
    const cached = await cache<Json>("home");
    if (cached) {
      setProfile(cached.profile);
      setTasks(cached.tasks);
      setSpace(cached.space);
      setReservations(cached.reservations);
      setInbox(cached.inbox);
      setWarehouses(cached.warehouses);
    }
    try {
      let me: Json;
      try {
        me = await api("/profile");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          if (generation.current !== epoch) return;
          setProfile(null);
          setProfileLoaded(true);
          setTab("Profile");
          return;
        }
        throw e;
      }
      if (generation.current !== epoch) return;
      setProfile(me);
      setProfileLoaded(true);
      await remember("gps_retention_days", me.gps_retention_days || 30);
      await synchronize();
      const [
        remoteTasks,
        remoteSpace,
        remoteReservations,
        remoteInbox,
        remoteWarehouses,
      ] = await Promise.all([
        api<Task[]>("/tasks"),
        api<Json[]>("/space-requests"),
        api<Json[]>("/reservations"),
        api<Json[]>("/inbox"),
        api<Json[]>("/warehouses"),
      ]);
      const queue = await pending(),
        resolved = await Promise.all(
          remoteTasks.map(async (task) =>
            queue.some((q) => q.resource_id === task.id && q.kind === "action")
              ? (await localTask(task.id)) || task
              : task,
          ),
        );
      const {
        data: { session: latest },
      } = await supabase.auth.getSession();
      if (generation.current !== epoch || latest?.user.id !== current.user.id)
        return;
      setTasks(resolved);
      setSpace(remoteSpace);
      setReservations(remoteReservations);
      setInbox(remoteInbox);
      setWarehouses(remoteWarehouses);
      await remember("home", {
        profile: me,
        tasks: resolved,
        space: remoteSpace,
        reservations: remoteReservations,
        inbox: remoteInbox,
        warehouses: remoteWarehouses,
      });
      await reconcileTracking();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Offline: showing saved work.");
    }
  }
  function open(item: Json) {
    if (item.kind === "task") {
      void api<Task>(`/tasks/${item.resource_id}`)
        .then((task) => {
          setSelected(task);
          setTab("Tasks");
        })
        .catch(async () => {
          const saved = await localTask(item.resource_id);
          if (saved) {
            setSelected(saved);
            setTab("Tasks");
          }
        });
    } else if (["space_request", "reservation"].includes(item.kind))
      setTab("Space");
    else setTab("Profile");
  }
  useEffect(() => {
    void completeGoogleSignIn()
      .then(() => supabase.auth.getSession())
      .then(({ data }) => setSession(data.session))
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Sign-in could not complete."))
      .finally(() => setBooting(false));
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      generation.current += 1;
      setSession(value);
      if (!value) {
        setProfileLoaded(false);
        setProfile(null);
        setTasks([]);
        setSelected(null);
        setSpace([]);
        setReservations([]);
        setInbox([]);
        setWarehouses([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    void refresh();
    let stopPush: (() => void) | undefined;
    void registerPush()
      .then((stop) => {
        stopPush = stop;
      })
      .catch(() => {
        /* Inbox stays available when push is denied. */
      });
    const unsubscribe = NetInfo.addEventListener((state) => {
      setConnected(Boolean(state.isConnected));
      if (state.isConnected) void refresh();
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        void refresh();
      } else supabase.auth.stopAutoRefresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 30000);
    const foreground = onMessage(getMessaging(), () => {
      void refresh();
    });
    const opened = onNotificationOpenedApp(getMessaging(), (message) => {
      if (message.data) open(message.data);
    });
    void getInitialNotification(getMessaging()).then((message) => {
      if (message?.data) open(message.data);
    });
    return () => {
      unsubscribe();
      app.remove();
      clearInterval(timer);
      foreground();
      opened();
      stopPush?.();
    };
  }, [session?.user.id]);
  useEffect(() => {
    const handler = ({ url }: { url: string }) => {
      try {
        const parsed = new URL(url);
        if (parsed.host === "space" || parsed.pathname.includes("space"))
          setTab("Space");
        if (parsed.host === "task") {
          const id = parsed.pathname.split("/").filter(Boolean)[0];
          void api<Task>(`/tasks/${id}`)
            .then((task) => {
              setTab("Tasks");
              setSelected(task);
            })
            .catch(() => {});
        }
      } catch {
        /* Ignore unrecognized links. */
      }
    };
    const listener = Linking.addEventListener("url", handler);
    void Linking.getInitialURL().then((url) => {
      if (url) handler({ url });
    });
    return () => listener.remove();
  }, [session?.user.id]);
  async function logout() {
    if ((await pending()).length) {
      Alert.alert(
        "Unsent work remains",
        "Synchronize or review and discard your pending work before signing out.",
      );
      return;
    }
    generation.current += 1;
    if (refreshing.current) await refreshing.current;
    await suspendTracking();
    try {
      if (Platform.OS !== "web") await api(`/devices/${await installationId()}`, "DELETE");
    } catch {
      /* Expired tokens cannot unregister. */
    }
    await invalidatePush();
    await supabase.auth.signOut();
    await wipe();
    setProfile(null);
    setTasks([]);
    setSelected(null);
  }
  return {
    session, profile, tasks, selected, setSelected, tab, setTab, error, connected,
    space, reservations, inbox, warehouses, refresh, open, logout,
    booting, loading, profileLoaded,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
