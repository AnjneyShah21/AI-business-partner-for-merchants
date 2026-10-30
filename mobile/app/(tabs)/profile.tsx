import { Card, Note, Screen } from '@/components/Screen';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/theme/tokens';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { isDemoBuild } from '@/services/demo';
type Capability = {key:string;purpose:string;status:string;prerequisite:string};
export default function Profile(){async function signOut(){await SecureStore.deleteItemAsync('session_token');await SecureStore.deleteItemAsync('conversation_id');router.replace('/');}return <Screen title="Profile" subtitle="Merchant workspace and security">
 <Card title="Merchant account"><Note>{isDemoBuild ? 'You are exploring an offline sample shop. No merchant account is signed in and no Paytm data is connected.' : 'Sign-in and organization selection will activate after the authorized OTP identity provider is configured.'}</Note></Card>
 <Card title="Privacy and security"><Note>{isDemoBuild ? 'This preview works offline with fictional records. No credentials, financial records, payments, or customer messages are sent.' : 'Merchant financial data is loaded only from authenticated backend APIs. Provider credentials are never stored in this app.'}</Note></Card>
 <Card title="Language & accessibility"><Note>English interface is currently available. Voice and additional languages require configured speech providers.</Note></Card>
 <ProviderStatus/>
 <Pressable onPress={signOut} style={{padding:14,borderRadius:12,borderWidth:1,borderColor:colors.border,alignItems:'center'}}><Text style={{fontWeight:'600',color:colors.ink}}>Sign out</Text></Pressable>
 </Screen>}

function ProviderStatus(){
 const query=useQuery({queryKey:['integrations'],queryFn:()=>api<Capability[]>('/integrations/status')});
 return <Card title="CONNECTED SERVICES">{query.isLoading?<Note>Loading service status…</Note>:query.isError?<Note>{query.error.message}</Note>:query.data?.map(item=><Text key={item.key} style={{fontSize:12,color:colors.ink,lineHeight:18}}>{item.purpose}: {item.status.replaceAll('_',' ')}. {item.status==='not_configured'||item.status==='disabled'?item.prerequisite:''}</Text>)}</Card>;
}
