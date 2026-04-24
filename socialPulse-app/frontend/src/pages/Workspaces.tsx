import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, Users, Trash2, UserPlus, Crown, Shield, Eye, User, Loader2, X, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setWorkspaces, addWorkspace, removeWorkspace, switchWorkspace, Workspace } from '../store/workspaceSlice';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
    id:         string;
    email:      string;
    full_name:  string;
    avatar_url: string | null;
    role:       string;
    joined_at:  string;
}

interface PendingInvite {
    id:         string;
    email:      string;
    role:       string;
    expires_at: string;
}

interface WorkspaceDetail extends Workspace {
    members:        Member[];
    pendingInvites: PendingInvite[];
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
    owner:  <Crown  className="w-3.5 h-3.5 text-yellow-500" />,
    admin:  <Shield className="w-3.5 h-3.5 text-blue-500" />,
    member: <User   className="w-3.5 h-3.5 text-gray-400" />,
    viewer: <Eye    className="w-3.5 h-3.5 text-gray-400" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Workspaces: React.FC = () => {
    const dispatch = useAppDispatch();
    const { workspaces, activeId } = useAppSelector(s => s.workspace);

    const [selected,    setSelected]    = useState<WorkspaceDetail | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Detail tabs
    const [detailTab, setDetailTab] = useState<'members' | 'branding'>('members');

    // Branding form
    const [brandName,    setBrandName]    = useState('');
    const [brandColor,   setBrandColor]   = useState('#6366f1');
    const [brandLogoUrl, setBrandLogoUrl] = useState('');
    const [customDomain, setCustomDomain] = useState('');
    const [savingBrand,  setSavingBrand]  = useState(false);

    // Create workspace modal
    const [showCreate,  setShowCreate]  = useState(false);
    const [newName,     setNewName]     = useState('');
    const [creating,    setCreating]    = useState(false);

    // Invite modal
    const [showInvite,  setShowInvite]  = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole,  setInviteRole]  = useState('member');
    const [inviting,    setInviting]    = useState(false);

    // ── Load workspace list ──────────────────────────────────────────────────

    const loadList = useCallback(async () => {
        try {
            const { data } = await api.get('/workspaces');
            dispatch(setWorkspaces(data));
        } catch { toast.error('Failed to load workspaces'); }
        finally { setLoading(false); }
    }, [dispatch]);

    useEffect(() => { loadList(); }, [loadList]);

    // ── Load workspace detail ────────────────────────────────────────────────

    const loadDetail = useCallback(async (ws: Workspace) => {
        setLoadingDetail(true);
        try {
            const { data } = await api.get(`/workspaces/${ws.id}`, {
                headers: { 'X-Workspace-Id': ws.id },
            });
            setSelected(data);
        } catch { toast.error('Failed to load workspace details'); }
        finally { setLoadingDetail(false); }
    }, []);

    useEffect(() => {
        if (workspaces.length > 0 && !selected) loadDetail(workspaces[0]);
    }, [workspaces, selected, loadDetail]);

    // Sync branding form when workspace selection changes
    useEffect(() => {
        if (!selected) return;
        setBrandName((selected as any).brand_name   ?? '');
        setBrandColor((selected as any).brand_color ?? '#6366f1');
        setBrandLogoUrl((selected as any).brand_logo_url ?? '');
        setCustomDomain((selected as any).custom_domain  ?? '');
    }, [selected]);

    // ── Create workspace ─────────────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const { data } = await api.post('/workspaces', { name: newName.trim() });
            dispatch(addWorkspace(data));
            dispatch(switchWorkspace(data.id));
            setShowCreate(false);
            setNewName('');
            loadDetail(data);
            toast.success('Workspace created');
        } catch { toast.error('Failed to create workspace'); }
        finally { setCreating(false); }
    };

    // ── Invite member ────────────────────────────────────────────────────────

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !inviteEmail.trim()) return;
        setInviting(true);
        try {
            await api.post(`/workspaces/${selected.id}/invite`,
                { email: inviteEmail.trim(), role: inviteRole },
                { headers: { 'X-Workspace-Id': selected.id } }
            );
            toast.success('Invite sent');
            setShowInvite(false);
            setInviteEmail('');
            loadDetail(selected);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to send invite');
        } finally { setInviting(false); }
    };

    // ── Remove member ────────────────────────────────────────────────────────

    const handleRemoveMember = async (userId: string, name: string) => {
        if (!selected) return;
        if (!window.confirm(`Remove ${name} from this workspace?`)) return;
        try {
            await api.delete(`/workspaces/${selected.id}/members/${userId}`, {
                headers: { 'X-Workspace-Id': selected.id },
            });
            toast.success('Member removed');
            loadDetail(selected);
        } catch { toast.error('Failed to remove member'); }
    };

    // ── Cancel invite ────────────────────────────────────────────────────────

    const handleCancelInvite = async (inviteId: string) => {
        if (!selected) return;
        try {
            await api.delete(`/workspaces/${selected.id}/invites/${inviteId}`, {
                headers: { 'X-Workspace-Id': selected.id },
            });
            toast.success('Invite cancelled');
            loadDetail(selected);
        } catch { toast.error('Failed to cancel invite'); }
    };

    // ── Save branding ────────────────────────────────────────────────────────

    const handleSaveBranding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected) return;
        setSavingBrand(true);
        try {
            await api.patch(`/workspaces/${selected.id}/branding`, {
                brandName:    brandName    || null,
                brandColor:   brandColor,
                brandLogoUrl: brandLogoUrl || null,
                customDomain: customDomain || null,
            }, { headers: { 'X-Workspace-Id': selected.id } });
            toast.success('Branding saved');
            loadDetail(selected);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to save branding');
        } finally { setSavingBrand(false); }
    };

    // ── Delete workspace ─────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!selected) return;
        if (!window.confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/workspaces/${selected.id}`, {
                headers: { 'X-Workspace-Id': selected.id },
            });
            dispatch(removeWorkspace(selected.id));
            setSelected(null);
            toast.success('Workspace deleted');
            loadList();
        } catch { toast.error('Failed to delete workspace'); }
    };

    // ── Update member role ───────────────────────────────────────────────────

    const handleRoleChange = async (userId: string, role: string) => {
        if (!selected) return;
        try {
            await api.patch(`/workspaces/${selected.id}/members/${userId}/role`,
                { role },
                { headers: { 'X-Workspace-Id': selected.id } }
            );
            toast.success('Role updated');
            loadDetail(selected);
        } catch { toast.error('Failed to update role'); }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
                    <p className="text-sm text-gray-500 mt-1">Separate accounts for different brands, clients, or teams</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity text-sm">
                    <Plus className="w-4 h-4" /> New workspace
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">

                {/* Left: workspace list */}
                <div className="col-span-4 space-y-2">
                    {workspaces.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                            <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500">No workspaces yet</p>
                            <button onClick={() => setShowCreate(true)}
                                className="mt-3 text-sm text-indigo-600 font-medium hover:underline">
                                Create your first workspace
                            </button>
                        </div>
                    ) : workspaces.map(ws => (
                        <button key={ws.id} onClick={() => loadDetail(ws)}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                                selected?.id === ws.id
                                    ? 'border-indigo-300 bg-indigo-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}>
                            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                                {ws.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{ws.name}</p>
                                <p className="text-xs text-gray-400 capitalize">{ws.role}</p>
                            </div>
                            {ws.id === (activeId ?? workspaces[0]?.id) && (
                                <span className="ml-auto text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                                    Active
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Right: workspace detail */}
                <div className="col-span-8">
                    {!selected ? (
                        <div className="flex items-center justify-center h-full bg-white rounded-2xl border border-gray-200 py-20">
                            <p className="text-sm text-gray-400">Select a workspace to view details</p>
                        </div>
                    ) : loadingDetail ? (
                        <div className="flex justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            {/* Tab bar */}
                            <div className="flex border-b border-gray-100">
                                {(['members', 'branding'] as const).map(tab => (
                                    <button key={tab} onClick={() => setDetailTab(tab)}
                                        className={`px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                                            detailTab === tab
                                                ? 'border-indigo-600 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}>
                                        {tab === 'members' ? <><Users className="w-3.5 h-3.5 inline mr-1.5" />Members</> : <><Palette className="w-3.5 h-3.5 inline mr-1.5" />Branding</>}
                                    </button>
                                ))}
                            </div>

                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                        {selected.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{selected.name}</p>
                                        <p className="text-xs text-gray-400">/{selected.slug}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {['owner', 'admin'].includes(selected.role) && (
                                        <button onClick={() => setShowInvite(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
                                            <UserPlus className="w-4 h-4" /> Invite
                                        </button>
                                    )}
                                    {selected.role === 'owner' && (
                                        <button onClick={handleDelete}
                                            className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors" title="Delete workspace">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Members tab */}
                            {detailTab === 'branding' && ['owner', 'admin'].includes(selected.role) && (
                                <form onSubmit={handleSaveBranding} className="px-6 py-5 space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
                                        <input type="text" value={brandName}
                                            onChange={e => setBrandName(e.target.value)}
                                            placeholder="Your Company (leave blank to use workspace name)"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        <p className="text-xs text-gray-400 mt-1">Shown in the sidebar instead of "Social Pulse"</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand color</label>
                                        <div className="flex items-center gap-3">
                                            <label className="relative w-10 h-10 rounded-xl border border-gray-200 cursor-pointer overflow-hidden shrink-0">
                                                <span className="block w-full h-full" style={{ background: brandColor }} />
                                                <input type="color" value={brandColor}
                                                    onChange={e => setBrandColor(e.target.value)}
                                                    className="absolute opacity-0 inset-0" />
                                            </label>
                                            <input type="text" value={brandColor}
                                                onChange={e => setBrandColor(e.target.value)}
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Applied as CSS --brand-color variable throughout the app</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                        <input type="url" value={brandLogoUrl}
                                            onChange={e => setBrandLogoUrl(e.target.value)}
                                            placeholder="https://cdn.example.com/logo.png"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        {brandLogoUrl && (
                                            <img src={brandLogoUrl} alt="Preview" className="mt-2 h-10 object-contain rounded" />
                                        )}
                                        <p className="text-xs text-gray-400 mt-1">Replaces the Zap icon in the sidebar</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Custom domain</label>
                                        <input type="text" value={customDomain}
                                            onChange={e => setCustomDomain(e.target.value)}
                                            placeholder="app.yourcompany.com"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        <p className="text-xs text-gray-400 mt-1">Point your DNS CNAME to this app's domain, then enter your domain here</p>
                                    </div>

                                    <button type="submit" disabled={savingBrand}
                                        className="w-full py-2.5 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                                        {savingBrand ? 'Saving…' : 'Save branding'}
                                    </button>
                                </form>
                            )}

                            {detailTab === 'branding' && !['owner', 'admin'].includes(selected.role) && (
                                <div className="px-6 py-12 text-center text-sm text-gray-400">
                                    Only admins and owners can manage branding.
                                </div>
                            )}

                            {/* Members tab */}
                            {detailTab === 'members' && <div className="px-6 py-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Members ({selected.members.length})
                                </p>
                                <div className="space-y-2">
                                    {selected.members.map(m => (
                                        <div key={m.id} className="flex items-center gap-3 py-1.5">
                                            <img
                                                src={m.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name)}&background=7C3AED&color=fff&size=32`}
                                                alt={m.full_name}
                                                className="w-8 h-8 rounded-full shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                                                <p className="text-xs text-gray-400 truncate">{m.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {['owner', 'admin'].includes(selected.role) && m.role !== 'owner' ? (
                                                    <select
                                                        value={m.role}
                                                        onChange={e => handleRoleChange(m.id, e.target.value)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                        <option value="admin">Admin</option>
                                                        <option value="member">Member</option>
                                                        <option value="viewer">Viewer</option>
                                                    </select>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-xs text-gray-500 capitalize">
                                                        {ROLE_ICONS[m.role]} {m.role}
                                                    </span>
                                                )}
                                                {['owner', 'admin'].includes(selected.role) && m.role !== 'owner' && (
                                                    <button onClick={() => handleRemoveMember(m.id, m.full_name)}
                                                        className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pending invites */}
                                {selected.pendingInvites.length > 0 && (
                                    <div className="mt-5">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                            Pending invites ({selected.pendingInvites.length})
                                        </p>
                                        <div className="space-y-2">
                                            {selected.pendingInvites.map(inv => (
                                                <div key={inv.id} className="flex items-center gap-3 py-1.5">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-gray-700 truncate">{inv.email}</p>
                                                        <p className="text-xs text-gray-400 capitalize">{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                                                    </div>
                                                    {['owner', 'admin'].includes(selected.role) && (
                                                        <button onClick={() => handleCancelInvite(inv.id)}
                                                            className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create workspace modal ────────────────────────────────── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">New workspace</h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Acme Corp, My Brand…"
                                    autoFocus
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!newName.trim() || creating}
                                    className="flex-1 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                                    {creating ? 'Creating…' : 'Create workspace'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Invite member modal ───────────────────────────────────── */}
            {showInvite && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Invite to {selected.name}</h2>
                            <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                    autoFocus
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="admin">Admin — can manage members and settings</option>
                                    <option value="member">Member — can create and publish content</option>
                                    <option value="viewer">Viewer — read-only access</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowInvite(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!inviteEmail.trim() || inviting}
                                    className="flex-1 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                                    {inviting ? 'Sending…' : 'Send invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workspaces;
