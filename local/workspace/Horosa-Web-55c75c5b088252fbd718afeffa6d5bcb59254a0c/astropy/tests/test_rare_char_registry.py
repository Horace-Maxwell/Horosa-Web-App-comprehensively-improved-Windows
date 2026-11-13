# -*- coding: utf-8 -*-
"""太玄字典(首辞 / 赞辞)里的罕见字(CJK 扩展 B 及以后)必须全部登记了界面回退写法。

这些字多数系统字体没有字形,界面上会画成带纹方块;前端 astrostudyui/src/utils/rareChars.js 的 RARE_CHARS 给每个字
登记「通行写法 / 拆字说明」,画不出时换上。字典换版多出新字而没登记 → 这里红(前端自己的数据由 rareChars.test.js 看)。
"""
import os
import pickle
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, '..', '..'))
DICT = os.path.join(WEB, 'vendor', 'taixuanshifa', 'data', 'taixuandict.p')
TABLE = os.path.join(WEB, 'astrostudyui', 'src', 'utils', 'rareChars.js')
RARE = re.compile('[\U00020000-\U0003FFFF]')


def _strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from _strings(k)
            yield from _strings(v)
    elif isinstance(node, (list, tuple, set)):
        for v in node:
            yield from _strings(v)


def test_every_rare_char_in_the_taixuan_dictionary_has_a_fallback():
    with open(DICT, 'rb') as fh:
        data = pickle.load(fh)
    used = set()
    for s in _strings(data):
        used.update(RARE.findall(s))
    assert len(used) >= 15, used          # 判别力:字典里确实有这些字
    with open(TABLE, encoding='utf-8') as fh:
        src = fh.read()
    body = src[src.index('export const RARE_CHARS'):src.index('};', src.index('export const RARE_CHARS'))]
    registered = set(re.findall(r"^\s*'(.)':\s*\{", body, re.M))
    assert registered, '没读到登记表'
    missing = sorted('%s U+%X' % (c, ord(c)) for c in used - registered)
    assert not missing, '太玄字典里有未登记回退写法的罕见字: %s' % missing
