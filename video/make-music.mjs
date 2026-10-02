// usage: node video/make-music.mjs out.wav 100
// makes a soft, calm background track (no copyright issues, we make it ourselves)
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = process.argv[2]; const seconds = Number(process.argv[3] || 100)
const b = await chromium.launch()
const p = await b.newPage()
const b64 = await p.evaluate(async (seconds) => {
  const sr = 44100
  const ctx = new OfflineAudioContext(2, sr * seconds, sr)
  const master = ctx.createGain(); master.gain.value = 0.5
  // simple reverb from a made-up room echo
  const conv = ctx.createConvolver()
  const ir = ctx.createBuffer(2, sr * 3, sr)
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) }
  conv.buffer = ir
  const wet = ctx.createGain(); wet.gain.value = 0.35
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.3
  lp.connect(master); lp.connect(conv); conv.connect(wet); wet.connect(master); master.connect(ctx.destination)

  const bpm = 72, beat = 60 / bpm, bar = beat * 4
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)
  // Fmaj7 - Em7 - Dm7 - Cmaj7 (warm and calm)
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
  const roots = [41, 40, 38, 36]

  function note(freq, start, len, vol, type = 'sine') {
    for (const detune of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(vol, start + 0.02)
      g.gain.exponentialRampToValueAtTime(vol * 0.35, start + 0.6)
      g.gain.exponentialRampToValueAtTime(0.0001, start + len)
      o.connect(g); g.connect(lp); o.start(start); o.stop(start + len + 0.05)
    }
  }
  for (let t = 0, i = 0; t < seconds; t += bar, i++) {
    const c = chords[i % 4]
    // soft keys: chord on beat 1, a gentle broken chord after
    c.forEach((n, k) => note(midi(n + 12), t + k * 0.03, bar * 0.95, 0.035, 'triangle'))
    ;[0, 2, 1, 3].forEach((k, j) => note(midi(c[k] + 24), t + beat * (1.5 + j * 0.5), beat * 1.6, 0.012, 'sine'))
    // warm bass
    note(midi(roots[i % 4]), t, bar * 0.9, 0.06, 'sine')
    // very quiet brushed hi hat
    for (let h = 0; h < 8; h++) {
      const len = 0.05, st = t + h * beat / 2
      const buf = ctx.createBuffer(1, sr * len, sr); const d = buf.getChannelData(0)
      for (let q = 0; q < d.length; q++) d[q] = (Math.random() * 2 - 1) * Math.pow(1 - q / d.length, 4)
      const s = ctx.createBufferSource(); s.buffer = buf
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
      const g = ctx.createGain(); g.gain.value = h % 2 ? 0.006 : 0.01
      s.connect(hp); hp.connect(g); g.connect(master); s.start(st)
    }
  }
  const buf = await ctx.startRendering()
  // turn it into a wav file
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length
  const out = new DataView(new ArrayBuffer(44 + n * 4))
  const w = (o, s) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)))
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true)
  out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true)
  out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true)
  for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true) }
  const bytes = new Uint8Array(out.buffer); let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}, seconds)
fs.writeFileSync(out, Buffer.from(b64, 'base64'))
await b.close()
