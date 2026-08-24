"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, PackageCheck, PackageX } from "lucide-react";
import { Gallery, type GalleryImage } from "./Gallery";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, FormField } from "@/components/ui/Input";
import { WishlistButton } from "../WishlistButton";
import { ProductBadgeStack } from "../ProductBadges";
import { formatCurrency, cn } from "@/lib/utils";
import { buildBuyRequestWhatsAppUrl } from "../../../shared";

interface Variant {
  id: string;
  storage?: string | null;
  ram?: string | null;
  price: string | number;
  stockQty: number;
  status: string;
  isDefault: boolean;
  color?: { id: string; name: string; hexCode: string } | null;
}

interface Props {
  product: {
    id: string;
    title: string;
    slug: string;
    basePrice: string | number;
    compareAtPrice?: string | number | null;
    boxAvailable: boolean;
    status: string;
    isNewArrival?: boolean;
    isTrending?: boolean;
    isBestSeller?: boolean;
    isPtaApproved?: boolean;
  };
  images: GalleryImage[];
  variants: Variant[];
  whatsappNumber: string;
  currency: string;
  siteUrl: string;
}

export function ProductInteractive({ product, images, variants, whatsappNumber, currency, siteUrl }: Props) {
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const colors = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; hexCode: string }>();
    for (const v of variants) if (v.color && !seen.has(v.color.id)) seen.set(v.color.id, v.color);
    return Array.from(seen.values());
  }, [variants]);

  const storages = useMemo(() => Array.from(new Set(variants.map((v) => v.storage).filter(Boolean))) as string[], [variants]);

  const isSold = product.status === "SOLD" || selectedVariant?.status === "SOLD";
  const isReserved = product.status === "RESERVED" || selectedVariant?.status === "RESERVED";
  const price = selectedVariant?.price ?? product.basePrice;

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2">
        <Gallery images={images} title={product.title} />

        <div>
          <ProductBadgeStack
            product={{ ...product, variants: variants.map((v) => ({ stockQty: v.stockQty })) }}
            className="mb-3"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-gold-400">{formatCurrency(price, currency)}</span>
              {product.compareAtPrice && (
                <span className="text-base text-muted line-through">{formatCurrency(product.compareAtPrice, currency)}</span>
              )}
              {isSold && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white">Sold</span>}
              {!isSold && isReserved && <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase text-ink-950">Reserved</span>}
            </div>
            <WishlistButton product={{ id: product.id, slug: product.slug, title: product.title, basePrice: price, image: images[0]?.thumbUrl || images[0]?.url }} />
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm">
            {product.boxAvailable ? (
              <span className="flex items-center gap-1.5 text-emerald-400"><PackageCheck className="h-4 w-4" /> Box available</span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted"><PackageX className="h-4 w-4" /> Box not included</span>
            )}
          </div>

          {colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-cream">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const variantForColor = variants.find((v) => v.color?.id === c.id && (v.storage === selectedVariant?.storage || !selectedVariant?.storage)) ?? variants.find((v) => v.color?.id === c.id);
                  const active = selectedVariant?.color?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => variantForColor && setSelectedVariantId(variantForColor.id)}
                      title={c.name}
                      className={cn("h-9 w-9 rounded-full border-2 transition-transform", active ? "border-gold-500 scale-110" : "border-ink-600")}
                      style={{ backgroundColor: c.hexCode }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {storages.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-cream">Storage</p>
              <div className="flex flex-wrap gap-2">
                {storages.map((s) => {
                  const variantForStorage = variants.find((v) => v.storage === s && v.color?.id === selectedVariant?.color?.id) ?? variants.find((v) => v.storage === s);
                  const active = selectedVariant?.storage === s;
                  return (
                    <button
                      key={s}
                      onClick={() => variantForStorage && setSelectedVariantId(variantForStorage.id)}
                      className={cn(
                        "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        active ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-cream hover:border-gold-500/50"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-muted">
            {isSold ? "This unit has been sold." : selectedVariant && selectedVariant.stockQty <= 2 ? `Only ${selectedVariant.stockQty} left in stock` : "In stock"}
          </div>

          <div className="mt-6 flex gap-3">
            <Button size="lg" className="flex-1" disabled={isSold} onClick={() => setModalOpen(true)}>
              <MessageCircle className="h-5 w-5" /> {isSold ? "Sold Out" : "Request to Buy"}
            </Button>
          </div>
        </div>
      </div>

      <BuyRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={product}
        variant={selectedVariant}
        whatsappNumber={whatsappNumber}
        currency={currency}
        siteUrl={siteUrl}
      />
    </>
  );
}

function BuyRequestModal({
  open,
  onClose,
  product,
  variant,
  whatsappNumber,
  currency,
  siteUrl,
}: {
  open: boolean;
  onClose: () => void;
  product: Props["product"];
  variant: Variant | null | undefined;
  whatsappNumber: string;
  currency: string;
  siteUrl: string;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      toast.error("Please enter your name and a way to contact you.");
      return;
    }
    setSubmitting(true);
    try {
      await fetch("/api/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantLabel: variant ? [variant.color?.name, variant.storage].filter(Boolean).join(" / ") : null,
          customerName: name,
          contact,
          offeredPrice: offer ? Number(offer) : undefined,
          message: message || undefined,
        }),
      });

      if (whatsappNumber) {
        const url = buildBuyRequestWhatsAppUrl({
          storeWhatsAppNumber: whatsappNumber,
          customerName: name,
          productTitle: product.title,
          productUrl: `${siteUrl}/product/${product.slug}`,
          listedPrice: variant?.price ?? product.basePrice,
          currency,
          variantLabel: variant ? [variant.color?.name, variant.storage].filter(Boolean).join(" / ") : null,
          boxAvailable: product.boxAvailable,
          offeredPrice: offer || null,
          customerMessage: message || null,
        });
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Request sent! We'll get back to you soon.");
      }
      onClose();
      setName("");
      setContact("");
      setOffer("");
      setMessage("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Request to Buy — ${product.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Your Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmad Raza" required />
        </FormField>
        <FormField label="Phone / WhatsApp">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="03xx-xxxxxxx" required />
        </FormField>
        <FormField label="Your Offer (optional)" hint={`Listed price: ${formatCurrency(variant?.price ?? product.basePrice, currency)}`}>
          <Input type="number" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Optional offered price" />
        </FormField>
        <FormField label="Message (optional)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any questions or details..." />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          <MessageCircle className="h-5 w-5" /> Continue on WhatsApp
        </Button>
      </form>
    </Modal>
  );
}
