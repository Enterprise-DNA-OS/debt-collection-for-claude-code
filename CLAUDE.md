# Debt Collection for Claude Code: operating instructions

Claude Code reads this file at the start of every session. It says who this is for, the house rules, and the one right way to do each recurring job.

## Who this is for

- **Agency:** [YOUR AGENCY], licence [NUMBER, where your state requires one]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [for example: every client remitted on time, and no contact that breaks the guideline]

The work is third-party debt collection in Australia or New Zealand: clients list overdue accounts, collectors contact debtors within the rules, set arrangements, take payments into trust, and remit to clients less commission.

## Rules

- Read the CLI result before answering. Every answer about an account starts with data from `node scripts/collections.mjs`. Never answer from memory.
- Resolve names first. If the CLI says a name is ambiguous, list the candidates and ask; never pick the first.
- Before any call, text, email or visit, run `can-contact`. If it says no, say why and stop. Never look for a way around a contact rule.
- Every write names `--actor`. That is a label in the activity log, not a verified identity.
- Never invent a value, date, amount, reason or outcome. The default date an account is listed with must come from the client; the limitation period runs from it.
- Never write a dispute resolution, a hardship note or a client instruction for the operator. They are the operator's words.
- Never threaten anything the agency does not intend and cannot do. On a statute-barred debt never state or imply legal action (RG 96 part 2 s 19-21).
- Never send, call, pay or delete. Letters and reports are drafts in `drafts/`. Recording a payment or a remittance does not move money; a person does that from the trust account.
- The rules in `docs/compliance.md` are records checks, not legal advice. Contact times skip only the holidays in the `holidays` table: load each year's dates and your state's holidays. If a rule looks out of date, say so and stop.
- Back up before a schema change. Use a new numbered migration (`/customise`), run `npm test`, and keep real data, exports and credentials out of Git.
- The database owner can bypass every application check. Protect that credential. Row security and revoked public privileges restrict unrelated database roles; a shared installation needs authenticated access.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| The open book: every account with debtor, client, status, collector, balance, paid so far, last contact attempt and the statute-barred date. Filter by client, collector or status. | `/accounts` |
| Record a written acknowledgement of the debt. The limitation period starts again from its date. | `/acknowledge` |
| Add a client we collect for: code, name, AU or NZ, commission percentage, remittance terms in days, and whether their agreement allows fees to be added. | `/add-client` |
| Add collection costs or interest to an account. Refuses unless the client's agreement allows it, and never on a bankrupt debtor. | `/add-fee` |
| Add a task to an account. | `/add-task` |
| Record a payment arrangement: an amount every week, fortnight or month for a number of instalments. Refuses more than is owed. | `/arrange` |
| Active promises and payment plans: what was due, what has been paid since, the next date, and whether each is on track or broken. | `/arrangements` |
| Give an account to another collector. | `/assign` |
| Show what needs a person today: broken arrangements, trust money held past a client's terms, debts about to become statute-barred, disputes waiting, promises due today, accounts never contacted, overdue tasks and quiet accounts. | `/attention` |
| Record a debtor's bankruptcy. Every open account of theirs goes on hold and arrangements end. | `/bankrupt` |
| Before a call, text, email or visit: can this account be contacted now, by this channel? Checks the hours, holidays, the weekly and monthly limits, representatives, bankruptcy, disputes, written requests and arrangements, with the rule for each. | `/can-contact` |
| Cancel the active promise or arrangement, with the reason. | `/cancel-arrangement` |
| Every client: commission, remittance terms, whether fees may be added, open accounts, the book and what has been collected. | `/clients` |
| Close an account with nothing owing. | `/close` |
| Check every contact and account against the rules in docs/compliance.md: contact hours, public holidays, the 3-a-week and 10-a-month limits, represented, bankrupt and disputed debtors, written requests for no contact, statute-barred debts, trust money past terms and fees after hardship. | `/compliance` |
| Every contact and attempt on one account in the debtor's local time, with any rule each one broke. | `/contacts` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Record a dispute about liability, the amount or identity. Collection stops; only written contact to clarify or settle is appropriate. | `/dispute` |
| Open disputes about liability, amount or identity, oldest first. | `/disputes` |
| Render remittance statements, client account listings and debtor statements of account as branded HTML from the records. | `/documents` |
| Mark an open task done. | `/done` |
| Draft the letter confirming an arrangement, with every payment date. Written to drafts/, never sent. | `/draft-arrangement-letter` |
| Draft a client's report: collected in 30 days, money in trust, every open account and the disputes we need their help with. Written to drafts/, never sent. | `/draft-client-report` |
| Draft a letter asking for payment, addressed to the representative if there is one. Refuses for a bankrupt debtor, an open dispute or a request for no contact. A statute-barred debt gets a warning not to mention legal action. Written to drafts/, never sent. | `/draft-demand` |
| Export every record to one JSON file the business owns. | `/export` |
| Record that a debtor is in financial hardship, with a note. | `/hardship` |
| Everything about one account: debtor and restrictions, balance, the statute-barred date, ledger, arrangements, disputes, contacts and recent activity. | `/history` |
| Put an account on hold, with the reason. | `/hold` |
| Bring a Collect! debtor list (printed to a comma-separated file) into a client. Dry run first. | `/import` |
| The ten questions Collect! does not answer: what becomes statute-barred soon, recovery by client, kept versus broken arrangements by collector, which channel brings payment, when calls connect, debtors across clients, trust past terms, untouched accounts, the age of the book and who is at the contact limit. | `/insights` |
| Mark an account for legal action. Refuses a statute-barred debt, a bankrupt debtor, an open dispute or nothing owing. | `/legal` |
| List a new account for a client: the debtor (found by name and state or created), the amount, the date of default the limitation period runs from, and the client's reference. | `/list-account` |
| Record a contact or attempt after it happened: channel, outcome, who it was with, and the debtor's local time. The record is kept even when it broke a rule, and the finding is shown. | `/log-contact` |
| Add a note to an account's history: a client instruction, a search result, advice received. | `/log` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |
| Record a payment: into the trust account, or made straight to the client. Commission is worked out from the client's rate. Paid in full closes the arrangement and marks the account paid. | `/payment` |
| Record a promise to pay one amount on one date. | `/promise` |
| Settle a client's trust money up to a date: trust payments less commission (on trust and direct payments) and GST on the commission. Records the remittance and its bank reference. | `/remit` |
| Remittances made to clients: period, trust money, commission, GST, net and the bank reference. | `/remittances` |
| Record that a debtor has an authorised representative (financial counsellor, solicitor, carer). From then on, contact goes to the representative. | `/represent` |
| Resolve the open dispute: upheld (the debtor is right: adjust or return) or rejected (collection can resume after writing with the evidence). | `/resolve-dispute` |
| Take an account off hold. Refuses for a bankrupt debtor or an open dispute. | `/resume` |
| Return an account to the client, with the reason. Ends any arrangement. | `/return-account` |
| Debts that are statute-barred or will be within 180 days (or --days=N), with the rule and the date the period runs from. | `/statute` |
| Record a written request from the debtor that no further communication be made. | `/stop-contact` |
| Open tasks, oldest due first. | `/tasks` |
| Money held in trust for each client and not yet remitted, commission and GST owed, the net due, and whether it is past the client's remittance terms. | `/trust` |
| Render the read-only dashboards in views.json (this week, the book, trust and commission) as HTML in your brand. | `/view` |
| Write the Monday review from attention, compliance breaches, the worklist and trust money. | `/weekly-review` |
| Today's calling list: accounts that can be worked now, broken arrangements first, then new listings, then the longest since an attempt. Leaves out anyone over the contact limit, bankrupt, disputed, asked for no contact, or keeping an arrangement. | `/worklist` |
| Write off part or all of a balance, with the reason. Written off to nothing closes the account. | `/write-off` |
| Record that the debtor wants written contact only (email or letter). | `/written-only` |

If an ask fits nothing here, run `node scripts/collections.mjs --help`, answer from the records, then propose a new command for it.

## Where things live

- `scripts/collections.mjs` is the one CLI. `scripts/lib/domain.mjs` holds its rules.
- `supabase/migrations/` is the schema in plain SQL. `0002_rules.sql` holds contact hours, contact limits, holidays and limitation periods, one row each with its source. `npm run migrate` applies it. `DATABASE_URL` chooses Postgres; unset, it uses PGlite in `.data/`.
- `views.json` and `documents.json` define the dashboards and documents. `brand.json` is your name, colours and logo.
- `docs/compliance.md` lists the rules and their sources. `docs/replace-collect.md` is the switching guide.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=collect&utm_medium=readme
