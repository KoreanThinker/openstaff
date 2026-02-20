import express from 'express'
import { createServer } from 'http'
import { join } from 'path'
import { existsSync } from 'fs'
import { Server as SocketIOServer } from 'socket.io'
import { staffRoutes } from './routes/staffs'
import { skillRoutes } from './routes/skills'
import { agentRoutes } from './routes/agents'
import { settingsRoutes } from './routes/settings'
import { systemRoutes } from './routes/system'
import { registryRoutes } from './routes/registry'
import type { StaffManager } from '../staff-manager/staff-manager'
import type { ConfigStore } from '../store/config-store'
import type { MonitoringEngine } from '../monitoring/monitoring-engine'
import type { NgrokManager } from '../ngrok/ngrok-manager'

export interface ApiContext {
  staffManager: StaffManager
  configStore: ConfigStore
  monitoringEngine: MonitoringEngine
  io: SocketIOServer
  ngrokManager?: NgrokManager
}

let apiPort = 0

export function getApiPort(): number {
  return apiPort
}

export async function startApiServer(
  staffManager: StaffManager,
  configStore: ConfigStore,
  monitoringEngine: MonitoringEngine,
  ngrokManager?: NgrokManager
): Promise<{ port: number; close: () => void }> {
  const app = express()
  const httpServer = createServer(app)
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }
  })

  app.use(express.json({ limit: '1mb' }))

  const ctx: ApiContext = { staffManager, configStore, monitoringEngine, io, ngrokManager }

  // API routes
  app.use('/api/staffs', staffRoutes(ctx))
  app.use('/api/skills', skillRoutes(ctx))
  app.use('/api/agents', agentRoutes(ctx))
  app.use('/api/settings', settingsRoutes(ctx))
  app.use('/api/system', systemRoutes(ctx))
  app.use('/api/registry', registryRoutes(ctx))

  // Serve static React build for web UI (Ngrok remote access)
  const staticDir = join(__dirname, '../renderer')
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir))
    app.get('*', (_req, res) => {
      res.sendFile(join(staticDir, 'index.html'))
    })
  }

  // WebSocket
  io.on('connection', () => {
    // WebSocket connections managed by socket.io
  })

  // Forward StaffManager events to WebSocket (store refs for cleanup)
  const listeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = []
  const fwd = (event: string, handler: (...args: unknown[]) => void): void => {
    staffManager.on(event, handler)
    listeners.push({ event, handler })
  }

  fwd('staff:status', (staffId, status) => {
    io.emit('staff:status', { staffId, status })
  })
  fwd('staff:log', (staffId, data) => {
    io.emit('staff:log', { staffId, data })
  })
  fwd('staff:error', (staffId, error) => {
    io.emit('staff:error', { staffId, error })
  })
  fwd('staff:file_change', (staffId, file) => {
    io.emit('staff:file_change', { staffId, file })
  })
  fwd('staff:giveup', (staffId) => {
    io.emit('staff:giveup', { staffId })
  })
  fwd('staff:metrics', (staffId) => {
    io.emit('staff:metrics', { staffId })
  })
  fwd('staff:stopped_backoff', (staffId) => {
    io.emit('staff:stopped_backoff', { staffId })
  })
  fwd('staff:health_check_fail', (staffId) => {
    io.emit('staff:error', { staffId, error: 'Health check failed: process unresponsive' })
  })
  fwd('budget:warning', (data) => {
    io.emit('budget:warning', data)
  })

  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address()
      apiPort = typeof addr === 'object' && addr ? addr.port : 0
      console.log(`OpenStaff API server listening on port ${apiPort}`)
      resolve({
        port: apiPort,
        close: () => {
          for (const { event, handler } of listeners) {
            staffManager.removeListener(event, handler)
          }
          io.close()
          httpServer.close()
        }
      })
    })
  })
}
