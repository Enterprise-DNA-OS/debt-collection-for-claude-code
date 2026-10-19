-- Fictional demo agency. Every client, debtor, number and amount is invented.
-- Dates are relative to today, so the attention list always has something to say.
-- Idempotent: run it as often as you like.

insert into clients (id, code, name, jurisdiction, currency, commission_bp, gst_bp, remit_days, fees_allowed, contact, notes) values
 ('c0000000-0000-0000-0000-000000000001','HDG','Harbourview Dental Group','AU','AUD',2000,1000,30,false,'accounts@harbourview.example','Patient accounts over 90 days. No fees to be added.'),
 ('c0000000-0000-0000-0000-000000000002','SCB','Southern Cross Building Supplies Pty Ltd','AU','AUD',1500,1000,30,true,'credit@southerncross.example','Trade accounts. Terms allow collection costs on the credit application.'),
 ('c0000000-0000-0000-0000-000000000003','KCV','Kauri Coast Vets Ltd','NZ','NZD',2500,1500,30,false,'office@kauricoastvets.example','Client accounts from three clinics.'),
 ('c0000000-0000-0000-0000-000000000004','NPC','Northpoint Physio Clinics','AU','AUD',2200,1000,21,false,'billing@northpoint.example','Gap fees and cancelled-appointment fees.')
on conflict (id) do nothing;

insert into debtors (id, name, kind, state, phone, email, address, preferred_hours, written_only, stop_contact_on, representative, representative_contact, represented_on, bankrupt_on, hardship_on, notes) values
 ('d0000000-0000-0000-0000-000000000001','Liam Carter','individual','NSW','0400 000 101','liam.c@example.com','12 Fig St, Parramatta NSW','after 5 pm on weekdays',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000002','Mia Thompson','individual','VIC','0400 000 102','mia.t@example.com','4/88 Bay Rd, Geelong VIC','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000003','Noah Williams','individual','QLD','0400 000 103','noah.w@example.com','7 Reef Ave, Cairns QLD','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000004','Coastline Renovations Pty Ltd','business','QLD','07 0000 0104','admin@coastlinereno.example','Unit 3, 21 Trade Pde, Burleigh QLD','',false,null,'','',null,null,null,'Director: Dean Hollis.'),
 ('d0000000-0000-0000-0000-000000000005','Ridge Concreting','business','NT','08 0000 0105','ridgeconcreting@example.com','PO Box 105, Palmerston NT','',false,null,'','',null,null,null,'Sole trader.'),
 ('d0000000-0000-0000-0000-000000000006','Jack Nguyen','individual','NSW','0400 000 106','jack.n@example.com','30 Elm Cres, Penrith NSW','',false,null,'','',null,null,null,'Old trade account, owner-builder.'),
 ('d0000000-0000-0000-0000-000000000007','Aroha Wilson','individual','NZ','021 000 107','aroha.w@example.co.nz','15 Totara Rd, Whangarei','',false,null,'Kiri Morgan, financial counsellor','kiri.m@example.org',current_date - 12,null,current_date - 12,''),
 ('d0000000-0000-0000-0000-000000000008','Chloe Martin','individual','SA','0400 000 108','chloe.m@example.com','9 Wattle St, Mount Barker SA','',false,null,'','',null,current_date - 15,null,''),
 ('d0000000-0000-0000-0000-000000000009','Ben Hughes','individual','NZ','021 000 109','ben.h@example.co.nz','2 Kowhai Lane, Dargaville','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000010','Olivia Brown','individual','SA','0400 000 110','olivia.b@example.com','44 Gawler Pl, Adelaide SA','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000011','Ethan Lee','individual','VIC','0400 000 111','ethan.l@example.com','6 Station St, Ballarat VIC','',false,current_date - 20,'','',null,null,null,'Wrote on '|| (current_date - 20) ||' asking for no further contact.'),
 ('d0000000-0000-0000-0000-000000000012','Grace Taylor','individual','WA','0400 000 112','grace.t@example.com','18 Swan View, Midland WA','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000013','Harbour Fitouts Pty Ltd','business','NSW','02 0000 0113','accounts@harbourfitouts.example','8 Wharf Rd, Rozelle NSW','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000014','Tasman Glass & Glazing','business','NSW','02 0000 0114','ar@tasmanglass.example','2 Kent St, Wollongong NSW','',false,null,'','',null,null,null,''),
 ('d0000000-0000-0000-0000-000000000015','Sophie Walker','individual','ACT','0400 000 115','sophie.w@example.com','11 Mort St, Braddon ACT','',true,null,'','',null,null,null,'Asked for email only.')
on conflict (id) do nothing;

insert into accounts (id, ref, client_id, debtor_id, client_ref, description, listed_on, accrued_on, acknowledged_on, collector, status, hold_reason, closed_on) values
 ('a0000000-0000-0000-0000-000000000001','HDG-1001','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','INV 55102','Crown and two fillings, unpaid since treatment', current_date - 40, current_date - 120, null,'Priya','arrangement','',null),
 ('a0000000-0000-0000-0000-000000000002','HDG-1002','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','INV 55188','Orthodontic review and retainer', current_date - 25, current_date - 95, null,'Tom','active','',null),
 ('a0000000-0000-0000-0000-000000000003','HDG-1003','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','INV 55240','Root canal, second stage', current_date - 18, current_date - 100, null,'Priya','arrangement','',null),
 ('a0000000-0000-0000-0000-000000000011','HDG-1004','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000011','INV 54977','Implant consultation and scans', current_date - 70, current_date - 160, null,'Tom','active','',null),
 ('a0000000-0000-0000-0000-000000000016','HDG-1005','c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000015','INV 55003','Wisdom teeth extraction', current_date - 35, current_date - 110, null,'Priya','arrangement','',null),
 ('a0000000-0000-0000-0000-000000000004','SCB-2001','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000004','ACC 8812','Timber and fixings on 30-day terms, three invoices', current_date - 60, current_date - 150, null,'Priya','disputed','',null),
 ('a0000000-0000-0000-0000-000000000005','SCB-2002','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000005','ACC 7710','Reinforcing mesh and formwork', current_date - 200, (current_date - interval '3 years')::date + 45, null,'Tom','active','',null),
 ('a0000000-0000-0000-0000-000000000006','SCB-2003','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000006','ACC 6034','Owner-builder account, final invoice', current_date - 100, (current_date - interval '6 years')::date - 40, null,'Tom','legal','',null),
 ('a0000000-0000-0000-0000-000000000013','SCB-2004','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000013','ACC 9020','Plasterboard and cornice, two invoices', current_date - 120, current_date - 200, null,'Priya','active','',null),
 ('a0000000-0000-0000-0000-000000000015','SCB-2006','c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000014','ACC 9133','Aluminium sections', current_date - 90, current_date - 160, null,'Tom','closed','',current_date - 40),
 ('a0000000-0000-0000-0000-000000000007','KCV-3001','c0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000007','VET 20441','Surgery and overnight care, dog', current_date - 50, current_date - 140, null,'Mere','active','',null),
 ('a0000000-0000-0000-0000-000000000009','KCV-3002','c0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000009','VET 20502','Calving call-out and treatment', current_date - 80, current_date - 170, null,'Mere','paid','',null),
 ('a0000000-0000-0000-0000-000000000008','NPC-4001','c0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000008','NP 3307','Gap fees, eight sessions', current_date - 45, current_date - 130, null,'Tom','on_hold','Bankrupt: unsecured debt, lodge a proof with the trustee',null),
 ('a0000000-0000-0000-0000-000000000010','NPC-4002','c0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000010','NP 3122','Hydrotherapy block, unpaid', current_date - 300, current_date - 380, null,'Tom','active','',null),
 ('a0000000-0000-0000-0000-000000000012','NPC-4003','c0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000012','NP 3390','Cancelled-appointment fees', current_date - 6, current_date - 96, null,'Priya','active','',null),
 ('a0000000-0000-0000-0000-000000000014','NPC-4004','c0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000001','NP 3361','Gap fees, five sessions', current_date - 30, current_date - 115, null,'Priya','active','',null)
on conflict (id) do nothing;

insert into remittances (id, client_id, ref, period_to, made_on, trust_cents, direct_cents, commission_cents, gst_cents, net_cents, reference) values
 ('80000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','REM-SCB-001', current_date - 42, current_date - 40, 300000, 0, 45000, 4500, 250500, 'EFT 40018')
on conflict (id) do nothing;

insert into transactions (id, account_id, occurred_on, kind, amount_cents, method, commission_cents, remittance_id, description, reference) values
 ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', current_date - 40, 'principal', 184000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002', current_date - 25, 'principal',  96000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003', current_date - 18, 'principal', 120000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000011', current_date - 70, 'principal', 215000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000016', current_date - 35, 'principal', 120000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000004', current_date - 60, 'principal',1245000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000005', current_date - 200,'principal', 438000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000006', current_date - 100,'principal', 396000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000013', current_date - 120,'principal', 778000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000015', current_date - 90, 'principal', 300000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000007', current_date - 50, 'principal', 231000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000009', current_date - 80, 'principal', 200000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000008', current_date - 45, 'principal',  89000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000014','a0000000-0000-0000-0000-000000000010', current_date - 300,'principal', 115000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000015','a0000000-0000-0000-0000-000000000012', current_date - 6,  'principal',  72000, '', 0, null, 'Listed by client', ''),
 ('e0000000-0000-0000-0000-000000000016','a0000000-0000-0000-0000-000000000014', current_date - 30, 'principal',  64000, '', 0, null, 'Listed by client', ''),
 -- payments
 ('e0000000-0000-0000-0000-000000000101','a0000000-0000-0000-0000-000000000001', current_date - 30, 'payment',  15000, 'trust',  3000, null, 'First instalment', 'DD 1101'),
 ('e0000000-0000-0000-0000-000000000102','a0000000-0000-0000-0000-000000000016', current_date - 20, 'payment',  20000, 'trust',  4000, null, 'Instalment 1', 'EFT 2201'),
 ('e0000000-0000-0000-0000-000000000103','a0000000-0000-0000-0000-000000000016', current_date - 6,  'payment',  20000, 'trust',  4000, null, 'Instalment 2, paid early', 'EFT 2244'),
 ('e0000000-0000-0000-0000-000000000104','a0000000-0000-0000-0000-000000000004', current_date - 30, 'payment', 200000, 'trust', 30000, null, 'Part payment of the undisputed invoice', 'EFT 3310'),
 ('e0000000-0000-0000-0000-000000000105','a0000000-0000-0000-0000-000000000013', current_date - 60, 'payment', 100000, 'direct',15000, null, 'Paid straight to the client, reported by them', 'Client advice'),
 ('e0000000-0000-0000-0000-000000000106','a0000000-0000-0000-0000-000000000015', current_date - 50, 'payment', 300000, 'trust', 45000, '80000000-0000-0000-0000-000000000001', 'Paid in full', 'EFT 3002'),
 ('e0000000-0000-0000-0000-000000000107','a0000000-0000-0000-0000-000000000009', current_date - 45, 'payment', 200000, 'trust', 50000, null, 'Paid in full on the promise date', 'EFT 7001')
on conflict (id) do nothing;

insert into arrangements (id, account_id, kind, amount_cents, every, first_due, instalments, made_on, status, ended_on, collector, note) values
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','plan',   15000,'fortnight', current_date - 30, 12, current_date - 33,'active',null,'Priya','Direct debit every second Friday.'),
 ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','promise',40000,'once',      current_date,       1, current_date - 5, 'active',null,'Priya','Will pay after payday.'),
 ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000016','plan',   20000,'month',     current_date - 20,  6, current_date - 22,'active',null,'Priya','Agreed by email.'),
 ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000009','promise',200000,'once',     current_date - 45,  1, current_date - 50,'completed',current_date - 45,'Mere','')
on conflict (id) do nothing;

insert into disputes (id, account_id, raised_on, kind, detail, resolved_on, outcome, resolution) values
 ('90000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004', current_date - 20, 'amount', 'Says invoices 4410 and 4415 were credited for returned timber', null, null, '')
on conflict (id) do nothing;

insert into contacts (id, account_id, local_at, channel, direction, outcome, party, collector, note) values
 ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',(current_date - 33) + time '17:40','phone','out','contact','debtor','Priya','Agreed $150 a fortnight by direct debit.'),
 ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',(current_date - 2)  + time '17:30','phone','out','attempt','debtor','Priya','No answer. No message left.'),
 ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002',(current_date - 6)  + time '10:00','phone','out','contact','debtor','Tom','Says she will check with her partner.'),
 ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002',(current_date - 4)  + time '11:30','sms','out','contact','debtor','Tom','Reminder text.'),
 ('f0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000002',(current_date - 2)  + time '21:40','phone','out','contact','debtor','Tom','Late call, debtor annoyed.'),
 ('f0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000002',(current_date - 1)  + time '12:00','email','out','contact','debtor','Tom','Statement emailed.'),
 ('f0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000003',(current_date - 5)  + time '14:00','phone','out','contact','debtor','Priya','Promised $400 on payday.'),
 ('f0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000004',(current_date - 45) + time '09:00','letter','out','contact','debtor','Priya','Letter of demand.'),
 ('f0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000004',(current_date - 20) + time '16:10','email','in','contact','debtor','Priya','Director disputes two invoices.'),
 ('f0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000004',(current_date - 10) + time '15:00','phone','out','contact','debtor','Priya','Called to push for payment of the balance.'),
 ('f0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000005',(current_date - 12) + time '10:00','phone','out','attempt','debtor','Tom','Rang out.'),
 ('f0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000006',(current_date - 30) + time '09:00','letter','out','contact','debtor','Tom','Final notice before legal action.'),
 ('f0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000007',(current_date - 14) + time '13:00','phone','out','contact','debtor','Mere','Says she is seeing a financial counsellor.'),
 ('f0000000-0000-0000-0000-000000000014','a0000000-0000-0000-0000-000000000007',(current_date - 5)  + time '13:30','phone','out','contact','debtor','Mere','Called the debtor direct.'),
 ('f0000000-0000-0000-0000-000000000015','a0000000-0000-0000-0000-000000000007',(current_date - 4)  + time '10:00','email','out','contact','representative','Mere','Sent the statement to the counsellor.'),
 ('f0000000-0000-0000-0000-000000000016','a0000000-0000-0000-0000-000000000008',(current_date - 8)  + time '11:00','phone','out','contact','debtor','Tom','Asked about payment.'),
 ('f0000000-0000-0000-0000-000000000017','a0000000-0000-0000-0000-000000000010', timestamp '2026-10-05 11:00','phone','out','contact','debtor','Tom','Called about the hydrotherapy block.'),
 ('f0000000-0000-0000-0000-000000000018','a0000000-0000-0000-0000-000000000011',(current_date - 10) + time '09:00','letter','out','contact','debtor','Tom','Reminder letter.'),
 ('f0000000-0000-0000-0000-000000000019','a0000000-0000-0000-0000-000000000013',(current_date - 45) + time '10:30','phone','out','attempt','debtor','Priya','Accounts line went to voicemail, no message.'),
 ('f0000000-0000-0000-0000-000000000020','a0000000-0000-0000-0000-000000000014',(current_date - 9)  + time '17:45','phone','out','contact','debtor','Priya','Mentioned the dental account too.'),
 ('f0000000-0000-0000-0000-000000000021','a0000000-0000-0000-0000-000000000016',(current_date - 22) + time '10:00','email','out','contact','debtor','Priya','Plan agreed by email.'),
 ('f0000000-0000-0000-0000-000000000022','a0000000-0000-0000-0000-000000000016',(current_date - 6)  + time '12:00','email','in','contact','debtor','Priya','Paid early, sent receipt.'),
 ('f0000000-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000009',(current_date - 50) + time '09:30','phone','out','contact','debtor','Mere','Promised to pay in full.'),
 ('f0000000-0000-0000-0000-000000000024','a0000000-0000-0000-0000-000000000015',(current_date - 70) + time '11:00','phone','out','contact','debtor','Tom','Agreed to pay in full.')
on conflict (id) do nothing;

insert into tasks (id, account_id, title, owner, due_on, done_on) values
 ('70000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','Ask Southern Cross for the credit notes on 4410 and 4415','Priya', current_date - 3, null),
 ('70000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000007','Send hardship options to the financial counsellor','Mere', current_date + 2, null)
on conflict (id) do nothing;

insert into activity (account_id, client_id, actor, action, detail)
select v.account_id::uuid, v.client_id::uuid, v.actor, v.action, v.detail from (values
 ('a0000000-0000-0000-0000-000000000001', null, 'Priya', 'arrange', 'Plan: 12 x $150.00 every fortnight'),
 ('a0000000-0000-0000-0000-000000000004', null, 'Priya', 'dispute', 'amount: Says invoices 4410 and 4415 were credited for returned timber'),
 ('a0000000-0000-0000-0000-000000000006', null, 'Tom', 'legal', 'Referred for a statement of claim'),
 ('a0000000-0000-0000-0000-000000000007', null, 'Mere', 'represent', 'Kiri Morgan, financial counsellor'),
 ('a0000000-0000-0000-0000-000000000008', null, 'Tom', 'bankrupt', 'Bankruptcy recorded'),
 ('a0000000-0000-0000-0000-000000000011', null, 'Tom', 'stop-contact', 'Written request for no further contact'),
 (null, 'c0000000-0000-0000-0000-000000000002', 'Accounts', 'remit', 'REM-SCB-001: net $2,505.00')
) as v(account_id, client_id, actor, action, detail)
where not exists (select 1 from activity);
