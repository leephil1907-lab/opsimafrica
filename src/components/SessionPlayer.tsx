import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Download,
  Headset,
  Info,
  LoaderCircle,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Target,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import type { ActiveSession } from '../types';
import type { WarehouseHandle } from './WarehouseScene';
import { Avatar, Dialog, Logo, TaskCheck, useScrollLock } from './ui';
import { duration, humanDuration, dateLabel, soundFeedback } from '../lib/utils';
import { post } from '../lib/api';
import { useOps } from '../context';

const Warehouse = lazy(() =>
  import('./WarehouseScene').then((m) => ({ default: m.WarehouseScene })),
);
interface Props {
  session: ActiveSession;
  onUpdate: (session: ActiveSession) => void;
  onClose: () => void;
  onRestart: (session: ActiveSession) => void;
}
interface Feedback {
  correct: boolean;
  message: string;
}
export default function SessionPlayer({ session, onUpdate, onClose, onRestart }: Props) {
  useScrollLock();
  const { data, toast, refresh } = useOps();
  const [current, setCurrent] = useState(session);
  const [pending, setPending] = useState<ActiveSession | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [canVR, setCanVR] = useState(false);
  const [vrActive, setVRActive] = useState(false);
  const [vrBusy, setVRBusy] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [help, setHelp] = useState(false);
  const sceneRef = useRef<WarehouseHandle>(null);
  const busyRef = useRef(false);
  const continueRef = useRef<() => void>(() => {});
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    let mounted = true;
    navigator.xr
      ?.isSessionSupported('immersive-vr')
      .then((value) => {
        if (mounted) setCanVR(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(current.startedAt)) / 1000));
  const task = current.currentTask;
  async function submit(answer: string) {
    if (busyRef.current || feedback || !task || current.status !== 'in_progress') return;
    busyRef.current = true;
    setBusy(true);
    setChosen(answer);
    try {
      const result = await post<{ correct: boolean; message: string; session: ActiveSession }>(
        `/sessions/${current.id}/action`,
        { answer, stepId: task.id },
      );
      setFeedback({ correct: result.correct, message: result.message });
      if (result.correct) setPending(result.session);
      else setCurrent(result.session);
      if (data.settings.sound) soundFeedback(result.correct);
    } catch (e) {
      toast((e as Error).message, 'error');
      busyRef.current = false;
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (pending) {
      setCurrent(pending);
      onUpdate(pending);
      if (pending.status === 'completed') void refresh();
    }
    setPending(null);
    setFeedback(null);
    setInput('');
    setChosen('');
    busyRef.current = false;
  }
  continueRef.current = next;
  useEffect(() => {
    if (feedback && vrActive) {
      const timer = window.setTimeout(() => continueRef.current(), 1800);
      return () => window.clearTimeout(timer);
    }
  }, [feedback, vrActive]);
  if (session.status === 'completed')
    return <Results session={session} onClose={onClose} onRestart={() => onRestart(session)} />;
  if (session.status === 'abandoned')
    return (
      <div className="session-shell">
        <div className="session-ended">
          <h2>This session has ended.</h2>
          <button className="button primary" onClick={() => onRestart(session)}>
            Start a new session
          </button>
          <button className="button secondary" onClick={onClose}>
            Back to workspace
          </button>
        </div>
      </div>
    );
  return (
    <div className="session-shell" role="dialog" aria-modal="true" aria-label="Training session">
      <header className="session-header">
        <div>
          <Logo compact />
          <span className="session-breadcrumb">
            Training floor <span>/</span>
            <strong>{current.scenario.category}</strong>
          </span>
        </div>
        <div>
          <span className="session-save-note">
            <span className="live-dot" />
            Progress is saved
          </span>
          <button
            className="icon-button"
            onClick={() => setHelp(true)}
            aria-label="Training controls"
          >
            <CircleHelp size={19} />
          </button>
          <button className="button secondary" onClick={() => setShowExit(true)}>
            <LogOut size={15} />
            Save & exit
          </button>
        </div>
      </header>
      <div className="session-content">
        <div className="session-title-row">
          <div>
            <div className="eyebrow">LEARNING BY DOING</div>
            <h1>{current.scenario.title}</h1>
            <p>{current.scenario.subtitle}</p>
          </div>
          <div className="session-user">
            <Avatar name={current.memberName} color={current.memberColor} />
            <span>
              <strong>{current.memberName}</strong>
              <small>Learner in this session</small>
            </span>
          </div>
        </div>
        <div className="simulation-grid">
          <div className="simulation-main">
            <div className="scene-toolbar">
              <span>
                <span className="tiny-dot" />
                {vrActive ? 'IMMERSIVE VR' : 'DESKTOP TRAINING'}
              </span>
              <button
                className="button vr-button"
                disabled={vrBusy || !canVR}
                title={
                  !canVR
                    ? 'Open the secure app directly in a compatible headset browser to enable WebXR.'
                    : 'Enter immersive VR'
                }
                onClick={async () => {
                  setVRBusy(true);
                  try {
                    await sceneRef.current?.enterVR();
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  } finally {
                    setVRBusy(false);
                  }
                }}
              >
                <Headset size={16} />
                {vrBusy ? 'Connecting…' : vrActive ? 'In VR' : 'Enter VR'}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <Suspense
              fallback={
                <div className="scene-loading">
                  <LoaderCircle className="spin" size={30} />
                  <p>Opening your stockroom…</p>
                </div>
              }
            >
              <Warehouse
                ref={sceneRef}
                variant={current.scenario.scene}
                task={task}
                reference={current.scenario.document}
                feedback={feedback}
                onSelect={(value) => void submit(value)}
                onVRChange={setVRActive}
                onError={(message) => toast(message, 'error')}
              />
            </Suspense>
            <div className="reference-document">
              <div className="reference-heading">
                <div>
                  <ClipboardList size={17} />
                  <strong>
                    {current.scenario.scene === 'cash'
                      ? 'End-of-day till summary'
                      : 'Your reference document'}
                  </strong>
                </div>
                <span>KEEP THIS HANDY</span>
              </div>
              <div className="reference-values">
                {current.scenario.document.map((d, i) => (
                  <div key={i}>
                    <small>{d.label}</small>
                    <strong>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <button className="briefing-toggle" onClick={() => setShowBrief(!showBrief)}>
              <span>
                <Info size={16} />
                Session briefing
              </span>
              <ChevronDown size={16} className={showBrief ? 'rotate' : ''} />
            </button>
            {showBrief && <div className="briefing-text">{current.scenario.briefing}</div>}
            <div className="session-control-tip">
              <Info size={14} />
              <span>
                {task?.type === 'object'
                  ? 'Click a labelled object in the room, or use the accessible item buttons in the task panel.'
                  : 'Read the reference document, then use the task panel to make your decision.'}{' '}
                Mistakes are part of learning.
              </span>
            </div>
          </div>
          <aside className="simulation-sidebar">
            <div className="session-timer-row">
              <span>
                <Clock3 size={16} />
                <strong>{duration(elapsed)}</strong>
                <small>/ {current.scenario.duration}:00 target</small>
              </span>
              <span className={`error-counter ${(pending || current).errors ? 'has-errors' : ''}`}>
                {(pending || current).errors} error{(pending || current).errors === 1 ? '' : 's'}
              </span>
            </div>
            <div className="task-panel">
              <div className="task-step-meta">
                <span>
                  TASK {String(current.stepIndex + 1).padStart(2, '0')} OF{' '}
                  {String(current.totalSteps).padStart(2, '0')}
                </span>
                <span>
                  {Math.round(((current.stepIndex + (pending ? 1 : 0)) / current.totalSteps) * 100)}
                  % complete
                </span>
              </div>
              <div className="task-progress">
                <i
                  style={{
                    width: `${((current.stepIndex + (pending ? 1 : 0)) / current.totalSteps) * 100}%`,
                  }}
                />
              </div>
              <div className="task-content">
                <span className="task-illustration">
                  <Target size={24} strokeWidth={1.5} />
                </span>
                <h2>{task?.title}</h2>
                <p>{task?.instruction}</p>
                {task?.type === 'number' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!feedback) void submit(input);
                    }}
                  >
                    <label className="numeric-answer">
                      <input
                        aria-label="Your answer"
                        inputMode="decimal"
                        placeholder="Enter quantity"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={Boolean(feedback) || busy}
                        required
                        autoComplete="off"
                      />
                      <span>{task.unit}</span>
                    </label>
                    {!feedback && (
                      <button
                        className="button primary task-submit"
                        disabled={busy || !input.trim()}
                      >
                        {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
                        Check answer
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="task-options">
                    {task?.options?.map((option, i) => (
                      <button
                        key={option.value}
                        className={`task-option ${chosen === option.value ? (feedback?.correct ? 'correct' : feedback ? 'incorrect' : 'selected') : ''}`}
                        disabled={busy || Boolean(feedback)}
                        onClick={() => void submit(option.value)}
                      >
                        <span className="option-letter">
                          {task.type === 'object'
                            ? String(i + 1).padStart(2, '0')
                            : String.fromCharCode(65 + i)}
                        </span>
                        <strong>{option.label}</strong>
                        {chosen === option.value && busy ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <ArrowUpRight size={15} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {feedback && (
                  <div
                    className={`task-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
                    role="status"
                  >
                    <div>
                      {feedback.correct ? <CheckCheck size={19} /> : <Info size={19} />}
                      <strong>
                        {feedback.correct ? "That's the right call." : 'A good moment to learn.'}
                      </strong>
                    </div>
                    <p>{feedback.message}</p>
                    <button
                      className={`button ${feedback.correct ? 'primary' : 'secondary'}`}
                      onClick={next}
                    >
                      {feedback.correct
                        ? pending?.status === 'completed'
                          ? 'See your results'
                          : 'Next task'
                        : 'Try again'}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
                {!feedback && (
                  <p className="task-reassurance">
                    <ShieldCheck size={13} />
                    No real stock. No real risk. Just useful practice.
                  </p>
                )}
              </div>
            </div>
            <div className="session-checklist">
              <h4>YOUR WORKFLOW</h4>
              {current.scenario.steps.map((step, i) => (
                <div key={step.id} className={i === current.stepIndex ? 'current' : ''}>
                  <TaskCheck
                    checked={i < current.stepIndex || (i === current.stepIndex && Boolean(pending))}
                    active={i === current.stepIndex}
                    index={i}
                  />
                  <span>{step.title}</span>
                  {i < current.stepIndex && <Check size={12} />}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      {showExit && (
        <Dialog
          title="Pick up where you left off"
          description="Your training progress is already saved."
          onClose={() => setShowExit(false)}
        >
          <div className="form-body">
            <p className="confirmation-text">
              You can resume this session from Overview or the Training library.{' '}
              <strong>The timer keeps running</strong> while you are away, so an extended break can
              affect your score.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShowExit(false)}>
              Keep practising
            </button>
            <button className="button primary" onClick={onClose}>
              Save & return to workspace <ArrowRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {help && (
        <Dialog
          title="Your stockroom, your pace"
          description="A quick guide to hands-on training."
          onClose={() => setHelp(false)}
        >
          <div className="form-body training-help">
            <h4>On a computer or phone</h4>
            <p>
              Drag the room to look around. Scroll or pinch to zoom. Click a labelled object when
              the task asks you to find an item. Every object task also has accessible buttons.
            </p>
            <h4>In a Quest browser</h4>
            <p>
              Open this app directly over HTTPS. Choose Enter VR and use the floating task board.
              Point and select with a controller, or use supported hand tracking to point and pinch.
              Number tasks have an immersive keypad.
            </p>
            <h4>How scoring works</h4>
            <p>
              You start at 100 points. Each incorrect attempt costs 8 points. Going beyond the
              target time adds up to 20 penalty points. Accuracy is correct attempts divided by all
              attempts. Results are saved automatically.
            </p>
            <p className="hardware-note">
              Real-headset hand-tracking validation is still required. This app is not a safety
              qualification or a substitute for supervised workplace training.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Results({
  session,
  onClose,
  onRestart,
}: {
  session: ActiveSession;
  onClose: () => void;
  onRestart: () => void;
}) {
  const { navigate } = useOps();
  const [review, setReview] = useState(true);
  const pass = (session.score || 0) >= 85;
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpsSim-session-${session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      className="session-shell results-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Session report"
    >
      <header className="session-header">
        <div>
          <Logo />
          <span className="session-breadcrumb">/ Session report</span>
        </div>
        <button className="button secondary" onClick={onClose}>
          <X size={16} />
          Close report
        </button>
      </header>
      <div className="results-content">
        <div className="results-top">
          <span className="results-kicker">
            <CheckCheck size={14} />
            {session.demo ? 'SAMPLE TRAINING REPORT' : 'SESSION COMPLETE · RESULTS SAVED'}
          </span>
          <div className="result-trophy">
            <Trophy size={33} strokeWidth={1.4} />
            <span>✦</span>
          </div>
          <h1>{pass ? 'A stronger shift starts here.' : 'Every attempt is a step forward.'}</h1>
          <p>
            {session.scenarioTitle} · {session.memberName} ·{' '}
            {dateLabel(session.completedAt || session.startedAt)}
          </p>
        </div>
        <div className="results-score-panel">
          <div className="result-main-score">
            <svg viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="57" fill="none" stroke="#e6eddb" strokeWidth="9" />
              <circle
                cx="70"
                cy="70"
                r="57"
                fill="none"
                stroke="#738b52"
                strokeWidth="9"
                strokeDasharray={`${((session.score || 0) / 100) * 358} 358`}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
              />
            </svg>
            <div>
              <strong>
                {session.score}
                <span>/100</span>
              </strong>
              <small>Training score</small>
            </div>
          </div>
          <div className="result-score-message">
            <span className={`status-badge ${pass ? 'ready' : 'practice'}`}>
              {pass ? <ShieldCheck size={13} /> : <RotateCcw size={13} />}{' '}
              {pass ? 'Proficiency target met' : 'Keep building your confidence'}
            </span>
            <h3>
              {pass
                ? 'Bring that confidence to your next shift.'
                : 'You now know what to focus on.'}
            </h3>
            <p>
              {pass
                ? 'You worked through the scenario and made practical decisions. Consistent practice will help these habits stick.'
                : 'Review the feedback below, then try the scenario again. Aim for fewer mistakes before aiming for more speed.'}
            </p>
          </div>
          <div className="result-metrics">
            <div>
              <Target size={17} />
              <span>Task accuracy</span>
              <strong>{session.accuracy}%</strong>
            </div>
            <div>
              <Clock3 size={17} />
              <span>Completion time</span>
              <strong>{humanDuration(session.elapsedSeconds)}</strong>
            </div>
            <div>
              <XCircle size={17} />
              <span>Incorrect attempts</span>
              <strong>{session.errors}</strong>
            </div>
          </div>
        </div>
        <div className="results-comparison-note">
          <Info size={15} />
          <span>
            Target: 85 points · Time target: {session.duration} minutes · 8 points per mistake ·
            Overtime penalty capped at 20 points
          </span>
        </div>
        <div className="panel results-review">
          <button className="results-review-heading" onClick={() => setReview(!review)}>
            <div>
              <ClipboardList size={19} />
              <span>
                <strong>A little reflection goes a long way</strong>
                <small>Your task-by-task feedback</small>
              </span>
            </div>
            <ChevronDown size={18} className={review ? 'rotate' : ''} />
          </button>
          {review && (
            <div className="result-task-rows">
              {session.demo ? (
                <div className="sample-report-note">
                  <Info size={18} />
                  <p>
                    This is a labelled sample session for demonstrating analytics. Detailed attempt
                    logs are available for sessions you complete in this workspace.
                  </p>
                </div>
              ) : (
                session.scenario.steps.map((step, i) => {
                  const attempts = session.actions.filter((a) => a.stepId === step.id);
                  const mistakes = attempts.filter((a) => !a.correct).length;
                  return (
                    <div key={step.id}>
                      <TaskCheck checked index={i} />
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.explanation}</p>
                      </div>
                      <span className={mistakes ? 'attempts-badge retry' : 'attempts-badge'}>
                        {mistakes ? `${attempts.length} attempts` : 'First-time right'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
        <div className="results-bottom-actions">
          <button className="button secondary" onClick={download}>
            <Download size={15} />
            Download session record
          </button>
          <div>
            <button
              className="button secondary"
              onClick={() => {
                onClose();
                navigate('overview');
              }}
            >
              <ArrowLeft size={15} />
              Back to overview
            </button>
            <button className="button primary" onClick={onRestart}>
              <RotateCcw size={15} />
              Practise again <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <div className="result-footer">
          <ShieldCheck size={15} />
          <p>
            Simulation results support coaching; they are not employee certification. Always follow
            your workplace's approved procedures.
          </p>
        </div>
      </div>
    </div>
  );
}
