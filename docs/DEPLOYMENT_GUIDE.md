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
`vercel.json` schedules `/api/cron/expire-orders` hourly. It releases stock held by unpaid bank-transfer orders after the configured hold period. Vercel sends `Authorization: Bearer $CRON_SECRET`.

## Coolify alternative
The `Dockerfile` builds a standalone Next.js image. In Coolify:
1. Add a PostgreSQL resource and MinIO (see `ENVIRONMENT_SETUP.md`).
2. Add the app from Git with the Dockerfile build pack.
3. Set the environment variables, the health check path `/api/health`, and the restart policy `unless-stopped`.
4. Add a pre-deploy command `npx prisma migrate deploy`.
5. Replace the Vercel cron with a Coolify scheduled task: `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/expire-orders`.
