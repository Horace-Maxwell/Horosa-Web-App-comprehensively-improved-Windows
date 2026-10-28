// 多处逐字相同的小工具已合并成一份:按旧实现逐值对拍(同一输入同一输出),并锁住各调用方不再自带副本。
import fs from 'fs';
import path from 'path';
const { fileImportsName } = require('../../utils/__tests__/helpers/importSpecs');   // 按 AST 读 import:同一条里多导几个名字 / 换行排版都照认
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { message } from 'antd';

jest.mock('../../utils/kentangCache', ()=>({ cachedKentangFetch: jest.fn() }));

import { fieldVal, devFreeze } from '../shusuan/shusuanShared';
import { paramsToFields } from '../relative/relativeFields';
import { pickerInvalid } from '../xq-ui';
import { postKentang } from '../../services/kentangPost';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { ServerRoot } from '../../utils/constants';
import { polar, hexYao, RadialText, CHAR_PITCH } from '../fengshui/charts/chartGeom';
import { zibaiYearCenter } from '../fengshui/liqiCore';
import { splitList, nearSame } from '../xuanshi/xuanshiDate';

const SRC = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('数算族共用 fieldVal / devFreeze', ()=>{
	// 旧实现两种写法(函数式 / 三目箭头)作对拍基准
	const oldA = (fields, key, fallback = '')=>{
		if (!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null) return fallback;
		return fields[key].value;
	};
	const oldB = (f, k, d = '') => (f && f[k] && f[k].value !== undefined && f[k].value !== null ? f[k].value : d);
	test('与两种旧写法逐值相同', ()=>{
		const cases = [
			[null, 'a'], [undefined, 'a'], [{}, 'a'], [{ a: null }, 'a'], [{ a: {} }, 'a'],
			[{ a: { value: null } }, 'a', 7], [{ a: { value: undefined } }, 'a', 7], [{ a: { value: 0 } }, 'a', 7],
			[{ a: { value: '' } }, 'a', 7], [{ a: { value: false } }, 'a', 7], [{ a: { value: 'x' } }, 'a'], [{ a: { value: 3 } }, 'b', 'fb'],
		];
		cases.forEach((c)=>{
			const got = fieldVal(...c);
			expect([c, got]).toEqual([c, oldA(...c)]);
			expect([c, got]).toEqual([c, oldB(...c)]);
		});
	});
	test('devFreeze:非生产构建下深冻结并原样返回同一引用;标量原样返回', ()=>{
		const v = { a: { b: [1, { c: 2 }] } };
		expect(devFreeze(v)).toBe(v);
		expect(Object.isFrozen(v)).toBe(true);
		expect(Object.isFrozen(v.a.b[1])).toBe(true);
		expect(devFreeze(5)).toBe(5);
		expect(devFreeze(null)).toBe(null);
	});
	test('四页都改为引用共用件,不再各带一份', ()=>{
		['components/shusuan/CanPingMain.js', 'components/shusuan/HeLuoMain.js', 'components/shusuan/ZhengChuanMain.js', 'components/yizhangjing/YiZhangJingMain.js'].forEach((rel)=>{
			const src = read(rel);
			expect(`${rel}:${/function fieldVal\(|const fieldVal =|const devFreeze =|function deepFreeze\(/.test(src)}`).toBe(`${rel}:false`);
			['fieldVal', 'devFreeze'].forEach((name)=>{
				const hit = fileImportsName(path.join(SRC, rel), { name, target: path.join(SRC, 'components/shusuan/shusuanShared') });
				expect(`${rel}:${name}:${hit}`).toBe(`${rel}:${name}:true`);
			});
		});
	});
});

describe('合盘子页 paramsToFields', ()=>{
	test('出生数据取自 record,左栏口径(宫制 / 黄道 / 恒星岁差)保留全局值', ()=>{
		const flds = { hsys: { value: 3 }, zodiacal: { value: 1 }, siderealAyanamsa: { value: 5 }, ad: { value: 1 }, date: { value: 'old' } };
		const out = paramsToFields({ date: 'D', time: 'T', zone: '+8', lat: 'LA', lon: 'LO', zodiacal: 0, hsys: 9 }, flds);
		expect(out.hsys).toBe(flds.hsys);
		expect(out.zodiacal).toBe(flds.zodiacal);
		expect(out.siderealAyanamsa).toBe(flds.siderealAyanamsa);
		expect(out.date).toEqual({ value: 'D' });
		expect(out.time).toEqual({ value: 'T' });
		expect(out.zone).toEqual({ value: '+8' });
		expect(out.lat).toEqual({ value: 'LA' });
		expect(out.lon).toEqual({ value: 'LO' });
		expect(out.ad).toEqual({ value: 1 });
		expect(paramsToFields({ ad: -1 }, flds).ad).toEqual({ value: -1 });
	});
	test('共用件不覆盖 zodiacal;四个子页都引用它', ()=>{
		expect(read('components/relative/relativeFields.js')).not.toContain('value: param.zodiacal');
		['AstroMarks', 'AstroTimeSpace', 'AstroComposite', 'AstroSynastry'].forEach((n)=>{
			const src = read(`components/relative/${n}.js`);
			expect(`${n}:${src.includes('function paramsToFields(')}`).toBe(`${n}:false`);
			expect(src).toContain("import { paramsToFields } from './relativeFields';");
		});
	});
});

describe('快捷数字键入无效提示', ()=>{
	test('pickerInvalid 弹 3 秒错误提示;QuickTimeField 用同一份', ()=>{
		const spy = jest.spyOn(message, 'error').mockImplementation(()=>{});
		try{
			pickerInvalid('坏输入');
			expect(spy).toHaveBeenCalledWith('坏输入', 3);
		}finally{
			spy.mockRestore();
		}
		const q = read('components/comp/QuickTimeField.js');
		expect(q).toContain('pickerInvalid as defaultInvalid');
		expect(q).not.toMatch(/function defaultInvalid\(/);
	});
});

describe('kentang 模块 POST(只打本机计算服务;不回落 Java 后端)', ()=>{
	const resp = (obj)=>({ text: ()=>Promise.resolve(obj === undefined ? '' : JSON.stringify(obj)) });
	beforeEach(()=>{ cachedKentangFetch.mockReset(); });
	test('本机成功:直接返回 Result,只发一次', async ()=>{
		cachedKentangFetch.mockResolvedValueOnce(resp({ ResultCode: 0, Result: { pan: 1 } }));
		await expect(postKentang('shenyishu', 'pan', { a: 1 })).resolves.toEqual({ pan: 1 });
		expect(cachedKentangFetch).toHaveBeenCalledTimes(1);
		const [url, init, opt] = cachedKentangFetch.mock.calls[0];
		expect(url).toMatch(/\/shenyishu\/pan$/);
		expect(init).toEqual({ method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: '{"a":1}' });
		expect(opt).toEqual({ retries: 0 });
	});
	test('本机回错(ResultCode 非 0):抛回包里的原文,不再改打 ServerRoot 同名路径', async ()=>{
		cachedKentangFetch.mockResolvedValueOnce(resp({ ResultCode: 2, Result: '参数错' }));
		await expect(postKentang('jingjue', 'pan', {})).rejects.toThrow('参数错');
		expect(cachedKentangFetch).toHaveBeenCalledTimes(1);
		expect(cachedKentangFetch.mock.calls.some((c)=>c[0] === `${ServerRoot}/jingjue/pan`)).toBe(false);
	});
	test('网络错原样抛出;空回包缺省「<模块>.fetch.failed」;cacheConfig 显式 undefined = 用缓存层缺省重试', async ()=>{
		cachedKentangFetch.mockRejectedValueOnce(new Error('down'));
		await expect(postKentang('jingjue', 'pan', {})).rejects.toThrow('down');
		cachedKentangFetch.mockResolvedValueOnce(resp(undefined));
		await expect(postKentang('shenyishu', 'pan', {})).rejects.toThrow('shenyishu.fetch.failed');
		expect(cachedKentangFetch).toHaveBeenCalledTimes(2);
		cachedKentangFetch.mockResolvedValueOnce(resp({ ResultCode: 0, Result: 1 }));
		await postKentang('qimen', 'pan', {}, { cacheConfig: undefined });
		expect(cachedKentangFetch.mock.calls[2]).toHaveLength(3);
		expect(cachedKentangFetch.mock.calls[2][2]).toBeUndefined();
	});
	test('神易数 / 荆诀 / 太玄三页改为引用共用件', ()=>{
		[['components/shenyishu/ShenYiShuMain.js', "function postShenYiShu(path, payload){ return postKentang('shenyishu', path, payload); }"],
			['components/jingjue/JingJueMain.js', "function postJingJue(path, payload){ return postKentang('jingjue', path, payload); }"],
			['components/taixuan/TaiXuanMain.js', "function postTaiXuan(path, payload){ return postKentang('taixuan', path, payload); }"]].forEach(([rel, line])=>{
			const src = read(rel);
			expect(src).toContain(line);
			expect(src).not.toContain('cachedKentangFetch');
		});
	});
});

describe('风水圆盘几何小件', ()=>{
	const oldPolar = (cx, cy, r, deg)=>{ const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
	const BIN = { 乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0], 巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0] };
	const oldHex = (lower, upper)=>{ const lo = BIN[lower] || [0, 0, 0]; const up = BIN[upper] || [0, 0, 0]; return [lo[0], lo[1], lo[2], up[0], up[1], up[2]]; };
	function OldRadialText({ cx, cy, rIn, rOut, deg, text, fs, fill, weight }) {
		const s = `${text || ''}`;
		if (!s) { return null; }
		const step = Math.min(fs * 1.20, (rOut - rIn) / s.length);
		const first = (rIn + rOut) / 2 - (s.length - 1) * step / 2;
		return (
			<g transform={`rotate(${deg} ${cx} ${cy})`}>
				{s.split('').map((ch, i)=>(
					<text key={i} x={cx} y={cy - (first + i * step)} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={fill} fontWeight={weight}>{ch}</text>
				))}
			</g>
		);
	}
	test('polar / hexYao / RadialText 与旧实现逐值、逐字节相同(RadialText 只多每个字的整词属性)', ()=>{
		[[0, 0, 10, 0], [300, 300, 120, 45.5], [10, 20, 0, 359.99], [5, 5, 7, -30]].forEach((a)=>expect(polar(...a)).toEqual(oldPolar(...a)));
		const names = Object.keys(BIN).concat(['?', undefined]);
		names.forEach((lo)=>names.forEach((up)=>expect(hexYao(lo, up)).toEqual(oldHex(lo, up))));
		expect(CHAR_PITCH).toBe(1.20);
		[{ text: '乾', fs: 10 }, { text: '二十四山', fs: 14, weight: 700 }, { text: '', fs: 9 }, { text: 123, fs: 30 }].forEach((p)=>{
			const props = { cx: 300, cy: 300, rIn: 100, rOut: 160, deg: 37.5, fill: 'red', ...p };
			const a = React.createElement('svg', null, React.createElement(RadialText, props));
			const b = React.createElement('svg', null, React.createElement(OldRadialText, props));
			const html = renderToStaticMarkup(a);
			expect(html.replace(/ data-hant-(word|idx)="[^"]*"/g, '')).toBe(renderToStaticMarkup(b));
			const s = `${p.text || ''}`;
			if(s){ expect((html.match(new RegExp(` data-hant-word="${s}"`, 'g')) || []).length).toBe(s.length); }
		});
	});
	test('五张图不再各带一份', ()=>{
		const rel = (n)=>`components/fengshui/charts/${n}.js`;
		[['LuopanDial', ['function polar(', 'function RadialText(', 'const CHAR_PITCH']], ['TwentyFourShanRing', ['function polar(']],
			['SixtyFourGuaCircle', ['function polar(', 'function hexYao(', 'function RadialText(', 'const CHAR_PITCH']],
			['XianfaRing', ['function polar(', 'function RadialText(', 'const CHAR_PITCH']],
			['SixtyFourGuaRing', ['function hexYao(', 'const GUA8_BIN']]].forEach(([n, gone])=>{
			const src = read(rel(n));
			gone.forEach((g)=>expect(`${n}:${g}:${src.includes(g)}`).toBe(`${n}:${g}:false`));
			expect(src).toContain("from './chartGeom';");
		});
	});
	test('玄空流年入中星与紫白同一算法', ()=>{
		const oldYearCenter = (year)=>{
			let s = String(Math.abs(Math.trunc(Number(year) || 0))).split('').reduce((a, d)=>a + (+d), 0);
			while (s > 9) { s = String(s).split('').reduce((a, d)=>a + (+d), 0); }
			let c = 11 - s; if (c > 9) { c -= 9; } if (c <= 0) { c += 9; }
			return c;
		};
		for(let y = -3000; y <= 3000; y += 7){ expect([y, zibaiYearCenter(y)]).toEqual([y, oldYearCenter(y)]); }
		['2024', 1984.6, 'x', null, undefined, NaN].forEach((y)=>expect(zibaiYearCenter(y)).toBe(oldYearCenter(y)));
		const src = read('components/fengshui/xuankong.js');
		expect(src).not.toMatch(/function yearCenter\(/);
		expect(src).toContain('zibaiYearCenter as yearCenter');
	});
});

describe('玄学史文本小工具', ()=>{
	test('splitList / nearSame 与旧实现逐值相同', ()=>{
		const oldSplit = (s)=>{ if (!s) { return []; } return `${s}`.split(/[;,、，]\s*/).map((x) => x.trim()).filter(Boolean); };
		const oldNear = (a, b)=>{ if (!a || !b) { return false; } const sa = new Set(a), sb = new Set(b); let inter = 0; sa.forEach((c) => { if (sb.has(c)) { inter++; } }); return inter / Math.max(sa.size, sb.size, 1) > 0.85; };
		[null, '', '六壬;奇门, 太乙、 紫微，八字', ' a ;; b ', 42].forEach((s)=>expect(splitList(s)).toEqual(oldSplit(s)));
		[['天象', '天象'], ['日食', '月食'], ['', 'x'], [null, 'x'], ['abcdefg', 'abcdefh']].forEach(([a, b])=>expect(nearSame(a, b)).toBe(oldNear(a, b)));
	});
	test('三页改为引用 xuanshiDate', ()=>{
		[['XuanShiEvents', ['function splitList(', 'function nearSame(']], ['XuanShiCelestial', ['function nearSame(']], ['XuanShiFigures', ['function splitList(']]].forEach(([n, gone])=>{
			const src = read(`components/xuanshi/${n}.js`);
			gone.forEach((g)=>expect(`${n}:${src.includes(g)}`).toBe(`${n}:false`));
		});
	});
});
