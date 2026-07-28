import * as path from 'path';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, cpSync, rmSync } from 'fs';
import { Vault, VaultUtilities, VaultDeploy, VaultLayout, Survey } from 'kcd_sdk';
import type { HealthReport, LensView, DeployReport, ArtifactRef, QueryOptions } from 'kcd_sdk';
import { Config } from '../Config';
import { Prompt } from './Prompt';
import { DaedalusServer } from '../server';

/** The seed carrier, vault-relative. Reached with `vault.toAbs()` and `existsSync` rather than
 *  `vault.exists()`, which takes an HREF ( project-root-relative, `_Claude/...` ) — passing a
 *  vault-relative path there resolves against the PROJECT root and is silently always false. That
 *  mistake skipped the whole host-seed step, unnoticed, until 2026-07-25. */
const ROOT_CONTEXT = 'root-context.html';

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

	static async run( argv: string[] ): Promise<void> {
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
			case 'mcp':
				return this.mcp( args );
			case 'doctor':
				return this.doctor( args );
			case 'maintain':
				return this.maintain( args );
			case 'reset':
				return this.reset( args );
			case 'query':
				return this.query( args );
			case 'links':
				return this.links( args );
			case 'seed':
				return this.seed( args );
			case 'lens-index':
				return this.lensIndex( args );
			case 'init':
				return this.init( args );
			case 'clear':
				return this.clear( args );
			case 'get-started':
				return this.getStarted( args );
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

	/**
	 * `daedalus init [confirm]` — the whole onboarding flow, one command: detect the shape, deploy
	 * the vault in place, extract every host seed found, register the MCP for Claude Code, and run
	 * the survey. No `confirm` previews every step and writes nothing, same convention as
	 * `maintain`/`reset`/`seed`.
	 *
	 * NO ROLLBACK ( Bryan, 2026-07-25 ): every step below is independently idempotent — re-running
	 * `init` on a partially-completed install fills only what is still missing, exactly like
	 * `VaultDeploy` already does. A failed or interrupted run is repaired by running it again, never
	 * by unwinding it.
	 *
	 * PREFLIGHT: an INFERRED root above the working directory means an ancestor already has a vault
	 * — almost certainly not what running `init` from a subfolder meant. Refuses rather than quietly
	 * repairing the wrong project; `--root .` forces a new vault at the actual working directory.
	 */
	/**
	 * `daedalus clear [all] [confirm]` — take the install back out.
	 *
	 * A COURTESY, and a trust argument. An installer that cannot uninstall asks a stranger to make an
	 * irreversible change to their repository on first acquaintance; being able to point at this
	 * command is most of why `init` is an easy yes.
	 *
	 * It removes WHAT THE INSTALL ADDED AND NOTHING ELSE — this is subtraction, never `rm -rf`:
	 *
	 *   • host entry files  the managed block only; the project's own instructions stay, and the file
	 *                       is deleted only when our block was its entire content
	 *   • .mcp.json         our `daedalus` entry only; other registered servers are untouched, and the
	 *                       file survives unless it is left holding nothing
	 *   • .claude/skills/   only bundled skills that are still byte-identical to what we shipped. A
	 *                       skill you edited is YOURS and is kept, with a line saying so
	 *   • .gitignore        our managed block only
	 *
	 * THE VAULT IS NOT TOUCHED without `all`. By the time anyone runs this, `_Claude/` holds lenses
	 * and references somebody wrote — deleting a knowledge store as the default reading of "clear"
	 * would be indefensible. `all` adds it, and says how many artifacts are at stake first.
	 */
	private static async clear( args: ParsedArgs ): Promise<void> {
		const withVault = args.positionals.includes( 'all' );
		let   confirm   = args.positionals.includes( 'confirm' );
		const { projectRoot, docRoot } = Config.resolve();
		const vault = new Vault( projectRoot, docRoot );

		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'daedalus clear' ) } — ${ confirm ? 'removing' : 'PREVIEW ( nothing will be removed )' }\n` +
			`project: ${ projectRoot }\n\n` +
			'Removes what the install added, and nothing else. Anything you wrote or edited stays.\n'
		);

		// 1 -- host entry files. Preview and apply run the same call; only `confirm` writes.
		const removals: { label: string; detail: string }[] = [];
		const kept:     string[] = [];

		if ( existsSync( vault.toAbs( ROOT_CONTEXT ) ) ) {
			for ( const seed of VaultUtilities.parseSeeds( vault ) ) {
				const r = VaultUtilities.removeSeed( projectRoot, seed, { confirm } );
				if ( r.changed ) removals.push( { label: r.target, detail: r.fileRemoved ? 'file removed ( it held only our block )' : 'managed block removed, your content kept' } );
			}
		}

		// 2 -- our MCP registration, never anyone else's.
		const mcpPath = path.join( projectRoot, '.mcp.json' );
		if ( existsSync( mcpPath ) ) {
			try {
				const doc = JSON.parse( readFileSync( mcpPath, 'utf-8' ) ) as { mcpServers?: Record<string, unknown> };
				if ( doc.mcpServers?.[ 'daedalus' ] ) {
					delete doc.mcpServers[ 'daedalus' ];
					const empty = Object.keys( doc.mcpServers ).length === 0 && Object.keys( doc ).length === 1;
					removals.push( { label: '.mcp.json', detail: empty ? 'file removed ( no other servers registered )' : `daedalus entry removed, ${ Object.keys( doc.mcpServers ).length } other server(s) kept` } );
					if ( confirm ) {
						if ( empty ) rmSync( mcpPath );
						else writeFileSync( mcpPath, JSON.stringify( doc, null, 2 ) + '\n', 'utf-8' );
					}
				}
			} catch {
				kept.push( '.mcp.json — not valid JSON, left alone rather than guessed at' );
			}
		}

		// 3 -- bundled skills, but only the ones still exactly as shipped. An edited skill is the
		// user's work now and outlives the tool that delivered it.
		const skillsSrc = this.skillsRoot();
		if ( existsSync( skillsSrc ) ) {
			for ( const name of readdirSync( skillsSrc ) ) {
				if ( !statSync( path.join( skillsSrc, name ) ).isDirectory() ) continue;
				const dest = path.join( projectRoot, '.claude', 'skills', name );
				if ( !existsSync( dest ) ) continue;

				if ( this.dirsMatch( path.join( skillsSrc, name ), dest ) ) {
					removals.push( { label: `.claude/skills/${ name }`, detail: 'unchanged since install' } );
					if ( confirm ) rmSync( dest, { recursive: true } );
				} else {
					kept.push( `.claude/skills/${ name } — you edited it, so it stays` );
				}
			}
		}

		// 4 -- our .gitignore block.
		const ig = VaultUtilities.gitignore( projectRoot, docRoot, 'none', { confirm } );
		if ( ig.changed ) removals.push( { label: '.gitignore', detail: 'managed block removed' } );

		// 5 -- the vault, only when asked, and only after saying what it costs.
		const vaultAbs = path.join( projectRoot, docRoot );
		if ( existsSync( vaultAbs ) ) {
			let count = 0;
			try { count = vault.scan().length; } catch { count = 0; }
			if ( withVault ) {
				removals.push( { label: `${ docRoot }/`, detail: `the whole vault — ${ count } artifact(s), including anything you authored` } );
				if ( confirm ) rmSync( vaultAbs, { recursive: true } );
			} else {
				kept.push( `${ docRoot }/ — ${ count } artifact(s) kept. Re-run as "daedalus clear all" to remove the vault too` );
			}
		}

		if ( removals.length === 0 && kept.length === 0 ) {
			process.stdout.write( '\nNothing to remove — this project has no daedalus install.\n\n' );
			process.exit( 0 );
		}

		if ( removals.length ) {
			process.stdout.write( `\n${ this.tint( this.C.bold, confirm ? 'Removed' : 'Would remove' ) }\n` );
			for ( const r of removals ) process.stdout.write( `  ${ confirm ? '✓' : '·' } ${ r.label.padEnd( 26 ) } ${ this.tint( this.C.dim, r.detail ) }\n` );
		}
		if ( kept.length ) {
			process.stdout.write( `\n${ this.tint( this.C.bold, 'Kept' ) }\n` );
			for ( const k of kept ) process.stdout.write( `  · ${ k }\n` );
		}

		if ( !confirm && removals.length ) {
			// Offer it directly when someone is watching; fall back to the printed command when not.
			confirm = await Prompt.confirm( 'Remove these now?', false, 'Nothing has been removed yet.' );
			Prompt.close();
			if ( confirm ) return this.clear( { ...args, positionals: [ ...args.positionals, 'confirm' ] } );
			process.stdout.write( `\n${ this.tint( this.C.bold, 'Nothing was removed.' ) } To go ahead:\n\n    daedalus clear${ withVault ? ' all' : '' } confirm\n\n` );
		} else {
			process.stdout.write( '\n' );
		}
		process.exit( 0 );
	}

	/** Byte-for-byte directory comparison — the "is this still exactly what we shipped?" test that
	 *  lets `clear` delete a bundled skill without ever deleting an edited one. */
	private static dirsMatch( a: string, b: string ): boolean {
		const listing = ( dir: string ): string[] => readdirSync( dir ).sort();
		const an = listing( a );
		const bn = listing( b );
		if ( an.length !== bn.length || an.some( ( n, i ) => n !== bn[ i ] ) ) return false;

		for ( const name of an ) {
			const ap = path.join( a, name );
			const bp = path.join( b, name );
			const ad = statSync( ap ).isDirectory();
			if ( ad !== statSync( bp ).isDirectory() ) return false;
			if ( ad ) {
				if ( !this.dirsMatch( ap, bp ) ) return false;
			} else if ( readFileSync( ap, 'utf-8' ) !== readFileSync( bp, 'utf-8' ) ) {
				return false;
			}
		}
		return true;
	}

	private static async init( args: ParsedArgs ): Promise<void> {
		let   confirm = args.positionals.includes( 'confirm' );
		const cwd     = path.resolve( process.cwd() );
		let   before  = Config.resolve();

		// PREFLIGHT 1 — Node, checked BEFORE acting rather than after. `doctor` also checks it, but a
		// user reaches `doctor` only once installed, which is the wrong end of the sequence for a
		// prerequisite ( install-map finding 6 ).
		if ( !this.nodeOk() ) {
			process.stderr.write(
				`daedalus: Node ${ this.NODE_MIN } or newer is required — this is v${ process.versions.node }.\n` +
				'the bundled server uses syntax older runtimes cannot parse; upgrade Node, then re-run init.\n'
			);
			process.exit( 2 );
		}

		// PREFLIGHT 2 — an INFERRED root above the working directory means an ancestor already has a
		// vault, almost certainly not what running `init` from a subfolder meant.
		if ( before.source.projectRoot === 'inferred' && path.resolve( before.projectRoot ) !== cwd ) {
			process.stderr.write(
				`daedalus: found an existing vault at "${ before.projectRoot }", above this directory.\n` +
				'if you meant to create a new one HERE, re-run with --root .\n'
			);
			process.exit( 2 );
		}

		// PREFLIGHT 3 — ANCHOR ON THE HOST ENTRY FILE ( Bryan, 2026-07-26 ). A repo that already has a
		// CLAUDE.md has already chosen where agents are configured for it, and that folder is the
		// project root as far as every agent is concerned. Installing the vault somewhere else would
		// create a second, competing agent-config location in the same repository.
		//
		// This ADOPTS rather than refuses ( unlike preflight 2 ), because there is no ambiguity about
		// intent here — but it says so in full, and `init` previews by default, so the relocation is
		// on screen before anything is written. The marker filenames are read from the BUNDLE's seed
		// declarations, never hardcoded: see `hostMarkers()`.
		let adoptedFrom: string | null = null;
		if ( !args.root ) {
			const marker = this.markerRoot( cwd );
			if ( marker && marker !== path.resolve( before.projectRoot ) ) {
				adoptedFrom = marker;
				Config.override( { projectRoot: marker, docRoot: args.docRoot } );
				before = Config.resolve();
			}
		}

		const { projectRoot, docRoot } = before;
		const substrateSource = this.substrateRoot();
		const vault = new Vault( projectRoot, docRoot );

		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'daedalus init' ) } — ${ confirm ? 'installing' : 'PREVIEW ( nothing will be written )' }\n` +
			`project: ${ projectRoot }\n\n` +
			'This installs a KCD vault beside your code. It moves none of your files and\n' +
			'overwrites nothing you have edited — every step below fills only what is missing,\n' +
			'so running it twice repairs rather than duplicates.\n\n'
		);

		if ( adoptedFrom ) {
			process.stdout.write(
				`${ this.tint( this.C.bold, 'Installing one level up, not here.' ) }\n` +
				`   ${ adoptedFrom } already has an agent entry point ( ${ this.hostMarkers().join( ', ' ) } ),\n` +
				'   so that is where this repository configures agents, and the vault belongs beside it.\n' +
				'   One vault per repository is the rule — the LENS is the per-component unit, not the vault.\n' +
				`   To install in ${ cwd } instead, re-run with ${ this.tint( this.C.bold, '--root .' ) }\n\n`
			);
		}

		// ── The stepper ───────────────────────────────────────────────────────────
		//
		// Ask, then act — rather than printing a wall of text and hoping it is read. Every question
		// carries WHY it is being asked, so configuring the install is also the first lesson in what
		// the pieces are. That is the same principle the configuration walkthrough is built on: the
		// questions ARE the curriculum.
		//
		// ORDER IS THE POINT ( Bryan, 2026-07-28 ). The FIRST question is the whole shape — here is
		// the tree we would build beside your code; is that acceptable? Every question after it
		// refines an answer already given. Asking about MCP registration before anyone has agreed to
		// the structure inverts the decision, and a stranger who would have said no has to sit
		// through four questions before reaching the one they cared about.
		//
		// The questionnaire runs only when someone is actually there to answer ( `Prompt.interactive`
		// requires a TTY at both ends ) and only when `confirm` was not already given. Scripted,
		// piped, or agent-driven runs take every default and behave exactly as before, so nothing
		// here can wedge an unattended install.
		const hosts = this.hostMarkers();
		const choices = {
			hosts:  hosts,
			mcp:    true,
			skills: true,
			ignore: 'none' as 'scratch' | 'vault' | 'none'
		};

		// Git is DETECTED, never assumed. Outside a working tree the ignore question has no meaning,
		// and asking it anyway is the kind of question that teaches a user the installer is not
		// paying attention to their project.
		const gitRoot  = this.gitRoot( projectRoot );
		const stepping = Prompt.interactive && !confirm;

		// SAY WHICH MODE THIS IS. Falling back to defaults without a word is correct behaviour and
		// an awful experience: someone expecting to be asked, run through an agent or a pipe, just
		// sees the install happen and cannot tell whether the questions are broken or absent.
		if ( !stepping && !confirm ) {
			process.stdout.write(
				`${ this.tint( this.C.dim, 'non-interactive ( no terminal attached ) — using defaults for every choice.' ) }\n` +
				`${ this.tint( this.C.dim, 'Run `daedalus init` yourself in a terminal to be asked instead.' ) }\n\n`
			);
		}

		if ( stepping ) {
			// Six steps in a repository, five outside one. The counter is derived rather than
			// written down twice, so "step 5/6" can never disagree with how many questions arrive.
			const total = gitRoot ? 6 : 5;
			let   count = 0;
			const step  = ( title: string ): void => Prompt.step( ++count, total, title );

			// STEP 1 — THE SHAPE. The one question a stranger actually has on first contact, asked
			// before any of the detail questions that only make sense once it is answered yes.
			step( 'What gets created' );
			process.stdout.write(
				'\n  Everything KCD governs lives in ONE folder beside your code. Alongside it go two\n' +
				'  or three small files at your project root that point your agent at that folder.\n' +
				'  Nothing of yours is moved, renamed, or overwritten.\n\n'
			);
			process.stdout.write( this.installTree( projectRoot, docRoot, choices, true ) );
			if ( !( await Prompt.confirm(
				`Create this in ${ projectRoot }?`,
				true,
				'The steps after this one trim the root files. Nothing has been written yet.'
			) ) ) {
				Prompt.close();
				process.stdout.write(
					`\n${ this.tint( this.C.bold, 'Nothing was written.' ) } ` +
					`Run ${ this.tint( this.C.bold, 'daedalus init' ) } again whenever you like.\n\n`
				);
				process.exit( 0 );
			}

			step( 'Agent entry points' );
			choices.hosts = await Prompt.multiselect(
				'Which agents should be pointed at this vault?',
				hosts.map( ( h ) => ( {
					label: h,
					note:  h.startsWith( 'CLAUDE' ) ? 'Claude Code' : h.startsWith( 'AGENTS' ) ? 'Codex and others' : h.startsWith( 'GEMINI' ) ? 'Gemini' : '',
					value: h
				} ) ),
				hosts.map( ( _h, i ) => i ),
				'A small managed block is added at the top of each. Your own content is kept below it.'
			);

			// Show them the actual edit to a file they already own, before making it. These are files
			// a developer has opinions about; "a managed block is added" is a promise, and showing
			// the block is the evidence for it.
			step( 'What goes in your entry files' );
			const seeds = this.hostSeeds().filter( ( s ) => choices.hosts.includes( s.target ) );
			for ( const s of seeds ) {
				const abs      = path.join( projectRoot, s.target );
				const present  = existsSync( abs );
				const ownsText = present && this.hasOwnContent( abs );
				process.stdout.write(
					`\n  ${ this.tint( this.C.bold, s.target ) } — ` +
					( !present ? 'does not exist yet, will be created'
						: ownsText ? this.tint( this.C.blue, 'already exists and has your own content — it is kept, in full, below our block' )
						: 'already exists' ) + '\n'
				);
			}
			if ( seeds.length ) {
				const sample = seeds[ 0 ].payload.split( '\n' ).slice( 0, 5 );
				process.stdout.write(
					`\n  ${ this.tint( this.C.dim, 'The block added at the top, between markers we own and only ever rewrite between:' ) }\n` +
					`  ${ this.tint( this.C.dim, '<!-- kcd:begin -->' ) }\n` +
					sample.map( ( l ) => `  ${ this.tint( this.C.dim, l.length > 74 ? l.slice( 0, 73 ) + '…' : l ) }` ).join( '\n' ) + '\n' +
					`  ${ this.tint( this.C.dim, `… ${ Math.max( 0, seeds[ 0 ].payload.split( '\n' ).length - 5 ) } more lines` ) }\n` +
					`  ${ this.tint( this.C.dim, '<!-- kcd:end -->' ) }\n`
				);
			}
			if ( !( await Prompt.confirm( 'Happy with that?', true, 'Answer no to stop; nothing has been written.' ) ) ) {
				Prompt.close();
				process.stdout.write( `\n${ this.tint( this.C.bold, 'Nothing was written.' ) }\n\n` );
				process.exit( 0 );
			}

			step( 'The MCP server' );
			choices.mcp = await Prompt.confirm(
				'Register the daedalus MCP server in .mcp.json?',
				true,
				'This is what gives your agent the kcd_* tools. Without it the vault is just files.'
			);

			step( 'Bundled skills' );
			choices.skills = await Prompt.confirm(
				'Install the bundled skills into .claude/skills/?',
				true,
				'kcd-onboard walks you through turning a fresh vault into one about YOUR project.'
			);

			// Only inside a working tree. This is the one moment the question is genuinely useful —
			// immediately after agreeing to write six paths into a version-controlled repository —
			// and it is the ONLY moment we ask: see the note on the apply step below.
			if ( gitRoot ) {
				step( 'Git' );
				process.stdout.write(
					`\n  ${ this.tint( this.C.dim, `This is a git repository ( ${ gitRoot } ).` ) }\n`
				);
				choices.ignore = await Prompt.select<'scratch' | 'vault' | 'none'>(
					'Should this go into your repository, or be ignored?',
					[
						{ label: 'Commit the vault, ignore its scratch dirs', note: 'recommended', value: 'scratch' },
						{ label: 'Commit everything',                         note: 'nothing added to .gitignore', value: 'none' },
						{ label: 'Ignore the whole vault',                    note: 'try it without touching your repo', value: 'vault' }
					],
					0,
					'The vault is project knowledge and is usually worth committing — it is how a team shares\n  the context. audits/ and work/ are regenerable churn and rarely are.'
				);
			}

			const summary =
				`\n${ this.tint( this.C.bold, 'Ready to install' ) }\n` +
				`  project        ${ before.projectRoot }\n` +
				`  vault          ${ before.docRoot }/\n` +
				`  entry points   ${ choices.hosts.length ? choices.hosts.join( ', ' ) : 'none' }\n` +
				`  MCP server     ${ choices.mcp ? 'registered in .mcp.json' : 'skipped' }\n` +
				`  skills         ${ choices.skills ? 'installed' : 'skipped' }\n` +
				( gitRoot
					? `  .gitignore     ${ choices.ignore === 'none' ? 'untouched' : choices.ignore === 'vault' ? 'whole vault ignored' : 'scratch dirs ignored' }\n`
					: '' );
			process.stdout.write( summary );

			confirm = await Prompt.confirm( 'Install now?', true, 'Nothing has been written yet.' );
			Prompt.close();
			if ( !confirm ) {
				process.stdout.write( `\n${ this.tint( this.C.bold, 'Nothing was written.' ) } Run ${ this.tint( this.C.bold, 'daedalus init' ) } again whenever you like.\n\n` );
				process.exit( 0 );
			}
		}

		// 1. Deploy — the same idempotent fill `maintain fill` uses; `inspect` alone in preview.
		const deployBefore = VaultDeploy.inspect( projectRoot, { docRoot, substrateSource } );
		const shape = deployBefore.items.some( ( i ) => i.present ) ? 'repairing' : 'creating';
		process.stdout.write(
			// No number. The stepper above owns the numbering ( "step 3/5" ); a second 1..4 sequence
			// running underneath it reads as two competing progress bars.
			`${ this.tint( this.C.bold, 'The vault' ) } — ${ shape }, ${ deployBefore.missing } item(s) to fill\n\n`
		);
		// Drawn ONCE. Step 1 is the tree when someone is being stepped through; drawing it again here
		// reads as two different pictures of the same thing and invites a hunt for the difference.
		if ( !stepping ) process.stdout.write( this.installTree( projectRoot, docRoot, choices ) );

		const deployed = confirm ? VaultDeploy.apply( projectRoot, { docRoot, substrateSource } ) : deployBefore;
		const filled   = deployed.items.filter( ( i ) => !i.present ).length;
		process.stdout.write( `\n  ${ confirm ? '✓' : '·' } ${ confirm ? 'filled' : 'would fill' } ${ filled } item(s) from the bundled floor. The rest is yours to grow.\n` );

		// 2. Host seeds — only meaningful once root-context.html actually exists: a truly fresh
		// install has nothing to preview until step 1 has run for real.
		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'Agent entry points' ) }\n` +
			'   Anything already in those files is kept — the block goes above it, between markers,\n' +
			'   and only what is between them is ever rewritten.\n'
		);
		if ( existsSync( vault.toAbs( ROOT_CONTEXT ) ) ) {
			// Only the hosts that were asked for. A seed the user declined is not written and not
			// reported as pending — it was a choice, not an omission.
			const seeds   = VaultUtilities.parseSeeds( vault ).filter( ( s ) => choices.hosts.includes( s.target ) );
			const reports = seeds.map( ( s ) => VaultUtilities.applySeed( projectRoot, s, { confirm } ) );
			if ( seeds.length === 0 ) process.stdout.write( '  seed     — none selected\n' );
			for ( const r of reports ) {
				const state = !r.targetExisted ? 'creates' : !r.changed ? 'current' : r.applied ? 'updated' : 'pending';
				process.stdout.write( `  seed     ${ r.target.padEnd( 12 ) } ( ${ r.host } ) — ${ state }\n` );
			}

			// A host file that ALREADY instructs agents is mechanically safe — the managed block goes
			// above it and nothing of theirs is destroyed — but it is a SEMANTIC conflict nobody was
			// surfacing ( install-map judgment gap 3 ): two sets of live instructions in one file,
			// free to disagree, and the agent reads both. Mechanical check, human response, which is
			// exactly the shape the map said to prefer code for.
			const conflicts = reports
				.filter( ( r ) => r.mode === 'prepend' && r.targetExisted )
				.filter( ( r ) => this.hasOwnContent( path.join( projectRoot, r.target ) ) )
				.map( ( r ) => r.target );
			if ( conflicts.length ) {
				process.stdout.write(
					`\n  ${ this.tint( this.C.bold, 'Worth reading before you trust it:' ) } ${ conflicts.join( ', ' ) } already instructed your agent.\n` +
					'  Nothing of yours was touched — the KCD block sits above what was already there. But\n' +
					'  both halves are live now, and if they disagree the agent has no way to know which\n' +
					'  wins. Read the merged file once and delete whichever half is stale.\n'
				);
			}
		} else {
			// A preview against a project with no vault yet: root-context.html is the SOURCE these are
			// generated from, and it arrives in the step above. Phrased as sequence, not failure.
			process.stdout.write( `  ${ this.tint( this.C.dim, 'written once the vault above exists — re-run with "confirm" and they land together' ) }\n` );
		}

		// 3. MCP registration — Claude Code only ( Bryan, 2026-07-25: no generic host abstraction ).
		// A malformed existing .mcp.json is a PREFLIGHT failure, never silently overwritten.
		const mcpPath = path.join( projectRoot, '.mcp.json' );
		let mcpDoc: { mcpServers?: Record<string, unknown> } = {};
		if ( existsSync( mcpPath ) ) {
			try {
				mcpDoc = JSON.parse( readFileSync( mcpPath, 'utf-8' ) );
			} catch {
				process.stderr.write( `daedalus: "${ mcpPath }" is not valid JSON — fix or remove it, then re-run init\n` );
				process.exit( 2 );
			}
		}
		const entry = { command: 'node', args: [ path.join( this.packageRoot(), 'dist', 'index.js' ) ] };
		const already = mcpDoc.mcpServers?.[ 'daedalus' ];
		const mcpChanged = choices.mcp && JSON.stringify( already ) !== JSON.stringify( entry );
		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'The MCP server' ) } — .mcp.json: ${ !choices.mcp ? 'skipped' : !already ? 'registers' : mcpChanged ? 'updates' : 'already current' }\n` +
			'   Gives your agent the kcd_* tools. Any other server you have registered is left alone.\n'
		);
		if ( confirm && mcpChanged ) {
			mcpDoc.mcpServers = { ...mcpDoc.mcpServers, daedalus: entry };
			writeFileSync( mcpPath, JSON.stringify( mcpDoc, null, 2 ) + '\n', 'utf-8' );
		}

		// 4. Bundled skills ( 2.e ) — installed into .claude/skills/, discoverable on the NEXT
		// session, same as the MCP registration. Never overwrites a user's own skill of the same
		// name — a skill directory is theirs to edit once it exists.
		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'Skills' ) }\n` +
			'   A skill already there is never overwritten — once it exists it is yours to edit.\n'
		);
		const skillsSrc = this.skillsRoot();
		if ( !choices.skills ) {
			process.stdout.write( '  skill    — skipped\n' );
		} else if ( existsSync( skillsSrc ) ) {
			for ( const name of readdirSync( skillsSrc ) ) {
				const src = path.join( skillsSrc, name );
				if ( !statSync( src ).isDirectory() ) continue;
				const dest    = path.join( projectRoot, '.claude', 'skills', name );
				const present = existsSync( dest );
				process.stdout.write( `  skill    ${ name.padEnd( 12 ) } — ${ present ? 'already present' : confirm ? 'installs' : 'would install' }\n` );
				if ( !present && confirm ) {
					mkdirSync( path.dirname( dest ), { recursive: true } );
					cpSync( src, dest, { recursive: true } );
				}
			}
		}

		// What landed in THEIR repository, stated plainly — these are version-controlled paths and the
		// commit-or-ignore question is a real decision nobody was raising ( install-map finding 4 ).
		// The tree above already showed WHAT lands where, so this is only the commit decision — the
		// question the tree raises and cannot answer.
		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'In your repository' ) }\n` +
			'   None of the above is generated noise, so the usual answer is "commit it" — the vault is\n' +
			`   project knowledge and committing it is how a team shares the context. Only ${ docRoot }/audits\n` +
			`   and ${ docRoot }/work are regenerable churn.\n`
		);

		// THE QUESTION, asked rather than assumed. `audits/` and `work/` are regenerable churn and
		// carrying them in history is nobody's intent; the rest of the vault IS project knowledge. And
		// for someone who wants to try this without touching their repo at all, `vault` is the whole
		// answer — this is what replaced "workspace mode" ( ruled 2026-07-26 ), because a vault outside
		// the repository breaks `inferProjectRoot` and is an alternate topology, whereas the concern
		// behind it is three lines in a file.
		//
		// THERE IS NO `daedalus gitignore` COMMAND ( Bryan, 2026-07-28 ). Maintaining a .gitignore is
		// something every developer already knows how to do, and owning a command for it bloats the
		// surface with a chore that was never ours. We offer it once, at the one moment it is actually
		// useful — right as six paths land in their repository — and after that the file is theirs
		// like every other line in it. Outside the stepper we write nothing uninvited and print the
		// lines instead, which is the same courtesy without the presumption.
		if ( !gitRoot ) {
			// Not a working tree. No question to ask, and no file to speak for.
		} else if ( stepping && choices.ignore !== 'none' ) {
			const ig = VaultUtilities.gitignore( projectRoot, docRoot, choices.ignore, { confirm } );
			process.stdout.write(
				`\n${ this.tint( this.C.bold, 'Git' ) } — .gitignore: ${ ig.changed ? ( ig.applied ? 'updated' : 'would change' ) : 'already current' }\n`
			);
			for ( const e of ig.entries ) process.stdout.write( `  ${ ig.applied ? '✓' : '·' } ${ e }\n` );
		} else if ( !stepping ) {
			const scratch = VaultUtilities.gitignore( projectRoot, docRoot, 'scratch' );
			process.stdout.write(
				`\n${ this.tint( this.C.bold, 'Git' ) } — .gitignore: ${ scratch.hadManagedBlock ? 'already carries a kcd block' : 'untouched' }\n` +
				'   Nothing is written there unless you ask for it. If you want the regenerable churn\n' +
				'   kept out of history, these are the lines — yours to add, move, or ignore:\n\n' +
				scratch.entries.map( ( e ) => `       ${ e }\n` ).join( '' ) +
				`\n   Or ignore ${ docRoot }/ outright to try this without touching your repository at all.\n`
			);
		}

		if ( !confirm ) {
			process.stdout.write( `\n${ this.tint( this.C.bold, 'Nothing was written.' ) } Re-run to install:\n\n    daedalus init confirm\n\n` );
			process.exit( 0 );
		}

		// THE STEP EVERYTHING ELSE DEPENDS ON. `.mcp.json` and `.claude/skills/` are read when an
		// agent session STARTS — until it restarts, the tools and skills this install just registered
		// do not exist, and a correct install looks broken. It was entirely unstated before
		// 2026-07-25 ( install-map finding 1 ), and is the likeliest first-run failure there is.
		process.stdout.write(
			`\n${ this.tint( this.C.green, '✓ Installed.' ) } ${ this.tint( this.C.bold, 'One more step — this one matters:' ) }\n\n` +
			'   Your agent reads .mcp.json and .claude/skills/ only when a session STARTS.\n' +
			'   The tools just registered do not exist in your current session. Restart it —\n' +
			'   exit your agent and open it again in this directory — then run:\n\n' +
			`       ${ this.tint( this.C.bold, 'daedalus get-started' ) }\n\n` +
			'   That surveys your project and hands you a prompt to paste in, so you can watch the\n' +
			'   tools work against your own code before trusting them with anything.\n\n' +
			`   ${ this.tint( this.C.dim, 'Changed your mind? `daedalus clear` removes everything this added and nothing else.' ) }\n\n`
		);
		process.exit( 0 );
	}

	/**
	 * `daedalus get-started` — everything that only makes sense AFTER the agent session has restarted,
	 * split out of `init` for exactly that reason ( Bryan, 2026-07-25 ): a physical install and the
	 * things that depend on a live MCP connection are two different moments, and pretending they are
	 * one is what made the restart step invisible.
	 *
	 * Runs the survey — deliberately HERE rather than in `init`, because its real consumer is the
	 * agent that is only now able to read it — then prints a verification prompt built from what the
	 * survey actually found. A live test the user can watch, not an assurance they have to take.
	 */
	private static getStarted( args: ParsedArgs ): void {
		const { projectRoot, docRoot } = Config.resolve();
		const vault = new Vault( projectRoot, docRoot );

		if ( !existsSync( vault.toAbs( ROOT_CONTEXT ) ) ) {
			process.stderr.write(
				`daedalus: no vault found at ${ path.join( projectRoot, docRoot ) }.\n` +
				'run "daedalus init confirm" first.\n'
			);
			process.exit( 2 );
		}

		const report  = Survey.run( projectRoot );
		const written = Survey.write( report, vault.toAbs( 'audits/survey' ) );

		if ( args.json ) { this.emit( report ); process.exit( 0 ); }

		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'daedalus get-started' ) }\n` +
			`project: ${ projectRoot }\n\n` +
			`${ this.tint( this.C.bold, 'Surveyed your project' ) } — ${ report.totals.components } component(s), ` +
			`${ report.totals.files } file(s) → ${ written.length } file(s) in ${ docRoot }/audits/survey/\n` +
			'   A factual census of your code: components, languages, entry points. Everything an\n' +
			'   agent authors from here is anchored to this file rather than to guesswork.\n'
		);

		const named = report.components.slice( 0, 4 ).map( ( c ) => c.name ).filter( Boolean );
		if ( named.length ) process.stdout.write( `   Found: ${ named.join( ', ' ) }${ report.totals.components > named.length ? ', …' : '' }\n` );

		// The live test. Deliberately phrased so it FAILS VISIBLY if the session was not restarted —
		// an agent without the tools will say it has no kcd_health, which is the exact diagnostic the
		// user needs, rather than a vague "something is wrong".
		process.stdout.write(
			`\n${ this.tint( this.C.bold, 'Now check it works.' ) } Paste this to your agent:\n\n` +
			'───────────────────────────────────────────────────────────────────────\n' +
			'Use the kcd_health tool to check this project\'s vault, and kcd_query to\n' +
			'list what artifact types it holds. Then read the survey roster at\n' +
			`${ docRoot }/audits/survey/index.json and tell me, in a few lines, what\n` +
			'this project is made of. If you do not have tools whose names start with\n' +
			'kcd_, say so plainly instead of guessing — it means the session needs a\n' +
			'restart to pick them up.\n' +
			'───────────────────────────────────────────────────────────────────────\n\n' +
			'   A healthy answer names your real components and reports 0 errors. If the agent says\n' +
			'   it has no kcd_ tools, the session has not restarted yet — restart and paste it again.\n\n' +
			`${ this.tint( this.C.bold, 'Then build your vault:' ) } ask your agent to use the ${ this.tint( this.C.bold, 'kcd-onboard' ) } skill.\n` +
			'   It reads the survey and walks you through authoring lenses for this project.\n\n'
		);
		process.exit( 0 );
	}

	/**
	 * `daedalus query [json-filter]` — the CLI face of `kcd_query`, closing the gap 1.i flagged
	 * ( it was the one tool with no CLI counterpart ). The filter set ( glob/type/text/groupBy )
	 * is a small JSON object, matching `mcp call`'s own json-args idiom — one option among several
	 * and rarely all set at once is the honest shape, not worth growing the shared flag parser for.
	 */
	private static query( args: ParsedArgs ): void {
		let opts: QueryOptions = {};
		const raw = args.positionals[ 0 ];
		if ( raw ) {
			try {
				opts = JSON.parse( raw );
			} catch {
				process.stderr.write( 'daedalus: query filter must be valid JSON\n' );
				process.exit( 2 );
			}
		}

		try {
			const result = VaultUtilities.query( this.vault(), opts );
			if ( args.json ) { this.emit( result ); process.exit( 0 ); }

			if ( opts.groupBy === 'type' ) {
				for ( const row of result as { type: string; count: number }[] )
					process.stdout.write( `${ String( row.count ).padStart( 4 ) }  ${ row.type }\n` );
			} else {
				for ( const ref of result as ArtifactRef[] )
					process.stdout.write( `${ ref.type.padEnd( 10 ) } ${ ref.path }\n` );
			}
			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/** `daedalus links <path>` — the CLI face of `kcd_links`, same gap, same fix. */
	private static links( args: ParsedArgs ): void {
		const target = args.positionals[ 0 ];
		if ( !target ) {
			process.stderr.write( 'daedalus: links requires a vault-relative path\n' );
			process.exit( 2 );
		}

		try {
			const result = VaultUtilities.links( this.vault(), target );
			if ( args.json ) { this.emit( result ); process.exit( 0 ); }

			process.stdout.write( `outbound ( ${ result.outbound.length } )\n` );
			for ( const l of result.outbound ) process.stdout.write( `  ${ l.type.padEnd( 8 ) } ${ l.href }\n` );

			if ( result.addresses.length > 0 ) {
				process.stdout.write( `\naddresses ( ${ result.addresses.length } )\n` );
				for ( const a of result.addresses ) process.stdout.write( `  ${ a.occupied ? 'occupied' : 'vacant  ' } ${ a.value }\n` );
			}

			process.stdout.write( `\ninbound ( ${ result.inbound.length } )\n` );
			for ( const i of result.inbound ) process.stdout.write( `  ${ i.path }\n` );

			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/**
	 * `daedalus seed [host] [confirm]` — extract §10 seed payloads from `root-context.html` into
	 * their targets ( `CLAUDE.md` and siblings ). No host = every seed found; a host name filters to
	 * one. No `confirm` only reports what would change — same preview-then-confirm shape as
	 * `maintain`/`reset`, and for the same reason: these are project-root files outside the vault,
	 * two of which ( `CLAUDE.md`, and the entry document `lens-index` writes to ) are hard-rule
	 * protected.
	 */
	private static seed( args: ParsedArgs ): void {
		const confirm    = args.positionals.includes( 'confirm' );
		const hostFilter = args.positionals.find( p => p !== 'confirm' );

		try {
			const { projectRoot } = Config.resolve();
			const seeds = VaultUtilities.parseSeeds( this.vault() )
				.filter( s => !hostFilter || s.host === hostFilter );

			if ( seeds.length === 0 ) {
				process.stderr.write( 'daedalus: no seed blocks found ( or none match that host )\n' );
				process.exit( 1 );
			}

			const reports = seeds.map( s => VaultUtilities.applySeed( projectRoot, s, { confirm } ) );
			if ( args.json ) { this.emit( reports ); process.exit( 0 ); }

			for ( const r of reports ) {
				const state = !r.targetExisted ? 'creates'
					: !r.changed             ? 'already current'
					: r.applied               ? 'updated'
					:                            'would update';
				process.stdout.write( `${ r.host.padEnd( 8 ) } ${ r.target.padEnd( 12 ) } ${ state }\n` );
			}
			if ( !confirm && reports.some( r => r.changed ) )
				process.stdout.write( '\npass "confirm" to write.\n' );
			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/**
	 * `daedalus lens-index [confirm]` — regenerate the entry document's Lenses table from the
	 * vault's real lens files, so `!name` stays live after an agent authors a new one without a
	 * human hand-editing the table. No `confirm` only reports the recomputed rows and whether they
	 * differ; `root.html` is hard-rule protected, so this never writes without it.
	 */
	private static lensIndex( args: ParsedArgs ): void {
		const confirm = args.positionals[ 0 ] === 'confirm';

		try {
			const vault   = this.vault();
			const rows    = VaultUtilities.lensIndex( vault );
			const report  = VaultUtilities.spliceLensIndex( vault.read( 'root.html' ), rows );

			if ( args.json ) { this.emit( report ); process.exit( 0 ); }

			process.stdout.write( `${ rows.length } lenses — ${ report.changed ? 'root.html differs' : 'root.html already current' }\n` );
			for ( const r of rows ) process.stdout.write( `  ${ r.what }\n` );

			if ( report.changed && confirm ) {
				vault.write( 'root.html', report.html );
				process.stdout.write( '\nwrote root.html\n' );
			} else if ( report.changed ) {
				process.stdout.write( '\npass "confirm" to write root.html.\n' );
			}
			process.exit( 0 );
		} catch ( e ) {
			process.stderr.write( `daedalus: ${ e instanceof Error ? e.message : String( e ) }\n` );
			process.exit( 2 );
		}
	}

	/**
	 * `daedalus mcp status|tools|call` — the MCP group. Everything here builds the server
	 * IN-PROCESS ( `wireTools()` / `invoke()` ) — no stdio spawn, no separate process. That is
	 * deliberately the cheap half of introspection; `doctor` below is what proves the actual
	 * built process still speaks the wire correctly.
	 */
	private static async mcp( args: ParsedArgs ): Promise<void> {
		switch ( args.positionals[ 0 ] ) {
			case 'status':
				return this.mcpStatus( args );
			case 'tools':
				return this.mcpTools( args );
			case 'call':
				return this.mcpCall( args );
			default:
				process.stderr.write( 'daedalus: mcp requires a subcommand ( status | tools | call )\n' );
				process.exit( 2 );
		}
	}

	/**
	 * `daedalus mcp status` — two different truths, kept separate on purpose: what the CODE
	 * would register if spawned right now ( `wireTools()`, in-process, always current ) versus
	 * what the COMMITTED snapshot says ( `tools.snapshot.json` — what a lazily-activated host is
	 * actually showing an agent while the process stays dormant ). A mismatch is drift a host
	 * client cannot see for itself.
	 */
	private static mcpStatus( args: ParsedArgs ): void {
		const live   = new DaedalusServer().wireTools();
		const snap   = this.readSnapshot();
		const config = Config.resolve();
		const drift  = snap ? this.toolDrift( live, snap.tools ) : null;

		if ( args.json ) {
			this.emit( { server: DaedalusServer.manifest, config, live, snapshot: snap, drift } );
			process.exit( 0 );
		}

		process.stdout.write( `${ DaedalusServer.manifest.id } v${ DaedalusServer.manifest.version }\n` );
		process.stdout.write( `vault: ${ config.projectRoot } ( projectRoot: ${ config.source.projectRoot }, docRoot: ${ config.source.docRoot } )\n\n` );
		process.stdout.write( `registered ( would spawn ):  ${ live.length } tools\n` );

		if ( !snap ) {
			process.stdout.write( 'snapshot ( committed ):      none found — run "npm run snapshot"\n' );
		} else {
			process.stdout.write( `snapshot ( committed ):      ${ snap.tools.length } tools, v${ snap.version }\n` );
			if ( drift && drift.length > 0 ) {
				process.stdout.write( '\n⚠ drift — snapshot does not match the live surface:\n' );
				for ( const line of drift ) process.stdout.write( `    ${ line }\n` );
			} else {
				process.stdout.write( 'snapshot matches the live surface.\n' );
			}
		}
		process.exit( 0 );
	}

	/** `daedalus mcp tools` — the live tool surface, built in-process. `--json` for the raw wire array. */
	private static mcpTools( args: ParsedArgs ): void {
		const tools = new DaedalusServer().wireTools();
		if ( args.json ) {
			this.emit( tools );
		} else {
			for ( const t of tools )
				process.stdout.write( `${ this.tint( this.C.bold, String( t.name ) ) }\n    ${ String( t.description ) }\n` );
		}
		process.exit( 0 );
	}

	/**
	 * `daedalus mcp call <tool> [json-args]` — invoke a tool in-process and print exactly what the
	 * agent would see. Seeing a tool's real output without paying for a model turn is the whole
	 * point of the CLI being a first-class face rather than a validator with extras.
	 */
	private static async mcpCall( args: ParsedArgs ): Promise<void> {
		const name = args.positionals[ 1 ];
		if ( !name ) {
			process.stderr.write( 'daedalus: mcp call requires a tool name\n' );
			process.exit( 2 );
		}

		let toolArgs: Record<string, unknown> = {};
		const raw = args.positionals[ 2 ];
		if ( raw ) {
			try {
				toolArgs = JSON.parse( raw );
			} catch {
				process.stderr.write( 'daedalus: tool arguments must be valid JSON\n' );
				process.exit( 2 );
			}
		}

		const result = await new DaedalusServer().invoke( name, toolArgs );
		const text   = result.content.map( c => c.text ).join( '\n' );

		if ( args.json ) {
			this.emit( result );
		} else if ( result.isError ) {
			process.stderr.write( text + '\n' );
		} else {
			process.stdout.write( text + '\n' );
		}
		process.exit( result.isError ? 1 : 0 );
	}

	/**
	 * `daedalus doctor` — one command, five checks, each with a one-line fix. The highest-value
	 * command for a first install: a bad install discovered here is a line of output, not a
	 * confused agent turn later. Node / vault / MCP failures fail the process; PATH is advisory
	 * ( the global-install shim is real but not yet the only supported way to run this ).
	 */
	private static async doctor( args: ParsedArgs ): Promise<void> {
		void args;
		const lines: string[] = [];
		let failed = false;
		const fail = ( ok: boolean ): void => { if ( !ok ) failed = true; };

		const nodeOk = this.nodeOk();
		lines.push( this.checkLine( 'Node', nodeOk, `v${ process.versions.node }`, `install Node ${ this.NODE_MIN } or newer` ) );
		fail( nodeOk );

		const root  = this.packageRoot();
		const entry = path.join( root, 'dist', 'index.js' );
		const built = existsSync( entry );
		lines.push( this.checkLine( 'Install', built, root, `run "npm run build" in ${ root }` ) );
		fail( built );

		const onPath = await this.resolveOnPath( 'daedalus' );
		lines.push( this.checkLine( 'PATH', onPath, onPath ? 'daedalus resolves on PATH' : 'not on PATH', 'run "npm install -g ." from the package root' ) );

		let vaultOk = false, vaultMsg = '';
		try {
			const config  = Config.resolve();
			const health  = VaultUtilities.health( this.vault() );
			vaultOk  = health.summary.errors === 0;
			vaultMsg = `${ config.projectRoot } — ${ health.summary.errors } error(s), ${ health.summary.warnings } warning(s)`;
		} catch ( e ) {
			vaultMsg = e instanceof Error ? e.message : String( e );
		}
		lines.push( this.checkLine( 'Vault', vaultOk, vaultMsg, 'run "daedalus validate" for the full report' ) );
		fail( vaultOk );

		const probe = built
			? await this.probeServer( entry )
			: { ok: false as const, error: 'entry point missing — build first' };
		lines.push( this.checkLine( 'MCP', probe.ok,
			probe.ok ? `handshake ok — ${ probe.toolCount } tools` : ( probe.error ?? 'unknown failure' ),
			'run "npm run build" then "npm run verify" in the package root' ) );
		fail( probe.ok );

		process.stdout.write( lines.join( '\n' ) + '\n' );
		process.exit( failed ? 1 : 0 );
	}

	/** One doctor line: a mark, the label, the detail, and — only on failure — the fix. */
	private static checkLine( label: string, ok: boolean, detail: string, fix: string ): string {
		const mark = ok ? this.tint( this.C.green, '✓' ) : this.tint( this.C.red, '✗' );
		const line = `${ mark } ${ label.padEnd( 8 ) } ${ detail }`;
		return ok ? line : `${ line }\n    fix: ${ fix }`;
	}

	/** `where`/`which daedalus`, no shell — a fixed literal, never user input, spawned directly. */
	private static resolveOnPath( bin: string ): Promise<boolean> {
		return new Promise( ( resolve ) => {
			const cmd  = process.platform === 'win32' ? 'where' : 'which';
			const proc = spawn( cmd, [ bin ], { stdio: [ 'ignore', 'ignore', 'ignore' ] } );
			proc.on( 'close', ( code ) => resolve( code === 0 ) );
			proc.on( 'error', () => resolve( false ) );
		} );
	}

	/**
	 * Spawn the real built entry point and run the actual wire handshake ( initialize → tools/list )
	 * over stdio — the one check that proves the BUILT artifact still speaks MCP, as opposed to
	 * `mcp status`'s in-process build which only proves the source registers cleanly. 5s timeout;
	 * the child is always killed before this resolves.
	 */
	private static probeServer( entry: string ): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
		return new Promise( ( resolve ) => {
			const proc = spawn( process.execPath, [ entry ], { stdio: [ 'pipe', 'pipe', 'pipe' ] } );
			let settled = false;

			const finish = ( result: { ok: boolean; toolCount?: number; error?: string } ): void => {
				if ( settled ) return;
				settled = true;
				clearTimeout( timer );
				proc.kill();
				resolve( result );
			};

			const timer = setTimeout( () => finish( { ok: false, error: 'timed out waiting for a response' } ), 5000 );

			let buf = '';
			proc.stdout.on( 'data', ( chunk: Buffer ) => {
				buf += chunk.toString( 'utf8' );
				let idx: number;
				while ( ( idx = buf.indexOf( '\n' ) ) >= 0 ) {
					const line = buf.slice( 0, idx );
					buf = buf.slice( idx + 1 );
					if ( !line.trim() ) continue;
					try {
						const msg = JSON.parse( line ) as { id?: number; result?: { tools?: unknown[] } };
						if ( msg.id === 1 ) {
							proc.stdin.write( JSON.stringify( { jsonrpc: '2.0', id: 2, method: 'tools/list' } ) + '\n' );
						} else if ( msg.id === 2 ) {
							finish( { ok: true, toolCount: msg.result?.tools?.length ?? 0 } );
						}
					} catch {
						// a malformed or unrelated line — keep reading
					}
				}
			} );

			proc.on( 'error', ( e ) => finish( { ok: false, error: e.message } ) );
			proc.on( 'exit', ( code ) => { if ( !settled ) finish( { ok: false, error: `server exited early ( code ${ code } )` } ); } );

			proc.stdin.write( JSON.stringify( { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } } ) + '\n' );
		} );
	}

	/** The committed tool snapshot, or null if absent/unreadable — `mcp status`'s drift comparand. */
	private static readSnapshot(): { version: string; tools: Record<string, unknown>[] } | null {
		const file = path.join( this.packageRoot(), 'tools.snapshot.json' );
		if ( !existsSync( file ) ) return null;
		try {
			return JSON.parse( readFileSync( file, 'utf8' ) );
		} catch {
			return null;
		}
	}

	/** Tool names present on one side and not the other — empty array means no drift. */
	private static toolDrift( live: Record<string, unknown>[], snapshot: Record<string, unknown>[] ): string[] {
		const liveNames = new Set( live.map( t => String( t.name ) ) );
		const snapNames = new Set( snapshot.map( t => String( t.name ) ) );
		const added     = [ ...liveNames ].filter( n => !snapNames.has( n ) );
		const removed   = [ ...snapNames ].filter( n => !liveNames.has( n ) );

		const out: string[] = [];
		if ( added.length )   out.push( `in code, not snapshot: ${ added.join( ', ' ) }` );
		if ( removed.length ) out.push( `in snapshot, not code: ${ removed.join( ', ' ) }` );
		return out;
	}

	/** Walk up from this file looking for the package root ( nearest ancestor with a package.json ). */
	private static packageRoot(): string {
		let dir = __dirname;
		for ( let i = 0; i < 6; i++ ) {
			if ( existsSync( path.join( dir, 'package.json' ) ) ) return dir;
			const parent = path.dirname( dir );
			if ( parent === dir ) break;
			dir = parent;
		}
		return __dirname;
	}

	/** The bundled canonical substrate — `InstallManifest`'s source, shipped alongside this package
	 *  at `substrate/`. What `maintain fill` and `reset` restore FROM. */
	private static substrateRoot(): string {
		return path.join( this.packageRoot(), 'substrate' );
	}

	/** The bundled Claude skills, shipped alongside this package at `skills/` — what `init`'s skill
	 *  step installs into `.claude/skills/`. */
	private static skillsRoot(): string {
		return path.join( this.packageRoot(), 'skills' );
	}

	/**
	 * The agent entry-point filenames — CLAUDE.md, AGENTS.md, GEMINI.md today — read from the
	 * BUNDLE's `root-context.html` seed declarations rather than written down here.
	 *
	 * NOT HARDCODED, deliberately ( Bryan, 2026-07-26: "CLAUDE.md is fine for now, but make it
	 * variable" ). Those §10 seed blocks are already the one place the host targets are declared;
	 * a literal list in the CLI would be a second one, and the day a fourth host is added the
	 * install would seed it but never anchor on it. Returns [] rather than throwing if the bundle
	 * is unreadable — anchoring is an optimisation, and losing it must not fail an install.
	 */
	private static hostMarkers(): string[] {
		return this.hostSeeds().map( ( s ) => s.target );
	}

	/** The bundle's own seed declarations, before any vault exists. The install needs these BEFORE
	 *  step 1 has run — to anchor the project root, to offer the entry points as a choice, and to
	 *  show the user the block they are about to have added to a file they already own. */
	private static hostSeeds(): ReturnType<typeof VaultUtilities.parseSeedsFrom> {
		try {
			const src = path.join( this.substrateRoot(), ROOT_CONTEXT );
			if ( !existsSync( src ) ) return [];
			return VaultUtilities.parseSeedsFrom( readFileSync( src, 'utf-8' ) );
		} catch {
			return [];
		}
	}

	/**
	 * The install, drawn as a folder tree rooted at the project.
	 *
	 * Folders, not files. A fresh vault is ~50 files and listing them was an unreadable wall that
	 * told a newcomer nothing — what matters on first contact is the SHAPE: a `_Claude/` beside your
	 * code, holding a handful of directories with obvious jobs, plus two or three files at the
	 * project root. Directory names and their one-line purposes come from `VaultLayout`, so this
	 * picture cannot drift from what deploy actually creates.
	 *
	 * `pending` draws it as the stepper's FIRST question, before any choice has been made — the vault
	 * half is settled ( that is what is being agreed to ), the root files are still up for discussion,
	 * and saying so on the picture is what keeps it from being a promise the later steps then break.
	 */
	private static installTree( projectRoot: string, docRoot: string, choices: { hosts: string[]; mcp: boolean; skills: boolean }, pending = false ): string {
		// First sentence, trimmed to fit at a WORD boundary — a mid-word ellipsis reads as a bug.
		// Deliberately NOT split on comma and NOT lowercased: an earlier pass did both and turned
		// "Read-anywhere, write-one-report agents" into "read-anywhere" and "Know+Care" into
		// "know+Care". The table's own sentence case is the house voice; match it, don't rewrite it.
		const short = ( purpose: string ): string => {
			const first = purpose.split( /[.—]/ )[ 0 ].trim();
			return first.length > 52 ? first.slice( 0, 51 ).replace( /\s+\S*$/, '' ) + '…' : first;
		};
		const rows = VaultLayout.all().filter( ( e ) => !e.dir.includes( '/' ) );
		const agent   = rows.filter( ( e ) => e.layer === 'agent' );
		const data    = rows.filter( ( e ) => e.layer === 'data' && e.indexed );
		const scratch = rows.filter( ( e ) => e.layer === 'data' && !e.indexed );

		const dim  = ( s: string ): string => this.tint( this.C.dim, s );
		const pad  = ( s: string ): string => s.padEnd( 18 );
		const out: string[] = [];

		out.push( `${ this.tint( this.C.bold, path.basename( projectRoot ) || projectRoot ) }/` );
		out.push( '│' );
		// Padded on the RAW name, then tinted — colour codes are invisible but counted, so padding a
		// tinted string silently misaligns every coloured row against every plain one.
		out.push( `├─ ${ this.tint( this.C.bold, pad( docRoot + '/' ) ) }${ dim( 'The vault — everything governed lives here' ) }` );
		out.push( '│  │' );

		const group = ( entries: typeof rows, label: string ): void => {
			if ( entries.length === 0 ) return;
			out.push( `│  │  ${ dim( label ) }` );
			for ( const e of entries ) out.push( `│  ├─ ${ pad( e.dir + '/' ) }${ dim( short( e.purpose ) ) }` );
			out.push( '│  │' );
		};
		group( agent, 'What an agent is composed from' );
		group( data,  'What the project accumulates' );

		if ( scratch.length ) {
			out.push( `│  │  ${ dim( 'Scratch and output space' ) }` );
			out.push( `│  ├─ ${ scratch.map( ( e ) => e.dir + '/' ).join( '  ' ) }` );
			out.push( '│  │' );
		}

		out.push( `│  ├─ ${ pad( 'root.html' ) }${ dim( 'The entry document — read first, and yours to edit' ) }` );
		out.push( `│  └─ ${ pad( 'root-context.html' ) }${ dim( 'Generates the entry files below' ) }` );
		out.push( '│' );
		if ( pending ) out.push( `│  ${ dim( 'At your project root — each one is a question in the steps below' ) }` );

		const hostWhy = ( h: string ): string =>
			h.startsWith( 'CLAUDE' ) ? 'Points Claude Code at the vault'
			: h.startsWith( 'AGENTS' ) ? 'The same, for Codex and others'
			: h.startsWith( 'GEMINI' ) ? 'The same, for Gemini'
			: 'Points your agent at the vault';

		const leaves: [ string, string ][] = [];
		for ( const h of choices.hosts ) leaves.push( [ h, hostWhy( h ) ] );
		if ( choices.mcp )    leaves.push( [ '.mcp.json', 'Registers the kcd_* tools' ] );
		if ( choices.skills ) leaves.push( [ '.claude/skills/', 'The bundled onboarding skill' ] );

		leaves.forEach( ( [ name, why ], i ) => {
			const last = i === leaves.length - 1;
			out.push( `${ last ? '└─' : '├─' } ${ pad( name ) }${ dim( why ) }` );
		} );

		return out.join( '\n' ) + '\n';
	}

	/** Nearest ancestor of `from` ( inclusive ) holding any host marker file, or null. Same upward
	 *  walk `inferProjectRoot` uses for the vault, against a different marker — because on a FIRST
	 *  install there is no vault to find yet, and CLAUDE.md is the marker that already exists. */
	private static markerRoot( from: string ): string | null {
		const markers = this.hostMarkers();
		if ( !markers.length ) return null;

		let dir = path.resolve( from );
		for ( ;; ) {
			if ( markers.some( ( m ) => existsSync( path.join( dir, m ) ) ) ) return dir;
			const parent = path.dirname( dir );
			if ( parent === dir ) return null;
			dir = parent;
		}
	}

	/**
	 * Nearest ancestor of `from` ( inclusive ) that is a git working tree, or null.
	 *
	 * Tests EXISTENCE, not directory-ness: `.git` is a directory in an ordinary clone but a FILE in a
	 * worktree, a submodule, or anything else using a gitdir pointer, and treating those as "not a
	 * repository" would silently drop the ignore question for exactly the people most likely to care.
	 *
	 * Walks up for the same reason the vault does — a repo root above the install directory still
	 * governs it. The block itself is always written to a `.gitignore` at the PROJECT root, which is
	 * correct whether or not that is also the repo root: git honours nested ignore files, and the
	 * entries are relative to the file that holds them.
	 */
	private static gitRoot( from: string ): string | null {
		let dir = path.resolve( from );
		for ( ;; ) {
			if ( existsSync( path.join( dir, '.git' ) ) ) return dir;
			const parent = path.dirname( dir );
			if ( parent === dir ) return null;
			dir = parent;
		}
	}

	/** Does this file hold anything besides our managed block? The conflict signal for a host entry
	 *  point that was already instructing agents before we arrived. */
	private static hasOwnContent( absPath: string ): boolean {
		if ( !existsSync( absPath ) ) return false;
		const body = readFileSync( absPath, 'utf-8' )
			.replace( /<!--\s*kcd:begin\s*-->[\s\S]*?<!--\s*kcd:end\s*-->/, '' );
		return body.trim().length > 0;
	}

	/** The Node floor, defined ONCE — `init` gates on it before acting and `doctor` reports it after.
	 *  Two copies of a version number is exactly how the two faces drift apart. */
	private static readonly NODE_MIN = 18;

	private static nodeOk(): boolean {
		return Number( process.versions.node.split( '.' )[ 0 ] ) >= this.NODE_MIN;
	}

	/**
	 * `daedalus maintain [fill]` — vault STRUCTURE against `VaultLayout`, distinct from `validate`'s
	 * document-validity. No argument previews only ( `VaultDeploy.inspect`, changes nothing ); `fill`
	 * runs `apply()` and then inspects AGAIN — a fresh, independent call, not a trust of apply's own
	 * bookkeeping — so what prints after a fill is proof the gaps are gone, not a promise they should be.
	 */
	private static maintain( args: ParsedArgs ): void {
		const { projectRoot, docRoot } = Config.resolve();
		const substrateSource = this.substrateRoot();
		const doFill = args.positionals[ 0 ] === 'fill';

		if ( !doFill ) {
			const report = VaultDeploy.inspect( projectRoot, { docRoot, substrateSource } );
			if ( args.json ) { this.emit( report ); process.exit( report.missing > 0 ? 1 : 0 ); }
			this.renderDeployReport( report, 'inspect' );
			process.exit( report.missing > 0 ? 1 : 0 );
		}

		const before = VaultDeploy.inspect( projectRoot, { docRoot, substrateSource } );
		VaultDeploy.apply( projectRoot, { docRoot, substrateSource } );
		const after  = VaultDeploy.inspect( projectRoot, { docRoot, substrateSource } );

		if ( args.json ) { this.emit( { before, after } ); process.exit( after.missing > 0 ? 1 : 0 ); }

		this.renderDeployReport( before, 'before' );
		process.stdout.write( `\nfilled ${ before.missing - after.missing } item(s)\n` );
		this.renderDeployReport( after, 'after' );
		process.exit( after.missing > 0 ? 1 : 0 );
	}

	/** One `VaultDeploy` report — every step, present or not, with its note. */
	private static renderDeployReport( report: DeployReport, label: string ): void {
		process.stdout.write( `\n${ label } — ${ report.root }/${ report.docRoot } ( ${ report.missing } missing )\n` );
		for ( const item of report.items ) {
			const mark = item.present ? this.tint( this.C.green, '✓' ) : this.tint( this.C.red, '✗' );
			process.stdout.write( `  ${ mark } ${ item.kind.padEnd( 9 ) } ${ item.path }${ item.note ? `  — ${ item.note }` : '' }\n` );
		}
	}

	/**
	 * `daedalus reset <path> [confirm]` — restore ONE deployed artifact to canonical from the
	 * substrate. No `confirm` previews only, exactly like `maintain`: report what would change,
	 * write nothing. `confirm` performs the overwrite — never on a target already identical to
	 * canonical, matching `VaultUtilities.reset`'s own no-op-when-identical rule.
	 */
	private static reset( args: ParsedArgs ): void {
		const target = args.positionals[ 0 ];
		if ( !target ) {
			process.stderr.write( 'daedalus: reset requires a vault-relative path\n' );
			process.exit( 2 );
		}
		const confirm = args.positionals[ 1 ] === 'confirm';

		try {
			const report = VaultUtilities.reset( this.vault(), target, this.substrateRoot(), { confirm } );
			if ( args.json ) { this.emit( report ); process.exit( 0 ); }

			if ( !report.hasCanonical ) {
				process.stdout.write(
					report.canonicalPath
						? `no canonical counterpart at "${ report.canonicalPath }" — nothing to reset from\n`
						: `"${ report.path }" is not covered by the install manifest — nothing to reset from\n`
				);
				process.exit( 1 );
			}
			if ( report.identical ) {
				process.stdout.write( `"${ report.path }" already matches canonical — nothing to do\n` );
				process.exit( 0 );
			}
			if ( report.applied ) {
				process.stdout.write( `reset "${ report.path }" from "${ report.canonicalPath }"\n` );
			} else {
				process.stdout.write(
					`"${ report.path }" differs from canonical "${ report.canonicalPath }"` +
					`${ report.targetExisted ? '' : ' ( target does not exist yet )' } — pass "confirm" to overwrite\n`
				);
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
		grey:  '\x1b[90m', blue: '\x1b[94m', green: '\x1b[92m', red: '\x1b[91m',
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
			'  init [confirm]    Install into this project. In a terminal it steps you through the choices; "confirm" takes the defaults and writes.\n' +
			'  get-started       After restarting your agent session: survey the project and print a prompt to verify the tools are live.\n' +
			'  validate [path]   Validate one artifact, or the whole vault when no path is given.\n' +
			'  compile <lens...> Compile one or more lenses to a context string ( first = primary ).\n' +
			'  show <lens>       Chart one lens\'s compiled context — slots, states, token counts.\n' +
			'  survey            Reconnoitre the project beside the vault → a JSON tree in audits/survey/.\n' +
			'  mcp status        Compare the live tool surface against the committed snapshot.\n' +
			'  mcp tools         List the live tool surface ( in-process, no spawn ).\n' +
			'  mcp call <tool> [json-args]   Invoke a tool in-process and print its result.\n' +
			'  doctor            Five checks — Node, install, PATH, vault, MCP end-to-end — each with a fix.\n' +
			'  maintain [fill]   Vault STRUCTURE vs VaultLayout ( preview only, unless "fill" ).\n' +
			'  reset <path> [confirm]   Restore one artifact to canonical from the substrate ( preview only, unless "confirm" ).\n' +
			'  query [json-filter]   Find artifacts by glob/type/text, or census by type ( e.g. \'{"groupBy":"type"}\' ).\n' +
			'  links <path>      An artifact\'s outbound links/addresses, plus everything pointing back at it.\n' +
			'  seed [host] [confirm]      Extract root-context seed payloads into CLAUDE.md etc ( preview only, unless "confirm" ).\n' +
			'  lens-index [confirm]       Regenerate the entry doc\'s Lenses table from real lenses ( preview only, unless "confirm" ).\n' +
			'  clear [all] [confirm]      Take the install back out. Removes only what it added; "all" also removes the vault.\n\n' +
			'Options:\n' +
			'  --root <dir>      Project root the vault sits under ( default: inferred by walking up ).\n' +
			'  --doc-root <dir>  Doc root within the project ( default: the standard vault folder ).\n' +
			'  --json            Emit the raw result object instead of formatted lines.\n' +
			'  -h, --help        Show this help.\n\n' +
			'Exit codes: 0 = clean, 1 = errors found, 2 = usage error.\n'
		);
	}
}
