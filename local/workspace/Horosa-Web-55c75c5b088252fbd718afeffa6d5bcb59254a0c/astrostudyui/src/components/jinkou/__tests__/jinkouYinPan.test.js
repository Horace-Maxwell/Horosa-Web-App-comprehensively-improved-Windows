/**
 * 金口诀 Batch 2（阴盘公共框架）golden：六神起例 / 六亲标注 / 旺衰量化打分 / 盘式分支零回归。
 * 只覆盖公开可复原的公共方法论；分值表为自定一致表，断言锁「相对关系与结构」而非绝对私传值。
 */
import { buildJinKouData } from '../JinKouCalc';
import { JINKOU_LIUSHEN_DOC, JINKOU_LIUQIN_DOC } from '../JinKouDoc';

function mockLR(dayGanZi, monthGanZi, timeZhi){
	return {
		nongli: { dayGanZi: dayGanZi, time: `${timeZhi}时`, monthGanZi: monthGanZi },
		fourColumns: { month: { ganzi: monthGanZi } },
		xun: { '旬空': '', '旬首': '' },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: {}, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: {} },
	};
}
const yin = (dayGanZi, monthGanZi, timeZhi, diFen)=>buildJinKouData(mockLR(dayGanZi, monthGanZi, timeZhi), { diFen: diFen, zhanShi: timeZhi, guirengType: 0, panShi: 'yin' });
const yang = (dayGanZi, monthGanZi, timeZhi, diFen)=>buildJinKouData(mockLR(dayGanZi, monthGanZi, timeZhi), { diFen: diFen, zhanShi: timeZhi, guirengType: 0 });

describe('盘式分支：阳盘零回归 / 阴盘产出三层', ()=>{
	it('阳盘不产 yinPan，其余字段与阴盘完全一致（阴盘只加不改）', ()=>{
		const a = yang('甲辰', '丙申', '申', '午');
		const b = yin('甲辰', '丙申', '申', '午');
		expect(a.yinPan).toBeNull();
		expect(b.yinPan).toBeTruthy();
		// 起盘四位与既有解读层逐键一致 —— 阴盘不改起盘算法，只加断法层。
		['renYuanGan', 'guiName', 'guiZi', 'guiGan', 'jiangZi', 'jiangName', 'jiangGan', 'wangElem'].forEach((k)=>{
			expect(b[k]).toEqual(a[k]);
		});
		expect(JSON.stringify(b.rows)).toBe(JSON.stringify(a.rows));
		expect(JSON.stringify(b.geju)).toBe(JSON.stringify(a.geju));
	});
});

describe('六神（六兽）起例', ()=>{
	it('按日干起首神、自下而上顺布六神序', ()=>{
		// 甲乙起青龙：地分青龙→将神朱雀→贵神勾陈→人元螣蛇
		const d = yin('甲辰', '丙申', '申', '午');
		const by = {};
		d.yinPan.liushen.forEach((it)=>{ by[it.wei] = it.name; });
		expect(by['地分']).toBe('青龙');
		expect(by['将神']).toBe('朱雀');
		expect(by['贵神']).toBe('勾陈');
		expect(by['人元']).toBe('螣蛇');
		// 象意随名取自六神判语库
		d.yinPan.liushen.forEach((it)=>{ expect(it.desc).toBe(JINKOU_LIUSHEN_DOC[it.name]); });
	});

	it('十干起神：戊勾陈、己螣蛇、庚辛白虎、壬癸玄武、丙丁朱雀', ()=>{
		const first = (dayGanZi)=>{
			const d = yin(dayGanZi, '丙申', '申', '午');
			return (d.yinPan.liushen.find((x)=>x.wei === '地分') || {}).name;
		};
		expect(first('丙子')).toBe('朱雀');
		expect(first('戊子')).toBe('勾陈');
		expect(first('己丑')).toBe('螣蛇');
		expect(first('庚午')).toBe('白虎');
		expect(first('壬寅')).toBe('玄武');
	});
});

describe('六亲标注（以日干为我）', ()=>{
	it('生我父母 / 我生子孙 / 克我官鬼 / 我克妻财 / 同我兄弟', ()=>{
		const d = yin('甲辰', '丙申', '申', '午');     // 日干甲＝木
		expect(d.yinPan.selfElem).toBe('木');
		const by = {};
		d.yinPan.liuqin.forEach((it)=>{ by[it.wei] = it; });
		Object.keys(by).forEach((wei)=>{
			const it = by[wei];
			if(!it.elem){ return; }
			const expectQin = { '水': '父母', '火': '子孙', '金': '官鬼', '土': '妻财', '木': '兄弟' }[it.elem];
			expect(it.qin).toBe(expectQin);
			expect(it.zhu).toBe(JINKOU_LIUQIN_DOC[expectQin]);
		});
	});
});

describe('旺衰量化打分（月令＋十二长生＋课内生克）', ()=>{
	it('每位产出 score/level/detail，三项依据齐备且 level 随分值单调', ()=>{
		const d = yin('甲辰', '丙申', '申', '午');
		const ws = d.yinPan.wangScore;
		expect(ws.length).toBe(4);
		const LEVELS = ['绝', '衰', '平', '相', '旺'];
		ws.forEach((s)=>{
			expect(typeof s.score).toBe('number');
			expect(LEVELS).toContain(s.level);
			expect(Array.isArray(s.detail)).toBe(true);
			if(s.elem){ expect(s.detail.length).toBeGreaterThan(0); }
		});
		// 单调性：分高者档不低于分低者
		const sorted = ws.slice().filter((s)=>s.elem).sort((a, b)=>b.score - a.score);
		for(let i = 1; i < sorted.length; i++){
			expect(LEVELS.indexOf(sorted[i - 1].level)).toBeGreaterThanOrEqual(LEVELS.indexOf(sorted[i].level));
		}
	});

	it('当令之五行得分高于失令（月令项真参与打分）', ()=>{
		// season 表：木旺、土死 → 同盘中木位分应高于土位
		const d = yin('甲辰', '丙申', '申', '午');
		const byElem = {};
		d.yinPan.wangScore.forEach((s)=>{ if(s.elem && byElem[s.elem] === undefined){ byElem[s.elem] = s.score; } });
		if(byElem['木'] !== undefined && byElem['土'] !== undefined){
			expect(byElem['木']).toBeGreaterThan(byElem['土']);
		}
		// 依据串须含月令与长生两类来源
		const detailAll = d.yinPan.wangScore.map((s)=>s.detail.join('')).join('');
		expect(detailAll).toMatch(/月令/);
		expect(detailAll).toMatch(/坐(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)/);
	});

	it('分值表口径标注在位（公共框架·非私传）', ()=>{
		const d = yin('甲辰', '丙申', '申', '午');
		expect(d.yinPan.scoreNote).toContain('公共框架');
		expect(d.yinPan.scoreNote).toContain('非某家私传');
	});
});
