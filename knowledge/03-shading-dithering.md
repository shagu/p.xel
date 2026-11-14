# Shading, light and dithering

## Shading is lighting, not smudging

Do not ask "where should it be darker?" Ask "where is the light, and which surfaces
face toward or away from it?"

## Step 1: commit to one light direction

- Default: top-left. Everything in the piece obeys it, forever.
- Mixed light directions between neighbouring objects is the fastest way to make a
  scene feel wrong.
- Perpendicular light is darker than direct light; the angle matters.

## Step 2: the light zones

On a rounded form under one light:

| Zone | Meaning |
| --- | --- |
| Reflection / specular highlight | smallest, brightest spot; glossy objects only |
| Highlight | lit area facing the light |
| Mid / base | the material's true color |
| Terminator | transition line between light and dark. In pixel art keep it **sharp** |
| Volume shadow | self-shadow where the form turns away |
| Bounce light | slightly brighter strip inside the shadow, light reflected off the ground |
| Cast shadow | sharp-edged patch the object throws on other surfaces |

Flat faces get one uniform tone each. Rounded faces may carry a ramp.
Most of these zones will not fit in a small sprite: cut them in this order
specular, bounce, reflected light last, core shape first.

## Step 3: order of operations

1. Flat base colors / silhouette.
2. Basic light and shadow with few colors.
3. Cast shadows.
4. Details, engravings, small parts.
5. Correct shapes, deepen shadows, strengthen highlights.
6. Outlines and anti-aliasing last, only where needed.

## Classic shading mistakes

- **Pillow shading**: lighting the center of a shape and darkening all edges evenly.
  No light direction, no volume. Lethal.
- **Soft faces**: flat surfaces blended into gradients. Flat planes get flat tones.
- **Value-only ramps**: mud. Hue-shift.
- **Banding**: long parallel cluster seams. Interlock or compress.
- **Too many bands**: a 5-tone sphere does not need 9 soft steps; compress.
- **Reversed AA values**: halftone darker than both neighbours reads as dirt.

## Dithering

Dithering alternates two palette colors in a pattern so the eye mixes them into a
third tone.

Patterns that matter:
- 50% checkerboard: cleanest mix, no two same-color pixels touch at the sides.
- 25% / 75%: one pixel in each 2x2 block, or its inverse.
- Ordered Bayer 2x2, 4x4, 8x8: a threshold matrix that steps smoothly between those
  densities; the right tool for long gradients.
- Random noise: almost always fails, reads as static.
- Solid A, 25, 50, 75, solid B gives a five-step gradient out of two colors.

When dithering earns its place:
- Large soft transitions: skies, fog, metal, water, glass.
- Hard palette limits (GB, Mega Drive, 1-bit, Spectrum-like).
- Surfaces at least 8-10 pixels wide. Smaller than that it becomes static.
- As a deliberate style (engraving look, Obra Dinn, demoscene).

When not to:
- Tiny sprites, focal faces, anywhere a clean cluster reads better.
- When you have enough palette slots to just add the in-between tone.
- Never dither *and* grain the same area.
- In animation, static dither patterns flicker and crawl. Either keep the pattern
  locked to the sprite (moves with it) or avoid dithering on moving parts.

Related techniques:
- **Band compression** instead of dithering: squeeze the transitional bands into a
  narrow strip and let the terminator stay sharp.
- **Selective noise / grain**: irregular surface detail, concentrated in shadow.
  Different job from dithering.

## 1-bit and extreme limits

With two colors only, value structure is everything: silhouette, dither density as
"grey", hatching for texture, and hard negative shapes. Four values (Game Boy) add
outline (darkest), deep shadow, base, highlight (lightest). Readability beats detail.
