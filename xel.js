#!/usr/bin/env node
// p.xel - pixel art graphics as code. compiles .xel files to png / gif / ascii.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { parse } from './src/parser.js'
import { run } from './src/interp.js'
import { renderAscii, stats } from './src/ascii.js'
import { report, paletteReport } from './src/lint.js'
import { pngBuffer, gifBuffer, sheetFrame, sheetRows, selectFrames } from './src/render.js'
import { listPalettes } from './src/palettes.js'
import { Frame } from './src/canvas.js'

const USAGE = `p.xel - pixel art graphics as code

usage: xel <file.xel> [options]

output
  --png <path>        write a png (frame selected by --frame, default 0)
  --gif <path>        write an animated gif of all frames (or --tag)
  --sheet <path>      write a sprite sheet png
  --out <dir>         write every 'export' statement of the file into <dir>
  --scale <n>         integer upscale for png/gif/sheet (default 1)
  --frame <n>         frame index for --png (default 0)
  --tag <name>        limit --gif/--sheet to a tag
  --cols <n>          sheet columns (default 8 or frame count)
  --rows <a,b,..>     sheet with one tag per row
  --pad <n>           sheet padding in pixels (default 0)
  --bg <#hex>         flatten transparency onto this color
  --crop x,y,w,h      cut a region out of every frame before output (close-up reviews)

review (for humans and agents)
  --ascii [mode]      ascii preview: palette (default), mask, value
  --all               ascii preview of every frame
  --stats             canvas / frame / bbox summary
  --lint              craft checks: orphans, banding, palette bloat, anchor jumps
  --palette           list palette ramps and colors
  --max-colors <n>    lint budget (default 24)
  --strict            exit non-zero if lint warns
  --no-ruler          drop the coordinate ruler from ascii output
  --quiet             only write files, print nothing

misc
  --palettes          list builtin palettes
  --help
`

function parseArgs (argv) {
  const o = { _: [], scale: 1, frame: 0, ascii: null, cols: 0, pad: 0, maxColors: 24 }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    const next = () => argv[++i]
    switch (t) {
      case '--help': case '-h': o.help = true; break
      case '--palettes': o.palettes = true; break
      case '--png': o.png = next(); break
      case '--gif': o.gif = next(); break
      case '--sheet': o.sheet = next(); break
      case '--out': o.out = next(); break
      case '--scale': o.scale = parseInt(next(), 10); break
      case '--frame': o.frame = parseInt(next(), 10); break
      case '--tag': o.tag = next(); break
      case '--cols': o.cols = parseInt(next(), 10); break
      case '--pad': o.pad = parseInt(next(), 10); break
      case '--rows': o.rows = next(); break
      case '--crop': o.crop = next().split(',').map(v => parseInt(v, 10)); break
      case '--bg': o.bg = next(); break
      case '--ascii':
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) o.ascii = next()
        else o.ascii = 'palette'
        break
      case '--all': o.all = true; break
      case '--stats': o.stats = true; break
      case '--lint': o.lint = true; break
      case '--palette': o.paletteReport = true; break
      case '--max-colors': o.maxColors = parseInt(next(), 10); break
      case '--strict': o.strict = true; break
      case '--no-ruler': o.noRuler = true; break
      case '--quiet': o.quiet = true; break
      default:
        if (t.startsWith('-')) throw new Error('unknown option: ' + t)
        o._.push(t)
    }
  }
  return o
}

function hexToRgb (h) {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

function write (path, buf, quiet) {
  mkdirSync(dirname(resolve(path)), { recursive: true })
  writeFileSync(path, buf)
  if (!quiet) console.log('wrote ' + path + ' (' + buf.length + ' bytes)')
}

function main () {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(2)
  }
  if (opts.help || (!opts._.length && !opts.palettes)) {
    console.log(USAGE)
    process.exit(opts.help ? 0 : 2)
  }
  if (opts.palettes) {
    console.log('builtin palettes: ' + listPalettes().join(', '))
    if (!opts._.length) return
  }

  const file = opts._[0]
  let doc
  try {
    const src = readFileSync(file, 'utf8')
    doc = run(parse(src, file), { file })
  } catch (e) {
    console.error('error: ' + e.message)
    process.exit(1)
  }
  if (!doc.frames.length) {
    console.error('error: nothing was drawn (no canvas?)')
    process.exit(1)
  }

  if (opts.crop) {
    const [cx, cy, cw, ch] = opts.crop
    for (const rec of doc.frames) {
      const f = new Frame(cw, ch)
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) f.put(x, y, rec.frame.get(cx + x, cy + y))
      rec.frame = f
    }
    doc.w = cw; doc.h = ch
  }
  const bg = opts.bg ? hexToRgb(opts.bg) : null
  const quiet = opts.quiet

  if (opts.png) {
    const rec = doc.frames[opts.frame]
    if (!rec) { console.error('no such frame: ' + opts.frame); process.exit(1) }
    write(opts.png, pngBuffer(rec.frame, doc.pal, opts.scale, bg), quiet)
  }
  if (opts.gif) {
    const frames = selectFrames(doc, opts.tag)
    write(opts.gif, gifBuffer(frames, doc.pal, opts.scale), quiet)
  }
  if (opts.sheet) {
    const sh = opts.rows ? sheetRows(doc, opts.rows.split(','), { pad: opts.pad })
      : sheetFrame(selectFrames(doc, opts.tag), { cols: opts.cols, pad: opts.pad })
    write(opts.sheet, pngBuffer(sh.frame, doc.pal, opts.scale, bg), quiet)
    if (!quiet) console.log(`sheet: ${sh.cols}x${sh.rows} cells of ${sh.cellW}x${sh.cellH}`)
  }
  if (opts.out) {
    for (const ex of doc.exports) {
      const path = resolve(opts.out, ex.path)
      const scale = ex.opts.scale ? parseInt(ex.opts.scale, 10) : opts.scale
      const exBg = ex.opts.bg ? hexToRgb(ex.opts.bg) : bg
      const frames = selectFrames(doc, ex.opts.tag)
      if (ex.type === 'png') {
        const idx = ex.opts.frame ? parseInt(ex.opts.frame, 10) : 0
        write(path, pngBuffer(frames[idx].frame, doc.pal, scale, exBg), quiet)
      } else if (ex.type === 'gif') {
        write(path, gifBuffer(frames, doc.pal, scale, ex.opts.loop ? parseInt(ex.opts.loop, 10) : 0), quiet)
      } else if (ex.type === 'sheet') {
        const pad = ex.opts.pad ? parseInt(ex.opts.pad, 10) : 0
        const sh = ex.opts.rows ? sheetRows(doc, ex.opts.rows.split(','), { pad })
          : sheetFrame(frames, { cols: ex.opts.cols ? parseInt(ex.opts.cols, 10) : 0, pad })
        write(path, pngBuffer(sh.frame, doc.pal, scale, exBg), quiet)
      } else if (ex.type === 'ascii') {
        write(path, Buffer.from(renderAscii(doc, { mode: ex.opts.mode || 'palette', frame: 0 }) + '\n'), quiet)
      } else {
        console.error('unknown export type: ' + ex.type)
      }
    }
  }

  const noOutput = !opts.png && !opts.gif && !opts.sheet && !opts.out
  const wantAscii = opts.ascii || (noOutput && !opts.lint && !opts.stats && !opts.paletteReport)
  if (!quiet && wantAscii) {
    const mode = opts.ascii || 'palette'
    const list = opts.all ? doc.frames.map((_, i) => i) : [opts.frame]
    for (const fi of list) {
      if (doc.frames.length > 1) console.log(`--- frame ${fi} (${doc.frames[fi].name}, ${doc.frames[fi].dur}ms) ---`)
      console.log(renderAscii(doc, { mode, frame: fi, ruler: !opts.noRuler }))
    }
  }
  if (!quiet && (opts.stats || wantAscii)) console.log('\n' + stats(doc))
  if (!quiet && opts.paletteReport) console.log('\n' + paletteReport(doc))
  let warnings = 0
  if (opts.lint || opts.strict) {
    const r = report(doc, { maxColors: opts.maxColors, strict: opts.strict })
    warnings = r.warnings
    if (!quiet) console.log('\n' + r.text)
  }
  if (opts.strict && warnings) process.exit(3)
}

main()
