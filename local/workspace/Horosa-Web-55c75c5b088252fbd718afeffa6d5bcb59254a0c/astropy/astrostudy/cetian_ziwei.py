"""
策天十八飛星紫微斗數排盤模組 (Ce Tian 18 Flying Stars Zi Wei Dou Shu Chart Module)

策天十八飛星紫微斗數，又稱十八飛星、策天派、北派紫微、道藏紫微，
是紫微斗數的古法前身與重要分支。源自明代《十八飛星策天紫微斗數全集》，
由陳希夷（希夷先生）傳承，後與標準紫微斗數合併。

與標準紫微斗數的區別：
- 使用十八飛星（而非標準十四主星），包含十一正曜及七副曜
- 每宮至少有正曜＋副曜，不存在空宮
- 重視「飛星」技術與四化飛化（星曜飛入他宮的影響）
- 以單宮獨斷為主，較少使用三方四會
- 需計算節氣（Solar Terms）影響星曜落度
- 強調古法格局，如刑刃哭姚等副曜的特殊解讀

飛星技術特點：
  十八飛星的核心在於「飛」——每顆星有其固定的飛化規則，
  星曜會由本宮飛入他宮，產生吉凶影響。此技術早於後世
  四化飛星系統（祿權科忌），是紫微斗數飛星派的古法根源。

使用農曆新年查找表搭配 pyswisseph 朔望月計算確定農曆月份。
"""

import math

import swisseph as swe
from dataclasses import dataclass, field

# streamlit 是上游模块自带 UI 框架的依赖:本仓桌面运行链只用本文件的排盘计算
# (compute_cetian_ziwei_chart 与常量表),render_* 渲染函数不被调用,亦不打包
# streamlit(及其 pyarrow/pandas/plotly 依赖树,≈330MB)。此处提供兼容桩:
#   - cache_data 退化为透传装饰器(桌面侧上层已有参数缓存,无需此层;并避免
#     lru_cache 返回共享引用被调用方改写的语义差异);
#   - 其余属性为 no-op(仅当误调渲染函数时静默,不影响计算)。
# 上游开发环境装有 streamlit 时 try 分支原样生效,行为不变。
# 配套哨兵:tests/test_runtime_deps_slim.py(新增顶层重依赖会变红)。
try:
    import streamlit as st  # type: ignore
except ImportError:
    class _StreamlitStub(object):
        @staticmethod
        def cache_data(**_kwargs):
            def _wrap(fn):
                return fn
            return _wrap

        def __getattr__(self, _name):
            def _noop(*_args, **_kw):
                return None
            return _noop

    st = _StreamlitStub()

# ============================================================
# 常量 (Constants)
# ============================================================

EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]

LUNAR_MONTH_NAMES = [
    "正月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
]

HOUR_BRANCH_NAMES = [
    "子時(23-01)", "丑時(01-03)", "寅時(03-05)", "卯時(05-07)",
    "辰時(07-09)", "巳時(09-11)", "午時(11-13)", "未時(13-15)",
    "申時(15-17)", "酉時(17-19)", "戌時(19-21)", "亥時(21-23)",
]

# 五行局
WU_XING_JU_NAMES = {2: "水二局", 3: "木三局", 4: "金四局", 5: "土五局", 6: "火六局"}

# 十二宮位名稱與順序，依《十八飛星策天紫微斗數》卷一「十二宮順序」(page13):
# 一命宮、二財帛、三兄弟、四田宅、五男女、六奴僕、七妻妾、八疾厄、九遷移、十官祿、
# 十一福德、十二相貌。「不論男女俱逆轉」(從命宮起逆時針)。
# (原為標準南派宮名宮序,與本書不符,已改正)
# 書法(策天本法,默認)宮序。
PALACE_SEQUENCE_BOOK = [
    "命宮", "財帛宮", "兄弟宮", "田宅宮", "男女宮", "奴僕宮",
    "妻妾宮", "疾厄宮", "遷移宮", "官祿宮", "福德宮", "相貌宮",
]
# 原法(標準南派紫微嫁接)宮序——僅供左欄「原法」選項使用。
PALACE_SEQUENCE_CLASSIC = [
    "命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮",
    "遷移宮", "交友宮", "官祿宮", "田宅宮", "福德宮", "父母宮",
]
PALACE_SEQUENCE = PALACE_SEQUENCE_BOOK  # 向後相容(預設書法)

# ============================================================
# 策天十八飛星 (Ce Tian 18 Flying Stars)
# ============================================================
# 十二正曜 (indices 0-11) + 七副曜 (indices 12-18)
# (序號, 拼音, 中文, English)
CETIAN_18_FLYING_STARS = [
    ("0",  "ZiWei",     "紫微",   "Purple Micro"),
    ("1",  "TianXu",    "天虛",   "Heavenly Void"),
    ("2",  "TianGui",   "天貴",   "Heavenly Noble"),
    ("3",  "TianYin",   "天印",   "Heavenly Seal"),
    ("4",  "TianShou",  "天壽",   "Heavenly Longevity"),
    ("5",  "TianKong",  "天空",   "Heavenly Sky"),
    ("6",  "HongLuan",  "紅鸞",   "Red Phoenix"),
    ("7",  "TianKu2",   "天庫",   "Heavenly Storehouse"),  # 天庫（與天哭 TianKu 不同）
    ("8",  "TianGuan",  "天貫",   "Heavenly Official"),
    ("9",  "WenChang",  "文昌",   "Literary Prosperity"),
    ("10", "TianFu",    "天福",   "Heavenly Blessing"),
    ("11", "TianLu",    "天祿",   "Heavenly Prosperity"),
    # 七副曜
    ("12", "TianZhang", "天杖",   "Heavenly Staff"),
    ("13", "TianYi",    "天異",   "Heavenly Anomaly"),
    ("14", "MaoTou",    "毛頭",   "Mao Head / Banner"),
    ("15", "TianRen",   "天刃",   "Heavenly Blade"),
    ("16", "TianXing",  "天刑",   "Heavenly Punishment"),
    ("17", "TianYao",   "天姚",   "Heavenly Peach Blossom"),
    ("18", "TianKu",    "天哭",   "Heavenly Crying"),
]

# 正曜名稱列表
CETIAN_MAIN_STAR_NAMES = [s[2] for s in CETIAN_18_FLYING_STARS[:12]]
# 副曜名稱列表
CETIAN_AUX_STAR_NAMES = [s[2] for s in CETIAN_18_FLYING_STARS[12:]]

# ============================================================
# 納音五行局 (Nayin Wu Xing Ju)
# ============================================================
NAYIN_WUXING_JU = [
    4, 6, 3, 5, 4,
    6, 2, 5, 4, 3,
    2, 5, 6, 3, 2,
    4, 6, 3, 5, 4,
    6, 2, 5, 4, 3,
    2, 5, 6, 3, 2,
]

# ============================================================
# 策天飛星安星規則 (Ce Tian Star Placement Rules)
# ============================================================
# 紫微星安法與標準紫微相同（由五行局與農曆日決定）
# 其餘十七星由紫微星位置推算

# 正曜相對於紫微星的偏移（類似標準紫微系偏移）
CETIAN_MAIN_OFFSETS = {
    "紫微":  0,
    "天虛":  1,   # +1
    "天貴":  2,   # +2
    "天印":  3,   # +3
    "天壽":  4,   # +4
    "天空":  5,   # +5
    "紅鸞":  6,   # +6
    "天庫":  7,   # +7
    "天貫":  8,   # +8
    "文昌":  9,   # +9
    "天福": 10,   # +10
    "天祿": 11,   # +11
}

# 七副曜安星規則（由年支、月、時辰決定）
# 天杖: 以年支起子順行
# 天異: 以年支起丑逆行
# 毛頭: 以月數起寅順行
# 天刃: 以時辰起卯逆行
# 天刑: 以月數起酉順行
# 天姚: 以月數起丑順行
# 天哭: 以年支起午順行

# ============================================================
# 策天飛化規則 (Ce Tian Flying Transformation Rules)
# ============================================================
# 策天派四化表（年干決定，古法四化與標準紫微有所不同）
CETIAN_SIHUA_TABLE = [
    ("紫微", "天貴", "文昌", "天虛"),   # 甲
    ("天福", "天印", "紫微", "天壽"),   # 乙
    ("天祿", "天貫", "文昌", "天空"),   # 丙
    ("紅鸞", "天祿", "天貫", "天庫"),   # 丁
    ("天貴", "紅鸞", "天印", "天虛"),   # 戊
    ("文昌", "天貴", "天壽", "天刑"),   # 己
    ("天壽", "文昌", "天福", "天祿"),   # 庚
    ("天庫", "天壽", "天刑", "文昌"),   # 辛
    ("天印", "紫微", "天祿", "天貫"),   # 壬
    ("天空", "天庫", "紅鸞", "天貴"),   # 癸
]

# ============================================================
# 策天飛星飛化規則 (Flying Star Flight Rules)
# ============================================================
# 每顆星的飛化目標宮偏移（星飛入他宮的影響）
CETIAN_FLYING_RULES = {
    "紫微": {"fly_to_offset": 6,  "nature": "帝星飛化，主權貴變動"},
    "天虛": {"fly_to_offset": 4,  "nature": "虛星飛化，主虛驚空想"},
    "天貴": {"fly_to_offset": 8,  "nature": "貴星飛化，主貴人助力"},
    "天印": {"fly_to_offset": 3,  "nature": "印星飛化，主文書印信"},
    "天壽": {"fly_to_offset": 9,  "nature": "壽星飛化，主壽元福澤"},
    "天空": {"fly_to_offset": 7,  "nature": "空星飛化，主落空虛耗"},
    "紅鸞": {"fly_to_offset": 2,  "nature": "鸞星飛化，主婚姻喜慶"},
    "天庫": {"fly_to_offset": 10, "nature": "庫星飛化，主財庫聚散"},
    "天貫": {"fly_to_offset": 5,  "nature": "貫星飛化，主官運仕途"},
    "文昌": {"fly_to_offset": 1,  "nature": "昌星飛化，主文學才華"},
    "天福": {"fly_to_offset": 11, "nature": "福星飛化，主福德享受"},
    "天祿": {"fly_to_offset": 8,  "nature": "祿星飛化，主祿位進退"},
    "天杖": {"fly_to_offset": 3,  "nature": "杖星飛化，主權杖威嚴"},
    "天異": {"fly_to_offset": 6,  "nature": "異星飛化，主異變奇遇"},
    "毛頭": {"fly_to_offset": 9,  "nature": "旄星飛化，主旗鼓先鋒"},
    "天刃": {"fly_to_offset": 7,  "nature": "刃星飛化，主刀兵刑傷"},
    "天刑": {"fly_to_offset": 4,  "nature": "刑星飛化，主刑罰訴訟"},
    "天姚": {"fly_to_offset": 2,  "nature": "姚星飛化，主桃花風流"},
    "天哭": {"fly_to_offset": 10, "nature": "哭星飛化，主哭泣喪服"},
}

# ============================================================
# 節氣 (Solar Terms) — 僅保留節氣名與黃經度數(真實天文)。
# 原「每節氣配星感傷詩」(如「寒露:寒起,天哭星感傷")全書零依據,係臆造,已刪。
# ============================================================
CETIAN_SOLAR_TERMS = {
    "立春": 315.0, "雨水": 330.0, "驚蟄": 345.0, "春分": 0.0,
    "清明": 15.0, "穀雨": 30.0, "立夏": 45.0, "小滿": 60.0,
    "芒種": 75.0, "夏至": 90.0, "小暑": 105.0, "大暑": 120.0,
    "立秋": 135.0, "處暑": 150.0, "白露": 165.0, "秋分": 180.0,
    "寒露": 195.0, "霜降": 210.0, "立冬": 225.0, "小雪": 240.0,
    "大雪": 255.0, "冬至": 270.0, "小寒": 285.0, "大寒": 300.0,
}

# ============================================================
# 古法格局 (Ce Tian Classical Patterns)
# ============================================================
CETIAN_PATTERNS = {
    "刑刃合會": {
        "stars": ["天刑", "天刃"],
        "condition": "同宮或對宮",
        "meaning": "主刑傷血光，宜慎防意外",
        "meaning_en": "Blade & Punishment together: risk of injury or legal trouble",
    },
    "哭姚交會": {
        "stars": ["天哭", "天姚"],
        "condition": "同宮或三合",
        "meaning": "主感情波折，喜中帶悲",
        "meaning_en": "Crying & Peach Blossom: emotional turbulence",
    },
    "紫貴同宮": {
        "stars": ["紫微", "天貴"],
        "condition": "同宮",
        "meaning": "帝座逢貴，大吉大利，權貴雙全",
        "meaning_en": "Emperor meets Noble: great fortune and authority",
    },
    "祿福相照": {
        "stars": ["天祿", "天福"],
        "condition": "對宮或三合",
        "meaning": "祿逢福德，衣食無憂，一生順遂",
        "meaning_en": "Prosperity meets Blessing: lifelong comfort",
    },
    "空虛對照": {
        "stars": ["天空", "天虛"],
        "condition": "同宮或對宮",
        "meaning": "虛空交會，多幻想而少實際",
        "meaning_en": "Void meets Empty: fantasy over reality",
    },
    "鸞印會合": {
        "stars": ["紅鸞", "天印"],
        "condition": "同宮或三合",
        "meaning": "婚姻有官印護持，佳偶天成",
        "meaning_en": "Phoenix & Seal: blessed marriage with authority backing",
    },
    "刑哭夾命": {
        "stars": ["天刑", "天哭"],
        "condition": "夾命宮",
        "meaning": "命宮受夾，幼年多災，宜行善積德",
        "meaning_en": "Punishment & Crying flanking Life: childhood hardship",
    },
    "昌貫文華": {
        "stars": ["文昌", "天貫"],
        "condition": "同宮",
        "meaning": "文昌逢官，科甲連登，文采斐然",
        "meaning_en": "Literary star meets Official: academic excellence",
    },
}

# ============================================================
# 星曜屬性 (Ce Tian Star Attributes)
# ============================================================
# 五行依《十八飛星策天紫微斗數》卷一「十八星所屬」五行訣(page47)為準:
# 「哭刃鸞金火是刑,紫文杖禄木成林,毛姚虛水貴福土,印壽庫貫異土同」——
# 金=天哭/天刃/紅鸞, 火=天刑, 木=紫微/文昌/天杖/天祿, 水=毛頭(毛頭)/天姚/天虛,
# 土=天貴/天福/天印/天壽/天庫/天貫/天異。天空書中未歸五行(此處留「火」僅作配色,不作論斷)。
# (紅鸞 page13「五行分類」表作陰水,但 page5/page47 五行訣/page51 本星節「紅鸞屬金」三處作金,從金。)
CETIAN_STAR_ATTRIBUTES = {
    "紫微": ("木", "帝星",   "#C62828"),
    "天虛": ("水", "虛星",   "#78909C"),
    "天貴": ("土", "貴星",   "#FFD700"),
    "天印": ("土", "印星",   "#2E7D32"),
    "天壽": ("土", "壽星",   "#8D6E63"),
    "天空": ("火", "空星",   "#90A4AE"),
    "紅鸞": ("金", "鸞星",   "#E91E63"),
    "天庫": ("土", "庫星",   "#F9A825"),
    "天貫": ("土", "官星",   "#1565C0"),
    "文昌": ("木", "文星",   "#7B1FA2"),
    "天福": ("土", "福星",   "#00897B"),
    "天祿": ("木", "祿星",   "#4CAF50"),
    "天杖": ("木", "杖星",   "#6D4C41"),
    "天異": ("土", "異星",   "#FF5722"),
    "毛頭": ("水", "旄星",   "#FF9800"),
    "天刃": ("金", "刃星",   "#D32F2F"),
    "天刑": ("火", "刑星",   "#B71C1C"),
    "天姚": ("水", "姚星",   "#E040FB"),
    "天哭": ("金", "哭星",   "#546E7A"),
}

# 星曜亮度表 依《十八飛星策天紫微斗數》卷三「諸星入廟樂旺詩訣」(page112)逐宮錄入。
# 結構: {星名: {地支索引: "廟"|"旺"|"樂"}}; 某星於某宮無廟旺樂者「不寫」(查無即無亮度)。
# 地支索引: 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11。
# (原為臆造數值表 0-6,無書面依據,已全數替換。毛頭即毛頭。)
CETIAN_BRIGHTNESS_TABLE = {
    "紫微": {5: "廟", 9: "廟", 0: "旺", 8: "樂", 11: "樂"},
    "天虛": {6: "廟", 1: "旺"},
    "天貴": {4: "廟", 2: "旺", 8: "旺"},
    "天印": {0: "廟", 3: "旺", 4: "旺", 11: "樂"},
    "天壽": {11: "廟", 2: "旺", 9: "旺"},
    "天空": {},
    "紅鸞": {1: "廟", 2: "旺", 4: "旺", 11: "旺", 3: "樂"},
    "天庫": {5: "廟", 6: "廟", 11: "旺", 3: "樂", 7: "樂"},
    "天貫": {7: "廟", 5: "旺", 11: "旺", 3: "樂", 6: "樂"},
    "文昌": {2: "廟", 6: "旺"},
    "天福": {3: "廟", 2: "旺", 8: "旺", 10: "旺", 5: "樂"},
    "天祿": {8: "廟", 2: "旺", 3: "旺", 5: "旺"},
    "天杖": {0: "廟", 8: "廟", 11: "廟", 7: "旺"},
    "天異": {1: "廟", 7: "廟", 4: "樂"},
    "毛頭": {0: "廟", 3: "廟", 2: "旺", 7: "旺", 10: "旺"},
    "天刃": {5: "廟", 8: "廟", 2: "旺", 6: "旺", 9: "旺"},
    "天刑": {2: "廟", 10: "廟", 9: "旺", 6: "樂"},
    "天姚": {3: "廟", 10: "廟", 4: "旺", 11: "樂"},
    "天哭": {1: "廟", 6: "廟", 8: "廟", 3: "旺"},
}

# 廟旺表·移語本口徑 依道藏系策天古籍《正命二十八宿移語》「諸星格」十九格逐星廟旺標注錄入。
# 該書「廟旺圖」總表與諸星格分星標注偶有出入,以諸星格(逐星專論,有得地/失地文字互證)為準;
# 廟旺圖全表另收入典籍資料層。與《十八飛星策天紫微斗數全集》卷三詩訣口徑(上表)為兩古籍
# 分歧,由左欄「廟旺口徑」選項切換,默認移語本。值可為雙標(如文昌午「廟旺」),照錄。
# 存疑處如實注:天姚格戌位原書作「虛廟」,按十二支序位認作戌廟;天貴格午位標「貴」非廟旺樂,不錄。
CETIAN_BRIGHTNESS_TABLE_YIYU = {
    "紫微": {0: "旺", 5: "廟", 8: "樂", 9: "廟", 11: "樂"},
    "天虛": {1: "廟", 6: "廟", 7: "樂", 8: "廟", 9: "廟"},
    "天貴": {0: "廟", 2: "廟", 3: "廟", 4: "廟", 5: "廟", 8: "廟", 11: "廟"},
    "天印": {0: "廟", 3: "廟", 4: "廟", 9: "廟", 11: "廟"},
    "天壽": {2: "廟", 9: "廟"},
    "天空": {0: "廟", 1: "廟", 3: "廟", 4: "廟", 6: "廟", 7: "廟", 8: "廟", 9: "廟", 10: "廟", 11: "廟"},
    "紅鸞": {1: "廟", 2: "廟", 3: "廟", 4: "廟", 11: "旺"},
    "天庫": {3: "樂", 5: "廟", 6: "廟", 7: "樂", 11: "旺"},
    "天貫": {3: "樂", 5: "旺", 6: "樂", 7: "廟", 11: "旺"},
    "文昌": {2: "廟", 6: "廟旺", 10: "廟"},
    "天福": {2: "旺", 3: "廟", 5: "樂", 6: "廟", 8: "廟"},
    "天祿": {2: "廟", 3: "旺", 5: "旺", 8: "廟", 10: "廟"},
    "天杖": {0: "廟旺", 1: "廟旺", 7: "廟旺", 8: "廟旺", 11: "廟旺"},
    "天異": {1: "廟", 2: "樂", 4: "樂", 5: "樂", 8: "旺"},
    "毛頭": {0: "廟旺", 2: "廟旺", 3: "廟旺", 7: "旺", 10: "廟旺"},
    "天刃": {2: "廟", 5: "廟", 6: "廟", 8: "廟", 9: "廟"},
    "天刑": {2: "廟", 3: "廟", 6: "廟旺", 9: "廟", 10: "廟"},
    "天姚": {3: "廟", 4: "廟", 10: "廟", 11: "廟"},
    "天哭": {1: "廟", 3: "廟", 4: "廟", 8: "廟"},
}

# 十九星志·移語本(阴阳/別名/得地宮/失地化名/統屬小星)。五行不在此表(仍以
# CETIAN_STAR_ATTRIBUTES 為準,兩書口徑一致,零回歸)。統屬含原文版與整理修正版兩套。
CETIAN_STAR_LORE = {
    "紫微": {"yinyang": "陽", "aliases": ["龍德"], "dedi": [0, 5, 8, 9, 11], "dedi_note": "入子巳申酉亥名為登殿",
             "shidi": "", "subordinates": ["孤神", "尚文", "天赦", "驲馬", "龍德", "南極"],
             "subordinates_rev": ["孤神", "驲馬", "龍德", "玉堂", "天厄"]},
    "天虛": {"yinyang": "陰", "aliases": ["積尸", "玉堂(丑午申)"], "dedi": [1, 6, 8], "dedi_note": "入丑午申號曰玉堂星",
             "shidi": "歲破", "subordinates": ["積尸"], "subordinates_rev": ["歲破"]},
    "天貴": {"yinyang": "陰", "aliases": ["太乙星"], "dedi": [2, 3, 4, 5, 8, 11], "dedi_note": "入寅卯辰巳申亥拜相封侯",
             "shidi": "病符煞星", "subordinates": ["病符"], "subordinates_rev": ["三公", "軒昂"]},
    "天印": {"yinyang": "陽", "aliases": ["天符帝星"], "dedi": [0, 3, 4, 11], "dedi_note": "在子辰卯亥主威權",
             "shidi": "官符元神", "subordinates": ["官符", "天弁", "天廪", "天符"],
             "subordinates_rev": ["官符", "天弁", "天符"]},
    "天壽": {"yinyang": "陽", "aliases": ["歲星", "南極老人星"], "dedi": [2, 3, 9, 11], "dedi_note": "入亥酉卯寅大吉,主長壽主田莊",
             "shidi": "太陰星", "subordinates": ["六害", "寶藏"], "subordinates_rev": ["六害", "南極", "尚文", "天梁"]},
    "天空": {"yinyang": "陽", "aliases": ["天危星"], "dedi": [3, 4, 8, 9, 10, 11], "dedi_note": "入卯辰申酉戌亥宮為吉",
             "shidi": "空亡·斷橋·喪門", "subordinates": ["空亡", "嗣管", "天狗", "玉堂", "歲破", "天厄", "斷橋", "喪門", "科名"],
             "subordinates_rev": ["空亡", "嗣管", "斷橋", "喪門"]},
    "紅鸞": {"yinyang": "陰", "aliases": ["御女", "六合喜神"], "dedi": [1, 2, 3, 4], "dedi_note": "入丑寅卯辰旌節廟廊",
             "shidi": "計都星", "subordinates": ["計都", "三公", "御女"], "subordinates_rev": ["計都", "御女"]},
    "天庫": {"yinyang": "陽", "aliases": ["天弁"], "dedi": [3, 5, 6, 7, 11], "dedi_note": "居卯巳午未亥位得地",
             "shidi": "太歲", "subordinates": ["太歲"], "subordinates_rev": ["太歲", "天廪"]},
    "天貫": {"yinyang": "陰", "aliases": ["寶藏"], "dedi": [3, 5, 6, 7, 11], "dedi_note": "在未卯巳午亥為得地;吉為寶藏天赦,凶為長繩勾絞",
             "shidi": "病符", "subordinates": ["勾絞", "天厨"], "subordinates_rev": ["病符", "勾絞", "寶藏", "天赦"]},
    "文昌": {"yinyang": "陽", "aliases": ["副館", "天文"], "dedi": [2, 6, 10], "dedi_note": "寅午戌三宮為得地,科甲之宿",
             "shidi": "吊客", "subordinates": ["吊客"], "subordinates_rev": ["吊客", "天狗", "天魁", "科名"]},
    "天福": {"yinyang": "陽", "aliases": ["三公"], "dedi": [2, 3, 5, 6, 8, 10], "dedi_note": "入寅午戌卯巳申為吉,失地亦不至凶",
             "shidi": "", "subordinates": [], "subordinates_rev": ["天厨", "卷舌", "六合", "喜神"]},
    "天祿": {"yinyang": "陽", "aliases": ["祿元星", "天廪星", "天厨星", "天財星"], "dedi": [2, 3, 5, 6, 8, 10], "dedi_note": "居寅午戌卯巳申為吉",
             "shidi": "白虎", "subordinates": ["白虎"], "subordinates_rev": ["白虎"]},
    "天杖": {"yinyang": "陽", "aliases": ["折威獄星", "天威(入廟)"], "dedi": [0, 1, 7, 8, 11], "dedi_note": "在子申亥丑未凡事稱心,入廟號曰天威主掌兵權",
             "shidi": "", "subordinates": ["天獄", "喜神", "天威", "六合"], "subordinates_rev": ["天獄", "天威"]},
    "天異": {"yinyang": "陰", "aliases": ["天佚"], "dedi": [1, 2, 4, 7, 10], "dedi_note": "入丑寅辰未戌博學多藝,司怪戾天地日月之變",
             "shidi": "", "subordinates": ["天使", "司危"], "subordinates_rev": ["司怪"]},
    "毛頭": {"yinyang": "陰", "aliases": ["司危", "孛星"], "dedi": [0, 2, 3, 7, 10], "dedi_note": "入子卯寅未戌為得地,英雄掣電",
             "shidi": "破耗之宿", "subordinates": ["孛星", "天狼", "天梁", "羅睺"],
             "subordinates_rev": ["孛星", "天狼", "羅睺", "天慧"]},
    "天刃": {"yinyang": "陰", "aliases": ["羊刃天根"], "dedi": [2, 5, 6, 8], "dedi_note": "入寅午巳申乃稱威重,主陰惡殺伐之權",
             "shidi": "", "subordinates": ["殺伐"], "subordinates_rev": ["殺伐", "積尸"]},
    "天刑": {"yinyang": "陰", "aliases": ["軒昂", "權星", "天梁星", "天藻星(寅午戌酉廟地)"], "dedi": [2, 6, 9, 10], "dedi_note": "入寅午戌酉廟地為天藻星",
             "shidi": "", "subordinates": ["司怪"], "subordinates_rev": ["天使", "司危"]},
    "天姚": {"yinyang": "陽", "aliases": ["天慧", "桃花煞"], "dedi": [2, 3, 4, 10, 11], "dedi_note": "居亥位主風流才子,入寅卯辰戌宮主得陰人之喜",
             "shidi": "", "subordinates": ["姚花", "天慧"], "subordinates_rev": ["桃花"]},
    "天哭": {"yinyang": "陰", "aliases": ["天鬼孤星", "卷舌"], "dedi": [1, 3, 6, 8], "dedi_note": "入丑卯午申反悲作喜化凶為吉",
             "shidi": "披麻哭泣之憂", "subordinates": ["孤星", "軒昂", "天魁", "卷舌"], "subordinates_rev": ["孤星"]},
}

# 原法(標準南派)亮度數值表 + 標籤——僅供左欄「原法」選項使用(非本書,係改寫前舊表)。
CETIAN_BRIGHTNESS_TABLE_CLASSIC = {
    "紫微": [5, 6, 1, 4, 1, 6, 5, 5, 5, 2, 6, 4],
    "天虛": [2, 1, 4, 5, 3, 2, 4, 6, 5, 3, 1, 2],
    "天貴": [6, 5, 3, 2, 5, 6, 4, 3, 6, 5, 2, 4],
    "天印": [4, 6, 5, 6, 2, 1, 4, 6, 5, 6, 2, 1],
    "天壽": [5, 4, 6, 3, 5, 4, 6, 3, 5, 4, 6, 3],
    "天空": [1, 2, 3, 4, 2, 1, 3, 4, 2, 1, 3, 4],
    "紅鸞": [6, 5, 4, 6, 5, 4, 6, 5, 4, 6, 5, 4],
    "天庫": [5, 6, 4, 3, 6, 5, 4, 3, 6, 5, 4, 3],
    "天貫": [4, 5, 6, 2, 4, 5, 6, 2, 4, 5, 6, 2],
    "文昌": [4, 6, 5, 2, 4, 6, 4, 0, 4, 6, 5, 4],
    "天福": [6, 4, 5, 3, 6, 4, 5, 3, 6, 4, 5, 3],
    "天祿": [5, 3, 6, 4, 5, 3, 6, 4, 5, 3, 6, 4],
}
CETIAN_BRIGHTNESS_LABELS = {6: "廟", 5: "旺", 4: "得", 3: "利", 2: "平", 1: "不", 0: "陷"}

# 原法(標準南派)節氣感傷詩——僅供左欄「原法」選項使用(非本書)。
CLASSIC_SOLAR_POEM = {
    "立春": "春始，紫微星得令", "雨水": "水潤，天壽星增輝", "驚蟄": "雷動，天刑星活躍",
    "春分": "晝夜均，諸星平衡", "清明": "天清，文昌星得力", "穀雨": "雨生，天福星蔭庇",
    "立夏": "夏始，紅鸞星當旺", "小滿": "陽盛，天貫星通達", "芒種": "種收，天祿星聚財",
    "夏至": "陽極，天貴星顯達", "小暑": "暑起，天姚星躁動", "大暑": "暑盛，天空星虛耗",
    "立秋": "秋始，天庫星收藏", "處暑": "暑退，天印星安穩", "白露": "露凝，天虛星清冷",
    "秋分": "晝夜均，諸星平衡", "寒露": "寒起，天哭星感傷", "霜降": "霜至，天刃星肅殺",
    "立冬": "冬始，天異星潛藏", "小雪": "雪初，天杖星沉穩", "大雪": "雪盛，天壽星寧靜",
    "冬至": "陰極，紫微星轉運", "小寒": "寒甚，毛頭星堅守", "大寒": "極寒，天空星蟄伏",
}

# 農曆新年公曆日期查找表 1900–2050（月, 日）
_CHINESE_NEW_YEAR: dict[int, tuple[int, int]] = {
    1900: (1, 31), 1901: (2, 19), 1902: (2,  8), 1903: (1, 29), 1904: (2, 16),
    1905: (2,  4), 1906: (1, 25), 1907: (2, 13), 1908: (2,  2), 1909: (1, 22),
    1910: (2, 10), 1911: (1, 30), 1912: (2, 18), 1913: (2,  6), 1914: (1, 26),
    1915: (2, 14), 1916: (2,  3), 1917: (1, 23), 1918: (2, 11), 1919: (2,  1),
    1920: (2, 20), 1921: (2,  8), 1922: (1, 28), 1923: (2, 16), 1924: (2,  5),
    1925: (1, 25), 1926: (2, 13), 1927: (2,  2), 1928: (1, 23), 1929: (2, 10),
    1930: (1, 30), 1931: (2, 17), 1932: (2,  6), 1933: (1, 26), 1934: (2, 14),
    1935: (2,  4), 1936: (1, 24), 1937: (2, 11), 1938: (1, 31), 1939: (2, 19),
    1940: (2,  8), 1941: (1, 27), 1942: (2, 15), 1943: (2,  5), 1944: (1, 25),
    1945: (2, 13), 1946: (2,  2), 1947: (1, 22), 1948: (2, 10), 1949: (1, 29),
    1950: (2, 17), 1951: (2,  6), 1952: (1, 27), 1953: (2, 14), 1954: (2,  3),
    1955: (1, 24), 1956: (2, 12), 1957: (1, 31), 1958: (2, 18), 1959: (2,  8),
    1960: (1, 28), 1961: (2, 15), 1962: (2,  5), 1963: (1, 25), 1964: (2, 13),
    1965: (2,  2), 1966: (1, 21), 1967: (2,  9), 1968: (1, 30), 1969: (2, 17),
    1970: (2,  6), 1971: (1, 27), 1972: (2, 15), 1973: (2,  3), 1974: (1, 23),
    1975: (2, 11), 1976: (1, 31), 1977: (2, 18), 1978: (2,  7), 1979: (1, 28),
    1980: (2, 16), 1981: (2,  5), 1982: (1, 25), 1983: (2, 13), 1984: (2,  2),
    1985: (2, 20), 1986: (2,  9), 1987: (1, 29), 1988: (2, 17), 1989: (2,  6),
    1990: (1, 27), 1991: (2, 15), 1992: (2,  4), 1993: (1, 23), 1994: (2, 10),
    1995: (1, 31), 1996: (2, 19), 1997: (2,  7), 1998: (1, 28), 1999: (2, 16),
    2000: (2,  5), 2001: (1, 24), 2002: (2, 12), 2003: (2,  1), 2004: (1, 22),
    2005: (2,  9), 2006: (1, 29), 2007: (2, 18), 2008: (2,  7), 2009: (1, 26),
    2010: (2, 14), 2011: (2,  3), 2012: (1, 23), 2013: (2, 10), 2014: (1, 31),
    2015: (2, 19), 2016: (2,  8), 2017: (1, 28), 2018: (2, 16), 2019: (2,  5),
    2020: (1, 25), 2021: (2, 12), 2022: (2,  1), 2023: (1, 22), 2024: (2, 10),
    2025: (1, 29), 2026: (2, 17), 2027: (2,  6), 2028: (1, 26), 2029: (2, 13),
    2030: (2,  3), 2031: (1, 23), 2032: (2, 11), 2033: (1, 31), 2034: (2, 19),
    2035: (2,  8), 2036: (1, 28), 2037: (2, 15), 2038: (2,  4), 2039: (1, 24),
    2040: (2, 12), 2041: (2,  1), 2042: (1, 22), 2043: (2, 10), 2044: (1, 30),
    2045: (2, 17), 2046: (2,  6), 2047: (1, 26), 2048: (2, 14), 2049: (2,  2),
    2050: (1, 23),
}

_SYNODIC_MONTH = 29.5305891
_CST_OFFSET = 8.0 / 24.0

# ============================================================
# 資料類 (Data Classes)
# ============================================================

@dataclass
class CetianPalace:
    """策天十八飛星宮位資料"""
    index: int                      # 宮位序號 0-11（從命宮算起）
    name: str                       # 宮位名稱
    branch: int                     # 地支索引 0-11（子=0）
    branch_name: str                # 地支名稱
    stem: int                       # 天干索引 0-9
    stem_name: str                  # 天干名稱
    stars: list = field(default_factory=list)       # 正曜名稱
    aux_stars: list = field(default_factory=list)   # 副曜名稱
    brightness: dict = field(default_factory=dict)  # {星名: 亮度標籤}
    sihua: dict = field(default_factory=dict)       # {星名: 四化類型}
    da_xian: str = ""               # 大限年齡範圍 e.g. "3~12"
    da_xian_start: int = 0          # 大限起始年齡
    flying_stars: dict = field(default_factory=dict)  # 飛星資訊 {星名: 飛入宮位}
    patterns: list = field(default_factory=list)      # 古法格局名稱


@dataclass
class CetianChart:
    """策天十八飛星命盤資料"""
    year: int
    month: int
    day: int
    hour: int
    minute: int
    timezone: float
    latitude: float
    longitude: float
    location_name: str
    julian_day: float
    gender: str                    # "男" or "女"

    # 農曆資訊
    lunar_year: int
    lunar_month: int
    lunar_day: int
    is_leap_month: bool
    lunar_year_stem: int           # 天干索引
    lunar_year_branch: int         # 地支索引

    # 時辰
    hour_branch: int               # 0-11

    # 命盤關鍵資訊
    ming_gong_branch: int          # 命宮地支索引
    shen_gong_branch: int          # 身宮地支索引
    wu_xing_ju: int                # 五行局（2-6）
    ziwei_branch: int              # 紫微星地支索引
    yin_yang: str                  # "陰" or "陽"

    # 四化
    sihua: dict = field(default_factory=dict)  # {星名: 四化類型}

    # 宮位資料
    palaces: list = field(default_factory=list)  # List[CetianPalace]

    # 飛星總表
    star_flight: dict = field(default_factory=dict)  # {星名: {from_branch, to_branch, nature}}

    # 節氣影響
    solar_term_influence: str = ""

    # 三合組
    sanhe_groups: list = field(default_factory=list)

    # 格局
    active_patterns: list = field(default_factory=list)

    # 排盤方法:'book'(策天本法,默認) | 'kentang'(原標準紫微嫁接法);及原法子選項回顯
    method: str = "book"
    lunar_mode: str = "sxtwl"       # 'sxtwl'(修正) | 'classic'(原閏月法)
    star_order: str = "reverse"     # 'reverse'(逆布,書) | 'forward'(順布,原)
    # 書法口徑選項回顯(移語本補齊,僅 book 法生效)
    shen_gong_mode: str = "yizheng"     # 'yizheng'(引證圖口徑,默認) | 'literal'(正文直讀)
    daxian_mode: str = "yiyu"           # 'yiyu'(陽年從命/陰年從身,默認) | 'legacy'(順從命/逆從身)
    brightness_school: str = "yiyu"     # 'yiyu'(移語本諸星格,默認) | 'quanji'(全集本卷三詩訣)


# ============================================================
# 輔助函數 (Helper Functions)
# ============================================================

def _normalize(deg: float) -> float:
    return deg % 360.0


def _get_hour_branch(hour: int, minute: int) -> int:
    """
    根據出生時間取得時辰地支索引（子=0, 丑=1, ..., 亥=11）。
    子時跨越午夜：23:00-01:00 為子時。
    """
    total_minutes = hour * 60 + minute
    if total_minutes < 60 or total_minutes >= 23 * 60:
        return 0
    return (total_minutes + 60) // 120


def _find_new_moon_near(jd_approx: float) -> float:
    """以迭代法找出最接近 jd_approx 的朔（新月）Julian Day。"""
    jd = jd_approx
    for _ in range(50):
        sun_lon = _normalize(swe.calc_ut(jd, swe.SUN)[0][0])
        moon_lon = _normalize(swe.calc_ut(jd, swe.MOON)[0][0])
        diff = moon_lon - sun_lon
        if diff > 180:
            diff -= 360.0
        elif diff < -180:
            diff += 360.0
        correction = diff / (360.0 / _SYNODIC_MONTH)
        jd -= correction
        if abs(diff) < 0.0001:
            break
    return jd


def _get_cny_jd(year: int) -> float:
    """取得農曆新年的 Julian Day。"""
    if year in _CHINESE_NEW_YEAR:
        m, d = _CHINESE_NEW_YEAR[year]
        return swe.julday(year, m, d, 12.0)
    if year < 1900:
        m, d = _CHINESE_NEW_YEAR[1900]
        base_jd = swe.julday(1900, m, d, 12.0)
        return base_jd - (1900 - year) * 365.2425
    m, d = _CHINESE_NEW_YEAR[2050]
    base_jd = swe.julday(2050, m, d, 12.0)
    return base_jd + (year - 2050) * 365.2425


def _solar_to_lunar(jd: float) -> tuple[int, int, int, bool]:
    """將 Julian Day 轉換為農曆日期。"""
    gd = swe.revjul(jd)
    gy = int(gd[0])
    cny_this = _get_cny_jd(gy)
    if jd < cny_this:
        lunar_year = gy - 1
        cny_jd = _get_cny_jd(gy - 1)
    else:
        lunar_year = gy
        cny_jd = cny_this

    nm_start = _find_new_moon_near(cny_jd)
    while nm_start > cny_jd + 1.0:
        nm_start = _find_new_moon_near(nm_start - _SYNODIC_MONTH)

    month = 0
    prev_nm = nm_start
    next_nm = _find_new_moon_near(nm_start + _SYNODIC_MONTH)
    is_leap = False

    for m in range(14):
        if next_nm > jd:
            month = m + 1
            break
        prev_nm = next_nm
        next_nm = _find_new_moon_near(prev_nm + _SYNODIC_MONTH)
    else:
        month = 1

    nm_cal_day = math.floor(prev_nm + _CST_OFFSET + 0.5)
    jd_cal_day = math.floor(jd + _CST_OFFSET + 0.5)
    lunar_day = jd_cal_day - nm_cal_day + 1
    lunar_day = max(1, min(lunar_day, 30))

    if month > 12:
        is_leap = True
        month = month - 12

    return lunar_year, month, lunar_day, is_leap


def _solar_to_lunar_accurate(year: int, month: int, day: int, jd_fallback: float) -> tuple[int, int, int, bool]:
    """公曆→農曆:用 sxtwl(壽星天文曆)精確換算,正確處理閏月;sxtwl 不可用時回退舊朔望月法。

    舊 _solar_to_lunar 自閏正月起線性數朔望月、不辨閏月,凡該年有閏月者其後各月皆 +1 偏移
    (例:2006 閏七月,公曆 2006-10-04 實為農曆八月十三,舊法誤判九月)。
    """
    try:
        import sxtwl
        d = sxtwl.fromSolar(year, month, day)
        return int(d.getLunarYear()), int(d.getLunarMonth()), int(d.getLunarDay()), bool(d.isLunarLeap())
    except Exception:
        return _solar_to_lunar(jd_fallback)


def _get_year_stem(lunar_year: int) -> int:
    return (lunar_year - 4) % 10


def _get_year_branch(lunar_year: int) -> int:
    return (lunar_year - 4) % 12


def _get_ming_gong_branch(lunar_month: int, hour_branch: int) -> int:
    return (1 + lunar_month - hour_branch) % 12


def _get_shen_gong_branch(lunar_month: int, hour_branch: int) -> int:
    return (1 + lunar_month + hour_branch) % 12


def _get_ming_gong_stem(year_stem: int, ming_gong_branch: int) -> int:
    yin_stem = (2 * (year_stem % 5) + 2) % 10
    steps = (ming_gong_branch - 2 + 12) % 12
    return (yin_stem + steps) % 10


def _get_wu_xing_ju(ming_gong_stem: int, ming_gong_branch: int) -> int:
    sexagenary = (6 * ming_gong_stem - 5 * ming_gong_branch) % 60
    pair_idx = sexagenary // 2
    return NAYIN_WUXING_JU[pair_idx]


def _get_ziwei_branch(lunar_day: int, wu_xing_ju: int) -> int:
    """由農曆生日與五行局計算紫微星所在地支索引。"""
    n = wu_xing_ju
    q, r = divmod(lunar_day, n)
    if r == 0:
        return q % 12
    return (q + 3 - r) % 12


def _get_solar_term(jd: float) -> str:
    """計算出生時刻所處的節氣。"""
    sun_lon = _normalize(swe.calc_ut(jd, swe.SUN)[0][0])
    closest_term = ""
    min_diff = 999.0
    for term_name, term_lon in CETIAN_SOLAR_TERMS.items():
        diff = abs(sun_lon - term_lon)
        if diff > 180:
            diff = 360 - diff
        if diff < min_diff:
            min_diff = diff
            closest_term = term_name
    return closest_term


# ============================================================
# 安星函數 (Star Placement)
# ============================================================

def _place_cetian_main_stars(ziwei_branch: int, reverse: bool = True) -> dict[int, list[str]]:
    """
    計算策天十二正曜的地支索引。
    依《十八飛星策天紫微斗數》安星訣(卷一):「從未上起子,順數至生年安紫微,逆布
    虛貴印壽空鸞庫貫文福祿」—— 紫微之後諸正曜【逆布】(每宮一顆,逆時針),由紫微位置【減】offset。
    reverse=True:逆布(書,默認);reverse=False:順布(原 kentang 舊法,+offset),供左欄「原法·順布」選項。
    """
    stars: dict[int, list[str]] = {i: [] for i in range(12)}
    for name, offset in CETIAN_MAIN_OFFSETS.items():
        b = (ziwei_branch - offset) % 12 if reverse else (ziwei_branch + offset) % 12
        stars[b].append(name)
    return stars


def _place_cetian_aux_stars(
    year_branch: int, lunar_month: int, hour_branch: int,
) -> dict[int, list[str]]:
    """
    計算策天七副曜的地支索引。
    """
    aux: dict[int, list[str]] = {i: [] for i in range(12)}

    # 依《十八飛星策天紫微斗數》安星訣(卷一):天杖子上起正月逆數至生月,異/毛/刃由杖逆布;
    # 天刑酉上起正月順至生月、天姚丑上起正月順至生月;天哭取生年支之六合。
    # (原:年支起子/丑、月起寅、時起卯、年支起午 — 除刑/姚外皆誤,故重寫)

    # 天杖:子(0)起正月,逆數至生月
    tian_zhang = (1 - lunar_month) % 12
    aux[tian_zhang].append("天杖")

    # 天異:由天杖逆布一宮
    aux[(tian_zhang - 1) % 12].append("天異")

    # 毛頭:由天杖逆布二宮
    aux[(tian_zhang - 2) % 12].append("毛頭")

    # 天刃:由天杖逆布三宮
    aux[(tian_zhang - 3) % 12].append("天刃")

    # 天刑:酉(9)起正月,順數至生月
    aux[(8 + lunar_month) % 12].append("天刑")

    # 天姚:丑(1)起正月,順數至生月
    aux[(lunar_month) % 12].append("天姚")

    # 天哭:生年支之六合(子丑/寅亥/卯戌/辰酉/巳申/午未)
    aux[(13 - year_branch) % 12].append("天哭")

    return aux


def _compute_cetian_sihua(year_stem: int) -> dict[str, str]:
    """計算策天四化（年干決定）。"""
    lu, quan, ke, ji = CETIAN_SIHUA_TABLE[year_stem]
    return {lu: "祿", quan: "權", ke: "科", ji: "忌"}


def _compute_sanhe_groups(ming_gong_branch: int) -> list[tuple[int, int, int]]:
    """計算三合組。"""
    groups = []
    for start in range(4):
        group = tuple((start + i * 4) % 12 for i in range(3))
        groups.append(group)
    return groups


def _compute_star_flights(
    stars_by_branch: dict[int, list[str]],
    aux_by_branch: dict[int, list[str]],
) -> dict[str, dict]:
    """
    計算所有飛星的飛化路線。
    Returns {star_name: {from_branch, to_branch, nature}}
    """
    flights = {}
    for branch_idx in range(12):
        all_stars = stars_by_branch.get(branch_idx, []) + aux_by_branch.get(branch_idx, [])
        for star in all_stars:
            rule = CETIAN_FLYING_RULES.get(star)
            if rule:
                to_branch = (branch_idx + rule["fly_to_offset"]) % 12
                flights[star] = {
                    "from_branch": branch_idx,
                    "to_branch": to_branch,
                    "nature": rule["nature"],
                }
    return flights


def _detect_patterns(
    stars_by_branch: dict[int, list[str]],
    aux_by_branch: dict[int, list[str]],
    ming_gong_branch: int,
) -> list[dict]:
    """
    檢測古法格局。
    Returns list of {name, stars, meaning}
    """
    active = []
    # 合併所有星曜到宮位
    all_by_branch: dict[int, list[str]] = {i: [] for i in range(12)}
    for b in range(12):
        all_by_branch[b] = stars_by_branch.get(b, []) + aux_by_branch.get(b, [])

    for pattern_name, pattern_info in CETIAN_PATTERNS.items():
        required_stars = pattern_info["stars"]
        condition = pattern_info["condition"]

        if "同宮" in condition:
            for b in range(12):
                if all(s in all_by_branch[b] for s in required_stars):
                    active.append({
                        "name": pattern_name,
                        "stars": required_stars,
                        "meaning": pattern_info["meaning"],
                        "palace_branch": b,
                    })
                    break

        if "對宮" in condition and not any(p["name"] == pattern_name for p in active):
            for b in range(12):
                opp = (b + 6) % 12
                stars_here = all_by_branch[b]
                stars_opp = all_by_branch[opp]
                all_combined = stars_here + stars_opp
                if all(s in all_combined for s in required_stars):
                    if not all(s in stars_here for s in required_stars):
                        active.append({
                            "name": pattern_name,
                            "stars": required_stars,
                            "meaning": pattern_info["meaning"],
                            "palace_branch": b,
                        })
                        break

        if "夾命" in condition:
            left = (ming_gong_branch - 1 + 12) % 12
            right = (ming_gong_branch + 1) % 12
            flank_stars = all_by_branch[left] + all_by_branch[right]
            if all(s in flank_stars for s in required_stars):
                active.append({
                    "name": pattern_name,
                    "stars": required_stars,
                    "meaning": pattern_info["meaning"],
                    "palace_branch": ming_gong_branch,
                })

    return active


def _compute_cetian_feixing(palace_stem: int) -> dict[str, str]:
    """計算飛星四化（由宮位天干決定，使用策天四化表）。"""
    lu, quan, ke, ji = CETIAN_SIHUA_TABLE[palace_stem]
    return {lu: "祿", quan: "權", ke: "科", ji: "忌"}


def _build_cetian_palaces(
    method: str,
    ming_gong_branch: int,
    shen_gong_branch: int,
    year_stem: int,
    wu_xing_ju: int,
    stars_by_branch: dict[int, list[str]],
    aux_by_branch: dict[int, list[str]],
    sihua: dict[str, str],
    star_flights: dict[str, dict],
    active_patterns: list[dict],
    is_yang_male_or_yin_female: bool,
    is_yang_year: bool = True,
    daxian_mode: str = "yiyu",
    brightness_school: str = "yiyu",
) -> list[CetianPalace]:
    """建立十二宮位資料(雙法)。
    book(策天本法):書宮序逆轉、無宮干/四化/飛化/格局、亮度按「廟旺樂」表、大限起運一歲。
      廟旺口徑:'yiyu'移語本諸星格(默認)|'quanji'全集本卷三詩訣。
      大限口徑:'yiyu'陽年從命/陰年從身起,陽男陰女順/陰男陽女逆(移語本·立命宮節,默認)
              |'legacy'順行恆從命/逆行恆從身(改寫前舊口徑)。
    kentang(原標準紫微嫁接):南派宮序、五虎遁宮干、數值亮度、四化/飛化/格局、大限五行局起運。
    """
    is_book = method != "kentang"
    seq = PALACE_SEQUENCE_BOOK if is_book else PALACE_SEQUENCE_CLASSIC
    book_brightness = (
        CETIAN_BRIGHTNESS_TABLE if brightness_school == "quanji" else CETIAN_BRIGHTNESS_TABLE_YIYU
    )
    yin_stem = (2 * (year_stem % 5) + 2) % 10  # 五虎遁(原法宮干)
    palaces = []
    for idx in range(12):
        branch = (ming_gong_branch - idx + 12) % 12  # 不論男女俱逆轉
        palace_name = seq[idx]
        all_stars = stars_by_branch.get(branch, []) + aux_by_branch.get(branch, [])

        # 宮干(僅原法)
        if is_book:
            stem, stem_name = 0, ""
        else:
            stem = (yin_stem + (branch - 2 + 12) % 12) % 10
            stem_name = HEAVENLY_STEMS[stem]

        # 亮度
        brightness = {}
        if is_book:
            for star in all_stars:
                label = book_brightness.get(star, {}).get(branch, "")
                if label:
                    brightness[star] = label
        else:
            for star in all_stars:
                if star in CETIAN_BRIGHTNESS_TABLE_CLASSIC:
                    brightness[star] = CETIAN_BRIGHTNESS_LABELS.get(
                        CETIAN_BRIGHTNESS_TABLE_CLASSIC[star][branch], "")

        # 四化 / 飛星 / 格局(僅原法)
        palace_sihua, palace_flights, palace_patterns = {}, {}, []
        if not is_book:
            for star in all_stars:
                if star in sihua:
                    palace_sihua[star] = sihua[star]
                if star in star_flights:
                    palace_flights[star] = EARTHLY_BRANCHES[star_flights[star]["to_branch"]]
            palace_patterns = [p["name"] for p in active_patterns if p.get("palace_branch") == branch]

        # 大限
        if is_book:
            if daxian_mode == "legacy":
                order = (branch - ming_gong_branch + 12) % 12 if is_yang_male_or_yin_female \
                    else (shen_gong_branch - branch + 12) % 12
            else:
                # 移語本·立命宮節:起點=陽年從命宮/陰年從身宮;方向=陽男陰女順行/陰男陽女逆行。
                # 引證圖運限(12歲寅→22丑→32子→42亥→52戌逆行)與此吻合。
                start = ming_gong_branch if is_yang_year else shen_gong_branch
                order = (branch - start + 12) % 12 if is_yang_male_or_yin_female \
                    else (start - branch + 12) % 12
            da_xian_start = 1 + order * 10
        else:
            da_xian_num = ((12 - idx) % 12 if idx > 0 else 0) if is_yang_male_or_yin_female else idx
            da_xian_start = (wu_xing_ju or 2) + da_xian_num * 10

        palaces.append(CetianPalace(
            index=idx, name=palace_name, branch=branch,
            branch_name=EARTHLY_BRANCHES[branch],
            stem=stem, stem_name=stem_name,
            stars=list(stars_by_branch.get(branch, [])),
            aux_stars=list(aux_by_branch.get(branch, [])),
            brightness=brightness, sihua=palace_sihua,
            da_xian=f"{da_xian_start}~{da_xian_start + 9}", da_xian_start=da_xian_start,
            flying_stars=palace_flights, patterns=palace_patterns,
        ))
    return palaces


# ============================================================
# 計算函數 (Computation)
# ============================================================

@st.cache_data(ttl=3600, show_spinner=False)
def compute_cetian_ziwei_chart(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int,
    timezone: float,
    latitude: float,
    longitude: float,
    location_name: str = "",
    gender: str = "男",
    method: str = "book",
    lunar_mode: str = "sxtwl",
    star_order: str = "reverse",
    shen_gong_mode: str = "yizheng",
    daxian_mode: str = "yiyu",
    brightness_school: str = "yiyu",
) -> CetianChart:
    """
    計算策天十八飛星紫微斗數命盤(雙法,由左欄選擇)。

    method='book' 策天本法(默認):天杖法定命身、(7+年支)起紫微、無五行局/宮干/四化/飛化/格局、
      廟旺樂亮度、節氣只取名;固定 sxtwl 農曆 + 正曜逆布。
      書法口徑子選項(移語本補齊):
        shen_gong_mode 身宮取整 'yizheng'引證圖口徑(默認)|'literal'正文直讀;
        daxian_mode 大限起宮 'yiyu'陽年從命/陰年從身(默認)|'legacy'順從命/逆從身;
        brightness_school 廟旺 'yiyu'移語本諸星格(默認)|'quanji'全集本詩訣。
    method='kentang' 原標準紫微嫁接法:五行局/按農曆日起紫微/命寅起月逆/四化/飛化/格局/數值亮度/
      節氣感傷詩/南派宮序;農曆(lunar_mode: sxtwl|classic)與正曜布法(star_order: reverse|forward)
      由左欄子選項決定。書法口徑子選項對原法無效。
    """
    swe.set_ephe_path("")
    is_book = method != "kentang"
    eff_lunar = "sxtwl" if is_book else lunar_mode
    eff_reverse = True if is_book else (star_order != "forward")
    eff_shen_mode = shen_gong_mode if shen_gong_mode == "literal" else "yizheng"
    eff_daxian_mode = daxian_mode if daxian_mode == "legacy" else "yiyu"
    eff_brightness = brightness_school if brightness_school == "quanji" else "yiyu"

    decimal_hour = hour + minute / 60.0 - timezone
    jd = swe.julday(year, month, day, decimal_hour)

    # 農曆:sxtwl(正確閏月,默認/書法固定) 或 原朔望月法(漏閏月致月份偏移,僅原法可選)
    if eff_lunar == "classic":
        lunar_year, lunar_month, lunar_day, is_leap = _solar_to_lunar(jd)
    else:
        lunar_year, lunar_month, lunar_day, is_leap = _solar_to_lunar_accurate(year, month, day, jd)

    hour_branch = _get_hour_branch(hour, minute)
    year_stem = _get_year_stem(lunar_year)
    year_branch = _get_year_branch(lunar_year)

    if is_book:
        # 書法起盤(天杖/年支)
        tian_zhang_branch = (1 - lunar_month) % 12
        ming_gong_branch = (tian_zhang_branch + 3 - hour_branch) % 12          # 安命例 p15
        # 安身:「從杖星處起初一,兩日半行一宮,逆數至生日」——起點與取整兩讀:
        #   兩讀共守原文起點:初一必在杖星宮(偏移 0),分歧只在 2.5 日邊界的歸屬。
        #   yizheng(默認) 引證圖口徑——進一法 ceil((日-1)/2.5):廿七→逆 11 宮→卯,
        #     與引證圖盤面「身」及「格局曰/身宮曰」兩處文字三面互證;初一→偏移 0 亦合原文。
        #   literal 正文直讀——捨去法 floor((日-1)/2.5):廿七→逆 10 宮→辰,改寫前口徑,字節保真。
        #   兩讀逐日只差 0 或 1 宮(邊界日相同)。
        #   🔴 曾誤用 ceil(日/2.5):初一被推到杖星逆一宮、與「起初一」直接抵觸,僅因廿七處
        #     與引證圖巧合相等而未被單點金標咬出(30 日中 12 日落宮偏一位);雙約束(原文起點
        #     + 引證圖)同時鎖定才是真解,故金標必兼測初一錨點。
        offset = int((lunar_day - 1) // 2.5) if eff_shen_mode == "literal" \
            else int(math.ceil((lunar_day - 1) / 2.5))
        shen_gong_branch = (tian_zhang_branch - offset) % 12  # 安身例 p15-16
        ziwei_branch = (7 + year_branch) % 12                                  # 起紫微例 p11/13/14
        wu_xing_ju = 0
    else:
        # 原法起盤(標準南派嫁接:五行局/按農曆日起紫微)
        ming_gong_branch = _get_ming_gong_branch(lunar_month, hour_branch)
        shen_gong_branch = _get_shen_gong_branch(lunar_month, hour_branch)
        mg_stem = _get_ming_gong_stem(year_stem, ming_gong_branch)
        wu_xing_ju = _get_wu_xing_ju(mg_stem, ming_gong_branch)
        ziwei_branch = _get_ziwei_branch(lunar_day, wu_xing_ju)

    # 安星:正曜逆/順布 + 七副曜
    stars_by_branch = _place_cetian_main_stars(ziwei_branch, reverse=eff_reverse)
    aux_by_branch = _place_cetian_aux_stars(year_branch, lunar_month, hour_branch)

    yin_yang = "陽" if year_stem % 2 == 0 else "陰"
    is_yang_male_or_yin_female = (
        (yin_yang == "陽" and gender == "男") or (yin_yang == "陰" and gender == "女")
    )

    # 四化/飛化/格局/節氣詩:僅原法;書法留空+節氣只取名
    if is_book:
        sihua, star_flights, active_patterns = {}, {}, []
        solar_term_influence = _get_solar_term(jd)
    else:
        sihua = _compute_cetian_sihua(year_stem)
        star_flights = _compute_star_flights(stars_by_branch, aux_by_branch)
        active_patterns = _detect_patterns(stars_by_branch, aux_by_branch, ming_gong_branch)
        _term = _get_solar_term(jd)
        solar_term_influence = f"{_term}：{CLASSIC_SOLAR_POEM.get(_term, '')}" if _term else ""

    sanhe_groups = _compute_sanhe_groups(ming_gong_branch)
    palaces = _build_cetian_palaces(
        method, ming_gong_branch, shen_gong_branch, year_stem, wu_xing_ju,
        stars_by_branch, aux_by_branch, sihua, star_flights, active_patterns,
        is_yang_male_or_yin_female,
        is_yang_year=(yin_yang == "陽"),
        daxian_mode=eff_daxian_mode,
        brightness_school=eff_brightness,
    )

    return CetianChart(
        year=year, month=month, day=day, hour=hour, minute=minute,
        timezone=timezone, latitude=latitude, longitude=longitude,
        location_name=location_name, julian_day=jd,
        gender=gender,
        lunar_year=lunar_year, lunar_month=lunar_month, lunar_day=lunar_day,
        is_leap_month=is_leap,
        lunar_year_stem=year_stem, lunar_year_branch=year_branch,
        hour_branch=hour_branch,
        ming_gong_branch=ming_gong_branch, shen_gong_branch=shen_gong_branch,
        wu_xing_ju=wu_xing_ju, ziwei_branch=ziwei_branch,
        yin_yang=yin_yang,
        sihua=sihua, palaces=palaces,
        star_flight=star_flights,
        solar_term_influence=solar_term_influence,
        sanhe_groups=sanhe_groups,
        active_patterns=active_patterns,
        method=method, lunar_mode=eff_lunar,
        star_order=("reverse" if eff_reverse else "forward"),
        shen_gong_mode=(eff_shen_mode if is_book else "yizheng"),
        daxian_mode=(eff_daxian_mode if is_book else "yiyu"),
        brightness_school=(eff_brightness if is_book else "yiyu"),
    )


# ============================================================
# 渲染函數 (Rendering)
# ============================================================

def render_cetian_ziwei_chart(chart: CetianChart, after_chart_hook=None) -> None:
    """渲染完整的策天十八飛星命盤。"""
    st.subheader("🌠 策天十八飛星紫微斗數命盤")
    _render_sihua_legend()
    _render_palace_grid(chart)
    if after_chart_hook:
        after_chart_hook()
    st.divider()
    _render_info(chart)
    st.divider()
    _render_star_table(chart)
    st.divider()
    _render_flying_star_table(chart)
    st.divider()
    _render_feixing_table(chart)
    st.divider()
    _render_patterns(chart)
    st.divider()
    _render_palace_details(chart)


def _render_info(chart: CetianChart) -> None:
    """渲染基本排盤資訊卡片。"""
    leap_str = "閏" if chart.is_leap_month else ""
    lunar_date = (
        f"{chart.lunar_year}年"
        f"（{HEAVENLY_STEMS[chart.lunar_year_stem]}{EARTHLY_BRANCHES[chart.lunar_year_branch]}年）"
        f" {leap_str}{LUNAR_MONTH_NAMES[chart.lunar_month - 1]}"
        f"{_day_to_chinese(chart.lunar_day)}"
    )
    col1, col2, col3 = st.columns(3)
    with col1:
        st.write(f"**公曆:** {chart.year}/{chart.month}/{chart.day}")
        st.write(f"**時間:** {chart.hour:02d}:{chart.minute:02d}")
        st.write(f"**時區:** UTC{chart.timezone:+.1f}")
        st.write(f"**性別:** {chart.gender}命 ({chart.yin_yang})")
    with col2:
        st.write(f"**農曆:** {lunar_date}")
        st.write(f"**時辰:** {HOUR_BRANCH_NAMES[chart.hour_branch]}")
        st.write(f"**地點:** {chart.location_name}")
    with col3:
        wu_ju_name = WU_XING_JU_NAMES[chart.wu_xing_ju]
        st.write(f"**命宮:** {EARTHLY_BRANCHES[chart.ming_gong_branch]}宮")
        st.write(f"**身宮:** {EARTHLY_BRANCHES[chart.shen_gong_branch]}宮")
        st.write(f"**五行局:** {wu_ju_name}")

    # 四化資訊
    sihua_str = "　".join(
        f"{star}化{hua}" for star, hua in chart.sihua.items()
    )
    st.info(f"**四化:** {sihua_str}")

    # 節氣影響
    if chart.solar_term_influence:
        st.success(f"**節氣:** {chart.solar_term_influence}")


def _day_to_chinese(day: int) -> str:
    """農曆日數字轉中文(完整:初一..初十/十一..十九/二十/廿一..廿九/三十,自帶「初」)。"""
    units = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
    if day <= 10:
        return f"初{units[day]}"
    if day < 20:
        return f"十{units[day - 10]}"
    if day == 20:
        return "二十"
    if day < 30:
        return f"廿{units[day - 20]}"
    return "三十"


def _palace_cell_html(
    palace: CetianPalace, is_ming: bool, is_shen: bool
) -> str:
    """產生單一宮位的 HTML 卡片（用於 CSS Grid 命盤方格）。"""
    bg = "#1a1a2e"
    border_style = "border:1px solid #444;"
    if is_ming and is_shen:
        border_style = "border:3px solid #FFD700;"
        bg = "#2d1b00"
    elif is_ming:
        border_style = "border:3px solid #FF6B6B;"
        bg = "#2d0000"
    elif is_shen:
        border_style = "border:3px solid #4ECDC4;"
        bg = "#001a1a"

    label = ""
    if is_ming:
        label += '<span style="color:#FF6B6B;font-weight:bold;font-size:11px">【命】</span>'
    if is_shen:
        label += '<span style="color:#4ECDC4;font-weight:bold;font-size:11px">【身】</span>'

    SIHUA_COLORS = {"祿": "#00E676", "權": "#FF5252", "科": "#42A5F5", "忌": "#FF9800"}

    # 正曜 HTML
    stars_html = ""
    for star in palace.stars:
        attr = CETIAN_STAR_ATTRIBUTES.get(star, ("", "", "#aaa"))
        color = attr[2]
        bright = palace.brightness.get(star, "")
        bright_html = f'<span style="color:#aaa;font-size:9px">{bright}</span>' if bright else ""
        hua = palace.sihua.get(star, "")
        hua_html = ""
        if hua:
            hc = SIHUA_COLORS.get(hua, "#fff")
            hua_html = f'<span style="color:{hc};font-size:10px;font-weight:bold">化{hua}</span>'
        # 飛星箭頭
        fly_html = ""
        if star in palace.flying_stars:
            fly_html = f'<span style="color:#FFD700;font-size:9px">→{palace.flying_stars[star]}</span>'
        stars_html += (
            f'<div style="display:flex;align-items:center;gap:2px">'
            f'<span style="color:{color};font-size:13px;font-weight:bold">{star}</span>'
            f'{bright_html}{hua_html}{fly_html}</div>'
        )

    # 副曜 HTML
    aux_html = ""
    for star in palace.aux_stars:
        bright = palace.brightness.get(star, "")
        bright_str = f"({bright})" if bright else ""
        hua = palace.sihua.get(star, "")
        hua_str = ""
        if hua:
            hc = SIHUA_COLORS.get(hua, "#fff")
            hua_str = f'<span style="color:{hc};font-size:9px"> 化{hua}</span>'
        fly_html = ""
        if star in palace.flying_stars:
            fly_html = f'<span style="color:#FFD700;font-size:9px">→{palace.flying_stars[star]}</span>'
        aux_html += (
            f'<span style="color:#888;font-size:10px">{star}{bright_str}</span>{hua_str}{fly_html} '
        )

    if not stars_html and not aux_html:
        stars_html = '<div style="color:#666;font-size:11px">─</div>'

    # 格局標記
    pattern_html = ""
    if palace.patterns:
        for p in palace.patterns:
            pattern_html += f'<span style="color:#FFD700;font-size:8px;background:#333;padding:1px 3px;border-radius:3px;margin:1px">{p}</span>'

    return (
        f'<div style="background:{bg};padding:6px 5px;border-radius:6px;'
        f'min-height:130px;{border_style}">'
        f'<div style="display:flex;justify-content:space-between;align-items:center">'
        f'<span style="color:#c8a96e;font-size:10px">'
        f'{palace.stem_name}{palace.branch_name}</span>'
        f'{label}'
        f'<span style="color:#8B8000;font-size:9px">{palace.da_xian}</span>'
        f'</div>'
        f'<div style="color:#e0e0e0;font-size:11px;font-weight:bold;'
        f'border-bottom:1px solid #555;margin-bottom:3px;padding-bottom:1px">'
        f'{palace.name}</div>'
        f'{stars_html}'
        f'<div style="margin-top:3px;line-height:1.4">{aux_html}</div>'
        f'{pattern_html}'
        f'</div>'
    )


def _center_info_html(chart: CetianChart) -> str:
    """產生中宮資訊 HTML。"""
    wu_ju = WU_XING_JU_NAMES[chart.wu_xing_ju]
    leap = "閏" if chart.is_leap_month else ""
    lm = f"{leap}{LUNAR_MONTH_NAMES[chart.lunar_month - 1]}"
    ld = _day_to_chinese(chart.lunar_day)
    ys = HEAVENLY_STEMS[chart.lunar_year_stem]
    yb = EARTHLY_BRANCHES[chart.lunar_year_branch]

    sihua_html = ""
    SIHUA_COLORS = {"祿": "#00E676", "權": "#FF5252", "科": "#42A5F5", "忌": "#FF9800"}
    for star, hua in chart.sihua.items():
        hc = SIHUA_COLORS.get(hua, "#fff")
        sihua_html += f'<span style="color:{hc};font-size:11px;margin:0 3px">{star}化{hua}</span>'

    solar_html = ""
    if chart.solar_term_influence:
        solar_html = (
            f'<div style="font-size:10px;color:#81C784;margin-top:3px">'
            f'🌿 {chart.solar_term_influence}</div>'
        )

    return (
        f'<div style="background:#0d0d1a;border:2px solid #c8a96e;border-radius:10px;'
        f'padding:12px;text-align:center;height:100%;color:#e0d5b0;'
        f'display:flex;flex-direction:column;justify-content:center;">'
        f'<div style="font-size:18px;font-weight:bold;color:#c8a96e;margin-bottom:4px">'
        f'策天十八飛星</div>'
        f'<div style="font-size:11px;color:#aaa;margin-bottom:4px">古法紫微斗數</div>'
        f'<div style="font-size:12px;margin:2px 0">'
        f'{chart.gender}命 / {chart.yin_yang}{chart.gender} / {wu_ju}</div>'
        f'<div style="font-size:12px;margin:2px 0">'
        f'{chart.lunar_year}年 {ys}{yb}年</div>'
        f'<div style="font-size:12px;margin:2px 0">'
        f'{lm} {ld} {HOUR_BRANCH_NAMES[chart.hour_branch]}</div>'
        f'<div style="font-size:11px;margin:4px 0;color:#FF6B6B">'
        f'命宮: {EARTHLY_BRANCHES[chart.ming_gong_branch]}宮 '
        f'<span style="color:#4ECDC4">身宮: {EARTHLY_BRANCHES[chart.shen_gong_branch]}宮</span>'
        f'</div>'
        f'<div style="margin-top:4px">{sihua_html}</div>'
        f'{solar_html}'
        f'<div style="font-size:10px;color:#888;margin-top:4px">'
        f'四化: <span style="color:#00E676">→祿</span>'
        f'<span style="color:#FF5252">→權</span>'
        f'<span style="color:#42A5F5">→科</span>'
        f'<span style="color:#FF9800">→忌</span></div>'
        f'</div>'
    )


def _render_palace_grid(chart: CetianChart) -> None:
    """渲染南式命盤方格（CSS Grid）。"""
    st.markdown("#### 🀄 策天十八飛星命盤方格")

    branch_to_palace: dict[int, CetianPalace] = {p.branch: p for p in chart.palaces}

    def cell(branch: int) -> str:
        p = branch_to_palace[branch]
        return _palace_cell_html(
            p,
            is_ming=(p.branch == chart.ming_gong_branch),
            is_shen=(p.branch == chart.shen_gong_branch),
        )

    grid_layout = [
        (1, 1, 5), (1, 2, 6), (1, 3, 7), (1, 4, 8),
        (2, 1, 4), (2, 4, 9),
        (3, 1, 3), (3, 4, 10),
        (4, 1, 2), (4, 2, 1), (4, 3, 0), (4, 4, 11),
    ]

    cells_html = ""
    for row, col, branch in grid_layout:
        cells_html += (
            f'<div style="grid-row:{row};grid-column:{col}">'
            f'{cell(branch)}</div>'
        )

    center_html = (
        f'<div style="grid-row:2/4;grid-column:2/4">'
        f'{_center_info_html(chart)}</div>'
    )

    full_html = (
        f'<div style="display:grid;grid-template-columns:repeat(4,1fr);'
        f'grid-template-rows:repeat(4,auto);gap:4px;'
        f'background:#111;padding:6px;border-radius:10px;'
        f'border:2px solid #c8a96e;">'
        f'{cells_html}'
        f'{center_html}'
        f'</div>'
    )

    st.markdown(full_html, unsafe_allow_html=True)


def _render_star_table(chart: CetianChart) -> None:
    """渲染十八飛星位置匯總表格。"""
    st.markdown("#### ⭐ 十八飛星分佈表")

    header = "| 星曜 | 五行 | 別稱 | 所在宮位 | 地支 | 亮度 | 四化 | 飛入 |"
    sep = "|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|"
    rows = [header, sep]

    all_star_names = CETIAN_MAIN_STAR_NAMES + CETIAN_AUX_STAR_NAMES
    for star in all_star_names:
        attr = CETIAN_STAR_ATTRIBUTES.get(star, ("", "", "#aaa"))
        wuxing, alias, color = attr
        palace = next(
            (p for p in chart.palaces if star in p.stars or star in p.aux_stars), None
        )
        if palace is None:
            continue
        is_ming = "【命】" if palace.branch == chart.ming_gong_branch else ""
        is_shen = "【身】" if palace.branch == chart.shen_gong_branch else ""
        marker = f"{is_ming}{is_shen}"
        name_html = f'<span style="color:{color};font-weight:bold">{star}</span>'
        bright = palace.brightness.get(star, "")
        hua = chart.sihua.get(star, "")
        hua_str = f"化{hua}" if hua else ""
        # 飛入宮位
        flight = chart.star_flight.get(star, {})
        fly_str = ""
        if flight:
            fly_str = f"→{EARTHLY_BRANCHES[flight['to_branch']]}"
        rows.append(
            f"| {name_html} | {wuxing} | {alias} "
            f"| {palace.name}{marker} "
            f"| {palace.branch_name} "
            f"| {bright} "
            f"| {hua_str} "
            f"| {fly_str} |"
        )

    st.markdown("\n".join(rows), unsafe_allow_html=True)


def _render_sihua_legend() -> None:
    """渲染四化圖例說明。"""
    st.markdown(
        '<div style="text-align:center;padding:4px;font-size:12px">'
        '策天四化圖示: '
        '<span style="color:#00E676;font-weight:bold">●祿</span> '
        '<span style="color:#FF5252;font-weight:bold">●權</span> '
        '<span style="color:#42A5F5;font-weight:bold">●科</span> '
        '<span style="color:#FF9800;font-weight:bold">●忌</span>'
        '　<span style="color:#FFD700">→飛星箭頭</span>'
        '</div>',
        unsafe_allow_html=True,
    )


def _render_flying_star_table(chart: CetianChart) -> None:
    """渲染飛星路線表。"""
    st.markdown("#### 🏹 飛星路線表")
    st.markdown("*各星曜由本宮飛入他宮的影響*")

    header = "| 星曜 | 本宮 | 飛入 | 飛化性質 |"
    sep = "|:---:|:---:|:---:|:---|"
    rows = [header, sep]

    for star_name, flight_info in chart.star_flight.items():
        from_b = EARTHLY_BRANCHES[flight_info["from_branch"]]
        to_b = EARTHLY_BRANCHES[flight_info["to_branch"]]
        nature = flight_info["nature"]
        attr = CETIAN_STAR_ATTRIBUTES.get(star_name, ("", "", "#aaa"))
        color = attr[2]
        name_html = f'<span style="color:{color};font-weight:bold">{star_name}</span>'
        rows.append(f"| {name_html} | {from_b}宮 | {to_b}宮 | {nature} |")

    st.markdown("\n".join(rows), unsafe_allow_html=True)


def _render_feixing_table(chart: CetianChart) -> None:
    """渲染飛星四化表（各宮位天干的四化）。"""
    st.markdown("#### 🌠 宮干飛星四化表")
    st.markdown("*各宮位天干所引發的策天四化*")

    header = "| 宮位 | 天干 | 化祿 | 化權 | 化科 | 化忌 |"
    sep = "|:---:|:---:|:---:|:---:|:---:|:---:|"
    rows = [header, sep]

    SIHUA_COLORS = {"祿": "#00E676", "權": "#FF5252", "科": "#42A5F5", "忌": "#FF9800"}

    for palace in chart.palaces:
        lu_star = CETIAN_SIHUA_TABLE[palace.stem][0]
        quan_star = CETIAN_SIHUA_TABLE[palace.stem][1]
        ke_star = CETIAN_SIHUA_TABLE[palace.stem][2]
        ji_star = CETIAN_SIHUA_TABLE[palace.stem][3]
        rows.append(
            f"| {palace.name}({palace.branch_name}) | {palace.stem_name} "
            f'| <span style="color:{SIHUA_COLORS["祿"]}">{lu_star}</span> '
            f'| <span style="color:{SIHUA_COLORS["權"]}">{quan_star}</span> '
            f'| <span style="color:{SIHUA_COLORS["科"]}">{ke_star}</span> '
            f'| <span style="color:{SIHUA_COLORS["忌"]}">{ji_star}</span> |'
        )

    st.markdown("\n".join(rows), unsafe_allow_html=True)


def _render_patterns(chart: CetianChart) -> None:
    """渲染古法格局檢測結果。"""
    st.markdown("#### 📜 古法格局")

    if not chart.active_patterns:
        st.info("此命盤未檢測到特殊古法格局。")
        return

    for pattern in chart.active_patterns:
        stars_str = "、".join(pattern["stars"])
        branch_name = EARTHLY_BRANCHES[pattern["palace_branch"]]
        st.markdown(
            f"**🔶 {pattern['name']}** — {stars_str} "
            f"（{branch_name}宮）\n\n"
            f"*{pattern['meaning']}*"
        )


def _render_palace_details(chart: CetianChart) -> None:
    """渲染十二宮位詳細說明。"""
    st.markdown("#### 📋 十二宮位詳情")

    _PALACE_DESC = {
        "命宮":  "代表人的個性、才能、命運走向",
        "兄弟宮": "兄弟姐妹、朋友關係",
        "夫妻宮": "婚姻、伴侶、感情",
        "子女宮": "子女、創造、學生",
        "財帛宮": "金錢、財富、財運",
        "疾厄宮": "健康、疾病、意外",
        "遷移宮": "旅行、遷徙、外出緣份",
        "交友宮": "朋友、同事、下屬",
        "官祿宮": "事業、工作、官運",
        "田宅宮": "房產、家庭、祖業",
        "福德宮": "福份、精神、享樂",
        "父母宮": "父母、長輩、文書",
    }

    # 三合組
    st.markdown("##### 🔺 三合")
    sanhe_names = {
        (0, 4, 8): "水局 (子辰申)",
        (1, 5, 9): "金局 (丑巳酉)",
        (2, 6, 10): "火局 (寅午戌)",
        (3, 7, 11): "木局 (卯未亥)",
    }
    branch_to_palace = {p.branch: p for p in chart.palaces}
    for group in chart.sanhe_groups:
        group_name = sanhe_names.get(group, "")
        palace_names = [
            branch_to_palace[b].name if b in branch_to_palace else EARTHLY_BRANCHES[b]
            for b in group
        ]
        st.write(f"**{group_name}:** {' ↔ '.join(palace_names)}")

    st.markdown("---")

    cols = st.columns(3)
    for i, palace in enumerate(chart.palaces):
        with cols[i % 3]:
            stars_str = "、".join(palace.stars) if palace.stars else "（空宮）"
            aux_str = "、".join(palace.aux_stars) if palace.aux_stars else ""
            markers = []
            if palace.branch == chart.ming_gong_branch:
                markers.append("🔴命")
            if palace.branch == chart.shen_gong_branch:
                markers.append("🔵身")
            marker_str = " ".join(markers)
            desc = _PALACE_DESC.get(palace.name, "")

            # 四化
            sihua_str = ""
            for star, hua in palace.sihua.items():
                sihua_str += f" {star}化{hua}"

            # 飛星
            fly_str = ""
            for star, target in palace.flying_stars.items():
                fly_str += f" {star}→{target}"

            # 格局
            pattern_str = ""
            if palace.patterns:
                pattern_str = "、".join(palace.patterns)

            st.markdown(
                f"**{palace.stem_name}{palace.branch_name} {palace.name}** "
                f"{marker_str} 大限:{palace.da_xian}\n\n"
                f"⭐ 正曜: {stars_str}\n\n"
                f"🔹 副曜: {aux_str}\n\n"
                + (f"🔸 四化: {sihua_str}\n\n" if sihua_str else "")
                + (f"🏹 飛星: {fly_str}\n\n" if fly_str else "")
                + (f"📜 格局: {pattern_str}\n\n" if pattern_str else "")
                + f"*{desc}*"
            )


# ============================================================
# SVG 飛星輪盤 (Flying Star Wheel SVG)
# ============================================================

def build_cetian_flyingstar_svg(chart: CetianChart, size: int = 700) -> str:
    """
    產生策天十八飛星輪盤 SVG（古籍手抄本風格 + 飛化箭頭）。

    Parameters:
        chart: 策天命盤資料
        size:  SVG 畫布大小（像素）

    Returns:
        完整 SVG 字串
    """
    cx, cy = size // 2, size // 2
    r_outer = size // 2 - 30
    r_inner = r_outer - 100
    r_text = r_inner + 50
    r_center = r_inner - 20

    # 基本 SVG 頭部
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<rect width="{size}" height="{size}" fill="#0d0d1a"/>'
    )

    # 外圈
    svg += (
        f'<circle cx="{cx}" cy="{cy}" r="{r_outer}" '
        f'fill="none" stroke="#c8a96e" stroke-width="2"/>'
    )
    svg += (
        f'<circle cx="{cx}" cy="{cy}" r="{r_inner}" '
        f'fill="none" stroke="#c8a96e" stroke-width="1"/>'
    )

    # 十二宮分割線
    branch_to_palace = {p.branch: p for p in chart.palaces}
    for i in range(12):
        angle = math.radians(i * 30 - 90)
        x1 = cx + r_inner * math.cos(angle)
        y1 = cy + r_inner * math.sin(angle)
        x2 = cx + r_outer * math.cos(angle)
        y2 = cy + r_outer * math.sin(angle)
        svg += (
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" '
            f'x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="#c8a96e" stroke-width="1"/>'
        )

    # 宮位標籤與星曜
    SIHUA_COLORS = {"祿": "#00E676", "權": "#FF5252", "科": "#42A5F5", "忌": "#FF9800"}
    for i in range(12):
        mid_angle = math.radians(i * 30 + 15 - 90)
        tx = cx + r_text * math.cos(mid_angle)
        ty = cy + r_text * math.sin(mid_angle)

        palace = branch_to_palace.get(i)
        if palace:
            # 宮位名稱
            svg += (
                f'<text x="{tx:.1f}" y="{ty:.1f}" text-anchor="middle" '
                f'fill="#c8a96e" font-size="10" font-weight="bold">'
                f'{palace.name}</text>'
            )
            # 地支
            svg += (
                f'<text x="{tx:.1f}" y="{ty + 12:.1f}" text-anchor="middle" '
                f'fill="#888" font-size="9">{palace.branch_name}</text>'
            )
            # 星曜
            all_stars = palace.stars + palace.aux_stars
            for j, star in enumerate(all_stars[:3]):
                attr = CETIAN_STAR_ATTRIBUTES.get(star, ("", "", "#aaa"))
                color = attr[2]
                hua = palace.sihua.get(star, "")
                display_color = SIHUA_COLORS.get(hua, color) if hua else color
                sy = ty + 24 + j * 11
                svg += (
                    f'<text x="{tx:.1f}" y="{sy:.1f}" text-anchor="middle" '
                    f'fill="{display_color}" font-size="9">{star}</text>'
                )

    # 飛星箭頭
    for star_name, flight_info in chart.star_flight.items():
        from_b = flight_info["from_branch"]
        to_b = flight_info["to_branch"]
        if from_b == to_b:
            continue
        from_angle = math.radians(from_b * 30 + 15 - 90)
        to_angle = math.radians(to_b * 30 + 15 - 90)
        r_arrow = r_center
        fx = cx + r_arrow * math.cos(from_angle)
        fy = cy + r_arrow * math.sin(from_angle)
        tx_a = cx + r_arrow * math.cos(to_angle)
        ty_a = cy + r_arrow * math.sin(to_angle)

        attr = CETIAN_STAR_ATTRIBUTES.get(star_name, ("", "", "#aaa"))
        arrow_color = attr[2]

        svg += (
            f'<line x1="{fx:.1f}" y1="{fy:.1f}" '
            f'x2="{tx_a:.1f}" y2="{ty_a:.1f}" '
            f'stroke="{arrow_color}" stroke-width="0.8" '
            f'opacity="0.4" stroke-dasharray="3,2"/>'
        )

    # 中心標題
    svg += (
        f'<text x="{cx}" y="{cy - 10}" text-anchor="middle" '
        f'fill="#c8a96e" font-size="14" font-weight="bold">策天十八飛星</text>'
    )
    svg += (
        f'<text x="{cx}" y="{cy + 10}" text-anchor="middle" '
        f'fill="#aaa" font-size="11">古法紫微斗數</text>'
    )

    svg += '</svg>'
    return svg
