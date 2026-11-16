#!/usr/bin/env python3
"""Compare generated .story files against real ones saved by Storyline.

Storyline reports "invalid or corrupt" with no detail, so the only way to find
a bad attribute before sending a file to a person is to check that every
attribute, value and child order in the generated slides has been seen in a
real file.

Usage:
  python3 -I compare_story.py --real DIR [DIR ...] --made FILE.story [FILE.story ...]

--real  folders holding unzipped real .story files (each has story/slides/*.xml)
--made  generated .story files to check
"""
import argparse, glob, re, zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

NUM = re.compile(r'-?[\d.]+(E[+-]?\d+)?')
GUID = re.compile(r'[0-9a-f-]{36}')
FREE_TEXT = {'name', 'Text', 'js', 'varVal1', 'open', 'dur', 'defaultName'}
OPEN_LISTS = {'shapeLst', 'trigLst', 'sld', 'sldLayerLst', 'stops', 'condLst', 'stateLst', 'choices', 'order'}
REFS = re.compile(r'(?:shpG|matchShpG|corFbG|incFbG|submitG|showG|hideG|setStateG|jumpG|lightBoxG)="([^"]+)"')


def collect(roots):
    vals, kids = defaultdict(set), defaultdict(set)

    def walk(e):
        for a, v in e.attrib.items():
            if a in ('g', 'verG') or GUID.fullmatch(v):
                continue
            if NUM.fullmatch(v):
                v = '#.' if '.' in v else '#'
            vals[(e.tag, a)].add(v)
        kids[e.tag].add(tuple(c.tag for c in e))
        for c in e:
            walk(c)

    for r in roots:
        walk(r)
    return vals, kids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--real', nargs='+', required=True)
    ap.add_argument('--made', nargs='+', required=True)
    a = ap.parse_args()

    real = [ET.parse(f).getroot() for d in a.real for f in glob.glob(d + '/story/slides/*.xml')]
    if not real:
        raise SystemExit('no real slides found under --real')
    rv, rk = collect(real)

    made, problems = [], 0
    all_slide_g = set()
    raws = []
    for f in a.made:
        z = zipfile.ZipFile(f)
        if any(n.endswith('/') for n in z.namelist()):
            print('DIRECTORY ENTRY in zip (Storyline rejects these):', f); problems += 1
        for n in z.namelist():
            if not n.endswith('.xml'):
                continue
            raw = z.read(n).decode('utf-8-sig')
            root = ET.fromstring(raw)
            if n.startswith('story/slides/'):
                made.append(root); raws.append((f, n, raw))
                all_slide_g.update(re.findall(r' g="([^"]+)"', raw))
                for t in root.iter('text'):
                    if t.text and t.text.strip():
                        ET.fromstring(t.text)  # the escaped rich text must itself parse
    for f, n, raw in raws:
        for m in REFS.finditer(raw):
            if not m.group(1).startswith('00000000') and m.group(1) not in all_slide_g:
                print('DANGLING REFERENCE', f, n, m.group(0)[:60]); problems += 1

    mv, mk = collect(made)
    for k, v in sorted(mv.items()):
        if k not in rv:
            print('ATTRIBUTE NEVER SEEN', k, list(v)[:3]); problems += 1; continue
        if '#.' in v and '#.' not in rv[k]:
            print('DECIMAL NEVER SEEN (real values are whole numbers)', k); problems += 1
        extra = v - rv[k] - {'#', '#.'}
        if extra and '#' not in rv[k] and '#.' not in rv[k] and k[1] not in FREE_TEXT:
            print('VALUE NEVER SEEN', k, list(extra)[:4], 'real:', list(rv[k])[:8]); problems += 1
    for k, v in mk.items():
        if k not in rk:
            print('TAG NEVER SEEN', k); problems += 1; continue
        if k in OPEN_LISTS:
            continue
        for sig in v - rk[k]:
            print('CHILD ORDER NEVER SEEN', k, sig); problems += 1
    print('done:', problems, 'thing(s) to look at')


if __name__ == '__main__':
    main()
