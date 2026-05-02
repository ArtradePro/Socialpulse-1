import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  plan: string;
  aiCredits: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  loading: false,
  error: null,
};

export const login = createAsyncThunk('auth/login', async (creds: { email: string; password: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', creds);
    localStorage.setItem('accessToken', data.token);
    return data;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Login failed';
    return rejectWithValue(msg);
  }
});

export const register = createAsyncThunk('auth/register', async (data: { email: string; password: string; fullName: string }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('accessToken', res.data.token);
    return res.data;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed';
    return rejectWithValue(msg);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.accessToken = null;
      localStorage.clear();
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.loading = false; s.user = a.payload.user; s.accessToken = a.payload.token; })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(register.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(register.fulfilled, (s, a) => { s.loading = false; s.user = a.payload.user; s.accessToken = a.payload.token; })
      .addCase(register.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
