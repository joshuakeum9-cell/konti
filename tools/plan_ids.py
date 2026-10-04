"""Assign a stable ASCII id to every source deck, from its file name.

Hymns are named like '001장 title(통1).ppt' or '060 title(통67).ppt' -> h001.
Praise songs are named like '27 title.PPT' -> p27.
Writes work/plan.json for export_slides.ps1.
"""
import json, os, re, sys

SRC = 'source'
out = []
for f in sorted(os.listdir(SRC)):
    stem, ext = os.path.splitext(f)
    m = re.match(r'^(\d{3})장?\s*(.*)$', stem)
    if m:
        kind, num, rest = 'hymn', int(m.group(1)), m.group(2)
        sid = f'h{num:03d}'
    else:
        m = re.match(r'^(\d{1,2})\s+(.*)$', stem)
        if not m:
            sys.exit(f'cannot parse {f}')
        kind, num, rest = 'praise', int(m.group(1)), m.group(2)
        sid = f'p{num:02d}'
    out.append({'id': sid, 'file': f, 'kind': kind, 'num': num, 'raw': rest})
ids = [o['id'] for o in out]
dups = {i for i in ids if ids.count(i) > 1}
if dups:
    sys.exit(f'duplicate ids {dups}')
os.makedirs('work', exist_ok=True)
json.dump(out, open('work/plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'decks:', sum(o['kind'] == 'hymn' for o in out), 'hymns,', sum(o['kind'] == 'praise' for o in out), 'praise')
