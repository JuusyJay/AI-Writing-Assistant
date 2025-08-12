import os
import json
import asyncio
from typing import Dict, Any
import httpx 
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# Prompts for diff style/tones of writing. Can be altered to influence the AI response in diff ways
STYLE_PROMPTS = {
    "professional": "Rephrase the following in a professional tone:",
    "casual": "Rephrase the following in a casual tone:",
    "polite": "Rephrase the following in a polite tone:",
    "social": "Rephrase the following in a social-media friendly tone (short, emoji allowed):"
}

async def _stream_style_to_queue(
        client: httpx.AsyncClient,
        input_text: str,
        style: str,
        queue: asyncio.Queue,
        temperature: float = 0.7,
) -> None:
    
    """
    Streams one style version of the text to the shared queue.
    This is run as a task for each style in the session.
    """

    # make the full prompt for the AI model
    prompt = f"{STYLE_PROMPTS[style]}\n\n{input_text}"

    payload = {
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "stream": True # tells OpenAI to send chunks instead of full text at once (streaming)
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json"
    }

    # No timeout is set because streaming responses can take some time
    try:
        # sends request to OpenAI and gets streaming response
        async with client.stream("POST", OPENAI_URL, headers=headers, json=payload, timeout=None) as resp:
            resp.raise_for_status()

            # iterates over lines, OpenAI sends text/event-stream like data: {...} or data: [DONE]
            async for raw_line in resp.aiter_lines():

                if raw_line is None:
                    continue

                line = raw_line.strip()

                if not line:
                    continue
                
                if line.startswith("data: "):
                    data = line[len("data: "):]

                else:
                    data = line

                if data == "[DONE]":
                    # finished generating for a style
                    await queue.put({"style": style, "delta": "", "final": True})
                    break
                # try to parse the JSON chunk from OpenAI
                try:
                    chunk = json.loads(data)

                # ignore fragments that are malformed
                except json.JSONDecodeError:
                    continue

                choices = chunk.get("choices", [])

                if not choices:
                    continue

                choice = choices[0]
                # new text chunk from this stream
                delta_text = choice.get("delta", {}).get("content")
                finish_reason = choice.get("finish_reason")

                # send text chunk to the queue
                if delta_text:
                    await queue.put({"style": style, "delta": delta_text, "final": False})

                if finish_reason is not None:
                    # if there is an explicit finish_reason then it is complete
                    await queue.put({"style": style, "delta": "", "final": True})
                    break

    # if task is cancelled                
    except asyncio.CancelledError:
        raise
    
    # if any error, send an error message for that style
    except Exception as e:
        await queue.put({"style": style, "error": str(e), "final": True})
