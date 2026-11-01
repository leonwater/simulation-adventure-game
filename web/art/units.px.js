// 모험가 키우기 전투 유닛 (B안: 테두리 없이 무대에 바로, 게임에선 3배)
// 빌드: bash scripts/sprites.sh  (claude-pxl → public/sprites/)
pal({
  k: "#1a1420",
  s: "#f2c9a0", S: "#c98f6a", u: "#8e5a44",           // 피부 밝음→어두움
  w: "#f4f6fb", m: "#d3d8e2", M: "#8f98ab", n: "#59627a", // 강철
  r: "#e0565e", R: "#a83a48", Q: "#6e2236",           // 붉은 천
  y: "#f6d070", Y: "#c8963a",                         // 금
  d: "#a87650", D: "#6e4630", E: "#4a2e22",           // 가죽·나무
  l: "#c8f08a", g: "#7ccf5a", G: "#3f8f3f", t: "#245a3a", // 슬라임
  h: "#d6e88a", e: "#9bbf4a", f: "#5f8a2e", F: "#3b5a22", // 고블린 피부
  b: "#f3ecd8", B: "#c9bc9c", c: "#8a7d62", C: "#544b3c", // 뼈
  x: "#ff6a3c", z: "#ffe066",                         // 눈빛
})
ramps("kQRr", "kunSs", "knMmw", "kYy", "kEDd", "ktGgl", "kFfeh", "kCcBb")

// 대칭인 몸은 "_" 부품(왼쪽 절반 + mx)으로, 무기·방패처럼 비대칭인 것은 완성 그림에 덧그린다.
// 격자 줄은 모두 같은 길이로 (짧은 줄은 오른쪽이 채워져 대칭이 어긋난다)

// 전사: 투구·흉갑·붉은 휘장 + 왼쪽 검, 오른쪽 방패
sprite("_warrior", { mx: true }, `
  .......nMM
  ......nMmm
  .....nMmmw
  .....nMmmm
  .....nnnnn
  .....nSsss
  .....nSkss
  ......Ssss
  .......uSs
  ...MMMnmmm
  ..MmmmMmmR
  ..MmwmMmRr
  ..nMmmMmRr
  ..sSnMmmRr
  ..sS.nMmRr
  .....YyyyY
  .....nMmRr
  .....nMm.Q
  .....nMm..
  .....nMm..
  .....nnn..
  ....EDDD..`, shade([0, 18, 10, 4], 1, 0.5))
sprite("warrior", { w: 24, h: 22, outline: "k" },
  stamp("_warrior", 2, 0),
  grid(1, 0, `
  .w..
  .m..
  .m..
  .m..
  .m..
  .m..
  .m..
  .m..
  .m..
  .m..
  .m..
  ym..
  YyyY
  .Dy.
  .D..`),
  grid(15, 9, `
  .QRRRRQ.
  QRrrrrRQ
  QRrryrRQ
  QRryyyRQ
  QRrryrRQ
  .QRrrRQ.
  ..QRRQ..
  ...QQ...`))

// 슬라임: 왼쪽 위 하이라이트, 아래 그늘
sprite("slime", { mx: true, outline: "k" }, `
  ..........gg
  ........gggg
  .......ggggg
  ......gwlggg
  .....gwllggg
  ....gglggggg
  ...ggggggggg
  ..gggggkkggg
  .ggggggkwggg
  .ggggggkkggg
  gggggggggggg
  gggggggggggg
  Gggggggggggg
  .GGGGGGGGGGG
  ..tttttttttt`)

// 고블린: 큰 귀, 노란 눈, 누더기 옷 + 녹슨 단검
sprite("_goblin", { mx: true }, `
  e.........
  ee......ff
  .eef...ffe
  ..efffeeee
  ...feeeeee
  ....fezxee
  ....fezzee
  .....feeee
  .....fkkkf
  ......ffff
  ....DDdddd
  ...eDddddd
  ...eDdDddd
  ....YDDddd
  ....dddddd
  ....DDD.Dd
  ....ff..ff
  ....ff..ff
  ...fff..ff`, shade([0, 14, 10, 5], 1, 0.5))
sprite("goblin", { w: 22, h: 19, outline: "k" },
  stamp("_goblin", 1, 0),
  grid(1, 8, `
  ..n
  .nM
  .Mm
  nm.
  D..
  D..`))

// 스켈레톤: 해골·갈비뼈, 눈에 불빛 + 낡은 검
sprite("_skeleton", { mx: true }, `
  ......BBBB
  .....Bbbbb
  .....bbbbb
  .....bbbbb
  .....bCCkb
  .....bCzkb
  .....Bbbbb
  ......Bbkb
  .......bkb
  ........bb
  ....bBbCcb
  ...b.bCcCb
  ...b.BCcCb
  ...b.bCcCb
  ...B..BCcb
  ......Bbbb
  ......b..c
  ......b..c
  ......B..c
  .....bb..c
  ....bbb..c`, shade([0, 15, 10, 6], 1, 0.4))
sprite("skeleton", { w: 22, h: 21, outline: "k" },
  stamp("_skeleton", 1, 0),
  grid(1, 1, `
  ..n.
  ..M.
  ..M.
  ..M.
  ..M.
  ..M.
  ..M.
  ..M.
  ..M.
  .Dn.
  DDDD
  .D..`),
  glow("z", { r: 2, strength: 0.6 }))
