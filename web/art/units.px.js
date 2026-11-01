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
  p: "#b07ee0", P: "#7048a8", o: "#3e2860",           // 보라 (마법·주술)
  a: "#8fd4ff", A: "#3f80c0", O: "#23446e",           // 파랑
  i: "#b4b0a8", I: "#7a766f", j: "#46433f",           // 회색 (털·돌)
  v: "#62a868", V: "#336e40",                         // 숲 초록 (천·오크 피부)
  q: "#c08a5c", T: "#7e5434",                         // 갈색 털
  N: "#433d5e", Z: "#28233c",                         // 검은 가죽
  H: "#ffa040",                                       // 불꽃
  J: "#9aab84", L: "#62704e",                         // 트롤 피부
  1: "#a9bfa0", 2: "#6e8466",                         // 좀비 피부
  W: "#9a88b8", 3: "#5e4c80",                         // 다크 엘프 피부
  4: "#8a94a6", 5: "#555f72",                         // 가고일 돌
  U: "#6cc0a8", X: "#2f7466",                         // 도마뱀 비늘
})
ramps("kQRr", "kunSs", "knMmw", "kYy", "kEDd", "ktGgl", "kFfeh", "kCcBb", "koPp", "kOAa", "kjIi", "kVv", "kTq", "kZN", "kLJ", "k21", "k3W", "k54", "kXU")

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

// ─────────────────────────── 직업 ───────────────────────────

// 궁수: 초록 두건·가죽 조끼 + 왼쪽 활
sprite("_archer", { mx: true }, `
  .......VVV
  ......Vvvv
  .....Vvvvv
  .....Vvvvv
  .....VVsss
  .....VSkss
  .....VSsss
  ......Suss
  .......Sss
  ....VVvvdd
  ...Vvvvddd
  ...vvvVddd
  ...ssVdDdd
  ...ss.dDdd
  ......YyyY
  ......dddd
  ......VVd.
  ......VVd.
  ......VV..
  ......DD..
  .....DDD..`, shade([0, 17, 10, 4], 1, 0.5))
sprite("archer", { w: 24, h: 21, outline: "k" },
  stamp("_archer", 2, 0),
  grid(0, 3, `
  ..E.
  .E.m
  .E.m
  E..m
  E..m
  E..m
  Ey.m
  E..m
  E..m
  E..m
  .E.m
  .E.m
  ..E.`))

// 도적: 검은 두건·복면, 붉은 목도리 + 양손 단검
sprite("_rogue", { mx: true }, `
  .......ZZZ
  ......ZNNN
  .....ZNNNN
  .....ZNNNN
  .....ZZsss
  .....ZSkss
  .....ZZZZZ
  ......ZNNN
  .....rrrRr
  ....ZNNNNN
  ...ZNNNZNN
  ...NNNZNNN
  ...ssZNNNN
  ...ss.ZNNN
  ......YDDD
  ......ZNNN
  ......ZN..
  ......ZN..
  ......ZN..
  ......DD..
  .....DDD..`, shade([0, 17, 10, 4], 1, 0.5))
sprite("rogue", { w: 22, h: 21, outline: "k" },
  stamp("_rogue", 1, 0),
  grid(0, 9, `
  .w
  .m
  .m
  YM
  .D`),
  grid(20, 9, `
  w.
  m.
  m.
  MY
  D.`))

// 마법사: 별 달린 고깔모자·파란 로브 + 빛나는 지팡이
sprite("_mage", { mx: true }, `
  .........A
  ........AA
  .......Aaa
  ......AAay
  .....AAAAA
  ...OOAAAAA
  .....Osss.
  .....Sksss
  .....SSsss
  ......uSss
  ....AAAAay
  ...AaAAAAa
  ...AaAAAAa
  ...ssAAAAa
  ...ss.AAAa
  .....AAAAa
  .....AAAAa
  ....AAAAAa
  ....OOOOOO
  ......DD..`, shade([0, 15, 10, 5], 1, 0.5))
sprite("mage", { w: 24, h: 22, outline: "k" },
  stamp("_mage", 3, 2),
  grid(0, 0, `
  .a.
  aza
  .a.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.`),
  glow("az", { r: 3, strength: 0.5, where: [0, 0, 4, 4] }))

// ─────────────────────────── 몬스터 ───────────────────────────

// 고블린 궁수: 고블린 몸 + 초록 옷 + 활
sprite("goblin_archer", { w: 22, h: 19, outline: "k", swap: { D: "V", d: "v" } },
  stamp("_goblin", 1, 0),
  grid(0, 5, `
  ..E
  .E.
  E..
  E..
  E..
  E..
  .E.
  ..E`))

// 고블린 왕: 왕관·붉은 망토 + 홀
sprite("goblin_king", { w: 22, h: 22, outline: "k", swap: { D: "R", d: "r" } },
  stamp("_goblin", 1, 3),
  grid(7, 0, `
  y..y..y.
  yy.yy.yy
  yyyyyyyy
  YYYYYYYY`),
  grid(0, 8, `
  .y.
  yzy
  .y.
  .Y
  .Y
  .Y
  .Y
  .Y`),
  glow("z", { r: 2, strength: 0.5 }))

// 거대 박쥐: 펼친 날개
sprite("bat", { mx: true, outline: "k" }, `
  ........o..
  ........oo.
  P.......oPP
  PP.....oPPP
  PPP...oPPxP
  PPPP.oPPPPP
  PoPPPoPPPPw
  .PoPPPPPPPP
  ..P.oPPPPPP
  .....P.oPPP
  ........oP.`)

// 코볼트: 작은 개 머리 + 창
sprite("_kobold", { mx: true }, `
  ...T.....
  ...qT....
  ...qqTqqq
  ....qqqqq
  ....qzkqq
  ....qqqqq
  .....qiii
  ......ikk
  ......qqq
  ....DDddd
  ...qDdddd
  ...q.dddd
  .....DDdd
  .....qq.q
  .....qq.q
  ....TTT.T`)
sprite("kobold", { w: 20, h: 18, outline: "k" },
  stamp("_kobold", 1, 2),
  grid(0, 0, `
  .m
  mM
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E`))

// 거대 거미: 여덟 다리, 붉은 눈
sprite("spider", { mx: true, outline: "k" }, `
  ....j.......
  ...j....jjjj
  ..j....jIIII
  .j..jjjIIIII
  j..j..jIxIxI
  j.j..jjIIIII
  ..j.jjjjIjIj
  .j.j..jjjjjj
  j..j...jjjjj
  j.j.....jjjj
  ..j.........`)

// 늑대: 회색 털, 흰 주둥이
sprite("wolf", { mx: true, outline: "k" }, `
  ..I.......
  ..iI......
  ..iiIiiiii
  ...iiiiiii
  ...iizIiii
  ...iiiiiii
  ....iiiiww
  .....iiwkk
  ......wwww
  ....iiiiii
  ...iiiiwww
  ..iiiiiwww
  ..iiiiiiww
  ..ii.iiiii
  ..ii..iiii
  .III..IIII`, shade([0, 12, 10, 4], 1, 0.5))

// 오크: 넓은 어깨, 엄니 + 도끼
sprite("_orc", { mx: true }, `
  ......VVVV
  .....Vvvvv
  .....vvvvv
  .....vxvvv
  .....vvvvv
  .....Vvwkk
  ......VVVV
  ..DDDDdddd
  .vDdddDddd
  .vDdddDddd
  .vv.DdDddd
  .vv.YYYYYY
  ....dddddd
  ....DDD.DD
  ....VVV.VV
  ...VVVV.VV`)
sprite("orc", { w: 24, h: 18, outline: "k" },
  stamp("_orc", 2, 2),
  grid(0, 0, `
  mm..
  mMm.
  mm..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..`))

// 오크 주술사: 오크 몸 + 보라 로브 + 해골 지팡이
sprite("orc_shaman", { w: 24, h: 18, outline: "k", swap: { D: "P", d: "p", Y: "y" } },
  stamp("_orc", 2, 2),
  grid(0, 0, `
  .bb.
  bxxb
  .bb.
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..`),
  glow("x", { r: 2, strength: 0.5, where: [0, 0, 5, 4] }))

// 좀비: 창백한 피부, 해진 옷, 빨간 눈
sprite("_zombie", { mx: true }, `
  .......222
  ......2111
  .....21111
  .....2x1k1
  .....21111
  ......2kk1
  .......222
  ....OOAAAA
  ...1OAAOAA
  ...1OAAAAO
  ...11.AAAA
  ...2..OAAA
  ......OOAA
  ......22.2
  ......22..
  .....222..`)
sprite("zombie", { w: 22, h: 16, outline: "k" }, stamp("_zombie", 1, 0))

// 구울: 좀비 몸을 보라빛 피부로 + 긴 발톱
sprite("ghoul", { w: 22, h: 18, outline: "k", swap: { 1: "W", 2: "3", A: "N", O: "Z", x: "z" } },
  stamp("_zombie", 1, 0),
  grid(1, 11, `
  b..
  .b.
  b..`),
  grid(18, 11, `
  ..b
  .b.
  ..b`))

// 가고일: 돌 피부, 뿔, 날개
sprite("gargoyle", { mx: true, outline: "k" }, `
  ......5..
  5.....45.
  55....444
  455...444
  4455..4x4
  44455.444
  .4455.454
  ..445.444
  ...4.4444
  .....4444
  .....44.4
  ....555.5`)

// 리치: 해골 + 보라 로브 + 왕관 + 빛나는 구슬 지팡이
sprite("_lich", { mx: true }, `
  ......y.y.
  ......yyyy
  ......bbbb
  ......Bkzb
  ......bkkb
  ......Bbbb
  .......bkb
  ...ooPPPPP
  ..oPPpPPPP
  ..oPPpPPPP
  ..bb.PPpPP
  .....PPpPP
  ....oPPpPP
  ....oPPPPP
  ...ooPPPPP
  ...ooooooo`)
sprite("lich", { w: 24, h: 22, outline: "k" },
  stamp("_lich", 2, 2),
  grid(0, 0, `
  .a.
  apa
  .a.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.
  .E.`),
  glow("za", { r: 2, strength: 0.6 }))

// 리자드맨: 청록 비늘 + 창·방패
sprite("_lizardman", { mx: true }, `
  .......XXX
  ......XUUU
  ......UUzU
  .......UUU
  .......XUU
  ........yy
  ....XXUUUU
  ...XUUyUUU
  ...UU.yyUU
  ...UU.yyUU
  ......UUUU
  ......XX.X
  ......UU.U
  .....XXX.X`)
sprite("lizardman", { w: 22, h: 18, outline: "k" },
  stamp("_lizardman", 1, 2),
  grid(0, 0, `
  .m
  mM
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E
  .E`),
  grid(15, 8, `
  .DDDD.
  DdyydD
  DdyydD
  DddddD
  .DDDD.`))

// 와이번: 청록 날개를 펼친 비룡
sprite("wyvern", { mx: true, outline: "k" }, `
  X...........
  XX..........
  XUX.........
  XUUX......X.
  XUUUX....XU.
  .XUUUX..XUUU
  .XUUUUXXUUzU
  ..XUUUUXUUUU
  ...XUUUUXUUU
  ....XX.XUUyy
  .......XUyyy
  ........XUUU
  ........XX.U
  .........X..`)

// 골렘: 바위 몸, 가슴에 빛나는 문양
sprite("golem", { mx: true, outline: "k" }, `
  .......jjj
  ......jIII
  ......IIaI
  ......jIII
  ..jjjjIIII
  .jIIIIjIII
  .IIIIIIIIa
  .IIjjIIIaa
  .jII.IIIIa
  .jI..jIIII
  .....IIIjj
  .....IIi.j
  .....III.j
  ....jjjj.j`, glow("a", { r: 2, strength: 0.5 }))

// 트롤: 큰 덩치 + 나무 몽둥이
sprite("_troll", { mx: true }, `
  ......LLLL
  .....LJJJJ
  .....JJxJJ
  .....JJJJJ
  .....LJwJw
  ......LLLL
  ..LLJJJJJJ
  .LJJJJJJJJ
  .JJJLJJJJJ
  .JJ.LJDDDD
  .JJ..DddDd
  .LL..JJJ.J
  .....JJJ.J
  ....LLLL.L`)
sprite("troll", { w: 24, h: 17, outline: "k" },
  stamp("_troll", 2, 3),
  grid(0, 0, `
  .DD.
  DddD
  DddD
  .Dd.
  .D..
  .D..
  .D..
  .D..
  .D..
  .D..
  .D..`))

// 미노타우로스: 황소 머리·뿔·코뚜레 + 양날 도끼
sprite("_minotaur", { mx: true }, `
  bb........
  .bb.......
  ..bTTTTqqq
  ...Tqqqqqq
  ...Tqxqqqq
  ....qqqqqq
  .....qqiii
  .....qiiky
  ......iyyy
  ..TTqqqqqq
  .Tqqqqqqqq
  .qq.DDdddd
  .qq.YDDddd
  ....qqqqqq
  ....TTq.qq
  ....Tqq.qq
  ...jjjj.jj`)
sprite("minotaur", { w: 24, h: 19, outline: "k" },
  stamp("_minotaur", 2, 1),
  grid(0, 2, `
  mm.mm
  mMEMm
  mm.mm
  ..E..
  ..E..
  ..E..
  ..E..
  ..E..
  ..E..
  ..E..
  ..E..`))

// 다크 엘프: 보라빛 피부, 흰 머리, 검은 가죽 + 단검
sprite("_dark_elf", { mx: true }, `
  .......www
  ......wwww
  .....wwWWW
  ...3wwWWWW
  ....3wWzWW
  .....wWWWW
  .....w.WWW
  .....w.ZZZ
  ....ZZNNNN
  ...ZNNpNNN
  ...WWZNNpN
  ...WW.ZNNN
  ......YZZZ
  ......ZN..
  ......ZN..
  ......ZN..
  .....ZZZ..`)
sprite("dark_elf", { w: 22, h: 18, outline: "k" },
  stamp("_dark_elf", 1, 0),
  grid(0, 8, `
  .p
  .m
  .m
  YM
  .D`))

// 미믹: 이빨 달린 보물 상자
sprite("mimic", { mx: true, outline: "k" }, `
  ..DDDDDDDD
  .DddddddYd
  .DddddddYd
  DDDDDDDDYD
  Dwkwkwkwkw
  Dkkkkkkkkr
  Dkkkkrrrrr
  Dwkwkwkwkw
  DDDDDDDDYD
  DddddddyzY
  DddddddyYY
  DDDDDDDDYD
  .DDDDDDDDD`)

// 떠돌이 모험가: 갈색 두건 망토 + 지팡이
sprite("_wanderer", { mx: true }, `
  .......TTT
  ......Tqqq
  .....Tqqqq
  .....TTsss
  .....TSkss
  .....TSsss
  ......Ssss
  ....TTrrrr
  ...TqqqqqT
  ...qqqqqqT
  ...ss.qqqT
  ...ss.qqqT
  ......qqqT
  .....TqqqT
  .....TTTTT
  ......DD..
  .....DDD..`)
sprite("wanderer", { w: 22, h: 17, outline: "k" },
  stamp("_wanderer", 1, 0),
  grid(0, 0, `
  DD
  dD
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D
  .D`))

// 드래곤: 붉은 비늘, 뿔, 날개, 노란 배 (보스)
sprite("dragon", { mx: true, outline: "k" }, `
  Q...........
  QQ.......b..
  QRQ......bb.
  QRRQ.....RRR
  QRRRQ...RRRR
  QRRRRQ..RzRR
  .QRRRRQ.RRRR
  .QRRRRRQRRwk
  ..QRRRRRQRRR
  ...QRRRRRRyy
  ....QRRRRyyy
  .....QRRRyyy
  .....RRRRyyy
  .....RRRRRyy
  ....RRR.RRRR
  ...QQQQ.QQQQ`, glow("z", { r: 2, strength: 0.5 }))
