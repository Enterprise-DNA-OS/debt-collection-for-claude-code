-- The contact rules and limitation periods the desk checks. One row per rule, each with its source.
-- Checked 2026-10-19 against: ASIC Regulatory Guide 96 / ACCC "Debt collection guideline: for collectors
-- and creditors" (April 2021) and the Limitation Act 2010 (NZ). Full notes: docs/compliance.md.
-- Change a row here (or ask /customise) and every check moves on the next query.

insert into contact_hours (jurisdiction, hours, day_kind, starts, ends, source) values
 ('AU', 'phone',     'weekday', '07:30', '21:00', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a): telephone, Monday to Friday 7:30 am to 9 pm'),
 ('AU', 'phone',     'weekend', '09:00', '21:00', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a): telephone, weekends 9 am to 9 pm'),
 ('AU', 'visit',     'weekday', '09:00', '21:00', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a): face-to-face, Monday to Friday 9 am to 9 pm'),
 ('AU', 'visit',     'weekend', '09:00', '21:00', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a): face-to-face, weekends 9 am to 9 pm'),
 ('AU', 'workplace', 'weekday', '09:00', '17:00', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a): workplace, normal working hours if known, or 9 am to 5 pm weekdays'),
 -- New Zealand has no published contact-hours table. These rows are a house rule copied from the Australian
 -- guideline; the law behind them is the ban on harassment and coercion. Change them to your own policy.
 ('NZ', 'phone',     'weekday', '07:30', '21:00', 'House rule (no NZ contact-hours table). Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion'),
 ('NZ', 'phone',     'weekend', '09:00', '21:00', 'House rule (no NZ contact-hours table). Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion'),
 ('NZ', 'visit',     'weekday', '09:00', '21:00', 'House rule (no NZ contact-hours table). Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion'),
 ('NZ', 'visit',     'weekend', '09:00', '21:00', 'House rule (no NZ contact-hours table). Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion'),
 ('NZ', 'workplace', 'weekday', '09:00', '17:00', 'House rule (no NZ contact-hours table). Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion')
on conflict do nothing;

insert into contact_limits (jurisdiction, per_7_days, per_30_days, source) values
 ('AU', 3, 10, 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 5(c): no more than three times per week, or 10 times per month at most, counting contact actually made, per account (s 5(b))'),
 ('NZ', 3, 10, 'House rule copied from the Australian guideline. Fair Trading Act 1986 (NZ) s 23 prohibits harassment and coercion')
on conflict do nothing;

-- RG 96 footnote 11: generally inappropriate to contact debtors on these days. Load each new year.
insert into holidays (day, jurisdiction, name, source) values
 ('2026-01-01', 'AU', 'New Year''s Day', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-01-26', 'AU', 'Australia Day',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-04-03', 'AU', 'Good Friday',     'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-04-05', 'AU', 'Easter Sunday',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-04-06', 'AU', 'Easter Monday',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-04-25', 'AU', 'Anzac Day',       'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-12-25', 'AU', 'Christmas Day',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2026-12-26', 'AU', 'Boxing Day',      'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-01-01', 'AU', 'New Year''s Day', 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-01-26', 'AU', 'Australia Day',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-03-26', 'AU', 'Good Friday',     'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-03-28', 'AU', 'Easter Sunday',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-03-29', 'AU', 'Easter Monday',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-04-25', 'AU', 'Anzac Day',       'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-12-25', 'AU', 'Christmas Day',   'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 ('2027-12-26', 'AU', 'Boxing Day',      'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 4(a) and footnote 11'),
 -- South Australia bans phone calls and personal calls to demand payment on any public holiday, state or national.
 -- Confirm these dates against the SA Government's public holiday list and add the rest of the year.
 ('2026-03-09', 'SA', 'Adelaide Cup Day', 'Fair Trading Act 1987 (SA) s 43(1)(d)(i), cited in RG 96 footnote 11'),
 ('2026-04-04', 'SA', 'Easter Saturday',  'Fair Trading Act 1987 (SA) s 43(1)(d)(i), cited in RG 96 footnote 11'),
 ('2026-06-08', 'SA', 'King''s Birthday', 'Fair Trading Act 1987 (SA) s 43(1)(d)(i), cited in RG 96 footnote 11'),
 ('2026-10-05', 'SA', 'Labour Day',       'Fair Trading Act 1987 (SA) s 43(1)(d)(i), cited in RG 96 footnote 11')
on conflict do nothing;

insert into limitation_rules (state, years, source) values
 ('AU', 6,  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 20(b): usually six years from when the right accrued or the debt was last acknowledged (for example by a payment). Check your state''s Limitation Act'),
 ('NT', 3,  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 20(b): three years in the Northern Territory'),
 ('NZ', 6,  'Limitation Act 2010 (NZ) s 11 (six years for a money claim) and s 47 (a written acknowledgement or part payment starts the period again)')
on conflict do nothing;
