// 卜类页面组件(六爻 / 鬼谷策 / 太乙 / 奇门 / 金口诀 / 通书 / 三式合一):全仓零引用的导出与文件内零引用的私有定义已删除,
// 在用的导出照旧;无人引用的遗留文件已删。
import fs from 'fs';
import path from 'path';
import * as duanJue from '../../gua/liuyaoDuanJue';
import * as guFa from '../../gua/liuyaoGuFa';
import * as shenShaEx from '../../gua/liuyaoShenShaEx';
import * as yingQi from '../../gua/liuyaoYingQi';
import * as yongShen from '../../gua/liuyaoYongShen';
import * as lyConst from '../../gua/LiuYaoConst';
import * as guiceEngine from '../../guice/core/guiceEngine';
import * as guiceConst from '../../guice/core/guiceConst';
import * as guiceQiGua from '../../guice/core/guiceQiGua';
import * as taiyiCalc from '../../taiyi/TaiYiCalc';
import * as dunjiaCalc from '../../dunjia/DunJiaCalc';
import * as qimenXiangDoc from '../../dunjia/QimenXiangDoc';
import * as dunjiaFaDoc from '../../dunjia/DunJiaFaDoc';
import * as tongshuData from '../../calendar/tongshuData';
import * as zhanlei from '../LiuYaoZhanLeiView';

const COMP = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(COMP, rel), 'utf8');

const GONE = [
	[duanJue, ['yuqiOf', 'changShengGuiOf', 'guaiYaoOf', 'powerCanKe']],
	[guFa, ['guanGuoOf', 'huaRuMuOf']],
	[shenShaEx, ['jinTuiGZOf', 'siLiSanYuan', 'SILI_SANYUAN', 'JINSHEN_GZ', 'TUISHEN_GZ', 'SHENSHA_EX_GROUPS']],
	[yingQi, ['futureZhiOffsets']],
	[yongShen, ['LIUQIN_LIST']],
	[lyConst, ['GUA_HOUTIAN']],
	[guiceEngine, ['yuanHuiYunShiOf', 'YANSHU_MODES']],
	[guiceConst, ['DONGJING', 'JI_GONG_SLOTS']],
	[guiceQiGua, ['YIZI_LEFT', 'YIZI_RIGHT']],
	[taiyiCalc, ['getAccumLabel', 'TENCHING_OPTIONS', 'ROTATION_OPTIONS']],
	[dunjiaCalc, ['buildJieqiYearSeed']],
	[qimenXiangDoc, ['getQimenDocRawText']],
	[dunjiaFaDoc, ['YI_XIANG_GAN']],
	[tongshuData, ['TERM_TO_CATEGORY']],
	[zhanlei, ['setZhanleiDoctrine']],
];

describe('卜类页面组件:死代码已删、在用导出照旧', ()=>{
	test('零引用导出不再存在', ()=>{
		const left = [];
		GONE.forEach(([mod, names])=>{
			names.forEach((n)=>{ if(n in mod){ left.push(n); } });
		});
		expect(left).toEqual([]);
	});

	test('同模块里在用的导出照旧', ()=>{
		expect(typeof duanJue.wangShuaiWithYuqi).toBe('function');
		expect(typeof duanJue.jinShenBy).toBe('function');
		expect(typeof guFa.baJieByMonth).toBe('function');
		expect(typeof yingQi.changShengZhiOf).toBe('function');
		expect(yingQi.muZhiOf('金')).toBe('丑');
		expect(lyConst.GUA_WUXING['乾']).toBe('金');
		expect(guiceConst.HOUTIAN_NUM['坎']).toBe(1);
		expect(guiceQiGua.PING_ZE['平']).toBe(1);
		expect(Array.isArray(taiyiCalc.SEX_OPTIONS)).toBe(true);
		expect(Array.isArray(tongshuData.TONGSHU_TERM_CATEGORIES)).toBe(true);
		expect(dunjiaFaDoc.MEN_PO_JIE['休']).toBe('丑');
	});

	test('文件内零引用的私有定义已删', ()=>{
		const dj = read('dunjia/DunJiaMain.js');
		['DUNJIA_LEGEND_ITEMS', 'GAN_COLOR_MAP', 'function getBaZiStemColor(', 'function getBaZiBranchColor(', 'function parseZoneOffsetHour('].forEach((s)=>{
			expect(dj).not.toContain(s);
		});
		const calc = read('dunjia/DunJiaCalc.js');
		expect(calc).not.toContain('function nextGanZhi(');
		expect(calc).not.toContain('function parseDayFromTime(');
		expect(read('sanshi/SanShiUnitedMain.js')).not.toMatch(/^const PALACE_GRID\b/m);
		expect(read('gua/liuyaoShenShaEx.js')).not.toMatch(/^const SANHE_GROUP\b/m);
		expect(read('gua/liuyaoYingQi.js')).not.toMatch(/^const (zi|idx) = /m);
		expect(read('gua/liuyaoGuFa.js')).not.toMatch(/^const HUA_MU_DEATH\b/m);
		const jk = read('jinkou/JinKouCalc.js');
		expect(jk).not.toContain('function resolveIsDay(');
		expect(jk).not.toContain('function collectShenSha(');
		['zeri/SanshiZeriMain.js', 'zeri/LiurengZeriMain.js'].forEach((rel)=>{
			expect(read(rel)).not.toMatch(/^const ZHI12_N\b/m);
		});
	});

	test('经展开运算符在用的私有定义保留(不是死代码)', ()=>{
		expect(read('dunjia/DunJiaFaCalc.js')).toMatch(/\.\.\.locateGod\(/);
		expect(read('dunjia/DunJiaFaCalc.js')).toMatch(/\.\.\.locateDoor\(/);
		expect(read('calendar/tongshuSnapshot.js')).toMatch(/\.\.\.donggongSection\(/);
	});

	test('无人引用的遗留文件已删', ()=>{
		expect(fs.existsSync(path.join(COMP, 'gua', 'Gua3.js'))).toBe(false);
	});
});
