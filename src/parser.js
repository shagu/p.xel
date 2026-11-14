// .xel parser: line based, block structured, no magic.

const BLOCK_CMDS = new Set(['part', 'frame', 'base', 'group', 'repeat', 'clip', 'only'])
const RAW_BLOCK_CMDS = new Set(['art', 'map', 'glyphs'])

export function tokenize (line) {
  const toks = []
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (c === ' ' || c === '\t') { i++; continue }
    // '#' starts a comment unless it is a hex color literal
    if (c === '#' && !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?![0-9a-fA-F])/.test(line.slice(i))) break
    if (c === '"') {
      let s = ''
      i++
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) { s += line[i + 1]; i += 2; continue }
        s += line[i++]
      }
      i++
      toks.push({ type: 'str', value: s })
      continue
    }
    let w = ''
    let depth = 0
    while (i < line.length && (depth > 0 || !' \t'.includes(line[i]))) {
      if (line[i] === '#' && w.length && !w.endsWith('=') && depth === 0) break
      if (line[i] === '(') depth++
      if (line[i] === ')') depth = Math.max(0, depth - 1)
      w += line[i++]
    }
    toks.push({ type: 'word', value: w })
  }
  return toks
}

export function parse (source, file = '<input>') {
  const lines = source.split(/\r?\n/)
  let pos = 0

  function parseBlock (stopAtEnd) {
    const out = []
    while (pos < lines.length) {
      const raw = lines[pos]
      const lineNo = pos + 1
      pos++
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const toks = tokenize(raw)
      if (!toks.length) continue
      const cmd = toks[0].value
      if (cmd === 'end') {
        if (!stopAtEnd) throw new Error(`${file}:${lineNo}: unexpected 'end'`)
        return out
      }
      const args = []
      const opts = {}
      for (const t of toks.slice(1)) {
        if (t.type === 'word') {
          const m = t.value.match(/^([A-Za-z_][\w-]*)=(.*)$/)
          if (m) { opts[m[1]] = m[2]; continue }
        }
        args.push(t.type === 'str' ? { str: t.value } : t.value)
      }
      const node = { cmd, args, opts, line: lineNo, file }
      if (RAW_BLOCK_CMDS.has(cmd)) {
        const body = []
        while (pos < lines.length) {
          const r = lines[pos]
          pos++
          if (r.trim() === 'end') break
          if (/^\s*#/.test(r)) continue
          body.push(r.replace(/\s+$/, ''))
        }
        // dedent raw blocks so indentation in the source does not shift the art
        const indents = body.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length)
        const cut = indents.length ? Math.min(...indents) : 0
        node.raw = body.map(l => l.slice(cut))
      } else if (BLOCK_CMDS.has(cmd)) {
        node.body = parseBlock(true)
      }
      out.push(node)
    }
    if (stopAtEnd) throw new Error(`${file}: missing 'end'`)
    return out
  }

  return parseBlock(false)
}

// tiny arithmetic expression evaluator: numbers, $vars, + - * / % ( ) and a few functions
export function evalExpr (src, vars) {
  const s = String(src)
  let i = 0
  function skip () { while (i < s.length && s[i] === ' ') i++ }
  // comparison has the lowest precedence and yields 1 or 0
  function cmp () {
    let v = expr()
    for (;;) {
      skip()
      const two = s.slice(i, i + 2)
      if (two === '<=') { i += 2; v = v <= expr() ? 1 : 0 } else if (two === '>=') { i += 2; v = v >= expr() ? 1 : 0 } else if (two === '==') { i += 2; v = v === expr() ? 1 : 0 } else if (two === '!=') { i += 2; v = v !== expr() ? 1 : 0 } else if (s[i] === '<') { i++; v = v < expr() ? 1 : 0 } else if (s[i] === '>') { i++; v = v > expr() ? 1 : 0 } else break
    }
    return v
  }
  function expr () {
    let v = term()
    for (;;) {
      skip()
      const c = s[i]
      if (c === '+') { i++; v += term() } else if (c === '-') { i++; v -= term() } else break
    }
    return v
  }
  function term () {
    let v = unary()
    for (;;) {
      skip()
      const c = s[i]
      if (c === '*') { i++; v *= unary() } else if (c === '/') { i++; v /= unary() } else if (c === '%') { i++; v %= unary() } else break
    }
    return v
  }
  function unary () {
    skip()
    if (s[i] === '-') { i++; return -unary() }
    if (s[i] === '+') { i++; return unary() }
    return atom()
  }
  function atom () {
    skip()
    if (s[i] === '(') {
      i++
      const v = cmp()
      skip()
      if (s[i] !== ')') throw new Error('expected ) in: ' + s)
      i++
      return v
    }
    if (s[i] === '$') {
      i++
      let n = ''
      while (i < s.length && /[\w]/.test(s[i])) n += s[i++]
      if (!(n in vars)) throw new Error('unknown variable $' + n)
      return Number(vars[n])
    }
    const fnMatch = /^([a-z]+)\(/.exec(s.slice(i))
    if (fnMatch) {
      const name = fnMatch[1]
      i += fnMatch[0].length
      const argv = []
      for (;;) {
        argv.push(cmp())
        skip()
        if (s[i] === ',') { i++; continue }
        break
      }
      skip()
      if (s[i] !== ')') throw new Error('expected ) in: ' + s)
      i++
      const fns = {
        min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
        round: Math.round, sqrt: Math.sqrt,
        sin: a => Math.sin(a * Math.PI / 180), cos: a => Math.cos(a * Math.PI / 180),
        clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
        sign: Math.sign,
        if: (c, a, b) => (c ? a : b)
      }
      if (!fns[name]) throw new Error('unknown function ' + name)
      return fns[name](...argv)
    }
    const num = /^-?\d+(\.\d+)?|^-?\.\d+/.exec(s.slice(i))
    if (num) { i += num[0].length; return parseFloat(num[0]) }
    throw new Error('cannot parse expression: ' + s)
  }
  const v = cmp()
  skip()
  if (i < s.length) throw new Error('trailing junk in expression: ' + s)
  return v
}

export function isNumeric (tok) {
  return typeof tok === 'string' && /^[-+.\d($]|^(min|max|abs|floor|ceil|round|sqrt|sin|cos|clamp|sign|if)\(/.test(tok)
}
