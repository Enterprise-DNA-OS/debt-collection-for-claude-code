<h1 align="center">Debt Collection for Claude Code</h1>

<p align="center">
  <strong>The open-source debt collection system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Collect! data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=collect">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/collect?utm_source=github&utm_medium=readme&utm_campaign=collect">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#bring-your-collect-accounts">Instead of Collect!</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Debt Collection for Claude Code does the job you pay Collect! for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Collect! dashboard cannot.

Collect! cloud starts at A$33,390 a year for 10 users on Professional and A$69,390 for 20 on Corporate, plus A$1,390 a year for each extra user ([collect.org pricing](https://www.collect.org/solutions/pricing-cloud/), checked 19 October 2026). Letter services, texting, payment processing and dialler accounts are separate. Here the database is yours and there is no per-seat fee.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=collect).

It covers third-party debt collection for an agency, or the recovery desk in a law or accounting firm, in Australia or New Zealand: clients who list accounts, debtors in their own state's time zone, every contact and attempt, promises and payment plans, disputes, representatives, bankruptcies, payments into trust or direct to the client, commission and GST, and remittances to the cent. Every contact is checked against ASIC RG 96 (the ACCC and ASIC debt collection guideline): the hours, the public holidays, three contacts a week and ten a month, represented, bankrupt and disputed debtors, and written requests for no contact. Every account carries the date it becomes statute-barred.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/debt-collection-for-claude-code.git
cd debt-collection-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Try `/worklist`, `/compliance` and `/trust` next.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Broken arrangements, trust money held past a client's terms, debts about to become statute-barred, disputes waiting, promises due today, accounts never contacted, overdue tasks and quiet accounts |
| `/worklist` | Today's calling list, broken arrangements first, leaving out anyone over the contact limit, bankrupt, disputed, asked for no contact, or keeping an arrangement |
| `/can-contact` | Before a call, text, email or visit: yes or no, with the rule behind every reason, in the debtor's local time |
| `/compliance` | Every contact and account checked against the rules in [docs/compliance.md](docs/compliance.md), with sources |
| `/trust` | Money held for each client, commission and GST owed, the net due, and whether it is past their remittance terms |
| `/statute` | Debts statute-barred or about to be, with the date the period runs from |
| `/weekly-review` | The Monday review, written to `drafts/` from attention, breaches, the worklist and trust money |
| `/draft-demand` | A request for payment, to the representative if there is one, with the statute-barred warning where it applies |
| `/draft-arrangement-letter` | The letter confirming every payment date of an arrangement |
| `/draft-client-report` | A client's report: collected, held in trust, every open account and the disputes we need their help with |

The working commands: `/add-client`, `/list-account`, `/log-contact`, `/payment`, `/add-fee`, `/write-off`, `/promise`, `/arrange`, `/cancel-arrangement`, `/dispute`, `/resolve-dispute`, `/represent`, `/bankrupt`, `/hardship`, `/stop-contact`, `/written-only`, `/acknowledge`, `/hold`, `/resume`, `/legal`, `/return-account`, `/close`, `/assign`, `/remit`, `/add-task`, `/done`, `/log`. The reads: `/accounts`, `/history`, `/contacts`, `/arrangements`, `/clients`, `/remittances`, `/disputes`, `/tasks`, `/insights`. Plus `/import`, `/export`, `/view`, `/documents`, `/new-view` and `/customise`. 52 commands in all; [docs/cli.md](docs/cli.md) lists every option.

Names match case-insensitively. A partial name or reference works when it is unique; when it is not, the command lists the candidates and stops.

## The gates

- `/log-contact` records every contact as it happened, and reports straight away if it broke a rule: outside the hours, on a holiday, the fourth in seven days, direct to a represented or bankrupt debtor, a call on a disputed debt, or after a written request for no contact.
- `/legal` refuses a statute-barred debt, a bankrupt debtor, an open dispute or an account with nothing owing.
- `/add-fee` refuses unless the client's agreement allows fees, and never on a bankrupt debtor.
- `/arrange` and `/promise` refuse more than is owed, a past date, or a second arrangement on the same account. `/payment` refuses more than is owed and closes the account when it is paid.
- `/resume` refuses a bankrupt debtor or an open dispute. `/draft-demand` refuses a bankrupt debtor, an open dispute or a request for no contact.
- `/remit` settles trust money to the cent: trust payments less commission (on trust and direct payments) and GST on the commission.

The software records and checks; the collector decides. It is not legal advice, it does not call, send or move money, and it files nothing with a court.

## Bring your Collect! accounts

Print a debtor list for one client from Collect! to a comma-separated file, add the client here, and import it, dry run first:

```bash
node scripts/collections.mjs import collect examples/collect-debtor-list.csv --client=SCB --actor="Your name" --dry-run
```

The [switching guide](docs/replace-collect.md) covers headings, what maps and what does not come across. Imports are atomic: repeat rows are skipped, a conflicting row or a missing default date stops the whole file, and every source column is kept with the account.

## Ten questions answered from your records

`/insights` runs all ten today, across every client at once.

1. Which accounts become statute-barred in the next 180 days, and how much is owed on them?
2. What share of what each client listed have we collected, and how fast does the first payment come?
3. Which collectors set arrangements that are kept, and which set ones that break?
4. Which contact channel is followed by a payment within 7 days?
5. At what time of day do calls reach the debtor rather than ring out?
6. Which debtors owe on more than one account, so one call can cover them all?
7. How much of each client's money is in trust past their remittance terms?
8. Which open accounts have had no contact attempt at all in 30 days?
9. How old is the book, by client, in age bands since listing?
10. Which accounts are already at the weekly contact limit?

## Your first hour: ten things to ask for

1. What needs my attention today?
2. Who can I call right now, and who has to wait?
3. Can I ring Mia Thompson this afternoon?
4. Log that I spoke to Liam Carter at 5.40 pm and he will pay $150 on Friday.
5. Coastline Renovations is disputing two invoices: what do we need from Southern Cross?
6. Which debts become statute-barred before Christmas?
7. How much do we owe Kauri Coast Vets, and is it late?
8. Remit Southern Cross up to the end of last month and draft their report.
9. Put our agency name, licence number and logo on the statements.
10. Add a field for the court file number on every account through /customise.

## Verification

`npm test` runs 253 checks on a temporary database: migrations, repeatable seed data, local time by state and daylight saving, contact hours, holidays (national and South Australian), the weekly and monthly limits counted per account, attempts versus contacts, represented, bankrupt and disputed debtors, written requests for no contact, arrangements kept and broken, commission and GST, remittances to the cent, limitation periods (including the Northern Territory and a written acknowledgement), every read and write, import repeats and rollback, drafts, export, the append-only activity log, read-only views, row security for unrelated database roles, and escaped HTML. Set `TEST_DATABASE_URL` to run the same checks on an empty Postgres database.

Read the [operating rules](CLAUDE.md), the [rules and sources](docs/compliance.md), the [selection evidence](docs/research.md) and [why there is no front end](docs/why-no-front-end.md).

## Architecture

```
debt-collection-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Debt Collection for Claude Code for your business, migrates your Collect! data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=collect)
- Read more: [enterprisedna.co/omni/instead-of/collect](https://enterprisedna.co/omni/instead-of/collect?utm_source=github&utm_medium=readme&utm_campaign=collect)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
