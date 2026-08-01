# -*- coding: utf-8 -*-
"""B1-B4 可插拔留空表 · 形状守卫。

🔴 双重职责:
① 表**空**时:锁「留空 + 优雅降级」契约(返回 None/不渲染,绝不臆造)——这些断言恒跑;
② 表**非空**时(将来录入原典后):校验形状(长度/键域/值域),防录入格式错——空表 skip。
"""
import pytest

from astrostudy.india import nadi_names, pushkara, pancha_pakshi
from astrostudy.india.sensitive_points import MRITYU_BHAGA


# ── ① 空表降级契约(恒跑) ──────────────────────────────────────────────

def test_empty_tables_degrade_gracefully():
    if not nadi_names.D150_NAMES:
        assert nadi_names.nadiamsa_name(1) is None
        assert nadi_names.nadiamsa_name(75, sign_is_odd=False) is None
    if not pushkara.PUSHKARA_NAVAMSA and not pushkara.PUSHKARA_BHAGA:
        assert pushkara.pushkara_flags(1, 15.0) == {'navamsa': None, 'bhaga': None}
    if not pancha_pakshi.BIRD_ACTIVITY_TABLE:
        assert pancha_pakshi.bird_card_available() is False
    if not MRITYU_BHAGA:
        from astrostudy.india.sensitive_points import mrityu_bhaga_hits
        assert mrityu_bhaga_hits({'Sun': 123.4}) is None


# ── ② 非空表形状校验(空表 skip) ──────────────────────────────────────

@pytest.mark.skipif(not nadi_names.D150_NAMES, reason='D150 专名表待录入(留空即契约)')
def test_d150_names_shape():
    assert len(nadi_names.D150_NAMES) == 150
    assert all(isinstance(x, str) and x for x in nadi_names.D150_NAMES)
    # 奇顺偶逆:偶座第 1 段 == 正序第 150 名
    assert nadi_names.nadiamsa_name(1, sign_is_odd=False) == nadi_names.D150_NAMES[149]


@pytest.mark.skipif(not pushkara.PUSHKARA_NAVAMSA, reason='Pushkara Navamsa 待录入')
def test_pushkara_navamsa_shape():
    assert set(pushkara.PUSHKARA_NAVAMSA.keys()) == set(range(1, 13))
    for pair in pushkara.PUSHKARA_NAVAMSA.values():
        assert len(pair) == 2 and all(1 <= n <= 9 for n in pair)


@pytest.mark.skipif(not pushkara.PUSHKARA_BHAGA, reason='Pushkara Bhaga 待录入')
def test_pushkara_bhaga_shape():
    assert set(pushkara.PUSHKARA_BHAGA.keys()) == set(range(1, 13))
    assert all(0.0 <= float(v) <= 30.0 for v in pushkara.PUSHKARA_BHAGA.values())


@pytest.mark.skipif(not pancha_pakshi.BIRD_ACTIVITY_TABLE, reason='五鸟活动表待录入')
def test_pancha_pakshi_shape():
    assert len(pancha_pakshi.BIRDS) == 5
    assert len(pancha_pakshi.ACTIVITIES) == 5
    for bird, spec in pancha_pakshi.BIRD_ACTIVITY_TABLE.items():
        assert bird in pancha_pakshi.BIRDS
        assert spec.get('paksha') in ('shukla', 'krishna')
        for half in ('day', 'night'):
            table = spec.get(half) or {}
            assert set(table.keys()) <= set(range(7))
            for seq in table.values():
                assert len(seq) == 5 and all(a in pancha_pakshi.ACTIVITIES for a in seq)


@pytest.mark.skipif(not MRITYU_BHAGA, reason='Mrityu Bhaga 表待录入')
def test_mrityu_bhaga_shape():
    for body, per_sign in MRITYU_BHAGA.items():
        assert isinstance(per_sign, dict) and per_sign
        assert all(0.0 <= float(d) <= 30.0 for d in per_sign.values())
