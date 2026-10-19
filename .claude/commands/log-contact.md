---
description: "Record a contact or attempt after it happened: channel, outcome, who it was with, and the debtor's local time. The record is kept even when it broke a rule, and the finding is shown."
---

# log-contact

Record a contact or attempt after it happened: channel, outcome, who it was with, and the debtor's local time. The record is kept even when it broke a rule, and the finding is shown.

Run `node scripts/collections.mjs log-contact <ref> --channel=<phone|sms|email|letter|visit|workplace> [--outcome=contact|attempt|misdirected] [--direction=out|in] [--party=debtor|representative|third_party] [--at="YYYY-MM-DD HH:MM"] [--note="<what was said>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

An unanswered call with no message is an attempt, not a contact (RG 96 part 2 s 3). If findings come back, tell the operator plainly.
