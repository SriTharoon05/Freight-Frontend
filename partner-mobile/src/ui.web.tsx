import React, { useId, useRef, useState } from "react";
import { StyleSheet, type KeyboardTypeOptions } from "react-native";

const fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f8fb" },
  content: { padding: 24, gap: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "700", color: "#222438", fontFamily },
  subtitle: { fontSize: 16, fontWeight: "600", color: "#222438", fontFamily },
  text: { color: "#555d70", fontSize: 14, lineHeight: 23, fontFamily },
  muted: { color: "#6e7688", fontSize: 12, lineHeight: 20, fontFamily },
  card: { backgroundColor: "white", borderRadius: 20, padding: 24, gap: 14 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#e1e4ed", borderRadius: 12, padding: 12 },
  button: { minHeight: 46 }, buttonText: { color: "white" },
  secondary: { backgroundColor: "#f2f0fc" }, secondaryText: { color: "#6656c7" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: "#ae3348", backgroundColor: "#fff1f3", borderRadius: 12, padding: 14, fontFamily },
});

export function Card({ children, variant }: { children: React.ReactNode; variant?: string }) {
  return <section className="partner-card" data-variant={variant}>{children}</section>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="card-heading">{children}</h2>;
}
export function Info({ children }: { children: React.ReactNode }) {
  return <p className="card-copy">{children}</p>;
}
export function Field({ label, value, set, multiline = false, keyboardType = "default", secure = false }: {
  label: string; value: string; set: (value: string) => void; multiline?: boolean;
  keyboardType?: KeyboardTypeOptions; secure?: boolean;
}) {
  const id = useId();
  return <label className="partner-field" htmlFor={id}>
    <span>{label}</span>
    {multiline ? <textarea id={id} value={value} onChange={(event) => set(event.target.value)} rows={3} /> :
      <input id={id} value={value} onChange={(event) => set(event.target.value)} autoComplete="off"
        type={secure ? "password" : keyboardType === "email-address" ? "email" : keyboardType === "phone-pad" ? "tel" : "text"}
        inputMode={keyboardType === "decimal-pad" ? "decimal" : keyboardType === "numeric" || keyboardType === "number-pad" ? "numeric" : undefined} />}
  </label>;
}
export function Button({ children, onPress, secondary = false, disabled = false }: {
  children: React.ReactNode; onPress: () => void | Promise<unknown>; secondary?: boolean; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const text = React.Children.toArray(children).filter((child) => typeof child === "string").join(" ");
  return <>
    <button type="button" className={`partner-button ${secondary ? "is-secondary" : "is-primary"} ${text.includes("WhatsApp") ? "is-whatsapp" : ""}`}
      disabled={disabled || busy} aria-busy={busy} onClick={async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError("");
        try { await onPress(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to continue. Please try again."); }
        finally { lock.current = false; setBusy(false); }
      }}>
      {busy && <span className="button-spinner" aria-hidden="true" />}{children}
    </button>
    {error && <p role="alert" className="inline-error">{error}</p>}
  </>;
}
export function Choice({ selected, children, onPress }: { selected: boolean; children: React.ReactNode; onPress: () => void }) {
  return <button type="button" aria-pressed={selected} className={`partner-choice ${selected ? "is-selected" : ""}`} onClick={onPress}>
    <span className="choice-indicator" aria-hidden="true">{selected ? "✓" : "+"}</span>{children}
  </button>;
}
