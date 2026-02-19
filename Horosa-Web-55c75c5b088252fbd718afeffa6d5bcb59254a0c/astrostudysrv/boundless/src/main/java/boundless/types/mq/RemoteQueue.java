package boundless.types.mq;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

import boundless.exception.UnimplementedException;
import boundless.function.Consumer3;
import boundless.log.QueueLog;

public class RemoteQueue implements MsgQueue {

	private IMsgQueueFactory mqFactory;
	private MsgQueue queue;
	private String name;
	
	private long timeout = 3600000;
	private long lastTime = System.currentTimeMillis();
	
	public RemoteQueue(IMsgQueueFactory factory){
		this.mqFactory = factory;
	}
	
	@Override
	public String getName(){
		return this.name;
	}

	@Override
	public void close() {
		try{
			if(queue != null){
				queue.close();
			}
		}catch(Exception e){
			QueueLog.error(log, e.getMessage());
		}
		queue = null;
	}

	@Override
	public void publish(String msg) {
		check();
		queue.publish(msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void publish(byte[] msg) {
		check();
		queue.publish(msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void subscribe(Consumer<String> handler, Consumer<Exception> exhandler) {
		check();
		queue.subscribe(handler, exhandler);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void enqueue(String msg) {
		check();
		queue.enqueue(msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public boolean dequeue(Consumer<String> handler, Consumer<Exception> exhandler) {
		check();
		boolean flag = queue.dequeue(handler, exhandler);
		lastTime = System.currentTimeMillis();
		return flag;
	}
	
	@Override
	public MsgQueue getQueue(String name){
		close();
		queue = mqFactory.getMsgQueue(name);
		this.name = name;
		return this;
	}
	
	@Override
	public void publish(String topickey, String msg) {
		check();
		queue.publish(topickey, msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void publish(String topickey, byte[] msg) {
		check();
		queue.publish(topickey, msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void subscribe(String topickey, Consumer<String> handler, Consumer<Exception> exhandler) {
		check();
		queue.subscribe(topickey, handler, exhandler);
		lastTime = System.currentTimeMillis();
	}
	
	@Override
	public void subscribe(String topickey, BiConsumer<String, byte[]> handler, Consumer<Exception> exhandler){ 
		check();
		queue.subscribe(topickey, handler, exhandler);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void publish(String exname, String topickey, String msg) {
		check();
		queue.publish(exname, topickey, msg);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void subscribe(String exname, String topickey, Consumer<String> handler, Consumer<Exception> exhandler) {
		check();
		queue.subscribe(exname, topickey, handler, exhandler);
		lastTime = System.currentTimeMillis();
	}
	
	@Override
	public void subscribe(String topickey, Object payload, Consumer3<String, byte[], Object> handler, Consumer<Exception> exhandler){ 
		check();
		queue.subscribe(topickey, payload, handler, exhandler);
		lastTime = System.currentTimeMillis();
	}
	

	@Override
	public void delMsg(Object obj) {
		check();
		this.queue.delMsg(obj);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public void sendMsg(Object obj) {
		check();
		this.queue.sendMsg(obj);
		lastTime = System.currentTimeMillis();
	}

	@Override
	public Object recvMsg(Object obj) {
		check();
		Object res = this.queue.recvMsg(obj);
		lastTime = System.currentTimeMillis();
		
		return res;
	}

	private void check(){
		long now = System.currentTimeMillis();
		if(now > lastTime + timeout){
			getQueue(this.name); 
		}
	}

}
