import json
import httpx
import respx
from fastapi.testclient import TestClient

from app.main import app, running_sessions
from app.llm_client import OPENAI_URL

# Validation + lifecycle tests for /process, /stream, and /cancel
# verifies in-memory session cleanup once streaming finishes

client = TestClient(app)

def _sse_done():
    # minimal SSE body that makes the server treat the stream as complete
    return b"data: [DONE]\n\n"

def test_process_requires_text():
    r = client.post("/process", json={})
    assert r.status_code == 400
    assert r.json()["detail"] == "text field is required"

def test_stream_requires_valid_session():
    r = client.get("/stream", params={"session": "nope"})
    assert r.status_code == 404
    assert r.json()["detail"] == "session not found"

def test_cancel_validation_and_not_found():
    # test missing session_id -> 400
    r = client.post("/cancel", json={})
    assert r.status_code == 400
    assert r.json()["detail"] == "session_id is required"

    # test non-existent session -> 200, not_found
    r = client.post("/cancel", json={"session_id": "does-not-exist"})
    assert r.status_code == 200
    assert r.json() == {"status": "not_found"}

def test_session_cleanup_after_stream_finishes():
    # mock OpenAI stream BEFORE starting /process so worker tasks hit the mock
    with respx.mock(assert_all_called=False) as mock:
        mock.post(OPENAI_URL).mock(
            return_value=httpx.Response(
                200,
                headers={"Content-Type": "text/event-stream"},
                content=_sse_done(),
            )
        )

        # start a session
        r = client.post("/process", json={"text": "hi"})
        assert r.status_code == 200
        session_id = r.json()["session_id"]
        assert session_id in running_sessions  # session registered

        # connect to SSE and consume until done
        with client.stream("GET", f"/stream?session={session_id}") as resp:
            assert resp.status_code == 200
            for line in resp.iter_lines():
                if not line:
                    continue
                assert line.startswith("data: ")
                data = json.loads(line[len("data: "):])
                if data.get("done"):
                    break

        # once the generator finishes, the endpoints finally block should clean up
        assert session_id not in running_sessions
