import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Target,
  ShieldCheck,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { useOps } from '../context';
import { Avatar, EmptyState, SampleNote, ScoreBadge } from '../components/ui';
import { PageHeading, DateFilter } from './Dashboard';
import { compare, completedIn, dateLabel, duration, humanDuration } from '../lib/utils';
import type { Session } from '../types';

function download(sessions: Session[]) {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return `"${/^[=+@\-\t\r]/.test(s) ? "'" : ''}${s.replace(/"/g, '""')}"`;
  };
  const rows = [
    [
      'Learner',
      'Scenario',
      'Completed',
      'Score',
      'Accuracy (%)',
      'Errors',
      'Time (seconds)',
      'Sample data',
    ],
    ...sessions.map((s) => [
      s.memberName,
      s.scenarioTitle,
      s.completedAt,
      s.score,
      s.accuracy,
      s.errors,
      s.elapsedSeconds,
      s.demo ? 'Yes' : 'No',
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((r) => r.map(escape).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `OpsSim-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { data, days, viewSession, navigate } = useOps();
  const [search, setSearch] = useState('');
  const [scenario, setScenario] = useState('all');
  const [member, setMember] = useState('all');
  const [includeSample, setIncludeSample] = useState(true);
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      completedIn(data.sessions, days).filter(
        (s) =>
          (includeSample || !s.demo) &&
          (scenario === 'all' || s.scenarioId === scenario) &&
          (member === 'all' || s.memberId === member) &&
          `${s.memberName} ${s.scenarioTitle}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [data.sessions, days, search, scenario, member, includeSample],
  );
  const { before, after } = compare(filtered);
  const valid = before.count > 0 && after.count > 0;
  const maxPage = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, maxPage);
  return (
    <div className="page reports-page">
      <PageHeading
        title="From practice to progress"
        description="The numbers behind better shifts, fewer errors, and growing confidence."
      >
        <DateFilter />
        <button className="button primary" onClick={() => download(filtered)}>
          <Download size={15} />
          Export CSV
        </button>
      </PageHeading>
      <div className="report-explainer">
        <span>
          <RotateCcw size={16} />
          BEFORE → AFTER
        </span>
        <p>
          Compare the first half of the selected sessions with the second half. Same workspace,
          measurable progress.
        </p>
        <SampleNote sessions={filtered} />
      </div>
      <div className="comparison-grid">
        <Comparison
          title="Average completion time"
          icon={<Clock3 size={19} />}
          before={before.count ? humanDuration(before.time) : '—'}
          after={after.count ? humanDuration(after.time) : '—'}
          detail={
            valid && before.time
              ? `${Math.abs(Math.round(((before.time - after.time) / before.time) * 100))}% ${after.time <= before.time ? 'faster' : 'slower'}`
              : 'Complete at least two sessions'
          }
          good={valid && after.time <= before.time}
        />
        <Comparison
          title="Task accuracy"
          icon={<Target size={19} />}
          before={before.count ? `${before.accuracy}%` : '—'}
          after={after.count ? `${after.accuracy}%` : '—'}
          detail={
            valid
              ? `${Math.abs(after.accuracy - before.accuracy)} percentage points ${after.accuracy >= before.accuracy ? 'higher' : 'lower'}`
              : 'Correct attempts ÷ all attempts'
          }
          good={valid && after.accuracy >= before.accuracy}
        />
        <Comparison
          title="Errors per session"
          icon={<ShieldCheck size={19} />}
          before={before.count ? before.errors.toFixed(1) : '—'}
          after={after.count ? after.errors.toFixed(1) : '—'}
          detail={
            valid
              ? `${Math.abs(before.errors - after.errors).toFixed(1)} ${after.errors <= before.errors ? 'fewer' : 'more'} errors per session`
              : 'Incorrect attempts in each session'
          }
          good={valid && after.errors <= before.errors}
        />
      </div>
      <section className="panel reports-table-panel">
        <div className="panel-heading">
          <div>
            <h3>The training log</h3>
            <p>Every completed session, with the details that matter</p>
          </div>
          <FileSpreadsheet size={19} className="muted" />
        </div>
        <div className="reports-filters">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search reports"
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter by scenario"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All scenarios</option>
            {data.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by learner"
            value={member}
            onChange={(e) => {
              setMember(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All learners</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeSample}
              onChange={(e) => {
                setIncludeSample(e.target.checked);
                setPage(1);
              }}
            />
            Include samples
          </label>
        </div>
        <div className="table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Scenario</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Time</th>
                <th>Completed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 8, current * 8).map((s) => (
                <tr
                  key={s.id}
                  className="clickable-row"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && viewSession(s.id)}
                  onClick={() => viewSession(s.id)}
                >
                  <td>
                    <div className="person-cell">
                      <Avatar name={s.memberName} color={s.memberColor} />
                      <span>
                        <strong>{s.memberName}</strong>
                        {s.demo ? (
                          <small className="sample-tag">SAMPLE SESSION</small>
                        ) : (
                          <small className="live-label">WORKSPACE SESSION</small>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>{s.scenarioTitle}</td>
                  <td>
                    <ScoreBadge score={s.score} />
                  </td>
                  <td>{s.accuracy}%</td>
                  <td className="nowrap">{duration(s.elapsedSeconds)}</td>
                  <td className="muted nowrap">{dateLabel(s.completedAt!, true)}</td>
                  <td>
                    <ArrowUpRight size={15} className="muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <EmptyState
              title="No sessions in this view"
              text="Try a different date range, include samples, or complete a training session."
              action={
                <button className="button secondary" onClick={() => navigate('library')}>
                  Find a scenario <ArrowRight size={15} />
                </button>
              }
            />
          )}
        </div>
        <div className="table-footer">
          <span>
            {filtered.length
              ? `Showing ${(current - 1) * 8 + 1}–${Math.min(current * 8, filtered.length)} of ${filtered.length} sessions`
              : '0 sessions'}
          </span>
          <div className="pagination">
            <button
              aria-label="Previous report page"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {current} of {maxPage}
            </span>
            <button
              aria-label="Next report page"
              disabled={current >= maxPage}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <div className="reports-disclaimer">
        <ShieldCheck size={17} />
        <p>
          These are simulated training outcomes, not a measure of real-world inventory accuracy or
          employee certification. Sample sessions are labelled and can be excluded above or removed
          in Settings.
        </p>
      </div>
    </div>
  );
}
function Comparison({
  title,
  icon,
  before,
  after,
  detail,
  good,
}: {
  title: string;
  icon: React.ReactNode;
  before: string;
  after: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="comparison-card">
      <div className="comparison-heading">
        <span>{title}</span>
        {icon}
      </div>
      <div className="comparison-values">
        <div>
          <small>BEFORE</small>
          <strong>{before}</strong>
        </div>
        <ArrowRight size={19} />
        <div>
          <small>AFTER</small>
          <strong>{after}</strong>
        </div>
      </div>
      <span className={`comparison-detail ${good ? 'positive' : ''}`}>
        {good ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />} {detail}
      </span>
    </div>
  );
}
