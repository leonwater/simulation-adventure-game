// 모험가 키우기 UI 바탕 (v3.6, claude-pxl): 의뢰 게시판 나무 · 의뢰서 종이(등급별 테두리, 압정은 CSS)
// 빌드: bash scripts/sprites.sh → src/assets/ui/
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

pal({ w: "#efe0b8", v: "#d8c290" })  // 양피지
sprite("wood", {}, `
  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  ddddddddddddDdddddddddddddddddEd
  ddDddddddddddddddddddEdddddddddd
  dddddddddEdddddddddddddddddddddd
  ddddddddddddddddddDddddddddddddd
  EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  ddddddddddddddddddddddddDddddddd
  dddddEdddddddddddddddddddddddddd
  dddddddddddddDdddddddddddddddddd
  ddddddddddddddddddddEddddddddddd
  EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  ddddddddddEddddddddddddddddddddd
  dddDdddddddddddddddddddddDdddddd
  EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE`)
pal({ x: "#46433f" })
sprite("paper_iron", {}, `
  ..xxxxxxxxxxxxxxxxxxxxxx..
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvvwwwwwwwwwwwwwwwwwwwwvvx
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  ..xxxxxxxxxxxxxxxxxxxxxx..`)
pal({ x: "#7a3220" })
sprite("paper_bronze", {}, `
  ..xxxxxxxxxxxxxxxxxxxxxx..
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvvwwwwwwwwwwwwwwwwwwwwvvx
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  ..xxxxxxxxxxxxxxxxxxxxxx..`)
pal({ x: "#8f98ab" })
sprite("paper_silver", {}, `
  ..xxxxxxxxxxxxxxxxxxxxxx..
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvvwwwwwwwwwwwwwwwwwwwwvvx
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  ..xxxxxxxxxxxxxxxxxxxxxx..`)
pal({ x: "#c8963a" })
sprite("paper_gold", {}, `
  ..xxxxxxxxxxxxxxxxxxxxxx..
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xwwwwwwwwwwwwwwwwwwwwwwwwx
  xvwwwwwwwwwwwwwwwwwwwwwwvx
  xvvwwwwwwwwwwwwwwwwwwwwvvx
  .xvvvvvvvvvvvvvvvvvvvvvvx.
  ..xxxxxxxxxxxxxxxxxxxxxx..`)
