// [Z4·紫微择日] 四本账登记+真值金标(照 baziZeriLedger 同律):
// ①导出账 ②挂载账(scope 化快照槽) ③方案账(格式互导必拒) ④事盘账 ⑤对偶锁+builder 段头活体对拍。
import fs from 'fs';
import path from 'path';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';
import { ZERI_SUBTABS } from '../../../constants/SubTabRegistry';
import { CASE_TYPE_OPTIONS, getCaseTypeLabel } from '../../../utils/localcases';
import { buildZiweiZeriSnapshotExtra } from '../ziweiZeriSnapshot';
import { ziweiZeriSchemeStore, qimenZeriSchemeStore } from '../schemeStore';
import { newZiweiLeaf } from '../ziweiZeriConditionTypes';

const SRC = path.join(__dirname, '..', '..', '..');
const read = (p)=>fs.readFileSync(path.join(SRC, p), 'utf8');

describe('[Z4] 四本账登记', ()=>{
	it('🔴 ①导出账:preset=ziwei 段单源+择时三段;label 表;启发式「紫微择日」先于裸「择日」', ()=>{
		const base = AI_EXPORT_PRESET_SECTIONS.ziwei;
		const tz = AI_EXPORT_PRESET_SECTIONS.ziweizeri;
		expect(Array.isArray(tz)).toBe(true);
		expect(tz).toEqual([...base, '择时搜索配置', '择时条件', '命中时段']);	// 基底自动跟随(ziwei 段表改=此处自动变)
		const ae = read('utils/aiExport.js');
		expect(ae).toContain("{ key: 'ziweizeri', label: '紫微择日' }");
		const iTz = ae.indexOf("topInfo.includes('紫微择日')");
		const iBare = ae.indexOf("topInfo.includes('择日') && !hasPrimarySpecific");
		expect(iTz).toBeGreaterThan(0);
		expect(iTz).toBeLessThan(iBare);	// 次序锚:专属分支先于裸子串
		expect(ae).toContain("subTab === 'ziweizeri'");
	});

	it('②挂载账:mount 设置 sectionsOnly+名表+宿主 scope 化快照槽', ()=>{
		expect(read('utils/techniqueMountSettings.js')).toContain("ziweizeri: { kind: 'sectionsOnly'");
		expect(read('utils/aiAnalysisContext.js')).toContain("ziweizeri: '紫微择日'");
		expect(read('components/zeri/ZiweiZeriMain.js')).toContain('techniqueScope="ziweizeri"');
		expect(read('components/ziwei/ZiWeiMain.js')).toContain("this.props.techniqueScope || 'ziwei'");	// scope 槽(双实例竞写防御)
	});

	it('③方案账:存储键注册+独立格式头互导必拒', ()=>{
		expect(read('utils/storageKeyRegistry.js')).toContain('horosa.zeri.ziwei.schemes.v1');
		const r = ziweiZeriSchemeStore.importSchemes(qimenZeriSchemeStore.exportSchemes());
		expect(r.ok).toBe(false);	// 奇门方案导入紫微必拒
	});

	it('④事盘账:localcases 类型+简繁别名', ()=>{
		expect(CASE_TYPE_OPTIONS.some((t)=>t.value === 'ziweizeri')).toBe(true);
		expect(getCaseTypeLabel('紫微择日')).toBe('紫微择日');
		expect(getCaseTypeLabel('紫微擇日')).toBe('紫微择日');
		expect(getCaseTypeLabel('ziweizeri')).toBe('紫微择日');
	});

	it('🔴 ⑤对偶锁:SubTabRegistry⇔ZeriMain TabPane⇔help TabPane 三处成对', ()=>{
		expect(ZERI_SUBTABS).toContain('ziweizeri');
		expect(read('components/zeri/ZeriMain.js')).toContain('key="ziweizeri"');
		expect(read('components/help/ZeriHelpDoc.js')).toContain('key="ziweizeri"');
	});
});

describe('[Z4] 快照段头真值(builder↔preset 逐字成对)', ()=>{
	it('🔴 builder 三段头与 preset 追加三段逐字相同(活体对拍)', ()=>{
		const tree = { kind: 'group', joiner: 'all', children: [newZiweiLeaf('ming_gong_zhi')] };
		const txt = buildZiweiZeriSnapshotExtra({
			cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-31', endTime: '23:59' },
			geo: { pos: '北京', zone: '+08:00' },
			tree,
			results: [{ start: '2026-01-05 09:00', end: '2026-01-05 11:00', durationMin: 120, mingText: '命宫午·破军', juText: '木三局' }],
			truncated: false,
		});
		const extraSecs = AI_EXPORT_PRESET_SECTIONS.ziweizeri.slice(-3);
		extraSecs.forEach((sec)=>{
			expect(txt).toContain(`[${sec}]`);
		});
		const idx = extraSecs.map((sec)=>txt.indexOf(`[${sec}]`));
		expect(idx[0]).toBeLessThan(idx[1]);
		expect(idx[1]).toBeLessThan(idx[2]);
		expect(txt).toContain('2026-01-05 09:00');
		expect(txt).toContain('命宫午·破军');
		expect(txt).toContain('木三局');
	});

	it('技法清单/迁移键清单登记(源码级——AI_EXPORT_TECHNIQUES 未导出)', ()=>{
		const ae = read('utils/aiExport.js');
		const techList = ae.slice(ae.indexOf('const AI_EXPORT_TECHNIQUES'), ae.indexOf('export const AI_EXPORT_PRESET_SECTIONS'));
		expect(techList).toContain("{ key: 'ziweizeri', label: '紫微择日' }");
		const mig = ae.slice(ae.indexOf('AI_EXPORT_SECTION_MIGRATION_KEYS'), ae.indexOf('AI_EXPORT_PLANET_INFO_DEFAULT'));
		expect((mig.match(/'ziweizeri',/g) || []).length).toBeGreaterThanOrEqual(1);
	});
});
