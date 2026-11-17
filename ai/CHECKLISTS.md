# Checklists, budgets and pitfalls

## Detail budget per canvas

| canvas | head | eyes | mouth | hands | colors | outline |
| --- | --- | --- | --- | --- | --- | --- |
| 16x16 | 7-9 px tall, half the sprite | 1 px each | none | 1 px nubs | 3-4 (GB) / 4-6 | 1 px darkest |
| 24x24 | 8-10 px | 1x2 px | optional 1-2 px | 1-2 px | 6-8 | 1 px |
| 32x32 | 10-12 px (chibi) or 6-8 (heroic) | 1x2 or 2x2 with catchlight | 1-3 px | 2x2 mittens | 8-12 | selout |
| 48x48 | 10-14 px | 2x2 + catchlight | 2-4 px | 3x3, thumb suggested | 12-16 | selout |
| 64x64+ | free | full | full | fingers possible | 16-24 | selout + AA |

If a detail does not fit the budget, drop it or exaggerate it. Never cram.

## Gate checklists

### G1 silhouette (`--ascii mask` plus a PNG at scale 4)
- [ ] identity features (the 2-4 things that make the subject what it is) are
      named in the header with px sizes
- [ ] each identity feature changes the outline (bump, appendage) or is a value
      patch at least 2 steps from its surroundings; interior color patches alone
      do not count
- [ ] subject recognisable in the mask alone, and a 4x render answers "what is
      this?" with the subject, not a different one (a monkey that reads as a
      child has failed G1, however clean the craft)
- [ ] key feature exaggerated (hood point, horns, sword, ears)
- [ ] limbs separated from the torso by at least 1 px of gap or a value change
- [ ] no 1 px "hairs" sticking out unless intended
- [ ] feet on a consistent baseline, 1-2 px margin to the canvas edge

### G2 value (`--ascii value`)
- [ ] darkest step only in outlines and deepest shadow
- [ ] lightest step only in highlights
- [ ] neighbouring materials (skin vs cloth vs metal) differ in value, not only hue
- [ ] the face/focal point has the strongest contrast

### G3 palette (`--lint`, `--palette`)
- [ ] colors within budget, no near-duplicates
- [ ] every ramp hue shifted (shadows cooler, lights warmer unless the light is cold)
- [ ] no max-saturation + max-brightness swatch

### G4 clean (`--lint`)
- [ ] orphans = 0, or declared with `lint orphans=`
- [ ] no banding seam warnings
- [ ] outlines 1 px, no L-shaped doubles, consistent step rhythm (2-2-2, not 2-3-1)
- [ ] curves change step length gradually (4-3-2-1)

### G5 light
- [ ] one light direction across every object
- [ ] no pillow shading (dark rim all around, bright center)
- [ ] cast shadow on the ground where it belongs
- [ ] flat faces have one tone, round forms have a ramp

### G6 motion
- [ ] anchor (feet) stable, lint "baseline shift" 0-1 px
- [ ] body bob 1-2 px in walk cycles
- [ ] planted foot does not slide during contact frames
- [ ] arms swing opposite to legs
- [ ] secondary parts lag one frame
- [ ] loop: last frame flows into the first
- [ ] volume constant: limbs keep their length and thickness

### G7 style
- [ ] palette and outline policy match the preset in STYLES.md
- [ ] proportions match the preset

## Pitfalls (and the fix)

| pitfall | symptom | fix |
| --- | --- | --- |
| writing everything in one go | broken proportions found too late | one pass, one preview |
| raw coordinates everywhere | parts drift 1 px between frames | `part` + offsets, `mirror`, `repeat` |
| inventing colors inline | 40 colors, mud | declare ramps, reference `ramp.N` |
| pillow shading | form looks like a cushion | `sphere`/`cylinder` or shade from the light side |
| outline the same as shadow | blobby interior | selout or one step darker outline |
| speckle "detail" | sprite reads as dirty | clusters, then delete orphans |
| dithering small areas | static | flat cluster or band compression |
| mirrored symmetry everywhere | stiff, robotic | mirror the base, then break symmetry with light and one asymmetric detail |
| too subtle animation | nothing seems to move | exaggerate: 2 px instead of 1, longer holds on extremes |
| identity feature as a color patch only | subject reads wrong at a glance | make it an outline bump or appendage and exaggerate it |
| freehand art blocks for the whole body | drift, fragmented clusters, burnt budget on row math | assemble from primitives, art blocks for details only |
| copy the closest template blindly | its charm markers land on an unrelated subject | plan identity features first, then borrow craft, not subject |
| sliding feet | skating walk | keep the contact foot at the same x for its frames |
| art block indentation mistakes | shape shifted | rows are dedented by their common indent; keep all rows equally indented |
| characters not in `map` | compile error | add them to `map`, `.` and space are transparent |
| reviewing a cached image | "nothing changed" | new file name for every review render |
| 2:1 slope broken in iso | wobbly edges | use `isotile` / `isobox`, never freehand iso edges |
| props lit from different sides | scene falls apart | one `light`, `isobox ramp=` everywhere |

## Final report template

```
files    : out/x/x.xel, x.png, x.gif, x-sheet.png
canvas   : 32x32, 12 frames (idle 0-3, walk 4-11)
colors   : 11 (budget 12)
gates    : G1 ok, G2 ok, G3 ok, G4 2 intentional orphans (eyes), G5 ok, G6 ok, G7 ok, G8 ok
known    : walk up-pose arm is 1 px stiff
```
