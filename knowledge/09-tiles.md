# Tiles, tilesets and autotiling

## Three words that get mixed up

- **Tile**: one small image, usually square, designed to sit next to copies of itself.
- **Tileset**: the box of matching pieces (fill, edges, corners) that lets one surface
  meet another without a seam.
- **Tilemap**: the grid in the level that places those pieces.

A seamless tile fills space. A tileset shapes it.

## Size and grid

- Powers of two: 8x8 (Game Boy scale, minimal detail), 16x16 (the workhorse for
  terrain, floors and platformers), 32x32 (comfortable detail), 64x64 (large surfaces,
  rarely tiled).
- One tile size for the whole set. A 16x16 tile next to a 24x24 tile never lines up.
- One light direction and one palette for the whole set, same as a sprite cast. A tile
  borrowed from another set reads as a patch, not a material.
- Draw at 1x, in a tiled preview when the editor has one, and judge the tile in a 4x4
  repeat, never alone. The single square always lies.

## Seamless tiles

Opposite edges must agree: top row against bottom row, left column against right column.

- The offset trick: shift the canvas by half its width and half its height, wrapping.
  The four hidden border seams land in the centre as a cross. Repair the cross as if it
  were normal texture, then offset back.
- Repair on the existing palette. Blur, smudge and a fresh in-between colour turn pixel
  art into mud and break the palette.
- A shape that lands badly on the join gets moved, not smoothed.

Seamless is only half the job. The other half is hiding that it is the same tile again:

- Kill landmarks. One bright flower or one dark crack is a countable feature that will
  echo across the whole field.
- Spread small detail evenly, keep interior contrast gentle, save the strongest values
  for objects drawn on top.
- Cut two or three variants of the most used tile (same edges, different interior) and
  mix them.
- Scatter separate objects above the ground layer. That hides the grid better than any
  texture trick.

## Autotiling: the neighbour mask

Every autotile system works the same way: look at the neighbours of a cell, turn them
into a bitmask, pick the tile for that mask.

**Wang-16** asks one question per corner: is this corner terrain A or terrain B.
Four corners, two options each, 2^4 = **16 tiles**. Good for soft, diagonal-friendly
ground transitions (grass to dirt, sand to water). Its weakness: it cannot tell a
1-tile-wide path from a thick one, thin features come out blobby.

**Blob-47** looks at all 8 neighbours (N, NE, E, SE, S, SW, W, NW). Eight bits would be
256 combinations, but a corner only changes the picture when both edges beside it are
also filled. Fold those hidden cases away:

```
bits: N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128
if !(N and E) mask &= ~2
if !(S and E) mask &= ~8
if !(S and W) mask &= ~32
if !(N and W) mask &= ~128
```

Every mask 0..255 folds down to exactly **47 distinct results**. The mask describes the
neighbours of a filled cell, so mask 0 is a lone tile, not the empty background: 47
pieces cover the whole terrain. Blob sets are the right choice for walls, platforms,
cliffs, rivers and 1-tile-wide paths, anything where inner corners have to look
deliberate.

| need | set | tiles |
| --- | --- | --- |
| top-down ground, soft terrain mix | Wang-16 (4 corners) | 16 per pair |
| walls, cliffs, roads, platformers | blob-47 (8 neighbours) | 47 |
| small game, few terrains | 3x3 minimal | 5 base pieces |

**3x3 minimal** is the shortcut. Draw a 3x3 arrangement of small pieces, cut every cell
into quarters, and the same quarters recombine into the full 47. Godot ships a 3x3
minimal terrain mode for exactly this and five input tiles are enough to generate the
set. RPG Maker's A2 autotile is the same trick in a 2x3 template. Draw five pieces,
generate the rest, never hand-draw 47.

A common setup uses both: Wang-16 for the ground layer, blob-47 for anything the player
collides with.

## Edges that read as edges

- The transition is a border, not a gradient. One or two pixels of the second material
  plus a 1px darker seam on the outside reads better than a soft blend.
- The corner pieces do the work. Straight edges are easy, the inner corner (where two
  surfaces meet in a notch) is the tile everyone forgets and the one the eye finds.
- Water: foam or a lighter rim on the land side, deeper shade in the middle, ripple
  patterns horizontal. Low internal contrast, or water tiles worse than any solid
  surface.
- Cliffs and platforms: a lighter top face, 2-4 px of front face, one darker row at the
  bottom of that face, plus left and right caps so the strip can end.
- Rock, brick and stone: similar slab sizes and gentle variation. One oversized,
  distinctive slab becomes the landmark that repeats forever.

## Sheet layout

- Every cell the same size, laid out on the grid the engine expects. For a blob set,
  order tiles by their folded mask value so the lookup is a direct index.
- Keep 1px of empty padding, or extrude the border pixels, if the engine ever samples
  with a linear filter. Nearest filtering and integer scaling need neither.
- Ship the sheet plus the numbers: tile size, columns, first index, margin between
  terrain pairs. An unlabeled sheet costs the next person an hour of counting.

## Review checklist

1. Does the tile repeat 4x4 with no seam and no obvious landmark?
2. Squint at the repeat: any grid or checkerboard left?
3. Do all four edges agree with themselves?
4. Are the inner corners drawn, not faked with the fill tile?
5. Same palette, same light, same stroke width as the rest of the set?
6. Do the two most common tiles have a variant?

## In p.xel

There is no autotile command: you draw the pieces you need as `part`s or frames, then
stamp them. `ai/templates/tiles.xel` is a working stone floor tile plus its patch test.
The essential part is the stamping:

```xel
# one seamless 16x16 tile is one part; stone_1 and stone_2 keep the same edge strips
repeat 4 as ty
  repeat 4 as tx
    let v = if((($tx + $ty) % 2) == 1, 2, 1)   # alternate the variants
    draw stone_$v ($tx*16) ($ty*16)
  end
end
```

- A transition piece is just another `part`: the fill with one edge replaced by the
  second material. The 4 inner corners are the ones worth drawing first.
- A variant keeps the four edge strips and changes only the interior, so it can be
  mixed with the original anywhere.
- Flat ground carries no directional light. Sky-facing surfaces (a wall top, a ledge)
  are the only ones that get a lit row.

```bash
node xel.js tiles.xel --crop 0,0,16,16 --scale 8 --png tile.png   # one cell, zoomed
node xel.js tiles.xel --png patch.png --scale 4                  # the repeat test
```
