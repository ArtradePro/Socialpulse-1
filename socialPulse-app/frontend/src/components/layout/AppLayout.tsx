import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/authSlice';
import {
    LayoutDashboard, PenSquare, Calendar, BarChart3, Settings, Zap,
    LogOut, Menu, X, HardDrive, CreditCard, Megaphone, Hash, FileText,
    Sparkles, Paintbrush, Rss, Radio, Inbox, Gift, Key, Building2,
} from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { WorkspaceSwitcher } from '../common/WorkspaceSwitcher';
import { useBrand } from '../../contexts/BrandContext';

const navSections = [
    {
        label: 'Publish',
        items: [
            { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
            { path: '/studio',     icon: PenSquare,       label: 'Content Studio' },
            { path: '/scheduler',  icon: Calendar,        label: 'Scheduler' },
            { path: '/analytics',  icon: BarChart3,       label: 'Analytics' },
            { path: '/campaigns',  icon: Megaphone,       label: 'Campaigns' },
        ],
    },
    {
        label: 'Assets',
        items: [
            { path: '/media',         icon: HardDrive,   label: 'Media Library' },
            { path: '/hashtag-sets',  icon: Hash,        label: 'Hashtag Sets' },
            { path: '/templates',     icon: FileText,    label: 'Templates' },
            { path: '/image-gen',     icon: Sparkles,    label: 'Image Generator' },
            { path: '/image-editor',  icon: Paintbrush,  label: 'Image Editor' },
        ],
    },
    {
        label: 'Monitor',
        items: [
            { path: '/rss',       icon: Rss,   label: 'RSS Feeds' },
            { path: '/listening', icon: Radio, label: 'Social Listening' },
            { path: '/inbox',     icon: Inbox, label: 'Unified Inbox' },
        ],
    },
    {
        label: 'Account',
        items: [
            { path: '/workspaces', icon: Building2,  label: 'Workspaces' },
            { path: '/referrals',  icon: Gift,        label: 'Referrals' },
            { path: '/api-keys',   icon: Key,         label: 'API Keys' },
            { path: '/billing',    icon: CreditCard,  label: 'Plans & Billing' },
            { path: '/settings',   icon: Settings,    label: 'Settings' },
        ],
    },
];

// Flat list used for page title lookup
const allNavItems = navSections.flatMap(s => s.items);

const AppLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user } = useAppSelector(state => state.auth);
    const brand = useBrand();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside
                className={`${
                    sidebarOpen ? 'w-64' : 'w-20'
                } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`}
            >
                {/* Logo */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2">
                            {brand.brandLogoUrl ? (
                                <img src={brand.brandLogoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                            ) : (
                                <div className="w-8 h-8 bg-linear-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <span className="text-xl font-bold bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                {brand.brandName ?? 'Social Pulse'}
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* AI Credits Badge */}
                {sidebarOpen && (
                    <div className="mx-4 mt-4 p-3 bg-linear-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">AI Credits</span>
                            <span className="text-sm font-bold text-purple-600">
                                {user?.aiCredits || 0}
                            </span>
                        </div>
                        <div className="mt-2 bg-white rounded-full h-2">
                            <div
                                className="bg-linear-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min((user?.aiCredits || 0) / 100 * 100, 100)}%` }}
                            />
                        </div>
                        <button className="mt-2 text-xs text-purple-600 font-medium hover:underline">
                            Get more credits →
                        </button>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
                    {navSections.map(section => (
                        <div key={section.label}>
                            {sidebarOpen && (
                                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                    {section.label}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map(({ path, icon: Icon, label }) => (
                                    <NavLink
                                        key={path}
                                        to={path}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                                                isActive
                                                    ? 'bg-linear-to-r from-purple-600 to-blue-600 text-white shadow-sm shadow-purple-200'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                        <img
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=7C3AED&color=fff`}
                            alt={user?.fullName || 'User'}
                            className="w-9 h-9 rounded-full"
                        />
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user?.fullName}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">{user?.plan} Plan</p>
                            </div>
                        )}
                        {sidebarOpen && (
                            <button
                                onClick={handleLogout}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Navbar */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-semibold text-gray-900">
                        {allNavItems.find(item => window.location.pathname.startsWith(item.path))?.label || 'Social Pulse'}
                    </h1>
                    <div className="flex items-center gap-3">
                        <WorkspaceSwitcher />
                        <NotificationBell />
                        <button
                            onClick={() => navigate('/studio')}
                            className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                            <PenSquare className="w-4 h-4" />
                            Create Post
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;