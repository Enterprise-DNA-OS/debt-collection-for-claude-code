# Rules and sources

Checked 19 October 2026 against ASIC Regulatory Guide 96 / the ACCC and ASIC "Debt collection guideline: for collectors and creditors" (April 2021), the provisions it cites, and the Limitation Act 2010 (NZ). These are records checks for a collection desk. They are not legal advice, they do not decide whether a debt is owed or whether a contact was reasonable, and they do not replace the agency's own compliance program. Confirm the current text of each source before relying on it.

Every contact hour, limit, holiday and limitation period is a row in `supabase/migrations/0002_rules.sql`. Change a row through `/customise` and every check moves on the next query.

## How contacts are counted

| Term | What the system does | Source |
|---|---|---|
| Contact | A call answered (even if the debtor hangs up), a voicemail or message left, any letter, email, text or social message, and any face-to-face meeting. Logged with `--outcome=contact`. | RG 96 part 2 s 3(a) |
| Attempted contact | A call that is not answered and leaves no message. Logged with `--outcome=attempt`. It does not count toward the limit, but repeated attempts can still be harassment. | RG 96 part 2 s 3(e), (g) |
| Misdirected contact | A disconnected number or a bounced email. Logged with `--outcome=misdirected`. Never checked against the hours. | RG 96 part 2 s 3(f) |
| Per account | Limits are counted per account, not per debtor. A debtor with two accounts can be contacted about both in one call. `/insights` lists them. | RG 96 part 2 s 5(b) |
| Local time | Every contact is stored in the debtor's local time (their state, or New Zealand). The CLI converts the current time with the state's time zone, daylight saving included. | RG 96 part 2 s 4(a): "the local times in the debtor's state or territory" |

The system does not treat an email thread as one continuous contact (RG 96 part 2 s 3(b)-(c)): each email logged as a contact counts. Log a prompt reply to the debtor's own message as `--direction=in` if you judge it part of their thread.

## Australia

| Check | Rule in the system | Source |
|---|---|---|
| Contact hours, telephone | Monday to Friday 7:30 am to 9 pm, weekends 9 am to 9 pm. Applies to phone calls and, as a house choice, to texts. | RG 96 part 2 s 4(a) |
| Contact hours, face-to-face | Monday to Friday and weekends 9 am to 9 pm. | RG 96 part 2 s 4(a) |
| Contact hours, workplace | The debtor's normal working hours if known, otherwise 9 am to 5 pm on weekdays. No weekend workplace contact. | RG 96 part 2 s 4(a) |
| Representatives | A financial counsellor or solicitor is contacted in ordinary business hours (checked as 9 am to 5 pm weekdays by `can-contact`). | RG 96 part 2 s 4(a) footnote 10 |
| National public holidays | No contact recommended on New Year's Day, Australia Day, Good Friday, Easter Sunday, Easter Monday, Anzac Day, Christmas Day and Boxing Day. 2026 and 2027 are loaded. | RG 96 part 2 s 4(a) and footnote 11 |
| South Australia | No phone call or personal call to demand payment on any public holiday, state or national. Four 2026 SA holidays are loaded as examples; load the full list each year. | Fair Trading Act 1987 (SA) s 43(1)(d)(i), cited in RG 96 footnote 11 |
| The debtor's wishes | A preferred time is recorded on the debtor and shown by `can-contact`. It is not enforced as a time window: the collector reads it. | RG 96 part 2 s 4(c)-(d) |
| Frequency | No more than 3 contacts made in any 7 days or 10 in any 30 days, per account. Face-to-face visits are not counted here (the guideline treats them separately). The system counts rolling periods, which is stricter than calendar weeks. | RG 96 part 2 s 5(b)-(c) |
| Represented debtor | Once a representative is recorded, direct contact with the debtor is a breach; contact goes to the representative. | RG 96 part 2 s 9(b) |
| Disputed debt | While a dispute is open, only written contact (letter or email) to clarify the claim, give notice of proceedings or put a genuine settlement proposal. Calls, texts and visits are breaches. `/draft-demand` refuses. | RG 96 part 2 s 13(i)-(j) |
| Bankrupt debtor | Stop all collection of an unsecured debt. Contact after the recorded date is a breach; `bankrupt` puts every account of the debtor on hold; `legal`, `add-fee` and `/draft-demand` refuse. Secured debts and Part IX and Part X agreements are not modelled. | RG 96 part 2 s 16(a)-(c) |
| Written request for no contact (Victoria) | Contact after a written request that no further communication be made is a breach for a Victorian debtor. Elsewhere it is noted against the general rule to respect the request. | Australian Consumer Law and Fair Trading Act 2012 (Vic) s 45(2)(m), cited in RG 96 footnote 12; RG 96 part 2 s 5(f) |
| Written contact only | A call, text or visit after the debtor asked for written contact only is noted. | RG 96 part 2 s 5(f) |
| Arrangement in place | While a promise or plan is on track, `can-contact` says no and the worklist leaves the account out. A missed instalment (more than 3 days late) makes it broken and the account comes back. | RG 96 part 2 s 15(a) |
| Limitation period | Usually 6 years, 3 in the Northern Territory, from the later of the date the right accrued (the default date), the last payment and the last written acknowledgement. Each state's Limitation Act has the detail; confirm before relying on a date. | RG 96 part 2 s 20(b) |
| Statute-barred debt | `legal` refuses. An account marked for legal action after the date is a breach. Any other open barred account is noted: do not state or imply legal action. `/draft-demand` carries the warning. | RG 96 part 2 s 20(b)-(c) |
| Hardship | Fees or interest added after hardship was recorded are noted. | RG 96 part 2 s 14 |

## New Zealand

| Check | Rule in the system | Source |
|---|---|---|
| Contact hours and frequency | New Zealand has no published contact-hours table or contact limit. The system applies the Australian figures as a house rule so the same checks run, and says so in every finding. Change the NZ rows to your own policy. | House rule. Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion |
| Limitation period | 6 years for a money claim, from the act or omission. A written acknowledgement or a part payment starts the period again. | Limitation Act 2010 (NZ) s 11 and s 47 |
| Representatives, disputes, bankruptcy | The same records checks run, cited to RG 96 as good practice. They are not New Zealand law. | RG 96 (Australian) as a house standard |

## Money

| Check | Rule in the system | Source |
|---|---|---|
| Remittance terms | Money paid into trust is remitted within the client's `remit_days`. Older money is flagged on `/attention` and `/compliance`. | The client agreement. Trust account rules differ by state and country (some states license collection agents and set trust account rules): check yours and set `remit_days` to the stricter |
| Commission | Earned on every payment, into trust or direct to the client, at the client's rate. GST on commission at 10% (AU) or 15% (NZ). A remittance with more commission than trust money shows a negative net: invoice the client. | The client agreement |
| Fees and interest | Added only when the client's agreement allows (`fees_allowed`), never to a bankrupt debtor's unsecured debt. Whether the debtor is legally liable for a fee is the operator's call. | The client agreement; RG 96 part 2 s 19 |

## Not modelled

Licensing of collection agents by state, trust account audits, credit reporting, privacy requests (APP 12 and 13), hardship under the National Credit Code, energy retailer hardship rules, face-to-face visit frequency, the contents of every letter, and the right to complain to AFCA or another dispute scheme. The agency's compliance program covers these.
