import { MCPUtils } from '../MCPUtils';
import { validateVault } from '../validate';
import type { Command } from '../cli';
import type { HealthReport } from '../types';

/**
 * `daedalus validate [path]` — the same validateVault() sweep the kcd_health tool runs, over the
 * CLI. Human output by default; --json emits the raw HealthReport ( a settled SDK-shaped object,
 * which is why JSON is offered here per the plan's output floor ). The exit code IS the verdict:
 * 0 = clean, 1 = at least one structural ERROR. Warnings are advisory reference-hygiene and never
 * fail the command on their own.
 */
export const runValidate: Command = ( args, opts ) => {
	const path   = args[ 0 ];                          // optional: validate a single artifact
	const report = validateVault( MCPUtils.vault, path );

	process.stdout.write( ( opts.json ? JSON.stringify( report, null, 2 ) : render( report ) ) + '\n' );
	return report.summary.errors > 0 ? 1 : 0;
};

function render( report: HealthReport ): string {
	const { errors, warnings, total } = report.summary;
	if ( total === 0 ) return paint( 32, '✓ vault clean — 0 issues' );

	const lines = report.issues.map( ( i ) => {
		const tag = i.severity === 'error' ? paint( 31, 'ERROR' ) : paint( 33, 'warn ' );
		return `  ${ tag }  ${ i.path }  —  ${ i.message }`;
	} );
	lines.push( '', `${ errors } error(s), ${ warnings } warning(s)` );
	return lines.join( '\n' );
}

/** ANSI colour, but ONLY when stdout is a real terminal; a pipe or file gets clean text. */
function paint( code: number, s: string ): string {
	return process.stdout.isTTY ? `\x1b[${ code }m${ s }\x1b[0m` : s;
}
