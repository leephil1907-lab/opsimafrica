import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Headset,
  Home,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
  FileChartColumn,
  Blocks,
  AlertCircle,
} from 'lucide-react';
import { Context, useOps } from './context';
import { api, post } from './lib/api';
import { dateLabel, relative } from './lib/utils';
import {
  Avatar,
  Dialog,
  EmptyState,
  Logo,
  ScenarioIcon,
  TaskCheck,
  WarehouseArt,
} from './components/ui';
import type { ActiveSession, AppData, Page, Scenario } from './types';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Team from './pages/Team';
import Reports from './pages/Reports';
import Builder from './pages/Builder';
import Settings from './pages/Settings';
import type { LabLaunch } from './receiving/ReceivingLab';
const ReceivingLab = lazy(() => import('./receiving/ReceivingLab'));
const SessionPlayer = lazy(() => import('./components/SessionPlayer'));

const navItems = [
  { id: 'receiving', label: 'Practice lab', icon: Headset },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'library', label: 'Training library', icon: BookOpen },
  { id: 'team', label: 'Team performance', icon: Users },
  { id: 'reports', label: 'Reports & insights', icon: FileChartColumn },
] as const;
const pageNames: Record<Page, string> = {
  receiving: 'Receiving practice',
  overview: 'Overview',
  library: 'Training library',
  team: 'Team performance',
  reports: 'Reports & insights',
  builder: 'Scenario builder',
  settings: 'Workspace settings',
};
const validPages = Object.keys(pageNames);
function initialPage(): Page {
  const value = window.location.hash.replace('#', '').split('?')[0];
  return validPages.includes(value) ? (value as Page) : 'receiving';
}
interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState<Page>(initialPage);
  const [days, setDays] = useState(30);
  const [labLaunch, setLabLaunch] = useState<LabLaunch>(() => ({
    runId: new URLSearchParams(location.hash.split('?')[1] || '').get('run') || undefined,
    nonce: 0,
  }));
  const [search, setSearch] = useState(false);
  const [help, setHelp] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [notifications, setNotifications] = useState(false);
  const [notifRead, setNotifRead] = useState(
    () => localStorage.getItem('opssim-notifications-read') || '',
  );
  const [workspacePopover, setWorkspacePopover] = useState(false);
  const [selected, setSelected] = useState<{ scenario: Scenario; memberId?: string } | null>(null);
  const [assigning, setAssigning] = useState<{ memberId?: string } | null>(null);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [templateId, setTemplateId] = useState('receiving');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const refresh = useCallback(async () => {
    const loaded = await api<AppData>('/bootstrap');
    setData(loaded);
    setLoadError('');
  }, []);
  useEffect(() => {
    refresh().catch((e) => setLoadError(e.message));
  }, [refresh]);
  const navigate = useCallback((target: Page) => {
    setPage(target);
    if (target === 'receiving') setLabLaunch({ nonce: Date.now() });
    window.location.hash = target;
    setSidebar(false);
    setWorkspacePopover(false);
    setNotifications(false);
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const handle = () => {
      setPage(initialPage());
      if (initialPage() === 'receiving') {
        const runId =
          new URLSearchParams(location.hash.split('?')[1] || '').get('run') || undefined;
        if (runId)
          setLabLaunch((current) =>
            current.runId === runId ? current : { runId, nonce: Date.now() },
          );
      }
      setSidebar(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearch((s) => !s);
      }
      if (event.key === 'Escape') {
        setNotifications(false);
        setWorkspacePopover(false);
        setSidebar(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    window.setTimeout(() => setToasts((t) => t.filter((item) => item.id !== id)), 6000);
  }, []);
  const openScenario = (scenario: Scenario, memberId?: string) => {
    if (scenario.engine === 'receiving-lab') {
      navigate('receiving');
      setLabLaunch({ memberId, fresh: true, nonce: Date.now() });
      setSearch(false);
      setNotifications(false);
      return;
    }
    setSelected({ scenario, memberId });
    setSearch(false);
    setNotifications(false);
  };
  const viewSession = async (id: string) => {
    try {
      const s = await api<ActiveSession>(`/sessions/${id}`);
      if (s.engine === 'receiving-lab') {
        navigate('receiving');
        setLabLaunch({ runId: id, nonce: Date.now() });
        history.replaceState(null, '', `#receiving?run=${id}`);
        setNotifications(false);
        return;
      }
      setActive(s);
      setNotifications(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const customize = (id: string) => {
    if (id === 'retail-receiving-lab') {
      navigate('receiving');
      setLabLaunch({ role: 'trainer', fresh: true, nonce: Date.now() });
      setSelected(null);
      return;
    }
    setTemplateId(id);
    setSelected(null);
    navigate('builder');
  };
  async function startSession(scenarioId: string, memberId: string) {
    const session = await post<ActiveSession>('/sessions', { scenarioId, memberId });
    setSelected(null);
    setActive(session);
    void refresh();
  }
  if (!data)
    return (
      <div className="app-loading">
        <Logo />
        <div>
          {loadError ? (
            <>
              <AlertCircle size={24} />
              <h2>Let's reconnect to your workspace.</h2>
              <p>{loadError}</p>
              <button
                className="button primary"
                onClick={() => refresh().catch((e) => setLoadError(e.message))}
              >
                Try again <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <LoaderCircle size={25} className="spin" />
              <p>Getting your training floor ready…</p>
            </>
          )}
        </div>
        <small>REAL PRACTICE. REAL-WORLD CONFIDENCE.</small>
      </div>
    );
  const pendingAssignments = data.assignments.filter((a) => a.status === 'pending');
  const realSessions = data.sessions.filter((s) => !s.demo && s.status === 'completed').slice(0, 4);
  const notificationSignature = [
    ...pendingAssignments.map((a) => a.id),
    ...realSessions.map((s) => s.id),
  ]
    .sort()
    .join(',');
  const unread =
    notifRead === notificationSignature
      ? 0
      : Math.min(9, pendingAssignments.length + realSessions.length);
  return (
    <Context.Provider
      value={{
        data,
        days,
        setDays,
        page,
        navigate,
        refresh,
        openScenario,
        viewSession,
        toast,
        customize,
        templateId,
        assign: (memberId) => setAssigning({ memberId }),
      }}
    >
      <div className={`app-shell ${data.settings.reduceMotion ? 'reduce-motion' : ''}`}>
        {sidebar && <div className="sidebar-shade" onClick={() => setSidebar(false)} />}
        <aside
          inert={Boolean(active) || (isMobile && !sidebar)}
          className={`sidebar ${sidebar ? 'is-open' : ''}`}
        >
          <div className="sidebar-brand">
            <Logo />
            <button
              className="icon-button mobile-sidebar-close"
              onClick={() => setSidebar(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>
          <div className="workspace-switch-container">
            <button
              className="workspace-switch"
              onClick={() => setWorkspacePopover(!workspacePopover)}
              aria-expanded={workspacePopover}
            >
              <span className="workspace-symbol">
                <Box size={19} strokeWidth={1.5} />
              </span>
              <span>
                <strong>{data.settings.workspaceName}</strong>
                <small>Team workspace</small>
              </span>
              <ChevronDown size={14} />
            </button>
            {workspacePopover && (
              <div className="workspace-popover">
                <small>YOUR WORKSPACE</small>
                <strong>{data.settings.workspaceName}</strong>
                <p>
                  {data.members.length} learners · {data.scenarios.length} scenarios
                </p>
                <button onClick={() => navigate('settings')}>
                  <Settings2 size={15} />
                  Workspace settings
                  <ArrowUpRight size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="nav-section-label">WORKSPACE</div>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <item.icon size={18} strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.id === 'library' && <small>{data.scenarios.length}</small>}
                {page === item.id && <span className="nav-active-dot" />}
              </button>
            ))}
          </nav>
          <div className="nav-section-label tools-label">MAKE IT YOURS</div>
          <nav className="main-nav" aria-label="Workspace tools">
            <button
              className={`nav-item ${page === 'builder' ? 'active' : ''}`}
              onClick={() => navigate('builder')}
            >
              <Blocks size={18} strokeWidth={1.7} />
              <span>Scenario builder</span>
              <span className="new-label">NEW</span>
            </button>
            <button
              className={`nav-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => navigate('settings')}
            >
              <Settings2 size={18} strokeWidth={1.7} />
              <span>Workspace settings</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="vr-promo">
              <div>
                <span className="vr-promo-icon">
                  <Headset size={21} strokeWidth={1.5} />
                </span>
                <span className="little-star">✦</span>
              </div>
              <h3>Step into the work.</h3>
              <p>
                A little more immersive.
                <br />A lot more hands-on.
              </p>
              <button onClick={() => setHelp(true)}>
                Explore VR training <ArrowUpRight size={15} />
              </button>
              <span className="vr-promo-watermark">
                <Box size={81} strokeWidth={0.8} />
              </span>
            </div>
            <button className="help-link" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              <span>Help & getting started</span>
              <ArrowUpRight size={14} />
            </button>
            <button className="sidebar-profile" onClick={() => navigate('settings')}>
              <Avatar name={data.settings.managerName} image />
              <span>
                <strong>{data.settings.managerName}</strong>
                <small>Operations manager</small>
              </span>
              <ChevronRight size={15} />
            </button>
          </div>
        </aside>
        <div className="main-shell" inert={Boolean(active)}>
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                onClick={() => setSidebar(true)}
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </button>
              <span className="breadcrumb-home">
                <Home size={15} />
              </span>
              <ChevronRight size={12} className="breadcrumb-chevron" />
              <span>{pageNames[page]}</span>
            </div>
            <div className="topbar-right">
              <button className="global-search" onClick={() => setSearch(true)}>
                <Search size={16} />
                <span>Search anything…</span>
                <kbd>
                  <Command size={10} /> K
                </kbd>
              </button>
              <span className="topbar-separator" />
              <span className="workspace-live-badge">
                <span className="live-dot" />
                Shared workspace
              </span>
              <div className="notification-container">
                <button
                  className={`icon-button notification-button ${notifications ? 'active' : ''}`}
                  aria-label="Notifications"
                  aria-expanded={notifications}
                  onClick={() => setNotifications(!notifications)}
                >
                  <Bell size={19} />
                  {unread > 0 && <i />}
                </button>
                {notifications && (
                  <div className="notification-popover">
                    <div className="popover-title">
                      <h3>Your workspace, in motion</h3>
                      <button
                        className="text-button small"
                        onClick={() => {
                          setNotifRead(notificationSignature);
                          localStorage.setItem('opssim-notifications-read', notificationSignature);
                        }}
                      >
                        Mark read <CheckCheck size={13} />
                      </button>
                    </div>
                    {realSessions.map((s) => (
                      <button
                        className="notification-item"
                        key={s.id}
                        onClick={() => void viewSession(s.id)}
                      >
                        <span className="notification-type">
                          <CheckCheck size={17} />
                        </span>
                        <span>
                          <strong>{s.memberName.split(' ')[0]} completed a session</strong>
                          <p>
                            {s.scenarioTitle} · {s.score}/100
                          </p>
                          <small>{relative(s.completedAt!)}</small>
                        </span>
                      </button>
                    ))}
                    {pendingAssignments.slice(0, 3).map((a) => {
                      const m = data.members.find((m) => m.id === a.memberId);
                      const s = data.scenarios.find((s) => s.id === a.scenarioId);
                      return m && s ? (
                        <button
                          className="notification-item"
                          key={a.id}
                          onClick={() => openScenario(s, m.id)}
                        >
                          <span className="notification-type assignment">
                            <Clock3 size={17} />
                          </span>
                          <span>
                            <strong>A little practice for {m.name.split(' ')[0]}</strong>
                            <p>{s.title}</p>
                            <small>Due {dateLabel(a.dueDate, true)}</small>
                          </span>
                        </button>
                      ) : null;
                    })}
                    {!pendingAssignments.length && !realSessions.length && (
                      <EmptyState
                        title="All quiet on the training floor"
                        text="Updates will appear as your team gets practising."
                      />
                    )}
                    <button className="notification-footer" onClick={() => navigate('reports')}>
                      See the training log <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
              <button
                className="topbar-avatar"
                aria-label="Open your settings"
                onClick={() => navigate('settings')}
              >
                <Avatar name={data.settings.managerName} image size="small" />
              </button>
            </div>
          </header>
          <main ref={mainRef} id="main-content">
            {page === 'receiving' ? (
              <Suspense
                fallback={
                  <div className="page">
                    <LoaderCircle className="spin" /> Opening the practice lab…
                  </div>
                }
              >
                <ReceivingLab launch={labLaunch} />
              </Suspense>
            ) : page === 'overview' ? (
              <Dashboard />
            ) : page === 'library' ? (
              <Library />
            ) : page === 'team' ? (
              <Team />
            ) : page === 'reports' ? (
              <Reports />
            ) : page === 'builder' ? (
              <Builder key={templateId} />
            ) : (
              <Settings />
            )}
          </main>
        </div>
        {selected && (
          <ScenarioDetail
            scenario={selected.scenario}
            memberId={selected.memberId}
            onClose={() => setSelected(null)}
            onStart={startSession}
          />
        )}
        {assigning && (
          <AssignDialog memberId={assigning.memberId} onClose={() => setAssigning(null)} />
        )}
        {search && <SearchDialog onClose={() => setSearch(false)} />}
        {help && <HelpDialog onClose={() => setHelp(false)} />}
        {active && (
          <Suspense
            fallback={
              <div className="session-loading">
                <LoaderCircle className="spin" size={30} />
                <h3>Preparing your training floor…</h3>
              </div>
            }
          >
            <SessionPlayer
              key={active.id}
              session={active}
              onUpdate={setActive}
              onClose={() => {
                setActive(null);
                void refresh();
              }}
              onRestart={(s) => {
                startSession(s.scenarioId, s.memberId).catch((e) => toast(e.message, 'error'));
              }}
            />
          </Suspense>
        )}
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div className={`toast ${t.type}`} key={t.id}>
              {t.type === 'success' ? <CheckCheck size={18} /> : <AlertCircle size={18} />}
              <span>{t.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setToasts((v) => v.filter((item) => item.id !== t.id))}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Context.Provider>
  );
}

function ScenarioDetail({
  scenario,
  memberId,
  onClose,
  onStart,
}: {
  scenario: Scenario;
  memberId?: string;
  onClose: () => void;
  onStart: (scenarioId: string, memberId: string) => Promise<void>;
}) {
  const { data, customize, toast } = useOps();
  const [learner, setLearner] = useState(memberId || data.members[0]?.id || '');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="Your next real-world challenge"
      onClose={() => !busy && onClose()}
      wide
      className="scenario-detail-modal"
    >
      <div className={`detail-visual ${scenario.color}`}>
        <div>
          <span className="eyebrow">
            <ScenarioIcon icon={scenario.icon} size={14} />
            {scenario.category} · {scenario.industry}
          </span>
          <h2>{scenario.title}</h2>
          <p>{scenario.subtitle}</p>
          <div className="detail-tags">
            <span>{scenario.difficulty}</span>
            <span>
              <Clock3 size={12} />
              {scenario.duration} min
            </span>
            <span>{scenario.steps.length} tasks</span>
          </div>
        </div>
        <WarehouseArt variant={scenario.scene} />
      </div>
      <div className="detail-body">
        <div className="detail-main">
          <h4>The situation</h4>
          <p>{scenario.briefing}</p>
          <h4>The skills that stick</h4>
          <div className="skill-tags">
            {scenario.skills.map((skill) => (
              <span key={skill}>
                <Check size={12} />
                {skill}
              </span>
            ))}
          </div>
          <div className="detail-device-note">
            <Headset size={18} />
            <p>
              Start here with mouse or touch. Enter VR from the session if you're using a compatible
              Quest browser.
            </p>
          </div>
        </div>
        <div className="detail-objectives">
          <h4>YOUR WORKFLOW</h4>
          {scenario.steps.map((task, i) => (
            <div key={task.id}>
              <TaskCheck checked={false} index={i} />
              <span>{task.title}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="detail-start-row">
        <label className="field">
          Who's practising?
          <select
            value={learner}
            onChange={(e) => setLearner(e.target.value)}
            aria-label="Choose learner"
          >
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => customize(scenario.id)}
          >
            Customise
          </button>
          <button
            className="button primary"
            disabled={busy || !learner}
            onClick={async () => {
              setBusy(true);
              try {
                await onStart(scenario.id, learner);
              } catch (e) {
                toast((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUpRight size={16} />}{' '}
            {busy ? 'Starting…' : 'Start training'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function AssignDialog({ memberId, onClose }: { memberId?: string; onClose: () => void }) {
  const { data, refresh, toast } = useOps();
  const [member, setMember] = useState(memberId || data.members[0]?.id || '');
  const [scenario, setScenario] = useState(data.scenarios[0]?.id || '');
  const [due, setDue] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="A little practice on the horizon"
      description="Give a learner a clear, achievable training goal."
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await post('/assignments', { memberId: member, scenarioId: scenario, dueDate: due });
            await refresh();
            toast('Training assigned. The next step is on the calendar.');
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-body">
          <label className="field">
            Learner
            <select
              aria-label="Learner"
              value={member}
              onChange={(e) => setMember(e.target.value)}
              required
            >
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Training scenario
            <select
              aria-label="Training scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              required
            >
              {data.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Complete by
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <div className="form-info">
            <InfoIcon />
            <p>
              The assignment appears in your workspace's training queue. It is marked complete
              automatically when this learner finishes the scenario. No external email is sent.
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Assigning…' : 'Assign training'}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function InfoIcon() {
  return <CircleHelp size={17} />;
}
function SearchDialog({ onClose }: { onClose: () => void }) {
  const { data, openScenario, navigate } = useOps();
  const [query, setQuery] = useState('');
  const scenarios = data.scenarios
    .filter((s) =>
      `${s.title} ${s.skills.join(' ')} ${s.category}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 5);
  const links = Object.entries(pageNames)
    .filter(([, name]) => name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4);
  return (
    <Dialog title="Find your next step" onClose={onClose} className="search-dialog">
      <label className="command-search">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search workspace"
          placeholder="Find a scenario, page, or skill…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>ESC</kbd>
      </label>
      <div className="search-results">
        {scenarios.length > 0 && <h4>TRAINING SCENARIOS</h4>}
        {scenarios.map((s) => (
          <button key={s.id} onClick={() => openScenario(s)}>
            <span className={`search-result-icon ${s.color}`}>
              <ScenarioIcon icon={s.icon} size={18} />
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>
                {s.category} · {s.duration} minutes
              </small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {links.length > 0 && <h4>GO TO</h4>}
        {links.map(([id, name]) => (
          <button
            key={id}
            onClick={() => {
              navigate(id as Page);
              onClose();
            }}
          >
            <span className="search-result-icon">
              <Activity size={17} />
            </span>
            <strong>{name}</strong>
            <ArrowRight size={16} />
          </button>
        ))}
        {!scenarios.length && !links.length && (
          <EmptyState
            title="Nothing here yet"
            text="Try a skill such as stock, cash, picking, or safety."
          />
        )}
      </div>
      <div className="command-footer">
        <span>
          <Search size={12} />
          Search your shared workspace
        </span>
        <span>Click a result to open</span>
      </div>
    </Dialog>
  );
}
function HelpDialog({ onClose }: { onClose: () => void }) {
  const { navigate } = useOps();
  return (
    <Dialog
      title="A better shift starts with practice"
      description="Welcome to OpsSim Africa. Here's how to get started."
      onClose={onClose}
      wide
    >
      <div className="help-guide">
        <div>
          <span className="help-step">01</span>
          <div>
            <h3>Pick a real-world challenge</h3>
            <p>
              Choose receiving, picking, cash reconciliation, or safety. Each session is short,
              repeatable, and built around practical decisions.
            </p>
          </div>
        </div>
        <div>
          <span className="help-step">02</span>
          <div>
            <h3>Learn by doing</h3>
            <p>
              Read your briefing, inspect the 3D stockroom, and work through each task. Use the
              object buttons if you prefer. Mistakes give you immediate hints.
            </p>
          </div>
        </div>
        <div>
          <span className="help-step">03</span>
          <div>
            <h3>Bring the learning back to work</h3>
            <p>
              Review scores and mistakes with your team. Compare the first and second halves of
              training in Reports, and assign the next useful session.
            </p>
          </div>
        </div>
        <div className="help-vr">
          <Headset size={27} />
          <div>
            <h3>Want to step inside?</h3>
            <p>
              Open this app's direct HTTPS URL in a compatible Quest browser. Start a session, then
              select Enter VR. Controllers and experimental pinch-based hand interaction are
              supported in the immersive task board. Physical-headset validation is required; this
              is not a native Quest APK.
            </p>
          </div>
        </div>
        <div className="help-privacy">
          <ShieldCheck size={18} />
          <p>
            This is a shared, no-sign-in workspace. Use fictional names in a public demo. Sample
            results are clearly labelled. Training scores are not professional certification.
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={() => {
            navigate('settings');
            onClose();
          }}
        >
          Devices & settings
        </button>
        <button
          className="button primary"
          onClick={() => {
            navigate('library');
            onClose();
          }}
        >
          Explore the training floor <ArrowUpRight size={15} />
        </button>
      </div>
    </Dialog>
  );
}
