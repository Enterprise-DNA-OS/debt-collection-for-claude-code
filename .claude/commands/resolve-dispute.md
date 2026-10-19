---
description: "Resolve the open dispute: upheld (the debtor is right: adjust or return) or rejected (collection can resume after writing with the evidence)."
---

# resolve-dispute

Resolve the open dispute: upheld (the debtor is right: adjust or return) or rejected (collection can resume after writing with the evidence).

Run `node scripts/collections.mjs resolve-dispute <ref> --outcome=upheld|rejected --resolution="<what the evidence showed>" --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

The resolution is the operator's words.
