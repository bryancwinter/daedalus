/**
 * Build script — esbuild bundles the server and the CLI into self-contained files under dist/.
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

console.log( 'build complete → dist/index.js + dist/cli/index.js (self-contained, bundled from kcd_sdk source)' );
