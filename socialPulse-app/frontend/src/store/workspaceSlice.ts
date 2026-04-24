import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Workspace {
    id:         string;
    name:       string;
    slug:       string;
    logo_url:   string | null;
    owner_id:   string;
    role:       string;
    created_at: string;
}

interface WorkspaceState {
    workspaces:  Workspace[];
    activeId:    string | null;
}

const STORAGE_KEY = 'activeWorkspaceId';

const initialState: WorkspaceState = {
    workspaces: [],
    activeId:   localStorage.getItem(STORAGE_KEY) ?? null,
};

const workspaceSlice = createSlice({
    name: 'workspace',
    initialState,
    reducers: {
        setWorkspaces(state, action: PayloadAction<Workspace[]>) {
            state.workspaces = action.payload;
        },
        switchWorkspace(state, action: PayloadAction<string>) {
            state.activeId = action.payload;
            localStorage.setItem(STORAGE_KEY, action.payload);
        },
        clearWorkspace(state) {
            state.activeId = null;
            localStorage.removeItem(STORAGE_KEY);
        },
        addWorkspace(state, action: PayloadAction<Workspace>) {
            state.workspaces.push(action.payload);
        },
        removeWorkspace(state, action: PayloadAction<string>) {
            state.workspaces = state.workspaces.filter(w => w.id !== action.payload);
            if (state.activeId === action.payload) {
                state.activeId = state.workspaces[0]?.id ?? null;
                if (state.activeId) localStorage.setItem(STORAGE_KEY, state.activeId);
                else localStorage.removeItem(STORAGE_KEY);
            }
        },
    },
});

export const { setWorkspaces, switchWorkspace, clearWorkspace, addWorkspace, removeWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;
