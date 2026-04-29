# Step 4 — Educational Context: dbt Transformation

Share these blocks before, during, and after dbt runs.

**Block 1** (before running dbt):
dbt transforms raw data in your data and AI platform using SQL and software engineering best practices: version control, testing, documentation, and lineage. It doesn't extract or load data — Fivetran handles that. dbt handles the T in ELT. Fivetran offers multiple dbt transformation options: **Quickstarts** for no-code transformations, **dbt Core** for full SQL control with Fivetran-managed orchestration, and **dbt Platform** integration for teams already using dbt Platform. Together, Fivetran and dbt form a complete, automated data pipeline.

**dbt Run Cache** is a Fivetran plugin for dbt Core that fingerprints your models and source state in a cloud-managed cache so only the parts of your project that have actually changed get executed — everything else is a NO-OP. The result is dramatically **lower warehouse compute spend** and **faster feedback loops**, with **no migration** required: a pip install, a login, and you keep running dbt run exactly as you do today.

**Block 2** (while dbt runs):
We're building three dbt layers. Staging cleans the raw source data — casting text dates to proper date types, rounding decimals. The mart layer adds business logic — computed risk scores, age group buckets, at-risk flags. And the **semantic** view adds rich **metadata** comments to every column. Those comments are what makes the AI agent smart — it reads them to understand what each metric means.

**Block 3** (after dbt run, before dbt test):
Now let me run the tests. **dbt tests** run AFTER dbt run — not before. Tests validate the built objects in Snowflake by querying the actual views and tables to check constraints like uniqueness and not-null. The objects have to exist before you can test them. This is dbt's "trust but verify" approach.

**Block 4** (after dbt test):
In production, Fivetran orchestrates dbt transformations automatically — every time a sync completes, Fivetran triggers the dbt run. The entire pipeline from source change to transformed, tested data is event-driven with zero human intervention. Source → Move & Manage → Transform — fully automated.
