// 卜类子页「起卦之时」农历单源:没动左栏时也随全局时间算法(主盘农历恒真太阳时);小六壬 / 飞宫 / 皇极轨策 / 灵棋同用。
import { resolveDivinationNongli } from '../divinationTimeDraft';
import DateTime from '../../components/comp/DateTime';

const dt = (()=>{ const d = new DateTime(); d.setZone('+08:00'); return d.parse('2026-05-05 11:10:00', 'YYYY-MM-DD HH:mm:ss'); })();
const fields = (ta)=>({ date: { value: dt.clone() }, time: { value: dt.clone() }, zone: { value: '+08:00' }, lon: { value: '87e36' }, lat: { value: '43n48' }, gpsLon: { value: 87.6 }, gpsLat: { value: 43.8 }, timeAlg: { value: ta }, after23NewDay: { value: 1 } });
// 主盘回包带起盘参数:与 fields 同一起课时刻地点才拿它的农历
const chartWrap = { params: { birth: '2026-05-05 11:10:00', zone: '+08:00', lon: '87e36', lat: '43n48' }, chart: { nongli: { tag: 'chart' } } };

describe('卜类起卦农历单源', ()=>{
	test('全局真太阳时(0)、没动左栏 → 主盘农历', ()=>{
		expect(resolveDivinationNongli(null, fields(0), chartWrap)).toEqual({ tag: 'chart' });
	});
	test('主盘不是这一刻的(在途 / 取失败时还是上一刻的盘)→ 不拿它的农历,按全局 fields 本地派生', ()=>{
		const stale = { ...chartWrap, params: { ...chartWrap.params, birth: '2026-05-05 09:10:00' } };
		const nl = resolveDivinationNongli(null, fields(0), stale);
		expect(nl.tag).toBeUndefined();
		expect(nl.bazi && nl.bazi.time && nl.bazi.time.branch.cell).toBe('巳');
		// 换了地点同样不认
		expect(resolveDivinationNongli(null, fields(0), { ...chartWrap, params: { ...chartWrap.params, lon: '116e24' } }).tag).toBeUndefined();
	});
	test('全局直接时间(1)、没动左栏 → 按全局 fields 本地派生(不是主盘那份)', ()=>{
		const nl = resolveDivinationNongli(null, fields(1), chartWrap);
		expect(nl.tag).toBeUndefined();
	});
	test('动过左栏 → 按左栏派生', ()=>{
		const nl = resolveDivinationNongli(fields(0), fields(0), chartWrap);
		expect(nl.tag).toBeUndefined();
	});
	test('皇极轨策 / 灵棋都走这一单源', ()=>{
		const fs = require('fs');
		const path = require('path');
		const R = (f)=>fs.readFileSync(path.resolve(__dirname, '../../components', f), 'utf8');
		expect(R('guice/GuiceMain.js')).toContain('resolveDivinationNongli(this.state.localFields, this.props.fields, this.props.value)');
		expect(R('lingqi/LingQiMain.js')).toContain('resolveDivinationNongli(this.state.localFields, this.props.fields, this.props.value)');
	});
});
