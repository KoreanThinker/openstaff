import { PRICING } from '@shared/constants'

export interface ParsedTokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

/**
 * Parse Claude Code verbose output for token usage information.
 * Claude Code outputs lines like:
 *   "input: 1234 tokens" / "output: 567 tokens"
 *   or JSON-style: {"input_tokens":1234,"output_tokens":567,...}
 */
export function parseTokensFromOutput(text: string): ParsedTokenUsage | null {
  // Pattern 1: JSON-style token info (Claude Code outputs this in verbose mode)
  const jsonMatch = text.match(/\{[^}]*"input_tokens"\s*:\s*(\d+)[^}]*"output_tokens"\s*:\s*(\d+)[^}]*\}/)
  if (jsonMatch) {
    const cacheReadMatch = text.match(/"cache_read(?:_input)?_tokens"\s*:\s*(\d+)/)
    const cacheWriteMatch = text.match(/"cache_(?:creation|write)(?:_input)?_tokens"\s*:\s*(\d+)/)
    return {
      input_tokens: parseInt(jsonMatch[1]!, 10),
      output_tokens: parseInt(jsonMatch[2]!, 10),
      cache_read_tokens: cacheReadMatch ? parseInt(cacheReadMatch[1]!, 10) : 0,
      cache_write_tokens: cacheWriteMatch ? parseInt(cacheWriteMatch[1]!, 10) : 0
    }
  }

  // Pattern 2: Plaintext token output (e.g., "Total tokens: input=1234, output=567")
  const plainMatch = text.match(/input\s*[=:]\s*(\d[\d,]*)\s*(?:tokens?)?\s*[,;]\s*output\s*[=:]\s*(\d[\d,]*)/i)
  if (plainMatch) {
    return {
      input_tokens: parseInt(plainMatch[1]!.replace(/,/g, ''), 10),
      output_tokens: parseInt(plainMatch[2]!.replace(/,/g, ''), 10),
      cache_read_tokens: 0,
      cache_write_tokens: 0
    }
  }

  return null
}

export function calculateCostFromTokens(
  model: string,
  usage: ParsedTokenUsage
): number {
  const prices = PRICING[model]
  if (!prices) return 0

  return (
    (usage.input_tokens / 1_000_000) * prices.input +
    (usage.output_tokens / 1_000_000) * prices.output +
    (usage.cache_read_tokens / 1_000_000) * prices.cache_read +
    (usage.cache_write_tokens / 1_000_000) * prices.cache_write
  )
}
