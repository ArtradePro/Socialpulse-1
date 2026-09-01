import sharp from 'sharp';
import axios from 'axios';

export type BannerTheme = 'luxury_marble' | 'clinical_clean' | 'nature_dew' | 'neon' | 'glass' | 'modern';
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
        isFNM = false
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

    let baseBackground = await createStudioBackground(width, height, theme);

    // If product image is provided, fetch and composite it nicely in the center/right
    const composites: sharp.OverlayOptions[] = [];

    if (imageUrl) {
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 5000 });
            const productBuf = Buffer.from(response.data);

            const productWidth = Math.round(width * 0.55);
            const productHeight = Math.round(height * 0.55);

            const resizedProduct = await sharp(productBuf)
                .resize(productWidth, productHeight, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();

            const leftPos = Math.round((width - productWidth) / 2);
            const topPos = Math.round(height * 0.35);

            composites.push({
                input: resizedProduct,
                top: topPos,
                left: leftPos,
                blend: 'over'
            });
        } catch (err) {
            console.warn('[BannerService] Could not fetch product image, proceeding with text composite:', err);
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
        aspectRatio
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
        theme: input.theme === 'neon' ? 'neon' : input.theme === 'glass' ? 'glass' : 'modern',
        aspectRatio: '1:1'
    });
};

const createStudioBackground = async (width: number, height: number, theme: BannerTheme): Promise<Buffer> => {
    let color1 = '#F8FAFC';
    let color2 = '#E2E8F0';

    if (theme === 'luxury_marble') {
        color1 = '#FAFAFA';
        color2 = '#E5E5E5';
    } else if (theme === 'clinical_clean') {
        color1 = '#F0FDF4';
        color2 = '#DCFCE7';
    } else if (theme === 'nature_dew') {
        color1 = '#ECFDF5';
        color2 = '#D1FAE5';
    } else if (theme === 'neon') {
        color1 = '#090514';
        color2 = '#1E0B36';
    } else if (theme === 'glass') {
        color1 = '#FDF2F8';
        color2 = '#F3E8FF';
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
}): string => {
    const { width, height, productTitle, headline, subheadline, badgeText, priceText, ctaText, disclaimerText } = opts;

    const escBadge = escapeXml(badgeText.toUpperCase());
    const escTitle = escapeXml(productTitle);
    const escHeadline = escapeXml(headline);
    const escSub = escapeXml(subheadline);
    const escCta = escapeXml(ctaText.toUpperCase());
    const escPrice = priceText ? escapeXml(priceText) : '';
    const escDisc = disclaimerText ? escapeXml(disclaimerText) : 'Individual results may vary. Love The Skin You\'re In.';

    const isDark = opts.theme === 'neon';
    const textColor = isDark ? '#FFFFFF' : '#0F172A';
    const subColor = isDark ? '#A78BFA' : '#475569';
    const accentColor = isDark ? '#EC4899' : '#0284C7';

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .badge { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 26px; fill: #FFFFFF; }
                .title { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 42px; fill: ${textColor}; }
                .headline { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 32px; fill: ${accentColor}; }
                .sub { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 500; font-size: 24px; fill: ${subColor}; }
                .cta { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 28px; fill: #FFFFFF; }
                .price { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; font-size: 38px; fill: #16A34A; }
                .disc { font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; fill: #94A3B8; text-anchor: middle; }
            </style>

            <!-- Top Badge Tag -->
            <g>
                <rect x="60" y="60" width="340" height="60" rx="12" fill="${accentColor}" />
                <text x="230" y="100" text-anchor="middle" class="badge">★ ${escBadge} ★</text>
            </g>

            <!-- Product Title & Hook -->
            <text x="60" y="180" class="title">${escTitle}</text>
            <text x="60" y="230" class="headline">${escHeadline}</text>
            <text x="60" y="275" class="sub">${escSub}</text>

            <!-- Bottom Pricing & CTA Box -->
            <g>
                <rect x="60" y="${height - 180}" width="${width - 120}" height="90" rx="20" fill="${isDark ? '#1E1B4B' : '#FFFFFF'}" stroke="${accentColor}" stroke-width="3" filter="drop-shadow(0 8px 16px rgba(0,0,0,0.08))" />
                ${escPrice ? `<text x="100" y="${height - 122}" class="price">${escPrice}</text>` : ''}
                <rect x="${width - 340}" y="${height - 165}" width="240" height="60" rx="14" fill="${accentColor}" />
                <text x="${width - 220}" y="${height - 124}" text-anchor="middle" class="cta">${escCta} →</text>
            </g>

            <!-- Mandatory Compliance Disclaimer -->
            <text x="${width / 2}" y="${height - 40}" class="disc">${escDisc}</text>
        </svg>
    `;
};
