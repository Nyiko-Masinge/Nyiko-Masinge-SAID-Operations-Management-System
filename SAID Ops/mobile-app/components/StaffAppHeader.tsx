import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../theme';
import { getStaffInitials } from '../types/profile';
import { SaidLogo } from './SaidLogo';

type RootHeaderProps = {
  hasUnreadAlerts: boolean;
  mode: 'root';
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  userName: string;
};

type NestedHeaderProps = {
  backLabel: string;
  hasUnreadAlerts: boolean;
  mode: 'nested';
  onBack: () => void;
  onOpenNotifications: () => void;
};

type StaffAppHeaderProps = RootHeaderProps | NestedHeaderProps;

export function StaffAppHeader(props: StaffAppHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const logoSize = compact ? 42 : 48;

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {props.mode === 'root' ? (
        <Pressable
          accessibilityHint="Opens your staff profile"
          accessibilityLabel={`Open profile for ${props.userName}`}
          accessibilityRole="button"
          onPress={props.onOpenProfile}
          style={({ pressed }) => [styles.edgeControl, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getStaffInitials(props.userName)}</Text>
          </View>
          <View style={styles.activeDot} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel={props.backLabel}
          accessibilityRole="button"
          onPress={props.onBack}
          style={({ pressed }) => [styles.edgeControl, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="arrow-back" size={27} />
        </Pressable>
      )}

      <View style={[styles.logoWrap, compact && styles.logoWrapCompact]}>
        <SaidLogo size={logoSize} />
      </View>
      <View style={styles.brand}>
        <Text adjustsFontSizeToFit minimumFontScale={0.9} numberOfLines={1} style={[styles.wordmark, compact && styles.wordmarkCompact]}>
          <Text style={styles.said}>SAID </Text><Text style={styles.ops}>Ops</Text>
        </Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.9} numberOfLines={1} style={[styles.subtitle, compact && styles.subtitleCompact]}>
          STAFF OPERATIONS SYSTEM
        </Text>
      </View>

      <Pressable
        accessibilityLabel={props.hasUnreadAlerts ? 'Open notifications, unread alerts' : 'Open notifications, no unread alerts'}
        accessibilityRole="button"
        onPress={props.onOpenNotifications}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      >
        <Ionicons color={colors.text} name="notifications-outline" size={24} />
        {props.hasUnreadAlerts ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  activeDot: { backgroundColor: colors.completed, borderColor: '#06111d', borderRadius: 5, borderWidth: 2, bottom: 3, height: 10, position: 'absolute', right: 3, width: 10 },
  avatar: { alignItems: 'center', backgroundColor: '#173a5b', borderColor: colors.blueBright, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  bellButton: { alignItems: 'center', backgroundColor: '#06111e', borderColor: '#29425e', borderRadius: 3, borderWidth: 1, height: 44, justifyContent: 'center', marginLeft: 5, width: 44 },
  brand: { flex: 1, minWidth: 0 },
  edgeControl: { alignItems: 'center', height: 44, justifyContent: 'center', position: 'relative', width: 44 },
  header: { alignItems: 'center', backgroundColor: '#030b14', borderBottomColor: '#24425d', borderBottomWidth: 1, flexDirection: 'row', minHeight: 76, paddingHorizontal: 10 },
  headerCompact: { minHeight: 72, paddingHorizontal: 7 },
  logoWrap: { marginHorizontal: 8 },
  logoWrapCompact: { marginHorizontal: 5 },
  ops: { color: colors.blueBright },
  pressed: { opacity: 0.76 },
  said: { color: colors.text },
  subtitle: { color: '#99a9c2', fontSize: 7, letterSpacing: 1.5, marginTop: 1 },
  subtitleCompact: { fontSize: 6, letterSpacing: 1 },
  unreadDot: { backgroundColor: colors.warning, borderColor: '#080f17', borderRadius: 5, borderWidth: 1, height: 10, position: 'absolute', right: 4, top: 4, width: 10 },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  wordmarkCompact: { fontSize: 22 },
});
