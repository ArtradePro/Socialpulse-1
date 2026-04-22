import { useState } from 'react';
import { usePosts } from '../../hooks/usePosts';
import { socialService } from '../../services/socialService';
import { Button } from '../common/Button';

const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'facebook'];

export const PostScheduler = () => {
  const { posts, fetchPosts } = usePosts();
  const [selectedPost, setSelectedPost] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const draftPosts = posts.filter(p => p.status === 'draft');

  const schedule = async () => {
    if (!selectedPost || !scheduledAt) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await socialService.schedulePost(selectedPost, platform, new Date(scheduledAt).toISOString());
      setSuccess('Post scheduled successfully');
      fetchPosts();
    } catch {
      setError('Failed to schedule post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">Schedule a Post</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select post</label>
        <select value={selectedPost} onChange={e => setSelectedPost(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">-- select draft --</option>
          {draftPosts.map(p => (
            <option key={p.id} value={p.id}>{p.content.slice(0, 60)}...</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <Button onClick={schedule} loading={loading}>Schedule Post</Button>

      {success && <p className="text-sm text-green-600">{success}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};
