# -*- coding: utf-8 -*-
"""
Created on Tue May  9 14:14:13 2023

@author: kentang
"""

import re
import os
import pickle
import itertools
from itertools import cycle, repeat, starmap
from datetime import date
import datetime
from .ruler import ruler_data
import cn2an
from cn2an import an2cn
from ephem import Date
from sxtwl import fromSolar, JD2DD
from . import jieqi
from bidict import bidict
# 12「節」(每月之首,逢之換月柱;立春兼換年柱)。其餘12「氣」不換月柱。
JIE_TERMS = {'立春', '驚蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'}

base = os.path.abspath(os.path.dirname(__file__))
path = os.path.join(base, 'data.pkl')
data = pickle.load(open(path, "rb"))
sixtyfourgua = bidict(data.get("數字排六十四卦"))
wangji_gua = dict(zip(range(1,61),"復,頤,屯,益,震,噬嗑,隨,无妄,明夷,賁,既濟,家人,豐,革,同人,臨,損,節,中孚,歸妹,睽,兌,履,泰,大畜,需,小畜,大壯,大有,夬,姤,大過,鼎,恆,巽,井,蠱,升,訟,困,未濟,解,渙,蒙,師,遯,咸,旅,小過,漸,蹇,艮,謙,否,萃,晉,豫,觀,比,剝".split(",")))

cmonth = list("一二三四五六七八九十") + ["十一","十二"]
cnum = list("一二三四五六七八九十")
#干支
tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'

golden_d = re.findall("..","太乙攝提軒轅招搖天符青龍咸池太陰天乙")
#太乙、始擊、四神、天乙、地乙、值符排法
taiyi_pai = "乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽"
sf_list = list("坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午")
four_god = "乾乾乾午午午艮艮艮卯卯卯中中中酉酉酉坤坤坤子子子巽巽巽巳巳巳申申申寅寅寅"
sky_yi = "酉酉酉坤坤坤子子子巽巽巽巳巳巳申申申寅寅寅乾乾乾午午午艮艮艮卯卯卯中中中"
earth_yi = "巽巽巽巳巳巳申申申寅寅寅乾乾乾午午午艮艮艮卯卯卯中中中酉酉酉坤坤坤子子子"
zhi_fu = "中中中酉酉酉坤坤坤子子子巽巽巽巳巳巳申申申寅寅寅乾乾乾午午午艮艮艮卯卯卯"
officer_base = list("巳巳午午午未未未申申申酉酉酉戌戌戌亥亥亥子子子丑丑丑寅寅寅卯卯卯辰辰辰巳")
su_gong = dict(zip(list("子丑艮寅卯辰巽巳午未坤申酉戌乾亥"), list("虛斗牛尾房亢角翼星鬼井參昴婁奎室")))
#文昌陰陽七十二局分析
skyeyes_summary = {"陽":",始擊擊,,內迫,,,辰迫,,囚,,囚,,,,,,囚,囚,客挾,,,,,,,,囚,囚,始擊擊,,,始擊擊,始擊掩,始擊掩,,,,囚,辰迫,,客挾,客挾,囚,客挾,宮迫,,主挾，宮迫,辰迫,,,,主挾，辰迫,宮迫,宮迫,始擊掩,,,,客挾,,,,,,主挾,辰擊,,始擊掩,始擊擊,始擊擊,囚,始擊擊".split(","),
      "陰":",內辰迫,外辰迫,內辰擊,,,外宮迫,掩、辰迫,掩,掩、辰迫,掩、囚,內宮迫,內宮擊,,,掩、外辰迫,掩,掩,,關客,關客,關客,,外宮擊,,,外宮擊,,,,內宮擊,,關主,關客,,,外辰迫,掩,內辰迫,關客,內辰擊,,掩,內辰迫,內宮迫,掩,外宮迫,外宮迫,外宮擊,內宮擊,,內辰迫,外辰擊,掩,關主,,,外宮擊,掩,內宮擊,內宮迫,外宮擊,,內宮擊,,,,,,,,,".split(",")}
su = list('角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫')
num =  [8,3,4,9,2,7,6,1]
su = list('角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫')
#干支
Gan,Zhi = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
#間辰
jc = list("丑寅辰巳未申戌亥")
door = list("開休生傷杜景死驚")
jc1 = list("巽艮坤乾")
tyjc = [1,3,7,9]
#十六神
sixteen = "子丑艮寅卯辰巽巳午未坤申酉戌乾亥"
sixteengod = dict(zip(re.findall("..", "地主陽德和德呂申高叢太陽大炅大神大威天道大武武德太簇陰主陰德大義"), "子丑艮寅卯辰巽巳午未坤申酉戌乾亥"))
#陰陽遁定制

cheungsun = dict(zip(list("木火金水土"),list("亥寅巳申申")))
five_elements = dict(zip(re.findall('..', '太乙天乙地乙始擊文昌主將主參客將客參'), list("木火土火土金水水木")))
gong = dict(zip(list("子丑艮寅卯辰巽巳午未坤申酉戌乾亥"), range(1,17)))
gong1 = list("子丑艮寅卯辰巽巳午未坤申酉戌乾亥")
gong2 = dict(zip(list("亥子丑艮寅卯辰巽巳午未坤申酉戌乾"), [8,8,3,3,4,4,9,9,2,2,7,7,6,6,1,1]))
gong3 = list("子丑艮寅卯辰巽巳中午未坤申酉戌乾亥")
wuxing = "火水金火木金水土土木,水火火金金木土水木土,火火金金木木土土水水,火木水金木水土火金土,木火金水水木火土土金"
wuxing_relation_2 = dict(zip(list(map(lambda x: tuple(re.findall("..",x)), wuxing.split(","))), "尅我,我尅,比和,生我,我生".split(",")))
nayin = "甲子乙丑壬申癸酉庚辰辛巳甲午乙未壬寅癸卯庚戌辛亥,丙寅丁卯甲戌乙亥戊子己丑丙申丁酉甲辰乙巳戊午己未,戊辰己巳壬午癸未庚寅辛卯戊戌己亥壬子癸丑庚申辛酉,庚午辛未戊寅己卯丙戌丁亥庚子辛丑戊申己酉丙辰丁巳,甲申乙酉丙子丁丑甲寅乙卯丙午丁未壬戌癸亥壬辰癸巳".split(",")
nayin_wuxing = dict(zip([tuple(re.findall("..", i)) for i in nayin], list("金火木土水")))
wangjigua="小畜䷈,大壯䷡,大有䷍,夬䷪,姤䷫,大過䷛,鼎䷱,恆䷟,巽䷸,井䷯,蠱䷑,升䷭,訟䷅,困䷮,未濟䷿,解䷧,渙䷺,蒙䷃,師䷆,遯䷠,咸䷞,旅䷷,小過䷽,漸䷴,蹇䷦,艮䷳,謙䷎,否䷋,萃䷬,晉䷢,豫䷏,觀䷓,比䷇,剝䷖,復䷗,頤䷚,屯䷂,益䷩,震䷲,噬嗑䷔,隨䷐,无妄䷘,明夷䷣,賁䷕,既濟䷾,家人䷤,豐䷶,革䷰,同人䷌,臨䷒,損䷨,節䷻,中孚䷼,歸妹䷵,睽䷥,兌䷹,履䷉,泰䷊,大畜䷙,需䷄".split(",")
ynum = list(range(-2397,4000))
ynum.remove(0)
wangji_yeargua = dict(zip( ynum,cycle(wangjigua)))
gua = dict(zip(range(1,65),"乾䷀,坤䷁,屯䷂,蒙䷃,需䷄,訟䷅,師䷆,比䷇,小畜䷈,履䷉,泰䷊,否䷋,同人䷌,大有䷍,謙䷎,豫䷏,隨䷐,蠱䷑,臨䷒,觀䷓,噬嗑䷔,賁䷕,剝䷖,復䷗,无妄䷘,大畜䷙,頤䷚,大過䷛,坎䷜,離䷝,咸䷞,恆䷟,遯䷠,大壯䷡,晉䷢,明夷䷣,家人䷤,睽䷥,蹇䷦,解䷧,損䷨,益䷩,夬䷪,姤䷫,萃䷬,升䷭,困䷮,井䷯,革䷰,鼎䷱,震䷲,艮䷳,漸䷴,歸妹䷵,豐䷶,旅䷷,巽䷸,兌䷹,渙䷺,節䷻,中孚䷼,小過䷽,既濟䷾,未濟䷿".split(",")))
gzzm ={"甲":{"朝":"小吉", "暮":"大吉"}, 
         tuple(list("戊庚")): {"朝":"大吉", "暮":"小吉"},
        "己":{"朝":"神后", "暮":"傳送"}, "乙":{"朝":"傳送", "暮":"神后"}, 
        "丁":{"朝":"登明", "暮":"從魁"}, "丙":{"朝":"從魁", "暮":"登明"}, 
        "癸":{"朝":"太乙", "暮":"太衝"}, "壬":{"朝":"太衝", "暮":"太乙"}, 
        "辛":{"朝":"功曹", "暮":"勝光"}}
zm = {tuple(list("卯辰巳午未申")):"朝", tuple(list("酉戌亥子丑寅")):"暮"}
tz = "登明,河魁,從魁,傳送,小吉,勝光,太乙,天罡,太衝,功曹,大吉,神後".split(",")
skyeyes_dict = {
    "陽" : list("申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤"),
    "陰" : list("寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮")}

epochdict = dict(zip([
            ('甲子', '甲午', '乙丑', '乙未', '丙寅', '丙申', '丁卯', '丁酉', '戊辰', '戊戌'),
            ('己巳', '己亥', '庚午', '庚子', '辛未', '辛丑', '壬申', '壬寅', '癸酉', '癸卯'),
            ('甲戌', '甲辰', '乙亥', '乙巳', '丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申'),
            ('己卯', '己酉', '庚辰', '庚戌', '辛巳', '辛亥', '壬午', '壬子', '癸未', '癸丑'),
            ('甲申', '甲寅', '乙酉', '乙卯', '丙戌', '丙辰', '丁亥', '丁巳', '戊子', '戊午'),
            ('己丑', '己未', '庚寅', '庚申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥')],  list("一二三四五六")))

jiyuan_dict = dict(zip([('甲子', '甲午', '乙丑', '乙未', '丙寅', '丙申', '丁卯', '丁酉', '戊辰', '戊戌', '己巳', '己亥'),
                ('庚午', '庚子', '辛未', '辛丑', '壬申', '壬寅', '癸酉', '癸卯', '甲戌', '甲辰', '乙亥', '乙巳'),
                ('丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '己卯', '己酉', '庚辰', '庚戌', '辛巳', '辛亥'),
                ('壬午', '壬子', '癸未', '癸丑', '甲申', '甲寅', '乙酉', '乙卯', '丙戌', '丙辰', '丁亥', '丁巳'),
                ('戊子', '戊午', '己丑', '己未', '庚寅', '庚申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥')], "甲子,丙子,戊子,庚子,壬子".split(",")))
numdict = {1: "雜陰", 2: "純陰", 3: "純陽", 4: "雜陽", 6: "純陰", 7: "雜陰",
           8: "雜陽", 9: "純陽", 11: "陰中重陽", 12: "下和", 13: "雜重陽",
           14: "上和", 16: "下和", 17: "陰中重陽", 18: "上和", 19: "雜重陽",
           22: "純陰", 23: "次和", 24: "雜重陰", 26: "純陰", 27: "下和",
           28: "雜重陰", 29: "次和", 31: "雜重陽", 32: "次和", 33: "純陽",
           34: "下和", 37: "雜重陽", 38: "下和", 39: "純陽"}

# 主客定算立成表:阳局/阴局立成预算值(含经纬·计神迫修正),返回 [主算, 客算, 定算]。
# byte-perfect——任何改动须重生成 golden(同主限法纪律)。
def find_cal(yingyang, num):
    yangcal =[[7,13,13],[6,1,1],[1,40,32],[25,17,10],[25,14,1],[25,10,12],[8,25,9],[1,22,3],[3,15,33],[1,12,25],[4,4,13],[37,1,4],[18,19,19],[10,9,9],[9,7,6],[1,33,26],[7,27,16],[7,26,11],[8,32,14],[7,26,2],[2,17,33],[16,30,1],[16,23,32],[16,17,23],[39,40,40],[32,31,31],[31,28,31],[14,9,38],[13,39,26],[10,32,17],[33,10,34],[25,8,24],[24,3,15],[26,4,11],[25,28,1],[25,27,36],[1,7,7],[6,35,35],[35,34,26],[27,19,12],[27,16,3],[27,12,34],[8,17,1],[23,14,32],[32,7,25],[5,16,29],[4,8,17],[1,5,8],[24,25,25],[16,15,15],[15,13,6],[39,31,24],[38,25,14],[38,24,9],[16,3,22],[15,34,10],[10,25,10],[12,26,27],[12,19,28],[12,13,19],[33,34,34],[26,25,25],[25,22,18],[16,11,7],[15,1,28],[12,34,19],[25,2,26],[17,8,16],[16,32,7],[30,4,15],[29,32,5],[29,31,9]]
    yingcal = [[5,29,7],[4,17,1],[1,16,30],[25,33,2],[25,30,1],[17,26,10],[2,3,3],[1,7,7],[7,33,27],[1,24,25],[6,26,19],[35,23,8],[12,37,12],[12,27,11],[11,25,4],[1,15,24],[3,9,16],[3,8,9],[14,16,16],[13,10,10],[10,1,39],[24,14,1],[24,7,40],[16,1,29],[31,16,32],[30,7,29],[29,4,26],[8,25,32],[7,15,26],[2,8,15],[27,28,28],[27,26,26],[26,18,15],[29,22,9],[25,10,1],[25,9,34],[1,25,3],[4,13,37],[37,12,26],[33,1,10],[33,38,9],[25,34,38],[2,1,1],[39,38,38],[38,31,25],[7,1,31],[6,32,25],[1,29,14],[16,1,17],[16,31,15],[15,29,4],[33,7,16],[32,1,8],[32,8,1],[16,18,18],[15,12,12],[12,3,1],[18,8,35],[18,1,34],[10,35,25],[27,22,28],[26,3,25],[25,4,12],[16,33,3],[15,23,34],[10,16,23],[25,26,26],[25,24,24],[24,16,13],[32,28,15],[31,16,7],[31,15,1]]
    yy = {"陰":yingcal ,"陽":yangcal}.get(yingyang)
    return dict(zip(list(range(1,73)), yy)).get(num)
      
gua_yao_years = {
 '乾':[36,36,36,36,36,36],
 '坤':[24,24,24,24,24,24],
 '否':[24,24,24,36,36,36],
 '泰':[36,36,36,24,24,24],
 '震':[36,24,24,36,24,24],
 '巽':[24,36,36,24,36,36],
 '恆':[24,36,36,36,24,24],
 '益':[36,24,24,24,36,36],
 '坎':[24,36,24,24,36,24],
 '離':[36,24,36,36,24,36],
 '既濟':[36,24,36,24,36,24],
 '未濟':[24,36,24,36,24,36],
 '艮':[24,24,36,24,24,36],
 '兌':[36,36,24,36,36,24],
 '損':[36,36,24,24,24,36],
 '咸':[24,24,36,36,36,24],
 '大壯':[36,36,36,36,24,24],
 '無妄':[36,24,24,36,36,36],
 '需':[36,36,36,24,36,24],
 '訟':[24,36,24,36,36,36],
 '大畜':[36,36,36,24,24,36],
 '遯':[24,24,36,36,36,36],
 '觀':[24,24,24,24,36,36],
 '升':[24,36,36,24,24,24],
 '晉':[24,24,24,36,24,36],
 '明夷':[36,24,36,24,24,24],
 '萃':[24,24,24,36,36,24],
 '臨':[36,36,24,24,24,24],
 '豫':[24,24,24,36,24,24],
 '復':[36,24,24,24,24,24],
 '比':[24,24,24,24,36,24],
 '師':[24,36,24,24,24,24],
 '剝':[24,24,24,24,24,36],
 '謙':[24,24,36,24,24,24],
 '小畜':[36,36,36,24,36,36],
 '姤':[24,36,36,36,36,36],
 '同人':[36,24,36,36,36,36],
 '大有':[36,36,36,36,24,36],
 '夬':[36,36,36,36,36,24],
 '履':[36,36,24,36,36,36],
 '解':[24,36,24,36,24,24],
 '屯':[36,24,24,24,36,24],
 '小過':[24,24,36,36,24,24],
 '頤':[36,24,24,24,24,36],
 '家人':[36,24,36,24,36,36],
 '鼎':[24,36,36,36,24,36],
 '中孚':[36,36,24,24,36,36],
 '大過':[24,36,36,36,36,24],
 '豐':[36,24,36,36,24,24],
 '噬嗑':[36,24,24,36,24,36],
 '歸妹':[36,36,24,36,24,24],
 '隨':[36,24,24,36,36,24],
 '節':[36,36,24,24,36,24],
 '困':[24,36,24,36,36,24],
 '渙':[24,36,24,24,36,36],
 '井':[24,36,36,24,36,24],
 '漸':[24,24,36,24,36,36],
 '蠱':[24,36,36,24,24,36],
 '旅':[24,24,36,36,24,36],
 '賁':[36,24,36,24,24,36],
 '蹇':[24,24,36,24,36,24],
 '蒙':[24,36,24,24,24,36],
 '睽':[36,36,24,36,24,36],
 '革':[36,24,36,36,36,24]}

tygua = "乾,坤,否,泰,震,巽,恆,益,坎,離,既濟,未濟,艮,兌,損,咸,大壯,無妄,需,訟,大畜,遯,觀,升,晉,明夷,萃,臨,豫,復,比,師,剝,謙,小畜,姤,同人,大有,夬,履,解,屯,小過,頤,家人,鼎,中孚,大過,豐,噬嗑,歸妹,隨,節,困,渙,井,漸,蠱,旅,賁,蹇,蒙,睽,革".split(",")
tygua_years = [216,144,180,180,168,192,180,180,168,192,180,180,168,192,180,180,192,192,192,192,192,192,168,168,168,168,168,168,156,156,156,156,156,156,204,204,204,204,204,204,168,168,168,168,192,192,192,192,180,180,180,180,180,180,180,180,180,180,180,180,168,168,192,192]
tygua_yun =  "天地否泰之運,男女交親之運,陽晶守政之運,陰毳權衡之運,資育還本之運,造化符天之運,剛中健至之運,德義順命之運,德義順命之運,惑妬留天之運,寡陽相博之運,物極元終之運".split(",")
tygua_dict = dict(zip(tygua, tygua_years))
year_for_gua = [-1197,-981,-837,-657,-477,-309,-117,64,244,412,604,784,964,1132,1324,1504,1684,1876,2068,2260,2452,2644,2836,3004,3172,3340,3508,3676,3844,4000,4156,4312,4468,4624,4780,4984,5188,5392,5596,5800,6004,6172,6340,6508,6676,6868,7060,7252,7444,7624,7804,7984,8164,8344,8524,8704,8884,9064,9244,9424,9604,9772,9940,10132]
year_rep_gua = dict(zip(year_for_gua,tygua))


def calculate_value_for_year(year):
    initial_value = 126944450
    increment_per_60_years = 3145500
    cycles = (year - 1564) // 60
    value = initial_value + cycles * increment_per_60_years
    return value

#%% 基本功能函數
def sumlist(list1):
    list2 = []
    total_sum = 0
    for item in list1:
        total_sum += item
        list2.append(total_sum)
    return list2

def genyao(a):
    if a[0] == 36:
        b = "初九"
    if a[0] == 24:
        b = "初六"
    if a[1] == 36:
        c = "九二"
    if a[1] == 24:
        c = "六二"
    if a[2] == 36:
        d = "九三"
    if a[2] == 24:
        d = "六三"
    if a[3] == 36:
        e = "九四"
    if a[3] == 24:
        e = "六四"
    if a[4] == 36:
        f = "九五"
    if a[4] == 24:
        f = "六五"
    if a[5] == 36:
        g = "上九"
    if a[5] == 24:
        g = "上六"
    return [b,c,d,e,f,g]

#農曆
def lunar_date_d(year, month, day):
    lunar_m = ['占位', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    day = fromSolar(year, month, day)
    return {"年":day.getLunarYear(),
            "農曆月": lunar_m[int(day.getLunarMonth())],
            "月":day.getLunarMonth(),
            "日":day.getLunarDay()}
#旬
def liujiashun_dict():
    return dict(zip(list(map(lambda x: tuple(x), list(map(lambda x:new_list(jiazi(), x)[0:10] ,jiazi()[0::10])))), jiazi()[0::10]))


def closest(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))]

def closest1(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))-1]

def closest2(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))+1]

def find_gua(year):
    a = closest(year_for_gua, year)
    b = closest1(year_for_gua, year)
    if year > a and year > b:
        year_point = max(a,b)
    if year == a:
        year_point = a
    if year < a:
        year_point = b
    year_gua = year_rep_gua.get(year_point)
    y = gua_yao_years.get( year_gua )
    yao_list2 = sumlist(y)
    yao = genyao(y)
    year_diff = year - year_point
    yao_index = yao_list2.index(closest(yao_list2, year_diff))
    return year_gua + "之" + yao[yao_index]

def divide(num, division_num):
    if not isinstance(num, int) or num <= 0:
        return "請輸入一個正整數"
    while num % division_num == 0:
        num = num // division_num
    return num

def change(g, yao):
    g = list(g)
    y = {6: 5, 5: 4, 4: 3, 3: 2, 2: 1, 1: 0}.get(yao)
    if g[y] == "7":
        a = "8"
    if g[y] == "8":
        a = "7"
    return "".join([a if i == y else g[i] for i in range(len(g))])
      
def wanji_four_gua(year, month, day, hour, minute):
    ygz = gangzhi(year, month, day, hour, minute)[0]
    if year < 0:
        acum_year = 67017 + year + 1
    else:
        acum_year = 67017 + year #積年數
    hui  = acum_year // 10800 +1 #會
    yun = acum_year // 360 +1  #運
    shi = acum_year // 30 + 1 #世
    main_gua = wangji_gua.get(int(round((acum_year / 2160), 0)))#
    mys = list(sixtyfourgua.inverse[main_gua][0].replace("6","8").replace("9","7"))
    if yun % 6 == 0:
        yun_gua_yao = 6
    else:
        yun_gua_yao = yun % 6
    mys1 = change(mys, yun_gua_yao)
    yungua = multi_key_dict_get(sixtyfourgua, mys1)
    shi_yao = shi // 2 % 6  
    shis1 = change(mys1, shi_yao)
    shigua = multi_key_dict_get(sixtyfourgua, change(mys1, shi_yao))
    shi_shun = dict(zip("甲子,甲戌,甲申,甲午,甲辰,甲寅".split(","),range(1,7)))
    shun_yao = shi_shun.get(multi_key_dict_get(liujiashun_dict(), ygz))
    shungua1 = change(shis1,shun_yao)
    shun_gua = multi_key_dict_get(sixtyfourgua, shungua1)
    jiazi_years = [4 - 60 * i for i in range(52)]+[4 + 60 * i for i in range(52)]
    if year < 0:
        close_jiazi_year = closest2(jiazi_years, year)
    else:
        close_jiazi_year = closest1(jiazi_years, year)
    yeargua = dict(zip(list(range(close_jiazi_year, close_jiazi_year+60)), new_list(list(wangji_gua.values()), shigua))).get(year)
    return {"會":hui, "運":yun, "世":shi, "運卦動爻":yun_gua_yao, "世卦動爻": shi_yao, "旬卦動爻":shun_yao ,"正卦":main_gua, "運卦":yungua, "世卦":shigua, "旬卦":shun_gua, "年卦":yeargua } 

def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1

def gendatetime(year, month, day, hour, minute):
    return "{}年{}月{}日{}時{}分".format(year, month, day, hour, minute)

def repeat_list(n, thelist):
    return [repetition for i in thelist for repetition in repeat(i,n)]

def num2gong(num):
    return dict(zip(range(1,10), list("乾午艮卯中酉坤子巽"))).get(num)
      
def num2gong_life(num):
    return dict(zip(range(1,10), list("乾午艮卯辰酉坤子巽"))).get(num)

def taiyi_name(ji_style):
    return {0:"年計", 1:"月計", 2:"日計", 3:"時計", 4:"分計"}.get(ji_style)

def ty_method(taiyi_acumyear):
    return  {0:"太乙統宗", 1:"太乙金鏡", 2:"太乙淘金歌", 3:"太乙局", 4: "太乙淘金歌時計捷法"}.get(taiyi_acumyear)

def cal_des(num):
    tnum = []
    if num > 10 and num % 10 > 5:
        tnum.append("三才足數")
    if num < 10:
        tnum.append("無天，二曜虛蝕、五緯失度、慧孛飛流、霜雹為害")
    if num % 10 < 5:
        tnum.append("無地，有崩地震、川竭蝗蝻之象")
    if num % 10 == 0:
        tnum.append("無人，口舌妖言更相殘賊，疾疫、遷移、流亡")
    tnum.append(numdict.get(num, None))
    return [i for i in tnum if i is not None]
#%% 甲子平支
def jiazi():
    Gan, Zhi = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
    return list(map(lambda x: "{}{}".format(Gan[x % len(Gan)], Zhi[x % len(Zhi)]), list(range(60))))

#太乙人道命法的積年數
def jiazi_accum(gz):
    return dict(zip(jiazi(), [i*3652425 for i in list(range(1,61))])).get(gz)

def jq_accum(jq):
    return dict(zip(new_list(jieqi.jieqi_name, "冬至"), [3652425,152184.37,304368.75,456553.12,608727.50,760921.87,913106.25,1065290.62,1217475,1369659.37,1522843.75,1674028.12,1826212.50,1978396.87,2130581.25,2282765.62,2434950,2587134.37,2739318.75,2891503.12,3043687.50,3195871.87,3348056.25,3500240.62])).get(jq)

def Ganzhiwuxing(gangorzhi):
    ganzhiwuxing = dict(zip(list(map(lambda x: tuple(x),"甲寅乙卯震巽,丙巳丁午離,壬亥癸子坎,庚申辛酉乾兌,未丑戊己未辰戌艮坤".split(","))), list("木火水金土")))
    return multi_key_dict_get(ganzhiwuxing, gangorzhi)

def calculateAge(birthDate):
    today = datetime.date.today()
    age = today.year - birthDate.year -((today.month, today.day) <(birthDate.month, birthDate.day))
    return age

def Ganzhi_num(gang):
    num = dict(zip(list(map(lambda x: tuple(x),"甲己,乙庚,丙辛,丁壬,戊癸".split(","))), [5,4,1,3,2]))
    return multi_key_dict_get(num, gang)

def Ganzhi_place(gang):
    place = dict(zip(list(map(lambda x: tuple(x),"甲己,乙庚,丙辛,丁壬,戊癸".split(","))), list("午巳申亥寅")))
    return multi_key_dict_get(place, gang)

def generate_ranges(start, n, num_ranges):
    ranges = []
    a = start
    for i in range(num_ranges):
        end = start + n - 1
        ranges.append(f"{start+1}-{end+1}")
        start = end + 1  # The next range starts right after the current end
    return ["1-{}".format(a)]+ranges

def gangzhi_to_num(gangorzhi):
    return dict(zip("金木水火土", [13,11,7,9,15])).get(Ganzhiwuxing(gangorzhi))

def element_to_num(element):
    return dict(zip("金木水火土", [13,11,7,9,15])).get(element)

def find_wx_relation(zhi1, zhi2):
    return multi_key_dict_get(wuxing_relation_2, Ganzhiwuxing(zhi1) + Ganzhiwuxing(zhi2))

#換算干支
def gangzhi1(year, month, day, hour, minute):
    # 全年份域:域外走全域回退(见 _gangzhi_extreme;返回同形五元)
    if year < 1 or year > 9999:
        return _gangzhi_extreme(year, month, day, hour, minute)
    # v2.2.1: 共享 jieqi.py 的 thread-local 开关
    from . import jieqi as _jq_module
    _after23 = _jq_module._get_after23()
    _hour_gan_next = _jq_module._get_hour_gan_next()
    if hour == 23 and _after23:
        d = Date(round((Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2), str(0).zfill(2)))), 3))
    else:
        d = Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2) ))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz]), "{}{}".format(tian_gan[cdate.getMonthGZ().tg],di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz]), "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    # v2.2.1: hour==23 时按 lateZi 重写时柱(其它 22 小时 NO-OP)
    # lateZi=1(默认):时干始终用次日日干。lateZi=0:跟随日柱所在 cdate 的日干(==跟日柱一致)。
    _has_late_override = False
    if hour == 23:
        _has_late_override = True
        if _hour_gan_next:
            if _after23:
                day_tg_idx = cdate.getDayGZ().tg
            else:
                d_next = Date(round((Date("{}/{}/{} 00:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2)))), 3))
                dd_next = list(d_next.tuple())
                day_tg_idx = fromSolar(dd_next[0], dd_next[1], dd_next[2]).getDayGZ().tg
        else:
            # lateZi=0: 跟日柱一致
            day_tg_idx = cdate.getDayGZ().tg
        hTG = tian_gan[(day_tg_idx % 5 * 2 + 0) % 10] + di_zhi[0]
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _has_late_override:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]
#金函玉鏡
def gpan(year, month, day, hour, minute):
    j_q = jieqi.jq(year,
                month,
                day,
                hour,
                minute)
    dgz = gangzhi(year,
                     month,
                     day,
                     hour,
                     minute)[2]
    dh = multi_key_dict_get({tuple(new_list(jieqi.jieqi_name, "冬至")[0:12]):"冬至",
                             tuple(new_list(jieqi.jieqi_name, "夏至")[0:12]):"夏至"},j_q)
    eg = "坎坤震巽乾兌艮離"
    eight_gua = list("坎坤震巽中乾兌艮離")
    clockwise_eightgua = list("坎艮震巽離坤兌乾")
    door_r = list("休生傷杜景死驚開")
    yy = {"冬至":"陽遁", "夏至":"陰遁"}.get(dh)
    ty_doors = {"冬至": dict(zip(jiazi(),itertools.cycle(list("艮離坎坤震巽中乾兌")))), 
            "夏至": dict(zip(jiazi(),itertools.cycle(list("坤坎離艮兌乾中巽震"))))}
    gong = ty_doors.get(dh).get(dgz)
    rotate_order = {"陽遁":eight_gua, "陰遁":list(reversed(eight_gua))}.get(yy)
    a_gong = new_list(rotate_order, gong)
    star_pai = dict(zip(a_gong, golden_d))
    triple_list = list(map(lambda x: x + x + x, list(range(0,21))))
    b = list(starmap(lambda start, end: tuple(jiazi()[start:end]),  zip(triple_list[:-1], triple_list[1:])))
    rest_door_settings = {"陽遁":dict(zip(b, itertools.cycle(eg))),
                          "陰遁":dict(zip(b, itertools.cycle(list(reversed(eg)))))}.get(yy)
    rest = multi_key_dict_get(rest_door_settings, dgz)
    the_doors = {"陽遁": dict(zip(new_list(clockwise_eightgua, rest), door_r)), 
                 "陰遁": dict(zip(new_list(list(reversed(clockwise_eightgua)), rest), door_r))}.get(yy)
    return {"門":the_doors, "星":star_pai}

def gpan1(year, month, day, hour, minute):
    d = gpan(year, month, day, hour, minute)
    pan_eg = new_list( list("坎艮震巽離坤兌乾"), "離")
    door = [d.get("門").get(i) for i in pan_eg]
    star = [d.get("星").get(i) for i in pan_eg]
    middle = ["中",d.get("星").get("中")]
    return [middle, [[a, b, f'{c}門'] for a, b, c in zip(pan_eg, star, door)]]

#換算干支
def _gangzhi_extreme(year, month, day, hour, minute):
    """全年份域四柱回退(共享件 kin_year_domain,口径与主链一致);分柱沿本引擎表。"""
    from . import jieqi as _jq_module
    from kin_year_domain import extreme_pillars
    yTG, mTG, dTG, hTG, zi = extreme_pillars(
        year, month, day, hour, minute,
        after23=_jq_module._get_after23(), hour_gan_next=_jq_module._get_hour_gan_next())
    gangzhi_minute = minutes_jiazi_d(zi).get(str(hour) + ":" + str(minute))
    return [yTG, mTG, dTG, hTG, gangzhi_minute]


def gangzhi(year, month, day, hour, minute):
    # 全年份域:公元前/万年后走全域回退(与主链口径一致);域内 sxtwl 原路径零变。
    if year < 1 or year > 9999:
        return _gangzhi_extreme(year, month, day, hour, minute)
    # v2.2.1: 共享 jieqi.py 的 thread-local 开关
    from . import jieqi as _jq_module
    _after23 = _jq_module._get_after23()
    _hour_gan_next = _jq_module._get_hour_gan_next()
    if year == 0:
        return ["無效"]
    if year < 0:
        year = year + 1
    if hour == 23 and _after23:
        d = Date(round((Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2), str(0).zfill(2)))), 3))
    else:
        d = Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2) ))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz]), "{}{}".format(tian_gan[cdate.getMonthGZ().tg],di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz]), "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    # v2.2.1: hour==23 时按 lateZi 重写时柱(其它 22 小时 NO-OP)
    # lateZi=1(默认):时干始终用次日日干。lateZi=0:跟随日柱所在 cdate 的日干(==跟日柱一致)。
    _has_late_override = False
    if hour == 23:
        _has_late_override = True
        if _hour_gan_next:
            if _after23:
                day_tg_idx = cdate.getDayGZ().tg
            else:
                d_next = Date(round((Date("{}/{}/{} 00:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2)))), 3))
                dd_next = list(d_next.tuple())
                day_tg_idx = fromSolar(dd_next[0], dd_next[1], dd_next[2]).getDayGZ().tg
        else:
            # lateZi=0: 跟日柱一致
            day_tg_idx = cdate.getDayGZ().tg
        hTG = tian_gan[(day_tg_idx % 5 * 2 + 0) % 10] + di_zhi[0]
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    # 月柱按精確交節時刻校正(同 kinqimen):當日交「節」且給定時刻早於精確交節 → 沿用前一日月柱(立春兼校年柱)
    if year >= 1900:
        _sd = fromSolar(year, month, day)
        if _sd.hasJieQi() and jieqi.jqmc[_sd.getJieQi() - 1] in JIE_TERMS:
            _t = JD2DD(_sd.getJieQiJD())
            _crossing = datetime.datetime(_t.Y, _t.M, _t.D, int(_t.h), round(_t.m))
            if datetime.datetime(year, month, day, hour, minute) < _crossing:
                _prev = _sd.before(1)
                mTG1 = tian_gan[_prev.getMonthGZ().tg] + di_zhi[_prev.getMonthGZ().dz]
                if jieqi.jqmc[_sd.getJieQi() - 1] == '立春':
                    yTG = tian_gan[_prev.getYearGZ().tg] + di_zhi[_prev.getYearGZ().dz]
    if _has_late_override:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0)[3]
    hourminute = str(hour)+":"+str(minute)
    gangzhi_minute = minutes_jiazi_d(zi).get(hourminute)
    return [yTG, mTG1, dTG, hTG1, gangzhi_minute]

#五虎遁，起正月
def find_lunar_month(year):
    fivetigers = {
    tuple(list('甲己')):'丙寅',
    tuple(list('乙庚')):'戊寅',
    tuple(list('丙辛')):'庚寅',
    tuple(list('丁壬')):'壬寅',
    tuple(list('戊癸')):'甲寅'
    }
    if multi_key_dict_get(fivetigers, year[0]) == None:
        result = multi_key_dict_get(fivetigers, year[1])
    else:
        result = multi_key_dict_get(fivetigers, year[0])
    return dict(zip(range(1,13),new_list(jiazi(), result)[:12]))

#五鼠遁，起子時
def find_lunar_hour(day):
    fiverats = {
    tuple(list('甲己')):'甲子',
    tuple(list('乙庚')):'丙子',
    tuple(list('丙辛')):'戊子',
    tuple(list('丁壬')):'庚子',
    tuple(list('戊癸')):'壬子'
    }
    if multi_key_dict_get(fiverats, day[0]) == None:
        result = multi_key_dict_get(fiverats, day[1])
    else:
        result = multi_key_dict_get(fiverats, day[0])
    return dict(zip(list(di_zhi), new_list(jiazi(), result)[:12]))
#五狗遁，起子時
def find_lunar_minute(hour):
    fivedogs = {
    tuple(list('甲己')):'甲戌',
    tuple(list('乙庚')):'丙戌',
    tuple(list('丙辛')):'戊戌',
    tuple(list('丁壬')):'庚戌',
    tuple(list('戊癸')):'壬戌'
    }
    if multi_key_dict_get(fivedogs, hour[0]) == None:
        result = multi_key_dict_get(fivedogs, hour[1])
    else:
        result = multi_key_dict_get(fivedogs, hour[0])
    return new_list(jiazi(), result)
#分干支
def minutes_jiazi_d(hour):
    t = [f"{h}:{m}" for h in range(24) for m in range(60)]
    minutelist = dict(zip(t, cycle(repeat_list(1, find_lunar_minute(hour)))))
    return minutelist
#農曆
def lunar_date_d(year, month, day):
    day = fromSolar(year, month, day)
    return {"年":day.getLunarYear(),  "月": day.getLunarMonth(), "日":day.getLunarDay()}

#五子元局數
def five_zi_yuan(taiyiju, gangzhi):
    a =["甲子","丙子","戊子","庚子","壬子"]
    b = [1,73,145,217,289]
    c = [(new_list(jiazi(),i)*2)[0:72] for  i in a]
    d = [new_list(list(range(i, i+72)), i) for i in b]
    return an2cn(dict(zip([c[i][taiyiju-1] for i in range(0,5)], [d[i][taiyiju-1] for i in range(0,5)])).get(gangzhi)) + "局"
#分計五子元
#五子元局數
def min_five_zi_yuan(taiyiju, gangzhi):
    if gangzhi[1] == "戌":
        gz = gangzhi.replace("戌","申")
    if gangzhi[1] == "子":
        gz = gangzhi.replace("子","戌")
    if gangzhi[1] == "丑":
        gz = gangzhi.replace("丑","亥")
    if gangzhi[1] == "寅":
        gz = gangzhi.replace("寅","子") 
    if gangzhi[1] == "卯":
        gz = gangzhi.replace("卯","丑") 
    if gangzhi[1] == "辰":
        gz = gangzhi.replace("辰","寅")
    if gangzhi[1] == "巳":
        gz = gangzhi.replace("巳","卯")
    if gangzhi[1] == "午":
        gz = gangzhi.replace("午","辰")
    if gangzhi[1] == "未":
        gz = gangzhi.replace("未","巳")
    if gangzhi[1] == "申":
        gz = gangzhi.replace("申","午")
    if gangzhi[1] == "酉":
        gz = gangzhi.replace("酉","未")
    #if gangzhi[1] == "戌":
    #    gz = gangzhi.replace("午","辰")
    if gangzhi[1] == "亥":
        gz = gangzhi.replace("亥","酉")
    a =["甲子","丙子","戊子","庚子","壬子"]
    b = [1,73,145,217,289]
    c = [(new_list(jiazi(),i)*2)[0:72] for  i in a]
    d = [new_list(list(range(i, i+72)), i) for i in b]
    #return dict(zip([c[i][taiyiju-2] for i in range(0,5)], [d[i][taiyiju-1] for i in range(0,5)]))
    return an2cn(dict(zip([c[i][taiyiju-2] for i in range(0,5)], [d[i][taiyiju-1] for i in range(0,5)])).get(gz)) + "局"

def five_zi_yuan1(taiyiju):
    a =["甲子","丙子","戊子","庚子","壬子"]
    b = [1,73,145,217,289]
    c = [(new_list(jiazi(),i)*2)[0:72] for  i in a]
    d = [new_list(list(range(i, i+72)), i) for i in b]
    return dict(zip([c[i][taiyiju-1] for i in range(0,5)], [d[i][taiyiju-1] for i in range(0,5)]))
#中國統治者在位年
def kingyear(year):
    def closest(lst, K):
        return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))]
    data = ruler_data
    y =  list(map(lambda x: int(x), data[0::7]))
    period = data[3::7]
    king = data[4::7]
    king_realname = data[5::7]
    preiodname = data[6::7]
    idx = y.index(closest(y, year))
    if year == y[idx]:
        year = "元"
        pn = "{}{}年".format(preiodname[idx], year)
        kn = "{}{}{}".format(period[idx], king[idx], king_realname[idx])
        return  "{} {}".format(kn, pn)
    elif year > y[idx]:
        year = year - y[idx] +1
        cyear = an2cn(year)
        pn = "{}{}年".format(preiodname[idx],cyear)
        kn = "{}{}{}".format(period[idx], king[idx], king_realname[idx])
        return  "{} {}".format(kn, pn)
    elif year < y[idx] and year> 0:
        year = year - y[idx-1] 
        cyear = an2cn(year+1)
        pn = "{}{}年".format(preiodname[idx-1],cyear)
        kn = "{}{}{}".format(period[idx-1], king[idx-1], king_realname[idx-1])
        return  "{} {}".format(kn, pn)
    elif year < 0:
        year = year - y[idx-1] 
        cyear = an2cn(year+2)
        pn = "{}{}年".format(preiodname[idx-1],cyear)
        kn = "{}{}{}".format(period[idx-1], king[idx-1], king_realname[idx-1])
        return  "{} {}".format(kn, pn)
#%% 二十八宿
#推二十八星宿
def starhouse(year, month, day, hour, minute):
    numlist = [13,9,16,5,5,17,10,24,7,11,25,18,17,10,17,13,14,11,16,1,9,30,3,14,7,19,19,18]
    alljq = jieqi.jieqi_name
    njq = new_list(alljq, "冬至")
    gensulist =  list(itertools.chain.from_iterable([[su[i]]*numlist[i] for i in range(0,28)]))
    jqsulist = [["斗", 9],["斗",24] ,["女", 8],["危",2],["室", 1],["壁",1] ,["奎", 4],["婁",2] ,["胃", 4],["昴",4] ,["畢", 8],["參",6] ,["井", 1],["井", 27],["柳",8] ,["張", 3],["翼",1] ,["翼", 16],["軫",13] ,["角", 9],["房", 1],["氐",2] ,["尾", 6],["箕",24]]
    njq_list = dict(zip(njq, jqsulist))
    currentjq = jieqi.jq(year, month, day, hour, minute)
    distance_to_cjq = jieqi.distancejq(year, month, day, hour, minute, currentjq)
    num = gensulist.index(njq_list.get(currentjq)[0]) + njq_list.get(currentjq)[1] + distance_to_cjq
    new_num = num -360
    if new_num > 360:
        new_num = new_num -360
    if num >360:
        return new_list(gensulist, njq_list.get(currentjq)[0])[new_num]
    else:
        return gensulist[num]
#%% 太乙十精
#五行
def wuxing(taiyi_acumyear):
    #f = self.accnum(ji_style, taiyi_acumyear) // 5
    f = taiyi_acumyear % 5
    if f == 0:
       fv = divide(taiyi_acumyear, 5)
       return dict(zip(list(range(1,17)),gong1)).get(fv % 5) 
    else:
       return dict(zip(range(1,6), list("乾子艮巽坤"))).get(int(f))
#帝符
def kingfu(taiyi_acumyear):
    #f = self.accnum(ji_style, taiyi_acumyear) % 20
    kingfu_num = taiyi_acumyear % 20
    if kingfu_num == 0:
       kingfu_num = divide(taiyi_acumyear, 20)
       kingfu_num = kingfu_num % 20
    if kingfu_num > 16:
        kingfu_num = kingfu_num - 16
    return dict(zip(range(1,17), new_list(gong1, "戌"))).get(int(kingfu_num))
#天皇
def tian_wang(taiyi_acumyear):
    tw = taiyi_acumyear % 20
    if tw == 0:
        tw = divide(taiyi_acumyear, 20)
        tw_v = tw % 20 
        if tw_v > 16:
            tw_v = tw_v - 16
        return dict(zip(list(range(1,17)),gong1)).get(tw_v)
    else:
       return dict(zip(list(range(1,17)),new_list(gong1, "申"))).get(tw)
#天時
def tian_shi(taiyi_acumyear):
    tw = taiyi_acumyear % 12
    if tw == 0:
       tw = divide(taiyi_acumyear, 12)
       tw_v = tw % 12
       if tw_v > 16:
           tw_v = tw_v - 16
       return dict(zip(list(range(1,17)),gong1)).get(tw_v)
    else:
       return dict(zip(list(range(1,17)),new_list(gong1, "寅"))).get(tw)
#太尊
def taijun(taiyi_acumyear):
    f = taiyi_acumyear % 4
    if f == 0:
       f = divide(taiyi_acumyear, 4)
       f_v = f % 4
       if f_v > 16:
           f_v = f_v - 16
       return dict(zip(list(range(1,17)),gong1)).get(f_v)
    else:
       return dict(zip(range(1,5), list("子午卯酉"))).get(int(f))
#飛鳥
def flybird(taiyi_acumyear):
    f = taiyi_acumyear % 8
    if f == 0:
       return "坤"
    else:
       return dict(zip(range(1,9), [1,8,3,4,9,2,7,6])).get(int(f))

#三風
def threewind(taiyi_acumyear):
    #f = self.accnum(ji_style, taiyi_acumyear) % 9
    f = taiyi_acumyear % 9
    if f == 0:
       fv = divide(taiyi_acumyear, 9)
       return fv % 9 
    else:
       if f % 9 == 0:
           return dict(zip(range(1,9), [7,2,6,1,3,9,4,8])).get(int(f/9))
       elif f % 9 != 0:
           return dict(zip(range(1,9), [7,2,6,1,3,9,4,8])).get(int(f % 9))
    
#五風
def fivewind(taiyi_acumyear):
    f = taiyi_acumyear % 29
    if f == 0:
       fv = divide(taiyi_acumyear, 29)
       return fv % 29 
    else:
       if f % 9 == 0:
           return dict(zip(range(1,10), [1,3,5,7,9,2,4,6,8])).get(int(f / 9 ))
       elif f % 9 != 0:
           return dict(zip(range(1,10), [1,3,5,7,9,2,4,6,8])).get(int(f % 9 ))
#八風
def eightwind(taiyi_acumyear):
    f = taiyi_acumyear % 9
    if f == 0:    
       fv = divide(taiyi_acumyear, 9)
       return fv % 9
    else:
       if f % 9 == 0:
          return dict(zip(range(1,9), [2,3,4,6,7,8,9,1])).get(int(f / 9 ))
       elif f % 9 != 0:
          return dict(zip(range(1,9), [2,3,4,6,7,8,9,1])).get(int(f % 9 ))
# ── 年神虚星(五福/大游/小游):按「年」算,与积年法 tn 无关;区别于上方随积数刷新的当前位九神/风。
# 返回宫数(1-9),与 num2gong/num2gong_life 配合保持调用点形状。
def wufu_year(year):
    """五福:上元积年 12607+年; %225//45; 起乾(乾艮巽坤中=1,3,9,7,5),45 年/宫,225 年周。"""
    a = 12607 + year + (1 if year < 0 else 0)
    return [1, 3, 9, 7, 5][(a % 225) // 45]


def bigyo_year(year):
    """大游:上元积年 12607+年; %4320%288//36; 起七宫(7,8,9,1,2,3,4,6 不入中5),36 年/宫。"""
    a = 12607 + year + (1 if year < 0 else 0)
    return [7, 8, 9, 1, 2, 3, 4, 6][((a % 4320) % 288) // 36]


def smyo_year(year):
    """小游:演纪上元积年 2637+年; %240%24//3; 起一宫(1,2,3,4,6,7,8,9 不入中5),3 年/宫。"""
    a = 2637 + year + (1 if year < 0 else 0)
    return [1, 2, 3, 4, 6, 7, 8, 9][((a % 240) % 24) // 3]


# deprecated:下方 wufu/bigyo/smyo 误把积数当年差(吃 accnum),勿用,改用上方 *_year(按年)。
#五福
def wufu(taiyi_acumyear):
    f = (taiyi_acumyear + 250) % 225 % 45
    #f = int(self.accnum(ji_style, taiyi_acumyear) + 250) % 225 / 45
    fv =  f % 5
    if fv == None:
        return dict(zip(range(1,6), list("13975"))).get(int(f/5))
    if fv != None and fv !=0:
        return fv
    if fv == 0:
        return 5
    
    
#陽九
def yangjiu(year, month, day):
    year = lunar_date_d(year, month, day).get("年")
    getyj = (year + 12607)%4560%456 % 12
    if getyj>=12:
        getyj = getyj % 12
        return dict(zip(range(1,13),new_list(di_zhi, "寅"))).get(getyj)
    elif getyj == 0:
        return dict(zip(range(1,13),new_list(di_zhi, "寅"))).get(12)
    else:
        return dict(zip(range(1,13),new_list(di_zhi, "寅"))).get(getyj)
#百六
def baliu(year, month, day):
    year = lunar_date_d(year, month, day).get("年")
    getbl = (year + 12607)%4320%288 % 24
    if getbl >12:
        getbl = (getbl - 12) %12
        return dict(zip(range(1,13),new_list(di_zhi, "卯"))).get(getbl)
    elif getbl == 0:
        return dict(zip(range(1,13),new_list(di_zhi, "酉"))).get(12)
    else:
        return dict(zip(range(1,13),new_list(di_zhi, "酉"))).get(getbl)
#大游
def bigyo(taiyi_acumyear):
    #big_yo = int((self.accnum(ji_style, taiyi_acumyear) +34) % 388)
    big_yo = (taiyi_acumyear + 34) % 288
    if big_yo < 36:
        big_yo = big_yo
    if big_yo > 36:
        big_yo = big_yo / 36
    if big_yo < 6:
        big_yo = 6
    byv = dict(zip([7,8,9,1,2,3,4,6],range(1,9))).get(int(big_yo))
    return byv
#小游
def smyo(taiyi_acumyear):
    small_yo = taiyi_acumyear % 360
    sm = 0  # Initialize sm here

    if small_yo < 24:
        sm = small_yo % 3
    elif small_yo > 24:
        sm = small_yo % 24
        if small_yo > 10:
            sm = small_yo - 9

        if sm % 3 != 0:
            return dict(zip([1, 2, 3, 4, 6, 7, 8, 9], range(1, 9))).get(int(sm % 3), 1)
        elif sm % 3 == 0:
            a = dict(zip([1, 2, 3, 4, 6, 7, 8, 9], range(1, 9))).get(int(sm / 3))
            return a if a is not None else 1

    return dict(zip([1, 2, 3, 4, 6, 7, 8, 9], range(1, 9))).get(int(sm % 3), 1)

     
#%% 三門五將
#八門值事
def eight_door(taiyi_acumyear):
    acc = taiyi_acumyear % 240
    #acc = self.accnum(ji_style, taiyi_acumyear) % 240
    if acc == 0:
        acc = 120
    eightdoor_zhishi = acc // 30
    if eightdoor_zhishi % 30 != 0:
        eightdoor_zhishi = eightdoor_zhishi + 1
    elif eightdoor_zhishi == 0:
        eightdoor_zhishi = 1
    #ty_gong = self.ty()
    return dict(zip(list(range(1,9)),door)).get(eightdoor_zhishi)

#推八門分佈
def geteightdoors(ty, doors):
    new_ty_order = new_list([8,3,4,9,2,7,6,1], ty)
    #doors  = new_list(door, eight_door(taiyi_acumyear))
    #doors = new_list(door, eightdoor)
    return dict(zip(new_ty_order, doors))

#%% 太乙七式
#推雷公入水
def leigong(ty):
    find_ty = dict(zip([1,2,3,4,6,7,8,9],list("乾午艮卯酉坤子巽"))).get(ty)
    new_order = new_list(gong1, find_ty)
    return dict(zip(range(1,17),new_order)).get(1+4)
#推臨津問道
def lijin(year, month, day, hour, minute):
    year = dict(zip(di_zhi, range(1,13))).get(gangzhi(year, month, day, hour, minute)[0][1])
    return new_list(gong1, "寅")[year]
#推獅子反擲
def lion(year, month, day, hour, minute):
    return new_list(gong1, gangzhi(year, month, day, hour, minute)[0][1])[4]
#推白雲捲空
def cloud(hg_num):
    return new_list(list(reversed(gong1)), "寅")[hg_num]
#推猛虎相拒
def tiger(ty):
    new_order = new_list(gong1, "寅")
    return new_order[ty]
#推白龍得云
def dragon(ty):
    new_order = new_list(list(reversed(gong1)), "寅")
    return new_order[ty]
#推回軍無言
def returnarmy(ag_num):
    return new_list(gong1, "寅")[ag_num]
#推多少以占勝負  客以多筭臨少主人敗客以少筭臨多主人勝也
def suenwl(homecal, awaycal, home_general, away_general ):
    if awaycal < homecal and home_general != 5:
        return "客以少筭臨多，主人勝也。"
    elif awaycal < homecal and home_general == 5:
        return "雖客以少筭臨多，惟主人不出中門，主客俱不利，和。"
    elif awaycal > homecal and away_general != 5:
        return "客以多筭臨少，主人敗也。"
    elif awaycal > homecal and away_general == 5:
        return "雖客以多筭臨少，惟客人不出中門，主客俱不利，和。"
    else:
        return "主客旗鼓相當。"

if __name__ == '__main__':
    print(num2gong_life(bigyo(10155909)))
    print(gpan(2024,8,23,10,7))
    print(gpan1(2024,8,23,10,7))
