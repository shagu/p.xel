// builtin palettes. hardware ones are faithful, "p.xel" ones are curated for this project.
// every palette exposes ramps (ordered dark -> light) and plain colors.

export const PALETTES = {
  // original Game Boy DMG: four shades of green, 2bpp
  gameboy: {
    ramps: { gb: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
    colors: { ink: '#0f380f', shade: '#306230', tone: '#8bac0f', paper: '#9bbc0f' }
  },
  // popular modern greenscale variant of the DMG look
  'gameboy-soft': {
    ramps: { gb: ['#081820', '#346856', '#88c070', '#e0f8d0'] },
    colors: { ink: '#081820', shade: '#346856', tone: '#88c070', paper: '#e0f8d0' }
  },
  '1bit': {
    ramps: { bw: ['#000000', '#ffffff'] },
    colors: { ink: '#000000', paper: '#ffffff' }
  },
  // dark fantasy isometric ARPG look (Diablo II flavoured), 24 colors
  'dark-fantasy': {
    ramps: {
      steel: ['#15161c', '#2b2f3c', '#474d60', '#6b7488', '#9aa3b4'],
      gold: ['#2a1c08', '#5c3c12', '#9a6a1e', '#cf9b34', '#f2d079'],
      blood: ['#200508', '#4a0d12', '#7d1a1f', '#b02e2a', '#d9564a'],
      flesh: ['#2a1410', '#5c2f22', '#8f5137', '#bd7c54', '#e0a87b'],
      stone: ['#131316', '#26262c', '#3d3d45', '#585863', '#787886'],
      moss: ['#0e1a10', '#1d3320', '#305232', '#497249', '#6b9460']
    },
    colors: { void: '#07070a', ember: '#ff9b3d', spirit: '#7ad7f0' }
  },
  // bright 16-colour cast palette for small sprites (GBC / Pokemon flavoured)
  'pocket-16': {
    ramps: {
      skin: ['#6b3a2a', '#b06840', '#e8a877', '#ffd8b0'],
      cloth: ['#1b2a52', '#2f4f9e', '#5a86d8', '#9cc2f5'],
      leaf: ['#17411f', '#2d7a34', '#5bb44a', '#a8e06a']
    },
    colors: { ink: '#0b0b13', white: '#f8f8f8', red: '#d83b3b', gold: '#f2c14e', shadow: '#3a3a5c' }
  },
  // punchy 16-bit console look, high contrast, dither friendly
  'md-punch': {
    ramps: {
      blue: ['#00224e', '#0046a8', '#0a8ae0', '#6ed2ff'],
      red: ['#3c0008', '#a00020', '#e04040', '#ff9c80'],
      green: ['#02250e', '#06661e', '#22ae3a', '#86f06a'],
      grey: ['#000000', '#303040', '#707080', '#c0c0d0', '#ffffff']
    },
    colors: { yellow: '#ffd000', magenta: '#e000a0', cyan: '#00e0e0' }
  },
  // soft 16-bit RPG look, pastel, hue shifted, little dithering
  'snes-soft': {
    ramps: {
      skin: ['#6a3b3f', '#a3656a', '#d49b92', '#f3d2bb'],
      robe: ['#2a2350', '#4a3f87', '#7a6fc0', '#b3aae6'],
      grass: ['#20402a', '#3c6e3f', '#6aa35c', '#a7cf86'],
      wood: ['#2f2018', '#56392a', '#866044', '#bb9269']
    },
    colors: { sky: '#bfe3f5', ink: '#1a1620', white: '#fdfdf5', accent: '#ffb347' }
  }
}

export function listPalettes () {
  return Object.keys(PALETTES)
}
