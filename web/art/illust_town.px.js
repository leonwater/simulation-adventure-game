// 모험가 키우기 마을(게임 메인) 화면 배경 (v3.11, claude-pxl)
// 가로 200×112 (다른 일러스트와 같은 픽셀 크기). 하늘·구름 → 반목조 여관 거리(왼쪽 집 · 가운데 여관 · 오른쪽 가게) → 돌길.
// 사용자 참고 그림의 분위기(맑은 하늘의 중세 판타지 여관 거리)만 따르고 구성·건물은 새로 만들었다 (인물·글자 없음).
// 마을 화면은 칸 높이에 따라 위아래가 잘리므로(cover) 중요한 것(지붕~1층 문)은 가운데 띠에 둔다.
// 빌드: bash scripts/sprites.sh (→ public/illustrations/town.webp)
pal({
  k: "#2a1c18",
  // 하늘 · 구름
  S: "#7fa9cf", s: "#9cc0e0", a: "#bcd6ec", A: "#d9e8f4", w: "#f6f9fc", c: "#b9cde0", C: "#8fa9c4",
  // 먼 집들 (푸른 회색)
  f: "#8c9fb6", F: "#7488a2", g: "#a7b8cb",
  // 지붕 (갈색 기와)
  1: "#4a2a1c", 2: "#6b3c26", 3: "#8a5233", 4: "#a8693f", 5: "#c3824f",
  // 나무 (기둥 · 문 · 술통)
  6: "#3a2416", 7: "#5a3822", 8: "#7a4f30", 9: "#9c6a42",
  // 회벽
  p: "#f1e6d8", P: "#d9c9b6", q: "#bfae9a",
  // 돌 · 길
  t: "#8d8a86", T: "#6e6b68", u: "#a8a49f", U: "#c6c0b6", r: "#d9cfbf", R: "#b8ab98",
  // 창 · 불빛 · 푸른 슬레이트 지붕
  y: "#ffd27a", Y: "#e8a54a", o: "#5b7c9e", O: "#3d5a7a", n: "#4c6b8c",
  // 색 깃발 · 화분 · 간판
  x: "#d9604c", z: "#f0b44a", v: "#6fae5c", V: "#3f7a46", m: "#e9d2a0",
  // 굴뚝 벽돌 · 연기
  b: "#9a5440", B: "#73392b", e: "#e8edf2",
})

sprite("_cloud", { w: 34, h: 13 }, (c) => {
  for (const [x, y, r] of [[8, 8, 5], [15, 6, 6], [23, 6, 6], [29, 9, 4]]) c.circ(x, y, r, "w")
  c.rect(3, 8, 29, 5, "w")
  c.recolor({ w: "A" }, (x, y) => y >= 10, 1)
  c.recolor({ w: "c" }, (x, y) => y >= 12, 1)
})
sprite("_far", { w: 18, h: 24 }, (c) => {
  c.poly([0, 10, 9, 0, 18, 10], "F")
  c.rect(2, 10, 14, 14, "g")
  c.recolor({ g: "f" }, (x) => x > 10, 1)
  c.rect(5, 14, 2, 3, "F"); c.rect(11, 14, 2, 3, "F")
})
sprite("_tower", { w: 12, h: 40 }, (c) => {
  c.poly([0, 12, 6, 0, 12, 12], "F")
  c.rect(2, 12, 8, 28, "g")
  c.recolor({ g: "f" }, (x) => x > 6, 1)
  c.rect(5, 18, 2, 4, "F")
})
// 작은 술통 (세워 둔 통)
sprite("_keg", { w: 12, h: 14, outline: "6" }, (c) => {
  c.ellipse(6, 7, 5, 6, "8")
  c.recolor({ 8: "9" }, (x) => x < 4, 1)
  c.recolor({ 8: "7" }, (x) => x > 8, 1)
  c.hline(1, 3, 10, "6"); c.hline(1, 10, 10, "6")
})
sprite("_pot", { w: 6, h: 7 }, (c) => {
  c.circ(3, 2, 2, "v"); c.px(2, 1, "V")
  c.rect(1, 4, 4, 3, "3"); c.hline(1, 4, 4, "4")
})

// 창 하나 (덧문 + 꽃 상자)
const shutter = (c, x, y) => {
  c.rect(x, y, 8, 9, "o"); c.rect(x, y, 8, 1, "O"); c.vline(x + 4, y, 9, "7"); c.hline(x, y + 4, 8, "7"); c.px(x + 1, y + 2, "a")
  c.rect(x - 2, y, 2, 9, "8"); c.rect(x + 8, y, 2, 9, "8")
  c.rect(x - 1, y + 9, 10, 2, "8")
  for (let i = 0; i < 4; i++) c.px(x + i * 2 + 1, y + 8, ["x", "z", "v", "x"][i])
}
// 불 켜진 아치 창
const lit = (c, x, y, w, h) => {
  c.rect(x, y, w, h, "y"); c.ellipse(x + w / 2, y, w / 2, 3, "y")
  c.recolor({ y: "Y" }, (px, py) => py > y + h / 2 && px >= x && px < x + w, 1)
  c.vline(x + w / 2, y - 3, h + 3, "7"); c.hline(x, y + 4, w, "7")
  c.ellipse(x + w / 2, y, w / 2, 4, "7", true); c.vline(x - 1, y, h, "7"); c.vline(x + w, y, h, "7")
  c.rect(x - 1, y + h, w + 2, 2, "8")
}

scene("illust_town", { w: 200, h: 112, bg: "#7fa9cf" },
  // ── 하늘 ──
  grad(0, 0, 200, 70, "SsaA", "v", 0.6),
  stamp("_cloud", 6, 8), stamp("_cloud", 132, 3), stamp("_cloud", 82, 0, { flip: "x" }), stamp("_cloud", 168, 22),
  (c) => { for (const [x, y] of [[48, 10], [54, 7], [150, 18]]) { c.px(x, y, "C"); c.px(x + 1, y + 1, "C"); c.px(x + 2, y, "C") } },
  // ── 먼 거리 ──
  stamp("_tower", 30, 22), stamp("_far", 40, 34), stamp("_far", 150, 30), stamp("_tower", 186, 18),

  // ── 왼쪽 집 (푸른 슬레이트 지붕) ──
  poly([-6, 44, 20, 14, 46, 44], "n"),
  (c) => { for (let y = 20; y < 44; y += 4) for (let x = 0; x < 46; x++) if (c.is(x, y, "n")) c.px(x, y, "O") },
  line(-6, 44, 20, 14, "6"), line(20, 14, 46, 44, "6"),
  rect(0, 44, 42, 54, "P"),
  (c) => {
    for (const y of [44, 70]) { c.hline(0, y, 42, "7"); c.hline(0, y + 1, 42, "6") }
    for (const x of [0, 14, 28, 40]) c.rect(x, 44, 2, 54, "7")
    c.line(2, 68, 13, 47, "7"); c.line(29, 47, 39, 68, "7")
  },
  (c) => shutter(c, 17, 52),
  (c) => lit(c, 4, 80, 8, 10),
  rect(19, 78, 12, 20, "8"), ellipse(25, 78, 6, 3, "8"), vline(25, 76, 22, "7"), ellipse(25, 78, 6, 4, "6", true),

  // ── 여관 지붕 ──
  rect(62, 8, 8, 20, "b"), rect(60, 6, 12, 3, "B"), (c) => { for (let y = 11; y < 28; y += 3) c.hline(62, y, 8, "B") },
  circ(67, 2, 3, "e"), circ(72, -3, 3, "e"),
  poly([40, 54, 62, 20, 126, 20, 148, 54], "4"),
  (c) => {
    // 기와 줄: 지붕 안에만 (하늘에 줄이 새지 않게)
    const dot = (x, y) => { if (c.is(x, y, "45")) c.px(x, y, "3") }
    for (let y = 23, n = 0; y < 54; y += 4, n++) {
      for (let x = 38; x < 150; x++) dot(x, y)
      for (let x = 38 + (n % 2) * 3; x < 150; x += 6) for (let k = 1; k < 4; k++) dot(x, y + k)
    }
    c.recolor({ 4: "5" }, (x, y) => y < 28, 1)
  },
  line(40, 54, 62, 20, "2"), line(126, 20, 148, 54, "2"), hline(62, 19, 65, "2"), hline(62, 20, 65, "1"),
  // 지붕창 둘
  (c) => {
    for (const x of [72, 92]) {
      c.poly([x - 2, 36, x + 5, 29, x + 12, 36], "2")
      c.rect(x, 36, 10, 8, "p"); c.rect(x + 1, 37, 8, 6, "o"); c.vline(x + 5, 37, 6, "7"); c.px(x + 2, 38, "a")
    }
  },

  // ── 여관 2층: 회벽 + 나무 기둥 (반목조) ──
  rect(44, 54, 112, 21, "p"),
  recolor({ p: "P" }, (x, y) => x > 128 && y >= 54 && y < 75),
  (c) => {
    for (const y of [54, 73]) { c.hline(44, y, 112, "7"); c.hline(44, y + 1, 112, "6") }
    for (let x = 44; x <= 154; x += 16) c.rect(x, 54, 2, 21, "7")
    c.line(46, 72, 59, 56, "7"); c.line(110, 56, 123, 72, "7"); c.line(110, 72, 123, 56, "7")
  },
  (c) => { for (const x of [64, 82, 98, 140]) shutter(c, x, 58) },
  // 앞으로 튀어나온 박공 (오른쪽)
  poly([112, 56, 136, 18, 160, 56], "3"),
  (c) => { for (let y = 24; y < 56; y += 4) for (let x = 112; x < 161; x++) if (c.is(x, y, "3")) c.px(x, y, "2") },
  line(112, 56, 136, 18, "1"), line(136, 18, 160, 56, "1"),
  poly([119, 56, 136, 30, 153, 56], "p"),
  ring(136, 46, 4, "7"), circ(136, 46, 3, "o"), vline(136, 43, 7, "7"), hline(133, 46, 7, "7"), px(135, 44, "a"),
  hline(112, 56, 49, "6"),
  hline(44, 75, 112, "q"),

  // ── 여관 1층 ──
  rect(46, 76, 108, 22, "p"),
  recolor({ p: "P" }, (x, y) => x > 128 && y >= 76),
  rect(46, 94, 108, 4, "u"), (c) => { for (let x = 46; x < 154; x += 6) c.vline(x, 94, 4, "t") }, hline(46, 94, 108, "t"),
  (c) => { for (const x of [46, 76, 124, 152]) c.rect(x, 76, 2, 18, "7") },
  (c) => { lit(c, 53, 82, 16, 9); lit(c, 131, 82, 16, 9) },
  // 아치 문
  rect(92, 80, 16, 14, "8"), ellipse(100, 80, 8, 5, "8"),
  (c) => { for (const x of [96, 100, 104]) c.vline(x, 76, 18, "7"); c.px(103, 87, "z") },
  ellipse(100, 80, 9, 6, "6", true), vline(91, 80, 14, "6"), vline(108, 80, 14, "6"),
  // 매달린 간판 (술잔 그림, 글자 없음)
  hline(110, 77, 13, "6"), vline(112, 77, 2, "6"), vline(121, 77, 2, "6"),
  rect(110, 79, 13, 9, "8"), rect(111, 80, 11, 7, "m"), rect(114, 81, 4, 5, "z"), px(118, 82, "z"), px(118, 83, "z"), hline(114, 81, 4, "w"),
  // 색 깃발 줄
  (c) => {
    c.line(48, 77, 90, 77, "6")
    for (let i = 0; i < 6; i++) { const x = 50 + i * 7; c.poly([x, 77, x + 4, 77, x + 2, 80], ["x", "z", "v"][i % 3]) }
  },
  // 등불 (문 왼쪽)
  vline(87, 79, 2, "6"), rect(85, 81, 5, 6, "6"), rect(86, 82, 3, 4, "y"), px(87, 83, "w"),
  stamp("_pot", 82, 91), stamp("_pot", 110, 91),

  // ── 오른쪽 가게 (줄무늬 차양) ──
  poly([154, 44, 180, 14, 206, 44], "n"),
  (c) => { for (let y = 20; y < 44; y += 4) for (let x = 154; x < 200; x++) if (c.is(x, y, "n")) c.px(x, y, "O") },
  line(154, 44, 180, 14, "6"),
  rect(158, 44, 42, 54, "p"),
  recolor({ p: "P" }, (x, y) => x >= 158 && y >= 44),
  (c) => {
    for (const y of [44, 66]) { c.hline(158, y, 42, "7"); c.hline(158, y + 1, 42, "6") }
    for (const x of [158, 172, 186]) c.rect(x, 44, 2, 54, "7")
    c.line(188, 64, 199, 47, "7")
  },
  (c) => shutter(c, 164, 50),
  // 차양 (빨강·흰 줄)
  (c) => {
    for (let x = 158; x < 200; x++) c.vline(x, 70, 6, Math.floor((x - 158) / 4) % 2 ? "w" : "x")
    for (let x = 158; x < 200; x += 4) c.px(x + 2, 76, Math.floor((x - 158) / 4) % 2 ? "w" : "x")
  },
  rect(160, 78, 38, 16, "O"), rect(160, 90, 38, 4, "8"),
  stamp("_keg", 162, 84), stamp("_keg", 175, 84), stamp("_keg", 168, 82),

  // ── 돌길 ──
  rect(0, 98, 200, 14, "r"), noise(0, 98, 200, 14, "R", 0.22, 7, "r"),
  hline(0, 98, 200, "R"),
  (c) => { for (let y = 102, n = 0; y < 112; y += 4, n++) for (let x = (n % 2) * 5; x < 200; x += 10) c.px(x, y, "U") },
)
