"""Fivetran SE Demo MCP Server — 7 tools for the AI Solution Demo.

Consolidates tools from snowflake, dbt-core, and fivetran-snowflake-hol-builder
MCP servers into a single lightweight server to minimize token usage.
"""

import json
import os
import requests
from typing import Optional, Union

from mcp.server.fastmcp import FastMCP

from snowflake_client import SnowflakeClient
from dbt_client import DbtClient
from activation_client import ActivationClient

mcp = FastMCP("se-demo")

# Initialize clients once at startup
snowflake = SnowflakeClient()
dbt = DbtClient()
activation = ActivationClient(snowflake)


# --- Snowflake Tools (3) ---


@mcp.tool()
async def run_snowflake_query(
    statement: str,
    database: Optional[str] = None,
    schema: Optional[str] = None,
    warehouse: Optional[str] = None,
    role: Optional[str] = None,
) -> str:
    """Execute a SQL statement against Snowflake.

    Args:
        statement: SQL to execute (SELECT, SHOW, CREATE, etc.)
        database: Override default database
        schema: Override default schema
        warehouse: Override default warehouse
        role: Override default role

    Returns column names and rows as JSON.
    """
    try:
        results = snowflake.execute_query(
            statement, database=database, schema=schema,
            warehouse=warehouse, role=role,
        )
        return json.dumps({"success": True, "results": results, "row_count": len(results)})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool()
async def list_cortex_agents(database: Optional[str] = None) -> str:
    """List all Cortex Agents in a Snowflake database.

    Args:
        database: Database to search (uses default if not specified)
    """
    try:
        agents = snowflake.list_agents(database=database)
        return json.dumps({"success": True, "agents": agents, "count": len(agents)})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool()
async def cortex_analyst(
    agent_name: str,
    question: str,
    database: Optional[str] = None,
) -> str:
    """Query a Cortex Agent with a natural language question.

    The agent translates the question to SQL, executes it against the
    semantic view, and returns interpreted results.

    Args:
        agent_name: Cortex Agent name — can be fully qualified (DB.SCHEMA.AGENT),
            schema-qualified (SCHEMA.AGENT), or just the agent name (auto-discovers schema)
        question: Natural language question to ask
        database: Database containing the agent (uses default if not specified)
    """
    try:
        result = snowflake.query_cortex_analyst(
            agent_name=agent_name, question=question, database=database,
        )
        return json.dumps({"success": True, **result})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


# --- dbt Tools (2) ---


@mcp.tool()
async def dbt_run(
    select: Optional[str] = None,
    vars: Optional[Union[str, dict]] = None,
    full_refresh: bool = False,
) -> str:
    """Run dbt models.

    Args:
        select: Model selection (e.g., "pharma", "tag:mart", "+model_name+")
        vars: dbt vars as JSON string or object (e.g., '{"pharma_source_schema": "MY_SCHEMA"}')
        full_refresh: Whether to do a full refresh of incremental models
    """
    try:
        # Accept both JSON string and dict — LLMs naturally send objects
        vars_str = vars
        if vars is not None and isinstance(vars, dict):
            vars_str = json.dumps(vars)
        result = await dbt.run(select=select, vars_json=vars_str, full_refresh=full_refresh)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool()
async def dbt_test(
    select: Optional[str] = None,
    vars: Optional[Union[str, dict]] = None,
) -> str:
    """Run dbt tests.

    Args:
        select: Test selection (e.g., "pharma", "tag:mart")
        vars: dbt vars as JSON string or object — pass the same vars used in dbt_run so source tests resolve correctly
    """
    try:
        vars_str = vars
        if vars is not None and isinstance(vars, dict):
            vars_str = json.dumps(vars)
        result = await dbt.test(select=select, vars_json=vars_str)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


# --- Cortex Agent Creation Tool (1) ---


@mcp.tool()
async def create_demo_cortex_agent(
    industry: str,
    database: str,
    semantic_schema: str,
    agent_name: str,
    semantic_view_name: str,
) -> str:
    """Create a Cortex Agent from a pre-built DDL template for the demo.

    Reads the exact DDL from the reference file for the specified industry,
    substitutes the database, schema, agent name, and semantic view path,
    then executes it in Snowflake. No manual DDL construction needed.

    Args:
        industry: Industry key (pharma, retail, hed, financial, agriculture, healthcare)
        database: Snowflake database name (e.g., HOL_DATABASE_1)
        semantic_schema: Schema where the semantic view lives (e.g., HED_SEMANTIC)
        agent_name: Full agent name to create (e.g., HED_DEMO_1_STUDENT_RETENTION_AGENT)
        semantic_view_name: Name of the semantic view (e.g., SV_STUDENT_RETENTION)
    """
    import re

    # DDL files live in the skill's references directory
    ddl_dir = os.path.expanduser(
        "~/.claude/skills/fivetran-se-ai-solution-demo/references/agents"
    )
    ddl_path = os.path.join(ddl_dir, industry, "create_cortex_agent.sql")

    if not os.path.isfile(ddl_path):
        return json.dumps({
            "success": False,
            "error": f"DDL file not found: {ddl_path}. Valid industries: pharma, retail, hed, financial, agriculture, healthcare",
        })

    try:
        with open(ddl_path, "r") as f:
            ddl = f.read()

        # Strip comment lines at the top (-- lines before CREATE)
        lines = ddl.split("\n")
        sql_lines = []
        started = False
        for line in lines:
            if not started and line.strip().startswith("--"):
                continue
            started = True
            sql_lines.append(line)
        ddl = "\n".join(sql_lines)

        # Substitute the 4 variable parts:
        # 1. Agent fully qualified name (CREATE OR REPLACE AGENT <db>.<schema>.<name>)
        ddl = re.sub(
            r"(CREATE\s+OR\s+REPLACE\s+AGENT\s+)\S+",
            rf"\1{database}.{semantic_schema}.{agent_name}",
            ddl,
            count=1,
        )

        # 2. Semantic view path in tool_resources (semantic_view: "...")
        ddl = re.sub(
            r'(semantic_view:\s*")\S+(")',
            rf'\g<1>{database}.{semantic_schema}.{semantic_view_name}\2',
            ddl,
        )

        # Execute the DDL
        result = snowflake.execute_query(ddl, database=database)

        # Verify agent exists
        agents = snowflake.list_agents(database=database)
        agent_found = any(
            a.get("name", "").upper() == agent_name.upper()
            for a in agents
        )

        return json.dumps({
            "success": True,
            "agent_name": agent_name,
            "database": database,
            "schema": semantic_schema,
            "semantic_view": f"{database}.{semantic_schema}.{semantic_view_name}",
            "verified": agent_found,
            "message": f"Agent {agent_name} created successfully" + (" and verified" if agent_found else " (verification pending)"),
        })

    except Exception as e:
        return json.dumps({"success": False, "error": str(e), "ddl_path": ddl_path})


# --- Activation Tools (2) ---


@mcp.tool()
async def activate_to_app(
    industry: str,
    snowflake_database: str,
    snowflake_schema: str,
    view_name: str,
    query: str,
    limit: int = 10,
    activation_api_url: Optional[str] = None,
    laptop_id: Optional[str] = None,
) -> str:
    """Push insights from a Snowflake dbt view to the React activation app.

    Executes the query against Snowflake, then POSTs results to the
    activation API which displays them in the app.

    Args:
        industry: Industry tab (pharma, retail, hed, financial, agriculture, healthcare)
        snowflake_database: Snowflake database name
        snowflake_schema: Snowflake schema containing the view (usually the marts schema)
        view_name: Name of the dbt view/table to query
        query: SQL query to execute (use this for custom queries with filters/ordering)
        limit: Max records to push (default 10)
        activation_api_url: Override the default activation API URL
        laptop_id: Per-laptop namespace for lab use (e.g., "laptop3"). If unset,
            reads LAPTOP_ID env var. If both unset, falls back to shared dev-flow
            endpoint /activate/{industry}.
    """
    result = await activation.activate(
        industry=industry,
        snowflake_database=snowflake_database,
        snowflake_schema=snowflake_schema,
        view_name=view_name,
        query=query,
        limit=limit,
        activation_api_url=activation_api_url,
        laptop_id=laptop_id,
    )
    return json.dumps(result)


@mcp.tool()
async def reset_activation_app(
    industry: str = "all",
    activation_api_url: Optional[str] = None,
    laptop_id: Optional[str] = None,
) -> str:
    """Reset the activation app — clear data from industry tabs.

    Use between demo sessions to reset the app to its clean state.

    Args:
        industry: Which tab to reset. Use "all" to reset all tabs.
        activation_api_url: Override the default activation API URL
        laptop_id: If set (lab mode), resets only this laptop's scope. If unset,
            reads LAPTOP_ID env; otherwise resets the shared industry doc.
    """
    result = await activation.reset(
        industry=industry,
        activation_api_url=activation_api_url,
        laptop_id=laptop_id,
    )
    return json.dumps(result)


# --- Cleanup Tool (1) ---

# Industry key → Fivetran source schema suffix (uppercase)
INDUSTRY_SOURCE_SCHEMAS = {
    "pharma": "PHARMA",
    "retail": "RETAIL",
    "hed": "HIGHER_EDUCATION",
    "financial": "FINANCIAL_SERVICES",
    "agriculture": "AGRICULTURE",
    "healthcare": "HEALTHCARE",
    "supply_chain": "SUPPLY_CHAIN",
}


def _lookup_fivetran_connection(schema_prefix: str) -> Optional[dict]:
    """Look up a Fivetran connection by schema prefix with pagination. Returns {id, schema} or None."""
    import base64
    import sys
    api_key = os.getenv("FIVETRAN_API_KEY", "")
    api_secret = os.getenv("FIVETRAN_API_SECRET", "")
    group_id = os.getenv("FIVETRAN_GROUP_ID", "")
    print(f"[cleanup] Looking up connection: schema_prefix='{schema_prefix}', group='{group_id}', key_present={bool(api_key)}, secret_present={bool(api_secret)}", file=sys.stderr, flush=True)
    if not api_key or not api_secret or not group_id:
        print(f"[cleanup] ABORT: Missing Fivetran credentials", file=sys.stderr, flush=True)
        return None
    auth = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}", "Accept": "application/json;version=2"}
    try:
        cursor = None
        while True:
            url = f"https://api.fivetran.com/v1/groups/{group_id}/connections"
            params: dict = {"limit": 100}
            if cursor:
                params["cursor"] = cursor
            print(f"[cleanup] GET {url} params={params}", file=sys.stderr, flush=True)
            resp = requests.get(url, headers=headers, params=params, timeout=15)
            print(f"[cleanup] Response status: {resp.status_code}", file=sys.stderr, flush=True)
            resp.raise_for_status()
            data = resp.json().get("data", {})
            items = data.get("items", [])
            schemas_found = [c.get("schema", "") for c in items]
            print(f"[cleanup] Got {len(items)} connections. Schemas: {schemas_found}", file=sys.stderr, flush=True)
            for conn in items:
                conn_schema = conn.get("schema", "")
                if conn_schema.lower() == schema_prefix.lower():
                    print(f"[cleanup] MATCH: {conn['id']} (schema={conn_schema})", file=sys.stderr, flush=True)
                    return {"id": conn["id"], "schema": conn_schema}
            cursor = data.get("next_cursor")
            if not cursor:
                break
        print(f"[cleanup] No match found for '{schema_prefix}'", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[cleanup] ERROR: {e}", file=sys.stderr, flush=True)
    print(f"[cleanup] No connection found for schema prefix '{schema_prefix}'", file=sys.stderr)
    return None


def _delete_fivetran_connection(connection_id: str) -> dict:
    """Delete a Fivetran connection by ID."""
    import base64
    api_key = os.getenv("FIVETRAN_API_KEY", "")
    api_secret = os.getenv("FIVETRAN_API_SECRET", "")
    if not api_key or not api_secret:
        return {"status": "error", "error": "Fivetran API credentials not configured"}
    auth = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    try:
        resp = requests.delete(
            f"https://api.fivetran.com/v1/connections/{connection_id}",
            headers={"Authorization": f"Basic {auth}", "Accept": "application/json;version=2"},
            timeout=15,
        )
        resp.raise_for_status()
        return {"status": "success", "message": f"Connector {connection_id} deleted"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@mcp.tool()
async def cleanup_demo(
    schema_prefix: str,
    industry: str,
    database: Optional[str] = None,
    confirmed: bool = False,
) -> str:
    """Clean up all demo artifacts: Fivetran connector, Snowflake schemas/agents, activation app.

    Automatically looks up the Fivetran connector by schema prefix — no guessing.
    Call with confirmed=False first to preview. Call with confirmed=True to execute.

    Args:
        schema_prefix: The schema prefix used in the demo (e.g., "hed_fivetran_code_100")
        industry: Industry key (pharma, retail, hed, financial, agriculture, healthcare)
        database: Snowflake database. If unset, reads SNOWFLAKE_DATABASE env var;
            falls back to HOL_DATABASE_1 (Kelly's dev default) if that's also unset.
        confirmed: False=preview, True=execute
    """
    # Resolve database: arg > env > dev-flow default
    if not database:
        database = os.getenv("SNOWFLAKE_DATABASE", "HOL_DATABASE_1")
    industry_lower = industry.lower()
    source_suffix = INDUSTRY_SOURCE_SCHEMAS.get(industry_lower)
    if not source_suffix:
        return json.dumps({
            "success": False,
            "error": f"Unknown industry: {industry}. Valid: {', '.join(INDUSTRY_SOURCE_SCHEMAS.keys())}",
        })

    # Look up the Fivetran connector by schema prefix — never guess
    connector = _lookup_fivetran_connection(schema_prefix)
    connection_id = connector["id"] if connector else None
    connection_schema = connector["schema"] if connector else schema_prefix

    prefix_upper = schema_prefix.upper()
    industry_upper = industry_lower.upper()

    # Source schema from Fivetran (e.g., HED_FIVETRAN_CODE_100_HIGHER_EDUCATION)
    source_schema = f"{prefix_upper}_{source_suffix}"
    # dbt output schemas
    staging_schema = f"{industry_upper}_STAGING"
    marts_schema = f"{industry_upper}_MARTS"
    semantic_schema = f"{industry_upper}_SEMANTIC"

    # Find agents in the semantic schema
    agents_to_drop: list[str] = []
    try:
        all_agents = snowflake.list_agents(database=database)
        agents_to_drop = [
            a["name"] for a in all_agents
            if a.get("schema_name", "").upper() == semantic_schema
        ]
    except Exception:
        pass

    # Build SQL statements
    sql_statements: list[str] = []
    for agent_name in agents_to_drop:
        sql_statements.append(f"DROP AGENT IF EXISTS {database}.{semantic_schema}.{agent_name}")
    sql_statements.extend([
        f"DROP SCHEMA IF EXISTS {database}.{source_schema} CASCADE",
        f"DROP SCHEMA IF EXISTS {database}.{staging_schema} CASCADE",
        f"DROP SCHEMA IF EXISTS {database}.{marts_schema} CASCADE",
        f"DROP SCHEMA IF EXISTS {database}.{semantic_schema} CASCADE",
    ])

    if not confirmed:
        # Preview mode
        preview_lines = ["Demo Cleanup Preview", "=" * 40, ""]
        preview_lines.append("Tier 1: Snowflake Agent(s)")
        if agents_to_drop:
            for a in agents_to_drop:
                preview_lines.append(f"  DROP AGENT IF EXISTS {database}.{semantic_schema}.{a}")
        else:
            preview_lines.append("  (no agents found in semantic schema)")
        preview_lines.append("")
        preview_lines.append("Tier 2: Snowflake Schemas (4)")
        preview_lines.append(f"  DROP SCHEMA IF EXISTS {database}.{source_schema} CASCADE")
        preview_lines.append(f"  DROP SCHEMA IF EXISTS {database}.{staging_schema} CASCADE")
        preview_lines.append(f"  DROP SCHEMA IF EXISTS {database}.{marts_schema} CASCADE")
        preview_lines.append(f"  DROP SCHEMA IF EXISTS {database}.{semantic_schema} CASCADE")
        preview_lines.append("")
        preview_lines.append("Tier 3: Fivetran Connector")
        if connection_id:
            preview_lines.append(f"  Connection: {connection_id} (schema: {connection_schema})")
            preview_lines.append("  → Will be deleted automatically")
        else:
            preview_lines.append(f"  No connector found with schema prefix '{schema_prefix}'")
            preview_lines.append("  (already deleted or never created)")
        preview_lines.append("")
        preview_lines.append("Tier 4: Activation App")
        preview_lines.append(f"  Reset: {industry_lower} tab")
        preview_lines.append("")
        preview_lines.append("Call again with confirmed=True to execute.")

        return json.dumps({
            "success": True,
            "mode": "preview",
            "preview": "\n".join(preview_lines),
            "connection_id": connection_id,
            "connection_schema": connection_schema,
            "schemas_to_drop": [source_schema, staging_schema, marts_schema, semantic_schema],
            "agents_to_drop": agents_to_drop,
        })

    # Execute mode
    results: list[dict] = []

    # Tier 1 + 2: Execute SQL (agents + schemas)
    try:
        sql_results = snowflake.execute_multi(sql_statements, database=database)
        results.extend(sql_results)
    except Exception as e:
        results.append({"step": "snowflake_cleanup", "status": "error", "error": str(e)})

    # Tier 3: Delete Fivetran connector
    if connection_id:
        result = _delete_fivetran_connection(connection_id)
        results.append({"step": f"delete_connector_{connection_id}", **result})
    else:
        results.append({"step": "delete_connector", "status": "skipped", "message": "No connector found"})

    # Tier 4: Reset activation app
    try:
        activation_result = await activation.reset(industry=industry_lower)
        results.append({"step": "reset_activation", **activation_result})
    except Exception as e:
        results.append({"step": "reset_activation", "status": "error", "error": str(e)})

    success_count = sum(1 for r in results if r.get("status") == "success")
    error_count = sum(1 for r in results if r.get("status") == "error")

    return json.dumps({
        "success": error_count == 0,
        "summary": f"Cleanup complete: {success_count} succeeded, {error_count} failed",
        "results": results,
        "connection_id": connection_id,
        "schema_prefix": schema_prefix,
    })
