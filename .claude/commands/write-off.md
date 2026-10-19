---
description: "Write off part or all of a balance, with the reason. Written off to nothing closes the account."
---

# write-off

Write off part or all of a balance, with the reason. Written off to nothing closes the account.

Run `node scripts/collections.mjs write-off <ref> --amount=<amount> --reason="<why>" --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.
