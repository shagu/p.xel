# Engine internals

Plain Node (ESM), no dependencies beyond `node:fs`, `node:path` and `node:zlib`.

```
xel.js            cli: argument parsing, output selection, review printing
src/parser.js     tokenizer, block parser, arithmetic expression evaluator
src/interp.js     executes the AST, owns the document (palette, frames, tags, exports)
src/canvas.js     palette, frame, drawing context and every drawing algorithm
src/color.js      hex / hsv helpers and the deterministic auto ramp
src/palettes.js   builtin palettes
src/fonts.js      hand-drawn 5x7 and 3x5 bitmap fonts
src/ascii.js      ascii previews (palette, mask, value) and stats
src/lint.js       craft checks
src/render.js     rgba conversion, scaling, sheets, frame selection
src/png.js        png encoder (rgba8, zlib)
src/gif.js        gif89a encoder (lzw, global palette, transparency, looping)
test/run.js       regression suite: node test/run.js
```

## Pipeline

1. **Parse.** Lines become nodes `{ cmd, args, opts, line }`. Block commands
   (`part frame base group repeat clip only`) collect children until `end`; raw block
   commands (`art map`) keep their lines verbatim, dedented by the common indent.
2. **Run.** The interpreter walks the nodes. Numbers go through the expression
   evaluator, colors through the palette resolver, `$name` arguments through the
   variable scope chain (parts and loops create child scopes).
3. **Paint.** Every drawing call goes through `Ctx.set`, which applies the transform
   stack (`group`, `draw dx= flipx=`), the clip rectangle and the paint mask (`only`).
   Post-processing commands (`outline`, `aa`, `mirror`, `dropshadow`, `replace`) work
   on the whole current frame.
4. **Output.** Frames are `Uint8Array`s of palette indices (0 = transparent). PNG
   converts to RGBA; GIF keeps the indices and the shared palette directly.

## Determinism

- No clocks, no unseeded randomness. `scatter` uses mulberry32 with an explicit seed.
- All rasterizers are integer based or round consistently.
- Palette order is the order of first declaration, so ascii characters are stable.

## Algorithms worth knowing

- **Ellipses and discs** use per-row spans `half = floor((rx + .5) * sqrt(1 - dy^2 / (ry + .5)^2))`,
  giving symmetric shapes with clean step rhythm. Outlines are the span borders plus
  vertical gap closing.
- **Iso diamonds** use rows of width `4d + 2` (for 2:1), so neighbouring tiles at
  `(+-tw/2, +-th/2)` interlock exactly without overlap or gaps.
- **Sphere / cylinder** shading quantises a lambert term into ramp bands with a sharp
  terminator, then lifts shadow-side rim pixels one step (bounce light) and removes
  lone band pixels.
- **Selout** picks the majority neighbour color per outline pixel, goes `shade` steps
  down its ramp (one less on the lit side), derives a darker color if the ramp ends,
  then recolors any isolated outline pixel to its outline neighbours' color.
- **glow / shade** move existing pixels along their own ramp: solid core, bayer
  dithered falloff ring. That is lighting without new colors.
- **Auto ramps** rotate hue per step, bell-shape the saturation, then correct HSV
  value until perceived luma steps are even.

## Limits

- 255 colors per document (index 0 is transparent).
- All frames share one canvas size and one palette.
- GIF timing has 10 ms resolution.
