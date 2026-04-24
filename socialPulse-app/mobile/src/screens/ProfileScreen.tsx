import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../services/api';
import { authStore } from '../store/authStore';
import { useAuth } from '../hooks/useAuth';
import type { SocialAccount, User, Platform } from '../types';

const PLATFORM_COLORS: Record<Platform, string> = {
    twitter:   '#1DA1F2',
    instagram: '#E1306C',
    linkedin:  '#0077B5',
    facebook:  '#1877F2',
};

const PLATFORM_EMOJI: Record<Platform, string> = {
    twitter:   '🐦',
    instagram: '📸',
    linkedin:  '💼',
    facebook:  '👥',
};

const PLAN_COLORS: Record<string, string> = {
    free:       '#6B7280',
    starter:    '#3B82F6',
    pro:        '#7C3AED',
    enterprise: '#F59E0B',
};

export const ProfileScreen: React.FC = () => {
    const { user } = useAuth();
    const [accounts, setAccounts]   = useState<SocialAccount[]>([]);
    const [editing, setEditing]     = useState(false);
    const [fullName, setFullName]   = useState(user?.fullName ?? '');
    const [saving, setSaving]       = useState(false);

    const [changingPw, setChangingPw]   = useState(false);
    const [currentPw, setCurrentPw]     = useState('');
    const [newPw, setNewPw]             = useState('');
    const [savingPw, setSavingPw]       = useState(false);

    const loadAccounts = useCallback(async (): Promise<void> => {
        try {
            const { data } = await api.get<SocialAccount[]>('/social/accounts');
            setAccounts(data);
        } catch {
            // no accounts is fine
        }
    }, []);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const handleSaveProfile = async (): Promise<void> => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Name cannot be empty.');
            return;
        }
        setSaving(true);
        try {
            type ProfileResponse = Omit<User, 'avatarUrl'> & { avatar: string | null };
            const { data } = await api.put<ProfileResponse>('/auth/profile', { fullName: fullName.trim() });
            await authStore.updateUser({ ...data, avatarUrl: data.avatar });
            setEditing(false);
            Toast.show({ type: 'success', text1: 'Profile updated' });
        } catch {
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (): Promise<void> => {
        if (!currentPw.trim() || !newPw.trim()) {
            Alert.alert('Error', 'Please fill in both password fields.');
            return;
        }
        if (newPw.length < 8) {
            Alert.alert('Error', 'New password must be at least 8 characters.');
            return;
        }
        setSavingPw(true);
        try {
            await api.put('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
            setChangingPw(false);
            setCurrentPw('');
            setNewPw('');
            Toast.show({ type: 'success', text1: 'Password changed' });
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to change password.';
            Alert.alert('Error', msg);
        } finally {
            setSavingPw(false);
        }
    };

    const handleDisconnect = (accountId: string, platform: string): void => {
        Alert.alert(
            'Disconnect Account',
            `Disconnect ${platform} account?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/oauth/${accountId}`);
                            setAccounts((prev) => prev.filter((a) => a.id !== accountId));
                            Toast.show({ type: 'success', text1: `${platform} disconnected` });
                        } catch {
                            Alert.alert('Error', 'Failed to disconnect account.');
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = (): void => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => authStore.logout() },
        ]);
    };

    const avatarUri = user?.avatarUrl ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName ?? 'U')}&background=7C3AED&color=fff`;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.pageTitle}>Profile</Text>

                {/* Avatar + name */}
                <View style={styles.avatarSection}>
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    <Text style={styles.userName}>{user?.fullName}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>
                    <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[user?.plan ?? 'free'] + '22' }]}>
                        <Text style={[styles.planBadgeText, { color: PLAN_COLORS[user?.plan ?? 'free'] }]}>
                            {(user?.plan ?? 'free').toUpperCase()} PLAN
                        </Text>
                    </View>
                </View>

                {/* Edit profile */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Profile</Text>
                        {!editing && (
                            <TouchableOpacity onPress={() => { setEditing(true); setFullName(user?.fullName ?? ''); }}>
                                <Text style={styles.editLink}>Edit</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {editing ? (
                        <View style={styles.editForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="Full name"
                                placeholderTextColor="#9CA3AF"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, saving && styles.btnDisabled]}
                                    onPress={handleSaveProfile}
                                    disabled={saving}
                                >
                                    {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.infoValue}>{user?.fullName}</Text>
                    )}
                </View>

                {/* Change password */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Password</Text>
                        {!changingPw && (
                            <TouchableOpacity onPress={() => setChangingPw(true)}>
                                <Text style={styles.editLink}>Change</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {changingPw && (
                        <View style={styles.editForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="Current password"
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry
                                value={currentPw}
                                onChangeText={setCurrentPw}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="New password (min 8 chars)"
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry
                                value={newPw}
                                onChangeText={setNewPw}
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setChangingPw(false); setCurrentPw(''); setNewPw(''); }}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, savingPw && styles.btnDisabled]}
                                    onPress={handleChangePassword}
                                    disabled={savingPw}
                                >
                                    {savingPw ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Update</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Connected accounts */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connected Accounts</Text>
                    {accounts.length === 0 ? (
                        <Text style={styles.emptyText}>No connected accounts. Add them from the web app's Settings page.</Text>
                    ) : (
                        accounts.map((account) => (
                            <View key={account.id} style={styles.accountRow}>
                                <Text style={styles.accountEmoji}>{PLATFORM_EMOJI[account.platform as Platform] ?? '🌐'}</Text>
                                <View style={styles.accountInfo}>
                                    <Text style={[styles.accountPlatform, { color: PLATFORM_COLORS[account.platform as Platform] ?? '#6B7280' }]}>
                                        {account.platform}
                                    </Text>
                                    <Text style={styles.accountUsername}>@{account.username}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.disconnectBtn}
                                    onPress={() => handleDisconnect(account.id, account.platform)}
                                >
                                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutBtnText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scroll:    { paddingHorizontal: 20, paddingBottom: 40 },
    pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 20 },

    avatarSection: { alignItems: 'center', marginBottom: 24 },
    avatar:        { width: 72, height: 72, borderRadius: 36, marginBottom: 10 },
    userName:      { fontSize: 20, fontWeight: '700', color: '#111827' },
    userEmail:     { fontSize: 13, color: '#6B7280', marginTop: 2 },
    planBadge:     { marginTop: 8, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
    planBadgeText: { fontSize: 11, fontWeight: '700' },

    section: {
        backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
        marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#111827' },
    editLink:      { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
    infoValue:     { fontSize: 14, color: '#374151' },

    editForm:    { marginTop: 8, gap: 10 },
    input: {
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 14, color: '#111827',
    },
    editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cancelBtn:   { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
    saveBtn:     { flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    saveBtnText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
    btnDisabled: { opacity: 0.6 },

    accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    accountEmoji: { fontSize: 20, marginRight: 10 },
    accountInfo:  { flex: 1 },
    accountPlatform: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
    accountUsername: { fontSize: 12, color: '#6B7280' },
    disconnectBtn:     { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    disconnectBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },

    emptyText: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

    logoutBtn: {
        marginTop: 8, borderWidth: 1, borderColor: '#FCA5A5',
        borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
    logoutBtnText: { fontSize: 15, color: '#EF4444', fontWeight: '700' },
});
