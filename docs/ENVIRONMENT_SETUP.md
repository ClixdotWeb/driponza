# Environment Setup

Copy `.env.example` to `.env` (never commit `.env`). All values below are placeholders.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection (Neon pooled URL on Vercel; Coolify internal URL on Coolify) |
| `DIRECT_DATABASE_URL` | recommended | Non-pooled URL used for migrations |
| `SESSION_SECRET` | yes | HMAC key for session/token hashing (48+ random bytes) |
| `APP_URL` | yes | Public site URL, no trailing slash |
| `CRON_SECRET` | yes on Vercel | Protects `/api/cron/*` (Vercel sends it as a Bearer token) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`, `S3_UPLOAD_MAX_SIZE` | for Coolify MinIO | When all are set, S3 becomes the image store |
| `BLOB_READ_WRITE_TOKEN` | auto on Vercel | Vercel Blob fallback store |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | for email | Without these, emails are logged as `SKIPPED` in `NotificationLog` |
| `ADMIN_NOTIFY_EMAIL` | optional | Receives new-order and low-stock alerts |
| `PAYMENT_GATEWAY_ENABLED` | leave unset | Future gateway switch (Razorpay code is dormant) |
| `RAZORPAY_*` | leave unset | Only for the future gateway |

Business settings such as bank details, COD, shipping zones, GSTIN and policies are **not** environment variables. They are edited in **Admin → Settings** and stored in the database.

## MinIO on Coolify (owner/DevOps steps)
1. Coolify → New Resource → Service → **MinIO**. Attach a persistent volume to `/data`.
2. Set the console and API domains, for example `minio.yourdomain` (API) and `minio-console.yourdomain`, with HTTPS enabled.
3. In the MinIO console, create the bucket `driponza`. Set an anonymous **read-only** policy on the `public/` prefix only.
4. Create an access key limited to that bucket (policy: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::driponza/*`).
5. Set `S3_ENDPOINT=https://minio.yourdomain`, `S3_BUCKET=driponza`, `S3_REGION=us-east-1`, `S3_FORCE_PATH_STYLE=true`, `S3_PUBLIC_URL=https://minio.yourdomain/driponza`, and the key pair. Redeploy.
6. Enable Coolify scheduled backups of the MinIO volume.
