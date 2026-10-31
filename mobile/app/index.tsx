import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import { enterDemoWorkspace, isDemoBuild } from '@/services/demo';
import { colors } from '@/theme/tokens';

export default function Index() {
  const [ready, setReady] = useState(false); const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('session_token').then(token => { setHasSession(Boolean(token)); setReady(true); }).catch(() => setReady(true)); }, []);
  if (!ready) return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator color={colors.blue}/></View>;
  if (hasSession) return <Redirect href="/(tabs)/home"/>;
  async function googleSignIn() {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) { setError('Google sign-in needs the Google Web OAuth client ID in mobile/.env and GOOGLE_OAUTH_CLIENT_ID in the backend environment.'); return; }
    setBusy(true); setError('');
    try {
      GoogleSignin.configure({webClientId});
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      if (!response.data.idToken) throw new Error('Google did not return an identity token. Check the Web OAuth client ID and Android SHA-1 configuration.');
      const session = await api<{access_token: string}>('/auth/google', {method: 'POST', body: JSON.stringify({id_token: response.data.idToken})});
      await SecureStore.setItemAsync('session_token', session.access_token);
      setHasSession(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in could not be completed.');
    } finally { setBusy(false); }
  }
  async function openDemo() { setBusy(true); setError(''); try { await enterDemoWorkspace(); setHasSession(true); } catch (e) { setError(e instanceof Error?e.message:'Could not open the sample workspace.'); } finally { setBusy(false); } }
  return <View style={{flex:1,backgroundColor:colors.bg,justifyContent:'center',padding:24,gap:18}}>
    <Text style={{fontSize:30,fontWeight:'700',color:colors.navy}}>Business Partner</Text>
    <Text style={{fontSize:15,color:colors.muted,lineHeight:22}}>Sign in securely with Google to open your merchant workspace.</Text>
    <Pressable disabled={busy} onPress={googleSignIn} accessibilityRole="button" style={{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:colors.border,padding:16,borderRadius:12,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:10}}>
      {busy ? <ActivityIndicator color={colors.blue}/> : <Text style={{fontSize:18,fontWeight:'800',color:colors.blue}}>G</Text>}
      <Text style={{color:colors.navy,fontWeight:'700'}}>{busy?'Signing in…':'Continue with Google'}</Text>
    </Pressable>
    {!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ? <Text style={{fontSize:12,color:colors.muted,lineHeight:18}}>Google OAuth needs a Web client ID and the Android app fingerprint configured in Google Cloud.</Text> : null}
    <View style={{height:1,backgroundColor:colors.border,marginVertical:3}}/>
    <Text style={{fontSize:13,fontWeight:'700',color:colors.amber}}>{isDemoBuild ? 'OFFLINE SAMPLE WORKSPACE' : 'PRESENTATION DATA'}</Text>
    <Text style={{fontSize:13,color:colors.muted,lineHeight:19}}>Open the bundled fictional CSV workspace to explore the app without Paytm access. It stays offline; no payments or messages are sent.</Text>
    <Pressable disabled={busy} onPress={openDemo} style={{backgroundColor:colors.blue,padding:16,borderRadius:12,alignItems:'center'}}><Text style={{color:'white',fontWeight:'700'}}>{busy?'Opening…':isDemoBuild?'Explore sample workspace':'Open presentation sample'}</Text></Pressable>
    {error?<Text style={{color:colors.red}}>{error}</Text>:null}
  </View>;
}
