import { PLATFORM } from "@/lib/platforms";

export function PlatformIcon({ platform, className = "size-3.5" }: { platform: keyof typeof PLATFORM; className?: string }) {
  const p = PLATFORM[platform];
  return (
    <svg viewBox="0 0 24 24" className={className} fill={p.color} role="img" aria-label={p.label}>
      <path d={p.path} />
    </svg>
  );
}
