#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""roundtrip_all.py — 编排级 round-trip(SKILL 铁律 3(b);gotcha #94 第四种失效形态的唯一解药,#111 课六工具化)。

把 apply.sh 的**全部** overlay 目标(apply_patch 目标 + cp/cp -r 落盘文件 + §3 的 package.json)重置成纯上游
<mac-ref> 的字节(上游没有的文件 = 删掉),跑一遍 apply.sh,再逐目标 sha256 与重置前的快照比对 ——
必须 **全等 + apply.sh 零告警 + 零 .rej**。regen_patch.py 自带的 round-trip 只证明单个补丁可复现,
证明不了编排(守卫是否失效、补丁是否 regen 全、两个补丁是否互踩);而炸的全在编排。

安全性:先快照后重置(快照阶段出错 ⇒ 工作树零改动);末尾**无条件**从快照还原(全等时幂等),
工作树不会被留在重置态。快照根必须短(深路径撞 Windows MAX_PATH,首版实撞)。

用法(repo 根目录跑):
    python windows-adaptations/roundtrip_all.py <mac-ref> [--clone tmp/mac-sync-2.6.7]
退出码:0 = 全等零告警;1 = 有不等 / 告警 / .rej(逐条打印)。
"""
import hashlib
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

OV = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(OV)
WS = os.path.join(ROOT, 'local', 'workspace', 'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c')
SNAP = os.path.join(tempfile.gettempdir(), 'hrt_snap')


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def parse_targets():
    files, dirs = set(), set()
    with open(os.path.join(OV, 'apply.sh'), encoding='utf-8', errors='replace') as f:
        for line in f.read().splitlines():
            s = line.strip()
            if s.startswith('apply_patch ') and not s.startswith('apply_patch()'):
                parts = s.split()
                if len(parts) >= 4:
                    files.add(parts[2])
                continue
            m = re.search(r'cp\s+-r\s+"\$OV/files/([^"]+)"\s+"\$WS/([^"]+)"', s)
            if m:
                dirs.add(m.group(2).rstrip('/'))
                continue
            m = re.search(r'cp\s+(?:-f\s+)?"\$OV/files/([^"]+)"\s+"\$WS/([^"]+)"', s)
            if m:
                files.add(m.group(2))
    files.add('astrostudyui/package.json')   # apply.sh §3 整块重写 scripts
    return sorted(files), sorted(dirs)


def walk_files(d):
    out = []
    for dp, _dn, fn in os.walk(d):
        for name in fn:
            out.append(os.path.join(dp, name).replace('\\', '/'))
    return sorted(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        print(__doc__)
        return 2
    ref = args[0]
    clone = os.path.join(ROOT, 'tmp', 'mac-sync-2.6.7')
    for a in sys.argv[1:]:
        if a.startswith('--clone='):
            clone = a.split('=', 1)[1]

    def upstream_blob(rel):
        r = subprocess.run(['git', '-C', clone, 'cat-file', '-e', '{0}:Horosa-Web/{1}'.format(ref, rel)], capture_output=True)
        if r.returncode != 0:
            return None
        return subprocess.run(['git', '-C', clone, 'show', '{0}:Horosa-Web/{1}'.format(ref, rel)], capture_output=True).stdout

    files, dirs = parse_targets()
    print('targets: {0} files + {1} dirs; ref={2}'.format(len(files), len(dirs), ref))

    # 1) snapshot (before touching anything)
    if os.path.isdir(SNAP):
        shutil.rmtree(SNAP)
    snap_hash = {}
    for rel in files:
        p = os.path.join(WS, rel)
        if os.path.isfile(p):
            dst = os.path.join(SNAP, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(p, dst)
            snap_hash[rel] = sha(p)
        else:
            snap_hash[rel] = None
    for d in dirs:
        p = os.path.join(WS, d)
        if os.path.isdir(p):
            shutil.copytree(p, os.path.join(SNAP, d))
            for fpath in walk_files(p):
                snap_hash[os.path.relpath(fpath, WS).replace('\\', '/')] = sha(fpath)
    print('snapshot: {0} files -> {1}'.format(sum(1 for v in snap_hash.values() if v), SNAP))

    # 2) reset every target to pure upstream
    written = removed = 0
    for rel in files:
        blob = upstream_blob(rel)
        p = os.path.join(WS, rel)
        if blob is None:
            if os.path.isfile(p):
                os.remove(p)
                removed += 1
        else:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f:
                f.write(blob)
            written += 1
    for d in dirs:
        p = os.path.join(WS, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
            removed += 1
    print('reset: {0} written from upstream, {1} removed (not in upstream)'.format(written, removed))

    # 3) apply.sh
    r = subprocess.run(['bash', os.path.join(OV, 'apply.sh'), WS, clone], capture_output=True, text=True, encoding='utf-8', errors='replace')
    log = (r.stdout or '') + (r.stderr or '')
    bad = [l for l in log.splitlines() if '[!!]' in l or 'FAILED' in l or 'fuzz' in l or '.rej' in l]
    print('apply.sh exit={0}; warning lines={1}'.format(r.returncode, len(bad)))
    for l in bad[:30]:
        print('    ' + l[:220])
    rej = [f for sub in ('astrostudyui/src', 'astrostudyui/scripts', 'astropy', 'astrostudysrv')
           for f in walk_files(os.path.join(WS, sub)) if f.endswith('.rej') or f.endswith('.orig')]
    print('.rej/.orig after apply: {0}'.format(len(rej)))

    # 4) compare
    mism = []
    for rel, h in snap_hash.items():
        p = os.path.join(WS, rel)
        cur = sha(p) if os.path.isfile(p) else None
        if cur != h:
            mism.append((rel, h, cur))
    print('ROUND-TRIP: {0}/{1} byte-identical; mismatches={2}'.format(len(snap_hash) - len(mism), len(snap_hash), len(mism)))
    for rel, h, cur in mism[:60]:
        print('   MISMATCH {0}  snap={1} now={2}'.format(rel, str(h)[:12], str(cur)[:12]))

    # 5) restore snapshot unconditionally (idempotent when exact)
    for rel, h in snap_hash.items():
        p = os.path.join(WS, rel)
        if h is None:
            if os.path.isfile(p):
                os.remove(p)
            continue
        os.makedirs(os.path.dirname(p), exist_ok=True)
        shutil.copy2(os.path.join(SNAP, rel), p)
    for f in rej:
        try:
            os.remove(f)
        except OSError:
            pass
    ok = not mism and not bad and not rej
    print('snapshot restored; {0}'.format('ALL EQUAL' if ok else 'NOT CLEAN — fix and re-run'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
