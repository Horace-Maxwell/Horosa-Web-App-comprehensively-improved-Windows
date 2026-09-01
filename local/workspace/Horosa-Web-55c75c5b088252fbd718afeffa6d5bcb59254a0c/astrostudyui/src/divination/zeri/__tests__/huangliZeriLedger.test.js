// [Z1·黄历择日] 四本账登记+真值金标(照 qimenZeriFourLedger/LedgerTruth 纪律):
// ①导出账:label/preset(基底=huangli 段单源自动跟随+择吉三段)/navKey 清单/启发式次序
// ②挂载账:mount 设置 kind + 名表 + scope 化快照槽(源码级)
// ③方案账:scheme 键注册表登记+独立导出格式头互导必拒
// ④事盘账:localcases 类型+别名;宿主存档链现状=随主技法(黄历模块本无事盘钮,显式登记待后续轮)
// ⑤对偶锁:SubTabRegistry ⇔ ZeriMain TabPane ⇔ help TabPane;快照段头 ⇔ preset 逐字成对。
import fs from 'fs';
import path from 'path';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';
import { ZERI_SUBTABS } from '../../../constants/SubTabRegistry';
import { CASE_TYPE_OPTIONS, getCaseTypeLabel } from '../../../utils/localcases';
import { buildHuangliZeriSnapshotExtra } from '../huangliZeriSnapshot';
import { huangliZeriSchemeStore, qimenZeriSchemeStore } from '../schemeStore';
import { newHuangliLeaf } from '../huangliZeriConditionTypes';

const SRC = path.join(__dirname, '..', '..', '..');
const read = (p)=>fs.readFileSync(path.join(SRC, p), 'utf8');

describe('[Z1] 四本账登记', ()=>{
	it('🔴 ①导出账:preset=huangli 段单源+择吉三段;label 表;启发式「黄历择日」先于裸「择日」', ()=>{
		const hl = AI_EXPORT_PRESET_SECTIONS.huangli;
		const hz = AI_EXPORT_PRESET_SECTIONS.huanglizeri;
		expect(Array.isArray(hz)).toBe(true);
		expect(hz).toEqual([...hl, '择吉搜索配置', '择吉条件', '命中日段']);	// 基底自动跟随(huangli 段表改=此处自动变)
		const ae = read('utils/aiExport.js');
		expect(ae).toContain("{ key: 'huanglizeri', label: '黄历择日' }");
		const iHl = ae.indexOf("topInfo.includes('黄历择日')");
		const iBare = ae.indexOf("topInfo.includes('择日') && !hasPrimarySpecific");
		expect(iHl).toBeGreaterThan(0);
		expect(iHl).toBeLessThan(iBare);	// 次序锚:专属分支先于裸子串
		expect(ae).toContain("subTab === 'huanglizeri'");
	});

	it('②挂载账:mount 设置 sectionsOnly+名表+宿主 scope 化快照槽', ()=>{
		const tms = read('utils/techniqueMountSettings.js');
		expect(tms).toContain("huanglizeri: { kind: 'sectionsOnly'");
		expect(read('utils/aiAnalysisContext.js')).toContain("huanglizeri: '黄历择日'");
		const main = read('components/zeri/HuangliZeriMain.js');
		expect(main).toContain('techniqueScope="huanglizeri"');
		const hlm = read('components/calendar/HuangLiMain.js');
		expect(hlm).toContain('this.props.techniqueScope || MODULE');	// scope 槽(双实例竞写防御)
	});

	it('③方案账:存储键注册+独立格式头互导必拒', ()=>{
		expect(read('utils/storageKeyRegistry.js')).toContain('horosa.zeri.huangli.schemes.v1');
		const r = huangliZeriSchemeStore.importSchemes(qimenZeriSchemeStore.exportSchemes());
		expect(r.ok).toBe(false);	// 奇门方案导入黄历必拒
	});

	it('④事盘账:localcases 类型+简繁别名;宿主存档链现状显式登记(黄历模块本无事盘钮,待后续轮)', ()=>{
		expect(CASE_TYPE_OPTIONS.some((t)=>t.value === 'huanglizeri')).toBe(true);
		expect(getCaseTypeLabel('黄历择日')).toBe('黄历择日');	// 简体别名归一后取到正名
		expect(getCaseTypeLabel('黃曆擇日')).toBe('黄历择日');	// 繁体别名同
		expect(getCaseTypeLabel('huanglizeri')).toBe('黄历择日');
	});

	it('🔴 ⑤对偶锁:SubTabRegistry⇔ZeriMain TabPane⇔help TabPane 三处成对', ()=>{
		expect(ZERI_SUBTABS).toContain('huanglizeri');
		expect(read('components/zeri/ZeriMain.js')).toContain('key="huanglizeri"');
		expect(read('components/help/ZeriHelpDoc.js')).toContain('key="huanglizeri"');
	});
});

describe('[Z1] 快照段头真值(builder↔preset 逐字成对)', ()=>{
	it('🔴 builder 三段头与 preset 追加三段逐字相同(活体对拍)', ()=>{
		const tree = { kind: 'group', joiner: 'all', children: [newHuangliLeaf('jianchu')] };
		const txt = buildHuangliZeriSnapshotExtra({
			cfg: { startDate: '2026-01-01', endDate: '2026-01-31' },
			tree,
			results: [{ start: '2026-01-05', end: '2026-01-05', days: 1, badge: '成日·井宿·黄道' }],
			truncated: false,
		});
		const preset = AI_EXPORT_PRESET_SECTIONS.huanglizeri;
		const extraSecs = preset.slice(-3);
		extraSecs.forEach((sec)=>{
			expect(txt).toContain(`[${sec}]`);
		});
		// 段序与 preset 序一致
		const idx = extraSecs.map((sec)=>txt.indexOf(`[${sec}]`));
		expect(idx[0]).toBeLessThan(idx[1]);
		expect(idx[1]).toBeLessThan(idx[2]);
		expect(txt).toContain('2026-01-05');
		expect(txt).toContain('成日·井宿·黄道');
	});

	it('技法清单/迁移键清单登记(内容勾选面板可达;源码级——AI_EXPORT_TECHNIQUES 未导出)', ()=>{
		const ae = fs.readFileSync(path.join(SRC, 'utils/aiExport.js'), 'utf8');
		const techList = ae.slice(ae.indexOf('const AI_EXPORT_TECHNIQUES'), ae.indexOf('export const AI_EXPORT_PRESET_SECTIONS'));
		expect(techList).toContain("{ key: 'huanglizeri', label: '黄历择日' }");
		const mig = ae.slice(ae.indexOf('AI_EXPORT_SECTION_MIGRATION_KEYS'), ae.indexOf('AI_EXPORT_PLANET_INFO_DEFAULT'));
		expect((mig.match(/'huanglizeri',/g) || []).length).toBeGreaterThanOrEqual(1);	// 迁移键登记(与 qimenzeri 同构)
	});
});
