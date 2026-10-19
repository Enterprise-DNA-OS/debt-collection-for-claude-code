---
description: "Today's calling list: accounts that can be worked now, broken arrangements first, then new listings, then the longest since an attempt. Leaves out anyone over the contact limit, bankrupt, disputed, asked for no contact, or keeping an arrangement."
---

# worklist

Today's calling list: accounts that can be worked now, broken arrangements first, then new listings, then the longest since an attempt. Leaves out anyone over the contact limit, bankrupt, disputed, asked for no contact, or keeping an arrangement.

Run `node scripts/collections.mjs worklist [--collector=<name>]`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Show the "now" column: "wait" means the debtor's local time or a holiday rules out a call right now. For a represented debtor, contact the representative.
