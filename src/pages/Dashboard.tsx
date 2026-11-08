import {
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  ChartNoAxesCombined,
  Clock3,
  Users,
  TrendingUp,
  Headset,
  MoveRight,
  Play,
  Target,
  CircleCheck,
  Timer,
  Download,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import { useOps } from '../context';
import {
  Avatar,
  ScenarioCard,
  ScoreBadge,
  SampleNote,
  WarehouseArt,
  EmptyState,
} from '../components/ui';
import { TrendChart } from '../components/Charts';
import { compare, completedIn, dateLabel, humanDuration, metrics, relative } from '../lib/utils';
import { exportReport } from '../lib/api';
import type { ReactNode } from 'react';

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function DateFilter() {
  const { days, setDays } = useOps();
  return (
    <label className="date-filter">
      <CalendarDays size={15} />
      <select
        aria-label="Date range"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </select>
      <ChevronDown size={13} />
    </label>
  );
}

export default function Dashboard() {
  const { data, days, navigate, openScenario, viewSession } = useOps();
  const sessions = completedIn(data.sessions, days);
  const m = metrics(sessions);
  const { before, after } = compare(sessions);
  const hasCompare = before.count > 0 && after.count > 0;
  const activeLearners = new Set(sessions.map((s) => s.memberId)).size;
  const mastered = sessions.filter((s) => (s.score || 0) >= 85).length;
  const readyPercent = sessions.length ? Math.round((mastered / sessions.length) * 100) : 0;
  const improvement = hasCompare ? after.score - before.score : 0;
  const timeImprovement =
    hasCompare && before.time ? Math.round(((before.time - after.time) / before.time) * 100) : 0;
  const resume = data.sessions.find((s) => s.status === 'in_progress' && !s.demo);
  return (
    <div className="page dashboard-page">
      <PageHeading
        title="Operations overview"
        description={`Welcome back, ${data.settings.managerName.split(' ')[0]}. Let's make every shift a little better.`}
      >
        <DateFilter />
        <button className="button secondary" onClick={() => exportReport(days)}>
          <Download size={15} />
          Export report
        </button>
      </PageHeading>
      {resume && (
        <button className="resume-banner" onClick={() => viewSession(resume.id)}>
          <span className="resume-icon">
            <Play size={16} />
          </span>
          <span>
            <strong>Your stockroom is right where you left it.</strong> Resume{' '}
            {resume.scenarioTitle} · Task {resume.stepIndex + 1} of {resume.totalSteps}
          </span>
          <ArrowRight size={18} />
        </button>
      )}
      <section className="welcome-banner">
        <div className="banner-content">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            TRAIN FOR THE EVERYDAY
          </div>
          <h2>
            Real practice.
            <br />
            Real-world confidence.
          </h2>
          <p>
            A safe space to learn. A stronger team on the floor.
            <br className="desktop-br" /> Turn everyday operations into skills that stick.
          </p>
          <div className="banner-actions">
            <button className="button lime" onClick={() => openScenario(data.scenarios[0])}>
              Start a training session <ArrowUpRight size={17} />
            </button>
            <button className="banner-text-link" onClick={() => navigate('library')}>
              Explore the library <ArrowRight size={15} />
            </button>
          </div>
          <div className="banner-footnote">
            <span>
              <CheckCheck size={13} />
              Made for real workflows
            </span>
            <span className="banner-divider" />
            <span>No headset? No problem.</span>
          </div>
        </div>
        <div className="banner-art">
          <WarehouseArt hero />
          <span className="quest-pill">
            <Headset size={15} />
            Desktop & Quest WebXR
          </span>
          <span className="art-small-label">YOUR WORKPLACE. REIMAGINED.</span>
        </div>
      </section>
      <div className="section-kicker">
        <span>
          <span className="tiny-dot" />
          THE BIG PICTURE
        </span>
        <SampleNote sessions={sessions} />
      </div>
      <section className="stats-grid" aria-label="Workspace statistics">
        <Stat
          icon={<CheckCheck size={19} />}
          label="Sessions completed"
          value={String(m.count)}
          change={
            sessions.length
              ? `${new Set(sessions.map((s) => s.scenarioId)).size} scenarios in practice`
              : 'Start your first session'
          }
          suffix="this period"
        />
        <Stat
          icon={<ChartNoAxesCombined size={19} />}
          label="Average training score"
          value={`${m.score}`}
          unit="/ 100"
          change={
            hasCompare
              ? `${improvement >= 0 ? '+' : ''}${improvement} pts from first half`
              : 'No comparison yet'
          }
          positive={improvement >= 0}
          suffix="team average"
        />
        <Stat
          icon={<Clock3 size={19} />}
          label="Avg. completion time"
          value={m.count ? humanDuration(m.time) : '—'}
          change={
            hasCompare
              ? `${Math.abs(timeImprovement)}% ${timeImprovement >= 0 ? 'faster' : 'slower'} than first half`
              : 'Time improves with practice'
          }
          positive={timeImprovement >= 0}
          suffix="per session"
        />
        <Stat
          icon={<Users size={19} />}
          label="Active learners"
          value={String(activeLearners)}
          unit={`/ ${data.members.length}`}
          change={`${data.members.length ? Math.round((activeLearners / data.members.length) * 100) : 0}% team participation`}
          suffix="people learning"
        />
      </section>
      <section className="insights-grid">
        <div className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h3>
                Practice makes progress <span className="subtle-dot" />
              </h3>
              <p>Your team's average training score over time</p>
            </div>
            <div className="chart-legend">
              <i />
              Training score
            </div>
          </div>
          {sessions.length ? (
            <TrendChart sessions={sessions} days={days} />
          ) : (
            <EmptyState
              title="Your progress starts here"
              text="Complete a training session to see your team's results."
            />
          )}
          <div className="chart-footer">
            <span>
              <span className="target-dash" />
              Proficiency target: 85%
            </span>
            <span>
              <TrendingUp size={13} />
              {hasCompare
                ? `${Math.abs(improvement)}-point ${improvement >= 0 ? 'improvement' : 'change'} over this period`
                : 'Every practice counts'}
            </span>
          </div>
        </div>
        <div className="panel readiness-panel">
          <div className="panel-heading">
            <div>
              <h3>Ready for the real world</h3>
              <p>Sessions meeting the 85-point target</p>
            </div>
            <Target size={18} className="muted" />
          </div>
          <div className="readiness-body">
            <div className="readiness-ring">
              <svg viewBox="0 0 130 130">
                <circle cx="65" cy="65" r="53" fill="none" stroke="#edf0e6" strokeWidth="11" />
                <circle
                  cx="65"
                  cy="65"
                  r="53"
                  fill="none"
                  stroke="#8da66a"
                  strokeWidth="11"
                  strokeDasharray={`${(readyPercent / 100) * 333} 333`}
                  strokeLinecap="round"
                  transform="rotate(-90 65 65)"
                />
              </svg>
              <div>
                <strong>
                  {readyPercent}
                  <span>%</span>
                </strong>
                <small>proficient</small>
              </div>
            </div>
            <div className="readiness-legend">
              <p>
                <i className="green-dot" />
                <strong>{mastered}</strong>Target met
              </p>
              <p>
                <i className="pale-dot" />
                <strong>{sessions.length - mastered}</strong>Room to grow
              </p>
              <span className="readiness-caption">A little more practice goes a long way.</span>
            </div>
          </div>
          <button className="panel-text-button" onClick={() => navigate('team')}>
            See your team's performance <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
      <section className="recommended-section">
        <div className="section-heading">
          <div>
            <h2>Small sessions. Lasting skills.</h2>
            <p>Practical scenarios for your team's everyday challenges.</p>
          </div>
          <button className="text-button" onClick={() => navigate('library')}>
            View all scenarios <ArrowRight size={15} />
          </button>
        </div>
        <div className="scenario-grid three">
          {data.scenarios.slice(0, 3).map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onOpen={() => openScenario(s)}
              count={sessions.filter((r) => r.scenarioId === s.id).length}
            />
          ))}
        </div>
      </section>
      <section className="bottom-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h3>Fresh from the training floor</h3>
              <p>The latest wins, lessons, and progress</p>
            </div>
            <button className="text-button small" onClick={() => navigate('reports')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Scenario</th>
                  <th>Score</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 4).map((s) => (
                  <tr
                    key={s.id}
                    className="clickable-row"
                    onClick={() => viewSession(s.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && viewSession(s.id)}
                  >
                    <td>
                      <div className="person-cell">
                        <Avatar name={s.memberName} color={s.memberColor} />
                        <strong>{s.memberName}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="table-scenario">{s.scenarioTitle}</span>
                      {s.demo && <small className="sample-tag">SAMPLE</small>}
                    </td>
                    <td>
                      <ScoreBadge score={s.score} />
                    </td>
                    <td className="muted nowrap">{relative(s.completedAt!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sessions.length && (
              <EmptyState
                title="No sessions yet"
                text="Your team's completed training will appear here."
              />
            )}
          </div>
        </div>
        <div className="panel up-next-panel">
          <div className="panel-heading">
            <div>
              <h3>A little nudge to keep growing</h3>
              <p>Upcoming training assignments</p>
            </div>
            <Timer size={18} className="muted" />
          </div>
          <div className="assignment-list">
            {data.assignments
              .filter((a) => a.status === 'pending')
              .slice(0, 3)
              .map((a) => {
                const member = data.members.find((m) => m.id === a.memberId);
                const s = data.scenarios.find((s) => s.id === a.scenarioId);
                return member && s ? (
                  <button
                    key={a.id}
                    className="assignment-row"
                    onClick={() => openScenario(s, member.id)}
                  >
                    <Avatar name={member.name} color={member.color} />
                    <span>
                      <strong>
                        {member.name.split(' ')[0]} · {s.title}
                      </strong>
                      <small>Due {dateLabel(a.dueDate, true)}</small>
                    </span>
                    <MoveRight size={15} />
                  </button>
                ) : null;
              })}
            {!data.assignments.some((a) => a.status === 'pending') && (
              <div className="queue-empty">
                <CircleCheck size={22} />
                <p>All caught up. A great time for some extra practice.</p>
              </div>
            )}
          </div>
          <div className="assignment-footer">
            <span className="tiny-dot" />
            Learning is a habit, not a one-off.
          </div>
        </div>
      </section>
      <div className="page-footer">
        <span>Made for the way your team works.</span>
        <span>
          <span className="live-dot" />
          All changes saved to your workspace
        </span>
      </div>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  unit,
  change,
  positive = true,
  suffix,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  change: string;
  positive?: boolean;
  suffix: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="stat-bottom">
        <span className={`stat-change ${positive ? '' : 'neutral'}`}>
          {positive ? <TrendingUp size={12} /> : <Clock3 size={12} />} {change}
        </span>
      </div>
      <span className="stat-context">{suffix}</span>
    </div>
  );
}
