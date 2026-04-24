import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../services/api';
import type { Platform, SocialAccount } from '../types';

const ALL_PLATFORMS: Platform[] = ['twitter', 'instagram', 'linkedin', 'facebook'];

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

interface AiResult { content: string }

export const ContentStudioScreen: React.FC = () => {
    const [content, setContent]               = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
    const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
    const [aiTopic, setAiTopic]               = useState('');
    const [showAi, setShowAi]                 = useState(false);
    const [aiLoading, setAiLoading]           = useState(false);
    const [scheduleMode, setScheduleMode]     = useState(false);
    const [scheduledDate, setScheduledDate]   = useState('');
    const [scheduledTime, setScheduledTime]   = useState('');
    const [publishing, setPublishing]         = useState(false);

    const loadAccounts = useCallback(async (): Promise<void> => {
        try {
            const { data } = await api.get<SocialAccount[]>('/social/accounts');
            setConnectedAccounts(data);
        } catch {
            // no connected accounts is fine
        }
    }, []);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const togglePlatform = (platform: Platform): void => {
        setSelectedPlatforms((prev) =>
            prev.includes(platform)
                ? prev.filter((p) => p !== platform)
                : [...prev, platform]
        );
    };

    const handleGenerateAI = async (): Promise<void> => {
        if (!aiTopic.trim()) {
            Alert.alert('Error', 'Please enter a topic for AI generation.');
            return;
        }
        setAiLoading(true);
        try {
            const platform = selectedPlatforms[0] ?? 'twitter';
            const { data } = await api.post<AiResult>('/ai/generate', {
                topic: aiTopic.trim(),
                platform,
                tone: 'professional',
                length: 'medium',
                includeHashtags: true,
                includeEmojis: false,
                language: 'en',
            });
            setContent(data.content);
            setShowAi(false);
            setAiTopic('');
            Toast.show({ type: 'success', text1: 'AI content generated!' });
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'AI generation failed.';
            Alert.alert('AI Error', msg);
        } finally {
            setAiLoading(false);
        }
    };

    const handlePublish = async (draft = false): Promise<void> => {
        if (!content.trim()) {
            Alert.alert('Error', 'Please write some content.');
            return;
        }
        if (selectedPlatforms.length === 0) {
            Alert.alert('Error', 'Please select at least one platform.');
            return;
        }

        let scheduledAt: string | undefined;
        if (scheduleMode && !draft) {
            if (!scheduledDate.trim() || !scheduledTime.trim()) {
                Alert.alert('Error', 'Please enter a scheduled date and time (YYYY-MM-DD and HH:MM).');
                return;
            }
            const iso = `${scheduledDate.trim()}T${scheduledTime.trim()}:00`;
            if (isNaN(Date.parse(iso))) {
                Alert.alert('Error', 'Invalid date/time format. Use YYYY-MM-DD and HH:MM.');
                return;
            }
            scheduledAt = iso;
        }

        setPublishing(true);
        try {
            const body: Record<string, unknown> = {
                content: content.trim(),
                platforms: selectedPlatforms,
                status: draft ? 'draft' : scheduledAt ? 'scheduled' : 'draft',
            };
            if (scheduledAt) body.scheduledAt = scheduledAt;

            await api.post('/posts', body);

            const label = draft ? 'Saved as draft' : scheduledAt ? 'Post scheduled!' : 'Post saved!';
            Toast.show({ type: 'success', text1: label });

            if (!draft) {
                setContent('');
                setSelectedPlatforms([]);
                setScheduledDate('');
                setScheduledTime('');
                setScheduleMode(false);
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to save post.';
            Alert.alert('Error', msg);
        } finally {
            setPublishing(false);
        }
    };

    const charLimit: Record<Platform, number> = {
        twitter: 280, instagram: 2200, linkedin: 3000, facebook: 63206,
    };
    const activeLimit = selectedPlatforms.length > 0
        ? Math.min(...selectedPlatforms.map((p) => charLimit[p]))
        : 280;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.pageTitle}>Content Studio</Text>

                {/* Platform selector */}
                <Text style={styles.label}>Platforms</Text>
                <View style={styles.platformRow}>
                    {ALL_PLATFORMS.map((p) => {
                        const active = selectedPlatforms.includes(p);
                        const connected = connectedAccounts.some((a) => a.platform === p && a.isActive);
                        return (
                            <TouchableOpacity
                                key={p}
                                onPress={() => togglePlatform(p)}
                                style={[
                                    styles.platformBtn,
                                    active && { backgroundColor: PLATFORM_COLORS[p] },
                                    !connected && styles.platformBtnDisabled,
                                ]}
                            >
                                <Text style={styles.platformBtnEmoji}>{PLATFORM_EMOJI[p]}</Text>
                                <Text style={[styles.platformBtnText, active && styles.platformBtnTextActive]}>
                                    {p}
                                </Text>
                                {!connected && <Text style={styles.notConnected}>!</Text>}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {connectedAccounts.length === 0 && (
                    <Text style={styles.warningText}>⚠️ No connected accounts. Connect accounts in Settings.</Text>
                )}

                {/* AI Writer toggle */}
                <TouchableOpacity
                    style={styles.aiToggleBtn}
                    onPress={() => setShowAi((v) => !v)}
                >
                    <Text style={styles.aiToggleBtnText}>✨ {showAi ? 'Hide' : 'Use'} AI Writer</Text>
                </TouchableOpacity>

                {showAi && (
                    <View style={styles.aiPanel}>
                        <TextInput
                            style={styles.input}
                            placeholder="Topic or brief for AI (e.g. 'product launch tips')"
                            placeholderTextColor="#9CA3AF"
                            value={aiTopic}
                            onChangeText={setAiTopic}
                            multiline
                            numberOfLines={2}
                        />
                        <TouchableOpacity
                            style={[styles.aiGenerateBtn, aiLoading && styles.btnDisabled]}
                            onPress={handleGenerateAI}
                            disabled={aiLoading}
                        >
                            {aiLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.aiGenerateBtnText}>✨ Generate</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Content editor */}
                <Text style={styles.label}>Content</Text>
                <TextInput
                    style={styles.contentInput}
                    placeholder="Write your post here..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={content}
                    onChangeText={setContent}
                    maxLength={activeLimit}
                    textAlignVertical="top"
                />
                <Text style={styles.charCount}>{content.length} / {activeLimit}</Text>

                {/* Schedule toggle */}
                <View style={styles.scheduleToggleRow}>
                    <Text style={styles.label}>Schedule for later</Text>
                    <Switch
                        value={scheduleMode}
                        onValueChange={setScheduleMode}
                        trackColor={{ false: '#E5E7EB', true: '#7C3AED' }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {scheduleMode && (
                    <View style={styles.scheduleInputs}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="Date (YYYY-MM-DD)"
                            placeholderTextColor="#9CA3AF"
                            value={scheduledDate}
                            onChangeText={setScheduledDate}
                            keyboardType="numbers-and-punctuation"
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="Time (HH:MM)"
                            placeholderTextColor="#9CA3AF"
                            value={scheduledTime}
                            onChangeText={setScheduledTime}
                            keyboardType="numbers-and-punctuation"
                        />
                    </View>
                )}

                {/* Action buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.draftBtn, publishing && styles.btnDisabled]}
                        onPress={() => handlePublish(true)}
                        disabled={publishing}
                    >
                        <Text style={styles.draftBtnText}>Save Draft</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.publishBtn, publishing && styles.btnDisabled]}
                        onPress={() => handlePublish(false)}
                        disabled={publishing}
                    >
                        {publishing ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.publishBtnText}>
                                {scheduleMode ? '📅 Schedule' : '💾 Save Post'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scroll:    { paddingHorizontal: 20, paddingBottom: 40 },
    pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 20 },
    label:     { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },

    platformRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    platformBtn:  {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF',
    },
    platformBtnDisabled: { opacity: 0.5 },
    platformBtnEmoji: { fontSize: 14 },
    platformBtnText:  { fontSize: 13, color: '#374151', textTransform: 'capitalize' },
    platformBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
    notConnected: { fontSize: 12, color: '#F59E0B', fontWeight: '700', marginLeft: 2 },

    warningText: { fontSize: 12, color: '#F59E0B', marginTop: 6 },

    aiToggleBtn: {
        marginTop: 16,
        borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
        backgroundColor: '#F5F3FF',
    },
    aiToggleBtnText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
    aiPanel:         { marginTop: 10, gap: 8 },
    aiGenerateBtn:   {
        backgroundColor: '#7C3AED', borderRadius: 10,
        paddingVertical: 12, alignItems: 'center',
    },
    aiGenerateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    input: {
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, color: '#111827',
    },

    contentInput: {
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 12, padding: 14, fontSize: 15, color: '#111827',
        minHeight: 140, lineHeight: 22,
    },
    charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },

    scheduleToggleRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 16,
    },
    scheduleInputs: { flexDirection: 'row', gap: 10, marginTop: 8 },
    halfInput:      { flex: 1 },

    actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
    draftBtn: {
        flex: 1, borderWidth: 1, borderColor: '#7C3AED', borderRadius: 12,
        paddingVertical: 14, alignItems: 'center',
    },
    draftBtnText:   { color: '#7C3AED', fontWeight: '700', fontSize: 15 },
    publishBtn:     {
        flex: 2, backgroundColor: '#7C3AED', borderRadius: 12,
        paddingVertical: 14, alignItems: 'center',
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    publishBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    btnDisabled:    { opacity: 0.6 },
});
