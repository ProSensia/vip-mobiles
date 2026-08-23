import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/client";
import { BRAND_COLORS } from "@vip/shared";
import { createPlaceholderProductImages } from "./lib/placeholderImage";
import { createPlaceholderBanner } from "./lib/placeholderBanner";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";

async function upsertSuperAdmin() {
  const name = process.env.SUPER_ADMIN_NAME || "Store Owner";
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in packages/db/.env before seeding."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role: "SUPER_ADMIN", isDemo: false },
  });
  console.log(`✔ Super Admin ready: ${user.email}`);
  return user;
}

async function seedSettings() {
  const defaults: Record<string, unknown> = {
    siteName: "VIP Mobiles",
    tagline: "Smart Phones • Accessories • Services",
    logoUrl: null,
    // 920 is not an allocated Pakistani mobile prefix — deliberately inert placeholder.
    // Replace with the real store number in Admin → Settings before launch.
    whatsappNumber: "920000000000",
    currency: "PKR",
    contactEmail: "",
    contactPhone: "",
    socialLinks: { facebook: "", instagram: "", tiktok: "", youtube: "" },
    seoDefaults: {
      metaTitle: "VIP Mobiles – Premium Smart Phones, Accessories & Services",
      metaDescription: "Shop new, used and refurbished smartphones with genuine warranty and trusted service across our branches.",
      ogImage: null,
    },
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as any },
    });
  }
  console.log("✔ Default store settings seeded");
}

async function seedDemoData() {
  console.log("\nSeeding demo catalog, branches, staff and sales...\n");

  // --- Brands -------------------------------------------------------------
  const brandNames = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "Google", "OnePlus"];
  const brands: Record<string, any> = {};
  for (const [i, name] of brandNames.entries()) {
    brands[name] = await prisma.brand.create({
      data: { name, slug: name.toLowerCase(), isDemo: true, sortOrder: i },
    });
  }
  console.log(`✔ ${brandNames.length} demo brands`);

  // --- Categories -----------------------------------------------------------
  const categoryDefs = [
    { name: "Smartphones", isFeatured: true },
    { name: "Tablets", isFeatured: false },
    { name: "Smartwatches", isFeatured: false },
    { name: "Accessories", isFeatured: true },
  ];
  const categories: Record<string, any> = {};
  for (const [i, def] of categoryDefs.entries()) {
    categories[def.name] = await prisma.category.create({
      data: {
        name: def.name,
        slug: def.name.toLowerCase(),
        isFeatured: def.isFeatured,
        isDemo: true,
        sortOrder: i,
      },
    });
  }
  console.log(`✔ ${categoryDefs.length} demo categories`);

  // --- Colors ---------------------------------------------------------------
  const colorDefs = [
    { name: "Midnight Black", hexCode: "#0B0B0D" },
    { name: "Starlight White", hexCode: "#F5F1E8" },
    { name: "Ocean Blue", hexCode: "#2E5A88" },
    { name: "Titanium Gold", hexCode: "#D4941E" },
    { name: "Graphite", hexCode: "#3A3A3D" },
    { name: "Alpine Green", hexCode: "#3C6E52" },
    { name: "Lavender Purple", hexCode: "#8A7CA8" },
    { name: "Silver", hexCode: "#C7C9CC" },
  ];
  const colors: Record<string, any> = {};
  for (const def of colorDefs) {
    colors[def.name] = await prisma.color.create({ data: { ...def, isDemo: true } });
  }
  console.log(`✔ ${colorDefs.length} demo colors`);

  // --- Branches ---------------------------------------------------------------
  const branchDefs = [
    {
      name: "VIP Mobiles – Gulberg",
      city: "Lahore",
      address: "12-C, MM Alam Road, Gulberg III",
      phone: "+92 42 3576 0000",
      whatsapp: "920000000000",
    },
    {
      name: "VIP Mobiles – DHA Phase 5",
      city: "Lahore",
      address: "Plot 45, Sector Y Commercial, DHA Phase 5",
      phone: "+92 42 3591 0000",
      whatsapp: "920000000000",
    },
    {
      name: "VIP Mobiles – Bahria Town",
      city: "Islamabad",
      address: "Shop 8, Civic Center, Bahria Town Phase 4",
      phone: "+92 51 5820 000",
      whatsapp: "920000000000",
    },
  ];
  const branches: any[] = [];
  for (const [i, def] of branchDefs.entries()) {
    const branch = await prisma.branch.create({
      data: {
        ...def,
        slug: def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        country: "Pakistan",
        openingHours: { mon_sat: "11:00 AM – 9:00 PM", sun: "2:00 PM – 8:00 PM" },
        isDemo: true,
        sortOrder: i,
      },
    });
    branches.push(branch);
  }
  console.log(`✔ ${branchDefs.length} demo branches`);

  // --- Staff ---------------------------------------------------------------
  const staffDefs = [
    { name: "Ayesha Khan", email: "ayesha.khan@demo.vipmobiles.local", role: "SALES_MANAGER", branch: 0, position: "Branch Sales Manager", displayOnSite: true, bio: "Leads the Gulberg team with 6+ years in mobile retail." },
    { name: "Bilal Ahmed", email: "bilal.ahmed@demo.vipmobiles.local", role: "SALES_STAFF", branch: 0, position: "Sales Executive", displayOnSite: true, bio: "Specialist in Apple and Samsung flagship devices." },
    { name: "Hina Tariq", email: "hina.tariq@demo.vipmobiles.local", role: "SALES_STAFF", branch: 1, position: "Sales Executive", displayOnSite: true, bio: "Helps customers find the right phone for their budget." },
    { name: "Usman Raza", email: "usman.raza@demo.vipmobiles.local", role: "CONTENT_MANAGER", branch: null, position: "Content & Social Media Manager", displayOnSite: false, bio: "Runs product photography and social promotions." },
    { name: "Sara Malik", email: "sara.malik@demo.vipmobiles.local", role: "ADMIN", branch: null, position: "Operations Admin", displayOnSite: false, bio: "Oversees day-to-day store operations." },
  ] as const;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const staffUsers: any[] = [];
  for (const [i, def] of staffDefs.entries()) {
    const user = await prisma.user.create({
      data: {
        name: def.name,
        email: def.email,
        passwordHash,
        role: def.role as any,
        isDemo: true,
        branchId: def.branch !== null ? branches[def.branch].id : null,
        staffProfile: {
          create: {
            position: def.position,
            bio: def.bio,
            displayOnSite: def.displayOnSite,
            branchId: def.branch !== null ? branches[def.branch].id : null,
            sortOrder: i,
          },
        },
      },
    });
    staffUsers.push(user);
  }
  console.log(`✔ ${staffDefs.length} demo staff accounts (password: ${DEMO_PASSWORD})`);

  // --- Products ---------------------------------------------------------------
  const productDefs = [
    { title: "Apple iPhone 15 Pro Max", brand: "Apple", category: "Smartphones", condition: "NEW", price: 549000, featured: true, newArrival: true, storageOpts: ["256GB", "512GB"] },
    { title: "Apple iPhone 14", brand: "Apple", category: "Smartphones", condition: "USED", price: 289000, featured: true, newArrival: false, storageOpts: ["128GB", "256GB"] },
    { title: "Apple iPhone 13", brand: "Apple", category: "Smartphones", condition: "REFURBISHED", price: 219000, featured: false, newArrival: false, storageOpts: ["128GB"] },
    { title: "Samsung Galaxy S24 Ultra", brand: "Samsung", category: "Smartphones", condition: "NEW", price: 469000, featured: true, newArrival: true, storageOpts: ["256GB", "512GB"] },
    { title: "Samsung Galaxy S23", brand: "Samsung", category: "Smartphones", condition: "USED", price: 219000, featured: false, newArrival: false, storageOpts: ["128GB", "256GB"] },
    { title: "Samsung Galaxy A55", brand: "Samsung", category: "Smartphones", condition: "NEW", price: 99000, featured: false, newArrival: true, storageOpts: ["128GB"] },
    { title: "Xiaomi 14 Pro", brand: "Xiaomi", category: "Smartphones", condition: "NEW", price: 219000, featured: true, newArrival: true, storageOpts: ["256GB"] },
    { title: "Xiaomi Redmi Note 13", brand: "Xiaomi", category: "Smartphones", condition: "NEW", price: 59000, featured: false, newArrival: false, storageOpts: ["128GB", "256GB"] },
    { title: "Oppo Find X7", brand: "Oppo", category: "Smartphones", condition: "OPEN_BOX", price: 179000, featured: false, newArrival: false, storageOpts: ["256GB"] },
    { title: "Vivo V30 Pro", brand: "Vivo", category: "Smartphones", condition: "NEW", price: 129000, featured: true, newArrival: true, storageOpts: ["256GB"] },
    { title: "Realme 12 Pro+", brand: "Realme", category: "Smartphones", condition: "NEW", price: 89000, featured: false, newArrival: true, storageOpts: ["256GB"] },
    { title: "Google Pixel 8 Pro", brand: "Google", category: "Smartphones", condition: "USED", price: 249000, featured: true, newArrival: false, storageOpts: ["128GB"] },
    { title: "OnePlus 12", brand: "OnePlus", category: "Smartphones", condition: "NEW", price: 199000, featured: false, newArrival: true, storageOpts: ["256GB"] },
    { title: "Apple iPad Air (5th Gen)", brand: "Apple", category: "Tablets", condition: "USED", price: 179000, featured: true, newArrival: false, storageOpts: ["64GB", "256GB"] },
    { title: "Apple Watch Series 9", brand: "Apple", category: "Smartwatches", condition: "NEW", price: 129000, featured: false, newArrival: true, storageOpts: [] },
    { title: "Samsung Galaxy Buds Pro", brand: "Samsung", category: "Accessories", condition: "NEW", price: 29000, featured: false, newArrival: false, storageOpts: [] },
  ];

  const specTemplates: Record<string, Array<{ label: string; value: string }>> = {
    Smartphones: [
      { label: "Display", value: "6.1\" – 6.8\" OLED, 120Hz" },
      { label: "Processor", value: "Flagship-class chipset" },
      { label: "Camera", value: "Multi-lens rear camera system" },
      { label: "Battery", value: "Fast charging, all-day battery life" },
    ],
    Tablets: [
      { label: "Display", value: "10.9\" Liquid Retina" },
      { label: "Chip", value: "Apple M-series / Snapdragon" },
      { label: "Battery", value: "Up to 10 hours usage" },
    ],
    Smartwatches: [
      { label: "Display", value: "Always-on Retina display" },
      { label: "Health", value: "Heart rate, ECG, SpO2 tracking" },
      { label: "Battery", value: "Up to 18 hours" },
    ],
    Accessories: [
      { label: "Connectivity", value: "Bluetooth 5.3" },
      { label: "Battery", value: "Up to 24 hours with case" },
    ],
  };

  const reviewSamples = [
    { customerName: "Ahmad R.", rating: 5, comment: "Genuine product, smooth transaction and great after-sales support." },
    { customerName: "Fatima S.", rating: 4, comment: "Phone was exactly as described. Delivery from the branch was quick." },
    { customerName: "Zain M.", rating: 5, comment: "Best prices in town and the staff explained everything clearly." },
  ];

  const colorList = Object.values(colors);
  let createdCount = 0;
  let soldAssigned = 0;

  for (const [index, def] of productDefs.entries()) {
    const status = index === 3 || index === 7 ? "SOLD" : index === 5 ? "RESERVED" : index === 15 ? "HIDDEN" : "AVAILABLE";
    const branch = branches[index % branches.length];

    const product = await prisma.product.create({
      data: {
        title: def.title,
        slug: def.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        brandId: brands[def.brand].id,
        categoryId: categories[def.category].id,
        branchId: branch.id,
        createdById: staffUsers[3].id, // content manager
        condition: def.condition as any,
        status: status as any,
        description: `The ${def.title} is a ${def.condition.toLowerCase()} unit, fully inspected and ready to use. Comes with our standard VIP Mobiles service guarantee.`,
        specifications: specTemplates[def.category] ?? [],
        basePrice: def.price,
        compareAtPrice: def.condition === "NEW" ? null : Math.round(def.price * 1.12),
        boxAvailable: def.condition !== "USED",
        isFeatured: def.featured && status === "AVAILABLE",
        isNewArrival: def.newArrival,
        isDemo: true,
        ...(status === "SOLD" ? { soldAt: new Date(), soldPrice: def.price } : {}),
      },
    });

    // Variants: one per storage option (or a single default variant for accessories/watches).
    const storageOpts = def.storageOpts.length > 0 ? def.storageOpts : [null];
    for (const [vi, storage] of storageOpts.entries()) {
      const color = colorList[(index + vi) % colorList.length] as any;
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          colorId: color.id,
          storage: storage ?? undefined,
          price: storage && vi > 0 ? def.price + 15000 * vi : def.price,
          stockQty: status === "SOLD" ? 0 : 3,
          status: status as any,
          isDefault: vi === 0,
        },
      });
    }

    // Images: 3 placeholder shots per product.
    for (let i = 0; i < 3; i++) {
      const img = await createPlaceholderProductImages(def.title, BRAND_COLORS.gold[400]);
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: img.url,
          webpUrl: img.webpUrl,
          avifUrl: img.avifUrl,
          thumbUrl: img.thumbUrl,
          width: img.width,
          height: img.height,
          sortOrder: i,
          isPrimary: i === 0,
          altText: def.title,
        },
      });
    }

    // One curated review per product.
    const review = reviewSamples[index % reviewSamples.length];
    await prisma.review.create({
      data: { ...review, productId: product.id, isApproved: true, isDemo: true },
    });

    // Record a Sale for the two SOLD demo products.
    if (status === "SOLD") {
      const staff = staffUsers[1 + (soldAssigned % 2)]; // alternate between the two sales staff
      soldAssigned++;
      await prisma.sale.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          staffId: staff.id,
          soldPrice: def.price,
          costPrice: Math.round(def.price * 0.88),
          profit: def.price - Math.round(def.price * 0.88),
          customerName: "Walk-in Customer",
          customerContact: "0300-0000000",
          saleDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
          isDemo: true,
        },
      });
    }

    createdCount++;
  }
  console.log(`✔ ${createdCount} demo products with variants, images, reviews and sample sales`);

  // --- Homepage sections ---------------------------------------------------
  await prisma.homepageSection.createMany({
    data: [
      { type: "FEATURED_PRODUCTS", title: "Featured Phones", subtitle: "Hand-picked by our team", config: { limit: 9 }, sortOrder: 0, isVisible: true },
      { type: "FEATURED_CATEGORIES", title: "Shop by Category", config: {}, sortOrder: 1, isVisible: true },
      { type: "NEW_ARRIVALS", title: "New Arrivals", subtitle: "Just landed in store", config: { limit: 8 }, sortOrder: 2, isVisible: true },
      { type: "BRANCHES", title: "Visit Our Branches", config: {}, sortOrder: 3, isVisible: true },
    ],
  });
  console.log("✔ Homepage sections configured");

  // --- Banner ---------------------------------------------------------------
  const bannerImage = await createPlaceholderBanner("New Arrivals Are Here", "Shop the latest flagship phones in store now");
  await prisma.banner.create({
    data: { title: "New Arrivals", imageUrl: bannerImage, placement: "HOME_HERO", isActive: true, sortOrder: 0 },
  });
  console.log("✔ Demo hero banner created");
}

async function main() {
  await upsertSuperAdmin();
  await seedSettings();

  if ((process.env.SEED_DEMO_DATA || "true").toLowerCase() === "true") {
    await seedDemoData();
  } else {
    console.log("SEED_DEMO_DATA=false — skipping demo catalog/branches/staff.");
  }

  console.log("\nSeed complete.\n");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
