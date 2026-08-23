import Link from "next/link";
import Image from "next/image";

export function HeroBanner({ banner }: { banner: { imageUrl: string; title?: string | null; link?: string | null } }) {
  const content = (
    <div className="relative aspect-[16/6] w-full overflow-hidden rounded-xl2 border border-ink-600 sm:aspect-[16/5]">
      <Image src={banner.imageUrl} alt={banner.title || "Promotion"} fill priority sizes="100vw" className="object-cover" />
    </div>
  );

  return (
    <section className="container-page pt-6">
      {banner.link ? <Link href={banner.link}>{content}</Link> : content}
    </section>
  );
}
