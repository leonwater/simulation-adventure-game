// 모험가 키우기 전투 유닛 — 옆모습 (v3.4)
// 모두 오른쪽을 보게 그리고, 몬스터는 flip: "x" 로 뒤집어 플레이어와 마주 보게 한다.
// 참고: DawnLike 16x16 (DragonDePlatino, CC-BY-SA 3.0)의 실루엣·자세만 참고하고 그림은 새로 그렸다.
// 빌드: bash scripts/sprites.sh  (claude-pxl → src/assets/sprites/)
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

// ─────────────── 직업 (오른쪽을 본다) ───────────────

// 전사: 투구, 흉갑, 앞쪽 방패 + 뒤로 든 검
sprite("warrior", { outline: "k" }, `
  .w..................
  .m......nnnn........
  .m.....nMmmmn.......
  .m....nMmmmmwn......
  .m....nMmnnnnn......
  .m....nMmsskss......
  .m....nMmsssss......
  .m.....nMmSSu.......
  Yyy...MMmmmmRR......
  .D...MmmmmwRRr.RRRR.
  .D..sMmmmmmRrrRrrrrR
  ......nMmmmRrrRryyrR
  ......nMmmmRrrRryyrR
  ......YyyyyYrrRrrrrR
  ......nMmm.Mm..RrrR.
  ......nMm..Mm...RR..
  ......nMm...Mm......
  .....nnn....nnn.....`)

// 궁수: 초록 두건 + 앞으로 겨눈 활
sprite("archer", { outline: "k" }, `
  ......VVVV.........
  .....VvvvvV........
  ....VvvvvvvV.......
  ....VvvVsssv..E....
  ....VvVssksk..E....
  ....VvVsssss...E...
  .....VVSSsu....E...
  ......Vvvvd....E...
  .....vvvvddssmmE...
  .....vvvvdd....E...
  .....vvvvdd....E...
  ......YyyY.....E...
  ......dddd....E....
  ......dd.dd...E....
  ......VV..VV.......
  .....DDD..DDD......`)

// 도적: 검은 두건·복면, 붉은 목도리 + 앞으로 내민 단검
sprite("rogue", { outline: "k" }, `
  ......ZZZZ.......
  .....ZNNNNZ......
  ....ZNNNNNNZ.....
  ....ZNNZsssN.....
  ....ZNZsskss.....
  ....ZNZZZZZZ.....
  .....ZNNNNN......
  ....rrrRrrr......
  ...RrZNNNNssmmw..
  ....ZNNNNN.......
  ....ZNNZNN.......
  .....YDDDY.......
  .....ZNNNN.......
  .....ZN.ZN.......
  .....ZN..ZN......
  ....DDD..DDD.....`)

// 마법사: 고깔모자 + 앞에 든 빛나는 지팡이
sprite("mage", { outline: "k" }, `
  .......AA.........
  ......AAa.....aza.
  .....AAAay.....a..
  ....AAAAAA.....E..
  ..OOAAAAAAOO...E..
  ....OsssssO....E..
  ....OssksksE...E..
  .....SSsssu....E..
  .....AAAAAAssssE..
  ....AAaAAAA....E..
  ....AAaAAAA....E..
  ....AAaAAAA....E..
  ...AAAaAAAAA...E..
  ...AAAAAAAAA...E..
  ...OOOOOOOOO...E..
  .....DD..DD.......`, glow("az", { r: 3, strength: 0.5, where: [13, 0, 5, 4] }))

// ─────────────── 몬스터 (오른쪽으로 그리고 flip 으로 왼쪽을 보게) ───────────────

// 슬라임: 위가 둥근 반원, 눈은 앞쪽
sprite("_slime", { mx: true }, `
  ......ggg
  ....ggggg
  ...gggggg
  ..ggggggg
  .gggggggg
  .gggggggg
  ggggggggg
  ggggggggg
  ggggggggg
  GGGGGGGGG
  .tttttttt`)
sprite("slime", { w: 18, h: 11, outline: "k", flip: "x" },
  stamp("_slime", 0, 0),
  grid(4, 1, `
  ll
  lw`),
  grid(10, 4, `
  k..k
  w..w
  ....
  .kk.`))

// 고블린: 뒤로 뻗은 큰 귀, 앞으로 든 단검
sprite("_goblin", {}, `
  ee...........
  .eef.fffe....
  ..effeeeee...
  ...feeeexez..
  ...feeeeeeee.
  ....feeekkk..
  .....ffffe...
  ....DDdddd...
  ...eDdddddee.
  ...eDdDddd...
  ....YDDddd...
  ....dddddd...
  ....DD..DD...
  ....ff..ff...
  ...fff.fff...`)
sprite("goblin", { w: 17, h: 15, outline: "k", flip: "x" },
  stamp("_goblin", 0, 0),
  grid(13, 6, `
  .m
  mM
  m.`))

// 고블린 궁수: 초록 옷 + 활
sprite("goblin_archer", { w: 17, h: 15, outline: "k", flip: "x", swap: { D: "V", d: "v" } },
  stamp("_goblin", 0, 0),
  grid(13, 4, `
  E.
  .E
  .E
  .E
  .E
  E.`))

// 고블린 왕: 왕관 + 붉은 망토 + 홀
sprite("goblin_king", { w: 17, h: 18, outline: "k", flip: "x", swap: { D: "R", d: "r" } },
  stamp("_goblin", 0, 3),
  grid(4, 0, `
  y.y.y
  yyyyy
  YYYYY`),
  grid(13, 6, `
  yzy
  .Y.
  .Y.
  .Y.
  .Y.
  .Y.`),
  glow("z", { r: 2, strength: 0.5 }))

// 박쥐: 날개를 편 옆모습
sprite("bat", { outline: "k", flip: "x" }, `
  P..............
  PP...........P.
  PPP....oo...PP.
  PPPP..oPPo.PPP.
  .PPPPoPPPxPPPP.
  ..PPPPPPPPPPP..
  ...PoPPPPwPP...
  ....P.oPPP.....
  .......o.......`)

// 큰 쥐: 분홍 귀와 긴 꼬리
sprite("rat", { outline: "k", flip: "x" }, `
  ..........33..
  .........i3ii.
  ........iiiiki
  ...iiiiiiiiii3
  ..iiiiiiiiiI..
  .iIiiiiiiiI...
  3IIIIIIIII....
  3..I.I..I.I...
  .33...........`)

// 거대 거미: 둥근 배, 앞쪽 머리와 붉은 눈
sprite("spider", { outline: "k", flip: "x" }, `
  ....jjjj.......
  ..jjIIIIjj.....
  .jIIIjIIIIj....
  .jIIjIjIIIjjj..
  .jIIIjIIIjIIxj.
  ..jjjjjjjjIIIj.
  .j..j..j..jjj..
  j..j..j..j..j..
  j.j..j..j..j.j.`)

// 늑대: 회색 털, 앞으로 내민 주둥이
sprite("wolf", { outline: "k", flip: "x" }, `
  ...........I.I..
  ..........iiIi..
  .........iiiiz..
  ........iiiiiiww
  I......iiiiiwwk.
  iI.iiiiiiiiiww..
  .iiiiiiiiiiii...
  ..iiiiiiiiiwI...
  ..iiiIIIIiiw....
  ..ii.I...iI.....
  ..I..I...I.I....
  .II.II..II.II...`)

// 오크: 큰 몸, 엄니 + 도끼
sprite("_orc", {}, `
  ......VVVV.....
  .....Vvvvvv....
  .....vvvvxvv...
  .....vvvvvvv...
  .....Vvvvwkw...
  ......VVVVV....
  ...DDDDdddd....
  ..vDdddDdddvv..
  ..vDdddDddd....
  ...vYYYYYYY....
  ....ddddddd....
  ....DDD..DD....
  ....VVV..VV....
  ...VVVV.VVV....`)
sprite("orc", { w: 18, h: 14, outline: "k", flip: "x" },
  stamp("_orc", 0, 0),
  grid(13, 1, `
  .mm.
  mMMm
  .mm.
  .E..
  .E..
  .E..
  .E..
  .E..`))

// 오크 주술사: 보라 로브 + 해골 지팡이
sprite("orc_shaman", { w: 18, h: 14, outline: "k", flip: "x", swap: { D: "P", d: "p", Y: "y" } },
  stamp("_orc", 0, 0),
  grid(13, 0, `
  .bb.
  bxxb
  .bb.
  .E..
  .E..
  .E..
  .E..
  .E..
  .E..`),
  glow("x", { r: 2, strength: 0.5, where: [12, 0, 6, 4] }))

// 스켈레톤: 해골 옆모습 + 앞으로 든 녹슨 검
sprite("skeleton", { outline: "k", flip: "x" }, `
  .....BBBB......
  ....Bbbbbb.....
  ....bbbbkzb....
  ....bbbbkkb....
  .....Bbbbbk....
  ......bkbk.....
  .......bb......
  .....Bbcbb.....
  ....b.bcbBbbM..
  ......Bcb...M..
  ......bcb...M..
  ......Bbb..Dn..
  ......b..b.....
  ......b..b.....
  .....bb.bb.....`, glow("z", { r: 2, strength: 0.5 }))

// 좀비: 앞으로 뻗은 두 팔, 해진 옷
sprite("_zombie", {}, `
  .....2222......
  ....211111.....
  ....2111x1.....
  ....211111.....
  .....21kk1.....
  ......222......
  .....OAAAA.....
  ....OAAAA11111.
  ....OAOAA11111.
  ....OAAAA......
  .....OAAA......
  .....OO.A......
  .....22.2......
  .....22..2.....
  ....222.22.....`)
sprite("zombie", { w: 15, h: 15, outline: "k", flip: "x" }, stamp("_zombie", 0, 0))

// 구울: 보라빛 피부, 웅크린 자세 + 긴 발톱
sprite("ghoul", { w: 16, h: 15, outline: "k", flip: "x", swap: { 1: "p", 2: "P", A: "N", O: "Z", x: "z" } },
  stamp("_zombie", 0, 0),
  grid(14, 6, `
  b.
  .b
  b.
  .b`))

// 유령: 둥근 머리, 물결치는 아랫단
sprite("_ghost", { mx: true }, `
  .....666
  ...66666
  ..666666
  .6666666
  .6666666
  66666666
  66666666
  76666666
  76666666
  77666666
  77766666
  7.776.66`)
sprite("ghost", { w: 16, h: 12, outline: "k", flip: "x" },
  stamp("_ghost", 0, 0),
  grid(9, 3, `
  k..k
  k..k
  ....
  .kk.`),
  grid(14, 6, `
  66
  6.`))

// 저승사자 (11~20층 보스): 검은 두건 로브, 빛나는 눈, 큰 낫
sprite("reaper", { outline: "k", flip: "x" }, `
  ...........MMMMMM...
  ..........M......M..
  .....ZZZZ.........M.
  ....ZNNNNZ......E..M
  ...ZNNNNNNZ.....E...
  ...ZNNZZZZZ.....E...
  ...ZNZZxZxZ.....E...
  ...ZNZZZZZZ.....E...
  ...ZNNZZZZ......E...
  ..ZNNNNNNNNbbbbbE...
  ..ZNNNNNNNN.....E...
  ..ZNNNNNNNN.....E...
  ..ZNNNNNNNNN....E...
  .ZNNNNNNNNNN....E...
  .ZNNNNNNNNNNN...E...
  ZNNNNNNNNNNNN...E...
  ZZNZNZNZNZNZZ.......`, glow("x", { r: 2, strength: 0.6 }))

// 독버섯: 흰 점 박힌 빨간 갓, 앞을 보는 얼굴
sprite("_mushroom", { mx: true }, `
  ....rrrr
  ..rrrrrr
  .rrwwrrr
  rrrwwrrr
  rrrrrrrr
  RRRRRRRR
  ....bbbb
  ....bbbb
  ....bbbb
  ....Bbbb
  ...BBbbb`)
sprite("mushroom", { w: 16, h: 11, outline: "k", flip: "x" },
  stamp("_mushroom", 0, 0),
  grid(11, 2, `
  ww
  ww`),
  grid(8, 7, `
  k.k
  ...
  .k.`))

// 독사: 똬리 틀고 고개를 든 옆모습
sprite("snake", { outline: "k", flip: "x" }, `
  ........vvvv.
  .......vvvvxv
  .......vvvvvvr
  ........yvv..r
  ........yvv...
  .......yvv....
  ......yvv.....
  ..vvvvyvv.....
  .vVVVVyyvvv...
  vVvvvvvvvVVv..
  vVyyyyyyyyVv..
  .VVVVVVVVVV...`)

// 바위 거북: 바위 등껍질 + 앞으로 내민 머리
sprite("turtle", { outline: "k", flip: "x" }, `
  ......5555.......
  ....55444455.....
  ...5444554445....
  ..544445444445...
  .54454444544445..
  .544544445444455.
  55555555555555vvv
  .vv..vv....vvvvkv
  .vv..vv....vv.vv.`)

// 도깨비불: 흔들리는 불꽃 몸, 앞쪽 얼굴
sprite("_wisp", { mx: true }, `
  .......H
  ......HH
  .....HHx
  ....HHxx
  ...HHxyy
  ...Hxyyy
  ..HHxyzz
  ..Hxyyzz
  ..Hxyyzz
  ..HHxyyy
  ...HHxxy
  ....HHHx`)
sprite("wisp", { w: 16, h: 12, outline: "k", flip: "x" },
  stamp("_wisp", 0, 0),
  grid(9, 6, `
  k.k
  ...
  .k.`),
  glow("zy", { r: 2, strength: 0.4 }))

// 임프: 작은 붉은 악마, 뿔·날개·꼬리 + 삼지창
sprite("imp", { outline: "k", flip: "x" }, `
  .......b..b.m.m.m
  ......rrrrr.mmmmm
  .Q...rrrrzr...E..
  QQQ..rrrrrr...E..
  QQQQ..RkkR....E..
  .QQQRrrrrrrsssE..
  ..QQRrrrrr....E..
  ....RrrrrR....E..
  ....Rr..rR....E..
  R..RR...RR....E..
  .RR..............`)

// 떠다니는 눈알: 큰 흰자 + 앞을 보는 눈동자, 꼬리 촉수
sprite("_eye", { mx: true }, `
  .....bbb
  ...bbbbb
  ..bbbbbb
  .bbbbbbb
  .bbbbbbb
  bbbbbbbb
  bbbbbbbb
  Bbbbbbbb
  .Bbbbbbb
  .BBbbbbb
  ..BBBbbb
  ....BBBB`)
sprite("eye", { w: 16, h: 15, outline: "k", flip: "x" },
  stamp("_eye", 0, 0),
  grid(9, 3, `
  .AAA.
  AAkkA
  AkkkA
  AAkAA
  .AAA.`),
  grid(2, 3, `
  r..
  .r.
  ..r`),
  grid(4, 12, `
  .PP
  P..
  .P.`))

// 고대 골렘 (30층 최종 보스): 바위 거인, 이끼, 빛나는 핵
sprite("ancient_golem", { outline: "k", flip: "x" }, `
  .......jjjjjj.........
  ......jIiiiiIj........
  ......jiiiiiaj........
  ......jIiiiiij........
  ...jjjjjIIIIjjjjj.....
  ..jIiiiiiiiiiiiiIj....
  .jIiivviiiiiiiiiiIj...
  .jiiiiiiiaaiiiiiiij...
  .jiiiiiiaaaaiiiiiijIj.
  .jIiiiiiiaaiiiiiiijiij
  ..jIjiiiiiiiiiiijjiiij
  ..jij.jIiiiiiIj..jiij.
  ..jj..jiiiiiiij..jjj..
  ......jiij.jiij.......
  ......jiij.jiij.......
  .....jIiij.jiiIj......
  .....jjjjj.jjjjj......`, glow("a", { r: 3, strength: 0.5 }))

// 미믹: 입을 벌린 보물 상자 (옆모습)
sprite("mimic", { outline: "k", flip: "x" }, `
  .DDDDDDDDDD....
  DddddddddddD...
  DddddYddddddD..
  DDDDDDDDDDDDD..
  .wkwkwkwkwkwr..
  .....rrrrrrrrr.
  .wkwkwkwkwkwr..
  DDDDDDDDDDDDD..
  DdddddYdddddD..
  DdddddyddddD...
  DDDDDDDDDDDD...`)

// 떠돌이 모험가: 갈색 두건 망토 + 지팡이
sprite("wanderer", { outline: "k", flip: "x" }, `
  ......TTTT......D.
  .....TqqqqT....dD.
  ....TqqqTsss....D.
  ....TqqTsksk....D.
  ....TqqTssss....D.
  .....TTTSSu.....D.
  ....rrrrrrr.....D.
  ....TqqqqqqssssDD.
  ...TqqqqqqqT....D.
  ...TqqqqqqqT....D.
  ...TqqqqqqqT....D.
  ...TTTTTTTTT....D.
  .....DD..DD.......
  ....DDD..DDD......`)
