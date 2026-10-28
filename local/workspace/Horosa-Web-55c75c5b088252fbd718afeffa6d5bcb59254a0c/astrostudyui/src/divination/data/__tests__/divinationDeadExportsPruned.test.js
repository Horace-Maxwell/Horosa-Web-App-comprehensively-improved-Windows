// 卜卦 / 择日 / 巴比伦 / 世俗 数据与引擎模块:全仓零引用的导出与模块私有定义已删除;同模块里仍在用的导出照旧在。
// 删掉的只是没人引用的别名 / 包装 / 资料常量,底层 JSON 数据仍由在用的导出提供。
import fs from 'fs';
import path from 'path';
import * as egyptianData from '../egyptianData';
import * as hellenisticData from '../hellenisticData';
import * as lots from '../lots';
import * as planetaryHours from '../planetaryHours';
import * as signFertility from '../signFertility';
import * as topicMaster from '../topicMaster';
import * as babylonianData from '../babylonianData';
import * as aspects from '../aspects';
import * as houseMeanings from '../houseMeanings';
import * as signs from '../signs';
import * as planets from '../planets';
import * as directions from '../directions';
import * as engineUtils from '../../engine/utils';
import * as describe_ from '../../horary/describe';
import * as horarySchools from '../../horary/horarySchools';
import * as huangliZeriSnapshot from '../../zeri/huangliZeriSnapshot';
import * as qizhengZeri from '../../zeri/qizhengZeriConditionTypes';
import * as units from '../../babylon/units';
import * as babCalendar from '../../babylon/calendar';
import * as mathAstro from '../../babylon/mathAstro';
import * as microzodiac from '../../babylon/microzodiac';
import * as conjunctionEras from '../../mundane/conjunctionEras';

const DIV = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(DIV, rel), 'utf8');

const GONE = [
	[egyptianData, ['decanByLon']],
	[hellenisticData, ['planetYears', 'HELLENISTIC_EXT', 'ZR_NOTES', 'MONOMOIRIA', 'BOUNDS_EGYPTIAN', 'BOUNDS_PTOLEMAIC', 'FACES_CHALDEAN', 'JOYS', 'SECT', 'PLACES']],
	[lots, ['lotPosition']],
	[planetaryHours, ['hourThemes']],
	[signFertility, ['fertilityOf', 'FERTILITY_CN', 'MOST_FERTILE_SET']],
	[topicMaster, ['topicInfo', 'TOPIC_LIST']],
	[babylonianData, ['GOD_NUMBERS', 'SUBDIVISION', 'HOROSCOPE_META', 'BABYLON_CONSTANTS']],
	[aspects, ['ANTISCION', 'ASPECT_PRIORITY', 'ELECTION_ORBS']],
	[houseMeanings, ['CADENT_HOUSES', 'CAR_HOUSE', 'COMPANY_HOUSE']],
	[signs, ['ASC_DEGREE_RULE', 'MODALITY_USAGE']],
	[planets, ['RETROGRADE_NOTES']],
	[directions, ['DIR_BY_HOUSE']],
	[engineUtils, ['dignityTokenScore']],
	[describe_, ['pickDescriptor', 'DISEASE_PSYCH']],
	[horarySchools, ['presetLabelOf']],
	[huangliZeriSnapshot, ['huangliZeriConditionKeys']],
	[qizhengZeri, ['QZ_SIGN_STATUS_SEQ']],
	[units, ['usToHours', 'usToBeru', 'beruToUs', 'largeHoursToUs', 'usToLargeHours', 'degToCubit', 'fingerToDeg', 'eclipseFingerToSe',
		'tithiToDays', 'daysToTithi', 'tithiToMonthsDays', 'US_PER_DAY', 'US_PER_BERU', 'NINDA_PER_US', 'US_PER_LARGE_HOUR', 'MINUTES_PER_US',
		'SCHEMATIC_CUBIT_DEG', 'YEAR_MONTHS_A', 'YEAR_MONTHS_B', 'SOLAR_RATE_TITHI_PER_DEG', 'YEAR_TITHI']],
	[babCalendar, ['jdnToJulian']],
	[mathAstro, ['sarosInfo', 'eclipsePossibilities', 'JUPITER_PUSHES', 'ACT817_RULE', 'LUNAR_SOLAR_B', 'LUNAR_J_SLOW', 'LUNAR_K_MEAN_DAYS']],
	[microzodiac, ['schematicDateToLon']],
	[conjunctionEras, ['ELEMENT_ORDER']],
];

describe('卜卦 / 择日数据与引擎:死导出已删、在用导出照旧', ()=>{
	test('零引用导出不再存在', ()=>{
		const left = [];
		GONE.forEach(([mod, names])=>{
			names.forEach((n)=>{ if(n in mod){ left.push(n); } });
		});
		expect(left).toEqual([]);
	});

	test('同模块里在用的导出照旧', ()=>{
		expect(typeof egyptianData.greekDecan === 'function' || Array.isArray(egyptianData.EGYPT_DECANS)).toBe(true);
		expect(hellenisticData.PLANETARY_YEARS).toBeTruthy();
		expect(hellenisticData.DOMICILE).toBeTruthy();
		expect(hellenisticData.LOTS).toBeTruthy();
		expect(signFertility.FERTILE_SET).toEqual(['cancer', 'scorpio', 'pisces', 'taurus']);
		expect(signFertility.default.cancer).toBe('most_fertile');
		expect(typeof topicMaster.TOPIC_MASTER).toBe('object');
		expect(babylonianData.SAROS).toBeTruthy();
		expect(Array.isArray(houseMeanings.ANGULAR_HOUSES)).toBe(true);
		expect(directions.DIR_BY_ELEMENT.fire.dir).toBe('东');
		expect(directions.dirByMoonQuadrant(11)).toBe('东');
		expect(typeof engineUtils.scoreSelfDignity).toBe('function');
		expect(typeof units.sexParse).toBe('function');
		expect(units.cubitToDeg(1)).toBeCloseTo(2.2, 9);
		expect(units.signDegToLon(10, 17)).toBe(287);
		expect(typeof units.seToDeg).toBe('function');
		expect(typeof mathAstro.sarosPattern).toBe('function');
		expect(typeof microzodiac.lonToSchematicDate).toBe('function');
		expect(qizhengZeri.QIZHENG_CONDITION_TYPES).toBeTruthy();
	});

	test('模块私有死定义已删(世俗卜问 / 吠陀世俗 / 择日考量)', ()=>{
		expect(read('mundane/mundaneHorary.js')).not.toMatch(/^const SIGN_KEYS\b/m);
		expect(read('mundane/vedicMundane.js')).not.toMatch(/^const BENEFIC\b/m);
		const mod = read('election/modules.js');
		expect(mod).not.toMatch(/function termRulerEff\(/);
		expect(mod).not.toMatch(/function signKeyOfLon\(/);
	});

	test('整文件无人引用的数据件已删', ()=>{
		expect(fs.existsSync(path.join(DIV, 'data', 'midpoints.js'))).toBe(false);
		expect(fs.existsSync(path.join(DIV, 'data', 'shipParts.js'))).toBe(false);
	});
});
