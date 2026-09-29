# -*- coding: utf-8 -*-
"""[#55 / #73] 天象库单一历法约定的机械锁:
① 年号纪年解析出的年份与 modern_date 年份不得相差 ≥ 2 年(农历跨年允许差 1);
② `julian_date` 列全库为空(#73:modern_date 就是史料所载的儒略历日期,1582-10-15 前;旧 julian_date 是换算方向做反的错列);
③ 全库精度 exact_day / exact_hour 且所载干支日可解析的行,modern_date 按儒略历推的干支日必须等于所载干支(JDN 独立推算,不依赖历法引擎;
   #55 的 59 行年号错位 + 23 行干支日不合已重推,#73 的 8,349 行经同一判据 100% 自证;上限钉 0 只减不增);
④ 精度 month 且所载农历月可解析的行,modern_date 按儒略历读必须落在所记农历月(含闰)之内(上游月级行是「合成到该月某一天」,
   不要求初一;寿星历法引擎复核)。"""
import os, re, sqlite3
from astrostudy.xuanshi.period import date_phrase_to_year

DB = os.path.join(os.path.dirname(__file__), '..', 'astrostudy', 'xuanshi', 'data', 'public_data.sqlite')
TG = '甲乙丙丁戊己庚辛壬癸'; DZ = '子丑寅卯辰巳午未申酉戌亥'


def _jdn_julian(y, m, d):
    a = (14 - m) // 12; yy = y + 4800 - a; mm = m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - 32083


def _jdn_greg(y, m, d):
    a = (14 - m) // 12; yy = y + 4800 - a; mm = m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045


_OFF = None


def _gz(jdn):
    global _OFF
    if _OFF is None:  # 锚:2000-01-01(格里)= 戊午日
        idx = next(i for i in range(60) if i % 10 == TG.index('戊') and i % 12 == DZ.index('午'))
        _OFF = (idx - _jdn_greg(2000, 1, 1)) % 60
    i = (jdn + _OFF) % 60
    return TG[i % 10] + DZ[i % 12]


def _year_of(md):
    m = re.match(r'^(-?\d{1,4})-', md or '')
    return int(m.group(1)) if m else None


def _rows():
    conn = sqlite3.connect('file:%s?mode=ro' % os.path.abspath(DB), uri=True); conn.row_factory = sqlite3.Row
    try:
        return conn.execute('SELECT event_id, date_phrase, modern_date, julian_date, modern_precision FROM celestial_event').fetchall()
    finally:
        conn.close()


def test_sexagenary_anchor_is_sane():
    assert _gz(_jdn_greg(1949, 10, 1)) == '甲子'
    assert _gz(_jdn_greg(2000, 1, 1)) == '戊午'


def test_era_year_matches_modern_date_year():
    bad = []
    for r in _rows():
        md = r['modern_date']; my = _year_of(md)
        y = date_phrase_to_year(r['date_phrase'], hint_year=my)
        if y is not None and my is not None and abs(y - my) >= 2:
            bad.append((r['event_id'], r['date_phrase'], md, y))
    assert bad == [], '年号纪年与 modern_date 年份相差 ≥2 年:%d 行,例 %s' % (len(bad), bad[:5])


def test_julian_date_column_is_retired():
    """#73:全库 julian_date 为空 —— 单一约定,前端「无 julian_date 且改历前 → 儒略历」路径即正确路径。"""
    n = sum(1 for r in _rows() if r['julian_date'])
    assert n == 0, 'julian_date 列应整列为空,仍有 %d 行带值' % n


def test_rows_carry_the_stated_sexagenary_day():
    """全库 exact_day / exact_hour 行:modern_date(儒略历口径)的儒略 JDN 干支必须等于所载干支(上限钉 0 只减不增)。"""
    checked = 0; bad = []
    for r in _rows():
        if r['modern_precision'] not in ('exact_day', 'exact_hour'):
            continue
        m = re.search(r'月([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])', r['date_phrase'] or '')
        mm = re.match(r'^(\d{4})-(\d{2})-(\d{2})', r['modern_date'] or '')
        if not m or not mm:
            continue
        y, mo, d = (int(x) for x in mm.groups())
        if (y, mo, d) >= (1582, 10, 15):
            continue
        checked += 1
        if _gz(_jdn_julian(y, mo, d)) != m.group(1):
            bad.append((r['event_id'], r['date_phrase'], r['modern_date'], _gz(_jdn_julian(y, mo, d))))
    assert checked >= 18000, checked
    assert len(bad) <= 0, ('干支日不合:%d 行,例 %s' % (len(bad), bad[:5]))


def test_month_precision_rows_fall_inside_the_stated_lunar_month():
    """精度 month 的行:modern_date(儒略历口径)必须落在所记农历月(含闰)之内(寿星历法引擎复核;上限钉 0 只减不增)。"""
    import sxtwl
    CN = {'正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12, '冬': 11, '臘': 12, '腊': 12}
    checked = 0; bad = []
    for r in _rows():
        if r['modern_precision'] != 'month':
            continue
        pm = re.search(r'(閏|闰)?(正|十一|十二|一|二|三|四|五|六|七|八|九|十|冬|臘|腊)月', r['date_phrase'] or '')
        mm = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', r['modern_date'] or '')
        if not pm or not mm:
            continue
        y, mo, d = (int(x) for x in mm.groups())
        if (y, mo, d) >= (1582, 10, 15):
            continue
        checked += 1
        dd = sxtwl.fromSolar(y, mo, d)
        if dd.getLunarMonth() != CN[pm.group(2)] or bool(dd.isLunarLeap()) != bool(pm.group(1)):
            bad.append((r['event_id'], r['date_phrase'], r['modern_date'], dd.getLunarMonth(), dd.getLunarDay(), bool(dd.isLunarLeap())))
    assert checked >= 1500, checked
    assert len(bad) <= 0, ('月级行不在所记农历月内:%d 行,例 %s' % (len(bad), bad[:5]))
