---
description: "Active promises and payment plans: what was due, what has been paid since, the next date, and whether each is on track or broken."
---

# arrangements

Active promises and payment plans: what was due, what has been paid since, the next date, and whether each is on track or broken.

Run `node scripts/collections.mjs arrangements`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Broken first. A broken arrangement is a reason to contact; an on-track one is not (RG 96 part 2 s 15).
