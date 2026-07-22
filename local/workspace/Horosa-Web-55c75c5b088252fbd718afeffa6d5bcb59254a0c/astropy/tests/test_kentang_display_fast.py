# -*- coding: utf-8 -*-
"""horosa_display_trans_v1(PERF-R10 B4)等价金标 —— translate 单遍 ≡ 旧逐项 replace。

三层证明的第 ①② 层(第 ③ 层 = 黄金全矩阵,kentang 15 端点覆盖 display_safe 全路径):
  ① 不变量:等价性的两个前提本身被钉死 —— 全键值单字符;值集与键集交集 ⊆ {恒等对}。
  ② 穷举:全部键、全部值、键∪值两两拼接(~6 万串)+ ASCII/None 混排,逐字节相等。

★ 模块顶层必须零副作用:pytest 在**收集期**就 import 全部测试模块 —— 首版在顶层
  `sys.path.insert(websrv)` 并 import kinastro_common,其 import 链的副作用把先跑的
  test_india_ephemeris_degrade(chiron 星历改名)搞红(--ignore 本文件即转绿,实测定位)。
  修法 = import 全部下沉到用例体内(websrv 是包,conftest 的 astropy 根路径已可达)。
"""


def _mod():
    from websrv.kentang import kinastro_common
    return kinastro_common


def _legacy(text, repl):
    for old, new in repl.items():
        text = text.replace(old, new)
    return text


def test_invariants_that_make_translate_equivalent():
    m = _mod()
    repl = m.DISPLAY_REPLACEMENTS
    assert all(len(k) == 1 and len(v) == 1 for k, v in repl.items()), \
        "多字符映射会让 translate 与逐项 replace 不等价 —— 加多字符项必须先改 display_text 实现"
    chain = set(repl.values()) & set(repl.keys())
    identity = {k for k, v in repl.items() if k == v}
    assert chain <= identity, \
        f"链式替换出现(值又是键):{sorted(chain - identity)} —— 顺序敏感,translate 不再等价"
    assert m._DISPLAY_TRANS is not None


def test_exhaustive_singletons_and_pairs():
    m = _mod()
    repl = m.DISPLAY_REPLACEMENTS
    alphabet = sorted(set(repl.keys()) | set(repl.values()))
    for ch in alphabet:
        assert ch.translate(m._DISPLAY_TRANS) == _legacy(ch, repl)
    for a in alphabet:
        for b in alphabet:
            s = a + b
            assert s.translate(m._DISPLAY_TRANS) == _legacy(s, repl)


def test_mixed_realistic_strings():
    m = _mod()
    repl = m.DISPLAY_REPLACEMENTS
    samples = [
        "None", "祿存在命宮,體用雙全", "abc 逆行 123", "", "剋應:大凶,宜靜不宜動",
        "翌日雞鳴,馬到功成 None 後記", "廟旺利益顯達 · 紅鸞天喜",
    ]
    for s in samples:
        assert s.translate(m._DISPLAY_TRANS) == _legacy(s, repl)
