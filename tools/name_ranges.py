#!/usr/bin/env python3
"""The Unicode ranges in the server's name rule (codeblack.clean_name), made from Python's Unicode tables.

    python3 tools/name_ranges.py           print the ranges as SQL escapes, with the Unicode version
    python3 tools/name_ranges.py --check   check that the newest migration's clean_name uses exactly these ranges

The server can't use \\p{M} or \\p{N} (PostgreSQL regexes have no Unicode categories), so clean_name spells them out:
  m   the marks (Mn, Mc, Me) allowed inside a word, after a letter
  d   every number (Nd, Nl, No), refused anywhere
  me  the enclosing marks (Me): refused (S + U+20DD looks like a circled S)
  di  Default_Ignorable_Code_Point (invisible), refused, except a ZWNJ or ZWJ between letters
The game (src/ui.js cbClean) uses \\p{M}, \\p{N}, \\p{Me} and \\p{Default_Ignorable_Code_Point}, from the browser's own
Unicode version, which may be newer: a letter added after this version passes the game and is refused by the server,
and the game then says the server didn't accept the name. supabase/tests/client_call.json holds names both must agree on.
"""
import re, sys, unicodedata, pathlib

# Default_Ignorable_Code_Point, from Unicode 15.1 DerivedCoreProperties.txt (Python has no table for it). Unchanged in 16.0 and 17.0.
DI = [(0x00AD, 0x00AD), (0x034F, 0x034F), (0x061C, 0x061C), (0x115F, 0x1160), (0x17B4, 0x17B5), (0x180B, 0x180F),
      (0x200B, 0x200F), (0x202A, 0x202E), (0x2060, 0x206F), (0x3164, 0x3164), (0xFE00, 0xFE0F), (0xFEFF, 0xFEFF),
      (0xFFA0, 0xFFA0), (0xFFF0, 0xFFF8), (0x1BCA0, 0x1BCA3), (0x1D173, 0x1D17A), (0xE0000, 0xE0FFF)]


def ranges(pred):
    out, start = [], None
    for cp in range(0x110000):
        hit = pred(cp)
        if hit and start is None: start = cp
        if not hit and start is not None: out.append((start, cp - 1)); start = None
    if start is not None: out.append((start, 0x10FFFF))
    return out


def esc(cp):
    return '\\u%04X' % cp if cp <= 0xFFFF else '\\U%08X' % cp


def sql(rs):
    return ''.join(esc(a) if a == b else esc(a) + '-' + esc(b) for a, b in rs)


def cat(*cs):
    return lambda cp: unicodedata.category(chr(cp)) in cs


def lists():
    return {'m': sql(ranges(cat('Mn', 'Mc', 'Me'))), 'd': sql(ranges(cat('Nd', 'Nl', 'No'))),
            'me': sql(ranges(cat('Me'))), 'di': sql(DI)}


def newest_clean_name():
    mig = pathlib.Path(__file__).resolve().parent.parent / 'supabase' / 'migrations'
    files = sorted(f for f in mig.glob('[0-9]*.sql') if 'function codeblack.clean_name' in f.read_text(encoding='utf-8'))
    if not files: sys.exit('No migration defines codeblack.clean_name')
    return files[-1]


UNICODE = '15.1.0'   # the version the lists in the migrations were made from: Python 3.12 and 3.13 ship it


if __name__ == '__main__':
    if unicodedata.unidata_version != UNICODE:
        sys.exit(f'This Python has Unicode {unicodedata.unidata_version}; the lists are Unicode {UNICODE}. Use Python 3.12 or 3.13, '
                 'or, to move the server to a newer Unicode, change UNICODE here and write a new migration with the new lists.')
    L = lists()
    if '--check' not in sys.argv:
        print('-- Unicode', unicodedata.unidata_version)
        for k, v in L.items(): print(f"{k}: '{v}'")
        sys.exit(0)
    f = newest_clean_name(); text = f.read_text(encoding='utf-8')
    bad = 0
    for k, v in L.items():
        got = re.search(r"'([^']*)'::text as %s\b" % k, text)
        if not got: print(f'FAIL {f.name}: no list named {k}'); bad += 1
        elif got.group(1) != v: print(f'FAIL {f.name}: list {k} differs from Unicode {unicodedata.unidata_version}'); bad += 1
        else: print(f'ok   {f.name}: list {k} is Unicode {unicodedata.unidata_version}')
    sys.exit(1 if bad else 0)
