// 一掌经 report：从 bazi(nongli) 解析入参 → 模型 → 快照。用手造 bazi mock（不拉全农历引擎），
// 对齐引擎 golden 案例3（巳年五月十七酉时·男），验农历解析(正月初一年支/monthNum/dayNum)＋断语拼接。
import { resolveLunarInput, buildYizhangjingModel, buildYizhangjingSnapshotText } from '../yizhangjingReport';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

// 案例3 mock：丁巳年(蛇) 农历五月十七 己酉时 男
const baziCase3 = {
	gender: 'Male',
	nongli: { yearGZByLunar: '丁巳', shengXiaoLunar: '蛇', monthNum: 5, dayNum: 17, leap: false },
	fourColumns: { time: { ganzi: '己酉' }, month: { ganzi: '丙午' }, day: { ganzi: '戊申' }, year: { ganzi: '丁巳' } },
};
const OPTS = { shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao' };

describe('一掌经 report · 农历解析（正月初一口径）', () => {
	it('从 yearGZByLunar 取年支、monthNum/dayNum 取月日、time.ganzi 取时支', () => {
		const inp = resolveLunarInput(baziCase3, OPTS);
		expect(inp).toBeTruthy();
		expect(inp.yearBranch).toBe('巳');
		expect(inp.month).toBe(5);
		expect(inp.day).toBe(17);
		expect(inp.hourBranch).toBe('酉');
		expect(inp.gender).toBe('男');
	});
	it('shengXiaoLunar 回退：无 yearGZByLunar 时用生肖映射年支', () => {
		const b = { ...baziCase3, nongli: { ...baziCase3.nongli, yearGZByLunar: '' } };
		const inp = resolveLunarInput(b, OPTS);
		expect(inp.yearBranch).toBe('巳'); // 蛇→巳
	});
	it('闰月·十五后作下月', () => {
		const b = { ...baziCase3, nongli: { ...baziCase3.nongli, leap: true, dayNum: 20 } };
		const inp = resolveLunarInput(b, OPTS);
		expect(inp.month).toBe(6);
		expect(inp.monthNote).toMatch(/下月/);
	});
});

describe('一掌经 report · 模型与快照', () => {
	it('模型四柱与命宫对齐引擎 golden（文·厄·刃·贵 / 命福）', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		expect(m).toBeTruthy();
		expect(m.chart.pillars.map((p) => p.star)).toEqual(['天文', '天厄', '天刃', '天貴']);
		expect(m.chart.mingStar).toBe('天福');
	});
	it('逐柱断语已拼接（非空）', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		expect(m.pillars[0].text.length).toBeGreaterThan(0);
		expect(m.pillars[3].xiangyi.length).toBeGreaterThan(0);
		expect(m.zhiye.length).toBeGreaterThan(0);
		expect(m.liunianZong.length).toBeGreaterThan(0);
	});
	it('大限含 运×时 断语', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		expect(m.dayun).toHaveLength(10);
		expect(m.dayun.some((d) => d.yunshi.length > 0)).toBe(true);
	});
	it('快照文本含各段标题且非空', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		const t = buildYizhangjingSnapshotText(m);
		expect(t).toMatch(/起盘信息/);
		expect(t).toMatch(/四柱四宫/);
		expect(t).toMatch(/命宫与人事十二宫/);
		expect(t).toMatch(/格局判定/);
		expect(t).toMatch(/大限/);
		expect(t.length).toBeGreaterThan(200);
	});
	it('重犯口诀组切换影响 chosen 标记', () => {
		// 造重犯：年月同星 → 庚子年正月初九酉时男两贵重犯
		const b = {
			gender: 'Male',
			nongli: { yearGZByLunar: '庚子', shengXiaoLunar: '鼠', monthNum: 1, dayNum: 9, leap: false },
			fourColumns: { time: { ganzi: '乙酉' } },
		};
		const a = buildYizhangjingModel(b, { shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao', chongfanKou: 'alpha' });
		const bb = buildYizhangjingModel(b, { shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao', chongfanKou: 'beta' });
		expect(a.repeats.length).toBeGreaterThan(0);
		expect(a.repeats[0].chosen).toBe('alpha');
		expect(bb.repeats[0].chosen).toBe('beta');
	});
	it('定月法=节气月：lunarMonth 保留真实农历月，快照标注排作月（生辰不被折算改写）', () => {
		// 农历五月廿六(monthNum=5) 但月支=未 → 节气6月，两者不同
		const b = {
			gender: 'Male',
			nongli: { yearGZByLunar: '丙午', shengXiaoLunar: '马', monthNum: 5, dayNum: 26, leap: false },
			fourColumns: { time: { ganzi: '癸巳' }, month: { ganzi: '乙未' } },
		};
		const inp = resolveLunarInput(b, { dingYue: 'jieqi' });
		expect(inp.lunarMonth).toBe(5); // 真实农历月序不变
		expect(inp.month).toBe(6); // 排盘取节气月
		const t = buildYizhangjingSnapshotText(buildYizhangjingModel(b, { dingYue: 'jieqi' }));
		expect(t).toMatch(/农历5月26日/); // 显示真实农历生辰
		expect(t).toMatch(/排作6月/); // 标注排盘实际取月
		// 农历月模式：无排作标注
		const t2 = buildYizhangjingSnapshotText(buildYizhangjingModel(b, {}));
		expect(t2).toMatch(/农历5月26日/);
		expect(t2).not.toMatch(/排作/);
	});
	// 防漂移：快照每个段头【X】必须逐字命中导出预设段名，否则 AI导出设置 会出现重复项/开关跨段误删。
	it('快照段头【X】全部落在导出预设段名内（防设置面板重复/开关失效）', () => {
		const preset = AI_EXPORT_PRESET_SECTIONS.yizhangjing;
		// 造含重犯的盘以覆盖「重犯」条件段：庚子年正月初九酉时男 两贵重犯
		const repeatBazi = {
			gender: 'Male',
			nongli: { yearGZByLunar: '庚子', shengXiaoLunar: '鼠', monthNum: 1, dayNum: 9, leap: false },
			fourColumns: { time: { ganzi: '乙酉' } },
		};
		[
			buildYizhangjingModel(baziCase3, OPTS),
			buildYizhangjingModel(repeatBazi, { shunniRule: 'menShunNvNi' }),
			buildYizhangjingModel(baziCase3, { ...OPTS, shenshaLayer: true }), // 覆盖【神煞合参】条件段
		].forEach((m) => {
			const snap = buildYizhangjingSnapshotText(m);
			const headers = [...snap.matchAll(/【([^】]+)】/g)].map((x) => x[1]);
			headers.forEach((h) => expect(preset).toContain(h));
		});
		// 恒有段必须在预设内（起盘/四柱/命宫人事/格局/大限/小限流年）
		['起盘信息', '四柱四宫断语', '命宫与人事十二宫', '格局判定', '大限', '小限与流年十二神'].forEach((s) => {
			expect(preset).toContain(s);
		});
	});
});

// 神煞合参层：按盘计算落宫（不再是 21×12 静态表全量罗列），只显本盘落宫断语。
describe('一掌经 report · 神煞合参层（按盘计算落宫）', () => {
	it('locateShensha 由生年支／日干／月支／日柱旬定位（案例3 巳年·戊申日·丙午月·男）', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		const hits = m.shenshaHits;
		expect(Array.isArray(hits)).toBe(true);
		expect(hits.length).toBeGreaterThan(0);
		const brOf = (name) => hits.filter((h) => h.name === name).map((h) => h.branch).sort();
		// 年支类（巳年）
		expect(brOf('咸池')).toEqual(['午']);        // 巳酉丑三合桃花在午
		expect(brOf('驛馬')).toEqual(['亥']);        // 巳酉丑驿马在亥
		expect(brOf('紅鸞')).toEqual(['戌']);        // 巳年红鸾在戌
		expect(brOf('天喜')).toEqual(['辰']);        // 红鸾对冲
		expect(brOf('大耗')).toEqual(['亥']);        // 岁破 巳+6
		expect(brOf('喪門')).toEqual(['未']);        // 巳+2
		expect(brOf('白虎')).toEqual(['丑']);        // 巳+8
		expect(brOf('孤辰寡宿')).toEqual(['申', '辰'].sort()); // 巳午未 孤申寡辰
		expect(brOf('的殺破碎')).toEqual(['酉']);    // 寅申巳亥→酉
		// 日干类（戊日）
		expect(brOf('祿勳')).toEqual(['巳']);        // 戊禄在巳
		expect(brOf('文昌')).toEqual(['申']);        // 戊文昌在申
		expect(brOf('天玉貴')).toEqual(['丑', '未'].sort()); // 戊贵在丑未
		expect(brOf('陽刃飛刃')).toContain('午');    // 戊阳刃在午（另含对冲飞刃子）
		expect(brOf('國印')).toEqual(['丑']);        // 戊国印在丑
		// 月支类（午月）血刃在卯；日柱旬空（戊申∈甲辰旬）空寅卯
		expect(brOf('血刃')).toEqual(['卯']);
		expect(brOf('空亡')).toEqual(['寅', '卯'].sort());
	});
	it('落宫映射人事宫且取到该宫断语——含旧静态表恒空的财帛(財)/迁移(遷)列', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		// 每条命中都应带非空断语（人事宫首字简体↔神煞表繁体键已归一）
		m.shenshaHits.forEach((h) => {
			expect(h.palace).toBeTruthy();
			expect(h.branch).toBeTruthy();
			expect(typeof h.text).toBe('string');
		});
		// 财帛(未坐 喪門/天玉貴)——旧代码用简体「财」查繁体「財」键恒空，此处必须取到断语
		const cai = m.shenshaHits.filter((h) => `${h.palace}`.charAt(0) === '财');
		expect(cai.length).toBeGreaterThan(0);
		cai.forEach((h) => expect(h.text.length).toBeGreaterThan(0));
	});
	it('shenshaLayer 开→快照含【神煞合参】段（且段头在预设内）；关→不入快照', () => {
		const on = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, { ...OPTS, shenshaLayer: true }));
		expect(on).toMatch(/【神煞合参】/);
		expect(AI_EXPORT_PRESET_SECTIONS.yizhangjing).toContain('神煞合参');
		const off = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, OPTS));
		expect(off).not.toMatch(/【神煞合参】/);
	});
	it('缺日柱/月柱时优雅降级（只出年支类神煞，不抛错）', () => {
		const bare = {
			gender: 'Male',
			nongli: { yearGZByLunar: '丁巳', shengXiaoLunar: '蛇', monthNum: 5, dayNum: 17, leap: false },
			fourColumns: { time: { ganzi: '己酉' } }, // 无 month/day 干支
		};
		const m = buildYizhangjingModel(bare, OPTS);
		expect(Array.isArray(m.shenshaHits)).toBe(true);
		// 年支类仍在
		expect(m.shenshaHits.some((h) => h.name === '咸池')).toBe(true);
		// 日干类应缺席（无日干）
		expect(m.shenshaHits.some((h) => h.name === '文昌')).toBe(false);
	});
});

// [Q-437/T-400] 页面「各柱逢星速断 / 六道分布 / 主星象义·星性」三卡进快照(模型早有派生字段,builder 补写)。
describe('一掌经 快照 · 各柱逢星速断 / 六道分布 / 主星象义与星性', () => {
	it('三段随模型产出,内容与模型字段逐项对应;段头已登记 preset 且紧随【位置速断】', () => {
		const m = buildYizhangjingModel(baziCase3, OPTS);
		const t = buildYizhangjingSnapshotText(m);
		expect(t).toContain('【六道分布】');
		expect(t).toContain('【主星象义与星性】');
		m.daoRows.forEach((d) => { expect(t).toContain(`${d.term || d.dao}×${d.count}：`); });
		m.pillars.forEach((p) => { if (p.xiangyi) expect(t).toContain(`${p.label}柱 ${p.star}：象义：${p.xiangyi}`); });
		if (m.pillarQuickHits.length) {
			expect(t).toContain('【各柱逢星速断】');
			m.pillarQuickHits.forEach((r) => { expect(t).toContain(`${r.pillar}柱（${r.stars.join('/')}）：${r.text}`); });
		}
		const heads = t.match(/^【[^】]+】$/gm).map((h) => h.slice(1, -1));
		const preset = AI_EXPORT_PRESET_SECTIONS.yizhangjing;
		heads.forEach((h) => { expect(preset).toContain(h); });
		expect(preset.indexOf('各柱逢星速断')).toBe(preset.indexOf('位置速断') + 1);
		expect(preset.indexOf('六道分布')).toBe(preset.indexOf('各柱逢星速断') + 1);
		expect(preset.indexOf('主星象义与星性')).toBe(preset.indexOf('六道分布') + 1);
	});
	it('六道术语档(饿鬼道系)改【六道分布】行文(显示层齿轮对正文生效)', () => {
		const a = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, { ...OPTS, daoTerm: 'gui' }));
		const b = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, { ...OPTS, daoTerm: 'edao' }));
		const secA = a.slice(a.indexOf('【六道分布】'), a.indexOf('【主星象义与星性】'));
		const secB = b.slice(b.indexOf('【六道分布】'), b.indexOf('【主星象义与星性】'));
		expect(secA).not.toBe(secB);
	});
});
