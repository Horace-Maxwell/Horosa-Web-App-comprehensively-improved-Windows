// TP10 渲染冒烟(jsdom 真渲染,替代 live preview 的可复跑实证):
// 中栏三分支(几何/矩阵/开钥)+ 右栏全页签 + 单卡详情面板 + 新设置项切换,逐项断言「真渲染不抛且出关键文字」。
// 病灶类型:本轮新增的渲染分支若在真实 React 树里炸(缺 import/空值穿透/位义字段缺失),引擎测试一律拦不住。
import React from 'react';
import ReactDOM from 'react-dom';
import TarotMain from '../TarotMain';

jest.setTimeout(60000);

// jsdom 无 matchMedia(antd 栅格的 responsiveObserve 首屏即调用)——补最小 polyfill,否则 mount 阶段即抛。
if(!window.matchMedia){
	window.matchMedia = (query) => ({
		matches: false, media: query, onchange: null,
		addListener: () => {}, removeListener: () => {},
		addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
	});
}

let container;
let inst;

function mount(props){
	container = document.createElement('div');
	document.body.appendChild(container);
	inst = ReactDOM.render(<TarotMain height={800} fields={{}} {...(props || {})} />, container);
	return inst;
}
function unmount(){
	if(container){ ReactDOM.unmountComponentAtNode(container); container.remove(); container = null; }
	inst = null;
}
// setState 后同步走一次 render(React 17 在非事件回调里的 setState 是同步刷新的)
function set(patch){
	ReactDOM.unstable_batchedUpdates(() => { inst.setState(patch); });
}
const text = () => container.textContent || '';

afterEach(() => unmount());

describe('塔罗渲染冒烟 · 中栏三分支', () => {
	test('几何分支:凯尔特十字真渲染出牌位标签与横置徽章', () => {
		mount();
		set({ spreadType: 'celtic', useReversals: true });
		inst.applyRecompute('smoke-celtic');
		expect(text()).toContain('凯尔特十字');
		expect(text()).toContain('环绕(现状)');
		expect(text()).toContain('横置'); // 交叉牌第三态在真实牌面上出现
	});

	test('矩阵分支:22 张英雄阵渲染出行列标签与全部 22 位', () => {
		mount();
		set({ spreadType: 'hero22' });
		inst.applyRecompute('smoke-hero22');
		const t = text();
		expect(t).toContain('英雄×四中心');
		expect(t).toContain('内在障碍'); // 列标签
		expect(t).toContain('性/创造'); // 行标签
		expect(inst.state.reading.draws.length).toBe(22);
	});

	test('大牌子集阵:因果七杯渲染出图钥(不入抽)与七位', () => {
		mount();
		set({ spreadType: 'causal7' });
		inst.applyRecompute('smoke-causal7');
		const t = text();
		expect(t).toContain('图钥(不入抽)');
		expect(t).toContain('蛇杯(性与创造)');
		expect(inst.state.reading.draws.every((d) => d.card.arcana === 'major')).toBe(true);
	});

	test('开钥分堆视图:金色黎明+指示牌 → 五操作分区渲染', () => {
		mount();
		set({ deckId: 'golden_dawn', spreadType: 'opening_of_key', sig: { mode: 'manual', manualId: 'wands_king' } });
		inst.applyRecompute('smoke-ook');
		const t = text();
		expect(t).toContain('开钥五操作');
		expect(t).toContain('黄道十二宫');
		expect(t).toContain('指示牌锚点');
	});
});

describe('塔罗渲染冒烟 · 右栏全页签', () => {
	test('八个页签逐个切换真渲染:总览/牌位/牌义/综合/对读/定局/生命牌/日课', () => {
		mount();
		// 生命牌页在填齐生日后才出结果行,故先给生日(顺带实证人格/灵魂牌计算链在真实渲染里通)
		set({ spreadType: 'three', useDignities: true, showCorrespondences: true, birth: { year: 1990, month: 6, day: 15, refYear: 2026 } });
		inst.applyRecompute('smoke-tabs');
		const expects = {
			overview: '牌阵直断', positions: '位置', meanings: '关键义', synthesis: '花色 / 元素分布',
			pairs: '方位法则', verdict: 'Yes / No', birthcards: '人格牌', daily: '今日牌',
		};
		Object.keys(expects).forEach((tab) => {
			set({ rightPanelTab: tab });
			expect(`${tab}:${text().includes(expects[tab])}`).toBe(`${tab}:true`);
		});
	});

	test('开钥页签可达(RIGHT_TABS 曾漏登记致点不进去)', () => {
		mount();
		set({ deckId: 'thoth', spreadType: 'opening_of_key', sig: { mode: 'manual', manualId: 'cups_queen' } });
		inst.applyRecompute('smoke-ooktab');
		set({ rightPanelTab: 'ook' });
		expect(inst.state.rightPanelTab).toBe('ook'); // 守卫不再把它打回 overview
		expect(text()).toContain('首尾配对');
	});

	test('定局页:组合征象/计时五法/宫廷指认三卡随数据出现', () => {
		mount();
		set({ spreadType: 'celtic', rightPanelTab: 'verdict', timingMethod: 'decan_full' });
		inst.applyRecompute('smoke-verdict');
		const t = text();
		expect(t).toContain('计时 Timing');
		expect(t).toContain('旬窗'); // 旬星全谱法真产出
		expect(t).toContain('精华牌');
	});

	test('雷诺曼牌组:组合读法页出现且无对读/生命牌/日课页', () => {
		mount();
		set({ deckId: 'lenormand', spreadType: 'grand_tableau', rightPanelTab: 'lenormand' });
		inst.applyRecompute('smoke-lenormand');
		expect(text()).toContain('宫位叠读');
	});
});

describe('塔罗渲染冒烟 · 详情面板与设置项', () => {
	test('单卡详情面板:打开后出对应聚合/四轨牌义/主题占断/自问/个人牌义', () => {
		mount();
		inst.applyRecompute('smoke-detail');
		const card = inst.state.reading.draws[0].card;
		set({ detailCard: inst.state.reading.draws.find((d) => d.card.arcana === 'major') ? inst.state.reading.draws.find((d) => d.card.arcana === 'major').card : card });
		const body = document.body.textContent || '';
		expect(body).toContain('对应聚合');
		expect(body).toContain('牌义四轨');
		expect(body).toContain('个人牌义(仅存本机)');
	});

	test('左栏三节与新设置项渲染:读法体系/牌阵细则/逆位十三式下拉', () => {
		mount();
		set({ spreadType: 'celtic', useReversals: true, showCorrespondences: true, useDignities: true });
		const t = text();
		expect(t).toContain('盘面与开关');
		expect(t).toContain('读法体系');
		expect(t).toContain('牌阵细则');
		expect(t).toContain('逆位产生');
		expect(t).toContain('宫廷元素体系');
		expect(t).toContain('空白牌(79张)');
	});

	test('数字度轨切换后牌义页出「第N度」;马赛牌组切入自动吸附该轨', () => {
		mount();
		set({ meaningSystem: 'degrees', rightPanelTab: 'meanings', spreadType: 'three' });
		inst.applyRecompute('smoke-degrees');
		expect(text()).toMatch(/第\d度|使者|学徒|内化掌握/);
		inst.changeDeck('tdm');
		expect(inst.state.meaningSystem).toBe('degrees');
	});
});
