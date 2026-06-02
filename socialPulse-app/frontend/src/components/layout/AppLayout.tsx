import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout, setUser } from '../../store/authSlice';
import api from '../../services/api';
import {
    LayoutDashboard, PenSquare, Calendar, BarChart3, Settings,
    LogOut, Menu, X, HardDrive, CreditCard, Megaphone, Hash, FileText,
    Sparkles, Paintbrush, Rss, Radio, Inbox, Gift, Key, Building2,
    ShoppingBag, MousePointer, Share2, Users, Bell, Hand
} from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { WorkspaceSwitcher } from '../common/WorkspaceSwitcher';
import { useBrand } from '../../contexts/BrandContext';
import { usePlan } from '../../hooks/usePlan';

const navSections = [
    {
        label: 'Publish',
        items: [
            { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
            { path: '/studio',     icon: Sparkles,        label: 'Content Studio' },
            { path: '/scheduler',  icon: Calendar,        label: 'Scheduler' },
            { path: '/analytics',  icon: BarChart3,       label: 'Analytics' },
            { path: '/campaigns',  icon: Megaphone,       label: 'Campaigns' },
            { path: '/magic-plan', icon: Sparkles,        label: 'Magic Plan' },
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
            { path: '/ecommerce',     icon: ShoppingBag, label: 'E-commerce' },
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

const CursorSvg = ({ color }: { color: string }) => (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
        <path d="M0 0L14 7L7.5 9L11 16.5L8.5 18L5 10.5L0 13V0Z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);

const AppLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user } = useAppSelector(state => state.auth);
    const brand = useBrand();
    const { usage } = usePlan();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    // Multiplayer Cursor states
    const [multiplayerActive, setMultiplayerActive] = useState(true);
    const [cursors, setCursors] = useState([
        { id: 1, name: "Vernon (Free)", color: "#7C3AED", x: 25, y: 45 },
        { id: 2, name: "Gemini Writer (AI)", color: "#F24E1E", x: 60, y: 70 },
        { id: 3, name: "Sarah (Admin)", color: "#0C8CE9", x: 80, y: 25 }
    ]);

    useEffect(() => {
        if (!multiplayerActive) return;
        const interval = setInterval(() => {
            setCursors(prev =>
                prev.map(c => {
                    const changeX = Math.random() * 24 - 12;
                    const changeY = Math.random() * 20 - 10;
                    return {
                        ...c,
                        x: Math.max(15, Math.min(85, c.x + changeX)),
                        y: Math.max(15, Math.min(80, c.y + changeY))
                    };
                })
            );
        }, 4000);
        return () => clearInterval(interval);
    }, [multiplayerActive]);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await api.get('/auth/profile');
                if (data.user) dispatch(setUser(data.user));
            } catch (err) {
                console.error('Failed to sync profile:', err);
            }
        };
        fetchProfile();
    }, [dispatch]);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[#F3F3F3] text-gray-800 relative overflow-hidden select-none">
            
            {/* Multiplayer Simulated Cursors layer */}
            {multiplayerActive && (
                <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                    {cursors.map(c => (
                        <div 
                            key={c.id} 
                            className="figma-cursor"
                            style={{ 
                                left: `${c.x}%`, 
                                top: `${c.y}%`,
                                transition: 'left 4s cubic-bezier(0.25, 1, 0.5, 1), top 4s cubic-bezier(0.25, 1, 0.5, 1)'
                            }}
                        >
                            <CursorSvg color={c.color} />
                            <div 
                                className="figma-cursor-badge"
                                style={{ backgroundColor: c.color }}
                            >
                                {c.name}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sidebar */}
            <aside
                className={`${
                    sidebarOpen ? 'w-64' : 'w-20'
                } bg-[#1E1E1E] border-r border-[#2C2C2C] flex flex-col transition-all duration-300 ease-in-out z-20 select-none shrink-0`}
            >
                {/* Logo */}
                <div className="flex items-center justify-between p-4 border-b border-[#2C2C2C] h-[57px] shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <img
                            src={brand.brandLogoUrl ?? '/logo.png'}
                            alt="SocialPulse"
                            className="h-7 w-7 object-cover aspect-square shrink-0 rounded-lg border border-purple-500/20"
                        />
                        {sidebarOpen && (
                            <span className="text-sm font-extrabold tracking-wider text-white uppercase truncate">
                                SOCIAL<span className="text-[#0C8CE9]">PULSE</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* AI Credits Badge */}
                {sidebarOpen && (() => {
                    const used  = usage?.aiCredits?.used  ?? 0;
                    const limit = usage?.aiCredits?.limit;
                    const isUnlimited = limit === 'unlimited';
                    const limitNum = isUnlimited ? null : (limit as number);
                    const pct = limitNum ? Math.min((used / limitNum) * 100, 100) : 0;
                    const isLow      = !isUnlimited && pct >= 80;
                    const isCritical = !isUnlimited && pct >= 95;
                    const resetDate  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                        <div className={`mx-4 mt-4 p-3 rounded-xl text-gray-200 border ${
                            isCritical ? 'bg-red-900/30 border-red-500/40' :
                            isLow      ? 'bg-amber-900/20 border-amber-500/30' :
                                         'bg-[#2C2C2C] border-[#3C3C3C]'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-400">AI Credits</span>
                                <span className={`text-xs font-black ${
                                    isCritical ? 'text-red-400' :
                                    isLow      ? 'text-amber-400' :
                                                 'text-[#0C8CE9]'
                                }`}>
                                    {isUnlimited ? '∞' : `${used} / ${limitNum}`}
                                </span>
                            </div>
                            {!isUnlimited && (
                                <div className="mt-2 bg-[#1E1E1E] rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${
                                            isCritical ? 'bg-red-500' :
                                            isLow      ? 'bg-amber-400' :
                                                         'bg-gradient-to-r from-[#0C8CE9] to-[#8B5CF6]'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            )}
                            {isCritical && (
                                <p className="mt-1.5 text-[10px] text-red-400 font-semibold">
                                    Resets {resetDate} — upgrade for more
                                </p>
                            )}
                            {isLow && !isCritical && (
                                <p className="mt-1.5 text-[10px] text-amber-400">
                                    Running low — resets {resetDate}
                                </p>
                            )}
                            <button
                                onClick={() => navigate('/billing')}
                                className="mt-2 text-[10px] text-gray-400 font-bold hover:text-white transition-colors"
                            >
                                {isUnlimited ? 'View plan →' : 'Upgrade for more →'}
                            </button>
                        </div>
                    );
                })()}

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto figma-scrollbar">
                    {navSections.map(section => (
                        <div key={section.label} className="space-y-1">
                            {sidebarOpen && (
                                <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                    {section.label}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map(({ path, icon: Icon, label }) => (
                                    <NavLink
                                        key={path}
                                        to={path}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-150 group ${
                                                isActive
                                                    ? 'bg-[#0C8CE9] text-white shadow-sm font-semibold'
                                                    : 'text-gray-400 hover:bg-[#2C2C2C] hover:text-white'
                                            }`
                                        }
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        {sidebarOpen && <span className="text-xs font-medium">{label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-[#2C2C2C] shrink-0 bg-[#161616]">
                    <div className="flex items-center gap-3">
                        <img
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=0C8CE9&color=fff`}
                            alt={user?.fullName || 'User'}
                            className="w-8 h-8 rounded-full border border-gray-600/40"
                        />
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-200 truncate">
                                    {user?.fullName}
                                </p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate">{user?.plan} Plan</p>
                            </div>
                        )}
                        {sidebarOpen && (
                            <button
                                onClick={handleLogout}
                                className="p-1 hover:bg-[#2C2C2C] rounded text-gray-400 hover:text-red-400 transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Navbar styled as Figma Toolbar */}
                <header className="bg-[#2C2C2C] border-b border-[#1E1E1E] px-4 py-2 flex items-center justify-between h-[57px] shrink-0 text-white z-10">
                    
                    {/* Left: Document Name Selector */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 rounded-lg hover:bg-[#3C3C3C] text-gray-300 transition-colors"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                        
                        <div className="flex items-center gap-1.5 text-xs font-bold select-none">
                            <span className="text-gray-400">SocialPulse</span>
                            <span className="text-gray-600 font-normal">/</span>
                            <span className="text-gray-200 hover:bg-[#3C3C3C] px-2 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors">
                                {allNavItems.find(item => window.location.pathname.startsWith(item.path))?.label || 'Editor'}
                                <span className="text-[8px] text-gray-500 font-normal">▼</span>
                            </span>
                        </div>
                    </div>

                    {/* Center: Figma Tools Bar */}
                    <div className="hidden md:flex items-center bg-[#1E1E1E] rounded-lg p-1 border border-[#3C3C3C] gap-0.5">
                        <button className="p-1.5 bg-[#0C8CE9] text-white rounded-md shadow-sm shadow-[#0C8CE9]/40" title="Move Tool (V)">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2v10.5l3.2-3.2 2.3 5.3 1.8-.8-2.3-5.3h4L3 2z"/></svg>
                        </button>
                        <div className="w-[1px] h-4 bg-[#3C3C3C] mx-1" />
                        <button className="p-1.5 text-gray-300 hover:text-white hover:bg-[#3C3C3C] rounded-md transition-colors" title="Select (V)">
                            <MousePointer className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-gray-300 hover:text-white hover:bg-[#3C3C3C] rounded-md transition-colors cursor-not-allowed" title="Frame Tool (F)" disabled>
                            <LayoutDashboard className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-gray-300 hover:text-white hover:bg-[#3C3C3C] rounded-md transition-colors cursor-not-allowed" title="Text Tool (T)" disabled>
                            <span className="font-serif font-black text-sm leading-none">T</span>
                        </button>
                        <button className="p-1.5 text-gray-300 hover:text-white hover:bg-[#3C3C3C] rounded-md transition-colors cursor-not-allowed" title="Hand Tool (H)" disabled>
                            <Hand className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Right: Multiplayer Toggle + Sharing */}
                    <div className="flex items-center gap-3">
                        {/* Multiplayer Cursors Toggle */}
                        <button 
                            onClick={() => setMultiplayerActive(!multiplayerActive)}
                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-bold ${
                                multiplayerActive 
                                    ? 'bg-[#0C8CE9]/15 border-[#0C8CE9]/30 text-[#0C8CE9]' 
                                    : 'bg-transparent border-[#3C3C3C] text-gray-400 hover:text-white hover:border-[#4C4C4C]'
                            }`}
                            title="Toggle Simulated Multiplayer Cursors"
                        >
                            <Users className="w-3.5 h-3.5" />
                            {sidebarOpen && <span>Multiplayer</span>}
                        </button>

                        <div className="h-4 w-[1px] bg-gray-700" />
                        
                        <WorkspaceSwitcher />
                        <NotificationBell />
                        
                        <button
                            onClick={() => navigate('/studio')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#8B5CF6] text-white rounded-lg text-xs font-extrabold hover:bg-opacity-95 shadow-md shadow-[#8B5CF6]/20 transition-all active:scale-[0.98]"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            Share
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;