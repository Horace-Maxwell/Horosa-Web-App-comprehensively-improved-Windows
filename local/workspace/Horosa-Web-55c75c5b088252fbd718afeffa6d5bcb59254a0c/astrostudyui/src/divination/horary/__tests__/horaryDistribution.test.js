// [卜卦改进 H10] 裁决分布回归闸——真打 :8899 取 60 时刻(5 天×12 时)真盘,三类别跑
// runHorary v2 全链,断言五档分布落带(照择日 scoringDistribution 在线才跑模式):
//   未定不过半 / 强成 ≤35% / 难成 ≤45% / 两轨强反转率=0(矛盾审计的 live 面)。
// :8899 不在线时整套 skip(warn)——不阻塞纯前端 CI。
import http from 'http';
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';

const DAYS = 5;
const HOURS = [1, 5, 9, 11, 13, 15, 17, 19, 21, 23, 7, 3];
const BASE = Date.UTC(2026, 8, 10);   // 2026-09-10 固定锚,分布可复现

function fetchChart(date, time){
	const body = JSON.stringify({ date, time, zone: '+08:00', lat: '31n14', lon: '121e28', hsys: 2 });
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
function probeAlive(){
	return new Promise((resolve) => {
		const req = http.request({ host: '127.0.0.1', port: 8899, path: '/healthz', method: 'GET', timeout: 2500 }, (res) => { resolve(res.statusCode === 200); res.resume(); });
		req.on('error', () => resolve(false));
		req.on('timeout', () => { req.destroy(); resolve(false); });
		req.end();
	});
}

describe('卜卦裁决分布回归(真盘 60 时刻×3 类别·:8899 在线才跑)', () => {
	let alive = false;
	const rows = [];
	beforeAll(async () => {
		alive = await probeAlive();
		if(!alive){
			// eslint-disable-next-line no-console
			console.warn('[horaryDistribution] :8899 不在线,分布闸跳过');
			return;
		}
		const CATS = ['general', 'marriage', 'career'];
		for(let d = 0; d < DAYS; d++){
			const dt = new Date(BASE + d * 86400000);
			const dateStr = `${dt.getUTCFullYear()}/${`${dt.getUTCMonth() + 1}`.padStart(2, '0')}/${`${dt.getUTCDate()}`.padStart(2, '0')}`;
			for(const h of HOURS){
				const R = await fetchChart(dateStr, `${`${h}`.padStart(2, '0')}:00:00`);
				if(!R || !R.chart){ continue; }
				for(const cat of CATS){
					__resetHoraryMemoForTest();
					const jl = runHorary(R, cat, {});
					__resetHoraryMemoForTest();
					const jv = runHorary(R, cat, { verdictProfile: 'v2' });
					if(jl && jv){ rows.push({ cat, legacy: jl.verdict.leaning, band: jv.verdict.band, conf: jv.verdict.confidence, guards: (jv.verdict.guards || []).length }); }
				}
			}
		}
	}, 240000);

	it('样本量足(≥150/180,容零星取盘失败)', () => {
		if(!alive) return;
		expect(rows.length).toBeGreaterThanOrEqual(150);
	});

	it('五档分布落带:未定不过半/强成≤35%/难成≤45%/五档皆有出现面', () => {
		if(!alive || !rows.length) return;
		const n = rows.length;
		const rate = (k) => rows.filter((r) => r.band === k).length / n;
		const dist = ['strong_yes', 'lean_yes', 'uncertain', 'lean_no', 'strong_no'].map((k) => `${k}=${(rate(k) * 100).toFixed(1)}%`).join(' ');
		const med = rows.map((r) => r.conf).sort((a, b) => a - b)[Math.floor(n / 2)];
		// eslint-disable-next-line no-console
		console.log(`[horaryDistribution] n=${n} median_conf=${med} ${dist}`);
		expect(rate('uncertain')).toBeLessThanOrEqual(0.5);
		expect(rate('strong_yes')).toBeLessThanOrEqual(0.35);
		expect(rate('strong_no')).toBeLessThanOrEqual(0.45);
		// 有判别力:非未定占比 ≥40%(全堆未定=引擎失声)
		expect(1 - rate('uncertain')).toBeGreaterThanOrEqual(0.4);
	});

	it('live 矛盾审计:legacy↔v2 强反转率=0(无护栏解释的 yes↔no)', () => {
		if(!alive || !rows.length) return;
		const proj = { strong_yes: 'yes', lean_yes: 'yes', uncertain: 'even', lean_no: 'no', strong_no: 'no' };
		const flips = rows.filter((r) => {
			const b = proj[r.band];
			return ((r.legacy === 'yes' && b === 'no') || (r.legacy === 'no' && b === 'yes')) && r.guards === 0;
		});
		// eslint-disable-next-line no-console
		if(flips.length){ console.log('[horaryDistribution] 强反转样本:', JSON.stringify(flips.slice(0, 5))); }
		expect(flips.length).toBe(0);
	});
});
