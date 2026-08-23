import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { publicApiSafe } from "@/lib/api";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const data = await publicApiSafe<{ settings: any }>("/api/settings");
  const s = data?.settings;

  const title = s?.seoDefaults?.metaTitle || "VIP Mobiles – Premium Smart Phones, Accessories & Services";
  const description =
    s?.seoDefaults?.metaDescription ||
    "Shop new, used and refurbished smartphones with genuine warranty and trusted service across our branches.";

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${s?.siteName || "VIP Mobiles"}` },
    description,
    openGraph: {
      title,
      description,
      siteName: s?.siteName || "VIP Mobiles",
      type: "website",
      images: s?.seoDefaults?.ogImage ? [{ url: s.seoDefaults.ogImage }] : ["/brand/logo.jpg"],
    },
    twitter: { card: "summary_large_image", title, description },
    icons: { icon: "/brand/logo.jpg" },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
