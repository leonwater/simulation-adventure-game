// 모험가 키우기 길드 일러스트 (v3.9 초안, claude-pxl) — 접수원 중심
// 192×128 (3:2, 원래 일러스트와 같은 비율, 게임에서 약 2배). 화면에서는 위아래가 조금 잘리고 아래에 대사 상자가 덮으므로 얼굴은 위쪽 절반에 둔다.
// 인물: 가슴 위 반신, 큰 눈(위 속눈썹 두껍게 · 홍채 위 어둡고 아래 밝게 · 빛 두 점) · 머리카락 윤기 띠 · 옆머리 · 볼 홍조.
// 디자인은 원래 길드 접수원(짧은 적갈색 단발 · 초록 눈 · 초록 조끼 · 흰 블라우스 · 크림 자보 · 에메랄드 브로치 · 책)을 따르고,
// 참고 그림(사용자 제공)은 그리는 수준만 참고한다.
// 빌드: bash scripts/sprites.sh (→ public/illustrations/guild_receptionist.webp)
pal({
  k: "#1a1420",
  0: "#1e130e", 1: "#2c1c15", 2: "#3f281d", 3: "#573826", 4: "#744b31", 5: "#97653f", 6: "#bd8a57", 7: "#dcb07a", // 나무
  A: "#3a1612", B: "#6e2a1c", C: "#9a4426", D: "#c2622f", F: "#e08a4a", H: "#f6b47a",   // 적갈색 머리
  K: "#7a4038", S: "#d4917a", s: "#f0c0a0", l: "#fbdcc6", L: "#fff3e6",                 // 피부
  E: "#173828", e: "#2f6e4a", g: "#6cbf88", w: "#f4efe8", W: "#ffffff",                 // 눈
  b: "#f0988a", m: "#a84848", M: "#e88878",                                             // 볼 · 입
  n: "#0f1f17", N: "#1b3326", v: "#284d38", V: "#3d6e52",                               // 초록 조끼 · 깃발
  q: "#7e7c94", Q: "#b9b6c8", x: "#e2dfea", X: "#ffffff",                               // 흰 블라우스
  j: "#c8b28a", J: "#efe2bf",                                                           // 크림 자보
  Y: "#7a4a16", y: "#c08a30", z: "#f2c85a", Z: "#fff1b0",                               // 금
  G: "#1f7a4a", t: "#4fcf8a",                                                           // 에메랄드
  p: "#cdbf98", P: "#e9dfc0", o: "#9a8a66",                                             // 종이
  R: "#4a2018", r: "#7e3c2c", u: "#a0583c",                                             // 책 표지
  i: "#241e2a", I: "#342c3a", O: "#463c4e",                                             // 돌벽
  T: "#ffcf73", a: "#ffeab0",                                                           // 창 불빛
})
ramps("k01234567", "kABCDFH", "kKSslL", "knNvV", "kqQxX", "kjJ", "kYyzZ", "kopP", "kRru", "kiIO")

const LIT = { 0: "1", 1: "2", 2: "3", 3: "4", 4: "5", 5: "6", 6: "7", i: "I", I: "O", N: "v", v: "V", R: "r", r: "u", o: "p", p: "P" }

// ── 접수원: 눈 (왼쪽 눈 기준, 오른쪽은 뒤집어 씀) ──
sprite("_reye", {}, `
  .kkkkkkk.
  kkEEEEEkk
  .wEWWEEw.
  .wEWkkEw.
  .wEekkew.
  .wEeeWgw.
  ..EgggE..
  ...kkkk..`)

// ── 접수원: 머리 (52×56) ──
sprite("_rhead", { w: 52, h: 56, outline: "k" }, (c) => {
  // 뒷머리: 턱선까지 오는 단발, 끝이 안으로 말림
  c.ellipse(26, 24, 24, 22, "C")
  c.rect(3, 24, 46, 20, "C")
  c.ellipse(9, 44, 7, 4, "C"); c.ellipse(43, 44, 7, 4, "C")
  c.recolor({ C: "B" }, (x, y) => x < 14 || y > 40, 1)
  c.recolor({ C: "D" }, (x, y) => x > 40 && y < 38, 1)
  // 목
  c.rect(21, 44, 10, 12, "s"); c.recolor({ s: "S" }, (x, y) => y < 50 || x < 23, 1)
  // 얼굴: 볼은 넓고 턱은 좁게
  c.ellipse(26, 28, 15, 15, "s")
  c.poly([11, 30, 41, 30, 35, 41, 26, 47, 17, 41], "s")
  // 명암: 왼쪽 볼 그늘(얇게) · 오른쪽 볼 밝게
  c.recolor({ s: "S" }, (x, y) => ((x - 28) / 15) ** 2 + ((y - 30) / 17) ** 2 > 1, 1)
  c.recolor({ s: "l" }, (x, y) => ((x - 35) / 4) ** 2 + ((y - 35) / 2.5) ** 2 < 1, 1)
  // 눈썹 (앞머리 사이로 살짝)
  c.line(14, 25, 20, 24, "B"); c.line(32, 24, 38, 25, "B")
  // 눈
  c.stamp("_reye", 12, 27); c.stamp("_reye", 31, 27, { flip: "x" })
  // 코 · 입 (부드럽게 웃음) · 홍조
  c.px(26, 39, "S"); c.px(27, 38, "L")
  c.px(22, 42, "m"); c.hline(23, 43, 6, "m"); c.px(29, 42, "m"); c.hline(24, 44, 4, "M")
  c.hline(14, 37, 4, "b"); c.hline(15, 38, 3, "b"); c.hline(34, 37, 4, "b"); c.hline(34, 38, 3, "b")
  // 앞머리: 끝이 뾰족한 가닥들
  c.poly([5, 26, 7, 12, 15, 5, 26, 3, 37, 5, 45, 12, 47, 26, 44, 31, 41, 23, 38, 29, 34, 21, 31, 27, 27, 19, 24, 28, 20, 20, 16, 28, 12, 21, 9, 31], "D")
  c.recolor({ D: "C" }, (x, y) => x < 17, 1)
  // 가닥 사이 틈: 위는 굵고 끝으로 갈수록 가늘게, 살짝 휘어짐
  for (const [x0, y0, x1, y1] of [[13, 9, 11, 22], [19, 6, 18, 20], [25, 5, 25, 19], [31, 6, 32, 21], [37, 8, 39, 22], [42, 12, 43, 24]]) {
    c.poly([x0 - 1, y0, x0 + 1, y0, x1, y1], "C"); c.line(x0, y0, x1, y1, "B")
  }
  // 윤기 띠: 머리 곡선을 따라 휘고, 가닥 틈에서 끊김
  for (let x = 9; x <= 44; x++) {
    const y = Math.round(9 + ((x - 27) / 18) ** 2 * 6)
    if ([13, 19, 25, 31, 37, 42].includes(x) || [12, 18, 24, 30, 36].includes(x)) continue
    c.px(x, y, "F"); if (x > 15 && x < 40) c.px(x, y + 1, "H")
  }
  // 정수리 삐침 머리 (한 가닥)
  c.line(27, 3, 30, 0, "D"); c.px(31, 0, "D"); c.px(28, 2, "F")
  // 옆머리: 얼굴을 감싸 턱까지
  c.poly([8, 22, 13, 24, 13, 42, 10, 48, 6, 40], "C"); c.line(10, 26, 10, 44, "B")
  c.poly([44, 22, 39, 24, 39, 42, 42, 48, 46, 40], "D"); c.line(42, 26, 42, 44, "C"); c.line(43, 28, 43, 36, "F")
  // 앞머리 아래 얇은 그늘 (이마 · 눈 위)
  for (let x = 11; x <= 41; x++) for (let y = 16; y < 34; y++) {
    if (c.is(x, y, "DCB") && c.is(x, y + 1, "s")) { c.px(x, y + 1, "S"); break }
  }
  // 속눈썹 끝 (바깥쪽으로 살짝)
  c.px(11, 27, "k"); c.px(40, 27, "k")
  // 머리핀: 길드 문장 (금 + 에메랄드)
  c.rect(38, 13, 5, 3, "y"); c.hline(38, 13, 5, "z"); c.px(40, 14, "t")
})

// ── 접수원: 몸 (88×70) — 퍼프 소매 · 조끼 · 자보 · 책 ──
sprite("_rbody", { w: 88, h: 70, outline: "k" }, (c) => {
  // 퍼프 소매 (주름 · 오른쪽 빛)
  c.ellipse(13, 30, 12, 17, "x"); c.ellipse(75, 30, 12, 17, "x")
  c.recolor({ x: "Q" }, (x, y) => x < 8 || (x > 64 && x < 70 && y > 34), 1)
  c.recolor({ x: "X" }, [79, 22, 4], 1)
  for (const [x0, y0, x1, y1] of [[6, 18, 9, 42], [14, 14, 15, 44], [72, 14, 71, 44], [80, 18, 78, 42]]) c.line(x0, y0, x1, y1, "Q")
  c.line(2, 40, 11, 36, "z"); c.line(77, 36, 86, 40, "z")
  // 몸통: 블라우스 → 조끼 (V로 열림, 금 테두리)
  c.poly([20, 10, 33, 2, 55, 2, 68, 10, 70, 70, 18, 70], "x")
  c.poly([20, 10, 32, 4, 39, 12, 43, 46, 42, 70, 18, 70, 16, 30], "v")
  c.poly([68, 10, 56, 4, 49, 12, 45, 46, 46, 70, 70, 70, 72, 30], "V")
  c.recolor({ v: "N" }, (x, y) => x < 25, 1)
  c.line(32, 4, 43, 46, "y"); c.line(56, 4, 45, 46, "z"); c.line(43, 46, 42, 70, "y"); c.line(45, 46, 46, 70, "z")
  c.px(51, 52, "z"); c.px(51, 60, "z"); c.px(37, 52, "y"); c.px(37, 60, "y")
  // 높은 깃 + 브로치 + 자보
  c.poly([34, 0, 54, 0, 56, 8, 32, 8], "N"); c.hline(33, 7, 23, "y")
  c.poly([37, 10, 51, 10, 53, 24, 47, 30, 44, 27, 41, 30, 35, 24], "J")
  for (const [x0, y0, x1, y1] of [[39, 12, 38, 24], [44, 12, 44, 26], [49, 12, 50, 24]]) c.line(x0, y0, x1, y1, "j")
  c.hline(36, 18, 16, "j")
  c.circ(44, 9, 3, "y"); c.circ(44, 9, 2, "G"); c.px(43, 8, "t"); c.px(44, 8, "W")
  // 허리띠
  c.rect(18, 58, 52, 5, "4"); c.hline(18, 58, 52, "5"); c.rect(41, 57, 7, 7, "y"); c.rect(43, 59, 3, 3, "4")
  // 책: 왼쪽 가슴에 안은 갈색 책 (금 문장) + 잡은 손
  c.poly([3, 18, 25, 14, 31, 47, 8, 51], "r")
  c.poly([3, 18, 6, 18, 11, 51, 8, 51], "R")
  c.line(25, 14, 31, 47, "J"); c.line(26, 15, 32, 46, "j")
  c.circ(17, 32, 4, "y"); c.ring(17, 32, 4, "Y"); c.line(17, 28, 17, 36, "z"); c.line(13, 32, 21, 32, "z"); c.px(17, 32, "Z")
  c.hline(6, 21, 18, "u")
  c.ellipse(27, 35, 5, 4, "s"); c.recolor({ s: "S" }, (x, y) => y > 36, 1)
  c.line(25, 32, 29, 32, "S"); c.line(23, 35, 28, 34, "S"); c.px(30, 33, "l")
  c.poly([22, 39, 30, 37, 33, 46, 25, 48], "x"); c.line(23, 43, 32, 41, "Q"); c.line(24, 47, 33, 45, "z")
})

// ── 배경 소품 ──
sprite("_note", { outline: "o" }, `
  PPPPPPP
  PoooooP
  PPPPPPP
  PooooPP
  PPPPPPP
  PoooPPP
  PPPPPPP`)
sprite("_banner", { w: 16, h: 40, outline: "k" }, (c) => {
  c.rect(0, 0, 16, 2, "y"); c.hline(0, 0, 16, "z")
  c.poly([1, 2, 15, 2, 15, 30, 8, 38, 1, 30], "v")
  c.poly([3, 2, 13, 2, 13, 29, 8, 35, 3, 29], "V")
  c.recolor({ V: "v" }, (x, y) => x < 5, 1)
  c.line(3, 29, 8, 34, "y"); c.line(13, 29, 8, 34, "y")
  // 문장: 금 별 + 방패 테두리
  c.ring(8, 14, 4, "y"); c.vline(8, 9, 11, "z"); c.hline(3, 14, 11, "z"); c.px(8, 14, "Z")
  c.px(6, 12, "z"); c.px(10, 12, "z"); c.px(6, 16, "z"); c.px(10, 16, "z")
})
sprite("_lamp", { outline: "k" }, `
  ...yy...
  ..yzzy..
  .yyyyyy.
  yZaaaaZy
  yaTTTTay
  yaTTTTay
  yaTTTTay
  yyyyyyyy
  .YYYYYY.
  ...YY...`)
sprite("_bell", { outline: "k" }, `
  ...z...
  ..yzy..
  .yyzzy.
  .yyyzy.
  yyyyyzy
  YYYYYYY`)
sprite("_ink", { outline: "k" }, `
  .III.
  IOOOI
  IiiiI
  IiiiI
  .III.`)
sprite("_scroll", { outline: "k" }, `
  oPPPPPPPPPPo
  oPPPPPPPPPPo
  .oooooooooo.`)

scene("illust_guild_receptionist", { w: 192, h: 128, bg: "#1a1420" },
  // 뒷벽: 돌 + 나무 기둥
  rect(0, 0, 192, 106, "I"),
  (c) => { for (let y = 4; y < 106; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < 192; x += 12) c.box(x, y, 12, 8, "i") },
  noise(0, 0, 192, 106, "O", 0.04, 5, "I"),
  // 오른쪽 아치 창 (따뜻한 빛)
  rect(150, 34, 26, 56, "T"), ellipse(163, 34, 13, 12, "T"), grad(150, 22, 26, 68, "aTT", "v", 0.6),
  vline(163, 22, 68, "4"), hline(150, 56, 26, "4"), rect(148, 88, 30, 3, "5"),
  layer("winglow", { light: LIT, density: 0.4 }, ellipse(163, 60, 30, 40, "k")),
  // 왼쪽: 의뢰 게시판
  rect(4, 22, 64, 66, "3"), box(4, 22, 64, 66, "1"), box(5, 23, 62, 64, "5"),
  noise(6, 24, 60, 62, "4", 0.08, 2, "3"),
  stamp("_note", 9, 28), stamp("_note", 21, 27), stamp("_note", 34, 30), stamp("_note", 47, 27), stamp("_note", 56, 34),
  stamp("_note", 11, 44), stamp("_note", 24, 46), stamp("_note", 38, 45), stamp("_note", 52, 50),
  stamp("_note", 9, 62), stamp("_note", 23, 64), stamp("_note", 40, 63),
  (c) => { for (const [x, y] of [[13, 28], [25, 27], [38, 30], [51, 27], [60, 34], [15, 44], [28, 46], [42, 45], [56, 50], [13, 62], [27, 64], [44, 63]]) c.px(x, y, "r") },
  // 깃발 둘
  stamp("_banner", 70, 0), stamp("_banner", 134, 0),
  // 걸린 등불
  vline(184, 0, 6, "0"), stamp("_lamp", 179, 6),
  layer("lamp", { light: LIT, density: 0.5 }, circ(183, 14, 22, "k")),
  // 오른쪽 책장
  rect(178, 30, 14, 76, "2"), (c) => { for (const y of [48, 68, 88]) { c.rect(178, y, 14, 2, "5"); for (let x = 179; x < 192; x += 3) c.rect(x, y - 10, 2, 10, ["r", "v", "u", "o", "R"][(x + y) % 5]) } },

  // 접수원 (몸 → 머리)
  stamp("_rbody", 56, 60),
  stamp("_rhead", 74, 10),
  // 머리카락 바깥 테두리는 검정 대신 짙은 적갈색 (부드러운 윤곽)
  (c) => {
    const hair = "ABCDFH", out = []
    for (let y = 8; y < 68; y++) for (let x = 72; x < 128; x++) {
      if (!c.is(x, y, "k")) continue
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      if (n.some(([dx, dy]) => c.is(x + dx, y + dy, hair)) && n.every(([dx, dy]) => !c.is(x + dx, y + dy, "sSlLKwWEeg"))) out.push([x, y])
    }
    for (const [x, y] of out) c.px(x, y, "A")
  },

  // 카운터
  rect(0, 104, 192, 4, "5"), hline(0, 104, 192, "7"), hline(0, 105, 192, "6"), hline(0, 108, 192, "1"),
  rect(0, 109, 192, 19, "3"), hline(0, 109, 192, "2"),
  (c) => { for (let x = 6; x < 192; x += 30) { c.box(x, 112, 24, 13, "2"); c.hline(x + 1, 113, 22, "4") } },
  // 카운터 위 손 (오른손)
  ellipse(133, 103, 6, 3, "s"), hline(129, 104, 9, "S"), px(137, 102, "l"),
  // 잉크병 · 깃펜 · 종 · 두루마리
  stamp("_ink", 14, 97), line(18, 98, 26, 80, "P", 2), line(19, 97, 27, 79, "X"),
  stamp("_bell", 34, 97),
  stamp("_scroll", 160, 98), stamp("_scroll", 164, 94),

  // 가장자리 어둡게
  layer("vig", { shade: { I: "i", O: "I", 3: "2", 5: "4", T: "a" }, density: 0.5 }, rect(0, 0, 192, 4, "k"), rect(0, 0, 3, 128, "k"), rect(189, 0, 3, 128, "k")),
)
