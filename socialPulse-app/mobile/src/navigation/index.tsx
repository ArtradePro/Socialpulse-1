import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../components/LoadingScreen';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ContentStudioScreen } from '../screens/ContentStudioScreen';
import { SchedulerScreen } from '../screens/SchedulerScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
};

export type TabParamList = {
    Dashboard: undefined;
    Studio: undefined;
    Scheduler: undefined;
    Analytics: undefined;
    Profile: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
    Dashboard: '🏠',
    Studio: '✏️',
    Scheduler: '📅',
    Analytics: '📊',
    Profile: '👤',
};

const TabIcon = ({ icon, focused }: { icon: string; focused: boolean }): React.ReactElement => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
);

const MainTabs: React.FC = () => (
    <Tab.Navigator
        screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => (
                <TabIcon icon={TAB_ICONS[route.name as keyof TabParamList]} focused={focused} />
            ),
            tabBarActiveTintColor: '#7C3AED',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: {
                backgroundColor: '#FFFFFF',
                borderTopColor: '#E5E7EB',
                paddingBottom: 4,
                height: 60,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerShown: false,
        })}
    >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Studio" component={ContentStudioScreen} options={{ title: 'Studio' }} />
        <Tab.Screen name="Scheduler" component={SchedulerScreen} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
);

export const AppNavigator: React.FC = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) return <LoadingScreen />;

    return (
        <NavigationContainer>
            {user ? (
                <MainTabs />
            ) : (
                <AuthStack.Navigator screenOptions={{ headerShown: false }}>
                    <AuthStack.Screen name="Login" component={LoginScreen} />
                    <AuthStack.Screen name="Register" component={RegisterScreen} />
                </AuthStack.Navigator>
            )}
        </NavigationContainer>
    );
};
