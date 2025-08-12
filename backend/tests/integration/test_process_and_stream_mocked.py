import json
import respx
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.llm_client import OPENAI_URL

# End-to-end path with OpenAI SSE mocked via respx
# Flow: POST /process -> receive session_id -> GET /stream -> read deltas -> see final 'done'
# stub OpenAI's streaming so backend logic is exercised without real network calls

def sse_payload():
    chunk1 = json.dumps({"choices":[{"delta":{"content":"Hello "},"index":0}]}).encode()
    chunk2 = json.dumps({"choices":[{"delta":{"content":"World"},"index":0,"finish_reason":"stop"}]}).encode()
    return (
        b"data: " + chunk1 + b"\n\n" +
        b"data: " + chunk2 + b"\n\n" +
        b"data: [DONE]\n\n"
    )

def test_full_flow_streaming():
    client = TestClient(app)

    # activate the mock first so background tasks use it
    with respx.mock(assert_all_called=False) as mock:
        mock.post(OPENAI_URL).mock(
            return_value=httpx.Response(
                200,
                headers={"Content-Type": "text/event-stream"},
                content=sse_payload(),
            )
        )

        # start a session; schedules the background streaming tasks
        r = client.post("/process", json={"text": "hi"})
        assert r.status_code == 200
        sid = r.json()["session_id"]

        # now consume the SSE
        with client.stream("GET", f"/stream?session={sid}") as resp:
            assert resp.status_code == 200
            got_delta = False
            for line in resp.iter_lines():
                if not line:
                    continue
                assert line.startswith("data: ")
                data = json.loads(line[len("data: "):])
                if data.get("delta"):
                    got_delta = True
                if data.get("done"):
                    break
            assert got_delta is True
