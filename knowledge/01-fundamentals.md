# Fundamentals: grid, shapes, clusters

Pixel art is a grid medium. Every cell holds one chosen color, placed for a reason.
Good pixel art removes detail until only load-bearing pixels remain.

## Canvas sizes

| Use case | Size |
| --- | --- |
| icon, GB-style overworld character | 16x16 |
| top-down RPG character, small enemy | 32x32 |
| detailed character, iso actor | 48x48 ... 64x64 |
| fighting-game sprite | 64x64 ... 96x96 |
| scene / background (16:9) | 160x90, 256x144, 320x180 |
| iso floor tile | 32x16, 64x32 (always 2:1) |

Rules:
- One grid per image. Never mix pixel densities (mixels). Everything snaps to the same 1:1 cell.
- Scale only by integer factors with nearest neighbour. 2x, 3x, 4x. Never bilinear.
- Powers of two for tiles (16, 32, 64) so they drop into tilemaps.
- Decide size first; it dictates how much detail is even possible.

## Silhouette first

- Block the whole subject as one solid dark shape. If pose, class and mood do not read
  in pure black, no shading will save it.
- The silhouette is the character's logo. Check it at 1x zoom, constantly.
- Readable at a glance beats accurate. Exaggerate what identifies the subject
  (hood, sword, horns, ears) and delete the rest.

## Proportions

- Realistic proportions die below 64px: heads become smudges, limbs vanish.
- Below 32px use 2-3 heads tall (chibi). Bigger head carries expression, thicker
  limbs survive motion, hands become mittens.
- At 48px+ you can go 4-5 heads tall; at 64px+ 6 heads is possible.
- Pick proportions for the canvas, not for anatomy.

## Lines: the staircase model

There are no diagonal pixels. Any non-axis line is a staircase of flat segments.
Readability lives in the rhythm of segment lengths.

- Straight line = one repeating ratio, no exception: 1-1-1-1 (45 deg), 2-2-2-2,
  3-3-3-3, 4-4-4-4.
- A **jaggy** is one segment of wrong length in the run: 2-2-3-2 bumps.
- A **double** is a redundant pixel fattening a corner into an L. Keep lines 1px thick.
- Curves: segment lengths change gradually and monotonically. 4-3-2-1 tightens,
  1-2-3-4 opens. Never leap (4-1-3) and never reverse (4-3-4-2).
- Arch reference: 3,2,1,1,1,2,3. Tight elbow: 2,1,1,2.
- Diagnose by counting out loud. Nine times out of ten exactly one segment is wrong.
- Fix the skeleton first, then anti-alias. AA polishes a good line, it cannot rescue
  a bad one.

Deliberate doubles and chunky lines are style at higher resolution. A double you meant
is style; a double you did not notice is a bug.

## Clusters, orphans, banding

- A **cluster** is a contiguous group of same-color pixels. Think in clusters, not
  single pixels. A simple arm needs about three: shadow, base, light.
- A color fragmented into eight scattered patches across one form has shattered it.
  Keep clusters chunky. A 1px-wide long cluster reads as a wire, not a mass.
- An **orphan pixel** is a lone 1px cluster of its color. It reads as dirt. Absorb it
  into a neighbouring cluster or delete it.
  Honest exceptions: sparkles, particles, eye catchlight, blade tip. Never by accident.
- **Banding** is two clusters hugging along the same long diagonal, forming a visual
  seam that flattens the form. Fixes:
  1. interlock the edges (zipper them so no long parallel run survives),
  2. compress the bands into a narrow transition strip,
  3. break the repeating angle (let the ramp curve or change direction).
- Banding is a defect, dithering is a deliberate texture, anti-aliasing is edge
  softening. Three different things; do not mix them in one area.

## Texture

- Clusters first, speckle last. Wood = long grain clusters, stone = blocky,
  cloth = directional dashes. Lone pixels are the loudest marks on the canvas.
- No "salt": scattered random dark pixels read as compression artifacts.
  Concentrate irregularity where light breaks; keep lit planes calm.
- Vary cluster size more than color count. Three tones placed well beat six scattered.
- Texture only focal areas (face, hands, hero item). Backgrounds stay quiet.
- Zoom-out test: if the texture vanishes at display size, it was process, not product.

## Anti-aliasing (manual only)

- Automatic AA, soft brushes and blur are forbidden. They create orphan colors
  outside the palette and ruin crispness in animation.
- Method: find a staircase whose steps are 2px or longer, then place a halftone
  (a value between the two colors) after the step ends. Longer step = longer halftone.
- Never AA a 45 degree (1-1) line or a straight line.
- Keep AA direction aligned with the slope: horizontal slope, horizontal AA.
- Halftone value must bridge the two colors. Reversed value ramps read as dirt.
- Too much AA = blur. If AA does more harm than good, remove it.

## Outlines

- Hard dark outline: bold, reads on busy backgrounds, but flattens the sprite.
- No outline: painterly, risks blending into the background.
- Selective outline (selout): each outline pixel takes the darkest shade of the shape
  it touches; lighter or absent where the light hits, darkest on the shadow side.
  Softer, more lit, sits better in a scene.
- Keep outlines 1px, no L-corners, never doubled.
- Pick one outline policy and use it across the whole cast.

## Checklist before calling a sprite done

1. Does the silhouette read at 1x?
2. Any orphan pixels?
3. Any jaggies / doubles in the long lines?
4. Any banding seams in the gradients?
5. One light direction, consistently?
6. Palette count still tight?
7. Does detail survive the zoom-out test?
