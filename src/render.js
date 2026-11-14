// turning frames into files: png, animated gif, sprite sheets

import { encodePNG } from './png.js'
import { encodeGIF } from './gif.js'
import { Frame } from './canvas.js'

export function frameToRGBA (frame, pal, scale = 1, bg = null) {
  const w = frame.w * scale
  const h = frame.h * scale
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const ci = frame.get(x, y)
      let r = 0; let g = 0; let b = 0; let al = 0
      if (ci === 0) {
        if (bg) { [r, g, b] = bg; al = 255 }
      } else {
        [r, g, b] = pal.rgb(ci); al = 255
      }
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const o = ((y * scale + sy) * w + x * scale + sx) * 4
          out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = al
        }
      }
    }
  }
  return { rgba: out, w, h }
}

export function pngBuffer (frame, pal, scale = 1, bg = null) {
  const { rgba, w, h } = frameToRGBA(frame, pal, scale, bg)
  return encodePNG(rgba, w, h)
}

export function scaleIndices (frame, scale) {
  if (scale === 1) return frame
  const out = new Frame(frame.w * scale, frame.h * scale)
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      out.put(x, y, frame.get(Math.floor(x / scale), Math.floor(y / scale)))
    }
  }
  return out
}

export function gifBuffer (frames, pal, scale = 1, loop = 0, bgIndex = null) {
  const palette = pal.colors.map((c, i) => i === 0 ? (bgIndex ? pal.rgb(bgIndex) : [0, 0, 0]) : c)
  const scaled = frames.map(f => ({ indices: scaleIndices(f.frame, scale).data, delay: f.dur }))
  const w = frames[0].frame.w * scale
  const h = frames[0].frame.h * scale
  return encodeGIF(scaled, palette, w, h, loop)
}

export function sheetFrame (frames, { cols = 0, pad = 0, bgIndex = 0 } = {}) {
  const n = frames.length
  const c = cols > 0 ? cols : Math.min(n, 8)
  const rows = Math.ceil(n / c)
  const fw = frames[0].frame.w
  const fh = frames[0].frame.h
  const w = c * fw + (c - 1) * pad
  const h = rows * fh + (rows - 1) * pad
  const out = new Frame(w, h)
  if (bgIndex) out.data.fill(bgIndex)
  frames.forEach((rec, i) => {
    const gx = (i % c) * (fw + pad)
    const gy = Math.floor(i / c) * (fh + pad)
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const v = rec.frame.get(x, y)
        if (v === 0 && !bgIndex) continue
        out.put(gx + x, gy + y, v)
      }
    }
  })
  return { frame: out, cols: c, rows, cellW: fw, cellH: fh }
}

export function selectFrames (doc, tag) {
  if (!tag) return doc.frames
  const t = doc.tags.find(x => x.name === tag)
  if (!t) throw new Error('unknown tag: ' + tag)
  if (t.list) return t.list.map(k => doc.frames[k]).filter(Boolean)
  return doc.frames.slice(t.from, t.to + 1)
}

// one tag per row, columns = longest tag
export function sheetRows (doc, tagNames, { pad = 0 } = {}) {
  const rowsF = tagNames.map(n => selectFrames(doc, n))
  const cols = Math.max(...rowsF.map(r => r.length))
  const fw = doc.w; const fh = doc.h
  const out = new Frame(cols * fw + (cols - 1) * pad, rowsF.length * fh + (rowsF.length - 1) * pad)
  rowsF.forEach((list, r) => list.forEach((rec, c) => {
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const v = rec.frame.get(x, y)
        if (v) out.put(c * (fw + pad) + x, r * (fh + pad) + y, v)
      }
    }
  }))
  return { frame: out, cols, rows: rowsF.length, cellW: fw, cellH: fh }
}
