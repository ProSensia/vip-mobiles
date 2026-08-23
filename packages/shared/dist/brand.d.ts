export declare const BRAND: {
    readonly name: "VIP Mobiles";
    readonly tagline: "Smart Phones • Accessories • Services";
};
export declare const BRAND_COLORS: {
    readonly black: {
        readonly 950: "#08080A";
        readonly 900: "#0B0B0D";
        readonly 800: "#141417";
        readonly 700: "#1D1D21";
        readonly 600: "#2A2A30";
    };
    readonly gold: {
        readonly 50: "#FDF6E3";
        readonly 100: "#FBEBC2";
        readonly 200: "#F6D680";
        readonly 300: "#F0C04D";
        readonly 400: "#E8AA2E";
        readonly 500: "#D4941E";
        readonly 600: "#B8791A";
        readonly 700: "#8F5D14";
        readonly 800: "#6B4610";
        readonly 900: "#4A300B";
    };
    readonly cream: "#F5F1E8";
    readonly muted: "#A8A29A";
};
export declare const SOCIAL_GRADIENTS: readonly [{
    readonly id: "midnight-gold";
    readonly from: "#0B0B0D";
    readonly to: "#2A2410";
    readonly angle: 135;
}, {
    readonly id: "onyx-amber";
    readonly from: "#141417";
    readonly to: "#4A300B";
    readonly angle: 160;
}, {
    readonly id: "black-royale";
    readonly from: "#08080A";
    readonly to: "#3A2A08";
    readonly angle: 120;
}, {
    readonly id: "espresso-gold";
    readonly from: "#1D1D21";
    readonly to: "#6B4610";
    readonly angle: 145;
}, {
    readonly id: "charcoal-honey";
    readonly from: "#0B0B0D";
    readonly to: "#8F5D14";
    readonly angle: 110;
}, {
    readonly id: "deep-bronze";
    readonly from: "#08080A";
    readonly to: "#4A300B";
    readonly angle: 200;
}, {
    readonly id: "graphite-champagne";
    readonly from: "#141417";
    readonly to: "#B8791A";
    readonly angle: 100;
}, {
    readonly id: "noir-sunburst";
    readonly from: "#0B0B0D";
    readonly to: "#D4941E";
    readonly angle: 135;
}];
export type SocialGradientId = (typeof SOCIAL_GRADIENTS)[number]["id"];
