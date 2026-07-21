# jieqi 模块级冒烟:防「补丁带使用点漏定义点」类回归。
# 背景:BirthJieQi._ascChart 曾用 _JIEQI_FAST_APPROACH 而本文件无定义(NameError),
# 既有 pytest 全绿(该链无覆盖)但真机全中式技法 500。此处双保险:
#   1) 逐模块 import(模块级 NameError/SyntaxError 立抓);
#   2) BirthJieQi 卯时求解链真跑一次(函数内 NameError 立抓)。
import importlib
import pkgutil

import astrostudy.jieqi as jieqi_pkg


def test_jieqi_all_modules_importable():
    for m in pkgutil.iter_modules(jieqi_pkg.__path__):
        importlib.import_module(f'astrostudy.jieqi.{m.name}')


def test_birthjieqi_asc_chart_path_executes():
    from astrostudy.jieqi.BirthJieQi import BirthJieQi
    bjq = BirthJieQi({
        'date': '1990/03/15',
        'time': '08:30:00',
        'zone': '+08:00',
        'lat': '26n04',
        'lon': '119e19',
    })
    from flatlib.datetime import Datetime
    dt = Datetime('1990/03/15', '08:30:00', '+08:00')
    chart = bjq._ascChart(dt)  # NameError 曾在此触发
    assert chart.getAngle is not None
