# **Snowflake Summit 2026 Hands-On Lab: Concept Document**

## **Lab Title Options**

| Option | Title | Positioning |
| :---- | :---- | :---- |
| A | **From Connectors to Data Agents in 20 Minutes** | Strategic framing ("Connectors → Data Agents"). Clear, bold, time-anchored. |
| B | **Build a Complete AI Data Pipeline Without Opening a Single UI** | Zero-UI differentiator. Curiosity-driven. |
| C | **One Skill, One Pipeline: Fivetran \+ Snowflake Cortex Code** | Skill-as-orchestrator concept. Partnership positioning. |
| D | **The 20-Minute Data Agent: Source to Intelligence with Fivetran & Cortex Code** | Time constraint \+ outcome. Action-oriented. |
| E | **Open Data Infrastructure in Action: Move, Transform, Agent, Activate** | ODI messaging. Maps to Fivetran's four product themes. |
| F | **AI-Powered Data Pipelines: From PostgreSQL to Cortex Agent in 20 Minutes** | Specific and technical. Appeals to data engineers and architects. |

---

## **Executive Summary**

Fivetran will deliver a **20-minute instructor-led hands-on lab** at the Fivetran booth during Snowflake Summit 2026 (June 2-5). Participants walk up, sit down at one of **6 pre-configured laptops**, and experience the complete Fivetran data lifecycle from source data exploration to a live AI agent answering business questions **without ever opening a traditional SaaS UI**. Everything is orchestrated by an AI Skill running inside Snowflake Cortex Code.

This lab brings the **"Connectors → Data Agents"** vision to life in 20 minutes. It demonstrates Fivetran's end-to-end value within the context of **Open Data Infrastructure (ODI)** and showcases the power of **Snowflake Cortex Code** with a purpose-built Skill as the orchestrator for the entire experience.

The lab is designed to be **repurposed for Data and AI Summit (DAIS)** in the third week of June with the same format and minimal adaptation.

---

## **What Participants Experience**

A participant walks up to the Fivetran booth, sits down at a laptop, and is guided through six seamless steps all within Snowflake Cortex Code:

### **Step 1: Discover: Explore Source Data (1-2 min)**

The Skill connects to a Google Cloud PostgreSQL database containing a retail e-commerce dataset (orders, customers, products). It shows the schema, sample rows, and row counts. The instructor explains: *"This is a typical operational database the kind of data every company has but struggles to make actionable."*

### **Step 2: Move: Fivetran Extracts and Loads via MDLS (2-3 min)**

The Skill creates a Fivetran PostgreSQL connector and syncs data to an **S3 Managed Data Lake Service (MDLS) destination** in Apache Iceberg format. While the sync runs (\~60-90 seconds), the Skill outlines the MDLS architecture: data lands in S3 as open Iceberg tables, automatically cataloged in **Snowflake Horizon Catalog** via Polaris, and immediately queryable with Snowflake compute. The instructor explains: *"Fivetran just moved data from PostgreSQL to S3 in open format, and Snowflake can already see it. No UI. Just one command. \<Can also comment on overall Fivetran value \- automated, reliable, secure, simple, with an incredible REST API as well”\>*

### **Step 3: Transform: dbt Models \+ Semantic View (2-3 min)**

The Skill triggers **Fivetran dbt Transformations** to run a pre-built dbt project that transforms raw data through bronze, silver, and gold layers producing analytics-ready views like customer\_orders\_summary, product\_performance, and revenue\_by\_region. The Skill then creates a **Snowflake Semantic View** that defines business metrics (revenue, order count, average order value) and dimensions (region, channel, customer segment). The instructor explains: *"dbt transformed raw data into business-ready views, and the semantic view is the bridge between your data and AI, it tells the agent what the numbers mean."*

### **Step 4: Agent: Create a Cortex Agent (1-2 min)**

The Skill creates a **Snowflake Cortex Agent** via REST API, configured with a Cortex Analyst tool that points to the semantic view. The agent gets a name, description, icon, response instructions, and sample questions all tuned for the retail dataset. The instructor explains: *"You now have a Cortex AI agent that understands your retail data. It can answer business questions in natural language."*

### **Step 5: Ask: Interact with Your Agent (3-5 min)**

This is the **"wow" moment**. The Skill asks two pre-crafted questions — *"What are our top 5 product categories by revenue this quarter?"* and *"Which customers should we target for a re-engagement campaign?"* and displays the agent's answers. Then the participant asks their own questions in natural language. The agent generates SQL behind the scenes and returns business insights. Executives, data engineers, and salespeople alike can interact naturally with the data.

### **Step 6: Activate: Push Insights Back to Your App (2 min)**

The Skill creates a **Fivetran Activation** that pushes a "top customers for re-engagement" view back to a **Firebase database**. A pre-deployed **React application** updates in real time as the activation writes — the participant sees recommendations appear live in the app. The instructor wraps: *"Full circle. Source → pipeline → AI → back to your app. All orchestrated by one Skill. This is what Fivetran \+ Snowflake \+ AI looks like in production."*

**Total experience: \~20 minutes.** No SaaS UI opened and no code written with one Skill orchestrating everything.

---

## **Key Technologies Showcased**

| Fivetran Theme | Technology | Lab Step |
| :---- | :---- | :---- |
| **Move** (Extract & Load) | Fivetran PostgreSQL Connector \+ Connector SDK Builder | Step 2 |
| **Manage** (MDLS) | Fivetran Managed Data Lake Service → S3 Iceberg \+ Snowflake Horizon Catalog | Step 2 |
| **Transform** | Fivetran dbt Transformations (bronze → silver → gold) \+ Snowflake Semantic Views | Step 3 |
| **Activate** (Move Again) | Fivetran Activation → Firebase/React business app | Step 6 |
| **AI Leverage** | Snowflake Cortex Agent \+ Cortex Analyst \+ Cortex Code Skills all made possible by Fivetran and an ODI approach | Steps 4-5 |

### **Additional Technologies**

* **Snowflake Cortex Code** — AI coding environment (the participant's entire interface)  
* **Cortex Code Skills** — Pre-built AI Skills (Fivetran-themed) as the lab orchestrator  
* **Open Data Infrastructure (ODI)** — Apache Iceberg, Polaris Catalog, open table formats with plug-in Snowflake compute  
* **React \+ Firebase** — Real-time activation target application

---

## **Strategic Alignment**

### **Fivetran's "Connectors → Data Agents" Vision**

This lab is a live, interactive proof of the "Connectors → Data Agents" flywheel. Every Fivetran pipeline stage drives Snowflake Cortex Code consumption: more connectors → more data → more Cortex Code value → more Fivetran adoption.

### **Snowflake FY27 GTM Priorities**

The lab directly maps to Snowflake's three FY27 solution plays, which will appeal to Snowflake sellers:

1. **Modernize the Data Estate** → Step 2 (Move via MDLS)  
2. **Make Data AI Ready** → Step 3 (Transform with dbt \+ Semantic Views)  
3. **Build Enterprise Data Agents** → Steps 4-5 (Cortex Agent creation \+ interaction)

### **Snowflake's "Show, Don't Tell" Mandate**

Every Snowflake SE engagement must demonstrate a downstream AI use case built with Cortex Code. This lab gives Fivetran a turnkey demonstration that Snowflake SEs can reference: *"This is what it looks like when Fivetran powers a Cortex Agent."*

### **Open Data Infrastructure (ODI)**

The lab demonstrates ODI in action end to end: move, manage with data moving into open formats (Iceberg), and cataloged in open governance (Polaris/Horizon), and compute-agnostic along with transform (dbt models, views, semantic views) and move again (activate). The same data could be queried by any Iceberg-compatible engine. Predictability and standardization with openness and optionality.

---

## **Lab Format & Logistics**

| Aspect | Detail |
| :---- | :---- |
| **Duration** | 20 minutes (30 min max with Q\&A) |
| **Format** | Instructor-led, walk-up, no registration required |
| **Laptops** | 6 pre-configured laptops at the Fivetran booth |
| **Requirements** | Chrome browser \+ Cortex Code (terminal or VS Code). Nothing else. |
| **Audience** | All levels — data engineers, executives, managers, salespeople |
| **Instructor** | Fivetran PSE team (1 instructor per session with at least one roving assistant) |
| **Sessions/day** | \~2-3 per hour \= 30-40 sessions across 3 days |
| **Reset time** | \<5 minutes between sessions (automated reset script using a Cortex Code skill) |

### **What Participants Do NOT Need**

* Their own laptop (6 provided)  
* A Fivetran account  
* A Snowflake account  
* Any coding knowledge  
* Any prior experience with data pipelines

### **Participant Takeaway**

* QR code to the Skill on GitHub (they can run it themselves)  
* One-pager summarizing the architecture they just built  
* Link to Fivetran free trial

---

## **Lab Reset: Instructor Skill**

Between sessions, the instructor simply says **"reset the lab"** in Cortex Code and a dedicated **Reset Skill** handles everything automatically. No manual cleanup, no scripts to remember, no UI navigation.

### **What the Reset Skill Does (Tiered Teardown \+ Rebuild)**

**Tier 1 — Fivetran Cleanup:**

* Deletes the Fivetran connectors created during the session (REST API)  
* Removes the Fivetran Activation syncs  
* Verifies they are fully removed  
* Deletes references from the Fivetran-hosted Polaris catalog  
* Deletes all data files and folders beyond the default destination folder in S3  
* Verifies the catalog is clean and files are removed

**Tier 2 — Snowflake Cleanup:**

* Drops the Cortex Agents (REST API)  
* Drops the Semantic Views  
* Drops the dbt-created views (gold, silver, bronze)  
* Drops any Iceberg table references from the session

**Tier 3 — Target App Reset:**

* Clears the Firebase database records written by the activations  
* Resets the React app to its clean "waiting for data" state

**Tier 4 — Preflight Verification:**

* Confirms the Google Cloud PostgreSQL source data is intact and accessible  
* Confirms the MDLS S3 destination exists and is ready  
* Confirms the Snowflake External Volume \+ Catalog Integration is healthy  
* Confirms the Fivetran dbt Transformations project is connected and ready  
* Confirms the React \+ Firebase app is running  
* Reports **READY** or flags any issues to the instructor

The Reset Skill borrows patterns from the existing fivetran-snowflake-hol-builder MCP server (tiered cleanup, confirmed=False preview, graceful error handling) adapted as a focused Cortex Code Skill for this specific lab.

**Target reset time: \<5 minutes** including verification. The instructor invokes it, watches the confirmation output, and seats the next participant.

---

## **Risk-Free Design**

**Every participant completes the lab regardless of skill level or technical issues.**

The lab uses a **"pre-built everything, skill-orchestrated"** architecture:

* Every API payload, SQL statement, and configuration is pre-determined and embedded in the Skill  
* The Skill executes pre-built artifacts it does not discover, generate, or design anything on the fly  
* Every step has a pre-existing fallback (if the live sync fails, pre-synced data is ready)  
* No error messages are shown to participants  
* Instructors can skip ahead to any step if running behind  
* The Reset Skill runs preflight verification before each session any issues are flagged before the participant sits down

---

## **DAIS Repurposing (Data and AI Summit: Third Week of June)**

The lab is designed for **minimal-effort repurposing** to Databricks DAIS:

| Component | Snowflake Summit | DAIS |
| :---- | :---- | :---- |
| Orchestrator | Snowflake Cortex Code | Genie Code |
| Compute | Snowflake | Databricks |
| Semantic Layer | Snowflake Semantic View | Databricks AI/BI |
| Agent | Cortex Agent | Mosaic AI Agent |
| Catalog | Horizon Catalog (Polaris) | Unity Catalog |
| Steps 1, 2, 6 | Identical | Identical (Fivetran API is platform-agnostic) |

The **"one skill, two platforms"** story itself reinforces Fivetran's platform neutrality and ODI messaging: *"The exact same AI skill that built this pipeline at Snowflake Summit can build it on Databricks today."*

---

## **Timeline**

### **March 2026**

| Date | Milestone |
| :---- | :---- |
| **March 27** | Concept document and abstract sent to Marketing |

### **April 2026**

| Date | Milestone |
| :---- | :---- |
| **April 1-15** | Build Snowflake lab (David and Kelly): Skills, pre-built artifacts, PostgreSQL source, MDLS destination, dbt project, Cortex Agent spec, Activation config, React+Firebase app |
| **April 15** | **Laptops delivered**: 6 laptops from Fivetran IT shipped to Kelly in Houston (Kelly carries 3, David Hrncir carries 3\) |
| **April 15-30** | Test and iterate Snowflake lab end-to-end. Begin Databricks (DAIS) build including Genie Code skills, Mosaic AI Agent, Unity Catalog, AI/BI semantic layer |

### **May 2026**

| Date | Milestone |
| :---- | :---- |
| **May 1-9** | Complete Snowflake lab testing and hardening. Complete Databricks build and testing |
| **May 12** | **Marketing Review \#1**: Demo working Snowflake lab to Marketing. Review booth signage, one-pager, QR code materials, and promotional copy |
| **May 12-16** | **Recruit and onboard 2 additional PSEs/SEs for lab delivery** (David Millman confirmed for Snowflake Summit, identify 1+ for Snowflake Summit; identify 2+ for DAIS) |
| **May 19-23** | **Instructor training and dry runs**: Train the lab instructors on both labs. Run full dry-run sessions on pre-configured laptops. Troubleshoot edge cases. Finalize instructor talking points and timing |
| **May 26** | **Marketing Review \#2**: Final walkthrough with Marketing. Confirm all collateral is printed/ready. Last chance for content or messaging adjustments |
| **May 27-30** | Final hardening, pack laptops, ship any booth materials |

### **June 2026**

| Date | Milestone |
| :---- | :---- |
| **June 2-5** | **Snowflake Summit 2026** — Deliver Snowflake lab at Fivetran booth (Kelly \+ David Hrncir \+ David Millman) |
| **June 9-13** | **Post-Summit retro.** Apply lessons learned to DAIS lab **Marketing Review:** Final walkthrough with Marketing. Confirm all collateral is printed/ready. Last chance for content or messaging adjustments. |
| **June 16-19** | **Data and AI Summit (DAIS)** — Deliver Databricks lab at Fivetran booth |

### **Staffing Plan**

* **Snowflake Summit**: Kelly Kohlleffel, David Hrncir, David Millman (+ 1 TBD)  
* **DAIS**: Kelly Kohlleffel, David Hrncir (+ 2 TBD — recruit from PSE/SE team)  
* Each session needs 1 instructor \+ at least 1-2 roving assistants for 6 laptops

### **Logistics**

* **Laptops**: 6 laptops requested from Fivetran IT — must arrive in Houston by **April 15**  
* **Laptop split**: Kelly (3) \+ David Hrncir (3) for travel to both events  
* **Laptop config**: Chrome browser, Cortex Code CLI (or VS Code with Cortex Code extension), pre-loaded Skills — nothing else needed

---

## **Why This Lab Matters**

1. **No other vendor can tell this story end-to-end.** Source → Extract & Load → Manage (MDLS) → Transform (dbt) → AI Agent → Move/Activate — all in 20 minutes, all through AI.  
2. **It proves "Connectors → Data Agents" is real**, not a slide deck. Participants build it themselves and interact with the result.  
3. **It positions Fivetran as essential to Snowflake's AI strategy.** Every Cortex Agent needs data. Fivetran is how that data gets there and how it gets activated afterward.  
4. **It demonstrates AI leverage through Skills.** The Skill doesn't just build a pipeline it teaches what each component does. Participants leave understanding the full data lifecycle AND the power of AI-assisted development.  
5. **It's portable.** Same lab, same skill, same 20 minutes at Snowflake Summit, DAIS, or any future event such as Big Data London. Build once, run everywhere.

---

*Prepared by: Kelly Kohlleffel and David Hrncir, Partner Sales Engineering, Fivetran* *Date: March 2026* *Status: Concept — for Marketing review*

