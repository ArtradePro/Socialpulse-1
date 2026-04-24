import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import type { AnalyticsSummary, Platform } from '../types';

type Range = '7d' | '14d' | '30d' | '90d';

const RANGES: { label: string; value: Range }[] = [
    { label: '7D', value: '7d' },
    { label: '14D', value: '14d' },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
];

const PLATFORM_COLORS: Record<Platform, string> = {
    twitter:   '#1DA1F2',
    instagram: '#E1306C',
    linkedin:  '#0077B5',
    facebook:  '#1877F2',
};

const PLATFORM_EMOJI: Record<Platform, string> = {
    twitter:   '🐦',
    instagram: '📸',
    linkedin:  '💼',
    facebook:  '👥',
};

interface MetricRowProps {
    label: string;
    value: number | string;
    emoji: string;
    highlight?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, emoji, highlight }) => (
    <View style={[styles.metricRow, highlight && styles.metricRowHighlight]}>
        <Text style={styles.metricEmoji}>{emoji}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]}>
            {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
    </View>
);

export const AnalyticsScreen: React.FC = () => {
    const [range, setRange]           = useState<Range>('7d');
    const [analytics, setAnalytics]   = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError]           = useState<string | null>(null);

    const load = useCallback(async (silent = false): Promise<void> => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const { data } = await api.get<{ data: AnalyticsSummary }>(
                `/analytics/dashboard?range=${range}`
            );
            setAnalytics(data.data);
        } catch {
            setError('Failed to load analytics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = (): void => {
        setRefreshing(true);
        load(true);
    };

    const engagementPct = analytics
        ? `${(analytics.engagementRate ?? 0).toFixed(2)}%`
        : '—';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
            >
                <Text style={styles.pageTitle}>Analytics</Text>

                {/* Range selector */}
                <View style={styles.rangeRow}>
                    {RANGES.map(({ label, value }) => (
                        <TouchableOpacity
                            key={value}
                            style={[styles.rangeBtn, range === value && styles.rangeBtnActive]}
                            onPress={() => setRange(value)}
                        >
                            <Text style={[styles.rangeBtnText, range === value && styles.rangeBtnTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
                ) : error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={() => load()}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : analytics ? (
                    <>
                        {/* Overview card */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Overview</Text>
                            <MetricRow label="Total Posts"       value={analytics.totalPosts}       emoji="📝" />
                            <MetricRow label="Total Likes"       value={analytics.totalLikes}       emoji="❤️" />
                            <MetricRow label="Total Comments"    value={analytics.totalComments}    emoji="💬" />
                            <MetricRow label="Total Shares"      value={analytics.totalShares}      emoji="🔁" />
                            <MetricRow label="Total Impressions" value={analytics.totalImpressions} emoji="👁️" />
                            <MetricRow label="Engagement Rate"   value={engagementPct}              emoji="📈" highlight />
                        </View>

                        {/* Platform breakdown */}
                        {analytics.platformBreakdown.length > 0 && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>By Platform</Text>
                                {analytics.platformBreakdown.map((pb) => {
                                    const color = PLATFORM_COLORS[pb.platform] ?? '#6B7280';
                                    const emoji = PLATFORM_EMOJI[pb.platform] ?? '🌐';
                                    return (
                                        <View key={pb.platform} style={styles.platformRow}>
                                            <View style={[styles.platformDot, { backgroundColor: color }]} />
                                            <Text style={styles.platformName}>
                                                {emoji} {pb.platform}
                                            </Text>
                                            <View style={styles.platformStats}>
                                                <View style={styles.platformStat}>
                                                    <Text style={styles.platformStatValue}>{pb.posts}</Text>
                                                    <Text style={styles.platformStatLabel}>posts</Text>
                                                </View>
                                                <View style={styles.platformStat}>
                                                    <Text style={styles.platformStatValue}>{pb.likes.toLocaleString()}</Text>
                                                    <Text style={styles.platformStatLabel}>likes</Text>
                                                </View>
                                                <View style={styles.platformStat}>
                                                    <Text style={styles.platformStatValue}>{pb.impressions.toLocaleString()}</Text>
                                                    <Text style={styles.platformStatLabel}>impressions</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Empty state */}
                        {analytics.totalPosts === 0 && (
                            <Text style={styles.emptyText}>
                                No published posts yet. Analytics will appear once you publish content.
                            </Text>
                        )}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scroll:    { paddingHorizontal: 20, paddingBottom: 40 },
    pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 16 },

    rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    rangeBtn: {
        flex: 1, borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 10, paddingVertical: 8, alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    rangeBtnActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    rangeBtnText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
    rangeBtnTextActive: { color: '#FFFFFF' },

    card: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },

    metricRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    metricRowHighlight:  { backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0, marginTop: 4 },
    metricEmoji:         { fontSize: 16, width: 28 },
    metricLabel:         { flex: 1, fontSize: 14, color: '#374151' },
    metricValue:         { fontSize: 15, fontWeight: '700', color: '#111827' },
    metricValueHighlight:{ color: '#7C3AED' },

    platformRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
        gap: 8,
    },
    platformDot:  { width: 8, height: 8, borderRadius: 4 },
    platformName: { flex: 1, fontSize: 14, color: '#374151', textTransform: 'capitalize', fontWeight: '500' },
    platformStats: { flexDirection: 'row', gap: 12 },
    platformStat:  { alignItems: 'center' },
    platformStatValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
    platformStatLabel: { fontSize: 10, color: '#9CA3AF' },

    errorBox:  { alignItems: 'center', paddingTop: 40 },
    errorText: { color: '#EF4444', fontSize: 14, marginBottom: 12 },
    retryText: { color: '#7C3AED', fontWeight: '600', fontSize: 14 },
    emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10 },
});
