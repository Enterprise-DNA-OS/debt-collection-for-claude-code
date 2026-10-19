-- Debt collection: the records a collection agency keeps for each client, debtor and account,
-- from listing to the last remittance. Portable Postgres: runs on Postgres 15+ and on the embedded
-- PGlite. No extensions. Money is stored in cents (bigint) in the client's currency.
-- Contact times are stored as the debtor's local time (timestamp without time zone), because the
-- contact rules are written in local time. The CLI converts "now" to the debtor's state.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- AU states and territories, or NZ. The rules hang off the jurisdiction.
create or replace function juris(state text) returns text language sql immutable as $$
  select case when state = 'NZ' then 'NZ' else 'AU' end
$$;

-- ------------------------------------------------------------------ clients (the creditors we collect for)

create table clients (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  jurisdiction text not null default 'AU' check (jurisdiction in ('AU','NZ')),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  -- Contingency commission on every amount collected, in basis points (2000 = 20%).
  commission_bp integer not null default 2000 check (commission_bp between 0 and 10000),
  -- GST on our commission, in basis points (1000 = 10% AU, 1500 = 15% NZ).
  gst_bp integer not null default 1000 check (gst_bp between 0 and 5000),
  -- The client agreement: money collected into trust is remitted within this many days.
  remit_days integer not null default 30 check (remit_days between 1 and 120),
  -- Whether the client agreement allows collection costs or interest to be added to an account.
  fees_allowed boolean not null default false,
  contact text not null default '',
  status text not null default 'active' check (status in ('active','inactive')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_code_key on clients (lower(code));
create trigger clients_touch before update on clients for each row execute function touch_updated_at();

-- ------------------------------------------------------------------ debtors

create table debtors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'individual' check (kind in ('individual','business')),
  state text not null check (state in ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT','NZ')),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  -- The debtor's own wishes about when and how to be contacted (RG 96 s 4(c)-(d), s 5(f)).
  preferred_hours text not null default '',
  written_only boolean not null default false,
  -- A written request that no further communication be made (ACL and Fair Trading Act 2012 (Vic) s 45(2)(m)).
  stop_contact_on date,
  -- An authorised representative: financial counsellor, solicitor, carer (RG 96 s 9).
  representative text not null default '',
  representative_contact text not null default '',
  represented_on date,
  bankrupt_on date,
  hardship_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((representative = '') = (represented_on is null))
);
create index debtors_name_idx on debtors (lower(name));
create trigger debtors_touch before update on debtors for each row execute function touch_updated_at();

-- ------------------------------------------------------------------ accounts (one debt listed by one client)

create table accounts (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  client_id uuid not null references clients(id),
  debtor_id uuid not null references debtors(id),
  client_ref text not null default '',
  description text not null default '',
  listed_on date not null,
  -- The day the right to sue accrued (usually the date of default). The limitation period runs from
  -- here, or from the last payment or written acknowledgement, whichever is later.
  accrued_on date not null,
  acknowledged_on date,
  collector text not null default 'Unassigned',
  status text not null default 'active'
    check (status in ('active','arrangement','disputed','on_hold','legal','paid','returned','closed')),
  hold_reason text not null default '',
  closed_on date,
  notes text not null default '',
  source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accrued_on <= listed_on),
  check (closed_on is null or closed_on >= listed_on)
);
create unique index accounts_ref_key on accounts (lower(ref));
create index accounts_client_idx on accounts (client_id);
create index accounts_debtor_idx on accounts (debtor_id);
create trigger accounts_touch before update on accounts for each row execute function touch_updated_at();

create table remittances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  ref text not null,
  period_to date not null,
  made_on date not null,
  trust_cents bigint not null,
  direct_cents bigint not null,
  commission_cents bigint not null,
  gst_cents bigint not null,
  -- Trust money less commission and GST. Negative means the client owes us (payments made direct to them).
  net_cents bigint not null,
  reference text not null default '',
  created_at timestamptz not null default now()
);
create unique index remittances_ref_key on remittances (lower(ref));

-- The account ledger. principal, interest and fee raise the balance; payment and write_off lower it.
-- A payment is either into our trust account (method trust) or made straight to the client (direct).
-- Commission is earned on both and settled on the next remittance.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  occurred_on date not null,
  kind text not null check (kind in ('principal','interest','fee','payment','write_off')),
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default '' check (method in ('','trust','direct')),
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  remittance_id uuid references remittances(id),
  description text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now(),
  check ((kind = 'payment') = (method <> '')),
  check (kind = 'payment' or (commission_cents = 0 and remittance_id is null))
);
create index transactions_account_idx on transactions (account_id, occurred_on);

-- Every contact and attempted contact (RG 96 s 3). local_at is the debtor's local time.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  local_at timestamp not null,
  channel text not null check (channel in ('phone','sms','email','letter','visit','workplace')),
  direction text not null default 'out' check (direction in ('out','in')),
  outcome text not null default 'contact' check (outcome in ('contact','attempt','misdirected')),
  party text not null default 'debtor' check (party in ('debtor','representative','third_party')),
  collector text not null default '',
  note text not null default '',
  logged_at timestamptz not null default now()
);
create index contacts_account_idx on contacts (account_id, local_at);

-- Promises to pay (one instalment) and payment arrangements (a run of instalments).
create table arrangements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  kind text not null check (kind in ('promise','plan')),
  amount_cents bigint not null check (amount_cents > 0),
  every text not null default 'once' check (every in ('once','week','fortnight','month')),
  first_due date not null,
  instalments integer not null default 1 check (instalments between 1 and 260),
  made_on date not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  ended_on date,
  collector text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  check ((kind = 'promise') = (every = 'once' and instalments = 1)),
  check (first_due >= made_on)
);
create unique index arrangements_one_active on arrangements (account_id) where status = 'active';

create table disputes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  raised_on date not null,
  kind text not null check (kind in ('liability','amount','identity')),
  detail text not null,
  resolved_on date,
  outcome text check (outcome in ('upheld','rejected')),
  resolution text not null default '',
  created_at timestamptz not null default now(),
  check ((resolved_on is null) = (outcome is null))
);
create unique index disputes_one_open on disputes (account_id) where resolved_on is null;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  title text not null,
  owner text not null,
  due_on date,
  done_on date,
  created_at timestamptz not null default now()
);

-- Append-only history. Every write in the CLI leaves a row here.
create table activity (
  id bigint generated always as identity primary key,
  account_id uuid references accounts(id),
  client_id uuid references clients(id),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail text not null default ''
);
create or replace function activity_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'Append-only: activity rows cannot be changed or deleted';
end $$;
create trigger activity_no_update before update or delete on activity for each row execute function activity_append_only();

-- ------------------------------------------------------------------ rules (rows in 0002_rules.sql, each with its source)

create table contact_hours (
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  hours text not null check (hours in ('phone','visit','workplace')),
  day_kind text not null check (day_kind in ('weekday','weekend')),
  starts time not null,
  ends time not null,
  source text not null,
  primary key (jurisdiction, hours, day_kind)
);

create table contact_limits (
  jurisdiction text primary key check (jurisdiction in ('AU','NZ')),
  per_7_days integer not null,
  per_30_days integer not null,
  source text not null
);

-- Days with no contact. jurisdiction is AU or NZ for the whole country, or a state code (SA) for a state rule.
create table holidays (
  day date not null,
  jurisdiction text not null,
  name text not null,
  source text not null default '',
  primary key (day, jurisdiction)
);

-- Limitation periods. state matches the debtor's state first (NT), then the jurisdiction (AU, NZ).
create table limitation_rules (
  state text primary key,
  years integer not null check (years between 1 and 20),
  source text not null
);

-- Which hours row applies to a channel. Letters and emails have no hours rule.
create or replace function hours_for(channel text) returns text language sql immutable as $$
  select case when channel in ('phone','sms') then 'phone' when channel = 'visit' then 'visit'
    when channel = 'workplace' then 'workplace' else null end
$$;

-- ------------------------------------------------------------------ views

create view v_balances with (security_invoker = true) as
select a.id as account_id, a.ref, a.client_id, c.code as client, a.debtor_id, d.name as debtor, d.state, a.collector, a.status, c.currency,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'principal'), 0) as listed_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind in ('interest','fee')), 0) as added_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'payment'), 0) as paid_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'write_off'), 0) as written_off_cents,
  coalesce(sum(case when t.kind in ('principal','interest','fee') then t.amount_cents else -t.amount_cents end), 0) as balance_cents,
  max(t.occurred_on) filter (where t.kind = 'payment') as last_payment_on,
  (select max(x.local_at)::date from contacts x where x.account_id = a.id and x.direction = 'out') as last_tried_on,
  (select max(x.local_at)::date from contacts x where x.account_id = a.id and x.outcome = 'contact') as last_contact_on,
  a.listed_on
from accounts a join clients c on c.id = a.client_id join debtors d on d.id = a.debtor_id
left join transactions t on t.account_id = a.id
group by a.id, c.code, c.currency, d.name, d.state;

-- When each account becomes statute-barred: the limitation period from the later of the date the right
-- accrued, the last payment and the last written acknowledgement.
create view v_limitation with (security_invoker = true) as
select b.account_id, b.ref, b.client, b.debtor, b.state, b.collector, b.status, b.currency, b.balance_cents,
  r.years, r.source,
  greatest(a.accrued_on, coalesce(b.last_payment_on, a.accrued_on), coalesce(a.acknowledged_on, a.accrued_on)) as runs_from,
  (greatest(a.accrued_on, coalesce(b.last_payment_on, a.accrued_on), coalesce(a.acknowledged_on, a.accrued_on)) + make_interval(years => r.years))::date as barred_on
from v_balances b join accounts a on a.id = b.account_id
join limitation_rules r on r.state = case when exists (select 1 from limitation_rules l where l.state = b.state) then b.state else juris(b.state) end;

-- Instalments due under each active arrangement, and how the payments since it was made measure up.
-- An instalment is missed once it is more than 3 days late (a grace period you can change here).
create view v_arrangements with (security_invoker = true) as
with s as (
  select r.*, a.ref, a.collector as owner, c.currency,
    (select count(*) from generate_series(0, r.instalments - 1) n
      where (case r.every when 'week' then r.first_due + 7 * n when 'fortnight' then r.first_due + 14 * n
             when 'month' then (r.first_due + make_interval(months => n))::date else r.first_due end) <= current_date - 3)::int as due_count,
    (select min(case r.every when 'week' then r.first_due + 7 * n when 'fortnight' then r.first_due + 14 * n
             when 'month' then (r.first_due + make_interval(months => n))::date else r.first_due end)
      from generate_series(0, r.instalments - 1) n
      where (case r.every when 'week' then r.first_due + 7 * n when 'fortnight' then r.first_due + 14 * n
             when 'month' then (r.first_due + make_interval(months => n))::date else r.first_due end) >= current_date) as next_due,
    coalesce((select sum(t.amount_cents) from transactions t where t.account_id = r.account_id and t.kind = 'payment' and t.occurred_on >= r.made_on), 0) as paid_cents
  from arrangements r join accounts a on a.id = r.account_id join clients c on c.id = a.client_id
)
select id as arrangement_id, account_id, ref, owner, kind, every, currency, amount_cents, instalments, first_due, made_on, status, next_due,
  due_count * amount_cents as expected_cents, paid_cents,
  case when status <> 'active' then status
       when paid_cents >= instalments * amount_cents then 'kept'
       when paid_cents < due_count * amount_cents then 'broken'
       else 'on track' end as state
from s;

-- Each contact with the rule it breaks, if any. One row per finding. Used by log-contact and compliance.
create view v_contact_findings with (security_invoker = true) as
with x as (
  select k.*, a.ref, a.collector as owner, d.state, juris(d.state) as jurisdiction, d.represented_on, d.bankrupt_on, d.stop_contact_on,
    d.written_only, k.local_at::date as day, extract(isodow from k.local_at)::int as dow, k.local_at::time as tod,
    (k.direction = 'out' and k.outcome = 'contact' and k.party = 'debtor' and k.channel <> 'visit') as counted
  from contacts k join accounts a on a.id = k.account_id join debtors d on d.id = a.debtor_id
)
select x.id as contact_id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'contact hours' as rule, 'breach' as severity,
  x.channel || ' at ' || to_char(x.local_at, 'Dy DD Mon HH24:MI') || ' local, outside ' || coalesce(to_char(h.starts, 'HH24:MI') || ' to ' || to_char(h.ends, 'HH24:MI'), 'any allowed hours') as finding,
  coalesce(h.source, (select min(source) from contact_hours z where z.jurisdiction = x.jurisdiction and z.hours = hours_for(x.channel))) as source
from x left join contact_hours h on h.jurisdiction = x.jurisdiction and h.hours = hours_for(x.channel)
  and h.day_kind = case when x.dow >= 6 then 'weekend' else 'weekday' end
where x.direction = 'out' and x.outcome <> 'misdirected' and hours_for(x.channel) is not null
  and (h.starts is null or x.tod < h.starts or x.tod > h.ends)
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'public holiday', 'breach',
  x.channel || ' on ' || y.name || ' (' || x.day || ')', y.source
from x join holidays y on y.day = x.day and y.jurisdiction in (x.jurisdiction, x.state)
where x.direction = 'out' and x.outcome <> 'misdirected' and hours_for(x.channel) is not null
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'contact frequency', 'breach',
  'contact number ' || (select count(*) from x y where y.account_id = x.account_id and y.counted and y.local_at > x.local_at - interval '7 days' and y.local_at <= x.local_at)
    || ' in 7 days (limit ' || l.per_7_days || ')', l.source
from x join contact_limits l on l.jurisdiction = x.jurisdiction
where x.counted and (select count(*) from x y where y.account_id = x.account_id and y.counted and y.local_at > x.local_at - interval '7 days' and y.local_at <= x.local_at) > l.per_7_days
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'contact frequency', 'breach',
  'contact number ' || (select count(*) from x y where y.account_id = x.account_id and y.counted and y.local_at > x.local_at - interval '30 days' and y.local_at <= x.local_at)
    || ' in 30 days (limit ' || l.per_30_days || ')', l.source
from x join contact_limits l on l.jurisdiction = x.jurisdiction
where x.counted and (select count(*) from x y where y.account_id = x.account_id and y.counted and y.local_at > x.local_at - interval '30 days' and y.local_at <= x.local_at) > l.per_30_days
  and (select count(*) from x y where y.account_id = x.account_id and y.counted and y.local_at > x.local_at - interval '7 days' and y.local_at <= x.local_at) <= l.per_7_days
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'represented debtor', 'breach',
  'direct ' || x.channel || ' with the debtor after a representative was recorded on ' || x.represented_on,
  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 9(b)'
from x where x.direction = 'out' and x.party = 'debtor' and x.outcome <> 'misdirected' and x.represented_on is not null and x.day >= x.represented_on
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'bankrupt debtor', 'breach',
  x.channel || ' about an unsecured debt after bankruptcy on ' || x.bankrupt_on,
  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 16(b)-(c)'
from x where x.direction = 'out' and x.outcome <> 'misdirected' and x.bankrupt_on is not null and x.day >= x.bankrupt_on
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'disputed debt', 'breach',
  x.channel || ' while a dispute (' || p.kind || ') raised ' || p.raised_on || ' was open: only written contact is appropriate',
  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 13(i)-(j)'
from x join disputes p on p.account_id = x.account_id and x.day >= p.raised_on and (p.resolved_on is null or x.day < p.resolved_on)
where x.direction = 'out' and x.outcome <> 'misdirected' and x.channel not in ('letter','email')
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'request for no contact',
  case when x.state = 'VIC' then 'breach' else 'note' end,
  x.channel || ' after the debtor asked in writing on ' || x.stop_contact_on || ' for no further communication',
  case when x.state = 'VIC' then 'Australian Consumer Law and Fair Trading Act 2012 (Vic) s 45(2)(m)'
       else 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 5(f): respect the request unless there is a legitimate reason' end
from x where x.direction = 'out' and x.outcome <> 'misdirected' and x.stop_contact_on is not null and x.day >= x.stop_contact_on
union all
select x.id, x.account_id, x.ref, x.owner, x.local_at, x.channel, 'written contact only', 'note',
  x.channel || ' when the debtor asked for written contact only',
  'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2 s 5(f)'
from x where x.direction = 'out' and x.outcome <> 'misdirected' and x.written_only and x.channel not in ('letter','email');

-- Trust money per client: payments into trust not yet remitted, commission owed on everything collected.
create view v_trust with (security_invoker = true) as
select c.id as client_id, c.code as client, c.name, c.currency, c.remit_days, c.commission_bp, c.gst_bp,
  coalesce(sum(t.amount_cents) filter (where t.method = 'trust'), 0) as trust_cents,
  coalesce(sum(t.amount_cents) filter (where t.method = 'direct'), 0) as direct_cents,
  coalesce(sum(t.commission_cents), 0) as commission_cents,
  min(t.occurred_on) filter (where t.method = 'trust') as oldest_trust_on,
  (select max(r.made_on) from remittances r where r.client_id = c.id) as last_remitted_on
from clients c
left join accounts a on a.client_id = c.id
left join transactions t on t.account_id = a.id and t.kind = 'payment' and t.remittance_id is null
group by c.id;

-- Everything that needs a person today.
create view v_attention with (security_invoker = true) as
select r.ref, r.owner, 'arrangement broken' as item,
  r.kind || ': paid ' || round(r.paid_cents / 100.0, 2) || ' of ' || round(r.expected_cents / 100.0, 2) || ' due' as detail, r.first_due as date, (current_date - r.first_due) as days
  from v_arrangements r where r.state = 'broken'
union all
select r.ref, r.owner, case r.kind when 'promise' then 'promise due today' else 'instalment due today' end,
  r.currency || ' ' || round(r.amount_cents / 100.0, 2), r.next_due, 0
  from v_arrangements r where r.state = 'on track' and r.next_due = current_date
union all
select a.ref, a.collector, 'dispute waiting', p.kind || ': ' || p.detail, p.raised_on, (current_date - p.raised_on)
  from disputes p join accounts a on a.id = p.account_id where p.resolved_on is null and current_date - p.raised_on > 14
union all
select l.ref, l.collector, 'statute-barred soon', 'balance ' || l.currency || ' ' || round(l.balance_cents / 100.0, 2) || ', barred ' || l.barred_on, l.barred_on, (current_date - l.barred_on)
  from v_limitation l where l.status in ('active','arrangement','on_hold') and l.balance_cents > 0 and l.barred_on between current_date and current_date + 90
union all
select b.ref, b.collector, 'never contacted', 'listed ' || b.listed_on || ', no attempt yet', b.listed_on, (current_date - b.listed_on)
  from v_balances b where b.status = 'active' and b.last_tried_on is null and current_date - b.listed_on > 3
union all
select b.ref, b.collector, 'gone quiet', 'no contact or attempt since ' || b.last_tried_on, b.last_tried_on, (current_date - b.last_tried_on)
  from v_balances b where b.status = 'active' and b.balance_cents > 0 and b.last_tried_on is not null and current_date - b.last_tried_on > 30
union all
select t.client, 'Accounts', 'trust money held past terms', t.currency || ' ' || round(t.trust_cents / 100.0, 2) || ' unremitted, terms ' || t.remit_days || ' days',
  t.oldest_trust_on, (current_date - t.oldest_trust_on)
  from v_trust t where t.trust_cents > 0 and current_date - t.oldest_trust_on > t.remit_days
union all
select a.ref, t.owner, 'task overdue', t.title, t.due_on, (current_date - t.due_on)
  from tasks t join accounts a on a.id = t.account_id where t.done_on is null and t.due_on < current_date;

-- ------------------------------------------------------------------ access

do $$
declare t text;
begin
  foreach t in array array['clients','debtors','accounts','remittances','transactions','contacts','arrangements','disputes',
                           'tasks','activity','contact_hours','contact_limits','holidays','limitation_rules'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;
revoke all on v_balances, v_limitation, v_arrangements, v_contact_findings, v_trust, v_attention from public;
