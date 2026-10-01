"""玄史(中国玄学史)只读数据访问底座。

两个 SQLite bundle 随模块发布，落在 ``xuanshi/data/`` 下：
- ``public_data.sqlite`` — 玄学事件 ``xuanxue_event`` / 天象 ``celestial_event`` /
  地名 ``map_point`` / 人物共现图 ``person_node`` ``person_edge``。
- ``editorial.sqlite`` — 编辑层人物 ``figure`` / 故事 ``story`` / 术数 ``technique`` /
  天象词条 ``celestial_term`` / 朝代词条 ``dynasty_term`` / 频道 ``channel`` /
  白话译文 ``translation`` / 今日推送 ``daily_pick`` 等。

铁律：本模块**只读**打开两库（``mode=ro`` URI），绝不建表 / 写入；
连接 ``check_same_thread=False`` 以适配 CherryPy 多线程；模块级缓存复用连接。
"""

from __future__ import annotations

import os
import sqlite3
import threading
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

PUBLIC_DATA_PATH = os.path.join(_DATA_DIR, "public_data.sqlite")
EDITORIAL_PATH = os.path.join(_DATA_DIR, "editorial.sqlite")
CHINA_GEOJSON_PATH = os.path.join(_DATA_DIR, "china.geo.json")

_LOCK = threading.Lock()
_CONNS: dict[str, sqlite3.Connection] = {}


def _open_readonly(path: str) -> sqlite3.Connection:
    """以只读 URI 打开 sqlite；不存在则抛 FileNotFoundError。

    immutable=1:库文件在安装目录里只读、运行期绝不写,让 SQLite 不加锁、不建 -shm / -wal 边车。
    editorial.sqlite 是 WAL 模式 —— 不带 immutable 时 SQLite 要先建 -shm 才能读,在不可写目录下
    连只读都打不开(实测),而打包已不再携带这些边车文件(它们是打包机运行痕迹、字节随机器变)。
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"xuanshi data not found: {path}")
    uri = "file:" + path + "?mode=ro&immutable=1"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _cached(path: str) -> sqlite3.Connection:
    conn = _CONNS.get(path)
    if conn is not None:
        return conn
    with _LOCK:
        conn = _CONNS.get(path)
        if conn is not None:
            return conn
        conn = _open_readonly(path)
        _CONNS[path] = conn
        return conn


def public_conn() -> sqlite3.Connection:
    """public_data.sqlite 只读连接（模块级缓存）。"""
    return _cached(PUBLIC_DATA_PATH)


def editorial_conn() -> Optional[sqlite3.Connection]:
    """editorial.sqlite 只读连接；缺库时返回 None（不影响主流程）。"""
    try:
        return _cached(EDITORIAL_PATH)
    except FileNotFoundError:
        return None


def public_exists() -> bool:
    return os.path.exists(PUBLIC_DATA_PATH)


def editorial_exists() -> bool:
    return os.path.exists(EDITORIAL_PATH)
