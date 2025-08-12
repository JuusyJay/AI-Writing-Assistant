from fastapi.testclient import TestClient
from app.main import app

# Basic healthcheck test to confirm the API is up and responding with the expected shape
def test_health():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
