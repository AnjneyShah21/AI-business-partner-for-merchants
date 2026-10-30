import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Screen } from '@/components/Screen';
import { api } from '@/services/api';
import type { components } from '@/api/schema.generated';
import { colors } from '@/theme/tokens';
import { assistantRequestSchema } from '@/utils/validation';
import { isDemoBuild } from '@/services/demo';

type Answer = components['schemas']['AssistantResponse'];
type ChatMessage = { id: string; role: string; content: string; sources: string[] };

export default function Assistant() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const voiceSubmitPending = useRef(false);
  const { control, handleSubmit, reset, setValue, formState } = useForm<z.infer<typeof assistantRequestSchema>>({
    resolver: zodResolver(assistantRequestSchema),
    defaultValues: { question: '' },
  });

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setVoiceError('');
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    voiceSubmitPending.current = false;
  });
  useSpeechRecognitionEvent('result', event => {
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setValue('question', transcript, { shouldDirty: true, shouldValidate: event.isFinal });
    if (event.isFinal && !voiceSubmitPending.current) {
      voiceSubmitPending.current = true;
      void submitQuestion(transcript);
    }
  });
  useSpeechRecognitionEvent('error', event => {
    setListening(false);
    voiceSubmitPending.current = false;
    setVoiceError(
      event.error === 'not-allowed'
        ? 'Microphone access was denied. Enable it in Android Settings to use voice input.'
        : event.error === 'service-not-allowed'
          ? 'No Android speech recognition service is available. Install or enable Speech Recognition & Synthesis in Android settings.'
          : `Voice input stopped: ${event.message || event.error}.`,
    );
  });

  useEffect(() => {
    SecureStore.getItemAsync('conversation_id').then(setConversationId).catch(() => {});
  }, []);
  useEffect(() => () => {
    Speech.stop();
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* Native service may already be stopped. */ }
  }, []);

  const history = useQuery({
    queryKey: ['conversation', conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => api<ChatMessage[]>(`/conversations/${conversationId}/messages`),
  });

  function stopSpeech() {
    Speech.stop();
    setSpeakingMessageId(null);
  }

  async function speakAnswer(text: string, messageId: string) {
    setVoiceError('');
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const localEnglishVoice = voices.find(voice =>
        voice.language.toLowerCase().startsWith('en') && /embedded|local|offline/i.test(voice.identifier),
      );
      Speech.stop();
      setSpeakingMessageId(messageId);
      Speech.speak(text, {
        language: localEnglishVoice?.language ?? 'en-US',
        ...(localEnglishVoice ? { voice: localEnglishVoice.identifier } : {}),
        rate: 0.94,
        pitch: 1,
        volume: 1,
        onStart: () => setSpeakingMessageId(messageId),
        onDone: () => setSpeakingMessageId(null),
        onStopped: () => setSpeakingMessageId(null),
        onError: () => {
          setSpeakingMessageId(null);
          setVoiceError('Android could not speak this reply. Check that a text-to-speech voice is installed and media volume is up.');
        },
      });
    } catch {
      setSpeakingMessageId(null);
      setVoiceError('Android text-to-speech is unavailable. Check the installed speech engine in Android Settings.');
    }
  }

  async function submitQuestion(question: string) {
    const parsed = assistantRequestSchema.safeParse({ question });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a question first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      let id = conversationId;
      if (!id) {
        const conversation = await api<{ id: string }>('/conversations', { method: 'POST' });
        id = conversation.id;
        setConversationId(id);
        await SecureStore.setItemAsync('conversation_id', id);
      }
      const answer = await api<Answer>('/assistant/query', {
        method: 'POST',
        body: JSON.stringify({ question: parsed.data.question, conversation_id: id }),
      });
      reset({ question: '' });
      await queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      if (voiceReplies) {
        const messages = queryClient.getQueryData<ChatMessage[]>(['conversation', id]);
        const assistantMessage = messages?.findLast(message => message.role === 'assistant');
        void speakAnswer(answer.answer, assistantMessage?.id ?? `latest-${Date.now()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  }

  async function newConversation() {
    try {
      const row = await api<{ id: string }>('/conversations', { method: 'POST' });
      setConversationId(row.id);
      await SecureStore.setItemAsync('conversation_id', row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a new conversation.');
    }
  }

  async function startVoice() {
    setVoiceError('');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setVoiceError('Speech recognition is unavailable on this device. Install or enable an Android speech recognition service.');
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      if (!permission.granted) {
        setVoiceError('Microphone access is needed to transcribe a voice question.');
        return;
      }
      Speech.stop();
      ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: false, addsPunctuation: true });
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'Could not start voice input.');
    }
  }

  return (
    <Screen
      title="AI Assistant"
      subtitle={isDemoBuild ? 'Offline sample-data assistant · no live AI provider' : 'Answers grounded in connected merchant data'}
    >
      <Card title="Ask your business partner">
        <Controller
          control={control}
          name="question"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="How much did I collect today?"
              multiline
              accessibilityLabel="Your business question"
              style={{ minHeight: 76, color: colors.ink, fontSize: 16 }}
            />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop voice input' : 'Ask by voice'}
          onPress={() => listening ? ExpoSpeechRecognitionModule.stop() : void startVoice()}
          style={{ borderWidth: 1, borderColor: colors.blue, borderRadius: 12, padding: 12, alignItems: 'center' }}
        >
          <Text style={{ color: colors.blue, fontWeight: '700' }}>{listening ? 'Listening… tap to finish' : '🎙 Ask by voice'}</Text>
        </Pressable>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>
          Voice questions are transcribed by your Android speech service. A final transcript is sent automatically.
        </Text>
        {voiceError ? <Text accessibilityRole="alert" style={{ color: colors.red, fontSize: 13, lineHeight: 19 }}>{voiceError}</Text> : null}
        {formState.errors.question ? <Text style={{ color: colors.red }}>{formState.errors.question.message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: voiceReplies }}
          onPress={() => {
            setVoiceReplies(value => !value);
            if (voiceReplies) stopSpeech();
          }}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 11, alignItems: 'center' }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>🔊 Voice replies {voiceReplies ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleSubmit(({ question }) => submitQuestion(question))()}
          disabled={busy}
          style={{ backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center' }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>{busy ? 'Checking records…' : 'Ask business partner'}</Text>
        </Pressable>
      </Card>

      {conversationId ? (
        <Pressable onPress={() => void newConversation()} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Text style={{ color: colors.blue, fontWeight: '600' }}>Start a new conversation</Text>
        </Pressable>
      ) : null}
      {history.data?.map(message => (
        <Card key={message.id} title={message.role === 'assistant' ? 'Business partner' : 'You'}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.ink }}>{message.content}</Text>
          {message.role === 'assistant' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={message.id === speakingMessageId ? 'Stop reading answer aloud' : 'Read answer aloud'}
              onPress={() => message.id === speakingMessageId ? stopSpeech() : void speakAnswer(message.content, message.id)}
              style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
            >
              <Text style={{ color: colors.blue, fontWeight: '600' }}>{message.id === speakingMessageId ? '⏹ Stop speaking' : '🔊 Read answer aloud'}</Text>
            </Pressable>
          ) : null}
          {message.sources.length ? <Text style={{ fontSize: 12, color: colors.muted }}>Sources: {message.sources.join(', ')}</Text> : null}
        </Card>
      ))}
      {busy ? <ActivityIndicator color={colors.blue} /> : null}
      {error ? <Card title="Unable to answer"><Text style={{ color: colors.red }}>{error}</Text></Card> : null}
    </Screen>
  );
}
