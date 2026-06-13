import sharp from 'sharp';
import axios from 'axios';

interface BannerInput {
    imageUrl?: string;
    discountText: string;
    promoText: string;
    theme: 'modern' | 'neon' | 'glass';
}

export const generateStaticBanner = async (input: BannerInput): Promise<Buffer> => {
    const { imageUrl, discountText, promoText, theme } = input;
    const width = 1080;
    const height = 1080;

    let baseImage: Buffer;

    if (imageUrl) {
        try {
            // Fetch product image
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            baseImage = Buffer.from(response.data);
        } catch (err) {
            console.warn('[BannerService] Failed to fetch product image, using fallback background:', err);
            baseImage = await createFallbackBackground(width, height, theme);
        }
    } else {
        baseImage = await createFallbackBackground(width, height, theme);
    }

    // Resize base image to 1080x1080
    const resizedBase = await sharp(baseImage)
        .resize(width, height, { fit: 'cover' })
        .toBuffer();

    // Create SVG overlay based on theme
    const svgOverlay = generateSvgOverlay(width, height, discountText, promoText, theme);

    // Composite overlay on base image
    const finalImage = await sharp(resizedBase)
        .composite([{ input: Buffer.from(svgOverlay.trim()), blend: 'over' }])
        .png()
        .toBuffer();

    return finalImage;
};

// Creates a fallback background gradient if no product image is provided
const createFallbackBackground = async (width: number, height: number, theme: string): Promise<Buffer> => {
    let color1 = '#1e1b4b'; // dark blue
    let color2 = '#311042'; // dark purple

    if (theme === 'neon') {
        color1 = '#090514';
        color2 = '#1f073a';
    } else if (theme === 'glass') {
        color1 = '#fbcfe8'; // light pink
        color2 = '#c084fc'; // light purple
    } else {
        color1 = '#f3f4f6'; // modern gray
        color2 = '#e5e7eb';
    }

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad)" />
        </svg>
    `;

    return Buffer.from(svg.trim());
};

// Generates theme-specific overlay layers
const generateSvgOverlay = (
    width: number,
    height: number,
    discount: string,
    promo: string,
    theme: 'modern' | 'neon' | 'glass'
): string => {
    const escDiscount = escapeXml(discount.toUpperCase());
    const escPromo = escapeXml(promo);

    if (theme === 'neon') {
        // Futuristic Cyberpunk Cyber-Neon Theme
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Outer Neon Glow Border -->
                <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="#8B5CF6" stroke-width="12" rx="24" filter="drop-shadow(0 0 15px #8B5CF6)" />
                <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="#0C8CE9" stroke-width="4" rx="20" filter="drop-shadow(0 0 8px #0C8CE9)" />

                <!-- Discount badge in Top Left with Neon glow -->
                <g filter="drop-shadow(0 0 12px #EC4899)">
                    <rect x="50" y="50" width="260" height="90" rx="16" fill="#EC4899" />
                    <text x="180" y="108" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="36" fill="#FFFFFF" text-anchor="middle">${escDiscount}</text>
                </g>

                <!-- Neon Banner Footer -->
                <g filter="drop-shadow(0 0 20px #8B5CF6)">
                    <rect x="60" y="${height - 220}" width="${width - 120}" height="140" rx="20" fill="#0D0620" stroke="#8B5CF6" stroke-width="4" opacity="0.95" />
                    <!-- Subtitle / CTA -->
                    <text x="${width / 2}" y="${height - 165}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="44" fill="#00F2FE" text-anchor="middle" letter-spacing="2">${escPromo}</text>
                    <text x="${width / 2}" y="${height - 110}" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="24" fill="#A78BFA" text-anchor="middle" letter-spacing="4">LIMITED TIME ONLY • CLICK TO SHOP</text>
                </g>
            </svg>
        `;
    }

    if (theme === 'glass') {
        // Frosted Glassmorphism Theme
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Soft Border -->
                <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#ffffff" stroke-width="6" stroke-opacity="0.4" rx="32" />

                <!-- Circular Frosted Badge -->
                <g>
                    <circle cx="160" cy="160" r="100" fill="#ffffff" fill-opacity="0.25" stroke="#ffffff" stroke-width="3" stroke-opacity="0.5" />
                    <text x="160" y="155" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))">SPECIAL</text>
                    <text x="160" y="195" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="38" fill="#F472B6" text-anchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))">${escDiscount}</text>
                </g>

                <!-- Frosted Glass Footer Panel -->
                <g>
                    <!-- Simulated Blur backing with semi-translucent white -->
                    <rect x="80" y="${height - 240}" width="${width - 160}" height="160" rx="30" fill="#ffffff" fill-opacity="0.15" stroke="#ffffff" stroke-width="2" stroke-opacity="0.3" />
                    <text x="${width / 2}" y="${height - 170}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="46" fill="#ffffff" text-anchor="middle" filter="drop-shadow(0 2px 5px rgba(0,0,0,0.3))">${escPromo}</text>
                    <rect x="${width / 2 - 150}" y="${height - 128}" width="300" height="36" rx="18" fill="#ffffff" fill-opacity="0.8" />
                    <text x="${width / 2}" y="${height - 104}" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="18" fill="#475569" text-anchor="middle">SHOP EXCLUSIVE OFFERS</text>
                </g>
            </svg>
        `;
    }

    // Modern Flat Premium Theme (Default)
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Sleek Minimalist Border Frame -->
            <rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="#000000" stroke-width="4" />
            
            <!-- Modern Square Corner Badge -->
            <g>
                <rect x="40" y="40" width="280" height="100" fill="#0C8CE9" />
                <text x="180" y="103" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="36" fill="#FFFFFF" text-anchor="middle">${escDiscount}</text>
            </g>

            <!-- Flat White Footer Card -->
            <g filter="drop-shadow(0 10px 25px rgba(0,0,0,0.15))">
                <rect x="80" y="${height - 200}" width="${width - 160}" height="120" fill="#FFFFFF" rx="4" />
                <text x="${width / 2}" y="${height - 145}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="38" fill="#111827" text-anchor="middle">${escPromo}</text>
                <line x1="${width / 2 - 100}" y1="${height - 115}" x2="${width / 2 + 100}" y2="${height - 115}" stroke="#0C8CE9" stroke-width="3" />
                <text x="${width / 2}" y="${height - 100}" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="14" fill="#0C8CE9" text-anchor="middle" letter-spacing="3">ORDER ONLINE TODAY</text>
            </g>
        </svg>
    `;
};

const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};
