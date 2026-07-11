package spacex.astrostudy.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import boundless.spring.help.interceptor.SseHelper;
import boundless.spring.help.interceptor.TransData;
import boundless.utility.JsonUtility;
import spacex.astrostudy.service.AIAnalysisMaterialService;
import spacex.astrostudy.service.AIAnalysisProxyService;

@Controller
@RequestMapping("/aianalysis")
public class AIAnalysisController {

	@Autowired
	private AIAnalysisProxyService service;

	@Autowired
	private AIAnalysisMaterialService materialService;

	@RequestMapping("/providers/models")
	@ResponseBody
	public void listModels(){
		Map<String, Object> result = service.listModels(readParams());
		TransData.set("Result", result);
	}

	@RequestMapping("/chat")
	@ResponseBody
	public void chat(){
		Map<String, Object> result = service.chat(readParams());
		TransData.set("Result", result);
	}

	@RequestMapping("/chat/stream")
	@ResponseBody
	public SseEmitter chatStream(){
		final Map<String, Object> params = readParams();
		final SseEmitter emitter = SseHelper.push(UUID.randomUUID().toString());
		// [并发根修] worker 与 servlet 对象彻底解耦:不再捕获/绑定 request、response,也不再
		// markCurrentThread——流式期间客户端一旦中断,Tomcat 会回收 Request 并复用给并发中的
		// 下一个请求,池线程继续持有/书写它就是跨请求污染(空响应/NPE)的根源。worker 只需要
		// params 与 emitter;__sse__ 已由 servlet 线程在 SseHelper.push() 对真请求设置。
		// 有界池替代每请求 new Thread(无界直建 burst 下线程堆积);池见 AIAnalysisProxyService.streamWorkerPool()。
		AIAnalysisProxyService.streamWorkerPool().execute(()->{
			// 池线程复用:开头与 finally 都彻底清场(clearThreadContext 才是真清;
			// setRequestData 是 merge 语义,清不掉滞留的 servlet 引用与 MB 级挂载快照)。
			TransData.clearThreadContext();
			try {
				try {
					// Give the servlet async pipeline a moment to fully enter SSE mode
					// before the first frame; some desktop runtime starts otherwise prepend
					// the default encrypted response body ahead of the event stream.
					Thread.sleep(50L);
				}catch(InterruptedException e) {
					Thread.currentThread().interrupt();
				}
				service.chatStream(params, emitter);
			} finally {
				TransData.clearThreadContext();
			}
		});
		return emitter;
	}

	@RequestMapping("/providers/diagnose")
	@ResponseBody
	public void diagnoseProvider(){
		Map<String, Object> result = service.diagnose(readParams());
		TransData.set("Result", result);
	}

	@RequestMapping("/materials/extract")
	@ResponseBody
	public void extractMaterial(){
		Map<String, Object> result = materialService.extract(readParams());
		TransData.set("Result", result);
	}

	@RequestMapping("/embeddings")
	@ResponseBody
	public void embeddings(){
		Map<String, Object> result = service.embeddings(readParams());
		TransData.set("Result", result);
	}

	private Map<String, Object> readParams(){
		String json = TransData.getRequestJson();
		Map<String, Object> result = JsonUtility.toDictionary(json);
		return result == null ? new LinkedHashMap<String, Object>() : result;
	}
}
