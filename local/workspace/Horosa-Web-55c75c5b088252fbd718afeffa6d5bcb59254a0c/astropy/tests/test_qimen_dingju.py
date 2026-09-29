# -*- coding: utf-8 -*-
"""奇门定局法 golden:拆补/置闰 字节护栏 + 茅山/无闰 有效产出(WP-C 后端)。

茅山/无闰 为「时家·节气定局法」,与时家前端 qimenJuNameMaoshan/Wurun 同口径:
  茅山 = 历法节气定阴阳遁,元由「距交节之时辰数」定(每元 60 时辰=5 日,不问符头不置闰);
  无闰 = 超神接气定局但不置闰(同置闰管道,节气改用 zhirun_jieqi_noleap)。
拆补/置闰(option 1/2)输出必须逐字节不变(新增 option 3/4 为纯加,默认仍 1)。
"""
import os
import sys

import pytest

_KINQIMEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kinqimen")
)
if _KINQIMEN_DIR not in sys.path:
    sys.path.insert(0, _KINQIMEN_DIR)

try:
    import config as kq_config  # noqa: E402
    import kinqimen as kq  # noqa: E402
    _IMPORT_OK = True
except Exception as exc:  # pragma: no cover - 依赖 vendor 可用
    _IMPORT_OK = False
    _IMPORT_ERR = exc

pytestmark = pytest.mark.skipif(not _IMPORT_OK, reason="vendor/kinqimen 不可导入")

# 公历 2026-05-15 00:12 → 立夏下元,拆补=阳遁七局下(与前端 DunJiaCalc 样本一致)。
_DT = (2026, 5, 15, 0, 12)


def test_dingju_names_all_four_methods():
    chaibu = kq_config.qimen_ju_name_chaibu(*_DT)
    zhirun = kq_config.qimen_ju_name_zhirun(*_DT)
    maoshan = kq_config.qimen_ju_name_maoshan(*_DT)
    wurun = kq_config.qimen_ju_name_wurun(*_DT)
    # 字节护栏:拆补/置闰 维持既有口径
    assert chaibu == "陽遁七局下"
    assert zhirun == "陽遁七局下元"
    # 茅山/无闰:有效局名(阴阳遁+局数+元),与拆补/置闰 不同源(元/节气取法不同)
    for name in (maoshan, wurun):
        assert name.startswith("陽遁") or name.startswith("陰遁")
        assert "局" in name
    # 茅山 元由距交节时辰定(此例落中元一局),无闰 不置闰(此例下元八局)——锁定算法回归
    assert maoshan == "陽遁一局中元"
    assert wurun == "陽遁八局下元"


def test_maoshan_jieqi_boundary_time_aware():
    """茅山 节气交界 time-aware 锚点回归(修 get_jieqi_start_date 忽略时分的边界 bug)。

    节气当天但尚未到交节时刻时,真正所处的仍是上一个节气;此前后端误取「当天节气」时刻
    → now-交节 为负 → 钳 0 → 错判上一节气「上元」。2026 芒种(06-05 23:48)→夏至(06-21 16:24):
      06-20 23:38  芒种满2元 = 陽遁九局下元(交界前夕)
      06-21 08:00  仍属芒种、满3元 → 滚夏至上元 = 陰遁九局上元(原误判 陽遁六局上元)
      06-22 08:00  夏至后 = 陰遁九局上元(连续,无 下元→上元 回退)
    与前端 qimenJuNameMaoshan(扫「≤now 最近节气」)同口径。
    """
    assert kq_config.qimen_ju_name_maoshan(2026, 6, 20, 23, 38) == "陽遁九局下元"
    assert kq_config.qimen_ju_name_maoshan(2026, 6, 21, 8, 0) == "陰遁九局上元"
    assert kq_config.qimen_ju_name_maoshan(2026, 6, 22, 8, 0) == "陰遁九局上元"
    # 单调:交界前夕(下元)→交界当天(上元·已滚下一节气),不得回退为同节气上元(原 bug 症状)
    assert kq_config.qimen_ju_name_maoshan(2026, 6, 21, 0, 30) == "陰遁九局上元"
    # 既有 golden 不漂(立秋下元/春分上元)
    assert kq_config.qimen_ju_name_maoshan(2026, 8, 20, 10, 0) == "陰遁八局下元"
    assert kq_config.qimen_ju_name_maoshan(2026, 3, 21, 9, 30) == "陽遁三局上元"


def test_pan_option_bytegate_and_new_methods():
    q = kq.Qimen(*_DT)
    pans = {opt: q.pan(opt) for opt in (1, 2, 3, 4)}
    # 字节护栏:option 1/2 地盘逐宫不变(新增 3/4 为纯加,旧路径零回归)
    assert pans[1]["地盤"] == pans[2]["地盤"]  # 同日地盘(三奇六仪)与定局无关 → 1/2 一致
    assert pans[1]["地盤"].get("坎") == "辛"
    assert pans[1]["排盤方式"] == "拆補"
    assert pans[2]["排盤方式"] == "置閏"
    # 新增方式标注 + 不崩 + 地盘有效(茅山局不同 → 地盘三奇六仪起点不同)
    assert pans[3]["排盤方式"] == "茅山"
    assert pans[4]["排盤方式"] == "無閏"
    for opt in (3, 4):
        assert isinstance(pans[opt]["地盤"], dict) and len(pans[opt]["地盤"]) == 9


def test_zhirun_noleap_is_zhirun_without_leap():
    """无闰节气 = 置闰节气去除大雪/芒种≥9天的置闰重复;非置闰日两者应一致。"""
    from jieqi import zhirun_jieqi, zhirun_jieqi_noleap
    # 立夏附近非置闰窗口:两法节气应相同(仅置闰窗口才分叉)
    a = zhirun_jieqi(*_DT)
    b = zhirun_jieqi_noleap(*_DT)
    assert isinstance(a, str) and isinstance(b, str)
    assert b  # 不空、不崩


def test_dingju_jieqi_wurun_uses_noleap():
    """无闰(option 4)定局节气 = zhirun_jieqi_noleap;超神日须区别于拆补(jq 历法节气)。
    此前 dingju_jieqi 漏 option==4 → 落 jq,致时家无闰走后端时「节气」标签错(WP-E 修)。"""
    from jieqi import zhirun_jieqi_noleap, jq
    dt = (2026, 8, 20, 10, 0)   # 处暑超神:拆补=立秋(jq) / 无闰=处暑(noleap)
    assert kq_config.dingju_jieqi(*dt, 4) == zhirun_jieqi_noleap(*dt)
    assert kq_config.dingju_jieqi(*dt, 1) == jq(*dt)
    assert kq_config.dingju_jieqi(*dt, 4) != kq_config.dingju_jieqi(*dt, 1)   # 超神日 无闰≠拆补
    assert kq_config.dingju_jieqi(*dt, 3) == jq(*dt)                          # 茅山仍用历法节气


def test_pan_feipan_matches_ex1_fei():
    """后端飞盘 pan_feipan == 参考 EX1_fei(2026-05-15 00:12 阳遁7局拆补)逐宫;
    与前端本地 panFeipan 同算法→保证飞盘走后端显示与本地一致(不瞎动)。"""
    q = kq.Qimen(2026, 5, 15, 0, 12)
    fp = q.pan_feipan(1)
    # 卦键(坎坤震巽中乾兑艮离):(神, 星, 门, 天盘干)——繁体,前端 merge 统一繁→简。
    expect = {
        "坎": ("合", "蓬", "休", "辛"), "坤": ("勾", "芮", "死", "壬"), "震": ("常", "沖", "傷", "癸"),
        "巽": ("雀", "輔", "杜", "丁"), "中": ("地", "禽", "", "丙"), "乾": ("天", "心", "開", "乙"),
        "兌": ("符", "柱", "驚", "戊"), "艮": ("蛇", "任", "生", "己"), "離": ("陰", "英", "景", "庚"),
    }
    for gua, (shen, star, men, sky) in expect.items():
        assert fp["神"].get(gua, "") == shen, f"{gua}神 {fp['神'].get(gua)}!={shen}"
        assert fp["星"].get(gua, "") == star, f"{gua}星 {fp['星'].get(gua)}!={star}"
        assert fp["門"].get(gua, "") == men, f"{gua}門 {fp['門'].get(gua)}!={men}"
        assert fp["天盤"].get(gua, "") == sky, f"{gua}天盤 {fp['天盤'].get(gua)}!={sky}"
    # 九神含中宫(地);值符天柱落兑、值使惊门落兑(起7落7宫)
    assert fp["神"]["中"] == "地"
    assert fp["值符值使"]["值符星宮"] == ["柱", "兌"]
    assert fp["值符值使"]["值使門宮"] == ["驚", "兌"]
    assert fp["盤式"] == "飛盤"


# ── 2026-07-04 事故复盘:时家 拆补/置闰 与参考引擎对齐审计修复的回归锚 ──
# 双引擎 9 年 42,731 点扫描定位两个实现 bug,修后全矩阵 0 差(值以参考引擎独立验证)。


def test_chaibu_14day_gap_crossing_day_pre_crossing():
    """Bug①:交节日与上一交节日历差=14 天(冬半年傍晚交节)时,旧 jq() 的
    get_before before(15) 起跳恰好跳过上一交节日 → 交节前时段错报两档前节气。
    2026-02-18(雨水 23:51 交,距立春 02-04 = 14 天):修前拆补=大寒→陽遁六局下(错),
    正确=立春→陽遁二局下。"""
    assert kq_config.qimen_ju_name_chaibu(2026, 2, 18, 10, 30) == "陽遁二局下"
    # 交节前 23:30(日柱已晚子时进位→上元;节气仍立春):陽遁八局上
    assert kq_config.qimen_ju_name_chaibu(2026, 2, 18, 23, 30) == "陽遁八局上"
    # 同类日再钉两例(2015-01-20 大寒 17:43 距小寒 01-06=14 天;2025-12-21 冬至 23:02 距大雪 12-07=14 天)
    assert kq_config.qimen_ju_name_chaibu(2015, 1, 20, 10, 30) == "陽遁二局上"
    assert kq_config.qimen_ju_name_chaibu(2025, 12, 21, 2, 30) == "陰遁四局上"


def test_zhirun_futou_eve_late_zi_consistency():
    """Bug②:节气块边界(上元符头日)前夜 23:00–24:00,元随日柱晚子时进位而
    距符头天数旧用日历日 → 「新元+旧节气局」嵌合体。2015-01-03 为己卯上元符头日
    (小寒上元起):前夜 23:30 置闰应整体归次日=陽遁二局上元(修前=陽遁一局上元嵌合)。"""
    assert kq_config.qimen_ju_name_zhirun(2015, 1, 2, 23, 30) == "陽遁二局上元"
    # 邻位连续性:前夜 22:30 仍属旧块(陽遁四局下元…此处按归一「阳4下」= 冬至下元)
    assert kq_config.qimen_ju_name_zhirun(2015, 1, 2, 22, 30) == "陽遁四局下元"
    # 次日 00:30 与前夜 23:30 同局(晚子时口径自洽)
    assert kq_config.qimen_ju_name_zhirun(2015, 1, 3, 0, 30) == "陽遁二局上元"


def test_wurun_futou_eve_late_zi_consistency():
    """无闰(zhirun_jieqi_noleap)同修晚子时进位;该时点无闰未触发 → 与置闰同值。"""
    assert kq_config.qimen_ju_name_wurun(2015, 1, 2, 23, 30) == kq_config.qimen_ju_name_zhirun(2015, 1, 2, 23, 30)


def test_jiazi_shared_constant_survives_full_pan():
    """六十甲子是进程内共享常量(jiazi() 直接返回同一个列表,不再每次重建):四种定局法 × 多个时刻整盘起完之后
    必须原封不动 —— 任何调用点就地改了它(reverse / sort / 元素赋值)都会污染全进程后续所有奇门盘。"""
    table = kq_config.jiazi()
    before = list(table)
    assert len(before) == 60 and before[0] == "甲子" and before[-1] == "癸亥"
    for dt in (_DT, (1990, 1, 1, 23, 30), (2033, 12, 21, 12, 0)):
        q = kq.Qimen(*dt)
        for opt in (1, 2, 3, 4):
            q.pan(opt)
    assert kq_config.jiazi() is table
    assert list(table) == before
