import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

type Listener = () => void;

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
}

let state: AuthState = { user: null, token: null, isLoading: true };
const listeners = new Set<Listener>();

const notify = (): void => listeners.forEach((l) => l());

export const authStore = {
    getState: (): AuthState => state,

    subscribe: (listener: Listener): (() => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    init: async (): Promise<void> => {
        try {
            const [token, userJson] = await Promise.all([
                AsyncStorage.getItem('authToken'),
                AsyncStorage.getItem('authUser'),
            ]);
            if (token && userJson) {
                state = { user: JSON.parse(userJson) as User, token, isLoading: false };
            } else {
                state = { user: null, token: null, isLoading: false };
            }
        } catch {
            state = { user: null, token: null, isLoading: false };
        }
        notify();
    },

    login: async (token: string, user: User): Promise<void> => {
        await Promise.all([
            AsyncStorage.setItem('authToken', token),
            AsyncStorage.setItem('authUser', JSON.stringify(user)),
        ]);
        state = { user, token, isLoading: false };
        notify();
    },

    updateUser: async (user: User): Promise<void> => {
        await AsyncStorage.setItem('authUser', JSON.stringify(user));
        state = { ...state, user };
        notify();
    },

    logout: async (): Promise<void> => {
        await Promise.all([
            AsyncStorage.removeItem('authToken'),
            AsyncStorage.removeItem('authUser'),
            AsyncStorage.removeItem('activeWorkspaceId'),
        ]);
        state = { user: null, token: null, isLoading: false };
        notify();
    },
};
