import asyncio
import json
import os
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .llm_client import _stream_style_to_queue, STYLE_PROMPTS

load_dotenv()

# frontend sends requests from here
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app = FastAPI()

# allows for cross-origin resource sharing so browser wont block requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

# temporary in-memory session storage 
# Key = session_id, Value = dict with (tasks, queue, client)
running_sessions: dict[str, dict] = {}


@app.get("/health")
async def health():
    # check endpoint
    return {"ok": True}


@app.post("/process")
async def process_start(body: dict):
    # start processing sessioon for given text
    text = body.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="text field is required")

    # create random session ID
    session_id = str(uuid.uuid4())

    # queue for sending SSE events to client
    queue: asyncio.Queue = asyncio.Queue()

    # HTTP client for talking to OpenAI
    client = httpx.AsyncClient(timeout=None)

    # all async tasks for this session (one per style)
    tasks: list[asyncio.Task] = []

    # starts a streaming task for each style in STYLE_PROMPTS
    for style in STYLE_PROMPTS.keys():
        tasks.append(
            asyncio.create_task(
                _stream_style_to_queue(client, text, style, queue)
            )
        )

    # waits for all styles to finish, then closes client + sends "done"
    async def waiter():
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            # if cancel button pressed, tell the client
            await queue.put({"cancelled": True})
            raise
        finally:
            # tell client "done" and close HTTP client
            await queue.put({"done": True})
            await client.aclose()

    # main controller task for session
    waiter_task = asyncio.create_task(waiter())

    # store session in memory to stream/cancel later
    running_sessions[session_id] = {
        "tasks": tasks + [waiter_task], 
        "queue": queue, 
        "client": client
    }

    # send session_id to frontend so it can connect to /stream
    return JSONResponse({"session_id": session_id})


@app.get("/stream")
async def stream_events(session: str):

    # client connects here via SSE to recieve streamed text updates
    session_record = running_sessions.get(session)
    if not session_record:
        raise HTTPException(status_code=404, detail="session not found")
    
    queue: asyncio.Queue = session_record["queue"]

    async def event_generator():
        try:
            while True:
                # wait for next chunk/event from tasks
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("done") or event.get("cancelled"):
                    break
        finally:
            # cleanup session once streaming is done
            running_sessions.pop(session, None)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/cancel")
async def cancel(body: dict):
    # cancel all running tasks for a given session_id
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session_record = running_sessions.get(session_id)

    # check if session is done or does not exist
    if not session_record:
        return JSONResponse({"status": "not_found"})

    # cancel all style + waiter tasks
    for t in session_record["tasks"]:
        t.cancel()

    # closes HTTP client if still open
    client = session_record.get("client")
    if client:
        try:
            await client.aclose()
        except Exception:
            pass

    return JSONResponse({"status": "cancelling"})