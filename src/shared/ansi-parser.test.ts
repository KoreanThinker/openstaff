import { describe, it, expect } from 'vitest'
import { parseAnsi, stripAnsi } from '@shared/ansi-parser'

describe('ansi-parser', () => {
  describe('stripAnsi', () => {
    it('returns plain text unchanged', () => {
      expect(stripAnsi('hello world')).toBe('hello world')
    })

    it('strips ANSI color codes', () => {
      expect(stripAnsi('\x1b[32mhello\x1b[0m')).toBe('hello')
    })

    it('strips complex ANSI sequences', () => {
      expect(stripAnsi('\x1b[1;31;42mtext\x1b[0m rest')).toBe('text rest')
    })

    it('handles empty string', () => {
      expect(stripAnsi('')).toBe('')
    })
  })

  describe('parseAnsi', () => {
    it('returns single segment for plain text', () => {
      const result = parseAnsi('hello')
      expect(result).toEqual([{ text: 'hello', style: {} }])
    })

    it('parses green text', () => {
      const result = parseAnsi('\x1b[32mhello\x1b[0m')
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('hello')
      expect(result[0].style.color).toBe('#50fa7b')
    })

    it('parses red text', () => {
      const result = parseAnsi('\x1b[31merror\x1b[0m')
      expect(result[0].text).toBe('error')
      expect(result[0].style.color).toBe('#ff5555')
    })

    it('parses bold text', () => {
      const result = parseAnsi('\x1b[1mbold\x1b[0m')
      expect(result[0].text).toBe('bold')
      expect(result[0].style.fontWeight).toBe('bold')
    })

    it('parses bright colors', () => {
      const result = parseAnsi('\x1b[92mbright green\x1b[0m')
      expect(result[0].text).toBe('bright green')
      expect(result[0].style.color).toBe('#50fa7b')
    })

    it('handles mixed plain and colored text', () => {
      const result = parseAnsi('before \x1b[31mred\x1b[0m after')
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ text: 'before ', style: {} })
      expect(result[1].text).toBe('red')
      expect(result[1].style.color).toBe('#ff5555')
      expect(result[2]).toEqual({ text: ' after', style: {} })
    })

    it('handles multiple colors in sequence', () => {
      const result = parseAnsi('\x1b[31mred\x1b[32mgreen\x1b[0m')
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('red')
      expect(result[0].style.color).toBe('#ff5555')
      expect(result[1].text).toBe('green')
      expect(result[1].style.color).toBe('#50fa7b')
    })

    it('parses dim/faint text', () => {
      const result = parseAnsi('\x1b[2mdim\x1b[0m')
      expect(result[0].text).toBe('dim')
      expect(result[0].style.opacity).toBe('0.7')
    })

    it('handles empty string', () => {
      const result = parseAnsi('')
      expect(result).toEqual([])
    })

    it('filters empty segments', () => {
      const result = parseAnsi('\x1b[31m\x1b[32mtext\x1b[0m')
      expect(result.every((s) => s.text.length > 0)).toBe(true)
    })
  })
})
