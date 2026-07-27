import { KCDPrimitive, VaultUtilities, Survey } from 'kcd_sdk';
import type { ToolDefinition, TestSpec } from '../mcp';
import { GuardChain } from '../guards';
import { MCPUtils } from '../MCPUtils';
import { Config } from '../Config';

export function readTools( chain: GuardChain ): ( ToolDefinition & { spec?: TestSpec[] } )[] {
	return [
		{
			name:        'kcd_get',
			annotations: { readOnlyHint: true },
			spec: [
				{ label: 'reads a lens artifact', input: { path: 'lenses/parser/parser.html' }, assertions: [] },
				{ label: 'PathGuard jails an out-of-vault path', input: { path: 'C:/Windows/System32/drivers/etc/hosts' }, assertions: [ { type: 'error_expected' } ] },
			],
			description: 'Load one artifact; for a lens, `depth` pulls in the context it always brings with it.',
			doc:
				'Load one artifact by vault-relative `path`, parse it, and return its serialized shape ' +
				'(frontmatter + sections + body + resolved links). For a lens, `depth` controls dredge: ' +
				'1 (default) returns the lens alone; 2+ pulls its always-policy children that many levels ' +
				'deep, so the returned object carries the composed Know set. Non-lens types ignore `depth`. ' +
				'The path is PathGuard-jailed to the vault; an out-of-vault path returns a structured error. ' +
				'Use kcd_links instead when you only need the link graph, not the full body. Read-only.',
			inputSchema: {
				type:       'object',
				properties: {
					path:  { type: 'string', description: 'Vault-relative path to the artifact.' },
					depth: { type: 'integer', minimum: 1, maximum: 4, default: 1, description: 'Lens dredge depth; 1 = artifact only.' },
				},
				required: [ 'path' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_get', params: args } );

					const vault    = MCPUtils.vault;
					const filePath = String( args[ 'path' ] ?? '' );
					const depth    = typeof args[ 'depth' ] === 'number' ? args[ 'depth' ] as number : undefined;
					const type     = vault.classify( filePath );

					if ( type === 'lens' ) {
						// vault.loadLens injects the real fs reader — a bare load leaves
						// disk-read unset (a main/node capability) and throws on dredge.
						const lens = vault.loadLens( filePath, { depth: depth ?? 1 } );
						return MCPUtils.result( lens.serialize() );
					}

					const artifact = KCDPrimitive.fromHtml( vault.read( filePath ), vault.toAbs( filePath ) );
					return MCPUtils.result( artifact.serialize() );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_links',
			annotations: { readOnlyHint: true },
			spec: [
				{ label: 'resolves links for a lens', input: { path: 'lenses/parser/parser.html' }, assertions: [] },
			],
			description: 'See an artifact\'s outbound links, and everything pointing back at it.',
			doc:
				'Resolve the link graph around one artifact. Returns `{ outbound, inbound }`: outbound = the ' +
				'links the artifact itself declares (resolved to their targets); inbound = every other file ' +
				'in the vault whose links resolve TO this one (backlinks), found by scanning + resolving the ' +
				'whole vault. The graph primitive behind the editor\'s reference fan and the backlink panel. ' +
				'Cheaper than kcd_get when you only need edges, not the body. Read-only.',
			inputSchema: {
				type:       'object',
				properties: { path: { type: 'string', description: 'Vault-relative path to the artifact.' } },
				required:   [ 'path' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_links', params: args } );

					// One engine, two faces: this same call backs the CLI `links` command.
					const result = VaultUtilities.links( MCPUtils.vault, String( args[ 'path' ] ?? '' ) );
					return MCPUtils.result( result );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_health',
			annotations: { readOnlyHint: true },
			spec: [
				{ label: 'validates the whole vault', input: {}, assertions: [] },
			],
			description: 'Validate one artifact, or the whole vault, for dangling links and broken refs.',
			doc:
				'Validate artifacts on two axes. STRUCTURAL ( per file ): required frontmatter, sections, ' +
				'and type rules — a parse failure becomes an error issue rather than aborting the run. ' +
				'REFERENCE INTEGRITY ( cross-file, advisory warnings ): internal links whose target is missing ' +
				'on disk ( code-file links count; external URLs, #anchors, and {placeholder} hrefs are skipped ), ' +
				'and `base`/`lens` slugs that name no artifact ( the `cross` sentinel is skipped ). Pass `path` ' +
				'to check one file; omit it to sweep the whole vault. Returns `{ issues, summary }` — each issue ' +
				'carries its path, severity (error/warn), and message; the summary totals errors vs warnings. ' +
				'The pre-flight before a save or move sweep, and the observable form of the "always viable" ' +
				'invariant. Read-only.',
			inputSchema: {
				type:       'object',
				properties: { path: { type: 'string', description: 'Optional vault-relative path; omit to check the whole vault.' } },
				required:   [],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_health', params: args } );

					const inputPath = typeof args[ 'path' ] === 'string' ? args[ 'path' ] as string : '';

					// One engine, two faces: this same call backs the CLI `validate` command.
					const report = VaultUtilities.health( MCPUtils.vault, inputPath || undefined );

					return MCPUtils.result( report );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_compile',
			annotations: { readOnlyHint: true },
			spec: [
				{ label: 'compiles a single lens', input: { lenses: [ 'lens_crafter' ] }, assertions: [] },
			],
			description: 'Compile one or more lenses into one composed context string — first lens is primary.',
			doc:
				'The LENS compiler — Daedalus\'s basic context-compilation surface. Give it lens names ' +
				'( a bare `parser` maps to `lenses/parser/parser.html`; a vault path is used as-is ) and it ' +
				'dredges each lens to its OWN authored depth, folds their context blocks together, resolves ' +
				'habit-class contention, and assembles one context string ( Care-first, manifest tables ). For a ' +
				'single lens the output equals that lens\'s own compiled context; multiple lenses compose into one, ' +
				'first = primary. Returns `{ lenses, text, tokens }`. This is lens composition only — the live ' +
				'runtime layers ( model root context, active MCP tool schemas, session memory ) are Starmind\'s ' +
				'job, not the vault\'s. Read-only.',
			inputSchema: {
				type:       'object',
				properties: {
					lenses: {
						type:        'array',
						items:       { type: 'string' },
						description: 'Lens names or vault-relative paths to compile; the first is primary.',
						minItems:    1,
					},
				},
				required: [ 'lenses' ],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_compile', params: args } );

					const lenses = Array.isArray( args[ 'lenses' ] ) ? ( args[ 'lenses' ] as unknown[] ).map( String ) : [];

					// One engine, two faces: this same call backs the CLI `compile` command.
					const result = VaultUtilities.compile( MCPUtils.vault, lenses );

					return MCPUtils.result( result );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
		{
			name:        'kcd_survey',
			annotations: { readOnlyHint: true },
			// Two cases because this tool has two RETURN SHAPES. The lean default is prose, so it can only be
			// smoke-tested (no assertion can read a key off text) — and it stays FIRST because the first spec's
			// input becomes the tool's `example` in tools/list, and the idiomatic call is the argument-less one.
			// The `full: true` case is where the real assertions live, since that shape is a SurveyReport object.
			spec: [
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
			],
			description: 'Reconnoitre the project beside the vault — a filename-level census of components, languages, and entry points.',
			doc:
				'Walk the configured project root and return a structured reconnaissance of it. This is a ' +
				'CENSUS: it reads filenames and small manifests only — no source is parsed and no model runs — ' +
				'so it produces a real answer on a Python, Go or C# project exactly as on TypeScript. The unit ' +
				'is the COMPONENT ( the root, plus every directory carrying its own package manifest ); each ' +
				'file is attributed to the deepest component containing it, so a monorepo reads as its real ' +
				'parts. By default returns the LEAN TEXT PROJECTION — the orientation read, geometry-free, the ' +
				'form a small model reasons over best. Pass `full: true` for the complete `SurveyReport` object ' +
				'( components with languages, entryPoints, tests, contains, stats ). What a survey does NOT tell ' +
				'you: what the code does, which component matters, or that an absent thing is truly absent — ' +
				'treat it as orientation, not authority ( see the read-a-survey reference ). Read-only; surveys ' +
				'the project, writes nothing. The CLI `survey` command writes the same data as a JSON tree.',
			inputSchema: {
				type:       'object',
				properties: {
					full: { type: 'boolean', default: false, description: 'Return the full structured SurveyReport instead of the lean text projection.' },
				},
				required: [],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_survey', params: args } );

					// The survey walks the PROJECT ROOT ( the code ), not the vault ( docRoot ) — the
					// opposite scope from every other tool, which read the artifact store. One engine,
					// two faces: this same call backs the CLI `survey` command.
					const { projectRoot } = Config.resolve();
					const report = Survey.run( projectRoot );

					return args[ 'full' ] === true
						? MCPUtils.result( report )
						: MCPUtils.text( Survey.project( report ) );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
	];
}
