#!/usr/bin/env node
// The one CLI for the collection desk. Human tables by default, --json for machines.
//   node scripts/collections.mjs --help
import { getDb } from './lib/db.mjs';
import { run, commands } from './lib/domain.mjs';
import { table, price as money } from './lib/format.mjs';

const args = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) { args.push(a); continue; }
  const i = a.indexOf('=');
  const key = a.slice(2, i < 0 ? undefined : i);
  if (Object.hasOwn(flags, key)) { console.error(`Duplicate --${key}`); process.exit(1); }
  flags[key] = i < 0 ? true : a.slice(i + 1);
}
const command = args.shift();

const ALLOWED = ['json', 'help', 'actor', 'client', 'collector', 'status', 'days', 'channel', 'party', 'at', 'outcome', 'direction', 'note',
  'code', 'name', 'jurisdiction', 'commission', 'remit-days', 'fees-allowed', 'contact', 'debtor', 'state', 'amount', 'accrued', 'listed',
  'client-ref', 'description', 'phone', 'email', 'address', 'kind', 'ref', 'method', 'date', 'reference', 'reason', 'due', 'every', 'first',
  'instalments', 'detail', 'resolution', 'to', 'title', 'owner', 'map', 'dry-run', 'out'];

// *_cents columns print as money in the row's currency; everything else as written.
function cell(v, key, row) {
  if (v === null || v === undefined) return key.endsWith('_cents') ? '' : '';
  if (key.endsWith('_cents')) return money(v, row.currency || 'AUD');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (value[0]?.question) return value.map((x, i) => `${i + 1}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => k !== 'currency' || !value.some((r) => Object.keys(r).some((x) => x.endsWith('_cents'))));
    return table(value, keys.map((key) => ({ key, label: key.replace(/_cents$/, ''), align: key.endsWith('_cents') ? 'right' : 'left', width: 60, format: (v, row) => cell(v, key, row) })));
  }
  if (value && typeof value === 'object' && value.account && value.transactions) {
    const a = value.account;
    const d = value.debtor;
    const b = value.balance;
    const l = value.limitation;
    const cur = (rows) => rows.map((x) => ({ ...x, currency: a.currency }));
    const flagsOn = [d.represented_on && `represented by ${d.representative} from ${d.represented_on}`, d.bankrupt_on && `bankrupt from ${d.bankrupt_on}`,
      d.hardship_on && `hardship from ${d.hardship_on}`, d.stop_contact_on && `asked for no contact on ${d.stop_contact_on}`, d.written_only && 'written contact only',
      d.preferred_hours && `prefers ${d.preferred_hours}`].filter(Boolean);
    return [`${a.ref}  ${d.name} (${d.state}, ${d.kind})  for ${a.client}${a.client_ref ? ` ${a.client_ref}` : ''}  ${a.status}${a.hold_reason ? `: ${a.hold_reason}` : ''}`,
      `Collector ${a.collector}. Listed ${a.listed_on}, default ${a.accrued_on}. Statute-barred ${l.barred_on} (${l.years} years from ${l.runs_from}).`,
      `Listed ${money(b.listed_cents, a.currency)}, added ${money(b.added_cents, a.currency)}, paid ${money(b.paid_cents, a.currency)}, written off ${money(b.written_off_cents, a.currency)}, owing ${money(b.balance_cents, a.currency)}.`,
      flagsOn.length ? `Debtor: ${flagsOn.join('; ')}.` : 'Debtor: no restrictions recorded.',
      '', 'Ledger', human(cur(value.transactions)), '', 'Arrangements', human(cur(value.arrangements)), '', 'Disputes', human(value.disputes),
      '', 'Contacts (debtor local time)', human(value.contacts),
      '', 'Recent activity', human(value.activity.map((x) => ({ ...x, at: new Date(x.at).toISOString().slice(0, 16).replace('T', ' ') })))].join('\n');
  }
  return Object.entries(value || {}).map(([k, v]) => `  ${k}: ${cell(v, k, value)}`).join('\n');
}

if (!command || flags.help) {
  console.log(`Collection desk. Commands: ${commands.join(', ')}.
Options use --key=value. Every write needs --actor="<your name>". See docs/cli.md.`);
} else {
  let db;
  try {
    for (const key of Object.keys(flags)) if (!ALLOWED.includes(key)) throw Error(`Unknown option --${key}`);
    db = await getDb();
    const result = await run(db, command, args, flags);
    console.log(flags.json ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
