# Hardware styles and how to imitate them

Authentic retro looks come from the limits, not from a filter. Pick a target machine,
adopt its constraints, and the style follows.

## Game Boy (DMG, 1989)

- 160x144 screen, 8x8 tiles, 2 bits per pixel = 4 shades, no hue at all.
- Sprite palettes: two 4-color palettes for objects (color 0 transparent), one for
  background.
- Palette: `#0f380f` `#306230` `#8bac0f` `#9bbc0f` (darkest to lightest green).
- Style rules:
  - darkest = outline and deep shadow, lightest = highlight and "pop",
    two middle greens do all the shaping.
  - value structure is the only tool; silhouette must carry everything.
  - sprites are 8x8 or 8x16 hardware objects; overworld characters are 16x16
    (four tiles), faces are suggested with 1-2 px eyes and no mouth.
  - heavy use of 1px black-green outline, chibi proportions (2 heads tall).
  - dithering used sparingly, mostly for 50% greys on large surfaces.

## Game Boy Color (1998)

- Same tile engine; 8 background palettes + 8 sprite palettes, 4 colors each,
  RGB555 (32768 possible). 32 colors on screen for sprites.
- Style: flat 3-4 tone materials, bright saturated primaries, dark outlines kept,
  background tiles in muted hues so sprites read. The benchmark look: 16x16 overworld
  characters, 2 walk frames per direction plus mirror, no shading beyond one shadow
  tone.

## NES (1983)

- 256x240, master palette of about 54 usable colors generated from the NTSC signal.
- 4 colors per tile (3 plus shared backdrop), 8 sprites per scanline (hence flicker).
- Style: strong flat colors, black outlines, attribute-clash-friendly layouts
  (color blocks aligned to 16x16 areas), bold simple shapes.

## Sega Mega Drive / Genesis (1988)

- 320x224 (or 256x224), 8x8 tiles, 4 palettes of 16 colors on screen,
  color 0 transparent, 9-bit color (3 bits/channel, steps 0,2,4,6,8,A,C,E) of 512.
- Style:
  - saturated, punchy, high-contrast palettes; blacks used freely.
  - heavy checkerboard dithering to fake extra shades and gradients
    (designed for CRT blur).
  - thick black outlines, strong rim light, metallic ramps.
  - big sprites assembled from many 8x8 tiles; characters 32-48 px with strong
    attitude poses, faces readable at a glance.

## SNES (1990)

- 256x224 (up to 512x448), 256 CGRAM entries of 15-bit BGR555 (32768 possible),
  8 sprite palettes of 16, several background layers, transparency and Mode 7
  (scale/rotate one layer per scanline).
- Style:
  - softer, pastel, hue-shifted ramps; less dithering than Mega Drive.
  - layered parallax backgrounds, additive transparency effects.
  - 16 colors per sprite palette allows 4-6 tone ramps, selective outlines,
    subtle skin shading on faces.

## Arcade / Neo Geo (for reference)

- Huge palettes (4096 colors on screen) and high frame counts.
  Run-and-gun arcade titles: 15+ frame animations, sub-pixel shading, dense detail.
  Only attempt this at 48px+ and with time to burn.

## PC / VGA (256-color, late 90s)

- 320x200 or 640x480, 256-color indexed palettes chosen per scene,
  color cycling for water/fire/lights.
- Style: realistic muted palettes, painterly backgrounds, sprites pre-rendered from 3D,
  dithered skies, strong cast shadows.

## Choosing

| Goal | Target |
| --- | --- |
| cute, tiny, nostalgic, 4 values | Game Boy DMG |
| cute, colorful, flat, 16x16 cast | Game Boy Color |
| punchy action, big sprites, dithering | Mega Drive |
| soft RPG, layered scenes, gradients | SNES |
| dark fantasy isometric, 256 colors | VGA 256-color |
| strategy isometric, many small units | late-90s RTS engine |
