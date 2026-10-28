# -*- coding: utf-8 -*-
"""神数诸法(邵子 / 北极 / 南极 / 蠢子)下拉档 ↔ 后端实际所用值 合同(选项语义证 · contract)。

「拨了有反应」只证明值被消费,不证明选到的就是标签写的那一档。本文件把三段各自独立的东西对上:
  ① 前端档位表:components/kinastro/kinastroOptions.js(纯数据表,页面与 AI 挂载齿轮同一份;由 node 求值取真表,
     不手抄)+ 齿轮各字段的空档标签与所接档位表名(utils/techniqueMountSettings.js,正则读取);
  ② 把每一档原样发给对应后端接口(/shaozi /beiji /nanji /chunzi 的 pan),读回后端回显的「实际所用值」;
  ③ 标签 → 应得值 由按名书写的规则判定:「缺省（X）/ 默认（X）」= 后端缺省 X;含「自出」= 后端按盘自算的那一值;
     其余 = 标签本身(繁简按显示层归一后比)。
另核:档位表与后端可认值集逐一相等(不多不少),页面与齿轮用的是同一张表。
空档按挂载重算的实际做法不发这个键;「自出」档的期望值独立再算(北极、蠢子都按时辰内位置,宫部直调引擎),
样本取得能与首档分开。齿轮里内联写的手写档位(方式类 / 南极手动古法 / 推演宫 / 蠢子时辰)也逐档核。
"""
import json
import os
import re
import shutil
import subprocess
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import cherrypy  # noqa: E402
import pytest  # noqa: E402

from websrv import webbeijisrv as BJ  # noqa: E402
from websrv import webchunzisrv as CZ  # noqa: E402
from websrv import webnanjisrv as NJ  # noqa: E402
from websrv import webshaozisrv as SZ  # noqa: E402
from websrv.kentang.kinastro_common import display_text, parse_datetime  # noqa: E402

UI_SRC = os.path.abspath(os.path.join(_ASTRO, '..', 'astrostudyui', 'src'))
KIN_OPTIONS = os.path.join(UI_SRC, 'components', 'kinastro', 'kinastroOptions.js')
KIN_MAIN = os.path.join(UI_SRC, 'components', 'kinastro', 'KinAstroMain.js')
MOUNT_SETTINGS = os.path.join(UI_SRC, 'utils', 'techniqueMountSettings.js')

BASE = {
    'year': 1990, 'month': 5, 'day': 18, 'hour': 10, 'minute': 0, 'second': 0,
    'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27',
    'gender': '1', 'after23NewDay': 1, 'lateZiHourUseNextDay': 1,
}


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


_TABLES = {}


def _ui_tables():
    """kinastroOptions.js 是纯数据表:去掉 export 后交 node 求值,取 JSON(标签由前端代码自己生成,这里不复写生成规则)。"""
    if _TABLES:
        return _TABLES
    src = _read(KIN_OPTIONS)
    assert not re.search(r'^\s*import\s', src, re.M), 'kinastroOptions.js 应是不引模块的纯数据表'
    names = re.findall(r'^export\s+const\s+(\w+)', src, re.M)
    assert names, 'kinastroOptions.js 里没有导出的档位表'
    node = shutil.which('node')
    assert node, '读前端档位表需要 node(与前端构建同一工具链)'
    code = re.sub(r'^export\s+', '', src, flags=re.M) + '\nprocess.stdout.write(JSON.stringify({%s}));\n' % ','.join(names)
    out = subprocess.run([node, '-e', code], capture_output=True, check=True, timeout=120)
    _TABLES.update(json.loads(out.stdout.decode('utf-8')))
    return _TABLES


def _mount_field(technique, name):
    """齿轮字段:返回 (空档标签, 所接档位表名)。字段形如 options: [{ value: '', label: '…' }, ...TABLE](按语法树读)。"""
    opts = _field(technique, name).get('options')
    assert isinstance(opts, list) and len(opts) == 2 and opts[0].get('kind') == 'obj' and opts[0].get('value') == '' \
        and opts[1].get('kind') == 'spreadIdent', f'{technique}.{name} 的档位不是「空档 + 页面档位表」形状'
    return opts[0]['label'], opts[1]['name']


def _service(mod):
    for name in dir(mod):
        obj = getattr(mod, name)
        if isinstance(obj, type) and hasattr(obj, 'pan') and obj.__module__ == mod.__name__:
            return obj()
    raise AssertionError(f'{mod.__name__} 里找不到服务类')


def _pan(mod, extra):
    payload = dict(BASE)
    payload.update(extra)
    cherrypy.request.json = payload
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = _service(mod).pan()
    res = json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)
    assert res.get('ResultCode') == 0, res
    return res['Result']


def _meaning(label, opts=None):
    """标签 → ('literal', 文本) | ('auto', None)。末尾不带内容的「（默认）/（缺省）」只是缺省档标记,先剥掉再判(全角 / 半角括号都认);
    自出类说法(含「自出」或以「按本命」起头)的括号里又点名了本字段档位表里的某一档(如「（缺省子）」而「子」是一档)的,自相矛盾,按字面算;
    点名的写法认「缺省 / 默认」在前(中间可夹 · : = 或「为 / 取 / 是」;档名本身以这三字起头的照样认得)与在后(「（子·默认）」「（子,缺省）」),
    地支后多一个「时」字也认(「缺省子时」)。
    opts:本字段的档位([{value, label}]),判矛盾时用;不给就不判矛盾。"""
    m = re.fullmatch(r'(?:缺省|默认)[（(](.+)[）)]', label)
    if m:
        return 'literal', m.group(1)
    core = re.sub(r'[（(](?:默认|缺省)[）)]$', '', label)
    if opts:
        named = [x for o in opts if o.get('value') not in ('', None) for x in (o.get('value'), o.get('label'))]
        for pat in (r'[（(](?:缺省|默认)\s*[·:：=]?\s*([^）)]+)[）)]', r'[（(]([^）)]+?)\s*[·,，、]\s*(?:缺省|默认)[）)]'):
            for pm in re.finditer(pat, core):
                g = pm.group(1).strip()
                bases = [g] + ([g[1:].strip()] if len(g) > 1 and g[0] in '为取是' else [])
                cands = [c for b in bases for c in ([b] + ([b[0]] if len(b) == 2 and b[1] == '时' and b[0] in ZHI_CHARS else []))]
                if any(_same_text(c, x) for c in cands for x in named):
                    return 'literal', label
    if '自出' in core or core.startswith('按本命'):
        return 'auto', None
    return 'literal', core


ZHI_CHARS = '子丑寅卯辰巳午未申酉戌亥'


def _same_text(a, b):
    return display_text(f'{a}') == display_text(f'{b}')


def _num(pattern):
    def parse(text):
        m = re.fullmatch(pattern, text)
        return int(m.group(1)) if m else f'(标签「{text}」读不出档值)'
    return parse


# 「自出」档的独立期望值(不拿后端自报的自算值对后端自己):样本取 10:37,与首档、与后端固定缺省都分得开
AUTO_SAMPLE = {'year': 1990, 'month': 5, 'day': 18, 'hour': 10, 'minute': 37, 'date': '1990-05-18', 'time': '10:37:00'}


def _shichen_offset(hour, minute):
    """时辰内已过分钟:时辰起于奇数点(子时 23 点),奇数点 / 23 点为时辰第一个小时。"""
    return minute if (hour == 23 or hour % 2 == 1) else 60 + minute


def _clock_zhi(hour):
    return NJ.DIZHI[((hour + 1) // 2) % 12]


def _birth_nanji(sample):
    return NJ.NanJiShenShu.from_solar_datetime(sample['year'], sample['month'], sample['day'], sample['hour'], sample['minute'], gender='男', after23_new_day=1)


AUTO_EXPECT = {
    # 北极:一时辰八刻、每刻十五分,按时辰内位置(引擎 compute_ke 的文档口径,这里独立再算一遍)
    'beiji.beijiKe': lambda smp: BJ.KE_LABELS[min(7, _shichen_offset(smp['hour'], smp['minute']) // 15)],
    # 蠢子:一时辰十刻、每刻十二分,按时辰内位置(与北极同法;应用内帮助同写)
    'chunzi.chunziKe': lambda smp: max(1, min(10, _shichen_offset(smp['hour'], smp['minute']) // 12 + 1)),
    # 南极宫部:本命宫部 = 引擎按出生时刻排出的宫部(直调引擎,不经接口)
    'nanji.nanjiSection': lambda smp: _birth_nanji(smp).palace_section,
}

# (技法, 字段, 请求附加参数, 回显取值, 文本 → 回显同形)
CASES = {
    'shaozi.ke': ('shaozi', 'ke', {}, lambda r: r['ke'], None),
    'beiji.beijiKe': ('beiji', 'beijiKe', {'beijiKeMode': 'manual'}, lambda r: r['beiji']['keLabel'], None),
    'nanji.nanjiSection': ('nanji', 'nanjiSection', {}, lambda r: r['nanji']['query']['rawSection'], None),
    'nanji.nanjiJianchu': ('nanji', 'nanjiJianchu', {}, lambda r: r['nanji']['query']['rawJianchu'], None),
    'nanji.nanjiXiu': ('nanji', 'nanjiXiu', {}, lambda r: r['nanji']['query']['rawXiu'], None),
    'nanji.nanjiPasswordCode': ('nanji', 'nanjiPasswordCode', {}, lambda r: r['nanji']['password']['code'], None),
    'nanji.nanjiChart': ('nanji', 'nanjiChart', {}, lambda r: r['nanji']['divine']['chart'], _num(r'第(\d+)图')),
    'chunzi.chunziKe': ('chunzi', 'chunziKe', {'chunziKeMode': 'manual'}, lambda r: r['chunzi']['keValue'], _num(r'(\d+)刻')),
    'chunzi.chunziMansion': ('chunzi', 'chunziMansion', {}, lambda r: r['chunzi']['search']['mansion']['mansion'], None),
    'chunzi.chunziResultLimit': ('chunzi', 'chunziResultLimit', {}, lambda r: r['chunzi']['resultLimit'], _num(r'(\d+)条')),
}
SERVICES = {'shaozi': SZ, 'beiji': BJ, 'nanji': NJ, 'chunzi': CZ}
# 后端自带的同字异写表:宿名「氐 / 氏」两写都认、回显恒为「氏」,标签按二十八宿正字「氐」写也是同一档
CASE_ALIASES = {'nanji.nanjiXiu': NJ.XIU_ALIASES}


def _send(field, value, extra=None):
    """与挂载重算同口径:空档不发这个键(pickKin 丢掉空串),其余原样发。"""
    payload = dict(extra or {})
    if value != '':
        payload[field] = value
    return payload


def _check_case(case_id):
    technique, field, extra, echo, parse = CASES[case_id]
    tables = _ui_tables()
    blank_label, table_name = _mount_field(technique, field)
    assert table_name in tables, f'{case_id} 接的档位表 {table_name} 不在 kinastroOptions.js'
    options = [{'value': '', 'label': blank_label}] + list(tables[table_name])
    mod = SERVICES[technique]
    bad = []
    for opt in options:
        value, label = opt['value'], opt['label']
        kind, text = _meaning(label, options)
        if kind == 'auto':
            assert case_id in AUTO_EXPECT, f'{case_id} 标签「{label}」声称自出,但本合同没登记独立期望值'
            res = _pan(mod, dict(AUTO_SAMPLE, **_send(field, value, extra)))
            want = AUTO_EXPECT[case_id](AUTO_SAMPLE)
            # 判别前提:样本上的自出值必须与首档不同,否则「自出」与「固定取首档」分不开
            first = options[1]
            first_want = parse(_meaning(first['label'])[1]) if parse else _meaning(first['label'])[1]
            assert not _same_text(want, first_want), f'{case_id} 样本上自出值 {want!r} 与首档 {first_want!r} 相同,分不清'
        else:
            res = _pan(mod, _send(field, value, extra))
            want = parse(text) if parse else text
        got = echo(res)
        alias = CASE_ALIASES.get(case_id, {})
        ok = (got == want) if parse else _same_text(alias.get(f'{got}', got), alias.get(f'{want}', want))
        if not ok:
            bad.append(f'{value!r}「{label}」→ 后端实际 {got!r},标签应得 {want!r}')
    assert not bad, f'{case_id} 档位标签与后端实际所用值不符:\n  ' + '\n  '.join(bad)
    return options


# 逐档核按实际运行算:CASES 每条一个参数化用例(登记了 = 跑了;被 skip 时 pytest 显式报告,不靠读源码推断)
@pytest.mark.parametrize('case_id', sorted(CASES))
def test_case_matches_backend(case_id):
    _check_case(case_id)


def _table_of(technique, field):
    return _ui_tables()[_mount_field(technique, field)[1]]


def test_shaozi_beiji_tables_match_backend():
    assert [o['value'] for o in _table_of('shaozi', 'ke')] == SZ.KE_OPTIONS   # 档位 = 后端可认的八刻,同序
    assert [o['value'] for o in _table_of('beiji', 'beijiKe')] == [item['value'] for item in BJ.KE_OPTIONS]


def test_nanji_tables_match_backend():
    tables = _ui_tables()
    assert [o['value'] for o in tables['NANJI_SECTION_OPTIONS']] == NJ.SECTIONS
    assert [o['value'] for o in tables['NANJI_JIANCHU_OPTIONS']] == list(NJ.JIANCHU)
    assert [o['value'] for o in tables['NANJI_XIU_OPTIONS']] == list(NJ.XIU28_ORDER)
    assert [o['value'] for o in tables['NANJI_PASSWORD_OPTIONS']] == list(NJ.PASSWORDS.keys())
    assert [o['value'] for o in tables['NANJI_CHART_OPTIONS']] == list(range(1, 19))   # 后端夹在 1–18


def test_chunzi_tables_match_backend():
    tables = _ui_tables()
    assert [o['value'] for o in tables['CHUNZI_KE_OPTIONS']] == [f'{i}' for i in range(1, 11)]   # 后端夹在 1–10
    assert [o['value'] for o in tables['CHUNZI_MANSION_OPTIONS']] == list(CZ.MANSIONS_28)
    assert [o['value'] for o in tables['CHUNZI_RESULT_LIMIT_OPTIONS']] == [f"{item['value']}" for item in CZ.RESULT_LIMIT_OPTIONS]


@pytest.mark.parametrize('case_id', sorted(CASES))
def test_mount_field_reuses_page_table(case_id):
    technique, field = CASES[case_id][0], CASES[case_id][1]
    _, table_name = _mount_field(technique, field)
    main = _read(KIN_MAIN)
    assert re.search(r'\b%s\.map\(' % re.escape(table_name), main), f'页面没用同一张档位表 {table_name}({case_id})'


def test_label_rule_discriminates():
    """判别向量:规则本身能分清三类标签,且错标会被抓到。"""
    assert _meaning('缺省（建）') == ('literal', '建')
    assert _meaning('默认（20条）') == ('literal', '20条')
    assert _meaning('自出（按时刻推刻）') == ('auto', None)
    assert _meaning('按本命（自出）') == ('auto', None)
    assert _meaning('按本命时支') == ('auto', None) and _meaning('缺省（子）') == ('literal', '子')
    zhi = [{'value': z, 'label': z} for z in NJ.DIZHI]
    for lab in ('按本命（缺省子）', '自出（缺省子）', '按本命(缺省子)', '自出(默认子)',   # 括号里点名了一档:自相矛盾,不算自出类(全角 / 半角)
                '自出（默认为子）', '自出（缺省取子）', '自出（默认=子）', '自出（缺省子时）', '自出（子·默认）', '按本命（子，缺省）',
                '自出（默认是子）', '自出（默认取子时）', '自出（默认取 子）'):   # 夹连接字 / 标记在后 / 连接字 + 地支 + 时 / 连接字后带空格
        assert _meaning(lab, zhi) != ('auto', None), lab
    assert _meaning('按本命时支（默认）', zhi) == ('auto', None) and _meaning('随盘自出（默认）', zhi) == ('auto', None)   # 末尾的缺省档标记不算具体值
    assert _meaning('自出（默认·按时刻推刻）', zhi) == ('auto', None)   # 括号里没点名任何一档:照算自出类
    assert _meaning('自出（按时刻·默认）', zhi) == ('auto', None) and _meaning('自出（缺省为按时刻推刻）', zhi) == ('auto', None)
    qu = [{'value': 'quxiang', 'label': '取象'}, {'value': 'weizhun', 'label': '为准'}, {'value': 'benming', 'label': '本命'}]
    for lab in ('自出（默认取象）', '自出（缺省为准）', '自出（默认·取象）', '自出（取象·默认）'):   # 档名以「为 / 取 / 是」起头:连接字不吞档名首字
        assert _meaning(lab, qu) != ('auto', None), lab
    assert _meaning('自出（默认取本命时）', qu) == ('auto', None) and _meaning('自出（默认日时）', [{'value': 'ri', 'label': '日'}]) == ('auto', None)   # 「时」只跟在地支后才剥
    assert _meaning('子（默认）') == ('literal', '子') and _meaning('20条(默认)') == ('literal', '20条')   # 字面档也剥末尾标记
    assert _meaning('第3图') == ('literal', '第3图')
    assert _same_text('虛', '虚') and not _same_text('角', '亢')
    res = _pan(NJ, {'nanjiXiu': '亢'})
    assert not _same_text(res['nanji']['query']['rawXiu'], '角')   # 若后端把「亢」吞成缺省「角」,合同必红


# ---------------------------------------------------------------- 手写档位(齿轮里内联写的下拉)

_SPREAD_ZHI = 'DIZHI_12.map((z)=>({ value: z, label: z }))'
_SPREAD_GAN = "['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))"

_SCHEMA_DUMP_JS = r"""
const fs = require('fs');
const parser = require(process.argv[1]);   // node -e 时第一个额外参数在 argv[1]
const src = fs.readFileSync(process.argv[2], 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'] });
const want = new Set(['shaozi', 'beiji', 'nanji', 'chunzi']);
const keyName = (k)=>(k ? (k.name !== undefined ? k.name : k.value) : undefined);
// 同名属性取最后一个(与 JS 对象字面量语义一致)
const lastProp = (obj, k)=>{ let hit = null; obj.properties.forEach((p)=>{ if(p.type === 'ObjectProperty' && !p.computed && keyName(p.key) === k){ hit = p; } }); return hit; };
const lit = (n)=>{
  if(!n){ return null; }
  if(n.type === 'StringLiteral' || n.type === 'NumericLiteral'){ return { v: n.value }; }
  if(n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'NumericLiteral'){ return { v: -n.argument.value }; }
  return null;
};
const plainObject = (n)=>n && n.type === 'ObjectExpression' && n.properties.every((q)=>q.type === 'ObjectProperty' && !q.computed);
let schema = null; let decls = 0;
ast.program.body.forEach((st)=>{
  const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if(decl && decl.type === 'VariableDeclaration'){
    decl.declarations.forEach((d)=>{ if(d.id && d.id.name === 'TECHNIQUE_SETTINGS_SCHEMA'){ decls += 1; schema = d.init; } });
  }
});
const out = { __decls: decls, __object: !!(schema && schema.type === 'ObjectExpression'), techniques: {} };
if(out.__object){
  schema.properties.forEach((p)=>{
    if(p.type !== 'ObjectProperty' || p.computed || !want.has(keyName(p.key))){ return; }
    const rec = { fields: [], unresolved: 0 };
    const fp = plainObject(p.value) ? lastProp(p.value, 'fields') : null;
    if(!fp || fp.value.type !== 'ArrayExpression'){ rec.unresolved += 1; }
    else{
      fp.value.elements.forEach((el)=>{
        // 字段对象里有展开 / 计算键(运行时可能把 type 改掉)→ 读不出;name / type 不是字面量 → 读不出
        if(!plainObject(el)){ rec.unresolved += 1; return; }
        const nm = lit(lastProp(el, 'name') && lastProp(el, 'name').value);
        const ty = lit(lastProp(el, 'type') && lastProp(el, 'type').value);
        if(!nm || !ty){ rec.unresolved += 1; return; }
        const f = { name: nm.v, type: ty.v };
        const op = lastProp(el, 'options');
        if(op){
          if(op.value.type !== 'ArrayExpression'){ f.options = { unresolved: src.slice(op.value.start, op.value.end).slice(0, 80) }; }
          else{
            f.options = op.value.elements.map((o)=>{
              if(plainObject(o)){
                const v = lit(lastProp(o, 'value') && lastProp(o, 'value').value);
                const l = lit(lastProp(o, 'label') && lastProp(o, 'label').value);
                if(v && l && typeof l.v === 'string'){ return { kind: 'obj', value: v.v, label: l.v }; }
              }
              if(o && o.type === 'SpreadElement'){
                if(o.argument.type === 'Identifier'){ return { kind: 'spreadIdent', name: o.argument.name }; }
                return { kind: 'spreadSrc', src: src.slice(o.argument.start, o.argument.end) };
              }
              return { kind: 'other', src: o ? src.slice(o.start, o.end).slice(0, 80) : '(空位)' };
            });
          }
        }
        rec.fields.push(f);
      });
    }
    out.techniques[keyName(p.key)] = rec;   // 同名技法键:后一个覆盖前一个(与 JS 同)
  });
}
process.stdout.write(JSON.stringify(out));
"""


def _dump_schema(path):
    """用前端自带的 @babel/parser 解析齿轮源码:只读 TECHNIQUE_SETTINGS_SCHEMA 这一个声明,四技法 fields 逐元素读 name / type / options。
    字段写法读不出(展开共用字段组、工厂函数、字段对象里有展开、name / type 不是字面量)→ 记进 unresolved(本合同读不出就红,不猜)。"""
    node = shutil.which('node')
    assert node, '读齿轮源码需要 node(与前端构建同一工具链)'
    parser = os.path.join(UI_SRC, '..', 'node_modules', '@babel', 'parser')
    res = subprocess.run([node, '-e', _SCHEMA_DUMP_JS, parser, path], capture_output=True, check=True, timeout=120)
    return json.loads(res.stdout.decode('utf-8'))


_SCHEMA = {}


def _schema():
    if not _SCHEMA:
        out = _dump_schema(MOUNT_SETTINGS)
        assert out['__decls'] == 1 and out['__object'], 'TECHNIQUE_SETTINGS_SCHEMA 应是唯一一处对象字面量声明'
        _SCHEMA.update(out['techniques'])
    return _SCHEMA


def _schema_fields_ast():
    """四技法:{ selects, all, unresolved }。"""
    return {t: {'selects': [f['name'] for f in rec['fields'] if f['type'] == 'select'], 'all': [f['name'] for f in rec['fields']], 'unresolved': rec['unresolved']}
            for t, rec in _schema().items()}


def _field(technique, name):
    rec = _schema().get(technique)
    assert rec, f'挂载设置表里找不到技法 {technique}'
    hits = [f for f in rec['fields'] if f['name'] == name]
    assert hits, f'{technique} 齿轮里找不到字段 {name}'
    return hits[-1]


def _select_fields(technique):
    """齿轮里该技法的全部下拉字段名(按语法树读,注释 / 字符串里的写法不算)。"""
    rec = _schema_fields_ast().get(technique)
    assert rec, f'挂载设置表里找不到技法 {technique}'
    return list(rec['selects'])


def _norm_src(text):
    return re.sub(r'\s+', '', text)


def _inline_options(technique, name):
    """齿轮字段的内联档位(按语法树):字面 { value, label } 与两种已知展开(十二支 / 十天干);别的写法一律报错,不猜。注释里的档不算。"""
    opts = _field(technique, name).get('options')
    assert isinstance(opts, list), f'{technique}.{name} 的档位不是字段内联的 options: [ … ](本合同只认这种写法,换了写法要先改合同)'
    out = []
    for o in opts:
        if o['kind'] == 'obj':
            out.append({'value': o['value'], 'label': o['label']})
        elif o['kind'] == 'spreadSrc' and _norm_src(o['src']) == _norm_src(_SPREAD_ZHI):
            out.extend({'value': z, 'label': z} for z in NJ.DIZHI)
        elif o['kind'] == 'spreadSrc' and _norm_src(o['src']) == _norm_src(_SPREAD_GAN):
            out.extend({'value': g, 'label': g} for g in NJ.TIANGAN)
        else:
            raise AssertionError(f"{technique}.{name} 档位里有本合同不认识的写法:{o.get('src') or o.get('name')}")
    return out


def _page_default(key):
    """技法页初始状态里的缺省值(KinAstroMain 的 state 初值字面量)。"""
    m = re.search(r"\n\t+%s:\s*'([^']*)'," % re.escape(key), _read(KIN_MAIN))
    assert m, f'页面初值里找不到 {key}'
    return m.group(1)


MODE_CASES = {
    # 字段: (服务, 附加参数, 回显值, 回显档名, 页面初值键)
    'shaozi.useKey': ('shaozi', {}, lambda r: r['useKey'], None, 'useKey'),
    'beiji.beijiKeMode': ('beiji', {}, lambda r: r['beiji']['keMode'], lambda r: r['beiji']['keModeLabel'], 'beijiKeMode'),
    'nanji.nanjiMode': ('nanji', {}, lambda r: r['nanji']['mode'], lambda r: r['nanji']['modeLabel'], 'nanjiMode'),
    'chunzi.chunziKeMode': ('chunzi', {}, lambda r: r['chunzi']['keMode'], lambda r: r['chunzi']['keModeLabel'], 'chunziKeMode'),
    'chunzi.chunziLunarMode': ('chunzi', {}, lambda r: r['chunzi']['lunarMode'], lambda r: r['chunzi']['lunarModeLabel'], 'chunziLunarMode'),
}
_SWITCH_LABEL = {'启用': True, '关闭': False}


@pytest.mark.parametrize('case_id', sorted(MODE_CASES))
def test_inline_mode_options_match_backend(case_id):
    """方式类档:「随盘（默认）」= 页面初值那一档;其余档 = 后端回显的那一档(档名与后端自己的档名逐字同)。"""
    technique, extra, echo, echo_label, page_key = MODE_CASES[case_id]
    field = case_id.split('.', 1)[1]
    bad = []
    opts = _inline_options(technique, field)
    assert opts and opts[0]['value'] == '' and opts[0]['label'] == '随盘（默认）', f'{case_id} 空档不是「随盘（默认）」'
    page = _page_default(page_key)
    for opt in opts:
        res = _pan(SERVICES[technique], _send(field, opt['value'], extra))
        got = echo(res)
        if opt['value'] == '':
            want = (page == '1') if field == 'useKey' else page
        elif field == 'useKey':
            want = _SWITCH_LABEL[opt['label']]
        else:
            want = opt['value']
            if echo_label and not _same_text(echo_label(res), opt['label']):
                bad.append(f"{case_id} {opt['value']!r}「{opt['label']}」→ 后端档名「{echo_label(res)}」")
        if got != want:
            bad.append(f"{case_id} {opt['value']!r}「{opt['label']}」→ 后端实际 {got!r},应得 {want!r}")
    assert not bad, '方式类档位与后端不符:\n  ' + '\n  '.join(bad)


def _manual_chart(**extra):
    data = dict(BASE, nanjiMode='manual', **{k: v for k, v in extra.items() if v != ''})
    return NJ._build_manual_chart(data, '男', parse_datetime(data))


def _birth_sample():
    return _birth_nanji(dict(BASE, hour=10, minute=0))


def _inline_after_lichun(technique, field):
    bad = []
    for opt in _inline_options(technique, field):
        want = (_page_default(field) != '0') if opt['value'] == '' else (opt['label'] == '立春后')
        got = _manual_chart(**{field: opt['value']}).after_lichun
        if got != want:
            bad.append(f"立春 {opt['value']!r}「{opt['label']}」→ {got!r},应得 {want!r}")
    return bad


def _inline_hour_zhi(technique, field):
    bad = []
    for opt in _inline_options(technique, field):
        want = _clock_zhi(BASE['hour']) if opt['value'] == '' else opt['value']
        got = _manual_chart(**{field: opt['value']}).hour_zhi
        if got != want:
            bad.append(f"时支 {opt['value']!r}「{opt['label']}」→ {got!r},应得 {want!r}")
    return bad


def _inline_day_gan(technique, field):
    birth = _birth_sample()
    bad = []
    for opt in _inline_options(technique, field):
        want = birth.day_gan if opt['value'] == '' else opt['value']
        got = _manual_chart(**{field: opt['value']}).day_gan
        if got != want:
            bad.append(f"日干 {opt['value']!r}「{opt['label']}」→ {got!r},应得 {want!r}")
    # 日干手填、日支留空:本命日支与之阴阳相合才取,不合则日支未定并注明(不拼出六十甲子里没有的柱)
    for g in NJ.TIANGAN:
        njs = _manual_chart(nanjiDayGan=g)
        fits = NJ._same_yinyang(g, birth.day_zhi)
        if njs.day_pillar != (f'{g}{birth.day_zhi}' if fits else f'{g}日') or bool(njs.day_pillar_note) == fits:
            bad.append(f"日干 {g} + 日支自出 → {njs.day_pillar} / {njs.day_pillar_note!r}")
    return bad


def _inline_day_zhi(technique, field):
    birth = _birth_sample()
    bad = []
    for opt in _inline_options(technique, field):
        njs = _manual_chart(**{field: opt['value']})
        z = opt['value']
        fits = z != '' and NJ._same_yinyang(birth.day_gan, z)
        want = z if fits else birth.day_zhi
        if njs.day_zhi != want or njs.day_pillar != f'{birth.day_gan}{want}':
            bad.append(f"日支 {z!r}「{opt['label']}」→ {njs.day_pillar},应得 {birth.day_gan}{want}")
        if (z != '' and not fits) != bool(njs.day_pillar_note):
            bad.append(f"日支 {z!r}:阴阳不合与否 = {z != '' and not fits},说明 = {njs.day_pillar_note!r}")
    # 日干、日支都手填:不合的日支不取、日柱只写日干(不回落本命日支 —— 回落只在日干留空、取本命日干时);相合照取
    g = next(x for x in NJ.TIANGAN if NJ._same_yinyang(x, birth.day_zhi) and x != birth.day_gan)
    z_bad = next(x for x in NJ.DIZHI if not NJ._same_yinyang(g, x))
    z_ok = next(x for x in NJ.DIZHI if NJ._same_yinyang(g, x) and x != birth.day_zhi)
    njs = _manual_chart(nanjiDayGan=g, nanjiDayZhi=z_bad)
    if njs.day_pillar != f'{g}日' or not njs.day_pillar_note.endswith('未用') or '按本命日支' in njs.day_pillar_note:
        bad.append(f"日干 {g} + 日支 {z_bad}(不合)→ {njs.day_pillar} / {njs.day_pillar_note!r},应得 {g}日 且说明以「未用」结尾")
    njs = _manual_chart(nanjiDayGan=g, nanjiDayZhi=z_ok)
    if njs.day_pillar != f'{g}{z_ok}' or njs.day_pillar_note:
        bad.append(f"日干 {g} + 日支 {z_ok}(相合)→ {njs.day_pillar} / {njs.day_pillar_note!r},应得 {g}{z_ok}")
    assert birth.day_gan and birth.day_zhi and not NJ._same_yinyang(birth.day_gan, '子')   # 样本里确有阴阳不合的档
    return bad


def _inline_palace(technique, field):
    """推演宫「自出（宫部首支）」= 宫部的首支;其余档 = 档值本身。自出的期望值独立再算(直调引擎按出生时刻排宫部)。"""
    bad = []
    auto_palace = _birth_sample().palace_section[0]
    palace_opts = _inline_options(technique, field)
    assert not _same_text(auto_palace, palace_opts[1]['value']), f'样本上自出宫 {auto_palace!r} 与首档相同,分不清'
    for opt in palace_opts:
        res = _pan(SERVICES[technique], _send(field, opt['value']))
        want = auto_palace if opt['value'] == '' else opt['value']
        if not _same_text(res['nanji']['divine']['palace'], want):
            bad.append(f"推演宫 {opt['value']!r}「{opt['label']}」→ {res['nanji']['divine']['palace']!r},应得 {want!r}")
    return bad


def _inline_chunzi_hour(technique, field):
    """蠢子时辰「按本命时支」= 出生时支;其余档 = 档值本身。"""
    bad = []
    for opt in _inline_options(technique, field):
        res = _pan(SERVICES[technique], _send(field, opt['value']))
        want = _clock_zhi(BASE['hour']) if opt['value'] == '' else opt['value']
        if not _same_text(res['chunzi']['search']['hour']['branch'], want):
            bad.append(f"蠢子时辰 {opt['value']!r}「{opt['label']}」→ {res['chunzi']['search']['hour']['branch']!r},应得 {want!r}")
    return bad


# 手写档位(齿轮里内联写的下拉)的逐档核:登记表 + 参数化,登记了 = 跑了;核对函数的技法 / 字段取自登记的键(登记错了就核错字段、判红)
INLINE_CHECKS = {
    'nanji.nanjiAfterLichun': _inline_after_lichun,
    'nanji.nanjiHourZhi': _inline_hour_zhi,
    'nanji.nanjiDayGan': _inline_day_gan,
    'nanji.nanjiDayZhi': _inline_day_zhi,
    'nanji.nanjiPalace': _inline_palace,
    'chunzi.chunziHourBranch': _inline_chunzi_hour,
}


# 手写档位的标签规则(与逐档核同一登记):空档恰一档且排第一,说法与实际语义同类 ——「自出」类(按出生时刻 / 本命推出)
# 或「随盘（默认）」(页面初值);非空档档名 = 档值(立春两档档名由核对函数按档名判,这里只要求是那两种说法);档值、档名都不重复
INLINE_BLANK = {'nanji.nanjiAfterLichun': ('随盘（默认）', ('立春后', '立春前'))}


def _inline_label_bad(case_id):
    technique, field = case_id.split('.', 1)
    opts = _inline_options(technique, field)
    bad = []
    for key in ('value', 'label'):
        seen = [o[key] for o in opts]
        dup = sorted({str(x) for x in seen if seen.count(x) > 1})
        if dup:
            bad.append(f'档{"值" if key == "value" else "名"}重复:{dup}')
    if not opts or opts[0]['value'] != '' or sum(1 for o in opts if o['value'] == '') != 1:
        bad.append('空档应恰有一档且排第一')
    follow = INLINE_BLANK.get(case_id)
    for o in opts:
        if o['value'] == '':
            if follow and o['label'] != follow[0]:
                bad.append(f"空档「{o['label']}」应是「{follow[0]}」")
            if not follow and _meaning(o['label'], opts) != ('auto', None):
                bad.append(f"空档「{o['label']}」不是「自出」类说法(实际按出生时刻 / 本命推出)")
        elif follow and o['label'] not in follow[1]:
            bad.append(f"{o['value']!r} 档名「{o['label']}」不是 {'/'.join(follow[1])} 之一")
        elif not follow and not _same_text(o['label'], o['value']):
            bad.append(f"{o['value']!r} 档名「{o['label']}」与档值不符")
    return bad


@pytest.mark.parametrize('case_id', sorted(INLINE_CHECKS))
def test_inline_options_match_backend(case_id):
    """南极手动古法(立春 / 时支 / 日干 / 日支,「随盘」= 页面初值;「自出」= 按出生时刻;日支与日干阴阳不合时不取并注明)、
    推演宫、蠢子时辰。档名先过标签规则,再逐档对后端。"""
    bad = _inline_label_bad(case_id) + INLINE_CHECKS[case_id](*case_id.split('.', 1))
    assert not bad, f'{case_id} 档位与后端不符:\n  ' + '\n  '.join(bad)


# 显式豁免:四技法里不逐档核的下拉字段(写明原因;现无)
SELECT_EXEMPT = {}


def _covered_fields():
    """逐档核了的字段 = 三张登记表(CASES / MODE_CASES / INLINE_CHECKS)—— 每张表都由参数化用例逐条跑,登记即运行。"""
    covered = {}
    for case_id in list(CASES) + list(MODE_CASES) + list(INLINE_CHECKS):
        technique, field = case_id.split('.', 1)
        if case_id in CASES:
            assert (CASES[case_id][0], CASES[case_id][1]) == (technique, field), f'{case_id} 的键与登记的技法 / 字段不一致'
        covered.setdefault(technique, set()).add(field)
    return covered


def test_every_select_field_is_covered():
    """字段级完备性:四技法齿轮里每个下拉字段,要么在 CASES / MODE_CASES / INLINE_CHECKS 里逐档核,要么登记豁免 —— 以后新加下拉不登记就红。"""
    covered = _covered_fields()
    missing = []
    for technique in ('shaozi', 'beiji', 'nanji', 'chunzi'):
        fields = _select_fields(technique)
        assert fields, f'{technique} 齿轮里读不出下拉字段'
        # 语法树里读不出的字段(展开共用字段组、工厂函数、字段对象里有展开、name / type 不是字面量)一律红:本合同不猜
        assert _schema_fields_ast()[technique]['unresolved'] == 0, f'{technique} 齿轮里有本合同读不出的字段写法'
        for f in fields:
            if f not in covered.get(technique, set()) and f'{technique}.{f}' not in SELECT_EXEMPT:
                missing.append(f'{technique}.{f}')
        # 登记了却已不存在的字段 = 登记表过期
        for f in covered.get(technique, set()):
            assert f in fields, f'{technique}.{f} 已登记逐档核,但齿轮里没有这个下拉字段'
    assert not missing, '这些下拉字段没有逐档核、也没登记豁免:' + '、'.join(missing)


def test_schema_reader_discriminates(tmp_path):
    """判别向量:读法只认 TECHNIQUE_SETTINGS_SCHEMA 一处声明;字段对象里的展开记为读不出;重复键取后一个;注释里的档不算。"""
    assert 'nanjiDayGan' in _select_fields('nanji') and 'nanjiLunarYear' not in _select_fields('nanji')
    no_inline = ('nanji', 'nanjiLunarYear')
    with pytest.raises(AssertionError):
        _inline_options(*no_inline)
    probe = tmp_path / 'schema_probe.js'
    probe.write_text("""
const OTHER = { nanji: { fields: [{ name: 'only', type: 'select', options: [] }] } };
export const TECHNIQUE_SETTINGS_SCHEMA = {
	nanji: { kind: 'record', fields: [
		{ name: 'a', type: 'number', ...({ type: 'select' }) },
		{ name: 'b', type: 'number', type: 'select', options: [
			{ value: '', label: '空' },
			// { value: '旧档', label: '注释里的档' },
			{ value: 'x', label: 'X' },
		] },
	] },
};
const LATER = { nanji: { fields: [{ name: 'later', type: 'select' }] } };
""", encoding='utf-8')
    out = _dump_schema(str(probe))
    rec = out['techniques']['nanji']
    assert out['__decls'] == 1 and rec['unresolved'] == 1                 # 字段对象里有展开 → 读不出(不当成非下拉放过)
    assert [f['name'] for f in rec['fields']] == ['b'] and rec['fields'][0]['type'] == 'select'   # 重复键取后一个;别处同名对象不读
    assert [o['value'] for o in rec['fields'][0]['options']] == ['', 'x']   # 注释掉的档不算
