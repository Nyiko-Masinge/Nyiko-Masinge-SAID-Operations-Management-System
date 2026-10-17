import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { getStaffInitials, type DemoStaffProfile } from '../types/profile';
import type { DemoShift } from '../types/tasks';
import { useLocations } from '../lib/useLocations';
import { BottomNavigation, type MainNavigationTab } from './StaffHomeScreen';
import { StaffAppHeader } from './StaffAppHeader';

type StaffProfileScreenProps = {
  hasUnreadAlerts: boolean;
  onDismissSaveNotice: () => void;
  onEditProfile: () => void;
  onNavigate: (tab: MainNavigationTab) => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  profile: DemoStaffProfile;
  showSaveNotice: boolean;
  tasks: DemoShift[];
};

function SectionTitle({ children }: { children: string }) { return <Text style={styles.sectionTitle}>{children}</Text>; }

function DetailRow({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.detailRow}><Ionicons color="#aab8ca" name={icon} size={21} /><Text style={styles.detailLabel}>{label}</Text><Text numberOfLines={1} style={styles.detailValue}>{value}</Text></View>;
}

export function StaffProfileScreen({ hasUnreadAlerts, onDismissSaveNotice, onEditProfile, onNavigate, onOpenNotifications, onOpenProfile, onSignOut, profile, showSaveNotice, tasks }: StaffProfileScreenProps) {
  const { locationName } = useLocations();
  const initials = getStaffInitials(profile.editable.fullName);
  const overview = useMemo(() => ({ duties: tasks.length, completed: tasks.filter((task) => task.status === 'Completed').length, inProgress: tasks.filter((task) => task.status === 'In Progress').length }), [tasks]);
  const contactRows = [
    { icon: 'mail-outline' as const, label: 'Work Email', value: profile.editable.workEmail },
    { icon: 'call-outline' as const, label: 'Work Phone', value: profile.editable.workPhone },
    { icon: 'business-outline' as const, label: 'Department', value: profile.operational.department },
    { icon: 'location-outline' as const, label: 'Primary Location', value: locationName(profile.operational.primaryLocationId) },
  ];
  const accessRows = [
    { icon: 'person-circle-outline' as const, label: 'System Role', value: profile.operational.systemRole },
    { icon: 'briefcase-outline' as const, label: 'Operational Role', value: profile.operational.operationalRole },
    { icon: 'business-outline' as const, label: 'Department', value: profile.operational.department },
    { icon: 'lock-closed-outline' as const, label: 'Access', value: profile.operational.access },
  ];

  return <SafeAreaView style={styles.safeArea}>
    <StaffAppHeader hasUnreadAlerts={hasUnreadAlerts} mode="root" onOpenNotifications={onOpenNotifications} onOpenProfile={onOpenProfile} userName={profile.editable.fullName} />
    <View style={styles.contentArea}><View pointerEvents="none" style={styles.backdrop}><View style={styles.gridLine} /><View style={styles.circuit} /><Text style={styles.dots}>· · ·</Text></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.titleRow}><View><Text style={styles.screenTitle}>My Profile</Text><Text style={styles.screenSubtitle}>Your personal information and settings.</Text></View><Pressable accessibilityLabel="Edit profile" accessibilityRole="button" onPress={onEditProfile} style={styles.editButton}><Ionicons color={colors.blueBright} name="pencil-outline" size={18} /><Text style={styles.editText}>Edit Profile</Text></Pressable></View>{showSaveNotice ? <Pressable accessibilityLabel="Dismiss profile saved message" accessibilityRole="button" onPress={onDismissSaveNotice} style={styles.savedNotice}><Ionicons color={colors.completed} name="checkmark-circle-outline" size={18} /><Text style={styles.savedNoticeText}>Profile changes saved for this session only</Text><Ionicons color="#aab8ca" name="close" size={17} /></Pressable> : null}
      <View style={styles.summaryCard}><View style={styles.summaryAccent} /><View style={styles.summaryAvatar}><Text style={styles.summaryInitials}>{initials}</Text><View style={styles.summaryActiveDot} /></View><View style={styles.summaryCopy}><Text style={styles.name}>{profile.editable.fullName}</Text><Text style={styles.role}>{profile.operational.operationalRole}</Text><View style={styles.staffId}><Ionicons color="#aab8ca" name="shield-checkmark-outline" size={17} /><Text style={styles.staffIdText}>Staff ID: {profile.operational.staffId}</Text></View></View><View style={styles.summaryDivider} /><View style={styles.statusColumn}><View style={styles.statusRow}><Ionicons color={colors.completed} name="shield-checkmark-outline" size={23} /><View><Text style={styles.activeText}>{profile.employment.status}</Text><Text style={styles.statusLabel}>Employment Status</Text></View></View><View style={styles.statusRow}><Ionicons color={colors.blueBright} name="calendar-outline" size={23} /><View><Text style={styles.joinedText}>Joined</Text><Text style={styles.statusLabel}>{profile.employment.joined}</Text></View></View></View></View>
      <View style={styles.panel}><SectionTitle>CONTACT &amp; DETAILS</SectionTitle>{contactRows.map((row) => <DetailRow key={row.label} {...row} />)}</View>
      <View style={styles.twoColumn}><View style={[styles.panel, styles.halfPanel]}><SectionTitle>ROLE &amp; ACCESS</SectionTitle>{accessRows.map((row) => <View key={row.label} style={styles.accessRow}><Ionicons color={colors.blueBright} name={row.icon} size={20} /><View style={styles.accessCopy}><Text style={styles.accessLabel}>{row.label}</Text><Text style={styles.accessValue}>{row.value}</Text></View></View>)}</View><View style={[styles.panel, styles.halfPanel]}><SectionTitle>QUICK OVERVIEW</SectionTitle><View style={styles.overviewRow}><Ionicons color={colors.blueBright} name="clipboard-outline" size={23} /><Text style={styles.overviewValue}>{String(overview.duties).padStart(2, '0')}</Text><Text style={styles.overviewLabel}>Duties Today</Text></View><View style={styles.overviewRow}><Ionicons color={colors.completed} name="checkmark-circle-outline" size={23} /><Text style={styles.overviewValue}>{String(overview.completed).padStart(2, '0')}</Text><Text style={styles.overviewLabel}>Completed Today</Text></View><View style={styles.overviewRow}><Ionicons color={colors.blueBright} name="pulse-outline" size={23} /><Text style={styles.overviewValue}>{String(overview.inProgress).padStart(2, '0')}</Text><Text style={styles.overviewLabel}>In Progress</Text></View></View></View>
      <View style={styles.panel}><SectionTitle>SKILLS &amp; OPERATIONAL AREAS</SectionTitle>{profile.skills.map((skill) => <View key={skill} style={styles.skillRow}><Ionicons color={colors.blueBright} name="checkmark-circle-outline" size={21} /><Text style={styles.skillText}>{skill}</Text></View>)}</View>
      <View style={styles.note}><Ionicons color={colors.blueBright} name="information-circle-outline" size={25} /><Text style={styles.noteText}>Keep your profile information up to date to ensure accurate access and task allocation.</Text></View>
      <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={onSignOut} style={styles.signOutButton}><Ionicons color="#ff8a80" name="log-out-outline" size={19} /><Text style={styles.signOutText}>Sign Out</Text></Pressable>
    </ScrollView></View>
    <BottomNavigation activeTab="Profile" hasUnreadAlerts={hasUnreadAlerts} onNavigate={onNavigate} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  contentArea: { flex: 1 }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.9 }, gridLine: { backgroundColor: '#162c42', height: 1, left: 0, position: 'absolute', right: 0, top: 142 }, circuit: { borderColor: '#1c466c', borderRightWidth: 1, borderTopWidth: 1, height: 88, position: 'absolute', right: 0, top: 0, width: 88 }, dots: { color: colors.blueBright, fontSize: 14, letterSpacing: 5, opacity: 0.6, position: 'absolute', right: 17, top: 30 }, content: { padding: 14, paddingBottom: 30 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, screenTitle: { color: colors.text, fontSize: 28, fontWeight: '700' }, screenSubtitle: { color: '#a9b6c9', fontSize: 13, marginTop: 3 }, editButton: { alignItems: 'center', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 2, minHeight: 40, paddingHorizontal: 11 }, editText: { color: colors.blueBright, fontSize: 11, fontWeight: '600' },
  savedNotice: { alignItems: 'center', backgroundColor: '#073124', borderColor: colors.completed, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 7, marginTop: 12, minHeight: 40, paddingHorizontal: 11 }, savedNoticeText: { color: colors.completed, flex: 1, fontSize: 12, fontWeight: '600' },
  summaryCard: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#315270', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginTop: 18, minHeight: 146, overflow: 'hidden', padding: 13 }, summaryAccent: { backgroundColor: colors.blueBright, height: 1, position: 'absolute', right: 0, top: 0, width: 72 }, summaryAvatar: { alignItems: 'center', backgroundColor: '#173a5b', borderColor: colors.blueBright, borderRadius: 38, borderWidth: 2, height: 76, justifyContent: 'center', position: 'relative', width: 76 }, summaryInitials: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: 1 }, summaryActiveDot: { backgroundColor: colors.completed, borderColor: '#06111d', borderRadius: 8, borderWidth: 2, bottom: -1, height: 16, position: 'absolute', right: -1, width: 16 }, summaryCopy: { flex: 1, marginLeft: 12, minWidth: 0 }, name: { color: colors.text, fontSize: 21, fontWeight: '700' }, role: { color: colors.blueBright, fontSize: 14, marginTop: 3 }, staffId: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 12 }, staffIdText: { color: '#b5c0cf', fontSize: 11 }, summaryDivider: { alignSelf: 'stretch', backgroundColor: '#2c465e', marginHorizontal: 11, width: 1 }, statusColumn: { gap: 14, width: 113 }, statusRow: { alignItems: 'center', flexDirection: 'row', gap: 7 }, activeText: { color: colors.completed, fontSize: 14, fontWeight: '600' }, joinedText: { color: colors.blueBright, fontSize: 13 }, statusLabel: { color: '#b3bfce', fontSize: 10, marginTop: 2 },
  panel: { backgroundColor: '#06111d', borderColor: '#315270', borderRadius: 3, borderWidth: 1, marginTop: 14, overflow: 'hidden', padding: 13 }, sectionTitle: { color: colors.blueBright, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 9 }, detailRow: { alignItems: 'center', borderBottomColor: '#25415b', borderBottomWidth: 1, flexDirection: 'row', minHeight: 48 }, detailLabel: { color: '#b7c1d0', fontSize: 12, marginLeft: 10, width: 88 }, detailValue: { color: colors.text, flex: 1, fontSize: 12, textAlign: 'right' }, twoColumn: { flexDirection: 'row', gap: 10 }, halfPanel: { flex: 1, minWidth: 0 }, accessRow: { alignItems: 'flex-start', borderBottomColor: '#25415b', borderBottomWidth: 1, flexDirection: 'row', minHeight: 59, paddingVertical: 8 }, accessCopy: { flex: 1, marginLeft: 8, minWidth: 0 }, accessLabel: { color: '#aab8ca', fontSize: 10 }, accessValue: { color: colors.text, fontSize: 12, lineHeight: 16, marginTop: 3 }, overviewRow: { alignItems: 'center', borderBottomColor: '#25415b', borderBottomWidth: 1, flexDirection: 'row', minHeight: 59 }, overviewValue: { color: colors.text, fontSize: 22, fontWeight: '600', marginLeft: 7, width: 34 }, overviewLabel: { color: '#c0c9d7', flex: 1, fontSize: 11, lineHeight: 14 }, skillRow: { alignItems: 'center', flexDirection: 'row', minHeight: 31 }, skillText: { color: '#d0d7e2', fontSize: 13, marginLeft: 8 }, note: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#28516f', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 14, padding: 12 }, noteText: { color: '#bdc7d5', flex: 1, fontSize: 11, lineHeight: 16 }, signOutButton: { alignItems: 'center', borderColor: '#5a2a2a', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, minHeight: 48, paddingHorizontal: 12 }, signOutText: { color: '#ff8a80', fontSize: 13, fontWeight: '600' },
  feedbackOverlay: { alignItems: 'center', backgroundColor: 'rgba(0, 5, 11, 0.72)', flex: 1, justifyContent: 'center', padding: 24 }, feedbackPanel: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#315270', borderRadius: 4, borderWidth: 1, maxWidth: 340, padding: 22, width: '100%' }, feedbackTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 10 }, feedbackText: { color: '#bdc7d5', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' }, feedbackClose: { alignItems: 'center', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, justifyContent: 'center', marginTop: 18, minHeight: 40, paddingHorizontal: 22 }, feedbackCloseText: { color: colors.blueBright, fontSize: 13, fontWeight: '600' },
});
