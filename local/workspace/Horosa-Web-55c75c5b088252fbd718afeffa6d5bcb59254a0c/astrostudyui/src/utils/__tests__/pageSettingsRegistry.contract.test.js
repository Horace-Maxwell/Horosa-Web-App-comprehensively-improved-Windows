// 技法页「排盘设置跨会话保留」合同:登记表 ↔ 页面源码 ↔ 存储键注册表 三方机械对拍。
// 目的:页面加了新选项却没人表态「重开软件后留不留」= 红;登记表与源码 schema 漂移 = 红;键没登记进备份面 = 红。
import fs from 'fs';
import path from 'path';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { classifyStorageKey } from '../storageKeyRegistry';

const SRC = path.resolve(__dirname, '..', '..');

// 本合同要真 require 各页面模块(对着活的 schema 对象查)。天文馆那个文件顶层就 new BABYLON.Color3()(取自 window.BABYLON),
// 在 node / jsdom 里先给一个最小桩,它才加载得起来(同 planetariumSkyReadout.test.js 的做法;对其它页无影响)。
(function installBabylonStub(){
	class V3 { constructor(x, y, z){ this.x = x; this.y = y; this.z = z; } length(){ return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); } normalize(){ const l = this.length() || 1; return new V3(this.x / l, this.y / l, this.z / l); } clone(){ return new V3(this.x, this.y, this.z); } scale(k){ return new V3(this.x * k, this.y * k, this.z * k); } }
	const B = { Color3: function(r, g, b){ this.r = r; this.g = g; this.b = b; }, Color4: function(r, g, b, a){ this.r = r; this.g = g; this.b = b; this.a = a; }, Vector3: V3 };
	B.Color3.White = ()=>new B.Color3(1, 1, 1);
	B.Vector3.Zero = ()=>new V3(0, 0, 0);
	if(typeof window !== 'undefined' && !window.BABYLON){ window.BABYLON = B; }
	if(!global.BABYLON){ global.BABYLON = B; }
})();

function read(rel){
	return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

// 取 definePageSettings('<key>', { … }) 的 schema 顶层键(按花括号配平切块,再取块内第一层的「标识符:」)
function schemaKeysOf(src, storageKey){
	const at = src.indexOf(`definePageSettings('${storageKey}'`);
	if(at < 0){ return null; }
	const open = src.indexOf('{', at);
	let depth = 0; let end = -1;
	for(let i = open; i < src.length; i++){
		const ch = src[i];
		if(ch === '{'){ depth++; }
		else if(ch === '}'){ depth--; if(depth === 0){ end = i; break; } }
	}
	const body = src.slice(open + 1, end);
	const keys = [];
	let d = 0; let lineStart = true; let buf = '';
	for(let i = 0; i < body.length; i++){
		const ch = body[i];
		if(ch === '{' || ch === '(' || ch === '['){ d++; }
		else if(ch === '}' || ch === ')' || ch === ']'){ d--; }
		if(ch === '\n'){ lineStart = true; buf = ''; continue; }
		if(lineStart && d === 0){
			buf += ch;
			const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(buf);
			if(m){ keys.push(m[1]); lineStart = false; }
			else if(/^\s*\/\//.test(buf)){ lineStart = false; }
		}
	}
	return keys;
}

// 页面里「用户可改的选项键」全集。剥掉注释再扫,免得注释里的示例代码进分母。
function changeableKeysOf(src, changeVia, stateAlias){
	// 一页里两种改法并存(大部分走 onOptionChange,个别控件直接绑 state)→ changeVia 给数组,取并集
	if(Array.isArray(changeVia)){
		const all = new Set();
		changeVia.forEach((v)=>changeableKeysOf(src, v, stateAlias).forEach((k)=>all.add(k)));
		return Array.from(all).sort();
	}
	const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
	const out = new Set();
	if(changeVia === 'optionKey'){
		const re = /onOptionChange\(\s*'([A-Za-z0-9_]+)'/g; let m;
		while((m = re.exec(code))){ out.add(m[1]); }
		// 循环里用变量名当键的写法:[['mixTian', …], …].map(([key …]) => … onOptionChange(key, v))
		// 只有循环体里真的把循环变量当**选项键**传给 onOptionChange(变量, …) 才算;把它当 map 型设置的子键用的
		// (如太乙流派:onOptionChange('school', { …, [k]: v }))不算 —— 那组子键由 'school' 这个 map 字段整体负责。
		const loop = /\[\[\s*'([A-Za-z0-9_]+)'[^\]]*\](?:\s*,\s*\[\s*'([A-Za-z0-9_]+)'[^\]]*\])*\]\.map\(\(\[(key|k)\b/g; let lm;
		while((lm = loop.exec(code))){
			const v = lm[3];
			const body = code.slice(lm.index + lm[0].length, lm.index + lm[0].length + 900);
			if(!new RegExp('onOptionChange\\(\\s*' + v + '\\s*,').test(body)){ continue; }
			const seg = lm[0]; const kr = /\[\s*'([A-Za-z0-9_]+)'/g; let km;
			while((km = kr.exec(seg))){ out.add(km[1]); }
		}
	}else if(changeVia === 'stateDiff'){
		// 在 componentDidUpdate 里按「保留键前后值」统一落盘的页:分母 = 构造函数 this.state = { … } 字面量第一层的全部键
		const at = code.indexOf('this.state = {');
		if(at >= 0){
			const open = code.indexOf('{', at);
			let depth = 0; let end = -1;
			for(let i = open; i < code.length; i++){
				const ch = code[i];
				if(ch === '{' || ch === '(' || ch === '['){ depth++; }
				else if(ch === '}' || ch === ')' || ch === ']'){ depth--; if(depth === 0){ end = i; break; } }
			}
			let d = 0; let seg = '';
			for(let i = open + 1; i < end; i++){
				const ch = code[i];
				if(ch === '{' || ch === '(' || ch === '['){ d++; }
				else if(ch === '}' || ch === ')' || ch === ']'){ d--; }
				else if(d === 0){ seg += ch; }
			}
			const kr = /(?:^|,|\n)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g; let km;
			while((km = kr.exec(seg))){ out.add(km[1]); }
		}
	}else if(changeVia === 'extraKey'){
		// setExtra({ a: …, b: … }):取对象字面量第一层的键(按花括号配平切块;嵌套对象里的键不算)。
		// 页面自己包的落盘入口 userSetExtra(setExtra, { … }) 同样算(世俗盘的设置项全走它:不认它 = 那一页新加的设置键
		// 既不在 schema 里、也没人表态,store 悄悄忽略、合同也不红 —— 正是本制度要堵的那一类)。
		const re = /(?:setExtra\(\s*\{|userSetExtra\(\s*setExtra\s*,\s*\{)/g; let m;
		while((m = re.exec(code))){
			let i = m.index + m[0].length; let depth = 1; let seg = '';
			while(i < code.length && depth > 0){
				const ch = code[i];
				if(ch === '{' || ch === '(' || ch === '['){ depth++; }
				else if(ch === '}' || ch === ')' || ch === ']'){ depth--; }
				if(depth === 1){ seg += ch; }else if(depth > 1 && (ch === '{' || ch === '(' || ch === '[')){ seg += ' '; }
				i++;
			}
			const kr = /(?:^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g; let km;
			while((km = kr.exec(seg))){ out.add(km[1]); }
		}
	}else{
		// 任何控件的 value|checked={ … }:按花括号配平取出整段表达式,再取其中第一个 this.state.X。
		// 不锚标签名、不要求 this.state 紧跟在 `{` 后面 —— 多行 JSX(value 写在 onChange 之后,箭头函数的 `>` 会截断
		// 「[^>]*」式的匹配)、`!!this.state.X`、`Number(this.state.X) || …`、`this.state.map[k]` 都要抓得到。
		// 宁可多抓(多抓 = 多一个要表态的键),不可漏抓。
		// 页面在 render 里给 this.state 起了别名(const s = this.state)的,别名也认
		const stateRe = stateAlias
			? new RegExp('(?:this\\.state|\\b' + stateAlias + ')\\.([A-Za-z0-9_]+)')
			: /this\.state\.([A-Za-z0-9_]+)/;
		const re = /\b(?:value|checked)=\{/g; let m;
		while((m = re.exec(code))){
			let i = m.index + m[0].length; let depth = 1;
			while(i < code.length && depth > 0){
				const ch = code[i];
				if(ch === '{'){ depth++; }else if(ch === '}'){ depth--; }
				i++;
			}
			const expr = code.slice(m.index + m[0].length, i - 1);
			const sm = stateRe.exec(expr);
			if(sm){ out.add(sm[1]); }
		}
		// 有的页把控件写成配置对象再统一渲染({ label, value: s.variant, onChange … }):对象字面量里的 value: 也算
		const objRe = /\bvalue:\s*([^\n]*)/g; let om;
		while((om = objRe.exec(code))){
			const sm = stateRe.exec(om[1]);
			if(sm){ out.add(sm[1]); }
		}
	}
	return Array.from(out).sort();
}

describe('技法页排盘设置登记表合同', ()=>{
	it('登记表非空,page / storageKey / exportName 互不重复', ()=>{
		expect(PAGE_SETTINGS_REGISTRY.length).toBeGreaterThan(0);
		['page', 'storageKey', 'exportName'].forEach((k)=>{
			const vals = PAGE_SETTINGS_REGISTRY.map((e)=>e[k]);
			expect(new Set(vals).size).toBe(vals.length);
		});
	});

	PAGE_SETTINGS_REGISTRY.forEach((entry)=>{
		describe(entry.page, ()=>{
			const src = read(entry.file);
			// 读 / 写 / 可改键枚举的对象:单页 = 页面自己;设置件独立成文件的族 = 各 consumers 拼起来
			const useSrc = (entry.consumers && entry.consumers.length) ? entry.consumers.map(read).join('\n/* ---- */\n') : src;

			it('落盘键已登记为 settings 且进备份面', ()=>{
				const c = classifyStorageKey(entry.storageKey);
				expect(c).toBeTruthy();
				expect(c.kind).toBe('settings');
				expect(c.backup).toBe(true);
			});

			it('页面确实用单源件定义了这份设置,并且既读又写', ()=>{
				expect(src).toContain(`export const ${entry.exportName} = definePageSettings('${entry.storageKey}'`);
				// 读:直接 load / loadSaved,或经盘壳播种件 seedShellFromSaved(<本页设置>, …)
				expect(new RegExp(`${entry.exportName}\\.(load|loadSaved)\\(|seedShellFromSaved\\(${entry.exportName},`).test(useSrc)).toBe(true);
				expect(new RegExp(`${entry.exportName}\\.save\\(`).test(useSrc)).toBe(true);
				// 族:每个 consumer 都得真的用到这份设置(列了却没接 = 登记表在说谎)
				(entry.consumers || []).forEach((f)=>expect(`${f}: ${read(f).indexOf(entry.exportName) >= 0}`).toBe(`${f}: true`));
			});

			it('登记表 fields 与页面 schema 的键逐个相同(漂移即红)', ()=>{
				// 对着活的 schema 对象比:schema 里可以展开共用片段(如盘壳三键),读源码数不全
				// eslint-disable-next-line global-require, import/no-dynamic-require
				const st = require(path.join(SRC, entry.file))[entry.exportName];
				expect(st.fields.slice().sort()).toEqual(entry.fields.slice().sort());
			});

			it('凡用盘壳的页,黄道 / 宫制的亲手改动都接到了落盘', ()=>{
				if(src.indexOf('<DivinationChartShell') < 0){ return; }
				expect(new RegExp(`onUserFieldChange=\\{\\(patch\\)=>${entry.exportName}\\.save\\(patch\\)\\}`).test(src)).toBe(true);
				['zodiacal', 'siderealAyanamsa', 'hsys'].forEach((k)=>expect(entry.fields).toContain(k));
			});

			it('豁免键都写了理由,且不与保留键重叠', ()=>{
				Object.keys(entry.exempt || {}).forEach((k)=>{
					expect(typeof entry.exempt[k]).toBe('string');
					expect(entry.exempt[k].trim().length).toBeGreaterThan(3);
					expect(entry.fields.indexOf(k)).toBe(-1);
				});
			});

			it('页面里用户可改的每个选项键都已表态:保留,或带理由豁免', ()=>{
				if(entry.changeVia === 'stateDiff'){
					// 统一比对落盘的前提:本页没有任何非用户入口会改这些键(不回灌事盘、不接宿主下发口径)。前提破了 = 打开旧案就改掉用户缺省。
					['restoreFromCurrentCase', 'getKentangSavedCasePayload', 'applyCastFields', 'applyOptions'].forEach((w)=>{
						expect(`${entry.page}: ${w} ${src.indexOf(w) >= 0}`).toBe(`${entry.page}: ${w} false`);
					});
					expect(new RegExp(`${entry.exportName}\\.fields\\.forEach\\(\\(k\\) => \\{ if \\(prevState\\[k\\] !== this\\.state\\[k\\]\\)`).test(src)).toBe(true);
				}
				if(entry.changeVia === 'shellOnly'){
					// 页面自己没有可改选项:口径只有盘壳的黄道 / 宫制 → 查它确实把壳的回调接到了落盘
					expect(new RegExp(`onUserFieldChange=\\{\\(patch\\)=>${entry.exportName}\\.save\\(patch\\)\\}`).test(src)).toBe(true);
					return;
				}
				const alias = entry.keyAliases || {};
				const keys = changeableKeysOf(useSrc, entry.changeVia, entry.stateAlias).map((k)=>alias[k] || k);
				expect(keys.length).toBeGreaterThan(0);
				const decided = new Set([...entry.fields, ...Object.keys(entry.exempt || {})]);
				const undecided = keys.filter((k)=>!decided.has(k));
				expect(undecided).toEqual([]);
			});
		});
	});

	// schema 自洽(真加载页面模块,对着活的 schema 对象查,不靠读源码):
	//   · 每个字段的缺省值自己得过自己的校验(缺省不在候选里 = 读回永远回不到缺省以外的合法态,或缺省本身非法)
	//   · 候选值与缺省值同类型 —— 值形态严格(0 ≠ false、'1' ≠ 1),候选里混进别的类型的那一档永远存不进去,
	//     表现为「这一档选了重开就丢」,而且只丢这一档,极难察觉。
	describe('schema 自洽(活对象)', ()=>{
		const { validateSettingValue } = require('../pageSettingsStore');
		const checkField = (where, spec, problems, sparse)=>{
			if(spec.type === 'map'){
				Object.keys(spec.keys || {}).forEach((k)=>checkField(`${where}.${k}`, spec.keys[k], problems, !!spec.sparse));
				return;
			}
			if(spec.type === 'list'){
				if(!Array.isArray(spec.def)){ problems.push(`${where}: list 型的缺省值不是数组`); }
				(spec.def || []).forEach((v)=>{ if(Array.isArray(spec.oneOf) && spec.oneOf.indexOf(v) < 0){ problems.push(`${where}: 缺省项 ${JSON.stringify(v)} 不在候选里`); } });
				return;
			}
			const t = typeof spec.def;
			// 稀疏覆盖层的子键 def 只用来定类型(缺席 = 跟随预设,永不回填),不要求它在候选里
			if(!sparse && !validateSettingValue(spec, spec.def).ok){ problems.push(`${where}: 缺省值 ${JSON.stringify(spec.def)} 过不了自己的校验`); }
			(spec.oneOf || []).forEach((v)=>{
				if(typeof v !== t){ problems.push(`${where}: 候选 ${JSON.stringify(v)} 的类型与缺省值(${t})不同 → 这一档永远存不进去`); }
			});
			if(Array.isArray(spec.oneOf) && spec.oneOf.length < 2){ problems.push(`${where}: 候选不足两档(多半是候选常量没取到)`); }
		};
		PAGE_SETTINGS_REGISTRY.forEach((entry)=>{
			it(`${entry.page}`, ()=>{
				// eslint-disable-next-line global-require, import/no-dynamic-require
				const mod = require(path.join(SRC, entry.file));
				const st = mod[entry.exportName];
				expect(st && typeof st.load === 'function').toBe(true);
				expect(st.key).toBe(entry.storageKey);
				const problems = [];
				Object.keys(st.schema).forEach((f)=>checkField(f, st.schema[f], problems));
				expect(problems).toEqual([]);
				// 空库读回 = 缺省;读端不抛
				expect(()=>st.load()).not.toThrow();
			});
		});
	});

	it('判别向量:枚举器确实抓得到两种写法的键(抓不到 = 上面那条合同形同虚设)', ()=>{
		const a = changeableKeysOf("<Select value={this.state.guireng} onChange={x}/> // <Select value={this.state.ghost}/>", 'stateKey');
		expect(a).toEqual(['guireng']);
		// 多行 JSX(value 在箭头函数之后)/ 取反 / 包一层函数 / 取 map 子项 —— 都要抓到
		const a2 = changeableKeysOf("<Select\n onChange={(v)=>this.f(v)}\n value={this.state.late}\n/><Checkbox checked={!!this.state.flag}/><Select value={Number(this.state.house) || 1}/><Select value={this.state.granular[f.key] === undefined ? 'p' : 'q'}/>", 'stateKey');
		expect(a2).toEqual(['flag', 'granular', 'house', 'late']);
		// 统一比对落盘的页:分母 = 构造函数 state 字面量第一层键(嵌套对象 / 展开不算)
		const d1 = changeableKeysOf("constructor(){ this.state = {\n a: 1,\n b: { x: 1, y: 2 },\n lines: fn(1, 2),\n ...saved,\n }; }", 'stateDiff');
		expect(d1).toEqual(['a', 'b', 'lines']);
		// 盘壳 extra 写法:只取第一层键
		const e1 = changeableKeysOf("onChange={(v)=>setExtra({ horarySchool: v, horaryOverrides: {} })} onChange={(e)=>setExtra({ querent: { ...qs, pos: 1 } })}", 'extraKey');
		expect(e1).toEqual(['horaryOverrides', 'horarySchool', 'querent']);
		// 页面自包的落盘入口 userSetExtra(setExtra, { … }) 同样枚举得到
		const e2 = changeableKeysOf("onChange={(v)=>userSetExtra(setExtra, { mundaneOrbScheme: v })} onChange={(v)=>setExtra({ ingressYear: v })}", 'extraKey');
		expect(e2).toEqual(['ingressYear', 'mundaneOrbScheme']);
		// state 别名 + 配置对象写法
		const a3 = changeableKeysOf("const s = this.state; <Select value={s.deckId}/><Checkbox checked={!!s.useReversals}/>{this.renderPickField({ label: 'x', value: s.variant || 'A',\n onChange: f })}<Select value={b.year}/>", 'stateKey', 's');
		expect(a3).toEqual(['deckId', 'useReversals', 'variant']);
		const b = changeableKeysOf("onChange={(v)=>this.onOptionChange('school', v)} {[['mixTian', 'a'], ['mixMen', 'b']].map(([key, n])=>(<S onChange={(v)=>this.onOptionChange(key, v)}/>))}", 'optionKey');
		expect(b).toEqual(['mixMen', 'mixTian', 'school']);
		// 循环变量只当 map 子键用时不计入(否则太乙流派六个子键会被当成六个没表态的选项)
		const c = changeableKeysOf("{[['jishen', 'a'], ['sanji', 'b']].map(([k, label])=>(<S onChange={(v)=>this.onOptionChange('school', { ...x, [k]: v })}/>))}", 'optionKey');
		expect(c).toEqual(['school']);
		expect(schemaKeysOf("x = definePageSettings('k', {\n\ta: { def: 1 },\n\t// b: 注释\n\tc: { type: 'map', keys: { z: { def: 1 } } },\n});", 'k')).toEqual(['a', 'c']);
	});
});
