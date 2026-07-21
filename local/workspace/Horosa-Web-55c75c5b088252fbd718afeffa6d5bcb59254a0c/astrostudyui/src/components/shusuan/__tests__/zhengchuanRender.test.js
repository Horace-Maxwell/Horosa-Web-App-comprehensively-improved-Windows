// 神数正传 组件渲染冒烟（SSR，捕获运行时 JSX 错误）+ 「切流派中右栏必须都变」实证。
// jest 测不到真实控件，但能测「opts 一变 → 产出一变」这条最容易断的链。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import moment from 'moment';
import ZhengChuanMain from '../ZhengChuanMain';

const fields = {
	date: { value: moment('1953-06-24') },
	time: { value: moment('1953-06-24 10:00:00') },
	gender: { value: 1 },
	timeAlg: { value: 1 },
	lon: { value: '' },
};
const render = (opts, slot = 'center') =>
	renderToStaticMarkup(<ZhengChuanMain slot={slot} fields={fields} opts={opts} />);

const SCHOOLS = [['tieban'], ['shaozi'], ['dading'], ['liuqin'], ['xinyi']];

describe('神数正传 · 渲染冒烟', () => {
	// 🔴 中栏须是【一张盘】—— 骨架照数算诸兄弟。此前只验一层 .horosa-zhengchuan-page 容器,
	//    而那层恰是断宽度传导的元凶(board-host 为 clamp(640,82%,1080)，中间夹一层即失效,
	//    实测盘撑到 1040px 而其 stage 仅 873px → 标题被裁、年柱出界、现横向滚动条)，已去。
	//    今改验真骨架:盘 + 页眉 + 盘题 + 乾坤造。
	test.each(SCHOOLS)('%s 流派 中栏是一张盘（骨架同数算诸兄弟）', (school) => {
		const h = render({ school });
		expect(h).toBeTruthy();
		expect(h).toContain('horosa-zhengchuan-board');
		expect(h).toContain('horosa-huangji-board-header');
		expect(h).toContain('horosa-taixuan-title');
		expect(h).toMatch(/乾造|坤造/);
	});
	test.each(SCHOOLS.filter(([s]) => s !== 'xinyi'))('%s 流派 中栏出四柱（数算诸盘皆以此起手）', (school) => {
		const h = render({ school });
		expect(h.match(/horosa-shenyishu-pillar-card/g)).toHaveLength(4);
		expect(h).toContain('年柱');
		expect(h).toContain('时柱');
	});
	test('心易为查询层（无生辰）→ 不出四柱，但盘仍成', () => {
		const h = render({ school: 'xinyi' });
		expect(h).toContain('horosa-zhengchuan-board');
		expect(h).not.toContain('horosa-shenyishu-pillar-card');
	});

	test.each(SCHOOLS)('%s 流派 右栏渲染不抛', (school) => {
		expect(render({ school }, 'aux')).toBeTruthy();
	});

	test('无生辰时给空态，不抛', () => {
		const h = renderToStaticMarkup(<ZhengChuanMain slot="center" fields={{}} opts={{ school: 'tieban' }} />);
		expect(h).toContain('horosa-huangji-empty');
	});

	test('心易为查询层 → 无生辰亦出内容（不受「请先填写生辰」空态所拦）', () => {
		const h = renderToStaticMarkup(<ZhengChuanMain slot="center" fields={{}} opts={{ school: 'xinyi', item: '父母', sound: '日' }} />);
		expect(h).toContain('horosa-zhengchuan-board');
		expect(h).not.toContain('horosa-huangji-empty');
	});
});

describe('神数正传 · 切流派/改选项 → 中右栏都必须变（防「勾了没反应」）', () => {
	test.each([['center'], ['aux']])('五流派两两产出互异（%s 栏）', (slot) => {
		const outs = SCHOOLS.map(([school]) => render({ school }, slot));
		const pairs = [];
		outs.forEach((x, i) => outs.forEach((y, j) => { if (i < j && x === y) pairs.push(`${SCHOOLS[i]}=${SCHOOLS[j]}`); }));
		expect(pairs).toEqual([]);
		expect(new Set(outs).size).toBe(5);
	});

	test('六亲：改「演算时辰」→ 中栏变（四象走天/地两表，动爻随之改）', () => {
		const a = render({ school: 'liuqin', askHourZhi: '午', env: '晴' });
		const b = render({ school: 'liuqin', askHourZhi: '子', env: '明' });
		expect(a).not.toBe(b);
	});

	test('六亲：改「天象」→ 中栏变（同时辰不同天象取不同四象）', () => {
		const a = render({ school: 'liuqin', askHourZhi: '午', env: '晴' });
		const b = render({ school: 'liuqin', askHourZhi: '午', env: '雨' });
		expect(a).not.toBe(b);
	});

	test.each([['item', '父母', '兄弟'], ['sound', '日', '月'], ['ke', '一刻', '八刻'], ['gong', '乾', '坤'], ['xqZhi', '子', '午'], ['xqYushu', '1', '12']])(
		'心易：改「%s」→ 中右栏都变（查询层每个选项都真实生效）', (key, v1, v2) => {
			const base = { school: 'xinyi', item: '父母', sound: '日', ke: '一刻', gong: '乾', xqZhi: '子', xqYushu: '1' };
			['center', 'aux'].forEach((slot) => {
				const a = render({ ...base, [key]: v1 }, slot);
				const b = render({ ...base, [key]: v2 }, slot);
				expect(a).not.toBe(b);
			});
		});

	test('铁板：改「求测时辰」→ 中栏变（日命数/时运数皆由求测时辰而来）', () => {
		const a = render({ school: 'tieban', askGz: '丙辰' });
		const b = render({ school: 'tieban', askGz: '己巳' });
		expect(a).not.toBe(b);
	});

	test('邵子：改「父/母年龄」→ 中栏变（天命数/地命数随之改）', () => {
		const base = { school: 'shaozi', fatherAge: '27', motherAge: '26' };
		expect(render(base)).not.toBe(render({ ...base, fatherAge: '28' }));
		expect(render(base)).not.toBe(render({ ...base, motherAge: '30' }));
	});

	test('邵子：改「元运」→ 仅在先天命卦余五时影响；不抛且可切', () => {
		['shang', 'zhong', 'xia'].forEach((yuan) => {
			expect(render({ school: 'shaozi', yuan })).toBeTruthy();
		});
	});

	test('大定：改「虚岁」→ 中栏变（每岁虚加17 直接进链）', () => {
		const a = render({ school: 'dading', age: '40' });
		const b = render({ school: 'dading', age: '41' });
		expect(a).not.toBe(b);
	});

	test('大定：改「大运/小运/岁君」→ 中栏变（七位策积随之改）', () => {
		const base = { school: 'dading', age: '40', dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯' };
		expect(render(base)).not.toBe(render({ ...base, dayun: '丁未' }));
		expect(render(base)).not.toBe(render({ ...base, xiaoyun: '丙午' }));
		expect(render(base)).not.toBe(render({ ...base, suijun: '壬辰' }));
	});
});

describe('神数正传 · 渲染产物不得漏出字面 null/undefined（live 抓出：无标记之格曾打成「null 2733」）', () => {
	test.each(SCHOOLS)('%s 流派 中右栏皆无字面 null/undefined/NaN/[object', (school) => {
		['center', 'aux'].forEach((slot) => {
			const h = render({ school, item: '父母', sound: '日', ke: '一刻', gong: '乾', xqZhi: '子', xqYushu: '1' }, slot);
			const text = h.replace(/<[^>]*>/g, ' ');
			['null', 'undefined', 'NaN', '[object'].forEach((bad) => expect(text).not.toContain(bad));
		});
	});

	test('心易·有标记之格仍照出标记（官禄「去」声分标 ×／●○）', () => {
		const h = render({ school: 'xinyi', item: '官祿', sound: '去' }, 'aux');
		expect(h).toContain('2412');
		expect(h).toContain('●○');
	});
});

describe('神数正传 · 边界', () => {
	test('极端虚岁不抛', () => {
		['1', '120'].forEach((age) => expect(render({ school: 'dading', age })).toBeTruthy());
	});

	test('父母年龄整除12（走特例公式）不抛', () => {
		expect(render({ school: 'shaozi', fatherAge: '24', motherAge: '36' })).toBeTruthy();
	});

	test('空 opts 走默认流派，不抛', () => {
		const h = render({});
		expect(h).toContain('horosa-zhengchuan-board');
		expect(h).toContain('铁板神数');   // 默认流派之名，取自单一源
	});
});
