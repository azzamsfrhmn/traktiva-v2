"use client";

import { useRouter } from "next/navigation";
import { CountrySelect } from "@/components/country-select";

/** TikTok Shop research is tied to the creator account's region, so each country maps to one of your accounts. */
export function RisetCountry({ value, options }: { value: string; options: { code: string; disabled?: boolean; hint?: string }[] }) {
  const router = useRouter();
  return (
    <CountrySelect
      value={value}
      options={options}
      label="Wilayah akun TikTok"
      title="Ranking TikTok Shop mengikuti wilayah akun kreator. Pasar lain: tambah akun TikTok negara itu, atau pakai KaloData."
      onChange={(code) => router.push(`/riset?negara=${code}`)}
    />
  );
}

/** Which TikTok account the research is read through (only shown with 2+ accounts). */
export function AccountPicker({ accounts, value }: { accounts: string[]; value: string }) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => router.push(`/riset?akun=${encodeURIComponent(e.target.value)}`)}
      title="Akun TikTok sumber data"
      className="h-9 rounded-lg border bg-card px-2 text-xs font-medium outline-none"
    >
      {accounts.map((a) => <option key={a} value={a}>@{a}</option>)}
    </select>
  );
}
