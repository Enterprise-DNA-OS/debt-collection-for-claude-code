# Replace Collect!

Collect! lets you choose the fields when you print a debtor list to a file, so there is no single export layout. Its own Data Import Module reads CSV, fixed-length and text files ([collect.org/solutions/modules](https://www.collect.org/solutions/modules/), checked 19 October 2026); going the other way, a debtor list report written to a comma-separated file is what moves here. Check the headings against your own report once; after that the import is one command per client.

1. In Collect!, run a debtor list for one client with these fields: file number, name, state (or province), amount owing, listed date, delinquency (default) date, last payment date, phone, email, address and operator. Write it to a file with commas between fields.
2. Keep the untouched file. If your headings differ from the ones below, copy `examples/column-map.json` and name your headings once.
3. Add the client here first (`/add-client`): code, name, AU or NZ, commission, remittance terms and whether fees may be added.
4. Run the import with `--dry-run`. Fix every row it rejects: a missing name, a state it cannot read, an amount it cannot read, a missing default date, a debtor in the wrong country for the client.
5. Run it again without `--dry-run`. Compare the account count and the total owing with the Collect! report.
6. Record what the debtor list does not carry: representatives (`/represent`), bankruptcies, disputes, arrangements in place, and money held in trust that has not been remitted. Reconcile trust per client with the trust account before relying on `/trust`.

```bash
npm run migrate
node scripts/collections.mjs add-client --code=SCB --name="Client Pty Ltd" --jurisdiction=AU --commission=15 --remit-days=30 --actor="Your name"
node scripts/collections.mjs import collect debtors.csv --client=SCB --map=column-map.json --actor="Your name" --dry-run
node scripts/collections.mjs import collect debtors.csv --client=SCB --map=column-map.json --actor="Your name"
```

| Destination | Headings accepted by default | Treatment |
|---|---|---|
| Client reference | File Number, File, Account Number, Account, Client Reference, Reference | Optional. Used to skip repeats |
| Debtor | Name, Debtor, Debtor Name, Full Name | Required. Matched to an existing debtor by name and state |
| State | State, Province, Region, Country | Required. NSW, VIC, QLD, SA, WA, TAS, NT, ACT or NZ, or the full name |
| Owing | Owing, Balance, Amount Owing, Amount, Principal | Required. Commas and a dollar sign are accepted |
| Listed | Listed, Listed Date, Date Listed | dd/mm/yyyy or yyyy-mm-dd; blank is today |
| Default date | Delinquency Date, Default Date, Charged Off, Due Date | Required. The limitation period runs from it, so a blank stops the import |
| Last payment | Last Payment Date, Last Paid, Last Payment | Optional. Stored as the last acknowledgement: a part payment starts the limitation period again |
| Phone, email, address | Phone, Home Phone, Mobile, Cell; Email, Email Address; Address, Street, Address 1 | Optional |
| Collector | Operator, Collector, Owner | Blank is Unassigned |
| Description | Description, Detail, Comment | Optional |

The bundled example is synthetic, not an untouched vendor export. Every source column is kept with the imported account, including ones that are not mapped.

The balance owing comes across as one listed amount. The transaction history, the contact notes, letters sent, the payment portal and the dialler history stay in Collect!. Keep Collect! read-only until each client is reconciled, or ask Enterprise DNA to map the full transaction and notes history as part of a custom installation.

Imports are atomic: a repeat row with the same amount is skipped, a repeat with a different amount stops the whole file, and nothing is written until every row is valid.
