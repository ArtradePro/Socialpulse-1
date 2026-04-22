import { useState } from 'react';
import { CalendarView } from '../components/scheduler/CalendarView';
import { PostScheduler } from '../components/scheduler/PostScheduler';
import { QueueManager } from '../components/scheduler/QueueManager';
import { BulkScheduler } from '../components/scheduler/BulkScheduler';

export const Scheduler = () => {
  const [tab, setTab] = useState<'queue' | 'bulk'>('queue');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scheduler</h2>
          <p className="mt-1 text-sm text-gray-500">Schedule and manage your publishing queue</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['queue', 'bulk'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'queue' ? 'Queue' : 'Bulk Schedule'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'queue' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CalendarView />
            <QueueManager />
          </div>
          <PostScheduler />
        </div>
      ) : (
        <BulkScheduler />
      )}
    </div>
  );
};
