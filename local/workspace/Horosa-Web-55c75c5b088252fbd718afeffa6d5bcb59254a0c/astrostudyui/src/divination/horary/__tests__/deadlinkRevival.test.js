// [卜卦改进 H1] 三死链复活哨兵(:8899 在线才跑,离线 skip)。
// 三死链(映点成事/互容/被围)在离线测试网下活了很久——因为 fixture 模拟了错误形状。
// 本哨兵用**真后端真时刻**断言三条读法各自真的触发:形状再漂移/读法再错,这里先红。
// 时刻=1990-06-15 10:30 上海(与 H0 真形 fixture 同刻):实录互容 Moon×Venus(双 exalt=strong)、
// 木星被火(90°)土(180°)围、映点对若干——三链同刻全可判。
import http from 'http';
import { buildFacts } from '../../engine/chartFacts';
import { antiscionBetween } from '../../engine/aspectsEngine';
import { mutualReceptionBetween } from '../../engine/reception';
import { isBesieged } from '../../engine/conditions';
import { antisciaPairsOf } from '../../engine/resultShapes';
import { keyOfChartId } from '../../engine/utils';

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

describe('三死链复活哨兵(真后端真时刻)', () => {
	let facts = null;
	beforeAll(async () => {
		if(!(await probeAlive())){
			// eslint-disable-next-line no-console
			console.warn('[deadlinkRevival] :8899 不在线,复活哨兵跳过');
			return;
		}
		const R = await fetchChart();
		if(R && R.chart){ facts = buildFacts(R); }
	}, 60000);

	it('①映点:live 读法非退化;存在七政对则引擎必命中(此刻无七政对属天文实情,不算失败)', () => {
		if(!facts) return;
		const pairs = antisciaPairsOf(facts.result).filter((x) => x.kind === 'antiscia');
		expect(pairs.length).toBeGreaterThan(0);   // 读法路径活(旧读法此处恒 0)
		const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
		const hit = pairs.map((x) => ({ a: keyOfChartId(x.a), b: keyOfChartId(x.b) }))
			.find((x) => SEVEN.indexOf(x.a) >= 0 && SEVEN.indexOf(x.b) >= 0);
		if(hit){
			const r = antiscionBetween(facts, hit.a, hit.b);
			expect(r).toBeTruthy();
			expect(r.type).toBe('antiscion');
		}
	});

	it('①b 映点译层离线锚:合成注入七政对,antiscionBetween 必命中(不依赖时刻天象)', () => {
		const synth = { result: { chart: { antiscias: { antiscia: [['Venus', 'Jupiter', 0.8]], cantiscia: [['Sun', 'Mars', 0.5]] } } }, planets: {} };
		const r = antiscionBetween(synth, 'venus', 'jupiter');
		expect(r).toBeTruthy();
		expect(r.orb).toBe(0.8);
		// 对映点(cantiscia=隐冲)不入本函数——负向锁
		expect(antiscionBetween(synth, 'sun', 'mars')).toBe(null);
	});

	it('②互容:mutualReceptionBetween(moon, venus) 非 null 且 strong(实录双 exalt)', () => {
		if(!facts) return;
		const bands = mutualReceptionBetween(facts, 'moon', 'venus');
		expect(bands).toBeTruthy();
		expect(bands[0].strong).toBe(true);
	});

	it('③被围:isBesieged(jupiter) 真判(实录被火 90° 土 180° 围);金星无火土围=false(吉围不误判)', () => {
		if(!facts) return;
		expect(isBesieged('jupiter', facts)).toBe(true);
		expect(isBesieged('venus', facts)).toBe(false);
	});
});

// [H4a] 金矿接线 live 哨兵:福点前后端同值对账+后端恒星表非退化(两套口径分歧仅报告)。
describe('H4a 金矿 live 哨兵(:8899 在线才跑)', () => {
	let live = null;
	beforeAll(async () => {
		if(!(await probeAlive())){
			// eslint-disable-next-line no-console
			console.warn('[H4a live] :8899 不在线,金矿哨兵跳过');
			return;
		}
		live = await fetchChart();
	}, 60000);

	it('福点一致性:后端 chart.objects[Pars Fortuna] 与前端 buildLots 恒日式同值(<0.01°)', () => {
		if(!live || !live.chart) return;
		const pf = (live.chart.objects || []).find((o) => o.id === 'Pars Fortuna');
		expect(pf).toBeTruthy();
		const f = buildFacts(live);
		const { runHorary, __resetHoraryMemoForTest } = require('../horaryEngine');
		__resetHoraryMemoForTest();
		const j = runHorary(live, 'general', {});   // classical 默认 pofReversal=false=恒日式,与后端未传 lotReversal 同式
		expect(j.lots).toBeTruthy();
		const diff = Math.abs(j.lots.fortune.lon - pf.lon);
		expect(Math.min(diff, 360 - diff)).toBeLessThan(0.01);
		// 精神点对账:后端 lots[Pars Spirit]
		const ps = (live.lots || []).find((l) => l.id === 'Pars Spirit');
		if(ps){
			const d2 = Math.abs(j.lots.spirit.lon - ps.lon);
			expect(Math.min(d2, 360 - d2)).toBeLessThan(0.01);
		}
		expect(f).toBeTruthy();
	});

	it('后端恒星表非退化+与前端精选表口径分歧仅报告(两套并存:后端星历全表/前端 41 星判读集)', () => {
		if(!live || !live.chart) return;
		const { backendStarsOf } = require('../../engine/resultShapes');
		const map = backendStarsOf(live);
		expect(Object.keys(map).length).toBeGreaterThan(5);
		Object.keys(map).forEach((k) => {
			map[k].forEach((s) => { expect(typeof s.star).toBe('string'); expect(Number.isFinite(s.orb)).toBe(true); });
		});
	});
});
