import * as path from 'path';
import { readFileSync } from 'fs';
import { inferProjectRoot } from 'kcd_sdk';

/**
 * Config — where the vault lives, resolved from the most specific source available.
 *
 * FOUR TIERS, most specific wins, resolved per field:
 *
 *   1. argument     — override(), set once at startup from a parsed flag ( spawn arg or CLI ).
 *   2. host slice   — a host handing this child a package-store file to read ( Starmind ).
 *   3. environment  — DAEDALUS_PROJECT_ROOT / DAEDALUS_DOC_ROOT, ambient in the shell.
 *   4. inferred     — walk up from the working directory for an ancestor holding the doc root.
 *
 * No tier names a host as a requirement. Starmind is ONE optional source among four: when it spawns
 * this child it sets STARMIND_PACKAGE_STORE to the absolute path of the child's own slice file,
 * which is read FRESH on every resolve — so a root a host rewrites is picked up on the next tool
 * call with no respawn. Run from a plain shell with none of it set, tier 4 finds the vault the way
 * a person would.
 *
 * WHY THE HOST SLICE SITS ABOVE AMBIENT ENVIRONMENT. The slice is per-child and per-package, written
 * by the host that spawned this process; DAEDALUS_* is machine-wide and ambient, and a child inherits
 * its parent's environment. Ranking the ambient pair higher would let one forgotten shell variable
 * silently redirect every host-spawned session on that machine. Note this is currently a near-moot
 * ordering: as of 2026-07-23 nothing writes projectRoot / docRoot INTO the slice, so the tier is an
 * open channel rather than a live one.
 *
 * THE SLICE TIER IS THE ONE EXPECTED TO DIE. A host that wants to place this child can simply spawn
 * it with --root, which is tier 1 and needs no shared file format at all. That is the cheaper
 * contract ( the host drives; the server stays ignorant of the host ), and when Starmind becomes a
 * consumer of an installed Daedalus rather than the host of a promoted plugin, tier 2 can be deleted
 * without touching tiers 1, 3, or 4.
 *
 * WHY STARMIND_PACKAGE_STORE IS NOT RENAMED ( 2026-07-23 ). It is the HOST's variable, not this
 * server's: MCPService._packageEnv() sets it for every package-backed child Starmind spawns, and the
 * name describes the host's own mechanism. This is the same reasoning that keeps `manifest.id` as
 * `starmind_kcd` for now — the `starmind_` prefix there is the host's namespace, not Daedalus
 * branding. Reading it is interop. Renaming it here would only break it.
 *
 * The resolved value carries WHERE EACH FIELD CAME FROM. `doctor` ( plan 1.g ) and `mcp status`
 * ( 1.f ) print it, which turns "it is looking at the wrong vault" from a guess into a line of output.
 */

/** The env var a host uses to hand this child the path to its own package-store slice. */
const HOST_SLICE_ENV = 'STARMIND_PACKAGE_STORE';

const PROJECT_ROOT_ENV = 'DAEDALUS_PROJECT_ROOT';
const DOC_ROOT_ENV     = 'DAEDALUS_DOC_ROOT';

const DEFAULT_DOC_ROOT = '_Claude';

/** Which tier supplied a field. `fallback` means no tier did, and the built-in default was used. */
export type ConfigSource = 'argument' | 'host-slice' | 'environment' | 'inferred' | 'fallback';

export interface DaedalusConfig {
	projectRoot: string;
	docRoot:     string;
}

export interface ResolvedConfig extends DaedalusConfig {
	/** Per-field provenance — two fields can legitimately come from two different tiers. */
	source: { projectRoot: ConfigSource; docRoot: ConfigSource };
}

/** One tier's answer for one field. */
interface Choice {
	value:  string;
	source: ConfigSource;
}

export class Config {

	private static argument: Partial<DaedalusConfig> = {};

	/**
	 * The argument tier. Called once at startup by whoever parsed the arguments — index.ts from
	 * argv today, the CLI shell ( plan 1.c ) later. Blank and undefined values are ignored rather
	 * than stored, so a flag that was never passed cannot shadow the tiers beneath it.
	 */
	static override( values: Partial<DaedalusConfig> ): void {
		const root = Config.str( values.projectRoot );
		const doc  = Config.str( values.docRoot );
		if ( root ) Config.argument.projectRoot = root;
		if ( doc )  Config.argument.docRoot     = doc;
	}

	/**
	 * Resolve both fields through the tiers. Read fresh on every call: the host slice is a live
	 * file, and freshness is the contract every consumer here already relies on.
	 */
	static resolve(): ResolvedConfig {
		const slice = Config.slice();

		const docRoot = Config.pick( [
			[ 'argument',    Config.argument.docRoot ],
			[ 'host-slice',  slice[ 'docRoot' ] ],
			[ 'environment', process.env[ DOC_ROOT_ENV ] ],
		] ) ?? { value: DEFAULT_DOC_ROOT, source: 'fallback' as const };

		const projectRoot = Config.pick( [
			[ 'argument',    Config.argument.projectRoot ],
			[ 'host-slice',  slice[ 'projectRoot' ] ],
			[ 'environment', process.env[ PROJECT_ROOT_ENV ] ],
		] ) ?? Config.infer( docRoot.value );

		return {
			projectRoot: path.resolve( projectRoot.value ),
			docRoot:     docRoot.value,
			source:      { projectRoot: projectRoot.source, docRoot: docRoot.source },
		};
	}

	/** The first tier holding a usable value, carrying its name; null when every tier is empty. */
	private static pick( tiers: [ ConfigSource, unknown ][] ): Choice | null {
		for ( const [ source, value ] of tiers ) {
			const clean = Config.str( value );
			if ( clean ) return { value: clean, source };
		}
		return null;
	}

	/**
	 * The inferred tier — walk up from the working directory for an ancestor holding the doc root.
	 * inferProjectRoot starts at its argument's PARENT, so the doc root itself is handed in as the
	 * start path: its parent is the working directory, which makes the walk cwd-inclusive.
	 *
	 * No ancestor holds one → the working directory, so the server still starts and `doctor` can
	 * report a vault it could not find, rather than the process dying before it can say so.
	 */
	private static infer( docRoot: string ): Choice {
		const cwd = process.cwd();
		try {
			return { value: inferProjectRoot( path.join( cwd, docRoot ), docRoot ), source: 'inferred' };
		} catch {
			return { value: cwd, source: 'fallback' };
		}
	}

	/**
	 * The host slice — a JSON file whose absolute path the host puts in HOST_SLICE_ENV at spawn.
	 * Any failure ( no var, no file, bad JSON ) degrades to empty, because no host at all is the
	 * ordinary standalone case rather than an error.
	 */
	private static slice(): Record<string, unknown> {
		const file = process.env[ HOST_SLICE_ENV ];
		if ( !file ) return {};
		try {
			return JSON.parse( readFileSync( file, 'utf8' ) ) as Record<string, unknown>;
		} catch {
			return {};
		}
	}

	/** A non-empty string, or null — so a blank or garbled value falls through to the next tier. */
	private static str( value: unknown ): string | null {
		return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
	}
}
