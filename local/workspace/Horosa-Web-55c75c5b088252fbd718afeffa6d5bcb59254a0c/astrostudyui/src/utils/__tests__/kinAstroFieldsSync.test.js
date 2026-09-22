// KinAstroMain fields→state 重同步（透传断链 L2）· 行为矩阵 + 接线哨兵。
//
// 防的 bug 类：宿主 didMount 把 fields 的性别/农历锚点拷进 state，载入命例（fields 变化）时
// didUpdate 只重取盘不重同步 → 一掌经/策天等 11 技法性别停留旧值。修法＝标记式值变化检测
// （fieldsSyncSrc），本套测试钉死其语义 + 源码哨兵防接线被删。
import fs from 'fs';
import path from 'path';
import { normBinaryGender, parseFieldsDateTime, computeKinFieldsResync } from '../kinAstroFieldsSync';

const KIN_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'kinastro', 'KinAstroMain.js'), 'utf8');

function mkFields({ date = '1990-05-18', time = '10:00:00', gender = 1, zone = '+08:00' } = {}){
	return {
		date: { value: { format: ()=>date } },
		time: { value: { format: ()=>time } },
		zone: { value: zone },
		lat: { value: '39.9' },
		lon: { value: '116.4' },
		gender: { value: gender },
	};
}

describe('computeKinFieldsResync 行为矩阵', ()=>{
	it('首次（标记 null）→ 全量同步：性别 + 三组农历锚点 + 标记；[挂载自检 F-21] 农历锚点真算（2000-12-31=庚辰腊月初六），南极公历月日不钳', ()=>{
		const patch = computeKinFieldsResync(mkFields({ date: '2000-12-31', gender: 0 }), null);
		expect(patch).toEqual({
			fieldsSyncSrc: { gender: '0', year: 2000, month: 12, day: 31 },
			gender: '0',
			lunarYear: 2000, lunarMonth: 12, lunarDay: 6,       // 演禽 真农历(此前把公历日钳 30 当农历日)
			// [Q-263/T-243] 南极 节月=节气月序(12/31 在大雪后小寒前=子月=11,非公历月 12)+ 时支按出生时辰(10:00=巳);公历日原样
			nanjiLunarYear: 2000, nanjiSolarMonth: 11, nanjiDay: 31, nanjiHourZhi: '巳',
			chunziLunarMonth: 12, chunziLunarDay: 6,            // 蠢子 真农历(与后端 auto 档 sxtwl 同口径)
		});
	});

	it('仅性别变（载入异性别命例）→ 只回 gender+标记，不动锚点', ()=>{
		const prev = { gender: '1', year: 1990, month: 5, day: 18 };
		const patch = computeKinFieldsResync(mkFields({ gender: 0 }), prev);
		expect(patch).toEqual({ fieldsSyncSrc: { gender: '0', year: 1990, month: 5, day: 18 }, gender: '0' });
	});

	it('仅生辰日期变 → 只回 8 个锚点+标记，不动 gender（保住技法内手动切换）', ()=>{
		const prev = { gender: '1', year: 1990, month: 5, day: 18 };
		const patch = computeKinFieldsResync(mkFields({ date: '1991-06-19' }), prev);
		expect(patch.gender).toBeUndefined();
		expect(patch.lunarYear).toBe(1991);
		expect(patch.nanjiDay).toBe(19);
		expect(patch.fieldsSyncSrc).toEqual({ gender: '1', year: 1991, month: 6, day: 19 });
	});

	it('🔴 无变化 → null（手动覆盖保全证明：无关 fields 变化绝不冲掉技法内手动选择）', ()=>{
		const prev = { gender: '1', year: 1990, month: 5, day: 18 };
		expect(computeKinFieldsResync(mkFields(), prev)).toBeNull();
	});

	it('性别归一口径：-1/女/Female → 与挂载首同步一致（未知作男、女系作女）', ()=>{
		expect(computeKinFieldsResync(mkFields({ gender: -1 }), null).gender).toBe('1');
		expect(computeKinFieldsResync(mkFields({ gender: '女' }), null).gender).toBe('0');
		expect(computeKinFieldsResync(mkFields({ gender: 'Female' }), null).gender).toBe('0');
		// -1（未知）归一后与 1（男）同值 → 从男盘载入未知性别盘不触发多余同步
		const prev = { gender: '1', year: 1990, month: 5, day: 18 };
		expect(computeKinFieldsResync(mkFields({ gender: -1 }), prev)).toBeNull();
	});

	it('空/残缺 fields → null（不抛不同步）', ()=>{
		expect(computeKinFieldsResync(null, null)).toBeNull();
		expect(computeKinFieldsResync({}, null)).toBeNull();
		expect(computeKinFieldsResync({ date: { value: null }, time: { value: null } }, null)).toBeNull();
	});

	it('normBinaryGender 归一表：女系→0，其余（含未知/-1/缺失/垃圾）→1', ()=>{
		['0', 0, '女', 'Female', 'female', 'F'].forEach((g)=>expect(normBinaryGender(g)).toBe('0'));
		['1', 1, -1, '-1', '男', 'Male', undefined, null, ''].forEach((g)=>expect(normBinaryGender(g)).toBe('1'));
	});

	it('parseFieldsDateTime 基础解析（迁址后回归锚）', ()=>{
		const dt = parseFieldsDateTime(mkFields({ date: '1977-06-03', time: '17:30:05', gender: 0 }));
		expect(dt).toMatchObject({ year: 1977, month: 6, day: 3, hour: 17, minute: 30, second: 5, gender: 0 });
	});
});

describe('KinAstroMain 接线哨兵（源码自省：重同步接线不许被删）', ()=>{
	it('从 utils/kinAstroFieldsSync 引入三函数', ()=>{
		expect(KIN_SRC).toMatch(/import \{ normBinaryGender, parseFieldsDateTime, computeKinFieldsResync \} from '..\/..\/utils\/kinAstroFieldsSync'/);
	});

	it('didMount 用 computeKinFieldsResync 做首次同步', ()=>{
		const i = KIN_SRC.indexOf('componentDidMount()');
		const j = KIN_SRC.indexOf('componentDidUpdate(', i);
		expect(i).toBeGreaterThan(0);
		expect(KIN_SRC.slice(i, j)).toContain('computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc)');
	});

	it('didUpdate 两分支（技法切换早退 + fields 变化）都接了重同步，且无重同步时仍 fetchPan', ()=>{
		const i = KIN_SRC.indexOf('componentDidUpdate(');
		const j = KIN_SRC.indexOf('componentWillUnmount(', i);
		const slice = KIN_SRC.slice(i, j);
		const hits = slice.split('computeKinFieldsResync(').length - 1;
		expect(hits).toBeGreaterThanOrEqual(2);
		expect(slice).toContain('this.fetchPan(this.props.fields)');
	});

	it('constructor 声明 fieldsSyncSrc 标记且不进 optionKeys 观察器', ()=>{
		expect(KIN_SRC).toContain('fieldsSyncSrc: null');
		const i = KIN_SRC.indexOf('const optionKeys = [');
		const j = KIN_SRC.indexOf('];', i);
		expect(KIN_SRC.slice(i, j)).not.toContain('fieldsSyncSrc');
	});
});
