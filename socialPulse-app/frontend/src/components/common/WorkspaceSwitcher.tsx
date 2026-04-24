import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Building2, Plus, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setWorkspaces, switchWorkspace, Workspace } from '../../store/workspaceSlice';
import api from '../../services/api';

export const WorkspaceSwitcher: React.FC = () => {
    const dispatch   = useAppDispatch();
    const navigate   = useNavigate();
    const { workspaces, activeId } = useAppSelector(s => s.workspace);
    const [open,    setOpen]    = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Load workspaces on mount
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get('/workspaces')
            .then(({ data }) => { if (!cancelled) dispatch(setWorkspaces(data)); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [dispatch]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const active: Workspace | undefined = workspaces.find(w => w.id === activeId) ?? workspaces[0];

    const handleSwitch = (id: string) => {
        dispatch(switchWorkspace(id));
        setOpen(false);
        // Reload current page data by navigating to the same location
        window.location.reload();
    };

    if (loading && workspaces.length === 0) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 max-w-[180px]"
            >
                <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate">{active?.name ?? 'No workspace'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-2xl border border-gray-200 shadow-lg z-50 py-1.5 overflow-hidden">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        Your workspaces
                    </p>
                    {workspaces.map(ws => (
                        <button
                            key={ws.id}
                            onClick={() => handleSwitch(ws.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                        >
                            <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {ws.name[0].toUpperCase()}
                            </div>
                            <span className="flex-1 truncate text-gray-800">{ws.name}</span>
                            {ws.id === (activeId ?? workspaces[0]?.id) && (
                                <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            )}
                        </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                            onClick={() => { setOpen(false); navigate('/workspaces'); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Manage workspaces
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkspaceSwitcher;
