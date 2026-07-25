import { Vault, VaultUtilities, Survey } from 'kcd_sdk';
import type { HealthReport, LensView } from 'kcd_sdk';
import { Config } from '../Config';

/** Parsed argv — one command word, its positionals, and the shared flags every command honours. */
interface ParsedArgs {
	command:     string;
	positionals: string[];
	root?:       string;
	docRoot?:    string;
	json:        boolean;
	help:        boolean;
}

/**
 * Cli — the Daedalus command-line face.
 *
 * The SECOND face over the same engine the MCP server serves: every command here calls the same
 * SDK routines the tools call ( `validate` → `VaultUtilities.health`, exactly what `kcd_health`
 * calls ), so a behaviour can never exist on one face and not the other. Imported and driven as
 * one Thing — `Cli.run( argv )` — never as loose functions.
 *
 * Contract for scripting callers:
 *   • Exit codes: 0 = clean ( warnings allowed ), 1 = errors found, 2 = usage error.
 *   • Line output on every command by default; `--json` emits the raw SDK object on the
 *     data-bearing commands ( validate, and — as they land — compile, survey ).
 *   • Diagnostics go to stderr; command payload goes to stdout, so `| jq` sees only data.
 */
export class Cli {

	static run( argv: string[] ): void {
		const args = this.parse( argv );

		// Root overrides ride the same tier the server entry uses, so `--root`/`--doc-root` place
		// the vault explicitly regardless of cwd — every command resolves through Config after this.
		Config.override( { projectRoot: args.root, docRoot: args.docRoot } );

		if ( args.help || !args.command ) {
			this.printHelp();
			// No command at all is a usage error; an explicit `--help` is a clean request.
			process.exit( args.help ? 0 : 2 );
		}

		switch ( args.command ) {
			case 'validate':
				return this.validate( args );
			case 'compile':
				return this.compile( args );
			case 'show':
				return this.show( args );
			case 'survey':
				return this.survey( args );
			default:
				process.stderr.write( `daedalus: unknown command "${ args.command }"\n\n` );
				this.printHelp();
				process.exit( 2 );
		}
	}

	// ── Commands ──────────────────────────────────────────────────────────────

	/**
	 * `daedalus validate [path]` — validate one artifact ( path given ) or the whole vault.
	 * The proving command: it exercises config resolution, the shared engine, both output modes,
	 * and the error/clean exit split in one path.
	 */
	private static validate( args: ParsedArgs ): void {
		const target = args.positionals[ 0 ];
		const vault  = this.vault();
		const report = VaultUtilities.health( vault, target || undefined );

		if ( args.json ) {
			this.emit( report );
		} else {
			this.renderHealth( report, target );
		}

		// Warnings are advisory and never fail the process; only structural errors do.
		process.exit( report.summary.errors > 0 ? 1 : 0 );
	}

	/**
	 * `daedalus compile <lens...>` — compile one or more lenses to a single context string ( the
	 * lens-scoped compiler; see VaultUtilities.compile ). Default output is the raw compiled text on
	 * stdout — pure payload, ready to pipe or paste before a prompt — with a one-line summary on
	 * stderr; `--json` emits `{ lenses, text, tokens }` instead.
	 */
	private static compile( args: ParsedArgs ): void {
		try {
			const result = VaultUtilities.compile( this.vault(), args.positionals );

			if ( args.json ) {
				this.emit( result );
			} else {
				// Summary → stderr so stdout stays a clean, paste-ready context blob.
				process.stderr.write( `compiled ${ result.lenses.join( ', ' ) } — ~${ result.tokens } tokens\n` );
				process.stdout.write( result.text + '\n' );
			}
			process.exit( 0 );
		} catch ( e ) {
			// A bad lens name or empty request is user input — usage error, not a run failure.
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/**
	 * `daedalus show <lens>` — the compiled-context chart for one lens: its identity plus every dredge
	 * slot, colour-coded by state ( grey off / blue on / green suggested, dim empty ), with per-component
	 * and total token counts. `--json` emits the `LensView` object.
	 */
	private static show( args: ParsedArgs ): void {
		const name = args.positionals[ 0 ];
		if ( !name ) {
			process.stderr.write( 'daedalus: show requires a lens name\n' );
			process.exit( 2 );
		}

		try {
			const view = VaultUtilities.lensView( this.vault(), name );
			if ( args.json ) this.emit( view );
			else this.renderLensView( view );
			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/**
	 * `daedalus survey` — reconnoitre the PROJECT the vault sits beside and write it as a JSON tree.
	 *
	 * The odd one out: every other command reads the vault ( the artifact store ), but a survey walks
	 * the PROJECT ROOT ( the code ). It flushes and refills <vault>/audits/survey/ — a roster plus one
	 * file per component — then prints the lean projection so a run both persists the artifact AND
	 * shows what it found. `--json` emits the full report to stdout instead of the projection ( survey
	 * is the one command whose primary payload is the structured object, not the human view ).
	 */
	private static survey( args: ParsedArgs ): void {
		try {
			const { projectRoot } = Config.resolve();
			const report  = Survey.run( projectRoot );
			const outAbs  = this.vault().toAbs( 'audits/survey' );
			const written = Survey.write( report, outAbs );

			if ( args.json ) {
				this.emit( report );
			} else {
				// The tree is the artifact; the projection is the receipt. Summary → stderr so stdout
				// stays the paste-ready orientation view.
				process.stderr.write( `surveyed ${ projectRoot } — ${ report.totals.components } components, ${ report.totals.files } files → ${ written.length } files in audits/survey/\n` );
				process.stdout.write( Survey.project( report ) + '\n' );
			}
			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	// ── Rendering ─────────────────────────────────────────────────────────────

	/** ANSI palette — applied only to a TTY, so piped/redirected output stays plain text. */
	private static readonly C = {
		reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
		grey:  '\x1b[90m', blue: '\x1b[94m', green: '\x1b[92m',
	};

	/** Wrap `s` in an ANSI code, but only when stdout is a terminal. */
	private static tint( code: string, s: string ): string {
		return process.stdout.isTTY ? code + s + this.C.reset : s;
	}

	/** The colour a slot state renders in: grey off, blue on, green suggested, dim empty. */
	private static stateColor( state: string ): string {
		if ( state === 'suggested' ) return this.C.green;
		if ( state === 'on' )        return this.C.blue;
		if ( state === 'off' )       return this.C.grey;
		return this.C.dim; // empty
	}

	/** The lens slot chart — a small, aligned, colour-coded table of the compiled-context breakdown. */
	private static renderLensView( view: LensView ): void {
		const fmt   = ( n: number ): string => n > 0 ? n.toLocaleString( 'en-US' ) : '—';
		const rows  = view.slots;

		// Column widths from the data ( headers included ), so the table fits its content exactly.
		const modeW = Math.max( 9, ...rows.map( r => r.state.length ) );         // 'suggested' = 9
		const compW = Math.max( 'COMPONENT'.length, ...rows.map( r => r.what.length ) );
		const kindW = Math.max( 'KIND'.length, ...rows.map( r => r.kind.length ) );
		const tokW  = Math.max( 'TOKENS'.length, ...rows.map( r => fmt( r.tokens ).length ) );
		const ruleW = 3 + modeW + 2 + compW + 2 + kindW + 2 + tokW;
		const rule  = this.tint( this.C.dim, '  ' + '─'.repeat( ruleW - 2 ) );

		const out: string[] = [];
		out.push( '' );
		out.push( '  ' + this.tint( this.C.bold, view.lens ) + this.tint( this.C.dim, '  ·  Lens' ) );
		out.push( '' );
		out.push( this.tint( this.C.dim,
			'   ' + 'MODE'.padEnd( modeW ) + '  ' + 'COMPONENT'.padEnd( compW ) + '  ' + 'KIND'.padEnd( kindW ) + '  ' + 'TOKENS'.padStart( tokW ) ) );
		out.push( rule );

		for ( const r of rows ) {
			const col  = this.stateColor( r.state );
			const mode = this.tint( col, r.state.padEnd( modeW ) );
			const comp = this.tint( col, r.what.padEnd( compW ) );
			const kind = this.tint( this.C.dim, r.kind.padEnd( kindW ) );
			const tok  = fmt( r.tokens ).padStart( tokW );
			out.push( '   ' + mode + '  ' + comp + '  ' + kind + '  ' + ( r.tokens > 0 ? tok : this.tint( this.C.dim, tok ) ) );
		}

		out.push( rule );

		// Tally by state ( coloured counts ), then the grand total.
		const count = ( s: string ): number => rows.filter( r => r.state === s ).length;
		const tally = ( [ 'suggested', 'on', 'off', 'empty' ] as const )
			.filter( s => count( s ) > 0 )
			.map( s => this.tint( this.stateColor( s ), `${ s } ${ count( s ) }` ) )
			.join( '   ' );
		out.push( '   ' + tally + this.tint( this.C.dim, `      total  ~${ view.tokens.toLocaleString( 'en-US' ) }` ) );
		out.push( '' );

		process.stdout.write( out.join( '\n' ) + '\n' );
	}

	/** Human-readable health output — issues grouped by artifact, then a one-line tally. */
	private static renderHealth( report: HealthReport, scope?: string ): void {
		const where = scope ? scope : 'vault';

		if ( report.issues.length === 0 ) {
			process.stdout.write( `✓ ${ where }: no issues\n` );
			return;
		}

		// Group by path so a reader scans per-artifact, not a flat wall of lines.
		const byPath = new Map<string, HealthReport['issues']>();
		for ( const issue of report.issues ) {
			const bucket = byPath.get( issue.path ) ?? [];
			bucket.push( issue );
			byPath.set( issue.path, bucket );
		}

		for ( const [ path, issues ] of byPath ) {
			process.stdout.write( `${ path }\n` );
			for ( const i of issues )
				process.stdout.write( `    ${ i.severity === 'error' ? 'error' : 'warn ' }  ${ i.message }\n` );
			process.stdout.write( '\n' );
		}

		const { total, errors, warnings } = report.summary;
		process.stdout.write( `${ total } issue${ total === 1 ? '' : 's' } across ${ byPath.size } file${ byPath.size === 1 ? '' : 's' } — ${ errors } error${ errors === 1 ? '' : 's' }, ${ warnings } warning${ warnings === 1 ? '' : 's' }\n` );
	}

	// ── Plumbing ──────────────────────────────────────────────────────────────

	/** The vault bound to the resolved config — the CLI's one-shot equivalent of MCPUtils.vault. */
	private static vault(): Vault {
		const { projectRoot, docRoot } = Config.resolve();
		return new Vault( projectRoot, docRoot );
	}

	/** Raw SDK object to stdout — the `--json` form. Data on stdout so `| jq` sees only payload. */
	private static emit( data: unknown ): void {
		process.stdout.write( JSON.stringify( data, null, 2 ) + '\n' );
	}

	/**
	 * argv → ParsedArgs. Deliberately hand-rolled and small: the first bare token is the command,
	 * later bare tokens are its positionals, and a short fixed set of flags is recognised. Value
	 * flags ( --root, --doc-root ) consume the following token; boolean flags ( --json, --help ) do
	 * not. Unknown `--flags` are ignored here rather than erroring, so a command can grow its own
	 * without a central schema to update.
	 */
	private static parse( argv: string[] ): ParsedArgs {
		const out: ParsedArgs = { command: '', positionals: [], json: false, help: false };

		for ( let i = 0; i < argv.length; i++ ) {
			const token = argv[ i ];

			if ( token === '--root'     ) { out.root    = argv[ ++i ]; continue; }
			if ( token === '--doc-root' ) { out.docRoot = argv[ ++i ]; continue; }
			if ( token === '--json'     ) { out.json    = true;        continue; }
			if ( token === '--help' || token === '-h' ) { out.help = true; continue; }

			if ( token.startsWith( '-' ) ) continue; // unknown flag — a command owns its own

			if ( !out.command ) out.command = token;
			else out.positionals.push( token );
		}

		return out;
	}

	private static printHelp(): void {
		process.stdout.write(
			'daedalus — a context compiler\n\n' +
			'Usage: daedalus <command> [options]\n\n' +
			'Commands:\n' +
			'  validate [path]   Validate one artifact, or the whole vault when no path is given.\n' +
			'  compile <lens...> Compile one or more lenses to a context string ( first = primary ).\n' +
			'  show <lens>       Chart one lens\'s compiled context — slots, states, token counts.\n' +
			'  survey            Reconnoitre the project beside the vault → a JSON tree in audits/survey/.\n\n' +
			'Options:\n' +
			'  --root <dir>      Project root the vault sits under ( default: inferred by walking up ).\n' +
			'  --doc-root <dir>  Doc root within the project ( default: the standard vault folder ).\n' +
			'  --json            Emit the raw result object instead of formatted lines.\n' +
			'  -h, --help        Show this help.\n\n' +
			'Exit codes: 0 = clean, 1 = errors found, 2 = usage error.\n'
		);
	}
}
