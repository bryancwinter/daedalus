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

## License

MIT. See [LICENSE](LICENSE).
