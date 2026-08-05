/**
 * 三式连续进退流畅度四资产金标(源锚型——实测病史,拆一条即回卡):
 * ① 丢击根治(horosa_sanshi_no_drop_step_v1):loading 期间 clickPlot 不再 return 丢弃,
 *    队列标记+trailing 静默期补发(latest-wins)。旧病=时间控件步进了、盘不跟算。
 * ② 不等 /chart 回流(horosa_sanshi_no_wait_chart_v1):撤 1200ms 兜底 timer,立即 refreshAll;
 *    回流校正由 recalcSignature(含 isDiurnal/outerChartKey)签名去重天然兜住。
 * ③ 快照构建 idle 化(horosa_sanshi_snapshot_idle_v1):~950ms 同步大构建不再插在
 *    「上一步落地→下一步 recalc timer」之间顶住下一步。
 * ④ 三 pan 步进预取(horosa_sanshi_step_prefetch_v1):registerStepPrefetcher 登记+unmount
 *    反注册配对;nongli'→kinqimen 盘'+太乙盘' 经 kentangCache 收口(实测连击零网络)。
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');

describe('sanshiStepFluency(连续进退四资产)', () => {
	it('① 丢击根治:loading 分支记队列+时刻,resolve 侧 trailing 静默期补发', () => {
		expect(SRC).toContain('horosa_sanshi_no_drop_step_v1');
		expect(SRC).toContain('this.queuedPlotWhileLoading = true;');
		expect(SRC).toContain('this.lastQueuedPlotAt =');
		// trailing 静默期:距最后一击 <180ms 推迟再查(连点期间不起中间轮)
		expect(SRC).toMatch(/nowTs - this\.lastQueuedPlotAt < 180/);
		// 补发走 clickPlot(latest-wins 用最新 pendingTimeFields)
		expect(SRC).toMatch(/this\.queuedPlotWhileLoading = false;\s*\n\s*this\.clickPlot\(\);/);
	});

	it('② 不等 /chart 回流:1200ms 兜底已撤,立即 refreshAll;didUpdate 校正链保留', () => {
		expect(SRC).toContain('horosa_sanshi_no_wait_chart_v1');
		expect(SRC).not.toMatch(/awaitingSyncTimer = setTimeout\([\s\S]{0,200}?\}, 1200\)/);
		// didUpdate 回流校正仍在。
		// 🔴 本断言原写作 `awaitingChartSync && hasPlotted && chartChanged` —— 那个形态后被证明
		// **锁死了一个 bug**:实时传导路径下 awaitingChartSync 恒为 false(onTimeChanged 先
		// syncFields 写入 state.fields ⇒ clickPlot 里 patchFields 比出「相等」⇒ needChartSync=false
		// ⇒ 闸门根本没置起),于是 /chart 回流时校正整个被跳过,外圈星度冻在起盘那一刻
		// (用户实测三轮才定位)。故断言更新为去掉该前置条件后的正确形态,并加反向锚防回潮。
		// 详见 outerRingFollowsTime.test.js 与 preflight[196]。
		expect(SRC).toMatch(/if\(this\.state\.hasPlotted && chartChanged\)\{/);
		expect(SRC).not.toMatch(/this\.awaitingChartSync && this\.state\.hasPlotted && chartChanged/);
	});

	it('③ 快照构建 idle 化:requestIdleCallback+timeout 兜底+双通道 cancel', () => {
		expect(SRC).toContain('horosa_sanshi_snapshot_idle_v1');
		expect(SRC).toMatch(/requestIdleCallback\(buildAndSave, \{ timeout: 4000 \}\)/);
		expect(SRC).toMatch(/cancelIdleCallback\(this\.pendingSnapshotIdle\)/);
	});

	it('④ 三 pan 步进预取:登记/反注册配对+链式三段', () => {
		expect(SRC).toContain('horosa_sanshi_step_prefetch_v1');
		expect(SRC).toContain("registerStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher)");
		expect(SRC).toContain("unregisterStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher)");
		expect(SRC).toContain("name: 'sanshi:stage1'");
		expect(SRC).toContain("path: '/nongli/time'");
		// 预取链含 kinqimen 盘与太乙盘两段(kentangCache 收口)
		expect(SRC).toMatch(/jobs\.push\(fetchQimenPan\(steppedFields, nongli, qimenOptions/);
		expect(SRC).toMatch(/jobs\.push\(this\.getKintaiyiPan\(steppedFields, nongli/);
	});

	it('⑤ 全屏蒙层已撤:Spin 包装不在,中栏小徽标在', () => {
		expect(SRC).not.toMatch(/<Spin spinning=\{this\.state\.loading\}>/);
		expect(SRC).toContain('horosa-workspace-updating horosa-sanshi-updating');
	});
});
