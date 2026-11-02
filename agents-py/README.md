# agents-py: Python agent service (pydantic-ai)

Typed agents built on [pydantic-ai](https://github.com/pydantic/pydantic-ai) (MIT; used as a dependency, not vendored).

- **Default model:** NVIDIA Nemotron on Nebius Token Factory (`NEBIUS_API_KEY`; tiers nano/super/ultra).
- **Optional:** `meta` (Meta Llama API, `META_LLAMA_API_KEY`, hard cap `META_SPEND_CAP_USD`, default $1), `local-llama` (llama.cpp at `127.0.0.1:8089/v1`), `test` (offline pydantic-ai `TestModel`).
- **Endpoints:** `GET /health`; `POST /review`, `POST /plan` (typed output; tools `list_files`/`read_file` over the files you send); `POST /evals/review` (pydantic_evals dataset).
- **Auth:** set `PY_SERVICE_TOKEN` and send `Authorization: Bearer <token>`.

```bash
uv sync && uv run pytest -q
uv run uvicorn coding_agent_py.app:app --port 8090
```
The console calls it when `PY_AGENT_URL` is set (e.g. `http://127.0.0.1:8090`).
