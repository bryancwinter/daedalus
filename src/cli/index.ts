import { Cli } from './Cli';

/**
 * CLI process entry — the `daedalus` binary. A one-liner by design: all parsing, dispatch,
 * rendering, and exit-code policy live in the Cli Thing, so the server entry ( src/index.ts )
 * and this one stay symmetric — each is a thin shell over a bucket that does the work.
 *
 * esbuild prepends the `#!/usr/bin/env node` shebang at build time ( see build.js ), so the
 * emitted dist/cli/index.js is directly executable as the npm-installed `bin`.
 */
Cli.run( process.argv.slice( 2 ) ).catch( ( e ) => {
	process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
	process.exit( 1 );
} );
