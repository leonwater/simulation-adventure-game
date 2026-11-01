// 모험가 키우기 물품 그림 (가방·상점 칸, 게임에선 2배)
// 빌드: bash scripts/sprites.sh  (claude-pxl → src/assets/items/)
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
})
ramps("kQRr", "kunSs", "knMmw", "kYy", "kEDd", "ktGgl", "kfe", "kcBb", "koPp", "kOAa", "kjIi", "kVv", "kTq", "kZN", "k21", "k54", "k76")

// ── 무기 (직업별) ──
sprite("weapon_warrior", { outline: "k" }, `
  .............w
  ............wm
  ...........wm.
  ..........wm..
  .........wm...
  ........wm....
  .......wm.....
  ..y...wm......
  ..yY.wm.......
  ...YYm........
  ....DY........
  ...D.yY.......
  ..D...........
  .D............`)
sprite("weapon_archer", { outline: "k" }, `
  ......EEm.....
  ....EE..m.....
  ...E....m.....
  ..E.....m.....
  ..E.....m.....
  .E......m.....
  .Ey.....m.....
  .Ey.....m.....
  .E......m.....
  ..E.....m.....
  ..E.....m.....
  ...E....m.....
  ....EE..m.....
  ......EEm.....`)
sprite("weapon_rogue", { outline: "k" }, `
  ..........w
  .........wm
  ........wm.
  .......wm..
  ......wm...
  .....wm....
  ..y.wM.....
  ..YYM......
  ...ZY......
  ..Z.yY.....
  .Z.........`)
sprite("weapon_mage", { outline: "k" }, `
  ...aza.
  ...aaa.
  ....E..
  ....E..
  ...E...
  ...E...
  ...E...
  ..E....
  ..E....
  ..E....
  .E.....
  .E.....`, glow("az", { r: 2, strength: 0.5 }))

// ── 방어구·장신구 ──
sprite("helmet", { outline: "k", mx: true }, `
  ....nnn
  ...nMmm
  ..nMmmw
  ..nMmmm
  ..nMnnn
  ..nMn.k
  ..nMmmm
  ...nnnn`)
sprite("armor", { outline: "k", mx: true }, `
  .nn...
  nMmn..
  nMmmmm
  .nMmmw
  .nMmmm
  .nMmmm
  .nMmmm
  ..nnnn`)
sprite("pants", { outline: "k", mx: true }, `
  .DDDDD
  .Ddddd
  .Dddd.
  .Dddd.
  .Dddd.
  .Dddd.
  .DDD..`)
sprite("boots", { outline: "k" }, `
  ..DDD....
  ..Ddd....
  ..Ddd....
  ..Ddd....
  ..Dddddd.
  ..Dddddd.
  ..EEEEEEE`)
sprite("necklace", { outline: "k", mx: true }, `
  y.....
  .y....
  ..y...
  ...y..
  ....yy
  ....rr
  ....rr`)
sprite("ring", { outline: "k" }, `
  ...rr...
  ..rRRr..
  ..yyyy..
  .y....y.
  .y....y.
  .y....y.
  ..yyyy..`)

// ── 물약·소모품 ──
sprite("potion", { outline: "k", mx: true }, `
  ...D
  ...m
  ...m
  ..mm
  .mrr
  mrrr
  mrrr
  .rrr`)
sprite("potion_hi", { outline: "k", mx: true }, `
  ...y
  ...m
  ..mm
  .mpp
  mppp
  mppp
  mppp
  .ppp`, glow("p", { r: 1, strength: 0.3 }))
sprite("antidote", { base: "potion", swap: { r: "g", D: "E" } })
sprite("bandage", { outline: "k" }, `
  ..bbbbbb..
  .bBbbbbbb.
  bBbbbbbbbb
  bBbbrrbbbb
  bBbbrrbbbb
  bBbbbbbbbb
  .bBbbbbbbb
  ..bbbbbb..`)
sprite("salve", { outline: "k", mx: true }, `
  .DDDD
  DDDDD
  mmmmm
  mHHHH
  mHHHH
  .mmmm`)

// ── 재료·스킬서·강화석 ──
sprite("material", { outline: "k", mx: true }, `
  ...dD
  ..dDy
  .dddd
  ddddd
  ddddd
  ddddd
  .dddd`)
sprite("skillbook", { outline: "k" }, `
  .AAAAAAA.
  AaaaaaaAb
  AaayyaaAb
  AayyyyaAb
  AaayyaaAb
  AaaaaaaAb
  AaaaaaaAb
  OOOOOOOOb`)
sprite("enhance_stone", { outline: "k", mx: true }, `
  ...aa
  ..aaA
  .aaAA
  aaaAA
  .AAAA
  ..AAO
  ...OO`, glow("a", { r: 1, strength: 0.3 }))
