/// <reference types="vite/client" />
/// <reference types="electron-vite/node" />

interface Window {
  electron: typeof import('@electron-toolkit/preload').electronAPI
  api: typeof import('../../preload/index').api
}
