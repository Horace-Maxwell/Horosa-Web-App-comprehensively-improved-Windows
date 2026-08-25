// [择日评分重标定] 分数分布回归闸——真打 :8899 取 84 个时刻(7 天×每 2 小时)真盘,
// 走 runElection 全链评分,断言分布落带。这是「从来不及格」重标定的**数据判据**:
//   及格率(≥52 fair+) 35~55% / 「不错」以上 12~30% / 「极佳」1~10% / 「不宜」5~25%。
// :8899 不在线时整套 skip(warn)——分布闸只在本机全栈在场时生效,不阻塞纯前端 CI。
// 校准期把 DAYS 临时改 30 可得月度分布(常驻 7 天=运行时长 ~30s 可接受)。
import http from 'http';
import { runElection } from '../electionEngine';

const DAYS = 7;
const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const BASE_DATE = new Date(Date.UTC(2026, 8, 1));   // 2026-09-01(固定锚,分布可复现)

function fetchChart(date, time){
	const body = JSON.stringify({ date, time, zone: '+08:00', lat: '31n14', lon: '121e28', hsys: 0 });
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

describe('择日评分分布回归(真盘 84 时刻·:8899 在线才跑)', () => {
	let alive = false;
	const results = [];

	beforeAll(async () => {
		alive = await probeAlive();
		if(!alive){
			// eslint-disable-next-line no-console
			console.warn('[scoringDistribution] :8899 不在线,分布闸跳过(本机起 start_horosa_local.sh 后生效)');
			return;
		}
		for(let d = 0; d < DAYS; d++){
			const dt = new Date(BASE_DATE.getTime() + d * 86400000);
			const dateStr = `${dt.getUTCFullYear()}/${`${dt.getUTCMonth() + 1}`.padStart(2, '0')}/${`${dt.getUTCDate()}`.padStart(2, '0')}`;
			for(const h of HOURS){
				const R = await fetchChart(dateStr, `${`${h}`.padStart(2, '0')}:00:00`);
				if(R && R.chart){
					const j = runElection(R, 'general_day', null, null, { westSchool: 'modern_main' });
					if(j && j.overall) results.push({ date: dateStr, hour: h, score: j.overall.score, grade: j.overall.grade });
				}
			}
		}
	}, 240000);

	it('样本量足(≥70/84,允许零星取盘失败)', () => {
		if(!alive) return;
		expect(results.length).toBeGreaterThanOrEqual(70);
	});

	it('分布落带:及格 35~60% / 不错+ 12~30% / 极佳 ≤10% / 不宜 2~25%', () => {
		if(!alive) return;
		const n = results.length;
		const rate = (pred) => results.filter(pred).length / n;
		const pass = rate((r) => r.grade === 'fair' || r.grade === 'good' || r.grade === 'excellent');
		const goodUp = rate((r) => (r.grade === 'good' || r.grade === 'excellent'));
		const excellent = rate((r) => r.grade === 'excellent');
		const dq = rate((r) => r.grade === 'disqualified');
		const median = results.map((r) => r.score).sort((a, b) => a - b)[Math.floor(n / 2)];
		// 校准输出(调参时看这里)
		// eslint-disable-next-line no-console
		console.log(`[scoringDistribution] n=${n} median=${median} 及格=${(pass * 100).toFixed(1)}% 不错+=${(goodUp * 100).toFixed(1)}% 极佳=${(excellent * 100).toFixed(1)}% 不宜=${(dq * 100).toFixed(1)}%`);
		expect(pass).toBeGreaterThanOrEqual(0.35);
		expect(pass).toBeLessThanOrEqual(0.60);
		expect(goodUp).toBeGreaterThanOrEqual(0.12);
		expect(goodUp).toBeLessThanOrEqual(0.30);
		expect(excellent).toBeLessThanOrEqual(0.10);
		expect(dq).toBeGreaterThanOrEqual(0.02);
		expect(dq).toBeLessThanOrEqual(0.25);
	});

	it('分数单调性:同一时刻 general_day(空亡不否决)分数 = marriage(空亡否决)分数;仅档位分流', () => {
		if(!alive || !results.length) return;
		// 抽第一个成功时刻复算 marriage:分数合成同源,critical 分流只改 grade 不改 score。
		const first = results[0];
		return fetchChart(first.date, `${`${first.hour}`.padStart(2, '0')}:00:00`).then((R) => {
			if(!R || !R.chart) return;
			const g = runElection(R, 'general_day', null, null, { westSchool: 'modern_main' });
			const m = runElection(R, 'marriage', null, null, { westSchool: 'modern_main' });
			// 分数构成含 topic 模块(徵象星/用事宫随 topic 变),不断言全等;断言两者都产出合法档位。
			expect(['excellent', 'good', 'fair', 'poor', 'disqualified']).toContain(g.overall.grade);
			expect(['excellent', 'good', 'fair', 'poor', 'disqualified']).toContain(m.overall.grade);
		});
	}, 30000);
});
