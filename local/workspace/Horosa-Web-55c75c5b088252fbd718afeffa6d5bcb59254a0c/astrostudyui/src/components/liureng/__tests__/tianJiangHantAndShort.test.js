// 十二天将:界面繁体下逐字 / 缩写出图仍按整词定字,且六壬页与三式合一同用一张缩写表。
//   · 逐字画(GraphHelper.drawTextH / drawTextV,一个字一个 <text>)与单字缩写(天后 → 后)单独成节点,
//     通用词典单看一个「后」会转成「後」;节点带整词与位次后按整词转再取那一位。
//   · 缩写表单源 liureng/LRConst.TIANJIANG_SHORT(六壬页为准:朱雀 → 雀),三式合一不得另立一张。
import * as d3 from 'd3';
import { drawTextH, drawTextV } from '../../graph/GraphHelper';
import { TIANJIANG_SHORT, shortTianJiang, tianJiangShortAttrs } from '../LRConst';
import { toHant } from '../../../utils/scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../../../utils/scriptMode';
import RengChart from '../../lrzhan/RengChart';
import { shortTianJiang as sanshiShort } from '../../sanshi/SanShiUnitedMain';

const fs = require('fs');
const path = require('path');

const JIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

function mkSvg(){
	const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	document.body.appendChild(host);
	return host;
}

beforeEach(() => {
	__resetScriptModeForTest();
	__setConverterForTest(toHant);
	document.body.innerHTML = '';
});
afterAll(() => { __resetScriptModeForTest(); });

describe('界面繁体:逐字 / 缩写仍按整词定字', () => {
	it('十二天将逐字画(横 / 竖):每个字 = 整词转换结果的对应位(天后不成天後)', async () => {
		const host = mkSvg();
		JIANG.forEach((name) => {
			drawTextH(d3.select(host), name.split(''), 0, 0, 40, 20, 1);
			drawTextV(d3.select(host), name.split(''), 0, 0, 20, 40, 1);
		});
		await applyScriptMode(SCRIPT_HANT);
		const groups = host.querySelectorAll('g');
		expect(groups.length).toBe(JIANG.length * 2);
		groups.forEach((g, k) => {
			const name = JIANG[Math.floor(k / 2)];
			expect(Array.from(g.querySelectorAll('text')).map((t) => t.textContent).join('')).toBe(toHant(name));
		});
		expect(host.textContent).not.toMatch(/後/);
	});

	it('六壬简盘缩写字(drawSimpleText + 全称属性)与三式盘缩写节点:天后的「后」不成「後」', async () => {
		const host = mkSvg();
		const proto = RengChart.prototype;
		const fake = { alignTextVisualCenter(){}, bindSimpleTip(){} };
		JIANG.forEach((name) => {
			proto.drawSimpleText.call(fake, d3.select(host), proto.getShortJiang.call(fake, name), 0, 0, { scriptAttrs: tianJiangShortAttrs(name), visualAlign: false });
		});
		const board = document.createElement('div');
		JIANG.forEach((name) => {
			const el = document.createElement('div');
			const attrs = tianJiangShortAttrs(name);
			Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
			el.textContent = sanshiShort(name);
			board.appendChild(el);
		});
		document.body.appendChild(board);
		await applyScriptMode(SCRIPT_HANT);
		const want = JIANG.map((n) => {
			const s = shortTianJiang(n);
			return Array.from(toHant(n))[Array.from(n).indexOf(s)];
		});
		expect(Array.from(host.querySelectorAll('text')).map((t) => t.textContent)).toEqual(want);
		expect(Array.from(board.children).map((t) => t.textContent)).toEqual(want);
		expect(want[11]).toBe('后');
	});
});

describe('界面繁体:圆盘天将环(六壬圆盘式 / 方盘悬停预览 / 金口诀主盘)逐字画字也按整词定字', () => {
	it('LRCircleChart 天将环:整张 svg 里没有「後」,每段 = 整词转换', async () => {
		const LRCircleChart = require('../LRCircleChart').default;
		const host = mkSvg();
		const chart = Object.create(LRCircleChart.prototype);
		Object.assign(chart, { owner: d3.select(host), ox: 100, oy: 100, r: 90, step: 18, houseTianJiang: JIANG.slice(), circles: [], bindHouseTooltip(){} });
		Object.defineProperty(chart, 'tianJiangColor', { value: 'red' });
		chart.drawTianJiangCircle();
		await applyScriptMode(SCRIPT_HANT);
		expect(host.querySelectorAll('text').length).toBe(JIANG.join('').length);
		expect(host.textContent).toBe(JIANG.map((n) => toHant(n)).join(''));
		expect(host.textContent).not.toMatch(/後/);
	});
	it('金口诀主盘走的就是这条圆盘路(盘式常量恒为圆盘)', () => {
		const LRConst = require('../LRConst');
		expect(LRConst.LRChartType).toBe(LRConst.LRChart_Circle);
		const src = fs.readFileSync(path.join(__dirname, '../../jinkou/JinKouPanChart.js'), 'utf8');
		expect(src).toMatch(/new LRCircleChart\(/);
	});
});

describe('天将缩写单源(三式合一同步)', () => {
	it('六壬页与三式合一对十二将的缩写全等,且就是 LRConst 表', () => {
		JIANG.forEach((n) => {
			expect(RengChart.prototype.getShortJiang(n)).toBe(TIANJIANG_SHORT[n]);
			expect(sanshiShort(n)).toBe(TIANJIANG_SHORT[n]);
		});
		expect(TIANJIANG_SHORT['朱雀']).toBe('雀');
	});
	it('全仓只有 LRConst 一张天将缩写表', () => {
		const SRC = path.resolve(__dirname, '../../..');
		const hits = [];
		(function walk(dir){
			fs.readdirSync(dir).forEach((f) => {
				const p = path.join(dir, f);
				if(fs.statSync(p).isDirectory()){
					if(f !== '__tests__' && f !== '.umi' && f !== '.umi-production' && f !== '.umi-test'){ walk(p); }
					return;
				}
				if(!/\.js$/.test(f)){ return; }
				const code = fs.readFileSync(p, 'utf8');
				// 同一处同时出现「螣蛇 → 蛇」「天后 → 后」两条映射 = 一张缩写表
				if(/['"]?螣蛇['"]?\s*:\s*['"]蛇['"]/.test(code) && /['"]?天后['"]?\s*:\s*['"]后['"]/.test(code)){
					hits.push(path.relative(SRC, p).split(path.sep).join('/'));
				}
			});
		})(SRC);
		expect(hits).toEqual(['components/liureng/LRConst.js']);
	});
});
