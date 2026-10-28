"""前后端民用历法同一份用例表:astrostudyui/src/utils/__tests__/fixtures/civilCalendarCases.json。

前端 utils/civilCalendar.js 的测试读同一份表、逐位比对;本测试保证表里的值就是本服务 civil_calendar 的输出 ——
任何一侧的口径变了(切换日、历史纪年、秒的舍入与进位),两侧测试必有一侧红。
"""
import json
from pathlib import Path

from astrostudy.civil_calendar import civil_julday, civil_parts_from_jd

CASES = Path(__file__).resolve().parents[2] / 'astrostudyui' / 'src' / 'utils' / '__tests__' / 'fixtures' / 'civilCalendarCases.json'


def _cases():
    return json.loads(CASES.read_text(encoding='utf-8'))


def test_julday_cases_match_service():
    for y, m, d, h, jd in _cases()['julday']:
        assert civil_julday(y, m, d, h) == jd, (y, m, d, h)


def test_parts_cases_match_service():
    for jd, parts in _cases()['parts']:
        assert civil_parts_from_jd(jd) == parts, jd
