// client/src/components/analytics/PostPerformanceTable.tsx
import React, { useState, useMemo } from 'react';
import {
    ChevronUp, ChevronDown, ChevronsUpDown,
    Heart, MessageCircle, Share2, Eye,
} from 'lucide-react';
import { PostPerformance } from '../../hooks/useAnalytics';

interface Props {
    posts:   PostPerformance[];
    loading: boolean;
}

type SortKey   = keyof PostPerformance;
type SortOrder = 'asc' | 'desc';

const PLATFORM_COLORS: Record<string, string> = {
    twitter:   'bg-sky-100   text-sky-700',
    instagram: 'bg-pink-100  text-pink-700',
    linkedin:  'bg-blue-100  text-blue-700',
    facebook:  'bg-indigo-100 text-indigo-700',
};

const SortIcon: React.FC<{ column: SortKey; sortKey: SortKey; order: SortOrder }> = (
    { column, sortKey, order }
) => {
    if (column !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />;
    return order === 'asc'
        ? <ChevronUp   className="w-3.5 h-3.5 text-purple-600" />
        : <ChevronDown className="w-3.5 h-3.5 text-purple-600" />;
};

const PostPerformanceTable: React.FC<Props> = ({ posts, loading }) => {
    const [sortKey,   setSortKey]   = useState<SortKey>('engagementRate');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [search,    setSearch]    = useState('');
    const [page,      setPage]      = useState(1);
    const PAGE_SIZE = 8;

    const handleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
        setPage(1);
    };

    const filtered = useMemo(() =>
        posts.filter(p =>
            p.content.toLowerCase().includes(search.toLowerCase()) ||
            p.platforms.some(pl => pl.includes(search.toLowerCase()))
        ),
        [posts, search]
    );

    const sorted = useMemo(() =>
        [...filtered].sort((a, b) => {
            const av = a[sortKey] as any;
            const bv = b[sortKey] as any;
            if (typeof av === 'number') return sortOrder === 'asc' ? av - bv : bv - av;
            return sortOrder === 'asc'
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        }),
        [filtered, sortKey, sortOrder]
    );

    const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const TH: React.FC<{ label: string; col: SortKey; align?: string }> = (
        { label, col, align = 'left' }
    ) => (
        <th
            onClick={() => handleSort(col)}
            className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase
                         tracking-wide cursor-pointer select-none hover:text-gray-800
                         whitespace-nowrap text-${align}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                <SortIcon column={col} sortKey={sortKey} order={sortOrder} />
            </span>
        </th>
    );

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                <div className="p-5 border-b border-gray-100">
                    <div className="w-48 h-5 bg-gray-200 rounded" />
                </div>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 px-5 py-4 border-b border-gray-50">
                        <div className="flex-1 h-4 bg-gray-100 rounded" />
                        <div className="w-16 h-4 bg-gray-100 rounded" />
                        <div className="w-16 h-4 bg-gray-100 rounded" />
                        <div className="w-16 h-4 bg-gray-100 rounded" />
                        <div className="w-16 h-4 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Post Performance</h3>
                <input
                    type="text"
                    placeholder="Search posts…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-purple-500 w-52"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500
                                           uppercase tracking-wide text-left w-64">
                                Post
                            </th>
                            <TH label="Platform"    col="platforms"      />
                            <TH label="Date"        col="publishedAt"     />
                            <TH label="Likes"       col="likes"       align="right" />
                            <TH label="Comments"    col="comments"    align="right" />
                            <TH label="Shares"      col="shares"      align="right" />
                            <TH label="Impressions" col="impressions"  align="right" />
                            <TH label="ER %"        col="engagementRate" align="right" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                                    No posts found
                                </td>
                            </tr>
                        ) : (
                            paginated.map(post => (
                                <tr key={post.id}
                                    className="hover:bg-gray-50 transition-colors">
                                    {/* Content */}
                                    <td className="px-4 py-3 max-w-xs">
                                        <p className="text-sm text-gray-700 truncate">
                                            {post.content}
                                        </p>
                                    </td>

                                    {/* Platforms */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {post.platforms.map(p => (
                                                <span key={p}
                                                      className={`text-[10px] px-1.5 py-0.5 rounded-full
                                                                  font-medium capitalize
                                                                  ${PLATFORM_COLORS[p] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: '2-digit'
                                        })}
                                    </td>

                                    {/* Metrics */}
                                    {([
                                        { key: 'likes',       icon: <Heart         className="w-3 h-3 text-pink-400" /> },
                                        { key: 'comments',    icon: <MessageCircle className="w-3 h-3 text-blue-400" /> },
                                        { key: 'shares',      icon: <Share2        className="w-3 h-3 text-green-400" /> },
                                        { key: 'impressions', icon: <Eye           className="w-3 h-3 text-purple-400" /> },
                                    ] as { key: keyof PostPerformance; icon: React.ReactNode }[]).map(({ key, icon }) => (
                                        <td key={String(key)} className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center justify-end gap-1
                                                             text-sm text-gray-700 font-medium">
                                                {icon}
                                                {(post[key] as number).toLocaleString()}
                                            </span>
                                        </td>
                                    ))}

                                    {/* Engagement Rate */}
                                    <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                                                          text-xs font-semibold ${
                                            post.engagementRate >= 5  ? 'bg-green-100 text-green-700' :
                                            post.engagementRate >= 2  ? 'bg-yellow-100 text-yellow-700' :
                                                                         'bg-red-50 text-red-600'
                                        }`}>
                                            {post.engagementRate.toFixed(2)}%
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3
                                border-t border-gray-100 text-sm text-gray-500">
                    <span>
                        Showing {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ← Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages ||
                                        Math.abs(p - page) <= 1)
                            .reduce<(number | '…')[]>((acc, p, i, arr) => {
                                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, i) =>
                                p === '…'
                                    ? <span key={`ellipsis-${i}`} className="px-2">…</span>
                                    : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p as number)}
                                            className={`w-8 h-8 rounded-lg text-xs font-medium ${
                                                page === p
                                                    ? 'bg-purple-600 text-white'
                                                    : 'border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                            )
                        }
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostPerformanceTable;
