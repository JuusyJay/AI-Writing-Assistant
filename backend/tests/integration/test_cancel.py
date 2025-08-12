from fastapi.testclient import TestClient
from app.main import app

# Tests for the /cancel endpoint
# Goal: validate request shape and the not_found behavior for unknown sessions

def test_cancel_not_found():
    client = TestClient(app)
    r = client.post("/cancel", json={"session_id":"nope"})
    assert r.status_code == 200
    assert r.json()["status"] in {"not_found"}
