import { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  CheckCheck,
  Headset,
  Clock3,
  X,
  LayoutGrid,
  List,
  ArrowRight,
  Play,
} from 'lucide-react';
import { useOps } from '../context';
import { EmptyState, ScenarioCard, ScenarioIcon } from '../components/ui';
import { PageHeading } from './Dashboard';

export default function Library() {
  const { data, navigate, openScenario, assign, viewSession } = useOps();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All scenarios');
  const [difficulty, setDifficulty] = useState('All levels');
  const [view, setView] = useState('grid');
  const filtered = useMemo(
    () =>
      data.scenarios.filter(
        (s) =>
          (category === 'All scenarios' || s.category === category) &&
          (difficulty === 'All levels' || s.difficulty === difficulty) &&
          `${s.title} ${s.description} ${s.industry} ${s.skills.join(' ')}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data.scenarios, search, category, difficulty],
  );
  const categories = ['All scenarios', 'Warehouse', 'Retail', 'Logistics', 'Safety'];
  const resume = data.sessions.find((s) => s.status === 'in_progress' && !s.demo);
  return (
    <div className="page library-page">
      <PageHeading
        eyebrow="A LITTLE PRACTICE GOES A LONG WAY"
        title="The training floor"
        description="Real-world challenges. A safe place to get them right."
      >
        <button className="button primary" onClick={() => navigate('builder')}>
          <Plus size={16} />
          Create a scenario
        </button>
      </PageHeading>
      <div className="library-intro">
        <div className="intro-icon">
          <Headset size={27} strokeWidth={1.4} />
        </div>
        <div>
          <h3>Learn by doing, not just watching.</h3>
          <p>
            Step into a stockroom, work through the task, and get feedback you can use on your very
            next shift.
          </p>
        </div>
        <div className="intro-features">
          <span>
            <Clock3 size={14} />
            Bite-sized sessions
          </span>
          <span>
            <CheckCheck size={14} />
            Instant, useful feedback
          </span>
        </div>
      </div>
      {resume && (
        <button className="resume-banner" onClick={() => viewSession(resume.id)}>
          <Play size={17} />
          <span>
            Continue <strong>{resume.scenarioTitle}</strong> · Task {resume.stepIndex + 1} of{' '}
            {resume.totalSteps}
          </span>
          <ArrowRight size={17} />
        </button>
      )}
      <div className="library-toolbar">
        <div className="category-tabs">
          {categories.map((c) => (
            <button
              key={c}
              className={c === category ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
              <span>
                {c === 'All scenarios'
                  ? data.scenarios.length
                  : data.scenarios.filter((s) => s.category === c).length}
              </span>
            </button>
          ))}
        </div>
        <div className="view-switch">
          <button
            aria-label="Grid view"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            aria-label="List view"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      <div className="filter-row">
        <label className="search-input">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a skill, scenario, or industry…"
            aria-label="Search scenarios"
          />
          {search && (
            <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={15} />
            </button>
          )}
        </label>
        <label className="select-filter">
          <SlidersHorizontal size={15} />
          <select
            aria-label="Filter difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option>All levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
        <span className="result-count">
          {filtered.length} scenario{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      {filtered.length ? (
        <div className={`scenario-grid ${view === 'grid' ? 'three library-cards' : 'list-view'}`}>
          {filtered.map((s) =>
            view === 'grid' ? (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onOpen={() => openScenario(s)}
                count={
                  data.sessions.filter((r) => r.scenarioId === s.id && r.status === 'completed')
                    .length
                }
              />
            ) : (
              <button className="scenario-list-card" key={s.id} onClick={() => openScenario(s)}>
                <span className={`scenario-list-icon ${s.color}`}>
                  <ScenarioIcon icon={s.icon} size={25} />
                </span>
                <div>
                  <span className="eyebrow">
                    {s.category} {s.custom ? '· CUSTOM' : ''}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.subtitle}</p>
                </div>
                <span className={`difficulty ${s.difficulty.toLowerCase()}`}>
                  <i />
                  {s.difficulty}
                </span>
                <span className="muted">
                  {s.duration} min · {s.steps.length} tasks
                </span>
                <ArrowUpRight size={20} />
              </button>
            ),
          )}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="No matching scenarios"
            text="Try another skill or reset your filters to explore all training."
            action={
              <button
                className="button secondary"
                onClick={() => {
                  setSearch('');
                  setCategory('All scenarios');
                  setDifficulty('All levels');
                }}
              >
                Reset filters
              </button>
            }
          />
        </div>
      )}
      <div className="library-bottom-cta">
        <div className="team-illustration">
          <span>AO</span>
          <span>CE</span>
          <span>AY</span>
        </div>
        <div>
          <h3>Good teams don't happen by accident.</h3>
          <p>Assign a short session, then see the difference on the floor.</p>
        </div>
        <button className="button secondary" onClick={() => assign()}>
          Assign training <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="library-device-note">
        <Headset size={16} />
        <p>
          Every scenario works on desktop and mobile. For immersive training, open the secure app in
          a compatible Quest browser. Hand tracking depends on headset support.
        </p>
      </div>
    </div>
  );
}
