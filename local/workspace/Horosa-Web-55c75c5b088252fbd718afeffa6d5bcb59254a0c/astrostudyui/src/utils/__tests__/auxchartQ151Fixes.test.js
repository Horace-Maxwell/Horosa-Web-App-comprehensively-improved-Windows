// [Q-151/T-62…T-67] 辅盘族确证子项金标:AX-15①③④⑤⑥ / AX-16 / AX-17 / AX-19② / AX-20。
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { resolveRelZone } from '../../components/acg/AstroAcg';
import { clampHarmonic } from '../../components/auxchart/AstroHarmonicLab';
import { ELECTION_TOPICS, ELECTION_TOPIC_GROUPS } from '../../components/election/ElectionMain';
import { HORARY_PARAM_SPEC } from '../../divination/horary/horarySchools';

const R = (f)=>fs.readFileSync(path.resolve(__dirname, '../../', f), 'utf8');

describe('[Q-151] 辅盘族确证子项', ()=>{
	test('AX-15① B 盘时区:手填 +HH:MM 优先;否则按 B 盘经纬推断(纽约冬令 -05:00 / 夏令 -04:00);无经纬随 A 盘', ()=>{
		expect(resolveRelZone('-03:00', '40n43 74w00', moment('1992-03-10'), '+08:00')).toBe('-03:00');
		expect(resolveRelZone('', '40n43 74w00', moment('1992-01-10'), '+08:00')).toBe('-05:00');
		expect(resolveRelZone('', '40n43 74w00', moment('1992-07-10'), '+08:00')).toBe('-04:00');
		expect(resolveRelZone('', '', moment('1992-07-10'), '+08:00')).toBe('+08:00');
		expect(resolveRelZone('bad', 'x y', null, '+08:00')).toBe('+08:00');
	});
	test('AX-15③④⑤⑥ 源码哨兵:orb 改后重算落点 / 罗盘吃 lineVisible / 相位线标签 45·135 / 快照坐标系含站心', ()=>{
		const acg = R('components/acg/AstroAcg.js');
		expect(acg).toContain('onAfterChange={() => { const m = this.state.clickMarker; if (m) this.onMapClick(m.lat, m.lon); }}');
		expect(acg).toContain('lineVisible={(pk, field) => s.linesSet.has(`${pk}:${ACG_ANGLE_CONST[field]}`)}');
		expect(acg).toContain('相位线 60/90/120/45/135');
		expect(R('utils/acgSnapshot.js')).toContain("topo: '站心'");
	});
	test('AX-16 北纬置灰 / cosmo 流派 TNP 置灰(源码哨兵)', ()=>{
		expect(R('components/germany/MidpointMain.js')).toContain('disabled={northern}');
		expect(R('components/germany/UranianDialMain.js')).toContain("disabled={this.state.school === 'cosmo'}");
	});
	test('AX-17 exempt4 标签两处改「无入相＋四座豁免（中世纪）」', ()=>{
		const h = HORARY_PARAM_SPEC.find((f)=>f.key === 'vocMode').options.find((o)=>o.value === 'exempt4');
		expect(h && h.label).toBe('无入相＋四座豁免（中世纪）');
		expect(R('divination/election/electionParams.js')).toContain("{ value: 'exempt4', label: '无入相＋四座豁免（中世纪）' }");
		expect(R('divination/horary/horarySchools.js')).not.toContain('按座＋四座豁免');
	});
	test('AX-19② 「用药 / 服药」进用事表与医疗身体组;手术改单名', ()=>{
		expect(ELECTION_TOPICS.find((t)=>t.value === 'medication').label).toBe('用药 / 服药');
		expect(ELECTION_TOPICS.find((t)=>t.value === 'surgery').label).toBe('手术');
		expect(ELECTION_TOPIC_GROUPS.find((g)=>g.label === '医疗身体').values).toEqual(['surgery', 'medication', 'diet', 'haircut']);
		const grouped = ELECTION_TOPIC_GROUPS.reduce((a, g)=>a.concat(g.values), []);
		expect(grouped.sort()).toEqual(ELECTION_TOPICS.map((t)=>t.value).sort());   // 每个用事都在某组里
	});
	test('AX-20 调波数夹取整数 1-360;失败走 parkLoadFailure;龙盘有重试', ()=>{
		expect(clampHarmonic('')).toBe(9);
		expect(clampHarmonic('2.5')).toBe(2);
		expect(clampHarmonic('0')).toBe(1);
		expect(clampHarmonic('999')).toBe(360);
		expect(clampHarmonic(7)).toBe(7);
		const hl = R('components/auxchart/AstroHarmonicLab.js');
		const dl = R('components/auxchart/AstroDraconicLab.js');
		[hl, dl].forEach((src)=>{
			expect(src).toContain('parkLoadFailure(this, key);');
			expect(src).toContain('!loadParked(this, key)');
			expect(src).not.toMatch(/catch\(e\)\{[\s\S]{0,120}requestKey: key/);
		});
		expect(dl).toContain('>重试</Button>');
	});
});
