"""静态守卫:日期串不许裸 .split('-') 拆年月日(公元前前导负号会把串撕成 ['', 'Y', 'M', 'D'])。

病理:推运各「按日期」入口经 helper.getChartDate 先按 '/'、再按 '-' 拆,'-0001-06-01' 拆出空年份 → 九个入口一律 param error;
月返同月第二次求返照 dirparts[0].split('-') 同病。日期串一律 civil_calendar.parse_civil_date(负号、1–5 位年、斜杠都对)。
判据(AST):astrostudy/ 与 websrv/ 里 `X.split('-')`:
- X 是 `….lstrip('-')` 的结果(先剥负号再拆),且同一函数里取过符号(`….startswith('-')` 或 `…[0] == '-'`)→ 放行;
  只剥不取符号 = 公元前按公元年算(印占年盘曾把公元前 300 年出生算成 1726 岁)→ 红;
- 其余必须在下表登记 (文件, 所在函数) → (次数, 理由);新增未登记 = 红,登记次数与源码不符 = 红。
另:任何 `.lstrip('-')` / `.lstrip('+-')` 所在函数都必须取过符号;日期 / 时刻串的定位切片([:4] / [:7] / [:10] / [:11] /
[5:7] / [8:10] / [:16] / [:19] …,公元前前导负号、五位年会截错)必须登记。
"""
import ast
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ('astrostudy', 'websrv')

SPLIT_ALLOW = {
    ('astrostudy/perchart.py', '__init__'): (1, '按长度 4 识别「-Y-M-D」负年并单独处理'),
    ('astrostudy/acg/ACGraph.py', '__init__'): (1, '同 PerChart:长度 4 = 负年分支'),
    ('astrostudy/india/india_chart_kernel.py', '__init__'): (1, '同 PerChart:长度 4 = 负年分支'),
    ('astrostudy/jieqi/BirthJieQi.py', '__init__'): (1, '长度 4 走负年分支(else)'),
    ('astrostudy/jieqi/BirthJieQi.py', 'compute'): (1, '首段为空即负年,随后拼回负号'),
    ('astrostudy/jieqi/realsuntime.py', 'getOffsetByDate'): (1, "拆 'MM-DD' 月日,串里没有年"),
    ('astrostudy/xuanshi/fmt.py', '_parse'): (1, '先判前导负号并切掉再拆'),
    ('websrv/webchart3dsrv.py', '_normalize_date'): (1, '按长度 4 识别负年'),
    ('websrv/webjdn.py', 'num'): (1, '按长度 4 识别负年'),
    ('websrv/webgeomancysrv.py', '_parse_time_place'): (1, '前端发正年 + ad=-1,随后按 ad 换负年'),
}


def _iter_sources():
    for d in SCAN_DIRS:
        for p in sorted((ROOT / d).rglob('*.py')):
            rel = p.relative_to(ROOT).as_posix()
            if '/__pycache__/' in rel:
                continue
            yield rel, p.read_text(encoding='utf-8')


def _is_lstrip_minus(node):
    return (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'lstrip'
            and node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value == '-')


def _chain_has_lstrip_minus(node):
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        if _is_lstrip_minus(node):
            return True
        node = node.func.value
    return False


def _is_lstrip_sign(node):
    return (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'lstrip'
            and node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('-', '+-', '-+'))


def _is_sign_check(node):
    """`….startswith('-')` 或 `…[0] == '-'` / `…[0:1] == '-'`(取符号)。"""
    if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'startswith'
            and node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value == '-'):
        return True
    if isinstance(node, ast.Compare) and len(node.comparators) == 1:
        sides = [node.left, node.comparators[0]]
        return (any(isinstance(x, ast.Constant) and x.value == '-' for x in sides)
                and any(isinstance(x, ast.Subscript) for x in sides))
    return False


def _function_has_sign_check(fn):
    return any(_is_sign_check(n) for n in ast.walk(fn))


class _Visitor(ast.NodeVisitor):
    def __init__(self):
        self.stack = []        # 函数名
        self.signed = []       # 对应函数里是否取过符号
        self.hits = []
        self.unsigned_lstrip = []

    def visit_FunctionDef(self, node):
        self.stack.append(node.name)
        self.signed.append(_function_has_sign_check(node))
        self.generic_visit(node)
        self.stack.pop()
        self.signed.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def _scope(self):
        return self.stack[-1] if self.stack else None

    def _has_sign(self):
        return bool(self.signed and self.signed[-1])

    def visit_Call(self, node):
        f = node.func
        if (isinstance(f, ast.Attribute) and f.attr == 'split' and node.args
                and isinstance(node.args[0], ast.Constant) and node.args[0].value == '-'
                and not (_chain_has_lstrip_minus(f.value) and self._has_sign())):
            self.hits.append((self._scope(), node.lineno))
        if _is_lstrip_sign(node) and not self._has_sign():
            self.unsigned_lstrip.append((self._scope(), node.lineno))
        self.generic_visit(node)


def _scan():
    found = Counter()
    where = {}
    for rel, src in _iter_sources():
        v = _Visitor()
        v.visit(ast.parse(src))
        for scope, line in v.hits:
            found[(rel, scope)] += 1
            where.setdefault((rel, scope), []).append(line)
    return found, where


def test_no_unregistered_dash_split():
    found, where = _scan()
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in SPLIT_ALLOW]
    assert not bad, "日期串裸 split('-')(公元前前导负号会撕裂;改用 civil_calendar.parse_civil_date):\n" + '\n'.join(bad)


def test_registered_counts_match_source():
    found, _where = _scan()
    drift = {k: (found.get(k, 0), v[0]) for k, v in SPLIT_ALLOW.items()
             if (ROOT / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


def test_detector_self_check():
    v = _Visitor()
    v.visit(ast.parse("def f(s):\n    neg = s.startswith('-')\n    a = s.split('-')\n    b = s.lstrip('-').split('-')\n"
                      "    c = s.lstrip('-').replace('/', '-').split('-')\n"))
    assert [h[1] for h in v.hits] == [3]
    # 只剥负号、不取符号(印占年盘旧写法):split 与 lstrip 都必红
    v2 = _Visitor()
    v2.visit(ast.parse("def g(data):\n    parts = str(data.get('date', '')).lstrip('-').replace('/', '-').split('-')\n"
                       "    return int(parts[0])\n"))
    assert [h[1] for h in v2.hits] == [2] and [h[1] for h in v2.unsigned_lstrip] == [2]
    # 取符号的写法(`[0] == '-'` 也算)放行
    v3 = _Visitor()
    v3.visit(ast.parse("def z(t):\n    sign = -1 if t[0] == '-' else 1\n    return sign * float(t.lstrip('+-'))\n"))
    assert v3.hits == [] and v3.unsigned_lstrip == []


def test_every_sign_strip_keeps_the_sign():
    bad = []
    for rel, src in _iter_sources():
        v = _Visitor()
        v.visit(ast.parse(src))
        bad += ['{0}:{1} 在 {2}'.format(rel, line, scope) for scope, line in v.unsigned_lstrip]
    assert not bad, "lstrip('-') 剥了负号却没在同一函数里取符号(公元前会按公元年算;日期串改用 civil_calendar.parse_civil_date):\n" + '\n'.join(bad)


# ── 日期 / 时刻串的定位切片 ──────────────────────────────────────────────────────────────
# '-0300-03-10' 截 [:10] = '-0300-03-1';五位年 '-12000-01-01' 截 [:11] 日成 '0';Datetime.toCNString() 年不补位,
# 公元 300 年 '300-03-10 06:00:00'[:10] 带出尾随空格。取日期段一律 parse_civil_date / .split(' ')[0]。
# 判据:切片下标落在日期位 (0,4) (0,7) (0,10) (0,11) (5,7) (8,10) (0,16) (0,19) (11,16) (11,19),且被切的表达式
# 源码带日期字样(date / time / when / day / iso / ymd / birth / dt / label / txt)→ 必须登记 (文件, 函数) → (次数, 理由)。
_POS_SLICES = {(0, 4), (0, 7), (0, 10), (0, 11), (5, 7), (8, 10), (0, 16), (0, 19), (11, 16), (11, 19)}
_DATE_WORDS = ('date', 'time', 'when', 'day', 'iso', 'ymd', 'birth', 'dt', 'label', 'txt')
POS_SLICE_ALLOW = {
}


def _pos_slices(src):
    tree = ast.parse(src)
    out = []

    class V(ast.NodeVisitor):
        def __init__(self):
            self.stack = []

        def visit_FunctionDef(self, node):
            self.stack.append(node.name)
            self.generic_visit(node)
            self.stack.pop()

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_Subscript(self, node):
            sl = node.slice
            if isinstance(sl, ast.Slice) and sl.step is None:
                lo = 0 if sl.lower is None else (sl.lower.value if isinstance(sl.lower, ast.Constant) else None)
                hi = sl.upper.value if isinstance(sl.upper, ast.Constant) else None
                if (lo, hi) in _POS_SLICES:
                    seg = (ast.get_source_segment(src, node.value) or '').lower()
                    if any(w in seg for w in _DATE_WORDS):
                        out.append((self.stack[-1] if self.stack else None, node.lineno))
            self.generic_visit(node)

    V().visit(tree)
    return out


def test_no_unregistered_positional_date_slices():
    found, where = Counter(), {}
    for rel, src in _iter_sources():
        for scope, line in _pos_slices(src):
            found[(rel, scope)] += 1
            where.setdefault((rel, scope), []).append(line)
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in POS_SLICE_ALLOW]
    assert not bad, '日期 / 时刻串定位切片(公元前负号、五位年、不补位的年会截错;改用 parse_civil_date / split):\n' + '\n'.join(bad)
    drift = {k: (found.get(k, 0), v[0]) for k, v in POS_SLICE_ALLOW.items()
             if (ROOT / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


def test_positional_slice_detector_self_check():
    assert _pos_slices("def f(ev):\n    when = str(ev.get('date'))[:10]\n") == [('f', 2)]
    assert _pos_slices("def f(t):\n    return f'{t}'.strip()[:11]\n") == []          # 无日期字样不判
    assert _pos_slices("def f(txt):\n    return txt.strip()[:11]\n") == [('f', 2)]
    assert _pos_slices("def f(date):\n    return date.split(' ')[0]\n") == []
    assert _pos_slices("def f(name):\n    return name[:10]\n") == []
