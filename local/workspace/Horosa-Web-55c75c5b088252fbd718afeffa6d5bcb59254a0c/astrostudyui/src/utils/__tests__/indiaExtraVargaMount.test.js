// [#80] 印占「附加分盘」:主盘之外再挂 D9 婚姻 / D7 子女等,各出一份简表。
// 用户报障原话是「没有完整的婚姻/子女分盘」——此前 indiaChartnum 单选,一次只能挂一张。
// 判据分三层:① 选盘归一(值域/去重/上限/剔主盘) ② 简表选段(只取落宫面,不重复大运/瑜伽)
// ③ 齿轮契约(缺省 [] = 不发请求不加段 = 零回归;选项与 AstroConst 单一真值源同构)。
import * as AstroConst from '../../constants/AstroConst';
import { planIndiaExtraVargas, pickIndiaVargaBriefLines, buildAntardashaTableLines, DASHA_ANTAR_ROW_MAX } from '../../components/astro/IndiaChart';
import { TECHNIQUE_SETTINGS_SCHEMA, mergeOptionsIntoRecord } from '../techniqueMountSettings';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const fieldOf = (name)=>(TECHNIQUE_SETTINGS_SCHEMA.indiachart.fields || []).find((f)=>f.name === name);

describe('印占附加分盘 · 选盘归一(纯函数)', ()=>{
	it('值域外/非法/D1 一律剔除,去重,上限 4', ()=>{
		expect(AstroConst.normalizeIndiaExtraVargas([9, 7])).toEqual([9, 7]);
		expect(AstroConst.normalizeIndiaExtraVargas([9, 9, 7])).toEqual([9, 7]);       // 去重
		expect(AstroConst.normalizeIndiaExtraVargas([1, 9])).toEqual([9]);             // D1 不作附加
		expect(AstroConst.normalizeIndiaExtraVargas([5, 9])).toEqual([9]);             // D5 不在值域
		expect(AstroConst.normalizeIndiaExtraVargas([0, -3, NaN, 'x', null])).toEqual([]);
		expect(AstroConst.normalizeIndiaExtraVargas([2, 3, 4, 7, 9, 10])).toEqual([2, 3, 4, 7]); // 上限 4
		expect(AstroConst.normalizeIndiaExtraVargas(null)).toEqual([]);
		expect(AstroConst.normalizeIndiaExtraVargas(undefined)).toEqual([]);
		expect(AstroConst.normalizeIndiaExtraVargas({})).toEqual([]);
	});

	it('字符串形态也收(旧记录/手输 "9,7" 不至于整项蒸发)', ()=>{
		expect(AstroConst.normalizeIndiaExtraVargas('9,7')).toEqual([9, 7]);
		expect(AstroConst.normalizeIndiaExtraVargas('9，7')).toEqual([9, 7]);  // 全角逗号
		expect(AstroConst.normalizeIndiaExtraVargas('')).toEqual([]);
	});

	it('🔴 主盘自身被剔除(主盘已有整段,再出简表纯浪费预算)', ()=>{
		expect(planIndiaExtraVargas(1, [9, 7])).toEqual([9, 7]);
		expect(planIndiaExtraVargas(9, [9, 7])).toEqual([7]);
		expect(planIndiaExtraVargas(9, [9])).toEqual([]);
		expect(planIndiaExtraVargas(1, [])).toEqual([]);
	});

	it('分盘中文名与选项表单一真值源(D 序号只写一处)', ()=>{
		expect(AstroConst.indiaMountVargaLabel(9)).toBe('D9 婚姻');
		expect(AstroConst.indiaMountVargaLabel(7)).toBe('D7 子女');
		expect(AstroConst.indiaMountVargaLabel(1)).toBe('D1 命盘');
		expect(AstroConst.indiaMountVargaLabel(5)).toBe('D5');       // 值域外仍给得出可读名
		expect(AstroConst.indiaMountVargaLabel('x')).toBe('');
	});
});

describe('印占附加分盘 · 简表选段(纯函数)', ()=>{
	const SNAP = [
		'[起盘信息]', '分盘：D9', '',
		'[宫位宫头]', '一宫 白羊 12°', '',
		'[星与虚点]', '上升 白羊 12°', '',
		'[行星]', '太阳 巨蟹 3°', '月亮 天秤 20°', '',
		'[大运Dasha]', '金星大运 1990-2010', '',
		'[相位]', '日月刑', '',
		'[瑜伽格局 Yogas]', 'Gajakesari', '',
	].join('\n');

	it('🔴 只取落宫面三段,大运/相位/瑜伽一概不带(否则 N 张分盘把预算吃穿)', ()=>{
		const out = pickIndiaVargaBriefLines(SNAP, 9);
		expect(out[0]).toBe('── D9 婚姻 ──');
		expect(out).toContain('一宫 白羊 12°');
		expect(out).toContain('上升 白羊 12°');
		expect(out).toContain('太阳 巨蟹 3°');
		expect(out.join('\n')).not.toContain('金星大运');
		expect(out.join('\n')).not.toContain('日月刑');
		expect(out.join('\n')).not.toContain('Gajakesari');
	});

	it('简表远小于整段(体量判据:落宫面之外的段占大头)', ()=>{
		expect(pickIndiaVargaBriefLines(SNAP, 9).join('\n').length).toBeLessThan(SNAP.length);
	});

	it('D1 与空盘 → 零行(不产生空段)', ()=>{
		expect(pickIndiaVargaBriefLines(SNAP, 1)).toEqual([]);
		expect(pickIndiaVargaBriefLines('', 9)).toEqual([]);
		expect(pickIndiaVargaBriefLines('[大运Dasha]\n金星大运', 9)).toEqual([]);  // 三段全缺 → 不出段
	});
});

describe('印占附加分盘 · 齿轮契约', ()=>{
	it('字段在位:multiselect、缺省 []、选项不含 D1、上限写进 label', ()=>{
		const f = fieldOf('indiaExtraVargas');
		expect(f).toBeTruthy();
		expect(f.type).toBe('multiselect');
		expect(f.default).toEqual([]);
		expect(f.group).toBe('排盘');
		expect(f.options.some((o)=>o.value === 1)).toBe(false);
		expect(f.options.map((o)=>o.value)).toEqual(
			AstroConst.INDIA_MOUNT_VARGA_OPTIONS.filter((o)=>o.value !== 1).map((o)=>o.value));
		expect(f.label).toContain(`${AstroConst.INDIA_MOUNT_EXTRA_VARGA_MAX}`);
	});

	it('挂载分盘(主盘)选项同源自 AstroConst,D1 仍标「默认」', ()=>{
		const f = fieldOf('indiaChartnum');
		expect(f.default).toBe(1);
		expect(f.options.map((o)=>o.value)).toEqual(AstroConst.INDIA_MOUNT_VARGA_OPTIONS.map((o)=>o.value));
		expect(f.options[0].label).toBe('D1 命盘（默认）');
	});

	it('🔴 零回归:不选 → record 逐字不变(缺省绝不进 merge 路径)', ()=>{
		const rec = { birth: '1990-01-01 12:00', lon: '116E23', lat: '39N54' };
		expect(mergeOptionsIntoRecord(rec, 'indiachart', {})).toEqual(rec);
		expect(mergeOptionsIntoRecord(rec, 'indiachart', { indiaExtraVargas: [] })).toEqual(rec);
	});

	it('🔴 判别例:选了才写进 record(与上一条构成存/不存两拨)', ()=>{
		const rec = { birth: '1990-01-01 12:00' };
		const merged = mergeOptionsIntoRecord(rec, 'indiachart', { indiaExtraVargas: [9, 7] });
		expect(merged.indiaExtraVargas).toEqual([9, 7]);
		expect(rec.indiaExtraVargas).toBeUndefined();   // 绝不改原 record
	});

	it('「附加分盘」段已登记进导出段清单(未登记 = 自定义过段集的用户被静默滤空)', ()=>{
		expect(AI_EXPORT_PRESET_SECTIONS.indiachart).toContain('附加分盘');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// [#80] 小运(Antardasha)全展。用户报障原话之一是「没有完整的 Dasha 表」:大运九行本就在,
// 缺的是小运 —— 后端每个 mahadasha 都带 antardashas(IndiaChartMain 逐条渲染在用),快照只挑了
// 「当前大运里的当下一支」,其余整片不出。这是缺省产物变化,故按字节判据钉住行数与内容。
describe('印占小运全展 · Antardasha 表', ()=>{
	const H = {
		nameOf: (l)=>(l && (l.label || l.key)) || '—',
		fmtDate: (d)=>{ const s = `${d || ''}`; const m = s.match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : (s || '—'); },
		n1: (x)=>(Number.isFinite(+x) ? (+x) : 0),
	};
	const mk = (lord, active, subs)=>({ lord: { label: lord }, active, antardashas: subs });
	const sub = (lord, start, end, years)=>({ lord: { label: lord }, start, end, years });

	it('🔴 九个大运的小运全出(此前只出当前大运里的当下一支)', ()=>{
		const mahas = [
			mk('金星', false, [sub('金星', '1980-01-01', '1983-01-01', 3), sub('太阳', '1983-01-01', '1984-01-01', 1)]),
			mk('太阳', true, [sub('太阳', '2050-01-01', '2051-01-01', 1)]),
			mk('月亮', false, [sub('月亮', '2060-01-01', '2061-01-01', 1)]),
		];
		const out = buildAntardashaTableLines(mahas, H);
		expect(out[0]).toContain('小运序列');
		expect(out[1]).toBe('| 标记 | 大运主星 | 小运主星 | 起 | 止 | 年数 |');
		const rows = out.filter((l)=>l.startsWith('|') && !l.includes('---') && !l.includes('大运主星'));
		expect(rows).toHaveLength(4);                       // 2+1+1:非当前大运的小运也在
		expect(rows.join('\n')).toContain('| 金星 | 太阳 |');   // 非当前大运的第二支
		expect(rows.join('\n')).toContain('| 月亮 | 月亮 |');   // 未来大运的小运
	});

	it('当前大运内的行打 ·,正在走的那一支打 ▶', ()=>{
		const now = new Date();
		const y = now.getFullYear();
		const mahas = [mk('太阳', true, [
			sub('太阳', `${y - 1}-01-01`, `${y + 1}-01-01`, 2),
			sub('月亮', `${y + 1}-01-01`, `${y + 2}-01-01`, 1),
		])];
		const rows = buildAntardashaTableLines(mahas, H).filter((l)=>l.startsWith('| ▶') || l.startsWith('| ·'));
		expect(rows.filter((l)=>l.startsWith('| ▶'))).toHaveLength(1);
		expect(rows.filter((l)=>l.startsWith('| ·'))).toHaveLength(1);
	});

	it('体量在预算内:9×9 全展 ≈4 千字(远低于挂载预算),且上限截断会明说', ()=>{
		const nine = Array.from({ length: 9 }, (_, i)=>mk(`大${i}`, i === 0,
			Array.from({ length: 9 }, (_, j)=>sub(`小${j}`, '2000-01-01', '2001-01-01', 1))));
		const out = buildAntardashaTableLines(nine, H);
		const rows = out.filter((l)=>l.startsWith('|') && !l.includes('---') && !l.includes('大运主星'));
		expect(rows).toHaveLength(81);
		expect(out.join('\n').length).toBeLessThan(8000);
		expect(out.join('\n')).not.toContain('已截断');

		const many = Array.from({ length: 20 }, ()=>mk('大', false,
			Array.from({ length: 9 }, (_, j)=>sub(`小${j}`, '2000-01-01', '2001-01-01', 1))));
		const capped = buildAntardashaTableLines(many, H);
		const cappedRows = capped.filter((l)=>l.startsWith('|') && !l.includes('---') && !l.includes('大运主星'));
		expect(cappedRows).toHaveLength(DASHA_ANTAR_ROW_MAX);
		expect(capped.join('\n')).toContain('已截断');
		expect(capped.join('\n')).toContain('勿臆补');       // 与整层丢弃留痕同口吻
	});

	it('无小运数据 → 零行(不产生空表头);形状缺失不抛', ()=>{
		expect(buildAntardashaTableLines([], H)).toEqual([]);
		expect(buildAntardashaTableLines(null, H)).toEqual([]);
		expect(buildAntardashaTableLines([mk('金星', true, [])], H)).toEqual([]);
		expect(buildAntardashaTableLines([{ lord: null }], H)).toEqual([]);
		expect(()=>buildAntardashaTableLines([mk('金星', true, [null, sub('太阳')])], H)).not.toThrow();
	});
});
