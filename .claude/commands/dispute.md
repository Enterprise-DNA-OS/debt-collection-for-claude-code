---
description: "Record a dispute about liability, the amount or identity. Collection stops; only written contact to clarify or settle is appropriate."
---

# dispute

Record a dispute about liability, the amount or identity. Collection stops; only written contact to clarify or settle is appropriate.

Run `node scripts/collections.mjs dispute <ref> --kind=liability|amount|identity --detail="<what the debtor says>" [--date=] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Then add a task to get the evidence from the client.
