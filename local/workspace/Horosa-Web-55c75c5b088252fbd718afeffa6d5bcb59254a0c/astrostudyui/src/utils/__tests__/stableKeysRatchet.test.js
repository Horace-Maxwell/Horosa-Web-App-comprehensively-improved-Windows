// 稳定 React key 棘轮:key={randomStr(...)} 站点只许减不许增(随机键 = 每次渲染整段重挂载);
// 已改成 key={`s<站点序号>-${索引}`} 的站点,同一文件内站点序号必须唯一(同父不同循环不撞键)。
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');
const CEILING = 85;   // 改前 220,首批改 135 处(纯展示标签 + 带索引循环);只降不升

function walk(dir, out){
	for(const e of fs.readdirSync(dir, { withFileTypes: true })){
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
		else if(/\.(js|jsx)$/.test(e.name)) out.push(p);
	}
	return out;
}

describe('稳定 key 棘轮', () => {
	const files = walk(path.join(SRC, 'components'), []).concat(walk(path.join(SRC, 'pages'), []));
	it(`key={randomStr(...)} 站点 ≤ ${CEILING}`, () => {
		let n = 0;
		for(const f of files){ n += (fs.readFileSync(f, 'utf8').match(/key=\{randomStr\(/g) || []).length; }
		expect(n).toBeLessThanOrEqual(CEILING);
	});
	it('生成的稳定键站点序号在同一文件内唯一', () => {
		const dup = [];
		for(const f of files){
			const src = fs.readFileSync(f, 'utf8');
			const ids = (src.match(/key=\{`s(\d+)-\$\{/g) || []).map((m) => m.match(/s(\d+)-/)[1]);
			const seen = new Set();
			for(const id of ids){ if(seen.has(id)) dup.push(`${path.relative(SRC, f)}#s${id}`); seen.add(id); }
		}
		expect(dup).toEqual([]);
	});
});
