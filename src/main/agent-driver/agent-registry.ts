import type { AgentDriver } from '@shared/types'
import { ClaudeCodeDriver } from './claude-code-driver'

const drivers: Map<string, AgentDriver> = new Map()

export function registerDriver(driver: AgentDriver): void {
  drivers.set(driver.id, driver)
}

export function getDriver(id: string): AgentDriver | undefined {
  return drivers.get(id)
}

export function getAllDrivers(): AgentDriver[] {
  return Array.from(drivers.values())
}

// Register built-in drivers
registerDriver(new ClaudeCodeDriver())
