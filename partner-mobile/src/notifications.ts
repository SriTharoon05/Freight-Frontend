import {
  getMessaging,
  deleteToken,
  getToken,
  onTokenRefresh,
  requestPermission,
  registerDeviceForRemoteMessages,
} from "@react-native-firebase/messaging";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { PermissionsAndroid, Platform } from "react-native";
import { api } from "./auth";
export async function installationId() {
  let id = await SecureStore.getItemAsync("installation_id");
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync("installation_id", id);
  }
  return id;
}
export async function registerPush() {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33)
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  const messaging = getMessaging();
  await requestPermission(messaging);
  if (Platform.OS === "ios") await registerDeviceForRemoteMessages(messaging);
  const token = await getToken(messaging);
  const send = async (fcm_token: string) =>
    api("/devices", "POST", {
      installation_id: await installationId(),
      platform: Platform.OS,
      fcm_token,
    });
  await send(token);
  return onTokenRefresh(messaging, (token) => {
    void send(token).catch(() => {});
  });
}

export async function invalidatePush() {
  await deleteToken(getMessaging());
}
