# CLI reference

One CLI: `node scripts/collections.mjs <command> [arguments] [--key=value ...]`. Human tables by default; `--json` prints every field. Every write needs `--actor`. Dates are `YYYY-MM-DD`; contact times are the debtor's local time as `YYYY-MM-DD HH:MM`. Amounts accept `1234.56`, `1,234.56` or `$1,234.56`. Unknown options are rejected.

Accounts match by reference, debtor name, the client's reference or id; clients by code or name; tasks by their words within the account. Exact matches win; a unique partial match works; anything else lists the candidates and exits 1.

## accounts

The open book: every account with debtor, client, status, collector, balance, paid so far, last contact attempt and the statute-barred date. Filter by client, collector or status.

```bash
node scripts/collections.mjs accounts [--client=<code>] [--collector=<name>] [--status=<status>]
```

## acknowledge

Record a written acknowledgement of the debt. The limitation period starts again from its date.

```bash
node scripts/collections.mjs acknowledge <ref> --date=<YYYY-MM-DD> --actor="<name>"
```

## add-client

Add a client we collect for: code, name, AU or NZ, commission percentage, remittance terms in days, and whether their agreement allows fees to be added.

```bash
node scripts/collections.mjs add-client --code=<CODE> --name="<name>" [--jurisdiction=AU|NZ] [--commission=<pct>] [--remit-days=<n>] [--fees-allowed] [--contact="<email>"] --actor="<name>"
```

## add-fee

Add collection costs or interest to an account. Refuses unless the client's agreement allows it, and never on a bankrupt debtor.

```bash
node scripts/collections.mjs add-fee <ref> --amount=<amount> [--kind=fee|interest] --reason="<what and why>" --actor="<name>"
```

## add-task

Add a task to an account.

```bash
node scripts/collections.mjs add-task <ref> --title="<what>" [--owner=<name>] [--due=<YYYY-MM-DD>] --actor="<name>"
```

## arrange

Record a payment arrangement: an amount every week, fortnight or month for a number of instalments. Refuses more than is owed.

```bash
node scripts/collections.mjs arrange <ref> --amount=<amount> --every=week|fortnight|month --first=<YYYY-MM-DD> --instalments=<n> [--note=] --actor="<name>"
```

## arrangements

Active promises and payment plans: what was due, what has been paid since, the next date, and whether each is on track or broken.

```bash
node scripts/collections.mjs arrangements
```

## assign

Give an account to another collector.

```bash
node scripts/collections.mjs assign <ref> --collector=<name> --actor="<name>"
```

## attention

Show what needs a person today: broken arrangements, trust money held past a client's terms, debts about to become statute-barred, disputes waiting, promises due today, accounts never contacted, overdue tasks and quiet accounts.

```bash
node scripts/collections.mjs attention
```

## bankrupt

Record a debtor's bankruptcy. Every open account of theirs goes on hold and arrangements end.

```bash
node scripts/collections.mjs bankrupt <ref> [--date=<YYYY-MM-DD>] --actor="<name>"
```

## can-contact

Before a call, text, email or visit: can this account be contacted now, by this channel? Checks the hours, holidays, the weekly and monthly limits, representatives, bankruptcy, disputes, written requests and arrangements, with the rule for each.

```bash
node scripts/collections.mjs can-contact <ref or debtor> [--channel=phone|sms|email|letter|visit|workplace] [--party=debtor|representative] [--at="YYYY-MM-DD HH:MM"]
```

## cancel-arrangement

Cancel the active promise or arrangement, with the reason.

```bash
node scripts/collections.mjs cancel-arrangement <ref> --reason="<why>" --actor="<name>"
```

## clients

Every client: commission, remittance terms, whether fees may be added, open accounts, the book and what has been collected.

```bash
node scripts/collections.mjs clients
```

## close

Close an account with nothing owing.

```bash
node scripts/collections.mjs close <ref> --actor="<name>"
```

## compliance

Check every contact and account against the rules in docs/compliance.md: contact hours, public holidays, the 3-a-week and 10-a-month limits, represented, bankrupt and disputed debtors, written requests for no contact, statute-barred debts, trust money past terms and fees after hardship.

```bash
node scripts/collections.mjs compliance
```

## contacts

Every contact and attempt on one account in the debtor's local time, with any rule each one broke.

```bash
node scripts/collections.mjs contacts <ref or debtor>
```

## dispute

Record a dispute about liability, the amount or identity. Collection stops; only written contact to clarify or settle is appropriate.

```bash
node scripts/collections.mjs dispute <ref> --kind=liability|amount|identity --detail="<what the debtor says>" [--date=] --actor="<name>"
```

## disputes

Open disputes about liability, amount or identity, oldest first.

```bash
node scripts/collections.mjs disputes
```

## done

Mark an open task done.

```bash
node scripts/collections.mjs done <ref> "<task words>" --actor="<name>"
```

## draft-arrangement-letter

Draft the letter confirming an arrangement, with every payment date. Written to drafts/, never sent.

```bash
node scripts/collections.mjs draft-arrangement-letter <ref>
```

## draft-client-report

Draft a client's report: collected in 30 days, money in trust, every open account and the disputes we need their help with. Written to drafts/, never sent.

```bash
node scripts/collections.mjs draft-client-report <client code>
```

## draft-demand

Draft a letter asking for payment, addressed to the representative if there is one. Refuses for a bankrupt debtor, an open dispute or a request for no contact. A statute-barred debt gets a warning not to mention legal action. Written to drafts/, never sent.

```bash
node scripts/collections.mjs draft-demand <ref>
```

## export

Export every record to one JSON file the business owns.

```bash
node scripts/collections.mjs export [--out=<file.json>]
```

## hardship

Record that a debtor is in financial hardship, with a note.

```bash
node scripts/collections.mjs hardship <ref> --note="<what they said>" [--date=] --actor="<name>"
```

## history

Everything about one account: debtor and restrictions, balance, the statute-barred date, ledger, arrangements, disputes, contacts and recent activity.

```bash
node scripts/collections.mjs history <ref or debtor>
```

## hold

Put an account on hold, with the reason.

```bash
node scripts/collections.mjs hold <ref> --reason="<why>" --actor="<name>"
```

## import

Bring a Collect! debtor list (printed to a comma-separated file) into a client. Dry run first.

```bash
node scripts/collections.mjs import collect <file.csv> --client=<code> [--map=<column-map.json>] --actor="<name>" --dry-run
```

## insights

The ten questions Collect! does not answer: what becomes statute-barred soon, recovery by client, kept versus broken arrangements by collector, which channel brings payment, when calls connect, debtors across clients, trust past terms, untouched accounts, the age of the book and who is at the contact limit.

```bash
node scripts/collections.mjs insights
```

## legal

Mark an account for legal action. Refuses a statute-barred debt, a bankrupt debtor, an open dispute or nothing owing.

```bash
node scripts/collections.mjs legal <ref> --reason="<what is being filed>" --actor="<name>"
```

## list-account

List a new account for a client: the debtor (found by name and state or created), the amount, the date of default the limitation period runs from, and the client's reference.

```bash
node scripts/collections.mjs list-account --client=<code> --debtor="<name>" --state=<NSW|VIC|QLD|SA|WA|TAS|NT|ACT|NZ> --amount=<amount> --accrued=<YYYY-MM-DD> [--client-ref="<ref>"] [--description="<what>"] [--phone=] [--email=] [--address=] [--kind=individual|business] [--collector=<name>] --actor="<name>"
```

## log-contact

Record a contact or attempt after it happened: channel, outcome, who it was with, and the debtor's local time. The record is kept even when it broke a rule, and the finding is shown.

```bash
node scripts/collections.mjs log-contact <ref> --channel=<phone|sms|email|letter|visit|workplace> [--outcome=contact|attempt|misdirected] [--direction=out|in] [--party=debtor|representative|third_party] [--at="YYYY-MM-DD HH:MM"] [--note="<what was said>"] --actor="<name>"
```

## log

Add a note to an account's history: a client instruction, a search result, advice received.

```bash
node scripts/collections.mjs log <ref> --note="<what>" --actor="<name>"
```

## payment

Record a payment: into the trust account, or made straight to the client. Commission is worked out from the client's rate. Paid in full closes the arrangement and marks the account paid.

```bash
node scripts/collections.mjs payment <ref> --amount=<amount> [--method=trust|direct] [--date=<YYYY-MM-DD>] [--reference="<bank ref>"] --actor="<name>"
```

## promise

Record a promise to pay one amount on one date.

```bash
node scripts/collections.mjs promise <ref> --amount=<amount> --due=<YYYY-MM-DD> [--note=] --actor="<name>"
```

## remit

Settle a client's trust money up to a date: trust payments less commission (on trust and direct payments) and GST on the commission. Records the remittance and its bank reference.

```bash
node scripts/collections.mjs remit <client code> --reference="<bank reference>" [--to=<YYYY-MM-DD>] --actor="<name>"
```

## remittances

Remittances made to clients: period, trust money, commission, GST, net and the bank reference.

```bash
node scripts/collections.mjs remittances [--client=<code>]
```

## represent

Record that a debtor has an authorised representative (financial counsellor, solicitor, carer). From then on, contact goes to the representative.

```bash
node scripts/collections.mjs represent <ref> --name="<name, role>" [--contact="<email or phone>"] [--date=] --actor="<name>"
```

## resolve-dispute

Resolve the open dispute: upheld (the debtor is right: adjust or return) or rejected (collection can resume after writing with the evidence).

```bash
node scripts/collections.mjs resolve-dispute <ref> --outcome=upheld|rejected --resolution="<what the evidence showed>" --actor="<name>"
```

## resume

Take an account off hold. Refuses for a bankrupt debtor or an open dispute.

```bash
node scripts/collections.mjs resume <ref> --actor="<name>"
```

## return-account

Return an account to the client, with the reason. Ends any arrangement.

```bash
node scripts/collections.mjs return-account <ref> --reason="<why>" --actor="<name>"
```

## statute

Debts that are statute-barred or will be within 180 days (or --days=N), with the rule and the date the period runs from.

```bash
node scripts/collections.mjs statute [--days=<n>]
```

## stop-contact

Record a written request from the debtor that no further communication be made.

```bash
node scripts/collections.mjs stop-contact <ref> [--date=<YYYY-MM-DD>] --actor="<name>"
```

## tasks

Open tasks, oldest due first.

```bash
node scripts/collections.mjs tasks
```

## trust

Money held in trust for each client and not yet remitted, commission and GST owed, the net due, and whether it is past the client's remittance terms.

```bash
node scripts/collections.mjs trust
```

## weekly-review

Write the Monday review from attention, compliance breaches, the worklist and trust money.

```bash
node scripts/collections.mjs weekly-review
```

## worklist

Today's calling list: accounts that can be worked now, broken arrangements first, then new listings, then the longest since an attempt. Leaves out anyone over the contact limit, bankrupt, disputed, asked for no contact, or keeping an arrangement.

```bash
node scripts/collections.mjs worklist [--collector=<name>]
```

## write-off

Write off part or all of a balance, with the reason. Written off to nothing closes the account.

```bash
node scripts/collections.mjs write-off <ref> --amount=<amount> --reason="<why>" --actor="<name>"
```

## written-only

Record that the debtor wants written contact only (email or letter).

```bash
node scripts/collections.mjs written-only <ref> --actor="<name>"
```
