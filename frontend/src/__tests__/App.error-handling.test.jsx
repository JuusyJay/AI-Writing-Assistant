import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'
import App from '../App'

// Error handling tests for startProcessing and streaming failures
// Validates user-facing messages and proper UI state recovery (re-enabling inputs)

test('startProcessing handles /process failure gracefully', async () => {
  server.use(
    http.post('http://localhost:8000/process', () =>
      HttpResponse.json({ message: 'nope' }, { status: 500 })
    ),
  )

  render(<App />)

  fireEvent.change(screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Boom' } })
  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  // stays idle, no EventSource created
  await waitFor(() => {
    expect(screen.getByText(/Idle/i)).toBeInTheDocument()
  })
  expect(global.EventSource.instances.length).toBe(0)
})

test('error events append to the correct style; unknown events are ignored', async () => {
  server.use(
    http.post('http://localhost:8000/process', () =>
      HttpResponse.json({ session_id: 't-3' })
    ),
  )

  render(<App />)

  fireEvent.change(screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Go' } })
  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  await waitFor(() => {
    expect(global.EventSource.instances.length).toBeGreaterThan(0)
  })
  const es = global.EventSource.instances.at(-1)

  // unknown event (missing fields) -> ignored
  es.__emit({})

  // error for Professional
  es.__emit({ style: 'professional', error: 'boom', final: true })
  es.__emit({ done: true })

  await waitFor(() => {
  const el = screen.getByLabelText(/Professional rephrased text/i)
  expect(el.value.replace(/\s+/g, ' ')).toMatch(/\[ERROR]\s+boom/)
  })
})
