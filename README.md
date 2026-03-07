# GenPromptly

GenPromptly is a B2B SaaS prompt operations platform operated by OpsForLocal.

## Stack

- Next.js App Router (TypeScript)
- Clerk authentication
- Prisma + PostgreSQL
- OpenAI optimization pipeline

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy env template and fill required values:

```bash
cp .env.example .env.local
```

Required minimum:

- `DATABASE_URL` (or `DIRECT_URL`)
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Optional but recommended:

- `OPENAI_API_KEY` (required for optimize flows)
- `NEXT_PUBLIC_APP_URL` (invite/export URLs)

3. Apply Prisma schema and seed:

```bash
pnpm prisma generate
pnpm prisma migrate deploy
pnpm db:seed
```

4. Run dev server:

```bash
pnpm dev
```

## Quality Checks

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

## Production Notes

- API routes are tenant-scoped via org membership checks.
- Prompt optimize requests are rate-limited and audited.
- Compliance exports and prompt exports require authenticated org access.
