import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, friendlyAuthError, useAuth } from './components/AuthProvider';
import { employeeFullName } from './lib/employee';
import { TerminalField } from './components/TerminalField';
import { StaffAlertsScreen } from './components/StaffAlertsScreen';
import { AlertDetailSheet } from './components/AlertDetailSheet';
import { NotificationsProvider, useNotifications } from './components/NotificationProvider';
import { NotificationTray } from './components/NotificationTray';
import { StaffProfileScreen } from './components/StaffProfileScreen';
import { StaffEditProfileScreen } from './components/StaffEditProfileScreen';
import { StaffHomeScreen } from './components/StaffHomeScreen';
import type { MainNavigationTab } from './components/StaffHomeScreen';
import { StaffTaskDetailScreen } from './components/StaffTaskDetailScreen';
import { StaffWeeklyRosterScreen } from './components/StaffWeeklyRosterScreen';
import { SaidLogo } from './components/SaidLogo';
import { initialDemoShifts } from './data/demoTasks';
import { demoStaffProfile } from './data/demoStaffProfile';
import type { DemoStaffProfile } from './types/profile';
import type { DemoShift } from './types/tasks';
import { colors, spacing } from './theme';
import { firestoreRosterEnabled, weekFor } from './lib/publishedRoster';
import { usePublishedRoster } from './lib/usePublishedRoster';

type Screen = 'login' | 'home' | 'roster' | 'taskDetail' | 'alerts' | 'profile' | 'editProfile';
type TaskDetailOrigin = 'home' | 'roster';
type RosterInitialView = 'day' | 'week';
type AlertReturnScreen = 'home' | 'roster' | 'taskDetail' | 'profile';
type ProfileReturnScreen = 'home' | 'roster' | 'taskDetail' | 'alerts';

function TechBackdrop() {
  return (
    <View pointerEvents="none" style={styles.techBackdrop}>
      <View style={[styles.gridLineHorizontal, { top: '18%' }]} />
      <View style={[styles.gridLineHorizontal, { top: '53%' }]} />
      <View style={[styles.gridLineVertical, { left: '20%' }]} />
      <View style={[styles.gridLineVertical, { right: '18%' }]} />
      <View style={styles.circuitTop} />
      <View style={styles.circuitRight} />
      <View style={styles.redRail} />
      <View style={styles.blueRail} />
      <Text style={styles.redPips}>· · ·</Text>
      <Text style={styles.blueCross}>＋</Text>
    </View>
  );
}

function CornerMark({ color = colors.blue }: { color?: string }) {
  return <View style={[styles.cornerMark, { borderColor: color }]} />;
}

function PanelAccents() {
  return (
    <>
      <View pointerEvents="none" style={styles.panelTopAccent} />
      <View pointerEvents="none" style={styles.panelBottomAccent} />
    </>
  );
}

function LoginScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 820;
  const veryCompact = height < 720;
  const { accessError, resetPassword, signIn } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { if (accessError) { setMessage(accessError); setBusy(false); } }, [accessError]);

  const unavailable = (feature: string) =>
    Alert.alert('Not available yet', `${feature} is not available in this build.`);

  const handleSignIn = async () => {
    setMessage('');
    if (employeeId.includes('@')) { setMessage('Sign in with your Employee ID, not an email address.'); return; }
    if (!password) { setMessage('Enter your password.'); return; }
    setBusy(true);
    try {
      await signIn(employeeId, password);
    } catch (error) {
      setMessage(friendlyAuthError(error));
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      await resetPassword(employeeId);
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.terminal, compact && styles.terminalCompact, veryCompact && styles.terminalVeryCompact]}>
            <TechBackdrop />

            <View style={styles.terminalHeader}>
              <View style={styles.accessHeader}>
                <CornerMark color={colors.red} />
                <Text style={styles.accessText}>SECURE ACCESS TERMINAL ›</Text>
              </View>
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>SYSTEM STATUS&nbsp; +</Text>
                <Text style={styles.online}><Text style={styles.onlineDot}>●</Text>&nbsp; ONLINE</Text>
              </View>
            </View>

            <View style={[styles.brandBlock, compact && styles.brandBlockCompact]}>
              <View style={[styles.emblemOrbit, compact && styles.emblemOrbitCompact, veryCompact && styles.emblemOrbitVeryCompact]}>
                <View style={styles.orbitTickTop} />
                <View style={styles.orbitTickRight} />
                <SaidLogo size={veryCompact ? 62 : compact ? 74 : 86} />
              </View>
              <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>
                <Text style={styles.wordmarkWhite}>SAID </Text><Text style={styles.wordmarkBlue}>Ops</Text>
              </Text>
              <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>STAFF OPERATIONS SYSTEM</Text>
              <View style={[styles.rule, compact && styles.ruleCompact]}>
                <View style={styles.ruleCenter} />
              </View>
            </View>

            <View style={[styles.form, compact && styles.formCompact]}>
              <View style={[styles.securityNote, compact && styles.securityNoteCompact]}>
                <Text style={styles.shield}>◇</Text>
                <Text style={styles.securityText}>Secure access for authorised staff</Text>
              </View>

              <View accessibilityRole="summary" style={[styles.demoPanel, compact && styles.demoPanelCompact]}>
                <PanelAccents />
                <View style={styles.demoIcon}><Text style={styles.demoIconText}>i</Text></View>
                <View style={styles.demoCopy}>
                  <Text style={styles.demoTitle}>SECURE SIGN IN</Text>
                  <Text style={styles.demoBody}>Sign in with your Employee ID and password.</Text>
                </View>
              </View>

              <TerminalField accessibilityLabel="Employee ID" onChangeText={setEmployeeId} placeholder="Employee ID" value={employeeId}>
                <Text style={styles.fieldIcon}>ID</Text>
              </TerminalField>
              <View style={styles.fieldGap} />
              <TerminalField
                accessibilityLabel="Password"
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry={!passwordVisible}
                value={password}
                rightAccessory={
                  <Pressable accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} hitSlop={8} onPress={() => setPasswordVisible((shown) => !shown)}>
                    <Text style={styles.eye}>{passwordVisible ? '◉' : '◌'}</Text>
                  </Pressable>
                }
              >
                <Text style={styles.fieldIcon}>⌑</Text>
              </TerminalField>

              <View style={[styles.optionsRow, compact && styles.optionsRowCompact]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  onPress={() => setRememberMe((checked) => !checked)}
                  style={styles.rememberButton}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleForgotPassword} style={styles.textButton}>
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>
              </View>

              {message ? <Text accessibilityRole="alert" style={styles.formMessage}>{message}</Text> : null}

              <Pressable accessibilityRole="button" disabled={busy} onPress={handleSignIn} style={({ pressed }) => [styles.signIn, (pressed || busy) && styles.buttonPressed]}>
                <PanelAccents />
                <View style={styles.buttonDotGrid}><Text style={styles.buttonDots}>· · ·{`\n`} · · ·</Text></View>
                <Text style={styles.signInText}>{busy ? 'Signing In…' : 'Sign In'}</Text>
                {!busy ? <Text style={styles.arrow}>→</Text> : null}
              </Pressable>

              <Pressable accessibilityRole="button" onPress={() => unavailable('Single Sign-On')} style={({ pressed }) => [styles.sso, compact && styles.ssoCompact, pressed && styles.buttonPressed]}>
                <PanelAccents />
                <View style={styles.ssoBadge}><Text style={styles.ssoShield}>＋</Text></View>
                <Text style={styles.ssoText}>Use Single Sign-On (SSO)</Text>
                <Text style={styles.ssoArrow}>›</Text>
              </Pressable>
            </View>

            <View style={[styles.footer, compact && styles.footerCompact]}>
              <View style={styles.authorisedRow}>
                <View style={styles.footerRedLine} />
                <Text style={styles.authorised}>AUTHORISED PERSONNEL ONLY</Text>
                <View style={styles.footerRedLine} />
              </View>
              {!veryCompact ? <Text style={styles.version}>SAID OPS v1.0.0 &nbsp;•&nbsp; BUILD 2025.05.16.01</Text> : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppContent() {
  const { employee, role, signOut, status } = useAuth();
  const [screen, setScreen] = useState<Screen>('login');
  const [tasks, setTasks] = useState<DemoShift[]>(initialDemoShifts);
  const [rosterWeekStart,setRosterWeekStart] = useState(()=>weekFor());
  const [rosterHistory,setRosterHistory]=useState(false);
  const publication=usePublishedRoster(rosterWeekStart,rosterHistory&&(screen==='roster'||screen==='taskDetail'));
  const [tasksOwner,setTasksOwner]=useState('');
  const activeTasks=firestoreRosterEnabled ? (publication.state.status==='DATA'&&tasksOwner===publication.state.owner ? tasks.filter(task=>task.publicationVersion===publication.state.version&&task.weekStart===rosterWeekStart) : []) : tasks;
  useEffect(()=>{
    if(firestoreRosterEnabled){setTasks(publication.state.tasks);setTasksOwner(publication.state.owner);}
  },[publication.state.owner,publication.state.status,publication.state.version,publication.state.tasks]);
  const { alerts, markRead: markAlertRead, markAllRead: markAllAlertsRead } = useNotifications();
  const [profile, setProfile] = useState<DemoStaffProfile>(demoStaffProfile);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailOrigin, setTaskDetailOrigin] = useState<TaskDetailOrigin>('home');
  const [rosterInitialView, setRosterInitialView] = useState<RosterInitialView>('week');
  const [alertReturnScreen, setAlertReturnScreen] = useState<AlertReturnScreen>('home');
  const [alertInitialId, setAlertInitialId] = useState<string | null>(null);
  const [profileReturnScreen, setProfileReturnScreen] = useState<ProfileReturnScreen>('home');
  const [profileSaveNotice, setProfileSaveNotice] = useState(false);
  const [notificationTrayOpen, setNotificationTrayOpen] = useState(false);
  const [trayAlertDetailId, setTrayAlertDetailId] = useState<string | null>(null);
  const selectedTask = activeTasks.find((task) => task.id === selectedTaskId);
  const trayAlertDetail = alerts.find((alert) => alert.id === trayAlertDetailId) ?? null;
  const hasUnreadAlerts = alerts.some((alert) => !alert.read);

  // Identity fields (name, email, staff id, system role) come from Firestore once signed in.
  // Fields not yet in the Task 1 Source of Truth schema (department, primary location, skills,
  // employment status/date, access) stay on the local demo values until the team agrees where
  // they live in Firestore — see docs/DEVELOPMENT_CONTRACT.md open items.
  useEffect(() => {
    if (status === 'signedOut') {
      setScreen('login');
      setTasks(initialDemoShifts);
      setProfile(demoStaffProfile);
      setSelectedTaskId(null);
      setProfileSaveNotice(false);
      setNotificationTrayOpen(false);
      return;
    }
    if (status === 'signedIn' && employee) {
      setProfile((currentProfile) => ({
        ...currentProfile,
        editable: { ...currentProfile.editable, fullName: employeeFullName(employee), workEmail: employee.contactEmail ?? '' },
        operational: { ...currentProfile.operational, staffId: employee.employeeId, systemRole: role?.name ?? currentProfile.operational.systemRole },
      }));
      setScreen((currentScreen) => currentScreen === 'login' ? 'home' : currentScreen);
    }
  }, [employee, role, status]);

  useEffect(() => {
    if (screen === 'login') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'editProfile') return false;
      setScreen((currentScreen) => currentScreen === 'taskDetail' ? taskDetailOrigin : currentScreen === 'roster' ? 'home' : currentScreen === 'alerts' ? alertReturnScreen : currentScreen === 'profile' ? profileReturnScreen : 'login');
      return true;
    });

    return () => subscription.remove();
  }, [alertReturnScreen, profileReturnScreen, screen, taskDetailOrigin]);

  const openTaskDetail = (taskId: string, origin: TaskDetailOrigin) => {
    setSelectedTaskId(taskId);
    setTaskDetailOrigin(origin);
    setScreen('taskDetail');
  };

  const openRoster = (initialView: RosterInitialView) => {
    setRosterInitialView(initialView);
    setScreen('roster');
  };


  const openAlerts = (origin: AlertReturnScreen, alertId: string | null = null) => {
    if (alertId) markAlertRead(alertId);
    setAlertReturnScreen(origin);
    setAlertInitialId(alertId);
    setScreen('alerts');
  };

  const openProfile = (origin: ProfileReturnScreen) => {
    setProfileReturnScreen(origin);
    setScreen('profile');
  };

  const saveProfile = (editable: DemoStaffProfile['editable']) => {
    setProfile((currentProfile) => ({ ...currentProfile, editable }));
    setProfileSaveNotice(true);
    setScreen('profile');
  };

  const navigate = (tab: MainNavigationTab) => {
    if (tab === 'Home') setScreen('home');
    else if (tab === 'Roster') openRoster('week');
    else if (tab === 'Alerts') openAlerts(screen === 'roster' || screen === 'taskDetail' || screen === 'profile' ? screen : 'home');
    else if (screen !== 'profile') openProfile(screen === 'roster' || screen === 'taskDetail' || screen === 'alerts' ? screen : 'home');
  };

  const openTrayAlert = (alertId: string) => {
    markAlertRead(alertId);
    setNotificationTrayOpen(false);
    setTrayAlertDetailId(alertId);
  };

  const viewAllAlerts = () => {
    setNotificationTrayOpen(false);
    if (screen !== 'alerts') openAlerts(screen === 'roster' || screen === 'taskDetail' || screen === 'profile' ? screen : 'home');
  };

  const markTaskComplete = (taskId: string) => {
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId ? { ...task, status: 'Completed' } : task));
  };

  const markTaskUnableToComplete = (taskId: string, reason: string) => {
    const unableToCompleteReason = reason.trim();
    if (!unableToCompleteReason) return;
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId ? { ...task, status: 'Unable to Complete', unableToCompleteReason } : task));
  };

  const startTask = (taskId: string) => {
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId ? { ...task, status: 'In Progress' } : task));
  };

  const reopenTask = (taskId: string) => {
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId ? { ...task, status: 'In Progress' } : task));
  };

  if (status === 'loading') {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.blueBright} size="large" /></View>;
  }

  if (status !== 'signedIn') return <LoginScreen />;

  return (
    <>
      {screen === 'login' ? <LoginScreen /> : null}
      {screen === 'home' ? <StaffHomeScreen publicationState={firestoreRosterEnabled?publication.state:undefined} hasUnreadAlerts={hasUnreadAlerts} onNavigate={navigate} onOpenAlerts={() => setNotificationTrayOpen(true)} onOpenEmergencyAlert={() => openAlerts('home', alerts.find((alert) => alert.category === 'high')?.id ?? null)} onOpenProfile={() => openProfile('home')} onOpenRoster={() => openRoster('day')} onOpenTaskDetail={(taskId) => openTaskDetail(taskId, 'home')} profile={profile} tasks={activeTasks} /> : null}
      {screen === 'roster' ? <StaffWeeklyRosterScreen hasUnreadAlerts={hasUnreadAlerts} initialView={rosterInitialView} publication={firestoreRosterEnabled?{state:publication.state,weekStart:rosterWeekStart,onWeekChange:setRosterWeekStart,retry:publication.retry,history:rosterHistory,onHistoryChange:setRosterHistory}:undefined} onNavigate={navigate} onOpenAlerts={() => setNotificationTrayOpen(true)} onOpenProfile={() => openProfile('roster')} onOpenTaskDetail={(taskId) => openTaskDetail(taskId, 'roster')} profile={profile} tasks={activeTasks} /> : null}
      {screen === 'taskDetail' && selectedTask ? <StaffTaskDetailScreen onRefreshRoster={() => { setScreen('roster'); publication.retry(); }} onProgressSaved={(id, progress) => setTasks(current => current.map(task => task.id === id ? { ...task, status: progress.status, unableToCompleteReason: progress.unableToCompleteReason } : task))} hasUnreadAlerts={hasUnreadAlerts} onBack={() => setScreen(taskDetailOrigin)} onMarkComplete={markTaskComplete} onMarkUnableToComplete={markTaskUnableToComplete} onNavigate={navigate} onOpenAlerts={() => setNotificationTrayOpen(true)} onReopenTask={reopenTask} onStartTask={startTask} task={selectedTask} /> : null}
      {screen === 'alerts' ? <StaffAlertsScreen alerts={alerts} initialAlertId={alertInitialId} onMarkAllRead={markAllAlertsRead} onMarkRead={markAlertRead} onNavigate={navigate} onOpenNotifications={() => setNotificationTrayOpen(true)} onOpenProfile={() => openProfile('alerts')} profile={profile} /> : null}
      {screen === 'profile' ? <StaffProfileScreen hasUnreadAlerts={hasUnreadAlerts} onDismissSaveNotice={() => setProfileSaveNotice(false)} onEditProfile={() => setScreen('editProfile')} onNavigate={navigate} onOpenNotifications={() => setNotificationTrayOpen(true)} onOpenProfile={() => setScreen('profile')} onSignOut={signOut} profile={profile} showSaveNotice={profileSaveNotice} tasks={activeTasks} /> : null}
      {screen === 'editProfile' ? <StaffEditProfileScreen hasUnreadAlerts={hasUnreadAlerts} onBack={() => setScreen('profile')} onNavigate={navigate} onOpenNotifications={() => setNotificationTrayOpen(true)} onSave={saveProfile} profile={profile} /> : null}
      <NotificationTray alerts={alerts} onClose={() => setNotificationTrayOpen(false)} onMarkAllRead={markAllAlertsRead} onOpenAlert={openTrayAlert} onViewAll={viewAllAlerts} visible={notificationTrayOpen} />
      {trayAlertDetail ? <AlertDetailSheet alert={trayAlertDetail} onClose={() => setTrayAlertDetailId(null)} onNavigate={navigate} /> : null}
    </>
  );
}

// Notification fixtures remain local; requested live mode uses the restored Auth UID.
function StaffSession() {
  const { status, user, employee } = useAuth();
  if (status === 'loading') return <View style={styles.loadingScreen}><ActivityIndicator color={colors.blueBright} size="large" /></View>;
  if (status !== 'signedIn' || !user || !employee) return <LoginScreen />;
  return <NotificationsProvider key={user.uid} staffId={employee.employeeId}><AppContent /></NotificationsProvider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StaffSession />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  terminal: { backgroundColor: colors.canvas, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexGrow: 1, margin: 8, overflow: 'hidden', padding: 18 },
  terminalCompact: { margin: 6, padding: 14 },
  terminalVeryCompact: { borderRadius: 14, paddingVertical: 10 },
  techBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvasSoft, opacity: 0.72 },
  gridLineHorizontal: { backgroundColor: '#10243a', height: 1, left: 0, opacity: 0.55, position: 'absolute', right: 0 },
  gridLineVertical: { backgroundColor: '#10243a', bottom: 0, opacity: 0.38, position: 'absolute', top: 0, width: 1 },
  circuitTop: { borderBottomWidth: 1, borderColor: '#1f3a57', borderRightWidth: 1, height: 58, position: 'absolute', right: 26, top: 0, width: 76 },
  circuitRight: { borderColor: '#203954', borderLeftWidth: 1, borderTopWidth: 1, height: 90, position: 'absolute', right: 0, top: '39%', width: 24 },
  redRail: { backgroundColor: colors.red, height: 48, left: 0, opacity: 0.9, position: 'absolute', top: '28%', width: 2 },
  blueRail: { backgroundColor: colors.blueBright, bottom: '18%', height: 58, opacity: 0.85, position: 'absolute', right: 0, width: 2 },
  redPips: { color: colors.red, fontSize: 17, left: 8, letterSpacing: 4, opacity: 0.7, position: 'absolute', top: 112, transform: [{ rotate: '90deg' }] },
  blueCross: { color: colors.blueBright, fontSize: 19, opacity: 0.55, position: 'absolute', right: 22, top: '19%' },
  terminalHeader: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 30, zIndex: 1 },
  accessHeader: { alignItems: 'center', flexDirection: 'row' },
  cornerMark: { borderLeftWidth: 2, borderTopWidth: 2, height: 18, marginRight: 8, width: 18 },
  accessText: { color: colors.red, fontSize: 10, letterSpacing: 0.8 },
  statusBlock: { alignItems: 'flex-end' },
  statusLabel: { color: '#58789d', fontSize: 9, letterSpacing: 0.6 },
  online: { color: colors.blueBright, fontSize: 11, letterSpacing: 0.8, marginTop: 3 },
  onlineDot: { color: '#43d9ff', fontSize: 7 },
  brandBlock: { alignItems: 'center', marginTop: 15 },
  brandBlockCompact: { marginTop: 7 },
  emblemOrbit: { alignItems: 'center', borderColor: '#153b61', borderRadius: 49, borderWidth: 1, height: 98, justifyContent: 'center', width: 98 },
  emblemOrbitCompact: { borderRadius: 42, height: 84, width: 84 },
  emblemOrbitVeryCompact: { borderRadius: 35, height: 70, width: 70 },
  orbitTickTop: { backgroundColor: colors.blue, height: 2, position: 'absolute', top: -2, width: 14 },
  orbitTickRight: { backgroundColor: colors.blue, height: 14, position: 'absolute', right: -2, width: 2 },
  wordmark: { fontSize: 42, fontWeight: '800', letterSpacing: 0.5, marginTop: 8 },
  wordmarkCompact: { fontSize: 36, marginTop: 4 },
  wordmarkWhite: { color: colors.text },
  wordmarkBlue: { color: colors.blueBright },
  subtitle: { color: '#9aabc6', fontSize: 11, letterSpacing: 3.2, marginTop: 2 },
  subtitleCompact: { fontSize: 9, letterSpacing: 2.7 },
  rule: { backgroundColor: '#213a59', height: 1, marginTop: 10, width: '82%' },
  ruleCompact: { marginTop: 6 },
  ruleCenter: { alignSelf: 'center', backgroundColor: colors.blueBright, height: 3, marginTop: -1, width: 3 },
  form: { marginTop: 13, zIndex: 1 },
  formCompact: { marginTop: 7 },
  securityNote: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 9 },
  securityNoteCompact: { marginBottom: 5 },
  shield: { color: colors.blueBright, fontSize: 18, marginRight: 8 },
  securityText: { color: colors.textMuted, fontSize: 13 },
  demoPanel: { alignItems: 'center', backgroundColor: '#07182a', borderColor: '#22527e', borderRadius: 2, borderWidth: 1, flexDirection: 'row', marginBottom: 10, minHeight: 52, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 7 },
  demoPanelCompact: { marginBottom: 7, minHeight: 48, paddingVertical: 5 },
  demoIcon: { alignItems: 'center', borderColor: colors.blueBright, borderRadius: 12, borderWidth: 1, height: 24, justifyContent: 'center', marginRight: 10, width: 24 },
  demoIconText: { color: colors.blueBright, fontSize: 13, fontWeight: '800' },
  demoCopy: { flex: 1 },
  demoTitle: { color: colors.blueBright, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  demoBody: { color: '#a9bad1', fontSize: 11, lineHeight: 15, marginTop: 1 },
  formMessage: { color: '#ff8a80', fontSize: 12, lineHeight: 17, marginBottom: 9, marginTop: -3, textAlign: 'center' },
  panelTopAccent: { backgroundColor: colors.blueBright, height: 1, position: 'absolute', right: 0, top: 0, width: 42 },
  panelBottomAccent: { backgroundColor: colors.blue, bottom: 0, height: 1, left: 0, position: 'absolute', width: 42 },
  fieldIcon: { color: '#a7bad7', fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  eye: { color: '#b3c5e3', fontSize: 26 },
  fieldGap: { height: 8 },
  optionsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11, marginTop: 9 },
  optionsRowCompact: { marginBottom: 7, marginTop: 5 },
  rememberButton: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
  checkbox: { alignItems: 'center', borderColor: '#657897', borderRadius: 3, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.blueDeep, borderColor: colors.blueBright },
  check: { color: 'white', fontSize: 13, fontWeight: '800' },
  rememberText: { color: colors.textMuted, fontSize: 13, marginLeft: 8 },
  textButton: { justifyContent: 'center', minHeight: 44 },
  link: { color: colors.blueBright, fontSize: 13, textDecorationLine: 'underline' },
  signIn: { alignItems: 'center', backgroundColor: '#1264c4', borderColor: colors.blueBright, borderRadius: 2, borderWidth: 1, flexDirection: 'row', height: 56, justifyContent: 'center', overflow: 'hidden', shadowColor: colors.blue, shadowOpacity: 0.7, shadowRadius: 9 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  buttonDotGrid: { alignItems: 'center', backgroundColor: '#1d75d7', height: '100%', justifyContent: 'center', left: 0, opacity: 0.65, position: 'absolute', width: 62 },
  buttonDots: { color: '#56c7ff', fontSize: 13, letterSpacing: 3, lineHeight: 12 },
  signInText: { color: 'white', fontSize: 21, fontWeight: '600' },
  arrow: { color: 'white', fontSize: 30, position: 'absolute', right: 19 },
  sso: { alignItems: 'center', backgroundColor: colors.panelDeep, borderColor: colors.border, borderRadius: 2, borderWidth: 1, flexDirection: 'row', height: 56, marginTop: 11, overflow: 'hidden', paddingHorizontal: 14 },
  ssoCompact: { marginTop: 7 },
  ssoBadge: { alignItems: 'center', backgroundColor: '#0b1c2f', borderColor: '#315b89', borderRadius: 3, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  ssoShield: { color: colors.blueBright, fontSize: 18 },
  ssoText: { color: '#66a9ff', flex: 1, fontSize: 16, marginHorizontal: 8, textAlign: 'center' },
  ssoArrow: { color: '#66a9ff', fontSize: 29 },
  footer: { alignItems: 'center', marginTop: 'auto', paddingTop: 16 },
  footerCompact: { paddingTop: 9 },
  authorisedRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  footerRedLine: { backgroundColor: colors.red, height: 1, marginHorizontal: 10, width: 24 },
  authorised: { color: '#8c9bb1', fontSize: 8, letterSpacing: 2 },
  version: { color: '#60718a', fontSize: 9, marginTop: 5 },
});
