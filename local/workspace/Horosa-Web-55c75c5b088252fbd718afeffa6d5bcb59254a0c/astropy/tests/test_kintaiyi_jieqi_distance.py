# kintaiyi.jieqi.distancejq 金标:【全年份域】+【当前节气口径】双判据。
#
# 背景(两条独立的病,一前一后各栽一次):
#   ① 口径病(v3.7.3 修):旧实现 `Date(now) - find_jq_date(year-1, ...)` —— find_jq_date 自
#      给定日期【向后】连搜 24 个节气取同名者,传 year-1 取到的是【去年】的同名节气。所求
#      节气落在当前日期之前时结果正确,落在当天或之后时整整多 365 天。唯一调用方
#      config.starhouse 又对结果做环绕,两者叠加成系统性偏移(二十八宿值日整体错位)。
#   ② 年份域病(v3.7.3 同轮修补):①的首版改用 `datetime.datetime(year, ...)` 取 now ——
#      而 datetime 只支持公元 1..9999,本函数经 starhouse 服务于太乙【全年份域】。公元前
#      1 年 / 16798 年直接 `ValueError: year out of range`,炸掉整个 taiyi/pan
#      (test_kentang_extreme_years 三例转红)。今全程走 ephem.Date(BC 与远未来皆可)。
#
# 本文件是【纯单元】金标:不依赖 :8899 在线,故在任何环境都跑得到 —— 极端年矩阵
# (test_kentang_extreme_years)要服务在线才跑,单靠它守不住 CI/离线自检。
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kintaiyi", "src"))

from kintaiyi.jieqi import distancejq, jq  # noqa: E402


# 判据①:距【当前所在节气】起始的天数,必落 0..16(节气间隔 14~16 日,故上界取 16)。
# 若回潮成 year-1 写法,「所求节气在当天或之后」的用例会返回 365+,一眼判死。
NORMAL_CASES = [
    (2026, 7, 14, 10, 30),
    (2025, 3, 20, 10, 30),   # 旧实现此例返回 365(应约 0)
    (2026, 6, 15, 10, 30),
    (1900, 1, 5, 0, 0),
    (2400, 11, 9, 12, 0),
    (2, 1, 1, 0, 0),         # 近 datetime 支持域下边界(jq() 内部会外推到前一年,故留 1 年余量)
    (9998, 6, 1, 0, 0),      # 近 datetime 支持域上边界(同上,留余量)
]

# 判据②:datetime 域外年只要求「不抛异常」—— 值本身由回退路径给出,精度不作断言
# (BC 的节气本就依赖外推),但绝不允许炸:一炸整个 taiyi/pan 就 500。
OUT_OF_RANGE_CASES = [
    (-1, 6, 15, 10, 30),
    (-500, 3, 1, 0, 0),
    (0, 6, 15, 10, 30),      # 天文年 0 = 公元前 1 年,datetime 亦不接受
    (10000, 1, 1, 0, 0),
    (16798, 6, 15, 10, 30),
]


@pytest.mark.parametrize('year,month,day,hour,minute', NORMAL_CASES)
def test_distancejq_within_one_jieqi(year, month, day, hour, minute):
    name = jq(year, month, day, hour, minute)
    d = distancejq(year, month, day, hour, minute, name)
    assert isinstance(d, int)
    assert 0 <= d <= 16, (
        '距当前节气 %s 天超出一个节气的跨度(%s-%s-%s %s:%s 节气=%s)——'
        '典型病因是回潮成 find_jq_date(year-1, ...) 取到了去年的同名节气' % (
            d, year, month, day, hour, minute, name)
    )


@pytest.mark.parametrize('year,month,day,hour,minute', OUT_OF_RANGE_CASES)
def test_distancejq_survives_out_of_datetime_range(year, month, day, hour, minute):
    # 反向锚:任何用 datetime.datetime(year, ...) 取 now 的写法都会在此 ValueError。
    d = distancejq(year, month, day, hour, minute, '夏至')
    assert isinstance(d, int)


def test_starhouse_out_of_range_years_return_a_su():
    # 端到端:starhouse 是 distancejq 的唯一调用方,域外年必须照常给出二十八宿之一。
    from kintaiyi import config
    for year in (-1, 16798):
        su = config.starhouse(year, 6, 15, 10, 30)
        assert su in config.su, '%s 年得到非法宿名 %r(应为二十八宿之一)' % (year, su)
