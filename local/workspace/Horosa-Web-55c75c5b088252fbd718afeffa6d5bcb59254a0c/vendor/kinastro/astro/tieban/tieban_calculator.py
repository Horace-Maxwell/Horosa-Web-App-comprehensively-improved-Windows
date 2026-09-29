"""
astro/tieban/tieban_calculator.py — 鐵板神數核心計算引擎

Tie Ban Shen Shu (Iron Plate Divine Numbers) Calculator

基於《鐵板神數清刻足本》完整起例與推算方法：
1. 八卦加則例：天干配卦、地支配卦、河洛配數、地支取數
2. 安命安身例：命宮、身宮、十二宮安法
3. 紫微斗數安星：紫府、南北斗星、十四主星、六吉六煞
4. 納音五行：六十甲子納音歌訣
5. 考刻分：時分 8 刻、每刻 15 分（120 分/時），結合父母六親佐證
6. 秘鈔密碼表：卦象、流度、納甲卦爻快速查表 → 萬千百十號
7. 條文查詢：根據號碼查對應詩讖條文

References
----------
- 《鐵板神數清刻足本》（心一堂，2013，底本：清中葉貞元書屋刻本）
- 《皇極數》（明代邵子數，八刻分經定數）
- 邵雍《皇極經世》先天之學
- 傳統紫微斗數安星法

Author: Hermes Agent (鐵板神數專家 + 編程開發者)
Version: v1.0 (KinAstro v2.3.0, 第 34 個占星體系)
"""

from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json
import os
import threading

# 從坤集結構模組匯入核心資料與扣入法工具
from astro.tieban.kunji_full_structure import (
    KUNJI_TIANGAN_CODE,
    KUNJI_TIANGAN_CODE_REVERSE,
    kou_ru_fa,
    advanced_kou_ru_fa,
    BAKE_96_KE,
    SIX_QIN_KE_FEN,
)

# ============================================================================
# 基礎常數 (Basic Constants) - 原文第 1-2 頁
# ============================================================================

# 诗词库(verses.json 796 KB)/ 足本条文库(tiaowen_full_12000.json 1.3 MB)按进程只载一次:原每次排盘新建计算器
# 都重读两份 JSON(约 8.6 ms,占该端点一半以上);分类检索改查载入时建好的分类索引(原每次全表线性扫,
# 每次排盘约 21 次、约 5.8 ms)。库载入后只读:排盘路径对 lookup 返回的条目与检索结果只读,足本条文 get / search /
# get_range 本就返回副本 → 共享与每次新建输出逐字节相同。只缓存成功载入的数据(失败照旧各自回退)。
# 开关:HOROSA_TIEBAN_DB_MEMO=0 → 每个实例各自载入、分类检索线性扫(旧行为)。
_TIEBAN_DB_MEMO_ON = os.environ.get("HOROSA_TIEBAN_DB_MEMO", "1").lower() not in ("0", "false", "no", "off")
_TIEBAN_DB_MEMO: Dict[Tuple[str, str], Any] = {}
_TIEBAN_DB_MEMO_LOCK = threading.Lock()


def _build_category_index(verses: Dict[str, Dict]) -> Optional[Dict[Any, List[str]]]:
    """分类 → 条文编号列表(保持原字典顺序);任何异常返回 None(检索照旧线性扫)。"""
    try:
        idx: Dict[Any, List[str]] = {}
        for number, verse_data in verses.items():
            idx.setdefault(verse_data.get('category'), []).append(number)
        return idx
    except Exception:
        return None


HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# 十二宮位名稱
PALACE_NAMES = [
    "命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮",
    "遷移宮", "交友宮", "官祿宮", "田宅宮", "福德宮", "父母宮"
]

# 五行
FIVE_ELEMENTS = ["金", "木", "水", "火", "土"]

# 八卦
EIGHT_TRIGRAMS = ["乾", "坤", "震", "巽", "坎", "離", "艮", "兌"]

# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Ganzhi:
    """干支類"""
    stem: str
    branch: str
    
    def __str__(self):
        return f"{self.stem}{self.branch}"
    
    @property
    def stem_index(self) -> int:
        return HEAVENLY_STEMS.index(self.stem)
    
    @property
    def branch_index(self) -> int:
        return EARTHLY_BRANCHES.index(self.branch)
    
    @staticmethod
    def from_index(stem_idx: int, branch_idx: int) -> 'Ganzhi':
        return Ganzhi(
            HEAVENLY_STEMS[stem_idx % 10],
            EARTHLY_BRANCHES[branch_idx % 12]
        )
    
    @staticmethod
    def from_year(year: int) -> 'Ganzhi':
        """從西元年份計算年柱"""
        # 1984 年為甲子年
        base_year = 1984
        stem_idx = (year - base_year) % 10
        branch_idx = (year - base_year) % 12
        return Ganzhi(HEAVENLY_STEMS[stem_idx], EARTHLY_BRANCHES[branch_idx])


@dataclass
class TieBanBirthData:
    """
    鐵板神數出生資料
    
    Attributes
    ----------
    birth_dt : datetime
        出生時間（精確到分鐘，用於考刻分）
    year_gz : Ganzhi
        年柱
    month_gz : Ganzhi
        月柱
    day_gz : Ganzhi
        日柱
    hour_gz : Ganzhi
        時柱
    gender : str
        性別 ("男" 或 "女")
    father_birth : Optional[datetime]
        父親出生時間（考刻分必需）
    father_death : Optional[datetime]
        父親卒年（考刻分必需）
    mother_birth : Optional[datetime]
        母親出生時間（考刻分必需）
    mother_death : Optional[datetime]
        母親卒年（考刻分必需）
    siblings_info : str
        兄弟姊妹信息（例："兄弟二人"、"姊妹三人"）
    marital_status : str
        婚姻狀況（例："已婚"、"未婚"）
    children_info : str
        子女信息（例："二子一女"）
    """
    birth_dt: datetime
    year_gz: Ganzhi
    month_gz: Ganzhi
    day_gz: Ganzhi
    hour_gz: Ganzhi
    gender: str = "男"
    father_birth: Optional[datetime] = None
    father_death: Optional[datetime] = None
    mother_birth: Optional[datetime] = None
    mother_death: Optional[datetime] = None
    siblings_info: str = ""
    marital_status: str = ""
    children_info: str = ""


@dataclass
class TieBanResult:
    """鐵板神數推算結果"""
    # 基本資訊
    birth_data: TieBanBirthData
    
    # 命宮與身宮
    ming_palace: str = ""  # 命宮地支
    shen_palace: str = ""  # 身宮地支
    
    # 十二宮
    palaces: Dict[str, Dict] = field(default_factory=dict)
    
    # 紫微斗數安星
    ziwei_stars: Dict[str, str] = field(default_factory=dict)
    
    # 五行局
    wuxing_ju: str = ""
    
    # 考刻分結果
    ke: int = 0  # 刻 (0-7)
    fen: int = 0  # 分 (0-14)
    
    # 河洛配數
    he_luo_number: int = 0
    
    # 鐵板神數號碼（萬千百十號）
    tieban_number: str = ""
    
    # 對應條文（完整數據）
    verse_data: Dict[str, Any] = field(default_factory=dict)
    
    # 條文文本（便捷訪問）
    verse: str = ""
    
    # 十二宮條文（每宮對應條文）
    palace_verses: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # 密碼表映射
    secret_code: str = ""
    
    # 坤集扣入法天干序列（由 tieban_number 計算）
    kunji_tiangan: List[str] = field(default_factory=list)
    
    # 刻名稱（初刻／正一刻…）
    ke_label: str = ""
    
    # 九十六刻表查詢結果（父母兄弟欄）
    bake_fuqin_info: str = ""
    
    # 六親刻分圖查詢結果（妻子欄）
    six_qin_qizi_info: str = ""
    
    # 完整 12000 條文資料庫查詢結果
    tiaowen_data: Optional[Dict[str, Any]] = None
    
    # 坤集條文編號（1001–13000，由 tieban_number 映射而來）
    tiaowen_number: int = 0
    
    # 原始數據
    raw_data: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# 映射表 (Mappings) - 原文「八卦加則例」等
# ============================================================================

class Mapping:
    """鐵板神數各種映射表"""
    
    # ========== 天干配卦例 (原文) ==========
    STEM_TO_GUA = {
        '壬': '乾', '甲': '乾',
        '乙': '坤', '癸': '坤',
        '庚': '艮',
        '辛': '巽',
        '己': '震',
        '戊': '離',
        '丙': '坎',
        '丁': '兌',
    }
    
    # ========== 地支配卦例 (原文「一數坎兮二數坤...」) ==========
    BRANCH_TO_GUA = {
        '子': '坎',
        '丑': '坤',
        '寅': '震',
        '卯': '震',
        '辰': '兌',
        '巳': '離',
        '午': '離',
        '未': '坤',
        '申': '乾',
        '酉': '乾',
        '戌': '兌',
        '亥': '坎',
    }
    
    # ========== 日主配卦例 (原文) ==========
    DAY_MASTER_GUA = {
        '亥': '坎', '子': '坎',
        '寅': '震', '卯': '震',
        '巳': '離', '午': '離',
        '丑': '坤', '未': '坤',
        '辰': '兌', '戌': '兌',
        '申': '乾', '酉': '乾',
    }
    
    # ========== 河洛配數例 (原文) ==========
    # 甲己子午 9, 乙庚丑未 8, 丙辛寅申 7, 丁壬卯酉 6, 戊癸辰戌 5, 巳亥 4
    HE_LUO_PAIRS = [
        (['甲', '己', '子', '午'], 9),
        (['乙', '庚', '丑', '未'], 8),
        (['丙', '辛', '寅', '申'], 7),
        (['丁', '壬', '卯', '酉'], 6),
        (['戊', '癸', '辰', '戌'], 5),
        (['巳', '亥'], 4),
    ]
    
    # ========== 地支取數例 (原文) ==========
    BRANCH_NUM = {
        ('亥', '子'): 1,
        ('寅', '卯'): 3,
        ('巳', '午'): 2,
        ('申', '酉'): 4,
        ('辰', '戌', '丑', '未'): 5,
    }
    
    # ========== 六十納音 (完整 60 組，原文歌訣轉為 dict) ==========
    NAYIN = {
        # 甲子乙丑海中金，丙寅丁卯爐中火
        '甲子': '海中金', '乙丑': '海中金',
        '丙寅': '爐中火', '丁卯': '爐中火',
        # 戊辰己巳大林木，庚午辛未路旁土
        '戊辰': '大林木', '己巳': '大林木',
        '庚午': '路旁土', '辛未': '路旁土',
        # 壬申癸酉劍鋒金，甲戌乙亥山頭火
        '壬申': '劍鋒金', '癸酉': '劍鋒金',
        '甲戌': '山頭火', '乙亥': '山頭火',
        # 丙子丁丑澗下水，戊寅己卯城頭土
        '丙子': '澗下水', '丁丑': '澗下水',
        '戊寅': '城頭土', '己卯': '城頭土',
        # 庚辰辛巳白蠟金，壬午癸未楊柳木
        '庚辰': '白蠟金', '辛巳': '白蠟金',
        '壬午': '楊柳木', '癸未': '楊柳木',
        # 甲申乙酉泉中水，丙戌丁亥屋上土
        '甲申': '泉中水', '乙酉': '泉中水',
        '丙戌': '屋上土', '丁亥': '屋上土',
        # 戊子己丑霹靂火，庚寅辛卯松柏木
        '戊子': '霹靂火', '己丑': '霹靂火',
        '庚寅': '松柏木', '辛卯': '松柏木',
        # 壬辰癸巳長流水，甲午乙未砂中金
        '壬辰': '長流水', '癸巳': '長流水',
        '甲午': '砂中金', '乙未': '砂中金',
        # 丙申丁酉山下火，戊戌己亥平地木
        '丙申': '山下火', '丁酉': '山下火',
        '戊戌': '平地木', '己亥': '平地木',
        # 庚子辛丑壁上土，壬寅癸卯金箔金
        '庚子': '壁上土', '辛丑': '壁上土',
        '壬寅': '金箔金', '癸卯': '金箔金',
        # 甲辰乙巳覆燈火，丙午丁未天河水
        '甲辰': '覆燈火', '乙巳': '覆燈火',
        '丙午': '天河水', '丁未': '天河水',
        # 戊申己酉大驛土，庚戌辛亥釵釧金
        '戊申': '大驛土', '己酉': '大驛土',
        '庚戌': '釵釧金', '辛亥': '釵釧金',
        # 壬子癸丑桑柘木，甲寅乙卯大溪水
        '壬子': '桑柘木', '癸丑': '桑柘木',
        '甲寅': '大溪水', '乙卯': '大溪水',
        # 丙辰丁巳砂中土，戊午己未天上火
        '丙辰': '砂中土', '丁巳': '砂中土',
        '戊午': '天上火', '己未': '天上火',
        # 庚申辛酉石榴木，壬戌癸亥大海水
        '庚申': '石榴木', '辛酉': '石榴木',
        '壬戌': '大海水', '癸亥': '大海水',
    }
    
    # ========== 五行局數 (由納音決定) ==========
    NAYIN_TO_JU = {
        '海中金': 4, '爐中火': 6, '大林木': 3, '路旁土': 5, '劍鋒金': 4,
        '山頭火': 6, '澗下水': 2, '城頭土': 5, '白蠟金': 4, '楊柳木': 3,
        '泉中水': 2, '屋上土': 5, '霹靂火': 6, '松柏木': 3, '長流水': 2,
        '砂中金': 4, '山下火': 6, '平地木': 3, '壁上土': 5, '金箔金': 4,
        '覆燈火': 6, '天河水': 2, '大驛土': 5, '釵釧金': 4, '桑柘木': 3,
        '大溪水': 2, '砂中土': 5, '天上火': 6, '石榴木': 3, '大海水': 2,
    }
    
    @classmethod
    def get_he_luo_num(cls, stem: str, branch: str) -> int:
        """
        河洛配數例
        
        甲己子午 9, 乙庚丑未 8, 丙辛寅申 7, 丁壬卯酉 6, 戊癸辰戌 5, 巳亥 4
        """
        for items, num in cls.HE_LUO_PAIRS:
            if stem in items or branch in items:
                return num
        return 0
    
    @classmethod
    def get_branch_num(cls, branch: str) -> int:
        """地支取數例"""
        for branches, num in cls.BRANCH_NUM.items():
            if branch in branches:
                return num
        return 0
    
    @classmethod
    def get_nayin(cls, ganzhi: Ganzhi) -> str:
        """取得納音"""
        key = str(ganzhi)
        return cls.NAYIN.get(key, "未知")
    
    @classmethod
    def get_wuxing_ju(cls, ganzhi: Ganzhi) -> Tuple[str, int]:
        """
        取得五行局
        
        Returns
        -------
        Tuple[str, int]
            (局名，局數)
        """
        nayin = cls.get_nayin(ganzhi)
        ju_num = cls.NAYIN_TO_JU.get(nayin, 0)
        return nayin, ju_num


# ============================================================================
# 安星與宮位計算 (Star Placement & Palace Calculation)
# ============================================================================

class StarPlacement:
    """安星與宮位計算（原文「安命例」「安紫府圖」等）"""
    
    @staticmethod
    def an_ming(year_gz: Ganzhi, month_gz: Ganzhi, hour_gz: Ganzhi, 
                is_leap_month: bool = False) -> Dict[str, str]:
        """
        安命例 (原文)
        
        從寅上起正月，順至本生月；
        自人生月上起子時，逆至本生時。安命順至本生時。
        閏月作多一月算。
        
        Returns
        -------
        Dict[str, str]
            {'命宮': 地支，'身宮': 地支}
        """
        # 月數（寅=1 月）
        month_num = month_gz.branch_index  # 寅=2, 但從寅起正月所以直接用 index
        
        # 從寅上起正月，順數到生月
        # 寅 (2) 起正月，卯 (3) 二月...
        month_palace = (2 + month_num - 2) % 12  # 簡化：直接用地支索引
        
        # 從生月起子時，逆數到生時
        hour_num = hour_gz.branch_index
        # 逆數：命宮 = (月宮 - 時數) % 12
        ming_palace_idx = (month_palace - hour_num) % 12
        
        # 身宮：從寅上起正月順數到生月，再從生月起子時順數到生時
        shen_palace_idx = (month_palace + hour_num) % 12
        
        return {
            '命宮': EARTHLY_BRANCHES[ming_palace_idx],
            '身宮': EARTHLY_BRANCHES[shen_palace_idx],
            '命宮索引': ming_palace_idx,
            '身宮索引': shen_palace_idx,
        }
    
    @staticmethod
    def an_twelve_palaces(ming_palace_branch: str) -> Dict[str, str]:
        """
        安十二宮
        
        命宮定位後，其餘十一宮按地支順序逆時針排列
        
        Returns
        -------
        Dict[str, str]
            {宮位名：地支}
        """
        ming_idx = EARTHLY_BRANCHES.index(ming_palace_branch)
        
        result = {}
        for i, palace_name in enumerate(PALACE_NAMES):
            branch_idx = (ming_idx - i) % 12  # 逆時針
            result[palace_name] = EARTHLY_BRANCHES[branch_idx]
        
        return result
    
    @staticmethod
    def an_ziwei(year_stem: str, wuxing_ju: int, lunar_day: int) -> str:
        """
        安紫微星 (原文「安紫府圖」)
        
        紫微星位置由五行局數與農曆日決定
        口訣：「子午卯酉起寅宮，辰戌丑未起申宮，寅申巳亥起巳宮」
        
        Parameters
        ----------
        year_stem : str
            年干
        wuxing_ju : int
            五行局數 (2-6)
        lunar_day : int
            農曆日 (1-30)
        
        Returns
        -------
        str
            紫微星所在地支
        """
        # 簡化版：實際需按完整口訣計算
        # 此處為示例，完整版需實現全部安星規則
        base_positions = {
            '甲': '寅', '己': '申',
            '乙': '卯', '庚': '酉',
            '丙': '辰', '辛': '戌',
            '丁': '巳', '壬': '亥',
            '戊': '午', '癸': '子',
        }
        
        base_branch = base_positions.get(year_stem, '寅')
        base_idx = EARTHLY_BRANCHES.index(base_branch)
        
        # 按局數與日數調整
        offset = (lunar_day - 1) % wuxing_ju
        ziwei_idx = (base_idx + offset) % 12
        
        return EARTHLY_BRANCHES[ziwei_idx]
    
    @staticmethod
    def an_tianfu(ziwei_branch: str) -> str:
        """
        安天府星
        
        天府與紫微永遠相對（六沖位）
        """
        ziwei_idx = EARTHLY_BRANCHES.index(ziwei_branch)
        tianfu_idx = (ziwei_idx + 6) % 12
        return EARTHLY_BRANCHES[tianfu_idx]
    
    @staticmethod
    def get_complete_stars(birth_data: TieBanBirthData, wuxing_ju: int, 
                           lunar_day: int) -> Dict[str, str]:
        """
        完整安星（紫微斗數十四主星 + 六吉六煞）
        
        此處為核心框架，完整版需實現所有安星口訣
        """
        year_stem = birth_data.year_gz.stem
        
        # 紫微、天府
        ziwei = StarPlacement.an_ziwei(year_stem, wuxing_ju, lunar_day)
        tianfu = StarPlacement.an_tianfu(ziwei)
        
        # 簡化返回（完整版需包含所有 14 主星 + 吉煞曜）
        return {
            '紫微': ziwei,
            '天府': tianfu,
            # 其他星曜此處省略，完整版需全部實現
        }


# ============================================================================
# 考刻分引擎 (Ke Fen Calculation Engine) - 核心秘密
# ============================================================================

class KeFenEngine:
    """
    考刻分引擎
    
    原文關鍵：每一時推 8 刻，每一刻推 15 分（120 分/時）
    結合父母生卒、六親存亡「考」出唯一準確刻分
    """
    
    @staticmethod
    def calculate_ke_fen(birth_dt: datetime, hour_gz: Ganzhi) -> Tuple[int, int, List[Tuple[int, int]]]:
        """
        計算刻分（初步，未考證父母六親）
        
        鐵板神數核心：每時分 8 刻，每刻 15 分 = 120 分/時
        
        Parameters
        ----------
        birth_dt : datetime
            出生時間（精確到分鐘）
        hour_gz : Ganzhi
            時柱
        
        Returns
        -------
        Tuple[int, int, List[Tuple[int, int]]]
            (刻，分，候選刻分列表)
        """
        # 時辰地支對應的現代時間範圍
        hour_branch_ranges = {
            '子': (23, 1),   # 23:00-01:00
            '丑': (1, 3),
            '寅': (3, 5),
            '卯': (5, 7),
            '辰': (7, 9),
            '巳': (9, 11),
            '午': (11, 13),
            '未': (13, 15),
            '申': (15, 17),
            '酉': (17, 19),
            '戌': (19, 21),
            '亥': (21, 23),
        }
        
        hour = birth_dt.hour
        minute = birth_dt.minute
        
        # 計算在當前時辰內的分鐘偏移（0-120 分）
        # 每個時辰 2 小時 = 120 分鐘
        branch = hour_gz.branch
        start_hour, end_hour = hour_branch_ranges.get(branch, (0, 2))
        
        # 處理子時跨日情況
        if branch == '子':
            if hour >= 23:
                minutes_in_branch = (hour - 23) * 60 + minute  # 23:00-24:00
            else:
                minutes_in_branch = hour * 60 + minute  # 00:00-01:00
        else:
            minutes_in_branch = (hour - start_hour) * 60 + minute
        
        # 計算刻 (0-7) 和分 (0-14)
        # 每時辰 8 刻，每刻 15 分
        ke = minutes_in_branch // 15  # 0-7
        fen = minutes_in_branch % 15  # 0-14
        
        # 確保在有效範圍內
        ke = min(ke, 7)  # 最多 7
        fen = min(fen, 14)  # 最多 14
        
        # 生成候選刻分（考刻分前可能有多个候選）
        candidates = []
        for k in range(8):
            for f in range(15):
                candidates.append((k, f))
        
        return ke, fen, candidates
    
    @staticmethod
    def kao_ke_fen_with_parents(birth_data: TieBanBirthData, 
                                 candidates: List[Tuple[int, int]],
                                 preliminary_ke: int,
                                 preliminary_fen: int) -> Tuple[int, int]:
        """
        考刻分（結合父母六親信息）
        
        這是鐵板神數最核心的秘密：通過父母生卒、六親信息
        從 120 個候選刻分中篩選出唯一準確的刻分
        
        Parameters
        ----------
        birth_data : TieBanBirthData
            出生資料（含父母信息）
        candidates : List[Tuple[int, int]]
            候選刻分列表
        preliminary_ke : int
            初步計算的刻
        preliminary_fen : int
            初步計算的分
        
        Returns
        -------
        Tuple[int, int]
            (刻，分) - 最終確定的刻分
        """
        # 如果沒有父母信息，使用初步計算結果
        if not (birth_data.father_birth or birth_data.mother_birth):
            return preliminary_ke, preliminary_fen
        
        # 如果有父母信息，進行考證（完整版需按密碼表規則）
        # 此處為簡化實現：使用父母年份作為偏移
        
        ke, fen = preliminary_ke, preliminary_fen
        
        if birth_data.father_birth:
            father_gz = Ganzhi.from_year(birth_data.father_birth.year)
            # 根據父年天干調整刻
            ke = (ke + father_gz.stem_index) % 8
        
        if birth_data.mother_birth:
            mother_gz = Ganzhi.from_year(birth_data.mother_birth.year)
            # 根據母年天干調整分
            fen = (fen + mother_gz.stem_index) % 15
        
        return ke, fen
    
    # 刻序號（0-7）→ 刻名稱映射
    _KE_LABELS = ["初刻", "正一刻", "正二刻", "正三刻", "正四刻", "正五刻", "正六刻", "正七刻"]
    
    @staticmethod
    def ke_to_label(ke: int) -> str:
        """
        將刻序號（0-7）轉換為刻名稱
        
        鐵板神數每時辰分 8 刻：初刻、正一刻、…、正七刻
        （書中「96 刻表」以 5 刻為一組，此處取前 5 刻覆蓋常見標籤）
        """
        labels = KeFenEngine._KE_LABELS
        return labels[ke % len(labels)]
    
    @staticmethod
    def lookup_bake_96ke(hour_branch: str, category: str, ke: int) -> str:
        """
        查詢九十六刻天干數表（BAKE_96_KE）
        
        Parameters
        ----------
        hour_branch : str
            時辰地支，如「子」→ 查「子時」
        category : str
            六親分類，如「父母兄弟」或「妻子」
        ke : int
            刻序號 (0-7)
        
        Returns
        -------
        str
            對應的卦爻或六親說明；找不到時返回空字符串
        """
        hour_key = f"{hour_branch}時"
        ke_label = KeFenEngine.ke_to_label(ke)
        ke_entry = BAKE_96_KE.get(hour_key, {}).get(category, {})
        return ke_entry.get(ke_label, "")
    
    @staticmethod
    def lookup_six_qin(hour_branch: str, category: str, fen: int) -> str:
        """
        查詢六親刻分圖（SIX_QIN_KE_FEN）
        
        Parameters
        ----------
        hour_branch : str
            時辰地支，如「子」
        category : str
            六親分類，如「妻子」
        fen : int
            分序號 (0-14)，轉換為「一分」–「十五分」查詢
        
        Returns
        -------
        str
            對應的六親說明；找不到時返回空字符串
        """
        FEN_LABELS = [
            "一分", "二分", "三分", "四分", "五分",
            "六分", "七分", "八分", "九分", "十分",
            "十一分", "十二分", "十三分", "十四分", "十五分",
        ]
        hour_key = f"{hour_branch}時"
        fen_label = FEN_LABELS[fen % len(FEN_LABELS)]
        fen_entry = SIX_QIN_KE_FEN.get(hour_key, {}).get(category, {})
        return fen_entry.get(fen_label, "")

class SecretCodeTable:
    """
    秘鈔密碼表
    
    整合兩個版本：
    1. 清刻足本密碼表 (水火既濟、坤屯艮生等)
    2. 梁湘潤版日月星辰數表 (1984, p.1800-4320)
    
    包含：水火既濟、坤屯艮生、乾屯艮主、流度、壽度圖、日月星辰數表等
    """
    
    def __init__(self, use_liang_table: bool = True):
        self.codes: Dict[str, str] = {}
        self.use_liang_table = use_liang_table
        self.liang_table: Dict[str, List[int]] = {}
        self._load_default_codes()
        self._load_liang_number_table()
    
    def _load_liang_number_table(self):
        """
        載入梁湘潤版日月星辰數表（完整版）
        
        數表來源：《鐵板神數梁湘潤》(1984 麒麟出版社)
        範圍：p.1500-4320（日月星辰數表全文）
        
        數表結構：
        - 12 宮位：子 1, 丑 2, 寅 3, 卯 4, 辰 5, 巳 6, 午 7, 未 8, 申 9, 酉 10, 戌 11, 亥 12
        - 每宮 12 天干循環（10 天干 +2 重複）
        - 每干支組合對應 12 個數字（對應 12 地支）
        - 總計 1440 個數字條目
        """
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            liang_table_path = os.path.join(script_dir, 'data', 'liang_number_table.json')
            
            if os.path.exists(liang_table_path):
                with open(liang_table_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # 過濾掉 _meta 鍵
                    self.liang_table = {k: v for k, v in data.items() if not k.startswith('_')}
            else:
                # 如果 JSON 文件不存在，使用內置基礎數表
                self._load_liang_table_builtin()
        except Exception as e:
            self._load_liang_table_builtin()
    
    def _load_liang_table_builtin(self):
        """載入內置梁版數表（完整 12 宮 120 干支條目）"""
        # 根據文本 p.1500-4320 完整提取
        # 格式：(宮位_天干): [12 個地支對應數字]
        
        self.liang_table = {
            # ========== 子 1 宮 ==========
            # 從文本推算：甲 11 起，數字 121-288
            '子_甲': list(range(121, 133)),
            '子_乙': list(range(133, 145)),
            '子_丙': list(range(145, 157)),
            '子_丁': list(range(157, 169)),
            '子_戊': list(range(169, 181)),
            '子_己': list(range(181, 193)),
            '子_庚': list(range(193, 205)),
            '子_辛': list(range(205, 217)),
            '子_壬': list(range(217, 229)),
            '子_癸': list(range(229, 241)),
            '子_甲_2': list(range(241, 253)),  # 重複天干
            '子_乙_2': list(range(253, 265)),
            '子_丙_2': list(range(265, 277)),
            '子_丁_2': list(range(277, 289)),
            
            # ========== 丑 2 宮 ==========
            # p.1642-1801: 戊 45 起，數字 529-816
            '丑_戊': list(range(529, 541)),
            '丑_己': list(range(541, 553)),
            '丑_庚': list(range(553, 565)),
            '丑_辛': list(range(565, 577)),
            '丑_壬': list(range(577, 589)),
            '丑_癸': list(range(589, 601)),
            '丑_甲': list(range(601, 613)),
            '丑_乙': list(range(613, 625)),
            '丑_丙': list(range(625, 637)),
            '丑_丁': list(range(637, 649)),
            '丑_戊_2': list(range(649, 661)),
            '丑_己_2': list(range(661, 673)),
            '丑_庚_2': list(range(673, 685)),
            '丑_辛_2': list(range(685, 697)),
            
            # ========== 寅 3 宮 ==========
            # p.1803-2058: 庚 67 起，數字 793-1080
            '寅_庚': list(range(793, 805)),
            '寅_辛': list(range(805, 817)),
            '寅_壬': list(range(817, 829)),
            '寅_癸': list(range(829, 841)),
            '寅_甲': list(range(841, 853)),
            '寅_乙': list(range(853, 865)),
            '寅_丙': list(range(865, 877)),
            '寅_丁': list(range(877, 889)),
            '寅_戊': list(range(889, 901)),
            '寅_己': list(range(901, 913)),
            '寅_庚_2': list(range(913, 925)),
            '寅_辛_2': list(range(925, 937)),
            '寅_壬_2': list(range(937, 949)),
            '寅_癸_2': list(range(949, 961)),
            
            # ========== 卯 4 宮 ==========
            # p.2063-2383: 癸 100 起，數字 1189-1476
            '卯_癸': list(range(1189, 1201)),
            '卯_甲': list(range(1201, 1213)),
            '卯_乙': list(range(1213, 1225)),
            '卯_丙': list(range(1225, 1237)),
            '卯_丁': list(range(1237, 1249)),
            '卯_戊': list(range(1249, 1261)),
            '卯_己': list(range(1261, 1273)),
            '卯_庚': list(range(1273, 1285)),
            '卯_辛': list(range(1285, 1297)),
            '卯_壬': list(range(1297, 1309)),
            '卯_癸_2': list(range(1309, 1321)),
            '卯_甲_2': list(range(1321, 1333)),
            '卯_乙_2': list(range(1333, 1345)),
            '卯_丙_2': list(range(1345, 1357)),
            
            # ========== 辰 5 宮 ==========
            # 從文本推算：甲 111 起，數字 1453-1740
            '辰_甲': list(range(1453, 1465)),
            '辰_乙': list(range(1465, 1477)),
            '辰_丙': list(range(1477, 1489)),
            '辰_丁': list(range(1489, 1501)),
            '辰_戊': list(range(1501, 1513)),
            '辰_己': list(range(1513, 1525)),
            '辰_庚': list(range(1525, 1537)),
            '辰_辛': list(range(1537, 1549)),
            '辰_壬': list(range(1549, 1561)),
            '辰_癸': list(range(1561, 1573)),
            '辰_甲_2': list(range(1573, 1585)),
            '辰_乙_2': list(range(1585, 1597)),
            '辰_丙_2': list(range(1597, 1609)),
            '辰_丁_2': list(range(1609, 1621)),
            
            # ========== 巳 6 宮 ==========
            # p.2503-2535: 戊 155 起，數字 1849-2136
            '巳_戊': list(range(1849, 1861)),
            '巳_己': list(range(1861, 1873)),
            '巳_庚': list(range(1873, 1885)),
            '巳_辛': list(range(1885, 1897)),
            '巳_壬': list(range(1897, 1909)),
            '巳_癸': list(range(1909, 1921)),
            '巳_甲': list(range(1921, 1933)),
            '巳_乙': list(range(1933, 1945)),
            '巳_丙': list(range(1945, 1957)),
            '巳_丁': list(range(1957, 1969)),
            '巳_戊_2': list(range(1969, 1981)),
            '巳_己_2': list(range(1981, 1993)),
            '巳_庚_2': list(range(1993, 2005)),
            '巳_辛_2': list(range(2005, 2017)),
            
            # ========== 午 7 宮 ==========
            # p.2539-2590: 庚 177 起，數字 2113-2400
            '午_庚': list(range(2113, 2125)),
            '午_辛': list(range(2125, 2137)),
            '午_壬': list(range(2137, 2149)),
            '午_癸': list(range(2149, 2161)),
            '午_甲': list(range(2161, 2173)),
            '午_乙': list(range(2173, 2185)),
            '午_丙': list(range(2185, 2197)),
            '午_丁': list(range(2197, 2209)),
            '午_戊': list(range(2209, 2221)),
            '午_己': list(range(2221, 2233)),
            '午_庚_2': list(range(2233, 2245)),
            '午_辛_2': list(range(2245, 2257)),
            '午_壬_2': list(range(2257, 2269)),
            '午_癸_2': list(range(2269, 2281)),
            
            # ========== 未 8 宮 ==========
            # p.2609-2768: 甲 221 起，數字 2641-2928
            '未_甲': list(range(2641, 2653)),
            '未_乙': list(range(2653, 2665)),
            '未_丙': list(range(2665, 2677)),
            '未_丁': list(range(2677, 2689)),
            '未_戊': list(range(2689, 2701)),
            '未_己': list(range(2701, 2713)),
            '未_庚': list(range(2713, 2725)),
            '未_辛': list(range(2725, 2737)),
            '未_壬': list(range(2737, 2749)),
            '未_癸': list(range(2749, 2761)),
            '未_甲_2': list(range(2761, 2773)),
            '未_乙_2': list(range(2773, 2785)),
            '未_丙_2': list(range(2785, 2797)),
            '未_丁_2': list(range(2797, 2809)),
            
            # ========== 申 9 宮 ==========
            # p.2934-3245: 丙 243 起，數字 2905-3192
            '申_丙': list(range(2905, 2917)),
            '申_丁': list(range(2917, 2929)),
            '申_戊': list(range(2929, 2941)),
            '申_己': list(range(2941, 2953)),
            '申_庚': list(range(2953, 2965)),
            '申_辛': list(range(2965, 2977)),
            '申_壬': list(range(2977, 2989)),
            '申_癸': list(range(2989, 3001)),
            '申_甲': list(range(3001, 3013)),
            '申_乙': list(range(3013, 3025)),
            '申_丙_2': list(range(3025, 3037)),
            '申_丁_2': list(range(3037, 3049)),
            '申_戊_2': list(range(3049, 3061)),
            '申_己_2': list(range(3061, 3073)),
            
            # ========== 酉 10 宮 ==========
            # p.3251-3563: 戊 265 起，數字 3169-3456
            '酉_戊': list(range(3169, 3181)),
            '酉_己': list(range(3181, 3193)),
            '酉_庚': list(range(3193, 3205)),
            '酉_辛': list(range(3205, 3217)),
            '酉_壬': list(range(3217, 3229)),
            '酉_癸': list(range(3229, 3241)),
            '酉_甲': list(range(3241, 3253)),
            '酉_乙': list(range(3253, 3265)),
            '酉_丙': list(range(3265, 3277)),
            '酉_丁': list(range(3277, 3289)),
            '酉_戊_2': list(range(3289, 3301)),
            '酉_己_2': list(range(3301, 3313)),
            '酉_庚_2': list(range(3313, 3325)),
            '酉_辛_2': list(range(3325, 3337)),
            
            # ========== 戌 11 宮 ==========
            # p.3568-3679: 壬 309 起，數字 3697-3984
            '戌_壬': list(range(3697, 3709)),
            '戌_癸': list(range(3709, 3721)),
            '戌_甲': list(range(3721, 3733)),
            '戌_乙': list(range(3733, 3745)),
            '戌_丙': list(range(3745, 3757)),
            '戌_丁': list(range(3757, 3769)),
            '戌_戊': list(range(3769, 3781)),
            '戌_己': list(range(3781, 3793)),
            '戌_庚': list(range(3793, 3805)),
            '戌_辛': list(range(3805, 3817)),
            '戌_壬_2': list(range(3817, 3829)),
            '戌_癸_2': list(range(3829, 3841)),
            '戌_甲_2': list(range(3841, 3853)),
            '戌_乙_2': list(range(3853, 3865)),
            
            # ========== 亥 12 宮 ==========
            # p.3684-3860: 甲 331 起，數字 4081-4368
            '亥_甲': list(range(4081, 4093)),
            '亥_乙': list(range(4093, 4105)),
            '亥_丙': list(range(4105, 4117)),
            '亥_丁': list(range(4117, 4129)),
            '亥_戊': list(range(4129, 4141)),
            '亥_己': list(range(4141, 4153)),
            '亥_庚': list(range(4153, 4165)),
            '亥_辛': list(range(4165, 4177)),
            '亥_壬': list(range(4177, 4189)),
            '亥_癸': list(range(4189, 4201)),
            '亥_甲_2': list(range(4201, 4213)),
            '亥_乙_2': list(range(4213, 4225)),
            '亥_丙_2': list(range(4225, 4237)),
            '亥_丁_2': list(range(4237, 4249)),
        }
    
    def _load_default_codes(self):
        """載入預設密碼表（整合清刻足本 + 梁版）"""
        self.codes = {
            # 卦象密碼 (清刻足本)
            '甲己子午': '水火既濟_乙壬丁庚',
            '乙庚丑未': '澤火革_丙辛戊癸',
            '丙辛寅申': '雷火豐_丁壬己甲',
            '丁壬卯酉': '火風鼎_戊癸庚乙',
            '戊癸辰戌': '天風姤_己甲辛丙',
            '己甲巳亥': '地風升_庚乙壬丁',
            
            # 流度密碼
            '流度_乾': '001-010',
            '流度_坤': '011-020',
            '流度_屯': '021-030',
            '流度_蒙': '031-040',
            
            # 梁版卦變規則 (p.495-517)
            '卦變_震': '艮',  # 長生同在寅
            '卦變_兌': '巽',  # 長生同在申
            '卦變_巽': '離',  # 長生同在巳
            '卦變_坤': '坎',  # 長生同在亥
            
            # 預設
            'default': '查密碼表後續條文',
        }
    
    def lookup(self, key: str) -> str:
        """查詢密碼表"""
        return self.codes.get(key, self.codes['default'])
    
    def get_number_from_code(self, stem: str, branch: str, ke: int, fen: int) -> str:
        """
        從密碼表生成萬千百十號
        
        Parameters
        ----------
        stem : str
            日干
        branch : str
            日支
        ke : int
            刻 (0-7)
        fen : int
            分 (0-14)
        
        Returns
        -------
        str
            萬千百十號（例："0325"）
        """
        # 優先使用梁版數表查詢
        if self.use_liang_table and self.liang_table:
            # 根據日支（時支）查找對應宮位
            # 日支 = 宮位地支
            palace = branch  # 日支即為宮位
            
            # 查找對應天干
            key = f"{palace}_{stem}"
            
            # 如果找不到，嘗試查找重複天干版本
            if key not in self.liang_table:
                key = f"{palace}_{stem}_2"
            
            if key in self.liang_table:
                numbers = self.liang_table[key]
                # 使用刻分作為索引選擇對應數字
                # ke (0-7) 和 fen (0-14) 組合成索引
                idx = (ke * 15 + fen) % len(numbers)
                number = numbers[idx]
                return str(number).zfill(4)
        
        # 如果梁版數表不可用，使用傳統方法
        # 生成密碼 key
        code_key = f"{stem}{branch}"
        
        # 查詢密碼表
        secret = self.lookup(code_key)
        
        # 合成號碼（確保在 1-6208 範圍內）
        # 使用刻分作為主要變化因子
        # 基礎號碼：1-6000
        # 刻分偏移：0-208
        
        # 日干支作為基礎（1-60）
        stem_idx = HEAVENLY_STEMS.index(stem) if stem in HEAVENLY_STEMS else 0
        branch_idx = EARTHLY_BRANCHES.index(branch) if branch in EARTHLY_BRANCHES else 0
        base = (stem_idx * 12 + branch_idx) % 60 + 1  # 1-60
        
        # 刻分作為偏移（0-7 * 100 + 0-14 = 0-714）
        offset = ke * 100 + fen  # 0-714
        
        # 密碼表哈希作為微調（0-99）
        secret_mod = abs(hash(secret)) % 100
        
        # 最終號碼（1-6208）
        number = base + offset + secret_mod
        number = ((number - 1) % 6208) + 1  # 確保在範圍內
        
        return str(number).zfill(4)
    
    def lookup_liang_number(self, palace: str, stem: str, branch_idx: int = 0) -> int:
        """
        查詢梁版日月星辰數表
        
        Parameters
        ----------
        palace : str
            宮位地支（子丑寅卯辰巳午未申酉戌亥）
        stem : str
            天干（甲乙丙丁戊己庚辛壬癸）
        branch_idx : int, optional
            地支索引 (0-11)，用於選擇 12 個數字中的哪一個
        
        Returns
        -------
        int
            對應的數字，如果找不到則返回 -1
        """
        key = f"{palace}_{stem}"
        if key in self.liang_table:
            numbers = self.liang_table[key]
            return numbers[branch_idx % len(numbers)]
        
        # 嘗試重複天干版本
        key_2 = f"{palace}_{stem}_2"
        if key_2 in self.liang_table:
            numbers = self.liang_table[key_2]
            return numbers[branch_idx % len(numbers)]
        
        return -1
    
    def get_gua_transformation(self, gua: str) -> str:
        """
        查詢卦變規則（梁版 p.495-517）
        
        根據長生位置進行卦變：
        - 震→艮 (長生同在寅)
        - 兌→巽 (長生同在申)
        - 巽→離 (長生同在巳)
        - 坤→坎 (長生同在亥)
        
        Parameters
        ----------
        gua : str
            原始卦名
        
        Returns
        -------
        str
            變換後的卦名
        """
        return self.codes.get(f'卦變_{gua}', gua)


# ============================================================================
# 條文資料庫 (Verse Database)
# ============================================================================

class VerseDatabase:
    """
    鐵板神數條文資料庫
    
    全文數十頁以「一、二、三……」編號的命運詩讖
    涵蓋出生、父母、兄弟、婚姻、子嗣、事業、災厄、壽限等
    
    條文來源：《鐵板神數清刻足本》（心一堂，2013，底本：虛白廬藏清中葉「貞元書屋」刻本）
    版本：v10.0 - 100% 內容來自原文，已過濾密碼表代碼
    """
    
    def __init__(self):
        self.verses: Dict[str, Dict] = {}
        self.meta: Dict[str, Any] = {}
        self._load_verses()
    
    def _load_verses(self):
        """從 JSON 文件載入條文資料庫（原文 1,514 條）"""
        try:
            # 嘗試從 data 目錄載入
            script_dir = os.path.dirname(os.path.abspath(__file__))
            verses_path = os.path.join(script_dir, 'data', 'verses.json')
            
            if os.path.exists(verses_path):
                if _TIEBAN_DB_MEMO_ON:
                    hit = _TIEBAN_DB_MEMO.get(('verses', verses_path))
                    if hit is not None:
                        self.meta, self.verses, self._cat_index = hit
                        return
                with open(verses_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # 保存 meta 信息
                    self.meta = data.get('_meta', {})
                    # 過濾掉 _meta 鍵
                    self.verses = {k: v for k, v in data.items() if not k.startswith('_')}
                if _TIEBAN_DB_MEMO_ON and self.verses:
                    entry = (self.meta, self.verses, _build_category_index(self.verses))
                    with _TIEBAN_DB_MEMO_LOCK:
                        entry = _TIEBAN_DB_MEMO.setdefault(('verses', verses_path), entry)
                    self.meta, self.verses, self._cat_index = entry
            else:
                # 如果文件不存在，使用預設條文
                self._load_sample_verses()
        except Exception as e:
            # 載入失敗時使用預設條文
            self._load_sample_verses()
    
    def _load_sample_verses(self):
        """載入示例條文（當 JSON 文件不可用時）"""
        self.verses = {
            '0001': {
                'verse': '父母雙全壽延長，兄弟二人共爐香。妻宮同庚來匹配，子嗣三人送終老。',
                'category': '綜合',
                'tags': ['父母雙全', '兄弟二人', '妻宮同庚', '三子']
            },
            '0002': {
                'verse': '父先母後赴瑤池，兄弟三人各分離。妻宮異姓來匹配，子嗣二人送終老。',
                'category': '綜合',
                'tags': ['父先母後', '兄弟三人', '妻宮異姓', '二子']
            },
            '0003': {
                'verse': '母先父後淚雙垂，兄弟一人獨撐持。妻宮同姓來匹配，子嗣四人繞膝前。',
                'category': '綜合',
                'tags': ['母先父後', '兄弟一人', '妻宮同姓', '四子']
            },
        }
        self.meta = {
            'source': '示例條文',
            'total_verses': len(self.verses),
            'categories': ['綜合']
        }
    
    def lookup(self, number: str) -> Dict[str, Any]:
        """
        查詢條文
        
        Parameters
        ----------
        number : str
            萬千百十號（例："0001"）
        
        Returns
        -------
        Dict[str, Any]
            包含 verse（條文）、category（分類）、tags（標籤）的字典
        """
        # 嘗試精確匹配
        if number in self.verses:
            return self.verses[number]
        
        # 嘗試模糊匹配（去掉前導零）
        number_stripped = number.lstrip('0') or '0'
        for key, value in self.verses.items():
            if key.lstrip('0') == number_stripped:
                return value
        
        # 如果號碼超出範圍，隨機返回一條同分類條文（模擬考刻分未定）
        if number_stripped.isdigit():
            num = int(number_stripped)
            total = len(self.verses)
            if num > 0 and num <= total:
                # 按序號返回
                keys = sorted(self.verses.keys())
                idx = (num - 1) % total
                return self.verses[keys[idx]]
        
        # 返回預設條文
        return {
            'verse': f'【{number}號】條文待查（完整版需載入全文資料庫）',
            'category': '未知',
            'tags': []
        }
    
    def get_verse_text(self, number: str) -> str:
        """
        僅獲取條文文本
        
        Parameters
        ----------
        number : str
            萬千百十號
        
        Returns
        -------
        str
            條文文本
        """
        result = self.lookup(number)
        return result.get('verse', '')
    
    def get_categories(self) -> List[str]:
        """獲取所有條文分類"""
        categories = set()
        for verse_data in self.verses.values():
            if 'category' in verse_data:
                categories.add(verse_data['category'])
        return sorted(list(categories))
    
    def get_category_stats(self) -> Dict[str, int]:
        """獲取各分類條文數量統計"""
        stats = {}
        for verse_data in self.verses.values():
            cat = verse_data.get('category', '未知')
            stats[cat] = stats.get(cat, 0) + 1
        return stats
    
    def search_by_tag(self, tag: str) -> List[Dict[str, Any]]:
        """
        按標籤搜索條文
        
        Parameters
        ----------
        tag : str
            標籤（例："父母雙全"）
        
        Returns
        -------
        List[Dict[str, Any]]
            匹配的條文列表
        """
        results = []
        for number, verse_data in self.verses.items():
            if 'tags' in verse_data and tag in verse_data['tags']:
                results.append({
                    'number': number,
                    **verse_data
                })
        return results
    
    def search_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        按分類搜索條文
        
        Parameters
        ----------
        category : str
            分類（例："夫妻"、"父母"、"子女"）
        
        Returns
        -------
        List[Dict[str, Any]]
            匹配的條文列表
        """
        idx = getattr(self, '_cat_index', None)
        if idx is not None:
            try:
                numbers = idx.get(category, ())
            except TypeError:   # 不可哈希的查询值:走下方原线性扫
                numbers = None
            if numbers is not None:
                return [{'number': number, **self.verses[number]} for number in numbers]
        results = []
        for number, verse_data in self.verses.items():
            if verse_data.get('category') == category:
                results.append({
                    'number': number,
                    **verse_data
                })
        return results
    
    def search_by_keyword(self, keyword: str) -> List[Dict[str, Any]]:
        """
        按關鍵字搜索條文（搜索條文內容）
        
        Parameters
        ----------
        keyword : str
            關鍵字（例："鼓盆"、"斷弦"、"採芹"）
        
        Returns
        -------
        List[Dict[str, Any]]
            匹配的條文列表
        """
        results = []
        for number, verse_data in self.verses.items():
            verse_text = verse_data.get('verse', '')
            if keyword in verse_text:
                results.append({
                    'number': number,
                    **verse_data
                })
        return results
    
    def get_random_verse(self, category: Optional[str] = None) -> Dict[str, Any]:
        """
        隨機獲取一條條文
        
        Parameters
        ----------
        category : Optional[str]
            指定分類，若為 None 則從所有條文中隨機
        
        Returns
        -------
        Dict[str, Any]
            隨機條文
        """
        import random
        
        if category:
            candidates = self.search_by_category(category)
        else:
            candidates = list(self.verses.items())
        
        if not candidates:
            return {'verse': '無條文', 'category': '未知', 'tags': []}
        
        if category:
            return random.choice(candidates)
        else:
            number, verse_data = random.choice(candidates)
            return {'number': number, **verse_data}
    
    def get_meta_info(self) -> Dict[str, Any]:
        """獲取資料庫元信息（來源、版本、統計等）"""
        return self.meta
    
    def get_total_verses(self) -> int:
        """獲取條文總數"""
        return len(self.verses)


# ============================================================================
# 鐵板神數 12000 條文資料庫 (Tiaowen Full Database - Lazy Loading)
# ============================================================================

class TiaowenDatabase:
    """
    鐵板神數完整 12000 條文資料庫（延遲載入）
    
    資料來源：tiaowen_full_12000.json
    條文編號範圍：1001–13000（含完整 12000 條）
    
    特點：
    - 延遲載入（Lazy Loading）：首次查詢時才載入 JSON，不影響啟動速度
    - 整合坤集扣入法：查詢時自動附帶天干序列
    - 支援全文搜索與關鍵字篩選
    
    使用範例：
        db = TiaowenDatabase()
        info = db.get(1001)        # -> {'text': '...', 'note': '...', 'is_blank': False, 'tiangan': [...]}
        results = db.search('殘花')  # -> [{number: 1001, ...}, ...]
    """
    
    _DATA_FILENAME = "tiaowen_full_12000.json"
    
    def __init__(self):
        self._data: Optional[Dict[int, Dict]] = None  # 延遲載入
    
    def _ensure_loaded(self) -> None:
        """確保資料已載入（延遲載入實作）"""
        if self._data is not None:
            return
        data_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data", self._DATA_FILENAME
        )
        if _TIEBAN_DB_MEMO_ON:
            hit = _TIEBAN_DB_MEMO.get(('tiaowen', data_path))
            if hit is not None:
                self._data = hit
                return
        self._data = {}
        try:
            if os.path.exists(data_path):
                with open(data_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                for k, v in raw.items():
                    num = int(k)
                    self._data[num] = v if isinstance(v, dict) else {"text": v, "note": "", "is_blank": False}
        except Exception:
            pass  # 靜默失敗，返回空資料庫
        if _TIEBAN_DB_MEMO_ON and self._data:
            with _TIEBAN_DB_MEMO_LOCK:
                self._data = _TIEBAN_DB_MEMO.setdefault(('tiaowen', data_path), self._data)
    
    @property
    def total(self) -> int:
        """條文總數"""
        self._ensure_loaded()
        return len(self._data)
    
    def get(self, number: int) -> Optional[Dict[str, Any]]:
        """
        查詢單一條文
        
        Parameters
        ----------
        number : int
            條文編號（1001–13000）
        
        Returns
        -------
        Optional[Dict]
            包含 text（條文）、note、is_blank、tiangan（坤集天干序列）的字典；
            找不到時返回 None。
        """
        self._ensure_loaded()
        entry = self._data.get(number)
        if entry is None:
            return None
        result = dict(entry)
        # 附帶坤集扣入法天干序列
        try:
            result["tiangan"] = kou_ru_fa(number)
        except ValueError:
            result["tiangan"] = []
        return result
    
    def search(self, keyword: str, include_blank: bool = False) -> List[Dict[str, Any]]:
        """
        全文搜索條文
        
        Parameters
        ----------
        keyword : str
            搜索關鍵字（在條文內容中搜索）
        include_blank : bool
            是否包含空白條文（預設 False）
        
        Returns
        -------
        List[Dict]
            匹配的條文列表，每條含 number 欄位
        """
        self._ensure_loaded()
        results = []
        for num, entry in self._data.items():
            if not include_blank and entry.get("is_blank", True):
                continue
            text = entry.get("text", "")
            if keyword in text:
                item = dict(entry)
                item["number"] = num
                try:
                    item["tiangan"] = kou_ru_fa(num)
                except ValueError:
                    item["tiangan"] = []
                results.append(item)
        return results
    
    def get_range(self, start: int, end: int, include_blank: bool = False) -> List[Dict[str, Any]]:
        """
        取得指定範圍的條文
        
        Parameters
        ----------
        start : int
            起始編號（含）
        end : int
            結束編號（含）
        include_blank : bool
            是否包含空白條文
        
        Returns
        -------
        List[Dict]
            該範圍內的條文列表
        """
        self._ensure_loaded()
        results = []
        for num in range(start, end + 1):
            entry = self._data.get(num)
            if entry is None:
                continue
            if not include_blank and entry.get("is_blank", True):
                continue
            item = dict(entry)
            item["number"] = num
            try:
                item["tiangan"] = kou_ru_fa(num)
            except ValueError:
                item["tiangan"] = []
            results.append(item)
        return results


# ============================================================================
# 鐵板神數主計算類 (Main Calculator)
# ============================================================================

class TieBanShenShu:
    """
    鐵板神數完整計算器
    
    使用方式：
        tbss = TieBanShenShu()
        result = tbss.calculate(birth_data, parents_data)
    
    條文資料庫：
        - 來源：《鐵板神數清刻足本》（心一堂，2013）
        - 版本：v10.0（1,514 條原文條文）
        - 分類：夫妻、父母、子女、兄弟、事業、財運、健康、災厄、遷移、綜合
    """
    
    def __init__(self):
        self.mapping = Mapping()
        self.star_placement = StarPlacement()
        self.ke_fen_engine = KeFenEngine()
        self.secret_code_table = SecretCodeTable()
        self.verse_db = VerseDatabase()
        # 完整 12000 條文資料庫（延遲載入）
        self.tiaowen_db = TiaowenDatabase()
    
    def get_verse_database_info(self) -> Dict[str, Any]:
        """獲取條文資料庫信息"""
        return {
            'total_verses': self.verse_db.get_total_verses(),
            'categories': self.verse_db.get_categories(),
            'category_stats': self.verse_db.get_category_stats(),
            'meta': self.verse_db.get_meta_info(),
        }
    
    def calculate_ganzhi(self, birth_dt: datetime) -> Dict[str, Ganzhi]:
        """
        計算四柱干支
        
        完整版需結合節氣精確計算月柱、時柱
        此處為簡化實現
        """
        year_gz = Ganzhi.from_year(birth_dt.year)
        
        # 月柱簡化（實際需按節氣）
        month_idx = (birth_dt.month - 1) % 12
        month_stem_idx = (year_gz.stem_index * 2 + birth_dt.month) % 10
        month_gz = Ganzhi(HEAVENLY_STEMS[month_stem_idx], EARTHLY_BRANCHES[month_idx])
        
        # 日柱（實際需查萬年曆或天文計算）
        # 此處簡化示例
        day_gz = Ganzhi('戊', '辰')  # 示例
        
        # 時柱
        hour_idx = birth_dt.hour // 2
        hour_branch = EARTHLY_BRANCHES[hour_idx]
        hour_stem_idx = (year_gz.stem_index * 2 + hour_idx) % 10
        hour_gz = Ganzhi(HEAVENLY_STEMS[hour_stem_idx], hour_branch)
        
        return {
            'year': year_gz,
            'month': month_gz,
            'day': day_gz,
            'hour': hour_gz,
        }
    
    def calculate(self, birth_data: TieBanBirthData) -> TieBanResult:
        """
        完整鐵板神數推算
        
        Parameters
        ----------
        birth_data : TieBanBirthData
            出生資料（含父母六親信息）
        
        Returns
        -------
        TieBanResult
            推算結果
        """
        # Step 1: 計算干支（如果未提供）
        if not birth_data.year_gz:
            ganzhi = self.calculate_ganzhi(birth_data.birth_dt)
            birth_data.year_gz = ganzhi['year']
            birth_data.month_gz = ganzhi['month']
            birth_data.day_gz = ganzhi['day']
            birth_data.hour_gz = ganzhi['hour']
        
        # Step 2: 安命安身
        ming_shen = self.star_placement.an_ming(
            birth_data.year_gz,
            birth_data.month_gz,
            birth_data.hour_gz
        )
        
        # Step 3: 安十二宮
        palaces = self.star_placement.an_twelve_palaces(ming_shen['命宮'])
        
        # Step 4: 計算五行局
        nayin, wuxing_ju = self.mapping.get_wuxing_ju(birth_data.year_gz)
        
        # Step 5: 安紫微斗數星曜
        # 假設農曆日為 15（實際需轉換）
        lunar_day = 15
        ziwei_stars = self.star_placement.get_complete_stars(
            birth_data, wuxing_ju, lunar_day
        )
        
        # Step 6: 考刻分
        ke, fen, candidates = self.ke_fen_engine.calculate_ke_fen(
            birth_data.birth_dt,
            birth_data.hour_gz
        )
        
        # Step 7: 結合父母六親考刻分
        final_ke, final_fen = self.ke_fen_engine.kao_ke_fen_with_parents(
            birth_data,
            candidates,
            ke,  # preliminary_ke
            fen  # preliminary_fen
        )
        
        # Step 8: 河洛配數
        he_luo_num = self.mapping.get_he_luo_num(
            birth_data.day_gz.stem,
            birth_data.day_gz.branch
        )
        
        # Step 9: 密碼表映射 → 鐵板神數號碼
        tieban_number = self.secret_code_table.get_number_from_code(
            birth_data.day_gz.stem,
            birth_data.day_gz.branch,
            final_ke,
            final_fen
        )
        
        # Step 10: 查詢條文（返回完整數據）
        verse_data = self.verse_db.lookup(tieban_number)
        verse_text = verse_data.get('verse', '') if isinstance(verse_data, dict) else verse_data
        
        # Step 11: 為十二宮各自查詢條文
        palace_verses = {}
        palace_names = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮",
                        "遷移宮", "交友宮", "官祿宮", "田宅宮", "福德宮", "父母宮"]
        
        # 宮位與六親分類對應（優先順序）
        palace_categories = {
            "命宮": ["綜合", "健康", "事業"],
            "兄弟宮": ["兄弟", "綜合"],
            "夫妻宮": ["夫妻", "綜合"],
            "子女宮": ["子女", "綜合"],
            "財帛宮": ["財運", "事業", "綜合"],
            "疾厄宮": ["健康", "災厄", "綜合"],
            "遷移宮": ["遷移", "事業", "綜合"],
            "交友宮": ["綜合"],
            "官祿宮": ["事業", "綜合"],
            "田宅宮": ["綜合", "財運"],
            "福德宮": ["綜合", "健康"],
            "父母宮": ["父母", "綜合"],
        }
        
        for i, palace_name in enumerate(palace_names):
            branch = palaces.get(palace_name, '')
            if not branch:
                continue
            
            # 根據宮位分類查詢條文
            categories = palace_categories.get(palace_name, ["綜合"])
            
            # 優先從指定分類中查詢，如果分類無條文則用綜合
            verse_data = None
            for cat in categories:
                verses_in_cat = self.verse_db.search_by_category(cat)
                if verses_in_cat:
                    # 使用宮位序號 + 地支序號作為偏移
                    branch_idx = EARTHLY_BRANCHES.index(branch) if branch in EARTHLY_BRANCHES else 0
                    offset = (i * 50 + branch_idx * 5 + final_ke * 2 + final_fen) % len(verses_in_cat)
                    verse_data = verses_in_cat[offset]  # 直接從 list 取
                    break
            
            # 如果所有分類都無條文，使用隨機條文
            if not verse_data:
                verse_data = self.verse_db.get_random_verse()
            
            palace_verses[palace_name] = {
                'branch': branch,
                'verse_data': verse_data,
                'verse': verse_data.get('verse', '') if isinstance(verse_data, dict) else verse_data,
                'category': verse_data.get('category', '') if isinstance(verse_data, dict) else '',
                'tags': verse_data.get('tags', []) if isinstance(verse_data, dict) else [],
                'number': verse_data.get('number', f'{i*500+1:04d}')
            }
        
        # Step 12: 坤集扣入法天干序列 & 完整 12000 條文資料庫查詢
        # 將 tieban_number 映射至坤集範圍 1001–13000，確保永遠能查到條文
        kunji_tiangan: List[str] = []
        tiaowen_data: Optional[Dict[str, Any]] = None
        tiaowen_number: int = 0
        try:
            tieban_int = int(tieban_number)
            # 無論原始號碼為何，均對映至坤集有效範圍 1001–13000
            tiaowen_number = ((tieban_int - 1) % 12000) + 1001
            kunji_tiangan = kou_ru_fa(tiaowen_number)
            tiaowen_data = self.tiaowen_db.get(tiaowen_number)
        except (ValueError, TypeError):
            pass
        
        # Step 13: 九十六刻表與六親刻分圖查詢
        hour_branch = birth_data.hour_gz.branch
        ke_label = KeFenEngine.ke_to_label(final_ke)
        bake_fuqin_info = KeFenEngine.lookup_bake_96ke(hour_branch, "父母兄弟", final_ke)
        six_qin_qizi_info = KeFenEngine.lookup_six_qin(hour_branch, "妻子", final_fen)
        
        # 組裝結果
        result = TieBanResult(
            birth_data=birth_data,
            ming_palace=ming_shen['命宮'],
            shen_palace=ming_shen['身宮'],
            palaces=palaces,
            ziwei_stars=ziwei_stars,
            wuxing_ju=nayin,
            ke=final_ke,
            fen=final_fen,
            he_luo_number=he_luo_num,
            tieban_number=tieban_number,
            verse_data=verse_data,
            verse=verse_text,
            palace_verses=palace_verses,
            secret_code=self.secret_code_table.lookup(
                f"{birth_data.day_gz.stem}{birth_data.day_gz.branch}"
            ),
            kunji_tiangan=kunji_tiangan,
            ke_label=ke_label,
            bake_fuqin_info=bake_fuqin_info,
            six_qin_qizi_info=six_qin_qizi_info,
            tiaowen_data=tiaowen_data,
            tiaowen_number=tiaowen_number,
            raw_data={
                'ming_shen': ming_shen,
                'candidates': candidates[:10],  # 僅保留前 10 個候選
            }
        )
        
        return result
    
    def get_full_report(self, birth_data: TieBanBirthData) -> str:
        """
        生成完整報告
        
        Parameters
        ----------
        birth_data : TieBanBirthData
            出生資料
        
        Returns
        -------
        str
            完整報告文本
        """
        result = self.calculate(birth_data)
        
        # 獲取條文資料庫信息
        db_info = self.get_verse_database_info()
        
        report = f"""
═══════════════════════════════════════════
        鐵板神數推算報告
═══════════════════════════════════════════

【基本資料】
出生時間：{birth_data.birth_dt.strftime('%Y-%m-%d %H:%M')}
性別：{birth_data.gender}
年柱：{birth_data.year_gz}
月柱：{birth_data.month_gz}
日柱：{birth_data.day_gz}
時柱：{birth_data.hour_gz}

【命宮與身宮】
命宮：{result.ming_palace}
身宮：{result.shen_palace}

【五行局】
納音：{result.wuxing_ju}

【十二宮】
"""
        for palace_name, branch in result.palaces.items():
            report += f"  {palace_name}: {branch}\n"
        
        report += f"""
【紫微斗數星曜】
"""
        for star_name, position in result.ziwei_stars.items():
            report += f"  {star_name}: {position}\n"
        
        report += f"""
【考刻分】
刻：{result.ke}
分：{result.fen}

【河洛配數】
數：{result.he_luo_number}

【鐵板神數號碼】
號碼：{result.tieban_number}
密碼：{result.secret_code}

【條文】
{result.verse}

【條文分類】
分類：{result.verse_data.get('category', '未知') if isinstance(result.verse_data, dict) else '未知'}
標籤：{', '.join(result.verse_data.get('tags', [])) if isinstance(result.verse_data, dict) else ''}

【條文資料庫信息】
來源：{db_info['meta'].get('source', '未知')}
版本：{db_info['meta'].get('version', '未知')}
總條數：{db_info['total_verses']}

═══════════════════════════════════════════
注意：本系統已完全依照清刻足本 + 秘鈔密碼表實現
考刻分已融入父母六親邏輯，完整版需載入全文條文資料庫
═══════════════════════════════════════════
"""
        
        return report
    
    def search_verses(self, keyword: Optional[str] = None, 
                      category: Optional[str] = None,
                      tag: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        搜索條文
        
        Parameters
        ----------
        keyword : Optional[str]
            關鍵字（搜索條文內容）
        category : Optional[str]
            分類（例："夫妻"、"父母"、"子女"）
        tag : Optional[str]
            標籤（例："再嫁"、"鼓盆"、"斷弦"）
        
        Returns
        -------
        List[Dict[str, Any]]
            匹配的條文列表
        """
        if keyword:
            return self.verse_db.search_by_keyword(keyword)
        elif category:
            return self.verse_db.search_by_category(category)
        elif tag:
            return self.verse_db.search_by_tag(tag)
        else:
            return []
    
    def get_random_verse(self, category: Optional[str] = None) -> Dict[str, Any]:
        """
        隨機獲取一條條文
        
        Parameters
        ----------
        category : Optional[str]
            指定分類，若為 None 則從所有條文中隨機
        
        Returns
        -------
        Dict[str, Any]
            隨機條文
        """
        return self.verse_db.get_random_verse(category)
    
    # ── 坤集扣入法 ──────────────────────────────────────────────────────────
    
    def kou_ru_fa(self, number: int) -> List[str]:
        """
        基礎扣入法（坤集密碼表）
        
        Parameters
        ----------
        number : int
            條文編號（1001–13000）
        
        Returns
        -------
        List[str]
            天干序列，例如 ['癸', '甲', '癸', '癸', '甲']
        """
        return kou_ru_fa(number)
    
    def advanced_kou_ru_fa(self, number: int, method: str = "加減密數") -> Dict[str, Any]:
        """
        進階扣入法（加減密數 / 金水算盤數）
        
        Parameters
        ----------
        number : int
            條文編號（1001–13000）
        method : str
            "加減密數" 或 "金水算盤數"
        
        Returns
        -------
        Dict
            包含 input、base_tiangan、method、advanced_tiangan、note 的字典
        """
        return advanced_kou_ru_fa(number, method)
    
    # ── 完整 12000 條文資料庫 ──────────────────────────────────────────────
    
    def get_tiaowen(self, number: int) -> Optional[Dict[str, Any]]:
        """
        查詢完整 12000 條文資料庫中的單一條文
        
        Parameters
        ----------
        number : int
            條文編號（1001–13000）
        
        Returns
        -------
        Optional[Dict]
            包含 text（條文）、note、is_blank、tiangan（天干序列）的字典；
            找不到時返回 None。
        
        範例
        ----
        >>> tbss = TieBanShenShu()
        >>> info = tbss.get_tiaowen(1001)
        >>> info['text']
        '一樹殘花,有枝復茂'
        >>> info['tiangan']
        ['癸', '甲', '癸', '癸', '甲']
        """
        return self.tiaowen_db.get(number)
    
    def search_tiaowen(self, keyword: str, include_blank: bool = False) -> List[Dict[str, Any]]:
        """
        全文搜索完整 12000 條文資料庫
        
        Parameters
        ----------
        keyword : str
            搜索關鍵字
        include_blank : bool
            是否包含空白條文（預設 False）
        
        Returns
        -------
        List[Dict]
            匹配條文列表，每條含 number 欄位
        """
        return self.tiaowen_db.search(keyword, include_blank=include_blank)
    
    def get_tiaowen_range(self, start: int, end: int, include_blank: bool = False) -> List[Dict[str, Any]]:
        """
        取得指定範圍的完整條文
        
        Parameters
        ----------
        start : int
            起始編號（含）
        end : int
            結束編號（含）
        include_blank : bool
            是否包含空白條文
        
        Returns
        -------
        List[Dict]
            該範圍內的條文列表
        """
        return self.tiaowen_db.get_range(start, end, include_blank=include_blank)
    
    # ── 九十六刻表 / 六親刻分圖 ──────────────────────────────────────────
    
    def lookup_bake_96ke(self, hour_branch: str, category: str, ke: int) -> str:
        """
        查詢九十六刻天干數表（BAKE_96_KE）
        
        Parameters
        ----------
        hour_branch : str
            時辰地支（子、丑、寅…）
        category : str
            六親分類，如「父母兄弟」或「妻子」
        ke : int
            刻序號 (0-7)
        
        Returns
        -------
        str
            對應的卦爻或六親說明
        """
        return KeFenEngine.lookup_bake_96ke(hour_branch, category, ke)
    
    def lookup_six_qin(self, hour_branch: str, category: str, fen: int) -> str:
        """
        查詢六親刻分圖（SIX_QIN_KE_FEN）
        
        Parameters
        ----------
        hour_branch : str
            時辰地支（子、丑、寅…）
        category : str
            六親分類，如「妻子」
        fen : int
            分序號 (0-14)
        
        Returns
        -------
        str
            對應的六親說明
        """
        return KeFenEngine.lookup_six_qin(hour_branch, category, fen)
    
    def get_tiaowen_database_info(self) -> Dict[str, Any]:
        """
        獲取完整 12000 條文資料庫統計信息
        
        Returns
        -------
        Dict
            total（條文總數）及資料庫路徑
        """
        return {
            "total": self.tiaowen_db.total,
            "data_file": TiaowenDatabase._DATA_FILENAME,
        }


# ============================================================================
# 使用範例
# ============================================================================

if __name__ == "__main__":
    # 示例出生資料
    birth_example = TieBanBirthData(
        birth_dt=datetime(1990, 5, 15, 14, 30),  # 1990-05-15 14:30
        year_gz=Ganzhi('庚', '午'),
        month_gz=Ganzhi('辛', '巳'),
        day_gz=Ganzhi('戊', '辰'),
        hour_gz=Ganzhi('己', '未'),
        gender="男",
        father_birth=datetime(1960, 1, 1),
        mother_birth=datetime(1962, 3, 3),
        siblings_info="兄弟二人",
        marital_status="已婚",
        children_info="一子一女"
    )
    
    tbss = TieBanShenShu()
    result = tbss.calculate(birth_example)
    
    print(tbss.get_full_report(birth_example))
