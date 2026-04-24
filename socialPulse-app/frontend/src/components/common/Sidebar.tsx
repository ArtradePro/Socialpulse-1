import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PenSquare, Calendar, BarChart2, Hash, FileText, Settings, Zap, Megaphone, Image, Rss, Key, Sparkles, Radio, Inbox, Gift, Paintbrush } from 'lucide-react';

const links = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/studio',         icon: PenSquare,        label: 'Content Studio' },
  { to: '/scheduler',      icon: Calendar,         label: 'Scheduler' },
  { to: '/analytics',      icon: BarChart2,        label: 'Analytics' },
  { to: '/campaigns',      icon: Megaphone,        label: 'Campaigns' },
  { to: '/media',          icon: Image,            label: 'Media Library' },
  { to: '/hashtag-sets',   icon: Hash,             label: 'Hashtag Sets' },
  { to: '/templates',      icon: FileText,         label: 'Templates' },
  { to: '/image-gen',      icon: Sparkles,         label: 'Image Generator' },
  { to: '/image-editor',   icon: Paintbrush,       label: 'Image Editor' },
  { to: '/rss',            icon: Rss,              label: 'RSS Feeds' },
  { to: '/listening',      icon: Radio,            label: 'Social Listening' },
  { to: '/inbox',          icon: Inbox,            label: 'Unified Inbox' },
  { to: '/referrals',      icon: Gift,             label: 'Referrals' },
  { to: '/api-keys',       icon: Key,              label: 'API Keys' },
  { to: '/settings',       icon: Settings,         label: 'Settings' },
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
