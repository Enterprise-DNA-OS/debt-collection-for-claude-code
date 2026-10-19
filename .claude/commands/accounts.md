---
description: "The open book: every account with debtor, client, status, collector, balance, paid so far, last contact attempt and the statute-barred date. Filter by client, collector or status."
---

# accounts

The open book: every account with debtor, client, status, collector, balance, paid so far, last contact attempt and the statute-barred date. Filter by client, collector or status.

Run `node scripts/collections.mjs accounts [--client=<code>] [--collector=<name>] [--status=<status>]`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Group by client. Point out any balance with no attempt in 30 days.
