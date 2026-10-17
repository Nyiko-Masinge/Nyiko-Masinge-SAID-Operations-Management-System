import { Ionicons } from '@expo/vector-icons';
import { saveTaskProgress, progressErrorMessage, type Progress } from '../lib/taskProgress';
import { taskStatusLabel } from '../lib/taskStatusDisplay';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoEmployees } from '../data/demoEmployees';
import { demoLocations } from '../data/demoLocations';
import { useLocations } from '../lib/useLocations';
import type { DemoShift, TaskChecklistItem } from '../types/tasks';
import { colors } from '../theme';
import { BottomNavigation, type MainNavigationTab } from './StaffHomeScreen';
import { StaffAppHeader } from './StaffAppHeader';

type StaffTaskDetailScreenProps = {
  hasUnreadAlerts: boolean;
  onBack: () => void;
  onMarkComplete: (taskId: string) => void;
  onMarkUnableToComplete: (taskId: string, reason: string) => void;
  onNavigate?: (tab: MainNavigationTab) => void;
  onOpenAlerts: () => void;
  onReopenTask: (taskId: string) => void;
  onStartTask: (taskId: string) => void;
  onProgressSaved?: (taskId: string, progress: Progress) => void;
  onRefreshRoster?: () => void;
  task: DemoShift;
};

function TeamMember({ initials, name, role }: { initials: string; name: string; role: string }) {
  return <View style={styles.teamMember}><View style={styles.memberAvatar}><Text style={styles.memberInitials}>{initials}</Text></View><Text numberOfLines={1} style={styles.memberName}>{name}</Text><Text style={styles.memberRole}>{role}</Text></View>;
}

function getEmployeeName(employeeId: string): string {
  const employee = demoEmployees.find((emp) => emp.id === employeeId);
  return employee ? `${employee.firstName} ${employee.surname[0]}.` : 'Unknown';
}

function getEmployeeInitials(employeeId: string): string {
  const employee = demoEmployees.find((emp) => emp.id === employeeId);
  return employee ? `${employee.firstName[0]}${employee.surname[0]}` : '??';
}

function getEmployeeRole(employeeId: string): string {
  const employee = demoEmployees.find((emp) => emp.id === employeeId);
  if (!employee) return 'Unknown';
  const roleMap: Record<string, string> = {
    'lead': 'Lead',
    'nurse': 'Nurse',
    'orderly': 'Orderly',
  };
  return roleMap[employee.roleId] || employee.roleId;
}

// Code Attribution — Maseo Junior Mandiwana (ST10367488), task controls.
// These controls follow the Pressable onPress/disabled/pressed-state API.
// React Native Contributors (n.d.) 'Pressable'. https://reactnative.dev/docs/pressable
// Accessed: 5 October 2026.
function TaskActions({ busy, isPaused, onComplete, onReopen, onStart, onTogglePause, onUnableToComplete, status }: { busy: boolean; isPaused: boolean; onComplete: () => void; onReopen: () => void; onStart: () => void; onTogglePause: () => void; onUnableToComplete: () => void; status: DemoShift['status'] }) {
  if (status === 'Completed') return <View style={styles.completedActions}><View style={styles.completedState}><Ionicons color={colors.completed} name="checkmark-circle-outline" size={22} /><Text style={styles.completedStateText}>Task completed</Text></View><Pressable accessibilityLabel="Reopen task" accessibilityRole="button" disabled={busy} onPress={onReopen} style={({ pressed }) => [styles.reopenButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={colors.blueBright} name="refresh-outline" size={21} /><Text style={styles.reopenText}>{busy ? 'Saving…' : 'Reopen Task'}</Text></Pressable></View>;
  if (status === 'Unable to Complete') return <View style={styles.completedActions}><View style={styles.unableState}><Ionicons color={colors.warning} name="warning-outline" size={22} /><Text style={styles.unableStateText}>Unable to complete</Text></View><Pressable accessibilityLabel="Reopen task" accessibilityRole="button" disabled={busy} onPress={onReopen} style={({ pressed }) => [styles.reopenButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={colors.blueBright} name="refresh-outline" size={21} /><Text style={styles.reopenText}>{busy ? 'Saving…' : 'Reopen Task'}</Text></Pressable></View>;
  if (status === 'Scheduled') return <Pressable accessibilityLabel="Start task" accessibilityRole="button" disabled={busy} onPress={onStart} style={({ pressed }) => [styles.startButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={colors.blueBright} name="play-circle-outline" size={23} /><Text style={styles.startText}>{busy ? 'Starting…' : 'Start Task'}</Text></Pressable>;
  return <View style={styles.actionStack}><View style={styles.actions}><Pressable accessibilityLabel={isPaused ? 'Resume task' : 'Pause task'} accessibilityRole="button" disabled={busy} onPress={onTogglePause} style={({ pressed }) => [styles.pauseButton, isPaused && styles.resumeButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={isPaused ? colors.paused : colors.blueBright} name={isPaused ? 'play' : 'pause'} size={21} /><Text style={[styles.pauseText, isPaused && styles.resumeText]}>{isPaused ? 'Resume Task' : 'Pause Task'}</Text></Pressable><Pressable accessibilityLabel="Mark task complete" accessibilityRole="button" disabled={busy} onPress={onComplete} style={({ pressed }) => [styles.completeButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={colors.completed} name="checkmark-circle-outline" size={23} /><Text style={styles.completeText}>{busy ? 'Saving…' : 'Mark Complete'}</Text></Pressable></View><Pressable accessibilityLabel="Mark task unable to complete" accessibilityRole="button" disabled={busy} onPress={onUnableToComplete} style={({ pressed }) => [styles.unableButton, busy && styles.disabledAction, pressed && styles.pressed]}><Ionicons color={colors.warning} name="warning-outline" size={21} /><Text style={styles.unableButtonText}>{busy ? 'Saving…' : 'Unable to Complete'}</Text></Pressable></View>;
}

export function StaffTaskDetailScreen({ hasUnreadAlerts, onBack, onMarkComplete, onMarkUnableToComplete, onNavigate, onOpenAlerts, onReopenTask, onStartTask, onProgressSaved, onRefreshRoster, task: initialTask }: StaffTaskDetailScreenProps) {
  const { locationName, error: locationsError, retry: retryLocations } = useLocations();
  const [task, setTask] = useState(initialTask);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>(initialTask.checklist);
  const [isPaused, setIsPaused] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  // Code Attribution — Maseo Junior Mandiwana (ST10367488), synchronous save lock.
  // This implementation follows useRef's mutable, non-rendering storage pattern;
  // saveStatus checks and sets current before awaiting the request.
  // React Team (n.d.) 'useRef'. https://react.dev/reference/react/useRef
  // Accessed: 5 October 2026.
  const isSavingStatusRef = useRef(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reasonValidation, setReasonValidation] = useState('');
  const [unableModalOpen, setUnableModalOpen] = useState(false);
  const [reasonDraft, setReasonDraft] = useState('');
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const completedCount = useMemo(() => checklist.filter((item) => item.completed).length, [checklist]);
  const isCompleted = task.status === 'Completed';
  const isUnableToComplete = task.status === 'Unable to Complete';
  const isScheduled = task.status === 'Scheduled';
  const isInteractive = task.status === 'In Progress' && !task.archived;
  const isPublished = Boolean(task.publicationVersion);
  const showPausedStatus = !isPublished && isPaused;
  const displayStatus = isPublished ? taskStatusLabel(task.status) : isCompleted ? 'Completed' : isUnableToComplete ? 'Unable to Complete' : isScheduled ? 'Scheduled' : showPausedStatus ? 'Paused' : 'In Progress';
  const statusColor = isCompleted ? colors.completed : isUnableToComplete ? colors.warning : isScheduled ? colors.upcoming : showPausedStatus ? colors.paused : colors.blueBright;
  const kicker = isCompleted ? 'TASK COMPLETED' : isUnableToComplete ? 'UNABLE TO COMPLETE' : isScheduled ? 'TASK SCHEDULED' : showPausedStatus ? 'TASK PAUSED' : 'TASK IN PROGRESS';
  const statusIcon = isCompleted ? 'checkmark-circle-outline' : isUnableToComplete ? 'warning-outline' : isScheduled ? 'hourglass-outline' : showPausedStatus ? 'pause-circle-outline' : 'pulse-outline';
  const sharedLocation = locationName(task.locationId);
  const location = sharedLocation !== task.locationId || task.isLive || task.publicationVersion ? sharedLocation : demoLocations.find((loc) => loc.id === task.locationId)?.name ?? sharedLocation;
  const timeDisplay = `${task.startTime} - ${task.endTime}`;

  useEffect(() => {
    setTask(initialTask);
    setChecklist(initialTask.checklist);
    setIsPaused(false);
    setStatusError(null);

  }, [initialTask.id, initialTask.publicationVersion]);

  const scope = useRef(0);
  useEffect(() => { scope.current++; return () => { scope.current++; }; }, [initialTask.id, initialTask.publicationVersion]);

  const toggleChecklist = (itemId: string) => setChecklist((items) => items.map((item) => item.id === itemId ? { ...item, completed: !item.completed, completedAt: item.completed ? undefined : 'Done' } : item));

  const confirmComplete = () => setCompleteModalOpen(true);
  const confirmReopen = () => setReopenModalOpen(true);
  const saveStatus = async (status: DemoShift['status'], reason?: string) => {
    if (isSavingStatusRef.current) return;
    isSavingStatusRef.current = true;
    setIsSavingStatus(true);
    setStatusError(null);
    try {
      const normalizedReason = reason?.trim();
      const requestScope = scope.current;
      const progress = await saveTaskProgress(task, status, normalizedReason);
      if (requestScope !== scope.current) return;
      setTask((currentTask) => ({ ...currentTask, status: progress.status, ...(progress.unableToCompleteReason !== undefined ? { unableToCompleteReason: progress.unableToCompleteReason } : {}) }));
      onProgressSaved?.(task.id, progress);
      if (status === 'Completed') onMarkComplete(task.id);
      else if (status === 'Unable to Complete' && normalizedReason) onMarkUnableToComplete(task.id, normalizedReason);
      else if (status === 'In Progress') {
        if (task.status === 'Scheduled') onStartTask(task.id);
        else onReopenTask(task.id);
      }
    } catch (error) {
      setStatusError(progressErrorMessage(error));
    } finally {
      isSavingStatusRef.current = false;
      setIsSavingStatus(false);
    }
  };

  const handleConfirmComplete = async () => {
    setCompleteModalOpen(false);
    await saveStatus('Completed');
  };
  const handleConfirmReopen = async () => {
    setReopenModalOpen(false);
    await saveStatus('In Progress');
  };

  const openUnableModal = () => {
    setReasonDraft(task.unableToCompleteReason ?? '');
    setReasonValidation('');
    setUnableModalOpen(true);
  };
  const closeUnableModal = () => {
    setUnableModalOpen(false);
    setReasonDraft('');
    setReasonValidation('');
  };
  const submitUnableToComplete = async () => {
    const unableToCompleteReason = reasonDraft.trim();
    if (!unableToCompleteReason) {
      setReasonValidation('Enter a reason before submitting.');
      return;
    }
    closeUnableModal();
    await saveStatus('Unable to Complete', unableToCompleteReason);
  };

  return <SafeAreaView style={styles.safeArea}>
    <StaffAppHeader backLabel="Back to previous screen" hasUnreadAlerts={hasUnreadAlerts} mode="nested" onBack={onBack} onOpenNotifications={onOpenAlerts} />
    <View style={styles.contentArea}>
      <View pointerEvents="none" style={styles.backdrop}><View style={styles.gridLine} /><View style={styles.circuit} /><Text style={styles.dots}>· · ·</Text></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {task.publicationVersion && <Text style={styles.description}>Published duty. Progress saves securely; pause and checklist remain local.</Text>}
        {locationsError && <View style={styles.locationsErrorBanner}><Text accessibilityRole="alert" style={styles.locationsErrorText}>Unable to load operational areas.</Text><Pressable accessibilityLabel="Retry operational areas" accessibilityRole="button" onPress={retryLocations} style={styles.locationsRetry}><Text style={styles.locationsErrorText}>Retry</Text></Pressable></View>}
        <View style={styles.taskIntro}>
          <View style={styles.introCopy}>
            <Text style={[styles.kicker, { color: statusColor }]}>{kicker}</Text>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={styles.introMeta}><View style={styles.metaItem}><Ionicons color="#b4c0d2" name="time-outline" size={18} /><Text style={styles.metaText}>{timeDisplay}</Text></View>{isInteractive && !isPaused ? <Text style={styles.current}>(Current)</Text> : null}<View style={styles.metaDivider} /><View style={styles.metaItem}><Ionicons color="#b4c0d2" name="location-outline" size={18} /><Text style={styles.metaText}>{location}</Text></View></View>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}><Text style={[styles.statusText, { color: statusColor }]}>{displayStatus}</Text><Ionicons color={statusColor} name={statusIcon} size={25} /></View>
        </View>
        <Text style={styles.startedAt}>{isPublished ? taskStatusLabel(task.status) : task.startedAt ? `Started at ${task.startedAt}` : 'Not started'}</Text>

        <View style={styles.detailsPanel}>
          <View style={styles.descriptionBlock}><Text style={styles.panelTitle}>DESCRIPTION</Text><Text style={styles.description}>{task.description}</Text></View>
          <View style={styles.detailColumn}><Text style={styles.panelTitle}>{task.isCritical?'CRITICAL DUTY · PRIORITY':'PRIORITY'}</Text><View style={[styles.priority, task.priority === 'High' && styles.priorityHigh]}><Ionicons color={task.priority === 'High' ? colors.upcoming : colors.blueBright} name="alert-circle-outline" size={15} /><Text style={[styles.priorityText, task.priority === 'High' && styles.priorityTextHigh]}>{task.priority}</Text></View><Text style={styles.detailLabel}>TASK ID</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.detailValue}>{task.taskId}</Text></View>
          <View style={styles.detailColumn}><Text style={styles.panelTitle}>DUE BY</Text><View style={styles.dueValue}><Ionicons color={colors.warning} name="time-outline" size={16} /><Text style={styles.dueText}>{task.dueBy}</Text></View><Text style={styles.detailLabel}>EST. DURATION</Text><Text style={styles.detailValue}>{task.estimatedDuration}</Text></View>
        </View>

        <View style={styles.teamPanel}><Text style={styles.panelTitle}>ASSIGNED TEAM</Text><View style={styles.teamRow}>{task.team.slice(0, 4).map((member) => <TeamMember key={member.employeeId} initials={member.displayName?member.displayName.split(' ').filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase():getEmployeeInitials(member.employeeId)} name={member.displayName??getEmployeeName(member.employeeId)} role={member.jobCategory??getEmployeeRole(member.employeeId)} />)}{task.team.length > 4 && <View style={styles.moreMember}><Text style={styles.moreNumber}>+{task.team.length - 4}</Text><Text style={styles.moreText}>More</Text></View>}</View></View>

        <View style={styles.checklistPanel}>
          <View style={styles.checklistHeader}><Text style={styles.panelTitle}>INSTRUCTIONS &amp; CHECKLIST</Text><Text style={styles.progress}>{completedCount} of {checklist.length} completed</Text></View>
          {checklist.map((item) => <Pressable accessibilityLabel={`${item.label}, ${item.completed ? 'completed' : 'not completed'}${isInteractive ? '' : ', read only'}`} accessibilityRole="checkbox" accessibilityState={{ checked: item.completed, disabled: !isInteractive }} disabled={!isInteractive} key={item.id} onPress={() => toggleChecklist(item.id)} style={({ pressed }) => [styles.checkRow, !isInteractive && styles.checkRowReadOnly, pressed && styles.pressed]}><Ionicons color={item.completed ? colors.completed : isScheduled ? colors.upcoming : colors.blueBright} name={item.completed ? 'checkmark-circle-outline' : 'ellipse-outline'} size={26} /><Text style={[styles.checkLabel, item.completed && styles.checkLabelDone]}>{item.label}</Text><View style={styles.checkAssignee}><Ionicons color="#9aaabd" name="person-outline" size={16} /><Text numberOfLines={1} style={styles.assigneeText}>{item.assignee}</Text></View><Text numberOfLines={1} style={[styles.completedAt, item.completed && styles.completedAtDone]}>{item.completedAt ?? '—'}</Text></Pressable>)}
        </View>

        <View style={styles.notesPanel}><Text style={styles.panelTitle}>NOTES</Text><View style={styles.notesRow}><Ionicons color="#b4c0d2" name="document-text-outline" size={29} /><Text style={styles.noteText}>{task.note ?? 'Review assigned operational requirements before beginning this task.'}</Text></View></View>
        {task.unableToCompleteReason ? <View style={styles.reasonPanel}><Text style={styles.panelTitle}>{isUnableToComplete ? 'UNABLE TO COMPLETE REASON' : 'PREVIOUS UNABLE TO COMPLETE REASON'}</Text><View style={styles.notesRow}><Ionicons color={colors.warning} name="warning-outline" size={29} /><Text style={styles.reasonText}>{task.unableToCompleteReason}</Text></View></View> : null}
        {statusError ? <View><Text accessibilityRole="alert" style={styles.statusError}>{statusError}</Text>{onRefreshRoster && <Pressable accessibilityLabel="Refresh roster" onPress={onRefreshRoster}><Text style={styles.description}>Refresh roster</Text></Pressable>}</View> : null}
        {isSavingStatus ? <Text style={styles.savingStatus}>Saving task progress…</Text> : null}
        {task.archived ? <Text style={styles.description}>Archived duty · Read-only history</Text> : <TaskActions busy={isSavingStatus} isPaused={isPaused} onComplete={confirmComplete} onReopen={confirmReopen} onStart={() => { void saveStatus('In Progress'); }} onTogglePause={() => setIsPaused((paused) => !paused)} onUnableToComplete={openUnableModal} status={task.status} />}
      </ScrollView>
    </View>
    <BottomNavigation hasUnreadAlerts={hasUnreadAlerts} onNavigate={onNavigate} />
    {/* Code Attribution — Maseo Junior Mandiwana (ST10367488), confirmation dialogs.
        These dialogs follow Modal's onRequestClose API for Android back-button dismissal.
        React Native Contributors (n.d.) 'Modal'. https://reactnative.dev/docs/modal
        Accessed: 5 October 2026. */}
    <Modal animationType="fade" onRequestClose={() => !isSavingStatus && setCompleteModalOpen(false)} transparent visible={completeModalOpen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalShell}>
        <Pressable accessibilityLabel="Dismiss completion dialog" disabled={isSavingStatus} onPress={() => setCompleteModalOpen(false)} style={styles.modalBackdrop} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Mark Complete</Text>
          <Text style={styles.modalCopy}>Confirm that this task has been completed.</Text>
          <View style={styles.modalActions}>
            <Pressable accessibilityLabel="Cancel" accessibilityRole="button" disabled={isSavingStatus} onPress={() => setCompleteModalOpen(false)} style={({ pressed }) => [styles.modalCancel, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityLabel="Confirm task completion" accessibilityRole="button" disabled={isSavingStatus} onPress={handleConfirmComplete} style={({ pressed }) => [styles.modalComplete, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalCompleteText}>{isSavingStatus ? 'Saving…' : 'Confirm'}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal animationType="fade" onRequestClose={() => !isSavingStatus && setReopenModalOpen(false)} transparent visible={reopenModalOpen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalShell}>
        <Pressable accessibilityLabel="Dismiss reopen dialog" disabled={isSavingStatus} onPress={() => setReopenModalOpen(false)} style={styles.modalBackdrop} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reopen Task</Text>
          <Text style={styles.modalCopy}>Return this task to In Progress?</Text>
          <View style={styles.modalActions}>
            <Pressable accessibilityLabel="Cancel" accessibilityRole="button" disabled={isSavingStatus} onPress={() => setReopenModalOpen(false)} style={({ pressed }) => [styles.modalCancel, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityLabel="Confirm reopen task" accessibilityRole="button" disabled={isSavingStatus} onPress={handleConfirmReopen} style={({ pressed }) => [styles.modalReopen, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalReopenText}>{isSavingStatus ? 'Saving…' : 'Reopen'}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal animationType="fade" onRequestClose={() => !isSavingStatus && closeUnableModal()} transparent visible={unableModalOpen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalShell}>
        <Pressable accessibilityLabel="Dismiss reason dialog" disabled={isSavingStatus} onPress={closeUnableModal} style={styles.modalBackdrop} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Unable to Complete</Text>
          <Text style={styles.modalCopy}>A reason is required before this task can be marked Unable to Complete.</Text>
          <TextInput accessibilityLabel="Unable to complete reason" editable={!isSavingStatus} multiline onChangeText={(value) => { setReasonDraft(value); if (value.trim()) setReasonValidation(''); }} placeholder="Enter the reason this task cannot be completed" placeholderTextColor={colors.textMuted} style={styles.reasonInput} textAlignVertical="top" value={reasonDraft} />
          {reasonValidation ? <Text accessibilityRole="alert" style={styles.validationText}>{reasonValidation}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable accessibilityLabel="Cancel" accessibilityRole="button" disabled={isSavingStatus} onPress={closeUnableModal} style={({ pressed }) => [styles.modalCancel, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityLabel="Submit unable to complete reason" accessibilityRole="button" disabled={isSavingStatus} onPress={submitUnableToComplete} style={({ pressed }) => [styles.modalSubmit, isSavingStatus && styles.disabledAction, pressed && styles.pressed]}><Text style={styles.modalSubmitText}>{isSavingStatus ? 'Submitting…' : 'Submit'}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  locationsErrorBanner: { alignItems: 'center', backgroundColor: '#231017', borderColor: '#702b34', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 14, paddingHorizontal: 12 },
  locationsErrorText: { color: '#ff8f91', flexShrink: 1, fontSize: 12 },
  locationsRetry: { justifyContent: 'center', marginLeft: 'auto', minHeight: 44, paddingHorizontal: 8 },
  statusError: { backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, color: colors.warning, fontSize: 13, lineHeight: 18, marginTop: 18, padding: 12 },
  savingStatus: { color: colors.blueBright, fontSize: 12, marginTop: 14, textAlign: 'center' },
  validationText: { color: colors.warning, fontSize: 12, marginTop: 7 },
  modalComplete: { alignItems: 'center', backgroundColor: colors.completedDeep, borderColor: colors.completed, borderRadius: 3, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  modalCompleteText: { color: colors.completed, fontSize: 15, fontWeight: '600' },
  modalReopen: { alignItems: 'center', backgroundColor: '#071a2e', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  modalReopenText: { color: colors.blueBright, fontSize: 15, fontWeight: '600' },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  contentArea: { flex: 1 }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.88 }, gridLine: { backgroundColor: '#162c42', height: 1, left: 0, position: 'absolute', right: 0, top: 150 }, circuit: { borderColor: '#1c466c', borderRightWidth: 1, borderTopWidth: 1, height: 88, position: 'absolute', right: 0, top: 0, width: 88 }, dots: { color: colors.blueBright, fontSize: 14, letterSpacing: 5, opacity: 0.6, position: 'absolute', right: 17, top: 30 }, content: { padding: 16, paddingBottom: 30 },
  taskIntro: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, introCopy: { flex: 1, minWidth: 0, paddingRight: 10 }, kicker: { fontSize: 11, letterSpacing: 1.2 }, taskTitle: { color: colors.text, fontSize: 25, fontWeight: '700', lineHeight: 31, marginTop: 7 }, introMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 5 }, metaItem: { alignItems: 'center', flexDirection: 'row', gap: 5 }, metaText: { color: '#b4c0d2', fontSize: 13 }, current: { color: colors.blueBright, fontSize: 13, marginLeft: 8 }, metaDivider: { backgroundColor: '#50667d', height: 17, marginHorizontal: 9, width: 1 }, statusBadge: { alignItems: 'center', backgroundColor: '#071523', borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 20, paddingHorizontal: 10, paddingVertical: 7 }, statusText: { fontSize: 12, fontWeight: '600' }, startedAt: { color: '#c2cad7', fontSize: 12, marginTop: 5, textAlign: 'right' },
  detailsPanel: { backgroundColor: '#07121e', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, flexDirection: 'row', marginTop: 24, overflow: 'hidden', padding: 14 }, descriptionBlock: { borderRightColor: '#29445d', borderRightWidth: 1, flex: 1.3, paddingRight: 12 }, detailColumn: { flex: 0.85, paddingLeft: 12 }, panelTitle: { color: colors.blueBright, fontSize: 11, letterSpacing: 0.9 }, description: { color: '#c3cad5', fontSize: 12, lineHeight: 18, marginTop: 10 }, priority: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#071d34', borderColor: colors.blueBright, borderRadius: 4, borderWidth: 1, flexDirection: 'row', gap: 4, marginTop: 8, paddingHorizontal: 7, paddingVertical: 4 }, priorityHigh: { backgroundColor: colors.upcomingDeep, borderColor: colors.upcoming }, priorityText: { color: colors.blueBright, fontSize: 12 }, priorityTextHigh: { color: colors.upcoming }, detailLabel: { color: colors.blueBright, fontSize: 10, marginTop: 14 }, detailValue: { color: '#c5cedb', fontSize: 11, marginTop: 4 }, dueValue: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 9 }, dueText: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  teamPanel: { backgroundColor: '#06111d', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, marginTop: 16, padding: 14 }, teamRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }, teamMember: { alignItems: 'center', flex: 1, minWidth: 0 }, memberAvatar: { alignItems: 'center', backgroundColor: '#214666', borderColor: colors.blueBright, borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 }, memberInitials: { color: colors.text, fontSize: 12, fontWeight: '700' }, memberName: { color: colors.text, fontSize: 10, marginTop: 6 }, memberRole: { color: '#a5b1c2', fontSize: 9, marginTop: 2 }, moreMember: { alignItems: 'center', flex: 1 }, moreNumber: { color: colors.blueBright, fontSize: 22, marginTop: 8 }, moreText: { color: colors.blueBright, fontSize: 10, marginTop: 11 },
  checklistPanel: { backgroundColor: '#06111d', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, marginTop: 16, overflow: 'hidden' }, checklistHeader: { alignItems: 'center', borderBottomColor: '#29445d', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 }, progress: { color: colors.blueBright, fontSize: 12 }, checkRow: { alignItems: 'center', borderBottomColor: '#21394f', borderBottomWidth: 1, flexDirection: 'row', minHeight: 51, paddingHorizontal: 14 }, checkRowReadOnly: { opacity: 0.88 }, pressed: { opacity: 0.8 }, checkLabel: { color: colors.text, flex: 1, fontSize: 13, lineHeight: 17, marginHorizontal: 10 }, checkLabelDone: { color: '#c4d8cd' }, checkAssignee: { alignItems: 'center', flexDirection: 'row', gap: 3, width: 64 }, assigneeText: { color: '#aab6c8', flex: 1, fontSize: 10 }, completedAt: { color: '#8492a6', fontSize: 10, textAlign: 'right', width: 36 }, completedAtDone: { color: colors.completed },
  notesPanel: { backgroundColor: '#06111d', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, marginTop: 16, padding: 14 }, notesRow: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 12 }, noteText: { color: '#c0c9d7', flex: 1, fontSize: 13, lineHeight: 18 },
  reasonPanel: { backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, marginTop: 16, padding: 14 }, reasonText: { color: '#e8d4d6', flex: 1, fontSize: 13, lineHeight: 18 },
  actionStack: { marginTop: 18 }, actions: { flexDirection: 'row', gap: 12 }, pauseButton: { alignItems: 'center', backgroundColor: '#071a2e', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 54 }, resumeButton: { borderColor: colors.paused }, pauseText: { color: colors.blueBright, fontSize: 16, fontWeight: '600' }, resumeText: { color: colors.paused }, completeButton: { alignItems: 'center', backgroundColor: colors.completedDeep, borderColor: colors.completed, borderRadius: 3, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 54 }, completeText: { color: colors.completed, fontSize: 16, fontWeight: '600' },
  unableButton: { alignItems: 'center', backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12, minHeight: 54 }, unableButtonText: { color: colors.warning, fontSize: 16, fontWeight: '600' },
  startButton: { alignItems: 'center', backgroundColor: '#071a2e', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 18, minHeight: 54 }, startText: { color: colors.blueBright, fontSize: 16, fontWeight: '600' }, completedActions: { flexDirection: 'row', gap: 10, marginTop: 18 }, completedState: { alignItems: 'center', backgroundColor: colors.completedDeep, borderColor: colors.completed, borderRadius: 3, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 54 }, completedStateText: { color: colors.completed, fontSize: 14, fontWeight: '600' }, unableState: { alignItems: 'center', backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 54 }, unableStateText: { color: colors.warning, fontSize: 14, fontWeight: '600' }, reopenButton: { alignItems: 'center', backgroundColor: '#071a2e', borderColor: colors.blueBright, borderRadius: 3, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 54 }, reopenText: { color: colors.blueBright, fontSize: 14, fontWeight: '600' },
  disabledAction: { opacity: 0.55 },
  modalShell: { flex: 1, justifyContent: 'center', padding: 18 }, modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' }, modalCard: { backgroundColor: '#07121e', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, padding: 16, zIndex: 1 }, modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' }, modalCopy: { color: '#c0c9d7', fontSize: 13, lineHeight: 18, marginTop: 8 }, reasonInput: { backgroundColor: '#06111d', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, color: colors.text, fontSize: 14, marginTop: 14, minHeight: 96, padding: 12 }, modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 }, modalCancel: { alignItems: 'center', borderColor: '#324d66', borderRadius: 3, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 }, modalCancelText: { color: '#c0c9d7', fontSize: 15, fontWeight: '600' }, modalSubmit: { alignItems: 'center', backgroundColor: '#160b10', borderColor: colors.warning, borderRadius: 3, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 }, modalSubmitText: { color: colors.warning, fontSize: 15, fontWeight: '600' },
});
