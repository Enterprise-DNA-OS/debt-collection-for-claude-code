---
description: "Record that a debtor is in financial hardship, with a note."
---

# hardship

Record that a debtor is in financial hardship, with a note.

Run `node scripts/collections.mjs hardship <ref> --note="<what they said>" [--date=] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Offer a realistic arrangement; no fees after this date.
