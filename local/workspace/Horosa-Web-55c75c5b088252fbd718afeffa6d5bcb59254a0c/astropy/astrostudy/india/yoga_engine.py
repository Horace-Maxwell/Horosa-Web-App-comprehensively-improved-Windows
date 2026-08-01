import math

from flatlib import const


YOGA_ENGINE_VERSION = '0.1.0'
YOGA_CATALOG_VERSION = 'core_yoga_catalog_v1'

SIGN_CN = {
    const.ARIES: '白羊',
    const.TAURUS: '金牛',
    const.GEMINI: '双子',
    const.CANCER: '巨蟹',
    const.LEO: '狮子',
    const.VIRGO: '处女',
    const.LIBRA: '天秤',
    const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手',
    const.CAPRICORN: '摩羯',
    const.AQUARIUS: '水瓶',
    const.PISCES: '双鱼',
}

PLANET_CN = {
    const.SUN: '太阳',
    const.MOON: '月亮',
    const.MARS: '火星',
    const.MERCURY: '水星',
    const.JUPITER: '木星',
    const.VENUS: '金星',
    const.SATURN: '土星',
    const.NORTH_NODE: '罗睺',
    const.SOUTH_NODE: '计都',
}

CLASSICAL_PLANETS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
    const.VENUS, const.SATURN
]

YOGA_PLANETS = CLASSICAL_PLANETS + [const.NORTH_NODE, const.SOUTH_NODE]

NATURAL_BENEFICS = {const.JUPITER, const.VENUS, const.MERCURY}
NATURAL_MALEFICS = {const.SUN, const.MARS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE}

KENDRA = {1, 4, 7, 10}
TRIKONA = {1, 5, 9}
DUSTHANA = {6, 8, 12}
UPACHAYA = {3, 6, 10, 11}

OWN_SIGNS = {
    const.SUN: [const.LEO],
    const.MOON: [const.CANCER],
    const.MARS: [const.ARIES, const.SCORPIO],
    const.MERCURY: [const.GEMINI, const.VIRGO],
    const.JUPITER: [const.SAGITTARIUS, const.PISCES],
    const.VENUS: [const.TAURUS, const.LIBRA],
    const.SATURN: [const.CAPRICORN, const.AQUARIUS],
}

SIGN_LORDS = {
    const.ARIES: const.MARS,
    const.TAURUS: const.VENUS,
    const.GEMINI: const.MERCURY,
    const.CANCER: const.MOON,
    const.LEO: const.SUN,
    const.VIRGO: const.MERCURY,
    const.LIBRA: const.VENUS,
    const.SCORPIO: const.MARS,
    const.SAGITTARIUS: const.JUPITER,
    const.CAPRICORN: const.SATURN,
    const.AQUARIUS: const.SATURN,
    const.PISCES: const.JUPITER,
}

EXALTATION = {
    const.SUN: (const.ARIES, 10),
    const.MOON: (const.TAURUS, 3),
    const.MARS: (const.CAPRICORN, 28),
    const.MERCURY: (const.VIRGO, 15),
    const.JUPITER: (const.CANCER, 5),
    const.VENUS: (const.PISCES, 27),
    const.SATURN: (const.LIBRA, 20),
}

MOOLATRIKONA = {
    const.SUN: (const.LEO, 0, 20),
    const.MOON: (const.TAURUS, 4, 30),
    const.MARS: (const.ARIES, 0, 12),
    const.MERCURY: (const.VIRGO, 16, 20),
    const.JUPITER: (const.SAGITTARIUS, 0, 10),
    const.VENUS: (const.LIBRA, 0, 15),
    const.SATURN: (const.AQUARIUS, 0, 20),
}

MAHAPURUSHA = [
    (const.MARS, 'ruchaka', 'Ruchaka Yoga', '鲁查卡瑜伽', '勇气、行动力、统御与竞争能力增强。'),
    (const.MERCURY, 'bhadra', 'Bhadra Yoga', '跋陀罗瑜伽', '智性、表达、商业和学习能力增强。'),
    (const.JUPITER, 'hamsa', 'Hamsa Yoga', '汉萨瑜伽', '德性、智慧、教学、宗教与保护性增强。'),
    (const.VENUS, 'malavya', 'Malavya Yoga', '摩罗毗耶瑜伽', '审美、舒适、关系、艺术与享受能力增强。'),
    (const.SATURN, 'shasha', 'Shasha Yoga', '沙沙瑜伽', '纪律、组织、长期权力、耐力与制度能力增强。'),
]

SOURCE_REFS = {
    'BPHS': 'Brihat Parashara Hora Shastra',
    'BJ': 'Brihat Jataka',
    'Phaladeepika': 'Phaladeepika',
    'JatakaParijata': 'Jataka Parijata',
    'Saravali': 'Saravali',
    'Modern': 'Modern Jyotish practice / software convention',
}


def norm(value):
    return float(value or 0) % 360.0


def sign_index_from_lon(lon):
    return int(norm(lon) / 30.0) % 12


def sign_name(index):
    return const.LIST_SIGNS[index % 12]


def sign_label(index):
    name = sign_name(index)
    return SIGN_CN.get(name, name)


def planet_label(planet):
    return PLANET_CN.get(planet, planet)


def house_number(obj):
    house = getattr(obj, 'house', None)
    if isinstance(house, str) and house.startswith('House'):
        try:
            return int(house[5:])
        except Exception:
            return None
    return None


def safe_get(chart, obj_id):
    try:
        return chart.get(obj_id)
    except Exception:
        return None


def rel_house(from_sign, to_sign):
    return ((to_sign - from_sign) % 12) + 1


def angular_distance(a, b):
    dist = abs(norm(a) - norm(b)) % 360.0
    return min(dist, 360.0 - dist)


class YogaEngine:
    def __init__(self, perchart):
        self.perchart = perchart
        self.chart = perchart.chart
        self.asc = safe_get(self.chart, const.ASC)
        self.asc_sign = sign_index_from_lon(getattr(self.asc, 'lon', 0))
        self.objects = {}
        self.signs = {}
        self.houses = {}
        for planet in YOGA_PLANETS:
            obj = safe_get(self.chart, planet)
            if obj:
                self.objects[planet] = obj
                self.signs[planet] = sign_index_from_lon(obj.lon)
                self.houses[planet] = house_number(obj) or rel_house(self.asc_sign, self.signs[planet])
        self.house_lords = self._house_lords()
        self.planet_houses_owned = self._planet_houses_owned()

    def compute(self):
        items = []
        items.extend(self.pancha_mahapurusha())
        items.extend(self.lunar_and_solar_yogas())
        items.extend(self.raja_yogas())
        items.extend(self.dhana_yogas())
        items.extend(self.viparita_raja_yogas())
        items.extend(self.parivartana_yogas())
        items.extend(self.neecha_bhanga_yogas())
        items.extend(self.extra_classical_yogas())
        items.extend(self.nabhasa_yogas())
        items.extend(self.aakriti_yogas())
        items.extend(self.dosha_yogas())
        items.extend(self.special_association_yogas())
        items = [item for item in items if item]
        items.sort(key=lambda item: (-item['score'], item['category'], item['name']))
        summary = self.summary(items)
        return {
            'available': True,
            'engine': {
                'name': 'Horosa YogaEngine',
                'version': YOGA_ENGINE_VERSION,
                'catalogVersion': YOGA_CATALOG_VERSION,
                'scope': 'core_classical_yogas_with_extensible_rule_primitives',
            },
            'summary': summary,
            'items': items,
            'sources': [
                {'key': key, 'label': label}
                for key, label in SOURCE_REFS.items()
            ],
            'notes': [
                '这里的 Yoga 指命盘行星组合；Panchanga 五支里的 27 Nitya Yoga 仍保留在 panchanga.yoga。',
                '强度分数是规则成立后的工程化排序：庙旺/本宫、角宫、互照、燃烧、凶星夹制等会调节结果，不等同于经典文本原文数值。',
                'Yoga 判据跑在当前显示盘上(切分盘即按该分盘位置重判);D9/D10/D60 的跨盘确认规则接口已预留。',
            ],
        }

    def summary(self, items):
        by_category = {}
        by_level = {}
        for item in items:
            by_category[item['category']] = by_category.get(item['category'], 0) + 1
            by_level[item['level']] = by_level.get(item['level'], 0) + 1
        return {
            'total': len(items),
            'strong': len([item for item in items if item['level'] == 'strong']),
            'medium': len([item for item in items if item['level'] == 'medium']),
            'weak': len([item for item in items if item['level'] == 'weak']),
            'byCategory': by_category,
            'byLevel': by_level,
        }

    def make_item(self, yoga_id, name, zh_name, category, score, evidence, result,
                  planets=None, houses=None, sources=None, modifiers=None, tags=None):
        score = max(1, min(int(round(score)), 100))
        if score >= 76:
            level = 'strong'
        elif score >= 51:
            level = 'medium'
        else:
            level = 'weak'
        return {
            'id': yoga_id,
            'name': name,
            'zhName': zh_name,
            'category': category,
            'status': 'present',
            'score': score,
            'level': level,
            'levelLabel': {'strong': '强', 'medium': '中', 'weak': '弱'}[level],
            'planets': planets or [],
            'planetLabels': [planet_label(item) for item in (planets or [])],
            'houses': houses or [],
            'evidence': evidence,
            'modifiers': modifiers or [],
            'sources': sources or [],
            'sourceLabels': [SOURCE_REFS.get(item, item) for item in (sources or [])],
            'tags': tags or [],
            'result': result,
        }

    def _house_lords(self):
        result = {}
        for house in range(1, 13):
            sign = sign_name(self.asc_sign + house - 1)
            result[house] = SIGN_LORDS[sign]
        return result

    def _planet_houses_owned(self):
        result = {planet: [] for planet in CLASSICAL_PLANETS}
        for house, lord in self.house_lords.items():
            result.setdefault(lord, []).append(house)
        return result

    def dignity(self, planet):
        obj = self.objects.get(planet)
        if not obj:
            return 'missing'
        sign = obj.sign
        signlon = getattr(obj, 'signlon', 0)
        if planet in EXALTATION:
            exalt_sign, exalt_deg = EXALTATION[planet]
            deb_sign = const.LIST_SIGNS[(const.LIST_SIGNS.index(exalt_sign) + 6) % 12]
            if sign == exalt_sign:
                return 'deep_exaltation' if abs(signlon - exalt_deg) < 1 else 'exaltation'
            if sign == deb_sign:
                return 'debilitation'
        if planet in MOOLATRIKONA:
            mt_sign, mt_start, mt_end = MOOLATRIKONA[planet]
            if sign == mt_sign and mt_start <= signlon <= mt_end:
                return 'moolatrikona'
        if sign in OWN_SIGNS.get(planet, []):
            return 'own_sign'
        return 'neutral'

    def dignity_score(self, planet):
        return {
            'deep_exaltation': 24,
            'exaltation': 21,
            'moolatrikona': 18,
            'own_sign': 16,
            'neutral': 0,
            'debilitation': -22,
        }.get(self.dignity(planet), 0)

    def is_strong(self, planet):
        return self.dignity(planet) in {'deep_exaltation', 'exaltation', 'moolatrikona', 'own_sign'}

    def dignity_text(self, planet):
        dignity = self.dignity(planet)
        return {
            'deep_exaltation': '精确旺相',
            'exaltation': '旺相',
            'moolatrikona': '本三角',
            'own_sign': '本宫',
            'neutral': '平常',
            'debilitation': '落陷',
            'missing': '缺失',
        }.get(dignity, dignity)

    def planet_house_from(self, planet, base):
        if planet not in self.signs or base not in self.signs:
            return None
        return rel_house(self.signs[base], self.signs[planet])

    def sign_has_planet(self, sign_idx, planets):
        return [planet for planet in planets if self.signs.get(planet) == sign_idx]

    def has_aspect(self, giver, receiver):
        if giver not in self.signs or receiver not in self.signs:
            return False
        target_house = rel_house(self.signs[giver], self.signs[receiver])
        aspects = {
            const.SUN: {7},
            const.MOON: {7},
            const.MARS: {4, 7, 8},
            const.MERCURY: {7},
            const.JUPITER: {5, 7, 9},
            const.VENUS: {7},
            const.SATURN: {3, 7, 10},
            const.NORTH_NODE: {5, 7, 9},
            const.SOUTH_NODE: {5, 7, 9},
        }
        return target_house in aspects.get(giver, set())

    def associated(self, a, b):
        return self.conjunct(a, b) or self.has_aspect(a, b) or self.has_aspect(b, a) or self.exchange(a, b)

    def conjunct(self, a, b):
        return a in self.signs and b in self.signs and self.signs[a] == self.signs[b]

    def exchange(self, a, b):
        if a not in self.objects or b not in self.objects:
            return False
        return SIGN_LORDS.get(self.objects[a].sign) == b and SIGN_LORDS.get(self.objects[b].sign) == a

    def combustion_modifier(self, planet):
        if planet == const.SUN or planet not in self.objects or const.SUN not in self.objects:
            return None
        orbs = {
            const.MOON: 12,
            const.MARS: 17,
            const.MERCURY: 14,
            const.JUPITER: 11,
            const.VENUS: 10,
            const.SATURN: 15,
        }
        orb = orbs.get(planet)
        if orb and angular_distance(self.objects[planet].lon, self.objects[const.SUN].lon) <= orb:
            return '{0}接近太阳，瑜伽结果需按燃烧/日光减弱处理'.format(planet_label(planet))
        return None

    def affliction_modifiers(self, planets):
        modifiers = []
        for planet in planets:
            if self.dignity(planet) == 'debilitation':
                modifiers.append('{0}落陷，降低组合质量'.format(planet_label(planet)))
            combust = self.combustion_modifier(planet)
            if combust:
                modifiers.append(combust)
            # horosa_yoga_planet_order_v1:NATURAL_MALEFICS 是 set,直接遍历会让 modifiers 的
            # 文案顺序随进程哈希变化(实测「金星受罗睺照射 / 金星受土星照射」两句跨进程互换)。
            # 遍历有序的 YOGA_PLANETS(含罗睺/计都)再过滤;条数不变 ⇒ base_score 也不变。
            for malefic in YOGA_PLANETS:
                if malefic in NATURAL_MALEFICS and malefic != planet and self.has_aspect(malefic, planet):
                    modifiers.append('{0}受{1}照射'.format(planet_label(planet), planet_label(malefic)))
        return list(dict.fromkeys(modifiers))

    def base_score(self, planets, base=50):
        score = base + sum(self.dignity_score(planet) for planet in planets)
        score -= 6 * len(self.affliction_modifiers(planets))
        return max(1, min(score, 100))

    def pancha_mahapurusha(self):
        items = []
        bases = [('lagna', self.asc_sign, '上升'), ('moon', self.signs.get(const.MOON), '月亮')]
        for planet, key, name, zh_name, result in MAHAPURUSHA:
            if planet not in self.signs or not self.is_strong(planet):
                continue
            for base_key, base_sign, base_label in bases:
                if base_sign is None:
                    continue
                house = rel_house(base_sign, self.signs[planet])
                if house in KENDRA:
                    evidence = [
                        '{0}位于{1}第{2}宫'.format(planet_label(planet), base_label, house),
                        '{0}在{1}，状态为{2}'.format(planet_label(planet), sign_label(self.signs[planet]), self.dignity_text(planet)),
                    ]
                    score = self.base_score([planet], 63 if base_key == 'lagna' else 55)
                    items.append(self.make_item(
                        '{0}_{1}'.format(key, base_key),
                        name,
                        zh_name,
                        'Pancha Mahapurusha',
                        score,
                        evidence,
                        result,
                        [planet],
                        [house],
                        ['BPHS', 'BJ', 'Phaladeepika'],
                        self.affliction_modifiers([planet]),
                        ['kendra', 'dignity', base_key],
                    ))
        return items

    def lunar_and_solar_yogas(self):
        items = []
        moon_sign = self.signs.get(const.MOON)
        sun_sign = self.signs.get(const.SUN)
        if moon_sign is not None:
            j_house = self.planet_house_from(const.JUPITER, const.MOON)
            if j_house in KENDRA:
                items.append(self.make_item(
                    'gaja_kesari',
                    'Gaja Kesari Yoga',
                    '象狮瑜伽',
                    'Lunar',
                    self.base_score([const.MOON, const.JUPITER], 58),
                    ['木星位于月亮第{0}宫，为月亮角宫'.format(j_house)],
                    '增强名望、智慧、保护力、善行和社会支持；需看月亮与木星强弱。',
                    [const.MOON, const.JUPITER],
                    [j_house],
                    ['BPHS', 'JatakaParijata'],
                    self.affliction_modifiers([const.MOON, const.JUPITER]),
                    ['moon', 'jupiter', 'kendra'],
                ))
            mars_house = self.planet_house_from(const.MARS, const.MOON)
            if mars_house in {1, 7}:
                items.append(self.make_item(
                    'chandra_mangala',
                    'Chandra Mangala Yoga',
                    '月火瑜伽',
                    'Lunar',
                    self.base_score([const.MOON, const.MARS], 48),
                    ['火星与月亮{0}'.format('同宫' if mars_house == 1 else '对冲互照')],
                    '增强交易、行动、财务动机和执行力；情绪急切时也易带来冲动。',
                    [const.MOON, const.MARS],
                    [mars_house],
                    ['Phaladeepika', 'Modern'],
                    self.affliction_modifiers([const.MOON, const.MARS]),
                    ['moon', 'mars'],
                ))
            occupied_2 = self.planets_in_relative_house(moon_sign, 2, exclude={const.SUN, const.NORTH_NODE, const.SOUTH_NODE})
            occupied_12 = self.planets_in_relative_house(moon_sign, 12, exclude={const.SUN, const.NORTH_NODE, const.SOUTH_NODE})
            if occupied_2 and occupied_12:
                items.append(self.make_item(
                    'durudhara',
                    'Durudhara Yoga',
                    '双夹月瑜伽',
                    'Lunar',
                    self.base_score(occupied_2 + occupied_12 + [const.MOON], 52),
                    ['月亮第2宫有{0}'.format('、'.join(planet_label(p) for p in occupied_2)),
                     '月亮第12宫有{0}'.format('、'.join(planet_label(p) for p in occupied_12))],
                    '月亮两侧有星体支撑，常主资源、表达、保护与较稳定的生活结构。',
                    [const.MOON] + occupied_2 + occupied_12,
                    [2, 12],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.MOON] + occupied_2 + occupied_12),
                    ['moon', 'flanking'],
                ))
            elif occupied_2:
                items.append(self.make_item(
                    'sunapha',
                    'Sunapha Yoga',
                    '月二瑜伽',
                    'Lunar',
                    self.base_score(occupied_2 + [const.MOON], 44),
                    ['月亮第2宫有{0}'.format('、'.join(planet_label(p) for p in occupied_2))],
                    '有助于自力、表达、财务能力和后天积累。',
                    [const.MOON] + occupied_2,
                    [2],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.MOON] + occupied_2),
                    ['moon'],
                ))
            elif occupied_12:
                items.append(self.make_item(
                    'anapha',
                    'Anapha Yoga',
                    '月十二瑜伽',
                    'Lunar',
                    self.base_score(occupied_12 + [const.MOON], 44),
                    ['月亮第12宫有{0}'.format('、'.join(planet_label(p) for p in occupied_12))],
                    '有助于内在涵养、独立性、节制和幕后资源。',
                    [const.MOON] + occupied_12,
                    [12],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.MOON] + occupied_12),
                    ['moon'],
                ))
            else:
                kendras_from_moon = []
                for house in KENDRA:
                    kendras_from_moon.extend(self.planets_in_relative_house(moon_sign, house, exclude={const.SUN, const.MOON, const.NORTH_NODE, const.SOUTH_NODE}))
                if not kendras_from_moon:
                    items.append(self.make_item(
                        'kemadruma',
                        'Kemadruma Yoga',
                        '贫月瑜伽',
                        'Challenge',
                        42,
                        ['月亮第2/12宫无非太阳星体，且月亮角宫缺少非节点支撑'],
                        '提示情绪支持、资源承接或稳定感较弱；若月亮强、角宫强或有吉照，可明显减轻。',
                        [const.MOON],
                        [],
                        ['BPHS', 'Phaladeepika'],
                        self.affliction_modifiers([const.MOON]),
                        ['moon', 'challenge'],
                    ))
            if const.JUPITER in self.signs and rel_house(self.signs[const.JUPITER], moon_sign) in {6, 8, 12}:
                items.append(self.make_item(
                    'sakata',
                    'Sakata Yoga',
                    '车轮瑜伽',
                    'Challenge',
                    38,
                    ['月亮在木星第{0}宫'.format(rel_house(self.signs[const.JUPITER], moon_sign))],
                    '提示起伏、周期性波动和资源不稳定；若木星/月亮强或受吉星支撑则减轻。',
                    [const.MOON, const.JUPITER],
                    [rel_house(self.signs[const.JUPITER], moon_sign)],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.MOON, const.JUPITER]),
                    ['moon', 'jupiter', 'challenge'],
                ))
            adhi_planets = []
            for house in [6, 7, 8]:
                adhi_planets.extend([p for p in self.planets_in_relative_house(moon_sign, house) if p in NATURAL_BENEFICS])
            if len(set(adhi_planets)) >= 2:
                items.append(self.make_item(
                    'chandra_adhi',
                    'Chandra Adhi Yoga',
                    '月亮阿迪瑜伽',
                    'Lunar',
                    self.base_score(list(set(adhi_planets)) + [const.MOON], 55),
                    ['月亮第6/7/8宫有吉星：{0}'.format('、'.join(planet_label(p) for p in sorted(set(adhi_planets))))],
                    '有助于被保护、得到顾问/贵人/制度资源，并提升社会应对能力。',
                    [const.MOON] + sorted(set(adhi_planets)),
                    [6, 7, 8],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.MOON] + sorted(set(adhi_planets))),
                    ['moon', 'benefic'],
                ))
        if sun_sign is not None:
            occupied_2 = self.planets_in_relative_house(sun_sign, 2, exclude={const.MOON, const.NORTH_NODE, const.SOUTH_NODE})
            occupied_12 = self.planets_in_relative_house(sun_sign, 12, exclude={const.MOON, const.NORTH_NODE, const.SOUTH_NODE})
            if const.MERCURY in self.signs and self.conjunct(const.SUN, const.MERCURY):
                modifiers = self.affliction_modifiers([const.SUN, const.MERCURY])
                if angular_distance(self.objects[const.SUN].lon, self.objects[const.MERCURY].lon) <= 6:
                    modifiers.append('水星离太阳很近，需区分智慧表达与燃烧减弱')
                items.append(self.make_item(
                    'budha_aditya',
                    'Budha-Aditya Yoga',
                    '日水瑜伽',
                    'Solar',
                    self.base_score([const.SUN, const.MERCURY], 48),
                    ['太阳与水星同在{0}'.format(sign_label(sun_sign))],
                    '增强学习、表达、分析、行政与商业理解力；过近时需看水星是否被太阳压制。',
                    [const.SUN, const.MERCURY],
                    [self.houses.get(const.SUN)],
                    ['Modern', 'Phaladeepika'],
                    modifiers,
                    ['sun', 'mercury'],
                ))
            if occupied_2:
                items.append(self.make_item(
                    'vesi',
                    'Vesi Yoga',
                    '日二瑜伽',
                    'Solar',
                    self.base_score(occupied_2 + [const.SUN], 40),
                    ['太阳第2宫有{0}'.format('、'.join(planet_label(p) for p in occupied_2))],
                    '太阳前方有星体承接，增强主动表达、事业动机与自我推进。',
                    [const.SUN] + occupied_2,
                    [2],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.SUN] + occupied_2),
                    ['sun'],
                ))
            if occupied_12:
                items.append(self.make_item(
                    'vosi',
                    'Vosi Yoga',
                    '日十二瑜伽',
                    'Solar',
                    self.base_score(occupied_12 + [const.SUN], 40),
                    ['太阳第12宫有{0}'.format('、'.join(planet_label(p) for p in occupied_12))],
                    '太阳后方有星体铺垫，增强准备、隐性资源、幕后判断与自我约束。',
                    [const.SUN] + occupied_12,
                    [12],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.SUN] + occupied_12),
                    ['sun'],
                ))
            if occupied_2 and occupied_12:
                items.append(self.make_item(
                    'ubhayachari',
                    'Ubhayachari Yoga',
                    '日双夹瑜伽',
                    'Solar',
                    self.base_score(occupied_2 + occupied_12 + [const.SUN], 54),
                    ['太阳第2/12宫两侧皆有星体'],
                    '太阳两侧有支撑，增强领导、名誉、行动节律和事业承载力。',
                    [const.SUN] + occupied_2 + occupied_12,
                    [2, 12],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([const.SUN] + occupied_2 + occupied_12),
                    ['sun', 'flanking'],
                ))
        return items

    def raja_yogas(self):
        items = []
        pairs = []
        for k_house in [1, 4, 7, 10]:
            for t_house in [1, 5, 9]:
                k_lord = self.house_lords[k_house]
                t_lord = self.house_lords[t_house]
                if k_lord == t_lord:
                    continue
                key = tuple(sorted([k_lord, t_lord]) + [k_house, t_house])
                if key in pairs:
                    continue
                if self.associated(k_lord, t_lord):
                    pairs.append(key)
                    score = self.base_score([k_lord, t_lord], 55)
                    evidence = [
                        '第{0}宫主{1}与第{2}宫主{3}发生关联'.format(
                            k_house, planet_label(k_lord), t_house, planet_label(t_lord)
                        ),
                        self.association_text(k_lord, t_lord),
                    ]
                    items.append(self.make_item(
                        'raja_{0}_{1}_{2}_{3}'.format(k_house, t_house, k_lord, t_lord),
                        'Kendra-Trikona Raja Yoga',
                        '角宫三分主星王瑜伽',
                        'Raja',
                        score,
                        evidence,
                        '角宫主与三分宫主关联，主地位、机会、上升通道与可见成就；强弱取决于两星状态和大运触发。',
                        [k_lord, t_lord],
                        [k_house, t_house],
                        ['BPHS', 'Phaladeepika'],
                        self.affliction_modifiers([k_lord, t_lord]),
                        ['kendra', 'trikona'],
                    ))
        yoga_karaka = self.yogakaraka_planet()
        if yoga_karaka and yoga_karaka in self.objects:
            houses = self.planet_houses_owned.get(yoga_karaka, [])
            score = self.base_score([yoga_karaka], 58)
            if self.houses.get(yoga_karaka) in KENDRA.union(TRIKONA):
                score += 10
            items.append(self.make_item(
                'yogakaraka_{0}'.format(yoga_karaka),
                'Yogakaraka Planet',
                '瑜伽成就星',
                'Raja',
                score,
                ['{0}同时掌管角宫/三分宫：{1}'.format(planet_label(yoga_karaka), '、'.join('第{0}宫'.format(h) for h in houses)),
                 '{0}位于第{1}宫，状态为{2}'.format(planet_label(yoga_karaka), self.houses.get(yoga_karaka), self.dignity_text(yoga_karaka))],
                '该星是本上升的关键成就星，其大运/小运常触发地位、事业与人生结构性机会。',
                [yoga_karaka],
                houses,
                ['BPHS', 'Phaladeepika'],
                self.affliction_modifiers([yoga_karaka]),
                ['yogakaraka'],
            ))
        return items

    def dhana_yogas(self):
        items = []
        wealth_houses = [2, 5, 9, 11]
        for i, h1 in enumerate(wealth_houses):
            for h2 in wealth_houses[i + 1:]:
                p1 = self.house_lords[h1]
                p2 = self.house_lords[h2]
                if p1 == p2:
                    continue
                if self.associated(p1, p2):
                    items.append(self.make_item(
                        'dhana_{0}_{1}_{2}_{3}'.format(h1, h2, p1, p2),
                        'Dhana Yoga',
                        '财富瑜伽',
                        'Dhana',
                        self.base_score([p1, p2], 50),
                        ['第{0}宫主{1}与第{2}宫主{3}关联'.format(h1, planet_label(p1), h2, planet_label(p2)),
                         self.association_text(p1, p2)],
                        '财富宫、福德宫与收益宫主星相连，增强积累、机会、资源流入和财务成长。',
                        [p1, p2],
                        [h1, h2],
                        ['BPHS', 'Phaladeepika'],
                        self.affliction_modifiers([p1, p2]),
                        ['wealth'],
                    ))
        second_lord = self.house_lords[2]
        if second_lord in self.objects and (self.is_strong(second_lord) or self.houses.get(second_lord) in KENDRA):
            evidence = ['第2宫主{0}位于第{1}宫，状态为{2}'.format(
                planet_label(second_lord), self.houses.get(second_lord), self.dignity_text(second_lord)
            )]
            if self.has_aspect(const.JUPITER, second_lord):
                evidence.append('木星照射第2宫主')
            items.append(self.make_item(
                'strong_second_lord_dhana',
                'Strong 2nd Lord Dhana Yoga',
                '二宫主财富瑜伽',
                'Dhana',
                self.base_score([second_lord], 47) + (8 if self.has_aspect(const.JUPITER, second_lord) else 0),
                evidence,
                '第2宫主强或得木星支持，有助于收入、家族资源、储蓄与语言带财。',
                [second_lord],
                [2, self.houses.get(second_lord)],
                ['BPHS', 'Modern'],
                self.affliction_modifiers([second_lord]),
                ['wealth', 'second_lord'],
            ))
        return items[:12]

    def viparita_raja_yogas(self):
        specs = [
            (6, 'harsha', 'Harsha Viparita Raja Yoga', '哈沙逆转王瑜伽', '第6宫主落入困难宫，能把竞争、疾病、敌人与债务议题转化为胜利经验。'),
            (8, 'sarala', 'Sarala Viparita Raja Yoga', '萨罗逆转王瑜伽', '第8宫主落入困难宫，能在危机、研究、突变和隐秘议题中反转局势。'),
            (12, 'vimala', 'Vimala Viparita Raja Yoga', '毗摩罗逆转王瑜伽', '第12宫主落入困难宫，能把损耗、远方、隐退或隔离议题转化为净化与掌控。'),
        ]
        items = []
        for house, key, name, zh_name, result in specs:
            lord = self.house_lords[house]
            lord_house = self.houses.get(lord)
            if lord_house in DUSTHANA:
                items.append(self.make_item(
                    key,
                    name,
                    zh_name,
                    'Viparita',
                    self.base_score([lord], 54),
                    ['第{0}宫主{1}位于第{2}宫'.format(house, planet_label(lord), lord_house)],
                    result,
                    [lord],
                    [house, lord_house],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([lord]),
                    ['dusthana', 'reversal'],
                ))
        return items

    def parivartana_yogas(self):
        items = []
        seen = set()
        for p1 in CLASSICAL_PLANETS:
            for p2 in CLASSICAL_PLANETS:
                if p1 >= p2:
                    continue
                if (p1, p2) in seen or p1 not in self.objects or p2 not in self.objects:
                    continue
                if self.exchange(p1, p2):
                    seen.add((p1, p2))
                    houses = sorted(set(self.planet_houses_owned.get(p1, []) + self.planet_houses_owned.get(p2, [])))
                    if any(h in DUSTHANA for h in houses):
                        category = 'Parivartana'
                        name = 'Dainya Parivartana Yoga'
                        zh = '困宫交换瑜伽'
                        base = 42
                    elif any(h in {3} for h in houses):
                        category = 'Parivartana'
                        name = 'Kahala Parivartana Yoga'
                        zh = '努力交换瑜伽'
                        base = 50
                    else:
                        category = 'Parivartana'
                        name = 'Maha Parivartana Yoga'
                        zh = '大交换瑜伽'
                        base = 62
                    items.append(self.make_item(
                        'parivartana_{0}_{1}'.format(p1, p2),
                        name,
                        zh,
                        category,
                        self.base_score([p1, p2], base),
                        ['{0}在{1}，{2}在{3}，互居对方星座'.format(
                            planet_label(p1), sign_label(self.signs[p1]), planet_label(p2), sign_label(self.signs[p2])
                        )],
                        '两颗宫主星交换星座，强力绑定其宫位事务；吉凶取决于涉及宫位和星体强弱。',
                        [p1, p2],
                        houses,
                        ['BPHS', 'Phaladeepika'],
                        self.affliction_modifiers([p1, p2]),
                        ['exchange'],
                    ))
        return items

    def neecha_bhanga_yogas(self):
        items = []
        for planet in CLASSICAL_PLANETS:
            if planet not in self.objects or self.dignity(planet) != 'debilitation':
                continue
            deb_sign = self.objects[planet].sign
            dispositor = SIGN_LORDS.get(deb_sign)
            exalt_sign, _ = EXALTATION.get(planet, (None, None))
            exalt_lord = SIGN_LORDS.get(exalt_sign) if exalt_sign else None
            conditions = []
            score = 42
            for base_name, base_sign in [('上升', self.asc_sign), ('月亮', self.signs.get(const.MOON))]:
                if base_sign is None:
                    continue
                if dispositor in self.signs and rel_house(base_sign, self.signs[dispositor]) in KENDRA:
                    conditions.append('落陷星座主{0}在{1}角宫'.format(planet_label(dispositor), base_name))
                    score += 12
                if exalt_lord in self.signs and rel_house(base_sign, self.signs[exalt_lord]) in KENDRA:
                    conditions.append('旺相星座主{0}在{1}角宫'.format(planet_label(exalt_lord), base_name))
                    score += 10
            if dispositor and self.conjunct(planet, dispositor):
                conditions.append('落陷星与其星座主同宫')
                score += 10
            if dispositor and self.has_aspect(dispositor, planet):
                conditions.append('落陷星受其星座主照射')
                score += 8
            if conditions:
                items.append(self.make_item(
                    'neecha_bhanga_{0}'.format(planet),
                    'Neecha Bhanga Raja Yoga',
                    '落陷取消王瑜伽',
                    'Raja',
                    score,
                    ['{0}在{1}落陷'.format(planet_label(planet), SIGN_CN.get(deb_sign, deb_sign))] + conditions,
                    '落陷被取消，常表现为先受挫后反弹；若取消条件强且相关大运触发，可形成上升与突破。',
                    [planet] + [p for p in [dispositor, exalt_lord] if p],
                    [self.houses.get(planet)],
                    ['BPHS', 'Phaladeepika'],
                    self.affliction_modifiers([planet]),
                    ['debilitation', 'cancellation'],
                ))
        return items

    def extra_classical_yogas(self):
        """长尾经典瑜伽:Shakata(月在木 6/8/12 起伏)、Saraswati(木金水各居角/三方/2 且木有力)、
        Chamara(≥2 自然吉曜共居 1/7/9/10)。条件确定可算,非臆断。"""
        items = []
        H = self.houses
        good = KENDRA | TRIKONA | {2}
        # (Shakata 车轮与主表 'sakata' 判据恒同 —— 曾双登记致同名两条分数打架,已并去,
        #  单一条目保留在主表 sakata。)
        # Saraswati 辩才天:木/金/水 各居 kendra/trikona/2 宫,且木星有力。
        if all(H.get(p) in good for p in (const.JUPITER, const.VENUS, const.MERCURY)) and self.is_strong(const.JUPITER):
            items.append(self.make_item(
                'saraswati', 'Saraswati Yoga', '辩才天瑜伽', 'Benefic',
                self.base_score([const.JUPITER, const.VENUS, const.MERCURY], 62),
                ['木/金/水分居角/三方/2 宫且木星有力'],
                '学识、艺术、辩才、写作与智慧卓越。',
                [const.JUPITER, const.VENUS, const.MERCURY],
                [H.get(const.JUPITER), H.get(const.VENUS), H.get(const.MERCURY)],
                ['Phaladeepika', 'JatakaParijata'],
                self.affliction_modifiers([const.JUPITER, const.VENUS, const.MERCURY]),
                ['jupiter', 'venus', 'mercury']))
        # Chamara 拂尘:≥2 自然吉曜共居 1/7/9/10。
        for h in (1, 7, 9, 10):
            # horosa_yoga_planet_order_v1(PERF-R9):NATURAL_BENEFICS/MALEFICS 是 **set**,
            # 直接遍历会继承哈希顺序 → 同一张盘每次启动后 yogas[].planets 排列可能不同
            # (实测跨进程仅顺序有别)。改为遍历有序的 CLASSICAL_PLANETS 再按集合过滤 ——
            # 成员逐元素等价,顺序变确定。本文件 963 行原本就是这个正确写法,此处补齐。
            bens = [p for p in CLASSICAL_PLANETS if p in NATURAL_BENEFICS and H.get(p) == h]
            if len(bens) >= 2:
                items.append(self.make_item(
                    'chamara', 'Chamara Yoga', '拂尘瑜伽', 'Benefic',
                    self.base_score(bens, 52),
                    ['{0}吉曜同居第{1}宫'.format('、'.join(planet_label(p) for p in bens), h)],
                    '雄辩、学识、尊荣与长寿。',
                    list(bens), [h], ['Phaladeepika'],
                    self.affliction_modifiers(list(bens)), ['benefic', 'kendra']))
                break
        return items

    def nabhasa_yogas(self):
        items = []
        signs = [self.signs[p] for p in CLASSICAL_PLANETS if p in self.signs]
        if not signs:
            return items
        unique_signs = sorted(set(signs))
        movable = {0, 3, 6, 9}
        fixed = {1, 4, 7, 10}
        dual = {2, 5, 8, 11}
        if all(sign in movable for sign in signs):
            items.append(self.make_item('nabhasa_rajju', 'Rajju Yoga', '绳索瑜伽', 'Nabhasa', 48, ['七曜皆在活动星座'], '主移动、旅行、变化和主动开拓的人生模式。', CLASSICAL_PLANETS, [], ['BPHS', 'BJ'], [], ['nabhasa']))
        if all(sign in fixed for sign in signs):
            items.append(self.make_item('nabhasa_musala', 'Musala Yoga', '杵瑜伽', 'Nabhasa', 48, ['七曜皆在固定星座'], '主稳定、积累、固执、产业和长期结构。', CLASSICAL_PLANETS, [], ['BPHS', 'BJ'], [], ['nabhasa']))
        if all(sign in dual for sign in signs):
            items.append(self.make_item('nabhasa_nala', 'Nala Yoga', '芦管瑜伽', 'Nabhasa', 48, ['七曜皆在双体星座'], '主适应、学习、多重路径和弹性。', CLASSICAL_PLANETS, [], ['BPHS', 'BJ'], [], ['nabhasa']))
        kendras = {self.signs[p] for p in CLASSICAL_PLANETS if self.houses.get(p) in KENDRA}
        # horosa_yoga_planet_order_v1:同上,遍历有序列表而非 set(顺序确定,成员不变)。
        benefic_kendra = [p for p in CLASSICAL_PLANETS if p in NATURAL_BENEFICS and self.houses.get(p) in KENDRA]
        malefic_kendra = [p for p in CLASSICAL_PLANETS if p in NATURAL_MALEFICS and self.houses.get(p) in KENDRA]
        if len(benefic_kendra) >= 2 and not malefic_kendra:
            items.append(self.make_item('nabhasa_mala', 'Mala Yoga', '花鬘瑜伽', 'Nabhasa', self.base_score(benefic_kendra, 50), ['吉星占据角宫，且角宫少凶星干扰'], '主舒适、名声、品德与社会支持。', benefic_kendra, list(KENDRA), ['BPHS', 'BJ'], self.affliction_modifiers(benefic_kendra), ['nabhasa', 'benefic']))
        if len(malefic_kendra) >= 2 and not benefic_kendra:
            items.append(self.make_item('nabhasa_sarpa', 'Sarpa Yoga', '蛇瑜伽', 'Nabhasa', self.base_score(malefic_kendra, 38), ['凶星占据角宫，且角宫缺少吉星平衡'], '主压力、斗争、警觉和人生紧张感；强盘可转为竞争力。', malefic_kendra, list(KENDRA), ['BPHS', 'BJ'], self.affliction_modifiers(malefic_kendra), ['nabhasa', 'challenge']))
        # Sankhya（数目）瑜伽：按七曜（不含罗睺/计都）占据的不同星座数判定，互斥（恰一）。
        sankhya_names = {
            1: ('Gola Yoga', '球瑜伽', '主体格强壮但清贫、不洁、缺乏教养，常多忧愁。Gola 意为球或天球。'),
            2: ('Yuga Yoga', '轭瑜伽', '主背离正统、贫困、被世人冷落，缺少来自子女与母亲的福乐。Yuga 意为一对、一轭。'),
            3: ('Shoola Yoga', '矛瑜伽', '主性情锋利、慵懒、激烈、清贫且受限，但勇武，能在征战中赢得赞誉。Shoola 为湿婆之兵器。'),
            4: ('Kedara Yoga', '田地瑜伽', '主务农耕作，安乐富足，乐于助人。Kedara 意为田地。'),
            5: ('Pasha Yoga', '绳缚瑜伽', '主有受拘禁之虞，办事干练、健谈、仆从众多，但品行较缺。Pasha 意为绳套。'),
            6: ('Dama Yoga', '花环瑜伽', '主极富且有名望，子女众多，多得珍宝，乐善好施。Dama 意为花环，亦有作 Damini。'),
            7: ('Veena Yoga', '维那琴瑜伽', '主喜好音乐、歌舞，仆从众多，富有而精巧，为众人之领袖。Veena 为弦乐器，亦有作 Vallaki。'),
        }
        if len(unique_signs) in sankhya_names:
            name, zh, result = sankhya_names[len(unique_signs)]
            items.append(self.make_item(
                'nabhasa_sankhya_{0}'.format(len(unique_signs)),
                name,
                zh,
                'Nabhasa',
                34 + len(unique_signs) * 3,
                ['七曜（不含罗睺/计都）分布在{0}个星座：{1}'.format(len(unique_signs), '、'.join(sign_label(s) for s in unique_signs))],
                result,
                CLASSICAL_PLANETS,
                [],
                ['BPHS', 'BJ'],
                [],
                ['nabhasa', 'sankhya', 'distribution'],
            ))
        return items

    def classical_houses_from(self, base_sign):
        # 七曜（不含罗睺/计都）从 base_sign 起的占据宫位集合（1..12）。
        if base_sign is None:
            return set()
        return {
            rel_house(base_sign, self.signs[p])
            for p in CLASSICAL_PLANETS if p in self.signs
        }

    def aakriti_yogas(self):
        # Aakriti（形态）瑜伽：按七曜（不含罗睺/计都）在十二宫中的几何分布判定。
        # 七曜全部齐备方可成立；以上升为基准（部分以四宫/七宫/十宫为基准，见各条）。
        items = []
        present = [p for p in CLASSICAL_PLANETS if p in self.signs]
        if len(present) < len(CLASSICAL_PLANETS):
            return items

        occ = self.classical_houses_from(self.asc_sign)            # 从上升
        occ4 = self.classical_houses_from((self.asc_sign + 3) % 12)   # 从第 4 宫
        occ7 = self.classical_houses_from((self.asc_sign + 6) % 12)   # 从第 7 宫
        occ10 = self.classical_houses_from((self.asc_sign + 9) % 12)  # 从第 10 宫
        benefic_houses = {
            rel_house(self.asc_sign, self.signs[p])
            for p in CLASSICAL_PLANETS if p in self.signs and p in NATURAL_BENEFICS
        }
        malefic_houses = {
            rel_house(self.asc_sign, self.signs[p])
            for p in CLASSICAL_PLANETS
            if p in self.signs and p in NATURAL_MALEFICS and p in CLASSICAL_PLANETS
        }

        def consecutive_from(occupied_set, start):
            # 占据宫位恰好落在自 start 起连续 7 宫之内。
            window = {((start - 1 + k) % 12) + 1 for k in range(7)}
            return occupied_set and occupied_set.issubset(window)

        def add(yid, name, zh, evidence_houses, result, tags, score=46):
            items.append(self.make_item(
                yid, name, zh, 'Aakriti', score,
                ['七曜（不含罗睺/计都）落于第{0}宫'.format(
                    '、'.join(str(h) for h in sorted(set(evidence_houses))))],
                result,
                CLASSICAL_PLANETS,
                sorted(set(evidence_houses)),
                ['BPHS', 'BJ'],
                [],
                ['aakriti', 'shape'] + tags,
            ))

        PANAPHARA = {2, 5, 8, 11}
        APOKLIMA = {3, 6, 9, 12}

        # Aakriti 诸形态彼此互斥：一张盘按其几何分布归入唯一一种形态。
        # 越“具体”的形态优先级越高，会压制范围更大的形态（如全角宫 Kamala、连续 7 宫等）。
        # 按优先级自上而下，命中第一档即采用。

        # ① 双宫/对宫族（最具体）
        adjacent_kendra_pairs = [{1, 4}, {4, 7}, {7, 10}, {10, 1}]
        if occ == {1, 7}:
            add('aakriti_sakata', 'Sakata Yoga', '车瑜伽', occ,
                '主多病、指甲难看、愚钝，缺亲少友，以拉车为生。Sakata 意为车。',
                ['axis', 'pair'])
        elif occ == {4, 10}:
            add('aakriti_vihanga', 'Vihanga Yoga', '鸟瑜伽', occ,
                '主好游荡，作信使，重情欲，不知羞且好争吵。Vihanga 意为鸟，亦作 Vihaga。',
                ['axis', 'pair'])
        elif occ in adjacent_kendra_pairs:
            # 全部落于两个相邻角宫（如 4&7 或 10&1）。
            add('aakriti_gada', 'Gada Yoga', '杵瑜伽', occ,
                '主有财富、黄金与珍宝，行祭祀之礼，通晓经论与歌乐。Gada 意为杵或棍棒。',
                ['kendra', 'pair'])

        # ② 三角族
        elif occ == {1, 5, 9}:
            add('aakriti_sringataka', 'Sringataka Yoga', '三叉路瑜伽', occ,
                '主安乐、为君王所喜，妻贤而己厌女色，富有。Sringataka 意为三岔路口。',
                ['trikona'])
        elif occ in ({2, 6, 10}, {3, 7, 11}, {4, 8, 12}):
            # 彼此成三角但非上升三角的一组。
            add('aakriti_hala', 'Hala Yoga', '犁瑜伽', occ,
                '主为农夫，食量大而贫困，为亲友所弃，忧苦不乐。Hala 意为犁。',
                ['trikona-set'])

        # ③ 吉凶配位族（全角宫，依吉/凶星定位区分 Vajra/Yava）
        elif occ == {1, 4, 7, 10} and {1, 7} == benefic_houses and {4, 10} == malefic_houses:
            add('aakriti_vajra', 'Vajra Yoga', '金刚瑜伽', occ,
                '主早年与晚年安乐，有勇力；福分一般但少欲，好争斗。Vajra 意为金刚石。',
                ['kendra', 'benefic-malefic'])
        elif occ == {1, 4, 7, 10} and {1, 7} == malefic_houses and {4, 10} == benefic_houses:
            add('aakriti_yava', 'Yava Yoga', '麦粒瑜伽', occ,
                '主守持戒律，中年安乐，有财富与佳儿，乐善而意志坚定。Yava 意为谷粒等。',
                ['kendra', 'benefic-malefic'])

        # ④ 四连宫族（自上升起的四宫连续段）
        elif occ == {1, 2, 3, 4}:
            add('aakriti_yupa', 'Yupa Yoga', '祭柱瑜伽', occ,
                '主有灵性智慧与祭祀之学，妻常相伴，具善性（sattwa），谨守一切戒律。Yupa 意为柱、尤指祭祀之柱。',
                ['quad-run'])
        elif occ == {4, 5, 6, 7}:
            add('aakriti_sara', 'Sara Yoga', '箭瑜伽', occ,
                '主造箭，掌牢狱，为猎人，食肉，且好施暴于人。Sara 意为箭。',
                ['quad-run'])
        elif occ == {7, 8, 9, 10}:
            add('aakriti_sakti', 'Sakti Yoga', '力瑜伽', occ,
                '主不乐、清贫、不顺、卑微、慵懒、长寿而坚定，于战阵中心思敏锐。Sakti 意为力，亦为一种利器。',
                ['quad-run'])
        elif occ == {10, 11, 12, 1}:
            add('aakriti_danda', 'Danda Yoga', '杖瑜伽', occ,
                '主失妻丧子、为亲众所弃，常不乐而事奉卑劣之人。Danda 意为责罚之杖。',
                ['quad-run'])

        # ⑤ 隔宫族（奇/偶六宫）
        elif occ == {1, 3, 5, 7, 9, 11}:
            add('aakriti_chakra', 'Chakra Yoga', '轮瑜伽', occ,
                '主为大帝，众王俯首、镶钻王冠触其足（万王朝拜）。Chakra 意为轮，Chakravarti 即转轮帝王。',
                ['alternating'], score=60)
        elif occ == {2, 4, 6, 8, 10, 12}:
            add('aakriti_samudra', 'Samudra Yoga', '海瑜伽', occ,
                '主拥有大量财富与珍宝，享受奢华，亲善于人，福禄与显达皆稳固，性情温和。Samudra 意为海洋，亦为海神之名。',
                ['alternating'], score=58)

        # ⑥ 全角宫 / 全续宫·果宫族（较宽，落于此前需未命中更具体形态）
        elif occ.issubset(KENDRA):
            add('aakriti_kamala', 'Kamala Yoga', '莲花瑜伽', sorted(occ),
                '主为君王，品格刚强，有名望且长寿，纯净而多行善举。Kamala 意为莲花。',
                ['kendra', 'all'], score=58)
        elif occ.issubset(PANAPHARA) or occ.issubset(APOKLIMA):
            add('aakriti_vaapi', 'Vaapi Yoga', '水池瑜伽', sorted(occ),
                '主心思善于积财，享有诸般安逸，可成君王。Vaapi 意为池塘、水井或蓄水之所。',
                ['panapara-apoklima', 'all'])

        # ⑦ 连续 7 宫族（最宽的形态；按基准宫与起点区分）
        elif consecutive_from(occ, 1):
            add('aakriti_nauka', 'Nauka Yoga', '舟瑜伽', sorted(occ),
                '主以水相关之事生财，多欲望，颇有名声，但奸狡、粗鲁而吝啬。Nauka 意为舟船。',
                ['seven-run'])
        elif consecutive_from(occ4, 1):
            # 自第 4 宫起连续 7 宫。
            add('aakriti_koota', 'Koota Yoga', '堡瑜伽', sorted(occ),
                '主作狱卒，好说谎，居于山岭与城堡，贫困而残酷。Koota 意为群，亦有他义。',
                ['seven-run'])
        elif consecutive_from(occ7, 1):
            # 自第 7 宫起连续 7 宫。
            add('aakriti_chatra', 'Chatra Yoga', '伞瑜伽', sorted(occ),
                '主助益己之亲众，仁慈而为众王所喜，聪慧，早年与晚年安乐，且长寿。Chatra 意为伞。',
                ['seven-run'])
        elif consecutive_from(occ10, 1):
            # 自第 10 宫起连续 7 宫。
            add('aakriti_chapa', 'Chapa Yoga', '弓瑜伽', sorted(occ),
                '主好说谎、为盗，护守秘密，游荡于林莽，福薄，惟中年安乐。Chapa 意为弓。',
                ['seven-run'])
        elif any(consecutive_from(occ, start) for start in sorted(PANAPHARA | APOKLIMA)):
            # 自某续宫或果宫起的连续 7 宫。
            add('aakriti_ardha_chandra', 'Ardha Chandra Yoga', '半月瑜伽', sorted(occ),
                '主为军中统帅，体魄佳美，为君王所喜，强健而拥有珍宝、黄金与诸多饰物。Ardha Chandra 意为半月。',
                ['seven-run', 'half-moon'])

        return items

    def dosha_yogas(self):
        items = []
        mars_houses = []
        for base, label in [(self.asc_sign, '上升'), (self.signs.get(const.MOON), '月亮'), (self.signs.get(const.VENUS), '金星')]:
            if base is not None and const.MARS in self.signs:
                house = rel_house(base, self.signs[const.MARS])
                if house in {1, 2, 4, 7, 8, 12}:
                    mars_houses.append('{0}第{1}宫'.format(label, house))
        if mars_houses:
            items.append(self.make_item(
                'kuja_dosha',
                'Kuja / Manglik Dosha',
                '火星婚配煞',
                'Challenge',
                36 + min(24, len(mars_houses) * 8),
                ['火星位于：{0}'.format('、'.join(mars_houses))],
                '婚配与关系中火星能量较强，需看第7宫、金星、木星和婚配盘是否缓解。',
                [const.MARS],
                [],
                ['Modern', 'BPHS'],
                self.affliction_modifiers([const.MARS]),
                ['marriage', 'mars'],
            ))
        if self.conjunct(const.SUN, const.NORTH_NODE) or self.conjunct(const.SUN, const.SOUTH_NODE):
            node = const.NORTH_NODE if self.conjunct(const.SUN, const.NORTH_NODE) else const.SOUTH_NODE
            items.append(self.make_item(
                'surya_grahana',
                'Surya Grahana Yoga',
                '日蚀瑜伽',
                'Challenge',
                44,
                ['太阳与{0}同星座'.format(planet_label(node))],
                '太阳受节点吞食，常提示父亲、权威、自我表达或名誉议题需要净化。',
                [const.SUN, node],
                [self.houses.get(const.SUN)],
                ['Modern', 'BPHS'],
                self.affliction_modifiers([const.SUN, node]),
                ['eclipse', 'node'],
            ))
        if self.conjunct(const.MOON, const.NORTH_NODE) or self.conjunct(const.MOON, const.SOUTH_NODE):
            node = const.NORTH_NODE if self.conjunct(const.MOON, const.NORTH_NODE) else const.SOUTH_NODE
            items.append(self.make_item(
                'chandra_grahana',
                'Chandra Grahana Yoga',
                '月蚀瑜伽',
                'Challenge',
                44,
                ['月亮与{0}同星座'.format(planet_label(node))],
                '月亮受节点吞食，常提示情绪、安全感、母亲或公众关系议题需要调节。',
                [const.MOON, node],
                [self.houses.get(const.MOON)],
                ['Modern', 'BPHS'],
                self.affliction_modifiers([const.MOON, node]),
                ['eclipse', 'node'],
            ))
        p2 = self.planets_in_relative_house(self.asc_sign, 2)
        p12 = self.planets_in_relative_house(self.asc_sign, 12)
        if p2 and p12 and all(p in NATURAL_MALEFICS for p in p2 + p12):
            items.append(self.make_item(
                'papa_kartari_lagna',
                'Papa Kartari Yoga around Lagna',
                '上升凶夹瑜伽',
                'Challenge',
                48,
                ['上升第2宫和第12宫皆由凶星夹持'],
                '上升被凶星夹制，主压力、受限和外界逼迫；若上升主强可转化为韧性。',
                p2 + p12,
                [2, 12],
                ['BPHS', 'Modern'],
                self.affliction_modifiers(p2 + p12),
                ['kartari', 'lagna'],
            ))
        if p2 and p12 and all(p in NATURAL_BENEFICS for p in p2 + p12):
            items.append(self.make_item(
                'shubha_kartari_lagna',
                'Shubha Kartari Yoga around Lagna',
                '上升吉夹瑜伽',
                'Support',
                self.base_score(p2 + p12, 52),
                ['上升第2宫和第12宫皆由吉星夹持'],
                '上升被吉星保护，增强外部支持、恢复力、形象与人生承接力。',
                p2 + p12,
                [2, 12],
                ['BPHS', 'Modern'],
                self.affliction_modifiers(p2 + p12),
                ['kartari', 'lagna'],
            ))
        if self.is_kalasarpa():
            items.append(self.make_item(
                'kala_sarpa',
                'Kala Sarpa Yoga',
                '时蛇瑜伽',
                'Challenge',
                40,
                ['七曜集中在罗睺-计都轴的一侧'],
                '现代实践常用的节点轴集中格局，提示人生议题受节点轴强烈牵引；经典争议较多，需谨慎使用。',
                [const.NORTH_NODE, const.SOUTH_NODE],
                [],
                ['Modern'],
                [],
                ['node', 'contested'],
            ))
        return items

    def special_association_yogas(self):
        specs = [
            (const.JUPITER, const.MARS, 'guru_mangala', 'Guru Mangala Yoga', '木火瑜伽', '木星与火星关联，增强行动中的判断力、保护性竞争、技术与创业能力。'),
            (const.VENUS, const.MARS, 'shukra_mangala', 'Shukra Mangala Yoga', '金火瑜伽', '金星与火星关联，增强欲望、艺术表现、关系吸引与创造冲动。'),
            (const.SATURN, const.MOON, 'vish_chandra_shani', 'Vish / Chandra-Shani Yoga', '月土压力瑜伽', '月亮与土星关联，提示情绪压抑、责任感、延迟成熟和耐受力课题。'),
        ]
        items = []
        for p1, p2, key, name, zh, result in specs:
            if p1 in self.objects and p2 in self.objects and self.associated(p1, p2):
                category = 'Challenge' if key == 'vish_chandra_shani' else 'Association'
                items.append(self.make_item(
                    key,
                    name,
                    zh,
                    category,
                    self.base_score([p1, p2], 44),
                    [self.association_text(p1, p2)],
                    result,
                    [p1, p2],
                    [self.houses.get(p1), self.houses.get(p2)],
                    ['Modern', 'Phaladeepika'],
                    self.affliction_modifiers([p1, p2]),
                    ['association'],
                ))
        loaded_signs = {}
        for p in CLASSICAL_PLANETS:
            if p in self.signs:
                loaded_signs.setdefault(self.signs[p], []).append(p)
        for sign, planets in loaded_signs.items():
            if len(planets) >= 4:
                items.append(self.make_item(
                    'pravrajya_{0}'.format(sign),
                    'Pravrajya / Sanyasa Yoga',
                    '出离瑜伽',
                    'Spiritual',
                    self.base_score(planets, 52),
                    ['四颗以上七曜集中在{0}：{1}'.format(sign_label(sign), '、'.join(planet_label(p) for p in planets))],
                    '多星聚集可形成强烈的人生焦点；若土星或第9/12宫参与，常带出出离、修行或非世俗路径。',
                    planets,
                    [self.houses.get(p) for p in planets],
                    ['BPHS', 'BJ'],
                    self.affliction_modifiers(planets),
                    ['spiritual', 'cluster'],
                ))
        return items

    def planets_in_relative_house(self, base_sign, house, exclude=None):
        if base_sign is None:
            return []
        exclude = exclude or set()
        target = (base_sign + house - 1) % 12
        return [
            planet for planet, sign in self.signs.items()
            if planet not in exclude and sign == target
        ]

    def association_text(self, a, b):
        labels = (planet_label(a), planet_label(b))
        if self.conjunct(a, b):
            return '{0}与{1}同宫'.format(*labels)
        if self.exchange(a, b):
            return '{0}与{1}星座交换'.format(*labels)
        if self.has_aspect(a, b) and self.has_aspect(b, a):
            return '{0}与{1}互相照射'.format(*labels)
        if self.has_aspect(a, b):
            return '{0}照射{1}'.format(*labels)
        if self.has_aspect(b, a):
            return '{1}照射{0}'.format(*labels)
        return '{0}与{1}关联'.format(*labels)

    def yogakaraka_planet(self):
        for planet, houses in self.planet_houses_owned.items():
            if any(h in KENDRA for h in houses) and any(h in {5, 9} for h in houses):
                return planet
        return None

    def is_kalasarpa(self):
        if const.NORTH_NODE not in self.objects or const.SOUTH_NODE not in self.objects:
            return False
        rahu = norm(self.objects[const.NORTH_NODE].lon)
        ketu = norm(self.objects[const.SOUTH_NODE].lon)

        def between(start, end, value):
            start = norm(start)
            end = norm(end)
            value = norm(value)
            if start <= end:
                return start <= value <= end
            return value >= start or value <= end

        classical_lons = [norm(self.objects[p].lon) for p in CLASSICAL_PLANETS if p in self.objects]
        if not classical_lons:
            return False
        one_side = all(between(rahu, ketu, lon) for lon in classical_lons)
        other_side = all(between(ketu, rahu, lon) for lon in classical_lons)
        return one_side or other_side


def build_yogas(perchart):
    return YogaEngine(perchart).compute()
