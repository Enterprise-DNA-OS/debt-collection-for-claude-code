---
description: "Add collection costs or interest to an account. Refuses unless the client's agreement allows it, and never on a bankrupt debtor."
---

# add-fee

Add collection costs or interest to an account. Refuses unless the client's agreement allows it, and never on a bankrupt debtor.

Run `node scripts/collections.mjs add-fee <ref> --amount=<amount> [--kind=fee|interest] --reason="<what and why>" --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Only costs the debtor is legally liable for. Ask if unsure.
