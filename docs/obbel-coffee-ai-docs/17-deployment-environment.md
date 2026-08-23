# 17 — Deployment & Environment

## 1. Environments
Minimal:
- Development
- Production

Recommended:
- Development
- Staging
- Production

## 2. Backend & database env (Coolify)
Per environment:
- backend API base URL;
- `DATABASE_URL` PostgreSQL (server-only, disimpan sebagai Coolify env var);
- JWT signing secret (server-only);
- object storage credential (S3-compatible/MinIO) bila dipakai;
- database migrations dijalankan sebagai deploy step terpisah.

Never commit secret.

## 3. Flutter Android
Gunakan flavor bila tersedia:
- dev
- prod

Config:
- Backend API base URL
- environment label
- FCM config P1

Build:
- signed APK/AAB production;
- applicationId unik untuk Booth dan Owner.

Contoh naming konseptual:
- `com.obbel.booth`
- `com.obbel.owner`

Final package name dikonfirmasi sebelum publish.

## 4. Admin Web PWA
Deploy target dapat Vercel, Coolify, atau server Node kompatibel.

Requirement:
- HTTPS;
- PWA manifest;
- icons;
- service worker configuration;
- environment variables;
- proper caching policy.

## 5. Database migration
CI/deploy harus menjalankan migration dengan prosedur terkontrol. Backup sebelum destructive migration.

## 6. Observability
Minimum:
- client error logging;
- server/RPC error logging;
- audit_logs untuk business action;
- uptime monitor Admin Web optional.

## 7. Release checklist
- version bump;
- migrations applied;
- authorization/role & booth-scoping rules verified;
- test critical flows;
- APK/AAB signed;
- PWA install tested;
- printer test device bila feature enabled;
- rollback plan.

## 8. Data backup/export
Sediakan prosedur admin database backup dan export transaksi periodik jika diperlukan operasional.
