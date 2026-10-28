// 当前占星流派预设的反查单源:星盘页左栏「流派预设」下拉与 AI 设置读数同用这一个函数
// (此前 AI 读的是上次在下拉里选的记忆值,单项改过之后与盘面不符)。
// 由实时七维(黄道 / 宫制 / 界 / 三分 / 点反转 / 区分缓冲 / 相位模型)+ 点公式序反查;任一单项被单独改 → 'custom'。
// tripFallback:fields 里没有三分制时的兜底(星盘页传 app.tripSystem)。
import * as AstroConst from '../../constants/AstroConst';
import { presetOf } from './schoolPresets';
import { moietyOrbOverrides, DEFAULT_ORBS } from './AstroOrbSetting';

export function schoolPresetFromFields(fields, tripFallback){
	const f = fields || {};
	const zodiac = AstroConst.zodiacSelectValue(
		f.zodiacal ? f.zodiacal.value : 0,
		f.siderealAyanamsa ? f.siderealAyanamsa.value : '',
	);
	const hsys = f.hsys ? f.hsys.value : '';
	const termsVariant = f.termsVariant ? f.termsVariant.value : 0;
	// 三分制以 fields.triplicity(排盘真值)为准,app.tripSystem 只作镜像/兜底。
	const tripSystem = (f.triplicity && f.triplicity.value) || tripFallback || 'Dorothean';
	const lotReversal = (f.lotReversal && (f.lotReversal.value === 0 || f.lotReversal.value === '0')) ? 0 : 1;
	const sectBuffer = (f.sectBuffer && f.sectBuffer.value) ? f.sectBuffer.value : 'geo';
	// 相位模型无独立字段:由「orbs 是否恰为 moiety 覆盖集」反推 —— 非默认键集与 moiety
	// 覆盖集**全等**才算 degree 档;单点巧合(如手动把金星容许度设成 7)不再令流派下拉跳档。
	const orbs = (f.orbs && f.orbs.value) ? f.orbs.value : null;
	const moiety = moietyOrbOverrides();
	const defOrbMap = DEFAULT_ORBS.reduce((m, d)=>{ m[d.id] = Number(d.orb); return m; }, {});
	const nonDefaultKeys = orbs ? Object.keys(orbs).filter((k)=>defOrbMap[k] === undefined || Number(orbs[k]) !== defOrbMap[k]) : [];
	const moietyKeys = Object.keys(moiety);
	// 三态:全默认 → whole;恰为 moiety 集 → degree;其它非默认容许度 → custom(任何档都不命中,
	// 此前归 whole → 手改容许度后流派下拉仍显示原档)。
	const aspectModel = (orbs
		&& nonDefaultKeys.length === moietyKeys.length
		&& moietyKeys.every((k)=>Number(orbs[k]) === Number(moiety[k])))
		? 'degree' : (nonDefaultKeys.length ? 'custom' : 'whole');
	// 第八维:点公式文档序(预设切档会联动写入,此前反查不计它 → 手动改了仍显示原档)。
	const lotsDocReverse = (f.lotsDocReverse && (f.lotsDocReverse.value === 1 || f.lotsDocReverse.value === '1' || f.lotsDocReverse.value === true)) ? 1 : 0;
	return presetOf({ zodiac, hsys, termsVariant, tripSystem, lotReversal, sectBuffer, aspectModel, lotsDocReverse });
}

export default schoolPresetFromFields;
