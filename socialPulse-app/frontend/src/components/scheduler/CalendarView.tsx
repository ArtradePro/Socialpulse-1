import { useState, useEffect } from 'react';
import { usePosts } from '../../hooks/usePosts';

// Simple month calendar view showing scheduled posts
export const CalendarView = () => {
  const { posts, fetchPosts } = usePosts();
  const [currentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => { 
    fetchPosts({ limit: 100 }); 
  }, [fetchPosts]); // Added fetchPosts to dependency array for best practice

  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const postsByDay: Record<number, typeof posts> = {};
  for (const post of posts) {
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      if (d.getFullYear() === currentMonth.year && d.getMonth() === currentMonth.month) {
        const day = d.getDate();
        postsByDay[day] = [...(postsByDay[day] || []), post];
      }
    }
  }

  // FIX: Explicitly type the array as (number | null)[]
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{monthName}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-[60px] rounded-lg p-1 ${day ? 'border border-gray-100' : ''}`}>
            {day && (
              <>
                <p className="text-xs font-medium text-gray-600 mb-1">{day}</p>
                {(postsByDay[day] || []).map(p => (
                  <div key={p.id} className="truncate rounded bg-indigo-100 px-1 py-0.5 text-xs text-indigo-700 mb-0.5">
                    {p.platforms?.[0] || 'post'}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};