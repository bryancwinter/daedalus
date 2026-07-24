#!/usr/bin/env node
/**
 * cli.ts — the Daedalus command-line entry point.
 *
 * The SECOND face over the engine ( the MCP server in index.ts is the first ). A CLI is not
 * magical: this is a main() that reads the words the user typed ( process.argv ), routes the first
 * one to a command, and exits with a status code. stdout carries results ( pipeable ), stderr
 * carries diagnostics, and the exit code is the machine-readable verdict a hook or CI gates on.
 *
 * The shell is a ROUTER, nothing more — a lookup from a command name to a function. Adding a
 * command later is one entry in COMMANDS. Every command shares the engine the MCP tools use, so
 * the two faces cannot drift.
 */
import { Config } from './Config';
import { runValidate } from './cli/validate';

/** A command: given its own args + the global options, do the work and return a process EXIT CODE. */
export type Command = ( args: string[], opts: GlobalOpts ) => number | Promise<number>;

/** Options that apply to every command, peeled off before the subcommand runs. */
export interface GlobalOpts { json: boolean; }

/** The router table. One entry per command. */
const COMMANDS: Record<string, Command> = {
	validate: runValidate,
};

function usage(): string {
	return [
		'daedalus — a context compiler.',
		'',
		'  daedalus <command> [options]',
		'',
		'Commands:',
		'  validate [path]   Validate the vault ( or one artifact ): structure + reference integrity.',
		'',
		'Global options:',
		'  --json            Machine-readable JSON instead of human output.',
		'  --root <dir>      Project root ( default: inferred by walking up for _Claude ).',
		'  --doc-root <dir>  Vault directory name ( default: _Claude ).',
		'  -h, --help        Show this help.',
	].join( '\n' );
}

async function main(): Promise<number> {
	const argv = process.argv.slice( 2 );   // drop [ node, cli.js ] — just the user's words

	// Global flags may appear anywhere. Peel them off; hand root overrides to Config's tiers
	// ( the same resolver the server uses — the CLI is simply another caller of it ).
	const json = argv.includes( '--json' );
	Config.override( { projectRoot: valueOf( argv, '--root' ), docRoot: valueOf( argv, '--doc-root' ) } );

	const [ name, ...rest ] = stripFlags( argv, [ '--json' ], [ '--root', '--doc-root' ] );

	if ( !name || name === 'help' || name === '-h' || name === '--help' ) {
		process.stdout.write( usage() + '\n' );
		return name ? 0 : 1;                 // explicit help is success; a bare invocation is a misuse
	}

	const cmd = COMMANDS[ name ];
	if ( !cmd ) {
		process.stderr.write( `daedalus: unknown command '${ name }'\n\n` + usage() + '\n' );
		return 2;                            // 2 = usage error, by long-standing CLI convention
	}

	return cmd( rest, { json } );
}

/** The value after a `--flag` in argv, or undefined when it is absent or has nothing after it. */
function valueOf( argv: string[], flag: string ): string | undefined {
	const i = argv.indexOf( flag );
	return i >= 0 ? argv[ i + 1 ] : undefined;
}

/** Drop boolean flags and value-flags ( plus their values ), leaving the positional args. */
function stripFlags( argv: string[], bools: string[], valued: string[] ): string[] {
	const out: string[] = [];
	for ( let i = 0; i < argv.length; i++ ) {
		if ( bools.includes( argv[ i ] ) ) continue;
		if ( valued.includes( argv[ i ] ) ) { i++; continue; }   // skip the flag AND its value
		out.push( argv[ i ] );
	}
	return out;
}

// The single place the process exits. An uncaught throw is an unexpected crash → code 1.
main()
	.then( ( code ) => process.exit( code ) )
	.catch( ( err ) => {
		process.stderr.write( `daedalus: fatal: ${ err instanceof Error ? err.message : String( err ) }\n` );
		process.exit( 1 );
	} );
