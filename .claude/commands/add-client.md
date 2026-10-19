---
description: "Add a client we collect for: code, name, AU or NZ, commission percentage, remittance terms in days, and whether their agreement allows fees to be added."
---

# add-client

Add a client we collect for: code, name, AU or NZ, commission percentage, remittance terms in days, and whether their agreement allows fees to be added.

Run `node scripts/collections.mjs add-client --code=<CODE> --name="<name>" [--jurisdiction=AU|NZ] [--commission=<pct>] [--remit-days=<n>] [--fees-allowed] [--contact="<email>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.
