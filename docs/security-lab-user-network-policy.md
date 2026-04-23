# Lab-User Network Policy — Security Design Notes

**Audience:** Fivetran security team, and any future PSE reviewing what was done for the Snowflake Summit 2026 HOL.
**Owner:** Kelly Kohlleffel (Partner Solutions Engineering).
**Last updated:** 2026-04-23.

---

## TL;DR

Seven Snowflake users (`SF_LABUSER1_USER` … `SF_LABUSER7_USER`) on the `aa67604.us-central1.gcp` lab account each have a dedicated permissive network policy (`HOL_LAB_USERS_OPEN`, `ALLOWED_IP_LIST = ('0.0.0.0/0')`) attached. This is intentional and scoped. IP-based allowlisting is not a workable control for public-venue lab laptops where attendee/booth IPs are unknowable in advance. The actual security boundary is enforced by three narrower controls described below.

---

## Use case context

The Snowflake Summit 2026 Hands-on Lab (HOL) runs in a conference booth environment. The setup consists of:

- **6 dedicated booth laptops** (attendee-facing), configured with `SF_LABUSER1_USER` through `SF_LABUSER6_USER`.
- **6 instructor Fivetran laptops** (all configured as `SF_LABUSER7_USER`), used by the 6 PSEs covering booth shifts for dry-run rehearsals and live attendee support.
- The laptops connect to Snowflake over **venue-provided Wi-Fi** (Moscone, Big Data London, DAIS venues, etc.). Venue WAN egress IPs change per venue, are not disclosed to presenters in advance, and can shift day-to-day even within a single venue.

Because of that, an IP-allowlist-based network policy would either:
- Block all lab connectivity (unknown venue IP), or
- Be set to `0.0.0.0/0` anyway (no security benefit), or
- Need to be updated ad-hoc at the venue (operationally brittle under event timing pressure).

---

## What was created

All statements run as `ACCOUNTADMIN` in the `aa67604.us-central1.gcp` lab account:

```sql
USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE NETWORK POLICY HOL_LAB_USERS_OPEN
  ALLOWED_IP_LIST = ('0.0.0.0/0')
  COMMENT = 'Summit 2026 HOL lab users - permit any IP. PAT + role-restriction enforce access. Do not apply to non-lab users.';

ALTER USER SF_LABUSER1_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER2_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER3_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER4_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER5_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER6_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
ALTER USER SF_LABUSER7_USER SET NETWORK_POLICY = HOL_LAB_USERS_OPEN;
```

User-level network policies **override** the account-level policy for these 7 users only. No other Snowflake users in the `aa67604` account are affected; the existing account-level network policy continues to apply to everything else.

---

## Why this is an acceptable design

### Actual security boundary = PAT + role-restriction + DB scope

Each labuser authenticates via a Programmatic Access Token (PAT), not a password. Each PAT carries three independent constraints:

| Control | How it's enforced | What it limits |
|---|---|---|
| **1. PAT token validity** | Snowflake PAT auth; `DAYS_TO_EXPIRY = 360` on creation | Only the single 360-day bearer token works. No username/password can connect as a labuser. |
| **2. PAT `ROLE_RESTRICTION`** | PAT was issued with `ROLE_RESTRICTION = 'sf_labuser{N}_role'` (one token per user) | The token can only assume that single role. Cannot `USE ROLE ACCOUNTADMIN` or any other role. |
| **3. Role-scoped grants** | `sf_labuser{N}_role` has privileges only on `SF_LABUSER{N}_DB` and the shared `SF_LAB_WH` warehouse | Cross-labuser access is blocked regardless of IP. Labuser1 cannot see Labuser3's schemas, data, or connectors. |
| **4. No admin keys on lab laptops** | setup.sh never provisions `ACCOUNTADMIN` or account-level API keys to any lab laptop | A compromised laptop cannot pivot to admin-level actions. |
| **5. PAT expiration** | 360-day `DAYS_TO_EXPIRY`; can be revoked at any time via `ALTER USER ... REMOVE PROGRAMMATIC ACCESS TOKEN` | Leaked tokens are time-bound and revocable. |

An attacker in possession of a labuser PAT can execute only the HOL-intended operations in that labuser's scoped database. They cannot read other labusers' data, cannot escalate role, cannot access non-lab Snowflake resources on the account, and cannot assume ACCOUNTADMIN privileges.

### Why IP allowlisting doesn't help here

Network policies are a defense-in-depth layer — a *second* check after authentication. They shine when:
- The set of legitimate source IPs is knowable and stable (e.g., a corporate office egress, a VPN concentrator).
- Authentication credentials might leak (IP restriction limits where a leaked credential can be used).

Neither applies here:
- **Source IPs are not stable.** The 7 lab laptops connect from conference venue Wi-Fi. Venue egress IPs are not published, change per venue (Summit in San Francisco, DAIS in SF or elsewhere, BDL in London), and can change within a venue day-to-day.
- **Credential leakage** is bounded by the controls above: a leaked PAT only grants labuser-scoped access. Tightening the IP on top would not meaningfully reduce the blast radius.

In short: adding `0.0.0.0/0` does not make these users *less* secure than they otherwise would be, because a restrictive IP list was never viable for this use case.

---

## Blast radius analysis

Worst-case scenario: an attacker obtains a labuser PAT (e.g., a lab laptop is stolen, or someone screenshots `setup/creds/labuserN.env`).

**What the attacker can do:**
- Connect to `aa67604.us-central1.gcp` as `SF_LABUSER{N}_USER`.
- Assume `sf_labuser{N}_role`.
- Execute SQL against `SF_LABUSER{N}_DB` using `SF_LAB_WH` warehouse compute.
- Read/write/drop schemas and data within that one database.
- Modify the Fivetran destination group scoped to that labuser (delete connectors, trigger syncs).

**What the attacker cannot do:**
- Access any other labuser's database, data, or Fivetran destination (role-scoped).
- Access any other user's data in the `aa67604` account (role-scoped).
- Assume `ACCOUNTADMIN` or any non-labuser role (PAT `ROLE_RESTRICTION`).
- Generate new PATs, alter users, or modify account-level settings (not granted to labuser roles).
- Access Fivetran account-level resources (setup.sh only installs the per-labuser scoped Fivetran API key, not an admin key).
- Pivot laterally into Fivetran's internal infrastructure or any other Snowflake account.

**Data sensitivity:** the content under each `SF_LABUSER{N}_DB` is HOL demonstration data — synthetic records across 7 industries (pharma, retail, financial, agriculture, etc.), ~750 rows per industry, generated specifically for the hands-on lab. It is not production data, not customer data, not employee data, and has no regulated content (no PII, PHI, PCI).

**Remediation if a PAT is compromised:**
```sql
USE ROLE ACCOUNTADMIN;
ALTER USER SF_LABUSER{N}_USER REMOVE PROGRAMMATIC ACCESS TOKEN hol_2026_pat;
-- Optionally issue a new one:
ALTER USER SF_LABUSER{N}_USER ADD PROGRAMMATIC ACCESS TOKEN hol_2026_pat
  ROLE_RESTRICTION = 'sf_labuser{N}_role'
  DAYS_TO_EXPIRY = 360;
```

---

## Alternative considered: CIDR-allowlisted policy

We evaluated a more restrictive policy that would list specific venue egress CIDRs (Moscone, BDL, etc.) and rejected it for these reasons:

1. **Venue IPs are not disclosed in advance** by event organizers. You find out at the event.
2. **Event-time updates are brittle.** Updating `ALLOWED_IP_LIST` mid-event requires someone with `ACCOUNTADMIN` access to the lab Snowflake account, a laptop with connectivity (ironic — they're on the same venue Wi-Fi the policy would block), and confidence they have the right IPs. This fails during the 5-minute booth-setup window.
3. **CIDR lists drift fast.** Even a stable venue can fail over its NAT egress between days, or between halls/rooms. Debugging "my PAT worked yesterday and doesn't today" during a conference is not a defensible operational burden.
4. **The venue Wi-Fi is inherently multi-tenant.** Even a correct CIDR allowlist wouldn't isolate Summit attendees from other conference visitors using the same public Wi-Fi. IP allowlisting in that context is cosmetic, not substantive.

If organizational policy requires a CIDR allowlist anyway, it would be applied via `ALTER NETWORK POLICY HOL_LAB_USERS_OPEN SET ALLOWED_IP_LIST = (<CIDRs>)` — one location, no code changes.

---

## Post-event decommissioning

After Summit 2026 (and the subsequent DAIS 2026 and BDL 2026 events reusing the same infrastructure), the policy and attachments can be removed:

```sql
USE ROLE ACCOUNTADMIN;

-- Detach from each labuser
ALTER USER SF_LABUSER1_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER2_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER3_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER4_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER5_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER6_USER UNSET NETWORK_POLICY;
ALTER USER SF_LABUSER7_USER UNSET NETWORK_POLICY;

-- Drop the policy itself
DROP NETWORK POLICY HOL_LAB_USERS_OPEN;

-- Optionally revoke the PATs as well
ALTER USER SF_LABUSER1_USER REMOVE PROGRAMMATIC ACCESS TOKEN hol_2026_pat;
-- ... repeat for 2-7
```

Or leave the policy and PATs in place if additional HOL events are planned within the 360-day PAT validity window. Everything here is additive to the existing account-level network policy (which continues to apply to non-lab users); nothing needs to be undone on the account level.

---

## References

- Snowflake Network Policies: https://docs.snowflake.com/en/user-guide/network-policies
- Snowflake Programmatic Access Tokens: https://docs.snowflake.com/en/user-guide/programmatic-access-tokens
- Repo setup.sh (how lab laptops get provisioned): [../setup.sh](../setup.sh)
- Repo verify.sh (how lab-laptop PAT auth is tested): [../setup/verify.sh](../setup/verify.sh)
- Lab-user credential file format (what's on each lab laptop): [../setup/creds/README.md](../setup/creds/README.md)
