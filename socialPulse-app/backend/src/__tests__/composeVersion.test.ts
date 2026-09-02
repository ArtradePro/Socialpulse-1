describe('Docker Compose Version Requirement Evaluator (>= 2.24.4)', () => {
    function isComposeVersionSupported(raw: string): boolean {
        const match = raw.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);
        if (!match) return false;
        const [_, major, minor, patch] = match.map(Number);
        return (major > 2) ||
               (major === 2 && minor > 24) ||
               (major === 2 && minor === 24 && patch >= 4);
    }

    it('rejects versions below 2.24.4', () => {
        expect(isComposeVersionSupported('2.20.0')).toBe(false);
        expect(isComposeVersionSupported('2.24.0')).toBe(false);
        expect(isComposeVersionSupported('2.24.3')).toBe(false);
        expect(isComposeVersionSupported('1.29.2')).toBe(false);
        expect(isComposeVersionSupported('2.0.0')).toBe(false);
        expect(isComposeVersionSupported('2.23.99')).toBe(false);
    });

    it('accepts 2.24.4 and above', () => {
        expect(isComposeVersionSupported('2.24.4')).toBe(true);
        expect(isComposeVersionSupported('2.24.5')).toBe(true);
        expect(isComposeVersionSupported('2.25.0')).toBe(true);
        expect(isComposeVersionSupported('2.27.0')).toBe(true);
        expect(isComposeVersionSupported('3.0.0')).toBe(true);
        expect(isComposeVersionSupported('Docker Compose version v2.24.4')).toBe(true);
        expect(isComposeVersionSupported('Docker Compose version 2.26.1-desktop.1')).toBe(true);
    });

    it('rejects unparseable or empty versions', () => {
        expect(isComposeVersionSupported('')).toBe(false);
        expect(isComposeVersionSupported('unknown-version')).toBe(false);
    });
});
