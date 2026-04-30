---
name: feature-workflow
description: Orchestrates full feature implementation through 8 phases using sub-agents with state files. Handles re-runs when later phases require code changes. Use for any non-trivial feature request.
---

# Feature Workflow Orchestrator

Drives a feature from idea to verified implementation using phased sub-agents with shared state.

```
JOURNEY → RESEARCH → PLAN → IMPLEMENT → ┌→ LINT/BUILD → TEST → REVIEW ─┐ → LEARN
                                         └──────────── (if changes) ←───┘
```

---

## Step 1: Setup

1. Check if the prompt already specifies a `STATE_DIR` — if so, use it. Otherwise, derive a kebab-case `FEATURE_NAME` from the user's request (e.g., "add user settings page" → `user-settings-page`) and set `STATE_DIR` = `.claude/state/FEATURE_NAME/`
2. Create the state directory via Bash: `mkdir -p STATE_DIR`
3. Write the user's raw feature request to `STATE_DIR/request.md`

---

## Step 2: Planning Phases (1 → 2 → 3)

Run sequentially. Each phase produces a deliverable that the next phase reads.

| Phase | File to Read | Deliverable |
|-------|-------------|-------------|
| 1 — Journey | `phases/1-journey.md` | `STATE_DIR/journey.md` |
| 2 — Research | `phases/2-research.md` | `STATE_DIR/research.md` |
| 3 — Plan | `phases/3-plan.md` | `STATE_DIR/plan.md` |

**For each phase:**

1. Read the instruction file from `.claude/skills/feature-workflow/phases/`
2. Launch a `general-purpose` sub-agent via the **Task tool** with a prompt built from the template below
3. After the sub-agent returns, read the deliverable from `STATE_DIR` to verify it was written
4. Tell the user the phase is complete

---

## Step 3: Implementation Phase (4)

| Phase | File to Read | Deliverable |
|-------|-------------|-------------|
| 4 — Implement | `phases/4-implement.md` | `STATE_DIR/implementation.md` |

Same pattern: read instruction file, launch sub-agent, verify deliverable.

---

## Step 4: Verification Loop (5 → 6 → 7, repeat if needed)

Phases 5–7 form a loop. If phase 6 or 7 makes code changes, restart from phase 5.

**Max 3 full iterations** to prevent infinite loops.

| Phase | File to Read | Deliverable | Status Values |
|-------|-------------|-------------|---------------|
| 5 — Lint & Build | `phases/5-lint-build.md` | `STATE_DIR/lint-build.md` | `PASS` (always — iterates internally) |
| 6 — Test | `phases/6-test.md` | `STATE_DIR/test.md` | `PASS` or `CHANGES_MADE` |
| 7 — Code Review | `phases/7-codex-review.md` | `STATE_DIR/review.md` | `PASS` or `CHANGES_MADE` |

### Loop Algorithm

```
for iteration in 1..3:

  Run Phase 5 (lint/build)
  → Always ends PASS (sub-agent iterates internally until clean)

  Run Phase 6 (test)
  → Read STATE_DIR/test.md, check ## Status section
  → If CHANGES_MADE: tell user "Test fixes required re-verification", continue loop

  Run Phase 7 (code review)
  → Read STATE_DIR/review.md, check ## Status section
  → If CHANGES_MADE: tell user "Review fixes required re-verification", continue loop

  All three passed cleanly → break

If max iterations reached without all clean:
  Report status to user and ask how to proceed
```

### Reading Status from Deliverables

After each verification sub-agent completes, read the deliverable file and look for the `## Status` section at the bottom. It will contain exactly one of:
- **`PASS`** — no issues found, no code changes made
- **`CHANGES_MADE`** — issues found, code was changed to fix them

---

## Step 5: Learning Phase (8)

After the verification loop exits cleanly, run the learning phase to capture improvements.

| Phase | File to Read | Deliverable |
|-------|-------------|-------------|
| 8 — Learn | `phases/8-learn.md` | `STATE_DIR/learn.md` |

Same pattern: read instruction file, launch sub-agent, verify deliverable.

This phase reviews the entire implementation and makes small, targeted improvements to:
- Root `CLAUDE.md` (if conventions were missing/wrong)
- Feature-area `CLAUDE.md` (create one for complex features, update existing ones)
- Feature workflow skill files (if phases had gaps)

**This is NOT a summary of what was learned.** It's about making concrete documentation edits so future features go smoother.

---

## Step 6: Completion

After the learning phase completes:

1. Read `STATE_DIR/implementation.md` for the summary of what was built
2. Tell the user:
   - What was built (features, pages, components)
   - Key files created/modified
   - What documentation was updated (from `STATE_DIR/learn.md`)
3. Output the completion signal with verification confirmations:

```
<promise>
FEATURE COMPLETE
lint: PASS
build: PASS
test: PASS
review: PASS
</promise>
```

**The completion signal MUST include all four verification lines.** This is used by automation (Ralph) to confirm the feature is truly done. Only output this signal if ALL verifications actually passed.

---

## Sub-Agent Prompt Template

When launching a sub-agent, construct the prompt using this template. **Always include the full instruction file content and all prerequisite deliverables.**

```
You are implementing the feature "{FEATURE_NAME}" in a Next.js dashboard project.

Working directory: /Users/sarahsimionescu/Documents/GitHub/dashboard
State directory: {STATE_DIR}

IMPORTANT: Read CLAUDE.md at the project root first to understand conventions.

---

## Feature Request

{paste contents of STATE_DIR/request.md}

---

## Context from Previous Phases

{paste contents of prerequisite deliverables — e.g., for Phase 3, include journey.md and research.md}

---

## Your Task

{paste verbatim contents of the phase instruction file}
```

### Which deliverables to include per phase:

| Phase | Include in Prompt |
|-------|------------------|
| 1 | (none — just the request) |
| 2 | `journey.md` |
| 3 | `journey.md` + `research.md` |
| 4 | `plan.md` |
| 5 | `plan.md` (for context on what files were created) |
| 6 | `journey.md` (for the user journey to test) |
| 7 | `plan.md` (for review criteria context) |
| 8 | `plan.md` + `implementation.md` + `test.md` + `review.md` (for full context on what was built and what issues arose) |

### Re-run prompts:

When re-running phases 5–7 after changes, add to the prompt:

```
NOTE: This is a re-run. A later phase made code changes that require re-verification.
Previous {phase} deliverable is at STATE_DIR/{deliverable} for reference.
```

---

## Important Notes

- **Sub-agent type:** Always use `general-purpose` for all phases — they need Read, Write, Edit, Bash, Glob, Grep, and potentially ToolSearch (for Chrome MCP in phase 6 and shadcn MCP in phase 2)
- **Parallel phases:** Phases 1 and 2 could theoretically run in parallel, but phase 2 benefits from reading the journey. Keep them sequential for reliability.
- **Large features:** For very large features, phase 4 (implementation) may need to be broken into multiple sub-agent calls. If the plan has many files, split implementation into batches.
- **User communication:** After each phase completes, briefly tell the user what was accomplished and what's next.
- **State directory cleanup:** The state directory persists for reference. The user can delete it when no longer needed.
