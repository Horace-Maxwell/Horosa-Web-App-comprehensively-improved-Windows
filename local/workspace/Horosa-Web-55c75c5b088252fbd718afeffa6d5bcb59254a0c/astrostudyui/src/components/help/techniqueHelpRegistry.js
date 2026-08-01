// 各技法「操作手册」帮助文档注册表:currentTab → HelpDoc 组件。
// PageHeader 帮助弹窗按当前页查本表渲染对应古籍;新增技法手册=加一行,无需改 PageHeader。
import GuoLaoHelpDoc from '../guolao/GuoLaoHelpDoc';
import AstroHelpDoc from './AstroHelpDoc';
import GermanyHelpDoc from './GermanyHelpDoc';
import ZiweiHelpDoc from './ZiweiHelpDoc';
import BaziHelpDoc from './BaziHelpDoc';
import IndiaHelpDoc from './IndiaHelpDoc';
import LiurengHelpDoc from './LiurengHelpDoc';
import DunjiaHelpDoc from './DunjiaHelpDoc';
import GuazhanHelpDoc from './GuazhanHelpDoc';
import TaiyiHelpDoc from './TaiyiHelpDoc';
import FengshuiHelpDoc from './FengshuiHelpDoc';
import CnyibuHelpDoc from './CnyibuHelpDoc';
import SanshiHelpDoc from './SanshiHelpDoc';
import DirectionHelpDoc from './DirectionHelpDoc';
import AuxchartHelpDoc from './AuxchartHelpDoc';
import RelativeHelpDoc from './RelativeHelpDoc';
import JieqiHelpDoc from './JieqiHelpDoc';
import ShusuanHelpDoc from './ShusuanHelpDoc';
import YanqinHelpDoc from './YanqinHelpDoc';
import CalendarHelpDoc from './CalendarHelpDoc';
import PlanetariumHelpDoc from './PlanetariumHelpDoc';
import CntraditionHelpDoc from './CntraditionHelpDoc';
import Astro3DHelpDoc from './Astro3DHelpDoc';
import XuanshiHelpDoc from './XuanshiHelpDoc';
import AIAnalysisHelpDoc from './AIAnalysisHelpDoc';
import YizhangjingHelpDoc from './YizhangjingHelpDoc';
import AstrodataHelpDoc from './AstrodataHelpDoc';

export const TECHNIQUE_HELP_DOCS = {
	astrochart: AstroHelpDoc,
	germanytech: GermanyHelpDoc,
	guolao: GuoLaoHelpDoc,
	ziwei: ZiweiHelpDoc,
	bazi: BaziHelpDoc,
	indiachart: IndiaHelpDoc,
	liureng: LiurengHelpDoc,
	dunjia: DunjiaHelpDoc,
	guazhan: GuazhanHelpDoc,
	taiyi: TaiyiHelpDoc,
	fengshui: FengshuiHelpDoc,
	cnyibu: CnyibuHelpDoc,
	sanshiunited: SanshiHelpDoc,
	direction: DirectionHelpDoc,
	auxchart: AuxchartHelpDoc,
	relativechart: RelativeHelpDoc,
	jieqichart: JieqiHelpDoc,
	shusuan: ShusuanHelpDoc,
	yanqin: YanqinHelpDoc,
	calendar: CalendarHelpDoc,
	planetarium: PlanetariumHelpDoc,
	cntradition: CntraditionHelpDoc,
	astrochart3D: Astro3DHelpDoc,
	xuanshi: XuanshiHelpDoc,
	aianalysis: AIAnalysisHelpDoc,
	mingother: YizhangjingHelpDoc,
	astrodata: AstrodataHelpDoc,
};

// 子技法手册:这些 key 不是主 tab,而是挂在别的主 tab 下的子页签。只按主 tab 取的话,
// 在量化盘子页打开帮助会拿到「辅盘」总手册,而它自己那份手册永远打不开。
// (演禽不在此列:它本身就是 currentTab,只是导航高亮时才归一到宿主 tab。)
const SUBTECHNIQUE_HELP_KEYS = ['germanytech'];

export function getTechniqueHelpDoc(currentTab, currentSubTab){
	if(currentSubTab && SUBTECHNIQUE_HELP_KEYS.indexOf(currentSubTab) >= 0 && TECHNIQUE_HELP_DOCS[currentSubTab]){
		return TECHNIQUE_HELP_DOCS[currentSubTab];
	}
	return TECHNIQUE_HELP_DOCS[currentTab] || null;
}
