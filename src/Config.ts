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
 *   3. environment  — DAEDALUS_PROJECT_ROOT / DAEDALUS_DOC_ROOT / DAEDALUS_CSS_PATH, ambient in the shell.
 *   4. inferred     — walk up from the working directory for an ancestor holding the doc root.
 *                     ( `cssPath` has no inferred tier — its fallback is DERIVED from the other two. )
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
 * WHY STARMIND_PACKAGE_STORE IS NOT RENAMED. It is the HOST's variable, not this server's:
 * MCPService._packageEnv() sets it for every package-backed child Starmind spawns, and the name
 * describes the host's own mechanism, not this server's identity. Reading it is interop; renaming it
 * here would only break the handoff. ( Unrelated to the server's own `manifest.id` — the env var is
 * the HOST's, the id is OURS. )
 *
 * The resolved value carries WHERE EACH FIELD CAME FROM. `doctor` ( plan 1.g ) and `mcp status`
 * ( 1.f ) print it, which turns "it is looking at the wrong vault" from a guess into a line of output.
 */

/** The env var a host uses to hand this child the path to its own package-store slice. */
const HOST_SLICE_ENV = 'STARMIND_PACKAGE_STORE';

const PROJECT_ROOT_ENV = 'DAEDALUS_PROJECT_ROOT';
const DOC_ROOT_ENV     = 'DAEDALUS_DOC_ROOT';
const CSS_PATH_ENV     = 'DAEDALUS_CSS_PATH';

const DEFAULT_DOC_ROOT = '_Claude';
const DEFAULT_CSS_FILE = 'kcd.css';

/** Which tier supplied a field. `fallback` means no tier did, and the built-in default was used. */
export type ConfigSource = 'argument' | 'host-slice' | 'environment' | 'inferred' | 'fallback';

export interface DaedalusConfig {
	projectRoot: string;
	docRoot:     string;
	/** The stylesheet's absolute path, WITHOUT a scheme — what a person configures and pastes. */
	cssPath:     string;
}

export interface ResolvedConfig extends DaedalusConfig {
	/** `cssPath` with the `file:///` scheme applied. NO LONGER WRITTEN INTO A DOCUMENT as of protocol
	 *  §8.1's 2026-08-17 amendment — it survives for `doctor` / `mcp status` provenance output and for
	 *  anything that wants to open the stylesheet directly. The emitted link is `cssVaultRel`-derived. */
	cssHref: string;
	/** Where the stylesheet sits relative to the VAULT ROOT ( `kcd.css`, or `kcd/kcd.css` in a
	 *  pre-2026-07-26 vault ). The input to `KcdEmit.cssHrefFor`, which prefixes the `../` run. */
	cssVaultRel: string;
	/** Per-field provenance — fields can legitimately come from different tiers. */
	source: { projectRoot: ConfigSource; docRoot: ConfigSource; cssPath: ConfigSource };
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
		const css  = Config.str( values.cssPath );
		if ( root ) Config.argument.projectRoot = root;
		if ( doc )  Config.argument.docRoot     = doc;
		if ( css )  Config.argument.cssPath     = css;
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

		const root = path.resolve( projectRoot.value );

		// The stylesheet, still configured as an ABSOLUTE path because that is what a person can paste.
		// What CHANGED on 2026-08-17 ( protocol §8.1 ): the absolute value is no longer written into a
		// document. It is the location the per-file relative href is measured FROM — see `cssVaultRel`.
		const cssPath = Config.pick( [
			[ 'argument',    Config.argument.cssPath ],
			[ 'host-slice',  slice[ 'cssPath' ] ],
			[ 'environment', process.env[ CSS_PATH_ENV ] ],
		] ) ?? { value: Config.deriveCssPath( root, docRoot.value ), source: 'fallback' as const };

		return {
			projectRoot: root,
			docRoot:     docRoot.value,
			cssPath:     cssPath.value,
			cssHref:     Config.cssUrl( cssPath.value ),
			cssVaultRel: Config.cssRelToVault( root, docRoot.value, cssPath.value ),
			source:      { projectRoot: projectRoot.source, docRoot: docRoot.source, cssPath: cssPath.source },
		};
	}

	/**
	 * Where the stylesheet sits RELATIVE TO THE VAULT ROOT — `kcd.css` for a current vault,
	 * `kcd/kcd.css` for one created before 2026-07-26. This is what `KcdEmit.cssHrefFor` prefixes with
	 * a `../` run, so the emitted link is correct for a vault of either layout without either being
	 * special-cased.
	 *
	 * Derived rather than configured: the absolute `cssPath` and the vault root are both already
	 * resolved, so asking a person to state the same fact twice would only create a way for the two to
	 * disagree. A configured path OUTSIDE the vault cannot be expressed as a relative href at all
	 * ( it would need `../` past the root, which no document should carry ), so it falls back to the
	 * default location rather than emitting an escape sequence into every file.
	 */
	private static cssRelToVault( root: string, docRoot: string, cssPath: string ): string {
		const vault = path.resolve( root, docRoot );
		const rel   = path.relative( vault, path.resolve( cssPath ) ).replace( /\\/g, '/' );
		return ( !rel || rel.startsWith( '..' ) || path.isAbsolute( rel ) ) ? DEFAULT_CSS_FILE : rel;
	}

	/**
	 * A configured stylesheet path → the `file:///` URL a document carries.
	 *
	 * A person configures the part AFTER the scheme — a plain absolute path, because that is what
	 * copying a path actually gives you and `C:\…` is what "absolute" MEANS on this platform. The
	 * scheme is ours to add. Total by construction, so a paste in any shape a person actually produces
	 * lands on the same URL:
	 *
	 *   "C:\Code\ContextManager\_Claude\kcd.css"        ← Explorer's Copy as path, quotes and all
	 *   C:\Code\ContextManager\_Claude\kcd.css
	 *   C:/Code/ContextManager/_Claude/kcd.css
	 *   file:///C:/Code/ContextManager/_Claude/kcd.css  ← already a URL; the scheme comes OFF, not doubled
	 *
	 * Applied at RESOLVE rather than at the config screen's commit, because the same value can arrive
	 * from an env var or a spawn flag — a normalizer living in the app would leave both unhandled.
	 */
	private static cssUrl( configured: string ): string {
		const bare = configured
			.trim()
			.replace( /^["']+|["']+$/g, '' )   // Copy as path wraps the whole thing in quotes
			.replace( /^file:\/+/i, '' )       // already a URL — take the path back off it
			.replace( /\\/g, '/' )             // a browser reads the href as a URL, so `\` is not a separator
			.replace( /^\/+/, '' );            // a leading slash would build file:////… and resolve to nothing
		return `file:///${ bare }`;
	}

	/**
	 * The derived stylesheet path — this vault's own `kcd.css`, bare ( the scheme is added by `cssUrl` ).
	 * Derived rather than hardcoded so an install with nothing configured already emits a working link,
	 * which makes the config field a tuning knob instead of a required setup step.
	 */
	private static deriveCssPath( projectRoot: string, docRoot: string ): string {
		return path.resolve( projectRoot, docRoot, DEFAULT_CSS_FILE ).replace( /\\/g, '/' );
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
