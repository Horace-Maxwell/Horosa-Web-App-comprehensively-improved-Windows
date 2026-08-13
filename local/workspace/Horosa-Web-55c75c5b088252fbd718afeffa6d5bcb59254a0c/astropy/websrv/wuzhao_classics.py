# -*- coding: utf-8 -*-
"""五兆古法算法层 —— 依敦煌写本 P.2859《五兆要诀略》复原。

本模块为纯函数 + 纯数据，不 import 上游 kinwuzhao，故上游引擎语义完全不受影响；
适配层取得六位五行后调用 enrich()，把古法层结果叠加到排盘输出上。

涵盖：
  · 乡支十三名词（相刑/在家/动财/扶乡/纳财/化财/克鬼/自刑/进鬼/化鬼/制鬼/反制/抑乡）
  · 四时休王与有气无气、五类鬼入卦
  · 十二长生（原卷所载月位）
  · 六神游宫（日干）与行神（月家六神）、行伏、六神死害
  · 纳甲（六旬）、空亡、冲合刑害害、三合、支德、五合五离、天恩天赦母仓
  · 入墓三式（鬼行入墓／带煞入墓／身入墓）、干转支转
  · 神煞（大煞小煞劫煞月劫煞丧门煞阴驿马天医月厌月刑天煞地煞三丘五墓丧车弔客关籥狱）
  · 君子小人与剥落、身克命／命克身、头身足
  · 细分六亲两法（五行阴阳分男女、干合生克）

凡原卷阙文、重出、错讹处一律带 suspect 标记随文输出，不代原卷作判断。
"""

from __future__ import annotations

from . import wuzhao_duanci as DC


# ---------------------------------------------------------------------------
# 基础表
# ---------------------------------------------------------------------------

ELEMS = ('木', '火', '土', '金', '水')
XIANG_ORDER = ('木', '火', '土', '金', '水')          # 五乡固定次第（与排盘 positions[1:] 对齐）
POSITION_LABELS = ('兆', '木乡', '火乡', '土乡', '金乡', '水乡')

SHENG = {'木': '火', '火': '土', '土': '金', '金': '水', '水': '木'}
KE = {'木': '土', '土': '水', '水': '火', '火': '金', '金': '木'}

STEMS = ('甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸')
BRANCHES = ('子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥')

STEM_ELEM = {'甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
             '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'}
STEM_YINYANG = {'甲': '阳', '丙': '阳', '戊': '阳', '庚': '阳', '壬': '阳',
                '乙': '阴', '丁': '阴', '己': '阴', '辛': '阴', '癸': '阴'}
ELEM_STEMS = {'木': ('甲', '乙'), '火': ('丙', '丁'), '土': ('戊', '己'),
              '金': ('庚', '辛'), '水': ('壬', '癸')}
ELEM_GANPAIR = {'木': '甲乙', '火': '丙丁', '土': '戊己', '金': '庚辛', '水': '壬癸'}
GANPAIR_ELEM = {v: k for k, v in ELEM_GANPAIR.items()}

BRANCH_ELEM = {'子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
               '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'}

# 地支所藏之干（支转「见仇」判据：辰中有木克土，故曰见仇）
BRANCH_HIDDEN = {
    '子': ('癸',), '丑': ('己', '癸', '辛'), '寅': ('甲', '丙', '戊'), '卯': ('乙',),
    '辰': ('戊', '乙', '癸'), '巳': ('丙', '庚', '戊'), '午': ('丁', '己'),
    '未': ('己', '丁', '乙'), '申': ('庚', '壬', '戊'), '酉': ('辛',),
    '戌': ('戊', '辛', '丁'), '亥': ('壬', '甲'),
}

# 五行墓库（《要诀略》「五墓日：水土墓于辰，火墓在戌，金墓在丑，木在未」）
MU_KU = {'水': '辰', '土': '辰', '火': '戌', '金': '丑', '木': '未'}
MU_MONTHS = {'辰': 3, '未': 6, '戌': 9, '丑': 12}
SIMU_BRANCHES = ('辰', '未', '戌', '丑')

# 月序 → 月建地支（正月建寅）
MONTH_BRANCH = {1: '寅', 2: '卯', 3: '辰', 4: '巳', 5: '午', 6: '未',
                7: '申', 8: '酉', 9: '戌', 10: '亥', 11: '子', 12: '丑'}
BRANCH_MONTH = {v: k for k, v in MONTH_BRANCH.items()}

# 三合局
SANHE = {
    ('亥', '卯', '未'): '木', ('申', '子', '辰'): '水',
    ('巳', '酉', '丑'): '金', ('寅', '午', '戌'): '火',
}
SANHE_TEXT = ('三合：亥卯未木、申子辰水、巳酉丑金、寅午戌火位之。'
              '寅午戌，火之位；亥卯未，木之位；申子辰，巳酉丑，金之位；'
              '辰戌丑未，土之位，土无正形曰火，得名浮游。四季寄在丙丁。')


def sanhe_group(branch):
    for grp in SANHE:
        if branch in grp:
            return grp
    return ()


# ---------------------------------------------------------------------------
# 一、乡支十三名词（《五兆卜法》六亲关系；判据与《要诀略》廿五式全文互证）
# ---------------------------------------------------------------------------

LIUQIN_ROLES = ('兄弟', '子孙', '妻财', '官鬼', '父母')

# (乡之六亲, 支之六亲) → (名词, 大类, 吉凶, 象意)
XIANG13 = {
    # 支同乡
    ('兄弟', '兄弟'): ('相刑', '支同乡', 'xiong',
                       '兄弟支入身宫。形同兄弟阋墙，故为诤讼、分离、远行等对抗排斥之象，多凶。'),
    ('子孙', '子孙'): ('在家', '支同乡', 'ji',
                       '除却身宫，其余乡与支五行相同。形同亲属安居，故为安稳、静态、平和等不动不惊之象，多吉。'),
    ('妻财', '妻财'): ('在家', '支同乡', 'ji',
                       '除却身宫，其余乡与支五行相同。形同亲属安居，故为安稳、静态、平和等不动不惊之象，多吉。'),
    ('官鬼', '官鬼'): ('在家', '支同乡', 'ji',
                       '除却身宫，其余乡与支五行相同。形同亲属安居，故为安稳、静态、平和等不动不惊之象，多吉。'),
    ('父母', '父母'): ('在家', '支同乡', 'ji',
                       '除却身宫，其余乡与支五行相同。形同亲属安居，故为安稳、静态、平和等不动不惊之象，多吉。'),
    # 乡生支
    ('妻财', '官鬼'): ('动财', '乡生支', 'xiong',
                       '官鬼支入财乡。乡生支，乡助官鬼，如财库被盗，故为失财、解除等分离之象，多凶；'
                       '若舍离决绝迅速，则无咎或吉。'),
    ('兄弟', '子孙'): ('扶乡', '乡生支', 'ji',
                       '乡母支子，子见母则扶助，故为增益、速来、升迁、恶事消解等上进之象，多吉。'),
    ('子孙', '妻财'): ('扶乡', '乡生支', 'ji',
                       '乡母支子，子见母则扶助，故为增益、速来、升迁、恶事消解等上进之象，多吉。'),
    ('官鬼', '父母'): ('扶乡', '乡生支', 'ji',
                       '乡母支子，子见母则扶助，故为增益、速来、升迁、恶事消解等上进之象，多吉。'),
    ('父母', '兄弟'): ('扶乡', '乡生支', 'ji',
                       '乡母支子，子见母则扶助，故为增益、速来、升迁、恶事消解等上进之象，多吉。'),
    # 乡克支
    ('兄弟', '妻财'): ('纳财', '乡克支·得财', 'ji',
                       '财支入身宫，故为得财，好事自来等增益之象，多吉。'),
    ('子孙', '官鬼'): ('化财', '乡克支·得财', 'ji',
                       '官鬼支入子孙乡，子孙消解官鬼，故求财自来、坏事消解之象，多吉。'),
    ('妻财', '父母'): ('化财', '乡克支·得财', 'ji',
                       '父母支入财乡，父母化财，财乡增财，故为增益、赠赐之象，多吉。'),
    ('官鬼', '兄弟'): ('克鬼', '乡克支·克鬼', 'ji',
                       '身支（兄弟支）入官鬼乡，我反制官鬼乡，不化为财，故为求官可得、官非消除之象，多吉或平。'),
    ('父母', '子孙'): ('自刑', '乡克支·自刑', 'xiong',
                       '子孙支入母乡，母乡反为子支官鬼，父母不庇子孙，故为疾患、官非、受辱等保护无力之象，多凶。'),
    # 支克乡
    ('兄弟', '官鬼'): ('进鬼', '支克乡·见鬼', 'xiong',
                       '官鬼支入身宫，鬼来近身，故有口舌、官非、疾病之象，多凶。'),
    ('子孙', '父母'): ('化鬼', '支克乡·见鬼', 'xiong',
                       '父母支入子孙乡，子孙无力，故官非口舌、病患、远行之象，多凶。'),
    ('妻财', '兄弟'): ('化鬼', '支克乡·见鬼', 'xiong',
                       '身支入财乡，故为散败、失物、诤讼之象，多凶。'),
    ('父母', '妻财'): ('化鬼', '支克乡·见鬼', 'xiong',
                       '财支入父母乡，故为散败、失物、诤讼之象，多凶。'),
    ('官鬼', '子孙'): ('制鬼', '支克乡·制鬼', 'ji',
                       '子孙支入鬼乡，子孙解厄，故病愈、官非消除等解除之象，多吉。'),
    # 支生乡
    ('官鬼', '妻财'): ('反制', '支生乡·反制', 'xiong',
                       '妻财支入鬼乡，虽成财母然官鬼反制，故有失财失物、家宅不宁、反制之象，多凶。'),
    ('兄弟', '父母'): ('抑乡', '支生乡·抑乡', 'xiong',
                       '乡子支母，母见子则抑制，故为衰减、迟缓、求不得之象，多凶。'),
    ('子孙', '兄弟'): ('抑乡', '支生乡·抑乡', 'xiong',
                       '乡子支母，母见子则抑制，故为衰减、迟缓、求不得之象，多凶。'),
    ('妻财', '子孙'): ('抑乡', '支生乡·抑乡', 'xiong',
                       '乡子支母，母见子则抑制，故为衰减、迟缓、求不得之象，多凶。'),
    ('父母', '官鬼'): ('抑乡', '支生乡·抑乡', 'xiong',
                       '乡子支母，母见子则抑制，故为衰减、迟缓、求不得之象，多凶。'),
}


def liuqin_of(my_elem, target_elem):
    """五行六亲：以 my_elem 为我，判 target_elem 之六亲。"""
    if my_elem == target_elem:
        return '兄弟'
    if SHENG.get(my_elem) == target_elem:
        return '子孙'
    if KE.get(my_elem) == target_elem:
        return '妻财'
    if KE.get(target_elem) == my_elem:
        return '官鬼'
    if SHENG.get(target_elem) == my_elem:
        return '父母'
    return ''


def xiang_zhi_relation(zhao_elem, xiang_elem, zhi_elem):
    """乡支十三名词判定。返回 dict 或 None。"""
    xiang_role = liuqin_of(zhao_elem, xiang_elem)
    zhi_role = liuqin_of(zhao_elem, zhi_elem)
    hit = XIANG13.get((xiang_role, zhi_role))
    if not hit:
        return None
    name, group, luck, text = hit
    return {
        'name': name, 'group': group, 'luck': luck, 'text': text,
        'xiangRole': xiang_role, 'zhiRole': zhi_role,
    }


# 被扶／被抑（《五兆卜法》名词解释：以乡为体，所入之支为用）
def fu_yi_of(xiang_elem, zhi_elem):
    if SHENG.get(xiang_elem) == zhi_elem:
        return ('被扶', '乡生支，为被扶，多主好事得进，坏事解散。')
    if SHENG.get(zhi_elem) == xiang_elem:
        return ('被抑', '支生乡，为被抑，多主好事佚退，坏事快来。')
    return ('', '')


# ---------------------------------------------------------------------------
# 二、四时休王与有气无气
# ---------------------------------------------------------------------------

SEASON_BY_JIEQI = {}
for _jq in ('立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '驚蟄', '穀雨'):
    SEASON_BY_JIEQI[_jq] = '春'
for _jq in ('立夏', '小满', '芒种', '夏至', '小暑', '大暑', '小滿'):
    SEASON_BY_JIEQI[_jq] = '夏'
for _jq in ('立秋', '处暑', '白露', '秋分', '寒露', '霜降', '處暑'):
    SEASON_BY_JIEQI[_jq] = '秋'
for _jq in ('立冬', '小雪', '大雪', '冬至', '小寒', '大寒'):
    SEASON_BY_JIEQI[_jq] = '冬'

# 《要诀略·五兆杂言》四时休王（季夏六月土王，P.2859 持土王季夏说）
SEASON_WANGSHUAI = {
    '春': {'木': '王', '火': '相', '水': '休废', '土': '死', '金': '囚'},
    '夏': {'火': '王', '土': '相', '金': '胎', '水': '囚', '木': '废'},
    '秋': {'金': '王', '水': '相', '土': '休废', '木': '胎', '火': '囚'},
    '冬': {'水': '王', '木': '相', '火': '胎', '土': '囚', '金': '休废'},
    '季夏': {'土': '王', '金': '相', '水': '死', '木': '囚', '火': '休废'},
}
SEASON_WANGSHUAI_SUSPECT = {
    '秋': '原卷秋三月一节作「金兆王，水兆相，土兆休废，木兆胎，水兆囚」，'
          '「水」字重出而缺火，据五行体休王之例补作「火兆囚」，存疑。',
}

YOU_QI = ('王', '相', '胎', '没')       # 有气
WU_QI = ('休', '废', '休废', '囚', '死')  # 无气


def season_of(jieqi, lunar_month_num=None):
    """定季：农历六月（未月）用季夏，余依节气。"""
    if lunar_month_num == 6:
        return '季夏'
    return SEASON_BY_JIEQI.get(str(jieqi or '').strip(), '')


def wangshuai_of(elem, season):
    return SEASON_WANGSHUAI.get(season, {}).get(elem, '')


def qi_of(wangshuai):
    if not wangshuai:
        return ''
    if wangshuai in YOU_QI:
        return '有气'
    return '无气'


# ---------------------------------------------------------------------------
# 三、六旬纳甲、空亡
# ---------------------------------------------------------------------------

def _jiazi():
    return [STEMS[i % 10] + BRANCHES[i % 12] for i in range(60)]


JIAZI = tuple(_jiazi())

XUN_NAMES = ('甲子旬', '甲戌旬', '甲申旬', '甲午旬', '甲辰旬', '甲寅旬')
# 旬 → {天干: 地支}
XUN_STEM_BRANCH = {}
# 旬 → 空亡二支
XUN_KONGWANG = {}
for _i, _name in enumerate(XUN_NAMES):
    _start = _i * 10
    _pairs = JIAZI[_start:_start + 10]
    XUN_STEM_BRANCH[_name] = {gz[0]: gz[1] for gz in _pairs}
    _used = {gz[1] for gz in _pairs}
    XUN_KONGWANG[_name] = tuple(b for b in BRANCHES if b not in _used)

KONGWANG_TEXT = {
    '甲子旬': '甲子旬中无戌亥，水土各半为空亡。',
    '甲戌旬': '甲戌旬中无申酉，纯金空亡。',
    '甲申旬': '甲申旬中无午未，火土各半为空亡。',
    '甲午旬': '甲午旬中无辰巳，火土各半空亡。',
    '甲辰旬': '甲辰旬中无卯寅，纯木为空亡。',
    '甲寅旬': '甲寅旬中无子丑，水土各半空亡。',
}


def xun_of(day_gz):
    """日柱所在六甲旬。"""
    gz = str(day_gz or '').strip()
    if len(gz) < 2 or gz not in JIAZI:
        return ''
    return XUN_NAMES[JIAZI.index(gz) // 10]


def najia(elem, xun):
    """纳甲：五行 → 该旬所配（阳干支、阴干支）。"""
    table = XUN_STEM_BRANCH.get(xun, {})
    out = []
    for stem in ELEM_STEMS.get(elem, ()):
        branch = table.get(stem, '')
        if branch:
            out.append({'stem': stem, 'branch': branch,
                        'yinyang': STEM_YINYANG.get(stem, ''), 'gz': stem + branch})
    return out


# 占空亡（《要诀略》逐旬逐兆断辞）
KONGWANG_ZHAO = {
    '甲子旬': {'木': '木兆，其人无妻', '水': '水兆，无子', '金': '金兆，其人无父母',
               '土': '土兆，无官，有不成', '火': ''},
    '甲申旬': {'木': '木兆，其人忧子、财入官', '土': '土兆，其人父母不全具',
               '火': '火兆，其人无子', '水': '水兆，其人忧财', '金': '甲午金兆，亦忧财'},
    '甲午旬': {'火': '火兆，其人无子', '土': '土兆，其人无妻',
               '木': '木兆，其人忧财入官', '水': '水兆，其人无官，有不成', '金': ''},
    '甲辰旬': {'木': '木兆，全木空亡', '水': '水兆，其人无子，不长命',
               '土': '土兆，其人无官，不成', '金': '金兆，其人忧妻财',
               '火': '火兆，其人忧父母不全具'},
    '甲寅旬': {'木': '木兆，其人求财不得口', '水': '水兆，其人无官之事',
               '火': '火兆，其人忧惊恐', '金': '金兆，其人忧母或子', '土': ''},
    '甲戌旬': {'金': '', '木': '', '火': '', '土': '', '水': ''},
}
KONGWANG_ZHAO_SUSPECT = {
    '甲戌旬': '原卷占空亡一节，甲戌旬（无申酉全金空亡）下逐兆断辞阙，校录以红字补出'
              '「甲戌旬中无申酉全金空亡，金兆；木兆；火兆；土兆；水兆」而无断语，此处留白，存疑。',
}
KONGWANG_GENERAL = ('卜得空亡之卦，男忧远行。女得空亡卦，忧疾病。得空亡者，人无家宅，'
                    '吏无真官，假兼他职，故流离故乡。'
                    '男得空亡忧远行，女得空亡忧病患。空亡者人民无子，宅史优，无官，'
                    '假兼他职，寄在他乡，但闻其声，不见其形，若有走失，追捉不得。')
KONGWANG_WUZI = ('妇夫居，当有子若卜得：木兆火支动火乡，火兆土支、土兆金支、金兆水支、'
                 '水兆木支并身动子之中，又与煞并，皆无子。假令有子，非长命子也。')


# ---------------------------------------------------------------------------
# 四、冲合刑害、支德、五合五离、天恩天赦母仓、六属纳音
# ---------------------------------------------------------------------------

CHONG = {'子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅',
         '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'}
LIUHE = {'寅': '亥', '亥': '寅', '子': '丑', '丑': '子', '卯': '戌', '戌': '卯',
         '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午'}
# 《要诀略》推相刑法（含自刑）
XING = {'寅': '巳', '巳': '申', '申': '寅', '子': '卯', '卯': '子',
        '丑': '戌', '戌': '未', '未': '丑',
        '辰': '辰', '酉': '酉', '午': '午', '亥': '亥'}
XING_TEXT = ('推相刑法：寅正月刑巳，巳刑申，七月申刑寅，子刑卯，子刑卯，辰酉午亥自刑。'
             '丑刑戌，戌刑未，(未刑丑)，年月日辰时并同右。')
# 《要诀略》推六害法（与常见地支六害不同，原文如此）
LIUHAI = {'午': '子', '戌': '未', '酉': '寅', '辰': '卯', '巳': '申', '丑': '亥'}
LIUHAI_TEXT = ('推六害法：午害子，戌害未，酉害寅，辰害卯，巳害申，丑害亥。'
               '凡卜，支兆与刑害并者，百事皆凶。')

# 支德（《要诀略》「凡子日德在巳……」）
ZHI_DE = {'子': '巳', '丑': '午', '寅': '未', '卯': '申', '辰': '酉', '巳': '戌',
          '午': '亥', '未': '子', '申': '丑', '酉': '寅', '戌': '卯', '亥': '辰'}

# 五合五离
WUHE = {'甲寅': '天地合', '乙卯': '天地合', '丙寅': '日月合', '丁卯': '日月合',
        '戊寅': '人民合', '己卯': '人民合', '庚寅': '金石合', '辛卯': '金石合',
        '壬寅': '江河合', '癸卯': '江河合'}
WULI = ('甲申', '丙申', '戊申', '庚申', '壬申')
WUHE_TEXT = ('[五合、五离法]：甲寅、乙卯天地合：丙寅、丁卯日月合；[戊寅、己卯人民合]；'
             '庚寅、辛卯金[石]合；壬寅、癸卯江河合。甲申、丙申、戊申、庚申、壬申，以上离日。')
TIANEN_TEXT = '[甲子起土五日天恩，己卯起五日天恩，己酉起五日天恩]。'

# 天赦（春戊寅、夏甲午、秋戊申、冬甲子）
TIANSHE = {'春': '戊寅', '夏': '甲午', '秋': '戊申', '冬': '甲子'}
# 母仓（春亥子、夏寅卯、秋辰戌丑未、冬申酉、四季之月巳午）
MUCANG = {'春': ('亥', '子'), '夏': ('寅', '卯'),
          '秋': ('辰', '戌', '丑', '未'), '冬': ('申', '酉'), '季夏': ('巳', '午')}
TIANSHE_MUCANG_TEXT = ('凡春得戊寅日，夏甲午，秋戊申，冬甲子，为天赦。春亥子，夏寅卯，'
                       '秋辰戌丑未，冬申酉，并为母仓；四季之月，巳午为母仓。')

# 六属法与纳音五音数
LIUSHU = {'子': '庚', '午': '庚', '丑': '辛', '未': '辛', '寅': '戊', '申': '戊',
          '卯': '己', '酉': '己', '辰': '丙', '戌': '丙', '巳': '丁', '亥': '丁'}
LIUSHU_TEXT = '六属法：子午属庚，丑未属辛，寅申属戊，卯酉属己．辰戌属丙，巳亥属丁。'
WUYIN_SHU = {1: '土', 3: '火', 5: '水', 7: '金', 9: '木'}
WUYIN_TEXT = '阴阳五音，一言得之土，三言得之火，五言得之水，七言得之金，九言得之木。'

# 五行生成数与干支数（射覆、卜数用）
SHENG_CHENG_SHU = {'木': (3, 8), '火': (2, 7), '金': (4, 9), '水': (1, 6), '土': (5, 10)}
SHENG_CHENG_TEXT = ('五行决之，木数三，成数八；火数二，成数七；金数四，成数九；'
                    '水数一，成数六；土数五，成数十。凡事准(?)此取成五兆决法。')
GAN_SHU = {'甲': 9, '己': 9, '乙': 8, '庚': 8, '丙': 7, '辛': 7,
           '丁': 6, '壬': 6, '戊': 5, '癸': 5}
ZHI_SHU = {'子': 9, '午': 9, '丑': 8, '未': 8, '寅': 7, '申': 7,
           '卯': 6, '酉': 6, '辰': 5, '戌': 5, '巳': 4, '亥': 4}
GANZHI_SHU_TEXT = ('甲己九，乙庚八，丙辛七，丁壬六，戊癸五；子午九，丑未八，寅申七，'
                   '卯酉六，辰戌五，巳亥四。五行，王相十倍加之，休废囚死盛半。')


# ---------------------------------------------------------------------------
# 五、神煞
# ---------------------------------------------------------------------------

# 月大煞：正戌 二巳 三午 四未 五寅 六卯 七辰 八亥 九子 十丑 十一申 十二酉
DA_SHA = {1: '戌', 2: '巳', 3: '午', 4: '未', 5: '寅', 6: '卯',
          7: '辰', 8: '亥', 9: '子', 10: '丑', 11: '申', 12: '酉'}
DA_SHA_TEXT = ('推大煞法：正月戌，二巳，三午，四未，五寅，六卯，七辰，八亥，九子，'
               '十丑，十一申，十二酉。')

# 月小煞：以月支三合起（寅午戌在丑、申子辰在未、巳酉丑在辰、亥卯未在戌[校补]）
XIAO_SHA_BY_SANHE = {('寅', '午', '戌'): '丑', ('申', '子', '辰'): '未',
                     ('巳', '酉', '丑'): '辰', ('亥', '卯', '未'): '戌'}
XIAO_SHA_TEXT = ('推小煞法：寅午戌在丑，申子辰在未，巳酉丑在辰，亥卯未在戌；'
                 '与小煞并，为小贼。')
XIAO_SHA_SUSPECT = '原卷脱「亥卯未在戌」一句，据三合四孟后一辰之例补，存疑。'

# 劫煞（岁）：寅午戌亥、亥卯未申、申子辰巳、巳酉丑寅
JIE_SHA_BY_SANHE = {('寅', '午', '戌'): '亥', ('亥', '卯', '未'): '申',
                    ('申', '子', '辰'): '巳', ('巳', '酉', '丑'): '寅'}
JIE_SHA_TEXT = ('推劫煞法：寅午戌在亥，亥卯未在申，申子辰在巳，巳酉丑在寅；'
                '至巳上行年，与煞并者，必被贼劫。')

# 月劫煞：寅午戌申、亥卯未巳、申子辰寅、巳酉丑亥
YUE_JIE_SHA_BY_SANHE = {('寅', '午', '戌'): '申', ('亥', '卯', '未'): '巳',
                        ('申', '子', '辰'): '寅', ('巳', '酉', '丑'): '亥'}
YUE_JIE_SHA_TEXT = ('推月劫煞法：寅午戌在申，亥卯未在巳，申子辰在寅，巳酉丑在亥；'
                    '行年与劫煞并者，大凶。')

# 丧门：正未 二戌 三丑 四辰，周而复始
SANG_MEN_CYCLE = ('未', '戌', '丑', '辰')
SANG_MEN_TEXT = '推丧门法：正月未，二月戌，三月丑，四月辰，周而复始。病人年与丧门并者凶。'

# 煞阴：正七寅 二八子 三九戌 四十申 五十一午 六十二辰
SHA_YIN = {1: '寅', 7: '寅', 2: '子', 8: '子', 3: '戌', 9: '戌',
           4: '申', 10: '申', 5: '午', 11: '午', 6: '辰', 12: '辰'}
SHA_YIN_TEXT = '推煞阴法：正、七月寅，二、八月子，三、九月戌，四、十月申，五、十一月午，六、十二月辰。'

# 驿马：太岁在巳酉丑→亥，申子辰→寅，亥卯未→巳，寅午戌→申（年月日时并同）
YI_MA_BY_SANHE = {('巳', '酉', '丑'): '亥', ('申', '子', '辰'): '寅',
                  ('亥', '卯', '未'): '巳', ('寅', '午', '戌'): '申'}
YI_MA_TEXT = ('推释马法：太岁在巳酉丑驿马在亥，太岁在申子辰驿马在寅，'
              '太岁[在]亥卯未驿马在巳，太岁在寅午戌驿马在申。以上年月日日时，释马并同。')

# 天医（左行）：正月天医在卯，左行十二月
TIAN_YI_START_MONTH = 1
TIAN_YI_START_BRANCH = '卯'
TIAN_YI_TEXT = '推天医法：正月天医在卯，左行十二月。若病人与天医并者，不死也。'

# 月厌：正月在戌，逆行十二月
YUE_YAN_TEXT = ('月厌在戌，合德辰，取阴中干配阳中支，是为阴阳不将，阴厄阳顺。凡阴皆逆行是也。')

# 月刑（校注所列相刑之辰）
YUE_XING = {'子': '卯', '丑': '戌', '卯': '子', '寅': '巳', '巳': '申',
            '未': '丑', '申': '寅', '戌': '未'}

# 天煞／地煞／天医（三合组，《要诀略》「正月、五月、九月，天煞在子……」）
TIAN_DI_SHA = {
    (1, 5, 9): {'天煞': '子', '地煞': '辰', '天医': '巳'},
    (2, 6, 10): {'天煞': '酉', '地煞': '丑', '天医': '申'},
    (3, 7, 11): {'天煞': '午', '地煞': '戌', '天医': '亥'},
    (4, 8, 12): {'天煞': '卯', '地煞': '未', '天医': '寅'},
}
TIAN_DI_SHA_TEXT = ('正月、五月、九月，天煞在子，地煞在辰，天医在丙(巳?)。'
                    '二月、六月、十月，天煞在酉，地煞丑，天医在庚(申?)。'
                    '三月、七月、十一月，天煞在午，地煞在戌，天医在壬(亥?)。'
                    '四月、八月、十二月，天煞在卯，地煞在未，天医在申(寅?)。'
                    '凡占病人，逢医即吉，逢煞即凶；日辰克兆亦凶，扶兆即吉，日辰为命，兆为身。')
TIAN_DI_SHA_SUSPECT = '原卷天医作干（丙/庚/壬/申），校录疑当为支（巳/申/亥/寅），此从校补，存疑。'

# 关籥（《要诀略》季表；与纳甲支、日辰并者，主被捉送）
GUAN_YUE_SEASON = {'春': {'关': '丑', '籥': '巳'}, '夏': {'关': '辰', '籥': '申'},
                   '秋': {'关': '未', '籥': '亥'}, '冬': {'关': '戌', '籥': '寅'}}
GUAN_YUE_TEXT = ('春三月关在丑，籥在巳，夏三月关在辰，籥在申，秋关在未，籥在亥，'
                 '冬关在戌，籥在寅。兆与关、籥并者，必被官人驿使捉送。')

# 三丘五墓丧车丧门弔客（逐月表，《要诀略》「推大小煞及丘墓、丧门、弔客所在法」）
QIU_MU_MONTHLY = {
    1: {'葬': '戌', '弔客': '辰', '丧车': '', '三丘': '', '煞并': '土兆', '煞并支': '亥', '墓': '午'},
    2: {'丧门': '', '弔客': '丑', '三丘': '亥', '五墓': '午', '丧车': '戌', '煞并': '火兆'},
    3: {'丧门': '丑', '弔客': '戌', '丘': '亥', '墓': '午', '丧车': '辰', '煞并': '火兆'},
    4: {'丧门': '辰', '弔客': '未', '丘': '巳', '墓': '午(子)', '煞并': '土兆'},
    5: {'丧门': '未', '弔客': '辰', '丧车': '子', '丘': '巳', '煞并': '木兆'},
    6: {'丧门': '戌', '弔客': '丑', '丘': '巳', '墓': '子', '车': '子', '煞并': '木兆'},
    7: {'丧门': '未', '弔客': '戌', '丘': '寅', '墓': '未', '车': '卯'},
    8: {'丧门': '辰', '弔客': '未', '丘': '寅', '墓': '未', '车': '卯', '煞并': '木兆'},
    9: {'丧门': '辰', '弔客': '戌', '丘': '寅', '墓': '未', '车': '巳'},
    10: {'丧': '戌', '丘': '申', '墓': '丑', '煞并': '水兆'},
    11: {'丧门': '戌', '弔客': '辰', '丘': '亥(申)', '墓': '午', '车': '午', '煞并': '金兆'},
    12: {'丧门': '午', '弔客': '辰', '车': '子', '煞并': '金兆'},
}
QIU_MU_SEASONAL = {
    '春': {'三丘': '申', '天墓': '丑', '天狱': '申', '地墓': '亥'},
    '夏': {'三丘': '巳', '天墓': '辰', '天狱': '亥', '地墓': '寅'},
    '秋': {'三丘': '寅', '天墓': '未', '天狱': '寅', '地墓': '寅'},
    '冬': {'三丘': '亥', '天墓': '戌', '天狱': '巳', '地墓': '亥'},
}
QIU_MU_SUSPECT = ('三丘、五墓原卷逐月表与季表两说并出，抄录亦多脱讹，此处两说并存照录，'
                  '不作调停。')

# 狱
YU_TEXT = '正月寅，随日建。酉为戌狱，未为巳狱，卯为辰狱，戌为亥狱，午为戌狱，子为戌狱。'

# 太岁名分
TAISUI_MINGFEN = ('凡太岁为天子，大煞为刺史，小煞为从事，一云为皇后，煞阴措御，'
                  '月建为府君，日辰为令长，青龙为……（脱漏），一云亦为太守。')

# 六壬十二神将（行年、年立、天医地医、官禄位用）
YUE_JIANG_ORDER = ('神后', '大吉', '功曹', '太冲', '天罡', '太一',
                   '胜光', '小吉', '传送', '从魁', '河魁', '徵明')
YUE_JIANG_BRANCH = dict(zip(BRANCHES, YUE_JIANG_ORDER))
BRANCH_BY_JIANG = {v: k for k, v in YUE_JIANG_BRANCH.items()}


def _jiang_shift(base_jiang, base_branch, target_jiang):
    """以 base_jiang 加于 base_branch，求 target_jiang 所临之支。"""
    if base_jiang not in YUE_JIANG_ORDER or target_jiang not in YUE_JIANG_ORDER:
        return ''
    if base_branch not in BRANCHES:
        return ''
    off = (YUE_JIANG_ORDER.index(target_jiang) - YUE_JIANG_ORDER.index(base_jiang)) % 12
    return BRANCHES[(BRANCHES.index(base_branch) + off) % 12]


def tianyi_diyi_by_jiang(year_branch):
    """以功曹加太岁，大吉下为天医，小吉下为地医。"""
    return {
        '天医': _jiang_shift('功曹', year_branch, '大吉'),
        '地医': _jiang_shift('功曹', year_branch, '小吉'),
    }


TIANYI_DIYI_TEXT = '又以功曹加太岁，大吉下为天医，小吉下为地医。'


def xingnian_nianli(year_branch, ming_branch, gender):
    """男常以本命加太岁，功曹下为行年，天罡下为年立；女以太岁加本命，传送下为行年，徵明为年立。"""
    if not year_branch or not ming_branch:
        return {}
    if gender == 'female':
        base_jiang = YUE_JIANG_BRANCH.get(year_branch, '')
        return {
            '行年': _jiang_shift(base_jiang, ming_branch, '传送'),
            '年立': _jiang_shift(base_jiang, ming_branch, '徵明'),
        }
    base_jiang = YUE_JIANG_BRANCH.get(ming_branch, '')
    return {
        '行年': _jiang_shift(base_jiang, year_branch, '功曹'),
        '年立': _jiang_shift(base_jiang, year_branch, '天罡'),
    }


XINGNIAN_TEXT = ('男常以本命加太岁，功曹下为行年，天罡下为年立。女以太岁加本命，'
                 '传送下为行年，徵明为年立。')


def _sanhe_lookup(table, branch):
    grp = sanhe_group(branch)
    return table.get(grp, '') if grp else ''


def shensha(*, month_num, year_gz, month_gz, day_gz, hour_gz,
            season='', ming_branch='', gender=''):
    """全部神煞所在之支。返回 {神煞名: {'branch': 支 或 支列表, 'text': 起例原文, ...}}。"""
    out = {}
    month_num = int(month_num or 0)
    yb = year_gz[1] if year_gz and len(year_gz) > 1 else ''
    mb = month_gz[1] if month_gz and len(month_gz) > 1 else ''
    db = day_gz[1] if day_gz and len(day_gz) > 1 else ''
    hb = hour_gz[1] if hour_gz and len(hour_gz) > 1 else ''

    if month_num in DA_SHA:
        out['月大煞'] = {'branch': DA_SHA[month_num], 'text': DA_SHA_TEXT}
    if mb:
        v = _sanhe_lookup(XIAO_SHA_BY_SANHE, mb)
        if v:
            out['月小煞'] = {'branch': v, 'text': XIAO_SHA_TEXT, 'suspect': XIAO_SHA_SUSPECT}
        v = _sanhe_lookup(YUE_JIE_SHA_BY_SANHE, mb)
        if v:
            out['月劫煞'] = {'branch': v, 'text': YUE_JIE_SHA_TEXT}
    if yb:
        v = _sanhe_lookup(JIE_SHA_BY_SANHE, yb)
        if v:
            out['劫煞'] = {'branch': v, 'text': JIE_SHA_TEXT}
    if month_num:
        out['丧门'] = {'branch': SANG_MEN_CYCLE[(month_num - 1) % 4], 'text': SANG_MEN_TEXT}
        out['煞阴'] = {'branch': SHA_YIN.get(month_num, ''), 'text': SHA_YIN_TEXT}
        idx = (BRANCHES.index(TIAN_YI_START_BRANCH) + (month_num - TIAN_YI_START_MONTH)) % 12
        out['天医(左行)'] = {'branch': BRANCHES[idx], 'text': TIAN_YI_TEXT}
        idx = (BRANCHES.index('戌') - (month_num - 1)) % 12
        out['月厌'] = {'branch': BRANCHES[idx], 'text': YUE_YAN_TEXT}
        for months, vals in TIAN_DI_SHA.items():
            if month_num in months:
                for name, br in vals.items():
                    key = name if name != '天医' else '天医(三合)'
                    item = {'branch': br, 'text': TIAN_DI_SHA_TEXT}
                    if name == '天医':
                        item['suspect'] = TIAN_DI_SHA_SUSPECT
                    out[key] = item
                break
    if mb and mb in YUE_XING:
        out['月刑'] = {'branch': YUE_XING[mb], 'text': '月刑：与月支相刑之辰。'}
    # 驿马：年月日时各起
    ma = {}
    for label, br in (('年', yb), ('月', mb), ('日', db), ('时', hb)):
        if br:
            v = _sanhe_lookup(YI_MA_BY_SANHE, br)
            if v:
                ma[label] = v
    if ma:
        out['驿马'] = {'branches': ma, 'branch': ma.get('年', ''), 'text': YI_MA_TEXT}
    if season and season.replace('季夏', '夏') in GUAN_YUE_SEASON:
        gy = GUAN_YUE_SEASON[season.replace('季夏', '夏')]
        out['关'] = {'branch': gy['关'], 'text': GUAN_YUE_TEXT}
        out['籥'] = {'branch': gy['籥'], 'text': GUAN_YUE_TEXT}
    if db:
        out['支德'] = {'branch': ZHI_DE.get(db, ''), 'text': '凡子日德在巳，丑日德在午……（支德）'}
    if yb:
        jl = tianyi_diyi_by_jiang(yb)
        out['天医(月将)'] = {'branch': jl.get('天医', ''), 'text': TIANYI_DIYI_TEXT}
        out['地医(月将)'] = {'branch': jl.get('地医', ''), 'text': TIANYI_DIYI_TEXT}
        if ming_branch:
            xn = xingnian_nianli(yb, ming_branch, gender)
            if xn.get('行年'):
                out['行年'] = {'branch': xn['行年'], 'text': XINGNIAN_TEXT}
            if xn.get('年立'):
                out['年立'] = {'branch': xn['年立'], 'text': XINGNIAN_TEXT}
    return out


# ---------------------------------------------------------------------------
# 六、六神游宫（日干）与行神（月家六神）
# ---------------------------------------------------------------------------

LIUSHEN_ORDER = ('青龍', '朱雀', '螣蛇', '勾陳', '白虎', '玄武')
DAY_GAN_FIRST_BEAST = {'甲': '青龍', '乙': '青龍', '丙': '朱雀', '丁': '朱雀',
                       '戊': '勾陳', '己': '勾陳', '庚': '白虎', '辛': '白虎',
                       '壬': '玄武', '癸': '玄武'}
YOUGONG_TEXT = ('甲乙日青龙在兆，朱雀入木乡，螣蛇入火乡，勾陈入土乡，白虎入金乡，玄武入水乡。'
                '丙丁日朱雀在兆，螣蛇入木乡，勾陈入火乡，白虎入土乡，玄武入金乡，青龙入水乡。'
                '戊己日勾陈在兆，白虎入木乡，玄武入火乡，青龙入土乡，朱雀入金乡，螣蛇入火乡。'
                '庚辛日白虎在兆，玄武入木乡，青龙入火乡，朱雀入土乡，螣蛇入金乡，勾陈入水乡。'
                '壬癸日玄武在兆，青龙入木乡，朱雀入火乡，螣蛇入土乡，勾陈入金乡，白虎入水乡。')
YOUGONG_SUSPECT = ('原卷戊己日一节末作「螣蛇入火乡」，与「玄武入火乡」重出，'
                   '据六神顺行之例当作「螣蛇入水乡」，存疑。')


def liushen_yougong(day_gan):
    """六神游宫：依日干起首兽，顺布兆与五乡。"""
    first = DAY_GAN_FIRST_BEAST.get(str(day_gan or '')[:1], '')
    if not first:
        return []
    start = LIUSHEN_ORDER.index(first)
    return [LIUSHEN_ORDER[(start + i) % 6] for i in range(6)]


def xingshen(month_num):
    """行神（月家六神）：正月起位，左行十二月。返回 {六神: 支}。"""
    month_num = int(month_num or 0)
    if month_num < 1 or month_num > 12:
        return {}
    out = {}
    for beast, start in DC.XINGSHEN_START.items():
        idx = (BRANCHES.index(start) + (month_num - 1)) % 12
        out[beast] = BRANCHES[idx]
    return out


def xingshen_flags(beast, branch):
    """行神死害：某六神所临之支是否为其死／害之地。"""
    rule = DC.LIUSHEN_SI_HAI.get(beast)
    if not rule or not branch:
        return []
    flags = []
    if branch in rule['死']:
        flags.append('死')
    if branch in rule['害']:
        flags.append('害')
    return flags


# ---------------------------------------------------------------------------
# 七、入墓三式、干转支转
# ---------------------------------------------------------------------------

RU_MU_TEXT = {
    '鬼行入墓': ('何谓鬼行入墓？假令六月卜得土兆[木支]，木是土鬼，六月入墓，相克，凶，'
                 '木墓在未故。九月卜得金兆[火支]，火是金鬼，九月火墓在戌。'
                 '十二月卜得木兆[金支]，金是木鬼，金墓十二月。三月卜得水兆(土兆)，'
                 '皆是鬼行入墓。病者恐鬼。'),
    '带煞入墓': ('何谓带煞入墓？假令正月甲申旬中卜得火兆，丙火属戌，正月大煞在戌，'
                 '戌是火墓，名带煞入幕。[卜煞]亦然。'),
    '身入墓': ('何谓身入墓？假令[三月]甲申旬中卜得水兆，壬水属辰，辰是水墓；'
               '六月甲午旬中卜得木兆，乙木属未，未是木墓；九月甲申旬中卜得火，丙火属戌，'
               '戌是火墓；十二月甲午旬中卜得金兆，[辛]金属丑，丑是金墓，身是入墓。'),
}


def rumu_three(*, zhao_elem, zhi_elems, month_branch, xun, dasha_branch):
    """入墓三式判定。zhi_elems = 六位五行（含兆）。

    三式判据各自自足，不设「四墓月」统一前置：鬼行入墓、身入墓以墓库支为准，
    天然只在辰未戌丑月成立；带煞入墓以大煞落于本兆墓库为准，正月即可成立
    （原卷例正为正月甲申旬火兆，丙火属戌，正月大煞在戌）。
    """
    out = []
    # 鬼行入墓：官鬼五行之墓库 == 当月，且盘中确有官鬼支
    gui_elem = ''
    for e in ELEMS:
        if KE.get(e) == zhao_elem:
            gui_elem = e
            break
    if gui_elem and MU_KU.get(gui_elem) == month_branch and gui_elem in zhi_elems[1:]:
        out.append({'name': '鬼行入墓', 'hit': True, 'detail':
                    '本兆%s，官鬼属%s，%s月为%s之墓，盘中见%s支。' %
                    (zhao_elem, gui_elem, BRANCH_MONTH.get(month_branch, ''),
                     gui_elem, gui_elem),
                    'text': RU_MU_TEXT['鬼行入墓']})
    # 身入墓：本兆纳甲之支 == 当月支，且该支为本兆之墓
    nj = najia(zhao_elem, xun)
    for item in nj:
        if item['branch'] == month_branch and MU_KU.get(zhao_elem) == month_branch:
            out.append({'name': '身入墓', 'hit': True, 'detail':
                        '%s属%s，%s是%s墓，身是入墓。' %
                        (item['stem'], item['branch'], item['branch'], zhao_elem),
                        'text': RU_MU_TEXT['身入墓']})
            break
    # 带煞入墓：本兆纳甲之支 == 月大煞之支，且该支为本兆之墓
    for item in nj:
        if dasha_branch and item['branch'] == dasha_branch \
                and MU_KU.get(zhao_elem) == item['branch']:
            out.append({'name': '带煞入墓', 'hit': True, 'detail':
                        '%s%s属%s，大煞在%s，%s是%s墓，名带煞入幕。' %
                        (item['stem'], zhao_elem, item['branch'], dasha_branch,
                         item['branch'], zhao_elem),
                        'text': RU_MU_TEXT['带煞入墓']})
            break
    return out


GAN_ZHUAN_TEXT = ('何名阳德自处？假令卜得木兆并有木支，日在甲寅旬，甲木属寅，寅边有甲，'
                  '即名阳德自处。甲克己土，为财，寅上无土，又得土来从之，合德(得)财，'
                  '故曰干转。')
ZHI_ZHUAN_TEXT = ('何名支转？假令卜得火兆并有火支，日在甲子旬，丙火属寅，卜人自看其身，'
                  '便与看之，不名转；卜人看子，即是丙火能生戊土，即看戊土何辰。'
                  '甲子旬戊土属辰，名伏，见其仇，辰中有木克土，见仇，故曰支转。')


def gan_zhuan(zhao_elem, zhi_elems, xun):
    """干转（阳德自处）：兆与同五行之支并，且该五行阳干于本旬所配之支即其本气之支。"""
    if zhao_elem not in zhi_elems[1:]:
        return None
    yang_stem = ELEM_STEMS.get(zhao_elem, ('',))[0]
    branch = XUN_STEM_BRANCH.get(xun, {}).get(yang_stem, '')
    if not branch:
        return None
    if BRANCH_ELEM.get(branch) != zhao_elem:
        return None
    return {'name': '干转（阳德自处）', 'stem': yang_stem, 'branch': branch,
            'detail': '%s%s属%s，%s边有%s，即名阳德自处。' %
                      (yang_stem, zhao_elem, branch, branch, yang_stem),
            'text': GAN_ZHUAN_TEXT}


def zhi_zhuan(zhao_elem, zhi_elems, xun):
    """支转：兆与同五行之支并，看兆之子所纳之支，支中藏克则曰见仇。"""
    if zhao_elem not in zhi_elems[1:]:
        return None
    child = SHENG.get(zhao_elem, '')
    if not child:
        return None
    yang_stem = ELEM_STEMS.get(child, ('',))[0]
    branch = XUN_STEM_BRANCH.get(xun, {}).get(yang_stem, '')
    if not branch:
        return None
    # 见仇：所伏之支中藏有克该五行之干（原卷例「甲子旬戊土属辰……辰中有木克土，见仇」）
    chou = [h for h in BRANCH_HIDDEN.get(branch, ())
            if KE.get(STEM_ELEM.get(h, '')) == child]
    detail = '%s能生%s，%s%s属%s，名伏。' % (zhao_elem, child, yang_stem, child, branch)
    if chou:
        detail += '%s中有%s（%s）克%s，见仇，故曰支转。' % (
            branch, '、'.join(chou), STEM_ELEM.get(chou[0], ''), child)
    return {'name': '支转', 'stem': yang_stem, 'branch': branch,
            'xianchou': bool(chou), 'chouStems': chou,
            'detail': detail, 'text': ZHI_ZHUAN_TEXT}


# ---------------------------------------------------------------------------
# 八、君子小人、身命、头身足
# ---------------------------------------------------------------------------

def junzi_xiaoren(zhao_elem, day_branch, day_gan):
    """君子小人：凡克我者为君子，我克者为小人（我 = 本兆，彼 = 日支）。"""
    out = {'zhaoElem': zhao_elem, 'dayBranch': day_branch}
    db_elem = BRANCH_ELEM.get(day_branch, '')
    out['dayBranchElem'] = db_elem
    out['head'] = DC.JUNZI_HEAD
    if db_elem and KE.get(db_elem) == zhao_elem:
        out['role'] = '君子'
        out['reason'] = '日支%s属%s，克本兆%s，克我者为君子。' % (day_branch, db_elem, zhao_elem)
    elif db_elem and KE.get(zhao_elem) == db_elem:
        out['role'] = '小人'
        out['reason'] = '本兆%s克日支%s（属%s），我克者为小人。' % (zhao_elem, day_branch, db_elem)
    else:
        out['role'] = ''
        out['reason'] = '本兆与日支非相克之属，不成君子小人之别。'
    out['texts'] = [t for t in (DC.JUNZI_BY_ZHAO_A.get(zhao_elem),
                                DC.JUNZI_BY_ZHAO_B.get(zhao_elem),
                                DC.JUNZI_BY_ZHAO_C.get(zhao_elem)) if t]
    out['yinyangZhao'] = '阳' if zhao_elem in DC.YANG_ZHAO else '阴'
    out['yinyangRule'] = DC.YINYANG_ZHAO_RULE
    # 剥落：日干克本兆
    gan = str(day_gan or '')[:1]
    pair = ELEM_GANPAIR.get(STEM_ELEM.get(gan, ''), '')
    boluo = DC.BOLUO_PAIRS.get((pair, zhao_elem))
    if boluo:
        yy = '阳' if day_branch in DC.YANG_BRANCHES else (
            '阴' if day_branch in DC.YIN_BRANCHES else '')
        out['boluo'] = {
            'hit': True, 'text': boluo, 'dayGanPair': pair,
            'dayYinYang': yy,
            'verdict': ('阳日卜得剥落，君子。' if yy == '阳' else
                        ('阴日卜得剥卦，小人。' if yy == '阴' else '')),
            'rule': DC.BOLUO_YINYANG,
        }
    else:
        out['boluo'] = {'hit': False, 'rule': DC.BOLUO_YINYANG}
    return out


def shen_ming(zhao_elem, day_gan):
    """身命：兆为身，日辰为命。"""
    gan = str(day_gan or '')[:1]
    pair = ELEM_GANPAIR.get(STEM_ELEM.get(gan, ''), '')
    out = {'head': DC.SHEN_MING_HEAD, 'dayGan': gan, 'dayGanPair': pair}
    if DC.SHEN_KE_MING.get(pair) == zhao_elem:
        out['verdict'] = '身克命'
        out['luck'] = 'xiong'
        out['text'] = DC.SHEN_KE_MING_TEXT
        out['detail'] = '身克命多凶，主不得、假。'
    elif DC.MING_KE_SHEN.get(pair) == zhao_elem:
        out['verdict'] = '命克身'
        out['luck'] = 'ji'
        out['text'] = DC.MING_KE_SHEN_TEXT
        out['detail'] = '命克身为吉，主得、真。'
    else:
        out['verdict'] = ''
        out['luck'] = 'ping'
        out['detail'] = '本兆与日干非身克命、命克身之属。'
    return out


TOU_SHEN_ZU_MAP = {'木': '头', '火': '头', '土': '身', '金': '足', '水': '足'}


def tou_shen_zu(zhao_elem, elements):
    """头身足：头者木与火乡，身土乡，足金与水乡；用于占出行。"""
    parts = {'头': [], '身': [], '足': []}
    for i, xiang in enumerate(XIANG_ORDER, start=1):
        part = TOU_SHEN_ZU_MAP.get(xiang, '')
        if not part:
            continue
        zhi = elements[i]
        fu, fu_text = fu_yi_of(xiang, zhi)
        ke = ''
        if KE.get(zhi) == xiang:
            ke = '被克'
        elif KE.get(xiang) == zhi:
            ke = '克支'
        parts[part].append({'xiang': xiang + '乡', 'zhi': zhi, 'fuyi': fu, 'ke': ke,
                            'fuyiText': fu_text})
    return {'head': DC.TOU_SHEN_ZU_HEAD, 'parts': parts,
            'zhaoPart': TOU_SHEN_ZU_MAP.get(zhao_elem, '')}


# ---------------------------------------------------------------------------
# 九、细分六亲两法（纳甲）
# ---------------------------------------------------------------------------

def _parent_elem(elem):
    """生我者（父母之五行）。"""
    for e in ELEMS:
        if SHENG.get(e) == elem:
            return e
    return ''


def _officer_elem(elem):
    """克我者（官鬼之五行）。"""
    for e in ELEMS:
        if KE.get(e) == elem:
            return e
    return ''


def liuqin_yinyang(zhao_elem):
    """五行阴阳细分六亲：我为某干，则弟／长子／次女／父／母／正妻／偏财／长辈／女各有所属。

    原文以丙火为例：我丙、弟丁、长子戊、次女己、父甲、母乙、正妻庚、偏财辛、
    长辈男壬、女癸 —— 长辈取克我之官鬼（壬癸水克丙火），非生我之父母。
    """
    yang, yin = ELEM_STEMS.get(zhao_elem, ('', ''))
    child = SHENG.get(zhao_elem, '')
    father = _parent_elem(zhao_elem)
    wealth = KE.get(zhao_elem, '')
    elder = _officer_elem(zhao_elem)
    cy, cyin = ELEM_STEMS.get(child, ('', ''))
    fy, fyin = ELEM_STEMS.get(father, ('', ''))
    wy, wyin = ELEM_STEMS.get(wealth, ('', ''))
    ey, eyin = ELEM_STEMS.get(elder, ('', ''))
    return {
        'rule': '五行阴阳细分六亲之法：我为阳干，弟为同行阴干；男孩（长子）为我生之阳干，'
                '女孩（次女）为我生之阴干；父为生我之阳干，母为生我之阴干；'
                '正妻正财为我克之阳干，小妾偏财为我克之阴干；长辈为男为生我之阳干，'
                '女为生我之阴干。',
        'me': yang, 'brother': yin,
        'son': cy, 'daughter': cyin,
        'father': fy, 'mother': fyin,
        'wife': wy, 'concubine': wyin,
        'elderMale': ey, 'elderFemale': eyin,
        'text': '我为丙火，弟为丁火（若我是弟则为丁火，兄为丙火），男孩、长子为戊土，'
                '女孩、次子为己土，父为甲木，木为乙木，正妻正财为庚金，小妾偏财为辛金'
                '（若为现代，妻为庚金，财为辛金），长辈为男为壬水，女为癸水。',
    }


GAN_HE = {'甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙',
          '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊'}


def liuqin_ganhe(zhao_elem):
    """干合生克细分六亲：我之阳干起，妻为干合之干，母为生我之阴干，父为母之干合，子为妻所生。

    原文以甲木为例：我甲、妻己（甲己合）、母癸、父戊（戊癸合，且甲克戊）、
    子女庚辛（己土所生）。母取阴干方能使「父为母之干合而我克之」自洽
    （母若取壬，则父为丁，甲不克丁）；校录亦注「上文母为壬水恐错」。
    """
    me = ELEM_STEMS.get(zhao_elem, ('', ''))[0]
    brother = ELEM_STEMS.get(zhao_elem, ('', ''))[1]
    wife = GAN_HE.get(me, '')
    mother = ELEM_STEMS.get(_parent_elem(zhao_elem), ('', ''))[1]
    father = GAN_HE.get(mother, '')
    wife_child_elem = SHENG.get(STEM_ELEM.get(wife, ''), '')
    son, daughter = ELEM_STEMS.get(wife_child_elem, ('', ''))
    child_elem = wife_child_elem
    return {
        'rule': '干合生克细分六亲之法：我为甲木，己土为妻，此为天干五合。癸水为母，'
                '生我者也，戊土为父，五合于母，我克于父。子为妻所生，如我为母所生，'
                '故庚辛为子女，亦是我克，如我克父也。虽可以我起始，上下网络，然一前一后，'
                '三代即可。',
        'me': me, 'wife': wife, 'mother': mother, 'father': father,
        'son': son, 'daughter': daughter, 'brother': brother,
        'childElem': child_elem,
    }


# ---------------------------------------------------------------------------
# 十、五兆入何方、杂言命中
# ---------------------------------------------------------------------------

def match_ru_he_fang(zhao_elem, zhi_elem, elements):
    """占五兆入于何方：以本兆与身宫所入之支，判所入之乡干。"""
    hits = []
    for group in DC.RU_HE_FANG:
        gan = group['pairs'].get((zhao_elem, zhi_elem))
        if not gan:
            continue
        target_elem = GANPAIR_ELEM.get(gan, '')
        present = target_elem in elements[1:]
        hits.append({'title': group['title'], 'text': group['text'], 'luck': group['luck'],
                     'ruGan': gan, 'ruElem': target_elem, 'xiangPresent': present})
    return hits


def match_zayan(zhao_elem, zhi_elem, elements, wangshuai_map):
    """五兆杂言命中：韵文象辞、相刑、见物、鬼入卦、入乡诸式。"""
    out = {'general': list(DC.ZAYAN_GENERAL), 'items': []}
    for cond, text in DC.ZAYAN_YUNWEN:
        if cond and cond[0] == zhao_elem and cond[1] == zhi_elem:
            out['items'].append({'kind': '韵文象辞', 'text': text})
    xx = DC.ZAYAN_XIANGXING.get((zhao_elem, zhi_elem))
    if xx:
        out['items'].append({'kind': '两两相刑', 'text': xx})
    out['xiangshi'] = list(DC.ZAYAN_XIANGSHI)
    out['jianwu'] = list(DC.ZAYAN_JIANWU)
    # 鬼入卦：官鬼五行之休王 → 五类鬼
    gui_elem = ''
    for e in ELEMS:
        if KE.get(e) == zhao_elem:
            gui_elem = e
            break
    if gui_elem and gui_elem in elements[1:]:
        ws = wangshuai_map.get(gui_elem, '')
        key = ws.replace('休废', '休') if ws else ''
        text = DC.GUI_RU_GUA.get(key) or DC.GUI_RU_GUA.get(ws)
        if text:
            out['items'].append({'kind': '鬼入卦', 'text': text,
                                 'detail': '官鬼属%s，当令为%s。' % (gui_elem, ws)})
    # 兆身与支之生克
    if KE.get(zhao_elem) == zhi_elem:
        out['items'].append({'kind': '兆身克支', 'text': '兆身克支，忧妻。'})
    elif KE.get(zhi_elem) == zhao_elem:
        out['items'].append({'kind': '支克兆身', 'text': '支克兆身，忧病患、官书。'})
    elif SHENG.get(zhao_elem) == zhi_elem:
        out['items'].append({'kind': '兆身生支', 'text': '兆身生支，为子。'})
    elif SHENG.get(zhi_elem) == zhao_elem:
        out['items'].append({'kind': '支生兆身', 'text': '支生兆身，父母吉。'})
    # 王相胎没兆分类
    zhao_ws = wangshuai_map.get(zhao_elem, '')
    cls = {'王': '王兆为官财', '相': '相兆为己财', '胎': '胎兆为妇人', '没': '没为儿子'}
    if zhao_ws in cls:
        out['items'].append({'kind': '兆之休王', 'text': cls[zhao_ws] + '。'})
    elif zhao_ws in ('囚', '死', '休', '废', '休废'):
        out['items'].append({'kind': '兆之休王', 'text': '囚、死、休、废为疾病。'})
    # 父母/子/鬼/身入乡系列
    ru_xiang = []
    for i, xiang in enumerate(XIANG_ORDER, start=1):
        zhi = elements[i]
        zhi_role = liuqin_of(zhao_elem, zhi)
        xiang_role = liuqin_of(zhao_elem, xiang)
        for src_role, dst_role, name, text in DC.RU_XIANG_RULES:
            if zhi_role == src_role and xiang_role == dst_role:
                ru_xiang.append({'xiang': xiang + '乡', 'zhi': zhi, 'name': name,
                                 'text': text, 'zhiRole': zhi_role, 'xiangRole': xiang_role})
    out['ruXiang'] = ru_xiang
    out['fangwei'] = DC.ZHAO_FANGWEI.get(zhao_elem, '')
    # 头戴系列
    dai = DC.TOU_DAI.get((zhao_elem, zhi_elem))
    if dai:
        out['items'].append({'kind': '头足象辞', 'text': dai})
    return out


# ---------------------------------------------------------------------------
# 十一、断辞检索
# ---------------------------------------------------------------------------

def duanci_25(zhao_elem, elements):
    """廿五式：逐乡「见何支」断辞（五条）。"""
    rows = []
    for i, xiang in enumerate(XIANG_ORDER, start=1):
        zhi = elements[i]
        hit = DC.DUANCI_25.get(zhao_elem, {}).get(xiang, {}).get(zhi)
        if not hit:
            continue
        text, luck = hit
        item = {
            'xiang': xiang + '乡', 'xiangElem': xiang, 'zhiElem': zhi,
            'xiangRole': DC.XIANG_ROLE.get(zhao_elem, {}).get(xiang, ''),
            'zhiRole': liuqin_of(zhao_elem, zhi),
            'text': text, 'luck': luck,
        }
        sus = DC.DUANCI_25_SUSPECT.get((zhao_elem, xiang, zhi))
        if sus:
            item['suspect'] = sus
        rows.append(item)
    return rows


def duanci_zhaozhi(zhao_elem, zhi_elem):
    hit = DC.DUANCI_ZHAOZHI.get(zhao_elem, {}).get(zhi_elem)
    if not hit:
        return None
    text, luck = hit
    return {'text': text, 'luck': luck, 'title': '%s兆%s支' % (zhao_elem, zhi_elem)}


def duanci_sishi(zhao_elem, zhi_elem):
    key = (zhao_elem, zhi_elem)
    text = DC.DUANCI_SISHI.get(key)
    if not text:
        miss = DC.DUANCI_SISHI_MISSING.get(key)
        if miss:
            return {'text': '', 'missing': miss,
                    'title': '%s兆%s支' % (zhao_elem, zhi_elem)}
        return None
    out = {'text': text, 'title': '%s兆%s支' % (zhao_elem, zhi_elem)}
    sus = DC.DUANCI_SISHI_SUSPECT.get(key)
    if sus:
        out['suspect'] = sus
    return out


# ---------------------------------------------------------------------------
# 十二、enrich —— 古法层总入口
# ---------------------------------------------------------------------------

def enrich(*, elements, ganzhi, jieqi='', lunar_month=0, options=None):
    """把《要诀略》古法层结果叠加到排盘之上。

    Args:
        elements: 六位五行，[兆, 木乡之支, 火乡之支, 土乡之支, 金乡之支, 水乡之支]。
        ganzhi:   [年柱, 月柱, 日柱, 时柱, 分柱]。
        jieqi:    节气名。
        lunar_month: 农历月序（1-12），用于定季夏与月家神煞。
        options:  {'xingshenMonth': 'lunar'|'jieqi', 'mingZhi': 支, 'gender': 'male'|'female'}
    """
    opts = options or {}
    elements = list(elements or [])
    while len(elements) < 6:
        elements.append('')
    gz = list(ganzhi or [])
    while len(gz) < 5:
        gz.append('')
    year_gz, month_gz, day_gz, hour_gz, minute_gz = gz[:5]

    zhao = elements[0]
    zhi = elements[XIANG_ORDER.index(zhao) + 1] if zhao in XIANG_ORDER else ''
    day_gan = str(day_gz or '')[:1]
    day_branch = str(day_gz or '')[1:2]
    season = season_of(jieqi, lunar_month)

    # 行神月制：默认农历月；'jieqi' 时以月建（节气月）为准
    month_mode = opts.get('xingshenMonth') or 'lunar'
    month_branch = str(month_gz or '')[1:2]
    jieqi_month = BRANCH_MONTH.get(month_branch, 0)
    month_num = int(lunar_month or 0) if month_mode == 'lunar' else jieqi_month
    if not month_num:
        month_num = jieqi_month or int(lunar_month or 0)

    xun = xun_of(day_gz)
    kongwang = XUN_KONGWANG.get(xun, ())
    beasts = liushen_yougong(day_gan)
    xs_map = xingshen(month_num)
    ss = shensha(month_num=month_num, year_gz=year_gz, month_gz=month_gz,
                 day_gz=day_gz, hour_gz=hour_gz, season=season,
                 ming_branch=opts.get('mingZhi') or '', gender=opts.get('gender') or '')

    wangshuai_map = {e: wangshuai_of(e, season) for e in ELEMS}

    # 逐位古法信息
    positions = []
    for idx in range(6):
        elem = elements[idx]
        is_zhao = idx == 0
        xiang_elem = zhao if is_zhao else XIANG_ORDER[idx - 1]
        # 乡与支各自纳甲（今传纳甲之法：本兆、五乡、入支对应之五行各配六十甲子）。
        # 神煞、行神、空亡之命中两者皆算，各标其所自出，不并作一处。
        nj = najia(elem, xun)
        xiang_nj = najia(xiang_elem, xun) if not is_zhao else nj
        nj_branches = [it['branch'] for it in nj]
        xiang_branches = [it['branch'] for it in xiang_nj]
        all_branches = list(dict.fromkeys(xiang_branches + nj_branches))
        item = {
            'index': idx,
            'label': POSITION_LABELS[idx],
            'xiangElem': xiang_elem,
            'elem': elem,
            'role': '本兆' if is_zhao else liuqin_of(zhao, elem),
            'xiangRole': '本兆' if is_zhao else DC.XIANG_ROLE.get(zhao, {}).get(xiang_elem, ''),
            'beast': beasts[idx] if idx < len(beasts) else '',
            'wangshuai': wangshuai_of(xiang_elem, season),
            'qi': qi_of(wangshuai_of(xiang_elem, season)),
            'najia': nj,
            'xiangNajia': xiang_nj,
            'kongwang': [b for b in nj_branches if b in kongwang],
            'xiangKongwang': [b for b in xiang_branches if b in kongwang],
        }
        if not is_zhao:
            rel = xiang_zhi_relation(zhao, xiang_elem, elem)
            if rel:
                item['xiang13'] = rel
            fu, fu_text = fu_yi_of(xiang_elem, elem)
            if fu:
                item['fuyi'] = fu
                item['fuyiText'] = fu_text
        # 本位纳甲支所犯神煞（乡、支两路纳甲各查，标其所自出）
        shensha_hits = []
        for name, info in ss.items():
            br = info.get('branch')
            if not br or br not in all_branches:
                continue
            src = []
            if br in xiang_branches:
                src.append('乡')
            if br in nj_branches:
                src.append('支')
            shensha_hits.append({'name': name, 'branch': br, 'from': '／'.join(src)})
        if shensha_hits:
            item['shensha'] = shensha_hits
        # 行神所临（以纳甲支反查）
        xingshen_hits = []
        for beast, br in xs_map.items():
            if br not in all_branches:
                continue
            src = []
            if br in xiang_branches:
                src.append('乡')
            if br in nj_branches:
                src.append('支')
            xingshen_hits.append({'beast': beast, 'branch': br, 'from': '／'.join(src),
                                  'flags': xingshen_flags(beast, br)})
        if xingshen_hits:
            item['xingshen'] = xingshen_hits
        positions.append(item)

    # 行神总表
    xingshen_rows = []
    for beast in LIUSHEN_ORDER:
        br = xs_map.get(beast, '')
        row = {'beast': beast, 'branch': br, 'flags': xingshen_flags(beast, br),
               'sanchen': DC.XINGSHEN_SANCHEN.get(beast, '')}
        sus = DC.XINGSHEN_START_SUSPECT.get(beast)
        if sus:
            row['suspect'] = sus
        xingshen_rows.append(row)

    # 行伏：行神与游宫伏神同临一位者
    xing_fu_hits = []
    for idx, pos in enumerate(positions):
        fu_beast = pos.get('beast', '')
        for hit in pos.get('xingshen', []):
            key = (hit['beast'], fu_beast)
            text = DC.XING_FU.get(key)
            if text:
                xing_fu_hits.append({'position': pos['label'], 'xing': hit['beast'],
                                     'fu': fu_beast, 'text': text})
            elif hit['beast'] == fu_beast:
                he = DC.XING_FU_HE.get(fu_beast)
                if he:
                    xing_fu_hits.append({'position': pos['label'], 'xing': hit['beast'],
                                         'fu': fu_beast, 'text': he})

    # 冲合刑害（以各位纳甲支与日支相较；乡支两路纳甲去重后同查）
    ganzhi_rel = []
    if day_branch:
        for pos in positions:
            seen_gz = set()
            for it in (pos.get('xiangNajia') or []) + pos['najia']:
                if it['gz'] in seen_gz:
                    continue
                seen_gz.add(it['gz'])
                br = it['branch']
                rels = []
                if CHONG.get(br) == day_branch:
                    rels.append('冲')
                if LIUHE.get(br) == day_branch:
                    rels.append('合')
                if XING.get(br) == day_branch:
                    rels.append('刑')
                if LIUHAI.get(br) == day_branch:
                    rels.append('害')
                grp = sanhe_group(br)
                if grp and day_branch in grp and day_branch != br:
                    rels.append('三合%s局' % SANHE[grp])
                if rels:
                    ganzhi_rel.append({'position': pos['label'], 'gz': it['gz'],
                                       'branch': br, 'rels': rels, 'dayBranch': day_branch})

    dasha = ss.get('月大煞', {}).get('branch', '')
    rumu = rumu_three(zhao_elem=zhao, zhi_elems=elements,
                      month_branch=MONTH_BRANCH.get(month_num, ''),
                      xun=xun, dasha_branch=dasha)

    kw_zhao = KONGWANG_ZHAO.get(xun, {}).get(zhao, '')
    kongwang_block = {
        'xun': xun,
        'branches': list(kongwang),
        'text': KONGWANG_TEXT.get(xun, ''),
        'zhaoText': kw_zhao,
        'general': KONGWANG_GENERAL,
        'wuzi': KONGWANG_WUZI,
    }
    sus = KONGWANG_ZHAO_SUSPECT.get(xun)
    if sus:
        kongwang_block['suspect'] = sus

    season_block = {'season': season, 'map': wangshuai_map,
                    'text': DC.SISHI_WANGSHUAI_TEXT,
                    'zhaoWangshuai': wangshuai_map.get(zhao, ''),
                    'zhaoQi': qi_of(wangshuai_map.get(zhao, ''))}
    sus = SEASON_WANGSHUAI_SUSPECT.get(season)
    if sus:
        season_block['suspect'] = sus

    return {
        'zhaoElem': zhao,
        'zhiElem': zhi,
        'shenGong': (zhao + '乡') if zhao else '',
        'season': season,
        'monthNum': month_num,
        'monthMode': month_mode,
        'xun': xun,
        'dayGan': day_gan,
        'dayBranch': day_branch,
        'positions': positions,
        'qi': season_block,
        'changsheng': {'text': DC.TWELVE_STAGES_TEXT.get(zhao, ''), 'elem': zhao},
        'zhaoJu': {'head': DC.ZHAO_JU_HEAD.get(zhao, ''),
                   'zongxiang': DC.ZHAO_ZONGXIANG.get(zhao, ''),
                   'role': DC.XIANG_ROLE.get(zhao, {})},
        'duanci25': duanci_25(zhao, elements),
        'duanciZhaozhi': duanci_zhaozhi(zhao, zhi),
        'duanciSishi': duanci_sishi(zhao, zhi),
        'junzi': junzi_xiaoren(zhao, day_branch, day_gan),
        'junziZhaozhi': DC.JUNZI_ZHAOZHI.get((zhao, zhi), ''),
        'shenming': shen_ming(zhao, day_gan),
        'toushenzu': tou_shen_zu(zhao, elements),
        'najia': {
            'xun': xun,
            'xunTable': XUN_STEM_BRANCH.get(xun, {}),
            'kongwang': kongwang_block,
            'ganZhuan': gan_zhuan(zhao, elements, xun),
            'zhiZhuan': zhi_zhuan(zhao, elements, xun),
            'ruMu': rumu,
            'relations': ganzhi_rel,
            'liuqinYinYang': liuqin_yinyang(zhao),
            'liuqinGanHe': liuqin_ganhe(zhao),
            'liushu': {'text': LIUSHU_TEXT, 'map': LIUSHU},
            'wuhe': {'text': WUHE_TEXT, 'tianen': TIANEN_TEXT,
                     'dayHe': WUHE.get(str(day_gz or ''), ''),
                     'dayLi': str(day_gz or '') in WULI},
            'tianshe': {'text': TIANSHE_MUCANG_TEXT,
                        'hit': TIANSHE.get(season, '') == str(day_gz or ''),
                        'mucang': list(MUCANG.get(season, ()))},
            'xingText': XING_TEXT, 'liuhaiText': LIUHAI_TEXT, 'sanheText': SANHE_TEXT,
        },
        'shensha': {
            'items': [{'name': k, **v} for k, v in ss.items()],
            'qiuMuMonthly': QIU_MU_MONTHLY.get(month_num, {}),
            'qiuMuSeasonal': QIU_MU_SEASONAL.get(season.replace('季夏', '夏'), {}),
            'qiuMuSuspect': QIU_MU_SUSPECT,
            'yuText': YU_TEXT,
            'taisui': TAISUI_MINGFEN,
        },
        'liushen': {
            'yougong': [{'position': POSITION_LABELS[i],
                         'beast': beasts[i] if i < len(beasts) else ''}
                        for i in range(6)],
            'yougongText': YOUGONG_TEXT,
            'yougongSuspect': YOUGONG_SUSPECT,
            'zhushi': DC.LIUSHEN_ZHUSHI,
            'se': DC.LIUSHEN_SE, 'seText': DC.LIUSHEN_SE_TEXT,
            'xiangsheng': DC.LIUSHEN_XIANGSHENG,
            'zhaoBing': DC.ZHAO_BING_LIUSHEN.get(
                beasts[0] if beasts else '', ''),
            'zhaoBingAll': DC.ZHAO_BING_LIUSHEN,
            'qiWuxiang': DC.ZHAO_QI_WUXIANG.get(zhao, {}),
            'suoRu': DC.LIUSHEN_SUO_RU,
            'ruJin': DC.LIUSHEN_RU_JIN,
        },
        'xingshen': {
            'head': DC.XINGSHEN_HEAD,
            'monthNum': month_num,
            'rows': xingshen_rows,
            'xingFu': xing_fu_hits,
            'xingZhong': DC.XING_ZHONG,
            'siHai': DC.LIUSHEN_SI_HAI,
            'cases': DC.XINGSHEN_CASES,
        },
        'ruHeFang': match_ru_he_fang(zhao, zhi, elements),
        'zayan': match_zayan(zhao, zhi, elements, wangshuai_map),
        'weijie': DC.WEIJIE,
        'shu': {'shengcheng': SHENG_CHENG_SHU, 'shengchengText': SHENG_CHENG_TEXT,
                'ganShu': GAN_SHU, 'zhiShu': ZHI_SHU, 'ganzhiShuText': GANZHI_SHU_TEXT,
                'wuyin': WUYIN_SHU, 'wuyinText': WUYIN_TEXT},
    }
