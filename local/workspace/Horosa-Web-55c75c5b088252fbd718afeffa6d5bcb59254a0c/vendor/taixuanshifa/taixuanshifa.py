# -*- coding: utf-8 -*-
"""
Created on Tue Jan 28 12:43:10 2020
Updated on Tue Sep 5 23:46 2023
@author: Ken Tang
@email: kinyeah@gmail.com
"""

import random, pickle, os, datetime, itertools
import cnlunar
from cn2an import an2cn

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1

def gen_clist(su,num):
    return [su+b for b in [an2cn(str(i)) for i in list(range(num+1))][1:]]

root = os.path.abspath(os.path.dirname(__file__))
data = os.path.join(root, 'data')
taixuandict_path  = os.path.join(root, 'data', 'taixuandict.p')
taixuandict = pickle.load( open( taixuandict_path, "rb" ))
chin_list = list('角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫')
a = new_chinlist = new_list(chin_list, "牛")
b = [8,12,10,17,16,9,16,12,14,11,16,2,9,33,4,15,7,18,18,17,12,9,15,5,5,18,11,26]
cnum = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十', '三十一', '三十二', '三十三']
# 宿名 a 与宿度 b 按位一一对应(牛=8,女=12,…)。宿名唯一、宿度有重复值,
# 故只有「宿名→宿度」是单射;旧 dict(zip(b,a)) 以宿度为键会塌成 16 项、丢 12 宿,
# 致 yearsu 365 度宿带错位。改为按位配对宿名/宿度,逐宿连续铺满 365 度。
c = dict(zip(a, b))
yearsu = list(itertools.chain.from_iterable(gen_clist(a[i], b[i]) for i in range(len(a))))
'甲己子午,乙庚丑未,丙辛寅申,丁壬卯酉,戊癸辰戌,巳亥'
taixuanjiazi = dict(zip(list(map(lambda x: tuple(x),"甲己子午,乙庚丑未,丙辛寅申,丁壬卯酉,戊癸辰戌,巳亥".split(","))), [9,8,7,6,5,4]))

def yy(num):
    if num % 2 == 1:
        return "陽"
    if num % 2 == 0:
        return "陰"

def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None

class Taixuan:
    def __init__(self, year, month, day, hour):
        self.year, self.month, self.day, self.hour = year, month, day, hour

    def jq(self, year, month, day):
        dd = fromSolar(self.year, self.month, self.day) 
        jqmc = ["冬至", "小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "谷雨", "立夏",
             "小滿", "芒種", "夏至", "小暑", "大暑", "立秋", "處暑","白露", "秋分", "寒露", "霜降", 
             "立冬", "小雪", "大雪"]
        while True:
            dd = dd.before(1)
            if dd.hasJieQi():
                return jqmc[dd.getJieQi()]
                break
            
    def getdz_date(self):
        pyear = self.year -1 
        # [X1] 前一年冬至只查该年节气表,与具体日无关;闰日 2/29 在非闰前年不存在 → 钉 28 免 ValueError。
        pday = 28 if (self.month == 2 and self.day == 29) else self.day
        pdz_m_d = cnlunar.Lunar(datetime.datetime(pyear, self.month, pday, self.hour, 0)).thisYearSolarTermsDic.get("冬至")
        pdz = datetime.datetime(pyear, pdz_m_d[0], pdz_m_d[1])
        dz_m_d = cnlunar.Lunar(datetime.datetime(self.year, self.month, self.day, self.hour, 0)).thisYearSolarTermsDic.get("冬至")
        dz = datetime.datetime(self.year, dz_m_d[0], dz_m_d[1])
        currentday = datetime.datetime(self.year, self.month, self.day)
        daydifference = (currentday - dz).days
        if daydifference < 0 :
            return pdz
        else:
            return dz
            
    def getdz(self):
        pyear = self.year -1 
        # [X1] 同 getdz_date:闰日钩 28 免非闰前年 ValueError。
        pday = 28 if (self.month == 2 and self.day == 29) else self.day
        pdz_m_d = cnlunar.Lunar(datetime.datetime(pyear, self.month, pday, self.hour, 0)).thisYearSolarTermsDic.get("冬至")
        pdz = datetime.datetime(pyear, pdz_m_d[0], pdz_m_d[1])
        dz_m_d = cnlunar.Lunar(datetime.datetime(self.year, self.month, self.day, self.hour, 0)).thisYearSolarTermsDic.get("冬至")
        dz = datetime.datetime(self.year, dz_m_d[0], dz_m_d[1])
        currentday = datetime.datetime(self.year, self.month, self.day)
        daydifference = (currentday - dz).days
        if daydifference < 0 :
            return (currentday - pdz).days
        else:
            return daydifference
        
    def qigua_number(self):
        wai_dict = {7:1, 8:2, 9:3}
        shifa_results = []
        shifa_results2 = []
        for i in range(4):
            stalks_first = 36 - 3 - 1 #36策，虛三，掛一
            dividers = sorted(random.sample(range(25, stalks_first), 1))
            two_division  = [a - b for a, b in zip(dividers + [stalks_first+10], [10] + dividers)]
            two_division_left = two_division[0] % 3 
            if two_division_left == 0:
                two_division_left = 3
            two_division_right = two_division[1] % 3 
            if two_division_right == 0:
                two_division_right = 3
            stalks_second = stalks_first - two_division_left - two_division_right
            dividers_second = sorted(random.sample(range(25, stalks_second), 1))
            two_division_second  = [a - b for a, b in zip(dividers_second + [stalks_second+10], [10] + dividers_second)]
            two_division_left_second = two_division_second [0] % 3 
            if two_division_left_second == 0:
                two_division_left_second = 3
            two_division_right_second = two_division_second [1] % 3 
            if two_division_right_second == 0:
                two_division_right_second = 3
            stalks_third = stalks_second - two_division_left_second - two_division_right_second
            wai = stalks_third / 3 
            shifa_results.append(wai_dict.get(wai))
            shifa_results2.append(wai)
        zhan = (shifa_results2[0] + shifa_results2[1] + shifa_results2[2] + shifa_results2[3]) % 9 
        if zhan == 0:
            zhan = 9
        zhou = "".join(str(e) for e in shifa_results[:4])
        return zhou, int(zhan), shifa_results
    
    def pan(self):
        results = self.qigua_number()
        gua_number = int(results[0])
        result = results[2]
        gua_details = taixuandict.get(gua_number)
        gua = gua_details.get("卦")
        #zhan_dict = {1:"初一", 2:"次二", 3:"次三", 4:"次四", 5:"次五", 6:"次六", 7:"次七", 8:"次八", 9:"上九"}
        zhan_number = results[1]
        #zhan = gua_details.get(zhan_number)
        daynightselect = {"旦":["初一","次五","次七"], "夕":["次三","次四","次八"], "日中":["次二","次六","上九"], "夜中":["次二","次六","上九"]}
        divine_yy = {"旦陽":["旦筮陽首","一從二從三從","大休"],
         "日中陰":["日中筮陰首","一從二從三違","始中休終咎"],
         "夜中陰":["夜中筮陰首","一從二從三違","始中休終咎"],
         "夕陰":["夕筮陰首","一違二從三從","始咎中終休"],
        "日中陽":["日中筮陽首","一違二違三從","始中咎終休"],
        "夜中陽":["夜中陽首","一違二違三從","始中咎終休"],
        "夕陽":["夕筮陽首","一從二違三違","始休中終咎"],
        "旦陰":["旦筮陰首","一違二違三違","大咎"]}
        hours = list(range(24))
        currenttime = multi_key_dict_get({tuple(hours[6:12]):"旦", tuple(hours[12:18]):"日中", tuple(hours[18:24]):"夕", tuple(hours[0:6]):"夜中"},self.hour)
        dnn = daynightselect.get(currenttime)
        cnum = {1:"一", 2:"二", 3:"三"}
        cr = [cnum.get(i) for i in result]
        head = "{}方{}州{}部{}家".format(cr[0], cr[1], cr[2], cr[3])
        xzlist = {"一家":1, "二家":2, "三家":3, "一部":0, "二部":3, "三部":6, "一州":0, "二州":9, "三州":18, "一方":0, "二方":27, "三方":54}
        xuan_head = xzlist.get(head[0:2]) + xzlist.get(head[2:4]) + xzlist.get(head[4:6]) + xzlist.get(head[6:8])
        xuan_head_oe = yy(xuan_head)
        head_yy ={"陽":"從", "陰":"違"}.get( xuan_head_oe)
        gb = divine_yy.get( currenttime  + xuan_head_oe)
        zhan = (xuan_head-1) * 9  
        biao = (xuan_head-1) * 3  
        xuan_zan = zhan // 2 
        su = dict(zip(list(range(365)),yearsu)).get(xuan_zan)
        pan1 = "起卦時間︰{}年{}月{}日{}時\n".format(self.year, self.month, self.day, self.hour)
        a = cnlunar.Lunar(datetime.datetime(self.year, self.month, self.day, self.hour, 0))
        pan2 = "農　　曆︰%s年%s%s日\n" % (a.lunarYearCn,  a.lunarMonthCn[:-1], a.lunarDayCn)
        pan3 = "干　　支︰%s年 %s月 %s日 %s時\n" % (a.year8Char, a.month8Char, a.day8Char, a.twohour8Char)
        pan7 = "起筮時段︰{}\n".format(currenttime)
        pan3_1 = "首　　　︰"+ str(list(gua.keys()))[2:][:-2]+"\n"
        pan4 = "方州部家︰"+head+"\n\n"
        yaolist = {"1":"▅▅▅▅▅▅▅▅▅▅\n", "2":"▅▅▅▅  ▅▅▅▅\n", "3":"▅▅  ▅▅  ▅▅\n"}
        pan5 = "".join([yaolist.get(i) for i in str(gua_number)])
        pan6 = "\n玄　　首︰{}，{}\n".format(str(xuan_head), head_yy)
        pan8 = "起筮休咎︰{}，{}\n".format(gb[1], gb[2])
        pan9 = "星　　宿︰{}度\n".format(su)
        pan9_1 = "\n首辭︰{}\n".format(list(gua.values())[0])
        yao_d = [{i:gua_details.get(i)} for i in dnn]
        pan10 = "\n表︰\n"+str(yao_d[0]).replace("'","")[1:][:-1]
        pan11 = "\n"+str(yao_d[1]).replace("'","")[1:][:-1]
        pan12 = "\n"+str(yao_d[2]).replace("'","")[1:][:-1]
        return pan1+pan2+pan3+pan7+pan3_1+pan4+pan5+pan6+pan8+pan9+pan9_1+pan10+pan11+pan12

if __name__ == '__main__':
    print(Taixuan(2023,9,6,15).pan())
   
    
