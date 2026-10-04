"""Build the app's data from the exported slides.

Reads  work/plan.json, work/decks/<id>.json, work/png/<id>/NN.png
       ../hymnal/data/hymns/NNN/meta.json (official 새찬송가 titles, if present)
Writes public/slides/<id>/NN.webp  (1920 wide, for the projector)
       public/thumbs/<id>/NN.webp  (480 wide, for lists)
       public/songs.json
Images are only re-encoded when the PNG is newer than the WebP.
"""
import hashlib, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
HYMNAL = os.path.join(os.path.dirname(ROOT), 'hymnal', 'data', 'hymns')

FULL_Q, THUMB_W, THUMB_Q = 82, 480, 72

# Praise decks whose file name needs more than the generic clean-up.
TITLE_FIXES = {
    'p36': '성령 하나님 나를 만지소서',
    'p47': '나에게 생수 (내 잔이 넘치나이다)',
    'p52': '이 산지를 내게 주소서',
    'p53': '하나님 한번도 나를',
    'p34': '주의 도를 버리고',
    'p63': '나의 주 크고 놀라운 하나님',
    'p21': '모든 열방 주 볼 때까지 (내 눈 주의 영광을)',
    'p55': '나의 힘이 되신 여호와여',
    'p18': '엘샤다이',
    'p57': '행복 (화려하지 않아도)',
    'p61': '키 코아 하브',
    'p33': '하나님 아버지의 마음',
    'p13': '지금은 엘리야 때처럼',
    'p08': '여호와 이스라엘의 구원자',
    'p37': '주 품에',
    'p03': '우리 보좌 앞에 모였네 (비전)',
    'p19': '아름답고 놀라운 주 예수',
    'p26': '모든 민족에게',
    'p28': '수많은 무리들 줄지어 (예수 이름 높이세)',
    'p30': '주여 이 땅 위에',
}


def clean_praise(raw):
    t = raw.replace('+', ' ')
    t = re.sub(r'_(Wide|보통)$', '', t, flags=re.I)
    t = re.sub(r'-[a-z]+\d+$', '', t)          # '-jjkkhh2232'
    t = re.sub(r'\s*ppt$', '', t, flags=re.I)
    t = re.sub(r'\s*\((1|흰)\)$', '', t)
    t = re.sub(r'(?<=[가-힣])b$', '', t)      # '...만지소서b'
    t = re.sub(r'\s+2$', '', t)                 # '... 사랑을 2'
    t = t.replace('♬', '').replace('( ', '(')
    t = re.sub(r'(?<=\S)\(', ' (', t)
    return re.sub(r'\s+', ' ', t).strip()


def split_title(t):
    """'first line (title)' -> ('first line', 'title')"""
    m = re.match(r'^(.*?)\s*\(([^()]*)\)$', t)
    return (m.group(1), m.group(2)) if m else (t, '')


def convert(src, dst, width, quality):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src).convert('RGB')
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=quality, method=6)


def file_hash(paths):
    h = hashlib.sha1()
    for p in paths:
        h.update(open(p, 'rb').read())
    return h.hexdigest()[:10]


def main():
    plan = json.load(open('work/plan.json', encoding='utf-8'))
    songs, missing = [], []
    for d in plan:
        sid = d['id']
        deck_path = f'work/decks/{sid}.json'
        if not os.path.exists(deck_path):
            missing.append(sid)
            continue
        deck = json.load(open(deck_path, encoding='utf-8-sig'))
        slides = deck['slides'] if isinstance(deck['slides'], list) else [deck['slides']]
        jumps = deck.get('jumps') or []
        if isinstance(jumps, dict):
            jumps = [jumps]
        webps = []
        for s in slides:
            n = f"{s['n']:02d}"
            png = f'work/png/{sid}/{n}.png'
            full = f'public/slides/{sid}/{n}.webp'
            convert(png, full, 1920, FULL_Q)
            convert(png, f'public/thumbs/{sid}/{n}.webp', THUMB_W, THUMB_Q)
            webps.append(full)

        song = {'id': sid, 'kind': d['kind'], 'num': d['num']}
        if d['kind'] == 'hymn':
            meta_path = os.path.join(HYMNAL, f"{d['num']:03d}", 'meta.json')
            m = re.match(r'^(.*?)\s*\(통\s*(\d+)\)$', d['raw'])
            if os.path.exists(meta_path):
                meta = json.load(open(meta_path, encoding='utf-8'))
                song['title'] = meta['title_ko']
                song['en'] = meta.get('title_en') or ''
                # the deck's own '(통N)' wins; the meta field has typos ('5  3')
                if m:
                    song['tong'] = int(m.group(2))
                elif isinstance(meta.get('old_number'), int):
                    song['tong'] = meta['old_number']
            else:
                song['title'] = m.group(1) if m else d['raw']
                if m:
                    song['tong'] = int(m.group(2))
        else:
            t = TITLE_FIXES.get(sid) or clean_praise(d['raw'])
            line, alt = split_title(t)
            # a deck named 'first line (name)' is best known by the shorter of the two
            if alt and len(alt) < len(line):
                line, alt = alt, line
            song['title'] = line
            if alt:
                song['alt'] = alt

        song['aspect'] = round(deck['w'] / deck['h'], 4)
        song['slides'] = len(slides)
        hidden = [s['n'] for s in slides if s.get('hidden')]
        if hidden:
            song['hidden'] = hidden
        if len(jumps) > 1:
            out = []
            for i, j in enumerate(jumps):
                label = re.sub(r'^\d+\s*[.)]\s*', '', (j.get('label') or '').strip())
                out.append({'slide': j['slide'], 'label': label})
            song['jumps'] = out
        song['v'] = file_hash(webps)
        songs.append(song)

    songs.sort(key=lambda s: (s['kind'] != 'hymn', s['num']))
    json.dump({'songs': songs}, open('public/songs.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(songs)} songs, {sum(s["slides"] for s in songs)} slides')
    if missing:
        print('not exported yet:', ' '.join(missing), file=sys.stderr)


if __name__ == '__main__':
    main()
