# Phase 8: Learn

You are the **Learning Bot**. Reflect on this feature implementation and make small, targeted improvements to project documentation so future Claudes benefit from what was learned.

---

## Instructions

### Step 1: Identify What Was Learned

Read the `## Lessons` section from each deliverable:
1. `{STATE_DIR}/implementation.md` — what tripped up the implementation bot
2. `{STATE_DIR}/lint-build.md` — surprising lint/build errors
3. `{STATE_DIR}/test.md` — what broke at runtime or on mobile
4. `{STATE_DIR}/review.md` — what the review caught that earlier phases missed

Also skim `{STATE_DIR}/plan.md` and the actual code changes (`git diff --name-only main`) for additional context.

The Lessons sections are your primary input. If all four say "None", there's likely nothing to update — verify quickly and move on.

For any non-"None" lesson, ask:
- Is this a gap in CLAUDE.md? (missing convention, wrong rule, undocumented pattern)
- Is this a gap in a workflow phase? (missing checklist item, unclear instruction, missing review criteria)
- Is this a feature-area gotcha that future Claudes need? (non-obvious architecture, domain-specific pattern)

**Focus only on gaps, corrections, and small clarifications.** Do NOT restate existing rules or document things that are already clear.

### Step 2: Update Root CLAUDE.md (if needed)

Read `/Users/sarahsimionescu/Documents/GitHub/dashboard/CLAUDE.md` and make small, targeted edits ONLY if:
- A convention was missing that caused mistakes during implementation
- An existing rule was wrong or outdated
- A new pattern was established that other features will reuse
- A gotcha was discovered that isn't documented

**Do NOT:**
- Add a section summarizing this feature
- Rewrite existing rules that are already correct
- Add verbose explanations — keep the same concise style as existing entries
- Add anything speculative or feature-specific

### Step 3: Update Feature-Area CLAUDE.md (if applicable)

Check if the feature's code lives in a distinct directory (e.g., `src/app/(authenticated)/dashboard/chat/`, `src/server/api/routers/agent/`).

**If a CLAUDE.md already exists in that area:**
- Read it and make small corrections or additions based on what was learned
- Fix anything that's outdated or wrong

**If no CLAUDE.md exists AND the feature is significant/complex** (multiple files, non-obvious architecture, domain-specific patterns):
- Write a concise CLAUDE.md in the feature's root directory
- Cover: purpose, key files, architecture decisions, non-obvious patterns, gotchas
- Keep it short — aim for 30-80 lines, not a novel
- Follow this structure:

```markdown
# {Feature Area}

## Overview
{1-2 sentences on what this feature does}

## Key Files
{List of important files with one-line descriptions}

## Architecture
{How the pieces fit together — data flow, state management choices, etc.}

## Patterns & Gotchas
{Non-obvious things future Claudes need to know}
```

**If the feature is simple** (single component, minor addition) — skip this step entirely.

### Step 4: Update Feature Workflow (if needed)

Read `.claude/skills/feature-workflow/SKILL.md` and the relevant phase files in `.claude/skills/feature-workflow/phases/`.

**Update individual phase files** (`1-journey.md` through `7-codex-review.md`) if:
- A phase's instructions were unclear and caused the sub-agent to take the wrong approach
- A checklist or review criteria missed something that was caught in a later phase
- A phase produced a deliverable that was missing information needed by downstream phases
- Code patterns or conventions used during implementation should be added to the review checklist (phase 7)
- The research phase (phase 2) should look up a library/tool that wasn't listed but was needed

**Update `SKILL.md`** if:
- The sub-agent prompt template was missing important context
- The verification loop had a gap
- The deliverable inclusion table needs different prerequisites for a phase

**Do NOT rewrite phases that worked fine.** Only touch files where there was actual friction or a missed catch.

---

## Rules

- **Minimal changes only.** If nothing needs updating, that's a valid outcome.
- **Match existing style.** Documentation edits should be indistinguishable from the surrounding text.
- **No feature-specific content in root CLAUDE.md.** Only general patterns and conventions.
- **No changelog entries.** This is about improving documentation, not recording history.
- **Read before editing.** Always read a file before modifying it.

---

## Deliverable

Write results to `{STATE_DIR}/learn.md`:

```markdown
# Learning: {Feature Name}

## Changes Made

### Root CLAUDE.md
- {description of edit} (or "No changes needed")

### Feature-Area CLAUDE.md
- {created/updated path and what was added} (or "No changes needed" or "N/A — simple feature")

### Feature Workflow
- SKILL.md: {description of edit} (or "No changes needed")
- Phase files updated: {list phase numbers and what changed} (or "None")

## Status

DONE
```
