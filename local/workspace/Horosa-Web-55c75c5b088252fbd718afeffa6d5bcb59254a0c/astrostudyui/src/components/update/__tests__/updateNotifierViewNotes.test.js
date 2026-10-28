// 更新提示「查看更新内容 / 打开发布页」:桌面 webview 不处理新窗口,裸 window.open 会被吞掉(点了没反应)。
// 必须走 openExternalUrl(壳的外链命令;网页端它自己回落 window.open)。
const mockOpenExternalUrl = jest.fn(()=>Promise.resolve(true));
jest.mock('../../../utils/aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: ()=>false,
	updateCheckSilent: jest.fn(),
	updateStartBackground: jest.fn(),
	updateInstallAndRestart: jest.fn(),
	openExternalUrl: (...args)=>mockOpenExternalUrl(...args),
}));
jest.mock('../UpdateNotifier.less', ()=>({}), { virtual: true });

import UpdateNotifier from '../UpdateNotifier';

describe('UpdateNotifier · 查看更新内容', ()=>{
	let openSpy;
	beforeEach(()=>{
		mockOpenExternalUrl.mockClear();
		openSpy = jest.spyOn(window, 'open').mockImplementation(()=>null);
	});
	afterEach(()=>{
		openSpy.mockRestore();
	});

	test('有发布页地址:交给 openExternalUrl,不直接调 window.open', ()=>{
		const un = new UpdateNotifier({});
		un.state = { ...un.state, releaseUrl: 'https://example.com/releases/tag/v1' };
		un.onViewNotes();
		expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1);
		expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/releases/tag/v1');
		expect(openSpy).not.toHaveBeenCalled();
	});

	test('没有发布页地址:什么都不做', ()=>{
		const un = new UpdateNotifier({});
		un.state = { ...un.state, releaseUrl: '' };
		un.onViewNotes();
		expect(mockOpenExternalUrl).not.toHaveBeenCalled();
		expect(openSpy).not.toHaveBeenCalled();
	});

	test('绑定在实例上(按钮直接挂 this.onViewNotes)', ()=>{
		const un = new UpdateNotifier({});
		un.state = { ...un.state, releaseUrl: 'https://example.com/r' };
		const handler = un.onViewNotes;
		handler();
		expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/r');
	});
});
