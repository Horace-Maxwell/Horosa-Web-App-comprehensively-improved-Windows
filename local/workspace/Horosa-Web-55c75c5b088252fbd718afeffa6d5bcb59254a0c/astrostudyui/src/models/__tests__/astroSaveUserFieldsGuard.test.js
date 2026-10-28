// 温启在途时用户改字段:用户操作的 fields 写入一律经 astro/saveUserFields(「用户已动手」代次 +1),温启回包时代次变了就丢弃。
// 静态守卫:组件里派发 astro/save 且 payload 带 fields 的,必须改用 saveUserFields,或在白名单写明为何不是用户操作。
import fs from 'fs';
import path from 'path';
import model from '../astro';

const SRC = path.resolve(__dirname, '../..');
// 白名单:文件 → 理由(这些写入同时带 chartObj = 算完的盘一起提交;温启的 latest-wins 本就看 chartObj 换代)
const ALLOW = {
	'components/astro/AstroPrimaryDirectionChart.js': '主限盘算完后与 chartObj 一并提交',
	'components/direction/AstroDirectMain.js': '推运算完后与 chartObj 一并提交(用户改推运设置那处已走 saveUserFields)',
};

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules'){ walk(p, out); } }
		else if(/\.jsx?$/.test(f) && !/\.test\./.test(f)){ out.push(p); }
	});
	return out;
}

// 一处 astro/save 的 payload 是否带 fields:字面对象看键;标识符看它在前 20 行内的定义
export function astroSaveCarriesFields(text, idx){
	const after = text.slice(idx, idx + 400);
	const pm = /payload\s*(:\s*)?/.exec(after);
	if(!pm){ return false; }
	const rest = after.slice(pm.index + pm[0].length);
	if(/^\{/.test(rest)){
		let depth = 0; let e = 0;
		for(; e < rest.length; e += 1){ if(rest[e] === '{'){ depth += 1; }else if(rest[e] === '}'){ depth -= 1; if(!depth){ break; } } }
		return /(^|[\s,{])fields\b/.test(rest.slice(1, e));
	}
	const id = (/^([A-Za-z_$][\w$]*)/.exec(rest) || [])[1] || (pm[1] ? null : 'payload');
	if(!id){ return false; }
	const before = text.slice(Math.max(0, idx - 1500), idx);
	const defAt = before.lastIndexOf(`${id} = {`);
	if(defAt < 0){ return new RegExp(`${id}\\.fields\\s*=`).test(before); }
	return /(^|[\s,{])fields\b/.test(before.slice(defAt, defAt + 300)) || new RegExp(`${id}\\.fields\\s*=`).test(before.slice(defAt));
}

describe('静态守卫', ()=>{
	it('🔴 组件里带 fields 的 astro/save 只剩白名单(其余用户操作一律 saveUserFields)', ()=>{
		const bad = [];
		walk(path.join(SRC, 'components'), []).concat(walk(path.join(SRC, 'pages'), [])).forEach((p)=>{
			const rel = path.relative(SRC, p).split(path.sep).join('/');
			const text = fs.readFileSync(p, 'utf8');
			const re = /type:\s*'astro\/save'/g;
			let m;
			while((m = re.exec(text))){
				if(astroSaveCarriesFields(text, m.index) && !ALLOW[rel]){ bad.push(`${rel}:${text.slice(0, m.index).split('\n').length}`); }
			}
		});
		expect(bad).toEqual([]);
	});
	it('判别力:字面对象 / 标识符两种写法都认;只切页签的不算', ()=>{
		const a = "this.props.dispatch({ type: 'astro/save', payload: { fields: flds } });";
		expect(astroSaveCarriesFields(a, a.indexOf("type:"))).toBe(true);
		const b = "let flds = {\n\tfields: { ...x },\n};\nthis.props.dispatch({\n\ttype: 'astro/save',\n\tpayload: flds\n});";
		expect(astroSaveCarriesFields(b, b.indexOf("type:"))).toBe(true);
		const c = "const payload = { currentTab: k };\nthis.props.dispatch({ type: 'astro/save', payload, });";
		expect(astroSaveCarriesFields(c, c.indexOf("type:"))).toBe(false);
	});
});

describe('温启 latest-wins 认「用户已动手」代次', ()=>{
	it('saveUserFields = save + 代次 +1', ()=>{
		const st = { ...model.state, fields: { a: { value: 1 } }, currentTab: 'ziwei' };
		const next = model.reducers.saveUserFields(st, { payload: { fields: { a: { value: 2 } } } });
		expect(next.fields.a.value).toBe(2);
		expect(next.userFieldsRev).toBe((st.userFieldsRev || 0) + 1);
		expect(model.reducers.save(st, { payload: { fields: {} } }).userFieldsRev).toBe(st.userFieldsRev);
	});
	it('🔴 温启请求在途时用户改了字段(代次变了)→ 回包丢弃,不按快照重建', ()=>{
		const dt = { ad: 1, zone: '+08:00', format: (f)=>(f === 'YYYY/MM/DD' ? '2026/07/15' : '20:00:00'), clone(){ return this; } };
		const v = (x)=>({ value: x });
		const fields = { cid: v(null), date: { value: dt }, time: { value: dt }, lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31), hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false), doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false), virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'), name: v('测'), pos: v(''), memoAstro: v(''), memoBaZi: v(''), memoZiWei: v(''), memo74: v(''), memoGua: v(''), memoLiuReng: v(''), memoQiMeng: v(''), memoSuZhan: v(''), timeAlg: v(0) };
		const st0 = { predictHook: {}, currentTab: 'ziwei', currentSubTab: null, memoType: 0, chartObj: { chartId: 'OLD', params: {} }, fields, bootChartRestore: 'pending', bootFieldsApplied: false, userFieldsRev: 0 };
		const st1 = { ...st0, fields: { ...fields, timeAlg: v(2) }, userFieldsRev: 1 };   // 用户在紫微左栏改了时间算法
		const gen = model.effects.fetchByChartData({ payload: { birth: '2026-07-21 08:30:00', ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', name: '测', timeAlg: 0, bootRestore: true, nohook: true } }, {
			select: (fn)=>({ SELECT: fn }), call: (fn)=>({ CALL: fn }), put: (a)=>({ PUT: a }),
		});
		let step = gen.next();
		let selects = 0;
		const puts = [];
		let guard = 0;
		while(!step.done && guard < 80){
			guard += 1;
			const e = step.value || {};
			if(e.SELECT){ const s = selects === 0 ? st0 : st1; selects += 1; step = gen.next(e.SELECT({ astro: s })); }
			else if(e.CALL){ step = gen.next({ Result: { params: {}, chart: { ok: 1 } } }); }
			else if(e.PUT){ puts.push(e.PUT); step = gen.next(); }
			else{ step = gen.next(); }
		}
		expect(puts.some((p)=>p.type === 'save' && p.payload && p.payload.bootChartRestore === 'dropped')).toBe(true);
		expect(puts.some((p)=>p.type === 'save' && p.payload && p.payload.fields)).toBe(false);
	});
});
