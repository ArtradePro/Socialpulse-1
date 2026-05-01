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
    
    // FIX: Map the incoming data to the 'fullName' property expected by the store
    register: (data: { email: string; password: string; username: string; displayName: string }) =>
      dispatch(register({ 
        email: data.email, 
        password: data.password, 
        // Logic: Use displayName if it exists, otherwise use username, otherwise fallback to 'User'
        fullName: data.displayName || data.username || 'User' 
      })),
      
    logout: () => dispatch(logout())
  };
};