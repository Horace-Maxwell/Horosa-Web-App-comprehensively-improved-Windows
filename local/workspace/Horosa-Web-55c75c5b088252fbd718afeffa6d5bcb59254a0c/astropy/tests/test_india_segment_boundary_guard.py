"""段界取序源码护栏:印占引擎全集(astrostudy/india/** + 印度择日扫描 + 宿表 + 印占服务层)里,
按「非整除段宽」(13°20′ / 3°20′ / 0°12′ / 宿足 …)取段序一律走 primitives.segment_index。

病理:精确落在段界的浮点值(如 93.333… = 7 × 13°20′)做 value / span 得 6.9999999999 → int() 判到前一段。
裸 int(x // span) 在宿 / 步 / 分盘 / Nadi 格各处反复出现过;单修一处、别处照旧 —— 故按源码扫全集。
允许的裸除:除数为整除段宽常量(30 / 10 / 6 / 12 …,浮点精确),或行内写明 `segment-ok:` 理由(时间片 / 步数)。
"""
import ast
import glob
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASTROPY = os.path.dirname(HERE)
SAFE_DIVISORS = {1, 2, 3.75, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 36, 45, 48, 60, 90, 120, 360}


def _files():
    out = sorted(glob.glob(os.path.join(ASTROPY, 'astrostudy', 'india', '**', '*.py'), recursive=True))
    out += [os.path.join(ASTROPY, 'astrostudy', 'india_election_scan.py'),
            os.path.join(ASTROPY, 'astrostudy', 'nakshatra.py'),
            os.path.join(ASTROPY, 'websrv', 'webindiasrv.py')]
    return out


def _div_of(expr):
    if isinstance(expr, ast.BinOp) and isinstance(expr.op, (ast.FloorDiv, ast.Div)):
        return expr
    if isinstance(expr, ast.BinOp) and isinstance(expr.op, ast.Add):     # floor(a / b + eps)
        return _div_of(expr.left)
    return None


def _is_floor_call(node):
    f = node.func
    return (isinstance(f, ast.Name) and f.id in ('int', 'floor')) or \
        (isinstance(f, ast.Attribute) and f.attr == 'floor')


def violations(src, name='<src>'):
    lines = src.splitlines()
    bad = []
    for node in ast.walk(ast.parse(src)):
        if not (isinstance(node, ast.Call) and _is_floor_call(node) and node.args):
            continue
        arg = node.args[0]
        if isinstance(arg, ast.Call) and _is_floor_call(arg) and arg.args:   # int(math.floor(...))
            continue                                                           # 内层 floor 自会被扫到
        div = _div_of(arg)
        if div is None:
            continue
        d = div.right
        if isinstance(d, ast.Constant) and isinstance(d.value, (int, float)) and float(d.value) in SAFE_DIVISORS:
            continue
        if 'segment-ok:' in lines[node.lineno - 1]:
            continue
        bad.append('%s:%d: %s' % (name, node.lineno, lines[node.lineno - 1].strip()[:100]))
    return bad


def test_no_bare_segment_division_in_india_engine():
    bad = []
    for f in _files():
        bad += violations(open(f, encoding='utf-8').read(), os.path.relpath(f, ASTROPY))
    assert not bad, '裸 int(x / span) 取段序(改用 primitives.segment_index):\n' + '\n'.join(bad)


def test_guard_bites():
    src = ("NAK = 360.0 / 27.0\n"
           "a = int(x // NAK)\n"
           "b = int((y % 30.0) / (30.0 / 9.0))\n"
           "c = int(z // 30.0)\n"
           "d = int(t / step)   # segment-ok: 时间步\n"
           "import math\ne = int(math.floor(w / (10.0 / 3.0)))\n")
    bad = violations(src)
    assert [b.split(':')[1] for b in bad] == ['2', '3', '7'], bad


def test_exact_boundaries_across_converted_sites():
    """抽查已改站点:精确段界一律归后一段。"""
    from astrostudy.india_election_scan import nak_pada_of, NAK_SIZE
    from astrostudy.india.sensitive_points import _navamsa_index
    from astrostudy.india.shadbala_bphs import _navamsa_sign
    for k in range(108):
        assert nak_pada_of(k * NAK_SIZE / 4.0) == k % 4 + 1, k
        assert _navamsa_index(k * 10.0 / 3.0) == k, k
    # 3°20′ 整倍处的 D9:白羊 3°20′ = 第 2 navamsa(金牛)
    assert _navamsa_sign(10.0 / 3.0) == 'Taurus'
