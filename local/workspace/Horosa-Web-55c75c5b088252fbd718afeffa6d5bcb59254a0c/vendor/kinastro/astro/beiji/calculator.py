# -*- coding: utf-8 -*-
"""
北極神數 — 核心計算模組
Beiji Shenshu — Core Calculator

算法依據：
  - 以出生年月日時（含刻）起盤
  - 每個查詢類型對應特定宮位表格
  - 從表格定位得到4位數條文代碼，再查詢條文庫
  - 支援出生年干支、時辰地支計算
  - 支援 sxtwl 精確農曆干支（fallback 使用簡化甲子計算）

起盤核心邏輯：
  1. 計算出生年地支（千支/未支，用於選行）
  2. 計算「拾位數」值（由月、日、時、刻等推算，用於選列）
  3. 查表得到後兩位代碼
  4. 組合宮碼+表碼+後兩位 = 4位完整條文代碼
  5. 查條文庫返回條文
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .constants import (
    DAYUN_BRANCH_BACKWARD,
    DAYUN_BRANCH_FORWARD,
    DAYUN_STEM_ORDER,
    DIZHI,
    DIZHI_INDEX,
    DIZHI_SHENGXIAO,
    FIRST_WIFE_TABLE,
    HOUR_TO_DIZHI,
    KE_LABELS,
    PALACE_INFO,
    PARENTS_DIZHI_TABLE,
    QUERY_PALACE_MAP,
    QUERY_TYPES,
    REMARRIAGE_WIFE_TABLE,
    SIBLINGS_COUNT_TABLE,
    TIANGAN,
    TIANGAN_YINYANG,
)

logger = logging.getLogger(__name__)

# 條文文件路徑
_DATA_DIR = Path(__file__).parent / "data"
_VERSES_FILE = _DATA_DIR / "beiji_tiaowen.txt"


# ──────────────────────────────────────────────────────────────────────────────
# 資料類別
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class BeijiInput:
    """北極神數起盤輸入資料"""
    year: int           # 出生年（公曆）
    month: int          # 出生月（公曆）
    day: int            # 出生日（公曆）
    hour: int           # 出生時（24小時制）
    minute: int = 0     # 出生分
    gender: str = "男"  # 性別：男/女
    ke: int = 1         # 刻（1-8，每時辰8刻，每刻15分鐘）


@dataclass
class QueryResult:
    """單一查詢結果"""
    query_type: str          # 查詢類型 id
    query_label: str         # 查詢類型中文標籤
    palace_code: int         # 宮碼 (1-8)
    palace_name: str         # 宮名
    code: str                # 4位條文代碼
    verse: str               # 條文內容
    surname: Optional[str] = None    # 姓氏（婚姻類）
    extra: dict[str, Any] = field(default_factory=dict)   # 附加資訊


@dataclass
class BeijiResult:
    """北極神數完整起盤結果"""
    birth_input: BeijiInput
    year_stem: str           # 出生年天干
    year_branch: str         # 出生年地支
    year_shengxiao: str      # 生肖
    hour_branch: str         # 出生時辰地支
    ke_label: str            # 刻標籤
    ke_value: int            # 刻值（1-8）
    queries: list[QueryResult] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# 干支計算
# ──────────────────────────────────────────────────────────────────────────────

def get_year_ganzhi(year: int, month: int = None, day: int = None) -> tuple[str, str]:
    """
    計算出生年的天干地支。

    以甲子（1984年）為基準計算。
    支援 sxtwl 精確計算（若可用），否則 fallback 使用簡化算法。

    Returns
    -------
    (天干, 地支)
    """
    try:
        from sxtwl import fromSolar
        # [Q-267/T-249 裁决 2026-09-18] 帶月日時按立春(節氣年)界取年干支(同頁其餘門皆按立春界;此前取 6 月 1 日之農曆年 → 公曆 1–2 月生者錯一年);
        # 只給年份(舊調用)仍取 6 月 1 日之農曆年(與此前字節相同)。
        if month and day:
            d = fromSolar(int(year), int(month), int(day))
            gz = d.getYearGZ()   # sxtwl: 節氣年(立春界)
            return TIANGAN[gz.tg], DIZHI[gz.dz]
        day_obj = fromSolar(year, 6, 1)  # 取6月1日避免年初歲末邊界問題
        stem = TIANGAN[day_obj.getLunarYear(False).tg]
        branch = DIZHI[day_obj.getLunarYear(False).dz]
        return stem, branch
    except Exception:
        pass

    # Fallback：以1984年甲子為基準
    offset = (year - 1984) % 60
    stem = TIANGAN[offset % 10]
    branch = DIZHI[offset % 12]
    return stem, branch


def get_hour_branch(hour: int) -> str:
    """根據 24 小時制時間取得時辰地支。"""
    return HOUR_TO_DIZHI.get(hour % 24, "子")


def compute_ke(hour: int, minute: int) -> int:
    """
    根據出生時分計算刻（1-8）。

    每個時辰 = 2小時 = 120分鐘，分為 8 刻（每刻15分鐘）。
    時辰起點為奇數小時（子時23:00, 丑時01:00, 寅時03:00...）。
    計算方式：
      - 奇數小時（1,3,5...21）或23時：時辰第一個小時 → offset = minute
      - 偶數小時（0,2,4...22）：時辰第二個小時 → offset = 60 + minute
    刻 = offset // 15 + 1（1-8，已截斷至合法範圍）。
    """
    # 23時 或 奇數小時 → 時辰第一個小時
    if hour == 23 or hour % 2 == 1:
        offset = minute
    else:
        # 偶數小時 → 時辰第二個小時（距時辰起點已過60分鐘）
        offset = 60 + minute
    ke = min(8, max(1, offset // 15 + 1))
    return ke


# ──────────────────────────────────────────────────────────────────────────────
# 條文庫
# ──────────────────────────────────────────────────────────────────────────────

class TiaowenDatabase:
    """北極神數條文資料庫（從 beiji_tiaowen.txt 載入）"""

    def __init__(self, file_path: Optional[str | Path] = None) -> None:
        self._path = Path(file_path) if file_path else _VERSES_FILE
        self._verses: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        """載入條文文件。"""
        try:
            with open(self._path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    m = re.match(r"^(\d{4})\s+(.+)", line)
                    if m:
                        self._verses[m.group(1)] = m.group(2).strip()
            logger.info("北極神數：成功載入 %d 條條文", len(self._verses))
        except FileNotFoundError:
            logger.warning("北極神數：條文文件未找到：%s", self._path)

    @property
    def loaded(self) -> bool:
        return bool(self._verses)

    def get(self, code: str) -> str:
        """
        查詢指定4位代碼的條文。

        若找不到精確代碼，嘗試尋找相近代碼並給出提示。
        """
        code = str(code).zfill(4)
        if code in self._verses:
            return self._verses[code]

        # 嘗試相近代碼（同宮同表的前兩位相同）
        similar = [c for c in self._verses if c[:2] == code[:2]]
        if similar:
            sample = similar[:3]
            return f"【未找到代碼 {code}】相近代碼示例：{sample}（請核對起盤計算）"
        return f"【未找到代碼 {code}】請確認條文庫是否完整或起盤是否正確。"

    def get_by_palace(self, palace: int) -> dict[str, str]:
        """取得指定宮位的所有條文。"""
        prefix = str(palace)
        return {k: v for k, v in self._verses.items() if k.startswith(prefix)}

    def search(self, keyword: str) -> list[tuple[str, str]]:
        """全文搜尋條文關鍵字，返回 [(code, text), ...]。"""
        return [(k, v) for k, v in self._verses.items() if keyword in v]

    def __len__(self) -> int:
        return len(self._verses)


# ──────────────────────────────────────────────────────────────────────────────
# 主計算器
# ──────────────────────────────────────────────────────────────────────────────

class BeijiShenshu:
    """
    北極神數計算器

    提供多種查詢方法，每個方法對應一個宮位表格：
      - calculate_parents()      — 乾宮：父母屬相壽亡
      - calculate_character()    — 離宮：性格特點
      - calculate_siblings()     — 震宮：兄弟姐妹
      - calculate_first_wife()   — 坎宮：元配妻姓氏
      - calculate_remarriage()   — 坎宮：再婚後妻姓氏
      - calculate_dayun()        — 大運推算
      - calculate_all()          — 一次計算所有主要查詢
    """

    def __init__(self, db: Optional[TiaowenDatabase] = None) -> None:
        self.db = db or TiaowenDatabase()

    # ── 輔助方法 ─────────────────────────────────────────────────────────────

    def _make_code(self, palace: int, table: int, row_col: int) -> str:
        """
        構造4位條文代碼。

        Parameters
        ----------
        palace : int
            宮碼 (1-8)
        table : int
            表碼 (1-8，宮內第幾張表)
        row_col : int
            行列碼 (11-88，十位=行, 個位=列, 均為1-8)
        """
        return f"{palace}{table}{row_col:02d}"

    def _get_col_index(self, birth_input: BeijiInput) -> int:
        """
        計算「列索引」（0-7，對應表格1~8列）。

        北極神數以「拾位數」確定列，計算方式：
          - 基本值：(月 + 日 + 時辰地支索引 + 刻) % 8
          - 得 0-7，對應列 1-8

        注意：此處為簡化計算公式。原教程以「千未數（拾位）」
        為主要定列依據，精確公式因宮位不同而略有差異，
        需對照原典各宮表格的橫縱軸說明進行精確推算。
        """
        hour_branch = get_hour_branch(birth_input.hour)
        hour_idx = DIZHI_INDEX[hour_branch]
        val = (birth_input.month + birth_input.day + hour_idx + birth_input.ke) % 8
        return val  # 0-7

    def _build_query_result(
        self,
        query_type: str,
        query_label: str,
        palace: int,
        table: int,
        row_col: int,
        surname: Optional[str] = None,
        extra: Optional[dict] = None,
    ) -> QueryResult:
        """構造 QueryResult 物件。"""
        code = self._make_code(palace, table, row_col)
        verse = self.db.get(code)
        return QueryResult(
            query_type=query_type,
            query_label=query_label,
            palace_code=palace,
            palace_name=PALACE_INFO[palace]["name"],
            code=code,
            verse=verse,
            surname=surname,
            extra=extra or {},
        )

    # ── 個別計算方法 ─────────────────────────────────────────────────────────

    def calculate_parents(self, inp: BeijiInput) -> QueryResult:
        """
        乾宮表一：論父母屬相壽亡。

        行：出生時辰地支（子~亥）
        列：由月、日、刻計算得出（0-7）
        """
        hour_branch = get_hour_branch(inp.hour)
        col_idx = self._get_col_index(inp)
        row_col_list = PARENTS_DIZHI_TABLE.get(hour_branch, PARENTS_DIZHI_TABLE["子"])
        row_col = row_col_list[col_idx]

        stem, branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        shengxiao = DIZHI_SHENGXIAO[branch]

        return self._build_query_result(
            query_type="parents",
            query_label="父母屬相壽亡",
            palace=1,
            table=1,
            row_col=row_col,
            extra={
                "hour_branch": hour_branch,
                "col_index": col_idx + 1,
                "year_stem": stem,
                "year_branch": branch,
                "shengxiao": shengxiao,
            },
        )

    def calculate_character(self, inp: BeijiInput) -> QueryResult:
        """
        離宮表一：論性格特點（命主個性）。

        行：出生時辰地支
        列：由月、日、刻計算得出
        """
        hour_branch = get_hour_branch(inp.hour)
        col_idx = self._get_col_index(inp)

        # 離宮（3xxx）表一，行列同乾宮邏輯
        from .constants import CHARACTER_DIZHI_TABLE
        row_col_list = CHARACTER_DIZHI_TABLE.get(hour_branch, CHARACTER_DIZHI_TABLE["子"])
        row_col = row_col_list[col_idx]

        return self._build_query_result(
            query_type="character",
            query_label="性格特點",
            palace=3,
            table=1,
            row_col=row_col,
            extra={"hour_branch": hour_branch, "col_index": col_idx + 1},
        )

    def calculate_siblings(self, inp: BeijiInput) -> QueryResult:
        """
        震宮表一：論兄弟姐妹人數。

        行：出生年地支（子~亥）
        列：由月、日、刻計算
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        siblings_desc = SIBLINGS_COUNT_TABLE.get(year_branch, ["兄弟一人"] * 8)[col_idx]

        # 震宮（4xxx）表一
        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="siblings",
            query_label="兄弟姐妹人數",
            palace=4,
            table=1,
            row_col=row_col,
            extra={
                "year_branch": year_branch,
                "siblings_desc": siblings_desc,
                "col_index": col_idx + 1,
            },
        )

    def calculate_first_wife(self, inp: BeijiInput) -> QueryResult:
        """
        兌宮表六：論元配妻之姓氏。

        行：出生年地支
        列：由月、日、刻計算
        （原坎宮表一資料庫缺失，改用兌宮表六婚姻條文）
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        surname = FIRST_WIFE_TABLE.get(year_branch, FIRST_WIFE_TABLE["子"])[col_idx]

        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="first_wife_surname",
            query_label="元配妻之姓氏",
            palace=2,
            table=6,
            row_col=row_col,
            surname=surname,
            extra={"year_branch": year_branch, "surname": surname},
        )

    def calculate_remarriage(self, inp: BeijiInput) -> QueryResult:
        """
        離宮表八：論再婚後妻姓氏。

        行：出生年地支
        列：由月、日、刻計算
        （原坎宮表二資料庫缺失，改用離宮表八婚姻條文）
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        surname = REMARRIAGE_WIFE_TABLE.get(year_branch, REMARRIAGE_WIFE_TABLE["子"])[col_idx]

        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="remarriage_wife_surname",
            query_label="再婚後妻姓氏",
            palace=3,
            table=8,
            row_col=row_col,
            surname=surname,
            extra={"year_branch": year_branch, "surname": surname},
        )

    def calculate_dayun(self, inp: BeijiInput) -> list[dict[str, Any]]:
        """
        計算大運序列（10條，每條10年）。

        北極神數大運邏輯：
          - 陽年男順行、陰年女順行；陽年女逆行、陰年男逆行
          - 從出生年天干地支起，順/逆推8個大運

        Returns
        -------
        list of dicts with keys: index, stem_branch, start_age, end_age, palace, code, verse
        """
        year_stem, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        yinyang = TIANGAN_YINYANG[year_stem]

        # 判斷順逆
        if (yinyang == "陽" and inp.gender == "男") or (yinyang == "陰" and inp.gender == "女"):
            direction = "順"
            stem_seq = DAYUN_STEM_ORDER["陽"]["男"]
            branch_seq = DAYUN_BRANCH_FORWARD
        else:
            direction = "逆"
            stem_seq = DAYUN_STEM_ORDER["陰"]["男"]
            branch_seq = DAYUN_BRANCH_BACKWARD

        # 起始天干索引
        stem_idx = TIANGAN.index(year_stem)
        branch_idx = DIZHI.index(year_branch)

        dayun_list = []
        for i in range(8):
            ds_idx = (stem_idx + i + 1) % 10 if direction == "順" else (stem_idx - i - 1) % 10
            db_idx = (branch_idx + i + 1) % 12 if direction == "順" else (branch_idx - i - 1) % 12
            ds = TIANGAN[ds_idx]
            db = DIZHI[db_idx]
            sb = f"{ds}{db}"

            start_age = i * 10 + 1
            end_age = start_age + 9

            # 大運條文：乾宮表二，行=大運序號(1-8)，列=col_idx
            col_idx = self._get_col_index(inp)
            row_col = (i + 1) * 10 + col_idx + 1
            code = self._make_code(1, 2, row_col)
            verse = self.db.get(code)

            dayun_list.append({
                "index": i + 1,
                "stem_branch": sb,
                "direction": direction,
                "start_age": start_age,
                "end_age": end_age,
                "palace": 1,
                "code": code,
                "verse": verse,
            })

        return dayun_list

    def calculate_wealth(self, inp: BeijiInput) -> QueryResult:
        """
        巽宮表一：論財運。
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="wealth",
            query_label="財運",
            palace=5,
            table=1,
            row_col=row_col,
            extra={"year_branch": year_branch, "col_index": col_idx + 1},
        )

    def calculate_career(self, inp: BeijiInput) -> QueryResult:
        """
        震宮表二：論官運仕途。
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="career",
            query_label="官運仕途",
            palace=4,
            table=2,
            row_col=row_col,
            extra={"year_branch": year_branch, "col_index": col_idx + 1},
        )

    def calculate_children(self, inp: BeijiInput) -> QueryResult:
        """
        乾宮表五：論子息。

        行：出生年地支
        列：由月、日、刻計算
        （原坤宮表一資料庫缺失，改用乾宮表五子息條文）
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="children",
            query_label="子息",
            palace=1,
            table=5,
            row_col=row_col,
            extra={"year_branch": year_branch, "col_index": col_idx + 1},
        )

    def calculate_health(self, inp: BeijiInput) -> QueryResult:
        """
        震宮表三：論健康疾病。

        行：出生年地支
        列：由月、日、刻計算
        （原坎宮表三資料庫缺失，改用震宮表三凶災條文）
        """
        _, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        col_idx = self._get_col_index(inp)
        year_idx = DIZHI_INDEX[year_branch]
        row = (year_idx % 8) + 1
        row_col = row * 10 + col_idx + 1

        return self._build_query_result(
            query_type="health",
            query_label="健康疾病",
            palace=4,
            table=3,
            row_col=row_col,
            extra={"year_branch": year_branch, "col_index": col_idx + 1},
        )

    def calculate_all(self, inp: BeijiInput) -> BeijiResult:
        """
        一次計算所有主要查詢，返回 BeijiResult。

        包含：父母屬相壽亡、性格特點、兄弟姐妹、元配姓氏、
               再婚姓氏、財運、官運、子息、健康
        """
        year_stem, year_branch = get_year_ganzhi(inp.year, getattr(inp, 'month', None), getattr(inp, 'day', None))
        hour_branch = get_hour_branch(inp.hour)
        ke = inp.ke if inp.ke and inp.ke > 0 else compute_ke(inp.hour, inp.minute)
        ke_label = KE_LABELS[min(ke - 1, 7)]

        queries: list[QueryResult] = []
        for fn in [
            self.calculate_parents,
            self.calculate_character,
            self.calculate_siblings,
            self.calculate_first_wife,
            self.calculate_remarriage,
            self.calculate_wealth,
            self.calculate_career,
            self.calculate_children,
            self.calculate_health,
        ]:
            try:
                queries.append(fn(inp))
            except Exception as exc:
                logger.warning("北極神數計算失敗 (%s): %s", fn.__name__, exc)

        return BeijiResult(
            birth_input=inp,
            year_stem=year_stem,
            year_branch=year_branch,
            year_shengxiao=DIZHI_SHENGXIAO[year_branch],
            hour_branch=hour_branch,
            ke_label=ke_label,
            ke_value=ke,
            queries=queries,
        )

    def lookup(self, code: str) -> str:
        """直接查詢指定4位條文代碼。"""
        return self.db.get(code)

    def search_verses(self, keyword: str) -> list[tuple[str, str]]:
        """全文搜尋條文關鍵字。"""
        return self.db.search(keyword)


# ──────────────────────────────────────────────────────────────────────────────
# 便捷函式（供 app.py / renderer 使用）
# ──────────────────────────────────────────────────────────────────────────────

_default_calculator: Optional[BeijiShenshu] = None


def get_calculator() -> BeijiShenshu:
    """返回（或建立）全局單例計算器。"""
    global _default_calculator
    if _default_calculator is None:
        _default_calculator = BeijiShenshu()
    return _default_calculator


def compute_beiji(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int = 0,
    gender: str = "男",
    ke: int = 0,
) -> BeijiResult:
    """
    北極神數完整起盤（便捷函式）。

    Parameters
    ----------
    year, month, day, hour, minute : int
        出生年月日時分
    gender : str
        性別 "男" 或 "女"
    ke : int
        刻（1-8），若為 0 則自動從 minute 計算

    Returns
    -------
    BeijiResult
    """
    inp = BeijiInput(
        year=year,
        month=month,
        day=day,
        hour=hour,
        minute=minute,
        gender=gender,
        ke=ke if ke and ke > 0 else compute_ke(hour, minute),
    )
    return get_calculator().calculate_all(inp)
