"""民用历法口径单一来源:儒略日 ⇄ 日期(与起盘引擎 flatlib.datetime.dateJDN 同口径)。

全仓约定:
- 1582-10-15 起用格里历,此前一律儒略历(1582-10-04 的次日是 10-15);
- 年份对外一律「历史纪年」:没有公元 0 年,公元前 1 年写 -1(天文年 0),公元前 300 年写 -300(天文年 -299);
- 日期串与前端 formatSignedDate 同形:负年前导负号,年不足 4 位补零,5 位原样('-0300-04-09'、'0999-01-01'、'12000-01-01')。

swisseph.julday / revjul 不带历法参数时恒按格里历、年份按天文年;直接拿它们换算用户日期或拼显示串,
1582 年以前差 10 天起、公元前再差一年——而起盘读日期串时按上面的约定解释,同一请求里两套口径一往返就错盘。
所以:凡「用户日期 → 儒略日」「儒略日 → 显示 / 起盘用的日期串」一律经本模块。
确属天文内部演算、需要季节对齐的连续历法(如按格里历月日取迭代初值、取十进制年估 ΔT)的,
调用处必须显式写 swisseph.GREG_CAL,并在静态守卫的登记表里写明理由。

1582-10-15 以后:本模块与 swisseph.julday(..., GREG_CAL) / revjul(..., GREG_CAL) 逐位相同(同一调用、同一浮点路径)。
"""
import math
from datetime import datetime as _std_datetime, timedelta as _timedelta

import swisseph

# 格里历首日 1582-10-15 00:00 的儒略日(当地民用时刻口径)。
GREG_START_JD = 2299160.5
_GREG_START_YMD = (1582, 10, 15)


def astro_year(display_year):
    """历史纪年 → 天文年(公元前 1 年 → 0;公元前 300 年 → -299)。正年原样。"""
    y = int(display_year)
    return y + 1 if y < 0 else y


def display_year(astro_y):
    """天文年 → 历史纪年(0 → -1;-299 → -300)。正年原样。"""
    y = int(astro_y)
    return y - 1 if y <= 0 else y


def calendar_flag_for_ymd(astro_y, month, day):
    """该民用日期按哪种历法解释:1582-10-15 及以后格里历,此前儒略历(与 flatlib dateJDN 同判据)。"""
    return swisseph.GREG_CAL if (int(astro_y), int(month), int(day)) >= _GREG_START_YMD else swisseph.JUL_CAL


def calendar_flag_for_jd(local_jd):
    """当地民用时刻的儒略日按哪种历法拆日期。"""
    return swisseph.GREG_CAL if float(local_jd) >= GREG_START_JD else swisseph.JUL_CAL


def civil_julday(astro_y, month, day, hour=0.0):
    """民用日期(天文年)+ 小时 → 儒略日。1582-10-15 以后与 swisseph.julday(..., GREG_CAL) 逐位相同。"""
    y, m, d = int(astro_y), int(month), int(day)
    return swisseph.julday(y, m, d, float(hour), calendar_flag_for_ymd(y, m, d))


def civil_julday_display(display_y, month, day, hour=0.0):
    """同 civil_julday,年份按历史纪年给(用户输入、日期串里的年)。"""
    return civil_julday(astro_year(display_y), month, day, hour)


def civil_revjul(local_jd):
    """儒略日 → (天文年, 月, 日, 小时浮点)。1582-10-15 以后与 swisseph.revjul(jd, GREG_CAL) 逐位相同。"""
    return swisseph.revjul(float(local_jd), calendar_flag_for_jd(local_jd))


def format_display_year(display_y):
    """历史纪年 → 日期串里的年段:负年前导负号,不足 4 位补零,5 位原样('-0300'、'0999'、'12000')。"""
    y = int(display_y)
    return ('-' if y < 0 else '') + str(abs(y)).zfill(4)


def format_display_date(display_y, month, day, sep='-'):
    """历史纪年月日 → 'YYYY-MM-DD'(负年前导负号;不足 4 位补零;5 位原样)。与前端 formatSignedDate 同形。
    年份已是历史纪年(用户输入 / 请求里的 year)时用本函数;手里是天文年用 format_civil_date。"""
    return '{0}{3}{1:02d}{3}{2:02d}'.format(format_display_year(display_y), int(month), int(day), sep)


def format_civil_date(astro_y, month, day, sep='-'):
    """天文年月日 → 'YYYY-MM-DD'(历史纪年;负年前导负号;不足 4 位补零)。与前端 formatSignedDate 同形。"""
    return format_display_date(display_year(astro_y), month, day, sep)


def parse_civil_date(text, ad=1):
    """'YYYY-MM-DD' / 'YYYY/MM/DD' / '-YYYY-MM-DD'(可带时间尾巴)→ (天文年, 月, 日)。
    年份按历史纪年读;ad<0 且年份不带负号 → 公元前该年(与起盘入参 ad 同义)。
    历史纪年没有 0 年:'0000-01-01' → ValueError(不悄悄读成公元前 1 年)。"""
    s = str(text).strip().split(' ')[0].replace('/', '-')
    neg = s.startswith('-')
    parts = s.lstrip('-').split('-')
    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    if y == 0:
        raise ValueError('历史纪年没有公元 0 年')
    if neg or (ad is not None and int(ad or 1) < 0):
        y = -abs(y)
    return astro_year(y), m, d


def split_hms(hour_float):
    """小时浮点 → (时, 分, 秒, 进位天数);秒四舍五入,60 秒 / 60 分逐级进位,满 24 时进位到下一天。"""
    hour = int(hour_float)
    minute_float = (hour_float - hour) * 60.0
    minute = int(minute_float)
    second = int(round((minute_float - minute) * 60.0))
    if second >= 60:
        second -= 60
        minute += 1
    if minute >= 60:
        minute -= 60
        hour += 1
    carry = 0
    if hour >= 24:
        carry = hour // 24
        hour -= 24 * carry
    return hour, minute, second, carry


def civil_parts_from_jd(local_jd):
    """当地民用时刻儒略日 → dict(天文年 / 历史年 / 月 / 日 / 时 / 分 / 秒 / 日期串 / 时刻串)。
    时分秒取整进位到 24 时时日期一并进到次日(不出现 '24:00:00')。"""
    y, m, d, hour_float = civil_revjul(local_jd)
    hh, mi, ss, carry = split_hms(hour_float)
    if carry:
        # 次日日期:以当天正午 + carry 天重新拆(跨 1582 切换、跨月跨年都由同一函数处理)。
        y, m, d, _h = civil_revjul(math.floor(float(local_jd) + 0.5) + float(carry))
    return {
        'astroYear': int(y),
        'year': display_year(y),
        'month': int(m),
        'day': int(d),
        'hour': hh,
        'minute': mi,
        'second': ss,
        'date': format_civil_date(y, m, d),
        'time': '{0:02d}:{1:02d}:{2:02d}'.format(hh, mi, ss),
    }


def civil_ymd_valid(display_y, month, day):
    """该民用日期(历史纪年)是否真实存在。1582 年以前按儒略历(1500-02-29 存在),1582-10-05..14 不存在,
    2 月 30 日、公元 0 年不存在。全仓「这一天有没有」的唯一判据(stdlib datetime 按外推格里历判,1582 年以前会误杀儒略闰日)。"""
    try:
        y, m, d = int(display_y), int(month), int(day)
    except (TypeError, ValueError):
        return False
    if y == 0 or not 1 <= m <= 12 or not 1 <= d <= 31:
        return False
    try:
        ay, am, ad, _h = civil_revjul(civil_julday_display(y, m, d, 0.0))
    except Exception:
        return False
    return (display_year(ay), int(am), int(ad)) == (y, m, d)


def civil_jdn_display(display_y, month, day):
    """民用日期(历史纪年)→ 儒略日数(整数,当天正午的儒略日)。"""
    return int(math.floor(civil_julday_display(display_y, month, day, 12.0) + 1e-9))


def civil_ymd_from_jdn(jdn):
    """儒略日数(整数)→ 民用 (历史纪年, 月, 日)。"""
    y, m, d, _h = civil_revjul(float(int(jdn)))
    return display_year(y), int(m), int(d)


# 1582-10-15 起 stdlib datetime(外推格里历)与民用历同一天;此前同一组年月日在两者里是不同的日子。
GREG_START_DISPLAY_YMD = _GREG_START_YMD


def stdlib_datetime_ok(display_y, month, day):
    """这一组民用年月日能否原样交给 stdlib datetime 承载(1582-10-15 ~ 9999-12-31)。"""
    y = int(display_y)
    return y <= 9999 and (y, int(month), int(day)) >= _GREG_START_YMD


class CivilDateTime:
    """民用历时刻(全年份域:公元前、1582 年以前儒略历、万年以后)。

    stdlib datetime 是外推格里历、只到 1~9999 年:拿它承载 1582 年以前的民用日期,1500-02-29 这类儒略闰日
    直接抛错,加减天数 / 星期 / 比较都按格里历算。本类把时刻放在「儒略日数 + 当日秒」数轴上(内部是一个
    timedelta),加减 timedelta、相减、比较、strftime(%Y %m %d %H %M %S %%)、weekday() 与 datetime 同义;
    1582-10-15 以后同一组字段的一切算术结果与 stdlib datetime 逐位相同(差值是同一个整数微秒)。
    年份是历史纪年(公元前为负、无 0 年);%Y 与 format_display_year 同形('-0300'、'0050'、'12000')。"""

    __slots__ = ('_td', '_ymd')

    def __init__(self, year, month, day, hour=0, minute=0, second=0, microsecond=0):
        y, m, d = int(year), int(month), int(day)
        if not civil_ymd_valid(y, m, d):
            raise ValueError('民用日期不存在: {0}'.format(format_display_date(y, m, d)))
        if not (0 <= int(hour) <= 23 and 0 <= int(minute) <= 59 and 0 <= int(second) <= 59
                and 0 <= int(microsecond) <= 999999):
            raise ValueError('时刻越界')
        self._td = _timedelta(days=civil_jdn_display(y, m, d), hours=int(hour), minutes=int(minute),
                              seconds=int(second), microseconds=int(microsecond))
        self._ymd = (y, m, d)

    @classmethod
    def _from_td(cls, td):
        obj = cls.__new__(cls)
        obj._td = td
        obj._ymd = civil_ymd_from_jdn(td.days)
        return obj

    @classmethod
    def from_datetime(cls, dt):
        return cls(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, getattr(dt, 'microsecond', 0))

    @classmethod
    def from_jdn(cls, jdn, seconds=0.0):
        return cls._from_td(_timedelta(days=int(jdn), seconds=seconds))

    @property
    def year(self):
        return self._ymd[0]

    @property
    def month(self):
        return self._ymd[1]

    @property
    def day(self):
        return self._ymd[2]

    @property
    def hour(self):
        return self._td.seconds // 3600

    @property
    def minute(self):
        return (self._td.seconds // 60) % 60

    @property
    def second(self):
        return self._td.seconds % 60

    @property
    def microsecond(self):
        return self._td.microseconds

    @property
    def jdn(self):
        """当天的儒略日数(整数)。"""
        return self._td.days

    def weekday(self):
        """0 = 周一 … 6 = 周日(与 datetime.weekday 同域;儒略日数 0 是周一)。"""
        return self._td.days % 7

    def to_stdlib(self):
        """1582-10-15 以后转 stdlib datetime(同一天);更早的民用日期在 stdlib 里是另一天 → ValueError。"""
        if not stdlib_datetime_ok(*self._ymd):
            raise ValueError('1582-10-15 以前的民用日期不能交给 stdlib datetime')
        return _std_datetime(self.year, self.month, self.day, self.hour, self.minute, self.second, self.microsecond)

    def __add__(self, other):
        if isinstance(other, _timedelta):
            return CivilDateTime._from_td(self._td + other)
        return NotImplemented

    __radd__ = __add__

    def __sub__(self, other):
        if isinstance(other, _timedelta):
            return CivilDateTime._from_td(self._td - other)
        if isinstance(other, CivilDateTime):
            return self._td - other._td
        return NotImplemented

    def _key(self, other):
        if not isinstance(other, CivilDateTime):
            raise TypeError('只能与 CivilDateTime 比较')
        return other._td

    def __eq__(self, other):
        return isinstance(other, CivilDateTime) and self._td == other._td

    def __ne__(self, other):
        return not self.__eq__(other)

    def __lt__(self, other):
        return self._td < self._key(other)

    def __le__(self, other):
        return self._td <= self._key(other)

    def __gt__(self, other):
        return self._td > self._key(other)

    def __ge__(self, other):
        return self._td >= self._key(other)

    def __hash__(self):
        return hash(self._td)

    def strftime(self, fmt):
        out = []
        i = 0
        while i < len(fmt):
            c = fmt[i]
            if c == '%' and i + 1 < len(fmt):
                k = fmt[i + 1]
                rep = {
                    'Y': format_display_year(self.year),
                    'm': '%02d' % self.month,
                    'd': '%02d' % self.day,
                    'H': '%02d' % self.hour,
                    'M': '%02d' % self.minute,
                    'S': '%02d' % self.second,
                    '%': '%',
                }.get(k)
                if rep is None:
                    raise ValueError('CivilDateTime.strftime 不支持 %' + k)
                out.append(rep)
                i += 2
                continue
            out.append(c)
            i += 1
        return ''.join(out)

    def isoformat(self, sep='T'):
        """与 datetime.isoformat 同形(微秒非零才带 .ffffff)。"""
        out = self.strftime('%Y-%m-%d') + sep + self.strftime('%H:%M:%S')
        if self.microsecond:
            out += '.%06d' % self.microsecond
        return out

    def __repr__(self):
        return 'CivilDateTime(%s)' % self.isoformat(' ')


def civil_datetime(display_y, month, day, hour=0, minute=0, second=0):
    """民用年月日时分秒 → 时刻承载(全仓单一工厂):
    - 日期不存在(2 月 30 日、1582-10-10、公元 0 年)→ ValueError,绝不改日充数;
    - 1582-10-15 ~ 9999 年 → stdlib datetime(与旧实现逐位相同);
    - 更早 / 更晚 → CivilDateTime(儒略历标签不落外推格里历)。"""
    y, m, d = int(display_y), int(month), int(day)
    if not civil_ymd_valid(y, m, d):
        raise ValueError('民用日期不存在: {0}'.format(format_display_date(y, m, d)))
    if stdlib_datetime_ok(y, m, d):
        return _std_datetime(y, m, d, int(hour), int(minute), int(second))
    return CivilDateTime(y, m, d, hour, minute, second)


def reset_ad_for_date(params, date_text=None):
    """派生盘入参换了日期串之后,纪元标志 ad 随新日期重置(就地改 params 并返回)。

    起盘读 date 时 ad=-1 且串不带负号 = 公元前该年。请求体从公元前本命盘复制出来、再换成推到的日期
    (过运 / 返照 / 问时 / 年盘 / 逐日采样)时沿用本命的 ad=-1,公元后的日期就被当成公元前那一年。
    派生日期串一律带符号(format_display_date / format_civil_date 出的串),ad 按串首是否负号重置。
    params 里本来没有 ad 键的不加(与旧请求体同形)。"""
    text = params.get('date') if date_text is None else date_text
    if 'ad' in params:
        new_ad = -1 if str(text).strip().startswith('-') else 1
        try:
            same = int(params['ad']) == new_ad
        except (TypeError, ValueError):
            same = False
        if not same:
            params['ad'] = new_ad
    return params


def sxtwl_from_civil(display_y, month, day):
    """民用日期(历史纪年)→ sxtwl 的 Day。sxtwl(寿星天文历)1582 年以前按儒略历、年份按天文年(有 0 年):
    历史纪年原样交进去,公元前就差一年(公元前 300 年 → 天文年 -299)。返回的 getLunarYear() 是天文年。"""
    import sxtwl
    return sxtwl.fromSolar(astro_year(display_y), int(month), int(day))


def civil_normalize_ymd(astro_y, month, day):
    """民用 (天文年, 月, 日) → 同一儒略日的规范日期(本身存在的原样返回;2001-02-29 这类不存在的「周年日」
    落到起盘引擎实际算的那一天 2001-03-01,与前端 addCivilYears 同一规则)。显示串与计算日期由此同源。"""
    y, m, d, _h = civil_revjul(civil_julday(astro_y, month, day, 12.0))
    return int(y), int(m), int(d)


# ── 连续太阳年轴(外推格里历,天文年)──
# 「第 N 个周年日」若按民用历取(1582 以前儒略历),跨 1582 改历的那一「年」只有 355 天、1582 以前出生的
# 周年日整体落后太阳年约 10 天;儒略历本身每 128 年也比太阳年多走一天。把周年放到外推格里历上取
# (平均年长 365.2425 天,与回归年差 < 1 天 / 3000 年),年长恒为 365 / 366 天;1582-10-15 以后
# 民用历就是格里历,结果与按民用历取逐位相同。标签仍由儒略日数经 civil_ymd_from_jdn 出民用历日期。

def greg_jdn_of_ymd(astro_y, month, day):
    """外推格里历(天文年)年月日 → 儒略日数(整数)。全域纯整数算术,无 1~9999 年域限。"""
    y, m, d = int(astro_y), int(month), int(day)
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045


def greg_ymd_of_jdn(jdn):
    """儒略日数(整数)→ 外推格里历 (天文年, 月, 日)。"""
    a = int(jdn) + 32044
    b = (4 * a + 3) // 146097
    c = a - (146097 * b) // 4
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    day = e + 1 - (153 * m + 2) // 5
    month = m + 3 - 12 * (m // 10)
    year = 100 * b + d - 4800 + m // 10
    return year, month, day


def greg_is_leap(astro_y):
    y = int(astro_y)
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


# 2 月 29 日出生、目标年(外推格里历)平年时周年日取哪天:
LEAP_DAY_FEB28 = 'feb28'   # 主限法周年插值(Core 口径;主限金标锁定)
LEAP_DAY_MAR1 = 'mar1'     # 小限 / 太阳弧 / 行星弧年表(起盘引擎把不存在的 2-29 读作 3-01)


def solar_anniversary_jdn(birth_jdn, years, leap_day=LEAP_DAY_MAR1):
    """出生当天(当地民用日的儒略日数)之后第 years 个太阳年周年日的儒略日数(连续太阳年轴)。
    全仓「第 N 个周年日」的唯一实现;2 月 29 日规则由调用方显式选(两种口径见上)。"""
    if leap_day not in (LEAP_DAY_FEB28, LEAP_DAY_MAR1):
        raise ValueError('leap_day 只能是 feb28 / mar1')
    y, m, d = greg_ymd_of_jdn(birth_jdn)
    ty = y + int(years)
    if m == 2 and d == 29 and not greg_is_leap(ty):
        m, d = (2, 28) if leap_day == LEAP_DAY_FEB28 else (3, 1)
    return greg_jdn_of_ymd(ty, m, d)


def flatlib_civil_string(dt):
    """flatlib Datetime(或任何带 getLocalGregoDate() 的对象)→ 'YYYY-MM-DD HH:MM:SS'(民用历:1582 以前儒略历、历史纪年;
    年份补到 4 位、公元前前导负号,与前端 formatSignedDate 同形)。公元 1000 年以后与 toCNString() 逐字相同。
    取日期段一律 .split(' ')[0],不按定位切片 [:10](公元前 / 五位年会截错)。"""
    y, m, d, hh, mi, ss = dt.getLocalGregoDate()
    return '{0} {1:02d}:{2:02d}:{3:02d}'.format(format_display_date(int(y), int(m), int(d)), int(hh), int(mi), int(ss))
