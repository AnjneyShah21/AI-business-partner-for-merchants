import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
 const queryClient=useQueryClient(); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [conversationId,setConversationId]=useState<string|null>(null);
 const {control,handleSubmit,reset,formState}=useForm<z.infer<typeof assistantRequestSchema>>({resolver:zodResolver(assistantRequestSchema),defaultValues:{question:''}});
 useEffect(()=>{SecureStore.getItemAsync('conversation_id').then(setConversationId).catch(()=>{});},[]);
 const history=useQuery({queryKey:['conversation',conversationId],enabled:Boolean(conversationId),queryFn:()=>api<Array<{id:string;role:string;content:string;sources:string[]}>>(`/conversations/${conversationId}/messages`)});
 async function ask({question}:{question:string}){setBusy(true);setError('');try{
   let id=conversationId;
   if(!id){const conversation=await api<{id:string}>('/conversations',{method:'POST'});id=conversation.id;setConversationId(id);await SecureStore.setItemAsync('conversation_id',id);}
   await api<Answer>('/assistant/query',{method:'POST',body:JSON.stringify({question,conversation_id:id})});reset({question:''});await queryClient.invalidateQueries({queryKey:['conversation',id]});
  }catch(e){setError(e instanceof Error?e.message:'Could not reach the assistant.');}finally{setBusy(false);} }
 async function newConversation(){const row=await api<{id:string}>('/conversations',{method:'POST'});setConversationId(row.id);await SecureStore.setItemAsync('conversation_id',row.id);}
 return <Screen title="AI Assistant" subtitle={isDemoBuild ? 'Sample-data assistant · no live AI provider' : 'Answers grounded in connected merchant data'}>
 <Card title="Ask your business partner"><Controller control={control} name="question" render={({field:{onChange,onBlur,value}})=><TextInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="How much did I collect today?" multiline style={{minHeight:76,color:colors.ink,fontSize:16}}/>}/>
 {formState.errors.question?<Text style={{color:colors.red}}>{formState.errors.question.message}</Text>:null}
 <Pressable onPress={()=>void handleSubmit(ask)()} disabled={busy} style={{backgroundColor:colors.blue,borderRadius:12,padding:14,alignItems:'center'}}><Text style={{color:'white',fontWeight:'700'}}>{busy?'Checking records…':'Ask business partner'}</Text></Pressable></Card>
 {conversationId?<Pressable onPress={newConversation} style={{alignSelf:'flex-end',padding:8}}><Text style={{color:colors.blue,fontWeight:'600'}}>Start a new conversation</Text></Pressable>:null}
 {history.data?.map(message=><Card key={message.id} title={message.role==='assistant'?'Business partner':'You'}><Text style={{fontSize:15,lineHeight:22,color:colors.ink}}>{message.content}</Text>{message.sources.length?<Text style={{fontSize:12,color:colors.muted}}>Sources: {message.sources.join(', ')}</Text>:null}</Card>)}
 {busy?<ActivityIndicator color={colors.blue}/>:null}{error?<Card title="Unable to answer"><Text style={{color:colors.red}}>{error}</Text></Card>:null}
 </Screen>;
}
