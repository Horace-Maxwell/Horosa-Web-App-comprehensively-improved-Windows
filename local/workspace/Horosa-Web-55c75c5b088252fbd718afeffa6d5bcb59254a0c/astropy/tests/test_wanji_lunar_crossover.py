"""皇极经世:公历一月而农历仍在腊月的日子,只有会运世 / 年表按农历年(上一年),四柱、节气与显示日期按原公历日期。
此前整组按上一年同月同日算(1990-01-01 出成 1989-01-01 的四柱)。判据:① 钉值 ② 跨年前后日柱逐日连续 ③ 不在腊月的日子不受影响。"""
import os
import sys

HERE = os.path.dirname(__file__)
for p in ('..', '../../vendor', '../../vendor/kinwangji', '../../flatlib-ctrad2'):
    sys.path.insert(0, os.path.abspath(os.path.join(HERE, p)))

from kinwangji.wanji import wanji_four_gua  # noqa: E402

GAN = '甲乙丙丁戊己庚辛壬癸'
ZHI = '子丑寅卯辰巳午未申酉戌亥'


def _idx(gz):
    return next(i for i in range(60) if GAN[i % 10] == gz[0] and ZHI[i % 12] == gz[1])


def test_pinned_values():
    r = wanji_four_gua(1990, 1, 1, 8, 0)
    assert r['日期'] == '1990-01-01 08:00'
    assert r['干支'][:3] == ['己巳', '丙子', '丙寅']


def test_day_pillar_continuous_across_crossover():
    days = [(1989, 12, 30), (1989, 12, 31), (1990, 1, 1), (1990, 1, 2), (1990, 1, 26), (1990, 1, 27)]
    idx = [_idx(wanji_four_gua(y, m, d, 12, 0)['干支'][2]) for y, m, d in days]
    assert (idx[1] - idx[0]) % 60 == 1 and (idx[2] - idx[1]) % 60 == 1 and (idx[3] - idx[2]) % 60 == 1
    assert (idx[5] - idx[4]) % 60 == 1


def test_cycle_still_follows_lunar_year():
    # 腊月里的一月日子与前一天(上一年十二月)同一个会运世与年卦
    a = wanji_four_gua(1989, 12, 31, 8, 0)
    b = wanji_four_gua(1990, 1, 1, 8, 0)
    assert (a['會'], a['運'], a['世'], a['年卦']) == (b['會'], b['運'], b['世'], b['年卦'])


def test_outside_twelfth_month_unchanged():
    r = wanji_four_gua(1990, 3, 1, 8, 0)
    assert r['日期'] == '1990-03-01 08:00'
    assert r['干支'][:3] == ['庚午', '戊寅', '乙丑']


def test_cycle_year_is_lunar_year_everywhere():
    # 统一按农历年:二月里的腊月日子、一月里的十一月日子都与农历同年的日子同一个会运世
    from kinwangji.wanji import lunar_date_d
    for y, m, d in [(1985, 2, 10), (2001, 1, 10), (2023, 1, 10)]:
        assert lunar_date_d(y, m, d).get('年') == y - 1
        a = wanji_four_gua(y, m, d, 8, 0)
        b = wanji_four_gua(y - 1, 12, 1, 8, 0)
        assert (a['會'], a['運'], a['世']) == (b['會'], b['運'], b['世'])
