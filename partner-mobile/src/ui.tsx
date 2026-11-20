import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { alerts as Alert } from "./alerts";
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f4fa" },
  content: { padding: 18, gap: 14, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: "#292545" },
  subtitle: { fontSize: 17, fontWeight: "600", color: "#292545" },
  text: { color: "#48435e", fontSize: 14, lineHeight: 22 },
  muted: { color: "#76718a", fontSize: 12, lineHeight: 19 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e8e4f3",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8d2e9",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "white",
    color: "#292545",
    minHeight: 44,
  },
  button: {
    backgroundColor: "#7068cf",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 13,
    minHeight: 46,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "600" },
  secondary: { backgroundColor: "#eeebfa" },
  secondaryText: { color: "#5e55ae" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: {
    color: "#ad2738",
    backgroundColor: "#fff0f0",
    padding: 12,
    borderRadius: 10,
  },
});
export function Card({ children }: { children: React.ReactNode; variant?: string }) {
  return <View style={styles.card}>{children}</View>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}
export function Info({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}
export function Field({
  label,
  value,
  set,
  multiline = false,
  keyboardType = "default",
  secure = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={[
          styles.input,
          multiline && { minHeight: 85, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void | Promise<unknown>;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      style={[
        styles.button,
        secondary && styles.secondary,
        (disabled || busy) && { opacity: 0.5 },
      ]}
      onPress={async () => {
        setBusy(true);
        try {
          await onPress();
        } catch (e) {
          Alert.alert(
            "Unable to continue",
            e instanceof Error ? e.message : "Try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? "#7068cf" : "white"} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function Choice({
  selected,
  children,
  onPress,
}: {
  selected: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Button secondary={!selected} onPress={onPress}>
      {selected ? "✓ " : ""}
      {children}
    </Button>
  );
}
