"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { clientApi } from "@/lib/clientApi";
import { formatCurrency, cn } from "@/lib/utils";

interface ChatProduct {
  id: string;
  title: string;
  slug: string;
  link: string;
  price: number;
  compareAtPrice: number | null;
  condition: string;
  status: string;
  available: boolean;
  brand: string;
  category: string;
  description: string | null;
  specs: string[];
  imageUrl: string | null;
}

interface ChatContext {
  brands?: string[];
  categories?: string[];
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  products?: ChatProduct[];
  recommendation?: string;
}

const SUGGESTIONS = ["Phones under 100k", "Best Samsung phone", "Compare iPhone 13 vs Samsung S21"];

// A fully internal, rule-based shopping assistant — no external AI API.
// The backend (/api/assistant/chat) parses brand/category/price/condition
// keywords out of the message and answers entirely from our own Product
// table, so every fact it states is live catalog data, not a guess.
//
// `context` is round-tripped with every request: the backend merges each
// new message's signals on top of it, so a follow-up like "cheaper ones?"
// or "what about used" refines the previous search instead of starting
// over. The typing indicator has a floor time so a fast reply doesn't just
// flash a blank moment — it briefly feels like someone's actually there.
const MIN_TYPING_MS = 550;

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! I'm your shopping assistant. Ask me things like \"iPhone under 100k\", \"cheapest Samsung phone\", or \"compare iPhone 13 vs Samsung S21\" — I'll search our live stock for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const contextRef = useRef<ChatContext | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    const startedAt = Date.now();
    try {
      const res = await clientApi.post<{
        reply: string;
        products?: ChatProduct[];
        recommendation?: string;
        context?: ChatContext;
      }>("/assistant/chat", { message: trimmed, context: contextRef.current });
      contextRef.current = res.context;
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) await new Promise((r) => setTimeout(r, MIN_TYPING_MS - elapsed));
      setMessages((m) => [...m, { role: "assistant", text: res.reply, products: res.products, recommendation: res.recommendation }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't process that just now — please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close shopping assistant" : "Open shopping assistant"}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-ink-950 shadow-gold transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 left-4 z-40 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-card sm:left-auto sm:right-6 sm:w-96">
          <div className="flex items-center gap-2 border-b border-ink-600 bg-ink-800/60 px-4 py-3">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <p className="text-sm font-semibold text-cream">Shopping Assistant</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))}
            {loading && <TypingBubble />}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-ink-600 px-2.5 py-1 text-[11px] text-muted hover:border-gold-500/40 hover:text-gold-400"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-ink-600 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a phone, price or brand..."
              className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-cream placeholder:text-muted focus:border-gold-500/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-ink-950 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function TypingBubble() {
  return (
    <div className="flex animate-fade-in justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-ink-800 px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-cream/50"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[88%] space-y-2", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm",
            isUser ? "bg-gold-500 text-ink-950" : "bg-ink-800 text-cream/90"
          )}
        >
          {message.text}
        </div>

        {message.recommendation && (
          <div className="flex items-start gap-1.5 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs text-gold-300">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {message.recommendation}
          </div>
        )}

        {message.products && message.products.length > 0 && (
          <div className="space-y-2">
            {message.products.map((p) => (
              <ChatProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatProductCard({ product }: { product: ChatProduct }) {
  return (
    <Link
      href={product.link}
      className="flex gap-3 rounded-xl border border-ink-600 bg-ink-800/60 p-2.5 hover:border-gold-500/40"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-900">
        {product.imageUrl && <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-cream">{product.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-gold-400">{formatCurrency(product.price)}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", product.available ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
            {product.available ? "In Stock" : product.status === "SOLD" ? "Sold Out" : "Unavailable"}
          </span>
          <span className="text-[10px] text-muted">{product.brand}</span>
        </div>
        {product.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted">{product.description}</p>}
      </div>
    </Link>
  );
}
