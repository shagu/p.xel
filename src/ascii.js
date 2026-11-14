// LLM-readable previews: every palette color becomes one character.

import { luma, toHex } from './color.js'

const CHARS = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0!$%&*+-/:;<=>?@^_~[]{}|()\'",`'

export function charTable (doc) {
  // reuse the file's own map chars where possible so previews round-trip into art blocks
  const table = new Map([[0, '.']])
  const used = new Set(['.', ' '])
  for (const [ch, tok] of doc.charMap) {
    try {
      const ci = doc.pal.resolve(tok)
      if (!table.has(ci) && !used.has(ch)) { table.set(ci, ch); used.add(ch) }
    } catch { /* ignore unresolvable map entries */ }
  }
  let k = 0
  for (let ci = 1; ci < doc.pal.colors.length; ci++) {
    if (table.has(ci)) continue
    while (used.has(CHARS[k]) && k < CHARS.length) k++
    const ch = CHARS[k] || '?'
    used.add(ch)
    table.set(ci, ch)
  }
  return table
}

function ruler (w, pad) {
  const tens = ' '.repeat(pad) + Array.from({ length: w }, (_, x) => (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ')).join('')
  const ones = ' '.repeat(pad) + Array.from({ length: w }, (_, x) => String(x % 10)).join('')
  return [tens, ones]
}

export function renderAscii (doc, { mode = 'palette', frame = 0, ruler: showRuler = true, legend = true } = {}) {
  const rec = doc.frames[frame]
  if (!rec) throw new Error('no such frame: ' + frame)
  const f = rec.frame
  const table = charTable(doc)
  const lines = []
  const pad = showRuler ? String(f.h - 1).length + 1 : 0
  if (showRuler && f.w <= 120) lines.push(...ruler(f.w, pad))
  for (let y = 0; y < f.h; y++) {
    let row = ''
    for (let x = 0; x < f.w; x++) {
      const ci = f.get(x, y)
      if (mode === 'mask') row += ci === 0 ? '.' : '#'
      else if (mode === 'value') row += ci === 0 ? '.' : String(Math.max(0, Math.min(9, Math.round(luma(doc.pal.rgb(ci)) / 255 * 9))))
      else row += table.get(ci) || '?'
    }
    lines.push((showRuler && f.w <= 120 ? String(y).padStart(pad - 1) + ' ' : '') + row)
  }
  let out = lines.join('\n')
  if (legend && mode === 'palette') {
    const keys = []
    const seen = new Set()
    for (let y = 0; y < f.h * f.w; y++) seen.add(f.data[y])
    for (const [ci, ch] of table) {
      if (!seen.has(ci)) continue
      keys.push(`${ch} = ${ci === 0 ? 'transparent' : doc.pal.nameOf(ci) + ' ' + toHex(doc.pal.rgb(ci))}`)
    }
    out += '\n\nlegend: ' + keys.join(' | ')
  }
  return out
}

export function stats (doc) {
  const lines = []
  lines.push(`canvas: ${doc.w}x${doc.h}  frames: ${doc.frames.length}  light: ${doc.lightName}`)
  const usedAll = new Set()
  for (const rec of doc.frames) for (const v of rec.frame.data) usedAll.add(v)
  usedAll.delete(0)
  lines.push(`colors in palette: ${doc.pal.colors.length - 1}  used: ${usedAll.size}`)
  for (const [i, rec] of doc.frames.entries()) {
    const f = rec.frame
    let count = 0
    let minX = f.w; let minY = f.h; let maxX = -1; let maxY = -1
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (f.get(x, y) === 0) continue
        count++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    const bbox = maxX < 0 ? 'empty' : `${minX},${minY} ${maxX - minX + 1}x${maxY - minY + 1}`
    lines.push(`  frame ${i} (${rec.name}) dur=${rec.dur}ms pixels=${count} bbox=${bbox}`)
  }
  if (doc.tags.length) lines.push('tags: ' + doc.tags.map(t => `${t.name}[${t.from}..${t.to}]`).join(' '))
  return lines.join('\n')
}
