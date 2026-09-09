/**
 * ══ VENDORED ═════════════════════════════════════════════════════════════════
 *
 * Copied verbatim from `kcd_sdk/src/server/verify.ts` on 2026-07-22, during the
 * Daedalus extraction. A deliberate copy — see `./McpServer.ts`'s header for the
 * full rationale and the divergence contract.
 *
 * WHY DAEDALUS KEEPS THIS. A first pass at the extraction assumed verification was
 * Starmind promote-pipeline machinery and could be dropped. It is not. Registering
 * a tool ALSO attaches its TestSpecs, so the proof of correctness lives beside the
 * tool rather than in a distant suite — and that discipline is exactly what the
 * kit's tool-surface review pass is meant to run against. It also feeds the wire:
 * a tool's inspector `example` is borrowed from its first TestSpec input, so
 * dropping specs would quietly degrade what an agent sees in `tools/list`.
 *
 * Shipping a tool with no way to prove it works is what the standalone kit is
 * explicitly NOT ( see the plan's quality bar ). This stays.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 */
import { McpServer } from './McpServer';

import type { ToolDefinition, ToolResult } from './McpServer';
import type { ServerManifest } from './manifest';

/**
 * verify.ts — the verification utility.
 *
 * The whole "prove a server works" capability in one place: the vocabulary a
 * server author writes (TestSpec + Assertion), the report it produces
 * (VerifyReport), and the engine that interprets one against the other
 * (runVerify). Assertions are data, not code — editable through a future
 * authoring UI, never compiled.
 *
 * runVerify() takes a server's registered tools and its manifest, runs every
 * tool's TestSpecs against its live handler in-process (no transport), and hands
 * back a dated report. It mirrors McpServer's error contract: a handler that
 * throws is folded to an isError result, exactly as it would be on the wire.
 */

/**
 * Assertion — one data-driven check the runner interprets against a tool result.
 * Keys are top-level only (no dotted paths) for now.
 */
export type Assertion =
	| { type: 'has_key';        key: string }
	| { type: 'type_is';        key: string; expected: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' }
	| { type: 'value_eq';       key: string; expected: unknown }
	| { type: 'error_expected' };

/**
 * TestSpec — one verification case for a tool: an input and the assertions its
 * result must satisfy. A spec carrying an `error_expected` assertion checks only
 * that the call failed (isError); its value assertions are ignored.
 */
export interface TestSpec {
	label:      string;
	input:      Record<string, unknown>;
	assertions: Assertion[];
}

/**
 * VerifyReport — the dated proof record written at promotion. `overall` is
 * 'pass' only when no tool has a failing case.
 */
export interface VerifyReport {
	server_id: string;
	version:   string;
	timestamp: string;                    // ISO 8601 — when runVerify ran
	tools: {
		name:   string;
		passed: number;
		failed: number;
		cases:  VerifyCase[];
	}[];
	overall: 'pass' | 'fail';
}

/**
 * One case's outcome, carrying the EVIDENCE rather than a description of it.
 *
 * `detail` stays a sentence because a person reads it in the console. The three fields beside it exist
 * because a sentence is where evidence goes to die: a caller that has to act on a failure needs the
 * values, and reconstructing them by parsing prose is exactly what the results-pipeline design forbids.
 *
 * ALL THREE ARE OPTIONAL AND MEAN SOMETHING BY THEIR ABSENCE. A passing case carries none. An assertion
 * failure carries `expected`/`actual` but no `stack`, because nothing threw — attaching the runner's own
 * stack would point at this file rather than at the defect. A thrown handler carries `stack` but usually
 * no diff, because no assertion got far enough to compute one.
 */
export interface VerifyCase {
	label:     string;
	pass:      boolean;
	detail?:   string;
	/** The throw site's stack, unmodified. Only when a case FAILED and something actually threw. */
	stack?:    string;
	/** Both sides of a comparison, only where the assertion genuinely computed them. */
	expected?: unknown;
	actual?:   unknown;
}

/** A tool registration paired with the cases that prove it — runVerify's input. */
export type Registration = { def: ToolDefinition; spec: TestSpec[] };

/**
 * Run every tool's TestSpecs against its live handler, in-process — no transport.
 * The manifest supplies the report's identity (server_id, version).
 */
export async function runVerify(
	registrations: Registration[],
	manifest:      ServerManifest,
): Promise<VerifyReport> {
	const tools: VerifyReport[ 'tools' ] = [];
	for ( const { def, spec } of registrations ) {
		const cases: VerifyCase[] = [];
		for ( const tc of spec ) cases.push( await runCase( def, tc ) );
		const passed = cases.filter( ( c ) => c.pass ).length;
		tools.push( { name: def.name, passed, failed: cases.length - passed, cases } );
	}

	return {
		server_id: manifest.id,
		version:   manifest.version,
		timestamp: new Date().toISOString(),
		tools,
		overall:   tools.every( ( t ) => t.failed === 0 ) ? 'pass' : 'fail',
	};
}

/** Run one case: invoke the handler, fold a throw to isError, judge assertions. */
async function runCase(
	def: ToolDefinition,
	tc:  TestSpec,
): Promise<VerifyCase> {
	// The same check invoke() runs, judged the same way, so a spec cannot pass here carrying a key the
	// wire would refuse. An error_expected spec can therefore assert the refusal itself.
	const badArgs = McpServer.unknownArgs( def, tc.input );
	if ( badArgs ) {
		const refused: ToolResult = { content: [ { type: 'text', text: badArgs } ], isError: true };
		return { label: tc.label, ...judge( tc.assertions, refused ) };
	}

	// THE THROWN VALUE IS KEPT, and this is the whole point of the change. `errorText` still folds the
	// throw into an isError result exactly as before — the wire contract is untouched — but the error
	// itself used to go out of scope at the closing brace, taking its stack with it. That brace was the
	// point of failure, and a stack reconstructed anywhere later is not the same artefact.
	let result: ToolResult;
	let thrown: unknown = undefined;
	try {
		result = await def.handler( tc.input );
	} catch ( e ) {
		thrown = e;
		result = { content: [ { type: 'text', text: errorText( e ) } ], isError: true };
	}

	const judged = judge( tc.assertions, result );
	// A case that PASSED has nothing to prove, and one that failed an assertion never threw — so the
	// stack rides on exactly one shape of outcome and its absence elsewhere is a fact, not an omission.
	if ( !judged.pass && thrown instanceof Error && thrown.stack ) {
		return { label: tc.label, ...judged, stack: thrown.stack };
	}
	return { label: tc.label, ...judged };
}

/** What `judge` and `checkOne` hand back: everything about an outcome except which case it was. */
type Judged = Omit<VerifyCase, 'label' | 'stack'>;

/** Judge a result against a case's assertions. The FIRST failure wins, and now brings its values. */
function judge( assertions: Assertion[], result: ToolResult ): Judged {
	// error_expected: the case checks only that the call failed — value assertions ignored.
	if ( assertions.some( ( a ) => a.type === 'error_expected' ) ) {
		return result.isError === true
			? { pass: true }
			: { pass: false, detail: 'expected an error result, got success' };
	}

	if ( result.isError ) {
		return { pass: false, detail: `unexpected error: ${ textOf( result ) }` };
	}

	// No assertions = a SMOKE case: the only claim is "this call succeeds". Returning here rather than
	// falling through to the parse is the whole point — every assertion type below reads a key off a parsed
	// object, so parsing was only ever a means to checking them, never a requirement of its own. Parsing
	// unconditionally made "returns JSON" an unwritten assertion on every spec, which no tool author ever
	// wrote and which a TEXT-returning tool can never satisfy: `kcd_survey`'s default lean projection is
	// prose by design, so its smoke spec failed for succeeding correctly ( found 2026-07-26, when the
	// vendored-plugin build phase began running this gate ).
	if ( assertions.length === 0 ) return { pass: true };

	let data: Record<string, unknown>;
	try {
		data = JSON.parse( textOf( result ) ) as Record<string, unknown>;
	} catch {
		// Now an honest failure: something asked for a key, so a non-JSON payload really is the wrong shape.
		return { pass: false, detail: 'result payload was not JSON, but assertions require a JSON object' };
	}

	for ( const a of assertions ) {
		const failed = checkOne( a, data );
		// `null` is the pass signal now rather than the empty string. Same shape as before at the call
		// site, but a failure carrying an empty detail can no longer read as a pass by accident.
		if ( failed ) return { pass: false, ...failed };
	}
	return { pass: true };
}

/**
 * Check one assertion. `null` on pass; on failure, the sentence AND the values behind it.
 *
 * `value_eq` is the case this exists for. It held both sides and reported neither — *"key X did not
 * equal the expected value"* is a sentence that tells a reader a comparison happened and nothing about
 * what it found, which leaves a person re-running the case by hand and an agent unable to act at all.
 * `has_key` genuinely has no pair to report: the whole finding is the absence, and inventing an
 * `actual: undefined` beside it would claim a value was read where none exists.
 */
function checkOne( a: Assertion, data: Record<string, unknown> ): { detail: string; expected?: unknown; actual?: unknown } | null {
	switch ( a.type ) {
		case 'has_key':
			return a.key in data ? null : { detail: `missing key "${ a.key }"` };
		case 'type_is': {
			const actual = typeName( data[ a.key ] );
			if ( actual === a.expected ) return null;
			// The TYPE NAMES are the comparison here, not the values — reporting the value as `actual`
			// would answer a question this assertion never asked.
			return { detail: `key "${ a.key }" is ${ actual }, expected ${ a.expected }`, expected: a.expected, actual };
		}
		case 'value_eq': {
			const actual = data[ a.key ];
			if ( JSON.stringify( actual ) === JSON.stringify( a.expected ) ) return null;
			return { detail: `key "${ a.key }" did not equal the expected value`, expected: a.expected, actual };
		}
		case 'error_expected':
			return null;   // resolved in judge() before the value pass
	}
}

/** The JS runtime type name, with array and null split out from typeof. */
function typeName( v: unknown ): string {
	if ( v === null ) return 'null';
	if ( Array.isArray( v ) ) return 'array';
	return typeof v;
}

function textOf( result: ToolResult ): string {
	return result.content[ 0 ]?.text ?? '';
}

function errorText( e: unknown ): string {
	return e instanceof Error ? e.message : String( e );
}
