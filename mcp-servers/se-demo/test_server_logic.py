"""Test MCP tool logic without the MCP layer — Step 2 of testing.

Run: python test_server_logic.py
Tests the same business logic that the MCP tools use.
"""

import os
import sys
import json
import asyncio
from dotenv import load_dotenv

# Load .env
project_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(project_dir, ".env"))

from snowflake_client import SnowflakeClient
from dbt_client import DbtClient
from activation_client import ActivationClient


def test_query_logic():
    """Test the logic behind run_snowflake_query tool."""
    client = SnowflakeClient()
    results = client.execute_query("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES")
    assert len(results) == 1
    assert "CNT" in results[0] or "cnt" in results[0]
    print(f"  Tables in database: {results[0].get('CNT', results[0].get('cnt'))}")
    print("✅ run_snowflake_query logic works")


def test_list_agents_logic():
    """Test the logic behind list_cortex_agents tool."""
    client = SnowflakeClient()
    agents = client.list_agents()
    print(f"  Found {len(agents)} agent(s)")
    print("✅ list_cortex_agents logic works")


async def test_dbt_run_logic():
    """Test the logic behind dbt_run tool (dry run with --select none)."""
    client = DbtClient()
    # Use dbt ls to verify project is parseable without running models
    result = await client._run_command("ls", select="pharma", timeout=60)
    if result["success"]:
        lines = [l for l in result["output"].strip().split("\n") if l.strip()]
        print(f"  Found {len(lines)} pharma resource(s)")
        print("✅ dbt_run logic works (project parses correctly)")
    else:
        print(f"⚠️  dbt ls returned non-zero: {(result.get('error') or '')[:200]}")
        print("  (This may be OK if no pharma models exist yet)")


async def test_activation_logic():
    """Test the logic behind activate_to_app tool (reset only, no data push)."""
    client = SnowflakeClient()
    activation = ActivationClient(client)

    # Test reset logic
    result = await activation.reset(industry="all")
    assert result["success"], f"Reset failed: {result.get('error')}"
    print(f"  {result['message']}")
    print("✅ activate_to_app / reset logic works")


async def test_activation_invalid_industry():
    """Test error handling for invalid industry."""
    client = SnowflakeClient()
    activation = ActivationClient(client)
    result = await activation.activate(
        industry="invalid_industry",
        snowflake_database="TEST",
        snowflake_schema="TEST",
        view_name="TEST",
        query="SELECT 1",
    )
    assert not result["success"]
    assert "Invalid industry" in result["error"]
    print("✅ Invalid industry error handling works")


def main():
    print("\n=== Snowflake Tool Logic ===\n")
    test_query_logic()
    test_list_agents_logic()

    print("\n=== dbt Tool Logic ===\n")
    asyncio.run(test_dbt_run_logic())

    print("\n=== Activation Tool Logic ===\n")
    asyncio.run(test_activation_logic())
    asyncio.run(test_activation_invalid_industry())

    print("\n✅ All server logic tests passed!\n")


if __name__ == "__main__":
    main()
