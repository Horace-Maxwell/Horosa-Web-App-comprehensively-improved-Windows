"""
astro/sanshi/fendjing.py — 鬼谷分定經排盤模組 (Ghost Valley Fen Ding Jing / Two-End Pincers)

鬼谷分定經，又名兩頭鉗，相傳為戰國時期鬼谷子所創。
以出生年時天干排盤，配合十二宮與星曜，推斷一生命運。

此模組基於 liangtouqian 庫實作，提供 compute / render 介面。
"""

from __future__ import annotations

import pickle
import streamlit as st

from astro.i18n import t, auto_cn

# ============================================================
# 常量
# ============================================================

TIANGAN = list("甲乙丙丁戊己庚辛壬癸")
DIZHI = list("子丑寅卯辰巳午未申酉戌亥")

# horosa_kin_jiazi_const_v1(PERF-R10 B2):两处嵌套 def jiazi() 每次调用重建六十甲子 →
# 提升为模块常量;_jiazi_seq() 的返回只进 new_list(index+切片拼接,产新列表,零变异),
# 共享常量安全。kill:HOROSA_KIN_JIAZI_CONST=0 ⇒ 逐次重建旧路径。
import os as _os
_KIN_CONST_ON = _os.environ.get('HOROSA_KIN_JIAZI_CONST', '1').lower() not in ('0', 'false', 'no', 'off')
_JIAZI_SEQ_CONST = [TIANGAN[x % len(TIANGAN)] + DIZHI[x % len(DIZHI)] for x in range(60)]

def _jiazi_seq():
    if _KIN_CONST_ON:
        return _JIAZI_SEQ_CONST
    return [TIANGAN[x % len(TIANGAN)] + DIZHI[x % len(DIZHI)] for x in range(60)]

# 十二宮名稱
TWELVE_PALACES: list[str] = [
    "命宮", "兄弟", "夫妻", "子女",
    "財帛", "疾厄", "遷移", "奴僕",
    "官祿", "田宅", "福德", "相貌",
]

# 載入 twogan.pickle 數據
@st.cache_data(ttl=3600, show_spinner=False)
def load_twogan_data() -> dict:
    """載入兩頭鉗數據庫"""
    import os
    data_path = os.path.join(os.path.dirname(__file__), "data", "twogan.pickle")
    with open(data_path, 'rb') as f:
        return pickle.load(f)


def _get_gangzhi(year: int, month: int, day: int, hour: int, minute: int) -> list[str]:
    """取得年月日時干支"""
    import sxtwl
    from astro.sanshi.liuren import _get_gangzhi as base_gz
    
    gz = base_gz(year, month, day, hour)
    return [gz["day_gz"], gz["hour_gz"]]


def _find_lunar_month(year_gz: str) -> dict[int, str]:
    """根據年干查找正月月干"""
    fivetigers = {
        tuple(list("甲己")): "丙寅",
        tuple(list("乙庚")): "戊寅",
        tuple(list("丙辛")): "庚寅",
        tuple(list("丁壬")): "壬寅",
        tuple(list("戊癸")): "甲寅"
    }
    
    year_tian = year_gz[0]
    result = None
    for keys, value in fivetigers.items():
        if year_tian in keys:
            result = value
            break
    
    if result is None:
        result = "丙寅"
    
    # 生成 12 個月的干支(horosa_kin_jiazi_const_v1:嵌套重建 → 模块常量,new_list 产新列表零变异)
    def new_list(olist, o):
        a = olist.index(o)
        return olist[a:] + olist[:a]

    month_list = new_list(_jiazi_seq(), result)[:12]
    return dict(zip(range(1, 13), month_list))


def _find_lunar_hour(day_gz: str) -> dict[str, str]:
    """根據日干查找時辰干支"""
    fiverats = {
        tuple(list("甲己")): "甲子",
        tuple(list("乙庚")): "丙子",
        tuple(list("丙辛")): "戊子",
        tuple(list("丁壬")): "庚子",
        tuple(list("戊癸")): "壬子"
    }
    
    day_tian = day_gz[0]
    result = None
    for keys, value in fiverats.items():
        if day_tian in keys:
            result = value
            break
    
    if result is None:
        result = "甲子"
    
    def new_list(olist, o):
        a = olist.index(o)
        return olist[a:] + olist[:a]

    hour_list = new_list(_jiazi_seq(), result)[:12]
    return dict(zip(DIZHI, hour_list))


@st.cache_data(ttl=3600, show_spinner=False)
def compute_fendjing_chart(
    year: int, month: int, day: int,
    hour: int, minute: int,
    timezone: float = 8.0,
    after23_new_day: int = 1,
    **kwargs,
) -> dict:
    """計算鬼谷分定經排盤。

    Parameters
    ----------
    year, month, day, hour, minute : int
        公曆出生日期和時間
    timezone : float
        時區（預設 +8）

    Returns
    -------
    dict
        包含兩頭鉗判斷、命格、基業、兄弟、行藏、婚姻、子息、收成等完整排盤資訊。
    """
    import sxtwl
    from datetime import date as _date, timedelta as _timedelta

    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内 sxtwl 原路径零变)
        from kin_year_domain import extreme_pillars
        year_gz, month_gz, day_gz, hour_gz = extreme_pillars(
            year, month, day, hour, minute or 0,
            after23=(1 if after23_new_day else 0), hour_gan_next=1)[:4]
        return _assemble_fendjing_result(year_gz, month_gz, day_gz, hour_gz)

    # 用戶語義（拍板,字面直覺版）：
    #   after23_new_day=1「23点算第二天」= 23時起日柱進位次日(壬寅)
    #   after23_new_day=0「24点算第二天」= 23時仍守今、24時才換日柱(辛丑)
    _cy, _cm, _cd = year, month, day
    if after23_new_day and hour == 23:
        _nd = _date(year, month, day) + _timedelta(days=1)
        _cy, _cm, _cd = _nd.year, _nd.month, _nd.day
    d = sxtwl.fromSolar(_cy, _cm, _cd)
    gz_day = d.getDayGZ()
    day_gz = TIANGAN[gz_day.tg] + DIZHI[gz_day.dz]

    # 時干支：hour==23 時，子時跨日永遠按"次日日干"起（與 lunar.js Exact 一致）。
    _ty, _tm, _td = year, month, day
    if hour == 23:
        _td_dt = _date(year, month, day) + _timedelta(days=1)
        _ty, _tm, _td = _td_dt.year, _td_dt.month, _td_dt.day
    _d_for_hour = sxtwl.fromSolar(_ty, _tm, _td)
    _gz_for_hour = _d_for_hour.getDayGZ()
    hour_zhi_idx = ((hour + 1) // 2) % 12
    hour_tg = (_gz_for_hour.tg * 2 + hour_zhi_idx) % 10
    hour_gz = TIANGAN[hour_tg] + DIZHI[hour_zhi_idx]
    
    # 年干支
    year_gz = TIANGAN[d.getYearGZ().tg] + DIZHI[d.getYearGZ().dz]
    
    # 月干支
    lunar_month = d.getLunarMonth()
    month_gz = _find_lunar_month(year_gz).get(lunar_month, "丙寅")
    
    # 兩頭鉗 key：年干 + 時干
    return _assemble_fendjing_result(year_gz, month_gz, day_gz, hour_gz)


def _assemble_fendjing_result(year_gz, month_gz, day_gz, hour_gz):
    """四柱→兩頭鉗排盤結果組裝(域內/全年份域回退共用,行為零變)。"""
    two_gan_key = year_gz[0] + hour_gz[0]

    # 載入數據
    twogan_data = load_twogan_data()
    two_gan_text = twogan_data.get(two_gan_key, {})

    result = {
        "year_gz": year_gz,
        "month_gz": month_gz,
        "day_gz": day_gz,
        "hour_gz": hour_gz,
        "two_gan_key": two_gan_key,
        "判斷": two_gan_text.get("判斷", ""),
        "命格": two_gan_text.get("命格", []),
        "基業": two_gan_text.get("基業", ""),
        "兄弟": two_gan_text.get("兄弟", ""),
        "行藏": two_gan_text.get("行藏", ""),
        "婚姻": two_gan_text.get("婚姻", ""),
        "子息": two_gan_text.get("子息", ""),
        "收成": two_gan_text.get("收成", ""),
    }

    return result


def _build_fendjing_board_html(chart: dict) -> str:
    """產生鬼谷分定經排盤 HTML"""
    
    year_gz = chart.get("year_gz", "")
    month_gz = chart.get("month_gz", "")
    day_gz = chart.get("day_gz", "")
    hour_gz = chart.get("hour_gz", "")
    two_gan_key = chart.get("two_gan_key", "")
    
    # 四柱顯示
    ganzhi_html = f"""
    <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;margin:0 8px;padding:8px 12px;background:rgba(30,30,45,0.6);border-radius:8px;">
            <div style="font-size:12px;color:#9E9E9E;">{auto_cn('年柱')}</div>
            <div style="font-size:18px;font-weight:bold;color:#E8E8F0;">{year_gz}</div>
        </div>
        <div style="display:inline-block;margin:0 8px;padding:8px 12px;background:rgba(30,30,45,0.6);border-radius:8px;">
            <div style="font-size:12px;color:#9E9E9E;">{auto_cn('月柱')}</div>
            <div style="font-size:18px;font-weight:bold;color:#E8E8F0;">{month_gz}</div>
        </div>
        <div style="display:inline-block;margin:0 8px;padding:8px 12px;background:rgba(30,30,45,0.6);border-radius:8px;">
            <div style="font-size:12px;color:#9E9E9E;">{auto_cn('日柱')}</div>
            <div style="font-size:18px;font-weight:bold;color:#E8E8F0;">{day_gz}</div>
        </div>
        <div style="display:inline-block;margin:0 8px;padding:8px 12px;background:rgba(30,30,45,0.6);border-radius:8px;">
            <div style="font-size:12px;color:#9E9E9E;">{auto_cn('時柱')}</div>
            <div style="font-size:18px;font-weight:bold;color:#E8E8F0;">{hour_gz}</div>
        </div>
    </div>
    """
    
    # 兩頭鉗顯示
    liangtou_html = f"""
    <div style="text-align:center;margin:16px 0;padding:16px;background:rgba(40,40,60,0.5);border-radius:12px;border:1px solid rgba(120,120,140,0.3);">
        <div style="font-size:14px;color:#9E9E9E;letter-spacing:2px;margin-bottom:8px;">{auto_cn('兩頭鉗')}</div>
        <div style="font-size:24px;font-weight:bold;color:#FFD700;">{two_gan_key}</div>
    </div>
    """
    
    return ganzhi_html + liangtou_html


def render_fendjing_chart(chart: dict, after_chart_hook=None):
    """在 Streamlit 中渲染鬼谷分定經排盤結果"""
    import streamlit.components.v1 as components
    
    st.markdown(f"### 🔮 {auto_cn('鬼谷分定經排盤')}")
    
    # 排盤式
    st.markdown(f"#### {auto_cn('排盤')}")
    board_html = _build_fendjing_board_html(chart)
    components.html(
        f'''
        <div style="background:#1E1E2E;padding:16px;border-radius:12px;
                    overflow-x:auto;overflow-y:visible;min-height:200px;
                    -webkit-overflow-scrolling:touch;">
            <div style="min-width:400px;width:max-content;">
                {board_html}
            </div>
        </div>
        ''',
        height=240,
        scrolling=False,
    )
    
    st.divider()
    
    # 判斷
    judgment = chart.get("判斷", "")
    if judgment:
        st.markdown(f"#### {auto_cn('判斷')}")
        st.info(judgment)
        st.divider()
    
    # 命格
    mingge = chart.get("命格", [])
    if mingge:
        st.markdown(f"#### {auto_cn('命格')}")
        for item in mingge:
            st.markdown(f"- {item}")
        st.divider()
    
    # 詳細內容（使用 expander）
    st.markdown(f"#### {auto_cn('詳細解讀')}")
    
    sections = [
        ("基業", chart.get("基業", "")),
        ("兄弟", chart.get("兄弟", "")),
        ("行藏", chart.get("行藏", "")),
        ("婚姻", chart.get("婚姻", "")),
        ("子息", chart.get("子息", "")),
        ("收成", chart.get("收成", "")),
    ]
    
    for title, content in sections:
        if content:
            with st.expander(auto_cn(title), expanded=False):
                st.markdown(content.replace("\n", "\n\n"))
    
    if after_chart_hook:
        after_chart_hook()
