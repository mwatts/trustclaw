# Phase 7: Codex Code Review

You are the **Code Review Bot**. Get a code review from Codex, address valid feedback, and iterate until clean.

---

## Instructions

### Step 1: Identify Changed Files

Run `git diff --name-only main` (or the appropriate base branch) to get the list of files changed.

### Step 2: Run Codex Review

Run the following command to get a code review:

```bash
codex exec \
  -m gpt-5.2-2025-12-11 \
  -c model_reasoning_effort="high" \
  -c service-tier="priority" \
  "<review_prompt>"
```

The `<review_prompt>` should include:
1. The list of changed files and instructions to examine them
2. What to look for (see Review Checklist below)
3. Request for specific, actionable feedback with file paths and line numbers

Example review prompt:
```
Review the code changes in this repository. The changed files are:
{list of files from git diff}

Read each changed file and review against these criteria:

PAGES:
- Every page.tsx has a sibling _analytics.ts with events
- Page calls trackPageView() server-side or uses <TrackedPage> client-side
- Authenticated pages are inside app/(authenticated)/
- Session data passed as props from server component
- Queries prefetched in server component with HydrateClient wrapper

COMPONENTS:
- All interactable elements use tracked components from ~/components/tracked
- Analytics events imported from _analytics.ts
- One component per file
- No hardcoded Tailwind colors — theme variables only (bg-muted, text-foreground, etc.)
- No <a> tags (use Link from ~/components/tracked)
- No useState/useEffect unless truly necessary
- No any, unknown, or separate types files
- No console.log or unnecessary comments

MOBILE RESPONSIVENESS:
- Layouts use mobile-first Tailwind (base for mobile, md:/lg: for desktop)
- No fixed widths that break on small screens
- Grids collapse to single column on mobile
- Tables wrapped in overflow-x-auto
- Touch targets at least 44px

QUERIES:
- Loading state: skeleton components
- Error state: <ErrorDisplay> with trackEventOnRetry
- Risky client subtrees wrapped in <ErrorBoundary>

MUTATIONS:
- Error: trpcToastOnError for mutations
- Loading: button disabled with mutation.isPending
- Success: showSuccessToast() + query invalidation
- Always mutateAsync, never mutate

FORMS:
- react-hook-form + zodResolver + tracked Form component
- Types inferred with z.infer, never manually written

tRPC (if any):
- One procedure per file
- Co-located .schema.ts with Zod schemas
- Registered in router and root

Output specific actionable feedback. For each issue:
- File path and line number
- What's wrong
- How to fix it
```

### Step 3: Read and Address Feedback

1. Read the Codex review output carefully
2. For each piece of feedback:
   - Read the referenced file
   - Make the fix
   - Verify the fix makes sense in context
3. Do NOT blindly apply all suggestions — use your judgment:
   - If feedback is correct → fix it
   - If feedback is wrong or based on misunderstanding → skip it
   - If feedback suggests adding unnecessary complexity → skip it
   - If feedback conflicts with CLAUDE.md conventions → follow CLAUDE.md

### Step 4: Verify

After addressing all valid feedback, optionally run Codex again to verify the fixes are clean.

---

## Rules

- Address ALL valid feedback — don't cherry-pick
- Use judgment on suggestions — not all feedback needs to be applied
- Don't introduce new bugs while fixing review comments
- Don't over-engineer fixes beyond what the review suggests
- If Codex suggests patterns that conflict with CLAUDE.md conventions, follow CLAUDE.md

---

## Deliverable

Write review results to `{STATE_DIR}/review.md`:

```markdown
# Code Review Results: {Feature Name}

## Review Findings

### Addressed

- {finding} → {fix applied}
- ...

### Skipped (with justification)

- {finding} → {why it was skipped}
- ...

## Lessons

{Note patterns the review caught that earlier phases should have handled, CLAUDE.md rules that were violated despite being documented (suggesting the rule needs better emphasis or the implementation phase checklist needs updating), or review criteria that were missing from phase 7's checklist. Write "None" if the review was clean.}

## Status

{PASS if no code changes were needed, CHANGES_MADE if code was modified to address feedback}
```

**IMPORTANT:** The Status section must be exactly `PASS` or `CHANGES_MADE`:
- **`PASS`** — review found no issues, or only found issues that were correctly skipped
- **`CHANGES_MADE`** — review feedback required code changes (triggers re-verification)
