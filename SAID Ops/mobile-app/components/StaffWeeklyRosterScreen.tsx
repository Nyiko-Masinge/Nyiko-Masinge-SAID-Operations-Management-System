import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoLocations } from '../data/demoLocations';
import { useLocations } from '../lib/useLocations';
import { taskStatusLabel } from '../lib/taskStatusDisplay';
import { demoRosterWeeks } from '../data/demoRoster';
import { colors } from '../theme';
import type { DemoShift } from '../types/tasks';
import type { DemoStaffProfile } from '../types/profile';
import type { RosterDay, RosterDuty, RosterDutyStatus } from '../types/roster';
import { BottomNavigation, type MainNavigationTab } from './StaffHomeScreen';
import { StaffAppHeader } from './StaffAppHeader';
import { localDate, rosterWeek, shiftWeek, weekFor } from '../lib/publishedRoster';
import type { PublicationState } from '../lib/usePublishedRoster';

type StaffWeeklyRosterScreenProps = {
  initialView: 'day' | 'week';
  hasUnreadAlerts: boolean;
  profile: DemoStaffProfile;
  onNavigate: (tab: MainNavigationTab) => void;
  onOpenAlerts: () => void;
  onOpenProfile: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  tasks: DemoShift[];
  publication?:{state:PublicationState;weekStart:string;onWeekChange:(week:string)=>void;retry:()=>void;history?:boolean;onHistoryChange?:(value:boolean)=>void};
};

type RosterViewMode = 'day' | 'week';

const statusVisual = {
  Completed: { color: colors.completed, icon: 'checkmark-circle-outline', label: 'Completed' },
  'In Progress': { color: colors.blueBright, icon: 'pulse-outline', label: 'In Progress' },
  Scheduled: { color: colors.blueBright, icon: 'calendar-outline', label: 'Scheduled' },
  'Unable to Complete': { color: colors.warning, icon: 'warning-outline', label: 'Unable to Complete' },
} as const;

// Published duties/tasks match by authoritative scheduledWorkId.
// The tuple fallback is retained only for fixture/legacy pairs with neither ID.
function rosterIdentityMatch(duty: RosterDuty, task: DemoShift): boolean {
  const dutyHasSharedId = Boolean(duty.scheduledWorkId);
  const taskHasSharedId = Boolean(task.scheduledWorkId);
  if (dutyHasSharedId || taskHasSharedId) {
    return dutyHasSharedId && taskHasSharedId && duty.scheduledWorkId === task.scheduledWorkId;
  }
  return duty.title === task.title && duty.shiftDate === task.shiftDate && duty.startTime === task.startTime;
}

function resolveDuty(duty: RosterDuty, tasks: DemoShift[]): RosterDuty & { unableToCompleteReason?: string } {
  const match = tasks.find((task) => rosterIdentityMatch(duty, task));
  if (!match) return duty;
  return { ...duty, id: match.id, status: match.status, unableToCompleteReason: match.unableToCompleteReason };
}

function DutyCard({ duty, locationName, onOpenTaskDetail, tasks }: { duty: RosterDuty; locationName: (id: string) => string; onOpenTaskDetail: (taskId: string) => void; tasks: DemoShift[] }) {
  const resolved = resolveDuty(duty, tasks);
  const visual = statusVisual[resolved.status as RosterDutyStatus];
  const sharedLocation = locationName(resolved.locationId);
  const matchedTask = tasks.find((task) => rosterIdentityMatch(duty, task));
  const statusLabel = matchedTask?.publicationVersion ? taskStatusLabel(matchedTask.status) : visual.label;
  const location = sharedLocation !== resolved.locationId || matchedTask?.isLive || matchedTask?.publicationVersion ? sharedLocation : demoLocations.find((loc) => loc.id === resolved.locationId)?.name ?? sharedLocation;
  const timeDisplay = `${resolved.startTime} - ${resolved.endTime}`;
  const liveTask = tasks.some((task) => task.id === resolved.id);
  const handlePress = () => {
    if (liveTask) {
      onOpenTaskDetail(resolved.id);
      return;
    }
    Alert.alert('Task 1 prototype', `${resolved.title}\n\n${timeDisplay} • ${location}\n${visual.label}`);
  };
  return <Pressable accessibilityLabel={`${resolved.title}, ${statusLabel}${resolved.status === 'Unable to Complete' && resolved.unableToCompleteReason ? `, reason ${resolved.unableToCompleteReason}` : ''}. Show duty information.`} accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.dutyCard, pressed && styles.pressed]}>
    <View style={[styles.dutyAccent, { backgroundColor: visual.color }]} />
    <View style={styles.dutyMeta}><Text style={styles.dutyTime}>{timeDisplay}</Text><View style={styles.locationRow}><Ionicons color="#aab8ca" name="location-outline" size={15} /><Text style={styles.location}>{location}</Text></View></View>
    <View style={styles.dutyDivider} />
    <View style={styles.dutyCopy}><Text style={styles.dutyTitle}>{resolved.title}</Text><View style={[styles.statusChip, { borderColor: visual.color }]}><Ionicons color={visual.color} name={visual.icon} size={15} /><Text style={[styles.statusText, { color: visual.color }]}>{statusLabel}</Text></View>{resolved.status === 'Unable to Complete' && resolved.unableToCompleteReason ? <Text numberOfLines={2} style={styles.dutyReason}>{resolved.unableToCompleteReason}</Text> : null}</View>
    <Ionicons color="#b8c8dc" name="chevron-forward" size={24} />
  </Pressable>;
}

function DaySection({ day, locationName, onOpenTaskDetail, tasks }: { day: RosterDay; locationName: (id: string) => string; onOpenTaskDetail: (taskId: string) => void; tasks: DemoShift[] }) {
  if (day.isDayOff) return <View style={[styles.daySection, styles.dayOff]}><View style={styles.dayDate}><Text style={styles.dayNameOff}>{day.day}</Text><Text style={styles.dayNumberOff}>{day.date}</Text></View><View style={styles.dayDivider} /><Ionicons color="#b4bfce" name="calendar-outline" size={24} /><View style={styles.dayOffCopy}><Text style={styles.dayOffTitle}>No duties assigned</Text><Text style={styles.dayOffText}>Enjoy your rest day.</Text></View><View style={styles.dayOffChip}><Ionicons color="#b4bfce" name="home-outline" size={17} /><Text style={styles.dayOffChipText}>Day Off</Text></View></View>;
  return <View style={styles.dayBlock}><View style={styles.dayBlockHeader}><Text style={styles.dayBlockTitle}>{day.day} {day.date}</Text><View style={styles.dayBlockLine} /></View>{day.duties.map((duty) => <DutyCard duty={duty} key={duty.id} locationName={locationName} onOpenTaskDetail={onOpenTaskDetail} tasks={tasks} />)}</View>;
}

export function StaffWeeklyRosterScreen({ hasUnreadAlerts, initialView, onNavigate, onOpenAlerts, onOpenProfile, onOpenTaskDetail, profile, tasks, publication }: StaffWeeklyRosterScreenProps) {
  const { locationName, error: locationsError, retry: retryLocations } = useLocations();
  const [weekIndex, setWeekIndex] = useState(0);
  const [viewMode, setViewMode] = useState<RosterViewMode>(initialView);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(initialView === 'day' ? (publication?localDate(new Date()):'fri-23') : null);
  const week = publication?rosterWeek(publication.weekStart,tasks):demoRosterWeeks[weekIndex];
  const visibleDays = useMemo(() => viewMode === 'day' ? week.days.filter((day) => day.id === selectedDayId) : week.days, [selectedDayId, viewMode, week]);
  const changeWeek = (direction: -1 | 1) => {
    if(publication){const next=shiftWeek(publication.weekStart,direction*7);publication.onWeekChange(next);setSelectedDayId(viewMode==='day'?next:null);return;}
    const nextIndex = Math.max(0, Math.min(demoRosterWeeks.length - 1, weekIndex + direction));
    setWeekIndex(nextIndex);
    setSelectedDayId(viewMode === 'day' ? demoRosterWeeks[nextIndex].days[0].id : null);
  };
  const selectDay = (dayId: string) => {
    setSelectedDayId(dayId);
    setViewMode('day');
  };
  const selectView = (mode: RosterViewMode) => {
    setViewMode(mode);
    if (mode === 'week') setSelectedDayId(null);
    else if (!selectedDayId) setSelectedDayId(publication?week.days[0].id:weekIndex === 0 ? 'fri-23' : week.days[0].id);
  };
  const showToday = () => {
    if(publication){publication.onWeekChange(weekFor());setSelectedDayId(localDate(new Date()));setViewMode('day');return;}
    setWeekIndex(0);
    setSelectedDayId('fri-23');
    setViewMode('day');
  };
  return <SafeAreaView style={styles.safeArea}>
    <StaffAppHeader hasUnreadAlerts={hasUnreadAlerts} mode="root" onOpenNotifications={onOpenAlerts} onOpenProfile={onOpenProfile} userName={profile.editable.fullName} />
    <View style={styles.contentArea}>
      <View pointerEvents="none" style={styles.backdrop}><View style={styles.gridLine} /><View style={styles.circuit} /><Text style={styles.dots}>· · ·</Text></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {locationsError && <View style={styles.locationsErrorBanner}><Text accessibilityRole="alert" style={styles.locationsErrorText}>Unable to load operational areas.</Text><Pressable accessibilityLabel="Retry operational areas" accessibilityRole="button" onPress={retryLocations} style={styles.locationsRetry}><Text style={styles.locationsErrorText}>Retry</Text></Pressable></View>}
        <View style={styles.titleRow}><View><Text style={styles.screenTitle}>Weekly Roster</Text><Text style={styles.screenSubtitle}>Your scheduled duties for the week.</Text></View><View style={styles.weekSelector}><Pressable accessibilityLabel="Previous week" accessibilityRole="button" disabled={!publication && weekIndex === 0} onPress={() => changeWeek(-1)} style={styles.weekArrow}><Ionicons color={!publication && weekIndex === 0 ? '#52657b' : colors.text} name="chevron-back" size={21} /></Pressable><Text style={styles.weekRange}>{week.range}</Text><Pressable accessibilityLabel="Next week" accessibilityRole="button" disabled={!publication && weekIndex === demoRosterWeeks.length - 1} onPress={() => changeWeek(1)} style={styles.weekArrow}><Ionicons color={!publication && weekIndex === demoRosterWeeks.length - 1 ? '#52657b' : colors.text} name="chevron-forward" size={21} /></Pressable></View></View>
        <Text style={styles.demoBanner}>{publication?(publication.state.archived?'Archived roster · Read-only history':'Current published roster · Saved task progress'):'DEMO FIXTURE | Local roster'}</Text>
        {publication?.onHistoryChange&&<Pressable accessibilityRole="button" accessibilityLabel={publication.history?'Show active rosters':'Include archived rosters'} onPress={()=>publication.onHistoryChange?.(!publication.history)}><Text style={styles.syncText}>{publication.history?'Show active rosters':'Include archived rosters'}</Text></Pressable>}
        {publication?.state.status==='LOADING' && <Text accessibilityRole="text" style={styles.infoText}>Loading published roster…</Text>}
        {publication?.state.status==='ERROR' && <View><Text accessibilityRole="alert" style={styles.locationsErrorText}>{publication.state.error}</Text><Pressable onPress={publication.retry}><Text style={styles.syncText}>Retry roster</Text></Pressable></View>}
        {publication?.state.status==='EMPTY' && <Text style={styles.infoText}>No published duties assigned to you this week.</Text>}
        <View style={styles.dayStrip}>{week.days.map((day) => { const active = viewMode === 'day' && selectedDayId === day.id; const today = publication?day.id===localDate(new Date()):weekIndex === 0 && day.id === 'fri-23'; return <Pressable accessibilityLabel={`${day.day} ${day.date}${active ? ', selected' : ''}${today ? ', today' : ''}`} accessibilityRole="button" key={day.id} onPress={() => selectDay(day.id)} style={[styles.dayButton, day.isDayOff && styles.dayButtonOff, !active && today && styles.dayButtonToday, active && styles.dayButtonActive]}><Text style={[styles.stripDay, day.isDayOff && styles.stripDayOff, (active || today) && styles.stripDayActive]}>{day.day}</Text><Text style={[styles.stripDate, day.isDayOff && styles.stripDateOff, active && styles.stripDateActive]}>{day.date}</Text>{today ? <View style={styles.todayDot} /> : null}</Pressable>; })}</View>
        <View style={styles.viewControls}><View accessibilityLabel={`Roster view: ${viewMode}`} accessibilityRole="tablist" style={styles.segmentedControl}><Pressable accessibilityLabel="Day view" accessibilityRole="tab" accessibilityState={{ selected: viewMode === 'day' }} onPress={() => selectView('day')} style={[styles.segment, viewMode === 'day' && styles.segmentActive]}><Text style={[styles.segmentText, viewMode === 'day' && styles.segmentTextActive]}>DAY</Text></Pressable><Pressable accessibilityLabel="Week view" accessibilityRole="tab" accessibilityState={{ selected: viewMode === 'week' }} onPress={() => selectView('week')} style={[styles.segment, viewMode === 'week' && styles.segmentActive]}><Text style={[styles.segmentText, viewMode === 'week' && styles.segmentTextActive]}>WEEK</Text></Pressable></View><Pressable accessibilityLabel={publication?'Show today':'Show today, Friday 23 October 2026'} accessibilityRole="button" onPress={showToday} style={styles.todayButton}><Ionicons color={colors.blueBright} name="locate-outline" size={16} /><Text style={styles.todayButtonText}>Today</Text></Pressable></View>
        <View style={styles.legendRow}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.blueBright }]} /><Text style={styles.legendText}>Scheduled</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.completed }]} /><Text style={styles.legendText}>Completed</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.blueBright }]} /><Text style={styles.legendText}>In Progress</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.warning }]} /><Text style={styles.legendText}>Unable to Complete</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#a6b0be' }]} /><Text style={styles.legendText}>Day Off</Text></View></View>
        {(!publication||publication.state.status==='DATA')&&visibleDays.map((day) => <DaySection day={day} key={day.id} locationName={locationName} onOpenTaskDetail={onOpenTaskDetail} tasks={tasks} />)}
        <View style={styles.infoPanel}><Ionicons color={colors.blueBright} name="information-circle-outline" size={27} /><Text style={styles.infoText}>Rosters are subject to change. Please check daily for updates.</Text><Pressable accessibilityLabel="Sync roster now" accessibilityRole="button" onPress={() => publication?publication.retry():Alert.alert('Task 1 prototype', 'Roster sync is not available in this local prototype.')} style={styles.syncButton}><Ionicons color={colors.blueBright} name="sync-outline" size={20} /><Text style={styles.syncText}>Sync Now</Text></Pressable></View>
      </ScrollView>
    </View>
    <BottomNavigation activeTab="Roster" hasUnreadAlerts={hasUnreadAlerts} onNavigate={onNavigate} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  locationsErrorBanner: { alignItems: 'center', backgroundColor: '#231017', borderColor: '#702b34', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 14, paddingHorizontal: 12 },
  locationsErrorText: { color: '#ff8f91', flexShrink: 1, fontSize: 12 },
  locationsRetry: { justifyContent: 'center', marginLeft: 'auto', minHeight: 44, paddingHorizontal: 8 },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  contentArea: { flex: 1 }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.88 }, gridLine: { backgroundColor: '#162c42', height: 1, left: 0, position: 'absolute', right: 0, top: 150 }, circuit: { borderColor: '#1c466c', borderRightWidth: 1, borderTopWidth: 1, height: 88, position: 'absolute', right: 0, top: 0, width: 88 }, dots: { color: colors.blueBright, fontSize: 14, letterSpacing: 5, opacity: 0.6, position: 'absolute', right: 17, top: 30 }, content: { padding: 14, paddingBottom: 28 },
  titleRow: { gap: 12 }, screenTitle: { color: colors.text, fontSize: 27, fontWeight: '700' }, screenSubtitle: { color: '#a9b6c9', fontSize: 13, marginTop: 3 }, demoBanner: { color: '#a9b6c9', fontSize: 10, marginTop: 8 }, weekSelector: { alignItems: 'center', backgroundColor: '#06121f', borderColor: '#245276', borderRadius: 3, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 }, weekArrow: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 }, weekRange: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  dayStrip: { borderColor: '#31485f', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginTop: 15, overflow: 'hidden' }, dayButton: { alignItems: 'center', borderRightColor: '#273d52', borderRightWidth: 1, flex: 1, minHeight: 72, paddingTop: 10, position: 'relative' }, dayButtonActive: { backgroundColor: '#071b30', borderColor: colors.blueBright, borderWidth: 1, margin: -1 }, dayButtonToday: { backgroundColor: '#061523' }, dayButtonOff: { backgroundColor: '#080c13' }, stripDay: { color: '#a9b5c6', fontSize: 9, fontWeight: '600' }, stripDayOff: { color: colors.upcoming }, stripDayActive: { color: colors.blueBright }, stripDate: { color: '#d3d9e4', fontSize: 22, fontWeight: '300', marginTop: 4 }, stripDateOff: { color: colors.upcoming }, stripDateActive: { color: colors.text }, todayDot: { backgroundColor: colors.blueBright, borderRadius: 3, bottom: 5, height: 5, position: 'absolute', width: 5 },
  viewControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, segmentedControl: { backgroundColor: '#06111d', borderColor: '#285a84', borderRadius: 3, borderWidth: 1, flexDirection: 'row', minHeight: 48, overflow: 'hidden', width: 180 }, segment: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48 }, segmentActive: { backgroundColor: '#0b4f85' }, segmentText: { color: '#9dacbf', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }, segmentTextActive: { color: colors.text }, todayButton: { alignItems: 'center', borderColor: '#285a84', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 48, paddingHorizontal: 14 }, todayButtonText: { color: colors.blueBright, fontSize: 11, fontWeight: '600' },
  legendRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 14 }, legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 }, legendDot: { borderRadius: 5, height: 9, width: 9 }, legendText: { color: '#bbc4d1', fontSize: 10 },
  dayBlock: { marginBottom: 12 }, dayBlockHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 7 }, dayBlockTitle: { color: colors.blueBright, fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }, dayBlockLine: { backgroundColor: '#254765', flex: 1, height: 1, marginLeft: 9 }, dutyCard: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#32465a', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 79, overflow: 'hidden', padding: 11 }, pressed: { opacity: 0.8 }, dutyAccent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 }, dutyMeta: { width: 92 }, dutyTime: { color: '#d0d7e2', fontSize: 11, fontWeight: '600' }, locationRow: { alignItems: 'center', flexDirection: 'row', gap: 3, marginTop: 7 }, location: { color: '#9dacbf', flex: 1, fontSize: 10 }, dutyDivider: { backgroundColor: '#29445e', alignSelf: 'stretch', marginHorizontal: 9, width: 1 }, dutyCopy: { flex: 1, minWidth: 0 }, dutyTitle: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 19 }, statusChip: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 4, marginTop: 6, paddingHorizontal: 7, paddingVertical: 3 }, statusText: { fontSize: 10, fontWeight: '600' }, dutyReason: { color: colors.warning, fontSize: 10, lineHeight: 14, marginTop: 6 },
  daySection: { alignItems: 'center', backgroundColor: '#08111c', borderColor: '#536171', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginBottom: 12, minHeight: 90, padding: 12 }, dayOff: { backgroundColor: '#0a0d13' }, dayDate: { alignItems: 'center', width: 50 }, dayNameOff: { color: colors.upcoming, fontSize: 12, fontWeight: '700' }, dayNumberOff: { color: colors.upcoming, fontSize: 22, fontWeight: '300', marginTop: 3 }, dayDivider: { backgroundColor: '#3a4655', alignSelf: 'stretch', marginHorizontal: 9, width: 1 }, dayOffCopy: { flex: 1, marginLeft: 9 }, dayOffTitle: { color: '#d0d6df', fontSize: 14 }, dayOffText: { color: '#a7b1c0', fontSize: 12, marginTop: 4 }, dayOffChip: { alignItems: 'center', borderColor: '#697485', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 4, marginLeft: 6, paddingHorizontal: 7, paddingVertical: 4 }, dayOffChipText: { color: '#b4bfce', fontSize: 10 },
  infoPanel: { alignItems: 'center', backgroundColor: '#06111d', borderColor: '#245276', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 8, padding: 12 }, infoText: { color: '#c0c9d7', flex: 1, fontSize: 11, lineHeight: 15 }, syncButton: { alignItems: 'center', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 10 }, syncText: { color: colors.blueBright, fontSize: 10, fontWeight: '600' },
});
