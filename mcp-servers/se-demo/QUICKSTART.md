# Fivetran SE Demo MCP Server

Consolidated MCP server with 7 tools for the SE AI Solution Demo. Replaces 3 separate MCP servers (snowflake, dbt-core, fivetran-snowflake-hol-builder) to reduce token usage by ~80%.

## Tools

| Tool | Description |
|------|-------------|
| `run_snowflake_query` | Execute SQL against Snowflake |
| `list_cortex_agents` | List Cortex Agents in a database |
| `cortex_analyst` | Query a Cortex Agent with natural language |
| `dbt_run` | Run dbt models |
| `dbt_test` | Run dbt tests |
| `activate_to_app` | Push Snowflake insights to the React activation app |
| `reset_activation_app` | Clear data from the activation app |

## Setup

1. Copy `.env.example` to `.env` and fill in credentials
2. Install dependencies: `pip install -r requirements.txt`
3. Test: `python test_client.py && python test_server_logic.py`
4. Add to Claude Desktop config (see below)

## Claude Desktop Config

```json
{
  "se-demo": {
    "command": "/Users/kelly.kohlleffel/venvs/mcpvenv2/bin/python",
    "args": ["/Users/kelly.kohlleffel/Documents/GitHub/fivetran-se-demo-mcp-server/run_server.py"]
  }
}
```

## Testing

```bash
python test_client.py          # Step 1: Test API clients
python test_server_logic.py    # Step 2: Test business logic
python run_server.py           # Step 3: Start server
```

## Demo Tool Map

Shows which tools are called by Fivetran Code (native) vs this MCP server at each demo step.

| Step | Phase | Fivetran Code (native) | se-demo MCP |
|------|-------|----------------------|-------------|
| 1 | Prerequisites | list_groups, get_group_details | run_snowflake_query, reset_activation_app |
| 2 | MOVE: Connect | setup_postgresql_connection, update_schema_config | — |
| 3 | MOVE: Sync | sync_connection, get_connection | run_snowflake_query |
| 4 | TRANSFORM | — | dbt_run, dbt_test, run_snowflake_query |
| 5 | AGENT | — | run_snowflake_query, list_cortex_agents |
| 6 | ASK | — | cortex_analyst (2-4x) |
| 7 | ACTIVATE | — | activate_to_app |

## Demo Usage

Before the demo, use mcp-cloud to:
1. Disable: snowflake, dbt-core, fivetran-snowflake-hol-builder, census
2. Enable: se-demo

This drops from ~130 tools to ~20 (7 MCP + 11 Fivetran native + mcp-cloud).

## Activation App

- **App URL:** https://fivetran-activation-demo.web.app/
- **API URL:** https://fivetran-activation-api-81810785507.us-central1.run.app
