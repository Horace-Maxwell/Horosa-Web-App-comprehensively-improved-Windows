# -*- coding: utf-8 -*-
"""天象库只读连接不依赖 sqlite 边车文件:把 WAL 模式的 editorial.sqlite 单独(不带 -shm / -wal)放进不可写目录,
db._open_readonly 必须能打开并查询 —— 打包已不再携带边车文件,少了 immutable=1 这条在用户机上会「打不开库」。
改前(mode=ro)本测试必红:sqlite 报 attempt to write a readonly database(要建 -shm)。"""
import os
import shutil
import sqlite3
import stat
import tempfile

import pytest

from astrostudy.xuanshi import db as xdb


def _copy_alone(src, dst_dir):
    dst = os.path.join(dst_dir, os.path.basename(src))
    shutil.copyfile(src, dst)
    os.chmod(dst, 0o444)
    return dst


@pytest.mark.skipif(not os.path.exists(xdb.EDITORIAL_PATH), reason="editorial.sqlite 缺席")
def test_wal_editorial_opens_readonly_without_sidecars_in_unwritable_dir():
    with tempfile.TemporaryDirectory() as d:
        p = _copy_alone(xdb.EDITORIAL_PATH, d)
        assert not any(n.endswith(("-shm", "-wal")) for n in os.listdir(d))
        with open(p, "rb") as fh:
            hdr = fh.read(20)
        assert hdr[18] == 2 and hdr[19] == 2, "夹具必须是 WAL 格式的库(文件头 18/19 字节 = 2),否则本测试没有判别力"
        os.chmod(d, stat.S_IRUSR | stat.S_IXUSR)
        try:
            conn = xdb._open_readonly(p)
            try:
                # immutable=1 下 SQLite 不启用 WAL 机制(pragma 报 delete),这正是「不需要 -shm」的含义
                n = conn.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]
                assert n > 0
            finally:
                conn.close()
            assert not any(n.endswith(("-shm", "-wal")) for n in os.listdir(d)), "只读打开不得生成边车文件"
        finally:
            os.chmod(d, stat.S_IRWXU)


def test_public_data_opens_immutable_and_uri_pins_flag():
    conn = xdb._open_readonly(xdb.PUBLIC_DATA_PATH)
    try:
        assert conn.execute("select count(*) from sqlite_master").fetchone()[0] > 0
        with pytest.raises(sqlite3.OperationalError):
            conn.execute("create table _probe(x)")
    finally:
        conn.close()
    import inspect
    assert "immutable=1" in inspect.getsource(xdb._open_readonly)
