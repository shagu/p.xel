// indexed canvas model + all drawing operations.
// index 0 is always transparent. every op is deterministic.

import { parseHex, toHex, nearest, mix, luma } from './color.js'

export class Palette {
  constructor () {
    this.colors = [null] // index 0 = transparent
    this.byHex = new Map()
    this.names = new Map() // name -> index
    this.ramps = new Map() // name -> [index,...]
    this.names.set('none', 0)
    this.names.set('clear', 0)
  }

  addHex (hex) {
    const h = toHex(parseHex(hex))
    if (this.byHex.has(h)) return this.byHex.get(h)
    this.colors.push(parseHex(h))
    const i = this.colors.length - 1
    if (i > 255) throw new Error('palette overflow: more than 255 colors')
    this.byHex.set(h, i)
    return i
  }

  define (name, hex) {
    const i = this.addHex(hex)
    this.names.set(name, i)
    return i
  }

  defineRamp (name, hexes) {
    const idx = hexes.map(h => this.addHex(h))
    this.ramps.set(name, idx)
    idx.forEach((ci, n) => this.names.set(`${name}.${n}`, ci))
    this.names.set(name, idx[Math.floor((idx.length - 1) / 2)])
    return idx
  }

  // resolve a token: #hex, name, name.N, name.-1 (from top), none
  resolve (tok) {
    if (tok === undefined || tok === null) throw new Error('missing color')
    const t = String(tok)
    if (t.startsWith('#')) return this.addHex(t)
    if (this.names.has(t)) return this.names.get(t)
    const m = t.match(/^([A-Za-z_][\w-]*)\.(-?\d+)$/)
    if (m && this.ramps.has(m[1])) {
      const r = this.ramps.get(m[1])
      let n = parseInt(m[2], 10)
      if (n < 0) n = r.length + n
      return r[Math.max(0, Math.min(r.length - 1, n))]
    }
    throw new Error('unknown color: ' + t)
  }

  ramp (name) {
    if (!this.ramps.has(name)) throw new Error('unknown ramp: ' + name)
    return this.ramps.get(name)
  }

  // ramp that contains the given color index, or null
  rampOf (ci) {
    for (const [, idx] of this.ramps) {
      const p = idx.indexOf(ci)
      if (p >= 0) return { idx, pos: p }
    }
    return null
  }

  rgb (ci) {
    return this.colors[ci] || [0, 0, 0]
  }

  nameOf (ci) {
    for (const [n, i] of this.names) if (i === ci && n !== 'none' && n !== 'clear') return n
    return ci === 0 ? 'none' : toHex(this.rgb(ci))
  }
}

export const BAYER = {
  bayer2: [[0, 2], [3, 1]],
  bayer4: [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]
  ],
  bayer8: [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
  ],
}

// fixed-density patterns: 1 = colorB. level only switches them (0 = all A, 1 = all B)
export const FIXED = {
  checker: [[1, 0], [0, 1]],
  lines: [[1, 1], [0, 0]],
  vlines: [[1, 0], [1, 0]],
  dots25: [[1, 0], [0, 0]],
  dots75: [[1, 1], [1, 0]],
  diag: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
}

export const LIGHT_DIRS = {
  tl: [-1, -1], t: [0, -1], tr: [1, -1], l: [-1, 0], r: [1, 0],
  bl: [-1, 1], b: [0, 1], br: [1, 1],
  topleft: [-1, -1], top: [0, -1], topright: [1, -1], left: [-1, 0], right: [1, 0],
  bottomleft: [-1, 1], bottom: [0, 1], bottomright: [1, 1]
}

export function mulberry32 (seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Frame {
  constructor (w, h, data) {
    this.w = w
    this.h = h
    this.data = data || new Uint8Array(w * h)
  }

  clone () {
    return new Frame(this.w, this.h, new Uint8Array(this.data))
  }

  get (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.data[y * this.w + x]
  }

  put (x, y, ci) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[y * this.w + x] = ci
  }
}

// drawing context: holds the current frame, palette, transform stack, clip, light
export class Ctx {
  constructor (frame, pal) {
    this.frame = frame
    this.pal = pal
    this.stack = []
    this.clipRect = null
    this.light = [-1, -1]
    this.iso = null
    this.paintMask = null // { mode: 'solid'|'empty'|'color', ci }
  }

  push (t) { this.stack.push(t) }
  pop () { this.stack.pop() }

  map (x, y) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const t = this.stack[i]
      if (t.flipx !== undefined) x = t.flipx - x
      if (t.flipy !== undefined) y = t.flipy - y
      x += t.dx || 0
      y += t.dy || 0
    }
    return [Math.round(x), Math.round(y)]
  }

  set (x, y, ci) {
    const [mx, my] = this.map(x, y)
    if (this.clipRect) {
      const c = this.clipRect
      if (mx < c[0] || my < c[1] || mx >= c[0] + c[2] || my >= c[1] + c[3]) return
    }
    if (this.paintMask) {
      const cur = this.frame.get(mx, my)
      const m = this.paintMask
      if (m.mode === 'solid' && cur === 0) return
      if (m.mode === 'empty' && cur !== 0) return
      if (m.mode === 'color' && cur !== m.ci) return
      if (m.mode === 'set' && !m.set.has(cur)) return
      if (m.mode === 'touching') {
        // only pixels with a 4-neighbour of the given color (as it was when the block began)
        const sn = m.snap; const w = this.frame.w; const h = this.frame.h
        const at = (px, py) => (px < 0 || py < 0 || px >= w || py >= h) ? 0 : sn[py * w + px]
        if (at(mx + 1, my) !== m.ci && at(mx - 1, my) !== m.ci && at(mx, my + 1) !== m.ci && at(mx, my - 1) !== m.ci) return
      }
    }
    this.frame.put(mx, my, ci)
  }

  getAt (x, y) {
    const [mx, my] = this.map(x, y)
    return this.frame.get(mx, my)
  }
}

// ---------- primitives ----------

export function line (ctx, x0, y0, x1, y1, ci) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  if (![x0, y0, x1, y1].every(Number.isFinite)) throw new Error(`line coordinates are not numbers: ${x0} ${y0} ${x1} ${y1}`)
  const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    ctx.set(x0, y0, ci)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

export function rect (ctx, x, y, w, h, ci) {
  for (let i = 0; i < w; i++) { ctx.set(x + i, y, ci); ctx.set(x + i, y + h - 1, ci) }
  for (let j = 1; j < h - 1; j++) { ctx.set(x, y + j, ci); ctx.set(x + w - 1, y + j, ci) }
}

export function box (ctx, x, y, w, h, ci) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) ctx.set(x + i, y + j, ci)
}

// per-row spans of a filled ellipse, the base for discs, ovals and their outlines
export function ellipseSpans (cx, cy, rx, ry) {
  const spans = []
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))
    if (t < 0) { spans.push(null); continue }
    const half = Math.floor((rx + 0.5) * Math.sqrt(t))
    spans.push([cx - half, cx + half, cy + dy])
  }
  return spans.filter(Boolean)
}

export function oval (ctx, cx, cy, rx, ry, ci) {
  for (const [x0, x1, y] of ellipseSpans(cx, cy, rx, ry)) {
    for (let x = x0; x <= x1; x++) ctx.set(x, y, ci)
  }
}

export function ellipse (ctx, cx, cy, rx, ry, ci) {
  const spans = ellipseSpans(cx, cy, rx, ry)
  for (let i = 0; i < spans.length; i++) {
    const [x0, x1, y] = spans[i]
    const prev = spans[i - 1]
    const next = spans[i + 1]
    ctx.set(x0, y, ci); ctx.set(x1, y, ci)
    // close vertical gaps where the row width jumps
    for (const nb of [prev, next]) {
      if (!nb) { for (let x = x0; x <= x1; x++) ctx.set(x, y, ci); continue }
      for (let x = x0; x < nb[0]; x++) ctx.set(x, y, ci)
      for (let x = nb[1] + 1; x <= x1; x++) ctx.set(x, y, ci)
    }
  }
}

export function disc (ctx, cx, cy, r, ci) { oval(ctx, cx, cy, r, r, ci) }
export function circle (ctx, cx, cy, r, ci) { ellipse(ctx, cx, cy, r, r, ci) }

// ellipse inscribed in a box: works for even and odd sizes alike
export function ovalBox (ctx, x, y, w, h, ci, outlineOnly = false) {
  const rows = []
  for (let j = 0; j < h; j++) {
    const ny = (j + 0.5 - h / 2) / (h / 2)
    const hw = (w / 2) * Math.sqrt(Math.max(0, 1 - ny * ny))
    let x0 = Math.ceil(w / 2 - hw - 0.5)
    let x1 = Math.floor(w / 2 + hw - 0.5)
    if (x1 < x0) { x0 = Math.floor((w - 1) / 2); x1 = Math.ceil((w - 1) / 2) }
    rows.push([x0, x1])
  }
  for (let j = 0; j < h; j++) {
    const [x0, x1] = rows[j]
    if (!outlineOnly) { for (let k = x0; k <= x1; k++) ctx.set(x + k, y + j, ci); continue }
    const prev = rows[j - 1]; const next = rows[j + 1]
    ctx.set(x + x0, y + j, ci); ctx.set(x + x1, y + j, ci)
    for (const nb of [prev, next]) {
      if (!nb) { for (let k = x0; k <= x1; k++) ctx.set(x + k, y + j, ci); continue }
      for (let k = x0; k < nb[0]; k++) ctx.set(x + k, y + j, ci)
      for (let k = nb[1] + 1; k <= x1; k++) ctx.set(x + k, y + j, ci)
    }
  }
}

export function polyline (ctx, pts, ci, close = true) {
  for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ci)
  if (close && pts.length > 2) line(ctx, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], ci)
}

export function shape (ctx, pts, ci) {
  let minY = Infinity; let maxY = -Infinity
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) }
  for (let y = Math.round(minY); y <= Math.round(maxY); y++) {
    const xs = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]; const b = pts[(i + 1) % pts.length]
      const [x0, y0] = a; const [x1, y1] = b
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0))
      }
    }
    xs.sort((p, q) => p - q)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) ctx.set(x, y, ci)
    }
  }
  polyline(ctx, pts, ci, true)
}

export function floodFill (ctx, x, y, ci) {
  const [sx, sy] = ctx.map(x, y)
  const target = ctx.frame.get(sx, sy)
  if (target === ci) return
  const q = [[sx, sy]]
  const f = ctx.frame
  while (q.length) {
    const [px, py] = q.pop()
    if (px < 0 || py < 0 || px >= f.w || py >= f.h) continue
    if (f.get(px, py) !== target) continue
    f.put(px, py, ci)
    q.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }
}

export function curve (ctx, p0, p1, p2, ci) {
  const steps = Math.max(8, Math.ceil((Math.abs(p2[0] - p0[0]) + Math.abs(p2[1] - p0[1]) + Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1])) * 2))
  let prev = null
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
    const pt = [Math.round(x), Math.round(y)]
    if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) {
      if (prev) line(ctx, prev[0], prev[1], pt[0], pt[1], ci)
      else ctx.set(pt[0], pt[1], ci)
      prev = pt
    }
  }
}

export function arc (ctx, cx, cy, r, a0, a1, ci) {
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 180 * Math.PI * r * 2))
  let prev = null
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + (a1 - a0) * (i / steps)) * Math.PI / 180
    const pt = [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]
    if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) {
      if (prev) line(ctx, prev[0], prev[1], pt[0], pt[1], ci)
      else ctx.set(pt[0], pt[1], ci)
      prev = pt
    }
  }
}

// ---------- pixel-art helpers ----------

export function ditherRegion (ctx, x, y, w, h, ciA, ciB, pattern = 'bayer4', level = 0.5, oval = false) {
  if (FIXED[pattern]) {
    const fm = FIXED[pattern]; const fn = fm.length
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (oval) {
          const ex = (i + 0.5 - w / 2) / (w / 2); const ey = (j + 0.5 - h / 2) / (h / 2)
          if (ex * ex + ey * ey > 1) continue
        }
        const px = x + i; const py = y + j
        const bit = level <= 0 ? 0 : level >= 1 ? 1 : fm[((py % fn) + fn) % fn][((px % fn) + fn) % fn]
        ctx.set(px, py, bit ? ciB : ciA)
      }
    }
    return
  }
  const m = BAYER[pattern]
  if (!m) throw new Error('unknown dither pattern: ' + pattern + ' (have: ' + Object.keys(BAYER).concat(Object.keys(FIXED)).join(', ') + ')')
  const n = m.length
  const max = n * n
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i; const py = y + j
      if (oval) {
        const ex = (i + 0.5 - w / 2) / (w / 2); const ey = (j + 0.5 - h / 2) / (h / 2)
        if (ex * ex + ey * ey > 1) continue
      }
      const th = (m[((py % n) + n) % n][((px % n) + n) % n] + 0.5) / max
      ctx.set(px, py, th < level ? ciB : ciA)
    }
  }
}

// pixel-art lighting: shift existing pixels up (glow) or down (shade) their own ramp,
// strongest in the center of the ellipse, dithered toward the edge
export function rampShift (ctx, pal, cx, cy, rx, ry, steps, pattern = 'bayer4', falloff = 1, hard = false) {
  const m = BAYER[pattern] || BAYER.bayer4
  const n = m.length
  const cache = new Map()
  // pattern phase follows canvas coordinates so shifted groups keep a stable dither
  const writes = []
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const d = Math.sqrt(((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2)
      if (d > 1) continue
      const cur = ctx.getAt(x, y)
      if (cur === 0) continue
      // solid core, then a dithered ring whose density fades to zero at the rim
      const core = 0.55 / falloff
      if (!hard && d > core) {
        const density = Math.pow(1 - (d - core) / (1 - core), falloff) * 0.5
        const th = (m[((y % n) + n) % n][((x % n) + n) % n] + 0.5) / (n * n)
        if (th >= density) continue
      }
      let r = cache.get(cur)
      if (r === undefined) { r = pal.rampOf(cur); cache.set(cur, r) }
      if (!r) continue
      const pos = Math.max(0, Math.min(r.idx.length - 1, r.pos + steps))
      if (r.idx[pos] !== cur) writes.push([x, y, r.idx[pos]])
    }
  }
  for (const [x, y, ci] of writes) ctx.set(x, y, ci)
}

export function gradientRegion (ctx, x, y, w, h, rampIdx, dir = 'v', pattern = 'none') {
  const steps = rampIdx.length
  const len = dir === 'h' ? w : dir === 'd' ? w + h : h
  const m = pattern !== 'none' ? (BAYER[pattern] || BAYER.bayer2) : null
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const pos = dir === 'h' ? i : dir === 'd' ? i + j : j
      let t = len <= 1 ? 0 : pos / (len - 1)
      t = Math.max(0, Math.min(1, t))
      const f = t * (steps - 1)
      let k = Math.floor(f)
      const frac = f - k
      if (m) {
        const n = m.length
        const th = (m[(y + j) % n < 0 ? 0 : (y + j) % n][(x + i) % n < 0 ? 0 : (x + i) % n] + 0.5) / (n * n)
        if (frac > th) k += 1
      } else {
        if (frac >= 0.5) k += 1
      }
      k = Math.max(0, Math.min(steps - 1, k))
      ctx.set(x + i, y + j, rampIdx[k])
    }
  }
}

// shaded ball: lambert quantised into ramp bands, sharp terminator,
// contiguous bounce-light rim on the shadow side, optional specular dot
export function sphere (ctx, cx, cy, r, rampIdx, light, opts = {}) {
  const steps = rampIdx.length
  const lz = 0.72
  const ln = Math.hypot(light[0], light[1], lz) || 1
  const L = [light[0] / ln, light[1] / ln, lz / ln]
  const bounce = opts.bounce !== false && r >= 4
  const spec = opts.spec !== false && r >= 6
  const spans = ellipseSpans(cx, cy, r, r)
  const inside = new Set()
  const band = new Map()
  for (const [x0, x1, y] of spans) {
    for (let x = x0; x <= x1; x++) {
      inside.add(x + ',' + y)
      const nx = (x - cx) / (r + 0.5)
      const ny = (y - cy) / (r + 0.5)
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const lam = nx * L[0] + ny * L[1] + nz * L[2]
      const t = Math.max(0, Math.min(1, (lam + 1) / 2))
      const shaped = Math.pow(Math.max(0, Math.min(1, (t - 0.30) / 0.55)), 1.28)
      const k = Math.max(0, Math.min(steps - 1, Math.round(shaped * (steps - 1))))
      band.set(x + ',' + y, k)
    }
  }
  if (bounce) {
    for (const key of inside) {
      if (band.get(key) !== 0) continue
      const [x, y] = key.split(',').map(Number)
      // rim pixels on the side facing away from the light catch bounced light
      const edge = !inside.has((x + 1) + ',' + y) || !inside.has((x - 1) + ',' + y) ||
        !inside.has(x + ',' + (y + 1)) || !inside.has(x + ',' + (y - 1))
      const away = (x - cx) * -light[0] + (y - cy) * -light[1] > 0
      if (edge && away) band.set(key, 1)
    }
  }
  // de-speckle: a lone band pixel surrounded by one other band is an artifact
  for (const key of inside) {
    const [x, y] = key.split(',').map(Number)
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => band.get((x + dx) + ',' + (y + dy)))
      .filter(v => v !== undefined)
    if (nb.length >= 2 && nb.every(v => v === nb[0]) && nb[0] !== band.get(key)) band.set(key, nb[0])
  }
  for (const [key, k] of band) {
    const [x, y] = key.split(',').map(Number)
    ctx.set(x, y, rampIdx[k])
  }
  if (spec) {
    const sx = Math.round(cx + light[0] * r * 0.42)
    const sy = Math.round(cy + light[1] * r * 0.42)
    ctx.set(sx, sy, rampIdx[steps - 1])
    if (r >= 9) {
      ctx.set(sx + (light[0] >= 0 ? 1 : -1), sy, rampIdx[steps - 1])
      ctx.set(sx, sy + (light[1] >= 0 ? 1 : -1), rampIdx[steps - 1])
    }
  }
}

// shaded tube. axis 'v' = vertical tube (shading varies across x)
export function cylinder (ctx, x, y, w, h, rampIdx, light, axis = 'v', ends = 'flat', topCi = null) {
  const steps = rampIdx.length
  // round ends: the body follows an ellipse at top and bottom (iso barrels, towers)
  const ry = ends === 'round' && axis === 'v' ? Math.max(1, Math.round(w / 4)) : 0
  const lz = 0.72
  const ldir = axis === 'v' ? light[0] : light[1]
  const ln = Math.hypot(ldir, lz) || 1
  const Lx = ldir / ln
  const Lz = lz / ln
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const span = axis === 'v' ? w : h
      const pos = axis === 'v' ? i : j
      const n = span <= 1 ? 0 : (pos / (span - 1)) * 2 - 1
      const nz = Math.sqrt(Math.max(0, 1 - n * n))
      const lam = n * Lx + nz * Lz
      const t = Math.max(0, Math.min(1, (lam + 1) / 2))
      let k = Math.round(Math.max(0, Math.min(1, (t - 0.25) / 0.72)) * (steps - 1))
      if (k === 0 && Math.abs(n) > 0.9) k = 1 // bounce light on the far rim
      if (ry) {
        const nn = (i + 0.5 - w / 2) / (w / 2)
        const e = ry * Math.sqrt(Math.max(0, 1 - nn * nn))
        if (j < ry - e || j > h - 1 - ry + e) continue
      }
      ctx.set(x + i, y + j, rampIdx[Math.max(0, Math.min(steps - 1, k))])
    }
  }
  if (ry && topCi !== null) ovalBox(ctx, x, y, w, ry * 2, topCi)
}

export function replaceColor (frame, a, b) {
  for (let i = 0; i < frame.data.length; i++) if (frame.data[i] === a) frame.data[i] = b
}

// outline around every non-transparent pixel. mode 'dark' uses one color,
// mode 'selout' takes a darker shade from the ramp of the touched pixels.
export function outline (frame, pal, { ci = null, mode = 'dark', diagonal = false, light = [-1, -1], shade = 2, fallback = null, region = null } = {}) {
  const src = new Uint8Array(frame.data)
  // with a region (the active clip) only that object is outlined
  if (region) {
    const [rx, ry, rw, rh] = region
    for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) src[y * frame.w + x] = 0
  }
  const inR = (x, y) => !region || (x >= region[0] && y >= region[1] && x < region[0] + region[2] && y < region[1] + region[3])
  const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const n8 = n4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]])
  const nbs = diagonal ? n8 : n4
  const placed = []
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      if (src[y * frame.w + x] !== 0) continue
      if (!inR(x, y)) continue
      if (region && frame.get(x, y) !== 0) continue // never paint over neighbours outside the object
      const votes = new Map()
      let lit = false
      for (const [dx, dy] of nbs) {
        const px = x + dx; const py = y + dy
        if (px < 0 || py < 0 || px >= frame.w || py >= frame.h) continue
        const v = src[py * frame.w + px]
        if (v === 0) continue
        votes.set(v, (votes.get(v) || 0) + 1)
        // the solid pixel sits toward the light from here -> this outline pixel is lit
        if (dx === -light[0] && dy === -light[1]) lit = true
        if (dx === -light[0] && dy === 0 && light[0] !== 0) lit = true
        if (dy === -light[1] && dx === 0 && light[1] !== 0) lit = true
      }
      if (!votes.size) continue
      if (mode !== 'selout') { frame.put(x, y, ci); continue }
      // majority neighbour wins, ties go to the darker color: fewer speckles at junctions
      let touch = 0; let best = -1
      for (const [v, cnt] of votes) {
        if (cnt > best || (cnt === best && luma(pal.rgb(v)) < luma(pal.rgb(touch)))) { best = cnt; touch = v }
      }
      const r = pal.rampOf(touch)
      const want = lit ? Math.max(1, shade - 1) : shade
      let oc
      if (r && r.pos - want >= 0) {
        oc = r.idx[r.pos - want]
      } else if (fallback !== null) {
        oc = fallback
      } else {
        // already the darkest step: derive a deeper shade so the edge stays visible
        const base = r ? pal.rgb(r.idx[0]) : pal.rgb(touch)
        oc = pal.addHex(require_hex(base, lit ? 0.7 : 0.55))
      }
      frame.put(x, y, oc)
      placed.push([x, y])
    }
  }
  // tidy: a selout pixel that ended up alone takes the color of its outline neighbours
  if (mode === 'selout') {
    const isPlaced = new Set(placed.map(([x, y]) => x + ',' + y))
    for (const [x, y] of placed) {
      const v = frame.get(x, y)
      const same = n4.some(([dx, dy]) => frame.get(x + dx, y + dy) === v)
      if (same) continue
      const votes = new Map()
      for (const [dx, dy] of n8) {
        if (!isPlaced.has((x + dx) + ',' + (y + dy))) continue
        const w = frame.get(x + dx, y + dy)
        votes.set(w, (votes.get(w) || 0) + 1)
      }
      let best = 0; let pick = v
      for (const [w, cnt] of votes) if (cnt > best) { best = cnt; pick = w }
      frame.put(x, y, pick)
    }
  }
}

function require_hex (rgb, f) {
  return '#' + rgb.map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('')
}

// manual-style anti-aliasing: softens staircase corners with an in-between palette color.
// only touches steps of 2+ pixels, never 45 degree or straight runs.
export function antialias (frame, pal, { strength = 1, inner = false, region = null } = {}) {
  const w = frame.w; const h = frame.h
  const src = new Uint8Array(frame.data)
  if (region) {
    const [rx, ry, rw, rh] = region
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) src[y * w + x] = 0
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[y * w + x]
  const added = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y) !== 0) continue
      // corner test: two orthogonal neighbours solid and of the same color,
      // with the diagonal between them empty -> outer staircase corner
      const r = at(x + 1, y); const l = at(x - 1, y); const d = at(x, y + 1); const u = at(x, y - 1)
      const pairs = [[r, d, 1, 1], [r, u, 1, -1], [l, d, -1, 1], [l, u, -1, -1]]
      for (const [a, b, dx, dy] of pairs) {
        if (a === 0 || b === 0 || a !== b) continue
        if (at(x + dx, y + dy) !== 0) continue
        // step length check: require a run of 2+ along one of the two axes
        const runX = at(x + dx * 2, y) !== 0 ? 1 : 0
        const runY = at(x, y + dy * 2) !== 0 ? 1 : 0
        if (!runX && !runY) continue
        const base = pal.rgb(a)
        const blend = mix(base, [base[0] * 0.45, base[1] * 0.45, base[2] * 0.5], strength * 0.55)
        added.push([x, y, nearestOrAdd(pal, blend)])
        break
      }
    }
  }
  for (const [x, y, ci] of added) if (!region || frame.get(x, y) === 0) frame.put(x, y, ci)
  if (inner) { /* reserved: inner AA pass */ }
}

function nearestOrAdd (pal, rgb) {
  const i = nearest(pal.colors, rgb)
  if (i > 0) {
    const c = pal.rgb(i)
    const d = Math.abs(c[0] - rgb[0]) + Math.abs(c[1] - rgb[1]) + Math.abs(c[2] - rgb[2])
    if (d < 48) return i
  }
  return pal.addHex(toHexLocal(rgb))
}

function toHexLocal (rgb) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function dropShadow (frame, dx, dy, ci) {
  const src = new Uint8Array(frame.data)
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      if (src[y * frame.w + x] === 0) continue
      const tx = x + dx; const ty = y + dy
      if (tx < 0 || ty < 0 || tx >= frame.w || ty >= frame.h) continue
      if (src[ty * frame.w + tx] === 0) frame.put(tx, ty, ci)
    }
  }
}

export function mirrorFrame (frame, axis, split) {
  if (axis === 'x') {
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < split; x++) {
        const v = frame.get(x, y)
        frame.put(2 * split - 1 - x, y, v)
      }
    }
  } else {
    for (let x = 0; x < frame.w; x++) {
      for (let y = 0; y < split; y++) frame.put(x, 2 * split - 1 - y, frame.get(x, y))
    }
  }
}

export function copyRegion (ctx, sx, sy, w, h, dx, dy, { flipx = false, flipy = false, skipEmpty = true } = {}) {
  const buf = []
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) buf.push(ctx.frame.get(sx + i, sy + j))
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = buf[j * w + i]
      if (skipEmpty && v === 0) continue
      const tx = dx + (flipx ? w - 1 - i : i)
      const ty = dy + (flipy ? h - 1 - j : j)
      ctx.set(tx, ty, v)
    }
  }
}

export function scatter (ctx, x, y, w, h, ci, count, seed, targetCi = null) {
  const rnd = mulberry32(seed)
  let placed = 0
  let guard = count * 40 + 100
  while (placed < count && guard-- > 0) {
    const px = x + Math.floor(rnd() * w)
    const py = y + Math.floor(rnd() * h)
    if (targetCi !== null && ctx.getAt(px, py) !== targetCi) continue
    ctx.set(px, py, ci)
    placed++
  }
}

// ---------- isometric ----------

// rows of a 2:1 diamond whose top corner sits at (cx, cy). returns [ [x0,x1,y], ... ]
export function diamondRows (cx, cy, tw, th) {
  const rows = []
  const half = th / 2
  for (let i = 0; i < th; i++) {
    const d = i < half ? i : th - 1 - i
    const width = Math.round((tw / th) * 2 * d + 2)
    const left = Math.round(cx + tw / 2 - width / 2)
    rows.push([left, left + width - 1, cy + i])
  }
  return rows
}

export function isoTile (ctx, cx, cy, tw, th, ci) {
  for (const [x0, x1, y] of diamondRows(cx, cy, tw, th)) {
    for (let x = x0; x <= x1; x++) ctx.set(x, y, ci)
  }
}

// fill a convex polygon by pixel-center sampling. with 2:1 edges through integer
// corners this gives the exact 2-2-2 staircase and shared edges never leave seams.
export function fillConvex (ctx, pts, ci) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  // winding of the polygon
  let area = 0
  for (let k = 0; k < pts.length; k++) {
    const [x0, y0] = pts[k]; const [x1, y1] = pts[(k + 1) % pts.length]
    area += x0 * y1 - x1 * y0
  }
  const sgn = area >= 0 ? 1 : -1
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x < Math.ceil(maxX); x++) {
      const px = x + 0.5; const py = y + 0.5
      let inside = true
      for (let k = 0; k < pts.length && inside; k++) {
        const [x0, y0] = pts[k]; const [x1, y1] = pts[(k + 1) % pts.length]
        const cr = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)
        if (cr * sgn < 0) inside = false
      }
      if (inside) ctx.set(x, y, ci)
    }
  }
}

// screen point of grid corner (gx, gy): the top vertex of tile (gx, gy)
export function isoPoint (iso, gx, gy) {
  return [iso.ox + (gx - gy) * (iso.tw / 2), iso.oy + (gx + gy) * (iso.th / 2)]
}

// cuboid over a footprint of w x d tiles (fractions allowed), h px tall.
// faces are filled polygons, so neighbouring prisms share edges without seams.
export function isoPrism (ctx, iso, gx, gy, w, d, h, lift, top, left, right) {
  const up = (p, k) => [p[0], p[1] - k]
  const A = up(isoPoint(iso, gx, gy), lift + h)
  const B = up(isoPoint(iso, gx + w, gy), lift + h)
  const C = up(isoPoint(iso, gx + w, gy + d), lift + h)
  const D = up(isoPoint(iso, gx, gy + d), lift + h)
  if (h > 0) {
    fillConvex(ctx, [D, C, [C[0], C[1] + h], [D[0], D[1] + h]], left)
    fillConvex(ctx, [C, B, [B[0], B[1] + h], [C[0], C[1] + h]], right)
  }
  if (top !== null) fillConvex(ctx, [A, B, C, D], top)
}

// floor shadow cast by a w x d x h prism, away from the light: shifts the floor
// pixels down their ramp (or paints a color) inside the swept footprint
export function isoShadow (ctx, pal, iso, gx, gy, w, d, h, light, len, steps, color) {
  const pts = [isoPoint(iso, gx, gy), isoPoint(iso, gx + w, gy), isoPoint(iso, gx + w, gy + d), isoPoint(iso, gx, gy + d)]
  const ln = Math.hypot(light[0], light[1]) || 1
  const vx = (-light[0] / ln) * h * len
  const vy = (-light[1] / ln) * h * len * 0.5
  const all = pts.concat(pts.map(([x, y]) => [x + vx, y + vy]))
  const hull = convexHull(all)
  const mark = new Ctx(new Frame(ctx.frame.w, ctx.frame.h), pal)
  mark.stack = ctx.stack
  fillConvex(mark, hull, 1)
  for (let y = 0; y < mark.frame.h; y++) {
    for (let x = 0; x < mark.frame.w; x++) {
      if (!mark.frame.get(x, y)) continue
      const cur = ctx.frame.get(x, y)
      if (cur === 0) continue
      if (color !== null) { ctx.frame.put(x, y, color); continue }
      const r = pal.rampOf(cur)
      if (!r) continue
      ctx.frame.put(x, y, r.idx[Math.max(0, r.pos - steps)])
    }
  }
}

function convexHull (pts) {
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  const upper = []
  for (const q of p.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

// exact 2:1 staircase, len pixels wide, dir se | sw | ne | nw
export function isoLine (ctx, x, y, len, dir, ci) {
  const sx = dir === 'se' || dir === 'ne' ? 1 : -1
  const sy = dir === 'se' || dir === 'sw' ? 1 : -1
  for (let k = 0; k < len; k++) ctx.set(x + sx * k, y + sy * Math.floor(k / 2), ci)
}

export function isoGridPos (iso, gx, gy) {
  return [
    iso.ox + (gx - gy) * (iso.tw / 2) - iso.tw / 2,
    iso.oy + (gx + gy) * (iso.th / 2)
  ]
}

export function valueChar (pal, ci) {
  if (ci === 0) return '.'
  const v = luma(pal.rgb(ci)) / 255
  const ramp = ' .:-=+*#%@'
  return ramp[Math.max(1, Math.min(ramp.length - 1, Math.round(v * (ramp.length - 1))))]
}
