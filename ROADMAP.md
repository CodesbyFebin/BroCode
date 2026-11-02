# BroCODE Roadmap

> **Make every AI action transparent, reversible, and locally controlled.**

**Status: planned, not shipped.** Everything on this page is planned, not shipped. None of these features exist in BroCODE today. Iterations show a target sequence in weeks from the start of work, not calendar dates; they are targets, not commitments, and plans can change.

Public page: https://codingagent.in/roadmap/

## Iteration 1: Transparency & Reversibility (target weeks 1–3 from start)

**Goal:** See exactly what the AI will do and what it receives, and always have a way back.

- **Plan Mode** (planned). You describe an idea, BroCODE drafts a bounded plan (which files, which constraints), you approve or edit the plan, and only then is code generated.
  - Why: Transparent: you see the intended scope before any code exists. Reversible: a rejected plan costs nothing. Local control: nothing is generated without your approval.
  - Control: The plan is a step you must approve; you can edit files and constraints or stop entirely.
- **Token and Context Meter** (planned). A real-time display of exactly which source data would be sent to the AI for each request.
  - Why: Transparent: no hidden context. Local control: you see, and can trim, what leaves your device before you consent to send it.
  - Control: You review the outgoing context per request and decide whether to send it.
- **Diff Risk Badges** (planned). Automatic flags on higher-risk changes, such as config files, dependencies and public-facing code, with extra review prompts.
  - Why: Transparent: risky edits are called out instead of blending into a long diff. Reversible: flagged changes get a closer look before they are applied.
  - Control: Badges only add prompts; you still accept or reject every change yourself.
- **Checkpoint Auto-Snapshot** (planned). An automatic local snapshot before every AI operation, with one-click restore.
  - Why: Reversible: every AI step would have a way back without remembering to save. Local control: snapshots would stay on your device.
  - Control: You choose when to restore; snapshots would be stored locally.
- **Undo and Redo Across Sessions** (planned). A persistent checkpoint timeline that survives browser refreshes, so undo and redo keep working across sessions.
  - Why: Reversible: a refresh or closed tab would no longer erase your history. Local control: the timeline would live in local storage you own.
  - Control: You move along the timeline yourself; nothing is undone or redone automatically.

## Iteration 2: The Verification Layer (target weeks 4–6 from start)

**Goal:** Turn reviewable into verified, with automated testing.

- **Validation Loop** (planned). Runs linters and tests in the static preview sandbox before a diff is proposed, and blocks diffs that fail.
  - Why: Transparent: you see check results, not just a claim that code works. Reversible: failing changes never reach your files.
  - Control: You see every result and still decide what to apply.
- **Acceptance-Checklist Panel** (planned). Verifiable acceptance criteria attached to each proposal, linked to the Prompting for code guide. See [Prompting for code](https://codingagent.in/guides/prompting-for-code/).
  - Why: Transparent: “done” is defined up front and checked against the proposal.
  - Control: You write or edit the criteria and tick them off yourself.
- **Static Preview Validation Report** (planned). A report of what the static preview blocked versus rendered, marked safe to deploy or needs review.
  - Why: Transparent: you see exactly what the script-disabled preview could and could not show.
  - Control: The report advises; the deploy decision stays yours.
- **Repo-Wide Context Indexing** (planned). A local index of the whole project so requests can reference the right files.
  - Why: Local control: the index would be built and kept on your device; with the context meter, you still see what is sent.
  - Control: You choose which indexed files go into a request.
- **Diff Compare View and Multi-File Batch Apply** (planned). A side-by-side diff that preserves local edits, with inline comments and per-file accept or reject across a multi-file change.
  - Why: Reversible: you can take part of a change and leave the rest. Transparent: every file is reviewed in context.
  - Control: Nothing applies until you accept it, file by file.

## Iteration 3: The Workflow Layer (target weeks 7–9 from start)

**Goal:** Make repeated tasks faster without losing control.

- **Templates: Prompts and Projects** (planned). A prompt templates library combined with project templates that pin their starter source.
  - Why: Transparent: you start from known, visible source and prompts instead of a blank, unpredictable draft.
  - Control: You pick, edit and save templates; pinned source does not change underneath you.
- **Export Plans and Checks** (planned). Export plans and acceptance checks together with your ZIP or JSON export.
  - Why: Local control: the reasoning behind a change travels with your files.
  - Control: You choose what to include in each export.
- **GitHub Push Button** (planned). Push a reviewed diff to GitHub with an auto-generated commit message.
  - Why: Transparent: only reviewed changes are pushed, with a readable message describing them.
  - Control: You review and can edit the commit message, and nothing is pushed without your click.

## Iteration 4: The Intelligence Layer (target weeks 10–12 from start)

**Goal:** Smarter context and automation, still local-first.

_Android workflow export presets fold into this iteration once the Android release ships._

- **Bring Your Own Model** (planned). Use your own model provider or a local model through tools such as Ollama or LM Studio.
  - Why: Local control: you decide which model sees your code, including models that never leave your machine.
  - Control: You choose and switch the model per project.
- **Local Offline Autocomplete** (planned). Optional autocomplete powered by a small local model, working offline.
  - Why: Local control: suggestions without sending source anywhere.
  - Control: Off unless you turn it on.
- **Async Background Build Queue** (planned). Long tasks run in the background and come back as a reviewable diff.
  - Why: Reversible: background work never edits files directly; it arrives as a proposal.
  - Control: You review the resulting diff like any other.
- **Usage and Cost Meter** (planned). Usage and cost per model or provider, with budget alerts.
  - Why: Transparent: you see what each request costs before it surprises you.
  - Control: You set the budgets and alerts.
- **Erasure Request Tracker** (planned). Track data erasure requests to AI providers, with an audit trail.
  - Why: Local control and transparency: a record of what you asked providers to delete, and when.
  - Control: You file and track each request.

## Iteration 5: The Polish Layer (target weeks 13–15 from start)

**Goal:** Refine edge cases and UX.

- **SEO Audit Pass** (planned). An SEO check on generated pages. Nice-to-have.
  - Why: Transparent: issues are reported as suggestions, not silent rewrites.
  - Control: You choose which fixes to apply.
- **Shared Read-Only Review Links** (planned). Time-limited, read-only links so someone else can review a proposal.
  - Why: Local control: sharing is explicit, read-only and expires.
  - Control: You create, scope and revoke each link.
- **Voice and Messy-Thought Input** (planned). Turn spoken or rough notes into a structured request. Low priority, high effort.
  - Why: Transparent: you see the structured request before anything runs.
  - Control: You edit the structured request before sending it.

## What exists today

BroCODE V3 offers editable source files, reviewable AI diffs that preserve local edits, manual local checkpoints, ZIP and JSON exports, a script-disabled static preview and consent before source is sent for AI help.

## Internal

_Not part of the public roadmap._ Self-hosted font and lint presets for Lighthouse 100s: internal tooling, not a public roadmap item; to be shipped directly.
