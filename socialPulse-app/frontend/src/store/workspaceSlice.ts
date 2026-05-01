import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../services/api';

export interface Workspace {
    id: string;
    name: string;
    role: 'admin' | 'member' | 'viewer' | 'owner'; // Added 'owner' to match your UI check
    memberCount: number;
    createdAt?: string;
}

interface WorkspaceState {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    activeId: string | null; // Added this back
    loading: boolean;
    error: string | null;
}

const initialState: WorkspaceState = {
    workspaces: [],
    currentWorkspace: null,
    activeId: localStorage.getItem('activeWorkspaceId'),
    loading: false,
    error: null,
};

export const fetchWorkspaces = createAsyncThunk(
    'workspaces/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get<Workspace[]>('/workspaces');
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to fetch');
        }
    }
);

const workspaceSlice = createSlice({
    name: 'workspace', // Ensure this is singular to match your selectors
    initialState,
    reducers: {
        setWorkspaces: (state, action: PayloadAction<Workspace[]>) => {
            state.workspaces = action.payload;
        },
        switchWorkspace: (state, action: PayloadAction<string>) => {
            state.activeId = action.payload;
            state.currentWorkspace = state.workspaces.find(w => w.id === action.payload) || null;
            localStorage.setItem('activeWorkspaceId', action.payload);
        },
        addWorkspace: (state, action: PayloadAction<Workspace>) => {
            state.workspaces.push(action.payload);
        },
        removeWorkspace: (state, action: PayloadAction<string>) => {
            state.workspaces = state.workspaces.filter(w => w.id !== action.payload);
            if (state.activeId === action.payload) state.activeId = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchWorkspaces.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchWorkspaces.fulfilled, (state, action) => {
                state.loading = false;
                state.workspaces = action.payload;
                if (!state.activeId && action.payload.length > 0) {
                    state.activeId = action.payload[0].id;
                }
            })
            .addCase(fetchWorkspaces.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setWorkspaces, switchWorkspace, addWorkspace, removeWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;