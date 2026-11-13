// 各技法「操作手册」帮助文档注册表:currentTab → HelpDoc 组件。
// PageHeader 帮助弹窗按当前页查本表渲染对应古籍;新增技法手册=加一行,无需改 PageHeader。
import GuoLaoHelpDoc from '../guolao/GuoLaoHelpDoc';
import AstroHelpDoc from './AstroHelpDoc';
import DongyaHelpDoc from './DongyaHelpDoc';
import ZhufangHelpDoc from './ZhufangHelpDoc';
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
import TarotHelpDoc from './TarotHelpDoc';
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
import MingOtherHelpDoc from './MingOtherHelpDoc';
import AstrodataHelpDoc from './AstrodataHelpDoc';
import ZeriHelpDoc from './ZeriHelpDoc';

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
	tarot: TarotHelpDoc,
	sanshiunited: SanshiHelpDoc,
	direction: DirectionHelpDoc,
	auxchart: AuxchartHelpDoc,
	relativechart: RelativeHelpDoc,
	jieqichart: JieqiHelpDoc,
	shusuan: ShusuanHelpDoc,
	yanqin: YanqinHelpDoc,
	dongya: DongyaHelpDoc,
	zhufang: ZhufangHelpDoc,
	calendar: CalendarHelpDoc,
	planetarium: PlanetariumHelpDoc,
	cntradition: CntraditionHelpDoc,
	astrochart3D: Astro3DHelpDoc,
	xuanshi: XuanshiHelpDoc,
	aianalysis: AIAnalysisHelpDoc,
	mingother: MingOtherHelpDoc,
	yizhangjing: YizhangjingHelpDoc,
	astrodata: AstrodataHelpDoc,
	zeri: ZeriHelpDoc,
};

// 一页一本手册(HelpBook):本页所有技法都在这本书里各占一章,打开时由书按当前子页签 / 当前技法停到那一章
// (见 HelpBook.resolveChapterKey)。量化盘在辅盘里是书中一组;只有从合盘页打开量化盘时才单独给量化盘那本。
// 命·其他 = 策天飞星 / 演禽 / 一掌经 / 东亚 / 诸方 合成一本(MingOtherHelpDoc);演禽、东亚、诸方、一掌经各自那本
// 仍在注册表里,给外部 AI 按 horosa://help/<tab> 单独读。
const SUBTECHNIQUE_HELP_KEYS = { relativechart: ['germanytech'] };

export function getTechniqueHelpDoc(currentTab, currentSubTab){
	const own = SUBTECHNIQUE_HELP_KEYS[currentTab];
	if(currentSubTab && own && own.indexOf(currentSubTab) >= 0 && TECHNIQUE_HELP_DOCS[currentSubTab]){
		return TECHNIQUE_HELP_DOCS[currentSubTab];
	}
	return TECHNIQUE_HELP_DOCS[currentTab] || null;
}

// 宿主页当前技法(页内技法条切换时由技法组件写入的运行时口径,与 AI 导出取当前技法同源)。
export function currentHostTechnique(currentTab){
	try{
		const raw = typeof window !== 'undefined' ? window.__horosaKinAstroCurrent : null;
		return raw && typeof raw === 'object' && raw[currentTab] ? `${raw[currentTab]}` : '';
	}catch(e){
		return '';
	}
}
