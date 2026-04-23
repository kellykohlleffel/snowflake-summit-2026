# Lab Laptop Setup Guide — Snowflake Summit 2026 HOL

Step-by-step walkthrough for bringing a bare Mac up as one of the 7 Summit lab laptops (labuser1–6 = attendee stations, labuser7 = instructor station).

**Audience:** whoever is physically sitting at the lab laptop — Kelly, David Hrncir, or any of the other SEs covering booth duty. Works on both bare lab laptops and SE personal Macs that need to become labuser7 instructor stations.

**Target time:** ~10 minutes on a bare Mac from clone to `Session is GO`.

---

## Where to get setup.sh

The script lives in this repo. Two ways to pull it:

**Option A — clone the whole repo (required for a real run).** setup.sh doesn't work standalone; it needs the vendored extensions, MCP servers, skill files, and dbt project that live alongside it.

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
```

**Option B — preview setup.sh in isolation (read-only).** Useful if you want to eyeball what's about to run before committing to the clone:

```bash
curl -o /tmp/setup.sh https://raw.githubusercontent.com/kellykohlleffel/snowflake-summit-2026/main/setup.sh
less /tmp/setup.sh
```

---

## Prerequisites

- A Mac (macOS 14+ recommended). Anything else the lab needs is auto-installed by setup.sh.
- Sudo password for the logged-in user (setup.sh will prompt 3–4 times for `sudo installer`).
- The per-laptop credential file `labuser{N}.env` already generated on Kelly's laptop (staged in Step 4 below).
- Network access to download installer packages (Node ~45MB, Python ~45MB, VS Code ~130MB, gh ~10MB).

---

## Step 0 — Log in

Use the shared lab-laptop password (1Password: `shared-lab-creds` → `lab_laptop_password`).

---

## Step 1 — Open Terminal

`Cmd+Space` → type `terminal` → Enter.

---

## Step 2 — Trigger Xcode Command Line Tools (brings `git`)

```bash
git --version
```

If Xcode CLT isn't installed, macOS will pop up an install dialog. Click **Install** and wait ~5 minutes for it to complete. Git comes with Xcode CLT — no separate install needed.

If git is already on the laptop from a prior setup, this command just prints the version and you can continue.

---

## Step 3 — Clone the repo

```bash
mkdir -p ~/Documents/GitHub && cd ~/Documents/GitHub
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026
```

The repo is public — no GitHub auth needed for the clone itself. (setup.sh will handle `gh auth login` later.)

---

## Step 4 — Stage the per-laptop credential file

`setup.sh <N>` reads `setup/creds/labuser{N}.env`. These files are **not committed** (gitignored) and must be copied from Kelly's laptop to each lab laptop before setup.

### From Kelly's laptop (run this once per lab laptop):

```bash
scp /Users/kelly.kohlleffel/Documents/GitHub/snowflake-summit-2026/setup/creds/labuser1.env \
    <lab-laptop-user>@<lab-laptop-hostname>.local:~/Documents/GitHub/snowflake-summit-2026/setup/creds/labuser1.env
```

Replace `labuser1.env` with `labuser2.env`, `labuser3.env`, etc. for the other lab laptops (up to `labuser7.env` for the instructor station).

If scp/networking isn't convenient, USB-copy the file onto the lab laptop and drop it into `setup/creds/`.

### On the lab laptop — tighten permissions:

```bash
chmod 600 setup/creds/labuser1.env
ls -la setup/creds/labuser1.env
```

Expected: `-rw-------  1 <user>  staff  ...  labuser1.env`

---

## Step 5 — Dry-run preview (recommended)

Preview exactly what setup.sh is about to install without any state changes:

```bash
./setup.sh 1 --dry-run
```

Expected output: each missing prereq shows `[DRY_RUN] would install ...` with the exact `curl` / `sudo installer` commands. Script short-circuits after Step 2 with `DRY RUN complete -- no changes made to this laptop.`

Read through, confirm nothing looks surprising, then continue.

---

## Step 6 — Real run

```bash
./setup.sh 1
```

(Substitute your lab laptop's number: 1–6 for attendee stations, 7 for instructor.)

### What to expect on a bare Mac (~10 min total)

| Time | Step | What's happening | Expect |
|---|---|---|---|
| 0:00 | Step 0 | Xcode CLT verified | `[OK] Xcode Command Line Tools installed` |
| 0:00 | Step 1 | Prereq walkthrough begins | 3–4 `sudo` password prompts total |
| 0:30 | Step 1 | Node .pkg downloads + installs | `[INSTALLED] Node v20.11.x` |
| 1:00 | Step 1 | Python 3.12 .pkg downloads + installs | `[INSTALLED] Python 3.12.2` |
| 1:30 | Step 1 | VS Code .zip (~130MB) — slowest step | `[INSTALLED] VS Code 1.X.Y (symlinked code CLI)` |
| 3:30 | Step 1 | Cortex Code CLI via `curl \| sh` | `[INSTALLED] Cortex Code v1.0.x` |
| 3:45 | Step 1 | gh .pkg installs | `[INSTALLED] GitHub CLI v2.67.0` |
| 4:00 | Step 1 | VS Code settings safe-merge | `[OK] Merged auto-update keys into .../settings.json` |
| 4:00 | Summary | Prereqs status table prints | `Session is GO -- 6/6 prerequisites ready.` |
| 4:00 | Step 2 | GitHub auth | Prompts `gh auth login` — complete the browser flow |
| 5:00 | Steps 3–4 | npm cache + Cortex Code extension build | `Cortex Code VSCode extension installed` |
| 6:30 | Step 5 | Fivetran Code MCP build | `Fivetran Code MCP server built successfully` |
| 7:00 | Step 6 | SE Demo Python venv + dbt install | `SE Demo MCP Server ready` |
| 8:00 | Step 7 | HOL skill copied to ~/.claude/skills/ | `HOL skill installed` |
| 8:00 | Step 8 | Credentials config + backups | Writes 3 config files, backups to `~/.summit-hol-backups/` |
| 8:30 | Step 9 | MCP registration in ~/.snowflake/cortex/mcp.json | `Cortex MCP config created` |
| 9:00 | Step 10 | Lab-mode cred population | Reads labuser{N}.env, resolves identity, writes lab configs |
| 9:30 | verify.sh | 5-check smoke test auto-runs | **Must show 5/5 green** |

### Expected output at the end

```
=========================================
  All checks passed — lab laptop is ready.
=========================================

=========================================
  Setup Complete
=========================================
```

If you see anything other than `All checks passed`, stop and capture the output (see troubleshooting below).

---

## Step 7 — Smoke test in VS Code

```bash
code .
```

From the `snowflake-summit-2026` directory, VS Code opens with the repo loaded.

In VS Code:

1. **Reload window:** `Cmd+Shift+P` → `Developer: Reload Window`. (First time only — picks up the newly-installed extension.)
2. **Open Cortex Code sidebar:** click the **Snowflake icon** in the activity bar (left edge).
3. **Test Fivetran MCP:** in the Cortex Code chat, type:
   ```
   list my groups
   ```
   Expected: returns your labuser's destination group (e.g., `surveillance_affectionately` for labuser1, `syntactic_unexpected` for labuser2, etc.).
4. **Launch the HOL skill:**
   ```
   /fivetran-snowflake-hol-sfsummit2026-v2
   ```
   Expected: the skill loads, shows the 20-minute HOL roadmap, and asks you to pick an industry.
5. **Pick any industry** (e.g., `pharma`) and walk through Steps 1–3 (connector creation + sync). If the connector gets created and the sync completes, the full Fivetran-to-Snowflake leg is working.

If all 5 of those pass, the laptop is green and you can hand it off to an attendee or move on to the next lab laptop.

---

## Troubleshooting

### Xcode CLT dialog is still open / install pending
Wait for the install to finish, close the dialog, then re-run `./setup.sh 1`. setup.sh is idempotent — it'll skip everything already done.

### VS Code .zip download times out on venue Wi-Fi
Re-run `./setup.sh 1`. The 130MB download is the single biggest network request; slow Wi-Fi is a common cause of timeouts. Second attempt usually gets further.

### `Session is GO` but verify.sh reports a failure

| verify.sh check | Likely cause | Fix |
|---|---|---|
| Env vars empty | `labuser{N}.env` wasn't staged correctly | Re-stage from Kelly's laptop, confirm `chmod 600`, re-run setup.sh |
| Snowflake PAT auth fails | PAT expired, wrong role, or Snowflake network policy blocks the lab laptop's venue IP | Regenerate PAT (see `docs/pat-generation.sql` when it lands) OR add venue IP to account's network policy |
| Fivetran group access fails | Scoped API key doesn't resolve to the labuser's destination group | Check the key value in `setup/creds/labuser{N}.env` is base64-encoded `key:secret` blob |
| `dbt debug` fails | Usually cascades from the Snowflake auth failure above | Fix the PAT issue first |
| MCP servers not registered | `~/.snowflake/cortex/mcp.json` wasn't written | Re-run setup.sh Step 9 didn't complete — check for an earlier error |

### Cortex Code extension doesn't load in VS Code
```bash
code --list-extensions | grep cortex
```

If empty, force-install from the built VSIX:
```bash
code --install-extension cortex-code/cortex-code-for-vscode-*.vsix --force
```
Then reload the VS Code window.

### `list my groups` returns a different labuser's group
The `labuser{N}.env` file staged on this laptop is the wrong one. Check `mcp-servers/se-demo/.env` — the `FIVETRAN_GROUP_ID` line should match the expected group for this labuser:

| Labuser | Fivetran group_id |
|---|---|
| 1 | `surveillance_affectionately` |
| 2 | `syntactic_unexpected` |
| 3 | `really_woof` |
| 4 | `gibberish_wither` |
| 5 | `victory_rebirth` |
| 6 | `reasonable_religion` |
| 7 | `blown_dismiss` |

If it doesn't match, re-stage the correct `labuser{N}.env` and re-run setup.sh.

### Something else broke
Capture the exact step + output that failed and bring it back. Most failure modes above are known; everything else is new territory worth iterating on.

---

## Reference

- setup.sh source: [../setup.sh](../setup.sh)
- verify.sh source: [../setup/verify.sh](../setup/verify.sh)
- Credential file format: [../setup/creds/README.md](../setup/creds/README.md)
- HOL skill: [../skills/fivetran-snowflake-hol-sfsummit2026-v2/SKILL.md](../skills/fivetran-snowflake-hol-sfsummit2026-v2/SKILL.md)
