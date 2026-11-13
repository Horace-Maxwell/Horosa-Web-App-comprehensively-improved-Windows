# -*- coding: utf-8 -*-
"""horosa_win_float_golden_v1 的判别力自证:浮点末位与并列行次序放过,其余一律不放过。"""
import pytest

from win_float_golden import golden_equal

GOLD = {
    'name': 'sample', 'day': True, 'count': 3, 'none': None,
    'rows': [
        {'a': 'North Node', 'b': 'Mars', 'aspect': 0, 'orb': 3.0077981234},
        {'a': 'South Node', 'b': 'Mars', 'aspect': 180, 'orb': 3.0077981234},
        {'a': 'Sun', 'b': 'Moon', 'aspect': 90, 'orb': 1.25},
    ],
    'speedPct': 12.659563,
    'positions': [['Sun', 321.5], ['Moon', 146.923991]],
}


def clone(value):
    if isinstance(value, dict):
        return {key: clone(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clone(item) for item in value]
    return value


def test_identical_passes():
    assert golden_equal(clone(GOLD), GOLD)


def test_float_tail_passes():
    actual = clone(GOLD)
    actual['rows'][0]['orb'] += 4.3e-10
    actual['speedPct'] = 12.659538          # 差分速度:实测最大的一档(2.5e-5)
    actual['positions'][1][1] = 146.923992  # 6 位舍入边界
    assert golden_equal(actual, GOLD)


def test_tied_rows_in_another_order_pass():
    actual = clone(GOLD)
    actual['rows'][0], actual['rows'][1] = actual['rows'][1], actual['rows'][0]
    actual['rows'][0]['orb'] -= 2e-11
    assert golden_equal(actual, GOLD)


@pytest.mark.parametrize('mutate', [
    lambda a: a['rows'][2].__setitem__('orb', 1.2512),            # 0.0012 度 ≈ 4 角秒:算法级差异
    lambda a: a.__setitem__('speedPct', 12.6607),
    lambda a: a['rows'][2].__setitem__('aspect', 120),            # 整数必须相等
    lambda a: a.__setitem__('count', 3.0000001) or a.__setitem__('count', 4),
    lambda a: a['rows'][0].__setitem__('a', 'Mean Node'),         # 文字必须相等
    lambda a: a.__setitem__('day', 1),                            # 布尔不当数值
    lambda a: a.__setitem__('none', 0),
    lambda a: a['rows'].pop(),                                    # 少一行
    lambda a: a['rows'].append(clone(a['rows'][0])),              # 多一行
    lambda a: a['rows'][1].__setitem__('extra', 1),               # 多一个键
    lambda a: a['rows'][1].pop('b'),                              # 少一个键
    lambda a: a['rows'].__setitem__(1, clone(a['rows'][0])),      # 一对一配对:两行都长成同一行不算
    lambda a: a['positions'].__setitem__(0, ['Sun', 321.5003]),
])
def test_real_differences_fail(mutate):
    actual = clone(GOLD)
    mutate(actual)
    with pytest.raises(AssertionError):
        golden_equal(actual, GOLD)
