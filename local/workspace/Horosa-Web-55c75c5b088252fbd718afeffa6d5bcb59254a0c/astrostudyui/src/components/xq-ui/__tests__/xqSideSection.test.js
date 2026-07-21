// 观象左栏设计语言 · XQSideSection / XQPanelHeader 契约测试
// 四条铁则:1) 折叠只切 aria-expanded+class,children 永不卸载(防表单态丢/防重算);
//          2) 持久化必走 safeStorage 且全 App 合并存单个 key 的一张 map(配额事故教训);
//          3) 无 storageKey 退化组件内 state,零存储副作用;
//          4) 图标映射表必须全部命中 xq-icons 真实图标(XQIcon 未知名静默回退 astro,写错名不报错)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { renderToStaticMarkup } from 'react-dom/server';
import * as safeStorage from '../../../utils/safeStorage';
import { XQSideSection, XQPanelHeader, SIDE_COLLAPSE_STORE_KEY } from '../index';
import { SIDE_SECTION_ICONS, sideSectionIcon } from '../../../constants/sideSectionIcons';
import XQIcon from '../../xq-icons';

jest.mock('../../../utils/safeStorage', ()=>{
	const store = {};
	return {
		__esModule: true,
		__store: store,
		safeJsonParseFromStorage: jest.fn((key)=>(
			Object.prototype.hasOwnProperty.call(store, key) ? JSON.parse(store[key]) : null
		)),
		safeJsonStringifyToStorage: jest.fn((key, obj)=>{
			store[key] = JSON.stringify(obj);
			return true;
		}),
	};
});

let container;

beforeEach(()=>{
	container = document.createElement('div');
	document.body.appendChild(container);
	jest.clearAllMocks();
	Object.keys(safeStorage.__store).forEach((k)=>{ delete safeStorage.__store[k]; });
});

afterEach(()=>{
	ReactDOM.unmountComponentAtNode(container);
	container.remove();
});

const mount = (el)=>{ act(()=>{ ReactDOM.render(el, container); }); };
const unmount = ()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(container); }); };
const clickHeader = (idx = 0)=>{
	const header = container.querySelectorAll('.xq-side-section-header')[idx];
	act(()=>{ header.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};
const toggleBtn = (idx = 0)=> container.querySelectorAll('.xq-side-section-toggle')[idx];

describe('XQSideSection · 展开/折叠', ()=>{
	test('点标题行切换 aria-expanded 与折叠 class', ()=>{
		mount(<XQSideSection iconName="clock" title="时间"><div>内容</div></XQSideSection>);
		const section = container.querySelector('.xq-side-section');
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('true');
		expect(section.className).not.toContain('xq-side-section-collapsed');

		clickHeader();
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector('.xq-side-section').className).toContain('xq-side-section-collapsed');

		clickHeader();
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('true');
	});

	test('defaultOpen=false → 初始即折叠', ()=>{
		mount(<XQSideSection title="高级" defaultOpen={false}><div>内容</div></XQSideSection>);
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('false');
	});

	test('collapsible=false → 无箭头,点击不折叠', ()=>{
		mount(<XQSideSection title="固定" collapsible={false}><div>内容</div></XQSideSection>);
		expect(container.querySelector('.xq-side-section-arrow')).toBeNull();
		clickHeader();
		expect(container.querySelector('.xq-side-section').className).not.toContain('xq-side-section-collapsed');
	});

	test('🔴 折叠时 children 仍挂载不卸载,表单值原样保留', ()=>{
		mount(
			<XQSideSection title="输入">
				<input className="probe" defaultValue="" />
			</XQSideSection>
		);
		const probe = container.querySelector('.probe');
		probe.value = '折叠不丢';

		clickHeader();
		const after = container.querySelector('.probe');
		expect(after).not.toBeNull();
		expect(after).toBe(probe); // 同一 DOM 节点 → 未经历卸载/重挂
		expect(after.value).toBe('折叠不丢');
		expect(container.querySelector('.xq-side-section-body').getAttribute('aria-hidden')).toBe('true');
	});
});

describe('XQSideSection · 持久化(单 key 一张 map)', ()=>{
	const tree = (
		<div>
			<XQSideSection title="时间" storageKey="astro.time"><div>甲</div></XQSideSection>
			<XQSideSection title="地点" storageKey="astro.place"><div>乙</div></XQSideSection>
		</div>
	);

	test('🔴 全部写入合并进 horosa.sidebar.collapse.v1 单个 key,不逐小节开 key', ()=>{
		expect(SIDE_COLLAPSE_STORE_KEY).toBe('horosa.sidebar.collapse.v1');
		mount(tree);

		clickHeader(0); // 折叠「时间」
		expect(safeStorage.safeJsonStringifyToStorage).toHaveBeenCalledWith(
			'horosa.sidebar.collapse.v1', { 'astro.time': false }
		);

		clickHeader(1); // 折叠「地点」→ 读改写整 map,两小节合并一张
		expect(safeStorage.safeJsonStringifyToStorage).toHaveBeenLastCalledWith(
			'horosa.sidebar.collapse.v1', { 'astro.time': false, 'astro.place': false }
		);

		// 所有写入只碰这一个 key;mock 存储里也只有这一个键
		safeStorage.safeJsonStringifyToStorage.mock.calls.forEach(([key])=>{
			expect(key).toBe('horosa.sidebar.collapse.v1');
		});
		expect(Object.keys(safeStorage.__store)).toEqual(['horosa.sidebar.collapse.v1']);
	});

	test('重挂载按 map 还原折叠态;再展开回写 true', ()=>{
		mount(tree);
		clickHeader(0);
		clickHeader(1);
		unmount();

		mount(tree); // 重挂载 → 两小节都应还原为折叠
		expect(toggleBtn(0).getAttribute('aria-expanded')).toBe('false');
		expect(toggleBtn(1).getAttribute('aria-expanded')).toBe('false');

		clickHeader(0); // 再展开「时间」→ map 内该键翻 true,他键不动
		expect(safeStorage.safeJsonStringifyToStorage).toHaveBeenLastCalledWith(
			'horosa.sidebar.collapse.v1', { 'astro.time': true, 'astro.place': false }
		);
	});

	test('存储值损坏(非 map)→ 静默回退 defaultOpen,不抛', ()=>{
		safeStorage.__store['horosa.sidebar.collapse.v1'] = JSON.stringify(['坏', '形', '状']);
		mount(tree);
		expect(toggleBtn(0).getAttribute('aria-expanded')).toBe('true');
	});

	test('无 storageKey → 退化组件内 state,零存储副作用', ()=>{
		mount(<XQSideSection title="临时"><div>内容</div></XQSideSection>);
		clickHeader();
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('false');
		clickHeader();
		expect(toggleBtn().getAttribute('aria-expanded')).toBe('true');
		expect(safeStorage.safeJsonStringifyToStorage).not.toHaveBeenCalled();
		expect(Object.keys(safeStorage.__store)).toEqual([]);
	});
});

describe('XQPanelHeader', ()=>{
	test('渲染 kicker 与 extra', ()=>{
		const html = renderToStaticMarkup(
			<XQPanelHeader kicker="观象" extra={<span className="probe-extra">副</span>} />
		);
		expect(html).toContain('xq-panel-header-kicker');
		expect(html).toContain('观象');
		expect(html).toContain('probe-extra');
	});

	test('无 extra 时不渲染 extra 容器', ()=>{
		const html = renderToStaticMarkup(<XQPanelHeader kicker="观象" />);
		expect(html).not.toContain('xq-panel-header-extra');
	});
});

describe('sideSectionIcons · 映射表全部命中真实图标', ()=>{
	// XQIcon 对未知名静默回退 astro → 「渲染结果 ≠ astro 回退」即证明名字真实存在
	const astroMarkup = renderToStaticMarkup(<XQIcon name="astro" />);

	test.each(Object.entries(SIDE_SECTION_ICONS))('%s → %s 是 xq-icons 真实图标', (semantic, iconName)=>{
		expect(iconName).not.toBe('astro'); // 表内绝不映射到兜底本身,否则守卫失效
		expect(renderToStaticMarkup(<XQIcon name={iconName} />)).not.toBe(astroMarkup);
	});

	test('未知语义回退通用开关组图标', ()=>{
		expect(sideSectionIcon('不存在的语义')).toBe('sliders');
		expect(sideSectionIcon('time')).toBe('clock');
	});
});
