import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { AnalyticsSummary, Post } from '../types';

const PLATFORM_COLORS: Record<string, string> = {
    twitter:   '#1DA1F2',
    instagram: '#E1306C',
    linkedin:  '#0077B5',
    facebook:  '#1877F2',
};

const STATUS_COLORS: Record<string, string> = {
    published: '#10B981',
    scheduled: '#F59E0B',
    draft:     '#6B7280',
    failed:    '#EF4444',
    partial:   '#F97316',
};

interface StatCardProps {
    label: string;
    value: string | number;
    emoji: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, emoji }) => (
    <View style={styles.statCard}>
        <Text style={styles.statEmoji}>{emoji}</Text>
        <Text style={styles.statValue}>{value.toLocaleString()}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

interface PostRowProps {
    post: Post;
}

const PostRow: React.FC<PostRowProps> = ({ post }) => (
    <View style={styles.postRow}>
        <View style={styles.postContent}>
            <Text style={styles.postText} numberOfLines={2}>{post.content}</Text>
            <View style={styles.postMeta}>
                {post.platforms.map((p) => (
                    <View key={p} style={[styles.platformBadge, { backgroundColor: PLATFORM_COLORS[p] + '22' }]}>
                        <Text style={[styles.platformBadgeText, { color: PLATFORM_COLORS[p] }]}>
                            {p}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[post.status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[post.status] }]}>
                {post.status}
            </Text>
        </View>
    </View>
);

export const DashboardScreen: React.FC = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError]         = useState<string | null>(null);

    const load = useCallback(async (silent = false): Promise<void> => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const { data } = await api.get<{ data: AnalyticsSummary }>('/analytics/dashboard?range=7d');
            setAnalytics(data.data);
        } catch {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const onRefresh = (): void => {
        setRefreshing(true);
        load(true);
    };

    const avatarUri = user?.avatarUrl ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName ?? 'U')}&background=7C3AED&color=fff`;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Good {getTimeOfDay()} 👋</Text>
                        <Text style={styles.userName}>{user?.fullName ?? 'User'}</Text>
                    </View>
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                </View>

                {/* AI Credits pill */}
                <View style={styles.creditPill}>
                    <Text style={styles.creditText}>⚡ {user?.aiCredits ?? 0} AI credits remaining</Text>
                </View>

                {/* Stats */}
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
                        <Text style={styles.sectionTitle}>Last 7 days</Text>
                        <View style={styles.statsGrid}>
                            <StatCard label="Posts" value={analytics.totalPosts} emoji="📝" />
                            <StatCard label="Likes" value={analytics.totalLikes} emoji="❤️" />
                            <StatCard label="Comments" value={analytics.totalComments} emoji="💬" />
                            <StatCard label="Impressions" value={analytics.totalImpressions} emoji="👁️" />
                        </View>

                        <Text style={styles.sectionTitle}>Recent Posts</Text>
                        {analytics.recentPosts.length === 0 ? (
                            <Text style={styles.emptyText}>No posts yet. Create your first post in the Studio tab.</Text>
                        ) : (
                            analytics.recentPosts.slice(0, 5).map((post) => (
                                <PostRow key={post.id} post={post} />
                            ))
                        )}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};

function getTimeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scroll:    { paddingHorizontal: 20, paddingBottom: 32 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    greeting: { fontSize: 13, color: '#6B7280' },
    userName:  { fontSize: 20, fontWeight: '700', color: '#111827' },
    avatar:    { width: 44, height: 44, borderRadius: 22 },

    creditPill: {
        backgroundColor: '#EDE9FE',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
        marginBottom: 24,
    },
    creditText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },

    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 8,
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        minWidth: '44%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    statEmoji: { fontSize: 22, marginBottom: 6 },
    statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    postRow: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    postContent: { flex: 1, marginRight: 10 },
    postText: { fontSize: 14, color: '#374151', lineHeight: 20 },
    postMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
    platformBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    platformBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

    errorBox: { alignItems: 'center', paddingTop: 40 },
    errorText: { color: '#EF4444', fontSize: 14, marginBottom: 12 },
    retryText: { color: '#7C3AED', fontWeight: '600', fontSize: 14 },
    emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
