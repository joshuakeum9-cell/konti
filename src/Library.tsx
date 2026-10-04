import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { search, thumbUrl, verses, type Filter, type Song } from './data'
import { useT } from './i18n'
import { addSong, removeSong, useStore } from './store'

export function songLabel(s: Song, t: ReturnType<typeof useT>['t']) {
  return s.kind === 'hymn' ? t.hymnNo(s.num) : t.praiseNo(s.num)
}

export function Thumb({ song, n = 1 }: { song: Song; n?: number }) {
  return (
    <span class="thumb">
      <img src={thumbUrl(song, n)} alt="" loading="lazy" draggable={false} />
    </span>
  )
}

export function Library({ onAdded }: { onAdded?: () => void }) {
  const { t, lang } = useT()
  const { current } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [preview, setPreview] = useState<Song | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => search(q, filter), [q, filter])

  const counts = new Map<string, number>()
  for (const i of current.items) counts.set(i.id, (counts.get(i.id) ?? 0) + 1)

  // '/' focuses search, like most sites
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const add = (s: Song) => {
    addSong(s.id)
    onAdded?.()
  }

  return (
    <section class="library">
      <div class="lib-head">
        <div class="searchbox">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            ref={input}
            type="search"
            value={q}
            placeholder={t.search}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) add(results[0])
              if (e.key === 'Escape') setQ('')
            }}
          />
        </div>
        <div class="seg" role="tablist">
          {(['all', 'hymn', 'praise'] as Filter[]).map((f) => (
            <button role="tab" aria-selected={filter === f} class={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? t.all : f === 'hymn' ? t.hymns : t.praise}
            </button>
          ))}
        </div>
      </div>

      <ul class="songs">
        {results.map((s) => {
          const c = counts.get(s.id) ?? 0
          const sub = lang === 'en' && s.en ? s.en : s.alt
          return (
            <li class="song" key={s.id}>
              <button class="song-main" onClick={() => setPreview(s)}>
                <Thumb song={s} />
                <span class="song-text">
                  <span class="song-no">
                    {songLabel(s, t)}
                  </span>
                  <span class="song-title">{s.title}</span>
                  {sub && <span class="song-sub">{sub}</span>}
                </span>
              </button>
              {c ? (
                <div class="add-col">
                  <span class="added" title={t.added(c)} aria-label={t.added(c)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                    {c > 1 && <span class="badge">{c}</span>}
                  </span>
                  <button class="remove" onClick={() => removeSong(s.id)}>
                    {t.remove}
                  </button>
                </div>
              ) : (
                <button class="add" onClick={() => add(s)} aria-label={t.add} title={t.add}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
            </li>
          )
        })}
        {!results.length && <li class="empty">{t.noResults}</li>}
      </ul>

      {preview && <Preview song={preview} onClose={() => setPreview(null)} onAdd={() => add(preview)} />}
    </section>
  )
}

function Preview({ song, onClose, onAdd }: { song: Song; onClose: () => void; onAdd: () => void }) {
  const { t } = useT()
  const vs = verses(song)
  const verseOf = (n: number) => vs.findIndex((v) => n >= v.start && n <= v.end)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div class="sheet-back" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={song.title} onClick={(e) => e.stopPropagation()}>
        <header class="sheet-head">
          <div>
            <div class="song-no">{songLabel(song, t)}</div>
            <h2>
              {song.title}
              {song.alt && <span class="muted"> ({song.alt})</span>}
            </h2>
          </div>
          <button class="icon-btn" onClick={onClose} aria-label={t.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div class="grid" style={{ '--ar': song.aspect } as any}>
          {Array.from({ length: song.slides }, (_, i) => i + 1).map((n) => {
            const v = verseOf(n)
            const startsVerse = v >= 0 && vs[v].start === n
            return (
              <figure class={song.hidden?.includes(n) ? 'off' : ''}>
                <img src={thumbUrl(song, n)} alt="" loading="lazy" />
                <figcaption>
                  {n}
                  {startsVerse && <span class="vtag">{song.kind === 'hymn' || !vs[v].label ? t.verse(v + 1) : vs[v].label}</span>}
                </figcaption>
              </figure>
            )
          })}
        </div>
        <footer class="sheet-foot">
          <button
            class="primary"
            onClick={() => {
              onAdd()
              onClose()
            }}
          >
            {t.addToSet}
          </button>
        </footer>
      </div>
    </div>
  )
}
