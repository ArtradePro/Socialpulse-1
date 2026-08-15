import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { setUser } from '../store/authSlice';
import { Button } from '../components/common/Button';
import api from '../services/api';
import logo from '../assets/logo.png';
interface FormData { email: string; password: string }

export const Login = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams] = useSearchParams();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  // Handle Google OAuth redirect: /login?token=XXX or /login?error=google_failed
  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (token) {
      localStorage.setItem('accessToken', token);
      // Fetch user profile then redirect to dashboard
      api.get('/auth/profile').then(({ data }) => {
        dispatch(setUser({
          id: data.id,
          email: data.email,
          fullName: data.fullName || data.full_name,
          avatar: data.avatar_url,
          plan: data.plan ?? 'free',
          aiCredits: data.ai_credits ?? 0,
        }));
        navigate('/dashboard', { replace: true });
      }).catch(() => {
        localStorage.removeItem('accessToken');
        setOauthError('Google sign-in failed. Please try again.');
      });
    } else if (errorParam) {
      setOauthError('Google sign-in failed. Please try again or use email/password.');
    }
  }, [searchParams, dispatch, navigate]);

  const onSubmit = async (data: FormData) => {
    const result = await login(data.email, data.password);
    if (!('error' in result)) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="SocialPulse" className="h-16 w-auto mx-auto rounded-xl shadow-sm" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" {...register('email', { required: 'Email is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" {...register('password', { required: 'Password is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            {(error || oauthError) && <p className="text-sm text-red-500">{oauthError || error}</p>}
            <Button type="submit" loading={loading} className="w-full">Sign in</Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <a
                href={`${(import.meta.env.VITE_API_URL as string | undefined) ?? '/api'}/auth/google`}
                className="w-full flex justify-center items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29.81-.55z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:underline">Sign up</Link>
          </p>
          <div className="mt-6 border-t border-gray-100 pt-4 flex justify-center items-center gap-4 text-xs text-gray-400">
            <Link to="/terms" className="hover:text-gray-600 transition">Terms of Service</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-gray-600 transition">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
