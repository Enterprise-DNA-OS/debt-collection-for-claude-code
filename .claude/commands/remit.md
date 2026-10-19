---
description: "Settle a client's trust money up to a date: trust payments less commission (on trust and direct payments) and GST on the commission. Records the remittance and its bank reference."
---

# remit

Settle a client's trust money up to a date: trust payments less commission (on trust and direct payments) and GST on the commission. Records the remittance and its bank reference.

Run `node scripts/collections.mjs remit <client code> --reference="<bank reference>" [--to=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the account or client by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<the operator's name>"`. Read the account with `history` first, then say back what will change before running it. Nothing here sends, pays or contacts anyone outside this database.

Recording a remittance moves no money: pay it from the trust account, then record the reference. A negative net means the client owes commission: invoice it.
