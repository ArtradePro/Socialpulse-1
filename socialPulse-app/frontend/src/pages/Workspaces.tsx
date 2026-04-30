import React, { useState, useEffect } from 'react';
import { 
    Plus, Settings, Users, Globe, 
    MoreVertical, Trash2, Shield, 
    Check, X, Loader2, Building2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Workspace {
    id: string;
    name: string;
    role: 'admin' | 'member' | 'viewer';
    memberCount: number;
    isDefault: boolean;
    createdAt: string;
}

const Workspaces: React.FC = () => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [newName, setNewName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [selected, setSelected] = useState<Workspace | null>(null);
    const [creating, setCreating] = useState(false);
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            const { data } = await api.get('/workspaces');
            setWorkspaces(data);
            if (data.length > 0 && !selected) setSelected(data[0]);
        } catch (error) {
            toast.error('Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const { data } = await api.post('/workspaces', { name: newName });
            setWorkspaces(prev => [...prev, data]);
            setNewName('');
            setShowCreate(false);
            toast.success('Workspace created!');
        } catch (error) {
            toast.error('Failed to create workspace');
        } finally {
            setCreating(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !inviteEmail.trim()) return;
        setInviting(true);
        try {
            await api.post(`/workspaces/${selected.id}/invites`, {
                email: inviteEmail,
                role: inviteRole
            });
            setInviteEmail('');
            setShowInvite(false);
            toast.success('Invitation sent!');
        } catch (error) {
            toast.error('Failed to send invitation');
        } finally {
            setInviting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage team collaboration and organization settings</p>
                </div>
                <button 
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Workspace
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-3">
                    {workspaces.map(ws => (
                        <button
                            key={ws.id}
                            onClick={() => setSelected(ws)}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                                selected?.id === ws.id 
                                    ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-500' 
                                    : 'bg-gray-50 border-transparent hover:bg-white hover:border-gray-200'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                selected?.id === ws.id ? 'bg-purple-100 text-purple-600' : 'bg-white text-gray-400'
                            }`}>
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{ws.name}</p>
                                <p className="text-xs text-gray-500">{ws.memberCount} members • {ws.role}</p>
                            </div>
                            {ws.isDefault && <div className="w-2 h-2 bg-green-500 rounded-full" title="Default Workspace" />}
                        </button>
                    ))}
                </div>

                <div className="lg:col-span-2">
                    {selected ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                                        <p className="text-sm text-gray-500">Workspace Settings & Members</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowInvite(true)}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Invite Member
                                </button>
                            </div>

                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-transparent">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Shield className="w-5 h-5 text-blue-600" />
                                            <h3 className="font-semibold text-gray-900">Your Role</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 capitalize">{selected.role}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-transparent">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Users className="w-5 h-5 text-green-600" />
                                            <h3 className="font-semibold text-gray-900">Team Size</h3>
                                        </div>
                                        <p className="text-sm text-gray-600">{selected.memberCount} members active</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <Building2 className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">Select a workspace to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Modals --- */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Create Workspace</h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input 
                                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                placeholder="Workspace Name (e.g. Marketing Team)"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border rounded-xl font-medium text-gray-700">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-medium">
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showInvite && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Invite to {selected.name}</h2>
                            <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <input 
                                type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                                placeholder="colleague@example.com"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                autoFocus
                            />
                            <select 
                                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2.5 border rounded-xl font-medium text-gray-700">Cancel</button>
                                <button type="submit" disabled={inviting} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-medium">
                                    {inviting ? 'Sending...' : 'Send Invite'}
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
