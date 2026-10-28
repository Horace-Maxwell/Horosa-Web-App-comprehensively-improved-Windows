// 合同:南极神数「推演」诸项,新开页面的初值 = AI 挂载齿轮的缺省(同一口径)。
// 齿轮里这几项的缺省是空 = 交给后端按本盘自出(宫部 = 本命宫部、推演宫 = 宫部首支、建除「建」、宿「角」);
// 页面若写死某一支(如「子」),同一张盘页面与挂载快照的推演宫就不是同一个。
// 另核:页面推演宫下拉的「自出」档与齿轮同值同名,其余十二支同序。
import KinAstroMain, { NANJI_PALACE_OPTIONS } from '../KinAstroMain';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';

const mountField = (name)=>{
	const f = getTechniqueSettingsSchema('nanji').fields.find((x)=>x.name === name);
	if(!f){ throw new Error(`南极齿轮里没有字段 ${name}`); }
	return f;
};
// 齿轮缺省为「由盘推出 / 后端缺省」的推演项
const DERIVED_KEYS = ['nanjiSection', 'nanjiJianchu', 'nanjiXiu', 'nanjiPalace'];

test('新开南极页的推演项初值 = 挂载齿轮缺省', ()=>{
	const page = new KinAstroMain({ technique: 'nanji' });
	const diff = DERIVED_KEYS.filter((k)=>page.state[k] !== mountField(k).default).map((k)=>`${k}: 页面 ${JSON.stringify(page.state[k])} ≠ 齿轮 ${JSON.stringify(mountField(k).default)}`);
	expect(diff).toEqual([]);
});

test('推演宫下拉:「自出」档与齿轮同值同名,其余为十二支同序', ()=>{
	const mount = mountField('nanjiPalace').options;
	expect(NANJI_PALACE_OPTIONS.map((o)=>o.value)).toEqual(mount.map((o)=>o.value));
	expect(NANJI_PALACE_OPTIONS[0]).toEqual({ value: '', label: mount[0].label });
	expect(NANJI_PALACE_OPTIONS.map((o)=>o.value)).toContain(new KinAstroMain({ technique: 'nanji' }).state.nanjiPalace);
});
