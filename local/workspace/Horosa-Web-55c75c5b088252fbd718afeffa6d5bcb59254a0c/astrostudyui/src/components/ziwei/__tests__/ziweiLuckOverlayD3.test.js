// [D3] 运限联动层金标:
//   ① 小限叠宫层:luckLabelLayers 默认参恒关(零回归)/开+选小限=插「限」层;金框语义不动
//   ② 流年神煞上盘:resolveSmallStarsForDisplay 纯函数(关同引用/形状守卫/开=博士留+将岁前换流年版对 golden)
//   ③ 快照:流年层追神煞行仅开时;管道 flowZhi 源码守卫 ④ 面板版式豁免 bump(注释在案)
import fs from 'fs';
import path from 'path';
import * as ZiWeiHelper from '../ZiWeiHelper';
import * as ZWConst from '../../../constants/ZWConst';
import { ZWEngineOptions } from '../ziweiOptions';

afterEach(()=>{
	ZWEngineOptions.flowShenshaOnChart = false;
	try{ localStorage.removeItem('ziweiShowXiaoxianLayer'); }catch(e){ /* noop */ }
});

describe('[D3] 小限叠宫层', ()=>{
	const sel = { daxian: { mingIndex: 3 }, liunian: { mingIndex: 5 }, xiaoxian: { mingIndex: 7 }, liuyue: null, liuri: null, liushi: null };
	test('🔴 默认参(不传)=恒不含 xiaoxian 层(快照/挂载/既有调用零回归)', ()=>{
		const keys = ZiWeiHelper.luckLabelLayers(sel).map((l)=>l.key);
		expect(keys.includes('xiaoxian')).toBe(false);
		localStorage.setItem('ziweiShowXiaoxianLayer', '1');   // 开关也不影响默认参路径
		expect(ZiWeiHelper.luckLabelLayers(sel).map((l)=>l.key).includes('xiaoxian')).toBe(false);
	});
	test('includeXiaoxian=true+选中小限:插「限」层于流年后;prefix/期色齐备', ()=>{
		const layers = ZiWeiHelper.luckLabelLayers(sel, true);
		const idx = layers.findIndex((l)=>l.key === 'xiaoxian');
		expect(idx).toBeGreaterThan(layers.findIndex((l)=>l.key === 'liunian'));
		expect(layers[idx].prefix).toBe('限');
		expect(layers[idx].mingIndex).toBe(7);
		expect(ZWConst.ZWPeriodPrefix.xiaoxian).toBe('限');
		expect(ZWConst.ZWPeriodColor.xiaoxian).toContain('--horosa-ziwei-period-xiaoxian');
	});
	test('🔴 金框语义不动:luckDeepestMingIndex 不消费 xiaoxian(源码守卫)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiHelper.js'), 'utf8');
		const fn = src.slice(src.indexOf('export function luckDeepestMingIndex'));
		expect(fn.slice(0, fn.indexOf('\n}')).includes('xiaoxian')).toBe(false);
	});
});

describe('[D3] resolveSmallStarsForDisplay(BUG-H 绘制期替换)', ()=>{
	const natal = [{ name: '将军' }, { name: '灾煞' }, { name: '吊客' }];
	test('🔴 关(默认)=原引用;开但缺流年支=原引用;形状≠3条=原引用(诚实降级)', ()=>{
		expect(ZiWeiHelper.resolveSmallStarsForDisplay(natal, '子', '午')).toBe(natal);
		ZWEngineOptions.flowShenshaOnChart = true;
		expect(ZiWeiHelper.resolveSmallStarsForDisplay(natal, '子', null)).toBe(natal);
		const bad = [{ name: '将军' }];
		expect(ZiWeiHelper.resolveSmallStarsForDisplay(bad, '子', '午')).toBe(bad);
	});
	test('🔴 开:博士保留;将前/岁前换流年版(对 getFlowJiangSui golden);携 natal 对照;原数组零触碰', ()=>{
		ZWEngineOptions.flowShenshaOnChart = true;
		// 流年午:将前起午(寅午戌→午),岁前起午。看子宫:将前=午+6=子→「流指背」;岁前=午起顺行至子=第7位「流岁破」
		const out = ZiWeiHelper.resolveSmallStarsForDisplay(natal, '子', '午');
		expect(out).not.toBe(natal);
		expect(out[0].name).toBe('将军');
		const flow = ZiWeiHelper.getFlowJiangSui('午');
		expect(out[1].name).toBe(flow.find((x)=>x.group === 'jiang' && x.zhi === '子').name);
		expect(out[2].name).toBe(flow.find((x)=>x.group === 'sui' && x.zhi === '子').name);
		expect(out[1].flow).toBe(true);
		expect(out[1].natal).toBe('灾煞');
		expect(out[2].natal).toBe('吊客');
		expect(natal[1].name).toBe('灾煞');   // 数据层零触碰
	});
	test('两盘消费+flow 期紫着色+管道 flowZhi 传导(源码守卫)', ()=>{
		['ZWHouse.js', 'ZWHouseSangHe.js'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			expect(`${f}:${src.includes('resolveSmallStarsForDisplay')}`).toBe(`${f}:true`);
			expect(`${f}:${src.includes('star.flow ? ZWCont.ZWPeriodColor.liunian')}`).toBe(`${f}:true`);
		});
		const main = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(main.includes('flowZhi: (sel.liunian && sel.liunian.zhi) || null')).toBe(true);
		expect(main.includes('luckFlowZhi={luckRender.flowZhi}')).toBe(true);
		const wrap = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiChart.js'), 'utf8');
		expect(wrap.includes('this.zwchart.flowZhi = this.props.luckFlowZhi')).toBe(true);
	});
});

describe('[D3] 快照与面板', ()=>{
	test('🔴 快照:流年层神煞行仅开时追加(默认关=基线字节稳);tbNotes 注记(源码守卫)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(/flowShenshaOnChart && layer\.zhi && levelLabel === ZW_PERIOD_LEVEL_LABEL\.liunian/.test(src)).toBe(true);
		expect(src.includes('流年神煞·将前')).toBe(true);
		expect(src.includes("tbNotes.push('流年神煞上盘")).toBe(true);
	});
	test('面板版式:自持 setState+LS 持久;豁免 bump 理由注释在案(源码守卫)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZWLuckPanel.js'), 'utf8');
		expect(src.includes("safeLocalStorageSet('ziweiLuckPanelLayout'")).toBe(true);   // [125] 改走 safeStorage 后锚随迁
		expect(src.includes('豁免 bumpZwDisplayRev')).toBe(true);
		expect(src.includes('is-wrap')).toBe(true);
	});
});
