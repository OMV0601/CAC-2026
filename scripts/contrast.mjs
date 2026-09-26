// checks the contrast ratio of our colors (WCAG formula)
// run it with: npm run contrast
// AA needs 4.5 for normal text, 3 for big text and borders/icons

const colors = {
  paper: '#fbf8f3',
  card: '#ffffff',
  ink: '#1c2024',
  muted: '#545b64',
  line: '#858d96',
  accent: '#0a5f5b',
  'accent-ink': '#ffffff',
  good: '#17663a',
  warn: '#8a4b00',
  bad: '#b3261e',
}

// the pairs we actually use in the app (text color on background color)
const pairs = [
  ['ink', 'paper'],
  ['ink', 'card'],
  ['muted', 'paper'],
  ['muted', 'card'],
  ['line', 'paper'],
  ['accent', 'paper'],
  ['accent', 'card'],
  ['accent-ink', 'accent'],
  ['good', 'card'],
  ['warn', 'card'],
  ['bad', 'card'],
  ['accent-ink', 'bad'],
  ['accent-ink', 'ink'],
]

// turns "#rrggbb" into the "relative luminance" number from the WCAG spec
function luminance(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const fixed = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * fixed[0] + 0.7152 * fixed[1] + 0.0722 * fixed[2]
}

function ratio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const light = Math.max(l1, l2)
  const dark = Math.min(l1, l2)
  return (light + 0.05) / (dark + 0.05)
}

let failed = false
for (const [fg, bg] of pairs) {
  const r = ratio(colors[fg], colors[bg])
  // borders only need 3:1, text needs 4.5:1
  const needed = fg === 'line' ? 3 : 4.5
  const ok = r >= needed
  if (!ok) failed = true
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${fg} on ${bg}: ${r.toFixed(2)}:1 (need ${needed})`)
}

if (failed) process.exit(1)
