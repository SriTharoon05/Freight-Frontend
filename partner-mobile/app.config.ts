import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Freight Partners",
  slug: "freight-partners",
  version: "1.0.0",
  scheme: "freightpartners",
  orientation: "portrait",
  userInterfaceStyle: "light",
  web: { bundler: "metro", output: "single", name: "Freight Partners" },
  experiments: { baseUrl: "/v1/partners" },
  ios: {
    bundleIdentifier: "com.freightos.partners",
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST,
    infoPlist: { UIBackgroundModes: ["location", "remote-notification"] },
  },
  android: {
    package: "com.freightos.partners",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
    ],
  },
  plugins: [
    "expo-dev-client",
    "expo-secure-store",
    ["expo-sqlite", { useSQLCipher: true }],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Share location with the assigning company only while a pickup or delivery is active.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose proof photos for your assigned task.",
        cameraPermission:
          "Capture pickup, delivery and warehouse handover proof.",
        microphonePermission: false,
      },
    ],
    "expo-document-picker",
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_NETWORK_API_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};
export default config;
