import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { server } from './server'

// Global test setup for Vitest + React Testing Library.
// Registers MSW handlers for /process and /stream
// Stubs EventSource so we can emit server-sent events from tests
// Normalizes browser APIs when needed

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Stable EventSource test double 
class MockEventSource {
  static instances = []

  constructor(url) {
    this.url = url
    this.onmessage = null
    this.onerror = null
    this.readyState = 0 // CONNECTING
    MockEventSource.instances.push(this)
    // simulate OPEN async
    setTimeout(() => { this.readyState = 1 }, 0)
  }

  __emit(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }

  close() {
    this.readyState = 2 // CLOSED
  }
}

// make it available in every test environment
vi.stubGlobal('EventSource', MockEventSource)

// clean between tests so counts/last instance are predictable
afterEach(() => {
  MockEventSource.instances.length = 0
})
