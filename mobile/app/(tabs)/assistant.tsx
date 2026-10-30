import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Note, Screen } from '@/components/Screen';
import { api, ElevenLabsVoiceList, requestElevenLabsSpeech } from '@/services/api';
import type { components } from '@/api/schema.generated';
import { colors } from '@/theme/tokens';
import { assistantRequestSchema } from '@/utils/validation';
import { isDemoBuild } from '@/services/demo';

type Answer = components['schemas']['AssistantResponse'];
type ChatMessage = {id: string; role: string; content: string; sources: string[]};
const englishQuestions = ["How much did I collect today?", 'What settlements are pending?', 'Which products need reordering?'];
const hindiQuestions = ['आज कितना कलेक्शन हुआ?', 'कितने सेटलमेंट लंबित हैं?', 'किन चीज़ों का स्टॉक कम है?'];

export default function Assistant() {
  const params = useLocalSearchParams<{question?: string; autostart?: string}>();
  const queryClient = useQueryClient();
  const audioPlayer = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const audioFile = useRef<File | null>(null);
  const pendingPlaybackFallback = useRef<{text: string; messageId: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [speechLanguage, setSpeechLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const voiceSubmitPending = useRef(false);
  const routeHandled = useRef(false);
  const {control, handleSubmit, reset, setValue, formState} = useForm<z.infer<typeof assistantRequestSchema>>({
    resolver: zodResolver(assistantRequestSchema), defaultValues: {question: ''},
  });

  useSpeechRecognitionEvent('start', () => { setListening(true); setVoiceError(''); });
  useSpeechRecognitionEvent('end', () => { setListening(false); voiceSubmitPending.current = false; });
  useSpeechRecognitionEvent('result', event => {
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setValue('question', transcript, {shouldDirty: true, shouldValidate: event.isFinal});
    if (event.isFinal && !voiceSubmitPending.current) {
      voiceSubmitPending.current = true;
      void submitQuestion(transcript);
    }
  });
  useSpeechRecognitionEvent('error', event => {
    setListening(false);
    voiceSubmitPending.current = false;
    setVoiceError(event.error === 'not-allowed'
      ? 'Microphone access was denied. Enable it in Android Settings to use voice input.'
      : event.error === 'service-not-allowed'
        ? 'No Android speech recognition service is available. Enable Speech Recognition & Synthesis in Android settings.'
        : `Voice input stopped: ${event.message || event.error}.`);
  });

  useEffect(() => { SecureStore.getItemAsync('conversation_id').then(setConversationId).catch(() => {}); }, []);
  useEffect(() => {
    SecureStore.getItemAsync('assistant_language').then(value => {
      if (value === 'hi-IN') setSpeechLanguage('hi-IN');
    }).catch(() => {});
  }, []);
  useEffect(() => { SecureStore.getItemAsync('elevenlabs_voice_id').then(value => { if (value) setVoiceId(value); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!routeHandled.current && params.question) {
      routeHandled.current = true;
      setValue('question', params.question, {shouldDirty: true, shouldValidate: true});
      void submitQuestion(params.question);
    } else if (!routeHandled.current && params.autostart === 'true') {
      routeHandled.current = true;
      const timer = setTimeout(() => void startVoice(), 450);
      return () => clearTimeout(timer);
    }
  }, [params.autostart, params.question, setValue]);
  useEffect(() => () => {
    Speech.stop();
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* Native service may already be stopped. */ }
    try { audioPlayer.pause(); audioPlayer.replace(null); } catch { /* Player may already be released. */ }
    try { audioFile.current?.delete(); } catch { /* Cache cleanup is best effort. */ }
  }, [audioPlayer]);
  useEffect(() => {
    if (audioStatus.didJustFinish) {
      setSpeakingMessageId(null);
      pendingPlaybackFallback.current = null;
      try { audioFile.current?.delete(); } catch { /* Cache cleanup is best effort. */ }
      audioFile.current = null;
    }
    if (audioStatus.error && pendingPlaybackFallback.current) {
      const pending = pendingPlaybackFallback.current;
      pendingPlaybackFallback.current = null;
      void speakOnDevice(pending.text, pending.messageId, 'ElevenLabs audio could not be played. Using the installed device voice.');
    }
  }, [audioStatus.didJustFinish, audioStatus.error]);

  const voices = useQuery({queryKey: ['elevenlabs-voices'], queryFn: () => api<ElevenLabsVoiceList>('/assistant/voices'), enabled: !isDemoBuild, retry: false, staleTime: 300_000});
  useEffect(() => {
    if (!voiceId && voices.data?.default_voice_id) setVoiceId(voices.data.default_voice_id);
    else if (voiceId && voices.data && !voices.data.voices.some(voice => voice.voice_id === voiceId)) {
      setVoiceId(voices.data.default_voice_id);
    }
  }, [voiceId, voices.data]);
  const history = useQuery({queryKey: ['conversation', conversationId], enabled: Boolean(conversationId), queryFn: () => api<ChatMessage[]>(`/conversations/${conversationId}/messages`)});

  function cleanupAudio() {
    try { audioPlayer.pause(); audioPlayer.replace(null); } catch { /* Player may not have loaded a clip yet. */ }
    try { audioFile.current?.delete(); } catch { /* Cache cleanup is best effort. */ }
    audioFile.current = null;
    setSpeakingMessageId(null);
  }

  async function speakOnDevice(text: string, messageId: string, reason?: string) {
    if (reason) setVoiceError(reason);
    cleanupAudio();
    const language = /[\u0900-\u097f]/i.test(text) ? 'hi-IN' : 'en-IN';
    const available = await Speech.getAvailableVoicesAsync().catch(() => []);
    const localVoice = available.find(voice => voice.language.toLowerCase() === language.toLowerCase() && /embedded|local|offline/i.test(voice.identifier));
    setSpeakingMessageId(messageId);
    Speech.speak(text, {
      language: localVoice?.language ?? language, ...(localVoice ? {voice: localVoice.identifier} : {}), rate: 0.94, pitch: 1, volume: 1,
      onDone: () => setSpeakingMessageId(null), onStopped: () => setSpeakingMessageId(null),
      onError: () => { setSpeakingMessageId(null); setVoiceError('Android could not play the fallback voice. Check the installed speech service and media volume.'); },
    });
  }

  async function speakAnswer(text: string, messageId: string) {
    setVoiceError('');
    setSpeechLoading(true);
    Speech.stop();
    try {
      if (isDemoBuild) throw new Error('ElevenLabs is available after the app is connected to a signed-in backend.');
      const bytes = await requestElevenLabsSpeech(text.slice(0, 2500), voiceId);
      await setAudioModeAsync({playsInSilentMode: true});
      cleanupAudio();
      const file = new File(Paths.cache, `business-partner-${Date.now()}.mp3`);
      file.create({intermediates: true, overwrite: true});
      await file.write(bytes);
      audioFile.current = file;
      pendingPlaybackFallback.current = {text, messageId};
      audioPlayer.replace({uri: file.uri});
      setSpeakingMessageId(messageId);
      audioPlayer.play();
    } catch (e) {
      pendingPlaybackFallback.current = null;
      const detail = e instanceof Error ? e.message : 'ElevenLabs speech could not be played.';
      if (/[\u0900-\u097f]/i.test(text)) {
        await speakOnDevice(text, messageId, isDemoBuild ? 'Offline preview uses the installed Hindi voice. Configure the backend to enable ElevenLabs.' : 'ElevenLabs is unavailable. Using the installed Hindi voice for this reply.');
        return;
      }
      setVoiceError(isDemoBuild ? 'Offline preview uses the installed Android voice. Configure the backend to enable ElevenLabs.' : `${detail} Using the installed device voice for this reply.`);
      cleanupAudio();
      const available = await Speech.getAvailableVoicesAsync().catch(() => []);
      const localEnglish = available.find(voice => voice.language.toLowerCase().startsWith('en') && /embedded|local|offline/i.test(voice.identifier));
      setSpeakingMessageId(messageId);
      Speech.speak(text, {
        language: localEnglish?.language ?? 'en-US', ...(localEnglish ? {voice: localEnglish.identifier} : {}), rate: 0.94, pitch: 1, volume: 1,
        onDone: () => setSpeakingMessageId(null), onStopped: () => setSpeakingMessageId(null),
        onError: () => { setSpeakingMessageId(null); setVoiceError(`${detail} Android could not play its fallback voice either.`); },
      });
    } finally {
      setSpeechLoading(false);
    }
  }

  function stopSpeech() { Speech.stop(); pendingPlaybackFallback.current = null; cleanupAudio(); }

  async function submitQuestion(question: string) {
    const parsed = assistantRequestSchema.safeParse({question});
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Enter a question first.'); return; }
    setBusy(true); setError('');
    try {
      let id = conversationId;
      if (!id) {
        const conversation = await api<{id: string}>('/conversations', {method: 'POST'});
        id = conversation.id; setConversationId(id); await SecureStore.setItemAsync('conversation_id', id);
      }
      const answer = await api<Answer>('/assistant/query', {method: 'POST', body: JSON.stringify({
        question: parsed.data.question,
        conversation_id: id,
        response_language: speechLanguage === 'hi-IN' ? 'hi' : 'en',
      })});
      reset({question: ''});
      await queryClient.invalidateQueries({queryKey: ['conversation', id]});
      if (voiceReplies) void speakAnswer(answer.answer, `latest-${Date.now()}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach the assistant.'); }
    finally { setBusy(false); }
  }

  async function newConversation() {
    try {
      stopSpeech();
      const row = await api<{id: string}>('/conversations', {method: 'POST'});
      setConversationId(row.id); await SecureStore.setItemAsync('conversation_id', row.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start a new conversation.'); }
  }

  async function startVoice() {
    setVoiceError('');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setVoiceError('Speech recognition is unavailable. Enable an Android speech recognition service.'); return; }
      const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      if (!permission.granted) { setVoiceError('Microphone access is needed to transcribe a voice question.'); return; }
      stopSpeech();
      ExpoSpeechRecognitionModule.start({lang: speechLanguage, interimResults: true, continuous: false, addsPunctuation: true});
    } catch (e) { setVoiceError(e instanceof Error ? e.message : 'Could not start voice input.'); }
  }

  const activeVoice = voices.data?.voices.find(voice => voice.voice_id === voiceId);
  return <Screen title="AI Business Partner" subtitle="Ask about your business by voice or text">
    <Pressable onPress={() => router.back()} accessibilityRole="button" style={{alignSelf: 'flex-start', paddingVertical: 5}}><Text style={{fontSize: 13, fontWeight: '700', color: colors.blue}}>← Back to dashboard</Text></Pressable>
    <View style={{backgroundColor: '#EAF4FF', borderColor: '#D6E8FB', borderWidth: 1, borderRadius: 18, padding: 15, gap: 6}}>
      <Text style={{fontSize: 12, fontWeight: '800', color: colors.blue}}>VOICE REPLIES · {speechLoading ? 'PREPARING AUDIO…' : isDemoBuild ? 'DEVICE VOICE' : activeVoice?.name ?? 'ELEVENLABS'}</Text>
      <Text style={{fontSize: 12, lineHeight: 18, color: colors.muted}}>{isDemoBuild ? 'This offline sample uses Android text-to-speech. Connect the backend to select an ElevenLabs voice.' : voices.isError ? 'ElevenLabs voice choices are unavailable. Check the backend setup and restart the API.' : 'Replies can be spoken with an ElevenLabs voice. Your API key stays on the backend.'}</Text>
    </View>

    {!isDemoBuild && voices.data?.voices.length ? <View style={{gap: 8}}>
      <Text style={{fontSize: 13, fontWeight: '700', color: colors.navy}}>Choose an ElevenLabs voice</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>{voices.data.voices.slice(0, 12).map(voice => <Pressable key={voice.voice_id} onPress={() => { setVoiceId(voice.voice_id); void SecureStore.setItemAsync('elevenlabs_voice_id', voice.voice_id); }} style={{borderRadius: 18, borderWidth: 1, borderColor: voiceId === voice.voice_id ? colors.blue : colors.border, backgroundColor: voiceId === voice.voice_id ? '#EAF4FF' : colors.card, paddingHorizontal: 13, paddingVertical: 9}}><Text style={{fontSize: 12, fontWeight: '700', color: voiceId === voice.voice_id ? colors.blue : colors.navy}}>{voice.name}</Text></Pressable>)}</ScrollView>
    </View> : null}

    <View style={{alignItems: 'center', paddingVertical: 5}}>
      <Pressable onPress={() => listening ? ExpoSpeechRecognitionModule.stop() : void startVoice()} accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Ask your business partner by voice'} style={{width: 108, height: 108, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: listening ? '#B83232' : colors.blue, borderWidth: 5, borderColor: listening ? '#FADDDD' : '#C2EFFF', elevation: 4}}>
        <Text style={{fontSize: 35, color: '#FFFFFF'}}>{listening ? '■' : '🎙'}</Text>
      </Pressable>
      <Text style={{fontSize: 16, fontWeight: '800', color: colors.navy, marginTop: 10}}>{listening ? 'Listening…' : 'Tap to speak'}</Text>
      <Text style={{fontSize: 12, color: colors.muted, marginTop: 4}}>Voice input and replies support English and Hindi.</Text>
      <View style={{flexDirection: 'row', gap: 8, marginTop: 10}}>{[{label: 'English', value: 'en-IN' as const}, {label: 'हिन्दी', value: 'hi-IN' as const}].map(option => <Pressable key={option.value} onPress={() => { setSpeechLanguage(option.value); void SecureStore.setItemAsync('assistant_language', option.value); }} style={{paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: speechLanguage === option.value ? '#EAF4FF' : colors.card, borderWidth: 1, borderColor: speechLanguage === option.value ? colors.blue : colors.border}}><Text style={{fontSize: 11, fontWeight: '700', color: speechLanguage === option.value ? colors.blue : colors.muted}}>{option.label}</Text></Pressable>)}</View>
    </View>

    <Card title="Ask a question">
      <Controller control={control} name="question" render={({field: {onChange, onBlur, value}}) => <TextInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="How much did I collect today?" multiline accessibilityLabel="Your business question" placeholderTextColor="#8290A5" style={{minHeight: 75, color: colors.ink, fontSize: 15, textAlignVertical: 'top'}} />} />
      {formState.errors.question ? <Text style={{color: colors.red, fontSize: 12}}>{formState.errors.question.message}</Text> : null}
      <Pressable onPress={() => void handleSubmit(({question}) => submitQuestion(question))()} disabled={busy} style={{alignItems: 'center', padding: 13, borderRadius: 12, backgroundColor: colors.blue}}><Text style={{color: '#FFFFFF', fontWeight: '700'}}>{busy ? 'Thinking…' : 'Ask business partner'}</Text></Pressable>
      <Pressable onPress={() => { setVoiceReplies(value => !value); if (voiceReplies) stopSpeech(); }} accessibilityRole="button" style={{alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 11}}><Text style={{color: colors.navy, fontWeight: '700'}}>🔊 Spoken replies {voiceReplies ? 'on' : 'off'}</Text></Pressable>
      <Text style={{fontSize: 11, lineHeight: 16, color: colors.muted}}>Speech recognition runs through Android. When selected, reply text is sent to ElevenLabs to make the audio; your key stays on the backend.</Text>
    </Card>

    {voiceError ? <Text accessibilityRole="alert" style={{fontSize: 12, lineHeight: 18, color: colors.amber}}>{voiceError}</Text> : null}
    {error ? <Card title="Unable to answer"><Text style={{color: colors.red}}>{error}</Text></Card> : null}
    {history.data?.length ? <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}><Text style={{fontSize: 17, fontWeight: '800', color: colors.navy}}>Conversation</Text><Pressable onPress={() => void newConversation()}><Text style={{fontSize: 12, fontWeight: '700', color: colors.blue}}>New chat</Text></Pressable></View> : null}
    {history.data?.map(message => <Card key={message.id} title={message.role === 'assistant' ? 'Business partner' : 'You'}>
      <Text style={{fontSize: 14, lineHeight: 21, color: colors.ink}}>{message.content}</Text>
      {message.role === 'assistant' ? <Pressable onPress={() => message.id === speakingMessageId ? stopSpeech() : void speakAnswer(message.content, message.id)} style={{alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8}}><Text style={{fontSize: 12, color: colors.blue, fontWeight: '700'}}>{message.id === speakingMessageId ? 'Stop speaking' : '🔊 Play reply'}</Text></Pressable> : null}
      {message.sources?.length ? <Text style={{fontSize: 10, color: colors.muted}}>Sources: {message.sources.join(', ')}</Text> : null}
    </Card>)}
    {busy ? <ActivityIndicator color={colors.blue} /> : null}
    <Text style={{fontSize: 11, lineHeight: 17, color: colors.muted}}>Try asking</Text>
    <View style={{gap: 7}}>{(speechLanguage === 'hi-IN' ? hindiQuestions : englishQuestions).map(question => <Pressable key={question} onPress={() => { setValue('question', question, {shouldDirty: true}); void submitQuestion(question); }} style={{borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 10}}><Text style={{fontSize: 12, color: colors.navy}}>✦  {question}</Text></Pressable>)}</View>
  </Screen>;
}
