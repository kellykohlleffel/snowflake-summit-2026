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


@app.post("/activate/{industry}")
def activate(industry: str, payload: ActivationRequest):
    """
    Push activation data for an industry tab.

    Writes to Firestore: industries/{industry}
    The React app subscribes to this document and updates in real-time.
    """
    valid_industries = ["pharma", "retail", "hed", "financial", "agriculture", "healthcare", "supply_chain"]
    if industry not in valid_industries:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid industry '{industry}'. Valid: {valid_industries}",
        )

    if not payload.records:
        raise HTTPException(status_code=400, detail="No records provided")

    doc_data = {
        "title": payload.title,
        "source": payload.source,
        "records": payload.records,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }

    doc_ref = db.collection("industries").document(industry)
    doc_ref.set(doc_data)

    return {
        "success": True,
        "industry": industry,
        "records_count": len(payload.records),
        "activated_at": doc_data["activated_at"],
        "message": f"Activated {len(payload.records)} records to {industry} tab",
    }


@app.post("/reset/{industry}")
def reset(industry: str):
    """Clear activation data for an industry tab (for demo reset)."""
    doc_ref = db.collection("industries").document(industry)
    doc_ref.delete()
    return {"success": True, "message": f"Reset {industry} tab"}


@app.post("/reset-all")
def reset_all():
    """Clear all activation data (full demo reset)."""
    valid_industries = ["pharma", "retail", "hed", "financial", "agriculture", "healthcare", "supply_chain"]
    for industry in valid_industries:
        db.collection("industries").document(industry).delete()
    return {"success": True, "message": "All industry tabs reset"}
