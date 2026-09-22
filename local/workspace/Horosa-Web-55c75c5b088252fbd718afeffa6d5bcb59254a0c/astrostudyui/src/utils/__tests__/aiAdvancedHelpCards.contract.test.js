// 应用内手册「进阶」页签 ≡ 进阶页六卡(导轨常量 ADV_SECTIONS 单源);手册里写的数字必须来自常量插值,旧假话不得回潮。
const fs = require('fs');
const path = require('path');
import { ADV_SECTIONS } from '../../components/aianalysis/chat/AdvancedPane';
import { ADV_SECTION_IDS } from '../../components/aianalysis/chat/AdvCard';
import { SKILL_MAX_TEMPLATE } from '../aiChat/skillLimits';
import { DEFAULT_STREAM_STALL_MS, DEFAULT_STREAM_MAX_MS } from '../aiStreamLimits';

const HELP = path.resolve(__dirname, '..', '..', 'components', 'help', 'AIAnalysisHelpDoc.js');
const src = ()=>fs.readFileSync(HELP, 'utf8');

it('🔴 进阶页六卡标签逐一出现在手册「进阶」页签;六卡 id 与分区锚顶层六键恒等', ()=>{
	const s = src();
	expect(ADV_SECTIONS.length).toBe(6);
	expect(ADV_SECTIONS.map((x)=>x.id)).toEqual([ADV_SECTION_IDS.context, ADV_SECTION_IDS.bestof, ADV_SECTION_IDS.routes, ADV_SECTION_IDS.persona, ADV_SECTION_IDS.skills, ADV_SECTION_IDS.agent]);
	const tab = s.slice(s.indexOf('<TabPane tab="进阶"'), s.indexOf('</TabPane>', s.indexOf('<TabPane tab="进阶"')));
	expect(tab.length).toBeGreaterThan(500);
	ADV_SECTIONS.forEach((x)=>expect(tab).toContain(x.label));
});

it('🔴 手册数字走常量插值:看门狗两值 / 技能模板上限;五句旧假话零回潮', ()=>{
	const s = src();
	expect(s).toContain('${DEFAULT_STREAM_STALL_MS / 1000} 秒');
	expect(s).toContain('${Math.round(DEFAULT_STREAM_MAX_MS / 60000)} 分钟');
	expect(s).toContain('${SKILL_MAX_TEMPLATE} 字按上限截断');
	expect(DEFAULT_STREAM_STALL_MS).toBe(180000);
	expect(DEFAULT_STREAM_MAX_MS).toBe(1800000);
	expect(SKILL_MAX_TEMPLATE).toBeGreaterThan(0);
	['自动转正', '完全一样', '90 秒内', '最多 5 分钟', '超长或触发词冲突会被拒绝', '所有写入只增不删、可一键撤销'].forEach((lie)=>expect(s).not.toContain(lie));
	expect(s).toContain('须你确认才入库');
	expect(s).toContain('除上下文策略缺省按模型窗口裁历史');
});
