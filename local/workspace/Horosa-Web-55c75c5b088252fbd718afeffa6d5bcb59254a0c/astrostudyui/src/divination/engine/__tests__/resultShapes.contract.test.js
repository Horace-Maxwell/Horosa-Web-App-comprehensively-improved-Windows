// [卜卦改进 H0] 后端响应形状契约——双向看守:
//  ① 真形 fixture(realChartResult.json,1990-06-15 上海盘直录 :8899)上,八个读法函数产出非退化结果;
//  ② :8899 在线时,实时响应与 fixture 的**键形**逐项 diff(形状哨兵;离线 skip 不阻纯前端 CI)。
// 三死链(映点/互容/被围)之所以活到 2026-08,正因散落读法各自猜形状且 fixture 模拟了错误形状——
// 此后形状再漂移,先红在这里,不再静默死链。
import http from 'http';
import fixture from './fixtures/realChartResult.json';
import {
	antisciaPairsOf, mutualPairsOf, marsSaturnAttacksOf, benignSurroundsOf,
	besiegementOf, immediateAspOf, backendStarsOf, backendLotsOf,
} from '../resultShapes';

describe('resultShapes 契约(真形 fixture)', () => {
	it('antisciaPairsOf:chart.antiscias.{antiscia,cantiscia} 双桶统一,kind 标注', () => {
		const rows = antisciaPairsOf(fixture);
		expect(rows.length).toBeGreaterThan(0);
		rows.forEach((r) => {
			expect(typeof r.a).toBe('string');
			expect(typeof r.b).toBe('string');
			expect(Number.isFinite(r.orb)).toBe(true);
			expect(['antiscia', 'cantiscia']).toContain(r.kind);
		});
		expect(rows.some((r) => r.kind === 'antiscia')).toBe(true);
	});

	it('mutualPairsOf:{planetA,planetB} 真键名+strong/weak/mixed 分层', () => {
		const rows = mutualPairsOf(fixture);
		expect(rows.length).toBeGreaterThan(0);
		rows.forEach((r) => {
			expect(typeof r.a).toBe('string');
			expect(typeof r.b).toBe('string');
			expect(['strong', 'weak', 'mixed']).toContain(r.level);
		});
		// fixture 实录:Moon(exalt)×Venus(exalt) 双主尊贵=strong
		const mv = rows.find((r) => (r.a === 'Moon' && r.b === 'Venus') || (r.a === 'Venus' && r.b === 'Moon'));
		expect(mv && mv.level).toBe('strong');
	});

	it('marsSaturnAttacksOf:仅火土桶计凶围;benignSurroundsOf:吉围分桶不混入', () => {
		// fixture 实录:Jupiter 被火(90°)土(180°)围
		const rows = marsSaturnAttacksOf(fixture, 'Jupiter');
		expect(rows.length).toBeGreaterThanOrEqual(2);
		const ids = rows.map((r) => r.id);
		expect(ids).toContain('Mars');
		expect(ids).toContain('Saturn');
		// 语义陷阱锁:凶围函数绝不吐金木/日月桶的记录
		rows.forEach((r) => { expect(['Mars', 'Saturn']).toContain(r.id); });
		const benign = benignSurroundsOf(fixture, 'Jupiter');
		expect(Array.isArray(benign.venusJupiter)).toBe(true);
		expect(Array.isArray(benign.sunMoon)).toBe(true);
	});

	it('besiegementOf:十六式详断行(target/type/kind/besiegers)', () => {
		const rows = besiegementOf(fixture);
		expect(rows.length).toBeGreaterThan(0);
		const b = rows[0];
		expect(typeof b.target).toBe('string');
		expect(typeof b.kind).toBe('string');
		expect(Array.isArray(b.besiegers)).toBe(true);
		expect(b.besiegers[0].id).toBeTruthy();
	});

	it('immediateAspOf:每星 [{id,asp,orb}] 且按 orb 升序', () => {
		const rows = immediateAspOf(fixture, 'Moon');
		expect(rows.length).toBeGreaterThan(0);
		for(let i = 1; i < rows.length; i++){
			expect(rows[i].orb).toBeGreaterThanOrEqual(rows[i - 1].orb);
		}
	});

	it('backendStarsOf:按行星分桶的恒星命中表', () => {
		const map = backendStarsOf(fixture);
		const keys = Object.keys(map);
		expect(keys.length).toBeGreaterThan(0);
		const first = map[keys[0]][0];
		expect(typeof first.star).toBe('string');
		expect(Number.isFinite(first.orb)).toBe(true);
	});

	it('backendLotsOf:带 id/lon/sign 的点位数组(含福点/精神点)', () => {
		const rows = backendLotsOf(fixture);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.some((r) => `${r.id}`.includes('Fortun') || `${r.id}`.includes('Spirit'))).toBe(true);
		rows.forEach((r) => { expect(Number.isFinite(Number(r.lon))).toBe(true); });
	});

	it('全函数对缺失/畸形输入零抛安全(空集合语义)', () => {
		[null, undefined, {}, { chart: {} }, { surround: { attacks: 'garbage' } }].forEach((bad) => {
			expect(antisciaPairsOf(bad)).toEqual([]);
			expect(mutualPairsOf(bad)).toEqual([]);
			expect(marsSaturnAttacksOf(bad, 'Sun')).toEqual([]);
			expect(besiegementOf(bad)).toEqual([]);
			expect(immediateAspOf(bad, 'Moon')).toEqual([]);
			expect(backendStarsOf(bad)).toEqual({});
			expect(backendLotsOf(bad)).toEqual([]);
			expect(benignSurroundsOf(bad, 'Sun')).toEqual({ venusJupiter: [], sunMoon: [] });
		});
	});
});

describe('形状哨兵(:8899 在线才跑;形状漂移先红在这里)', () => {
	function probeAlive(){
		return new Promise((resolve) => {
			const req = http.request({ host: '127.0.0.1', port: 8899, path: '/healthz', method: 'GET', timeout: 2500 }, (res) => { resolve(res.statusCode === 200); res.resume(); });
			req.on('error', () => resolve(false));
			req.on('timeout', () => { req.destroy(); resolve(false); });
			req.end();
		});
	}
	function fetchChart(){
		const body = JSON.stringify({ date: '1990/06/15', time: '10:30:00', zone: '+08:00', lat: '31n14', lon: '121e28', hsys: 2 });
		return new Promise((resolve) => {
			const req = http.request({ host: '127.0.0.1', port: 8899, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 20000 }, (res) => {
				let buf = '';
				res.on('data', (d) => { buf += d; });
				res.on('end', () => { try{ resolve(JSON.parse(buf)); }catch(e){ resolve(null); } });
			});
			req.on('error', () => resolve(null));
			req.on('timeout', () => { req.destroy(); resolve(null); });
			req.write(body); req.end();
		});
	}

	it('实时响应与 fixture 键形逐项一致(路径/桶名/元素键)', async () => {
		const alive = await probeAlive();
		if(!alive){
			// eslint-disable-next-line no-console
			console.warn('[resultShapes] :8899 不在线,形状哨兵跳过');
			return;
		}
		const live = await fetchChart();
		expect(live && live.chart).toBeTruthy();
		// 路径级
		expect(live.chart.antiscias && typeof live.chart.antiscias).toBe('object');
		expect(Array.isArray(live.chart.antiscias.antiscia)).toBe(true);
		expect(Array.isArray(live.chart.antiscias.cantiscia)).toBe(true);
		// 互容元素键
		const m0 = (live.mutuals && live.mutuals.normal || [])[0];
		if(m0){
			expect(m0.planetA && m0.planetA.id).toBeTruthy();
			expect(Array.isArray(m0.planetA.rulerShip)).toBe(true);
		}
		// attacks 分桶
		const at = live.surround && live.surround.attacks;
		expect(at && typeof at).toBe('object');
		const slot = at[Object.keys(at)[0]];
		if(slot){
			['MarsSaturn', 'VenusJupiter', 'SunMoon', 'MinDelta'].forEach((k) => {
				expect(Array.isArray(slot[k])).toBe(true);
			});
		}
		// immediateAsp
		const ia = live.aspects && live.aspects.immediateAsp;
		expect(ia && typeof ia).toBe('object');
		// 契约函数在 live 上非退化
		expect(antisciaPairsOf(live).length).toBeGreaterThan(0);
		expect(backendLotsOf(live).length).toBeGreaterThan(0);
	}, 40000);
});
