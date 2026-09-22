import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialProfile,reduceProfile,validateProfile} from '../src/economy.ts';
test('a purchase and settlement preserve accounting; repeated settlement is idempotent',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:100});assert.equal(p.balance,9900);
 const q=reduceProfile(p,{type:'settle',id:'a',slot:2});assert.equal(q.balance,10100);assert.equal(q.wagered,100);assert.equal(q.earned,200);assert.equal(q.rounds,1);
 assert.deepEqual(reduceProfile(q,{type:'settle',id:'a',slot:2}),q);
});
test('fractional multiplier pays whole coins and refund cannot be duplicated',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:10});const q=reduceProfile(p,{type:'settle',id:'a',slot:4});assert.equal(q.balance,9995);
 const center=reduceProfile(p,{type:'settle',id:'a',slot:5});assert.equal(center.balance,9991);
 const r=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:500});const s=reduceProfile(r,{type:'recover'});assert.equal(s.balance,10000);assert.equal(reduceProfile(s,{type:'recover'}).balance,10000);assert.equal(reduceProfile(s,{type:'refund',id:'a'}).balance,10000);
});
test('old saves and backups retain 0.7x and 1x history after the balance update',()=>{
 const p=initialProfile();p.balance=9570;p.owned.push('ball-lime');p.equipped.ball='ball-lime';
 p.results=[{id:'legacy-07',bet:100,multiplier:.7,payout:70,time:1},{id:'legacy-1',bet:100,multiplier:1,payout:100,time:2},{id:'legacy-01',bet:100,multiplier:.1,payout:10,time:3}];
 const restored=validateProfile(p,true);assert.equal(restored.balance,9570);assert.equal(restored.equipped.ball,'ball-lime');assert.deepEqual(restored.results,p.results);
});
test('10,000 coin bets settle correctly and amounts over the limit are rejected',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'max',bet:10000});assert.equal(p.balance,0);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:3}).balance,15000);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:5}).balance,1000);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:0}).balance,200000);
 assert.throws(()=>reduceProfile(initialProfile(),{type:'drop',id:'invalid',bet:10001}));
 const saved=reduceProfile(p,{type:'settle',id:'max',slot:3});assert.deepEqual(validateProfile(saved,true),saved);
 assert.equal(validateProfile(p).pending[0].bet,10000);
});
test('cannot overspend, duplicate a purchase, or equip unowned items',()=>{
 let p=initialProfile();p.balance=100;assert.throws(()=>reduceProfile(p,{type:'drop',id:'a',bet:500}));assert.throws(()=>reduceProfile(p,{type:'buy',id:'ball-lime'}));assert.throws(()=>reduceProfile(p,{type:'equip',id:'ball-lime'}));
 p=reduceProfile(initialProfile(),{type:'buy',id:'ball-lime'});assert.equal(p.balance,9500);assert.ok(p.owned.includes('ball-lime'));assert.throws(()=>reduceProfile(p,{type:'buy',id:'ball-lime'}));assert.equal(reduceProfile(p,{type:'equip',id:'ball-lime'}).equipped.ball,'ball-lime');
});
test('support and missions cannot be collected repeatedly; reset deletes ownership',()=>{
 const p=initialProfile();p.balance=0;const now=100000000;const q=reduceProfile(p,{type:'relief'},now);assert.equal(q.balance,500);q.balance=0;assert.throws(()=>reduceProfile(q,{type:'relief'},now+100));
 p.rounds=10;const r=reduceProfile(p,{type:'claim',id:'first10'});assert.equal(r.balance,500);assert.throws(()=>reduceProfile(r,{type:'claim',id:'first10'}));
 const s=reduceProfile(initialProfile(),{type:'buy',id:'ball-lime'});const t=reduceProfile(s,{type:'reset'});assert.equal(t.balance,10000);assert.equal(t.owned.length,5);
});
test('malformed and in-flight backups are rejected without changing source',()=>{
 const p=initialProfile();assert.deepEqual(validateProfile(p,true),p);assert.throws(()=>validateProfile({...p,balance:-1}));assert.throws(()=>validateProfile({...p,equipped:{...p.equipped,ball:'ball-pearl'}}));assert.throws(()=>validateProfile({...p,version:99}));
 const q=reduceProfile(p,{type:'drop',id:'a',bet:10});assert.throws(()=>validateProfile(q,true));assert.throws(()=>reduceProfile(q,{type:'reset'}));assert.equal(p.balance,10000);
});
test('crash game start, cashout, and bust settle balances and statistics properly',()=>{
 let p = initialProfile();
 p = reduceProfile(p, {type:'crash_start', id:'c1', bet:500});
 assert.equal(p.balance, 9500);
 assert.equal(p.pending.length, 1);
 p = reduceProfile(p, {type:'crash_cashout', id:'c1', multiplier:2.40});
 assert.equal(p.balance, 10700);
 assert.equal(p.pending.length, 0);
 assert.equal(p.rounds, 1);
 assert.equal(p.best, 2.40);
 assert.equal(p.earned, 1200);
 assert.equal(p.wagered, 500);
 assert.equal(p.results[0].multiplier, 2.40);
 assert.equal(p.results[0].payout, 1200);

 p = reduceProfile(p, {type:'crash_start', id:'c2', bet:1000});
 assert.equal(p.balance, 9700);
 p = reduceProfile(p, {type:'crash_bust', id:'c2', crashPoint:1.80});
 assert.equal(p.balance, 9700);
 assert.equal(p.rounds, 2);
 assert.equal(p.wagered, 1500);
 assert.equal(p.results[0].multiplier, 0);
 assert.equal(p.results[0].payout, 0);

 const validated = validateProfile(p, true);
 assert.deepEqual(validated, p);
});
test('race game start and settle correctly pay 3x on win and 0 on loss',()=>{
 let p = initialProfile();
 p = reduceProfile(p, {type:'race_start', id:'r1', bet:1000, horseIndex:1});
 assert.equal(p.balance, 9000);
 assert.equal(p.pending.length, 1);
 assert.equal(p.pending[0].target, 1);
 // Horse 1 wins -> pays 3x
 p = reduceProfile(p, {type:'race_settle', id:'r1', winnerIndex:1});
 assert.equal(p.balance, 12000);
 assert.equal(p.pending.length, 0);
 assert.equal(p.rounds, 1);
 assert.equal(p.best, 3.0);
 assert.equal(p.earned, 3000);
 assert.equal(p.wagered, 1000);
 assert.equal(p.results[0].multiplier, 3.0);
 assert.equal(p.results[0].payout, 3000);

 // Horse 0 bet, but Horse 2 wins -> pays 0
 p = reduceProfile(p, {type:'race_start', id:'r2', bet:5000, horseIndex:0});
 assert.equal(p.balance, 7000);
 p = reduceProfile(p, {type:'race_settle', id:'r2', winnerIndex:2});
 assert.equal(p.balance, 7000);
 assert.equal(p.rounds, 2);
 assert.equal(p.results[0].multiplier, 0);
 assert.equal(p.results[0].payout, 0);

 // 4th horse (horseIndex 3) bet and win -> pays 3x
 p = reduceProfile(p, {type:'race_start', id:'r3', bet:2000, horseIndex:3});
 assert.equal(p.balance, 5000);
 p = reduceProfile(p, {type:'race_settle', id:'r3', winnerIndex:3});
 assert.equal(p.balance, 11000);
 assert.equal(p.rounds, 3);
 assert.equal(p.results[0].payout, 6000);

 const validated = validateProfile(p, true);
 assert.deepEqual(validated, p);
});

test('penguin jump game start, cashout, and fall settle balances properly', () => {
 let p = initialProfile();
 // Start penguin game with 10,000 bet
 p = reduceProfile(p, {type:'penguin_start', id:'pg1', bet:10000});
 assert.equal(p.balance, 0);
 assert.equal(p.pending.length, 1);
 // Cash out at step 3 (2.50x) -> pays 25,000
 p = reduceProfile(p, {type:'penguin_cashout', id:'pg1', multiplier:2.5});
 assert.equal(p.balance, 25000);
 assert.equal(p.pending.length, 0);
 assert.equal(p.rounds, 1);
 assert.equal(p.best, 2.5);
 assert.equal(p.earned, 25000);
 assert.equal(p.wagered, 10000);
 assert.equal(p.results[0].multiplier, 2.5);
 assert.equal(p.results[0].payout, 25000);

 // Next round: Fall at step 1 (0x)
 p = reduceProfile(p, {type:'penguin_start', id:'pg2', bet:5000});
 assert.equal(p.balance, 20000);
 p = reduceProfile(p, {type:'penguin_fall', id:'pg2'});
 assert.equal(p.balance, 20000);
 assert.equal(p.rounds, 2);
 assert.equal(p.results[0].multiplier, 0);
 assert.equal(p.results[0].payout, 0);

 const validated = validateProfile(p, true);
 assert.deepEqual(validated, p);
});

test('lucky box unboxing, prize distribution, duplicate fallback, and title equipping', () => {
 let p = initialProfile();
 p.balance = 500000;

 // Open Silver box with coin drop
 p = reduceProfile(p, {
  type: 'box_open',
  boxId: 'box-silver',
  prize: { type: 'coins', amount: 15000, name: '15,000 코인' }
 });
 assert.equal(p.balance, 500000 - 5000 + 15000); // 510,000

 // Open Gold box with new skin drop
 p = reduceProfile(p, {
  type: 'box_open',
  boxId: 'box-gold',
  prize: { type: 'skin', skinId: 'ball-cyber', name: '사이버 네온 볼' }
 });
 assert.equal(p.balance, 510000 - 25000); // 485,000
 assert.ok(p.owned.includes('ball-cyber'));

 // Open Gold box again with duplicate skin -> NO refund coins!
 p = reduceProfile(p, {
  type: 'box_open',
  boxId: 'box-gold',
  prize: { type: 'skin', skinId: 'ball-cyber', name: '사이버 네온 볼' }
 });
 assert.equal(p.balance, 485000 - 25000); // 460,000

 // Open Diamond box with legendary title drop
 p = reduceProfile(p, {
  type: 'box_open',
  boxId: 'box-diamond',
  prize: { type: 'title', title: '살아있는 전설', name: '[칭호] 살아있는 전설' }
 });
 assert.equal(p.balance, 460000 - 300000); // 160,000
 assert.ok(p.ownedTitles.includes('살아있는 전설'));

 // Equip title
 p = reduceProfile(p, { type: 'title_equip', title: '살아있는 전설' });
 assert.equal(p.title, '살아있는 전설');

 // Cannot equip unowned title
 assert.throws(() => reduceProfile(p, { type: 'title_equip', title: '신들의 연회' }));

 // Open Silver box with Dud (꽝)
 p = reduceProfile(p, {
  type: 'box_open',
  boxId: 'box-silver',
  prize: { type: 'dud', name: '꽝 (빈 상자)', message: '아쉽지만 상자가 텅 비어있었습니다.' }
 });
 assert.equal(p.balance, 160000 - 5000); // 155,000

 // Cannot directly buy box-exclusive skin
 assert.throws(() => reduceProfile(p, { type: 'buy', id: 'ball-cyber' }), /럭키 박스에서만/);

 // Validate profile
 const validated = validateProfile(p, true);
 assert.deepEqual(validated, p);
});

test('daily wheel, attendance, daily/weekly quests, achievements, and bankruptcy coin tap', () => {
  let p = initialProfile();
  const now = 1700000000000;

  // 1. Attendance (+500 coins)
  p = reduceProfile(p, { type: 'attendance' }, now);
  assert.equal(p.balance, 10500);
  assert.throws(() => reduceProfile(p, { type: 'attendance' }, now + 1000)); // already checked in today

  // 2. Daily Wheel (e.g. slot 0 = 500 coins)
  p = reduceProfile(p, { type: 'wheel_spin', slotIndex: 0 }, now);
  assert.equal(p.balance, 11000);
  assert.throws(() => reduceProfile(p, { type: 'wheel_spin', slotIndex: 0 }, now + 1000)); // cooldown 24h

  // 3. Play rounds to advance daily & weekly stats
  p = reduceProfile(p, { type: 'drop', id: 'q1', bet: 100 }, now);
  p = reduceProfile(p, { type: 'settle', id: 'q1', slot: 2 }, now); // multiplier 2x
  assert.equal(p.dailyRounds, 1);
  assert.equal(p.dailyMaxMult, 2.0);

  // 4. Claim daily quest (dq_win2x: reward 800)
  p = reduceProfile(p, { type: 'daily_claim', questId: 'dq_win2x' }, now);
  assert.ok(p.dailyClaimed.includes('dq_win2x'));
  assert.throws(() => reduceProfile(p, { type: 'daily_claim', questId: 'dq_win2x' }, now));

  // 5. Claim achievement (ach_first_step: reward 500, ach_mult_2x: reward 500)
  p = reduceProfile(p, { type: 'achievement_claim', achievementId: 'ach_first_step' }, now);
  p = reduceProfile(p, { type: 'achievement_claim', achievementId: 'ach_mult_2x' }, now);
  assert.ok(p.achievementsClaimed.includes('ach_first_step'));
  assert.ok(p.achievementsClaimed.includes('ach_mult_2x'));

  // 6. Bankruptcy Coin Tap (only when balance < 100)
  p.balance = 40;
  p = reduceProfile(p, { type: 'coin_tap' }, now);
  assert.equal(p.balance, 90);
  p = reduceProfile(p, { type: 'coin_tap' }, now);
  assert.equal(p.balance, 140);
  assert.throws(() => reduceProfile(p, { type: 'coin_tap' }, now)); // balance >= 100 rejected

  // 7. Validate profile preservation
  const validated = validateProfile(p, true);
  assert.deepEqual(validated, p);
});
