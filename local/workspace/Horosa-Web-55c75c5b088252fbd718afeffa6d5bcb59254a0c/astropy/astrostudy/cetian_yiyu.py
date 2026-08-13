# -*- coding: utf-8 -*-
"""策天飛星·移語本算法層。

依《正命二十八宿移語》起例實現:雜曜安星、流年飛星(外盤)、神煞四表、會照系統、
太陽躔宿與三日宮、運限增強(限名/五行步位/童限/凶限/忌限)、十干變曜、斷訣命中引擎。

與 cetian_ziwei.py 鬆耦合:全部函數只吃原始參數(支序/月/日/時/年干支),不依賴 CetianChart;
由服務層(webcetiansrv)抽參調用組裝。地支索引 子0..亥11;天干索引 甲0..癸9。
"""

import math

import swisseph as swe

from astrostudy.cetian_yiyu_data import (
    YIYU_GONGZUO,
    YIYU_GUANSHA,
    YIYU_JINJING,
    YIYU_JIXIAN,
    YIYU_NIANGAN_SHENSHA,
    YIYU_RUYUAN_MONTH_TABLE,
    YIYU_SHENGONG_LUN,
    YIYU_SHIGAN_BIANYAO,
    YIYU_SHIQI_FEIXING,
    YIYU_SUIHOU_SHENSHA,
    YIYU_SUIQIAN_ALT_NOTE,
    YIYU_SUIQIAN_SHENSHA,
    YIYU_SUOLIN,
    YIYU_TAIYUAN_YI,
    YIYU_XIMO_BY_MONTH,
    YIYU_XINGGE,
    YIYU_XIONGXIAN_GE,
    YIYU_XIU_ECLIPTIC,
    YIYU_XIU_FENYE,
    YIYU_YIMA_BY_YEAR_BRANCH,
    YIYU_YUESHA,
    YIYU_BIANYAO_GONG,
    YIYU_BIANYAO_JIEYUE,
    YIYU_BIANYAO_NAMES,
    YIYU_BIANYAO_XIONG,
    YIYU_GUANXING_BIANYAO,
)

EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]

# 書法宮序(與 cetian_ziwei.PALACE_SEQUENCE_BOOK 同,此處複製常量避免循環依賴)
_PALACE_SEQ = ["命宮", "財帛宮", "兄弟宮", "田宅宮", "男女宮", "奴僕宮",
               "妻妾宮", "疾厄宮", "遷移宮", "官祿宮", "福德宮", "相貌宮"]


def _bn(idx):
    return EARTHLY_BRANCHES[idx % 12]


# ============================================================
# 雜曜安星(本命)
# ============================================================

def compute_zayao(year_branch, year_stem, lunar_month, lunar_day, hour_branch,
                  shen_gong_branch, tianluo_mode="benshu"):
    """雜曜安星,返回 {星名: 支索引} 與起法注 {星名: 注}。

    tianluo_mode: 'benshu' 本書月日法(天羅辰起正月順至生月再起初一順至生日,
      地網戌起逆同;三台/八座分別從天羅/地網起子時順/逆至生時;引證圖實證)
      | 'zhongtian' 中天太極月時法(天羅=辰順起正月至生月、月上順起子時至生時;地網逆同)。
    """
    m = lunar_month  # 1..12
    d = lunar_day    # 1..30
    h = hour_branch  # 0..11
    yb = year_branch
    zayao = {}

    # 龍池:辰起子時順數至生時;鳳閣:戌起子時順數至生時(原書「逆」旁注「順」,引證圖證順)。
    zayao["龍池"] = (4 + h) % 12
    zayao["鳳閣"] = (10 + h) % 12

    # 天羅/地網(雙法) + 三台/八座(從天羅/地網起)
    if tianluo_mode == "zhongtian":
        tianluo = (4 + (m - 1) + h) % 12
        diwang = (10 - (m - 1) - h) % 12
    else:
        tianluo = (4 + (m - 1) + (d - 1)) % 12
        diwang = (10 - (m - 1) - (d - 1)) % 12
    zayao["天羅"] = tianluo
    zayao["地網"] = diwang
    zayao["三台"] = (tianluo + h) % 12
    zayao["八座"] = (diwang - h) % 12

    # 台輔=身前一宮(順行次一位),三日住=身後一宮(「身前一宮為台輔,身後一宮三日住」)。
    zayao["台輔"] = (shen_gong_branch + 1) % 12
    zayao["三日住"] = (shen_gong_branch - 1) % 12

    # 天解:戌上起子逆數至生年支;天德:酉上起子順至生年支;月德:戌上起子順至生年支(又云巳上起子,存異)。
    zayao["天解"] = (10 - yb) % 12
    zayao["天德"] = (9 + yb) % 12
    zayao["月德"] = (10 + yb) % 12

    # 西沒星:按生月查表。
    zayao["西沒"] = YIYU_XIMO_BY_MONTH[m - 1]

    # 驛馬(年支三合)+退方(馬前一位)+攀鞍(馬後一位)。
    yima = YIYU_YIMA_BY_YEAR_BRANCH[yb]
    zayao["驛馬"] = yima
    zayao["退方"] = (yima + 1) % 12
    zayao["攀鞍"] = (yima - 1) % 12

    # 年干神煞(祿存/羊刃/飛刃/貴人等,按生年干)。
    for name, seq, _note in YIYU_NIANGAN_SHENSHA:
        zayao[name] = seq[year_stem]

    # 唐符=祿前第八位,國印=第九位(含祿位起數:祿為第一位)。
    lu = zayao["祿存"]
    zayao["唐符"] = (lu + 7) % 12
    zayao["國印"] = (lu + 8) % 12

    # 斗杓:以戌加生月建上,順數至生時(月建:正月建寅)。
    yuejian = (m + 1) % 12
    zayao["斗杓"] = (yuejian + ((h - 10) % 12)) % 12

    notes = {
        "龍池": "辰起子時順數至生時", "鳳閣": "戌起子時順數至生時(原書作逆,旁注順,引證圖證順)",
        "天羅": ("辰起正月順至生月,再起初一順至生日(本書法,引證圖實證)" if tianluo_mode != "zhongtian"
                 else "辰順起正月至生月,月上順起子時至生時(中天太極法)"),
        "地網": ("戌起正月逆至生月,再起初一逆至生日(本書法)" if tianluo_mode != "zhongtian"
                 else "戌逆起正月至生月,月上逆起子時至生時(中天太極法)"),
        "三台": "從天羅起子時順數至生時", "八座": "從地網起子時逆數至生時",
        "台輔": "身前一宮", "三日住": "身後一宮(凡三日有吉星,主出入近貴)",
        "天解": "戌上起子逆數至生年支", "天德": "酉上起子順至生年支",
        "月德": "戌上起子順至生年支(又云巳上起子,存兩說)",
        "西沒": "按生月查表,論人生月順行", "驛馬": "年支三合",
        "退方": "馬前一位,遇月將吉星猶可,加凶曜必有災悔", "攀鞍": "馬後一位,入命限主登科甲",
        "唐符": "祿前第八位", "國印": "祿前第九位", "斗杓": "戌加生月建上順數至生時",
    }
    for name, _seq, note in YIYU_NIANGAN_SHENSHA:
        notes[name] = note
    return zayao, notes


# ============================================================
# 流年飛星(外盤)
# ============================================================

def compute_liunian(liunian_year, birth_lunar_year, hour_branch, qisha_mode="shengshi"):
    """流年飛星外盤。

    qisha_mode: 'shengshi' 生時法(七煞星逐年飛例/飛星賦/外盤流年飛星起例,主流)
      | 'suishu' 歲數法(起外緣諸星例,一歲一宮,附四十四歲金標)。
    返回 {liunian_year, branch, stem, xu_sui, zhuxu(主序12星流年位), qisha, feiku, xiaoku,
          santai, bazuo, hongluan, tianxi, shiqi(十七飛星), qisha_mode}
    """
    ly = int(liunian_year)
    lyb = (ly - 4) % 12
    lys = (ly - 4) % 10
    age = ly - int(birth_lunar_year) + 1  # 虛歲
    h = hour_branch

    # 主序十二星流年位:流年太歲前一宮(流順前一宮)起庫,逆布貫文福祿紫虛貴印壽空紅。
    seq = ["天庫", "天貫", "文昌", "天福", "天祿", "紫微", "天虛", "天貴", "天印", "天壽", "天空", "紅鸞"]
    ku = (lyb + 1) % 12
    zhuxu = {name: (ku - i) % 12 for i, name in enumerate(seq)}

    # 七煞流年位。
    if qisha_mode == "suishu":
        zhang = (2 + age - 1) % 12
        hao = (5 + age - 1) % 12
        ren = (11 + age - 1) % 12
        xing = (9 - (age - 1)) % 12
        yao = (1 - (age - 1)) % 12
        yi = (zhang + 6) % 12
    else:
        s_ni = (h - lyb) % 12    # 逆數:從起宮起生時,逆行至太歲字
        s_shun = (lyb - h) % 12  # 順數
        zhang = (2 - s_ni) % 12
        yi = (8 - s_ni) % 12
        hao = (5 - s_ni) % 12
        ren = (11 - s_ni) % 12
        xing = (9 + s_shun) % 12
        yao = (1 + s_shun) % 12
    qisha = {"天杖": zhang, "天異": yi, "毛頭": hao, "天刃": ren, "天刑": xing, "天姚": yao}

    # 飛哭:從流年太歲起生時,順數至本年太歲字;小哭:流年太歲六合。
    feiku = (lyb + ((lyb - h) % 12)) % 12
    xiaoku = (13 - lyb) % 12

    # 三台:辰起子(年支)順數至流年支;八座:戌起子逆數至流年支。
    santai = (4 + lyb) % 12
    bazuo = (10 - lyb) % 12

    # 流年紅鸞天喜:卯頭起子逆流行,對照為天喜。
    hongluan = (3 - lyb) % 12
    tianxi = (hongluan + 6) % 12

    # 十七飛星:從太歲宮逆推,一宮一位。
    shiqi = [{"star": star, "branch": (lyb - i) % 12, "text": text}
             for i, (star, text) in enumerate(YIYU_SHIQI_FEIXING)]

    return {
        "liunian_year": ly, "branch": lyb, "stem": lys, "xu_sui": age,
        "zhuxu": zhuxu, "qisha": qisha, "feiku": feiku, "xiaoku": xiaoku,
        "santai": santai, "bazuo": bazuo, "hongluan": hongluan, "tianxi": tianxi,
        "shiqi": shiqi, "qisha_mode": qisha_mode,
    }


# ============================================================
# 神煞四表
# ============================================================

def compute_shensha(liunian_branch, liunian_stem, year_stem, lunar_month):
    """神煞四表命中:歲前(流年支)/歲後(流年支)/年干(本命生年干+流年干雙標)/月煞(生月)。"""
    suiqian = [{"name": name, "branch": (liunian_branch + off) % 12, "text": text}
               for name, off, text in YIYU_SUIQIAN_SHENSHA]
    suihou = [{"name": name, "branch": seq[liunian_branch], "note": note}
              for name, seq, note in YIYU_SUIHOU_SHENSHA]
    ng_benming = [{"name": name, "branch": seq[year_stem], "note": note}
                  for name, seq, note in YIYU_NIANGAN_SHENSHA]
    ng_liunian = [{"name": name, "branch": seq[liunian_stem], "note": note}
                  for name, seq, note in YIYU_NIANGAN_SHENSHA]
    yuesha = [{"name": name, "branch": seq[lunar_month - 1], "text": text}
              for name, seq, text in YIYU_YUESHA]
    return {
        "suiqian": suiqian, "suiqian_note": YIYU_SUIQIAN_ALT_NOTE,
        "suihou": suihou, "niangan_benming": ng_benming, "niangan_liunian": ng_liunian,
        "yuesha": yuesha,
    }


# ============================================================
# 會照系統(四正/三合/對照/夾照)
# ============================================================

def compute_huizhao(ming_gong_branch, shen_gong_branch):
    """會照關係:四正(命+3/6/9)/三合(命+4/8,即夾照)/對照(命+6)。福分等級按書文。"""
    m = ming_gong_branch
    sizheng = sorted({m, (m + 3) % 12, (m + 6) % 12, (m + 9) % 12})
    sanhe = sorted({m, (m + 4) % 12, (m + 8) % 12})
    duizhao = (m + 6) % 12
    per_palace = {}
    for b in range(12):
        rel = []
        if b == m:
            rel.append("命宮本位")
        if b == duizhao:
            rel.append("對照命宮(三分福)")
        if b in sanhe and b != m:
            rel.append("三合夾照命宮(七分福)")
        if b in sizheng and b != m and b != duizhao:
            rel.append("四正拱照命宮")
        if b == shen_gong_branch:
            rel.append("身宮所在")
        per_palace[b] = rel
    return {
        "sizheng": sizheng, "sanhe": sanhe, "duizhao": duizhao, "per_palace": per_palace,
        "note": ("四正宮中最要強,善星相照喜非常。三合十分福,對照七分福,三合半福。"
                 "凶星照臨:入廟十分福,入旺七分福,入樂半福。"
                 "拱照星雖惡而本宮見吉星正坐亦可為福;夾照星雖善而本宮見惡曜暗臨亦以凶論。"),
    }


# ============================================================
# 太陽躔宿與三日宮
# ============================================================

def _xiu_of_lon(sun_lon):
    """黃經→廿八宿(現代距星黃經界)。"""
    lon = sun_lon % 360.0
    entries = sorted(YIYU_XIU_ECLIPTIC, key=lambda kv: kv[1])
    prev_name = entries[-1][0]  # 最後一宿跨 0°
    for name, start in entries:
        if lon < start:
            return prev_name
        prev_name = name
    return entries[-1][0]


def compute_xiu(jd, ming_gong_branch, shen_gong_branch):
    """太陽躔宿(現代距星黃經界)+命身分野+三日宮(命±2 宮)與前後三日宿(太陽±3日行程)。"""
    sun_lon = swe.calc_ut(jd, swe.SUN)[0][0] % 360.0
    cur = _xiu_of_lon(sun_lon)
    fore = _xiu_of_lon(sun_lon + 3.0)   # 前三日:太陽順行約 3°
    back = _xiu_of_lon(sun_lon - 3.0)
    m = ming_gong_branch
    return {
        "sun_lon": round(sun_lon, 4), "sun_xiu": cur,
        "qian_sanri_gong": (m + 2) % 12, "hou_sanri_gong": (m - 2) % 12,
        "qian_sanri_xiu": fore, "hou_sanri_xiu": back,
        "ming_fenye": YIYU_XIU_FENYE[m], "shen_fenye": YIYU_XIU_FENYE[shen_gong_branch],
        "note": ("三日宮:如命立午宮,順數至申為前三日,逆數至辰為後三日;前管前四十五年吉凶,"
                 "後管後四十五年。推三日宮必先推太陽躔在何宿度,而後推宮分前後三日之宮度。"
                 "見刑杖主官非重重,見虛哭主孝服疊疊,見耗刃主性情凶暴,見姚異主淫亂下賤。"
                 "躔宿按現代距星黃經界實算;原書分野宿度為古赤道舊制,收入分野資料。"),
    }


# ============================================================
# 運限增強(限名/五行步位/童限/凶限/忌限)
# ============================================================

_WUXING_SHUN = ["", "水", "木", "金", "土", "火"]   # 順行:一命(本位)二水三木四金五土六火,七起循環
_WUXING_NI = ["", "火", "土", "金", "木", "水"]     # 逆行:一身(本位)二火三土四金五木六水


def _buwei(order, is_shun):
    """第 order+1 限的五行步位(order=0 為首限,無五行,主本位)。"""
    if order == 0:
        return "本位"
    tbl = _WUXING_SHUN if is_shun else _WUXING_NI
    return tbl[(order - 1) % 5 + 1]


def compute_yunxian(palaces, ming_gong_branch, shen_gong_branch, year_branch,
                    is_shun, start_branch):
    """運限總成。palaces: [{branch, name, stars, aux_stars, da_xian_start}](書法序)。

    輸出:daxian 12 限(區間/宮/限名=宮中首正曜/五行步位/忌限標)、童限 15 歲表、
    凶限歌命中(按命宮支)、忌限提示(生年支)。
    """
    by_branch = {p["branch"]: p for p in palaces}
    jixian_branches = set(YIYU_JIXIAN.get(year_branch, []))

    daxian = []
    for p in sorted(palaces, key=lambda x: x.get("da_xian_start", 0)):
        start_age = p.get("da_xian_start", 0)
        order = (start_age - 1) // 10
        stars = list(p.get("stars") or [])
        aux = list(p.get("aux_stars") or [])
        lead = stars[0] if stars else (aux[0] if aux else "")
        xian_name = f"{lead[-1]}限" if lead else "空限"   # 取星名尾字:天祿→祿限,紫微→微限例外取「紫」
        if lead == "紫微":
            xian_name = "紫限"
        elif lead == "文昌":
            xian_name = "文限"
        elif lead == "毛頭":
            xian_name = "耗限"
        daxian.append({
            "range": f"{start_age}~{start_age + 9}",
            "start": start_age,
            "branch": p["branch"], "branch_name": _bn(p["branch"]),
            "palace": p.get("name", ""),
            "xian_name": xian_name,
            "buwei": _buwei(order, is_shun),
            "stars": stars, "aux_stars": aux,
            "ji": p["branch"] in jixian_branches,
        })

    # 童限:1命2財3疾4妻5福;6歲起從官祿按宮序順推循環至15。
    tong_seq_names = ["命宮", "財帛宮", "疾厄宮", "妻妾宮", "福德宮"]
    palace_by_name = {p.get("name"): p for p in palaces}
    tongxian = []
    for age in range(1, 6):
        pname = tong_seq_names[age - 1]
        pp = palace_by_name.get(pname)
        tongxian.append({"age": age, "palace": pname,
                         "branch": pp["branch"] if pp else None,
                         "branch_name": _bn(pp["branch"]) if pp else ""})
    guanlu_idx = _PALACE_SEQ.index("官祿宮")
    for age in range(6, 16):
        pname = _PALACE_SEQ[(guanlu_idx + (age - 6)) % 12]
        pp = palace_by_name.get(pname)
        tongxian.append({"age": age, "palace": pname,
                         "branch": pp["branch"] if pp else None,
                         "branch_name": _bn(pp["branch"]) if pp else ""})

    # 凶限歌(按命宮支):條件星坐命/對照/三合會命則「應」,否則「參考」。
    ming_stars = set((by_branch.get(ming_gong_branch) or {}).get("stars") or []) | \
        set((by_branch.get(ming_gong_branch) or {}).get("aux_stars") or [])
    zhao_branches = [(ming_gong_branch + 6) % 12, (ming_gong_branch + 4) % 12, (ming_gong_branch + 8) % 12]
    zhao_stars = set()
    for zb in zhao_branches:
        pz = by_branch.get(zb) or {}
        zhao_stars |= set(pz.get("stars") or []) | set(pz.get("aux_stars") or [])
    xiongxian = []
    for star_group, ages, text in YIYU_XIONGXIAN_GE.get(ming_gong_branch, []):
        grp = set(star_group)
        if grp and grp.issubset(ming_stars):
            hit = "坐命"
        elif grp and grp.issubset(ming_stars | zhao_stars):
            hit = "會照命宮"
        else:
            hit = "條件星未會命(參考)"
        xiongxian.append({"stars": star_group, "ages": ages, "text": text, "hit": hit})

    jixian = [{"branch": b, "branch_name": _bn(b)} for b in sorted(jixian_branches)]
    return {"daxian": daxian, "tongxian": tongxian, "xiongxian": xiongxian,
            "jixian": jixian,
            "buwei_note": ("五行步位:順行一命二水三木四金五土六火,逆行一身二火三土四金五木六水,"
                           "七限起循環;要究一世榮枯,須看五行步位(照膽經)。"),
            "shun": bool(is_shun), "start_branch": start_branch}


# ============================================================
# 十干變曜
# ============================================================

def compute_bianyao(year_stem, liunian_stem):
    """十干變曜(本生年干+流年干)與十三官星變曜(本生年干)。"""
    benming = [{"bianyao": n, "gong": YIYU_BIANYAO_GONG[n],
                "yao": YIYU_SHIGAN_BIANYAO[n][year_stem],
                "xiong": n in YIYU_BIANYAO_XIONG}
               for n in YIYU_BIANYAO_NAMES]
    liunian = [{"bianyao": n, "gong": YIYU_BIANYAO_GONG[n],
                "yao": YIYU_SHIGAN_BIANYAO[n][liunian_stem],
                "xiong": n in YIYU_BIANYAO_XIONG}
               for n in YIYU_BIANYAO_NAMES]
    guanxing = [{"name": name, "yao": seq[year_stem], "note": note}
                for name, seq, note in YIYU_GUANXING_BIANYAO]
    return {"benming": benming, "liunian": liunian, "guanxing": guanxing,
            "jieyue": YIYU_BIANYAO_JIEYUE}


# ============================================================
# 斷訣命中引擎
# ============================================================

def _palace_star_sets(palaces, zayao=None):
    """每支的星集合(正曜+副曜+雜曜),返回 {branch: set}。"""
    sets = {b: set() for b in range(12)}
    for p in palaces:
        b = p["branch"]
        sets[b] |= set(p.get("stars") or []) | set(p.get("aux_stars") or [])
    for name, b in (zayao or {}).items():
        sets[b].add(name)
    return sets


def match_duanjue(palaces, ming_gong_branch, shen_gong_branch, zayao=None):
    """斷訣命中:掃描判定庫,輸出 [{group, title, text, source}](按組)。

    palaces: [{branch, name, stars, aux_stars}](書法宮序,index 0=命宮)。
    """
    star_sets = _palace_star_sets(palaces, zayao)
    by_name = {p.get("name"): p for p in palaces}
    ming_set = star_sets[ming_gong_branch]
    shen_set = star_sets[shen_gong_branch]
    hits = []

    def _emit(group, title, text, source):
        hits.append({"group": group, "title": title, "text": text, "source": source})

    # 1) 太元賦宜宮判定:主序星落宜宮則吉。
    for star, (yi_branches, text) in YIYU_TAIYUAN_YI.items():
        if star == "三台八座":
            continue
        for p in palaces:
            allset = star_sets[p["branch"]]
            if star in allset and p["branch"] in yi_branches:
                _emit("太元賦", f"{star}·{_bn(p['branch'])}宮得宜", text, "太元賦")
                break

    # 2) 所臨星論(一/二):按 scope 匹配。
    for scope, group_stars, text, source in YIYU_SUOLIN:
        grp = set(group_stars)
        if scope == "mingshen":
            ok = grp.issubset(ming_set) or grp.issubset(shen_set)
            where = "身命宮"
        elif scope == "ming":
            ok = grp.issubset(ming_set)
            where = "命宮"
        elif scope == "shen":
            ok = grp.issubset(shen_set)
            where = "身宮"
        else:
            pal = by_name.get(scope + "宮") or by_name.get(scope)
            ok = bool(pal) and grp.issubset(star_sets[pal["branch"]])
            where = scope
        if ok and grp:
            _emit("所臨星論", f"{where}·{'/'.join(group_stars)}", text, source)

    # 3) 宮坐星斷:支==命支或身支,且星組坐該支(空星組=身命在該支即中)。
    for branch, group_stars, text in YIYU_GONGZUO:
        for label, target in (("命", ming_gong_branch), ("身", shen_gong_branch)):
            if branch != target:
                continue
            grp = set(group_stars)
            if grp.issubset(star_sets[branch]):
                title = f"{label}在{_bn(branch)}" + (f"·{'/'.join(group_stars)}" if group_stars else "")
                _emit("宮坐星斷", title, text, "十二宮坐星斷")
                break

    # 4) 金鏡圖:星組坐該支即中;命身所在加標。
    for group_stars, branch, text in YIYU_JINJING:
        grp = set(group_stars)
        if grp.issubset(star_sets[branch]):
            mark = ""
            if branch == ming_gong_branch:
                mark = "(命宮)"
            elif branch == shen_gong_branch:
                mark = "(身宮)"
            _emit("金鏡圖", f"{'/'.join(group_stars)}·{_bn(branch)}{mark}", text, "照膽經金鏡圖")

    # 5) 諸星格:每星按落支出十二宮斷;組合斷在星所落宮內判。
    for star, ge in YIYU_XINGGE.items():
        star_branch = None
        for b in range(12):
            if star in star_sets[b]:
                star_branch = b
                break
        if star_branch is None:
            continue
        duan = ge.get("by_branch", {}).get(star_branch)
        if duan:
            _emit("諸星格", f"{star}·{_bn(star_branch)}宮", duan, f"諸星格·{star}格")
        for combo_stars, combo_text in ge.get("combos", []):
            if set(combo_stars).issubset(star_sets[star_branch]):
                _emit("諸星格·會合", f"{star}會{'/'.join(combo_stars)}·{_bn(star_branch)}宮",
                      combo_text, f"諸星格·{star}格")

    # 6) 小兒關煞:星組⊆命宮或身宮。
    for group_stars, guan_name, text in YIYU_GUANSHA:
        grp = set(group_stars)
        if grp.issubset(ming_set) or grp.issubset(shen_set):
            title = guan_name or "/".join(group_stars)
            _emit("關煞", title, text, "小兒關煞並生死論")

    # 7) 身宮吉凶論:身宮所入宮名。
    shen_palace = next((p for p in palaces if p["branch"] == shen_gong_branch), None)
    if shen_palace:
        lun = YIYU_SHENGONG_LUN.get(shen_palace.get("name", ""))
        if lun:
            _emit("身宮吉凶論", f"身入{shen_palace.get('name')}", lun, "身宮吉凶論")

    return hits


# ============================================================
# 入垣圖月表(資料透傳)
# ============================================================

def ruyuan_month_row(lunar_month):
    """入垣圖·龍池鳳閣月表本生月行。"""
    row = YIYU_RUYUAN_MONTH_TABLE[lunar_month - 1]
    return {"month_label": row[0], "branch": row[1], "stars": row[2]}


__all__ = [
    "compute_zayao", "compute_liunian", "compute_shensha", "compute_huizhao",
    "compute_xiu", "compute_yunxian", "compute_bianyao", "match_duanjue",
    "ruyuan_month_row",
]
