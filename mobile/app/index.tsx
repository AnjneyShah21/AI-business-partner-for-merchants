import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { establishLocalWorkspace } from '@/services/api';
import { colors } from '@/theme/tokens';

export default function Index() {
  const [ready, setReady] = useState(false); const [hasSession, setHasSession] = useState(false);
  const [merchant, setMerchant] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('session_token').then(token => { setHasSession(Boolean(token)); setReady(true); }).catch(() => setReady(true)); }, []);
  if (!ready) return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator color={colors.blue}/></View>;
  if (hasSession) return <Redirect href="/(tabs)/home"/>;
  async function create() { setBusy(true); setError(''); try { await establishLocalWorkspace(merchant.trim()); setHasSession(true); } catch (e) { setError(e instanceof Error?e.message:'Could not connect to the service.'); } finally { setBusy(false); } }
  const local = process.env.EXPO_PUBLIC_LOCAL_BOOTSTRAP === 'true';
  return <View style={{flex:1,backgroundColor:colors.bg,justifyContent:'center',padding:24,gap:18}}>
    <Text style={{fontSize:30,fontWeight:'700',color:colors.navy}}>Business Partner</Text>
    <Text style={{fontSize:15,color:colors.muted,lineHeight:22}}>Secure business insights from your connected merchant data.</Text>
    {local ? <><Text style={{fontSize:12,fontWeight:'700',color:colors.amber}}>LOCAL DEVELOPMENT WORKSPACE</Text>
      <TextInput value={merchant} onChangeText={setMerchant} placeholder="Business name" style={{backgroundColor:'white',borderWidth:1,borderColor:colors.border,padding:15,borderRadius:12}}/>
      <Pressable disabled={busy||merchant.trim().length<2} onPress={create} style={{backgroundColor:colors.blue,padding:16,borderRadius:12,alignItems:'center'}}><Text style={{color:'white',fontWeight:'700'}}>{busy?'Setting up…':'Create local workspace'}</Text></Pressable></>
      : <Text style={{fontSize:14,color:colors.muted,lineHeight:22}}>Merchant sign-in is unavailable until the authorized OTP identity provider is configured. This application does not accept a production password or create a demo account.</Text>}
    {error?<Text style={{color:colors.red}}>{error}</Text>:null}
  </View>;
}
