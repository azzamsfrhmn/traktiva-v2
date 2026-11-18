# Desain BE: Login TikTok (V2)

Status: **draf untuk review owner** · 18 Nov 2026
Sumber V1: `bot-autoupload/src/main/ipc/accountIpc.js` (`openTikTokCdpLogin`) dan `platforms/tiktok/tiktokSessionManager.js`.

## Cara kerja V1 (ringkas)
1. Buka **Chrome asli** dengan folder profil baru (`--user-data-dir`) + port CDP acak, langsung ke halaman login TikTok.
2. Pembeli login **manual** di jendela itu (QR, email, atau HP).
3. Bot memeriksa cookie tiap beberapa detik sampai muncul cookie sesi (`sessionid` / `sid_tt`).
4. Bot mencari username lewat endpoint akun TikTok (fallback: data halaman → link profil di DOM).
5. Bot membuka halaman profil, mengambil nickname, avatar, angka followers, dan daftar video dari DOM, lalu mengambil etalase TikTok Shop.
6. Chrome ditutup, folder profil **di-rename** ke `acc_<username>`, dan akun disimpan ke file JSON.

### Masalah V1 yang dibereskan di V2
| Masalah V1 | Dampak | V2 |
|---|---|---|
| Folder profil di-rename setelah Chrome ditutup | Sering gagal karena file masih dikunci Chrome (ada retry sampai 15 detik) | Folder dinamai **ID akun internal sejak awal**, tidak pernah di-rename |
| Login, ambil profil, dan etalase dalam satu alur panjang | Kalau satu bagian gagal, semuanya ikut gagal | Login **hanya** mendeteksi sesi + username. Profil dan etalase jadi **job terpisah** yang bisa diulang |
| Tidak ada batas waktu atau tombol batal | Chrome bisa menggantung | Batas **10 menit**, endpoint **batal**, dan deteksi kalau Chrome ditutup pembeli |
| Dua login di profil yang sama bisa berjalan bersamaan | Profil korup | **Kunci per akun** (satu login aktif per akun) |
| Status tersimpan di file JSON | Rawan korup, susah di-query | Tabel SQLite + status yang jelas |

## Arsitektur V2

Login **harus berjalan di PC pembeli**, karena pembeli perlu melihat jendela Chrome dan memasukkan OTP atau scan QR. Yang menjalankannya adalah server Next lokal (proses yang sama dengan UI, baik di Electron maupun mode web).

```
UI (Akun) ──POST /api/tiktok/login──▶ Next server lokal
   ▲                                   ├ lib/browser/chrome.ts      cari Chrome, launch profil, CDP, matikan proses
   │ polling / SSE status              ├ lib/platforms/tiktok/login.ts   state machine login
   └───────────────────────────────────├ lib/platforms/tiktok/profile.ts sync profil + video
                                       ├ lib/jobs/runner.ts         antrean job di DB (dipakai ulang untuk upload)
                                       └ SQLite: accounts, login_sessions, jobs
```

## State machine login

```
pending → browser_open → waiting_user → session_found → identified → done
                 │              │               │
                 └──────────────┴───────────────┴──▶ failed | cancelled | timeout
```

| Status | Artinya | Ditampilkan ke pembeli |
|---|---|---|
| `browser_open` | Chrome sedang dibuka | "Membuka Chrome..." |
| `waiting_user` | Menunggu pembeli login | "Silakan login di jendela Chrome" |
| `session_found` | Cookie sesi ada, mencari username | "Login terdeteksi, mengenali akun..." |
| `identified` | Username didapat, akun disimpan, Chrome ditutup | "Akun @x tersambung" |
| `done` | Job sync profil sudah diantrekan | Toast sukses, baris akun muncul |
| `cancelled` | Pembeli menekan Batal atau menutup Chrome | "Login dibatalkan" |
| `timeout` | Lebih dari 10 menit tanpa login | "Waktu habis, coba lagi" |
| `failed` | Error lain | Pesan error + tombol Coba lagi |

## API (route handler Next, hanya localhost)

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/tiktok/login` | Mulai login. Body opsional `{ accountId }` untuk login ulang akun lama. Balas `{ loginId }` |
| GET | `/api/tiktok/login/:id` | Status login (UI polling tiap 1,5 detik; SSE bisa menyusul) |
| POST | `/api/tiktok/login/:id/cancel` | Batalkan dan tutup Chrome |
| POST | `/api/accounts/:id/sync` | Antrekan sync profil + video + etalase |
| POST | `/api/accounts/:id/check` | Cek apakah sesi masih hidup → update status `active` / `need_login` |

## Data

**`accounts`** (tabel yang sudah ada, ditambah kolom):
`external_id` (uid TikTok, untuk deteksi duplikat walau username berubah), `nickname`, `avatar_url`, `followers`, `following`, `likes`, `profile_dir` (berbasis ID internal), `last_login_at`, `last_check_at`, `last_sync_at`.

**`login_sessions`** (baru): `id`, `platform`, `account_id` (null kalau akun baru), `status`, `profile_dir`, `cdp_port`, `pid`, `error`, `started_at`, `updated_at`.

**`jobs`** (baru, dipakai ulang untuk upload nanti): `id`, `type` (`tiktok.sync_profile`, `tiktok.check_session`, nanti `tiktok.upload`), `account_id`, `payload` JSON, `status`, `attempts`, `run_after`, `error`, timestamp.

**`account_posts`** (baru, opsional): cache video profil untuk menu Profil & Postingan.

Cookie **tidak disimpan di DB**. Sesi tetap berada di folder profil Chrome di `TRAKTIVA_DATA_DIR/profiles/tiktok/<accountId>`.

## Aturan penting
1. **Chrome asli sistem**, bukan Chromium bawaan Playwright. Sidik jari browsernya lebih natural, jadi risiko ditandai TikTok lebih kecil. Playwright hanya dipakai untuk terhubung lewat CDP.
2. **Akun duplikat:** kalau `external_id` sudah ada, akun lama di-update (sesi baru) dan tidak dibuat baris baru. Folder profil sementara dihapus.
3. **Login ulang** akun lama memakai folder profil akun itu sendiri, jadi riwayat browser dan perangkat tetap konsisten di mata TikTok.
4. **Cek sesi** berjalan headless dengan profil yang sama, maksimal sekali per 30 menit per akun (cooldown seperti V1). Kalau gagal → status `need_login` dan muncul di Beranda "Perlu perhatian".
5. **Semua proses Chrome dicatat (`pid`)** dan dimatikan saat batal, timeout, atau app ditutup. Sisa lock file profil dibersihkan sebelum launch.
6. Port CDP hanya dibuka di `127.0.0.1`.

## Risiko
- ⚠️ **Risiko ban/limit akun TikTok:** otomasi apa pun bisa terdeteksi. Mitigasinya: Chrome asli, satu profil tetap per akun, jeda wajar saat sync, dan tanpa login berulang-ulang.
- Endpoint akun dan selector DOM TikTok bisa berubah sewaktu-waktu. Karena itu deteksi username punya beberapa fallback (seperti V1), dan sync profil dibuat sebagai job terpisah supaya kegagalannya tidak membatalkan login.

## Tahapan implementasi
1. `lib/browser/chrome.ts` + tabel `login_sessions` + endpoint login, status, dan batal.
2. Layar login di halaman Akun (tombol "Hubungkan TikTok" + panel status langkah demi langkah).
3. Tabel `jobs` + runner + `tiktok.sync_profile` dan `tiktok.check_session`.
4. Sambungkan ke Beranda (Perlu perhatian) dan menu Profil & Postingan.
