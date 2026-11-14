# The xel language

A `.xel` file is a deterministic script that paints an indexed pixel canvas.
Same file in, same pixels out, every time.

## Syntax

- One statement per line: `command arg arg ... key=value key=value`
- `#` starts a comment, except in hex colors (`#ff8800`)
- Strings are double quoted: `text 2 2 "GAME OVER" ink`
- Block commands are closed with `end`; indentation is free (and dedented in raw blocks)
- Numbers may be expressions: `+ - * / %`, comparisons `< > <= >= == !=` (yield 1 or 0),
  parentheses, `$variables` and the functions `min max abs floor ceil round sqrt sin cos`
  (angles in degrees), `clamp(v,lo,hi)`, `sign(v)` and `if(cond,a,b)`.
  Outside parentheses an expression must not contain spaces: write `$x+2` or `($x + 2)`
- Coordinates are pixels, `0 0` is the top-left corner
- `$W` and `$H` hold the canvas size

```xel
# the smallest useful file
canvas 16x16
color ink #0f380f
box 4 4 8 8 ink
```

## Colors

A color argument is one of:

| form | meaning |
| --- | --- |
| `#rrggbb` or `#rgb` | literal |
| `name` | a color declared with `color`, or the middle step of a ramp |
| `name.N` | step N of a ramp, 0 = darkest |
| `name.-1` | last step of a ramp (`-2` = second from the top) |
| `name.$i`, `$r.$k`, `name.($k+1)` | variables and expressions inside color names (loops over ramps) |
| `none` / `clear` | transparent (erases) |

Index 0 of the canvas is always transparent.

### color

```xel
color ink #0f380f
color gold #f2c14e
```

### ramp

Explicit, dark to light:

```xel
ramp steel #15161c #2b2f3c #474d60 #6b7488 #9aa3b4
```

Generated (hue-shifted, even value steps, saturation peaking mid ramp):

```xel
ramp skin auto base=#b06840 steps=5 hue=14
ramp cloth auto base=#2f4f9e steps=4 hue=18 dir=-1
```

- `steps` swatch count (default 5)
- `hue` degrees of hue shift per step (default 12; 10-15 for skin and wood,
  15-20 for foliage and magic, 25+ only for stylised work). The ends of the ramp sit
  `hue * (steps-1)/2` degrees away from the base: keep that under about 40
- perceived brightness climbs in even steps (darkest first); highlights desaturate
- `dir` `auto` (default) rotates highlights toward yellow and shadows away from it,
  whatever the base hue (warm light, cool shadow). `1` / `-1` force the direction
- the `base` color itself is kept as the middle step (odd step counts)

### palette

Loads a builtin palette's ramps and colors:

```xel
palette gameboy        # ramp gb (4 greens) + ink/shade/tone/paper. gb.2 and gb.3 are
                       # close in value (authentic DMG): rely on the outline for contrast
palette dark-fantasy   # steel gold blood flesh stone moss + void/ember/spirit
palette pocket-16      # skin cloth leaf + ink/white/red/gold/shadow
palette md-punch       # blue red green grey + yellow/magenta/cyan
palette snes-soft      # skin robe grass wood + sky/ink/white/accent
palette gameboy-soft   # greenscale DMG variant
palette 1bit           # bw ramp
```

`xel --palettes` lists them, `xel file.xel --palette` prints the resolved ramps.

Builtins share names (`ink`, `skin`, `gold` ...). Loading a second palette replaces
them, unless you give it a prefix:

```xel
palette snes-soft as sn     # sn_skin.2, sn_robe, sn_ink
palette md-punch prefix=md  # md_blue.1, md_yellow
```

## Canvas, light, frames

```xel
canvas 32x32            # or: canvas 32 32
light tl                # tl t tr l r bl b br (default tl)
name "slime"            # optional, metadata only
```

`light` is declared once and used by `sphere`, `cylinder`, `isobox` and `outline selout`.
Pick it before drawing and never change it inside a piece.

### base and frame

Drawing at the top level goes into frame 0. For animation:

```xel
base                    # shared content, not a frame of its own
  isotile 0 0 grass
end

frame contact dur=120
  draw body 8 10
end

frame pass dur=120 from=prev   # start from the previous frame's pixels
  px 9 20 ink
end

tag walk 0 1            # name a frame range for export
tag stills 0,4,8,12     # or pick frames (a showcase, not an animation)
```

- every `frame` starts as a copy of `base` (or empty if there is no base)
- frames may be generated in a `repeat`; names, durations and tags can use variables:

  ```xel
  repeat 8 as k
    frame walk_$k dur=(if($k%4<2,110,90))
      draw paladin se $k
    end
  end
  tag walk_se 0 7
  ```
- `from prev | base | <index> | <frame name>` copies pixels into the current frame
- `dur` is the frame duration in ms (default 100), used by the GIF exporter

## Structure and reuse

### part / draw

```xel
part leg x y shade lift=0          # key=value in the header = optional parameter with default
  box $x ($y-$lift) 2 5 $shade
  px ($x+1) ($y+5) ink
end

draw leg 6 18 steel.1
draw leg 6 18 steel.1 dx=8 flipx=15     # reserved keys: dx dy flipx flipy
```

Arguments are numbers, colors or words. An argument that starts with a function
(`round(..)`, `min(..)`) is evaluated like any expression. Parameters become `$variables` inside the part. The part name may come from
variables: `draw $face` or `draw head_$dir` (with `dir` passed in as `s`, `se`, `e` ...)
picks variants without conditionals. Strings that are not numbers (`s`, `eyes_open`)
are passed through parts unchanged. Extra `key=value` pairs also become
variables, except the four reserved transform keys. `flipx=15` mirrors the part's
x coordinates around 15 (`x -> 15 - x`).

### group

```xel
group dx=4 dy=2 flipx=31
  ...
end
```

### repeat

```xel
repeat 8 as i
  px (2+$i) 4 ink
end
repeat 4 as i from=1 step=2
  ...
end
```

### clip

```xel
clip 0 0 16 16
  ...             # nothing is painted outside the rectangle
end
```

Nested clips intersect with the outer one.

### only

Restricts painting to pixels that already match a condition. The cheapest way to
shade or dither an existing cluster without redrawing it.

```xel
only solid        # only where something is already painted
only empty        # only where the canvas is transparent (paint behind)
only color skin.2 # only where this exact color sits
  dither 4 8 12 10 skin.2 skin.1 pattern=bayer4 level=0.5
end
only ramp stone        # only pixels whose color belongs to this ramp (floor-only shading)
only touching skin.3   # only pixels with a 4-neighbour of this color
  replace ink skin.0   # e.g. hand-made selective outline next to the lit skin
end
```

Painting `none` inside an `only` block still erases the matching pixels.

### include

```xel
include "shared/palette.xel"     # runs another file here: palettes, maps, parts
```

The path is relative to the including file. Use it to share a character between a
sprite file and a scene file.

### let

```xel
let cx = 16
let waist = $cx - 3
```

## Drawing commands

| command | arguments |
| --- | --- |
| `px x y c` | single pixel (aliases `dot`, `pset`) |
| `line x1 y1 x2 y2 c` | bresenham line |
| `hline x y len c` / `vline x y len c` | axis lines |
| `rect x y w h c [fill=c2]` | rectangle outline, optional fill |
| `box x y w h c` | filled rectangle |
| `circle cx cy r c` / `disc cx cy r c` | circle outline / filled |
| `ellipse cx cy rx ry c` / `oval cx cy rx ry c` | ellipse outline / filled (odd widths: 2r+1) |
| `ellipsebox x y w h c` / `ovalbox x y w h c` | ellipse inscribed in a box, any width (even too) |
| `poly x,y x,y ... c [open=true]` | polygon outline |
| `shape x,y x,y ... c` | filled polygon |
| `curve x,y x,y x,y c` | quadratic curve (start, control, end) |
| `arc cx cy r a0 a1 c` | arc, angles in degrees, 0 = east, clockwise |
| `fill x y c` | flood fill the connected same-color area |
| `clear [c]` | clear the frame (to transparent, or to a color) |
| `bg c` | fill the whole canvas |
| `scatter x y w h c count=N seed=S [target=c2]` | seeded speckle inside a region |

### art

The workhorse. Draw with characters, exactly like the ascii preview reads back:

```xel
map
  o ink
  x skin.1
  X skin.2
  . none        # '.' and ' ' are always transparent
end

art 4 3
  ..ooo..
  .oxxxo.
  .oxXXo.
  ..ooo..
end
```

Leading indentation inside the block is removed automatically, so the art can be
indented with its surrounding code. Characters must exist in `map`.

### Pixel-art helpers

```xel
dither x y w h colorA colorB [pattern=bayer4] [level=0.5] [shape=oval]
```
- ordered patterns `bayer2` (5 levels), `bayer4` (17), `bayer8` (65): `level` is the
  share of colorB (0..1), stepping through the matrix thresholds
- fixed patterns `checker` (50%), `lines` (horizontal), `vlines`, `dots25`, `dots75`,
  `diag`: always the same texture; `level` 0 gives all A, 1 all B
- `shape=oval` limits the fill to the ellipse inscribed in the rectangle
- use on areas 8+ px wide, never on faces

```xel
gradient x y w h ramp=skin [dir=v|h|d] [dither=bayer4]
```
Steps through a ramp across the region: ramp step 0 (darkest) at the top (`v`), left
(`h`) or top-left (`d`). Swap ends by declaring the ramp the other way round.
`dither=bayer2|bayer4|bayer8` dithers the transitions instead of hard bands.

```xel
glow cx cy rx [ry] [steps=1] [falloff=1] [pattern=bayer4] [hard=true]
shade cx cy rx [ry] [steps=1] [falloff=1] [pattern=bayer4] [hard=true]
```
Lighting without new colors: every painted pixel inside the ellipse moves `steps`
along its own ramp (up for `glow`, down for `shade`). Solid core, dithered ring that
fades to the rim; `falloff` > 1 shrinks the core, `hard=true` drops the dither ring.
Pixels whose color is not part of a ramp are left alone. Torches, magic, vignettes,
ambient occlusion in corners.

```xel
sphere cx cy r ramp=steel [light=tl] [bounce=false] [spec=false]
cylinder x y w h ramp=steel [axis=v|h] [light=tl] [ends=round] [top=c]
```
Correctly lit volumes: banded ramp, sharp terminator, bounce light on the shadow
rim, small specular dot. The fastest cure for pillow shading. `ends=round` gives a
vertical cylinder elliptical ends (iso barrels, towers, wells); `top=c` fills the top
cap ellipse.

```xel
outline [c | selout] [mode=selout] [diagonal=true] [shade=2] [ink=c]
```
Adds a 1px outline around everything painted. `selout` takes each outline pixel from
the ramp of the shape it touches: `shade` steps darker on the shadow side, one step
less where the light hits. When a ramp has no darker step left, a darker color is
derived automatically; pass `ink=<color>` to use a declared color instead and keep the
palette closed. Run it after the shading, before `aa`.

`outline` and `aa` work on the whole frame. Inside a `clip` block they only treat the
pixels inside the clip rectangle, which lets you outline one object in a scene.

```xel
aa [strength=1]
```
Conservative manual-style anti-aliasing: softens staircase corners with an
in-between color, skipping 45 degree and straight runs.

```xel
replace colorA colorB [x y w h]  # recolor (whole frame or region); respects clip and only
dropshadow dx dy c               # offset silhouette shadow, only on empty pixels; respects clip/only
rim [dir=tl] [steps=1] [width=1] [color=c]
                                 # edge light: pixels whose neighbour toward dir is empty move
                                 # steps up their ramp (negative darkens). Relights mirrored art
mirror x 16                      # mirror columns 0..15 onto 16..31 (also: mirror y 12)
copy sx sy w h dx dy [flipx=true] [flipy=true] [over=true]
```

### text

```xel
text 2 2 "HELLO" ink font=5x7 spacing=1 scale=1 align=left shadow=#000000 outline=ink
```

- fonts: `5x7` (full ASCII, upper and lower case, descenders use an 8th row) and `3x5`
  (caps, digits, punctuation; lowercase input renders as caps)
- `outline=c` draws a 1px outline (4 directions, `outlinemode=square` for 8)
- `align`: `left` (default), `center`, `right` around x
- `scale` is an integer multiplier, `spacing` the gap in px between glyphs
- `shadow` draws the string again offset by `shadowdx`/`shadowdy` (default 1,1) first

## Isometric

```xel
isogrid 16 8 32 16          # ox oy tile-width tile-height (keep width = 2 * height)
isotile gx gy color [lift=0] [w=1 d=1]
isobox gx gy ramp=stone [h=8] [lift=0] [w=1] [d=1]
isobox gx gy top left right [h=8]
isoshadow gx gy h=16 [w=1 d=1] [len=1] [steps=1 | color=c]
isoline x y len se|sw|ne|nw color
```

- `isogrid` sets the grid; `isotile`/`isobox`/`isoshadow` then take **grid coordinates**
  (fractions allowed). An `isogrid` inside a part stays local to that part.
- anchor: the top vertex of tile `(gx, gy)` is the point
  `x = ox + (gx - gy) * tw/2`, `y = oy + (gx + gy) * th/2`. The diamond's top row is the
  2 pixels `x-1 .. x` on row `y`; rows widen by 4 px per row down to full width
  `tw - 2` at the middle, then narrow again
- diamonds use the 2:1 staircase and interlock without seams
- `isobox` footprint is `w` x `d` tiles (fractions make thin walls: `d=0.25`), height
  `h` px. Neighbouring boxes share edges exactly, so a row of boxes reads as one wall.
  With `ramp=` the faces are: top = last (lightest) step, lit side = third from the
  top, other side = fourth from the top (lit side follows `light`). Override with
  `top=`, `left=`, `right=`
- `lift` raises a tile or block in pixels (stacking, floating platforms)
- `isoshadow` darkens the floor (one ramp step, or paints `color=`) where a `w` x `d` x
  `h` block would cast its shadow, away from the declared light; `len` scales it.
  Call it after the floor and before the block
- `isoline` draws an exact 2:1 staircase `len` px wide from `(x, y)`; use it for
  hand-drawn iso edges, planks, rails, roof lines
- draw back to front: loop `gy` outer, `gx` inner, and place taller objects last

## Lint intent

Tell the linter what is deliberate, so its warnings stay meaningful:

```xel
lint orphans=ink,gel.4          # single pixels of these colors are intended (eyes, glints)
lint region=10,4,6,3            # ignore orphans and banding inside this rectangle
lint maxcolors=16               # palette budget for this file
lint motion=off                 # the sprite moves on purpose (hops, steps): no anchor warnings
lint orphans=off                # scenes full of texture: skip the orphan check entirely
```

## Export statements

Optional. The CLI can do the same thing with flags; `--out <dir>` runs these.

```xel
export png  slime.png       scale=4 [frame=0] [bg=#101010]
export gif  slime-walk.gif  scale=4 [tag=walk] [loop=0]
export sheet slime.png      cols=4 [pad=0] [scale=1] [tag=walk]
export sheet slime.png      rows=idle,move [scale=1]   # one tag per row
export ascii slime.txt      [mode=palette|mask|value]
```

## Errors

Every error carries `file:line: command: message`, for example:

```
hero.xel:42: px: unknown color: skin.9
```

## Conventions that keep files readable

1. Start with a header comment: subject, canvas, palette, light, frame plan.
2. Declare the palette and ramps before any drawing.
3. One `part` per body element, named after the element.
4. Build frames from parts with offsets instead of redrawing them.
5. Keep the pass order: silhouette, flats, shadow, details, outline, aa.
