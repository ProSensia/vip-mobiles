export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
