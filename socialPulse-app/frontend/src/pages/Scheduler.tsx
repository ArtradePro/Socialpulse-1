import { useState } from 'react';
import { CalendarView } from '../components/scheduler/CalendarView';
import { PostScheduler } from '../components/scheduler/PostScheduler';
import { QueueManager } from '../components/scheduler/QueueManager';
import { BulkScheduler } from '../components/scheduler/BulkScheduler';

export const Scheduler = () => {
  const [tab, setTab] = useState<'queue' | 'bulk'>('queue');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Scheduler</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">Master your publishing timeline with precision.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5 shadow-xs">
            {(['queue', 'bulk'] as const).map(t => (
                <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    tab === t ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'
                }`}
                >
                {t === 'queue' ? 'Calendar' : 'Bulk Upload'}
                </button>
            ))}
            </div>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {tab === 'queue' ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 space-y-8">
                <CalendarView />
                <QueueManager />
            </div>
            <div className="lg:col-span-4 sticky top-6">
                <PostScheduler />
            </div>
            </div>
        ) : (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-xl shadow-gray-200/50">
                <BulkScheduler />
            </div>
        )}
      </div>
    </div>
  );
};
