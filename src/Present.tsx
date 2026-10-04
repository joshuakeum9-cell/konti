import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { getSong, slideUrl, verses, type Song } from './data'
import { useT } from './i18n'
import type { Konti } from './store'

type Step = { kind: 'slide'; item: number; song: Song; n: number } | { kind: 'gap'; item: number }

export function buildSequence(k: Konti): Step[] {
  const seq: Step[] = []
  k.items.forEach((it, item) => {
    const song = getSong(it.id)
    if (!song) return
    const skip = new Set(it.skip)
    const slides: Step[] = []
    for (let n = 1; n <= song.slides; n++) if (!skip.has(n)) slides.push({ kind: 'slide', item, song, n })
    if (!slides.length) return
    if (k.gap && seq.length) seq.push({ kind: 'gap', item })
    seq.push(...slides)
  })
  return seq
}

const isFullscreen = () => !!document.fullscreenElement

export function enterFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {})
}

export function Present({ konti, startItem, onExit }: { konti: Konti; startItem: number; onExit: () => void }) {
  const { t } = useT()
  const seq = useMemo(() => buildSequence(konti), [konti])
  const [idx, setIdx] = useState(() => {
    const i = seq.findIndex((s) => s.kind === 'slide' && s.item >= startItem)
    return i < 0 ? 0 : i
  })
  const [black, setBlack] = useState(false)
  const [ui, setUi] = useState(true)
  const [help, setHelp] = useState(false)
  const hideTimer = useRef<number>(0)
  const wasFull = useRef(false)

  const step = seq[idx] as Step | undefined // undefined = end of set
  const curItem = step ? step.item : konti.items.length

  // first and last step of each song
  const starts = useMemo(() => {
    const m = new Map<number, number>()
    seq.forEach((s, i) => {
      if (s.kind === 'slide' && !m.has(s.item)) m.set(s.item, i)
    })
    return m
  }, [seq])
  const itemOrder = [...starts.keys()]

  const go = (i: number) => {
    setBlack(false)
    setIdx(Math.max(0, Math.min(seq.length, i)))
  }
  const next = () => go(idx + 1)
  const prev = () => go(idx - 1)
  const songStart = (item: number) => starts.get(item) ?? idx
  const nextSong = () => {
    const after = itemOrder.find((i) => i > curItem)
    go(after === undefined ? seq.length : songStart(after))
  }
  const prevSong = () => {
    const here = starts.get(curItem)
    if (here !== undefined && idx > here) return go(here)
    const before = [...itemOrder].reverse().find((i) => i < curItem)
    if (before !== undefined) go(songStart(before))
  }
  const toVerse = (v: number) => {
    if (!step || step.kind !== 'slide') return
    const vs = verses(step.song)
    const range = vs[v - 1]
    if (!range) return
    const i = seq.findIndex((s) => s.kind === 'slide' && s.item === step.item && s.n >= range.start && s.n <= range.end)
    if (i >= 0) go(i)
  }

  const poke = () => {
    setUi(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setUi(false), 2500)
  }

  // keyboard: presentation clickers send PageDown / PageUp (some send arrows or B)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const k = e.key
      if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter' || k === 'n') next()
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace' || k === 'p') prev()
      else if (k === 'ArrowDown') nextSong()
      else if (k === 'ArrowUp') prevSong()
      else if (k === 'Home') go(0)
      else if (k === 'End') go(seq.length - 1)
      else if (k === 'b' || k === 'B' || k === '.' || k === 'w' || k === 'W') setBlack((b) => !b)
      else if (k === 'f' || k === 'F') isFullscreen() ? document.exitFullscreen() : enterFullscreen()
      else if (k === 'Escape') onExit()
      else if (k === '?' || k === 'h') setHelp((h) => !h)
      else if (/^[1-9]$/.test(k)) toVerse(Number(k))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // leaving full screen (Esc in the browser) ends the presentation
  useEffect(() => {
    const onFs = () => {
      if (isFullscreen()) wasFull.current = true
      else if (wasFull.current) onExit()
    }
    document.addEventListener('fullscreenchange', onFs)
    wasFull.current = isFullscreen()
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [onExit])

  useEffect(() => {
    poke()
    return () => clearTimeout(hideTimer.current)
  }, [])

  // keep the next few slides decoded so changes are instant
  const keep = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    keep.current = []
    for (let i = idx - 1; i <= idx + 3; i++) {
      const s = seq[i]
      if (s?.kind === 'slide') {
        const im = new Image()
        im.src = slideUrl(s.song, s.n)
        im.decode?.().catch(() => {})
        keep.current.push(im)
      }
    }
  }, [idx, seq])

  // touch: swipe left / right
  const touchX = useRef<number | null>(null)

  const onStageClick = (e: MouseEvent) => {
    poke()
    const x = e.clientX / window.innerWidth
    if (x < 0.3) prev()
    else next()
  }

  return (
    <div
      class={'present' + (ui ? '' : ' idle')}
      onMouseMove={poke}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current
        touchX.current = null
        if (x0 === null) return
        const dx = e.changedTouches[0].clientX - x0
        if (Math.abs(dx) > 50) {
          e.preventDefault()
          dx < 0 ? next() : prev()
        }
      }}
    >
      <div class="stage" onClick={onStageClick}>
        {step?.kind === 'slide' && !black && (
          <img class="slide" src={slideUrl(step.song, step.n)} alt="" draggable={false} />
        )}
        {!step && ui && <div class="end-note">{t.end}</div>}
      </div>

      {/* no on-screen controls while presenting; a hidden corner button ends it on touch screens */}
      <button class="corner-exit" onClick={onExit} aria-label={t.exit} title={t.exit}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {help && (
        <div class="help" onClick={() => setHelp(false)}>
          <h3>{t.keys}</h3>
          <dl>
            {t.keyHelp.map(([k, v]) => (
              <>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
