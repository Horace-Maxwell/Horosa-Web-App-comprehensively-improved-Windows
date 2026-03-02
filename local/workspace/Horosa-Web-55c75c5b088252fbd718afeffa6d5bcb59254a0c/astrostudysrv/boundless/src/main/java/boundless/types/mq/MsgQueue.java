package boundless.types.mq;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.exception.UnimplementedException;
import boundless.function.Consumer3;

public interface MsgQueue {
	public final static Logger log = LoggerFactory.getLogger(MsgQueue.class);
	
	default public void close(){}
	default public void publish(String msg){ throw new UnimplementedException("Unimplemented"); };
	default public void subscribe(Consumer<String> handler, Consumer<Exception> exhandler){ throw new UnimplementedException("Unimplemented"); }
	default public void enqueue(String msg){}
	default public boolean dequeue(Consumer<String> handler, Consumer<Exception> exhandler){ return false; }
	default public MsgQueue getQueue(String name){ return this; }
	default public String getName(){ return null; }
	default public void publish(String topickey, String msg){ throw new UnimplementedException("Unimplemented"); }
	default public void subscribe(String topickey, Consumer<String> handler, Consumer<Exception> exhandler){ throw new UnimplementedException("Unimplemented"); }
	default public void subscribe(String topickey, BiConsumer<String, byte[]> handler, Consumer<Exception> exhandler){ throw new UnimplementedException("Unimplemented"); }
	default public void publish(String exname, String topickey, String msg){ throw new UnimplementedException("Unimplemented"); }
	default public void subscribe(String exname, String topickey, Consumer<String> handler, Consumer<Exception> exhandler){ throw new UnimplementedException("Unimplemented"); }
	default public void subscribe(String topickey, Object payload, Consumer3<String, byte[], Object> handler, Consumer<Exception> exhandler){ throw new UnimplementedException("Unimplemented"); }

	default public void publish(byte[] msg){ throw new UnimplementedException("Unimplemented"); };
	default public void publish(String topickey, byte[] msg){ throw new UnimplementedException("Unimplemented"); }

	default public void sendMsg(Object obj){
		publish(obj.toString());
	}
	default public Object recvMsg(Object obj){ throw new UnimplementedException("Unimplemented"); }
	default public void delMsg(Object obj){ throw new UnimplementedException("Unimplemented"); }
	
}
