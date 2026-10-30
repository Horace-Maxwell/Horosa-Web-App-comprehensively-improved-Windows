# -*- coding: utf-8 -*-
"""主限法几何口径的单一选择点:改进(缺省,严格球面几何,见 pd_semiarc_pole / pd_mundane)与经典(传统程序写法,
见 pd_classic)。各内核一律经 functions(variant) 取函数,不直接点名某一档。

两档只在半弧法(Placidus)、极下法(Regiomontanus / Campanus)、黄道 Topocentric / Horizontal / Koch、世俗 Horizontal、
Field Plane(合相点黄纬与「忽略迫星黄纬」两处)、
世俗 Alcabitius / Placidus / Regiomontanus /
Campanus / Porphyry 位置与世俗子午平行上不同;Along-Ecliptic、Morinus、Meridian、Equal、核心赤经法与轴穿越弧两档相同。"""
from types import SimpleNamespace

VARIANTS = ('improved', 'classic')
DEFAULT_VARIANT = 'improved'

# 两档真有差别的组合 (盘类 pdtype, 弧算法 pdProjection, 盘面宫制 pdFrame 或 '*', 是否只在世俗平行开时):
# 前端「弧算法」下拉按这张表给受影响的方法列「改进 / 经典」两项(primaryDirectionSync.PD_GEOMETRY_APPLIES 同表,
# 有测试逐项比对);其余组合两档逐行相同,不列两项。In Mundo 下 Ptolemy 的世俗核由宫制决定,所以带宫制。
APPLIES = (
    (0, 'placidus', '*', False), (0, 'regiomontanus', '*', False), (0, 'campanus', '*', False),
    (0, 'in_zodiaco_abs', '*', False), (0, 'topocentric', '*', False),
    (0, 'horizontal', '*', False), (0, 'koch', '*', False), (1, 'horizontal', '*', False),
    (4, 'placidus', '*', False), (4, 'regiomontanus', '*', False), (4, 'campanus', '*', False),
    (4, 'in_zodiaco_abs', '*', False),
    # Field Plane 其余借黄纬的方法:经典 = 合相点同样借「第一次走到」的黄纬、忽略迫星黄纬不起作用(见 perpredict.getPrimaryDirectionByF)
    (4, 'ptolemy', '*', False), (4, 'morinus', '*', False), (4, 'zodiacal', '*', False), (4, 'ra_direct', '*', False),
    (4, 'placidus_under_pole', '*', False), (4, 'topocentric', '*', False), (4, 'horizontal', '*', False), (4, 'koch', '*', False),
    (1, 'ptolemy', 'alcabitius', False), (1, 'ptolemy', 'porphyry', False),
    (1, 'placidus', '*', False), (1, 'regiomontanus', '*', False), (1, 'campanus', '*', False),
    (1, 'ptolemy', 'meridian', True), (1, 'ptolemy', 'equal', True), (1, 'ptolemy', 'equal_hour_circle', True),
    (1, 'morinus', '*', True),
)


def applies(pdtype, projection, frame, parallel=False):
    """该组合下几何口径两档是否有差别(见 APPLIES)。"""
    t = int(pdtype or 0)
    for at, ap, af, need_par in APPLIES:
        if at == t and ap == projection and af in ('*', frame) and (parallel or not need_par):
            return True
    return False


def normalize_variant(value):
    v = '{0}'.format(value if value is not None else '').strip().lower()
    return v if v in VARIANTS else DEFAULT_VARIANT


def functions(variant=DEFAULT_VARIANT):
    from astrostudy import pd_classic as _cl
    from astrostudy import pd_mundane as _pm
    from astrostudy import pd_semiarc_pole as _sp
    if normalize_variant(variant) == 'classic':
        return SimpleNamespace(
            semiarc_arc=_cl.semiarc_arc, pole_circle_arc=_cl.pole_circle_arc, topocentric_arc=_cl.topocentric_arc,
            horizontal_arc=_cl.horizontal_arc, koch_arc=_cl.koch_arc, horizontal_mundane_arc=_cl.horizontal_mundane_arc,
            alcabitius_mundane_arc=_cl.alcabitius_mundane_arc, placidus_mundane_arc=_cl.placidus_mundane_arc,
            meridian_parallel_arc=_cl.meridian_parallel_arc,
            morinus_meridian_parallel_arc=_cl.morinus_meridian_parallel_arc,
            placidus_meridian_parallel_arc=_cl.placidus_meridian_parallel_arc,
            position_circle_meridian_parallel_arc=_cl.position_circle_meridian_parallel_arc,
            position_circle_mundane_arc=_cl.position_circle_mundane_arc,
            porphyry_mundane_target_lon=_cl.porphyry_mundane_target_lon)
    return SimpleNamespace(
        semiarc_arc=_sp.semiarc_arc, pole_circle_arc=_sp.pole_circle_arc, topocentric_arc=_sp.topocentric_arc,
        horizontal_arc=_sp.horizontal_arc, koch_arc=_sp.koch_arc, horizontal_mundane_arc=_pm.horizontal_mundane_arc,
        alcabitius_mundane_arc=_pm.alcabitius_mundane_arc, placidus_mundane_arc=_pm.placidus_mundane_arc,
        meridian_parallel_arc=_pm.meridian_parallel_arc,
        morinus_meridian_parallel_arc=_pm.morinus_meridian_parallel_arc,
        placidus_meridian_parallel_arc=_pm.placidus_meridian_parallel_arc,
        position_circle_meridian_parallel_arc=_pm.position_circle_meridian_parallel_arc,
        position_circle_mundane_arc=_pm.position_circle_mundane_arc,
        porphyry_mundane_target_lon=_pm.porphyry_mundane_target_lon)
