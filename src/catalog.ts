export type Category = 'ball' | 'board' | 'trail' | 'rocket' | 'penguin';
export type Product = {
 id: string;
 name: string;
 category: Category;
 price: number;
 color: string;
 description: string;
 rarity: string;
 boxOnly?: boolean;
 boxName?: string;
};

export const CATALOG: Product[] = [
 // --- Standard Store Skins (All purchasable with Coins!) ---
 // 1. Balls (공)
 {id:'ball-coral',name:'코랄 팝',category:'ball',price:0,color:'#ff785e',description:'작은 공, 새로운 시작.',rarity:'BASIC'},
 {id:'ball-lime',name:'애시드 라임',category:'ball',price:500,color:'#c4fa6b',description:'핀 사이를 가르는 선명한 라임.',rarity:'ESSENTIAL'},
 {id:'ball-ice',name:'아이스 블루',category:'ball',price:1000,color:'#77d9ff',description:'차갑고 투명한 푸른빛.',rarity:'ESSENTIAL'},
 {id:'ball-lilac',name:'울트라 바이올렛',category:'ball',price:2500,color:'#b29bff',description:'밤하늘에서 내려온 은은한 보랏빛.',rarity:'RARE'},
 {id:'ball-gold',name:'골든 아워',category:'ball',price:5000,color:'#ffcd69',description:'모든 순간을 황금빛으로.',rarity:'RARE'},
 {id:'ball-pearl',name:'문라이트',category:'ball',price:12000,color:'#f2f4ff',description:'가장 어두운 밤에도 빛나는 공.',rarity:'COLLECTOR'},

 // 2. Boards (보드 테마)
 {id:'board-midnight',name:'미드나이트',category:'board',price:0,color:'#92aac5',description:'처음 만나는 고요한 밤.',rarity:'BASIC'},
 {id:'board-aurora',name:'오로라',category:'board',price:3000,color:'#6be4c4',description:'보드 위에 펼쳐지는 신비로운 초록빛.',rarity:'RARE'},
 {id:'board-violet',name:'딥 스페이스',category:'board',price:7000,color:'#b29bff',description:'깊은 우주의 색을 담은 보드.',rarity:'COLLECTOR'},

 // 3. Trails (궤적 효과)
 {id:'trail-none',name:'클린',category:'trail',price:0,color:'#ffffff',description:'공의 움직임 그대로.',rarity:'BASIC'},
 {id:'trail-comet',name:'코멧',category:'trail',price:1500,color:'#77d9ff',description:'공 뒤로 이어지는 푸른 혜성의 꼬리.',rarity:'ESSENTIAL'},
 {id:'trail-stardust',name:'스타더스트',category:'trail',price:4000,color:'#ffcd69',description:'지나온 자리에 남는 황금빛 별가루 잔상.',rarity:'RARE'},

 // 4. Rockets (로켓 스킨 - 크래시 게임 전용)
 {id:'rocket-classic',name:'클래식 아폴로',category:'rocket',price:0,color:'#f2f4ff',description:'우주를 향한 인류의 첫 도약.',rarity:'BASIC'},
 {id:'rocket-crimson',name:'크림슨 플레임',category:'rocket',price:3000,color:'#ff4d4d',description:'강렬한 붉은 화염을 내뿜는 로켓.',rarity:'ESSENTIAL'},
 {id:'rocket-stealth',name:'스텔스 나이트',category:'rocket',price:8000,color:'#8a99ad',description:'심우주 레이더를 피하는 다크 티타늄 셔틀.',rarity:'COLLECTOR'},

 // 5. Penguins (펭귄 스킨 - 펭귄 점프 게임 전용)
 {id:'penguin-classic',name:'클래식 턱시도',category:'penguin',price:0,color:'#111827',description:'정석의 귀여운 턱시도 신사 펭귄.',rarity:'BASIC'},
 {id:'penguin-pink',name:'베리 핑크',category:'penguin',price:3000,color:'#ff77a9',description:'사랑스러운 딸기우유 빛깔의 펭귄.',rarity:'ESSENTIAL'},
 {id:'penguin-frost',name:'아크틱 민트',category:'penguin',price:8000,color:'#6be4c4',description:'빙하의 차가운 냉기를 품은 민트 펭귄.',rarity:'COLLECTOR'},

 // --- Lucky Box Exclusive Rare Skins (Only obtainable via Lucky Boxes!) ---
 // 🥈 Silver Box Exclusives
 {id:'ball-silver-comet',name:'실버 혜성',category:'ball',price:0,color:'#d0dbe5',description:'은빛으로 눈부시게 빛나는 혜성 볼.',rarity:'RARE',boxOnly:true,boxName:'실버 럭키 박스'},
 {id:'board-silver-grid',name:'실버 매트릭스',category:'board',price:0,color:'#a0b2c6',description:'정교한 은빛 그리드가 펼쳐지는 테마.',rarity:'RARE',boxOnly:true,boxName:'실버 럭키 박스'},
 {id:'trail-silver-spark',name:'실버 스파크',category:'trail',price:0,color:'#e2e8f0',description:'은하수의 미세한 은빛 입자가 반짝이는 궤적.',rarity:'RARE',boxOnly:true,boxName:'실버 럭키 박스'},
 {id:'rocket-silver-falcon',name:'실버 팔콘',category:'rocket',price:0,color:'#c5d1e0',description:'은빛 날개로 음속을 돌파하는 탐사선.',rarity:'RARE',boxOnly:true,boxName:'실버 럭키 박스'},
 {id:'penguin-silver-sailor',name:'세일러 펭귄',category:'penguin',price:0,color:'#89a4c7',description:'깜찍한 마린 캡을 쓴 항해사 펭귄.',rarity:'RARE',boxOnly:true,boxName:'실버 럭키 박스'},

 // 🥇 Gold Box Exclusives
 {id:'ball-cyber',name:'사이버 네온',category:'ball',price:0,color:'#00f2fe',description:'눈부신 사이버펑크 네온 에너지 구체.',rarity:'EPIC',boxOnly:true,boxName:'골드 럭키 박스'},
 {id:'board-cyberpunk',name:'사이버펑크 네온',category:'board',price:0,color:'#00f2fe',description:'미래 도시의 네온 불빛으로 가득 찬 보드.',rarity:'EPIC',boxOnly:true,boxName:'골드 럭키 박스'},
 {id:'trail-neon',name:'네온 펄스',category:'trail',price:0,color:'#00f2fe',description:'선명하게 깜빡이는 네온 사이언 레이저 궤적.',rarity:'EPIC',boxOnly:true,boxName:'골드 럭키 박스'},
 {id:'rocket-cyber-striker',name:'사이버 스트라이커',category:'rocket',price:0,color:'#00f2fe',description:'네온 사이언 레이저 부스터를 탑재한 하이퍼 제트.',rarity:'EPIC',boxOnly:true,boxName:'골드 럭키 박스'},
 {id:'penguin-golden-emperor',name:'골든 엠페러 펭귄',category:'penguin',price:0,color:'#ffd15c',description:'찬란한 황금빛 왕관을 쓴 황제 펭귄.',rarity:'EPIC',boxOnly:true,boxName:'골드 럭키 박스'},

 // 💎 Platinum Box Exclusives
 {id:'ball-plasma',name:'플라즈마 마젠타',category:'ball',price:0,color:'#ff3b80',description:'폭발하는 플라즈마 파동의 붉은빛.',rarity:'LEGENDARY',boxOnly:true,boxName:'플래티넘 럭키 박스'},
 {id:'board-nebula',name:'황금 성운',category:'board',price:0,color:'#ffd15c',description:'우주 깊은 곳에서 빛나는 황금빛 성운.',rarity:'LEGENDARY',boxOnly:true,boxName:'플래티넘 럭키 박스'},
 {id:'trail-lightning',name:'썬더 볼트',category:'trail',price:0,color:'#ffd15c',description:'공이 스칠 때마다 번쩍이는 번개 폭풍 궤적.',rarity:'LEGENDARY',boxOnly:true,boxName:'플래티넘 럭키 박스'},
 {id:'rocket-plasma-phoenix',name:'플라즈마 피닉스',category:'rocket',price:0,color:'#ff3b80',description:'초고온 플라즈마를 추진력으로 삼는 불사조 로켓.',rarity:'LEGENDARY',boxOnly:true,boxName:'플래티넘 럭키 박스'},
 {id:'penguin-mecha-neon',name:'메카 사이버 펭귄',category:'penguin',price:0,color:'#00f2fe',description:'네온 바이저와 사이버 아머로 무장한 사이보그 펭귄.',rarity:'LEGENDARY',boxOnly:true,boxName:'플래티넘 럭키 박스'},

 // 👑 Diamond Box Exclusives
 {id:'ball-tyche',name:'티케의 눈물',category:'ball',price:0,color:'#ffd15c',description:'행운의 여신이 빚어낸 순금의 구체.',rarity:'MYTHIC',boxOnly:true,boxName:'다이아몬드 럭키 박스'},
 {id:'board-pantheon',name:'티케 판테온',category:'board',price:0,color:'#c4fa6b',description:'신들이 머무는 찬란한 황금 신전 보드.',rarity:'MYTHIC',boxOnly:true,boxName:'다이아몬드 럭키 박스'},
 {id:'trail-prism',name:'프리즘 스펙트럼',category:'trail',price:0,color:'#ff3b80',description:'모든 빛의 스펙트럼을 흩뿌리는 무지개 잔상.',rarity:'MYTHIC',boxOnly:true,boxName:'다이아몬드 럭키 박스'},
 {id:'rocket-tyche-hyperion',name:'티케 히페리온',category:'rocket',price:0,color:'#ffd15c',description:'초차원 공간 도약을 가능케 하는 행운의 여신 우주선.',rarity:'MYTHIC',boxOnly:true,boxName:'다이아몬드 럭키 박스'},
 {id:'penguin-tyche-angel',name:'티케 엔젤 펭귄',category:'penguin',price:0,color:'#fff9e6',description:'머리 위에 황금빛 천사 링과 날개를 두른 신화 펭귄.',rarity:'MYTHIC',boxOnly:true,boxName:'다이아몬드 럭키 박스'},
];

export const LABELS: Record<Category, string> = {
 ball: '공 스킨',
 board: '보드 테마',
 trail: '궤적 효과',
 rocket: '로켓 스킨',
 penguin: '펭귄 스킨',
};

export const MULTIPLIERS = [20, 5, 2, 1.5, 0.5, 0.1, 0.5, 1.5, 2, 5, 20];
export const HISTORICAL_MULTIPLIERS = [0.1, 0.4, 0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 5, 16, 20];
export const BETS = [10, 50, 100, 500, 1000, 2000, 5000, 10000];
export const MISSIONS = [
 {id:'first10',target:10,reward:500,name:'가볍게 워밍업',description:'공 10개 떨어뜨리기'},
 {id:'first25',target:25,reward:750,name:'리듬을 타는 중',description:'공 25개 떨어뜨리기'},
 {id:'first100',target:100,reward:2000,name:'백 번의 작은 모험',description:'공 100개 떨어뜨리기'}
];

export type TitleTier = 'silver' | 'gold' | 'platinum' | 'diamond';
export type TitleInfo = {id:string; name:string; tier:TitleTier; color:string; desc:string};

export const TITLES: Record<string, TitleInfo> = {
 '티케의 손님': { id:'default', name:'티케의 손님', tier:'silver', color:'#8aa0bf', desc:'티케 라운지에 첫발을 내디딘 손님' },
 '행운의 시작': { id:'t_silver_1', name:'행운의 시작', tier:'silver', color:'#b0bec5', desc:'실버 상자에서 피어난 작은 행운' },
 '초심자의 행운': { id:'t_silver_2', name:'초심자의 행운', tier:'silver', color:'#b0bec5', desc:'두려움 없이 도전하는 플레이어' },
 '작은 날갯짓': { id:'t_silver_3', name:'작은 날갯짓', tier:'silver', color:'#b0bec5', desc:'빙하를 향해 도약하는 아기 펭귄' },
 '트랙의 승부사': { id:'t_gold_1', name:'트랙의 승부사', tier:'gold', color:'#ffd15c', desc:'경마 트랙의 바람을 읽는 자' },
 '빙하 정복자': { id:'t_gold_2', name:'빙하 정복자', tier:'gold', color:'#ffd15c', desc:'깨지는 얼음 위에서도 여유로운 질주' },
 '확률의 마술사': { id:'t_gold_3', name:'확률의 마술사', tier:'gold', color:'#ffd15c', desc:'기댓값을 뛰어넘는 배짱' },
 '하이롤러': { id:'t_plat_1', name:'하이롤러', tier:'platinum', color:'#00f2fe', desc:'거침없이 고액을 배팅하는 큰손' },
 '티케의 사도': { id:'t_plat_2', name:'티케의 사도', tier:'platinum', color:'#00f2fe', desc:'행운의 여신의 가호를 받는 자' },
 '황금빛 질주': { id:'t_plat_3', name:'황금빛 질주', tier:'platinum', color:'#00f2fe', desc:'빛보다 빠르게 결승선을 통과하는 질주' },
 '백만장자': { id:'t_plat_4', name:'백만장자', tier:'platinum', color:'#00f2fe', desc:'부와 영예를 거머쥔 거물' },
 '티케의 총애': { id:'t_dia_1', name:'티케의 총애', tier:'diamond', color:'#ff3b80', desc:'행운의 여신이 직접 선택한 절대적 총애' },
 '불멸의 잭팟': { id:'t_dia_2', name:'불멸의 잭팟', tier:'diamond', color:'#ff3b80', desc:'기적을 현실로 만든 전설의 승리자' },
 '살아있는 전설': { id:'t_dia_3', name:'살아있는 전설', tier:'diamond', color:'#ff3b80', desc:'티케 라운지의 역사를 새로 쓴 자' },
 '신들의 연회': { id:'t_dia_4', name:'신들의 연회', tier:'diamond', color:'#ff3b80', desc:'신들과 어깨를 나란히 하는 최상위 VIP' },
};

export type BoxPrize =
 | { type: 'coins'; amount: number; name: string }
 | { type: 'skin'; skinId: string; name: string }
 | { type: 'title'; title: string; name: string }
 | { type: 'dud'; name: string; message: string };

export type BoxDrop = {
 rate: number; // percentage (e.g. 7.5 = 7.5%)
 prize: BoxPrize;
};

export type LuckyBox = {
 id: string;
 name: string;
 tier: 'silver' | 'gold' | 'platinum' | 'diamond';
 price: number;
 color: string;
 bg: string;
 border: string;
 description: string;
 drops: BoxDrop[];
};

export const BOXES: LuckyBox[] = [
 {
  id: 'box-silver',
  name: '실버 럭키 박스',
  tier: 'silver',
  price: 5000,
  color: '#b0bec5',
  bg: 'rgba(176, 190, 197, 0.12)',
  border: '#b0bec5',
  description: '가볍게 행운을 시험해보는 실버 미스터리 상자',
  drops: [
   { rate: 30.0, prize: { type:'dud', name:'꽝 (빈 상자)', message:'아쉽지만 상자가 텅 비어있었습니다... 다음 기회에!' } },
   { rate: 2.0, prize: { type:'coins', amount:15000, name:'15,000 코인 (3배 잭팟!)' } },
   { rate: 17.0, prize: { type:'coins', amount:3000, name:'3,000 코인' } },
   { rate: 22.0, prize: { type:'coins', amount:1000, name:'1,000 코인' } },
   { rate: 3.0, prize: { type:'title', title:'행운의 시작', name:'[칭호] 행운의 시작' } },
   { rate: 3.0, prize: { type:'title', title:'초심자의 행운', name:'[칭호] 초심자의 행운' } },
   { rate: 3.0, prize: { type:'title', title:'작은 날갯짓', name:'[칭호] 작은 날갯짓' } },
   { rate: 4.0, prize: { type:'skin', skinId:'ball-silver-comet', name:'실버 혜성 볼' } },
   { rate: 4.0, prize: { type:'skin', skinId:'board-silver-grid', name:'실버 매트릭스 보드' } },
   { rate: 4.0, prize: { type:'skin', skinId:'trail-silver-spark', name:'실버 스파크 트레일' } },
   { rate: 4.0, prize: { type:'skin', skinId:'rocket-silver-falcon', name:'실버 팔콘 로켓' } },
   { rate: 4.0, prize: { type:'skin', skinId:'penguin-silver-sailor', name:'세일러 펭귄' } },
  ],
 },
 {
  id: 'box-gold',
  name: '골드 럭키 박스',
  tier: 'gold',
  price: 25000,
  color: '#ffd15c',
  bg: 'rgba(255, 209, 92, 0.12)',
  border: '#ffd15c',
  description: '화려한 네온 스킨과 승부사의 칭호가 담긴 황금 상자',
  drops: [
   { rate: 30.0, prize: { type:'dud', name:'꽝 (빈 상자)', message:'먼지만 가득한 빈 상자였습니다... 다음 기회에!' } },
   { rate: 2.0, prize: { type:'coins', amount:75000, name:'75,000 코인 (3배 잭팟!)' } },
   { rate: 19.0, prize: { type:'coins', amount:20000, name:'20,000 코인' } },
   { rate: 20.0, prize: { type:'coins', amount:5000, name:'5,000 코인' } },
   { rate: 3.0, prize: { type:'title', title:'트랙의 승부사', name:'[칭호] 트랙의 승부사' } },
   { rate: 3.0, prize: { type:'title', title:'빙하 정복자', name:'[칭호] 빙하 정복자' } },
   { rate: 3.0, prize: { type:'title', title:'확률의 마술사', name:'[칭호] 확률의 마술사' } },
   { rate: 4.0, prize: { type:'skin', skinId:'ball-cyber', name:'사이버 네온 볼' } },
   { rate: 4.0, prize: { type:'skin', skinId:'board-cyberpunk', name:'사이버펑크 네온 보드' } },
   { rate: 4.0, prize: { type:'skin', skinId:'trail-neon', name:'네온 펄스 트레일' } },
   { rate: 4.0, prize: { type:'skin', skinId:'rocket-cyber-striker', name:'사이버 스트라이커 로켓' } },
   { rate: 4.0, prize: { type:'skin', skinId:'penguin-golden-emperor', name:'골든 엠페러 펭귄' } },
  ],
 },
 {
  id: 'box-platinum',
  name: '플래티넘 럭키 박스',
  tier: 'platinum',
  price: 100000,
  color: '#00f2fe',
  bg: 'rgba(0, 242, 254, 0.12)',
  border: '#00f2fe',
  description: '전설급 갤럭시 스킨과 하이롤러 전용 백금 상자',
  drops: [
   { rate: 30.0, prize: { type:'dud', name:'꽝 (빈 상자)', message:'상자가 허무하게 비어있었습니다... 행운을 재충전하세요!' } },
   { rate: 2.0, prize: { type:'coins', amount:300000, name:'300,000 코인 (3배 잭팟!)' } },
   { rate: 26.0, prize: { type:'coins', amount:80000, name:'80,000 코인' } },
   { rate: 15.0, prize: { type:'coins', amount:20000, name:'20,000 코인' } },
   { rate: 3.0, prize: { type:'title', title:'하이롤러', name:'[칭호] 하이롤러' } },
   { rate: 3.0, prize: { type:'title', title:'티케의 사도', name:'[칭호] 티케의 사도' } },
   { rate: 3.0, prize: { type:'title', title:'황금빛 질주', name:'[칭호] 황금빛 질주' } },
   { rate: 3.0, prize: { type:'title', title:'백만장자', name:'[칭호] 백만장자' } },
   { rate: 3.0, prize: { type:'skin', skinId:'ball-plasma', name:'플라즈마 마젠타 볼' } },
   { rate: 3.0, prize: { type:'skin', skinId:'board-nebula', name:'황금 성운 보드' } },
   { rate: 3.0, prize: { type:'skin', skinId:'trail-lightning', name:'썬더 볼트 트레일' } },
   { rate: 3.0, prize: { type:'skin', skinId:'rocket-plasma-phoenix', name:'플라즈마 피닉스 로켓' } },
   { rate: 3.0, prize: { type:'skin', skinId:'penguin-mecha-neon', name:'메카 사이버 펭귄' } },
  ],
 },
 {
  id: 'box-diamond',
  name: '다이아몬드 럭키 박스',
  tier: 'diamond',
  price: 300000,
  color: '#ff3b80',
  bg: 'rgba(255, 59, 128, 0.12)',
  border: '#ff3b80',
  description: '신화급 티케 여신 컬렉션과 백만 코인 잭팟의 최고위 상자',
  drops: [
   { rate: 30.0, prize: { type:'dud', name:'꽝 (빈 상자)', message:'티케의 여신이 잠시 눈을 감았습니다... 다음 상자에 기적이!' } },
   { rate: 2.0, prize: { type:'coins', amount:1000000, name:'1,000,000 코인 (백만 코인 초대박!)' } },
   { rate: 26.0, prize: { type:'coins', amount:250000, name:'250,000 코인' } },
   { rate: 15.0, prize: { type:'coins', amount:50000, name:'50,000 코인' } },
   { rate: 3.0, prize: { type:'title', title:'티케의 총애', name:'[칭호] 티케의 총애' } },
   { rate: 3.0, prize: { type:'title', title:'불멸의 잭팟', name:'[칭호] 불멸의 잭팟' } },
   { rate: 3.0, prize: { type:'title', title:'살아있는 전설', name:'[칭호] 살아있는 전설' } },
   { rate: 3.0, prize: { type:'title', title:'신들의 연회', name:'[칭호] 신들의 연회' } },
   { rate: 3.0, prize: { type:'skin', skinId:'ball-tyche', name:'티케의 눈물(순금)' } },
   { rate: 3.0, prize: { type:'skin', skinId:'board-pantheon', name:'티케 판테온 보드' } },
   { rate: 3.0, prize: { type:'skin', skinId:'trail-prism', name:'프리즘 스펙트럼 트레일' } },
   { rate: 3.0, prize: { type:'skin', skinId:'rocket-tyche-hyperion', name:'티케 히페리온 로켓' } },
   { rate: 3.0, prize: { type:'skin', skinId:'penguin-tyche-angel', name:'티케 엔젤 펭귄' } },
  ],
 },
];
