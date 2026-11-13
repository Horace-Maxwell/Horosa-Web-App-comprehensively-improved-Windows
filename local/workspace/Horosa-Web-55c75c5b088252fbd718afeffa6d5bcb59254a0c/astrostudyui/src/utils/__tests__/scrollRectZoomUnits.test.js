// 「滚到某一项」在整页缩放下的单位:getBoundingClientRect 给缩放后的视觉 px,scrollTop / clientHeight 是缩放前的布局 px。
// 两者直接相加减,在 0.9 档每次少滚一成、越靠后的项差得越多(设置抽屉跳组、帮助目录、星运长表定位、竖排页签条都是这一类)。
// 换算单一出口 = utils/zoomDomain.pointerLocalRatio(el, rect).ky。
import fs from 'fs';
import path from 'path';

const { fnBody } = require('./helpers/sourceSet');
const SRC = path.resolve(__dirname, '..', '..');
const read = (f)=>fs.readFileSync(path.join(SRC, f), 'utf8');

describe('已知的「滚到某一项」都按缩放折回单位', ()=>{
	[
		['components/astro/ChartDisplaySelector.js', 'jumpToAnchor(id)'],
		['components/help/HelpBook.js', 'revealActive()'],
		['components/astro/AstroDirectedFigures.js', 'function scrollRowIntoBoxOnce(holder, slot, rowId, node)'],
		['components/astro/AstroPersianDirected.js', 'scrollToCurrentAge()'],
	].forEach(([f, sig])=>{
		test(`${f} · ${sig}`, ()=>{
			const body = fnBody(read(f), sig);
			expect(body).toBeTruthy();
			expect(body).toMatch(/pointerLocalRatio\([^)]*\)\.ky/);
			expect(body).toMatch(/getBoundingClientRect\(\)/);
		});
	});
});

describe('全站扫描:既读矩形又写滚动量的文件必须经缩放换算', ()=>{
	// 只把滚动量清零 / 不拿矩形差去算滚动量的,登记理由放行
	const ALLOW = {
		'components/direction/AstroDirectMain.js': '只把滚动量归零(scrollTop = 0),矩形只用于量宽高比',
	};
	const files = [];
	const walk = (dir)=>{
		fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
			const p = path.join(dir, d.name);
			if(d.isDirectory()){
				if(d.name === '__tests__' || d.name.startsWith('.umi')){ return; }
				walk(p);
			}else if(/\.js$/.test(d.name)){ files.push(p); }
		});
	};
	walk(SRC);

	test('没有未登记的「矩形 + 滚动量」文件绕开换算', ()=>{
		const bad = [];
		files.forEach((p)=>{
			const s = fs.readFileSync(p, 'utf8');
			if(!/\bscrollTop\s*=[^=]|\.scrollTo\(|\.scrollBy\(/.test(s)){ return; }
			if(!/getBoundingClientRect\(/.test(s)){ return; }
			const rel = path.relative(SRC, p).split(path.sep).join('/');
			if(/pointerLocalRatio|zoomDomain|getDeclaredZoom/.test(s) || ALLOW[rel]){ return; }
			bad.push(rel);
		});
		expect(bad).toEqual([]);
	});

	test('放行表里的文件确实只归零', ()=>{
		const s = read('components/direction/AstroDirectMain.js');
		const assigns = s.match(/\bscrollTop\s*=[^=][^;]*/g) || [];
		expect(assigns.length).toBeGreaterThan(0);
		assigns.forEach((a)=>{ expect(a).toMatch(/scrollTop\s*=\s*0/); });
	});
});
