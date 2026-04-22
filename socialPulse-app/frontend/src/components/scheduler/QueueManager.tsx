import { useState, useEffect } from 'react';
import { socialService, Schedule } from '../../services/socialService';
import { Button } from '../common/Button';
import { Trash2 } from 'lucide-react';

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

  if (loading) return <div className="animate-pulse h-40 rounded-xl bg-gray-100" />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="font-semibold text-gray-900">Scheduled Queue</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {schedules.map(s => (
          <li key={s.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium capitalize text-gray-800">{s.platform}</p>
              <p className="text-xs text-gray-400">{new Date(s.scheduled_at).toLocaleString()}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                s.status === 'published' ? 'bg-green-100 text-green-700' :
                s.status === 'failed' ? 'bg-red-100 text-red-700' :
                s.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'
              }`}>{s.status}</span>
            </div>
            {s.status === 'pending' && (
              <Button variant="danger" size="sm" onClick={() => cancel(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
        {schedules.length === 0 && <li className="px-6 py-8 text-center text-sm text-gray-400">No scheduled posts</li>}
      </ul>
    </div>
  );
};
