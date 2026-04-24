import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import api from '../services/api';

interface Brand {
    brandName:     string | null;
    brandColor:    string;
    brandLogoUrl:  string | null;
    customDomain:  string | null;
}

const DEFAULT_BRAND: Brand = {
    brandName:    null,
    brandColor:   '#6366f1',
    brandLogoUrl: null,
    customDomain: null,
};

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export const useBrand = (): Brand => useContext(BrandContext);

/**
 * Fetches the active workspace's branding and injects it as CSS custom
 * properties on :root so Tailwind classes and inline styles can use them.
 */
export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { activeId } = useAppSelector(s => s.workspace);
    const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);

    useEffect(() => {
        if (!activeId) { setBrand(DEFAULT_BRAND); return; }
        let cancelled = false;

        api.get(`/workspaces/${activeId}`, {
            headers: { 'X-Workspace-Id': activeId },
        }).then(({ data }) => {
            if (cancelled) return;
            const b: Brand = {
                brandName:    data.brand_name    ?? null,
                brandColor:   data.brand_color   ?? '#6366f1',
                brandLogoUrl: data.brand_logo_url ?? null,
                customDomain: data.custom_domain  ?? null,
            };
            setBrand(b);
            // Apply CSS variables for white-label theming
            document.documentElement.style.setProperty('--brand-color', b.brandColor);
            document.documentElement.style.setProperty(
                '--brand-color-light',
                b.brandColor + '22'   // 13% opacity hex shorthand
            );
        }).catch(() => {
            if (!cancelled) setBrand(DEFAULT_BRAND);
        });

        return () => { cancelled = true; };
    }, [activeId]);

    return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
};
