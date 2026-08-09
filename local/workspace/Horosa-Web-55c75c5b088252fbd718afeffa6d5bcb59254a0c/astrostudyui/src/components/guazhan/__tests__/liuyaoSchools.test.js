import {
	DEFAULT_LIUYAO_SETTINGS, LIUYAO_PRESETS, LIUYAO_SCHOOL_OPTIONS,
	applyPreset, setOption, normalizeLiuyaoSettings, getLiuyaoOptionsKey,
} from '../../gua/liuyaoSchools';
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { Gua64 } from '../../gua/GuaConst';

function byName(n){ return Gua64.find((g) => g.name === n); }
const CTX = { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '午' };

describe('六爻流派体系·WP-J 预设/开关', () => {
	test('6 预设 + default 共 7;选项齐', () => {
		// [六爻补齐] 新增 tianji 预设(古籍综合断诀档,中性键)
		expect(Object.keys(LIUYAO_PRESETS)).toEqual(['default', 'zengshan', 'bushi', 'yiyin', 'xinpai', 'mangpai', 'tianji']);
		expect(LIUYAO_SCHOOL_OPTIONS).toHaveLength(7);
	});
	test('增删卜易:弃卦身+几弃神煞', () => {
		const s = applyPreset('zengshan');
		expect(s.guashen).toBe(false);
		expect(s.shensha.on).toBe(false);
		expect(s.school).toBe('zengshan');
	});
	test('易隐:逐爻全标飞伏 + 神煞极繁(含文昌)', () => {
		const s = applyPreset('yiyin');
		expect(s.fushen).toBe('all');
		expect(s.shensha.set).toContain('文昌');
	});
	test('盲派:变爻作用范围扩展', () => {
		expect(applyPreset('mangpai').bianyaoScope).toBe('blind');
	});
	test('改单开关 → school 标 custom', () => {
		const base = applyPreset('default');
		const next = setOption(base, 'guashen', false);
		expect(next.guashen).toBe(false);
		expect(next.school).toBe('custom');
	});
	test('神煞子开关合并', () => {
		const next = setOption(applyPreset('default'), 'shensha', { on: false });
		expect(next.shensha.on).toBe(false);
		expect(next.shensha.set.length).toBeGreaterThan(0); // set 保留
	});
	test('normalizeLiuyaoSettings(null)=默认;非法 school 归 default', () => {
		expect(normalizeLiuyaoSettings(null).school).toBe('default');
		expect(normalizeLiuyaoSettings({ school: 'xxx' }).school).toBe('default');
		expect(normalizeLiuyaoSettings({ school: 'custom' }).school).toBe('custom');
	});
	test('getLiuyaoOptionsKey 随选项变', () => {
		const k1 = getLiuyaoOptionsKey(applyPreset('default'));
		const k2 = getLiuyaoOptionsKey(applyPreset('zengshan'));
		expect(k1).not.toBe(k2);
	});
});

describe('六爻门面·WP-J analyzeLiuyao 编排', () => {
	test('默认:全段齐(结构/用神/动变/神煞/六神/错综互/卦身)', () => {
		const r = analyzeLiuyao(byName('火水未济'), [3], CTX, DEFAULT_LIUYAO_SETTINGS);
		expect(r.palaceType.type).toBe('三世');
		expect(r.guaShen.body).toBe('申');
		expect(r.yongShen.yong).toBe('世');           // askType self
		expect(r.dongBian.movingCount).toBe(1);
		expect(r.shenSha).not.toBeNull();
		expect(r.liuShen).not.toBeNull();
		expect(r.related.cuo).not.toBeNull();
		expect(r.related.hu).not.toBeNull();
		expect(r.yaos).toHaveLength(6);
		expect(r.kongPair).toBe('戌亥');               // 甲子旬空
	});
	test('增删卜易:卦身/神煞关闭', () => {
		const r = analyzeLiuyao(byName('火水未济'), [3], CTX, applyPreset('zengshan'));
		expect(r.guaShen).toBeNull();
		expect(r.shenSha).toBeNull();
		expect(r.liuShen).not.toBeNull(); // 六神仍开
	});
	test('易隐:逐爻全标飞伏', () => {
		const r = analyzeLiuyao(byName('火水未济'), [3], CTX, applyPreset('yiyin'));
		expect(r.fushenAll).toHaveLength(6);
		r.fushenAll.forEach((f) => { expect(f.liuqin).toBeTruthy(); });
	});
	test('土长生火土同宫(fire)切换影响入墓', () => {
		const water = analyzeLiuyao(byName('坤为地'), [], { ...CTX, dayZhi: '辰' }, { ...DEFAULT_LIUYAO_SETTINGS, tuChangsheng: 'water' });
		const fire = analyzeLiuyao(byName('坤为地'), [], { ...CTX, dayZhi: '辰' }, { ...DEFAULT_LIUYAO_SETTINGS, tuChangsheng: 'fire' });
		// 坤为地多土爻:辰日水土同宫=土墓辰(有入墓);火土同宫=土墓戌(辰非墓)
		const waterMu = water.yaos.some((y) => y.wuxing === '土' && y.ruMu);
		const fireMu = fire.yaos.some((y) => y.wuxing === '土' && y.ruMu);
		expect(waterMu).toBe(true);
		expect(fireMu).toBe(false);
	});
});

// ══ [G-B] 起卦体验三键(随机概率源/随机前确认/录入默认爻) ═══
describe('[G-B] 三新键默认值+源码接线守卫', ()=>{
	const fs = require('fs'); const path = require('path');
	const { DEFAULT_LIUYAO_SETTINGS } = require('../../gua/liuyaoSchools');
	test('🔴 默认值=现状零回归(coins/false/shaoyang)', ()=>{
		expect(DEFAULT_LIUYAO_SETTINGS.randomAlgo).toBe('coins');
		expect(DEFAULT_LIUYAO_SETTINGS.randomConfirm).toBe(false);
		expect(DEFAULT_LIUYAO_SETTINGS.defaultYaoState).toBe('shaoyang');
	});
	test('🔴 G2 分派器:rollYao 按档取源;5 处随机消费全走 rollYao(禁直连 randYao 回潮)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'GuaZhanMain.js'), 'utf8');
		expect(/rollYao\(\)\{[\s\S]{0,220}yarrow[\s\S]{0,80}yarrowYao\(\)[\s\S]{0,40}randYao\(\)/.test(src)).toBe(true);
		const direct = (src.match(/randYao\(\)/g) || []).length;
		expect(direct).toBe(1);   // 仅分派器内 1 处
		expect((src.match(/this\.rollYao\(\)/g) || []).length).toBe(5);
	});
	test('🔴 G3 守卫:randomConfirm 开+手动来源才弹;time/空盘直滚;停止恒放行', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'GuaZhanMain.js'), 'utf8');
		expect(/confirmRandomThen\(run\)\{[\s\S]{0,240}!s\.randomConfirm \|\| !origin \|\| origin === 'time'[\s\S]{0,20}run\(\)/.test(src)).toBe(true);
		expect(/genGua\(\)\{[\s\S]{0,560}if\(!stopAct\)\{[\s\S]{0,120}confirmRandomThen/.test(src)).toBe(true);
		expect(/genYao\(idx\)\{[\s\S]{0,700}confirmRandomThen/.test(src)).toBe(true);
	});
	test('G4 默认爻态:CastPad 两录入面同步按档;切档经 key 重挂立即生效', ()=>{
		const pad = fs.readFileSync(path.resolve(__dirname, '..', 'LiuYaoCastPad.js'), 'utf8');
		expect(pad.includes("props.defaultYaoState === 'shaoyin'")).toBe(true);
		expect(pad.includes('yin ? [2, 2, 2, 2, 2, 2]')).toBe(true);
		expect(pad.includes('yin ? [8, 8, 8, 8, 8, 8]')).toBe(true);
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'GuaZhanMain.js'), 'utf8');
		expect(src.includes('defaultYaoState={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState}')).toBe(true);
		expect(src.includes('key={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState}')).toBe(true);
	});
});
