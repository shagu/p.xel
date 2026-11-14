# Isometric pixel art

## The projection

- True isometric is 30 degrees with all three axes at 120 degrees apart. On a pixel
  grid a 30 degree line gives an uneven staircase (3,2,3,2...), so pixel art does not
  use it.
- Pixel "isometric" is **dimetric**: a 2:1 line, two pixels across for one pixel down,
  about 26.565 degrees. Perfect, repeating staircase.
- **Two across, one down** is the entire foundation. Every receding edge follows it.
- Verticals stay vertical, one pixel per pixel.
- The 45 degree number you hear elsewhere is the flat diamond tile rotation, not the
  viewing slope.

## Tiles

- Floor tile is a diamond, twice as wide as tall: 32x16, 64x32, 128x64.
- Draw **one** perfect tile, lock its dimensions, copy it. Never eyeball a second tile;
  mismatched edges leave seams no touch-up fixes.
- Cuboid tiles: diamond top plus two vertical side faces. Tile height may vary as long
  as the top surface stays uniform.
- Textures on each of the three faces must loop seamlessly along all four sides of
  that face.
- Cube corner style is a taste decision; tiles that stick strictly to the 2:1 grid
  (sharp corners) tile perfectly, wide-corner styles need clever overlap.
- Tile sets usually need: flat floor, raised block, ramp/slope, wall segment N and W,
  corner pieces, plus props.

## Three-face shading

- Top: lightest (faces the sky).
- One side: mid tone.
- Other side: darkest.
- Same three values and the same light direction for **every** object in the scene.
  One crate lit from the other side destroys the illusion.
- Hue shift: warm the top, cool the dark face, or the blocks look like cardboard.

## Objects and characters

- Build objects from cuboids first, then sculpt details. Even trees start as geometry.
- Characters are a silhouette problem, not a grid problem. A strict 2:1 staircase on a
  face looks robotic. Draw the body with free curves but keep:
  - the stance iso-correct (feet planted as if standing on a diamond),
  - the drop shadow as a flat diamond ellipse on the floor,
  - the height consistent with tile height (a 64x32 tile usually pairs with a
    48-64 px tall actor).
- Sort order: draw back-to-front (painter's algorithm), objects further "up-left" first.
- Keep a single 2:1 reference line handy as a ruler; count pixels, do not trust the eye.

## Isometric drawing order for a scene

1. Decide tile size and light direction.
2. Floor tiles (back to front).
3. Elevation blocks and walls.
4. Static props (crates, barrels, pillars, trees).
5. Characters.
6. Overhead elements (canopies, banners).
7. Lighting pass: torch glows, cast shadows on the floor, ambient darkening at edges.

## Reference games

**Diablo II (2000)** - dark fantasy ARPG, sprites pre-rendered from 3D into 256-color
indexed frames, 8 facing directions, heavy black-level contrast, almost no bright
saturated color except magic effects, torchlight pools, mud-brown and blood-red
palettes, every armour piece readable as a silhouette. Characters are tall relative to
tiles; readable even against noisy ground. Palette-cycled fire and flowing lava.

**Age of Empires I (1997)** - Genie engine 2D sprites, 8 directions, small units
(about 30-50 px) that must read among dozens on screen: bright team-color accents,
simple strong silhouettes, flat lighting from above-left, minimal shading on units,
very detailed terrain tiles underneath. Lesson: unit clarity over unit detail.

**Commandos: Behind Enemy Lines (1998)** - hand-painted isometric WW2 scenes with
realistic muted palettes, tiny characters (about 20-30 px) on extremely detailed
pre-painted backgrounds, long cast shadows establishing time of day, cone-of-vision
overlays. Lesson: a quiet, desaturated background makes small sprites pop.

Common thread: one light direction, quiet background values, focal saturation reserved
for the player and interactive objects.
