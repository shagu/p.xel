# Style presets

Pick one preset per piece. Each lists palette, proportions, outline and shading rules.
Background: [../knowledge/06-hardware-styles.md](../knowledge/06-hardware-styles.md).

## gameboy (DMG)

- `palette gameboy`; 4 values only: `gb.0` outline/deep shadow, `gb.1` shadow/dark
  material, `gb.2` mid, `gb.3` highlight/skin/paper. No other colors, ever.
- 16x16 overworld characters (2 heads tall), 8x8 or 16x16 items and tiles.
- 1 px `gb.0` outline all around; eyes 1x1 or 1x2 `gb.0` pixels; no mouth.
- `gb.2` and `gb.3` are close in brightness: separate face and clothes with the outline
  or a `gb.1` line, never with those two shades alone.
- Shading: one shadow tone per material; sprite must read against `gb.3` and `gb.2`
  backgrounds alike.
- Dither only on large background areas (sky, water), 50% checker.
- Walk: 4-beat cycle (stand, step L, stand, step R), 180-250 ms per frame. Side view
  uses 2 frames (stand, stride) mirrored for the other direction.

## pokemon (GB / GBC overworld)

- Same proportions as gameboy: 16x16, head is rows 0-8, body 9-15, big head with a
  defining hat/hood/hair shape, tiny body, legs 2-3 px.
- GBC variant: 4 colors per sprite palette, transparent + 3 visible: outline, color,
  light; use `pocket-16` ramps or a custom 3-color ramp per character.
- Front (S), back (N), side (E, W mirrored). Back view shows hood/hair mass, no face.
- No anti-aliasing, no selout: hard dark outline.

## snes (16-bit RPG)

- `palette snes-soft` or custom ramps of 4-5 hue-shifted steps; 12-16 colors per
  sprite.
- 24x32 to 32x48 characters, 3-4 heads tall.
- Selective outline, soft pastel highlights, little dithering, warm light / cool shadow.
- Backgrounds layered, gradients with band compression.

## megadrive (16-bit action)

- `palette md-punch` or custom ramps on the 9-bit grid (channel values 00 24 48 6c 90
  b4 d8 fc), 15 colors per sprite + transparent.
- Saturated, high contrast, black outlines, strong rim light, checker dithering on
  metal and sky.
- 32-48 px characters with attitude poses.

## dark-fantasy-iso (Diablo II flavoured)

- `palette dark-fantasy`; desaturated earth and steel, blood red and gold accents,
  `ember` for fire light, `spirit` for magic. Near-black `void` shadows.
- 2:1 isometric, 32x16 or 64x32 tiles; characters 40-64 px tall on 48-64 px canvases.
- Hero readable by value: armor plates catch rim light; cape and weapon break the
  silhouette.
- Lighting: dark floor, `glow` pools from torches, `shade` toward the scene edges.
- 8 facing directions (S, SW, W, NW, N, NE, E, SE); draw 5 and mirror 3.
- Walk 8 frames at ~90-110 ms, idle 4-8 frames at ~150-200 ms (breathing + cape).

## strategy-iso (Age of Empires / Commandos flavoured)

- Muted, realistic palette with one bright team color accent per unit.
- Small units (16-32 px tall) on detailed, quiet ground tiles.
- Flat top-left light, long soft cast shadows on the floor.

## cute (generic modern)

- 32x32, round shapes (`sphere`, `oval`), 2 heads tall or a single blob body.
- Saturated mid tones, hue shift 15-20 degrees per step, selout.
- Big eyes: 2x3 px with a 1 px catchlight. Squash and stretch on every bounce.
