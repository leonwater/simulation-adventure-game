// 모험가 키우기 시설 일러스트 (초안, claude-pxl): 유닛·물품과 같은 색표 · 검은 테두리 · 납작한 2~3단 명암
// 128×64 = 게임에서 약 3배 (전투 유닛과 같은 픽셀 크기). 물품은 items.px.js 그림을 그대로 올린다.
// 빌드: node .pxl/bin/pxl.js build art/illust.px.js --out art/out/illust
include("items.px.js")
pal({
  k: "#1a1420",
  s: "#f2c9a0", S: "#c98f6a", u: "#8e5a44",               // 피부
  w: "#f4f6fb", m: "#d3d8e2", M: "#8f98ab", n: "#59627a", // 강철·흰색
  r: "#e0565e", R: "#a83a48", Q: "#6e2236",               // 빨강
  y: "#f6d070", Y: "#c8963a",                             // 금
  d: "#a87650", D: "#6e4630", E: "#4a2e22",               // 가죽·나무
  l: "#c8f08a", g: "#7ccf5a", G: "#3f8f3f", t: "#245a3a", // 슬라임
  e: "#9bbf4a", f: "#5f8a2e",                             // 고블린 피부
  b: "#f3ecd8", B: "#c9bc9c", c: "#8a7d62",               // 뼈
  x: "#ff6a3c", z: "#ffe066",                             // 눈빛
  p: "#b07ee0", P: "#7048a8", o: "#3e2860",               // 보라
  a: "#8fd4ff", A: "#3f80c0", O: "#23446e",               // 파랑
  i: "#b4b0a8", I: "#7a766f", j: "#46433f",               // 회색 (털·돌)
  v: "#62a868", V: "#336e40",                             // 숲 초록
  q: "#c08a5c", T: "#7e5434",                             // 갈색 털
  N: "#433d5e", Z: "#28233c",                             // 검은 천
  H: "#ffa040",                                           // 불꽃
  W: "#ffffff", L: "#fff1b0",                             // 하이라이트
  9: "#2e1d18", 8: "#3a261e",                             // 가게 안 어두운 벽 (일러스트 전용)
})
ramps("k89EDdq", "kQRr", "kunSs", "knMmw", "kYy", "kfe", "kcBb", "koPp", "kOAa", "kjIi", "kVv", "kZN")

// ── 부품 ──
// 상인 고블린: 대머리 · 큰 귀 · 외알 안경 · 금니 · 갈색 조끼 + 흰 셔츠 · 붉은 넥타이 · 깍지 낀 손
sprite("_merchant", { outline: "k" }, `
  ..............ffffff..............
  ............ffeeeeeeff............
  ...........feeeeeeeeeef...........
  ..........feeeeeeeeeeeef..........
  ff........feeeeeeeeeeeef........ff
  eef.......feeeeeeeeeeeef.......fee
  .eeff....feeeeeeeeeeeeeef....ffee.
  ..eeeff..feeyyyeeeeekkeef..ffeee..
  ...eeeeffeeyakyeeeeewkeeeffeeee...
  ....eeeefeeyyyeeeeeeeeeeefeeee....
  .....ffeefeeeeeffeeeeeeeefeeff....
  .......ffeeeeeeeffeeeeeeeeff......
  .........feeeeeeffeeeeeef.........
  .........fefkkkkkkkkkkfef.........
  ..........feekbybbbbkeef..........
  ...........ffeekkkkeeff...........
  .............ffffffff.............
  .........DDDDDbbbbbbDDDDD.........
  ......DDDdddDDbbRRbbDDdddDDD......
  .....DdddddddDDbRRbDDdddddddD.....
  ....DddddddddDdBRRBdDddddddddD....
  ....DdddddddDDdbRRbdDDdddddddD....
  ....DdddddddDddbbbbddDdddddddD....
  ....DddddddDDdddbbdddDDddddddD....
  ....DddddddDddddyddddDDddddddD....
  ....DdddddEDDDDdddddDDDDEddddD....
  ....DddddEDDDDDDddDDDDDDEdddD.....
  ....DddddEDDDDDDDDDDDDDDEdddD.....
  ....DddddEEDDDDDDDDDDDDEEddddD....
  ....DdddddEEEEEEEEEEEEEEdddddD....
  ....DddddddddddddddddddddddD......
  ....DddddddddddddddddddddddD......`)

// 카운터에 올린 주먹 (흰 소매 끝)
sprite("_fist", { outline: "k" }, `
  bbbb.
  .eee.
  eeeee
  efefe
  .fff.`)

// 책 한 권 (세로), 색만 바꿔 쓴다
sprite("_book", { outline: "k" }, `
  RR
  Ry
  RR
  RR
  Ry
  RR`)
// 촛불
sprite("_candle", {}, `
  .z.
  .H.
  .b.
  bbB
  bbB
  YYY`)
// 매달린 등불
sprite("_lantern", { outline: "k" }, `
  .YY.
  YYYY
  YzzY
  YzHY
  YzzY
  YYYY`)
// 가격표
sprite("_tag", {}, `
  bbbb
  bkkb
  bbbb`)
// 금화 더미
sprite("_coins", { outline: "k" }, `
  ..yy..
  .yyYy.
  yyYyyY
  yYyyYy`)

// 세워 둔 큰 검
sprite("_bigsword", { outline: "k" }, `
  ..w..
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  .wmM.
  YyyyY
  ..E..
  ..D..
  ..E..
  ..y..`)
// 세워 둔 활 (왼쪽으로 휜 몸 + 곧은 시위)
sprite("_bigbow", { outline: "k" }, `
  ....dD
  ...dDB
  ...dDB
  ..dD.B
  ..dD.B
  ..dD.B
  .dD..B
  .dD..B
  .dD..B
  dD...B
  dD...B
  EE...B
  EE...B
  EE...B
  EE...B
  EE...B
  EE...B
  EE...B
  EE...B
  dD...B
  dD...B
  .dD..B
  .dD..B
  .dD..B
  ..dD.B
  ..dD.B
  ..dD.B
  ...dDB
  ...dDB
  ....dD`)

// 불빛이 닿으면 벽·나무만 한 단계 밝게 (테두리 검정은 그대로)
const LIT = { 9: "8", 8: "E", E: "D", D: "d", d: "q" }

// 선반 한 칸 (나무 판 + 그림자)
const shelf = (x, y, w) => [rect(x, y, w, 2, "d"), hline(x, y + 2, w, "E"), hline(x, y + 3, w, "k")]

scene("illust_shop", { w: 128, h: 64, bg: "#1a1420" },
  // 뒷벽: 어두운 세로 판자 + 들보
  rect(0, 0, 128, 50, "8"),
  (c) => { for (let x = 3; x < 128; x += 9) c.vline(x, 0, 50, "9") },
  noise(0, 4, 128, 44, "9", 0.06, 3, "8"),
  rect(0, 0, 128, 3, "D"), hline(0, 3, 128, "k"),
  // 왼쪽 선반: 위 갑옷·투구, 아래 책·스킬서
  rect(1, 6, 36, 40, "9"), box(1, 6, 36, 40, "k"),
  ...shelf(2, 23, 34), ...shelf(2, 40, 34),
  stamp("armor", 3, 7), stamp("helmet", 18, 7),
  stamp("_candle", 32, 17),
  stamp("_book", 4, 31), stamp("_book", 8, 31, { swap: { R: "A", y: "a" } }), stamp("_book", 12, 31, { swap: { R: "V", y: "v" } }),
  stamp("skillbook", 17, 24), stamp("necklace", 26, 24),
  // 오른쪽 선반: 책 줄 + 반지, 아래 신발·바지
  rect(92, 6, 35, 40, "9"), box(92, 6, 35, 40, "k"),
  ...shelf(93, 23, 33), ...shelf(93, 40, 33),
  stamp("_book", 95, 14), stamp("_book", 99, 14, { swap: { R: "P", y: "p" } }), stamp("_book", 103, 14, { swap: { R: "A", y: "a" } }),
  stamp("_book", 107, 14, { swap: { R: "V", y: "v" } }), stamp("_book", 111, 14),
  stamp("ring", 116, 7), stamp("weapon_rogue", 96, 24), stamp("weapon_mage", 110, 24),
  // 매달린 등불
  vline(85, 4, 4, "k"), stamp("_lantern", 83, 8),
  // 상인 (카운터 뒤)
  stamp("_merchant", 46, 14), stamp("_fist", 53, 43), stamp("_fist", 68, 43, { flip: "x" }),
  // 카운터 옆에 세워 둔 검·활
  stamp("_bigsword", 78, 22), stamp("_bigbow", 84, 17),
  // 카운터
  rect(0, 48, 128, 3, "d"), hline(0, 48, 128, "q"), hline(0, 51, 128, "k"),
  rect(0, 52, 128, 12, "D"),
  (c) => { for (let x = 15; x < 128; x += 24) c.vline(x, 53, 11, "E") },
  hline(0, 52, 128, "E"),
  // 카운터 위 물건
  stamp("potion", 4, 33), stamp("potion_hi", 16, 33), stamp("antidote", 28, 33),
  stamp("_tag", 8, 49), stamp("_tag", 20, 49),
  stamp("_coins", 47, 43), stamp("salve", 100, 33), stamp("enhance_stone", 112, 33),
  stamp("_tag", 104, 49),
  // 불빛
  // 등불·촛불 빛: 둘레를 한 단계 밝게 (바깥은 점무늬로 흐리게)
  layer("light", { light: LIT, density: 0.5 }, circ(85, 13, 16, "k"), circ(33, 18, 6, "k")),
  layer("light2", { light: LIT }, circ(85, 13, 8, "k"), circ(33, 18, 3, "k")),
)
