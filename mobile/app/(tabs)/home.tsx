import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Card, Note, Screen } from '@/components/Screen';
import { api } from '@/services/api';
import { colors } from '@/theme/tokens';
import { isDemoBuild } from '@/services/demo';

type Transaction = {id: string; amount: string; status: string; payment_method: string; occurred_at: string};
type Briefing = {insights: Array<{kind: string; text: string}>; data_available: boolean; source: string; collections: string; successful_transactions: number; collections_are_not_profit: boolean};
const prompts = [
  {label: 'आज कितनी कमाई हुई?', question: "How much did I collect today?"},
  {label: 'Who owes payment?', question: 'What settlements are pending?'},
  {label: "Show today's total", question: "Show today's total"},
];

export default function Home() {
  const [briefLanguage, setBriefLanguage] = useState<'en' | 'hi'>('en');
  useEffect(() => {
    SecureStore.getItemAsync('assistant_language').then(value => {
      if (value === 'hi-IN') setBriefLanguage('hi');
    }).catch(() => {});
  }, []);
  const transactions = useQuery({queryKey: ['transactions', 6], queryFn: () => api<Transaction[]>('/transactions?limit=6')});
  const briefing = useQuery({queryKey: ['daily-briefing', briefLanguage], queryFn: () => api<Briefing>(`/dashboard/briefing?language=${briefLanguage}`)});
  const total = briefing.data ? money(briefing.data.collections) : '—';
  return <Screen title="Paytm AI Business" subtitle="Your merchant workspace">
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2}}>
      <View style={{flex: 1}}>
        <Text style={{fontSize: 13, color: colors.muted}}>MERCHANT WORKSPACE</Text>
        <Text style={{fontSize: 18, fontWeight: '700', color: colors.navy}}>Store overview</Text>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <View style={{backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#D6E8FB', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7}}><Text style={{fontSize: 12, fontWeight: '700', color: colors.blue}}>Voice assistant</Text></View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel="Open workspace settings" style={{width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border}}><Text style={{fontSize: 18, color: colors.navy}}>⚙</Text></Pressable>
      </View>
    </View>

    <View style={{backgroundColor: colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: colors.blue, gap: 11}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <View style={{flex: 1}}>
          <Text style={{fontSize: 13, fontWeight: '600', color: colors.muted}}>Today's money received</Text>
          <Text style={{fontSize: 30, fontWeight: '800', color: colors.navy, marginTop: 5}}>₹{total}</Text>
        </View>
        <View style={{width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F0FF'}}>
          <Text style={{fontSize: 20}}>₹</Text>
        </View>
      </View>
      {briefing.isLoading ? <ActivityIndicator color={colors.blue} /> : briefing.isError ? <Note>{briefing.error.message}</Note> : <View style={{borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9}}>
        <Text style={{fontSize: 13, color: colors.muted}}>{briefing.data?.successful_transactions ?? 0} successful payments today · {briefing.data?.data_available ? 'connected records' : 'no records yet'}</Text>
        <Text style={{fontSize: 11, color: colors.muted, marginTop: 4}}>{isDemoBuild ? 'Fictional sample records' : 'Collections are not profit.'}</Text>
      </View>}
    </View>

    <Card title={briefLanguage === 'hi' ? 'आज का व्यापार सार' : 'Daily business briefing'}>
      {briefing.isLoading ? <ActivityIndicator color={colors.blue} /> : briefing.isError ? <Note>{briefing.error.message}</Note> : <View style={{gap: 8}}>
        {briefing.data?.insights.map((insight, index) => <Text key={`${insight.kind}-${index}`} style={{fontSize: 13, lineHeight: 19, color: colors.ink}}>• {insight.text}</Text>)}
        <Text style={{fontSize: 10, color: colors.muted}}>{briefing.data?.source} · {briefing.data?.collections_are_not_profit ? 'Collections are not profit.' : ''}</Text>
      </View>}
    </Card>

    <View style={{alignItems: 'center', paddingTop: 8, paddingBottom: 4}}>
      <Pressable hitSlop={12} onPress={() => router.push({pathname: '/(tabs)/assistant', params: {autostart: 'true'}})} accessibilityRole="button" accessibilityLabel="Start voice conversation with your AI business partner" style={{width: 126, height: 126, alignItems: 'center', justifyContent: 'center', borderRadius: 64, backgroundColor: '#E4F6FE', borderWidth: 1, borderColor: '#C2EFFF'}}>
        <View pointerEvents="none" style={{width: 94, height: 94, alignItems: 'center', justifyContent: 'center', borderRadius: 48, backgroundColor: colors.blue, borderWidth: 5, borderColor: '#79D6FF', elevation: 5}}>
          <Text pointerEvents="none" style={{fontSize: 38, color: '#FFFFFF'}}>🎙</Text>
        </View>
      </Pressable>
      <Text style={{fontSize: 18, fontWeight: '800', color: colors.navy, textAlign: 'center', marginTop: 13}}>Talk to your AI business partner</Text>
      <Text style={{fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center'}}>Ask in English or Hindi</Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14}}>
        {prompts.map(prompt => <Pressable key={prompt.question} onPress={() => router.push({pathname: '/(tabs)/assistant', params: {question: prompt.question}})} style={{backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9}}>
          <Text style={{fontSize: 12, fontWeight: '600', color: colors.navy}}>{prompt.label}</Text>
        </Pressable>)}
      </View>
    </View>

    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2}}>
      <Text style={{fontSize: 18, fontWeight: '800', color: colors.navy}}>Recent payments</Text>
      <Pressable onPress={() => router.navigate('/wallet')} accessibilityRole="button"><Text style={{fontSize: 13, color: colors.blue, fontWeight: '700'}}>View all</Text></Pressable>
    </View>
    {transactions.isLoading ? <ActivityIndicator color={colors.blue} /> : transactions.isError ? <Card title="Payment records"><Note>{transactions.error.message}</Note></Card> : transactions.data?.length ? transactions.data.slice(0, 4).map(tx => <TransactionRow key={tx.id} transaction={tx} />) : <Card title="No payment records"><Note>Connected payment activity will appear here when available.</Note></Card>}
  </Screen>;
}

export function TransactionRow({transaction}: {transaction: Transaction}) {
  const refunded = transaction.status === 'refunded';
  return <View style={{backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12}}>
    <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6F3FA', alignItems: 'center', justifyContent: 'center'}}><Text style={{fontSize: 19, color: colors.blue}}>{transaction.payment_method?.toLowerCase().includes('card') ? '▣' : '↗'}</Text></View>
    <View style={{flex: 1}}>
      <Text style={{fontSize: 15, fontWeight: '700', color: colors.navy}}>{refunded ? '−' : '+'}₹{money(transaction.amount)}</Text>
      <Text style={{fontSize: 12, color: colors.muted, marginTop: 3}}>{transaction.payment_method || 'Payment'} · {new Date(transaction.occurred_at).toLocaleString([], {hour: 'numeric', minute: '2-digit'})}</Text>
    </View>
    <Text style={{fontSize: 17, color: refunded ? colors.amber : colors.green}}>{refunded ? '↩' : '✓'}</Text>
  </View>;
}

export function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00';
}
