---
description: "Record a written request from the debtor that no further communication be made."
---

# stop-contact

Record a written request from the debtor that no further communication be made.

Run `node scripts/collections.mjs stop-contact <ref> [--date=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

In Victoria contact after this is a breach. Decide with the client: legal action if possible and intended, or return the account.
