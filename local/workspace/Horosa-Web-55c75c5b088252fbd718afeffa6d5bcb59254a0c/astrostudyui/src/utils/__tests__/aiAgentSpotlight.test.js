// [批五]「AI 正在操作」高亮:总开关关=零 DOM 改动(缺省现状);开=注入一次样式、目标加类到点自摘、提示走注入的 toast;目标缺席只提示不报错。
import { spotlight, SPOTLIGHT_CLASS, SPOTLIGHT_STYLE_ID, __setSpotlightToastForTests } from '../aiAgent/agentSpotlight';
import { setAgentEnabled } from '../aiAgent/prefs';

beforeEach(()=>{ window.localStorage.clear(); document.body.innerHTML = '<div id="mainContent"></div>'; const st = document.getElementById(SPOTLIGHT_STYLE_ID); if(st){ st.remove(); } jest.useFakeTimers(); });
afterEach(()=>{ jest.useRealTimers(); setAgentEnabled(false); __setSpotlightToastForTests(null); });

it('🔴 总开关关:什么都不做(无样式、无类、无提示)', ()=>{
	const toast = jest.fn(); __setSpotlightToastForTests(toast);
	expect(spotlight({ selector: '#mainContent', label: 'x' })).toBe(false);
	expect(document.getElementById(SPOTLIGHT_STYLE_ID)).toBe(null);
	expect(document.getElementById('mainContent').classList.contains(SPOTLIGHT_CLASS)).toBe(false);
	expect(toast).not.toHaveBeenCalled();
});
it('开:样式注入一次、目标加类 1600ms 后自摘、提示带撤销回调;目标缺席回 false 仍提示', ()=>{
	setAgentEnabled(true);
	const toast = jest.fn(); __setSpotlightToastForTests(toast);
	const undo = jest.fn();
	expect(spotlight({ selector: '#mainContent', label: 'AI 已切到八字', undo })).toBe(true);
	expect(document.getElementById(SPOTLIGHT_STYLE_ID)).toBeTruthy();
	expect(document.getElementById('mainContent').classList.contains(SPOTLIGHT_CLASS)).toBe(true);
	expect(toast).toHaveBeenCalledWith('AI 已切到八字', undo);
	jest.advanceTimersByTime(1700);
	expect(document.getElementById('mainContent').classList.contains(SPOTLIGHT_CLASS)).toBe(false);
	spotlight({ selector: '#mainContent', label: 'again' });
	expect(document.querySelectorAll(`#${SPOTLIGHT_STYLE_ID}`).length).toBe(1);
	expect(spotlight({ selector: '#nope', label: '找不到' })).toBe(false);
	expect(toast).toHaveBeenCalledTimes(3);
});
