# Daedalus

A context compiler for KCD — the Know / Care / Do framework.

A Model Context Protocol server and a CLI over one engine. Point it at a repository and it gives your coding
agent a **vault**: a small library of structured documents describing what this project is,
how its author wants it worked on, and what an agent should refuse to do. The agent loads
that instead of rediscovering your codebase every session.

> **Status: alpha, and this README is a working map rather than a finished document.**
> It exists so a human and an agent can share one honest account of what is built. Every
> step below carries a status marker. Nothing here is aspirational — if it says DONE, it
> has been run.
>
> **Last verified: 2026-08-18.** (Stages 1–5 last walked end to end 2026-07-29; the
> 2026-08-18 pass covered the write and repair paths only — see *Integrity* below.)

---

## Status at a glance

| | |
|---|---|
| ✅ **DONE** | Built, run, and verified. |
| 🟡 **PARTIAL** | Works, with a named gap. |
| ❌ **NOT BUILT** | Designed, not written. |
| ⏳ **PENDING BUILD** | Written, needs a rebuild to reach the shipped bundle. |

The short version: **the mechanical install works end to end. The judgment layer does
not exist.** You can install a valid, empty vault today. Turning that into lenses about
*your* project is currently the agent guessing, because the flow that would ask you has
not been written. That is the single largest gap and everything else is smaller.

---

## The critical path — every step of a complete install

### Stage 1 — Get the kit

| # | Step | Status | Notes |
|---|---|---|---|
| 1.1 | Node ≥ 18 present | ✅ DONE | Checked by `init`'s preflight before anything is written. Also reported by `daedalus doctor`. |
| 1.2 | `git clone` the repository | ✅ DONE | |
| 1.3 | Build the kit | ✅ **N/A — no separate build step** | `npm install` builds it, via `prepare`. Still one command, but the reasoning changed on 2026-08-13: `dist/` used to be committed, which meant the shipped bundle's provenance ran through kcd_sdk's own gitignored `dist/` and could silently disagree with the source beside it. esbuild now bundles the SDK from source in one hop and the build runs on install, so there is nothing committed that can go stale. Any instruction telling you to run a build *before* installing is wrong. |
| 1.4 | `npm install -g .` from the package root | 🟡 PARTIAL | Puts `daedalus` on PATH via npm's own mechanism — a symlink on POSIX, the shim trio on Windows. No PATH surgery, no bespoke installer. **The packaging itself is unproven:** the only install anyone has done links back to the dev repo, so every test so far has exercised the *content*, not the *package*. One install from an `npm pack` tarball would close this — and it matters more since 2026-08-13, because `dist/` is now built rather than committed. `package.json`'s `files` array is the allowlist for what ships, and `.npmignore` exists only to stop npm's `.gitignore` fallback from excluding the freshly built `dist/`. |

### Stage 2 — Install into your project

| # | Step | Status | Notes |
|---|---|---|---|
| 2.1 | Choose the target project | ✅ DONE | `init` refuses if it infers a root *above* your working directory rather than quietly repairing the wrong project. `--root` is the escape hatch. |
| 2.2 | Where the vault goes | ✅ DONE | **Settled 2026-07-26: one vault per repository. The lens is the per-component unit, not the vault.** Splitting vaults would break the link graph, force hard boundaries where lenses are deliberately inclusive, duplicate every habit, and make *which vault you get* depend on your cwd. `init` now anchors on the folder holding your **agent entry file** — a repo with a `CLAUDE.md` has already chosen where agents are configured, and the vault belongs beside it. Marker filenames are read from the bundle's seed declarations, never hardcoded. `--root .` overrides. |
| 2.3 | In-place or workspace mode | ✅ DONE | **Workspace mode dropped 2026-07-26.** A vault outside the repository breaks `inferProjectRoot`'s upward walk — it is an alternate topology, not a flag. The concern behind it ("I don't want this in my git history") is fully served by three lines in `.gitignore`, so `init` asks the question once and appends the block itself. **No `daedalus gitignore` command (2026-07-28):** maintaining a `.gitignore` is something every developer already knows how to do, and owning a command for it bloats the surface with a chore that was never ours. Offered at the one moment it is useful; after that the file is theirs. Outside the stepper nothing is written uninvited — the lines are printed instead. |
| 2.4 | `daedalus init` — the stepper | ✅ DONE | Run in a terminal, `init` **asks** rather than printing a wall of text. **Step 1 is the shape** — the folder tree drawn relative to your project root, with a single question: build this here? Every step after it refines an answer already given; asking about MCP registration before anyone has agreed to the structure inverts the decision. Then: which agent entry points to write, what exactly goes in them (the block is shown before it is added), whether to register the server, whether to install the skills, and — **only inside a git working tree** — how much of the vault git should track. Six steps in a repo, five outside one; the counter is derived, so it cannot disagree with how many questions arrive. Each question says *why*, so configuring the install is the first lesson in what the pieces are. Numbered prompts rather than arrow-key menus — deliberately: raw-mode redraw is what breaks in the terminals where first installs happen. **Non-TTY is a first-class path** — piped, scripted or agent-driven runs take every default, never block, and say so in a banner. |
| 2.5 | `daedalus init confirm` | ✅ DONE | Four idempotent steps: deploy the vault, write host seeds, register the Model Context Protocol server, copy the bundled skills. Re-running repairs rather than duplicates. |
| 2.6 | Host entry points written | ✅ DONE | `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` — created if absent, or a managed `<!-- kcd:begin -->` block prepended with your existing content preserved below. |
| 2.7 | A pre-existing `CLAUDE.md` that contradicts the vault | ✅ DONE | `init` now detects a host entry file that held its own content and says so: both halves are live, and if they disagree the agent cannot know which wins. Mechanical check, human response. |
| 2.8 | You are told what landed in your repository | ✅ DONE | `init` names every path it wrote, then asks the commit-or-ignore question rather than assuming an answer. |
| 2.9 | `daedalus clear` — the undo | ✅ DONE | Removes what the install added and **nothing else**: the managed block from each entry file (your own content stays), our `.mcp.json` entry (other servers untouched), bundled skills **only if still byte-identical to what shipped** — one you edited is yours and is kept — and our `.gitignore` block. **The vault is never removed without `clear all`**, which states how many artifacts are at stake first. An installer that cannot uninstall is asking a stranger to make an irreversible change on first acquaintance. |

### Stage 3 — Restart, and verify

| # | Step | Status | Notes |
|---|---|---|---|
| 3.1 | **Restart your agent session** | ✅ DONE | The likeliest first-run failure, now explicit. `.mcp.json` and `.claude/skills/` are read at session start, so a *correct* install leaves you with no KCD tools until you restart. `init` ends on this instruction and names the next command. |
| 3.2 | `daedalus get-started` | ✅ DONE | Runs the survey and prints a copy-paste verification prompt built from what it actually found — a live test you watch, phrased so an un-restarted session reports the diagnosis instead of guessing. |
| 3.3 | `daedalus doctor` | ✅ DONE | Environment, PATH, config provenance. |

### Stage 4 — Make the vault worth having

This is where the project currently stops being finished.

| # | Step | Status | Notes |
|---|---|---|---|
| 4.1 | The `kcd-configure` skill is available | ✅ DONE | Copied into `.claude/skills/` by `init`; never overwrites your edits on a re-run. |
| 4.2 | `lens-crafter` ships in the bundle | ✅ DONE | It was missing, and the walkthrough's central instruction was to compile it — so on every fresh install that step produced nothing. Now shipped as floor content. The skill no longer depends on it (see 4.6), so the defect is closed from both ends. |
| 4.3 | **Which lenses does this project need?** | 🟡 PARTIAL | The skill now **asks before authoring** and marks anything the user declined to decide `status: draft` rather than `active`, so "nobody decided this" stays visible. That is a stopgap: the real elicitation is 4.6. |
| 4.4 | **What goes in Care?** | ❌ NOT BUILT | Purpose and Philosophy are taste. No survey produces them; they must be elicited or they will be invented. |
| 4.5 | **Which references and habits?** | ❌ NOT BUILT | House style — naming, testing posture, what an agent must never do unasked. Only you have this, and it is the highest-value content in a mature vault. |
| 4.6 | The configuration walkthrough | ❌ NOT BUILT | The flow that would ask 4.3–4.5. **The main remaining deliverable.** Designed on the principle that the questions *are* the curriculum: you learn what a lens is by being asked the questions only a lens can answer. **Convention settled 2026-07-26:** it is a plain skill carrying its own context — **no lens loading, no compilation**. It runs at the one moment KCD is not yet configured, so it cannot depend on KCD to explain itself. This is a migration onto a standard, and the standard must be legible before the tooling that reads it exists. *(Supersedes the parent plan's position that the bundled skill should load `lens-crafter` "so the kit demonstrates the framework rather than arguing it away.")* |
| 4.7 | `kcd_health` passes | ✅ DONE | **Zero errors, zero warnings on a fresh install** — down from 34. Re-verified 2026-07-29 against the shipped bundle: `init confirm` into a genuinely empty directory lands 53 files and `daedalus validate` reports 0/0. |

### Stage 5 — Proven

| # | Step | Status | Notes |
|---|---|---|---|
| 5.1 | Installed cold by someone who has never seen KCD | ❌ NOT DONE | Never attempted, by anyone. A test rig and a synthetic corpus exist for exactly this; the baseline run is next. |
| 5.2 | Linux | ❌ NOT DONE | Windows is the platform in hand. Explicitly not blocking. |

---

## Known defects

Named rather than buried, because a shared map is only useful if it is honest.

1. **Deploy generates only a root `nav-index.html`**, never per-directory ones — so
   `lenses/nav-index.html` and `plans/nav-index.html` do not exist. Links to them have been
   removed rather than the indexes generated, which is the cheap answer; whether a library
   directory *should* carry its own nav-index is an open design question, not a bug.
2. **`entryPoints` is empty for every surveyed component**, even where an obvious entry point
   exists. The survey is the evidence base the walkthrough will reason from.
3. **A manifest-less directory is invisible to the survey.** A folder of SQL migrations and a
   deploy script is obviously a component to a human; with no manifest it is folded into
   `root` as loose files.
4. **`kcd_sdk` is declared as a `file:../kcd_sdk` runtime dependency** but the bundle inlines
   it and a standalone clone has no sibling. npm tolerates the dangling link, so this works
   by forbearance rather than design. Accepted debt, blocked on publishing the SDK properly.
5. **Cosmetic:** eleven bundled documents carry a table header with no rows. Seven were
   already that way; four became empty when their only links were project-specific and got
   stripped. Valid, and now honestly empty — but it reads oddly.

### Resolved 2026-07-26

- **The entry document was never deployed.** `root-context.html` told every new user's agent
  to open `root.html` three times over, and that file was not in the bundle, the manifest, or
  a fresh vault. The first instruction in every install pointed at nothing. A generic
  `root.html` now ships — de-branded, with its own "if this vault is new" section, and
  satisfying the `lens-index` splice contract.
- **34 warnings on a fresh vault → 0.** Links to this project's own references, to the retired
  `kcd/templates/`, and to un-generated per-directory indexes were removed; three genuinely
  generic framework references (`vault-layout`, `frontmatter_schema`, `reference_categories`)
  were shipped instead of stripped, because `kcd_framework.html` links them for good reason.
- **`substrate/references/insight/` was shipping but never deployed** — no manifest row, and
  Starmind-specific content in a generic bundle. Deleted.

---

## Commands

```
daedalus init [confirm]        Install into this project. Preview unless "confirm".
daedalus get-started           Post-restart: survey + a live verification prompt.
daedalus doctor                Environment, PATH, config provenance.

daedalus validate [path]       Validate one artifact, or the whole vault.
daedalus compile <lens...>     Compile lenses into one composed context string.
daedalus show <lens>           Everything a session wearing that lens receives, file by file, with token counts.
daedalus survey                Filename-level census of the project beside the vault.
daedalus query / links         Find artifacts; inspect a document's link graph.
daedalus maintain [fill]       Report what a vault is missing; optionally fill it.
daedalus fix-css [confirm]     Recompute every document's stylesheet link from its own depth,
                               and restore the inline baseline. Idempotent.
daedalus reset <path> [confirm]  Restore a deployed artifact from the canonical bundle.
daedalus seed [host] [confirm] Regenerate the host entry points. Omit the host for every seed
                               found; name one (claude, codex, gemini) to write just that entry
                               file. The names are the seed declarations' own, not a second list.
daedalus lens-index [confirm]  Regenerate the entry document's Lenses table.
daedalus clear [all] [confirm] Take the install back out. Removes only what it added;
                               "all" also removes the vault.
daedalus mcp                   Server-side subcommands (status, tools, call).
```

Exit codes: `0` clean, `1` errors, `2` usage. `--json` on the data-bearing commands;
payload to stdout, diagnostics to stderr.

Every write command previews by default and requires an explicit `confirm`.

---

## What this installs in your repository

Six paths, all yours to commit or ignore:

```
_Claude/          the vault — lenses, habits, contracts, references
CLAUDE.md         host entry point (managed block, your content preserved)
AGENTS.md         same, for Codex
GEMINI.md         same, for Gemini
.mcp.json         registers the daedalus Model Context Protocol server (merged, never clobbered)
.claude/skills/   the bundled skills
```

`daedalus init` touches nothing else, and moves none of your files.

That list is not hand-maintained. The three entry-point files come from the **seed** declarations
inside `_Claude/root-context.html`, so `daedalus clear` removes exactly what `daedalus init` added —
there is no second list to fall out of step. Supporting a new agent host is one new block in that
file, not an edit in two places.

**To undo it:** `daedalus clear` removes exactly those additions and leaves anything you wrote
or edited in place. `daedalus clear all` also removes the vault, after telling you how many
artifacts that costs. Both preview first.

---

## Concepts

Deliberately short — the vocabulary is meant to be earned by using it, not front-loaded.

- **Lens** — a Know + Care pair. A *personality*, not an action list. Know is what it reads;
  Care is what it defends. Lenses are inclusive: overlapping domains are a feature.
- **Vault** — the document store, `_Claude/` by convention.
- **Compile** — turn one or more lenses into a single composed context string. The first
  lens named is primary and overrules on conflict.
- **Canonical is not deployed.** The installed bundle is canonical; a deployed vault holds
  no copy of it. `daedalus reset` restores a path from the bundle.
- **Seed** — how a governed HTML artifact authors a file this system does *not* own, such as
  `CLAUDE.md`. The payload rides inside `<script type="text/kcd-md">` in
  `_Claude/root-context.html`, and `daedalus seed` extracts it into a managed block at the top of
  the target, leaving whatever you wrote below it alone.

  **That script never executes.** A script with an unrecognized `type` is a *data block* by the
  HTML standard — not run, not rendered, not parsed as script, in any browser. It is there because
  a raw-text element is the only standard container that holds markdown byte-for-byte; every other
  element would escape the `<`, `&` and `>` inside it. The context compiler also strips seeds
  outright, so a payload never reaches a model as context. Full rules: protocol §10.

---

## Integrity

Two guarantees this system makes about itself, and the exact edges of each. Both are stated
because the failure they guard against is *silence* — a check that reports success because it
found nothing to look at, and a repair that reports success because it could not see the damage.

### A check names its denominator

`daedalus validate` reports `checked` beside the issue count, on the clean path as well as the
dirty one. A vault where nothing parsed prints `NOTHING WAS VALIDATED` rather than a clean bill:
`0 issues` is true of a healthy vault and of an empty one, and the two must not read alike.

The sweep enumerates files from a **raw filesystem walk**, not from the parsed artifact index. A
document that fails to parse is dropped by the index — and failing to parse *is* the defect, so a
checker built on the index cannot see the file it most needs to report.

### A heal covers text, not just the graph

`kcd_move` and `kcd_delete` find referrers two ways, because neither alone sees the whole corpus:

| Pass | Reaches | Cannot reach |
|---|---|---|
| **graph** — links read from parsed artifacts, matched on resolved identity | an href authored in any form | a file that fails to parse, is not an artifact (`.md`, `.js`), or is outside the indexed library |
| **text** — raw bytes in a reference position (`href=`, `data-kcd-address=`, markdown `](…)`) | markdown todos, `.js` utilities, addresses, the project-root `CLAUDE.md`, unparseable documents | an href in a non-canonical form |

A heal plan therefore returns **`edits`** — what changed — and **`reported`** — what was found and
deliberately left, each entry naming why. An empty `edits` beside an empty `reported` means nothing
pointed at the target; it can no longer also mean nothing could be seen.

**What is left alone, and why:**

- **Quoted speech.** A reference inside `<code>`/`<pre>` content or a markdown fence is reported,
  never rewritten. The corpus uses those to teach agents what to *say*; a blind sweep would edit
  the lesson. (An address is an attribute *of* a `<code>` element, not content inside one, so it
  heals normally.)
- **Historical records.** The sweep covers `logs/*/todo/` — live routing surfaces — and not
  `logs/session.md` or `logs/*/completed/`. Rewriting a path inside a dated entry makes the corpus
  more consistent and the entry less true.
- **The project tree at large.** Outside the vault, only files named in `HOST_ENTRY_FILES` are
  reached (`CLAUDE.md` today). A mover that can rewrite arbitrary project files is a blast radius
  nobody asked for.
- **On a delete, anything not excisable.** Excision is parse-and-splice, so it reaches parsed HTML
  and `.js` only. A reference in a markdown todo cannot be cut out of a sentence span-precisely, so
  it is reported as `not-excisable` — it *will* dangle, and the plan says so.

**Known limit:** the swap is whole-file, so the quoted-speech rule holds per file rather than per
occurrence. A referrer carrying both a live link and a quoted sample of the same href has the
sample rewritten alongside it.
