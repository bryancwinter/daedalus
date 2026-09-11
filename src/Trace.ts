import * as path from 'path';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'fs';
import { Config } from './Config';

/**
 * Trace — one line per tool call, so a failure an agent hit is still readable tomorrow.
 *
 * WHY THIS EXISTS. An agent that calls `kcd_get` with a path that is not there gets a refusal, reads
 * it, and self-corrects — and the whole exchange vanishes with the session. What vanishes with it is
 * the only evidence of the two things worth fixing: a tool DESCRIPTION that did not say enough ( the
 * agent guessed, and the guess was reasonable ), and a REFUSAL that did not point anywhere useful
 * ( Daedalus answered correctly and unhelpfully ). Both are prose problems, and prose problems are
 * invisible without a sample. This is the sample.
 *
 * WHY SUCCESSES ARE LOGGED TOO. "Reduce the error rate" needs a denominator. A failures-only file
 * gives counts, and a count cannot tell a tool that is called constantly and fails rarely from one
 * that is called twice and fails once. A success line is terse by design — timestamp, tool, ok —
 * around 60 bytes, and it costs the args and the message a failure line carries.
 *
 * NOT A GENERAL LOG. It records what an AGENT did to the tool surface. `verify` and the CLI's
 * `mcp call` both drive the same handlers and both disable tracing first ( see `disable` ), because
 * a synthetic failure written by our own test pass is indistinguishable on disk from a real one and
 * would inflate every rate computed from the file.
 *
 * CONTAINMENT. Nothing here may cost a tool call. Every disk touch is wrapped; the first failure
 * warns once on stderr and disables the trace for the life of the process, so a read-only vault
 * degrades to "no trace" rather than to "no reads".
 */

/**
 * The coarse bucket a failure falls into — a convenience for counting, NOT the record.
 *
 * Only `unknown-tool` and `bad-args` are known for certain: the wire raises them itself and tags them
 * on the way past ( `CallRefusal` ), so neither is ever guessed at here. The rest are inferred by
 * matching against the refusal strings this codebase currently emits, so a reworded refusal quietly
 * re-buckets to `failed`. That is tolerable precisely because `error` carries the verbatim message:
 * any bucket can be recomputed from the file after the fact, and none of them can be recovered from
 * a bucket alone.
 */
export type Fault =
	| 'unknown-tool'   // a tool name this server does not register
	| 'bad-args'       // an argument key the tool's schema does not declare
	| 'out-of-vault'   // PathGuard: absolute or ../-escaped path
	| 'type-mismatch'  // PathGuard: artifact type the target directory does not accept
	| 'not-found'      // the path parsed fine and nothing is there
	| 'failed';        // everything else — read `error`

export interface TraceEntry {
	/** ISO timestamp. */
	at:    string;
	tool:  string;
	ok:    boolean;
	/** Failures only. */
	fault?: Fault;
	/** Failures only — what the agent actually sent, long string values clipped. */
	args?:  Record<string, unknown>;
	/** Failures only — the refusal verbatim, as the agent received it. */
	error?: string;
	/** Failures only — the entry-file stamp, so a prose fix can be dated against the failures it was
	 *  meant to remove. A rate that improves on the same build did not improve because of an edit. */
	build?: string;
}

/** Where the trace lives, vault-relative. logs/ is the data layer's home for exactly this. */
const TRACE_DIR  = 'logs/daedalus';
const TRACE_FILE = 'trace.jsonl';

/** Rotate at 2 MB, keeping ONE previous generation. A bounded two-file history needs no cron and no
 *  cleanup command; at ~60 bytes a success line that is several hundred thousand calls of runway. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Per-value clip. A failed `kcd_save` carries a whole document body in `artifact`; the failure is
 *  never IN the body, and one such line would outweigh a month of everything else. */
const MAX_VALUE = 300;

/** The env var that turns the trace off entirely. An install CONSTANT, not a project variable — it
 *  describes what this machine records, not what this vault is — so it is deliberately NOT a Config
 *  tier and not a package config field. */
const TRACE_ENV = 'DAEDALUS_TRACE';

export class Trace {

	private static off      = false;
	private static warned   = false;
	private static buildTag = '';

	/**
	 * Turn the trace off for the rest of this process. Called by `verify` and by the CLI's
	 * `mcp call` — both drive real handlers, and neither is an agent.
	 */
	static disable(): void {
		this.off = true;
	}

	/** The entry-file stamp to record against failures. Set once by the server at construction. */
	static stamp( build: string ): void {
		this.buildTag = build;
	}

	/** Record one call. Never throws, never blocks meaningfully — one appendFileSync per call. */
	static record( tool: string, ok: boolean, detail?: { args?: Record<string, unknown>; error?: string; fault?: Fault } ): void {
		if ( this.off || !this.enabled() ) return;

		const entry: TraceEntry = { at: new Date().toISOString(), tool, ok };
		if ( !ok ) {
			entry.fault = detail?.fault ?? Trace.classify( detail?.error ?? '' );
			entry.args  = Trace.clip( detail?.args ?? {} );
			entry.error = Trace.clipText( detail?.error ?? '' );
			if ( this.buildTag ) entry.build = this.buildTag;
		}

		this.append( JSON.stringify( entry ) + '\n' );
	}

	/**
	 * The entries on disk, oldest first. Reads the CURRENT generation only — a rotated one is
	 * history that fell off the end, and `rotated()` says whether there is one, so a reader is told
	 * rather than silently given a short answer.
	 */
	static entries(): TraceEntry[] {
		const file = Trace.file();
		if ( !existsSync( file ) ) return [];

		const out: TraceEntry[] = [];
		for ( const line of readFileSync( file, 'utf8' ).split( '\n' ) ) {
			const trimmed = line.trim();
			if ( !trimmed ) continue;
			try {
				out.push( JSON.parse( trimmed ) as TraceEntry );
			} catch {
				// A torn last line ( the process died mid-append ) is one lost call, not a broken file.
			}
		}
		return out;
	}

	/** Absolute path of the trace file — what `doctor` and the CLI print so nobody has to guess. */
	static file(): string {
		const { projectRoot, docRoot } = Config.resolve();
		return path.resolve( projectRoot, docRoot, TRACE_DIR, TRACE_FILE );
	}

	/** The rotated generation's path, or null when nothing has rotated yet. */
	static rotated(): string | null {
		const prev = Trace.file().replace( /\.jsonl$/, '.1.jsonl' );
		return existsSync( prev ) ? prev : null;
	}

	/** Delete both generations. The one destructive operation, reached only by an explicit command. */
	static clear(): void {
		for ( const f of [ Trace.file(), Trace.file().replace( /\.jsonl$/, '.1.jsonl' ) ] ) {
			if ( existsSync( f ) ) rmSync( f );
		}
	}

	// ── Internals ─────────────────────────────────────────────────────────────

	/** Off when the env var says so. Read per call rather than cached: a shell can turn it off
	 *  mid-session against a long-lived server child, and a cached answer would ignore that. */
	private static enabled(): boolean {
		const raw = ( process.env[ TRACE_ENV ] ?? '' ).trim().toLowerCase();
		return !( raw === 'off' || raw === '0' || raw === 'false' || raw === 'no' );
	}

	private static append( line: string ): void {
		try {
			const file = Trace.file();
			mkdirSync( path.dirname( file ), { recursive: true } );
			Trace.rotate( file );
			appendFileSync( file, line, 'utf8' );
		} catch ( e ) {
			// A trace that cannot write must not take a read down with it. Say so ONCE on stderr
			// ( stdout is the JSON-RPC stream and a line there corrupts the protocol ), then go quiet.
			if ( !this.warned ) {
				this.warned = true;
				process.stderr.write( `[daedalus] WARNING: trace disabled — ${ e instanceof Error ? e.message : String( e ) }\n` );
			}
			this.off = true;
		}
	}

	/** Move the current file aside once it passes the cap, DISCARDING the older generation. */
	private static rotate( file: string ): void {
		if ( !existsSync( file ) ) return;
		if ( statSync( file ).size < MAX_BYTES ) return;

		const prev = file.replace( /\.jsonl$/, '.1.jsonl' );
		if ( existsSync( prev ) ) rmSync( prev );
		renameSync( file, prev );
	}

	/** Long string values → a length marker. Shape is preserved, so the line stays a queryable object
	 *  rather than a blob: `{"path":"x","artifact":"<12043 chars>"}`. */
	private static clip( args: Record<string, unknown> ): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for ( const [ key, value ] of Object.entries( args ) ) {
			if ( typeof value === 'string' ) { out[ key ] = Trace.clipText( value ); continue; }
			if ( value === null || typeof value !== 'object' ) { out[ key ] = value; continue; }

			// An object or array value ( kcd_save's artifact, kcd_batch's calls ) is measured rather
			// than walked. The interesting argument on a failed read is always a scalar.
			const json = JSON.stringify( value ) ?? '';
			out[ key ] = json.length > MAX_VALUE ? `<${ json.length } chars>` : JSON.parse( json );
		}
		return out;
	}

	private static clipText( text: string ): string {
		return text.length > MAX_VALUE ? `${ text.slice( 0, MAX_VALUE ) }… <${ text.length } chars>` : text;
	}

	/**
	 * Message → bucket, for the HANDLER failures only; see `Fault` for why a miss here is cheap.
	 * Ordered most-specific first.
	 *
	 * No rule for `unknown-tool` or `bad-args`, deliberately — both arrive tagged, and a rule that can
	 * never fire is a rule nobody will notice has stopped being true. Two `not-found` rules because
	 * only kcd_get rewrites its own ENOENT into something an agent can act on; the rest still surface
	 * the raw one.
	 */
	private static classify( message: string ): Fault {
		if ( message.includes( 'is outside the vault' ) ) return 'out-of-vault';
		if ( message.startsWith( 'Type mismatch at' ) )   return 'type-mismatch';
		if ( message.startsWith( 'No artifact at' ) )     return 'not-found';
		if ( message.includes( 'ENOENT' ) )               return 'not-found';
		return 'failed';
	}
}
