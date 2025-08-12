import asyncio
import json
import pytest
import respx
import httpx

from app.llm_client import _stream_style_to_queue, OPENAI_URL

# unit tests for the internal streaming helper in llm_client
# Focus: parse OpenAI-style SSE and push the right events into the asyncio.Queue

@pytest.mark.asyncio
async def test_stream_style_to_queue_happy_path():
    q = asyncio.Queue()
    async with httpx.AsyncClient(timeout=None) as client:
        # mock OpenAI SSE stream with two chunks + [DONE]
        with respx.mock(assert_all_called=True) as mock:
            route = mock.post(OPENAI_URL).mock(
                return_value=httpx.Response(
                    200,
                    headers={"Content-Type": "text/event-stream"},
                    # simulate event-stream lines:
                    content=(
                        b"data: " + json.dumps({"choices":[{"delta":{"content":"Hi"},"index":0}]}).encode() + b"\n\n" +
                        b"data: " + json.dumps({"choices":[{"delta":{"content":"!"},"index":0,"finish_reason":"stop"}]}).encode() + b"\n\n" +
                        b"data: [DONE]\n\n"
                    )
                )
            )
            await _stream_style_to_queue(client, "hello", "professional", q)

    events = []
    while not q.empty():
        events.append(await q.get())

    # expect two deltas and a final
    deltas = [e for e in events if e.get("delta")]
    finals = [e for e in events if e.get("final")]
    assert "".join(d["delta"] for d in deltas) == "Hi!"
    assert len(finals) == 1
