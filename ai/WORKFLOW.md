# Workflows

Each procedure lists passes. After every pass: render, look, fix, then continue.
"Look" means `--ascii` (plus `mask` / `value` where noted) and `--lint`; and a PNG at
`--scale 8` if you can view images.

## A. Static sprite (character, enemy, item)

1. **Brief to plan.** Fill the header: subject, view (front, side, 3/4, iso),
   canvas, style preset, palette budget, light, outline policy (dark / selout / none).
2. **Proportions.** Decide the pixel budget before drawing. Example for 32x32 chibi:
   head 10-12 px tall, body 10, legs 6-8, feet on row 29-30, 1-2 px margin.
   Write the numbers into the header.
3. **Identity features.** List the 2-4 features that make the subject
   recognisable as a black silhouette (ears, muzzle, tail, horns, wings, weapon).
   For each one write the region, the size in px, and how it reads: an outline
   bump, an appendage, or a separate value patch. A feature must change the
   silhouette; an interior color patch alone does not read. Under ~3 px nothing
   reads, so exaggerate. Pick a pose that keeps every feature visible (a tail
   hidden behind the body is wasted budget).
4. **Pass 1 - silhouette.** Assemble the body from primitives: `oval`/`sphere`
   head and torso, limbs as narrow `cylinder` bars or boxes, ears as ovals that
   break the head outline. Use `art` blocks only for shapes no primitive can
   express. Check `--ascii mask`, then render a PNG at scale 4 and ask: what is
   this? If the answer is not the subject, restructure now, before any detail.
   Loop until yes. This is the most important pass.
5. **Pass 2 - flats.** Assign each material its ramp mid color. Use `only color` +
   `box`/`fill` to recolor regions without touching the outline of the shape.
6. **Pass 3 - light.** Lit side one step up, shadow side one or two steps down.
   Use `sphere`/`cylinder` for round masses, `only color` blocks for hand shading.
   Check `--ascii value`: light must come from the declared side everywhere.
7. **Pass 4 - details.** Identity features first (make each one read), then the
   rest: eyes, buckles, rivets, highlights. Charm markers (blush, catchlights)
   last. Each detail is a cluster or a deliberate single pixel. Add
   `lint orphans=` for intentional ones.
8. **Pass 5 - outline.** `outline selout` (soft, lit) or `outline ink` (bold).
   Then fix outline junctions by hand where needed.
9. **Pass 6 - polish.** Optional `aa`, specular dots, rim light. Run `--lint`.
   Fix every warning or justify it.
10. **Gates G1-G5, G7-G8.** Export.

## B. Animation (idle, walk, attack)

1. **Build the still** first with workflow A, but structured as `part`s:
   head, torso, each arm, each leg, accessories. Parameters are offsets.
2. **Pose plan table** in the header: one row per frame, columns = part offsets.
   Example walk (side view, 4 keys):

   ```
   frame    body_y  front_foot  back_foot  arms
   contact    0      +4          -4         swing max
   down      +1      +3          -3         passing
   passing    0       0          lifted     neutral
   up        -1      -2          +2         swing other
   ```
3. **Key poses first.** Write only the contact and passing frames, preview them with
   `--ascii --all`. Fix proportions now, while there are two frames.
4. **In-betweens.** Add down and up. Then the mirrored half (swap legs and arms).
5. **Timing.** `dur` per frame: walk 100-130 ms, run 70-90, idle 160-260 (hold the
   extremes longer), impact frames 40-60.
6. **Motion check.** `--lint` reports pixels changed and anchor shifts per frame.
   - anchor shift must be 0-1 px for in-place cycles (body bob is fine, feet sliding is not)
   - no frame identical to its neighbour (use longer `dur` instead)
   - render a GIF at scale 4 and watch it loop if you can view images; otherwise
     compare `--ascii mask --all` frames side by side.
7. **Secondary motion.** Cape, hair, weapon tip lag one frame behind the body
   (follow through). Add after the main motion works, never before.
8. **Tags and export.** `tag walk 0 7`, `tag idle 8 11`; export GIFs per tag and a
   sheet with one animation per row (`cols=` = frames per animation).

### Directional sets

- 4 directions: draw S (down), N (up), E (right); W = E mirrored with `group flipx=W-1`
  or `draw ... flipx=`. 8 directions: draw S, SE, E, NE, N; mirror SW, W, NW.
- Mirroring flips the lighting too. After mirroring a facing, relight it:
  `rim dir=l steps=1` brightens the edges facing the light, `rim dir=r steps=-1`
  darkens the far side. `sphere`/`cylinder` inside a mirrored group can take `light=tr`.
- Generate the frames with `repeat` + `frame walk_$k` and a pose table in the header,
  instead of writing 100 frames by hand.
- Use the same parts with direction variants (`head_s`, `head_e`, ...). Keep the same
  heights and the same pose table for every direction.
- Isometric directions follow the 2:1 floor: SE/NW movement runs along the
  `x = 2 * y` diagonal, SW/NE along the other one.
- Check every direction's frame 0 next to each other in one sheet before animating.

## C. Isometric scene and tileset

1. **Grid.** Choose tile size (32x16 small, 64x32 detailed) and light (`tl`).
   `isogrid ox oy tw th` with `ox` centered in the canvas.
2. **Floor**, back to front: `repeat gy` outer, `repeat gx` inner. Add 2-3 tile
   variants so the floor is not wallpaper.
3. **Floor lighting** (`glow`, `shade`) before blocks, so walls stay clean.
4. **Blocks and walls** with `isobox ... ramp=`; height in px; back to front.
5. **Props**: barrels (`cylinder` + ellipse top), crates (`isobox`), pillars, trees
   (geometry first: trunk cylinder + canopy spheres, then break the outline).
6. **Characters** last, with a flat diamond or ellipse shadow on the floor (`oval`
   2:1, dark ramp step, or `isoshadow`).
   To paint a background behind figures that are already outlined, draw it inside
   `only empty`: it fills only the transparent pixels.
7. **Light pass**: `glow` around light sources, `shade` in corners and under props.
8. **Tileset sheet**: put each asset in its own file or frame of the same canvas size,
   export a sheet with `export sheet`. Keep every tile on the same grid.

Screen position of tile `(gx, gy)`: top corner
`x = ox + (gx - gy) * tw/2`, `y = oy + (gx + gy) * th/2`; a block of height `h`
puts its top face `h` px higher.

## D. Text, UI and palette showcases

1. Use `text` with `font=5x7` for body text and `font=3x5` for tiny labels;
   `scale=2` or `3` for titles. Keep at least 1 px spacing, 2 px line gap.
2. Titles: draw the text twice, a dark shadow at +1,+1 (`shadow=`), or `outline`
   it on its own frame region.
3. Panels: `rect` with `fill=`, a 1 px light edge on the lit side, dark on the other.
4. Palette swatches: `box` per ramp step in a row, label with `3x5` text.
5. Dither demos: a strip per pattern with the same two colors, labelled.

## E. Review loop budget

| task | minimum loops |
| --- | --- |
| 16x16 sprite | 4 |
| 32x32 sprite | 6 |
| 48x48+ sprite | 8 |
| 4-frame cycle | 3 per key pose + 2 on the cycle |
| 8-direction set | 2 per direction + 2 on the set |
| iso scene | 2 per layer (floor, blocks, props, light) |

Stop when all gates pass, not when the loop budget is spent.
