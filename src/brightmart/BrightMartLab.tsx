import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Hand,
  Headset,
  Layers3,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useOps } from '../context';
import { api, post, put } from '../lib/api';
import type { LabLaunch } from '../receiving/ReceivingLab';
import type {
  BoardButton,
  BoardView,
  LabBootstrap,
  LabSceneHandle,
  SceneState,
  Zone,
} from '../receiving/types';
import type {
  BrightBootstrap,
  BrightCondition,
  BrightConfig,
  BrightItem,
  BrightPhase,
  BrightRun,
  BrightZone,
  ItemRecord,
} from './types';
import './brightmart.css';
const Scene = lazy(() =>
  import('../receiving/ReceivingScene').then((m) => ({ default: m.ReceivingScene })),
);
const defaultConfig: BrightConfig = { variant: 'standard', targetSeconds: 360, focus: 'complete' };
const conditionOptions: BrightCondition[] = ['Good', 'Damaged', 'Expired', 'Mismatch'];
const dispositionOptions = [
  ['accept', 'Accept sound units'],
  ['quarantine', 'Quarantine'],
  ['return', 'Return to supplier'],
] as const;
const zoneLabels: Record<BrightZone, string> = {
  health: 'Health & Wellness',
  grocery: 'Grocery & Household',
  quarantine: 'Quarantine / returns',
};
const failureLabels: Record<string, string> = {
  quantity: 'Quantity checks',
  storage: 'Shelf classification',
  damage: 'Damage inspection',
  expiry: 'Expiry checks',
  label: 'Product-label matching',
  unnecessary: 'Unnecessary quarantine',
  process: 'Process order',
};
const focusLabels: Record<BrightConfig['focus'], string> = {
  complete: 'Complete receiving loop',
  exceptions: 'Exception handling',
  recording: 'Quantity recording',
};
const fmt = (v: number) =>
  `${Math.floor(Math.max(0, v) / 60)}:${String(Math.floor(Math.max(0, v)) % 60).padStart(2, '0')}`;
const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* Preferences must not block training. */
    }
  },
};
function textPages(lines: string[]) {
  const wrapped: string[] = [];
  for (const line of lines) {
    let part = '';
    for (const word of line.split(' ')) {
      if ((part + ' ' + word).length > 52 && part) {
        wrapped.push(part);
        part = word;
      } else part = part ? part + ' ' + word : word;
    }
    if (part) wrapped.push(part);
  }
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 6) pages.push(wrapped.slice(i, i + 6));
  return pages.length ? pages : [[]];
}
function draftFor(run: BrightRun, item: BrightItem): ItemRecord {
  if (run.records[item.id]) return run.records[item.id];
  try {
    const d = JSON.parse(storage.get('opssim-brightmart-drafts:' + run.id) || '{}')[item.id];
    if (
      d &&
      Number.isInteger(d.receivedUnits) &&
      d.receivedUnits >= 0 &&
      d.receivedUnits <= 9999 &&
      conditionOptions.includes(d.condition) &&
      ['accept', 'quarantine', 'return'].includes(d.disposition)
    )
      return d;
  } catch {
    /* Ignore damaged local data. */
  }
  return {
    receivedUnits: item.expectedUnits,
    condition: 'Good',
    disposition: 'accept',
    note: 'No extra note',
  };
}
function CountTile({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="bm-count-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="bm-primary" onClick={onClick} disabled={disabled}>
      {children}
      <ArrowRight size={18} />
    </button>
  );
}

export default function BrightMartLab({ launch }: { launch?: LabLaunch }) {
  const { data, refresh } = useOps();
  const [lab, setLab] = useState<BrightBootstrap | null>(null),
    [shared, setShared] = useState<LabBootstrap | null>(null);
  const [config, setConfig] = useState<BrightConfig>(defaultConfig),
    [memberId, setMemberId] = useState(
      launch?.memberId ||
        storage.get('opssim-brightmart-member') ||
        data.members.find((m) => m.id === 'ada')?.id ||
        data.members[0].id,
    );
  const [phase, setPhase] = useState<BrightPhase>('profile'),
    [run, setRun] = useState<BrightRun | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemRecord>({
    receivedUnits: 0,
    condition: 'Good',
    disposition: 'accept',
    note: 'No extra note',
  });
  const [draftIdentity, setDraftIdentity] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [busy, setBusy] = useState(false);
  const [xr, setXR] = useState(false),
    [ready, setReady] = useState(false),
    [support, setSupport] = useState({ vr: false, ar: false }),
    [now, setNow] = useState(Date.now()),
    [textPage, setTextPage] = useState(0),
    [historyIndex, setHistoryIndex] = useState(0);
  const [comfort, setComfort] = useState<NonNullable<SceneState['comfort']>>(() => {
    try {
      const saved = JSON.parse(storage.get('opssim-brightmart-comfort') || '{}');
      return {
        distance: ['near', 'standard', 'far'].includes(saved?.distance)
          ? saved.distance
          : 'standard',
        seated: typeof saved?.seated === 'boolean' ? saved.seated : true,
        largeText: saved?.largeText === true,
      };
    } catch {
      return { distance: 'standard', seated: true, largeText: false };
    }
  });
  const [audio, setAudio] = useState(false),
    [noteReturn, setNoteReturn] = useState<BrightPhase>('briefing'),
    [guideReturn, setGuideReturn] = useState<BrightPhase>('profile'),
    [comfortReturn, setComfortReturn] = useState<BrightPhase>('profile'),
    [dueDays, setDueDays] = useState(7);
  const [workspaceName, setWorkspaceName] = useState(data.settings.workspaceName),
    [joinName, setJoinName] = useState(''),
    [joinCode, setJoinCode] = useState('');
  const [keyboardPurpose, setKeyboardPurpose] = useState<'name' | 'code' | 'workspace'>('name'),
    [keyboardBuffer, setKeyboardBuffer] = useState(''),
    [keyboardNumbers, setKeyboardNumbers] = useState(false),
    [keyboardReturn, setKeyboardReturn] = useState<BrightPhase>('invite');
  const scene = useRef<LabSceneHandle>(null),
    runRef = useRef<BrightRun | null>(null),
    runAt = useRef(Date.now()),
    working = useRef(false),
    audioRef = useRef<AudioContext | null>(null);
  const item = run?.manifest.items.find((i) => i.id === selectedId),
    member = data.members.find((m) => m.id === memberId) || data.members[0];
  const total = run?.manifest.items.length || (config.variant === 'harder' ? 12 : 8),
    placed = Object.keys(run?.placements || {}).length,
    inspected = run?.inspected.length || 0,
    recorded = Object.keys(run?.records || {}).length;
  const elapsed = run
    ? run.elapsedSeconds +
      (!run.paused && run.status === 'in_progress' && run.started
        ? Math.max(0, Math.floor((now - runAt.current) / 1000))
        : 0)
    : 0;
  const running = !!run && run.status === 'in_progress' && run.started && !run.paused;
  const allDone =
    !!run && run.manifest.items.every((i) => run.records[i.id] && run.placements[i.id]);
  const pending =
    lab?.assignments.filter((a) => a.memberId === memberId && a.status === 'pending') || [];
  const noteOptions = lab?.notes || [
    'No extra note',
    'Supplier follow-up',
    'Counted twice',
    'Seal issue',
    'Label issue',
  ];
  const adopt = useCallback((next: BrightRun, force = false) => {
    const current = runRef.current;
    if (current && !force && (current.id !== next.id || next.version < current.version)) return;
    runRef.current = next;
    runAt.current = Date.now();
    setRun(next);
    setConfig(next.config);
    setMemberId(next.memberId);
    storage.set('opssim-brightmart-run', next.id);
  }, []);
  const loadLab = useCallback(async () => {
    const b = await api<BrightBootstrap>('/brightmart/bootstrap');
    setLab(b);
    return b;
  }, []);
  const exclusive = useCallback(async (fn: () => Promise<void>) => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setFeedback({
        correct: false,
        message: e instanceof Error ? e.message : 'Unable to save. Reconnect and try again.',
      });
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  const pause = useCallback(async () => {
    const r = runRef.current;
    if (r?.status === 'in_progress' && r.started && !r.paused) {
      const next = await post<BrightRun>(`/brightmart/runs/${r.id}/pause`);
      adopt(next);
    }
  }, [adopt]);
  const tone = useCallback(
    (correct: boolean) => {
      if (!audio || !audioRef.current) return;
      const ctx = audioRef.current;
      void ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = correct ? 600 : 280;
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.14);
    },
    [audio],
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const [b, s] = await Promise.all([
          api<BrightBootstrap>('/brightmart/bootstrap'),
          api<LabBootstrap>('/receiving/bootstrap'),
        ]);
        if (!active) return;
        setLab(b);
        setShared(s);
        setConfig(b.defaults);
        const params = new URLSearchParams(location.hash.split('?')[1] || '');
        const invite = params.get('invite');
        if (invite) {
          setJoinCode(invite);
          setPhase('invite');
        } else if (launch?.role === 'manager') setPhase('manager');
        else if (launch?.role === 'trainer') setPhase('trainer');
        else setPhase('profile');
        if (launch?.memberId) setMemberId(launch.memberId);
        const id = launch?.runId || (!launch?.fresh ? storage.get('opssim-brightmart-run') : null);
        if (id) {
          try {
            const saved = await api<BrightRun>(`/brightmart/runs/${id}`);
            if (!active) return;
            adopt(saved, true);
            setSelectedId(
              saved.manifest.items.find((i) => !saved.placements[i.id] || !saved.records[i.id])
                ?.id || saved.manifest.items[0].id,
            );
            if (launch?.runId)
              setPhase(
                saved.status === 'completed'
                  ? 'scorecard'
                  : !saved.started
                    ? 'briefing'
                    : allItemsDone(saved)
                      ? 'summary'
                      : 'active',
              );
          } catch {
            if (launch?.runId)
              throw Error(
                'This BrightMart run could not be opened. Check the link or return to practice.',
              );
          }
        }
      } catch (e) {
        if (active)
          setLoadError(e instanceof Error ? e.message : 'Unable to open the practice lab.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      const r = runRef.current;
      if (r?.status === 'in_progress') void post(`/brightmart/runs/${r.id}/pause`).catch(() => {});
    };
  }, [launch?.nonce, adopt]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (navigator.xr)
      void Promise.all([
        navigator.xr.isSessionSupported('immersive-vr'),
        navigator.xr.isSessionSupported('immersive-ar'),
      ])
        .then(([vr, ar]) => setSupport({ vr, ar }))
        .catch(() => {});
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden')
        void pause().catch(() =>
          setFeedback({
            correct: false,
            message: 'Pause could not be saved. Reconnect before continuing.',
          }),
        );
    };
    const leave = () => {
      const r = runRef.current;
      if (r?.status === 'in_progress')
        navigator.sendBeacon(
          `/api/brightmart/runs/${r.id}/pause`,
          new Blob(['{}'], { type: 'application/json' }),
        );
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leave);
    };
  }, [pause]);
  useEffect(() => {
    storage.set('opssim-brightmart-comfort', JSON.stringify(comfort));
  }, [comfort]);
  useEffect(() => {
    setTextPage(0);
  }, [phase, selectedId, keyboardPurpose]);
  useEffect(() => {
    if (run && item) {
      setDraft(draftFor(run, item));
      setDraftIdentity(run.id + ':' + item.id);
    } else setDraftIdentity(null);
  }, [run?.id, selectedId]);
  useEffect(() => {
    // Effects see the previous render's draft during identity changes. Never
    // write that value into the newly selected carton or another run.
    if (
      !run ||
      !item ||
      draftIdentity !== run.id + ':' + item.id ||
      run.status !== 'in_progress' ||
      run.records[item.id]
    )
      return;
    try {
      const all = JSON.parse(storage.get('opssim-brightmart-drafts:' + run.id) || '{}');
      all[item.id] = draft;
      storage.set('opssim-brightmart-drafts:' + run.id, JSON.stringify(all));
    } catch {
      /* Drafts are optional; server-saved lines remain authoritative. */
    }
  }, [draft, draftIdentity, run?.id, item?.id, run?.status]);
  useEffect(
    () => () => {
      void audioRef.current?.close();
    },
    [],
  );
  function allItemsDone(r: BrightRun) {
    return r.manifest.items.every((i) => r.placements[i.id] && r.records[i.id]);
  }
  function select(id: string) {
    if (runRef.current?.paused || working.current) return;
    setSelectedId(id);
    setPhase('active');
    setFeedback(null);
  }
  function chooseMember(id: string) {
    setMemberId(id);
    storage.set('opssim-brightmart-member', id);
  }
  const perform = useCallback(
    async (body: Record<string, unknown>) => {
      const current = runRef.current;
      if (!current || working.current) return false;
      let correct = false;
      await exclusive(async () => {
        try {
          const result = await post<{
            correct: boolean;
            message: string;
            completed: boolean;
            run: BrightRun;
          }>(`/brightmart/runs/${current.id}/action`, { ...body, version: current.version });
          adopt(result.run);
          correct = result.correct;
          let message = result.message;
          if (
            result.correct &&
            body.type === 'inspect' &&
            result.run.inspected.length === result.run.manifest.items.length
          )
            message += ' Inspection stage complete: all cartons checked.';
          if (
            result.correct &&
            body.type === 'labels' &&
            result.run.labels.length === result.run.manifest.items.length
          )
            message += ' All label and date checks complete.';
          if (
            result.correct &&
            body.type === 'record-line' &&
            Object.keys(result.run.records).length === result.run.manifest.items.length
          )
            message += ' All receiving lines are now complete.';
          setFeedback({ correct: result.correct, message });
          tone(result.correct);
          if (result.correct && body.type === 'record-line') {
            setPhase(result.run.placements[String(body.itemId)] ? 'active' : 'sort');
            setDraft(result.run.records[String(body.itemId)]);
          }
          if (result.correct && body.type === 'place') {
            const next = result.run.manifest.items.find(
              (i) => !result.run.placements[i.id] || !result.run.records[i.id],
            );
            if (next) {
              setSelectedId(next.id);
              setPhase('active');
            } else setPhase('summary');
          }
          if (result.correct && body.type === 'review') setPhase('review');
          if (result.completed) {
            setPhase('scorecard');
            await Promise.all([refresh(), loadLab()]);
          }
        } catch (e) {
          try {
            const saved = await api<BrightRun>(`/brightmart/runs/${current.id}`);
            adopt(saved);
            if (saved.status === 'completed') setPhase('scorecard');
          } catch {
            /* Keep visible progress when offline. */
          }
          throw e;
        }
      });
      return correct;
    },
    [adopt, exclusive, loadLab, refresh, tone],
  );
  function prepare(nextConfig = config) {
    void exclusive(async () => {
      await pause();
      const r = await post<BrightRun>('/brightmart/runs', {
        memberId: member.id,
        config: nextConfig,
      });
      adopt(r, true);
      setSelectedId(r.manifest.items[0].id);
      setFeedback(null);
      setPhase('briefing');
      window.history.replaceState(null, '', `#brightmart?run=${r.id}`);
    });
  }
  function openNote() {
    const r = runRef.current;
    if (!r || working.current) return;
    if (phase !== 'note') setNoteReturn(phase);
    setPhase('note');
    if (!r.noteRead) void perform({ type: 'read-note' });
  }
  function begin() {
    void exclusive(async () => {
      const r = runRef.current;
      if (!r) return;
      const next = await post<BrightRun>(`/brightmart/runs/${r.id}/begin`);
      adopt(next);
      setPhase(allItemsDone(next) ? 'summary' : 'active');
      setFeedback({
        correct: true,
        message:
          'Your shift has started. Inspect the first carton, then check labels and count units.',
      });
    });
  }
  function resume() {
    void exclusive(async () => {
      const r = runRef.current;
      if (!r) return;
      if (!r.started) {
        setPhase('briefing');
        return;
      }
      const next = await post<BrightRun>(`/brightmart/runs/${r.id}/resume`);
      adopt(next);
      if (['profile', 'manager', 'trainer'].includes(phase))
        setPhase(allItemsDone(next) ? 'summary' : 'active');
      setFeedback({ correct: true, message: 'Shift resumed. Continue from your saved progress.' });
    });
  }
  function go(target: BrightPhase) {
    void exclusive(async () => {
      if (['profile', 'manager', 'trainer', 'invite'].includes(target)) await pause();
      setPhase(target);
      setFeedback(null);
    });
  }
  function changeVariant() {
    setConfig((c) => ({
      ...c,
      variant: c.variant === 'standard' ? 'harder' : 'standard',
      targetSeconds: c.variant === 'standard' ? 300 : 360,
    }));
  }
  function openKeyboard(purpose: typeof keyboardPurpose) {
    setKeyboardPurpose(purpose);
    setKeyboardBuffer(
      purpose === 'workspace' ? workspaceName : purpose === 'code' ? joinCode : joinName,
    );
    setKeyboardReturn(phase);
    setKeyboardNumbers(purpose === 'code');
    setPhase('keyboard');
  }
  async function join() {
    await exclusive(async () => {
      const m = await post<{ id: string }>('/receiving/join', {
        name: joinName,
        code: joinCode,
        jobRole: 'Shop attendant',
      });
      await refresh();
      chooseMember(m.id);
      setPhase('profile');
      setFeedback({
        correct: true,
        message: 'You joined this shared demo team. Start the BrightMart receiving lesson.',
      });
    });
  }
  async function saveWorkspace() {
    await exclusive(async () => {
      await put('/receiving/workspace', { name: workspaceName });
      await refresh();
      setFeedback({
        correct: true,
        message: 'Team name saved. This remains a shared demo workspace, not a secure tenant.',
      });
    });
  }
  async function assign() {
    await exclusive(async () => {
      const due = new Date();
      due.setDate(due.getDate() + dueDays);
      await post('/brightmart/assignments', {
        memberId: member.id,
        dueDate: due.toISOString().slice(0, 10),
        config,
      });
      await Promise.all([loadLab(), refresh()]);
      setFeedback({
        correct: true,
        message: `Receiving practice assigned to ${member.name}, due in ${dueDays} days.`,
      });
    });
  }
  async function loadRun(id: string) {
    await exclusive(async () => {
      await pause();
      const saved = await api<BrightRun>(`/brightmart/runs/${id}`);
      adopt(saved, true);
      setSelectedId(
        saved.manifest.items.find((i) => !saved.placements[i.id] || !saved.records[i.id])?.id ||
          saved.manifest.items[0].id,
      );
      setPhase(
        saved.status === 'completed'
          ? 'scorecard'
          : saved.started
            ? allItemsDone(saved)
              ? 'summary'
              : 'active'
            : 'briefing',
      );
      window.history.replaceState(null, '', `#brightmart?run=${id}`);
    });
  }
  function openComfort() {
    if (phase !== 'comfort') setComfortReturn(phase);
    setPhase('comfort');
  }
  function audioToggle() {
    if (!audio) {
      try {
        audioRef.current ||= new AudioContext();
        void audioRef.current.resume();
      } catch {
        setFeedback({
          correct: false,
          message: 'Audio is unavailable here; every cue remains visible as text.',
        });
        return;
      }
    }
    setAudio(!audio);
  }
  function adjust(n: number) {
    setDraft((d) => ({ ...d, receivedUnits: Math.max(0, Math.min(9999, d.receivedUnits + n)) }));
  }
  const place = useCallback(
    (id: string, zone: Zone) => {
      setSelectedId(id);
      return perform({
        type: 'place',
        itemId: id,
        zone: zone === 'dry' ? 'health' : zone === 'cold' ? 'grocery' : 'quarantine',
      });
    },
    [perform],
  );
  function action(id: string) {
    if (id.startsWith('select:')) {
      select(id.slice(7));
      return;
    }
    if (id.startsWith('place:')) {
      if (item) void perform({ type: 'place', itemId: item.id, zone: id.slice(6) });
      return;
    }
    if (id.startsWith('condition:')) {
      setDraft((d) => ({ ...d, condition: id.slice(10) as BrightCondition }));
      return;
    }
    if (id.startsWith('disposition:')) {
      setDraft((d) => ({ ...d, disposition: id.slice(12) as ItemRecord['disposition'] }));
      return;
    }
    if (id.startsWith('key:')) {
      setKeyboardBuffer((b) => (b + id.slice(4)).slice(0, keyboardPurpose === 'code' ? 40 : 70));
      return;
    }
    if (id.startsWith('pending:')) {
      const a = pending.find((a) => a.id === id.slice(8));
      if (a) prepare(a.config);
      return;
    }
    switch (id) {
      case 'prepare':
        prepare();
        break;
      case 'begin':
        begin();
        break;
      case 'profile':
        go('profile');
        break;
      case 'manager':
        go('manager');
        break;
      case 'trainer':
        go('trainer');
        break;
      case 'invite':
        go('invite');
        break;
      case 'join':
        void join();
        break;
      case 'invoice':
        openNote();
        break;
      case 'note-back':
        setPhase(noteReturn);
        break;
      case 'inspect':
        if (item) void perform({ type: 'inspect', itemId: item.id });
        break;
      case 'labels':
        if (item) void perform({ type: 'labels', itemId: item.id });
        break;
      case 'record':
        setPhase('record');
        break;
      case 'record-back':
        setPhase('active');
        break;
      case 'save-line':
        if (item) void perform({ type: 'record-line', itemId: item.id, record: draft });
        break;
      case 'qty-minus':
        adjust(-1);
        break;
      case 'qty-plus':
        adjust(1);
        break;
      case 'line-note':
        setDraft((d) => ({
          ...d,
          note: noteOptions[(noteOptions.indexOf(d.note) + 1) % noteOptions.length],
        }));
        break;
      case 'show-zones':
        setPhase('sort');
        break;
      case 'quarantine-now':
        if (item) void perform({ type: 'place', itemId: item.id, zone: 'quarantine' });
        break;
      case 'review':
        void perform({ type: 'review' });
        break;
      case 'submit':
        if (run?.reviewToken) void perform({ type: 'submit', reviewToken: run.reviewToken });
        break;
      case 'summary':
        setPhase('summary');
        break;
      case 'hint':
        if (running) void perform({ type: 'hint' });
        else {
          if (phase !== 'guide') setGuideReturn(phase);
          setPhase('guide');
        }
        break;
      case 'guide':
        if (phase !== 'guide') setGuideReturn(phase);
        setPhase('guide');
        break;
      case 'guide-back':
        setPhase(phase === 'comfort' ? comfortReturn : guideReturn);
        break;
      case 'comfort':
        openComfort();
        break;
      case 'distance':
        setComfort((c) => ({
          ...c,
          distance: c.distance === 'near' ? 'standard' : c.distance === 'standard' ? 'far' : 'near',
        }));
        break;
      case 'seated':
        setComfort((c) => ({ ...c, seated: !c.seated }));
        break;
      case 'large-text':
        setComfort((c) => ({ ...c, largeText: !c.largeText }));
        break;
      case 'audio':
        audioToggle();
        break;
      case 'pause':
        void exclusive(pause);
        break;
      case 'resume':
        resume();
        break;
      case 'variant':
        changeVariant();
        break;
      case 'member':
        chooseMember(
          data.members[
            (data.members.findIndex((m) => m.id === member.id) + 1) % data.members.length
          ].id,
        );
        break;
      case 'target':
        setConfig((c) => {
          const opts = [360, 300, 600, 900] as const;
          return { ...c, targetSeconds: opts[(opts.indexOf(c.targetSeconds) + 1) % opts.length] };
        });
        break;
      case 'focus':
        setConfig((c) => {
          const opts = ['complete', 'exceptions', 'recording'] as const;
          return { ...c, focus: opts[(opts.indexOf(c.focus) + 1) % 3] };
        });
        break;
      case 'save-defaults':
        void exclusive(async () => {
          await put('/brightmart/defaults', config);
          await loadLab();
          setFeedback({
            correct: true,
            message:
              'Trainer defaults saved for new runs; historical and current run snapshots are unchanged.',
          });
        });
        break;
      case 'assign':
        void assign();
        break;
      case 'due-days':
        setDueDays((v) => {
          const opts = [1, 3, 7, 14];
          return opts[(opts.indexOf(v) + 1) % opts.length];
        });
        break;
      case 'history-prev':
        setHistoryIndex((i) => Math.max(0, i - 1));
        break;
      case 'history-next':
        setHistoryIndex((i) => Math.min((lab?.runs.length || 1) - 1, i + 1));
        break;
      case 'history-open':
        if (lab?.runs[historyIndex]) void loadRun(lab.runs[historyIndex].id);
        break;
      case 'again':
        prepare(run?.config || config);
        break;
      case 'harder':
        prepare({ ...(run?.config || config), variant: 'harder', targetSeconds: 300 });
        break;
      case 'previous-score':
        if (run) setPhase('scorecard');
        break;
      case 'keyboard-name':
        openKeyboard('name');
        break;
      case 'keyboard-code':
        openKeyboard('code');
        break;
      case 'keyboard-workspace':
        openKeyboard('workspace');
        break;
      case 'key-delete':
        setKeyboardBuffer((b) => b.slice(0, -1));
        break;
      case 'key-space':
        setKeyboardBuffer((b) => (b + ' ').slice(0, 70));
        break;
      case 'key-numbers':
        setKeyboardNumbers((v) => !v);
        break;
      case 'key-done':
        if (keyboardPurpose === 'workspace') setWorkspaceName(keyboardBuffer);
        else if (keyboardPurpose === 'code') setJoinCode(keyboardBuffer);
        else setJoinName(keyboardBuffer);
        setPhase(keyboardReturn);
        break;
      case 'key-back':
        setPhase(keyboardReturn);
        break;
      case 'save-workspace':
        void saveWorkspace();
        break;
      case 'text-prev':
        setTextPage((p) => Math.max(0, p - 1));
        break;
      case 'text-next':
        setTextPage((p) => p + 1);
        break;
      case 'exit-vr':
        void scene.current?.exit();
        break;
      case 'tablet-near':
        setComfort((c) => ({ ...c, distance: 'near' }));
        break;
    }
  }
  const currentAction: BoardButton | undefined = useMemo(() => {
    if (
      run?.paused &&
      run.started &&
      ['active', 'record', 'sort', 'summary', 'review', 'note'].includes(phase)
    )
      return { id: 'resume', label: 'Resume shift', style: 'primary' };
    if (phase === 'profile') return { id: 'prepare', label: 'Start practice', style: 'primary' };
    if (phase === 'briefing')
      return {
        id: run?.noteRead ? 'begin' : 'invoice',
        label: run?.noteRead ? 'Begin receiving' : 'Read delivery note',
        style: 'primary',
      };
    if (phase === 'note')
      return {
        id: run?.started ? 'note-back' : 'begin',
        label: run?.started ? 'Return to receiving' : 'Begin receiving',
        style: 'primary',
      };
    if (phase === 'record') return { id: 'save-line', label: 'Save item record', style: 'primary' };
    if (phase === 'summary')
      return { id: 'review', label: 'Review receiving report', style: 'primary' };
    if (phase === 'review') return { id: 'submit', label: 'Confirm & submit', style: 'primary' };
    if (phase === 'scorecard') return { id: 'again', label: 'Try again', style: 'primary' };
    if (phase === 'manager')
      return { id: 'assign', label: 'Assign receiving lesson', style: 'primary' };
    if (phase === 'trainer')
      return { id: 'save-defaults', label: 'Save trainer defaults', style: 'primary' };
    if (phase === 'invite')
      return {
        id: 'join',
        label: 'Join practice team',
        style: 'primary',
        disabled: joinName.trim().length < 2 || !joinCode,
      };
    if (phase === 'active' && item && run) {
      if (!run.inspected.includes(item.id))
        return { id: 'inspect', label: 'Confirm condition inspection', style: 'primary' };
      if (!run.labels.includes(item.id))
        return { id: 'labels', label: 'Check label, batch & expiry', style: 'primary' };
      if (!run.records[item.id])
        return { id: 'record', label: 'Record received units', style: 'primary' };
      if (!run.placements[item.id])
        return { id: 'show-zones', label: 'Choose a storage zone', style: 'primary' };
      return { id: 'summary', label: 'View stage summary', style: 'primary' };
    }
    return undefined;
  }, [phase, run?.version, item?.id, joinName, joinCode]);
  const objective =
    phase === 'profile'
      ? 'Prepare for your receiving shift'
      : phase === 'briefing' || phase === 'note'
        ? 'Read the delivery brief and rules'
        : phase === 'record'
          ? 'Verify and record the actual units'
          : phase === 'sort'
            ? 'Choose the correct storage zone'
            : phase === 'summary'
              ? 'Review the completed delivery'
              : phase === 'review'
                ? 'Check the report, then confirm'
                : phase === 'scorecard'
                  ? 'Review your score and next focus'
                  : phase === 'manager'
                    ? 'Assign focused practice'
                    : phase === 'trainer'
                      ? 'Set a consistent practice standard'
                      : phase === 'active'
                        ? currentAction?.label || 'Inspect and sort the delivery'
                        : 'Make the next step comfortable';
  const fullBoard = useMemo(() => {
    const buttons: BoardButton[] = [];
    const lines: string[] = [];
    let title = 'BrightMart practice';
    const add = (id: string, label: string, style?: BoardButton['style'], disabled = false) =>
      buttons.push({ id, label, style, disabled });
    if (phase === 'profile') {
      title = 'Ready for receiving?';
      lines.push(
        'BrightMart Mini Store · Stock Receiving Assistant',
        `${config.variant === 'standard' ? '8 cartons · standard' : '12 cartons · harder'} · ${fmt(config.targetSeconds)} target`,
        `Learner: ${member.name}`,
        'Inspect → count → sort → review → confirm.',
      );
      add('prepare', 'Start practice', 'primary');
      add('member', 'Change learner');
      add('variant', config.variant === 'standard' ? 'Try 12 cartons' : 'Use 8 cartons');
      if (run?.status === 'in_progress') add('resume', 'Resume saved shift');
      if (run?.status === 'completed') add('previous-score', 'Previous score');
      add('manager', 'Manager');
      add('trainer', 'Trainer');
      add('invite', 'Join with invite');
      add('guide', 'Hands guide');
      add('comfort', 'Comfort');
      pending.forEach((a) => add('pending:' + a.id, `Assigned: ${a.config.variant}`));
    } else if (phase === 'briefing') {
      title = 'Your delivery brief';
      lines.push(
        `${run?.manifest.deliveryId} · ${run?.manifest.supplier}`,
        `${total} cartons. Read the note before sorting.`,
        'Check seals, labels, batch, expiry and actual units.',
        'Accept sound partial quantities. Record shortages separately.',
        'Practice focus: ' + focusLabels[config.focus],
      );
      add('invoice', 'Read delivery note', 'primary');
      if (run?.noteRead) add('begin', 'Begin receiving', 'primary');
      add('profile', 'Back to practice');
      add('guide', 'Hands guide');
    } else if (phase === 'note') {
      title = 'Delivery note';
      if (run) {
        lines.push(
          `${run.manifest.deliveryId} · ${run.manifest.supplier}`,
          `Inspection date: ${run.manifest.inspectionDate}`,
          ...run.manifest.invoice.map((r) => `${r.id} ${r.name}: ${r.expectedUnits} units`),
          ...run.manifest.instructions,
        );
      }
      add(
        run?.started ? 'note-back' : 'begin',
        run?.started ? 'Return to receiving' : 'Begin receiving',
        'primary',
      );
    } else if (phase === 'active') {
      title = item ? `${item.id} · ${item.name}` : 'Delivery prepared';
      if (item && run) {
        lines.push(`Packaging: ${item.condition}`);
        if (run.inspected.includes(item.id))
          lines.push(
            `Expected SKU ${item.sku}; printed ${item.printedSku}`,
            `Expiry ${item.expiry} · date ${run.manifest.inspectionDate}`,
            `Batch ${item.batch}; inside: ${item.actualUnits} units`,
          );
        if (run.records[item.id])
          lines.push(
            `Saved: ${run.records[item.id].receivedUnits} · ${run.records[item.id].condition}`,
          );
        if (currentAction) add(currentAction.id, currentAction.label, 'primary');
        if (run.inspected.includes(item.id) && !run.placements[item.id])
          add('quarantine-now', 'Isolate physical stock', 'warning');
      }
      add('invoice', 'Delivery note');
      add('hint', 'Hint');
      add('comfort', 'Comfort');
    } else if (phase === 'record') {
      title = 'Receiving line';
      if (item)
        lines.push(
          `${item.id} · ${item.name}`,
          `Expected ${item.expectedUnits} · inside ${item.actualUnits}`,
          `Received: ${draft.receivedUnits} · ${draft.condition}`,
          `Action: ${draft.disposition} · ${draft.note}`,
        );
      add('qty-minus', 'Quantity −');
      add('qty-plus', 'Quantity +');
      conditionOptions.forEach((c) =>
        add('condition:' + c, c, draft.condition === c ? 'active' : undefined),
      );
      dispositionOptions.forEach(([value]) =>
        add(
          'disposition:' + value,
          value.charAt(0).toUpperCase() + value.slice(1),
          draft.disposition === value ? 'active' : undefined,
        ),
      );
      add('line-note', 'Change short note');
      add('save-line', 'Save item record', 'primary');
      add('record-back', 'Back to inspection');
    } else if (phase === 'sort') {
      title = 'Place the carton';
      lines.push(
        item ? `${item.id} · ${item.name}` : 'Choose a carton',
        'Health & Wellness is on the left.',
        'Grocery & Household is on the right.',
        'Quarantine physical unsafe or mismatched stock.',
      );
      add('place:health', 'Health & Wellness');
      add('place:grocery', 'Grocery & Household');
      add('place:quarantine', 'Quarantine / returns', 'warning');
      add('record-back', 'Back to inspection');
      add('hint', 'Hint');
    } else if (phase === 'summary') {
      title = 'Delivery stage complete';
      lines.push(
        `Inspected ${inspected}/${total}; records ${recorded}/${total}`,
        `Accepted: ${run?.totals.acceptedCartons} cartons / ${run?.totals.acceptedUnits} units`,
        `Quarantine: ${run?.totals.quarantinedCartons} cartons / ${run?.totals.quarantinedUnits} units`,
        `Shortage ${run?.totals.shortageUnits} units; overage ${run?.totals.overageUnits} units.`,
        'Missing units are not quarantine stock.',
      );
      add('review', 'Review receiving report', 'primary');
      add('invoice', 'Delivery note');
    } else if (phase === 'review') {
      title = 'Review before confirming';
      lines.push(
        ...(run?.manifest.items.map(
          (i) =>
            `${i.id}: ${run.records[i.id]?.receivedUnits}/${i.expectedUnits} · ${run.records[i.id]?.condition} · ${run.records[i.id]?.disposition}`,
        ) || []),
        'Shortages and overages stay separate. Confirm saves your final score.',
      );
      add('submit', 'Confirm & submit', 'primary');
      add('summary', 'Back to summary');
    } else if (phase === 'scorecard') {
      title = `${run?.scorecard?.total ?? 0}/100 · ${run?.scorecard?.band || 'Saved result'}`;
      lines.push(
        run?.scorecard?.bandMessage || '',
        `Time ${fmt(run?.elapsedSeconds || 0)}; exceptions ${run?.exceptionsCaught}/${run?.exceptionsTotal}`,
        ...Object.entries(run?.scorecard?.dimensions || {}).map(
          ([n, d]) => `${n}: ${d.points}/${d.max}`,
        ),
        ...(run?.coaching || []),
        run?.previous
          ? `Previous comparable score ${run.previous.score}/100.`
          : 'First comparable completed attempt.',
      );
      add('again', 'Try again', 'primary');
      add('harder', 'Try harder delivery');
      add('manager', 'Team results');
      add('profile', 'Back to practice');
    } else if (phase === 'manager') {
      title = 'Team practice';
      lines.push(
        data.settings.workspaceName,
        `Selected: ${member.name}; due in ${dueDays} days`,
        `Assign: ${config.variant}, ${fmt(config.targetSeconds)}, ${focusLabels[config.focus]}`,
        `Invite code: ${shared?.inviteCode || 'Loading'}`,
      );
      const recent = lab?.runs[historyIndex];
      if (recent)
        lines.push(
          `Result ${historyIndex + 1}/${lab?.runs.length}: ${recent.memberName}, ${recent.status}, ${recent.score ?? '—'}/100`,
        );
      add('assign', 'Assign lesson', 'primary');
      add('member', 'Change learner');
      add('variant', 'Change difficulty');
      add('due-days', `Due: ${dueDays} days`);
      add('focus', 'Change focus');
      add('keyboard-workspace', 'Edit team name');
      add('save-workspace', 'Save team name');
      add('invite', 'Join with invite');
      if (recent) {
        add('history-prev', 'Previous result', undefined, historyIndex === 0);
        add('history-next', 'Next result', undefined, historyIndex === (lab?.runs.length || 1) - 1);
        add('history-open', 'Open result');
      }
      add('trainer', 'Trainer settings');
      add('profile', 'Back to practice');
    } else if (phase === 'trainer') {
      title = 'Trainer defaults';
      lines.push(
        `${config.variant} · ${fmt(config.targetSeconds)} target`,
        focusLabels[config.focus],
        'Fixed rubric: 35 accuracy + 25 exceptions + 25 process + 15 efficiency.',
        'New settings do not rewrite saved attempts.',
      );
      add('variant', 'Change difficulty');
      add('target', `Target ${fmt(config.targetSeconds)}`);
      add('focus', 'Change focus');
      add('save-defaults', 'Save defaults', 'primary');
      add('profile', 'Back to practice');
      add('manager', 'Manager');
    } else if (phase === 'invite') {
      title = 'Join the practice team';
      lines.push(
        'Shared demo invitation—not authentication.',
        `Name: ${joinName || 'Enter your name'}`,
        `Invite: ${joinCode || 'Enter team code'}`,
      );
      add('keyboard-name', 'Enter name');
      add('keyboard-code', 'Enter invite code');
      add('join', 'Join practice team', 'primary', joinName.trim().length < 2 || !joinCode);
      add('profile', 'Back to practice');
    } else if (phase === 'keyboard') {
      title =
        keyboardPurpose === 'workspace'
          ? 'Name your team'
          : keyboardPurpose === 'code'
            ? 'Enter invite code'
            : 'Your practice name';
      lines.push(keyboardBuffer || 'Point and pinch letters.');
      for (const key of keyboardNumbers ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
        add('key:' + key, key);
      add('key-space', 'Space');
      add('key-delete', 'Delete');
      add('key-numbers', keyboardNumbers ? 'ABC' : '123');
      add('key-done', 'Done', 'primary');
      add('key-back', 'Cancel');
    } else if (phase === 'guide') {
      title = 'Hands first. No walking.';
      lines.push(
        'Point a hand ray at a target; pinch to select.',
        'Grab cartons or documents; rotate your hand to inspect.',
        'Drag and release inside a labelled zone.',
        'Poke large quantity + / − controls on the tablet.',
        'Grab the tablet handle to move it. Essential actions work with one hand.',
        'If tracking is lost, the shift pauses. Resume explicitly.',
      );
      add('guide-back', 'Back', 'primary');
      add('comfort', 'Comfort');
    } else if (phase === 'comfort') {
      title = 'Make practice comfortable';
      lines.push(
        'Stay seated or stationary in a clear 1.5 × 1.5 m area.',
        'Use ray-pinch when objects are beyond comfortable reach.',
        'Do not force a reach. Pause if uncomfortable.',
        `Tablet ${comfort.distance}; ${comfort.seated ? 'seated' : 'standing'}; text ${comfort.largeText ? 'large' : 'standard'}.`,
      );
      add('distance', 'Tablet distance');
      add('seated', comfort.seated ? 'Seated ✓' : 'Standing ✓');
      add('large-text', comfort.largeText ? 'Large text ✓' : 'Standard text');
      add('audio', audio ? 'Sound on' : 'Sound off');
      add('guide-back', 'Back', 'primary');
    }
    if (
      run?.started &&
      run.status === 'in_progress' &&
      !['profile', 'manager', 'trainer', 'invite', 'keyboard'].includes(phase)
    )
      add(
        run.paused ? 'resume' : 'pause',
        run.paused ? 'Resume shift' : 'Pause shift',
        run.paused ? 'primary' : undefined,
      );
    if (
      run?.paused &&
      run.started &&
      run.status === 'in_progress' &&
      ['active', 'record', 'sort', 'note', 'summary', 'review'].includes(phase)
    ) {
      title = 'Your shift is paused';
      lines.length = 0;
      lines.push(
        'Progress is saved. Pause time does not affect your score.',
        'Resume explicitly when your hands and workspace are ready.',
      );
      buttons.length = 0;
      add('resume', 'Resume shift', 'primary');
      add('profile', 'Back to practice');
      add('comfort', 'Comfort');
    }
    add('tablet-near', 'Tablet closer');
    add('exit-vr', 'Exit immersive');
    return { title, lines, buttons };
  }, [
    phase,
    config,
    member.id,
    member.name,
    run?.version,
    selectedId,
    draft,
    currentAction,
    comfort,
    audio,
    data.settings.workspaceName,
    joinName,
    joinCode,
    keyboardPurpose,
    keyboardBuffer,
    keyboardNumbers,
    dueDays,
    lab,
    historyIndex,
    shared?.inviteCode,
  ]);
  const pages = textPages(fullBoard.lines),
    safePage = Math.min(textPage, pages.length - 1);
  const view: BoardView = {
    phase:
      phase === 'trainer'
        ? 'manager'
        : ['note', 'guide', 'comfort'].includes(phase)
          ? 'guide'
          : phase === 'sort'
            ? 'active'
            : ['summary', 'review'].includes(phase)
              ? 'record'
              : (phase as BoardView['phase']),
    eyebrow: `BRIGHTMART · ${phase === 'record' ? 'RECEIVING TABLET' : 'PRACTICE'}${pages.length > 1 ? ` · PAGE ${safePage + 1}/${pages.length}` : ''}`,
    title: fullBoard.title,
    lines: pages[safePage],
    fullLines: fullBoard.lines,
    buttons: [
      ...fullBoard.buttons,
      ...(pages.length > 1
        ? [
            { id: 'text-prev', label: 'Previous page', disabled: safePage === 0 },
            { id: 'text-next', label: 'Next page', disabled: safePage === pages.length - 1 },
          ]
        : []),
    ],
    columns: phase === 'keyboard' ? 6 : 3,
    feedback: feedback ? { ...feedback, message: feedback.message.slice(0, 170) } : null,
    busy,
    paused: run?.paused,
    clock: run
      ? `${run.paused ? 'PAUSED · ' : ''}${placed}/${total} placed · ${fmt(Math.max(0, config.targetSeconds - elapsed))} left`
      : 'HANDS-ONLY · CONTROLLERS OPTIONAL',
  };
  const sceneState: SceneState = {
    theme: 'brightmart',
    view,
    comfort,
    hud: {
      objective,
      progress: `${placed}/${total} placed · ${inspected}/${total} inspected`,
      timer: run?.paused
        ? 'Paused'
        : `${fmt(Math.max(0, config.targetSeconds - elapsed))} remaining`,
      action: currentAction
        ? { ...currentAction, disabled: busy || currentAction.disabled }
        : undefined,
      hint:
        phase === 'record'
          ? 'Count actual units; use large + / − buttons.'
          : 'One hand works. Point + pinch. No walking.',
    },
    run: run
      ? {
          id: run.id,
          manifest: {
            items: run.manifest.items.map((i) => ({
              ...i,
              storage: i.category === 'health' ? 'dry' : 'cold',
            })),
            invoice: run.manifest.invoice.map((i) => ({
              sku: i.sku,
              name: i.name,
              expected: i.expectedUnits,
            })),
            deliveryId: run.manifest.deliveryId,
            supplier: run.manifest.supplier,
            inspectionDate: run.manifest.inspectionDate,
            expected: run.manifest.expectedCartons,
            delivered: run.manifest.deliveredCartons,
          },
          placements: Object.fromEntries(
            Object.entries(run.placements).map(([id, p]) => [
              id,
              {
                zone: p.zone === 'health' ? 'dry' : p.zone === 'grocery' ? 'cold' : 'quarantine',
                reason: 'none',
                at: p.at,
              },
            ]),
          ),
          inspected: run.inspected,
        }
      : null,
    selectedId,
    reason: 'none',
    interactive: running && ['active', 'record', 'sort', 'note'].includes(phase),
  };
  async function enter(mode: 'immersive-vr' | 'immersive-ar') {
    try {
      await scene.current?.enter(mode);
    } catch (e) {
      setFeedback({
        correct: false,
        message:
          e instanceof Error
            ? e.message
            : 'Open the direct HTTPS URL in a compatible headset browser.',
      });
    }
  }
  if (loading)
    return (
      <div className="bm-loading">
        <LoaderCircle className="spin" />
        <h1>Preparing BrightMart receiving…</h1>
        <p>Your saved results stay in the workspace.</p>
      </div>
    );
  if (loadError)
    return (
      <div className="bm-loading" role="alert">
        <TriangleAlert />
        <h1>The practice room could not open.</h1>
        <p>{loadError}</p>
        <button className="bm-primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  const isPaused =
    !!run &&
    run.paused &&
    run.started &&
    run.status === 'in_progress' &&
    ['active', 'record', 'sort', 'note', 'summary', 'review'].includes(phase);
  const history = lab?.runs || [];
  const renderConfig = () => (
    <div className="bm-config-grid">
      <label>
        Difficulty
        <select
          value={config.variant}
          onChange={(e) =>
            setConfig((c) => ({
              ...c,
              variant: e.target.value as BrightConfig['variant'],
              targetSeconds: e.target.value === 'harder' ? 300 : 360,
            }))
          }
        >
          <option value="standard">Standard · 8 cartons</option>
          <option value="harder">Harder · 12 cartons</option>
        </select>
      </label>
      <label>
        Time target
        <select
          value={config.targetSeconds}
          onChange={(e) =>
            setConfig((c) => ({
              ...c,
              targetSeconds: Number(e.target.value) as BrightConfig['targetSeconds'],
            }))
          }
        >
          {[360, 300, 600, 900].map((n) => (
            <option key={n} value={n}>
              {n / 60} minutes
            </option>
          ))}
        </select>
      </label>
      <label>
        Practice focus
        <select
          value={config.focus}
          onChange={(e) =>
            setConfig((c) => ({ ...c, focus: e.target.value as BrightConfig['focus'] }))
          }
        >
          {Object.entries(focusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  const renderLineTable = () =>
    run && (
      <div className="bm-report-scroll">
        <table className="bm-report-table">
          <caption>{run.manifest.deliveryId} · item-level receiving report</caption>
          <thead>
            <tr>
              <th>Item</th>
              <th>Expected</th>
              <th>Received</th>
              <th>Condition</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {run.manifest.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>
                    {i.id} · {i.name}
                  </strong>
                  <small>{i.sku}</small>
                </td>
                <td>{i.expectedUnits}</td>
                <td>{run.records[i.id]?.receivedUnits ?? '—'}</td>
                <td>{run.records[i.id]?.condition || 'Not recorded'}</td>
                <td>{run.records[i.id]?.disposition || 'Not recorded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  const stageCounts = run && (
    <div className="bm-stage-counts" aria-label="Receiving stage progress">
      {[
        [inspected, 'Inspected'],
        [run.labels.length, 'Labels checked'],
        [recorded, 'Records saved'],
        [placed, 'Placed'],
      ].map(([n, label]) => (
        <div key={label}>
          <span>
            {Number(n) === total ? (
              <CheckCircle2 size={16} />
            ) : (
              <span className="bm-progress-dot" />
            )}
            {label}
          </span>
          <strong>
            {n}/{total}
          </strong>
        </div>
      ))}
    </div>
  );
  let content: ReactNode;
  if (phase === 'profile')
    content = (
      <>
        <div className="bm-welcome">
          <span className="bm-kicker">
            <span />
            BRIGHTMART MINI STORE
          </span>
          <h2>
            Every delivery
            <br />
            is a decision.
          </h2>
          <p>
            Step in as the Stock Receiving Assistant. Keep good stock moving and bad stock out of
            sellable inventory.
          </p>
        </div>
        <div className="bm-profile-facts">
          <span>
            <Box />
            {config.variant === 'standard' ? '8 cartons · standard' : '12 cartons · harder'}
          </span>
          <span>
            <Clock3 />
            {config.targetSeconds / 60}-minute target
          </span>
          <span>
            <Hand />
            Hands only in VR
          </span>
        </div>
        <label className="bm-label">
          Practice as
          <select value={member.id} onChange={(e) => chooseMember(e.target.value)}>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="bm-loop">
          <span>01 Inspect</span>
          <ChevronRight />
          <span>02 Classify</span>
          <ChevronRight />
          <span>03 Record</span>
          <ChevronRight />
          <span>04 Submit</span>
        </div>
        <PrimaryButton onClick={() => prepare()} disabled={busy}>
          Start practice
        </PrimaryButton>
        {run?.status === 'in_progress' && (
          <button
            className="bm-secondary"
            onClick={() => {
              void loadRun(run.id);
            }}
            disabled={busy}
          >
            <Play size={17} />
            Open saved shift · {Object.keys(run.placements).length}/{run.manifest.items.length}{' '}
            placed
          </button>
        )}
        {run?.status === 'completed' && (
          <button className="bm-secondary" onClick={() => setPhase('scorecard')}>
            View previous scorecard
          </button>
        )}
        {pending.length > 0 && (
          <div className="bm-pending">
            <h3>Assigned practice</h3>
            {pending.map((a) => (
              <button key={a.id} onClick={() => prepare(a.config)} disabled={busy}>
                <ClipboardCheck size={19} />
                <span>
                  {a.config.variant} · {focusLabels[a.config.focus]}
                  <small>
                    Due {a.dueDate} · {a.config.targetSeconds / 60} min target
                  </small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        )}
        <div className="bm-profile-links">
          <button onClick={() => action('guide')}>
            <Hand size={16} />
            Hands guide
          </button>
          <button onClick={openComfort}>
            <Settings2 size={16} />
            Comfort settings
          </button>
        </div>
        <p className="bm-note">
          Fictional practice data. No walking required. A clear, seated or standing 1.5 × 1.5 m area
          is recommended.
        </p>
      </>
    );
  else if (phase === 'briefing')
    content = (
      <>
        <span className="bm-kicker">YOUR DELIVERY BRIEF</span>
        <h2>
          Receive and Shelf-Check
          <br />a Supplier Delivery
        </h2>
        <p className="bm-lead">
          {run?.manifest.supplier} has delivered {total} cartons. Your job is to verify the
          evidence, protect sellable stock and save an accurate receiving report.
        </p>
        {config.focus !== 'complete' && (
          <div className="bm-safety-note">
            <Hand size={20} />
            <p>
              <strong>Practice focus: {focusLabels[config.focus]}.</strong> The full safety
              checklist still applies.
            </p>
          </div>
        )}
        <div className="bm-brief-grid">
          <CountTile label="Delivery" value={run?.manifest.deliveryId} />
          <CountTile label="Target" value={`${config.targetSeconds / 60} minutes`} />
          <CountTile label="Business" value="BrightMart Mini Store" />
          <CountTile label="Role" value="Stock Receiving Assistant" />
        </div>
        <ul className="bm-checklist">
          <li>
            <CheckCircle2 />
            Inspect condition, labels, batch and expiry.
          </li>
          <li>
            <CheckCircle2 />
            Count actual units against the delivery note.
          </li>
          <li>
            <CheckCircle2 />
            Sort accepted stock; isolate physical exceptions.
          </li>
          <li>
            <CheckCircle2 />
            Review the form, then explicitly confirm.
          </li>
        </ul>
        <div className="bm-safety-note">
          <ShieldCheck size={21} />
          <p>
            Sound partial stock is still accepted. Expected 24, actual 22 means{' '}
            <strong>accept 22, record a shortage of 2</strong>—not quarantine.
          </p>
        </div>
        <PrimaryButton onClick={openNote} disabled={busy}>
          Read delivery note
        </PrimaryButton>
        {run?.noteRead && (
          <button className="bm-secondary" onClick={begin} disabled={busy}>
            Begin receiving <Play size={17} />
          </button>
        )}
        <p className="bm-note">
          The clock starts when you begin receiving, not while you read this briefing. Non-clinical
          stock-handling practice only.
        </p>
      </>
    );
  else if (phase === 'note')
    content = (
      <>
        <span className="bm-kicker">PHYSICAL DELIVERY NOTE</span>
        <div className="bm-panel-title">
          <h2>{run?.manifest.deliveryId}</h2>
          <FileText size={27} />
        </div>
        <div className="bm-doc-details">
          <div>
            <span>Supplier</span>
            <strong>{run?.manifest.supplier}</strong>
          </div>
          <div>
            <span>Delivery date</span>
            <strong>{run?.manifest.inspectionDate}</strong>
          </div>
          <div>
            <span>Deliver to</span>
            <strong>BrightMart Mini Store</strong>
          </div>
          <div>
            <span>Cartons expected</span>
            <strong>{total}</strong>
          </div>
        </div>
        <div className="bm-note-lines">
          <h3>Order quantities</h3>
          {run?.manifest.invoice.map((i) => (
            <div key={i.id}>
              <span>{i.id}</span>
              <div>
                <strong>{i.name}</strong>
                <small>
                  {i.sku} · {zoneLabels[i.category as BrightZone]}
                </small>
              </div>
              <b>
                {i.expectedUnits}
                <small>units</small>
              </b>
            </div>
          ))}
        </div>
        <div className="bm-handling-rules">
          <h3>Handling instructions</h3>
          <ol>
            {run?.manifest.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <PrimaryButton onClick={run?.started ? () => setPhase(noteReturn) : begin} disabled={busy}>
          {run?.started ? 'Return to receiving' : 'Begin receiving'}
        </PrimaryButton>
        <p className="bm-note">
          <Hand size={15} />
          In VR: grab, rotate and replace the physical document, or use its paged tablet view.
        </p>
      </>
    );
  else if (phase === 'active')
    content =
      item && run ? (
        <>
          <span className="bm-kicker">CARTON INSPECTOR · {item.id}</span>
          <div className="bm-panel-title">
            <h2>{item.name}</h2>
            <span className="bm-object-id">{item.id}</span>
          </div>
          <div className="bm-condition-observation">
            <Box size={27} />
            <div>
              <span>PACKAGING EVIDENCE</span>
              <strong>{item.condition}</strong>
            </div>
          </div>
          {run.inspected.includes(item.id) && (
            <div className="bm-evidence-grid">
              <div>
                <span>Delivery-note SKU</span>
                <strong>{item.sku}</strong>
              </div>
              <div>
                <span>Printed SKU</span>
                <strong>{item.printedSku}</strong>
              </div>
              <div>
                <span>Expiry date</span>
                <strong>{item.expiry}</strong>
              </div>
              <div>
                <span>Exercise date</span>
                <strong>{run.manifest.inspectionDate}</strong>
              </div>
              <div>
                <span>Batch</span>
                <strong>{item.batch}</strong>
              </div>
              <div>
                <span>Inside the carton</span>
                <strong>{item.actualUnits} units</strong>
              </div>
            </div>
          )}
          {run.records[item.id] && (
            <div className="bm-saved-line">
              <CheckCircle2 size={20} />
              <div>
                <strong>Receiving line saved</strong>
                <span>
                  {run.records[item.id].receivedUnits} units · {run.records[item.id].condition} ·{' '}
                  {run.records[item.id].disposition}
                </span>
              </div>
            </div>
          )}
          {currentAction && (
            <PrimaryButton onClick={() => action(currentAction.id)} disabled={busy || isPaused}>
              {currentAction.label}
            </PrimaryButton>
          )}
          {run.inspected.includes(item.id) && !run.placements[item.id] && (
            <button
              className="bm-isolate"
              onClick={() => action('quarantine-now')}
              disabled={busy || isPaused}
            >
              <TriangleAlert size={17} />
              Isolate physical stock now
            </button>
          )}
          <div className="bm-inspector-actions">
            <button onClick={() => scene.current?.bringCloser()}>
              <Hand size={17} />
              Bring carton closer
            </button>
            <button onClick={openNote}>
              <FileText size={17} />
              Delivery note
            </button>
          </div>
          <div className="bm-mini-stage">{stageCounts}</div>
          <p className="bm-note">
            Inspect the evidence before deciding. Use shelf labels and the delivery note—not colour
            alone.
          </p>
        </>
      ) : (
        <>
          <h2>Delivery prepared.</h2>
          <PrimaryButton onClick={() => setPhase('summary')}>View receiving summary</PrimaryButton>
        </>
      );
  else if (phase === 'record')
    content =
      item && run ? (
        <>
          <span className="bm-kicker">RECEIVING TABLET · {item.id}</span>
          <h2>Record the actual units.</h2>
          <p className="bm-lead">
            {item.name} · expected <strong>{item.expectedUnits}</strong> · inside the carton{' '}
            <strong>{item.actualUnits}</strong>
          </p>
          <div className="bm-quantity" role="group" aria-label="Received quantity">
            <button
              aria-label="Decrease received quantity"
              onClick={() => adjust(-1)}
              disabled={busy || draft.receivedUnits === 0}
            >
              <Minus size={26} />
            </button>
            <div>
              <span>RECEIVED UNITS</span>
              <output aria-label="Received units" aria-live="polite">
                {draft.receivedUnits}
              </output>
            </div>
            <button
              aria-label="Increase received quantity"
              onClick={() => adjust(1)}
              disabled={busy || draft.receivedUnits === 9999}
            >
              <Plus size={26} />
            </button>
          </div>
          {draft.receivedUnits !== item.expectedUnits && (
            <div className="bm-quantity-difference">
              <TriangleAlert size={18} />
              {Math.abs(draft.receivedUnits - item.expectedUnits)}-unit{' '}
              {draft.receivedUnits < item.expectedUnits ? 'shortage' : 'overage'} on this product.
              Do not net against another product.
            </div>
          )}
          <fieldset className="bm-fieldset">
            <legend>Condition observed</legend>
            <div className="bm-choice-grid">
              {conditionOptions.map((c) => (
                <button
                  key={c}
                  className={draft.condition === c ? 'selected' : ''}
                  aria-pressed={draft.condition === c}
                  onClick={() => setDraft((d) => ({ ...d, condition: c }))}
                  disabled={busy}
                >
                  {draft.condition === c ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <span className="bm-radio-dot" />
                  )}
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="bm-fieldset">
            <legend>Receiving action</legend>
            <div className="bm-disposition-choices">
              {dispositionOptions.map(([v, label]) => (
                <button
                  key={v}
                  className={draft.disposition === v ? 'selected' : ''}
                  aria-pressed={draft.disposition === v}
                  onClick={() => setDraft((d) => ({ ...d, disposition: v }))}
                  disabled={busy}
                >
                  {draft.disposition === v ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <span className="bm-radio-dot" />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="bm-label">
            Optional short note
            <select
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              disabled={busy}
            >
              {noteOptions.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <PrimaryButton onClick={() => action('save-line')} disabled={busy || isPaused}>
            Save item record
          </PrimaryButton>
          <button className="bm-back" onClick={() => setPhase('active')}>
            <ArrowLeft size={16} />
            Back to carton
          </button>
          <p className="bm-note">
            Unsaved choices are local to this device. Saved lines are kept with the run on the
            server.
          </p>
        </>
      ) : null;
  else if (phase === 'sort')
    content = (
      <>
        <span className="bm-kicker">CLASSIFY & PLACE · {item?.id}</span>
        <h2>Where does this stock belong?</h2>
        <p className="bm-lead">
          {item?.name}. Choose a labelled zone, or grab and release the carton there in the 3D
          workspace.
        </p>
        <div className="bm-zone-buttons">
          {(['health', 'grocery', 'quarantine'] as BrightZone[]).map((z, i) => (
            <button
              key={z}
              className={`zone-${z}`}
              onClick={() => action('place:' + z)}
              disabled={busy || isPaused}
            >
              <span>
                {z === 'quarantine' ? <TriangleAlert size={24} /> : <Layers3 size={24} />}
              </span>
              <div>
                <strong>{zoneLabels[z]}</strong>
                <small>
                  {
                    [
                      'Left shelf · accepted health stock',
                      'Right shelf · accepted household / grocery',
                      'Separate holding area · physical exceptions',
                    ][i]
                  }
                </small>
              </div>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
        <button className="bm-secondary" onClick={() => action('hint')} disabled={busy}>
          <Hand size={17} />
          Show a hint
        </button>
        <button className="bm-back" onClick={() => setPhase('active')}>
          <ArrowLeft size={16} />
          Back to carton evidence
        </button>
      </>
    );
  else if (phase === 'summary')
    content = (
      <>
        <span className="bm-kicker">DELIVERY STAGE COMPLETE</span>
        <h2>Every carton has a decision.</h2>
        <p className="bm-lead">
          All {total} cartons are inspected, recorded and correctly placed. Review the item-level
          report before final submission.
        </p>
        {stageCounts}
        <div className="bm-total-grid">
          <CountTile
            label="Accepted stock"
            value={`${run?.totals.acceptedCartons} cartons`}
            detail={`${run?.totals.acceptedUnits} sound units`}
          />
          <CountTile
            label="Quarantined / returns"
            value={`${run?.totals.quarantinedCartons} cartons`}
            detail={`${run?.totals.quarantinedUnits} physical units`}
          />
          <CountTile
            label="Shortage"
            value={`${run?.totals.shortageUnits} units`}
            detail="Not quarantine stock"
          />
          <CountTile
            label="Overage"
            value={`${run?.totals.overageUnits} units`}
            detail="Recorded separately"
          />
        </div>
        <div className="bm-safety-note">
          <CheckCircle2 size={22} />
          <p>
            {run?.totals.receivedUnits} units recorded against {run?.manifest.expectedUnits}{' '}
            expected. Shortages and overages remain visible per product.
          </p>
        </div>
        <PrimaryButton onClick={() => action('review')} disabled={busy || !allDone}>
          Review receiving report
        </PrimaryButton>
        <p className="bm-note">
          This is not submitted yet. A second, explicit confirmation saves the final score.
        </p>
      </>
    );
  else if (phase === 'review')
    content = (
      <>
        <span className="bm-kicker">STEP 1 OF 2 · REVIEW</span>
        <h2>Check it. Then confirm.</h2>
        <p className="bm-lead">
          Verify actual received units, condition and disposition for every line. Missing units are
          a shortage, not a quarantine carton.
        </p>
        {renderLineTable()}
        <div className="bm-review-totals">
          <span>
            Accepted <strong>{run?.totals.acceptedUnits} units</strong>
          </span>
          <span>
            Quarantine <strong>{run?.totals.quarantinedUnits} units</strong>
          </span>
          <span>
            Shortage <strong>{run?.totals.shortageUnits} units</strong>
          </span>
          <span>
            Overage <strong>{run?.totals.overageUnits} units</strong>
          </span>
        </div>
        <PrimaryButton onClick={() => action('submit')} disabled={busy || !run?.reviewToken}>
          Confirm & submit
        </PrimaryButton>
        <button className="bm-back" onClick={() => setPhase('summary')}>
          <ArrowLeft size={16} />
          Back to summary
        </button>
        <p className="bm-note">
          Step 2: Confirm & submit freezes this report and stores the scorecard. You can replay
          afterward.
        </p>
      </>
    );
  else if (phase === 'scorecard')
    content = run?.scorecard ? (
      <>
        <span className="bm-kicker">
          <CheckCircle2 size={16} />
          RECEIVING REPORT SAVED
        </span>
        <div className="bm-final-score">
          <strong>
            {run.scorecard.total}
            <small>/100</small>
          </strong>
          <span>{run.scorecard.band}</span>
        </div>
        <h2>{run.scorecard.bandMessage}</h2>
        <div className="bm-score-meta">
          <span>
            <Clock3 size={17} />
            {fmt(run.elapsedSeconds)} active time
          </span>
          <span>
            <ShieldCheck size={17} />
            {run.exceptionsCaught}/{run.exceptionsTotal} exceptions caught
          </span>
        </div>
        <div className="bm-rubric">
          {Object.entries(run.scorecard.dimensions).map(([name, d]) => (
            <details key={name}>
              <summary>
                <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                <strong>
                  {d.points}
                  <small>/{d.max}</small>
                </strong>
                <div className="bm-rubric-bar">
                  <i style={{ width: `${(d.points / d.max) * 100}%` }} />
                </div>
                <Plus size={15} />
              </summary>
              <ul>
                {d.checks.map((c) => (
                  <li key={c.name}>
                    <span>{c.name}</span>
                    <b>
                      {c.points}/{c.max}
                    </b>
                  </li>
                ))}
                {d.deductions > 0 && (
                  <li className="deduction">
                    <span>Attempt deductions (dimension capped)</span>
                    <b>−{d.deductions}</b>
                  </li>
                )}
              </ul>
            </details>
          ))}
        </div>
        <div className="bm-coaching">
          <span>
            <Hand size={20} />
            YOUR NEXT TWO PRACTICE PRIORITIES
          </span>
          <ol>
            {run.coaching.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
        <div className="bm-previous">
          <RotateCcw size={19} />
          <p>
            {run.previous ? (
              <>
                Previous comparable attempt: <strong>{run.previous.score}/100</strong> ·{' '}
                {fmt(run.previous.elapsedSeconds)}. This score is{' '}
                {run.scorecard.total - run.previous.score >= 0 ? '+' : ''}
                {run.scorecard.total - run.previous.score} points different.
              </>
            ) : (
              <>
                This is your first completed attempt with this variant, target and focus. Your next
                comparable result will appear here.
              </>
            )}
          </p>
        </div>
        <div className="bm-score-actions">
          <PrimaryButton onClick={() => prepare(run.config)} disabled={busy}>
            Try again
          </PrimaryButton>
          <button className="bm-secondary" onClick={() => action('harder')} disabled={busy}>
            <Layers3 size={18} />
            Try harder · 12 cartons
          </button>
        </div>
        <details className="bm-saved-report">
          <summary>
            View saved receiving report <ChevronRight size={17} />
          </summary>
          {renderLineTable()}
          <p>
            Accepted {run.totals.acceptedUnits}; quarantine {run.totals.quarantinedUnits}; shortage{' '}
            {run.totals.shortageUnits}; overage {run.totals.overageUnits} units.
          </p>
        </details>
        <p className="bm-note">
          Authoritative server score. Practice performance is not professional certification or a
          guaranteed workplace outcome.
        </p>
      </>
    ) : (
      <>
        <h2>No completed scorecard yet.</h2>
        <button className="bm-secondary" onClick={() => go('profile')}>
          Back to practice
        </button>
      </>
    );
  else if (phase === 'manager')
    content = (
      <>
        <span className="bm-kicker">LIGHTWEIGHT TEAM WORKSPACE</span>
        <h2>Practice with a purpose.</h2>
        <p className="bm-lead">
          Assign a clear receiving task, review saved performance and choose the next focus.
        </p>
        <div className="bm-demo-warning">
          <TriangleAlert size={19} />
          <span>
            Shared demo—not authentication or secure staff permissions. Use fictional names only.
          </span>
        </div>
        <label className="bm-label">
          Team name
          <div className="bm-input-action">
            <input
              value={workspaceName}
              maxLength={70}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            <button
              aria-label="Open team-name hand keyboard"
              onClick={() => openKeyboard('workspace')}
            >
              <Hand size={18} />
            </button>
          </div>
        </label>
        <button
          className="bm-secondary"
          onClick={() => void saveWorkspace()}
          disabled={busy || workspaceName.trim().length < 2}
        >
          Save team name
        </button>
        <div className="bm-team-invite">
          <span>TEAM INVITE CODE</span>
          <strong>{shared?.inviteCode}</strong>
          <p>Share this code for the practice demo, or use the invite URL.</p>
          <code>{`${location.origin}/app#brightmart?invite=${shared?.inviteCode || ''}`}</code>
          <button className="bm-text-button" onClick={() => go('invite')}>
            Join with an invite <ArrowRight size={15} />
          </button>
        </div>
        <h3>Assign receiving practice</h3>
        <label className="bm-label">
          Learner
          <select value={member.id} onChange={(e) => chooseMember(e.target.value)}>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {renderConfig()}
        <label className="bm-label">
          Deadline
          <select value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))}>
            {[1, 3, 7, 14].map((n) => (
              <option key={n} value={n}>
                In {n} day{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <PrimaryButton onClick={() => void assign()} disabled={busy}>
          Assign receiving lesson
        </PrimaryButton>
        <div className="bm-assignment-list">
          <h3>Assignments</h3>
          {lab?.assignments.length ? (
            lab.assignments.slice(0, 8).map((a) => (
              <div key={a.id}>
                <ClipboardCheck size={18} />
                <span>
                  <strong>
                    {data.members.find((m) => m.id === a.memberId)?.name || 'Learner'}
                  </strong>
                  <small>
                    {a.config.variant} · {focusLabels[a.config.focus]} · due {a.dueDate}
                  </small>
                </span>
                <b className={a.status === 'completed' ? 'complete' : ''}>{a.status}</b>
              </div>
            ))
          ) : (
            <p>No BrightMart assignments yet.</p>
          )}
        </div>
        <div className="bm-manager-results">
          <h3>Saved receiving results</h3>
          {history.length ? (
            history.slice(0, 10).map((r) => (
              <button key={r.id} onClick={() => void loadRun(r.id)} disabled={busy}>
                <span>
                  <strong>{r.memberName}</strong>
                  <small>
                    {r.status === 'completed'
                      ? `${fmt(r.elapsedSeconds)} active · ${r.errors} attempts needing correction`
                      : 'In progress · open to continue'}
                  </small>
                </span>
                <b>{r.score == null ? 'Open' : `${r.score}/100`}</b>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <p>Complete the first delivery to see a saved result.</p>
          )}
        </div>
        <div className="bm-failure-list">
          <h3>Common coaching areas</h3>
          {Object.entries(lab?.failures || {}).length ? (
            Object.entries(lab?.failures || {})
              .sort((a, b) => b[1] - a[1])
              .map(([key, n]) => (
                <div key={key}>
                  <span>{failureLabels[key] || key}</span>
                  <b>
                    {n} corrected attempt{n > 1 ? 's' : ''}
                  </b>
                </div>
              ))
          ) : (
            <p>No error categories recorded in BrightMart runs yet.</p>
          )}
        </div>
        <a className="bm-text-button" href="/app#reports">
          All workspace reports <ArrowRight size={16} />
        </a>
      </>
    );
  else if (phase === 'trainer')
    content = (
      <>
        <span className="bm-kicker">TRAINER SETTINGS</span>
        <h2>A consistent practice standard.</h2>
        <p className="bm-lead">
          Set the next lesson’s difficulty, target and focus. Current and historical attempts keep
          their saved configuration.
        </p>
        {renderConfig()}
        <div className="bm-fixed-rubric">
          <h3>Fixed 100-point rubric</h3>
          <div>
            <span>Accuracy</span>
            <strong>35</strong>
          </div>
          <div>
            <span>Exceptions</span>
            <strong>25</strong>
          </div>
          <div>
            <span>Process</span>
            <strong>25</strong>
          </div>
          <div>
            <span>Efficiency</span>
            <strong>15</strong>
          </div>
        </div>
        <div className="bm-safety-note">
          <ShieldCheck size={21} />
          <p>
            Standard efficiency: ≤6 minutes = 15, ≤7 = 10, ≤8 = 5, later = 0. A custom target shifts
            these boundaries. Harder replay defaults to 5 minutes.
          </p>
        </div>
        <PrimaryButton onClick={() => action('save-defaults')} disabled={busy}>
          Save trainer defaults
        </PrimaryButton>
        <p className="bm-note">
          This is lightweight scenario configuration, not a product import, ERP or full
          scenario-authoring engine.
        </p>
        <a className="bm-text-button" href="/app#receiving">
          Earlier demo contexts & roles <ArrowRight size={16} />
        </a>
      </>
    );
  else if (phase === 'invite')
    content = (
      <>
        <span className="bm-kicker">A NAMED PRACTICE TEAM</span>
        <h2>Join with an invite.</h2>
        <p className="bm-lead">
          Use the team’s code to create a fictional practice learner. This demo code is not a secure
          login.
        </p>
        <label className="bm-label">
          Practice name
          <div className="bm-input-action">
            <input value={joinName} onChange={(e) => setJoinName(e.target.value)} maxLength={70} />
            <button aria-label="Open name hand keyboard" onClick={() => openKeyboard('name')}>
              <Hand size={18} />
            </button>
          </div>
        </label>
        <label className="bm-label">
          Invite code
          <div className="bm-input-action">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={40}
            />
            <button
              aria-label="Open invite-code hand keyboard"
              onClick={() => openKeyboard('code')}
            >
              <Hand size={18} />
            </button>
          </div>
        </label>
        <PrimaryButton
          onClick={() => void join()}
          disabled={busy || joinName.trim().length < 2 || !joinCode}
        >
          Join practice team
        </PrimaryButton>
        <button className="bm-back" onClick={() => go('profile')}>
          <ArrowLeft size={16} />
          Use an existing demo learner
        </button>
      </>
    );
  else if (phase === 'keyboard')
    content = (
      <>
        <span className="bm-kicker">ONE-HAND TEXT ENTRY</span>
        <h2>{fullBoard.title}</h2>
        <output className="bm-keyboard-value">{keyboardBuffer || 'Choose letters below'}</output>
        <div className="bm-keyboard">
          {fullBoard.buttons
            .filter((b) => b.id.startsWith('key:'))
            .map((b) => (
              <button key={b.id} onClick={() => action(b.id)}>
                {b.label}
              </button>
            ))}
        </div>
        <div className="bm-keyboard-tools">
          <button onClick={() => action('key-space')}>Space</button>
          <button onClick={() => action('key-delete')}>Delete</button>
          <button onClick={() => action('key-numbers')}>{keyboardNumbers ? 'ABC' : '123'}</button>
        </div>
        <PrimaryButton onClick={() => action('key-done')}>Done</PrimaryButton>
        <button className="bm-back" onClick={() => action('key-back')}>
          Cancel
        </button>
      </>
    );
  else if (phase === 'comfort')
    content = (
      <>
        <span className="bm-kicker">STATIONARY & SEATED</span>
        <h2>Comfort before speed.</h2>
        <p className="bm-lead">
          Stay within a clear 1.5 × 1.5 m area. Use hand rays instead of reaching or walking. Pause
          any time.
        </p>
        <div className="bm-comfort-controls">
          <button onClick={() => action('distance')}>
            <span>Tablet distance</span>
            <strong>
              {comfort.distance}
              <RotateCcw size={17} />
            </strong>
          </button>
          <button onClick={() => action('seated')}>
            <span>Position</span>
            <strong>
              {comfort.seated ? 'Seated' : 'Standing'}
              <RotateCcw size={17} />
            </strong>
          </button>
          <button onClick={() => action('large-text')}>
            <span>Text size</span>
            <strong>
              {comfort.largeText ? 'Large' : 'Standard'}
              <RotateCcw size={17} />
            </strong>
          </button>
          <button onClick={audioToggle}>
            <span>Subtle audio cues</span>
            <strong>
              {audio ? 'On' : 'Off'}
              <RotateCcw size={17} />
            </strong>
          </button>
        </div>
        <p className="bm-note">
          Sound is optional. Every success, warning and pause also has a visual and text cue.
          Physical comfort needs real-headset validation.
        </p>
        <PrimaryButton onClick={() => setPhase(comfortReturn)}>Back to practice</PrimaryButton>
      </>
    );
  else
    content = (
      <>
        <span className="bm-kicker">HANDS-ONLY QUICK GUIDE</span>
        <h2>One hand. A clear next step.</h2>
        <ol className="bm-hand-guide">
          <li>
            <Hand />
            <div>
              <strong>Point and pinch</strong>
              <p>Aim a hand ray and pinch to select a large target.</p>
            </div>
          </li>
          <li>
            <Box />
            <div>
              <strong>Grab and inspect</strong>
              <p>Bring a carton close. Rotate it to see the label, batch and expiry.</p>
            </div>
          </li>
          <li>
            <Layers3 />
            <div>
              <strong>Drag and release</strong>
              <p>Release inside a labelled shelf or the separate quarantine area.</p>
            </div>
          </li>
          <li>
            <ClipboardCheck />
            <div>
              <strong>Poke, review, confirm</strong>
              <p>
                Use large + / − controls, select condition and action, then explicitly confirm
                submission.
              </p>
            </div>
          </li>
          <li>
            <Pause />
            <div>
              <strong>Pause without pressure</strong>
              <p>Tracking loss pauses the shift. Resume explicitly when ready.</p>
            </div>
          </li>
        </ol>
        <PrimaryButton onClick={() => setPhase(guideReturn)}>Back to practice</PrimaryButton>
      </>
    );
  return (
    <div
      className={`brightmart-lab ${comfort.largeText ? 'bm-large-text' : ''} ${xr ? 'bm-xr-active' : ''}`}
    >
      <header className="bm-page-heading">
        <div>
          <span className="bm-kicker">HANDS-ON OPERATIONS LAB</span>
          <h1>Receive. Check. Get it right.</h1>
          <p>BrightMart Mini Store · Retail Stock Receiving & Shelf Audit</p>
        </div>
        <div className="bm-role-switch" aria-label="Practice view">
          {(['profile', 'manager', 'trainer'] as const).map((v, i) => (
            <button
              key={v}
              className={
                phase === v || (v === 'profile' && !['manager', 'trainer'].includes(phase))
                  ? 'active'
                  : ''
              }
              aria-pressed={
                phase === v || (v === 'profile' && !['manager', 'trainer'].includes(phase))
              }
              onClick={() => go(v)}
              disabled={busy}
            >
              {i === 0 ? (
                <Hand size={16} />
              ) : i === 1 ? (
                <Users size={16} />
              ) : (
                <Settings2 size={16} />
              )}{' '}
              {['Trainee', 'Manager', 'Trainer'][i]}
            </button>
          ))}
        </div>
      </header>
      <div className="bm-workspace">
        <section className="bm-room-column" aria-label="Spatial receiving workspace">
          <div className="bm-room-frame">
            <div className="bm-task-panel">
              <div>
                <span>CURRENT OBJECTIVE</span>
                <strong>{objective}</strong>
              </div>
              <span className="bm-task-time">
                <Clock3 size={16} />
                {run?.paused
                  ? 'Paused'
                  : run
                    ? `${fmt(Math.max(0, config.targetSeconds - elapsed))} left`
                    : `${config.targetSeconds / 60}-minute target`}
              </span>
            </div>
            <Suspense
              fallback={
                <div className="bm-scene-loading">
                  <LoaderCircle className="spin" />
                  Loading the stockroom…
                </div>
              }
            >
              <Scene
                ref={scene}
                state={sceneState}
                onAction={action}
                onDrop={place}
                onXRChange={(active) => {
                  setXR(active);
                  if (!active) void pause().catch(() => {});
                }}
                onReady={setReady}
                onFocusLoss={() =>
                  void pause().catch(() =>
                    setFeedback({
                      correct: false,
                      message: 'Reconnect before continuing; pause could not be saved.',
                    }),
                  )
                }
                onNotice={(message) => setFeedback({ correct: false, message })}
              />
            </Suspense>
            <div className="bm-room-caption">
              <span>
                <Hand size={16} />
                Stationary · one-hand essentials
              </span>
              <button onClick={() => scene.current?.reset()}>
                <RotateCcw size={14} />
                Reset view
              </button>
            </div>
          </div>
          <div className="bm-zone-legend">
            <span>
              <span className="zone-symbol health">
                <Check size={13} />
              </span>
              Left: Health & Wellness
            </span>
            <span>
              <span className="zone-symbol grocery">
                <Check size={13} />
              </span>
              Right: Grocery & Household
            </span>
            <span>
              <TriangleAlert size={16} />
              Separate: Quarantine
            </span>
          </div>
          {run && run.status === 'in_progress' && (
            <div className="bm-carton-tray">
              <div className="bm-tray-header">
                <strong>Delivery cartons</strong>
                <span>
                  {placed}/{total} placed
                </span>
              </div>
              <div className="bm-carton-grid">
                {run.manifest.items.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => select(i.id)}
                    disabled={busy || run.paused}
                    className={`${i.id === selectedId ? 'selected ' : ''}${run.placements[i.id] ? 'done' : ''}`}
                    aria-label={`${i.id} ${i.name}${run.placements[i.id] ? ' — placed' : ''}`}
                    aria-pressed={i.id === selectedId}
                  >
                    <span>
                      {run.placements[i.id] ? <CheckCircle2 size={22} /> : <Box size={22} />}
                    </span>
                    <strong>{i.id}</strong>
                    <small>{i.name}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bm-xr-entry">
            <span>
              <Headset size={23} />
              <div>
                <strong>Ready to use your hands?</strong>
                <p>Open the direct HTTPS URL in a compatible headset browser.</p>
              </div>
            </span>
            <div>
              {xr ? (
                <button className="bm-secondary" onClick={() => void scene.current?.exit()}>
                  <X size={16} />
                  Exit immersive
                </button>
              ) : (
                <>
                  <button
                    className="bm-secondary"
                    onClick={() => void enter('immersive-vr')}
                    disabled={!ready || !support.vr}
                  >
                    Enter hands-only VR
                  </button>
                  {support.ar && (
                    <button
                      className="bm-secondary"
                      onClick={() => void enter('immersive-ar')}
                      disabled={!ready}
                    >
                      Try passthrough
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="bm-validation-note">
            Desktop and XR emulation are separate from physical Quest testing. Hands, passthrough,
            comfort and device performance are not yet hardware-verified.
          </p>
          <a href="/" className="bm-site-link">
            <ArrowLeft size={15} />
            Back to OpsSim Africa
          </a>
        </section>
        <section className="bm-control-panel" aria-label="Receiving task panel" aria-busy={busy}>
          <div className="bm-panel-top">
            <span>
              <i />{' '}
              {phase === 'scorecard'
                ? 'SCORECARD'
                : phase === 'record'
                  ? 'RECEIVING TABLET'
                  : 'TASK PANEL'}
            </span>
            <button onClick={openComfort} aria-label="Open comfort settings">
              <Settings2 size={19} />
            </button>
          </div>
          {feedback && (
            <div
              className={`bm-feedback ${feedback.correct ? 'correct' : 'warning'}`}
              role={feedback.correct ? 'status' : 'alert'}
            >
              {feedback.correct ? <CheckCircle2 size={20} /> : <TriangleAlert size={20} />}
              <span>{feedback.message}</span>
              <button aria-label="Dismiss feedback" onClick={() => setFeedback(null)}>
                <X size={15} />
              </button>
            </div>
          )}
          {isPaused ? (
            <div className="bm-paused">
              <span>
                <Pause size={32} />
              </span>
              <h2>Your shift is paused.</h2>
              <p>
                Your records and carton placements are saved. Pause time is excluded from the score.
              </p>
              <PrimaryButton onClick={resume} disabled={busy}>
                Resume shift
              </PrimaryButton>
              <button className="bm-back" onClick={() => go('profile')}>
                Back to practice
              </button>
            </div>
          ) : (
            content
          )}
          {running && ['active', 'record', 'sort', 'note', 'summary', 'review'].includes(phase) && (
            <div className="bm-panel-bottom">
              <button onClick={() => void exclusive(pause)} disabled={busy}>
                <Pause size={16} />
                Pause shift
              </button>
              <button onClick={() => action('hint')} disabled={busy}>
                <Hand size={16} />
                Hint
              </button>
              <span>{busy ? 'Saving…' : `${placed}/${total} cartons placed`}</span>
            </div>
          )}
        </section>
      </div>
      <div className="bm-demo-bottom">
        <ShieldCheck size={17} />
        <p>
          Safe practice, not real inventory. {data.settings.workspaceName} is a shared demo
          workspace; roles are views, not access control.
        </p>
        <a href="/app#receiving">
          Historical receiving lab <ArrowRight size={14} />
        </a>
      </div>
      {xr && (
        <div className="bm-xr-dom-fallback" aria-hidden="true">
          Use the in-world task panel and receiving tablet. All essential actions work with one
          hand.
        </div>
      )}
    </div>
  );
}
