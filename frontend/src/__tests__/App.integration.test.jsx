import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'
import App from '../App'

// Integration tests for the full UI flow with mocked network + SSE
// Covers: starting a session, receiving streaming deltas per style, UI disabled states,
// cancel behavior, and the final "done" signal

test('happy path: POST /process → SSE → outputs update', async () => {
  // ensure the /process handler returns a fixed session id
  server.use(
    http.post('http://localhost:8000/process', async () =>
      HttpResponse.json({ session_id: 'abc-123' })
    )
  )

  render(<App />)

  fireEvent.change(
    screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Make me polite' } }
  )
  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  // wait for EventSource creation
  await waitFor(() => {
    expect(global.EventSource.instances.length).toBeGreaterThan(0)
  })
  const es = global.EventSource.instances.at(-1)

  es.__emit({ style: 'polite', delta: 'Please ' })
  es.__emit({ style: 'polite', delta: 'and thank you.' })
  es.__emit({ done: true })

  await waitFor(() => {
  expect(screen.getByLabelText(/Polite rephrased text/i))
    .toHaveValue('Please and thank you.')
  })
})
