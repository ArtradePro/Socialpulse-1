import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

interface Post {
  id: string;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  media_url?: string;
  scheduled_at?: string;
  created_at: string;
}

interface PostsState {
  items: Post[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
}

const initialState: PostsState = {
  items: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
};

export const fetchPosts = createAsyncThunk('posts/fetchAll', async (params: { page?: number; limit?: number } = {}) => {
  const { data } = await api.get('/posts', { params });
  return data;
});

export const createPost = createAsyncThunk('posts/create', async (post: Partial<Post>, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/posts', post);
    return data;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create post';
    return rejectWithValue(msg);
  }
});

export const deletePost = createAsyncThunk('posts/delete', async (id: string) => {
  await api.delete(`/posts/${id}`);
  return id;
});

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (s) => { s.loading = true; })
      .addCase(fetchPosts.fulfilled, (s, a) => { s.loading = false; s.items = a.payload.posts || a.payload; s.total = a.payload.total || s.items.length; })
      .addCase(fetchPosts.rejected, (s, a) => { s.loading = false; s.error = a.error.message || null; })
      .addCase(createPost.fulfilled, (s, a) => { s.items.unshift(a.payload); })
      .addCase(deletePost.fulfilled, (s, a) => { s.items = s.items.filter(p => p.id !== a.payload); });
  },
});

export default postsSlice.reducer;
