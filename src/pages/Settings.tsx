import { useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Download,
  Headphones,
  Save,
  ShieldCheck,
  Trash2,
  Volume2,
  Waves,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { useOps } from '../context';
import { PageHeading } from './Dashboard';
import { api, exportReport, put } from '../lib/api';
import { Dialog } from '../components/ui';

export default function Settings() {
  const { data, refresh, toast } = useOps();
  const [values, setValues] = useState(data.settings);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const sampleCount = data.sessions.filter((s) => s.demo).length;
  return (
    <div className="page settings-page">
      <PageHeading
        title="A workspace that works for you"
        description="Keep your team's training simple, comfortable, and organised."
      />
      <div className="settings-layout">
        <div className="settings-aside">
          <a href="#workspace" className="active">
            <Building2 size={17} />
            Workspace
          </a>
          <a href="#preferences">
            <Volume2 size={17} />
            Training preferences
          </a>
          <a href="#data">
            <Database size={17} />
            Workspace data
          </a>
          <a href="#compatibility">
            <Headphones size={17} />
            Devices & compatibility
          </a>
        </div>
        <div className="settings-main">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await put('/settings', values);
                await refresh();
                toast('Workspace settings saved.');
              } catch (e) {
                toast((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            <section id="workspace" className="panel settings-panel">
              <div className="panel-heading">
                <div>
                  <h3>Make yourself at home</h3>
                  <p>The details your team sees in this workspace.</p>
                </div>
                <Building2 size={19} className="muted" />
              </div>
              <div className="form-body">
                <label className="field">
                  Workspace name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={values.workspaceName}
                    onChange={(e) => setValues({ ...values, workspaceName: e.target.value })}
                  />
                </label>
                <label className="field">
                  Manager display name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={values.managerName}
                    onChange={(e) => setValues({ ...values, managerName: e.target.value })}
                  />
                  <small>This changes the workspace greeting and profile, not learner names.</small>
                </label>
              </div>
            </section>
            <section id="preferences" className="panel settings-panel">
              <div className="panel-heading">
                <div>
                  <h3>A comfortable way to learn</h3>
                  <p>Small adjustments to suit your training environment.</p>
                </div>
                <Waves size={19} className="muted" />
              </div>
              <div className="settings-toggle-row">
                <span className="toggle-icon">
                  <Volume2 size={20} />
                </span>
                <div>
                  <strong>Audio feedback</strong>
                  <p>Play a short tone after correct and incorrect actions.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={values.sound}
                  aria-label="Audio feedback"
                  className={`switch ${values.sound ? 'on' : ''}`}
                  onClick={() => setValues({ ...values, sound: !values.sound })}
                >
                  <span />
                </button>
              </div>
              <div className="settings-toggle-row">
                <span className="toggle-icon">
                  <Waves size={20} />
                </span>
                <div>
                  <strong>Reduced motion</strong>
                  <p>Reduce decorative motion and UI transitions.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={values.reduceMotion}
                  aria-label="Reduced motion"
                  className={`switch ${values.reduceMotion ? 'on' : ''}`}
                  onClick={() => setValues({ ...values, reduceMotion: !values.reduceMotion })}
                >
                  <span />
                </button>
              </div>
              <div className="settings-save">
                <span>Applied when you save your changes.</span>
                <button className="button primary" disabled={busy}>
                  <Save size={15} />
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </section>
          </form>
          <section id="data" className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h3>Your training, kept together</h3>
                <p>Sessions and settings are stored in this project's SQLite database.</p>
              </div>
              <Database size={19} className="muted" />
            </div>
            <div className="settings-data-row">
              <div>
                <strong>Download your training history</strong>
                <p>Export all completed sessions, including labelled samples, as a CSV.</p>
              </div>
              <button className="button secondary" onClick={() => exportReport(3650)}>
                <Download size={15} />
                Export all
              </button>
            </div>
            <div className="settings-data-row">
              <div>
                <strong>Start fresh without the samples</strong>
                <p>
                  {sampleCount
                    ? `${sampleCount} sample sessions help illustrate the dashboard. Your real sessions will not be removed.`
                    : 'No sample sessions remain. Your workspace contains only real training activity.'}
                </p>
              </div>
              <button
                disabled={!sampleCount}
                className="button danger"
                onClick={() => setConfirm(true)}
              >
                <Trash2 size={15} />
                Remove samples
              </button>
            </div>
            <div className="privacy-notice">
              <ShieldCheck size={19} />
              <p>
                <strong>Single-workspace edition.</strong> This build does not include
                authentication or role-based access. Anyone with the app URL can access and change
                its data. Use fictional learner names for a public demo. Add sign-in, authorisation,
                backups, and a privacy policy before deploying with staff data.
              </p>
            </div>
          </section>
          <section id="compatibility" className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h3>One training floor. More ways to enter.</h3>
                <p>Start with the device you already have.</p>
              </div>
              <Headphones size={19} className="muted" />
            </div>
            <div className="compatibility-row">
              <span className="compatibility-check">
                <Check size={17} />
              </span>
              <div>
                <strong>Desktop & mobile</strong>
                <p>
                  Modern browsers support the full training workflow with mouse or touch. If WebGL
                  is unavailable, every task remains accessible through the task controls.
                </p>
              </div>
            </div>
            <div className="compatibility-row">
              <span className="compatibility-check">
                <Check size={17} />
              </span>
              <div>
                <strong>Meta Quest / WebXR</strong>
                <p>
                  Open the HTTPS app directly in a compatible headset browser, not inside an
                  embedded preview. Enter VR from a training session. The immersive task board
                  supports controllers and experimental pinch-based hand selection, including a
                  numeric keypad.
                </p>
              </div>
            </div>
            <div className="hardware-note">
              <AlertTriangle size={17} />
              <span>
                WebXR and hand tracking require real-headset testing. This is a browser app, not a
                native Quest APK or a Meta AI-glasses integration.
              </span>
            </div>
            <a
              className="docs-link"
              href="https://immersiveweb.dev/"
              target="_blank"
              rel="noreferrer"
            >
              About WebXR browser support <ArrowUpRight size={14} />
            </a>
          </section>
        </div>
      </div>
      {confirm && (
        <Dialog
          title="Remove sample sessions?"
          description="Make this workspace entirely your own."
          onClose={() => !removing && setConfirm(false)}
        >
          <div className="form-body">
            <div className="delete-icon">
              <Trash2 size={25} />
            </div>
            <p className="confirmation-text">
              This permanently removes <strong>{sampleCount} sample sessions</strong>. Your own
              training sessions, learners, scenarios, and assignments will stay. The sample history
              cannot be restored from the app.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
              disabled={removing}
            >
              Keep samples
            </button>
            <button
              className="button danger solid"
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                try {
                  await api('/demo-data', { method: 'DELETE' });
                  await refresh();
                  toast('Sample history removed. Your real sessions are safe.');
                  setConfirm(false);
                } catch (e) {
                  toast((e as Error).message, 'error');
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? 'Removing…' : 'Remove sample sessions'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
