// 技法页排盘设置单源件:校验 / 合并 / 坏数据 / 值形态严格 / 只收 schema 字段。
import { definePageSettings, validateSettingValue } from '../pageSettingsStore';

// 写入前置闸只放行登记过的键(未登记键在 jest 里直接抛),所以单测借一个真登记键来跑
const KEY = 'horosa.liureng.settings.v1';
const SCHEMA = {
	guireng: { def: 2, oneOf: [0, 1, 2] },
	yueJiang: { def: 'zhongqi', oneOf: ['zhongqi', 'jieqi', 'richan'] },
	shiRuKe: { def: false },
	orb: { def: 3, type: 'number', min: 0, max: 10 },
	count: { def: 5, type: 'number', int: true, min: 1, max: 9 },
	note: { def: '', type: 'string', maxLen: 8 },
};

describe('pageSettingsStore', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('空库读出缺省;缺省对象每次新建(不共享引用)', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		const a = st.load(); const b = st.load();
		expect(a).toEqual({ guireng: 2, yueJiang: 'zhongqi', shiRuKe: false, orb: 3, count: 5, note: '' });
		expect(a).not.toBe(b);
	});

	it('保存后重新定义一份 store(= 重开软件)仍读得回', ()=>{
		definePageSettings(KEY, SCHEMA).save({ guireng: 0, shiRuKe: true });
		const again = definePageSettings(KEY, SCHEMA).load();
		expect(again.guireng).toBe(0);
		expect(again.shiRuKe).toBe(true);
		expect(again.yueJiang).toBe('zhongqi');
	});

	it('逐字段合并:后一次保存不冲掉前一次保存的别的字段', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		st.save({ guireng: 1 });
		st.save({ yueJiang: 'jieqi' });
		expect(st.load()).toMatchObject({ guireng: 1, yueJiang: 'jieqi' });
	});

	it('只收 schema 里有的字段:通用 handler 丢进来的输入类字段一律忽略', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		const written = st.save({ guireng: 1, xuanShiZhi: '子', yanShuNum: '37' });
		expect(written).toEqual(['guireng']);
		expect(JSON.parse(window.localStorage.getItem(KEY)).values).toEqual({ guireng: 1 });
	});

	it('值形态严格:0 ≠ false、字符串数字 ≠ 数字、候选外的值不收', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		expect(st.save({ shiRuKe: 0 })).toEqual([]);
		expect(st.save({ shiRuKe: 'true' })).toEqual([]);
		expect(st.save({ guireng: '1' })).toEqual([]);
		expect(st.save({ guireng: 7 })).toEqual([]);
		expect(st.save({ yueJiang: 'nope' })).toEqual([]);
		expect(window.localStorage.getItem(KEY)).toBe(null);
		expect(st.load().shiRuKe).toBe(false);
	});

	it('数值边界 / 整数 / 字符串长度', ()=>{
		expect(validateSettingValue(SCHEMA.orb, 10).ok).toBe(true);
		expect(validateSettingValue(SCHEMA.orb, 10.5).ok).toBe(false);
		expect(validateSettingValue(SCHEMA.orb, -1).ok).toBe(false);
		expect(validateSettingValue(SCHEMA.orb, NaN).ok).toBe(false);
		expect(validateSettingValue(SCHEMA.count, 2.5).ok).toBe(false);
		expect(validateSettingValue(SCHEMA.count, 2).ok).toBe(true);
		expect(validateSettingValue(SCHEMA.note, '12345678').ok).toBe(true);
		expect(validateSettingValue(SCHEMA.note, '123456789').ok).toBe(false);
	});

	it('读端永不抛:不是 JSON / 形状不对 / 个别字段坏 → 坏的回缺省、好的照用', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		window.localStorage.setItem(KEY, '{not json');
		expect(st.load()).toEqual(st.defaults());
		window.localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
		expect(st.load()).toEqual(st.defaults());
		window.localStorage.setItem(KEY, JSON.stringify({ v: 1, values: { guireng: 9, yueJiang: 'jieqi', shiRuKe: 'x', ghost: 1 } }));
		expect(st.load()).toMatchObject({ guireng: 2, yueJiang: 'jieqi', shiRuKe: false });
	});

	it('保存时顺手清掉库里已经不合法 / 已下线的旧字段(schema 收窄后不留垃圾)', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ v: 1, values: { guireng: 9, ghost: 1, yueJiang: 'jieqi' } }));
		const st = definePageSettings(KEY, SCHEMA);
		st.save({ shiRuKe: true });
		expect(JSON.parse(window.localStorage.getItem(KEY)).values).toEqual({ yueJiang: 'jieqi', shiRuKe: true });
	});

	it('reset 回缺省;pick 只摘 schema 字段', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		st.save({ guireng: 0 });
		expect(st.reset()).toEqual(st.defaults());
		expect(window.localStorage.getItem(KEY)).toBe(null);
		expect(st.pick({ guireng: 1, liureng: {}, birth: 1 })).toEqual({ guireng: 1 });
	});

	it('map 型:逐子键校验,坏子键回该子键缺省、未知子键丢弃、好子键保留;不是对象才整体不收', ()=>{
		const st = definePageSettings(KEY, { school: { type: 'map', keys: { jishen: { def: 'default', oneOf: ['default', 'ni'] }, sanji: { def: 'default', oneOf: ['default', 'b'] } } } });
		expect(st.defaults()).toEqual({ school: { jishen: 'default', sanji: 'default' } });
		expect(st.save({ school: { jishen: 'ni', sanji: 'zzz', ghost: 1 } })).toEqual(['school']);
		expect(st.load().school).toEqual({ jishen: 'ni', sanji: 'default' });
		expect(st.save({ school: 'ni' })).toEqual([]);
		expect(st.save({ school: ['ni'] })).toEqual([]);
		expect(st.load().school).toEqual({ jishen: 'ni', sanji: 'default' });
	});

	it('稀疏 map(覆盖层):只留显式改过且合法的子键,缺席不补缺省;空对象合法(= 全部跟随预设)', ()=>{
		const st = definePageSettings(KEY, { ov: { type: 'map', sparse: true, keys: { mode: { def: 'a', oneOf: ['a', 'b'] }, strict: { def: false }, deg: { def: 3, oneOf: [2, 3, 5] } } } });
		expect(st.defaults()).toEqual({ ov: {} });
		expect(st.save({ ov: { mode: 'b', strict: 1, deg: 5, ghost: 'x' } })).toEqual(['ov']);
		expect(st.load().ov).toEqual({ mode: 'b', deg: 5 });        // strict: 1 不是布尔 → 丢;ghost 未知 → 丢;没有的键不补
		expect(st.save({ ov: {} })).toEqual(['ov']);                // 「恢复本档默认」= 存空对象
		expect(st.load().ov).toEqual({});
		expect(st.loadSaved()).toEqual({ ov: {} });
	});

	it('list 型:候选外的项丢掉、重复去重、空数组合法;不是数组才整体不收;缺省数组每次新建', ()=>{
		const st = definePageSettings(KEY, { lines: { type: 'list', def: ['a', 'b'], oneOf: ['a', 'b', 'c'] } });
		expect(st.defaults().lines).toEqual(['a', 'b']);
		expect(st.defaults().lines).not.toBe(st.defaults().lines);
		expect(st.save({ lines: ['c', 'c', 'zzz', 'a'] })).toEqual(['lines']);
		expect(st.load().lines).toEqual(['c', 'a']);
		expect(st.save({ lines: [] })).toEqual(['lines']);
		expect(st.load().lines).toEqual([]);
		expect(st.save({ lines: 'a' })).toEqual([]);
		expect(st.load().lines).toEqual([]);
	});

	it('saveMapEntry:只落这一次改的那个子键,以库里那份为底 —— 不把调用方 state 里别的子项带进库', ()=>{
		// 稀疏覆盖层:库里已有 { mode:'b' };界面 state 此刻是一份旧案回灌进来的 { mode:'a', flag:true }(库不知道),用户只改了 deg
		const sparse = definePageSettings(KEY, { ov: { type: 'map', sparse: true, keys: { mode: { def: '', oneOf: ['a', 'b'] }, flag: { def: false }, deg: { def: 0, type: 'number' } } } });
		sparse.save({ ov: { mode: 'b' } });
		expect(sparse.saveMapEntry('ov', 'deg', 5)).toEqual(['ov']);
		expect(sparse.loadSaved().ov).toEqual({ mode: 'b', deg: 5 });        // 旧案的 mode:'a' / flag:true 没有渗进来
		expect(sparse.saveMapEntry('ov', 'mode', undefined)).toEqual(['ov']);   // undefined = 撤销该覆盖(回到跟随预设)
		expect(sparse.loadSaved().ov).toEqual({ deg: 5 });
		expect(sparse.saveMapEntry('ov', 'deg', 'x')).toEqual([]);             // 值不合法 → 不写
		expect(sparse.saveMapEntry('ov', 'ghost', 1)).toEqual([]);             // 未知子键 → 不写
		expect(sparse.saveMapEntry('nope', 'deg', 1)).toEqual([]);             // 不是 map 字段 → 不写
		expect(sparse.loadSaved().ov).toEqual({ deg: 5 });
		// 整张表(非稀疏):以库里那份(缺的子键 = 缺省)为底
		window.localStorage.clear();
		const full = definePageSettings(KEY, { school: { type: 'map', keys: { jishen: { def: 'default', oneOf: ['default', 'ni'] }, youshen: { def: 'default', oneOf: ['default', 'shun'] } } } });
		expect(full.saveMapEntry('school', 'youshen', 'shun')).toEqual(['school']);
		expect(full.load().school).toEqual({ jishen: 'default', youshen: 'shun' });   // 没碰的子键仍是缺省(不是调用方 state 里的值)
		expect(full.saveMapEntry('school', 'youshen', undefined)).toEqual(['school']);
		expect(full.load().school).toEqual({ jishen: 'default', youshen: 'default' });
	});

	it('fillMissing:记录里没有的设置键回出厂值(不是库里保存的偏好);有的键原样;不改入参', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		st.save({ guireng: 0, yueJiang: 'jieqi', shiRuKe: true });            // 本机保存的偏好
		const fromCase = { yueJiang: 'richan', xuanShiZhi: '子' };            // 一份旧案:只带 yueJiang(和一个输入键)
		const out = st.fillMissing(fromCase);
		expect(out).toEqual({ yueJiang: 'richan', xuanShiZhi: '子', guireng: 2, shiRuKe: false, orb: 3, count: 5, note: '' });
		expect(fromCase).toEqual({ yueJiang: 'richan', xuanShiZhi: '子' });
		expect(st.fillMissing(null).guireng).toBe(2);
	});

	it('save 快路径:这次没有任何 schema 里的合法键 → 不读也不写存储(输入类键每次击键都会经过通用 handler)', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		const getSpy = jest.spyOn(Storage.prototype, 'getItem');
		const setSpy = jest.spyOn(Storage.prototype, 'setItem');
		expect(st.save({ xuanShiZhi: '子', yanShuNum: '37' })).toEqual([]);
		expect(st.save({ guireng: 'x' })).toEqual([]);                        // 是 schema 键但值不合法,同样不碰存储
		expect(getSpy).not.toHaveBeenCalled();
		expect(setSpy).not.toHaveBeenCalled();
		getSpy.mockRestore(); setSpy.mockRestore();
	});

	it('存储不可用(写入抛错)时不抛、本次调用照常返回', ()=>{
		const st = definePageSettings(KEY, SCHEMA);
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(()=>{ throw new Error('quota'); });
		expect(()=>st.save({ guireng: 1 })).not.toThrow();
		spy.mockRestore();
	});
});
