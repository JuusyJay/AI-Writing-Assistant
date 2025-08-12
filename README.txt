# AI Writing Assistant

This is a single page app that takes what you type and rephrases it into 
different styles (Professional, Casual, Polite, Social-media) using an AI model. 
It streams the results so you can see them appear in real-time.


What it uses
- Frontend: React + Vite
- Backend: FastAPI + httpx
- Streaming: Server-Sent Events (SSE)
- Docker: Runs both frontend and backend together


Features
- Shows results for 4 styles at the same time
- Streams the text in as it comes from the backend
- Cancel button to stop mid-process
- Clear All button to wipe all outputs
- Char counter and a simple “Streaming / Idle” status
- Mobile friendly

Access the app:
    Frontend: http://localhost:5173
    Backend API: http://localhost:8000 

Run with Docker:

Make sure Docker is running on the computer.

docker compose build --no-cache
docker compose up


Stop Everything:

docker compose down



Run without Docker:

Backend on Windows:
- Add your OpenAI API Key in backend/.env then Run commands below:
- Note: Only need to run Set-ExecutionPolicy command if running scripts is diabled on your system

cd backend
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

Frontend on Windows:

cd frontend
npm install
npm run dev

Testing:
This project includes backend tests (pytest) and frontend tests (Vitest + Testing Library + MSW).



Backend tests:

- Health endpoint
- Process start flow
- Stream SSE flow (mocked responses)
- Cancel behavior
- No real calls to OpenAI (HTTP is mocked)

Run:

cd backend
$env:PYTHONPATH="."
pytest -q
pytest --cov=app --cov-report=term-missing



Frontend tests:

- Rendering and UI state
- Clicking “Process” triggers the mocked backend
- Streaming updates: an EventSource test double emits chunks and verifies textareas update live
- No real network calls (MSW stubs /process)

Run:

cd frontend
npm run test
npm run test -- --coverage