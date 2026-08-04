// [奇门择日 T1] 条件注册表哨兵:
// ① 注册表完备性(13 类结构齐 + 默认值必过 compileQimenTree);
// ② 格局清单机械同源 —— fs 直读 DunJiaBaGongRules 源码,提取 calcJi/XiongPatterns 函数体内
//    addPattern 字面量集,断言 == QIMEN_JI/XIONG_PATTERN_NAMES 导出(任一侧加格局/改名即红);
//    含「注错自证」反向断言(剔除一键必不等,证明比对器有牙)。
// ③ 死值审计 —— 真盘语料上断言 干/门/星/神/标记/生克 每个可选值至少可命中一次(死选项即红),
//    并反向断言 甲 永不上盘、转盘无勾雀常。
// ④ canon 规则:转盘 芮/禽 显「内」的匹配语义。
import fs from 'fs';
import path from 'path';
import {
	QIMEN_CONDITION_TYPES,
	newQimenLeaf,
	newQimenGroup,
	compileQimenTree,
	qimenLeafSummary,
	makeQimenEvalCtx,
} from '../qimenConditionTypes';
import {
	QIMEN_JI_PATTERN_NAMES,
	QIMEN_XIONG_PATTERN_NAMES,
	getMenGongRelation,
} from '../../../components/dunjia/DunJiaBaGongRules';
import { computeQimenScanPan, buildQimenScanSeeds } from '../qimenScanEngine';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
// 与 dunjiaSnapshotTableEquiv 冻结基线同参(chaibu/转盘/直接时间/24点换日)。
const BASE_OPTIONS = {
	paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1,
	kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false,
	timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1,
};
const SEEDS = buildQimenScanSeeds(2026, 2026, '+08:00');
const panAt = (date, time, extra)=>computeQimenScanPan(GEO, { ...BASE_OPTIONS, ...(extra || {}) }, SEEDS, date, time);
const pad2 = (n)=>(n < 10 ? `0${n}` : `${n}`);

function leafOf(type, params, negate){
	const leaf = newQimenLeaf(type);
	leaf.params = { ...leaf.params, ...(params || {}) };
	if(negate){ leaf.negate = true; }
	return leaf;
}
function evalLeaf(pan, type, params){
	const spec = QIMEN_CONDITION_TYPES[type];
	const merged = { ...JSON.parse(JSON.stringify(spec.defaults)), ...(params || {}) };
	return spec.evaluate(pan, merged, makeQimenEvalCtx(pan));
}

describe('T1① 注册表完备性', ()=>{
	test('每类结构齐:category/label/defaults/fields/validate/summary/evaluate', ()=>{
		const keys = Object.keys(QIMEN_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(13);
		keys.forEach((key)=>{
			const spec = QIMEN_CONDITION_TYPES[key];
			expect({ key, ok: !!(spec.category && spec.label) }).toEqual({ key, ok: true });
			expect({ key, defaults: typeof spec.defaults }).toEqual({ key, defaults: 'object' });
			expect({ key, fields: Array.isArray(spec.fields) && spec.fields.length > 0 }).toEqual({ key, fields: true });
			expect({ key, fns: [typeof spec.validate, typeof spec.summary, typeof spec.evaluate] })
				.toEqual({ key, fns: ['function', 'function', 'function'] });
			spec.fields.forEach((f)=>{
				expect(['select', 'multiselect', 'number', 'toggle'].indexOf(f.kind) >= 0).toBe(true);
			});
		});
	});
	test('默认值必过 compileQimenTree(添加即用契约)', ()=>{
		Object.keys(QIMEN_CONDITION_TYPES).forEach((key)=>{
			const tree = { ...newQimenGroup('all'), children: [newQimenLeaf(key)] };
			expect(()=>compileQimenTree(tree)).not.toThrow();
			expect(qimenLeafSummary(newQimenLeaf(key))).toContain(QIMEN_CONDITION_TYPES[key].label);
		});
	});
	test('validate 有牙:清空必填项即抛且带类标签', ()=>{
		const bad = { ...newQimenGroup('all'), children: [leafOf('tian_gan', { values: [] })] };
		expect(()=>compileQimenTree(bad)).toThrow('天盘干');
	});
	test('链式 joiner 左折叠 + negate 编译为 not 包裹', ()=>{
		const t = compileQimenTree({ ...newQimenGroup('all'), children: [
			leafOf('tian_gan', { values: ['乙'] }),
			{ ...leafOf('door', { values: ['开'] }), joiner: 'all' },
			{ ...leafOf('god', { values: ['符'] }, true), joiner: 'any' },
		] });
		expect(t.type).toBe('any');
		expect(t.conditions.length).toBe(2);
		expect(t.conditions[0].type).toBe('all');
		expect(t.conditions[1].type).toBe('not');
		expect(t.conditions[1].conditions[0].type).toBe('god');
	});
});

describe('T1② 格局清单机械同源(注错自证)', ()=>{
	const src = fs.readFileSync(path.resolve(__dirname, '../../../components/dunjia/DunJiaBaGongRules.js'), 'utf8');
	const fnBody = (name)=>{
		const start = src.indexOf(`function ${name}(`);
		expect(start).toBeGreaterThan(0);
		const end = src.indexOf('\n}', start);
		return src.slice(start, end);
	};
	const literalsOf = (name)=>{
		const out = [];
		const re = /addPattern\(out, ['"]([^'"]+)['"]\)/g;
		const body = fnBody(name);
		let m = re.exec(body);
		while(m){
			out.push(m[1]);
			m = re.exec(body);
		}
		return out;
	};
	test('吉格:addPattern 字面量集 == QIMEN_JI_PATTERN_NAMES', ()=>{
		const emitted = literalsOf('calcJiPatterns');
		expect(emitted.length).toBeGreaterThanOrEqual(31);
		expect(new Set(emitted)).toEqual(new Set(QIMEN_JI_PATTERN_NAMES));
	});
	test('凶格:addPattern 字面量集 == QIMEN_XIONG_PATTERN_NAMES', ()=>{
		const emitted = literalsOf('calcXiongPatterns');
		expect(emitted.length).toBeGreaterThanOrEqual(31);
		expect(new Set(emitted)).toEqual(new Set(QIMEN_XIONG_PATTERN_NAMES));
	});
	test('注错自证:任一侧剔一键,比对器必咬', ()=>{
		const emitted = literalsOf('calcJiPatterns');
		expect(new Set(emitted.slice(1))).not.toEqual(new Set(QIMEN_JI_PATTERN_NAMES));
		expect(new Set([...QIMEN_XIONG_PATTERN_NAMES].slice(1))).not.toEqual(new Set(literalsOf('calcXiongPatterns')));
	});
	test('注册表 options 与导出恒等(零手抄)', ()=>{
		expect(QIMEN_CONDITION_TYPES.pattern_ji.fields[0].options.map((o)=>o.value)).toEqual(QIMEN_JI_PATTERN_NAMES);
		expect(QIMEN_CONDITION_TYPES.pattern_xiong.fields[0].options.map((o)=>o.value)).toEqual(QIMEN_XIONG_PATTERN_NAMES);
	});
});

describe('T1③ 死值审计(真盘语料)', ()=>{
	// 语料:2026-05-10..16 隔 2 小时(84 盘,转盘) + 同窗 05-15 全天飞盘(12 盘)。
	const zhuanPans = [];
	for(let d = 10; d <= 16; d++){
		for(let h = 0; h < 24; h += 2){
			zhuanPans.push(panAt(`2026-05-${pad2(d)}`, `${pad2(h)}:30:00`));
		}
	}
	const feiPans = [];
	for(let h = 0; h < 24; h += 2){
		feiPans.push(panAt('2026-05-15', `${pad2(h)}:30:00`, { school: '飞盘' }));
	}
	const collect = (pans, pick)=>{
		const set = new Set();
		pans.forEach((pan)=>(pan && pan.cells ? pan.cells : []).forEach((cell)=>pick(cell, set)));
		return set;
	};
	test('八门每值可命中', ()=>{
		const doors = collect(zhuanPans, (c, s)=>{ if(c.door){ s.add(c.door); } });
		['休', '生', '伤', '杜', '景', '死', '惊', '开'].forEach((d)=>expect({ d, in: doors.has(d) }).toEqual({ d, in: true }));
	});
	test('九干天/地盘每值可命中,甲永不上盘(反向)', ()=>{
		const tian = collect(zhuanPans, (c, s)=>{ if(c.tianGan){ s.add(c.tianGan); } });
		const di = collect(zhuanPans, (c, s)=>{ if(c.diGan){ s.add(c.diGan); } });
		['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].forEach((g)=>{
			expect({ g, tian: tian.has(g), di: di.has(g) }).toEqual({ g, tian: true, di: true });
		});
		expect(tian.has('甲')).toBe(false);
		expect(di.has('甲')).toBe(false);
	});
	test('九星每值可命中(转盘经内-canon,飞盘真芮/禽),八神含飞盘勾雀常、转盘无(反向)', ()=>{
		const zhuanStars = collect(zhuanPans, (c, s)=>{ if(c.tianXing){ s.add(c.tianXing); } });
		['蓬', '任', '冲', '辅', '英', '柱', '心'].forEach((st)=>expect({ st, in: zhuanStars.has(st) }).toEqual({ st, in: true }));
		expect(zhuanStars.has('内')).toBe(true);
		const feiStars = collect(feiPans, (c, s)=>{ if(c.tianXing){ s.add(c.tianXing); } });
		expect(feiStars.has('芮')).toBe(true);
		expect(feiStars.has('禽')).toBe(true);
		const zhuanGods = collect(zhuanPans, (c, s)=>{ if(c.god){ s.add(`${c.god}`.charAt(0)); } });
		['符', '蛇', '阴', '合', '虎', '玄', '地', '天'].forEach((g)=>expect({ g, in: zhuanGods.has(g) }).toEqual({ g, in: true }));
		expect(zhuanGods.has('勾')).toBe(false);
		expect(zhuanGods.has('雀')).toBe(false);
		const feiGods = collect(feiPans, (c, s)=>{ if(c.god){ s.add(`${c.god}`.charAt(0)); } });
		['勾', '雀', '常'].forEach((g)=>expect({ g, in: feiGods.has(g) }).toEqual({ g, in: true }));
	});
	test('宫位标记五值与门宫生克五态各可命中', ()=>{
		const flags = new Set();
		const rels = new Set();
		zhuanPans.forEach((pan)=>(pan && pan.cells ? pan.cells : []).forEach((c)=>{
			if(c.hasKongWang){ flags.add('kongWang'); }
			if(c.isYiMa){ flags.add('yima'); }
			if(c.hasJiXing){ flags.add('jiXing'); }
			if(c.hasRuMu){ flags.add('ruMu'); }
			if(c.hasMenPo){ flags.add('menPo'); }
			const rel = getMenGongRelation(c.door, c.palaceNum);
			if(rel){ rels.add(rel); }
		}));
		['kongWang', 'yima', 'jiXing', 'ruMu', 'menPo'].forEach((f)=>expect({ f, in: flags.has(f) }).toEqual({ f, in: true }));
		['sheng', 'beisheng', 'po', 'shouzhi', 'bihe'].forEach((r)=>expect({ r, in: rels.has(r) }).toEqual({ r, in: true }));
	});
});

describe('T1④ 基线盘断言 + canon + matchMode', ()=>{
	// 冻结基线 2026-05-15 00:12(阳遁七局下元/伏吟局):乾grid9 天盘乙开门蛇心,兑grid6 值符天柱惊门,
	// 坤grid3 星「内」,离grid2/坤grid3 空亡,艮grid7/乾grid9 入墓,乾grid9 驿马。
	const pan = panAt('2026-05-15', '00:12:00');
	test('基线自检:局与值符', ()=>{
		expect(pan.juText).toBe('阳遁七局下元');
		expect(pan.zhiFu).toBe('天柱');
		expect(pan.zhiShi).toBe('惊门');
	});
	test('凶格伏吟@乾6宫 pass;吉格青龙回首 fail', ()=>{
		expect(evalLeaf(pan, 'pattern_xiong', { names: ['伏吟'], palaces: [9] }).pass).toBe(true);
		expect(evalLeaf(pan, 'pattern_ji', { names: ['青龙回首'], palaces: [] }).pass).toBe(false);
	});
	test('值符天柱落兑7宫(grid6) pass;落乾6宫(grid9) fail', ()=>{
		expect(evalLeaf(pan, 'zhifu', { stars: ['柱'], palaces: [6] }).pass).toBe(true);
		expect(evalLeaf(pan, 'zhifu', { stars: [], palaces: [9] }).pass).toBe(false);
		expect(evalLeaf(pan, 'zhishi', { doors: ['惊'], palaces: [6] }).pass).toBe(true);
	});
	test('盘面取值:天盘乙@乾 pass/天盘丙@乾 fail;空亡@离 pass;比和在场、门迫不在场(伏吟局)', ()=>{
		expect(evalLeaf(pan, 'tian_gan', { values: ['乙'], palaces: [9] }).pass).toBe(true);
		expect(evalLeaf(pan, 'tian_gan', { values: ['丙'], palaces: [9] }).pass).toBe(false);
		expect(evalLeaf(pan, 'palace_flag', { values: ['kongWang'], palaces: [2] }).pass).toBe(true);
		expect(evalLeaf(pan, 'men_gong_relation', { values: ['bihe'], palaces: [] }).pass).toBe(true);
		expect(evalLeaf(pan, 'men_gong_relation', { values: ['po'], palaces: [] }).pass).toBe(false);
	});
	test('canon:坤grid3 显「内」命中芮/禽,不命中蓬', ()=>{
		expect(evalLeaf(pan, 'star', { values: ['芮'], palaces: [3] }).pass).toBe(true);
		expect(evalLeaf(pan, 'star', { values: ['禽'], palaces: [3] }).pass).toBe(true);
		expect(evalLeaf(pan, 'star', { values: ['蓬'], palaces: [3] }).pass).toBe(false);
	});
	test('matchMode 有牙:乾宫 乙/丙 任一=pass 全部=fail', ()=>{
		expect(evalLeaf(pan, 'tian_gan', { values: ['乙', '丙'], palaces: [9], matchMode: 'any' }).pass).toBe(true);
		expect(evalLeaf(pan, 'tian_gan', { values: ['乙', '丙'], palaces: [9], matchMode: 'all' }).pass).toBe(false);
	});
	test('局象与四柱:阳遁七局下元 pass;时支子 pass;actual 带实测文本', ()=>{
		const ju = evalLeaf(pan, 'ju_info', { dun: '阳遁', juShu: ['七'], sanYuan: ['下元'] });
		expect(ju.pass).toBe(true);
		expect(ju.actual).toContain('阳遁七局下元');
		expect(evalLeaf(pan, 'pillar_ganzhi', { pillar: 'time', gans: [], zhis: ['子'] }).pass).toBe(true);
		expect(evalLeaf(pan, 'pillar_ganzhi', { pillar: 'time', gans: ['乙'], zhis: [] }).pass).toBe(false);
	});
});
