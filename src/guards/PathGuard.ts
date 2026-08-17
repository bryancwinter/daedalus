import { basename } from 'path';
import { AbstractGuard, GuardError } from './AbstractGuard';
import type { ToolRequest } from './AbstractGuard';
import { VaultLayout } from 'kcd_sdk';
import type { ArtifactType } from 'kcd_sdk';
import { MCPUtils } from '../MCPUtils';

/**
 * PathGuard — first concrete guard; three responsibilities:
 *
 * 1. Path jail      — every path param must resolve inside the vault root.
 *                     Prevents path-traversal attacks (../../etc/passwd etc.).
 * 2. Write typing   — on kcd_save, the target directory must ACCEPT the artifact's
 *                     declared frontmatter type ( VaultLayout owns the accepted set ).
 * 3. Nonce slot     — always passes in Phase 2 (stdio; OS isolation is the boundary).
 *                     NonceGuard or an extension here activates it for named-pipe transport.
 */
export class PathGuard extends AbstractGuard {

	validate( req: ToolRequest ): void {
		const p = req.params;

		// Jail any recognised path-valued params
		for ( const key of [ 'path', 'from', 'to' ] ) {
			if ( typeof p[key] === 'string' ) this.jail( p[key] as string );
		}

		// kcd_save: the path is jailed above; also check the declared type matches its target directory.
		if ( req.tool === 'kcd_save' && typeof p['path'] === 'string' ) {
			this.checkType( p['path'] as string, p['artifact'] );
		}
	}

	/**
	 * Assert that absPath resolves inside the vault root.
	 * Throws GuardError if it resolves to a path outside or equal to the vault root itself.
	 */
	jail( inputPath: string ): void {
		if ( MCPUtils.vault.isInside( inputPath ) ) return;

		// Name the FORM, not just the failure. This is the most-hit refusal on the server and it used to
		// report the offending path and the root and stop there — true, and no help: a caller that reached
		// for an absolute or `../`-escaped path learns it was wrong without learning what right looks like,
		// which costs a round trip or a guess. The two things it actually needs are the currency ( paths are
		// vault-RELATIVE ) and where to look up a real one, so both ride the rejection. Matches the
		// ephemeral-link refusal and checkType below: what was wrong, then what would be right, in one message.
		throw new GuardError(
			`Path "${inputPath}" is outside the vault ("${MCPUtils.vault.root}") — paths here are vault-RELATIVE `
			+ `( "references/domain/note.html" ), not absolute and never "../"-escaped; a leading "${basename( MCPUtils.vault.root )}/" `
			+ `is tolerated. Use kcd_query to find an artifact's real path.`,
			'PATH_OUTSIDE_VAULT'
		);
	}

	/**
	 * On a save, assert the target directory ACCEPTS the artifact's declared type — a lens cannot be
	 * saved into references/, etc. ( the path itself is jailed by validate() ). A missing declared type
	 * is left to KcdValidate downstream; this only catches a real category error.
	 *
	 * Asks `accepts`, not `classify`. This used to compare the declared type against the single type the
	 * directory implies, which is a different question and a stricter one: `references/` implies
	 * `reference` and legitimately holds how-tos and notes, so a valid on-disk document that declared
	 * `how-to` could be read and validated but never saved back. VaultLayout owns the accepted set.
	 *
	 * The message names the whole accepted set deliberately. The old one reported only what the directory
	 * implied, which told a caller its type was wrong without telling it what would be right — a dead end
	 * that costs a round trip, or worse, a hand-edit around the tool.
	 */
	private checkType( writePath: string, artifact: unknown ): void {
		const fm = typeof artifact === 'object' && artifact !== null
			? ( artifact as Record<string, unknown> )['frontmatter']
			: undefined;
		const declaredType = typeof fm === 'object' && fm !== null
			? String( ( fm as Record<string, unknown> )['type'] ?? '' )
			: '';

		if ( !declaredType ) return;
		if ( MCPUtils.vault.accepts( writePath, declaredType as ArtifactType ) ) return;

		const allowed = MCPUtils.vault.acceptedTypes( writePath ).map( t => `"${t}"` ).join( ' | ' );

		// One type is decided by the FILENAME, not the folder, so for it the accepted-set message names the
		// wrong cause and invites the wrong fix: an agent told "references/ accepts reference" will retry as
		// a reference and get a document that no index will ever treat as an index. Name the real condition.
		const hint = declaredType === 'nav-index' && !writePath.replace( /\\/g, '/' ).endsWith( '/' + VaultLayout.NAV_INDEX_FILE )
			? ` — a nav-index is identified by its filename, so it must be named "${VaultLayout.NAV_INDEX_FILE}"`
			: '';

		throw new GuardError(
			`Type mismatch at "${writePath}": directory accepts ${allowed}, artifact declares "${declaredType}"${hint}`,
			'TYPE_MISMATCH'
		);
	}

	/**
	 * Nonce validation slot — inert in Phase 2 (stdio transport).
	 * Named-pipe transport passes the session nonce here; this method becomes
	 * the single enforcement point without touching any tool handler.
	 */
	validateNonce( _token: string ): boolean {
		return true;
	}
}
