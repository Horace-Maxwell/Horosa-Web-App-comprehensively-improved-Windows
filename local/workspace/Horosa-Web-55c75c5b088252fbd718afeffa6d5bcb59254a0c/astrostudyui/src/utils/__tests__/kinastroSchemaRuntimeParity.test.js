// 神数诸法(邵子 / 北极 / 南极 / 蠢子)齿轮字段:运行时 schema 与源码里 TECHNIQUE_SETTINGS_SCHEMA 字面声明逐个相同(字段名、类型、档位的值与档名序列)。
// 选项合同(astropy/tests/test_kinastro_option_backend_contract.py)按语法树读字段清单逐档核;运行时再往这四个技法里加下拉、
// 加档或改档(声明之后 push / 改写)语法树看不见 —— 本用例把两边对上,改了就红,得先进合同。
import fs from 'fs';
import path from 'path';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import * as KIN_OPTIONS from '../../components/kinastro/kinastroOptions';

const parser = require('@babel/parser');
const TECHS = ['shaozi', 'beiji', 'nanji', 'chunzi'];
// 档位里的两种已知展开写法(与选项合同同一份认法);别的写法记为读不出(红)
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const norm = (t)=>`${t}`.replace(/\s+/g, '');
const KNOWN_SPREADS = {
	[norm('DIZHI_12.map((z)=>({ value: z, label: z }))')]: ZHI.map((z)=>({ value: z, label: z })),
	[norm("['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))")]: GAN.map((g)=>({ value: g, label: g })),
};
const optSeq = (opts)=>(Array.isArray(opts) ? opts.map((o)=>`${JSON.stringify(o.value)}=${o.label}`) : null);

function staticFields(){
	const src = fs.readFileSync(path.join(__dirname, '..', 'techniqueMountSettings.js'), 'utf8');
	const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'] });
	const keyName = (k)=>(k ? (k.name !== undefined ? k.name : k.value) : undefined);
	const lastProp = (obj, k)=>{ let hit = null; obj.properties.forEach((p)=>{ if(p.type === 'ObjectProperty' && !p.computed && keyName(p.key) === k){ hit = p; } }); return hit; };
	let schema = null;
	ast.program.body.forEach((st)=>{
		const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
		if(decl && decl.type === 'VariableDeclaration'){
			decl.declarations.forEach((d)=>{ if(d.id && d.id.name === 'TECHNIQUE_SETTINGS_SCHEMA'){ schema = d.init; } });
		}
	});
	const lit = (n)=>(n && (n.type === 'StringLiteral' || n.type === 'NumericLiteral') ? n.value : (n && n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'NumericLiteral' ? -n.argument.value : '?读不出'));
	const staticOptions = (op)=>{
		if(!op){ return null; }
		if(op.value.type !== 'ArrayExpression'){ return [{ value: '?', label: `?读不出的档位写法 ${src.slice(op.value.start, op.value.end).slice(0, 60)}` }]; }
		const out = [];
		op.value.elements.forEach((o)=>{
			if(o && o.type === 'ObjectExpression'){
				const v = lastProp(o, 'value'); const l = lastProp(o, 'label');
				out.push({ value: v ? lit(v.value) : '?', label: l ? lit(l.value) : '?' });
			}else if(o && o.type === 'SpreadElement' && o.argument.type === 'Identifier'){
				const arr = KIN_OPTIONS[o.argument.name];
				if(Array.isArray(arr)){ arr.forEach((x)=>out.push({ value: x.value, label: x.label })); }else{ out.push({ value: '?', label: `?未知表 ${o.argument.name}` }); }
			}else if(o && o.type === 'SpreadElement' && KNOWN_SPREADS[norm(src.slice(o.argument.start, o.argument.end))]){
				KNOWN_SPREADS[norm(src.slice(o.argument.start, o.argument.end))].forEach((x)=>out.push(x));
			}else{
				out.push({ value: '?', label: `?读不出 ${o ? src.slice(o.start, o.end).slice(0, 60) : '(空位)'}` });
			}
		});
		return out;
	};
	const out = {};
	schema.properties.forEach((p)=>{
		if(p.type !== 'ObjectProperty' || TECHS.indexOf(keyName(p.key)) < 0){ return; }
		const fp = lastProp(p.value, 'fields');
		out[keyName(p.key)] = fp.value.elements.map((el)=>{
			const nm = lastProp(el, 'name'); const ty = lastProp(el, 'type');
			return { id: `${nm ? nm.value.value : '?'}:${ty ? ty.value.value : '?'}`, options: optSeq(staticOptions(lastProp(el, 'options'))) };
		});
	});
	return out;
}

test('四技法字段名 / 类型:运行时 schema 与源码字面声明逐个相同(运行时追加的下拉也要先进选项合同)', ()=>{
	const st = staticFields();
	TECHS.forEach((t)=>{
		const rt = getTechniqueSettingsSchema(t).fields.map((f)=>`${f.name}:${f.type}`);
		expect([t, rt]).toEqual([t, st[t].map((f)=>f.id)]);
	});
});

test('四技法档位:运行时每个字段的档位(值与档名的序列)= 源码字面声明(运行时加档 / 改档也要先进选项合同)', ()=>{
	const st = staticFields();
	TECHS.forEach((t)=>{
		const rt = getTechniqueSettingsSchema(t).fields.map((f)=>({ id: `${f.name}:${f.type}`, options: optSeq(f.options) }));
		expect([t, rt]).toEqual([t, st[t]]);
		st[t].forEach((f)=>{ (f.options || []).forEach((o)=>{ expect([t, f.id, o.startsWith('"?') || o.indexOf('=?') >= 0]).toEqual([t, f.id, false]); }); });
	});
});
