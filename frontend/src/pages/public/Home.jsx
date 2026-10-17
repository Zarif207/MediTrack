/**
 * Public homepage.
 *
 * Departments and doctors come from the API. Every other statement on this
 * page describes what the app actually does (30-minute slots 09:00–17:00, up to
 * 180 days ahead, online cancellation, role-based privacy). No statistics,
 * reviews, addresses or credentials are invented. Photos are licensed Unsplash
 * images of staged clinic scenes (see public/images/home/CREDITS.md) and are
 * never paired with real doctors' names.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import {
  RiArrowRightLine, RiArrowRightUpLine, RiBodyScanLine, RiBrainLine, RiCalendarCheckLine,
  RiCalendarScheduleLine, RiCapsuleLine, RiEyeLine, RiFileList3Line, RiHandHeartLine,
  RiHeartPulseLine, RiHospitalLine, RiLock2Line, RiLungsLine, RiMicroscopeLine, RiParentLine,
  RiStethoscopeLine, RiTimeLine, RiUserVoiceLine, RiWomenLine, RiBillLine, RiAddLine,
} from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../context/useAuth'
import { doctorName, initials, sentenceCase } from '../../utils/format'

const IMG = '/images/home'

const FACTS = [
  [RiTimeLine, '30-minute appointments', '09:00 – 17:00'],
  [RiCalendarCheckLine, 'Book up to 180 days ahead', 'Only free times are shown'],
  [RiCalendarScheduleLine, 'Cancel online', 'Any time before your visit'],
]

const BENEFITS = [
  [RiCalendarScheduleLine, 'Times that are really free',
    'Choose a doctor and a day, and you see only the slots nobody has taken. A time disappears the moment it is booked.'],
  [RiHandHeartLine, 'Book before your first visit',
    'You do not need a patient file to book. The clinic links your account to your file later, without holding up your appointment.'],
  [RiFileList3Line, 'Your visit, kept together',
    'Appointments, your doctor’s visit notes, prescriptions and bills sit in one account instead of on scraps of paper.'],
  [RiLock2Line, 'Private by design',
    'You see only your own information, and staff see only what their role needs. The server enforces it — it is not just hidden on screen.'],
]

const STEPS = [
  ['Create your account', 'Sign up with your email. The clinic confirms it as a patient account.'],
  ['Pick a doctor and an open time', 'Filter by department, choose a day, and take any free 30-minute slot.'],
  ['Keep track of your care', 'Your booking is saved straight away. Records, prescriptions and bills follow after the visit.'],
]

const IN_ACCOUNT = [
  [RiCalendarCheckLine, 'Appointments', 'Upcoming and past, with cancellation'],
  [RiFileList3Line, 'Visit records', 'Diagnosis and treatment notes'],
  [RiCapsuleLine, 'Prescriptions', 'Dosage, frequency and duration'],
  [RiBillLine, 'Bills', 'What was charged and what is paid'],
]

const FAQ = [
  ['Do I need a patient file before I can book?',
    'No. Once your account has patient access you can book immediately. The clinic links your account to your patient file separately, after which visit records and bills appear in your account.'],
  ['Who can see my information?',
    'You see only appointments, records, prescriptions and bills that belong to you. Staff see only what their role requires — for example, billing staff cannot read clinical notes, and doctors see only their own patients’ visits.'],
  ['How long are appointment slots?',
    'Online booking offers 30-minute slots between 9:00 and 17:00, up to 180 days ahead. A time disappears as soon as someone books it.'],
  ['Can I use MediTrack in an emergency?',
    'No. MediTrack is an academic project, not a real clinic. In an emergency contact your local emergency number.'],
]

// Icon for a department, chosen from its name. Unknown names get a neutral icon.
const DEPT_ICONS = [
  [/cardi|heart/i, RiHeartPulseLine],
  [/neur|brain/i, RiBrainLine],
  [/ortho|bone|spine/i, RiBodyScanLine],
  [/pediat|paediat|child/i, RiParentLine],
  [/onco|cancer|patho/i, RiMicroscopeLine],
  [/gastro|digest/i, RiCapsuleLine],
  [/ent\b|otolaryn|ear|throat/i, RiUserVoiceLine],
  [/ophthal|eye/i, RiEyeLine],
  [/gyn|obst|matern/i, RiWomenLine],
  [/pulmo|respir|lung/i, RiLungsLine],
]
const deptIcon = (name = '') => DEPT_ICONS.find(([re]) => re.test(name))?.[1] ?? RiStethoscopeLine

/** Photo with responsive sources, a soft placeholder, and a calm fallback if it fails to load. */
function Photo({ name, widths = [800, 1600], alt, sizes, priority = false, className = '', position = 'center' }) {
  const [state, setState] = useState('loading')
  const [small, large] = widths
  return (
    <div className={`relative overflow-hidden bg-sage-300/40 ${className}`}>
      {state === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-mint-100 to-sage-300/60 text-pine-700">
          <RiHospitalLine aria-hidden size={40} className="opacity-60" />
        </div>
      ) : (
        <img
          src={`${IMG}/${name}-${small}.jpg`}
          srcSet={`${IMG}/${name}-${small}.jpg ${small}w, ${IMG}/${name}-${large}.jpg ${large}w`}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          style={{ objectPosition: position }}
          className={`h-full w-full object-cover transition-opacity duration-500 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

/** Fades content in as it scrolls into view; static when reduced motion is preferred. */
function Reveal({ children, delay = 0, className = '' }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** A small field of plus marks — the brand mark, used as quiet texture. */
function PlusField({ className = '' }) {
  return (
    <svg aria-hidden className={className} width="132" height="132" viewBox="0 0 132 132">
      {Array.from({ length: 36 }, (_, i) => {
        const x = (i % 6) * 22 + 11
        const y = Math.floor(i / 6) * 22 + 11
        return <path key={i} d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      })}
    </svg>
  )
}

function Eyebrow({ children, tone = 'dark' }) {
  return (
    <p className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] ${tone === 'light' ? 'text-mint-200' : 'text-pine-700'}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-clay-400" />
      {children}
    </p>
  )
}

const btnBase = 'inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-[15px] font-medium transition-all duration-200 focus-visible:outline-offset-4'
const btnPrimary = `${btnBase} bg-pine-800 text-white hover:bg-pine-900 hover:shadow-[0_8px_24px_-8px_rgb(16_44_37/0.5)]`
const btnSecondary = `${btnBase} border border-ink-200 bg-surface text-ink-900 hover:border-ink-300 hover:bg-cream-50`

// ── Sections ──────────────────────────────────────────────────────────────────

function Hero() {
  const reduce = useReducedMotion()
  const rise = (delay) => (reduce ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
  })

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-6 lg:pt-6">
          <motion.div {...rise(0)}><Eyebrow>Hospital appointments · patient portal</Eyebrow></motion.div>
          <motion.h1 {...rise(0.05)} id="hero-title"
            className="mt-6 font-serif text-[2.6rem] font-medium leading-[1.04] tracking-[-0.025em] text-ink-900 sm:text-[3.4rem] lg:text-[4rem]">
            Your hospital visit,{' '}
            <span className="relative inline-block italic text-pine-800">
              booked in minutes
              <svg aria-hidden viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-clay-400">
                <path d="M2 9c48-6 98-8 148-6s100 5 148 1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>.
          </motion.h1>
          <motion.p {...rise(0.12)} className="mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink-600 sm:text-lg">
            Choose a department and a doctor, take a time that is genuinely free, and keep your appointments,
            visit notes, prescriptions and bills together in one private account.
          </motion.p>
          <motion.div {...rise(0.18)} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/appointments/book" className={btnPrimary}>
              Book an appointment <RiArrowRightLine aria-hidden size={18} />
            </Link>
            <Link to="/public/doctors" className={btnSecondary}>Meet our doctors</Link>
          </motion.div>
        </div>

        {/* Image composition */}
        <motion.div {...rise(0.1)} className="relative lg:col-span-6">
          <div aria-hidden className="absolute -right-24 top-10 hidden h-[88%] w-[78%] rounded-[2.5rem] bg-cream-100 lg:block" />
          <PlusField className="absolute -left-6 -top-6 hidden text-sage-300 lg:block" />
          <div className="relative mx-auto max-w-[30rem] lg:ml-auto lg:mr-4">
            <Photo
              name="hero-consultation"
              priority
              sizes="(min-width: 1024px) 480px, 92vw"
              position="62% 50%"
              alt="A doctor at her desk talks through a visit with an older man and a young boy"
              className="aspect-[4/5] rounded-t-[14rem] rounded-b-[1.75rem] shadow-[0_30px_60px_-30px_rgb(16_44_37/0.45)]"
            />
            <div className="absolute -bottom-6 -left-3 w-28 sm:w-36 lg:-left-12 lg:w-44">
              <Photo
                name="detail-stethoscope"
                widths={[800, 800]}
                sizes="176px"
                position="55% 50%"
                alt="A doctor's hand holding a stethoscope to a patient's chest"
                className="aspect-square rounded-2xl border-[5px] border-paper shadow-[0_18px_40px_-20px_rgb(16_44_37/0.5)]"
              />
            </div>
            <div className="absolute -right-2 top-8 w-[14.5rem] rounded-2xl border border-ink-100 bg-surface/95 p-4 shadow-float sm:-right-6 lg:-right-10 lg:top-14">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-100 text-pine-700">
                  <RiCalendarCheckLine aria-hidden size={18} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">Online booking</p>
                  <p className="text-xs text-ink-500">See only the times still free</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Facts strip */}
      <div className="border-y border-ink-100 bg-cream-50">
        <ul className="mx-auto grid max-w-6xl divide-y divide-ink-100 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {FACTS.map(([Icon, title, sub]) => (
            <li key={title} className="flex items-center gap-4 py-5 sm:justify-center sm:px-6">
              <Icon aria-hidden size={22} className="shrink-0 text-pine-600" />
              <div>
                <p className="text-sm font-medium text-ink-900">{title}</p>
                <p className="text-[13px] text-ink-500">{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Departments({ departments, doctors, loading, error }) {
  const counts = doctors.reduce((m, d) => ({ ...m, [d.department_id]: (m[d.department_id] ?? 0) + 1 }), {})
  const shown = departments.slice(0, 5)

  return (
    <section aria-labelledby="care-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <Reveal className="mb-12 grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <Eyebrow>Departments</Eyebrow>
          <h2 id="care-title" className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
            Start with the care you need.
          </h2>
        </div>
        <p className="text-[15.5px] leading-relaxed text-ink-600 lg:col-span-5">
          Every doctor belongs to a department. Pick the area that matches your concern and you will see who you can book.
        </p>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-48 animate-pulse rounded-3xl bg-cream-100" />)}
        </div>
      ) : error ? (
        <p className="rounded-3xl border border-ink-100 bg-cream-50 px-6 py-8 text-sm text-ink-600">
          Departments could not be loaded right now. Please try again later.
        </p>
      ) : departments.length === 0 ? (
        <p className="rounded-3xl border border-ink-100 bg-cream-50 px-6 py-8 text-sm text-ink-600">No departments have been published yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Reveal className="h-full">
              <div className="relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-3xl bg-pine-800 p-7 text-white">
                <PlusField className="absolute -bottom-8 -right-8 text-pine-600" />
                <div className="relative">
                  <p className="font-serif text-[3.25rem] font-medium leading-none">{departments.length}</p>
                  <p className="mt-2 text-[15px] text-pine-100">
                    department{departments.length === 1 ? '' : 's'} · {doctors.length} doctor{doctors.length === 1 ? '' : 's'} you can book online
                  </p>
                </div>
                <Link to="/public/departments" className="relative mt-8 inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20">
                  Browse all departments <RiArrowRightLine aria-hidden size={16} />
                </Link>
              </div>
            </Reveal>
          </li>
          {shown.map((d, i) => {
            const Icon = deptIcon(d.department_name)
            const n = counts[d.department_id] ?? 0
            return (
              <li key={d.department_id}>
                <Reveal delay={0.04 * (i + 1)} className="h-full">
                  <Link to="/public/departments"
                    className="group flex h-full min-h-56 flex-col rounded-3xl border border-ink-100 bg-surface p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-sage-300 hover:shadow-[0_18px_40px_-24px_rgb(16_44_37/0.35)]">
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-100 text-pine-700 transition-colors group-hover:bg-mint-200">
                        <Icon aria-hidden size={23} />
                      </span>
                      <RiArrowRightUpLine aria-hidden size={20} className="text-ink-300 transition-colors group-hover:text-pine-700" />
                    </div>
                    <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{d.department_name}</h3>
                    {d.description && <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-600">{sentenceCase(d.description)}</p>}
                    <p className="mt-auto pt-5 text-[13px] text-ink-500">
                      {n ? `${n} doctor${n === 1 ? '' : 's'}` : 'No doctors listed yet'}
                    </p>
                  </Link>
                </Reveal>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function WhyMediTrack() {
  return (
    <section aria-labelledby="why-title" className="bg-cream-50">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-28">
        <Reveal className="relative lg:col-span-5">
          <Photo
            name="care-conversation"
            sizes="(min-width: 1024px) 440px, 92vw"
            position="40% 30%"
            alt="A smiling doctor in a white coat talks with a patient in an examination room"
            className="aspect-[4/3] rounded-[2rem] rounded-tr-[6rem] sm:rounded-tr-[9rem] lg:aspect-[4/5]"
          />
          <div className="absolute -bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl bg-pine-900 px-5 py-4 text-white shadow-float sm:left-8 sm:right-auto sm:max-w-xs">
            <RiLock2Line aria-hidden size={20} className="shrink-0 text-mint-200" />
            <p className="text-[13.5px] leading-snug">Only you can open your appointments, records and bills.</p>
          </div>
        </Reveal>

        <div className="lg:col-span-7 lg:pl-10">
          <Reveal>
            <Eyebrow>Why MediTrack</Eyebrow>
            <h2 id="why-title" className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
              Less waiting on the phone. <span className="italic text-pine-800">More clarity</span> about your care.
            </h2>
          </Reveal>
          <dl className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {BENEFITS.map(([Icon, title, body], i) => (
              <Reveal key={title} delay={0.05 * i}>
                <dt className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sage-300 text-pine-700">
                    <Icon aria-hidden size={19} />
                  </span>
                  <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink-900">{title}</span>
                </dt>
                <dd className="mt-3 text-[14.5px] leading-relaxed text-ink-600">{body}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative scroll-mt-16 overflow-hidden bg-pine-900 text-white">
      <PlusField className="absolute right-6 top-8 text-pine-700" />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:py-28">
        <div className="lg:col-span-6">
          <Reveal>
            <Eyebrow tone="light">How booking works</Eyebrow>
            <h2 id="how-title" className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-[2.6rem]">
              Three steps from “I should see someone” to a confirmed time.
            </h2>
          </Reveal>
          <ol className="mt-12 space-y-0">
            {STEPS.map(([title, body], i) => (
              <Reveal key={title} delay={0.06 * i}>
                <li className="grid grid-cols-[3.25rem_1fr] gap-4 border-t border-white/10 py-6">
                  <span className="font-serif text-[1.9rem] italic leading-none text-mint-200">0{i + 1}</span>
                  <div>
                    <p className="text-[17px] font-semibold text-white">{title}</p>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-pine-100/80">{body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-8">
            <Link to="/appointments/book"
              className={`${btnBase} bg-cream-50 text-pine-900 hover:bg-white hover:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)]`}>
              Start booking <RiArrowRightLine aria-hidden size={18} />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="relative lg:col-span-6 lg:pt-16">
          <Photo
            name="consult-desk"
            sizes="(min-width: 1024px) 540px, 92vw"
            position="50% 40%"
            alt="A doctor writes notes during a consultation with a patient across the desk"
            className="aspect-[5/4] rounded-[1.75rem] ring-1 ring-white/10"
          />
          <div className="relative -mt-16 ml-auto w-[92%] rounded-2xl bg-cream-50 p-5 text-ink-900 shadow-float sm:w-80 lg:-mr-6">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">In your account</p>
            <ul className="mt-3 space-y-3">
              {IN_ACCOUNT.map(([Icon, title, sub]) => (
                <li key={title} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint-100 text-pine-700"><Icon aria-hidden size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{title}</span>
                    <span className="block truncate text-xs text-ink-500">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Doctors({ doctors, departments }) {
  if (!doctors.length) return null
  const deptName = Object.fromEntries(departments.map((d) => [d.department_id, d.department_name]))
  return (
    <section aria-labelledby="doctors-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <Reveal className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Doctors</Eyebrow>
          <h2 id="doctors-title" className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
            The people you can book.
          </h2>
        </div>
        <Link to="/public/doctors" className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-pine-800">
          Full directory <RiArrowRightLine aria-hidden size={17} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {doctors.slice(0, 8).map((d, i) => (
          <li key={d.doctor_id}>
            <Reveal delay={0.03 * i} className="h-full">
              <div className="flex h-full items-start gap-4 rounded-2xl border border-ink-100 bg-surface p-5">
                <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                  i % 3 === 0 ? 'bg-mint-100 text-pine-800' : i % 3 === 1 ? 'bg-cream-100 text-clay-600' : 'bg-pine-50 text-pine-700'}`}>
                  {initials(`${d.first_name} ${d.last_name}`)}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink-900">{doctorName(d)}</p>
                  <p className="text-[13.5px] text-ink-600">{sentenceCase(d.specialization)}</p>
                  {deptName[d.department_id] && <p className="mt-1 text-xs text-ink-500">{deptName[d.department_id]}</p>}
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Questions() {
  return (
    <section aria-labelledby="faq-title" className="border-t border-ink-100 bg-cream-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
        <Reveal className="lg:col-span-4">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="faq-title" className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.1] tracking-[-0.02em]">Before you book.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
            Straight answers about how booking, records and privacy work in MediTrack.
          </p>
        </Reveal>
        <div className="divide-y divide-ink-200/70 border-y border-ink-200/70 lg:col-span-8">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md text-[16.5px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-all group-open:rotate-45 group-open:border-pine-600 group-open:text-pine-700">
                  <RiAddLine size={17} />
                </span>
              </summary>
              <p className="mt-3 max-w-2xl pr-12 text-[15px] leading-relaxed text-ink-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  const { status } = useAuth()
  const signedIn = status === 'ready' || status === 'error'
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <Reveal>
        <div className="grid overflow-hidden rounded-[2rem] bg-mint-100 lg:grid-cols-12">
          <div className="relative flex flex-col justify-center px-7 py-12 sm:px-12 lg:col-span-7 lg:py-16">
            <PlusField className="absolute -left-4 -top-4 text-mint-200" />
            <h2 id="cta-title" className="relative font-serif text-[2.3rem] font-medium leading-[1.06] tracking-[-0.02em] text-ink-900 sm:text-[3rem]">
              Ready when <span className="italic text-pine-800">you are.</span>
            </h2>
            <p className="relative mt-5 max-w-md text-[16px] leading-relaxed text-ink-700">
              Find a doctor, choose a free time, and have your visit in your account in a couple of minutes.
            </p>
            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/appointments/book" className={btnPrimary}>
                Book an appointment <RiArrowRightLine aria-hidden size={18} />
              </Link>
              {signedIn
                ? <Link to="/dashboard" className={btnSecondary}>Open MediTrack</Link>
                : <Link to="/auth/sign-up" className={btnSecondary}>Create an account</Link>}
            </div>
          </div>
          <Photo
            name="waiting-room"
            widths={[700, 1200]}
            sizes="(min-width: 1024px) 420px, 100vw"
            position="50% 60%"
            alt="A calm, light clinic waiting area where a woman sits reading"
            className="h-72 sm:h-96 lg:col-span-5 lg:h-full lg:min-h-[30rem]"
          />
        </div>
      </Reveal>
      <p className="mt-4 text-xs text-ink-500">
        Photography: Vitaly Gariev, National Cancer Institute and Caroline Badran on Unsplash. Pictures show
        staged clinic scenes, not MediTrack staff or patients.
      </p>
    </section>
  )
}

export default function Home() {
  const { data, loading, error } = useAsync(() => Promise.all([departmentsApi.listAll(), doctorsApi.listAll()]), [])
  const [departments, doctors] = data ?? [[], []]

  return (
    <>
      <Hero />
      <Departments departments={departments} doctors={doctors} loading={loading} error={error} />
      <WhyMediTrack />
      <HowItWorks />
      {!loading && !error && <Doctors doctors={doctors} departments={departments} />}
      <Questions />
      <ClosingCta />
    </>
  )
}
