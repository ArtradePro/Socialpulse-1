import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, Plus, Trash2, Power, PowerOff, RefreshCw, Mail, Smartphone,
    ArrowRight, Sparkles, X, ChevronLeft, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Automation {
    id: string;
    name: string;
    trigger_event: string;
    logic_payload: {
        action: 'send_email' | 'send_sms';
        template_subject?: string;
        template_body: string;
    };
    is_active: boolean;
    created_at: string;
}

const TRIGGER_EVENTS = [
    { value: 'contact_created', label: 'New Contact Added', description: 'Fires when a new contact is created or imported' },
    { value: 'contact_updated', label: 'Contact Updated', description: 'Fires when a contact record is modified' },
    { value: 'campaign_completed', label: 'Campaign Completed', description: 'Fires when a broadcast campaign finishes sending' },
    { value: 'tag_added', label: 'Tag Added', description: 'Fires when a tag is applied to a contact' },
];

const ACTION_TYPES = [
    { value: 'send_email', label: 'Send Email', icon: Mail, color: 'text-indigo-600 bg-indigo-50' },
    { value: 'send_sms', label: 'Send SMS', icon: Smartphone, color: 'text-sky-600 bg-sky-50' },
];

const TEMPLATE_VARS = ['{{first_name}}', '{{last_name}}', '{{email}}', '{{phone}}'];

export const Automations: React.FC = () => {
    const navigate = useNavigate();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        triggerEvent: 'contact_created',
        action: 'send_email' as 'send_email' | 'send_sms',
        templateSubject: '',
        templateBody: '',
    });

    const fetchAutomations = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/marketing/automations');
            setAutomations(data.automations);
        } catch {
            toast.error('Failed to load automations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAutomations(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.templateBody.trim()) {
            toast.error('Name and template body are required');
            return;
        }
        if (form.action === 'send_email' && !form.templateSubject.trim()) {
            toast.error('Subject line is required for email automations');
            return;
        }

        setSaving(true);
        const toastId = toast.loading('Creating automation...');
        try {
            await api.post('/marketing/automations', {
                name: form.name,
                triggerEvent: form.triggerEvent,
                logicPayload: {
                    action: form.action,
                    template_subject: form.action === 'send_email' ? form.templateSubject : undefined,
                    template_body: form.templateBody,
                },
            });
            toast.success('Automation created successfully!', { id: toastId });
            setIsCreateOpen(false);
            setForm({ name: '', triggerEvent: 'contact_created', action: 'send_email', templateSubject: '', templateBody: '' });
            fetchAutomations();
        } catch {
            toast.error('Failed to create automation', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const triggerLabel = (event: string) =>
        TRIGGER_EVENTS.find(t => t.value === event)?.label || event;

    const actionMeta = (action: string) =>
        ACTION_TYPES.find(a => a.value === action) || ACTION_TYPES[0];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button
                            onClick={() => navigate('/marketing')}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            <Zap className="h-8 w-8 text-purple-600" />
                            Marketing Automations
                        </h1>
                    </div>
                    <p className="text-gray-500 mt-1 text-sm md:text-base ml-11">
                        Create event-driven workflows that automatically send emails or SMS to your contacts.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                    >
                        <Plus className="h-4 w-4" />
                        New Automation
                    </button>
                    <button
                        onClick={fetchAutomations}
                        className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 shadow-sm transition"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Automation List */}
            {loading ? (
                <div className="text-center py-16 text-gray-400">
                    <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
                    Loading automations...
                </div>
            ) : automations.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-8">
                    <Zap className="h-14 w-14 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">No automations yet</h3>
                    <p className="text-gray-500 mt-1 max-w-md mx-auto text-sm">
                        Create your first automation to trigger emails or SMS based on events like new contact signups or campaign completions.
                    </p>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition"
                    >
                        <Sparkles className="h-4 w-4" />
                        Create Your First Automation
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {automations.map((auto) => {
                        const meta = actionMeta(auto.logic_payload.action);
                        const ActionIcon = meta.icon;
                        return (
                            <div
                                key={auto.id}
                                className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${
                                    auto.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                                }`}
                            >
                                {/* Active indicator */}
                                <div className={`absolute top-0 left-0 right-0 h-1 ${
                                    auto.is_active
                                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                                        : 'bg-gray-200'
                                }`} />

                                <div className="space-y-4 mt-1">
                                    {/* Name & Status */}
                                    <div className="flex items-start justify-between">
                                        <h3 className="text-base font-bold text-gray-900 pr-2">{auto.name}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            auto.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {auto.is_active ? <Power className="h-2.5 w-2.5" /> : <PowerOff className="h-2.5 w-2.5" />}
                                            {auto.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    {/* Trigger → Action Flow */}
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="flex-1 text-center">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Trigger</span>
                                            <span className="text-xs font-semibold text-gray-700 bg-white px-2 py-1 rounded-lg border border-gray-200 inline-block">
                                                {triggerLabel(auto.trigger_event)}
                                            </span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-purple-400 shrink-0" />
                                        <div className="flex-1 text-center">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Action</span>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1 ${meta.color}`}>
                                                <ActionIcon className="h-3 w-3" />
                                                {meta.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Template Preview */}
                                    {auto.logic_payload.template_subject && (
                                        <p className="text-xs text-gray-500 truncate">
                                            <span className="font-semibold text-gray-600">Subject:</span> {auto.logic_payload.template_subject}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 line-clamp-2 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        "{auto.logic_payload.template_body}"
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <span className="text-[10px] text-gray-400">
                                            Created {new Date(auto.created_at).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm('Delete this automation?')) return;
                                                try {
                                                    await api.delete(`/marketing/automations/${auto.id}`);
                                                    toast.success('Automation deleted');
                                                    fetchAutomations();
                                                } catch {
                                                    toast.error('Failed to delete');
                                                }
                                            }}
                                            className="text-red-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Automation Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                New Automation Rule
                            </h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-white/70 hover:text-white transition">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Automation Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Welcome Email on Signup"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>

                            {/* Trigger Event */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Trigger Event
                                </label>
                                <select
                                    value={form.triggerEvent}
                                    onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {TRIGGER_EVENTS.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    {TRIGGER_EVENTS.find(t => t.value === form.triggerEvent)?.description}
                                </p>
                            </div>

                            {/* Action Type */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Action
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {ACTION_TYPES.map(a => {
                                        const Icon = a.icon;
                                        return (
                                            <button
                                                key={a.value}
                                                type="button"
                                                onClick={() => setForm({ ...form, action: a.value as 'send_email' | 'send_sms' })}
                                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition ${
                                                    form.action === a.value
                                                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {a.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subject (email only) */}
                            {form.action === 'send_email' && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Email Subject <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required={form.action === 'send_email'}
                                        placeholder="Welcome to {{first_name}}! Here's your onboarding guide"
                                        value={form.templateSubject}
                                        onChange={e => setForm({ ...form, templateSubject: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            )}

                            {/* Template Body */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    {form.action === 'send_email' ? 'Email Body' : 'SMS Message'} <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    placeholder={form.action === 'send_email'
                                        ? 'Hi {{first_name}},\n\nWelcome aboard! We\'re excited to have you...'
                                        : 'Hi {{first_name}}, thanks for signing up! Reply STOP to unsubscribe.'
                                    }
                                    value={form.templateBody}
                                    onChange={e => setForm({ ...form, templateBody: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="text-[10px] text-gray-400 font-semibold">Variables:</span>
                                    {TEMPLATE_VARS.map(v => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setForm({ ...form, templateBody: form.templateBody + v })}
                                            className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md font-mono font-bold hover:bg-purple-100 transition"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                                {form.action === 'send_sms' && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Characters: {form.templateBody.length} ({Math.ceil(form.templateBody.length / 160) || 1} SMS segment{Math.ceil(form.templateBody.length / 160) > 1 ? 's' : ''})
                                    </p>
                                )}
                            </div>

                            {/* Info box */}
                            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700">
                                    This automation will execute automatically whenever the trigger event fires. Only contacts with active email/SMS subscriptions will receive messages.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Create Automation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Automations;
