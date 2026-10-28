"""蠢子数自动刻:按时辰内位置推刻(一时辰十刻、每刻 12 分;时辰从奇数点起)。只看分钟会让 6–10 刻永远到不了。"""
import datetime

import pytest

from websrv.webchunzisrv import _auto_ke


@pytest.mark.parametrize('hh,mm,ke', [
    (10, 0, 6), (10, 30, 8), (11, 30, 3), (0, 50, 10), (23, 59, 5),
    (23, 0, 1), (0, 0, 6), (1, 11, 1), (1, 12, 2), (2, 59, 10), (12, 0, 6), (13, 0, 1),
])
def test_auto_ke_table(hh, mm, ke):
    assert _auto_ke(datetime.datetime(2026, 3, 10, hh, mm)) == ke


def test_every_ke_reachable_and_each_shichen_covers_all_ten():
    seen = set()
    for start in range(-1, 23, 2):          # 每个时辰的起点(子时从前一日 23 点)
        kes = []
        for k in range(120):
            h = (start + k // 60) % 24
            m = k % 60
            kes.append(_auto_ke(datetime.datetime(2026, 3, 10, h, m)))
        assert kes == sorted(kes) and kes[0] == 1 and kes[-1] == 10
        assert [kes.count(n) for n in range(1, 11)] == [12] * 10
        seen.update(kes)
    assert seen == set(range(1, 11))
