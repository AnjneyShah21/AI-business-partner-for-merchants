import { Stack, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import '@/i18n';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function RootLayout() {
  return <SafeAreaProvider><QueryClientProvider client={client}><StatusBar style="auto" /><SessionGate><Stack screenOptions={{ headerShown: false }} /></SessionGate></QueryClientProvider></SafeAreaProvider>;
}

function SessionGate({children}:PropsWithChildren){
 const pathname=usePathname();const router=useRouter();const [checkedPath,setCheckedPath]=useState<string|null>(null);
 useEffect(()=>{let active=true;void SecureStore.getItemAsync('session_token').then(token=>{
  if(!active)return;
  if(pathname!=='/'&&!token)router.replace('/');
  else if(pathname==='/'&&token)router.replace('/(tabs)/home');
  setCheckedPath(pathname);
 }).catch(()=>{if(active){if(pathname!=='/')router.replace('/');setCheckedPath(pathname);}});
 return()=>{active=false;};},[pathname,router]);
 if(checkedPath!==pathname)return <View style={{flex:1,justifyContent:'center',backgroundColor:colors.bg}}><ActivityIndicator color={colors.blue}/></View>;
 return <>{children}</>;
}
