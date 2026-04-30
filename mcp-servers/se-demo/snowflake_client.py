"""Snowflake client for the SE Demo MCP server.

Handles: run_snowflake_query, list_cortex_agents, cortex_analyst.
Supports PAT and password authentication.
"""

import os
import json
from decimal import Decimal
from datetime import datetime, date
from typing import Any, Optional

import requests
import snowflake.connector


def _json_safe(value: Any) -> Any:
    """Convert Snowflake types to JSON-serializable values."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


class SnowflakeClient:
    """Lightweight Snowflake client for the SE demo."""

    def __init__(self):
        self.account = os.getenv("SNOWFLAKE_ACCOUNT", "")
        self.user = os.getenv("SNOWFLAKE_USER", "")
        self.password = os.getenv("SNOWFLAKE_PASSWORD", "")
        self.auth_type = os.getenv("SNOWFLAKE_AUTH_TYPE", "password")
        self.role = os.getenv("SNOWFLAKE_ROLE", "ACCOUNTADMIN")
        self.warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "")
        self.database = os.getenv("SNOWFLAKE_DATABASE", "")

    def _connect(
        self,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        warehouse: Optional[str] = None,
        role: Optional[str] = None,
    ) -> snowflake.connector.SnowflakeConnection:
        """Create a new Snowflake connection."""
        params: dict[str, Any] = {
            "account": self.account,
            "user": self.user,
            "role": role or self.role,
            "warehouse": warehouse or self.warehouse,
            "database": database or self.database,
            "client_session_keep_alive": True,
        }
        if schema:
            params["schema"] = schema

        if self.auth_type == "pat":
            params["token"] = self.password
            params["authenticator"] = "programmatic_access_token"
        else:
            params["password"] = self.password

        return snowflake.connector.connect(**params)

    def execute_query(
        self,
        statement: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        warehouse: Optional[str] = None,
        role: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Execute SQL and return results as list of dicts."""
        conn = self._connect(database=database, schema=schema, warehouse=warehouse, role=role)
        try:
            cursor = conn.cursor()
            cursor.execute(statement)
            if cursor.description is None:
                return [{"status": "Statement executed successfully"}]
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [
                {col: _json_safe(val) for col, val in zip(columns, row)}
                for row in rows
            ]
        finally:
            conn.close()

    def execute_multi(
        self,
        statements: list[str],
        database: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Execute multiple SQL statements in one connection. Returns per-statement results."""
        conn = self._connect(database=database)
        results: list[dict[str, Any]] = []
        try:
            cursor = conn.cursor()
            for stmt in statements:
                stmt = stmt.strip()
                if not stmt:
                    continue
                try:
                    cursor.execute(stmt)
                    results.append({"statement": stmt, "status": "success"})
                except Exception as e:
                    results.append({"statement": stmt, "status": "error", "error": str(e)})
        finally:
            conn.close()
        return results

    def list_agents(self, database: Optional[str] = None) -> list[dict[str, Any]]:
        """List Cortex Agents in a database."""
        db = database or self.database
        statement = f"SHOW AGENTS IN DATABASE {db}"
        return self.execute_query(statement, database=db)

    def query_cortex_analyst(
        self,
        agent_name: str,
        question: str,
        database: Optional[str] = None,
    ) -> dict[str, Any]:
        """Query a Cortex Agent via the REST API.

        agent_name can be:
        - Fully qualified: DATABASE.SCHEMA.AGENT_NAME
        - Schema-qualified: SCHEMA.AGENT_NAME (uses default database)
        - Just the name: AGENT_NAME (uses default database, discovers schema)
        """
        db = database or self.database

        # Build fully qualified agent name
        parts = agent_name.split(".")
        if len(parts) == 3:
            fq_agent_name = agent_name
        elif len(parts) == 2:
            fq_agent_name = f"{db}.{agent_name}"
        else:
            # Try to find the agent in the database
            fq_agent_name = f"{db}.PUBLIC.{agent_name}"
            try:
                conn_check = self._connect(database=db)
                cur = conn_check.cursor()
                cur.execute(f"SHOW AGENTS IN DATABASE {db}")
                rows = cur.fetchall()
                for row in rows:
                    if row[1] == agent_name:  # name column
                        schema = row[3] if len(row) > 3 else "PUBLIC"  # schema_name column
                        fq_agent_name = f"{db}.{schema}.{agent_name}"
                        break
                cur.close()
                conn_check.close()
            except Exception:
                pass  # Fall back to PUBLIC

        # Parse fully qualified agent name into DB.SCHEMA.AGENT parts
        fq_parts = fq_agent_name.split(".")
        if len(fq_parts) == 3:
            agent_db, agent_schema, agent_name_only = fq_parts
        elif len(fq_parts) == 2:
            agent_db = db
            agent_schema, agent_name_only = fq_parts
        else:
            agent_db = db
            agent_schema = "PUBLIC"
            agent_name_only = fq_parts[0]

        # Get a connection to extract the auth token
        conn = self._connect(database=agent_db)
        try:
            token = conn.rest.token
            # Build the host URL.
            #
            # Use the account string as-is. Two account formats coexist:
            #   - Locator format: "<locator>.<region>.<cloud>"
            #     -> https://<locator>.<region>.<cloud>.snowflakecomputing.com
            #     (lab account aa67604.us-central1.gcp uses this)
            #   - Org-account format: "<org>-<account>"
            #     -> https://<org>-<account>.snowflakecomputing.com
            #     (Kelly's dev account a3209653506471-sales-eng-hands-on-lab)
            #
            # Both formats build a valid REST API host directly. The previous
            # `account.replace(".", "-")` corrupted locator-format hosts: lab
            # laptop 1 (2026-04-29) hit 404 on aa67604-us-central1-gcp.snowflakecomputing.com
            # because Snowflake routes the locator form by literal dots.
            host = f"https://{self.account}.snowflakecomputing.com"

            headers = {
                "Authorization": f'Snowflake Token="{token}"',
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }

            # Agent-specific endpoint (matches working PSE Intelligence pattern)
            url = (
                f"{host}/api/v2/databases/{agent_db}"
                f"/schemas/{agent_schema}"
                f"/agents/{agent_name_only}:run"
            )
            payload = {
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": question}],
                    }
                ],
                "tool_choice": {"type": "auto"},
                "stream": True,
            }

            response = requests.post(url, headers=headers, json=payload, timeout=120, stream=True)
            response.raise_for_status()

            # Parse SSE events from the stream
            # The agent streams thinking steps, tool calls, and a final answer.
            # We collect text per-message (role transitions) and keep only the
            # final assistant message to avoid duplicated thinking steps.
            result: dict[str, Any] = {}
            current_text_parts: list[str] = []
            all_messages: list[str] = []
            sql_statement: str = ""

            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[len("data:"):].strip()
                if data_str == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                # Detect message boundaries — new message starts
                if event.get("object") == "message.start" or event.get("type") == "message_start":
                    if current_text_parts:
                        all_messages.append("".join(current_text_parts))
                        current_text_parts = []

                # Extract content from delta events
                delta = event.get("delta", {})
                content_items = delta.get("content", [])
                for item in content_items:
                    item_type = item.get("type", "")
                    if item_type == "text":
                        current_text_parts.append(item.get("text", ""))
                    elif item_type == "tool_results":
                        for tc in item.get("content", []):
                            if tc.get("type") == "text":
                                current_text_parts.append(tc.get("text", ""))
                            elif tc.get("type") == "sql":
                                sql_statement = tc.get("statement", "")

                # Streaming tokens (text + sequence_number)
                if "text" in event and "sequence_number" in event:
                    current_text_parts.append(event.get("text", ""))

                # Content at top level
                top_content = event.get("content", [])
                if isinstance(top_content, list):
                    for item in top_content:
                        item_type = item.get("type", "")
                        if item_type == "text":
                            current_text_parts.append(item.get("text", ""))
                        elif item_type == "tool_results":
                            tr = item.get("tool_results", {})
                            for tc in tr.get("content", []):
                                if tc.get("type") == "text":
                                    current_text_parts.append(tc.get("text", ""))
                                elif tc.get("type") == "sql":
                                    sql_statement = tc.get("statement", "")

            # Flush last message
            if current_text_parts:
                all_messages.append("".join(current_text_parts))

            # Deduplicate: the agent stream often repeats thinking + answer blocks.
            # Strategy: split the full text into paragraphs, keep only unique ones
            # in order, then return the deduplicated result.
            if all_messages:
                full_text = "\n".join(all_messages)
                # Split into paragraphs and deduplicate while preserving order
                paragraphs = [p.strip() for p in full_text.split("\n\n") if p.strip()]
                seen: set[str] = set()
                unique_paragraphs: list[str] = []
                for p in paragraphs:
                    if p not in seen:
                        seen.add(p)
                        unique_paragraphs.append(p)
                result["text"] = "\n\n".join(unique_paragraphs)
            if sql_statement:
                result["sql"] = sql_statement

            # If we got SQL, execute it to get results
            if "sql" in result:
                try:
                    result["results"] = self.execute_query(result["sql"], database=agent_db)
                except Exception as e:
                    result["sql_error"] = str(e)

            # If no structured content, return raw
            if not result:
                result["raw_response"] = "No content returned from agent"

            return result
        finally:
            conn.close()
