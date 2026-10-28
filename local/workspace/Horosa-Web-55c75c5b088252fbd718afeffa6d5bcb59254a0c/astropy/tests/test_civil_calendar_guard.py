"""静态守卫:用户日期 ⇄ 儒略日一律经 astrostudy.civil_calendar(1582-10-15 以前儒略历、历史纪年)。

swisseph.julday / revjul 不写历法参数时恒按格里历 + 天文年:拿来换算用户日期或拼显示 / 起盘串,
1582 年以前差 10 天起、公元前再差一年。本守卫扫 astrostudy/ 与 websrv/ 的源码:
- julday / revjul 不写历法参数 → 红;
- 显式写 GREG_CAL 的(天文内部演算,要季节对齐的连续历法)→ 必须在下表登记理由;
- astrostudy/ 与 websrv/ 里用 04d 拼「年-」「年/」日期串的 → 红(日期串一律 civil_calendar.format_civil_date /
  format_display_date)。常量里的 '%04d-' '{:04d}-' 与 f-string 里的 {year:04d} 后接 '-' / '/' 都算。
- websrv/ 里 import 的 vendor 引擎(vendor/ 下的包,源码不动):凡入口(含同模块内转调)自己按缺省历法调
  julday / revjul 的,必须在 VENDOR_GREG_ENTRIES 登记;websrv 调它时,日期实参必须是同一函数里
  vendor_greg_ymd(...) 解包出来的名字(民用历 → 同一天的格里历),否则 1582 年以前差 10 天起。
登记键 = (文件, 所在函数),不含行号。
"""
import ast
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR_ROOTS = (ROOT.parent / 'vendor' / 'kinastro', ROOT.parent / 'vendor')
SCAN_DIRS = ('astrostudy', 'websrv')
CIVIL_MODULE = 'astrostudy/civil_calendar.py'

# (文件, 函数) → (显式 GREG_CAL 调用次数, 理由)
GREG_EXPLICIT = {
    ('astrostudy/perpredict.py', '_corePdDeltaTSeconds'): (1, '取十进制年估 ΔT 外推,只在 2018 年以后生效,与历法无关'),
    ('astrostudy/qizheng_election_scan.py', '_lichun_jd'): (2, '按格里历 2 月 4 日取立春牛顿迭代初值(季节对齐)'),
    ('astrostudy/qizheng_election_scan.py', 'pred'): (1, '取连续天文年定年干,与立春初值同在格里历'),
    ('astrostudy/india_election_scan.py', '_greg_local_ymd'): (1, '日出方程按格里历年内日序取季节,内部演算不作显示'),
    ('astrostudy/india_election_scan.py', '_greg_local_jd'): (1, '同上(反函数)'),
    ('astrostudy/india_election_scan.py', '_sun_event'): (2, '同上(年内日序)'),
    ('astrostudy/cetian_ziwei.py', '_get_cny_jd'): (3, '农历新年表按格里历月日登记(旧法回退)'),
    ('astrostudy/cetian_ziwei.py', '_solar_to_lunar'): (1, '同上,按格里历年查新年表'),
    ('astrostudy/perchart_parts/su28_moira.py', '_moira_ayanamsha'): (1, '岁差基准历元常量,按格里历定义'),
    ('astrostudy/acg/validate_acg.py', 'check_rel'): (1, '校验脚本里的固定现代日期'),
    ('websrv/kentang/kinastro_common.py', 'vendor_greg_ymd'): (1, 'vendor 引擎按格里历读日期:民用日 → 同一天的格里历年月日'),
    ('websrv/kentang/kinastro_common.py', 'vendor_civil_ymd'): (1, '同上(反函数:vendor 回写的格里历日期 → 民用历)'),
}

# vendor 引擎里「自己按缺省历法(外推格里历)读年月日」的入口:(vendor 模块, 函数) → (日期三元组个数, 理由)。
# 个数 > 0 的,websrv 调用时前 3×个数 个位置实参必须来自 vendor_greg_ymd(...) 的解包。
VENDOR_GREG_ENTRIES = {
    ('astro.qizheng.calculator', 'compute_chart'): (1, '出生年月日'),
    ('astro.qizheng.qizheng_transit', 'compute_transit'): (1, '流时年月日'),
    ('astro.qizheng.qizheng_transit', 'compute_transit_now'): (0, '取此刻(现代日期),无日期入参'),
    ('astro.qizheng.qizheng_electional', 'find_auspicious_dates'): (2, '择日起止日期'),
}
VENDOR_CONVERTER = 'vendor_greg_ymd'


# (文件, 函数) → 理由:允许出现 04d 日期格式的位置
FORMAT_ALLOW = {
}


def _iter_sources():
    for d in SCAN_DIRS:
        for p in sorted((ROOT / d).rglob('*.py')):
            rel = p.relative_to(ROOT).as_posix()
            if '/__pycache__/' in rel:
                continue
            yield rel, p.read_text(encoding='utf-8')


class _Visitor(ast.NodeVisitor):
    def __init__(self):
        self.stack = []
        self.calls = []      # (func, kind)
        self.formats = []    # func

    def _scope(self):
        return self.stack[-1] if self.stack else None

    def visit_FunctionDef(self, node):
        self.stack.append(node.name)
        self.generic_visit(node)
        self.stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Call(self, node):
        f = node.func
        name = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
        if name in ('julday', 'revjul'):
            need = 5 if name == 'julday' else 2
            cal = None
            if len(node.args) >= need:
                cal = node.args[need - 1]
            for kw in node.keywords:
                if kw.arg in ('cal', 'gregflag', 'flag'):
                    cal = kw.value
            if cal is None:
                kind = 'default'
            elif isinstance(cal, ast.Attribute) and cal.attr == 'GREG_CAL':
                kind = 'greg'
            else:
                kind = 'other'
            self.calls.append((self._scope(), kind, name, node.lineno))
        self.generic_visit(node)

    def visit_Constant(self, node):
        if isinstance(node.value, str) and _is_fixed_width_date_constant(node.value):
            self.formats.append((self._scope(), node.lineno))

    def visit_JoinedStr(self, node):
        # f-string 在 AST 里拆成 FormattedValue / Constant 交替:{year:04d} 的格式说明在 FormattedValue.format_spec 里,
        # 后面的「-」「/」在下一个 Constant 里 —— 只看常量永远匹配不上。格式说明本身也是 JoinedStr,不再往里递归。
        if _is_fixed_width_date_fstring(node):
            self.formats.append((self._scope(), node.lineno))
        for v in node.values:
            if isinstance(v, ast.FormattedValue):
                self.visit(v.value)


def _is_fixed_width_date_constant(v):
    return any(t in v for t in ('04d}-', '04d}/', '%04d-', '%04d/'))


_FIXED_YEAR_SPEC = re.compile(r'^0?4d?$|^04d$|^[+-]?0\d*4d$')


def _spec_text(fv):
    spec = fv.format_spec
    if spec is None:
        return ''
    return ''.join(c.value for c in spec.values if isinstance(c, ast.Constant) and isinstance(c.value, str))


def _is_fixed_width_date_fstring(node):
    vals = node.values
    for i, v in enumerate(vals):
        if isinstance(v, ast.FormattedValue) and _FIXED_YEAR_SPEC.match(_spec_text(v)):
            nxt = vals[i + 1] if i + 1 < len(vals) else None
            if isinstance(nxt, ast.Constant) and isinstance(nxt.value, str) and nxt.value[:1] in '-/':
                return True
    return False


def _formats_in(src):
    v = _Visitor()
    v.visit(ast.parse(src))
    return v.formats


def _scan():
    defaults, greg, formats = [], Counter(), []
    for rel, src in _iter_sources():
        if rel == CIVIL_MODULE:
            continue
        v = _Visitor()
        v.visit(ast.parse(src))
        for scope, kind, name, line in v.calls:
            if kind == 'default':
                defaults.append('{0}:{1} {2}() 在 {3}'.format(rel, line, name, scope))
            elif kind == 'greg':
                greg[(rel, scope)] += 1
        for scope, line in v.formats:
            if (rel, scope) not in FORMAT_ALLOW:
                formats.append('{0}:{1} 在 {2}'.format(rel, line, scope))
    return defaults, greg, formats


def test_no_default_calendar_julday_or_revjul():
    defaults, _greg, _formats = _scan()
    assert not defaults, '不写历法参数的 julday / revjul(用户日期请经 astrostudy.civil_calendar):\n' + '\n'.join(defaults)


def test_explicit_gregorian_calls_are_registered():
    _defaults, greg, _formats = _scan()
    unregistered = {k: n for k, n in greg.items() if k not in GREG_EXPLICIT}
    assert not unregistered, '显式 GREG_CAL 未登记理由:{0}'.format(unregistered)
    drift = {k: (greg.get(k, 0), v[0]) for k, v in GREG_EXPLICIT.items()
             if (ROOT / k[0]).exists() and greg.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


def test_fixed_width_date_detector_has_discrimination():
    bad = [
        "s = f'{year:04d}-{month:02d}-{day:02d}'",
        "s = f'{y:04d}/{m:02d}'",
        "s = f\"{'-' if y < 0 else ''}{abs(y):04d}-{m:02d}\"",
        "s = '%04d-%02d' % (y, m)",
        "s = '{:04d}-{:02d}'.format(y, m)",
        "s = f'{y:4d}-{m}'",
    ]
    good = [
        "s = format_display_date(y, m, d)",
        "s = f'{hour:02d}:{minute:02d}'",
        "s = f'{y:04d}'",
        "s = f'{code:04d} 号'",
        "s = f'{y}-{m:02d}'",
    ]
    for src in bad:
        assert _formats_in(src), '坏例没判出:' + src
    for src in good:
        assert not _formats_in(src), '好例被误判:' + src


def test_no_fixed_width_year_date_format_in_engine_sources():
    _defaults, _greg, formats = _scan()
    assert not formats, '用 04d 拼日期串(负年 / 历史纪年会错,改用 civil_calendar.format_civil_date / format_display_date):\n' + '\n'.join(formats)


def _resolve_vendor_module(modname):
    rel = modname.replace('.', '/')
    for root in VENDOR_ROOTS:
        for cand in (root / (rel + '.py'), root / rel / '__init__.py'):
            if cand.exists():
                return cand
    return None


def _default_calendar_calls(node):
    """node 子树里不写历法参数的 julday / revjul 调用个数。"""
    n = 0
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call):
            f = sub.func
            name = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
            if name in ('julday', 'revjul'):
                need = 5 if name == 'julday' else 2
                has = len(sub.args) >= need or any(kw.arg in ('cal', 'gregflag', 'flag') for kw in sub.keywords)
                if not has:
                    n += 1
    return n


def _vendor_reads_default_calendar(path, name, _cache={}):
    """vendor 模块里的函数 / 类 name(连同它在同模块内转调的函数)是否按缺省历法调 julday / revjul。"""
    key = str(path)
    if key not in _cache:
        tree = ast.parse(path.read_text(encoding='utf-8'))
        defs = {n.name: n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))}
        _cache[key] = defs
    defs = _cache[key]
    seen, todo = set(), [name]
    while todo:
        cur = todo.pop()
        if cur in seen or cur not in defs:
            continue
        seen.add(cur)
        node = defs[cur]
        if _default_calendar_calls(node):
            return True
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id in defs:
                todo.append(sub.func.id)
    return False


def _vendor_imports():
    """websrv/ 各文件 import 的 vendor 名字:[(websrv 文件, 本地名, vendor 模块, 原名)]。"""
    out = []
    for p in sorted((ROOT / 'websrv').rglob('*.py')):
        rel = p.relative_to(ROOT).as_posix()
        if '/__pycache__/' in rel:
            continue
        tree = ast.parse(p.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and not node.level:
                if node.module.split('.')[0] in ('websrv', 'astrostudy', 'flatlib'):
                    continue
                vpath = _resolve_vendor_module(node.module)
                if vpath is None:
                    continue
                for alias in node.names:
                    out.append((rel, alias.asname or alias.name, node.module, alias.name, vpath))
    return out


def test_vendor_engine_default_calendar_entries_are_registered():
    flagged = set()
    for _rel, _local, mod, name, vpath in _vendor_imports():
        if _vendor_reads_default_calendar(vpath, name):
            flagged.add((mod, name))
    unregistered = sorted(flagged - set(VENDOR_GREG_ENTRIES))
    assert not unregistered, ('websrv 调用的 vendor 入口按缺省历法(格里历)读日期,未登记(登记后调用处必须经 '
                              + VENDOR_CONVERTER + ' 换算):' + repr(unregistered))
    stale = sorted(set(VENDOR_GREG_ENTRIES) - flagged)
    assert not stale, '登记的 vendor 入口已不再被 websrv 调用或不再按缺省历法读日期(清掉登记):' + repr(stale)


def _converter_bound_names(func_node):
    names = set()
    for sub in ast.walk(func_node):
        if isinstance(sub, ast.Assign) and isinstance(sub.value, ast.Call):
            f = sub.value.func
            fname = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
            if fname != VENDOR_CONVERTER:
                continue
            for tgt in sub.targets:
                if isinstance(tgt, (ast.Tuple, ast.List)):
                    names.update(e.id for e in tgt.elts if isinstance(e, ast.Name))
    return names


def _vendor_date_call_violations():
    imports = _vendor_imports()
    by_file = {}
    for rel, local, mod, name, _vpath in imports:
        entry = VENDOR_GREG_ENTRIES.get((mod, name))
        if entry and entry[0] > 0:
            by_file.setdefault(rel, {})[local] = entry[0]
    bad = []
    for rel, wanted in sorted(by_file.items()):
        tree = ast.parse((ROOT / rel).read_text(encoding='utf-8'))
        funcs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        for fn in funcs:
            bound = _converter_bound_names(fn)
            for sub in ast.walk(fn):
                if not (isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id in wanted):
                    continue
                need = 3 * wanted[sub.func.id]
                args = sub.args[:need]
                ok = len(args) == need and all(isinstance(a, ast.Name) and a.id in bound for a in args)
                if not ok:
                    bad.append('{0}:{1} {2}() 在 {3}'.format(rel, sub.lineno, sub.func.id, fn.name))
    return bad


def test_vendor_date_arguments_go_through_converter():
    bad = _vendor_date_call_violations()
    assert not bad, ('喂 vendor 引擎的年月日没有经 ' + VENDOR_CONVERTER
                     + '(民用历 → 同一天的格里历;1582 年以前直接交民用日期会差 10 天起):\n' + '\n'.join(bad))


# ── stdlib datetime 承载民用日期 ─────────────────────────────────────────────────────────────
# stdlib datetime / date 是外推格里历(1~9999 年):拿它承载用户的民用日期,1582 年以前的儒略闰日(1500-02-29)直接
# 抛错,加减天数 / 比较按格里历算,公元前根本放不下。用户日期的时刻承载一律经 civil_calendar.civil_datetime /
# CivilDateTime。下表登记「确实可以用 stdlib」的位置(现代日期、显式换成 proleptic 格里历真时刻、只承载年份等)。
# 键 = (文件, 所在函数) → (次数, 理由);新增未登记 = 红,次数与源码不符 = 红。
STDLIB_DT_ALLOW = {
    ('astrostudy/india/jyotish_parts/helpers.py', 'get_local_birth_datetime'):
        (1, '大运时间轴是 proleptic 格里历真时刻:1582 年以前先经 _julian_label_to_gregorian 换同一天,公元前返回 None'),
    ('astrostudy/india_election_scan.py', '_vara_of_rise'): (1, '年月日来自 revjul(GREG_CAL) 的格里历标签,只取星期'),
    ('websrv/webindiasrv.py', '_dasha_link_at'): (1, '与大运段界 ISO 比较:1582 年以前已换同一天的格里历、公元前提前返回'),
    ('websrv/webindiasrv.py', '_compute_prashna'): (1, '问时大运路径的真时刻:1582 年以前已换同一天的格里历,公元前不建'),
    ('websrv/webtaixuansrv.py', '_lunar_payload'): (1, '仅 in_cnlunar_domain(1900–2099)分支'),
    ('websrv/webtaixuansrv.py', '_ganzhi_payload'): (1, '仅 in_cnlunar_domain(1900–2099)的降级分支,回包标 degraded'),
    ('websrv/webtiebansrv.py', '_year_dt'): (1, '只承载年份见证(1 月 1 日在两种历法里都存在),引擎只读 .year'),
    ('websrv/webqizhengkinsrv.py', '_parse_iso_time'): (1, "strptime 只认 '%H:%M[:%S]' 时刻,不含日期"),
}
_STDLIB_DT_BASES = ('datetime', 'date', '_dt.datetime', '_dt.date', 'datetime.datetime', 'datetime.date', 'dt.datetime', 'dt.date')


def _stdlib_dt_calls(src):
    """源码里「非全常量实参的 datetime(...) / date(...) 构造」与 strptime 调用:[(所在函数, 行号)]。"""
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

        def visit_Call(self, node):
            f = node.func
            name = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
            base = ast.get_source_segment(src, f) or ''
            if name in ('datetime', 'date') and base in _STDLIB_DT_BASES and node.args \
                    and not all(isinstance(a, ast.Constant) for a in node.args):
                out.append((self.stack[-1] if self.stack else None, node.lineno))
            elif name == 'strptime':
                out.append((self.stack[-1] if self.stack else None, node.lineno))
            self.generic_visit(node)

    V().visit(tree)
    return out


def _stdlib_dt_scan():
    found, where = Counter(), {}
    for rel, src in _iter_sources():
        if rel == CIVIL_MODULE:
            continue
        for scope, line in _stdlib_dt_calls(src):
            found[(rel, scope)] += 1
            where.setdefault((rel, scope), []).append(line)
    return found, where


def test_stdlib_datetime_carrier_is_registered():
    found, where = _stdlib_dt_scan()
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in STDLIB_DT_ALLOW]
    assert not bad, ('用 stdlib datetime / date / strptime 承载日期(1582 年以前的民用日期按格里历算会错、1500-02-29 抛错;'
                     '用户日期改用 civil_calendar.civil_datetime / CivilDateTime,确属现代日期的登记理由):\n' + '\n'.join(bad))
    drift = {k: (found.get(k, 0), v[0]) for k, v in STDLIB_DT_ALLOW.items()
             if (ROOT / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


# 卜类后端直接把民用年月日交给的 vendor 引擎(太乙 / 奇门 / 皇极):节气 / 干支层收发 sxtwl 的民用历标签,
# 时刻承载一律经 kin_year_domain.civil_moment(CivilDateTime)。stdlib datetime 在这里 = 1500-02-29 整盘起不了。
VENDOR_CIVIL_PACKAGES = ('kintaiyi/src/kintaiyi', 'kinqimen', 'kinwangji/kinwangji', 'kinastro/astro/wangji', 'kinjinkou')
VENDOR_STDLIB_DT_ALLOW = {
    ('kintaiyi/src/kintaiyi/cli.py', '_parse_date_time'): (2, '命令行工具解析参数,服务不经此路'),
    # 金口诀服务只用 kinjinkou.jinkoujue(paipan 只读年月日时分五字段);平铺 jieqi.py 只给独立演示页用,
    # wannianli 包被 import 但服务路径不调用。
    ('kinjinkou/jieqi.py', 'get_jieqi_start_date'): (2, '平铺副本,只给独立演示页用,服务不导入'),
    ('kinjinkou/jieqi.py', 'get_before_jieqi_start_date'): (1, '同上'),
    ('kinjinkou/jieqi.py', 'get_next_jieqi_start_date'): (1, '同上'),
    ('kinjinkou/jieqi.py', 'jq'): (1, '同上'),
    ('kinjinkou/kinjinkou/wannianli/_calendar.py', '_datetimeStr2Obj'): (1, '万年历包,金口诀服务路径不调用'),
    ('kinjinkou/kinjinkou/wannianli/_calendar.py', 'solarTerm'): (2, '同上'),
    ('kinjinkou/kinjinkou/wannianli/_calendar.py', 'solarTermJie'): (3, '同上'),
    ('kinjinkou/kinjinkou/wannianli/_calendar.py', '_rizhu'): (1, '同上'),
    ('kinjinkou/kinjinkou/wannianli/_calendar.py', '_rifeixing'): (2, '同上'),
    ('kinjinkou/kinjinkou/wannianli/_realsolar.py', '_datetimeStr2Obj'): (2, '同上'),
    ('kinjinkou/kinjinkou/wannianli/wannianli_api.py', 'get_GanzhiYears'): (1, '同上'),
    ('kinjinkou/kinjinkou/wannianli/wannianli_api.py', 'get_GanzhiOneYear'): (2, '同上'),
    ('kinjinkou/kinjinkou/wannianli/wannianli_api.py', 'get_GanzhiOneDay'): (1, '同上'),
}


def _vendor_stdlib_dt_scan():
    found, where = Counter(), {}
    vroot = ROOT.parent / 'vendor'
    for pkg in VENDOR_CIVIL_PACKAGES:
        for p in sorted((vroot / pkg).rglob('*.py')):
            rel = p.relative_to(vroot).as_posix()
            if '/__pycache__/' in rel or p.name.startswith('test_'):
                continue
            for scope, line in _stdlib_dt_calls(p.read_text(encoding='utf-8')):
                found[(rel, scope)] += 1
                where.setdefault((rel, scope), []).append(line)
    return found, where


def test_vendor_divination_engines_carry_civil_moments():
    found, where = _vendor_stdlib_dt_scan()
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in VENDOR_STDLIB_DT_ALLOW]
    assert not bad, ('卜类 vendor 引擎用 stdlib datetime / date 承载民用日期(1582 年以前儒略闰日抛错、日差按格里历算);'
                     '改用 kin_year_domain.civil_moment:\n' + '\n'.join(bad))
    vroot = ROOT.parent / 'vendor'
    drift = {k: (found.get(k, 0), v[0]) for k, v in VENDOR_STDLIB_DT_ALLOW.items()
             if (vroot / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


def _silent_day_rewrites(src):
    """try 里构造 datetime / date、except ValueError(或裸 except / Exception)里又构造一次 —— 「这天不存在就换一天」的静默改日。"""
    tree = ast.parse(src)
    hits = []

    def _has_dt_ctor(nodes):
        for n in nodes:
            for sub in ast.walk(n):
                if isinstance(sub, ast.Call):
                    f = sub.func
                    name = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
                    if name in ('datetime', 'date', 'CivilDateTime', 'civil_datetime') or (
                            isinstance(f, ast.Attribute) and f.attr == 'replace' and any(
                                kw.arg in ('year', 'month', 'day') for kw in sub.keywords)):
                        return True
        return False

    for node in ast.walk(tree):
        if isinstance(node, ast.Try) and _has_dt_ctor(node.body):
            for h in node.handlers:
                t = h.type
                names = []
                if t is None:
                    names = ['']
                elif isinstance(t, ast.Name):
                    names = [t.id]
                elif isinstance(t, ast.Tuple):
                    names = [e.id for e in t.elts if isinstance(e, ast.Name)]
                if any(n in ('', 'ValueError', 'Exception') for n in names) and _has_dt_ctor(h.body):
                    hits.append(h.lineno)
    return hits


# 「换一天」确有明文口径的位置:(文件, 行内容片段) 不用行号;此处为空 = 全仓不许静默改日。
SILENT_DAY_REWRITE_ALLOW = set()


def test_no_silent_day_rewrite_on_invalid_date():
    bad = []
    for rel, src in _iter_sources():
        for line in _silent_day_rewrites(src):
            bad.append('{0}:{1}'.format(rel, line))
    assert not bad, ('日期不存在时静默换成别的日子(旧 parse_datetime 把 1500-02-29 改成 2 月 1 日,盘头日期与实际排盘差 28 天);'
                     '不存在的日期应报错,存在与否经 civil_calendar.civil_ymd_valid 判:\n' + '\n'.join(bad))


def test_stdlib_and_rewrite_detectors_have_discrimination():
    bad_ctor = "def f(y, m, d):\n    return datetime(y, m, d)\n"
    good_ctor = "def f():\n    return datetime(2000, 1, 1)\n"
    assert _stdlib_dt_calls(bad_ctor) == [('f', 2)]
    assert _stdlib_dt_calls(good_ctor) == []
    assert _stdlib_dt_calls("def g(t):\n    return _dt.datetime.strptime(t, '%Y-%m-%d')\n") == [('g', 2)]
    rewrite = ("def p(y, m, d):\n    try:\n        dt = datetime(y, m, d)\n    except ValueError:\n"
               "        dt = datetime(y, m, 1)\n    return dt\n")
    assert _silent_day_rewrites(rewrite) == [4]
    replace_rewrite = ("def p(dt, n):\n    try:\n        return dt.replace(year=dt.year + n)\n    except ValueError:\n"
                       "        return dt.replace(month=2, day=28, year=dt.year + n)\n")
    assert _silent_day_rewrites(replace_rewrite) == [4]
    honest = "def p(y, m, d):\n    try:\n        return datetime(y, m, d)\n    except ValueError:\n        raise\n"
    assert _silent_day_rewrites(honest) == []
