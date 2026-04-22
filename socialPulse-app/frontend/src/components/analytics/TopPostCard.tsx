// client/src/components/analytics/TopPostCard.tsx
import React from 'react';
import { Heart, MessageCircle, Share2, Eye, MousePointer } from 'lucide-react';
import { PostPerformance } from '../../hooks/useAnalytics';

interface Props {
    post:  PostPerformance;
    rank:  number;
}

const PLATFORM_COLORS: Record<string, string> = {
    twitter:   'bg-sky-100   text-sky-700',
    instagram: 'bg-pink-100  text-pink-700',
    linkedin:  'bg-blue-100  text-blue-700',
    facebook:  'bg-indigo-100 text-indigo-700',
};

const TopPostCard: React.FC<Props> = ({ post, rank }) => {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                        hover:shadow-md transition-shadow flex gap-4">
            {/* Rank */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                             text-sm font-bold flex-shrink-0 ${
                rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                rank === 2 ? 'bg-gray-100   text-gray-600'   :
                rank === 3 ? 'bg-orange-100 text-orange-700' :
                             'bg-purple-50  text-purple-600'
            }`}>
                #{rank}
            </div>

            <div className="flex-1 min-w-0">
                {/* Platforms */}
                <div className="flex flex-wrap gap-1 mb-2">
                    {post.platforms.map(p => (
                        <span key={p}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                                          capitalize ${PLATFORM_COLORS[p] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p}
                        </span>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                        })}
                    </span>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                    {post.content}
                </p>

                {/* Metrics row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-pink-500" />
                        {post.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                        {post.comments.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-green-500" />
                        {post.shares.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-purple-500" />
                        {post.impressions.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <MousePointer className="w-3.5 h-3.5 text-orange-500" />
                        {post.clicks.toLocaleString()}
                    </span>

                    {/* Engagement rate pill */}
                    <span className="ml-auto bg-purple-50 text-purple-700 px-2 py-0.5
                                     rounded-full font-semibold">
                        {post.engagementRate.toFixed(2)}% ER
                    </span>
                </div>
            </div>

            {/* Thumbnail */}
            {post.mediaUrl && (
                <img
                    src={post.mediaUrl}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
            )}
        </div>
    );
};

export default TopPostCard;
