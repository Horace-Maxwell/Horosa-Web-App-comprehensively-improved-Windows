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
