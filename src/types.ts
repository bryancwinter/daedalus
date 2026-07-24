// HealthIssue / HealthReport now live in the SDK ( VaultUtilities ) — the shared engine both
// the kcd_health tool and the CLI validate command consume. Import them from 'kcd_sdk'.

/** A single inbound link from kcd_links — an artifact that points at the target. */
export interface InboundLink {
	path:         string;
	relativePath: string;
}
