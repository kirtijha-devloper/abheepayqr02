# AbheePay / Telering Platform (Monorepo)

A complete platform composed of a React admin/merchant dashboard and an Express + Prisma backend.

## 📂 Project Structure

This project has been restructured into a clean monorepo.

*   `client/` - The React + Vite frontend application.
*   `backend/` - The Express.js + Prisma backend application.

---

## 🛠️ Tech Stack

**Frontend (`client/`)**
*   [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
*   React Router DOM (Routing)
*   Recharts (Charts/Analytics)

**Backend (`backend/`)**
*   Node.js + [Express.js](https://expressjs.com/)
*   [Prisma ORM](https://www.prisma.io/)
*   PostgreSQL ([Neon Serverless DB](https://neon.tech/))
*   jsQR + Jimp (AI QR Decoding)
*   Multer (File Uploads)

---

## 🚀 Local Development Guide

Since the project is a monorepo, you will need to run the Frontend and Backend separately in two different terminal windows.

### 1. Setting up the Backend
Open your first terminal and run:
```bash
cd backend
npm install
```

**Environment Variables:**
Create a `.env` file inside `backend/` and add your keys:
```env
DATABASE_URL="your-neon-postgres-url"
JWT_SECRET="your-secret-key"
FRONTEND_URL="http://localhost:5173"
PORT=4001
# InstantPay API keys if required
```

**Run Database Migrations & Start:**
```bash
npx prisma generate
npx prisma db push
npm run dev
```
*Backend will run on `http://localhost:4001`*

### 2. Setting up the Frontend
Open your second terminal and run:
```bash
cd client
npm install
```

**Environment Variables:**
Create `.env` (for local) or `.env.production` inside `client/`:
```env
VITE_API_URL=http://localhost:4001/api
VITE_UPLOADS_URL=http://localhost:4001/uploads
```

**Start Development Server:**
```bash
npm run dev
```
*Frontend will run on `http://localhost:5173`*

---

## 🌐 Deployment Instructions

### Backend (Vercel)
The backend is completely configured for Vercel deployment as a serverless function.
1. Connect this GitHub repository to Vercel.
2. In Vercel Project Settings -> **Root Directory**, set it to `backend`.
3. Add all your Environment Variables in the Vercel dashboard.
4. The deployment will automatically run `npm run build` (which includes `prisma generate`) and use `vercel.json` to route traffic.

### Frontend (cPanel / Hostitbro)
The frontend should be built locally and uploaded to your shared hosting provider.
1. Update `client/.env.production` to point to your live Vercel backend URL.
2. Generate the build locally:
   ```bash
   cd client
   npm run build
   ```
3. Copy the **contents** of the `client/dist/` folder.
4. Upload all files into your cPanel's `public_html/` folder.
5. **IMPORTANT**: Ensure you create an `.htaccess` file in `public_html/` to support React routing:

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

---

## ✨ Features
*   **Role-Based Dashboards**: Master Admin, ASM, and Merchant views.
*   **QR Management**: Bulk QR code generation, AI-based decoding, and automated assignment.
*   **Transactions & Settlements**: Manual report upload mapping tracking.
*   **Support System**: Interactive ticketing system for merchants.
*   **KYC Portal**: Document uploads and verification system.
