// 量化盘:四个盘面共用的几何 / 提示小工具收口 uranianDialShared;走不到的 try / 零消费导出 已收掉,行为逐字不变。
import fs from 'fs';
import path from 'path';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { factorLabel } from '../../../data/uranianMeanings';
import { TAU, norm360, polar, glyphTip } from '../uranianDialShared';
import { saveUranianDisplay, getStoredUranianDisplay, URANIAN_DISPLAY_EVENT } from '../UranianDialStyle';
import * as UranianSchools from '../UranianSchools';

const DIR = path.resolve(__dirname, '..');
const raw = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

afterEach(() => { window.localStorage.clear(); });

describe('盘面共用小工具 uranianDialShared', () => {
	test('与原各盘内联版逐值相同', () => {
		const oldNorm = (x) => ((x % 360) + 360) % 360;
		const oldPolar = (cx, cy, R, deg) => { const a = deg / 360 * (Math.PI * 2); return [cx - R * Math.sin(a), cy - R * Math.cos(a)]; };
		const oldTip = (id) => { const n = AstroText.AstroMsgCN[id] || id; const lab = factorLabel(id); return lab && lab !== n ? n + ' · ' + lab : n; };
		expect(TAU).toBe(Math.PI * 2);
		[-725, -30, 0, 15.5, 359.9, 360, 1000].forEach((v) => expect(norm360(v)).toBe(oldNorm(v)));
		[0, 45, 90, 180, 271.5, -90].forEach((d) => expect(polar(100, 80, 50, d)).toEqual(oldPolar(100, 80, 50, d)));
		[AstroConst.SUN, AstroConst.MOON, AstroConst.CUPIDO, AstroConst.ARIES_POINT, 'NoSuch'].forEach((id) => expect(glyphTip(id)).toBe(oldTip(id)));
	});
	test('0° 在正上、度数向左增(逆时针)', () => {
		const [x0, y0] = polar(0, 0, 10, 0);
		expect(x0).toBeCloseTo(0, 9); expect(y0).toBeCloseTo(-10, 9);
		const [x90, y90] = polar(0, 0, 10, 90);
		expect(x90).toBeCloseTo(-10, 9); expect(y90).toBeCloseTo(0, 9);
	});
	test('四个盘面从 uranianDialShared 引,不再各带一份', () => {
		const sites = {
			'UranianDial.js': 'TAU, norm360, polar, glyphTip',
			'UranianCosmogram.js': 'TAU, norm360, polar, glyphTip',
			'UranianModulusDial.js': 'TAU, norm360, polar, glyphTip',
			'UranianFrameWheel.js': 'TAU, norm360, polar',
		};
		Object.entries(sites).forEach(([f, names]) => {
			const src = strip(raw(f));
			expect(`${f}:${src.includes(`import { ${names} } from './uranianDialShared';`)}`).toBe(`${f}:true`);
			expect(`${f}:${/const (TAU|norm360|polar|glyphTip)\s*=/.test(src)}`).toBe(`${f}:false`);
		});
		expect(raw('UranianDial.js')).not.toContain('AstroHelper.signsBand');
	});
});

describe('显示偏好写入 saveUranianDisplay', () => {
	test('返回合并值、落盘、派发事件(detail = 合并值)', () => {
		const got = [];
		const h = (e) => got.push(e.detail);
		window.addEventListener(URANIAN_DISPLAY_EVENT, h);
		const merged = saveUranianDisplay({ showHouseFrames: false, orb: 2 });
		window.removeEventListener(URANIAN_DISPLAY_EVENT, h);
		expect(merged.showHouseFrames).toBe(false);
		expect(merged.orb).toBe(2);
		expect(getStoredUranianDisplay().showHouseFrames).toBe(false);
		expect(got).toEqual([merged]);
	});
	test('序列化失败也照常返回合并值并派发(写盘失败不影响返回值与广播)', () => {
		const got = [];
		const h = (e) => got.push(e.detail);
		window.addEventListener(URANIAN_DISPLAY_EVENT, h);
		const merged = saveUranianDisplay({ orb: 3, bad: BigInt(1) });
		window.removeEventListener(URANIAN_DISPLAY_EVENT, h);
		expect(merged.orb).toBe(3);
		expect(got).toEqual([merged]);
		expect(window.localStorage.getItem('horosa.uranian.dial.v1')).toBe(null);
	});
	test('源码:合并值只算一次,派发不包 try', () => {
		const src = strip(raw('UranianDialStyle.js'));
		const i = src.indexOf('export function saveUranianDisplay');
		const body = src.slice(i, src.indexOf('\n}', i));
		expect(body.split('getStoredUranianDisplay()').length - 1).toBe(1);
		expect(body).not.toMatch(/try\s*\{\s*if \(typeof window/);
	});
});

describe('六宫框开关 / RO 断开 / 零消费导出', () => {
	test('AstroGermany 直接读显示偏好(getStoredUranianDisplay 自身永不抛)', () => {
		const src = strip(raw('AstroGermany.js'));
		expect(src).toContain('const showFrames = getStoredUranianDisplay().showHouseFrames !== false;');
		expect(src).not.toMatch(/try\s*\{\s*showFrames\s*=/);
	});
	test('UranianHouseFrames / UranianDialMain 的 RO 断开不包 try', () => {
		['UranianHouseFrames.js', 'UranianDialMain.js'].forEach((f) => {
			const src = strip(raw(f));
			expect(`${f}:${src.includes('if (this._ro){ this._ro.disconnect(); this._ro = null; }')}`).toBe(`${f}:true`);
			expect(`${f}:${/try\s*\{\s*this\._ro\.disconnect\(\)/.test(src)}`).toBe(`${f}:false`);
		});
	});
	test('UranianSchools 不再导出零消费的 SCHOOL 枚举(在用的 SCHOOL_OPTIONS 照旧)', () => {
		expect('SCHOOL' in UranianSchools).toBe(false);
		expect(UranianSchools.SCHOOL_OPTIONS.map((o) => o.value)).toEqual(['classic', 'pure', 'uranian', 'cosmo']);
	});
});
