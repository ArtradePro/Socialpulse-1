import { useState, useEffect } from 'react';
import { socialService, Schedule } from '../../services/socialService';
import { Button } from '../common/Button';
import { Trash2, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const QueueManager = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socialService.getSchedules().then(setSchedules).finally(() => setLoading(false));
  }, []);

  const cancel = async (id: string) => {
    await socialService.cancelSchedule(id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const copyApprovalLink = async (postId: string) => {
        try {
            const { data } = await api.post('/approvals/generate-link', { postId });
            const url = `${window.location.origin}/approve/${data.token}`;
            await navigator.clipboard.writeText(url);
            toast.success('Approval link copied to clipboard!');
        } catch {
            toast.error('Failed to generate link');
        }
    };

    if (loading) return <div className="animate-pulse h-40 rounded-xl bg-gray-100" />;

    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="font-semibold text-gray-900">Scheduled Queue</h3>
            </div>
            <ul className="divide-y divide-gray-100">
                {schedules.map(s => (
                    <li key={s.id} className="flex items-center justify-between px-6 py-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium capitalize text-gray-800">{s.platform}</p>
                            <p className="text-xs text-gray-400">{new Date(s.scheduled_at).toLocaleString()}</p>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                                s.status === 'published' ? 'bg-green-100 text-green-700' :
                                s.status === 'failed' ? 'bg-red-100 text-red-700' :
                                s.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>{s.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => copyApprovalLink(s.id)}
                                title="Share for client approval"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                <LinkIcon className="w-4 h-4" />
                            </button>
                            {s.status === 'pending' && (
                                <Button variant="danger" size="sm" onClick={() => cancel(s.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
        {schedules.length === 0 && <li className="px-6 py-8 text-center text-sm text-gray-400">No scheduled posts</li>}
      </ul>
    </div>
  );
};
