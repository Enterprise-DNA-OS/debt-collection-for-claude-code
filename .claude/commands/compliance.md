---
description: "Check every contact and account against the rules in docs/compliance.md: contact hours, public holidays, the 3-a-week and 10-a-month limits, represented, bankrupt and disputed debtors, written requests for no contact, statute-barred debts, trust money past terms and fees after hardship."
---

# compliance

Check every contact and account against the rules in docs/compliance.md: contact hours, public holidays, the 3-a-week and 10-a-month limits, represented, bankrupt and disputed debtors, written requests for no contact, statute-barred debts, trust money past terms and fees after hardship.

Run `node scripts/collections.mjs compliance`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Breaches first, each with its source. For each, say what to do now (stop contact, return the account, write to the representative) and never argue the rule. If a rule looks out of date, say so and stop.
