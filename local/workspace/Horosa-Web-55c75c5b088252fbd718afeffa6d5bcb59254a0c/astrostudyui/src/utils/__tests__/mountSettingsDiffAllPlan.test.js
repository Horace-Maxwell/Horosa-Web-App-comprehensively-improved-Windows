// 全技法齿轮差分闸分片计划的覆盖合同(分片 = mountSettingsDiffAll.<k>.test.js;计划 = mountSettingsDiffAllPlan.js)。
// 分片把「一个文件跑完全谱」拆成 N 个文件并行,最怕的是静默漏跑:某个齿轮没被任何分片领走,差分闸对它就永远不判了。
const fs = require('fs');
const path = require('path');
const { DIFFNET_SHARDS, KEY_SETUP_MS, diffnetUnits, planShards } = require('./mountSettingsDiffAllPlan');
const COSTS = require('./mountSettingsDiffAll.costs.json');

const ids = (xs)=>xs.map((u)=>u.id);

describe('全技法齿轮差分闸 · 分片计划合同', ()=>{
	const units = diffnetUnits();
	const shards = planShards(units, DIFFNET_SHARDS);

	it('全谱齿轮单位数 > 500 且 id 唯一(与分片前单文件的总数断言同口径)', ()=>{
		expect(units.length).toBeGreaterThan(500);
		expect(new Set(ids(units)).size).toBe(units.length);
	});

	it('🔴 每个齿轮恰好进一个分片(不漏不重),片内顺序同登记表', ()=>{
		expect(shards).toHaveLength(DIFFNET_SHARDS);
		const flat = shards.flatMap(ids);
		expect(flat.slice().sort()).toEqual(ids(units).slice().sort());
		const pos = new Map(ids(units).map((id, i)=>[id, i]));
		shards.forEach((s)=>{ const p = ids(s).map((id)=>pos.get(id)); expect(p).toEqual(p.slice().sort((a, b)=>a - b)); });
	});

	it('计划确定性:同一份登记表与耗时表两次分出同一结果', ()=>{
		expect(planShards(units, DIFFNET_SHARDS).map(ids)).toEqual(shards.map(ids));
	});

	it('🔴 分片文件 1..N 都在、各调自己那一片;不留旧的单文件(否则全谱跑两遍)', ()=>{
		const dir = __dirname;
		for(let k = 1; k <= DIFFNET_SHARDS; k += 1){
			const f = path.join(dir, `mountSettingsDiffAll.${k}.test.js`);
			expect(fs.existsSync(f)).toBe(true);
			const src = fs.readFileSync(f, 'utf8');
			expect(src.match(/defineDiffNetShard\((\d+)\)/g)).toEqual([`defineDiffNetShard(${k})`]);
		}
		const extra = fs.readdirSync(dir).filter((f)=>/^mountSettingsDiffAll\.(\d+)\.test\.js$/.test(f) && Number(f.split('.')[1]) > DIFFNET_SHARDS);
		expect(extra).toEqual([]);
		expect(fs.existsSync(path.join(dir, 'mountSettingsDiffAll.test.js'))).toBe(false);
	});


	it('判别向量:LPT 把大单位分开、同技法优先同片、漏分会被抓到', ()=>{
		const u = [
			{ key: 'a', name: 'x', id: 'a.x' }, { key: 'a', name: 'y', id: 'a.y' },
			{ key: 'b', name: 'x', id: 'b.x' }, { key: 'b', name: 'y', id: 'b.y' },
		];
		const c = { 'a.x': 100000, 'b.x': 100000, 'a.y': 10, 'b.y': 10 };
		const two = planShards(u, 2, c);
		// 两个大单位各占一片;小单位跟着自己技法的大单位走(少算一份基线)
		expect(two.map(ids).map((s)=>s.slice().sort())).toEqual([['a.x', 'a.y'], ['b.x', 'b.y']]);
		// 一片:全部按登记表顺序
		expect(ids(planShards(u, 1, c)[0])).toEqual(['a.x', 'a.y', 'b.x', 'b.y']);
		// 片数多于单位:多出的片为空,不丢单位
		const many = planShards(u, 6, c);
		expect(many.flatMap(ids).sort()).toEqual(['a.x', 'a.y', 'b.x', 'b.y']);
		expect(KEY_SETUP_MS).toBeGreaterThan(0);
	});

	it('负载均衡:按耗时表估的最重分片不超过平均的 1.35 倍(耗时表全空时不判)', ()=>{
		const costs = COSTS.costs || {};
		if(!Object.keys(costs).length){ return; }
		const vals = Object.values(costs).sort((a, b)=>a - b);
		const med = vals[Math.floor(vals.length / 2)];
		const loads = shards.map((s)=>{
			const keys = new Set(s.map((x)=>x.key));
			return s.reduce((a, x)=>a + (Number.isFinite(costs[x.id]) ? costs[x.id] : med), 0) + keys.size * KEY_SETUP_MS;
		});
		const mean = loads.reduce((a, b)=>a + b, 0) / loads.length;
		const biggest = Math.max(...Object.values(costs));
		expect(Math.max(...loads)).toBeLessThanOrEqual(Math.max(mean * 1.35, biggest + KEY_SETUP_MS));
	});
});
