// 六壬事盘「卜卦人出生档」随存 → 载回红绿锁。
// 现象(用户实报):管理事盘 → 应用事盘,每次打开行年都变成 0 岁。
// 病理:事盘此前不存卜卦人出生档;载回(或重开应用)后本页出生档 = 缺省(=占时),行年按「占时年 − 占时年」重算 = 0 岁,
//   把存档里的行年冲掉。修法:存档 payload 带 birthDraft,restoreFromCurrentCase 回灌 birth / calcBirth / runyear。
// 本锁走真组件实例的 clickSaveCase → JSON 往返(落库形态)→ 新实例 restoreFromCurrentCase,不自造事件形状。
import DateTime from '../../comp/DateTime';

jest.mock('../../../utils/kentangCaseSave', ()=>{
	const actual = jest.requireActual('../../../utils/kentangCaseSave');
	return { ...actual, getKentangSavedCasePayload: jest.fn() };
});

const { getKentangSavedCasePayload } = require('../../../utils/kentangCaseSave');
const LiuRengModule = require('../LiuRengMain');
const LiuRengMain = LiuRengModule.default;
const { resolveDisplayRunYear } = LiuRengModule;

function dt(text, zone){ const d = new DateTime(); d.parse(text, 'YYYY-MM-DD HH:mm:ss'); d.setZone(zone || '+08:00'); return d; }
function guaFields(text){
	const t = dt(text);
	return {
		date: { value: t.clone() }, time: { value: t.clone() }, ad: { value: 1 }, zone: { value: '+08:00' },
		lat: { value: '26n06' }, lon: { value: '119e18' }, gpsLat: { value: 26.1 }, gpsLon: { value: 119.3 },
		pos: { value: '福州' }, gender: { value: 1 }, after23NewDay: { value: 0 }, lateZiHourUseNextDay: { value: 0 },
		guaAfter23NewDay: { value: 0 }, timeAlg: { value: 0 },
	};
}
function birthFields(text, gender){
	const t = dt(text);
	return {
		date: { value: t.clone() }, time: { value: t.clone() }, ad: { value: 1 }, zone: { value: '+08:00' },
		lat: { value: '26n06' }, lon: { value: '119e18' }, gpsLat: { value: 26.1 }, gpsLon: { value: 119.3 },
		gender: { value: gender }, after23NewDay: { value: 0 }, lateZiHourUseNextDay: { value: 0 },
	};
}
function mkInstance(fields, dispatch){
	const inst = new LiuRengMain({ fields, dispatch, techniqueScope: 'liureng' });
	inst.setState = function(next, cb){ this.state = { ...this.state, ...(typeof next === 'function' ? next(this.state) : next) }; if(cb){ cb(); } };
	return inst;
}

describe('六壬事盘:卜卦人出生档随存 → 载回后行年不归零', ()=>{
	const GUA = '2026-09-17 10:00:00';
	const SAVED_RUNYEAR = { age: 36, ageCycle: 36, year: '乙巳' };

	function saveCase(){
		const dispatch = jest.fn();
		const inst = mkInstance(guaFields(GUA), dispatch);
		inst.state = { ...inst.state, liureng: { nongli: {} }, calcFields: guaFields(GUA), runyear: SAVED_RUNYEAR, birth: birthFields('1990-03-15 08:30:00', 0), calcBirth: birthFields('1990-03-15 08:30:00', 0) };
		inst.clickSaveCase();
		expect(dispatch).toHaveBeenCalledTimes(1);
		const action = dispatch.mock.calls[0][0];
		expect(action.type).toBe('astro/openDrawer');
		return action.payload.record;
	}

	test('存:事盘 payload 带 birthDraft(出生日期 / 时间 / 时区 / 性别),record.gender 取卜卦人性别', ()=>{
		const record = saveCase();
		expect(record.caseType).toBe('liureng');
		expect(record.payload.birthDraft).toMatchObject({ date: '1990-03-15', time: '08:30:00', zone: '+08:00', gender: 0 });
		expect(record.gender).toBe(0);
		expect(record.payload.runyear).toBeTruthy();
	});

	test('判别向量:新开页面(出生档 = 缺省 = 占时)行年按年差回落 = 0 岁 —— 即用户看到的现象', ()=>{
		const fresh = mkInstance(guaFields(GUA), jest.fn());
		const shown = resolveDisplayRunYear(SAVED_RUNYEAR, fresh.state.calcBirth, guaFields(GUA));
		expect(shown.age).toBe(0);
	});

	test('载回:存档经 JSON 往返(落库形态)后回灌出生档与行年 ⇒ 行年 36 岁,不再归零', ()=>{
		const record = saveCase();
		const stored = JSON.parse(JSON.stringify(record.payload));
		getKentangSavedCasePayload.mockReturnValue({ caseVersion: 'cid-1|t-1', payload: stored });
		const fresh = mkInstance(guaFields(GUA), jest.fn());
		expect(fresh.restoreFromCurrentCase(true)).toBe(true);
		expect(fresh.state.calcBirth.date.value.format('YYYY-MM-DD')).toBe('1990-03-15');
		expect(fresh.state.birth.date.value.format('YYYY-MM-DD')).toBe('1990-03-15');
		expect(fresh.state.calcBirth.gender.value).toBe(0);
		expect(fresh.state.runyear).toEqual(stored.runyear);
		const shown = resolveDisplayRunYear(fresh.state.runyear, fresh.state.calcBirth, guaFields(GUA));
		expect(shown.age).toBe(36);
		// 同一条记录再点一次(force=false、同 caseVersion)不重复回放
		expect(fresh.restoreFromCurrentCase(false)).toBe(false);
	});

	test('旧档(无 birthDraft)载回:不抛、出生档保持缺省 —— 旧档没存出生档,需重填后再存一次', ()=>{
		const record = saveCase();
		const stored = JSON.parse(JSON.stringify(record.payload));
		delete stored.birthDraft;
		getKentangSavedCasePayload.mockReturnValue({ caseVersion: 'cid-2|t-2', payload: stored });
		const fresh = mkInstance(guaFields(GUA), jest.fn());
		expect(()=>fresh.restoreFromCurrentCase(true)).not.toThrow();
		expect(fresh.state.calcBirth.date.value.format('YYYY-MM-DD')).toBe('2026-09-17');
	});
});
