import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'
import App from '../App'

// UI state tests: initial disabled/enabled states, button labels, copy-to-clipboard UX,
// and per-style text areas rendering

test('does not start processing when input is empty', async () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  // SSE started, status remains Idle
  await waitFor(() => {
    expect(global.EventSource.instances.length).toBe(0)
  })
  expect(screen.getByText(/Idle/i)).toBeInTheDocument()
})

test('shows Streaming…, exposes Cancel, then returns to Idle on cancel (and closes EventSource)', async () => {
  server.use(
    http.post('http://localhost:8000/process', () =>
      HttpResponse.json({ session_id: 't-1' })
    ),
    http.post('http://localhost:8000/cancel', () =>
      HttpResponse.json({ status: 'cancelling' })
    ),
  )

  render(<App />)

  fireEvent.change(screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Hello world' } })
  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  await waitFor(() => {
    expect(global.EventSource.instances.length).toBeGreaterThan(0)
  })
  const es = global.EventSource.instances.at(-1)

  // while streaming
  expect(screen.getByText(/Streaming…/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /cancel processing/i })).toBeInTheDocument()

  // cancel - the component closes the ES and flips to Idle
  fireEvent.click(screen.getByRole('button', { name: /cancel processing/i }))

  await waitFor(() => {
    expect(screen.getByText(/Idle/i)).toBeInTheDocument()
    expect(es.readyState).toBe(2) // closed
  })
})

test('clear controls: Clear All Styles and Clear Input', async () => {
  server.use(
    http.post('http://localhost:8000/process', () =>
      HttpResponse.json({ session_id: 't-2' })
    ),
  )

  render(<App />)

  fireEvent.change(screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Hi there' } })
  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  await waitFor(() => {
    expect(global.EventSource.instances.length).toBeGreaterThan(0)
  })
  const es = global.EventSource.instances.at(-1)

  // simulate streamed content to the Casual box
  es.__emit({ style: 'casual', delta: 'Yo ' })
  es.__emit({ style: 'casual', delta: 'what’s up?' })
  es.__emit({ done: true })

  // clear just styles
  fireEvent.click(screen.getByRole('button', { name: /clear all styles/i }))
  expect(screen.getByLabelText(/Casual rephrased text/i)).toHaveValue('')

  // clear input
  fireEvent.click(screen.getByRole('button', { name: /clear input/i }))
  expect(screen.getByPlaceholderText(/Type something to rephrase/i)).toHaveValue('')
})
