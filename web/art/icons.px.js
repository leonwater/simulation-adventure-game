// 모험가 키우기 UI 아이콘 (v3.6, claude-pxl). 물품·유닛 그림과 같은 색표·테두리.
// 빌드: bash scripts/sprites.sh → public/icons/ (16×16을 8배로)
// 흰 아이콘은 화면에서 CSS mask로 색을 입힌다. 색 아이콘은 테두리 k 자동.
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
  1: "#a9bfa0", 2: "#6e8466",                             // 좀비 피부
  3: "#e89aa8",                                           // 분홍 (쥐 귀·꼬리)
  4: "#9aa4b4", 5: "#5c6678",                             // 바위
  6: "#dff3ff", 7: "#a9cde6",                             // 유령
  X: "#c0602a", h: "#7a3220", U: "#4a1e14",               // 녹
  W: "#ffffff", L: "#fff1b0",                             // 하이라이트
  C: "#ff9ec0", F: "#5ad0a0", J: "#2a8a68",               // 분홍·독
})
ramps("kQRr", "kunSs", "knMmw", "kYy", "kEDd", "ktGgl", "kfe", "kcBb", "koPp", "kOAa", "kjIi", "kVv", "kTq", "kZN", "k21", "k54", "k76")

// 아이콘용 색 (물품 색표에서 몇 글자를 양피지·바위·청록으로 바꿔 씀)
pal({ v: "#c9bc9c", V: "#8a7d62", w: "#f1e8d6", t: "#5fd0c0", T: "#2a8a80", b: "#9aa4b4", B: "#5c6678", o: "#e0975e", O: "#a8602a", c: "#ff9ec0" })


// ── 상태 이상 17종: 테두리(이로움 파랑 · 해로움 빨강) + 상태 색 + 흰 기호 ──
pal({ f: "#e0975e", x: "#7ab8f0" })
sprite("status_empower", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWWffffx.
  xffffWWWWffffx
  xfffWWWWWWfffx
  xffWWWWWWWWffx
  xfffffWWfffffx
  xfffffWWfffffx
  xfffffWWfffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#5a7aa8", x: "#7ab8f0" })
sprite("status_fortify", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWWWWWWWWfx.
  xffWffffffWffx
  xffWfWWWWfWffx
  xffWfWWWWfWffx
  xffWfWWWWfWffx
  xfffWfWWfWfffx
  xffffWffWffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#4fae6a", x: "#7ab8f0" })
sprite("status_regen", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWWffffx.
  xfffffWWfffffx
  xfffffWWfffffx
  xffWWWWWWWWffx
  xffWWWWWWWWffx
  xfffffWWfffffx
  xfffffWWfffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#7a6ad0", x: "#7ab8f0" })
sprite("status_focus", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWWffffx.
  xfffWWffWWfffx
  xfffWffffWfffx
  xffWffWWffWffx
  xffWffWWffWffx
  xfffWffffWfffx
  xfffWWffWWfffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#3fa8a0", x: "#7ab8f0" })
sprite("status_swift", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWfffWffffx.
  xffWWffWWffffx
  xfffWWffWWfffx
  xffffWWffWWffx
  xffffWWffWWffx
  xfffWWffWWfffx
  xffWWffWWffffx
  .xfWfffWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#c8963a", x: "#7ab8f0" })
sprite("status_keen", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffffffffx.
  xffffWWWWffffx
  xfffWffffWfffx
  xffWffWWffWffx
  xffWffWWffWffx
  xfffWffffWfffx
  xffffWWWWffffx
  .xffffffffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#b8434b", x: "#7ab8f0" })
sprite("status_cruel", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWffWfffWfx.
  xfffWfWffWfffx
  xffffWWWWffffx
  xffWWWWWWWWffx
  xffffWWWWffffx
  xfffWfWfWffffx
  xffWffWffWfffx
  .xffffWfffWfx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#c87a3a", x: "#7ab8f0" })
sprite("status_riposte", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfffffffWWfx.
  xfffffffWWfffx
  xffffffWWffffx
  xffWffWWfffffx
  xfffWWWffffffx
  xffffWWffffffx
  xfffWffWfffffx
  .xfWffffffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#4f9a3a", x: "#f07060" })
sprite("status_poison", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWfffffx.
  xffffWWffWfffx
  xffffWWWfffffx
  xfffWWWWWffffx
  xfffWWWWWWfffx
  xffWWWWWWWfffx
  xfffWWWWWffffx
  .xfffWWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#c03a44", x: "#f07060" })
sprite("status_bleed", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWfffffx.
  xfffffWWfffffx
  xffffWWWfffffx
  xffffWWWWffffx
  xfffWWWWWWfffx
  xfffWWWWWWfffx
  xfffWWWWWWfffx
  .xfffWWWWfffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#e07030", x: "#f07060" })
sprite("status_burn", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWfffffx.
  xffffWWffWfffx
  xffffWWWfWfffx
  xfffWWWWWWfffx
  xfffWWWfWWfffx
  xffWWWfffWWffx
  xffWWWffWWWffx
  .xffWWWWWWffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#7a6a8a", x: "#f07060" })
sprite("status_weaken", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWWffffx.
  xfffffWWfffffx
  xfffffWWfffffx
  xfffffWWfffffx
  xffWWWWWWWWffx
  xfffWWWWWWfffx
  xffffWWWWffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#c05a48", x: "#f07060" })
sprite("status_vulnerable", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWWWWfWWWfx.
  xffWfffWffWffx
  xffWffWfffWffx
  xffWfffWffWffx
  xfffWfWffWfffx
  xfffWffWWffffx
  xffffWfWfffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#c8a030", x: "#f07060" })
sprite("status_stun", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffWffffWffx.
  xffWWWffWWWffx
  xfffWffffWfffx
  xffffffffffffx
  xfffffWffffffx
  xffffWWWfffffx
  xfffffWffffffx
  .xffffffffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#6a7488", x: "#f07060" })
sprite("status_silence", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffWWWWWWffx.
  xffWfffffWWffx
  xffWffffWfWffx
  xffWfffWffWffx
  xffWffWfffWffx
  xffWWWWWWWfffx
  xfffWWfffffffx
  .xffWfffffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#4a5060", x: "#f07060" })
sprite("status_blind", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWffffffffx.
  xfffWWWWWffffx
  xffWfWfffWfffx
  xffWffWfffWffx
  xffWfffWffWffx
  xfffWfffWffffx
  xffffWWWWWfffx
  .xffffffffWfx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#7a4aa8", x: "#f07060" })
sprite("status_fear", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfffWWWWfffx.
  xfffWWWWWWfffx
  xffWWfWWfWWffx
  xffWWfWWfWWffx
  xffWWWWWWWWffx
  xffWWWffWWWffx
  xffWWWWWWWWffx
  .xfWfWfWfWffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)

pal({ f: "#c8963a", x: "#7ab8f0" })
sprite("status_hawk", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWfffffx.
  xffffWWWfffffx
  xfffWWWWWffffx
  xffWWfWWfWfffx
  xfffffWWfffffx
  xfffffWWfffffx
  xffffWWWWffffx
  .xffWffffWffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#3fa8a0", x: "#7ab8f0" })
sprite("status_rapid", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffffWfffx.
  xffffffffWfffx
  xffWWWWWWWWffx
  xffffffffWfffx
  xfffffffWffffx
  xffffWfffffffx
  xfffWffffffffx
  .xfWWWWWWWWfx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#5a7aa8", x: "#7ab8f0" })
sprite("status_piercing", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xfWWfffffffx.
  xfffWWffWffffx
  xffffWWWWffffx
  xfffffWWfffffx
  xffffWWWWffffx
  xffffWffWWfffx
  xffffffffWWffx
  .xffffffffWfx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)
pal({ f: "#6a3a9a", x: "#f07060" })
sprite("status_overload", { outline: "k" }, `
  ....xxxxxx....
  ..xxffffffxx..
  .xffffffffffx.
  .xffffWWffffx.
  xffffWffWffffx
  xfffWfWWfWfffx
  xffWfWffWfWffx
  xffWfWffWfWffx
  xfffWfWWfWfffx
  xffffWffWffffx
  .xffffWWffffx.
  .xffffffffffx.
  ..xxffffffxx..
  ....xxxxxx....`)

// ── 모험가 등급 8종: 방패 + 글자 ──
pal({ f: "#8a8070", x: "#d3d8e2" })
sprite("rank_f", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xfffWWWWWffx
  xfffWffffffx
  xfffWffffffx
  xfffWWWWfffx
  xfffWffffffx
  .xffWfffffx.
  .xffWfffffx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#a8683a", x: "#d3d8e2" })
sprite("rank_e", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xfffWWWWWffx
  xfffWffffffx
  xfffWffffffx
  xfffWWWWfffx
  xfffWffffffx
  .xffWfffffx.
  .xffWWWWWfx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#4f9a5a", x: "#d3d8e2" })
sprite("rank_d", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xfffWWWWfffx
  xfffWfffWffx
  xfffWfffWffx
  xfffWfffWffx
  xfffWfffWffx
  .xffWfffWfx.
  .xffWWWWffx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#3fa8a8", x: "#d3d8e2" })
sprite("rank_c", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xffffWWWfffx
  xfffWfffWffx
  xfffWffffffx
  xfffWffffffx
  xfffWffffffx
  .xffWfffWfx.
  .xfffWWWffx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#4a7ac8", x: "#d3d8e2" })
sprite("rank_b", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xfffWWWWfffx
  xfffWfffWffx
  xfffWfffWffx
  xfffWWWWfffx
  xfffWfffWffx
  .xffWfffWfx.
  .xffWWWWffx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#8a5ad0", x: "#d3d8e2" })
sprite("rank_a", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xffffWWWfffx
  xfffWfffWffx
  xfffWfffWffx
  xfffWWWWWffx
  xfffWfffWffx
  .xffWfffWfx.
  .xffWfffWfx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#d8a830", x: "#fff1b0" })
sprite("rank_s", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xffffWWWfffx
  xfffWfffWffx
  xfffWffffffx
  xffffWWWfffx
  xfffffffWffx
  .xffWfffWfx.
  .xfffWWWffx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)
pal({ f: "#e05a4a", x: "#fff1b0" })
sprite("rank_ss", { outline: "k" }, `
  xxxxxxxxxxxx
  xffffffffffx
  xffffffffffx
  xffWWfffWWfx
  xfWffffWfffx
  xfWffffWfffx
  xffWffffWffx
  xfffWffffWfx
  .xffWffffWx.
  .xWWfffWWfx.
  ..xffffffx..
  ...xffffx...
  ....xxxx....`)

// ── 흰 아이콘 (메뉴·방·직업·조작) ──
sprite("enhance", {}, `
  ..W.......W...
  ...W.....W....
  ......W.......
  ..WWWWWW......
  .WWWWWWWW.....
  .WWWWWWWW.....
  ..WWWWWW......
  .....WW.......
  ......WW......
  .......WW.....
  ........WW....
  .........WW...
  ..........WW..`)
sprite("nav_town", {}, `
  .......WW.......
  ......WWWW......
  .....WWWWWW.....
  ....WWWWWWWW....
  ...WWWWWWWWWW...
  ..WWWWWWWWWWWW..
  .WWWWWWWWWWWWWW.
  ...WWWWWWWWWW...
  ...WWWWWWWWWW...
  ...WWW..WWWWW...
  ...WWW..WW..W...
  ...WWW..WW..W...
  ...WWW..WWWWW...
  ...WWW..WWWWW...
  ...WWWWWWWWWW...`)
sprite("nav_character", {}, `
  ......WWWW......
  .....WWWWWW.....
  .....WWWWWW.....
  .....WWWWWW.....
  ......WWWW......
  ................
  ....WWWWWWWW....
  ...WWWWWWWWWW...
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..`)
sprite("nav_bag", {}, `
  .....WWWWWW.....
  ....WW....WW....
  ....W......W....
  ..WWWWWWWWWWWW..
  .WWWWWWWWWWWWWW.
  .WWWWWWWWWWWWWW.
  .WWWWW....WWWWW.
  .WWWWW.WW.WWWWW.
  .WWWWW....WWWWW.
  .WWWWWWWWWWWWWW.
  .WWWWWWWWWWWWWW.
  .WWWWWWWWWWWWWW.
  ..WWWWWWWWWWWW..`)
sprite("nav_skill", {}, `
  ..WWWWWWWWWW....
  ..WWWWWWWWWWW...
  ..WW.WWWWWWWW...
  ..WW.WWWW.WWW...
  ..WW.WWW...WW...
  ..WW.WW.....W...
  ..WW.WWW...WW...
  ..WW.WWWW.WWW...
  ..WW.WWWWWWWW...
  ..WW.WWWWWWWW...
  ..WWWWWWWWWWW...
  ..W.........W...
  ..WWWWWWWWWWW...`)
sprite("character", {}, `
  ......WWWW......
  .....WWWWWW.....
  .....WWWWWW.....
  .....WWWWWW.....
  ......WWWW......
  ................
  ....WWWWWWWW....
  ...WWWWWWWWWW...
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..
  ..WWWWWWWWWWWW..`)
sprite("pause", {}, `
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..
  ..WWWW..WWWW..`)
sprite("plus", {}, `
  .....WWWW.....
  .....WWWW.....
  .....WWWW.....
  .....WWWW.....
  WWWWWWWWWWWWWW
  WWWWWWWWWWWWWW
  WWWWWWWWWWWWWW
  .....WWWW.....
  .....WWWW.....
  .....WWWW.....
  .....WWWW.....`)
sprite("job_warrior", {}, `
  .............WW
  ............WWW
  ...........WWW.
  ..........WWW..
  .........WWW...
  ........WWW....
  .......WWW.....
  ..W...WWW......
  ..WW.WWW.......
  ...WWWW........
  ....WWW........
  ...WW.WW.......
  ..WW...........
  .WW............`)
sprite("job_archer", {}, `
  ....WWW..W.....
  ...W.....W.....
  ..W......W.....
  .W.......W.....
  .W.......W.....
  W........W.....
  W.WWWWWWWWWWWW.
  W........W..WW.
  .W.......W.....
  .W.......W.....
  ..W......W.....
  ...W.....W.....
  ....WWW..W.....`)
sprite("job_rogue", {}, `
  WW..........WW
  WWW........WWW
  .WWW......WWW.
  ..WWW....WWW..
  ...WWW..WWW...
  ....WWWWWW....
  .....WWWW.....
  ....WWWWWW....
  ..WWWW..WWWW..
  .WW.W....W.WW.
  .W............`)
sprite("job_mage", {}, `
  .........WWW...
  ........WWWWW..
  ........WW.WW..
  ........WWWWW..
  .........WWW...
  .........WW....
  ........WW.....
  ........WW.....
  .......WW......
  .......WW......
  ......WW.......
  ......WW.......
  .....WW........
  .....W.........`)
sprite("room_battle", {}, `
  WW..........WW
  WWW........WWW
  .WWW......WWW.
  ..WWW....WWW..
  ...WWW..WWW...
  ....WWWWWW....
  .....WWWW.....
  ....WWWWWW....
  ...WWW..WWW...
  .WWWW....WWWW.
  WW..........WW`)
sprite("room_boss", {}, `
  ...WWWWWWWW...
  ..WWWWWWWWWW..
  .WWWWWWWWWWWW.
  .WW...WW...WW.
  .WW...WW...WW.
  .WWWWW..WWWWW.
  ..WWWWWWWWWW..
  ...WWWWWWWW...
  ...W.WW.WW.W..
  ...W.W..W..W..`)
sprite("room_event", {}, `
  ......WW......
  .....WWWW.....
  ....WWWWWW....
  ...WWW..WWW...
  ..WWWW..WWWW..
  .WWWWW..WWWWW.
  WWWWWW..WWWWWW
  .WWWWWWWWWWWW.
  ..WWWW..WWWW..
  ...WWW..WWW...
  ....WWWWWW....
  .....WWWW.....
  ......WW......`)
sprite("room_merchant", {}, `
  ....WWWWWW....
  .....WWWW.....
  ....WWWWWW....
  ...WWWWWWWW...
  ..WWWWWWWWWW..
  .WWWW.WW.WWWW.
  .WWWW.W..WWWW.
  .WWWWW.WWWWWW.
  .WWWWWW.WWWWW.
  .WWWW..WWWWWW.
  .WWWWW.WWWWWW.
  ..WWWWWWWWWW..`)
sprite("room_rest", {}, `
  ......W.......
  .....WW.......
  .....WWW..W...
  ....WWWW.WW...
  ....WWWWWWW...
  ...WWW.WWWW...
  ...WW...WWW...
  ....W...WW....
  ..............
  .WWWW....WWWW.
  ...WWWWWWWW...
  .WWWW....WWWW.`)
sprite("room_return", {}, `
  ....WWWWWW....
  ..WWW....WWW..
  .WW........WW.
  .W...WWWW...W.
  W...WW..WW...W
  W..WW....WW..W
  W..W..WW..W..W
  W..WW....WW..W
  W...WW..WW...W
  .W...WWWW...W.
  .WW........WW.
  ..WWW....WWW..
  ....WWWWWW....`)
sprite("room_start", {}, `
  .WWWWWWWWWW...
  .WWWWWWWWWWWW.
  .WWWWWWWWWWW..
  .WWWWWWWWW....
  .WWWWWWW......
  .W............
  .W............
  .W............
  .W............
  .W............
  .W............
  WWW...........`)
sprite("room_treasure", {}, `
  ...WWWWWWWW...
  ..WWWWWWWWWW..
  .WWWWWWWWWWWW.
  .WWWWWWWWWWWW.
  WWWWWWWWWWWWWW
  ..............
  WWWWWW..WWWWWW
  WWWWW....WWWWW
  WWWWWW..WWWWWW
  WWWWWWWWWWWWWW
  WWWWWWWWWWWWWW
  WWWWWWWWWWWWWW`)

// ── 색 아이콘 (시설·능력치·고유 능력치) ──
sprite("bag", { outline: "k" }, `
  ....DDDDDD....
  ...D......D...
  ...D......D...
  .DDdddddddddD.
  DdddddddddddD.
  DdLLyyyyyyddD.
  DddddyYyddddD.
  DddddyyydddDD.
  DdddddddddddD.
  DdddddddddddD.
  DDdddddddddDD.
  .DDDDDDDDDDD..`)
sprite("blacksmith", { outline: "k" }, `
  ...........bb.
  ..........bmmb
  .........bmmb.
  ........DbBb..
  .......DD.....
  ......DD......
  .nnnnnnnnnnn..
  nMmmmmmmmmmMn.
  .nMMmmmmmMMn..
  ...nMmmmMn....
  ...nMMMMMn....
  ..nMMMMMMMn...
  .nnnnnnnnnnn..`)
sprite("gold", { outline: "k" }, `
  ....YYYYYY....
  ..YYyyyyyyYY..
  .YyyLLLyyyyYY.
  .YyLyyyyyyyyY.
  YyyLyyYYyyyyYY
  YyyyyY..YyyyYY
  YyyyyY..YyyyYY
  YyyyyY..YyyyYY
  YyyyyyYYyyyyYY
  .YyyyyyyyyyYY.
  .YYyyyyyyyYYY.
  ..YYYYYYYYYY..
  ....YYYYYY....`, glow("L", { r: 1, strength: 0.3 }))
sprite("guild", { outline: "k" }, `
  .D............
  .DGGGGGGGGGG..
  .DGggggggggG..
  .DGgggyygggG..
  .DGggyyyyggG..
  .DGgggyygggG..
  .DGggggggggG..
  .DGGgggggGGG..
  .D.GGgggGG....
  .D...GGG......
  .D............
  .D............
  DDD...........`)
sprite("map", { outline: "k" }, `
  .vvvv...vvvvv.
  vwwwwvvvwwwwwv
  vwwRwwwwwwwwwv
  vwwwRwwwwwwwwv
  vwwwwRwwwrwwwv
  vwwwwwRRwrrwwv
  vwwwwwwwRrwwwv
  vwwwwwwwwwRwwv
  vwwwwwwwwwwRwv
  vwwwwwwwwwwwwv
  .vvvvvvvvvvvv.`)
sprite("quest", { outline: "k" }, `
  ..vvvvvvvvvv..
  .vwwwwwwwwwwv.
  .vwVVVVVVVwwv.
  .vwwwwwwwwwwv.
  .vwVVVVVVwwwv.
  .vwwwwwwwwwwv.
  .vwVVVVVVVwwv.
  .vwwwwwwwwwwv.
  .vwVVVVwwwwwv.
  .vwwwwwwwRRwv.
  .vwwwwwwRrRwv.
  .vvvvvvvvRvvv.`)
sprite("return", { outline: "k" }, `
  ......RR......
  .....RrrR.....
  ....RrrrrR....
  ...RrrrrrrR...
  ..RrrrrrrrrR..
  .RRRRRRRRRRRR.
  ..wwwwwwwwww..
  ..wDDwwwwwww..
  ..wDDwwwaaww..
  ..wDDwwwaaww..
  ..wDDwwwwwww..
  ..wDDwwwwwww..
  ..vvvvvvvvvv..`)
sprite("settings", { outline: "k" }, `
  .....YYYY.....
  ..Y..YyyY..Y..
  .YyYYyyyyYYyY.
  ..YyyyyyyyyY..
  ..YyyyYYyyyY..
  YYyyyY..YyyyYY
  YyyyyY..YyyyyY
  YYyyyY..YyyyYY
  ..YyyyYYyyyY..
  ..YyyyyyyyyY..
  .YyYYyyyyYYyY.
  ..Y..YyyY..Y..
  .....YYYY.....`)
sprite("shop", { outline: "k" }, `
  .....DDDD.....
  ......dd......
  .....DddD.....
  ....DddddD....
  ...DdddddddD..
  ..DddddddddD..
  .DddddyyddddD.
  .DdddyYddddDD.
  .DddddyyddddD.
  .DdddddYydddD.
  .DddddyyddddD.
  ..DddddddddD..
  ...DDDDDDDD...`)
sprite("training", { outline: "k" }, `
  m............m
  mm..........mm
  Mmm........mmM
  .Mmm......mmM.
  ..Mmm....mmM..
  ...Mmm..mmM...
  ....MmmmmM....
  .....MmmM.....
  ....DMmmMD....
  ...DDD..DDD...
  ..DD......DD..
  .yD........Dy.
  yy..........yy`)
sprite("stat_vitality", { outline: "k" }, `
  ..RRR...RRR...
  .RrrrR.RrrrR..
  RrWrrrRrrrrrR.
  RrWrrrrrrrrrR.
  RrrrrrrrrrrrR.
  .RrrrrrrrrrR..
  ..RrrrrrrrR...
  ...RrrrrrR....
  ....RrrrR.....
  .....RrR......
  ......R.......`)
sprite("stat_spirit", { outline: "k" }, `
  ......aa......
  .....aWWa.....
  ....aaWaaA....
  ...aaaaaaAA...
  aaaaaaaaaaAAAA
  .aaaaaaaaaAAA.
  ..aaaaaaaAAA..
  ...aaaaaAAA...
  ...aaaaAAAA...
  ..aaaA..AAAA..
  ..aAA....AAA..
  .AA........AA.`, glow("W", { r: 1, strength: 0.4 }))
sprite("stat_luck", { outline: "k" }, `
  ...gg....gg...
  ..gGgg..ggGg..
  ..gGGgggggGg..
  ...gGGggggg...
  .ggggGgGggggg.
  gGGGGggggGGGGg
  gggggGgGgggggg
  .gggggGgGgggg.
  ...ggg.Gggg...
  ..gGg..G.gGg..
  ..gg...G..gg..
  .......GG.....
  ........G.....`)
sprite("stat_strength", { outline: "k" }, `
  ..............
  .mm........mm.
  MmmM......MmmM
  MmmM......MmmM
  MmmMMMMMMMMmmM
  MmmmmmmmmmmmmM
  MmmMMMMMMMMmmM
  MmmM......MmmM
  MmmM......MmmM
  .MM........MM.`)
sprite("stat_agility", { outline: "k" }, `
  ........yyy...
  .......yyyY...
  ......yyyY....
  .....yyyY.....
  ....yyyY......
  ...yyyyyyyyy..
  ..yyyyyyyyY...
  .....yyyY.....
  ....yyyY......
  ...yyyY.......
  ..yyY.........
  ..yY..........`)
sprite("stat_intelligence", { outline: "k" }, `
  .PPPPPPPPPPP..
  PppppppppppPw.
  PpWppppppppPw.
  PppppyyppppPw.
  PpppyLyyyppPw.
  PppppyyppppPw.
  PppppppppppPw.
  PppppppppppPw.
  PppppppppppPw.
  PPPPPPPPPPPPw.
  .wwwwwwwwwwww.`)
sprite("perk_counter", { outline: "k" }, `
  ...........mm.
  ..........mmw.
  .AAAAAA..mmw..
  AaaaaaaA.mw...
  AaWaaaaAmw....
  AaaaaaaAw.....
  AaaayaaA......
  AaayyyaAM.....
  .AaayaAM.M....
  ..AaaAM...M...
  ...AAD.....y..
  ....D.......y.`)
sprite("perk_vital", { outline: "k" }, `
  ....rrrrrr....
  ..rrRRRRRRrr..
  .rRRrrrrrrRRr.
  .rRrrRRRRrrRr.
  rRrrRRrrRRrrRr
  rRrRRrWWrRRrRr
  rRrRrWmmWrRrRr
  rRrRRrWWrRRrRr
  rRrrRRrrRRrrRr
  .rRrrRRRRrrRr.
  .rRRrrrrrrRRr.
  ..rrRRRRRRrr..
  ....rrrrrr....`)
sprite("perk_pierce", { outline: "k" }, `
  .........yyy..
  ........yyY...
  .mmmm..yyY....
  mMmmMMyyY.....
  mMmmMyyY......
  mMmmyyMM......
  mMmyyMMM......
  mMyyMMMM......
  .yyMMMM.......
  yyYMMM........
  yY.MM.........
  Y.............`)
sprite("perk_amplify", { outline: "k" }, `
  ......pp......
  ......pp......
  ..p..pWWp..p..
  ...ppWWWWpp...
  ...pWWLLWWp...
  ppppWLLLLWpppp
  ppppWLLLLWpppp
  ...pWWLLWWp...
  ...ppWWWWpp...
  ..p..pWWp..p..
  ......pp......
  ......pp......`, glow("WL", { r: 2, strength: 0.5 }))
