# Migration archive

Historical migrations, superseded by the single baseline at
`prisma/migrations/00000000000000_init/migration.sql`.

Nothing in this directory is ever executed. Prisma only looks at
`prisma/migrations` (pinned via `migrations.path` in `api/prisma.config.ts`),
so these files are kept purely as a record of how the schema evolved.

## What's here

- **79 timestamped migration folders** — the incremental history from
  January 2026 through the Time Clock module in April 2026.
- **15 `manual_*.sql` files** — hand-written SQL that was applied directly to
  the database and never recorded in `_prisma_migrations`. Because they were
  loose files rather than timestamped folders, `prisma migrate deploy` always
  skipped them, which is why a fresh clone silently ended up missing voice AI,
  calendar integration, SMS templating/scheduling/opt-out, multi-level IVR, and
  background jobs. The baseline now includes all of it.

## Reference data

Several of these migrations also carried `INSERT`/`UPDATE` statements. The rows
a fresh install genuinely needs were moved into idempotent seed scripts under
`prisma/seeds/` and are run by `npm run seed:all`:

| Data | Now owned by |
| --- | --- |
| Industry list | `industry.seed.ts` |
| Communication provider catalog | `communication-provider.seed.ts` |
| Feature flags, maintenance mode, platform settings | `platform-defaults.seed.ts` |
| Financial categories | `financial-categories.seed.ts` (per tenant, `npm run seed:tenant`) |

The remaining statements were one-off backfills against rows that existed at the
time — renaming call types, populating `tenant_id` on legacy quote addresses,
recomputing approval workflow ids. They are meaningless on an empty database and
were deliberately not carried forward.

## Restoring context

To see what a specific migration did:

```bash
cat prisma/migrations-archive/20260311_unified_call_logging/migration.sql
```

To rebuild the database, do **not** use these files — use:

```bash
npx prisma migrate deploy   # applies 00000000000000_init
npm run seed:all
```
