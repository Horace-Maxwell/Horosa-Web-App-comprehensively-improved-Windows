"""萬化仙禽起盤工具 — WanHua XianQin Charting Tool

Based on the classical text «新刻劉伯溫萬化仙禽» (朱國祥著).
Implements the complete 演禽 (Star-Animal Divination) system including:
  • 三元起宿 / 推胎宮 / 推胎星
  • 推太陽入宮 → 推命宮（時加至卯）
  • 推身宮 / 推命星 / 推身星
  • 十二宮衍生星（田宅、福德、官祿、遷移、疾厄、財帛、奴僕、妻妾、兄弟、子息、相貌、科名、壽星）
  • 吞啗 / 合戰 judgment
  • 情性賦 / 格局判斷 / 得時得地
"""

from __future__ import annotations

import datetime
import json
import os
import streamlit as st
from typing import Dict, List, Optional, Tuple

# ==================== 二十八宿 + 禽名 + 五行數據（完全來自文本） ====================

HOSTS: List[str] = [
    "角", "亢", "氐", "房", "心", "尾", "箕", "斗", "牛", "女", "虛", "危",
    "室", "壁", "奎", "婁", "胃", "昴", "畢", "觜", "參", "井", "鬼", "柳",
    "星", "張", "翼", "軫",
]

QIN_NAMES: List[str] = [
    "角木蛟", "亢金龍", "氐土貉", "房日兔", "心月狐", "尾火虎", "箕水豹",
    "斗木獬", "牛金牛", "女土蝠", "虛日鼠", "危月燕", "室火豬", "壁水貐",
    "奎木狼", "婁金狗", "胃土雉", "昴日雞", "畢月烏", "觜火猴", "參水猿",
    "井木犴", "鬼金羊", "柳土獐", "星日馬", "張月鹿", "翼火蛇", "軫水蚓",
]

# 五行對應 — 取禽名第二字（日從火、月從火）
QIN_ELEMENT: Dict[str, str] = {
    "角木蛟": "木", "亢金龍": "金", "氐土貉": "土", "房日兔": "火", "心月狐": "火",
    "尾火虎": "火", "箕水豹": "水", "斗木獬": "木", "牛金牛": "金", "女土蝠": "土",
    "虛日鼠": "火", "危月燕": "火", "室火豬": "火", "壁水貐": "水", "奎木狼": "木",
    "婁金狗": "金", "胃土雉": "土", "昴日雞": "火", "畢月烏": "火", "觜火猴": "火",
    "參水猿": "水", "井木犴": "木", "鬼金羊": "金", "柳土獐": "土", "星日馬": "火",
    "張月鹿": "火", "翼火蛇": "火", "軫水蚓": "水",
}

# 十二宮名稱（文本標準順序：命宮起逆行十二位）
PALACE_NAMES: List[str] = [
    "命宮", "財帛宮", "兄弟宮", "田宅宮", "子女宮", "奴僕宮",
    "夫妻宮", "疾厄宮", "遷移宮", "官祿宮", "福德宮", "相貌宮",
]

# 十二地支
BRANCHES: List[str] = [
    "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
]

# 三元起宿表（文本精確，每元六甲旬起頭宿）
SAN_YUAN_TABLE: Dict[str, List[str]] = {
    "上元": ["箕", "昴", "軫", "虛", "參", "氐"],
    "中元": ["角", "危", "井", "房", "奎", "星"],
    "下元": ["壁", "柳", "尾", "胃", "翼", "女"],
}

# ==================== 合宿表（推合宿，line 2518-2521） ====================

PAIRING_TABLE: Dict[str, str] = {
    "角": "昴", "昴": "角",
    "亢": "胃", "胃": "亢",
    "氐": "婁", "婁": "氐",
    "房": "奎", "奎": "房",
    "心": "壁", "壁": "心",
    "室": "尾", "尾": "室",
    "箕": "危", "危": "箕",
    "斗": "虛", "虛": "斗",
    "牛": "女", "女": "牛",
    "畢": "軫", "軫": "畢",
    "星": "井", "井": "星",
    "柳": "鬼", "鬼": "柳",
}

# ==================== 科名星月宿起始（line 264） ====================

MONTH_STAR_START: Dict[int, str] = {
    1: "角", 2: "角", 3: "氐", 4: "房", 5: "心", 6: "尾",
    7: "箕", 8: "斗", 9: "牛", 10: "女", 11: "虛", 12: "危",
}

# ==================== 四季得時宿（lines 388-393） ====================

SEASON_QIN: Dict[str, List[str]] = {
    "春": ["角木蛟", "亢金龍", "軫水蚓", "胃土雉", "危月燕", "昴日雞", "翼火蛇"],
    "夏": ["房日兔", "張月鹿", "女土蝠", "壁水貐", "心月狐", "氐土貉", "柳土獐"],
    "秋": ["尾火虎", "井木犴", "參水猿", "觜火猴", "星日馬", "斗木獬", "鬼金羊"],
    "冬": ["牛金牛", "箕水豹", "虛日鼠", "室火豬", "畢月烏", "奎木狼", "婁金狗"],
}

# ==================== 二十八宿禽主情性賦（lines 629-648） ====================

PERSONALITY_DICT: Dict[str, str] = {
    "角木蛟": "近官利貴",
    "亢金龍": "四海昇名",
    "氐土貉": "為人本分",
    "房日兔": "膽小心伶",
    "心月狐": "聰明淫亂",
    "尾火虎": "猛勇無心",
    "箕水豹": "行藏如雅",
    "斗木獬": "梗直無私",
    "牛金牛": "辛勤勞碌",
    "女土蝠": "義善心公",
    "虛日鼠": "有終無始",
    "危月燕": "伶俐多能",
    "室火豬": "窺洪無毒",
    "壁水貐": "心高志誠",
    "奎木狼": "多恩恤直",
    "婁金狗": "義宗慈仁",
    "胃土雉": "性剛無毒",
    "昴日雞": "口快心雄",
    "畢月烏": "清閑近貴",
    "觜火猴": "機巧言浮",
    "參水猿": "心慈口毒",
    "井木犴": "直梗恩情",
    "鬼金羊": "有忠有孝",
    "柳土獐": "性急無存",
    "星日馬": "德名出眾",
    "張月鹿": "心善慈仁",
    "翼火蛇": "性燥心傲",
    "軫水蚓": "三教賢人",
}

# ==================== 二十八宿正像（lines 779-791）：干支→禽 ====================

ZHENG_XIANG_DICT: Dict[str, str] = {
    "丙子": "虛日鼠", "丙午": "星日馬", "丁卯": "房日兔", "丁酉": "昴日雞",
    "丙寅": "尾火虎", "丙申": "觜火猴", "丁巳": "翼火蛇", "丁亥": "室火豬",
    "甲辰": "角木蛟", "甲戌": "奎木狼", "乙丑": "斗木獬", "乙未": "井木犴",
    "戊子": "女土蝠", "戊午": "柳土獐", "己卯": "氐土貉", "己酉": "胃土雉",
    "壬子": "危月燕", "壬午": "張月鹿", "癸卯": "心月狐", "癸酉": "畢月烏",
    "庚辰": "亢金龍", "庚戌": "婁金狗", "辛丑": "牛金牛", "辛未": "鬼金羊",
    "壬申": "參水猿", "壬寅": "箕水豹", "癸丑": "壁水貐", "癸亥": "軫水蚓",
}

# ==================== 古人貴賤賦摘要（lines 792-836） ====================

NOBLE_DESC: str = (
    "蛟龍歸滄海，蘇秦佩六國之印。虎豹嘯鄭野，石奮封萬石之君。"
    "井木犴行於壬申，太公八十遇文王。亢金龍坐于丙午，天河井羅十二為宰相。"
    "危月燕飛于龍樓鳳閣，包龍圖為陰陽教化之臣。"
    "畢月烏飛于鳳閣鸞臺，配史丞相有潤澤生民之德。"
    "張月鹿瞻花座，翁首為二十四考書生。"
    "星日馬引駕朝王，曾為三十六宰輔。"
    "昴日雞飛在扶桑，韓世忠有勸主之忠。"
    "房日兔照于廣寒宮，冠準封萊公之貴。"
    "斗木獬坐于辛亥，賈島為樞密相府佐。"
    "牛金牛行于庚辰，德秀性賢，作太弼扶舜日。"
    "尾火虎走于辛卯，陳平封萬戶之侯。"
    "箕水豹演于甲寅，曹操掌三公之國。"
    "女土蝠飛于戊子，張良作漢室之功。"
    "虛日鼠走于庚申，謝安為晉朝顯相。"
    "氐土貉行于乙亥，佛印作宋朝僧師。"
    "角木蛟居于庚辰，王勃為大中大夫。"
)

POOR_DESC: str = (
    "蛟龍退殼于泥田，沛公為水泗亭長。"
    "虎豹遁跡于山谷，志和作燕川釣叟。"
    "韓信受跨下之辱。夫子絕糧于陳蔡。"
    "賈誼貶于長沙。東坡被黃州之貶。"
    "屈原抱石投江。項羽自刎烏江。"
    "原憲室中懸磬。范丹甑內生塵。"
)

# ==================== 吞啗 / 合戰規則 ====================
# 從「四七禽演吞啗歌」(lines 867-886) +「春宿歌」(lines 2348-2353) +
# 「暗禽吞啗訣」(lines 2318-2329) 提取
# 格式：禽A → {禽B: "吞"/"啗"/"合"/"戰"}

SWALLOW_RULES: Dict[str, Dict[str, str]] = {
    # 虎豹食猪羊鹿獐 (春宿歌 + 吞啗歌)
    "尾火虎": {
        "室火豬": "吞", "鬼金羊": "吞", "張月鹿": "吞", "柳土獐": "吞",
        "虛日鼠": "啗", "參水猿": "啗", "觜火猴": "啗",
    },
    "箕水豹": {
        "室火豬": "吞", "鬼金羊": "吞", "張月鹿": "吞", "柳土獐": "吞",
        "虛日鼠": "啗", "參水猿": "啗", "觜火猴": "啗",
    },
    # 奎狼啗鹿獐
    "奎木狼": {
        "張月鹿": "啗", "柳土獐": "啗", "鬼金羊": "吞",
        "星日馬": "啗", "牛金牛": "啗",
    },
    # 蛟龍吞燕蝠鼠
    "角木蛟": {
        "危月燕": "吞", "女土蝠": "吞", "虛日鼠": "吞",
    },
    "亢金龍": {
        "危月燕": "吞", "女土蝠": "吞", "虛日鼠": "吞",
        "尾火虎": "戰", "箕水豹": "戰",
    },
    # 蛇傷鼠兔, 氐宿受蛇傷
    "翼火蛇": {
        "虛日鼠": "吞", "房日兔": "吞", "女土蝠": "啗",
        "危月燕": "啗", "室火豬": "啗", "氐土貉": "啗",
    },
    # 犴吞虎豹蛟龍類 (line 884), 井能食虎豹 (line 2351)
    "井木犴": {
        "尾火虎": "吞", "箕水豹": "吞",
        "角木蛟": "吞", "亢金龍": "吞",
    },
    # 狐貉吞雉更兼雞 (line 883)
    "心月狐": {
        "胃土雉": "吞", "昴日雞": "吞",
    },
    "氐土貉": {
        "胃土雉": "吞", "昴日雞": "吞",
    },
    # 婁金狗殺觜火猴/參水猿/心月狐 (line 872)
    "婁金狗": {
        "觜火猴": "吞", "參水猿": "吞", "心月狐": "啗", "柳土獐": "啗",
    },
    # 昴胃畢啄軫 (line 2353)
    "昴日雞": {"軫水蚓": "吞"},
    "胃土雉": {"軫水蚓": "吞"},
    "畢月烏": {
        "軫水蚓": "吞", "牛金牛": "啗", "室火豬": "啗",
    },
    # 猪狗蛇芎狐伏犴 (line 882)
    "室火豬": {"心月狐": "啗"},
    # 斗牛住處蛇難禁 (line 885)
    "斗木獬": {"翼火蛇": "啗"},
    "牛金牛": {"翼火蛇": "啗"},
    # 鹿狗豬偷柳土獐 (line 868)
    "張月鹿": {"柳土獐": "啗"},
    # 被動方 — 遇到吞/啗者即「戰」
    "危月燕": {"角木蛟": "戰", "亢金龍": "戰"},
    "虛日鼠": {"角木蛟": "戰", "亢金龍": "戰", "翼火蛇": "戰"},
    "女土蝠": {"角木蛟": "戰", "亢金龍": "戰"},
    "參水猿": {"觜火猴": "合"},
    "房日兔": {"翼火蛇": "戰"},
    "鬼金羊": {"尾火虎": "戰", "箕水豹": "戰", "奎木狼": "戰"},
    "星日馬": {"奎木狼": "戰", "尾火虎": "戰"},
    "柳土獐": {"尾火虎": "戰", "箕水豹": "戰", "奎木狼": "戰"},
    "軫水蚓": {"昴日雞": "戰", "胃土雉": "戰", "畢月烏": "戰", "室火豬": "戰"},
}

# ==================== 五行生剋映射 ====================

_SHENG_MAP: Dict[str, str] = {
    "木": "火", "火": "土", "土": "金", "金": "水", "水": "木",
}
_KE_MAP: Dict[str, str] = {
    "木": "土", "火": "金", "土": "水", "金": "木", "水": "火",
}
_SHENG_WO_MAP: Dict[str, str] = {  # 什麼生我
    "木": "水", "火": "木", "土": "火", "金": "土", "水": "金",
}
_KE_WO_MAP: Dict[str, str] = {  # 什麼剋我
    "木": "金", "火": "水", "土": "木", "金": "火", "水": "土",
}

# ==================== 日類分組（日/月/火/水/木/金/土） ====================
# 每個禽名格式固定為「X Y Z」三字，第二字(index 1)即七曜類別

_DAY_TYPE: Dict[str, str] = {qn: qn[1] for qn in QIN_NAMES}

# 十二地支五行（子水丑土寅木…）
BRANCH_ELEMENT: Dict[int, str] = {
    0: "水", 1: "土", 2: "木", 3: "木", 4: "土", 5: "火",
    6: "火", 7: "土", 8: "金", 9: "金", 10: "土", 11: "水",
}


# ==================================================================================
#                              WanHuaXianQin 主類
# ==================================================================================

class WanHuaXianQin:
    """萬化仙禽完整起盤工具"""

    def __init__(self) -> None:
        self.host_to_qin: Dict[str, str] = dict(zip(HOSTS, QIN_NAMES))
        self.qin_to_host: Dict[str, str] = {v: k for k, v in self.host_to_qin.items()}

    # ────────────────────── 基礎工具 ──────────────────────

    @staticmethod
    def hour_to_branch_idx(hour: int) -> int:
        """24小時制轉地支索引（子=0）

        傳統對應：子時(23-1)=0, 丑時(1-3)=1, …, 亥時(21-23)=11
        公式 ((hour+1)//2)%12 可正確處理跨日子時：
          hour=23 → 0(子), hour=0 → 0(子), hour=1 → 1(丑) …
        """
        return ((hour + 1) // 2) % 12

    def get_branch_idx(self, year: int) -> int:
        """年支索引（子=0）"""
        return (year - 4) % 12

    def get_host_idx(self, qin: str) -> int:
        """取禽對應的宿序號（0-27）"""
        host = self.qin_to_host[qin]
        return HOSTS.index(host)

    @staticmethod
    def is_day_birth(hour: int) -> bool:
        """日生/夜生判斷。卯時(5:00)至酉時(19:00)為日生。

        Args:
            hour: 24 小時制的出生時辰（0-23）

        Returns:
            True = 日生, False = 夜生
        """
        return 5 <= hour < 19

    @staticmethod
    def _month_to_season(month: int) -> str:
        """農曆月→季節"""
        if month in (1, 2, 3):
            return "春"
        if month in (4, 5, 6):
            return "夏"
        if month in (7, 8, 9):
            return "秋"
        return "冬"

    # ────────────────────── 三元 ──────────────────────

    def determine_san_yuan(self, year: int) -> str:
        """判定三元（上元/中元/下元），每元六十年"""
        cycle = (year - 3) % 180
        if cycle < 60:
            return "上元"
        if cycle < 120:
            return "中元"
        return "下元"

    # ────────────────────── 推胎宮 ──────────────────────

    def calc_tai_gong_idx(self, year: int, month: int, day: int, hour: int) -> int:
        """推胎宮法

        以人生年上起月，月上起日，日上起子時演至本人生時即止。

        Returns:
            胎宮地支索引 0=子 … 11=亥
        """
        branch_idx = self.get_branch_idx(year)
        pos = branch_idx
        pos = (pos + month - 1) % 12
        pos = (pos + day - 1) % 12
        hour_idx = self.hour_to_branch_idx(hour)
        pos = (pos + hour_idx) % 12
        return pos

    # ────────────────────── 推胎星 ──────────────────────

    def calc_tai_xing(self, san_yuan: str, birth_day: int, gender: str) -> str:
        """推胎星

        以三元起宿表起頭宿，加生日數。
        男不牛宿（遇牛跳過），女不女宿（遇女跳過）。
        """
        table = SAN_YUAN_TABLE[san_yuan]
        start_host = table[0]
        start_idx = HOSTS.index(start_host)
        idx = (start_idx + birth_day - 1) % 28
        host = HOSTS[idx]
        if gender.upper() == "M" and host == "牛":
            idx = (idx + 1) % 28
        elif gender.upper() == "F" and host == "女":
            idx = (idx + 1) % 28
        return self.host_to_qin[HOSTS[idx]]

    # ────────────────────── 推太陽入宮 → 推命宮 ──────────────────────

    @staticmethod
    def _sun_palace_idx(month: int) -> int:
        """推太陽入宮：月份→太陽所在地支索引

        文本（lines 212-218）：
          正月→子, 二月→亥, 三月→戌, 四月→酉, … 十二月→丑
        公式: sun_palace = (13 - month) % 12

        驗證：month=3 → (13-3)%12 = 10 = 戌 ✓
        """
        return (13 - month) % 12

    def calc_ming_gong_idx(self, month: int, day: int, hour: int) -> int:
        """推命宮（太陽入宮 + 時加至卯）

        文本（line 201-203）：
        「以本人生時加本月太陽宮主演之，但言著卯字即止是命宮也。」

        算法：
          1. 取太陽宮 sun_palace（月份對應地支）
          2. 從 sun_palace 起順數地支，同時從 hour_branch 起念
          3. 當念到「卯」字時，所在位置即命宮

        公式: ming_gong = (sun_palace + (卯idx - hour_idx)) % 12

        驗證：戊子年三月十五巳時
          sun_palace = 戌(10), hour = 巳(5), 卯 = 3
          ming_gong = (10 + (3 - 5)) % 12 = 8 = 申 ✓
        """
        sun_palace = self._sun_palace_idx(month)
        hour_idx = self.hour_to_branch_idx(hour)
        mao_idx = 3  # 卯
        return (sun_palace + (mao_idx - hour_idx)) % 12

    # ────────────────────── 推身宮 ──────────────────────

    def calc_shengong_idx(self, month: int, day: int) -> int:
        """推身宮（太陰立成法）

        文本例（line 227-229）：三月生十五日，從胃起數15宿得氐，身宮=申(8)。
        驗證：(15 - 1 + 3 * 2) % 12 = 20 % 12 = 8 = 申 ✓
        """
        return (day - 1 + month * 2) % 12

    # ────────────────────── 十二宮排布 ──────────────────────

    def build_12_palaces(self, ming_gong_idx: int) -> List[str]:
        """十二宮逆行排布（命宮起逆數十二位）"""
        return list(PALACE_NAMES)

    def get_palace_branch(self, ming_gong_idx: int, palace_idx: int) -> int:
        """取第 palace_idx 宮對應的地支索引（逆行）"""
        return (ming_gong_idx - palace_idx) % 12

    # ────────────────────── 合宿 ──────────────────────

    def get_paired_host(self, qin: str) -> str:
        """取禽的合宿禽"""
        host = self.qin_to_host[qin]
        paired = PAIRING_TABLE.get(host)
        if paired:
            return self.host_to_qin[paired]
        return qin

    # ────────────────────── 五行生剋查找 ──────────────────────

    def get_generating_host(self, qin: str) -> str:
        """找生胎星者（什麼五行生我），取上宿（idx-1 方向）首個匹配

        文本：「取胎星上宿，生胎星者」
        例：虛日鼠(火)，木生火 → 上宿找木 → 斗木獬
        """
        elem = QIN_ELEMENT[qin]
        target_elem = _SHENG_WO_MAP[elem]
        idx = self.get_host_idx(qin)
        for offset in range(1, 28):
            candidate = QIN_NAMES[(idx - offset) % 28]
            if QIN_ELEMENT[candidate] == target_elem:
                return candidate
        return qin

    def get_overcoming_host(self, qin: str) -> str:
        """找剋胎星者（什麼五行剋我），取上宿方向首個匹配

        文本：「取胎星上宿尅星者」
        例：虛日鼠(火)，水剋火 → 找水宿 → 箕水豹
        """
        elem = QIN_ELEMENT[qin]
        target_elem = _KE_WO_MAP[elem]
        idx = self.get_host_idx(qin)
        for offset in range(1, 28):
            candidate = QIN_NAMES[(idx - offset) % 28]
            if QIN_ELEMENT[candidate] == target_elem:
                return candidate
        return qin

    def get_overcome_by_tai(self, qin: str) -> str:
        """胎星所剋者 — 找前方（idx+1 方向）第一個被胎星五行所剋的禽

        文本：「以胎星尅前者加子」
        例：虛日鼠(火)，火剋金 → 前方找金 → 婁金狗
        """
        elem = QIN_ELEMENT[qin]
        target_elem = _KE_MAP[elem]
        idx = self.get_host_idx(qin)
        for offset in range(1, 28):
            candidate = QIN_NAMES[(idx + offset) % 28]
            if QIN_ELEMENT[candidate] == target_elem:
                return candidate
        return qin

    def get_same_day_type(self, qin: str) -> str:
        """找同日類者（同日/月/火/水/木/金/土），取前方首個

        文本：「以胎星同類者」
        例：虛日鼠 → 同「日」類 → 前方找 → 昴日雞
        """
        day_type = _DAY_TYPE[qin]
        idx = self.get_host_idx(qin)
        for offset in range(1, 28):
            candidate = QIN_NAMES[(idx + offset) % 28]
            if _DAY_TYPE[candidate] == day_type:
                return candidate
        return qin

    def get_previous_host(self, qin: str) -> str:
        """胎星前宿（前一宿, idx+1 方向）"""
        idx = self.get_host_idx(qin)
        return self.host_to_qin[HOSTS[(idx + 1) % 28]]

    # ────────────────────── 演至宮法 ──────────────────────

    def _evolve_to_palace(self, start_qin: str, target_branch_idx: int) -> str:
        """以 start_qin 加子（放在子宮上），順數至 target_branch_idx，得該宮上的禽"""
        start_idx = self.get_host_idx(start_qin)
        result_idx = (start_idx + target_branch_idx) % 28
        return QIN_NAMES[result_idx]

    # ────────────────────── 推命星 / 推身星 ──────────────────────

    def calc_ming_xing(self, tai_xing: str, ming_gong_idx: int) -> str:
        """推命星：胎星合宿加子，演至命宮

        文本（line 221）：例：虛日鼠合斗，斗加子演至申(8)，得婁金狗。
        """
        paired = self.get_paired_host(tai_xing)
        return self._evolve_to_palace(paired, ming_gong_idx)

    def calc_shen_xing(self, ming_xing: str, shen_gong_idx: int) -> str:
        """推身星：命星合宿加子，演至身宮

        文本（line 232）：例：婁金狗合氐，氐加子演至申(8)，得虛日鼠。
        """
        paired = self.get_paired_host(ming_xing)
        return self._evolve_to_palace(paired, shen_gong_idx)

    # ────────────────────── 衍生星 ──────────────────────

    def calc_derived_stars(
        self,
        tai_xing: str,
        tai_gong_idx: int,
        ming_gong_idx: int,
        shen_gong_idx: int,
        gender: str,
        birth_month: int,
    ) -> Dict[str, str]:
        """完整衍生星計算（嚴格按文本 lines 237-276 公式）"""
        stars: Dict[str, str] = {}

        def palace_branch(p_idx: int) -> int:
            return self.get_palace_branch(ming_gong_idx, p_idx)

        # 田宅(3) / 福德(10)：生胎星者加子，演至本宮
        gen_qin = self.get_generating_host(tai_xing)
        stars["田宅星"] = self._evolve_to_palace(gen_qin, palace_branch(3))
        stars["福德星"] = self._evolve_to_palace(gen_qin, palace_branch(10))

        # 官祿(9) / 遷移(8) / 疾厄(7)：剋胎星者加子，演至本宮
        over_qin = self.get_overcoming_host(tai_xing)
        stars["遷移星"] = self._evolve_to_palace(over_qin, palace_branch(8))
        stars["疾厄星"] = self._evolve_to_palace(over_qin, palace_branch(7))
        stars["官祿星"] = self._evolve_to_palace(over_qin, palace_branch(9))

        # 財帛(1) / 奴僕(5) / 妻妾(6)：胎星剋前者加子，演至本宮
        ke_qin = self.get_overcome_by_tai(tai_xing)
        stars["財帛星"] = self._evolve_to_palace(ke_qin, palace_branch(1))
        stars["奴僕星"] = self._evolve_to_palace(ke_qin, palace_branch(5))
        stars["妻妾星"] = self._evolve_to_palace(ke_qin, palace_branch(6))

        # 兄弟(2)：胎星同類者加子，演至兄弟宮
        same_qin = self.get_same_day_type(tai_xing)
        stars["兄弟星"] = self._evolve_to_palace(same_qin, palace_branch(2))

        # 子息(4)：妻妾星前生者，加子演至子息宮
        wife_star = stars["妻妾星"]
        wife_gen = self.get_generating_host(wife_star)
        stars["子息星"] = self._evolve_to_palace(wife_gen, palace_branch(4))

        # 相貌(11)：身合宿加子，演至相貌宮
        paired = self.get_paired_host(tai_xing)
        stars["相貌星"] = self._evolve_to_palace(paired, palace_branch(11))

        # 科名：生月星加子，演至妻妾宮（西沒宮）
        month_start_host = MONTH_STAR_START.get(birth_month, "角")
        month_start_idx = HOSTS.index(month_start_host)
        month_qin = QIN_NAMES[month_start_idx]
        stars["科名星"] = self._evolve_to_palace(month_qin, palace_branch(6))

        # 壽星：元神宮（陽男陰女命前一辰，陰男陽女命後一辰）
        if gender.upper() == "M":
            shou_gong = (ming_gong_idx + 1) % 12
        else:
            shou_gong = (ming_gong_idx - 1) % 12
        ming_xing = self.calc_ming_xing(tai_xing, ming_gong_idx)
        stars["壽星"] = self._evolve_to_palace(ming_xing, shou_gong)

        return stars

    # ────────────────────── 大限 / 流年 / 元辰（WP-12/13）──────────────────────

    _STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
    _QIN_YAO_START_AGE = {"水": 1, "火": 2, "木": 3, "金": 4, "土": 5, "日": 6, "月": 7}
    # 五虎遁：年干 → 正月(寅)天干
    _WUHU_YIN = {"甲": "丙", "己": "丙", "乙": "戊", "庚": "戊", "丙": "庚", "辛": "庚",
                 "丁": "壬", "壬": "壬", "戊": "甲", "癸": "甲"}
    _YANG_STEMS = set("甲丙戊庚壬")

    def _palace_stem(self, year: int, branch_idx: int) -> str:
        """宮天干（五虎遁）：年干→寅宮干→順布至該宮支。"""
        year_stem = self._STEMS[(year - 4) % 10]
        yin_stem = self._WUHU_YIN[year_stem]
        yin_stem_idx = self._STEMS.index(yin_stem)
        off = (branch_idx - 2) % 12  # 寅=2
        return self._STEMS[(yin_stem_idx + off) % 10]

    def calc_yuanchen_xing(self, ming_xing: str, ming_gong_idx: int) -> str:
        """元辰禽（WP-13）：命宮對衝位(命宮+6)所值之禽，作暗耗看。命星加子演至衝位。"""
        chong = (ming_gong_idx + 6) % 12
        return self._evolve_to_palace(ming_xing, chong)

    def calc_dayun(self, year: int, ming_gong_idx: int, ming_xing: str, gender: str) -> Dict:
        """大限（WP-12·萬化仙禽起例）：十年一移。
        起運虛歲＝命星曜(水1火2木3金4土5日6月7)；方向＝命宮天干陰陽(男陽順陰逆、女反)。
        ⚠️ 大限方向兩說：萬化仙禽用主星宮天干陰陽；三僚作男女皆順——本期取萬化仙禽說，另說待校。
        """
        yao = ming_xing[1] if len(ming_xing) >= 2 else "水"
        start_age = self._QIN_YAO_START_AGE.get(yao, 1)
        gong_stem = self._palace_stem(year, ming_gong_idx)
        yang = gong_stem in self._YANG_STEMS
        forward = yang if gender.upper() == "M" else (not yang)
        limits = []
        age = start_age
        for i in range(12):
            step = i if forward else -i
            gong = (ming_gong_idx + step) % 12
            limits.append({"palace_branch": BRANCHES[gong], "age_start": age, "age_end": age + 9})
            age += 10
        return {
            "start_age": start_age, "forward": forward, "palace_stem": gong_stem,
            "note": "萬化仙禽:命星宮天干陰陽定順逆(男陽順陰逆、女反);三僚作男女皆順·待校",
            "limits": limits,
        }

    def calc_liunian(self, tai_xing: str, up_to: int = 60) -> List[Dict]:
        """流年小限（WP-12）：以胎星作一歲往前演，逐年一宿(胎斗→一歲斗、二歲牛…)。"""
        start = self.get_host_idx(tai_xing)
        return [{"age": a, "qin": QIN_NAMES[(start + a - 1) % 28]} for a in range(1, up_to + 1)]

    # 孤辰寡宿（WP-15）：按年支三合局。寅卯辰→孤辰巳寡宿丑；巳午未→孤辰申寡宿辰；
    # 申酉戌→孤辰亥寡宿未；亥子丑→孤辰寅寡宿戌。
    _GUCHEN_GUASU = {
        "寅": ("巳", "丑"), "卯": ("巳", "丑"), "辰": ("巳", "丑"),
        "巳": ("申", "辰"), "午": ("申", "辰"), "未": ("申", "辰"),
        "申": ("亥", "未"), "酉": ("亥", "未"), "戌": ("亥", "未"),
        "亥": ("寅", "戌"), "子": ("寅", "戌"), "丑": ("寅", "戌"),
    }

    def calc_guchen_guasu(self, year: int) -> Dict:
        """孤辰寡宿神煞（WP-15）：由年支三合定孤辰/寡宿地支。"""
        zhi = BRANCHES[self.get_branch_idx(year)]
        guchen, guasu = self._GUCHEN_GUASU[zhi]
        return {"year_branch": zhi, "guchen": guchen, "guasu": guasu}

    # ────────────────────── 吞啗判斷 ──────────────────────

    def judge_swallow(self, qin1: str, qin2: str) -> str:
        """吞啗 / 合戰判斷

        Returns:
            "吞" — qin1 完全制服 qin2
            "啗" — qin1 傷害 qin2
            "合" — 同類/相生，吉
            "戰" — qin2 制 qin1，凶
            "無" — 無明顯關係
        """
        if qin1 == qin2:
            return "合"

        # 查歌賦專門規則
        if qin1 in SWALLOW_RULES and qin2 in SWALLOW_RULES[qin1]:
            return SWALLOW_RULES[qin1][qin2]

        # 反向查找
        if qin2 in SWALLOW_RULES and qin1 in SWALLOW_RULES[qin2]:
            rev = SWALLOW_RULES[qin2][qin1]
            if rev in ("吞", "啗"):
                return "戰"
            return rev

        # 通用五行判斷
        e1 = QIN_ELEMENT[qin1]
        e2 = QIN_ELEMENT[qin2]

        if e1 == e2:
            return "合"
        if _SHENG_MAP.get(e1) == e2:
            return "合"
        if _SHENG_MAP.get(e2) == e1:
            return "合"
        if _KE_MAP.get(e1) == e2:
            return "啗"
        if _KE_MAP.get(e2) == e1:
            return "戰"

        return "無"

    # ────────────────────── 情性賦 ──────────────────────

    def get_personality(self, qin: str) -> str:
        """取二十八宿禽主情性賦"""
        return PERSONALITY_DICT.get(qin, "無對應情性賦")

    # ────────────────────── 格局判斷 ──────────────────────

    def judge_pattern(
        self,
        tai_xing: str,
        ming_gong_idx: int,
        birth_month: int,
        hour: int,
    ) -> Dict[str, str]:
        """格局判斷（福祿上格 / 中格 / 貧賤下格）

        判定依據：
        1. 得時（四季得時宿）
        2. 得地（命宮地支五行與禽星五行相生/同類）
        3. 日夜生配合

        Returns:
            {"grade": "上格"/"中格"/"下格", "reason": "..."}
        """
        season = self._month_to_season(birth_month)
        is_day = self.is_day_birth(hour)
        reasons: List[str] = []

        # 得時
        in_season = tai_xing in SEASON_QIN.get(season, [])
        if in_season:
            reasons.append(f"{tai_xing}於{season}季得時")

        # 得地
        ming_elem = BRANCH_ELEMENT[ming_gong_idx]
        qin_elem = QIN_ELEMENT[tai_xing]
        in_place = ming_elem == qin_elem or _SHENG_MAP.get(ming_elem) == qin_elem
        if in_place:
            reasons.append(
                f"命宮{BRANCHES[ming_gong_idx]}({ming_elem})生/助"
                f"{tai_xing}({qin_elem})，得地"
            )

        # 日夜配合
        day_type = _DAY_TYPE[tai_xing]
        day_match = False
        if day_type in ("日", "火") and is_day:
            day_match = True
            reasons.append("日/火禽日生，得氣")
        elif day_type in ("月", "水") and not is_day:
            day_match = True
            reasons.append("月/水禽夜生，得氣")

        score = sum([in_season, in_place, day_match])
        if score >= 2:
            grade = "上格"
            reasons.insert(0, "福祿上格：得時得地")
        elif score == 1:
            grade = "中格"
            reasons.insert(0, "中格：部分得時得地")
        else:
            grade = "下格"
            reasons.insert(0, "貧賤下格：失時失地")

        return {"grade": grade, "reason": "；".join(reasons)}

    # ────────────────────── 完整起盤 ──────────────────────

    def build_chart(
        self,
        year: int,
        month: int,
        day: int,
        hour: int,
        gender: str = "M",
    ) -> Dict:
        """完整起盤 — 返回結構化 dict

        Args:
            year:   農曆年
            month:  農曆月 (1-12)
            day:    農曆日 (1-30)
            hour:   24小時制出生時辰 (0-23)
            gender: "M" 男 / "F" 女

        Returns:
            包含 basic_info / palaces / stars / swallow_analysis /
            personality / pattern 的完整盤面字典
        """
        san_yuan = self.determine_san_yuan(year)
        tai_gong_idx = self.calc_tai_gong_idx(year, month, day, hour)
        tai_xing = self.calc_tai_xing(san_yuan, day, gender)
        ming_gong_idx = self.calc_ming_gong_idx(month, day, hour)
        shen_gong_idx = self.calc_shengong_idx(month, day)
        is_day = self.is_day_birth(hour)

        ming_xing = self.calc_ming_xing(tai_xing, ming_gong_idx)
        shen_xing = self.calc_shen_xing(ming_xing, shen_gong_idx)

        palaces_list = self.build_12_palaces(ming_gong_idx)
        palace_branches: Dict[str, str] = {}
        for i, pname in enumerate(palaces_list):
            br = self.get_palace_branch(ming_gong_idx, i)
            palace_branches[pname] = BRANCHES[br]

        derived = self.calc_derived_stars(
            tai_xing, tai_gong_idx, ming_gong_idx, shen_gong_idx, gender, month,
        )

        # 吞啗分析
        swallow: Dict[str, str] = {}
        key_stars = {"命星": ming_xing, "身星": shen_xing}
        key_stars.update(derived)
        for star_label, star_qin in key_stars.items():
            if star_qin != tai_xing:
                result = self.judge_swallow(tai_xing, star_qin)
                swallow[f"胎星({tai_xing}) vs {star_label}({star_qin})"] = result

        personality_tai = self.get_personality(tai_xing)
        personality_ming = self.get_personality(ming_xing)

        pattern = self.judge_pattern(tai_xing, ming_gong_idx, month, hour)

        # WP-12/13/15：元辰禽 + 大限 + 流年小限 + 孤辰寡宿
        yuanchen_xing = self.calc_yuanchen_xing(ming_xing, ming_gong_idx)
        dayun = self.calc_dayun(year, ming_gong_idx, ming_xing, gender)
        liunian = self.calc_liunian(tai_xing, up_to=60)
        shensha = self.calc_guchen_guasu(year)

        return {
            "basic_info": {
                "year": year,
                "month": month,
                "day": day,
                "hour": hour,
                "gender": "男" if gender.upper() == "M" else "女",
                "san_yuan": san_yuan,
                "day_night": "日生" if is_day else "夜生",
                "season": self._month_to_season(month),
            },
            "palaces": {
                "tai_gong": {"name": "胎宮", "branch": BRANCHES[tai_gong_idx]},
                "ming_gong": {"name": "命宮", "branch": BRANCHES[ming_gong_idx]},
                "shen_gong": {"name": "身宮", "branch": BRANCHES[shen_gong_idx]},
                "twelve": palace_branches,
            },
            "stars": {
                "tai_xing": tai_xing,
                "ming_xing": ming_xing,
                "shen_xing": shen_xing,
                "yuanchen_xing": yuanchen_xing,
                "derived": derived,
            },
            "dayun": dayun,
            "liunian": liunian,
            "shensha": shensha,
            "swallow_analysis": swallow,
            "personality": {
                "tai_xing": f"{tai_xing}：{personality_tai}",
                "ming_xing": f"{ming_xing}：{personality_ming}",
            },
            "pattern": pattern,
        }

    # ────────────────────── 格式化輸出 ──────────────────────

    @classmethod
    def format_chart(cls, chart_data: Dict) -> str:
        """將 build_chart 返回的 dict 格式化為可讀文本"""
        lines: List[str] = []
        bi = chart_data["basic_info"]
        lines.append("=" * 56)
        lines.append("  【新刻劉伯溫萬化仙禽 · 完整起盤】")
        lines.append("=" * 56)
        lines.append(
            f"  出生：{bi['year']}年{bi['month']}月{bi['day']}日 {bi['hour']}時"
            f"  {bi['gender']}命  {bi['day_night']}  {bi['season']}季"
        )
        lines.append(f"  三元：{bi['san_yuan']}")
        lines.append("")

        p = chart_data["palaces"]
        lines.append(
            f"  胎宮：{p['tai_gong']['branch']}宮"
            f"　　命宮：{p['ming_gong']['branch']}宮"
            f"　　身宮：{p['shen_gong']['branch']}宮"
        )
        lines.append("")
        lines.append("  ── 十二宮排布（命宮起逆行） ──")
        for pname, br in p["twelve"].items():
            lines.append(f"    {pname}：{br}")
        lines.append("")

        s = chart_data["stars"]
        lines.append(
            f"  胎星：{s['tai_xing']}"
            f"　　命星：{s['ming_xing']}"
            f"　　身星：{s['shen_xing']}"
        )
        lines.append("")
        lines.append("  ── 衍生星 ──")
        for k, v in s["derived"].items():
            lines.append(f"    {k}：{v}")
        lines.append("")

        lines.append("  ── 吞啗 / 合戰分析 ──")
        for desc, result in chart_data["swallow_analysis"].items():
            lines.append(f"    {desc} → {result}")
        lines.append("")

        lines.append("  ── 情性賦 ──")
        for _label, text in chart_data["personality"].items():
            lines.append(f"    {text}")
        lines.append("")

        pat = chart_data["pattern"]
        lines.append(f"  ── 格局：{pat['grade']} ──")
        lines.append(f"    {pat['reason']}")
        lines.append("")
        lines.append("=" * 56)
        return "\n".join(lines)


# ==================== 相胎賦 & 貴賤格 JSON 數據 ====================

_DATA_DIR = os.path.dirname(os.path.abspath(__file__))


@st.cache_data(show_spinner=False)
def _load_json(filename: str) -> object:
    """Load a JSON file from the data directory (cached)."""
    path = os.path.join(_DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_XIANGTAI_FU: Optional[List[Dict]] = None
_GUI_JIAN_GE: Optional[Dict] = None


def _get_xiangtai_fu() -> List[Dict]:
    global _XIANGTAI_FU  # noqa: PLW0603
    if _XIANGTAI_FU is None:
        _XIANGTAI_FU = _load_json("xiangtai_fu.json")
    return _XIANGTAI_FU


def _get_gui_jian_ge() -> Dict:
    global _GUI_JIAN_GE  # noqa: PLW0603
    if _GUI_JIAN_GE is None:
        _GUI_JIAN_GE = _load_json("gui_jian_ge.json")
    return _GUI_JIAN_GE


def lookup_xiangtai(zhu_xing: str, tai_xing: str) -> Optional[Dict]:
    """查詢相胎賦 — 根據主星（命星）和胎星查找匹配的相胎賦讀解

    Args:
        zhu_xing: 主星（命星）禽名，如 "角木蛟"
        tai_xing: 胎星禽名，如 "亢金龍"

    Returns:
        匹配的相胎賦 dict 或 None
    """
    for entry in _get_xiangtai_fu():
        if entry["zhu"] == zhu_xing and entry["tai"] == tai_xing:
            return entry
    return None


def lookup_gui_ge(qin_name: str) -> List[Dict]:
    """查詢貴格（吉利格局）列表

    Args:
        qin_name: 禽名，如 "角木蛟"

    Returns:
        該禽星的貴格列表
    """
    data = _get_gui_jian_ge()
    return data.get("貴格", {}).get(qin_name, [])


def lookup_jian_ge(qin_name: str) -> List[Dict]:
    """查詢賤格（凶煞格局）列表

    Args:
        qin_name: 禽名，如 "角木蛟"

    Returns:
        該禽星的賤格列表
    """
    data = _get_gui_jian_ge()
    return data.get("賤格", {}).get(qin_name, [])


def lookup_fulu_patterns(qin_name: str) -> List[Dict]:
    """查詢福祿上格

    Args:
        qin_name: 禽名，如 "角木蛟"

    Returns:
        匹配的福祿上格列表
    """
    data = _get_gui_jian_ge()
    results = []
    for pat in data.get("福祿上格", []):
        if qin_name in pat.get("stars", ""):
            results.append(pat)
    return results


def lookup_pinjian_patterns(qin_name: str) -> List[Dict]:
    """查詢貧賤下命

    Args:
        qin_name: 禽名，如 "角木蛟"

    Returns:
        匹配的貧賤下命列表
    """
    data = _get_gui_jian_ge()
    results = []
    for pat in data.get("貧賤下命", []):
        if qin_name in pat.get("stars", ""):
            results.append(pat)
    return results


# ==================== 使用示例（文本戊子年生人） ====================
if __name__ == "__main__":
    tool = WanHuaXianQin()
    chart = tool.build_chart(1138, 3, 15, 9, "M")  # 戊子年三月十五巳時
    output = WanHuaXianQin.format_chart(chart)
    print(output)  # noqa: T201
