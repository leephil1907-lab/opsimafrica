import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, Package, Truck, Wallet, ShieldCheck, Check, Box } from 'lucide-react';
import type { Scenario, Session } from '../types';
import { initials, scoreClass } from '../lib/utils';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="m16 3 12 6.5v13L16 29 4 22.5v-13Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="m4 9.5 12 6.6 12-6.6M16 16v13M10 6.3l12 6.5v6.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <div>
          <span className="brand-name">
            OpsSim<span className="brand-dot">.</span>
          </span>
          <span className="brand-country">AFRICA</span>
        </div>
      )}
    </div>
  );
}
export function Avatar({
  name,
  color = 'green',
  size = '',
  image = false,
}: {
  name: string;
  color?: string;
  size?: string;
  image?: boolean;
}) {
  return (
    <span className={`avatar ${color} ${size} ${image ? 'manager-avatar' : ''}`} title={name}>
      {initials(name)}
    </span>
  );
}
export function ScenarioIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const Icon =
    icon === 'truck'
      ? Truck
      : icon === 'wallet'
        ? Wallet
        : icon === 'shield'
          ? ShieldCheck
          : Package;
  return <Icon size={size} strokeWidth={1.7} />;
}
export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={`score-badge ${scoreClass(score || 0)}`}>
      {score ?? '—'}
      <span>/ 100</span>
    </span>
  );
}
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Box size={28} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
let scrollLocks = 0;
let originalOverflow = '';
export function useScrollLock() {
  useEffect(() => {
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow;
    };
  }, []);
}
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  useScrollLock();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const focusTarget =
        ref.current?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea') ||
        ref.current?.querySelector<HTMLElement>('select, button');
      focusTarget?.focus();
    }, 40);
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const els = ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
      );
      if (!els?.length) return;
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els[els.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault();
        els[0].focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ScenarioCard({
  scenario,
  onOpen,
  count,
}: {
  scenario: Scenario;
  onOpen: () => void;
  count?: number;
}) {
  return (
    <button className="scenario-card" onClick={onOpen}>
      <div className={`scenario-visual ${scenario.color}`}>
        <WarehouseArt variant={scenario.scene} />
        <span className="visual-category">
          <ScenarioIcon icon={scenario.icon} size={13} />
          {scenario.engine === 'receiving-lab' ? 'HANDS-FIRST LAB' : scenario.category}
        </span>
        <span className="visual-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="scenario-card-content">
        <div className="scenario-meta">
          <span className={`difficulty ${scenario.difficulty.toLowerCase()}`}>
            <i />
            {scenario.difficulty}
          </span>
          <span>
            {scenario.duration} min ·{' '}
            {scenario.engine === 'receiving-lab' ? '10 cartons' : scenario.steps.length + ' tasks'}
          </span>
        </div>
        <h3>{scenario.title}</h3>
        <p>{scenario.subtitle}</p>
        <div className="scenario-card-bottom">
          <span>{count !== undefined ? `${count} completed sessions` : scenario.industry}</span>
          <span className="practice-link">
            {scenario.engine === 'receiving-lab' ? 'Enter lab' : 'Practice'}{' '}
            <ArrowUpRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}
export function TaskCheck({
  checked,
  active,
  index,
}: {
  checked: boolean;
  active?: boolean;
  index: number;
}) {
  return (
    <span className={`task-check ${checked ? 'done' : ''} ${active ? 'active' : ''}`}>
      {checked ? <Check size={13} /> : String(index + 1).padStart(2, '0')}
    </span>
  );
}
export function SampleNote({ sessions }: { sessions: Session[] }) {
  const count = sessions.filter((s) => s.demo).length;
  return count ? (
    <span className="sample-note">
      <span className="sample-dot" />
      Includes {count} sample sessions
    </span>
  ) : (
    <span className="sample-note">
      <span className="sample-dot live" />
      Your workspace data
    </span>
  );
}

type IsoProps = {
  x: number;
  z: number;
  y?: number;
  w: number;
  d: number;
  h: number;
  top?: string;
  front?: string;
  side?: string;
};
function pt(x: number, z: number, y = 0) {
  return `${310 + (x - z) * 0.88},${184 + (x + z) * 0.43 - y}`;
}
function IsoBox({
  x,
  z,
  y = 0,
  w,
  d,
  h,
  top = '#d5b792',
  front = '#ba9871',
  side = '#a98760',
}: IsoProps) {
  return (
    <g>
      <polygon
        points={`${pt(x, z, y)} ${pt(x + w, z, y)} ${pt(x + w, z, y + h)} ${pt(x, z, y + h)}`}
        fill={front}
      />
      <polygon
        points={`${pt(x + w, z, y)} ${pt(x + w, z + d, y)} ${pt(x + w, z + d, y + h)} ${pt(x + w, z, y + h)}`}
        fill={side}
      />
      <polygon
        points={`${pt(x, z, y + h)} ${pt(x + w, z, y + h)} ${pt(x + w, z + d, y + h)} ${pt(x, z + d, y + h)}`}
        fill={top}
      />
    </g>
  );
}
function Shelf({ x, z, boxes = true }: { x: number; z: number; boxes?: boolean }) {
  return (
    <g>
      <IsoBox x={x} z={z} w={118} d={31} h={115} top="#4e6758" front="#496452" side="#3a5144" />
      {[14, 54, 94].map((y, row) => (
        <g key={y}>
          <IsoBox
            x={x - 2}
            z={z - 4}
            y={y}
            w={123}
            d={39}
            h={5}
            top="#c2d0bf"
            front="#dbe4d6"
            side="#9aaf9b"
          />
          {boxes &&
            [0, 1, 2, 3].map((b) => (
              <g key={b}>
                <IsoBox
                  x={x + 5 + b * 28}
                  z={z - 3}
                  y={y + 5}
                  w={23}
                  d={28}
                  h={row === 1 && b === 2 ? 21 : 28}
                  top={b % 3 === 0 ? '#e2bd83' : '#e6d0ab'}
                  front={b % 3 === 0 ? '#caa367' : '#c5ab80'}
                  side="#b1946a"
                />
                <polygon
                  points={`${pt(x + 15 + b * 28, z - 3, y + 18)} ${pt(x + 24 + b * 28, z - 3, y + 18)} ${pt(x + 24 + b * 28, z - 3, y + 26)} ${pt(x + 15 + b * 28, z - 3, y + 26)}`}
                  fill="#f6f2d9"
                  opacity=".9"
                />
              </g>
            ))}
        </g>
      ))}
      {[0, 115].map((p) => (
        <IsoBox
          key={p}
          x={x + p}
          z={z - 5}
          w={5}
          d={5}
          h={125}
          top="#dbe3d4"
          front="#adc1a8"
          side="#78937e"
        />
      ))}
    </g>
  );
}
export function WarehouseArt({
  variant = 'receiving',
  hero = false,
}: {
  variant?: string;
  hero?: boolean;
}) {
  return (
    <svg
      className={`warehouse-art ${hero ? 'hero-art' : ''}`}
      viewBox="65 55 500 355"
      aria-hidden="true"
    >
      <defs>
        <filter id={`shadow-${variant}-${hero}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <ellipse
        cx="308"
        cy="326"
        rx="193"
        ry="35"
        fill={hero ? '#0c2117' : '#566b52'}
        opacity=".14"
        filter={`url(#shadow-${variant}-${hero})`}
      />
      <IsoBox
        x={-45}
        z={-22}
        w={285}
        d={224}
        h={12}
        y={-12}
        top={hero ? '#758b70' : '#e4e8d9'}
        front={hero ? '#526d51' : '#c0c9b5'}
        side={hero ? '#496047' : '#aebb9e'}
      />
      <polygon
        points={`${pt(-35, -15)} ${pt(235, -15)} ${pt(235, -15, 145)} ${pt(-35, -15, 145)}`}
        fill={hero ? '#869d7b' : '#d3dfc7'}
      />
      <polygon
        points={`${pt(-35, -15)} ${pt(-35, 190)} ${pt(-35, 190, 100)} ${pt(-35, -15, 145)}`}
        fill={hero ? '#687f61' : '#c1d1b4'}
      />
      <Shelf x={-10} z={0} />
      <Shelf x={125} z={0} />
      {[0, 1, 2, 3, 4].map((i) => (
        <polygon
          key={i}
          points={`${pt(30 + i * 36, 86)} ${pt(49 + i * 36, 86)} ${pt(49 + i * 36, 89)} ${pt(30 + i * 36, 89)}`}
          fill="#e3c779"
        />
      ))}
      <IsoBox x={-8} z={116} w={61} d={38} h={6} top="#ba9869" front="#98774f" side="#8c6d47" />
      {[0, 1, 2].map((b) => (
        <IsoBox
          key={b}
          x={-7 + b * 19}
          z={116}
          y={6}
          w={17}
          d={32}
          h={23 + (b % 2) * 8}
          top="#e1bd86"
          front="#c29b66"
          side="#b78c55"
        />
      ))}
      <IsoBox
        x={1}
        z={121}
        y={30}
        w={28}
        d={26}
        h={23}
        top="#e5c998"
        front="#d3ae76"
        side="#bd955e"
      />
      <IsoBox x={135} z={112} w={89} d={42} h={53} top="#b59d75" front="#4a6652" side="#3d5747" />
      <IsoBox
        x={131}
        z={109}
        y={53}
        w={98}
        d={48}
        h={6}
        top="#d7c39e"
        front="#c3ab86"
        side="#b19871"
      />
      {variant === 'cash' ? (
        <>
          <IsoBox
            x={160}
            z={120}
            y={59}
            w={24}
            d={20}
            h={8}
            top="#263f34"
            front="#354f40"
            side="#1f3428"
          />
          <IsoBox
            x={166}
            z={120}
            y={67}
            w={18}
            d={4}
            h={22}
            top="#a7b69c"
            front="#294337"
            side="#49664d"
          />
        </>
      ) : (
        <>
          <IsoBox
            x={147}
            z={117}
            y={59}
            w={32}
            d={30}
            h={26}
            top="#ead1a6"
            front="#c7a477"
            side="#b08c60"
          />
          <IsoBox
            x={188}
            z={118}
            y={59}
            w={23}
            d={21}
            h={3}
            top="#f5f1df"
            front="#d0cbb7"
            side="#c8c5b3"
          />
        </>
      )}
      <g>
        <IsoBox x={95} z={151} w={29} d={25} h={4} top="#59765b" front="#3c5840" side="#304b34" />
        <IsoBox
          x={99}
          z={155}
          y={4}
          w={22}
          d={19}
          h={24}
          top="#e8c18a"
          front="#d1a16c"
          side="#b98c55"
        />
        <path
          d={`M${pt(95, 178, 6)} L${pt(95, 178, 50)} L${pt(124, 178, 50)} L${pt(124, 178, 6)}`}
          fill="none"
          stroke="#405a42"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="244" cy="322" r="5" fill="#2f4636" />
        <circle cx="269" cy="333" r="5" fill="#2f4636" />
      </g>
      {variant === 'safety' && (
        <polygon
          points={`${pt(170, 164, 0.5)} ${pt(201, 161, 0.5)} ${pt(215, 180, 0.5)} ${pt(182, 190, 0.5)} ${pt(158, 181, 0.5)}`}
          fill="#7eabad"
          opacity=".9"
        />
      )}
      {hero && (
        <>
          <g transform="translate(403 67)">
            <rect x="0" y="0" width="75" height="28" rx="7" fill="#f7faeb" />
            <circle cx="15" cy="14" r="4" fill="#66854b" />
            <text x="26" y="18" fill="#385334" fontSize="10" fontFamily="Arial" fontWeight="600">
              All systems go
            </text>
          </g>
          <g transform="translate(112 172)">
            <rect x="0" y="0" width="76" height="29" rx="7" fill="#f7faeb" />
            <path d="m11 14 4 4 7-9" stroke="#5a7847" strokeWidth="2" fill="none" />
            <text x="29" y="18" fill="#385334" fontSize="10" fontFamily="Arial" fontWeight="600">
              Task complete
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
