// 모험가 키우기 시설 일러스트 (v3.9 초안 2, claude-pxl)
// 192×96 장면(게임에서 약 2배). 배경은 5~7단 색 단계·점무늬 그러데이션·빛 번짐으로 깊이를 주고,
// 인물은 가슴 위 반신(높이 약 60칸)에 큰 눈·3~4단 명암·재질별 어두운 테두리.
// 참고 그림의 '수준'만 따르고 모양·색·구성은 새로 만든다 (고블린 상인 · 펠트 모자 · 외알 안경).
// 빌드: bash scripts/sprites.sh (→ public/illustrations/*.webp)
pal({
  k: "#1a1420", K: "#2b1c22",                                         // 테두리
  0: "#1e130e", 1: "#2c1c15", 2: "#3f281d", 3: "#573826", 4: "#744b31", 5: "#97653f", 6: "#bd8a57", 7: "#dcb07a", // 나무
  G: "#2e3a1e", f: "#56673a", e: "#7d8f52", h: "#a3b36e", H: "#c8d394", // 고블린 피부 (올리브)
  d: "#1d171b", D: "#352b31", C: "#5d4f57",                           // 머리카락 (뒤로 넘긴 검은 머리)
  r: "#b8704a",                                                       // 볼·귀 안쪽
  w: "#f4f1e8", i: "#e0a53a", I: "#8a4f1c",                           // 눈
  m: "#5a1a26", W: "#fff6dc",                                         // 입
  n: "#1c1224", N: "#311e3d", b: "#4a2c58", B: "#68427c", c: "#8a62a0", // 코트 (자두색)
  S: "#b9ab8c", s: "#ece2c8",                                         // 셔츠·종이
  Q: "#5c1a2a", R: "#94303e", q: "#cf4b52", x: "#f28a7c",              // 빨강
  Y: "#7a4a16", y: "#c08a30", z: "#f2c85a", Z: "#fff1b0",             // 금
  P: "#3a1f3a", p: "#5c3358", o: "#86507c",                           // 모자 (자두색 펠트)
  U: "#3d4c66", u: "#62779a", A: "#8fb6dc", a: "#bcd8ef", l: "#e9f3fb", // 창밖 하늘·지붕
  J: "#4a5268", M: "#8a93a8", j: "#cfd5e0",                           // 강철
  T: "#22573a", t: "#3f9a5a", g: "#8ee08a",                           // 초록 물약
  O: "#203a7a", v: "#3b6fd0", V: "#9cc8ff",                           // 파란 물약
  F: "#ff9a3c", L: "#ffe27a",                                         // 불꽃
})
ramps("k0123456", "kGfehH", "kdDC", "knNbBc", "kQRqx", "kYyzZ", "kPpo", "kUuAal", "kJMj", "kTtg", "kOvV", "kSs")

// 빛·그늘: 정한 색만 한 단계씩 (테두리 검정은 그대로)
const LIT = { 0: "1", 1: "2", 2: "3", 3: "4", 4: "5", 5: "6", 6: "7", N: "b", b: "B", B: "c", f: "e", e: "h", p: "o", P: "p", y: "z", J: "M", M: "j" }
const DIM = { 1: "0", 2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", b: "N", B: "b", c: "B", e: "f", h: "e", S: "B", s: "S", u: "U", A: "u", a: "A" }

// ── 상인 (가슴 위 반신, 72×64) ──
sprite("_merchant", { w: 84, h: 80, outline: "k" }, (c) => {
  // 뒤로 넘겨 어깨까지 내려온 머리 (머리 뒤)
  c.poly([29, 14, 55, 14, 58, 33, 52, 36, 32, 36, 26, 33], "d")
  // 코트 몸통: 넓은 어깨, 왼쪽 그늘 · 오른쪽 빛
  c.poly([1, 80, 3, 52, 12, 40, 27, 33, 57, 33, 72, 40, 81, 52, 83, 80], "b")
  c.poly([1, 80, 3, 52, 12, 40, 27, 33, 31, 33, 20, 80], "N")
  c.poly([57, 33, 72, 40, 81, 52, 83, 80, 70, 80, 66, 46], "B")
  c.line(73, 42, 81, 56, "c")
  // 셔츠 깃 · 넥타이
  c.poly([31, 33, 53, 33, 42, 50], "s"); c.poly([31, 33, 35, 33, 42, 50], "S")
  c.poly([39, 35, 45, 35, 44, 47, 40, 47], "n"); c.line(43, 36, 43, 45, "N")
  // 높은 깃(라펠) + 금실 테두리 · 수
  c.poly([24, 29, 31, 33, 41, 52, 33, 56, 20, 42], "N")
  c.poly([60, 29, 53, 33, 43, 52, 51, 56, 64, 42], "c")
  c.line(31, 33, 41, 52, "y"); c.line(53, 33, 43, 52, "z")
  c.line(24, 29, 20, 42, "y"); c.line(60, 29, 64, 42, "z")
  for (const [x, y] of [[25, 40], [27, 43], [24, 45], [58, 40], [56, 43], [59, 45]]) c.px(x, y, "y")
  // 앞섶: 금실 두 줄 + 단추
  c.vline(40, 52, 28, "y"); c.vline(44, 52, 28, "z"); c.vline(42, 52, 28, "n")
  // 소매 → 흰 주름 소매 끝 → 깍지 낀 손 (가슴 앞)
  c.poly([3, 52, 12, 40, 21, 44, 31, 57, 27, 65, 12, 70], "N")
  c.poly([81, 52, 72, 40, 63, 44, 53, 57, 57, 65, 72, 70], "B")
  c.poly([26, 55, 33, 52, 36, 61, 30, 66], "s"); c.px(27, 58, "S"); c.px(29, 63, "S"); c.px(31, 60, "S")
  c.poly([58, 55, 51, 52, 48, 61, 54, 66], "s"); c.px(56, 58, "S"); c.px(53, 63, "S")
  c.stamp("_hands", 33, 50)
  // 목
  c.rect(37, 27, 10, 7, "f"); c.hline(37, 27, 10, "G")
  // 귀: 옆으로 뻗은 뾰족귀 (조금 위로)
  c.poly([32, 16, 12, 11, 16, 17, 32, 23], "f"); c.poly([30, 17, 17, 13, 19, 16, 30, 21], "r")
  c.poly([52, 16, 72, 11, 68, 17, 52, 23], "e"); c.poly([54, 17, 67, 13, 65, 16, 54, 21], "r")
  c.line(53, 16, 71, 11, "h")
  // 얼굴: 둥근 볼 (작은 머리)
  c.ellipse(42, 17, 11, 12, "e")
  c.ellipse(42, 21, 11, 8, "e")
  c.recolor({ e: "f" }, (x, y) => ((x - 45) / 11) ** 2 + ((y - 18) / 13) ** 2 > 1, 1)
  c.recolor({ e: "h" }, [48, 13, 3], 1)
  // 앞머리: 뒤로 넘긴 머리 + 윤기
  c.poly([30, 13, 31, 6, 36, 3, 48, 3, 53, 6, 54, 13, 51, 9, 44, 8, 36, 9, 33, 11], "D")
  c.line(35, 5, 41, 4, "C"); c.line(44, 4, 50, 6, "C"); c.line(33, 9, 37, 6, "C")
  // 눈썹 · 웃는 눈 (가늘게)
  c.hline(34, 12, 4, "G"); c.hline(46, 12, 4, "G")
  c.hline(35, 14, 4, "k"); c.px(35, 15, "w"); c.hline(36, 15, 2, "I"); c.px(38, 15, "k"); c.hline(36, 16, 2, "f")
  c.hline(46, 14, 4, "k"); c.px(46, 15, "w"); c.hline(47, 15, 2, "i"); c.px(49, 15, "k"); c.hline(47, 16, 2, "e")
  // 외알 안경 (오른눈) + 사슬
  c.ring(48, 15, 3, "y"); c.px(49, 13, "Z")
  for (let k = 0; k < 10; k++) c.px(51 + Math.round(k * 0.5), 18 + k * 2, "z")
  // 코 (길쭉, 왼쪽 그늘)
  c.poly([41, 16, 43, 16, 46, 22, 42, 23], "e"); c.line(41, 17, 42, 22, "f"); c.px(45, 21, "h")
  // 입: 다문 채 웃는 입꼬리
  c.px(37, 24, "m"); c.hline(38, 25, 8, "m"); c.px(46, 24, "m"); c.hline(39, 24, 6, "W")
  c.hline(39, 27, 6, "f")
  // 볼
  c.hline(35, 20, 2, "r"); c.hline(49, 20, 2, "r")
})

// 깍지 낀 두 손 (손가락이 엇갈림 · 금반지)
sprite("_hands", {}, `
  ...GGGGGGGGGGGG...
  ..GehGehGehGehhG..
  .GeeGeeGehGehhhhG.
  .GfeGeeGeeGeehhhG.
  GffeeeeeeeeeeehhhG
  GffzeeeeeeeeeeehhG
  GfffeeeeeeeeezyhhG
  .GffeeeeeeeeeeehG.
  .GfffGeeeeeeGehG..
  ..GffGeeeeeeGeG...
  ...GGGGGGGGGGGG...`)

// ── 소품 ──
sprite("_bottle", { outline: "k" }, `
  ..444..
  ..lal..
  .qqqqq.
  qZqqqqR
  qxqqqqR
  qqqqqRR
  .qRRRR.`)
sprite("_jar", { outline: "k" }, `
  .5555.
  SSSSSS
  sSSSSB
  sSSSSB
  SSSSBB
  .BBBB.`)
sprite("_book", { outline: "k" }, `
  RRR
  RzR
  RRR
  RRR
  RzR
  RRR
  RRR`)
sprite("_lantern", { outline: "k" }, `
  ..yy..
  .yzzy.
  yyyyyy
  yLLLLy
  yLFFLy
  yLFFLy
  yLLLLy
  yyyyyy
  .YYYY.`)
sprite("_helmet", { outline: "k" }, `
  ...jjjj...
  .jjjMMMMM.
  jjjMMMMMMJ
  jMMMMMMMMJ
  jMkkkkkkMJ
  jMkMMMMkMJ
  MMMJJJJMMJ
  .JJJ..JJJ.`)
// 동전 더미
sprite("_coins", { outline: "k" }, `
  ...zzz....
  ..zZzzy...
  .zzyyyyz..
  zzZzzzyyy.
  yyyyyyyyyY
  YyyyyyyyYY`)

// ── 장면 ──
scene("illust_shop", { w: 192, h: 96, bg: "#1a1420" },
  // 뒷벽: 세로 판자 (판자마다 밝기 조금씩)
  rect(0, 0, 192, 74, "3"),
  (c) => {
    for (let x = 0, n = 0; x < 192; x += 11, n++) {
      if (n % 3 === 1) c.rect(x + 1, 0, 10, 74, "2")
      c.vline(x, 0, 74, "1")
    }
  },
  noise(0, 6, 192, 66, "2", 0.05, 7, "3"),
  noise(0, 6, 192, 66, "4", 0.03, 9, "3"),
  // 천장 들보
  rect(0, 0, 192, 5, "2"), hline(0, 5, 192, "1"), hline(0, 6, 192, "0"),
  (c) => { for (let x = 20; x < 192; x += 56) { c.rect(x, 0, 6, 7, "4"); c.vline(x + 5, 0, 7, "2") } },

  // 창문 (상인 뒤): 하늘 그러데이션 + 구름 + 먼 지붕
  rect(62, 10, 68, 40, "0"),
  grad(64, 12, 64, 36, "AAaal", "v", 0.7),
  ellipse(80, 20, 9, 3, "l"), ellipse(88, 19, 6, 3, "l"), ellipse(118, 26, 8, 2, "l"), ellipse(112, 25, 5, 2, "l"),
  dither(64, 22, 64, 4, ".", "l", 0.12),
  poly([64, 48, 64, 38, 70, 38, 70, 34, 76, 30, 82, 34, 82, 40, 92, 40, 92, 36, 98, 36, 98, 40, 108, 38, 108, 32, 112, 26, 116, 32, 116, 40, 128, 38, 128, 48], "u"),
  poly([64, 48, 64, 42, 74, 42, 78, 40, 88, 44, 100, 42, 112, 44, 128, 42, 128, 48], "U"),
  // 창틀 · 십자 창살
  box(62, 10, 68, 40, "1"), box(63, 11, 66, 38, "5"), rect(95, 12, 2, 36, "5"), rect(64, 29, 64, 2, "5"),
  hline(62, 50, 68, "6"), hline(62, 51, 68, "2"),
  // 창에서 들어오는 빛
  layer("winlight", { light: LIT, density: 0.25 }, poly([62, 50, 130, 50, 150, 74, 42, 74], "k")),

  // 왼쪽 선반: 투구 · 물약 · 단지 · 책
  rect(3, 9, 52, 62, "1"), box(3, 9, 52, 62, "0"),
  (c) => { for (const y of [27, 46, 64]) { c.rect(4, y, 50, 2, "5"); c.hline(4, y, 50, "6"); c.hline(4, y + 2, 50, "0") } },
  stamp("_helmet", 7, 17), stamp("_jar", 22, 20), stamp("_bottle", 33, 18), stamp("_bottle", 43, 18, { swap: { q: "v", R: "O", x: "V" } }),
  stamp("_book", 6, 37), stamp("_book", 10, 37, { swap: { R: "O", z: "V" } }), stamp("_book", 14, 38, { swap: { R: "T", z: "g" } }),
  stamp("_book", 18, 37, { swap: { R: "p" } }),
  stamp("_bottle", 26, 37, { swap: { q: "t", R: "T", x: "g" } }), stamp("_jar", 37, 39, { swap: { S: "6", s: "7", B: "5" } }),
  stamp("_coins", 40, 57), stamp("_jar", 8, 56), stamp("_bottle", 22, 55),

  // 오른쪽 벽: 방패 · 칼 · 활 · 등불
  rect(140, 9, 50, 62, "2"), box(140, 9, 50, 62, "1"),
  circ(158, 32, 11, "R"), circ(158, 32, 9, "q"), ring(158, 32, 11, "4"), ring(158, 32, 10, "5"),
  recolor({ q: "R" }, [147, 21, 11, 22]),
  rect(157, 23, 2, 18, "z"), rect(150, 31, 16, 2, "z"), circ(158, 32, 2, "j"),
  // 칼 (세로로 걸어 둠)
  rect(178, 14, 3, 32, "j"), vline(180, 14, 32, "M"), px(179, 13, "j"),
  rect(175, 46, 9, 2, "y"), hline(175, 46, 9, "z"), rect(178, 48, 3, 6, "2"), px(179, 54, "z"),
  // 작은 선반: 물약 둘 · 약초 단지
  rect(144, 56, 42, 2, "5"), hline(144, 56, 42, "6"), hline(144, 58, 42, "0"),
  stamp("_bottle", 146, 47, { swap: { q: "v", R: "O", x: "V" } }), stamp("_jar", 158, 49, { swap: { S: "t", s: "g", B: "T" } }), stamp("_bottle", 168, 47, { swap: { q: "o", R: "p", x: "Z" } }),
  // 걸어 둔 등불
  vline(150, 0, 6, "0"), stamp("_lantern", 146, 6),
  layer("lamp1", { light: LIT, density: 0.3 }, circ(149, 12, 26, "k")),
  layer("lamp2", { light: LIT }, circ(149, 12, 12, "k")),

  // 상인 (카운터 뒤)
  stamp("_merchant", 54, 4),

  // 카운터
  rect(0, 70, 192, 4, "5"), hline(0, 70, 192, "7"), hline(0, 71, 192, "6"), hline(0, 74, 192, "1"),
  rect(0, 75, 192, 21, "3"),
  (c) => { for (let x = 4; x < 192; x += 32) { c.box(x, 78, 26, 15, "2"); c.hline(x + 1, 79, 24, "4") } },
  hline(0, 75, 192, "2"),
  // 카운터 위: 물약 셋 · 동전 · 장부
  stamp("_bottle", 14, 60), stamp("_bottle", 24, 60, { swap: { q: "v", R: "O", x: "V" } }), stamp("_bottle", 34, 60, { swap: { q: "t", R: "T", x: "g" } }),
  stamp("_coins", 140, 64), stamp("_coins", 150, 65),
  poly([158, 70, 164, 63, 186, 63, 190, 70], "s"), line(174, 63, 174, 70, "S"), hline(166, 65, 6, "S"), hline(166, 67, 5, "S"), hline(177, 65, 7, "S"),
  line(184, 58, 179, 66, "w"),

  // 가장자리 어둡게 (점무늬)
  layer("vig", { shade: DIM, density: 0.5 }, rect(0, 0, 192, 3, "k"), rect(0, 0, 3, 96, "k"), rect(189, 0, 3, 96, "k")),
)
