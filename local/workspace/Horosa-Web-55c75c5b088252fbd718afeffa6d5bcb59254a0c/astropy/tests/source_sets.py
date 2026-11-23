# -*- coding: utf-8 -*-
"""读源码的测试用:拆成子模块的大文件按「门面 + 子模块」全集读(非 test_ 文件:测试公因子)。

登记表单源 = Horosa-Web/astrostudyui/scripts/source-sets.json 的 pySets(发布前自检的 pf_src_set、jest 与检查器读同一份;
路径相对 Horosa-Web/astropy)。perchart.py / india/jyotish_engine.py / astroextra.py 原先各是一份大文件,现按职责拆进
同级的 *_parts 子包,原路径留作门面(对外导入路径不变)。
  source_files(rel) —— rel 是登记过的门面:[子模块…(登记次序), 门面](绝对路径);其余文件只含它自己。
  read_source(rel)  —— 按上面的清单把内容首尾相接成一份文本(内容即拆分前那份文件的全部代码;拼出来的是文本,
                       要解析 AST 的检查按 source_files 逐个文件解析)。
前端(astrostudyui/src)拆成子模块的 .js 门面登记在同一份清单的 sets 里,读前端源码的合同用下面两个(与 jest 的
helpers/sourceSet.js 同一读法):
  ui_source_files(path) —— path 是前端文件的绝对路径;登记过的门面:[子模块…(登记次序), 门面];其余文件只含它自己。
  read_ui_source(path)  —— 首尾相接成一份文本(样式门面 .less 的 @import 原位展开不在这里做,遇到就报错)。
"""
import json
import os

ASTROPY_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MANIFEST = os.path.join(ASTROPY_ROOT, '..', 'astrostudyui', 'scripts', 'source-sets.json')

UI_SRC = os.path.abspath(os.path.join(ASTROPY_ROOT, '..', 'astrostudyui', 'src'))

with open(MANIFEST, encoding='utf-8') as _fh:
    _MANIFEST = json.load(_fh)
PY_SOURCE_SETS = dict(_MANIFEST['pySets'])
UI_SOURCE_SETS = dict(_MANIFEST['sets'])


def source_files(rel):
    rel = rel.replace(os.sep, '/')
    s = PY_SOURCE_SETS.get(rel)
    if not s:
        return [os.path.join(ASTROPY_ROOT, rel)]
    return [os.path.join(ASTROPY_ROOT, s['dir'], f) for f in s['files']] + [os.path.join(ASTROPY_ROOT, rel)]


def read_source(rel):
    out = []
    for p in source_files(rel):
        with open(p, encoding='utf-8') as fh:
            out.append(fh.read())
    return ''.join(out)


def ui_source_files(path):
    rel = os.path.relpath(os.path.abspath(path), UI_SRC).replace(os.sep, '/')
    s = UI_SOURCE_SETS.get(rel)
    if not s:
        return [os.path.abspath(path)]
    if rel.endswith('.less'):
        raise ValueError(f'{rel} 是样式门面:区段按 @import 原位展开,本读法不处理')
    return [os.path.join(UI_SRC, s['dir'], f) for f in s['files']] + [os.path.join(UI_SRC, rel)]


def read_ui_source(path):
    out = []
    for p in ui_source_files(path):
        with open(p, encoding='utf-8') as fh:
            out.append(fh.read())
    return ''.join(out)
