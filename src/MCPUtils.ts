import { Vault, VaultTools } from 'kcd_sdk';
import type { VaultToolNames } from 'kcd_sdk';
import { Config } from './Config';

/**
 * What the ten KCD tools are CALLED on this wire. Claude Code addresses them as `mcp__daedalus__kcd_*`,
 * and every host that has cached the snapshot expects them, so a rename here is a breaking change to
 * every client. The engine renders its prose against this map, so a doc that names a sibling names it
 * as this face calls it.
 */
export const TOOL_NAMES: VaultToolNames = {
	query:   'kcd_query',
	get:     'kcd_get',
	links:   'kcd_links',
	health:  'kcd_health',
	compile: 'kcd_compile',
	survey:  'kcd_survey',
	save:    'kcd_save',
	move:    'kcd_move',
	delete:  'kcd_delete',
	batch:   'kcd_batch',
};

/**
 * MCPUtils — the server's binding to its vault, as one bounded object.
 *
 * The Vault is bound to this server's CURRENT configured root, and the tool engine is bound to that
 * Vault. Both are GETTERS: config resolves fresh through its tiers on each access, so a root a host
 * rewrites is picked up on the next tool call with no respawn. Cached by config value, so they are only
 * rebuilt when the root actually changes — repeated accesses are cheap.
 */
export class MCPUtils {

	private static cacheRoot    = '';
	private static cacheDocRoot = '';
	private static cacheCss     = '';
	private static cacheVault: Vault | null      = null;
	private static cacheTools: VaultTools | null = null;

	/** The vault bound to this server's current configured root. */
	static get vault(): Vault {
		return this.bound().vault;
	}

	/** The KCD tool engine over that vault, speaking this server's tool names. */
	static get tools(): VaultTools {
		return this.bound().tools;
	}

	private static bound(): { vault: Vault; tools: VaultTools } {
		const { projectRoot, docRoot, cssVaultRel } = Config.resolve();
		const stale = projectRoot !== this.cacheRoot || docRoot !== this.cacheDocRoot || cssVaultRel !== this.cacheCss
			|| this.cacheVault === null || this.cacheTools === null;
		if ( stale ) {
			this.cacheVault   = new Vault( projectRoot, docRoot );
			this.cacheTools   = new VaultTools( this.cacheVault, TOOL_NAMES, { cssVaultRel } );
			this.cacheRoot    = projectRoot;
			this.cacheDocRoot = docRoot;
			this.cacheCss     = cssVaultRel;
		}
		return { vault: this.cacheVault!, tools: this.cacheTools! };
	}
}
