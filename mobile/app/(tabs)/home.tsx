import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card, Note, Screen } from '@/components/Screen';
import { api, Sales } from '@/services/api';
import { colors } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';
import { isDemoBuild } from '@/services/demo';

export default function Home() {
 const {t}=useTranslation();
 const sales = useQuery({ queryKey: ['sales', 1], queryFn: () => api<Sales>('/dashboard/sales?days=1') });
 return <Screen title={t('home')} subtitle={isDemoBuild ? 'Preview the merchant workspace' : 'Your business, at a glance'}>
   {sales.isLoading ? <ActivityIndicator color={colors.blue} /> : sales.isError ? <Card title="Connect your merchant data"><Note>{sales.error.message} No sample financial data is shown.</Note></Card> : sales.data ? <>
    {!sales.data.data_available?<Card title="Waiting for payment records"><Note>There are no connected transactions in this period. The zero totals below are calculated from an empty data feed.</Note></Card>:null}
    <Card title={isDemoBuild ? 'SAMPLE COLLECTIONS · LAST 24 HOURS' : 'COLLECTIONS · LAST 24 HOURS'}><Text style={{fontSize:32,fontWeight:'700',color:colors.navy}}>₹{sales.data.collection_total}</Text><Note>{sales.data.successful_transactions} {isDemoBuild ? 'sample payments' : 'successful payments'} · as of {new Date(sales.data.as_of).toLocaleString()}</Note><Note>Source: {sales.data.source}</Note></Card>
    <View style={{flexDirection:'row',gap:12}}><View style={{flex:1}}><Card title="Refunds"><Text style={{fontSize:21,fontWeight:'700',color:colors.ink}}>₹{sales.data.refunds_total}</Text></Card></View><View style={{flex:1}}><Card title="Pending settlement"><Text style={{fontSize:21,fontWeight:'700',color:colors.ink}}>₹{sales.data.pending_settlements}</Text></Card></View></View>
    <Card title="About these numbers"><Note>{isDemoBuild ? 'These fictional sample collections are not your business data, revenue, or profit.' : 'Collections are successful payment amounts, not revenue or profit. Only connected provider records are included.'}</Note></Card>
   </>:null}
   <Card title="Business partner"><Note>Ask about connected sales, settlements, or inventory. Answers include the records used when available.</Note></Card>
 </Screen>;
}
