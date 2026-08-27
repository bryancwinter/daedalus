import { statSync } from 'fs';
import { basename } from 'path';
import { McpServer, runVerify } from './mcp';
import type { ServerManifest, ToolDefinition, ToolResult, Registration, TestSpec, VerifyReport } from './mcp';
import { GuardChain, PathGuard } from './guards';
import { discoveryTools } from './tools/discovery';
import { readTools } from './tools/read';
import { writeTools } from './tools/write';
import { batchTools } from './tools/batch';

/**
 * DaedalusServer — the Daedalus MCP server. ONE class, no base.
 *
 * A thin I/O gate exposing the KCD artifact tools over stdio. Judgment lives in the
 * model above and kcd_sdk beneath; these handlers only gate I/O.
 *
 * WHY THERE IS NO BASE CLASS ( 2026-07-22, Daedalus extraction ). This used to be
 * `KcdServer extends StarmindServer`, sharing a base with `starmind_file` and
 * `starmind_semantic_browser`. Daedalus is now its own project — a narrowly scoped
 * context compiler — and it will only ever possess THIS ONE server, so an abstract
 * base exists to serve a plurality it does not have. The base's useful parts
 * ( build / registerTool / ensureBuilt / run / invoke / wireTools / verify )
 * are folded in here directly. The wire itself stays its own module, `./mcp`, because
 * that genuinely is a separate concern.
 *
 * Consequence to know about: Starmind's `promote:mcp` identifies a server as "any
 * StarmindServer subclass exported from src/server.ts", so it can no longer discover
 * this one. That is intended — Daedalus is not a Starmind plugin — and the capability
 * it took with it ( snapshot regeneration, verification ) is replaced by this package's
 * own `scripts/snapshot.ts` and `scripts/verify.ts`, so neither is lost.
 */
/** How often the serve loop checks that its host is still alive. Thirty seconds is far below the hours
 *  an orphan was surviving and far above anything a stat-free pid probe could cost. */
const ORPHAN_CHECK_MS = 30_000;

export class DaedalusServer {

	/**
	 * Declared statically so tooling can inventory the server without constructing one.
	 * The lifecycle fields ( installed / exposed / entryPoint ) are Starmind interop and
	 * are deliberately kept — see `./mcp/manifest.ts`'s header.
	 *
	 * THE ID IS COUPLED — change it in ONE pass or not at all. `id` is simultaneously the MCP server
	 * identity ( here + the plugin manifest ), a key in Starmind's package registry
	 * ( `MasterRegistry.daedalus` ), the partition name of the on-disk config slice
	 * ( `pkg.daedalus.json` ), and the target of the tool-monitor widget and a subscription test.
	 * A half-migrated id is where this project keeps drawing blood. Note the host's own `.mcp.json`
	 * key is a SEPARATE surface that no cluster-wide rename reaches — under Claude Code that key,
	 * not this id, is what the `mcp__<key>__*` tool prefix is built from.
	 */
	static manifest: ServerManifest = {
		id:          'daedalus',
		name:        'Daedalus',
		version:     '0.1.0',
		entryPoint:  'dist/index.js',
		transport:   'stdio',
		credentials: [],
		installed:   false,
		exposed:     false,
		doc:
			'The KCD library gate — read/write access to the artifact vault (lenses, plans, habits, ' +
			'contracts, references, generators, analyzers, utilities, templates). A thin I/O surface ' +
			'over kcd_sdk: one query (kcd_query), reads (get/links/health), writes (save/move/delete), and a ' +
			'batch (kcd_batch) that runs an ordered sequence of calls in one shot. Move and delete HEAL the ' +
			'link graph — a rename rewrites every inbound reference, a delete cascades through every referrer. ' +
			'Every path is jailed to the vault by the PathGuard before any disk touch; reads are free, writes ' +
			'carry a destructive hint. Judgment lives in the model above and ' +
			'kcd_sdk beneath — these tools only gate I/O.',
		// The package's own config screen — `fields` is the flat typed-tunable path the generic renderer
		// draws under this package's seam. The value is the stylesheet's absolute path WITHOUT a scheme;
		// `file:///` is added on resolve, so pasting a Windows path works as-is.
		//
		// A BLANK default is deliberate: Config.str() treats blank as "no value", so an untouched field
		// falls through to the DERIVED default rather than pinning an empty path.
		config: {
			fields: [ {
				key:         'cssPath',
				label:       'Stylesheet path',
				type:        'path',
				default:     '',
				placeholder: 'absolute path to kcd.css',
			} ],
		},
	};

	private server:        McpServer;
	private registrations: Registration[] = [];
	private built          = false;
	private chain          = new GuardChain( new PathGuard() );

	constructor() {
		const m = DaedalusServer.manifest;
		this.server = new McpServer( { name: m.name, version: `${ m.version }+${ DaedalusServer.buildIdentity() }` } );
	}

	/**
	 * WHAT THIS PROCESS IS ACTUALLY RUNNING — the entry file it was launched with, stamped with that
	 * file's mtime and byte size.
	 *
	 * A DETECTOR, not a version. `manifest.version` is authored and changes when someone remembers to
	 * change it; this changes every time the bundle is rebuilt, which is the event that actually matters.
	 * The failure it exists to make visible: a client caches the tool schema at handshake time and keeps
	 * it across a rebuild, so a field added to an inputSchema is STRIPPED from the request before it
	 * leaves the client — the handler never sees it, and the call returns success having done something
	 * other than what was asked. Nothing on the wire disagreed, because the client never asked again.
	 * With the stamp riding in serverInfo.version, a client and a server on different builds is a visible
	 * difference rather than a silent one, and the check costs one stat call. It rode a live doc-block too
	 * until that seam was removed: a server doc is per-SERVER, and one copy now answers for several
	 * sessions, so nothing per-session can live there. The handshake is the honest channel and the only one.
	 *
	 * Reads `process.argv[1]` — the script the runtime was actually handed — rather than the manifest's
	 * declared `entryPoint`, because the declared one is what SHOULD be running and this question is
	 * about what IS. It degrades honestly: under `tsx src/index.ts` there is no dist and the stamp names
	 * the source entry, which is the true answer for a dev run.
	 */
	static buildIdentity(): string {
		const entry = process.argv[ 1 ];
		if( !entry ) return 'unknown';
		try {
			const stat = statSync( entry );
			return `${ basename( entry ) }@${ new Date( stat.mtimeMs ).toISOString() }/${ stat.size }`;
		} catch {
			// A stat that fails is a real answer too — the entry moved or is virtual. Never throw from
			// something the handshake calls: an unreadable stamp must not cost the whole connection.
			return 'unstamped';
		}
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────────

	/** Build the tool surface, then serve it on stdio until the client disconnects. */
	async run(): Promise<void> {
		this.ensureBuilt();
		const watchdog = DaedalusServer.watchParent();
		try {
			await this.server.connect();
		} finally {
			clearInterval( watchdog );
		}
	}

	/**
	 * EXIT WHEN THE HOST DOES — the orphan reaper, pointed at ourselves.
	 *
	 * `connect()` already resolves on stdin EOF, which is the clean disconnect. It is not enough: a host
	 * that dies WITHOUT closing the pipe leaves the read end open with nothing on the other side, and the
	 * child sits there indefinitely. That is how five of these were found alive at once on 2026-08-04, the
	 * oldest three hours old — each one holding a stale tool surface, any of which a confused client could
	 * still be talking to.
	 *
	 * SELF-EXIT, never a sweep of siblings. The obvious shape — a new child kills the old ones at spawn —
	 * is wrong here: Starmind and Claude Code legitimately run their own daedalus children AT THE SAME
	 * TIME, against different vaults, so "same entry point" identifies a peer rather than a corpse and one
	 * host's spawn would kill the other host's live server. A process that only ever ends itself needs no
	 * authority over anything and cannot make that mistake.
	 *
	 * `kill( pid, 0 )` sends no signal — it is the portable "is this pid alive?" probe, and it throws when
	 * the parent is gone. Pid reuse could in principle make a dead parent look alive; the failure direction
	 * is an orphan living a while longer, which is exactly what happens today. The reverse ( exiting early
	 * on a live host ) self-heals anyway: the host demotes a dead child to dormant and respawns it on the
	 * next call.
	 *
	 * The timer is `unref`'d so it never by itself keeps this process alive, and cleared when the serve
	 * loop ends so nothing outlives the run.
	 */
	private static watchParent(): NodeJS.Timeout {
		const parent = process.ppid;
		const timer  = setInterval( () => {
			try {
				process.kill( parent, 0 );
			} catch {
				process.stderr.write( `[daedalus] host process ${ parent } is gone — exiting rather than orphaning\n` );
				process.exit( 0 );
			}
		}, ORPHAN_CHECK_MS );
		timer.unref();
		return timer;
	}

	/** Prove every tool against its TestSpecs, in-process. Reached by `scripts/verify.ts`. */
	async verify(): Promise<VerifyReport> {
		this.ensureBuilt();
		return runVerify( this.registrations, DaedalusServer.manifest );
	}

	/**
	 * The built wire tool surface — the exact `tools/list` array, without spawning the server.
	 * Builds first ( idempotent ), then reads it off the underlying McpServer. This is what
	 * regenerates the committed tool snapshot, and what a `mcp tools` command prints.
	 */
	wireTools(): Record<string, unknown>[] {
		this.ensureBuilt();
		return this.server.listTools();
	}

	/**
	 * Run a registered tool in-process by name — the seam a COMPOSING tool ( the batch ) dispatches
	 * through to run other tools in sequence. Builds first ( idempotent ), then delegates to the
	 * McpServer's own dispatch, so an internal call obeys the exact same contract as a wire call.
	 */
	invoke( name: string, args: Record<string, unknown> ): Promise<ToolResult> {
		this.ensureBuilt();
		return this.server.invoke( name, args );
	}

	// ── Tool surface ──────────────────────────────────────────────────────────────

	/** Register every tool through one shared guard chain. Runs once, via ensureBuilt(). */
	private build(): void {
		const tools = [
			...discoveryTools( this.chain ),
			...readTools( this.chain ),
			...writeTools( this.chain ),
			// batch dispatches the others through the in-process invoke seam ( no guard chain of
			// its own — each dispatched call runs its own handler + PathGuard ).
			...batchTools( ( name, args ) => this.invoke( name, args ) ),
		];
		for ( const tool of tools ) this.registerTool( tool );
	}

	/**
	 * Register a tool and ( optionally ) the TestSpecs that verify it, in one call. The wire fields
	 * pass through to the McpServer; the spec is stashed for verify().
	 *
	 * House convention: the first verify input doubles as the tool's inspector sample — the example
	 * you prove a tool with is the example a user sees prepopulated. An explicit `example` on the def
	 * wins; otherwise borrow the first spec's input.
	 */
	private registerTool( def: ToolDefinition & { spec?: TestSpec[] } ): void {
		const { spec, ...tool } = def;
		const example = tool.example ?? spec?.[ 0 ]?.input;
		this.server.registerTool( example ? { ...tool, example } : tool );
		this.registrations.push( { def: tool, spec: spec ?? [] } );
	}

	private ensureBuilt(): void {
		if ( this.built ) return;
		this.build();
		this.built = true;
	}
}
