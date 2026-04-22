"""
Fivetran SE AI Solution Demo — Activation API

Tiny FastAPI endpoint that accepts activation data and writes to Firestore.
The React app subscribes to Firestore and updates in real-time.

Deployed on Cloud Run. Called by the hol-builder MCP's activate_to_app tool.
"""

import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

app = FastAPI(
    title="Fivetran Activation API",
    description="Accepts activation data and writes to Firestore for real-time display",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Firestore client — uses named database (not default, which is Datastore Mode)
db = firestore.Client(
    project=os.environ.get("GCP_PROJECT_ID", "fivetran-fivetran-248-war-mraw"),
    database=os.environ.get("FIRESTORE_DATABASE", "activation-demo"),
)


class ActivationRequest(BaseModel):
    """Activation payload from the MCP tool."""
    title: str = "Activated Insights"
    source: str = "Fivetran → Snowflake → dbt → Activation"
    records: list[dict]


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "fivetran-activation-api"}


VALID_INDUSTRIES = ["pharma", "retail", "hed", "financial", "agriculture", "healthcare", "supply_chain"]


def _doc_id(industry: str, laptop_id: str | None) -> str:
    """Build the Firestore document id. Dev flow uses the bare industry name;
    lab laptops pass a laptop_id so data is namespaced per-laptop
    (prevents two booth attendees on the same industry from overwriting each
    other's activation app view)."""
    if laptop_id:
        return f"{industry}_{laptop_id}"
    return industry


def _validate_industry(industry: str) -> None:
    if industry not in VALID_INDUSTRIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid industry '{industry}'. Valid: {VALID_INDUSTRIES}",
        )


def _validate_laptop_id(laptop_id: str) -> None:
    """Guardrail: laptop_id must be alphanumeric + underscore/dash. Prevents
    Firestore doc id injection via malformed URL segments."""
    if not laptop_id or len(laptop_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid laptop_id")
    if not all(c.isalnum() or c in "_-" for c in laptop_id):
        raise HTTPException(status_code=400, detail="laptop_id must be alphanumeric + underscore/dash")


def _do_activate(industry: str, laptop_id: str | None, payload: ActivationRequest) -> dict:
    _validate_industry(industry)
    if laptop_id is not None:
        _validate_laptop_id(laptop_id)
    if not payload.records:
        raise HTTPException(status_code=400, detail="No records provided")

    doc_data = {
        "title": payload.title,
        "source": payload.source,
        "records": payload.records,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }

    doc_ref = db.collection("industries").document(_doc_id(industry, laptop_id))
    doc_ref.set(doc_data)

    return {
        "success": True,
        "industry": industry,
        "laptop_id": laptop_id,
        "records_count": len(payload.records),
        "activated_at": doc_data["activated_at"],
        "message": f"Activated {len(payload.records)} records to {industry} tab"
                   + (f" (laptop {laptop_id})" if laptop_id else ""),
    }


@app.post("/activate/{industry}")
def activate(industry: str, payload: ActivationRequest):
    """Dev-flow endpoint — writes to industries/{industry}. Unchanged from v1."""
    return _do_activate(industry, None, payload)


@app.post("/activate/{industry}/{laptop_id}")
def activate_scoped(industry: str, laptop_id: str, payload: ActivationRequest):
    """Lab-laptop endpoint — writes to industries/{industry}_{laptop_id}.
    Multiple booth attendees on the same industry don't overwrite each other."""
    return _do_activate(industry, laptop_id, payload)


@app.post("/reset/{industry}")
def reset(industry: str):
    """Dev-flow reset — clears industries/{industry}."""
    _validate_industry(industry)
    db.collection("industries").document(industry).delete()
    return {"success": True, "message": f"Reset {industry} tab"}


@app.post("/reset/{industry}/{laptop_id}")
def reset_scoped(industry: str, laptop_id: str):
    """Lab-laptop reset — clears industries/{industry}_{laptop_id} only."""
    _validate_industry(industry)
    _validate_laptop_id(laptop_id)
    db.collection("industries").document(_doc_id(industry, laptop_id)).delete()
    return {"success": True, "message": f"Reset {industry} tab (laptop {laptop_id})"}


@app.post("/reset-all")
def reset_all():
    """Clear all activation data — both dev-flow and per-laptop docs.

    Iterates Firestore to find all docs whose id is either a bare industry
    name or starts with `{industry}_`, then deletes each. This covers both
    legacy dev-flow data and any per-laptop namespaces accumulated during
    booth sessions.
    """
    deleted = 0
    for doc in db.collection("industries").stream():
        doc_id = doc.id
        if doc_id in VALID_INDUSTRIES or any(doc_id.startswith(f"{ind}_") for ind in VALID_INDUSTRIES):
            doc.reference.delete()
            deleted += 1
    return {"success": True, "message": f"All industry tabs reset ({deleted} docs)"}
