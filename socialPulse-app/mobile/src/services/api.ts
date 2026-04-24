import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Set apiUrl in app.json > extra for device testing (use your machine's LAN IP, e.g. http://192.168.1.x:5000/api)
const BASE_URL: string =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    'http://localhost:5000/api';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceId = await AsyncStorage.getItem('activeWorkspaceId');
    if (workspaceId) {
        config.headers['X-Workspace-Id'] = workspaceId;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('activeWorkspaceId');
        }
        return Promise.reject(error);
    }
);

export default api;
