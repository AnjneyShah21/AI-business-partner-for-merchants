import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSampleWorkspace } from '@/hooks/useSampleWorkspace';

export function Screen({ title, subtitle, children }: PropsWithChildren<{title: string; subtitle?: string}>) {
 const insets=useSafeAreaInsets();
 const sampleWorkspace=useSampleWorkspace();
 return <ScrollView style={s.page} contentContainerStyle={[s.content,{paddingTop:insets.top+18,paddingBottom:insets.bottom+18}]}><Text style={s.title}>{title}</Text>
 {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
 {sampleWorkspace ? <View style={s.demoBanner}><Text style={s.demoText}>SAMPLE WORKSPACE · Fictional records only · No Paytm connection</Text></View> : null}
 {children}</ScrollView>;
}
export function Card({ title, children }: PropsWithChildren<{title: string}>) {
 return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>;
}
export function Note({ children }: PropsWithChildren) { return <Text style={s.note}>{children}</Text>; }
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
 title: { fontSize: 28, fontWeight: '700', color: colors.navy }, subtitle: { color: colors.muted, fontSize: 14, marginTop: -8 },
 demoBanner: { backgroundColor: '#FFF4D6', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F1D89A' }, demoText: { color: '#805400', fontSize: 11, lineHeight: 16, fontWeight: '700' },
 card: { backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 10 },
 cardTitle: { color: colors.muted, fontSize: 13, fontWeight: '600' }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 } });
