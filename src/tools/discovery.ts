import { VaultUtilities } from 'kcd_sdk';
import { GuardChain } from '../guards';
import { MCPUtils } from '../MCPUtils';

import type { ToolDefinition, TestSpec } from '../mcp';

export function discoveryTools( chain: GuardChain ): ( ToolDefinition & { spec?: TestSpec[] } )[] {
	return [
		{
			name:        'kcd_query',
			annotations: { readOnlyHint: true },
			example:     { type: 'lens' },
			spec: [
				{ label: 'lists the lenses subtree',  input: { glob: 'lenses/**' }, assertions: [] },
				{ label: 'lists all lenses',           input: { type: 'lens' },      assertions: [] },
				{ label: 'finds a body/frontmatter term', input: { text: 'lens' },   assertions: [] },
				{ label: 'censuses the vault by type',  input: { groupBy: 'type' },   assertions: [] },
			],
			description: 'Find artifacts by path glob, type, and body text — the place to start when you don\'t know the path.',
			doc:
				'The single read-query over the vault — subsumes the old glob/list/search/types tools. Any of ' +
				'`glob` ( vault-relative path pattern; `*` within a segment, `**` across ), `type` ( artifact ' +
				'classifier: lens, plan, habit, reference, contract, generator, analyzer, template, framework, ' +
				'nav-index ), and `text` ( case-insensitive substring across body + serialized frontmatter ) may ' +
				'be combined; they AND together. With no filter it returns the whole live vault. Returns an array ' +
				'of refs ( path + type + name ) — read one with kcd_get, walk its edges with kcd_links. Pass ' +
				'`groupBy: "type"` to get `{ type, count }[]` ( sorted by count, descending ) instead of refs — ' +
				'the cheapest orientation call. ARCHIVAL buckets ( plans/plans_complete, plans/plans_deferred ) ' +
				'are EXCLUDED unless the glob names one — retired and parked plans answer "what did we do", not ' +
				'"what is true now". So `type: "plan"` returns the live plans, and ' +
				'`glob: "plans/plans_complete/**"` returns the retired ones. Read-only.',
			inputSchema: {
				type:       'object',
				properties: {
					glob:    { type: 'string', description: 'Vault-relative path glob; * within a segment, ** across segments.' },
					type:    {
						type:        'string',
						enum:        [ 'lens', 'plan', 'habit', 'reference', 'contract', 'generator', 'analyzer', 'template', 'framework', 'nav-index' ],
						description: 'Artifact-type filter.',
					},
					text:    { type: 'string', description: 'Case-insensitive substring across body + serialized frontmatter.' },
					groupBy: { type: 'string', enum: [ 'type' ], description: 'Return { type, count }[] instead of refs.' },
				},
				required: [],
			},
			handler: async ( args ) => {
				try {
					chain.run( { tool: 'kcd_query', params: args } );

					// One engine, two faces: this same call backs the CLI `query` command.
					const result = VaultUtilities.query( MCPUtils.vault, {
						glob:    typeof args[ 'glob' ] === 'string' ? args[ 'glob' ] as string : undefined,
						type:    typeof args[ 'type' ] === 'string' ? args[ 'type' ] as string : undefined,
						text:    typeof args[ 'text' ] === 'string' ? args[ 'text' ] as string : undefined,
						groupBy: args[ 'groupBy' ] === 'type' ? 'type' : undefined,
					} );

					return MCPUtils.result( result );
				} catch ( e ) {
					return MCPUtils.error( e instanceof Error ? e.message : String( e ) );
				}
			},
		},
	];
}
