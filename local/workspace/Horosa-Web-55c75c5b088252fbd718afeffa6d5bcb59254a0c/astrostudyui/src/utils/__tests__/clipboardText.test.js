// clipboardText.copyTextSmart 三级降级契约测试。
// tier① 的 invoke 命令名是「前后端契约锚」:壳侧 main.rs 注册同名 copy_text_to_clipboard_command,
// 参数形如 { text } —— 字面断言防前后端漂移;新壳+老前端 / 老壳+新前端互兼容全靠这条契约不动。
import { copyTextSmart } from '../clipboardText';

function setTauriInvoke(fn){
	window.__TAURI__ = { core: { invoke: fn } };
}
function setClipboard(writeText){
	Object.defineProperty(window.navigator, 'clipboard', {
		value: writeText ? { writeText } : undefined,
		configurable: true,
	});
}
function setSecureContext(v){
	// writable:true 必带:jsdom Window 代理对「重定义不可写 value 属性」静默失败(返 false 不抛),
	// 缺它则首次 define 后取值被冻住,true→false 切换全部无效(本套件第 5 例曾因此假红)。
	Object.defineProperty(window, 'isSecureContext', { value: v, configurable: true, writable: true });
}

describe('copyTextSmart 三级降级', ()=>{
	afterEach(()=>{
		delete window.__TAURI__;
		setClipboard(null);
		setSecureContext(false);
		delete document.execCommand;
	});

	test('tier①桌面桥成功:invoke 命令名/参数字面契约,且不再触碰 navigator.clipboard', async ()=>{
		const invoke = jest.fn().mockResolvedValue(undefined);
		setTauriInvoke(invoke);
		const writeText = jest.fn();
		setClipboard(writeText);
		setSecureContext(true);
		await expect(copyTextSmart('技术·測試 ✓')).resolves.toBe(true);
		expect(invoke).toHaveBeenCalledWith('copy_text_to_clipboard_command', { text: '技术·測試 ✓' });
		expect(writeText).not.toHaveBeenCalled();
	});

	test('null/undefined 正常化为空串(桥收到 { text: "" },不炸)', async ()=>{
		const invoke = jest.fn().mockResolvedValue(undefined);
		setTauriInvoke(invoke);
		await expect(copyTextSmart(null)).resolves.toBe(true);
		expect(invoke).toHaveBeenCalledWith('copy_text_to_clipboard_command', { text: '' });
	});

	test('tier①拒绝(老壳无命令)→ 落 tier② navigator.clipboard', async ()=>{
		setTauriInvoke(jest.fn().mockRejectedValue(new Error('unknown command')));
		const writeText = jest.fn().mockResolvedValue(undefined);
		setClipboard(writeText);
		setSecureContext(true);
		await expect(copyTextSmart('abc')).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('abc');
	});

	test('tier②拒绝(焦点散/权限)→ 落 tier③ execCommand,textarea 建删对称', async ()=>{
		setClipboard(jest.fn().mockRejectedValue(new Error('NotAllowedError')));
		setSecureContext(true);
		document.execCommand = jest.fn(()=>{
			// execCommand 时刻 textarea 必须在场且已选中
			expect(document.querySelectorAll('textarea').length).toBe(1);
			return true;
		});
		await expect(copyTextSmart('xyz')).resolves.toBe(true);
		expect(document.execCommand).toHaveBeenCalledWith('copy');
		expect(document.querySelectorAll('textarea').length).toBe(0);
	});

	test('非安全上下文跳过 tier②(不误触 writeText),直接 tier③', async ()=>{
		const writeText = jest.fn();
		setClipboard(writeText);
		setSecureContext(false);
		document.execCommand = jest.fn(()=>true);
		await expect(copyTextSmart('n')).resolves.toBe(true);
		expect(writeText).not.toHaveBeenCalled();
	});

	test('全级失败 → 返回 false 绝不 throw,DOM 无残留', async ()=>{
		setTauriInvoke(jest.fn().mockRejectedValue(new Error('no bridge')));
		setClipboard(jest.fn().mockRejectedValue(new Error('denied')));
		setSecureContext(true);
		document.execCommand = jest.fn(()=>false);
		await expect(copyTextSmart('fail')).resolves.toBe(false);
		expect(document.querySelectorAll('textarea').length).toBe(0);
	});
});
