import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'

// Unit tests for App-level pure helpers (formatters/parsers/state reducers)
// Target small, deterministic functions without mounting the React tree

test('streams chunks into style boxes', async () => {
  render(<App />)

  fireEvent.change(
    screen.getByPlaceholderText(/Type something to rephrase/i),
    { target: { value: 'Hello world' } }
  )

  fireEvent.click(screen.getByRole('button', { name: /process/i }))

  // wait for the app to create an EventSource
  await waitFor(() => {
    expect(global.EventSource.instances.length).toBeGreaterThan(0)
  })

  const es = global.EventSource.instances.at(-1)

  es.__emit({ style: 'professional', delta: 'Pro chunk 1' })
  es.__emit({ style: 'professional', delta: ' + 2' })
  es.__emit({ done: true })

  await waitFor(() => {
    expect(screen.getByLabelText(/Professional rephrased text/i))
      .toHaveValue('Pro chunk 1 + 2')
  })
  expect(screen.getByText(/Idle/)).toBeInTheDocument()
})
