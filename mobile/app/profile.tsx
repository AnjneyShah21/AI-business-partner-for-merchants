import {Card, Note, Screen} from '@/components/Screen';
import {Pressable, Text} from 'react-native';
import {Link, router} from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {colors} from '@/theme/tokens';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {api} from '@/services/api';
import {useSampleWorkspace} from '@/hooks/useSampleWorkspace';

type Capability = {key: string; purpose: string; status: string; prerequisite: string};

export default function Profile() {
  const sampleWorkspace = useSampleWorkspace();
  const queryClient = useQueryClient();

  async function signOut() {
    await GoogleSignin.signOut().catch(() => {});
    queryClient.clear();
    await SecureStore.deleteItemAsync('session_token');
    await SecureStore.deleteItemAsync('conversation_id');
    router.replace('/');
  }

  return <Screen title="Profile" subtitle="Merchant workspace and security">
    <Card title="BUSINESS TOOLS">
      <Note>Open transactions, inventory, customers, campaigns, approvals, and other merchant tools.</Note>
      <Link href="/tools" asChild><Pressable accessibilityRole="button" style={{backgroundColor: '#EAF4FF', padding: 12, borderRadius: 10, alignItems: 'center'}}><Text style={{fontWeight: '700', color: colors.blue}}>Open business tools</Text></Pressable></Link>
    </Card>
    <Card title="Merchant account"><Note>{sampleWorkspace
      ? 'You are exploring an offline sample shop. Its transaction history comes from the bundled fictional CSV; no merchant account or Paytm data is connected.'
      : 'This workspace was opened with Google sign-in. Its merchant records come from the authenticated backend.'}</Note></Card>
    <Card title="Paytm API connection"><Note>{sampleWorkspace
      ? 'Paytm access is unavailable, so this workspace uses fictional sample transactions. The Paytm connection option remains here for later. Once authorized API access is available, credentials must be configured on the backend, never entered into or stored by this app.'
      : 'Paytm transaction and settlement sync is not connected. Once authorized API access is available, credentials must be configured on the backend, never entered into or stored by this app.'}</Note>
      <Link href={{pathname: '/tools/[module]', params: {module: 'imports'}}} asChild><Pressable accessibilityRole="button" style={{backgroundColor: '#EAF4FF', padding: 12, borderRadius: 10, alignItems: 'center'}}>
        <Text style={{fontWeight: '700', color: colors.blue}}>Import an authorized transaction CSV</Text>
      </Pressable></Link>
    </Card>
    <Card title="Privacy and security"><Note>{sampleWorkspace
      ? 'This workspace contains fictional records and has no Paytm connection. Voice audio uses your installed Android speech service; its network use depends on that service and its settings.'
      : 'Merchant financial data is loaded only from authenticated backend APIs. Provider credentials are never stored in this app. When ElevenLabs is enabled, spoken reply text is sent there to generate audio.'}</Note></Card>
    <Card title="Language & accessibility"><Note>English and Hindi voice questions use Android speech recognition. Spoken replies use your selected ElevenLabs voice when configured, with Android text-to-speech as fallback.</Note></Card>
    <ProviderStatus/>
    <Pressable onPress={signOut} style={{padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center'}}><Text style={{fontWeight: '600', color: colors.ink}}>Sign out</Text></Pressable>
  </Screen>;
}

function ProviderStatus() {
  const query = useQuery({queryKey: ['integrations'], queryFn: () => api<Capability[]>('/integrations/status')});
  return <Card title="CONNECTED SERVICES">{query.isLoading ? <Note>Loading service status…</Note> : query.isError ? <Note>{query.error.message}</Note> : query.data?.map(item => <Text key={item.key} style={{fontSize: 12, color: colors.ink, lineHeight: 18}}>{item.purpose}: {item.status.replaceAll('_', ' ')}. {item.status === 'not_configured' || item.status === 'disabled' ? item.prerequisite : ''}</Text>)}</Card>;
}
