export interface BuyRequestWhatsAppInput {
    storeWhatsAppNumber: string;
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
export declare function buildBuyRequestWhatsAppUrl(input: BuyRequestWhatsAppInput): string;
