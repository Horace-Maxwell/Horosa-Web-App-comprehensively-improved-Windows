// chartFree 契约哨兵 —— 守「声明了快车道的页,悄悄开始读 chartObj」这一类静默病。
//
// 🔴 快车道的安全前提:声明 chartFree 的组件【零】消费共享 chartObj —— fetchByFields
//    对这些页 fields 先行提交、doHook 喂的是【旧】chartObj。若某组件日后开始读
//    props.value/chartObj 而没撤声明,它会拿旧盘渲染(陈旧数据,比慢更糟)。
//    此哨兵机械 grep 源文件,漂移即红。
import fs from 'fs';
import path from 'path';
import { CHART_FREE_DECLARED } from '../techniqueChartFree';

const SRC_ROOT = path.join(__dirname, '..', '..');

describe('🔴 chartFree 契约:声明者源码零 chartObj 消费', () => {
	const entries = Object.keys(CHART_FREE_DECLARED);

	test('期望表非空且文件都在', () => {
		expect(entries.length).toBeGreaterThanOrEqual(3);
		entries.forEach((rel) => {
			expect(fs.existsSync(path.join(SRC_ROOT, rel))).toBe(true);
		});
	});

	// 判据须【剥注释】再查 —— 声明处的契约注释本身就写着「chartObj/props.value」字样,
	// 不剥则哨兵被自己的说明文字触发(首跑即栽,注错还没做就红了)。
	const stripComments = (src) => src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

	test.each(entries)('%s:已声明 chartFree 且零 props.value/chartObj 读取', (rel) => {
		const raw = fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');
		// ① 声明真的在(只登记不声明=无效)
		expect(raw).toMatch(/\.hook\.chartFree = true/);
		// ② 零消费(剥注释后):不读 props.value(fields 字段容器上的 .value 合法,
		//    只拦「组件 props 的 value(=chartObj)」)、不出现 chartObj 标识符
		const code = stripComments(raw);
		expect(code).not.toMatch(/this\.props\.value\b/);
		expect(code).not.toMatch(/\bprops\.value\b/);
		expect(code).not.toMatch(/\bchartObj\b/);
	});

	test('声明与期望表一一对应(只声明不登记=此处红,防野声明)', () => {
		// 全仓扫「.hook.chartFree = true」,每一处都必须登记在期望表
		const found = [];
		const walk = (dir) => {
			fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
				if(e.name === '__tests__' || e.name === 'node_modules') return;
				const fp = path.join(dir, e.name);
				if(e.isDirectory()){ walk(fp); return; }
				if(!e.name.endsWith('.js')) return;
				const src = fs.readFileSync(fp, 'utf8');
				if(/\.hook\.chartFree = true/.test(src)){
					// horosa_win_pathsep_posix_v1:path.relative 在 Windows 返回反斜杠分隔,与期望表(POSIX 分隔)
					// 比对必失配;归一到 POSIX 分隔符再比(macOS path.sep='/' 时 no-op,逐字节不变;跨平台 bug,建议上游化 Mac)。
					found.push(path.relative(SRC_ROOT, fp).split(path.sep).join('/'));
				}
			});
		};
		walk(path.join(SRC_ROOT, 'components'));
		expect(found.sort()).toEqual(entries.sort());
	});
});
