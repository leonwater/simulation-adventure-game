// 모험가 키우기 마을(게임 메인) 화면 배경 (v3.11, claude-pxl)
// 가로 320×180 (예전 200×112보다 픽셀이 작게 보인다). 하늘·먼 성 → 뒷줄 집 → 앞줄 집 다섯 채 → 광장(우물·나무·가로등·주민).
// 입체감: 빛은 왼쪽 위에서. 앞면은 밝게, 오른쪽 옆면·지붕 옆판은 어둡게, 처마 밑 그림자, 창턱 그림자, 건물 발밑 그림자.
// 참고 그림(사용자가 보낸 상용 게임 그림)의 '입체를 내는 기법'만 따르고 건물·사람은 새로 그렸다 (글자·간판 문구 없음).
// 마을 화면은 칸 높이에 따라 위아래가 잘리므로(cover) 지붕~문·사람은 가운데 띠(y 40~140)에 둔다.
// 빌드: bash scripts/sprites.sh (→ public/illustrations/town.webp)
pal({ k: "#241a1c" })

// ── 색 ──
const C = {
  sky: ["#86bff0", "#a2d0f4", "#c0e0f8", "#dcefff"],
  cloud: "#ffffff", cloudS: "#dbe8f6", cloudD: "#b7cbe2",
  far: "#9fb4cc", farD: "#8aa0ba", farL: "#b8cadc", hill: "#8fbf86", hillD: "#79a874",
  ground: "#cdbfa6", groundD: "#b5a68c", groundL: "#ddd2bc", groundS: "#a4957c",
  shadow: "#00000040",
  wood: "#6a4128", woodD: "#4a2c1a", woodL: "#8e5c38",
  glass: "#5a86b8", glassD: "#3e6290", glassL: "#cfe6ff", lit: "#ffd27a", litD: "#e8a54a",
  leaf: ["#3f8a4a", "#5aae5a", "#86d06c", "#2e6a3c"],
}
// 건물마다 [앞벽, 옆벽(어두움), 벽 밝은 끝, 지붕, 지붕 옆판(어두움), 지붕 밝은 줄, 장식 나무]
const H = {
  red: { wall: "#f1e3cc", side: "#cdb99c", wallL: "#fff4e0", roof: "#c8503e", roofD: "#93352c", roofL: "#e2785c", trim: "#6a4128" },
  tavern: { wall: "#b98a5a", side: "#8e6440", wallL: "#d2a274", roof: "#7a5a8e", roofD: "#55406a", roofL: "#9a7cae", trim: "#4a2c1a" },
  blue: { wall: "#a9c8e2", side: "#7f9fbe", wallL: "#cfe2f2", roof: "#3e6a9a", roofD: "#2c4c72", roofL: "#5a8cc0", trim: "#f4f1ea" },
  brick: { wall: "#b65a44", side: "#8a3e30", wallL: "#d07a5e", roof: "#3f7a5a", roofD: "#2c5a42", roofL: "#5c9c74", trim: "#e8dcc4" },
  stone: { wall: "#b8b2a6", side: "#8f897e", wallL: "#d4cfc4", roof: "#d08a3a", roofD: "#9c6224", roofL: "#eaa858", trim: "#5a4a3a" },
}
const R = Math.round
// 그림자: 이미 칠한 색을 어둡게 (반투명 색을 쓰면 장면에 구멍이 나므로 직접 어둡게 한다)
function dk(c, x, y, f = 0.8) {
  x = R(x); y = R(y)
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const v = c.get(x, y) >>> 0
  const hex = [24, 16, 8].map((sh) => Math.round(((v >>> sh) & 255) * f).toString(16).padStart(2, "0")).join("")
  c.px(x, y, "#" + hex)
}
const dkH = (c, x, y, len, f) => { for (let i = 0; i < len; i++) dk(c, x + i, y, f) }
const dkV = (c, x, y, len, f) => { for (let i = 0; i < len; i++) dk(c, x, y + i, f) }
function dkLine(c, x0, y0, x1, y1, f) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) dk(c, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, f) }
function dkEllipse(c, cx, cy, rx, ry, f = 0.82) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) dk(c, cx + x, cy + y, f) }

// 창: 테두리 · 유리(위 밝은 반사) · 창턱 + 그 아래 그림자. lit면 불 켜진 창
function win(c, x, y, w, h, o = {}) {
  const f = o.frame ?? "#f4f1ea"
  c.rect(x - 1, y - 1, w + 2, h + 2, f)
  c.rect(x, y, w, h, o.lit ? C.lit : C.glass)
  c.rect(x, y + R(h / 2), w, h - R(h / 2), o.lit ? C.litD : C.glassD)
  c.px(x, y, o.lit ? "#fff2c0" : C.glassL); if (w > 3) c.px(x + 1, y, o.lit ? "#fff2c0" : C.glassL)
  if (w >= 5) c.vline(x + R(w / 2) - (w % 2 ? 0 : 1), y, h, f)
  if (h >= 6) c.hline(x, y + R(h / 2) - 1, w, f)
  c.hline(x - 2, y + h + 1, w + 4, o.sill ?? C.woodL)
  dkH(c, x - 1, y + h + 2, w + 2, 0.82)
  if (o.shutter) { c.rect(x - 4, y - 1, 2, h + 2, o.shutter); c.rect(x + w + 2, y - 1, 2, h + 2, o.shutter) }
  if (o.flowers) for (let i = 0; i < w + 2; i += 2) c.px(x - 1 + i, y + h, o.flowers[(i / 2) % o.flowers.length])
}
// 문: 문틀 · 안쪽(어두움) · 문짝 · 손잡이 · 디딤돌
function door(c, x, g, w, h, col, o = {}) {
  c.rect(x - 1, g - h - 1, w + 2, h + 1, o.frame ?? C.woodD)
  c.rect(x, g - h, w, h, col)
  dkV(c, x, g - h, h, 0.7)
  for (let xx = x + 2; xx < x + w; xx += 3) dkV(c, xx, g - h + 1, h - 1, 0.85)
  if (o.arch) c.ellipse(x + w / 2 - 0.5, g - h, w / 2, 3, o.frame ?? C.woodD)
  c.px(x + w - 2, g - R(h / 2), "#f0c060")
  c.rect(x - 2, g, w + 4, 1, C.groundS)
}
// 앞줄 집: 앞벽 + 오른쪽 옆벽(뒤로 물러남) + 박공 지붕 앞면 + 지붕 옆판 + 처마 그림자 + 벽 무늬
function house(c, x, g, w, wh, rh, p, kind) {
  const d = 8, top = g - wh, ax = x + w / 2, ay = top - rh
  // 발밑 그림자 (오른쪽 뒤로)
  for (let yy = 0; yy < 3; yy++) dkH(c, x + w, g + 1 + yy, d + 8 - yy * 3, 0.85)
  dkH(c, x + 2, g + 1, w - 2, 0.88)
  // 옆벽 (뒤로 물러난 면)
  c.poly([x + w, g, x + w + d, g - d / 2, x + w + d, top - d / 2, x + w, top], p.side)
  // 앞벽
  c.rect(x, top, w, wh, p.wall)
  c.vline(x, top, wh, p.wallL)
  // 벽 무늬
  if (kind === "plank") for (let y = top + 3; y < g; y += 3) { c.hline(x + 1, y, w - 1, p.side); }
  if (kind === "plank") for (let y = top + 3; y < g; y += 3) dkLine(c, x + w, y, x + w + d, y - d / 2, 0.88)
  if (kind === "brick") for (let y = top + 2, n = 0; y < g; y += 3, n++) {
    c.hline(x + 1, y, w - 1, p.side)
    for (let xx = x + 1 + (n % 2) * 3; xx < x + w; xx += 6) c.vline(xx, y - 2, 2, p.side)
  }
  if (kind === "stone") for (let y = top + 3, n = 0; y < g; y += 5, n++) {
    c.hline(x + 1, y, w - 1, p.side)
    for (let xx = x + 2 + (n % 2) * 4; xx < x + w; xx += 8) c.vline(xx, y - 4, 4, p.side)
    for (let xx = x + 3 + (n % 2) * 4; xx < x + w; xx += 8) c.px(xx, y - 4, p.wallL)
  }
  if (kind === "timber") {
    c.hline(x, top + R(wh * 0.45), w, p.trim); c.hline(x, g - 1, w, p.trim)
    for (let xx = x; xx <= x + w - 2; xx += R(w / 3)) c.rect(xx, top, 2, wh, p.trim)
    c.line(x + 2, top + R(wh * 0.45) - 1, x + R(w / 3) - 1, top + 1, p.trim)
  }
  // 지붕 옆판 (용마루에서 뒤쪽으로)
  c.poly([ax, ay, ax + d, ay - d / 2, x + w + 3 + d, top + 1 - d / 2, x + w + 3, top + 1], p.roofD)
  // 지붕 앞면 (박공) + 처마가 벽보다 3px 나온다
  c.poly([x - 3, top + 1, ax, ay, x + w + 3, top + 1], p.roof)
  // 기와 줄: 줄 위는 밝게, 아래는 어둡게 (지붕 안에서만)
  for (let y = ay + 4, n = 0; y <= top; y += 3, n++) for (let xx = x - 3; xx <= x + w + 3; xx++) {
    if (c.is(xx, y, "*") && c.get(xx, y) === c.get(R(ax), R((ay + top) / 2))) c.px(xx, y, p.roofD)
    if ((xx + n * 2) % 5 === 0 && c.get(xx, y - 1) === c.get(R(ax), R((ay + top) / 2))) c.px(xx, y - 1, p.roofL)
  }
  // 박공 나무 테두리 + 용마루
  c.line(x - 3, top + 1, ax, ay, p.trim); c.line(ax, ay, x + w + 3, top + 1, p.trim)
  c.line(ax, ay, ax + d, ay - d / 2, p.trim)
  // 처마 밑 그림자
  dkH(c, x, top + 2, w, 0.7); dkH(c, x, top + 3, w, 0.85)
  dkLine(c, x + w, top + 2, x + w + d, top + 2 - d / 2, 0.75)
}
// 굴뚝 (지붕 옆판 위에)
function chimney(c, x, y, h, col, colD) {
  c.rect(x, y, 5, h, col); c.rect(x + 3, y, 2, h, colD); c.rect(x - 1, y - 2, 7, 2, colD)
  c.circ(x + 3, y - 6, 2, "#eef2f6"); c.circ(x + 6, y - 11, 3, "#e2e8ee"); c.circ(x + 4, y - 17, 2, "#d6dee6")
}
// 마을 사람 (옆에서 본 작은 사람 7×12): 머리카락·얼굴·옷·바지·신발
function person(c, x, g, o) {
  const f = o.face ?? 1, top = g - (o.kid ? 9 : 12)
  const hx = x + (f > 0 ? 1 : 0)
  c.rect(x, top + 3, 5, o.kid ? 3 : 5, o.shirt)                 // 몸통
  dkV(c, x + (f > 0 ? 0 : 4), top + 3, o.kid ? 3 : 5, 0.75)
  if (o.dress) c.rect(x - 1, top + (o.kid ? 5 : 7), 7, o.kid ? 3 : 4, o.shirt)
  else { c.rect(x + 1, g - (o.kid ? 3 : 4), 1, o.kid ? 3 : 4, o.pants); c.rect(x + 3, g - (o.kid ? 3 : 4), 1, o.kid ? 3 : 4, o.pants) }
  c.px(x + 1, g - 1, "#3a2a22"); c.px(x + 3, g - 1, "#3a2a22")
  c.rect(hx, top, 4, 3, o.skin ?? "#f2c9a0")                   // 얼굴
  c.rect(hx, top - 1, 4, 1, o.hair); c.px(f > 0 ? hx : hx + 3, top, o.hair); c.px(f > 0 ? hx : hx + 3, top + 1, o.hair)
  c.px(f > 0 ? hx + 3 : hx, top + 1, "#3a2a22")                  // 눈
  if (o.hat) { c.rect(hx - 1, top - 2, 6, 1, o.hat); c.rect(hx, top - 3, 4, 1, o.hat) }
  if (o.carry) c.rect(f > 0 ? x + 5 : x - 3, top + 4, 3, 3, o.carry)
  dkH(c, x - 1, g, 7, 0.82)                                     // 발밑 그림자
}
function tree(c, x, g, r) {
  c.rect(x - 1, g - r - 6, 3, r + 6, C.wood); c.vline(x + 1, g - r - 6, r + 6, C.woodD)
  const cy = g - r * 2 - 2
  c.circ(x, cy + 2, r + 1, C.leaf[3]); c.circ(x - 1, cy, r, C.leaf[0]); c.circ(x - 2, cy - 1, r - 2, C.leaf[1]); c.circ(x - 3, cy - 3, R(r / 2), C.leaf[2])
  for (const [dx, dy] of [[-r + 2, 1], [r - 3, -2], [0, r - 2]]) c.px(x + dx, cy + dy, C.leaf[2])
  dkEllipse(c, x + 2, g, r, 2)
}
function lamp(c, x, g) {
  c.rect(x, g - 22, 2, 22, "#3a3a44"); c.hline(x - 1, g - 1, 4, "#3a3a44")
  c.rect(x - 2, g - 27, 6, 5, "#3a3a44"); c.rect(x - 1, g - 26, 4, 3, C.lit); c.px(x, g - 26, "#fff2c0")
  c.rect(x - 2, g - 28, 6, 1, "#55555f")
}
function cloud(c, x, y, s) {
  for (const [dx, dy, r] of [[0, 4, 4 * s], [6 * s, 1, 6 * s], [13 * s, 2, 5 * s], [19 * s, 5, 3.5 * s]]) c.circ(R(x + dx), R(y + dy), R(r), C.cloud)
  c.rect(R(x - 3 * s), R(y + 4), R(24 * s), R(4 * s), C.cloud)
  for (let xx = R(x - 4 * s); xx < x + 24 * s; xx++) for (let yy = y; yy < y + 12 * s; yy++) {
    if (!c.is(xx, yy, "*") || c.get(xx, yy) !== c.get(R(x + 6 * s), y + 1)) continue
    if (yy > y + 5 * s) c.px(xx, yy, C.cloudD); else if (yy > y + 3 * s) c.px(xx, yy, C.cloudS)
  }
}

scene("illust_town", { w: 320, h: 180, bg: C.sky[0] },
  // ── 하늘 ──
  (c) => { const s = C.sky; for (let y = 0; y < 84; y++) c.hline(0, y, 320, s[Math.min(3, Math.floor(y / 21))]); for (let y = 0; y < 84; y++) if (y % 21 > 17) for (let x = (y % 2); x < 320; x += 2) c.px(x, y, s[Math.min(3, Math.floor(y / 21) + 1)]) },
  (c) => { cloud(c, 18, 10, 1.2); cloud(c, 128, 4, 0.9); cloud(c, 214, 16, 1.4); cloud(c, 290, 6, 0.8) },
  (c) => { for (const [x, y] of [[96, 14], [104, 10], [190, 30]]) { c.px(x, y, "#5a6a80"); c.px(x + 1, y + 1, "#5a6a80"); c.px(x + 2, y, "#5a6a80") } },
  // ── 먼 언덕과 성 ──
  (c) => {
    c.ellipse(70, 92, 110, 26, C.hillD); c.ellipse(260, 96, 120, 30, C.hill); c.ellipse(60, 94, 90, 20, C.hill)
    // 성 (오른쪽 언덕 위)
    const bx = 236, by = 70
    c.rect(bx, by, 40, 18, C.far); c.rect(bx + 30, by, 10, 18, C.farD)
    for (let x = bx; x < bx + 40; x += 4) c.rect(x, by - 2, 2, 2, C.far)
    c.rect(bx + 6, by - 16, 8, 16, C.far); c.poly([bx + 5, by - 16, bx + 10, by - 26, bx + 15, by - 16], C.farD)
    c.rect(bx + 26, by - 10, 7, 10, C.far); c.poly([bx + 25, by - 10, bx + 29.5, by - 18, bx + 34, by - 10], C.farD)
    c.vline(bx + 10, by - 32, 6, "#5a6a80"); c.rect(bx + 11, by - 32, 4, 2, "#d9604c")
    for (const x of [bx + 9, bx + 18, bx + 28]) c.rect(x, by + 6, 2, 3, C.farD)
  },
  // ── 뒷줄 집 (멀어서 흐린 색) ──
  (c) => {
    const back = [[0, 26, 30], [34, 30, 26], [70, 22, 34], [106, 28, 28], [150, 26, 32], [196, 24, 26], [238, 30, 30], [282, 38, 26]]
    for (const [x, w, hgt] of back) {
      const g = 112, top = g - hgt
      c.rect(x, top, w, hgt, C.farL); c.rect(x + w - 4, top, 4, hgt, C.far)
      c.poly([x - 2, top + 1, x + w / 2, top - 12, x + w + 2, top + 1], C.farD)
      for (let xx = x + 4; xx < x + w - 6; xx += 7) c.rect(xx, top + 6, 3, 4, C.far)
    }
  },

  // ── 광장 바닥: 돌 깔기 (위쪽 줄은 작게 = 멀리) ──
  (c) => {
    c.rect(0, 124, 320, 56, C.ground)
    c.hline(0, 124, 320, C.groundS); c.hline(0, 125, 320, C.groundD)
    for (let y = 128, n = 0; y < 180; n++) {
      const hgt = 3 + Math.floor(n / 3), wdt = 6 + n
      c.hline(0, y, 320, C.groundD)
      for (let x = (n % 2) * Math.floor(wdt / 2); x < 320; x += wdt) { c.vline(x, y - hgt + 1, hgt - 1, C.groundD); c.px(x + 1, y - hgt + 1, C.groundL) }
      y += hgt
    }
    noise(0, 126, 320, 54, C.groundS, 0.04, 9)
  },
  // ── 앞줄 집 다섯 채 ──
  (c) => house(c, 4, 124, 50, 40, 22, H.red, "timber"),
  (c) => { win(c, 10, 92, 7, 8, { shutter: "#5a8a4a", flowers: ["#e05a5a", "#f0c040", "#e05a5a"] }); win(c, 36, 92, 7, 8, { shutter: "#5a8a4a", flowers: ["#f0c040", "#e05a5a"] }); win(c, 34, 108, 8, 7, { lit: true }); door(c, 14, 124, 9, 14, "#7a4a2a", { arch: true }) },
  (c) => chimney(c, 44, 64, 14, "#9a5440", "#73392b"),

  (c) => house(c, 66, 124, 72, 46, 26, H.tavern, "plank"),
  (c) => {
    // 2층 발코니 + 창 셋
    for (const x of [72, 96, 120]) win(c, x, 86, 8, 9, { frame: "#f2e2c4", lit: x === 96 })
    c.rect(68, 98, 68, 2, C.woodD); for (let x = 69; x < 136; x += 3) c.vline(x, 100, 4, C.wood); c.hline(68, 104, 68, C.woodD)
    // 1층: 큰 아치 창 둘 + 문 + 간판(그림만) + 등불 + 술통
    win(c, 72, 110, 12, 8, { lit: true, frame: "#f2e2c4" }); win(c, 118, 110, 12, 8, { lit: true, frame: "#f2e2c4" })
    door(c, 95, 124, 12, 15, "#5a3418", { arch: true })
    c.hline(108, 106, 10, C.woodD); c.vline(109, 106, 2, C.woodD); c.vline(116, 106, 2, C.woodD)
    c.rect(107, 108, 12, 9, C.woodD); c.rect(108, 109, 10, 7, "#e9d2a0"); c.rect(111, 110, 4, 5, "#f0b44a"); c.hline(111, 110, 4, "#fff6dc"); c.px(115, 111, "#f0b44a"); c.px(115, 112, "#f0b44a")
    c.rect(90, 110, 3, 4, "#3a2416"); c.px(91, 111, C.lit); c.px(91, 112, C.lit)
    for (const [x, y] of [[138, 116], [143, 118]]) { c.ellipse(x, y, 3, 4, "#8a5a30"); c.hline(x - 3, y - 2, 7, "#4a2c1a"); c.hline(x - 3, y + 2, 7, "#4a2c1a"); c.vline(x - 2, y - 3, 6, "#a8763e") }
  },
  (c) => chimney(c, 118, 54, 14, "#8a8278", "#6a645c"),

  (c) => house(c, 158, 124, 44, 38, 20, H.blue, "plank"),
  (c) => { win(c, 165, 94, 7, 8, { frame: "#f4f1ea", flowers: ["#f08aa8", "#ffffff", "#f08aa8"] }); win(c, 186, 94, 7, 8, { frame: "#f4f1ea" }); win(c, 186, 110, 7, 7, { frame: "#f4f1ea", lit: true }); door(c, 166, 124, 9, 13, "#3e6a9a", { frame: "#f4f1ea" }); c.rect(161, 117, 3, 7, "#5aae5a"); c.px(162, 116, "#e05a5a") },

  (c) => house(c, 214, 124, 52, 42, 22, H.brick, "brick"),
  (c) => {
    // 가게: 노랑·흰 줄무늬 차양 + 진열창 + 상자
    win(c, 221, 90, 7, 8, { frame: "#e8dcc4" }); win(c, 248, 90, 7, 8, { frame: "#e8dcc4" })
    for (let x = 214; x < 266; x++) { const yel = Math.floor((x - 214) / 4) % 2 === 0; c.vline(x, 103, 5, yel ? "#f2c24a" : "#fbf4e2"); if (x % 4 < 2) c.px(x, 108, yel ? "#d0a030" : "#e2dccb") }
    c.line(266, 103, 274, 99, "#c49a3a"); c.line(266, 107, 274, 103, "#c49a3a")
    c.rect(218, 111, 22, 9, "#5a4030"); c.rect(219, 112, 20, 7, C.glass); c.rect(219, 115, 20, 4, C.glassD); c.px(220, 112, C.glassL)
    for (const [x, col] of [[221, "#e05a5a"], [226, "#f0c040"], [231, "#7ccf5a"], [235, "#b07ee0"]]) c.rect(x, 116, 3, 3, col)
    door(c, 247, 124, 10, 13, "#2c5a42", { frame: "#e8dcc4" })
    for (const [x, y] of [[262, 117], [266, 117], [264, 112]]) { c.rect(x, y, 6, 6, "#b07a46"); c.rect(x, y, 6, 1, "#d09a5e"); c.vline(x + 5, y, 6, "#8a5a30"); c.line(x, y + 1, x + 5, y + 5, "#8a5a30") }
  },

  (c) => house(c, 286, 124, 34, 50, 18, H.stone, "stone"),
  (c) => { win(c, 293, 84, 6, 9, { frame: "#e8e2d6", lit: true }); win(c, 306, 84, 6, 9, { frame: "#e8e2d6" }); win(c, 300, 102, 6, 7, { frame: "#e8e2d6" }); door(c, 296, 124, 9, 12, "#5a4a3a", { arch: true }) },

  // ── 광장 물건: 우물 · 나무 · 가로등 · 화단 · 수레 ──
  (c) => {
    // 우물 (가운데 아래)
    const wx = 152, wy = 150
    dkEllipse(c, wx, wy + 6, 14, 3)
    c.rect(wx - 12, wy - 6, 24, 10, "#9a948a"); c.ellipse(wx, wy - 6, 12, 4, "#b8b2a6"); c.ellipse(wx, wy - 6, 9, 2, "#3e6290")
    for (let x = wx - 12; x < wx + 12; x += 5) c.vline(x, wy - 4, 8, "#7f796f")
    c.hline(wx - 12, wy - 1, 24, "#7f796f"); c.vline(wx + 11, wy - 6, 10, "#7f796f")
    c.rect(wx - 11, wy - 22, 2, 16, C.wood); c.rect(wx + 9, wy - 22, 2, 16, C.woodD)
    c.poly([wx - 15, wy - 21, wx, wy - 29, wx + 15, wy - 21], "#a8503e"); c.hline(wx - 15, wy - 21, 31, "#73392b")
    c.hline(wx - 9, wy - 17, 18, C.woodD); c.vline(wx, wy - 17, 6, "#8a8278"); c.rect(wx - 2, wy - 12, 4, 3, C.wood)
  },
  (c) => tree(c, 58, 150, 9),
  (c) => tree(c, 284, 154, 10),
  (c) => lamp(c, 62, 126),
  (c) => lamp(c, 210, 128),
  (c) => {
    // 화단 (왼쪽 앞)
    c.rect(18, 160, 26, 6, "#8a5a30"); c.hline(18, 160, 26, "#a8763e")
    for (let x = 19; x < 43; x += 2) { c.px(x, 158, C.leaf[1]); c.px(x, 159, C.leaf[0]); if (x % 4 === 1) c.px(x, 157, ["#e05a5a", "#f0c040", "#f08aa8", "#ffffff"][(x >> 2) % 4]) }
    // 수레 (오른쪽)
    c.rect(234, 150, 26, 8, "#8e5c38"); c.hline(234, 150, 26, "#b07a46"); c.hline(234, 157, 26, "#4a2c1a")
    for (const [x, col] of [[237, "#e05a5a"], [243, "#7ccf5a"], [249, "#f0c040"], [255, "#e05a5a"]]) c.circ(x, 148, 2, col)
    c.ring(240, 160, 3, "#3a2416"); c.ring(254, 160, 3, "#3a2416"); c.px(240, 160, "#6a4128"); c.px(254, 160, "#6a4128")
    c.line(260, 152, 270, 156, "#4a2c1a")
    dkEllipse(c, 248, 164, 16, 2)
  },
  // ── 마을 사람 ──
  (c) => {
    person(c, 30, 140, { face: 1, shirt: "#d9604c", pants: "#3e4a6a", hair: "#4a2c1a" })
    person(c, 86, 136, { face: -1, shirt: "#5a8cc0", dress: true, hair: "#c8963a", carry: "#e9d2a0" })
    person(c, 94, 137, { face: -1, shirt: "#f0c040", pants: "#5a4030", hair: "#2a1c18", kid: true })
    person(c, 124, 162, { face: 1, shirt: "#6aae5a", pants: "#5a4030", hair: "#8a5a30", hat: "#c8963a" })
    person(c, 178, 146, { face: -1, shirt: "#b07ee0", dress: true, hair: "#2a1c18" })
    person(c, 186, 146, { face: 1, shirt: "#e8e2d6", pants: "#6a4128", hair: "#d0d0d0", carry: "#8e5c38" })
    person(c, 222, 136, { face: 1, shirt: "#3f7a5a", pants: "#3a2a22", hair: "#4a2c1a", hat: "#5a4030" })
    person(c, 300, 166, { face: -1, shirt: "#e05a8a", dress: true, hair: "#f0c040" })
    // 고양이 · 비둘기
    c.rect(198, 131, 4, 2, "#f0a040"); c.px(201, 130, "#f0a040"); c.px(202, 129, "#f0a040"); c.px(197, 130, "#f0a040"); c.px(202, 130, "#3a2a22")
    for (const [x, y] of [[166, 166], [171, 168]]) { c.rect(x, y, 3, 2, "#9aa4b4"); c.px(x + 3, y - 1, "#9aa4b4"); c.px(x + 4, y - 1, "#f0a040") }
  },
)
