import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Card, Note, Screen } from '@/components/Screen';
import { api } from '@/services/api';
import { colors } from '@/theme/tokens';
import { isDemoBuild } from '@/services/demo';
import { money } from './home';

type Comparison = {current_days: number; current_collections: string; previous_collections: string; change_percent: string | null; comparison_available: boolean; metric: string};
type Peak = {period_days: number; hours: Array<{hour: number; successful_transactions: number}>; source: string};
type AlertResult = {available: boolean; reason?: string; alerts: Array<{type: string; priority: string; change_percent: string; action: string}>};

export default function Analytics() {
  const comparison = useQuery({queryKey: ['sales-comparison', 7], queryFn: () => api<Comparison>('/analytics/period-comparison?days=7')});
  const peaks = useQuery({queryKey: ['peak-hours', 30], queryFn: () => api<Peak>('/analytics/peak-hours?days=30')});
  const alerts = useQuery({queryKey: ['sales-anomalies'], queryFn: () => api<AlertResult>('/analytics/anomalies')});
  const data = comparison.data;
  const previous = Number(data?.previous_collections ?? 0);
  const current = Number(data?.current_collections ?? 0);
  return <Screen title="Business Analytics" subtitle={isDemoBuild ? 'Graphs from fictional sample records' : 'Graphs from connected payment records'}>
    <View style={{flexDirection: 'row', gap: 9}}>
      <Summary label="COLLECTED · 7 DAYS" value={data ? `₹${money(data.current_collections)}` : '—'} />
      <Summary label="PREVIOUS 7 DAYS" value={data ? `₹${money(data.previous_collections)}` : '—'} />
    </View>
    {comparison.isLoading ? <ActivityIndicator color={colors.blue} /> : comparison.isError ? <Card title="Collections comparison"><Note>{comparison.error.message}</Note></Card> : data ? <Card title="Collections · current vs previous week">
      <Text style={{fontSize: 12, color: colors.muted}}>{data.comparison_available ? `Change: ${data.change_percent}% · ${data.metric}` : 'A percentage change is unavailable because the previous period has no collections.'}</Text>
      <ComparisonChart current={current} previous={previous} />
      <View style={{flexDirection: 'row', justifyContent: 'center', gap: 20}}><Legend color={colors.blue} label="Current 7 days" /><Legend color="#79D6FF" label="Previous 7 days" /></View>
    </Card> : null}

    <Card title="Busiest payment hours">
      {peaks.isLoading ? <ActivityIndicator color={colors.blue} /> : peaks.isError ? <Note>{peaks.error.message}</Note> : peaks.data?.hours.length ? <>
        <Text style={{fontSize: 12, color: colors.muted}}>Successful transaction count · last {peaks.data.period_days} days</Text>
        <PeakHoursChart rows={peaks.data.hours} />
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{peaks.data.hours.map(row => <View key={row.hour} style={{backgroundColor: '#F1F6FC', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7}}><Text style={{fontSize: 11, color: colors.muted}}>{hour(row.hour)}</Text><Text style={{fontWeight: '700', color: colors.navy}}>{row.successful_transactions} payments</Text></View>)}</View>
      </> : <Note>No connected payment records are available for this period.</Note>}
    </Card>

    <Card title="Business insight">
      {alerts.isLoading ? <ActivityIndicator color={colors.blue} /> : alerts.isError ? <Note>{alerts.error.message}</Note> : alerts.data?.alerts.length ? alerts.data.alerts.map((alert, index) => <View key={`${alert.type}-${index}`} style={{gap: 5}}><Text style={{color: colors.amber, fontWeight: '700'}}>{alert.priority.toUpperCase()} · {alert.type.replaceAll('_', ' ')}</Text><Note>{alert.action}</Note></View>) : <Note>{alerts.data?.reason ?? 'No alert threshold was triggered by the available records.'} {isDemoBuild ? 'This sample insight is not a forecast.' : ''}</Note>}
    </Card>
    <Note>Payment counts and collections describe recorded transactions. They do not show profit or item-level sales.</Note>
  </Screen>;
}

function Summary({label, value}: {label: string; value: string}) {
  return <View style={{flex: 1, minHeight: 83, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 12, justifyContent: 'space-between'}}><Text style={{fontSize: 10, fontWeight: '700', color: colors.muted}}>{label}</Text><Text style={{fontSize: 17, fontWeight: '800', color: colors.navy}}>{value}</Text></View>;
}
function Legend({color, label}: {color: string; label: string}) { return <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}><View style={{width: 9, height: 9, borderRadius: 5, backgroundColor: color}}/><Text style={{fontSize: 11, color: colors.muted}}>{label}</Text></View>; }
function hour(value: number) { const suffix = value >= 12 ? 'PM' : 'AM'; const twelve = value % 12 || 12; return `${twelve} ${suffix}`; }

function ComparisonChart({current, previous}: {current: number; previous: number}) {
  const max = Math.max(current, previous, 1);
  const width = 310; const height = 176; const chartHeight = 116; const barWidth = 50;
  const values = [previous, current];
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel="Bar chart comparing this week and the previous week collections">
    {[0, 0.5, 1].map((factor, index) => <Line key={index} x1="20" x2="294" y1={18 + factor * chartHeight} y2={18 + factor * chartHeight} stroke="#E8EDF5" strokeWidth="1" />)}
    {values.map((value, index) => { const barHeight = Math.max(4, (value / max) * 94); const x = index === 0 ? 82 : 178; const y = 134 - barHeight; return <Fragment key={index}><Rect x={x} y={y} width={barWidth} height={barHeight} rx="8" fill={index === 0 ? '#79D6FF' : colors.blue} /><SvgText x={x + barWidth / 2} y="155" textAnchor="middle" fontSize="11" fill={colors.muted}>{index === 0 ? 'Previous' : 'Current'}</SvgText></Fragment>; })}
  </Svg>;
}

function PeakHoursChart({rows}: {rows: Peak['hours']}) {
  const sorted = [...rows].sort((a, b) => a.hour - b.hour);
  const max = Math.max(...sorted.map(row => row.successful_transactions), 1);
  const width = 310; const top = 14; const base = 126; const slot = Math.min(58, 274 / Math.max(sorted.length, 1)); const barWidth = Math.min(30, slot * 0.58);
  const points = sorted.map((row, index) => ({x: 20 + index * slot + (slot - barWidth) / 2 + barWidth / 2, y: base - (row.successful_transactions / max) * 90}));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return <Svg width="100%" height="150" viewBox={`0 0 ${width} 150`} accessibilityLabel="Line chart showing busiest payment hours">
    {[0, 1, 2].map(index => <Line key={index} x1="12" x2="300" y1={top + index * 45} y2={top + index * 45} stroke="#E8EDF5" strokeWidth="1" />)}
    <Path d={line} fill="none" stroke={colors.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {points.map((point, index) => <Fragment key={index}><Circle cx={point.x} cy={point.y} r="5" fill="#FFFFFF" stroke={colors.blue} strokeWidth="3"/><SvgText x={point.x} y="145" textAnchor="middle" fontSize="9" fill={colors.muted}>{hour(sorted[index].hour)}</SvgText></Fragment>)}
  </Svg>;
}
