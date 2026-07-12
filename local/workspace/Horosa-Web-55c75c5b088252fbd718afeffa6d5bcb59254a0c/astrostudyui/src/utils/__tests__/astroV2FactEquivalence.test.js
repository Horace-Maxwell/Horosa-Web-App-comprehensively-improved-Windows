// AI 导出 v2 表化 · 等价证明:astroAiSnapshot 七函数(宫头/星与虚点/相位/行星/希腊点/12分度/主宰星链)
// 改 GFM 表后,对照改前(v1)基线 fixtures/astroV2Baseline.json 证明「值层零信息丢失」。
// 三式证明:
//   L1 逆变换  —— 表行反拼 v1 行,逐字逐序等于基线(宫头/星与虚点/12分度/宫神星);
//   fact-tuple-set —— 旧文解析 (主体,相位,对象,相态,误差) 元组集 == 新表逐行元组集(相位三子块;
//                     multiset 会因主体在表行重复而失配,按任务约定用集合);
//   逐实体属性字典 —— v1 行组解析 {星曜→{属性→值}} == v2 四表合并字典(行星/希腊点;
//                     星曜名在多表重复导致 token multiset 天然失配,字典式是其集合化等价);
// 另附 token multiset(/[一-龥A-Za-z0-9~+.]+/ 提取,剔除 STRUCTURE_LABELS 表头词)于无主体重复的三段,
// 与「非七段逐字节不动 + 段头序不变 + 表良构 + 无 undefined/NaN/null」全局守卫。
// 基线由已删除的一次性捕获脚本在改码前生成 —— 本测试只读,严禁在改码后重生成基线。
import fs from 'fs';
import path from 'path';
import { buildAstroSnapshotContent } from '../astroAiSnapshot';
import { isDocxTableSep, splitDocxTableRow } from '../mdTableParse';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'astroV2Baseline.json');
const MUMBAI_FIXTURE = '/tmp/horosa_chart_mumbai.json';
const hasMumbai = fs.existsSync(MUMBAI_FIXTURE);

const SEVEN = ['宫位宫头', '星与虚点', '相位', '行星', '希腊点', '12分度', '主宰星链'];
const EMPTY_CELL = '—';

const baseline = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
// 深拷贝隔离:builder 内部会给对象挂派生键(如 __name),不许污染跨用例共享的基线对象。
const v2Content = buildAstroSnapshotContent(JSON.parse(JSON.stringify(baseline.chartObj)), null);

// ── 解析工具 ─────────────────────────────────────────────────────────────────
function sliceSection(content, title){
	const parts = `${content}`.split('\n\n');
	const head = `[${title}]`;
	const hit = parts.find((p)=>p === head || p.indexOf(`${head}\n`) === 0);
	if(!hit){
		return null;
	}
	return hit.split('\n').slice(1);
}

function sectionTitles(content){
	return `${content}`.split('\n\n').map((p)=>p.split('\n')[0]).filter((l)=>/^\[.+\]$/.test(l));
}

// 段内行 → { tables:[{header,rows}], rest:[非表行] }(mdTableParse 单源识别,与导出 IR 同口径)。
function extractTables(lines){
	const tables = [];
	const rest = [];
	let i = 0;
	const src = lines || [];
	while(i < src.length){
		const line = src[i];
		if(line.includes('|') && i + 1 < src.length && isDocxTableSep(src[i + 1])){
			const header = splitDocxTableRow(line);
			const rows = [];
			let j = i + 2;
			while(j < src.length && src[j].includes('|') && !isDocxTableSep(src[j])){
				rows.push(splitDocxTableRow(src[j]));
				j += 1;
			}
			tables.push({ header, rows });
			i = j;
			continue;
		}
		rest.push(line);
		i += 1;
	}
	return { tables, rest };
}

function onlyTable(lines){
	const { tables, rest } = extractTables(lines);
	expect(tables.length).toBe(1);
	expect(rest).toEqual([]);
	return tables[0];
}

const TOKEN_RE = /[一-龥A-Za-z0-9~+.]+/g;
function factTokens(lines, structureLabels){
	const drop = new Set(structureLabels || []);
	const out = [];
	(lines || []).forEach((ln)=>{
		(`${ln}`.match(TOKEN_RE) || []).forEach((t)=>{
			if(!drop.has(t)){
				out.push(t);
			}
		});
	});
	return out.sort();
}

// v1「星曜名行 + 键：值行 + 汇合恒星：+ 恒星行」行组 → [{name, attrs, stars}](行星/希腊点两段同构)。
function parseV1EntityGroups(lines){
	const groups = [];
	let cur = null;
	let inStars = false;
	(lines || []).forEach((ln)=>{
		if(!ln.includes('：')){
			cur = { name: ln, attrs: {}, stars: [] };
			groups.push(cur);
			inStars = false;
			return;
		}
		if(ln === '汇合恒星：'){
			inStars = true;
			return;
		}
		if(inStars){
			cur.stars.push(ln);
			return;
		}
		const idx = ln.indexOf('：');
		cur.attrs[ln.slice(0, idx)] = ln.slice(idx + 1);
	});
	return groups;
}

// v2 多表(星曜列在首) + ◆汇合恒星 行组 → 同构 [{name, attrs, stars}](attrs 键=列名,'—' 即缺)。
function parseV2EntityGroups(lines, starHeaderMark){
	const { tables, rest } = extractTables(lines);
	const byName = new Map();
	const order = [];
	const ensure = (name)=>{
		if(!byName.has(name)){
			byName.set(name, { name, attrs: {}, stars: [] });
			order.push(name);
		}
		return byName.get(name);
	};
	tables.forEach(({ header, rows })=>{
		rows.forEach((cells)=>{
			const g = ensure(cells[0]);
			for(let c=1; c<header.length; c++){
				if(cells[c] !== EMPTY_CELL){
					g.attrs[header[c]] = cells[c];
				}
			}
		});
	});
	const starIdx = rest.indexOf(starHeaderMark);
	const starLines = starIdx >= 0 ? rest.slice(starIdx + 1) : [];
	let cur = null;
	starLines.forEach((ln)=>{
		if(!ln.includes('：')){
			cur = ensure(ln);
			return;
		}
		cur.stars.push(ln);
	});
	return { groups: order.map((n)=>byName.get(n)), tables, rest };
}

function tupleSet(tuples){
	return new Set(tuples.map((t)=>JSON.stringify(t)));
}

// ── 基线自检 ─────────────────────────────────────────────────────────────────
describe('基线 fixture 自检', ()=>{
	it('七段基线与合成盘齐备', ()=>{
		expect(baseline.chartObj && baseline.chartObj.chart).toBeTruthy();
		SEVEN.forEach((t)=>{
			expect(Array.isArray(baseline.sections[t])).toBe(true);
			expect(baseline.sections[t].length).toBeGreaterThan(0);
		});
		expect(typeof baseline.fullContentV1).toBe('string');
	});
});

// ── 1. 宫位宫头:L1 逆变换 + multiset ────────────────────────────────────────
describe('宫位宫头 表化等价(L1 逆变换)', ()=>{
	const lines = sliceSection(v2Content, '宫位宫头');
	it('表行反拼 v1 行逐字逐序相等', ()=>{
		const { header, rows } = onlyTable(lines);
		expect(header).toEqual(['宫位', '宫头']);
		const rebuilt = rows.map(([house, cusp])=>`${house} 宫头：${cusp}`.trim());
		expect(rebuilt).toEqual(baseline.sections['宫位宫头']);
	});
	it('fact token multiset 相等(剔除表头词)', ()=>{
		const labels = ['宫位', '宫头'];
		expect(factTokens(lines, labels)).toEqual(factTokens(baseline.sections['宫位宫头'], labels));
	});
});

// ── 2. 星与虚点:L1 逆变换 + multiset ────────────────────────────────────────
describe('星与虚点 表化等价(L1 逆变换)', ()=>{
	const lines = sliceSection(v2Content, '星与虚点');
	it('表行反拼 v1 行逐字逐序相等(逆行列=原后缀字面量或 —)', ()=>{
		const { header, rows } = onlyTable(lines);
		expect(header).toEqual(['点位', '位置', '逆行']);
		const rebuilt = rows.map(([name, pos, retro])=>`${name}：${pos}${retro === EMPTY_CELL ? '' : retro}`.trim());
		expect(rebuilt).toEqual(baseline.sections['星与虚点']);
	});
	it('fact token multiset 相等(剔除表头词)', ()=>{
		const labels = ['点位', '位置', '逆行'];
		expect(factTokens(lines, labels)).toEqual(factTokens(baseline.sections['星与虚点'], labels));
	});
});

// ── 3. 相位:三子块 fact-tuple-set ───────────────────────────────────────────
describe('相位 表化等价(fact-tuple-set)', ()=>{
	const v2Lines = sliceSection(v2Content, '相位');
	const v1Lines = baseline.sections['相位'];

	// v1 解析:按裸子块头切三段。
	const v1Blocks = { '标准相位': [], '立即相位': [], '星座相位': [] };
	{
		let cur = null;
		v1Lines.forEach((ln)=>{
			if(Object.prototype.hasOwnProperty.call(v1Blocks, ln)){
				cur = ln;
				return;
			}
			if(cur){
				v1Blocks[cur].push(ln);
			}
		});
	}
	const v1Std = [];
	{
		let subject = null;
		v1Blocks['标准相位'].forEach((ln)=>{
			if(!ln.includes(' 误差')){
				subject = ln;
				return;
			}
			let m = ln.match(/^(\S+) (.+) (入相|离相) 误差(\S*)$/);
			if(m){
				v1Std.push([subject, m[1], m[2], m[3], m[4]]);
				return;
			}
			m = ln.match(/^(\S+) (.+) 误差(\S*)$/);
			expect(m).toBeTruthy();
			v1Std.push([subject, m[1], m[2], '', m[3]]);
		});
	}
	const v1Imm = [];
	v1Blocks['立即相位'].forEach((ln)=>{
		const halves = ln.split('；');
		expect(halves.length).toBe(2);
		const m1 = halves[0].match(/^(.+) (\S+˚) (.+) 离相 误差(\S*)$/);
		const m2 = halves[1].match(/^(\S+˚) (.+) 入相 误差(\S*)$/);
		expect(m1).toBeTruthy();
		expect(m2).toBeTruthy();
		v1Imm.push([m1[1], m1[2], m1[3], '离相', m1[4]]);
		v1Imm.push([m1[1], m2[1], m2[2], '入相', m2[3]]);
	});
	const v1Sign = [];
	{
		let subject = null;
		v1Blocks['星座相位'].forEach((ln)=>{
			if(ln.indexOf('主体：') === 0){
				subject = ln.slice('主体：'.length);
				return;
			}
			const m = ln.match(/^与 (.+) 成 (\S+) 相位$/);
			expect(m).toBeTruthy();
			v1Sign.push([subject, m[2], m[1]]);
		});
	}

	// v2 解析:◆ 子块头 + 各自一表。
	const v2Blocks = { '◆ 标准相位': [], '◆ 立即相位': [], '◆ 星座相位': [] };
	{
		let cur = null;
		v2Lines.forEach((ln)=>{
			if(Object.prototype.hasOwnProperty.call(v2Blocks, ln)){
				cur = ln;
				return;
			}
			if(cur){
				v2Blocks[cur].push(ln);
			}
		});
	}
	const rowsOf = (mark, headerExpect)=>{
		const { header, rows } = onlyTable(v2Blocks[mark]);
		expect(header).toEqual(headerExpect);
		return rows;
	};

	it('◆ 标准相位:(主体,相位,对象,相态,误差) 集合相等', ()=>{
		const rows = rowsOf('◆ 标准相位', ['主体', '相位', '对象', '相态', '误差']);
		const v2 = rows.map(([s, a, o, ph, orb])=>[s, a, o, ph === EMPTY_CELL ? '' : ph, orb]);
		expect(tupleSet(v2)).toEqual(tupleSet(v1Std));
	});
	it('◆ 立即相位:五元组集合相等', ()=>{
		const rows = rowsOf('◆ 立即相位', ['主体', '相位', '对象', '相态', '误差']);
		expect(tupleSet(rows)).toEqual(tupleSet(v1Imm));
	});
	it('◆ 星座相位:(主体,相位,对象) 集合相等', ()=>{
		const rows = rowsOf('◆ 星座相位', ['主体', '相位', '对象']);
		expect(tupleSet(rows)).toEqual(tupleSet(v1Sign));
	});
});

// ── 4. 行星:逐实体属性字典 + 汇合恒星逐字 + 行序 ─────────────────────────────
describe('行星 表化等价(逐实体属性字典)', ()=>{
	const v2Lines = sliceSection(v2Content, '行星');
	const v1Groups = parseV1EntityGroups(baseline.sections['行星']);
	const { groups: v2Groups, tables, rest } = parseV2EntityGroups(v2Lines, '◆ 汇合恒星');

	it('四表列固定不因盘裁列', ()=>{
		const headers = tables.map((t)=>t.header.join('|'));
		expect(headers).toEqual([
			'星曜|落座|落宫|月宿|平均速度|当前速度',
			'星曜|黄经|黄纬|赤经|赤纬|真地平纬度|视地平纬度|地坪经度',
			'星曜|禀赋|分值|入垣宫|擢升宫|宰制星座|月限|太阳关系',
			'星曜|映点|反映点|东出星|西入星',
		]);
		expect(rest.filter((l)=>l.indexOf('◆ ') === 0)).toEqual(['◆ 位置与速度', '◆ 坐标', '◆ 尊贵与主宰', '◆ 映点与东西', '◆ 汇合恒星']);
	});

	it('星曜集合与顺序一致(位置与速度表行序 = v1 星曜序)', ()=>{
		expect(tables[0].rows.map((r)=>r[0])).toEqual(v1Groups.map((g)=>g.name));
		expect(v2Groups.map((g)=>g.name)).toEqual(v1Groups.map((g)=>g.name));
	});

	it('每星属性字典逐键逐值相等(零信息丢失,双向)', ()=>{
		const v2ByName = new Map(v2Groups.map((g)=>[g.name, g]));
		v1Groups.forEach((g1)=>{
			const g2 = v2ByName.get(g1.name);
			expect(g2).toBeTruthy();
			expect(g2.attrs).toEqual(g1.attrs);
		});
	});

	it('汇合恒星行组逐字相等(值零变化)', ()=>{
		const v2ByName = new Map(v2Groups.map((g)=>[g.name, g]));
		v1Groups.forEach((g1)=>{
			expect(v2ByName.get(g1.name).stars).toEqual(g1.stars);
		});
	});

	it('坐标/尊贵/映点各表行序 = v1 中该块有值的星曜序(全属性缺则不出行)', ()=>{
		const blockCols = [
			['黄经', '黄纬', '赤经', '赤纬', '真地平纬度', '视地平纬度', '地坪经度'],
			['禀赋', '分值', '入垣宫', '擢升宫', '宰制星座', '月限', '太阳关系'],
			['映点', '反映点', '东出星', '西入星'],
		];
		blockCols.forEach((cols, i)=>{
			const expected = v1Groups.filter((g)=>cols.some((c)=>Object.prototype.hasOwnProperty.call(g.attrs, c))).map((g)=>g.name);
			expect(tables[i + 1].rows.map((r)=>r[0])).toEqual(expected);
		});
	});
});

// ── 5. 希腊点:逐实体属性字典 + 汇合恒星逐字 ─────────────────────────────────
describe('希腊点 表化等价(逐实体属性字典)', ()=>{
	const v2Lines = sliceSection(v2Content, '希腊点');
	const v1Groups = parseV1EntityGroups(baseline.sections['希腊点']);
	const { groups: v2Groups, tables } = parseV2EntityGroups(v2Lines, '◆ 汇合恒星');

	it('单表(点位|落座|落宫) + 点位集合顺序一致', ()=>{
		expect(tables.length).toBe(1);
		expect(tables[0].header).toEqual(['点位', '落座', '落宫']);
		expect(tables[0].rows.map((r)=>r[0])).toEqual(v1Groups.map((g)=>g.name));
	});

	it('每点属性字典与汇合恒星逐字相等', ()=>{
		const v2ByName = new Map(v2Groups.map((g)=>[g.name, g]));
		v1Groups.forEach((g1)=>{
			const g2 = v2ByName.get(g1.name);
			expect(g2).toBeTruthy();
			expect(g2.attrs).toEqual(g1.attrs);
			expect(g2.stars).toEqual(g1.stars);
		});
	});
});

// ── 6. 12分度:L1 逆变换 + multiset ──────────────────────────────────────────
describe('12分度 表化等价(L1 逆变换)', ()=>{
	const lines = sliceSection(v2Content, '12分度');
	it('表行反拼 v1 行逐字逐序相等', ()=>{
		const { header, rows } = onlyTable(lines);
		expect(header).toEqual(['曜', '本命', '12分度']);
		const rebuilt = rows.map(([id, natal, dodeca])=>`${id}：本命 ${natal} → 12分度 ${dodeca}`);
		expect(rebuilt).toEqual(baseline.sections['12分度']);
	});
	it('fact token multiset 相等(剔除表头词)', ()=>{
		const labels = ['曜', '本命', '12分度'];
		expect(factTokens(lines, labels)).toEqual(factTokens(baseline.sections['12分度'], labels));
	});
});

// ── 7. 主宰星链:链行逐字不动 + 宫神星表 L1 逆变换 ───────────────────────────
describe('主宰星链 表化等价(链行原样 + 宫神星 L1)', ()=>{
	const v2Lines = sliceSection(v2Content, '主宰星链');
	const v1Lines = baseline.sections['主宰星链'];
	const v1Split = v1Lines.indexOf('宫神星(houseRows)：');
	const v2Split = v2Lines.indexOf('◆ 宫神星(houseRows)');

	it('链行(变长)逐字逐序保持原样', ()=>{
		expect(v1Split).toBeGreaterThan(-1);
		expect(v2Split).toBeGreaterThan(-1);
		expect(v2Lines.slice(0, v2Split)).toEqual(v1Lines.slice(0, v1Split));
	});

	it('宫神星表行反拼 v1 行逐字逐序相等(含 宫主缺落宫 的空位编码)', ()=>{
		const { header, rows } = onlyTable(v2Lines.slice(v2Split + 1));
		expect(header).toEqual(['宫', '宫头座', '宫主', '宫主落宫', '宫主落座']);
		const rebuilt = rows.map(([hn, hs, ruler, rh, rs])=>{
			if(rh === EMPTY_CELL && rs === EMPTY_CELL){
				return `${hn}(${hs})：宫主 ${ruler}`;
			}
			return `${hn}(${hs})：宫主 ${ruler} 落 ${rh === EMPTY_CELL ? '' : rh} ${rs === EMPTY_CELL ? '' : rs}`.trim();
		});
		expect(rebuilt).toEqual(v1Lines.slice(v1Split + 1));
	});
});

// ── 全局守卫 ─────────────────────────────────────────────────────────────────
describe('全局守卫', ()=>{
	it('段头序零变更,非七段逐字节不动', ()=>{
		expect(sectionTitles(v2Content)).toEqual(sectionTitles(baseline.fullContentV1));
		sectionTitles(baseline.fullContentV1).forEach((head)=>{
			const title = head.slice(1, -1);
			if(SEVEN.indexOf(title) >= 0){
				return;
			}
			expect(sliceSection(v2Content, title)).toEqual(sliceSection(baseline.fullContentV1, title));
		});
	});

	it('无 undefined/NaN/null 字面量', ()=>{
		expect(v2Content).not.toMatch(/undefined|NaN/);
		expect(v2Content).not.toMatch(/：\s*null/);
	});

	it('全部表良构:每数据行列数 = 表头列数,cell 无裸空值词', ()=>{
		SEVEN.forEach((t)=>{
			const { tables } = extractTables(sliceSection(v2Content, t) || []);
			tables.forEach(({ header, rows })=>{
				rows.forEach((cells)=>{
					expect(cells.length).toBe(header.length);
					cells.forEach((c)=>{
						expect(c === 'undefined' || c === 'null' || c === 'NaN').toBe(false);
					});
				});
			});
		});
	});
});

// ── Mumbai 真盘(in-app 抓取 /tmp 夹具;存在则跑,缺失优雅跳过) ────────────────
(hasMumbai ? describe : describe.skip)('Mumbai 真盘 v2 不变式', ()=>{
	it('构建不抛,七段表良构,无 undefined/NaN/null', ()=>{
		const co = JSON.parse(fs.readFileSync(MUMBAI_FIXTURE, 'utf-8'));
		let txt = '';
		expect(()=>{ txt = buildAstroSnapshotContent(co, null); }).not.toThrow();
		expect(txt.length).toBeGreaterThan(200);
		expect(txt).not.toMatch(/undefined|NaN/);
		expect(txt).not.toMatch(/：\s*null/);
		SEVEN.forEach((t)=>{
			const lines = sliceSection(txt, t);
			if(!lines){
				return; // 真盘某段可无数据(如 lots 关闭)→ 段缺席合法
			}
			const { tables } = extractTables(lines);
			tables.forEach(({ header, rows })=>{
				rows.forEach((cells)=>expect(cells.length).toBe(header.length));
			});
		});
	});
});
