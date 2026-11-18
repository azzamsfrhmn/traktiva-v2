// Client minimal WaroengMail (https://waroengmail.com) — email disposable untuk
// terima kode OTP. Tanpa API key. Docs: https://waroengmail.com/llms.txt
//
// Dipakai modul signup Kalodata untuk menangkap kode verifikasi.

const BASE = "https://waroengmail.com";

/** Satu pesan di inbox WaroengMail (field yang kita pakai saja). */
export interface WaroengMessage {
  id: string;
  from: string;
  subject: string;
  text: string;
  receivedAt: number; // Unix ms
  /** Kode verifikasi yang terdeteksi server, atau null. */
  code: string | null;
}

export interface WaroengMailOptions {
  /** Interval poll ms (min 2000 per aturan server, default 4000). */
  pollMs?: number;
  /** Timeout total menunggu OTP, ms (default 120000 = 2 menit). */
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Email disposable WaroengMail.
 *
 * @example
 * const mail = await WaroengMail.random();      // alamat acak di domain aktif
 * // ...picu pengiriman OTP ke mail.address...
 * const code = await mail.waitForCode({ from: "kalodata" });
 */
export class WaroengMail {
  private readonly opt: Required<Omit<WaroengMailOptions, "fetchFn">> & { fetchFn: typeof fetch };
  /** Patokan waktu: hanya pesan setelah ini yang dihitung. */
  private readonly since: number;

  constructor(
    readonly address: string,
    options: WaroengMailOptions = {},
  ) {
    this.opt = {
      pollMs: Math.max(2000, options.pollMs ?? 4000),
      timeoutMs: options.timeoutMs ?? 120_000,
      fetchFn: options.fetchFn ?? fetch,
    };
    this.since = Date.now();
  }

  /** Daftar domain aktif. */
  static async domains(fetchFn: typeof fetch = fetch): Promise<string[]> {
    const r = await fetchFn(`${BASE}/api/domains`);
    const j = (await r.json()) as { domains?: string[] };
    return j.domains ?? [];
  }

  /**
   * Bikin alamat acak di salah satu domain aktif. Inbox dibuat otomatis saat
   * email pertama masuk — tidak perlu registrasi.
   *
   * @param opts.domain paksa domain tertentu (default: acak dari daftar aktif)
   * @param opts.prefix awalan local-part (default "tk")
   */
  static async random(opts: { domain?: string; prefix?: string } & WaroengMailOptions = {}): Promise<WaroengMail> {
    const fetchFn = opts.fetchFn ?? fetch;
    const domain = opts.domain ?? pick(await WaroengMail.domains(fetchFn));
    if (!domain) throw new Error("WaroengMail: tidak ada domain aktif.");
    const local = (opts.prefix ?? "tk") + randomStr(8);
    return new WaroengMail(`${local}@${domain}`, opts);
  }

  /** Ambil pesan terbaru (yang masuk setelah objek ini dibuat). */
  async latest(filter: { from?: string; subject?: string } = {}): Promise<WaroengMessage | null> {
    const qs = new URLSearchParams();
    if (filter.from) qs.set("from", filter.from);
    if (filter.subject) qs.set("subject", filter.subject);
    const r = await this.opt.fetchFn(`${BASE}/api/${encodeURIComponent(this.address)}/latest?${qs}`);
    if (r.status === 404) return null; // belum ada email
    if (!r.ok) throw new Error(`WaroengMail latest: HTTP ${r.status}`);
    const j = (await r.json()) as { code: string | null; message: WaroengMessage | null };
    const msg = j.message;
    if (!msg || msg.receivedAt < this.since) return null;
    return { ...msg, code: j.code ?? msg.code ?? null };
  }

  /**
   * Poll sampai OTP muncul. Mengembalikan kode (dari field `code` server) atau
   * melempar saat timeout.
   *
   * @param filter.from substring pengirim, mis. "kalodata"
   */
  async waitForCode(filter: { from?: string; subject?: string } = {}): Promise<string> {
    const deadline = Date.now() + this.opt.timeoutMs;
    while (Date.now() < deadline) {
      await sleep(this.opt.pollMs);
      const msg = await this.latest(filter);
      if (msg?.code) return msg.code;
      // Fallback: cari 4-8 digit di teks kalau server tak deteksi code
      if (msg?.text) {
        const m = msg.text.match(/\b(\d{4,8})\b/);
        if (m) return m[1];
      }
    }
    throw new Error(`WaroengMail: OTP untuk ${this.address} tidak masuk dalam ${this.opt.timeoutMs}ms.`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T>(a: T[]): T | undefined => a[Math.floor(Math.random() * a.length)];
function randomStr(n: number): string {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
