package boundless.spring.help.interceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;
import reactor.core.publisher.Flux;

public class SseHelper {
	private static Logger log = AppLoggers.getLog("sse", "sse");
	
	private static Map<String, SseEmitter> emitters = new ConcurrentHashMap<String, SseEmitter>();
	
	public static SseEmitter push(String id, Flux<String> flux) {
		if(emitters.containsKey(id)) {
			return emitters.get(id);
		}
		
		SseEmitter emitter = push(id);
		flux.subscribe((txt)->{
			try {
				emitter.send(txt);		
				QueueLog.debug(log, txt);
				if(txt.equalsIgnoreCase("[DONE]")) {
					emitter.complete();
					emitters.remove(id);
				}
			}catch(Exception e) {
				QueueLog.error(AppLoggers.ErrorLogger, e);
			}
		});
		
		return emitter;
	}
	
	public static SseEmitter push(String id) {
		if(emitters.containsKey(id)) {
			return emitters.get(id);
		}
		
		SseEmitter emitter = new SseEmitter(120000L);
		
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
	
	public static SseEmitter get(String id) {
		return emitters.get(id);
	}
	
	public static void remove(String id) {
		emitters.remove(id);
	}
	
}
