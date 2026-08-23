export interface BuyRequestWhatsAppInput {
  storeWhatsAppNumber: string; // digits only, with country code, e.g. "923001234567"
  customerName: string;
  productTitle: string;
  productUrl: string;
  listedPrice: number | string;
  currency?: string;
  variantLabel?: string | null;
  boxAvailable?: boolean | null;
  offeredPrice?: number | string | null;
  customerMessage?: string | null;
}

export function buildBuyRequestWhatsAppUrl(input: BuyRequestWhatsAppInput): string {
  const currency = input.currency ?? "PKR";
  const lines = [
    `Hi VIP Mobiles, I am interested in buying *${input.productTitle}*.`,
    `Listed price: ${currency} ${input.listedPrice}`,
  ];

  if (input.variantLabel) lines.push(`Variant: ${input.variantLabel}`);
  if (input.boxAvailable !== undefined && input.boxAvailable !== null) {
    lines.push(`Box available: ${input.boxAvailable ? "Yes" : "No"}`);
  }
  if (input.offeredPrice !== undefined && input.offeredPrice !== null && input.offeredPrice !== "") {
    lines.push(`My offered price: ${currency} ${input.offeredPrice}`);
  }
  if (input.customerMessage) lines.push(`Message: ${input.customerMessage}`);

  lines.push(`Product link: ${input.productUrl}`);
  lines.push(`My name: ${input.customerName}`);
  lines.push(`Please contact me. Thank you.`);

  const text = encodeURIComponent(lines.join("\n"));
  const number = input.storeWhatsAppNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${number}?text=${text}`;
}
