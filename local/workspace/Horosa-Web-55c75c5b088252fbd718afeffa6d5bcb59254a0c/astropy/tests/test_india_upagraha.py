# -*- coding: utf-8 -*-
"""副星 + 特殊上升 结构/不变量 + 权威例 golden。

- 日基 5 副星链：纯偏移链(Dhuma=日+133°20'…)，与权威例数值对齐(日 249°36′→Dhuma 22.93°Ar)。
- 时基 6 副星：昼/夜 8 段段主显式表(7 曜 + 1 空段)，段主由逐行表查；取点 mid/start。
- 特殊上升 BL/HL/GL/SL：日出太阳经度 + 历时推进 / 月宿进度。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from astrostudy.india.upagraha import (  # noqa: E402
    sun_based_upagrahas, special_lagnas, time_based_segment,
    _DAY_SEGMENT_LORDS, _NIGHT_SEGMENT_LORDS,
)

_PLANETS7 = {'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'}


# ── 日基 5 副星 ──────────────────────────────────────────────────────────
def test_sun_based_chain():
    u = sun_based_upagrahas(0.0)
    assert len(u) == 5
    d = {x['key']: x['lon'] for x in u}
    assert abs(d['Dhuma'] - (133 + 20 / 60)) < 1e-6
    assert abs(d['Vyatipata'] - ((360 - d['Dhuma']) % 360)) < 1e-6
    assert abs(d['Parivesha'] - ((d['Vyatipata'] + 180) % 360)) < 1e-6
    assert abs(d['Indrachapa'] - ((360 - d['Parivesha']) % 360)) < 1e-6
    assert abs(d['Upaketu'] - ((d['Indrachapa'] + 16 + 40 / 60) % 360)) < 1e-6


def test_sun_based_golden_dhuma():
    """权威例：太阳 9 Sg 36 = 249°36′ → Dhuma 22°56′ Aries(≈22.933°)。"""
    sun = 249.0 + 36.0 / 60.0
    u = {x['key']: x['lon'] for x in sun_based_upagrahas(sun)}
    dhuma = u['Dhuma']
    assert int(dhuma // 30) == 0                      # 落 Aries(0 号星座)
    assert abs(dhuma - (22.0 + 56.0 / 60.0)) < 1e-2   # 22°56′ ≈ 22.933°
    # Upaketu ≡ 日 − 30°(链尾恒等式)。
    assert abs(u['Upaketu'] - ((sun - 30.0) % 360.0)) < 1e-6


def test_sun_based_all_in_range():
    for s in (0.0, 90.0, 200.0, 359.9):
        assert all(0 <= x['lon'] < 360 for x in sun_based_upagrahas(s))


# ── 时基副星：段主显式表结构自检 ──────────────────────────────────────────
def test_segment_tables_structure():
    """每行(昼/夜 × 7 星期)恰 8 段 = 7 个互异曜 + 1 个空段(None)。"""
    for table in (_DAY_SEGMENT_LORDS, _NIGHT_SEGMENT_LORDS):
        assert set(table.keys()) == set(range(7))
        for weekday, lords in table.items():
            assert len(lords) == 8, (weekday, lords)
            assert lords.count(None) == 1, (weekday, lords)
            named = [x for x in lords if x is not None]
            assert set(named) == _PLANETS7, (weekday, named)   # 7 曜齐全无重


def test_segment_empty_slot_always_last():
    """空段恒为第 8 段(通行口径:首段=vara 主顺推 7 曜,末段无主)。
    🔴 旧口径「空段紧跟土曜」已证伪:空段随星期游走会把土后诸曜整体推后一段
    (Kala/Mrityu/Artha/Yama 偏约昼长/8);本守卫改锁正口径。"""
    for table in (_DAY_SEGMENT_LORDS, _NIGHT_SEGMENT_LORDS):
        for lords in table.values():
            assert lords.index(None) == 7
            assert len([x for x in lords if x]) == 7 and len(set(lords)) == 8


def test_segment_tables_closed_form():
    """闭式逐格锁死整表(独立 oracle,不引模块内序常量):
    昼行 w 第 i 段 = 七曜星期序[(w+i)%7](首段即当日 vara 主,0=日…6=土);
    夜行 w 第 i 段 = 七曜星期序[(w+4+i)%7](夜首=同日昼序第 5 曜,同序续排);第 8 段恒 None。
    🔴 「7 曜互异 + 空段在尾」锁不住任意行内置换 —— 把某行改成乱序 7 曜旧断言照绿,
    而 Gulika/Kala/Mrityu 等全部取错段;逐格闭式才与表逐字等价。"""
    week_order = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
    for w in range(7):
        for i in range(7):
            assert _DAY_SEGMENT_LORDS[w][i] == week_order[(w + i) % 7], ('day', w, i)
            assert _NIGHT_SEGMENT_LORDS[w][i] == week_order[(w + 4 + i) % 7], ('night', w, i)
        assert _NIGHT_SEGMENT_LORDS[w][0] == _DAY_SEGMENT_LORDS[w][4], ('night-first=day-5th', w)


# ── 时基副星：段查 + 取点 ─────────────────────────────────────────────────
def test_time_based_segment_saturday_day_gulika():
    """土曜白天：起段=土 → Gulika(土段)在第 0 段，取中点。"""
    g = time_based_segment('Gulika', 6, night=False)
    assert g['segment'] == 0 and g['point'] == 'mid' and g['planet'] == 'Saturn'


def test_time_based_segment_maandi_takes_start():
    """Maandi 与 Gulika 同段(土段)，但取段起点。"""
    m = time_based_segment('Maandi', 6, night=False)
    assert m['segment'] == 0 and m['point'] == 'start' and m['planet'] == 'Saturn'


def test_time_based_segment_sunday_day_gulika():
    """日曜白天段主序 日月火水木金土— → Saturn 在第 6 段。"""
    assert time_based_segment('Gulika', 0, night=False)['segment'] == 6


def test_time_based_segment_sunday_day_kala():
    """日曜白天起段=日 → Kala(日段)在第 0 段，取中点。"""
    k = time_based_segment('Kala', 0, night=False)
    assert k['segment'] == 0 and k['point'] == 'mid' and k['planet'] == 'Sun'


def test_time_based_segment_sunday_night_gulika():
    """日曜夜段主序 木金土—日月火水 → Saturn 在第 2 段。"""
    assert time_based_segment('Gulika', 0, night=True)['segment'] == 2


def test_time_based_segment_all_six_resolvable_every_weekday():
    """6 时基副星 × 昼/夜 × 7 星期 全部可查段(0-7)；Maandi 始终 start，余 mid。"""
    for name in ('Kala', 'Mrityu', 'ArthaPrahara', 'YamaGhantaka', 'Gulika', 'Maandi'):
        for wd in range(7):
            for night in (False, True):
                seg = time_based_segment(name, wd, night=night)
                assert seg is not None, (name, wd, night)
                assert 0 <= seg['segment'] <= 7
                assert seg['point'] == ('start' if name == 'Maandi' else 'mid')


def test_time_based_segment_unknown_name():
    assert time_based_segment('Nope', 0) is None


# ── 特殊上升 ──────────────────────────────────────────────────────────────
def test_special_lagnas_elapsed_zero():
    sl = special_lagnas(100.0, 0.0, 50.0, 0.0)
    for k in ('bhavaLagna', 'horaLagna', 'ghatikaLagna'):
        assert abs(sl[k]['lon'] - 100.0) < 1e-9          # 历时 0 → 不推进
    assert abs(sl['sreeLagna']['lon'] - 50.0) < 1e-9     # 月在宿起点 → SL=lagna


def test_special_lagnas_advancement():
    sl = special_lagnas(0.0, 120.0, 0.0, 0.0)            # 120 分 = 5 ghati
    assert abs(sl['bhavaLagna']['lon'] - 30.0) < 1e-6    # BL 每 5 ghati 进 1 rasi
    assert abs(sl['horaLagna']['lon'] - 60.0) < 1e-6     # HL 每 2.5 ghati
    assert abs(sl['ghatikaLagna']['lon'] - 150.0) < 1e-6  # GL 每 1 ghati(最快)
    assert sl['ghatikaLagna']['lon'] > sl['horaLagna']['lon'] > sl['bhavaLagna']['lon']


def test_sree_lagna_moon_progress():
    nak = 360.0 / 27.0
    sl = special_lagnas(0.0, 0.0, 10.0, nak * 0.5)       # 月在本宿 50%
    assert abs(sl['sreeLagna']['lon'] - (10.0 + 180.0)) < 1e-6
