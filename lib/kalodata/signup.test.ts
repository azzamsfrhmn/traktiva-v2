// Self-check signup tanpa jaringan: `npx tsx lib/kalodata/signup.test.ts`.
// fetch palsu memerankan WaroengMail + Kalodata; menguji urutan flow,
// skip-captcha, penangkapan cookie SESSION, dan deteksi captcha diperketat.
import assert from "node:assert";
import { signupKalodata } from "./signup";
import { KaloError } from "./types";

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

/** fetch palsu yang mencatat urutan panggilan. */
function fakeFetch(opts: { sendOk?: boolean; signupSetsSession?: boolean } = {}) {
  const { sendOk = true, signupSetsSession = true } = opts;
  const seen: string[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    seen.push(u.replace("https://", ""));
    if (u.endsWith("/signup") && (init?.method ?? "GET") === "GET") {
      return new Response("<html>", { status: 200, headers: { "set-cookie": "page_session=ps123; Path=/" } });
    }
    if (u.includes("/api/domains")) return json({ domains: ["meitu.id"] });
    if (u.includes("/email/emailSendMessage")) {
      // Pastikan captcha di-skip dengan response:"token"
      assert.match(String(init?.body), /"response":"token"/);
      return json({ success: sendOk, data: sendOk ? "req1" : null, message: sendOk ? null : '{"message":"captcha"}' });
    }
    if (u.includes("/latest")) return json({ code: "123456", message: { id: "m", from: "kalodata", subject: "123456", text: "123456", receivedAt: Date.now() + 1, code: "123456" } });
    if (u.includes("/email/checkSignupVerification")) return json({ success: true, data: "success" });
    if (u.includes("/user/signup")) {
      return json({ success: true, data: { eventId: "e" } }, signupSetsSession ? { "set-cookie": "SESSION=sess-abc; Path=/" } : {});
    }
    return json({ success: false });
  }) as unknown as typeof fetch;
  return { fn, seen };
}

async function run() {
  // 1. Happy path → dapat SESSION, urutan benar.
  const f1 = fakeFetch();
  const r = await signupKalodata({ fetchFn: f1.fn, otpTimeoutMs: 2000, mailDomain: "meitu.id" });
  assert.equal(r.session, "sess-abc");
  assert.equal(r.sessionCookie, "sess-abc");
  assert.ok(r.email.endsWith("@meitu.id"));
  assert.ok(r.deviceId.length > 0);
  // GET /signup harus sebelum emailSendMessage
  const iSignupGet = f1.seen.findIndex((x) => x.endsWith("/signup"));
  const iSend = f1.seen.findIndex((x) => x.includes("emailSendMessage"));
  assert.ok(iSignupGet >= 0 && iSignupGet < iSend, "GET /signup harus lebih dulu");

  // 2. Captcha diperketat (sendOk=false) → KaloError auth.
  const f2 = fakeFetch({ sendOk: false });
  await assert.rejects(
    () => signupKalodata({ fetchFn: f2.fn, otpTimeoutMs: 2000, mailDomain: "meitu.id" }),
    (e) => e instanceof KaloError && e.kind === "auth",
  );

  // 3. Signup sukses tapi SESSION tak diset → error jelas.
  const f3 = fakeFetch({ signupSetsSession: false });
  await assert.rejects(
    () => signupKalodata({ fetchFn: f3.fn, otpTimeoutMs: 2000, mailDomain: "meitu.id" }),
    (e) => e instanceof KaloError && /SESSION/.test((e as Error).message),
  );

  console.log("OK — signup self-check lulus");
}

run().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
