# Color: ramps, hue shifting, palettes

## HSV is the working model

- **Hue** = the identity of the color (0-360). Blue and purple read darker than
  yellow at the same value; compensate.
- **Saturation** = intensity. Avoid 100%. Large low-saturation areas with small
  high-saturation accents rest the eye.
- **Value** = amount of light. Directly tied to the light situation.
- **Temperature** emerges from all three: red hues hot, blue hues cold; high
  saturation pushes to extremes; high value usually reads warmer. Pure grey reads
  slightly cold.

## Color ramps

A ramp is an ordered set of tones used for one material, sorted by brightness.
Build the ramp **before** shading. Then shading becomes "which ramp step is this pixel?"

Rules for a good ramp:
- Value climbs steadily; steps get smaller near the top (eye is less sensitive there).
- Saturation peaks in the middle, never hits 0 or 100. Dark ends stay rich,
  bright ends fade toward pale.
- Never combine max saturation with max brightness on one swatch. It vibrates and
  flattens the form around it.
- Hue shifts along the ramp: about 10-20 degrees per step.
  - 10-15 deg/step for skin, wood, anything the viewer knows well.
  - 15-20 deg/step for foliage, slime, crystal, magic.
  - 25+ deg/step only for stylised or dream-like work.
  - Degrees stack: five swatches at 20 deg span 80 deg total.
- Default direction: highlights drift toward yellow/orange, shadows toward blue/purple
  (sunlight warm, sky-filled shadows cool).
- Flip it for moonlight, neon, screens, overcast: highlights take the light's hue
  (cyan, pink, pale blue), shadows go warmer by contrast.

Value-only ramps ("flashlight fade") look muddy and grey. That is the single most
common beginner color failure.

Ramp lengths:
- 3 tones: shadow, base, light. Minimum, fine for 16x16.
- 5 tones: dark shadow, shadow, base, light, highlight. Workhorse for 32x32+.
- 7-9 tones: large sprites, scenes, smooth metal.

## Palette discipline

- Per character: 6-12 colors. One signature hue family, neutrals, exactly one accent
  on one focal item.
- Characters in a cast: share proportions, palette family, outline weight; differentiate
  by one signature hue plus silhouette.
- Allies vs rivals should differ in **value structure first**, hue second, so they read
  in grayscale.
- Reuse ramps across materials where possible (a dark skin tone can double as leather).
- Scene palettes: 16-32 colors is plenty; 64 is luxurious.

## Color schemes

- **Monochromatic**: one hue, strong and stylised. Still hue-shift the light.
- **Complementary**: strong contrast; one hue dominates, the opposite appears only in
  accents. Aggressive at high saturation.
- **Analogous**: main hue plus neighbours. Calm, harmonious, low contrast.
- Triad / split-complementary / square: more variety, more risk of busy images.
- Avoid many unrelated hues in one small image.

## Classic hardware palettes (use these for authentic demakes)

Game Boy DMG (2bpp, 4 shades of green):
`#0f380f` darkest, `#306230` dark, `#8bac0f` light, `#9bbc0f` lightest.

Game Boy Pocket / 1-bit variants: same four steps in grey (`#081820 #346856 #88c070 #e0f8d0`
is the popular "greenscale" variant used by many modern artists).

NES: fixed master palette of ~54 usable colors generated from the TV signal;
4 colors per 16x16 attribute area (3 + shared backdrop).

Sega Mega Drive: 4 palettes of 16 colors on screen, color 0 transparent;
9-bit color (3 bits per channel, even steps 0,2,4,6,8,A,C,E) = 512 possible colors.
Style consequence: heavy dithering, strong saturated primaries, bold black outlines.

SNES: 256 entries of 15-bit BGR555 (32768 possible). More colors per sprite
(16 per palette, up to 8 sprite palettes), so softer gradients, pastel ramps,
less dithering, more hue shifting. Mode 7 scales/rotates one background layer.

Good modern palettes to study: Endesga-32, Resurrect-64, AAP-64, Sweetie-16,
Mondo-128. All built from hue-shifted ramps.

## Color cycling (palette animation)

In an indexed image a pixel stores a slot number, not a color. Rewrite the slot and
every pixel pointing at it changes instantly. Rotate a run of slots in a loop and you
get flowing water, rain, fog, fire, scrolling lights, with zero extra frames.
Compose the art so the cycled slots are only used by the thing that should move.
