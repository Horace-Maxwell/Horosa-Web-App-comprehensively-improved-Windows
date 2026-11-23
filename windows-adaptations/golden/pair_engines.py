# -*- coding: utf-8 -*-
"""horosa_golden_pair_engines_v1 — run the golden matrix against TWO engine trees and leaf-diff the payloads (gotcha #118).

Two uses, both needed when the baseline drifts after a merge round:

  1. working tree vs the PURE new upstream engine -> must be byte-identical on every case. That proves our overlay
     adds no value deviation, so every drift against the previous baseline is an intended upstream change.
         git -C tmp/mac-sync-2.6.7 archive <new-ref> Horosa-Web/astropy Horosa-Web/flatlib-ctrad2 Horosa-Web/vendor | tar -x -C <dir>
         python windows-adaptations/golden/pair_engines.py <dir>/Horosa-Web -

  2. previous release vs working tree -> which JSON paths moved, per case family (to match against the release notes).
         git archive HEAD <ws>/astropy <ws>/flatlib-ctrad2 <ws>/vendor | tar -x -C <dir>
         python windows-adaptations/golden/pair_engines.py <dir>/<ws> - [case-id-prefix]

Arguments: <project-A> <project-B, or "-" for the working tree> [case-id-prefix].
Starts two isolated services on free ports (never :8899) and stops them at the end. Read-only: writes nothing into
the repo. Extract the trees into a SHORT path (long paths are not enabled on every machine).
"""
import collections
import importlib.util
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
G = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, G)
spec = importlib.util.spec_from_file_location("vg", os.path.join(G, "verify_golden.py"))
vg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vg)
import matrix  # noqa: E402

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(2)
project_a = sys.argv[1]
project_b = sys.argv[2] if sys.argv[2] != "-" else None
only = sys.argv[3] if len(sys.argv) > 3 else None
cases = {c["id"]: c for c in matrix.build_cases(False, None)}
ids = [d for d in cases if not only or d.startswith(only)]
print("cases:", len(ids))


def leaves(v, path=""):
    if isinstance(v, dict):
        for k in v:
            yield from leaves(v[k], path + "." + str(k))
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from leaves(x, path + "[%d]" % i)
    else:
        yield path, v


def unwrap(raw):
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {"__raw__": raw.decode("utf-8", "replace")}


def gen(path):
    return re.sub(r"\[\d+\]", "[*]", path)


def fam(cid):
    return ".".join(cid.split(".")[:2])


pa, _proc_a, stop_a = vg.launch_service(project_a, vg.DEFAULT_PY)
pb, _proc_b, stop_b = vg.launch_service(project_b or vg.DEFAULT_WS, vg.DEFAULT_PY)
out = collections.defaultdict(collections.Counter)
examples = collections.defaultdict(dict)
shape = collections.defaultdict(collections.Counter)
same = 0
errors = 0
differ = []
try:
    for cid in ids:
        c = cases[cid]
        a = vg.run_case("http://127.0.0.1:%d" % pa, c)
        b = vg.run_case("http://127.0.0.1:%d" % pb, c)
        if "error" in a or "error" in b:
            errors += 1
            print("ERR", cid, a.get("error"), b.get("error"))
            continue
        if vg._normalize_now_fields(cid, a["_raw"]) == vg._normalize_now_fields(cid, b["_raw"]):
            same += 1
            continue
        differ.append(cid)
        la, lb = dict(leaves(unwrap(a["_raw"]))), dict(leaves(unwrap(b["_raw"])))
        f = fam(cid)
        ka, kb = set(la), set(lb)
        for p in sorted(ka - kb):
            out[f]["- " + gen(p)] += 1
            examples[f].setdefault("- " + gen(p), (cid, la[p], None))
        for p in sorted(kb - ka):
            out[f]["+ " + gen(p)] += 1
            examples[f].setdefault("+ " + gen(p), (cid, None, lb[p]))
        for p in sorted(ka & kb):
            if la[p] != lb[p]:
                out[f]["~ " + gen(p)] += 1
                examples[f].setdefault("~ " + gen(p), (cid, la[p], lb[p]))
        # multiset view: is the difference a pure reorder of the same leaves?
        ma = collections.Counter(json.dumps(v, ensure_ascii=False, sort_keys=True) for v in la.values())
        mb = collections.Counter(json.dumps(v, ensure_ascii=False, sort_keys=True) for v in lb.values())
        shape[f]["same-leaf-multiset" if ma == mb else "values-changed"] += 1
finally:
    stop_a()
    stop_b()

print("byte-identical (after now-field normalisation): %d ; differing: %d ; errored: %d" % (same, len(differ), errors))
for d_ in differ[:60]:
    print("   differ:", d_)
for f in sorted(out):
    print()
    print("=====", f, dict(shape[f]))
    for k, n in out[f].most_common(28):
        cid, va, vb = examples[f][k]
        sa = json.dumps(va, ensure_ascii=False)[:70] if va is not None else ""
        sb = json.dumps(vb, ensure_ascii=False)[:70] if vb is not None else ""
        print("  %4d  %-78s  e.g. %s | %s -> %s" % (n, k[:78], cid.split(".", 2)[-1][:26], sa, sb))
    if len(out[f]) > 28:
        print("  ... %d more distinct paths" % (len(out[f]) - 28))
sys.exit(1 if (differ or errors) else 0)
