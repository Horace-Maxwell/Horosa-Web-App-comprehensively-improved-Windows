// 天文馆两条真机合同:
// 一、时间输入面板必须挂到 body —— 留在左栏里,左栏的滚动合成层会按栏宽把它裁掉(实机只剩半截;重绘式截图 / 命中测试都看不出来)。
// 二、空格键 = 暂停 / 回到上一次选的速率;只在打字、弹层开着、焦点由 Tab 键走到控件上时不接管。
//    (桌面壳里点过页内非画布处之后,焦点落在外层页签面板上 —— 那是本页的容器,照样接管。)
import path from 'path';
const fs = require('fs');
const { readSource, sourceSetFiles } = require('../../../utils/__tests__/helpers/sourceSet');
const { importsName } = require('../../../utils/__tests__/helpers/importSpecs');   // 按 AST 读 import
const { spaceTogglesPlayback, isTextEntryTarget, playbackHotkeyControlOf } = require('../babylon/playbackHotkey');

const RAW = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function methodBody(name){
	const start = SRC.indexOf(`\n\t${name}(`);
	expect(start).toBeGreaterThan(-1);
	const end = SRC.indexOf('\n\t}\n', start);
	expect(end).toBeGreaterThan(start);
	return SRC.slice(start, end);
}

describe('天文馆时间输入面板挂 body', ()=>{
	test('面板经 createPortal 渲染到 document.body', ()=>{
		// 用到 createPortal 的那个文件自己从 react-dom 导入它(门面拆成子模块后逐个文件问)
		const users = sourceSetFiles(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'))
			.map((f)=>fs.readFileSync(f, 'utf8'))
			.filter((text)=>text.indexOf('className="planetarium-time-editor"') >= 0);
		expect(users.length).toBe(1);
		expect(importsName(users[0], { name: 'createPortal', from: 'react-dom' })).toBe(true);
		const at = SRC.indexOf('className="planetarium-time-editor"');
		expect(at).toBeGreaterThan(-1);
		expect(SRC.indexOf('className="planetarium-time-editor"', at + 1)).toBe(-1);
		const before = SRC.slice(Math.max(0, at - 260), at);
		const after = SRC.slice(at, at + 520);
		expect(before).toMatch(/createPortal\(\s*<div ref=\{this\._timeEditorRef\}\s*$/);
		expect(after).toMatch(/<\/div>,\s*document\.body\s*\)/);
	});
	test('落点仍按时间显示元素实时换算(fixed 域),外点关闭仍认面板自身', ()=>{
		const body = methodBody('toggleTimeEditor');
		expect(body).toMatch(/fixedPopupFrame\(\)/);
		expect(body).toMatch(/this\._timeDisplayRef\.current\.getBoundingClientRect\(\)/);
		expect(methodBody('_onTimeEditorDocMouseDown')).toMatch(/this\._timeEditorRef\.current/);
	});
	test('面板层级压过左右栏、但低于 antd 浮层(1050):面板里下拉的选项列表也挂 body,不能被面板自己盖住', ()=>{
		const less = fs.readFileSync(path.resolve(__dirname, '..', 'planetarium.less'), 'utf8');
		const m = less.match(/\.planetarium-time-editor \{[^}]*?z-index: (\d+);/);
		expect(m).toBeTruthy();
		const z = Number(m[1]);
		expect(z).toBeGreaterThan(100);
		expect(z).toBeLessThan(1050);
	});
});

describe('天文馆空格键暂停 / 恢复', ()=>{
	test('挂载时在捕获阶段接键、卸载时摘键', ()=>{
		const mount = methodBody('componentDidMount');
		const unmount = methodBody('componentWillUnmount');
		['keydown\', this._onPlaybackKeyDown', 'keyup\', this._onPlaybackKeyUp', 'pointerdown\', this._onPlaybackPointerDown', 'mousedown\', this._onPlaybackPointerDown'].forEach((pair)=>{
			expect(mount).toContain(`document.addEventListener('${pair}, true);`);
			expect(unmount).toContain(`document.removeEventListener('${pair}, true);`);
		});
	});
	test('非零速率进 changeSpeed 就记下;空格在「暂停 ↔ 上次速率」间切,从没播过按 1x', ()=>{
		expect(methodBody('changeSpeed')).toMatch(/if\(speed\)\{ this\.lastPlaySpeed = speed; \}/);
		const down = methodBody('_onPlaybackKeyDown');
		expect(down).toMatch(/e\.preventDefault\(\);/);
		expect(down).toMatch(/if\(e\.repeat\)\{ return; \}/);
		expect(down).toMatch(/this\.changeSpeed\(this\.state\.speed !== 0 \? 0 : \(this\.lastPlaySpeed \|\| 1\)\);/);
	});
	test('Tab 键记「键盘走焦点」,鼠标按下清掉;焦点留在控件上时连它自己的键盘处理一起拦', ()=>{
		const down = methodBody('_onPlaybackKeyDown');
		expect(down).toMatch(/if\(e && e\.key === 'Tab'\)\{ this\._focusByKeyboard = true; return; \}/);
		expect(down).toMatch(/this\._spaceKeyOnControl = !!playbackHotkeyControlOf\(e\.target\);/);
		expect(down).toMatch(/if\(this\._spaceKeyOnControl\)\{ e\.stopPropagation\(\); \}/);
		expect(methodBody('_onPlaybackPointerDown')).toMatch(/this\._focusByKeyboard = false;/);
		expect(methodBody('_spaceTogglesPlayback')).toMatch(/spaceTogglesPlayback\(e, this\._pageRef\.current, this\._focusByKeyboard === true\)/);
		const up = methodBody('_onPlaybackKeyUp');
		expect(up).toMatch(/e\.preventDefault\(\);/);
		expect(up).toMatch(/if\(this\._spaceKeyOnControl\)\{ e\.stopPropagation\(\); \}/);
	});
	test('Esc 收起时间输入面板;面板里的下拉 / 日期弹层开着时先让给它们', ()=>{
		const down = methodBody('_onPlaybackKeyDown');
		expect(down).toMatch(/e\.key === 'Escape' && this\.state\.timeEditorOpen && !e\.defaultPrevented && !e\.isComposing/);
		expect(down).toMatch(/if\(!document\.querySelector\(PLAYBACK_HOTKEY_OPEN_POPUPS\)\)\{ this\._closeTimeEditor\(\); \}/);
		const { PLAYBACK_HOTKEY_OPEN_POPUPS } = require('../babylon/playbackHotkey');
		expect(PLAYBACK_HOTKEY_OPEN_POPUPS).toContain('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
		expect(PLAYBACK_HOTKEY_OPEN_POPUPS).toContain('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
	});
});

// 接管判定:按桌面壳里真实的焦点落点逐个过
describe('空格键接管判定', ()=>{
	let rectSpy;
	let host;
	const space = (target, extra)=>({ code: 'Space', key: ' ', target, defaultPrevented: false, isComposing: false, ...(extra || {}) });

	beforeEach(()=>{
		// jsdom 不做布局:按名单回答「看不看得见」
		rectSpy = jest.spyOn(Element.prototype, 'getClientRects').mockImplementation(function(){
			let el = this;
			while(el){
				if(el.hasAttribute && el.hasAttribute('data-hidden')){ return []; }
				el = el.parentElement;
			}
			return [{ width: 10, height: 10 }];
		});
		host = document.createElement('div');
		host.innerHTML = `
			<div id="nav" role="tab" tabindex="0">天文馆</div>
			<button id="topbtn">顶栏按钮</button>
			<div id="pane" role="tabpanel" tabindex="0" class="ant-tabs-tabpane ant-tabs-tabpane-active">
				<div id="page" class="horosa-planetarium-page">
					<canvas id="canvas" tabindex="1"></canvas>
					<div id="title">观测设置</div>
					<button id="speed">10x</button>
					<input id="search" />
					<input id="mag" type="range" />
					<input id="ro" class="ant-select-selection-search-input" readonly />
					<textarea id="note"></textarea>
					<div id="rich" contenteditable="true"><span id="richIn">字</span></div>
				</div>
			</div>
			<div id="other" class="ant-tabs-tabpane" data-hidden="1"><div id="otherPage"></div></div>
		`;
		document.body.appendChild(host);
	});
	afterEach(()=>{
		rectSpy.mockRestore();
		host.remove();
		document.querySelectorAll('.t-overlay').forEach((n)=>n.remove());
	});
	const $ = (id)=>document.getElementById(id);
	const page = ()=>$('page');

	test('焦点在 body / 画布 / 页内非控件:接管', ()=>{
		expect(spaceTogglesPlayback(space(document.body), page(), false)).toBe(true);
		expect(spaceTogglesPlayback(space(document.documentElement), page(), false)).toBe(true);
		expect(spaceTogglesPlayback(space($('canvas')), page(), false)).toBe(true);
		expect(spaceTogglesPlayback(space($('title')), page(), false)).toBe(true);
	});

	test('焦点落在外层页签面板(带 tabindex 的祖先):接管 —— 桌面壳里点过页内任何非画布处之后就是这个状态', ()=>{
		expect($('pane').contains(page())).toBe(true);
		expect(spaceTogglesPlayback(space($('pane')), page(), false)).toBe(true);
		// 用 Tab 键走到面板上也一样:面板不是可激活控件
		expect(spaceTogglesPlayback(space($('pane')), page(), true)).toBe(true);
	});

	test('鼠标点过之后留在控件上的焦点:接管(速率钮、滑块、下拉的只读输入框、顶栏页签 / 按钮)', ()=>{
		['speed', 'mag', 'ro', 'nav', 'topbtn'].forEach((id)=>{
			expect(spaceTogglesPlayback(space($(id)), page(), false)).toBe(true);
			expect(playbackHotkeyControlOf($(id))).toBe($(id));
		});
	});

	test('用 Tab 键走到的控件:空格归控件', ()=>{
		['speed', 'mag', 'ro', 'nav', 'topbtn'].forEach((id)=>{
			expect(spaceTogglesPlayback(space($(id)), page(), true)).toBe(false);
		});
		// 画布、标题不是可激活控件
		expect(spaceTogglesPlayback(space($('canvas')), page(), true)).toBe(true);
		expect(playbackHotkeyControlOf($('title'))).toBe(null);
	});

	test('正在打字:不接管(输入框 / 文本域 / 可编辑区);只读、滑块不算打字', ()=>{
		['search', 'note', 'rich', 'richIn'].forEach((id)=>{
			expect(isTextEntryTarget($(id))).toBe(true);
			expect(spaceTogglesPlayback(space($(id)), page(), false)).toBe(false);
		});
		['ro', 'mag', 'speed', 'pane'].forEach((id)=>expect(isTextEntryTarget($(id))).toBe(false));
	});

	test('弹窗 / 抽屉 / 下拉 / 时间面板开着:不接管;关着(藏起)的不拦', ()=>{
		const cases = [
			['ant-modal-wrap', '<div class="ant-modal" role="dialog"><button id="ok">确定</button></div>'],
			['ant-drawer ant-drawer-open', ''],
			['ant-select-dropdown', ''],
			['ant-picker-dropdown', ''],
			['ant-dropdown', ''],
			['planetarium-time-editor', ''],
		];
		cases.forEach(([cls, inner])=>{
			const el = document.createElement('div');
			el.className = `${cls} t-overlay`;
			el.innerHTML = inner;
			document.body.appendChild(el);
			expect(spaceTogglesPlayback(space(document.body), page(), false)).toBe(false);
			expect(spaceTogglesPlayback(space($('pane')), page(), false)).toBe(false);
			// 藏起(display:none)之后恢复接管
			el.setAttribute('data-hidden', '1');
			expect(spaceTogglesPlayback(space(document.body), page(), false)).toBe(true);
			el.remove();
		});
		// 带「已隐藏」类名的下拉不拦
		['ant-select-dropdown ant-select-dropdown-hidden', 'ant-picker-dropdown ant-picker-dropdown-hidden', 'ant-dropdown ant-dropdown-hidden', 'ant-drawer'].forEach((cls)=>{
			const el = document.createElement('div');
			el.className = `${cls} t-overlay`;
			document.body.appendChild(el);
			expect(spaceTogglesPlayback(space(document.body), page(), false)).toBe(true);
			el.remove();
		});
		// 目标在弹层里(哪怕弹层类名不在「开着」名单上,如气泡卡片)
		const pop = document.createElement('div');
		pop.className = 'ant-popover t-overlay';
		pop.innerHTML = '<span id="inpop">内容</span>';
		document.body.appendChild(pop);
		expect(spaceTogglesPlayback(space($('inpop')), page(), false)).toBe(false);
		expect(spaceTogglesPlayback(space(document.body), page(), false)).toBe(true);
	});

	test('带修饰键、输入法组字中、已被处理、不是空格、页被藏起:不接管', ()=>{
		['ctrlKey', 'metaKey', 'altKey', 'shiftKey'].forEach((k)=>{
			expect(spaceTogglesPlayback(space(document.body, { [k]: true }), page(), false)).toBe(false);
		});
		expect(spaceTogglesPlayback(space(document.body, { isComposing: true }), page(), false)).toBe(false);
		expect(spaceTogglesPlayback(space(document.body, { defaultPrevented: true }), page(), false)).toBe(false);
		expect(spaceTogglesPlayback({ code: 'KeyA', key: 'a', target: document.body }, page(), false)).toBe(false);
		expect(spaceTogglesPlayback(space(document.body), $('otherPage'), false)).toBe(false);
		expect(spaceTogglesPlayback(space(document.body), null, false)).toBe(false);
	});
});
