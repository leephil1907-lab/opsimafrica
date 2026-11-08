import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Copy,
  GripVertical,
  Plus,
  Save,
  Trash2,
  WandSparkles,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { useOps } from '../context';
import { ScenarioIcon, TaskCheck, WarehouseArt } from '../components/ui';
import { PageHeading } from './Dashboard';
import { api, post } from '../lib/api';
import type { Scenario, Task } from '../types';

export default function Builder() {
  const { data, templateId, refresh, toast, navigate } = useOps();
  const [template, setTemplate] = useState(templateId || 'receiving');
  const [draft, setDraft] = useState<Scenario | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasSaved, setHasSaved] = useState(() => Boolean(localStorage.getItem('opssim-draft')));
  useEffect(() => {
    let alive = true;
    api<Scenario>(`/scenarios/${template}?edit=true`)
      .then((s) => {
        if (alive) {
          setDraft({ ...s, title: `My ${s.title.charAt(0).toLowerCase() + s.title.slice(1)}` });
          setOpenStep(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [template]);
  function update<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function updateStep(index: number, patch: Partial<Task>) {
    if (draft)
      update(
        'steps',
        draft.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      );
  }
  if (!draft)
    return (
      <div className="page">
        <PageHeading
          title="Your workflow. Your training."
          description="Loading the scenario builder…"
        />
        {error && <div className="form-error">{error}</div>}
        <div className="loading-skeleton" />
      </div>
    );
  const current = draft;
  return (
    <div className="page builder-page">
      <PageHeading
        eyebrow="BUILT AROUND YOUR BUSINESS"
        title="Your workflow. Your training."
        description="Start with a proven workflow, then make it your own."
      >
        <button
          className="button secondary"
          onClick={() => {
            localStorage.setItem('opssim-draft', JSON.stringify(draft));
            setHasSaved(true);
            toast('Draft saved on this device.');
          }}
        >
          <Save size={15} />
          Save draft
        </button>
        <button className="button primary" type="submit" form="builder-form" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish scenario'}
          <ArrowUpRight size={16} />
        </button>
      </PageHeading>
      {hasSaved && (
        <div className="draft-banner">
          <span>
            <Save size={16} />
            You have a saved draft on this device.
          </span>
          <button
            className="text-button small"
            onClick={() => {
              try {
                const parsed = JSON.parse(localStorage.getItem('opssim-draft') || 'null');
                if (!parsed?.steps?.length) throw new Error('Draft is empty.');
                setDraft(parsed);
                setHasSaved(false);
                toast('Draft restored.');
              } catch (e) {
                toast((e as Error).message, 'error');
              }
            }}
          >
            <RotateCcw size={13} />
            Restore draft
          </button>
        </div>
      )}
      <section className="builder-template-section">
        <div className="section-heading">
          <div>
            <h3>
              <span className="step-label">01</span>Pick your starting point
            </h3>
            <p>You can customise every instruction and scoring answer below.</p>
          </div>
        </div>
        <div className="workflow-grid">
          {data.scenarios
            .filter(
              (s) => !s.custom && !['receiving-lab', 'brightmart-v2'].includes(s.engine || ''),
            )
            .map((s) => (
              <button
                key={s.id}
                className={`workflow-option ${template === s.id ? 'selected' : ''}`}
                onClick={() => {
                  if (
                    template !== s.id &&
                    window.confirm('Switch workflows? Unsaved edits on this page will be replaced.')
                  )
                    setTemplate(s.id);
                }}
              >
                <span className={`workflow-icon ${s.color}`}>
                  <ScenarioIcon icon={s.icon} size={21} />
                </span>
                <strong>{s.title}</strong>
                <small>
                  {s.steps.length} tasks · {s.category}
                </small>
                <span className="workflow-check">{template === s.id && <Check size={12} />}</span>
              </button>
            ))}
        </div>
      </section>
      <form
        id="builder-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await post('/scenarios', current);
            await refresh();
            localStorage.removeItem('opssim-draft');
            toast('Your scenario is published and ready for practice.');
            navigate('library');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="builder-columns">
          <div className="builder-main">
            <section className="panel builder-config">
              <div className="panel-heading">
                <div>
                  <h3>
                    <span className="step-label">02</span>Set the scene
                  </h3>
                  <p>Give your team the context they need to get started.</p>
                </div>
                <WandSparkles size={18} className="muted" />
              </div>
              <div className="form-body">
                <label className="field">
                  Scenario name
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    value={draft.title}
                    onChange={(e) => update('title', e.target.value)}
                  />
                </label>
                <label className="field">
                  Short description
                  <input
                    required
                    maxLength={150}
                    value={draft.subtitle}
                    onChange={(e) => update('subtitle', e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    Industry
                    <select
                      aria-label="Industry"
                      value={draft.industry}
                      onChange={(e) => update('industry', e.target.value)}
                    >
                      {[
                        'Supermarket',
                        'Pharmacy',
                        'Spare-parts dealer',
                        'Restaurant',
                        'Logistics',
                        'Warehouse',
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Difficulty
                    <select
                      aria-label="Difficulty"
                      value={draft.difficulty}
                      onChange={(e) => update('difficulty', e.target.value)}
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </label>
                  <label className="field">
                    Target time (minutes)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      required
                      value={draft.duration}
                      onChange={(e) => update('duration', Number(e.target.value))}
                    />
                  </label>
                  <label className="field">
                    Category
                    <select
                      aria-label="Category"
                      value={draft.category}
                      onChange={(e) => update('category', e.target.value)}
                    >
                      <option>Warehouse</option>
                      <option>Retail</option>
                      <option>Logistics</option>
                      <option>Safety</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  What will they learn?
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={3}
                    value={draft.description}
                    onChange={(e) => update('description', e.target.value)}
                  />
                </label>
                <label className="field">
                  Session briefing
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    value={draft.briefing}
                    onChange={(e) => update('briefing', e.target.value)}
                  />
                  <small>
                    Keep the briefing, reference document, and correct answers consistent.
                  </small>
                </label>
                <div className="field">
                  Reference document
                  <div className="document-editor">
                    {draft.document.map((entry, i) => (
                      <div key={i}>
                        <input
                          aria-label={`Document label ${i + 1}`}
                          maxLength={100}
                          value={entry.label}
                          onChange={(e) =>
                            update(
                              'document',
                              draft.document.map((d, j) =>
                                j === i ? { ...d, label: e.target.value } : d,
                              ),
                            )
                          }
                        />
                        <input
                          aria-label={`Document value ${i + 1}`}
                          maxLength={200}
                          value={entry.value}
                          onChange={(e) =>
                            update(
                              'document',
                              draft.document.map((d, j) =>
                                j === i ? { ...d, value: e.target.value } : d,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <section className="panel objectives-panel">
              <div className="panel-heading">
                <div>
                  <h3>
                    <span className="step-label">03</span>Make the tasks your own
                  </h3>
                  <p>Correct actions advance the session. Mistakes trigger useful feedback.</p>
                </div>
                <span className="count-pill">{draft.steps.length} tasks</span>
              </div>
              <div className="builder-task-list">
                {draft.steps.map((step, i) => (
                  <div key={step.id} className={`builder-task ${openStep === i ? 'expanded' : ''}`}>
                    <button
                      className="builder-task-heading"
                      type="button"
                      onClick={() => setOpenStep(openStep === i ? null : i)}
                    >
                      <GripVertical size={16} className="muted" />
                      <TaskCheck checked={false} index={i} active={openStep === i} />
                      <span>
                        <strong>{step.title}</strong>
                        <small>
                          {step.type === 'number'
                            ? 'Numeric answer'
                            : step.type === 'object'
                              ? '3D object selection'
                              : 'Multiple choice'}
                        </small>
                      </span>
                      {openStep === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {openStep === i && (
                      <div className="builder-task-fields">
                        <label className="field">
                          Task title
                          <input
                            required
                            value={step.title}
                            maxLength={150}
                            onChange={(e) => updateStep(i, { title: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          Instruction
                          <textarea
                            required
                            rows={3}
                            value={step.instruction}
                            maxLength={1000}
                            onChange={(e) => updateStep(i, { instruction: e.target.value })}
                          />
                        </label>
                        {step.options && (
                          <div className="field">
                            Answer options
                            {step.options.map((o, j) => (
                              <input
                                key={o.value}
                                aria-label={`Option ${j + 1}`}
                                value={o.label}
                                maxLength={200}
                                onChange={(e) =>
                                  updateStep(i, {
                                    options: step.options!.map((opt, k) =>
                                      k === j ? { ...opt, label: e.target.value } : opt,
                                    ),
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}
                        <label className="field">
                          Correct answer
                          {step.type === 'number' ? (
                            <input
                              required
                              type="number"
                              value={step.answer ?? ''}
                              onChange={(e) => updateStep(i, { answer: e.target.value })}
                            />
                          ) : (
                            <select
                              value={step.answer}
                              onChange={(e) => updateStep(i, { answer: e.target.value })}
                            >
                              {step.options?.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                        <label className="field">
                          Hint after a mistake
                          <input
                            required
                            maxLength={500}
                            value={step.hint}
                            onChange={(e) => updateStep(i, { hint: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          Feedback after success
                          <input
                            required
                            maxLength={700}
                            value={step.explanation}
                            onChange={(e) => updateStep(i, { explanation: e.target.value })}
                          />
                        </label>
                        {draft.steps.length > 1 && (
                          <button
                            className="text-button danger-text small"
                            type="button"
                            onClick={() => {
                              update(
                                'steps',
                                draft.steps.filter((_, j) => j !== i),
                              );
                              setOpenStep(null);
                            }}
                          >
                            <Trash2 size={14} />
                            Remove this task
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="builder-add-step">
                <button
                  className="button secondary"
                  type="button"
                  disabled={draft.steps.length >= 12}
                  onClick={() => {
                    const id = `task-${Date.now()}`;
                    update('steps', [
                      ...draft.steps,
                      {
                        id,
                        title: 'New decision',
                        instruction: 'Choose the correct action for this situation.',
                        type: 'choice',
                        options: [
                          { value: 'correct', label: 'The correct action' },
                          { value: 'incorrect', label: 'An incorrect action' },
                        ],
                        answer: 'correct',
                        hint: 'Review the briefing and try again.',
                        explanation: 'You made the right choice for this workflow.',
                      },
                    ]);
                    setOpenStep(draft.steps.length);
                  }}
                >
                  <Plus size={14} />
                  Add a decision task
                </button>
                <span>{draft.steps.length}/12 tasks</span>
              </div>
            </section>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <aside className="builder-preview">
            <div className="panel">
              <div className="preview-label">
                <span className="live-dot" />
                SCENARIO PREVIEW
              </div>
              <div className={`preview-art ${draft.color}`}>
                <WarehouseArt variant={draft.scene} />
              </div>
              <div className="preview-body">
                <span className={`difficulty ${draft.difficulty.toLowerCase()}`}>
                  <i />
                  {draft.difficulty}
                </span>
                <h3>{draft.title || 'Your new scenario'}</h3>
                <p>{draft.subtitle}</p>
                <div className="preview-details">
                  <span>{draft.duration} minutes</span>
                  <span>{draft.steps.length} tasks</span>
                  <span>{draft.industry}</span>
                </div>
                <hr />
                <h4>What your team will practise</h4>
                {draft.steps.map((s, i) => (
                  <div className="preview-objective" key={s.id}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </div>
                ))}
              </div>
            </div>
            <div className="scoring-note">
              <CheckCheck size={20} />
              <div>
                <h4>Simple, transparent scoring</h4>
                <p>
                  Start at 100. Each incorrect attempt costs 8 points. Time over the target adds a
                  proportional penalty, capped at 20 points.
                </p>
              </div>
            </div>
            <div className="builder-help">
              <CircleHelp size={17} />
              <p>
                Custom tasks use the selected workflow's 3D room. Changing industry updates the
                scenario context, not the room's physical layout.
              </p>
            </div>
          </aside>
        </div>
        <div className="builder-publish-row">
          <span>
            <Copy size={15} />
            Published scenarios become available to your whole workspace.
          </span>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish scenario'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
