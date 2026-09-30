import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDayKey, getWeekKey, initialProfile, reduceProfile, syncDailyAndWeekly, validateProfile} from '../src/economy.ts';
import {computeProfileChecksum, decryptSaveData, encryptSaveData} from '../src/security.ts';
import {generateCrashPoint, getMinesMultiplier, evaluateSlotReels, spinSlots, SLOT_SYMBOLS} from '../src/gameMath.ts';
test('a purchase and settlement preserve accounting; repeated settlement is idempotent',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:100});assert.equal(p.balance,9900);
 const q=reduceProfile(p,{type:'settle',id:'a',slot:2});assert.equal(q.balance,10020);assert.equal(q.wagered,100);assert.equal(q.earned,120);assert.equal(q.rounds,1);
 assert.deepEqual(reduceProfile(q,{type:'settle',id:'a',slot:2}),q);
});
test('fractional multiplier pays whole coins and refund cannot be duplicated',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:10});const q=reduceProfile(p,{type:'settle',id:'a',slot:4});assert.equal(q.balance,9994);
 const center=reduceProfile(p,{type:'settle',id:'a',slot:5});assert.equal(center.balance,9992);
 const r=reduceProfile(initialProfile(),{type:'drop',id:'a',bet:500});const s=reduceProfile(r,{type:'recover'});assert.equal(s.balance,10000);assert.equal(reduceProfile(s,{type:'recover'}).balance,10000);assert.equal(reduceProfile(s,{type:'refund',id:'a'}).balance,10000);
});
test('old saves and backups retain 0.7x and 1x history after the balance update',()=>{
 const p=initialProfile();p.balance=9570;p.owned.push('ball-lime');p.equipped.ball='ball-lime';
 p.results=[{id:'legacy-07',bet:100,multiplier:.7,payout:70,time:1},{id:'legacy-1',bet:100,multiplier:1,payout:100,time:2},{id:'legacy-01',bet:100,multiplier:.1,payout:10,time:3}];
 p.checksum=computeProfileChecksum(p);
 const restored=validateProfile(p,true);assert.equal(restored.balance,9570);assert.equal(restored.equipped.ball,'ball-lime');assert.deepEqual(restored.results,p.results);
});
test('10,000 coin bets settle correctly and amounts over the limit are rejected',()=>{
 const p=reduceProfile(initialProfile(),{type:'drop',id:'max',bet:10000});assert.equal(p.balance,0);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:3}).balance,8000);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:5}).balance,2000);
 assert.equal(reduceProfile(p,{type:'settle',id:'max',slot:0}).balance,200000);
 assert.throws(()=>reduceProfile(initialProfile(),{type:'drop',id:'invalid',bet:10001}));
 const saved=reduceProfile(p,{type:'settle',id:'max',slot:3});assert.deepEqual(validateProfile(saved,true),saved);
 assert.equal(validateProfile(p).pending[0].bet,10000);
});
test('arbitrary custom bet (e.g. 23,890) and higher bet limit up to 100,000,000 work properly', () => {
 let p = initialProfile();
 p.balance = 50000;
 // Bet exact custom amount 23,890
 p = reduceProfile(p, { type: 'slots_spin', id: 'c1', bet: 23890, multiplier: 2.0 });
 assert.equal(p.balance, 50000 - 23890 + 23890 * 2);
 assert.equal(p.wagered, 23890);
 assert.equal(p.results[0].bet, 23890);
 assert.deepEqual(validateProfile(p, true), p);

 // High bet up to 10,000,000
 p.balance = 20000000;
 p = reduceProfile(p, { type: 'slots_spin', id: 'c2', bet: 10000000, multiplier: 1.0 });
 assert.equal(p.balance, 20000000);
 assert.equal(p.results[0].bet, 10000000);

 // Amounts over 100,000,000 are rejected
 p.balance = 500000000;
 assert.throws(() => reduceProfile(p, { type: 'slots_spin', id: 'c3', bet: 100000001, multiplier: 1.0 }));
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
  p = reduceProfile(p, { type: 'settle', id: 'q1', slot: 1 }, now); // multiplier 2.4x
  assert.equal(p.dailyRounds, 1);
  assert.equal(p.dailyMaxMult, 2.4);

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
  p.checksum = computeProfileChecksum(p);
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

test('legacy unencrypted v1 backup is rejected for anti-tamper security', async () => {
  const legacy = {
    app: 'tyche-lounge',
    exportedAt: '2023-01-01T00:00:00.000Z',
    profile: {
      ...initialProfile(),
      balance: 15000,
    },
  };
  await assert.rejects(
    () => decryptSaveData(JSON.stringify(legacy), validateProfile),
    /암호화된 공식 백업 파일/
  );
});

test('profile without checksum is caught and rejected as tampered', () => {
  const p = initialProfile();
  delete (p as Partial<typeof p>).checksum;
  assert.throws(
    () => validateProfile(p),
    /로컬 저장소의 데이터가 변조되었습니다/
  );
});

test('crash multiplier distribution rebalance increases 1.2x~1.5x early bust rate', () => {
  // 1. Instant bust (r < 0.05 returns 1.00)
  assert.equal(generateCrashPoint(0.01), 1.00);
  assert.equal(generateCrashPoint(0.049), 1.00);

  // 2. Just above instant bust: r = 0.05 -> 0.935 / (1 - 0.05) = 0.984 -> Math.max(1.01, ...) = 1.01
  assert.equal(generateCrashPoint(0.05), 1.01);

  // 3. Low multipliers (1.20x auto-cashout bust range)
  // At r = 0.22: 0.935 / 0.78 = 1.198 -> 1.19 (< 1.20)
  assert.ok(generateCrashPoint(0.22) < 1.20);
  // At r = 0.35: 0.935 / 0.65 = 1.438 -> 1.43 (< 1.50)
  assert.ok(generateCrashPoint(0.35) < 1.50);

  // 4. Over 10,000 simulated rounds, verify that early bust (< 1.20x) is around 22%~25% and (< 1.50x) is around 38%~42%
  let bustBelow120 = 0;
  let bustBelow150 = 0;
  const SIM_ROUNDS = 10000;
  for (let i = 0; i < SIM_ROUNDS; i++) {
    const pt = generateCrashPoint();
    if (pt < 1.20) bustBelow120++;
    if (pt < 1.50) bustBelow150++;
  }
  const rate120 = bustBelow120 / SIM_ROUNDS;
  const rate150 = bustBelow150 / SIM_ROUNDS;
  // Previously rate120 was ~19.6%; now it should be > 21%
  assert.ok(rate120 >= 0.20 && rate120 <= 0.26, `Actual rate120: ${rate120}`);
  // Previously rate150 was ~35.7%; now it should be > 36%
  assert.ok(rate150 >= 0.36 && rate150 <= 0.44, `Actual rate150: ${rate150}`);
});

test('mines multiplier rebalance with 0.94 factor calculates correctly without capping jackpots', () => {
  // 3 mines, 1 diamond revealed: prob = 22/25 = 0.88. raw = 0.94 / 0.88 = 1.068 -> 1.06
  const m1 = getMinesMultiplier(3, 1);
  assert.equal(m1, 1.06);

  // High jackpot remains uncapped: 20 mines, 5 diamonds revealed
  // prob = (5/25)*(4/24)*(3/23)*(2/22)*(1/21) = 1 / 53130
  // raw = 0.94 * 53130 = 49942.2
  const jackpot = getMinesMultiplier(20, 5);
  assert.ok(jackpot > 40000, `Jackpot multiplier: ${jackpot}`);
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

test('777 slot evaluation rules, payouts, and RTP balance work correctly', () => {
  // 1. Symbol matching verification
  // 3 of a kind: 777 (50x), BAR (40x), Diamond (20x), Bell (12x), Grape (5x), Cherry (5x)
  assert.equal(evaluateSlotReels([0, 0, 0]).multiplier, 50.0);
  assert.equal(evaluateSlotReels([1, 1, 1]).multiplier, 40.0);
  assert.equal(evaluateSlotReels([2, 2, 2]).multiplier, 20.0);
  assert.equal(evaluateSlotReels([3, 3, 3]).multiplier, 12.0);
  assert.equal(evaluateSlotReels([4, 4, 4]).multiplier, 5.0);
  assert.equal(evaluateSlotReels([5, 5, 5]).multiplier, 5.0);

  // 2 Cherries = 2.0x
  assert.equal(evaluateSlotReels([5, 5, 0]).multiplier, 2.0);
  assert.equal(evaluateSlotReels([1, 5, 5]).multiplier, 2.0);
  assert.equal(evaluateSlotReels([5, 3, 5]).multiplier, 2.0);

  // 1 Cherry = 1.0x (본전 100% 보장)
  assert.equal(evaluateSlotReels([5, 1, 2]).multiplier, 1.0);
  assert.equal(evaluateSlotReels([3, 5, 4]).multiplier, 1.0);
  assert.equal(evaluateSlotReels([0, 1, 5]).multiplier, 1.0);

  // No match & No cherry = 0x
  assert.equal(evaluateSlotReels([0, 1, 2]).multiplier, 0);
  assert.equal(evaluateSlotReels([3, 4, 1]).multiplier, 0);

  // 2. Profile reduction & economy preservation
  let p = initialProfile();
  // 1 Cherry spin (1.0x 본전)
  p = reduceProfile(p, { type: 'slots_spin', id: 's1', bet: 1000, reels: [5, 1, 2], multiplier: 1.0 });
  assert.equal(p.balance, 10000); // 10000 - 1000 + 1000 = 10000
  assert.equal(p.rounds, 1);
  assert.equal(p.wagered, 1000);
  assert.equal(p.earned, 1000);
  assert.equal(p.results[0].payout, 1000);

  // 2 Cherries spin (2.0x)
  p = reduceProfile(p, { type: 'slots_spin', id: 's2', bet: 500, reels: [5, 5, 1], multiplier: 2.0 });
  assert.equal(p.balance, 10500); // 10000 - 500 + 1000
  assert.equal(p.rounds, 2);
  assert.equal(p.wagered, 1500);
  assert.equal(p.earned, 2000);

  // 3x 777 Jackpot spin (50x)
  p = reduceProfile(p, { type: 'slots_spin', id: 's3', bet: 1000, reels: [0, 0, 0], multiplier: 50.0 });
  assert.equal(p.balance, 59500); // 10500 - 1000 + 50000
  assert.equal(p.best, 50.0);
  assert.equal(p.results[0].payout, 50000);

  // Validate profile checksum and structure
  const saved = validateProfile(p, true);
  assert.deepEqual(saved, p);

  // Overspending or invalid bet rejection
  assert.throws(() => reduceProfile(p, { type: 'slots_spin', id: 's4', bet: 999999, reels: [0, 0, 0], multiplier: 50 }));

  // 3. Exact analytical RTP verification across all combinations (6x6x6 = 216 states, 16^3 = 4,096 ways)
  let exactTotalWays = 0;
  let exactTotalPayout = 0;
  let exactOneCherryWays = 0;
  let exactBustWays = 0;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    for (let j = 0; j < SLOT_SYMBOLS.length; j++) {
      for (let k = 0; k < SLOT_SYMBOLS.length; k++) {
        const ways = SLOT_SYMBOLS[i].weight * SLOT_SYMBOLS[j].weight * SLOT_SYMBOLS[k].weight;
        exactTotalWays += ways;
        const evalResult = evaluateSlotReels([i, j, k]);
        exactTotalPayout += ways * evalResult.multiplier;
        const cherries = [i, j, k].filter(x => x === 5).length;
        if (cherries === 1) exactOneCherryWays += ways;
        if (evalResult.multiplier === 0) exactBustWays += ways;
      }
    }
  }
  assert.equal(exactTotalWays, 16 * 16 * 16); // 4096
  const exactRTP = exactTotalPayout / exactTotalWays;
  const exactOneCherryRate = exactOneCherryWays / exactTotalWays;
  const exactBustRate = exactBustWays / exactTotalWays;

  // Mathematically verified RTP: 3837 / 4096 = 93.6767...%
  assert.ok(Math.abs(exactRTP - 0.9368) < 0.001, `Exact RTP: ${exactRTP}`);
  // 1-Cherry rate: 1521 / 4096 = 37.1337...%
  assert.ok(Math.abs(exactOneCherryRate - 0.3713) < 0.001, `Exact 1-Cherry rate: ${exactOneCherryRate}`);
  // Bust rate: 2028 / 4096 = 49.5117...%
  assert.ok(Math.abs(exactBustRate - 0.4951) < 0.001, `Exact Bust rate: ${exactBustRate}`);

  // 4. Monte Carlo simulation of 10,000 spins (verify RNG generation matches expectations within tolerance)
  const SIM_SPINS = 10000;
  let simOneCherryCount = 0;
  let simBustCount = 0;
  for (let i = 0; i < SIM_SPINS; i++) {
    const outcome = spinSlots();
    const cherryCount = outcome.reels.filter(r => r === 5).length;
    if (cherryCount === 1) simOneCherryCount++;
    if (outcome.multiplier === 0) simBustCount++;
  }
  const simOneCherryRate = simOneCherryCount / SIM_SPINS;
  const simBustRate = simBustCount / SIM_SPINS;

  assert.ok(simOneCherryRate >= 0.34 && simOneCherryRate <= 0.41, `1 Cherry rate: ${simOneCherryRate}`);
  assert.ok(simBustRate >= 0.46 && simBustRate <= 0.53, `Bust rate: ${simBustRate}`);
});

test('show me the money coupon grants 50,000 coins once and prevents reuse',()=>{
  let p = initialProfile();
  assert.equal(p.balance, 10000);
  assert.deepEqual(p.usedCoupons, []);

  // 1. Invalid code rejected
  assert.throws(() => reduceProfile(p, { type: 'redeem_coupon', code: 'invalid_code' }));

  // 2. Redeem 'show me the money'
  p = reduceProfile(p, { type: 'redeem_coupon', code: 'show me the money' });
  assert.equal(p.balance, 60000);
  assert.ok(p.usedCoupons.includes('COUPON_SHOW_ME_THE_MONEY'));

  // 3. Repeated redemption is rejected
  assert.throws(() => reduceProfile(p, { type: 'redeem_coupon', code: 'showmethemoney' }));
  assert.throws(() => reduceProfile(p, { type: 'redeem_coupon', code: '쇼미더머니' }));

  // 4. Persistence validation
  const saved = validateProfile(p, true);
  assert.equal(saved.balance, 60000);
  assert.ok(saved.usedCoupons.includes('COUPON_SHOW_ME_THE_MONEY'));
});



