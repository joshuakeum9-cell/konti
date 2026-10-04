import { useRef, useState } from 'preact/hooks'
import { getSong, thumbUrl, verses, type Song } from './data'
import { useT } from './i18n'
import { Thumb, songLabel } from './Library'
import { moveItem, removeItem, setGap, setSkip, setTitle, shareLink, useStore, type Item } from './store'

type Drag = { from: number; to: number; dy: number; h: number; mids: number[]; y0: number }

export function SetPanel({ onPresent, toast }: { onPresent: (fromItem: number) => void; toast: (m: string) => void }) {
  const { t } = useT()
  const { current } = useStore()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const list = useRef<HTMLOListElement>(null)
  const items = current.items

  const startDrag = (e: PointerEvent, i: number) => {
    const rows = [...(list.current?.children ?? [])] as HTMLElement[]
    const rects = rows.map((r) => r.getBoundingClientRect())
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ from: i, to: i, dy: 0, h: rects[i].height + 8, mids: rects.map((r) => r.top + r.height / 2), y0: e.clientY })
    e.preventDefault()
  }
  const moveDrag = (e: PointerEvent) => {
    if (!drag) return
    const dy = e.clientY - drag.y0
    const y = drag.mids[drag.from] + dy
    // the new index is the number of other rows whose middle is above the dragged row's middle
    let above = 0
    drag.mids.forEach((m, j) => {
      if (j !== drag.from && m < y) above++
    })
    setDrag({ ...drag, dy, to: above })
  }
  const endDrag = () => {
    if (drag && drag.to !== drag.from) moveItem(drag.from, drag.to)
    setDrag(null)
  }

  const shiftFor = (i: number) => {
    if (!drag || i === drag.from) return 0
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.h
    return 0
  }

  const copyLink = async () => {
    const url = shareLink(current)
    try {
      await navigator.clipboard.writeText(url)
      toast(t.copied)
    } catch {
      prompt(t.share, url)
    }
  }

  return (
    <section class="setpanel">
      <div class="set-head">
        <input class="set-title" value={current.title} aria-label={t.title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        <div class="set-meta">
          <span>{t.songs(items.length)}</span>
          <label class="check">
            <input type="checkbox" checked={current.gap} onChange={(e) => setGap((e.target as HTMLInputElement).checked)} />
            {t.gap}
          </label>
        </div>
      </div>

      {items.length ? (
        <ol class={'items' + (drag ? ' dragging' : '')} ref={list}>
          {items.map((it, i) => {
            const song = getSong(it.id)
            if (!song) return null
            const style = drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : { transform: `translateY(${shiftFor(i)}px)` }
            return (
              <li class={'item' + (drag?.from === i ? ' lifted' : '')} key={it.key} style={style}>
                <ItemRow
                  item={it}
                  song={song}
                  index={i}
                  count={items.length}
                  open={open === it.key}
                  onToggle={() => setOpen(open === it.key ? null : it.key)}
                  onHandleDown={(e) => startDrag(e, i)}
                  onHandleMove={moveDrag}
                  onHandleUp={endDrag}
                  onPresent={() => onPresent(i)}
                />
              </li>
            )
          })}
        </ol>
      ) : (
        <div class="set-empty">
          <p>{t.emptySet}</p>
          <p class="muted">{t.emptySetHint}</p>
        </div>
      )}

      <div class="set-foot">
        <button class="ghost" onClick={copyLink} disabled={!items.length}>
          {t.share}
        </button>
        <button class="primary big" onClick={() => onPresent(0)} disabled={!items.length}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
          {t.present}
        </button>
      </div>
    </section>
  )
}

function ItemRow(p: {
  item: Item
  song: Song
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onHandleDown: (e: PointerEvent) => void
  onHandleMove: (e: PointerEvent) => void
  onHandleUp: () => void
  onPresent: () => void
}) {
  const { t } = useT()
  const { item, song } = p
  const skip = new Set(item.skip)
  const vs = verses(song)
  const firstIncluded = Array.from({ length: song.slides }, (_, i) => i + 1).find((n) => !skip.has(n)) ?? 1
  const included = song.slides - item.skip.filter((n) => n <= song.slides).length

  const verseState = (start: number, end: number) => {
    let on = 0
    for (let n = start; n <= end; n++) if (!skip.has(n)) on++
    return on === 0 ? 'off' : on === end - start + 1 ? 'on' : 'part'
  }
  const toggleVerse = (start: number, end: number) => {
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i)
    const st = verseState(start, end)
    setSkip(item.key, st === 'off' ? item.skip.filter((n) => n < start || n > end) : [...item.skip, ...range])
  }
  const toggleSlide = (n: number) =>
    setSkip(item.key, skip.has(n) ? item.skip.filter((x) => x !== n) : [...item.skip, n])

  return (
    <div class="item-inner">
      <div class="item-row">
        <button
          class="handle"
          aria-label={`${t.up} / ${t.down}`}
          onPointerDown={p.onHandleDown}
          onPointerMove={p.onHandleMove}
          onPointerUp={p.onHandleUp}
          onPointerCancel={p.onHandleUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && p.index > 0) moveItem(p.index, p.index - 1)
            if (e.key === 'ArrowDown' && p.index < p.count - 1) moveItem(p.index, p.index + 1)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="6" r="1.4" />
            <circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" />
            <circle cx="15" cy="18" r="1.4" />
          </svg>
        </button>
        <span class="item-no">{p.index + 1}</span>
        <button class="item-thumb" onClick={p.onToggle} aria-expanded={p.open} title={t.pickSlides}>
          <Thumb song={song} n={firstIncluded} />
        </button>
        <div class="item-text">
          <span class="song-no">
            {songLabel(song, t)}
            <span class="muted"> {included < song.slides ? `${included}/${song.slides}` : t.slides(song.slides)}</span>
          </span>
          <span class="song-title">{song.title}</span>
        </div>
        <div class="item-actions">
          <button class="icon-btn" onClick={p.onPresent} title={t.presentFrom} aria-label={t.presentFrom}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5z" />
            </svg>
          </button>
          <button class="icon-btn" onClick={p.onToggle} title={t.pickSlides} aria-label={t.pickSlides} aria-expanded={p.open}>
            <svg viewBox="0 0 24 24" aria-hidden="true" class={p.open ? 'flip' : ''}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button class="icon-btn" onClick={() => removeItem(item.key)} title={t.remove} aria-label={t.remove}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
      {vs.length > 0 && (
        <div class="verses">
          {vs.map((v, i) => (
            <button class={'vchip ' + verseState(v.start, v.end)} onClick={() => toggleVerse(v.start, v.end)} title={v.label}>
              {t.verse(i + 1)}
            </button>
          ))}
        </div>
      )}
      {p.open && (
        <div class="picker" style={{ '--ar': song.aspect } as any}>
          {Array.from({ length: song.slides }, (_, i) => i + 1).map((n) => (
            <button class={'pick' + (skip.has(n) ? ' off' : '')} onClick={() => toggleSlide(n)} aria-pressed={!skip.has(n)}>
              <img src={thumbUrl(song, n)} alt="" loading="lazy" draggable={false} />
              <span>{n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
