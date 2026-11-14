# Animation

## The 12 principles (Disney), applied to sprites

1. **Squash and stretch** - keep volume constant. Stretch along the direction of fast
   motion, squash on impact. The single biggest "alive" factor.
2. **Anticipation** - wind up before the action. One frame of crouch before a jump,
   pull the arm back before the swing.
3. **Staging** - one clear idea per frame. Keep the silhouette readable in every frame.
4. **Straight ahead vs pose to pose** - pose to pose (key frames first, in-betweens
   later) is the right default for cycles. Straight ahead suits fire, smoke, water.
5. **Follow through / overlapping action** - capes, hair, scabbards, antennae keep
   moving after the body stops, and move on their own timing (drag).
6. **Slow in / slow out** - more frames near the extremes, fewer in the fast middle.
   In pixel art, spacing between frames encodes speed; frame duration is the second dial.
7. **Arcs** - limbs rotate, so paths curve. Only machines move in straight lines.
8. **Secondary action** - a blink, a breath, a coat flap, supporting the main action.
9. **Timing** - frame count and duration define weight. Heavy = longer holds on
   extremes, fewer in-betweens; light = quicker, more even.
10. **Exaggeration** - at 32x32 a subtle motion is invisible. Push poses past realism.
11. **Solid drawing** - keep volume and proportion consistent across frames; no
    wobbling limb lengths, no boiling outlines.
12. **Appeal** - clear, interesting, consistent shapes. Personality shows in the pose.

## Pixel-specific timing

- Typical frame durations: 80-150 ms (7-12 fps) for walk / run cycles,
  120-200 ms for idle breathing, 40-80 ms for fast attacks or impact frames.
- More frames does not mean more energy. Three strong keys can beat eight soft ones.
- When removing frames from a cycle, keep contact and passing poses; drop recoil first,
  then the high point. Increase per-frame duration to preserve speed.
- Hold frames (same image, long duration) create weight and read as a pause.

## Walk cycle

Four key poses per leg, mirrored for the other leg (8 total for a full cycle,
4 total if the sprite is symmetric enough to reuse):

1. **Contact** - legs spread, front foot planted, back foot toe down. This is the
   "walking" screenshot pose.
2. **Down (recoil)** - body at its lowest, weight lands on the front foot, slight crouch.
3. **Passing** - back leg swings under the body, passes the planted leg, body rising.
4. **Up (high point)** - body at its tallest, rolling over the planted foot.

Non-negotiables:
- **The body bobs.** 1-2 px up and down at small sizes. A level head reads as a
  conveyor belt.
- **Plant the feet.** The weight-bearing foot must look locked to the ground while the
  body travels over it. Drifting feet = skating.
- Arms swing opposite to the legs.
- Block the four keys rough, loop immediately, fix the read before polishing pixels.
- In a game, match travel distance per cycle to the step length or the feet slide.

## Run cycle

- A run has an airborne moment: the up pose becomes a small jump, the body leans
  forward, the bob is bigger, strides are longer.
- Strong 3-frame run: two extreme stride poses (limbs extended, body tilted forward,
  fist thrown up) plus one pass frame with limbs tucked near the body, used twice.
- 6-frame cycles feel good for most games; 8 is smooth.

## Idle cycle

- Minimum requirement: something moves. Breathing bob of 1 px over 4-8 frames is the
  standard; cape or hair drag adds life.
- Cheap classic: reuse the 2-frame walk as a march in place (8-bit JRPG trick).
- Keep idle consistent across the whole cast.
- Secondary motions (blink, weapon shift, ear twitch) should be rare and off-beat so
  the loop does not feel mechanical.

## Sub-pixel animation

Move the colors, not the sprite. By shifting shading and edge anti-aliasing values
between frames you fake motion smaller than one pixel, letting a sprite breathe or sway
without the silhouette jumping. Needs at least 2-3 tones per material; the extra tones
pay for themselves. This is what makes Metal Slug sprites feel alive.

## Loops and consistency

- Always preview as a loop, never as a filmstrip.
- A single misplaced pixel becomes an eyesore after three loop cycles.
- Keep the anchor (feet baseline, sprite origin) identical across frames or the sprite
  jitters.
- Watch for boiling: outlines and clusters that change shape with no motivation.

## Directional sets (top-down / isometric)

- 4 directions: N, E, S, W. Mirror E to get W (saves half the work; only break the
  mirror when an asymmetric detail like a scabbard matters).
- 8 directions: add NE, SE, SW, NW; draw 5 unique (S, SE, E, NE, N) and mirror the rest.
- Keep head size, shoulder width and limb thickness identical across directions.
- Each direction's walk cycle reuses the same key poses and timing.

## Sprite sheets

- Fixed cell size, one animation per row, frames in order, consistent anchor in
  every cell.
- Document rows, frame counts and durations next to the sheet.
