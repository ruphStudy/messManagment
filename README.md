# MessMate — Mess Management Platform

pnpm monorepo:

| Path | What | Stack |
| --- | --- | --- |
| `apps/api` | Modular-monolith backend | NestJS 11, Prisma 6, PostgreSQL |
| `apps/web` | Owner / manager / staff web app | Next.js 15, React 19, Tailwind 4 |
| `apps/mobile` | Student app (Android / iOS) | Expo SDK 54, expo-router |
| `packages/shared` | Roles, permissions, enums, validation rules, API types | TypeScript |

## Setup

```bash
pnpm install                       # also builds packages/shared
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL + JWT_ACCESS_SECRET
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
createdb mess_management
pnpm db:migrate && pnpm db:seed

pnpm dev:api      # http://localhost:4100/api/v1 (Swagger: /api/docs, non-production only)
pnpm dev:web      # http://localhost:3100
pnpm dev:mobile   # Expo; use your LAN IP in EXPO_PUBLIC_API_URL for a real phone
```

Seeded logins (password `Password123`): owner `9000000001`, manager `9000000002`, staff `9000000003`.
Students sign in on mobile with any number. In development the OTP is logged by the API and shown in the app (`OTP_DEV_ECHO=true`).

## Architecture notes

- **Tenancy**: `User` ↔ `MessMembership(role, status)` ↔ `Mess`. Tenant-scoped endpoints take the mess id from the caller's
  server-side membership (`@CurrentMessId()`), never from the request. Future business tables must carry `messId`.
- **Authorization**: global `JwtAuthGuard` (opt out with `@Public()`) then `RolesGuard`, which enforces `@Roles()`, `@RequirePermissions()`
  and `@RequireMess()`. The role → permission map lives in `packages/shared/src/roles.ts` and is used by both the API and the UI.
- **Sessions**: short-lived JWT access token (in memory) + rotating refresh token `<sessionId>.<secret>` (only a SHA-256 hash is stored).
  Web gets it as an httpOnly `SameSite=Lax` cookie through the Next.js `/api/v1` proxy; mobile clients (`x-client-type: MOBILE`) get it in the body and keep it in SecureStore.
  Replaying a rotated token after a 30s grace window revokes the session. User status, session and membership are re-checked on every request.
- **OTP**: `SmsProvider` interface with a console implementation for development. The API refuses to start with `SMS_PROVIDER=console` in production.
- **Responses**: `{ data, meta? }` on success, `{ error: { code, message, fields? } }` on failure.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm build
```
