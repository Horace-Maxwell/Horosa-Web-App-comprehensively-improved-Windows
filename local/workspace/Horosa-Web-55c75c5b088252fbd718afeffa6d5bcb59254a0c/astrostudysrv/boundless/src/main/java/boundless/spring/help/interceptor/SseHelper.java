package boundless.spring.help.interceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;

public class SseHelper {
	private static Logger log = AppLoggers.getLog("sse", "sse");
	
	private static Map<String, SseEmitter> emitters = new ConcurrentHashMap<String, SseEmitter>();
	
	public static SseEmitter push(String id) {
		if(emitters.containsKey(id)) {
			return emitters.get(id);
		}
		
		// no fixed timeout: a local LLM stream can run longer than any cap; rely on completion/error/client-disconnect
		SseEmitter emitter = new SseEmitter(0L);
		
		emitters.put(id, emitter);
		
		emitter.onCompletion(()->{
			emitters.remove(id);
			QueueLog.debug(log, "emitter {} completion", id);
		});
		
		emitter.onTimeout(()->{
			emitters.remove(id);
			QueueLog.debug(log, "emitter {} timeout", id);
		});
		
		emitter.onError((e)->{
			emitters.remove(id);
			QueueLog.error(AppLoggers.ErrorLogger, e);
		});
				
		TransData.setSSE(true);

		return emitter;
	}

}
