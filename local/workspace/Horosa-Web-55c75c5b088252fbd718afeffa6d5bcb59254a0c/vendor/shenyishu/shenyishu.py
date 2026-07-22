# -*- coding: utf-8 -*-
"""
神易數 - 兵佔系統
講武全書兵佔卷之十六 明州玄谷蔡時宜撰

@author: kentang
"""

import sxtwl, re, json, argparse
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

Gan, Zhi = list("甲乙丙丁戊己庚辛壬癸"), list("子丑寅卯辰巳午未申酉戌亥")
Bagua = ["坤", "震", "坎", "兑", "艮", "離", "巽", "乾"]

JIAZI_CODE_TABLE = {
    "甲子": 84, "乙丑": 162, "丙寅": 10, "丁卯": 42, "戊辰": 54, "己巳": 70,
    "庚午": 72, "辛未": 182, "壬申": 221, "癸酉": 170, "甲戌": 117, "乙亥": 289,
    "丙子": 28, "丁丑": 54, "戊寅": 72, "己卯": 81, "庚辰": 66, "辛巳": 54,
    "壬午": 91, "癸未": 136, "甲申": 221, "乙酉": 170, "丙戌": 100, "丁亥": 187,
    "戊子": 24, "己丑": 35, "庚寅": 108, "辛卯": 99, "壬辰": 195, "癸巳": 84,
    "甲午": 91, "乙未": 136, "丙申": 117, "丁酉": 36, "戊戌": 204, "己亥": 169,
    "庚子": 48, "辛丑": 70, "壬寅": 130, "癸卯": 221, "甲辰": 195, "乙巳": 84,
    "丙午": 50, "丁未": 180, "戊申": 187, "己酉": 60, "庚戌": 238, "辛亥": 135,
    "壬子": 84, "癸丑": 162, "甲寅": 130, "乙卯": 221, "丙辰": 63, "丁巳": 48,
    "戊午": 56, "己未": 156, "庚申": 78, "辛酉": 80, "壬戌": 117, "癸亥": 289
}

# horosa_kin_jiazi_const_v1(PERF-R10 B2):编译期常量提升,copy-return 等价。
import os as _os
_KIN_CONST_ON = _os.environ.get('HOROSA_KIN_JIAZI_CONST', '1').lower() not in ('0', 'false', 'no', 'off')
_JIAZI_CONST = [f"{Gan[i % 10]}{Zhi[i % 12]}" for i in range(60)]

def jiazi():
    if not _KIN_CONST_ON:
        return [f"{Gan[i % 10]}{Zhi[i % 12]}" for i in range(60)]
    return list(_JIAZI_CONST)

def get_jiazi_code(jz):
    return JIAZI_CODE_TABLE.get(jz, 0)

def num_to_gua(num):
    gua_map = {1: "艮", 2: "兌", 3: "坎", 4: "離", 5: "震", 6: "巽", 7: "巽", 8: "坤", 9: "乾", 0: "艮"}
    return gua_map.get(int(num), "艮")

def get_lianshan_gua(num):
    gua_map = {1: "艮", 2: "兌", 3: "坎", 4: "離", 5: "震", 6: "巽", 7: "巽", 8: "坤", 9: "乾", 10: "艮"}
    n = int(num) % 10
    if n == 0: n = 10
    return gua_map.get(n, "艮")

def get_guicang_gua(num):
    gua_map = {1: "山", 2: "金", 3: "水", 4: "火", 5: "木", 6: "巽", 7: "巽", 8: "坤", 9: "乾"}
    n = int(num) % 9
    if n == 0: n = 9
    return gua_map.get(n, "山")

def get_wuxing(gz):
    wuxing_map = {
        "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土",
        "庚": "金", "辛": "金", "壬": "水", "癸": "水",
        "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火",
        "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水"
    }
    return wuxing_map.get(gz, "")

def get_wuxing_sheng():
    return ["金生水", "水生木", "木生火", "火生土", "土生金"]

def get_wuxing_ke():
    return ["金克木", "木克土", "土克水", "水克火", "火克金"]

def analyze_zongshu(total):
    bai = (total // 100) % 10
    shi = (total // 10) % 10
    ge = total % 10
    
    bai_map = {8: "艮", 9: "乾", 2: "兌", 1: "坎", 3: "震", 4: "巽", 5: "中", 6: "乾", 7: "兌", 0: "坤"}
    shi_map = {9: "乾", 2: "兌", 1: "離", 3: "坤", 4: "震", 5: "巽", 6: "中", 7: "乾", 8: "兌", 0: "離"}
    ge_map = {2: "兌", 8: "艮", 1: "坎", 3: "震", 4: "巽", 5: "中", 6: "乾", 7: "兌", 9: "離", 0: "乾"}
    
    return {
        "百位": {"數": bai, "卦": bai_map.get(bai, "坤"), "主將": "主將", "陰陽": "陽" if bai in [1,3,5,7,9] else "陰"},
        "十位": {"數": shi, "卦": shi_map.get(shi, "離"), "我兵": "我兵", "陰陽": "陽" if shi in [1,3,5,7,9] else "陰"},
        "個位": {"數": ge, "卦": ge_map.get(ge, "乾"), "賊寇": "賊寇", "陰陽": "陽" if ge in [1,3,5,7,9] else "陰"}
    }

def get_zhuke_jieguo(zongshu):
    bai = zongshu["百位"]["數"]
    shi = zongshu["十位"]["數"]
    ge = zongshu["個位"]["數"]
    
    result = []
    jieguo = ""
    
    if bai > shi:
        result.append("主將強於我兵")
        jieguo = "主將威明"
    elif shi > bai:
        result.append("我兵強於主將")
        jieguo = "兵強勇捍"
    else:
        result.append("主將與我兵相當")
        jieguo = "和"
    
    if ge in [1, 3, 5, 7, 9]:
        result.append("陽數賊寇衰弱")
        jieguo += " - 陽數吉利"
    else:
        result.append("陰數賊寇強盛")
        jieguo += " - 陰數主凶"
    
    if bai == 0:
        result.append("百位歸坤")
    if shi == 0:
        result.append("十位歸離")
    if ge == 0:
        result.append("個位歸乾")
    
    return {
        "結論": jieguo,
        "分析": result
    }

def get_guiren(year_gz):
    guiren_map = {
        "甲子": "艮", "甲丑": "坎", "甲寅": "乾", "甲卯": "乾", "甲辰": "艮", "甲巳": "坤",
        "甲午": "艮", "甲未": "艮", "甲申": "震", "甲酉": "震", "甲戌": "震", "甲亥": "震",
        "乙子": "坤", "乙丑": "坤", "乙寅": "兑", "乙卯": "兑", "乙辰": "坤", "乙巳": "坎",
        "乙午": "離", "乙未": "離", "乙申": "巽", "乙酉": "巽", "乙戌": "巽", "乙亥": "巽"
    }
    # [X1] 上游表仅甲/乙年干支可命中(其余 12 键非六十甲子死键;丙~癸 48 干支原表未载)。
    # 未载时旧版伪造默认「艮」且贵人卦直进吉凶评分(+30)/宝马判定 —— 改为诚实返 None:
    # 评分处 None != active_gua 自然不加分,显示层标「原表未载」。绝不臆造正表。
    return guiren_map.get(year_gz)

def get_yima(year_gz):
    yima_map = {
        "申": "坤", "子": "乾", "辰": "巽", "午": "乾",
        "寅": "乾", "戌": "乾", "卯": "巽", "酉": "艮",
        "亥": "巽", "巳": "艮", "丑": "巽", "未": "地"
    }
    dz = year_gz[1] if len(year_gz) > 1 else ""
    return yima_map.get(dz, "坤")

def get_xueguang(year_gz):
    xueguang_map = {
        "甲": "坤", "乙": "坤", "丙": "乾", "丁": "乾", "戊": "艮", "己": "巽",
        "庚": "坎", "辛": "地", "壬": "乾", "癸": "艮"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return xueguang_map.get(tg, "坤")

def get_tiancai(year_gz):
    tiancai_map = {
        "甲": "艮", "乙": "艮", "丙": "乾", "丁": "乾", "戊": "坎", "己": "震",
        "庚": "離", "辛": "離", "壬": "震", "癸": "離"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return tiancai_map.get(tg, "艮")

def get_kuiyuan(year_gz):
    kuiyuan_map = {
        "甲": "震", "乙": "震", "丙": "乾", "丁": "乾", "戊": "坤", "己": "坤",
        "庚": "兑", "辛": "兑", "壬": "坎", "癸": "坎"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return kuiyuan_map.get(tg, "震")

def get_yangren(year_gz):
    yangren_map = {
        "甲": "震", "乙": "巽", "丙": "離", "丁": "離", "戊": "坤", "己": "坤",
        "庚": "兑", "辛": "乾", "壬": "坎", "癸": "艮"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return yangren_map.get(tg, "震")

def get_zhenglu(year_gz):
    zhenglu_map = {
        "甲": "艮", "乙": "震", "丙": "巽", "丁": "離", "戊": "巽", "己": "離",
        "庚": "坤", "辛": "兑", "壬": "乾", "癸": "坎"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return zhenglu_map.get(tg, "艮")

def get_baihu(year_gz):
    baihu_map = {
        "甲": "金", "乙": "震", "丙": "木", "丁": "西", "戊": "火", "己": "坎",
        "庚": "水", "辛": "離", "壬": "上", "癸": "離"
    }
    tg = year_gz[0] if len(year_gz) > 0 else ""
    return baihu_map.get(tg, "金")

def get_po_sui(year_gz):
    dz = year_gz[1] if len(year_gz) > 1 else ""
    if dz in "子午卯酉": return "巽"
    if dz in "寅申巳亥": return "兑"
    if dz in "辰戌丑未": return "艮"
    return "艮"

def get_jie_sha(year_gz):
    dz = year_gz[1] if len(year_gz) > 1 else ""
    if dz in "寅午戌": return "乾"
    if dz in "申子辰": return "巽"
    if dz in "亥卯未": return "坤"
    if dz in "巳酉丑": return "艮"
    return "乾"

def get_changsheng(gan):
    changsheng_order = ["長生", "沐浴", "冠帶", "臨官", "帝旺", "衰", "病", "死", "墓", "絕", "胎", "養"]
    changsheng_idx = {
        "甲": 0, "乙": 6, "丙": 3, "丁": 3, "戊": 5, "己": 5,
        "庚": 6, "辛": 0, "壬": 3, "癸": 3
    }
    idx = changsheng_idx.get(gan, 0)
    return changsheng_order[idx:idx+4]

def get_wuxing_strength(season):
    strength_map = {
        "春": {"旺": "木", "相": "火", "休": "水", "囚": "金", "死": "土"},
        "夏": {"旺": "火", "相": "土", "休": "木", "囚": "水", "死": "金"},
        "秋": {"旺": "金", "相": "水", "休": "土", "囚": "火", "死": "木"},
        "冬": {"旺": "水", "相": "木", "休": "金", "囚": "土", "死": "火"}
    }
    return strength_map.get(season, {})

def get_zhenglu_yangren(year_gz):
    tg = year_gz[0] if len(year_gz) > 0 else ""
    lu = get_zhenglu(year_gz)
    yr = get_yangren(year_gz)
    return f"{lu}/{yr}"

def is_ma_dai_dao(year_gz):
    yima = get_yima(year_gz)
    yangren = get_yangren(year_gz)
    return yima == yangren

def is_baoma(year_gz):
    guiren = get_guiren(year_gz)
    zhenglu = get_zhenglu(year_gz)
    yima = get_yima(year_gz)
    return guiren == zhenglu and yima in ["乾", "艮", "巽"]

def is_yinquan_shigu(year_gz):
    yima = get_yima(year_gz)
    return yima in ["坎", "震", "巽"]

def get_bingzhan_jixiong(shensha, active_gua):
    score = 0
    reasons = []
    
    if shensha.get("貴人") == active_gua:
        score += 30
        reasons.append("貴人助力(+30)")
    if shensha.get("天財") == active_gua:
        score += 20
        reasons.append("天財加持(+20)")
    if shensha.get("魁元") == active_gua:
        score += 15
        reasons.append("魁元照臨(+15)")
    yima = shensha.get("驛馬")
    if yima == active_gua and yima in ["乾", "艮", "巽"]:
        score += 15
        reasons.append("驛馬得地(+15)")
    
    if shensha.get("血光") == active_gua:
        score -= 30
        reasons.append("血光之災(-30)")
    if shensha.get("白虎") == active_gua:
        score -= 25
        reasons.append("白虎凶煞(-25)")
    if shensha.get("破碎") == active_gua:
        score -= 20
        reasons.append("破碎殺伐(-20)")
    if shensha.get("劫殺") == active_gua:
        score -= 15
        reasons.append("劫殺顯現(-15)")
    
    if is_ma_dai_dao(shensha.get("年干", "")):
        score -= 40
        reasons.append("馬帶刀凶兆(-40)")
    if is_baoma(shensha.get("年干", "")):
        score += 30
        reasons.append("寶馬吉兆(+30)")
    if is_yinquan_shigu(shensha.get("年干", "")):
        score += 15
        reasons.append("飲泉食谷(+15)")
    
    if score >= 40:
        level = "大吉"
        detail = "出征大吉，諸事順利"
    elif score >= 20:
        level = "吉"
        detail = "出兵有利，可行軍事"
    elif score >= 0:
        level = "平"
        detail = "吉凶參半，謹慎行事"
    elif score >= -20:
        level = "凶"
        detail = "不宜出兵，另擇吉日"
    else:
        level = "大凶"
        detail = "兵佔大凶，切勿妄動"
    
    return {"level": level, "score": score, "detail": detail, "reasons": reasons}


class Shenyishu():
    def __init__(self, year, month, day, hour, after23_new_day=1, late_zi_next_day=1):
        self.year = year
        self.month = month
        self.day = day
        self.hour = hour
        self.after23_new_day = after23_new_day
        # [X1] 晚子时起干开关(全局 lateZiHourUseNextDay 透传):1=晚子时按次日日干起子时(旧行为,默认);
        # 0=仍按当日日干起。此前前端传了、事盘存了,后端不读、此处写死 —— 开关对本技法恒死。
        self.late_zi_next_day = late_zi_next_day
        # 用戶語義（拍板,字面直覺版）: after23_new_day=1「23点算第二天」= 23時起日柱進位次日(壬寅); =0「24点算第二天」= 23時仍守今、24時才換日柱(辛丑)。
        _cy, _cm, _cd = year, month, day
        # 🔴 全年份域:sxtwl/datetime 域限 1~9999(BC/远期 fromSolar 崩 IndexError);域外 cdate 置
        # None,四柱由 gangzhi() 走权威 kin_year_domain 回退(与八字/主链一致)。域内 sxtwl 原路径零变。
        if year < 1 or year > 9999:
            self.cdate = None
            self.cdate_for_hour = None
        else:
            if after23_new_day and hour == 23:
                from datetime import date as _date, timedelta as _timedelta
                _nd = _date(year, month, day) + _timedelta(days=1)
                _cy, _cm, _cd = _nd.year, _nd.month, _nd.day
            self.cdate = sxtwl.fromSolar(_cy, _cm, _cd)
            # 時柱跨日：hour==23 且晚子时开关开 → 按"次日日干"起子時;开关关则守当日干。
            if hour == 23 and late_zi_next_day:
                from datetime import date as _date2, timedelta as _timedelta2
                _td = _date2(year, month, day) + _timedelta2(days=1)
                self.cdate_for_hour = sxtwl.fromSolar(_td.year, _td.month, _td.day)
            else:
                self.cdate_for_hour = self.cdate

    def gangzhi(self):
        if self.cdate is None:
            # 全年份域回退(与八字/主链一致;after23/lateZi 由 extreme_pillars 内部处理)
            from kin_year_domain import extreme_pillars
            _y, _m, _d, _h, _zi = extreme_pillars(
                self.year, self.month, self.day, self.hour, 0,
                after23=(1 if self.after23_new_day else 0),
                hour_gan_next=(1 if self.late_zi_next_day else 0))
            return {"年": _y, "月": _m, "日": _d, "時": _h}
        yTG = Gan[self.cdate.getYearGZ().tg] + Zhi[self.cdate.getYearGZ().dz]
        mTG = Gan[self.cdate.getMonthGZ().tg] + Zhi[self.cdate.getMonthGZ().dz]
        dTG = Gan[self.cdate.getDayGZ().tg] + Zhi[self.cdate.getDayGZ().dz]
        # 時柱跨日：用 cdate_for_hour（次日干）起子時；其他時辰 cdate_for_hour 與 cdate 相同。
        # [X1] lateZi=0(晚子时按当日干):sxtwl getHourGZ(23) 内部已按次日干起子,
        # 故以同日 getHourGZ(0)(早子同干同支)取「当日干之子时」;=1 走旧路径字节不变。
        if self.hour == 23 and not self.late_zi_next_day:
            hgz = self.cdate.getHourGZ(0)
        else:
            hgz = self.cdate_for_hour.getHourGZ(self.hour)
        hTG = Gan[hgz.tg] + Zhi[hgz.dz]
        return {"年": yTG, "月": mTG, "日": dTG, "時": hTG}
    
    def ymd_total(self):
        gz = self.gangzhi()
        y = get_jiazi_code(gz["年"])
        m = get_jiazi_code(gz["月"])
        d = get_jiazi_code(gz["日"])
        h = get_jiazi_code(gz["時"])
        return y + m + d + h
    
    def get_gua(self):
        num = str(self.ymd_total())
        return [num_to_gua(i) for i in num]
    
    def get_lianshan(self):
        num = str(self.ymd_total())
        return get_lianshan_gua(num)
    
    def get_guicang(self):
        num = str(self.ymd_total())
        return get_guicang_gua(num)
    
    def get_wuxing(self):
        gz = self.gangzhi()
        return {
            "年": get_wuxing(gz["年"][0]) + get_wuxing(gz["年"][1]),
            "月": get_wuxing(gz["月"][0]) + get_wuxing(gz["月"][1]),
            "日": get_wuxing(gz["日"][0]) + get_wuxing(gz["日"][1]),
            "時": get_wuxing(gz["時"][0]) + get_wuxing(gz["時"][1])
        }
    
    def get_shensha(self):
        gz = self.gangzhi()
        year_gz = gz["年"]
        return {
            "年干": year_gz,
            "貴人": get_guiren(year_gz),
            "驛馬": get_yima(year_gz),
            "血光": get_xueguang(year_gz),
            "天財": get_tiancai(year_gz),
            "魁元": get_kuiyuan(year_gz),
            "羊刃": get_yangren(year_gz),
            "正祿": get_zhenglu(year_gz),
            "白虎": get_baihu(year_gz),
            "破碎": get_po_sui(year_gz),
            "劫殺": get_jie_sha(year_gz),
            "馬帶刀": "是" if is_ma_dai_dao(year_gz) else "否",
            "寶馬": "是" if is_baoma(year_gz) else "否"
        }
    
    def get_changsheng_info(self):
        gz = self.gangzhi()
        return {k: get_changsheng(v[0]) for k, v in gz.items() if k != "時"}
    
    def get_bingzhan_result(self):
        gz = self.gangzhi()
        total = self.ymd_total()
        zongshu = analyze_zongshu(total)
        zhuke = get_zhuke_jieguo(zongshu)
        shensha = self.get_shensha()
        lianshan = self.get_lianshan()
        jixiong = get_bingzhan_jixiong(shensha, lianshan)
        
        return {
            "生辰": f"{self.year}年{self.month}月{self.day}日{self.hour}時",
            "干支": gz,
            "總數": total,
            "總數分析": zongshu,
            "主客判斷": zhuke,
            "連山卦": self.get_lianshan(),
            "歸藏卦": self.get_guicang(),
            "八卦": self.get_gua(),
            "五行": self.get_wuxing(),
            "神煞": shensha,
            "長生": self.get_changsheng_info(),
            "吉凶": jixiong
        }
    
    def to_json(self):
        return json.dumps(self.get_bingzhan_result(), ensure_ascii=False, indent=2)
    
    def to_cli(self):
        result = self.get_bingzhan_result()
        lines = []
        lines.append("=" * 50)
        lines.append("         神易數兵佔系統")
        lines.append("         講武全書兵佔卷之十六")
        lines.append("=" * 50)
        lines.append(f"\n【生辰】{result['生辰']}")
        
        lines.append("\n【干支】")
        for k, v in result["干支"].items():
            wx = result["五行"].get(k, "")
            lines.append(f"  {k}支: {v} ({wx})")
        
        lines.append(f"\n【總數】{result['總數']}")
        
        lines.append("\n【總數分析 - 行軍佔】")
        zs = result["總數分析"]
        pos_labels = {"百位": "主將", "十位": "我兵", "個位": "賊寇"}
        for pos in ["百位", "十位", "個位"]:
            p = zs[pos]
            lines.append(f"  {pos} ({pos_labels[pos]}): {p['數']} → {p['卦']} {p['陰陽']}數")
        
        lines.append("\n【主客判斷】")
        zk = result["主客判斷"]
        lines.append(f"  結論: {zk['結論']}")
        for a in zk["分析"]:
            lines.append(f"    - {a}")
        
        lines.append(f"【連山卦】{result['連山卦']}")
        lines.append(f"【歸藏卦】{result['歸藏卦']}")
        lines.append(f"【八卦】{''.join(result['八卦'])}")
        
        lines.append("\n【神煞】")
        for k, v in result["神煞"].items():
            lines.append(f"  {k}: {v}")
        
        lines.append("\n【吉凶判斷】")
        jx = result["吉凶"]
        lines.append(f"  等級: {jx['level']}")
        lines.append(f"  評分: {jx['score']}")
        lines.append(f"  結論: {jx['detail']}")
        if jx["reasons"]:
            lines.append("  理由:")
            for r in jx["reasons"]:
                lines.append(f"    - {r}")
        
        lines.append("\n" + "=" * 50)
        return "\n".join(lines)


class CORSHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/bingzhan":
            params = parse_qs(parsed.query)
            try:
                year = int(params.get("year", [2023])[0])
                month = int(params.get("month", [7])[0])
                day = int(params.get("day", [4])[0])
                hour = int(params.get("hour", [22])[0])
                ss = Shenyishu(year, month, day, hour)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(ss.to_json().encode())
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f'{{"error": "{str(e)}"}}'.encode())
        else:
            super().do_GET()


def start_server(port=8080):
    server = HTTPServer(("0.0.0.0", port), CORSHandler)
    print(f"神易數兵佔伺服器啟動: http://localhost:{port}")
    print(f"API範例: http://localhost:{port}/api/bingzhan?year=2023&month=7&day=4&hour=22")
    server.serve_forever()


if __name__ == '__main__':
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    parser = argparse.ArgumentParser(description="神易數兵佔系統")
    parser.add_argument("--year", "-y", type=int, default=2023, help="年份")
    parser.add_argument("--month", "-m", type=int, default=7, help="月份")
    parser.add_argument("--day", "-d", type=int, default=4, help="日期")
    parser.add_argument("--hour", "-t", type=int, default=22, help="時辰")
    parser.add_argument("--json", "-j", action="store_true", help="JSON輸出")
    parser.add_argument("--server", "-s", action="store_true", help="啟動Web伺服器")
    parser.add_argument("--port", "-p", type=int, default=8080, help="伺服器埠")
    
    args = parser.parse_args()
    
    if args.server:
        start_server(args.port)
    else:
        ss = Shenyishu(args.year, args.month, args.day, args.hour)
        if args.json:
            print(ss.to_json())
        else:
            print(ss.to_cli())
