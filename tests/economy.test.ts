import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDayKey, getWeekKey, initialProfile, reduceProfile, syncDailyAndWeekly, validateProfile} from '../src/economy.ts';
import {computeProfileChecksum, decryptSaveData, encryptSaveData} from '../src/security.ts';
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
 const p=initialProfile();delete p.checksum;p.balance=9570;p.owned.push('ball-lime');p.equipped.ball='ball-lime';
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

test('mines game start, cashout, bust, and state validation', () => {
  let p = initialProfile();
  const now = 1700000100000;

  // Start with 5 mines, 500 bet
  p = reduceProfile(p, { type: 'mines_start', id: 'm1', bet: 500, mineCount: 5 }, now);
  assert.equal(p.balance, 9500);
  assert.equal(p.pending.length, 1);
  assert.equal(p.pending[0].target, 5); // mineCount stored in target

  // Cashout at 2.5x
  p = reduceProfile(p, { type: 'mines_cashout', id: 'm1', multiplier: 2.5 }, now);
  assert.equal(p.balance, 9500 + Math.floor(500 * 2.5)); // 10750
  assert.equal(p.rounds, 1);
  assert.equal(p.wagered, 500);
  assert.equal(p.earned, 1250);
  assert.equal(p.best, 2.5);
  assert.equal(p.results[0].multiplier, 2.5);
  assert.equal(p.results[0].payout, 1250);

  // Bust
  p = reduceProfile(p, { type: 'mines_start', id: 'm2', bet: 1000, mineCount: 10 }, now);
  assert.equal(p.balance, 9750);
  p = reduceProfile(p, { type: 'mines_bust', id: 'm2' }, now);
  assert.equal(p.balance, 9750);
  assert.equal(p.rounds, 2);
  assert.equal(p.wagered, 1500);
  assert.equal(p.results[0].multiplier, 0);
  assert.equal(p.results[0].payout, 0);

  // Validate profile
  const validated = validateProfile(p, true);
  assert.deepEqual(validated, p);
});

test('progressive achievements and claim_all batch collection', () => {
  let p = initialProfile();
  const now = 1700000200000;

  // Wager and win substantial amounts to qualify for progressive achievements
  p.wagered = 12000; // qualifies for ach_wager_1k, ach_wager_5k, ach_wager_10k
  p.earned = 55000;  // qualifies for ach_earn_1k, ach_earn_5k, ach_earn_10k, ach_earn_50k
  p.rounds = 55;     // qualifies for ach_first_step, ach_rounds_10, ach_rounds_25, ach_rounds_50
  p.dailyDate = getDayKey(now);
  p.dailyRounds = 5; // qualifies for dq_rounds5
  p.dailyMaxMult = 2.5; // qualifies for dq_win2x
  p.weeklyKey = getWeekKey(now);
  p.weeklyRounds = 50; // qualifies for wq_rounds50
  p.weeklyMaxMult = 5.5; // qualifies for wq_win5x

  const initialBalance = p.balance; // 10000

  // Call claim_all
  p = reduceProfile(p, { type: 'claim_all' }, now);

  // Balance should have increased by all eligible rewards
  assert.ok(p.balance > initialBalance);

  // Achievements should now be claimed
  assert.ok(p.achievementsClaimed.includes('ach_wager_1k'));
  assert.ok(p.achievementsClaimed.includes('ach_wager_5k'));
  assert.ok(p.achievementsClaimed.includes('ach_wager_10k'));
  assert.ok(p.achievementsClaimed.includes('ach_earn_50k'));
  assert.ok(p.achievementsClaimed.includes('ach_rounds_50'));

  // Daily & weekly quests should now be claimed
  assert.ok(p.dailyClaimed.includes('dq_rounds5'));
  assert.ok(p.dailyClaimed.includes('dq_win2x'));
  assert.ok(p.weeklyClaimed.includes('wq_rounds50'));
  assert.ok(p.weeklyClaimed.includes('wq_win5x'));

  // Repeated claim_all should throw error since all eligible are claimed
  assert.throws(() => reduceProfile(p, { type: 'claim_all' }, now), /수령 가능한 보상이 없습니다/);

  // Profile validation should pass cleanly
  const validated = validateProfile(p, true);
  assert.deepEqual(validated, p);
});

test('high jackpot multiplier (> 1000x) and floor-based payout validate successfully', () => {
  const p = initialProfile();
  delete p.checksum;
  p.best = 2231.84;
  p.results = [
    {
      id: 'mines_jackpot',
      bet: 100,
      multiplier: 2231.84,
      payout: Math.floor(100 * 2231.84),
      time: 1700000000000,
    },
  ];
  const validated = validateProfile(p, true);
  assert.equal(validated.best, 2231.84);
  assert.equal(validated.results[0].payout, 223184);
});

test('daily and weekly quest stats automatically reset on rollover in syncDailyAndWeekly', () => {
  const p = initialProfile();
  p.dailyDate = '2020-01-01'; // past date
  p.dailyRounds = 10;
  p.dailyMaxMult = 5;
  p.dailyClaimed = ['dq_rounds5'];

  p.weeklyKey = '2020-W01'; // past week
  p.weeklyRounds = 50;
  p.weeklyMaxMult = 10;
  p.weeklyClaimed = ['wq_rounds50'];

  syncDailyAndWeekly(p, Date.now());
  assert.equal(p.dailyRounds, 0);
  assert.equal(p.dailyMaxMult, 0);
  assert.deepEqual(p.dailyClaimed, []);

  assert.equal(p.weeklyRounds, 0);
  assert.equal(p.weeklyMaxMult, 0);
  assert.deepEqual(p.weeklyClaimed, []);
});

test('tampered local storage profile is caught and rejected by checksum verification', () => {
  const p = initialProfile();
  assert.ok(p.checksum);

  // User opens DevTools IndexedDB and changes balance from 10000 to 9999999
  const tampered = { ...p, balance: 9999999 };
  assert.throws(
    () => validateProfile(tampered),
    /로컬 저장소의 데이터가 변조되었습니다/
  );
});

test('AES-GCM save export encrypts data and rejects tampered save file on import', async () => {
  const p = initialProfile();
  p.balance = 25000;
  p.rounds = 15;
  p.checksum = computeProfileChecksum(p);

  // Export encrypted save
  const encryptedJson = await encryptSaveData(p);
  assert.ok(!encryptedJson.includes('25000')); // Balance is NOT exposed in plain text!
  assert.ok(encryptedJson.includes('aes-gcm'));

  // Normal decrypt succeeds
  const restored = await decryptSaveData(encryptedJson, validateProfile);
  assert.equal(restored.balance, 25000);
  assert.equal(restored.rounds, 15);

  // Tamper test 1: Modify ciphertext data
  const parsed = JSON.parse(encryptedJson);
  const tamperedData = {
    ...parsed,
    data: parsed.data.slice(0, -4) + 'abcd',
  };
  await assert.rejects(
    () => decryptSaveData(JSON.stringify(tamperedData), validateProfile),
    /변조되었거나 손상된 세이브 파일입니다/
  );

  // Tamper test 2: Tamper signature
  const tamperedSig = {
    ...parsed,
    sig: '0000000000000000000000000000000000000000000000000000000000000000',
  };
  await assert.rejects(
    () => decryptSaveData(JSON.stringify(tamperedSig), validateProfile),
    /변조되었거나 손상된 세이브 파일입니다/
  );
});

test('legacy unencrypted v1 backup imports seamlessly', async () => {
  const legacy = {
    app: 'tyche-lounge',
    exportedAt: '2023-01-01T00:00:00.000Z',
    profile: {
      ...initialProfile(),
      balance: 15000,
    },
  };
  delete (legacy.profile as Partial<typeof legacy.profile>).checksum;

  const restored = await decryptSaveData(JSON.stringify(legacy), validateProfile);
  assert.equal(restored.balance, 15000);
  assert.ok(restored.checksum); // Automatically upgraded with fresh checksum
});

test('bgm action toggles background music preference and persists across validation', () => {
  let p = initialProfile();
  assert.equal(p.bgm, false);

  // Toggle BGM on
  p = reduceProfile(p, { type: 'bgm' });
  assert.equal(p.bgm, true);

  // Validate profile preserves bgm setting
  const validated = validateProfile(p);
  assert.equal(validated.bgm, true);

  // Toggle BGM off
  p = reduceProfile(p, { type: 'bgm' });
  assert.equal(p.bgm, false);
  assert.equal(validateProfile(p).bgm, false);
});

