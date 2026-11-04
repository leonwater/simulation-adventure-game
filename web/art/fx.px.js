// 모험가 키우기 전투 이펙트 픽셀 그림 (v3.11, claude-pxl)
// 모두 프레임 애니(가로 띠). 화면에서는 유닛과 같은 3배로 키워 단계 재생한다 (src/ui/fx.ts).
// 색은 원소마다 5단(밝은 심 → 어두운 테두리)으로 써서 한 이펙트 안에서도 색이 여러 겹 보이게 한다.
// 빌드: bash scripts/sprites.sh  (→ src/assets/fx/atlas.png + atlas.json)

// ── 색 묶음: [가장 밝음(심), 밝음, 중간, 어두움, 가장 어두움(테두리)] ──
const PAL = {
  white: ["#ffffff", "#e8f4ff", "#a8c8ec", "#6680b8", "#34406e"],
  arc: ["#ffffff", "#c8f4ff", "#62d2ff", "#ff7ccc", "#7448d0"],
  fire: ["#fffbe0", "#ffe066", "#ff9a3c", "#e0403a", "#7a1a2a"],
  ice: ["#ffffff", "#d4f4ff", "#86ccf4", "#4486d8", "#22407a"],
  bolt: ["#ffffff", "#fff6b0", "#ffd84a", "#f08a2a", "#5aa8ff"],
  shadow: ["#f4e0ff", "#d08cff", "#9a4ee6", "#56289a", "#22103c"],
  blood: ["#ffe0e0", "#ff7070", "#d82848", "#7e1032", "#2e0618"],
  poison: ["#f0ffc0", "#bdf070", "#6cc850", "#3a8a48", "#6a3a9a"],
  gold: ["#ffffff", "#fff0b0", "#f6c063", "#d0822a", "#6e4218"],
  green: ["#ffffff", "#d8ffc8", "#8ee87a", "#3fae5a", "#1f5a3a"],
  earth: ["#f4e0b0", "#d0a868", "#9a6e40", "#5e4028", "#2e2014"],
  red: ["#ffffff", "#ffb4a0", "#ff5a4a", "#b02838", "#4a1020"],
  seal: ["#ffffff", "#e4d4ff", "#b8a0f0", "#7a6aa8", "#3a3058"],
}
const R = Math.round
const TAU = Math.PI * 2
// 각도(도)·반지름 → 점
const at = (cx, cy, deg, r) => [R(cx + Math.cos((deg * Math.PI) / 180) * r), R(cy + Math.sin((deg * Math.PI) / 180) * r)]
// 결정적 난수 (같은 그림이 매번 같게)
const rnd = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280) }

// ── 1. 타격 폭발 (24×24, 6프레임): 심 → 빛살 8줄 → 고리 → 흩어지는 불티 ──
function burst(c, p, k) {
  const cx = 12, cy = 12
  if (k === 0) { c.circ(cx, cy, 3, p[2]); c.circ(cx, cy, 2, p[1]); c.px(cx, cy, p[0]); return }
  if (k === 1) {
    for (const d of [0, 90, 180, 270]) c.line(cx, cy, ...at(cx, cy, d, 8), p[1], 2)
    c.circ(cx, cy, 5, p[2]); c.circ(cx, cy, 4, p[1]); c.circ(cx, cy, 2, p[0]); return
  }
  if (k === 2) {
    for (const d of [45, 135, 225, 315]) c.line(cx, cy, ...at(cx, cy, d, 8), p[2], 2)
    for (const d of [0, 90, 180, 270]) { c.line(cx, cy, ...at(cx, cy, d, 11), p[1], 2); c.line(cx, cy, ...at(cx, cy, d, 10), p[0]) }
    c.circ(cx, cy, 5, p[1]); c.circ(cx, cy, 3, p[0]); return
  }
  if (k === 3) {
    c.ring(cx, cy, 8, p[2]); c.ring(cx, cy, 7, p[3])
    for (const d of [0, 90, 180, 270]) c.line(...at(cx, cy, d, 9), ...at(cx, cy, d, 11), p[1])
    for (const d of [45, 135, 225, 315]) c.px(...at(cx, cy, d, 10), p[0])
    c.circ(cx, cy, 2, p[1]); return
  }
  const r = k === 4 ? 10 : 11, col = k === 4 ? p[3] : p[4]
  for (let d = 0; d < 360; d += 30) c.px(...at(cx, cy, d + k * 7, r), d % 60 ? col : p[2])
  if (k === 4) for (const d of [20, 110, 200, 290]) c.px(...at(cx, cy, d, 7), p[1])
}

// ── 2. 퍼지는 고리 (32×32, 5프레임) ──
function ring(c, p, k) {
  const r = [4, 7, 10, 12, 14][k], col = [p[0], p[1], p[2], p[3], p[4]][k]
  c.ring(16, 16, r, col)
  if (k < 3) c.ring(16, 16, r - 1, p[k + 1])
  if (k === 4) for (let d = 0; d < 360; d += 45) c.px(...at(16, 16, d + 22, 15), "_")
}

// ── 3. 반달 베기 궤적 (32×32, 5프레임): 오른쪽 위 → 오른쪽 아래로 휘두름. 머리는 흰 심, 꼬리로 갈수록 어둡고 가늘다 ──
function slash(c, p, k) {
  const cx = 12, cy = 16, Rr = 13
  const start = -110, end = 80
  const head = k < 3 ? start + ((end - start) * (k + 1)) / 3 : end
  const tail = k < 3 ? Math.max(start, head - 130) : end - 130 + (k - 2) * 40
  for (let a = tail; a <= head; a += 1.5) {
    const t = (a - tail) / Math.max(1, head - tail)          // 0 꼬리 … 1 머리
    const fade = k >= 3 ? 1 + (k - 2) : 0
    const th = Math.max(1, R(5.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - fade))
    for (let i = 0; i < th; i++) {
      const col = i <= 1 ? (t > 0.5 && k < 4 ? p[0] : p[1]) : i === 2 ? p[1] : i === 3 ? p[2] : i === 4 ? p[3] : p[4]
      c.px(...at(cx, cy, a, Rr - i), k === 4 && i === 0 ? p[2] : col)
    }
  }
}

// ── 4. X자 베기 (32×32, 5프레임) ──
function xslash(c, p, k) {
  const cut = (x0, y0, x1, y1, f) => {
    const x = R(x0 + (x1 - x0) * f), y = R(y0 + (y1 - y0) * f)
    if (k < 3) { c.line(x0, y0, x, y, p[3], 4); c.line(x0, y0, x, y, p[2], 3); c.line(x0, y0, x, y, p[1], 2); c.line(x0, y0, x, y, p[0]) }
    else if (k === 3) { c.line(x0, y0, x, y, p[3], 2); c.line(x0, y0, x, y, p[2]) }
    else for (let i = 0; i <= 10; i += 2) c.px(R(x0 + (x1 - x0) * i / 10), R(y0 + (y1 - y0) * i / 10), p[4])
  }
  cut(4, 4, 28, 28, k === 0 ? 0.55 : 1)
  if (k >= 1) cut(28, 4, 4, 28, k === 1 ? 0.55 : 1)
  if (k === 2) { c.circ(16, 16, 2, p[0]); for (const d of [0, 90, 180, 270]) c.px(...at(16, 16, d, 4), p[1]) }
}

// ── 5. 할퀴기 세 줄 (24×24, 4프레임) ──
function claw(c, p, k) {
  for (let i = -1; i <= 1; i++) {
    const x0 = 15 + i * 5, y0 = 2, x1 = 5 + i * 5, y1 = 22
    const f = k === 0 ? 0.5 : 1
    const x = R(x0 + (x1 - x0) * f), y = R(y0 + (y1 - y0) * f)
    if (k < 2) { c.line(x0, y0, x, y, p[3], 3); c.line(x0, y0, x, y, p[1], 2); c.line(x0, y0, x, y, p[0]) }
    else if (k === 2) { c.line(x0, y0, x1, y1, p[3], 2); c.line(x0, y0, x1, y1, p[2]) }
    else for (let s = 0; s <= 8; s += 2) c.px(R(x0 + (x1 - x0) * s / 8), R(y0 + (y1 - y0) * s / 8), p[4])
  }
}

// ── 6. 찌르기 (28×9, 4프레임): 오른쪽으로 뻗는 날 + 끝 반짝 ──
function pierce(c, p, k) {
  const len = [12, 24, 27, 27][k]
  if (k < 3) {
    c.line(0, 4, len, 4, p[3], 3); c.line(0, 4, len, 4, p[2], 2); c.hline(4, 4, len - 4, p[1]); c.hline(len - 8, 4, 8, p[0])
    c.px(len, 4, p[0]); c.px(len, 3, p[1]); c.px(len, 5, p[1])
    if (k >= 1) { c.vline(len - 1, 1, 7, p[1]); c.px(len - 1, 4, p[0]) }
  } else for (let x = 2; x < 27; x += 3) c.px(x, 4, p[3])
}

// ── 7. 세로 마법진 (14×38, 6프레임): 시전자 앞에 서는 점선 타원 + 돌아가는 룬 ──
function circlev(c, p, k) {
  const cx = 7, cy = 19, rx = 6, ry = [5, 11, 18, 18, 18, 18][k]
  const n = 64
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU, x = R(cx + Math.cos(t) * rx), y = R(cy + Math.sin(t) * ry)
    c.px(x, y, (i + k) % 3 === 0 ? p[0] : (i + k) % 3 === 1 ? p[2] : p[3])
    const x2 = R(cx + Math.cos(t) * (rx - 3)), y2 = R(cy + Math.sin(t) * (ry - 4))
    if (ry > 8 && (i + k * 2) % 4 === 0) c.px(x2, y2, p[1])
  }
  if (k >= 2) for (let j = 0; j < 4; j++) {
    const t = ((j / 4) + k * 0.06) * TAU, x = R(cx + Math.cos(t) * rx), y = R(cy + Math.sin(t) * ry)
    c.px(x, y, p[0]); c.px(x, y - 1, p[1]); c.px(x, y + 1, p[1])
  }
  if (k === 5) for (let y = 4; y < 34; y += 6) c.px(cx, y, p[1])
}

// ── 8. 바닥 마법진 (44×14, 6프레임) ──
function circleg(c, p, k) {
  const cx = 22, cy = 7, s = [0.35, 0.7, 1, 1, 1, 1][k]
  const rx = R(20 * s), ry = Math.max(2, R(6 * s))
  c.ellipse(cx, cy, rx, ry, p[2], true)
  if (s === 1) {
    c.ellipse(cx, cy, 14, 4, p[3], true)
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * TAU
      if ((i + k * 2) % 4 === 0) c.px(R(cx + Math.cos(t) * 17), R(cy + Math.sin(t) * 5), p[1])
    }
    for (let j = 0; j < 6; j++) {
      const t = ((j / 6) + k * 0.05) * TAU, x = R(cx + Math.cos(t) * 20), y = R(cy + Math.sin(t) * 6)
      c.px(x, y, p[0]); c.px(x - 1, y, p[1]); c.px(x + 1, y, p[1])
    }
    c.hline(cx - 6, cy, 13, p[3]); c.px(cx, cy, p[0])
  }
}

// ── 9. 빛기둥 (버프, 22×46, 6프레임): 밝은 두 테두리 + 성긴 안쪽 빛 + 올라가는 반짝이 + 발밑 호 ──
function aura(c, p, k) {
  const H = [14, 28, 42, 46, 46, 46][k], base = 44
  for (let i = 0; i < H; i++) {
    const y = base - i, f = i / 46, half = R(6 - f * 2)
    const top = f > 0.72                       // 위쪽은 성기게 사라진다
    if (k === 5 && i % 2) continue
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half, near = Math.abs(x) === half - 1
      if (top && (x + i) % 2) continue
      if (edge) c.px(11 + x, y, top ? p[3] : p[2])
      else if (near) c.px(11 + x, y, p[1])
      else if (x === 0) { if ((i + k * 3) % 5 < 3) c.px(11, y, p[0]) }
      else if ((i + k * 4 + Math.abs(x) * 3) % 7 < 2) c.px(11 + x, y, Math.abs(x) < 2 ? p[1] : p[2])   // 위로 흐르는 빛줄
    }
  }
  // 발밑 호 (앞쪽 반)
  if (k >= 1) for (let a = 10; a <= 170; a += 6) c.px(...at(11, 44, a, k >= 2 ? 10 : 7).map((v, j) => (j ? R(44 + (v - 44) * 0.3) : v)), k >= 4 ? p[3] : p[1])
  const g = rnd(3)
  for (let j = 0; j < 8; j++) {
    const x = R(1 + g() * 20), y = R(43 - ((g() * 44 + k * 7) % 44))
    c.px(x, y, p[0]); if (j % 2) { c.px(x - 1, y, p[1]); c.px(x + 1, y, p[1]); c.px(x, y - 1, p[1]); c.px(x, y + 1, p[1]) }
  }
}

// ── 10. 작은 별·불티 (반짝이 7×7, 2프레임) ──
function star(c, p, k) {
  if (k === 0) { c.px(3, 3, p[0]); for (const [x, y] of [[3, 1], [3, 2], [3, 4], [3, 5], [1, 3], [2, 3], [4, 3], [5, 3]]) c.px(x, y, Math.abs(x - 3) + Math.abs(y - 3) === 1 ? p[1] : p[2]); c.px(3, 0, p[3]); c.px(3, 6, p[3]); c.px(0, 3, p[3]); c.px(6, 3, p[3]) }
  else { c.px(3, 3, p[1]); for (const [x, y] of [[2, 2], [4, 2], [2, 4], [4, 4]]) c.px(x, y, p[2]) }
}

for (const n of ["white", "arc", "fire", "ice", "bolt", "poison", "gold", "earth", "blood"]) {
  anim(`burst_${n}`, { w: 24, h: 24, frames: 6, fps: 16 }, (c) => burst(c, PAL[n], c.frame))
}
for (const n of ["white", "arc", "fire", "ice", "bolt", "shadow", "poison", "gold", "green", "earth", "red", "seal", "blood"]) anim(`ring_${n}`, { w: 32, h: 32, frames: 5, fps: 14 }, (c) => ring(c, PAL[n], c.frame))
for (const n of ["white", "arc", "fire", "ice", "bolt", "shadow", "gold", "green", "red", "seal"]) anim(`star_${n}`, { w: 7, h: 7, frames: 2, fps: 6 }, (c) => star(c, PAL[n], c.frame))
for (const n of ["white", "shadow", "gold"]) anim(`slash_${n}`, { w: 32, h: 32, frames: 5, fps: 18 }, (c) => slash(c, PAL[n], c.frame))
for (const n of ["shadow", "blood", "white"]) anim(`xslash_${n}`, { w: 32, h: 32, frames: 5, fps: 16 }, (c) => xslash(c, PAL[n], c.frame))
anim("claw", { w: 24, h: 24, frames: 4, fps: 16 }, (c) => claw(c, PAL.red, c.frame))
for (const n of ["white", "gold", "blood"]) anim(`pierce_${n}`, { w: 28, h: 9, frames: 4, fps: 18 }, (c) => pierce(c, PAL[n], c.frame))
for (const n of ["arc", "fire", "ice", "bolt", "red", "gold", "seal"]) {
  anim(`circlev_${n}`, { w: 14, h: 38, frames: 6, fps: 12 }, (c) => circlev(c, PAL[n], c.frame))
  anim(`circleg_${n}`, { w: 44, h: 14, frames: 6, fps: 12 }, (c) => circleg(c, PAL[n], c.frame))
}
for (const n of ["gold", "ice", "green", "red", "white"]) anim(`aura_${n}`, { w: 22, h: 46, frames: 6, fps: 12 }, (c) => aura(c, PAL[n], c.frame))

// ── 투사체 (오른쪽을 향함, 돌려서 쓴다) ──
// 마력 창 (참고 그림: 흰 심 + 하늘색 + 분홍 꼬리)
anim("proj_arc", { w: 20, h: 9, frames: 2, fps: 12 }, (c) => {
  const p = PAL.arc
  c.poly([2, 4, 8, 1, 17, 3, 20, 4, 17, 6, 8, 8], p[3])
  c.poly([4, 4, 9, 2, 17, 4, 9, 7], p[2])
  c.poly([8, 4, 11, 3, 18, 4, 11, 5], p[1])
  c.hline(11, 4, 8, p[0])
  for (const [x, y] of c.frame ? [[0, 3], [1, 6], [3, 1]] : [[0, 5], [1, 2], [3, 7]]) c.px(x, y, p[4])
})
anim("proj_ice", { w: 26, h: 11, frames: 2, fps: 12 }, (c) => {
  const p = PAL.ice
  c.poly([0, 5, 9, 1, 22, 3, 26, 5, 22, 8, 9, 10], p[4])
  c.poly([2, 5, 10, 2, 22, 4, 25, 5], p[1])          // 위 면: 밝음
  c.poly([2, 5, 25, 5, 22, 7, 10, 9], p[3])          // 아래 면: 어두움
  c.hline(6, 5, 18, p[2]); c.hline(12, 4, 11, p[0])
  for (const [x, y] of c.frame ? [[1, 2], [3, 9]] : [[1, 8], [4, 1]]) c.px(x, y, p[1])
})
anim("proj_fire", { w: 18, h: 12, frames: 3, fps: 14 }, (c) => {
  const p = PAL.fire, k = c.frame
  const w = [0, 1, -1][k]
  c.poly([0, 6 + w, 6, 2, 12, 2, 12, 10, 6, 10], p[3])
  c.poly([3, 6 - w, 8, 3, 12, 3, 12, 9, 8, 9], p[2])
  c.circ(12, 6, 5, p[3]); c.circ(12, 6, 4, p[2]); c.circ(13, 6, 3, p[1]); c.circ(13, 5, 1, p[0])
  c.px(1, 3 + k, p[4]); c.px(2, 9 - k, p[4])
})
anim("proj_arrow", { w: 18, h: 5, frames: 1, fps: 1 }, (c) => {
  c.hline(3, 2, 11, "#8a5a30"); c.hline(4, 1, 9, "#b07a46")
  c.poly([13, 0, 18, 2.5, 13, 5], "#dfe6f0"); c.px(16, 2, "#ffffff"); c.px(14, 3, "#8f98ab")
  c.px(0, 0, "#e0565e"); c.px(1, 1, "#e0565e"); c.px(0, 4, "#f4f6fb"); c.px(1, 3, "#f4f6fb"); c.px(2, 2, "#a83a48")
})
anim("proj_light", { w: 20, h: 7, frames: 2, fps: 12 }, (c) => {
  const p = PAL.bolt
  c.poly([0, 3, 10, 1, 20, 3.5, 10, 6], p[2]); c.hline(3, 3, 16, p[1]); c.hline(10, 3, 9, p[0])
  c.px(c.frame ? 1 : 2, c.frame ? 1 : 5, p[4])
})
anim("proj_star", { w: 9, h: 9, frames: 2, fps: 16 }, (c) => {
  const m = "#dfe6f0", d = "#8f98ab", w = "#ffffff"
  if (c.frame === 0) { c.poly([4, 0, 5, 4, 9, 4.5, 5, 5, 4.5, 9, 4, 5, 0, 4.5, 4, 4], m); c.px(4, 4, d); c.px(4, 1, w); c.px(7, 4, w) }
  else { c.line(1, 1, 7, 7, m, 2); c.line(7, 1, 1, 7, m, 2); c.px(4, 4, d); c.px(1, 1, w); c.px(7, 1, w) }
})
// 운석 (오른쪽 아래로 떨어짐: 꼬리는 왼쪽 위)
anim("meteor", { w: 32, h: 32, frames: 3, fps: 12 }, (c) => {
  const p = PAL.fire, k = c.frame, g = rnd(7 + k)
  for (let i = 0; i < 16; i++) {
    const t = i / 16, x = R(2 + t * 18 + (g() - 0.5) * 4), y = R(2 + t * 18 + (g() - 0.5) * 4)
    c.circ(x, y, R(1 + t * 4), t < 0.3 ? p[4] : t < 0.6 ? p[3] : p[2])
  }
  c.circ(22, 22, 8, p[3]); c.circ(22, 22, 7, p[2]); c.circ(23, 23, 6, p[1])
  c.circ(23, 23, 5, "#5a3020"); c.circ(22, 22, 3, "#7a4428")
  c.line(20, 24, 25, 21, p[2]); c.px(24, 25, p[1]); c.px(21, 20, p[0])
  c.px(R(3 + g() * 6), R(6 + g() * 4), p[1])
})
// 큰 폭발 (운석 낙하·종말) 48×48, 7프레임
anim("explode", { w: 48, h: 48, frames: 7, fps: 14 }, (c) => {
  const p = PAL.fire, k = c.frame, cx = 24, cy = 26, smoke = ["#6e5a62", "#4a3a44", "#2e2430"]
  if (k <= 3) {
    const r = [5, 10, 15, 18][k]
    c.circ(cx, cy, r, k >= 2 ? p[3] : p[2]); c.circ(cx, cy, r - 3, p[2]); c.circ(cx, cy - 1, R(r * 0.6), p[1]); c.circ(cx, cy - 2, R(r * 0.3), p[0])
    if (k >= 2) for (let d = 0; d < 360; d += 40) c.line(...at(cx, cy, d + k * 10, r), ...at(cx, cy, d + k * 10, r + 4), p[2], 2)
  } else {
    const g = rnd(k)
    const r = [20, 22, 23][k - 4]
    for (let i = 0; i < 14; i++) { const [x, y] = at(cx, cy, i * 26 + k * 5, r - 4 - g() * 6); c.circ(x, y, R(4 - (k - 4)), smoke[k - 4]) }
    if (k === 4) { c.circ(cx, cy, 9, p[3]); c.circ(cx, cy, 6, p[2]); c.circ(cx, cy, 3, p[1]) }
    if (k === 5) c.circ(cx, cy, 5, p[3])
    for (let i = 0; i < 8; i++) c.px(...at(cx, cy, i * 45 + 20, r + 1), p[k === 6 ? 3 : 1])
  }
})
// 얼음 가시 (참고 그림: 빛 받는 왼쪽 면·그늘진 오른쪽 면·흰 능선). 7프레임: 솟음 → 반짝 → 금
function spike(c, W, H, k) {
  const p = PAL.ice, grow = [0.25, 0.5, 0.75, 1, 1, 1, 1][k]
  const top = R(H - H * grow), mid = W / 2
  c.poly([0, H, mid - 1, top + 3, mid, top, mid + 1, top + 3, W, H], p[4])
  c.poly([1, H, mid - 1, top + 4, mid, top + 1, mid, H], p[1])
  c.poly([mid, top + 1, mid + 1, top + 4, W - 1, H, mid, H], p[3])
  c.line(mid, top + 1, mid, H - 1, p[0])
  c.line(R(mid / 2), H - 2, mid - 1, R(top + (H - top) * 0.35), p[2])
  c.line(R(mid + (W - mid) / 2), H - 2, mid + 1, R(top + (H - top) * 0.45), p[2])
  if (k === 4 || k === 5) { c.px(mid - 1, top + 6, "#ffffff"); c.px(mid - 2, top + 7, "#ffffff"); c.px(mid - 1, top + 8, p[0]) }
  if (k === 6) { c.line(1, R(H * 0.6), W - 2, R(H * 0.45), p[4]); c.line(mid, R(H * 0.3), W - 2, R(H * 0.7), p[4]) }
}
anim("spike_l", { w: 16, h: 46, frames: 7, fps: 16 }, (c) => spike(c, 15, 45, c.frame))
anim("spike_s", { w: 11, h: 28, frames: 7, fps: 16 }, (c) => spike(c, 10, 27, c.frame))
// 작은 얼음 조각 (튀는 파편)
anim("shard_ice", { w: 5, h: 7, frames: 1, fps: 1 }, (c) => { c.poly([0, 7, 2, 0, 5, 7], PAL.ice[3]); c.poly([1, 6, 2, 1, 2, 6], PAL.ice[1]); c.px(2, 2, "#ffffff") })
// 불기둥 (종말) 22×56, 6프레임
anim("pillar_fire", { w: 22, h: 56, frames: 6, fps: 12 }, (c) => {
  const p = PAL.fire, k = c.frame, H = [16, 34, 56, 56, 56, 40][k]
  for (let i = 0; i < H; i++) {
    const y = 55 - i, f = i / 56, half = Math.max(1, R(8 - f * 6 + Math.sin(i * 0.45 + k * 1.7) * 1.6))
    if (k === 5 && i % 2) continue
    for (let x = -half; x <= half; x++) {
      const ax = Math.abs(x) / half
      c.px(11 + x, y, ax > 0.8 ? p[3] : ax > 0.5 ? p[2] : f < 0.35 ? p[0] : p[1])
    }
  }
  const g = rnd(11 + k)
  for (let j = 0; j < 6; j++) c.px(R(3 + g() * 16), R(55 - g() * H), j % 2 ? p[1] : p[4])
})
// 내리꽂는 번개 18×60, 4프레임
anim("bolt_v", { w: 18, h: 60, frames: 4, fps: 14 }, (c) => {
  const p = PAL.bolt, k = c.frame, g = rnd(21 + (k % 2))
  let x = 9, y = 0
  const pts = [[x, y]]
  while (y < 58) { y = Math.min(59, y + 6 + R(g() * 4)); x = Math.max(2, Math.min(15, x + R((g() - 0.5) * 10))); pts.push([x, y]) }
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = pts[i - 1], [cc, d] = pts[i]
    if (k < 3) { c.line(a, b, cc, d, p[4], 3); c.line(a, b, cc, d, p[2], 2); c.line(a, b, cc, d, p[0]) } else c.line(a, b, cc, d, p[3])
  }
  if (k < 2) { c.circ(pts.at(-1)[0], 57, 2, p[1]); c.line(pts[3][0], pts[3][1], pts[3][0] + 5, pts[3][1] + 6, p[2]) }
})
// 가로 번개 마디 (연쇄 번개·이어 붙여 씀) 24×11, 3프레임
anim("zap_h", { w: 24, h: 11, frames: 3, fps: 16 }, (c) => {
  const p = PAL.bolt, g = rnd(31 + c.frame)
  let px0 = 0, py0 = 5
  for (let x = 4; x <= 24; x += 4) {
    const y = x === 24 ? 5 : R(5 + (g() - 0.5) * 8)
    c.line(px0, py0, x, y, p[4], 3); c.line(px0, py0, x, y, p[2], 2); c.line(px0, py0, x, y, p[0])
    px0 = x; py0 = y
  }
})
// 빛줄기 마디 (마력 해방·관통 사격) 16×14, 3프레임 — 가로로 이어 붙인다
for (const [n, p] of [["beam_arc", PAL.seal]]) {
  anim(n, { w: 16, h: 14, frames: 3, fps: 16 }, (c) => {
    for (let x = 0; x < 16; x++) {
      const wob = R(Math.sin((x / 16) * TAU + c.frame * 2.1))
      // 바깥(어두움)부터 안쪽(밝음)으로 겹쳐 그린다
      for (let h = 0; h <= 4; h++) c.vline(x, 1 + h + (h < 2 ? wob : 0), 12 - 2 * h, p[4 - h])
      if ((x + c.frame) % 4 === 0) { c.px(x, 0 + (wob > 0 ? 1 : 0), p[2]); c.px(x, 13 - (wob < 0 ? 1 : 0), p[2]) }
    }
  })
}
// 땅 갈라짐 마디 24×10
anim("crack", { w: 24, h: 10, frames: 1, fps: 1 }, (c) => {
  const p = PAL.earth
  c.poly([0, 4, 5, 3, 9, 5, 14, 3, 19, 5, 24, 4, 24, 6, 19, 7, 14, 6, 9, 8, 5, 6, 0, 6], p[4])
  c.line(0, 4, 5, 3, p[1]); c.line(5, 3, 9, 5, p[1]); c.line(9, 5, 14, 3, p[1]); c.line(14, 3, 19, 5, p[1]); c.line(19, 5, 24, 4, p[1])
  c.line(9, 8, 7, 9, p[4]); c.line(14, 3, 16, 0, p[4]); c.px(16, 1, p[0])
})
anim("rock", { w: 4, h: 4, frames: 1, fps: 1 }, (c) => { c.rect(0, 1, 4, 3, PAL.earth[3]); c.rect(1, 0, 2, 3, PAL.earth[2]); c.px(1, 1, PAL.earth[0]) })
// 회오리 칼바람 (회전 베기) 44×44, 6프레임
anim("whirl", { w: 44, h: 44, frames: 6, fps: 16 }, (c) => {
  const p = PAL.white, k = c.frame
  for (let j = 0; j < 3; j++) {
    const base = j * 120 + k * 40
    for (let a = 0; a < 80; a += 1.5) {
      const t = a / 80, th = Math.max(1, R(3 * t))
      for (let i = 0; i < th; i++) c.px(...at(22, 22, base + a, 19 - i), i === 0 ? (t > 0.6 ? p[0] : p[1]) : p[i + 1])
    }
  }
  if (k > 3) for (let d = 0; d < 360; d += 30) c.px(...at(22, 22, d + k * 15, 20), p[3])
})
// 연기 (그림자 순간이동·쓰러짐) 18×18, 5프레임
anim("smoke", { w: 18, h: 18, frames: 5, fps: 12 }, (c) => {
  const k = c.frame, col = ["#7a5aa8", "#56389a", "#3a2460", "#2a1846", "#22103c"]
  const g = rnd(5)
  for (let i = 0; i < 6; i++) {
    const [x, y] = at(9, 10, i * 60 + g() * 20, 2 + k * 1.4)
    const r = Math.max(1, R(3 + k * 0.5 - (k > 2 ? k - 2 : 0)))
    c.circ(x, y, r, col[Math.min(4, k + (i % 2))])
    if (k < 2) c.px(x - 1, y - 1, "#a080d0")
  }
  if (k > 2) for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) if ((x + y) % 2 && c.is(x, y, "*")) c.px(x, y, "_")
})
// 봉인 (침묵) 32×32, 6프레임
anim("seal", { w: 32, h: 32, frames: 6, fps: 12 }, (c) => {
  const p = PAL.seal, k = c.frame, r = [6, 10, 13, 13, 13, 13][k]
  c.ring(16, 16, r, p[2]); if (r > 8) c.ring(16, 16, r - 1, p[3])
  if (k >= 2) {
    for (let i = 0; i < 40; i++) { const t = (i / 40) * TAU; if ((i + k) % 3 === 0) c.px(R(16 + Math.cos(t) * 9), R(16 + Math.sin(t) * 9), p[1]) }
    for (let j = 0; j < 4; j++) { const [x, y] = at(16, 16, j * 90 + k * 15, 11); c.px(x, y, p[0]); c.px(x + 1, y, p[1]); c.px(x - 1, y, p[1]); c.px(x, y + 1, p[1]); c.px(x, y - 1, p[1]) }
    c.line(12, 12, 20, 20, p[3], 2); c.line(20, 12, 12, 20, p[3], 2); c.line(12, 12, 20, 20, p[1]); c.line(20, 12, 12, 20, p[1])
  }
  if (k === 5) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x + y) % 2 && c.is(x, y, "*")) c.px(x, y, "_")
})
// 금빛 방패 (반격) 22×26, 4프레임
anim("shield", { w: 22, h: 26, frames: 4, fps: 12 }, (c) => {
  const p = PAL.gold, k = c.frame
  const shape = [2, 2, 11, 0, 20, 2, 20, 12, 11, 25, 2, 12]
  if (k === 0) { c.poly([6, 6, 11, 5, 16, 6, 16, 12, 11, 18, 6, 12], p[1]); return }
  if (k <= 2) {
    c.poly(shape, p[3]); c.poly([4, 4, 11, 2, 18, 4, 18, 12, 11, 22, 4, 12], k === 1 ? p[1] : p[2])
    c.poly([7, 6, 11, 5, 15, 6, 15, 12, 11, 17, 7, 12], k === 1 ? p[0] : p[1]); c.vline(11, 5, 13, p[0])
  } else for (let i = 0; i < shape.length; i += 2) c.px(shape[i], shape[i + 1], p[2])
})
// 입자: 불티·눈송이·거품·핏방울·회복 십자·먼지
anim("ember", { w: 3, h: 4, frames: 2, fps: 8 }, (c) => { c.px(1, 0, PAL.fire[1]); c.rect(0, 1, 3, 2, PAL.fire[2]); c.px(1, 1, PAL.fire[0]); c.px(1, 3, c.frame ? PAL.fire[3] : PAL.fire[4]) })
anim("snow", { w: 5, h: 5, frames: 1, fps: 1 }, (c) => { c.px(2, 2, "#ffffff"); for (const [x, y] of [[2, 0], [2, 1], [2, 3], [2, 4], [0, 2], [1, 2], [3, 2], [4, 2]]) c.px(x, y, PAL.ice[1]); c.px(1, 1, PAL.ice[2]); c.px(3, 3, PAL.ice[2]) })
anim("bubble", { w: 6, h: 6, frames: 1, fps: 1 }, (c) => { c.ring(3, 3, 2, PAL.poison[2]); c.px(2, 2, PAL.poison[0]); c.px(4, 4, PAL.poison[3]) })
anim("drop", { w: 4, h: 6, frames: 1, fps: 1 }, (c) => { c.px(1, 0, PAL.blood[2]); c.rect(0, 2, 4, 3, PAL.blood[2]); c.rect(1, 1, 2, 4, PAL.blood[2]); c.px(1, 2, PAL.blood[1]); c.hline(1, 5, 2, PAL.blood[3]) })
anim("plus", { w: 7, h: 7, frames: 1, fps: 1 }, (c) => { c.rect(2, 0, 3, 7, PAL.green[3]); c.rect(0, 2, 7, 3, PAL.green[3]); c.vline(3, 1, 5, PAL.green[1]); c.hline(1, 3, 5, PAL.green[1]); c.px(3, 3, "#ffffff") })
anim("feather", { w: 6, h: 3, frames: 1, fps: 1 }, (c) => { c.hline(0, 1, 6, "#f4f6fb"); c.px(1, 0, "#c9d3e0"); c.px(3, 2, "#c9d3e0"); c.px(5, 1, "#8f98ab") })
