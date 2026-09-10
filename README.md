# Daedalus

A context compiler for KCD — the Know / Care / Do framework. One engine, two faces: an MCP
server and a CLI.

Point it at a repository and it gives your coding agent a **vault**: a small library of
structured documents describing what the project is, how its author wants it worked on, and
what an agent should refuse to do. The agent loads that instead of rediscovering your
codebase every session.

> **Alpha.** The install works and has been run, but never by someone new to KCD, and only
> on Windows. [STATUS.md](STATUS.md) is the honest map of what is and isn't built.

## Requirements

Node 18+ and git.

## Install

> **Hard requirement: Daedalus and `kcd_sdk` must be cloned side by side, under those exact
> names.** Daedalus builds from the SDK's *source*, and three files (`package.json`,
> `build.js`, `tsconfig.json`) each resolve `../kcd_sdk` literally. Nested, renamed, or
> anywhere else, and it will not build.

```
your-workspace/
├── kcd_sdk/
└── daedalus/
```

**1. Clone both, as siblings.**

```bash
git clone https://github.com/bryancwinter/kcd_sdk.git
```

```bash
git clone https://github.com/bryancwinter/daedalus.git
```

**2. Install the SDK's dependencies first.** The order matters — the bundler reads the SDK
in place, so it needs the SDK's own `node_modules`. Skip this and the next step fails.

```bash
cd kcd_sdk && npm install
```

**3. Install Daedalus.** There is no separate build step; `npm install` builds it.

```bash
cd ../daedalus && npm install
```

**4. Put it on your PATH.**

```bash
npm install -g .
```

**5. Check it.**

```bash
daedalus doctor
```

If `daedalus` isn't found, npm's global bin directory isn't on your PATH — `npm bin -g`
names it.

## Use it in a project

From the root of the project you want an agent to understand:

```bash
daedalus init
```

A short interactive stepper — it shows you the folder tree first and asks before writing
anything. Then apply it:

```bash
daedalus init confirm
```

**Restart your agent session.** `.mcp.json` and `.claude/skills/` are read at session start,
so a correct install gives you no KCD tools until you do. Then:

```bash
daedalus get-started
```

To take it back out: `daedalus clear` (removes only what `init` added), or `daedalus clear
all` (also removes the vault). Both preview first.

## What it puts in your repo

```
_Claude/          the vault — lenses, habits, contracts, references
CLAUDE.md         host entry point (your existing content is preserved)
AGENTS.md         same, for Codex
GEMINI.md         same, for Gemini
.mcp.json         registers the daedalus MCP server (merged, never clobbered)
.claude/skills/   the bundled skills
```

Nothing else is touched and no files are moved.

## Commands

Run `daedalus --help` for the full list. Every write command previews by default and needs
an explicit `confirm`.

## Two floors: sessions and lanes

Every compile inherits a **floor** — a lens nothing invokes, no lens can switch off, and every
agent gets. There are two, and exactly one rides on any given compile:

| command | floor | for |
|---|---|---|
| `daedalus compile <lens...>` | `lenses/_lens-base.html` | a session, with a person in it |
| `daedalus compile <lens...> --lane` | `lenses/_lane-base.html` | an agent running unattended |

They contradict each other on purpose. The session floor tells its reader to state a path and wait
for clearance before writing — sound advice beside a person, and an empty instruction to an agent
running overnight with nobody to ask. **A rule whose escalation route does not exist is one an
agent learns to discount whole**, including the parts that did apply. So the lane gets its own
document, authored as prohibitions rather than as a collaboration protocol.

`_lens-base` is bundled and `daedalus init` writes it. **`_lane-base` is not bundled** — a project
that never runs unattended agents needs none. Ask for `--lane` where the vault has no lane floor
and the compile **fails**:

```
daedalus: no lane floor found ( looked for lenses/_lane-base.html ). A lane compile will not
fall back to the session floor: that floor tells its reader to ask a person for clearance, and
a lane has no person to ask.
```

That refusal is the design. Both available fallbacks — the session floor, or no floor at all —
compile cleanly, report sensible token counts, and look like a working run, which is exactly what
makes them worse than a stop.

**`--lane` is the caller's flag and never the agent's.** It is on this CLI, which a harness drives,
and deliberately *not* on the `kcd_compile` MCP tool, which agents drive: an agent that can name
its own floor can name the lenient one. The two faces are otherwise held identical, so that
omission reads as drift — there is a comment in `src/tools/read.ts` saying it is not. Do not add it
to that tool's `inputSchema` to make them agree.

## License

MIT. See [LICENSE](LICENSE).
