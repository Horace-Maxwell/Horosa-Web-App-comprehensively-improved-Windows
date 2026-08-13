// 八宅派（东西四宅·大游年）· 命卦相配 + 阳宅三要门主灶 + 九星配六事 + 静动变化宅穿宫。
// 大游年八星用「翻卦掌变爻法」(上中下中上中下中)生成(与正统古法 等价)。门主灶(3.9)/六事(3.10)/穿宫(3.8)。
import { mingGua, mingGroup } from './liqiCore';
import { HOUTIAN_POS, POS_NAME, GONG_GUA } from './fengshuiData';

// 八卦二进制 [下,中,上]（阳1阴0）。
const GUA_BIN = {
	乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
	巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0],
};
const BIN_GUA = (()=>{ const m = {}; Object.keys(GUA_BIN).forEach((g)=>{ m[GUA_BIN[g].join('')] = g; }); return m; })();
const GONG_TO_GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
const EAST = ['坎', '离', '震', '巽'];

// 翻卦变爻序：爻index 上=2/中=1/下=0；八步 上中下中上中下中 → 八星。
const FLIP_SEQ = [2, 1, 0, 1, 2, 1, 0, 1];
const STAR_SEQ = [
	{ key: 'shengqi', name: '生气', star: '贪狼', jx: 'good', rank: '吉', desc: '旺丁进财·活力·升迁' },
	{ key: 'wugui', name: '五鬼', star: '廉贞', jx: 'bad', rank: '大凶', desc: '火灾·官非·失盗·争斗' },
	{ key: 'yannian', name: '延年', star: '武曲', jx: 'good', rank: '吉', desc: '寿康·姻缘·人和·财禄' },
	{ key: 'liusha', name: '六煞', star: '文曲', jx: 'bad', rank: '凶', desc: '桃花·口舌·破财·官讼' },
	{ key: 'huohai', name: '祸害', star: '禄存', jx: 'bad', rank: '凶', desc: '是非·疾病·退气' },
	{ key: 'tianyi', name: '天医', star: '巨门', jx: 'good', rank: '吉', desc: '健康·贵人·财稳' },
	{ key: 'jueming', name: '绝命', star: '破军', jx: 'bad', rank: '大凶', desc: '重病·绝嗣·灾厄' },
	{ key: 'fuwei', name: '伏位', star: '辅弼', jx: 'good', rank: '小吉', desc: '安稳·守成·助文昌' },
];
// 九星配六事（3.10）：吉星宜、凶星忌。
const LIUSHI_ADVICE = {
	生气: '宜大门·主卧·书房·神位·客厅·灶口朝向', 天医: '宜主卧(利病弱)·厨房·餐厅·灶口朝向',
	延年: '宜大门·夫妻主卧(和合)·办公位', 伏位: '宜书房·财位·静室',
	祸害: '忌置门床;宜厕所·杂物·楼梯', 六煞: '忌置门床;宜厕所·浴室·储藏',
	五鬼: '大凶;宜压灶身·厕所·仓库', 绝命: '大凶;宜压灶身·厕所·车库·不住人',
};
// 静动变化宅（3.8）：按进深分类。
const ZHAI_TYPE = {
	jing: { name: '静宅', range: '一进(独院)', method: '单起伏位，布大游年一盘' },
	dong: { name: '动宅', range: '二至五进', method: '自大门起，逐进穿宫轮布游年' },
	bian: { name: '变宅', range: '六至十进', method: '穿宫递变，气逐进转' },
	hua: { name: '化宅', range: '十一至十五进', method: '多重穿宫，气化深入' },
};

// 大游年八星：坐山卦（伏位）→ {方位宫: 星}。
export function dayouNian(zuoGua) {
	const bin = GUA_BIN[zuoGua];
	if (!bin) { return null; }
	const cur = bin.slice();
	const out = {};
	for (let i = 0; i < 8; i++) {
		const yao = FLIP_SEQ[i];
		cur[yao] = cur[yao] ? 0 : 1;
		const gua = BIN_GUA[cur.join('')];
		const gong = HOUTIAN_POS[gua];
		out[gong] = { ...STAR_SEQ[i], gua, gong, dir: POS_NAME[gong] };
	}
	return out;
}

// 两卦大游年关系（阳宅三要 3.9）：guaA 为伏位，看 guaB 所在宫得何星。
export function guaRelation(guaA, guaB) {
	if (!GUA_BIN[guaA] || !GUA_BIN[guaB]) { return null; }
	if (guaA === guaB) { return { name: '伏位', jx: 'good', rank: '小吉', desc: '同卦·本位安稳' }; }
	const stars = dayouNian(guaA);
	const s = stars[HOUTIAN_POS[guaB]];
	return s ? { name: s.name, jx: s.jx, rank: s.rank, desc: s.desc } : null;
}

// 八宅排盘：坐山 + 命卦相配 + 门主灶三要 + 九星配六事 + 静动变化。
//   { zuoGua, ming:{year,isMale}, mode, doorGua, mainGua, stoveGua, zhaiType }
// faMai 法脉三档（古法并陈，切档即换起例，不可混算）：
//   'zuoshan'（默认·通行）＝以坐山卦起伏位排大游年；
//   'menshang'          ＝以**大门卦**起伏位排大游年（古籍主张此为真法，但坊间多从坐山，故并存可切）；
//   'sanyuan'           ＝三元阳宅：**以门向与三元衰旺定宅**，游年只作断时日之用
//                          （古籍：「八宅因门坐向空，三元衰旺定真踪」「天医福德莫安排，只好游年断时日」）。
export function bazhai({ zuoGua, ming, mode = 'zhai', doorGua, mainGua, stoveGua, zhaiType = 'jing',
	faMai = 'zuoshan', yun = 9, lunMing = true } = {}) {
	if (!(zuoGua in GUA_BIN)) { return { available: false }; }
	const zhaiGroupName = EAST.indexOf(zuoGua) >= 0 ? '东四宅' : '西四宅';
	// 法脉：起伏位之卦（坐山 / 大门）；三元阳宅档亦以门为主（其游年只断时日）。
	const fuweiGua = ((faMai === 'menshang' || faMai === 'sanyuan') && doorGua && GUA_BIN[doorGua]) ? doorGua : zuoGua;
	const stars = dayouNian(fuweiGua);
	let mingGuaNum = null; let mingGroupName = null; let mingStars = null; let match = null;
	if (lunMing !== false && ming && ming.year) {
		mingGuaNum = mingGua(ming.year, ming.isMale !== false);
		mingGroupName = mingGroup(mingGuaNum);
		const mGua = GONG_TO_GUA[mingGuaNum] || GONG_GUA[mingGuaNum];
		if (mGua && GUA_BIN[mGua]) { mingStars = dayouNian(mGua); }
		const zhaiEast = zhaiGroupName === '东四宅';
		const mingEast = mingGroupName === '东四命';
		match = { same: zhaiEast === mingEast, text: (zhaiEast === mingEast) ? '宅命同组·相配为吉' : '宅命跨组·不利（宜用游年吉方布局补救）' };
	}
	const baseStars = (mode === 'ming' && mingStars) ? mingStars : stars;
	const goodDirs = Object.values(baseStars).filter((s)=>s.jx === 'good').map((s)=>`${s.dir}(${s.name})`);
	const badDirs = Object.values(baseStars).filter((s)=>s.jx === 'bad').map((s)=>`${s.dir}(${s.name})`);

	// 九星配六事（3.10）：八方各宜忌。
	const liushi = Object.keys(baseStars).map((g)=>{
		const s = baseStars[g];
		return { gong: +g, dir: s.dir, gua: s.gua, star: s.name, jx: s.jx, advice: LIUSHI_ADVICE[s.name] || '' };
	}).sort((a, b)=>a.gong - b.gong);

	// 阳宅三要（3.9）：门×主、主×灶、门×灶 两两大游年关系 + 三吉宅。
	let sanYao = null;
	if (doorGua && mainGua && stoveGua && GUA_BIN[doorGua] && GUA_BIN[mainGua] && GUA_BIN[stoveGua]) {
		const dm = guaRelation(doorGua, mainGua);
		const ms = guaRelation(mainGua, stoveGua);
		const dz = guaRelation(doorGua, stoveGua);
		const allGood = [dm, ms, dz].every((r)=>r && r.jx === 'good');
		const anyGreatBad = [dm, ms, dz].some((r)=>r && (r.name === '绝命' || r.name === '五鬼'));
		sanYao = {
			doorGua, mainGua, stoveGua,
			menMain: dm, mainStove: ms, menStove: dz,
			verdict: allGood ? { text: '三吉宅·门主灶互见吉星→福寿财丁', jx: 'good' }
				: anyGreatBad ? { text: '门主灶犯绝命/五鬼→损丁破财病灾', jx: 'bad' }
					: { text: '吉凶相杂·宜调门主灶归吉方', jx: 'neutral' },
			// 灶诀：灶身宜坐凶方、火门朝吉方。
			stoveRule: '灶座宜压凶方（绝命/五鬼）以镇煞、火门朝吉方（生气/天医）纳吉',
		};
	}

	// 三元阳宅（蒋氏一路）：以门向与三元衰旺定宅，游年降为「只断时日」。
	//   古籍：「八宅因门坐向空，三元衰旺定真踪」；「天医福德莫安排，只好游年断时日；
	//          逢兴鬼绝更昌隆，遇替生延皆困迫」——宅运兴时鬼绝反昌、宅运替时生延反困。
	let sanyuan = null;
	if (faMai === 'sanyuan') {
		const y = Math.trunc(Number(yun)) || 9;
		const menGua = (doorGua && GUA_BIN[doorGua]) ? doorGua : null;
		const menGong = menGua ? HOUTIAN_POS[menGua] : null;
		// 门所在宫之数与当运数比较：得令（当运/生气）为兴，失令为替。
		const sheng = ((y % 9) + 1);                    // 次运＝生气
		const wang = !!menGua && menGong === y;
		const shengQi = !!menGua && menGong === sheng;
		const xingTi = (wang || shengQi) ? 'xing' : 'ti';
		// 🔴 本档「以门向定宅」，没门卦就没得判：据实报缺，绝不把 null 拼进用户可见文案
		//    （真机上曾读出「门在null宫非当运非生气」——jest 只断了 xingTi 没断文案，没拦住）。
		sanyuan = {
			yun: y, menGua, menGong, wang, shengQi, xingTi, needsMen: !menGua,
			verdict: !menGua ? { text: '未设大门之卦——本档以门向定宅，请先在左栏设「门卦」', jx: 'neutral' }
				: (wang ? { text: `门在${menGua}宫得当运${y}——宅气正兴`, jx: 'good' }
					: (shengQi ? { text: `门在${menGua}宫得生气${sheng}——宅气将兴`, jx: 'good' }
						: { text: `门在${menGua}宫非当运非生气——宅气已替`, jx: 'bad' })),
			youNianRole: '本档游年只作断时日之用，不据以定宅吉凶',
			fanZhuan: !menGua ? '（未设门卦，兴替未定）'
				: (xingTi === 'xing'
					? '宅运兴时：纵游年落鬼绝，亦「逢兴鬼绝更昌隆」'
					: '宅运替时：纵游年得生延，亦「遇替生延皆困迫」'),
			note: '八宅因门坐向空，三元衰旺定真踪 —— 本档与「坐山起伏位」为两路口径，不可混算。',
		};
	}

	return {
		available: true, zuoGua, zhaiGroup: zhaiGroupName,
		faMai, fuweiGua, lunMing: lunMing !== false, sanyuan,
		palaces: Object.keys(baseStars).map((g)=>({ gong: +g, ...baseStars[g] })),
		mingGua: mingGuaNum, mingGroup: mingGroupName, match, mode,
		doorMainStove: {
			door: `宜开${goodDirs[0] || '吉方'}`, main: `主卧宜${goodDirs.slice(0, 2).join('/') || '吉方'}`,
			stove: `灶宜坐凶（${badDirs[0] || '凶方'}）向吉、火口朝${goodDirs[0] || '吉方'}`,
		},
		sanYao, liushi,
		zhaiType, zhaiTypeInfo: ZHAI_TYPE[zhaiType] || ZHAI_TYPE.jing,
		note: '大游年翻卦变爻法生成;门主灶三要(3.9)/九星配六事(3.10)/静动变化宅(3.8)',
	};
}

export { GUA_BIN };
