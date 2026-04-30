// src/components/scheduler/BulkScheduler.tsx
import React, { useState } from 'react';
import { 
    Plus, Trash2, Send, Loader2, AlertCircle, CheckCircle, 
    Share2 as Twitter, 
    Share2 as Instagram, 
    Share2 as Linkedin, 
    Share2 as Facebook 
} from "lucide-react";
import toast from 'react-hot-toast';
import api from '../../services/api';

const PLATFORMS = [
    { id: 'twitter',   Icon: Twitter,   color: 'text-sky-500' },
    { id: 'instagram', Icon: Instagram, color: 'text-pink-600' },
    { id: 'linkedin',  Icon: Linkedin,  color: 'text-blue-700' },
    { id: 'facebook',  Icon: Facebook,  color: 'text-blue-600' },
];

interface BulkRow {
    id:          number;
    content:     string;
    platforms:   string[];
    scheduledAt: string;
}

let rowId = 1;
const newRow = (): BulkRow => ({
    id:          rowId++,
    content:     '',
    platforms:   ['twitter'],
    scheduledAt: '',
});

interface ResultItem { index: number; error: string }

export const BulkScheduler: React.FC = () => {
    const [rows,       setRows]       = useState<BulkRow[]>([newRow()]);
    const [submitting, setSubmitting] = useState(false);
    const [results,    setResults]    = useState<{ created: number; errors: ResultItem[] } | null>(null);

    const addRow = () => setRows(prev => [...prev, newRow()]);

    const removeRow = (id: number) =>
        setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

    const updateRow = (id: number, field: keyof Omit<BulkRow, 'id'>, value: any) =>
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

    const togglePlatform = (id: number, platform: string) =>
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const has = r.platforms.includes(platform);
            const next = has ? r.platforms.filter(p => p !== platform) : [...r.platforms, platform];
            return { ...r, platforms: next.length > 0 ? next : r.platforms };
        }));

    const submit = async () => {
        const valid = rows.filter(r => r.content.trim() && r.platforms.length > 0 && r.scheduledAt);
        if (valid.length === 0) {
            toast.error('Fill in at least one row with content, platform, and date');
            return;
        }
        setSubmitting(true);
        setResults(null);
        try {
            const { data } = await api.post('/posts/bulk', {
                posts: valid.map(r => ({
                    content:     r.content,
                    platforms:   r.platforms,
                    scheduledAt: r.scheduledAt,
                })),
            });
            setResults({ created: data.created.length, errors: data.errors ?? [] });
            if (data.created.length > 0) {
                toast.success(`${data.created.length} post${data.created.length !== 1 ? 's' : ''} scheduled`);
                const failedIndices = new Set((data.errors ?? []).map((e: ResultItem) => e.index));
                setRows(prev => {
                    const remaining = prev.filter((_, i) => failedIndices.has(i));
                    return remaining.length > 0 ? remaining : [newRow()];
                });
            }
            if (data.errors?.length) {
                toast.error(`${data.errors.length} post(s) failed`);
            }
        } catch (err: any) {
            if (err?.response?.status === 403) {
                toast.error(err.response.data?.message ?? 'Bulk scheduling requires a higher plan');
            } else {
                toast.error('Failed to bulk schedule posts');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {results && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                    results.errors.length === 0
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                    {results.errors.length === 0
                        ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    <div>
                        <p className="font-medium">{results.created} post{results.created !== 1 ? 's' : ''} scheduled successfully</p>
                        {results.errors.length > 0 && (
                            <ul className="mt-1 list-disc pl-4 space-y-0.5">
                                {results.errors.map(e => (
                                    <li key={e.index}>Row {e.index + 1}: {e.error}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Content</span>
                <span>Platforms</span>
                <span>Schedule At</span>
                <span />
            </div>

            <div className="space-y-3">
                {rows.map((row, i) => (
                    <div key={row.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start gap-3 flex-wrap md:flex-nowrap">
                            <textarea
                                value={row.content}
                                onChange={e => updateRow(row.id, 'content', e.target.value)}
                                placeholder={`Post ${i + 1} content…`}
                                rows={2}
                                className="flex-1 min-w-0 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />

                            <div className="flex gap-1 flex-wrap shrink-0">
                                {PLATFORMS.map(({ id, Icon, color }) => (
                                    <button
                                        key={id}
                                        onClick={() => togglePlatform(row.id, id)}
                                        title={id}
                                        className={`p-2 rounded-lg border-2 transition-colors ${
                                            row.platforms.includes(id)
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${row.platforms.includes(id) ? color : 'text-gray-400'}`} />
                                    </button>
                                ))}
                            </div>

                            <input
                                type="datetime-local"
                                value={row.scheduledAt}
                                onChange={e => updateRow(row.id, 'scheduledAt', e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />

                            <button
                                onClick={() => removeRow(row.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={addRow}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Row
                </button>

                <span className="text-sm text-gray-400 flex-1">
                    {rows.length} post{rows.length !== 1 ? 's' : ''} · bulk schedule sends all at once
                </span>

                <button
                    onClick={submit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                    {submitting
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</>
                        : <><Send className="w-4 h-4" /> Schedule All</>
                    }
                </button>
            </div>
        </div>
    );
};

export default BulkScheduler;