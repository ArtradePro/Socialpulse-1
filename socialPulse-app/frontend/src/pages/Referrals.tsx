import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Referral {
    id:             string;
    status:         'pending' | 'completed';
    reward_credits: number;
    referred_email: string | null;
    referred_name:  string | null;
    created_at:     string;
    completed_at:   string | null;
}

interface ReferralData {
    code:                string;
    referrals:           Referral[];
    totalCreditsEarned:  number;
}

export const Referrals: React.FC = () => {
    const [data,    setData]    = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied,  setCopied]  = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/referrals/me')
            .then(({ data: d }) => { if (!cancelled) { setData(d); setLoading(false); } })
            .catch(() => { setLoading(false); toast.error('Failed to load referral data'); });
        return () => { cancelled = true; };
    }, []);

    const referralLink = data
        ? `${window.location.origin}/register?ref=${data.code}`
        : '';

    const copyLink = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Link copied!');
    };

    const completed = data?.referrals.filter(r => r.status === 'completed') ?? [];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
                <p className="text-sm text-gray-500 mt-1">Invite friends and earn 20 AI credits for each person who signs up</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total invited', value: data?.referrals.length ?? 0 },
                    { label: 'Signed up',     value: completed.length },
                    { label: 'Credits earned', value: data?.totalCreditsEarned ?? 0 },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                        <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Referral link */}
            <div className="bg-linear-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">Your referral link</p>
                        <p className="text-sm text-gray-500">Share it anywhere — you earn 20 credits when someone registers</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <code className="flex-1 text-sm text-gray-700 truncate">{referralLink}</code>
                    <button onClick={copyLink}
                        className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>

                <p className="text-xs text-gray-500">
                    Your code: <code className="font-mono font-semibold text-gray-800">{data?.code}</code>
                </p>
            </div>

            {/* Referral list */}
            <div className="bg-white rounded-2xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" /> Your referrals
                    </p>
                </div>
                {(data?.referrals.length ?? 0) === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-sm">No referrals yet — share your link to get started</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {data!.referrals.map(r => (
                            <div key={r.id} className="flex items-center justify-between px-5 py-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {r.referred_name ?? r.referred_email ?? 'Anonymous'}
                                    </p>
                                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {r.status}
                                    </span>
                                    {r.status === 'completed' && (
                                        <p className="text-xs text-gray-400 mt-0.5">+{r.reward_credits} credits</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Referrals;
