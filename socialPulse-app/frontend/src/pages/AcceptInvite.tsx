import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import api from '../services/api';

type State =
    | { status: 'loading' }
    | { status: 'success'; teamName: string; role: string }
    | { status: 'register'; email: string; teamName: string }
    | { status: 'error'; message: string };

const AcceptInvite: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate   = useNavigate();
    const [state, setState] = useState<State>({ status: 'loading' });

    useEffect(() => {
        if (!token) {
            setState({ status: 'error', message: 'Invalid invite link.' });
            return;
        }

        let cancelled = false;

        api.get(`/teams/invite/${token}/accept`)
            .then(({ data }) => {
                if (cancelled) return;
                if (data.requiresRegistration) {
                    setState({ status: 'register', email: data.email, teamName: data.teamName });
                } else {
                    setState({ status: 'success', teamName: data.teamName, role: data.role });
                }
            })
            .catch((err) => {
                if (cancelled) return;
                const msg = err?.response?.data?.message ?? 'Invalid or expired invite link.';
                setState({ status: 'error', message: msg });
            });

        return () => { cancelled = true; };
    }, [token]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Zap className="h-7 w-7 text-indigo-600" />
                    <span className="text-xl font-bold text-gray-900">SocialPulse</span>
                </div>

                {state.status === 'loading' && (
                    <>
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
                        <p className="text-gray-600">Accepting your invitation…</p>
                    </>
                )}

                {state.status === 'success' && (
                    <>
                        <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
                        <h1 className="text-xl font-bold text-gray-900">You're in!</h1>
                        <p className="text-gray-600">
                            You've joined <strong>{state.teamName}</strong> as a{' '}
                            <strong>{state.role}</strong>.
                        </p>
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium
                                       hover:bg-indigo-700 transition-colors"
                        >
                            Go to Settings
                        </button>
                    </>
                )}

                {state.status === 'register' && (
                    <>
                        <Users className="h-14 w-14 text-indigo-400 mx-auto" />
                        <h1 className="text-xl font-bold text-gray-900">Create an account to join</h1>
                        <p className="text-gray-600">
                            You've been invited to join <strong>{state.teamName}</strong> on SocialPulse.
                            Create a free account to accept.
                        </p>
                        <Link
                            to={`/register?email=${encodeURIComponent(state.email)}&invite=${token}`}
                            className="block w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium
                                       hover:bg-indigo-700 transition-colors"
                        >
                            Create Account
                        </Link>
                        <Link
                            to={`/login?invite=${token}`}
                            className="block w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl
                                       font-medium hover:bg-gray-50 transition-colors"
                        >
                            Already have an account? Log in
                        </Link>
                    </>
                )}

                {state.status === 'error' && (
                    <>
                        <XCircle className="h-14 w-14 text-red-400 mx-auto" />
                        <h1 className="text-xl font-bold text-gray-900">Invite not found</h1>
                        <p className="text-gray-600">{state.message}</p>
                        <Link
                            to="/login"
                            className="block w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl
                                       font-medium hover:bg-gray-50 transition-colors"
                        >
                            Back to Login
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default AcceptInvite;
