import "server-only";
import { eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { kaloSessions, kvCache } from "@/lib/db/schema";
import { countryOf, type CountryCode } from "@/lib/countries";
import { KaloClient, KaloError, type DateRange } from "@/lib/kalodata";

// App glue for the KaloData client (lib/kalodata): sessions from the DB, per-process client with rotation,
// a JSON cache so repeated searches/details don't burn quota, and friendly Indonesian errors.

type Pool = { key: string; client: KaloClient; ids: number[]; day: string };
const g = globalThis as unknown as { __kalo?: Record<string, Pool> };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** Client over every usable session for one market. Quota marks reset when the (WIB) day changes. */
export async function kaloClient(country: CountryCode = "ID") {
  const pools = (g.__kalo ??= {});
  // a new day brings fresh quota: sessions parked as "quota" become active again
  if (Object.values(pools).some((p) => p.day !== today())) g.__kalo = {};
  if (!Object.keys(g.__kalo!).length) await db.update(kaloSessions).set({ status: "active", quotaAt: null }).where(eq(kaloSessions.status, "quota"));

  const rows = await db.select().from(kaloSessions).where(ne(kaloSessions.status, "dead"));
  const usable = rows.filter((r) => r.status === "active");
  if (!usable.length) {
    throw new Error(rows.length ? "Kuota semua sesi KaloData habis hari ini. Coba lagi besok atau tambah sesi." : "Belum ada sesi KaloData. Tambahkan dulu di Kelola sesi.");
  }
  const key = usable.map((r) => r.id).join(",");
  // recreate when sessions change, or when the KaloClient class itself changed (dev reload / app update)
  if (g.__kalo![country]?.key !== key || !(g.__kalo![country]?.client instanceof KaloClient)) {
    g.__kalo![country] = {
      key,
      ids: usable.map((r) => r.id),
      day: today(),
      client: new KaloClient({
        sessions: usable.map((r) => ({ sessionCookie: r.sessionCookie, label: r.label, deviceId: r.deviceId ?? undefined, extraCookies: r.extraCookies ?? undefined })),
        currency: countryOf(country)?.currency ?? "IDR",
        country,
        minDelayMs: 1500,
        jitterMs: 1000,
      }),
    };
  }
  return g.__kalo![country];
}

/** Run a KaloData call; translate KaloError into a clear message and park dead/quota'd sessions. */
export async function kalo<T>(fn: (c: KaloClient) => Promise<T>, country: CountryCode = "ID"): Promise<T> {
  const k = await kaloClient(country);
  try {
    return await fn(k.client);
  } catch (e) {
    if (e instanceof KaloError) {
      if (e.kind === "auth") {
        await db.update(kaloSessions).set({ status: "dead", lastError: "Sesi kedaluwarsa / ditolak" }).where(eq(kaloSessions.id, k.ids[0]));
        g.__kalo = {};
        throw new Error("Sesi KaloData kedaluwarsa. Tambahkan sesi baru (cookie SESSION berlaku ±15 hari).");
      }
      if (e.kind === "quota") {
        // the client already rotated through every session; mark them all for today
        await db.update(kaloSessions).set({ status: "quota", quotaAt: new Date() }).where(eq(kaloSessions.status, "active"));
        g.__kalo = {};
        throw new Error("Kuota KaloData hari ini habis untuk semua sesi. Pencarian nama tetap bisa, detail menunggu besok.");
      }
      if (e.kind === "pagination") throw new Error("Batas halaman paket KaloData tercapai.");
      throw new Error(`KaloData: ${e.message}`);
    }
    throw e;
  }
}

// ---------------------------------------------------------------- cache

export async function getKv<T>(key: string, maxAgeMs?: number) {
  const row = await db.select().from(kvCache).where(eq(kvCache.key, key)).get();
  if (!row) return null;
  if (maxAgeMs && Date.now() - row.capturedAt.getTime() > maxAgeMs) return null;
  return { data: row.data as T, capturedAt: row.capturedAt };
}

export async function setKv(key: string, data: unknown) {
  const capturedAt = new Date();
  await db.insert(kvCache).values({ key, data, capturedAt }).onConflictDoUpdate({ target: kvCache.key, set: { data, capturedAt } });
}

/** Last-30-days window for a market, cached for the day (Kalodata data lags 1–2 days). */
export async function kaloRange(country: CountryCode = "ID"): Promise<DateRange> {
  const key = `kalo:range:${country}:${today()}`;
  const hit = await getKv<DateRange>(key);
  if (hit) return hit.data;
  const r = await kalo((c) => c.last30Days(country), country);
  await setKv(key, r);
  return r;
}

export const maskCookie = (c: string) => (c.length > 10 ? `${c.slice(0, 4)}…${c.slice(-4)}` : "••••");
