// The rules of the collection desk. scripts/collections.mjs is a thin shell over run().
// Every write names an actor and leaves a row in the append-only activity log.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './db.mjs';
import { parseCsv, pick } from './csv.mjs';
import { price as money } from './format.mjs';

export const today = () => new Date().toISOString().slice(0, 10);

export function date(v, label) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error(`--${label} must be a valid date (YYYY-MM-DD)`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw Error(`--${label} must be a valid date (YYYY-MM-DD)`);
  return s;
}

// "12,345.60" or "$12345.6" -> 1234560 cents. Never guesses at a blank.
export function cents(v, label) {
  const s = String(v ?? '').replace(/[$,\s]/g, '').replace(/^(NZD|AUD)/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`--${label} must be an amount like 1234.56`);
  const n = Math.round(parseFloat(s) * 100);
  if (n <= 0) throw Error(`--${label} must be more than zero`);
  return n;
}

function need(flags, ...keys) {
  for (const k of keys) if (flags[k] === undefined || flags[k] === true || String(flags[k]).trim() === '') throw Error(`--${k} is required`);
}
function oneOf(v, allowed, label) {
  if (!allowed.includes(v)) throw Error(`--${label} must be one of: ${allowed.join(', ')}`);
  return v;
}
const dateOr = (v, label) => (v ? date(v, label) : today());
const notFuture = (d, label) => { if (d > today()) throw Error(`--${label} cannot be in the future`); return d; };

async function tx(db, fn) {
  await db.exec('begin');
  try { const r = await fn(); await db.exec('commit'); return r; } catch (e) { await db.exec('rollback'); throw e; }
}
async function note(db, accountId, actor, action, detail, clientId = null) {
  await db.query('insert into activity (account_id, client_id, actor, action, detail) values ($1,$2,$3,$4,$5)', [accountId, clientId, actor, action, detail]);
}

// Resolve one record from a reference, id prefix or name. Exact (case-insensitive) beats partial;
// more than one partial match lists the candidates and fails.
function choose(rows, term, what, label) {
  const t = String(term ?? '').trim().toLowerCase();
  if (!t || t === 'true') throw Error(`Name the ${what.toLowerCase()}`);
  const exact = rows.filter((r) => label(r).some((x) => String(x).toLowerCase() === t));
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : rows.filter((r) => label(r).some((x) => String(x).toLowerCase().includes(t)));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw Error(`${what} "${term}" not found`);
  throw Error(`"${term}" is ambiguous: ${partial.map((r) => label(r).filter(Boolean).slice(0, 2).join(' / ')).join('; ')}`);
}
export async function account(db, term) {
  const rows = await db.query(`select a.*, d.name as debtor, d.state, c.code as client, c.currency, c.commission_bp, c.fees_allowed
    from accounts a join debtors d on d.id = a.debtor_id join clients c on c.id = a.client_id order by a.ref`);
  return choose(rows, term, 'Account', (r) => [r.ref, r.debtor, r.client_ref, r.id]);
}
const CLOSED = ['paid', 'returned', 'closed'];
async function openAccount(db, term) {
  const a = await account(db, term);
  if (CLOSED.includes(a.status)) throw Error(`${a.ref} is ${a.status}`);
  return a;
}
export async function client(db, term) {
  const rows = await db.query('select * from clients order by code');
  return choose(rows, term, 'Client', (r) => [r.code, r.name, r.id]);
}
const debtorOf = async (db, a) => (await db.query('select * from debtors where id = $1', [a.debtor_id]))[0];
async function balance(db, a) {
  const [b] = await db.query('select balance_cents from v_balances where account_id = $1', [a.id]);
  return Number(b.balance_cents);
}
const openDispute = async (db, a) => (await db.query('select * from disputes where account_id = $1 and resolved_on is null', [a.id]))[0] || null;
const activeArrangement = async (db, a) => (await db.query(`select * from v_arrangements where account_id = $1 and status = 'active'`, [a.id]))[0] || null;
const limitation = async (db, a) => (await db.query('select * from v_limitation where account_id = $1', [a.id]))[0];

// The debtor's local time. The contact rules are written in local time (RG 96 s 4(a)).
const ZONES = { NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', TAS: 'Australia/Hobart', QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide', NT: 'Australia/Darwin', WA: 'Australia/Perth', NZ: 'Pacific/Auckland' };
export function localNow(state, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONES[state], year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
function localAt(v, state) {
  if (!v) return localNow(state);
  const s = String(v).trim().replace('T', ' ');
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/);
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59) throw Error('--at must be the debtor\'s local time as "YYYY-MM-DD HH:MM"');
  date(m[1], 'at');
  if (s > localNow(state)) throw Error('--at cannot be in the future');
  return s;
}

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'NZ'];
const CHANNELS = ['phone', 'sms', 'email', 'letter', 'visit', 'workplace'];
const WRITTEN = ['letter', 'email'];
const OUTCOMES = ['contact', 'attempt', 'misdirected'];
const PARTIES = ['debtor', 'representative', 'third_party'];
const EVERY = ['week', 'fortnight', 'month'];
const DISPUTES = ['liability', 'amount', 'identity'];

// Everything that stops or limits a contact before it is made. Used by can-contact and the worklist.
async function contactCheck(db, a, channel, at, party = 'debtor') {
  const d = await debtorOf(db, a);
  const juris = d.state === 'NZ' ? 'NZ' : 'AU';
  const out = [];
  const add = (rule, finding, source) => out.push({ rule, finding, source });
  const g = 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2';
  if (CLOSED.includes(a.status)) add('account closed', `${a.ref} is ${a.status}`, 'This system');
  if (d.bankrupt_on && d.bankrupt_on <= at.slice(0, 10)) add('bankrupt debtor', `bankrupt since ${d.bankrupt_on}: stop collection on an unsecured debt and deal with the trustee`, `${g} s 16(b)-(c)`);
  if (d.represented_on && party === 'debtor') add('represented debtor', `contact ${d.representative} (${d.representative_contact || 'no contact recorded'}) instead`, `${g} s 9(b)`);
  if (d.stop_contact_on) add('request for no contact', `asked in writing on ${d.stop_contact_on} for no further communication`, d.state === 'VIC' ? 'Australian Consumer Law and Fair Trading Act 2012 (Vic) s 45(2)(m)' : `${g} s 5(f)`);
  const dispute = await openDispute(db, a);
  if (dispute && !WRITTEN.includes(channel)) add('disputed debt', `${dispute.kind} dispute open since ${dispute.raised_on}: written contact only, to clarify or settle`, `${g} s 13(i)-(j)`);
  if (d.written_only && !WRITTEN.includes(channel)) add('written contact only', 'the debtor asked for written contact', `${g} s 5(f)`);
  const plan = await activeArrangement(db, a);
  if (plan && plan.state === 'on track') add('arrangement on track', `${plan.kind} on track, next due ${plan.next_due}: contact only if the debtor asks or a payment is missed`, `${g} s 15(a)`);
  const hours = { phone: 'phone', sms: 'phone', visit: 'visit', workplace: 'workplace' }[channel];
  if (hours && party !== 'representative') {
    const [day, time] = at.split(' ');
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const [h] = await db.query('select * from contact_hours where jurisdiction = $1 and hours = $2 and day_kind = $3', [juris, hours, dow === 0 || dow === 6 ? 'weekend' : 'weekday']);
    if (!h) add('contact hours', `no ${hours} contact allowed on a ${dow === 0 || dow === 6 ? 'weekend' : 'weekday'}`, (await db.query('select min(source) as s from contact_hours where jurisdiction = $1 and hours = $2', [juris, hours]))[0].s);
    else if (time < h.starts.slice(0, 5) || time > h.ends.slice(0, 5)) add('contact hours', `${time} local is outside ${h.starts.slice(0, 5)} to ${h.ends.slice(0, 5)}`, h.source);
    for (const y of await db.query('select * from holidays where day = $1 and jurisdiction in ($2, $3)', [day, juris, d.state])) add('public holiday', y.name, y.source);
    if (d.preferred_hours) add('debtor\'s wishes', `prefers ${d.preferred_hours}`, `${g} s 4(c)-(d)`);
  }
  if (hours && party === 'representative') {
    const [day, time] = at.split(' ');
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6 || time < '09:00' || time > '17:00') add('contact hours', `${time} local on a ${dow === 0 || dow === 6 ? 'weekend' : 'weekday'}: representatives are contacted in ordinary business hours`, `${g} s 4(a) footnote 10`);
  }
  if (party === 'debtor' && channel !== 'visit') {
    const [l] = await db.query('select * from contact_limits where jurisdiction = $1', [juris]);
    const [c] = await db.query(`select count(*) filter (where local_at > $2::timestamp - interval '7 days')::int as w, count(*)::int as m from contacts
      where account_id = $1 and direction = 'out' and outcome = 'contact' and party = 'debtor' and channel <> 'visit'
        and local_at > $2::timestamp - interval '30 days' and local_at <= $2::timestamp`, [a.id, at]);
    if (c.w >= l.per_7_days) add('contact frequency', `${c.w} contacts in the last 7 days (limit ${l.per_7_days})`, l.source);
    else if (c.m >= l.per_30_days) add('contact frequency', `${c.m} contacts in the last 30 days (limit ${l.per_30_days})`, l.source);
  }
  return out;
}

// ------------------------------------------------------------------ reads

export const reads = {
  async accounts(db, args, f) {
    const c = f.client ? (await client(db, f.client)).id : null;
    if (f.status) oneOf(f.status, ['active', 'arrangement', 'disputed', 'on_hold', 'legal', 'paid', 'returned', 'closed'], 'status');
    return db.query(`select b.ref, b.debtor, b.state, b.client, b.status, b.collector, b.currency, b.balance_cents, b.paid_cents, b.last_tried_on, l.barred_on
      from v_balances b join v_limitation l on l.account_id = b.account_id
      where ($1::uuid is null or b.client_id = $1) and ($2::text is null or lower(b.collector) = lower($2))
        and (($3::text is null and b.status not in ('paid','returned','closed')) or b.status = $3)
      order by b.client, b.ref`, [c, f.collector || null, f.status || null]);
  },
  async worklist(db, args, f) {
    const rows = await db.query(`select b.*, a.id, a.debtor_id, a.status as account_status, d.represented_on, d.written_only,
        (select r.state from v_arrangements r where r.account_id = b.account_id and r.status = 'active') as plan_state,
        (select count(*)::int from contacts k where k.account_id = b.account_id and k.direction = 'out' and k.outcome = 'contact' and k.party = 'debtor'
           and k.channel <> 'visit' and k.local_at > now()::timestamp - interval '7 days') as contacts_7d
      from v_balances b join accounts a on a.id = b.account_id join debtors d on d.id = a.debtor_id
      where b.status in ('active','arrangement') and b.balance_cents > 0 and ($1::text is null or lower(b.collector) = lower($1))
      order by b.ref`, [f.collector || null]);
    const out = [];
    for (const r of rows) {
      if (r.plan_state === 'on track') continue;
      const d = await debtorOf(db, r);
      const at = localNow(d.state);
      const found = await contactCheck(db, { ...r, status: r.account_status }, r.written_only ? 'email' : 'phone', at, r.represented_on ? 'representative' : 'debtor');
      const timing = ['contact hours', 'public holiday', 'debtor\'s wishes'];
      if (found.some((x) => !timing.includes(x.rule))) continue;
      const later = found.filter((x) => x.rule !== 'debtor\'s wishes' && timing.includes(x.rule)).map((x) => x.rule);
      const why = r.plan_state === 'broken' ? 'arrangement broken' : !r.last_tried_on ? 'never contacted' : 'follow up';
      const rank = { 'arrangement broken': 0, 'never contacted': 1, 'follow up': 2 }[why];
      out.push({ rank, ref: r.ref, debtor: r.debtor, client: r.client, collector: r.collector, currency: r.currency, balance_cents: r.balance_cents, why,
        last_tried_on: r.last_tried_on, contacts_7d: r.contacts_7d,
        how: r.represented_on ? `via ${d.representative}` : r.written_only ? 'email or letter only' : 'phone', local_now: at.slice(11),
        now: later.length ? `wait (${later.join(', ')})` : 'yes' });
    }
    return out.sort((x, y) => x.rank - y.rank || String(x.last_tried_on || '').localeCompare(String(y.last_tried_on || '')) || x.ref.localeCompare(y.ref))
      .map(({ rank, ...r }) => r);
  },
  async attention(db) {
    return db.query(`select ref, owner, item, detail, date,
        case when days is null then '' when days < 0 then 'in ' || -days || ' days' when days = 0 then 'today' else days || ' days ago' end as timing
      from v_attention
      order by case item when 'arrangement broken' then 0 when 'trust money held past terms' then 1 when 'statute-barred soon' then 2 when 'dispute waiting' then 3
        when 'promise due today' then 4 when 'instalment due today' then 4 when 'never contacted' then 5 when 'task overdue' then 6 else 7 end, days desc nulls last, ref`);
  },
  async arrangements(db) {
    return db.query(`select ref, owner, kind, every, instalments, currency, amount_cents, first_due, next_due, expected_cents, paid_cents, state
      from v_arrangements where status = 'active' order by state <> 'broken', next_due nulls last, ref`);
  },
  async contacts(db, [term]) {
    const a = await account(db, term);
    return db.query(`select to_char(k.local_at, 'YYYY-MM-DD HH24:MI') as local_time, k.channel, k.direction, k.outcome, k.party, k.collector, k.note,
        coalesce((select string_agg(f.rule, ', ') from v_contact_findings f where f.contact_id = k.id), '') as findings
      from contacts k where k.account_id = $1 order by k.local_at`, [a.id]);
  },
  async clients(db) {
    return db.query(`select c.code, c.name, c.jurisdiction as juris, round(c.commission_bp / 100.0, 2) as commission_pct, c.remit_days, c.fees_allowed,
        (select count(*)::int from accounts a where a.client_id = c.id and a.status not in ('paid','returned','closed')) as open_accounts, c.currency,
        coalesce((select sum(b.balance_cents) from v_balances b where b.client_id = c.id and b.status not in ('paid','returned','closed')), 0) as book_cents,
        coalesce((select sum(t.amount_cents) from transactions t join accounts a on a.id = t.account_id where a.client_id = c.id and t.kind = 'payment'), 0) as collected_cents
      from clients c order by c.code`);
  },
  async trust(db) {
    return db.query(`select client, name, currency, trust_cents, direct_cents, commission_cents,
        round(commission_cents * gst_bp / 10000.0)::bigint as gst_cents,
        trust_cents - commission_cents - round(commission_cents * gst_bp / 10000.0)::bigint as net_due_cents,
        oldest_trust_on, remit_days, case when oldest_trust_on is not null and current_date - oldest_trust_on > remit_days then 'overdue' else '' end as remit,
        last_remitted_on
      from v_trust order by trust_cents desc, client`);
  },
  async remittances(db, args, f) {
    const c = f.client ? (await client(db, f.client)).id : null;
    return db.query(`select r.ref, c.code as client, r.period_to, r.made_on, c.currency, r.trust_cents, r.direct_cents, r.commission_cents, r.gst_cents, r.net_cents, r.reference
      from remittances r join clients c on c.id = r.client_id where ($1::uuid is null or c.id = $1) order by r.made_on desc, r.ref`, [c]);
  },
  async statute(db, args, f) {
    const days = f.days === undefined ? 180 : Number(f.days);
    if (!Number.isInteger(days) || days < 0) throw Error('--days must be a whole number');
    return db.query(`select ref, debtor, state, collector, status, currency, balance_cents, runs_from, barred_on,
        case when barred_on <= current_date then 'statute-barred' else 'in ' || (barred_on - current_date) || ' days' end as timing, years, source
      from v_limitation where balance_cents > 0 and status not in ('paid','returned','closed') and barred_on <= current_date + $1::int
      order by barred_on`, [days]);
  },
  async disputes(db) {
    return db.query(`select a.ref, d.name as debtor, c.code as client, a.collector, p.kind, p.detail, p.raised_on, current_date - p.raised_on as days_open
      from disputes p join accounts a on a.id = p.account_id join debtors d on d.id = a.debtor_id join clients c on c.id = a.client_id
      where p.resolved_on is null order by p.raised_on`);
  },
  async tasks(db) {
    return db.query(`select a.ref, t.title, t.owner, t.due_on from tasks t join accounts a on a.id = t.account_id
      where t.done_on is null order by t.due_on nulls last, a.ref`);
  },
  async 'can-contact'(db, [term], f) {
    const a = await account(db, term);
    const channel = oneOf(f.channel || 'phone', CHANNELS, 'channel');
    const party = oneOf(f.party || 'debtor', PARTIES, 'party');
    const d = await debtorOf(db, a);
    const at = localAt(f.at, d.state);
    const reasons = await contactCheck(db, a, channel, at, party);
    const soft = ['debtor\'s wishes'];
    return { account: a.ref, debtor: a.debtor, channel, party, local_time: at, ok: reasons.every((r) => soft.includes(r.rule)) ? 'yes' : 'no',
      reasons: reasons.map((r) => `${r.rule}: ${r.finding} [${r.source}]`).join('\n    ') || 'none' };
  },
  async compliance(db) { return compliance(db); },
  async insights(db) { return runInsights(db); },
};

// ------------------------------------------------------------------ compliance

async function compliance(db) {
  const rows = [];
  const add = (ref, rule, severity, finding, source) => rows.push({ ref, rule, severity, finding, source });
  for (const f of await db.query(`select f.* from v_contact_findings f join accounts a on a.id = f.account_id order by f.local_at`)) {
    add(f.ref, f.rule, f.severity, `${String(f.local_at).slice(0, 10)}: ${f.finding}`, f.source);
  }
  const g = 'ASIC RG 96 / ACCC Debt collection guideline (April 2021) part 2';
  for (const l of await db.query(`select * from v_limitation where balance_cents > 0 and status not in ('paid','returned','closed') and barred_on <= current_date + 90 order by barred_on`)) {
    if (l.barred_on > today()) add(l.ref, 'limitation period', 'due', `statute-barred on ${l.barred_on} (${l.years} years from ${l.runs_from}): decide on legal action or a written acknowledgement before then`, l.source);
    else if (l.status === 'legal') add(l.ref, 'statute-barred debt', 'breach', `marked for legal action but statute-barred since ${l.barred_on}`, `${g} s 20(b)-(c); ${l.source}`);
    else add(l.ref, 'statute-barred debt', 'note', `statute-barred since ${l.barred_on}: do not state or imply legal action will or may be taken`, `${g} s 20(c)`);
  }
  for (const a of await db.query(`select a.ref, d.bankrupt_on, a.status from accounts a join debtors d on d.id = a.debtor_id
      where d.bankrupt_on is not null and a.status in ('active','arrangement','legal')`)) {
    add(a.ref, 'bankrupt debtor', 'breach', `debtor bankrupt since ${a.bankrupt_on} but the account is still ${a.status}`, `${g} s 16(a)-(b)`);
  }
  for (const a of await db.query(`select a.ref, p.raised_on from disputes p join accounts a on a.id = p.account_id where p.resolved_on is null and a.status = 'legal'`)) {
    add(a.ref, 'disputed debt', 'note', `legal action recorded while a dispute raised ${a.raised_on} is open`, `${g} s 13(f)-(i)`);
  }
  for (const t of await db.query(`select * from v_trust where trust_cents > 0 and current_date - oldest_trust_on > remit_days`)) {
    add(t.client, 'remittance terms', 'due', `${money(t.trust_cents, t.currency)} in trust since ${t.oldest_trust_on}, past the ${t.remit_days}-day remittance term`, 'Client agreement (remit_days on the client). Check your state or country trust account rules');
  }
  for (const a of await db.query(`select a.ref, d.hardship_on, t.occurred_on, t.kind from transactions t join accounts a on a.id = t.account_id join debtors d on d.id = a.debtor_id
      where d.hardship_on is not null and t.kind in ('fee','interest') and t.occurred_on >= d.hardship_on`)) {
    add(a.ref, 'hardship', 'note', `${a.kind} added on ${a.occurred_on} after hardship was recorded on ${a.hardship_on}`, `${g} s 14`);
  }
  const order = { breach: 0, due: 1, note: 2 };
  return rows.sort((a, b) => order[a.severity] - order[b.severity] || a.ref.localeCompare(b.ref));
}

// ------------------------------------------------------------------ writes

async function nextRef(db, prefix, table) {
  const rows = await db.query(`select ref from ${table} where lower(ref) like lower($1)`, [`${prefix}-%`]);
  const n = rows.map((r) => Number(r.ref.slice(prefix.length + 1))).filter(Number.isInteger);
  return n;
}

export const writes = {
  async 'add-client'(db, args, f) {
    need(f, 'actor', 'code', 'name');
    const juris = oneOf(String(f.jurisdiction || 'AU').toUpperCase(), ['AU', 'NZ'], 'jurisdiction');
    const pct = f.commission === undefined ? 20 : Number(f.commission);
    if (!(pct >= 0 && pct <= 100)) throw Error('--commission must be a percentage from 0 to 100');
    const remit = f['remit-days'] === undefined ? 30 : Number(f['remit-days']);
    if (!Number.isInteger(remit) || remit < 1 || remit > 120) throw Error('--remit-days must be a whole number from 1 to 120');
    if (!/^[A-Za-z0-9]{2,8}$/.test(f.code)) throw Error('--code must be 2 to 8 letters or digits');
    return tx(db, async () => {
      const [c] = await db.query(`insert into clients (code, name, jurisdiction, currency, commission_bp, gst_bp, remit_days, fees_allowed, contact)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [f.code.toUpperCase(), f.name, juris, juris === 'NZ' ? 'NZD' : 'AUD', Math.round(pct * 100),
        juris === 'NZ' ? 1500 : 1000, remit, Boolean(f['fees-allowed']), f.contact || '']);
      await note(db, null, f.actor, 'add-client', `${c.code} ${c.name}: ${pct}% commission, remit within ${remit} days`, c.id);
      return c;
    });
  },
  async 'list-account'(db, args, f) {
    need(f, 'actor', 'client', 'debtor', 'state', 'amount', 'accrued');
    const c = await client(db, f.client);
    if (c.status !== 'active') throw Error(`${c.code} is inactive`);
    const state = oneOf(String(f.state).toUpperCase(), STATES, 'state');
    if ((state === 'NZ') !== (c.jurisdiction === 'NZ')) throw Error(`${c.code} collects in ${c.jurisdiction}; the debtor is in ${state}`);
    const amount = cents(f.amount, 'amount');
    const listed = notFuture(dateOr(f.listed, 'listed'), 'listed');
    const accrued = date(f.accrued, 'accrued');
    if (accrued > listed) throw Error('--accrued (the date of default) must be on or before the listing date');
    const kind = oneOf(f.kind || 'individual', ['individual', 'business'], 'kind');
    return tx(db, async () => {
      let [d] = await db.query('select * from debtors where lower(name) = lower($1) and state = $2', [f.debtor, state]);
      if (!d) {
        [d] = await db.query(`insert into debtors (name, kind, state, phone, email, address) values ($1,$2,$3,$4,$5,$6) returning *`,
          [f.debtor, kind, state, f.phone || '', f.email || '', f.address || '']);
      }
      if (f['client-ref']) {
        const [dup] = await db.query('select ref from accounts where client_id = $1 and lower(client_ref) = lower($2)', [c.id, f['client-ref']]);
        if (dup) throw Error(`${c.code} already listed ${f['client-ref']} as ${dup.ref}`);
      }
      const used = await nextRef(db, c.code, 'accounts');
      const ref = f.ref || `${c.code}-${Math.max(1000, ...used) + 1}`;
      const [a] = await db.query(`insert into accounts (ref, client_id, debtor_id, client_ref, description, listed_on, accrued_on, collector)
        values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [ref, c.id, d.id, f['client-ref'] || '', f.description || '', listed, accrued, f.collector || 'Unassigned']);
      await db.query(`insert into transactions (account_id, occurred_on, kind, amount_cents, description) values ($1,$2,'principal',$3,'Listed by client')`, [a.id, listed, amount]);
      await note(db, a.id, f.actor, 'list-account', `${c.code} listed ${d.name} for ${money(amount, c.currency)}`);
      return { ref: a.ref, client: c.code, debtor: d.name, state, currency: c.currency, balance_cents: amount, listed_on: listed, accrued_on: accrued, collector: a.collector };
    });
  },
  async 'log-contact'(db, [term], f) {
    need(f, 'actor', 'channel');
    const a = await account(db, term);
    const channel = oneOf(f.channel, CHANNELS, 'channel');
    const outcome = oneOf(f.outcome || 'contact', OUTCOMES, 'outcome');
    const direction = oneOf(f.direction || 'out', ['out', 'in'], 'direction');
    const party = oneOf(f.party || 'debtor', PARTIES, 'party');
    const d = await debtorOf(db, a);
    const at = localAt(f.at, d.state);
    return tx(db, async () => {
      const [k] = await db.query(`insert into contacts (account_id, local_at, channel, direction, outcome, party, collector, note)
        values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [a.id, at, channel, direction, outcome, party, f.actor, f.note || '']);
      const findings = await db.query('select rule, severity, finding, source from v_contact_findings where contact_id = $1', [k.id]);
      await note(db, a.id, f.actor, 'log-contact', `${direction} ${channel} ${outcome} (${party}) at ${at}${findings.length ? `; ${findings.map((x) => x.rule).join(', ')}` : ''}`);
      return { account: a.ref, debtor: a.debtor, local_time: at, channel, direction, outcome, party,
        findings: findings.length ? findings.map((x) => `${x.severity.toUpperCase()} ${x.rule}: ${x.finding} [${x.source}]`).join('\n    ') : 'none' };
    });
  },
  async payment(db, [term], f) {
    need(f, 'actor', 'amount');
    const a = await openAccount(db, term);
    const amount = cents(f.amount, 'amount');
    const method = oneOf(f.method || 'trust', ['trust', 'direct'], 'method');
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    const owed = await balance(db, a);
    if (amount > owed) throw Error(`${money(amount, a.currency)} is more than the ${money(owed, a.currency)} owed on ${a.ref}`);
    const commission = Math.round((amount * a.commission_bp) / 10000);
    return tx(db, async () => {
      await db.query(`insert into transactions (account_id, occurred_on, kind, amount_cents, method, commission_cents, description, reference)
        values ($1,$2,'payment',$3,$4,$5,$6,$7)`, [a.id, on, amount, method, commission, f.description || (method === 'direct' ? 'Paid direct to the client' : 'Payment'), f.reference || '']);
      const left = owed - amount;
      const plan = await activeArrangement(db, a);
      if (left === 0) {
        await db.query(`update accounts set status = 'paid', closed_on = $2 where id = $1`, [a.id, on]);
        if (plan) await db.query(`update arrangements set status = 'completed', ended_on = $2 where id = $1`, [plan.arrangement_id, on]);
      } else if (plan && plan.state === 'kept') {
        await db.query(`update arrangements set status = 'completed', ended_on = $2 where id = $1`, [plan.arrangement_id, on]);
        await db.query(`update accounts set status = 'active' where id = $1 and status = 'arrangement'`, [a.id]);
      }
      await note(db, a.id, f.actor, 'payment', `${money(amount, a.currency)} ${method}${f.reference ? ` (${f.reference})` : ''}, commission ${money(commission, a.currency)}`);
      return { account: a.ref, paid_cents: amount, method, commission_cents: commission, currency: a.currency, balance_cents: left, status: left === 0 ? 'paid' : a.status };
    });
  },
  async 'add-fee'(db, [term], f) {
    need(f, 'actor', 'amount', 'reason');
    const a = await openAccount(db, term);
    const kind = oneOf(f.kind || 'fee', ['fee', 'interest'], 'kind');
    if (!a.fees_allowed) throw Error(`${a.client}'s agreement does not allow fees or interest to be added`);
    const d = await debtorOf(db, a);
    if (d.bankrupt_on) throw Error(`${a.debtor} is bankrupt: nothing can be added to an unsecured debt`);
    const amount = cents(f.amount, 'amount');
    return tx(db, async () => {
      await db.query(`insert into transactions (account_id, occurred_on, kind, amount_cents, description) values ($1,$2,$3,$4,$5)`, [a.id, today(), kind, amount, f.reason]);
      await note(db, a.id, f.actor, 'add-fee', `${kind} ${money(amount, a.currency)}: ${f.reason}`);
      return { account: a.ref, kind, amount_cents: amount, currency: a.currency, balance_cents: (await balance(db, a)) };
    });
  },
  async 'write-off'(db, [term], f) {
    need(f, 'actor', 'amount', 'reason');
    const a = await openAccount(db, term);
    const amount = cents(f.amount, 'amount');
    const owed = await balance(db, a);
    if (amount > owed) throw Error(`${money(amount, a.currency)} is more than the ${money(owed, a.currency)} owed`);
    return tx(db, async () => {
      await db.query(`insert into transactions (account_id, occurred_on, kind, amount_cents, description) values ($1,$2,'write_off',$3,$4)`, [a.id, today(), amount, f.reason]);
      if (owed === amount) await db.query(`update accounts set status = 'closed', closed_on = $2 where id = $1`, [a.id, today()]);
      await note(db, a.id, f.actor, 'write-off', `${money(amount, a.currency)}: ${f.reason}`);
      return { account: a.ref, written_off_cents: amount, currency: a.currency, balance_cents: owed - amount };
    });
  },
  async promise(db, [term], f) {
    need(f, 'actor', 'amount', 'due');
    return makeArrangement(db, term, f, 'promise');
  },
  async arrange(db, [term], f) {
    need(f, 'actor', 'amount', 'every', 'first', 'instalments');
    return makeArrangement(db, term, f, 'plan');
  },
  async 'cancel-arrangement'(db, [term], f) {
    need(f, 'actor', 'reason');
    const a = await openAccount(db, term);
    const plan = await activeArrangement(db, a);
    if (!plan) throw Error(`${a.ref} has no active arrangement`);
    return tx(db, async () => {
      await db.query(`update arrangements set status = 'cancelled', ended_on = $2 where id = $1`, [plan.arrangement_id, today()]);
      await db.query(`update accounts set status = 'active' where id = $1 and status = 'arrangement'`, [a.id]);
      await note(db, a.id, f.actor, 'cancel-arrangement', `${plan.kind} cancelled (${plan.state}): ${f.reason}`);
      return { account: a.ref, cancelled: plan.kind, was: plan.state };
    });
  },
  async dispute(db, [term], f) {
    need(f, 'actor', 'kind', 'detail');
    const a = await openAccount(db, term);
    const kind = oneOf(f.kind, DISPUTES, 'kind');
    if (await openDispute(db, a)) throw Error(`${a.ref} already has an open dispute`);
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('insert into disputes (account_id, raised_on, kind, detail) values ($1,$2,$3,$4)', [a.id, on, kind, f.detail]);
      await db.query(`update accounts set status = 'disputed' where id = $1`, [a.id]);
      await note(db, a.id, f.actor, 'dispute', `${kind}: ${f.detail}`);
      return { account: a.ref, status: 'disputed', kind, raised_on: on, next: 'Collection stops. Check it with the client; write to the debtor only to clarify or settle.' };
    });
  },
  async 'resolve-dispute'(db, [term], f) {
    need(f, 'actor', 'outcome', 'resolution');
    const a = await openAccount(db, term);
    const outcome = oneOf(f.outcome, ['upheld', 'rejected'], 'outcome');
    const p = await openDispute(db, a);
    if (!p) throw Error(`${a.ref} has no open dispute`);
    return tx(db, async () => {
      await db.query('update disputes set resolved_on = $2, outcome = $3, resolution = $4 where id = $1', [p.id, today(), outcome, f.resolution]);
      const status = outcome === 'upheld' ? 'on_hold' : 'active';
      await db.query('update accounts set status = $2, hold_reason = $3 where id = $1', [a.id, status, outcome === 'upheld' ? `Dispute upheld: ${f.resolution}` : '']);
      await note(db, a.id, f.actor, 'resolve-dispute', `${outcome}: ${f.resolution}`);
      return { account: a.ref, outcome, status, next: outcome === 'upheld' ? 'Adjust the balance (write-off) or return the account to the client.' : 'Collection can resume. Write to the debtor with the evidence first.' };
    });
  },
  async represent(db, [term], f) {
    need(f, 'actor', 'name');
    const a = await account(db, term);
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('update debtors set representative = $2, representative_contact = $3, represented_on = $4 where id = $1', [a.debtor_id, f.name, f.contact || '', on]);
      await note(db, a.id, f.actor, 'represent', `${f.name}${f.contact ? ` (${f.contact})` : ''} from ${on}`);
      return { debtor: a.debtor, representative: f.name, contact: f.contact || '', from: on, next: 'Contact the representative, not the debtor, on every account this debtor has.' };
    });
  },
  async bankrupt(db, [term], f) {
    need(f, 'actor');
    const a = await account(db, term);
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('update debtors set bankrupt_on = $2 where id = $1', [a.debtor_id, on]);
      const held = await db.query(`update accounts set status = 'on_hold', hold_reason = 'Bankrupt: unsecured debt, lodge a proof with the trustee'
        where debtor_id = $1 and status in ('active','arrangement','legal','disputed') returning ref`, [a.debtor_id]);
      await db.query(`update arrangements set status = 'cancelled', ended_on = $2 where status = 'active' and account_id in (select id from accounts where debtor_id = $1)`, [a.debtor_id, today()]);
      await note(db, a.id, f.actor, 'bankrupt', `Bankrupt from ${on}. On hold: ${held.map((r) => r.ref).join(', ') || 'none'}`);
      return { debtor: a.debtor, bankrupt_on: on, on_hold: held.map((r) => r.ref).join(', '), next: 'Stop all collection on unsecured debts and lodge a proof of debt with the trustee.' };
    });
  },
  async hardship(db, [term], f) {
    need(f, 'actor', 'note');
    const a = await account(db, term);
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('update debtors set hardship_on = $2 where id = $1', [a.debtor_id, on]);
      await note(db, a.id, f.actor, 'hardship', `Hardship from ${on}: ${f.note}`);
      return { debtor: a.debtor, hardship_on: on };
    });
  },
  async 'stop-contact'(db, [term], f) {
    need(f, 'actor');
    const a = await account(db, term);
    const on = notFuture(dateOr(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('update debtors set stop_contact_on = $2 where id = $1', [a.debtor_id, on]);
      await note(db, a.id, f.actor, 'stop-contact', `Written request for no further contact, received ${on}`);
      return { debtor: a.debtor, stop_contact_on: on, next: 'Decide with the client: legal action if it is possible and intended, or return the account.' };
    });
  },
  async 'written-only'(db, [term], f) {
    need(f, 'actor');
    const a = await account(db, term);
    return tx(db, async () => {
      await db.query('update debtors set written_only = true where id = $1', [a.debtor_id]);
      await note(db, a.id, f.actor, 'written-only', 'Debtor asked for written contact only');
      return { debtor: a.debtor, written_only: true };
    });
  },
  async acknowledge(db, [term], f) {
    need(f, 'actor', 'date');
    const a = await openAccount(db, term);
    const on = notFuture(date(f.date, 'date'), 'date');
    return tx(db, async () => {
      await db.query('update accounts set acknowledged_on = greatest(coalesce(acknowledged_on, $2::date), $2::date) where id = $1', [a.id, on]);
      await note(db, a.id, f.actor, 'acknowledge', `Written acknowledgement of the debt dated ${on}`);
      return { account: a.ref, acknowledged_on: on, barred_on: (await limitation(db, a)).barred_on };
    });
  },
  async hold(db, [term], f) {
    need(f, 'actor', 'reason');
    const a = await openAccount(db, term);
    return tx(db, async () => {
      await db.query(`update accounts set status = 'on_hold', hold_reason = $2 where id = $1`, [a.id, f.reason]);
      await note(db, a.id, f.actor, 'hold', f.reason);
      return { account: a.ref, status: 'on_hold', reason: f.reason };
    });
  },
  async resume(db, [term], f) {
    need(f, 'actor');
    const a = await openAccount(db, term);
    const d = await debtorOf(db, a);
    if (d.bankrupt_on) throw Error(`${a.debtor} is bankrupt: collection on an unsecured debt cannot resume`);
    if (await openDispute(db, a)) throw Error(`${a.ref} has an open dispute: resolve it first`);
    return tx(db, async () => {
      const status = (await activeArrangement(db, a)) ? 'arrangement' : 'active';
      await db.query(`update accounts set status = $2, hold_reason = '' where id = $1`, [a.id, status]);
      await note(db, a.id, f.actor, 'resume', `Back to ${status}`);
      return { account: a.ref, status };
    });
  },
  async legal(db, [term], f) {
    need(f, 'actor', 'reason');
    const a = await openAccount(db, term);
    const d = await debtorOf(db, a);
    if (d.bankrupt_on) throw Error(`${a.debtor} is bankrupt: no legal action on an unsecured debt`);
    if (await openDispute(db, a)) throw Error(`${a.ref} has an open dispute: resolve it before legal action`);
    const l = await limitation(db, a);
    if (l.barred_on <= today()) throw Error(`${a.ref} is statute-barred since ${l.barred_on} (${l.source})`);
    if ((await balance(db, a)) <= 0) throw Error(`${a.ref} owes nothing`);
    return tx(db, async () => {
      await db.query(`update accounts set status = 'legal', hold_reason = '' where id = $1`, [a.id]);
      await note(db, a.id, f.actor, 'legal', f.reason);
      return { account: a.ref, status: 'legal', barred_on: l.barred_on, reason: f.reason };
    });
  },
  async 'return-account'(db, [term], f) {
    need(f, 'actor', 'reason');
    const a = await openAccount(db, term);
    return tx(db, async () => {
      await db.query(`update accounts set status = 'returned', closed_on = $2, hold_reason = $3 where id = $1`, [a.id, today(), f.reason]);
      await db.query(`update arrangements set status = 'cancelled', ended_on = $2 where account_id = $1 and status = 'active'`, [a.id, today()]);
      await note(db, a.id, f.actor, 'return-account', f.reason);
      return { account: a.ref, status: 'returned', balance_cents: await balance(db, a), currency: a.currency, reason: f.reason };
    });
  },
  async close(db, [term], f) {
    need(f, 'actor');
    const a = await account(db, term);
    if (a.status === 'closed' || a.status === 'returned') throw Error(`${a.ref} is already ${a.status}`);
    const owed = await balance(db, a);
    if (owed > 0) throw Error(`${a.ref} still owes ${money(owed, a.currency)}: record the payment, write it off, or return the account`);
    return tx(db, async () => {
      await db.query(`update accounts set status = 'closed', closed_on = coalesce(closed_on, $2) where id = $1`, [a.id, today()]);
      await note(db, a.id, f.actor, 'close', 'Closed with nothing owing');
      return { account: a.ref, status: 'closed' };
    });
  },
  async assign(db, [term], f) {
    need(f, 'actor', 'collector');
    const a = await account(db, term);
    return tx(db, async () => {
      await db.query('update accounts set collector = $2 where id = $1', [a.id, f.collector]);
      await note(db, a.id, f.actor, 'assign', `${a.collector} to ${f.collector}`);
      return { account: a.ref, collector: f.collector };
    });
  },
  // Settle a client's trust money up to a date: trust payments less commission (on trust and direct
  // payments) and GST on the commission. Negative net means the client owes us.
  async remit(db, [term], f) {
    need(f, 'actor', 'reference');
    const c = await client(db, term);
    const to = notFuture(dateOr(f.to, 'to'), 'to');
    const pays = await db.query(`select t.* from transactions t join accounts a on a.id = t.account_id
      where a.client_id = $1 and t.kind = 'payment' and t.remittance_id is null and t.occurred_on <= $2`, [c.id, to]);
    if (!pays.length) throw Error(`Nothing to remit for ${c.code} up to ${to}`);
    const trust = pays.filter((p) => p.method === 'trust').reduce((s, p) => s + Number(p.amount_cents), 0);
    const direct = pays.filter((p) => p.method === 'direct').reduce((s, p) => s + Number(p.amount_cents), 0);
    const commission = pays.reduce((s, p) => s + Number(p.commission_cents), 0);
    const gst = Math.round((commission * c.gst_bp) / 10000);
    const net = trust - commission - gst;
    const used = await nextRef(db, `REM-${c.code}`, 'remittances');
    const ref = `REM-${c.code}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
    return tx(db, async () => {
      const [r] = await db.query(`insert into remittances (client_id, ref, period_to, made_on, trust_cents, direct_cents, commission_cents, gst_cents, net_cents, reference)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [c.id, ref, to, today(), trust, direct, commission, gst, net, f.reference]);
      await db.query(`update transactions set remittance_id = $1 where id = any($2::uuid[])`, [r.id, pays.map((p) => p.id)]);
      await note(db, null, f.actor, 'remit', `${ref}: net ${money(net, c.currency)} (${pays.length} payments)`, c.id);
      return { remittance: ref, client: c.code, period_to: to, currency: c.currency, trust_cents: trust, direct_cents: direct, commission_cents: commission, gst_cents: gst, net_cents: net,
        next: net >= 0 ? `Pay ${money(net, c.currency)} to ${c.name} from the trust account and record the bank reference.` : `${c.name} owes ${money(-net, c.currency)} in commission on payments made direct to them: invoice it.` };
    });
  },
  async 'add-task'(db, [term], f) {
    need(f, 'actor', 'title');
    const a = await account(db, term);
    return tx(db, async () => {
      const [t] = await db.query('insert into tasks (account_id, title, owner, due_on) values ($1,$2,$3,$4) returning title, owner, due_on',
        [a.id, f.title, f.owner || a.collector, f.due ? date(f.due, 'due') : null]);
      await note(db, a.id, f.actor, 'add-task', `${t.title}${t.due_on ? ` due ${t.due_on}` : ''}`);
      return { account: a.ref, ...t };
    });
  },
  async done(db, [term, what], f) {
    need(f, 'actor');
    const a = await account(db, term);
    const rows = await db.query('select * from tasks where account_id = $1 and done_on is null', [a.id]);
    const t = choose(rows, what, 'Open task', (r) => [r.title, r.id]);
    return tx(db, async () => {
      await db.query('update tasks set done_on = $2 where id = $1', [t.id, today()]);
      await note(db, a.id, f.actor, 'done', t.title);
      return { account: a.ref, task: t.title, done_on: today() };
    });
  },
  async log(db, [term], f) {
    need(f, 'actor', 'note');
    const a = await account(db, term);
    await note(db, a.id, f.actor, 'note', f.note);
    return { account: a.ref, noted: f.note };
  },
};

async function makeArrangement(db, term, f, kind) {
  const a = await openAccount(db, term);
  if (!['active', 'arrangement'].includes(a.status)) throw Error(`${a.ref} is ${a.status}: an arrangement needs an active account`);
  if (await activeArrangement(db, a)) throw Error(`${a.ref} already has an active arrangement: cancel it first`);
  const amount = cents(f.amount, 'amount');
  const first = date(kind === 'promise' ? f.due : f.first, kind === 'promise' ? 'due' : 'first');
  if (first < today()) throw Error('The first payment date cannot be in the past');
  const every = kind === 'promise' ? 'once' : oneOf(f.every, EVERY, 'every');
  const n = kind === 'promise' ? 1 : Number(f.instalments);
  if (!Number.isInteger(n) || n < 1 || n > 260) throw Error('--instalments must be a whole number from 1 to 260');
  const owed = await balance(db, a);
  if (amount * n > owed) throw Error(`${n} x ${money(amount, a.currency)} is more than the ${money(owed, a.currency)} owed`);
  return tx(db, async () => {
    await db.query(`insert into arrangements (account_id, kind, amount_cents, every, first_due, instalments, made_on, collector, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [a.id, kind, amount, every, first, n, today(), f.actor, f.note || '']);
    await db.query(`update accounts set status = 'arrangement' where id = $1`, [a.id]);
    const what = kind === 'promise' ? `Promise: ${money(amount, a.currency)} on ${first}` : `Plan: ${n} x ${money(amount, a.currency)} every ${every} from ${first}`;
    await note(db, a.id, f.actor, kind === 'promise' ? 'promise' : 'arrange', what);
    return { account: a.ref, arrangement: what, covers_cents: amount * n, balance_cents: owed, currency: a.currency,
      next: 'No further contact while it is kept, unless the debtor asks (RG 96 part 2 s 15).' };
  });
}

async function history(db, [term]) {
  const a = await account(db, term);
  const d = await debtorOf(db, a);
  const [b] = await db.query('select * from v_balances where account_id = $1', [a.id]);
  const l = await limitation(db, a);
  return {
    account: a, debtor: d, balance: b, limitation: l,
    transactions: await db.query('select occurred_on, kind, method, amount_cents, commission_cents, description, reference from transactions where account_id = $1 order by occurred_on, created_at', [a.id]),
    arrangements: await db.query('select kind, every, instalments, amount_cents, first_due, next_due, state from v_arrangements where account_id = $1 order by made_on', [a.id]),
    disputes: await db.query('select raised_on, kind, detail, resolved_on, outcome from disputes where account_id = $1 order by raised_on', [a.id]),
    contacts: await reads.contacts(db, [a.ref]),
    activity: await db.query('select at, actor, action, detail from activity where account_id = $1 order by at desc, id desc limit 50', [a.id]),
  };
}

// ------------------------------------------------------------------ import and export

// Collect! has no fixed export layout: you choose the fields when you print a debtor list to a file.
// These are the headings we look for by default; a column map renames them for your report.
const DEFAULT_MAP = {
  client_ref: ['File Number', 'File', 'Account Number', 'Account', 'Client Reference', 'Reference'],
  name: ['Name', 'Debtor', 'Debtor Name', 'Full Name'],
  owing: ['Owing', 'Balance', 'Amount Owing', 'Amount', 'Principal'],
  listed: ['Listed', 'Listed Date', 'Date Listed'],
  accrued: ['Delinquency Date', 'Default Date', 'Charged Off', 'Due Date'],
  last_paid: ['Last Payment Date', 'Last Paid', 'Last Payment'],
  state: ['State', 'Province', 'Region', 'Country'],
  phone: ['Phone', 'Home Phone', 'Mobile', 'Cell'],
  email: ['Email', 'Email Address'],
  address: ['Address', 'Street', 'Address 1'],
  collector: ['Operator', 'Collector', 'Owner'],
  description: ['Description', 'Detail', 'Comment'],
};
const STATE_WORDS = { 'new south wales': 'NSW', victoria: 'VIC', queensland: 'QLD', 'south australia': 'SA', 'western australia': 'WA', tasmania: 'TAS',
  'northern territory': 'NT', 'australian capital territory': 'ACT', 'new zealand': 'NZ', nz: 'NZ' };
function csvDate(v, label) {
  const s = String(v || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return date(m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s, label);
}

async function importCollect(db, file, f) {
  need(f, 'actor', 'client');
  if (!file) throw Error('Give the path to the CSV saved from your Collect! debtor list');
  const c = await client(db, f.client);
  const map = { ...DEFAULT_MAP };
  if (f.map) for (const [k, v] of Object.entries(JSON.parse(readFileSync(path.resolve(f.map), 'utf8')))) if (k !== '_') map[k] = Array.isArray(v) ? v : [v];
  const rows = parseCsv(readFileSync(path.resolve(file), 'utf8'));
  const prepared = rows.map((r, i) => {
    const row = i + 2;
    const name = pick(r, ...map.name).trim();
    if (!name) throw Error(`Row ${row}: no debtor name`);
    const rawState = pick(r, ...map.state).trim();
    const state = STATES.includes(rawState.toUpperCase()) ? rawState.toUpperCase() : STATE_WORDS[rawState.toLowerCase()];
    if (!state) throw Error(`Row ${row}: state "${rawState}" is not an Australian state or territory, or NZ`);
    if ((state === 'NZ') !== (c.jurisdiction === 'NZ')) throw Error(`Row ${row}: ${c.code} collects in ${c.jurisdiction}; ${name} is in ${state}`);
    const owing = cents(pick(r, ...map.owing), `owing on row ${row}`);
    const listed = csvDate(pick(r, ...map.listed), `listed date on row ${row}`) || today();
    const accrued = csvDate(pick(r, ...map.accrued), `default date on row ${row}`);
    if (!accrued) throw Error(`Row ${row}: no default date. The limitation period runs from it, so it cannot be guessed`);
    if (accrued > listed) throw Error(`Row ${row}: default date is after the listing date`);
    const lastPaid = csvDate(pick(r, ...map.last_paid), `last payment date on row ${row}`);
    return { client_ref: pick(r, ...map.client_ref).trim(), name, state, owing, listed, accrued, last_paid: lastPaid,
      phone: pick(r, ...map.phone).trim(), email: pick(r, ...map.email).trim(), address: pick(r, ...map.address).trim(),
      collector: pick(r, ...map.collector).trim() || 'Unassigned', description: pick(r, ...map.description).trim(), source: r };
  });
  const seen = new Set();
  for (const p of prepared) if (p.client_ref) { const k = p.client_ref.toLowerCase(); if (seen.has(k)) throw Error(`Duplicate row in file: ${p.client_ref}`); seen.add(k); }
  let added = 0, skipped = 0, debtors = 0;
  await db.exec('begin');
  try {
    let next = Math.max(1000, ...(await nextRef(db, c.code, 'accounts')));
    for (const p of prepared) {
      if (p.client_ref) {
        const [ex] = await db.query(`select a.ref, b.listed_cents from accounts a join v_balances b on b.account_id = a.id where a.client_id = $1 and lower(a.client_ref) = lower($2)`, [c.id, p.client_ref]);
        if (ex) {
          if (Number(ex.listed_cents) !== p.owing) throw Error(`Import conflict: ${p.client_ref} is already ${ex.ref} with a different amount. Nothing imported.`);
          skipped++;
          continue;
        }
      }
      let [d] = await db.query('select * from debtors where lower(name) = lower($1) and state = $2', [p.name, p.state]);
      if (!d) {
        [d] = await db.query('insert into debtors (name, state, phone, email, address) values ($1,$2,$3,$4,$5) returning *', [p.name, p.state, p.phone, p.email, p.address]);
        debtors++;
      }
      next++;
      const [a] = await db.query(`insert into accounts (ref, client_id, debtor_id, client_ref, description, listed_on, accrued_on, acknowledged_on, collector, source)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`, [`${c.code}-${next}`, c.id, d.id, p.client_ref, p.description, p.listed, p.accrued, p.last_paid, p.collector, JSON.stringify(p.source)]);
      await db.query(`insert into transactions (account_id, occurred_on, kind, amount_cents, description) values ($1,$2,'principal',$3,'Imported from Collect!: balance owing')`, [a.id, p.listed, p.owing]);
      added++;
    }
    await note(db, null, f.actor, 'import', `Collect! debtor list: ${added} accounts, ${debtors} new debtors, ${skipped} already there${f['dry-run'] ? ' (dry run)' : ''}`, c.id);
    await db.exec(f['dry-run'] ? 'rollback' : 'commit');
  } catch (err) { await db.exec('rollback'); throw err; }
  return { client: c.code, added, new_debtors: debtors, skipped, dry_run: Boolean(f['dry-run']) };
}

const EXPORT_TABLES = ['clients', 'debtors', 'accounts', 'transactions', 'contacts', 'arrangements', 'disputes', 'remittances', 'tasks', 'activity',
  'contact_hours', 'contact_limits', 'holidays', 'limitation_rules'];
async function exportAll(db, f) {
  const out = {};
  for (const t of EXPORT_TABLES) out[t] = await db.query(`select * from ${t} order by 1`);
  if (f.out) { writeFileSync(path.resolve(f.out), JSON.stringify(out, null, 2), { flag: 'wx', mode: 0o600 }); return { written: path.resolve(f.out) }; }
  return out;
}

// ------------------------------------------------------------------ drafts (never sent)

function draft(name, body) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let file = path.join(dir, `${today()}-${name}.md`);
  for (let i = 2; existsSync(file); i++) file = path.join(dir, `${today()}-${name}-${i}.md`);
  writeFileSync(file, `${body.trim()}\n\nDraft only. Nothing sent.\n`, { mode: 0o600 });
  return file;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
const tableMd = (rows) => (rows.length ? [`| ${Object.keys(rows[0]).join(' | ')} |`, `|${Object.keys(rows[0]).map(() => '---').join('|')}|`, ...rows.map((r) => `| ${Object.values(r).map((v) => String(v ?? '')).join(' | ')} |`)].join('\n') : '_None._');
const HELP = { AU: 'You can get free, confidential help from a financial counsellor through the National Debt Helpline on 1800 007 007.', NZ: 'You can get free help from a financial mentor: [service and number confirmed by the operator].' };

const drafts = {
  async 'draft-demand'(db, [term]) {
    const a = await openAccount(db, term);
    const d = await debtorOf(db, a);
    if (d.bankrupt_on) throw Error(`${a.debtor} is bankrupt: no demand on an unsecured debt`);
    if (d.stop_contact_on) throw Error(`${a.debtor} asked in writing on ${d.stop_contact_on} for no further contact`);
    if (await openDispute(db, a)) throw Error(`${a.ref} is disputed: write to clarify or settle, not to demand`);
    const owed = await balance(db, a);
    const l = await limitation(db, a);
    const barred = l.barred_on <= today();
    const [c] = await db.query('select * from clients where id = $1', [a.client_id]);
    const to = d.represented_on ? `${d.representative}${d.representative_contact ? ` (${d.representative_contact})` : ''}, representing ${d.name}` : d.name;
    const file = draft(slug(`${a.ref}-demand`), `
# ${a.ref}: request for payment

To ${to}${d.address && !d.represented_on ? `\n${d.address}` : ''}

We act for ${c.name}. Their records show ${money(owed, a.currency)} owing on account ${a.client_ref || a.ref}${a.description ? ` (${a.description})` : ''}.

Please pay the balance, or contact us to agree payments you can afford. If you do not believe you owe this amount, tell us in writing. We will stop collection while we check it with ${c.name} and send you what they hold.

${barred ? `[This debt is more than ${l.years} years old. Do not say or imply that legal action will or may be taken. Confirm the wording with the operator before sending.]` : '[Only if legal action is genuinely intended and possible, say so plainly here. Otherwise leave this out.]'}

${HELP[c.jurisdiction]}

How to pay: [trust account details or payment link]
Reference: ${a.ref}

[Collector name]
[Agency name and licence number where your state requires one]`);
    return { file, to, barred };
  },
  async 'draft-arrangement-letter'(db, [term]) {
    const a = await openAccount(db, term);
    const d = await debtorOf(db, a);
    const plan = await activeArrangement(db, a);
    if (!plan) throw Error(`${a.ref} has no active arrangement`);
    const [r] = await db.query('select * from arrangements where id = $1', [plan.arrangement_id]);
    const dates = (await db.query(`select (case $2 when 'week' then $1::date + 7 * n when 'fortnight' then $1::date + 14 * n
        when 'month' then ($1::date + make_interval(months => n))::date else $1::date end) as due from generate_series(0, $3::int - 1) n`, [r.first_due, r.every, r.instalments])).map((x) => x.due);
    const owed = await balance(db, a);
    const file = draft(slug(`${a.ref}-arrangement`), `
# ${a.ref}: your payment arrangement

To ${d.represented_on ? `${d.representative}, representing ${d.name}` : d.name}

Thank you for agreeing this arrangement. Balance today: ${money(owed, a.currency)}.

${tableMd(dates.map((due, i) => ({ payment: i + 1, due, amount: money(r.amount_cents, a.currency) })))}

${r.instalments * Number(r.amount_cents) < owed ? `After these payments ${money(owed - r.instalments * Number(r.amount_cents), a.currency)} will remain. We will review the arrangement with you then.` : 'These payments clear the balance.'}

While you keep to it we will not contact you unless you ask us to. If your circumstances change, tell us before a payment is missed and we will look at it again.

How to pay: [trust account details or payment link]
Reference: ${a.ref}`);
    return { file, payments: dates.length };
  },
  async 'draft-client-report'(db, [term]) {
    const c = await client(db, term);
    const rows = await reads.accounts(db, [], { client: c.code });
    const collected = await db.query(`select coalesce(sum(t.amount_cents), 0) as n from transactions t join accounts a on a.id = t.account_id
      where a.client_id = $1 and t.kind = 'payment' and t.occurred_on > current_date - 30`, [c.id]);
    const waiting = await db.query(`select a.ref, d.name as debtor, p.kind, p.detail, p.raised_on from disputes p join accounts a on a.id = p.account_id join debtors d on d.id = a.debtor_id
      where a.client_id = $1 and p.resolved_on is null`, [c.id]);
    const [t] = await db.query('select * from v_trust where client_id = $1', [c.id]);
    const file = draft(slug(`${c.code}-client-report`), `
# ${c.name}: collections report, ${today()}

Collected in the last 30 days: ${money(collected[0].n, c.currency)}. Held in trust for you: ${money(t.trust_cents, c.currency)}. Last remittance: ${t.last_remitted_on || 'none yet'}.

## Open accounts
${tableMd(rows.map((r) => ({ ref: r.ref, debtor: r.debtor, status: r.status, balance: money(r.balance_cents, r.currency), paid: money(r.paid_cents, r.currency), last_contact: r.last_tried_on || '' })))}

## We need your help with
${waiting.length ? waiting.map((w) => `- ${w.ref} ${w.debtor}: ${w.kind} dispute raised ${w.raised_on}. ${w.detail}. [What we need from you]`).join('\n') : '- Nothing this month.'}

[Collector name]`);
    return { file, accounts: rows.length };
  },
  async 'weekly-review'(db) {
    const attention = await reads.attention(db);
    const comp = (await compliance(db)).filter((r) => r.severity === 'breach');
    const work = await reads.worklist(db, [], {});
    const trust = await reads.trust(db);
    const file = draft('weekly-review', `
# Monday collections review, ${today()}

## Needs attention
${tableMd(attention)}

## Compliance breaches on file
${tableMd(comp.map(({ source, ...r }) => r))}

## Worklist (${work.length} accounts ready to work)
${tableMd(work.slice(0, 15).map((r) => ({ ref: r.ref, debtor: r.debtor, why: r.why, collector: r.collector, balance: money(r.balance_cents, r.currency), how: r.how })))}

## Trust money
${tableMd(trust.map((r) => ({ client: r.client, held: money(r.trust_cents, r.currency), net_due: money(r.net_due_cents, r.currency), since: r.oldest_trust_on || '', remit: r.remit })))}`);
    return { file, attention: attention.length, breaches: comp.length, worklist: work.length };
  },
};

// ------------------------------------------------------------------ ten questions

export const insights = [
  ['Which accounts become statute-barred in the next 180 days, and how much is owed on them?', `
    select ref, debtor, state, collector, status, currency, balance_cents, barred_on, barred_on - current_date as days_left
    from v_limitation where balance_cents > 0 and status not in ('paid','returned','closed') and barred_on between current_date and current_date + 180
    order by barred_on`],
  ['What share of what each client listed have we collected, and how fast does the first payment come?', `
    select c.code as client, c.currency, sum(b.listed_cents) as listed_cents, sum(b.paid_cents) as collected_cents,
      round(100.0 * sum(b.paid_cents) / nullif(sum(b.listed_cents), 0), 1) as recovered_pct,
      round(avg((select min(t.occurred_on) from transactions t where t.account_id = b.account_id and t.kind = 'payment') - b.listed_on), 0) as avg_days_to_first_payment
    from v_balances b join clients c on c.id = b.client_id group by c.code, c.currency order by recovered_pct desc nulls last`],
  ['Which collectors set arrangements that are kept, and which set ones that break?', `
    select r.collector, count(*)::int as arrangements, count(*) filter (where v.state in ('kept','completed','on track'))::int as kept_or_on_track,
      count(*) filter (where v.state = 'broken')::int as broken, count(*) filter (where v.state = 'cancelled')::int as cancelled
    from arrangements r join v_arrangements v on v.arrangement_id = r.id group by r.collector order by broken desc, arrangements desc`],
  ['Which contact channel is followed by a payment within 7 days?', `
    select k.channel, count(*)::int as contacts,
      count(*) filter (where exists (select 1 from transactions t where t.account_id = k.account_id and t.kind = 'payment'
        and t.occurred_on between k.local_at::date and k.local_at::date + 7))::int as paid_within_7_days,
      round(100.0 * count(*) filter (where exists (select 1 from transactions t where t.account_id = k.account_id and t.kind = 'payment'
        and t.occurred_on between k.local_at::date and k.local_at::date + 7)) / count(*), 1) as pct
    from contacts k where k.direction = 'out' and k.outcome = 'contact' group by k.channel order by pct desc, contacts desc`],
  ['At what time of day do calls reach the debtor rather than ring out?', `
    select extract(hour from local_at)::int as local_hour, count(*)::int as calls,
      count(*) filter (where outcome = 'contact')::int as reached, round(100.0 * count(*) filter (where outcome = 'contact') / count(*), 1) as reach_pct
    from contacts where direction = 'out' and channel = 'phone' group by 1 order by 1`],
  ['Which debtors owe on more than one account, so one call can cover them all?', `
    select d.name as debtor, d.state, count(*)::int as accounts, string_agg(b.ref || ' (' || b.client || ')', ', ' order by b.ref) as refs,
      sum(b.balance_cents) as owed_cents, min(b.currency) as currency
    from v_balances b join debtors d on d.id = b.debtor_id where b.status not in ('paid','returned','closed') and b.balance_cents > 0
    group by d.id having count(*) > 1 order by owed_cents desc`],
  ["How much of each client's money is in trust past their remittance terms?", `
    select client, name, currency, trust_cents, oldest_trust_on, current_date - oldest_trust_on as days_held, remit_days
    from v_trust where trust_cents > 0 order by days_held desc`],
  ['Which open accounts have had no contact attempt at all in 30 days?', `
    select ref, debtor, client, collector, status, currency, balance_cents, coalesce(last_tried_on::text, 'never') as last_tried
    from v_balances where status in ('active','arrangement','on_hold') and balance_cents > 0 and (last_tried_on is null or last_tried_on < current_date - 30)
    order by balance_cents desc`],
  ['How old is the book, by client, in age bands since listing?', `
    select client, currency,
      sum(balance_cents) filter (where current_date - listed_on <= 30) as days_0_30_cents,
      sum(balance_cents) filter (where current_date - listed_on between 31 and 90) as days_31_90_cents,
      sum(balance_cents) filter (where current_date - listed_on between 91 and 180) as days_91_180_cents,
      sum(balance_cents) filter (where current_date - listed_on > 180) as over_180_cents
    from v_balances where status not in ('paid','returned','closed') group by client, currency order by client`],
  ['Which accounts are already at the weekly contact limit?', `
    select b.ref, b.debtor, b.collector, count(k.*)::int as contacts_last_7_days, l.per_7_days as limit_7_days
    from v_balances b join debtors d on d.id = b.debtor_id join contact_limits l on l.jurisdiction = juris(d.state)
    left join contacts k on k.account_id = b.account_id and k.direction = 'out' and k.outcome = 'contact' and k.party = 'debtor' and k.channel <> 'visit'
      and k.local_at > now()::timestamp - interval '7 days'
    where b.status in ('active','arrangement') group by b.ref, b.debtor, b.collector, l.per_7_days
    having count(k.*) >= l.per_7_days order by contacts_last_7_days desc`],
];
export async function runInsights(db) {
  const out = [];
  for (const [question, sql] of insights) out.push({ question, rows: await db.query(sql) });
  return out;
}

// ------------------------------------------------------------------ dispatch

export const commands = [...Object.keys(reads), 'history', ...Object.keys(writes), 'import', 'export', ...Object.keys(drafts)];

export async function run(db, command, args = [], flags = {}) {
  if (reads[command]) return reads[command](db, args, flags);
  if (command === 'history') return history(db, args);
  if (writes[command]) return writes[command](db, args, flags);
  if (drafts[command]) return drafts[command](db, args, flags);
  if (command === 'import') {
    if (String(args[0]).toLowerCase() !== 'collect') throw Error('Usage: import collect <file.csv> --client=<code> --actor=<name> [--map=<map.json>] [--dry-run]');
    return importCollect(db, args[1], flags);
  }
  if (command === 'export') return exportAll(db, flags);
  throw Error(`Unknown command "${command}". Run with --help.`);
}
