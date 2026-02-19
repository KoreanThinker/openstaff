// ANSI escape code parser for terminal output
// Converts ANSI codes to inline styles for React rendering

const ANSI_REGEX = /\x1b\[([0-9;]*)m/g

// Dracula-inspired palette for dark/light readability
const COLORS: Record<number, string> = {
  30: '#44475a', // black
  31: '#ff5555', // red
  32: '#50fa7b', // green
  33: '#f1fa8c', // yellow
  34: '#6272a4', // blue
  35: '#ff79c6', // magenta
  36: '#8be9fd', // cyan
  37: '#f8f8f2', // white
  // Bright variants
  90: '#6272a4',
  91: '#ff6e6e',
  92: '#50fa7b',
  93: '#f1fa8c',
  94: '#8be9fd',
  95: '#ff79c6',
  96: '#8be9fd',
  97: '#f8f8f2',
}

export interface AnsiSegment {
  text: string
  style: Record<string, string>
}

export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

export function parseAnsi(input: string): AnsiSegment[] {
  if (!input) return []

  const segments: AnsiSegment[] = []
  let currentStyle: Record<string, string> = {}
  let lastIndex = 0

  // Reset regex state
  ANSI_REGEX.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ANSI_REGEX.exec(input)) !== null) {
    // Push text before this escape code
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index), style: { ...currentStyle } })
    }

    const codes = match[1].split(';').map(Number)
    for (const code of codes) {
      if (code === 0) {
        currentStyle = {}
      } else if (code === 1) {
        currentStyle.fontWeight = 'bold'
      } else if (code === 2) {
        currentStyle.opacity = '0.7'
      } else if (code === 3) {
        currentStyle.fontStyle = 'italic'
      } else if (code === 4) {
        currentStyle.textDecoration = 'underline'
      } else if (COLORS[code]) {
        currentStyle.color = COLORS[code]
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Push remaining text
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), style: { ...currentStyle } })
  }

  return segments.filter((s) => s.text.length > 0)
}
