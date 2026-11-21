import sharp from 'sharp';
import axios from 'axios';

export type BannerTheme = 
    | 'luxury_marble' 
    | 'clinical_clean' 
    | 'nature_dew' 
    | 'neon' 
    | 'glass' 
    | 'modern'
    | 'takealot_review'
    | 'us_vs_them'
    | 'urgency_deal'
    | 'clinical_proof'
    | 'social_proof_tweet';

export type BannerRatio = '1:1' | '9:16' | '16:9';

export interface ZeelyBannerInput {
    imageUrl?: string;
    productTitle: string;
    headline: string;
    subheadline?: string;
    badgeText?: string;
    priceText?: string;
    ctaText?: string;
    theme?: BannerTheme;
    aspectRatio?: BannerRatio;
    disclaimerText?: string;
    isFNM?: boolean;
    quoteText?: string;
    authorName?: string;
    authorHandle?: string;
    comparisonPoints?: { label: string; ourProduct: string; others: string }[];
}

export interface BatchBannerResult {
    style: string;
    title: string;
    buffer: Buffer;
    width: number;
    height: number;
    mimeType: string;
}

export const generateZeelyAdBanner = async (input: ZeelyBannerInput): Promise<Buffer> => {
    const {
        imageUrl,
        productTitle,
        headline,
        subheadline,
        badgeText = 'TOP SELLER',
        priceText,
        ctaText = 'SHOP NOW',
        theme = 'luxury_marble',
        aspectRatio = '1:1',
        disclaimerText,
        isFNM = false,
        quoteText,
        authorName,
        authorHandle,
        comparisonPoints
    } = input;

    let width = 1080;
    let height = 1080;
    if (aspectRatio === '9:16') {
        width = 1080;
        height = 1920;
    } else if (aspectRatio === '16:9') {
        width = 1200;
        height = 675;
    }

    const baseBackground = await createStudioBackground(width, height, theme);
    const composites: sharp.OverlayOptions[] = [];

    // Composite Product Image
    if (imageUrl) {
        try {
            let productBuf: Buffer;
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 5000 });
                productBuf = Buffer.from(response.data);
            } else {
                // Local file path
                const fs = await import('fs/promises');
                productBuf = await fs.readFile(imageUrl);
            }

            const scale = theme === 'us_vs_them' ? 0.38 : theme === 'takealot_review' ? 0.48 : 0.55;
            const productWidth = Math.round(width * scale);
            const productHeight = Math.round(height * scale);

            const resizedProduct = await sharp(productBuf)
                .resize(productWidth, productHeight, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            let leftPos = Math.round((width - productWidth) / 2);
            let topPos = Math.round(height * 0.38);

            if (theme === 'takealot_review') {
                leftPos = Math.round(width * 0.52);
                topPos = Math.round(height * 0.34);
            } else if (theme === 'us_vs_them') {
                leftPos = Math.round(width * 0.08);
                topPos = Math.round(height * 0.45);
            }

            composites.push({
                input: resizedProduct,
                top: topPos,
                left: leftPos,
                blend: 'over'
            });
        } catch (err) {
            console.warn('[BannerService] Could not composite product image, rendering vector fallback:', err);
        }
    }

    // Generate Direct-Response SVG vector overlay
    const svgOverlay = generateDirectResponseSvgOverlay({
        width,
        height,
        productTitle,
        headline,
        subheadline: subheadline || (isFNM ? "Love The Skin You're In." : "Premium High-Efficacy Formula"),
        badgeText,
        priceText,
        ctaText,
        theme,
        disclaimerText,
        aspectRatio,
        quoteText,
        authorName,
        authorHandle,
        comparisonPoints
    });

    composites.push({
        input: Buffer.from(svgOverlay.trim()),
        blend: 'over'
    });

    return sharp(baseBackground)
        .composite(composites)
        .png()
        .toBuffer();
};

export const generateStaticBanner = async (input: {
    imageUrl?: string;
    discountText: string;
    promoText: string;
    theme: 'modern' | 'neon' | 'glass';
}): Promise<Buffer> => {
    return generateZeelyAdBanner({
        imageUrl: input.imageUrl,
        productTitle: 'Special Promotion',
        headline: input.promoText,
        badgeText: input.discountText,
        theme: input.theme === 'neon' ? 'neon' : 'modern',
        aspectRatio: '1:1'
    });
};

/**
 * Generates an entire Zeely-style batch of 6 distinct high-converting ad styles at once.
 */
export const generateZeelyAdBatch = async (
    baseInput: Omit<ZeelyBannerInput, 'theme'>
): Promise<BatchBannerResult[]> => {
    const styles: { style: BannerTheme; title: string; badge: string; cta: string }[] = [
        {
            style: 'takealot_review',
            title: 'Takealot 5-Star Verified Review Card',
            badge: '5.0 ★ TOP RATED IN SA',
            cta: 'BUY ON TAKEALOT'
        },
        {
            style: 'us_vs_them',
            title: 'Us vs. Them Direct Comparison Ad',
            badge: 'HIGIENLABS FORMULATION',
            cta: 'SEE THE PROOF'
        },
        {
            style: 'urgency_deal',
            title: 'Urgency & Fast Dispatch Ad',
            badge: 'LIMITED TIME DEAL',
            cta: 'CLAIM OFFER NOW'
        },
        {
            style: 'clinical_proof',
            title: 'Higienlabs Clinical Trust Ad',
            badge: 'LABORATORY BACKED',
            cta: 'SHOP HIGIENLABS'
        },
        {
            style: 'luxury_marble',
            title: 'DTC Premium Lifestyle Ad',
            badge: 'LOVE THE SKIN YOU\'RE IN',
            cta: 'DISCOVER RITUAL'
        },
        {
            style: 'social_proof_tweet',
            title: 'Viral Social Media Review Card',
            badge: 'VIRAL ON TIKTOK',
            cta: 'ORDER THE DUO'
        }
    ];

    const results: BatchBannerResult[] = [];

    for (const s of styles) {
        try {
            const buf = await generateZeelyAdBanner({
                ...baseInput,
                theme: s.style,
                badgeText: s.badge,
                ctaText: s.cta
            });
            results.push({
                style: s.style,
                title: s.title,
                buffer: buf,
                width: 1080,
                height: 1080,
                mimeType: 'image/png'
            });
        } catch (err) {
            console.error(`[BannerService] Failed to generate banner style ${s.style}:`, err);
        }
    }

    return results;
};

const createStudioBackground = async (width: number, height: number, theme: BannerTheme): Promise<Buffer> => {
    let color1 = '#F8FAFC';
    let color2 = '#E2E8F0';

    if (theme === 'luxury_marble') {
        color1 = '#FFFFFF';
        color2 = '#F1F5F9';
    } else if (theme === 'takealot_review') {
        color1 = '#F0FDFA';
        color2 = '#E0F2FE';
    } else if (theme === 'us_vs_them') {
        color1 = '#0A192F';
        color2 = '#0F2744';
    } else if (theme === 'urgency_deal') {
        color1 = '#FFFBEB';
        color2 = '#FEF3C7';
    } else if (theme === 'clinical_proof') {
        color1 = '#F8FAFC';
        color2 = '#EEF2F6';
    } else if (theme === 'social_proof_tweet') {
        color1 = '#FFFFFF';
        color2 = '#F8FAFC';
    } else if (theme === 'neon') {
        color1 = '#090514';
        color2 = '#1E0B36';
    }

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bgGrad)" />
        </svg>
    `;

    return sharp(Buffer.from(svg.trim())).png().toBuffer();
};

const escapeXml = (unsafe: string) =>
    (unsafe || '').replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });

const generateDirectResponseSvgOverlay = (opts: {
    width: number;
    height: number;
    productTitle: string;
    headline: string;
    subheadline: string;
    badgeText: string;
    priceText?: string;
    ctaText: string;
    theme: BannerTheme;
    disclaimerText?: string;
    aspectRatio: BannerRatio;
    quoteText?: string;
    authorName?: string;
    authorHandle?: string;
    comparisonPoints?: { label: string; ourProduct: string; others: string }[];
}): string => {
    const { width, height, productTitle, headline, subheadline, badgeText, priceText, ctaText, theme, quoteText } = opts;

    const escBadge = escapeXml(badgeText.toUpperCase());
    const escTitle = escapeXml(productTitle);
    const escHeadline = escapeXml(headline);
    const escSub = escapeXml(subheadline);
    const escCta = escapeXml(ctaText.toUpperCase());
    const escPrice = priceText ? escapeXml(priceText) : '';
    const escQuote = escapeXml(quoteText || "Cleared my gym sweat odor from Day 1. Will never use normal soap again!");

    // 1. Takealot Review Card Style
    if (theme === 'takealot_review') {
        return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .badge { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px; fill: #0D9488; }
                .title { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 38px; fill: #0A192F; }
                .stars { font-size: 32px; fill: #F59E0B; }
                .quote { font-family: 'Georgia', serif; font-style: italic; font-size: 26px; fill: #1E293B; }
                .author { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 20px; fill: #059669; }
                .cta { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 24px; fill: #FFFFFF; }
                .price { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; font-size: 34px; fill: #0A192F; }
            </style>

            <!-- Top Header Pill -->
            <rect x="50" y="50" width="300" height="48" rx="24" fill="#CCFBF1" />
            <text x="200" y="82" text-anchor="middle" class="badge">★ ${escBadge}</text>

            <!-- Review Card Box on Left -->
            <rect x="50" y="125" width="460" height="420" rx="24" fill="#FFFFFF" filter="drop-shadow(0 12px 24px rgba(10,25,47,0.08))" stroke="#E2E8F0" stroke-width="2" />
            
            <g transform="translate(80, 170)">
                <text x="0" y="0" class="stars">★★★★★</text>
                <text x="0" y="45" class="title">"Life Changer"</text>
                <foreignObject x="0" y="70" width="400" height="200">
                    <p xmlns="http://www.w3.org/1999/xhtml" style="font-family: Georgia, serif; font-size: 22px; line-height: 1.45; color: #334155; margin: 0;">
                        "${escQuote}"
                    </p>
                </foreignObject>
                <text x="0" y="320" class="author">✓ Verified Takealot Buyer</text>
            </g>

            <!-- Bottom Action Banner -->
            <g transform="translate(50, ${height - 150})">
                <rect width="${width - 100}" height="90" rx="20" fill="#0A192F" />
                <text x="40" y="56" fill="#F8FAFC" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" font-size="24px">${escTitle}</text>
                ${escPrice ? `<text x="${width - 450}" y="56" class="price" fill="#14B8A6">${escPrice}</text>` : ''}
                <rect x="${width - 360}" y="15" width="220" height="60" rx="14" fill="#0D9488" />
                <text x="${width - 250}" y="52" text-anchor="middle" class="cta">${escCta} →</text>
            </g>
        </svg>
        `;
    }

    // 2. Us vs. Them Comparison Style
    if (theme === 'us_vs_them') {
        return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .badge { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 20px; fill: #14B8A6; }
                .main-title { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 40px; fill: #FFFFFF; }
                .table-hdr { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 22px; }
                .table-row { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600; font-size: 20px; fill: #E2E8F0; }
                .cta { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 24px; fill: #FFFFFF; }
            </style>

            <rect x="50" y="50" width="340" height="44" rx="22" fill="rgba(20, 184, 166, 0.15)" stroke="#14B8A6" stroke-width="1.5" />
            <text x="220" y="79" text-anchor="middle" class="badge">⚔️ ${escBadge}</text>

            <text x="50" y="145" class="main-title">${escHeadline}</text>

            <!-- Comparison Table on Right -->
            <g transform="translate(480, 200)">
                <rect width="550" height="480" rx="24" fill="rgba(15, 23, 42, 0.85)" stroke="#334155" stroke-width="2" />
                
                <!-- Columns -->
                <text x="40" y="55" class="table-hdr" fill="#94A3B8">FEATURE</text>
                <text x="250" y="55" class="table-hdr" fill="#14B8A6">OUR DUO</text>
                <text x="420" y="55" class="table-hdr" fill="#EF4444">OTHERS</text>
                <line x1="20" y1="75" x2="530" y2="75" stroke="#334155" stroke-width="1.5" />

                <!-- Row 1 -->
                <text x="40" y="130" class="table-row">Bacteria Defense</text>
                <text x="280" y="130" font-size="28px" fill="#14B8A6">✓ 24h</text>
                <text x="450" y="130" font-size="28px" fill="#EF4444">✗ None</text>

                <!-- Row 2 -->
                <text x="40" y="210" class="table-row">Skin Barrier Soothing</text>
                <text x="280" y="210" font-size="28px" fill="#14B8A6">✓ Active</text>
                <text x="450" y="210" font-size="28px" fill="#EF4444">✗ Dries out</text>

                <!-- Row 3 -->
                <text x="40" y="290" class="table-row">Fast Next-Day Delivery</text>
                <text x="280" y="290" font-size="28px" fill="#14B8A6">✓ Takealot</text>
                <text x="450" y="290" font-size="28px" fill="#EF4444">✗ Slow</text>

                <!-- Row 4 -->
                <text x="40" y="370" class="table-row">Clinical Bio-Actives</text>
                <text x="280" y="370" font-size="28px" fill="#14B8A6">✓ Proven</text>
                <text x="450" y="370" font-size="28px" fill="#EF4444">✗ Perfume</text>
            </g>

            <!-- Bottom CTA -->
            <g transform="translate(50, ${height - 150})">
                <rect width="${width - 100}" height="85" rx="18" fill="#14B8A6" />
                <text x="${(width - 100) / 2}" y="52" text-anchor="middle" class="cta">${escCta} →</text>
            </g>
        </svg>
        `;
    }

    // Default High-Converting Direct-Response Overlay
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .badge { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 22px; fill: #FFFFFF; }
                .title { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 42px; fill: #0A192F; }
                .headline { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 32px; fill: #0D9488; }
                .sub { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 500; font-size: 24px; fill: #475569; }
                .cta { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 26px; fill: #FFFFFF; }
                .price { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; font-size: 38px; fill: #059669; }
            </style>

            <!-- Top Badge Tag -->
            <rect x="50" y="50" width="360" height="54" rx="14" fill="#0D9488" />
            <text x="230" y="86" text-anchor="middle" class="badge">★ ${escBadge} ★</text>

            <!-- Product Title & Hook -->
            <text x="50" y="160" class="title">${escTitle}</text>
            <text x="50" y="210" class="headline">${escHeadline}</text>
            <text x="50" y="255" class="sub">${escSub}</text>

            <!-- Bottom Action Box -->
            <g transform="translate(50, ${height - 160})">
                <rect width="${width - 100}" height="90" rx="20" fill="#FFFFFF" stroke="#0D9488" stroke-width="3" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.08))" />
                ${escPrice ? `<text x="50" y="58" class="price">${escPrice}</text>` : ''}
                <rect x="${width - 380}" y="15" width="240" height="60" rx="14" fill="#0D9488" />
                <text x="${width - 260}" y="53" text-anchor="middle" class="cta">${escCta} →</text>
            </g>
        </svg>
    `;
};
