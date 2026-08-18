import { KcdEmit, KcdValidate, KcdShapes, KcdSynth } from 'kcd_sdk';
import type { ToolDefinition, TestSpec } from '../mcp';
import type { SerializedArtifact, SynthInput } from 'kcd_sdk';
import { GuardChain } from '../guards';
import { MCPUtils } from '../MCPUtils';
import { Config } from '../Config';

export function writeTools( chain: GuardChain ): ( ToolDefinition & { spec?: TestSpec[] } )[] {
	return [
		{
			name:        'kcd_save',
			annotations: { destructiveHint: true },
			example:     {
				path:     'references/domain/my-note.html',
				artifact: {
					type:        'reference',
					frontmatter: { name: 'my-note', description: 'A worked example.', type: 'reference', status: 'active' },
					body:        '<h1>My Note</h1>\n<p>The body content.</p>',
				},
			},
			spec: [
				{ label: 'jails an out-of-vault path', input: { path: 'C:/Windows/x.html', artifact: { type: 'reference', frontmatter: {}, body: '' } }, assertions: [ { type: 'error_expected' } ] },
				{ label: 'refuses an artifact that fails validation', input: { path: 'references/domain/x.html', artifact: { type: 'reference', frontmatter: {}, body: '' } }, assertions: [ { type: 'error_expected' } ] },
				// The two input paths are mutually exclusive; proving the refusal is the one case that
				// exercises the content branch WITHOUT landing a file during verify.
				{ label: 'refuses content and body together', input: { path: 'references/domain/x.html', artifact: { type: 'reference', frontmatter: { name: 'x', description: 'x', type: 'reference', status: 'active' }, body: '<p>x</p>', content: { sections: { location: 'x' } } } }, assertions: [ { type: 'error_expected' } ] },
			],
			description: 'Write an artifact, validated first — a malformed one is refused and nothing lands.',
			doc:
				'Persist one artifact by vault-relative `path` from its `artifact` ( a SerializedArtifact — the ' +
				'shape kcd_get returns ). Emits HTML with KcdEmit: frontmatter is rebuilt from `artifact.frontmatter`, ' +
				'the `body` is re-parsed and re-emitted — an existing body has its frontmatter block replaced ( the ' +
				'edit path: kcd_get → mutate → kcd_save ), a body with none gets one prepended ( the create path ). ' +
				'The head is regenerated wholesale every write, so a document self-corrects its stylesheet on any ' +
				'save. The result ' +
				'is validated with KcdValidate BEFORE any write: a structural failure returns a structured error and ' +
				'writes NOTHING ( the write-time gate — can\'t save a malformed artifact ). On success it writes and ' +
				'returns `{ saved, warnings }`. PathGuard jails the path and checks the target directory ACCEPTS the ' +
				'declared type — a refusal names the accepted set, so the fix is in the error. ' +
				'TWO WAYS IN, exactly one per call. Pass `artifact.content` to AUTHOR: give sections as prose ' +
				'( plus rows for the record-bearing ones ) and the structure — section order, nesting, heading ' +
				'levels, faux-tables, the whole data-kcd grammar — is DERIVED from that type\'s declared shape, so ' +
				'you supply content and never markup. Pass `artifact.body` instead to EDIT, where existing ' +
				'structured HTML is kept ( kcd_get → mutate → kcd_save ) — content, structure and attributes ' +
				'survive, while indentation and line breaks are NORMALIZED to house format, so expect the ' +
				'file you get back to be formatted rather than byte-identical to what you sent. Supplying both is ' +
				'refused rather than resolved by precedence. Content mode also returns advisories naming any ' +
				'required or expected section left out, and — on a closed type — any section the compiler will not ' +
				'read. NOTE: agent-authored body HTML is not yet sanitized here ( the render layer sanitizes on ' +
				'display; a save-time sanitize pass is a named deferral ).',
			inputSchema: {
				type:       'object',
				properties: {
					path:     { type: 'string', description: 'Vault-relative destination path.' },
					artifact: {
						type:        'object',
						description: 'The SerializedArtifact to write.',
						properties: {
							type:        { type: 'string', description: 'Artifact type (lens, plan, habit, reference, …) — must match the target directory.' },
							frontmatter: { type: 'object', additionalProperties: true, description: 'Frontmatter fields (name, description, status, …) — rebuilt into the HTML header block.' },
							body:    { type: 'string', description: 'EDIT path — body HTML, no frontmatter block. Content, structure and attributes are preserved; whitespace is reformatted to house style, so the stored file will not be byte-identical to what you send. Use for an edit (kcd_get → mutate → kcd_save). Mutually exclusive with `content`.' },
							content: {
								type:        'object',
								description: 'AUTHORING path — supply CONTENT and the structure is derived from the type\'s shape (section order, nesting, headings, faux-tables). Mutually exclusive with `body`.',
								properties: {
									title:    { type: 'string', description: 'The document\'s <h1>. Defaults to frontmatter.name.' },
									summary:  { type: 'string', description: 'One line under the title, rendered as a blockquote.' },
									sections: { type: 'object', additionalProperties: { type: 'string' }, description: 'Section name → prose. Plain text is fine: blank lines become paragraphs, "- " lines a list. MARKDOWN IS NOT INTERPRETED — **bold**, `code` and [text](link) render as literal characters; use <strong>, <code>, <a href> instead, or write the whole section as HTML. HTML comments are stripped. Names and order come from the type\'s shape; a nested child like "phase-2" is placed inside its parent automatically.' },
									slots: {
										type:        'array',
										description: 'Rows for the sections that carry records rather than prose (a lens\'s habits, a nav-index\'s entries).',
										items: {
											type: 'object',
											properties: {
												section: { type: 'string', description: 'Which section these rows belong to.' },
												kind:    { type: 'string', description: 'Slot kind; defaults to the kind the shape declares for that section.' },
												rows: {
													type:  'array',
													items: {
														type: 'object',
														properties: {
															what:  { type: 'string', description: 'The label.' },
															where: { type: 'string', description: 'Vault-root-relative path (_Claude/...), emitted as a real link.' },
															why:   { type: 'string', description: 'When or why this row applies.' },
															mode:  { type: 'string', description: 'off | on | suggested.' },
														},
														required: [ 'what' ],
													},
												},
											},
											required: [ 'section', 'rows' ],
										},
									},
								},
							},
						},
						required: [ 'type', 'frontmatter' ],
					},
				},
				required: [ 'path', 'artifact' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_save', params: args } );

					const filePath = String( args[ 'path' ] ?? '' );
					const raw      = ( args[ 'artifact' ] ?? {} ) as Record<string, unknown>;
					const declared = String( raw[ 'type' ] ?? '' );

					// TWO WAYS IN, one write. `content` is the AUTHORING path: sections and rows go to
					// KcdSynth and the markup is DERIVED from the type's shape, so an author supplies
					// content and never markup. `body` is the EDIT path ( kcd_get → mutate → kcd_save ),
					// where the body is already structured and its CONTENT must survive — not its bytes.
					// `KcdEmit.spliceFrontmatter` re-parses and re-serializes the whole body through
					// `HtmlTree`, which normalizes whitespace and quote style; the doc-block above says so
					// to a reader, and it used to promise the opposite. Supplying both would silently
					// discard one, so the combination is refused rather than resolved by a precedence rule
					// nobody can see.
					const content = raw[ 'content' ] as SynthInput | undefined;
					const hasBody = typeof raw[ 'body' ] === 'string' && ( raw[ 'body' ] as string ).trim() !== '';
					if ( content && hasBody )
						return MCPUtils.error( `kcd_save refused "${ filePath }": supply either "content" ( synthesized ) or "body" ( passthrough ), not both.` );

					// coerce body to a string — an absent body is a create with no content ( validation
					// will then reject it with a helpful message, not a parse crash ).
					let body = typeof raw[ 'body' ] === 'string' ? raw[ 'body' ] : '';
					const advisories: string[] = [];

					if ( content ) {
						const fm    = ( raw[ 'frontmatter' ] ?? {} ) as Record<string, unknown>;
						const title = content.title ?? String( fm[ 'name' ] ?? declared );
						const synth = KcdSynth.synthesize( declared, { ...content, title } );
						body = synth.body;

						// A CLOSED type ( only `lens` today ) still EMITS an undeclared section, but the
						// compiler will not read it — say so here rather than let the content go quiet.
						const shape = KcdShapes.shapeFor( declared );
						if ( synth.undeclared.length && shape && !shape.open )
							advisories.push( `sections not declared by the "${ declared }" shape: ${ synth.undeclared.join( ', ' ) } — the compiler will not read them. Declared: ${ KcdShapes.orderFor( declared ).join( ', ' ) }` );

						// Advisory only — KcdValidate stays the SOLE gate. This names the gap while the
						// author still holds the content, which is the cheapest moment to close it.
						// Audit what was SUPPLIED, prose and rows alike — a slot-bearing section arrives as
						// rows and never appears in `sections`, so auditing the prose keys alone reports it
						// missing when it is right there.
						const audit = KcdShapes.audit( declared, KcdSynth.suppliedSections( content ) );
						if ( audit.missing.length ) advisories.push( `missing required section(s): ${ audit.missing.join( ', ' ) }` );
						if ( audit.thin.length )    advisories.push( `missing expected section(s): ${ audit.thin.join( ', ' ) }` );

						// The other half of the advisory: `audit` asks whether the right SECTIONS are here,
						// this asks whether what is inside them will read as intended. Markdown markers in
						// prose emit as literal characters — 42 of them reached this corpus before anything
						// said so, including root-context.
						advisories.push( ...KcdSynth.proseWarnings( content ) );
					}

					const artifact = { ...raw, body } as unknown as SerializedArtifact;

					// TIER 2 of the stylesheet contract ( protocol §8.1 ): a depth-relative link, derived
					// from this document's own destination and from where the stylesheet sits in THIS
					// vault. Tier 1, the inline baseline, is emitted unconditionally and needs nothing
					// from here. Config is resolved per call, matching every other read in this file —
					// the host slice is a live file.
					const html   = KcdEmit.emit( artifact, KcdEmit.cssHrefFor( filePath, Config.resolve().cssVaultRel ) );
					const report = KcdValidate.validate( html );
					if ( !report.ok ) {
						const detail = report.errors.map( e => `${ e.code } @ ${ e.where }: ${ e.msg }` ).join( '; ' );
						return MCPUtils.error( `kcd_save refused "${ filePath }": artifact failed validation — ${ detail }` );
					}

					const saved = MCPUtils.vault.write( filePath, html );
					return MCPUtils.result( { saved, warnings: [ ...report.warnings, ...advisories ] } );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_move',
			annotations: { destructiveHint: true },
			example:     { from: 'references/domain/old-name.html', to: 'references/domain/new-name.html' },
			spec: [
				{ label: 'jails an out-of-vault source', input: { from: 'C:/Windows/System32/drivers/etc/hosts', to: 'x.html' }, assertions: [ { type: 'error_expected' } ] },
				{ label: 'missing source → structured error', input: { from: 'does-not-exist-xyz.html', to: 'work/mcp/AI/nope.html' }, assertions: [ { type: 'error_expected' } ] },
			],
			description: 'Move or rename an artifact, healing every inbound link across the vault.',
			doc:
				'Rename or relocate one artifact by vault-relative `from` → `to`, then HEAL every reference to ' +
				'it, so no backlink rots. TWO PASSES, because neither sees the whole corpus: the GRAPH pass ' +
				'reads links out of parsed artifacts and matches on resolved identity ( so any authored form ' +
				'counts ), and the TEXT pass sweeps raw bytes for the canonical path — which is the only thing ' +
				'that reaches a markdown todo, a `.js` utility, a `data-kcd-address`, the project-root ' +
				'CLAUDE.md, or a document that FAILS TO PARSE and therefore needs repair most. Swaps preserve ' +
				'hand-authored formatting. Returns the HealPlan — `{ op, from, to, edits, reported }`: `edits` ' +
				'is what changed ( referrer + old/new href ), `reported` is what was FOUND AND DELIBERATELY ' +
				'LEFT, each carrying `untouched` saying why. Today that means `quoted` — a reference sitting ' +
				'in `<code>`/`<pre>` content or a markdown fence, i.e. quoted speech the corpus uses to teach ' +
				'agents what to SAY, never rewritten. An empty `edits` alongside an empty `reported` therefore ' +
				'means nothing pointed at it, not that nothing could be seen. Ephemeral space is swept only ' +
				'where ruled in ( `logs/*/todo/` ); `logs/session.md` and `completed/` are historical records ' +
				'and are left alone. Refuses if `from` is missing or `to` already exists ( structured error ), ' +
				'and asserts afterward that no rewritable reference still resolves to `from` — a residual ' +
				'fails loud rather than leaving the vault dangling. Both paths are PathGuard-jailed. ' +
				'Destructive: it writes referrers and renames the file.',
			inputSchema: {
				type:       'object',
				properties: {
					from: { type: 'string', description: 'Current vault-relative path.' },
					to:   { type: 'string', description: 'Destination vault-relative path.' },
				},
				required: [ 'from', 'to' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_move', params: args } );
					const from = String( args[ 'from' ] ?? '' );
					const to   = String( args[ 'to' ] ?? '' );
					const plan = MCPUtils.vault.move( from, to );
					return MCPUtils.result( plan );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_delete',
			annotations: { destructiveHint: true },
			example:     { path: 'references/domain/obsolete-note.html' },
			spec: [
				{ label: 'jails an out-of-vault path', input: { path: 'C:/Windows/System32/drivers/etc/hosts' }, assertions: [ { type: 'error_expected' } ] },
				{ label: 'missing target → structured error', input: { path: 'does-not-exist-xyz.html' }, assertions: [ { type: 'error_expected' } ] },
			],
			description: 'Delete an artifact, cascading the removal through every referrer.',
			doc:
				'Remove one artifact by vault-relative `path` and CASCADE the removal: every inbound reference ' +
				'is excised from its referrer so the graph stays viable — a slot-field link takes its whole ' +
				'record row, a bare prose <a> unwraps to its text, span-precise so surrounding formatting is ' +
				'untouched. BLOCKS ( structured error, nothing deleted ) if any artifact references the target ' +
				'by IDENTITY ( a base/lens slug naming it ) — those are not movable links and must be repointed ' +
				'or renamed first. Returns the HealPlan — `{ op:"delete", from, edits, reported }`. `edits` is ' +
				'every referrer EXCISED, which is parse-and-splice and therefore covers parsed HTML/`.js` only. ' +
				'`reported` is every other reference the raw text sweep found and deliberately did not touch, ' +
				'each carrying `untouched`: `not-excisable` ( a markdown todo, an unparseable file, an address, ' +
				'CLAUDE.md — there is no span-precise way to cut a reference out of a sentence, so THESE WILL ' +
				'DANGLE and are named rather than discovered later ) or `quoted` ( quoted speech in ' +
				'`<code>`/`<pre>` or a fence ). Refuses a missing target, PathGuard-jails the path, and asserts ' +
				'afterward that no excisable link still resolves to it ( a residual fails loud ). ' +
				'Destructive: it writes referrers and removes the file.',
			inputSchema: {
				type:       'object',
				properties: { path: { type: 'string', description: 'Vault-relative path to the artifact to delete.' } },
				required:   [ 'path' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_delete', params: args } );
					const filePath = String( args[ 'path' ] ?? '' );
					const plan     = MCPUtils.vault.delete( filePath );
					return MCPUtils.result( plan );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
	];
}
