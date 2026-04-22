import { usePosts } from '../../hooks/usePosts';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const RecentPosts = () => {
  const { posts, loading, fetchPosts } = usePosts();

  useEffect(() => { fetchPosts({ limit: 5 }); }, []);

  if (loading) return <div className="animate-pulse h-40 rounded-xl bg-gray-100" />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="font-semibold text-gray-900">Recent Posts</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {posts.slice(0, 5).map(post => (
          <li key={post.id} className="flex items-start gap-3 px-6 py-4">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-gray-800">{post.content}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  post.status === 'published' ? 'bg-green-100 text-green-700' :
                  post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  post.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'}`}>
                  {post.status}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </li>
        ))}
        {posts.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-gray-400">No posts yet</li>
        )}
      </ul>
    </div>
  );
};
