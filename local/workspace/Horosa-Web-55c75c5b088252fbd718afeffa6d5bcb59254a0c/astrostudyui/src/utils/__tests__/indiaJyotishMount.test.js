// §1.3 印度 AI 挂载（单一真值源）：buildJyotishSnapshotLines 把后端 jyotish 真值
// (Panchanga / 8 卡拉卡 / 节点主照) 写进快照。守卫「静默无数据」回归。
import { buildJyotishSnapshotLines } from '../../components/astro/IndiaChart';

describe('印度 jyotish 快照挂载（§1.3 单一真值源）', ()=>{
	it('缺 jyotish → 空对象（不抛）', ()=>{
		expect(buildJyotishSnapshotLines(null)).toEqual({});
		expect(buildJyotishSnapshotLines({})).toEqual({});
		expect(buildJyotishSnapshotLines({ jyotish: {} })).toEqual({});
	});

	it('Panchanga / 8 卡拉卡 / 节点主照 各自成段', ()=>{
		const chartObj = { jyotish: {
			panchanga: {
				vara: { label: '周日', lord: { label: '太阳' } },
				tithi: { index: 5, name: 'Panchami', paksha: 'Shukla' },
				nakshatra: { label: '娄宿' },
				yoga: { name: 'Siddhi' },
				karana: { name: 'Bava' },
			},
			jaimini: { charaKarakas: [
				{ karakaLabel: 'AK', karaka: 'Atmakaraka', label: '罗睺', planet: 'North Node',
					sign: 'Cancer', signLabel: '巨蟹', signlon: 28.283, karakaDegree: 28.283 },
				{ karakaLabel: 'DK', karaka: 'Darakaraka', label: '太阳', planet: 'Sun',
					sign: 'Aries', signLabel: '白羊', signlon: 5, karakaDegree: 5 },
			] },
			nodeRasiDrishti: [
				{ giverLabel: '罗睺', targetSignLabel: '天蝎' },
				{ giverLabel: '计都', targetSignLabel: '金牛' },
			],
		} };
		const out = buildJyotishSnapshotLines(chartObj);
		expect(Object.keys(out)).toEqual(['Panchanga 五要素', '卡拉卡（8 Chara Karakas）', '节点主照（Rasi Drishti）']);
		expect(out['Panchanga 五要素'].join('\n')).toMatch(/月宿\(Nakshatra\)：娄宿/);
		expect(out['Panchanga 五要素'].join('\n')).toMatch(/月相\(Tithi\)：Shukla Panchami（第 5 日）/);
		// 格式锚随 GFM 表更新(值零变化：罗睺逆量用度 28.28 逐字仍在，数据行位移至 [2])。
		// 段首行=方案标注(取引擎 karakaScheme),表头与数据行各后移一位
		expect(out['卡拉卡（8 Chara Karakas）'][0]).toMatch(/^方案：8 卡拉卡（含 Rāhu），共 \d+ 行$/);
		expect(out['卡拉卡（8 Chara Karakas）'][1]).toBe('| 卡拉卡 | 星曜 | 本命落座 | 用度 |');
		expect(out['卡拉卡（8 Chara Karakas）'][3]).toBe('| AK Atmakaraka | 罗睺 | 巨蟹 28.28° | 用度 28.28° |');
		expect(out['卡拉卡（8 Chara Karakas）']).toHaveLength(5);   // 方案行 + 表头 + 分隔 + 2 数据行
		expect(out['节点主照（Rasi Drishti）']).toEqual(['| 给照 | 受照 |', '| --- | --- |', '| 罗睺 | 天蝎 |', '| 计都 | 金牛 |']);
	});

	it('部分缺失（只有卡拉卡）→ 只出该段', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { jaimini: { charaKarakas: [
			{ karakaLabel: 'AK', karaka: 'Atmakaraka', label: '木星', sign: 'Leo', signlon: 10, karakaDegree: 10 },
		] } } });
		expect(Object.keys(out)).toEqual(['卡拉卡（8 Chara Karakas）']);
	});

	it('庙旺态单一来源:六种引擎枚举在「星曜状态」「分盘吉位」里都写成页面同一张表的中文', ()=>{
		const { INDIA_DIGNITY_CN, indiaDignityLabel } = require('../../components/astro/indiaMain/jyotishData');
		const ENUMS = ['deep_exaltation', 'exaltation', 'moolatrikona', 'own_sign', 'debilitation', 'neutral'];
		expect(Object.keys(INDIA_DIGNITY_CN).sort()).toEqual(ENUMS.slice().sort());
		const states = ENUMS.map((d, i)=>({ label: `曜${i}`, sign: 'Aries', signLabel: '白羊', signlon: i, house: 1, dignity: d }));
		const vargaDignity = ENUMS.map((d, i)=>({ id: `v${i}`, label: `D${i + 1}`, d1: d, amsa: {} }));
		const out = buildJyotishSnapshotLines({ jyotish: { strengths: { planetaryStates: states, vargaDignity } } });
		const text = `${out['星曜状态'].join('\n')}\n${out['分盘吉位 Vaiśeṣikāṁśa'].join('\n')}`;
		expect(text).not.toMatch(/\b(deep_exaltation|exaltation|moolatrikona|own_sign|debilitation|neutral)\b/);
		ENUMS.forEach((d)=>{ expect(text).toContain(INDIA_DIGNITY_CN[d]); });
		expect(out['分盘吉位 Vaiśeṣikāṁśa'][2]).toBe('| D1（本盘深旺） | 无连座吉位 |');
		// 认不出的值原样回出(不吞);空值给空串
		expect(indiaDignityLabel('mystery')).toBe('mystery');
		expect(indiaDignityLabel(undefined)).toBe('');
	});

	it('Tajika 年主「取用」:四种引擎途径都写成页面同一张表的中文', ()=>{
		const { TAJIKA_YEAR_LORD_VIA_CN } = require('../../components/astro/indiaMain/jyotishData');
		const VIAS = ['benefic_aspect', 'malefic_aspect', 'strong_no_aspect', 'first_candidate_fallback'];
		expect(Object.keys(TAJIKA_YEAR_LORD_VIA_CN).sort()).toEqual(VIAS.slice().sort());
		VIAS.forEach((via)=>{
			const out = buildJyotishSnapshotLines({ jyotish: { tajaka: { yearLord: { planet: 'Moon', via, panchaBala: 8.63 } } } });
			expect(out['Tajika 年主']).toEqual([`年主：月亮（取用 ${TAJIKA_YEAR_LORD_VIA_CN[via]}；五分力 8.63）`]);
		});
		const path = require('path');
		const { readSource } = require('./helpers/sourceSet');
		const main = readSource(path.join(__dirname, '..', '..', 'components', 'astro', 'IndiaChartMain.js'));
		expect(main).toMatch(/tajikaYearLordViaLabel\(yearLord\.via\)/);
		expect(main).not.toMatch(/\{yearLord\.via\s*\|\|/);
	});

	it('页面与快照不各写一张庙旺态表(中文值只在单一来源里出现一次)', ()=>{
		const path = require('path');
		const { readSource } = require('./helpers/sourceSet');
		const dir = path.join(__dirname, '..', '..', 'components', 'astro');
		const page = readSource(path.join(dir, 'IndiaChartMain.js'));   // 门面 + indiaMain/ 子模块全集
		const snap = readSource(path.join(dir, 'IndiaChart.js'));
		const count = (t)=>(t.match(/自旺MT/g) || []).length;
		expect([count(page), count(snap)]).toEqual([1, 0]);
		expect(readSource(path.join(dir, 'indiaMain', 'jyotishData.js'))).toMatch(/INDIA_DIGNITY_CN = Object\.freeze\(\{[^}]*自旺MT/);
		// 读庙旺态的地方(x.dignity / 分盘的 row.d1)一律直接交给 indiaDignityLabel;裸拼、局部对照表、内联小表都不许
		[['IndiaChartMain', page], ['IndiaChart', snap]].forEach(([n, src])=>{
			const reads = [...src.matchAll(/\b\w+\.(dignity|d1)\b/g)];
			const bare = reads.filter((m)=>!src.slice(Math.max(0, m.index - 18), m.index).endsWith('indiaDignityLabel(')).map((m)=>m[0]);
			expect([n, reads.length > 0, bare]).toEqual([n, true, []]);
		});
	});

	it('星曜状态 / 八分点 SAV / Shadbala 段（含燃烧/逆行/vargottama/Baladi）', ()=>{
		const chartObj = { jyotish: {
			strengths: { planetaryStates: [
				{ label: '木星', sign: 'Cancer', signLabel: '巨蟹', signlon: 5.2, house: 4, dignity: 'exaltation',
					vargottama: true, retrograde: false, combust: false, baladi: { label: '青年' },
					nakshatra: { name: 'Pushya', pada: 1 } },
				{ label: '水星', sign: 'Aries', signLabel: '白羊', signlon: 12, house: 1, dignity: 'neutral',
					vargottama: false, retrograde: true, combust: true, baladi: { label: '少年' },
					nakshatra: { name: 'Ashwini', pada: 4 } },
			] },
			ashtakavarga: { available: true, sarvaBySign: [{ label: '白羊', bindu: 30 }, { label: '金牛', bindu: 28 }] },
			shadbalaBphs: {
				Jupiter: { rupas: 7.5, requiredRupas: 6.5, strengthRatio: 1.1538, sufficient: true },
				Mercury: { rupas: 5.2, requiredRupas: 7, strengthRatio: 0.7429, sufficient: false },
			},
		} };
		const out = buildJyotishSnapshotLines(chartObj);
		expect(Object.keys(out)).toEqual(['星曜状态', '八分点 SAV', 'Shadbala 六力']);
		// 格式锚随 GFM 表更新(值零变化：木星巨蟹5.2°宫4·水星逆行/燃烧 逐字仍在，[2]/[3] 为数据行)。
		// 庙旺态写中文(与页面「Graha 状态」同一张对照表 INDIA_DIGNITY_CN),不写引擎枚举
		expect(out['星曜状态'][2]).toBe('| 木星 | 巨蟹 5.2°·宫4 | 入旺·青年·PushyaP1 | Vargottama |');
		expect(out['星曜状态'][3]).toContain('| 平·少年·');
		expect(out['星曜状态'][3]).toContain('逆行/燃烧');
		expect(out['八分点 SAV'][0]).toBe('总点数 58（标准 337）');
		// [YG 表化] 格式锚随 GFM 表更新(值零变化:木星 7.50/水星 5.20 逐字仍在)。
		// 六力唯一来源 = 六源式 shadbalaBphs(页面 Shadbala 卡同值);粗估层已删。
		expect(out['Shadbala 六力']).toEqual([
			'| 星曜 | 总力 | 所需 | 达标比 |', '| --- | --- | --- | --- |',
			'| 水星 | 5.20 Rupa | 7.0 Rupa | 0.74（力弱） |', '| 木星 | 7.50 Rupa | 6.5 Rupa | 1.15（力足） |']);
	});

	it('P0-6/7/8 新段：Sodhya Pinda / Vimśopaka / Hora 各自成段（AI 同步）', ()=>{
		const chartObj = { jyotish: {
			ashtakavarga: { available: true, sarvaBySign: [{ label: '白羊', bindu: 30 }],
				sodhyaPinda: { Sun: { rasiPinda: 120, grahaPinda: 40, total: 160 },
					Moon: { rasiPinda: 90, grahaPinda: 30, total: 120 } } },
			shadbalaBphs: {
				Sun: { vimsopaka: { shadvarga: { total: 12.5 }, saptavarga: { total: 11 },
					dasavarga: { total: 13 }, shodasavarga: { total: 10.5 } } },
			},
			muhurta: { horaTable: { weekday: 2, rows: [
				{ index: 1, period: 'day', lord: 'Mars', lordCN: '火星', start: '2026-06-23 06:11:00', end: '2026-06-23 07:00:00' },
				{ index: 2, period: 'day', lord: 'Sun', lordCN: '太阳', start: '2026-06-23 07:00:00', end: '2026-06-23 07:49:00' },
			] } },
		} };
		const out = buildJyotishSnapshotLines(chartObj);
		// 格式锚随 GFM 表更新(值零变化：各段数值/首字逐字仍在)。
		expect(out['Sodhya Pinda 凝量']).toEqual(['| 曜 | 凝量 | 座+曜 |', '| --- | --- | --- |', '| 日 | 160 | 座120+曜40 |', '| 月 | 120 | 座90+曜30 |']);
		expect(out['Vimśopaka 分盘 20 分力']).toEqual(['| 曜 | 六 | 七 | 十 | 十六 |', '| --- | --- | --- | --- | --- |', '| 日 | 六12.5 | 七11 | 十13 | 十六10.5 |']);
		expect(out['Hora 行星时']).toEqual(['| 序主星 | 起 |', '| --- | --- |', '| 1.火星 | 06:11 |', '| 2.太阳 | 07:00 |']);
	});

	it('P1 Choghadia 民用择时成段（AI 同步，标注吉凶）', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { muhurta: { choghadia: { weekday: 4, rows: [
			{ index: 1, period: 'day', key: 'Shubh', cn: '吉', nature: 'good', planet: 'Jupiter', start: '2026-06-23 06:00:00' },
			{ index: 1, period: 'night', key: 'Amrit', cn: '甘露', nature: 'good', planet: 'Moon', start: '2026-06-23 18:30:00' },
			{ index: 2, period: 'night', key: 'Kaal', cn: '时', nature: 'bad', planet: 'Saturn', start: '2026-06-23 19:20:00' },
		] } } } });
		// 格式锚随 GFM 表更新(值零变化：昼夜index.cn/吉凶/起时逐字仍在)。
		expect(out['Choghadia 民用择时']).toEqual(['| 时段 | 吉凶 | 起 |', '| --- | --- | --- |', '| 昼1.吉 | 吉 | 06:00 |', '| 夜1.甘露 | 吉 | 18:30 |', '| 夜2.时 | 凶 | 19:20 |']);
	});

	it('P1 Naisargika 自然大运成段（AI 同步，年龄段）', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { dasha: { naisargika: { available: true, mode: 'varahamihira', periods: [
			{ planet: 'Moon', planetCN: '月', years: 1, startAge: 0, endAge: 1, start: '1990-03-15', end: '1991-03-15' },
			{ planet: 'Saturn', planetCN: '土', years: 50, startAge: 70, endAge: 120, start: '2060-03-14', end: '2110-03-15' },
		] } } } });
		// 格式锚随 GFM 表更新(值零变化：曜/年数/年龄段/起止日期逐字仍在)。
		expect(out['Naisargika 自然大运']).toEqual([
			'| 曜 | 年数 | 年龄段 | 起 | 止 |',
			'| --- | --- | --- | --- | --- |',
			'| 月 | 1年 | 0–1岁 | 1990-03-15 | 1991-03-15 |',
			'| 土 | 50年 | 70–120岁 | 2060-03-14 | 2110-03-15 |',
		]);
	});

	it('P1 补充上升（含 Indu 财富）成段（AI 同步）', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { supplementaryLagnas: { available: true,
			chandraLagna: { key: 'chandraLagna', label: '月上升', sign: 'Cancer', signLabel: '巨蟹' },
			karakamsa: { key: 'karakamsa', label: 'Karakamsa', sign: 'Scorpio', signLabel: '天蝎' },
			induLagna: { key: 'induLagna', label: 'Indu 财富上升', sign: 'Aquarius', signLabel: '水瓶', sumKala: 20, stepS: 8 },
		} } });
		// 格式锚随 GFM 表更新(值零变化：座名/Indu Kala和 20·第8座 逐字仍在；空附注渲染为空单元格)。
		expect(out['补充上升（Supplementary Lagnas）']).toEqual([
			'| 上升 | 座 | 附注 |',
			'| --- | --- | --- |',
			'| 月上升 | 巨蟹 |  |',
			'| Karakamsa | 天蝎 |  |',
			'| Indu 财富上升 | 水瓶 | Kala和 20·第8座 |',
		]);
	});

	it('P2 Nāḍī Bhrigu Bindu 成段（AI 同步）', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { nadi: { available: true, bhriguBindu: {
			lon: 240.9611, sign: 'Sagittarius', signLabel: '射手', nakshatra: { name: 'Mula', pada: 1 },
		} } } });
		expect(out['Nāḍī · Bhrigu Bindu 福点']).toEqual(['射手·MulaP1（黄经 240.96°）']);
	});

	// 所绘为分盘时,Nāḍī 段须注明「恒按 D1」(引擎侧 Q-393② 已恒取 d1_chart);
	// D1(缺省)不出该行 = 缺省快照字节不变。判别向量:同一份 nadi 数据,只换 engine.chartnum。
	it('P2 Nāḍī 口径注:分盘时注明恒按 D1,D1 缺省零新增', ()=>{
		const nadi = { available: true, bhriguBindu: {
			lon: 240.9611, sign: 'Sagittarius', signLabel: '射手', nakshatra: { name: 'Mula', pada: 1 },
		} };
		const d1 = buildJyotishSnapshotLines({ jyotish: { engine: { chartnum: 1 }, nadi } });
		expect(d1['Nāḍī · Bhrigu Bindu 福点']).toEqual(['射手·MulaP1（黄经 240.96°）']);
		const d9 = buildJyotishSnapshotLines({ jyotish: { engine: { chartnum: 9 }, nadi } });
		expect(d9['Nāḍī · Bhrigu Bindu 福点'].length).toBe(2);
		expect(d9['Nāḍī · Bhrigu Bindu 福点'][1]).toContain('恒按 D1 本命盘绝对黄经');
		expect(d9['Nāḍī · Bhrigu Bindu 福点'][1]).toContain('D9');
	});

	it('P2 Āyurdāya 寿命基础成段（AI 同步）', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { ayurdaya: { available: true,
			pindayu: { baseYears: 98.55, contributions: [
				{ planetCN: '日', fullYears: 19, years: 16.915 },
				{ planetCN: '土', fullYears: 20, years: 16.134 },
			] },
			nisargayu: { naturalYears: [{ planetCN: '日', years: 20 }, { planetCN: '月', years: 1 }] },
		} } });
		expect(out['Āyurdāya 寿命基础'][0]).toBe('基础 Piṇḍāyu：98.55 年（未施 haraṇa 减）');
		expect(out['Āyurdāya 寿命基础']).toContain('日：满19 → 16.915 年');
		expect(out['Āyurdāya 寿命基础'][3]).toBe('Nisargāyu 自然寿表 120 年（日20 月1）');
	});

	it('新段缺数据不抛、不出空段', ()=>{
		const out = buildJyotishSnapshotLines({ jyotish: { ashtakavarga: { available: true, sarvaBySign: [{ label: '白羊', bindu: 30 }] } } });
		expect(out['Sodhya Pinda 凝量']).toBeUndefined();
		expect(out['Vimśopaka 分盘 20 分力']).toBeUndefined();
		expect(out['Hora 行星时']).toBeUndefined();
	});
});

describe('印度引擎子块未能计算 → 快照写明', ()=>{
	const { buildIndiaSnapshotDataSections, indiaPartialErrorLines } = require('../../components/astro/IndiaChart');
	it('partialErrors 逐名转成中文段名,未登记的名字原样写出,不吞', ()=>{
		const lines = indiaPartialErrorLines({ jyotish: { partialErrors: ['kp.deep', 'muhurta.panchaka', 'dasha.yogini', 'kalachakra'] } });
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/KP 深化/);
		expect(lines[0]).toMatch(/Panchaka 五忌/);
		expect(lines[0]).toMatch(/大运·yogini/);
		expect(lines[0]).toMatch(/kalachakra/);
		expect(indiaPartialErrorLines({ jyotish: {} })).toEqual([]);
		expect(indiaPartialErrorLines(null)).toEqual([]);
	});
	it('数据段:有落账才出「未能计算」段,正常盘不多段', ()=>{
		expect(buildIndiaSnapshotDataSections({ jyotish: { partialErrors: ['kp.deep'] } }, {})['未能计算']).toBeTruthy();
		expect('未能计算' in buildIndiaSnapshotDataSections({ jyotish: {} }, {})).toBe(false);
	});
});
