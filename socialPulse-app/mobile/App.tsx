import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AppNavigator } from './src/navigation';
import { authStore } from './src/store/authStore';

export default function App(): React.ReactElement {
    useEffect(() => {
        authStore.init();
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />
            <AppNavigator />
            <Toast />
        </SafeAreaProvider>
    );
}
