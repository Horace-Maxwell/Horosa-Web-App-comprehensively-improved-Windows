# -*- coding: utf-8 -*-
"""
astro/nanji/calculator.py — 南極神數核心計算模組

《家傳秘法手稿 · 南極神數》完整 Python 實現

主要類別：
    NanJiShenShu — 南極神數命理推演主類
    TiaowenDatabase — 條文資料庫（246 條高質量條文）

計算流程（依手稿）：
    四柱排盤 → 大運小運流年 → 五星定位 → 二十八宿建除定位 → 查詢條文

注意：
    手稿核心精神「圖為體，條文為用」。十八星圖為鑰，破圖則數起。
    完整十八幅星圖須對照原書圖像，本模組提供框架並整合 246 條條文。
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from sxtwl import fromSolar as _sxtwl_fromSolar
    _HAS_SXTWL = True
except ImportError:  # pragma: no cover
    _HAS_SXTWL = False

from .constants import (
    TIANGAN, DIZHI, YINYANG_GAN, YINYANG_ZHI,
    WUXING_GAN, WUXING_ZHI, SHENG_CYCLE, KE_CYCLE,
    XIU28, XIU28_ORDER, JIANCHU,
    FIVE_STAR_DAYS, WUHU_DUN, WUSHU_DUN, SOLAR_MONTH_ZHI,
    PASSWORDS,
)

# ============================================================
# 資料路徑
# ============================================================

_DATA_DIR = Path(__file__).parent / "data"
_TIAOWEN_FILE = _DATA_DIR / "nanji_tiaowen.json"


# ============================================================
# 資料類別
# ============================================================

@dataclass
class TiaowenEntry:
    """單條條文記錄"""
    section: str    # 宮部，如「子部」「丑部」
    code: str       # 密碼，如「建張」「平角」（建除 + 二十八宿）
    verse: str      # 條文詩句
    comment: str    # 評語（斷法說明）


@dataclass
class FourPillars:
    """四柱八字"""
    year: str           # 年柱，如「甲子」
    month: str          # 月柱，如「庚辰」
    day: str            # 日柱，如「辛酉」
    hour: str           # 時柱，如「壬辰」
    year_yinyang: str   # 年干陰陽
    gender: str         # 性別（男/女）


@dataclass
class DaYunStep:
    """大運步驟"""
    ganzhi: str         # 干支
    start_age: int      # 起運歲數（以10年為一步）
    index: int          # 順序（第幾步大運）


@dataclass
class NanJiResult:
    """南極神數推演結果"""
    four_pillars: FourPillars
    da_yun: List[DaYunStep]
    tiaowen_results: List[TiaowenEntry] = field(default_factory=list)
    chart_readings: List[str] = field(default_factory=list)


# ============================================================
# 條文資料庫
# ============================================================

class TiaowenDatabase:
    """
    南極神數條文資料庫

    載入 nanji_tiaowen.json（246 條），提供按宮部與密碼的查詢介面。
    密碼格式：建除十二辰（建/除/滿/平/定/執/破/危/成/收/開/閉）+ 二十八宿名。

    手稿規則：查條文需先確定「宮部」（年柱地支部）與「密碼」（星圖位置），
    兩者共同決定條文，不可只憑其一。
    """

    _instance: Optional["TiaowenDatabase"] = None

    def __init__(self) -> None:
        self._entries: List[TiaowenEntry] = []
        self._index: Dict[Tuple[str, str], List[TiaowenEntry]] = {}
        self._load()

    @classmethod
    def get_instance(cls) -> "TiaowenDatabase":
        """單例模式，避免重複讀取 JSON"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load(self) -> None:
        """載入條文 JSON 並建立查詢索引"""
        try:
            with open(_TIAOWEN_FILE, encoding="utf-8") as f:
                raw = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            raw = []

        for item in raw:
            entry = TiaowenEntry(
                section=item.get("section", ""),
                code=_normalize_code(item.get("code", "")),
                verse=item.get("verse", ""),
                comment=item.get("comment", ""),
            )
            self._entries.append(entry)
            key = (entry.section, entry.code)
            self._index.setdefault(key, []).append(entry)

    def lookup(
        self,
        section: str,
        code: str,
    ) -> List[TiaowenEntry]:
        """
        查詢條文

        Args:
            section: 宮部名稱，如「子部」「午部」
            code: 密碼（建除+宿），如「建張」「平角」

        Returns:
            匹配的條文列表（可能有多條）；無匹配則返回空列表
        """
        normalized = _normalize_code(code)
        return self._index.get((section, normalized), [])

    def lookup_by_section(self, section: str) -> List[TiaowenEntry]:
        """返回某宮部下所有條文"""
        return [e for e in self._entries if e.section == section]

    def all_entries(self) -> List[TiaowenEntry]:
        return list(self._entries)

    @property
    def total(self) -> int:
        return len(self._entries)


# 密碼標準化常量：
# 需去除的尾部標點（JSON 原始資料中部分條目帶有多餘標點）
_CODE_TRAILING_PUNCT = '：:。，,、'
# 需去除的說明性後綴（如「宮。」「斷。」為手稿批注，不屬於密碼本體）
_CODE_DESC_SUFFIXES = ('宮。', '斷。', '格。', '宮', '斷', '格')
# 密碼有效字元長度上限（建除一字 + 宿名通常一字，最長不超過兩字共四個 UTF-8 字元）
_MAX_CODE_LENGTH = 4


def _normalize_code(code: str) -> str:
    """
    標準化密碼字串：去除標點符號後綴，修正常見異體字。

    部分 JSON 條目中 code 含有多餘標點（如「建張：」「成斗：」），
    或使用異體字（「翌」vs「翼」、「嘴」vs「觜」），需統一。
    """
    # 去除尾部標點（見 _CODE_TRAILING_PUNCT）
    code = code.rstrip(_CODE_TRAILING_PUNCT)
    # 去除行內說明性後綴（「宮。」「斷。」等，見 _CODE_DESC_SUFFIXES）
    for suffix in _CODE_DESC_SUFFIXES:
        if code.endswith(suffix) and len(code) > _MAX_CODE_LENGTH:
            code = code[:-len(suffix)]
    # 截取有效長度：密碼本體為建除一字 + 宿名一字，上限 _MAX_CODE_LENGTH 個字元
    code = code[:_MAX_CODE_LENGTH]
    return code.strip()


# ============================================================
# 四柱計算函式
# ============================================================

def calculate_year_pillar(lunar_year: int, after_lichun: bool = True) -> str:
    """
    年柱排法（手稿）：
    - 立春後出生用本年干支
    - 立春前出生用上一年干支
    - 參考系：1984 年甲子
    """
    year = lunar_year if after_lichun else lunar_year - 1
    idx = (year - 1984) % 60
    return TIANGAN[idx % 10] + DIZHI[idx % 12]


def calculate_month_pillar(year_gan: str, solar_month: int) -> str:
    """
    月柱排法（手稿五虎遁起月訣）：
    正月寅、二月卯…十二月丑；月干由五虎遁決定。
    """
    start_gan = WUHU_DUN.get(year_gan, '丙')
    gan_idx = (TIANGAN.index(start_gan) + solar_month - 1) % 10
    month_zhi = SOLAR_MONTH_ZHI.get(solar_month, '寅')
    return TIANGAN[gan_idx] + month_zhi


def calculate_hour_pillar(day_gan: str, hour_zhi: str) -> str:
    """
    時柱排法（手稿五鼠遁日起時訣）：
    甲己還加甲，乙庚丙作初，丙辛從戊起，丁壬庚子居，戊癸何方發，壬子是真途。
    """
    start_gan = WUSHU_DUN.get(day_gan, '甲')
    zhi_idx = DIZHI.index(hour_zhi)
    gan_idx = (TIANGAN.index(start_gan) + zhi_idx) % 10
    return TIANGAN[gan_idx] + hour_zhi


def calculate_da_yun(
    month_pillar: str,
    gender: str,
    year_yinyang: str,
    steps: int = 8,
    start_age: int = 1,
) -> List[DaYunStep]:
    """
    大運排法（手稿）：
    陽年生男、陰年生女 → 順排（從月柱後一干支起）
    陰年生男、陽年生女 → 逆排

    每運十年，干管前五年，支管後五年。

    Args:
        month_pillar: 月柱干支
        gender: 性別（男/女）
        year_yinyang: 年干陰陽（陽/陰）
        steps: 排列大運步數（預設 8 步 = 80 年）
        start_age: 起運歲數（預設 1 歲，實際起運需推算三天折一年）
    """
    forward = (year_yinyang == '陽' and gender == '男') or \
              (year_yinyang == '陰' and gender == '女')
    gan, zhi = month_pillar[0], month_pillar[1]
    gan_idx = TIANGAN.index(gan)
    zhi_idx = DIZHI.index(zhi)
    step = 1 if forward else -1
    result: List[DaYunStep] = []
    for i in range(1, steps + 1):
        g = TIANGAN[(gan_idx + i * step) % 10]
        z = DIZHI[(zhi_idx + i * step) % 12]
        result.append(DaYunStep(
            ganzhi=g + z,
            start_age=start_age + (i - 1) * 10,
            index=i,
        ))
    return result


# ============================================================
# 五行生剋
# ============================================================

def get_wuxing_relation(w1: str, w2: str) -> str:
    """五行生剋制化"""
    if SHENG_CYCLE.get(w1) == w2:
        return f"{w1}生{w2}"
    if KE_CYCLE.get(w1) == w2:
        return f"{w1}克{w2}"
    if SHENG_CYCLE.get(w2) == w1:
        return f"{w2}生{w1}"
    if KE_CYCLE.get(w2) == w1:
        return f"{w2}克{w1}"
    return "同類"


# ============================================================
# 建除定位
# ============================================================

def get_jianchu_huainan(zhi: str) -> str:
    """
    《淮南子》建除法：
    寅建、卯除、辰滿、巳平、午定、未執、申破、酉危、戌成、亥收、子開、丑閉
    """
    start = DIZHI.index('寅')
    idx = DIZHI.index(zhi)
    offset = (idx - start) % 12
    return JIANCHU[offset]


def get_jianchu_from_month_build(month_zhi: str, day_offset: int = 0) -> str:
    """
    協紀辨方法：月建為建，順行十二辰。
    手稿註：每月交節則疊兩值日。
    """
    start = DIZHI.index(month_zhi)
    return JIANCHU[(start + day_offset) % 12]


# ============================================================
# 二十八宿工具
# ============================================================

def get_xiu_group(xiu: str) -> str:
    """返回二十八宿所屬四象宮"""
    for group, xius in XIU28.items():
        if xiu in xius:
            return group
    return "未知"


def five_star_appear(star: str, day: int) -> bool:
    """五星出沒判斷（依手稿日支規律）"""
    return day in FIVE_STAR_DAYS.get(star, [])


# ============================================================
# 星圖解讀
# ============================================================

def interpret_chart_1(palace: str, xiu: str, degree: float) -> str:
    """
    圖一秘解（手稿）：
    從午至亥為建張全日表，定命主出生月日。
    午宮分辰一度一分 → 辰部第一輪第一個建張 = 正月初一
    """
    round_num = max(1, math.floor(degree))
    return (
        f"圖一：{palace}宮分{xiu}{degree:.1f}度 → "
        f"{xiu}部第{round_num}輪建張（建張全日表定位出生日期）。"
        " 宮分亦可查大運支運。"
    )


def interpret_chart_6(palace: str, degree: float) -> str:
    """
    圖六秘解（手稿）：
    午至亥為閉軫（命主死亡月份）
    子至巳為成牛（兄弟人數、中途夭折幾人）
    """
    if palace in ['午', '未', '申', '酉', '戌', '亥']:
        return f"圖六：{palace}宮分{degree:.1f}度 → 閉軫局，查命主亡月條文。"
    return f"圖六：{palace}宮分{degree:.1f}度 → 成牛局，兄弟人數及夭折數查條文。"


def interpret_general(
    chart_num: int,
    palace: str,
    jianchu: str,
    xiu: str,
    degree: float,
    extra_code: str = "",
) -> str:
    """
    綜合星圖解讀（手稿第四章總論）
    圖不破則數難起，需先確定宮位、建除、星宿後查對應條文。
    """
    pwd = PASSWORDS.get(extra_code, "")
    return (
        f"星圖{chart_num} {palace}宮 {jianchu}{xiu}{degree:.1f}度。\n"
        f"密碼解：{pwd or '請對照手稿圖中密碼位置自行破譯。'}\n"
        "手稿提示：圖為體，條文為用。研讀《果老星宗》可深入。"
    )


# ============================================================
# 南極神數核心類別
# ============================================================

class NanJiShenShu:
    """
    南極神數命理推演主類

    使用方式：
        njs = NanJiShenShu(lunar_year=1990, solar_month=4, day=2,
                           hour_zhi='辰', gender='男')
        njs.set_day_pillar('辛')
        njs.set_hour_pillar()
        result = njs.compute()
        tiaowen = njs.lookup_tiaowen(section='子部', code='建張')

    手稿強調：年柱地支決定「宮部」（子部/丑部…），是查條文的第一鑰匙。
    """

    def __init__(
        self,
        lunar_year: int,
        solar_month: int,
        day: int,
        hour_zhi: str,
        gender: str = '男',
        after_lichun: bool = True,
    ) -> None:
        self.lunar_year = lunar_year
        self.solar_month = solar_month
        self.day = day
        self.hour_zhi = hour_zhi
        self.gender = gender
        self.after_lichun = after_lichun

        # ── 四柱計算
        self.year_pillar = calculate_year_pillar(lunar_year, after_lichun)
        self.year_gan: str = self.year_pillar[0]
        self.year_zhi: str = self.year_pillar[1]
        self.year_yinyang: str = YINYANG_GAN[self.year_gan]

        self.month_pillar = calculate_month_pillar(self.year_gan, solar_month)
        self.month_gan: str = self.month_pillar[0]
        self.month_zhi: str = self.month_pillar[1]

        self.day_gan: Optional[str] = None
        self.day_zhi: Optional[str] = None
        self.day_pillar: Optional[str] = None
        self.hour_pillar: Optional[str] = None

        # ── 大運
        self.da_yun: List[DaYunStep] = calculate_da_yun(
            self.month_pillar, gender, self.year_yinyang
        )

        # ── 條文資料庫（共享單例）
        self._db: TiaowenDatabase = TiaowenDatabase.get_instance()

    # ── 從公曆日期建立命盤（推薦）
    @classmethod
    def from_solar_datetime(
        cls,
        year: int,
        month: int,
        day: int,
        hour: int,
        minute: int = 0,
        gender: str = '男',
        after23_new_day: int = 1,
    ) -> "NanJiShenShu":
        """
        從公曆日期時間建立命盤，使用 sxtwl 精確計算四柱。

        月柱以節氣為界（非農曆月份），日柱精確到日，
        時柱依五鼠遁日起時法。23時後視為翌日子時。

        Args:
            year:   公曆年
            month:  公曆月（1-12）
            day:    公曆日
            hour:   時（0-23）
            minute: 分（0-59，不影響柱）
            gender: 性別（男/女）
        """
        if year < 1 or year > 9999:
            # 全年份域回退(共享件,口径与主链一致;域内 sxtwl 原路径零变)
            from kin_year_domain import extreme_pillars
            _p = extreme_pillars(year, month, day, hour, minute or 0,
                                 after23=(1 if after23_new_day else 0), hour_gan_next=1)
            y_stem, y_branch = _p[0][0], _p[0][1]
            m_stem, m_branch = _p[1][0], _p[1][1]
            d_stem, d_branch = _p[2][0], _p[2][1]
            h_stem, h_branch = _p[3][0], _p[3][1]
        elif _HAS_SXTWL:
            # 用戶語義（拍板,字面直覺版）：
            #   after23_new_day=1「23点算第二天」= 23時起日柱進位次日(壬寅)
            #   after23_new_day=0「24点算第二天」= 23時仍守今、24時才換日柱(辛丑)
            calc_year, calc_month, calc_day, calc_hour = year, month, day, hour
            if hour == 23 and after23_new_day:
                dt = date(year, month, day) + timedelta(days=1)
                calc_year, calc_month, calc_day = dt.year, dt.month, dt.day
                calc_hour = 0

            cdate = _sxtwl_fromSolar(calc_year, calc_month, calc_day)

            ygz = cdate.getYearGZ(False)
            mgz = cdate.getMonthGZ()
            dgz = cdate.getDayGZ()

            y_stem = TIANGAN[ygz.tg]
            y_branch = DIZHI[ygz.dz]
            m_stem = TIANGAN[mgz.tg]
            m_branch = DIZHI[mgz.dz]
            d_stem = TIANGAN[dgz.tg]
            d_branch = DIZHI[dgz.dz]

            # 時柱跨日：hour==23 時永遠按"次日日干"起子時（與 lunar.js Exact 一致）。
            if hour == 23 and not after23_new_day:
                # after23=0 日柱守今但時柱用次日干起子時
                _td = date(year, month, day) + timedelta(days=1)
                _cdate_for_hour = _sxtwl_fromSolar(_td.year, _td.month, _td.day)
                _hgz = _cdate_for_hour.getDayGZ()
                _hour_start_gan = WUSHU_DUN[TIANGAN[_hgz.tg]]
                h_branch_idx = 0  # 子時
                h_branch = DIZHI[h_branch_idx]
                h_stem_idx = (TIANGAN.index(_hour_start_gan) + h_branch_idx) % 10
                h_stem = TIANGAN[h_stem_idx]
            else:
                # 時支：子時 0, 丑時 1, …（23時且 after23=1 已轉為 calc_hour=0 子時，d_stem 已是次日干）
                h_branch_idx = (calc_hour + 1) // 2 % 12
                h_branch = DIZHI[h_branch_idx]
                start_gan = WUSHU_DUN[d_stem]
                h_stem_idx = (TIANGAN.index(start_gan) + h_branch_idx) % 10
                h_stem = TIANGAN[h_stem_idx]
        else:
            # sxtwl 不可用時退回簡化計算
            y_tg_idx = (year - 1984) % 10
            y_dz_idx = (year - 1984) % 12
            y_stem = TIANGAN[y_tg_idx]
            y_branch = DIZHI[y_dz_idx]
            start_m_gan = WUHU_DUN.get(y_stem, '丙')
            m_stem_idx = (TIANGAN.index(start_m_gan) + month - 1) % 10
            m_stem = TIANGAN[m_stem_idx]
            m_branch = SOLAR_MONTH_ZHI.get(month, '寅')
            d_stem, d_branch = '?', '?'
            hour_zhi = [
                '子', '丑', '丑', '寅', '寅', '卯', '卯', '辰', '辰',
                '巳', '巳', '午', '午', '未', '未', '申', '申', '酉',
                '酉', '戌', '戌', '亥', '亥', '子',
            ][hour % 24]
            h_branch = hour_zhi
            h_stem = '?'

        # 找到六十甲子中與 y_stem+y_branch 對應的代入年份，使構造函數得到正確年柱
        y_tg_idx = TIANGAN.index(y_stem)
        y_dz_idx = DIZHI.index(y_branch)
        jiazi_idx = next(
            (i for i in range(60) if i % 10 == y_tg_idx and i % 12 == y_dz_idx),
            0,
        )
        effective_year = 1984 + jiazi_idx

        # 找到月柱所對應的節氣月序（1-12 = 寅月至丑月）以建構物件
        m_dz_idx = DIZHI.index(m_branch)
        solar_month_for_ctor = {v: k for k, v in SOLAR_MONTH_ZHI.items()}.get(
            m_branch, 1
        )

        obj = cls(
            lunar_year=effective_year,
            solar_month=solar_month_for_ctor,
            day=day,
            hour_zhi=h_branch,
            gender=gender,
            after_lichun=True,
        )

        # 覆蓋構造函數計算結果，以 sxtwl 精確值為準
        obj.year_pillar = y_stem + y_branch
        obj.year_gan = y_stem
        obj.year_zhi = y_branch
        obj.year_yinyang = YINYANG_GAN[y_stem]

        obj.month_pillar = m_stem + m_branch
        obj.month_gan = m_stem
        obj.month_zhi = m_branch

        if d_stem != '?':
            obj.day_gan = d_stem
            obj.day_zhi = d_branch
            obj.day_pillar = d_stem + d_branch

        if h_stem != '?':
            obj.hour_zhi = h_branch
            obj.hour_pillar = h_stem + h_branch

        # 以正確月柱和年干陰陽重新計算大運
        obj.da_yun = calculate_da_yun(
            obj.month_pillar, gender, obj.year_yinyang
        )

        return obj

    # ── 日柱設定
    def set_day_pillar(self, day_gan: str, day_zhi: Optional[str] = None) -> None:
        """
        日柱需萬年曆精確查詢。
        day_gan: 日干（如「辛」）
        day_zhi: 日支（如「酉」），可選；若提供則完整日柱為「辛酉」
        """
        self.day_gan = day_gan
        self.day_zhi = day_zhi
        if day_zhi:
            self.day_pillar = day_gan + day_zhi
        else:
            self.day_pillar = day_gan + "日"

    def set_hour_pillar(self, hour_zhi: Optional[str] = None) -> None:
        """設定時柱（需先設定日柱）"""
        if hour_zhi:
            self.hour_zhi = hour_zhi
        if self.day_gan and self.hour_zhi:
            self.hour_pillar = calculate_hour_pillar(self.day_gan, self.hour_zhi)

    # ── 宮部計算
    @property
    def palace_section(self) -> str:
        """
        手稿：以年柱地支決定「宮部」，如年支子 → 子部，年支丑 → 丑部。
        宮部是查詢條文的第一關鍵。
        """
        return self.year_zhi + '部'

    # ── 四柱文字輸出
    def get_four_pillars_str(self) -> str:
        day_str = self.day_pillar or '日柱(待查萬年曆)'
        hour_str = self.hour_pillar or '時柱(待設定)'
        return f"{self.year_pillar} {self.month_pillar} {day_str} {hour_str}"

    def get_da_yun_str(self) -> str:
        return '  '.join(
            f"{dy.ganzhi}({dy.start_age}歲)" for dy in self.da_yun
        )

    # ── 條文查詢（核心整合功能）
    def lookup_tiaowen(
        self,
        section: Optional[str] = None,
        code: str = "",
    ) -> List[TiaowenEntry]:
        """
        查詢條文

        Args:
            section: 宮部（預設使用年柱地支對應宮部，如「子部」）
            code: 密碼（建除+宿名，如「建張」「平角」）

        Returns:
            匹配條文列表；空列表表示無匹配（需參照原圖）

        手稿提示：查不到條文時，需以原書十八星圖自行參悟。
        """
        sec = section or self.palace_section
        return self._db.lookup(sec, code)

    def lookup_tiaowen_fallback(
        self,
        section: Optional[str] = None,
        code: str = "",
    ) -> str:
        """
        帶 fallback 的條文查詢，返回格式化字串。
        查無結果時提示「需參照原圖」。
        """
        entries = self.lookup_tiaowen(section, code)
        if entries:
            lines = []
            for e in entries:
                lines.append(f"【{e.section} · {e.code}】\n{e.verse}\n{e.comment}")
            return "\n\n".join(lines)
        sec = section or self.palace_section
        return (
            f"【{sec} · {code}】未找到對應條文。\n"
            "提示：需參照原書十八星圖，以圖為體自行參悟。\n"
            "手稿云：「圖不破則數難起」。"
        )

    def lookup_all_tiaowen_for_palace(
        self, section: Optional[str] = None
    ) -> List[TiaowenEntry]:
        """返回某宮部下所有條文（用於瀏覽）"""
        sec = section or self.palace_section
        return self._db.lookup_by_section(sec)

    # ── 密碼查詢
    def lookup_password(self, code: str) -> str:
        return PASSWORDS.get(code, '此密碼手稿未公開，需自行參悟十八星圖。')

    # ── 星圖推演（整合條文）
    def divine(
        self,
        chart: int = 1,
        palace: str = '子',
        jianchu: str = '建',
        xiu: str = '角',
        degree: float = 1.0,
        extra_code: str = "",
    ) -> str:
        """
        依手稿星圖邏輯綜合推演，自動嘗試從資料庫中查詢條文。

        Returns:
            條文文字（有匹配）或星圖解讀說明（無匹配時 fallback）
        """
        # 嘗試直接查詢條文：宮部 + 密碼
        code = jianchu + xiu
        entries = self.lookup_tiaowen(palace + '部', code)
        if entries:
            e = entries[0]
            return f"【{e.section} · {e.code}】\n{e.verse}\n{e.comment}"

        # 無條文時使用星圖解讀
        if chart == 1:
            return interpret_chart_1(palace, xiu, degree)
        if chart == 6:
            return interpret_chart_6(palace, degree)
        return interpret_general(chart, palace, jianchu, xiu, degree, extra_code)

    # ── 完整推演（返回結構化結果）
    def compute(self) -> NanJiResult:
        """
        執行完整推演，返回 NanJiResult 結構。
        包含四柱、大運及本宮部所有可用條文摘要。
        """
        fp = FourPillars(
            year=self.year_pillar,
            month=self.month_pillar,
            day=self.day_pillar or "待查",
            hour=self.hour_pillar or "待設定",
            year_yinyang=self.year_yinyang,
            gender=self.gender,
        )
        # 取本宮部頭幾條條文作為示例
        sample_tiaowen = self.lookup_all_tiaowen_for_palace()[:5]
        return NanJiResult(
            four_pillars=fp,
            da_yun=self.da_yun,
            tiaowen_results=sample_tiaowen,
        )
