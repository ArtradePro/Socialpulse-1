import { useState } from 'react';
import { usePosts } from '../../hooks/usePosts';
import { socialService } from '../../services/socialService';
import { Button } from '../common/Button';
import { PlatformIcon } from '../common/BrandIcons';
import { Clock, Calendar, Send, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'facebook'];

export const PostScheduler = () => {
  const { posts, fetchPosts } = usePosts();
  const [selectedPost, setSelectedPost] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);

  const draftPosts = posts.filter(p => p.status === 'draft');

  const schedule = async () => {
    if (!selectedPost || !scheduledAt) {
        toast.error('Please select a draft and a date');
        return;
    }
    setLoading(true);
    try {
      await socialService.schedulePost(selectedPost, platform, new Date(scheduledAt).toISOString());
      toast.success('Post scheduled successfully');
      setSelectedPost('');
      setScheduledAt('');
      fetchPosts();
    } catch {
      toast.error('Failed to schedule post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-black text-gray-900 tracking-tight">Schedule Draft</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1.5 ml-1">Select Draft</label>
          <select 
            value={selectedPost} 
            onChange={e => setSelectedPost(e.target.value)} 
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Choose a draft...</option>
            {draftPosts.map(p => (
              <option key={p.id} value={p.id}>{p.content.slice(0, 50)}...</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 ml-1">Target Platform</label>
          <div className="grid grid-cols-4 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all group ${
                  platform === p 
                    ? 'border-indigo-200 bg-indigo-50 shadow-lg scale-[1.02]' 
                    : 'border-gray-50 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <PlatformIcon platform={p} size={24} />
                <span className={`text-[10px] font-black uppercase transition-colors ${platform === p ? 'text-indigo-600' : 'text-gray-400'}`}>{p}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1.5 ml-1">Date & Time</label>
          <div className="relative">
            <input 
              type="datetime-local" 
              value={scheduledAt} 
              onChange={e => setScheduledAt(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-10 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
            />
            <Clock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <button 
        onClick={schedule} 
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Schedule Post
      </button>

      <div className="pt-2">
        <div className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
                Need more content? Use the <span className="font-bold">Magic Plan</span> to generate a 7-day strategy in seconds.
            </p>
        </div>
      </div>
    </div>
  );
};

