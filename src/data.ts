export type Jump = { slide: number; label: string }

export type Song = {
  id: string
  kind: 'hymn' | 'praise'
  num: number
  title: string
  alt?: string // the song's other name, shown in brackets in the source file name
  en?: string // English title (hymns)
  tong?: number // 통일찬송가 number
  aspect: number // slide width / height
  slides: number
  hidden?: number[] // slides hidden in the original deck
  jumps?: Jump[] // the deck's own verse buttons: where each verse starts
  repeat?: number // verses stacked on the same slides: play the deck this many times
  v: string // content hash, busts the image cache when slides change
}

export type Verse = { start: number; end: number; label: string }

let songs: Song[] = []
const byId = new Map<string, Song>()

export async function loadSongs(): Promise<Song[]> {
  const res = await fetch('songs.json', { cache: 'no-cache' })
  const data = (await res.json()) as { songs: Song[] }
  songs = data.songs
  byId.clear()
  for (const s of songs) byId.set(s.id, s)
  return songs
}

export const getSong = (id: string) => byId.get(id)
export const allSongs = () => songs

const pad = (n: number) => String(n).padStart(2, '0')
export const slideUrl = (s: Song, n: number) => `slides/${s.id}/${pad(n)}.webp?v=${s.v}`
export const thumbUrl = (s: Song, n: number) => `thumbs/${s.id}/${pad(n)}.webp?v=${s.v}`

/** Verse ranges from the deck's own buttons. Slides before the first button belong to verse 1. */
export function verses(s: Song): Verse[] {
  const j = s.jumps
  if (!j || j.length < 2) return []
  return j.map((v, i) => ({
    start: i === 0 ? 1 : v.slide,
    end: i + 1 < j.length ? j[i + 1].slide - 1 : s.slides,
    label: v.label,
  }))
}

// ---- search ----

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'

function choseong(t: string) {
  let out = ''
  for (const ch of t) {
    const c = ch.charCodeAt(0)
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)]
    else if (/\S/.test(ch)) out += ch
  }
  return out
}

const norm = (t: string) => t.toLowerCase().replace(/[\s.,'!?()\-]/g, '')

type Indexed = { song: Song; text: string; head: string; cho: string }
let index: Indexed[] | null = null

function buildIndex() {
  index = songs.map((song) => {
    const head = norm(song.title + ' ' + (song.alt ?? ''))
    const text = norm(
      [song.title, song.alt, song.en, ...(song.jumps ?? []).map((j) => j.label)].filter(Boolean).join(' '),
    )
    return { song, text, head, cho: choseong(song.title + (song.alt ?? '')) }
  })
}

export type Filter = 'all' | 'hymn' | 'praise'

export function search(q: string, filter: Filter): Song[] {
  if (!index) buildIndex()
  const list = index!.filter((x) => filter === 'all' || x.song.kind === filter)
  const query = q.trim()
  if (!query) return list.map((x) => x.song)

  const num = query.match(/^\d+$/) ? Number(query) : null
  const isCho = /^[ㄱ-ㅎ\s]+$/.test(query)
  const nq = norm(query)
  const choQ = query.replace(/\s/g, '')

  const scored: { song: Song; score: number }[] = []
  for (const x of list) {
    let score = 0
    if (num !== null) {
      if (x.song.num === num) score = 100
      else if (x.song.tong === num) score = 40
      else if (String(x.song.num).startsWith(query)) score = 20
    } else if (isCho) {
      if (x.cho.startsWith(choQ)) score = 60
      else if (x.cho.includes(choQ)) score = 30
    } else {
      if (norm(x.song.title) === nq || norm(x.song.alt ?? '') === nq) score = 90
      else if (x.head.startsWith(nq)) score = 80
      else if (x.head.includes(nq)) score = 60
      else if (x.text.includes(nq)) score = 30
    }
    if (score) scored.push({ song: x.song, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.song)
}
