---
description: "Record a payment: into the trust account, or made straight to the client. Commission is worked out from the client's rate. Paid in full closes the arrangement and marks the account paid."
---

# payment

Record a payment: into the trust account, or made straight to the client. Commission is worked out from the client's rate. Paid in full closes the arrangement and marks the account paid.

Run `node scripts/collections.mjs payment <ref> --amount=<amount> [--method=trust|direct] [--date=<YYYY-MM-DD>] [--reference="<bank ref>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.
