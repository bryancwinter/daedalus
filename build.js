/**
 * Build script — esbuild bundles the server into a single self-contained dist/index.js.
 *
 * Everything the server needs is inlined: kcd_sdk (and its js-yaml) are bundled in, so the
 * promoted plugin folder carries no node_modules. Only Node builtins (fs, path, …) stay
 * external — platform:'node' marks them external automatically.
 *
 * esbuild (not tsc): it strips types without type-checking, sidestepping the historical tsc
 * OOM on deep generic graphs, and it bundles kcd_sdk's CJS dist cleanly — the export* interop
 * problem that forces the @kcd *source* alias on the main side is a Vite/Rollup issue, not an
 * esbuild one.
 */
const esbuild = require( 'esbuild' );

// The MCP server face — dist/index.js, what a host spawns. kcd_sdk is inlined, so the promoted
// plugin folder carries no node_modules. The CLI gets its own bundle, below.
esbuild.buildSync({
	entryPoints: [ 'src/index.ts' ],
	bundle:      true,
	platform:    'node',
	target:      'node20',
	outfile:     'dist/index.js',
	sourcemap:   true,
});

// The CLI face — same engine, its own binary. The shebang banner makes the emitted file
// directly executable as the npm-installed `bin` ( dist/cli/index.js ).
esbuild.buildSync({
	entryPoints: [ 'src/cli/index.ts' ],
	bundle:      true,
	platform:    'node',
	target:      'node20',
	outfile:     'dist/cli/index.js',
	sourcemap:   true,
	banner:      { js: '#!/usr/bin/env node' },
});

console.log( 'build complete → dist/index.js + dist/cli/index.js (self-contained)' );
