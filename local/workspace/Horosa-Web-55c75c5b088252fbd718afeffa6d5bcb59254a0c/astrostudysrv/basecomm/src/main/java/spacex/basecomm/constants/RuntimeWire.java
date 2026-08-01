package spacex.basecomm.constants;

/**
 * 运行时(Python payload)版本闸 —— Java 侧唯一真值源。
 *
 * 语义:各控制器把它放进 params(随 keyparams 进 ParamHashCache 缓存键),
 * 使「runtime payload 换版但请求参数不变」的旧持久化缓存自动失效。
 * 必须与 Horosa_Desktop_Installer/config/release_config.json 的 runtimeVersion
 * 保持 lockstep(preflight [65]② 比对本文件字面量;升级 runtime 时同步改这里)。
 *
 * 🔴 为什么单独立类:曾是 ChartController 私有常量,/predict/pd 链(PredictiveController)
 * 没有这道盐 → runtime 升级后 PD 持久化缓存继续命中旧结果。与 PdWire 同一根修范式:
 * 缓存盐一律 basecomm 单源,控制器只引用不手抄。
 */
public final class RuntimeWire {
	public static final String RUNTIME_VERSION = "3.6.1-runtime1";

	private RuntimeWire() {
	}
}
