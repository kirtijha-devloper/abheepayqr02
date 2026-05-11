# Local Database Setup

This backend already supports switching between local Postgres and Neon.

## Local-first env setup

Use these variables in `backend/.env`:

```env
DATABASE_TARGET=local
DATABASE_URL="postgresql://postgres:password@localhost:5432/liopay"
DATABASE_URL_LOCAL="postgresql://postgres:password@localhost:5432/liopay"
DATABASE_URL_NEON="postgresql://user:password@host:5432/dbname?sslmode=require"
```

Why both `DATABASE_URL` and `DATABASE_URL_LOCAL`:

- App runtime uses `DATABASE_TARGET` + `DATABASE_URL_LOCAL`
- Prisma CLI commands like `prisma db push` still read `DATABASE_URL`

## Create the local database

```sql
CREATE DATABASE liopay;
```

## Sync schema into local Postgres

Run from `backend/`:

```powershell
npm.cmd run db:push
```

## Export Neon and restore into local Postgres

This machine does not currently have `pg_dump` / `psql` installed, so install PostgreSQL client tools first.

After that, use:

```powershell
pg_dump "postgresql://user:password@host:5432/dbname?sslmode=require" --format=custom --file neon-backup.dump
psql "postgresql://postgres:password@localhost:5432/postgres" -c "CREATE DATABASE liopay;"
pg_restore --no-owner --no-privileges --clean --if-exists --dbname "postgresql://postgres:password@localhost:5432/liopay" neon-backup.dump
```

## Start backend against local DB

```powershell
npm.cmd run dev
```

Health check:

```text
http://localhost:4001/health
```
