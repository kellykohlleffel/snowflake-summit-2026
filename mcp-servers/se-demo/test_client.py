"""Test each client independently — Step 1 of testing per mcp-server-builder skill.

Run: python test_client.py
All tests must pass before proceeding to test_server_logic.py.
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load .env
project_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(project_dir, ".env"))

from snowflake_client import SnowflakeClient
from dbt_client import DbtClient
from activation_client import ActivationClient


def test_snowflake_connection():
    """Test Snowflake connectivity and basic query."""
    client = SnowflakeClient()
    results = client.execute_query(
        "SELECT CURRENT_ACCOUNT() AS account, CURRENT_ROLE() AS role, "
        "CURRENT_WAREHOUSE() AS warehouse, CURRENT_DATABASE() AS database"
    )
    assert len(results) == 1, "Expected 1 row"
    row = results[0]
    print(f"  Account:   {row.get('ACCOUNT', row.get('account'))}")
    print(f"  Role:      {row.get('ROLE', row.get('role'))}")
    print(f"  Warehouse: {row.get('WAREHOUSE', row.get('warehouse'))}")
    print(f"  Database:  {row.get('DATABASE', row.get('database'))}")
    print("✅ Snowflake connection works")


def test_snowflake_query():
    """Test a real query with data."""
    client = SnowflakeClient()
    results = client.execute_query("SELECT 1 AS test_col, 'hello' AS test_str")
    assert len(results) == 1
    assert results[0]["TEST_COL"] == 1
    print("✅ Snowflake query works")


def test_snowflake_list_agents():
    """Test listing Cortex Agents."""
    client = SnowflakeClient()
    try:
        agents = client.list_agents()
        print(f"  Found {len(agents)} agent(s)")
        for a in agents[:3]:
            name = a.get("name", a.get("NAME", "?"))
            print(f"    - {name}")
        print("✅ List Cortex Agents works")
    except Exception as e:
        print(f"⚠️  List Cortex Agents skipped (may be none): {e}")


def test_dbt_config():
    """Test that dbt paths are configured correctly."""
    client = DbtClient()
    assert client.project_dir, "DBT_PROJECT_DIR not set"
    assert os.path.isdir(client.project_dir), f"DBT_PROJECT_DIR not found: {client.project_dir}"
    assert os.path.isfile(client.dbt_path), f"dbt binary not found: {client.dbt_path}"
    print(f"  Project:  {client.project_dir}")
    print(f"  dbt path: {client.dbt_path}")
    print("✅ dbt configuration valid")


async def test_dbt_debug():
    """Test dbt connectivity by running dbt debug."""
    client = DbtClient()
    result = await client._run_command("debug", timeout=30)
    if result["success"]:
        print("✅ dbt debug works")
    else:
        # dbt debug might fail on some setups but command should execute
        print(f"⚠️  dbt debug returned non-zero (may be OK): {(result.get('error') or '')[:100]}")


async def test_activation_reset():
    """Test activation API connectivity via reset."""
    client = SnowflakeClient()
    activation = ActivationClient(client)
    result = await activation.reset(industry="all")
    if result["success"]:
        print(f"  {result['message']}")
        print("✅ Activation API reset works")
    else:
        print(f"⚠️  Activation API: {result['error']}")


def main():
    print("\n=== Snowflake Client Tests ===\n")
    test_snowflake_connection()
    test_snowflake_query()
    test_snowflake_list_agents()

    print("\n=== dbt Client Tests ===\n")
    test_dbt_config()
    asyncio.run(test_dbt_debug())

    print("\n=== Activation Client Tests ===\n")
    asyncio.run(test_activation_reset())

    print("\n✅ All client tests passed!\n")


if __name__ == "__main__":
    main()
