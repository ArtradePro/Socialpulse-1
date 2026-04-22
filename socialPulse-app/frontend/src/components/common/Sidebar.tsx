import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PenSquare, Calendar, BarChart2, Settings, Zap } from 'lucide-react';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/content', icon: PenSquare, label: 'Content Studio' },
  { to: '/scheduler', icon: Calendar, label: 'Scheduler' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar = () => (
  <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
    <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-200">
      <Zap className="h-7 w-7 text-indigo-600" />
      <span className="text-xl font-bold text-gray-900">SocialPulse</span>
    </div>
    <nav className="flex-1 space-y-1 px-3 py-4">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  </aside>
);
