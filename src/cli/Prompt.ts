// `node:` prefix REQUIRED on the subpath import, not stylistic. esbuild's platform:'node' marks
// builtins external by matching a known-name list, and the bare subpath `readline/promises` is not
// on it — the build fails to resolve it even though Node has it. A `node:`-prefixed specifier is
// treated as an external builtin unconditionally, which is why the sibling bare imports elsewhere
// in the CLI ( 'path', 'fs' ) bundle fine while this one did not.
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/**
 * Prompt — the interactive half of the CLI, as one Thing.
 *
 * WHY NUMBERED RATHER THAN ARROW-KEY ( ruled 2026-07-26 ): every option here is chosen by typing a
 * number and pressing Enter. Arrow-key menus need raw-mode TTY handling plus ANSI redraw, and the
 * places that misbehave — cmd.exe, the VS Code terminal, an SSH session, a terminal multiplexer —
 * are exactly the places a first install happens. A prompt that garbles itself during `daedalus
 * init` is worse than a plain one, because it breaks the single moment a new user decides whether
 * this tool is trustworthy. Numbered input works everywhere and needs no dependency. Arrow-key
 * navigation is a later polish, not a prerequisite.
 *
 * NON-TTY IS A FIRST-CLASS PATH, not a degraded one. Piped, scripted, or run inside another agent,
 * every method returns its default without asking and without blocking — so `daedalus init` in CI
 * behaves exactly like the old non-interactive flow. Interactivity is an affordance layered on top
 * of a complete non-interactive command, never a requirement bolted through it.
 */
export class Prompt {

	private static rl: readline.Interface | null = null;

	/** True only when BOTH ends are a terminal. stdout alone is not enough — a piped stdin has no
	 *  one to answer, and asking would hang the process forever waiting on EOF. */
	static get interactive(): boolean {
		return Boolean( stdin.isTTY && stdout.isTTY );
	}

	private static io(): readline.Interface {
		if ( !this.rl ) this.rl = readline.createInterface( { input: stdin, output: stdout } );
		return this.rl;
	}

	/** Release the handle, or the process hangs with the terminal in a half-owned state. */
	static close(): void {
		this.rl?.close();
		this.rl = null;
	}

	// ── Colour ────────────────────────────────────────────────────────────────

	private static readonly DIM  = '\x1b[2m';
	private static readonly BOLD = '\x1b[1m';
	private static readonly CYAN = '\x1b[36m';
	private static readonly OFF  = '\x1b[0m';

	private static tint( code: string, s: string ): string {
		return stdout.isTTY ? `${ code }${ s }${ this.OFF }` : s;
	}

	// ── Questions ─────────────────────────────────────────────────────────────

	/** Yes/no. `def` is what Enter means, and what a non-TTY run gets. */
	static async confirm( question: string, def: boolean, note?: string ): Promise<boolean> {
		if ( !this.interactive ) return def;

		stdout.write( `\n${ this.tint( this.CYAN, '?' ) } ${ this.tint( this.BOLD, question ) }\n` );
		if ( note ) stdout.write( `${ this.tint( this.DIM, '  ' + note ) }\n` );

		const hint   = def ? 'Y/n' : 'y/N';
		const answer = ( await this.io().question( `  ${ this.tint( this.DIM, `(${ hint })` ) } › ` ) ).trim().toLowerCase();
		if ( !answer ) return def;
		return answer.startsWith( 'y' );
	}

	/**
	 * Pick one. Returns the chosen option's `value`. Out-of-range or unparseable input re-asks
	 * rather than silently taking the default — a mistyped answer to "what should I delete" must
	 * never be read as consent.
	 */
	static async select<T>( question: string, options: { label: string; note?: string; value: T }[], defIndex = 0, note?: string ): Promise<T> {
		if ( !this.interactive || options.length === 0 ) return options[ defIndex ]?.value;

		for ( ;; ) {
			stdout.write( `\n${ this.tint( this.CYAN, '?' ) } ${ this.tint( this.BOLD, question ) }\n` );
			if ( note ) stdout.write( `${ this.tint( this.DIM, '  ' + note ) }\n` );
			options.forEach( ( o, i ) => {
				const mark = i === defIndex ? this.tint( this.CYAN, '›' ) : ' ';
				stdout.write( `  ${ mark } ${ i + 1 }) ${ o.label }${ o.note ? this.tint( this.DIM, '  — ' + o.note ) : '' }\n` );
			} );

			const raw = ( await this.io().question( `  ${ this.tint( this.DIM, `(1-${ options.length }, Enter = ${ defIndex + 1 })` ) } › ` ) ).trim();
			if ( !raw ) return options[ defIndex ].value;

			const n = Number( raw );
			if ( Number.isInteger( n ) && n >= 1 && n <= options.length ) return options[ n - 1 ].value;
			stdout.write( `  ${ this.tint( this.DIM, `not one of 1-${ options.length } — try again` ) }\n` );
		}
	}

	/**
	 * Pick any number. Comma-separated numbers, `all`, or `none`; Enter takes the pre-selected set.
	 * Returns the chosen options' values in the order they were offered, not the order typed.
	 */
	static async multiselect<T>( question: string, options: { label: string; note?: string; value: T }[], defSelected: number[], note?: string ): Promise<T[]> {
		const fallback = () => defSelected.map( ( i ) => options[ i ]?.value ).filter( ( v ): v is T => v !== undefined );
		if ( !this.interactive || options.length === 0 ) return fallback();

		for ( ;; ) {
			stdout.write( `\n${ this.tint( this.CYAN, '?' ) } ${ this.tint( this.BOLD, question ) }\n` );
			if ( note ) stdout.write( `${ this.tint( this.DIM, '  ' + note ) }\n` );
			options.forEach( ( o, i ) => {
				const mark = defSelected.includes( i ) ? this.tint( this.CYAN, '·' ) : ' ';
				stdout.write( `  ${ mark } ${ i + 1 }) ${ o.label }${ o.note ? this.tint( this.DIM, '  — ' + o.note ) : '' }\n` );
			} );

			const raw = ( await this.io().question( `  ${ this.tint( this.DIM, 'comma-separated, "all", "none", Enter = marked' ) } › ` ) ).trim().toLowerCase();
			if ( !raw )         return fallback();
			if ( raw === 'all' )  return options.map( ( o ) => o.value );
			if ( raw === 'none' ) return [];

			const picked = raw.split( ',' ).map( ( s ) => Number( s.trim() ) );
			if ( picked.every( ( n ) => Number.isInteger( n ) && n >= 1 && n <= options.length ) ) {
				const set = new Set( picked.map( ( n ) => n - 1 ) );
				return options.filter( ( _o, i ) => set.has( i ) ).map( ( o ) => o.value );
			}
			stdout.write( `  ${ this.tint( this.DIM, `numbers between 1 and ${ options.length }, please` ) }\n` );
		}
	}

	/** A section heading between steps, so a stepper reads as progress rather than a wall. */
	static step( n: number, total: number, title: string ): void {
		stdout.write( `\n${ this.tint( this.DIM, `── step ${ n }/${ total } ` + '─'.repeat( Math.max( 0, 46 - title.length ) ) ) } ${ this.tint( this.BOLD, title ) }\n` );
	}
}
