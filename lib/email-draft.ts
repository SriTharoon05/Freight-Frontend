import { moneyLabel } from "./freight";

export function quotationDraft(
  rfq: { customer?: { contact_name?: string }; customer_name?: string; origin: string; destination: string; mode: string },
  lines: { quantity: number | string; unit: string; unit_price: number | string; currency: string }[],
  validity: string,
  senderName: string,
) {
  const recipient = rfq.customer?.contact_name?.trim();
  const validDate = validity
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(validity))
    : "not specified";
  return `${recipient ? `Dear ${recipient},` : "Hello,"}\n\nPlease find our quotation for ${rfq.origin} to ${rfq.destination} by ${rfq.mode}.\n${lines.map((line) => `${line.quantity} ${line.unit}: ${moneyLabel(Number(line.quantity) * Number(line.unit_price), line.currency)}`).join("\n")}\n\nValid until ${validDate}.\n\nKind regards${senderName.trim() ? `,\n${senderName.trim()}` : ""}`;
}
