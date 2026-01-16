<!-- AICODE-NOTE: DECISION/0001 adopt navigation-driven onboarding ref: AGENTS.md README.md -->

# DECISION 0001 — Navigation-first onboarding

**Status:** Accepted

**Context:** The repository lacks a README and the required documentation layers, making on-boarding confusing. The AGENTS instructions mandate the AICODE navigation system and a living status/context.

**Decision:** Create README, docs/context.md, docs/status.md, and plan-template anchoring the required navigation scheme before moving on to actual UI/application code.

**Consequences:** Contributors now have a documented entry path (`README.md`) plus living context/status files. Future changes must keep the anchors discoverable via `rg -n "AICODE-"`, and docs/decisions will chronicle further trade-offs.
