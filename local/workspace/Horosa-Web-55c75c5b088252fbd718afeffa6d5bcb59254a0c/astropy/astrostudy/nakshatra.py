"""
Nakshatra（27 宿）共享计算。

被印占引擎(india/jyotish_engine) 与西洋恒星黄道盘(perchart) 共用 —— 避免重复 + 循环 import。
纯函数,只依赖恒星黄道经度,零外部依赖。
"""

# 27 宿：(梵文名, 中文宿, 宿主行星)。顺序 = 黄经 0° 起每 13°20'。
# 中文宿名单一来源 = india/nakshatra_data.NAKSHATRA_DATA[*]['labelCn'](宿曜经通行对照:
# 娄胃昴毕觜参井鬼柳星张翼轸角亢氐房心尾箕斗女虚危室壁奎);本表只持梵名与宿主,不另持中文列。
_NAK_NAMES_LORDS = [
    ('Ashwini', 'Ketu'), ('Bharani', 'Venus'), ('Krittika', 'Sun'),
    ('Rohini', 'Moon'), ('Mrigashira', 'Mars'), ('Ardra', 'Rahu'),
    ('Punarvasu', 'Jupiter'), ('Pushya', 'Saturn'), ('Ashlesha', 'Mercury'),
    ('Magha', 'Ketu'), ('Purva Phalguni', 'Venus'), ('Uttara Phalguni', 'Sun'),
    ('Hasta', 'Moon'), ('Chitra', 'Mars'), ('Swati', 'Rahu'),
    ('Vishakha', 'Jupiter'), ('Anuradha', 'Saturn'), ('Jyeshtha', 'Mercury'),
    ('Mula', 'Ketu'), ('Purva Ashadha', 'Venus'), ('Uttara Ashadha', 'Sun'),
    ('Shravana', 'Moon'), ('Dhanishta', 'Mars'), ('Shatabhisha', 'Rahu'),
    ('Purva Bhadrapada', 'Jupiter'), ('Uttara Bhadrapada', 'Saturn'), ('Revati', 'Mercury'),
]


def _build_nakshatras():
    from astrostudy.india.nakshatra_data import NAKSHATRA_DATA
    out = []
    for (name, lord), row in zip(_NAK_NAMES_LORDS, NAKSHATRA_DATA):
        if row['lord'] != lord:
            raise ValueError('nakshatra lord mismatch: %s' % name)
        out.append((name, row['labelCn'], lord))
    return out


NAKSHATRAS = _build_nakshatras()


def _norm(lon):
    return float(lon) % 360.0


def nakshatra_from_lon(lon):
    """由恒星黄道经度返回 nakshatra(含 index 1-27 / name / 中文宿 label / 宿主 lord / pada 1-4 / 进度)。"""
    from astrostudy.india.primitives import segment_index
    span = 360.0 / 27.0
    value = _norm(lon)
    idx = segment_index(value, span, 27)            # 精确宿界归后一宿
    progress = min(1.0, max(0.0, (value - idx * span) / span))
    pada = segment_index(progress, 0.25, 4) + 1      # 精确步界归后一步
    name, label, lord = NAKSHATRAS[idx]
    # 28 宿口径(Abhijit)附加信息——27 宿主字段不变(Vimshottari/月宿/navamsa 仍按 27 宿)。
    from astrostudy.india.primitives import is_abhijit, nakshatra_number_28, ABHIJIT_NAME, ABHIJIT_LABEL
    abhijit = is_abhijit(value)
    return {
        'index': idx + 1,
        'name': name,
        'label': label,
        'lord': lord,
        'pada': pada,
        'progress': progress,
        'remainingRatio': 1 - progress,
        'isAbhijit': abhijit,
        'nak28Index': nakshatra_number_28(value, idx + 1),
        'nak28Name': ABHIJIT_NAME if abhijit else name,
        'nak28Label': ABHIJIT_LABEL if abhijit else label,
    }
