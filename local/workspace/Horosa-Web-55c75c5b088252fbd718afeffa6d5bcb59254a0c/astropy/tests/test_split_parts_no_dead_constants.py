# -*- coding: utf-8 -*-
"""拆分件(门面 + 同级 *_parts/)不留没人用的模块级常量。

病形:同一段逻辑搬到单源件后,原文件里的常量(如换历分界)留着没人读 —— 读代码的人以为两处各有一份口径,
改一处漏一处。拆分件清单单源 = astrostudyui/scripts/source-sets.json 的 pySets。
判据:拆分件里每个模块级全大写常量,在 astrostudy / websrv / tests 全部 .py 里至少还被引用一次(定义之外)。
"""
import ast
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ASTROPY = os.path.dirname(HERE)
SOURCE_SETS = os.path.join(ASTROPY, '..', 'astrostudyui', 'scripts', 'source-sets.json')
CONST_RE = re.compile(r'^_?[A-Z][A-Z0-9_]+$')


def _split_part_files():
    with open(SOURCE_SETS, encoding='utf-8') as fh:
        py_sets = json.load(fh)['pySets']
    out = []
    for spec in py_sets.values():
        for name in spec['files']:
            out.append(os.path.join(ASTROPY, spec['dir'], name))
    return out


def _corpus():
    texts = []
    for root in ('astrostudy', 'websrv', 'tests'):
        for dirpath, _dirs, files in os.walk(os.path.join(ASTROPY, root)):
            for name in files:
                if name.endswith('.py'):
                    with open(os.path.join(dirpath, name), encoding='utf-8') as fh:
                        texts.append(fh.read())
    return '\n'.join(texts)


def _module_constants(src):
    names = []
    for node in ast.parse(src).body:
        targets = node.targets if isinstance(node, ast.Assign) else ([node.target] if isinstance(node, ast.AnnAssign) else [])
        for tg in targets:
            if isinstance(tg, ast.Name) and CONST_RE.match(tg.id):
                names.append(tg.id)
    return names


def _dead(files, corpus):
    bad = []
    for path in files:
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        for name in _module_constants(src):
            if len(re.findall(r'\b' + re.escape(name) + r'\b', corpus)) < 2:
                bad.append('%s: %s' % (os.path.relpath(path, ASTROPY), name))
    return bad


def test_split_part_list_is_not_empty():
    files = _split_part_files()
    assert len(files) >= 20
    missing = [f for f in files if not os.path.isfile(f)]
    assert missing == []


def test_split_parts_have_no_unreferenced_constants():
    assert _dead(_split_part_files(), _corpus()) == []


def test_discriminates_dead_constant(tmp_path):
    p = tmp_path / 'probe_part.py'
    p.write_text('_ZZ_UNUSED_PROBE_CONST = 1\nUSED_PROBE = 2\nprint(USED_PROBE)\n', encoding='utf-8')
    corpus = p.read_text(encoding='utf-8')
    assert _dead([str(p)], corpus) == ['%s: _ZZ_UNUSED_PROBE_CONST' % os.path.relpath(str(p), ASTROPY)]
