# Step 3 — Educational Context: Fivetran Sync

Share these blocks ONE at a time, pausing naturally between them, while the attendee waits for the sync to complete.

**Block 1** (immediately after trigger):
Fivetran **detects schema changes automatically** — new columns, new tables, renames. After this initial load, every subsequent sync is incremental — only changed rows move. For a 750-row table this takes seconds. For tables with millions of rows, Fivetran still only moves the delta. Sync frequency is configurable from every 1 minute to every 24 hours depending on your downstream data freshness requirements.

**Block 2** (~15 seconds later):
While the data moves, Fivetran is also managing it. Data is encrypted in transit and at rest using AES-256 encryption. Credentials are stored in a dedicated secrets store — never in application databases. Fivetran automatically handles schema drift detection, column hashing for sensitive fields, and soft deletes — all without any configuration. Today we're using a traditional Snowflake destination, but Fivetran also offers a **Managed Data Lake Service** with fully managed open-format **Iceberg** tables — same pipeline, open table format.

**Block 3** (~30 seconds later):
Everything we just did — connector creation, cert approval, table selection, sync trigger — runs through the Fivetran REST API. That's how Fivetran Code works, it's how **MCP servers** integrate with Fivetran, and it's how you can programmatically manage your entire data infrastructure. The Fivetran UI is equally powerful and fully featured — today we're showing the programmatic path to highlight the flexibility. Terraform provider and CI/CD pipeline integration available too.

**Block 4** (~45 seconds later):
In production, Fivetran webhook notifications fire the moment a sync completes — triggering your dbt transformation automatically. Zero human intervention. Fivetran also supports **hybrid deployment** — run the data pipeline in Fivetran's SaaS infrastructure like we're doing here, or deploy within your own cloud environment for data residency requirements.

**Block 5** (~60 seconds later):
Fivetran supports **750+ connectors** out of the box — databases, SaaS applications, cloud storage, webhooks. Each connector is fully managed: Fivetran handles authentication, rate limiting, pagination, schema management, and automatic retries.

**Block 6** (~75 seconds later):
For sources not in the catalog, the **Fivetran Connector SDK** lets you build custom connectors in Python that run in Fivetran's managed infrastructure — no Lambda, no hosting, no timeouts. You can build a production-grade custom connector with the Fivetran Connector SDK using an AI Assistant and a Fivetran Connector Builder Skill or similar — be sure and keep an eye out for that custom build capability showing up in the Fivetran UI as well. The SDK supports incremental syncing, soft deletes, and private networking — same enterprise-grade reliability as the native connectors.

After sharing all blocks (~2 minutes total), say:
The sync should be complete soon (within a few minutes). Say **"check"** when you're ready and I'll verify the data landed in Snowflake.
