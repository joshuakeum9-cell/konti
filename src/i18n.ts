import { useEffect, useState } from 'preact/hooks'

export type Lang = 'ko' | 'en'

const ko = {
  app: '콘티',
  library: '곡 목록',
  set: '콘티',
  search: '번호, 제목, 초성으로 찾기',
  all: '전체',
  hymns: '찬송가',
  praise: '찬양',
  hymnNo: (n: number) => `${n}장`,
  praiseNo: (n: number) => `찬양 ${n}`,
  tong: (n: number) => `통 ${n}`,
  slides: (n: number) => `슬라이드 ${n}`,
  add: '추가',
  added: (n: number) => (n > 1 ? `${n}번 추가됨` : '추가됨'),
  addToSet: '콘티에 추가',
  close: '닫기',
  noResults: '찾는 곡이 없습니다',
  emptySet: '곡 목록에서 곡을 추가하세요',
  emptySetHint: '순서는 끌어서 바꿀 수 있습니다',
  present: '발표 시작',
  presentFrom: '여기부터 발표',
  share: '링크 복사',
  copied: '링크를 복사했습니다',
  newSet: '새 콘티',
  mySets: '저장된 콘티',
  duplicate: '복제',
  delete: '삭제',
  confirmDelete: '이 콘티를 삭제할까요?',
  open: '열기',
  current: '지금 편집 중',
  songs: (n: number) => `${n}곡`,
  title: '콘티 제목',
  gap: '곡 사이에 검은 화면',
  verses: '절',
  verse: (n: number) => `${n}절`,
  pickSlides: '장면 고르기',
  done: '완료',
  remove: '삭제',
  up: '위로',
  down: '아래로',
  defaultTitle: (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 주일 예배`,
  imported: '공유받은 콘티를 저장했습니다',
  offline: '모든 곡 오프라인 저장',
  offlineDone: '모든 곡을 저장했습니다. 인터넷 없이도 발표할 수 있습니다',
  offlineProgress: (a: number, b: number) => `저장 중 ${a} / ${b}`,
  keys: '단축키',
  keyHelp: [
    ['→  Space  PageDown  클릭', '다음 장면'],
    ['←  PageUp', '이전 장면'],
    ['↑  ↓', '이전 곡, 다음 곡'],
    ['1 ~ 9', '현재 곡의 n절로'],
    ['B', '검은 화면 켜기/끄기'],
    ['F', '전체 화면'],
    ['Esc', '발표 끝내기'],
  ] as [string, string][],
  black: '검은 화면',
  fullscreen: '전체 화면',
  exit: '끝내기',
  end: '콘티 끝',
  slideOf: (a: number, b: number) => `${a} / ${b}`,
  loading: '불러오는 중',
}

const en: typeof ko = {
  app: 'Konti',
  library: 'Songs',
  set: 'Set list',
  search: 'Number, title or first line',
  all: 'All',
  hymns: 'Hymns',
  praise: 'Praise',
  hymnNo: (n: number) => `Hymn ${n}`,
  praiseNo: (n: number) => `Praise ${n}`,
  tong: (n: number) => `old #${n}`,
  slides: (n: number) => `${n} slides`,
  add: 'Add',
  added: (n: number) => (n > 1 ? `Added ${n}x` : 'Added'),
  addToSet: 'Add to set',
  close: 'Close',
  noResults: 'No songs found',
  emptySet: 'Add songs from the list',
  emptySetHint: 'Drag to change the order',
  present: 'Present',
  presentFrom: 'Present from here',
  share: 'Copy link',
  copied: 'Link copied',
  newSet: 'New set',
  mySets: 'Saved sets',
  duplicate: 'Duplicate',
  delete: 'Delete',
  confirmDelete: 'Delete this set?',
  open: 'Open',
  current: 'Editing now',
  songs: (n: number) => `${n} ${n === 1 ? 'song' : 'songs'}`,
  title: 'Set title',
  gap: 'Black screen between songs',
  verses: 'Verses',
  verse: (n: number) => `Verse ${n}`,
  pickSlides: 'Pick slides',
  done: 'Done',
  remove: 'Remove',
  up: 'Up',
  down: 'Down',
  defaultTitle: (d: Date) =>
    `Sunday service, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  imported: 'Shared set saved',
  offline: 'Save all songs for offline',
  offlineDone: 'All songs saved. You can present without internet',
  offlineProgress: (a: number, b: number) => `Saving ${a} / ${b}`,
  keys: 'Shortcuts',
  keyHelp: [
    ['→  Space  PageDown  click', 'Next slide'],
    ['←  PageUp', 'Previous slide'],
    ['↑  ↓', 'Previous song, next song'],
    ['1 to 9', 'Verse n of this song'],
    ['B', 'Black screen on/off'],
    ['F', 'Full screen'],
    ['Esc', 'Stop presenting'],
  ],
  black: 'Black',
  fullscreen: 'Full screen',
  exit: 'Exit',
  end: 'End of set',
  slideOf: (a: number, b: number) => `${a} / ${b}`,
  loading: 'Loading',
}

const KEY = 'konti.lang'
let lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'ko' || v === 'en') return v
  } catch {}
  return 'ko'
})()
const listeners = new Set<() => void>()

export function setLang(l: Lang) {
  lang = l
  try {
    localStorage.setItem(KEY, l)
  } catch {}
  document.documentElement.lang = l
  listeners.forEach((f) => f())
}

export function useT() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((x) => x + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  return { t: lang === 'ko' ? ko : en, lang }
}

export const currentT = () => (lang === 'ko' ? ko : en)
