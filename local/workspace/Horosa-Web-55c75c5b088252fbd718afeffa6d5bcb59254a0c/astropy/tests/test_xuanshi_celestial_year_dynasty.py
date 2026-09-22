# -*- coding: utf-8 -*-
"""[Q-486/T-448][Q-485/T-447][Q-484/T-446][Q-483/T-445] 玄学史 · 天象年份 / 朝代 / 微年表类筛 / 地图朝代计数。

判别向量全部取自取证行(改前红、改后绿):
  · date_phrase_to_year('大中祥符四年二月壬辰') 曾=847(被「大中」截走),应 1011;
  · SONG-TW-00039 year 847→1011;XTS-TW-00409「上元元年」674→760(按 modern_date 择近);
  · SONG-TW-00145「紹興元年」dynasty 北宋→南宋(1131 年);
  · 微年表 omen_type=星变 曾 11,239 条(LIKE 子串),应等于左栏归一类计数 30;
  · 地图 period=唐 页头曾 1,497(全时期),应 63;西安 610→19。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.xuanshi.period import date_phrase_to_year  # noqa: E402
from astrostudy.xuanshi import celestial as C  # noqa: E402
from astrostudy.xuanshi import queries as Q  # noqa: E402


def test_era_parse_longest_prefix_emperor_prefix_and_alias():
    assert date_phrase_to_year('大中祥符四年二月壬辰') == 1011      # 最长前缀(此前 847)
    assert date_phrase_to_year('大中三年') == 849                   # 短年号本身不受影响
    assert date_phrase_to_year('建中靖国元年') == 1101              # 此前 780
    assert date_phrase_to_year('建中靖國元年') == 1101              # 繁体亦解(库内 27 条)
    assert date_phrase_to_year('泰定帝泰定四年') == 1327            # 剥「某帝」前缀(此前只返元年 1324)
    assert date_phrase_to_year('上元元年五月癸丑', hint_year=760) == 760   # 同名年号按 modern_date 择近
    assert date_phrase_to_year('上元元年五月癸丑', hint_year=674) == 674
    assert date_phrase_to_year('上元元年五月癸丑') == 674           # 无提示沿用表内首个(旧行为)
    assert date_phrase_to_year('天寶五載五月壬子') == 746            # 「载」亦作年(此前恒返 742)
    assert date_phrase_to_year('隆興元年') == 1163                  # 繁体年号(库内 39% 条目)
    assert date_phrase_to_year('三十一年') is None                  # 无年号 → None(调用方沿用库值)


def test_effective_year_prefers_fixed_parse_and_falls_back_to_stored():
    assert C.effective_year('大中祥符四年二月壬辰', 847, '1011-03-08') == 1011
    assert C.effective_year('上元元年五月癸丑', 674, '0760-07-11') == 760
    assert C.effective_year('三十一年', 1234, '1234-05-06') == 1234      # 解析不了 → 库值
    assert C.effective_year(None, 999, None) == 999


def test_effective_dynasty_regroups_by_year_but_keeps_consistent_history_labels():
    assert C.effective_dynasty('北宋', 1131) == '南宋'
    assert C.effective_dynasty('北宋', 1127) == '北宋'      # 边界含端点
    assert C.effective_dynasty('北宋', 1128) == '北宋'      # ±1 年容农历跨年
    assert C.effective_dynasty('西晋', 320) == '东晋'
    assert C.effective_dynasty('辽', 1000) == '辽'          # 史书归属正确者不动(不被北宋覆盖)
    assert C.effective_dynasty('金', 1200) == '金'
    assert C.effective_dynasty(None, 1131) == '南宋'
    assert C.effective_dynasty('北魏', 500) == '北魏'        # 非大朝代名原样


def test_judgement_vectors_from_db():
    ev = C.load_events(True)
    by = {e['event_id']: e for e in ev}
    assert by['SONG-TW-00039']['year'] == 1011
    assert by['XTS-TW-00409']['year'] == 760
    assert by['SONG-TW-00145']['dynasty'] == '南宋'
    assert sum(1 for e in ev if e['dynasty'] == '北宋' and e['year'] and e['year'] > 1127) == 0
    # ±1 年容农历跨年(effective_dynasty 文档口径):TWCHRON-01441 无年号、公历 0317-01-29(东晋三月才建)→ 317 仍归西晋
    assert sum(1 for e in ev if e['dynasty'] == '西晋' and e['year'] and e['year'] > 317) == 0
    # [TL-36/T-217] 有公历日期的天象不再落「无年」(此前 10,256 条被起年 / 终年筛选整体排除)
    assert sum(1 for e in ev if e['year'] is None and e.get('modern_date')) == 0
    assert by['TWCHRON-01441']['year'] == 317
    # 大中祥符 404 条不再落 840 年代
    assert sum(1 for e in ev if (e['date_phrase'] or '').startswith('大中祥符') and e['year'] == 847) == 0


def test_microchronology_canonical_omen_matches_sidebar_count_and_decade_uses_effective_year():
    r = C.microchronology(omen_type='星变')
    by_omen = dict(r['summary']['by_omen'])
    assert len(r['events']) == by_omen.get('星变')          # 点开数 == 列表旁计数(此前 11,239 vs 30)
    assert all(e['omen'] == '星变' for e in r['events'])
    r2 = C.microchronology(decade=1010)
    assert r2['events'] and all(1010 <= e['year'] < 1020 for e in r2['events'])
    assert any((e['date_phrase'] or '').startswith('大中祥符') for e in r2['events'])   # 曾落在 840 年代


def test_map_points_period_counts():
    r = Q.map_points('唐')
    pts = r['points']
    assert sum(p['count'] for p in pts) == 63
    assert sum(p['count_all'] for p in pts) == 1497
    xa = next(p for p in pts if p['modern'] and '西安' in p['modern'])
    assert xa['count'] == 19 and xa['count_all'] == 610
    assert [p['count'] for p in pts] == sorted((p['count'] for p in pts), reverse=True)   # 朝代视图按该期重排
    r0 = Q.map_points(None)
    assert all(p['count'] == p['count_all'] for p in r0['points'])                     # 全时期视图不变
