# Sources

Research behind `knowledge/`. All read in full during the project's research phase.

## Craft

- Pedro Medeiros (saint11), pixel art article series, parts 3-6:
  animation basics, shading and light, anti-alias and banding, color.
  https://saint11.art/pixel_art_articles/
- Raymond Schlitter (Slynyrd), Pixelblog 1 - Color Palettes:
  https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes
- Slynyrd, Pixelblog 8 - Intro to Animation:
  https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation
- Slynyrd, Pixelblog 41 - Isometric Pixel Art:
  https://www.slynyrd.com/blog/2022/11/28/pixelblog-41-isometric-pixel-art
- the-pixel.art: jaggies and doubles, dithering, hue shifting, selective outlining,
  clusters / orphan pixels / banding, walk cycle, isometric 2:1, pixel fonts,
  sprite sheets, seamless textures, color cycling, Game Boy green palette,
  "can AI make pixel art".
  https://the-pixel.art/articles/
- piximelon: pixel art characters, pixel art textures.
  https://piximelon.com/guides/
- pixor.art: selout.  https://pixor.art/learn/selout/
- 2dwillneverdie: sub-pixel animation.
  https://2dwillneverdie.com/tutorial/give-your-sprites-depth-with-sub-pixel-animation/
- pixelartworkshop: troubleshooting jaggies, mixels, muddy dithering.
  https://pixelartworkshop.com/guides/troubleshoot-jaggies-mixels-pixel-art-basics

## Hardware

- Pan Docs (Game Boy graphics and palettes): https://gbdev.io/pandocs/Graphics.html
- Plutiedev, Mega Drive tiles and palettes: https://www.plutiedev.com/tiles-and-palettes
- SNESdev wiki, palettes: https://snes.nesdev.org/wiki/Palettes
- Sega Genesis technical overview (segaretro)
- Fabien Sanglard, how the SNES graphics system works

## Animation and projection theory

- Wikipedia: Twelve basic principles of animation, Walk cycle, Skeletal animation,
  Isometric video game graphics
- Reference eras: late-90s dark fantasy ARPG, isometric RTS and WW2 tactics, arcade
  run-and-guns, 8-bit handheld overworld maps.

## Tiles and autotiling

- the-pixel.art, how to make seamless tileable pixel art textures: power-of-two sizes,
  the offset-by-half trick, repairing on the palette, killing landmarks, variants.
  https://the-pixel.art/articles/seamless-tileable-pixel-art-textures/
- Sandro Maglione, how to create a pixel art tileset: the 16 basic tiles, single-tile
  platforms, inner corners, the full 47 plus empty set, tile variants.
  https://www.sandromaglione.com/articles/how-to-create-a-pixel-art-tileset-complete-guide
- Comficker, Wang-16 vs blob-47: corner and edge masks, why 256 collapses to 47,
  which layout suits ground, walls and thin paths.
  https://comficker.hashnode.dev/wang-16-vs-blob-47-how-auto-tile-sets-actually-work-and-which-one-to-draw
- Godot 3x3 minimal autotile generator (asset library), 5 pieces cut into quarters
  composing the 47 tiles. https://godotengine.org/asset-library/asset/1056

## User interface

- Godot, NinePatchRect class reference: patch margins, stretch, tile and tile-fit
  modes, content padding. https://docs.godotengine.org/en/stable/classes/class_ninepatchrect.html
- Lam, pixel art 9-slice UI panels in Godot 4: margins equal to the border, plain
  edges, flat centre, minimum size, nearest filtering, integer stretch.
  https://dev.to/hoanganhlam/pixel-art-9-slice-ui-panels-in-godot-4-without-blurry-or-fat-borders-ma
- SpriteLab, 9-slice game UI in Godot, Unity and CSS: the mistakes that make UI look
  cheap (thin borders, per-state margins, ornaments in the centre, fractional scale).
  https://spritelab.dev/guides/9-slice-game-ui
- Spritefy, pixel art UI: sizes for a 320x180 game, button states, frame-and-fill
  bars, the grayscale and busiest-scene tests.
  https://spritefy.com/blog/pixel-art-game-ui-design
- Pixnote, pixel art text and fonts: 3x5 and 5x7 grids, uniform 1px strokes, look-alike
  characters, counters, baseline, spacing and kerning.
  https://pixnote.net/en/learn/pixel-text/
