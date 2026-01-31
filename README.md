This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Dagelijkse mail (18:00)

Er is een cron endpoint dat elke dag om 18:00 (Europe/Brussels) een mail kan sturen naar `ken.ceulemans@telenet.be` met alle **vandaag ingevoerde** verlofaanvragen (tabel `leave_requests`, status = `requested`).

- API route: `/api/daily-leave-email`
- Subject: `Aangevraagde verlof`
- Als er vandaag geen aanvragen zijn: er wordt **geen** mail verstuurd (endpoint geeft `204`).

### Benodigde env vars

- `NEXT_PUBLIC_SUPABASE_URL` (of `SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `RESEND_API_KEY`
- `EMAIL_FROM` (een geverifieerde afzender bij Resend)
- `CRON_SECRET` (alleen nodig om lokaal/manueel te testen via `?secret=...`)

### Scheduling

Voor Vercel staat de scheduling in `vercel.json` en triggert ze 2x per dag (16:00 en 17:00 UTC). De route zelf stuurt enkel effectief als het in **Europe/Brussels** 18:00 is (zodat zomer-/wintertijd klopt).

### Manueel testen

Roep lokaal op via:

- `http://localhost:3000/api/daily-leave-email?secret=YOUR_CRON_SECRET`

Wil je testen buiten 18:00 (Europe/Brussels), gebruik dan:

- `http://localhost:3000/api/daily-leave-email?secret=YOUR_CRON_SECRET&force=1`

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
