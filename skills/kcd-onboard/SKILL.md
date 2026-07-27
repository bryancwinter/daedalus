---
name: kcd-onboard
description: Use once, right after "daedalus init" has deployed a fresh KCD vault into this project, to turn the survey it wrote into real project-specific lenses, references, and habits. A vault that only has the shipped floor is structurally valid but empty — this is what makes it worth having. Self-contained: it explains the standard rather than loading it, because it runs before that standard is configured.
---

# KCD Onboarding

A vault right after `daedalus init` has the framework's shipped floor and nothing about THIS
project. This skill closes that gap in three stages, in order, without skipping ahead. Each stage
is backed by a real tool call — this is deterministic work an agent judges, not a codebase an
agent explores. Never make a claim about the project that is not traceable to the survey.

## Stage 1 — Shallow research off the survey

Do not read source files yet. Read `_Claude/audits/survey/index.json` — the roster `init` already
wrote. It is a flat list of every real component the project has: its ecosystem, language,
manifest, and rough size. If that file is missing or looks stale (a component you know exists
isn't listed), run `daedalus survey` ( or the `kcd_survey` tool ) once to refresh it, then read the
roster again. That single file is the entire anchor for stage 2 — do not go spelunking through the
tree looking for more.

## Stage 2 — Decide what to author

From the roster alone, decide what's worth writing. Typical shape:

- **One project lens** if the roster shows a single coherent codebase — a Know+Care pair that
  states what the project IS and how to work in it, sized to what the survey actually found ( a
  one-component roster does not earn a five-paragraph Care section ).
- **One lens per sub-project** only if the roster shows genuinely separate components ( different
  ecosystems, different manifests, e.g. a monorepo ) that a session would realistically work in
  independently.
- **References**, not lens prose, for anything structural and stable enough to be worth a citation
  later ( build commands from a discovered manifest, an architecture fact the roster surfaces ).
- **Habits** only for a convention you can point at in the survey data itself ( a lint config, a
  test framework's presence ) — never invent a house style the survey gives no evidence for.

If the survey does not clearly justify a given artifact, don't write it — an empty vault beats a
vault padded with guesses.

### Authoring rules — carried here, not compiled

This skill is **self-contained on purpose** ( ruled 2026-07-26 ). It runs at the one moment KCD is
not yet configured, so it cannot depend on KCD to explain itself: no lens is loaded, nothing is
compiled. Treat this as a migration onto a standard, and the standard has to be legible before the
tooling that reads it exists. The vault ships a `lens_crafter` lens which owns this taste in depth
and is worth reading later — but a bootstrap step must not depend on the thing it bootstraps.

A **lens** is a Know + Care pair. It is a *personality*, not an action list or a config file.

- **Know** — what this lens reads. References, domains, the paths it should always have loaded.
  The test: *what will someone have forgotten when they come back to this in six months?*
- **Care** — Purpose and Philosophy. What this lens defends and what it refuses. The test: *what
  do you want an agent to push back on here?*

What makes a lens good:

- **Tight.** A bloated lens is a failed lens. Every line must change how a session thinks or acts,
  or it gets cut.
- **Specific to this project.** "Clean code" and "good test coverage" are everyone's values and
  belong in no lens. "Timestamps are stored as epoch milliseconds, never local time" is a lens.
- **Traceable.** Every claim points at something real — a line in the survey, or something the
  user told you. Never at inference about a codebase you did not read.
- **Linked.** Artifacts link to what they depend on and what depends on them. Links are cheap;
  routing around a missing one is expensive.

## Stage 3 — Promote through the validator

Write with `kcd_save`. A document is not done when it's written — it's done when it validates.
After every save, run `kcd_health` ( or `daedalus validate <path>` ) against exactly what you just
wrote and fix every error before moving to the next artifact. Warnings are advisory; errors are
not — never leave a save in an error state and move on.

When every planned artifact is written and clean, do a final whole-vault `kcd_health` sweep. Report
what you authored and why, each claim traceable to a specific line in the survey roster — not to
inference about the codebase.

## What this skill is not

Not a codebase explorer and not a second survey. It is the sequencing that gets an agent from "the
vault is empty" to "the vault is about this project" without either skipping the anchor or
freelancing past it.

## KNOWN INCOMPLETE — stage 2 has the wrong owner

Stage 2 currently has **you** choose the lens boundaries alone. That was written when no user was
in the room, and it is the wrong owner now: the survey shows what the code *is*, never how its
author intends to work in it. Purpose, Philosophy, house style and which references are worth
keeping cannot be derived from a file census at any depth — elicit them or they are invented.

Until the configuration walkthrough replaces this stage, **ask before you author**. Propose the
boundaries you read off the roster, say why, and let the user correct you. If they decline to
answer, proceed with your best reading but mark every artifact you authored that way
`status: draft` rather than `active` — so "nobody actually decided this" stays visible instead of
looking settled.
