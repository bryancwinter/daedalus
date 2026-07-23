import { Config } from './Config';
import { DaedalusServer } from './server';

/**
 * Process entry — read the argument tier, then serve.
 *
 * The parse is deliberately minimal: two flags, `--flag value` form only. The CLI shell ( plan 1.c )
 * owns real argument handling and replaces this outright, so nothing here is worth generalizing.
 * What it buys now is the one thing config resolution could not otherwise prove — that a caller can
 * place this server explicitly, without a host, an env var, or a vault above the working directory.
 */
Config.override( {
	projectRoot: flag( '--root' ),
	docRoot:     flag( '--doc-root' ),
} );

new DaedalusServer().run().catch( ( err ) => {
	process.stderr.write( `daedalus-mcp: fatal: ${ err }\n` );
	process.exit( 1 );
} );

/** The value after `name` in argv, or undefined when the flag is absent or has nothing after it. */
function flag( name: string ): string | undefined {
	const at = process.argv.indexOf( name );
	if ( at < 0 ) return undefined;
	return process.argv[ at + 1 ];
}
