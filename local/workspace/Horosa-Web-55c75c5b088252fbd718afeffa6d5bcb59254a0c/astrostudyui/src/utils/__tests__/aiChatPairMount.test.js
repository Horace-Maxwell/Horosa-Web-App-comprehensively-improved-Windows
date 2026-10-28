// 双盘挂载(合盘):对话里同时挂本人 + 对方两张命盘。
// 单盘输出逐字节不变;双盘时两人的案例前提 / 各技法分开标注、同一技法挨着排、按技法层公平分摊预算;
// 两张盘的整份快照(未挂技法时)按水位分摊;@ 第二张命盘挂为对方;检查点随之回退;/合盘 的西洋合盘数据只在该附时附。
import { buildContextLayers, clipContextLayersDetailed, pairDisplayName, getPairSynastryText, __resetPairSynastryCacheForTests, PAIR_SYNASTRY_MAX_CHARS } from '../aiAnalysisContext';
import { parseMentions, resolveMentions } from '../aiChat/mentions';
import { buildCheckpoint, applyCheckpoint, CHECKPOINT_FIELDS } from '../aiChat/checkpoint';
import { shouldAttachWesternSynastry, BUILTIN_SKILLS } from '../aiChat/skills';
import { requirementState, BUILTIN_COMMANDS } from '../aiChat/commands';

const selfCtx = { title: '张三', content: '[起盘信息]\n张三 1990-05-18 10:00 +08:00', after23NewDay: 1, lateZiHourUseNextDay: 1 };
const otherCtx = { title: '李四', content: '[起盘信息]\n李四 1992-03-07 08:30 +08:00', after23NewDay: 1, lateZiHourUseNextDay: 1 };
const selfTechs = [
	{ key: 'ziwei', title: '紫微斗数', content: '[宫位总览]\n张三命宫 紫微天府' },
	{ key: 'bazi', title: '八字', content: '[四柱]\n庚午 辛巳 癸未 丁巳' },
];
const otherTechs = [
	{ key: 'ziwei', title: '紫微斗数', content: '[宫位总览]\n李四命宫 天机太阴' },
	{ key: 'bazi', title: '八字', content: '[四柱]\n壬申 癸卯 甲子 戊辰' },
];
const base = { sourceContext: selfCtx, techniqueContexts: selfTechs, systemPrompt: '系统', materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [] };

describe('buildContextLayers 双盘挂载', ()=>{
	test('不给对方 / 对方为空 → 与此前单盘逐字节相同', ()=>{
		const single = buildContextLayers(base);
		expect(buildContextLayers({ ...base, partner: null })).toEqual(single);
		expect(buildContextLayers({ ...base, partner: { title: '李四', sourceContext: { content: '' }, techniqueContexts: [{ key: 'ziwei', content: '' }] } })).toEqual(single);
		expect(single.map((l)=>l.key)).toEqual(['system', 'source', 'dayBoundaryRule', 'technique:ziwei', 'technique:bazi']);
		expect(single.find((l)=>l.key === 'source').title).toBe('案例前提：张三');
		expect(single.find((l)=>l.key === 'technique:ziwei').title).toBe('使用技法：紫微斗数');
	});

	test('双盘:两人各一层案例前提、每技法两层并注明归属,同一技法挨着排', ()=>{
		const layers = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: otherTechs } });
		const byKey = Object.fromEntries(layers.map((l)=>[l.key, l]));
		expect(byKey['pair-rule'].content).toContain('本人「张三」与对方「李四」');
		expect(byKey.source.title).toBe('案例前提（本人）：张三');
		expect(byKey['partner-source'].title).toBe('案例前提（对方）：李四');
		expect(byKey['technique:ziwei'].title).toBe('使用技法：紫微斗数（本人·张三）');
		expect(byKey['technique:ziwei@partner'].title).toBe('使用技法：紫微斗数（对方·李四）');
		expect(byKey['technique:ziwei@partner'].content).toContain('李四命宫');
		const order = layers.slice(0).sort((a, b)=>b.priority - a.priority).map((l)=>l.key);
		expect(order).toEqual(['system', 'pair-rule', 'source', 'partner-source', 'dayBoundaryRule', 'technique:ziwei', 'technique:ziwei@partner', 'technique:bazi', 'technique:bazi@partner']);
	});

	test('对方的日界 / 晚子时口径不同才补一行', ()=>{
		const same = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: otherTechs } });
		expect(same.find((l)=>l.key === 'dayBoundaryRule').content).not.toContain('对方');
		const diff = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: { ...otherCtx, after23NewDay: 0 }, techniqueContexts: otherTechs } });
		expect(diff.find((l)=>l.key === 'dayBoundaryRule').content).toContain('对方「李四」的盘按另一套口径');
	});

	test('人名回落:没名字用「本人 / 对方」', ()=>{
		expect(pairDisplayName('  ', '对方')).toBe('对方');
		expect(pairDisplayName(' 李 四 ', '对方')).toBe('李 四');
	});
});

describe('西洋合盘数据进会话层(pair:synastry)', ()=>{
	const syn = '[比较盘]\n张三日 合 李四月\n[组合盘]\n日月三合';
	test('给了 synastry 才出层:标题写两人、紧跟两份案例前提之后;说明层提一句;不给 = 与此前双盘逐字节相同', ()=>{
		const without = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: otherTechs } });
		const withSyn = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: otherTechs, synastry: syn } });
		expect(without.some((l)=>l.key === 'pair:synastry')).toBe(false);
		expect(without.find((l)=>l.key === 'pair-rule').content).not.toContain('合盘数据');
		const layer = withSyn.find((l)=>l.key === 'pair:synastry');
		expect(layer.title).toBe('合盘数据（西洋比较盘 / 组合盘 / 影响盘）：张三 × 李四');
		expect(layer.content).toBe(syn);
		expect(withSyn.find((l)=>l.key === 'pair-rule').content).toContain('西洋合盘数据');
		const order = withSyn.slice(0).sort((a, b)=>b.priority - a.priority).map((l)=>l.key);
		expect(order.indexOf('pair:synastry')).toBe(order.indexOf('dayBoundaryRule') + 1);
		expect(order.indexOf('pair:synastry')).toBeLessThan(order.indexOf('technique:ziwei'));
		const huge = buildContextLayers({ ...base, partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: otherTechs, synastry: `[段]\n${'乙'.repeat(PAIR_SYNASTRY_MAX_CHARS + 500)}` } });
		expect(huge.find((l)=>l.key === 'pair:synastry').content.length).toBeLessThanOrEqual(PAIR_SYNASTRY_MAX_CHARS);
	});
	const long = (tag, n)=>Array.from({ length: n }).map((_, i)=>`[段${i}]\n${tag}${'甲'.repeat(300)}`).join('\n');
	test('裁剪:挂了技法 = 与技法层一起按水位裁;没挂技法 = 与两份整份快照一起分摊(不会被快照吃光)', ()=>{
		const withTech = buildContextLayers({
			...base,
			techniqueContexts: [{ key: 'ziwei', title: '紫微斗数', content: long('张三', 20) }],
			partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: [{ key: 'ziwei', title: '紫微斗数', content: long('李四', 20) }], synastry: long('合盘', 20) },
		});
		const r1 = clipContextLayersDetailed(withTech, { maxChars: 7000, fairShare: true });
		const k1 = Object.fromEntries(r1.kept.map((l)=>[l.key, l]));
		expect(k1['pair:synastry'] && k1['technique:ziwei'] && k1['technique:ziwei@partner']).toBeTruthy();
		expect(Math.abs(k1['pair:synastry'].content.length - k1['technique:ziwei'].content.length)).toBeLessThan(400);
		const noTech = buildContextLayers({
			...base,
			sourceContext: { ...selfCtx, content: long('张三', 30) },
			techniqueContexts: [],
			partner: { title: '李四', sourceContext: { ...otherCtx, content: long('李四', 30) }, techniqueContexts: [], synastry: long('合盘', 30) },
		});
		const r2 = clipContextLayersDetailed(noTech, { maxChars: 9000, fairShare: true });
		const k2 = Object.fromEntries(r2.kept.map((l)=>[l.key, l]));
		expect(k2['pair:synastry'] && k2.source && k2['partner-source']).toBeTruthy();
		expect(Math.abs(k2['pair:synastry'].content.length - k2.source.content.length)).toBeLessThan(400);
		expect(r2.stats.totalKept).toBeLessThanOrEqual(9000);
		// 单盘不受影响:没有 pair: 层时与此前同一套分组
		const single = clipContextLayersDetailed(buildContextLayers({ ...base, techniqueContexts: [{ key: 'ziwei', title: '紫微斗数', content: long('张三', 20) }] }), { maxChars: 3000, fairShare: true });
		expect(single.kept.some((l)=>l.key.indexOf('pair:') === 0)).toBe(false);
	});
	test('按「这一对」缓存:同一对只算一次;并发两次合成一次;换人重算;空结果不缓存', async ()=>{
		__resetPairSynastryCacheForTests();
		const a = { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		const b = { birth: '1992-03-07 08:30:00', zone: '+08:00', lat: '39n54', lon: '116e23' };
		const c = { ...b, birth: '1993-01-01 00:00:00' };
		const build = jest.fn(async (x, y)=>`合盘:${x.birth}×${y.birth}`);
		const [t1, t2] = await Promise.all([getPairSynastryText(a, b, { build }), getPairSynastryText(a, b, { build })]);
		expect(t1).toBe(t2); expect(build).toHaveBeenCalledTimes(1);
		await getPairSynastryText(a, b, { build });
		expect(build).toHaveBeenCalledTimes(1);
		await getPairSynastryText(a, c, { build });
		expect(build).toHaveBeenCalledTimes(2);
		const empty = jest.fn(async ()=>'');
		await getPairSynastryText(b, c, { build: empty });
		await getPairSynastryText(b, c, { build: empty });
		expect(empty).toHaveBeenCalledTimes(2);
		expect(await getPairSynastryText(null, b, { build })).toBe('');
	});
});

describe('裁剪:双盘按技法层与整份快照公平分摊', ()=>{
	const long = (tag, n)=>Array.from({ length: n }).map((_, i)=>`[段${i}]\n${tag}${'甲'.repeat(300)}`).join('\n');
	test('对方技法层算技法层:预算紧时两人一起按水位裁,不会只丢对方', ()=>{
		const layers = buildContextLayers({
			...base,
			techniqueContexts: [{ key: 'ziwei', title: '紫微斗数', content: long('张三', 20) }],
			partner: { title: '李四', sourceContext: otherCtx, techniqueContexts: [{ key: 'ziwei', title: '紫微斗数', content: long('李四', 20) }] },
		});
		const r = clipContextLayersDetailed(layers, { maxChars: 6000, fairShare: true });
		const self = r.kept.find((l)=>l.key === 'technique:ziwei');
		const other = r.kept.find((l)=>l.key === 'technique:ziwei@partner');
		expect(self && other).toBeTruthy();
		expect(Math.abs(self.content.length - other.content.length)).toBeLessThan(400);
		expect(r.dropped.map((l)=>l.key)).toEqual([]);
	});

	test('未挂技法(两份整份快照):两人按水位分摊,排盘规则仍保留', ()=>{
		const layers = buildContextLayers({
			...base,
			sourceContext: { ...selfCtx, content: long('张三', 30) },
			techniqueContexts: [],
			partner: { title: '李四', sourceContext: { ...otherCtx, content: long('李四', 30) }, techniqueContexts: [] },
		});
		const r = clipContextLayersDetailed(layers, { maxChars: 8000, fairShare: true });
		const self = r.kept.find((l)=>l.key === 'source');
		const other = r.kept.find((l)=>l.key === 'partner-source');
		expect(self.clipped && other.clipped).toBe(true);
		expect(Math.abs(self.content.length - other.content.length)).toBeLessThan(400);
		expect(r.kept.some((l)=>l.key === 'dayBoundaryRule')).toBe(true);
		expect(r.stats.totalKept).toBeLessThanOrEqual(8000);
	});
});

describe('@ 第二张命盘 = 合盘对方', ()=>{
	const sources = [
		{ id: 'local-a', sourceType: 'chart', title: '张三', record: {} },
		{ id: 'local-b', sourceType: 'chart', title: '李四', record: {} },
		{ id: 'local-c', sourceType: 'chart', title: '王五', record: {} },
		{ id: 'local-d', sourceType: 'case', title: '搬家事盘', record: {} },
	];
	test('两张命盘:第一张本人、第二张对方;第三张不挂;事盘不当对方', ()=>{
		const p1 = resolveMentions(parseMentions('@[命盘:张三] @[命盘:李四] 合不合').mentions, { sources });
		expect(p1.selectSource.id).toBe('local-a');
		expect(p1.partnerSource.id).toBe('local-b');
		const p2 = resolveMentions(parseMentions('@[命盘:张三] @[命盘:李四] @[命盘:王五]').mentions, { sources });
		expect(p2.partnerSource.id).toBe('local-b');
		expect(p2.hints.some((h)=>h.indexOf('最多同时挂两张命盘') >= 0)).toBe(true);
		const p3 = resolveMentions(parseMentions('@[事盘:搬家事盘] @[命盘:李四]').mentions, { sources });
		expect(p3.partnerSource).toBe(null);
		expect(p3.hints.some((h)=>h.indexOf('合盘对方只能是另一张命盘') >= 0)).toBe(true);
		const p4 = resolveMentions(parseMentions('@[命盘:张三] @[命盘:张三]').mentions, { sources });
		expect(p4.partnerSource).toBe(null);
	});
});

describe('检查点 / 命令 / 西洋合盘数据', ()=>{
	test('检查点带合盘对方并能回退;早于本功能的检查点不动当前对方', ()=>{
		expect(CHECKPOINT_FIELDS).toContain('partnerSourceId');
		const cp = buildCheckpoint({ selectedSourceId: 'local-a', partnerSourceId: 'local-b' });
		expect(cp.partnerSourceId).toBe('local-b');
		const setPartnerSourceId = jest.fn();
		applyCheckpoint(cp, { setPartnerSourceId });
		expect(setPartnerSourceId).toHaveBeenCalledWith('local-b');
		const legacy = { ...cp };
		delete legacy.partnerSourceId;
		const set2 = jest.fn();
		applyCheckpoint(legacy, { setPartnerSourceId: set2 });
		expect(set2).not.toHaveBeenCalled();
		const set3 = jest.fn();
		applyCheckpoint(buildCheckpoint({ selectedSourceId: 'local-a' }), { setPartnerSourceId: set3 });
		expect(set3).toHaveBeenCalledWith('');
	});

	test('/合盘:已挂对方时不写名字也行;没挂对方仍要名字', ()=>{
		const chart = { id: 'local-a', sourceType: 'chart', title: '张三' };
		expect(requirementState('two-charts', { activeSource: chart, argsText: '', partnerSource: { id: 'local-b' } }).ok).toBe(true);
		const st = requirementState('two-charts', { activeSource: chart, argsText: '' });
		expect(st.ok).toBe(false);
		expect(st.why).toContain('合盘对方');
		expect(BUILTIN_COMMANDS.find((c)=>c.name === '合盘').help).toContain('对方盘按所选技法一并挂载');
	});

	test('西洋合盘数据:没勾技法或勾了西洋本命类才附;只看紫微 / 八字不附', ()=>{
		expect(shouldAttachWesternSynastry([])).toBe(true);
		expect(shouldAttachWesternSynastry(undefined)).toBe(true);
		expect(shouldAttachWesternSynastry(['ziwei', 'bazi'])).toBe(false);
		expect(shouldAttachWesternSynastry(['ziwei', 'astrochart'])).toBe(true);
		expect(shouldAttachWesternSynastry(['hellenastro'])).toBe(true);
		const hepan = BUILTIN_SKILLS.find((b)=>b.id === 'builtin:hepan');
		expect(hepan.skill.promptTemplate).toContain('本人「{{source}}」、对方「{{other}}」');
	});
});
