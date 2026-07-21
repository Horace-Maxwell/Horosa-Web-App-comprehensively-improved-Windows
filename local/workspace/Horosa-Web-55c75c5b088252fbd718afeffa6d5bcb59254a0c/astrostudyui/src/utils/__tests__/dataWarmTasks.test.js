// horosa_data_warm_registry_v1 —— 排盘后数据层预热【注册表】哨兵(PERF-R9 Ship 7)。
//
// ⚠️ 本文件是 **Windows overlay 的原创新文件**(Mac 基线里不存在),走全量拷贝层
//    `files/astrostudyui/src/utils/__tests__/dataWarmTasks.test.js`,不是 patches/。
//
// 病根:清单原本写死在 pages/index.js 的一个 4 条数组里 —— 页面组件持有技法知识,漏项
// 没人发现(紫微 /ziwei/birth 首点概率最高却整轮不在组里)。改注册表后,这里钉两件事:
//   ① 登记序 = 首点概率序 = 执行序(轻端点在前,唯一的重端点 /jieqi/year 垫底);
//   ② 本轮补入的四条(紫微/遁甲/太乙/分至)真的在册 —— 防「只写了 warm 函数没登记」。
import { buildDataWarmTasks } from '../dataWarmTasks';
import { __dataWarmRegistryKeys } from '../idleWarmQueue';

describe('dataWarmTasks 注册表', () => {
	test('登记序 = 执行序:轻端点在前,重端点 /jieqi/year 垫底', () => {
		expect(__dataWarmRegistryKeys()).toEqual([
			'direction:pd',
			'india:birth',
			'ziwei:birth',
			'guolao:natal',
			'germany:midpoint',
			'dunjia:stage1',
			'taiyi:stage1',
			'jieqi:year',
		]);
	});

	test('🔴 本轮补入的四条在册(此前是漏项)', () => {
		const keys = __dataWarmRegistryKeys();
		['ziwei:birth', 'dunjia:stage1', 'taiyi:stage1', 'jieqi:year'].forEach((k) => {
			expect(keys).toContain(k);
		});
	});

	test('buildDataWarmTasks 铺出的任务与登记一一对应,且 task 可调用', () => {
		const tasks = buildDataWarmTasks({}, null);
		expect(tasks.map((t) => t.name)).toEqual(__dataWarmRegistryKeys());
		tasks.forEach((t) => {
			expect(typeof t.task).toBe('function');
		});
	});
});
