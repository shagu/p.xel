// the .xel interpreter: walks the AST and paints frames

import { readFileSync } from 'node:fs'
import { dirname, join, isAbsolute } from 'node:path'
import { evalExpr, parse, isNumeric } from './parser.js'
import { PALETTES } from './palettes.js'
import { autoRamp, toHex } from './color.js'
import {
  Palette, Frame, Ctx, LIGHT_DIRS,
  line, rect, box, oval, ellipse, disc, circle, polyline, shape, floodFill, curve, arc,
  ditherRegion, gradientRegion, rampShift, ovalBox, sphere, cylinder, replaceColor, outline, antialias,
  dropShadow, mirrorFrame, copyRegion, scatter, isoTile, isoGridPos, isoPrism, isoShadow, isoLine
} from './canvas.js'
import { glyph, FONTS, textWidth } from './fonts.js'

class Doc {
  constructor () {
    this.w = 0
    this.h = 0
    this.pal = new Palette()
    this.frames = []
    this.tags = []
    this.exports = []
    this.light = [-1, -1]
    this.lightName = 'tl'
    this.name = null
    this.base = null
    this.charMap = new Map()
    this.lintCfg = { allowOrphans: new Set(), maxColors: null, regions: [], motion: true }
  }
}

export function run (ast, { file = '<input>' } = {}) {
  const doc = new Doc()
  const parts = new Map()
  let ctx = null
  let current = null

  const rootVars = Object.create(null)
  const includeStack = []
  let drawDepth = 0

  function fail (node, msg) {
    throw new Error(`${node.file || file}:${node.line}: ${msg}`)
  }

  function ensureCanvas (node) {
    if (!doc.w) fail(node, 'canvas size not set (use: canvas 32x32)')
    if (!current) newFrame({ name: 'f0', dur: 100, fromBase: true })
  }

  function newFrame ({ name, dur, fromBase }) {
    const f = new Frame(doc.w, doc.h)
    if (fromBase && doc.base) f.data.set(doc.base.data)
    const rec = { name: name || `f${doc.frames.length}`, dur: dur ?? 100, frame: f }
    doc.frames.push(rec)
    current = rec
    ctx = new Ctx(f, doc.pal)
    ctx.light = doc.light
    return rec
  }

  function setTarget (frame) {
    ctx = new Ctx(frame, doc.pal)
    ctx.light = doc.light
  }

  const api = {
    num: (v, vars) => {
      if (v === undefined) throw new Error('missing numeric argument')
      if (typeof v === 'object') throw new Error('expected number, got string')
      return evalExpr(v, vars)
    },
    int: (v, vars) => {
      const r = Math.round(api.num(v, vars))
      if (!Number.isFinite(r)) throw new Error(`not a number: ${typeof v === 'object' ? v.str : v}`)
      return r
    },
    col: (v, vars) => {
      if (v === undefined) throw new Error('missing color argument')
      let d = deref(v, vars)
      if (typeof d === 'object') throw new Error('expected color, got string')
      // interpolate variables inside color names: flame.$i, $ramp.$k, $ramp.($k+1)
      if (typeof d === 'string') d = interp(d, vars)
      return doc.pal.resolve(d)
    },
    str: (v, vars) => {
      if (v === undefined) throw new Error('missing string argument')
      const d = deref(v, vars)
      return typeof d === 'object' ? d.str : String(d)
    }
  }

  // replace $name, $(expr) and (expr-with-$) inside a word: head_$dir, gel.($k+1)
  function interp (d, vars) {
    if (!d.includes('$')) return d
    return d.replace(/\$\(([^)]*)\)|\(([^)]*\$[^)]*)\)|\$(\w+)/g, (m, e1, e2, name) => {
      if (name !== undefined) {
        if (!(name in vars)) throw new Error('unknown variable $' + name)
        const val = vars[name]
        return typeof val === 'number' ? String(Math.round(val)) : String(val)
      }
      return String(Math.round(evalExpr(e1 ?? e2, vars)))
    })
  }

  // a bare $name argument resolves to the variable's value (colors, strings, numbers)
  function deref (v, vars) {
    if (typeof v === 'string' && /^\$\w+$/.test(v)) {
      const n = v.slice(1)
      if (vars && n in vars) return vars[n]
    }
    return v
  }

  function opt (node, key, vars, def, kind = 'num') {
    const v = node.opts[key]
    if (v === undefined) return def
    if (kind === 'num') return api.num(v, vars)
    if (kind === 'int') return api.int(v, vars)
    if (kind === 'col') return api.col(v, vars)
    if (kind === 'bool') return v === 'true' || v === '1' || v === 'yes'
    return v
  }

  function pairs (args, vars, from = 0, to = args.length) {
    const pts = []
    for (let i = from; i < to; i++) {
      const a = args[i]
      if (typeof a === 'object') break
      if (!a.includes(',')) break
      const [x, y] = a.split(',')
      pts.push([api.num(x, vars), api.num(y, vars)])
    }
    return pts
  }

  function ramp (node, vars, key = 'ramp', fallbackArg = null) {
    let name = node.opts[key]
    if (!name && fallbackArg !== null) name = fallbackArg
    if (!name) fail(node, `missing ${key}=`)
    return doc.pal.ramp(name)
  }

  function exec (nodes, vars) {
    for (const node of nodes) {
      try {
        execOne(node, vars)
      } catch (e) {
        if (e.xelLocated) throw e
        const err = new Error(`${node.file || file}:${node.line}: ${node.cmd}: ${e.message}`)
        err.xelLocated = true
        throw err
      }
    }
  }

  const trace = process.env.XEL_TRACE === '1'
  function execOne (node, vars) {
    if (trace) process.stderr.write(`${node.file || file}:${node.line} ${node.cmd}\n`)
    if (Object.values(node.opts).some(v => /^\$\w+$/.test(v))) {
      const o = {}
      for (const [k, v] of Object.entries(node.opts)) o[k] = /^\$\w+$/.test(v) && v.slice(1) in vars && typeof vars[v.slice(1)] === 'string' ? vars[v.slice(1)] : v
      node = { ...node, opts: o }
    }
    const a = node.args
    const n = v => api.num(v, vars)
    const i = v => api.int(v, vars)
    const c = v => api.col(v, vars)

    switch (node.cmd) {
      // ---------- setup ----------
      case 'canvas':
      case 'size': {
        let w, h
        if (a.length === 1 && String(a[0]).includes('x')) {
          const [ws, hs] = String(a[0]).split('x')
          w = i(ws); h = i(hs)
        } else { w = i(a[0]); h = i(a[1]) }
        if (doc.w && (doc.w !== w || doc.h !== h)) fail(node, `canvas already set to ${doc.w}x${doc.h}`)
        if (doc.frames.length && !doc.w) fail(node, 'canvas must come first')
        doc.w = w; doc.h = h
        rootVars.W = w; rootVars.H = h
        if (node.opts.name) doc.name = node.opts.name
        break
      }
      case 'name':
        doc.name = api.str(a[0], vars)
        break
      case 'light': {
        const key = String(a[0] ?? 'tl')
        if (!LIGHT_DIRS[key]) fail(node, 'unknown light direction: ' + key)
        doc.light = LIGHT_DIRS[key]
        doc.lightName = key
        if (ctx) ctx.light = doc.light
        break
      }
      case 'palette': {
        const name = String(a[0])
        const p = PALETTES[name]
        if (!p) fail(node, `unknown palette '${name}' (have: ${Object.keys(PALETTES).join(', ')})`)
        // palette md-punch as md  ->  md_blue.2, md_yellow (avoids name clashes between palettes)
        const prefix = a[1] === 'as' && a[2] ? String(a[2]) + '_' : (node.opts.prefix ? node.opts.prefix + '_' : '')
        for (const [rn, hexes] of Object.entries(p.ramps || {})) doc.pal.defineRamp(prefix + rn, hexes)
        for (const [cn, hex] of Object.entries(p.colors || {})) doc.pal.define(prefix + cn, hex)
        break
      }
      case 'color':
        doc.pal.define(String(a[0]), String(a[1]))
        break
      case 'ramp': {
        const name = String(a[0])
        if (a[1] === 'auto' || node.opts.base) {
          const base = node.opts.base || String(a[2])
          const steps = opt(node, 'steps', vars, 5, 'int')
          const hue = opt(node, 'hue', vars, 12)
          const dir = node.opts.dir === undefined || node.opts.dir === 'auto' ? 'auto' : n(node.opts.dir)
          doc.pal.defineRamp(name, autoRamp(base, steps, hue, dir).map(toHex))
        } else {
          doc.pal.defineRamp(name, a.slice(1).map(String))
        }
        break
      }
      case 'map': {
        for (const l of node.raw) {
          const t = l.trim().split(/\s+/)
          if (t.length < 2) continue
          doc.charMap.set(t[0], t[1])
        }
        break
      }
      case 'let': {
        const name = String(a[0])
        const rest = a.slice(1).filter(x => x !== '=').map(String).join(' ')
        vars[name] = evalExpr(rest, vars)
        break
      }
      case 'note':
        break
      case 'include': {
        // run another .xel file here (shared palettes, parts). path is relative to this file
        const rel = api.str(a[0], vars)
        const base = node.file && node.file !== '<input>' ? dirname(node.file) : '.'
        const path = isAbsolute(rel) ? rel : join(base, rel)
        if (includeStack.includes(path)) fail(node, 'include cycle: ' + path)
        includeStack.push(path)
        exec(parse(readFileSync(path, 'utf8'), path), vars)
        includeStack.pop()
        break
      }
      case 'lint': {
        // file level lint intent: lint orphans=ink,eye maxcolors=16
        if (node.opts.orphans === 'off') doc.lintCfg.orphansOff = true
        else if (node.opts.orphans) for (const t of node.opts.orphans.split(',')) doc.lintCfg.allowOrphans.add(doc.pal.resolve(t))
        if (node.opts.maxcolors) doc.lintCfg.maxColors = parseInt(node.opts.maxcolors, 10)
        if (node.opts.region) doc.lintCfg.regions.push(node.opts.region.split(',').map(v => parseInt(v, 10)))
        if (node.opts.motion === 'off') doc.lintCfg.motion = false
        break
      }

      // ---------- structure ----------
      case 'part':
        // part name p1 p2 key=default ...: keys become optional parameters with defaults
        parts.set(String(a[0]), { params: a.slice(1).map(String), defaults: node.opts, body: node.body })
        break
      case 'draw': {
        // part names may be built from variables: draw head_$dir, draw $pose
        const name = interp(String(deref(a[0], vars)), vars)
        const p = parts.get(name)
        if (!p) fail(node, 'unknown part: ' + name)
        ensureCanvas(node)
        const sub = Object.create(vars)
        for (const [dk, dv] of Object.entries(p.defaults || {})) {
          sub[dk] = isNumeric(dv) ? evalExpr(dv, vars) : dv
        }
        p.params.forEach((pn, k) => {
          const v = a[k + 1]
          if (v === undefined) throw new Error(`part ${name} missing argument ${pn}`)
          if (typeof v === 'object') sub[pn] = v.str
          else if (/^\$\w+$/.test(v)) sub[pn] = deref(v, vars)
          else sub[pn] = isNumeric(v) ? evalExpr(v, vars) : v
        })
        for (const [k, v] of Object.entries(node.opts)) {
          if (['dx', 'dy', 'flipx', 'flipy'].includes(k)) continue
          sub[k] = /^\$\w+$/.test(v) ? deref(v, vars) : (isNumeric(v) ? evalExpr(v, vars) : v)
        }
        const t = {}
        if (node.opts.dx !== undefined) t.dx = n(node.opts.dx)
        if (node.opts.dy !== undefined) t.dy = n(node.opts.dy)
        if (node.opts.flipx !== undefined) t.flipx = n(node.opts.flipx)
        if (node.opts.flipy !== undefined) t.flipy = n(node.opts.flipy)
        const useT = Object.keys(t).length > 0
        if (useT) ctx.push(t)
        const isoKeep = doc.iso // an isogrid set inside a part stays local to it
        if (++drawDepth > 64) { drawDepth = 0; fail(node, `part nesting deeper than 64 (recursive draw of '${name}'?)`) }
        exec(p.body, sub)
        drawDepth--
        doc.iso = isoKeep
        if (useT) ctx.pop()
        break
      }
      case 'base': {
        if (!doc.w) fail(node, 'canvas size not set')
        const f = new Frame(doc.w, doc.h)
        doc.base = f
        const keepCtx = ctx
        const keepCur = current
        current = { name: 'base', dur: 0, frame: f, virtual: true }
        setTarget(f)
        exec(node.body, Object.create(vars))
        ctx = keepCtx
        current = keepCur
        break
      }
      case 'frame': {
        if (!doc.w) fail(node, 'canvas size not set')
        const name = a.length && typeof a[0] !== 'object' && !String(a[0]).includes('=') ? interp(String(a[0]), vars) : null
        const dur = opt(node, 'dur', vars, opt(node, 'ms', vars, 100))
        const prevTarget = current
        const rec = newFrame({ name, dur, fromBase: true })
        if (node.opts.from !== undefined) copyFrom(node, node.opts.from, rec)
        exec(node.body, Object.create(vars))
        current = prevTarget
        if (prevTarget) setTarget(prevTarget.frame)
        break
      }
      case 'from': {
        ensureCanvas(node)
        copyFrom(node, String(a[0]), current)
        break
      }
      case 'tag': {
        const name = interp(node.opts.name || String(a[0]), vars)
        // list form: tag stills 0,4,8,12 picks frames (not an animation, motion lint skips it)
        if (a[1] !== undefined && String(a[1]).includes(',')) {
          const list = String(a[1]).split(',').map(v => i(v))
          doc.tags.push({ name, from: list[0], to: list[list.length - 1], list, fps: null })
          break
        }
        const from = node.opts.from !== undefined ? i(node.opts.from) : i(a[1])
        const to = node.opts.to !== undefined ? i(node.opts.to) : i(a[2])
        doc.tags.push({ name, from, to, fps: opt(node, 'fps', vars, null) })
        break
      }
      case 'group': {
        ensureCanvas(node)
        const t = {}
        if (node.opts.dx !== undefined) t.dx = n(node.opts.dx)
        if (node.opts.dy !== undefined) t.dy = n(node.opts.dy)
        if (node.opts.flipx !== undefined) t.flipx = n(node.opts.flipx)
        if (node.opts.flipy !== undefined) t.flipy = n(node.opts.flipy)
        ctx.push(t)
        exec(node.body, Object.create(vars))
        ctx.pop()
        break
      }
      case 'repeat': {
        if (!doc.w) fail(node, 'canvas size not set')
        const count = i(a[0])
        const varName = a[1] === 'as' ? String(a[2]) : (node.opts.as || 'i')
        const start = opt(node, 'from', vars, 0)
        const step = opt(node, 'step', vars, 1)
        for (let k = 0; k < count; k++) {
          const sub = Object.create(vars)
          sub[varName] = start + k * step
          exec(node.body, sub)
        }
        break
      }
      case 'clip': {
        ensureCanvas(node)
        const prev = ctx.clipRect
        let r = [i(a[0]), i(a[1]), i(a[2]), i(a[3])]
        // nested clips intersect, they never widen the outer clip
        if (prev) {
          const x0 = Math.max(r[0], prev[0]); const y0 = Math.max(r[1], prev[1])
          const x1 = Math.min(r[0] + r[2], prev[0] + prev[2]); const y1 = Math.min(r[1] + r[3], prev[1] + prev[3])
          r = [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)]
        }
        ctx.clipRect = r
        exec(node.body, Object.create(vars))
        ctx.clipRect = prev
        break
      }
      case 'only': {
        ensureCanvas(node)
        const mode = String(a[0])
        const prev = ctx.paintMask
        if (mode === 'solid') ctx.paintMask = { mode: 'solid' }
        else if (mode === 'empty') ctx.paintMask = { mode: 'empty' }
        else if (mode === 'color') ctx.paintMask = { mode: 'color', ci: c(a[1]) }
        else if (mode === 'touching') ctx.paintMask = { mode: 'touching', ci: c(a[1]), snap: new Uint8Array(current.frame.data) }
        else if (mode === 'ramp') ctx.paintMask = { mode: 'set', set: new Set(doc.pal.ramp(String(a[1]))) }
        else fail(node, 'only: expected solid | empty | color <c> | touching <c> | ramp <name>')
        exec(node.body, Object.create(vars))
        ctx.paintMask = prev
        break
      }
      case 'export':
        doc.exports.push({ type: String(a[0]), path: api.str(a[1], vars), opts: { ...node.opts } })
        break

      // ---------- primitives ----------
      case 'px': case 'dot': case 'pset':
        ensureCanvas(node)
        ctx.set(i(a[0]), i(a[1]), c(a[2]))
        break
      case 'line':
        ensureCanvas(node)
        line(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]))
        break
      case 'hline':
        ensureCanvas(node)
        line(ctx, i(a[0]), i(a[1]), i(a[0]) + i(a[2]) - 1, i(a[1]), c(a[3]))
        break
      case 'vline':
        ensureCanvas(node)
        line(ctx, i(a[0]), i(a[1]), i(a[0]), i(a[1]) + i(a[2]) - 1, c(a[3]))
        break
      case 'rect':
        ensureCanvas(node)
        rect(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]))
        if (node.opts.fill) box(ctx, i(a[0]) + 1, i(a[1]) + 1, i(a[2]) - 2, i(a[3]) - 2, c(node.opts.fill))
        break
      case 'box':
        ensureCanvas(node)
        box(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]))
        break
      case 'circle':
        ensureCanvas(node)
        circle(ctx, i(a[0]), i(a[1]), i(a[2]), c(a[3]))
        break
      case 'disc':
        ensureCanvas(node)
        disc(ctx, i(a[0]), i(a[1]), i(a[2]), c(a[3]))
        break
      case 'ellipse':
        ensureCanvas(node)
        ellipse(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]))
        break
      case 'oval':
        ensureCanvas(node)
        oval(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]))
        break
      case 'ovalbox':
        ensureCanvas(node)
        ovalBox(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]), false)
        break
      case 'ellipsebox':
        ensureCanvas(node)
        ovalBox(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]), true)
        break
      case 'poly': {
        ensureCanvas(node)
        const pts = pairs(a, vars)
        polyline(ctx, pts, c(a[pts.length]), node.opts.open !== 'true')
        break
      }
      case 'shape': {
        ensureCanvas(node)
        const pts = pairs(a, vars)
        shape(ctx, pts, c(a[pts.length]))
        break
      }
      case 'fill':
        ensureCanvas(node)
        floodFill(ctx, i(a[0]), i(a[1]), c(a[2]))
        break
      case 'curve': {
        ensureCanvas(node)
        const pts = pairs(a, vars)
        if (pts.length < 3) fail(node, 'curve needs 3 points: x,y x,y x,y color')
        curve(ctx, pts[0], pts[1], pts[2], c(a[3]))
        break
      }
      case 'arc':
        ensureCanvas(node)
        arc(ctx, i(a[0]), i(a[1]), i(a[2]), n(a[3]), n(a[4]), c(a[5]))
        break
      case 'art': {
        ensureCanvas(node)
        const ox = i(a[0]); const oy = i(a[1])
        node.raw.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) {
            const ch = row[rx]
            if (ch === ' ' || ch === '.') continue
            const tok = doc.charMap.get(ch)
            if (tok === undefined) throw new Error(`art: char '${ch}' not in map`)
            if (tok === 'none' || tok === 'clear') continue
            ctx.set(ox + rx, oy + ry, doc.pal.resolve(tok))
          }
        })
        break
      }
      case 'scatter':
        ensureCanvas(node)
        scatter(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]),
          opt(node, 'count', vars, 8, 'int'), opt(node, 'seed', vars, 1, 'int'),
          node.opts.target !== undefined ? c(node.opts.target) : null)
        break
      case 'clear':
        ensureCanvas(node)
        if (a.length) box(ctx, 0, 0, doc.w, doc.h, c(a[0]))
        else current.frame.data.fill(0)
        break
      case 'bg':
        ensureCanvas(node)
        if (a.length && String(a[0]) !== 'none') box(ctx, 0, 0, doc.w, doc.h, c(a[0]))
        break

      // ---------- pixel-art helpers ----------
      case 'dither':
        ensureCanvas(node)
        ditherRegion(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), c(a[4]), c(a[5]),
          node.opts.pattern || 'bayer4', opt(node, 'level', vars, 0.5), node.opts.shape === 'oval')
        break
      case 'glow':
      case 'shade': {
        ensureCanvas(node)
        const st = opt(node, 'steps', vars, 1, 'int')
        rampShift(ctx, doc.pal, i(a[0]), i(a[1]), i(a[2]), i(a[3] ?? a[2]), node.cmd === 'glow' ? st : -st,
          node.opts.pattern || 'bayer4', opt(node, 'falloff', vars, 1), node.opts.hard === 'true')
        break
      }
      case 'gradient':
        ensureCanvas(node)
        gradientRegion(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), ramp(node, vars, 'ramp', a[4]),
          node.opts.dir || 'v', node.opts.dither || 'none')
        break
      case 'sphere':
        ensureCanvas(node)
        sphere(ctx, i(a[0]), i(a[1]), i(a[2]), ramp(node, vars, 'ramp', a[3]),
          node.opts.light ? LIGHT_DIRS[node.opts.light] : doc.light,
          { bounce: node.opts.bounce !== 'false', spec: node.opts.spec !== 'false' })
        break
      case 'cylinder':
        ensureCanvas(node)
        cylinder(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), ramp(node, vars, 'ramp', a[4]),
          node.opts.light ? LIGHT_DIRS[node.opts.light] : doc.light, node.opts.axis || 'v',
          node.opts.ends || 'flat', node.opts.top !== undefined ? c(node.opts.top) : null)
        break
      case 'text': {
        ensureCanvas(node)
        const x = i(a[0]); const y = i(a[1])
        const s = api.str(a[2], vars)
        const ci = c(a[3])
        const font = node.opts.font || '5x7'
        if (!FONTS[font]) fail(node, 'unknown font: ' + font)
        const spacing = opt(node, 'spacing', vars, 1, 'int')
        const scale = opt(node, 'scale', vars, 1, 'int')
        const align = node.opts.align || 'left'
        const wpx = textWidth(font, s, spacing, scale)
        let cx = x
        if (align === 'center') cx = Math.round(x - wpx / 2)
        if (align === 'right') cx = x - wpx
        const shadowCol = node.opts.shadow !== undefined ? c(node.opts.shadow) : null
        const drawStr = (ox, oy, col) => {
          let px = ox
          for (const ch of s) {
            const g = glyph(font, ch)
            for (let gy = 0; gy < g.length; gy++) {
              for (let gx = 0; gx < g[gy].length; gx++) {
                if (!g[gy][gx]) continue
                for (let sy = 0; sy < scale; sy++) {
                  for (let sx = 0; sx < scale; sx++) ctx.set(px + gx * scale + sx, oy + gy * scale + sy, col)
                }
              }
            }
            px += (FONTS[font].w + spacing) * scale
          }
        }
        if (shadowCol !== null) {
          const sdx = opt(node, 'shadowdx', vars, 1, 'int')
          const sdy = opt(node, 'shadowdy', vars, 1, 'int')
          drawStr(cx + sdx, y + sdy, shadowCol)
        }
        if (node.opts.outline !== undefined) {
          const oc = c(node.opts.outline)
          const n8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
          const offs = node.opts.outlinemode === 'square' ? n8 : [[0, -1], [-1, 0], [1, 0], [0, 1]]
          for (const [ox, oy] of offs) drawStr(cx + ox, y + oy, oc)
        }
        drawStr(cx, y, ci)
        break
      }
      case 'outline':
        ensureCanvas(node)
        outline(current.frame, doc.pal, {
          ci: a.length && String(a[0]) !== 'selout' ? c(a[0]) : null,
          mode: (String(a[0]) === 'selout' || node.opts.mode === 'selout') ? 'selout' : 'dark',
          diagonal: node.opts.diagonal === 'true',
          light: doc.light,
          shade: opt(node, 'shade', vars, 2, 'int'),
          fallback: node.opts.ink !== undefined ? c(node.opts.ink) : null,
          region: ctx.clipRect
        })
        break
      case 'aa':
        ensureCanvas(node)
        antialias(current.frame, doc.pal, { strength: opt(node, 'strength', vars, 1), region: ctx.clipRect })
        break
      case 'replace': {
        ensureCanvas(node)
        // optional region: replace a b x y w h. respects clip and only-masks.
        const from = c(a[0]); const to = c(a[1])
        const rx = a.length >= 6 ? i(a[2]) : 0; const ry = a.length >= 6 ? i(a[3]) : 0
        const rw = a.length >= 6 ? i(a[4]) : doc.w; const rh = a.length >= 6 ? i(a[5]) : doc.h
        const hits = []
        for (let yy = ry; yy < ry + rh; yy++) for (let xx = rx; xx < rx + rw; xx++) if (current.frame.get(xx, yy) === from) hits.push([xx, yy])
        const keepStack = ctx.stack
        ctx.stack = []
        for (const [xx, yy] of hits) ctx.set(xx, yy, to)
        ctx.stack = keepStack
        break
      }
      case 'dropshadow': {
        ensureCanvas(node)
        // offset silhouette shadow on empty pixels; respects clip and only, not the transform stack
        const dx = i(a[0]); const dy = i(a[1]); const sc = c(a[2])
        const f = current.frame
        const hits = []
        for (let yy = 0; yy < f.h; yy++) {
          for (let xx = 0; xx < f.w; xx++) {
            if (f.get(xx, yy) === 0) continue
            if (f.get(xx + dx, yy + dy) === 0) hits.push([xx + dx, yy + dy])
          }
        }
        const keepStack = ctx.stack
        ctx.stack = []
        for (const [xx, yy] of hits) if (f.get(xx, yy) === 0) ctx.set(xx, yy, sc)
        ctx.stack = keepStack
        break
      }
      case 'rim': {
        ensureCanvas(node)
        // light the edge of every shape that faces the light: pixels whose neighbour toward
        // the light is empty move up their ramp (steps<0 darkens: use dir= for the far side)
        const dir = node.opts.dir ? LIGHT_DIRS[node.opts.dir] : doc.light
        if (!dir) fail(node, 'rim: unknown dir')
        const st = opt(node, 'steps', vars, 1, 'int')
        const width = opt(node, 'width', vars, 1, 'int')
        const col = node.opts.color !== undefined ? c(node.opts.color) : null
        const f = current.frame
        const hits = []
        for (let yy = 0; yy < f.h; yy++) {
          for (let xx = 0; xx < f.w; xx++) {
            const v = f.get(xx, yy)
            if (v === 0) continue
            let edge = false
            for (let k = 1; k <= width && !edge; k++) {
              if (dir[0] && f.get(xx + dir[0] * k, yy) === 0) edge = true
              if (dir[1] && f.get(xx, yy + dir[1] * k) === 0) edge = true
            }
            if (!edge) continue
            if (col !== null) { hits.push([xx, yy, col]); continue }
            const r = doc.pal.rampOf(v)
            if (!r) continue
            const np = Math.max(0, Math.min(r.idx.length - 1, r.pos + st))
            hits.push([xx, yy, r.idx[np]])
          }
        }
        const keepStack = ctx.stack
        ctx.stack = []
        for (const [xx, yy, ci] of hits) ctx.set(xx, yy, ci)
        ctx.stack = keepStack
        break
      }
      case 'mirror':
        ensureCanvas(node)
        mirrorFrame(current.frame, String(a[0]), i(a[1]))
        break
      case 'copy':
        ensureCanvas(node)
        copyRegion(ctx, i(a[0]), i(a[1]), i(a[2]), i(a[3]), i(a[4]), i(a[5]), {
          flipx: node.opts.flipx === 'true',
          flipy: node.opts.flipy === 'true',
          skipEmpty: node.opts.over !== 'true'
        })
        break

      // ---------- isometric ----------
      case 'isogrid':
        ctx && ctx.stack.length // no-op guard
        doc.iso = {
          ox: node.opts.ox !== undefined ? n(node.opts.ox) : i(a[0]),
          oy: node.opts.oy !== undefined ? n(node.opts.oy) : i(a[1]),
          tw: node.opts.tw !== undefined ? n(node.opts.tw) : i(a[2]),
          th: node.opts.th !== undefined ? n(node.opts.th) : i(a[3])
        }
        break
      case 'isotile': {
        ensureCanvas(node)
        if (!doc.iso) fail(node, 'isotile needs an isogrid first')
        const [px, py] = isoGridPos(doc.iso, n(a[0]), n(a[1]))
        const lift = opt(node, 'lift', vars, 0, 'int')
        if (node.opts.w !== undefined || node.opts.d !== undefined) {
          isoPrism(ctx, doc.iso, n(a[0]), n(a[1]), opt(node, 'w', vars, 1), opt(node, 'd', vars, 1), 0, lift, c(a[2] ?? node.opts.color), 0, 0)
        } else {
          isoTile(ctx, px, py - lift, doc.iso.tw, doc.iso.th, c(a[2] ?? node.opts.color))
        }
        break
      }
      case 'isobox': {
        ensureCanvas(node)
        if (!doc.iso) fail(node, 'isobox needs an isogrid first')
        const hgt = opt(node, 'h', vars, Math.round(doc.iso.th / 2), 'int')
        const lift = opt(node, 'lift', vars, 0, 'int')
        let top, lft, rgt
        if (node.opts.ramp) {
          const r = doc.pal.ramp(node.opts.ramp)
          const last = r.length - 1
          top = r[last]
          const midIdx = Math.max(0, last - 2)
          const darkIdx = Math.max(0, last - 3)
          const lightLeft = doc.light[0] <= 0
          lft = r[lightLeft ? midIdx : darkIdx]
          rgt = r[lightLeft ? darkIdx : midIdx]
        } else {
          top = c(a[2]); lft = c(a[3] ?? a[2]); rgt = c(a[4] ?? a[3] ?? a[2])
        }
        if (node.opts.top) top = c(node.opts.top)
        if (node.opts.left) lft = c(node.opts.left)
        if (node.opts.right) rgt = c(node.opts.right)
        const fw = opt(node, 'w', vars, 1); const fd = opt(node, 'd', vars, 1)
        isoPrism(ctx, doc.iso, n(a[0]), n(a[1]), fw, fd, hgt, lift, top, lft, rgt)
        break
      }
      case 'isoshadow': {
        ensureCanvas(node)
        if (!doc.iso) fail(node, 'isoshadow needs an isogrid first')
        isoShadow(ctx, doc.pal, doc.iso, n(a[0]), n(a[1]), opt(node, 'w', vars, 1), opt(node, 'd', vars, 1),
          opt(node, 'h', vars, 8), node.opts.light ? LIGHT_DIRS[node.opts.light] : doc.light,
          opt(node, 'len', vars, 1), opt(node, 'steps', vars, 1, 'int'),
          node.opts.color !== undefined ? c(node.opts.color) : null)
        break
      }
      case 'isoline':
        ensureCanvas(node)
        isoLine(ctx, i(a[0]), i(a[1]), i(a[2]), String(a[3]), c(a[4]))
        break
      default:
        fail(node, 'unknown command: ' + node.cmd)
    }
  }

  function copyFrom (node, ref, target) {
    let src = null
    if (ref === 'prev') {
      const idx = doc.frames.indexOf(target)
      src = idx > 0 ? doc.frames[idx - 1].frame : null
    } else if (ref === 'base') {
      src = doc.base
    } else if (/^\d+$/.test(ref)) {
      src = doc.frames[parseInt(ref, 10)]?.frame
    } else {
      src = doc.frames.find(f => f.name === ref)?.frame
    }
    if (!src) fail(node, 'cannot resolve frame reference: ' + ref)
    target.frame.data.set(src.data)
  }

  exec(ast, rootVars)
  if (!doc.frames.length && doc.w) newFrame({ name: 'f0', dur: 100, fromBase: true })
  return doc
}
