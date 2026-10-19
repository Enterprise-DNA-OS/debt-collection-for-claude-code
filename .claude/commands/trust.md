---
description: "Money held in trust for each client and not yet remitted, commission and GST owed, the net due, and whether it is past the client's remittance terms."
---

# trust

Money held in trust for each client and not yet remitted, commission and GST owed, the net due, and whether it is past the client's remittance terms.

Run `node scripts/collections.mjs trust`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Flag every "overdue" row first: that money belongs to the client.
