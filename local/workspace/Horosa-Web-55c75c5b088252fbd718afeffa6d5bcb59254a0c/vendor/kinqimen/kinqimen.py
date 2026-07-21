# -*- coding: utf-8 -*-
"""
Created on Thu Jan 16 09:49:35 2020
@author: kentang
"""
import re
import time
import itertools
from itertools import starmap
from bidict import bidict
from datetime import datetime, timedelta
from angan import Angan
import config



class Qimen:
    """奇門函數"""
    def __init__(self, year, month, day, hour, minute):
        self.year = year
        self.month = month
        self.day = day
        self.hour = hour
        self.minute = minute

    def year_yuen(self):
        """搵上中下元"""
        yuen_list = [(i * 60) + 4 for i in range(22,100)]
        if self.year < yuen_list[0] or self.year > yuen_list[-1] - 1:
            # 全年份域:表域(1324~5943)外沿用域内实际输出(域内任何年均返此值,内外一致不炸)
            return ["下元甲子", yuen_list[-1]]
        three_yuen = itertools.cycle([i+"元甲子" for i in list("上中下")])
        for yuen in yuen_list:
            if self.year < yuen:
                break
            yuen1 = dict(zip(yuen_list, three_yuen)).get(yuen_list[yuen_list.index(yuen)-1])
            return [yuen1, yuen_list[yuen_list.index(yuen)-1]]
        return None

    def qimen_ju_day(self):
        """奇門局日"""
        ju_day_dict = {tuple(list("甲己")):"甲己日",
                       tuple(list("乙庚")):"乙庚日",
                       tuple(list("丙辛")):"丙辛日",
                       tuple(list("丁壬")):"丁壬日",
                       tuple(list("戊癸")):"戊癸日"}
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        try:
            find_d = config.multi_key_dict_get(ju_day_dict, gz[2][0])
        except TypeError:
            find_d = config.multi_key_dict_get(ju_day_dict, gz[2][1])
        return find_d
    #值符
    def hourganghzi_zhifu(self):
        """時干支值符"""
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        jz = config.jiazi()
        a = list(map(lambda x:config.new_list(jz, x)[0:10],jz[0::10]))
        b = list(map(lambda x:jz[0::10][x]+config.tian_gan[4:10][x],list(range(0,6))))
        d = dict(zip(list(map(lambda x: tuple(x),a)),b))
        return config.multi_key_dict_get(d, gz[3])
    #分值符
    def hourganghzi_zhifu_minute(self):
        """刻家奇門值符"""
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        jz = config.jiazi()
        a = list(map(lambda x: tuple(x),list(map(lambda x:config.new_list(jz, x)[0:10],jz[0::10]))))
        b = list(map(lambda x: jz[0::10][x] + config.tian_gan[4:10][x],list(range(0,6))))
        return config.multi_key_dict_get(dict(zip(a,b)), gz[4])
    #地盤
    def pan_earth(self, option):
        """時家奇門地盤設置, option 1:拆補 2:置閏 3:茅山 4:無閏"""
        qmju = {1: config.qimen_ju_name_chaibu,
                2: config.qimen_ju_name_zhirun,
                3: config.qimen_ju_name_maoshan,
                4: config.qimen_ju_name_wurun}.get(option, config.qimen_ju_name_chaibu)(self.year,
                                                                                        self.month,
                                                                                        self.day,
                                                                                        self.hour,
                                                                                        self.minute)
        return dict(zip(list(map(lambda x: dict(zip(config.cnumber, config.eight_gua)).get(x),
                         config.new_list(config.cnumber, qmju[2]))),
                        {"陽遁":list("戊己庚辛壬癸丁丙乙"),
                         "陰遁":list("戊乙丙丁癸壬辛庚己")}.get(qmju[0:2])))
    #地盤
    def pan_earth_minute(self):
        """刻家奇門地盤設置"""
        ke = config.qimen_ju_name_ke(self.year,
                                     self.month,
                                     self.day,
                                     self.hour,
                                     self.minute)
        return dict(zip(list(map(lambda x: dict(zip(config.cnumber, config.eight_gua)).get(x),
                        config.new_list(config.cnumber, ke[2]))),
                        {"陽遁":list("戊己庚辛壬癸丁丙乙"),
                         "陰遁":list("戊乙丙丁癸壬辛庚己")}.get(ke[0:2])))
    #逆地盤
    def pan_earth_r(self, option):
        """時家奇門地盤(逆)設置, option 1:拆補 2:置閏"""
        pan_earth_v = list(self.pan_earth(option).values())
        pan_earth_k = list(self.pan_earth(option).keys())
        return dict(zip(pan_earth_v, pan_earth_k))

    def pan_earth_min_r(self):
        """刻家奇門地盤(逆)設置"""
        pan_earth_v = list(self.pan_earth_minute().values())
        pan_earth_k = list(self.pan_earth_minute().keys())
        return dict(zip(pan_earth_v, pan_earth_k))
    #天盤
    def pan_sky(self, option):
        qmju = {
            1: config.qimen_ju_name_chaibu,
            2: config.qimen_ju_name_zhirun,
            3: config.qimen_ju_name_maoshan,
            4: config.qimen_ju_name_wurun
        }.get(option, config.qimen_ju_name_chaibu)(self.year,
                      self.month,
                      self.day,
                      self.hour,
                      self.minute)
        rotate = {
            "陽": config.clockwise_eightgua,
            "陰": list(reversed(config.clockwise_eightgua))
        }.get(qmju[0])
        zhifu_n_zhishi = config.zhifu_n_zhishi(
            self.year,
            self.month,
            self.day,
            self.hour,
            self.minute,
            option)
        fu_head = self.hourganghzi_zhifu()[2]
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        fu_location = self.pan_earth_r(option).get(gz[3][0])
        fu_head_location = zhifu_n_zhishi.get("值符星宮")[1]
        fu_head_location2 = self.pan_earth_r(option).get(fu_head)
        gan_head = zhifu_n_zhishi.get("值符天干")[1]
        zhifu = zhifu_n_zhishi["值符星宮"][0]
        earth = self.pan_earth(option)
        gong_reorder = config.new_list(rotate, "坤")
        if fu_head_location == "中":
            try:
                a = list(map(earth.get, rotate))
                gan_reorder = config.new_list(a, fu_head)
                gong_reorder = config.new_list(rotate, fu_head_location)
                return dict(zip(gong_reorder, gan_reorder))
            except ValueError:
                if config.pan_god(self.year,
                                  self.month,
                                  self.day,
                                  self.hour,
                                  self.minute,
                                  option).get("坤") != "符":
                    a = list(map(earth.get, rotate))
                    return dict(zip(gong_reorder, config.new_list(a, self.pan_earth(option).get("坤"))))
                if earth.get("坤") == gan_head:
                    a = list(map(earth.get, rotate))
                    return dict(zip(gong_reorder, config.new_list(a, list(reversed(a))[0])))
                else:
                    try:
                        return dict(zip(gong_reorder, config.new_list(a, gan_head)))
                    except ValueError:
                        return dict(zip(gong_reorder, config.new_list(a, self.pan_earth(option).get("坤"))))

        if fu_head_location != "中" and zhifu != "禽" and fu_head_location2 != "中":
            newlist = list(map(earth.get, rotate))
            gan_reorder = config.new_list(newlist, fu_head)
            gong_reorder = config.new_list(rotate, fu_head_location)
            if fu_head not in gan_reorder:
                start = dict(zip(config.cnumber, gan_reorder)).get(qmju[2])
                rgan_reorder = config.new_list(gan_reorder, start)
                rgong_reorder = config.new_list(gong_reorder, fu_location)
                aa = dict(zip(rgong_reorder, rgan_reorder))
                bb = dict(zip(rgan_reorder, rgong_reorder))
                return aa, bb
            if fu_head in gan_reorder:
                if fu_location is None:
                    return self.pan_earth(option)
                return {**dict(zip(gong_reorder, gan_reorder)),
                        **{"中": self.pan_earth(option).get("中")}}
        if fu_head_location != "中" and zhifu == "禽" and fu_head_location2 == "中":
            gg = list(map(earth.get, rotate))
            gan_reorder = config.new_list(gg, self.pan_earth(option).get("坤"))
            gong_reorder = config.new_list(rotate, fu_head_location)
            if fu_head not in gan_reorder:
                rgong_reorder = config.new_list(gong_reorder, fu_location)
                return dict(zip(rgong_reorder, gan_reorder))
            return {**dict(zip(gong_reorder, gan_reorder)),
                    **{"中": self.pan_earth(option)[0].get("中")}}

    #九宮長生十二神
    def gong_chengsun(self, option):
        sky = self.pan_sky(option)
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        find_twelve_luck = config.find_shier_luck(gz[2][0])
        di_zhi_mapping = dict(zip(config.di_zhi, list("癸己甲乙戊丙丁己庚辛戊壬")))
        find_twelve_luck_new = {di_zhi_mapping.get(k): v for k, v in find_twelve_luck.items()}
        try:
            sky_pan = sky[0]
            sky_pan_new = {k: {v: find_twelve_luck_new.get(k)} for k, v in sky_pan.items()}
        except KeyError:
            sky_pan = sky
            c = list(map(lambda i:{i:find_twelve_luck_new.get(i)}, list(sky_pan.values())))
            sky_pan_new = dict(zip(list(sky_pan.keys()), c))
        earth_pan = self.pan_earth(option)
        earth_pan_new = {k: {v: find_twelve_luck_new.get(v)} for k, v in earth_pan.items()}
        return {"天盤": sky_pan_new, "地盤": earth_pan_new}

    def gong_chengsun_minute(self, option):
        def my_function(value):
            return config.find_shier_luck(value)
    
        def apply_function_to_dict_values(a):
            result = {}
            for key, value in a.items():
                if isinstance(value, tuple):
                    result[key] = tuple(my_function(v) for v in value)
                else:
                    result[key] = my_function(value)
            return result
    
        sky = config.pan_sky_minute(self.year, self.month, self.day, self.hour, self.minute)
        del sky["中"]
        gong_maping = dict(zip(config.clockwise_eightgua, ["子", tuple(list("丑寅")), "卯", tuple(list("辰巳")), "午", tuple(list("未申")), "酉", tuple(list("戌亥"))]))
        # Instead of creating a nested dict, make the value a tuple
        a = {k: (v, gong_maping.get(k)) for k, v in sky.items()}
        b = {k: v[0] for k, v in apply_function_to_dict_values(a).items() if v[1] is None}
        d = {}
        for key, value in gong_maping.items():
            if isinstance(value, tuple):
                d[key] = {v: b[key][v] for v in value}
            else:
                d[key] = {value: b[key][value]}
        return d

    def pan_feipan(self, option):
        """飛盤排盤(洛書飛布,九星九門九神含中宮);與前端 DunJiaCalc.panFeipan 同算法。
        option 定局法 1拆補/2置閏/3茅山/4無閏。輸出卦鍵 dict(坎坤震巽中乾兌艮離),與轉盤同格式,前端 merge 統一繁→簡。"""
        qmju = {1: config.qimen_ju_name_chaibu,
                2: config.qimen_ju_name_zhirun,
                3: config.qimen_ju_name_maoshan,
                4: config.qimen_ju_name_wurun}.get(option, config.qimen_ju_name_chaibu)(
            self.year, self.month, self.day, self.hour, self.minute)
        is_yang = qmju[0:2] == "陽遁"
        eg = config.eight_gua  # 坎坤震巽中乾兌艮離(洛書序)
        earth = self.pan_earth(option)  # {卦:干}
        earth_gong = {g: earth.get(eg[g - 1]) for g in range(1, 10)}  # 洛書宮→干
        gz = config.gangzhi(self.year, self.month, self.day, self.hour, self.minute)
        time_gz = gz[3]
        xun_head = config.multi_key_dict_get(config.liujiashun_dict(), time_gz)
        dun_yi = config.jj.get(xun_head, "戊")
        Hv = 5
        for g in range(1, 10):
            if earth_gong[g] == dun_yi:
                Hv = g
                break
        time_gan = time_gz[0]
        P = Hv
        if time_gan != "甲":
            for g in range(1, 10):
                if earth_gong[g] == time_gan:
                    P = g
                    break
        xord = config.tian_gan.index(time_gan) + 1
        HvEff = 2 if Hv == 5 else Hv
        lp = lambda n: ((n - 1) % 9 + 9) % 9 + 1
        Pu = lp(Hv + xord - 1) if is_yang else lp(Hv - xord + 1)
        step = 1 if is_yang else -1
        jiu_xing = list("蓬芮沖輔禽心柱任英")  # 洛書宮1-9→星
        gate_home = {1: "休", 8: "生", 3: "傷", 4: "杜", 9: "景", 2: "死", 7: "驚", 6: "開"}
        gods9 = list("符蛇陰合勾常雀地天")
        star_g, sky_g, gate_g, god_g = {}, {}, {}, {}
        dsky = ((P - Hv) % 9 + 9) % 9
        for hj in range(1, 10):
            np = lp(hj + dsky)
            star_g[np] = jiu_xing[hj - 1]
            sky_g[np] = earth_gong[hj]
        dgate = ((Pu - HvEff) % 9 + 9) % 9
        for hk in gate_home:
            np = lp(hk + dgate)
            gate_g[np] = gate_home[hk]
        for i, god in enumerate(gods9):
            np = lp(P + i * step)
            if np not in god_g:
                god_g[np] = god
        to_gua = lambda gmap: {eg[g - 1]: gmap.get(g, "") for g in range(1, 10)}
        return {
            "排盤方式": {1: "拆補", 2: "置閏", 3: "茅山", 4: "無閏"}.get(option),
            "盤式": "飛盤",
            "天盤": to_gua(sky_g),
            "門": to_gua(gate_g),
            "星": to_gua(star_g),
            "神": to_gua(god_g),
            "值符值使": {
                "值符天干": [xun_head, dun_yi],
                "值符星宮": [jiu_xing[Hv - 1], eg[lp(P) - 1]],
                "值使門宮": [gate_home.get(HvEff, "死"), eg[lp(Pu) - 1]],
            },
        }

    def pan(self, option, school="轉盤"):#1拆補 #2置閏
        """時家奇門起盤綜合, option 1:拆補 2:置閏;school 轉盤(預設)/飛盤(洛書飛布九神)"""
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        gzd = "{}年{}月{}日{}時".format(gz[0], gz[1], gz[2], gz[3])
        qmju = {1: config.qimen_ju_name_chaibu,
                2: config.qimen_ju_name_zhirun,
                3: config.qimen_ju_name_maoshan,
                4: config.qimen_ju_name_wurun}.get(option, config.qimen_ju_name_chaibu)(self.year,
                                                                                        self.month,
                                                                                        self.day,
                                                                                        self.hour,
                                                                                        self.minute)
        shunhead = config.shun(gz[2])
        shunkong = config.daykong_shikong(self.year,
                                          self.month,
                                          self.day,
                                          self.hour,
                                          self.minute)
        paiju = qmju
        j_q = config.dingju_jieqi(self.year,
                        self.month,
                        self.day,
                        self.hour,
                        self.minute,
                        option)
        zfzs = config.zhifu_n_zhishi(self.year,self.month,self.day,self.hour,self.minute,option)
        pan_star_result = config.pan_star(self.year,
                                          self.month,
                                          self.day,
                                          self.hour,
                                          self.minute,
                                          option)
        star = pan_star_result[0]
        door = config.pan_door(self.year,
                               self.month,
                               self.day,
                               self.hour,
                               self.minute,
                               option)
        god = config.pan_god(self.year,
                             self.month,
                             self.day,
                             self.hour,
                             self.minute,
                             option)
        result = {
            "排盤方式":{1:"拆補", 2:"置閏", 3:"茅山", 4:"無閏"}.get(option),
            "盤式": "轉盤",
            "干支": gzd,
            "旬首": shunhead,
            "旬空": shunkong,
            "局日": self.qimen_ju_day(),
            "排局": paiju,
            "節氣": j_q,
            "值符值使": zfzs,
            "天乙": self.tianyi(option),
            "天盤": self.pan_sky(option),
            "地盤": self.pan_earth(option),
            "門": door,
            "星": star,
            "神": god,
            "馬星": {
                "天馬": self.moonhorse(),
                "丁馬": self.dinhorse(),
                "驛馬": self.hourhorse()
            },
            "長生運": self.gong_chengsun(option)}
        # 飛盤(school='飛盤'):盤面(天/門/星/神+值符值使)改用洛書飛布;地盤/局/節氣/馬星等與轉盤共用。
        if school in ("飛盤", "飞盘"):
            fei = self.pan_feipan(option)
            result["盤式"] = "飛盤"
            result["天盤"] = fei["天盤"]
            result["門"] = fei["門"]
            result["星"] = fei["星"]
            result["神"] = fei["神"]
            result["值符值使"] = fei["值符值使"]
        return result

    def pan_minute(self, option):
        """刻家奇門起盤綜合, option 1:拆補 2:置閏"""
        gz = config.gangzhi(self.year,
                            self.month,
                            self.day,
                            self.hour,
                            self.minute)
        gzd = "{}年{}月{}日{}時{}分".format(gz[0], gz[1], gz[2], gz[3], gz[4])
        s = config.multi_key_dict_get(config.liujiashun_dict(), gz[4])
        qmju = config.qimen_ju_name_ke(self.year,
                                              self.month,
                                              self.day,
                                              self.hour,
                                              self.minute)
        shunhead = config.shun(gz[3])
        shunkong = config.hourkong_minutekong(self.year,
                                              self.month,
                                              self.day,
                                              self.hour,
                                              self.minute)
        paiju = qmju
        j_q = config.jq(self.year,
                        self.month,
                        self.day,
                        self.hour,
                        self.minute)
        zfzs = config.zhifu_n_zhishi_ke(self.year,
                                        self.month,
                                        self.day,
                                        self.hour,
                                        self.minute)
        pan_star_result = config.pan_star_minute(self.year,
                                                 self.month,
                                                 self.day,
                                                 self.hour,
                                                 self.minute,
                                                 option)
        star = pan_star_result[0]
        door = config.pan_door_minute(self.year,
                                      self.month,
                                      self.day,
                                      self.hour,
                                      self.minute,
                                      option)
        god = config.pan_god_minute(self.year,
                                    self.month,
                                    self.day,
                                    self.hour,
                                    self.minute,
                                    option)
        return {
            "排盤方式":{1:"拆補", 2:"置閏", 3:"茅山", 4:"無閏"}.get(option),
            "干支": gzd,
            "旬首": shunhead,
            "旬空": shunkong,
            "局日": self.qimen_ju_day(),
            "排局": paiju,
            "節氣": j_q,
            "值符值使": zfzs,
            "天乙": self.tianyi(option),
            "天盤": config.pan_sky_minute(self.year,
                                          self.month,
                                          self.day,
                                          self.hour,
                                          self.minute),
            "地盤": config.pan_earth_minute(self.year,
                                          self.month,
                                          self.day,
                                          self.hour,
                                          self.minute),
            "門": door,
            "星": star,
            "神": god,
            "馬星": {
                "天馬": self.moonhorse(),
                "丁馬": self.dinhorse(),
                "驛馬": self.hourhorse()
            },
            #"長生運": self.gong_chengsun_minute(option),
            "暗干": dict(zip(Angan.get(paiju[0]+paiju[2]+gz[4])[:-1], config.eight_gua)), 
            "飛干": Angan.get(paiju[0]+paiju[2]+gz[4])[-1]}

    def pan_html(self, option):
        """時家奇門html, option 1:拆補 2:置閏"""
        god = config.pan_god(self.year,
                             self.month,
                             self.day,
                             self.hour,
                             self.minute,
                             option)
        door = config.pan_door(self.year,
                               self.month,
                               self.day,
                               self.hour,
                               self.minute,
                               option)
        star = config.pan_star(self.year,
                               self.month,
                               self.day,
                               self.hour,
                               self.minute,
                               option)[0]
        sky = self.pan_sky(option)
        earth = self.pan_earth(option)
        a = ''' <div class="container"><table style="width:100%"><tr>''' + \
            "".join(['''<td align="center">''' +
                     sky.get(i) +
                     god.get(i) +
                     door.get(i) +
                     "<br>" +
                     earth.get(i) +
                     star.get(i) +
                     i + '''</td>''' for i in list("巽離坤")]) + "</tr>"
        b = ['''<td align="center">''' +
             sky.get(i) +
             god.get(i) +
             door.get(i) +
             "<br>" +
             earth.get(i) +
             star.get(i) +
             i + '''</td>''' for i in list("震兌")]
        c = '''<tr>''' + b[0] + '''<td><br><br></td>''' + b[1] + '''</tr>'''
        d = "<tr>" + \
            "".join(['''<td align="center">''' +
                     sky.get(i) +
                     god.get(i) +
                     door.get(i) +
                     "<br>" +
                     earth.get(i) +
                     star.get(i) +
                     i + '''</td>''' for i in list("艮坎乾")]) + "</tr></table></div>"
        return a + c + d

    def ypan(self):
        kok = {"上元甲子":"陰一局",
               "中元甲子":"陰四局",
               "下元甲子":"陰七局"}.get(self.year_yuen()[0])
        return kok

    def gpan(self):
        j_q = config.jq(self.year,
                        self.month,
                        self.day,
                        self.hour,
                        self.minute)
        dgz = config.gangzhi(self.year,
                             self.month,
                             self.day,
                             self.hour,
                             self.minute)[2]
        dh = config.multi_key_dict_get({tuple(config.new_list(config.jieqi_name, "冬至")[0:12]):"冬至",
                             tuple(config.new_list(config.jieqi_name, "夏至")[0:12]):"夏至"},j_q)
        eg = "坎坤震巽乾兌艮離"
        yy = {"冬至":"陽遁", "夏至":"陰遁"}.get(dh)
        ty_doors = {"冬至": dict(zip(config.jiazi(),itertools.cycle(list("艮離坎坤震巽中乾兌")))), 
                "夏至": dict(zip(config.jiazi(),itertools.cycle(list("坤坎離艮兌乾中巽震"))))}
        gong = ty_doors.get(dh).get(dgz)
        eight_gua = list("坎坤震巽中乾兌艮離")
        rotate_order = {"陽遁":eight_gua, "陰遁":list(reversed(eight_gua))}.get(yy)
        a_gong = config.new_list(rotate_order, gong)
        gold_g = re.findall("..","太乙攝提軒轅招搖天符青龍咸池太陰天乙")
        star_pai = dict(zip(a_gong, gold_g))
        triple_list = list(map(lambda x: x + x + x, list(range(0,21))))
        b = list(starmap(lambda start, end: tuple(config.jiazi()[start:end]),  zip(triple_list[:-1], triple_list[1:])))
        rest_door_settings = {"陽遁":dict(zip(b, itertools.cycle(eg))),
                              "陰遁":dict(zip(b, itertools.cycle(list(reversed(eg)))))}.get(yy)
        clockwise_eightgua = list("坎艮震巽離坤兌乾")
        door_r = list("休生傷杜景死驚開")
        rest = config.multi_key_dict_get(rest_door_settings, dgz)
        the_doors = {"陽遁": dict(zip(config.new_list(clockwise_eightgua, rest), door_r)), 
                     "陰遁": dict(zip(config.new_list(list(reversed(clockwise_eightgua)), rest), door_r))}.get(yy)
        return {"局": yy+dgz+"日",
                "鶴神": self.crane_god().get(dgz),
                "星": star_pai,
                "門": {**the_doors, 
                      **{"中":""}},
                "神": config.getgtw().get(dgz[0])}
    #鶴神
    def crane_god(self):
        d = list("巽離坤兌乾坎天艮震")
        dd = [6,5,6,5,6,5,16,6,5]
        newc_list = list(map(lambda i:[d[i][:5]]*dd[i],list(range(0,8))))
        return dict(zip(config.new_list(config.jiazi(), "庚申"), newc_list))

    def gpan_html(self):
        gpan_data = self.gpan()
        door = gpan_data.get("門")
        star = gpan_data.get("星")
        html_output = '''<div class="container"><table style="width:100%"><tr>'''
        html_output += ''.join([
            f'''<td align="center">{star[i]}<br>{door[i]}{i}</td>''' for i in "巽離坤"
        ])
        html_output += "</tr><tr>"
        html_output += ''.join([
            f'''<td align="center">{star[i]}<br>{door[i]}{i}</td>''' for i in "震中兌"
        ])
        html_output += "</tr><tr>"
        html_output += ''.join([
            f'''<td align="center">{star[i]}<br>{door[i]}{i}</td>''' for i in "艮坎乾"
        ])
        html_output += "</tr></table></div>"
        return html_output
    #天乙
    def tianyi(self, option):
        zhifu_n_zhishi= config.zhifu_n_zhishi(self.year,
                                              self.month,
                                              self.day,
                                              self.hour,
                                              self.minute,
                                              option)
        zhifu_dict = dict(zip(config.eight_gua, list("蓬芮沖輔禽心柱任英")))
        try:
            star_location = zhifu_dict.get(zhifu_n_zhishi.get("值符星宮")[1])
        except IndexError:
            star_location = "禽"
        return star_location
    #丁馬
    def dinhorse(self):
        gz = config.gangzhi(self.year,
                                 self.month,
                                 self.day,
                                 self.hour,
                                 self.minute)
        tg = re.findall("..","甲子甲戌甲申甲午甲辰甲寅")
        new_dict = dict(zip(tg, list("卯丑亥酉未巳")))
        new = config.multi_key_dict_get(config.liujiashun_dict(), gz[2])
        return config.multi_key_dict_get(new_dict, new)
    #天馬
    def moonhorse(self):
        Gangzhi = config.gangzhi(self.year,
                                 self.month,
                                 self.day,
                                 self.hour,
                                 self.minute)
        tg = re.findall("..","寅申卯酉辰戌巳亥午子丑未")
        new = list(map(lambda i:tuple(i), tg))
        new_dict = dict(zip(new, list("午申戌子寅辰")))
        return config.multi_key_dict_get(new_dict, Gangzhi[2][1])
    #驛馬星
    def hourhorse(self):
        Gangzhi = config.gangzhi(self.year,
                                 self.month,
                                 self.day,
                                 self.hour,
                                 self.minute)
        tg = re.findall("...","申子辰寅午戌亥卯未巳酉丑")
        new = list(map(lambda i:tuple(i), tg))
        new_dict = dict(zip(new, list("寅申巳亥")))
        return config.multi_key_dict_get(new_dict, Gangzhi[3][1])
    
    def green_dragon(self, option):
        """青龍返首"""
        hg = config.gangzhi(self.year,
            self.month,
            self.day,
            self.hour,
            self.minute)[3][0]
        sky = self.pan_sky(option)
        earth = self.pan_earth(option)
        zhishi = config.zhifu_n_zhishi(
            self.year,
            self.month,
            self.day,
            self.hour,
            self.minute,
            option).get("值符天干")[1]
        zf_gong = config.zhifu_n_zhishi(
            self.year,
            self.month,
            self.day,
            self.hour,
            self.minute,
            option).get("值符星宮")[1]
        zhishi_gong = bidict(earth).inverse[zhishi]
        try:
            sky_gong = bidict(sky).inverse["戊"]
            earth_gong = bidict(earth).inverse["丙"]
            if earth_gong == sky_gong:
                return {"青龍返首": sky_gong}
            if zhishi_gong == earth_gong:
                return {"青龍返首": earth_gong}
            if sky_gong == "中":
                return {"青龍返首": earth_gong}
            else:
                return {"青龍返首": "沒有"}
        except KeyError:
            if hg == "戊" or hg == "丙":
                if zhishi_gong == "中":
                    return {"青龍返首": zf_gong}
                if zf_gong == "中":
                    return  {"青龍返首": bidict(sky).inverse[earth.get("坤")]}
            else:
                return {"青龍返首": "沒有"}
            
    def fly_bird(self, option):
        """飛鳥跌穴"""
        sky = self.pan_sky(option)
        earth = self.pan_earth(option)
        zhishi = config.zhifu_n_zhishi(
            self.year,
            self.month,
            self.day,
            self.hour,
            self.minute,
            option).get("值符天干")[1]
        zf_gong = config.zhifu_n_zhishi(
            self.year,
            self.month,
            self.day,
            self.hour,
            self.minute,
            option).get("值符星宮")[1]
        try:
            zhishi_gong = bidict(earth).inverse[zhishi]
            earth_gong = bidict(earth).inverse["戊"]
            sky_gong = bidict(sky).inverse["丙"]        
            if earth_gong == sky_gong:
                return {"飛鳥跌穴": sky_gong}
            if sky_gong == zhishi_gong:
                return {"飛鳥跌穴": sky_gong}
            else:
                return {"飛鳥跌穴": "沒有"}
        except (KeyError, AttributeError):
            if zhishi_gong == "中":
                return {"飛鳥跌穴": config.zhifu_n_zhishi(
                    self.year,
                    self.month,
                    self.day,
                    self.hour,
                    self.minute,
                    option).get("值符星宮")[1]}
            else:
                return {"飛鳥跌穴": "沒有"}
    def jade_girl(self, option):
        """玉女守門"""
        earth = self.pan_earth(option)
        try:
            earth_gong = bidict(earth).inverse["丁"]
            zhishi = config.zhifu_n_zhishi(
                self.year,
                self.month,
                self.day,
                self.hour,
                self.minute,
                option).get('值使門宮')[1]
            if zhishi == earth_gong:
                return {"玉女守門": zhishi}
            else:
                return {"玉女守門": "沒有"}
        except KeyError:
            return {"玉女守門": "沒有"}

    
    def overall(self, option, school="轉盤"):
        """整體奇門起盤綜合, option 1:拆補 2:置閏;school 轉盤/飛盤(僅時家分量套用,刻家/日家照舊)"""
        return {"金函玉鏡(日家奇門)": self.gpan(),
                "時家奇門": self.pan(option, school),
                "刻家奇門":self.pan_minute(option)}
    


if __name__ == '__main__':
    tic = time.perf_counter()
    #start_datetime = datetime(2024, 5, 1, 0, 0)
    #end_datetime = datetime(2024, 5, 30, 23, 0)  # Adjust as needed
    #print(test_qimen(start_datetime, end_datetime))

    qtext1 = Qimen(2024,1,14,23,20).pan_html(1)
    #qtext1 = Qimen(2024,7,11,18,0).jade_girl(2)
    #q = list("巽離坤震兌艮坎乾")
    #a = [qtext.get("天盤").get(i) for i in q]
    print(qtext1)
    #print(qtext2)
    #print(Qimen(2024,2,2,4,15).pan_earth(2))
    #print(Qimen(2024,2,2,4,15).pan_earth(2))
    toc = time.perf_counter()
    print(f"{toc - tic:0.4f} seconds")
