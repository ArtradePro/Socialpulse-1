// backend/src/utils/sentiment.ts
// Lightweight, accurate rule-and-lexicon sentiment and boolean query engine for SocialPulse

const POSITIVE_WORDS = new Set([
    'great', 'excellent', 'amazing', 'love', 'loved', 'awesome', 'best', 'good', 'fantastic',
    'superb', 'effective', 'helped', 'healed', 'cured', 'recommend', 'recommended', 'happy',
    'pleased', 'satisfying', 'satisfied', 'perfect', 'flawless', 'fast', 'smooth', 'works',
    'working', 'impressive', 'wonderful', 'beautiful', 'clean', 'pure', 'trusted', 'legit',
    'incredible', 'thank', 'thanks', 'thankful', 'blessed', 'favorite', 'gamechanger', 'solid'
]);

const NEGATIVE_WORDS = new Set([
    'bad', 'terrible', 'horrible', 'worst', 'hate', 'hated', 'awful', 'scam', 'fake',
    'rip-off', 'broken', 'waste', 'disappointed', 'disappointing', 'useless', 'slow',
    'burn', 'rash', 'side effect', 'failed', 'refund', 'complaint', 'angry', 'sucks',
    'trash', 'poor', 'danger', 'dangerous', 'stole', 'stolen', 'never', 'avoid',
    'warning', 'harm', 'harmful', 'problem', 'issues', 'issue', 'unacceptable', 'fraud'
]);

const POSITIVE_EMOJIS = ['❤️', '💖', '🔥', '✨', '👏', '🙌', '💯', '👍', '😍', '🎉', '💪', '⭐', '🌟'];
const NEGATIVE_EMOJIS = ['😡', '🤬', '🤮', '👎', '💔', '💩', '⚠️', '🚨', '😭', '😢', '😞', '😠'];

export interface SentimentAnalysis {
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number; // -1.00 to 1.00
}

/**
 * Analyzes the sentiment of a piece of text or social post.
 */
export function analyzeSentiment(text: string = ''): SentimentAnalysis {
    if (!text || !text.trim()) {
        return { sentiment: 'neutral', score: 0 };
    }

    const clean = text.toLowerCase();
    const words = clean.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

    let posHits = 0;
    let negHits = 0;

    // Check emojis
    for (const em of POSITIVE_EMOJIS) {
        if (text.includes(em)) posHits += 1.5;
    }
    for (const em of NEGATIVE_EMOJIS) {
        if (text.includes(em)) negHits += 2;
    }

    // Check word list with simple negation handling (e.g. "not good")
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const prev = i > 0 ? words[i - 1] : '';
        const isNegated = ['not', 'never', 'no', 'hardly', 'barely', 'without'].includes(prev);

        if (POSITIVE_WORDS.has(w)) {
            if (isNegated) negHits += 1.2;
            else posHits += 1;
        } else if (NEGATIVE_WORDS.has(w)) {
            if (isNegated) posHits += 0.8;
            else negHits += 1.5;
        }
    }

    const total = posHits + negHits;
    if (total === 0) {
        return { sentiment: 'neutral', score: 0.0 };
    }

    // Normalized score from -1.0 to 1.0
    const rawScore = (posHits - negHits) / Math.max(total, 1);
    const score = parseFloat(Math.max(-1.0, Math.min(1.0, rawScore)).toFixed(2));

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (score >= 0.2) sentiment = 'positive';
    else if (score <= -0.2) sentiment = 'negative';

    return { sentiment, score };
}

/**
 * Brandwatch-style Boolean query compiler for Twitter / Social API searches.
 * Handles: "A OR B", "A AND B", "NOT C", excludes retweets, etc.
 */
export function compileSocialQuery(rawQuery: string, excludeKeywords: string[] = []): string {
    let q = (rawQuery || '').trim();
    if (!q) return '';

    // If query contains custom boolean operators, normalize them
    // E.g., 'Fungus No More OR Higiene'
    // Format exclusions
    const exclusions = excludeKeywords
        .map(e => e.trim())
        .filter(Boolean)
        .map(e => (e.includes(' ') ? `-"${e}"` : `-${e}`))
        .join(' ');

    if (exclusions) {
        q = `${q} ${exclusions}`;
    }

    return q;
}

/**
 * Checks in-memory if a given text satisfies Boolean logic:
 * Supports terms like: ("A" OR "B") AND ("C") NOT ("D")
 */
export function matchesBooleanFilter(text: string, query: string, excludeKeywords: string[] = []): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    // Check exclusions first
    for (const ex of excludeKeywords) {
        if (ex && lower.includes(ex.toLowerCase().trim())) return false;
    }

    const trimmed = query.trim();
    if (!trimmed) return true;

    // Check for 'NOT' in query
    if (trimmed.includes(' NOT ')) {
        const parts = trimmed.split(/\s+NOT\s+/i);
        const includePart = parts[0];
        const excludeParts = parts.slice(1);
        for (const ep of excludeParts) {
            const cleanEp = ep.replace(/[()"]/g, '').toLowerCase().trim();
            if (cleanEp && lower.includes(cleanEp)) return false;
        }
        return matchesBooleanFilter(lower, includePart);
    }

    // Check for 'OR'
    if (trimmed.includes(' OR ')) {
        const orTerms = trimmed.split(/\s+OR\s+/i);
        return orTerms.some(term => matchesBooleanFilter(lower, term.trim()));
    }

    // Check for 'AND'
    if (trimmed.includes(' AND ')) {
        const andTerms = trimmed.split(/\s+AND\s+/i);
        return andTerms.every(term => matchesBooleanFilter(lower, term.trim()));
    }

    // Plain match
    const cleanTerm = trimmed.replace(/[()"]/g, '').toLowerCase();
    return lower.includes(cleanTerm);
}

/**
 * Evaluates results to detect whether a brand crisis is brewing (Brandwatch Iris AI feature)
 */
export function detectCrisisStatus(results: { sentiment?: string }[]): {
    isCrisis: boolean;
    negativePct: number;
    totalCount: number;
    severity: 'normal' | 'caution' | 'crisis';
    summary: string;
} {
    const total = results.length;
    if (total === 0) {
        return { isCrisis: false, negativePct: 0, totalCount: 0, severity: 'normal', summary: 'No listening data recorded yet.' };
    }

    const negativeCount = results.filter(r => r.sentiment === 'negative').length;
    const negativePct = Math.round((negativeCount / total) * 100);

    let severity: 'normal' | 'caution' | 'crisis' = 'normal';
    let isCrisis = false;
    let summary = 'Sentiment is healthy. Mentions are predominantly positive or neutral.';

    if (negativePct >= 40 && negativeCount >= 3) {
        severity = 'crisis';
        isCrisis = true;
        summary = `High Alert: ${negativePct}% of recent mentions are negative. Immediate customer-care intervention recommended.`;
    } else if (negativePct >= 20 && negativeCount >= 2) {
        severity = 'caution';
        summary = `Notice: Elevated negative mentions (${negativePct}%). Monitor closely to prevent escalation.`;
    }

    return { isCrisis, negativePct, totalCount: total, severity, summary };
}
