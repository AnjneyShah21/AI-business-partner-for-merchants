import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
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
export default function Assistant() {
 const queryClient=useQueryClient(); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [voiceError,setVoiceError]=useState(''); const [listening,setListening]=useState(false); const [conversationId,setConversationId]=useState<string|null>(null);
 const {control,handleSubmit,reset,setValue,formState}=useForm<z.infer<typeof assistantRequestSchema>>({resolver:zodResolver(assistantRequestSchema),defaultValues:{question:''}});
 useSpeechRecognitionEvent('start',()=>{setListening(true);setVoiceError('');});
 useSpeechRecognitionEvent('end',()=>setListening(false));
 useSpeechRecognitionEvent('result',event=>{
   const transcript=event.results[0]?.transcript;
   if(transcript)setValue('question',transcript,{shouldDirty:true,shouldValidate:event.isFinal});
 });
 useSpeechRecognitionEvent('error',event=>{
   setListening(false);
   setVoiceError(event.error==='not-allowed'?'Microphone access was denied. Enable it in Android Settings to use voice input.':event.error==='service-not-allowed'?'No Android speech recognition service is available. Install or enable Speech Recognition & Synthesis in Android settings.':`Voice input stopped: ${event.message || event.error}.`);
 });
 useEffect(()=>{SecureStore.getItemAsync('conversation_id').then(setConversationId).catch(()=>{});},[]);
 useEffect(()=>()=>{Speech.stop();try{ExpoSpeechRecognitionModule.abort();}catch{}},[]);
 const history=useQuery({queryKey:['conversation',conversationId],enabled:Boolean(conversationId),queryFn:()=>api<Array<{id:string;role:string;content:string;sources:string[]}>>(`/conversations/${conversationId}/messages`)});
 async function ask({question}:{question:string}){setBusy(true);setError('');try{
   let id=conversationId;
   if(!id){const conversation=await api<{id:string}>('/conversations',{method:'POST'});id=conversation.id;setConversationId(id);await SecureStore.setItemAsync('conversation_id',id);}
   await api<Answer>('/assistant/query',{method:'POST',body:JSON.stringify({question,conversation_id:id})});reset({question:''});await queryClient.invalidateQueries({queryKey:['conversation',id]});
  }catch(e){setError(e instanceof Error?e.message:'Could not reach the assistant.');}finally{setBusy(false);} }
 async function newConversation(){const row=await api<{id:string}>('/conversations',{method:'POST'});setConversationId(row.id);await SecureStore.setItemAsync('conversation_id',row.id);}
 async function startVoice(){
   setVoiceError('');
   try{
     if(!ExpoSpeechRecognitionModule.isRecognitionAvailable()){
       setVoiceError('Speech recognition is unavailable on this device. Install or enable an Android speech recognition service.');return;
     }
     const permission=await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
     if(!permission.granted){setVoiceError('Microphone access is needed to transcribe a voice question.');return;}
     ExpoSpeechRecognitionModule.start({lang:'en-IN',interimResults:true,continuous:false,addsPunctuation:true});
   }catch(e){setVoiceError(e instanceof Error?e.message:'Could not start voice input.');}
 }
 return <Screen title="AI Assistant" subtitle={isDemoBuild ? 'Sample-data assistant · no live AI provider' : 'Answers grounded in connected merchant data'}>
 <Card title="Ask your business partner"><Controller control={control} name="question" render={({field:{onChange,onBlur,value}})=><TextInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="How much did I collect today?" multiline style={{minHeight:76,color:colors.ink,fontSize:16}}/>}/>
 <Pressable accessibilityRole="button" accessibilityLabel={listening?'Stop voice input':'Ask by voice'} onPress={()=>listening?ExpoSpeechRecognitionModule.stop():void startVoice()} style={{borderWidth:1,borderColor:colors.blue,borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:colors.blue,fontWeight:'700'}}>{listening?'Listening… tap to finish':'🎙 Ask by voice'}</Text></Pressable>
 <Text style={{fontSize:12,lineHeight:17,color:colors.muted}}>Your device speech service transcribes the recording. Check its privacy settings before speaking sensitive information.</Text>
 {voiceError?<Text accessibilityRole="alert" style={{color:colors.red,fontSize:13,lineHeight:19}}>{voiceError}</Text>:null}
 {formState.errors.question?<Text style={{color:colors.red}}>{formState.errors.question.message}</Text>:null}
 <Pressable onPress={()=>void handleSubmit(ask)()} disabled={busy} style={{backgroundColor:colors.blue,borderRadius:12,padding:14,alignItems:'center'}}><Text style={{color:'white',fontWeight:'700'}}>{busy?'Checking records…':'Ask business partner'}</Text></Pressable></Card>
 {conversationId?<Pressable onPress={newConversation} style={{alignSelf:'flex-end',padding:8}}><Text style={{color:colors.blue,fontWeight:'600'}}>Start a new conversation</Text></Pressable>:null}
 {history.data?.map(message=><Card key={message.id} title={message.role==='assistant'?'Business partner':'You'}><Text style={{fontSize:15,lineHeight:22,color:colors.ink}}>{message.content}</Text>{message.role==='assistant'?<Pressable accessibilityRole="button" accessibilityLabel="Read answer aloud" onPress={()=>Speech.speak(message.content,{language:'en-IN'})} style={{alignSelf:'flex-start',borderWidth:1,borderColor:colors.border,borderRadius:10,paddingHorizontal:12,paddingVertical:8}}><Text style={{color:colors.blue,fontWeight:'600'}}>🔊 Read answer aloud</Text></Pressable>:null}{message.sources.length?<Text style={{fontSize:12,color:colors.muted}}>Sources: {message.sources.join(', ')}</Text>:null}</Card>)}
 {busy?<ActivityIndicator color={colors.blue}/>:null}{error?<Card title="Unable to answer"><Text style={{color:colors.red}}>{error}</Text></Card>:null}
 </Screen>;
}
