import { KCDPrimitive } from 'kcd_sdk';
import type { Vault } from 'kcd_sdk';
import type { HealthIssue, HealthReport } from './types';

/**
 * validateVault — the whole-vault ( or single-file ) validation sweep, as ONE engine function.
 *
 * Both faces of the validator call this: the kcd_health MCP tool ( tools/read.ts ) and the CLI's
 * `validate` command ( plan 1.a ). Keeping the sweep here, not in a handler, is what stops the two
 * surfaces from drifting — a behaviour in one and not the other would be a bug, so there is exactly
 * one implementation of it.
 *
 * Two axes, folded into one issue list:
 *   • STRUCTURAL ( per file ) — required frontmatter / sections / type rules via typeCheck(); a
 *     parse failure becomes an error issue rather than aborting the run.
 *   • REFERENCE INTEGRITY ( cross-file, advisory ) — dangling internal link targets and broken
 *     base/lens slugs via Vault.referenceIssues().
 *
 * The file-kind gate: a whole-vault sweep grades only library-path .html files. A .js utility is
 * declarative code, not a KCD artifact ( the protocol: "utility is not a document type" ), so
 * grading it against the document schema is a category error, not a defect; directories marked
 * indexed:false ( scratch / output ) are non-library and pass through untouched.
 *
 * @param vault  the Vault bound to the target root.
 * @param path   optional vault-relative path — check that one file; omit to sweep the whole vault.
 */
export function validateVault( vault: Vault, path?: string ): HealthReport {
	const issues: HealthIssue[] = [];

	const checkFile = ( filePath: string ): void => {
		const rel = vault.toVaultRel( filePath );
		try {
			const artifact = KCDPrimitive.fromHtml( vault.read( filePath ), vault.toAbs( filePath ) );
			for ( const issue of artifact.typeCheck() ) issues.push( { path: rel, ...issue } );
		} catch ( e ) {
			issues.push( { path: rel, severity: 'error', message: e instanceof Error ? e.message : String( e ) } );
		}
	};

	if ( path ) {
		checkFile( path );
	} else {
		// Only DOCUMENTS are graded as documents — the file-kind gate. A library-path .html file is
		// an artifact; a .js utility is declarative code ( "utility is not a document type" ), and an
		// indexed:false directory is scratch/output. Both pass through untouched.
		for ( const f of vault.scan() )
			if ( vault.isLibraryPath( f.relativePath ) && /\.html?$/i.test( f.relativePath ) )
				checkFile( f.path );
	}

	// Reference integrity ( cross-file, advisory ) — the hygiene half. Logic lives in the Vault; we
	// only fold its findings into the same issue list.
	for ( const ri of vault.referenceIssues( path ) )
		issues.push( { path: ri.path, severity: ri.severity, message: ri.message } );

	return {
		issues,
		summary: {
			total:    issues.length,
			errors:   issues.filter( i => i.severity === 'error' ).length,
			warnings: issues.filter( i => i.severity === 'warn' ).length,
		},
	};
}
