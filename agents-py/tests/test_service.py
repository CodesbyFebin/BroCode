import pytest
from fastapi.testclient import TestClient

from coding_agent_py.app import app
from coding_agent_py.providers import NEBIUS_BASE_URL, MetaSpendCap, ProviderError, resolve


def test_default_provider_is_nemotron_on_nebius():
    r = resolve(None, "super", env={"NEBIUS_API_KEY": "k"})
    assert r.provider == "nebius" and r.model_name.startswith("nvidia/")
    assert str(r.model.client.base_url).rstrip("/") == NEBIUS_BASE_URL


def test_missing_keys_and_unknown_provider_fail_closed():
    with pytest.raises(ProviderError):
        resolve(None, env={})
    with pytest.raises(ProviderError):
        resolve("meta", env={})
    with pytest.raises(ProviderError):
        resolve("openai", env={})
    assert resolve("local-llama", env={}).provider == "local-llama"


def test_meta_spend_cap():
    cap = MetaSpendCap(env={"META_SPEND_CAP_USD": "0.0001"})
    cap.record(1_000, 1_000)  # $0.0003
    with pytest.raises(ProviderError):
        cap.check()


def test_review_and_plan_endpoints_with_offline_test_model(monkeypatch):
    monkeypatch.delenv("PY_SERVICE_TOKEN", raising=False)
    c = TestClient(app)
    assert c.get("/health").json()["default_provider"] == "nebius"
    r = c.post("/review", json={"prompt": "review", "files": {"a.ts": "x"}, "provider": "test"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["report"]["verdict"] in ("approve", "request_changes", "comment")
    assert body["meta"]["provider"] == "test"
    p = c.post("/plan", json={"prompt": "plan", "provider": "test"})
    assert p.status_code == 200 and isinstance(p.json()["plan"]["steps"], list)


def test_auth_token_enforced(monkeypatch):
    monkeypatch.setenv("PY_SERVICE_TOKEN", "s3cret")
    c = TestClient(app)
    assert c.post("/review", json={"prompt": "x", "provider": "test"}).status_code == 401
    ok = c.post("/review", json={"prompt": "x", "provider": "test"}, headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200


def test_nebius_without_key_is_400(monkeypatch):
    monkeypatch.delenv("PY_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    r = TestClient(app).post("/review", json={"prompt": "x"})
    assert r.status_code == 400 and "NEBIUS_API_KEY" in r.text


def test_evals_run_offline(monkeypatch):
    monkeypatch.delenv("PY_SERVICE_TOKEN", raising=False)
    r = TestClient(app).post("/evals/review", json={"provider": "test"})
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 2
