jest.mock('../localcharts', ()=>({
	listLocalCharts: jest.fn(()=>[
		{
			cid: 'chart-1',
			name: '测试命盘',
			birth: '2026-04-04 10:00:00',
			zone: '+08:00',
			lon: '118e27',
			lat: '31n38',
			group: '["事业"]',
			updateTime: '2026-04-04 10:00:00',
		},
	]),
}));

jest.mock('../localcases', ()=>({
	listLocalCases: jest.fn(()=>[
		{
			cid: 'case-1',
			event: '测试事盘',
			caseType: 'sanshiunited',
			sourceModule: 'sanshiunited',
			payload: JSON.stringify({
				moduleSnapshots: {
					liureng: {
						content: '大六壬结构化快照',
						meta: {
							date: '2026/04/04',
							time: '11:00',
						},
					},
					qimen: {
						content: '奇门遁甲结构化快照',
						meta: {
							date: '2026/04/04',
							time: '11:00',
						},
					},
				},
				snapshot: {
					content: '这是缓存的 AI 导出文本',
				},
			}),
			group: '["感情"]',
			divTime: '2026-04-04 11:00:00',
			updateTime: '2026-04-04 11:00:00',
		},
		{
			cid: 'case-2',
			event: '无快照六壬',
			caseType: 'liureng',
			sourceModule: 'liureng',
			payload: JSON.stringify({
				module: 'liureng',
				liureng: {
					nongli: {
						birth: '2026-04-04 12:00:00',
					},
				},
				runyear: { year: '丙午', age: 32 },
				wuxing: '木',
				guireng: 2,
			}),
			group: '["工作"]',
			divTime: '2026-04-04 12:00:00',
			zone: '+08:00',
			lon: '118e27',
			lat: '31n38',
			updateTime: '2026-04-04 12:00:00',
		},
		{
			cid: 'case-3',
			event: '空载六壬',
			caseType: 'liureng',
			sourceModule: 'liureng',
			payload: JSON.stringify({}),
			group: '["工作"]',
			divTime: '2026-04-04 13:00:00',
			zone: '+08:00',
			lon: '118e27',
			lat: '31n38',
			updateTime: '2026-04-04 13:00:00',
		},
	]),
	getCaseTypeLabel: jest.fn((type)=>type),
	getCaseTypeMeta: jest.fn(()=>({ module: 'sanshiunited', value: 'sanshiunited' })),
}));

const mockLoadAstroAISnapshot = jest.fn(()=>null);

jest.mock('../astroAiSnapshot', ()=>({
	buildAstroSnapshotContent: jest.fn(()=> 'snapshot'),
	loadAstroAISnapshot: (...args)=>mockLoadAstroAISnapshot(...args),
}));

const mockSaveModuleAISnapshot = jest.fn();
const mockModuleSnapshots = {
	primarydirect: '主限法结构化快照',
	bazi: '八字结构化快照',
	ziwei: '紫微斗数结构化快照',
	guolao: '七政四余结构化快照',
	germany: '量化盘结构化快照',
	jieqi: '节气盘结构化快照',
	jieqi_meta: '节气盘参数结构化快照',
	jieqi_chunfen: '节气盘春分快照',
	jieqi_xiazhi: '节气盘夏至快照',
	jieqi_qiufen: '节气盘秋分快照',
	jieqi_dongzhi: '节气盘冬至快照',
	indiachart: '印度律盘结构化快照',
	relative: '关系盘结构化快照',
	guazhan: '六爻结构化快照',
	tongshefa: '统摄法结构化快照',
	suzhan: '宿占结构化快照',
	fengshui: '风水结构化快照',
	otherbu: '西洋游戏结构化快照',
	qimen: '奇门遁甲结构化快照',
	jinkou: '金口诀结构化快照',
	taiyi: '太乙结构化快照',
	sanshiunited: '三式合一结构化快照',
};

jest.mock('../moduleAiSnapshot', ()=>({
	loadModuleAISnapshot: jest.fn((moduleName)=>{
		if(mockModuleSnapshots[moduleName]){
			return {
				content: mockModuleSnapshots[moduleName],
				meta: {
					date: '2026/04/04',
					time: '10:00',
					zone: '+08:00',
				},
			};
		}
		return null;
	}),
	saveModuleAISnapshot: (...args)=>mockSaveModuleAISnapshot(...args),
}));

jest.mock('../../services/astro', ()=>({
	fetchChart: jest.fn(async ()=>({
		Result: {
			chart: {
				objects: [],
				stars: [],
			},
			lots: [],
		},
	})),
}));

jest.mock('../request', ()=>({
	__esModule: true,
	default: jest.fn(async ()=>({
		Result: {
			liureng: {
				nongli: {
					time: '午时',
					dayGanZi: '甲子',
				},
			},
		},
	})),
}));

jest.mock('../preciseCalcBridge', ()=>({
	fetchPreciseNongli: jest.fn(async ()=>({
		jieqi: '惊蛰',
		runyear: '丙午',
		ganzhi: {
			year: '甲子',
			month: '乙丑',
			day: '丙寅',
			time: '丁卯',
		},
	})),
}));

jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: {
		contextCache: 'contextCache',
	},
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
}));

jest.mock('../../components/lrzhan/LiuRengMain', ()=>({
	buildLiuRengSnapshotText: jest.fn(()=> '自动生成的大六壬快照'),
}));

jest.mock('../../components/jinkou/JinKouMain', ()=>({
	buildJinKouSnapshotText: jest.fn(()=> '自动生成的金口诀快照'),
}));

jest.mock('../../components/jinkou/JinKouCalc', ()=>({
	buildJinKouData: jest.fn(()=>({ ready: true, topInfo: { diFen: '子' }, rows: [] })),
}));

jest.mock('../../components/jinkou/JinKouState', ()=>({
	resolveJinKouDiFen: jest.fn(()=> '子'),
}));

jest.mock('../../components/dunjia/DunJiaCalc', ()=>({
	calcDunJia: jest.fn(()=>({ kind: 'qimen-pan' })),
	buildDunJiaSnapshotText: jest.fn(()=> '自动生成的奇门快照'),
}));

jest.mock('../../components/taiyi/TaiYiCalc', ()=>({
	calcTaiyi: jest.fn(()=>({ kind: 'taiyi-pan' })),
	fetchTaiyiPan: jest.fn(async ()=>({ kind: 'taiyi-pan', source: 'kintaiyi' })),
	buildTaiyiSnapshotText: jest.fn(()=> '自动生成的太乙快照'),
}));

jest.mock('../../components/tongshefa/TongSheFaMain', ()=>({
	buildTongSheFaModel: jest.fn((selection)=>selection),
	buildTongSheFaSnapshot: jest.fn(()=> '自动生成的统摄法快照'),
}));

jest.mock('../../components/guazhan/GuaZhanMain', ()=>({
	buildGuaSnapshotText: jest.fn(()=> '自动生成的六爻快照'),
}));


jest.mock('../../divination/horary/horaryEngine', ()=>({
	runHorary: jest.fn(()=>({ verdict: { leaning: 'even' } })),
	ASPECT_CN: {},
}));
jest.mock('../../divination/horary/horarySnapshot', ()=>({
	buildHorarySnapshot: jest.fn(()=> '自动生成的卜卦盘快照'),
}));
jest.mock('../../divination/election/electionEngine', ()=>({
	runElection: jest.fn(()=>({ overall: { score: 80 } })),
}));
jest.mock('../../divination/election/electionSnapshot', ()=>({
	buildElectionSnapshot: jest.fn(()=> '自动生成的择日盘快照'),
}));

jest.mock('../../components/comp/DateTime', ()=> jest.fn().mockImplementation(()=>({
	ad: 1,
	zone: '+08:00',
	clone(){
		return this;
	},
	startOf(){
		return this;
	},
	format(fmt){
		if(fmt === 'YYYY/MM/DD'){
			return '2026/04/04';
		}
		return '10:00:00';
	},
})));

import {
	ANALYSIS_CASE_TECHNIQUES,
	ANALYSIS_CHART_TECHNIQUES,
	TIME_CASTABLE_DIVINATION,
	buildPromptContext,
	getAnalysisTechniqueContexts,
	getAnalysisSourceContext,
	listAnalysisSources,
	listAnalysisTechniqueOptions,
} from '../aiAnalysisContext';

describe('aiAnalysisContext', ()=>{
	beforeEach(()=>{
		mockSaveModuleAISnapshot.mockClear();
		mockLoadAstroAISnapshot.mockReset();
		mockLoadAstroAISnapshot.mockReturnValue(null);
	});

	test('listAnalysisSources merges local charts and cases', ()=>{
		const sources = listAnalysisSources();
		expect(sources).toHaveLength(4);
		expect(sources[0]).toMatchObject({
			id: 'case-3',
			sourceType: 'case',
			snapshotStatus: 'generated',
		});
		expect(sources[1]).toMatchObject({
			id: 'case-2',
			sourceType: 'case',
			snapshotStatus: 'generated',
		});
		expect(sources[2]).toMatchObject({
			id: 'case-1',
			sourceType: 'case',
			snapshotStatus: 'ready',
		});
		expect(sources[3]).toMatchObject({
			id: 'chart-1',
			sourceType: 'chart',
		});
	});

	test('buildPromptContext includes source, materials and bundle templates', ()=>{
		const text = buildPromptContext({
			sourceContext: {
				title: '测试案例',
				content: '案例正文',
			},
			techniqueContexts: [
				{
					key: 'liureng',
					title: '大六壬',
					content: '大六壬结构化快照',
				},
			],
			materials: [
				{
					name: '资料一',
					extractedText: '资料正文',
				},
			],
			bundles: [
				{
					name: '组合一',
					templateId: 'tpl-1',
				},
			],
			templates: [
				{
					id: 'tpl-1',
					name: '回复模版',
					format: 'text',
					content: '请按以下结构输出',
				},
			],
		});
		expect(text).toContain('案例前提：测试案例');
		expect(text).toContain('使用技法：大六壬');
		expect(text).toContain('资料一');
		expect(text).toContain('模版约束：回复模版');
	});

	test('listAnalysisTechniqueOptions separates chart and case techniques', ()=>{
		const sources = listAnalysisSources();
		const caseSource = sources.find((item)=>item.sourceType === 'case');
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const caseOptions = listAnalysisTechniqueOptions(caseSource).map((item)=>item.value);
		const chartOptions = listAnalysisTechniqueOptions(chartSource).map((item)=>item.value);

		expect(caseOptions).toContain('liureng');
		expect(caseOptions).toContain('qimen');
		expect(caseOptions).not.toContain('primarydirect');
		expect(chartOptions).toContain('astrochart');
		expect(chartOptions).toContain('primarydirect');
		expect(chartOptions).toContain('guolao');
		expect(chartOptions).not.toContain('liureng');   // 卜技法归占卜挂载(起课时间/事盘源),不混入命盘清单
		// [起课时间源单源化] 下拉=TIMEPOINT_CASTABLE_SET 展开——此前手抄清单漏 小六壬/飞宫(集内却挂不了)
		const tpOptions = listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((item)=>item.value);
		expect(tpOptions).toContain('xiaoliuren');
		expect(tpOptions).toContain('feigong');
		expect(tpOptions).toContain('liureng');
		expect(tpOptions).toContain('sixyao');
		expect(tpOptions).toContain('huangli');
		expect(tpOptions).not.toContain('tongshefa');    // 非时间可推仍不进(挂事盘)
		// 真空壳技法已从下拉移除（选了挂不出内容）：节气盘×6/辅助(cntradition)/骰子(otherbu)/风水
		// [D2] relative 已回归清单:buildTechniqueContext 特判读合盘页模块快照(可挂出内容,不再空壳)。
		expect(chartOptions).not.toContain('cntradition');
		expect(chartOptions).toContain('relative');
		expect(chartOptions).not.toContain('jieqi');
		expect(chartOptions).not.toContain('otherbu');
		expect(chartOptions).not.toContain('fengshui');
	});

	// 卜卦/术数事盘挂载补全：kentang 法(皇极经世/五兆/太玄/荆诀/神易数)存 payload.snapshot 为字符串。
	describe('卜卦/术数事盘挂载（payload.snapshot 字符串 + huangji 入 CASE 集）', ()=>{
		const localcases = require('../localcases');
		const wuzhaoCase = {
			cid: 'case-wz',
			event: '五兆占断',
			caseType: 'wuzhao',
			sourceModule: 'wuzhao',
			// snapshot 为纯字符串（组件 buildSnapshotText(pan)），非对象——本批修复点。
			payload: JSON.stringify({ module: 'wuzhao', version: 1, snapshot: '[五兆]\n外卦 火 / 内卦 水（结构化快照）' }),
			divTime: '2026-04-04 11:00:00',
			updateTime: '2026-04-04 11:00:00',
		};
		const huangjiCase = {
			cid: 'case-hj',
			event: '皇极经世占断',
			caseType: 'huangji',
			sourceModule: 'huangji',
			payload: JSON.stringify({ module: 'huangji', version: 1, snapshot: '[皇极经世]\n元会运世 经世之卦（结构化快照）' }),
			divTime: '2026-04-04 11:00:00',
			updateTime: '2026-04-04 11:00:00',
		};
		const toSource = (caze)=>({
			id: caze.cid, sourceType: 'case', title: caze.event, module: caze.sourceModule,
			time: caze.divTime, zone: '+08:00', tags: [], snapshotStatus: 'lazy', updatedAt: caze.updateTime, record: caze,
		});

		test('字符串 payload.snapshot 被 listAnalysisSources 识别为 ready 真盘文本（非泛化摘要）', ()=>{
			localcases.listLocalCases.mockReturnValueOnce([wuzhaoCase]);
			const sources = listAnalysisSources();
			const wz = sources.find((s)=>s.id === 'case-wz');
			expect(wz).toBeTruthy();
			expect(wz.snapshotStatus).toBe('ready');
		});

		test('listAnalysisTechniqueOptions(case) 含 huangji（修前漏登）+ 五兆姊妹法', ()=>{
			const opts = listAnalysisTechniqueOptions({ sourceType: 'case' }).map((o)=>o.value);
			expect(opts).toContain('huangji');
			expect(opts).toContain('wuzhao');
			expect(opts).toContain('taixuan');
			expect(opts).toContain('jingjue');
			expect(opts).toContain('shenyishu');
		});

		// 起课时间源:必含 huangji + 4 个报数法,与 TIMEPOINT_CASTABLE_SET 同步。少一个 = AGENTS.md §G 的下拉里
		// 看到但点了显「缺失」真因。改 listAnalysisTechniqueOptions(timepoint) 必同改 TIMEPOINT_CASTABLE_SET。
		test('listAnalysisTechniqueOptions(timepoint) 必含全 13 项 (8 时确定 + 6 报数/起例) — 与 TIMEPOINT_CASTABLE_SET 同步', ()=>{
			const opts = listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value);
			['liureng', 'jinkou', 'qimen', 'taiyi', 'sanshiunited', 'horary', 'election',
				'sixyao', 'huangji', 'taixuan', 'jingjue', 'wuzhao', 'shenyishu'].forEach((k)=>{
				expect(opts).toContain(k);
			});
		});

		test('挂载五兆事盘 → 正文命中字符串 payload.snapshot', async ()=>{
			const contexts = await getAnalysisTechniqueContexts(toSource(wuzhaoCase), ['wuzhao']);
			const ctx = contexts.find((c)=>c.key === 'wuzhao');
			expect(ctx.available).toBe(true);
			expect(ctx.content).toContain('五兆');
		});

		test('挂载皇极经世事盘 → 正文命中字符串 payload.snapshot（入 CASE 集后可挂）', async ()=>{
			const contexts = await getAnalysisTechniqueContexts(toSource(huangjiCase), ['huangji']);
			const ctx = contexts.find((c)=>c.key === 'huangji');
			expect(ctx.available).toBe(true);
			expect(ctx.content).toContain('皇极经世');
		});
	});

	test('getAnalysisTechniqueContexts resolves case technique snapshots from payload', async ()=>{
		const sources = listAnalysisSources();
		const caseSource = sources.find((item)=>item.id === 'case-1');
		const contexts = await getAnalysisTechniqueContexts(caseSource, ['liureng', 'qimen']);

		expect(contexts).toEqual(expect.arrayContaining([
			expect.objectContaining({
				key: 'liureng',
				available: true,
				content: '大六壬结构化快照',
			}),
			expect.objectContaining({
				key: 'qimen',
				available: true,
				content: '奇门遁甲结构化快照',
			}),
		]));
	});

	test('getAnalysisTechniqueContexts resolves chart technique snapshots from module cache', async ()=>{
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const contexts = await getAnalysisTechniqueContexts(chartSource, ['primarydirect']);

		expect(contexts).toEqual([
			expect.objectContaining({
				key: 'primarydirect',
				available: true,
				content: '主限法结构化快照',
			}),
		]);
	});

	test('getAnalysisSourceContext reuses matching stored astro snapshot before live fetch', async ()=>{
		mockLoadAstroAISnapshot.mockReturnValue({
			content: '已保存的星盘结构化快照',
			signature: 'chart-any|2026-04-04 10:00:00|+08:00|118e27|31n38|Tropical|Placidus|1|0',
		});
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const context = await getAnalysisSourceContext(chartSource, { preferCache: false });

		expect(context.content).toBe('已保存的星盘结构化快照');
		expect(context.meta).toMatchObject({
			reusedStoredSnapshot: true,
		});
	});

	test('chart techniques reuse matching stored astro snapshot on technique-only load', async ()=>{
		mockLoadAstroAISnapshot.mockReturnValue({
			content: '已保存的星盘结构化快照',
			signature: 'chart-any|2026-04-04 10:00:00|+08:00|118e27|31n38|Tropical|Placidus|1|0',
		});
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const contexts = await getAnalysisTechniqueContexts(chartSource, ['astrochart'], {
			sourceContext: await getAnalysisSourceContext(chartSource, { preferCache: false, mode: 'meta' }),
		});

		expect(contexts).toEqual([
			expect.objectContaining({
				key: 'astrochart',
				available: true,
				content: '已保存的星盘结构化快照',
			}),
		]);
	});

	test('getAnalysisSourceContext auto generates case snapshot from stored payload when missing', async ()=>{
		const sources = listAnalysisSources();
		const source = sources.find((item)=>item.id === 'case-2');
		const context = await getAnalysisSourceContext(source, { preferCache: false });

		expect(context.content).toBe('自动生成的大六壬快照');
		expect(mockSaveModuleAISnapshot).toHaveBeenCalledWith(
			'liureng',
			'自动生成的大六壬快照',
			expect.objectContaining({
				date: '2026/04/04',
				time: '12:00',
			})
		);
	});

	test('getAnalysisTechniqueContexts auto generates missing case technique snapshot and saves it', async ()=>{
		const sources = listAnalysisSources();
		const source = sources.find((item)=>item.id === 'case-2');
		const contexts = await getAnalysisTechniqueContexts(source, ['liureng']);

		expect(contexts).toEqual([
			expect.objectContaining({
				key: 'liureng',
				available: true,
				content: '自动生成的大六壬快照',
			}),
		]);
		expect(mockSaveModuleAISnapshot).toHaveBeenCalledWith(
			'liureng',
			'自动生成的大六壬快照',
			expect.objectContaining({
				generatedFromStoredCase: true,
			})
		);
	});

	test('recasts time-castable case techniques from case time when payload empty; 六爻无存卦时也按时间起卦补(本 mock 历法不全→优雅 missing)', async ()=>{
		const sources = listAnalysisSources();
		const source = sources.find((item)=>item.id === 'case-3');
		const contexts = await getAnalysisTechniqueContexts(source, ['liureng', 'qimen', 'taiyi', 'sixyao']);
		const byKey = Object.fromEntries(contexts.map((c)=>[c.key, c]));

		// 时间确定式法（六壬/奇门/太乙）：payload 缺失时按本案例起课时间 + 默认【即时补算】，
		// 像命盘一样而非显示「未挂载」。
		expect(byKey.liureng).toEqual(expect.objectContaining({ available: true, status: 'ready' }));
		expect(byKey.qimen).toEqual(expect.objectContaining({ available: true, status: 'ready' }));
		expect(byKey.taiyi).toEqual(expect.objectContaining({ available: true, status: 'ready' }));
		// 补算的快照 meta 带 regeneratedFromCaseTime 标记（来源可追溯）
		expect(byKey.liureng.meta).toEqual(expect.objectContaining({ regeneratedFromCaseTime: true }));
		// 六爻（用户拍板放开护栏）：已存 payload.gua 优先；无存卦时按起课时间「时间起卦」补（确定性、非伪造摇卦）。
		// 本 mock 的起课时间历法不全 → regenerateSixyaoSnapshot 的 buildTimeGua 取不到卦 → 兜底返 '' → 此例仍 missing（不崩）。
		// 生产环境（真历法）此处会时间起卦补出六爻盘。六爻仍**不进** TIME_CASTABLE_DIVINATION（preflight[24] 护栏在）。
		expect(byKey.sixyao).toEqual(expect.objectContaining({ available: false, status: 'missing', content: '' }));
	});

	test('getAnalysisTechniqueContexts uses only the selected chart technique snapshot', async ()=>{
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const contexts = await getAnalysisTechniqueContexts(chartSource, ['bazi']);

		expect(contexts).toEqual([
			expect.objectContaining({
				key: 'bazi',
				available: true,
				content: '八字结构化快照',
			}),
		]);
		expect(contexts[0].content).not.toContain('紫微');
		expect(mockSaveModuleAISnapshot).not.toHaveBeenCalledWith(
			'bazi',
			expect.any(String),
			expect.objectContaining({
				generatedFromBaseChart: true,
			})
		);
	});

	test('getAnalysisTechniqueContexts does not fall back to generic chart snapshot for unrelated chart techniques', async ()=>{
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const contexts = await getAnalysisTechniqueContexts(chartSource, ['cntradition'], {
			sourceContext: {
				content: '基础命盘结构化快照',
			},
		});

		expect(contexts).toEqual([
			expect.objectContaining({
				key: 'cntradition',
				available: false,
				content: '',
				status: 'missing',
			}),
		]);
	});

	test('each chart technique selection mounts only its own content or stays missing', async ()=>{
		const sources = listAnalysisSources();
		const chartSource = sources.find((item)=>item.sourceType === 'chart');
		const expectedByTechnique = {
			astrochart: 'snapshot',
			astrochart_like: 'snapshot',
			indiachart: '印度律盘结构化快照',
			relative: '关系盘结构化快照',
			guolao: '七政四余结构化快照',
			germany: '量化盘结构化快照',
			jieqi: '节气盘结构化快照',
			jieqi_meta: '节气盘参数结构化快照',
			jieqi_chunfen: '节气盘春分快照',
			jieqi_xiazhi: '节气盘夏至快照',
			jieqi_qiufen: '节气盘秋分快照',
			jieqi_dongzhi: '节气盘冬至快照',
			primarydirect: '主限法结构化快照',
			primarydirchart: '主限法结构化快照',
			firdaria: '',
			planetaryages: '',
			balbillus: '',
			bazi: '八字结构化快照',
			ziwei: '紫微斗数结构化快照',
			suzhan: '宿占结构化快照',
			otherbu: '西洋游戏结构化快照',
			fengshui: '风水结构化快照',
		};
		for(const key of ANALYSIS_CHART_TECHNIQUES){
			// eslint-disable-next-line no-await-in-loop
			const contexts = await getAnalysisTechniqueContexts(chartSource, [key], {
				sourceContext: await getAnalysisSourceContext(chartSource, { preferCache: false, mode: 'meta' }),
			});
			expect(contexts).toHaveLength(1);
			expect(contexts[0].key).toBe(key);
			if(expectedByTechnique[key] !== undefined){
				expect(contexts[0].available).toBe(true);
				if(expectedByTechnique[key]){
					expect(contexts[0].content).toContain(expectedByTechnique[key]);
				}else{
					expect(contexts[0].content).not.toBe('');
				}
			}else{
				expect({ key, available: contexts[0].available }).toEqual({ key, available: false });
				expect({ key, status: contexts[0].status }).toEqual({ key, status: 'missing' });
			}
		}
	});

	test('each case technique selection mounts only explicitly stored payload content', async ()=>{
		const sources = listAnalysisSources();
		const caseSource = sources.find((item)=>item.id === 'case-1');
		const expectedByTechnique = {
			liureng: '大六壬结构化快照',
			qimen: '奇门遁甲结构化快照',
			sanshiunited: '这是缓存的 AI 导出文本',
		};
		for(const key of ANALYSIS_CASE_TECHNIQUES){
			// eslint-disable-next-line no-await-in-loop
			const contexts = await getAnalysisTechniqueContexts(caseSource, [key], {
				sourceContext: await getAnalysisSourceContext(caseSource, { preferCache: false, mode: 'meta' }),
			});
			expect(contexts).toHaveLength(1);
			expect(contexts[0].key).toBe(key);
			if(expectedByTechnique[key]){
				// 本案例 payload 显式存了该技法 → 用存盘内容
				expect(contexts[0].available).toBe(true);
				expect(contexts[0].content).toContain(expectedByTechnique[key]);
			}else if(TIME_CASTABLE_DIVINATION.includes(key)){
				// 时间确定式法未存 payload → 按本案例起课时间自动补算
				expect(contexts[0].available).toBe(true);
				expect(contexts[0].status).toBe('ready');
			}else{
				// 六爻/统摄法/宿占等非纯时间可推 → 无 payload 即缺失（不伪造卦象）
				expect(contexts[0].available).toBe(false);
				expect(contexts[0].status).toBe('missing');
			}
		}
	});

	test('getAnalysisSourceContext returns metadata-only case context when technique mode is active', async ()=>{
		const sources = listAnalysisSources();
		const source = sources.find((item)=>item.id === 'case-1');
		const context = await getAnalysisSourceContext(source, {
			preferCache: false,
			mode: 'meta',
		});

		expect(context.content).toContain('案例名称：测试事盘');
		expect(context.content).not.toContain('大六壬结构化快照');
		expect(context.content).not.toContain('奇门遁甲结构化快照');
	});

	test('getAnalysisSourceContext returns metadata-only chart context when technique mode is active', async ()=>{
		const sources = listAnalysisSources();
		const source = sources.find((item)=>item.sourceType === 'chart');
		const context = await getAnalysisSourceContext(source, {
			preferCache: false,
			mode: 'meta',
		});

		expect(context.content).toContain('命盘名称：测试命盘');
		expect(context.content).toContain('出生时间：2026-04-04 10:00:00');
		expect(context.content).not.toContain('snapshot');
	});
});
