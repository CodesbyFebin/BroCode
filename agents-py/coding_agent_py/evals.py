"""Offline-capable review evals with pydantic_evals."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from .agents import ReviewReport

SQLI = 'db.query("SELECT * FROM users WHERE id = " + req.params.id)\n'
CLEAN = "export const add = (a: number, b: number) => a + b;\n"


@dataclass
class VerdictMatches(Evaluator[str, ReviewReport]):
    def evaluate(self, ctx: EvaluatorContext[str, ReviewReport]) -> bool:
        return ctx.output.verdict == ctx.expected_output.verdict if ctx.expected_output else True


@dataclass
class FlagsSevere(Evaluator[str, ReviewReport]):
    def evaluate(self, ctx: EvaluatorContext[str, ReviewReport]) -> bool:
        want = bool(ctx.expected_output and ctx.expected_output.findings)
        got = any(f.severity in ("critical", "high") for f in ctx.output.findings)
        return want == got


def review_dataset() -> Dataset[str, ReviewReport, None]:
    return Dataset(
        name="review",
        cases=[
            Case(name="sql_injection", inputs=SQLI,
                 expected_output=ReviewReport(summary="", verdict="request_changes",
                                              findings=[{"severity": "high", "message": "SQL injection"}])),
            Case(name="clean_add", inputs=CLEAN, expected_output=ReviewReport(summary="", verdict="approve")),
        ],
        evaluators=[VerdictMatches(), FlagsSevere()],
    )
