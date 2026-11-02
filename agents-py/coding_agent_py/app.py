"""FastAPI service exposing the pydantic-ai agents to the Coding-Agent console."""
from __future__ import annotations

import os
import secrets
import time

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .agents import Plan, ReviewReport, Workspace, plan_agent, review_agent
from .evals import review_dataset
from .providers import DEFAULT_PROVIDER, PROVIDERS, MetaSpendCap, ProviderError, resolve

app = FastAPI(title="coding-agent-py", version="0.1.0")
_meta_cap = MetaSpendCap()


def auth(authorization: str | None = Header(default=None)) -> None:
    token = os.environ.get("PY_SERVICE_TOKEN")
    if not token:
        return
    if not authorization or not secrets.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(status_code=401, detail="unauthorized")


class RunIn(BaseModel):
    prompt: str = Field(max_length=60_000)
    files: dict[str, str] = Field(default_factory=dict)
    skills: str = ""
    provider: str | None = None
    tier: str = "super"


class RunMeta(BaseModel):
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    ms: int


class ReviewOut(BaseModel):
    report: ReviewReport
    meta: RunMeta


class PlanOut(BaseModel):
    plan: Plan
    meta: RunMeta


async def _run(agent, body: RunIn):
    try:
        r = resolve(body.provider, body.tier)
        if r.provider == "meta":
            _meta_cap.check()
    except ProviderError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    files = {k: v[:200_000] for k, v in list(body.files.items())[:200]}
    t = time.perf_counter()
    res = await agent.run(body.prompt, model=r.model, deps=Workspace(files=files, skills=body.skills[:12_000]))
    u = res.usage
    inp, out = u.input_tokens or 0, u.output_tokens or 0
    cost = _meta_cap.record(inp, out) if r.provider == "meta" else None
    return res.output, RunMeta(provider=r.provider, model=r.model_name, input_tokens=inp, output_tokens=out,
                               cost_usd=cost, ms=int((time.perf_counter() - t) * 1000))


@app.get("/health")
def health() -> dict:
    return {"ok": True, "default_provider": DEFAULT_PROVIDER, "providers": list(PROVIDERS),
            "nebius_key": bool(os.environ.get("NEBIUS_API_KEY"))}


@app.post("/review", response_model=ReviewOut, dependencies=[Depends(auth)])
async def review(body: RunIn) -> ReviewOut:
    report, meta = await _run(review_agent(), body)
    return ReviewOut(report=report, meta=meta)


@app.post("/plan", response_model=PlanOut, dependencies=[Depends(auth)])
async def plan(body: RunIn) -> PlanOut:
    p, meta = await _run(plan_agent(), body)
    return PlanOut(plan=p, meta=meta)


class EvalIn(BaseModel):
    provider: str | None = None
    tier: str = "nano"


@app.post("/evals/review", dependencies=[Depends(auth)])
async def eval_review(body: EvalIn) -> dict:
    try:
        r = resolve(body.provider, body.tier)
    except ProviderError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    agent = review_agent()

    async def task(diff: str) -> ReviewReport:
        return (await agent.run(f"Review this diff:\n{diff}", model=r.model, deps=Workspace())).output

    report = await review_dataset().evaluate(task, progress=False)
    cases = [{"name": c.name, "scores": {k: v.value for k, v in c.assertions.items()}} for c in report.cases]
    passed = sum(all(s for s in c["scores"].values()) for c in cases)
    return {"provider": r.provider, "model": r.model_name, "cases": cases, "passed": passed, "total": len(cases)}
