import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, X, Copy, Check, Loader2, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface ApiKey {
    id:           string;
    name:         string;
    key_prefix:   string;
    is_active:    boolean;
    last_used_at: string | null;
    created_at:   string;
}

export const ApiKeys: React.FC = () => {
    const [keys,       setKeys]       = useState<ApiKey[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName,    setNewName]    = useState('');
    const [saving,     setSaving]     = useState(false);
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [copied,     setCopied]     = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/api-keys')
            .then(({ data }) => { if (!cancelled) { setKeys(data); setLoading(false); } })
            .catch(() => { setLoading(false); toast.error('Failed to load API keys'); });
        return () => { cancelled = true; };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.post('/api-keys', { name: newName });
            setRevealedKey(data.key);
            const { key: _key, ...rest } = data;
            setKeys(prev => [rest, ...prev]);
            setNewName('');
            setShowCreate(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to generate key');
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return;
        try {
            await api.patch(`/api-keys/${id}/revoke`);
            setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
            toast.success('Key revoked');
        } catch { toast.error('Failed to revoke key'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Permanently delete this API key?')) return;
        try {
            await api.delete(`/api-keys/${id}`);
            setKeys(prev => prev.filter(k => k.id !== id));
            toast.success('Key deleted');
        } catch { toast.error('Failed to delete key'); }
    };

    const copyKey = () => {
        if (!revealedKey) return;
        navigator.clipboard.writeText(revealedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
                    <p className="text-sm text-gray-500 mt-1">Authenticate external integrations using the SocialPulse API</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> New Key
                </button>
            </div>

            {/* Revealed key banner */}
            {revealedKey && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 space-y-3">
                    <p className="text-sm font-semibold text-yellow-800">
                        Copy your key now — it won't be shown again.
                    </p>
                    <div className="flex items-center gap-3 bg-white border border-yellow-200 rounded-xl px-4 py-2.5">
                        <code className="flex-1 text-sm font-mono text-gray-800 break-all">{revealedKey}</code>
                        <button onClick={copyKey}
                            className="shrink-0 text-yellow-700 hover:text-yellow-900">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                    <button onClick={() => setRevealedKey(null)}
                        className="text-xs text-yellow-700 underline">I've saved it, dismiss</button>
                </div>
            )}

            {/* Usage note */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
                Pass the key in requests as: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono text-xs">X-API-Key: your-key</code>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : keys.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                    <Key className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No API keys yet</p>
                    <p className="text-gray-400 text-sm mt-1">Generate a key to access the API from external tools</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                    {keys.map(k => (
                        <div key={k.id} className="flex items-center justify-between px-5 py-4 gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <Key className={`w-4 h-4 shrink-0 ${k.is_active ? 'text-indigo-500' : 'text-gray-300'}`} />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{k.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{k.key_prefix}…</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${k.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {k.is_active ? 'active' : 'revoked'}
                                    </span>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                                    </p>
                                </div>
                                {k.is_active && (
                                    <button onClick={() => handleRevoke(k.id)} title="Revoke"
                                        className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                                        <ShieldOff className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => handleDelete(k.id)} title="Delete"
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">New API Key</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Key name *</label>
                                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Zapier integration, Local dev"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Generate Key
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeys;
