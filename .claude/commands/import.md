---
description: "Bring a Collect! debtor list (printed to a comma-separated file) into a client. Dry run first."
---

# import

Bring a Collect! debtor list (printed to a comma-separated file) into a client. Dry run first.

Run `node scripts/collections.mjs import collect <file.csv> --client=<code> [--map=<column-map.json>] --actor="<name>" --dry-run`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Follow docs/replace-collect.md. Run with --dry-run, show the counts, then run again without it once the operator agrees. A bad or conflicting row stops the whole import.
