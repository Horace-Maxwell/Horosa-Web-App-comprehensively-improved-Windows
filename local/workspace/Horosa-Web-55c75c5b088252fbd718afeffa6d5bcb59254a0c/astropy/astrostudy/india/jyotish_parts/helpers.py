"""印占引擎小工具:角度归一 / 星座序 / 当地出生时刻 / 时间格式 / 大运主星(由 jyotish_engine.py 整段搬出,astrostudy.india.jyotish_engine 照旧可取这些名字)。"""
from datetime import date, datetime, timedelta, timezone
from astrostudy.india.jyotish_parts.tables import DASHA_SEQUENCE
from astrostudy.civil_calendar import civil_julday, civil_revjul, format_civil_date


def norm(deg):
    return deg % 360


def sign_index_from_lon(lon):
    return int(norm(lon) / 30) % 12


# nakshatra_from_lon 已迁至 astrostudy/nakshatra.py(共享),见顶部 import。


# 历法域(与 flatlib 起盘同口径):1582-10-15 以前按儒略历、之后格里历。
# Python datetime 是 proleptic 格里历 —— 大运等时间轴一律在「真时刻」(proleptic 格里)上做加减,
# 显示标签(format_dt)再按 flatlib 历法域出串;ISO 字段保持 proleptic 格里(机读真时刻)。
# 换历分界只在民用历法单源 civil_calendar 里(本文件不另存分界常量)。


def _julian_label_to_gregorian(year, month, day):
    """儒略历标签 → proleptic 格里历 (y, m, d)(同一天)。换算经民用历法单源 civil_calendar。"""
    jdn = int(round(civil_julday(year, month, day, 12.0)))
    g = date.fromordinal(jdn - 1721425)
    return g.year, g.month, g.day


def _civil_ymd_of(value):
    """proleptic 格里历 datetime → 民用日期 (天文年, 月, 日):1582-10-15 以前儒略历(civil_calendar 单源)。"""
    y, m, d, _h = civil_revjul(float(value.toordinal() + 1721425))   # 该日正午的儒略日,避开日界
    return int(y), int(m), int(d)


def _gregorian_to_julian_label(value):
    """proleptic 格里历 datetime → 儒略历 (y, m, d)(同一天;仅用于 1582-10-15 以前)。"""
    return _civil_ymd_of(value)


def get_local_birth_datetime(perchart):
    """出生当地时刻(proleptic 格里历 datetime,即真时刻)。输入日期在 1582-10-15 以前时是儒略历标签,
    先换成同一天的格里历日期,保证「出生 + N 天」的时间轴与 flatlib 起盘同一时刻。"""
    try:
        year = int(perchart.year)
        if year <= 0:
            return None
        month, day = int(perchart.month), int(perchart.day)
        parts = [int(x) for x in perchart.time.split(':')]
        while len(parts) < 3:
            parts.append(0)
        if (year, month, day) < (1582, 10, 15):
            year, month, day = _julian_label_to_gregorian(year, month, day)
        return datetime(year, month, day, parts[0], parts[1], parts[2])
    except Exception:
        return None


# ── 大运段界的时区(出生地):ISO 带出生时区偏移 → 前端 / AI 快照按绝对时刻判「当前」 ──
# 段界墙钟时刻恒为出生地当地(显示字面不变);浏览器 / 服务器所在时区不同不再把段界挪几个小时。
def zone_offset_minutes(zone):
    """'+05:30' / '-08:00' / 5.5 / '8' → 分钟(取整到分);坏值 / 缺省 → None。"""
    if zone is None or zone == '':
        return None
    try:
        hours = float(zone)
    except (TypeError, ValueError):
        try:
            t = str(zone).strip()
            sign = -1.0 if t.startswith('-') else 1.0
            t = t.lstrip('+-')
            hh, mm = (t.split(':') + ['0'])[:2] if ':' in t else (t, '0')
            hours = sign * (float(hh or 0) + float(mm or 0) / 60.0)
        except (TypeError, ValueError):
            return None
    return int(round(hours * 60.0))


def iso_with_zone(value, offset_minutes):
    """出生地当地墙钟 datetime(naive)→ ISO 串,带出生时区偏移(缺偏移 → 不带,与旧串同形)。"""
    s = value.isoformat()
    if offset_minutes is None:
        return s
    m = abs(int(offset_minutes))
    return '%s%s%02d:%02d' % (s, '+' if offset_minutes >= 0 else '-', m // 60, m % 60)


def parse_local_iso(text):
    """段界 ISO(带或不带偏移)→ 出生地当地墙钟 naive datetime(偏移只剥不换算)。"""
    dt = datetime.fromisoformat(str(text))
    return dt.replace(tzinfo=None)


def now_at_zone(offset_minutes):
    """此刻在出生地当地的墙钟 naive datetime(与段界同一坐标;缺偏移 → 回落本机当地,旧行为)。"""
    if offset_minutes is None:
        return datetime.now()
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=int(offset_minutes))


def format_dt(value):
    """日期显示标签(YYYY-MM-DD):1582-10-15 以前按儒略历,与起盘历法同口径(civil_calendar 单源)。"""
    if value is None:
        return None
    return format_civil_date(*_civil_ymd_of(value))


def dasha_lord(key):
    for item in DASHA_SEQUENCE:
        if item['key'] == key:
            return item
    return DASHA_SEQUENCE[0]
