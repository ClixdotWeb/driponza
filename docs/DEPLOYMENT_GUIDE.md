# Deployment Guide

## Current production (verified)
- Vercel project `driponza` → https://driponza.vercel.app
- Neon PostgreSQL (Vercel Marketplace integration) supplies `DATABASE_URL`
- Vercel Blob store `driponza-images` supplies `BLOB_READ_WRITE_TOKEN`

## Release procedure
1. `npm run typecheck && npm test` must pass locally.
2. **Back up the database before every migration**: Neon console → Branches → *Create branch* from `main` (an instant copy-on-write snapshot). Name it `backup-YYYYMMDD`.
3. Apply migrations: `DATABASE_URL=<direct prod url> npx prisma migrate deploy`. Migrations are additive only.
4. Deploy: `npx vercel --prod` (or push to the connected branch).
5. Smoke test: `GET /api/health` returns `{ ok: true, db: true }`. Then load the homepage, open a product, and add it to the cart.

## Staging
Create a Neon branch `staging` and a Vercel Preview deployment with `DATABASE_URL` pointing at it. Run `npm run test:e2e` against the preview URL before promoting.

## Rollback
- Code: Vercel → Deployments → previous deployment → *Promote to Production* (instant).
- Database: migrations are additive, so older code keeps working against the newer schema. For data corruption, restore from the Neon backup branch (Neon → Restore).

## Backups
Neon keeps point-in-time history (plan-dependent retention). Also take a weekly logical dump: `pg_dump --format=custom "$DIRECT_DATABASE_URL" > driponza-$(date +%F).dump`. Test a restore into a scratch branch monthly: `pg_restore --clean --no-owner -d "$SCRATCH_URL" file.dump`.

## Cron
`vercel.json` schedules `/api/cron/expire-orders` daily at 02:00 IST (Vercel Hobby allows only daily crons); expiry also runs opportunistically, at most every 10 minutes, when checkout or the admin panel is opened. It releases stock held by unpaid bank-transfer orders after the configured hold period. Vercel sends `Authorization: Bearer $CRON_SECRET`.

## Coolify deployment (step by step)

The `Dockerfile` builds a standalone Next.js image and runs `prisma migrate deploy`
on every start, so no separate pre-deploy command is needed.

### 0. Decide where the data lives

| Option | Result |
|---|---|
| **Keep Neon** (recommended) | Products, stock, settings, orders and staff accounts carry over unchanged. Set `DATABASE_URL` to the same Neon string the Vercel project uses. |
| **New PostgreSQL in Coolify** | Starts empty. Run the seed and re-enter settings; the catalogue can be restored with `npm run db:seed`. |

Product images for the current catalogue live in `public/images/products/`, so they
ship inside the image either way. Only images uploaded later through the admin need
object storage (step 3).

### 1. Create the database (only if not reusing Neon)

Coolify → **+ New** → **Database** → **PostgreSQL 16**. Note the *internal* connection
string for `DATABASE_URL`; migrations can use the same value.

### 2. Generate the secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # CRON_SECRET
```

`SESSION_SECRET` peppers session tokens — **changing it signs everyone out**, so keep it
stable once set. Reuse the Vercel value to keep existing sessions alive.

### 3. Object storage for admin uploads (optional)

Either add a **MinIO** resource and set the `S3_*` variables, or skip S3 entirely and
mount a persistent volume at `/app/uploads` (Coolify → Storages). Without one, images
uploaded through the admin are lost on redeploy. Resolution order is S3 → Vercel Blob → local disk.

### 4. Create the application

Coolify → **+ New** → **Application** → from Git, this repository, branch `master`.
Build pack **Dockerfile**. Port **3000**. Health check path **`/api/health`**.
Restart policy **unless-stopped**.

### 5. Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Non-pooled URL for migrations (same value is fine for a Coolify Postgres) |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | Public site URL, no trailing slash |
| `SESSION_SECRET` | From step 2 |
| `CRON_SECRET` | From step 2 |
| `S3_*` | Only if using MinIO (see `.env.example`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Required for order confirmations, password resets and verification. Without `SMTP_HOST` every email is recorded as SKIPPED and nothing is delivered. |
| `ADMIN_NOTIFY_EMAIL` | Where new-order and payment alerts go |

### 6. Deploy and verify

Deploy, then check `GET $APP_URL/api/health` returns `{"status":"ok"}`. Load the
homepage, open a product, add it to the cart.

### 7. Create the admin account

Coolify → the application → **Terminal** (or `docker exec` on the host):

```bash
npm run admin:create -- owner@driponza.com "Driponza Owner" "a-strong-password"
npm run admin:list   # confirm
```

This creates or promotes the account, gives it Super Admin and marks the email verified.
Hand that email and password to the client. If the database came from Neon, the existing
admin accounts are already there — use **Admin → Staff & roles → Set password** instead.

### 8. Scheduled task (replaces the Vercel cron)

Coolify → the application → **Scheduled Tasks** → add, frequency `30 * * * *`:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/expire-orders
```

Hourly is correct here — the daily schedule in `vercel.json` exists only because Vercel's
Hobby plan forbids anything more frequent.

### 9. Domain and switch-over

Add the domain in Coolify (it issues Let's Encrypt automatically), point DNS at the
server, set `APP_URL`/`NEXT_PUBLIC_APP_URL` to it and redeploy. Keep the Vercel
deployment running until the new one is verified; then pause it so two apps are not
writing to one database with different `APP_URL` values in outgoing emails.

### Rollback

Coolify → Deployments → redeploy the previous commit. The database is unaffected:
migrations are additive, so the older image still runs against the newer schema.
