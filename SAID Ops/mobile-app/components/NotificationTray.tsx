import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { DemoAlert } from '../types/alerts';
import { useNotifications } from './NotificationProvider';
import { NotificationStatus } from './NotificationStatus';

type NotificationTrayProps = {
  alerts: DemoAlert[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenAlert: (alertId: string) => void;
  onViewAll: () => void;
  visible: boolean;
};

const categoryVisual = {
  high: { color: colors.warning, label: 'HIGH PRIORITY' },
  info: { color: colors.blueBright, label: 'INFO' },
  system: { color: '#b4bfce', label: 'SYSTEM' },
} as const;

export function NotificationTray({ alerts, onClose, onMarkAllRead, onOpenAlert, onViewAll, visible }: NotificationTrayProps) {
  const { loading, error, canMarkRead } = useNotifications();
  const unreadCount = alerts.filter((alert) => !alert.read).length;
  const trayAlerts = useMemo(() => alerts.map((alert, index) => ({ alert, index })).sort((a, b) => {
    const rank = (alert: DemoAlert) => !alert.read && alert.category === 'high' ? 0 : !alert.read ? 1 : 2;
    return rank(a.alert) - rank(b.alert) || a.index - b.index;
  }).slice(0, 4).map(({ alert }) => alert), [alerts]);

  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <Pressable accessibilityLabel="Dismiss notifications" accessibilityRole="button" onPress={onClose} style={styles.overlay}>
      <Pressable accessibilityLabel="Notification centre" accessibilityRole="summary" onPress={() => undefined} style={styles.tray}>
        <View style={styles.topAccent} /><View style={styles.header}><View><Text style={styles.title}>Notifications</Text><Text style={styles.subtitle}>{loading ? 'Loading notifications...' : error ? 'Notifications unavailable' : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</Text></View><Pressable accessibilityLabel="Close notifications" accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Ionicons color={colors.text} name="close" size={22} /></Pressable></View>
        <View style={styles.toolbar}><Text style={styles.recentLabel}>RECENT &amp; RELEVANT</Text><Pressable accessibilityLabel="Mark all notifications as read" accessibilityRole="button" disabled={!canMarkRead || unreadCount === 0} onPress={onMarkAllRead} style={unreadCount === 0 && styles.disabled}><Text style={styles.markAll}>Mark All as Read</Text></Pressable></View>
        <NotificationStatus />
        {trayAlerts.map((alert) => { const visual = categoryVisual[alert.category]; return <Pressable accessibilityLabel={`${visual.label}: ${alert.title}. ${alert.read ? 'Read' : 'Unread'}. Open details.`} accessibilityRole="button" key={alert.id} onPress={() => onOpenAlert(alert.id)} style={({ pressed }) => [styles.preview, { borderColor: !alert.read ? visual.color : '#304459' }, pressed && styles.pressed]}><View style={[styles.accent, { backgroundColor: visual.color }]} /><View style={[styles.icon, { borderColor: visual.color }]}><Ionicons color={visual.color} name={alert.icon} size={21} /></View><View style={styles.copy}><View style={styles.previewTop}><Text style={[styles.category, { color: visual.color }]}>{visual.label}</Text><Text style={styles.time}>{alert.time}</Text></View><Text numberOfLines={1} style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]}>{alert.title}</Text><Text numberOfLines={1} style={styles.message}>{alert.message}</Text><View style={styles.stateRow}>{!alert.read ? <><View style={[styles.stateDot, { backgroundColor: visual.color }]} /><Text style={[styles.stateText, { color: visual.color }]}>UNREAD</Text></> : <Text style={styles.readText}>Read</Text>}</View></View></Pressable>; })}
        <Pressable accessibilityLabel="View all alerts" accessibilityRole="button" onPress={onViewAll} style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}><Text style={styles.viewAllText}>View All Alerts</Text><Ionicons color={colors.blueBright} name="arrow-forward" size={19} /></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0, 5, 11, 0.72)', flex: 1, justifyContent: 'flex-start', paddingHorizontal: 12, paddingTop: 74 },
  tray: { backgroundColor: '#05101c', borderColor: '#2c587c', borderRadius: 4, borderWidth: 1, maxHeight: '86%', overflow: 'hidden', padding: 14 },
  topAccent: { backgroundColor: colors.blueBright, height: 2, left: 0, position: 'absolute', right: 0, top: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: colors.text, fontSize: 21, fontWeight: '700' }, subtitle: { color: '#a9b6c9', fontSize: 11, marginTop: 3 }, closeButton: { alignItems: 'center', backgroundColor: '#091928', borderColor: '#315270', borderRadius: 3, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  toolbar: { alignItems: 'center', borderBottomColor: '#25415b', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 13, paddingBottom: 10 }, recentLabel: { color: '#8495aa', fontSize: 9, letterSpacing: 0.8 }, markAll: { color: colors.blueBright, fontSize: 10, fontWeight: '600', paddingVertical: 8 }, disabled: { opacity: 0.45 },
  preview: { alignItems: 'center', backgroundColor: '#07131f', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 86, overflow: 'hidden', padding: 9 }, accent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 }, icon: { alignItems: 'center', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', marginRight: 9, width: 40 }, copy: { flex: 1, minWidth: 0 }, previewTop: { alignItems: 'center', flexDirection: 'row' }, category: { flex: 1, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 }, time: { color: '#92a1b4', fontSize: 9 }, alertTitle: { color: '#cfd7e2', fontSize: 13, marginTop: 2 }, alertTitleUnread: { color: colors.text, fontWeight: '700' }, message: { color: '#9facbd', fontSize: 10, marginTop: 2 }, stateRow: { alignItems: 'center', flexDirection: 'row', marginTop: 4 }, stateDot: { borderRadius: 3, height: 6, marginRight: 4, width: 6 }, stateText: { fontSize: 8, fontWeight: '700' }, readText: { color: '#7f8ea2', fontSize: 8 },
  viewAll: { alignItems: 'center', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 3, minHeight: 46 }, viewAllText: { color: colors.blueBright, fontSize: 13, fontWeight: '600' }, pressed: { opacity: 0.8 },
});
