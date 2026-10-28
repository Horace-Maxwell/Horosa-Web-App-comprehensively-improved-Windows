"""玄史检索词:一个关键词可以带几种写法(任一写法命中即算)。

库里的文字简繁混存(史书原文多是繁体,标题 / 白话 / 词条多是简体)。前端把用户输入连同它的简体归一写法、
繁体写法一起发来(``q`` + ``q_any``);这里把它们合成一个「写法列表」,过滤时任一写法命中即算 ——
照屏幕输入繁体、直接输入简体,都能同时搜到繁体原文与简体字段。

简繁写法由后端自己补全(``script_variants``,运行时自带的简繁转换库):不论请求从哪来(桌面页面、
无头 / MCP、命令行、旧前端、只发 ``q`` 的客户端),同一个检索词得到同一组写法、同一批结果。
前端仍可多发写法(``q_any``),两边取并集。检索词不含可转换的字时(纯拉丁字母 / 数字 / 简繁同形),
结果与只按原词检索逐字节相同。
"""
from __future__ import annotations

from typing import Any, Optional, Union

QueryLike = Union[str, tuple, list, None]

# 写法个数 / 单个写法长度上限(防异常请求把过滤放大)
MAX_ALTS = 6
MAX_LEN = 200


_CONVERTERS: Optional[tuple] = None


def _converters() -> tuple:
    """(繁→简, 简→繁) 两个转换函数;运行时缺转换库时两个都是 None(只按原词与 q_any 检索)。"""
    global _CONVERTERS
    if _CONVERTERS is not None:
        return _CONVERTERS
    t2s = s2t = None
    try:
        from opencc import OpenCC  # opencc-python-reimplemented(requirements 已声明)

        _t2s, _s2t = OpenCC("t2s"), OpenCC("s2t")
        t2s, s2t = _t2s.convert, _s2t.convert
    except Exception:  # noqa: BLE001 — 缺库 / 词典坏时退到 zhconv
        try:
            from zhconv import convert as _zh

            t2s = lambda x: _zh(x, "zh-hans")  # noqa: E731
            s2t = lambda x: _zh(x, "zh-hant")  # noqa: E731
        except Exception:  # noqa: BLE001
            t2s = s2t = None
    _CONVERTERS = (t2s, s2t)
    return _CONVERTERS


def script_variants(s: Optional[str]) -> list[str]:
    """一个检索词的简体归一写法与繁体写法(去掉与原词相同的);空 / 超长 / 缺转换库 → []。"""
    if not s or len(s) > MAX_LEN:
        return []
    out: list[str] = []
    for fn in _converters():
        if fn is None:
            continue
        try:
            v = str(fn(s) or "").strip()
        except Exception:  # noqa: BLE001
            continue
        if v and v != s and v not in out and len(v) <= MAX_LEN:
            out.append(v)
    return out


def merge(base: Optional[str], extra: Any) -> QueryLike:
    """``q`` + 后端补全的简繁写法 + ``q_any`` → 单个字符串(没有别的写法时原样返回 base)或去重保序的元组。"""
    alts: list[str] = []
    if isinstance(extra, (list, tuple)):
        for x in extra:
            s = str(x if x is not None else "").strip()
            if s and len(s) <= MAX_LEN:
                alts.append(s)
    head = base or (alts[0] if alts else None)
    # 后端自己补写法:只发 q 的客户端(无头 / 命令行 / 旧前端)与页面同口径
    alts = script_variants(head) + alts
    if not alts:
        return base
    out: list[str] = []
    for s in ([head] if head else []) + alts:
        if s not in out:
            out.append(s)
        if len(out) >= MAX_ALTS:
            break
    if len(out) == 1:
        return out[0]
    return tuple(out)


def alternatives(q: QueryLike) -> list[str]:
    """写法列表(不改大小写、不去空白;单个字符串原样)。空 → []。"""
    if q is None:
        return []
    if isinstance(q, (list, tuple)):
        out: list[str] = []
        for x in q:
            s = str(x if x is not None else "")
            if s and s not in out:
                out.append(s)
        return out
    s = str(q)
    return [s] if s else []


def lowered(q: QueryLike) -> list[str]:
    """子串比对用:每个写法去空白、转小写,去掉空的(单个字符串与原先 ``q.strip().lower()`` 同口径)。"""
    out: list[str] = []
    for s in alternatives(q):
        t = s.strip().lower()
        if t and t not in out:
            out.append(t)
    return out


def hits(hay_lower: str, alts_lower: list[str]) -> bool:
    return any(a in hay_lower for a in alts_lower)


def like_any(cols: list[str], q: QueryLike) -> tuple[str, list[str]]:
    """SQL:任一列 LIKE 任一写法。单个写法时与原先 ``(c1 LIKE ? OR c2 LIKE ? …)`` 逐字相同。"""
    alts = alternatives(q)
    params: list[str] = []
    groups: list[str] = []
    for a in alts:
        like = f"%{a}%"
        groups.append("(" + " OR ".join(f"{c} LIKE ?" for c in cols) + ")")
        params.extend([like] * len(cols))
    if len(groups) == 1:
        return groups[0], params
    return "(" + " OR ".join(groups) + ")", params
