# AbheePay / Telering Platform

Monorepo with:
- `client/`: React + Vite frontend
- `backend/`: Express + Prisma backend

## Local Development

Run both apps from the repo root:

```bash
npm install
npm run dev
```

Frontend:
- `http://127.0.0.1:5173`

Backend:
- `http://127.0.0.1:4001`

## Environment Files

Frontend env example is in [`.env.example`](/c:/Users/kirti/.gemini/antigravity/scratch/abheepayqr02/.env.example).

Backend env example is in [`backend/.env.example`](/c:/Users/kirti/.gemini/antigravity/scratch/abheepayqr02/backend/.env.example).

For local work:
- copy `.env.example` to `client/.env`
- copy `backend/.env.example` to `backend/.env`

## Fresh Domain Deployment

This project can be deployed on a completely new domain. Nothing in the templates now depends on an old domain.

Example production setup:
- frontend: `https://app.yournewdomain.com`
- backend API: `https://api.yournewdomain.com`

### 1. Frontend env

Create `client/.env.production`:

```env
VITE_API_URL=https://api.yournewdomain.com/api
VITE_UPLOADS_URL=https://api.yournewdomain.com
```

### 2. Backend env

Create `backend/.env` on the server:

```env
PORT=4001
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=https://app.yournewdomain.com
BACKEND_URL=https://api.yournewdomain.com
NODE_ENV=production
```

### 3. Database

Run these once on the production backend:

```bash
cd backend
npx prisma generate
npx prisma db push
```

If you want starter users:

```bash
npx tsx src/seed.ts
```

### 4. Build the frontend

```bash
cd client
npm install
npm run build
```

Upload the contents of `client/dist/` to your frontend hosting path.

### 5. React routing on cPanel/Apache

Use an `.htaccess` file in the frontend public folder:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```

### 6. Backend hosting

The backend must run as a real Node process or platform service. Shared static hosting alone is not enough.

You need:
- Node.js support
- environment variables
- outbound internet access for your DB/API calls
- a process manager or hosting platform restart policy

Common choices:
- VPS with PM2
- Railway
- Render
- Vercel for frontend plus separate Node backend hosting
- cPanel Node app support, if your host provides it

## cPanel Frontend Deploy

There is a template in [`.cpanel.yml`](/c:/Users/kirti/.gemini/antigravity/scratch/abheepayqr02/.cpanel.yml), but you must update the target path for your own account before using it.

It now copies from `client/dist/`, which matches this repo structure.

## Final Go-Live Checklist

- set real production domain names
- set frontend production env
- set backend production env
- deploy backend process
- run Prisma on production DB
- upload `client/dist`
- add `.htaccess`
- verify login, merchants, QR pages, wallet, settlements, support
