"""
astro/shaozi/calculator.py — 邵子神數核心計算引擎

邵康節神數 / 洛陽派神數 起盤計算

起數原理（四柱各取一位，組成四位條文號）：
  ① 年柱天干  → 洛書九宮集號（1–9）
  ② 月柱天干  → 天干配卦序號（1–8）
  ③ 日柱天干  → 天干配卦序號（1–8）
  ④ 時柱天干  → 天干配卦序號（1–8）

四位數字合為條文 ID（如 6753），從 CSV 資料庫查詢對應條文。
"""

import csv
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

from astro.shaozi.constants import (
    HEAVENLY_STEMS,
    EARTHLY_BRANCHES,
    STEM_TO_INDEX,
    BRANCH_TO_INDEX,
    TIANGAN_COLLECTION,
    TIANGAN_PEIGUA,
    TIANGAN_GUA_INDEX,
    DIZHI_PEIGUA,
    DIZHI_GUA_INDEX,
    HELUO_TIANGAN,
    HELUO_DIZHI,
    COLLECTIONS,
    NAYIN,
    STEM_ELEMENT,
    BRANCH_ELEMENT,
)

_DATA_DIR = Path(__file__).parent / "data"


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class ShaoziBirthData:
    """
    邵子神數出生資料

    可直接輸入西曆日期（birth_dt），或提供四柱干支字串（如 "甲子"）。
    若兩者同時提供，干支字串優先。
    """
    birth_dt: datetime
    year_gz: str = ""    # 年柱，如 "甲子"
    month_gz: str = ""   # 月柱，如 "丙寅"
    day_gz: str = ""     # 日柱，如 "戊辰"
    hour_gz: str = ""    # 時柱，如 "庚午"
    gender: str = "男"


@dataclass
class ShaoziResult:
    """邵子神數推算結果"""
    birth_data: ShaoziBirthData

    # 四柱干支
    year_gz: str = ""
    month_gz: str = ""
    day_gz: str = ""
    hour_gz: str = ""

    # 四位起數
    year_digit: int = 0    # 集號 1-9
    month_digit: int = 0   # 月位 1-8
    day_digit: int = 0     # 日位 1-8
    hour_digit: int = 0    # 時位 1-8

    # 條文資訊
    tiaowen_id: str = ""
    gua_name: str = ""
    tiaowen_text: str = ""
    collection: str = ""

    # 配卦資訊
    gua_year: str = ""
    gua_month: str = ""
    gua_day: str = ""
    gua_hour: str = ""

    # 河洛數
    he_luo_year: int = 0
    he_luo_day: int = 0

    # 納音五行
    nayin_year: str = ""
    nayin_day: str = ""

    # 五行元素
    day_element: str = ""

    # 補充說明
    note: str = ""


# ============================================================================
# 條文資料庫（延遲載入單例）
# ============================================================================

class ShaoziTiaowenDatabase:
    """邵子神數條文資料庫（延遲載入，CSV 格式）"""

    _instance: Optional["ShaoziTiaowenDatabase"] = None
    _data: Dict[str, Dict] = {}

    @classmethod
    def get_instance(cls) -> "ShaoziTiaowenDatabase":
        if cls._instance is None:
            cls._instance = ShaoziTiaowenDatabase()
        return cls._instance

    def __init__(self) -> None:
        self._data = {}
        self._load()

    def _load(self) -> None:
        csv_path = _DATA_DIR / "shaozi_tiaowen.csv"
        if not csv_path.exists():
            return
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tid = row["條文號碼"].strip()
                self._data[tid] = {
                    "id": tid,
                    "gua": row["卦"].strip(),
                    "text": row["條文"].strip(),
                }

    def get(self, tiaowen_id: str) -> Optional[Dict]:
        """查詢單條條文"""
        return self._data.get(tiaowen_id)

    def all(self) -> Dict[str, Dict]:
        """返回全部條文"""
        return self._data

    def search(self, keyword: str) -> list:
        """關鍵字搜尋條文"""
        kw = keyword.strip()
        return [
            entry for entry in self._data.values()
            if kw in entry["text"] or kw in entry["gua"]
        ]

    @property
    def count(self) -> int:
        return len(self._data)


# ============================================================================
# 干支計算工具
# ============================================================================

def _year_ganzhi(year: int) -> str:
    """從西元年份計算年柱干支（以甲子 1984 為基準）"""
    base = 1984  # 甲子年
    stem_idx = (year - base) % 10
    branch_idx = (year - base) % 12
    return HEAVENLY_STEMS[stem_idx] + EARTHLY_BRANCHES[branch_idx]


def _month_ganzhi(year: int, month: int) -> str:
    """
    計算月柱干支（簡化版，以節氣月份為準）
    月支：寅(2月) 卯(3月) … 丑(1月)  index = month % 12
    月干：由年干推算，甲己年從丙寅起
    """
    year_stem_idx = (year - 1984) % 10
    # 月干循環：甲己年→丙寅起 (stem_base=2)；每年差2
    stem_base = ((year_stem_idx % 5) * 2 + 2) % 10
    # 月支：二月(2) → 寅(2), 三月(3) → 卯(3), …, 八月(8) → 申(8), …, 一月(1) → 丑(1)
    month_branch_idx = month % 12
    month_stem_idx = (stem_base + month - 2) % 10
    return HEAVENLY_STEMS[month_stem_idx] + EARTHLY_BRANCHES[month_branch_idx]


def _day_ganzhi(year: int, month: int, day: int) -> str:
    """
    計算日柱干支（Julian Day Number 法）
    參考點：2000-01-01 (JD=2451545) = 戊午日
    """
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524
    # 2451545 = 2000-01-01 = 戊午：stem 戊(4), branch 午(6)
    ref_jd = 2451545
    ref_stem = 4    # 戊
    ref_branch = 6  # 午
    delta = jd - ref_jd
    stem_idx = (ref_stem + delta) % 10
    branch_idx = (ref_branch + delta) % 12
    return HEAVENLY_STEMS[stem_idx] + EARTHLY_BRANCHES[branch_idx]


def _hour_ganzhi(day_stem: str, hour: int) -> str:
    """
    計算時柱干支
    時支由時辰決定（子時=0,1點），時干由日干推算
    """
    hour_branch_idx = (hour + 1) // 2 % 12
    day_stem_idx = STEM_TO_INDEX[day_stem]
    # 甲己日子時起甲子
    hour_stem_idx = (day_stem_idx % 5 * 2 + hour_branch_idx) % 10
    return HEAVENLY_STEMS[hour_stem_idx] + EARTHLY_BRANCHES[hour_branch_idx]


def calculate_ganzhi_from_datetime(birth_dt: datetime, after23_new_day: int = 1, hour_gan_use_next_day: int = 1) -> Dict[str, str]:
    """從西曆日期時間計算四柱干支。

    用戶語義（拍板，字面直覺版，配套自檢 27日23:30）：
      after23_new_day=1「23点算第二天」= 23時起日柱進位次日（壬寅）
      after23_new_day=0「24点算第二天」= 23時仍守今、24時才換日柱（辛丑）
    v2.2.1 lateZi:
      hour_gan_use_next_day=1（默认，lunar.js Exact）：時柱永遠用次日日干起子時
      hour_gan_use_next_day=0：時柱用日柱所在 cdate 的日干（== 跟日柱一致）
    只在 hour==23 時兩開關生效；其它 23 小時完全 NO-OP。
    """
    # 🔴 四柱來源統一走權威 kin_year_domain.extreme_pillars(與八字/主鏈完全一致:天文年連續
    # 紀年 AD4=甲子、立春年界、定氣月柱、儒略/格里 JDN 日柱)。舊 _year/_month/_day 簡化公式
    # (公曆年無立春界、公曆月無節氣、格里 JD 對 BC 儒略歷錯)在立春前/節氣邊界/BC 全錯
    # (用戶實測 BC12026:蕭子甲午辛未丁未辛亥 ≠ 八字乙未庚辰己卯乙亥)→ 根治為單一權威源。
    try:
        from kin_year_domain import extreme_pillars
        _mi = getattr(birth_dt, 'minute', 0) or 0
        yTG, mTG, dTG, hTG, _zi = extreme_pillars(
            birth_dt.year, birth_dt.month, birth_dt.day, birth_dt.hour, _mi,
            after23=(1 if after23_new_day else 0),
            hour_gan_next=(1 if hour_gan_use_next_day else 0))
        return {"year": yTG, "month": mTG, "day": dTG, "hour": hTG}
    except Exception:
        # 星歷不可用(純庫/離線)兜底:回退簡化公式(生產環境恒走上面權威;本分支僅防崩)。
        pass
    day_dt = birth_dt + timedelta(days=1) if (after23_new_day and birth_dt.hour == 23) else birth_dt
    year_gz = _year_ganzhi(day_dt.year)
    month_gz = _month_ganzhi(day_dt.year, day_dt.month)
    day_gz = _day_ganzhi(day_dt.year, day_dt.month, day_dt.day)
    # 時柱:
    if birth_dt.hour == 23:
        if hour_gan_use_next_day:
            # 用次日日干起子时
            hour_day_dt = birth_dt + timedelta(days=1)
            hour_day_gz = _day_ganzhi(hour_day_dt.year, hour_day_dt.month, hour_day_dt.day)
        else:
            # lateZi=0: 跟日柱一致 (day_gz 已经反映 after23)
            hour_day_gz = day_gz
    else:
        hour_day_gz = day_gz
    hour_gz = _hour_ganzhi(hour_day_gz[0], birth_dt.hour)
    return {
        "year": year_gz,
        "month": month_gz,
        "day": day_gz,
        "hour": hour_gz,
    }


# ============================================================================
# 主計算引擎
# ============================================================================

class ShaoziShenShu:
    """
    邵子神數起盤引擎

    使用方式::

        from astro.shaozi import ShaoziShenShu, ShaoziBirthData
        from datetime import datetime

        engine = ShaoziShenShu()
        birth = ShaoziBirthData(birth_dt=datetime(1990, 5, 15, 8, 30))
        result = engine.calculate(birth)
        print(result.tiaowen_id, result.tiaowen_text)
    """

    def __init__(self) -> None:
        self._db = ShaoziTiaowenDatabase.get_instance()

    # ── 起數函式 ─────────────────────────────────────────────────────────────

    def get_year_digit(self, year_stem: str) -> int:
        """年柱天干起集號（1–9，洛書九宮）"""
        return TIANGAN_COLLECTION.get(year_stem, 5)

    def get_gua_digit(self, stem: str) -> int:
        """天干配卦序號（1–8，後天八卦）"""
        return TIANGAN_GUA_INDEX.get(stem, 5)

    def get_tiangan_peigua(self, stem: str) -> str:
        """天干對應八卦名稱"""
        return TIANGAN_PEIGUA.get(stem, "中宮")

    def get_he_luo(self, stem: str) -> int:
        """天干河洛數"""
        return HELUO_TIANGAN.get(stem, 5)

    # ── 主計算 ────────────────────────────────────────────────────────────────

    def calculate(self, birth_data: ShaoziBirthData) -> ShaoziResult:
        """
        完整邵子神數起盤

        Parameters
        ----------
        birth_data : ShaoziBirthData
            出生資料。若已提供四柱干支字串則直接使用；
            否則從 birth_dt 自動推算。

        Returns
        -------
        ShaoziResult
            推算結果（含條文 ID、卦名、條文文本等）
        """
        # 取得四柱干支
        if birth_data.year_gz and birth_data.month_gz and birth_data.day_gz and birth_data.hour_gz:
            year_gz = birth_data.year_gz
            month_gz = birth_data.month_gz
            day_gz = birth_data.day_gz
            hour_gz = birth_data.hour_gz
        else:
            gz = calculate_ganzhi_from_datetime(birth_data.birth_dt)
            year_gz = gz["year"]
            month_gz = gz["month"]
            day_gz = gz["day"]
            hour_gz = gz["hour"]

        # 拆解天干地支
        y_stem, y_branch = year_gz[0], year_gz[1]
        m_stem, m_branch = month_gz[0], month_gz[1]
        d_stem, d_branch = day_gz[0], day_gz[1]
        h_stem, h_branch = hour_gz[0], hour_gz[1]

        # 四位起數
        y_digit = self.get_year_digit(y_stem)
        m_digit = self.get_gua_digit(m_stem)
        d_digit = self.get_gua_digit(d_stem)
        h_digit = self.get_gua_digit(h_stem)

        tiaowen_id = f"{y_digit}{m_digit}{d_digit}{h_digit}"

        # 配卦資訊
        gua_year = self.get_tiangan_peigua(y_stem)
        gua_month = self.get_tiangan_peigua(m_stem)
        gua_day = self.get_tiangan_peigua(d_stem)
        gua_hour = self.get_tiangan_peigua(h_stem)

        # 河洛數
        he_luo_year = self.get_he_luo(y_stem)
        he_luo_day = self.get_he_luo(d_stem)

        # 納音五行
        nayin_year = NAYIN.get(year_gz, "")
        nayin_day = NAYIN.get(day_gz, "")

        # 日主五行
        day_element = STEM_ELEMENT.get(d_stem, "")

        # 查詢條文
        entry = self._db.get(tiaowen_id)
        gua_name = entry["gua"] if entry else ""
        tiaowen_text = entry["text"] if entry else "【條文待補充，請查閱原典】"

        note = (
            f"年位={y_digit}（{gua_year}）"
            f" 月位={m_digit}（{gua_month}）"
            f" 日位={d_digit}（{gua_day}）"
            f" 時位={h_digit}（{gua_hour}）"
        )

        return ShaoziResult(
            birth_data=birth_data,
            year_gz=year_gz,
            month_gz=month_gz,
            day_gz=day_gz,
            hour_gz=hour_gz,
            year_digit=y_digit,
            month_digit=m_digit,
            day_digit=d_digit,
            hour_digit=h_digit,
            tiaowen_id=tiaowen_id,
            gua_name=gua_name,
            tiaowen_text=tiaowen_text,
            collection=COLLECTIONS.get(y_digit, f"{y_digit}集"),
            gua_year=gua_year,
            gua_month=gua_month,
            gua_day=gua_day,
            gua_hour=gua_hour,
            he_luo_year=he_luo_year,
            he_luo_day=he_luo_day,
            nayin_year=nayin_year,
            nayin_day=nayin_day,
            day_element=day_element,
            note=note,
        )

    def get_tiaowen(self, tiaowen_id: str) -> Optional[Dict]:
        """直接查詢指定 ID 的條文"""
        return self._db.get(str(tiaowen_id))

    def search_tiaowen(self, keyword: str) -> list:
        """關鍵字搜尋條文"""
        return self._db.search(keyword)

    @property
    def tiaowen_count(self) -> int:
        """條文總數"""
        return self._db.count
