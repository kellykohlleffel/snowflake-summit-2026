"""Activation client for the SE Demo MCP server.

Handles: activate_to_app, reset_activation_app.
Queries Snowflake and pushes results to the React activation app via Cloud Run API.
"""

import os
import json
from decimal import Decimal
from datetime import datetime, date
from typing import Any, Optional

import httpx

from snowflake_client import SnowflakeClient

DEFAULT_ACTIVATION_API_URL = "https://fivetran-activation-api-81810785507.us-central1.run.app"
DEFAULT_ACTIVATION_APP_URL = "https://fivetran-activation-demo.web.app"

VALID_INDUSTRIES = ["pharma", "retail", "hed", "financial", "agriculture", "healthcare", "supply_chain"]


def _lowercase_keys(record: dict) -> dict:
    """Lowercase all keys — Snowflake returns UPPERCASE, React app expects lowercase."""
    return {k.lower(): v for k, v in record.items()}


def _json_safe(obj: Any) -> Any:
    """Make values JSON-serializable."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj


def _clean_records(records: list[dict]) -> list[dict]:
    """Lowercase keys and ensure JSON-safe values."""
    cleaned = []
    for record in records:
        cleaned.append({
            k.lower(): _json_safe(v) for k, v in record.items()
        })
    return cleaned


class ActivationClient:
    """Push Snowflake query results to the activation React app."""

    def __init__(self, snowflake_client: SnowflakeClient):
        self.snowflake = snowflake_client
        self.api_url = os.getenv("ACTIVATION_API_URL", DEFAULT_ACTIVATION_API_URL)
        self.app_url = DEFAULT_ACTIVATION_APP_URL

    async def activate(
        self,
        industry: str,
        snowflake_database: str,
        snowflake_schema: str,
        view_name: str,
        query: str,
        limit: int = 10,
        activation_api_url: Optional[str] = None,
        laptop_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Query Snowflake and push results to the activation app.

        When laptop_id is provided (lab laptops set LAPTOP_ID env var), data is
        namespaced per-laptop via /activate/{industry}/{laptop_id}. When absent,
        falls back to /activate/{industry} for Kelly's dev flow.
        """
        if industry.lower() not in VALID_INDUSTRIES:
            return {
                "success": False,
                "error": f"Invalid industry '{industry}'. Valid: {VALID_INDUSTRIES}",
            }

        # Execute the query against Snowflake
        full_query = query if query.strip() else (
            f"SELECT * FROM {snowflake_database}.{snowflake_schema}.{view_name} "
            f"ORDER BY 1 DESC LIMIT {limit}"
        )

        try:
            results = self.snowflake.execute_query(
                full_query, database=snowflake_database
            )
        except Exception as e:
            return {"success": False, "error": f"Snowflake query failed: {e}"}

        if not results:
            return {"success": False, "error": "Query returned no results"}

        # Clean records: lowercase keys, JSON-safe values, apply limit
        records = _clean_records(results[:limit])

        # Build title from industry
        title_map = {
            "pharma": "At-Risk Clinical Trials",
            "retail": "Customer Churn Insights",
            "hed": "At-Risk Students",
            "financial": "Flagged Transactions",
            "agriculture": "Crop Health Alerts",
            "healthcare": "Patient Risk Scores",
        }
        title = title_map.get(industry.lower(), f"{industry.title()} Insights")

        # Resolve laptop_id — arg > env var > None (dev flow default)
        effective_laptop_id = laptop_id or os.getenv("LAPTOP_ID") or None

        # Push to activation API — route to per-laptop URL when laptop_id set
        api_base = activation_api_url or self.api_url
        if effective_laptop_id:
            url = f"{api_base}/activate/{industry.lower()}/{effective_laptop_id}"
            app_url_with_scope = f"{self.app_url}?laptop_id={effective_laptop_id}"
        else:
            url = f"{api_base}/activate/{industry.lower()}"
            app_url_with_scope = self.app_url
        payload = {
            "title": title,
            "source": "Fivetran \u2192 Snowflake \u2192 dbt \u2192 Activation",
            "records": records,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                resp_data = resp.json()
        except httpx.ConnectError:
            return {"success": False, "error": f"Cannot connect to activation API at {api_base}"}
        except httpx.HTTPStatusError as e:
            return {"success": False, "error": f"API error {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"success": False, "error": f"Error pushing to activation API: {e}"}

        return {
            "success": True,
            "records_pushed": resp_data.get("records_count", len(records)),
            "industry": industry.lower(),
            "laptop_id": effective_laptop_id,
            "activated_at": resp_data.get("activated_at", datetime.utcnow().isoformat()),
            "app_url": app_url_with_scope,
            "message": (
                f"{len(records)} records pushed to {industry.lower()} tab. "
                f"Open the app: {app_url_with_scope}"
            ),
        }

    async def reset(
        self,
        industry: str = "all",
        activation_api_url: Optional[str] = None,
        laptop_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Clear data from the activation app.

        When laptop_id is provided, resets only that laptop's scope via
        /reset/{industry}/{laptop_id}. When absent, resets the shared industry
        doc (dev flow) or all docs (/reset-all).
        """
        api_base = activation_api_url or self.api_url
        effective_laptop_id = laptop_id or os.getenv("LAPTOP_ID") or None

        if industry.lower() == "all":
            url = f"{api_base}/reset-all"
        elif effective_laptop_id:
            url = f"{api_base}/reset/{industry.lower()}/{effective_laptop_id}"
        else:
            url = f"{api_base}/reset/{industry.lower()}"

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url)
                resp.raise_for_status()
                resp_data = resp.json()
        except httpx.ConnectError:
            return {"success": False, "error": f"Cannot connect to activation API at {api_base}"}
        except httpx.HTTPStatusError as e:
            return {"success": False, "error": f"API error {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"success": False, "error": f"Error resetting activation app: {e}"}

        target = "All industry tabs" if industry.lower() == "all" else f"{industry.title()} tab"
        return {
            "success": True,
            "message": resp_data.get("message", f"Reset complete: {target} reset"),
        }
