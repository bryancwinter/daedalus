import { KCDPrimitive, VaultUtilities } from 'kcd_sdk';
import type { ToolDefinition, TestSpec } from '../mcp';
import { GuardChain } from '../guards';
import { MCPUtils } from '../MCPUtils';
<<<<<<< HEAD
=======
import { validateVault } from '../validate';
>>>>>>> 8627d1b97c929924c52db38e3beedec1f3018018

export function readTools( chain: GuardChain ): ( ToolDefinition & { spec?: TestSpec[] } )[] {
	return [
		{
			name:        'kcd_get',
			annotations: { readOnlyHint: true },
			spec: [
				{ label: 'reads a lens artifact', input: { path: 'lenses/parser/parser.html' }, assertions: [] },
				{ label: 'PathGuard jails an out-of-vault path', input: { path: 'C:/Windows/System32/drivers/etc/hosts' }, assertions: [ { type: 'error_expected' } ] },
			],
			description: 'Load and serialize a KCD artifact. For lenses, depth controls how many levels of linked context to include (default 1 = the lens alone, 2+ = with the lenses/references it always pulls in).',
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
			description: 'Get outbound links and addresses declared by an artifact, plus inbound links pointing to it from the rest of the vault.',
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

					const vault    = MCPUtils.vault;
					const filePath = String( args[ 'path' ] ?? '' );
					const abs      = vault.toAbs( filePath );
					const artifact = KCDPrimitive.fromHtml( vault.read( filePath ), abs );
					const outbound = artifact.getLinks();

					// Addresses ride their OWN list, never mixed into outbound. A link asserts occupancy;
					// an address does not — collapsing them would hand the caller back the exact ambiguity
					// the primitive exists to remove. `occupied` is reported as a FACT, not a verdict.
					const names     = new Set( vault.scan()
						.map( f => typeof f.frontmatter[ 'name' ] === 'string' ? f.frontmatter[ 'name' ] as string : '' )
						.filter( n => n !== '' ) );
					const addresses = ( artifact.serialize().addresses ?? [] ).map( a => ( {
						...a,
						occupied: names.has( a.value ) || vault.exists( a.value ),
					} ) );

					// Inbound: scan vault, resolve each raw link, match against target
					const inbound  = vault.scan()
						.filter( f => f.rawLinks.some( l => vault.resolveHref( l.href ) === abs ) )
						.map( f => ( {
							path:         f.relativePath,
							relativePath: f.relativePath,
						} ) );

					return MCPUtils.result( { outbound, addresses, inbound } );
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
			description: 'Validate one artifact (path provided) or the entire vault (no path): structural type rules plus reference integrity (dangling links, broken base/lens refs). Returns issues and a summary.',
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
<<<<<<< HEAD

					const inputPath = typeof args[ 'path' ] === 'string' ? args[ 'path' ] as string : '';

					// One engine, two faces: this same call backs the CLI `validate` command.
					const report = VaultUtilities.health( MCPUtils.vault, inputPath || undefined );

					return MCPUtils.result( report );
=======
					const raw  = args[ 'path' ];
					const path = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
					return MCPUtils.result( validateVault( MCPUtils.vault, path ) );
>>>>>>> 8627d1b97c929924c52db38e3beedec1f3018018
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
			description: 'Compile one or more lenses into a single context string — the composed Know/Care/manifest a lens contributes. Pass lens names (or vault paths); the first is primary. Returns the compiled text, the lenses compiled, and a token estimate.',
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
	];
}
