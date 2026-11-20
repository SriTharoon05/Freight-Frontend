import "react-native-url-polyfill/auto";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
export const settings = Constants.expoConfig?.extra || {};
export const configured = Boolean(
  settings.apiUrl && settings.supabaseUrl && settings.supabaseAnonKey,
);
// Chunk sessions because some devices have small keychain item limits.
const secureStorage = {
  async getItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(key + "_count")) || 0);
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i++) {
      const piece = await SecureStore.getItemAsync(`${key}_${i}`);
      if (piece === null) return null;
      value += piece;
    }
    return value;
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const pieces = value.match(/.{1,500}/gs) || [];
    for (let i = 0; i < pieces.length; i++)
      await SecureStore.setItemAsync(`${key}_${i}`, pieces[i], {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    await SecureStore.setItemAsync(key + "_count", String(pieces.length), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(key + "_count")) || 0);
    await SecureStore.deleteItemAsync(key + "_count");
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}_${i}`);
  },
};
export const supabase = createClient(
  settings.supabaseUrl || "https://unconfigured.supabase.co",
  settings.supabaseAnonKey || "unconfigured",
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: "freightpartners", path: "app" });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in is unavailable. Try again.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return;
  const callback = new URL(result.url), expected = new URL(redirectTo);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname)
    throw new Error("Unexpected sign-in callback. Please try again.");
  const code = callback.searchParams.get("code");
  if (!code || callback.searchParams.has("error")) throw new Error("Google sign-in could not complete. Please try again.");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
// Native sign-in exchanges its callback inside the system browser flow.
export async function completeGoogleSignIn() {}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "Sign in again to synchronize.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(settings.apiUrl + "/v1" + path, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data.detail === "string"
          ? data.detail
          : "Check the entered details.",
      );
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new ApiError(
        503,
        "Connection timed out. Your pending work stays on this device.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
