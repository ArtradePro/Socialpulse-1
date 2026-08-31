import { db } from '../../config/database';

export interface ClaimsValidationResult {
    valid: boolean;
    violations: string[];
    disclaimers: string[];
    requiresDisclaimer: boolean;
}

export class ClaimsGuardService {
    // Registered trademark slogan bound exclusively to Fungus No More™
    public static readonly FNM_EXCLUSIVE_SLOGAN = "Love The Skin You're In.";

    /**
     * Checks if a workspace represents the Fungus No More™ brand.
     */
    public static isFungusNoMore(workspace: { name?: string; brand_type?: string }): boolean {
        if (!workspace) return false;
        if (workspace.brand_type === 'FUNGUS_NO_MORE') return true;
        const name = (workspace.name || '').toLowerCase();
        return name.includes('fungus no more') || name.includes('fungusnomore');
    }

    /**
     * Enforces trademark slogan exclusivity.
     * "Love The Skin You're In." must NEVER appear in Higiene Corporate or other brand workspaces.
     */
    public static async validateSloganExclusivity(
        workspaceId: string,
        content: string
    ): Promise<{ valid: boolean; violations: string[] }> {
        if (!content || !workspaceId) return { valid: true, violations: [] };

        const { rows } = await db.query(
            `SELECT id, name, brand_type FROM workspaces WHERE id = $1 LIMIT 1`,
            [workspaceId]
        );

        if (rows.length === 0) {
            return { valid: true, violations: [] };
        }

        const workspace = rows[0];
        const isFNM = this.isFungusNoMore(workspace);

        // Regex matching "Love The Skin You're In" with case insensitivity and varied punctuation/apostrophes
        const sloganRegex = /love\s+the\s+skin\s+you(?:'|’|\s+a)?re?\s+in/i;

        if (!isFNM && sloganRegex.test(content)) {
            return {
                valid: false,
                violations: [
                    'SLOGAN_EXCLUSIVITY_VIOLATION: The slogan "Love The Skin You\'re In." is legally bound exclusively to Fungus No More™ and is prohibited for other workspaces.'
                ]
            };
        }

        return { valid: true, violations: [] };
    }

    /**
     * Validates content against the approved claims library and medical claims rules.
     */
    public static async validateContent(
        workspaceId: string,
        content: string
    ): Promise<ClaimsValidationResult> {
        const violations: string[] = [];
        const disclaimers: string[] = [];

        // 1. Slogan Exclusivity Check
        const sloganCheck = await this.validateSloganExclusivity(workspaceId, content);
        if (!sloganCheck.valid) {
            violations.push(...sloganCheck.violations);
        }

        // 2. Fetch approved claims for workspace
        const { rows: claims } = await db.query(
            `SELECT * FROM claims_library WHERE workspace_id = $1 AND status = 'APPROVED'`,
            [workspaceId]
        );

        // 3. Prohibited Unapproved Medical Claims Check (e.g. 100% cure guarantees)
        const unapprovedClaimsRegex = /\b(100%\s+guaranteed\s+cure|miracle\s+cure|permanent\s+medical\s+cure|fda\s+approved\s+cure)\b/i;
        if (unapprovedClaimsRegex.test(content)) {
            violations.push('PROHIBITED_CLAIM: Unverified medical cure claims or absolute guarantees are prohibited.');
        }

        // 4. Attach mandatory disclaimers for matched claims
        for (const claim of claims) {
            if (claim.disclaimer_required && claim.disclaimer_text) {
                // If content references keywords in the claim, attach disclaimer
                const keywords = claim.claim_text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
                const hasMatch = keywords.some((kw: string) => content.toLowerCase().includes(kw));
                if (hasMatch && !disclaimers.includes(claim.disclaimer_text)) {
                    disclaimers.push(claim.disclaimer_text);
                }
            }
        }

        return {
            valid: violations.length === 0,
            violations,
            disclaimers,
            requiresDisclaimer: disclaimers.length > 0
        };
    }

    /**
     * Lists approved claims for a workspace.
     */
    public static async getApprovedClaims(workspaceId: string): Promise<any[]> {
        const { rows } = await db.query(
            `SELECT * FROM claims_library WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [workspaceId]
        );
        return rows;
    }

    /**
     * Adds a new claim to the library.
     */
    public static async addClaim(
        workspaceId: string,
        claimText: string,
        category = 'GENERAL',
        disclaimerRequired = false,
        disclaimerText: string | null = null,
        approvedBy: string | null = null
    ): Promise<any> {
        const { rows } = await db.query(
            `INSERT INTO claims_library (
                workspace_id, claim_text, claim_category, status, disclaimer_required, disclaimer_text, approved_by
            ) VALUES ($1, $2, $3, 'APPROVED', $4, $5, $6)
            RETURNING *`,
            [workspaceId, claimText.trim(), category, disclaimerRequired, disclaimerText, approvedBy]
        );
        return rows[0];
    }

    /**
     * Deletes a claim from the library.
     */
    public static async deleteClaim(workspaceId: string, claimId: string): Promise<boolean> {
        const { rowCount } = await db.query(
            `DELETE FROM claims_library WHERE id = $1 AND workspace_id = $2`,
            [claimId, workspaceId]
        );
        return (rowCount ?? 0) > 0;
    }
}
