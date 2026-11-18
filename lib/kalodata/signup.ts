import { KaloError, KaloSession } from "./types";
import { WaroengMail } from "./waroengmail";

// Auto-signup akun trial Kalodata via email disposable WaroengMail.
//
// Flow (terbukti dari reverse HAR, 2026-11-18):
//   1. GET /signup                     -> cookie page_session (wajib)
//   2. POST /email/emailSendMessage    -> kirim OTP. captcha di-skip: response:"token"
//   3. poll WaroengMail                -> ambil OTP
//   4. POST /email/checkSignupVerification
//   5. POST /user/signup               -> set-cookie SESSION (hasil akhir)
//
// Tanpa browser, captcha solver, atau fingerprint Shumei/Aliyun. Gate server
// cuma page_session + deviceId (deviceId boleh UUID bikinan sendiri).
//
// ⚠️ Semua akun dari satu IP + deviceId mirip bisa di-flag/ban Kalodata belakangan.
// Untuk banyak akun: pakai proxy + deviceId acak per akun (opsi di bawah), jangan burst.

const BASE = "https://www.kalodata.com";

export interface SignupOptions {
  /** Domain WaroengMail (default: acak dari domain aktif). */
  mailDomain?: string;
  /** Negara akun (default "ID"). */
  country?: string;
  /** Mata uang (default "USD" — sama seperti form signup asli). */
  currency?: string;
  /** deviceId kustom (default UUID acak). Beda per akun = lebih aman. */
  deviceId?: string;
  /** Kode referral/promo (tcCode). Default kosong. */
  tcCode?: string;
  /** User-Agent (default Chrome Windows). */
  userAgent?: string;
  /** Timeout tunggu OTP, ms (default 120000). */
  otpTimeoutMs?: number;
  /** fetch kustom (buat suntik proxy). Default global fetch. */
  fetchFn?: typeof fetch;
}

/** Hasil signup: cukup di-spread jadi KaloSession untuk KaloClient. */
export interface SignupResult extends KaloSession {
  email: string;
  deviceId: string;
  /** Alias nilai cookie SESSION (= sessionCookie), buat kemudahan baca. */
  session: string;
}

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

/**
 * Cetak satu akun trial Kalodata. Mengembalikan email + cookie SESSION yang
 * langsung bisa dipakai di `new KaloClient({ sessions: [result] })`.
 *
 * @example
 * const acc = await signupKalodata();
 * const kalo = new KaloClient({ sessions: [acc] });
 *
 * @throws KaloError kind="auth" bila captcha mulai diperketat atau signup ditolak.
 */
export async function signupKalodata(options: SignupOptions = {}): Promise<SignupResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const country = options.country ?? "ID";
  const currency = options.currency ?? "USD";
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const deviceId = options.deviceId ?? crypto.randomUUID();

  // Cookie jar manual: kumpulkan set-cookie lintas request.
  const jar = new Map<string, string>([
    ["deviceId", deviceId],
    ["deviceType", "WEB"],
    ["appVersion", "1.0.0"],
  ]);
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const absorb = (res: Response) => {
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  };
  const base = {
    language: "en-US",
    currency,
    country,
    "user-agent": userAgent,
    origin: BASE,
    referer: `${BASE}/signup`,
  };
  const postJson = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetchFn(BASE + path, {
      method: "POST",
      headers: { ...base, accept: "application/json, text/plain, */*", "content-type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify(body),
    });
    absorb(res);
    return (await res.json()) as Record<string, unknown>;
  };

  // 1. GET /signup → page_session
  absorb(await fetchFn(`${BASE}/signup`, { headers: { ...base, accept: "text/html", cookie: cookieHeader() } }));

  // Siapkan email disposable
  const mail = await WaroengMail.random({
    domain: options.mailDomain,
    timeoutMs: options.otpTimeoutMs,
    fetchFn,
  });

  // 2. Kirim OTP (captcha di-skip dengan response:"token")
  const sent = await postJson("/email/emailSendMessage", { scene: "signup", response: "token", email: mail.address });
  if (sent.success !== true) {
    throw new KaloError(
      `emailSendMessage ditolak (captcha mungkin sudah diperketat): ${failMsg(sent)}`,
      "auth",
    );
  }

  // 3. Tunggu OTP dari WaroengMail
  const code = await mail.waitForCode({ from: "kalodata" });

  // 4. Verifikasi kode
  const verify = await postJson("/email/checkSignupVerification", {
    email: mail.address,
    loginMethod: "EMAIL",
    emailCode: code,
    scene: "signup",
  });
  if (verify.success !== true) throw new KaloError(`checkSignupVerification gagal: ${failMsg(verify)}`, "auth");

  // 5. Signup final → SESSION (catatan: field "scence" memang typo di API Kalodata)
  const done = await postJson("/user/signup", {
    scence: "signup",
    tcCode: options.tcCode ?? "",
    email: mail.address,
    emailCode: code,
    loginMethod: "EMAIL",
  });
  if (done.success !== true) throw new KaloError(`user/signup gagal: ${failMsg(done)}`, "auth");

  const session = jar.get("SESSION");
  if (!session) throw new KaloError("Signup sukses tapi cookie SESSION tidak diset.", "auth");

  // every other cookie Kalodata set during signup (device + tracking ids); the session is tied to them
  const extraCookies = [...jar].filter(([k]) => k !== "SESSION").map(([k, v]) => `${k}=${v}`).join("; ");
  return { email: mail.address, session, deviceId, sessionCookie: session, label: mail.address, userAgent, extraCookies };
}

/**
 * Cetak beberapa akun berurutan dengan jeda. Lewati yang gagal, kembalikan
 * yang berhasil. `delayMs` jeda antar signup (default 8000, hindari burst).
 */
export async function signupKalodataBatch(
  count: number,
  options: SignupOptions & { delayMs?: number } = {},
): Promise<{ sessions: SignupResult[]; failed: number }> {
  const { delayMs = 8000, ...opt } = options;
  const sessions: SignupResult[] = [];
  let failed = 0;
  for (let i = 0; i < count; i++) {
    try {
      sessions.push(await signupKalodata(opt));
    } catch {
      failed++;
    }
    if (i < count - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { sessions, failed };
}

function failMsg(o: Record<string, unknown>): string {
  const m = o.message;
  if (typeof m !== "string") return `code ${o.code ?? "?"}`;
  try {
    return (JSON.parse(m) as { message?: string }).message ?? m;
  } catch {
    return m;
  }
}
