import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text } from 'react-native';
import { Card, Note, Screen } from '@/components/Screen';
import { api } from '@/services/api';
import { colors } from '@/theme/tokens';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
type Comparison = {current_days:number;current_collections:string;previous_collections:string;change_percent:string|null;comparison_available:boolean;metric:string};
type Peak = {period_days:number;hours:Array<{hour:number;successful_transactions:number}>;source:string};
type AlertResult = {available:boolean;reason?:string;alerts:Array<{type:string;priority:string;change_percent:string;action:string}>};
export default function Analytics() {
 const comparison=useQuery({queryKey:['sales-comparison',7],queryFn:()=>api<Comparison>('/analytics/period-comparison?days=7')});
 const peaks=useQuery({queryKey:['peak-hours',30],queryFn:()=>api<Peak>('/analytics/peak-hours?days=30')});
 const alerts=useQuery({queryKey:['sales-anomalies'],queryFn:()=>api<AlertResult>('/analytics/anomalies')});
 return <Screen title="Analytics" subtitle="Connected merchant records">
  <Card title="7 DAY COLLECTION COMPARISON">{comparison.isLoading?<ActivityIndicator color={colors.blue}/>:comparison.isError?<Note>{comparison.error.message}</Note>:comparison.data?<>
    <Text style={{fontSize:28,fontWeight:'700',color:colors.navy}}>₹{comparison.data.current_collections}</Text>
    <Note>Previous period: ₹{comparison.data.previous_collections}. {comparison.data.comparison_available?`Change: ${comparison.data.change_percent}%`:'A percentage change is unavailable because the previous period has no collections.'}</Note>
    <Note>{comparison.data.metric}</Note></>:null}</Card>
  <Card title="BUSIEST COLLECTION HOURS">{peaks.isLoading?<ActivityIndicator color={colors.blue}/>:peaks.isError?<Note>{peaks.error.message}</Note>:peaks.data?.hours.length?<><PeakHoursGraph rows={peaks.data.hours}/>{peaks.data.hours.map(h=><Text key={h.hour} style={{color:colors.ink,fontSize:15}}>{String(h.hour).padStart(2,'0')}:00 · {h.successful_transactions} payments</Text>)}</>:<Note>No connected payment records are available for this period.</Note>}</Card>
  <Card title="SALES ALERTS">{alerts.isLoading?<ActivityIndicator color={colors.blue}/>:alerts.isError?<Note>{alerts.error.message}</Note>:alerts.data?.alerts.length?alerts.data.alerts.map((a,i)=><Note key={i}>{a.priority.toUpperCase()} · {a.type.replaceAll('_',' ')} ({a.change_percent}%). {a.action}</Note>):<Note>{alerts.data?.reason??'No threshold alerts from the connected data.'}</Note>}</Card>
  <Card title="Product insights"><Note>Product-level reporting requires connected POS or invoice data. Payment totals alone do not identify items sold.</Note></Card>
 </Screen>;
}

function PeakHoursGraph({rows}:{rows:Peak['hours']}){
 const max=Math.max(...rows.map(r=>r.successful_transactions),1); const width=300; const height=150; const gap=12; const slot=(width-gap*2)/rows.length; const barWidth=Math.min(36,slot*0.58);
 return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel="Successful transaction counts by peak hour">
  {rows.map((row,i)=>{const barHeight=Math.max(2,(row.successful_transactions/max)*92);const x=gap+i*slot+(slot-barWidth)/2;const y=108-barHeight;return <Fragment key={row.hour}><Rect x={x} y={y} width={barWidth} height={barHeight} rx={5} fill={colors.blue}/><SvgText x={x+barWidth/2} y={125} textAnchor="middle" fontSize="10" fill={colors.muted}>{String(row.hour).padStart(2,'0')}</SvgText></Fragment>})}
 </Svg>;
}
