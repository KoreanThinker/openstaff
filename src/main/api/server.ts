import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { join } from 'path'
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

  app.use(express.json())

  const ctx: ApiContext = { staffManager, configStore, monitoringEngine, io, ngrokManager }

  // API routes
  app.use('/api/staffs', staffRoutes(ctx))
  app.use('/api/skills', skillRoutes(ctx))
  app.use('/api/agents', agentRoutes(ctx))
  app.use('/api/settings', settingsRoutes(ctx))
  app.use('/api/system', systemRoutes(ctx))
  app.use('/api/registry', registryRoutes(ctx))

  // WebSocket
  io.on('connection', (socket) => {
    console.log('WebSocket client connected')
    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected')
    })
  })

  // Forward StaffManager events to WebSocket
  staffManager.on('staff:status', (staffId, status) => {
    io.emit('staff:status', { staffId, status })
  })
  staffManager.on('staff:log', (staffId, data) => {
    io.emit('staff:log', { staffId, data })
  })
  staffManager.on('staff:error', (staffId, error) => {
    io.emit('staff:error', { staffId, error })
  })
  staffManager.on('staff:file_change', (staffId, file) => {
    io.emit('staff:file_change', { staffId, file })
  })
  staffManager.on('staff:giveup', (staffId) => {
    io.emit('staff:giveup', { staffId })
  })
  staffManager.on('staff:metrics', (staffId) => {
    io.emit('staff:metrics', { staffId })
  })

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address()
      apiPort = typeof addr === 'object' && addr ? addr.port : 0
      console.log(`OpenStaff API server listening on port ${apiPort}`)
      resolve({
        port: apiPort,
        close: () => httpServer.close()
      })
    })
  })
}
