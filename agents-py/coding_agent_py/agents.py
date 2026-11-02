"""pydantic-ai agents with typed outputs."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext


class Finding(BaseModel):
    severity: Literal["critical", "high", "medium", "low", "info"]
    file: str = ""
    line: int = 0
    message: str


class ReviewReport(BaseModel):
    summary: str
    verdict: Literal["approve", "request_changes", "comment"]
    findings: list[Finding] = Field(default_factory=list)


class PlanStep(BaseModel):
    title: str
    files: list[str] = Field(default_factory=list)
    check: str = Field(default="", description="command or test that proves this step is done")


class Plan(BaseModel):
    goal: str
    steps: list[PlanStep]


@dataclass
class Workspace:
    files: dict[str, str] = field(default_factory=dict)
    skills: str = ""


REVIEW_INSTRUCTIONS = (
    "You are a strict senior code reviewer. Report real bug risks, missing tests and security issues "
    "with file and line. Do not invent problems; if the diff is fine, approve with no findings."
)
PLAN_INSTRUCTIONS = (
    "You plan code changes. Give small ordered steps; each names the files it touches and the check "
    "that proves it is done. Read files with the read_file tool instead of guessing."
)


def _add_common(agent: Agent) -> None:
    @agent.instructions
    def skills(ctx: RunContext[Workspace]) -> str:
        return ctx.deps.skills

    @agent.tool
    def list_files(ctx: RunContext[Workspace]) -> list[str]:
        """List workspace file paths."""
        return sorted(ctx.deps.files)[:500]

    @agent.tool
    def read_file(ctx: RunContext[Workspace], path: str) -> str:
        """Read one workspace file (truncated to 20k chars)."""
        if path not in ctx.deps.files:
            return f"ERROR: no such file {path}"
        return ctx.deps.files[path][:20_000]


def review_agent() -> Agent[Workspace, ReviewReport]:
    a = Agent(None, deps_type=Workspace, output_type=ReviewReport, instructions=REVIEW_INSTRUCTIONS, retries=2)
    _add_common(a)
    return a


def plan_agent() -> Agent[Workspace, Plan]:
    a = Agent(None, deps_type=Workspace, output_type=Plan, instructions=PLAN_INSTRUCTIONS, retries=2)
    _add_common(a)
    return a
