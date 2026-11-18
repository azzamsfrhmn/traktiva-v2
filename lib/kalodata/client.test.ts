// Self-check tanpa framework: jalankan `npx tsx lib/kalodata/client.test.ts`.
// Pakai fetch palsu — tidak menyentuh server Kalodata. Menguji logika rotasi
// sesi, deteksi kuota, dan parser angka. Semua assert; gagal = throw.
import assert from "node:assert";
import { KaloClient, parseKaloNumber } from "./client";
import { KaloError } from "./types";

/** Bikin Response JSON palsu. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const QUOTA = json({ success: false, data: null, message: JSON.stringify({ message: "used up", cause: "DETAIL.ACCESS_TIMES" }) });
const OK = json({ success: true, data: { revenue: "Rp1b" }, message: null });

async function run() {
  // 1. parseKaloNumber
  assert.equal(parseKaloNumber("Rp52.85b"), 52_850_000_000);
  assert.equal(parseKaloNumber("1.07m"), 1_070_000);
  assert.equal(parseKaloNumber("572.87k"), 572_870);
  assert.equal(parseKaloNumber(1234), 1234);
  assert.equal(parseKaloNumber(null), 0);

  // 2. Rotasi: sesi-1 kena kuota → otomatis pindah sesi-2, request berhasil.
  const calls: string[] = [];
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    const cookie = String((init?.headers as Record<string, string>)?.cookie);
    calls.push(cookie);
    return cookie.includes("sesi1") ? QUOTA.clone() : OK.clone();
  }) as unknown as typeof fetch;

  const kalo = new KaloClient({
    sessions: [{ sessionCookie: "sesi1" }, { sessionCookie: "sesi2" }],
    minDelayMs: 0,
    jitterMs: 0,
    fetchFn,
  });

  const total = await kalo.productTotal("123", { startDate: "2026-10-18", endDate: "2026-11-16" });
  assert.equal((total as { revenue: string }).revenue, "Rp1b");
  assert.ok(calls.some((c) => c.includes("sesi1")), "sesi1 harus dicoba dulu");
  assert.ok(calls.some((c) => c.includes("sesi2")), "sesi2 harus jadi cadangan");
  assert.equal(kalo.liveSessionCount, 1, "sesi1 ditandai habis");

  // 3. Semua sesi habis → lempar KaloError kind=quota.
  const kalo2 = new KaloClient({
    sessions: [{ sessionCookie: "x" }],
    minDelayMs: 0,
    jitterMs: 0,
    fetchFn: (async () => QUOTA.clone()) as unknown as typeof fetch,
  });
  await assert.rejects(
    () => kalo2.productTotal("1", { startDate: "a", endDate: "b" }),
    (e) => e instanceof KaloError && e.kind === "quota",
  );

  // 4. resetQuota mengembalikan sesi.
  kalo.resetQuota();
  assert.equal(kalo.liveSessionCount, 2);

  // 5. Sesi hasil signup terikat perangkat: cookie perangkat + UA browser wajib ikut terkirim.
  let sent: Record<string, string> = {};
  const kalo3 = new KaloClient({
    sessions: [{ sessionCookie: "S", deviceId: "dev-1" }, { sessionCookie: "T", extraCookies: "deviceId=dev-2; foo=bar" }],
    minDelayMs: 0,
    jitterMs: 0,
    fetchFn: (async (_u: string, init?: RequestInit) => {
      sent = init?.headers as Record<string, string>;
      return OK.clone();
    }) as unknown as typeof fetch,
  });
  await kalo3.productTotal("1", { startDate: "a", endDate: "b" });
  assert.match(sent.cookie, /SESSION=S; deviceId=dev-1; deviceType=WEB/, "deviceId harus ikut di cookie");
  assert.match(sent["user-agent"], /Chrome/, "UA browser, bukan UA bawaan Node");
  const kalo4 = new KaloClient({ sessions: [{ sessionCookie: "T", extraCookies: "deviceId=dev-2; foo=bar" }], minDelayMs: 0, jitterMs: 0, fetchFn: kalo3["opt"].fetchFn });
  await kalo4.productTotal("1", { startDate: "a", endDate: "b" });
  assert.equal(sent.cookie, "SESSION=T; deviceId=dev-2; foo=bar", "cookie signup dikirim apa adanya");

  console.log("OK — semua self-check lulus");
}

run().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
