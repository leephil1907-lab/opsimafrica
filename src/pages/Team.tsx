import { useState } from 'react';
import {
  Plus,
  Search,
  ArrowUpRight,
  Users,
  Award,
  TrendingUp,
  ClipboardCheck,
  UserPlus,
  X,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { useOps } from '../context';
import { Avatar, Dialog, EmptyState, ScoreBadge } from '../components/ui';
import { PageHeading, DateFilter } from './Dashboard';
import { avg, completedIn, dateLabel, humanDuration, relative } from '../lib/utils';
import { api, post } from '../lib/api';
import type { Member } from '../types';

export default function Team() {
  const { data, days, refresh, toast, assign, viewSession } = useOps();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const sessions = completedIn(data.sessions, days);
  const rows = data.members.map((member) => {
    const done = sessions.filter((s) => s.memberId === member.id);
    const score = done.length ? Math.round(avg(done.map((s) => s.score || 0))) : null;
    return {
      ...member,
      count: done.length,
      score,
      last: done[0],
      pending: data.assignments.filter((a) => a.memberId === member.id && a.status === 'pending')
        .length,
    };
  });
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.role}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'practice' && (r.score === null || r.score < 85)) ||
        (filter === 'assigned' && r.pending > 0)),
  );
  return (
    <div className="page team-page">
      <PageHeading
        title="People behind the progress"
        description="Support every learner. Celebrate every step forward."
      >
        <DateFilter />
        <button className="button primary" onClick={() => setAdding(true)}>
          <UserPlus size={16} />
          Add a learner
        </button>
      </PageHeading>
      <div className="team-summary-grid">
        <div className="team-summary-card">
          <span className="summary-icon sage">
            <Users size={22} />
          </span>
          <div>
            <p>People on your team</p>
            <strong>
              {data.members.length}
              <small>learners</small>
            </strong>
          </div>
        </div>
        <div className="team-summary-card">
          <span className="summary-icon sand">
            <Award size={22} />
          </span>
          <div>
            <p>At proficiency target</p>
            <strong>
              {rows.filter((r) => (r.score || 0) >= 85).length}
              <small>average score ≥ 85</small>
            </strong>
          </div>
        </div>
        <div className="team-summary-card">
          <span className="summary-icon lavender">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <p>Training on the horizon</p>
            <strong>
              {data.assignments.filter((a) => a.status === 'pending').length}
              <small>pending assignments</small>
            </strong>
          </div>
        </div>
      </div>
      <div className="panel team-table-panel">
        <div className="team-table-toolbar">
          <div className="inline-tabs">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All learners <span>{rows.length}</span>
            </button>
            <button
              className={filter === 'practice' ? 'active' : ''}
              onClick={() => setFilter('practice')}
            >
              Room to grow
            </button>
            <button
              className={filter === 'assigned' ? 'active' : ''}
              onClick={() => setFilter('assigned')}
            >
              Training assigned
            </button>
          </div>
          <label className="search-input compact">
            <Search size={16} />
            <input
              aria-label="Search learners"
              placeholder="Find a learner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="team-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Sessions</th>
                <th>Average score</th>
                <th>Readiness</th>
                <th>Last practice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="person-cell person-button" onClick={() => setSelected(r)}>
                      <Avatar name={r.name} color={r.color} />
                      <span>
                        <strong>{r.name}</strong>
                        <small>{r.role}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {r.count}
                    <span className="muted table-small"> completed</span>
                  </td>
                  <td>
                    {r.score !== null ? (
                      <div className="table-score">
                        <strong>
                          {r.score}
                          <small>/100</small>
                        </strong>
                        <span className="mini-progress">
                          <i style={{ width: `${r.score}%` }} />
                        </span>
                      </div>
                    ) : (
                      <span className="muted">Not started</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${r.score !== null && r.score >= 85 ? 'ready' : 'practice'}`}
                    >
                      {r.score !== null && r.score >= 85 ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <TrendingUp size={12} />
                      )}{' '}
                      {r.score === null
                        ? 'Ready to begin'
                        : r.score >= 85
                          ? 'Floor-ready'
                          : 'Keep practising'}
                    </span>
                  </td>
                  <td className="muted">{r.last ? relative(r.last.completedAt!) : '—'}</td>
                  <td>
                    <button className="text-button small" onClick={() => assign(r.id)}>
                      Assign <Plus size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <EmptyState
              title="No learners found"
              text="Try another name or choose a different group."
            />
          )}
        </div>
        <div className="table-footer">
          <span>
            {filtered.length} of {data.members.length} learners
          </span>
          <span>Proficiency is based on average session score in this period.</span>
        </div>
      </div>
      <div className="team-tip">
        <span className="tip-icon">
          <TrendingUp size={21} />
        </span>
        <div>
          <h3>Build a practice habit, not a training backlog.</h3>
          <p>
            One five-minute session a week is an easy place to start. Pair newer staff with
            experienced team members and review mistakes together.
          </p>
        </div>
        <button className="text-button" onClick={() => assign()}>
          Assign a session <ArrowUpRight size={16} />
        </button>
      </div>
      {adding && <AddMember onClose={() => setAdding(false)} />}
      {selected && (
        <Dialog
          title="Learner profile"
          description="A closer look at one person's progress."
          onClose={() => setSelected(null)}
          wide
        >
          <div className="learner-profile-heading">
            <Avatar name={selected.name} color={selected.color} size="large" />
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.role}</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                assign(selected.id);
                setSelected(null);
              }}
            >
              Assign training <Plus size={15} />
            </button>
          </div>
          <div className="profile-stats">
            <div>
              <span>Sessions completed</span>
              <strong>{sessions.filter((s) => s.memberId === selected.id).length}</strong>
            </div>
            <div>
              <span>Average score</span>
              <strong>
                {Math.round(
                  avg(sessions.filter((s) => s.memberId === selected.id).map((s) => s.score || 0)),
                )}
                <small> /100</small>
              </strong>
            </div>
            <div>
              <span>Avg. training time</span>
              <strong>
                {humanDuration(
                  avg(
                    sessions.filter((s) => s.memberId === selected.id).map((s) => s.elapsedSeconds),
                  ),
                )}
              </strong>
            </div>
          </div>
          <h4 className="modal-subheading">Assigned training</h4>
          <div className="profile-assignments">
            {data.assignments
              .filter((a) => a.memberId === selected.id && a.status === 'pending')
              .map((a) => (
                <div key={a.id}>
                  <span>
                    <ClipboardCheck size={16} />
                    {data.scenarios.find((s) => s.id === a.scenarioId)?.title}
                  </span>
                  <small>
                    <CalendarDays size={12} />
                    {dateLabel(a.dueDate, true)}
                  </small>
                  <button
                    className="icon-button"
                    aria-label="Remove assignment"
                    onClick={async () => {
                      try {
                        await api(`/assignments/${a.id}`, { method: 'DELETE' });
                        await refresh();
                        toast('Assignment removed.');
                      } catch (e) {
                        toast((e as Error).message, 'error');
                      }
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            {!data.assignments.some(
              (a) => a.memberId === selected.id && a.status === 'pending',
            ) && <p className="muted">No pending training. This learner is all caught up.</p>}
          </div>
          <h4 className="modal-subheading">Recent sessions</h4>
          <div className="profile-history">
            {sessions
              .filter((s) => s.memberId === selected.id)
              .slice(0, 5)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelected(null);
                    viewSession(s.id);
                  }}
                >
                  <span>
                    <strong>{s.scenarioTitle}</strong>
                    <small>
                      {dateLabel(s.completedAt!)} {s.demo ? '· Sample' : ''}
                    </small>
                  </span>
                  <ScoreBadge score={s.score} />
                  <ArrowUpRight size={15} />
                </button>
              ))}
            {!sessions.some((s) => s.memberId === selected.id) && (
              <p className="muted">No completed sessions in this date range.</p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
function AddMember({ onClose }: { onClose: () => void }) {
  const { refresh, toast } = useOps();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="Make room for a new learner"
      description="Add a teammate and start building their confidence."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await post('/members', { name, role });
            await refresh();
            toast(`${name.split(' ')[0]} is ready to start learning.`);
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
            Full name
            <input
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Kemi Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Role
            <input
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Warehouse associate"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <p className="form-note">
            Learners are profiles in this shared workspace, not separate login accounts.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <UserPlus size={15} />
            {busy ? 'Adding…' : 'Add learner'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
