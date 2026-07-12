// 六爻 [断卦结构] 逐爻/动变 段 GFM 表化 · 等价证明。
// 改前(v1)用一次性 capture(原函数逻辑,见 git HEAD)在同一 fixture 上跑出 BASELINE(下方冻结字符串);
// 改后表化,本测试:
//   ① 逆变换 —— 把新快照里的 markdown 表逐行反拼回 v1 旧行(逐爻表补回图例行、动变表加「动」字),
//      与 BASELINE 逐字节相等(值层零信息丢失,order 亦不变);
//   ② 元组集合 —— 新表逐行 cell 元组集 == 旧行独立解析元组集(主语=爻位在表行重复,按任务约定用集合);
//   ③ 良构守卫 —— 表列数一致 / 无裸空值词 / 段头零变更 / 无 undefined·NaN。
// BASELINE 严禁在改码后重生成。
import { buildGuaSnapshotText, liuyaoStructLines } from '../GuaZhanMain';
import { Gua64, getGua64 } from '../../gua/GuaConst';
import { isDocxTableSep, splitDocxTableRow } from '../../../utils/mdTableParse';

const BASELINE = "[起盘信息]\n干支：年丙午 月丙午 日甲子 时子\n旬空：月空寅卯 日空戌亥\n\n[卦象]\n本卦：火水未济  离宫火\n互卦：水火既济  坎宫水\n之卦(变卦)：火风鼎  离宫火\n错卦(阴阳全变)：水火既济  坎宫水\n综卦(上下颠倒)：水火既济  坎宫水\n\n[六爻与动爻]\n第1爻：阴爻（静），爻名:寅木父母\n第2爻：阳爻（静），爻名:辰土子孙\n第3爻：阴爻（动），爻名:午火兄弟世\n第4爻：阳爻（静），爻名:酉金妻财\n第5爻：阴爻（静），爻名:未土子孙\n第6爻：阳爻（静），爻名:巳火兄弟应\n之卦(变卦)逐爻（初→上）：\n第1爻：阴爻，爻名:丑土子孙\n第2爻：阳爻，爻名:亥水官鬼世\n第3爻：阳爻，爻名:酉金妻财\n第4爻：阳爻，爻名:酉金妻财\n第5爻：阴爻，爻名:未土子孙应\n第6爻：阳爻，爻名:巳火兄弟\n互卦逐爻（初→上）：\n第1爻：阳爻，爻名:卯木父母\n第2爻：阴爻，爻名:丑土子孙\n第3爻：阳爻，爻名:亥水官鬼世\n第4爻：阴爻，爻名:申金妻财\n第5爻：阳爻，爻名:戌土子孙\n第6爻：阴爻，爻名:子水官鬼应\n\n[断卦结构]\n流派：通用\n卦序：离宫·三世(世3应6)\n成局：三会方巳午未火(有动)\n占测：自身/综合运势　用神：世(3爻)\n卦身：申(不上卦)\n逐爻(初→上)：六神│伏神│本爻│世应│旺衰│状态│神煞\n第1爻：青龙 寅木父母 休 神煞:禄神,驿马\n第2爻：朱雀 辰土子孙 相 帝旺 神煞:华盖\n第3爻：勾陈 午火兄弟(世) 旺 伏官鬼亥水\n第4爻：螣蛇 酉金妻财 死 神煞:桃花\n第5爻：白虎 未土子孙 相 帝旺 神煞:天乙贵人\n第6爻：玄武 巳火兄弟(应) 旺 神煞:劫煞\n变卦：火风鼎\n第3爻动：兄弟午火 → 妻财酉金\n\n[卦辞与断语]\n[判语库·参考诀表]\n◆ 诸爻持世诀\n父母持世：主身劳心累、利文书房产长辈;求子嗣、求财较费力\n兄弟持世：主破财、争夺、阻隔、劳碌;不利求财娶妻,利竞争同辈事\n子孙持世：安乐无忧、利解忧去病、利求财(子生财);忌求官(子克官)\n妻财持世：利求财得利、男占得妻;忌求文书功名(财克父)\n官鬼持世：多牵挂不安、利求官求职;占身易有病讼、占婚女得夫\n◆ 六亲发动诀(发动必生一克一)\n父母动：克子孙　生兄弟\n兄弟动：克妻财　生子孙\n子孙动：克官鬼　生妻财\n妻财动：克父母　生官鬼\n官鬼动：克兄弟　生父母\n◆ 六神发动歌\n青龙动：喜庆、酒色、财喜、婚孕之吉(旺);酒色耗财(衰)\n朱雀动：口舌、是非、文书信息、官非词讼\n勾陈动：田土房产、勾连牵缠、迟滞、牢狱之事\n螣蛇动：虚惊怪梦、忧疑缠绕、心神不宁、怪异\n白虎动：疾病丧服、血光道路、争斗、孝服(旺则威武)\n玄武动：盗贼遗失、暧昧私情、阴私欺诈\n◆ 爻位象(身/宅/人事)\n初爻：足/趾｜地基/井｜百姓/童仆/事之始\n二爻：股/腿｜宅/灶/妻｜妻/宅/下属\n三爻：腹/腰｜门/床｜兄弟/同辈/中层\n四爻：胸/心｜门/户｜大臣/上司/近君\n五爻：心胸/头面｜人/道路｜君/领导(最尊)\n上爻：头/首｜墙/宗庙/屋顶｜祖上/最高/事之终\n◆ 常见占类断法纲要\n求财：用神妻财；吉：财旺、子孙原神动生财、财临日月生克世；凶：财空破墓绝、兄弟旺动夺财、财休囚\n功名/求职/考试：用神官鬼(父母为文书)；吉：官旺持世或生世、父母护官、贵人临；凶：官空破、子孙旺动克官、官休囚\n婚姻：用神男用财女用官,兼世应；吉：用神旺、世应相生相合、财官相济；凶：用神空破、世应相冲相克、间爻冲克\n疾病：用神官鬼为病、子孙为药；吉：子孙旺动制鬼、用神有气、鬼衰；凶：用神入墓/空破、鬼旺克用、忌神动\n失物：用神妻财(物)+六神定形；吉：财在卦旺而不动、近世；凶：财空、玄武临、财动出卦\n行人/出行：用神行人取对应六亲,出行以世；吉：用神动生世、世旺逢生、归魂主归；凶：用神空破、世入墓、游魂主漂泊\n官司：用神世为己应为对方、官鬼为官；吉：世旺克应、子孙动解、官不克世；凶：应克世、官鬼旺克世、世空\n天时(晴雨)：用神父母雨/子孙晴/官鬼雷/财风/兄云；吉：据用神旺衰动静断；凶：—";

const YAO_LEGEND = '逐爻(初→上)：六神│伏神│本爻│世应│旺衰│状态│神煞';
const DASH = '—';
const de = (c)=>(c === DASH ? '' : c); // 表 cell → 值(— 即空)

function mkSt(name, movingIdx, nongli, settings){
	getGua64(0);
	const g = Gua64.find((x) => x.name === name);
	const yao = g.value.map((v, i) => ({ value: v, change: i === movingIdx, god: null, name: g.yaoname[i] }));
	return { currentGua: Gua64.indexOf(g), yao, nongli: nongli || {}, guaDesc: {}, liuyaoSettings: settings || null };
}
const FIXTURE = ()=>mkSt('火水未济', 2, { dayGanZi: '甲子', monthGanZi: '丙午', yearGanZi: '丙午', time: '子' });

// 逐爻表行 cell → v1 旧行(逆变换)。
function rebuildYao(cells){
	const [yao, liu, zhi, wx, lq, sy, ws, stat, fu, sha] = cells.map(de);
	return `${yao}：${liu ? liu + ' ' : ''}${zhi}${wx}${lq}${sy ? '(' + sy + ')' : ''} ${ws}${stat ? ' ' + stat : ''}${fu ? ' ' + fu : ''}${sha ? ' 神煞:' + sha : ''}`;
}
// 动变表行 cell → v1 旧行(逆变换,加「动」字)。
function rebuildMove(cells){
	const [yao, ben, bian, tags] = cells.map(de);
	return `${yao}动：${ben} → ${bian}${tags ? ' ' + tags : ''}`;
}

// 把新快照中所有 markdown 表反拼回 v1 旧行(逐爻表补回图例行)。
function inverse(text){
	const src = `${text}`.split('\n');
	const out = [];
	let i = 0;
	while(i < src.length){
		const line = src[i];
		if(line.includes('|') && i + 1 < src.length && isDocxTableSep(src[i + 1])){
			const header = splitDocxTableRow(line);
			const rows = [];
			let j = i + 2;
			while(j < src.length && src[j].includes('|') && !isDocxTableSep(src[j])){ rows.push(splitDocxTableRow(src[j])); j += 1; }
			if(header[0] === '爻' && header.length === 10){
				out.push(YAO_LEGEND);
				rows.forEach((c)=>out.push(rebuildYao(c)));
			}else if(header[0] === '爻' && header.length === 4){
				rows.forEach((c)=>out.push(rebuildMove(c)));
			}else{
				throw new Error('未知表头: ' + header.join('|'));
			}
			i = j;
			continue;
		}
		out.push(line);
		i += 1;
	}
	return out.join('\n');
}

// 冻结基线 [断卦结构] 逐爻/动变 旧行 → 元组(与新表 cell 同构;主语=爻位在表行重复,故集合)。
function oldYaoTuples(){
	const LIU = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
	return BASELINE.split('\n').filter((l)=>/^第\d+爻：/.test(l) && !/爻名/.test(l)).map((line)=>{
		const m = line.match(/^(第\d+爻)：(.*)$/);
		const pos = m[1];
		let rest = m[2];
		let liu = '';
		for(const L of LIU){ if(rest.indexOf(L + ' ') === 0){ liu = L; rest = rest.slice(L.length + 1); break; } }
		let sha = '';
		const si = rest.indexOf(' 神煞:');
		if(si >= 0){ sha = rest.slice(si + 4); rest = rest.slice(0, si); }
		let fu = '';
		const fm = rest.match(/ (伏.+)$/);
		if(fm){ fu = fm[1]; rest = rest.slice(0, fm.index); }
		let sy = '';
		const pm = rest.match(/\(([^)]+)\)/);
		if(pm){ sy = pm[1]; rest = rest.replace(pm[0], ''); }
		const parts = rest.split(' ').filter(Boolean);
		const na = parts[0];
		return [pos, liu, na[0], na[1], na.slice(2), sy, parts[1] || '', parts[2] || '', fu, sha];
	});
}
function oldMoveTuples(){
	return BASELINE.split('\n').filter((l)=>/^第\d+爻动：/.test(l)).map((line)=>{
		const m = line.match(/^(第\d+爻)动：(.+?) → (.+)$/);
		const rest = m[3];
		const bian = rest.slice(0, 4);
		const tags = rest.length > 4 ? rest.slice(5) : '';
		return [m[1], m[2], bian, tags];
	});
}
function tset(rows){ return new Set(rows.map((r)=>JSON.stringify(r.map(de)))); }
function sliceSection(text, title){
	const parts = `${text}`.split('\n\n');
	const head = `[${title}]`;
	const hit = parts.find((p)=>p === head || p.indexOf(`${head}\n`) === 0);
	return hit ? hit.split('\n').slice(1) : null;
}
function tablesOf(lines){
	const tables = [];
	const src = lines || [];
	let i = 0;
	while(i < src.length){
		if(src[i].includes('|') && i + 1 < src.length && isDocxTableSep(src[i + 1])){
			const header = splitDocxTableRow(src[i]);
			const rows = [];
			let j = i + 2;
			while(j < src.length && src[j].includes('|') && !isDocxTableSep(src[j])){ rows.push(splitDocxTableRow(src[j])); j += 1; }
			tables.push({ header, rows });
			i = j;
		}else{ i += 1; }
	}
	return tables;
}

describe('六爻 [断卦结构] 表化等价', ()=>{
	const txt = buildGuaSnapshotText({}, FIXTURE());

	it('逆变换:新快照表反拼 v1 旧行,逐字节 == 冻结基线', ()=>{
		expect(inverse(txt)).toBe(BASELINE);
	});

	it('逐爻表元组集合 == 旧行独立解析元组集合(零信息丢失)', ()=>{
		const struct = sliceSection(txt, '断卦结构');
		const yaoT = tablesOf(struct).find((t)=>t.header[0] === '爻' && t.header.length === 10);
		expect(yaoT).toBeTruthy();
		expect(yaoT.rows.length).toBe(6);
		expect(tset(yaoT.rows)).toEqual(tset(oldYaoTuples()));
	});

	it('动变表元组集合 == 旧行独立解析元组集合', ()=>{
		const struct = sliceSection(txt, '断卦结构');
		const moveT = tablesOf(struct).find((t)=>t.header[0] === '爻' && t.header.length === 4);
		expect(moveT).toBeTruthy();
		expect(tset(moveT.rows)).toEqual(tset(oldMoveTuples()));
	});

	it('良构:表头固定、每数据行列数=表头、无裸空值词、无 undefined/NaN', ()=>{
		const struct = sliceSection(txt, '断卦结构');
		const tables = tablesOf(struct);
		expect(tables.map((t)=>t.header.join('|'))).toEqual([
			'爻|六神|地支|五行|六亲|世应|旺衰|状态|伏神|神煞',
			'爻|本卦|变卦|标记',
		]);
		tables.forEach(({ header, rows })=>{
			rows.forEach((cells)=>{
				expect(cells.length).toBe(header.length);
				cells.forEach((c)=>expect(c === 'undefined' || c === 'null' || c === 'NaN').toBe(false));
			});
		});
		expect(txt).not.toMatch(/undefined|NaN/);
	});

	it('段头序零变更(表化只动段内)', ()=>{
		const heads = (t)=>`${t}`.split('\n\n').map((p)=>p.split('\n')[0]).filter((l)=>/^\[.+\]$/.test(l));
		expect(heads(txt)).toEqual(heads(BASELINE));
	});

	it('liuyaoStructLines 独立调用也产出表(挂载/储存路径一致)', ()=>{
		const lines = liuyaoStructLines(FIXTURE()).join('\n');
		expect(lines).toMatch(/\| 爻 \| 六神 \| 地支 \|/);
		expect(lines).toMatch(/\| 爻 \| 本卦 \| 变卦 \| 标记 \|/);
	});
});
