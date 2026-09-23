// 地占「流派预设」:后端独有两档(greek / ifa)的中文全名与引擎 profiles 表逐字相同(保存值恢复、还没起盘时下拉靠它显示中文而不是原始 id);
// 静态候选集不因此扩大(起盘前少几项是既有约定,帮助文档已明文)。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', 'GeomancyMain.js');
const PROFILES = path.resolve(__dirname, '..', '..', '..', '..', '..', 'astropy', 'astrostudy', 'geomancy', 'data', 'profiles.json');

function literal(src, name){
	const m = src.match(new RegExp(`const ${name} = (\\{[^\\n]*\\});`));
	if(!m){ return null; }
	// eslint-disable-next-line no-new-func
	return Function(`return ${m[1]};`)();
}

describe('地占流派预设:后端独有档的全名', ()=>{
	const src = fs.readFileSync(SRC, 'utf8');
	const extra = literal(src, 'TRADITION_EXTRA_LABELS');
	const shorts = literal(src, 'TRADITION_SHORT_EXTRA');
	const profiles = JSON.parse(fs.readFileSync(PROFILES, 'utf8'));
	const raw = profiles && profiles.profiles ? profiles.profiles : profiles;
	const items = Array.isArray(raw) ? raw : Object.keys(raw || {}).map((k)=>({ id: k, ...(raw[k] || {}) }));
	const byId = {};
	items.forEach((p)=>{ if(p && p.id){ byId[p.id] = p; } });

	it('TRADITION_EXTRA_LABELS 的每一档都是引擎 profiles 里的档,且全名逐字相同', ()=>{
		expect(extra).toBeTruthy();
		expect(Object.keys(extra).sort()).toEqual(Object.keys(shorts).sort());
		Object.keys(extra).forEach((id)=>{
			expect(`${id}: ${byId[id] && byId[id].label}`).toBe(`${id}: ${extra[id]}`);
		});
	});

	it('静态候选集里的每一档全名也与引擎同文(除标注了口径说明的现代综合派)', ()=>{
		const m = src.match(/const TRADITION_OPTIONS = \[([\s\S]*?)\n\];/);
		expect(m).toBeTruthy();
		const re = /\{ key: '([a-z_]+)', label: '([^']+)'/g;
		let hit; let n = 0;
		while((hit = re.exec(m[1]))){
			n += 1;
			const label = hit[2].replace(/(（|\().*$/, '');
			expect(`${hit[1]}: ${byId[hit[1]] && byId[hit[1]].label}`).toBe(`${hit[1]}: ${label}`);
		}
		expect(n).toBeGreaterThanOrEqual(7);
	});

	it('traditionOptions 的静态分支给当前保存值补一条带全名的项(不扩大候选集)', ()=>{
		expect(src).toContain("TRADITION_OPTIONS.concat([{ key: cur, label: TRADITION_EXTRA_LABELS[cur] || cur, short: TRADITION_SHORT_EXTRA[cur] }])");
	});
});
