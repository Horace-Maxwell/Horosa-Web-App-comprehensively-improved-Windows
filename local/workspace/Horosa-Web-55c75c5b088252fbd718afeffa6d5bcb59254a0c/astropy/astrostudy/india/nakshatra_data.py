"""
27 宿权威属性表（Nakshatra rich dataset）。

为印占引擎提供每宿的静态文化/分类属性 —— 与 astrostudy/nakshatra.py 的几何计算
(index/name/label/lord/pada) 分离。本模块只承载「属性」，不做经度判定逻辑之外的计算。

字段来源：
  · 主表（"权威宿属性表"）：sanskrit/labelCn/rangeStart/lord/activity/varna/facing/
    windDir/gunas/purushartha/element/gender/gana/bodyPart/symbol —— 每行逐字转录。
  · 标准补充：deity / yoniAnimal —— 主表未列，按印占通行口径补齐（见 # 标准补充）。

纯数据 + 纯函数，零外部依赖。lord 顺序与 astrostudy/nakshatra.py NAKSHATRAS 严格一致
(Ketu·Venus·Sun·Moon·Mars·Rahu·Jupiter·Saturn·Mercury ×3)。
"""

# 每宿跨度 13°20' = 13.3333°；rangeEnd = rangeStart + NAK_SPAN。
NAK_SPAN = 360.0 / 27.0  # 13.333...

# ── 权威宿属性表 ──
# index | sanskrit | labelCn | rangeStart | lord | activity | varna | facing |
# windDir | gunas | purushartha | element | gender | gana | bodyPart | symbol
NAKSHATRA_DATA = [
    {
        'index': 1, 'sanskrit': 'Ashwini', 'labelCn': '娄', 'rangeStart': 0.0,
        'lord': 'Ketu', 'activity': '被动', 'varna': '吠舍', 'facing': '水平',
        'windDir': '南', 'gunas': 'RRR', 'purushartha': '法', 'element': '地',
        'gender': '阳', 'gana': '神', 'bodyPart': '膝·脚上半', 'symbol': '马头',
        'deity': 'Ashwini-Kumaras', 'yoniAnimal': '马',  # 标准补充
    },
    {
        'index': 2, 'sanskrit': 'Bharani', 'labelCn': '胃', 'rangeStart': 13.3333,
        'lord': 'Venus', 'activity': '平衡', 'varna': '种姓外', 'facing': '向下',
        'windDir': '西', 'gunas': 'RRT', 'purushartha': '利', 'element': '地',
        'gender': '阴', 'gana': '人', 'bodyPart': '头·脚底', 'symbol': '女阴',
        'deity': 'Yama', 'yoniAnimal': '象',  # 标准补充
    },
    {
        'index': 3, 'sanskrit': 'Krittika', 'labelCn': '昴', 'rangeStart': 26.6667,
        'lord': 'Sun', 'activity': '主动', 'varna': '婆罗门', 'facing': '向下',
        'windDir': '北', 'gunas': 'RRS', 'purushartha': '欲', 'element': '地',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '臀·腰·头上半(后)', 'symbol': '剃刀',
        'deity': 'Agni', 'yoniAnimal': '羊',  # 标准补充
    },
    {
        'index': 4, 'sanskrit': 'Rohini', 'labelCn': '毕', 'rangeStart': 40.0,
        'lord': 'Moon', 'activity': '平衡', 'varna': '首陀罗', 'facing': '向上',
        'windDir': '东', 'gunas': 'RTR', 'purushartha': '解脱', 'element': '地',
        'gender': '阴', 'gana': '人', 'bodyPart': '腰·腿·肚·踝', 'symbol': '牛车/皇室座车',
        'deity': 'Brahma', 'yoniAnimal': '蛇',  # 标准补充
    },
    {
        'index': 5, 'sanskrit': 'Mrigashira', 'labelCn': '觜', 'rangeStart': 53.3333,
        'lord': 'Mars', 'activity': '被动', 'varna': '奴僕', 'facing': '水平',
        'windDir': '南', 'gunas': 'RTT', 'purushartha': '解脱', 'element': '地',
        'gender': '中', 'gana': '神', 'bodyPart': '眼睛·眉毛', 'symbol': '鹿头',
        'deity': 'Soma', 'yoniAnimal': '蛇',  # 标准补充
    },
    {
        'index': 6, 'sanskrit': 'Ardra', 'labelCn': '参', 'rangeStart': 66.6667,
        'lord': 'Rahu', 'activity': '平衡', 'varna': '屠夫', 'facing': '向上',
        'windDir': '西', 'gunas': 'RTS', 'purushartha': '欲', 'element': '水',
        'gender': '阴', 'gana': '人', 'bodyPart': '颈后上端·眼睛', 'symbol': '钻石/泪珠',
        'deity': 'Rudra', 'yoniAnimal': '犬',  # 标准补充
    },
    {
        'index': 7, 'sanskrit': 'Punarvasu', 'labelCn': '井', 'rangeStart': 80.0,
        'lord': 'Jupiter', 'activity': '被动', 'varna': '吠舍', 'facing': '水平',
        'windDir': '北', 'gunas': 'RSR', 'purushartha': '利', 'element': '水',
        'gender': '阳', 'gana': '神', 'bodyPart': '手指·鼻子', 'symbol': '弓',
        'deity': 'Aditi', 'yoniAnimal': '猫',  # 标准补充
    },
    {
        'index': 8, 'sanskrit': 'Pushya', 'labelCn': '鬼', 'rangeStart': 93.3333,
        'lord': 'Saturn', 'activity': '被动', 'varna': '刹帝利', 'facing': '向上',
        'windDir': '东', 'gunas': 'RST', 'purushartha': '法', 'element': '水',
        'gender': '阳', 'gana': '神', 'bodyPart': '嘴·脸', 'symbol': '花/箭/圆',
        'deity': 'Brihaspati', 'yoniAnimal': '羊',  # 标准补充
    },
    {
        'index': 9, 'sanskrit': 'Ashlesha', 'labelCn': '柳', 'rangeStart': 106.6667,
        'lord': 'Mercury', 'activity': '主动', 'varna': '种姓外', 'facing': '向下',
        'windDir': '南', 'gunas': 'RSS', 'purushartha': '法', 'element': '水',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '关节·指甲·耳朵', 'symbol': '蛇',
        'deity': 'Nagas', 'yoniAnimal': '猫',  # 标准补充
    },
    {
        'index': 10, 'sanskrit': 'Magha', 'labelCn': '星', 'rangeStart': 120.0,
        'lord': 'Ketu', 'activity': '主动', 'varna': '首陀罗', 'facing': '向下',
        'windDir': '西', 'gunas': 'TRR', 'purushartha': '利', 'element': '水',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '脚·身左侧', 'symbol': '肩上轿子',
        'deity': 'Pitris', 'yoniAnimal': '鼠',  # 标准补充
    },
    {
        'index': 11, 'sanskrit': 'PurvaPhalguni', 'labelCn': '张', 'rangeStart': 133.3333,
        'lord': 'Venus', 'activity': '平衡', 'varna': '婆罗门', 'facing': '向下',
        'windDir': '北', 'gunas': 'TRT', 'purushartha': '欲', 'element': '水',
        'gender': '阴', 'gana': '人', 'bodyPart': '性器官', 'symbol': '床前脚',
        'deity': 'Bhaga', 'yoniAnimal': '鼠',  # 标准补充
    },
    {
        'index': 12, 'sanskrit': 'UttaraPhalguni', 'labelCn': '翼', 'rangeStart': 146.6667,
        'lord': 'Sun', 'activity': '平衡', 'varna': '刹帝利', 'facing': '向上',
        'windDir': '东', 'gunas': 'TRS', 'purushartha': '解脱', 'element': '火',
        'gender': '阴', 'gana': '人', 'bodyPart': '性器官·左手', 'symbol': '床后二脚',
        'deity': 'Aryaman', 'yoniAnimal': '牛',  # 标准补充
    },
    {
        'index': 13, 'sanskrit': 'Hasta', 'labelCn': '轸', 'rangeStart': 160.0,
        'lord': 'Moon', 'activity': '被动', 'varna': '吠舍', 'facing': '水平',
        'windDir': '南', 'gunas': 'TTR', 'purushartha': '解脱', 'element': '火',
        'gender': '阳', 'gana': '神', 'bodyPart': '手·手指头', 'symbol': '手',
        'deity': 'Savitar', 'yoniAnimal': '水牛',  # 标准补充
    },
    {
        'index': 14, 'sanskrit': 'Chitra', 'labelCn': '角', 'rangeStart': 173.3333,
        'lord': 'Mars', 'activity': '主动', 'varna': '奴僕', 'facing': '水平',
        'windDir': '西', 'gunas': 'TTT', 'purushartha': '欲', 'element': '火',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '颈·前额', 'symbol': '珍珠',
        'deity': 'Tvashtar', 'yoniAnimal': '虎',  # 标准补充
    },
    {
        'index': 15, 'sanskrit': 'Swati', 'labelCn': '亢', 'rangeStart': 186.6667,
        'lord': 'Rahu', 'activity': '被动', 'varna': '屠夫', 'facing': '水平',
        'windDir': '北', 'gunas': 'TTS', 'purushartha': '利', 'element': '火',
        'gender': '阴', 'gana': '神', 'bodyPart': '胸部·肠', 'symbol': '珊瑚',
        'deity': 'Vayu', 'yoniAnimal': '水牛',  # 标准补充
    },
    {
        'index': 16, 'sanskrit': 'Vishakha', 'labelCn': '氐', 'rangeStart': 200.0,
        'lord': 'Jupiter', 'activity': '主动', 'varna': '种姓外', 'facing': '向下',
        'windDir': '东', 'gunas': 'TSR', 'purushartha': '法', 'element': '火',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '手臂·乳房', 'symbol': '辘轳/转盘',
        'deity': 'Indra-Agni', 'yoniAnimal': '虎',  # 标准补充
    },
    {
        'index': 17, 'sanskrit': 'Anuradha', 'labelCn': '房', 'rangeStart': 213.3333,
        'lord': 'Saturn', 'activity': '被动', 'varna': '首陀罗', 'facing': '水平',
        'windDir': '南', 'gunas': 'TST', 'purushartha': '法', 'element': '火',
        'gender': '阳', 'gana': '神', 'bodyPart': '乳房·胃·子宫·肠', 'symbol': '莲花',
        'deity': 'Mitra', 'yoniAnimal': '鹿',  # 标准补充
    },
    {
        'index': 18, 'sanskrit': 'Jyeshtha', 'labelCn': '心', 'rangeStart': 226.6667,
        'lord': 'Mercury', 'activity': '主动', 'varna': '奴僕', 'facing': '水平',
        'windDir': '西', 'gunas': 'TSS', 'purushartha': '利', 'element': '风',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '颈·身右侧', 'symbol': '耳坠',
        'deity': 'Indra', 'yoniAnimal': '鹿',  # 标准补充
    },
    {
        'index': 19, 'sanskrit': 'Mula', 'labelCn': '尾', 'rangeStart': 240.0,
        'lord': 'Ketu', 'activity': '主动', 'varna': '屠夫', 'facing': '向下',
        'windDir': '北', 'gunas': 'SRR', 'purushartha': '欲', 'element': '风',
        'gender': '中', 'gana': '鬼', 'bodyPart': '脚·身左侧', 'symbol': '狮尾/绑根',
        'deity': 'Nirriti', 'yoniAnimal': '犬',  # 标准补充
    },
    {
        'index': 20, 'sanskrit': 'PurvaAshadha', 'labelCn': '箕', 'rangeStart': 253.3333,
        'lord': 'Venus', 'activity': '平衡', 'varna': '婆罗门', 'facing': '向下',
        'windDir': '东', 'gunas': 'SRT', 'purushartha': '解脱', 'element': '风',
        'gender': '阴', 'gana': '人', 'bodyPart': '大腿骨·背部', 'symbol': '象牙/风扇',
        'deity': 'Apas', 'yoniAnimal': '猴',  # 标准补充
    },
    {
        'index': 21, 'sanskrit': 'UttaraAshadha', 'labelCn': '斗', 'rangeStart': 266.6667,
        'lord': 'Sun', 'activity': '平衡', 'varna': '刹帝利', 'facing': '向上',
        'windDir': '南', 'gunas': 'SRS', 'purushartha': '解脱', 'element': '风',
        'gender': '阴', 'gana': '人', 'bodyPart': '腰·大腿', 'symbol': '床板',
        'deity': 'Vishwadevas', 'yoniAnimal': '獴',  # 标准补充 (无配对)
    },
    {
        'index': 22, 'sanskrit': 'Shravana', 'labelCn': '女', 'rangeStart': 280.0,
        'lord': 'Moon', 'activity': '被动', 'varna': '种姓外', 'facing': '向上',
        'windDir': '北', 'gunas': 'STR', 'purushartha': '利', 'element': '风',
        'gender': '阴', 'gana': '神', 'bodyPart': '耳朵·性器官', 'symbol': '耳朵',
        'deity': 'Vishnu', 'yoniAnimal': '猴',  # 标准补充
    },
    {
        'index': 23, 'sanskrit': 'Dhanishtha', 'labelCn': '虚', 'rangeStart': 293.3333,
        'lord': 'Mars', 'activity': '主动', 'varna': '奴僕', 'facing': '向上',
        'windDir': '东', 'gunas': 'STT', 'purushartha': '法', 'element': '乙太',
        'gender': '阴', 'gana': '鬼', 'bodyPart': '背部·肛门', 'symbol': '鼓/笛',
        'deity': 'Vasus', 'yoniAnimal': '狮',  # 标准补充
    },
    {
        'index': 24, 'sanskrit': 'Shatabhisha', 'labelCn': '危', 'rangeStart': 306.6667,
        'lord': 'Rahu', 'activity': '主动', 'varna': '屠夫', 'facing': '向上',
        'windDir': '南', 'gunas': 'STS', 'purushartha': '法', 'element': '乙太',
        'gender': '中', 'gana': '鬼', 'bodyPart': '颌骨·右大腿', 'symbol': '一百颗星',
        'deity': 'Varuna', 'yoniAnimal': '马',  # 标准补充
    },
    {
        'index': 25, 'sanskrit': 'PurvaBhadra', 'labelCn': '室', 'rangeStart': 320.0,
        'lord': 'Jupiter', 'activity': '被动', 'varna': '婆罗门', 'facing': '向下',
        'windDir': '西', 'gunas': 'SSR', 'purushartha': '利', 'element': '乙太',
        'gender': '阳', 'gana': '人', 'bodyPart': '脚掌·左大腿股·身侧', 'symbol': '刀剑',
        'deity': 'Aja-Ekapada', 'yoniAnimal': '狮',  # 标准补充
    },
    {
        'index': 26, 'sanskrit': 'UttaraBhadra', 'labelCn': '壁', 'rangeStart': 333.3333,
        'lord': 'Saturn', 'activity': '平衡', 'varna': '刹帝利', 'facing': '向上',
        'windDir': '北', 'gunas': 'SST', 'purushartha': '欲', 'element': '乙太',
        'gender': '阳', 'gana': '人', 'bodyPart': '胫·脚掌·身侧(含肋)', 'symbol': '双生子',
        'deity': 'Ahir-Budhnya', 'yoniAnimal': '牛',  # 标准补充
    },
    {
        'index': 27, 'sanskrit': 'Revati', 'labelCn': '奎', 'rangeStart': 346.6667,
        'lord': 'Mercury', 'activity': '平衡', 'varna': '首陀罗', 'facing': '水平',
        'windDir': '东', 'gunas': 'SSS', 'purushartha': '解脱', 'element': '乙太',
        'gender': '阴', 'gana': '神', 'bodyPart': '腹部·鼠蹊·脚踝', 'symbol': '鱼',
        'deity': 'Pushan', 'yoniAnimal': '象',  # 标准补充
    },
]

# 补 rangeEnd（= 下一宿 rangeStart，末宿回到 360）。
for _i, _row in enumerate(NAKSHATRA_DATA):
    _row['rangeEnd'] = round(_row['rangeStart'] + NAK_SPAN, 4)


def nakshatra_detail(index):
    """index 1-27 → 全字段 dict（越界返回 None）。"""
    if not isinstance(index, int):
        return None
    if index < 1 or index > 27:
        return None
    return NAKSHATRA_DATA[index - 1]


def nakshatra_detail_from_lon(lon):
    """由恒星黄道经度返回所在宿的全字段 dict。"""
    span = NAK_SPAN
    value = float(lon) % 360.0
    idx = min(26, int(value / span))
    return NAKSHATRA_DATA[idx]


# ── Abhijit(28 宿口径)· 独立常量 ─────────────────────────────────────────
# 🔴 绝不塞进上面 27 条主表:Vimshottari lord 循环、月宿起运、D9/Pada 全按 27 宿铺排,
#    主表插一条即全体系错位(test_nakshatra_data.py 断言 27 条 + lord 循环×3 看守)。
# 边界双文档互证:276°40′00″–280°53′20″(跨 4°13′20″),系 Uttara Ashadha 末 pada(3°20′)
# + Shravana 前 1/15(0°53′20″);另有资料把止点截成 280°10′53″者系丢 20″之误,勿采。
# 28 宿序号 22;主神 Vega(织女)。此口径仅用于显示编号与择吉,不参与任何 Dasha/Varga 计算。
ABHIJIT_ENTRY = {
    'index28': 22, 'sanskrit': 'Abhijit', 'labelCn': '织女',
    'rangeStart': 276.0 + 40.0 / 60.0,                    # 276°40′00″
    'rangeEnd': 280.0 + 53.0 / 60.0 + 20.0 / 3600.0,      # 280°53′20″
    'deity': 'Brahma', 'symbol': '织女星 Vega', 'note': '28 宿择吉口径专用,不入 Vimshottari/Varga',
}
