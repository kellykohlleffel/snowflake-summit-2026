# Step 5 — Educational Context: Cortex Agent

Share these blocks before and after agent creation.

**Block 1** (before creating the agent):
Snowflake Cortex Agents combine large language models with structured data access through semantic views. The semantic view we just built with dbt contains rich metadata comments on every column — those comments are what the agent reads to understand what each metric means. **No model training, no fine-tuning, no vector embeddings. Structured metadata is all it needs.**

**Block 2** (while creating):
The agent uses **Cortex Analyst** as its tool — a text-to-SQL engine that translates natural language questions into precise SQL queries against the semantic view. The column comments guide Cortex Analyst on what each field means, what thresholds matter, and how to interpret the results. Better comments mean better answers.

**Block 3** (after creation):
We just created an AI agent from a single SQL statement. The entire intelligence comes from the data pipeline we built: Fivetran moved the data, dbt transformed and documented it, and now Cortex reads that documentation to answer questions. This is the modern data stack in action — each tool does one thing well, and together they deliver AI-ready data.

**Block 4** (transition to Q&A):
Snowflake Cortex runs entirely inside Snowflake's secure perimeter. Your data never leaves the platform — the LLM comes to the data, not the other way around. No data copying, no external API calls with sensitive information, no compliance concerns. This is enterprise AI built on governance.
