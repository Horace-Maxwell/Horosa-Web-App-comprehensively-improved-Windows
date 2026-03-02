package boundless.types.mq.redis;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

import boundless.log.QueueLog;
import boundless.types.ICache;
import boundless.types.Tuple;
import boundless.types.mq.MsgQueue;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class RedisQueue implements MsgQueue{
	
	private String queueName;
	private RedisQueueFactory owner;
	
	private boolean isClose = false;
	
	private Set<Tuple<Consumer<String>, Consumer<Exception>>> handlers = new HashSet<Tuple<Consumer<String>, Consumer<Exception>>>();

	public RedisQueue(RedisQueueFactory factory, String queuename){
		this.queueName = queuename;
		this.owner = factory;
		this.isClose = false;
		
	}
	
	boolean checkMsgOnce(){
		try{
			for(Tuple<Consumer<String>, Consumer<Exception>> tuple : handlers){
				Object obj = recvMsg(null);
				if(StringUtility.isNullOrEmpty(obj)){
					return false;
				}
				String str = (String) obj;
				try{
					QueueLog.debug(log, "found msg: {}", str);
					tuple.item1().accept(str);
				}catch(Exception e){
					tuple.item2().accept(e);
				}
			}
			if(handlers.isEmpty()){
				return false;
			}
			return true;
		}catch(Exception e){
			QueueLog.error(log, e);
		}
		return false;
	}
	
	void clearHandlers(){
		this.handlers.clear();
	}

	@Override
	public void close() {
		this.isClose = true;
		this.owner.deleteLocalQueue(this.queueName);
	}

	@Override
	public void publish(String msg) {
		ICache cache = this.owner.getCache();
		try{
			cache.lpush(this.queueName, msg);
		}finally{
			cache.close();
		}
	}

	@Override
	public void subscribe(Consumer<String> handler, Consumer<Exception> exhandler) {
		Tuple<Consumer<String>, Consumer<Exception>> tuple = new Tuple<Consumer<String>, Consumer<Exception>>(handler, exhandler);
		this.handlers.add(tuple);
	}

	@Override
	public void enqueue(String msg) {
		publish(msg);
	}

	@Override
	public boolean dequeue(Consumer<String> handler, Consumer<Exception> exhandler) {
		ICache cache = this.owner.getCache();
		try{
			String msg = cache.rpop(queueName);
			if(!StringUtility.isNullOrEmpty(msg)){
				handler.accept(msg);
				return true;
			}
			return false;
		}catch(Exception e){
			exhandler.accept(e);
		}finally{
			cache.close();
		}
		return false;
	}

	@Override
	public MsgQueue getQueue(String name) {
		return this.owner.getMsgQueue(name);
	}

	@Override
	public String getName() {
		return this.queueName;
	}

	@Override
	public void publish(String topickey, String msg) {
		String str = String.format("%s::%s", topickey, msg);
		publish(str);
	}

	@Override
	public void publish(String exname, String topickey, String msg) {
		String str = String.format("%s::%s::%s", exname, topickey, msg);
		publish(str);
	}

	@Override
	public void delMsg(Object obj) {
		recvMsg(obj);
	}

	@Override
	public void sendMsg(Object obj) {
		publish(obj.toString());
	}

	@Override
	public Object recvMsg(Object obj) {
		ICache cache = this.owner.getCache();
		try{
			if(obj != null){
				int cnt = ConvertUtility.getValueAsInt(obj);
				List<String> list = new ArrayList<String>();
				while(cnt > 0){
					String str = cache.rpop(this.queueName);
					if(str == null || "nil".equals(str)){
						break;
					}
					list.add(str);
					cnt--;
				}
				return list;
			}
			return cache.rpop(this.queueName);
		}finally{
			cache.close();
		}
	}
	
	
	
}
