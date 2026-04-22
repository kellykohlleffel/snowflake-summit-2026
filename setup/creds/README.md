# Lab-laptop credential files (not committed)

`setup.sh <1-7>` reads `setup/creds/labuser{N}.env` to populate each lab
laptop's configuration at install time. This directory's contents are
**gitignored** — credentials must never be committed.

## How the files get here

Kelly generates all 7 files **once** on his own laptop from the credentials
stored in the "Snowflake Summit and BDL 2026 Lab Users" item in Fivetran
1Password. Files are then distributed to each lab laptop via scp (or USB
during on-site booth setup) before the first run of `./setup.sh` on that
laptop.

## File format

Each file is a sourced bash `.env` with these required variables:

```
SNOWFLAKE_ACCOUNT=aa67604.us-central1.gcp.snowflakecomputing.com
SNOWFLAKE_WAREHOUSE=SF_LAB_WH
SNOWFLAKE_PAT=<the-labuser-N-programmatic-access-token>
FIVETRAN_KEY_B64=<base64 "api_key:api_secret" for this labuser>
FIVETRAN_GROUP_ID=<per-user fivetran destination group id>
PG_HOL_PASSWORD=<shared PostgreSQL source password>
```

Optional overrides (otherwise defaults are used):

```
PG_HOL_HOST=34.94.122.157
PG_HOL_PORT=5432
PG_HOL_DATABASE=industry-se-demo
PG_HOL_USER=fivetran
```

The setup.sh lab-mode block derives the rest per-labuser:
- `SF_LABUSER{N}_USER` (Snowflake user)
- `SF_LABUSER{N}_ROLE` (scoped Snowflake role)
- `SF_LABUSER{N}_DB` (labuser-specific database)
- `laptop{N}` (LAPTOP_ID for activation-app namespacing)
- `HOL_INSTRUCTOR=true` if N=7

## Security posture

- File mode is tightened to 0600 on source (owner-read/write only)
- Never logged — bash `set -a` loads them into env without echoing
- On teardown (DAIS handoff), delete the file: `rm -f setup/creds/labuser*.env`
- Rotate the underlying credentials at the same cadence you would with any
  other cred store (DAYS_TO_EXPIRY on Snowflake PATs, Fivetran key rotation)

## Per-laptop group IDs (reference — these are stable)

| Labuser | Fivetran group_id | Snowflake DB |
|---|---|---|
| 1 | surveillance_affectionately | SF_LABUSER1_DB |
| 2 | syntactic_unexpected | SF_LABUSER2_DB |
| 3 | really_woof | SF_LABUSER3_DB |
| 4 | gibberish_wither | SF_LABUSER4_DB |
| 5 | victory_rebirth | SF_LABUSER5_DB |
| 6 | reasonable_religion | SF_LABUSER6_DB |
| 7 | blown_dismiss | SF_LABUSER7_DB |
