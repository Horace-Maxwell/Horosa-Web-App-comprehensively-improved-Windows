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
	public static final String REV = "pd_method_sync_v26";

	/**
	 * 主限法设置项登记表的键(与前端 primaryDirectionSync.PD_EXTRA_SETTING_KEYS、Python perchart 同名):
	 * 几何口径 / 相位侧 / 传统逆向 / 忽略应星黄纬 / 忽略迫星黄纬 / 月亮视差 / 真位置 / 真太阳弧逆向用出生前太阳 / 日期年长 / 相位点黄纬。
	 * 各控制器透传 / 回显都循环本表,不再逐键手抄;前端只发非缺省值 → 缺省请求体与缓存键不变。
	 */
	public static final String[] SETTING_KEYS = new String[] {
		"pdGeometry", "pdAspectSide", "pdTradConverse", "pdIgnoreSigLat", "pdIgnorePromLat", "pdLunarParallax", "pdTruePosition",
		"pdSolarArcRegressive", "pdYearDays", "pdPromAspectLat",
	};

	private PdWire() {
	}
}
