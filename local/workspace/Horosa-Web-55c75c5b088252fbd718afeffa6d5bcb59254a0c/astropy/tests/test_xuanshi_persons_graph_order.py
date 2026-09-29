# -*- coding: utf-8 -*-
"""玄学史 · 人物关系图(/xuanshi/persons-graph)输出与进程哈希种子无关。

原节点表按字符串集合迭代生成,顺序随 PYTHONHASHSEED 变:同一请求每次启动输出不同,前端力导向图按下标排
初始位置,布局也每次不同。现固定为「共现权重降序、同权按人名」。
判据:三个不同哈希种子的子进程输出逐字节相同;节点按 (-weight, id) 有序;节点集合 = 边的端点集合。
"""
import json
import os
import subprocess
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

_SNIPPET = (
    "import json, sys\n"
    "sys.path.insert(0, %r)\n"
    "from astrostudy.xuanshi import editorial as E\n"
    "print(json.dumps(E.figure_cooccurrence_graph(limit_nodes=100, min_weight=3), ensure_ascii=False))\n"
) % _ASTRO


def _run(seed):
    env = dict(os.environ)
    env['PYTHONHASHSEED'] = str(seed)
    # horosa_subprocess_utf8_v1(Windows 适配,跨平台安全,建议上游化):子进程按 ensure_ascii=False 打印中文人名,
    # Windows 下管道两端都按 locale 码页(cp1252/GBK)编解码 → 父进程 reader 线程 UnicodeDecodeError、stdout 变 None。
    # 两端显式 UTF-8:子进程 PYTHONIOENCODING + 父进程 encoding;Mac/Linux(本就 UTF-8)逐字节同行为。
    env['PYTHONIOENCODING'] = 'utf-8'
    out = subprocess.run([sys.executable, '-c', _SNIPPET], capture_output=True, text=True, encoding='utf-8', errors='replace', env=env, timeout=120)
    assert out.returncode == 0, out.stderr[-400:]
    return out.stdout.strip().splitlines()[-1]


def test_persons_graph_identical_across_hash_seeds_and_ordered():
    outs = [_run(s) for s in (1, 2, 3)]
    assert outs[0] == outs[1] == outs[2]
    g = json.loads(outs[0])
    nodes, edges = g['nodes'], g['edges']
    if not nodes:
        return   # 库不在场时图为空,顺序无从谈起
    keys = [(-n['weight'], n['id']) for n in nodes]
    assert keys == sorted(keys)
    ends = {e['source'] for e in edges} | {e['target'] for e in edges}
    assert {n['id'] for n in nodes} == ends
