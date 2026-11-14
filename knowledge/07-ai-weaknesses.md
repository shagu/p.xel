# Where an AI fails at pixel art, and the guardrails

Honest self-analysis of a language model drawing pixel art, and what p.xel does about it.

## Failure modes

### 1. No eyes
I cannot see my own output while writing it. I emit coordinates and only find out later
whether they formed a knight or a smear.
**Guardrail:** every render produces an ASCII preview. Look at it after every single
build step. Never write more than one body part before previewing.

### 2. Coordinate arithmetic drift
Off-by-one errors, inconsistent limb lengths, shapes that do not touch, mirrored halves
that are one pixel apart. The grid "drifts" exactly like diffusion models' grids drift,
only for different reasons.
**Guardrail:** named anchors and relative placement instead of raw numbers; `mirror`
and `repeat` instead of hand-duplicating coordinates; symmetry checks in the linter.

### 3. Orphan pixels and noise
When I "add detail" I tend to sprinkle single pixels. That is exactly the static the
craft warns about.
**Guardrail:** `lint` reports orphan pixels, 1px clusters and isolated colors. Treat
every unexpected orphan as a bug.

### 4. Palette bloat
Left alone I invent a new shade for every surface. Real sprites use 6-12 colors.
**Guardrail:** palettes and ramps are declared up front; colors can only be referenced
by name; the linter reports the color count and warns above budget.

### 5. Pillow shading and flat lighting
Without a committed light direction I shade "edges dark, middle bright".
**Guardrail:** declare `light` once per file; use the built-in volume primitives
(`sphere`, `cube`, `cylinder`, `isocube`) that shade a form correctly from the
declared direction instead of hand-placing shadows.

### 6. Silhouette blindness
I will happily render a detailed hero whose outline is an unreadable blob, because I
was thinking in parts, not in shape.
**Guardrail:** `--ascii mask` renders the silhouette alone. Review the silhouette
before any shading, and again at the end.

### 7. Animation inconsistency ("boiling")
Hand-authoring each frame produces wobbling limb lengths, jumping anchors and
flickering outlines.
**Guardrail:** frames inherit from the previous frame (`from prev`), parts are reusable
blocks placed with per-frame offsets, and the linter diffs consecutive frames to report
how many pixels changed and whether the bounding box jumped.

### 8. Scale confusion
Detail planned for 64x64 attempted at 16x16: faces with mouths, fingers, buckles that
cannot exist in three pixels.
**Guardrail:** a detail budget table per canvas size (see ai/CHECKLISTS.md) and a rule
to draw the smallest readable version first.

### 9. Over-dithering
Dithering is cheap to type, so I overuse it. It turns small sprites into static.
**Guardrail:** dithering is only allowed in regions at least 8 px wide, and never on
faces or focal areas; the linter flags dither regions that are too small.

### 10. Losing the plan
Long files drift away from the original design, mixing styles and ramps.
**Guardrail:** every file begins with a header comment stating subject, canvas, palette,
light direction and frame plan. Re-read it before every pass.

### 11. Non-determinism temptation
Random noise, "artistic variation" and per-run differences make review and iteration
impossible.
**Guardrail:** the language is fully deterministic. The only randomness is a seeded
`scatter` with an explicit seed.

### 12. Premature polish
I tend to polish the first body part to perfection and then run out of budget for the
rest, ending with an unbalanced sprite.
**Guardrail:** fixed pass order - silhouette, flats, core shadow, details, outline,
AA/polish - with a preview between passes.

## The loop that works

```
plan -> write a small pass -> render ascii -> lint -> compare to the plan -> fix -> next pass
```

Never write a whole sprite in one shot. Three to six passes with previews beats one
long guess every single time.

## What I am good at

- Bookkeeping: palettes, ramps, frame tables, sheet layouts, direction sets.
- Repetition with exact variation: 8 directions, 12 tiles, 60 frames.
- Rule compliance once the rule is explicit and checkable.
- Geometric construction: 2:1 lines, diamonds, mirrored shapes, arcs.

So p.xel pushes the work into those strengths: declarative geometry, named parts,
generated volumes, machine-checked rules, and a readable preview on every iteration.
