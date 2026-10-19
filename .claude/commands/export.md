---
description: "Export every record to one JSON file the business owns."
---

# export

Export every record to one JSON file the business owns.

Run `node scripts/collections.mjs export [--out=<file.json>]`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

