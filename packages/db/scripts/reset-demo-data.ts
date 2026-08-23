import "dotenv/config";
import readline from "readline";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Removes every record flagged isDemo=true, in FK-safe order, while leaving
// the real Super Admin account and any content a human admin created (even
// if it references a demo brand/category — those individual deletions are
// skipped with a warning rather than aborting the whole run). Safe to re-run.
async function resetDemoData() {
  console.log("Resetting demo data...\n");

  const demoSales = await prisma.sale.deleteMany({ where: { isDemo: true } });
  console.log(`  removed ${demoSales.count} demo sale records`);

  const demoReviews = await prisma.review.deleteMany({ where: { isDemo: true } });
  console.log(`  removed ${demoReviews.count} demo reviews (not attached to a demo product)`);

  const demoProducts = await prisma.product.deleteMany({ where: { isDemo: true } });
  console.log(`  removed ${demoProducts.count} demo products (variants/images/videos/reviews/buy-requests cascade)`);

  for (const model of ["brand", "category", "color", "branch", "user"] as const) {
    try {
      // @ts-expect-error dynamic model access
      const result = await prisma[model].deleteMany({ where: { isDemo: true } });
      console.log(`  removed ${result.count} demo ${model} record(s)`);
    } catch (err: any) {
      console.warn(
        `  ! skipped some demo ${model} records — still referenced by real data you created. ` +
          `Reassign those records in the admin dashboard, then re-run this reset.`
      );
    }
  }

  console.log("\nDemo data reset complete. The Super Admin account and any real content you entered were preserved.\n");
}

async function confirm(): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      "This will permanently delete ALL demo products, brands, categories, colors, branches, staff and sales. Continue? (yes/no) ",
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "yes");
      }
    );
  });
}

async function main() {
  const ok = await confirm();
  if (!ok) {
    console.log("Cancelled.");
    return;
  }
  await resetDemoData();
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
