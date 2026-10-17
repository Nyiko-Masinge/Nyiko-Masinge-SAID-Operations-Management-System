import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { useNotifications } from './NotificationProvider';

/** Shared tray/list/detail status: a failed load never looks like an empty inbox. */
export function NotificationStatus({ showEmpty = true }: { showEmpty?: boolean }) {
  const { loading, error, status, retry } = useNotifications();
  if (loading) return <Text style={styles.message}>Loading notifications...</Text>;
  if (error) return <View><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityLabel="Retry notifications" accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.message}>Retry</Text></Pressable></View>;
  if (showEmpty && status === 'empty') return <Text style={styles.message}>No notifications yet.</Text>;
  return null;
}

const styles = StyleSheet.create({
  message: { color: colors.text, fontSize: 13, paddingVertical: 10 },
  error: { color: colors.warning, fontSize: 13, paddingVertical: 10 },
  retry: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 8 },
});
