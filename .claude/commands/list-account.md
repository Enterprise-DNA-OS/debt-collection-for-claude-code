---
description: "List a new account for a client: the debtor (found by name and state or created), the amount, the date of default the limitation period runs from, and the client's reference."
---

# list-account

List a new account for a client: the debtor (found by name and state or created), the amount, the date of default the limitation period runs from, and the client's reference.

Run `node scripts/collections.mjs list-account --client=<code> --debtor="<name>" --state=<NSW|VIC|QLD|SA|WA|TAS|NT|ACT|NZ> --amount=<amount> --accrued=<YYYY-MM-DD> [--client-ref="<ref>"] [--description="<what>"] [--phone=] [--email=] [--address=] [--kind=individual|business] [--collector=<name>] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Never guess the default date: ask the client.
