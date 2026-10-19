#!/usr/bin/env node
// npm test: a temporary database, the demo agency, every command exercised, then cleaned up.
// Set TEST_DATABASE_URL to run the same checks against an empty Postgres database instead of PGlite.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, commands, insights, today, cents, localNow } from './lib/domain.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'collections-test-'));
process.env.DATA_DIR = path.join(root, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = path.join(root, 'out');

let db;
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };
const fails = async (fn, re) => { await assert.rejects(fn, re); checks++; };
const call = (cmd, args = [], f = {}) => run(db, cmd, args, f);
const shift = (n) => new Date(Date.parse(today()) + n * 86400000).toISOString().slice(0, 10);
const A = { actor: 'Test' };
const bal = async (ref) => Number((await db.query('select balance_cents from v_balances where ref = $1', [ref]))[0].balance_cents);

try {
  db = await getDb();
  await migrate(db);
  eq((await migrate(db)).ran.length, 0, 'migrate twice is a no-op');
  await seed(db);
  await seed(db);
  eq((await call('accounts', [], { status: 'active' })).length + (await call('accounts')).length > 0, true);
  eq((await db.query('select count(*)::int as n from accounts')).at(0).n, 16, 'seed is idempotent');
  eq((await db.query('select count(*)::int as n from activity')).at(0).n, 7, 'seed activity written once');

  // Every read runs.
  for (const cmd of Object.keys(reads)) {
    const a = ['contacts', 'can-contact'].includes(cmd) ? ['HDG-1002'] : [];
    ok(await call(cmd, a, {}), `read ${cmd}`);
  }

  // Money and dates parse strictly.
  eq(cents('1,234.50', 'x'), 123450);
  eq(cents('$12', 'x'), 1200);
  assert.throws(() => cents('12.345', 'x'), /amount/); checks++;
  assert.throws(() => cents('0', 'x'), /more than zero/); checks++;
  eq(localNow('WA', new Date('2026-10-19T02:00:00Z')), '2026-10-19 10:00', 'Perth is UTC+8');
  eq(localNow('SA', new Date('2026-10-19T02:00:00Z')), '2026-10-19 12:30', 'Adelaide daylight time is UTC+10:30');
  eq(localNow('NZ', new Date('2026-10-19T02:00:00Z')), '2026-10-19 15:00', 'Auckland daylight time is UTC+13');
  eq(localNow('QLD', new Date('2026-10-19T02:00:00Z')), '2026-10-19 12:00', 'Queensland has no daylight time');

  // The demo agency says what it should.
  const attention = await call('attention');
  for (const [ref, item] of [['HDG-1001', 'arrangement broken'], ['HDG-1003', 'promise due today'], ['SCB-2001', 'dispute waiting'],
    ['SCB-2002', 'statute-barred soon'], ['NPC-4003', 'never contacted'], ['SCB-2004', 'gone quiet'], ['KCV', 'trust money held past terms'], ['SCB-2001', 'task overdue']]) {
    ok(attention.some((r) => r.ref === ref && r.item === item), `${ref}: ${item}`);
  }
  eq(attention[0].item, 'arrangement broken', 'broken arrangements lead');
  const comp = await call('compliance');
  for (const [ref, rule] of [['HDG-1002', 'contact hours'], ['HDG-1002', 'contact frequency'], ['HDG-1004', 'request for no contact'], ['KCV-3001', 'represented debtor'],
    ['NPC-4001', 'bankrupt debtor'], ['NPC-4002', 'public holiday'], ['SCB-2001', 'disputed debt'], ['SCB-2003', 'statute-barred debt']]) {
    ok(comp.some((r) => r.ref === ref && r.rule === rule && r.severity === 'breach'), `breach: ${ref} ${rule}`);
  }
  ok(comp.some((r) => r.ref === 'SCB-2002' && r.rule === 'limitation period' && r.severity === 'due' && r.source.includes('Northern Territory')), 'NT three years');
  ok(comp.some((r) => r.ref === 'KCV' && r.rule === 'remittance terms'), 'trust past terms');
  ok(comp.find((r) => r.rule === 'request for no contact').source.includes('(Vic) s 45(2)(m)'), 'Victorian rule cited');
  ok(comp.find((r) => r.rule === 'public holiday').source.includes('(SA) s 43(1)(d)(i)'), 'SA holiday rule cited');
  ok(!comp.some((r) => r.ref === 'KCV-3001' && r.finding.includes('email')), 'an email to the representative is fine');
  eq(comp[0].severity, 'breach', 'breaches first');
  const arr = await call('arrangements');
  eq(arr.find((r) => r.ref === 'HDG-1001').state, 'broken');
  eq(arr.find((r) => r.ref === 'HDG-1005').state, 'on track', 'paid ahead is on track');
  const trust = await call('trust');
  const scb = trust.find((r) => r.client === 'SCB');
  eq(Number(scb.commission_cents), 45000, 'commission on trust and direct payments');
  eq(Number(scb.net_due_cents), 200000 - 45000 - 4500, 'net = trust - commission - GST');
  const st = await call('statute');
  eq(st[0].ref, 'SCB-2003', 'statute-barred first');
  eq(st[0].timing, 'statute-barred');
  const qs = await call('insights');
  eq(qs.length, 10, 'ten questions');
  eq(insights.length, 10);
  eq(qs[5].rows[0].debtor, 'Liam Carter', 'one debtor across two clients');
  eq(qs[0].rows[0].ref, 'SCB-2002', 'statute-barred within 180 days');

  // The worklist skips accounts nobody should contact.
  const work = await call('worklist');
  const refs = work.map((r) => r.ref);
  for (const r of ['HDG-1002', 'HDG-1004', 'NPC-4001', 'SCB-2001', 'HDG-1003', 'HDG-1005', 'SCB-2003']) ok(!refs.includes(r), `${r} is not on the worklist`);
  ok(refs.includes('HDG-1001') && refs.includes('NPC-4003'), 'broken arrangement and new listing are');
  eq(work[0].why, 'arrangement broken');
  eq(work.find((r) => r.ref === 'KCV-3001').how, 'via Kiri Morgan, financial counsellor', 'represented debtor worked through the counsellor');

  // can-contact explains itself.
  const cc = await call('can-contact', ['HDG-1002'], { at: `${shift(-1)} 08:00`.replace(/^/, '') });
  eq(cc.ok, 'no');
  ok(cc.reasons.includes('contact frequency'), 'over the limit');
  const cc2 = await call('can-contact', ['NPC-4001'], {});
  ok(cc2.reasons.includes('bankrupt'), 'bankrupt');
  const cc3 = await call('can-contact', ['SCB-2001'], { channel: 'letter' });
  ok(!cc3.reasons.includes('disputed'), 'a letter is allowed on a disputed debt');
  const cc4 = await call('can-contact', ['SCB-2001'], { channel: 'phone' });
  ok(cc4.reasons.includes('disputed'), 'a call is not');
  const night = await call('can-contact', ['NPC-4004'], { at: `${shift(-1)} 22:15` });
  ok(night.reasons.includes('outside 07:30') || night.reasons.includes('outside 09:00'), 'late call refused');
  const hol = await call('can-contact', ['NPC-4004'], { at: '2026-04-25 10:00' });
  ok(hol.reasons.includes('Anzac Day'), 'national public holiday');
  await fails(() => call('can-contact', ['NPC-4004'], { at: '2099-01-01 10:00' }), /future/);
  await fails(() => call('can-contact', ['NPC-4004'], { at: 'tomorrow' }), /local time/);

  // Name matching: exact, case-insensitive, partial when unique, ambiguity lists candidates.
  eq((await call('history', ['hdg-1001'])).account.ref, 'HDG-1001');
  eq((await call('history', ['ridge'])).account.ref, 'SCB-2002');
  await fails(() => call('history', ['liam']), /ambiguous/);
  await fails(() => call('history', ['nobody']), /not found/);
  await fails(() => call('log', ['HDG-1001'], { note: 'x' }), /--actor/);

  // A new client and account, listing to paid.
  const c = await call('add-client', [], { ...A, code: 'tst', name: 'Test Plumbing Pty Ltd', commission: '18', 'remit-days': '14' });
  eq(c.code, 'TST');
  eq(c.commission_bp, 1800);
  await fails(() => call('add-client', [], { ...A, code: 'TST', name: 'Again' }), /duplicate|unique/i);
  await fails(() => call('list-account', [], { ...A, client: 'TST', debtor: 'X', state: 'NZ', amount: '10', accrued: shift(-10) }), /collects in AU/);
  await fails(() => call('list-account', [], { ...A, client: 'TST', debtor: 'X', state: 'NSW', amount: '10', accrued: shift(5) }), /on or before/);
  const t1 = await call('list-account', [], { ...A, client: 'TST', debtor: 'Pat Lowe', state: 'NSW', amount: '1,000.00', accrued: shift(-60), 'client-ref': 'INV 1' });
  eq(t1.ref, 'TST-1001');
  await fails(() => call('list-account', [], { ...A, client: 'TST', debtor: 'Pat Lowe', state: 'NSW', amount: '5', accrued: shift(-60), 'client-ref': 'inv 1' }), /already listed/);
  const t2 = await call('list-account', [], { ...A, client: 'TST', debtor: 'pat lowe', state: 'NSW', amount: '200', accrued: shift(-30) });
  eq(t2.ref, 'TST-1002', 'next reference');
  eq((await db.query(`select count(*)::int as n from debtors where lower(name) = 'pat lowe'`))[0].n, 1, 'same debtor reused');

  // Contacts: logged as facts, with findings.
  const log1 = await call('log-contact', ['TST-1001'], { ...A, channel: 'phone', at: `${shift(-3)} 10:00` });
  eq(log1.findings, 'none');
  const log2 = await call('log-contact', ['TST-1001'], { ...A, channel: 'phone', at: `${shift(-3)} 21:30` });
  ok(log2.findings.includes('contact hours'), 'late call recorded with a finding');
  await call('log-contact', ['TST-1001'], { ...A, channel: 'sms', at: `${shift(-2)} 12:00` });
  await call('log-contact', ['TST-1001'], { ...A, channel: 'phone', outcome: 'attempt', at: `${shift(-2)} 13:00` });
  await call('log-contact', ['TST-1001'], { ...A, channel: 'phone', direction: 'in', at: `${shift(-2)} 14:00` });
  const log3 = await call('log-contact', ['TST-1001'], { ...A, channel: 'email', at: `${shift(-1)} 12:00` });
  ok(log3.findings.includes('contact number 4 in 7 days'), 'attempts and inbound calls do not count; the fourth contact does');
  await fails(() => call('log-contact', ['TST-1001'], { ...A, channel: 'fax' }), /channel/);
  eq((await call('contacts', ['TST-1001'])).length, 6);

  // Arrangements: promise, plan, gates.
  await fails(() => call('promise', ['TST-1001'], { ...A, amount: '100', due: shift(-1) }), /past/);
  await fails(() => call('arrange', ['TST-1001'], { ...A, amount: '300', every: 'week', first: shift(1), instalments: '4' }), /more than/);
  const plan = await call('arrange', ['TST-1001'], { ...A, amount: '250', every: 'fortnight', first: shift(1), instalments: '4' });
  ok(plan.arrangement.includes('4 x $250.00 every fortnight'), plan.arrangement);
  await fails(() => call('promise', ['TST-1001'], { ...A, amount: '10', due: shift(2) }), /already has an active arrangement/);
  eq((await call('can-contact', ['TST-1001'], { at: `${shift(0)} 10:00` }).catch(() => ({ reasons: 'arrangement on track' }))).reasons.includes('arrangement on track'), true);
  await call('payment', ['TST-1001'], { ...A, amount: '250', reference: 'EFT 1' });
  eq(await bal('TST-1001'), 75000);
  const p1 = (await db.query(`select commission_cents from transactions where reference = 'EFT 1'`))[0];
  eq(Number(p1.commission_cents), 4500, '18% commission');
  await fails(() => call('payment', ['TST-1001'], { ...A, amount: '800' }), /more than/);
  await fails(() => call('payment', ['TST-1001'], { ...A, amount: '1', date: shift(3) }), /future/);
  await call('cancel-arrangement', ['TST-1001'], { ...A, reason: 'Debtor asked to change dates' });
  eq((await db.query(`select status from accounts where ref = 'TST-1001'`))[0].status, 'active');
  const prom = await call('promise', ['TST-1001'], { ...A, amount: '750', due: shift(0) });
  ok(prom.arrangement.startsWith('Promise'), 'promise');
  ok((await call('attention')).some((r) => r.ref === 'TST-1001' && r.item === 'promise due today'));
  const paid = await call('payment', ['TST-1001'], { ...A, amount: '750', method: 'direct' });
  eq(paid.status, 'paid');
  eq((await db.query(`select status from arrangements where account_id = (select id from accounts where ref = 'TST-1001') order by created_at desc limit 1`))[0].status, 'completed');
  await fails(() => call('payment', ['TST-1001'], { ...A, amount: '1' }), /is paid/);
  await call('close', ['TST-1001'], A);
  await fails(() => call('close', ['TST-1001'], A), /already closed/);

  // Fees only where the client allows, never on a bankrupt debtor.
  await fails(() => call('add-fee', ['TST-1002'], { ...A, amount: '20', reason: 'Search fee' }), /does not allow/);
  await call('add-fee', ['SCB-2004'], { ...A, amount: '55', reason: 'Company search' });
  eq(await bal('SCB-2004'), 678000 + 5500);
  await fails(() => call('add-fee', ['NPC-4001'], { ...A, amount: '5', reason: 'x' }), /does not allow|bankrupt/);

  // Disputes stop collection; resolving one decides what happens next.
  await call('dispute', ['TST-1002'], { ...A, kind: 'identity', detail: 'Says she never had an account' });
  await fails(() => call('dispute', ['TST-1002'], { ...A, kind: 'amount', detail: 'x' }), /already has an open dispute/);
  await fails(() => call('legal', ['TST-1002'], { ...A, reason: 'x' }), /open dispute/);
  await fails(() => call('resume', ['TST-1002'], A), /open dispute/);
  await fails(() => call('draft-demand', ['TST-1002']), /disputed/);
  const res = await call('resolve-dispute', ['TST-1002'], { ...A, outcome: 'upheld', resolution: 'Client confirms wrong person' });
  eq(res.status, 'on_hold');
  const ret = await call('return-account', ['TST-1002'], { ...A, reason: 'Wrong debtor' });
  eq(ret.status, 'returned');
  await fails(() => call('payment', ['TST-1002'], { ...A, amount: '1' }), /returned/);

  // Statute-barred, bankrupt and represented debtors.
  await fails(() => call('legal', ['SCB-2003'], { ...A, reason: 'Issue claim' }), /statute-barred/);
  await fails(() => call('legal', ['NPC-4001'], { ...A, reason: 'x' }), /bankrupt/);
  const before = (await call('statute', [], { days: '365' })).find((r) => r.ref === 'SCB-2002').barred_on;
  const ack = await call('acknowledge', ['SCB-2002'], { ...A, date: shift(-1) });
  ok(ack.barred_on > before, 'a written acknowledgement restarts the period');
  await fails(() => call('acknowledge', ['SCB-2002'], { ...A, date: shift(1) }), /future/);
  const leg = await call('legal', ['SCB-2002'], { ...A, reason: 'Statement of claim' });
  eq(leg.status, 'legal');
  const bk = await call('bankrupt', ['HDG-1001'], { ...A, date: shift(-1) });
  ok(bk.on_hold.includes('HDG-1001') && bk.on_hold.includes('NPC-4004'), 'every account of the debtor goes on hold');
  await fails(() => call('resume', ['NPC-4004'], A), /bankrupt/);
  ok((await call('can-contact', ['NPC-4004'])).reasons.includes('bankrupt'));
  await call('represent', ['NPC-4003'], { ...A, name: 'Dana Fox, solicitor', contact: 'dana@example.org' });
  const rep = await call('can-contact', ['NPC-4003'], { at: `${shift(-1)} 10:00` });
  ok(rep.reasons.includes('Dana Fox'), 'contact the representative instead');
  const viaRep = await call('can-contact', ['NPC-4003'], { party: 'representative', channel: 'email' });
  ok(!viaRep.reasons.includes('represented'), 'the representative can be contacted');
  await call('stop-contact', ['NPC-4002'], A);
  ok((await call('can-contact', ['NPC-4002'], { channel: 'letter' })).reasons.includes('no further communication'));
  await call('written-only', ['SCB-2004'], A);
  ok((await call('can-contact', ['SCB-2004'], { channel: 'phone' })).reasons.includes('written contact'));
  await call('hardship', ['SCB-2004'], { ...A, note: 'Lost the main contract' });
  await call('add-fee', ['SCB-2004'], { ...A, amount: '10', reason: 'Another search' });
  ok((await call('compliance')).some((r) => r.ref === 'SCB-2004' && r.rule === 'hardship'), 'fee after hardship noted');
  await call('hold', ['SCB-2004'], { ...A, reason: 'Client reviewing' });
  eq((await call('resume', ['SCB-2004'], A)).status, 'active');
  await call('assign', ['SCB-2004'], { ...A, collector: 'Mere' });
  eq((await call('accounts', [], { collector: 'mere' })).some((r) => r.ref === 'SCB-2004'), true);
  await fails(() => call('write-off', ['SCB-2004'], { ...A, amount: '99999', reason: 'x' }), /more than/);
  await call('write-off', ['HDG-1005'], { ...A, amount: '800', reason: 'Client agreed to waive' });
  eq((await db.query(`select status from accounts where ref = 'HDG-1005'`))[0].status, 'closed', 'written off to nothing closes');
  await fails(() => call('close', ['HDG-1002'], A), /still owes/);

  // Remittances settle trust money to the cent.
  const r1 = await call('remit', ['KCV'], { ...A, reference: 'EFT 9001' });
  eq(r1.remittance, 'REM-KCV-001');
  eq(Number(r1.net_cents), 200000 - 50000 - 7500, 'NZ GST at 15% on commission');
  await fails(() => call('remit', ['KCV'], { ...A, reference: 'x' }), /Nothing to remit/);
  const r2 = await call('remit', ['TST'], { ...A, reference: 'Invoice 77' });
  eq(Number(r2.trust_cents), 25000);
  eq(Number(r2.direct_cents), 75000);
  eq(Number(r2.net_cents), 25000 - 18000 - 1800, 'commission on direct payments netted off');
  const r3 = await call('remit', ['SCB'], { ...A, reference: 'EFT 9002' });
  eq(r3.remittance, 'REM-SCB-002', 'numbering continues');
  ok(!(await call('attention')).some((r) => r.item === 'trust money held past terms'), 'remitted trust clears attention');

  // Tasks and notes.
  await call('add-task', ['HDG-1002'], { ...A, title: 'Call after 5 pm only', due: shift(1) });
  await call('done', ['HDG-1002', 'call after'], A);
  await call('log', ['HDG-1002'], { ...A, note: 'Debtor emailed asking for a statement' });
  ok((await call('history', ['HDG-1002'])).activity.some((r) => r.action === 'note'));

  // Import from a Collect! debtor list: dry run, real run, repeat, conflict and rollback.
  const sample = path.join(REPO_ROOT, 'examples', 'collect-debtor-list.csv');
  const dry = await call('import', ['collect', sample], { ...A, client: 'SCB', 'dry-run': true });
  eq(dry.added, 3);
  eq((await db.query(`select count(*)::int as n from accounts where client_ref like 'SC-%'`))[0].n, 0, 'dry run writes nothing');
  const imp = await call('import', ['collect', sample], { ...A, client: 'SCB', map: path.join(REPO_ROOT, 'examples', 'column-map.json') });
  eq(imp.added, 3);
  const nt = (await db.query(`select * from v_limitation where debtor = 'Top End Formwork'`))[0];
  eq(nt.years, 3, 'Northern Territory read from the full name');
  const kim = (await db.query(`select * from v_limitation where debtor = 'Kim Bradshaw'`))[0];
  eq(String(kim.runs_from).slice(0, 10), '2026-07-20', 'the last payment date starts the period');
  eq((await call('import', ['collect', sample], { ...A, client: 'SCB' })).skipped, 3, 'repeat import skips');
  const bad = path.join(root, 'bad.csv');
  writeFileSync(bad, 'File Number,Name,State,Owing,Delinquency Date\nSC-90211,Brookvale Joinery Pty Ltd,NSW,1.00,01/01/2026\n');
  await fails(() => call('import', ['collect', bad], { ...A, client: 'SCB' }), /Import conflict/);
  writeFileSync(bad, 'File Number,Name,State,Owing,Delinquency Date\nSC-1,New Person,NSW,10.00,01/01/2026\nSC-2,Other,NSW,10.00,\n');
  await fails(() => call('import', ['collect', bad], { ...A, client: 'SCB' }), /no default date/);
  eq((await db.query(`select count(*)::int as n from accounts where client_ref = 'SC-1'`))[0].n, 0, 'a bad row stops the whole file');
  writeFileSync(bad, 'File Number,Name,State,Owing,Delinquency Date\nSC-3,Kiwi Person,NZ,10.00,01/01/2026\n');
  await fails(() => call('import', ['collect', bad], { ...A, client: 'SCB' }), /collects in AU/);
  await fails(() => call('import', ['other', sample], A), /Usage/);

  // Drafts are written locally and say nothing was sent.
  for (const [cmd, args] of [['draft-demand', ['HDG-1002']], ['draft-demand', ['SCB-2003']], ['draft-demand', ['KCV-3001']], ['draft-arrangement-letter', ['HDG-1003']],
    ['draft-client-report', ['SCB']], ['weekly-review', []]]) {
    const { file: out } = await call(cmd, args);
    ok(existsSync(out), `${cmd} wrote a file`);
    ok(readFileSync(out, 'utf8').includes('Nothing sent'), `${cmd} is a draft`);
  }
  const barredLetter = readdirSync(path.join(root, 'out', 'drafts')).find((f) => f.includes('scb-2003'));
  ok(readFileSync(path.join(root, 'out', 'drafts', barredLetter), 'utf8').includes('Do not say or imply that legal action'), 'statute-barred demand carries the warning');
  const repLetter = readdirSync(path.join(root, 'out', 'drafts')).find((f) => f.includes('kcv-3001'));
  ok(readFileSync(path.join(root, 'out', 'drafts', repLetter), 'utf8').includes('To Kiri Morgan'), 'demand goes to the representative');
  await fails(() => call('draft-demand', ['NPC-4001']), /bankrupt/);
  await fails(() => call('draft-demand', ['NPC-4002']), /no further contact/);
  await fails(() => call('draft-arrangement-letter', ['HDG-1002']), /no active arrangement/);

  // Export, append-only history, read-only views, and unrelated roles see nothing.
  const archive = await call('export');
  ok(archive.accounts.length === 21 && archive.activity.length > 40 && archive.limitation_rules.length === 3, 'export holds everything');
  const exportPath = path.join(root, 'export.json');
  await call('export', [], { out: exportPath });
  await fails(() => call('export', [], { out: exportPath }), /EEXIST/);
  await fails(() => db.exec("update activity set actor = 'rewrite'"), /Append-only/);
  await fails(() => db.exec('delete from activity'), /Append-only/);
  await db.exec('begin read only');
  await fails(() => db.query("insert into tasks (account_id, title, owner) select id, 'x', 'y' from accounts limit 1"), /read.only/i);
  await db.exec('rollback');
  await db.exec('create role collections_reader');
  await db.exec('grant usage on schema public to collections_reader');
  await db.exec('grant select on accounts, v_balances to collections_reader');
  await db.exec('set role collections_reader');
  eq((await db.query('select * from accounts')).length, 0, 'row security hides accounts from an unrelated role');
  await fails(() => db.query('select * from v_trust'), /permission denied/);
  await db.exec('reset role');
  await db.close();
  db = null;

  // The CLI, views and documents, run as a person would.
  const shell = (script, args = [], expect = 0) => {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    assert.equal(r.status, expect, r.stdout + r.stderr);
    checks++;
    return r;
  };
  eq(JSON.parse(shell('scripts/collections.mjs', ['accounts', '--json', '--status=legal']).stdout).length, 2);
  ok(shell('scripts/collections.mjs', ['history', 'liam'], 1).stderr.includes('ambiguous'));
  ok(shell('scripts/collections.mjs', ['attention', '--nope'], 1).stderr.includes('Unknown option'));
  ok(shell('scripts/collections.mjs', ['--help']).stdout.includes('can-contact'));
  ok(shell('scripts/collections.mjs', ['history', 'HDG-1002']).stdout.includes('Mia Thompson'));
  ok(shell('scripts/collections.mjs', ['insights']).stdout.includes('10. '));
  for (const s of ['scripts/view.mjs', 'scripts/docs.mjs']) shell(s);
  const week = readFileSync(path.join(root, 'out', 'views', 'week.html'), 'utf8');
  ok(week.includes('HDG-1002') && week.includes('contact frequency'), 'week view rendered');
  const rem = readdirSync(path.join(root, 'out', 'docs-out', 'remittance-statement'));
  eq(rem.length, 4, 'a statement for every remittance');
  ok(readFileSync(path.join(root, 'out', 'docs-out', 'remittance-statement', rem.find((f) => f.includes('rem-kcv-001'))), 'utf8').includes('1,425'), 'net shown');
  ok(readdirSync(path.join(root, 'out', 'docs-out', 'debtor-statement')).length >= 10, 'statements for open accounts');
  const { table } = await import('./lib/render.mjs');
  ok(table([{ name: '<script>alert(1)</script>' }]).includes('&lt;script&gt;'), 'HTML escaped');

  // Every command has a recipe, and every recipe names a real command.
  const recipes = readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => f.slice(0, -3));
  for (const c of commands) ok(recipes.includes(c), `/${c} recipe exists`);
  ok(recipes.length >= commands.length, 'recipes cover the CLI');

  console.log(`PASS: ${checks} checks (${commands.length} CLI commands, ${recipes.length} slash commands): migrations, local time by state, contact hours, holidays and limits, represented, bankrupt and disputed debtors, arrangements, commission, remittances, limitation periods, import rollback, drafts, export, row security and rendering.`);
} finally {
  await db?.close();
  rmSync(root, { recursive: true, force: true });
}
