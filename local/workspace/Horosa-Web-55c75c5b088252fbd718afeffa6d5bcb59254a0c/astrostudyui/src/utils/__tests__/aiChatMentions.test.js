// @引用(A4)合同:@查询定位(行首/空白后才算;邮箱 a@b 与全角 ＠ 不算;查询到光标且无空白)· 候选池(命盘/事盘同名标尾号、资料、组合、模板、技法、已选技法的段)与前缀优先过滤 ·
// 光标插入标记 · 解析标记并换回名字 · 挂载计划(首命盘切源,第二命盘只提示走 /合盘,同名歧义取最近并提示,资料/组合/模板进 referenceIds,技法/技法段进 techniqueKeys+sectionFilter,未找到进 unresolved)· 技法段过滤复用导出段切分。
import { findMentionQuery, buildMentionCandidates, filterMentionCandidatesDetailed, insertMentionAtCaret, parseMentions, resolveMentions, candidateToken, techniqueHeadMatch, MENTION_GROUP_QUOTA, escapeMentionName } from '../aiChat/mentions';
// 数组视图(生产只用带明细的版本;测试里的短写)
const filterMentionCandidates = (items, query, limits)=>filterMentionCandidatesDetailed(items, query, limits).items;
import { filterContentSections } from '../aiChat/sectionFilter';

const sources = [
	{ id: 'local-aaaa1111', sourceType: 'chart', title: '张三', record: { updatedAt: '2026-09-01T00:00:00Z' } },
	{ id: 'local-bbbb2222', sourceType: 'chart', title: '张三', record: { updatedAt: '2026-09-05T00:00:00Z' } },
	{ id: 'local-cccc3333', sourceType: 'chart', title: '李四', record: {} },
	{ id: 'local-dddd4444', sourceType: 'case', title: '搬家事盘', record: {} },
];
const materials = [{ id: 'm1', name: '名单.txt' }, { id: 'm2', fileName: '笔记.md' }];
const bundles = [{ id: 'b1', name: '事业组合', skill: { triggers: ['事业'] } }];
const templates = [{ id: 't1', name: '简报模板' }];
const techniqueOptions = [{ value: 'bazi', label: '八字' }, { value: 'ziwei', label: '紫微斗数' }];

describe('findMentionQuery', ()=>{
	it('🔴 行首/空白后的 @ 才算;邮箱与全角不算;查询含空白或已闭合不算;光标在 @ 前不算', ()=>{
		expect(findMentionQuery('@张', 2)).toEqual({ start: 0, query: '张' });
		expect(findMentionQuery('看看 @李四', 6)).toEqual({ start: 3, query: '李四' });
		expect(findMentionQuery('mail a@b.com', 9)).toBe(null);
		expect(findMentionQuery('＠张三', 3)).toBe(null);
		expect(findMentionQuery('@张三 今年', 6)).toBe(null);
		expect(findMentionQuery('@[命盘:张三] 今', 9)).toBe(null);
		expect(findMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
		expect(findMentionQuery('@张三', 0)).toBe(null);
	});
});

describe('候选/过滤/插入', ()=>{
	it('同名命盘带 #尾号;事盘归类事盘;资料取 name 或 fileName;技法段只出已选技法;前缀命中排前;数字上限=旧语义', ()=>{
		const pool = buildMentionCandidates({ sources, materials, bundles, templates, techniqueOptions, selectedTechniqueKeys: ['bazi'], sectionsForTechnique: (k)=>(k === 'bazi' ? ['四柱', '大运'] : []) });
		const zs = pool.filter((x)=>x.name === '张三');
		expect(zs.map((x)=>x.suffix)).toEqual(['1111', '2222']);
		expect(zs[0].label).toBe('张三 #1111');
		expect(pool.find((x)=>x.name === '李四').suffix).toBe('');
		expect(pool.find((x)=>x.name === '搬家事盘').type).toBe('case');
		expect(pool.filter((x)=>x.kind === 'material').map((x)=>x.name)).toEqual(['名单.txt', '笔记.md']);
		expect(pool.find((x)=>x.kind === 'bundle').label).toBe('事业组合(技能)');
		expect(pool.filter((x)=>x.kind === 'section').map((x)=>x.name)).toEqual(['八字/四柱', '八字/大运']);
		expect(filterMentionCandidates(pool, '张').map((x)=>x.label)).toEqual(['张三 #1111', '张三 #2222']);
		expect(filterMentionCandidates(pool, '八字/大').map((x)=>x.name)).toEqual(['八字/大运']);
		expect(filterMentionCandidates(pool, '', 12).length).toBe(12);
		// 空关键字缺省按组配额(不再全局截 12:此前命盘/资料排前,技法只剩 ≈9 个坑位)
		expect(filterMentionCandidates(pool, '').length).toBe(pool.length);
		expect(candidateToken(zs[1])).toBe('@[命盘:张三#2222]');
		expect(candidateToken(pool.find((x)=>x.kind === 'section'))).toBe('@[技法段:八字/四柱]');
		expect(insertMentionAtCaret('看看 @李 今年', 3, 5, '@[命盘:李四]')).toEqual({ text: '看看 @[命盘:李四]  今年', caret: 3 + '@[命盘:李四] '.length });
	});
	it('🔴 组配额:空关键字每组最多 quota 条且 hiddenCount 记账;有关键字全局上限;技法英文键子串命中;extraText(拼音)命中且首字母前缀排在包含之前', ()=>{
		const many = [];
		for(let i = 0; i < 20; i++){ many.push({ id: `local-${i}`, sourceType: 'chart', title: `盘${i}`, record: {} }); }
		const techs = [{ value: 'qimen', label: '奇门遁甲' }, { value: 'liureng', label: '大六壬' }, { value: 'bazi', label: '八字' }, { value: 'xiaoliuren', label: '小六壬' }];
		const pool = buildMentionCandidates({ sources: many, techniqueOptions: techs });
		const d = filterMentionCandidatesDetailed(pool, '');
		expect(d.items.filter((x)=>x.group === '命盘').length).toBe(MENTION_GROUP_QUOTA['命盘']);
		expect(d.items.filter((x)=>x.group === '技法').length).toBe(4);
		expect(d.hiddenCount).toBe(20 - MENTION_GROUP_QUOTA['命盘']);
		expect(d.total).toBe(24);
		// [2026-09-12] 技法一条不截:90 个技法空关键字全列(配额表只管命盘/资料等可能几百条的组)
		const big = []; for(let i = 0; i < 90; i++){ big.push({ value: `t${i}`, label: `技法${i}` }); }
		const bigPool = buildMentionCandidates({ sources: many, techniqueOptions: big, techniqueGroupOf: (k)=>(Number(k.slice(1)) % 2 ? '中式命理' : '西方占星') });
		const bd = filterMentionCandidatesDetailed(bigPool, '');
		expect(bd.items.filter((x)=>x.kind === 'technique').length).toBe(90);
		expect(bd.items.filter((x)=>x.group === '技法 · 西方占星').length).toBe(45);
		expect(bd.hiddenCount).toBe(20 - MENTION_GROUP_QUOTA['命盘']);
		expect(MENTION_GROUP_QUOTA['技法']).toBeUndefined();
		expect(filterMentionCandidatesDetailed(pool, '', { quota: { 命盘: 2 } }).items.filter((x)=>x.group === '命盘').length).toBe(2);
		expect(filterMentionCandidates(pool, 'qimen').map((x)=>x.key)).toEqual(['qimen']);
		expect(filterMentionCandidates(pool, 'liuren').map((x)=>x.key)).toEqual(['liureng', 'xiaoliuren']);
		const py = { qimen: 'qimendunjia qmdj', liureng: 'daliuren dlr', bazi: 'bazi bz', xiaoliuren: 'xiaoliuren xlr' };
		const extra = (it)=>(it.kind === 'technique' ? py[it.key] : '');
		expect(filterMentionCandidates(pool, 'qm', { extraText: extra }).map((x)=>x.key)).toEqual(['qimen']);
		expect(filterMentionCandidates(pool, 'lr', { extraText: extra }).map((x)=>x.key)).toEqual(['liureng', 'xiaoliuren']);
		expect(filterMentionCandidates(pool, 'bz', { extraText: extra }).map((x)=>x.key)).toEqual(['bazi']);
		expect(filterMentionCandidates(pool, '盘1', { limit: 3 }).length).toBe(3);
	});
	it('🔴 [2026-09-12] 技法段:已选技法 + sectionTechniqueKeys 点名技法的段都列(`@八字/` 不必先勾选);同键不重复', ()=>{
		const techs = [{ value: 'bazi', label: '八字' }, { value: 'ziwei', label: '紫微斗数' }];
		const secs = (k)=>(k === 'bazi' ? ['四柱', '大运'] : (k === 'ziwei' ? ['命宫'] : []));
		const pool = buildMentionCandidates({ techniqueOptions: techs, selectedTechniqueKeys: ['ziwei'], sectionTechniqueKeys: ['bazi', 'ziwei'], sectionsForTechnique: secs });
		expect(pool.filter((x)=>x.kind === 'section').map((x)=>x.name)).toEqual(['紫微斗数/命宫', '八字/四柱', '八字/大运']);
		expect(filterMentionCandidates(pool, '八字/').map((x)=>x.name)).toEqual(['八字/四柱', '八字/大运']);
		// [2026-09-12 复查] 段候选按「技法头 / 段尾」拆开命中:头对标签前缀 / 英文键 / 拼音,尾对段名子串——此前 `@紫微/` 只认完整标签「紫微斗数」,列空
		const py = (it)=>(it.key === 'ziwei' ? 'ziweidoushu zwds' : (it.key === 'bazi' ? 'bazi bz' : ''));
		expect(filterMentionCandidates(pool, '紫微/', { extraText: py }).map((x)=>x.name)).toEqual(['紫微斗数/命宫']);
		expect(filterMentionCandidates(pool, 'ziwei/', { extraText: py }).map((x)=>x.name)).toEqual(['紫微斗数/命宫']);
		expect(filterMentionCandidates(pool, 'zw/命', { extraText: py }).map((x)=>x.name)).toEqual(['紫微斗数/命宫']);
		expect(filterMentionCandidates(pool, 'bz/大', { extraText: py }).map((x)=>x.name)).toEqual(['八字/大运']);
		expect(filterMentionCandidates(pool, 'bz/不存在', { extraText: py })).toEqual([]);
		expect(filterMentionCandidates(pool, '/').map((x)=>x.kind)).toEqual(['section', 'section', 'section']);   // 空头 = 已列段全出
		expect(techniqueHeadMatch('八字', { label: '八字', key: 'bazi' })).toBe(0);
		expect(techniqueHeadMatch('八', { label: '八字', key: 'bazi' })).toBe(1);
		expect(techniqueHeadMatch('bz', { label: '八字', key: 'bazi', extra: 'bazi bz' })).toBe(1);
		expect(techniqueHeadMatch('字', { label: '八字', key: 'bazi' })).toBe(2);
		expect(techniqueHeadMatch('x', { label: '八字', key: 'bazi', extra: 'bazi bz' })).toBe(-1);
		// 段继承技法的可用性(命盘案例下 `@六爻/` 的段与 `@六爻` 一样灰)
		const grey = buildMentionCandidates({ techniqueOptions: [{ value: 'sixyao', label: '六爻' }], sectionTechniqueKeys: ['sixyao'], sectionsForTechnique: ()=>['卦象'], techniqueAvailable: ()=>'需事盘案例' });
		expect(grey.find((x)=>x.kind === 'section')).toEqual(expect.objectContaining({ available: false, why: '需事盘案例', techniqueLabel: '六爻' }));
	});
	it('🔴 [2026-09-12 复查] 带关键字时 bestIndex = 最佳命中(组序只管分组):有命盘「李八字」时 `@八字` 默认落在技法「八字」;纯字符串组名按首次出现顺序排组', ()=>{
		const pool = buildMentionCandidates({ sources: [{ id: 'local-9', sourceType: 'chart', title: '李八字', record: {} }], techniqueOptions: [{ value: 'bazi', label: '八字' }] });
		const d = filterMentionCandidatesDetailed(pool, '八字');
		expect(d.items.map((x)=>x.id)).toEqual(['local-9', 'bazi']);   // 视觉序:命盘组在前
		expect(d.bestIndex).toBe(1);                                    // 默认高亮:前缀命中的技法
		expect(filterMentionCandidatesDetailed(pool, '李').bestIndex).toBe(0);
		expect(filterMentionCandidatesDetailed(pool, '').bestIndex).toBe(0);
		const strPool = buildMentionCandidates({ techniqueOptions: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }], techniqueGroupOf: (k)=>(k === 'b' ? '第二组' : '第一组'), techniqueAvailable: (k)=>(k === 'a' ? '灰' : true) });
		expect(filterMentionCandidates(strPool, '').map((x)=>`${x.group}:${x.id}`)).toEqual(['技法 · 第一组:c', '技法 · 第一组:a', '技法 · 第二组:b']);
	});
	it('🔴 技法可用性:techniqueAvailable(key) 返回 true=可挂,返回字符串=不可挂原因(灰显);缺席=全可用', ()=>{
		const techs = [{ value: 'bazi', label: '八字' }, { value: 'sixyao', label: '六爻' }];
		const pool = buildMentionCandidates({ techniqueOptions: techs, techniqueAvailable: (k)=>(k === 'bazi' ? true : '需事盘案例') });
		expect(pool.find((x)=>x.key === 'bazi').available).toBe(true);
		expect(pool.find((x)=>x.key === 'sixyao')).toEqual(expect.objectContaining({ available: false, why: '需事盘案例' }));
		expect(buildMentionCandidates({ techniqueOptions: techs }).every((x)=>x.available === true)).toBe(true);
		// 可用项排在灰项之前(空关键字与有关键字都如此),池内序其次
		const pool2 = buildMentionCandidates({ techniqueOptions: [{ value: 'astrochart', label: '星盘' }, { value: 'sixyao', label: '六爻' }, { value: 'bazi', label: '八字' }], techniqueAvailable: (k)=>(k === 'sixyao' ? true : '需命盘案例') });
		expect(filterMentionCandidates(pool2, '').map((x)=>x.key)).toEqual(['sixyao', 'astrochart', 'bazi']);
		expect(filterMentionCandidates(pool2, '盘').map((x)=>x.key)).toEqual(['astrochart']);
		// [2026-09-12] 扁平序 = 视觉序:先按组(命盘 < 技法·域序 < 技法段),组内可用在前;技法段不会插在可用技法与灰技法之间
		const pool3 = buildMentionCandidates({ sources: [{ id: 'local-1', sourceType: 'chart', title: '张三', record: {} }], techniqueOptions: [{ value: 'bazi', label: '八字' }, { value: 'sixyao', label: '六爻' }, { value: 'astrochart', label: '星盘' }], techniqueAvailable: (k)=>(k === 'sixyao' ? '需事盘案例' : true), techniqueGroupOf: (k)=>(k === 'astrochart' ? { title: '西方占星', order: 0 } : (k === 'bazi' ? { title: '中式命理', order: 2 } : { title: '占卜术数', order: 3 })), selectedTechniqueKeys: ['bazi'], sectionsForTechnique: (k)=>(k === 'bazi' ? ['四柱'] : []) });
		expect(filterMentionCandidates(pool3, '').map((x)=>x.id)).toEqual(['local-1', 'astrochart', 'bazi', 'sixyao', 'bazi/四柱']);
		expect(filterMentionCandidates(pool3, '').map((x)=>x.group)).toEqual(['命盘', '技法 · 西方占星', '技法 · 中式命理', '技法 · 占卜术数', '技法段']);
	});
});

describe('parseMentions / resolveMentions', ()=>{
	it('标记换回名字;首命盘切源;第二命盘只提示走 /合盘;同名歧义取最近保存并提示;#尾号精确', ()=>{
		const { mentions, text } = parseMentions('@[命盘:张三] 和 @[命盘:李四] 今年运势');
		expect(text).toBe('张三 和 李四 今年运势');
		expect(mentions.map((m)=>m.name)).toEqual(['张三', '李四']);
		const plan = resolveMentions(mentions, { sources, techniqueOptions });
		expect(plan.selectSource.id).toBe('local-bbbb2222');
		expect(plan.hints.some((h)=>h.indexOf('已取最近') >= 0)).toBe(true);
		expect(plan.hints.some((h)=>h.indexOf('/合盘 李四') >= 0)).toBe(true);
		const exact = resolveMentions(parseMentions('@[命盘:张三#1111] 看').mentions, { sources });
		expect(exact.selectSource.id).toBe('local-aaaa1111');
		expect(exact.hints).toEqual([]);
		const kase = resolveMentions(parseMentions('@[事盘:搬家事盘] 吉凶').mentions, { sources });
		expect(kase.selectSource.id).toBe('local-dddd4444');
	});
	// [Q-326] 名字自带 `#尾号` / 含 `]` / 超 80 字 —— 三类名字此前都会解析错或整条标记原样发给模型
	it('🔴 名字转义:自带 #尾号不被切、含 ] 不截断、超 80 字仍解析;旧未转义标记照旧', ()=>{
		const roundTrip = (type, name)=>parseMentions(`${candidateToken({ type, name })} 看`);
		const a = roundTrip('chart', '案例#2024');
		expect(a.mentions).toEqual([{ type: 'chart', name: '案例#2024', suffix: '', raw: '@[命盘:案例\\#2024]' }]);
		expect(a.text).toBe('案例#2024 看');
		const b = roundTrip('material', '笔记[草稿]');
		expect(b.mentions[0].name).toBe('笔记[草稿]');
		expect(b.text).toBe('笔记[草稿] 看');
		const longName = `${'长'.repeat(120)}.txt`;
		const c = roundTrip('material', longName);
		expect(c.mentions.length).toBe(1);
		expect(c.mentions[0].name).toBe(longName);
		// 判别向量:同名消歧尾号仍要切出来;历史(未转义)标记语义不变
		expect(parseMentions('@[命盘:张三#1111] 看').mentions[0]).toEqual({ type: 'chart', name: '张三', suffix: '1111', raw: '@[命盘:张三#1111]' });
		expect(candidateToken({ type: 'chart', name: '张三', suffix: '2222' })).toBe('@[命盘:张三#2222]');
		expect(escapeMentionName('干净名字/带斜杠')).toBe('干净名字/带斜杠');
	});
	// [Q-326] 资料/组合/模板同名多条:此前静默取最近保存的一条
	it('🔴 资料/组合/模板同名多条也给歧义提示', ()=>{
		const dupMaterials = [{ id: 'm1', name: '子平真诠' }, { id: 'm9', name: '子平真诠' }];
		const dupBundles = [{ id: 'b1', name: '事业组合' }, { id: 'b9', name: '事业组合' }];
		const dupTemplates = [{ id: 't1', name: '简报模板' }, { id: 't9', name: '简报模板' }];
		const plan = resolveMentions(parseMentions('@[资料:子平真诠] @[组合:事业组合] @[模板:简报模板] 看').mentions,
			{ materials: dupMaterials, bundles: dupBundles, templates: dupTemplates });
		expect(plan.hints.filter((h)=>h.indexOf('已取最近') >= 0).length).toBe(3);
		// 判别向量:不重名时零提示
		const clean = resolveMentions(parseMentions('@[资料:名单.txt] 看').mentions, { materials });
		expect(clean.hints).toEqual([]);
	});
	it('资料/组合/模板进 referenceIds(带前缀);技法进 techniqueKeys;技法段进 sectionFilter 且带上技法;未找到进 unresolved', ()=>{
		const { mentions } = parseMentions('@[资料:名单.txt] @[组合:事业组合] @[模板:简报模板] @[技法:紫微斗数] @[技法段:八字/四柱] @[技法段:八字/大运] @[资料:不存在] 看看');
		const plan = resolveMentions(mentions, { sources, materials, bundles, templates, techniqueOptions });
		expect(plan.referenceIds).toEqual(['material:m1', 'bundle:b1', 'template:t1']);
		expect(plan.techniqueKeys).toEqual(['ziwei', 'bazi']);
		expect(plan.sectionFilter).toEqual({ bazi: ['四柱', '大运'] });
		expect(plan.unresolved).toEqual(['@[资料:不存在]']);
		expect(plan.selectSource).toBe(null);
	});
	it('🔴 技法在全集但不在当前案例可挂集 → 进 hints(说明当前是命盘/事盘)不进 techniqueKeys 也不算 unresolved;技法段同理;allowedTechniqueKeys 缺席=不限', ()=>{
		const all = [{ value: 'bazi', label: '八字' }, { value: 'sixyao', label: '六爻' }];
		const { mentions } = parseMentions('@[技法:六爻] @[技法:八字] @[技法段:六爻/卦象] 看');
		const plan = resolveMentions(mentions, { techniqueOptions: all, allowedTechniqueKeys: ['bazi'], activeSourceType: 'chart' });
		expect(plan.techniqueKeys).toEqual(['bazi']);
		expect(plan.unresolved).toEqual([]);
		expect(plan.sectionFilter).toEqual({});
		expect(plan.hints.filter((h)=>h.indexOf('六爻') >= 0 && h.indexOf('当前是命盘') >= 0).length).toBe(2);
		const free = resolveMentions(mentions, { techniqueOptions: all });
		expect(free.techniqueKeys).toEqual(['sixyao', 'bazi']);
		expect(free.hints).toEqual([]);
		const none = resolveMentions(mentions, { techniqueOptions: all, allowedTechniqueKeys: [], activeSourceType: '' });
		expect(none.techniqueKeys).toEqual([]);
		expect(none.hints[0]).toContain('尚未挂载案例');
	});
	it('🔴 [2026-09-12 复查] 技法段标记按「标签 + /」最长前缀切分:标签含 / (十三分盘 / 占星地图)与段名含 / (Ishta/Kashta)都不切错;英文键也可作头', ()=>{
		const opts = [{ value: 'hellenastro', label: '十三分盘' }, { value: 'astrochart_like', label: '十三分盘 / 占星地图' }, { value: 'indiachart', label: '印度占星' }];
		const plan = resolveMentions(parseMentions('@[技法段:十三分盘 / 占星地图/起盘信息] @[技法段:印度占星/Ishta/Kashta 吉凶果] @[技法段:hellenastro/宫位] @[技法段:没有斜杠] 看').mentions, { techniqueOptions: opts });
		expect(plan.techniqueKeys).toEqual(['astrochart_like', 'indiachart', 'hellenastro']);
		expect(plan.sectionFilter).toEqual({ astrochart_like: ['起盘信息'], indiachart: ['Ishta/Kashta 吉凶果'], hellenastro: ['宫位'] });
		expect(plan.unresolved).toEqual(['@[技法段:没有斜杠]']);
	});
	it('🔴 技法段过滤:只留所选段;names 空/过滤空 → 原样(同一引用);两次过滤字节恒等', ()=>{
		const content = '【四柱】\n甲子 乙丑\n\n【大运】\n丙寅起\n\n【神煞】\n天乙贵人';
		const once = filterContentSections(content, ['四柱']);
		expect(once).toContain('四柱');
		expect(once).not.toContain('神煞');
		expect(filterContentSections(content, once === content ? ['四柱'] : ['四柱'])).toBe(once);
		expect(filterContentSections(content, [])).toBe(content);
		expect(filterContentSections(content, ['不存在的段'])).toBe(content);
		expect(filterContentSections('', ['四柱'])).toBe('');
	});
});
