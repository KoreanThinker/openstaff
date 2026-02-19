import { describe, it, expect } from 'vitest'
import { parseTokensFromOutput, calculateCostFromTokens } from './token-parser'

describe('parseTokensFromOutput', () => {
  it('parses JSON-style token info', () => {
    const text = '{"input_tokens":1234,"output_tokens":567}'
    const result = parseTokensFromOutput(text)
    expect(result).toEqual({
      input_tokens: 1234,
      output_tokens: 567,
      cache_read_tokens: 0,
      cache_write_tokens: 0
    })
  })

  it('parses JSON-style with cache tokens', () => {
    const text = '{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":200,"cache_creation_input_tokens":100}'
    const result = parseTokensFromOutput(text)
    expect(result).toEqual({
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_tokens: 200,
      cache_write_tokens: 100
    })
  })

  it('parses plaintext token output', () => {
    const text = 'Total tokens: input=1,234, output=567'
    const result = parseTokensFromOutput(text)
    expect(result).toEqual({
      input_tokens: 1234,
      output_tokens: 567,
      cache_read_tokens: 0,
      cache_write_tokens: 0
    })
  })

  it('parses input: X tokens, output: Y tokens format', () => {
    const text = 'input: 500 tokens, output: 200 tokens'
    const result = parseTokensFromOutput(text)
    expect(result).toEqual({
      input_tokens: 500,
      output_tokens: 200,
      cache_read_tokens: 0,
      cache_write_tokens: 0
    })
  })

  it('returns null for text without token info', () => {
    const result = parseTokensFromOutput('hello world')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseTokensFromOutput('')
    expect(result).toBeNull()
  })
})

describe('calculateCostFromTokens', () => {
  it('calculates cost for claude-sonnet-4-5', () => {
    const cost = calculateCostFromTokens('claude-sonnet-4-5', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_tokens: 0,
      cache_write_tokens: 0
    })
    // Sonnet: $3/M input + $15/M output = $18
    expect(cost).toBe(18)
  })

  it('calculates cost with cache tokens', () => {
    const cost = calculateCostFromTokens('claude-sonnet-4-5', {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 1_000_000,
      cache_write_tokens: 1_000_000
    })
    // Sonnet: $0.3/M cache_read + $3.75/M cache_write = $4.05
    expect(cost).toBe(4.05)
  })

  it('returns 0 for unknown model', () => {
    const cost = calculateCostFromTokens('unknown-model', {
      input_tokens: 1000,
      output_tokens: 1000,
      cache_read_tokens: 0,
      cache_write_tokens: 0
    })
    expect(cost).toBe(0)
  })
})
