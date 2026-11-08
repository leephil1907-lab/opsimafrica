import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  CheckCircle2,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Hand,
  Headset,
  Layers3,
  Menu,
  PackageCheck,
  Play,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import './site.css';

type SitePage = 'home' | 'product' | 'scenarios' | 'businesses' | 'about' | 'contact';
const paths: Record<SitePage, string> = {
  home: '/',
  product: '/product',
  scenarios: '/scenarios',
  businesses: '/for-businesses',
  about: '/about',
  contact: '/contact',
};
const pageTitles: Record<SitePage, string> = {
  home: 'Practical VR training for African operations teams',
  product: 'A practical training room for your team',
  scenarios: 'One focused scenario. A practical roadmap.',
  businesses: 'Build readiness before the first real shift',
  about: 'Why OpsSim Africa',
  contact: 'Book a demo',
};
const nav = [
  ['product', 'Product'],
  ['scenarios', 'Scenarios'],
  ['businesses', 'For businesses'],
  ['about', 'Why OpsSim'],
] as const;
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`site-brand ${light ? 'light' : ''}`}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill={light ? '#E8EDF2' : '#0F1B2A'} />
        <path
          d="m10 13 10-5 10 5v13l-10 6-10-6Z M10 13l10 6 10-6 M20 19v13 M15 10l10 6"
          fill="none"
          stroke={light ? '#0F1B2A' : '#E8EDF2'}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="m23 25 3 3 6-8"
          fill="none"
          stroke="#00A86B"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        OpsSim<span className="brand-africa">Africa</span>
      </span>
    </span>
  );
}
const btn = (label: string, to = '/contact', secondary = false) => (
  <a className={`site-button ${secondary ? 'secondary' : ''}`} href={to}>
    {label}
    <ArrowUpRight size={18} />
  </a>
);
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="site-eyebrow">
      <span />
      {children}
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
}) {
  return (
    <div className="site-section-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}
export function StockroomConcept() {
  return (
    <svg
      className="stockroom-concept"
      viewBox="0 0 640 440"
      role="img"
      aria-labelledby="room-title room-desc"
    >
      <title id="room-title">BrightMart receiving stockroom concept</title>
      <desc id="room-desc">
        A central eight-carton delivery table, Health and Wellness shelf on the left, Grocery and
        Household shelf on the right, separate quarantine bin, task panel and portable receiving
        tablet. Use hand rays without walking.
      </desc>
      <defs>
        <linearGradient id="room-bg" x2="1" y2="1">
          <stop stopColor="#EDF2F6" />
          <stop offset="1" stopColor="#DDE8E4" />
        </linearGradient>
        <filter id="room-shadow">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".07" />
        </filter>
      </defs>
      <rect width="640" height="440" rx="20" fill="url(#room-bg)" />
      <path d="m60 329 249-112 279 100-256 118Z" fill="#D7DFE0" />
      <path d="M60 329V134l249-96v179Z" fill="#E6EBEB" />
      <path d="m309 38 279 104v175L309 217Z" fill="#F5F7F8" />
      <g filter="url(#room-shadow)">
        <rect x="233" y="39" width="190" height="76" rx="9" fill="#1B2027" />
        <text
          x="328"
          y="62"
          textAnchor="middle"
          fill="#8BDEC0"
          fontSize="12"
          fontFamily="Manrope,Arial"
        >
          TASK PANEL
        </text>
        <text
          x="328"
          y="82"
          textAnchor="middle"
          fill="#E8EDF2"
          fontSize="16"
          fontFamily="Manrope,Arial"
        >
          Inspect cartons
        </text>
        <text
          x="328"
          y="102"
          textAnchor="middle"
          fill="#A9B4BF"
          fontSize="12"
          fontFamily="Manrope,Arial"
        >
          3 of 8 processed · 4:12 left
        </text>
      </g>
      <g stroke="#0F1B2A" strokeWidth="6" fill="none">
        <path d="M103 170v147m110-184v138M97 180l119-43M97 230l119-43M97 280l119-43" />
        <path d="M431 139v140m111-102v141M425 147l120 42M425 195l120 42M425 244l120 42" />
      </g>
      <g fill="#99C4B4">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={119 + i * 29} y={171 - i * 10} width="20" height="25" rx="2" />
        ))}
      </g>
      <g fill="#BFCEDB">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={447 + i * 27} y={184 + i * 9} width="19" height="24" rx="2" />
        ))}
      </g>
      <rect x="38" y="116" width="182" height="35" rx="8" fill="#FFFFFF" />
      <circle cx="54" cy="133" r="7" fill="#007E53" />
      <text x="67" y="138" fontFamily="Manrope,Arial" fontSize="14" fill="#0F1B2A">
        Health & Wellness
      </text>
      <rect x="405" y="116" width="211" height="35" rx="8" fill="#FFFFFF" />
      <circle cx="421" cy="133" r="7" fill="#007E53" />
      <text x="434" y="138" fontFamily="Manrope,Arial" fontSize="14" fill="#0F1B2A">
        Grocery & Household
      </text>
      <path d="m205 273 116-49 126 45-121 56Z" fill="#CBB48F" />
      <path d="M205 273v18l121 54v-20Zm121 52v20l121-55v-21Z" fill="#A78B66" />
      <path d="M217 294v53m214-53v50m-103 2v36" stroke="#60716B" strokeWidth="9" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const x = 236 + (i % 4) * 29 + (i > 3 ? -9 : 8),
          y = 263 - Math.floor(i / 4) * 22 - (i % 4) * 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width="24"
              height="22"
              rx="2"
              fill={i === 4 ? '#DAB0A2' : '#E4CEAA'}
              stroke="#BDA680"
            />
            <path d={`M${x + 11} ${y}v22`} stroke="#F7F0DF" strokeWidth="4" />
          </g>
        );
      })}
      <rect x="225" y="347" width="192" height="34" rx="8" fill="#FFFFFF" />
      <text
        x="321"
        y="369"
        textAnchor="middle"
        fill="#0F1B2A"
        fontSize="14"
        fontFamily="Manrope,Arial"
      >
        Central delivery table
      </text>
      <path d="m91 323 66-18 49 25-67 24Z" fill="#F1A49C" />
      <path d="M91 323v52l48 26v-47Zm48 31v47l67-29v-42Z" fill="#D05A51" />
      <path d="m137 366 9-15 9 15Z" fill="none" stroke="#FFF4F1" strokeWidth="2" />
      <rect x="58" y="402" width="166" height="30" rx="7" fill="#FFFFFF" />
      <text
        x="141"
        y="422"
        textAnchor="middle"
        fontSize="14"
        fill="#9B3833"
        fontFamily="Manrope,Arial"
      >
        ⚠ Quarantine / returns
      </text>
      <g transform="translate(468 303) rotate(8)" filter="url(#room-shadow)">
        <rect width="89" height="112" rx="9" fill="#1B2027" />
        <rect x="8" y="11" width="73" height="66" rx="4" fill="#2A323C" />
        <path d="M18 28h52M18 42h36M18 57h45" stroke="#A9B4BF" strokeWidth="3" />
        <rect x="10" y="85" width="69" height="17" rx="4" fill="#00A86B" />
        <text
          x="44"
          y="97"
          textAnchor="middle"
          fill="#0F1B2A"
          fontSize="9"
          fontFamily="Manrope,Arial"
        >
          REVIEW
        </text>
      </g>
      <rect x="436" y="266" width="158" height="30" rx="7" fill="#FFFFFF" />
      <text
        x="515"
        y="286"
        textAnchor="middle"
        fontSize="14"
        fill="#0F1B2A"
        fontFamily="Manrope,Arial"
      >
        Receiving tablet
      </text>
    </svg>
  );
}
function DemoDialog({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="site-demo-dialog"
      aria-labelledby="product-demo-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <header>
        <div>
          <span className="site-eyebrow">THE 60-SECOND WALKTHROUGH</span>
          <h2 id="product-demo-title">See the work. Then practise it.</h2>
        </div>
        <button className="site-icon-button" onClick={close} aria-label="Close demo">
          <X />
        </button>
      </header>
      <video
        controls
        playsInline
        autoPlay
        preload="metadata"
        poster="/images/retail-practice-hero.webp"
      >
        <source src="/images/product-demo.mp4" type="video/mp4" />
        <track
          kind="captions"
          src="/images/product-demo.vtt"
          srcLang="en"
          label="English"
          default
        />
      </video>
      <p>
        Captioned product walkthrough. Product screenshots and illustrative scenes—not
        physical-headset validation.
      </p>
      <div className="dialog-actions">
        {btn('Try the practice lab', '/app#brightmart')}
        {btn('Request a business demo', '/contact', true)}
      </div>
    </dialog>
  );
}
function ManagerPreview() {
  return (
    <div className="manager-preview">
      <div className="manager-preview-title">
        <span className="mini-icon">
          <ChartNoAxesCombined size={19} />
        </span>
        <div>
          <strong>Team readiness</strong>
          <span>Illustrative manager view</span>
        </div>
        <span className="preview-live">EXAMPLE</span>
      </div>
      <div className="manager-person">
        <span className="person-avatar">AO</span>
        <div>
          <strong>Amaka Okafor</strong>
          <span>Stock Receiving Assistant</span>
        </div>
        <span className="score-example">
          88<span>/100</span>
        </span>
      </div>
      <div className="preview-metrics">
        <div>
          <span>SCENARIO</span>
          <strong>Stock receiving</strong>
        </div>
        <div>
          <span>ACTIVE TIME</span>
          <strong>4:12</strong>
        </div>
        <div>
          <span>EXCEPTIONS</span>
          <strong>4 of 4 caught</strong>
        </div>
      </div>
      <div className="preview-bars">
        {[
          ['Accuracy', 25, 35],
          ['Exceptions', 23, 25],
          ['Process', 25, 25],
          ['Efficiency', 15, 15],
        ].map(([name, n, total]) => (
          <div key={name}>
            <span>{name}</span>
            <div>
              <i style={{ width: `${(Number(n) / Number(total)) * 100}%` }} />
            </div>
            <strong>
              {n}/{total}
            </strong>
          </div>
        ))}
      </div>
      <div className="preview-coaching">
        <TriangleAlert size={20} />
        <div>
          <strong>Next focus: quantity checks</strong>
          <p>Count against the delivery note before shelving. Assign a focused retry.</p>
        </div>
      </div>
    </div>
  );
}
const learn = [
  {
    word: 'Inspect',
    text: 'Examine cartons, seals, labels, expiry dates and batch information.',
    icon: Box,
  },
  {
    word: 'Sort',
    text: 'Place accepted stock in the correct, clearly labelled category.',
    icon: Layers3,
  },
  {
    word: 'Flag',
    text: 'Isolate damaged, expired or mismatched physical stock.',
    icon: TriangleAlert,
  },
  {
    word: 'Record',
    text: 'Count actual units and record shortages without hiding them.',
    icon: ClipboardCheck,
  },
  {
    word: 'Improve',
    text: 'Review the scorecard, get focused coaching and repeat.',
    icon: ChartNoAxesCombined,
  },
];
const roadmap = [
  {
    title: 'Stock Receiving & Shelf Audit',
    problem: 'Bad stock and missed quantities can reach sellable inventory.',
    who: 'Retail and pharmacy-style stock teams',
    practice: 'Inspect eight cartons, count units, isolate exceptions and submit.',
    measure: 'Accuracy, exceptions, process and efficiency.',
    live: true,
    icon: PackageCheck,
  },
  {
    title: 'Picking, Packing & Order Accuracy',
    problem: 'Small picking errors can become costly wrong deliveries.',
    who: 'Warehouse and fulfilment teams',
    practice: 'Match orders, select items and verify packs.',
    measure: 'Pick accuracy, packing checks and completion time.',
    icon: Box,
  },
  {
    title: 'Customer Service & Queue Management',
    problem: 'Unpractised interactions can turn busy periods into poor service.',
    who: 'Shop attendants and service teams',
    practice: 'Handle requests and choose appropriate service responses.',
    measure: 'Decision quality and service consistency.',
    icon: Users,
  },
  {
    title: 'Cash Reconciliation & End-of-Day Close',
    problem: 'Small discrepancies can make the daily close unreliable.',
    who: 'Cashiers and branch supervisors',
    practice: 'Reconcile a till and document discrepancies.',
    measure: 'Count accuracy and close-process compliance.',
    icon: ClipboardCheck,
  },
  {
    title: 'Delivery Dispatch & Route Discipline',
    problem: 'Missed checks can cause avoidable dispatch and delivery mistakes.',
    who: 'Dispatchers and logistics teams',
    practice: 'Verify orders and follow a dispatch sequence.',
    measure: 'Dispatch checks and order discipline.',
    icon: PackageCheck,
  },
  {
    title: 'Safety, Hygiene & Compliance',
    problem: 'Knowing a rule is different from noticing a risk in time.',
    who: 'Retail, warehouse and operations teams',
    practice: 'Recognise hazards and follow appropriate procedures.',
    measure: 'Hazard recognition and process adherence.',
    icon: ShieldCheck,
  },
];
function CallToAction() {
  return (
    <section className="site-final-cta">
      <div>
        <Eyebrow>MAKE THE NEXT SHIFT MORE CONFIDENT</Eyebrow>
        <h2>
          Ready to train your team
          <br />
          without disrupting operations?
        </h2>
        <p>Let’s talk about your workflow, your team and a practical first pilot.</p>
      </div>
      {btn('Book a Demo')}
    </section>
  );
}
function HomePage({ watch }: { watch: () => void }) {
  return (
    <>
      <section className="site-hero">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <Eyebrow>REAL WORK. REHEARSED.</Eyebrow>
            <h1>
              Train your team
              <br />
              before mistakes
              <br />
              <em>cost you money.</em>
            </h1>
            <p>
              OpsSim Africa helps retail, warehouse, pharmacy and logistics teams practise real
              operational tasks in VR—then measures readiness before the next real shift.
            </p>
            <div className="hero-actions">
              {btn('Book a Demo')}
              <button className="site-button secondary" onClick={watch}>
                <Play size={18} />
                Watch the 60-second Demo
              </button>
            </div>
            <div className="hero-reassurance">
              <CheckCircle2 size={17} />
              <span>Start with Stock Receiving & Shelf Audit</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-wrap">
              <img
                src="/images/retail-practice-hero.webp"
                alt="Illustrative scene of an African retail trainee wearing a mixed-reality headset and checking a delivery carton"
                width="880"
                height="660"
                fetchPriority="high"
              />
              <span className="hero-corner">
                <Hand size={20} />
                <span>
                  Hands on.
                  <br />
                  <strong>Work ready.</strong>
                </span>
              </span>
            </div>
            <div className="hero-feedback">
              <span className="feedback-icon">
                <ShieldCheck size={24} />
              </span>
              <div>
                <strong>Catch it before it costs you.</strong>
                <span>Damaged stock stays out of sellable inventory.</span>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <p className="image-caption">Illustrative training scene · fictional trainee</p>
          </div>
        </div>
        <div className="site-container hero-proof">
          <span>
            <Clock3 size={19} />
            Designed for quicker onboarding
          </span>
          <span>
            <ShieldCheck size={19} />
            Practise spotting costly errors
          </span>
          <span>
            <ChartNoAxesCombined size={19} />
            Measure staff readiness
          </span>
        </div>
      </section>
      <section className="site-section site-container">
        <SectionHeading
          eyebrow="EVERYDAY MISTAKES. REAL COSTS."
          title={
            <>
              Staff learn best by doing.
              <br />
              Real mistakes are expensive.
            </>
          }
          body="New staff often learn stock handling, service and safety on the job. A repeatable practice space helps them build confidence before real inventory or customers are at stake."
        />
        <div className="site-benefit-grid">
          {[
            {
              title: 'Practise safely',
              text: 'Build experience without risking real inventory or customer service.',
              icon: ShieldCheck,
            },
            {
              title: 'Standardise training',
              text: 'Give staff the same practical scenario, across shifts and branches.',
              icon: Layers3,
            },
            {
              title: 'Measure readiness',
              text: 'See accuracy, speed and recurring mistakes—not just attendance.',
              icon: ChartNoAxesCombined,
            },
          ].map((c) => (
            <article className="site-benefit-card" key={c.title}>
              <span className="site-card-icon">
                <c.icon size={27} />
              </span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="site-section site-soft">
        <div className="site-container">
          <div className="heading-row">
            <SectionHeading
              eyebrow="A SIMPLE, REPEATABLE LOOP"
              title="From delivery to decision in minutes."
            />
            <a className="site-text-link" href="/product">
              Explore the product <ArrowRight size={18} />
            </a>
          </div>
          <div className="site-timeline">
            {[
              'Receive a scenario',
              'Inspect and sort',
              'Flag exceptions',
              'Submit and improve',
            ].map((label, i) => (
              <div key={label}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <h3>{label}</h3>
                <p>
                  {
                    [
                      'Read the brief. Know the task and handling rules.',
                      'Use your hands. Compare evidence before deciding.',
                      'Keep problem stock out of sellable inventory.',
                      'Review your scorecard and practise the next improvement.',
                    ][i]
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="site-section site-container site-split">
        <div>
          <SectionHeading
            eyebrow="THE FIRST LIVE SCENARIO"
            title={
              <>
                Good stock in.
                <br />
                Bad surprises out.
              </>
            }
            body="Start with Stock Receiving & Shelf Audit. Receive eight cartons at BrightMart Mini Store, check quantities and dates, isolate exceptions, and complete a receiving report."
          />
          <ul className="site-check-list">
            <li>
              <CheckCircle2 />
              Inspect, count and classify real virtual objects
            </li>
            <li>
              <CheckCircle2 />
              Use clearly separated shelf and quarantine zones
            </li>
            <li>
              <CheckCircle2 />
              Record a two-unit shortage—not imaginary missing stock
            </li>
            <li>
              <CheckCircle2 />
              Try a harder twelve-carton replay
            </li>
          </ul>
          {btn('Explore the receiving scenario', '/product', true)}
        </div>
        <div className="scene-concept-wrap">
          <StockroomConcept />
          <span className="concept-caption">
            <span className="status-dot" />
            Stationary design · no walking required
          </span>
        </div>
      </section>
      <section className="manager-section">
        <div className="site-container site-split">
          <div>
            <Eyebrow>FROM PRACTICE TO PROGRESS</Eyebrow>
            <h2>
              See readiness,
              <br />
              not just completion.
            </h2>
            <p>
              A score is useful when it explains what happened. Review accuracy, active time,
              exception handling and the two areas to practise next.
            </p>
            <ul className="site-check-list">
              <li>
                <CheckCircle2 />
                Saved individual scorecards
              </li>
              <li>
                <CheckCircle2 />
                Recurring error categories
              </li>
              <li>
                <CheckCircle2 />
                Focused remedial assignments
              </li>
            </ul>
            <a className="site-text-link" href="/for-businesses">
              Built for the people running the work <ArrowRight size={18} />
            </a>
          </div>
          <ManagerPreview />
        </div>
      </section>
      <section className="site-section site-container">
        <SectionHeading
          eyebrow="BUILT FOR AFRICAN BUSINESSES"
          title="For the people behind everyday operations."
          body="One focused receiving MVP today, with a practical roadmap for the teams that keep businesses moving."
        />
        <AudienceCards />
      </section>
      <div className="site-container">
        <CallToAction />
      </div>
    </>
  );
}
function AudienceCards() {
  return (
    <div className="audience-grid">
      {[
        {
          name: 'Retail stores',
          desc: 'Stock handling, shelf organisation and receiving accuracy.',
          icon: Box,
        },
        {
          name: 'Pharmacies',
          desc: 'Non-clinical expiry, stock rotation and receiving practice.',
          icon: ShieldCheck,
        },
        {
          name: 'Warehouses',
          desc: 'Receiving now. Picking, packing and safety on the roadmap.',
          icon: Layers3,
        },
        {
          name: 'Logistics teams',
          desc: 'A roadmap for dispatch checks and delivery discipline.',
          icon: PackageCheck,
        },
      ].map((c) => (
        <article key={c.name}>
          <c.icon size={26} />
          <h3>{c.name}</h3>
          <p>{c.desc}</p>
        </article>
      ))}
    </div>
  );
}
function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body: string }) {
  return (
    <section className="site-page-intro site-container">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}
function ProductPage({ watch }: { watch: () => void }) {
  return (
    <>
      <PageIntro
        eyebrow="PRACTICAL TRAINING. EXPLAINABLE RESULTS."
        title={
          <>
            A practical training room
            <br />
            for your operations team.
          </>
        }
        body="Turn an everyday workflow into a safe, repeatable practice session. Staff make the decisions; clear rules and immediate feedback explain the outcome."
      />
      <section className="site-container product-overview">
        <StockroomConcept />
        <div className="product-side-card">
          <span className="site-live-badge">
            <span />
            AVAILABLE IN MVP
          </span>
          <h2>Receive and Shelf-Check a Supplier Delivery</h2>
          <p>BrightMart Mini Store · Stock Receiving Assistant</p>
          <div className="product-stat-row">
            <span>
              <Box />8 cartons
            </span>
            <span>
              <Clock3 />
              6-minute target
            </span>
            <span>
              <Hand />
              Hands only
            </span>
          </div>
          <p>
            Four correct items, a damaged carton, an expired item, a short-supplied carton and a
            product-label mismatch. Accept the sound units. Isolate unsafe stock.
          </p>
          {btn('Try the practice lab', '/app#brightmart')}
          <button className="site-text-link" onClick={watch}>
            <Play size={17} />
            Watch the 60-second walkthrough
          </button>
        </div>
      </section>
      <section className="site-section site-container product-evidence-section">
        <SectionHeading
          eyebrow="INSIDE THE ACTUAL PRODUCT"
          title="From carton evidence to a saved result."
          body="Actual desktop application screenshots from the BrightMart lesson—not headset footage or invented dashboard screens."
        />
        <div className="product-shot-grid">
          {[
            [
              'inspect',
              'Inspect the evidence',
              'Compare condition, SKU, batch and dates before shelving.',
            ],
            [
              'record',
              'Record what arrived',
              'Use large quantity controls. Accept 22 sound units; record the shortage of 2.',
            ],
            [
              'scorecard',
              'Choose the next improvement',
              'A fixed score breakdown and two coaching priorities follow submission.',
            ],
          ].map(([key, title, caption]) => (
            <figure key={key}>
              <a
                href={`/images/product-${key}.webp`}
                target="_blank"
                rel="noreferrer"
                aria-label={`View full-size product screenshot: ${title}`}
              >
                <img
                  src={`/images/product-${key}.webp`}
                  alt={`Actual BrightMart desktop view: ${title}`}
                  width="490"
                  height="900"
                  loading="lazy"
                />
                <span>
                  View full screenshot <ArrowUpRight size={16} />
                </span>
              </a>
              <figcaption>
                <strong>{title}</strong>
                <p>{caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="site-section site-container">
        <SectionHeading
          eyebrow="WHAT YOUR TEAM LEARNS"
          title="Five skills. One accountable receiving loop."
        />
        <div className="learning-grid">
          {learn.map((c) => (
            <article key={c.word}>
              <c.icon size={25} />
              <h3>{c.word}.</h3>
              <p>{c.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="site-soft site-section">
        <div className="site-container site-split">
          <div>
            <SectionHeading
              eyebrow="NATURAL HANDS-ONLY INTERACTION"
              title="Grab. Inspect. Sort. Flag. Submit."
              body="Point and pinch a menu. Bring a carton close and rotate it. Drag it to a shelf or quarantine. Poke large plus and minus controls, then review and confirm your report."
            />
            <ul className="site-check-list">
              <li>
                <CheckCircle2 />
                One-hand essential actions
              </li>
              <li>
                <CheckCircle2 />
                Seated or standing, without walking around
              </li>
              <li>
                <CheckCircle2 />
                Adjustable tablet distance and text size
              </li>
              <li>
                <CheckCircle2 />
                Explicit pause, resume and tracking-loss protection
              </li>
            </ul>
            <p className="honest-note">
              WebXR implementation. Physical Quest hands, passthrough and comfort still require
              device validation; browser and XR emulation are tested separately.
            </p>
          </div>
          <div className="tablet-marketing">
            <span>RECEIVING TABLET · ILLUSTRATIVE</span>
            <h3>Disposable gloves</h3>
            <p>Expected 24 units · count the carton</p>
            <div className="tablet-counter">
              <span>−</span>
              <strong>22</strong>
              <span>+</span>
            </div>
            <div className="tablet-field">
              <span>Condition</span>
              <b>Good</b>
            </div>
            <div className="tablet-field">
              <span>Action</span>
              <b>Accept sound units</b>
            </div>
            <div className="tablet-shortage">
              <TriangleAlert size={18} />
              2-unit shortage recorded separately
            </div>
            <div className="tablet-marketing-confirm">
              Review, then confirm <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </section>
      <section className="site-section site-container">
        <SectionHeading
          eyebrow="A SCORE THAT EXPLAINS THE WORK"
          title="Know what to practise next."
          body="A fixed 100-point rubric separates accuracy (35), exceptions (25), process (25) and efficiency (15). Scores describe practice—not a guarantee of real-world competence."
        />
        <div className="product-score-explain">
          <ManagerPreview />
          <div>
            <h3>Feedback at three useful moments.</h3>
            <ol className="feedback-levels">
              <li>
                <strong>In the moment</strong>
                <span>“This carton is damaged—move it to quarantine.”</span>
              </li>
              <li>
                <strong>After a stage</strong>
                <span>“You inspected 8 of 8 cartons.”</span>
              </li>
              <li>
                <strong>After submission</strong>
                <span>
                  See your two main coaching priorities and compare the next comparable attempt.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>
      <div className="site-container">
        <CallToAction />
      </div>
    </>
  );
}
function ScenariosPage() {
  return (
    <>
      <PageIntro
        eyebrow="ONE LIVE MVP. A FOCUSED ROADMAP."
        title={
          <>
            Real workflows.
            <br />
            Repeatable practice.
          </>
        }
        body="We are starting with receiving, not pretending every operation is ready. The scenarios below show what is available and what is planned."
      />
      <section className="site-container roadmap-grid">
        {roadmap.map((s) => (
          <article className={`roadmap-card ${s.live ? 'live' : ''}`} key={s.title}>
            <div className="roadmap-top">
              <s.icon size={27} />
              <span className={s.live ? 'available-badge' : 'planned-badge'}>
                {s.live ? 'Available in MVP' : 'Coming soon'}
              </span>
            </div>
            <h2>{s.title}</h2>
            <p>{s.problem}</p>
            <dl>
              <div>
                <dt>For</dt>
                <dd>{s.who}</dd>
              </div>
              <div>
                <dt>Practise</dt>
                <dd>{s.practice}</dd>
              </div>
              <div>
                <dt>Measure</dt>
                <dd>{s.measure}</dd>
              </div>
            </dl>
            {s.live ? (
              <a className="site-text-link" href="/app#brightmart">
                Try the receiving lesson <ArrowRight size={18} />
              </a>
            ) : (
              <a className="site-text-link" href="/contact?intent=waitlist">
                Join the waitlist <ArrowRight size={18} />
              </a>
            )}
          </article>
        ))}
      </section>
      <div className="site-container roadmap-disclosure">
        <ShieldCheck size={20} />
        <p>
          Roadmap descriptions are plans, not release commitments. Earlier browser-only prototype
          exercises may remain in the demo workspace; they are not complete immersive products.
        </p>
      </div>
      <div className="site-container">
        <CallToAction />
      </div>
    </>
  );
}
function DemoForm() {
  const purpose =
    new URLSearchParams(location.search).get('intent') === 'waitlist' ? 'waitlist' : 'demo';
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState<{ requestId: string; message: string } | null>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (success) result.current?.focus();
  }, [success]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          businessName: fd.get('businessName'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          industry: fd.get('industry'),
          teamSize: fd.get('teamSize'),
          challenge: fd.get('challenge'),
          website: fd.get('website') || '',
          consent: fd.get('consent') === 'on',
          purpose,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to save your request. Please try again.');
      setSuccess(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save your request.');
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="demo-form-success" role="status" tabIndex={-1} ref={result}>
        <span>
          <CheckCircle2 size={34} />
        </span>
        <h2>Request received.</h2>
        <p>{success.message}</p>
        <div className="request-receipt">
          <span>YOUR REFERENCE</span>
          <code>{success.requestId}</code>
        </div>
        <p>
          Your information was saved for follow-up. No calendar booking, email or WhatsApp message
          has been sent automatically.
        </p>
        <a className="site-button" href="/app#brightmart">
          Try the practice lab <ArrowRight size={18} />
        </a>
      </div>
    );
  return (
    <form className="site-demo-form" onSubmit={submit} aria-label="Demo request">
      <div className="form-intro">
        <span className="site-live-badge">
          <span />
          LET’S FIND A PRACTICAL START
        </span>
        <h2>{purpose === 'demo' ? 'Tell us about your team.' : 'Join the scenario waitlist.'}</h2>
        <p>Just the essentials. No sales call is booked automatically.</p>
      </div>
      {error && (
        <div className="site-form-error" role="alert">
          <TriangleAlert size={19} />
          {error}
        </div>
      )}
      <div className="form-field-grid">
        <label>
          Your name
          <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
        </label>
        <label>
          Business name
          <input
            name="businessName"
            autoComplete="organization"
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label>
          Phone <span>(optional)</span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={32} />
        </label>
        <label>
          Industry
          <select name="industry" defaultValue="" required>
            <option value="" disabled>
              Select your industry
            </option>
            {['Retail', 'Pharmacy', 'Warehouse', 'Logistics', 'Other'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Team size
          <select name="teamSize" defaultValue="" required>
            <option value="" disabled>
              Select team size
            </option>
            {['1–5', '6–20', '21–50', '51–200', '201+'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Main operational challenge
        <textarea
          name="challenge"
          minLength={10}
          maxLength={1500}
          rows={4}
          placeholder="For example: missed expiry checks during receiving, or inconsistent onboarding across branches."
          required
        />
      </label>
      <label className="site-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="form-consent">
        <input type="checkbox" name="consent" required />
        <span>
          I agree that OpsSim Africa may use these details to respond to this request.{' '}
          <a href="/about#privacy">Privacy & data use</a>
        </span>
      </label>
      <button type="submit" className="site-button" disabled={busy}>
        {busy ? 'Saving request…' : purpose === 'demo' ? 'Request a Demo' : 'Join the waitlist'}
        <ArrowRight size={18} />
      </button>
      <p className="form-footnote">
        <ShieldCheck size={16} />
        No payment details. Please don’t submit sensitive staff or customer information.
      </p>
    </form>
  );
}
function BusinessesPage() {
  return (
    <>
      <PageIntro
        eyebrow="FOR OWNERS. MANAGERS. TRAINING LEADS."
        title={
          <>
            Build readiness before
            <br />
            the first real shift.
          </>
        }
        body="Give your team a practical alternative to classroom-only training. Repeat the same workflow, spot avoidable mistakes and choose focused follow-up practice."
      />
      <section className="site-container business-value-grid">
        {[
          [
            'A more confident start',
            'Help new staff rehearse receiving before handling real stock.',
          ],
          [
            'Consistency across branches',
            'Give staff the same scenario, briefing and marking criteria.',
          ],
          [
            'A clearer coaching conversation',
            'Use actual decisions and error categories—not guesswork.',
          ],
          [
            'Practice without disruption',
            'No real delivery, customer queue or warehouse shutdown required.',
          ],
        ].map(([t, d]) => (
          <article key={t}>
            <CheckCircle2 size={25} />
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <section className="site-section site-soft">
        <div className="site-container">
          <SectionHeading eyebrow="HOW IT WORKS" title="From your workflow to focused practice." />
          <ol className="business-flow">
            {[
              'Choose your business context',
              'Select the receiving scenario',
              'Assign a learner and deadline',
              'Staff complete a hands-on session',
              'Review scorecards and improvement areas',
            ].map((v, i) => (
              <li key={v}>
                <span>{i + 1}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ol>
          <p className="honest-note">
            The current team workspace is a shared demo, not secure multi-tenant software. A private
            workplace deployment needs authentication, permissions and a data-handling agreement
            before real staff data is used.
          </p>
        </div>
      </section>
      <section className="site-section site-container request-section">
        <div>
          <SectionHeading
            eyebrow="START WITH A BUSINESS DEMO"
            title="Tell us where the work gets difficult."
            body="Receiving errors? Slow onboarding? Inconsistent checks? A focused first conversation helps identify a useful pilot—without promising guaranteed error reduction."
          />
          <div className="business-mini-points">
            <span>
              <Clock3 />
              Short, repeatable sessions
            </span>
            <span>
              <ChartNoAxesCombined />
              Explainable readiness measures
            </span>
            <span>
              <Users />
              Manager-led improvement
            </span>
          </div>
        </div>
        <DemoForm />
      </section>
    </>
  );
}
function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="WHY OPSSIM AFRICA"
        title={
          <>
            Practice should happen
            <br />
            before the costly mistake.
          </>
        }
        body="We are building practical operational training for the people who keep African businesses running—one accountable workflow at a time."
      />
      <section className="site-container about-main">
        <div>
          <h2>Real operating conditions. A safer place to learn.</h2>
          <p>
            A missed expiry, an incorrect count or a carton placed on the wrong shelf can create
            work for everyone downstream. Written instructions help, but staff also need a chance to
            notice the problem and make the decision themselves.
          </p>
          <p>
            VR provides a repeatable practice setting without putting real inventory or customers at
            risk. It is a tool for rehearsal and coaching—not a replacement for supervisors,
            workplace procedures or professional judgement.
          </p>
          <p>
            Our first lesson is deliberately focused: receiving a supplier delivery at BrightMart
            Mini Store. Its concrete tasks, unit counts and explainable feedback are designed for
            the realities of small retail and pharmacy-style operations.
          </p>
        </div>
        <div className="about-principles">
          <article>
            <Box />
            <h3>Practical before impressive.</h3>
            <p>A clear next action matters more than a futuristic effect.</p>
          </article>
          <article>
            <ChartNoAxesCombined />
            <h3>Evidence before claims.</h3>
            <p>Show what was tested. Do not invent pilot results or promise guaranteed savings.</p>
          </article>
          <article>
            <Users />
            <h3>People stay in control.</h3>
            <p>Managers interpret practice results and decide the next coaching step.</p>
          </article>
        </div>
      </section>
      <section className="site-section site-soft">
        <div className="site-container about-responsibility">
          <SectionHeading eyebrow="RESPONSIBLE BY DESIGN" title="Clear limits are part of trust." />
          <div>
            <h3>Scoring and responsible AI</h3>
            <p>
              The MVP uses deterministic scenario rules and an explicit scoring rubric. No AI makes
              hiring or staffing decisions. Scores describe performance in a fictional practice
              scenario, not certification or guaranteed workplace competence.
            </p>
            <h3>Honest visuals and product status</h3>
            <p>
              Promotional renderings are labelled illustrative. Actual application views are
              identified as product screenshots. Physical headset testing, comfort and passthrough
              remain separate validation gates. We do not claim Meta endorsement or a completed Meta
              SDK integration.
            </p>
          </div>
        </div>
      </section>
      <section id="privacy" className="site-section site-container privacy-section">
        <SectionHeading
          eyebrow="PRIVACY & DATA USE"
          title="Only the information needed for your request."
        />
        <div>
          <h3>Demo and waitlist requests</h3>
          <p>
            We collect your name, business name, email, optional phone, industry, team size and
            operational challenge so the team can respond. Consent is recorded with the request.
            Public visitors and demo-manager roles cannot list this contact information through the
            website API.
          </p>
          <h3>Retention and follow-up</h3>
          <p>
            Requests older than 90 days are removed during service startup and new-request
            processing. There is no automatic marketing subscription, booking or external message.
            To ask about or request deletion of your information, submit the contact form with the
            same email and explain the request.
          </p>
          <h3>Practice data</h3>
          <p>
            The practice workspace uses fictional learners and clearly labelled synthetic examples.
            Demo roles and invitation codes are not secure permissions. Do not enter confidential
            employee, customer, payment or medical information into the public practice workspace.
          </p>
          <h3>Local preferences</h3>
          <p>
            The browser may remember practice preferences and unfinished form drafts on your device.
            No advertising trackers are included in this build. Production hosting and any later
            third-party services must be reviewed before a private deployment.
          </p>
        </div>
      </section>
      <div className="site-container">
        <CallToAction />
      </div>
    </>
  );
}
function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="LET’S TALK ABOUT THE WORK"
        title={
          <>
            A practical first step
            <br />
            for your team.
          </>
        }
        body="Request a product demo or join the scenario waitlist. Tell us about the operation you want staff to practise."
      />
      <section className="site-container contact-grid">
        <DemoForm />
        <aside className="contact-faq">
          <span className="site-card-icon">
            <Headset size={28} />
          </span>
          <h2>A few useful answers.</h2>
          {[
            [
              'What is available today?',
              'The focused BrightMart stock receiving MVP, including desktop/touch practice and a hands-only WebXR implementation. Other full immersive scenarios are on the roadmap.',
            ],
            [
              'Do I need a headset to try it?',
              'No. Desktop and touch practice work in the browser. Immersive hands require a compatible headset browser, direct HTTPS access and hand tracking.',
            ],
            [
              'Is this a confirmed booking?',
              'No. The form saves a request and gives you a reference. The team must confirm any demo appointment separately.',
            ],
            [
              'Can we use our own products?',
              'Product-list imports and custom receiving checklists are planned. The current lesson uses a fixed, fictional BrightMart dataset.',
            ],
            [
              'Are the business outcomes guaranteed?',
              'No. OpsSim is designed to support practice and coaching. Any reduction in errors or onboarding time needs to be measured in a real pilot.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </aside>
      </section>
      <section className="site-container contact-practice">
        <span>
          <Hand size={24} />
          Want to see the workflow first?
        </span>
        {btn('Try the practice lab', '/app#brightmart', true)}
      </section>
    </>
  );
}
export default function Site() {
  const page =
    (Object.keys(paths) as SitePage[]).find(
      (k) =>
        paths[k] === location.pathname.replace(/\/$/, '') ||
        (k === 'home' && location.pathname === '/'),
    ) || 'home';
  const [menu, setMenu] = useState(false),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    document.title = `${pageTitles[page]} | OpsSim Africa`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'OpsSim Africa helps African retail and operations teams practise receiving, catch exceptions and measure readiness. Request a business demo.',
      );
  }, [page]);
  return (
    <div className="business-site">
      <a href="#site-main" className="site-skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-container site-nav">
          <a href="/" aria-label="OpsSim Africa home">
            <Brand />
          </a>
          <nav aria-label="Website navigation" className={menu ? 'open' : ''}>
            {nav.map(([key, label]) => (
              <a key={key} href={paths[key]} aria-current={page === key ? 'page' : undefined}>
                {label}
              </a>
            ))}
            <a href="/contact" className="site-mobile-contact">
              Book a Demo <ArrowUpRight size={17} />
            </a>
          </nav>
          <div className="site-nav-actions">
            <a className="site-workspace-link" href="/app#brightmart">
              Try practice <ArrowUpRight size={15} />
            </a>
            {btn('Book a Demo')}
            <button
              className="site-menu-button"
              aria-label={menu ? 'Close website menu' : 'Open website menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="site-main">
        {page === 'home' ? (
          <HomePage watch={() => setDemo(true)} />
        ) : page === 'product' ? (
          <ProductPage watch={() => setDemo(true)} />
        ) : page === 'scenarios' ? (
          <ScenariosPage />
        ) : page === 'businesses' ? (
          <BusinessesPage />
        ) : page === 'about' ? (
          <AboutPage />
        ) : (
          <ContactPage />
        )}
      </main>
      <footer className="site-footer">
        <div className="site-container footer-main">
          <div>
            <a href="/" aria-label="OpsSim Africa home">
              <Brand light />
            </a>
            <p>
              Real work. Rehearsed.
              <br />
              Practical readiness for African operations teams.
            </p>
            <span className="footer-built">
              <span />
              Built for the work in front of you.
            </span>
          </div>
          <nav aria-label="Product links">
            <strong>Explore</strong>
            <a href="/product">Product</a>
            <a href="/scenarios">Scenarios</a>
            <a href="/app#brightmart">Practice lab</a>
          </nav>
          <nav aria-label="Business links">
            <strong>For your business</strong>
            <a href="/for-businesses">For businesses</a>
            <a href="/about">Why OpsSim</a>
            <a href="/contact">Book a Demo</a>
            <a href="/contact?intent=waitlist">Join the waitlist</a>
          </nav>
          <div className="footer-note">
            <ShieldCheck size={24} />
            <strong>Practice, not promises.</strong>
            <p>
              One focused receiving MVP. Clear feedback. No fabricated pilot results or guaranteed
              outcomes.
            </p>
          </div>
        </div>
        <div className="site-container footer-bottom">
          <span>© 2026 OpsSim Africa</span>
          <div>
            <a href="/about#privacy">Privacy & data use</a>
            <a href="/third-party-notices.txt">Third-party notices</a>
          </div>
          <span>Independent product. Not endorsed by Meta.</span>
        </div>
      </footer>
      {demo && <DemoDialog close={() => setDemo(false)} />}
    </div>
  );
}
