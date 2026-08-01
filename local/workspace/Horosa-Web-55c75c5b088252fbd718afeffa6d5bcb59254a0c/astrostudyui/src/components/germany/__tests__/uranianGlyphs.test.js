// B1 虚星 SVG 字形:8 星 path 齐全/工厂函数契约/中性(文件零人名由 preflight [63] 扫描守护)。
import { TNP_GLYPH_PATHS, tnpGlyph, appendTnpGlyphD3 } from '../UranianGlyphs';
import * as AstroConst from '../../../constants/AstroConst';

describe('TNP_GLYPH_PATHS 8 字形', () => {
	test('8 虚星逐一有 path,d 串合法起笔且多子路径', () => {
		AstroConst.LIST_URANIAN.forEach((id) => {
			const d = TNP_GLYPH_PATHS[id];
			expect(typeof d).toBe('string');
			expect(d.startsWith('M')).toBe(true);
			expect(d.split('M').length).toBeGreaterThan(2); // 至少两笔(复合字形)
		});
		// 8 虚星 + 2 可选点(东点/宿命点,B7)= 10 个手绘字形。
		expect(Object.keys(TNP_GLYPH_PATHS).length).toBe(10);
		expect(TNP_GLYPH_PATHS[AstroConst.EAST_POINT]).toBeTruthy();
		expect(TNP_GLYPH_PATHS[AstroConst.VERTEX]).toBeTruthy();
	});
	test('波塞冬与海王星记号非同源(手绘 path,非字体字符)', () => {
		// 波塞冬=)( 加横杠 —— 含 A 弧指令与 H 横线;确保不是把 ♆ 字符塞进 path。
		const d = TNP_GLYPH_PATHS[AstroConst.POSEIDON];
		expect(d).toMatch(/A/);
		expect(d).toMatch(/H/);
		expect(d).not.toContain('♆');
	});
});

describe('tnpGlyph React 工厂', () => {
	test('已知 id 返回 svg 元素(24 viewBox,currentColor 默认),未知 id 返回 null', () => {
		const el = tnpGlyph(AstroConst.CUPIDO, 15);
		expect(el && el.type).toBe('svg');
		expect(el.props.viewBox).toBe('0 0 24 24');
		expect(el.props.width).toBe(15);
		const path = el.props.children;
		expect(path.props.stroke).toBe('currentColor');
		expect(path.props.fill).toBe('none');
		expect(path.props.vectorEffect).toBe('non-scaling-stroke');
		expect(tnpGlyph('nonsense')).toBeNull();
	});
});

describe('appendTnpGlyphD3 双层结构', () => {
	test('外层 g 可再接 transform/title,内层 g 承载 translate+scale(互不覆盖)', () => {
		// 最小 d3-selection 桩:记录 append 链与 attr。
		const mk = (tag) => {
			const node = { tag, attrs: {}, styles: {}, children: [] };
			node.append = (t) => { const c = mk(t); node.children.push(c); return c; };
			node.attr = (k, v) => { node.attrs[k] = v; return node; };
			node.style = (k, v) => { node.styles[k] = v; return node; };
			return node;
		};
		const parent = mk('svg');
		const outer = appendTnpGlyphD3(parent, AstroConst.ZEUS, 100, 50, 16, '#abc');
		expect(outer.tag).toBe('g');
		expect(outer.attrs.transform).toBeUndefined();       // 外层留白给环反旋 rotate
		const inner = outer.children[0];
		expect(inner.tag).toBe('g');
		expect(inner.attrs.transform).toContain('translate(92, 42)'); // 100−16/2, 50−16/2
		expect(inner.attrs.transform).toContain('scale(');
		const path = inner.children[0];
		expect(path.tag).toBe('path');
		expect(path.attrs.d).toBe(TNP_GLYPH_PATHS[AstroConst.ZEUS]);
		expect(path.attrs.stroke).toBe('#abc');
		expect(path.attrs['vector-effect']).toBe('non-scaling-stroke');
		// 未知 id → null(调用方回退缩写 text)。
		expect(appendTnpGlyphD3(parent, 'nonsense', 0, 0, 16, '#abc')).toBeNull();
	});
});
