// tiny regression suite: node test/run.js

import { parse } from '../src/parser.js'
import { run } from '../src/interp.js'
import { renderAscii } from '../src/ascii.js'
import { lint } from '../src/lint.js'
import { pngBuffer, gifBuffer, sheetFrame } from '../src/render.js'

let pass = 0
let fail = 0

function check (name, cond, extra = '') {
  if (cond) { pass++; console.log('ok   ' + name) } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

function build (src) {
  return run(parse(src, 'test'), { file: 'test' })
}

// --- basics
let doc = build(`
canvas 8x8
color ink #ff0000
box 1 1 3 3 ink
px 7 7 #00ff00
`)
check('canvas size', doc.w === 8 && doc.h === 8)
check('box pixels', doc.frames[0].frame.get(2, 2) !== 0)
check('inline hex color', doc.frames[0].frame.get(7, 7) !== 0)
check('transparent elsewhere', doc.frames[0].frame.get(6, 1) === 0)

// --- expressions, repeat, parts, groups
doc = build(`
canvas 16x16
color ink #ffffff
let step = 3
part dotpair x y c
  px $x $y $c
  px ($x+1) $y $c
end
repeat 4 as i
  draw dotpair (1+$i*$step) 2 ink
end
group dx=0 dy=5 flipx=15
  px 1 1 ink
end
`)
check('repeat + part + expression', [1, 4, 7, 10].every(x => doc.frames[0].frame.get(x, 2) !== 0))
check('group flip + offset', doc.frames[0].frame.get(14, 6) !== 0)

// --- art blocks with indentation and map
doc = build(`
canvas 6x6
color a #111111
color b #eeeeee
map
  x a
  o b
end
  art 1 1
    xox
    oxo
  end
`)
check('art dedent + map', doc.frames[0].frame.get(1, 1) === doc.pal.resolve('a') &&
  doc.frames[0].frame.get(2, 1) === doc.pal.resolve('b'))

// --- ramps
doc = build(`
canvas 4x4
ramp r auto base=#8a5a2b steps=5 hue=14
px 0 0 r.0
px 1 0 r.-1
`)
check('auto ramp length', doc.pal.ramp('r').length === 5)
check('ramp index from the top', doc.frames[0].frame.get(1, 0) === doc.pal.ramp('r')[4])

// --- frames, base, tags
doc = build(`
canvas 8x8
color ink #ffffff
base
  px 0 7 ink
end
frame one dur=80
  px 1 1 ink
end
frame two dur=80 from=prev
  px 2 2 ink
end
tag walk 0 1
`)
check('base is not a frame', doc.frames.length === 2)
check('base inherited', doc.frames[1].frame.get(0, 7) !== 0)
check('from prev', doc.frames[1].frame.get(1, 1) !== 0)
check('tag recorded', doc.tags[0].name === 'walk' && doc.tags[0].to === 1)

// --- iso geometry: tiles must interlock without gaps
doc = build(`
canvas 64x48
color g #406030
isogrid 16 4 32 16
repeat 2 as gy
  repeat 2 as gx
    isotile $gx $gy g
  end
end
`)
let gaps = 0
const f = doc.frames[0].frame
for (let y = 14; y < 25; y++) for (let x = 14; x < 33; x++) if (f.get(x, y) === 0) gaps++
check('iso tiles leave no interior gaps', gaps === 0, 'gaps=' + gaps)

// --- sphere is clean
doc = build(`
canvas 24x24
light tl
ramp s auto base=#c04040 steps=5 hue=12
sphere 11 11 10 ramp=s
`)
const sl = lint(doc)
check('sphere has no orphan pixels', !sl.warn.some(w => w.includes('orphan')), sl.warn.join('; '))

// --- text
doc = build(`
canvas 40x10
color ink #ffffff
text 1 1 "AZ 09" ink
`)
let inkCount = 0
for (const v of doc.frames[0].frame.data) if (v) inkCount++
check('text renders glyphs', inkCount > 40)

// --- encoders
doc = build(`
canvas 8x8
color ink #ff8800
box 0 0 8 8 ink
frame b dur=50
  box 0 0 4 4 #0000ff
end
`)
const png = pngBuffer(doc.frames[0].frame, doc.pal, 2)
check('png signature', png[0] === 0x89 && png.subarray(1, 4).toString() === 'PNG')
const gif = gifBuffer(doc.frames, doc.pal, 1)
check('gif signature', gif.subarray(0, 6).toString() === 'GIF89a')
check('gif terminator', gif[gif.length - 1] === 0x3b)
const sh = sheetFrame(doc.frames, { cols: 2 })
check('sheet layout', sh.frame.w === 16 && sh.frame.h === 8)

// --- ascii determinism
const a1 = renderAscii(doc, { frame: 0 })
const a2 = renderAscii(build(`
canvas 8x8
color ink #ff8800
box 0 0 8 8 ink
frame b dur=50
  box 0 0 4 4 #0000ff
end
`), { frame: 0 })
check('ascii is deterministic', a1 === a2)

// --- lint catches real problems
doc = build(`
canvas 12x12
color a #808080
color b #888888
box 2 2 6 6 a
px 10 10 b
`)
const r2 = lint(doc, { maxColors: 24 })
check('lint reports orphan', r2.warn.some(w => w.includes('orphan')))
check('lint reports low contrast', r2.warn.some(w => w.includes('contrast')))

// --- errors are located
try {
  build('canvas 4x4\npx 1 1 nosuchcolor\n')
  check('unknown color throws', false)
} catch (e) {
  check('unknown color throws with line', /:2:/.test(e.message), e.message)
}

// --- feedback round 1 features
doc = build(`
canvas 12x12
color ink #ffffff
color red #ff0000
ovalbox 0 0 6 4 ink
let a = 2
px ($a + 3) 10 ink
clip 0 0 6 6
  clip 4 4 8 8
    box 0 0 12 12 red
  end
end
`)
const fb = doc.frames[0].frame
check('ovalbox even width symmetric', fb.get(0, 1) === fb.get(5, 1) && fb.get(0, 0) === fb.get(5, 0))
check('spaces inside parentheses', fb.get(5, 10) !== 0)
check('nested clip intersects', fb.get(4, 4) !== 0 && fb.get(3, 3) !== doc.pal.resolve('red') && fb.get(6, 6) === 0)

doc = build(`
canvas 8x8
color a #ff0000
color b #00ff00
color c #0000ff
box 0 0 8 8 a
px 4 4 b
only touching b
  replace a c
end
`)
check('only touching + replace', doc.frames[0].frame.get(4, 3) === doc.pal.resolve('c') && doc.frames[0].frame.get(0, 0) === doc.pal.resolve('a'))

doc = build(`
canvas 4x4
ramp blue auto base=#3a8ee0 steps=5 hue=14
`)
check('auto ramp keeps the base as middle step', doc.pal.rgb(doc.pal.ramp('blue')[2]).join() === '58,142,224')

// --- feedback round 2 features
doc = build(`
canvas 8x8
ramp g #202020 #606060 #a0a0a0 #e0e0e0
part dotp x y=3 c=g.1
  px $x $y $c
end
repeat 3 as k
  frame walk_$k dur=(100+$k*10)
    draw dotp ($k+1)
    draw dotp round(5.4) y=6
  end
end
tag walk 0 2
`)
check('frames inside repeat with names', doc.frames.length === 3 && doc.frames[2].name === 'walk_2' && doc.frames[2].dur === 120)
check('part defaults', doc.frames[0].frame.get(1, 3) === doc.pal.resolve('g.1'))
check('function call as part argument', doc.frames[0].frame.get(5, 6) !== 0)

doc = build(`
canvas 8x8
ramp g #202020 #606060 #a0a0a0 #e0e0e0
color other #ff0000
box 2 2 4 4 g.1
px 0 0 other
rim dir=l steps=1
only ramp g
  box 0 0 8 8 g.0
end
`)
check('only ramp keeps foreign colors', doc.frames[0].frame.get(0, 0) === doc.pal.resolve('other'))
doc = build(`
canvas 8x8
ramp g #202020 #606060 #a0a0a0 #e0e0e0
box 2 2 4 4 g.1
rim dir=l steps=1
`)
check('rim lights the edge facing the light', doc.frames[0].frame.get(2, 3) === doc.pal.resolve('g.2') && doc.frames[0].frame.get(4, 3) === doc.pal.resolve('g.1'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
