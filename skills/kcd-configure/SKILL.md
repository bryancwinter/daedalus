---
name: kcd-configure
description: Interview the user to turn an empty KCD vault into lenses that are genuinely about THIS project. Use after "daedalus get-started" has written a survey — invoked by name at the end of the install, or again later to add a lens for a component that did not exist the first time. This is a conversation with the user, not a solo authoring pass; if no user is available, stop and say so rather than inventing their answers.
---

# KCD Configuration Walkthrough

A fresh vault holds the framework's floor and nothing about this project. This closes that gap by
**asking**, in six stages. The survey tells you what the code IS; only the user can tell you how they
intend to work in it, and the second half is where all the value is.

**The questions are the point, not overhead on the way to a vault.** A user learns what a lens is by
being asked the questions only a lens can answer. If you answer them yourself from the survey, you
produce a vault with plausible content and no owner, and the user learns nothing from questions they
were never asked. That is the one failure mode that defeats this skill entirely.

## The rule that governs everything below

**Default facts. Never default taste.**

- **Know may be derived.** It is factual, and the survey is real evidence. A user who will not answer
  still gets a usable Know section off the roster — marked `status: draft`, so "nobody decided this"
  stays visible.
- **Care may never be derived.** Care is by definition the part no survey produces. Inventing it does
  not yield a mediocre lens; it yields a **fabricated authority that a future session will defend
  against the user**. If the Care questions go unanswered, write Purpose as a factual one-liner and
  leave Philosophy explicitly empty with a marker saying it was not elicited. An empty section is
  honest. An invented one is a lie with teeth.

## How to write

**One artifact at a time, validated before you move on.** Write with `kcd_save`, then run
`kcd_health` on exactly what you just wrote and fix every error before the next one. Warnings are
advisory; errors are not.

Never batch the writes to the end. A walkthrough gets abandoned halfway — someone gets pulled into a
meeting at stage 3 — and what has been settled by then must already be on disk and valid. A partial
vault the user can finish later beats a complete one that never landed.

## Stage 0 — Orient, and ask nothing

Read `_Claude/audits/survey/index.json` — the roster. If it is missing, run `daedalus get-started`
(or the `kcd_survey` tool) once, then read it. Do not go exploring the tree; see
`_Claude/references/how-to/read-a-survey.html` for what a census does and does not claim.

Play it back in plain language — components, what each is written in, roughly how big. Then stop and
let the user correct you. Get this wrong and every answer downstream is answering the wrong question.

## Stage 1 — Boundaries

**Ask: "When you sit down to work on this, do you stay in one place, or move between these?"**

That sounds like a scheduling question and is actually the lens question. A lens is what loads at the
*start of a session*, so how their sessions are shaped IS where the lens boundaries are — which is
how this stage teaches the concept instead of explaining it.

Propose a shape off the roster and say why, then let them correct it:

- **One project lens** when the roster is one coherent codebase.
- **One lens per component** when components have different ecosystems or manifests and someone would
  realistically work in one without touching the others.
- **A hybrid** — one lens for the thing they live in, one shared lens for everything else.

A one-component roster does not earn five lenses. Lenses are deliberately inclusive, so overlapping
scope is fine and is not a reason to split.

## Stage 2 — Know, per lens

**Ask: "When you come back to this in six months, what will you have forgotten?"**

That question *is* Know. Follow it with:

- "What did you have to learn the hard way here?"
- "What isn't where someone would expect it?"

Turn the answers into References (a real path worth citing) and Domains (a directory a session should
have loaded). If they name something structural and stable, that is a reference — offer to write it
in stage 5 rather than stuffing the prose into the lens.

## Stage 3 — Care, per lens

Two parts, in this order. Do not merge them.

**Purpose — ask: "What is this FOR? Not what it is — what it's for."** Two or three sentences. If they
describe what it does instead of what it is for, that is normal; ask again with their own words handed
back.

**Philosophy — ask: "What do you want an agent to refuse to do here?"** This is the sharpest question
in the whole walkthrough and it is worth waiting through a silence for. Follow with "what would make
you reject a change to this?"

Re-read the rule above before writing this section. Unanswered Philosophy stays empty and marked.

## Stage 4 — Habits

**Ask: "Is there a command that must run before you'd believe a change works?"** Concrete, and it maps
straight onto a habit. Then: "What must an agent never do without asking?"

Write a habit only for a rule the user actually stated, or one you can point at in the survey data (a
lint config, a test framework's presence). Never invent house style. This is the highest-value content
in a mature vault and the easiest to fake convincingly.

## Stage 5 — References

**Ask: "What would you rather write down once than explain again?"**

Offer candidates you already have evidence for — build and test commands off a discovered manifest, a
constraint they mentioned in passing, an architecture fact the roster surfaces. Structure the document
per `_Claude/habits/unslotted/author-reference.html`.

## Stage 6 — Close

Whole-vault `kcd_health` sweep. Then report what you authored and **why**, with every claim traced to
either a specific line in the roster or a specific thing the user said. A claim you can trace to
neither is a claim you invented — remove it.

Then say plainly what was NOT done: generators and analyzers (which repetitive work in this project is
worth automating) are a separate, later session, not part of a first run. Leaving that unsaid reads as
though the vault is finished when it is only started.

## The two users this must survive

**The one who answers "I don't know" to everything.** Keep going. State the default you are using and
where to change it later, mark the artifact `status: draft`, and respect the Care rule — a vault they
can edit beats an abandoned install. Do not interrogate.

**The one who writes essays.** This is the harder case and the one that quietly fails. A bloated lens
is a failed lens: every line must change how a session thinks or acts. So compress, then confirm —
"here is what I would keep from that, and here is what I would cut as too general to change
behaviour." Never trim their words silently; cutting the user's own content needs their sign-off.

## Where the craft lives

This skill carries the questions and nothing else. It does not carry authoring taste, because the
vault already has it and two copies would drift.

**You should already be wearing `lens-crafter`.** The install tells the user to compile it before
invoking this skill, so the taste arrives the way everything else in KCD arrives — compiled from the
vault, not restated in a skill file. That also means you are learning the framework from the framework
while you run this, which is most of the point.

If it is not loaded, load it before asking anything:

    kcd_compile { lenses: ["lens-crafter"] }

That one call also brings `_lens-base`, so you get the project-wide floor — write-approval, work
routing — in the same breath. Do not proceed without it and do not substitute your own instincts for
it; a walkthrough that authors lenses without the authoring lens is the failure this skill exists to
prevent.

It carries these, so you rarely need to open them directly:

- `_Claude/references/kcd_sdk/lens_anatomy.html` — the K/C/D contract.
- `_Claude/references/kcd_sdk/kcd-document-protocol.html` — the format `kcd_save` validates against.

## What this is not

Not a codebase explorer, not a second survey, and not a solo authoring pass. It is an interview whose
by-product is a configured vault. If there is no user in the room to interview, say so and stop — that
is a real answer, and it is better than a vault full of confident guesses.
