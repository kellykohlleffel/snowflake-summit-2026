# Fivetran Code — Quick Start (5 minutes)

## What You Need

1. **VS Code** (1.96+)
2. **Fivetran API credentials** — get from [Fivetran Settings > API Key](https://fivetran.com/account/settings)
3. **Claude API access** — see below

### Claude Authentication Options

Fivetran Code needs access to the Claude API. Which option you use depends on your Anthropic subscription:

| Plan | Price | What to do |
|------|-------|-----------|
| **No subscription / Claude Pro ($20)** | $5+ one-time | Go to [console.anthropic.com](https://console.anthropic.com), add $5 in prepaid API credits, create an API key. Claude Pro is for claude.ai only — it does NOT include API access. $5 goes a long way with Sonnet 4.6 (~$3/M input tokens). |
| **Claude Max ($100-200/mo)** | Included | Run `claude setup-token` in your terminal to get an OAuth token. This uses your Max subscription — no separate API credits needed. |

## Install

### Clone & Setup
```bash
git clone https://github.com/kellykohlleffel/fivetran-cli.git
cd fivetran-cli
npm install
npm run build
```

### VS Code Extension
```bash
npx @vscode/vsce package --no-dependencies
code --install-extension fivetran-code-0.2.0.vsix
```
Reload VS Code (`Cmd+Shift+P` > "Developer: Reload Window").

### Terminal CLI (optional)
```bash
sudo npm link
fivetran          # run from any directory
```

## Configure

Create the config file (pick the template that matches your auth method):

**API Key (Claude Pro or no subscription):**
```bash
mkdir -p ~/.fivetran-code
cat > ~/.fivetran-code/config.json << 'EOF'
{
  "fivetranApiKey": "YOUR_FIVETRAN_API_KEY",
  "fivetranApiSecret": "YOUR_FIVETRAN_API_SECRET",
  "anthropicApiKey": "YOUR_ANTHROPIC_API_KEY"
}
EOF
chmod 600 ~/.fivetran-code/config.json
```

**OAuth Token (Claude Max $100-200/mo):**
```bash
mkdir -p ~/.fivetran-code
cat > ~/.fivetran-code/config.json << 'EOF'
{
  "fivetranApiKey": "YOUR_FIVETRAN_API_KEY",
  "fivetranApiSecret": "YOUR_FIVETRAN_API_SECRET",
  "anthropicAuthToken": "YOUR_TOKEN_FROM_claude_setup-token"
}
EOF
chmod 600 ~/.fivetran-code/config.json
```

Replace the placeholder values with your actual credentials. Run `/account` after setup to verify your auth method.

## Use

1. Click the **Fivetran icon** in the VS Code activity bar (left sidebar)
2. The Fivetran Code chat panel opens
3. Type a question like: **"Which connectors are broken?"**
4. Type `/` to see all available commands and skills

## What You Can Do

- **Ask about connectors** — "Show me my Salesforce connector status"
- **Trigger syncs** — "Sync the HubSpot connector" (asks for confirmation)
- **Manage pipelines** — "Pause the test connector"
- **Build connectors** — `/fivetran-connector-builder` to create custom connectors
- **Attach files** — Click the paperclip to attach screenshots, SQL files, JSON responses
- **Switch models** — `/switch model` to change between Sonnet, Opus, Haiku
- **Compact mode** — `/compact` to toggle concise responses (less formatting, no suggestions)
- **Voice input** — Click the mic icon or `/voice` for macOS Dictation instructions
- **Get help** — `/help` to see all commands

## Updating

When new features are pushed to the repo:

```bash
cd fivetran-cli
git pull
npm install
npm run build
npx @vscode/vsce package --no-dependencies
code --install-extension fivetran-code-0.2.0.vsix --force
```

Then reload VS Code (`Cmd+Shift+P` > "Reload Window"). Check [CHANGELOG.md](CHANGELOG.md) for what's new.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "No Fivetran credentials configured" | Check `~/.fivetran-code/config.json` exists and has valid keys |
| Extension doesn't appear | Reload VS Code (`Cmd+Shift+P` > "Reload Window") |
| API errors | Verify your Anthropic API key has credits at console.anthropic.com |
| `/account` shows "Auth: None" | Config file permissions might be wrong — run `chmod 600 ~/.fivetran-code/config.json` |
