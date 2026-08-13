# -*- coding: utf-8 -*-
"""
策天十八飛星 golden — 鎖定按《十八飛星策天紫微斗數》(卷一/卷三)重寫後的起盤·安星·五行·亮度。
依據(PDF 頁碼):
- 命宮 p15「安命例」: 從天杖宮起生時順數至卯 = (天杖+3-時支)%12;天杖=(1-月)%12。
- 身宮 p15-16「安身例」: 從天杖宮逆數,2.5日/宮,至生日 = (天杖-⌊(生日-1)/2.5⌋)%12。
- 起紫微 p11/13/14: 未上起子順數至生年 = (7+年支)%12;其後逆布 紫虛貴印壽空鸞庫貫文福祿。
- 副曜 p13/14/15: 天杖子起正月逆數;異/旄/刃由杖逆布;天刑酉起正月順、天姚丑起正月順;天哭取生年支六合。
- 五行 p47「十八星所屬」訣: 哭刃鸞金 / 火是刑 / 紫文杖祿木 / 毛姚虛水 / 印壽庫貫貴福異土(紅鸞=金)。
- 亮度 p112「諸星入廟樂旺詩訣」。
- 宮序 p13: 命/財帛/兄弟/田宅/男女/奴僕/妻妾/疾厄/遷移/官祿/福德/相貌,逆轉。
本書無五行局/宮干/四化/飛化/節氣感傷詩(均係臆造,已刪)。引擎已從 vendor/kinastro 摘出至 astrostudy。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.cetian_ziwei import (  # noqa: E402
    compute_cetian_ziwei_chart,
    _place_cetian_main_stars,
    _place_cetian_aux_stars,
    CETIAN_STAR_ATTRIBUTES,
    CETIAN_BRIGHTNESS_TABLE,
    PALACE_SEQUENCE,
)

B = "子丑寅卯辰巳午未申酉戌亥"


def test_qipan_per_book_2006():
    # 公曆 2006-10-04 09:58(男):農曆八月十三(2006閏七月,sxtwl 正確);時柱巳。
    # 天杖=(1-8)%12=5(巳);命=(5+3-5)%12=3(卯);紫微=(7+戌10)%12=5(巳)。
    # 身宮雙口徑(兩讀共守「從杖星處起初一」=初一偏移 0,分歧只在 2.5 日邊界歸屬):
    #   yizheng 進一法=(5-⌈12/2.5⌉)%12=(5-5)%12=0(子);literal 捨去法=(5-⌊12/2.5⌋)%12=1(丑)。
    c = compute_cetian_ziwei_chart(2006, 10, 4, 9, 58, 8.0, 30.83, 119.42, 'x', '男')
    assert (c.lunar_year, c.lunar_month, c.lunar_day, c.is_leap_month) == (2006, 8, 13, False)
    assert B[c.ming_gong_branch] == '卯'
    assert B[c.shen_gong_branch] == '子'
    assert B[c.ziwei_branch] == '巳'
    assert c.wu_xing_ju == 0  # 本書無五行局
    assert c.sihua == {} and c.star_flight == {} and c.active_patterns == []  # 臆造已刪
    assert c.solar_term_influence == '寒露'  # 僅節氣名,無感傷詩
    c_lit = compute_cetian_ziwei_chart(
        2006, 10, 4, 9, 58, 8.0, 30.83, 119.42, 'x', '男', shen_gong_mode='literal')
    assert B[c_lit.shen_gong_branch] == '丑'  # 舊口徑鎖存(安身例 p15-16 直讀)


def test_palace_sequence_per_book():
    assert PALACE_SEQUENCE == [
        "命宮", "財帛宮", "兄弟宮", "田宅宮", "男女宮", "奴僕宮",
        "妻妾宮", "疾厄宮", "遷移宮", "官祿宮", "福德宮", "相貌宮",
    ]


def test_main_stars_reverse_per_book():
    # 紫微安未(7),逆布 紫虛貴印壽空鸞庫貫文福祿(p11 實例)
    m = _place_cetian_main_stars(7)
    expect = {
        7: '紫微', 6: '天虛', 5: '天貴', 4: '天印', 3: '天壽', 2: '天空',
        1: '紅鸞', 0: '天庫', 11: '天貫', 10: '文昌', 9: '天福', 8: '天祿',
    }
    for idx, name in expect.items():
        assert m[idx] == [name], (idx, name, m[idx])


def test_aux_stars_per_book():
    # 子年、正月、子時:杖子/異亥/旄戌/刃酉;刑酉;姚丑;哭丑(子之六合)
    a = _place_cetian_aux_stars(0, 1, 0)
    assert a[0] == ['天杖']
    assert a[11] == ['天異']
    assert a[10] == ['毛頭']
    assert '天刃' in a[9] and '天刑' in a[9]
    assert '天姚' in a[1] and '天哭' in a[1]


def test_wuxing_per_book_p47():
    w = {k: v[0] for k, v in CETIAN_STAR_ATTRIBUTES.items()}
    # 金:天哭/天刃/紅鸞(紅鸞 p47「鸞金」/p51「紅鸞屬金」,從金非 p13 之陰水)
    for s in ('天哭', '天刃', '紅鸞'):
        assert w[s] == '金', (s, w[s])
    assert w['天刑'] == '火'
    for s in ('紫微', '文昌', '天杖', '天祿'):
        assert w[s] == '木', (s, w[s])
    for s in ('毛頭', '天姚', '天虛'):
        assert w[s] == '水', (s, w[s])
    for s in ('天貴', '天福', '天印', '天壽', '天庫', '天貫', '天異'):
        assert w[s] == '土', (s, w[s])


def test_brightness_per_book_p112():
    bt = CETIAN_BRIGHTNESS_TABLE
    # 紫微:巳廟·酉廟·子旺·申樂·亥樂
    assert bt['紫微'].get(5) == '廟' and bt['紫微'].get(9) == '廟'
    assert bt['紫微'].get(0) == '旺'
    assert bt['紫微'].get(8) == '樂' and bt['紫微'].get(11) == '樂'
    # 天空書「居無地」,不寫亮度
    assert bt['天空'] == {}
    # 毛頭:子廟·卯廟;天異:辰樂;天哭:丑/午/申廟·卯旺
    assert bt['毛頭'].get(0) == '廟' and bt['毛頭'].get(3) == '廟'
    assert bt['天異'].get(4) == '樂'
    assert bt['天哭'].get(3) == '旺'
