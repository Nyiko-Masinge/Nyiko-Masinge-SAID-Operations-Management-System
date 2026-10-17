import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoEmployees } from '../data/demoEmployees';
import { demoLocations } from '../data/demoLocations';
import { initialDemoShifts } from '../data/demoTasks';
import { db, FIREBASE_CONFIGURED } from '../lib/firebase';
import { useLocations } from '../lib/useLocations';
import { taskStatusLabel } from '../lib/taskStatusDisplay';
import { useAuth } from './AuthProvider';
import type { Employee, TeamMember } from '../types/employees';
import type { Location } from '../types/locations';
import type { DemoStaffProfile } from '../types/profile';
import type { DemoShift, ShiftStatus } from '../types/tasks';
import { colors } from '../theme';
import { StaffAppHeader } from './StaffAppHeader';
import type { PublicationState } from '../lib/usePublishedRoster';

// Provisional raw-shift reads stay disabled. Stage 6B published tasks come from App.
const USE_LIVE_HOME_FIRESTORE = false;
/** Matches the hardcoded Home date ("Friday, 23 October 2026"), not the device clock. */
const HOME_SHIFT_DATE = '2026-10-23';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const statusVisual = {
  Completed: { accent: colors.completed, chip: 'Completed', icon: 'checkmark' },
  'In Progress': { accent: colors.blueBright, chip: 'In Progress', icon: 'pulse-outline' },
  Scheduled: { accent: colors.upcoming, chip: 'Scheduled', icon: 'hourglass-outline' },
  'Unable to Complete': { accent: colors.warning, chip: 'Unable to Complete', icon: 'warning-outline' },
} as const;

function getLocationName(locationId: string, locations: Location[]): string {
  return locations.find((loc) => loc.id === locationId)?.name || locationId;
}

function getEmployeeInitials(employeeId: string, employees: Employee[]): string {
  const employee = employees.find((emp) => emp.id === employeeId);
  return employee ? `${employee.firstName[0]}${employee.surname[0]}` : '??';
}

function mapFirestoreShift(id: string, data: Record<string, unknown>): DemoShift {
  const team = Array.isArray(data.team) ? (data.team as TeamMember[]) : [];
  const status = data.status as ShiftStatus;
  const endTime = typeof data.endTime === 'string' ? data.endTime : '';
  return {
    // Live identity is always the document path, never a fixture-shaped payload ID.
    id,
    title: typeof data.title === 'string' ? data.title : '',
    shiftDate: typeof data.shiftDate === 'string' ? data.shiftDate : '',
    startTime: typeof data.startTime === 'string' ? data.startTime : '',
    endTime,
    status,
    description: typeof data.description === 'string' ? data.description : '',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    locationId: typeof data.locationId === 'string' ? data.locationId : '',
    team,
    scheduledWorkId: typeof data.scheduledWorkId === 'string' ? data.scheduledWorkId : undefined,
    unableToCompleteReason: typeof data.unableToCompleteReason === 'string' ? data.unableToCompleteReason : undefined,
    isLive: true,
    taskId: '',
    priority: 'Normal',
    dueBy: endTime,
    estimatedDuration: '',
    checklist: [],
  };
}

function HomeBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <View style={[styles.gridH, { top: 90 }]} />
      <View style={[styles.gridH, { top: 300 }]} />
      <View style={[styles.gridV, { left: '23%' }]} />
      <View style={[styles.gridV, { right: '18%' }]} />
      <View style={styles.backdropCircuit} />
      <Text style={styles.backdropDots}>· · ·</Text>
    </View>
  );
}

function DailyStatus({ tasks }: { tasks: DemoShift[] }) {
  const totals = useMemo(() => ({
    Completed: tasks.filter((task) => task.status === 'Completed').length,
    'In Progress': tasks.filter((task) => task.status === 'In Progress').length,
    Scheduled: tasks.filter((task) => task.status === 'Scheduled').length,
    'Unable to Complete': tasks.filter((task) => task.status === 'Unable to Complete').length,
  }), [tasks]);

  const stats: Array<{ color: string; icon: IoniconName; label: string; value: number }> = [
    { label: 'Tasks Today', value: tasks.length, icon: 'briefcase-outline', color: colors.blueBright },
    { label: 'Completed', value: totals.Completed, icon: 'checkmark', color: colors.completed },
    { label: 'In Progress', value: totals['In Progress'], icon: 'pulse-outline', color: colors.blueBright },
    { label: 'Scheduled', value: totals.Scheduled, icon: 'hourglass-outline', color: colors.upcoming },
  ];

  return (
    <View accessibilityLabel={`Daily Status: ${tasks.length} tasks today, ${totals.Completed} completed, ${totals['In Progress']} in progress, ${totals.Scheduled} scheduled, ${totals['Unable to Complete']} unable to complete`} style={styles.statusPanel}>
      <View style={styles.statusTopAccent} />
      <Text style={styles.statusPanelTitle}>DAILY STATUS</Text>
      <View style={styles.statusRule} />
      <View style={styles.statusGrid}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[styles.stat, index % 2 === 0 && styles.statLeft, index < 2 && styles.statTop]}>
            <View style={[styles.statIcon, { borderColor: stat.color }]}><Ionicons color={stat.color} name={stat.icon} size={23} /></View>
            <View style={styles.statCopy}><Text style={styles.statValue}>{String(stat.value).padStart(2, '0')}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>
          </View>
        ))}
      </View>
    </View>
  );
}

function EmergencyCard({ onOpenEmergencyAlert }: { onOpenEmergencyAlert: () => void }) {
  return (
    <Pressable accessibilityLabel="Emergency: Assist Intake Ward. Open alert details." accessibilityRole="button" onPress={onOpenEmergencyAlert} style={({ pressed }) => [styles.emergency, pressed && styles.pressed]}>
      <View style={styles.emergencyIcon}><Ionicons color={colors.warning} name="warning-outline" size={31} style={styles.emergencyIconGlyph} /></View>
      <View style={styles.emergencyCopy}>
        <Text style={styles.emergencyTitle}>Emergency: Assist Intake Ward</Text>
        <Text style={styles.emergencyBody}>Immediate assistance required for critical arrival.{`\n`}Proceed to Intake Ward A immediately.</Text>
      </View>
      <Ionicons color={colors.warning} name="chevron-forward" size={28} />
    </Pressable>
  );
}

function AssignedTeam({ employees, team }: { employees: Employee[]; team: TeamMember[] }) {
  const members = team.slice(0, 4).map((member) => member.displayName?member.displayName.split(' ').filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase():getEmployeeInitials(member.employeeId, employees));
  const extraCount = Math.max(0, team.length - 4);

  return (
    <View accessibilityLabel={`Assigned team: ${members.join(', ')}${extraCount > 0 ? `, plus ${extraCount}` : ''}`} style={styles.team}>
      {members.map((initials, index) => <View key={initials} style={[styles.teamAvatar, { marginLeft: index === 0 ? 0 : -7 }]}><Text style={styles.teamInitials}>{initials}</Text></View>)}
      {extraCount > 0 && <View style={[styles.teamAvatar, styles.teamExtra]}><Text style={styles.teamInitials}>+{extraCount}</Text></View>}
    </View>
  );
}

function TaskCard({ employees, locations, locationName, onOpenTaskDetail, task }: { employees: Employee[]; locations: Location[]; locationName: (id: string) => string; onOpenTaskDetail: (taskId: string) => void; task: DemoShift }) {
  const visual = statusVisual[task.status];
  const statusLabel = task.publicationVersion ? taskStatusLabel(task.status) : visual.chip;
  const sharedLocation = locationName(task.locationId);
  const location = sharedLocation !== task.locationId || task.isLive ? sharedLocation : getLocationName(task.locationId, locations);
  const timeDisplay = `${task.startTime} - ${task.endTime}`;
  const handlePress = () => onOpenTaskDetail(task.id);
  const chipBackground = task.status === 'Completed' ? colors.completedDeep : task.status === 'Scheduled' ? colors.upcomingDeep : task.status === 'Unable to Complete' ? '#3d1214' : '#071d34';

  return (
    <Pressable accessibilityLabel={`${task.title}, ${statusLabel}${task.status === 'Unable to Complete' && task.unableToCompleteReason ? `, reason ${task.unableToCompleteReason}` : ''}. Tap for prototype task detail feedback.`} accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}>
      <View style={[styles.taskAccent, { backgroundColor: visual.accent }]} />
      <View style={[styles.taskIcon, { borderColor: visual.accent }]}><Ionicons color={visual.accent} name={visual.icon} size={27} /></View>
      <View style={styles.taskDivider} />
      <View style={styles.taskContent}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={[styles.statusChip, { borderColor: visual.accent, backgroundColor: chipBackground }]}><Text style={[styles.statusChipText, { color: visual.accent }]}>{statusLabel}</Text></View>
        </View>
        <View style={styles.taskMeta}>
          <View style={styles.metaItem}><Ionicons color="#aab8ca" name="time-outline" size={15} /><Text style={styles.taskMetaText}>{timeDisplay}</Text></View>
          {task.status === 'In Progress' ? <Text style={styles.current}>(Current)</Text> : null}
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}><Ionicons color="#aab8ca" name="location-outline" size={15} /><Text style={styles.taskMetaText}>{location}</Text></View>
        </View>
        {task.status === 'In Progress' ? <AssignedTeam employees={employees} team={task.team} /> : null}
        {task.status === 'Unable to Complete' && task.unableToCompleteReason ? <Text style={styles.taskReason}>{task.unableToCompleteReason}</Text> : null}
        {task.note ? <Text style={styles.taskNote}>{task.note}</Text> : null}
      </View>
      <Ionicons color="#b8c8dc" name="chevron-forward" size={25} style={styles.taskArrow} />
    </Pressable>
  );
}

export type MainNavigationTab = 'Home' | 'Roster' | 'Alerts' | 'Profile';

type BottomNavigationProps = {
  activeTab?: MainNavigationTab;
  hasUnreadAlerts?: boolean;
  onNavigate?: (tab: MainNavigationTab) => void;
};

export function BottomNavigation({ activeTab = 'Home', hasUnreadAlerts = false, onNavigate }: BottomNavigationProps) {
  const items = [
    { label: 'Home', icon: 'home-outline', active: activeTab === 'Home' },
    { label: 'Roster', icon: 'clipboard-outline', active: activeTab === 'Roster' },
    { label: 'Alerts', icon: 'warning-outline', active: activeTab === 'Alerts' },
    { label: 'Profile', icon: 'person-outline', active: activeTab === 'Profile' },
  ] satisfies Array<{ active: boolean; icon: IoniconName; label: string }>;
  const onPress = (label: string) => {
    if (label === 'Home' || label === 'Roster' || label === 'Alerts' || label === 'Profile') {
      onNavigate?.(label);
      return;
    }
    Alert.alert('Task 1 prototype', `${label} is part of the prototype but is not implemented in this milestone.`);
  };
  return (
    <View accessibilityRole="tablist" style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable accessibilityLabel={item.active ? `${item.label}, current tab` : item.label} accessibilityRole="tab" accessibilityState={{ selected: item.active }} key={item.label} onPress={() => onPress(item.label)} style={({ pressed }) => [styles.navItem, item.active && styles.navItemActive, pressed && styles.pressed]}>
          <View>{item.label === 'Alerts' && hasUnreadAlerts ? <View style={styles.navUnreadDot} /> : null}<Ionicons color={item.active ? colors.blueBright : '#9aa8bc'} name={item.icon} size={25} /></View>
          <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function StaffHomeScreen({ hasUnreadAlerts, onNavigate, onOpenAlerts, onOpenEmergencyAlert, onOpenProfile, onOpenRoster, onOpenTaskDetail, profile, tasks: tasksFromProps, publicationState }: StaffHomeScreenProps) {
  const { locationName, error: locationsError, retry: retryLocations } = useLocations();
  const { tasks, employees, locations, loading, error } = useHomeLiveData(tasksFromProps);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StaffAppHeader hasUnreadAlerts={hasUnreadAlerts} mode="root" onOpenNotifications={onOpenAlerts} onOpenProfile={onOpenProfile} userName={profile.editable.fullName} />
      <View style={styles.contentArea}>
        <HomeBackdrop />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeBlock}>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.name}>{profile.editable.fullName}</Text>
            <View style={styles.identityMeta}><Ionicons color={colors.blueBright} name="shield-checkmark-outline" size={18} /><Text style={styles.role}>{profile.operational.operationalRole}</Text></View>
            <View style={styles.identityRule} />
            <View style={styles.identityMeta}><Ionicons color="#a7b2c4" name="calendar-outline" size={17} /><Text style={styles.date}>{publicationState?'Current published roster':'Friday, 23 October 2026'}</Text></View>
          </View>
          <Text style={styles.demoBanner}>{publicationState?'Published duties · Saved task progress':'DEMO FIXTURE | Live published roster is disabled'}</Text>
          {publicationState?.status==='LOADING' && <Text style={styles.taskMetaText}>Loading published duties…</Text>}
          {publicationState?.status==='ERROR' && <Text accessibilityRole="alert" style={styles.taskReason}>{publicationState.error} Open Roster to retry.</Text>}
          {publicationState?.status==='EMPTY' && <Text style={styles.taskMetaText}>No published duties assigned this week.</Text>}
        {locationsError && <View style={styles.locationsErrorBanner}><Text accessibilityRole="alert" style={styles.locationsErrorText}>Unable to load operational areas.</Text><Pressable accessibilityLabel="Retry operational areas" accessibilityRole="button" onPress={retryLocations} style={styles.locationsRetry}><Text style={styles.locationsErrorText}>Retry</Text></Pressable></View>}
          <DailyStatus tasks={tasks} />
          <EmergencyCard onOpenEmergencyAlert={onOpenEmergencyAlert} />
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{publicationState?'Published Duties This Week':'My Tasks Today'}</Text><View style={styles.sectionLine} /><Pressable accessibilityLabel="View today's roster" accessibilityRole="button" onPress={onOpenRoster} style={styles.rosterShortcut}><Text style={styles.rosterShortcutText}>View Roster</Text><Ionicons color={colors.blueBright} name="chevron-forward" size={15} /></Pressable></View>
          {loading ? (
            <Text style={styles.taskMetaText}>Loading tasks…</Text>
          ) : error ? (
            <Text style={styles.taskReason}>Could not load live tasks: {error}</Text>
          ) : (
            tasks.map((task) => <TaskCard employees={employees} key={task.id} locationName={locationName} locations={locations} onOpenTaskDetail={onOpenTaskDetail} task={task} />)
          )}
        </ScrollView>
      </View>
      <BottomNavigation hasUnreadAlerts={hasUnreadAlerts} onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

function useHomeLiveData(tasksFromProps: DemoShift[]) {
  const { user, status } = useAuth();
  const uid = user?.uid;
  const [liveShifts, setLiveShifts] = useState<DemoShift[] | null>(null);
  const [liveEmployees, setLiveEmployees] = useState<Employee[] | null>(null);
  const [liveLocations, setLiveLocations] = useState<Location[] | null>(null);
  const [loading, setLoading] = useState(USE_LIVE_HOME_FIRESTORE && FIREBASE_CONFIGURED && !!db);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_LIVE_HOME_FIRESTORE || status !== 'signedIn' || !uid) return;
    let cancelled = false;

    async function load() {
      if (!FIREBASE_CONFIGURED || !db) return;
      const liveDb = db;
      try {
        setLoading(true);
        setError(null);

        const [employeesSnap, locationsSnap, shiftsSnap] = await Promise.all([
          getDocs(collection(liveDb, 'employees')),
          getDocs(collection(liveDb, 'locations')),
          getDocs(query(collection(liveDb, 'shifts'), where('shiftDate', '==', HOME_SHIFT_DATE))),
        ]);

        if (cancelled) return;

        const employeesData = employeesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Employee));
        const locationsData = locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Location));
        const shiftsData = shiftsSnap.docs
          .map((doc) => mapFirestoreShift(doc.id, doc.data()))
          .filter((shift) => shift.team.some((member) => member.employeeId === uid));

        setLiveEmployees(employeesData);
        setLiveLocations(locationsData);
        setLiveShifts(shiftsData);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load live Home data from Firestore', err);
          setError(err instanceof Error ? err.message : 'Unknown error loading Firestore data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [status, uid]);

  if (!USE_LIVE_HOME_FIRESTORE) {
    return { tasks: tasksFromProps, employees: demoEmployees, locations: demoLocations, loading: false, error: null };
  }

  return {
    tasks: liveShifts ?? [],
    employees: liveEmployees ?? [],
    locations: liveLocations ?? [],
    loading,
    error,
  };
}

type StaffHomeScreenProps = {
  hasUnreadAlerts: boolean;
  onNavigate?: (tab: MainNavigationTab) => void;
  onOpenAlerts: () => void;
  onOpenEmergencyAlert: () => void;
  onOpenProfile: () => void;
  onOpenRoster: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  profile: DemoStaffProfile;
  tasks: DemoShift[];
  publicationState?: PublicationState;
};


const styles = StyleSheet.create({
  locationsErrorBanner: { alignItems: 'center', backgroundColor: '#231017', borderColor: '#702b34', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 },
  locationsErrorText: { color: '#ff8f91', flex: 1, fontSize: 12 },
  locationsRetry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  contentArea: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.9 },
  gridH: { backgroundColor: '#12243a', height: 1, left: 0, opacity: 0.55, position: 'absolute', right: 0 },
  gridV: { backgroundColor: '#11233a', bottom: 0, opacity: 0.32, position: 'absolute', top: 0, width: 1 },
  backdropCircuit: { borderColor: '#1c466c', borderRightWidth: 1, borderTopWidth: 1, height: 72, position: 'absolute', right: 0, top: 0, width: 90 },
  backdropDots: { color: colors.blueBright, fontSize: 15, letterSpacing: 5, opacity: 0.6, position: 'absolute', right: 20, top: 34 },
  content: { padding: 16, paddingBottom: 28 },
  welcomeBlock: { backgroundColor: '#030c16', borderBottomColor: '#183956', borderBottomWidth: 1, minWidth: 0, paddingBottom: 15, paddingHorizontal: 4, paddingTop: 6 },
  welcome: { color: '#a9b6ca', fontSize: 14 },
  demoBanner: { color: '#a9b6ca', fontSize: 10, marginTop: 12 },
  name: { color: colors.text, fontSize: 27, fontWeight: '700', marginTop: 4 },
  identityMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 9 },
  role: { color: colors.blueBright, fontSize: 14 },
  identityRule: { backgroundColor: colors.blue, height: 1, marginTop: 13, width: '100%' },
  date: { color: '#a7b2c4', fontSize: 12 },
  statusPanel: { backgroundColor: '#07131f', borderColor: '#315270', borderRadius: 3, borderWidth: 1, marginTop: 16, minHeight: 214, overflow: 'hidden', padding: 15, width: '100%' },
  statusTopAccent: { backgroundColor: colors.blueBright, height: 1, position: 'absolute', right: 0, top: 0, width: 76 },
  statusPanelTitle: { color: colors.blueBright, fontSize: 12, letterSpacing: 1.6 },
  statusRule: { backgroundColor: '#27445e', height: 1, marginTop: 10 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  stat: { alignItems: 'center', flexDirection: 'row', minHeight: 77, paddingHorizontal: 13, width: '50%' },
  statLeft: { borderRightColor: '#24415b', borderRightWidth: 1, paddingLeft: 3 },
  statTop: { borderBottomColor: '#24415b', borderBottomWidth: 1 },
  statIcon: { alignItems: 'center', borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', marginRight: 12, width: 46 },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { color: colors.text, fontSize: 27, fontWeight: '600', lineHeight: 30 },
  statLabel: { color: '#c0c8d6', fontSize: 12, marginTop: 2 },
  emergency: { alignItems: 'center', backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginTop: 18, minHeight: 112, overflow: 'hidden', paddingHorizontal: 16, shadowColor: colors.warning, shadowOpacity: 0.24, shadowRadius: 10 },
  pressed: { opacity: 0.82 },
  emergencyIcon: { alignItems: 'center', borderColor: colors.warning, borderRadius: 26, borderWidth: 2, height: 54, justifyContent: 'center', marginRight: 14, transform: [{ rotate: '30deg' }], width: 54 },
  emergencyIconGlyph: { transform: [{ rotate: '-30deg' }] },
  emergencyCopy: { flex: 1, minWidth: 0 },
  emergencyTitle: { color: colors.warning, fontSize: 16, fontWeight: '700' },
  emergencyBody: { color: '#d6d9df', fontSize: 12, lineHeight: 18, marginTop: 6 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 12, marginTop: 28 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '600' },
  sectionLine: { backgroundColor: '#245379', flex: 1, height: 1, marginLeft: 12 },
  rosterShortcut: { alignItems: 'center', flexDirection: 'row', gap: 2, marginLeft: 9, minHeight: 48, paddingHorizontal: 6 }, rosterShortcutText: { color: colors.blueBright, fontSize: 11, fontWeight: '600' },
  taskCard: { backgroundColor: '#06111d', borderColor: '#32465a', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginBottom: 12, minHeight: 108, overflow: 'hidden', padding: 12 },
  taskAccent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  taskIcon: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', marginRight: 10, marginTop: 1, width: 46 },
  taskDivider: { alignSelf: 'stretch', backgroundColor: '#28445e', marginRight: 10, width: 1 },
  taskContent: { flex: 1, minWidth: 0, paddingRight: 8 },
  taskTitleRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  taskTitle: { color: colors.text, flex: 1, flexShrink: 1, fontSize: 16, fontWeight: '600', lineHeight: 21, paddingRight: 7 },
  statusChip: { borderRadius: 13, borderWidth: 1, flexShrink: 0, marginTop: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText: { fontSize: 10, fontWeight: '600' },
  taskMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', marginTop: 7, rowGap: 3 },
  metaItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  taskMetaText: { color: '#aab8ca', fontSize: 12 },
  metaDivider: { backgroundColor: '#597089', height: 15, marginHorizontal: 8, width: 1 },
  current: { color: colors.blueBright, fontSize: 12, marginLeft: 7 },
  team: { alignItems: 'center', flexDirection: 'row', marginTop: 10 },
  teamAvatar: { alignItems: 'center', backgroundColor: '#244a70', borderColor: '#a8c7e5', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  teamExtra: { backgroundColor: '#0c1b2c', marginLeft: 5 },
  teamInitials: { color: colors.text, fontSize: 8, fontWeight: '700' },
  taskNote: { color: '#aab8ca', fontSize: 12, lineHeight: 17, marginTop: 8 },
  taskReason: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: 8 },
  taskArrow: { alignSelf: 'center' },
  bottomNav: { backgroundColor: '#030b14', borderTopColor: '#29455f', borderTopWidth: 1, flexDirection: 'row', minHeight: 76, paddingHorizontal: 8 },
  navItem: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 70 },
  navItemActive: { borderColor: colors.blueBright, borderTopWidth: 2 },
  navLabel: { color: '#9aa8bc', fontSize: 11, marginTop: 3 },
  navLabelActive: { color: colors.blueBright },
  navUnreadDot: { backgroundColor: colors.warning, borderRadius: 5, height: 10, position: 'absolute', right: -5, top: -2, width: 10, zIndex: 1 },
});
