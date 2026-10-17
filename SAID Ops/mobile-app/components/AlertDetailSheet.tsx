import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { DemoAlert } from '../types/alerts';
import type { MainNavigationTab } from './StaffHomeScreen';
import { NotificationStatus } from './NotificationStatus';

const categoryVisual = {
  high: { color: colors.warning, label: 'HIGH PRIORITY' },
  info: { color: colors.blueBright, label: 'INFO' },
  system: { color: '#b4bfce', label: 'SYSTEM' },
} as const;

type AlertDetailSheetProps = {
  alert: DemoAlert;
  onClose: () => void;
  onNavigate: (tab: MainNavigationTab) => void;
};

export function AlertDetailSheet({ alert, onClose, onNavigate }: AlertDetailSheetProps) {
  const visual = categoryVisual[alert.category];
  const action = alert.action === 'roster' ? { label: 'View Roster', tab: 'Roster' as const, icon: 'clipboard-outline' as const } : null;

  return <Modal animationType="slide" onRequestClose={onClose} transparent visible>
    <View style={styles.modalOverlay}><View style={styles.detailPanel}><View style={styles.detailTopAccent} /><View style={styles.detailHeader}><Text style={[styles.category, { color: visual.color }]}>{visual.label}</Text><Pressable accessibilityLabel="Close alert detail" accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Ionicons color={colors.text} name="close" size={23} /></Pressable></View><View style={[styles.detailIcon, { borderColor: visual.color }]}><Ionicons color={visual.color} name={alert.icon} size={34} /></View><Text style={styles.detailTitle}>{alert.title}</Text><NotificationStatus showEmpty={false} /><Text style={styles.detailMessage}>{alert.message}</Text><View style={styles.detailMeta}><Ionicons color="#aab8ca" name="time-outline" size={17} /><Text style={styles.detailTime}>{alert.time}</Text>{alert.read ? <View style={styles.statusRead}><Ionicons color={colors.completed} name="checkmark-circle-outline" size={16} /><Text style={styles.statusReadText}>Read</Text></View> : <View style={styles.statusUnread}><Ionicons color={visual.color} name="ellipse" size={9} /><Text style={[styles.statusUnreadText, { color: visual.color }]}>Unread</Text></View>}</View>{action ? <Pressable accessibilityLabel={action.label} accessibilityRole="button" onPress={() => { onClose(); onNavigate(action.tab); }} style={({ pressed }) => [styles.detailAction, { borderColor: visual.color }, pressed && styles.pressed]}><Ionicons color={visual.color} name={action.icon} size={20} /><Text style={[styles.detailActionText, { color: visual.color }]}>{action.label}</Text><Ionicons color={visual.color} name="arrow-forward" size={19} /></Pressable> : null}</View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  modalOverlay: { backgroundColor: 'rgba(0, 5, 11, 0.76)', flex: 1, justifyContent: 'flex-end' },
  detailPanel: { backgroundColor: '#06111d', borderColor: '#315270', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, overflow: 'hidden', padding: 20 },
  detailTopAccent: { backgroundColor: colors.blueBright, height: 2, left: 0, position: 'absolute', right: 0, top: 0 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  category: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  closeButton: { alignItems: 'center', backgroundColor: '#0b1c2c', borderColor: '#315270', borderRadius: 3, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  detailIcon: { alignItems: 'center', borderRadius: 28, borderWidth: 1, height: 56, justifyContent: 'center', marginTop: 18, width: 56 },
  detailTitle: { color: colors.text, fontSize: 23, fontWeight: '700', lineHeight: 29, marginTop: 14 },
  detailMessage: { color: '#c0c9d7', fontSize: 15, lineHeight: 22, marginTop: 10 },
  detailMeta: { alignItems: 'center', borderTopColor: '#25415b', borderTopWidth: 1, flexDirection: 'row', marginTop: 20, paddingTop: 13 },
  detailTime: { color: '#aab8ca', fontSize: 13, marginLeft: 6 },
  statusRead: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  statusReadText: { color: colors.completed, fontSize: 12, marginLeft: 4 },
  statusUnread: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  statusUnreadText: { fontSize: 12, fontWeight: '700', marginLeft: 5 },
  detailAction: { alignItems: 'center', borderRadius: 3, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 18, minHeight: 50 },
  detailActionText: { fontSize: 15, fontWeight: '600', marginHorizontal: 9 },
  pressed: { opacity: 0.8 },
});
