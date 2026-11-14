// color helpers: hex parsing, hsv conversion, deterministic ramp generation

export function parseHex (s) {
  let h = s.trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('bad color: ' + s)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function toHex (rgb) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function rgbToHsv ([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

export function hsvToRgb ([h, s, v]) {
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0; let g = 0; let b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function luma ([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// deterministic hue-shifted ramp around a base color, darkest first.
// - the base color is kept as the middle step
// - hue rotates hueStep degrees per step: dir 'auto' turns highlights toward yellow
//   and shadows away from it (warm light, cool shadow) whatever the base hue
// - saturation peaks around the middle, never 0 or 1, highlights desaturate
// - perceived brightness (luma) climbs in even, monotonic steps
export function autoRamp (baseHex, steps = 5, hueStep = 18, dir = 'auto') {
  const base = parseHex(baseHex)
  const [h0, s0] = rgbToHsv(base)
  if (dir === 'auto') {
    const toYellow = ((60 - h0 + 540) % 360) - 180
    dir = toYellow >= 0 ? 1 : -1
  }
  if (steps < 2) return [base]
  const keep = Math.floor((steps - 1) / 2)
  const lb = luma(base)
  // brightness span around the base: wide enough to read, capped near black and white
  const lmin = Math.max(8, Math.min(lb * 0.3, lb - 55))
  const lmax = Math.min(242, Math.max(lb * 1.75, lb + 85))
  const out = []
  for (let i = 0; i < steps; i++) {
    if (i === keep) { out.push(base); continue }
    const h = h0 + dir * (i - keep) * hueStep
    let target
    if (i < keep) target = lmin + (lb - lmin) * (i / keep)
    else target = lb + (lmax - lb) * Math.pow((i - keep) / (steps - 1 - keep), 0.95)
    // saturation: a touch richer in the shadows, fading toward the highlight
    const t = i / (steps - 1)
    let sat = i < keep ? Math.min(0.92, s0 * (1.05 + 0.1 * (1 - i / keep))) : s0 * (1 - 0.55 * Math.pow((i - keep) / (steps - 1 - keep), 1.2))
    sat = Math.max(0.06, Math.min(0.92, sat * (t > 0.9 ? 0.85 : 1)))
    out.push(solveLuma(h, sat, target))
  }
  return out
}

// find an hsv color with the given hue/saturation whose luma hits the target.
// bright targets that a saturated hue cannot reach are desaturated toward white.
function solveLuma (h, s, target) {
  for (let tries = 0; tries < 12; tries++) {
    let lo = 0; let hi = 1
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2
      if (luma(hsvToRgb([h, s, mid])) < target) lo = mid
      else hi = mid
    }
    const rgb = hsvToRgb([h, s, hi])
    if (Math.abs(luma(rgb) - target) < 3 || s < 0.05) return rgb
    s *= 0.8
  }
  return hsvToRgb([h, s, 1])
}

// pick the palette entry whose rgb is closest to the target (used by aa / blends)
export function nearest (palette, rgb, skipTransparent = true) {
  let best = -1; let bestD = Infinity
  for (let i = skipTransparent ? 1 : 0; i < palette.length; i++) {
    const p = palette[i]
    if (!p) continue
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

export function mix (a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
