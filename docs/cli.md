# The xel compiler

`xel.js` parses a `.xel` file, paints indexed frames and writes PNG, animated GIF,
sprite sheets or text previews. Pure Node, no dependencies, fully deterministic.

```
node xel.js <file.xel> [options]
```

## Output options

| flag | effect |
| --- | --- |
| `--png <path>` | write one frame as PNG (see `--frame`) |
| `--gif <path>` | write all frames as an animated GIF (frame `dur` drives timing) |
| `--sheet <path>` | write a sprite sheet PNG |
| `--out <dir>` | run every `export` statement in the file, rooted at `<dir>` |
| `--scale <n>` | integer nearest-neighbour upscale (default 1) |
| `--frame <n>` | frame index for `--png` and ascii previews (default 0) |
| `--tag <name>` | restrict `--gif` / `--sheet` to a tag |
| `--cols <n>` `--pad <n>` | sheet layout |
| `--rows <tag,tag>` | sheet with one tag per row |
| `--bg <#hex>` | flatten transparency onto a color |
| `--crop x,y,w,h` | cut a region out of every frame first (close-up review of big scenes; works with ascii too) |

PNG is RGBA with real transparency. GIF uses the palette with index 0 transparent and
disposal "restore to background", so transparent sprites animate correctly.

## Review options (the agent loop)

| flag | effect |
| --- | --- |
| `--ascii [mode]` | text preview: `palette` (default), `mask`, `value` |
| `--all` | preview every frame |
| `--stats` | canvas, frame, duration, pixel count, bounding box |
| `--lint` | craft checks (see below) |
| `--palette` | list ramps and colors with hex values |
| `--max-colors <n>` | palette budget for the linter (default 24) |
| `--strict` | exit code 3 if the linter warns |
| `--no-ruler` | drop the coordinate ruler |
| `--quiet` | write files, print nothing |

With no options at all, `xel` prints the palette preview and stats. That is the
intended default: look before you render.

### ascii modes

- `palette`: one character per palette color plus a legend. Characters come from the
  file's own `map` block where possible, so a preview can be pasted straight back into
  an `art` block.
- `mask`: `#` for painted, `.` for transparent. This is the silhouette test.
- `value`: digits `0` (black) to `9` (white) by perceived brightness, `.` transparent.
  This is the squint test for value structure; if two neighbouring materials show the
  same digit, they will not read apart.

Example:

```
$ node xel.js examples/slime/slime.xel --ascii mask --frame 0
   0         1         2         3
   01234567890123456789012345678901
 0 ................................
 ...
```

### lint checks

| check | why |
| --- | --- |
| colors used vs budget | palette bloat is the classic AI failure |
| declared but unused colors | dead palette entries, usually a typo |
| value range | low contrast sprites vanish at 1x |
| clusters and orphan pixels | a pixel with no same-color pixel among its 8 neighbours reads as dirt (dither patterns are excluded) |
| banding seams | long parallel cluster edges flatten a form |
| canvas edge contact | fine for tiles, suspicious for sprites |
| frame diffs | identical frames, and how many pixels moved, per tag including the loop seam (last -> first) |
| anchor jumps | the ground line (bbox bottom) or the horizontal center leaping between frames makes the sprite jitter |

Files can declare intent with `lint orphans=... region=... maxcolors=... motion=off`
(see the language reference), which keeps the remaining warnings meaningful.

Warnings are advice, not errors. Text-heavy images and deliberate sparkles will warn;
read them and decide. Use `--strict` in a build script when you want them to be fatal.

## Debugging

`XEL_TRACE=1 node xel.js f.xel` prints every executed statement (`file:line command`)
to stderr: the last line shows where a slow or broken file is. Coordinates that are not
numbers (for example a division by zero) and part recursion deeper than 64 stop with an
error instead of hanging.

## Exit codes

| code | meaning |
| --- | --- |
| 0 | success |
| 1 | parse / draw error (message carries file:line) |
| 2 | bad usage |
| 3 | `--strict` and the linter warned |

## Examples

```bash
# preview while drawing
node xel.js hero.xel --ascii
node xel.js hero.xel --ascii mask
node xel.js hero.xel --lint

# render
node xel.js hero.xel --png out/hero.png --scale 4
node xel.js hero.xel --gif out/hero-walk.gif --tag walk --scale 4
node xel.js hero.xel --sheet out/hero-sheet.png --cols 8
node xel.js hero.xel --out examples/hero     # follow the file's export statements
```
