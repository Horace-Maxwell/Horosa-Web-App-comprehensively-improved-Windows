// 界面文字白话化守卫:不露内部键名 / 英文字段名 / 开发用语 / 繁体残字 / 写死计数;每条锁住一处已修的界面文字,
// 防回退。行为可测的(流派名单源、旧段名迁移)另做行为断言。
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const R = (f) => readSource(path.resolve(__dirname, '../../', f));

describe('界面文字白话化', () => {
	test('主限法:「当前状态」显示度数换算中文名;空态提示指向真实入口;日期筛选提示「输入年份」', () => {
		const chart = R('components/astro/AstroPrimaryDirectionChart.js');
		expect(chart).toContain('当前盘面度数换算：{PD_TIME_KEY_LABELS[selectedPdTimeKey] || selectedPdTimeKey}');
		expect(chart).toContain('{PD_TIME_KEY_LABELS[applied.pdTimeKey] || applied.pdTimeKey}');
		const { PD_TIME_KEY_LABELS } = require('../primaryDirectionSync');
		expect(PD_TIME_KEY_LABELS.TrueSolarArc).toBe('真太阳弧');
		expect(PD_TIME_KEY_LABELS.User).toMatch(/^自定义/);
		const table = R('components/astro/AstroPrimaryDirection.js');
		expect(table).not.toContain('允星');
		expect(table).not.toContain('放宽工具栏的「相位」筛选');
		expect(table).toContain('在工具栏「扩展」里多勾几类应星 / 迫星');
		expect(table).toContain('点表头「迫星」等列的筛选漏斗');
		expect(table).not.toContain('输入年数');
		expect(table).toContain('placeholder={`输入年份`}');
	});
	test('紫微四化流派名单源:三式与紫微页显示中文名,不露 beipai', () => {
		const ZW = require('../../constants/ZWConst');
		expect(ZW.zwSihuaSchoolLabel('beipai')).toBe('通用·飞星');
		expect(ZW.zwSihuaSchoolLabel('zhongzhou')).toBe('中州派');
		expect(ZW.zwSihuaSchoolLabel('nope')).toBe('通用·飞星');
		const sanshi = R('components/sanshi/SanShiZiWeiSihua.js');
		expect(sanshi.match(/zwSihuaSchoolLabel\(/g).length).toBe(2);
		expect(sanshi).not.toMatch(/流派（\$?\{ZWConst\.ZWSchool \? ZWConst\.ZWSchool\.school : 'beipai'\}）/);
		expect(R('components/ziwei/ZiWeiMain.js')).toContain('ZWConst.zwSihuaSchoolLabel(ZWConst.ZWSchool.school)');
	});
	test('七政 / 策天 / 占星:不露内部用语与第三方软件名', () => {
		const guolao = R('components/guolao/GuoLaoChartMain.js');
		expect(guolao).not.toContain('Moira 阈值');
		expect(guolao).toContain('显示格局档位 ≥ {meta.displayLevel}');
		expect(R('components/kinastro/KinAstroMain.js')).not.toContain('>sxtwl(修正)<');
		expect(R('components/astro/ChartDisplaySelector.js')).not.toMatch(/cell\('[^']*isVOC/);
		expect(R('utils/classicalParamSpec.js')).not.toContain('isVOC 全盘随动');
		expect(R('components/astro/AstroEgypt.js')).not.toContain('后端返回古典字段');
	});
	test('玄学史:不露英文字段名;空态用左栏实名', () => {
		expect(R('components/xuanshi/XuanShiMap.js')).not.toContain('region/place');
		const desk = R('components/xuanshi/XuanShiDesk.js');
		expect(desk).toContain("this.nav('figures')}>人物列传</span>");
		expect(desk).toContain("this.nav('stories')}>故事专题</span>");
	});
	test('名人库:卡片计数中文 / 人数取库内计数 / 表单控件上方向键不翻页', () => {
		const html = R('../public/astrodata/index.html');
		expect(html).not.toContain(' rel · ');
		expect(html).not.toContain('59199');
		expect(html).not.toContain('59,199');
		expect(html).toContain("cnt:(a,b)=>`亲属 ${a} · 事件 ${b}`");
		expect(html).toContain("PERSONS=g('persons')||0;");
		expect(html).toContain('/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)||a.isContentEditable');
		expect(html).toContain("!$('drawer').classList.contains('on')&&!inFormControl()");
	});
	test('量化盘:太阳弧速率两处同名同序;中点页下拉有标签', () => {
		const dial = R('components/germany/UranianDialMain.js');
		expect(dial).toContain("options={[{ value: 'naibod', label: '均日弧' }, { value: 'cardan', label: '59′12″' }, { value: 'oneDeg', label: '1°/年' }]}");
		const ge = R('components/germany/UranianGraphicEphemeris.js');
		expect(ge.indexOf('>均日弧<')).toBeLessThan(ge.indexOf('>59′12″<'));
		expect(ge.indexOf('>59′12″<')).toBeLessThan(ge.indexOf('>1°/年<'));
		expect(dial).toContain("(this.state.saKey === 'cardan' ? '59′12″' : '均日弧')");
		expect(R('components/germany/UranianRectify.js')).toContain("({ oneDeg: '1°/年', cardan: '59′12″', naibod: '均日弧' })");
		const snap = R('components/germany/AstroMidpoint.js');   // AI 快照里的速率名与界面同名
		expect(snap).not.toMatch(/'Naibod|'Cardan|cardan: 'Cardan'/);
		expect(snap).toContain("cardan: '59′12″', naibod: '均日弧'");
		const mount = R('utils/techniqueMountSettings.js');      // 挂载齿轮与页面同名
		expect(mount).not.toContain('isVOC');
		expect(mount).not.toContain("label: 'sxtwl（修正）'");
		expect(mount).toContain("{ value: 'sxtwl', label: '天文历算(修正)' }");
		const mp = R('components/germany/MidpointMain.js');
		['黄道', '南天星座', '分宫制'].forEach((t) => { expect(mp).toContain(`<div style={MP_FIELD_LABEL}>${t}</div>`); });
	});
	test('太乙:盘式 / 古法公式下拉显示简体,值不变;三式同一项同名', () => {
		const { TAIYI_STYLE_OPTIONS, TAIYI_ACCUM_OPTIONS } = require('../../components/taiyi/core/TaiYiCore');
		expect(TAIYI_STYLE_OPTIONS).toEqual([
			{ value: 3, label: '时计太乙' }, { value: 0, label: '年计太乙' }, { value: 1, label: '月计太乙' },
			{ value: 2, label: '日计太乙' }, { value: 4, label: '分计太乙' },
		]);
		expect(TAIYI_ACCUM_OPTIONS.map((o) => o.value)).toEqual([0, 1, 2, 3]);
		expect(TAIYI_ACCUM_OPTIONS.map((o) => o.label)).toEqual(['太乙统宗', '太乙金镜', '太乙淘金歌', '太乙局']);
		const sanshi = R('components/sanshi/SanShiUnitedMain.js');
		expect(sanshi).not.toContain('<div>积年法：');
		expect(sanshi).toContain('<div>古法公式：{tpan.options');
	});
	test('风水:成员 / 定义用简体;旧段名「成員卦象」迁到新名;提示文字与实际选项一致', () => {
		['components/fengshui/FengShuiMain.js', 'components/fengshui/fengshuiEngine.js', 'components/fengshui/baguaData.js', 'components/fengshui/baguaCore.js'].forEach((f) => {
			expect([f, /成員|定義/.test(R(f))]).toEqual([f, false]);
		});
		const main = R('components/fengshui/FengShuiMain.js');
		expect(main).not.toContain('傻瓜式三步');
		expect(main).toContain('选「自定义点」后按住 Shift');
		const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');
		expect(AI_EXPORT_PRESET_SECTIONS.fengshui).toContain('成员卦象');
		expect(AI_EXPORT_PRESET_SECTIONS.fengshui).not.toContain('成員卦象');
		// 行为断言:自定义里勾过旧名 → 生效段是新名(设置读出与缓存快照过滤两侧见 aiExportLegacySectionName.test.js)
		const { getAIExportEffectiveSectionsForTechnique } = require('../aiExport');
		const eff = getAIExportEffectiveSectionsForTechnique('fengshui', { sections: { fengshui: ['成員卦象'] } });
		expect(eff).toContain('成员卦象');
		expect(eff).not.toContain('成員卦象');
	});
	test('皇极轨策左栏副标题不再提已移除的十应;导航「辅助」不再搜得到不存在的真太阳时工具', () => {
		expect(R('components/guice/GuiceMain.js')).toContain('<div className="horosa-side-panel-subtitle">起卦法 · 流派</div>');
		expect(R('pages/index.js')).not.toContain("keywords: '辅助 工具 真太阳时");
	});
});
