"""PERF-R9 逐字节黄金矩阵 —— 唯一事实源(tracked)。

本文件只描述「要打哪些请求」,不含任何执行逻辑;verify_golden.py 负责跑。
改动本文件后 **必须** 重跑 `verify_golden.py --capture`,否则 release_selfcheck 的
matrix_sha256 新鲜度门会硬失败(改矩阵却不重抓基线 = 基线在说谎)。

为什么要这个:仓库里原本没有任何**内容级**黄金 —— test_qimen_dingju.py 只钉了 11 个
定局锚点,test_kentang_extreme_years.py 只断言「有应答」,verify_all_services.py 只验
「200 + 体积下限」。PERF-R9 要动 kinqimen 引擎 / flatlib 共享层 / Java 网关,唯一能证明
「功能零降级」的办法就是改动前后逐字节比对同一组响应。

矩阵分三族:
  qimen  —— 主战场(PERF-R9 Ship 3c/3d),覆盖 5 盘式 × 4 定局 × 2 盘 × 4 开关组合 × 卡边界日期
  astro  —— 星盘族(Ship 2/4 会碰 flatlib 与 Java 网关的共享路径)
  kentang—— 其余技法引擎(Ship 3a/3e/3f)
"""

# ---------------------------------------------------------------------------
# 基础请求体(与 desktop_installer_bundle/scripts/verify_all_services.py 保持同源,
# 那里已验证过这些是合法载荷;此处刻意复制而不 import —— golden/ 是 tracked 的,
# 而 desktop_installer_bundle/ 整个 gitignored,不能让 tracked 依赖 untracked)
# ---------------------------------------------------------------------------

CHART_BODY = {
    "date": "2028/04/06", "time": "09:33:00", "zone": "+00:00",
    "lat": "41n26", "lon": "174w30", "gpsLat": -41.433333, "gpsLon": 174.5,
    "hsys": 1, "tradition": False, "predictive": True, "zodiacal": 0,
    "simpleAsp": False, "strongRecption": False, "virtualPointReceiveAsp": True,
    "southchart": False, "ad": 1, "name": "Horosa Golden Probe", "pos": "Wellington",
}

KIN_BODY = {
    "year": 2026, "month": 7, "day": 3, "hour": 14, "minute": 30, "sex": "男",
    "style": 3, "tn": 0, "tenching": 0, "rotation": "固定", "timeBasis": "direct",
    "after23NewDay": 0, "lateZiHourUseNextDay": 1, "enableGameTheory": False,
    "realSunTime": "", "jiedelta": "",
}

# ---------------------------------------------------------------------------
# 奇门:卡边界日期
# 每一行都对应 kinqimen 里一条真实的分支/历史 bug 锚点,不是随便挑的日子。
# ---------------------------------------------------------------------------

QIMEN_DATES = [
    # (slug, year, month, day, hour, minute) —— 行尾注释说明这一行钉住什么分支
    ("base",        2026,  5, 15,  0, 12),   # test_qimen_dingju.py 既有锚点
    ("jqgap-am",    2026,  2, 18, 10, 30),   # 14 天间隔 jq() bug 锚点
    ("jqgap-pm",    2026,  2, 18, 23, 30),   # 同上 + 晚子时
    ("futou-eve",   2015,  1,  2, 22, 30),   # 符头前夜(晚子时之前)
    ("futou-lz",    2015,  1,  2, 23, 30),   # 符头前夜晚子时 → _zhirun_effective_date
    ("futou-next",  2015,  1,  3,  0, 30),   # 次日子时
    ("maoshan-eve", 2026,  6, 20, 23, 38),   # 茅山满三元翻转前夜
    ("maoshan-t0",  2026,  6, 21,  0, 30),   # 翻转当日子时
    ("maoshan-t1",  2026,  6, 21,  8,  0),   # 翻转当日辰时
    ("maoshan-t2",  2026,  6, 22,  8,  0),   # 翻转次日
    ("chaoshen",    2026,  8, 20, 10,  0),   # 超神:wurun != chaibu
    ("lichun-pre",  2026,  2,  4,  4, 45),   # 立春交节前(年柱/月柱改写边界)
    ("lichun-post", 2026,  2,  4,  4, 47),   # 立春交节后
    ("pre1900",     1899,  3,  5, 12,  0),   # year < 1900 → find_lunar_month 分支
    ("ke-b0",       2026,  5, 15,  6,  0),   # 刻家分钟桶 0
    ("ke-b9",       2026,  5, 15,  6,  9),   # 桶边界 9
    ("ke-b10",      2026,  5, 15,  6, 10),   # 桶边界 10
    ("ke-b59",      2026,  5, 15,  6, 59),   # 桶边界 59
    # 极端年域顶点 —— 与 test_kentang_extreme_years.py 同源。
    # PERF-R9 Ship 3c 的「惰性定局」有一条已披露的残余分歧正落在这里:
    # 若某个**被丢弃**的定局法在这些日期会抛,改动前整请求失败(-1)、改动后 option=1 成功(0)。
    # 这几行就是用来把那个翻转抓出来的。
    ("bc12998",   -12998, 12, 29, 12,  0),
    ("bc1",           -1,  6, 15, 12,  0),
    ("ad1",            1,  6, 15, 12,  0),
    ("ad16798",    16798,  6, 15, 12,  0),
]

QIMEN_MODES = ["hour", "minute", "golden", "year", "overall"]
QIMEN_METHODS = ["chaibu", "zhirun", "maoshan", "wurun"]
QIMEN_SCHOOLS = ["转盘", "飞盘"]
# (after23NewDay, lateZiHourUseNextDay) —— 两个 thread-local 开关的全组合。
# PERF-R9 的请求级 memo 把这两个值放进 key,这四组就是证明它没串染的门。
QIMEN_FLAGS = [(1, 1), (1, 0), (0, 1), (0, 0)]

# 越界 option 的错误信封黄金:qijuMethod 缺席时回退数字 option;
# config.py 侧的 `.get(option)` 无默认值 → qmju[0] 抛 TypeError → 服务返回 ResultCode -1。
# Ship 3c 改惰性分派时**必须保住这个 None 语义**,所以这几例是硬门。
QIMEN_BAD_OPTIONS = [0, 5, "", None]


def _qimen_body(y, m, d, h, mi, mode, method, school, a23, lz):
    return dict(
        KIN_BODY,
        year=y, month=m, day=d, hour=h, minute=mi,
        qimenMode=mode, qijuMethod=method, school=school,
        after23NewDay=a23, lateZiHourUseNextDay=lz,
    )


def _qimen_cases(quick):
    out = []
    modes = QIMEN_MODES
    methods = QIMEN_METHODS
    schools = ["转盘"] if quick else QIMEN_SCHOOLS
    flags = [(1, 1)] if quick else QIMEN_FLAGS
    for (slug, y, m, d, h, mi) in QIMEN_DATES:
        for mode in modes:
            for method in methods:
                for school in schools:
                    for (a23, lz) in flags:
                        cid = "qimen.%s.%s.%s.%s.%d%d" % (
                            slug, mode, method,
                            "fei" if school == "飞盘" else "zhuan", a23, lz)
                        out.append({
                            "id": cid, "group": "qimen",
                            "mount": "/qimen", "subpath": "/pan", "method": "POST",
                            "body": _qimen_body(y, m, d, h, mi, mode, method, school, a23, lz),
                        })
    # 错误信封(两个日期足够;它验的是分派语义,不是历法)
    for (slug, y, m, d, h, mi) in QIMEN_DATES[:2]:
        for bad in QIMEN_BAD_OPTIONS:
            body = dict(KIN_BODY, year=y, month=m, day=d, hour=h, minute=mi,
                        qimenMode="hour", school="转盘")
            body.pop("qijuMethod", None)
            body["option"] = bad
            out.append({
                "id": "qimen.%s.badoption.%s" % (slug, "none" if bad is None else (bad if bad != "" else "empty")),
                "group": "qimen",
                "mount": "/qimen", "subpath": "/pan", "method": "POST", "body": body,
            })
    return out


# ---------------------------------------------------------------------------
# 星盘族:Ship 2(Java 网关)与 Ship 4(flatlib 共享层)会碰到的路径。
# 这些端点的黄金必须独立于奇门 —— 奇门矩阵一行也覆盖不到它们。
# ---------------------------------------------------------------------------

# 每个变体只动一个轴,失配时能立刻定位是哪个轴出的问题。
# /predict/lunarreturn 硬依赖 dirLat/dirLon(webpredictsrv.py:95-96,105 直接下标取,缺了就
# KeyError → 22 字节错误信封)。首轮抓基线时 18 个 lunarreturn 变体全是 22B —— 钉住的是错误
# 而不是计算结果,等于零覆盖。这里统一补上;对其余端点无害(它们不读这几个键,唯一影响是
# solarreturn 会用 dirZone 覆盖 zone,属于真实前端行为)。
ASTRO_DIR = {
    "dirLat": CHART_BODY["lat"], "dirLon": CHART_BODY["lon"], "dirZone": CHART_BODY["zone"],
    "asporb": -1,
}

ASTRO_VARIANTS = [
    ("base",        {}),
    ("sidereal",    {"zodiacal": 1}),
    ("sid-ayan1",   {"zodiacal": 1, "siderealAyanamsa": 1}),
    ("sid-ayan3",   {"zodiacal": 1, "siderealAyanamsa": 3}),
    ("south",       {"southchart": True}),
    ("hsys0",       {"hsys": 0}),
    ("hsys2",       {"hsys": 2}),
    ("hsys5",       {"hsys": 5}),
    ("tradition",   {"tradition": True}),
    ("simpleasp",   {"simpleAsp": True}),
    ("strongrec",   {"strongRecption": True}),
    ("novirtual",   {"virtualPointReceiveAsp": False}),
    ("terms-eg",    {"termsVariant": 1}),
    ("leobound",    {"leoBoundFirst": True}),
    ("trip-dor",    {"triplicity": 1}),
    ("orbscale",    {"orbScale": 0.5}),
    # 早期公元日期(远离现代星历插值区)。刻意**不用** ad:0 的公元前日期:实测 /chart 对
    # {"date":"0044/03/15","ad":0} 直接返回 {"err":"param error"},公元前西洋盘走的不是这个
    # 参数形状 —— 已单列为待查项,不在本矩阵里以错误响应充数。
    ("ancient",     {"date": "0100/03/15"}),
    # ★ 高纬度(特罗姆瑟 69°39'N,北极圈以北)。这一行是**性能回归钉**:实测该纬度整盘
    # 8.1-16.5 秒,而 40°N 只要 36ms;根因是 perchart.py:944 _phasis_event 里的
    # swisseph.heliacal_ut —— 它从 birth_jd-15 起**无上界**向前搜索偕日升/没,极昼极夜下
    # 下一次事件可能在数月之后,单次调用即 2.03 秒(占整盘 99.7%),而结果只在 ±7 天内才采用。
    # 与房屋制无关(6 种 hsys 全是 ~8.2s),78°N 反而只要 2.1s —— 典型的求解器边界行为。
    # 保留此行,任何针对它的优化都必须逐字节证明输出不变。
    ("north-hi",    {"lat": "69n39", "lon": "18e57", "gpsLat": 69.65, "gpsLon": 18.95}),
]

# (id 后缀, mount, subpath, 额外 body)
ASTRO_ENDPOINTS = [
    ("chart",       "",            "/",            {}),
    ("profection",  "/predict",    "/profection",  {"pdate": "2029/04/06", "datetime": "2029/04/06 09:33:00"}),
    ("solarreturn", "/predict",    "/solarreturn", {"datetime": "2029/04/06 09:33:00"}),
    ("lunarreturn", "/predict",    "/lunarreturn", {"datetime": "2029/04/06 09:33:00"}),
    ("solararc",    "/predict",    "/solararc",    {"datetime": "2029/04/06 09:33:00"}),
    ("pd",          "/predict",    "/pd",          {"datetime": "2029/04/06 09:33:00"}),
    ("dist",        "/predict",    "/dist",        {"datetime": "2029/04/06 09:33:00"}),
    ("agepoint",    "/predict",    "/agepoint",    {"datetime": "2029/04/06 09:33:00"}),
    ("zr",          "/predict",    "/zr",          {"datetime": "2029/04/06 09:33:00"}),
    ("india",       "/india",      "/chart",       {"indiaHsys": 0}),
    ("midpoint",    "/germany",    "/midpoint",    {}),
    ("ephemeris",   "/astroextra", "/ephemeris",   {"days": 3}),
    ("qizhengkin",  "/qizhengkin", "/pan",         None),   # None = 用 KIN_BODY 而非 CHART_BODY
]


def _astro_cases(quick):
    out = []
    variants = ASTRO_VARIANTS[:3] if quick else ASTRO_VARIANTS
    for (name, mount, subpath, extra) in ASTRO_ENDPOINTS:
        if extra is None:
            out.append({
                "id": "astro.%s.base" % name, "group": "astro",
                "mount": mount, "subpath": subpath, "method": "POST",
                "body": dict(KIN_BODY),
            })
            continue
        for (vslug, over) in variants:
            body = dict(CHART_BODY)
            body.update(ASTRO_DIR)
            body.update(extra)
            body.update(over)
            out.append({
                "id": "astro.%s.%s" % (name, vslug), "group": "astro",
                "mount": mount, "subpath": subpath, "method": "POST", "body": body,
            })
    return out


# ---------------------------------------------------------------------------
# 其余 kentang 引擎:每个端点 × 它自己的选项轴。
# Ship 3a(皇极经世拆典籍)/ 3e(太乙 game_theory 预热)/ 3f(kin* 提常量)的门。
# ---------------------------------------------------------------------------

KENTANG_DATES = [
    ("d0", 2026,  7,  3, 14, 30),
    ("d1", 1984,  2,  4,  0,  5),   # 立春附近 + 子时
    ("d2", 2000, 12, 31, 23, 59),   # 跨年 + 晚子时
]

# mount -> (subpath, [(轴 slug, 覆盖字段)])
KENTANG_SPECS = {
    "/taiyi": ("/pan", [
        ("base",   {}),
        ("style1", {"style": 1}),
        ("style2", {"style": 2}),
        ("tn1",    {"tn": 1}),
        ("sexf",   {"sex": "女"}),
        ("tench1", {"tenching": 1}),
        ("rotate", {"rotation": "旋转"}),
        ("game",   {"enableGameTheory": True}),   # Ship 3e 预热的那条路径
    ]),
    "/wangji": ("/pan", [
        ("base",   {}),
        # 皇极经世:Ship 3a 会把 classics 从 /pan 响应里拆走。
        # 这几例的 raw 哈希**预期会变**,是本轮唯一一处「刻意的响应结构变更」,
        # 必须在 --verify 时逐例裁定并写进台账,不得当成回归糊过去。
        ("hist",   {"historyYear": 1644}),
    ]),
    "/wuzhao":    ("/pan", [("base", {})]),
    "/taixuan":   ("/pan", [("base", {})]),
    # 荆诀是随机蓍草分揲(webjingjuesrv.py:351 默认 seed=random.randint),
    # 但它接受显式 seed —— 钉住种子即可保留引擎覆盖又保持确定性。
    # (这条是 --selftest 抓出来的:511 例里唯一一例三遍哈希不一致。)
    "/jingjue":   ("/pan", [("seeded", {"seed": 20260720})]),
    "/shenyishu": ("/pan", [("base", {})]),
    "/shaozi":    ("/pan", [("base", {}), ("sexf", {"sex": "女"})]),
    "/tieban":    ("/pan", [("base", {}), ("sexf", {"sex": "女"})]),
    "/fendjing":  ("/pan", [("base", {})]),
    "/beiji":     ("/pan", [("base", {})]),
    "/nanji":     ("/pan", [("base", {})]),
    "/chunzi":    ("/pan", [("base", {})]),
    "/xianqin":   ("/pan", [("base", {})]),
    "/jinkou":    ("/pan", [("base", {}), ("a23", {"after23NewDay": 1})]),
    "/cetian":    ("/pan", [("base", {"zone": "+08:00", "lat": "26n04", "lon": "119e19", "gender": "男"})]),
}

# 刻意不入矩阵(记档理由,别让后人以为是漏了):
#   /geomancy   —— 随机种子起盘,逐字节黄金对它无意义
#   /xuanshi    —— GET summary 无参;玄学史的门在 Ship 3b 自己的用例里
#   /planetarium—— 依赖「此刻」
#   /qizhengelection —— 探针走 ping 早退,内容不稳定
KENTANG_EXCLUDED = {
    "/geomancy": "随机种子起盘,响应本就不该稳定",
    "/xuanshi": "GET/summary 无参数轴;玄学史载荷改动由 Ship 3b 专用用例覆盖",
    "/planetarium": "依赖当前时刻,不可作为逐字节黄金",
    "/qizhengelection": "探针为 ping 早退路径,不代表真实计算",
}


def _kentang_cases(quick):
    out = []
    dates = KENTANG_DATES[:1] if quick else KENTANG_DATES
    for mount, (subpath, axes) in sorted(KENTANG_SPECS.items()):
        for (dslug, y, m, d, h, mi) in dates:
            for (aslug, over) in axes:
                body = dict(KIN_BODY, year=y, month=m, day=d, hour=h, minute=mi)
                body.update(over)
                out.append({
                    "id": "kentang.%s.%s.%s" % (mount.strip("/"), dslug, aslug),
                    "group": "kentang",
                    "mount": mount, "subpath": subpath, "method": "POST", "body": body,
                })
    return out


def build_cases(quick=False, groups=None):
    """返回全部用例。groups=None 表示三族全上。"""
    cases = []
    want = set(groups) if groups else {"qimen", "astro", "kentang"}
    if "qimen" in want:
        cases.extend(_qimen_cases(quick))
    if "astro" in want:
        cases.extend(_astro_cases(quick))
    if "kentang" in want:
        cases.extend(_kentang_cases(quick))
    seen = set()
    for c in cases:
        if c["id"] in seen:
            raise AssertionError("duplicate case id: %s" % c["id"])
        seen.add(c["id"])
    return cases
