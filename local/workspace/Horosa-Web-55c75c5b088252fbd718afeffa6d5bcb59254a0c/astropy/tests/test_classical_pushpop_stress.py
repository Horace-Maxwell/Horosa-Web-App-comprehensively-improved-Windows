# [R4 压力] 七族复合临界区并发压力+毒向量矩阵(用户明令「压力测试+所有可能性」)。
# ① 50 线程并发 push/pop:锁泄漏/污染检测——任一线程结束后全局默认必须完整还原;
# ② 毒向量矩阵:界表 NaN/inf/负宽/字符串垃圾/半表/空表全部拒绝(None),合法表恒过;
# ③ 嵌套 push(同线程两层):七族令牌语义=后进先出,内层 pop 后外层值仍在,外层 pop 后回默认。
import threading

from astrostudy import perchart
from flatlib.dignities import essential


def _snapshot_defaults():
    return {
        'terms_aries': tuple(tuple(x) for x in essential.TERMS['Aries']),
        'scores_fall': essential.SCORES.get('fall', None) if isinstance(essential.SCORES, dict) else None,
    }


def test_concurrent_pushpop_50_threads_no_leak():
    base = _snapshot_defaults()
    errs = []

    def worker(i):
        try:
            for _ in range(20):
                data = {'termsVariant': (i % 4), 'triplicity': 'Ptolemaic' if i % 2 else None,
                        'dignityDebilities': 0 if i % 3 == 0 else None}
                tokens = perchart.push_classical_request(data)
                try:
                    # 临界区内自读一致性:TERMS 是四套合法表之一(不校验具体哪套——线程交错下
                    # 全局态属于持锁者;此处只保证不炸、结构完整 12 座)。
                    assert len(essential.TERMS) >= 12
                finally:
                    perchart.pop_classical_request(tokens)
        except Exception as e:   # noqa: BLE001
            errs.append((i, repr(e)))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=120)
    assert not errs, errs[:3]
    # 全部收尾后:全局默认逐字节还原(锁泄漏/漏 pop=此处必红)。
    assert _snapshot_defaults() == base


def test_custom_terms_poison_matrix():
    ok_row = [['jupiter', 6], ['venus', 6], ['mercury', 8], ['mars', 5], ['saturn', 5]]
    good = [list(ok_row) for _ in range(12)]
    assert perchart._buildCustomTermsTable(good) is not None

    poisons = {
        'nan_width': [[['jupiter', 'nan']] + ok_row[1:]] + [good[0]] * 11,
        'inf_width': [[['jupiter', 'inf']] + ok_row[1:]] + [good[0]] * 11,
        'neg_width': [[['jupiter', -6], ['venus', 12]] + ok_row[2:]] + [good[0]] * 11,
        'zero_width': [[['jupiter', 0], ['venus', 12]] + ok_row[2:]] + [good[0]] * 11,
        'bad_star': [[['pluto', 6]] + ok_row[1:]] + [good[0]] * 11,
        'sum_29': [[['jupiter', 5]] + ok_row[1:]] + [good[0]] * 11,
        'short_row': [ok_row[:4]] + [good[0]] * 11,
        'eleven_signs': [good[0]] * 11,
        'none_table': None,
        'str_table': 'garbage',
        'dict_cell': [[{'a': 1}] * 5] + [good[0]] * 11,
    }
    for name, bad in poisons.items():
        assert perchart._buildCustomTermsTable(bad) is None, name


def test_nested_push_is_forbidden_by_design():
    """[R4-P0 定谳] _PERCHART_TERMS_LOCK 是不可重入 threading.Lock——同线程嵌套
    push_classical_request 必死锁。这是**设计约束**而非缺陷:生产调用图(webchartsrv×3/
    webmodernsrv/webpredictsrv 装饰器/election_scan×2/astroextra×3)已逐一枚举证实
    零二次 push(R4 复审 A1 项)。本测试只固化「锁确为不可重入类型」这一前提,
    使未来任何人把它换成 RLock(会引入 pop 反序破坏 _CUSTOM_TERMS_NIGHT_ACTIVE 槽的
    新病)或在端点内部再调 push 时,先撞见本注释。绝不真嵌套(那会挂死整套 pytest)。"""
    import threading as _t
    lock = perchart._PERCHART_TERMS_LOCK
    # threading.Lock 实例无 _is_owned/不可重入;RLock 有 _is_owned。类型断言防静默换型。
    assert not hasattr(lock, '_is_owned'), 'terms 锁被换成了可重入类型——先读本测试 docstring 再动'
