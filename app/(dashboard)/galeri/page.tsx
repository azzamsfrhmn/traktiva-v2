import { PageHeader } from "@/components/page-header";
import { listGenerated, listUploads } from "@/lib/library";
import { LibraryGrid } from "./library-grid";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function GaleriPage({ searchParams }: PageProps<"/galeri">) {
  const tab = (await searchParams).tab === "ai" ? "ai" : "uploads";
  const [uploads, generated] = await Promise.all([listUploads(), listGenerated(500)]);
  const view = (items: typeof uploads) => items.map((it) => ({ ...it, date: fmt.format(new Date(it.at)) }));
  return (
    <>
      <PageHeader slug="galeri" />
      <LibraryGrid tab={tab} uploads={view(uploads)} generated={view(generated)} />
    </>
  );
}
