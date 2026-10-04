import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { allSongs, getSong, loadSongs, slideUrl, thumbUrl } from './data'
import { setLang, useT } from './i18n'
import { Library } from './Library'
import { Present, buildSequence, enterFullscreen } from './Present'
import { SetPanel } from './SetPanel'
import { deleteKonti, duplicateKonti, getCurrent, importShared, newKonti, openKonti, useStore } from './store'
import './style.css'

type Route = { name: 'home' } | { name: 'present'; from: number }

function readRoute(): Route {
  const m = location.hash.match(/^#\/present(?:\/(\d+))?$/)
  return m ? { name: 'present', from: Number(m[1] ?? 0) } : { name: 'home' }
}

function App() {
  const { t, lang } = useT()
  const { current, sets } = useStore()
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState<Route>(readRoute)
  const [tab, setTab] = useState<'lib' | 'set'>('lib')
  const [menu, setMenu] = useState(false)
  const [msg, setMsg] = useState('')

  const toast = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((x) => (x === m ? '' : x)), 2600)
  }

  useEffect(() => {
    loadSongs().then(() => {
      const shared = location.hash.match(/^#\/s\/([\w-]+)$/)
      if (shared) {
        if (importShared(shared[1])) {
          toast(t.imported)
          setTab('set')
        }
        history.replaceState(null, '', location.pathname)
      }
      setReady(true)
    })
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const present = (from: number) => {
    enterFullscreen() // must run inside the click
    // warm the cache so every slide of the set is ready (and stays available offline)
    for (const s of buildSequence(getCurrent())) if (s.kind === 'slide') fetch(slideUrl(s.song, s.n)).catch(() => {})
    location.hash = `#/present/${from}`
  }
  const exitPresent = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    if (location.hash.startsWith('#/present')) history.length > 1 ? history.back() : (location.hash = '')
    setRoute({ name: 'home' })
  }

  if (!ready) return <div class="loading">{t.loading}</div>

  if (route.name === 'present' && current.items.length) {
    return <Present konti={current} startItem={route.from} onExit={exitPresent} />
  }

  return (
    <div class={'app tab-' + tab}>
      <header class="top">
        <div class="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true" class="logo">
            <rect x="3" y="6" width="26" height="17" rx="3" />
            <path d="M11 27h10M16 23v4" />
            <path d="M13 11v7.5M13 11l6-1.5v7" />
            <circle cx="11.6" cy="18.6" r="1.6" class="fill" />
            <circle cx="17.6" cy="17" r="1.6" class="fill" />
          </svg>
          <span>{t.app}</span>
        </div>
        <div class="top-actions">
          <button class="ghost" onClick={() => setMenu(true)}>
            {t.mySets}
            <span class="pill">{sets.length}</span>
          </button>
          <button class="ghost" onClick={() => newKonti()}>
            {t.newSet}
          </button>
          <button
            class="ghost lang"
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            title={lang === 'ko' ? 'Switch the buttons to English' : '버튼을 한국어로 바꾸기'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
            </svg>
            {lang === 'ko' ? 'English' : '한국어'}
          </button>
        </div>
      </header>

      <main class="panes">
        <Library onAdded={() => toast(t.added(1))} />
        <SetPanel onPresent={present} toast={toast} />
      </main>

      <nav class="tabs">
        <button class={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>
          {t.library}
        </button>
        <button class={tab === 'set' ? 'on' : ''} onClick={() => setTab('set')}>
          {t.set}
          {current.items.length > 0 && <span class="pill">{current.items.length}</span>}
        </button>
      </nav>

      {menu && <SetsMenu onClose={() => setMenu(false)} toast={toast} onOpen={() => setTab('set')} />}
      {msg && <div class="toast">{msg}</div>}
    </div>
  )
}

function SetsMenu({ onClose, toast, onOpen }: { onClose: () => void; toast: (m: string) => void; onOpen: () => void }) {
  const { t, lang } = useT()
  const { current, sets } = useStore()
  const [progress, setProgress] = useState<string>('')

  const saveAll = async () => {
    const urls: string[] = []
    for (const s of allSongs()) for (let n = 1; n <= s.slides; n++) urls.push(slideUrl(s, n), thumbUrl(s, n))
    let done = 0
    const worker = async () => {
      while (urls.length) {
        const u = urls.pop()!
        await fetch(u).catch(() => {})
        done++
        if (done % 20 === 0) setProgress(t.offlineProgress(done, done + urls.length))
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    setProgress('')
    toast(t.offlineDone)
  }

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })

  return (
    <div class="sheet-back" onClick={onClose}>
      <div class="sheet narrow" role="dialog" aria-label={t.mySets} onClick={(e) => e.stopPropagation()}>
        <header class="sheet-head">
          <h2>{t.mySets}</h2>
          <button class="icon-btn" onClick={onClose} aria-label={t.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <ul class="sets">
          {[...sets]
            .sort((a, b) => b.updated - a.updated)
            .map((k) => (
              <li class={k.id === current.id ? 'cur' : ''}>
                <button
                  class="set-open"
                  onClick={() => {
                    openKonti(k.id)
                    onOpen()
                    onClose()
                  }}
                >
                  <span class="song-title">{k.title || '...'}</span>
                  <span class="muted">
                    {t.songs(k.items.length)}, {fmt(k.updated)}
                    {k.id === current.id && <b class="cur-tag"> {t.current}</b>}
                  </span>
                  <span class="set-strip">
                    {k.items.slice(0, 6).map((i) => {
                      const s = getSong(i.id)
                      return s ? <img src={thumbUrl(s, 1)} alt="" loading="lazy" /> : null
                    })}
                  </span>
                </button>
                <div class="set-btns">
                  <button class="ghost small" onClick={() => duplicateKonti(k.id)}>
                    {t.duplicate}
                  </button>
                  <button class="ghost small danger" onClick={() => confirm(t.confirmDelete) && deleteKonti(k.id)}>
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
        </ul>
        <footer class="sheet-foot">
          <button class="ghost" onClick={saveAll} disabled={!!progress}>
            {progress || t.offline}
          </button>
        </footer>
      </div>
    </div>
  )
}

document.documentElement.lang = (() => {
  try {
    return localStorage.getItem('konti.lang') ?? 'ko'
  } catch {
    return 'ko'
  }
})()

render(<App />, document.getElementById('app')!)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch(() => {})
}
