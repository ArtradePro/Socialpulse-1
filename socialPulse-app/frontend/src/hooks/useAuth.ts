import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { login, logout, register } from '../store/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, loading, error, accessToken } = useSelector((s: RootState) => s.auth);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!accessToken,
    login: (email: string, password: string) => dispatch(login({ email, password })),
    register: (data: { email: string; password: string; username: string; displayName: string }) =>
      dispatch(register(data)),
    logout: () => dispatch(logout()),
  };
};
