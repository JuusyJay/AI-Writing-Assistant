# AI Writing Assistant
Assumptions:
- Tests are designed to be deterministic and offline by default.
- Content moderation/guardrails are not enforced beyond tone rephrasing.
- No auth, rate limiting, audit logging, or PII retention.

What it uses
- Frontend: React + Vite
- Backend: FastAPI + httpx
- Streaming: Server-Sent Events (SSE)
- Docker: Runs both frontend and backend together

Access the app:
    Frontend: http://localhost:5173
    Backend API: http://localhost:8000 


Run with Docker:
** Add your API KEY to /backend/.env **
- Note: Make sure Docker is running on the computer.

docker compose build --no-cache
docker compose up


Stop Everything:

docker compose down


Run without Docker:
** Add your API KEY to /backend/.env **

Backend on Windows:
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

Run in new terminal:

cd backend
$env:PYTHONPATH="."
pytest -q
pytest --cov=app --cov-report=term-missing



Frontend tests:

Run in new terminal:

cd frontend
docker run --rm -it -v ${PWD}:/app -w /app node:20-slim bash -lc "npm ci && npm run test -- --coverage"