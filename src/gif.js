// minimal animated GIF89a writer with a global palette, index 0 = transparent

function lzwEncode (indices, minCodeSize) {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let next = eoi + 1
  let dict = new Map()
  const out = []
  let cur = 0
  let curBits = 0

  const push = code => {
    cur |= code << curBits
    curBits += codeSize
    while (curBits >= 8) {
      out.push(cur & 0xff)
      cur >>= 8
      curBits -= 8
    }
  }

  push(clear)
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = prefix * 4096 + k
    if (dict.has(key)) {
      prefix = dict.get(key)
    } else {
      push(prefix)
      dict.set(key, next++)
      if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++
      if (next >= 4096) {
        push(clear)
        dict = new Map()
        next = eoi + 1
        codeSize = minCodeSize + 1
      }
      prefix = k
    }
  }
  push(prefix)
  push(eoi)
  if (curBits > 0) out.push(cur & 0xff)
  return Buffer.from(out)
}

function blocks (data) {
  const parts = []
  for (let i = 0; i < data.length; i += 255) {
    const slice = data.subarray(i, Math.min(i + 255, data.length))
    parts.push(Buffer.from([slice.length]), slice)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

// frames: [{ indices: Uint8Array(w*h), delay: ms }], palette: [[r,g,b], ...] (index 0 transparent)
export function encodeGIF (frames, palette, w, h, loop = 0) {
  let bits = 1
  while ((1 << bits) < palette.length) bits++
  if (bits > 8) throw new Error('gif palette too large: ' + palette.length)
  const tableSize = 1 << bits
  const gct = Buffer.alloc(tableSize * 3)
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i] || [0, 0, 0]
    gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2]
  }

  const parts = [Buffer.from('GIF89a', 'ascii')]
  const lsd = Buffer.alloc(7)
  lsd.writeUInt16LE(w, 0)
  lsd.writeUInt16LE(h, 2)
  lsd[4] = 0x80 | ((bits - 1) & 7) // gct present, color resolution, gct size
  lsd[5] = 0 // background index
  lsd[6] = 0
  parts.push(lsd, gct)

  if (frames.length > 1 || loop === 0) {
    parts.push(Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0', 'ascii'),
      Buffer.from([0x03, 0x01, loop & 0xff, (loop >> 8) & 0xff, 0x00]))
  }

  const minCodeSize = Math.max(2, bits)
  for (const f of frames) {
    const delay = Math.max(1, Math.round((f.delay ?? 100) / 10))
    const gce = Buffer.alloc(8)
    gce[0] = 0x21; gce[1] = 0xf9; gce[2] = 4
    gce[3] = (2 << 2) | 1 // disposal: restore to background, transparency on
    gce.writeUInt16LE(delay, 4)
    gce[6] = 0 // transparent index
    gce[7] = 0
    parts.push(gce)

    const idesc = Buffer.alloc(10)
    idesc[0] = 0x2c
    idesc.writeUInt16LE(0, 1)
    idesc.writeUInt16LE(0, 3)
    idesc.writeUInt16LE(w, 5)
    idesc.writeUInt16LE(h, 7)
    idesc[9] = 0
    parts.push(idesc, Buffer.from([minCodeSize]), blocks(lzwEncode(f.indices, minCodeSize)))
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}
