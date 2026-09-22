# T-50:十二分盘自本座起算(dodecatemoria / D12),不是自白羊起算的 12 次谐波。
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from astrostudy.thirteenthchart import DodecatemoriaChart  # noqa: E402


def test_dodecatemoria_lon_own_sign_start():
    f = DodecatemoriaChart.dodecatemoriaLon
    # 金牛 5°(lon 35):第 2 段 → 自金牛起数 2 座 = 巨蟹;段内 (5×12) mod 30 = 0 → 90.0(12 次谐波会给 60 = 双子,错)
    assert abs(f(35.0) - 90.0) < 1e-9
    # 白羊 0°:自本座第 0 段 → 白羊 0°(与谐波盘唯一重合的座)
    assert abs(f(0.0) - 0.0) < 1e-9
    # 白羊 29.9°:第 11 段 → 双鱼;段内 (29.9×12) mod 30 = 358.8 mod 30 = 28.8 → 330 + 28.8
    assert abs(f(29.9) - 358.8) < 1e-9
    # 天蝎 10°(lon 220):第 4 段 → 自天蝎起 4 座 = 双鱼(index 11);段内 (10×12) mod 30 = 0 → 330
    assert abs(f(220.0) - 330.0) < 1e-9
    # 每座 12 段各落不同座、走完一圈
    seen = {int(f(120.0 + k * 2.5) // 30) for k in range(12)}   # 狮子座 12 段
    assert seen == set(range(12))


def test_dodecatemoria_differs_from_harmonic12_for_11_of_12_signs():
    f = DodecatemoriaChart.dodecatemoriaLon
    same = 0
    for sign in range(12):
        lon = sign * 30 + 5.0
        h12 = (lon * 12) % 360
        if abs(f(lon) - h12) < 1e-9:
            same += 1
    assert same == 1   # 只有白羊座重合
