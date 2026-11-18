import { redirect } from "next/navigation";

// KaloData now lives inside Riset Produk (one research workspace). Old links keep working.
export default async function KalodataPage({ searchParams }: PageProps<"/kalodata">) {
  const q = (await searchParams).q;
  redirect(`/riset?sumber=kalodata${typeof q === "string" && q ? `&q=${encodeURIComponent(q)}` : ""}`);
}
