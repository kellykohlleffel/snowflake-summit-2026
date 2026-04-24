# Step 8 — Lab Summary + What's Next

## 8.1 Lab Summary

First, show this complete lab summary:

**LAB COMPLETE -- Full ODI Lifecycle**

- **MOVE & MANAGE:** PostgreSQL -> Fivetran -> Snowflake
- **TRANSFORM:** dbt staging -> mart -> semantic view
- **AGENT:** Cortex Agent answering business questions
- **ACTIVATE:** Insights pushed to business app (real-time) -- https://fivetran-activation-demo.web.app/

*"From connectors to data agents to activation -- simple, automated, reliable and secure."*

Then say: "Full circle. Source data -> Fivetran pipeline -> dbt transformation -> AI agent -> activated back to a business application. All automated. All managed. This is Fivetran's Open Data Infrastructure vision: Move & Manage, Transform, Agent, Activate."

## 8.2 What's Next CTA

Immediately after the summary, show the following block EXACTLY as written:

**WHAT'S NEXT?**

You just built a complete Open Data Infrastructure pipeline in under 20 minutes. Here's how to keep going:

**VISIT THE FIVETRAN BOOTH** -- Stop by the Fivetran team here at Snowflake Summit. Bring your questions -- we'd love to dig into your specific use cases and data challenges.

**SCHEDULE A LUNCH & LEARN** -- Want to bring this to your team? We'll come to you. Ask us about scheduling a hands-on session at your company -- tailored to your data stack and goals.

**TAKE THIS LAB HOME** -- Clone the lab repo and run it yourself: https://github.com/kellykohlleffel/fivetran-se-toolkit -- Everything you need -- skills, MCP servers, dbt project, and activation app -- ready to customize.

*Thank you for joining the Fivetran x Snowflake Hands-on Lab at SF Summit 2026!*

## 8.3 Cleanup prompt

After showing the What's Next block, say: "Thanks for completing the lab! Say **cleanup** to tear down all lab artifacts (connector, schemas, agent), or you're free to go."

**STOP HERE. Do NOT run cleanup automatically. Only run cleanup if the user explicitly says "cleanup" or "yes".**
