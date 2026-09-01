import * as d3 from 'd3';
import { drawTextH, drawTextV } from '../GraphHelper';

// [去描边根治] 盘面文字渲染合同:color 参数必须落在 fill(填色),stroke 必须显式 'none'
// (根壳内联 stroke:var(--horosa-text) 会沿 SVG 继承漏回描边——显式关闭不是冗余)。
// 历史病:color 被写进 text 的 stroke 且不设 fill → 黑填充+彩描边叠印,小字号笔画粘连
// 发糊(用户实报紫微十二神看不清)。weight 下限 500=把描边贡献的视觉重量折算回字重。
describe('GraphHelper 文字填色渲染合同', ()=>{
	const mkOwner = ()=>{
		const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		document.body.appendChild(host);
		return { host, owner: d3.select(host) };
	};

	afterEach(()=>{
		document.querySelectorAll('body > svg').forEach((n)=>n.remove());
	});

	const assertTexts = (host, color, expectWeight)=>{
		const texts = host.querySelectorAll('text');
		expect(texts.length).toBeGreaterThan(0);
		texts.forEach((t)=>{
			expect(t.getAttribute('fill')).toBe(color);
			expect(t.getAttribute('stroke')).toBe('none');
			expect(Number(t.getAttribute('font-weight'))).toBeGreaterThanOrEqual(expectWeight);
		});
	};

	test('🔴 drawTextH:fill=传入色 / stroke=none / weight≥500', ()=>{
		const { host, owner } = mkOwner();
		drawTextH(owner, ['青', '龙'], 0, 0, 40, 20, 1.5, '#7f9cd0', 400);
		assertTexts(host, '#7f9cd0', 500);
	});

	test('🔴 drawTextV:fill=传入色 / stroke=none / weight≥500', ()=>{
		const { host, owner } = mkOwner();
		drawTextV(owner, ['奏', '书'], 0, 0, 20, 40, 1.5, '#a63d2a', 240);
		assertTexts(host, '#a63d2a', 500);
	});

	test('显式高字重(650)保留层级不被压回 500', ()=>{
		const { host, owner } = mkOwner();
		drawTextH(owner, ['运'], 0, 0, 20, 20, 1, '#000', 650);
		host.querySelectorAll('text').forEach((t)=>{
			expect(t.getAttribute('font-weight')).toBe('650');
		});
	});

	test('缺省色=全站文字令牌(var(--horosa-text)),不是裸黑', ()=>{
		const { host, owner } = mkOwner();
		drawTextH(owner, ['测'], 0, 0, 20, 20, 1, null, null);
		host.querySelectorAll('text').forEach((t)=>{
			expect(t.getAttribute('fill')).toBe('var(--horosa-text, #000000)');
			expect(t.getAttribute('stroke')).toBe('none');
		});
	});

	test('反误伤锁:rect 边框分支的 stroke=borderColor 仍在(真边框语义不许连坐)', ()=>{
		const { host, owner } = mkOwner();
		drawTextH(owner, ['框'], 0, 0, 20, 20, 1, '#333', 500, '#fff', '#c00');
		const rect = host.querySelector('rect');
		expect(rect).toBeTruthy();
		expect(rect.getAttribute('stroke')).toBe('#c00');
		expect(rect.getAttribute('fill')).toBe('#fff');
	});
});
