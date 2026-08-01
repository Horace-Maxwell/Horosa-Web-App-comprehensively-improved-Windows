package spacex.basecomm.constants;

/**
 * 主限法(PD)线协议代次 —— Java 侧唯一真值源。
 *
 * 语义:该串被各控制器放进 params(随 keyparams 进 ParamHashCache 缓存键),
 * 作用是「PD 行为一变,旧缓存整体失效」。四端 lockstep:
 *   前端 primaryDirectionSync.PD_SYNC_REV / Python helper.PD_SYNC_REV /
 *   webchartsrv.PD_SYNC_REV / Java 本常量 —— 必须同值。
 *
 * 🔴 历史事故(两次同型):各控制器手抄字面量,v13→v15 三次行为升级只改了
 * PredictiveController,主盘/印占/Query 仍以 v12(甚至 v8)作盐 → 旧缓存
 * 继续命中,用户拿到旧 PD 子结果。根修 = 全部引用本常量,preflight [176]⑤
 * 禁止 pd_method_sync_ 字面量出现在本文件之外的 Java 源里。
 */
public final class PdWire {
	public static final String REV = "pd_method_sync_v15";

	private PdWire() {
	}
}
