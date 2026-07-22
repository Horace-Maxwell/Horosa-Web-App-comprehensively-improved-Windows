// [R3-A0] 全技法性能覆盖矩阵哨兵 —— 「所有技法都要顶级性能」的机器强制。
// 真源穷举:pages/index.js 导航行(含抽屉三页) + integrations/kentang/serviceRoot.js 模块表。
// 断言:双向一致(真源↔矩阵零缺零多)、九轴齐全、取值合法、随机类模块绝不预取。
// todo 数不在此断言(开发期允许在途)——收口清零由 preflight R3 哨兵把关(release 门)。
import fs from 'fs';
import path from 'path';
import {
	PERF_AXES, VALID_VALUE, getPerfCoveragePages, getPerfCoverageKentang, countPerfTodos,
} from '../perfCoverageManifest';

const SRC = path.join(__dirname, '..', '..');

function navKeysFromSource(){
	const src = fs.readFileSync(path.join(SRC, 'pages', 'index.js'), 'utf8');
	const keys = new Set();
	const re = /\{ label: '[^']+', key: '([a-zA-Z0-9]+)'/g;
	let m;
	while((m = re.exec(src))){ keys.add(m[1]); }
	return keys;
}

function kentangKeysFromSource(){
	const src = fs.readFileSync(path.join(SRC, 'integrations', 'kentang', 'serviceRoot.js'), 'utf8');
	const keys = new Set();
	const re = /^\t([a-z][a-z0-9]*): \{/gm;
	let m;
	while((m = re.exec(src))){ keys.add(m[1]); }
	return keys;
}

describe('[R3-A0] 全技法性能覆盖矩阵哨兵', ()=>{
	const pages = getPerfCoveragePages();
	const kentang = getPerfCoverageKentang();

	test('页面级:真源(导航行)↔矩阵 双向零缺零多', ()=>{
		const nav = navKeysFromSource();
		expect(nav.size).toBeGreaterThanOrEqual(25); // 解析器自检:真源行数量级(private 剥离后仍 ≥25)
		const manifestKeys = new Set(Object.keys(pages));
		const missing = [...nav].filter((k)=>!manifestKeys.has(k));
		const extra = [...manifestKeys].filter((k)=>!nav.has(k));
		expect(missing).toEqual([]); // 新增技法页必须登记矩阵
		expect(extra).toEqual([]);   // 矩阵不许有幽灵行
	});

	test('kentang 模块级:真源(serviceRoot)↔矩阵 双向零缺零多', ()=>{
		const src = kentangKeysFromSource();
		expect(src.size).toBeGreaterThanOrEqual(18);
		const manifestKeys = new Set(Object.keys(kentang));
		expect([...src].filter((k)=>!manifestKeys.has(k))).toEqual([]);
		expect([...manifestKeys].filter((k)=>!src.has(k))).toEqual([]);
	});

	test('页面级:九轴齐全且取值合法(零 unknown)', ()=>{
		Object.entries(pages).forEach(([key, row])=>{
			expect(row.kind).toMatch(/^(A|B|C|MIXED|TOOL)$/);
			PERF_AXES.forEach((axis)=>{
				const v = row.axes[axis];
				expect(`${key}.${axis}=${v}`).toMatch(VALID_VALUE.source
					? new RegExp(`^${key}\\.${axis}=(done|existing|todo|na:.+)`) : /never/);
			});
			// 轴集精确等于 PERF_AXES(多写少写都红)
			expect(Object.keys(row.axes).sort()).toEqual([...PERF_AXES].sort());
		});
	});

	test('kentang 模块级:双轴齐全、page 回链有效、随机类绝不预取', ()=>{
		const pageKeys = new Set(Object.keys(pages));
		Object.entries(kentang).forEach(([key, row])=>{
			expect(pageKeys.has(row.page)).toBe(true);
			expect(row.policy).toMatch(/^(deterministic|seedInBody|browse)$/);
			['netCache', 'stepPrefetch'].forEach((axis)=>{
				expect(`${key}.${axis}=${row.axes[axis]}`).toMatch(new RegExp(`^${key}\\.${axis}=(done|existing|todo|na:.+)`));
			});
			// 🔴 铁律:body 含随机种子的模块,步进预取必须 na(可缓存不可预取)
			if(row.policy === 'seedInBody'){
				expect(String(row.axes.stepPrefetch).startsWith('na:')).toBe(true);
			}
		});
	});

	test('todo 计数器可读(收口清零由 preflight 把关,此处仅可观测)', ()=>{
		const n = countPerfTodos();
		expect(Number.isInteger(n)).toBe(true);
		// eslint-disable-next-line no-console
		console.log(`[R3] perfCoverage todos remaining: ${n}`);
	});
});
