# PR-A: Regulatory Sources Foundation

## Pre-Merge Checklist

**Alex must complete these steps BEFORE merging:**

1. Run the export script against production:
   ```bash
   ./scripts/pre-pra-export.sh
   ```
   This creates `docs/legacy-data/[timestamp]-pre-pra-export.json` containing all data from the 5 tables being dropped.

2. Commit and push the JSON export to this branch.

3. Then merge the PR.

## Post-Merge Steps

After merge + Vercel deploy:
- Vercel runs `prisma migrate deploy` automatically (drops 14 tables, creates regulatory_sources)
- Run locally: `npm run seed:regulatory` to populate 220+ regulatory source rows
- Visit `/ops/registry` to verify the data loaded correctly

## What This PR Does

- Drops 14 legacy/orphan tables (6 legacy_mission_*, 4 ops_*, compliance_tasks, 3 task_evidence_*)
- Drops 8 obsolete enums
- Creates `regulatory_sources` table with 3 new enums (SourceTier, RefreshCadence, PracticeArea)
- Adds seed data, seed script, API endpoint, and UI page
