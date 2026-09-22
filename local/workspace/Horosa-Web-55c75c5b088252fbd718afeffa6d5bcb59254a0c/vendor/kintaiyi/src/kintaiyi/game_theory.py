"""
太乙神數 × 現代運籌博弈分析模組
==============================

此處以古法「推主客相闗法」及「七大兵法格局」為本，輔以現代零和博弈論（Zero-Sum
Game Theory）及線性規劃（Linear Programming）運籌博弈原理，計算主客雙方在各種
兵法策略下的 Nash 均衡，並求解主方最大期望勝率之最優混合策略。

核心原理：
  - 古法「推主客相闗法」提供主客勝負的定性結論（主勝 / 客勝 / 和）
  - 「主算 / 客算」提供兵力算數之量化比（payoff 基準）
  - 「七大兵法格局」（雷公入水、臨津問道等）各對應一種古典作戰模式，映射為現代
    博弈論的純策略（Pure Strategy），組合成零和支付矩陣（Payoff Matrix）
  - scipy.optimize.linprog 求解混合策略 Nash 均衡
  - 線性規劃求主方「最大期望勝率」之最優混合比例
"""

from __future__ import annotations

from typing import Any

import numpy as np
try:  # 随包运行时不带 scipy(≈30MB):缺时用下方纯 numpy 两阶段单纯形求解同一 LP,数值上与 highs 同解(pytest 对拍)
    from scipy.optimize import linprog as _scipy_linprog  # type: ignore
except Exception:  # pragma: no cover - 取决于运行时
    _scipy_linprog = None


class _LPResult:
    """与 scipy.optimize.OptimizeResult 只交换 success / x / fun / status 四个字段的最小结果对象。"""

    __slots__ = ("success", "x", "fun", "status", "message")

    def __init__(self, success: bool, x: np.ndarray, fun: float, status: int, message: str = "") -> None:
        self.success = success
        self.x = x
        self.fun = fun
        self.status = status
        self.message = message


def _simplex_standard(c: np.ndarray, A: np.ndarray, b: np.ndarray, max_iter: int = 500) -> tuple[bool, np.ndarray, float]:
    """两阶段单纯形(Bland 规则防循环):min c·x  s.t. A x = b, x ≥ 0(b ≥ 0)。

    只为本模块 4×4 零和博弈两个小 LP 服务(变量十来个、约束十来条),不追求通用性能;
    返回 (可行且有界, x, 目标值)。
    """
    m, n = A.shape
    A = A.astype(float).copy()
    b = b.astype(float).copy()
    c = c.astype(float).copy()
    neg = b < 0
    A[neg] *= -1
    b[neg] *= -1
    # 第一阶段:加人工变量 a_i,min Σa_i
    T = np.zeros((m + 1, n + m + 1))
    T[:m, :n] = A
    T[:m, n:n + m] = np.eye(m)
    T[:m, -1] = b
    T[m, n:n + m] = 1.0
    basis = list(range(n, n + m))
    # 用当前基把目标行化零(人工变量列在基内)
    for i in range(m):
        T[m, :] -= T[i, :]

    def pivot(T: np.ndarray, basis: list[int], allowed: int) -> bool:
        for _ in range(max_iter):
            obj = T[-1, :allowed]
            enter = -1
            for j in range(allowed):
                if obj[j] < -1e-12:
                    enter = j
                    break
            if enter < 0:
                return True
            col = T[:-1, enter]
            ratios = [(T[i, -1] / col[i], basis[i], i) for i in range(len(basis)) if col[i] > 1e-12]
            if not ratios:
                return False  # 无界
            ratios.sort(key=lambda t: (t[0], t[1]))
            leave = ratios[0][2]
            pv = T[leave, enter]
            T[leave, :] /= pv
            for i in range(T.shape[0]):
                if i != leave and abs(T[i, enter]) > 1e-15:
                    T[i, :] -= T[i, enter] * T[leave, :]
            basis[leave] = enter
        return False

    if not pivot(T, basis, n + m) or T[-1, -1] < -1e-8:
        return False, np.zeros(n), float("nan")
    # 把仍在基内的人工变量(退化)换出去
    for i in range(m):
        if basis[i] >= n:
            row = T[i, :n]
            js = [j for j in range(n) if abs(row[j]) > 1e-12]
            if js:
                enter = js[0]
                pv = T[i, enter]
                T[i, :] /= pv
                for k in range(T.shape[0]):
                    if k != i and abs(T[k, enter]) > 1e-15:
                        T[k, :] -= T[k, enter] * T[i, :]
                basis[i] = enter
    # 第二阶段:去人工列,换真目标
    T2 = np.zeros((m + 1, n + 1))
    T2[:m, :n] = T[:m, :n]
    T2[:m, -1] = T[:m, -1]
    T2[m, :n] = c
    for i in range(m):
        if basis[i] < n:
            T2[m, :] -= c[basis[i]] * T2[i, :]
    if not pivot(T2, basis, n):
        return False, np.zeros(n), float("nan")
    x = np.zeros(n)
    for i in range(m):
        if basis[i] < n:
            x[basis[i]] = T2[i, -1]
    return True, x, float(c @ x)


def _linprog_fallback(c, A_ub=None, b_ub=None, A_eq=None, b_eq=None, bounds=None, method=None):
    """scipy.optimize.linprog 的最小替身:支持 A_ub/b_ub、A_eq/b_eq、bounds 为 (0,None) 或 (None,None)。

    自由变量拆成 x⁺−x⁻,不等式加松弛变量后化为标准型交给 _simplex_standard。
    """
    c = np.asarray(c, dtype=float)
    n = c.shape[0]
    bounds = list(bounds) if bounds is not None else [(0.0, None)] * n
    free = [i for i, bd in enumerate(bounds) if bd is None or bd[0] is None]
    # 变量映射:非自由变量 → 一列;自由变量 → 两列(正/负部)
    cols = []
    for i in range(n):
        if i in free:
            cols.append((i, +1.0))
            cols.append((i, -1.0))
        else:
            cols.append((i, +1.0))
    nv = len(cols)

    def expand(row: np.ndarray) -> np.ndarray:
        return np.array([row[i] * sgn for (i, sgn) in cols], dtype=float)

    rows = []
    rhs = []
    n_slack = 0
    if A_ub is not None and len(A_ub):
        A_ub = np.asarray(A_ub, dtype=float)
        b_ub = np.asarray(b_ub, dtype=float)
        n_slack = A_ub.shape[0]
        for r in range(A_ub.shape[0]):
            slack = np.zeros(n_slack)
            slack[r] = 1.0
            rows.append(np.concatenate([expand(A_ub[r]), slack]))
            rhs.append(b_ub[r])
    if A_eq is not None and len(A_eq):
        A_eq = np.asarray(A_eq, dtype=float)
        b_eq = np.asarray(b_eq, dtype=float)
        for r in range(A_eq.shape[0]):
            rows.append(np.concatenate([expand(A_eq[r]), np.zeros(n_slack)]))
            rhs.append(b_eq[r])
    A = np.array(rows, dtype=float) if rows else np.zeros((0, nv + n_slack))
    b = np.array(rhs, dtype=float)
    cc = np.concatenate([expand(c), np.zeros(n_slack)])
    ok, xs, fun = _simplex_standard(cc, A, b)
    x = np.zeros(n)
    if ok:
        for k, (i, sgn) in enumerate(cols):
            x[i] += sgn * xs[k]
    return _LPResult(ok, x, fun if ok else float("nan"), 0 if ok else 2, "" if ok else "fallback simplex failed")


def linprog(*args, **kwargs):
    """scipy 在则原样透传(线上字节不变);缺则走纯 numpy 回退。"""
    if _scipy_linprog is not None:
        return _scipy_linprog(*args, **kwargs)
    kwargs.pop("method", None)
    return _linprog_fallback(*args, **kwargs)

# ---------------------------------------------------------------------------
# 常數定義
# ---------------------------------------------------------------------------

# 主方四大兵法策略（古稱）
# 此處以古法兵書所載四種主要戰術為本，輔以現代博弈論純策略（Pure Strategy）分類原理
主方策略列: list[str] = [
    "謀攻（智取）",  # 策略 0：以謀略取勝，側重攻心
    "正攻（硬打）",  # 策略 1：正面強攻，兵力正面對撼
    "奇兵（偷襲）",  # 策略 2：奇兵突進，側翼奇襲
    "守勢（固守）",  # 策略 3：以靜制動，以守待攻
]

# 客方四大兵法策略（與主方對稱，客方視角）
客方策略列: list[str] = [
    "謀攻（智取）",
    "正攻（硬打）",
    "奇兵（偷襲）",
    "守勢（固守）",
]

# 古法「推主客相闗法」結論 → 支付矩陣基礎強度
# 此處以古法「推主客相闗法」吉凶定性為本，輔以博弈論支付函數（Payoff Function）量化原理
_主客相闗強度: dict[str | None, float] = {
    "主勝": 2.0,
    "客勝": -2.0,
    "主將囚，不利主": -3.0,
    "和": 0.0,
}

# 古法「七大兵法」格局名稱 → (主方策略索引, 客方策略索引, 調整量)
# 此處以古法七大兵法格局（雷公入水、臨津問道等）為本，
# 輔以現代博弈論策略對（Strategy Profile）調整原理
# 說明：每種兵法格局「成局」時，對特定策略組合增益 +調整量；「不成」則方向相反
_七大兵法策略映射: dict[str, tuple[int, int, float]] = {
    "推雷公入水": (0, 2, 1.5),  # 謀攻 vs 客奇兵 → 主方謀攻克制客奇兵
    "推臨津問道": (1, 0, 1.0),  # 正攻 vs 客謀攻 → 主方正攻壓制客謀攻
    "推獅子反擲": (2, 1, 1.5),  # 奇兵 vs 客正攻 → 主方奇兵克制客正攻
    "推白雲捲空": (0, 3, 1.0),  # 謀攻 vs 客守勢 → 主方謀攻破客守勢
    "推猛虎相拒": (1, 2, -1.0),  # 正攻 vs 客奇兵 → 客奇兵反制主正攻
    "推白龍得雲": (2, 0, 1.0),  # 奇兵 vs 客謀攻 → 主方奇兵出奇制勝
    "推回軍無言": (3, 1, 1.0),  # 守勢 vs 客正攻 → 主方守勢消耗客正攻
}

# 「成」表示吉（兵法格局出現且正向），「不成」表示凶（方向反轉）
_兵法吉凶字串: set[str] = {"成", "吉", "正", "利"}

# 八門吉凶對主方謀攻策略的加成（此處以古法八門吉凶為本，輔以博弈論邊際效益原理）
_八門吉凶表: dict[str, float] = {
    "開": 1.0,
    "休": 0.5,
    "生": 1.0,
    "傷": -0.5,
    "杜": 0.0,
    "景": 0.5,
    "死": -1.0,
    "驚": -0.5,
}

# 太乙落宮（九宮）對策略列的加成映射
# 此處以古法九宮八卦方位吉凶為本，輔以博弈論位置效應（Positional Effect）原理
# 宮位 → (策略索引, 加成值)：落宮影響特定策略的效力
_太乙落宮策略加成: dict[int, list[tuple[int, float]]] = {
    1: [(3, 0.8)],  # 一宮坎水：守勢有利
    2: [(3, 0.5), (1, -0.3)],  # 二宮坤土：守勢稍利，正攻不利
    3: [(2, 0.8)],  # 三宮震木：奇兵有利
    4: [(0, 0.6), (2, 0.4)],  # 四宮巽木：謀攻與奇兵皆利
    6: [(1, 0.8)],  # 六宮乾金：正攻有利
    7: [(1, 0.5), (0, 0.3)],  # 七宮兌金：正攻與謀攻皆利
    8: [(3, 0.6), (0, 0.4)],  # 八宮艮土：守勢與謀攻皆利
    9: [(0, 0.8)],  # 九宮離火：謀攻有利
}

# 陽遁 / 陰遁對攻守取向的整體調節
# 此處以古法陽遁主攻、陰遁主守為本，輔以博弈論攻守傾向（Offensive/Defensive Bias）原理
_遁法攻守調節: dict[str, list[tuple[int, float]]] = {
    "陽": [(0, 0.3), (1, 0.4), (2, 0.2), (3, -0.3)],  # 陽遁利攻
    "陰": [(0, -0.2), (1, -0.3), (2, 0.2), (3, 0.5)],  # 陰遁利守
}

# 三才理年對策略層次的加成
# 此處以古法三才（天地人）年對應之治理層次為本，輔以博弈論層級優勢原理
_三才理年策略加成: dict[str, list[tuple[int, float]]] = {
    "理天": [(0, 0.5)],  # 理天：謀攻得天助
    "理地": [(3, 0.5)],  # 理地：守勢得地利
    "理人": [(1, 0.3), (2, 0.3)],  # 理人：正攻與奇兵得人和
}

# 八宮旺衰狀態 → 加成係數
# 此處以古法八宮旺相休囚為本，輔以博弈論環境因子調節原理
_八宮旺衰係數: dict[str, float] = {
    "旺": 1.0,
    "相": 0.5,
    "胎": 0.2,
    "沒": -0.3,
    "死": -0.8,
    "囚": -0.5,
    "休": 0.0,
    "廢": -0.4,
}


# ---------------------------------------------------------------------------
# 主類別：TaiyiGame
# ---------------------------------------------------------------------------


class TaiyiGame:
    """
    太乙神數博弈分析類別

    以 pan() 回傳的 result dict 為輸入，根據古法「推主客相闗法」及「七大兵法格局」
    自動建構零和支付矩陣，並使用 scipy.optimize.linprog 計算純策略 / 混合策略
    Nash 均衡，提供主方最優混合策略及期望勝率。

    此處以古法太乙神數推演為本，輔以現代零和博弈論（Zero-Sum Game Theory）
    及線性規劃（Linear Programming）運籌博弈原理。

    參數
    ----
    pan_result : dict[str, Any]
        由 Taiyi.pan() 方法回傳的太乙排盤結果字典。

    屬性
    ----
    支付矩陣 : np.ndarray, shape (4, 4)
        主方視角零和支付矩陣（正值代表主方有利，負值代表客方有利）。
    主方均衡策略 : np.ndarray, shape (4,)
        主方最優混合策略概率分佈。
    客方均衡策略 : np.ndarray, shape (4,)
        客方最優混合策略概率分佈。
    博弈均衡值 : float
        博弈均衡（Game Value），即主方的期望支付值。
    """

    def __init__(self, pan_result: dict[str, Any]) -> None:
        """
        初始化 TaiyiGame，以 pan() 結果建構博弈模型。

        此處以古法太乙排盤推算為本，輔以現代博弈論零和矩陣博弈（Matrix Game）建模原理。

        參數
        ----
        pan_result : dict[str, Any]
            Taiyi.pan() 回傳的字典，需包含「推主客相闗法」、「主算」、「客算」、
            「八門值事」等古法關鍵欄位。
        """
        self._pan = pan_result
        self.支付矩陣: np.ndarray = self._建構支付矩陣()
        game_val, 主策略, 客策略 = self._求Nash均衡()
        self.博弈均衡值: float = game_val
        self.主方均衡策略: np.ndarray = 主策略
        self.客方均衡策略: np.ndarray = 客策略

    # ------------------------------------------------------------------
    # 私有方法：支付矩陣建構
    # ------------------------------------------------------------------

    def _解析主客相闗強度(self) -> float:
        """
        解析古法「推主客相闗法」欄位，轉換為支付矩陣基礎強度值。

        此處以古法「推主客相闗法」主客勝負定性判斷為本，
        輔以博弈論支付函數基準值（Baseline Payoff）設定原理。

        回傳
        ----
        float
            基礎支付強度（正值主方有利，負值客方有利）。
        """
        zjf: str | None = self._pan.get("推主客相闗法")
        if zjf is None:
            return 0.0
        for key, val in _主客相闗強度.items():
            if key and key in zjf:
                return val
        return 0.0

    def _解析算數差值(self) -> float:
        """
        解析主算與客算的數值差，作為兵力強弱比較基準。

        此處以古法「主算 / 客算」算數多寡比較為本，
        輔以博弈論支付函數線性縮放（Linear Scaling）原理。

        回傳
        ----
        float
            (主算 - 客算) / (主算 + 客算) 歸一化差值，範圍 [-1, 1]。
        """
        home_cal_field = self._pan.get("主算")
        away_cal_field = self._pan.get("客算")
        try:
            home = float(home_cal_field[0]) if isinstance(home_cal_field, list) else float(home_cal_field or 0)
            away = float(away_cal_field[0]) if isinstance(away_cal_field, list) else float(away_cal_field or 0)
        except (TypeError, ValueError, IndexError):
            return 0.0
        total = home + away
        if total == 0:
            return 0.0
        return (home - away) / total  # 歸一化至 [-1, 1]

    def _解析八門值事加成(self) -> float:
        """
        解析「八門值事」欄位，得到對主方謀攻策略的加成。

        此處以古法「八門值事」吉凶配應為本，
        輔以博弈論邊際效益（Marginal Payoff）調整原理。

        回傳
        ----
        float
            八門吉凶加成值。
        """
        门: str | None = self._pan.get("八門值事")
        if not 门:
            return 0.0
        return _八門吉凶表.get(str(门).strip(), 0.0)

    def _解析太乙局數(self) -> tuple[int, str, str | None]:
        """
        解析「局式」欄位，取得局數、遁法（陽/陰）及三才理年。

        此處以古法太乙局數推演結果為本，輔以博弈論環境參數建模原理。

        回傳
        ----
        tuple[int, str, str | None]
            (局數 1-72, 遁法 "陽"/"陰", 三才理年 "理天"/"理地"/"理人" or None)
        """
        局式: dict | None = self._pan.get("局式")
        if not isinstance(局式, dict):
            return (0, "", None)
        文: str = 局式.get("文", "")
        數: int = int(局式.get("數", 0))
        年: str | None = 局式.get("年")
        遁法 = "陽" if "陽" in 文 else ("陰" if "陰" in 文 else "")
        return (數, 遁法, 年)

    def _解析太乙落宮(self) -> int:
        """
        解析「太乙落宮」欄位，取得太乙所在宮位（0-9）。

        此處以古法太乙落宮九宮方位為本，輔以博弈論位置效應建模原理。

        回傳
        ----
        int
            太乙所在宮位（0-9）。
        """
        落宮 = self._pan.get("太乙落宮")
        try:
            return int(落宮)
        except (TypeError, ValueError):
            return 0

    def _解析主客筭旺衰(self) -> tuple[float, float]:
        """
        解析主算與客算的旺衰狀態，轉換為策略加成。

        主算旺/客算衰 → 主方攻勢策略加成；
        主算衰/客算旺 → 客方反攻策略加成。

        此處以古法「主筭 / 客筭」旺衰描述為本，
        輔以博弈論軍力態勢（Force Posture）量化原理。

        回傳
        ----
        tuple[float, float]
            (主方旺衰加成, 客方旺衰加成)，正值利攻，負值利守。
        """
        主筭 = self._pan.get("主算")
        客筭 = self._pan.get("客算")

        def _解析旺衰(cal_field: Any) -> float:
            if not isinstance(cal_field, list) or len(cal_field) < 2:
                return 0.0
            desc = cal_field[1]
            desc_str = str(desc) if not isinstance(desc, list) else " ".join(str(d) for d in desc)
            if "旺" in desc_str or "三才足數" in desc_str:
                return 0.6
            if "上和" in desc_str:
                return 0.3
            if "下和" in desc_str:
                return 0.1
            if "純陽" in desc_str or "純陰" in desc_str:
                return -0.2
            if "衰" in desc_str or "無天" in desc_str or "無地" in desc_str or "無人" in desc_str:
                return -0.5
            return 0.0

        return (_解析旺衰(主筭), _解析旺衰(客筭))

    def _解析三門五將(self) -> float:
        """
        解析「推三門具不具」及「推五將發不發」欄位。

        三門具（不吉） → 主方守勢壓力增加
        五將不發 → 進攻策略受限

        此處以古法「三門具不具」與「五將發不發」軍事態勢為本，
        輔以博弈論策略可行域（Feasible Strategy Set）約束原理。

        回傳
        ----
        float
            綜合態勢加成值（正值利攻，負值利守）。
        """
        三門 = str(self._pan.get("推三門具不具", ""))
        五將 = str(self._pan.get("推五將發不發", ""))

        加成 = 0.0
        # 三門具 → 兵勢受制，不利主攻
        if "三門具" in 三門:
            加成 -= 0.4
        elif "三門不具" in 三門:
            加成 += 0.3

        # 五將不發 → 進攻受限
        if "五將不發" in 五將:
            加成 -= 0.5
        elif "五將發" in 五將:
            加成 += 0.4

        return 加成

    def _解析定算(self) -> float:
        """
        解析「定算」欄位，取得定算值對主方的加成。

        定算大 → 整體態勢有利；定算小 → 不利。

        此處以古法「定算」綜合判斷為本，輔以博弈論全局期望值調節原理。

        回傳
        ----
        float
            定算加成值。
        """
        定算 = self._pan.get("定算")
        try:
            val = float(定算[0]) if isinstance(定算, list) else float(定算 or 0)
        except (TypeError, ValueError, IndexError):
            return 0.0
        # 定算常見範圍 0~50+，以 25 為基準歸一化
        return (val - 25.0) / 50.0  # 約 [-0.5, 0.5]

    def _解析八宮旺衰(self) -> float:
        """
        解析「八宮旺衰」欄位，計算太乙落宮所在宮位的旺衰狀態加成。

        此處以古法八宮旺相休囚判斷為本，輔以博弈論環境因子（Environmental Factor）原理。

        回傳
        ----
        float
            太乙落宮之旺衰加成值。
        """
        八宮 = self._pan.get("八宮旺衰")
        if not isinstance(八宮, dict):
            return 0.0
        落宮 = self._解析太乙落宮()
        if 落宮 == 0:
            return 0.0
        狀態 = 八宮.get(落宮)
        if not 狀態:
            return 0.0
        return _八宮旺衰係數.get(str(狀態), 0.0)

    def _建構支付矩陣(self) -> np.ndarray:
        """
        根據古法推算結果自動建構 4×4 零和支付矩陣。

        矩陣建構邏輯（主方視角）：
        1. 以「推主客相闗法」定性結論設定全矩陣基準偏移（base_offset）。
        2. 以「主算 / 客算」差值提供兵力優勢加成。
        3. 以「七大兵法格局」是否成局調整特定策略對的支付值。
        4. 以「八門值事」吉凶補正謀攻策略列。
        5. 以「太乙局數」遁法（陽/陰）調節攻守傾向。
        6. 以「太乙局數」三才理年加成對應策略層次。
        7. 以「太乙落宮」九宮方位加成對應策略。
        8. 以「主算 / 客算」旺衰描述加成攻守態勢。
        9. 以「推三門具不具」及「推五將發不發」約束策略可行域。
        10. 以「定算」綜合值調節全局期望。
        11. 以「八宮旺衰」中太乙落宮之旺衰狀態加成。

        此處以古法太乙神數推演核心要素為本，輔以現代博弈論
        零和支付矩陣（Zero-Sum Payoff Matrix）建構原理。

        回傳
        ----
        np.ndarray, shape (4, 4)
            主方視角支付矩陣。
        """
        # 基礎非對稱博弈結構（反映四大兵法策略間的本質制約關係）
        # 此處以古典兵法「攻守奇正」相互制約原理為本，輔以博弈論策略對（Strategy Profile）初始化
        base = np.array(
            [
                [0.0, 1.0, -1.0, 2.0],  # 謀攻 vs [謀、正、奇、守]
                [-1.0, 0.0, 2.0, 1.0],  # 正攻 vs [謀、正、奇、守]
                [1.0, -2.0, 0.0, 1.5],  # 奇兵 vs [謀、正、奇、守]
                [-2.0, -1.0, -1.5, 0.0],  # 守勢 vs [謀、正、奇、守]
            ],
            dtype=float,
        )

        # 1. 主客相闗法：基準偏移
        # 此處以古法「推主客相闗法」主客強弱為本，輔以博弈論支付函數基準偏移原理
        base_offset = self._解析主客相闗強度()
        base += base_offset

        # 2. 算數差值：兵力強弱全局加成
        # 此處以古法「主算 / 客算」兵力算數比較為本，輔以博弈論支付函數縮放原理
        cal_delta = self._解析算數差值()
        base += cal_delta * 1.5  # 縮放至合理影響範圍

        # 3. 七大兵法格局調整
        # 此處以古法七大兵法格局（雷公入水等）是否成局為本，
        # 輔以博弈論策略對局部支付調整（Local Payoff Adjustment）原理
        for 法名, (row, col, delta) in _七大兵法策略映射.items():
            格局值: Any = self._pan.get(法名)
            if 格局值 is None:
                continue
            格局文字 = str(格局值)
            # 判斷兵法是否成局（含吉字則正向，否則反向）
            if any(吉 in 格局文字 for 吉 in _兵法吉凶字串):
                base[row, col] += delta
            else:
                base[row, col] -= delta * 0.5  # 不成局則反向但力度減半

        # 4. 八門值事補正謀攻策略列（策略索引 0：謀攻）
        # 此處以古法「八門值事」吉凶判斷為本，輔以博弈論邊際效益補正原理
        八門加成 = self._解析八門值事加成()
        base[0, :] += 八門加成  # 謀攻策略受八門吉凶直接影響

        # 5. 太乙局數：遁法攻守傾向調節
        # 此處以古法陽遁主攻、陰遁主守為本，輔以博弈論攻守傾向（Offensive/Defensive Bias）原理
        局數, 遁法, 三才理年 = self._解析太乙局數()
        if 遁法 in _遁法攻守調節:
            for 策略索引, 調節量 in _遁法攻守調節[遁法]:
                base[策略索引, :] += 調節量

        # 6. 太乙局數：三才理年策略層次加成
        # 此處以古法三才理天/理地/理人對應之治理層次為本，輔以博弈論層級優勢原理
        if 三才理年 in _三才理年策略加成:
            for 策略索引, 調節量 in _三才理年策略加成[三才理年]:
                base[策略索引, :] += 調節量

        # 7. 太乙落宮：九宮方位策略加成
        # 此處以古法太乙落宮九宮方位為本，輔以博弈論位置效應（Positional Effect）原理
        落宮 = self._解析太乙落宮()
        if 落宮 in _太乙落宮策略加成:
            for 策略索引, 調節量 in _太乙落宮策略加成[落宮]:
                base[策略索引, :] += 調節量

        # 8. 主客筭旺衰：軍力態勢加成
        # 此處以古法「主筭 / 客筭」旺衰描述為本，輔以博弈論軍力態勢量化原理
        主旺衰, 客旺衰 = self._解析主客筭旺衰()
        # 主筭旺 → 主方攻勢策略（謀攻 + 正攻）增益
        base[0, :] += 主旺衰 * 0.5
        base[1, :] += 主旺衰 * 0.5
        # 客筭旺 → 主方受壓，守勢策略需求增加（反向影響）
        base[2, :] -= 客旺衰 * 0.3
        base[3, :] -= 客旺衰 * 0.3

        # 9. 三門五將：策略可行域約束
        # 此處以古法「推三門具不具」與「推五將發不發」軍事態勢為本，
        # 輔以博弈論策略可行域約束原理
        三門五將加成 = self._解析三門五將()
        # 正值利攻 → 加成謀攻與正攻；負值利守 → 加成守勢
        if 三門五將加成 > 0:
            base[0, :] += 三門五將加成 * 0.5
            base[1, :] += 三門五將加成 * 0.5
        else:
            base[3, :] -= 三門五將加成 * 0.5  # 負值取反為正
            base[2, :] -= 三門五將加成 * 0.3

        # 10. 定算：全局期望值調節
        # 此處以古法「定算」綜合數值為本，輔以博弈論全局期望值偏移原理
        定算加成 = self._解析定算()
        base += 定算加成  # 全局性偏移

        # 11. 八宮旺衰：太乙落宮旺衰環境加成
        # 此處以古法八宮旺相休囚狀態為本，輔以博弈論環境因子原理
        旺衰加成 = self._解析八宮旺衰()
        base += 旺衰加成 * 0.5  # 旺衰影響全局但力度適中

        return base

    # ------------------------------------------------------------------
    # 私有方法：Nash 均衡求解
    # ------------------------------------------------------------------

    def _求Nash均衡(self) -> tuple[float, np.ndarray, np.ndarray]:
        """
        以線性規劃（LP）求解零和博弈的混合策略 Nash 均衡。

        零和博弈 Nash 均衡等價於極小極大定理（Minimax Theorem）：
          - 主方（最大化方）：max v s.t. A^T p ≥ v·e, 1^T p = 1, p ≥ 0
          - 客方（最小化方）：min v s.t. A q ≤ v·e, 1^T q = 1, q ≥ 0

        此處以零和博弈極小極大定理（Minimax Theorem, von Neumann 1928）為本，
        輔以現代線性規劃（Linear Programming）數值求解原理。

        回傳
        ----
        tuple[float, np.ndarray, np.ndarray]
            (博弈均衡值, 主方均衡策略概率向量, 客方均衡策略概率向量)
        """
        A = self.支付矩陣
        m, n = A.shape  # m=4 (主方策略數), n=4 (客方策略數)

        # ---- 主方 LP：max v ↔ min -v ----
        # 決策變數 x = [p_0, p_1, ..., p_{m-1}, v]
        # 此處以主方極小極大問題（Maximin Problem）為本，輔以線性規劃對偶理論（LP Duality）
        c_主 = np.zeros(m + 1)
        c_主[-1] = -1.0  # 最小化 -v

        # 不等式約束：對每個客方策略 j，sum_i A[i,j] * p_i ≥ v
        # → -sum_i A[i,j] * p_i + v ≤ 0
        A_ub_主 = np.zeros((n, m + 1))
        for j in range(n):
            A_ub_主[j, :m] = -A[:, j]
            A_ub_主[j, m] = 1.0
        b_ub_主 = np.zeros(n)

        # 等式約束：sum_i p_i = 1
        A_eq_主 = np.zeros((1, m + 1))
        A_eq_主[0, :m] = 1.0
        b_eq_主 = np.array([1.0])

        # 邊界：p_i ≥ 0, v 無界
        bounds_主 = [(0.0, None)] * m + [(None, None)]

        res_主 = linprog(c_主, A_ub=A_ub_主, b_ub=b_ub_主, A_eq=A_eq_主, b_eq=b_eq_主, bounds=bounds_主, method="highs")

        if res_主.success:
            p_主 = np.clip(res_主.x[:m], 0, None)
            p_主 /= p_主.sum() if p_主.sum() > 0 else 1.0
            game_value: float = float(-res_主.fun)
        else:
            # LP 求解失敗時退化為均等混合策略
            p_主 = np.ones(m) / m
            game_value = float(np.min(np.max(A, axis=0)))

        # ---- 客方 LP：min v ↔ min v ----
        # 決策變數 y = [q_0, q_1, ..., q_{n-1}, v]
        # 此處以客方極小化問題（Minimax Problem）為本，輔以線性規劃對偶理論
        c_客 = np.zeros(n + 1)
        c_客[-1] = 1.0  # 最小化 v

        # 不等式約束：對每個主方策略 i，sum_j A[i,j] * q_j ≤ v
        # → sum_j A[i,j] * q_j - v ≤ 0
        A_ub_客 = np.zeros((m, n + 1))
        for i in range(m):
            A_ub_客[i, :n] = A[i, :]
            A_ub_客[i, n] = -1.0
        b_ub_客 = np.zeros(m)

        # 等式約束：sum_j q_j = 1
        A_eq_客 = np.zeros((1, n + 1))
        A_eq_客[0, :n] = 1.0
        b_eq_客 = np.array([1.0])

        bounds_客 = [(0.0, None)] * n + [(None, None)]

        res_客 = linprog(c_客, A_ub=A_ub_客, b_ub=b_ub_客, A_eq=A_eq_客, b_eq=b_eq_客, bounds=bounds_客, method="highs")

        if res_客.success:
            p_客 = np.clip(res_客.x[:n], 0, None)
            p_客 /= p_客.sum() if p_客.sum() > 0 else 1.0
        else:
            p_客 = np.ones(n) / n

        return game_value, p_主, p_客

    # ------------------------------------------------------------------
    # 公開方法：運籌博弈分析報告
    # ------------------------------------------------------------------

    def 分析報告(self) -> dict[str, Any]:
        """
        生成完整的運籌博弈分析報告。

        整合古法太乙神數推演與現代博弈論分析，輸出包含：
          - 零和支付矩陣（古法兵法格局映射）
          - 主方 / 客方最優混合策略概率分佈
          - 博弈均衡值（期望支付值）
          - 線性規劃最大期望勝率求解結果
          - 主方最優純策略建議
          - 太乙局數、太乙落宮、主客筭旺衰等古法參數摘要

        此處以古法太乙神數「主客相剋」與「兵法吉凶」為本，
        輔以現代博弈論 Nash 均衡（Nash Equilibrium）與運籌學線性規劃報告原理。

        回傳
        ----
        dict[str, Any]
            含以下鍵：
              - 主方策略列 : list[str]
              - 客方策略列 : list[str]
              - 支付矩陣 : list[list[float]]
              - 主方均衡策略 : list[float]  （Nash 混合策略概率）
              - 客方均衡策略 : list[float]  （Nash 混合策略概率）
              - 博弈均衡值 : float           （期望支付值，正值主方有利）
              - 主方最優純策略 : str          （概率最大之純策略）
              - 客方最優純策略 : str
              - 古法推主客相闗 : str          （原始古法結論）
              - 主方勝率判斷 : str            （量化解讀）
              - LP最大勝率 : dict             （線性規劃最優化結果）
              - 太乙局數摘要 : dict           （局數、遁法、三才理年）
              - 太乙落宮 : int               （太乙所在宮位）
              - 八宮旺衰狀態 : str           （太乙落宮之旺衰狀態）
        """
        # 線性規劃：求主方「最大期望勝率」
        # 此處以古法兵法「選擇最優計策」思想為本，輔以現代運籌學線性規劃（LP）最優化原理
        lp結果 = self._LP最優主策略()

        # 主方勝率量化解讀
        if self.博弈均衡值 > 1.0:
            勝率判斷 = "主方大勝（博弈均衡值顯著正值，主方策略佔優）"
        elif self.博弈均衡值 > 0:
            勝率判斷 = "主方小勝（博弈均衡值略正，主方略佔優勢）"
        elif self.博弈均衡值 == 0:
            勝率判斷 = "主客均勢（博弈均衡值為零，雙方勢均力敵）"
        elif self.博弈均衡值 > -1.0:
            勝率判斷 = "客方小勝（博弈均衡值略負，客方略佔優勢）"
        else:
            勝率判斷 = "客方大勝（博弈均衡值顯著負值，客方策略佔優）"

        主方最優純策略索引 = int(np.argmax(self.主方均衡策略))
        客方最優純策略索引 = int(np.argmax(self.客方均衡策略))

        # 太乙局數摘要
        局數, 遁法, 三才理年 = self._解析太乙局數()
        局式 = self._pan.get("局式")
        太乙局數摘要: dict[str, Any] = {
            "局數": 局數,
            "遁法": f"{遁法}遁" if 遁法 else "未知",
            "三才理年": 三才理年 or "未知",
            "局式文字": 局式.get("文", "") if isinstance(局式, dict) else "",
        }

        # 太乙落宮旺衰
        落宮 = self._解析太乙落宮()
        八宮 = self._pan.get("八宮旺衰")
        落宮旺衰狀態 = ""
        if isinstance(八宮, dict) and 落宮:
            落宮旺衰狀態 = str(八宮.get(落宮, ""))

        return {
            "主方策略列": 主方策略列,
            "客方策略列": 客方策略列,
            "支付矩陣": self.支付矩陣.tolist(),
            "主方均衡策略": [round(float(p), 4) for p in self.主方均衡策略],
            "客方均衡策略": [round(float(p), 4) for p in self.客方均衡策略],
            "博弈均衡值": round(self.博弈均衡值, 4),
            "主方最優純策略": 主方策略列[主方最優純策略索引],
            "客方最優純策略": 客方策略列[客方最優純策略索引],
            "古法推主客相闗": self._pan.get("推主客相闗法", "無"),
            "主方勝率判斷": 勝率判斷,
            "LP最大勝率": lp結果,
            "太乙局數摘要": 太乙局數摘要,
            "太乙落宮": 落宮,
            "八宮旺衰狀態": 落宮旺衰狀態,
        }

    def _LP最優主策略(self) -> dict[str, Any]:
        """
        以線性規劃求主方在四大兵法中的「最大期望勝率」最優混合比例。

        問題設定：
          假設客方採用最不利於主方的策略（worst-case），
          主方如何分配四大兵法策略的使用比例，以最大化期望支付？
          此即 maximin 問題，等價於 Nash 均衡主方解。

        此處以古法「擇優而從，避害趨利」兵法思想為本，
        輔以現代運籌學線性規劃（LP）最大化期望收益原理。

        回傳
        ----
        dict[str, Any]
            含最優策略比例、最大期望支付值及策略建議文字。
        """
        A = self.支付矩陣
        m, n = A.shape
        # 與 Nash 均衡主方 LP 等價，直接使用已求得結果
        比例 = {主方策略列[i]: round(float(self.主方均衡策略[i]), 4) for i in range(m)}
        最優索引 = int(np.argmax(self.主方均衡策略))
        主要策略 = 主方策略列[最優索引]

        # 融合太乙局數與落宮資訊於建議文字
        局數, 遁法, 三才理年 = self._解析太乙局數()
        落宮 = self._解析太乙落宮()
        局數描述 = ""
        if 局數 > 0:
            局數描述 = f"（{遁法}遁{局數}局"
            if 三才理年:
                局數描述 += f"、{三才理年}"
            if 落宮 != 0:  # 0 = unknown/not applicable; valid palaces are 1-9
                局數描述 += f"、太乙落{落宮}宮"
            局數描述 += "）"

        建議文字 = (
            f"依太乙推主客相闗法、七大兵法、太乙局數與落宮{局數描述}，"
            f"結合現代博弈論 Nash 均衡，"
            f"主方最適策略為「{主要策略}」"
            f"（配置比例 {比例[主要策略] * 100:.1f}%），"
            f"最大期望支付值為 {self.博弈均衡值:.4f}。"
        )
        return {
            "最優策略比例": 比例,
            "最大期望支付值": round(self.博弈均衡值, 4),
            "主要建議策略": 主要策略,
            "建議文字": 建議文字,
        }

    def 格局摘要文字(self) -> str:
        """
        生成供 AI 提示詞使用的博弈分析摘要文字（繁體中文）。

        此處以古法術語為主，融合現代博弈論量化結果，
        適合作為 AI 系統提示或排盤分析附錄。

        回傳
        ----
        str
            可直接嵌入提示詞的摘要段落。
        """
        報告 = self.分析報告()
        lp = 報告["LP最大勝率"]

        主均衡_str = "、".join(
            f"{名}:{概率 * 100:.1f}%" for 名, 概率 in zip(主方策略列, 報告["主方均衡策略"], strict=True)
        )
        客均衡_str = "、".join(
            f"{名}:{概率 * 100:.1f}%" for 名, 概率 in zip(客方策略列, 報告["客方均衡策略"], strict=True)
        )

        # 太乙局數與落宮摘要行
        局數摘要 = 報告.get("太乙局數摘要", {})
        局式文字 = 局數摘要.get("局式文字", "")
        落宮 = 報告.get("太乙落宮", 0)
        旺衰 = 報告.get("八宮旺衰狀態", "")

        lines = [
            "【運籌博弈分析（太乙古法 × Nash 均衡）】",
            f"古法推主客相闗：{報告['古法推主客相闗']}",
        ]
        if 局式文字:
            局式行 = f"太乙局數：{局式文字}"
            if 局數摘要.get("三才理年") and 局數摘要["三才理年"] != "未知":
                局式行 += f"（{局數摘要['三才理年']}）"
            lines.append(局式行)
        if 落宮 != 0:  # 0 = unknown/not applicable; valid palaces are 1-9
            落宮行 = f"太乙落宮：第{落宮}宮"
            if 旺衰:
                落宮行 += f"（{旺衰}）"
            lines.append(落宮行)
        lines += [
            f"博弈均衡值（期望支付）：{報告['博弈均衡值']}",
            f"主方勝率判斷：{報告['主方勝率判斷']}",
            f"主方 Nash 均衡混合策略：{主均衡_str}",
            f"客方 Nash 均衡混合策略：{客均衡_str}",
            f"主方最優純策略：{報告['主方最優純策略']}",
            f"客方最優純策略：{報告['客方最優純策略']}",
            f"線性規劃建議：{lp['建議文字']}",
        ]
        return "\n".join(lines)
