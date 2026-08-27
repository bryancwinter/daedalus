/**
 * Build script — esbuild bundles the server and the CLI into self-contained files under dist/,
 * then PROVES the result: the emit is real, the shipped tool snapshot is current, and what npm
 * would actually pack is what we think it is.
 *
 * ONE HOP, FROM SOURCE. esbuild reads kcd_sdk's TypeScript directly ( the `alias` below ) rather than
 * its compiled `dist/`, and that is load-bearing rather than tidy. kcd_sdk's `dist/` is gitignored, so
 * bundling through it meant the shipped artifact's provenance ran through a file that existed in no
 * commit anywhere: whoever last ran a build decided what shipped, and nothing recorded what their
 * working tree looked like at the time. Reading source collapses the chain from
 *
 *     kcd_sdk/src → kcd_sdk/dist ( untracked ) → daedalus/dist ( committed )
 *
 * to a single hop, which makes "is this build current?" a question about two directories instead of
 * three, and makes it answerable from committed state alone.
 *
 * esbuild ( not tsc ) for the emit: it strips types without type-checking, sidestepping the historical
 * tsc OOM on deep generic graphs. Type-checking is a separate, earlier step — `npm run build` runs
 * `tsc --noEmit` first, and daedalus's tsconfig `paths` points at the SAME source this alias does, so
 * the checker and the bundler never disagree about what they are reading.
 *
 * Nothing under dist/ is committed. `prepare` rebuilds on install, so a clone is `npm install` and has
 * a working binary — no separate build step to remember, and no committed artifact that can go stale
 * against the source beside it.
 *
 * WHY THE CHECKS LIVE HERE ( 2026-08-24 ). Ruled by Bryan: the work needed to make deployment reliable
 * belongs wired into the build and done iteratively, not run by hand — several applications are moving
 * at once and their shapes keep changing, and nobody can spend the day running commands. A deployment
 * fact that depends on someone remembering is a fact that goes stale silently, which is precisely what
 * had happened to the tool snapshot below.
 */
const esbuild = require( 'esbuild' );
const path    = require( 'path' );

// The one place the SDK source is named. `tsconfig.json` carries the same mapping for the type-checker;
// if you change one, change both — they are two readers of a single fact.
const KCD_SDK = path.resolve( __dirname, '..', 'kcd_sdk', 'src', 'index.ts' );

// Only Node builtins ( fs, path, … ) stay external — `platform: 'node'` marks them so automatically.
// Everything else, kcd_sdk and its js-yaml included, is inlined, so a promoted plugin folder carries
// no node_modules.
const common = {
	bundle:    true,
	platform:  'node',
	target:    'node20',
	sourcemap: true,
	alias:     { kcd_sdk: KCD_SDK },
};

// The Model Context Protocol server face — dist/index.js, what a host spawns.
esbuild.buildSync( { ...common, entryPoints: [ 'src/index.ts' ], outfile: 'dist/index.js' } );

// The CLI face — same engine, its own binary. The shebang banner makes the emitted file directly
// executable as the npm-installed `bin` ( dist/cli/index.js ).
esbuild.buildSync( {
	...common,
	entryPoints: [ 'src/cli/index.ts' ],
	outfile:     'dist/cli/index.js',
	banner:      { js: '#!/usr/bin/env node' },
} );

console.log( 'bundled  → dist/index.js + dist/cli/index.js (self-contained, from kcd_sdk source)' );

// ── VERIFICATION ────────────────────────────────────────────────────────────────────────────────
// Everything below this line checks the build rather than producing it.
//
// EVERY CHECK FAILS LOUD. A check that cannot RUN must never report success: each throws saying what
// it failed to prove, because the failure being defended against is a build that goes green while
// shipping something wrong. That is this project's most-repeated defect shape — the call succeeded
// and the report was empty.

const { execFileSync } = require( 'child_process' );
const fs               = require( 'fs' );

/**
 * Reach npm.
 *
 * WINDOWS: npm is `npm.cmd`, and Node 22 REFUSES to spawn a .cmd through execFile without a shell
 * ( the CVE-2024-27980 hardening ). It throws `EINVAL`, which is not a build failure but reads like
 * one — measured here on 2026-08-24 before this wrapper existed. `shell: true` is the supported way
 * through. Every argument passed below is a bare token with no spaces or shell metacharacters, so
 * routing through a shell introduces nothing that needs quoting.
 */
function npmRun( args, opts = {} ) {
	return execFileSync( 'npm', args, { shell: true, ...opts } );
}

/**
 * THE RECURSION GUARD — and it is not the flag you would expect.
 *
 * `npm pack` runs `prepare`, `prepare` runs this build, and step 3 runs `npm pack`. That recurses.
 * The obvious brake is `--ignore-scripts`, and IT DOES NOT WORK: measured on npm 10.9.7, a pack
 * carrying that flag still fired `prepare`. So the guard is an environment sentinel instead, which
 * does not depend on npm's flag semantics staying where they are today.
 *
 * The inner build still bundles — harmless, and it keeps dist/ honest for the pack it is being asked
 * about — then skips both spawning checks, so the chain terminates one level down rather than never.
 */
const PROBE = 'DAEDALUS_BUILD_PROBE';
const inner = Boolean( process.env[ PROBE ] );

// ── 1 · The emit is real ────────────────────────────────────────────────────────────────────────
// esbuild exiting 0 is not proof of a usable artifact: a truncated write or an emptied entry point
// both survive it. Cheap floor — the files exist, are not trivially small, and the CLI carries the
// shebang that makes it executable as the npm-installed `bin`.
const EMITS = [
	{ file: 'dist/index.js',     minBytes: 100000, shebang: false },
	{ file: 'dist/cli/index.js', minBytes: 100000, shebang: true  },
];

for ( const emit of EMITS ) {
	if ( !fs.existsSync( emit.file ) )
		throw new Error( 'build: ' + emit.file + ' was not emitted — esbuild reported success and produced nothing' );

	const size = fs.statSync( emit.file ).size;
	if ( size < emit.minBytes )
		throw new Error( 'build: ' + emit.file + ' is ' + size + ' bytes, under the ' + emit.minBytes + ' floor — a truncated or empty bundle' );

	if ( emit.shebang && !fs.readFileSync( emit.file, 'utf8' ).startsWith( '#!' ) )
		throw new Error( 'build: ' + emit.file + ' has no shebang — the npm-installed daedalus binary would not execute' );
}
console.log( 'emit     → both bundles present, sized and executable' );

if ( !inner ) {
	// ── 2 · The tool snapshot is CURRENT ────────────────────────────────────────────────────────
	// THIS IS THE ONE THAT WAS ACTUALLY BROKEN. `tools.snapshot.json` ships inside the package, and
	// under lazy activation a host advertises this server's tools FROM it while the process stays
	// dormant — so a stale snapshot hands agents a tool surface that no longer matches the code.
	//
	// It was regenerated only by a manual `npm run snapshot`, and on 2026-08-24 it was found weeks
	// out of date: kcd_move's doc still described a HealPlan with no `reported` field, from before
	// the raw text sweep landed. Worse, the only drift detector — `daedalus mcp status` — compares
	// tool NAMES ONLY, so it printed "snapshot matches the live surface" throughout. Regenerating
	// here is what makes that report honest.
	//
	// REGENERATE rather than assert-and-fail: the payload comes from `wireTools()`, the same
	// projection `tools/list` sends over the wire, so there is no judgment in it and nothing to
	// review. It prints when the content moves, so the change lands in the diff and is committed
	// deliberately rather than arriving unnoticed.
	const before = fs.existsSync( 'tools.snapshot.json' ) ? fs.readFileSync( 'tools.snapshot.json', 'utf8' ) : null;

	npmRun( [ 'run', '--silent', 'snapshot' ], { stdio: [ 'ignore', 'ignore', 'inherit' ] } );

	const after = fs.readFileSync( 'tools.snapshot.json', 'utf8' );
	if ( before === null )       console.log( 'snapshot → CREATED — none existed' );
	else if ( before !== after ) console.log( 'snapshot → UPDATED — the committed surface had drifted from the code; COMMIT THIS FILE' );
	else                         console.log( 'snapshot → current' );

	// ── 3 · What would actually SHIP ────────────────────────────────────────────────────────────
	// The package has never been installed from a tarball, so packing is the untested part — and it
	// is fragile in a specific way: `dist/` is gitignored, and npm falls back to `.gitignore` when no
	// `files` field applies, which would publish a package with no binary in it. Two mechanisms
	// prevent that ( the `files` allowlist in package.json, and `.npmignore` existing purely to block
	// that fallback ), and neither announces itself if it stops working.
	//
	// Asks npm rather than checking the paths exist on disk, deliberately: the thing in doubt is
	// npm's INCLUSION LOGIC, and only a real pack resolution exercises it.
	const REQUIRED  = [ 'dist/index.js', 'dist/cli/index.js', 'substrate/', 'skills/', 'tools.snapshot.json' ];
	const FORBIDDEN = [ 'src/' ];

	let packed;
	try {
		const out = npmRun(
			[ 'pack', '--dry-run', '--json', '--ignore-scripts' ],
			{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'ignore' ], env: Object.assign( {}, process.env, { [ PROBE ]: '1' } ) }
		);
		// npm prints `[ { files: [ { path, size, … } ], … } ]`, but the inner build's own stdout can
		// precede it on the same stream — so parse from the first bracket rather than assuming the
		// whole capture is JSON.
		packed = JSON.parse( out.slice( out.indexOf( '[' ) ) )[ 0 ].files.map( f => f.path.split( '\\' ).join( '/' ) );
	} catch ( err ) {
		// A check that could not RUN is not a check that passed.
		throw new Error( 'build: could not read the pack manifest, so what ships is UNVERIFIED — ' + err.message );
	}

	const missing = REQUIRED.filter( need => !packed.some( f => f === need || f.startsWith( need ) ) );
	const leaked  = FORBIDDEN.filter( bad => packed.some( f => f.startsWith( bad ) ) );

	if ( missing.length )
		throw new Error( 'build: the package would ship WITHOUT ' + missing.join( ', ' ) + ' — check the files allowlist in package.json, and that .npmignore still exists' );
	if ( leaked.length )
		throw new Error( 'build: the package would ship ' + leaked.join( ', ' ) + ' — the files allowlist is not holding' );

	console.log( 'pack     → ' + packed.length + ' files, every required entry present, no src/' );
}

console.log( inner ? '\nbuild complete ( inner probe ).' : '\nbuild complete.' );
