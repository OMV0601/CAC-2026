// builds the final demo video:
//   1. cleans up each voice MP3 (trims silence, evens out the volume)
//   2. records the slides and the auto demo frame by frame (perfectly smooth)
//   3. crossfades everything, makes captions, adds quiet music under the demo
//
// usage (with the app running: npm run build && npm run preview -- --port 4175):
//   node video/build-video.mjs <audio folder> <output.mp4>
// without MP3s it still makes a silent draft, timed from the script
//
// needs: playwright (dev dependency) and ffmpeg (set FFMPEG=/path/to/ffmpeg)

import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const BASE = process.env.BASE_URL || 'http://localhost:4175'
const FPS = 30
const FADE = 0.5 // crossfade between parts of the video
const LEAD = 0.8 // quiet moment at the start of each segment, before talking
const GAP = 0.35 // breath between two voice parts in the same segment
const TAIL = 0.6 // after the last words of a segment
// captions go in the .srt for YouTube (viewers can turn them on).
// CAPTIONS=1 burns them into the video too
const BURN = process.env.CAPTIONS === '1'

const audioDir = process.argv[2] || 'video/audio'
const outFile = process.argv[3] || 'video/out/lexicon-demo.mp4'
const work = path.join(path.dirname(outFile), 'work')
mkdirSync(work, { recursive: true })

const here = path.dirname(new URL(import.meta.url).pathname)

// ---- the script: part id -> speaker + words ----
const parts = {}
let currentPart = null
for (const line of readFileSync(path.join(here, 'SCRIPT.md'), 'utf8').split('\n')) {
  const head = line.match(/^## (\d\d)-(\w+)\.mp3/)
  if (head) {
    currentPart = head[1]
    parts[currentPart] = { id: head[1], speaker: head[2], file: `${head[1]}-${head[2]}.mp3`, text: '' }
  } else if (line.startsWith('> ') && currentPart) {
    parts[currentPart].text += (parts[currentPart].text ? ' ' : '') + line.slice(2).trim()
  }
}

// the order of the video
const segments = [
  { name: 'hook', slide: 'hook', parts: ['01'] },
  { name: 'why', slide: 'why', parts: ['02'], tail: 4.6 },
  { name: 'title', slide: 'title', parts: ['03', '04'] },
  { name: 'demo', demo: true, parts: ['05', '06', '07', '08'], music: true },
  { name: 'rule', slide: 'rule', parts: ['09'] },
  { name: 'arch', slide: 'arch', parts: ['10'] },
  { name: 'learned', slide: 'learned', parts: ['11'], tail: 3.4 },
  { name: 'ending', slide: 'ending', parts: ['12', '13'], cue: 'part2', tail: 2.4 },
]

function run(args) {
  return execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] })
}

function probeSeconds(file) {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    const m = String(err.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/)
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  }
  throw new Error('could not read length of ' + file)
}

// ---- 1. voice clean up ----
// finds "05-om.mp3" (or .m4a, .mp4, .wav...) in the audio folder
const audioFiles = existsSync(audioDir) ? readdirSync(audioDir) : []
function findRecording(p) {
  const name = audioFiles.find((f) => f.toLowerCase().startsWith(`${p.id}-${p.speaker}.`))
  return name ? path.join(audioDir, name) : null
}

function cleanVoice(src, wav, speed) {
  run([
    '-i', src, '-vn',
    '-af',
    [
      // trim silence at both ends
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12',
      'areverse',
      // long pauses in the middle get shortened to half a second
      'silenceremove=stop_periods=-1:stop_threshold=-45dB:stop_duration=0.6:stop_silence=0.45',
      // cut rumble and hiss, gentle compression, even loudness
      'highpass=f=80',
      'afftdn=nf=-28',
      'acompressor=threshold=-20dB:ratio=3:attack=5:release=120',
      ...(speed > 1.001 ? [`atempo=${speed.toFixed(4)}`] : []),
      'loudnorm=I=-16:TP=-1.5:LRA=9',
    ].join(','),
    '-ar', '48000', '-ac', '2', wav,
  ])
  return probeSeconds(wav)
}

let haveVoice = true
for (const p of Object.values(parts)) {
  p.src = findRecording(p)
  if (!p.src) {
    haveVoice = false
    // no recording yet: guess how long it takes to say (about 2.6 words a second)
    p.dur = p.text.split(/\s+/).length / 2.6
    continue
  }
  p.wav = path.join(work, `voice-${p.id}.wav`)
  p.dur = cleanVoice(p.src, p.wav, 1)
}

// the pauses inside a cleaned recording: [[start, end], ...]
function pauses(wav) {
  let log = ''
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', wav, '-af', 'silencedetect=n=-38dB:d=0.15', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    log = String(err.stderr)
  }
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  return starts.map((st, i) => [st, ends[i] ?? Infinity])
}

// where in the cleaned recording the first real pause is (after "and I'm Soham.")
function firstPause(wav, after, fallback) {
  for (const [at] of pauses(wav)) {
    if (at > after && at < after + 2.5) return at
  }
  return fallback
}

// when each word of a part is said (seconds from the start of the part).
// we spread the letters over the time someone is actually talking,
// skipping the pauses, so words land close to where they really are
function wordTimes(p) {
  let talking = [[0, p.dur]]
  if (p.wav) {
    talking = []
    let from = 0
    for (const [st, en] of pauses(p.wav)) {
      if (st > from) talking.push([from, Math.min(st, p.dur)])
      from = Math.min(en, p.dur)
    }
    if (from < p.dur) talking.push([from, p.dur])
    if (!talking.length) talking = [[0, p.dur]]
  }
  const talkTime = talking.reduce((n, [a, b]) => n + (b - a), 0)
  const toReal = (x) => {
    for (const [a, b] of talking) {
      if (x <= b - a) return a + x
      x -= b - a
    }
    return p.dur
  }
  const words = p.text.split(/\s+/)
  const letters = words.reduce((n, w) => n + w.length + 1, 0)
  let done = 0
  return words.map((w) => {
    const at = toReal((done / letters) * talkTime)
    done += w.length + 1
    return { word: w, at }
  })
}
console.log(haveVoice ? 'Using the recorded voices.' : 'Some MP3s missing: making a silent draft timed from the script.')

// ---- timing: where every segment and voice part goes ----
function layout() {
  let clock = 0
  for (const [i, seg] of segments.entries()) {
    seg.voice = []
    let t = LEAD
    for (const [k, id] of seg.parts.entries()) {
      seg.voice.push({ id, at: t })
      if (seg.cue && k === 1) seg.cueAt = t
      t += parts[id].dur + (k < seg.parts.length - 1 ? GAP : (seg.tail ?? TAIL))
    }
    seg.dur = t
    // for the demo: each step lasts from the middle of the gap before its voice
    // part to the middle of the gap after it, so the steps add up exactly
    const bounds = seg.voice.map((v, k) => (k === 0 ? 0 : v.at - GAP / 2))
    bounds.push(seg.dur)
    seg.phaseLengths = seg.voice.map((v, k) => bounds[k + 1] - bounds[k])
    seg.start = clock - FADE * i
    clock += seg.dur
  }
  return segments.at(-1).start + segments.at(-1).dur
}

let total = layout()
const LIMIT = 177 // a little room under 3:00
if (haveVoice && total > LIMIT) {
  const talk = Object.values(parts).reduce((n, p) => n + p.dur, 0)
  const speed = Math.min(1.07, talk / (talk - (total - LIMIT)))
  console.log(`A bit long (${total.toFixed(1)}s), speeding the voices up ${((speed - 1) * 100).toFixed(1)}%`)
  for (const p of Object.values(parts)) p.dur = cleanVoice(p.src, p.wav, speed)
  total = layout()
}
console.log('Total length: ' + total.toFixed(1) + 's')
if (total > 179.5) console.log('WARNING: over 3 minutes!')

// spotlight timing on the title slide: Om's name, Soham's name, then the title
const title = segments.find((s) => s.name === 'title')
{
  const om = title.voice[0].at
  const soham = title.voice[1].at
  const p4 = parts['04']
  const words = p4.text.split(/\s+/)
  const ratio = (i) => i / words.length
  const nameEnd = p4.wav ? firstPause(p4.wav, 0.5, p4.dur * ratio(3)) : p4.dur * ratio(3)
  const audIndex = words.findIndex((w) => w.startsWith("It's"))
  title.cues = { om, part2: soham, out: soham + nameEnd, aud: soham + p4.dur * ratio(audIndex) - 0.2 }
  console.log('Spotlight: Om at ' + om.toFixed(2) + 's, Soham at ' + soham.toFixed(2) + 's, title at ' + title.cues.out.toFixed(2) + 's')
}

// ---- 2. record every segment frame by frame ----
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const cdp = await page.context().newCDPSession(page)

async function capture(seg, setTime) {
  const file = path.join(work, `seg-${seg.name}.mp4`)
  const enc = spawn(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const frames = Math.round(seg.dur * FPS)
  for (let f = 0; f < frames; f++) {
    await setTime(f / FPS)
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true })
    if (!enc.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => enc.stdin.once('drain', r))
    if (f % 150 === 0) process.stdout.write(`  ${seg.name}: ${f}/${frames}\r`)
  }
  enc.stdin.end()
  await new Promise((r) => enc.on('close', r))
  console.log(`  ${seg.name}: done (${frames} frames)      `)
  seg.file = file
}

for (const seg of segments) {
  if (seg.demo) {
    const d = seg.phaseLengths.map((x) => x.toFixed(3)).join(',')
    await page.goto(`${BASE}/autodemo?capture=1&d=${d}`)
    await page.waitForFunction(() => window.__demo)
    await page.evaluate(() => document.fonts.ready)
    await capture(seg, (t) => page.evaluate((x) => window.__demo.setTime(x), t))
  } else {
    await page.goto(`${BASE}/presentation/index.html?film=1`)
    await page.waitForFunction(() => window.__slides)
    await page.evaluate(() => document.fonts.ready)
    const cues = { ...(seg.cues || (seg.cueAt != null ? { [seg.cue]: seg.cueAt } : {})) }
    // every word and when it's said, so things pop up right on the word
    cues.words = seg.voice.flatMap((v) =>
      wordTimes(parts[v.id]).map((w) => [w.word.toLowerCase().replace(/[^a-z0-9]/g, ''), +(v.at + w.at).toFixed(3)]),
    )
    await page.evaluate(([n, d, c]) => window.__slides.show(n, d, c), [seg.slide, seg.dur, cues])
    const missing = await page.evaluate(() => window.__slides.missing())
    if (missing.length) console.log(`  WARNING (${seg.name}): never said: ${missing.join(', ')}`)
    await capture(seg, (t) => page.evaluate((x) => window.__slides.setTime(x), t))
  }
}
await browser.close()

// ---- 3. captions (.ass for burning in, .srt for YouTube) ----
function chunks(text) {
  // split into short, readable pieces (about 2 lines max)
  const out = []
  for (const sentence of text.match(/[^.!?…]+[.!?…]+["”]?|[^.!?…]+$/g) || [text]) {
    let s = sentence.trim()
    while (s.length > 64) {
      let cut = s.lastIndexOf(', ', 60)
      if (cut < 20) cut = s.lastIndexOf(' ', 60)
      out.push(s.slice(0, cut + 1).trim())
      s = s.slice(cut + 1).trim()
    }
    if (s) out.push(s)
  }
  return out
}

const cues = []
for (const seg of segments) {
  for (const v of seg.voice) {
    const p = parts[v.id]
    const times = wordTimes(p)
    let w = 0
    const pieces = chunks(p.text).map((piece) => {
      const at = times[Math.min(w, times.length - 1)].at
      w += piece.split(/\s+/).length
      return { text: piece, at }
    })
    pieces.forEach((piece, k) => {
      const end = k + 1 < pieces.length ? pieces[k + 1].at : p.dur
      cues.push({ start: seg.start + v.at + piece.at, end: seg.start + v.at + end - 0.04, text: piece.text })
    })
  }
}

const stamp = (s, sep) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return sep === ','
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0').replace('.', ',')}`
    : `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}

writeFileSync(
  outFile.replace(/\.mp4$/, '.srt'),
  cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'),
)

const ass = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: 1920',
  'PlayResY: 1080',
  'WrapStyle: 0',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Cap,Inter Caption,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,0,0,3,14,0,2,380,380,46,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...cues.map((c) => `Dialogue: 0,${stamp(c.start)},${stamp(c.end)},Cap,,0,0,0,,{\\fad(120,120)}${c.text}`),
]
const assFile = path.join(work, 'captions.ass')
writeFileSync(assFile, ass.join('\n'))

// ---- 4. put it all together ----
const inputs = []
for (const seg of segments) inputs.push('-i', seg.file)
const filters = []
let last = '[0:v]'
let offset = 0
for (let i = 1; i < segments.length; i++) {
  offset += segments[i - 1].dur - FADE
  const out = i === segments.length - 1 ? '[vx]' : `[v${i}]`
  filters.push(`${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${out}`)
  last = out
}
const fontsDir = path.join(here, 'fonts')
filters.push(`[vx]${BURN ? `ass=${assFile}:fontsdir=${fontsDir},` : ''}fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 0.8).toFixed(3)}:d=0.8[vout]`)

// audio: every voice part at its time, plus quiet music under the demo only
const audioLabels = []
let n = segments.length
if (haveVoice) {
  for (const seg of segments) {
    for (const v of seg.voice) {
      inputs.push('-i', parts[v.id].wav)
      const ms = Math.round((seg.start + v.at) * 1000)
      filters.push(`[${n}:a]adelay=${ms}|${ms}[a${n}]`)
      audioLabels.push(`[a${n}]`)
      n++
    }
  }
}
const demo = segments.find((s) => s.music)
const musicFile = path.join(work, 'music.wav')
if (!existsSync(musicFile)) execFileSync('node', [path.join(here, 'make-music.mjs'), musicFile, String(Math.ceil(demo.dur + 4))], { stdio: 'inherit' })
inputs.push('-i', musicFile)
const mStart = Math.round(demo.start * 1000)
filters.push(
  `[${n}:a]atrim=0:${demo.dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:st=0:d=1.5,afade=t=out:st=${(demo.dur - 2).toFixed(3)}:d=2,adelay=${mStart}|${mStart}[music]`,
)
audioLabels.push('[music]')
filters.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0:duration=longest,apad,atrim=0:${total.toFixed(3)}[aout]`)

run([
  ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
  '-t', total.toFixed(3),
  outFile,
])
console.log('Done: ' + outFile + ' (' + total.toFixed(1) + 's)')
