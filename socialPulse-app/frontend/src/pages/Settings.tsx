import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { socialService, SocialAccount } from '../services/socialService';
import {
    Twitter, Linkedin, Facebook, Instagram,
    Trash2, Check, AlertCircle, User, Lock, Link, Bell,
    Users, UserPlus, Mail, LogOut,
} from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { logout } from '../store/authSlice';

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS = [
    { key: 'twitter',   label: 'Twitter / X',  icon: <Twitter   className="h-5 w-5 text-sky-500"  />, color: 'sky'   },
    { key: 'instagram', label: 'Instagram',     icon: <Instagram className="h-5 w-5 text-pink-500" />, color: 'pink'  },
    { key: 'linkedin',  label: 'LinkedIn',      icon: <Linkedin  className="h-5 w-5 text-blue-600" />, color: 'blue'  },
    { key: 'facebook',  label: 'Facebook',      icon: <Facebook  className="h-5 w-5 text-blue-700" />, color: 'indigo'},
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken(): string | null {
    return localStorage.getItem('accessToken');
}

function oauthUrl(platform: string): string {
    const token = getToken();
    return `/api/oauth/${platform}/connect${token ? `?token=${token}` : ''}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface AlertProps { type: 'success' | 'error'; message: string }
function Alert({ type, message }: AlertProps) {
    return (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm
            ${type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {type === 'success'
                ? <Check className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
            {message}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const Settings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    // ── Profile ───────────────────────────────────────────────────────────────
    const [fullName, setFullName]     = useState(user?.displayName ?? '');
    const [profileMsg, setProfileMsg] = useState<AlertProps | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);

    const saveProfile = async (e: FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg(null);
        try {
            await api.put('/auth/profile', { fullName });
            setProfileMsg({ type: 'success', message: 'Profile updated successfully.' });
        } catch {
            setProfileMsg({ type: 'error', message: 'Failed to update profile. Please try again.' });
        } finally {
            setSavingProfile(false);
        }
    };

    // ── Password ──────────────────────────────────────────────────────────────
    const [currentPw, setCurrentPw]   = useState('');
    const [newPw,     setNewPw]       = useState('');
    const [confirmPw, setConfirmPw]   = useState('');
    const [pwMsg,     setPwMsg]       = useState<AlertProps | null>(null);
    const [savingPw,  setSavingPw]    = useState(false);

    const changePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (newPw !== confirmPw) {
            setPwMsg({ type: 'error', message: 'New passwords do not match.' });
            return;
        }
        if (newPw.length < 8) {
            setPwMsg({ type: 'error', message: 'Password must be at least 8 characters.' });
            return;
        }
        setSavingPw(true);
        setPwMsg(null);
        try {
            await api.put('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
            setPwMsg({ type: 'success', message: 'Password changed successfully.' });
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Failed to change password.';
            setPwMsg({ type: 'error', message: msg });
        } finally {
            setSavingPw(false);
        }
    };

    // ── Connected Accounts ────────────────────────────────────────────────────
    const [accounts,      setAccounts]      = useState<SocialAccount[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [accountMsg,    setAccountMsg]    = useState<AlertProps | null>(null);

    useEffect(() => {
        socialService.getAccounts()
            .then(setAccounts)
            .catch(() => setAccountMsg({ type: 'error', message: 'Could not load connected accounts.' }))
            .finally(() => setAccountsLoading(false));

        // Handle OAuth redirect result via query params
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('connected');
        const error     = params.get('error');
        if (connected) {
            setAccountMsg({ type: 'success', message: `${connected} connected successfully!` });
            // Reload account list
            socialService.getAccounts().then(setAccounts).catch(() => {});
            // Clean URL
            window.history.replaceState({}, '', '/settings');
        } else if (error) {
            setAccountMsg({ type: 'error', message: `OAuth failed: ${error.replace(/_/g, ' ')}` });
            window.history.replaceState({}, '', '/settings');
        }
    }, []);

    const disconnect = async (platform: string) => {
        setDisconnecting(platform);
        setAccountMsg(null);
        try {
            await socialService.disconnect(platform);
            setAccounts(prev => prev.filter(a => a.platform !== platform));
            setAccountMsg({ type: 'success', message: `${platform} disconnected.` });
        } catch {
            setAccountMsg({ type: 'error', message: `Failed to disconnect ${platform}.` });
        } finally {
            setDisconnecting(null);
        }
    };

    const connectedMap = Object.fromEntries(accounts.map(a => [a.platform, a]));

    // ── Notification prefs (local toggle — extend with API as needed) ─────────
    const [emailNotifs, setEmailNotifs] = useState({
        postFailed:    true,
        paymentFailed: true,
        trialEnding:   true,
        weeklyDigest:  false,
    });

    // ── Teams ─────────────────────────────────────────────────────────────────
    interface TeamMember { id: string; user_id: string; role: string; email: string; full_name: string; }
    interface Team { id: string; name: string; owner_id: string; my_role: string; member_count: number; members?: TeamMember[]; }

    const [teams,       setTeams]       = useState<Team[]>([]);
    const [activeTeam,  setActiveTeam]  = useState<Team | null>(null);
    const [teamName,    setTeamName]    = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole,  setInviteRole]  = useState('member');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [inviting,     setInviting]    = useState(false);
    const [teamMsg,      setTeamMsg]     = useState<AlertProps | null>(null);

    useEffect(() => {
        api.get('/teams').then(r => {
            setTeams(r.data);
            if (r.data[0]) {
                api.get(`/teams/${r.data[0].id}`).then(d => setActiveTeam(d.data)).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const createTeam = async (e: FormEvent) => {
        e.preventDefault();
        if (!teamName.trim()) return;
        setCreatingTeam(true);
        try {
            const { data } = await api.post('/teams', { name: teamName });
            setTeams(prev => [data, ...prev]);
            setActiveTeam({ ...data, members: [] });
            setTeamName('');
            setTeamMsg({ type: 'success', message: 'Team created.' });
        } catch {
            setTeamMsg({ type: 'error', message: 'Failed to create team.' });
        } finally {
            setCreatingTeam(false);
        }
    };

    const inviteMember = async (e: FormEvent) => {
        e.preventDefault();
        if (!activeTeam || !inviteEmail.trim()) return;
        setInviting(true);
        setTeamMsg(null);
        try {
            await api.post(`/teams/${activeTeam.id}/invite`, { email: inviteEmail, role: inviteRole });
            setInviteEmail('');
            setTeamMsg({ type: 'success', message: `Invite sent to ${inviteEmail}` });
        } catch (err: any) {
            setTeamMsg({ type: 'error', message: err?.response?.data?.message ?? 'Failed to send invite.' });
        } finally {
            setInviting(false);
        }
    };

    const removeMember = async (userId: string) => {
        if (!activeTeam) return;
        try {
            await api.delete(`/teams/${activeTeam.id}/members/${userId}`);
            setActiveTeam(prev => prev ? {
                ...prev,
                members: prev.members?.filter(m => m.user_id !== userId),
            } : null);
            setTeamMsg({ type: 'success', message: 'Member removed.' });
        } catch {
            setTeamMsg({ type: 'error', message: 'Failed to remove member.' });
        }
    };

    // ── Danger Zone ───────────────────────────────────────────────────────────
    const [deleteConfirm, setDeleteConfirm]   = useState('');
    const [deletingAcct,  setDeletingAcct]    = useState(false);
    const [dangerMsg,     setDangerMsg]       = useState<AlertProps | null>(null);

    const deleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') {
            setDangerMsg({ type: 'error', message: 'Type DELETE to confirm.' });
            return;
        }
        setDeletingAcct(true);
        try {
            await api.delete('/auth/account');
            dispatch(logout());
            navigate('/login');
        } catch {
            setDangerMsg({ type: 'error', message: 'Failed to delete account. Contact support.' });
            setDeletingAcct(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="mt-1 text-sm text-gray-500">Manage your account, security, and connected platforms</p>
            </div>

            {/* ── Profile ─────────────────────────────────────────────────── */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <User className="h-5 w-5 text-indigo-500" /> Profile
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center
                                    text-indigo-700 font-bold text-xl shrink-0">
                        {(user?.displayName ?? user?.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{user?.displayName ?? '—'}</p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5
                                         text-xs font-medium text-indigo-700 capitalize">
                            {(user as any)?.plan ?? 'free'}
                        </span>
                    </div>
                </div>

                <form onSubmit={saveProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={user?.email ?? ''}
                            disabled
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2
                                       text-sm text-gray-500 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-400">Email cannot be changed here.</p>
                    </div>
                    {profileMsg && <Alert {...profileMsg} />}
                    <button
                        type="submit"
                        disabled={savingProfile}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                                   hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {savingProfile ? 'Saving…' : 'Save Profile'}
                    </button>
                </form>
            </section>

            {/* ── Security ────────────────────────────────────────────────── */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Lock className="h-5 w-5 text-indigo-500" /> Security
                </div>

                <form onSubmit={changePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <input
                            type="password"
                            value={currentPw}
                            onChange={e => setCurrentPw(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input
                            type="password"
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            required
                            minLength={8}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPw}
                            onChange={e => setConfirmPw(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    {pwMsg && <Alert {...pwMsg} />}
                    <button
                        type="submit"
                        disabled={savingPw}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                                   hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {savingPw ? 'Updating…' : 'Change Password'}
                    </button>
                </form>
            </section>

            {/* ── Connected Accounts ──────────────────────────────────────── */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Link className="h-5 w-5 text-indigo-500" /> Connected Accounts
                </div>

                {accountMsg && <Alert {...accountMsg} />}

                {accountsLoading ? (
                    <div className="space-y-3">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="animate-pulse h-14 rounded-lg bg-gray-100" />
                        ))}
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {PLATFORMS.map(p => {
                            const acct = connectedMap[p.key];
                            return (
                                <li key={p.key} className="flex items-center justify-between py-3 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {p.icon}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800">{p.label}</p>
                                            {acct
                                                ? <p className="text-xs text-gray-500 truncate">
                                                      @{acct.platform_username}
                                                      {acct.display_name ? ` · ${acct.display_name}` : ''}
                                                  </p>
                                                : <p className="text-xs text-gray-400">Not connected</p>
                                            }
                                        </div>
                                    </div>

                                    {acct ? (
                                        <button
                                            onClick={() => disconnect(p.key)}
                                            disabled={disconnecting === p.key}
                                            className="flex items-center gap-1.5 rounded-lg border border-red-200
                                                       px-3 py-1.5 text-xs font-medium text-red-600
                                                       hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0">
                                            <Trash2 className="h-3.5 w-3.5" />
                                            {disconnecting === p.key ? 'Disconnecting…' : 'Disconnect'}
                                        </button>
                                    ) : (
                                        <a
                                            href={oauthUrl(p.key)}
                                            className="flex items-center gap-1.5 rounded-lg border border-indigo-200
                                                       px-3 py-1.5 text-xs font-medium text-indigo-600
                                                       hover:bg-indigo-50 transition-colors shrink-0">
                                            <Link className="h-3.5 w-3.5" />
                                            Connect
                                        </a>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* ── Notifications ───────────────────────────────────────────── */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Bell className="h-5 w-5 text-indigo-500" /> Email Notifications
                </div>

                <ul className="divide-y divide-gray-100">
                    {([
                        { key: 'postFailed',    label: 'Post failed to publish',  desc: 'Get notified when a scheduled post fails' },
                        { key: 'paymentFailed', label: 'Payment failure',         desc: 'Alerts when your subscription payment fails' },
                        { key: 'trialEnding',   label: 'Trial ending reminder',   desc: '3-day warning before trial expires' },
                        { key: 'weeklyDigest',  label: 'Weekly analytics digest', desc: 'Summary of your top-performing posts' },
                    ] as const).map(item => (
                        <li key={item.key} className="flex items-center justify-between py-3 gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                            <button
                                role="switch"
                                aria-checked={emailNotifs[item.key]}
                                onClick={() => setEmailNotifs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                                            border-2 border-transparent transition-colors
                                            ${emailNotifs[item.key] ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full
                                                 bg-white shadow transform transition-transform
                                                 ${emailNotifs[item.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            {/* ── Team Members ────────────────────────────────────────────── */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Users className="h-5 w-5 text-indigo-500" /> Team Members
                </div>

                {teamMsg && <Alert {...teamMsg} />}

                {/* Team selector / create */}
                {teams.length === 0 ? (
                    <form onSubmit={createTeam} className="flex gap-3">
                        <input
                            type="text"
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            placeholder="Team name (e.g. Marketing)"
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={creatingTeam}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {creatingTeam ? 'Creating…' : 'Create Team'}
                        </button>
                    </form>
                ) : (
                    <>
                        {/* Active team header */}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-medium text-gray-900">{activeTeam?.name ?? teams[0]?.name}</p>
                                <p className="text-xs text-gray-500 capitalize">Your role: {activeTeam?.my_role ?? '—'}</p>
                            </div>
                            {teams.length > 1 && (
                                <select
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                                    onChange={e => {
                                        api.get(`/teams/${e.target.value}`).then(r => setActiveTeam(r.data)).catch(() => {});
                                    }}
                                >
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Member list */}
                        {activeTeam?.members && activeTeam.members.length > 0 && (
                            <ul className="divide-y divide-gray-100">
                                {activeTeam.members.filter(m => m.role !== undefined && (m as any).accepted !== false).map(m => (
                                    <li key={m.id} className="flex items-center justify-between py-3 gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                                {(m.full_name || m.email)[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{m.full_name || m.email}</p>
                                                <p className="text-xs text-gray-500 truncate">{m.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-gray-500 capitalize">{m.role}</span>
                                            {activeTeam.my_role === 'owner' && m.role !== 'owner' && (
                                                <button
                                                    onClick={() => removeMember(m.user_id)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Invite form */}
                        {(activeTeam?.my_role === 'owner' || activeTeam?.my_role === 'admin') && (
                            <form onSubmit={inviteMember} className="flex gap-2 flex-wrap">
                                <div className="relative flex-1 min-w-40">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        placeholder="Invite by email…"
                                        className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value)}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    {['viewer', 'member', 'admin'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    {inviting ? 'Sending…' : 'Invite'}
                                </button>
                            </form>
                        )}
                    </>
                )}
            </section>

            {/* ── Danger Zone ─────────────────────────────────────────────── */}
            <section className="rounded-xl border border-red-200 bg-white p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                    <AlertCircle className="h-5 w-5" /> Danger Zone
                </div>

                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type <span className="font-mono font-bold">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={e => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                        />
                    </div>
                    {dangerMsg && <Alert {...dangerMsg} />}
                    <button
                        onClick={deleteAccount}
                        disabled={deletingAcct || deleteConfirm !== 'DELETE'}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        {deletingAcct ? 'Deleting…' : 'Delete My Account'}
                    </button>
                </div>
            </section>
        </div>
    );
};
