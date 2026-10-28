// 紫微本地引擎记忆键带四化流派与生效中的四化表:切流派 / 换自定义表后不再命中旧流派算出的星曜四化与格局。
import { localEngineMemoKey } from '../../components/ziwei/ZiWeiMain';
import * as ZWConst from '../../constants/ZWConst';

const BIRTH = { date: '1990/05/18', time: '12:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', ad: 1, gender: 1 };
const OPTS = { timeAlg: 0, lateZi: 'next', yearBoundary: 'lichun' };

const saved = { school: ZWConst.ZWSchool.school, override: ZWConst.ZWSihuaCustom.override };
afterEach(()=>{ ZWConst.ZWSchool.school = saved.school; ZWConst.ZWSihuaCustom.override = saved.override; window.localStorage.clear(); });

describe('紫微本地引擎记忆键', ()=>{
	test('同流派同表:键相同(记忆照常命中)', ()=>{
		ZWConst.ZWSchool.school = 'beipai';
		expect(localEngineMemoKey(BIRTH, OPTS, 'tian')).toBe(localEngineMemoKey(BIRTH, OPTS, 'tian'));
	});

	test('切四化流派:键不同', ()=>{
		ZWConst.ZWSchool.school = 'beipai';
		const a = localEngineMemoKey(BIRTH, OPTS, 'tian');
		ZWConst.ZWSchool.school = 'beixiang';
		const b = localEngineMemoKey(BIRTH, OPTS, 'tian');
		ZWConst.ZWSchool.school = 'zhongzhou';
		const c = localEngineMemoKey(BIRTH, OPTS, 'tian');
		expect(a).not.toBe(b);
		expect(a).not.toBe(c);
		expect(b).not.toBe(c);
	});

	test('自定义流派下换随盘 / 临时四化表:键不同', ()=>{
		ZWConst.ZWSchool.school = 'custom';
		ZWConst.ZWSihuaCustom.override = { 甲: ['廉贞', '破军', '武曲', '太阳'] };
		const a = localEngineMemoKey(BIRTH, OPTS, 'tian');
		ZWConst.ZWSihuaCustom.override = { 甲: ['廉贞', '破军', '太阳', '武曲'] };
		const b = localEngineMemoKey(BIRTH, OPTS, 'tian');
		expect(a).not.toBe(b);
	});

	test('排盘记忆走这把键', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '../../components/ziwei/ZiWeiMain.js'), 'utf8');
		expect(src).toMatch(/const memoKey = localEngineMemoKey\(birth, opts, ZWEngineOptions\.sanPan \|\| 'tian'\);/);
		expect(src).not.toMatch(/const memoKey = stableSignature\(birth, opts/);
	});
});
