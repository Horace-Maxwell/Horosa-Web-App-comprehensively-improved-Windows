// [挂载自检 F-57] 太乙「博弈分析=开启」而后端(随包运行时缺 scipy)未算 → 标签/快照如实写「本次未算」;算了/关闭时逐字不变。
import { normalizeBackendPan, buildTaiyiSnapshotText } from '../TaiYiCalc';

const BASE = { style: 3, tn: 0, tnForPan: 0, sex: '男', dateStr: '2026-05-15', timeStr: '10:12', palace16: [], ganzhi: { year: '丙午', month: '癸巳', day: '己丑', time: '己巳' } };
const lineOf = (txt)=>`${txt}`.split('\n').find((l)=>l.indexOf('博弈分析：') === 0) || '';

describe('太乙博弈分析降级标注', ()=>{
	it('🔴 gameTheoryUnavailable=scipy + 开启 → 「开启（运行时缺 scipy，本次未算）」', ()=>{
		const pan = normalizeBackendPan({ ...BASE, gameTheoryUnavailable: 'scipy' }, { gameTheory: 1 }, null, null);
		expect(pan.options.gameTheoryLabel).toBe('开启（运行时缺 scipy，本次未算）');
		expect(lineOf(buildTaiyiSnapshotText(pan))).toBe('博弈分析：开启（运行时缺 scipy，本次未算）');
	});
	it('算了 → 「开启」;关闭 → 「关闭」(零回归)', ()=>{
		expect(normalizeBackendPan({ ...BASE }, { gameTheory: 1 }, null, null).options.gameTheoryLabel).toBe('开启');
		expect(normalizeBackendPan({ ...BASE, gameTheoryUnavailable: 'scipy' }, { gameTheory: 0 }, null, null).options.gameTheoryLabel).toBe('关闭');
	});
});
