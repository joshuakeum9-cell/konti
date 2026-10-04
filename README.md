# 콘티 (Konti)

## ▶ Open the app: **https://joshuakeum9-cell.github.io/konti/**

Build a worship set list (콘티) from the church's song slides and present it full screen.
Works on any laptop, tablet or phone browser. Nothing to install.

**바로 열기: https://joshuakeum9-cell.github.io/konti/**

### Quick start

1. Open the link above (in Chrome or Edge on the church laptop).
2. Search for a song and press **+** (or Enter) to add it to the 콘티.
3. Drag to reorder; tap 1절, 2절... to skip verses.
4. Press **발표 시작 / Present**. Arrow keys or a clicker move through the slides. Esc stops.

Tip: press the globe button (top right) to switch the buttons between 한국어 and English.

## Features

- **곡 목록 / Songs**: search by number, title, English title or 초성 (ㅅㅁㅈㄲ). Enter adds the top result.
- **콘티 / Set list**: drag to reorder, tap verse chips (1절, 2절...) to skip verses, open a song to pick single slides,
  optional black screen between songs. Sets save automatically in the browser; "Copy link" shares the whole set in a URL.
- **발표 / Present**: full screen, black background, slides letterboxed.
  → Space PageDown or click: next. ← PageUp: back. ↑ ↓: previous/next song. 1 to 9: verse n. B: black screen. Esc: stop.
  Presentation clickers work (they send PageDown/PageUp).
- Interface in Korean or English (globe button, top right). Song titles stay Korean.
- Works offline once slides have been loaded ("Save all songs for offline" in Saved sets).

## Adding or changing songs

1. Put the .ppt/.pptx files in `source/` (names like `015장 title(통55).ppt` for hymns, `27 title.ppt` for praise songs).
2. `npm run slides` exports every slide with PowerPoint (Windows, PowerPoint installed). Add `-- -Resume` to only do new decks.
   The decks' own jump buttons are hidden on the images and become the app's verse buttons.
3. `npm run data` writes `public/slides`, `public/thumbs` and `public/songs.json`. Odd titles go in `TITLE_FIXES` in `tools/build_data.py`.
4. `npm run build`, then serve `dist/` from anywhere (it uses relative paths).

Hymn titles (Korean and English) come from the sibling `hymnal` project when present.
