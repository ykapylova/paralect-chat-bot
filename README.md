# AI Chat

A Next.js chat app with **streaming assistant replies**, **persisted conversations** (PostgreSQL), **Clerk** authentication, **Supabase** storage for uploads, and **OpenAI** (or compatible) chat completions—including images and document context.

**Live app:** [https://paralect-chat-bot.vercel.app/](https://paralect-chat-bot.vercel.app/)

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- PostgreSQL database URL
- [Clerk](https://clerk.com/) application (sign-in / sign-up)
- [Supabase](https://supabase.com/) project (storage bucket for uploads)
- [OpenAI](https://platform.openai.com/) API key (or adjust integration for another provider)

## Setup

1. **Clone and install**

   ```bash
   cd web
   npm install
   ```

2. **Environment**

   Copy the example env file and fill in real values:

   ```bash
   cp .env.example .env.local
   ```

3. **Database schema**

   With `DATABASE_URL` set in `.env.local`:

   ```bash
   npm run db:migrate
   ```

   For local iteration you can use `npm run db:push` instead (pushes schema without migration files).

4. **Supabase storage**

   Create a bucket matching `SUPABASE_STORAGE_BUCKET` in `.env.local` (default in the example: `chat-uploads`), with policies appropriate for your app.

## Run locally

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
cd web
npm run build
npm start
```

## Scripts (from `web/`)

| Command               | Description                 |
| --------------------- | ----------------------------|
| `npm run dev`         | Development server          |
| `npm run build`       | Production build            |
| `npm run start`       | Serve production build      |
| `npm run lint`        | ESLint                      |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate`  | Apply migrations            |
| `npm run db:push`     | Push schema (dev-friendly)  |
