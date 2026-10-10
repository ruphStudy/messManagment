# Release checklist (MVP)

Tick every item for the production environment. The API refuses to start in `NODE_ENV=production` when the
config is unsafe (it lists every problem), so most API items are enforced — the rest are operational.

## Database
- [ ] Managed PostgreSQL with automated backups enabled; restore procedure tried once.
- [ ] `pnpm --filter api exec prisma migrate deploy` run; `prisma migrate status` reports no pending/failed migrations.
- [ ] Demo seed **not** run (it refuses `NODE_ENV=production`). Create the real platform admin by hand
      (a `PLATFORM_ADMIN` user with a strong password; no mess membership), then rotate that password.

## API (`apps/api/.env`, see `.env.example`)
- [ ] `NODE_ENV=production`, `DATABASE_URL` (non-localhost unless `ALLOW_LOCAL_DATABASE=true`).
- [ ] `JWT_ACCESS_SECRET` freshly generated (≥ 32 chars, never the example value).
- [ ] `CORS_ORIGINS` = the https web origin(s) only.
- [ ] `SMS_PROVIDER` = a real provider. **Blocker today:** only the development console provider exists, so student OTP sign-in
      needs an SMS integration before launch (the API will not start with `console` in production).
- [ ] `PUSH_PROVIDER=expo` (+ `EXPO_ACCESS_TOKEN` if push security is enabled in Expo) or `disabled` (in-app notifications only).
- [ ] `SCHEDULER_ENABLED=true` on exactly one API instance (daily 09:00 IST expiry reminders, deduplicated), `false` on others.
- [ ] `UPLOAD_DIR` = absolute path on a **persistent, backed-up volume**, and `UPLOAD_STORAGE_PERSISTENT=true`
      (complaint photos; object storage is a later step).
- [ ] Behind HTTPS (refresh cookie is `Secure` in production); proxy forwards `X-Forwarded-For` (rate limits).
- [ ] `GET /api/v1/health` returns `{ status: "ok", database: "up" }` from the load balancer.
- [ ] `/admin/system` (platform admin) shows the expected modes and no storage/push warnings you didn't expect.

## Web (`apps/web`)
- [ ] `API_ORIGIN` = internal URL of the API (the web proxies `/api/v1`, keeping the refresh cookie first-party).
- [ ] `pnpm --filter web build` passes; served over HTTPS on the origin listed in `CORS_ORIGINS`.

## Mobile (`apps/mobile`)
- [ ] `EXPO_PUBLIC_API_URL` = public https API origin (otherwise the app points at localhost).
- [ ] **Blocker for push:** `expo.extra.eas.projectId` set (run `eas init`); without it the app cannot get an Expo push token.
- [ ] `ios.bundleIdentifier` / `android.package` (`com.messmate.student`) confirmed as the final store identifiers.
- [ ] App icon + splash assets added (none configured yet).
- [ ] Notification permission and photo/camera permission texts reviewed (`app.json`).

## Versioning
- [ ] Bump `version` in `apps/api/package.json`, `apps/web/package.json` and `apps/mobile/app.json` (`expo.version`) together.
- [ ] Increment `expo.ios.buildNumber` and `expo.android.versionCode` for every store build.

## Verification before go-live
- [ ] `pnpm typecheck && pnpm lint && pnpm build`
- [ ] `python3 apps/api/test/integration/run.py` against a staging copy (all suites pass).
- [ ] Smoke test on a real phone: OTP sign-in, QR shown, staff scan on web, pause, payment receipt, complaint with photo, push received.
