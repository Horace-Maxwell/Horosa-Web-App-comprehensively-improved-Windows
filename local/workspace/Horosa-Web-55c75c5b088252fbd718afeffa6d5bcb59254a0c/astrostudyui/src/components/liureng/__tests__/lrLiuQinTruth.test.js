// [Issue#75 2026-08-19] 用户实报:乙丑日末传巳火,六亲取成「父母」——乙木生巳火应为子孙。
// 根因:ZiLiuQin 是 120 格全手抄常量表,乙日火支两格(巳/午)抄错(甲日同列却是对的=纯手抄漂移)。
// 制度化:本合同以「五行生克」权威公式逐格反推,与表逐格对拍——任何一格再漂即红。
// 六亲(以日干为我):同五行=兄弟 / 我生=子孙 / 生我=父母 / 我克=妻财 / 克我=官鬼。
import { ZiLiuQin } from '../LRConst';

const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function truthOf(zhi, gan){
	const z = ZHI_WX[zhi];
	const g = GAN_WX[gan];
	if(z === g){ return '兄弟'; }
	if(SHENG[g] === z){ return '子孙'; }
	if(SHENG[z] === g){ return '父母'; }
	if(KE[g] === z){ return '妻财'; }
	if(KE[z] === g){ return '官鬼'; }
	return '?';
}

describe('大六壬六亲表 ≡ 五行生克派生(120 格全覆盖)', ()=>{
	it('十二支 × 十干 = 120 格逐格与生克公式一致', ()=>{
		const wrong = [];
		Object.keys(ZHI_WX).forEach((zhi)=>{
			Object.keys(GAN_WX).forEach((gan)=>{
				const got = ZiLiuQin[zhi] && ZiLiuQin[zhi][gan];
				const want = truthOf(zhi, gan);
				if(got !== want){ wrong.push(`${zhi}+${gan}日: 表=${got} 应=${want}`); }
			});
		});
		expect(wrong).toEqual([]);
	});
	it('表结构完备:12 支 × 10 干无缺格', ()=>{
		expect(Object.keys(ZiLiuQin).sort()).toEqual(Object.keys(ZHI_WX).sort());
		Object.keys(ZiLiuQin).forEach((zhi)=>{
			expect(Object.keys(ZiLiuQin[zhi]).sort()).toEqual(Object.keys(GAN_WX).sort());
		});
	});
	it('Issue#75 用户实例:乙丑日末传巳火 = 子孙(修前为父母)', ()=>{
		expect(ZiLiuQin['巳']['乙']).toBe('子孙');
		expect(ZiLiuQin['午']['乙']).toBe('子孙');   // 同批同因错格
		expect(ZiLiuQin['巳']['甲']).toBe('子孙');   // 同列对照锚(修前即正确,防误改)
	});
});
