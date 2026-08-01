"""Tests for 萬化仙禽 (WanHua XianQin) charting tool."""

import pytest
from astro.chinstar.chinstar import (
    WanHuaXianQin,
    HOSTS,
    QIN_NAMES,
    QIN_ELEMENT,
    BRANCHES,
    PALACE_NAMES,
    PERSONALITY_DICT,
    ZHENG_XIANG_DICT,
    PAIRING_TABLE,
    SEASON_QIN,
    SWALLOW_RULES,
    MONTH_STAR_START,
    BRANCH_ELEMENT,
)


class TestWanHuaXianQin:
    """Tests for the 萬化仙禽 charting tool."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.tool = WanHuaXianQin()

    # ── 三元 ──────────────────────────────────

    def test_san_yuan_upper(self):
        assert self.tool.determine_san_yuan(1138) == "上元"

    def test_san_yuan_middle(self):
        assert self.tool.determine_san_yuan(1200) == "中元"

    def test_san_yuan_lower(self):
        assert self.tool.determine_san_yuan(1260) == "下元"

    def test_san_yuan_cycle(self):
        """180-year cycle wraps correctly."""
        s1 = self.tool.determine_san_yuan(1138)
        s2 = self.tool.determine_san_yuan(1138 + 180)
        assert s1 == s2

    # ── 太陽入宮 / 命宮 ──────────────────────

    def test_sun_palace_month3(self):
        """Month 3 → sun at 戌(10)."""
        assert self.tool._sun_palace_idx(3) == 10

    def test_sun_palace_month1(self):
        """Month 1 → sun at 子(0)."""
        assert self.tool._sun_palace_idx(1) == 0

    def test_sun_palace_month12(self):
        """Month 12 → sun at 丑(1)."""
        assert self.tool._sun_palace_idx(12) == 1

    def test_sun_palace_all_months(self):
        """All 12 months produce distinct valid indices."""
        indices = [self.tool._sun_palace_idx(m) for m in range(1, 13)]
        assert len(set(indices)) == 12

    def test_ming_gong_text_example(self):
        """Text example: 戊子年三月十五巳時 → 命宮=申(8)."""
        idx = self.tool.calc_ming_gong_idx(3, 15, 9)
        assert idx == 8  # 申

    def test_ming_gong_different_hour(self):
        """Different hour gives different result."""
        idx1 = self.tool.calc_ming_gong_idx(3, 15, 9)
        idx2 = self.tool.calc_ming_gong_idx(3, 15, 15)
        assert idx1 != idx2

    def test_ming_gong_range(self):
        """Ming gong index always in 0-11."""
        for m in range(1, 13):
            for h in range(0, 24, 2):
                idx = self.tool.calc_ming_gong_idx(m, 1, h)
                assert 0 <= idx < 12

    # ── 日夜生 ──────────────────────────────

    def test_day_birth_morning(self):
        assert self.tool.is_day_birth(9) is True

    def test_night_birth_late(self):
        assert self.tool.is_day_birth(23) is False

    def test_day_birth_boundary(self):
        assert self.tool.is_day_birth(5) is True
        assert self.tool.is_day_birth(18) is True
        assert self.tool.is_day_birth(19) is False
        assert self.tool.is_day_birth(4) is False

    # ── 吞啗判斷 ──────────────────────────────

    def test_swallow_tiger_eats_pig(self):
        assert self.tool.judge_swallow("尾火虎", "室火豬") == "吞"

    def test_swallow_tiger_eats_sheep(self):
        assert self.tool.judge_swallow("尾火虎", "鬼金羊") == "吞"

    def test_swallow_dragon_eats_swallow(self):
        assert self.tool.judge_swallow("角木蛟", "危月燕") == "吞"

    def test_swallow_fox_eats_pheasant(self):
        assert self.tool.judge_swallow("心月狐", "昴日雞") == "吞"

    def test_swallow_dog_eats_monkey(self):
        assert self.tool.judge_swallow("婁金狗", "觜火猴") == "吞"

    def test_swallow_wolf_devours_deer(self):
        assert self.tool.judge_swallow("奎木狼", "張月鹿") == "啗"

    def test_swallow_same_qin(self):
        assert self.tool.judge_swallow("角木蛟", "角木蛟") == "合"

    def test_swallow_reverse_gives_battle(self):
        assert self.tool.judge_swallow("危月燕", "角木蛟") == "戰"

    def test_swallow_an_eats_tiger(self):
        """犴吞虎豹蛟龍類 (line 884)."""
        assert self.tool.judge_swallow("井木犴", "尾火虎") == "吞"
        assert self.tool.judge_swallow("井木犴", "箕水豹") == "吞"

    def test_swallow_worm_fears_chicken(self):
        """昴胃畢啄軫 (line 2353)."""
        assert self.tool.judge_swallow("昴日雞", "軫水蚓") == "吞"
        assert self.tool.judge_swallow("胃土雉", "軫水蚓") == "吞"

    def test_swallow_snake_hurts_rabbit(self):
        """蛇傷鼠兔 — 翼火蛇 vs 房日兔."""
        assert self.tool.judge_swallow("翼火蛇", "房日兔") == "吞"

    def test_swallow_element_fallback_ke(self):
        """Wood overcomes earth → 啗 via element fallback."""
        result = self.tool.judge_swallow("斗木獬", "柳土獐")
        assert result == "啗"  # 木剋土

    def test_swallow_element_fallback_sheng(self):
        """Wood generates fire → 合 via element fallback."""
        result = self.tool.judge_swallow("斗木獬", "星日馬")
        assert result == "合"  # 木生火

    def test_swallow_valid_output(self):
        """All pairs produce valid results."""
        for q1 in QIN_NAMES[:5]:
            for q2 in QIN_NAMES[5:10]:
                result = self.tool.judge_swallow(q1, q2)
                assert result in ("吞", "啗", "合", "戰", "無")

    # ── 情性賦 ──────────────────────────────

    def test_personality_all_28(self):
        for qin in QIN_NAMES:
            assert qin in PERSONALITY_DICT

    def test_personality_sample(self):
        assert self.tool.get_personality("角木蛟") == "近官利貴"
        assert self.tool.get_personality("虛日鼠") == "有終無始"
        assert self.tool.get_personality("軫水蚓") == "三教賢人"

    def test_personality_missing(self):
        assert self.tool.get_personality("不存在的禽") == "無對應情性賦"

    # ── 正像 ──────────────────────────────

    def test_zheng_xiang_sample(self):
        assert ZHENG_XIANG_DICT["丙子"] == "虛日鼠"
        assert ZHENG_XIANG_DICT["甲辰"] == "角木蛟"
        assert ZHENG_XIANG_DICT["庚辰"] == "亢金龍"

    def test_zheng_xiang_complete(self):
        assert len(ZHENG_XIANG_DICT) == 28

    # ── 合宿 ──────────────────────────────

    def test_pairing_table_symmetric(self):
        for k, v in PAIRING_TABLE.items():
            assert PAIRING_TABLE[v] == k

    def test_pairing_count(self):
        assert len(PAIRING_TABLE) == 24  # 12 pairs × 2 directions

    def test_pairing_sample(self):
        paired = self.tool.get_paired_host("虛日鼠")
        assert "斗木獬" == paired

    # ── 四季得時 ──────────────────────────────

    def test_season_qin_total_28(self):
        total = sum(len(v) for v in SEASON_QIN.values())
        assert total == 28

    def test_season_qin_no_duplicate(self):
        all_qin = [q for v in SEASON_QIN.values() for q in v]
        assert len(all_qin) == len(set(all_qin))

    def test_season_qin_all_valid(self):
        for season, qins in SEASON_QIN.items():
            for q in qins:
                assert q in QIN_NAMES

    # ── 格局判斷 ──────────────────────────────

    def test_judge_pattern_returns_grade(self):
        result = self.tool.judge_pattern("角木蛟", 8, 3, 9)
        assert result["grade"] in ("上格", "中格", "下格")
        assert "reason" in result

    def test_judge_pattern_in_season(self):
        """Spring + 角木蛟 → should get 得時."""
        result = self.tool.judge_pattern("角木蛟", 4, 2, 10)
        assert "得時" in result["reason"]

    def test_judge_pattern_out_of_season(self):
        """Summer + 角木蛟 → should not get 得時."""
        result = self.tool.judge_pattern("角木蛟", 8, 6, 9)
        assert "得時" not in result["reason"] or "失" in result["reason"]

    # ── 完整起盤 ──────────────────────────────

    def test_build_chart_returns_dict(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        assert isinstance(chart, dict)
        assert "basic_info" in chart
        assert "palaces" in chart
        assert "stars" in chart
        assert "swallow_analysis" in chart
        assert "personality" in chart
        assert "pattern" in chart

    def test_build_chart_basic_info(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        bi = chart["basic_info"]
        assert bi["san_yuan"] == "上元"
        assert bi["day_night"] == "日生"
        assert bi["gender"] == "男"
        assert bi["season"] == "春"

    def test_build_chart_ming_gong(self):
        """Text example: 命宮 = 申."""
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        assert chart["palaces"]["ming_gong"]["branch"] == "申"

    def test_build_chart_has_all_derived(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        derived = chart["stars"]["derived"]
        expected_keys = [
            "田宅星", "福德星", "官祿星", "遷移星", "疾厄星",
            "財帛星", "奴僕星", "妻妾星", "兄弟星", "子息星",
            "相貌星", "科名星", "壽星",
        ]
        for key in expected_keys:
            assert key in derived

    def test_build_chart_swallow_not_empty(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        assert len(chart["swallow_analysis"]) > 0

    def test_build_chart_female(self):
        chart = self.tool.build_chart(1990, 6, 10, 22, "F")
        assert chart["basic_info"]["gender"] == "女"
        assert chart["basic_info"]["day_night"] == "夜生"

    def test_build_chart_twelve_palaces(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        twelve = chart["palaces"]["twelve"]
        assert len(twelve) == 12

    # ── 格式化輸出 ──────────────────────────────

    def test_format_chart_string(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        text = WanHuaXianQin.format_chart(chart)
        assert "萬化仙禽" in text
        assert "胎星" in text
        assert "命星" in text
        assert "吞啗" in text
        assert "格局" in text

    def test_format_chart_contains_branches(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        text = WanHuaXianQin.format_chart(chart)
        assert "申" in text  # 命宮=申

    # ── 衍生星計算 ──────────────────────────────

    def test_derived_stars_all_valid_qin(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        for name, qin in chart["stars"]["derived"].items():
            assert qin in QIN_NAMES, f"{name}={qin} not a valid qin"

    def test_main_stars_valid_qin(self):
        chart = self.tool.build_chart(1138, 3, 15, 9, "M")
        assert chart["stars"]["tai_xing"] in QIN_NAMES
        assert chart["stars"]["ming_xing"] in QIN_NAMES
        assert chart["stars"]["shen_xing"] in QIN_NAMES

    def test_different_inputs_different_charts(self):
        c1 = self.tool.build_chart(1138, 3, 15, 9, "M")
        c2 = self.tool.build_chart(1990, 8, 20, 14, "F")
        assert c1["stars"]["tai_xing"] != c2["stars"]["tai_xing"] or \
               c1["palaces"]["ming_gong"] != c2["palaces"]["ming_gong"]

    # ── Constants integrity ──────────────────────

    def test_qin_names_count(self):
        assert len(QIN_NAMES) == 28

    def test_hosts_count(self):
        assert len(HOSTS) == 28

    def test_qin_element_count(self):
        assert len(QIN_ELEMENT) == 28

    def test_branches_count(self):
        assert len(BRANCHES) == 12

    def test_palace_names_count(self):
        assert len(PALACE_NAMES) == 12

    def test_branch_element_count(self):
        assert len(BRANCH_ELEMENT) == 12

    def test_month_star_start_count(self):
        assert len(MONTH_STAR_START) == 12

    def test_swallow_rules_has_entries(self):
        assert len(SWALLOW_RULES) > 15


class TestDayunLiunianYuanchen:
    """WP-12/13：大限 / 流年小限 / 元辰禽（萬化仙禽起例）。"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.tool = WanHuaXianQin()

    def test_yuanchen_is_ming_chong(self):
        # 元辰禽 = 命宮對衝位(命宮+6)所值之禽（命星加子演至衝位）
        chart = self.tool.build_chart(1988, 3, 15, 10, "M")
        ming_gong = BRANCHES.index(chart["palaces"]["ming_gong"]["branch"])
        expected = self.tool._evolve_to_palace(chart["stars"]["ming_xing"], (ming_gong + 6) % 12)
        assert chart["stars"]["yuanchen_xing"] == expected

    def test_dayun_start_age_by_ming_yao(self):
        # 起運虛歲＝命星曜(水1火2木3金4土5日6月7)；1988-03-15-10 命星角木蛟(木)→起運3
        chart = self.tool.build_chart(1988, 3, 15, 10, "M")
        assert chart["stars"]["ming_xing"] == "角木蛟"
        assert chart["dayun"]["start_age"] == 3
        # 十二限、十年一移
        assert len(chart["dayun"]["limits"]) == 12
        assert chart["dayun"]["limits"][0]["age_start"] == 3
        assert chart["dayun"]["limits"][1]["age_start"] == 13

    def test_dayun_direction_male_female_opposite(self):
        m = self.tool.build_chart(1988, 3, 15, 10, "M")["dayun"]["forward"]
        f = self.tool.build_chart(1988, 3, 15, 10, "F")["dayun"]["forward"]
        assert m != f  # 命宮天干陰陽下,男女方向相反

    def test_liunian_starts_from_tai_xing(self):
        chart = self.tool.build_chart(1988, 3, 15, 10, "M")
        tai = chart["stars"]["tai_xing"]
        ln = chart["liunian"]
        assert ln[0]["age"] == 1
        assert ln[0]["qin"] == tai  # 一歲=胎星
        # 二歲=胎星下一宿
        tai_idx = HOSTS.index(self.tool.qin_to_host[tai])
        assert ln[1]["qin"] == QIN_NAMES[(tai_idx + 1) % 28]

    def test_wuhu_palace_stem(self):
        # 五虎遁自檢:甲/己年寅宮=丙
        assert self.tool._palace_stem(1984, 2) == "丙"  # 1984甲子,寅(2)=丙
        assert self.tool._palace_stem(1984, 3) == "丁"  # 卯=丁
