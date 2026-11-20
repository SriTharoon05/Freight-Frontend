import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

export const settings = Constants.expoConfig?.extra || {};
export const configured = Boolean(settings.apiUrl && settings.supabaseUrl && settings.supabaseAnonKey);
export const supabase = createClient(
  settings.supabaseUrl || "https://unconfigured.supabase.co",
  settings.supabaseAnonKey || "unconfigured",
  { auth: {
    storage: window.sessionStorage,
    storageKey: "freight-partner-web-google",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  } },
);

export async function completeGoogleSignIn() {
  const code = sessionStorage.getItem("freight-partner-web-code");
  const failure = sessionStorage.getItem("freight-partner-web-error");
  sessionStorage.removeItem("freight-partner-web-code");
  sessionStorage.removeItem("freight-partner-web-error");
  if (failure) throw new Error(failure);
  if (!code) return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function signInWithGoogle() {
  // The web app and approved callback share an origin. Driver and owner
  // sessions use different keys; the bridge carries only a one-time PKCE code.
  if (location.origin !== new URL(settings.apiUrl).origin)
    throw new Error("Open the hosted Freight Partners website to sign in.");
  sessionStorage.setItem("freight-partner-web-return", "pending");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/v1/driver`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    sessionStorage.removeItem("freight-partner-web-return");
    throw error || new Error("Google sign-in is unavailable. Try again.");
  }
  location.assign(data.url);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "Sign in again to synchronize.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), method === "GET" ? 90000 : 30000);
  try {
    const response = await fetch(settings.apiUrl + "/v1" + path, {
      method, cache: "no-store", credentials: "omit",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status,
      typeof data.detail === "string" ? data.detail : "Unable to save. Check your connection and details.");
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new ApiError(503, "Connection timed out. Your pending work stays in this browser. Free hosting may need a moment to wake.");
    throw error;
  } finally { clearTimeout(timer); }
}
