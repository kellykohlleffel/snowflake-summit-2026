# Instructor Fivetran Laptop Setup Guide — Snowflake Summit 2026 HOL (labuser7)

For the 6 lab instructors (Mario Amaya, James Render, Jason Chletsos, David Hrncir, David Millman, Kelly Kohlleffel) configuring their own Fivetran-issued laptop as `labuser7` for Summit 2026 HOL dry runs and booth support.

**Different audience** from [docs/lab-laptop-setup-guide.md](lab-laptop-setup-guide.md) (which covers the 6 bare dedicated lab laptops that Kelly sets up pre-booth).

---

## What to expect

Your Fivetran laptop already has most of the required tooling (Node, Python, VS Code, Cortex Code CLI, `gh`). setup.sh will skip what's already installed, install what's missing via native Apple-signed installers — no Homebrew required.

**Safe-merge semantics:** setup.sh does NOT clobber your existing dev state. Your Anthropic API key, personal Snowflake connections, dbt RSA key paths, custom VS Code themes, and existing MCP server registrations are all preserved. See the [Preservation guarantee](#preservation-guarantee) section below for specifics.

**Target time:** ~5 minutes on a well-equipped Fivetran laptop.

---

## Step 0 — Clone the repo

```bash
mkdir -p ~/Documents/GitHub && cd ~/Documents/GitHub
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026
```

The repo is public — no auth needed for the clone.

---

## Step 1 — Get `labuser7.env` from 1Password

Your labuser7 credentials are an attachment on the shared 1Password vault item.

**In the 1Password desktop app:**
1. Search for the item **"Snowflake Summit and BDL 2026 Lab Users"** (or find it in the shared Fivetran vault you have access to).
2. Scroll to the **"Lab User 7 (instructor)"** section. You'll see:
   - A text block titled `labuser7.env — Summit 2026 HOL instructor credentials` explaining what to do
   - A file attachment labeled **`labuser7.env`** (blue file icon)
3. **Right-click the attachment → Download** (or drag it to Finder).

**On your laptop** (from inside the repo directory):
```bash
mv ~/Downloads/labuser7.env setup/creds/labuser7.env
chmod 600 setup/creds/labuser7.env
head -3 setup/creds/labuser7.env
```

Expected: the file starts with `# Labuser 7 credentials — generated ...` (comment header).

If your browser downloaded the file somewhere other than `~/Downloads/` (or if you dragged it directly to a different folder), adjust the `mv` source path accordingly.

---

## Step 2 — Dry-run preview (recommended)

```bash
./setup.sh 7 --dry-run
```

Expected output: prereq status table shows `[READY]` for everything you have installed, `[DRY_RUN]` for anything missing. Script short-circuits after the GitHub-auth check with `DRY RUN complete — no changes made to this laptop.` Zero writes, zero disruption.

If the prereq table looks right, proceed to Step 3.

---

## Step 3 — Real run

```bash
./setup.sh 7
```

**During the run you'll see:**
- Step 0: Xcode CLT verified
- Step 1: Prereqs walkthrough — installs anything missing (usually nothing)
- Step 2: GitHub auth — may prompt `gh auth login` if not already authenticated
- Steps 3–9: npm cache, Cortex Code extension build, Fivetran Code MCP build, Python venv + dbt install, skill copy, config writes
- Step 10: **Lab-mode cred safe-merge** — look for messages like `[OK] Safe-merged lab creds into ~/.fivetran-code/config.json (preserved: anthropicApiKey, anthropicApiKeys, fivetranApiKeys)`
- `verify.sh` auto-runs at the end (5 smoke tests)

**Backups happen automatically** at `~/.summit-hol-backups/{timestamp}-labuser7/` BEFORE any writes to config.json, connections.toml, or se-demo/.env.

---

## Preservation guarantee

setup.sh safe-merges into 3 files. Here's exactly what gets touched vs. preserved:

### `~/.fivetran-code/config.json`
| Key | Behavior |
|---|---|
| `fivetranApiKey` | **Overwritten** with labuser7's scoped Fivetran API key |
| `fivetranApiSecret` | **Overwritten** |
| `snowflakeAccount` | **Overwritten** with `aa67604.us-central1.gcp.snowflakecomputing.com` |
| `snowflakePatToken` | **Overwritten** with labuser7's PAT |
| `anthropicApiKey` | ✅ Preserved |
| `anthropicApiKeys[]` (array of saved keys) | ✅ Preserved |
| `fivetranApiKeys[]` (array of saved keys) | ✅ Preserved |
| Any other custom keys | ✅ Preserved |

**After setup.sh runs, your Cortex Code sidebar will authenticate as `labuser7` against the `aa67604` account.** To switch back to your dev account, use the extension's key-switcher UI (your dev Fivetran+Snowflake values remain in `fivetranApiKeys[]` array) — or restore from the backup.

### `~/.snowflake/connections.toml`
| Content | Behavior |
|---|---|
| Existing `default_connection_name` | ✅ Preserved (if set to something else, your choice wins) |
| Your existing `[sections]` (dev, prod, etc.) | ✅ Preserved byte-identical |
| `[summit-lab]` section | **Added** (or updated if it already exists) |

Your `cortex` CLI / `snow` CLI / `dbt` commands still default to your existing connection. The HOL flow calls labuser7 explicitly via env vars, not via `default_connection_name`.

### `mcp-servers/se-demo/.env`
| Keys | Behavior |
|---|---|
| 24 lab-mode keys (`SNOWFLAKE_*`, `FIVETRAN_*`, `PG_HOL_*`, `DBT_*`, etc.) | **Set/updated** |
| `SNOWFLAKE_PRIVATE_KEY_PATH` (dbt RSA key) | ✅ Preserved if present |
| `ANTHROPIC_API_KEY`, `CUSTOM_*`, any other custom keys | ✅ Preserved |
| Comments and blank lines | ✅ Preserved |

### `~/.snowflake/cortex/mcp.json`
If you already have `fivetran-code` and `se-demo` MCP entries (even pointing to your dev paths), setup.sh **skips writing** this file. You keep your dev MCP wiring.

**Consequence for the HOL flow:** the Cortex Code sidebar will call your DEV MCP servers, not the summit repo's MCP servers. See [Making the HOL flow work in Cortex Code](#making-the-hol-flow-work-in-cortex-code) below.

### VS Code user settings (`~/Library/Application Support/Code/User/settings.json`)
Safe-merged — only adds `update.mode: "none"` and `extensions.autoUpdate: false` if they're absent. Never touches your themes, keybindings, or other settings.

### Malformed existing files
If `config.json` or any other merge target is malformed (invalid JSON/TOML), setup.sh logs a `[WARN]` and leaves the file untouched. Fix manually (or restore from an earlier backup), then re-run setup.sh.

---

## Step 4 — Smoke test in VS Code

```bash
code .
```

1. **Reload VS Code window:** `Cmd+Shift+P` → `Developer: Reload Window`
2. **Open Cortex Code sidebar:** click the Snowflake icon in the activity bar
3. **Test Fivetran MCP:** type `list my groups` → expect `blown_dismiss` (labuser7's Fivetran destination group)
4. **Launch the HOL skill:** type `/fivetran-snowflake-hol-sfsummit2026-v2` → the skill loads and shows the 20-minute HOL roadmap

If all 4 pass, your instructor laptop is ready for HOL dry runs.

---

## Making the HOL flow work in Cortex Code

If Step 4.3 (`list my groups`) returns results from your DEV Fivetran account instead of labuser7, it's because your `~/.snowflake/cortex/mcp.json` still points at your dev MCP server paths. setup.sh intentionally doesn't overwrite your mcp.json to avoid breaking your dev flow.

**Three ways to switch:**

**A. mcp-cloud / toggle-mcp-servers-app-v2 (Kelly's approach):**
If you use mcp-cloud to manage MCP servers, create a "Summit HOL" preset with:
- `fivetran-code` pointing to `~/Documents/GitHub/snowflake-summit-2026/fivetran-code/dist/mcp-server.js`
- `se-demo` pointing to `~/Documents/GitHub/snowflake-summit-2026/mcp-servers/se-demo/run_server.py`
Toggle this preset when doing HOL work.

**B. Manual one-time swap:**
```bash
cp ~/.snowflake/cortex/mcp.json ~/.snowflake/cortex/mcp.json.devbackup
# Edit mcp.json so fivetran-code and se-demo point at the snowflake-summit-2026 repo paths
# Reload VS Code
```
Restore from `.devbackup` when you're done with HOL work.

**C. Let setup.sh create a fresh mcp.json:**
```bash
mv ~/.snowflake/cortex/mcp.json ~/.snowflake/cortex/mcp.json.devbackup
./setup.sh 7    # now creates mcp.json with summit paths
# Reload VS Code
```
Restore from `.devbackup` when done.

---

## Rollback

If any merge goes sideways, backups are in `~/.summit-hol-backups/{timestamp}-labuser7/`:

```bash
TIMESTAMP=$(ls -t ~/.summit-hol-backups/ | grep labuser7 | head -1)
echo "Restoring from $TIMESTAMP"
cp ~/.summit-hol-backups/$TIMESTAMP/config.json      ~/.fivetran-code/config.json
cp ~/.summit-hol-backups/$TIMESTAMP/connections.toml ~/.snowflake/connections.toml
cp ~/.summit-hol-backups/$TIMESTAMP/.env             mcp-servers/se-demo/.env 2>/dev/null || true
```

---

## Switching back to dev mode after the HOL

After your dry run or booth shift:

1. **Cortex Code auth** — use the extension's key-switcher UI to flip `fivetranApiKey`, `snowflakeAccount`, `snowflakePatToken` back to your dev values. The saved entries live in `fivetranApiKeys[]` and `anthropicApiKeys[]` arrays (preserved across setup.sh runs).
2. **Snowflake CLI** — `default_connection_name` in `connections.toml` was preserved; your dev connection is still the default. No action needed.
3. **MCP servers** — if you swapped mcp.json for the HOL flow, restore from `.devbackup` (see option B/C above).
4. **dbt** — your `SNOWFLAKE_PRIVATE_KEY_PATH` was preserved in se-demo/.env; any dev dbt profile should still work.

---

## Reference

- `setup.sh` source: [../setup.sh](../setup.sh)
- Lab-laptop flow (for bare dedicated laptops, Kelly's responsibility): [lab-laptop-setup-guide.md](lab-laptop-setup-guide.md)
- Approved plan context: see your copy of `.claude/plans/i-want-to-go-drifting-bumblebee.md`
