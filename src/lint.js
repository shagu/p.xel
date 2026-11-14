// machine-checkable craft rules. the guardrail against the usual AI pixel-art failures.

import { luma, toHex } from './color.js'

function clusters (f) {
  const seen = new Uint8Array(f.data.length)
  const out = []
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const idx = y * f.w + x
      if (seen[idx]) continue
      const v = f.data[idx]
      if (v === 0) { seen[idx] = 1; continue }
      const stack = [[x, y]]
      const cells = []
      seen[idx] = 1
      while (stack.length) {
        const [cx, cy] = stack.pop()
        cells.push([cx, cy])
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx; const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue
          const ni = ny * f.w + nx
          if (seen[ni] || f.data[ni] !== v) continue
          seen[ni] = 1
          stack.push([nx, ny])
        }
      }
      out.push({ color: v, cells })
    }
  }
  return out
}

// a lone pixel whose diagonal neighbours share its color is part of a dither pattern,
// not an accidental orphan
function looksDithered (f, x, y, v) {
  let diag = 0
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (f.get(x + dx, y + dy) === v) diag++
  return diag >= 2
}

function bbox (f) {
  let minX = f.w; let minY = f.h; let maxX = -1; let maxY = -1
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if (f.get(x, y) === 0) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

// a banding seam: two colors whose boundary runs along the same diagonal for many steps
function bandingRuns (f, minLen = 6) {
  const runs = []
  for (let y = 0; y < f.h - 1; y++) {
    for (let x = 0; x < f.w - 1; x++) {
      const a = f.get(x, y); const b = f.get(x + 1, y)
      if (a === 0 || b === 0 || a === b) continue
      // dither patterns are full of short diagonal boundaries: not banding
      if (looksDithered(f, x, y, a) || looksDithered(f, x + 1, y, b)) continue
      let len = 0
      let cx = x; let cy = y
      while (cy < f.h && cx >= 0 && cx + 1 < f.w && f.get(cx, cy) === a && f.get(cx + 1, cy) === b) {
        len++; cy++; cx--
      }
      if (len >= minLen) runs.push({ x, y, len, dir: 'dl' })
      len = 0; cx = x; cy = y
      while (cy < f.h && cx + 1 < f.w && f.get(cx, cy) === a && f.get(cx + 1, cy) === b) {
        len++; cy++; cx++
      }
      if (len >= minLen) runs.push({ x, y, len, dir: 'dr' })
    }
  }
  // dedupe overlapping reports, keep the longest few
  runs.sort((p, q) => q.len - p.len)
  return runs.slice(0, 6)
}

export function lint (doc, { maxColors = 24, orphanLimit = 0, strict = false } = {}) {
  if (doc.lintCfg && doc.lintCfg.maxColors) maxColors = doc.lintCfg.maxColors
  const allowed = doc.lintCfg ? doc.lintCfg.allowOrphans : new Set()
  const warn = []
  const info = []

  const used = new Set()
  for (const rec of doc.frames) for (const v of rec.frame.data) used.add(v)
  used.delete(0)
  info.push(`colors used: ${used.size} / palette ${doc.pal.colors.length - 1}`)
  if (used.size > maxColors) warn.push(`palette bloat: ${used.size} colors used, budget is ${maxColors}. merge near-identical shades.`)
  const unused = []
  for (let i = 1; i < doc.pal.colors.length; i++) if (!used.has(i)) unused.push(doc.pal.nameOf(i))
  if (unused.length) info.push(`declared but unused: ${unused.slice(0, 12).join(', ')}${unused.length > 12 ? ' ...' : ''}`)

  // value structure
  const lums = [...used].map(ci => luma(doc.pal.rgb(ci)))
  if (lums.length) {
    const lo = Math.min(...lums); const hi = Math.max(...lums)
    info.push(`value range: ${Math.round(lo)}..${Math.round(hi)} of 255`)
    if (hi - lo < 70) warn.push('low value contrast: the sprite will not read at 1x. push the darkest and lightest steps apart.')
  }

  const regions = doc.lintCfg ? doc.lintCfg.regions : []
  const inRegion = (x, y) => regions.some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh)
  const boxes = []
  for (const [fi, rec] of doc.frames.entries()) {
    const f = rec.frame
    const cs = clusters(f)
    // an orphan has no same-color pixel among its 8 neighbours
    const isolated = (x, y, v) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && f.get(x + dx, y + dy) === v) return false
      return true
    }
    // lone pixels that repeat in a pattern nearby are dithering, not accidents
    const lone = new Set(cs.filter(c => c.cells.length === 1).map(c => c.cells[0][0] + ',' + c.cells[0][1]))
    const patterned = (x, y, v) => {
      let k = 0
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if ((dx || dy) && lone.has((x + dx) + ',' + (y + dy)) && f.get(x + dx, y + dy) === v) k++
        }
      }
      return k >= 3
    }
    const orphans = cs.filter(c => {
      if (c.cells.length !== 1 || allowed.has(c.color) || (doc.lintCfg && doc.lintCfg.orphansOff)) return false
      const [x, y] = c.cells[0]
      return isolated(x, y, c.color) && !inRegion(x, y) && !patterned(x, y, c.color)
    })
    const bb = bbox(f)
    boxes.push(bb)
    if (!bb) { warn.push(`frame ${fi}: empty`); continue }
    const fillRatio = cs.reduce((n, c) => n + c.cells.length, 0) / (bb.w * bb.h)
    info.push(`frame ${fi}: clusters=${cs.length} orphans=${orphans.length} bbox=${bb.x},${bb.y} ${bb.w}x${bb.h} fill=${(fillRatio * 100).toFixed(0)}%`)
    if (orphans.length > orphanLimit) {
      const list = orphans.slice(0, 16).map(o => `${o.cells[0][0]},${o.cells[0][1]}(${doc.pal.nameOf(o.color)})`).join(' ')
      const byColor = new Map()
      for (const o of orphans) byColor.set(doc.pal.nameOf(o.color), (byColor.get(doc.pal.nameOf(o.color)) || 0) + 1)
      const summary = [...byColor].sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${v}`).join(', ')
      warn.push(`frame ${fi}: ${orphans.length} orphan pixel(s) [${summary}]: ${list}${orphans.length > 16 ? ' ...' : ''}`)
    }
    const bands = bandingRuns(f).filter(b => !inRegion(b.x, b.y))
    if (bands.length) {
      warn.push(`frame ${fi}: possible banding seam(s) at ${bands.map(b => `${b.x},${b.y} len${b.len}`).join(' ')} - interlock or compress the bands.`)
    }
    if (bb.x === 0 || bb.y === 0 || bb.x + bb.w === f.w || bb.y + bb.h === f.h) {
      info.push(`frame ${fi}: touches the canvas edge (fine for tiles and scenes, suspicious for sprites)`)
    }
  }

  // motion: compare neighbours inside each tag (or the whole sequence) plus the loop seam
  const motionOn = !doc.lintCfg || doc.lintCfg.motion !== false
  const seqs = doc.tags.length ? doc.tags.filter(t => !t.list).map(t => ({ name: t.name, from: t.from, to: t.to })) : [{ name: 'all', from: 0, to: doc.frames.length - 1 }]
  const compare = (a, b, label) => {
    const fa = doc.frames[a].frame; const fb = doc.frames[b].frame
    const ba = boxes[a]; const bb = boxes[b]
    if (!ba || !bb) return
    let changed = 0
    for (let k = 0; k < fa.data.length; k++) if (fa.data[k] !== fb.data[k]) changed++
    // the ground line is what must stay put; squash and stretch may move the top and sides
    const shift = Math.abs((ba.y + ba.h) - (bb.y + bb.h))
    const cxa = ba.x + ba.w / 2; const cxb = bb.x + bb.w / 2
    const drift = Math.abs(cxa - cxb)
    info.push(`${label}: ${changed} px changed, ground shift ${shift}, center drift ${drift}`)
    if (changed === 0) warn.push(`${label}: identical frames (use a longer dur= instead)`)
    if (motionOn && (shift > Math.max(2, Math.round(fa.h * 0.1)) || drift > Math.max(3, fa.w * 0.15))) {
      warn.push(`${label}: anchor jump (ground ${shift}px, center ${drift}px) - the sprite will jitter unless this is a deliberate hop or step. silence with: lint motion=off`)
    }
  }
  if (doc.frames.length > 1) {
    for (const sq of seqs) {
      for (let k = sq.from + 1; k <= sq.to && k < doc.frames.length; k++) compare(k - 1, k, `${sq.name} ${k - 1}->${k}`)
      if (sq.to > sq.from && sq.to < doc.frames.length) compare(sq.to, sq.from, `${sq.name} loop ${sq.to}->${sq.from}`)
      // walks and runs need a body bob: the top of the sprite must move
      if (motionOn && /walk|run/i.test(sq.name) && sq.to > sq.from) {
        const tops = []
        for (let k = sq.from; k <= sq.to && k < doc.frames.length; k++) if (boxes[k]) tops.push(boxes[k].y)
        if (tops.length > 1 && Math.max(...tops) === Math.min(...tops)) {
          warn.push(`${sq.name}: no body bob (the top edge never moves). sink 1px on down/step frames, rise on up frames.`)
        } else if (tops.length > 1) info.push(`${sq.name}: body bob ${Math.max(...tops) - Math.min(...tops)}px`)
      }
    }
  }

  if (strict && warn.length) warn.push('strict mode: fix the warnings above before shipping')
  return { warn, info }
}

export function report (doc, opts) {
  const { warn, info } = lint(doc, opts)
  const out = []
  out.push('--- lint ---')
  for (const l of info) out.push('info: ' + l)
  for (const l of warn) out.push('WARN: ' + l)
  if (!warn.length) out.push('ok: no warnings')
  return { text: out.join('\n'), warnings: warn.length }
}

export function paletteReport (doc) {
  const lines = ['--- palette ---']
  for (const [name, idx] of doc.pal.ramps) {
    lines.push(`ramp ${name}: ` + idx.map((ci, k) => `${k}:${toHex(doc.pal.rgb(ci))}`).join(' '))
  }
  for (const [name, ci] of doc.pal.names) {
    if (ci === 0) continue
    if (name.includes('.')) continue
    if (doc.pal.ramps.has(name)) continue
    lines.push(`color ${name}: ${toHex(doc.pal.rgb(ci))}`)
  }
  return lines.join('\n')
}
