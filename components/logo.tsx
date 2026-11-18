// Traktiva mark: offset "T" on brand green. Geometry traced from the source logo (640 grid).
export const LOGO_PATH = "M122 210H360V160H517V242H360V467H278V292H122Z";

export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" className={className} role="img" aria-label="Traktiva">
      <rect width="640" height="640" rx="128" fill="#106e3a" />
      <path d={LOGO_PATH} fill="#fff" />
    </svg>
  );
}
