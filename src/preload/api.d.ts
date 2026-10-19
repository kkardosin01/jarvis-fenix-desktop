import type { JarvisApi } from './api'

declare global {
  interface Window {
    jarvis: JarvisApi
  }
}

export {}
