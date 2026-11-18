// Markets used by research filters (flags: components/flag.tsx, SVG because Windows can't render flag emoji).
export const COUNTRIES = [
  { code: "ID", name: "Indonesia", currency: "IDR", color: "#e5484d" },
  { code: "MY", name: "Malaysia", currency: "MYR", color: "#3b82f6" },
  { code: "PH", name: "Filipina", currency: "PHP", color: "#2563eb" },
  { code: "SG", name: "Singapura", currency: "SGD", color: "#ef4444" },
  { code: "TH", name: "Thailand", currency: "THB", color: "#6366f1" },
  { code: "VN", name: "Vietnam", currency: "VND", color: "#dc2626" },
  { code: "US", name: "Amerika Serikat", currency: "USD", color: "#1d4ed8" },
  { code: "GB", name: "Inggris", currency: "GBP", color: "#1e40af" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];
export const countryOf = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === (code ?? "").toUpperCase()) ?? null;
export const isCountry = (code: unknown): code is CountryCode => typeof code === "string" && COUNTRIES.some((c) => c.code === code);
