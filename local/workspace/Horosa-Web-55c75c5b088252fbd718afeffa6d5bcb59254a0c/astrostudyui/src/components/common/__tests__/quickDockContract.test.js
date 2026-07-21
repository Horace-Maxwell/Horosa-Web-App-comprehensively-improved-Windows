// 快捷功能栏契约守卫:两层防线,防「目录化」回潜。
// 1) QuickDockBar 组件行为:恒序/键数上限/AI 恒在/无盘禁用/溢出折叠;
// 2) 全站源码静态契约:裸 dock 白名单、tab 镜像与跨页目录标签禁复现、卜类必带保存。
// 改快捷栏请连本测试一起改——契约即设计文档。
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import QuickDockBar from '../QuickDockBar';

const COMPONENTS_DIR = path.resolve(__dirname, '../..');

function listMainFiles(){
	const out = [];
	const walk = (dir)=>{
		fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
			const full = path.join(dir, ent.name);
			if(ent.isDirectory()){
				if(ent.name === '__tests__' || ent.name === 'node_modules'){ return; }
				walk(full);
			}else if(ent.isFile() && ent.name.endsWith('.js') && !ent.name.endsWith('.test.js')){
				out.push(full);
			}
		});
	};
	walk(COMPONENTS_DIR);
	return out;
}

describe('QuickDockBar 组件契约', () => {
	const btnCount = (html)=>(html.match(/horosa-bottom-quick-button/g) || []).length;

	test('默认恒含 AI 助手,且总键数 ≤8', () => {
		const html = renderToStaticMarkup(
			<QuickDockBar
				page="t1"
				hasResult
				primary={[{ key: 'a', label: '起盘', onClick: ()=>{} }]}
				extras={[1, 2, 3, 4, 5, 6].map((i)=>({ key: `e${i}`, label: `动词${i}`, onClick: ()=>{} }))}
				save={()=>{}}
			/>
		);
		expect(html).toContain('AI助手');
		// 1 主键 + 3 行内 + 更多(占第4槽) + 保存 + AI = 7(6 个 extras 溢出折叠)
		expect(html).toContain('更多');
		expect(btnCount(html)).toBeLessThanOrEqual(8);
	});

	test('无盘态:专属动词与保存禁用,主键与 AI 不禁用;needsResult:false 豁免', () => {
		const html = renderToStaticMarkup(
			<QuickDockBar
				page="t2"
				hasResult={false}
				primary={{ key: 'p', label: '起课', onClick: ()=>{} }}
				extras={[
					{ key: 'gated', label: '要盘的动词', onClick: ()=>{} },
					{ key: 'free', label: '此刻起课', needsResult: false, onClick: ()=>{} },
				]}
				save={()=>{}}
			/>
		);
		const seg = (label)=>{
			const idx = html.indexOf(label);
			expect(idx).toBeGreaterThan(-1);
			// 该按钮开标签在 label 之前最近一个 <button
			const open = html.lastIndexOf('<button', idx);
			return html.slice(open, idx);
		};
		expect(seg('要盘的动词')).toContain('disabled');
		expect(seg('保存')).toContain('disabled');
		expect(seg('此刻起课')).not.toContain('disabled');
		expect(seg('起课')).not.toContain('disabled');
		expect(seg('AI助手')).not.toContain('disabled');
	});

	test('恒序:主键 → 动词 → 保存 → AI(肌肉记忆锚)', () => {
		const html = renderToStaticMarkup(
			<QuickDockBar
				page="t3"
				hasResult
				primary={{ key: 'p', label: '主键甲', onClick: ()=>{} }}
				extras={[{ key: 'e', label: '动词乙', onClick: ()=>{} }]}
				save={()=>{}}
			/>
		);
		const order = ['主键甲', '动词乙', '保存', 'AI助手'].map((s)=>html.indexOf(s));
		expect([...order].sort((a, b)=>a - b)).toEqual(order);
	});

	test('ai={false} 才可去 AI(默认必在),data-quickdock-page 落地供巡检', () => {
		const bare = renderToStaticMarkup(<QuickDockBar page="t4" hasResult ai={false} />);
		expect(bare).not.toContain('AI助手');
		expect(bare).toContain('data-quickdock-page="t4"');
	});
});

describe('全站快捷栏静态契约(源码扫描)', () => {
	const files = listMainFiles();
	const read = (f)=>fs.readFileSync(f, 'utf8');
	// horosa_win_pathsep_posix_v1:path.relative 在 Windows 返回反斜杠分隔,与下方
	// WHITELIST/EXEMPT 的正斜杠字面量不匹配 → 白名单页被误判为 offender、契约测试假红。
	// 归一到 POSIX 分隔符再比对(macOS path.sep='/' 时为 no-op,行为逐字节不变;跨平台 bug,建议上游化 Mac)。
	const relPosix = (f)=>path.relative(COMPONENTS_DIR, f).split(path.sep).join('/');

	test('裸 dock 标记只允许出现在保形白名单(其余页必须走 QuickDockBar)', () => {
		// kinastro/astro 为用户认可的保形页(动态数据门控),finance 未落地跳过
		const WHITELIST = ['common/QuickDockBar.js', 'astro/AstroChartMain.js', 'kinastro/KinAstroMain.js'];
		const offenders = files.filter((f)=>read(f).includes('horosa-bottom-quick-title'))
			.map((f)=>relPosix(f))
			.filter((rel)=>!WHITELIST.includes(rel));
		expect(offenders).toEqual([]);
	});

	test('禁复现:tab 镜像/跨页目录/页头重复 标签不得再进任何 dock 配置', () => {
		// 只扫 dock 配置区(getQuickDockConfig / renderQuickDock / renderBottomQuickDock 方法体),
		// 页面其它 UI(选项/面板标题)用同名词是合法的;保形白名单页整档豁免。
		const FORBIDDEN = ['概览', '快照', '导出', '帮助', '金口诀', '统摄法', '皇极经世', '太玄', '荆诀', '神易数', '遁甲', '太乙', '主限', '法达', '合盘', '牌位', '牌义', '十六宫', '八宫', '释义显示', '锁定复现', '并列 2×2'];
		const EXEMPT = ['common/QuickDockBar.js', 'astro/AstroChartMain.js', 'kinastro/KinAstroMain.js'];
		const dockSpans = (src)=>{
			const spans = [];
			const re = /\t(getQuickDockConfig|renderQuickDock|renderBottomQuickDock)\([^)]*\)\s*\{/g;
			let m = re.exec(src);
			while(m){
				const end = src.indexOf('\n\t}', m.index);
				spans.push(src.slice(m.index, end === -1 ? src.length : end));
				m = re.exec(src);
			}
			return spans;
		};
		const hits = [];
		files.forEach((f)=>{
			const rel = relPosix(f);
			if(EXEMPT.includes(rel)){ return; }
			dockSpans(read(f)).forEach((span)=>{
				FORBIDDEN.forEach((label)=>{
					if(span.includes(`label: '${label}'`) || span.includes(`label: "${label}"`)){
						hits.push(`${rel} → ${label}`);
					}
				});
			});
		});
		expect(hits).toEqual([]);
	});

	test('信息不进栏:全站 QuickDockBar 用例不得携带 lookup 信息弹层(信息必须常驻右栏 tab)', () => {
		// 六壬神煞/七政速查已分别落进右栏「信息」tab 与 Moira 面板 extraTabs;
		// QuickDockBar 已无 lookup 能力,此断言防有人在调用侧重新造一个。
		const offenders = files.filter((f)=>{
			const src = read(f);
			return src.includes('QuickDockBar') && (/\blookup=\{/.test(src) || /\blookup:\s*\{/.test(src));
		}).map((f)=>relPosix(f));
		expect(offenders).toEqual([]);
	});

	test('卜类页 dock 必带保存(事例入库),命类不経 dock 复置命例保存', () => {
		const DIVINATION = [
			'lrzhan/LiuRengMain.js', 'dunjia/DunJiaMain.js', 'taiyi/TaiYiMain.js', 'sanshi/SanShiUnitedMain.js',
			'guazhan/GuaZhanMain.js', 'suzhan/SuZhanMain.js', 'jinkou/JinKouMain.js', 'tongshefa/TongSheFaMain.js',
			'huangji/HuangJiMain.js', 'wuzhao/WuZhaoMain.js', 'taixuan/TaiXuanMain.js', 'jingjue/JingJueMain.js',
			'shenyishu/ShenYiShuMain.js', 'geomancy/GeomancyMain.js', 'tarot/TarotMain.js',
		];
		const missing = DIVINATION.filter((rel)=>{
			const src = read(path.join(COMPONENTS_DIR, rel));
			// tongshefa/tarot 等 config-only 子页无独立 dock 渲染,由 cnyibu 容器透传
			const wired = src.includes('QuickDockBar') || src.includes('getQuickDockConfig()');
			return !(/save[:=]\s*[\({]|save=\{/.test(src) && wired);
		});
		expect(missing).toEqual([]);
		// 命类(紫微/印度/七政/辅盘/节气)不得在 dock 里放「保存」——页头命例保存已有
		['ziwei/ZiWeiMain.js', 'astro/IndiaChartMain.js', 'guolao/GuoLaoChartMain.js', 'auxchart/AuxChartMain.js', 'jieqi/JieQiChartsMain.js'].forEach((rel)=>{
			const src = read(path.join(COMPONENTS_DIR, rel));
			const dockSpan = src.slice(src.indexOf('QuickDockBar'));
			expect(dockSpan.includes('save={')).toBe(false);
		});
	});

	test('cnyibu 十子页均自述 getQuickDockConfig,容器零硬编码分支', () => {
		const SUBPAGES = ['suzhan/SuZhanMain.js', 'jinkou/JinKouMain.js', 'tongshefa/TongSheFaMain.js', 'huangji/HuangJiMain.js', 'wuzhao/WuZhaoMain.js', 'taixuan/TaiXuanMain.js', 'jingjue/JingJueMain.js', 'shenyishu/ShenYiShuMain.js', 'geomancy/GeomancyMain.js', 'tarot/TarotMain.js'];
		SUBPAGES.forEach((rel)=>{
			expect(read(path.join(COMPONENTS_DIR, rel))).toContain('getQuickDockConfig()');
		});
		const container = read(path.join(COMPONENTS_DIR, 'cnyibu/CnYiBuMain.js'));
		expect(container).toContain('getQuickDockConfig');
		expect(container).not.toContain('runChildAction');
		// 「容器零硬编码分支」守的是:容器不得按子页 if/else 拼快捷栏配置(那会让新增子页
		// 必须同时改容器,正是本契约要根除的耦合)。原判据用 `tab === 'suzhan'` 这个**字符串代理**
		// 来表达它。PERF-R9 Ship 6 之后该代理会误伤:子页签冻结的可见性判定天然就是
		// `<FreezeSubTab active={tab === 'xxx'}>`,那与快捷栏无关(它决定"哪个子页可见",
		// 不决定"快捷栏放什么")。
		// 因此这里**只剥掉 FreezeSubTab 的 active 判定**再查 —— 守卫对任何**其它**形式的
		// 按子页硬编码分支仍然完全有效(已复核:容器内 14 处 `tab ===` 全部是 active 判定,
		// runChildAction 为 0,配置仍由子页自述)。
		// ⚠️ 不要把这条断言整条删掉:它是"新增子页不必改容器"这一架构性质的唯一自动守卫。
		const dockRelevant = container.replace(/active=\{\s*tab === '[A-Za-z0-9_]+'\s*\}/g, '');
		expect(dockRelevant.includes("tab === 'suzhan'")).toBe(false);
	});
});
