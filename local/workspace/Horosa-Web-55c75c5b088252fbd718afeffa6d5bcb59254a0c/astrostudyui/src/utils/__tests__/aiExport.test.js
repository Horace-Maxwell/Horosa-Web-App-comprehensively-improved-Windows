import {
	getCurrentAIExportContext,
	listAIExportTechniqueSettings,
	loadAIExportSettings,
	runAIExport,
	saveAIExportSettings,
} from '../aiExport';
import { getStore } from '../storageutil';
import { loadModuleAISnapshot } from '../moduleAiSnapshot';

jest.mock('../storageutil', ()=>({
	getStore: jest.fn(),
}));

jest.mock('../astroAiSnapshot', ()=>({
	getAstroAISnapshotForCurrent: jest.fn(()=>({ content: '[起盘信息]\n星盘快照' })),
	saveAstroAISnapshot: jest.fn(()=>null),
}));

jest.mock('../moduleAiSnapshot', ()=>({
	loadModuleAISnapshot: jest.fn(),
}));

jest.mock('../planetMetaDisplay', ()=>({
	filterPlanetMetaSuffix: (text)=>text,
	normalizePlanetMetaDisplay: (raw)=>{
		const src = raw && typeof raw === 'object' ? raw : {};
		return {
			showPostnatal: src.showPostnatal === 0 ? 0 : 1,
			showHouse: src.showHouse === 0 ? 0 : 1,
			showRuler: src.showRuler === 0 ? 0 : 1,
		};
	},
	readPlanetMetaDisplayFromStore: ()=>({
		showPostnatal: 1,
		showHouse: 1,
		showRuler: 1,
	}),
}));

function mockLiurengStore(){
	getStore.mockReturnValue({
		astro: {
			currentTab: 'cnyibu',
			currentSubTab: 'liureng',
		},
	});
}

describe('aiExport utilities', ()=>{
	beforeEach(()=>{
		jest.restoreAllMocks();
		window.localStorage.clear();
		document.body.innerHTML = '<div id="mainContent"></div>';
		mockLiurengStore();

		loadModuleAISnapshot.mockImplementation((moduleName)=>{
			if(moduleName === 'liureng'){
				return { content: '[起盘信息]\n测试内容' };
			}
			return null;
		});

		Object.defineProperty(window, 'isSecureContext', {
			value: true,
			configurable: true,
		});
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: jest.fn().mockResolvedValue(undefined),
			},
			configurable: true,
		});

		if(typeof URL.createObjectURL !== 'function'){
			URL.createObjectURL = ()=> 'blob:mock';
		}
		if(typeof URL.revokeObjectURL !== 'function'){
			URL.revokeObjectURL = ()=>{};
		}
	});

	test('save/load settings normalizes legacy liureng section names', ()=>{
		const saved = saveAIExportSettings({
			version: 1,
			sections: {
				liureng: ['起盘信息', '大格命中', '小局命中'],
			},
			planetMeta: {
				astrochart: { showHouse: 0, showRuler: 1 },
				liureng: { showHouse: 0, showRuler: 0 },
			},
			annotations: {
				astrochart: 0,
				liureng: 0,
			},
		});

		expect(saved.sections.liureng).toContain('大格');
		expect(saved.sections.liureng).toContain('小局');
		expect(saved.sections.liureng).not.toContain('大格命中');
		expect(saved.sections.liureng).not.toContain('小局命中');
		expect(saved.planetMeta.astrochart).toEqual({ showHouse: 0, showRuler: 1 });
		expect(saved.planetMeta.liureng).toBeUndefined();
		expect(saved.annotations.astrochart).toBe(0);
		expect(saved.annotations.liureng).toBeUndefined();

		const loaded = loadAIExportSettings();
		expect(loaded).toEqual(saved);
	});

	test('getCurrentAIExportContext and settings list are available under store fallback', ()=>{
		const context = getCurrentAIExportContext();
		expect(context.key).toBe('liureng');
		expect(context.displayName).toBe('大六壬');

		const list = listAIExportTechniqueSettings();
		const liureng = list.find((item)=>item.key === 'liureng');
		expect(liureng).toBeTruthy();
		expect(liureng.label).toBe('六壬');
		expect(Array.isArray(liureng.options)).toBe(true);
	});

	test('all AI export techniques expose stable settings metadata', ()=>{
		const list = listAIExportTechniqueSettings();
		const keys = list.map((item)=>item.key);
		expect(new Set(keys).size).toBe(keys.length);
		list.forEach((item)=>{
			expect(item.label).toBeTruthy();
			expect(Array.isArray(item.options)).toBe(true);
			expect(item.options.length).toBeGreaterThan(0);
			if(item.supportsPlanetInfo){
				expect(item.planetInfo).toEqual({
					showHouse: expect.any(Number),
					showRuler: expect.any(Number),
				});
			}
			if(item.supportsAstroMeaning){
				expect(item.astroMeaning).toEqual({
					enabled: expect.any(Number),
				});
				expect(item.astroMeaningTitle).toBeTruthy();
				expect(item.astroMeaningCheckbox).toBeTruthy();
			}
		});
	});

	test('context mapping matrix across major tabs and copy export path', async ()=>{
		loadModuleAISnapshot.mockImplementation((moduleName)=>{
			if(moduleName === 'jieqi_current'){
				return { content: '[节气盘参数]\n节气快照' };
			}
			return { content: '[起盘信息]\n统一快照' };
		});

		const contextCases = [
			{ tab: 'astrochart', subTab: '', key: 'astrochart' },
			{ tab: 'astrochart3D', subTab: '', key: 'astrochart' },
			{ tab: 'direction', subTab: 'primarydirect', key: 'primarydirect' },
			{ tab: 'direction', subTab: 'zodialrelease', key: 'zodialrelease' },
			{ tab: 'direction', subTab: 'firdaria', key: 'firdaria' },
			{ tab: 'direction', subTab: 'profection', key: 'profection' },
			{ tab: 'direction', subTab: 'solararc', key: 'solararc' },
			{ tab: 'direction', subTab: 'solarreturn', key: 'solarreturn' },
			{ tab: 'direction', subTab: 'lunarreturn', key: 'lunarreturn' },
			{ tab: 'direction', subTab: 'givenyear', key: 'givenyear' },
			{ tab: 'germanytech', subTab: '', key: 'germany' },
			{ tab: 'relativechart', subTab: '', key: 'relative' },
			{ tab: 'jieqichart', subTab: '', key: 'jieqi_meta' },
			{ tab: 'locastro', subTab: '', key: 'astrochart_like' },
			{ tab: 'hellenastro', subTab: '', key: 'astrochart_like' },
			{ tab: 'guolao', subTab: '', key: 'guolao' },
			{ tab: 'indiachart', subTab: '', key: 'indiachart' },
			{ tab: 'cntradition', subTab: 'bazi', key: 'bazi' },
			{ tab: 'cntradition', subTab: 'ziwei', key: 'ziwei' },
			{ tab: 'cnyibu', subTab: 'guazhan', key: 'sixyao' },
			{ tab: 'cnyibu', subTab: 'tongshefa', key: 'tongshefa' },
			{ tab: 'cnyibu', subTab: 'liureng', key: 'liureng' },
			{ tab: 'cnyibu', subTab: 'jinkou', key: 'jinkou' },
			{ tab: 'cnyibu', subTab: 'dunjia', key: 'qimen' },
			{ tab: 'cnyibu', subTab: 'taiyi', key: 'taiyi' },
			{ tab: 'otherbu', subTab: '', key: 'otherbu' },
			{ tab: 'fengshui', subTab: '', key: 'fengshui' },
			{ tab: 'sanshiunited', subTab: '', key: 'sanshiunited' },
		];

		for(let i=0; i<contextCases.length; i++){
			const item = contextCases[i];
			getStore.mockReturnValue({
				astro: {
					currentTab: item.tab,
					currentSubTab: item.subTab,
				},
			});

			const context = getCurrentAIExportContext();
			expect(context.key).toBe(item.key);

			const exportResult = await runAIExport('copy');
			expect(exportResult.ok).toBe(true);
		}
	});

	test('store fallback overrides stale DOM tab context from hidden panes', ()=>{
		document.body.innerHTML = `
			<div id="mainContent">
				<div class="ant-tabs ant-tabs-left">
					<div class="ant-tabs-nav">
						<div class="ant-tabs-tab ant-tabs-tab-active">量化盘</div>
						<div class="ant-tabs-tab">关系盘</div>
						<div class="ant-tabs-tab">节气盘</div>
						<div class="ant-tabs-tab">易与三式</div>
					</div>
					<div class="ant-tabs-content-holder">
						<div class="ant-tabs-content">
							<div class="ant-tabs-tabpane ant-tabs-tabpane-active">
								<div class="ant-tabs">
									<div class="ant-tabs-nav">
										<div class="ant-tabs-tab ant-tabs-tab-active">行星中点</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;

		getStore.mockReturnValue({
			astro: {
				currentTab: 'relativechart',
				currentSubTab: '',
			},
		});
		expect(getCurrentAIExportContext()).toEqual({
			key: 'relative',
			displayName: '关系盘',
		});

		getStore.mockReturnValue({
			astro: {
				currentTab: 'jieqichart',
				currentSubTab: '',
			},
		});
		expect(getCurrentAIExportContext()).toEqual({
			key: 'jieqi_meta',
			displayName: '节气盘',
		});

		document.body.innerHTML = `
			<div id="mainContent">
				<div class="ant-tabs ant-tabs-left">
					<div class="ant-tabs-nav">
						<div class="ant-tabs-tab">量化盘</div>
						<div class="ant-tabs-tab ant-tabs-tab-active">易与三式</div>
					</div>
					<div class="ant-tabs-content-holder">
						<div class="ant-tabs-content">
							<div class="ant-tabs-tabpane ant-tabs-tabpane-active">
								<div class="ant-tabs">
									<div class="ant-tabs-nav">
										<div class="ant-tabs-tab ant-tabs-tab-active">宿盘</div>
										<div class="ant-tabs-tab">易卦</div>
										<div class="ant-tabs-tab">六壬</div>
										<div class="ant-tabs-tab">金口诀</div>
										<div class="ant-tabs-tab">遁甲</div>
										<div class="ant-tabs-tab">太乙</div>
										<div class="ant-tabs-tab">统摄法</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;

		getStore.mockReturnValue({
			astro: {
				currentTab: 'cnyibu',
				currentSubTab: 'dunjia',
			},
		});
		expect(getCurrentAIExportContext()).toEqual({
			key: 'qimen',
			displayName: '奇门遁甲',
		});

		getStore.mockReturnValue({
			astro: {
				currentTab: 'cnyibu',
				currentSubTab: 'liureng',
			},
		});
		expect(getCurrentAIExportContext()).toEqual({
			key: 'liureng',
			displayName: '大六壬',
		});

		document.body.innerHTML = `
			<div id="mainContent">
				<div class="ant-tabs ant-tabs-left">
					<div class="ant-tabs-nav">
						<div class="ant-tabs-tab ant-tabs-tab-active">八字紫微</div>
					</div>
					<div class="ant-tabs-content-holder">
						<div class="ant-tabs-content">
							<div class="ant-tabs-tabpane ant-tabs-tabpane-active">
								<div class="ant-tabs ant-tabs-right">
									<div class="ant-tabs-nav">
										<div class="ant-tabs-tab">八字</div>
										<div class="ant-tabs-tab ant-tabs-tab-active">紫微斗数</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;

		getStore.mockReturnValue({
			astro: {
				currentTab: 'cntradition',
				currentSubTab: '',
			},
		});
		expect(getCurrentAIExportContext()).toEqual({
			key: 'ziwei',
			displayName: '紫微斗数',
		});
	});

	test('runAIExport(copy) copies normalized payload text', async ()=>{
		const result = await runAIExport('copy');
		expect(result.ok).toBe(true);
		expect(result.message).toBe('AI纯文字已复制。');
		expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
		const copied = navigator.clipboard.writeText.mock.calls[0][0];
		expect(copied).toContain('技术: 大六壬');
		expect(copied).toContain('测试内容');
		expect(copied).toContain('========== 内容开始 ==========');
		expect(copied).toContain('========== 内容结束 ==========');
	});

	test('astrochart3D export keeps canonical 星盘 header', async ()=>{
		getStore.mockReturnValue({
			astro: {
				currentTab: 'astrochart3D',
				currentSubTab: '',
			},
		});

		const result = await runAIExport('copy');
		expect(result.ok).toBe(true);
		const copied = navigator.clipboard.writeText.mock.calls[navigator.clipboard.writeText.mock.calls.length - 1][0];
		expect(copied).toContain('技术: 星盘');
		expect(copied).not.toContain('技术: 三维盘');
	});

	test('locastro export keeps canonical 希腊/星体地图 header', async ()=>{
		getStore.mockReturnValue({
			astro: {
				currentTab: 'locastro',
				currentSubTab: '',
			},
		});

		const result = await runAIExport('copy');
		expect(result.ok).toBe(true);
		const copied = navigator.clipboard.writeText.mock.calls[navigator.clipboard.writeText.mock.calls.length - 1][0];
		expect(copied).toContain('技术: 希腊/星体地图');
		expect(copied).not.toContain('技术: 星体地图');
	});

	test('suzhan export keeps canonical 宿占 header', async ()=>{
		getStore.mockReturnValue({
			astro: {
				currentTab: 'cnyibu',
				currentSubTab: 'suzhan',
			},
		});

		loadModuleAISnapshot.mockImplementation((moduleName)=>{
			if(moduleName === 'suzhan'){
				return { content: '[起盘信息]\n宿盘快照' };
			}
			return null;
		});

		const result = await runAIExport('copy');
		expect(result.ok).toBe(true);
		const copied = navigator.clipboard.writeText.mock.calls[navigator.clipboard.writeText.mock.calls.length - 1][0];
		expect(copied).toContain('技术: 宿占');
		expect(copied).not.toContain('技术: 宿盘');
	});

	test('runAIExport(txt/word/pdf) executes download and print branches', async ()=>{
		const createUrlSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
		const revokeUrlSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(()=>{});
		const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(()=>{});
		const openSpy = jest.spyOn(window, 'open').mockReturnValue({
			document: {
				open: jest.fn(),
				write: jest.fn(),
				close: jest.fn(),
			},
		});

		const txtRes = await runAIExport('txt');
		const wordRes = await runAIExport('word');
		const pdfRes = await runAIExport('pdf');

		expect(txtRes.ok).toBe(true);
		expect(wordRes.ok).toBe(true);
		expect(pdfRes.ok).toBe(true);
		expect(createUrlSpy).toHaveBeenCalledTimes(2);
		expect(clickSpy).toHaveBeenCalledTimes(2);
		expect(openSpy).toHaveBeenCalledTimes(1);

		openSpy.mockRestore();
		clickSpy.mockRestore();
		revokeUrlSpy.mockRestore();
		createUrlSpy.mockRestore();
	});

	test('runAIExport(pdf) returns blocked message when popup cannot open', async ()=>{
		const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
		const result = await runAIExport('pdf');
		expect(result.ok).toBe(false);
		expect(result.message).toContain('拦截');
		openSpy.mockRestore();
	});

	test('runAIExport(all) executes copy + txt + word + pdf in one shot', async ()=>{
		const createUrlSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
		const revokeUrlSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(()=>{});
		const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(()=>{});
		const openSpy = jest.spyOn(window, 'open').mockReturnValue({
			document: {
				open: jest.fn(),
				write: jest.fn(),
				close: jest.fn(),
			},
		});

		const result = await runAIExport('all');
		expect(result.ok).toBe(true);
		expect(result.message).toContain('复制 + TXT/Word/PDF');
		expect(navigator.clipboard.writeText).toHaveBeenCalled();
		expect(createUrlSpy).toHaveBeenCalledTimes(2);
		expect(clickSpy).toHaveBeenCalledTimes(2);
		expect(openSpy).toHaveBeenCalledTimes(1);

		openSpy.mockRestore();
		clickSpy.mockRestore();
		revokeUrlSpy.mockRestore();
		createUrlSpy.mockRestore();
	});
});
