# -*- coding: utf-8 -*-
"""真随机起卦合同:随机起卦的随机数取自系统随机源;要原样重开的把取到的原始字节存成「真随机记录」,
引擎按顺序直接读记录里的位(不经伪随机数发生器);整数种子(手动 / 时间 / 旧卦例)仍是确定性起法,逐字节照旧。"""
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path

import pytest

from astrostudy import truerandom as tr
from astrostudy.geomancy import chart as geo_chart
from astrostudy.geomancy import random_source as geo_rs
from astrostudy.geomancy.traditions import PROFILES

ASTROPY = Path(__file__).resolve().parent.parent


def _chi_limit(df):
    # 自由度 df 的卡方:均值 df、标准差 sqrt(2df);取均值 + 8 个标准差
    return df + 8 * (2 * df) ** 0.5


# ---------------------------------------------------------------- 记录与读法
def test_entropy_seed_format_and_helpers():
    seed = tr.new_entropy_seed(32)
    assert re.fullmatch(r"tr1-[0-9a-f]{64}", seed)
    assert tr.is_entropy_seed(seed)
    assert tr.entropy_seed_bytes(seed).hex() == seed[4:]
    assert tr.new_entropy_seed(32) != seed
    for bad in ("", "tr1-", "tr1-abc", "tr1-zz", "rnd-1", 12345, None, seed + "|x"):
        assert not tr.is_entropy_seed(bad)
    assert tr.entropy_seed_bytes(12345) is None
    assert tr.request_entropy_seed("  %s \n" % seed) == seed
    assert tr.request_entropy_seed(12345) is None
    assert tr.request_entropy_seed("12345") is None
    assert tr.seed_display_text("tr1-a3f9") == "真随机 a3f9"
    assert tr.seed_display_text(seed) == "真随机 %s…" % seed[4:12]
    assert tr.seed_display_text(12345) == "12345"
    assert tr.seed_display_text(None) == ""


def test_tape_bit_order_and_rejection_sampling():
    r = tr.TapeRandom(bytes.fromhex("a5f0"))  # 1010 0101 1111 0000
    assert [r.getrandbits(1) for _ in range(4)] == [1, 0, 1, 0]
    assert r.getrandbits(4) == 5
    assert r._randbelow(10) == 0  # 先读到 1111 = 15 ≥ 10 丢掉,再读 0000
    assert r.bits_used == 16 and r.extended == 0
    c = tr.TapeRandom(bytes.fromhex("80"))
    assert c.randint(0, 1) == 1 and c.randint(0, 1) == 0  # 一枚钱正好读 1 位
    assert c._randbelow(1) == 0 and c.bits_used == 2  # 只有一个取值时不读
    with pytest.raises(ValueError):
        tr.TapeRandom(b"")
    with pytest.raises(ValueError):
        tr.TapeRandom.from_seed("rnd-1")
    with pytest.raises(NotImplementedError):
        r.getstate()


def test_cross_language_vector_and_extension():
    """这组数与前端 src/utils/__tests__/trueRandom.test.js 的同名用例逐个相同:两边读同一条记录必须读出同样的数。"""
    r = tr.TapeRandom.from_seed("tr1-9f3a12cd77e0")
    got = [r.getrandbits(5), r._randbelow(10), r._randbelow(78), r.getrandbits(1), r._randbelow(6), r._randbelow(16)]
    assert got == [19, 7, 33, 0, 2, 12]
    assert r.extended == 0
    e = tr.TapeRandom(bytes.fromhex("ff"))
    e.getrandbits(8)
    read = bytes(e.getrandbits(8) for _ in range(40))
    first = hashlib.sha256(bytes.fromhex("ff") + (0).to_bytes(4, "big")).digest()
    second = hashlib.sha256(bytes.fromhex("ff") + (1).to_bytes(4, "big")).digest()
    assert read == first + second[:8]
    assert e.extended == 2


def test_tape_fork_is_fixed_length_slice():
    data = bytes(range(64))
    parent = tr.TapeRandom(data)
    child = parent.fork(16)
    assert parent.bits_used == 128  # 子过程用多用少,主记录都只前进这一段
    assert bytes(child.getrandbits(8) for _ in range(16)) == data[:16]
    assert parent.getrandbits(8) == 16


def test_stdlib_methods_read_the_tape_uniformly():
    rng = tr.TapeRandom(tr.entropy_seed_bytes(tr.new_entropy_seed(200000)))
    n = 60000
    die = Counter(rng.randint(1, 6) for _ in range(n))
    chi = sum((die[k] - n / 6) ** 2 / (n / 6) for k in range(1, 7))
    assert chi < _chi_limit(5)
    picks = Counter(rng.sample(range(10, 30), 1)[0] for _ in range(n))
    chi = sum((picks[k] - n / 20) ** 2 / (n / 20) for k in range(10, 30))
    assert chi < _chi_limit(19)
    assert rng.extended == 0
    assert 0.0 <= rng.random() < 1.0
    deck = list(range(20))
    rng.shuffle(deck)
    assert sorted(deck) == list(range(20))


# ---------------------------------------------------------------- 模块级随机函数换源
def test_global_random_from_patches_and_restores():
    before = random.getstate()
    tape = tr.TapeRandom(bytes.fromhex("a5f0" * 8))
    with tr.global_random_from(tape):
        assert getattr(random.randint, "__self__", None) is tape
        assert random.randint(0, 1) == 1  # 记录的第一位
        assert random.sample(range(4), 1)[0] == 1  # 接下来两位 01
    assert getattr(random.randint, "__self__", None) is random._inst
    assert random.getstate() == before  # 进程里那串伪随机数一步没动
    assert tape.bits_used == 3


def test_run_seeded_replays_record_and_keeps_integer_seeds():
    def draw():
        return [random.randint(1, 35) for _ in range(6)], random.sample(range(10, 30), 1)

    seed = tr.new_entropy_seed(32)
    assert tr.run_seeded(seed, draw) == tr.run_seeded(seed, draw)
    assert tr.run_seeded(seed, draw) != tr.run_seeded(tr.new_entropy_seed(32), draw)
    # 整数种子:与标准库按种子播种逐值相同,结束后全局状态还原
    before = random.getstate()
    got = tr.run_seeded(12345, draw)
    assert random.getstate() == before
    ref = random.Random(12345)
    assert got == ([ref.randint(1, 35) for _ in range(6)], ref.sample(range(10, 30), 1))


# ---------------------------------------------------------------- 地占
# 引入真随机记录之前的代码对「欧洲古典 / 手动种子 12345」整份结果的指纹:整数种子的旧卦例必须逐字节照旧。
GEOMANCY_GOLDEN_SHA256 = "ba169878c1bf4bd8f12b0b6dad48e43fdc158efbf83a6501530e1eeb0c0e29be"


def _dump(reading):
    return json.dumps(reading, sort_keys=True, default=str, ensure_ascii=False)


def test_geomancy_random_source_selection():
    seed = tr.new_entropy_seed(geo_rs.GEOMANCY_ENTROPY_BYTES)
    assert isinstance(geo_rs.make_rng("rng", seed), tr.TapeRandom)
    assert isinstance(geo_rs.make_rng("manual", seed), tr.TapeRandom)  # 锁定重开一张随机起的盘
    assert isinstance(geo_rs.make_rng("rng"), random.SystemRandom)  # 没给种子:当场向系统随机源取
    legacy = geo_rs.make_rng("manual", 12345)
    assert type(legacy) is random.Random and legacy.random() == random.Random(12345).random()
    assert type(geo_rs.make_rng("time", None, 2611211030)) is random.Random
    assert isinstance(geo_rs.sub_rng(tr.TapeRandom(bytes(64)), "ascendant"), tr.TapeRandom)
    assert isinstance(geo_rs.sub_rng(random.SystemRandom(), "planetary"), random.SystemRandom)
    ref = random.Random(7)
    expect = random.Random(ref.getrandbits(64)).random()
    assert geo_rs.sub_rng(random.Random(7), "bytwelves").random() == expect  # 旧盘的子过程照旧由主序取 64 位播种
    assert sum(geo_rs.SUB_TAPE_BYTES.values()) < geo_rs.GEOMANCY_ENTROPY_BYTES


def test_geomancy_fresh_casts_never_run_past_the_record(monkeypatch):
    tapes = []
    orig_init = tr.TapeRandom.__init__

    def spy_init(self, tape):
        orig_init(self, tape)
        tapes.append(self)

    monkeypatch.setattr(tr.TapeRandom, "__init__", spy_init)
    runs = 0
    for pid in sorted(PROFILES):
        for proj in (None, "astro_bytwelves"):
            for mode in (None, "buyut", "hakata", "ifa", "sikidy"):
                for _ in range(8):
                    seed = tr.new_entropy_seed(geo_rs.GEOMANCY_ENTROPY_BYTES)
                    kwargs = dict(profile_id=pid, cast_method="rng", seed=seed, house_projection=proj, chart_mode=mode,
                                  planetary_chart=True, planetary_chart_nodes=True, planetary_chart_extras=True,
                                  reading_scope="L4")
                    tapes.clear()
                    first = geo_chart.compute_reading(**kwargs)
                    assert tapes and all(t.extended == 0 for t in tapes)  # 全部读自记录原文
                    assert _dump(geo_chart.compute_reading(**kwargs)) == _dump(first)  # 同一记录原样重开
                    runs += 1
    assert runs == len(PROFILES) * 2 * 5 * 8


def test_geomancy_mothers_are_uniform_over_sixteen_figures():
    counts = Counter()
    n = 4000
    for _ in range(n):
        reading = geo_chart.compute_reading(seed=tr.new_entropy_seed(geo_rs.GEOMANCY_ENTROPY_BYTES))
        for fig in reading["mothers"]:
            counts[json.dumps(fig, sort_keys=True, default=str)] += 1
    assert len(counts) == 16
    total = n * 4
    chi = sum((c - total / 16) ** 2 / (total / 16) for c in counts.values())
    assert chi < _chi_limit(15)


def test_geomancy_integer_seed_golden_unchanged():
    reading = geo_chart.compute_reading(profile_id="european_classical", cast_method="manual", seed=12345)
    digest = hashlib.sha256(_dump(reading).encode("utf-8")).hexdigest()
    assert digest == GEOMANCY_GOLDEN_SHA256


# ---------------------------------------------------------------- 服务端各引擎
def test_services_replay_records_and_keep_integer_seeds():
    import websrv.webjingjuesrv as jj
    import websrv.webtaixuansrv as tx
    import websrv.webwuzhaosrv as wz

    for _ in range(200):
        seed = tr.new_entropy_seed(jj.JINGJUE_ENTROPY_BYTES)
        cast = jj._cast(seed)
        assert cast == jj._cast(seed) and cast["seed"] == seed
        counts = [g["count"] for g in cast["groups"]] if "groups" in cast else None
        if counts:
            assert sum(counts) == 30 and all(c >= 1 for c in counts)
    keys = Counter(jj._cast(tr.new_entropy_seed(32))["key"] for _ in range(3000))
    assert len(keys) == 16  # 三十算分三、各以四除:余数组合共十六种,都出得来
    assert (jj._cast(12345)["key"], jj._cast(12345)["divider"]) == ("141", 23)  # 旧整数种子照旧

    seed = tr.new_entropy_seed(32)
    assert _dump(tx._calculate(2026, 11, 21, 10, seed)) == _dump(tx._calculate(2026, 11, 21, 10, seed))
    assert _dump(tx._calculate(2026, 11, 21, 10, 7)) == _dump(tx._calculate(2026, 11, 21, 10, 7))

    assert isinstance(wz._cast_rng(None), random.SystemRandom)
    assert isinstance(wz._cast_rng(tr.new_entropy_seed(64)), tr.TapeRandom)
    assert wz._dunhuang_shifa("guayi", wz._cast_rng(123))[0] == wz._dunhuang_shifa("guayi", random.Random(123))[0]
    for _ in range(300):
        tape = wz._cast_rng(tr.new_entropy_seed(64))
        nums, _detail = wz._dunhuang_shifa("guayi", tape)
        assert len(nums) == 6 and all(1 <= v <= 5 for v in nums)
        assert tape.extended == 0
    coins = wz._cast_rng(tr.new_entropy_seed(64))
    wz._qian_shifa([], True, coins)
    assert coins.bits_used == 24  # 四钱六掷,每枚钱一位


def test_vendor_auto_split_reads_the_cast_source(monkeypatch):
    """内置五兆引擎的自动分策直接调 random.randint:起兆时一并换到本次的随机源上。"""
    import websrv.webwuzhaosrv as wz

    seen = []

    def fake_calculate_with(rng, *args):
        seen.append((type(rng), getattr(random.randint, "__self__", None) is rng))
        return None

    monkeypatch.setattr(wz, "_calculate_with", fake_calculate_with)
    wz._calculate("hour", None, 0, None, None, None, {})
    wz._calculate("hour", None, 0, None, None, None, {"castSeed": tr.new_entropy_seed(64)})
    assert seen == [(random.SystemRandom, True), (tr.TapeRandom, True)]
    assert getattr(random.randint, "__self__", None) is random._inst


def test_fresh_casts_never_touch_the_hidden_global_generator(monkeypatch):
    """运行时实证:标准库模块级随机函数背后那串隐藏的伪随机数一碰就报错,不带种子新建发生器也报错,
    再把每个引擎的随机起卦真跑一遍。跑得通 = 随机起卦全程没有用到伪随机数(源码扫描看不到的间接调用靠这条抓)。
    旧整数种子的确定性复现不在此列(那是按种子播种的发生器,另有金标)。"""
    import websrv.webjingjuesrv as jj
    import websrv.webtaixuansrv as tx
    import websrv.webwuzhaosrv as wz

    def poison(name):
        def hit(*args, **kwargs):
            raise AssertionError("隐藏的全局伪随机数被调用: random.%s" % name)
        return hit

    assert len(tr._PATCHABLE) >= 20 and {"random", "randint", "sample", "choice", "shuffle", "getrandbits"} <= set(tr._PATCHABLE)
    for name in tr._PATCHABLE:
        monkeypatch.setattr(random, name, poison(name))
    plain_seed = random.Random.seed

    def guarded_seed(self, a=None, version=2):
        if a is None and type(self) is random.Random:
            raise AssertionError("不带种子新建了伪随机数发生器")
        return plain_seed(self, a, version)

    monkeypatch.setattr(random.Random, "seed", guarded_seed)

    runs = 0
    # 地占:全部传本 × 盘式 × 两种投影 × 起卦法;不带种子(当场取)与真随机记录两种
    for pid in sorted(PROFILES):
        for mode in (None, "buyut", "hakata", "ifa", "sikidy"):
            for proj, cast_method in ((None, "rng"), ("astro_bytwelves", "dice"), (None, "coins")):
                for seed in (None, tr.new_entropy_seed(geo_rs.GEOMANCY_ENTROPY_BYTES)):
                    geo_chart.compute_reading(profile_id=pid, cast_method=cast_method, seed=seed, house_projection=proj,
                                              chart_mode=mode, planetary_chart=True, planetary_chart_nodes=True,
                                              planetary_chart_extras=True, reading_scope="L4")
                    runs += 1
    # 荆诀 / 太玄:随机起课带的是真随机记录
    for _ in range(60):
        jj._cast(tr.new_entropy_seed(jj.JINGJUE_ENTROPY_BYTES))
        runs += 1
    for _ in range(20):
        tx._calculate(2026, 11, 21, 10, tr.new_entropy_seed(32))
        runs += 1
    # 五兆:全部起兆式 × 揲筮诸式;不带种子与真随机记录两种
    ganzhi = wz._json_safe(wz.wuzhao_config.gangzhi(2026, 11, 21, 10, 30, 1, 1))
    term = wz.wuzhao_jieqi.jq(2026, 11, 21, 10, 30)
    for mode in sorted(wz.MODE_LABELS):
        for variant in sorted(wz.SHIFA_VARIANTS):
            for seed in (None, tr.new_entropy_seed(64)):
                extras = {"shifaVariant": variant, "qianAuto": True, "qianThrows": [], "zhaoNums": [1, 2, 3, 4, 5, 1]}
                if seed:
                    extras["castSeed"] = seed
                wz._calculate(mode, ganzhi, 0, term, "十", None, extras)
                runs += 1
    assert runs > 350

    # 反向对照:绕开换源直接调内置引擎,立刻撞上被毒化的模块级函数(这条检查抓得到漏网)
    with pytest.raises(AssertionError, match="隐藏的全局伪随机数被调用"):
        wz._calculate_with(tr.system_random(), "hour", ganzhi, 0, term, "十", None, {})
    with pytest.raises(AssertionError, match="不带种子新建了伪随机数发生器"):
        random.Random()


# ---------------------------------------------------------------- 源码守卫
_MODULE_LEVEL_CALL = re.compile(
    r"(?<![\w.])random\.(random|randint|choice|choices|shuffle|sample|randrange|uniform|getrandbits|seed|gauss|triangular)\(")
_UNSEEDED_GENERATOR = re.compile(r"(?<![\w.])random\.Random\(\s*\)")


def _own_sources():
    out = []
    for sub in ("astrostudy", "websrv"):
        out.extend(p for p in (ASTROPY / sub).rglob("*.py") if "__pycache__" not in p.parts)
    return out


def _code_lines(path):
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.split("#", 1)[0]
        if text.strip():
            yield text


def test_no_pseudo_random_in_own_engine_code():
    """本仓自己的引擎 / 服务代码里:不许直接调标准库的模块级随机函数(那是进程里一串按公式推的数),
    也不许新建不带种子的伪随机数发生器。两处例外:truerandom.py 本身;荆诀服务的分三函数(整段跑在 run_seeded 里,已随之换源)。"""
    allowed = {ASTROPY / "astrostudy" / "truerandom.py", ASTROPY / "websrv" / "webjingjuesrv.py"}
    files = _own_sources()
    assert len(files) > 100
    module_level = sorted(str(p.relative_to(ASTROPY)) for p in files
                          if p not in allowed and any(_MODULE_LEVEL_CALL.search(t) for t in _code_lines(p)))
    unseeded = sorted(str(p.relative_to(ASTROPY)) for p in files
                      if any(_UNSEEDED_GENERATOR.search(t) for t in _code_lines(p)))
    assert module_level == []
    assert unseeded == []
    # 荆诀那几处确实都在按种子跑的函数体里
    jj = (ASTROPY / "websrv" / "webjingjuesrv.py").read_text(encoding="utf-8")
    body = jj[jj.index("def _cast(seed):"):jj.index("return _with_seed(seed, _run)")]
    assert len(_MODULE_LEVEL_CALL.findall(jj)) == len(_MODULE_LEVEL_CALL.findall(body)) > 0

