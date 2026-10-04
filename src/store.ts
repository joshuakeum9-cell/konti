import { useEffect, useState } from 'preact/hooks'
import { currentT } from './i18n'
import { getSong } from './data'

/** One song in a set. `skip` lists slide numbers left out (e.g. verses not sung). */
export type Item = { key: string; id: string; skip: number[] }

export type Konti = {
  id: string
  title: string
  items: Item[]
  gap: boolean // black screen between songs
  updated: number
}

type State = { currentId: string; sets: Konti[] }

const KEY = 'konti.sets.v1'
const uid = () => Math.random().toString(36).slice(2, 10)

function nextSunday(from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return d
}

export function blankKonti(): Konti {
  return { id: uid(), title: currentT().defaultTitle(nextSunday()), items: [], gap: false, updated: Date.now() }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      if (s.sets?.length && s.sets.some((k) => k.id === s.currentId)) return s
    }
  } catch {}
  const k = blankKonti()
  return { currentId: k.id, sets: [k] }
}

let state: State = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  listeners.forEach((f) => f())
}

export function useStore() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((x) => x + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  const current = state.sets.find((k) => k.id === state.currentId)!
  return { current, sets: state.sets }
}

export const getCurrent = () => state.sets.find((k) => k.id === state.currentId)!

function updateCurrent(f: (k: Konti) => Konti) {
  commit({
    ...state,
    sets: state.sets.map((k) => (k.id === state.currentId ? { ...f(k), updated: Date.now() } : k)),
  })
}

export function addSong(id: string) {
  const song = getSong(id)
  updateCurrent((k) => ({ ...k, items: [...k.items, { key: uid(), id, skip: [...(song?.hidden ?? [])] }] }))
}

export const removeItem = (key: string) =>
  updateCurrent((k) => ({ ...k, items: k.items.filter((i) => i.key !== key) }))

export function moveItem(from: number, to: number) {
  updateCurrent((k) => {
    const items = [...k.items]
    const [it] = items.splice(from, 1)
    items.splice(Math.max(0, Math.min(items.length, to)), 0, it)
    return { ...k, items }
  })
}

export const setSkip = (key: string, skip: number[]) =>
  updateCurrent((k) => ({
    ...k,
    items: k.items.map((i) => (i.key === key ? { ...i, skip: [...new Set(skip)].sort((a, b) => a - b) } : i)),
  }))

export const setTitle = (title: string) => updateCurrent((k) => ({ ...k, title }))
export const setGap = (gap: boolean) => updateCurrent((k) => ({ ...k, gap }))

export function newKonti() {
  const k = blankKonti()
  commit({ currentId: k.id, sets: [k, ...state.sets] })
}

export const openKonti = (id: string) => commit({ ...state, currentId: id })

export function duplicateKonti(id: string) {
  const src = state.sets.find((k) => k.id === id)
  if (!src) return
  const k: Konti = { ...src, id: uid(), items: src.items.map((i) => ({ ...i, key: uid() })), updated: Date.now() }
  commit({ currentId: k.id, sets: [k, ...state.sets] })
}

export function deleteKonti(id: string) {
  let sets = state.sets.filter((k) => k.id !== id)
  if (!sets.length) sets = [blankKonti()]
  const currentId = sets.some((k) => k.id === state.currentId) ? state.currentId : sets[0].id
  commit({ currentId, sets })
}

// ---- sharing: the whole set travels in the link, no server needed ----

type Wire = { t: string; g?: 1; i: (string | [string, number[]])[] }

function b64url(bytes: Uint8Array) {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function shareLink(k: Konti) {
  const wire: Wire = {
    t: k.title,
    i: k.items.map((i) => (i.skip.length ? [i.id, i.skip] : i.id)),
  }
  if (k.gap) wire.g = 1
  const code = b64url(new TextEncoder().encode(JSON.stringify(wire)))
  return `${location.origin}${location.pathname}#/s/${code}`
}

/** Saves a shared set (from a #/s/<code> link) and makes it current. Returns false if the code is bad. */
export function importShared(code: string): boolean {
  try {
    const wire = JSON.parse(new TextDecoder().decode(fromB64url(code))) as Wire
    const items: Item[] = wire.i
      .map((x) => (typeof x === 'string' ? { id: x, skip: [] as number[] } : { id: x[0], skip: x[1] }))
      .filter((x) => getSong(x.id))
      .map((x) => ({ key: uid(), ...x }))
    // opening the same link twice should not pile up copies
    const same = state.sets.find(
      (k) => k.title === wire.t && JSON.stringify(k.items.map((i) => [i.id, i.skip])) === JSON.stringify(items.map((i) => [i.id, i.skip])),
    )
    if (same) {
      commit({ ...state, currentId: same.id })
      return true
    }
    const k: Konti = { id: uid(), title: String(wire.t || ''), items, gap: !!wire.g, updated: Date.now() }
    commit({ currentId: k.id, sets: [k, ...state.sets] })
    return true
  } catch {
    return false
  }
}
