import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

let lastSession = 'test-session-id';

export const handlers = [
  http.post('http://localhost:8000/process', async () => {
    return HttpResponse.json({ session_id: lastSession }, { status: 200 });
  }),
];

export const server = setupServer(...handlers);
