import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../services/api';
import type { Post, PostStatus, Platform } from '../types';

interface PostsResponse {
    data: Post[];
    total: number;
    page: number;
    limit: number;
}

const STATUS_COLORS: Record<PostStatus, string> = {
    published: '#10B981',
    scheduled: '#F59E0B',
    draft:     '#6B7280',
    failed:    '#EF4444',
    partial:   '#F97316',
};

const PLATFORM_COLORS: Record<Platform, string> = {
    twitter:   '#1DA1F2',
    instagram: '#E1306C',
    linkedin:  '#0077B5',
    facebook:  '#1877F2',
};

type FilterStatus = PostStatus | 'all';

const STATUS_FILTERS: FilterStatus[] = ['all', 'scheduled', 'published', 'draft', 'failed'];

const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface PostCardProps {
    post: Post;
    onDelete: (id: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onDelete }) => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[post.status] + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[post.status] }]}>
                    {post.status}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(post.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.cardContent} numberOfLines={3}>{post.content}</Text>

        <View style={styles.cardFooter}>
            <View style={styles.platforms}>
                {post.platforms.map((p) => (
                    <View key={p} style={[styles.platBadge, { backgroundColor: PLATFORM_COLORS[p] + '22' }]}>
                        <Text style={[styles.platText, { color: PLATFORM_COLORS[p] }]}>{p}</Text>
                    </View>
                ))}
            </View>
            <Text style={styles.dateText}>
                {post.status === 'scheduled'
                    ? `⏰ ${formatDate(post.scheduledAt)}`
                    : post.status === 'published'
                    ? `✅ ${formatDate(post.publishedAt)}`
                    : formatDate(post.createdAt)}
            </Text>
        </View>
    </View>
);

export const SchedulerScreen: React.FC = () => {
    const [posts, setPosts]         = useState<Post[]>([]);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter]       = useState<FilterStatus>('all');
    const [page, setPage]           = useState(1);
    const [hasMore, setHasMore]     = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const load = useCallback(async (reset = false, silent = false): Promise<void> => {
        if (!silent) setLoading(reset);
        const nextPage = reset ? 1 : page;
        try {
            const params = new URLSearchParams({ page: String(nextPage), limit: '20' });
            if (filter !== 'all') params.set('status', filter);
            const { data } = await api.get<PostsResponse>(`/posts?${params.toString()}`);
            setPosts((prev) => (reset ? data.data : [...prev, ...data.data]));
            setHasMore(data.data.length === 20);
            setPage(nextPage + 1);
        } catch {
            // silently fail on refresh
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [filter, page]);

    useEffect(() => { setPage(1); setHasMore(true); load(true); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const onRefresh = (): void => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        load(true, true);
    };

    const onEndReached = (): void => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        load(false);
    };

    const handleDelete = (id: string): void => {
        Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`/posts/${id}`);
                        setPosts((prev) => prev.filter((p) => p.id !== id));
                        Toast.show({ type: 'success', text1: 'Post deleted' });
                    } catch {
                        Alert.alert('Error', 'Failed to delete post.');
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.pageTitle}>Scheduler</Text>

            {/* Filter chips */}
            <View style={styles.filterRow}>
                {STATUS_FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, filter === f && styles.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <PostCard post={item} onDelete={handleDelete} />}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={loadingMore ? <ActivityIndicator color="#7C3AED" style={{ marginVertical: 16 }} /> : null}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {filter === 'all'
                                ? 'No posts yet. Create your first post in the Studio tab.'
                                : `No ${filter} posts.`}
                        </Text>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginHorizontal: 20, marginBottom: 12 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    filterChip: {
        borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
        paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFFFF',
    },
    filterChipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    filterChipText:       { fontSize: 13, color: '#374151', fontWeight: '500' },
    filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

    list: { paddingHorizontal: 16, paddingBottom: 32 },
    card: {
        backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
        marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8,
    },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusText:  { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    deleteBtn:   { padding: 4 },
    deleteBtnText: { fontSize: 13, color: '#9CA3AF', fontWeight: '700' },

    cardContent: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },
    cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 6 },

    platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    platBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    platText:  { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    dateText:  { fontSize: 11, color: '#9CA3AF' },

    emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', paddingVertical: 40, paddingHorizontal: 20 },
});
