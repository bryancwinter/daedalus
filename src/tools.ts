import { VaultTools } from 'kcd_sdk';
import type { VaultToolOp } from 'kcd_sdk';
import type { ToolDefinition, TestSpec, ToolResult } from './mcp';
import { MCPUtils, TOOL_NAMES } from './MCPUtils';

/**
 * The Daedalus face of the KCD tools — wiring, and the proofs.
 *
 * Every handler is one line into the engine ( `VaultTools`, in kcd_sdk ), which owns what a tool DOES.
 * What this file owns is the TestSpecs that prove each one against a live vault — `npm run verify` runs
 * them in-process, and the first spec's input doubles as the tool's inspector example. What the tools
 * are CALLED on this wire is `TOOL_NAMES`, beside the vault binding.
 */

/** The server's in-process dispatch — `DaedalusServer.invoke`, bound at build() time. */
type Invoke = ( name: string, args: Record<string, unknown> ) => Promise<ToolResult>;

type Registered = ToolDefinition & { spec?: TestSpec[] };

/** Every tool this server registers, in wire order. */
export function kcdTools( invoke: Invoke ): Registered[] {
	const def = ( op: VaultToolOp, spec: TestSpec[], handler: ToolDefinition[ 'handler' ] ): Registered =>
		( { name: TOOL_NAMES[ op ], ...VaultTools.spec( op, TOOL_NAMES ), spec, handler } );

	return [
		def( 'query', [
			{ label: 'lists the lenses subtree',     input: { glob: 'lenses/**' },  assertions: [] },
			{ label: 'lists all lenses',             input: { type: 'lens' },       assertions: [] },
			{ label: 'finds a body/frontmatter term', input: { text: 'lens' },      assertions: [] },
			{ label: 'censuses the vault by type',   input: { groupBy: 'type' },    assertions: [] },
		], async ( args ) => MCPUtils.tools.query( args ) ),

		def( 'get', [
			{ label: 'reads a lens artifact', input: { path: 'lenses/parser/parser.html' }, assertions: [] },
			{
				label:      'full: true returns the verbatim body for the edit round trip',
				input:      { path: 'lenses/parser/parser.html', full: true },
				assertions: [ { type: 'has_key', key: 'body' } ],
			},
			{ label: 'PathGuard jails an out-of-vault path', input: { path: 'C:/Windows/System32/drivers/etc/hosts' }, assertions: [ { type: 'error_expected' } ] },
		], async ( args ) => MCPUtils.tools.get( args ) ),

		def( 'links', [
			{ label: 'resolves links for a lens', input: { path: 'lenses/parser/parser.html' }, assertions: [] },
		], async ( args ) => MCPUtils.tools.links( args ) ),

		def( 'health', [
			{ label: 'validates the whole vault', input: {}, assertions: [] },
		], async ( args ) => MCPUtils.tools.health( args ) ),

		def( 'compile', [
			{ label: 'compiles a single lens', input: { lenses: [ 'lens-crafter' ] }, assertions: [] },
		], async ( args ) => MCPUtils.tools.compile( args ) ),

		// Two cases because this tool has two RETURN SHAPES. The lean default is prose, so it can only be
		// smoke-tested — and it stays FIRST because the first spec's input becomes the tool's `example`, and
		// the idiomatic call is the argument-less one. The `full: true` case is where the real assertions live.
		def( 'survey', [
			{ label: 'surveys the configured project', input: {}, assertions: [] },
			{
				label:      'full: true returns a structured report',
				input:      { full: true },
				assertions: [
					{ type: 'has_key', key: 'components' },
					{ type: 'type_is', key: 'components', expected: 'array' },
					{ type: 'has_key', key: 'totals' },
				],
			},
		], async ( args ) => MCPUtils.tools.survey( args ) ),

		def( 'save', [
			{ label: 'jails an out-of-vault path', input: { path: 'C:/Windows/x.html', artifact: { type: 'reference', frontmatter: {}, body: '' } }, assertions: [ { type: 'error_expected' } ] },
			{ label: 'refuses an artifact that fails validation', input: { path: 'references/domain/x.html', artifact: { type: 'reference', frontmatter: {}, body: '' } }, assertions: [ { type: 'error_expected' } ] },
			// The two input paths are mutually exclusive; proving the refusal is the one case that exercises
			// the content branch WITHOUT landing a file during verify.
			{ label: 'refuses content and body together', input: { path: 'references/domain/x.html', artifact: { type: 'reference', frontmatter: { name: 'x', description: 'x', type: 'reference', status: 'active' }, body: '<p>x</p>', content: { sections: { location: 'x' } } } }, assertions: [ { type: 'error_expected' } ] },
		], async ( args ) => MCPUtils.tools.save( args ) ),

		def( 'move', [
			{ label: 'jails an out-of-vault source', input: { from: 'C:/Windows/System32/drivers/etc/hosts', to: 'x.html' }, assertions: [ { type: 'error_expected' } ] },
			{ label: 'missing source → structured error', input: { from: 'does-not-exist-xyz.html', to: 'work/mcp/AI/nope.html' }, assertions: [ { type: 'error_expected' } ] },
		], async ( args ) => MCPUtils.tools.move( args ) ),

		def( 'delete', [
			{ label: 'jails an out-of-vault path', input: { path: 'C:/Windows/System32/drivers/etc/hosts' }, assertions: [ { type: 'error_expected' } ] },
			{ label: 'missing target → structured error', input: { path: 'does-not-exist-xyz.html' }, assertions: [ { type: 'error_expected' } ] },
		], async ( args ) => MCPUtils.tools.delete( args ) ),

		// The batch dispatches the others through the server's in-process invoke seam — each dispatched call
		// runs its own op, jail included.
		def( 'batch', [
			{ label: 'runs a read sequence',                input: { calls: [ { tool: 'kcd_query', args: { groupBy: 'type' } } ] }, assertions: [] },
			{ label: 'reports a bad call without throwing', input: { calls: [ { tool: 'does-not-exist' } ] },                        assertions: [] },
		], async ( args ) => MCPUtils.tools.batch( args, invoke ) ),
	];
}
