import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';
import type { AlertFilter, DemoAlert } from '../types/alerts';
import type { DemoStaffProfile } from '../types/profile';
import { AlertDetailSheet } from './AlertDetailSheet';
import { BottomNavigation, type MainNavigationTab } from './StaffHomeScreen';
import { StaffAppHeader } from './StaffAppHeader';
import { useNotifications } from './NotificationProvider';
import { NotificationStatus } from './NotificationStatus';

type StaffAlertsScreenProps = {
  alerts: DemoAlert[];
  profile: DemoStaffProfile;
  initialAlertId?: string | null;
  onMarkAllRead: () => void;
  onMarkRead: (alertId: string) => void;
  onNavigate: (tab: MainNavigationTab) => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
};

const filterLabels: Array<{ filter: AlertFilter; label: string }> = [
  { filter: 'all', label: 'ALL' },
  { filter: 'high', label: 'HIGH PRIORITY' },
  { filter: 'info', label: 'INFO' },
  { filter: 'system', label: 'SYSTEM' },
];

const categoryVisual = {
  high: { color: colors.warning, label: 'HIGH PRIORITY' },
  info: { color: colors.blueBright, label: 'INFO' },
  system: { color: '#b4bfce', label: 'SYSTEM' },
} as const;

function AlertCard({ alert, onOpen }: { alert: DemoAlert; onOpen: () => void }) {
  const visual = categoryVisual[alert.category];
  return <Pressable accessibilityLabel={`${visual.label}: ${alert.title}. ${alert.read ? 'Read' : 'Unread'}. Open details.`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.alertCard, { borderColor: alert.read ? '#354657' : visual.color }, !alert.read && styles.alertUnread, pressed && styles.pressed]}>
    <View style={[styles.alertAccent, { backgroundColor: visual.color }]} />
    <View style={[styles.alertIcon, { borderColor: visual.color }]}><Ionicons color={visual.color} name={alert.icon} size={28} /></View>
    <View style={styles.alertCopy}><Text style={[styles.category, { color: visual.color }]}>{visual.label}</Text><Text style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]}>{alert.title}</Text><Text numberOfLines={2} style={styles.alertMessage}>{alert.message}</Text><View style={styles.alertMeta}><Ionicons color="#9cacbf" name="time-outline" size={14} /><Text style={styles.alertTime}>{alert.time}</Text>{!alert.read ? <View style={styles.unreadState}><View style={[styles.unreadStateDot, { backgroundColor: visual.color }]} /><Text style={[styles.unreadStateText, { color: visual.color }]}>NEW</Text></View> : <Text style={styles.readState}>Read</Text>}</View></View>
    <Ionicons color="#b8c8dc" name="chevron-forward" size={23} />
  </Pressable>;
}

export function StaffAlertsScreen({ alerts, initialAlertId, onMarkAllRead, onMarkRead, onNavigate, onOpenNotifications, onOpenProfile, profile }: StaffAlertsScreenProps) {
  const { canMarkRead } = useNotifications();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(initialAlertId ?? null);
  const filteredAlerts = useMemo(() => filter === 'all' ? alerts : alerts.filter((alert) => alert.category === filter), [alerts, filter]);
  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const unreadCount = alerts.filter((alert) => !alert.read).length;
  const openAlert = (alert: DemoAlert) => { if (!alert.read) onMarkRead(alert.id); setSelectedAlertId(alert.id); };
  const unreadCountFor = (filterValue: AlertFilter) => alerts.filter((alert) => !alert.read && (filterValue === 'all' || alert.category === filterValue)).length;

  return <SafeAreaView style={styles.safeArea}>
    <StaffAppHeader hasUnreadAlerts={unreadCount > 0} mode="root" onOpenNotifications={onOpenNotifications} onOpenProfile={onOpenProfile} userName={profile.editable.fullName} />
    <View style={styles.contentArea}><View pointerEvents="none" style={styles.backdrop}><View style={styles.gridLine} /><View style={styles.circuit} /><Text style={styles.dots}>· · ·</Text></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.titleRow}><View style={styles.titleCopy}><Text style={styles.screenTitle}>Alerts</Text><Text style={styles.screenSubtitle}>Stay informed. Act quickly. Keep everyone safe.</Text></View><Pressable accessibilityLabel="Mark all alerts as read" accessibilityRole="button" disabled={!canMarkRead || unreadCount === 0} onPress={onMarkAllRead} style={[styles.markAllButton, unreadCount === 0 && styles.markAllDisabled]}><Text style={styles.markAllText}>Mark All as Read</Text></Pressable></View><ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>{filterLabels.map((item) => { const active = filter === item.filter; const filterUnreadCount = unreadCountFor(item.filter); return <Pressable accessibilityLabel={`Show ${item.label} alerts${filterUnreadCount > 0 ? `, ${filterUnreadCount} unread` : ''}`} accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.filter} onPress={() => setFilter(item.filter)} style={[styles.filterButton, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>{filterUnreadCount > 0 ? <View style={[styles.filterCount, active && styles.filterCountActive]}><Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{filterUnreadCount}</Text></View> : null}</Pressable>; })}</ScrollView><View style={styles.listMeta}><Ionicons color={colors.blueBright} name="funnel-outline" size={17} /><Text style={styles.listMetaText}>{filter === 'all' ? 'All operational alerts' : `${categoryVisual[filter].label} alerts`}</Text><Text style={styles.listMetaCount}>{filteredAlerts.length} shown</Text></View><NotificationStatus />{filteredAlerts.map((alert) => <AlertCard alert={alert} key={alert.id} onOpen={() => openAlert(alert)} />)}</ScrollView></View>
    <BottomNavigation activeTab="Alerts" hasUnreadAlerts={unreadCount > 0} onNavigate={onNavigate} />
    {selectedAlert ? <AlertDetailSheet alert={selectedAlert} onClose={() => setSelectedAlertId(null)} onNavigate={onNavigate} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  contentArea: { flex: 1 }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.9 }, gridLine: { backgroundColor: '#162c42', height: 1, left: 0, position: 'absolute', right: 0, top: 126 }, circuit: { borderColor: '#1c466c', borderRightWidth: 1, borderTopWidth: 1, height: 88, position: 'absolute', right: 0, top: 0, width: 88 }, dots: { color: colors.blueBright, fontSize: 14, letterSpacing: 5, opacity: 0.6, position: 'absolute', right: 17, top: 30 }, content: { padding: 14, paddingBottom: 30 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, titleCopy: { flex: 1 }, screenTitle: { color: colors.text, fontSize: 28, fontWeight: '700' }, screenSubtitle: { color: '#a9b6c9', fontSize: 13, lineHeight: 18, marginTop: 3 }, markAllButton: { borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, marginTop: 2, minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' }, markAllDisabled: { borderColor: '#415063', opacity: 0.55 }, markAllText: { color: colors.blueBright, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  filterRow: { gap: 8, marginTop: 18, paddingRight: 12 }, filterButton: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#33495f', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 42, paddingHorizontal: 12 }, filterActive: { backgroundColor: '#071b30', borderColor: colors.blueBright }, filterText: { color: '#b4bfce', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }, filterTextActive: { color: colors.blueBright }, filterCount: { alignItems: 'center', backgroundColor: '#344154', borderRadius: 10, height: 20, justifyContent: 'center', minWidth: 20, paddingHorizontal: 5 }, filterCountActive: { backgroundColor: '#0e5b9e' }, filterCountText: { color: colors.text, fontSize: 10, fontWeight: '700' }, filterCountTextActive: { color: 'white' },
  listMeta: { alignItems: 'center', flexDirection: 'row', marginVertical: 14 }, listMetaText: { color: '#b4bfce', fontSize: 12, marginLeft: 7 }, listMetaCount: { color: '#8495aa', fontSize: 11, marginLeft: 'auto' }, alertCard: { alignItems: 'center', backgroundColor: '#06111d', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginBottom: 10, minHeight: 108, overflow: 'hidden', padding: 12 }, alertUnread: { backgroundColor: '#091522' }, alertAccent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 }, alertIcon: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 25, borderWidth: 1, height: 50, justifyContent: 'center', marginRight: 11, marginTop: 2, width: 50 }, alertCopy: { flex: 1, minWidth: 0, paddingRight: 5 }, category: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }, alertTitle: { color: '#d6dde8', fontSize: 15, lineHeight: 20, marginTop: 4 }, alertTitleUnread: { color: colors.text, fontWeight: '700' }, alertMessage: { color: '#aebaca', fontSize: 12, lineHeight: 17, marginTop: 3 }, alertMeta: { alignItems: 'center', flexDirection: 'row', marginTop: 7 }, alertTime: { color: '#aab8ca', fontSize: 11, marginLeft: 4 }, unreadState: { alignItems: 'center', flexDirection: 'row', marginLeft: 10 }, unreadStateDot: { borderRadius: 4, height: 7, marginRight: 4, width: 7 }, unreadStateText: { fontSize: 10, fontWeight: '700' }, readState: { color: '#8495aa', fontSize: 10, marginLeft: 10 }, pressed: { opacity: 0.8 },
});
