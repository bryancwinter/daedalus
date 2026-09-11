/**
 * PROBE — DISPOSABLE, WON'T SHIP. Written 2026-09-11 to smoke-test the call trace.
 *
 * Neither esbuild entry point reaches this file ( build.js bundles `src/index.ts` and
 * `src/cli/index.ts` only, and the package ships `dist/` ), so it cannot leak into a release.
 * Delete it once the trace has proven itself in real use.
 *
 * Drives one server through the same `invoke` seam the wire uses — four failures across three
 * fault buckets, plus two successes so the rate has a denominator — then prints what landed on
 * disk. Run it, then `npm run cli -- trace` to read the same data through the CLI face.
 */
import { DaedalusServer } from '../server';
import { Trace } from '../Trace';

async function main(): Promise<void> {
	process.stdout.write( `trace file: ${ Trace.file() }\n\n` );

	const server = new DaedalusServer();

	const calls: [ string, Record<string, unknown> ][] = [
		[ 'kcd_query',   { type: 'lens' } ],                                        // ok
		[ 'kcd_get',     { path: 'references/mcp/no-such-artifact.html' } ],        // not-found
		[ 'kcd_get',     { path: 'C:/Windows/System32/drivers/etc/hosts' } ],       // out-of-vault
		[ 'kcd_query',   { query: 'lens' } ],                                       // bad-args
		[ 'kcd_read',    { path: 'root.html' } ],                                   // unknown-tool
		[ 'kcd_compile', { lenses: [ 'mcp' ] } ],                                   // ok
	];

	for ( const [ name, args ] of calls ) {
		const result = await server.invoke( name, args );
		const status = result.isError ? 'FAIL' : 'ok  ';
		process.stdout.write( `${ status } ${ name } ${ JSON.stringify( args ) }\n` );
	}

	process.stdout.write( '\nrecorded:\n' );
	for ( const entry of Trace.entries().slice( -calls.length ) )
		process.stdout.write( `${ JSON.stringify( entry ) }\n` );
}

void main();
