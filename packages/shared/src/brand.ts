// Brand tokens derived from the VIP Mobiles crest logo (black + gold, premium/luxury).
// Single source of truth: Tailwind theme (frontend) and the social-creative
// canvas renderer (backend) both read from this file so exported posts and
// the live site never drift apart.

export const BRAND = {
  name: "VIP Mobiles",
  tagline: "Smart Phones • Accessories • Services",
} as const;

export const BRAND_COLORS = {
  black: {
    950: "#08080A",
    900: "#0B0B0D",
    800: "#141417",
    700: "#1D1D21",
    600: "#2A2A30",
  },
  gold: {
    50: "#FDF6E3",
    100: "#FBEBC2",
    200: "#F6D680",
    300: "#F0C04D",
    400: "#E8AA2E",
    500: "#D4941E", // primary brand gold
    600: "#B8791A",
    700: "#8F5D14",
    800: "#6B4610",
    900: "#4A300B",
  },
  cream: "#F5F1E8", // warm off-white for text on dark surfaces
  muted: "#A8A29A", // warm gray for secondary text
} as const;

// 7-8 subtle background variations for the social creative generator, all
// built from the same brand palette so posts stay consistent but not identical.
export const SOCIAL_GRADIENTS = [
  { id: "midnight-gold", from: "#0B0B0D", to: "#2A2410", angle: 135 },
  { id: "onyx-amber", from: "#141417", to: "#4A300B", angle: 160 },
  { id: "black-royale", from: "#08080A", to: "#3A2A08", angle: 120 },
  { id: "espresso-gold", from: "#1D1D21", to: "#6B4610", angle: 145 },
  { id: "charcoal-honey", from: "#0B0B0D", to: "#8F5D14", angle: 110 },
  { id: "deep-bronze", from: "#08080A", to: "#4A300B", angle: 200 },
  { id: "graphite-champagne", from: "#141417", to: "#B8791A", angle: 100 },
  { id: "noir-sunburst", from: "#0B0B0D", to: "#D4941E", angle: 135 },
] as const;

export type SocialGradientId = (typeof SOCIAL_GRADIENTS)[number]["id"];
