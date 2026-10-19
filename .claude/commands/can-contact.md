---
description: "Before a call, text, email or visit: can this account be contacted now, by this channel? Checks the hours, holidays, the weekly and monthly limits, representatives, bankruptcy, disputes, written requests and arrangements, with the rule for each."
---

# can-contact

Before a call, text, email or visit: can this account be contacted now, by this channel? Checks the hours, holidays, the weekly and monthly limits, representatives, bankruptcy, disputes, written requests and arrangements, with the rule for each.

Run `node scripts/collections.mjs can-contact <ref or debtor> [--channel=phone|sms|email|letter|visit|workplace] [--party=debtor|representative] [--at="YYYY-MM-DD HH:MM"]`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

`--at` is the debtor's local time; leave it out for now. Answer yes or no first, then the reasons.
