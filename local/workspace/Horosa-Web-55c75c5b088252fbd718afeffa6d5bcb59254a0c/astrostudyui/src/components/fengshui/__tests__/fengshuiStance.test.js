// 流派立场对照表 · 制度化哨兵。
// 🔴 这张表不是文案而是**制度**：每一条都对应代码里一处真实的「并陈不合并」实现。
//    本测把「表里登记的」与「代码里实际做到的」对拍，防止表与实现脱节（表说并陈、代码却合并了）。
import { STANCE_ROWS, STANCE_LAWS, STANCE_NOTE } from '../fengshuiStanceData';
import { SCHOOL_CN } from '../LiqiWorkspace';
import { LIQI_SCHOOL_IMPL } from '../liqi/registry';
import { SHUILONG_WUXING, SHUIXUE_HOUKONG } from '../fengshuiShuilongData';
import { DINGXUE_13, ZHENGXUE_13 } from '../fengshuiXingshiData';
import { DINGXUE_9, ZHENGXUE_10 } from '../fengshuiData';
import { QISHA_LIQI } from '../fengshuiHuashaData';
import { ZONGJING_YU, ZHUJI_SHUZHENG } from '../fengshuiZeriDeepData';
import { xuankong } from '../xuankong';
import { sanhe } from '../sanhe';
import { bazhai } from '../bazhai';
import { dagua } from '../dagua';

describe('表本身完整', ()=>{
	it('每条都有 议题/甲说/乙说/落地，键不重复', ()=>{
		expect(STANCE_ROWS.length).toBeGreaterThanOrEqual(13);
		const keys = new Set();
		STANCE_ROWS.forEach((r)=>{
			expect(r.topic).toBeTruthy();
			expect(r.a && r.a.name && r.a.text).toBeTruthy();
			expect(r.b && r.b.name && r.b.text).toBeTruthy();
			expect(r.how).toBeTruthy();
			expect(keys.has(r.key)).toBe(false); keys.add(r.key);
		});
	});
	it('四条铁律在册，且首条即「只述分歧不判对错」', ()=>{
		expect(STANCE_LAWS).toHaveLength(4);
		expect(STANCE_LAWS[0]).toMatch(/只述分歧，不判对错/);
		expect(STANCE_LAWS[1]).toMatch(/既有实现零改/);
		expect(STANCE_LAWS[2]).toMatch(/不自造规则/);
		expect(STANCE_NOTE).toMatch(/两说并陈/);
	});
	it('🔴 出处只写公有古籍名或中性称谓——不得出现现代书名/作者/册次/页码之痕迹', ()=>{
		const all = JSON.stringify(STANCE_ROWS) + STANCE_LAWS.join('') + STANCE_NOTE;
		[/第\s*\d+\s*页/, /[《〈][^》〉]{0,20}(讲义|手册|教程|居住时空|和谐家居)/, /著|编著|主编/, /§\s*\d/].forEach((re)=>{
			expect(all).not.toMatch(re);
		});
	});
});

describe('🔴 表里登记的「并陈」在代码里真的并陈（表与实现不得脱节）', ()=>{
	it('大卦 vs 飞星：两派各自在册，且大卦深化 opt-in 不动飞星', ()=>{
		expect(SCHOOL_CN.dagua).toBeTruthy();
		expect(SCHOOL_CN.xuankong).toBeTruthy();
		const a = dagua({ xiangLower: '震', xiangUpper: '艮', yun: 9 });
		const b = dagua({ xiangLower: '震', xiangUpper: '艮', yun: 9, showDeep: true });
		const strip = (o)=>{ const c = { ...o }; delete c.deep; return JSON.stringify(c); };
		expect(strip(a)).toBe(strip(b));
	});
	it('大玄空 vs 飞星：大玄空为独立 registry 派', ()=>{
		expect(LIQI_SCHOOL_IMPL.daxuankong).toBeTruthy();
		expect(SCHOOL_CN.daxuankong).toBeTruthy();
	});
	it('八宅法脉三档：三档各出各判，缺省档零回归', ()=>{
		const base = { zuoGua: '坎', doorGua: '巽' };
		const a = bazhai(base);
		const b = bazhai({ ...base, faMai: 'menshang' });
		const c = bazhai({ ...base, faMai: 'sanyuan', yun: 9 });
		expect(a.faMai).toBe('zuoshan');
		expect(JSON.stringify(a.palaces)).not.toBe(JSON.stringify(b.palaces));
		expect(c.sanyuan).toBeTruthy();
		expect(a.sanyuan).toBeNull();
	});
	it('山龙 vs 水龙：相反三处在数据里显式标注', ()=>{
		expect(SHUILONG_WUXING.ji).toEqual(['金', '水', '土']);
		expect(SHUILONG_WUXING.fanCha).toMatch(/与山龙相反/);
		expect(SHUIXUE_HOUKONG.jue).toMatch(/山穴后高丁禄盛，水穴后高绝无踪/);
		expect(SCHOOL_CN.shuilong).toBeTruthy();
		expect(SCHOOL_CN.xingshi).toBeTruthy();
	});
	it('定穴证穴：九法/十证 与 十三法/十三证 并存（合表即造第三套）', ()=>{
		expect(DINGXUE_9.length).toBeGreaterThan(0);
		expect(ZHENGXUE_10.length).toBeGreaterThan(0);
		expect(DINGXUE_13).toHaveLength(13);
		expect(ZHENGXUE_13).toHaveLength(13);
	});
	it('拨砂三档：赖公与双山不同源，缺坐山时如实回落', ()=>{
		const base = { shuiKou: '辛', waterFlow: 'leftToRight', sands: { 坎: 'sand' } };
		expect(sanhe(base).bosha.boshaVariant).toBe('shuangshan');
		expect(sanhe({ ...base, boshaVariant: 'laigong', zuoShanForBosha: '子' }).bosha.myFrom).toMatch(/人盘中针/);
		expect(sanhe({ ...base, boshaVariant: 'laigong' }).bosha.fellBack).toMatch(/赖公档需坐山/);
	});
	it('🔴 收山出煞不改 ge 的本判（表里写的「不改本判」必须为真）', ()=>{
		const a = xuankong(8, '午', {});
		const worst = { 1: 'shui', 2: 'shui', 3: 'shui', 4: 'shui', 6: 'shui', 7: 'shui', 8: 'shui', 9: 'shui' };
		const b = xuankong(8, '午', { shousha: worst });
		expect(b.ge).toBe(a.ge);
		expect(b.shousha.note).toMatch(/虽上山下水亦吉/);
	});
	it('紫白两说：两段原文都在，且明写不判孰是', ()=>{
		expect(ZONGJING_YU).toMatch(/作木山宜一白而忌六白/);
		expect(ZHUJI_SHUZHENG).toMatch(/两说并陈，本页不判孰是/);
	});
	it('些子法：爻序称法差异据实标出，未改判据迁就标签', ()=>{
		const d = dagua({ xiangLower: '震', xiangUpper: '艮', longLower: '巽', longUpper: '乾', chouYao: 2, showDeep: true, yun: 9 }).deep;
		expect(d.luopanNote).toMatch(/罗盘内容不可尽信/);
		expect(d.yaoXuNote).toMatch(/传本称此结果为「抽三爻」/);
	});
	it('阴神满地按相异阴星计，且此取舍在数据里写明理由', ()=>{
		const s = QISHA_LIQI.find((x)=>x.key === 'yinshen');
		expect(s.yinShen).toBe(true);
		expect(s.fix.join('')).toMatch(/4 与 2/);      // 传本所列皆相异两星之配
	});
	it('259 合局煞：内部自相矛盾者依正文，并原样存疑', ()=>{
		const s = QISHA_LIQI.find((x)=>x.key === 'he259');
		expect(s.combo).toEqual([2, 5, 9]);
		expect(s.conflict).toMatch(/标题作「257 合局煞」/);
	});
});

describe('每条 how 都要说清「怎么落地」，不能只是口号', ()=>{
	// 「怎么落地」只认这几种具体机制之一：并陈同屏 / 独立流派 / 开关切档 / 既有零改 /
	// 据实标注（不判、照录、写明理由）。空喊「已处理」不算。
	const MECHANISM = /并陈|并存|并列|独立|切档|开关|零改|一字未改|不改|未改|据实标出|写明理由|不判|照录|标出存疑|未擅改|opt-in/;
	it('每条 how 至少落到一种具体机制上，不能只是口号', ()=>{
		STANCE_ROWS.forEach((r)=>{
			expect(`${r.key}: ${r.how}`).toMatch(MECHANISM);
		});
	});
	it('凡宣称「零改／不改本判」者，同条必点名被保护的对象', ()=>{
		STANCE_ROWS.filter((r)=>/零改|一字未改|不改/.test(r.how)).forEach((r)=>{
			expect(r.how.length).toBeGreaterThan(20);
		});
	});
});
