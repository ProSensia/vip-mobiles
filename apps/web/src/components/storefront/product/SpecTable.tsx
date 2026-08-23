export function SpecTable({ specs }: { specs: Array<{ label: string; value: string }> }) {
  if (!specs || specs.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl2 border border-ink-600">
      {specs.map((spec, i) => (
        <div key={i} className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? "bg-ink-800/40" : ""}`}>
          <span className="text-muted">{spec.label}</span>
          <span className="font-medium text-cream">{spec.value}</span>
        </div>
      ))}
    </div>
  );
}
