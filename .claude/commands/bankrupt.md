---
description: "Record a debtor's bankruptcy. Every open account of theirs goes on hold and arrangements end."
---

# bankrupt

Record a debtor's bankruptcy. Every open account of theirs goes on hold and arrangements end.

Run `node scripts/collections.mjs bankrupt <ref> [--date=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Next: a proof of debt to the trustee, prepared by a person outside this system.
