package spacex.astrostudy.controller;

import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 本地后端身份握手端点。
 *
 * 前端在采用任何本地服务地址(query / 存储 / 端口推导)之前,先 GET 本端点核验:
 * app 标记必须为 horosa-backend,且(页面无期望 nonce 或 nonce 一致)才视为真后端;
 * 否则一律拒绝——防止端口被其它进程占用时把「陌生 200 响应」误当后端(会表现为
 * 排盘失败但 statusCode:200)。
 *
 * 设计约束:
 * - 明文 JSON、无鉴权、不走 TransData 信封:身份核验发生在协议/加密协商之前;
 * - 直写 HttpServletResponse 并 flush,绕开统一响应改写,保证任何环境下格式稳定;
 * - 仅回环可达(server.address=127.0.0.1),不含任何敏感信息;
 * - nonce 来自壳注入的 HOROSA_LAUNCH_NONCE(每次启动会话一枚),浏览器直连开发场景无
 *   nonce 时字段为空串,前端只校验 app 标记。
 */
@Controller
public class HorosaIdentityController {

	@RequestMapping(value = "/horosaIdentity", method = RequestMethod.GET)
	public void execute(HttpServletResponse response,
			@RequestParam(value = "deep", required = false) String deep) throws Exception {
		String nonce = System.getenv("HOROSA_LAUNCH_NONCE");
		if (nonce == null) {
			nonce = "";
		}
		// deep=1:附带一次微型真算结果——看门狗借此区分「身份线程活着」与
		// 「计算还能跑」(软 OOM/线程池 wedge 时前者恒真、后者已死)。proto 升 2 表示
		// 本端点支持 deep 维度(旧壳不发 deep 参数,响应对其向后兼容)。
		String deepField = "";
		if (deep != null && !deep.isEmpty()) {
			deepField = ",\"deep\":\"" + (runDeepProbe() ? "ok" : "fail") + "\"";
		}
		// 手写 JSON:nonce 白名单过滤为 [A-Za-z0-9_-],无注入面。
		String body = "{\"app\":\"horosa-backend\",\"proto\":2,\"nonce\":\""
				+ nonce.replaceAll("[^A-Za-z0-9_-]", "") + "\"" + deepField + "}";
		response.setStatus(200);
		response.setContentType("application/json;charset=UTF-8");
		response.setHeader("Cache-Control", "no-store");
		response.getWriter().write(body);
		response.getWriter().flush();
	}

	/**
	 * 微型真算:儒略日往返(纯算术,零依赖零 I/O)+ 一次 64KB 短命分配——
	 * 验证「还能算、还能分配」。软 OOM 下分配即抛 → fail;任何 Throwable 都收敛为
	 * fail(探针绝不把服务打崩)。HOROSA_IDENTITY_DEEP_FAIL=1 为 dev 注错钩。
	 */
	private boolean runDeepProbe() {
		try {
			if ("1".equals(System.getenv("HOROSA_IDENTITY_DEEP_FAIL"))) {
				return false;
			}
			int y = 2000, m = 1, d = 1;
			int a = (14 - m) / 12, yy = y + 4800 - a, mm = m + 12 * a - 3;
			long jdn = d + (153L * mm + 2) / 5 + 365L * yy + yy / 4 - yy / 100 + yy / 400 - 32045;
			byte[] scratch = new byte[64 * 1024];
			scratch[0] = (byte) (jdn & 0xFF);
			return jdn == 2451545L && scratch[0] == (byte) (2451545L & 0xFF);
		} catch (Throwable t) {
			return false;
		}
	}

}
