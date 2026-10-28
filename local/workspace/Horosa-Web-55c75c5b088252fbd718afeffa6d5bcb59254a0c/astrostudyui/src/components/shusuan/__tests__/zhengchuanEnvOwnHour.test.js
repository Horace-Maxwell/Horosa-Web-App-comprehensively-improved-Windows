// 神数正传·六亲:演算时辰留空 = 取本人时支。天象下拉此时按本人时支只列那一套档,显示的就是引擎实际所用的天象
// (此前两套都列:夜生人选「晴（白天）」下拉一直显示晴,引擎按地四象首项「明」算)。
import DateTime from '../../comp/DateTime';
import ZhengChuanMain from '../ZhengChuanMain';
import KinAstroMain from '../../kinastro/KinAstroMain';
import { zcEnvOptionsFor, zcEnvShown, ZC_ENV_NIGHT } from '../../kinastro/kinastroOptions';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const mkFields = (h)=>{
	const dt = new DateTime({ year: 1990, month: 5, date: 18, hour: h, minute: 0, second: 0, ad: 1, zone: '+08:00' });
	return { date: { value: dt.clone() }, time: { value: dt.clone() }, zone: { value: '+08:00' }, ad: { value: 1 }, lon: { value: '120e00' }, lat: { value: '31n00' }, gender: { value: 1 }, timeAlg: { value: 1 } };
};

describe('正传天象下拉随本人时支', ()=>{
	test('正传盘提交后回报本人时支,同一时支只报一次', ()=>{
		const got = [];
		const inst = new ZhengChuanMain({ fields: mkFields(22), gender: 1, opts: { school: 'liuqin' }, onOwnHourZhi: (z)=>got.push(z) });
		inst.reportOwnHourZhi();
		inst.reportOwnHourZhi();
		expect(got).toEqual(['亥']);
		inst.props = { ...inst.props, fields: mkFields(10) };
		inst.reportOwnHourZhi();
		expect(got).toEqual(['亥', '巳']);
	});
	test('宿主:演算时辰留空用回报的本人时支;选了时辰以所选为准;都没有时两套都列', ()=>{
		const eff = (state)=>KinAstroMain.prototype.zcEffectiveAskHourZhi.call({ state });
		expect(eff({ zhengchuanAskHourZhi: '', zcOwnHourZhi: '亥' })).toBe('亥');
		expect(eff({ zhengchuanAskHourZhi: '午', zcOwnHourZhi: '亥' })).toBe('午');
		expect(eff({ zhengchuanAskHourZhi: '' })).toBe('');
		// 夜生人留空时:只列地四象,选过的「晴」显示为「按时辰取首项」(引擎正是按首项「明」算)
		expect(zcEnvOptionsFor(eff({ zhengchuanAskHourZhi: '', zcOwnHourZhi: '亥' }))).toEqual(ZC_ENV_NIGHT);
		expect(zcEnvShown(eff({ zhengchuanAskHourZhi: '', zcOwnHourZhi: '亥' }), '晴')).toBe('');
		const fs = require('fs'); const path = require('path');
		const host = fs.readFileSync(path.join(__dirname, '../../kinastro/KinAstroMain.js'), 'utf8');
		expect(host).toContain('<Select value={zcEnvShown(this.zcEffectiveAskHourZhi(), this.state.zhengchuanEnv)}');
		expect((host.match(/onOwnHourZhi=\{this\.onZcOwnHourZhi\}/g) || []).length).toBe(2);
	});
});

// AI 挂载齿轮同病:演算时辰留空时齿轮也按本人时支只列一组、回显引擎实际所用的天象(此前两组都列、回显原值)
describe('挂载齿轮「演算时天象」随本人时支', ()=>{
	const { mountDraftContextFor } = require('../../../utils/aiAnalysisContext');
	const TMS = require('../../../utils/techniqueMountSettings');
	const env = TMS.getTechniqueSettingsSchema('zhengchuan').fields.find((f)=>f.name === 'zcEnv');
	const rec = (hhmm)=>({ cid: 'zc', name: 'QA', birth: `1990-05-18 ${hhmm}:00`, zone: '+08:00', lon: '120e00', lat: '31n00', gpsLon: 120, gpsLat: 31, ad: 1, gender: 1, timeAlg: 1 });
	test('抽屉上下文按本盘四柱给出本人时支(与无头重算同一份四柱)', ()=>{
		expect(mountDraftContextFor('zhengchuan', rec('22:00'))).toEqual({ __zcOwnHourZhi: '亥' });
		expect(mountDraftContextFor('zhengchuan', rec('10:00'))).toEqual({ __zcOwnHourZhi: '巳' });
		expect(mountDraftContextFor('bazi', rec('22:00'))).toBeNull();
		expect(mountDraftContextFor('zhengchuan', null)).toBeNull();
	});
	test('夜生人留空:只列地四象,选过的「晴」回显「按时辰取首项」;选了时辰以所选为准;取不到本人时支时两组都列', ()=>{
		const ctx = mountDraftContextFor('zhengchuan', rec('22:00'));
		const d = { zcSchool: 'liuqin', zcAskHourZhi: '', zcEnv: '晴', ...ctx };
		expect(TMS.mountFieldOptions(env, d).map((o)=>o.value)).toEqual(['', ...ZC_ENV_NIGHT.map((o)=>o.value)]);
		expect(env.displayValue('晴', d)).toBe('');
		expect(TMS.mountFieldOptions(env, { ...d, zcAskHourZhi: '午' }).map((o)=>o.value)).toEqual(['', ...zcEnvOptionsFor('午').map((o)=>o.value)]);
		expect(TMS.mountFieldOptions(env, { zcSchool: 'liuqin', zcAskHourZhi: '', zcEnv: '' }).length).toBe(zcEnvOptionsFor('').length + 1);
	});
	test('只读上下文键不是字段:不计覆盖、不下发', ()=>{
		expect(TMS.pruneOptionsToNonDefault('zhengchuan', { zcSchool: 'liuqin', __zcOwnHourZhi: '亥' }, { zcSchool: 'liuqin' })).toEqual({});
		const src = readSource(require('path').join(__dirname, '../../aianalysis/AIAnalysisMain.js'));
		expect(src).toContain('draft={techniqueDraftContext ? { ...techniqueSettingsDraft, ...techniqueDraftContext } : techniqueSettingsDraft}');
	});
});

test('挂载齿轮:抽屉里改了时间算法,本人时支随之变(与应用后重算同一份四柱)', ()=>{
	const { mountDraftContextFor } = require('../../../utils/aiAnalysisContext');
	const rec = { cid: 'zc2', name: 'QA', birth: '1990-05-18 17:30:00', zone: '+08:00', lon: '100e00', lat: '30n00', gpsLon: 100, gpsLat: 30, ad: 1, gender: 1, timeAlg: 1 };
	const own = mountDraftContextFor('zhengchuan', rec).__zcOwnHourZhi;
	const alt = mountDraftContextFor('zhengchuan', rec, { timeAlg: 0 }).__zcOwnHourZhi;
	expect(own).not.toBe(alt);
	expect(mountDraftContextFor('zhengchuan', rec, { timeAlg: 1 }).__zcOwnHourZhi).toBe(own);
	const src = readSource(require('path').join(__dirname, '../../aianalysis/AIAnalysisMain.js'));
	expect(src).toContain('[techniqueSettingsKey, activeSource, techniqueDraftTimeAlg]');
});
