// 印占页三个纯显示开关(宿数口径 27 / 28、中栏盘面、盘面叠加福德点)记住上次亲手选的:
// 与同页 Yoga 判定表 / 补充表同一份设置件(INDIA_TABLE_SETTINGS),构造时读、亲手改时写;登记表不再把它们列为「不保留」。
import fs from 'fs';
import path from 'path';
import { INDIA_TABLE_SETTINGS } from '../indiaExtraTables';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import * as AstroConst from '../../constants/AstroConst';

const SRC = path.resolve(__dirname, '../..');
const { readSource } = require('./helpers/sourceSet');
// 门面按「子模块 + 门面」全集读(sourceSetManifest 合同)
const read = (rel)=>readSource(path.join(SRC, rel));

beforeEach(()=>{ window.localStorage.clear(); });

describe('印占显示开关跨会话保留', ()=>{
	test('出厂值 = 27 宿 / 本命盘 / 不叠加;候选与页面下拉同源', ()=>{
		const d = INDIA_TABLE_SETTINGS.load();
		expect(d.indiaNakshatraCount).toBe(AstroConst.INDIA_NAKSHATRA_COUNT_DEFAULT);
		expect(d.indiaStageMode).toBe(AstroConst.INDIA_STAGE_MODE_DEFAULT);
		expect(d.indiaOverlayBB).toBe(false);
		expect(INDIA_TABLE_SETTINGS.schema.indiaNakshatraCount.oneOf).toEqual(AstroConst.INDIA_NAKSHATRA_COUNT_OPTIONS.map((o)=>o.value));
		expect(INDIA_TABLE_SETTINGS.schema.indiaStageMode.oneOf).toEqual(AstroConst.INDIA_STAGE_MODE_OPTIONS.map((o)=>o.value));
	});

	test('存了读得回;值形态不对 / 候选外的回出厂值,不连坐别的字段', ()=>{
		INDIA_TABLE_SETTINGS.save({ indiaNakshatraCount: 28, indiaStageMode: 'sbc', indiaOverlayBB: true });
		expect(INDIA_TABLE_SETTINGS.load()).toMatchObject({ indiaNakshatraCount: 28, indiaStageMode: 'sbc', indiaOverlayBB: true, yogaTableVariant: 'improved' });
		window.localStorage.setItem('horosa.india.tables.settings.v1', JSON.stringify({ values: { indiaNakshatraCount: '28', indiaStageMode: 'nope', indiaOverlayBB: 1, dirahVariant: 'classic' } }));
		expect(INDIA_TABLE_SETTINGS.load()).toMatchObject({ indiaNakshatraCount: 27, indiaStageMode: 'single', indiaOverlayBB: false, dirahVariant: 'classic' });
	});

	test('页面:构造时读、三处亲手改都写;上次停在三旗盘 → 首次取数就带三旗开关', ()=>{
		const src = read('components/astro/IndiaChartMain.js');
		expect(src).toContain('const indiaSaved = INDIA_TABLE_SETTINGS.load();');
		expect(src).toMatch(/indiaNakshatraCount: AstroConst\.normalizeIndiaNakshatraCount\(indiaSaved\.indiaNakshatraCount\)/);
		expect(src).toMatch(/indiaStageMode: AstroConst\.normalizeIndiaStageMode\(indiaSaved\.indiaStageMode\)/);
		expect(src).toMatch(/indiaOverlayBB: indiaSaved\.indiaOverlayBB === true/);
		expect(src).toMatch(/indiaTripatakiOn: AstroConst\.normalizeIndiaStageMode\(indiaSaved\.indiaStageMode\) === 'tripataki'/);
		expect(src).toContain('INDIA_TABLE_SETTINGS.save({ indiaNakshatraCount: count });');
		expect(src).toContain('INDIA_TABLE_SETTINGS.save({ indiaStageMode: mode });');
		expect(src).toContain('INDIA_TABLE_SETTINGS.save({ indiaOverlayBB: on });');
	});

	test('登记表:三键进保留字段,不再列在豁免里', ()=>{
		const entry = PAGE_SETTINGS_REGISTRY.find((e)=>e.page === 'india');
		['indiaNakshatraCount', 'indiaStageMode', 'indiaOverlayBB'].forEach((k)=>{
			expect(entry.fields).toContain(k);
			expect(Object.keys(entry.exempt)).not.toContain(k);
		});
	});
});
