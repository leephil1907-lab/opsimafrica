import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Hand,
  Headset,
  RotateCcw,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useOps } from '../context';
import { api, post, put } from '../lib/api';
import { Avatar, ScoreBadge } from '../components/ui';
import type {
  AccessRole,
  BoardButton,
  BoardView,
  LabBootstrap,
  LabConfig,
  LabRun,
  LabSceneHandle,
  Phase,
  Reason,
  ReceivingRecord,
  SceneState,
  Zone,
} from './types';
import type { Member } from '../types';
import './receiving.css';
const Scene = lazy(() => import('./ReceivingScene').then((m) => ({ default: m.ReceivingScene })));
const reasons: Reason[] = ['none', 'damage', 'expiry', 'label'];
const reasonLabels = {
  none: 'No exception',
  damage: 'Damaged seal',
  expiry: 'Expired goods',
  label: 'Label mismatch',
};
const failureLabels: Record<string, string> = {
  inspection: 'Skipped inspection',
  damage: 'Damage checks missed',
  expiry: 'Expiry checks missed',
  label: 'SKU mismatch missed',
  storage: 'Wrong storage zone',
  reason: 'Wrong exception reason',
  record: 'Unreconciled receiving form',
};
const defaultConfig: LabConfig = {
  variant: 'standard',
  targetSeconds: 360,
  businessType: 'Supermarket',
  jobRole: 'Shop attendant',
  focus: 'complete',
};
const durationOptions = [360, 300, 600, 900];
const fmt = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, '0')}`;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const stored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private browsing can disallow storage. */
  }
};
function savedForm(run: LabRun) {
  if (run.record)
    return {
      accepted: String(run.record.accepted),
      quarantined: String(run.record.quarantined),
      shortfall: String(run.record.shortfall),
    };
  try {
    const draft = JSON.parse(stored('opssim-receiving-draft:' + run.id) || 'null');
    if (
      draft &&
      ['accepted', 'quarantined', 'shortfall'].every(
        (k) => typeof draft[k] === 'string' && /^\d{0,3}$/.test(draft[k]),
      )
    )
      return draft as { accepted: string; quarantined: string; shortfall: string };
  } catch {
    /* An invalid local draft should not prevent restoring server progress. */
  }
  return { accepted: '', quarantined: '', shortfall: '' };
}
// Keep in-world text readable instead of silently cropping a long briefing.
function textPages(lines: string[]) {
  const wrapped: string[] = [];
  for (const line of lines) {
    let part = '';
    for (const word of line.split(' ')) {
      if ((part + ' ' + word).length > 54 && part) {
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
export interface LabLaunch {
  runId?: string;
  memberId?: string;
  fresh?: boolean;
  nonce?: number;
  role?: AccessRole;
}

export default function ReceivingLab({ launch }: { launch?: LabLaunch }) {
  const { data, refresh, toast, navigate } = useOps();
  const [lab, setLab] = useState<LabBootstrap | null>(null);
  const [members, setMembers] = useState<Member[]>(data.members);
  const [config, setConfig] = useState<LabConfig>(defaultConfig);
  const [memberId, setMemberId] = useState(
    launch?.memberId || stored('opssim-practice-member') || data.members[0]?.id || '',
  );
  const [accessRole, setAccessRole] = useState<AccessRole>(launch?.role || 'trainee');
  const [phase, setPhase] = useState<Phase>('profile');
  const [run, setRun] = useState<LabRun | null>(null);
  const runRef = useRef<LabRun | null>(null);
  const runAt = useRef(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason>('none');
  const [record, setRecord] = useState({ accepted: '', quarantined: '', shortfall: '' });
  const [recordField, setRecordField] = useState<keyof ReceivingRecord>('accepted');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [xrActive, setXRActive] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [xrMode, setXRMode] = useState('VR');
  const [xrSupport, setXRSupport] = useState({ vr: false, ar: false });
  const [now, setNow] = useState(Date.now());
  const [guideKind, setGuideKind] = useState<'hands' | 'invoice'>('hands');
  const [guideReturn, setGuideReturn] = useState<Phase>('profile');
  const [keyboardPurpose, setKeyboardPurpose] = useState<'workspace' | 'name' | 'code'>('name');
  const [keyboardBuffer, setKeyboardBuffer] = useState('');
  const [keyboardReturn, setKeyboardReturn] = useState<Phase>('profile');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [dueDays, setDueDays] = useState(7);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [textPage, setTextPage] = useState(0);
  useEffect(() => setTextPage(0), [phase, selectedId, confirmSubmit, keyboardPurpose]);
  const scene = useRef<LabSceneHandle>(null);
  useEffect(() => {
    if (run?.status === 'in_progress')
      save('opssim-receiving-draft:' + run.id, JSON.stringify(record));
  }, [run?.id, run?.status, record]);
  const member = members.find((m) => m.id === memberId) || members[0];
  const selected = run?.manifest.items.find((i) => i.id === selectedId);
  const placedCount = Object.keys(run?.placements || {}).length;
  const total = run?.manifest.delivered || 10;
  const elapsed = run
    ? run.elapsedSeconds +
      (!run.paused && run.status === 'in_progress'
        ? Math.max(0, Math.floor((now - runAt.current) / 1000))
        : 0)
    : 0;
  const allSorted = Boolean(run) && placedCount === total;
  const acceptedCount = Object.values(run?.placements || {}).filter(
    (p) => p.zone !== 'quarantine',
  ).length;
  const quarantinedCount = placedCount - acceptedCount;
  const pending =
    lab?.assignments.filter((a) => a.memberId === memberId && a.status === 'pending') || [];
  const focusedGuide =
    config.focus === 'exceptions'
      ? 'Focus: inspect seals, dates and printed SKUs before accepting stock.'
      : config.focus === 'recording'
        ? 'Focus: accepted + quarantined = delivered; shortfall = ordered − delivered.'
        : 'Focus: inspect → classify → record → submit.';
  const adopt = useCallback((next: LabRun) => {
    runRef.current = next;
    runAt.current = Date.now();
    setRun(next);
    save('opssim-receiving-run', next.id);
  }, []);
  const refreshLab = useCallback(async () => {
    const result = await api<LabBootstrap>('/receiving/bootstrap');
    setLab(result);
    return result;
  }, []);
  const exclusive = useCallback(async (fn: () => Promise<void>) => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setFeedback({ correct: false, message: errorText(e) });
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  const pause = useCallback(async () => {
    const current = runRef.current;
    if (current?.status === 'in_progress' && !current.paused) {
      const next = await post<LabRun>(`/receiving/runs/${current.id}/pause`);
      adopt(next);
    }
  }, [adopt]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const b = await api<LabBootstrap>('/receiving/bootstrap');
        if (!active) return;
        setLab(b);
        setMembers(data.members);
        setConfig(b.defaults);
        if (launch?.role) {
          setAccessRole(launch.role);
          setPhase(launch.role === 'manager' ? 'manager' : 'profile');
        }
        if (launch?.memberId) setMemberId(launch.memberId);
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        if (params.get('invite')) {
          setJoinCode(params.get('invite') || '');
          setPhase('invite');
        }
        const id =
          launch?.runId ||
          (!params.get('invite') && !launch?.fresh ? stored('opssim-receiving-run') : null);
        if (id) {
          try {
            let r = await api<LabRun>(`/receiving/runs/${encodeURIComponent(id)}`);
            if (r.status === 'in_progress') r = await post<LabRun>(`/receiving/runs/${r.id}/pause`);
            if (!active) return;
            adopt(r);
            setMemberId(r.memberId);
            if (r.status === 'in_progress' || launch?.runId) {
              setConfig(r.config);
              setSelectedId(
                r.manifest.items.find((i) => !r.placements[i.id])?.id || r.manifest.items[0].id,
              );
              setRecord(savedForm(r));
              setPhase(r.status === 'completed' ? 'scorecard' : 'active');
            }
          } catch (e) {
            if (launch?.runId) throw e;
            save('opssim-receiving-run', '');
          }
        }
      } catch (e) {
        if (active) setLoadError(errorText(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      const current = runRef.current;
      if (current?.status === 'in_progress')
        void post(`/receiving/runs/${current.id}/pause`).catch(() => {});
    };
    // A launch is an explicit navigation, not a bootstrap refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch?.nonce]);
  useEffect(() => {
    setMembers(data.members);
  }, [data.members]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!navigator.xr) return;
    void Promise.all([
      navigator.xr.isSessionSupported('immersive-vr'),
      navigator.xr.isSessionSupported('immersive-ar'),
    ])
      .then(([vr, ar]) => setXRSupport({ vr, ar }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden')
        void pause().catch(() =>
          setFeedback({
            correct: false,
            message: 'Could not save the pause. Reconnect before continuing.',
          }),
        );
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [pause]);
  useEffect(() => {
    const beforeUnload = () => {
      const current = runRef.current;
      if (current?.status === 'in_progress')
        navigator.sendBeacon(
          `/api/receiving/runs/${current.id}/pause`,
          new Blob(['{}'], { type: 'application/json' }),
        );
    };
    window.addEventListener('pagehide', beforeUnload);
    return () => window.removeEventListener('pagehide', beforeUnload);
  }, []);
  const setMember = (id: string) => {
    setMemberId(id);
    save('opssim-practice-member', id);
  };
  const selectCarton = (id: string) => {
    if (runRef.current?.paused) return;
    setSelectedId(id);
    if (id !== selectedId) setReason(runRef.current?.placements[id]?.reason || 'none');
  };
  const perform = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      if (working.current) return false;
      const current = runRef.current;
      if (!current) return false;
      let correct = false;
      await exclusive(async () => {
        try {
          const result = await post<{
            correct: boolean;
            message: string;
            completed: boolean;
            run: LabRun;
          }>(`/receiving/runs/${current.id}/action`, { ...body, version: current.version });
          adopt(result.run);
          correct = result.correct;
          const errors = result.run.events.filter(
            (e) => !e.correct && e.itemId === (body.itemId || null),
          ).length;
          setFeedback({
            correct: result.correct,
            message:
              result.message +
              (!result.correct && errors >= 2
                ? ' Hint: use the invoice and shelf-audit counts; compare the actual seal, date and printed SKU.'
                : ''),
          });
          if (result.correct && body.type === 'place') {
            const next = result.run.manifest.items.find((i) => !result.run.placements[i.id]);
            setSelectedId(next?.id || null);
            setReason('none');
          }
          if (result.completed) {
            setPhase('scorecard');
            setConfirmSubmit(false);
            await Promise.all([refresh(), refreshLab()]);
          }
        } catch (e) {
          try {
            const recovered = await api<LabRun>(`/receiving/runs/${current.id}`);
            adopt(recovered);
            if (recovered.status === 'completed') setPhase('scorecard');
          } catch {
            /* Preserve the visible state while offline. */
          }
          throw e;
        }
      });
      return correct;
    },
    [adopt, exclusive, refresh, refreshLab],
  );
  const place = useCallback(
    (id: string, zone: Zone) => perform({ type: 'place', itemId: id, zone, reason }),
    [perform, reason],
  );
  const switchRole = async (role: AccessRole) => {
    await exclusive(async () => {
      await pause();
      setAccessRole(role);
      setPhase(role === 'manager' ? 'manager' : 'profile');
      setFeedback(null);
    });
  };
  const openKeyboard = (purpose: typeof keyboardPurpose, value: string, back: Phase) => {
    setKeyboardPurpose(purpose);
    setKeyboardBuffer(value);
    setKeyboardReturn(back);
    setPhase('keyboard');
  };
  const prepare = (harder = false) => {
    setConfig((c) => ({ ...c, variant: harder ? 'harder' : run?.config.variant || c.variant }));
    setConfirmSubmit(false);
    setFeedback(null);
    setPhase('briefing');
  };
  const start = () =>
    exclusive(async () => {
      await pause();
      const next = await post<LabRun>('/receiving/runs', { memberId: member?.id, config });
      adopt(next);
      setSelectedId(next.manifest.items[0].id);
      setReason('none');
      setRecord({ accepted: '', quarantined: '', shortfall: '' });
      setConfirmSubmit(false);
      setFeedback({
        correct: true,
        message:
          'Delivery ready. Pick a carton and inspect its label, seal, expiry and storage requirement.',
      });
      setPhase('active');
      history.replaceState(null, '', `#receiving?run=${next.id}`);
      await Promise.all([refresh(), refreshLab()]);
    });
  const assign = () =>
    exclusive(async () => {
      const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10);
      await post('/receiving/assignments', { memberId: member?.id, dueDate, config });
      await Promise.all([refresh(), refreshLab()]);
      setFeedback({
        correct: true,
        message: `${config.focus === 'complete' ? 'Receiving practice' : 'Focused ' + config.focus + ' practice'} assigned to ${member?.name}, due ${dueDate}.`,
      });
    });
  const openRun = (id: string) =>
    exclusive(async () => {
      await pause();
      const result = await api<LabRun>(`/receiving/runs/${id}`);
      adopt(result);
      setConfig(result.config);
      setRecord(savedForm(result));
      setMember(result.memberId);
      if (result.status === 'in_progress') {
        const paused = await post<LabRun>(`/receiving/runs/${id}/pause`);
        adopt(paused);
      }
      setPhase(result.status === 'completed' ? 'scorecard' : 'active');
      setSelectedId(result.manifest.items.find((i) => !result.placements[i.id])?.id || null);
      setFeedback(null);
      history.replaceState(null, '', `#receiving?run=${id}`);
    });
  const enterXR = async (mode: 'immersive-vr' | 'immersive-ar') => {
    try {
      if (!scene.current)
        throw new Error('The 3D stockroom is still loading. Try again in a moment.');
      await scene.current.enter(mode);
    } catch (e) {
      setFeedback({ correct: false, message: errorText(e) });
    }
  };
  const xrChanged = useCallback(
    (active: boolean, mode?: string) => {
      setXRActive(active);
      if (mode) setXRMode(mode);
      if (!active) void pause().catch(() => {});
    },
    [pause],
  );
  const onAction = (id: string) => {
    if (busy && id !== 'exit-vr') return;
    if (id === 'detail-prev') {
      setTextPage((p) => Math.max(0, p - 1));
      return;
    }
    if (id === 'detail-next') {
      setTextPage((p) => p + 1);
      return;
    }
    if (id.startsWith('select:')) {
      if (phase === 'active') selectCarton(id.slice(7));
      return;
    }
    if (id.startsWith('mode:')) {
      void switchRole(id.slice(5) as AccessRole);
      return;
    }
    if (id.startsWith('reason:')) {
      setReason(id.slice(7) as Reason);
      return;
    }
    if (id.startsWith('place:')) {
      if (selectedId) void place(selectedId, id.slice(6) as Zone);
      return;
    }
    if (id.startsWith('field:')) {
      setRecordField(id.slice(6) as keyof ReceivingRecord);
      setConfirmSubmit(false);
      return;
    }
    if (id.startsWith('digit:')) {
      const digit = id.slice(6);
      setRecord((r) => ({
        ...r,
        [recordField]: (r[recordField] + digit).replace(/^0+(?=\d)/, '').slice(0, 3),
      }));
      return;
    }
    if (id.startsWith('letter:')) {
      setKeyboardBuffer((b) => (b + id.slice(7)).slice(0, 70));
      return;
    }
    if (id.startsWith('assignment:')) {
      const a = lab?.assignments.find((a) => a.id === id.slice(11));
      if (a) {
        setConfig(a.config);
        setPhase('briefing');
        setFeedback(null);
      }
      return;
    }
    if (id === 'brief') {
      setPhase('briefing');
      setFeedback(null);
      return;
    }
    if (id === 'start') {
      void start();
      return;
    }
    if (id === 'back-profile' || id === 'new-shift') {
      void exclusive(async () => {
        await pause();
        setPhase('profile');
        setFeedback(null);
        history.replaceState(null, '', '#receiving');
      });
      return;
    }
    if (id === 'member-next' || id === 'member-prev') {
      const index = members.findIndex((m) => m.id === member?.id);
      setMember(
        members[(index + (id === 'member-next' ? 1 : members.length - 1)) % members.length]?.id ||
          '',
      );
      setHistoryIndex(0);
      return;
    }
    if (id === 'job-next') {
      setConfig((c) => ({
        ...c,
        jobRole:
          lab?.roles[((lab?.roles.indexOf(c.jobRole) || 0) + 1) % (lab?.roles.length || 1)] ||
          c.jobRole,
      }));
      return;
    }
    if (id === 'business-next') {
      setConfig((c) => ({
        ...c,
        businessType:
          lab?.businessTypes[
            ((lab?.businessTypes.indexOf(c.businessType) || 0) + 1) %
              (lab?.businessTypes.length || 1)
          ] || c.businessType,
      }));
      return;
    }
    if (id === 'difficulty-next') {
      setConfig((c) => {
        const presets = [
          { variant: 'standard' as const, targetSeconds: 600 },
          { variant: 'standard' as const, targetSeconds: 360 },
          { variant: 'standard' as const, targetSeconds: 300 },
          { variant: 'harder' as const, targetSeconds: 360 },
        ];
        const index = presets.findIndex(
          (p) => p.variant === c.variant && p.targetSeconds === c.targetSeconds,
        );
        return { ...c, ...presets[(index + 1) % presets.length] };
      });
      return;
    }
    if (id === 'duration-next') {
      setConfig((c) => ({
        ...c,
        targetSeconds:
          durationOptions[(durationOptions.indexOf(c.targetSeconds) + 1) % durationOptions.length],
      }));
      return;
    }
    if (id === 'focus-next') {
      setConfig((c) => ({
        ...c,
        focus: (['complete', 'exceptions', 'recording'] as const)[
          (['complete', 'exceptions', 'recording'].indexOf(c.focus) + 1) % 3
        ],
      }));
      return;
    }
    if (id === 'carton-near') {
      scene.current?.bringCloser();
      return;
    }
    if (id === 'inspect') {
      if (selectedId) void perform({ type: 'inspect', itemId: selectedId });
      return;
    }
    if (id === 'next-carton') {
      const items = run?.manifest.items.filter((i) => !run.placements[i.id]) || [];
      const index = items.findIndex((i) => i.id === selectedId);
      if (items.length) selectCarton(items[(index + 1) % items.length].id);
      return;
    }
    if (id === 'invoice' || id === 'hands-guide') {
      setGuideKind(id === 'invoice' ? 'invoice' : 'hands');
      setGuideReturn(phase === 'guide' ? guideReturn : phase);
      setPhase('guide');
      return;
    }
    if (id === 'guide-back') {
      setPhase(guideReturn);
      return;
    }
    if (id === 'record') {
      setConfirmSubmit(false);
      setPhase('record');
      return;
    }
    if (id === 'floor') {
      setPhase('active');
      setConfirmSubmit(false);
      return;
    }
    if (id === 'count-clear') {
      setRecord((r) => ({ ...r, [recordField]: '' }));
      return;
    }
    if (id === 'count-backspace') {
      setRecord((r) => ({ ...r, [recordField]: r[recordField].slice(0, -1) }));
      return;
    }
    if (id === 'submit-review') {
      if (Object.values(record).some((v) => v === '')) {
        setFeedback({
          correct: false,
          message: 'Enter accepted, quarantined and shortfall counts before confirming the report.',
        });
        return;
      }
      setFeedback(null);
      setConfirmSubmit(true);
      return;
    }
    if (id === 'edit-report') {
      setConfirmSubmit(false);
      return;
    }
    if (id === 'confirm-submit') {
      void perform({
        type: 'submit',
        record: {
          accepted: Number(record.accepted),
          quarantined: Number(record.quarantined),
          shortfall: Number(record.shortfall),
        },
      });
      setConfirmSubmit(false);
      return;
    }
    if (id === 'pause') {
      void exclusive(async () => {
        await pause();
        setFeedback({
          correct: true,
          message: 'Shift paused. Active time has stopped. Resume explicitly when you are ready.',
        });
      });
      return;
    }
    if (id === 'resume') {
      void exclusive(async () => {
        const current = runRef.current;
        if (current) {
          adopt(await post<LabRun>(`/receiving/runs/${current.id}/resume`));
          setPhase('active');
          setFeedback(null);
        }
      });
      return;
    }
    if (id === 'retry' || id === 'harder') {
      prepare(id === 'harder');
      return;
    }
    if (id === 'share-team') {
      setFeedback({
        correct: true,
        message: `Already saved to ${lab?.workspaceName}. The shared manager view can review this scorecard now; no email or WhatsApp was sent.`,
      });
      return;
    }
    if (id === 'join') {
      setPhase('invite');
      setFeedback(null);
      return;
    }
    if (id === 'join-name') {
      openKeyboard('name', joinName, 'invite');
      return;
    }
    if (id === 'join-code') {
      openKeyboard('code', joinCode, 'invite');
      return;
    }
    if (id === 'join-confirm') {
      void exclusive(async () => {
        const m = await post<Member>('/receiving/join', {
          code: joinCode,
          name: joinName,
          jobRole: config.jobRole,
        });
        setMembers((ms) => [...ms, m]);
        setMember(m.id);
        await Promise.all([refresh(), refreshLab()]);
        setAccessRole('trainee');
        setPhase('profile');
        setFeedback({
          correct: true,
          message: `Welcome, ${m.name}. Your practice profile has joined the shared workspace.`,
        });
      });
      return;
    }
    if (id === 'keyboard-space') {
      setKeyboardBuffer((b) => (b + ' ').slice(0, 70));
      return;
    }
    if (id === 'keyboard-backspace') {
      setKeyboardBuffer((b) => b.slice(0, -1));
      return;
    }
    if (id === 'keyboard-clear') {
      setKeyboardBuffer('');
      return;
    }
    if (id === 'keyboard-cancel') {
      setPhase(keyboardReturn);
      return;
    }
    if (id === 'keyboard-done') {
      void exclusive(async () => {
        if (keyboardPurpose === 'workspace') {
          await put('/receiving/workspace', { name: keyboardBuffer });
          await Promise.all([refresh(), refreshLab()]);
        } else if (keyboardPurpose === 'name') setJoinName(keyboardBuffer);
        else setJoinCode(keyboardBuffer.toUpperCase().trim());
        setPhase(keyboardReturn);
        setFeedback(null);
      });
      return;
    }
    if (id === 'workspace-name') {
      openKeyboard('workspace', lab?.workspaceName || '', 'manager');
      return;
    }
    if (id === 'invite-details') {
      setJoinCode(lab?.inviteCode || '');
      setPhase('invite');
      return;
    }
    if (id === 'copy-invite') {
      const url = `${location.origin}${location.pathname}#receiving?invite=${lab?.inviteCode}`;
      void navigator.clipboard
        ?.writeText(url)
        .then(() => toast('Practice invite link copied.'))
        .catch(() => toast(`Invite code: ${lab?.inviteCode}`));
      setFeedback({
        correct: true,
        message: `Practice code: ${lab?.inviteCode}. This is a shared demo invite, not a secure account invitation.`,
      });
      return;
    }
    if (id === 'deadline-next') {
      setDueDays((d) => [1, 3, 7, 14][([1, 3, 7, 14].indexOf(d) + 1) % 4]);
      return;
    }
    if (id === 'assign') {
      void assign();
      return;
    }
    if (id === 'save-defaults') {
      void exclusive(async () => {
        await put('/receiving/defaults', config);
        await refreshLab();
        setFeedback({
          correct: true,
          message:
            'Trainer defaults saved. New practices use this difficulty, duration and focused coaching.',
        });
      });
      return;
    }
    if (id === 'history-next') {
      setHistoryIndex((n) => n + 1);
      return;
    }
    if (id === 'review-run') {
      const history = lab?.runs.filter((r) => r.memberId === member?.id) || [];
      const item = history[historyIndex % Math.max(1, history.length)];
      if (item) void openRun(item.id);
      return;
    }
    if (id === 'last-score') {
      if (run) setPhase('scorecard');
      return;
    }
    if (id === 'resume-last') {
      if (run) {
        setConfig(run.config);
        setPhase('active');
      }
      return;
    }
    if (id === 'exit-vr') {
      void scene.current?.exit();
      return;
    }
  };
  const board: BoardView = useMemo(() => {
    const btn = (
      id: string,
      label: string,
      style?: BoardButton['style'],
      disabled = false,
    ): BoardButton => ({ id, label, style, disabled });
    let title = '',
      eyebrow = '',
      lines: string[] = [],
      buttons: BoardButton[] = [],
      columns = 3;
    const modeButtons = [
      btn('mode:trainee', 'Trainee', accessRole === 'trainee' ? 'active' : 'subtle'),
      btn('mode:manager', 'Manager', accessRole === 'manager' ? 'active' : 'subtle'),
      btn('mode:trainer', 'Trainer', accessRole === 'trainer' ? 'active' : 'subtle'),
    ];
    const level =
      config.variant === 'harder'
        ? 'Harder · 12 cartons'
        : config.targetSeconds >= 600
          ? 'Beginner · 10 cartons'
          : config.targetSeconds === 300
            ? 'Time-pressured · 10 cartons'
            : 'Standard · 10 cartons';
    if (phase === 'profile') {
      eyebrow = 'RETAIL STOCK RECEIVING';
      title =
        accessRole === 'trainer' ? 'Build a better next shift' : 'Your next shift starts here';
      lines = [
        `${lab?.workspaceName || 'Demo business'} · shared practice`,
        `${member?.name || 'Learner'} · ${config.jobRole}`,
        `${config.businessType} · ${level}`,
        `Target ${config.targetSeconds / 60} min · ${config.focus} coaching`,
        focusedGuide,
        'One food-retail dataset across business contexts.',
        'Role selection is a demo, not secure permissions.',
      ];
      buttons = [
        ...modeButtons,
        btn('member-next', 'Change learner'),
        btn('job-next', 'Change job role'),
        btn('business-next', 'Business context'),
        btn('difficulty-next', 'Difficulty'),
        btn('duration-next', 'Duration'),
        btn('focus-next', 'Coaching focus'),
        btn('brief', 'Retail Stock Receiving', 'primary'),
        btn('join', 'Join a team'),
        btn('hands-guide', 'How hands work'),
      ];
      if (pending[0])
        buttons.push(btn(`assignment:${pending[0].id}`, 'Assigned practice', 'primary'));
      if (run?.status === 'in_progress')
        buttons.push(btn('resume-last', 'Resume saved shift', 'primary'));
      else if (run?.status === 'completed') buttons.push(btn('last-score', 'Last scorecard'));
      if (accessRole === 'trainer')
        buttons.push(btn('save-defaults', 'Save trainer defaults', 'primary'));
    } else if (phase === 'briefing') {
      eyebrow = `${config.variant === 'harder' ? 'NG-2048' : 'NG-2047'} / SHIFT BRIEFING`;
      title = 'Inspect. Sort. Record. Submit.';
      lines = [
        `Objective: receive ${config.variant === 'harder' ? 12 : 10} cartons in ${config.targetSeconds / 60} min.`,
        `Reference: purchase order + carton labels; exercise date 2026-11-08.`,
        'Check each seal, printed SKU, expiry and storage label.',
        'Accept good stock in dry / cold storage; quarantine exceptions with a reason.',
        'Record accepted, quarantined and undelivered cartons, then confirm the report.',
        focusedGuide,
        'Success: every carton accounted for; no unsafe stock accepted.',
        'Timer starts on entry. Pause any time; overtime affects score, not access.',
      ];
      buttons = [
        btn('start', 'Enter stockroom', 'primary'),
        btn('hands-guide', 'Hands tutorial'),
        btn('back-profile', 'Back to profile'),
      ];
    } else if (phase === 'active') {
      eyebrow = `${run?.manifest.deliveryId} / ${placedCount} OF ${total} SORTED`;
      title = selected
        ? `${selected.id} · ${selected.name}`
        : allSorted
          ? 'The floor is accounted for'
          : 'Choose a delivery carton';
      lines = selected
        ? [
            `Printed SKU ${selected.printedSku} | PO product ${selected.sku}`,
            `Seal: ${selected.condition} · Store: ${selected.storage === 'cold' ? 'chilled / cold' : 'dry'}`,
            `Expiry ${selected.expiry} · Exercise date ${run?.manifest.inspectionDate}`,
            `${run?.inspected.includes(selected.id) ? 'Inspection confirmed' : 'Read the label and confirm inspection before moving.'}`,
            `Exception reason: ${reasonLabels[reason]}`,
            `Sorted ${placedCount}/${total} · ${total - placedCount} left · Inspected ${run?.inspected.length}/${total}`,
          ]
        : [
            `Delivered ${total} / ordered ${run?.manifest.expected}.`,
            `Accepted ${acceptedCount} · Quarantined ${quarantinedCount}`,
            allSorted
              ? 'Complete the receiving form to finish this shift.'
              : 'Pick up a carton or point and pinch to select it.',
            focusedGuide,
          ];
      buttons = [
        btn(
          'inspect',
          run?.inspected.includes(selectedId || '') ? 'Inspected ✓' : 'Confirm inspection',
          'primary',
          !selected || Boolean(run?.inspected.includes(selected.id)),
        ),
        btn(
          'carton-near',
          'Closer inspection',
          undefined,
          !selected || Boolean(run?.placements[selected.id]),
        ),
        ...reasons.map((r) =>
          btn(
            `reason:${r}`,
            reasonLabels[r],
            reason === r ? 'active' : undefined,
            !selected || Boolean(run?.placements[selected.id]),
          ),
        ),
        btn(
          'place:dry',
          'Place: dry rack',
          undefined,
          !selected ||
            !run?.inspected.includes(selected.id) ||
            Boolean(run?.placements[selected.id]),
        ),
        btn(
          'place:cold',
          'Place: cold store',
          undefined,
          !selected ||
            !run?.inspected.includes(selected.id) ||
            Boolean(run?.placements[selected.id]),
        ),
        btn(
          'place:quarantine',
          'Place: quarantine',
          'warning',
          !selected ||
            !run?.inspected.includes(selected.id) ||
            Boolean(run?.placements[selected.id]),
        ),
        btn('next-carton', 'Next carton', undefined, allSorted),
        btn('invoice', 'Purchase order'),
        btn('record', 'Receiving form', allSorted ? 'primary' : undefined),
        btn('pause', 'Pause shift'),
      ];
    } else if (phase === 'record') {
      eyebrow = 'SHELF AUDIT / RECEIVING FORM';
      if (confirmSubmit) {
        title = 'Submit this receiving report?';
        lines = [
          `Accepted: ${record.accepted} · Quarantined: ${record.quarantined}`,
          `Shortfall: ${record.shortfall}`,
          `Delivery ${run?.manifest.deliveryId} · ${placedCount}/${total} sorted`,
          'This final confirmation records your score and completes matching assignments.',
        ];
        buttons = [
          btn('confirm-submit', 'Confirm & submit', 'primary'),
          btn('edit-report', 'Edit counts'),
          btn('pause', 'Pause shift'),
        ];
      } else {
        title = `${recordField === 'accepted' ? 'Accepted stock' : recordField === 'quarantined' ? 'Quarantined stock' : 'Delivery shortfall'}: ${record[recordField] || '—'}`;
        lines = [
          `Accepted ${record.accepted || '—'} | Quarantined ${record.quarantined || '—'} | Shortfall ${record.shortfall || '—'}`,
          `Shelf audit: accepted ${acceptedCount}, quarantined ${quarantinedCount}.`,
          `Purchase order: ${run?.manifest.expected} ordered; ${total} delivered.`,
          'Accepted + quarantined = delivered. Shortfall = ordered − delivered.',
          `${placedCount}/${total} cartons correctly placed. ${allSorted ? 'Ready to record.' : 'Finish sorting before submitting.'}`,
        ];
        buttons = [
          btn('field:accepted', 'Accepted', recordField === 'accepted' ? 'active' : undefined),
          btn(
            'field:quarantined',
            'Quarantined',
            recordField === 'quarantined' ? 'active' : undefined,
          ),
          btn('field:shortfall', 'Shortfall', recordField === 'shortfall' ? 'active' : undefined),
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => btn(`digit:${n}`, String(n))),
          btn('count-clear', 'Clear'),
          btn('digit:0', '0'),
          btn('count-backspace', '⌫ Backspace'),
          btn('submit-review', 'Review & submit', 'primary', !allSorted),
          btn('floor', 'Back to floor'),
          btn('pause', 'Pause shift'),
        ];
      }
    } else if (phase === 'scorecard') {
      eyebrow = 'SHIFT COMPLETE / SAVED SCORECARD';
      title =
        (run?.score || 0) >= 85
          ? 'Good stock. Better judgement.'
          : 'One shift closer to confident.';
      lines = [
        `${run?.score}/100 score · ${run?.accuracy}% accuracy · ${fmt(run?.elapsedSeconds || 0)} active time`,
        `${run?.exceptionsCaught}/${run?.exceptionsTotal} exceptions caught · ${run?.firstPassExceptions} on first attempt`,
        `Accepted ${run?.record?.accepted} · Quarantined ${run?.record?.quarantined} · Shortfall ${run?.record?.shortfall}`,
        run?.previous
          ? `Previous: ${run.previous.score}/100. Improvement: ${(run.score || 0) - run.previous.score >= 0 ? '+' : ''}${(run.score || 0) - run.previous.score} points.`
          : 'First comparable attempt: same delivery variant, target time and coaching.',
        ...(run?.recommendations || ['Review the receiving rules and practise again.']),
        `Saved for ${run?.memberName} in the shared team workspace.`,
      ];
      buttons = [
        btn('retry', 'Retry this delivery', 'primary'),
        btn('harder', 'Harder variation', undefined, run?.config.variant === 'harder'),
        btn('new-shift', 'New profile / shift'),
        btn('share-team', 'Send result to team'),
        btn('mode:manager', 'Manager review'),
        btn('hands-guide', 'Hands tutorial'),
      ];
    } else if (phase === 'manager') {
      const history = lab?.runs.filter((r) => r.memberId === member?.id) || [];
      const item = history[historyIndex % Math.max(1, history.length)];
      const failures = Object.entries(lab?.failures || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      eyebrow = 'MANAGER / SHARED DEMO WORKSPACE';
      title = lab?.workspaceName || 'Name your practice team';
      lines = [
        `Selected learner: ${member?.name} · ${history.filter((r) => r.status === 'completed').length} completed shifts`,
        `${config.variant === 'harder' ? 'Harder / 12 cartons' : 'Standard / 10 cartons'} · ${config.focus} coaching · due in ${dueDays} days`,
        item
          ? `Review: ${item.status === 'completed' ? item.score + '/100' : item.status} · ${new Date(item.startedAt).toLocaleDateString('en-GB')}`
          : 'No receiving attempts for this learner yet.',
        `Team invite code: ${lab?.inviteCode || '—'}`,
        `Recurring errors: ${failures.map(([k, n]) => `${failureLabels[k] || k} (${n})`).join('; ') || 'none recorded yet'}`,
        'Named teams and role views are shared guest practice, not private accounts.',
      ];
      buttons = [
        ...modeButtons,
        btn('workspace-name', 'Name the team'),
        btn('member-next', 'Next learner'),
        btn('invite-details', 'Invite trainees'),
        btn('difficulty-next', 'Assign difficulty'),
        btn('focus-next', 'Remedial focus'),
        btn('deadline-next', 'Change deadline'),
        btn('assign', 'Assign practice', 'primary'),
        btn('history-next', 'Next attempt'),
        btn(
          'review-run',
          item?.status === 'completed' ? 'Review scorecard' : 'Resume attempt',
          undefined,
          !item,
        ),
      ];
    } else if (phase === 'invite') {
      eyebrow = 'PRACTICE TEAM / OPEN DEMO INVITE';
      title = 'Bring your next shift together';
      lines = [
        `Workspace: ${lab?.workspaceName}`,
        `Share this practice code: ${lab?.inviteCode}`,
        `New learner name: ${joinName || 'not entered'}`,
        `Your invite code: ${joinCode || 'not entered'}`,
        `Practice role: ${config.jobRole}`,
        'Shared guest profiles. Do not enter sensitive personal information.',
      ];
      buttons = [
        btn('join-name', 'Enter learner name'),
        btn('join-code', 'Enter invite code'),
        btn('job-next', 'Change practice role'),
        btn('join-confirm', 'Join workspace', 'primary', joinName.trim().length < 2 || !joinCode),
        btn('copy-invite', 'Copy invite link'),
        btn(accessRole === 'manager' ? 'mode:manager' : 'back-profile', 'Back'),
      ];
    } else if (phase === 'keyboard') {
      eyebrow = 'HANDS-ONLY TEXT ENTRY';
      title =
        keyboardPurpose === 'workspace'
          ? 'Name your team'
          : keyboardPurpose === 'name'
            ? 'Name your practice profile'
            : 'Enter practice code';
      lines = [
        keyboardBuffer || 'Type with the buttons below.',
        'Pinch or poke a key. No physical keyboard is needed.',
      ];
      columns = 6;
      const alphabet =
        keyboardPurpose === 'code' ? 'ABCDEF0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      buttons = [
        ...alphabet.split('').map((l) => btn(`letter:${l}`, l)),
        btn('keyboard-space', 'Space'),
        btn('keyboard-backspace', '⌫'),
        btn('keyboard-clear', 'Clear'),
        btn(
          'keyboard-done',
          'Save',
          'primary',
          keyboardPurpose !== 'code' && keyboardBuffer.trim().length < 2,
        ),
        btn('keyboard-cancel', 'Cancel'),
      ];
    } else {
      eyebrow =
        guideKind === 'invoice' ? 'REFERENCE / PURCHASE ORDER' : 'HANDS-FIRST / QUICK START';
      title =
        guideKind === 'invoice'
          ? `${run?.manifest.deliveryId || 'NG-2047'} · Mainland Foods`
          : 'Your hands are the controls';
      lines =
        guideKind === 'invoice'
          ? run
            ? [
                ...run.manifest.invoice.map((row) => `${row.sku}: ${row.name} × ${row.expected}`),
                `${run.manifest.expected} ordered / ${total} physical cartons delivered.`,
                `Exercise date ${run.manifest.inspectionDate}.`,
              ]
            : [
                'The purchase order lists the expected SKU and quantity.',
                'Inspect every delivered carton against it.',
                'The receiving form accounts for accepted, quarantined and missing stock.',
              ]
          : [
              'STAY SEATED: use ray dragging or Closer inspection. Do not walk towards the virtual racks.',
              'POINT + PINCH: point your index finger and touch thumb to index to select.',
              'GRAB: use Closer inspection to bring a carton within reach; close fingers around it and rotate your wrist.',
              'DRAG + RELEASE: point and pinch a distant carton, aim into a labelled zone, then open your hand.',
              'POKE: touch a tablet button with your index fingertip. One press per touch.',
              'INSPECT: rotate cartons / the paper invoice in your hand; confirm the tablet checklist.',
              'TABLET: grab its top edge to move it. “Tablet closer” brings it within reach.',
              'PAUSE: tracking loss cancels a held item; focus loss pauses time. Resume explicitly.',
              'Desktop / touch: drag real cartons in 3D, or use the equivalent labelled controls.',
            ];
      buttons = [
        btn('guide-back', 'Back', 'primary'),
        ...(run?.status === 'in_progress' ? [btn('pause', 'Pause shift')] : []),
      ];
    }
    if (run?.paused && run.status === 'in_progress' && ['active', 'record'].includes(phase)) {
      title = 'Your shift is paused';
      eyebrow = 'PAUSED / ACTIVE TIME STOPPED';
      lines = [
        `${placedCount}/${total} cartons sorted. Progress is saved.`,
        'Resume explicitly to continue. Held objects return safely to their last saved position.',
        'Pausing does not reset your errors or receiving counts.',
      ];
      buttons = [
        btn('resume', 'Resume shift', 'primary'),
        btn('invoice', 'Purchase order'),
        btn('back-profile', 'Profile & team'),
      ];
    }
    const fullLines = lines;
    if (xrActive) {
      const pages = textPages(
        feedback && !feedback.correct ? [...lines, 'COACHING: ' + feedback.message] : lines,
      );
      const pageIndex = textPage % pages.length;
      lines = pages[pageIndex];
      if (pages.length > 1) {
        buttons.push(
          btn('detail-prev', 'Previous details', undefined, pageIndex === 0),
          btn(
            'detail-next',
            pageIndex === pages.length - 1
              ? 'First details'
              : `More details ${pageIndex + 1}/${pages.length}`,
          ),
        );
      }
      buttons.push(btn('tablet-near', 'Tablet closer'), btn('exit-vr', 'Exit XR'));
    }

    return {
      phase,
      title,
      eyebrow,
      lines,
      fullLines,
      buttons,
      columns,
      feedback,
      paused: run?.paused,
      busy,
      clock: run
        ? `${fmt(elapsed)} ACTIVE / ${fmt(run.config.targetSeconds)} TARGET${run.paused ? ' · PAUSED' : ''}`
        : `${config.targetSeconds / 60} MINUTE PRACTICE · ${config.variant === 'harder' ? 12 : 10} CARTONS`,
    };
  }, [
    phase,
    lab,
    member,
    accessRole,
    config,
    focusedGuide,
    run,
    selected,
    selectedId,
    placedCount,
    total,
    reason,
    record,
    recordField,
    confirmSubmit,
    allSorted,
    acceptedCount,
    quarantinedCount,
    pending,
    guideKind,
    guideReturn,
    joinName,
    joinCode,
    keyboardPurpose,
    keyboardBuffer,
    historyIndex,
    dueDays,
    xrActive,
    feedback,
    busy,
    elapsed,
    textPage,
  ]);
  const sceneState: SceneState = {
    view: board,
    run,
    selectedId,
    reason,
    interactive: phase === 'active' && run?.status === 'in_progress' && !run.paused,
  };
  if (loading)
    return (
      <div className="receiving-loading">
        <span className="spinner" />
        <h2>Opening your stockroom…</h2>
        <p>Loading the delivery, team and saved practice.</p>
      </div>
    );
  if (loadError)
    return (
      <div className="empty-state">
        <ShieldAlert />
        <h2>Stockroom couldn’t open</h2>
        <p>{loadError}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  return (
    <div className={`receiving-lab ${xrActive ? 'is-immersive' : ''}`}>
      <header className="receiving-heading">
        <div>
          <div className="eyebrow">
            <span className="receiving-new-dot" /> THE HANDS-ON PRACTICE LAB
          </div>
          <h1>
            Good stock in.
            <br />
            <span>Bad surprises out.</span>
          </h1>
          <p>Real receiving decisions. A little more confidence, every shift.</p>
        </div>
        <div className="receiving-header-side">
          <span className="receiving-role-pill">
            <Hand size={16} />
            Hands-first · seated-friendly
          </span>
          <button className="text-link" onClick={() => navigate('overview')}>
            Open operations dashboard <ArrowRight size={14} />
          </button>
        </div>
      </header>
      <div className="receiving-topline">
        <div className="receiving-module">
          <span className="receiving-module-icon">
            <Box size={19} />
          </span>
          <div>
            <strong>Retail Stock Receiving</strong>
            <span>
              {run?.config.variant === 'harder' && phase !== 'profile'
                ? '12-carton harder delivery'
                : '10-carton guided delivery'}{' '}
              · dry, cold & quarantine
            </span>
          </div>
        </div>
        <div className="receiving-xr-actions">
          <button
            className="btn secondary small"
            onClick={() => scene.current?.reset()}
            title="Reset stockroom camera"
          >
            <RotateCcw size={14} />
            Reset view
          </button>
          {xrActive ? (
            <button className="btn primary small" onClick={() => void scene.current?.exit()}>
              <X size={14} />
              Exit {xrMode}
            </button>
          ) : (
            <>
              <button
                className="btn primary small"
                disabled={!xrSupport.vr || !sceneReady || busy}
                onClick={() => void enterXR('immersive-vr')}
              >
                <Headset size={16} />
                Enter hands VR
              </button>
              {xrSupport.ar && (
                <button
                  className="btn secondary small"
                  onClick={() => void enterXR('immersive-ar')}
                  disabled={!sceneReady || busy}
                >
                  Mixed reality
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="receiving-workspace">
        <section className="receiving-floor" aria-label="Interactive receiving stockroom">
          <Suspense
            fallback={
              <div className="receiving-canvas-skeleton">
                <span className="spinner" />
                Setting up the shelves…
              </div>
            }
          >
            <Scene
              ref={scene}
              state={sceneState}
              onAction={onAction}
              onDrop={place}
              onXRChange={xrChanged}
              onReady={setSceneReady}
              onFocusLoss={() => void pause().catch(() => {})}
              onNotice={(message) => setFeedback({ correct: false, message })}
            />
          </Suspense>
          <div className="receiving-floor-status">
            <span>
              <i className={run?.paused ? 'paused' : ''} />
              {run?.status === 'completed'
                ? 'SHIFT COMPLETE'
                : run?.paused
                  ? 'SHIFT PAUSED'
                  : run?.status === 'in_progress'
                    ? 'SHIFT IN PROGRESS'
                    : 'YOUR PRACTICE STOCKROOM'}
            </span>
            <strong>
              <Clock3 size={14} />
              {board.clock}
            </strong>
          </div>
          {run && (
            <div className="receiving-checklist" aria-label="Shift checklist">
              <span className={run.inspected.length === total ? 'done' : ''}>
                <CheckCircle2 size={13} />
                Inspect {run.inspected.length}/{total}
              </span>
              <span className={allSorted ? 'done' : ''}>
                <CheckCircle2 size={13} />
                Sort {placedCount}/{total}
              </span>
              <span className={run.record ? 'done' : ''}>
                <ClipboardCheck size={13} />
                Record counts
              </span>
              <span className={run.status === 'completed' ? 'done' : ''}>
                <CheckCircle2 size={13} />
                {run.status === 'completed' ? 'Report saved' : 'Submit report'}
              </span>
            </div>
          )}
          {run && ['active', 'record', 'guide'].includes(phase) && (
            <div className="receiving-inventory">
              <div className="receiving-inventory-heading">
                <h3>
                  Delivery cartons{' '}
                  <span>
                    {placedCount}/{total} sorted
                  </span>
                </h3>
                <span>Choose a carton to inspect</span>
              </div>
              <div className="receiving-carton-grid">
                {run.manifest.items.map((item) => {
                  const placement = run.placements[item.id];
                  return (
                    <button
                      key={item.id}
                      className={`receiving-carton ${selectedId === item.id ? 'selected' : ''} ${placement ? 'placed' : ''}`}
                      aria-label={`Inspect carton ${item.id} ${item.name}`}
                      aria-pressed={selectedId === item.id}
                      disabled={busy || run.paused || phase !== 'active'}
                      onClick={() => selectCarton(item.id)}
                    >
                      <span>{placement ? <CheckCircle2 size={20} /> : <Box size={20} />}</span>
                      <strong>{item.id}</strong>
                      <small>
                        {placement
                          ? placement.zone === 'quarantine'
                            ? 'Quarantine'
                            : placement.zone === 'cold'
                              ? 'Cold storage'
                              : 'Dry rack'
                          : item.name
                              .replace('Golden Grain ', '')
                              .replace('Atlantic ', '')
                              .replace('SunGold ', '')}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {phase === 'scorecard' && run && (
            <div className="receiving-score-detail">
              <div className="receiving-score-title">
                <span>
                  <CheckCircle2 size={20} />
                  Shift completed & saved
                </span>
                <ScoreBadge score={run.score} />
              </div>
              <div className="receiving-score-metrics">
                <div>
                  <strong>{run.accuracy}%</strong>
                  <span>Decision accuracy</span>
                </div>
                <div>
                  <strong>{fmt(run.elapsedSeconds)}</strong>
                  <span>Active time</span>
                </div>
                <div>
                  <strong>
                    {run.exceptionsCaught}/{run.exceptionsTotal}
                  </strong>
                  <span>Exceptions caught</span>
                </div>
                <div>
                  <strong>{run.firstPassExceptions}</strong>
                  <span>Caught first time</span>
                </div>
              </div>
              <h3>Make your next shift better</h3>
              <ul>
                {run.recommendations.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {run.previous && (
                <p className="receiving-comparison">
                  Previous attempt: {run.previous.score}/100 → <strong>{run.score}/100</strong> ·{' '}
                  {run.previous.accuracy}% → {run.accuracy}% accuracy ·{' '}
                  {fmt(run.previous.elapsedSeconds)} → {fmt(run.elapsedSeconds)} active time
                </p>
              )}
              <p className="receiving-report-saved">
                <ClipboardCheck size={16} />
                Report {run.manifest.deliveryId}: {run.record?.accepted} accepted /{' '}
                {run.record?.quarantined} quarantined / {run.record?.shortfall} short. Saved to the
                shared team workspace.
              </p>
            </div>
          )}
          {!xrSupport.vr && !xrActive && (
            <p className="receiving-device-note">
              <Headset size={15} />
              For hands-only XR, open this site’s direct HTTPS link in a compatible Quest browser
              with hand tracking enabled. Desktop and touch practice work here.
            </p>
          )}
        </section>
        <aside className="receiving-tablet" aria-label="Receiving task tablet">
          <div className="receiving-tablet-top">
            <span>
              <i />
              TASK TABLET
            </span>
            <Hand size={16} />
          </div>
          <div className="receiving-tablet-body">
            <div className="eyebrow">{board.eyebrow}</div>
            <h2>{board.title}</h2>
            <div className="receiving-tablet-lines">
              {(board.fullLines || board.lines).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            {phase === 'record' && !confirmSubmit && !run?.paused && (
              <div className="receiving-record-fields">
                {(['accepted', 'quarantined', 'shortfall'] as const).map((key) => (
                  <label key={key} className={recordField === key ? 'active' : ''}>
                    {key[0].toUpperCase() + key.slice(1)}
                    <input
                      aria-label={`${key[0].toUpperCase() + key.slice(1)} carton count`}
                      type="number"
                      min="0"
                      max="999"
                      inputMode="numeric"
                      value={record[key]}
                      onFocus={() => setRecordField(key)}
                      onChange={(e) =>
                        setRecord((r) => ({
                          ...r,
                          [key]: e.target.value.replace(/\D/g, '').slice(0, 3),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            {phase === 'keyboard' && (
              <label className="receiving-keyboard-input">
                {keyboardPurpose === 'workspace'
                  ? 'Team name'
                  : keyboardPurpose === 'name'
                    ? 'Learner name'
                    : 'Invite code'}
                <input
                  value={keyboardBuffer}
                  maxLength={70}
                  onChange={(e) => setKeyboardBuffer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onAction('keyboard-done');
                  }}
                />
              </label>
            )}
            <div
              className={`receiving-board-buttons columns-${board.columns || 3}`}
              aria-label="Tablet controls"
            >
              {board.buttons
                .filter((b) => !['tablet-near', 'exit-vr'].includes(b.id))
                .map((b) => (
                  <button
                    key={b.id}
                    className={`receiving-board-button ${b.style || ''}`}
                    disabled={b.disabled || busy}
                    onClick={() => onAction(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
            </div>
            {feedback && (
              <div
                className={`receiving-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
                role="status"
              >
                {feedback.correct ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
          <div className="receiving-tablet-footer">
            <ShieldAlert size={13} />
            Shared demo workspace · no private accounts
          </div>
        </aside>
      </div>
      {phase === 'manager' && lab && (
        <section className="receiving-team-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE NEXT SHIFT, TOGETHER</div>
              <h2>Your receiving team</h2>
            </div>
            <span className="pill">
              <Users size={14} />
              {members.length} learners
            </span>
          </div>
          <div className="receiving-team-layout">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Assigned / due</th>
                    <th>Completed</th>
                    <th>Latest score</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const results = lab.runs.filter(
                      (r) => r.memberId === m.id && r.status === 'completed',
                    );
                    const assignments = lab.assignments.filter(
                      (a) => a.memberId === m.id && a.status === 'pending',
                    );
                    return (
                      <tr key={m.id}>
                        <td>
                          <button
                            className="receiving-member-select"
                            onClick={() => setMember(m.id)}
                          >
                            <Avatar name={m.name} color={m.color} />
                            <span>
                              {m.name}
                              <small>{m.role}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          {assignments.length
                            ? assignments.map((a) => (
                                <div key={a.id}>
                                  {a.config.variant} · {a.config.focus}
                                  <small className="muted">{a.dueDate}</small>
                                </div>
                              ))
                            : 'No pending practice'}
                        </td>
                        <td>{results.length}</td>
                        <td>{results[0] ? <ScoreBadge score={results[0].score} /> : '—'}</td>
                        <td>
                          <button
                            className="text-link"
                            disabled={!results[0]}
                            onClick={() => results[0] && void openRun(results[0].id)}
                          >
                            Scorecard <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="receiving-failures">
              <h3>What needs another run?</h3>
              <p>Recurring receiving errors across saved attempts.</p>
              {Object.keys(lab.failures).length ? (
                Object.entries(lab.failures)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <div key={key}>
                      <span>{failureLabels[key] || key}</span>
                      <strong>{count}</strong>
                    </div>
                  ))
              ) : (
                <p className="muted">
                  No errors recorded yet. Completed attempts will surface common failure points
                  here.
                </p>
              )}
              <p className="receiving-remedial-note">
                Select a learner, choose <strong>Remedial focus</strong>, and assign the same
                delivery with exception or recording coaching.
              </p>
            </div>
          </div>
        </section>
      )}
      <footer className="receiving-bottom-note">
        <span>Built for the work in front of you.</span>
        <span>
          Food-retail training dataset · simulated inspection date 8 Nov 2026 · not an ERP or a
          certified assessment
        </span>
      </footer>
    </div>
  );
}
