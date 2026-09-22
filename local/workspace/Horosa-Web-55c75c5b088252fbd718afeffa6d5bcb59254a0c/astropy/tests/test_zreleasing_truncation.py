# [Q-362/T-343] 黄道释放:末段子期按父期截断(下级同截)并打 truncated 标;
# 此前只让游标少走、子项 days 保留全长 → 每个 L1 的末 L2 讫日超出所属 L1 90–390 天。
from flatlib import const
from flatlib.datetime import Datetime

from astrostudy import zreleasing


def _lv(start_sign, stop):
    return zreleasing.computeLevel(start_sign, Datetime('1998/04/06', '12:00', '+08:00'), 0, stop, '+08:00')


def test_l2_sum_equals_l1_and_last_truncated():
    lv = _lv(const.GEMINI, 1)
    subs = lv['sublevel']
    assert lv['days'] == 7200
    assert sum(x['days'] for x in subs) == lv['days']
    assert subs[-1]['sign'] == const.CAPRICORN and subs[-1]['days'] == 510 and subs[-1].get('truncated') is True
    assert all(not x.get('truncated') for x in subs[:-1])


def test_deeper_levels_never_overflow_parent():
    lv = _lv(const.GEMINI, 3)
    def walk(node):
        subs = node.get('sublevel') or []
        if subs:
            assert sum(x['days'] for x in subs) <= node['days'] + 1e-6   # L3/L4 为分数日,只容浮点噪声
            for c in subs:
                walk(c)
    walk(lv)


def test_exact_fit_keeps_full_length_untouched():
    # 白羊 15 年 L1=5400 日;L2 逐座 15/8/20… 月单位:最后一段是否截断由累计决定,未被截的段不带标
    lv = _lv(const.ARIES, 1)
    subs = lv['sublevel']
    assert sum(x['days'] for x in subs) == lv['days']
    for x in subs[:-1]:
        assert 'truncated' not in x
