"""静态守卫:websrv 与 astrostudy 里「宽 except 后只 pass / continue」一律登记理由。

病理:服务层把会影响结果的失败静默吞掉 —— 奇门设日界开关失败被吞(本请求按本线程上一个请求的口径算)、太玄权威四柱失败
静默回落 cnlunar(不认日界 / 时区)、印占校时事件日期读不出被跳过、七政择日的附加星体值形坏就从盘上消失 —— 回包都没有任何标记。
印占引擎同病:Panchaka 五忌、KP 宫头分主 / RP / 意义星、大运条件上下文整块失败时静默消失(rasi_dasha 漏一个 import 被吞,
Kalachakra 就整块不见)—— 引擎子块一律经 JyotishEngine._note_partial 落账,compute() 汇入 partialErrors。
判据(AST):websrv/ 与 astrostudy/ 下 `except:` / `except Exception:` / `except BaseException:` 的处理体只有一条 pass / continue → 必须在下表登记
(文件, 所在函数) → (次数, 理由);会影响排盘结果的失败不许登记,改成落账(partialErrors / degraded / skipped…)或整请求报错。
"""
import ast
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SILENT_EXCEPT_ALLOW = {
    ('websrv/horosa_engine_common.py', 'display_text'): (1, 'zhconv 可选依赖失败 → 不做繁简转换,只影响显示字形'),
    ('websrv/horosa_engine_common.py', 'timezone_to_float'): (1, '先按纯数字读,失败再按 ±HH:MM 读(下一步兜住)'),
    ('websrv/horosa_engine_common.py', 'coord_to_float'): (1, '先按纯数字读,失败再按度分秒读(下一步兜住)'),
    ('websrv/kentang/kinastro_common.py', 'display_text'): (1, 'zhconv 可选依赖失败 → 不做繁简转换,只影响显示字形'),
    ('websrv/kentang/kinastro_common.py', 'source_text'): (1, '同上(反向转换)'),
    ('websrv/webchartsrv.py', '_chart_port_free'): (1, '端口探测:绑不上即视为占用'),
    ('websrv/webchartsrv.py', '_pids_listening_on'): (1, '进程枚举失败即视为无'),
    ('websrv/webchartsrv.py', '_kill_pid'): (1, '清理旧进程失败不影响本进程'),
    ('websrv/webqizhengelectionsrv.py', '_rise_set'): (2, '先按真实纬度、失败按赤道重试;都失败返回 None,出没时刻显示缺项'),
    ('websrv/startup_ledger.py', 'ledger_mark'): (1, '启动账本写入失败不影响排盘'),
    ('websrv/webindiasrv.py', 'warmup_india'): (1, '启动预热失败不影响请求(请求时照常现算)'),
    ('websrv/webplanetariumsrv.py', '_read_star_catalog'): (1, '随包星表数据文件的坏行略过(不是用户输入)'),
    ('websrv/webqizhengkinsrv.py', '_parse_iso_time'): (1, '逐个时刻格式试,全败回落 fallback 时刻'),
    ('websrv/webwuzhaosrv.py', '_preload_year_domain'): (1, '可选模块预加载,失败时请求路径照常导入'),
}


# astrostudy/ 的存量登记(新增未登记 = 红)。理由写明「失败时会怎样」;会让整段结果消失的块不许登记,改成落账。
ASTROSTUDY_SILENT_EXCEPT_ALLOW = {
    ('astrostudy/acg/ACGraph.py', '_lotsLines'): (1, '希腊点线:所需行星缺(窄域天体)时不画这几条点线,其余线照出'),
    ('astrostudy/acg/ACGraph.py', '_customLot'): (1, '自定义点公式里某星缺:该星不进取值表,公式缺项时整点不画'),
    ('astrostudy/acg/ACGraph.py', '_starLines'): (1, '恒星不在星表 / 求位失败:这颗恒星不画线'),
    ('astrostudy/astroextra_parts/analysis.py', 'compute_aspect_dynamics'): (2, '月交弯点 / 留点判据的可选附注,缺星即不附'),
    ('astrostudy/astroextra_parts/analysis.py', 'compute_classical_patterns'): (1, '点缺星座字段时这一对不参与格局判定'),
    ('astrostudy/astroextra_parts/calendars.py', '_babylon_star_positions'): (1, '星表缺这颗恒星:不列这一行'),
    ('astrostudy/astroextra_parts/calendars.py', 'compute_egyptian_calendar'): (1, '上升旬主是可选附注,缺上升时不出'),
    ('astrostudy/astroextra_parts/cycles.py', 'compute_planet_cycles'): (1, '站心坐标设不上时按地心算(只影响月亮视差级精度)'),
    ('astrostudy/astroextra_parts/ephemeris.py', 'compute_eclipse_detail'): (1, '食详情搜索失败:该项不出,其余星历照出'),
    ('astrostudy/astroextra_parts/progressions.py', '_decls_at'): (1, '逐星赤纬,窄域天体越域略过'),
    ('astrostudy/election_scan.py', 'lot_lon'): (1, '月亮地平高度取不到时按昼夜原判(与盘面口径一致)'),
    ('astrostudy/germany/declination.py', '_planet_decls'): (1, '盘里没有的星不列'),
    ('astrostudy/germany/declination.py', '_tnp_decls'): (2, '汉堡假想星逐颗求位 / 求赤纬,失败的那颗不列'),
    ('astrostudy/germany/midpoint.py', '__init__'): (1, '汉堡假想星逐颗求位,失败的那颗不进中点盘'),
    ('astrostudy/guostarsect/guo74.py', 'compute'): (1, '逐星落宿,盘里没有的星略过'),
    ('astrostudy/guostarsect/guostarsect.py', 'allTerm'): (1, '同上'),
    ('astrostudy/india/india_chart_kernel.py', 'reinit'): (1, '宫内星名单(显示用)挂不上时略过,星曜本身的宫位已写入'),
    ('astrostudy/india/rasi_dasha.py', '_rasi_aspect_count_to_sign'): (1, '星座照数计数:非法星座名不计'),
    ('astrostudy/india/rasi_dasha.py', '_benefic_lord_support_count'): (1, '同上'),
    ('astrostudy/jieqi/YearJieQi.py', '_logJieqiFastApproach'): (1, '调试日志写不出不影响节气'),
    ('astrostudy/perchart.py', 'setupPlanets'): (2, '七星经度缓存(野逸判据)/ 远近地点·数增减趋势是逐星附注,缺星或求速失败不附该字段'),
    ('astrostudy/perchart_parts/aspects.py', 'getReceptions'): (1, '逐对互容判定,盘里没有的星略过'),
    ('astrostudy/perchart_parts/aspects.py', '_computeMutuals'): (1, '逐对互容 / 互陷判定,缺星的一对略过'),
    ('astrostudy/perchart_parts/aspects.py', 'getImmediateAspects'): (1, '逐星即将成相,缺星略过'),
    ('astrostudy/perchart_parts/aspects.py', '_assignSunPos'): (1, '逐星日距状态,缺星略过'),
    ('astrostudy/perchart_parts/aspects.py', 'getAspects'): (1, '逐星相位,缺星略过'),
    ('astrostudy/perchart_parts/aspects.py', 'getSignAspects'): (2, '逐对星座相位,缺星略过'),
    ('astrostudy/perchart_parts/aspects.py', 'getParallel'): (2, '逐对平行,缺星略过'),
    ('astrostudy/perchart_parts/besiege.py', 'surroundPlanets'): (1, '逐星围攻判定,缺星略过'),
    ('astrostudy/perchart_parts/besiege.py', 'surroundAttack'): (2, '同上'),
    ('astrostudy/perchart_parts/besiege.py', '_computeSurroundAttacks'): (1, '同上'),
    ('astrostudy/perchart_parts/besiege.py', '_besiege_defense'): (1, '解围星缺时不计这一项'),
    ('astrostudy/perchart_parts/besiege.py', 'besiegementDetail'): (1, '日 / 木制约是附注,互容表取不到时不附'),
    ('astrostudy/perchart_parts/besiege.py', 'orientalOccidental'): (2, '逐星东出西入,缺星略过'),
    ('astrostudy/perchart_parts/besiege.py', 'orientalOccidentalHouses'): (1, '同上(按宫)'),
    ('astrostudy/perchart_parts/lots.py', '_applyLotVariants'): (5, '希腊点流派变体逐项改写,所需星缺时该点保持缺省公式'),
    ('astrostudy/perchart_parts/planets.py', '_phasis_event'): (1, '偕日升 / 降求根失败(极区等):不附该事件'),
    ('astrostudy/perchart_parts/planets.py', 'setupJoy'): (1, '逐星喜乐宫,缺星座字段的略过'),
    ('astrostudy/perchart_parts/planets.py', '_applyTopoMoon'): (2, '站心月亮可选;失败保持地心月亮与原希腊点'),
    ('astrostudy/perchart_parts/planets.py', '_diurnalWithSectBuffer'): (1, '日出日没求不到(极昼极夜)时按地平原判'),
    ('astrostudy/perchart_parts/planets.py', 'setupDignities'): (3, '逐星尊贵 / 交点入旺,缺星略过'),
    ('astrostudy/perchart_parts/su28.py', 'getGufaLichengSu28'): (1, '年份读不出时不做岁差改正(古法锚点原值)'),
    ('astrostudy/perchart_parts/su28.py', 'fillPlanetSu28'): (1, '逐星落宿,缺星略过'),
    ('astrostudy/perchart_parts/timing.py', 'getTimerStar'): (2, '时主星两种求法逐级回退,都失败时不出时主'),
    ('astrostudy/perpredict.py', '_fill_user_ayan'): (1, '自定义岁差附参缺失时按命名岁差'),
    ('astrostudy/perpredict.py', '_pdTimeKeyScale'): (1, '每盘常数型钥匙求日行失败时退回 Ptolemy 1.0'),
    ('astrostudy/perpredict.py', '_pdExtraSignificatorPoints'): (4, '附加应星(下降 / 天底 / 朔望 / 灵点)逐个可选,缺即不进表'),
    ('astrostudy/perpredict.py', '_pdFixedStarPoints'): (1, '逐颗恒星,求位失败的不进表'),
    ('astrostudy/perpredict.py', '_pdLotPoints'): (1, '逐个希腊点,缺的不进表'),
    ('astrostudy/perpredict.py', '_pdIntermediateCuspPoints'): (1, '逐个中间宫头,缺的不进表'),
    ('astrostudy/perpredict.py', '_pdReleaseContext'): (4, '释放星候选逐个取,缺的不参与选定'),
    ('astrostudy/perpredict.py', 'getPdPoles'): (1, '逐星极点,求不出的不列'),
    ('astrostudy/perpredict.py', 'getPdReleaseInfo'): (1, '逐星经度,缺的不列'),
    ('astrostudy/perpredict.py', 'getPrimaryDirectionRelease'): (1, '逐个迫星求弧,求不出的不进表'),
    ('astrostudy/perpredict.py', '_pdEngineChartData'): (2, '逐星 / 逐轴取位,缺的不交引擎'),
    ('astrostudy/perpredict.py', 'getDiceChart'): (1, '相位表缺这颗星时不加入关联星集'),
    ('astrostudy/symbolicdir.py', 'compute'): (1, '推运盘逐星重算宫位,宫头缺时保留原宫'),
    ('astrostudy/xuanshi/queries.py', '_inject_translations'): (1, '译文表缺失(旧数据包)时不注入译文,原文照出'),
    ('astrostudy/xuanshi/textquery.py', 'script_variants'): (1, '繁简变体函数失败时只按原字形检索'),
}


def _silent_excepts(src):
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

        def visit_ExceptHandler(self, node):
            t = node.type
            broad = t is None or (isinstance(t, ast.Name) and t.id in ('Exception', 'BaseException'))
            if broad and len(node.body) == 1 and isinstance(node.body[0], (ast.Pass, ast.Continue)):
                out.append((self.stack[-1] if self.stack else None, node.lineno))
            self.generic_visit(node)

    V().visit(tree)
    return out


def _scan(subdir='websrv'):
    found, where = Counter(), {}
    for p in sorted((ROOT / subdir).rglob('*.py')):
        rel = p.relative_to(ROOT).as_posix()
        if '/__pycache__/' in rel:
            continue
        for scope, line in _silent_excepts(p.read_text(encoding='utf-8')):
            found[(rel, scope)] += 1
            where.setdefault((rel, scope), []).append(line)
    return found, where


def test_silent_excepts_are_registered():
    found, where = _scan()
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in SILENT_EXCEPT_ALLOW]
    assert not bad, ('服务层宽 except 静默吞错(影响结果的失败要落账或报错;确属无害的登记理由):\n' + '\n'.join(bad))


def test_registered_counts_match_source():
    found, _where = _scan()
    drift = {k: (found.get(k, 0), v[0]) for k, v in SILENT_EXCEPT_ALLOW.items()
             if (ROOT / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)


def test_detector_self_check():
    src = ("def a():\n    try:\n        x()\n    except Exception:\n        pass\n"
           "def b():\n    for i in r:\n        try:\n            y()\n        except:\n            continue\n"
           "def c():\n    try:\n        z()\n    except ValueError:\n        pass\n"
           "def d():\n    try:\n        z()\n    except Exception:\n        errs.append('z')\n")
    assert [s for s, _l in _silent_excepts(src)] == ['a', 'b']


def test_astrostudy_silent_excepts_are_registered():
    found, where = _scan('astrostudy')
    bad = ['{0}:{1} 在 {2}'.format(k[0], where[k], k[1]) for k in found if k not in ASTROSTUDY_SILENT_EXCEPT_ALLOW]
    assert not bad, ('引擎层宽 except 静默吞错(整段结果消失要落账:印占经 _note_partial、其余回 partialErrors;'
                     '确属逐对象可选项的登记理由):\n' + '\n'.join(bad))
    drift = {k: (found.get(k, 0), v[0]) for k, v in ASTROSTUDY_SILENT_EXCEPT_ALLOW.items()
             if (ROOT / k[0]).exists() and found.get(k, 0) != v[0]}
    assert not drift, '登记次数与源码不符(实际, 登记):{0}'.format(drift)

