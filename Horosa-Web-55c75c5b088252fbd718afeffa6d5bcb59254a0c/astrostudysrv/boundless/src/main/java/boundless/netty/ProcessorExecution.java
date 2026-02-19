package boundless.netty;

import io.netty.channel.Channel;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.exception.AppException;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;
import boundless.types.MostActiveQueue;
import boundless.utility.ConsoleUtility;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;

public class ProcessorExecution implements PacketRegistor, Sessionable {
	private static Logger globalLog = LoggerFactory.getLogger(ProcessorExecution.class);

	private ExecutionGroup executor;

	private ExecutionGroup heartbeatExecutor;
	private Map<Integer, Consumer<ProcessorContext>> heartbeatHandlers;

	private Logger log;
	
	private Map<Integer, CallbackHandler> callbackHandlers;
	private Map<Integer, Consumer<ProcessorContext>> handlers;
	private List<Function<ProcessorContext, Boolean>> chains;
	private List<Function<ProcessorContext, Boolean>> afterChains;
	private Map<Integer, List<Function<ProcessorContext, Boolean>>> beforeCmdChains;
	private Map<Integer, List<Function<ProcessorContext, Boolean>>> afterCmdChains;
	
	private Function<Throwable, Datagram> commExceptionHandler;
	private Consumer<ProcessorContext> defaultCallbackHandler;
	
	private Map<Long, NettySession> sessions;
	private Map<String, Long> sessionIds;

	private MostActiveQueue<NettySession> mostActiveSession;
	
	private ScheduledExecutorService periodtask = null;
	
	public ProcessorExecution(int threadsize){
		this(threadsize, null);
	}
	
	public ProcessorExecution(int threadsize, String threadfactoryName){
		this.callbackHandlers = new HashMap<Integer, CallbackHandler>();
		this.handlers = new HashMap<Integer, Consumer<ProcessorContext>>();
		this.heartbeatHandlers = new HashMap<Integer, Consumer<ProcessorContext>>();
		this.sessions = new HashMap<Long, NettySession>();
		this.sessionIds = new HashMap<String, Long>();
		this.chains = new ArrayList<Function<ProcessorContext, Boolean>>();
		this.afterChains = new ArrayList<Function<ProcessorContext, Boolean>>();
		this.beforeCmdChains = new HashMap<Integer, List<Function<ProcessorContext, Boolean>>>();
		this.afterCmdChains = new HashMap<Integer, List<Function<ProcessorContext, Boolean>>>();
		this.mostActiveSession = new MostActiveQueue<NettySession>();
		
		if(StringUtility.isNullOrEmpty(threadfactoryName)){
			heartbeatExecutor = new ExecutionGroup(1, "ProcessorExecutionHeartbeat");
			executor = new ExecutionGroup(threadsize, "ProcessorExecution");
		}else{
			heartbeatExecutor = new ExecutionGroup(1, threadfactoryName + "Heartbeat");
			executor = new ExecutionGroup(threadsize, threadfactoryName);
		}
		
	}
	
	public void setName(String name){
		executor.setGroupName("ProcessorExecution-" + name);
	}
	
	public void setTaskThreshold(int value){
		this.executor.setTaskThreshold(value);
	}
	
	public void setCommExceptionHandler(Function<Throwable, Datagram> handler){
		this.commExceptionHandler = handler;
	}
	
	public void setDefaultCallbackHandler(Consumer<ProcessorContext> handler){
		this.defaultCallbackHandler = handler;
	}
	
	public int countRunning(){
		return this.executor.countRunning();
	}
	
	
	private void innerExecute(int command, ProcessorContext ctx, Consumer<ProcessorContext> handler, Consumer<Throwable> errhandler,
			List<Function<ProcessorContext, Boolean>> cmdchain, List<Function<ProcessorContext, Boolean>> aftercmdchain){
		try{
			for(Function<ProcessorContext, Boolean> fun : this.chains){
				boolean res = fun.apply(ctx);
				if(!res){
					return;
				}
			}
			
			if(cmdchain != null && !cmdchain.isEmpty()){
				for(Function<ProcessorContext, Boolean> fun : cmdchain){
    				boolean res = fun.apply(ctx);
    				if(!res){
    					return;
    				}
				}
			}
			
			handler.accept(ctx);
			
			if(aftercmdchain != null && !aftercmdchain.isEmpty()){
				for(Function<ProcessorContext, Boolean> fun : aftercmdchain){
    				boolean res = fun.apply(ctx);
    				if(!res){
    					return;
    				}
				}
			}

			for(Function<ProcessorContext, Boolean> fun : this.afterChains){
				boolean res = fun.apply(ctx);
				if(!res){
					return;
				}
			}
		}catch(Throwable e){
			if(e instanceof AppException) {
				AppException ex = (AppException)e;
				ex.setCommand(command);
			}
			if(errhandler != null){
				try{
					errhandler.accept(e);
				}catch(Exception err){
					QueueLog.error(log(), err);
				}
			}else{
				if(this.commExceptionHandler != null){
					Datagram datagram = this.commExceptionHandler.apply(e);
					if(ctx.isAllowSending()){
						if(datagram != null){
							ctx.send(datagram);
						}
					}
				}
			}
		}
	}
	
	public void executeSync(int command, ProcessorContext ctx){
		int cbno = ctx.getInData().getCallbackno();
		CallbackHandler cb = this.callbackHandlers.get(cbno);
		Consumer<ProcessorContext> cbhandler = null;
		Consumer<Throwable> errorHandler = null;
		if(cb != null){
			cbhandler = cb.getHandler();
			errorHandler = cb.errorHandler;
		}
		Consumer<ProcessorContext> handler = this.heartbeatHandlers.get(command);
		if(handler == null){
			handler = this.handlers.get(command);
		}
		if(cbno != 0 && cbhandler != null){
			handler = cbhandler;
		}
		if(handler == null){
			handler = this.defaultCallbackHandler;
		}
		if(handler == null){
			QueueLog.info(log(), "no handler for command:{}, do nothing", StringUtility.toHex(command));
			return;
		}
		
		List<Function<ProcessorContext, Boolean>> cmdchain = this.beforeCmdChains.get(command);
		List<Function<ProcessorContext, Boolean>> aftercmdchain = this.afterCmdChains.get(command);
		
		innerExecute(command, ctx, handler, errorHandler, cmdchain, aftercmdchain);
		
		this.callbackHandlers.remove(cbno);
	}
	
	public void execute(int command, ProcessorContext ctx){
		int cbno = ctx.getInData().getCallbackno();
		CallbackHandler cb = this.callbackHandlers.get(cbno);
		Consumer<ProcessorContext> cbhandler = null;
		Consumer<Throwable> errorHandler = null;
		if(cb != null){
			cbhandler = cb.getHandler();
			errorHandler = cb.errorHandler;
		}
		Consumer<ProcessorContext> handler = this.heartbeatHandlers.get(command);
		if(handler == null){
			handler = this.handlers.get(command);
		}
		if(cbno != 0 && cbhandler != null){
			handler = cbhandler;
		}
		if(handler == null){
			handler = this.defaultCallbackHandler;
		}
		if(handler == null){
			QueueLog.info(log(), "no handler for command:{}, do nothing", StringUtility.toHex(command));
			return;
		}
		
		final Consumer<ProcessorContext> finhandler = handler;
		final Consumer<Throwable> finerrorHandler = errorHandler;
		List<Function<ProcessorContext, Boolean>> cmdchain = this.beforeCmdChains.get(command);
		List<Function<ProcessorContext, Boolean>> aftercmdchain = this.afterCmdChains.get(command);
		try{
			if(this.heartbeatHandlers.containsKey(command)){
				heartbeatExecutor.execute(()->{
					innerExecute(command, ctx, finhandler, finerrorHandler, cmdchain, aftercmdchain);
		    	});
			}else{
				executor.execute(()->{
					innerExecute(command, ctx, finhandler, finerrorHandler, cmdchain, aftercmdchain);
		    	});
			}
		}catch(Exception e){
			QueueLog.error(log(), e);
		}
		
		this.callbackHandlers.remove(cbno);
	}
	
	
	public void stop(){
		stopWithReuse(false);
	}
	
	synchronized void stopWithReuse(boolean reuse){
		for(NettySession session : sessions.values()){
			session.reject();
			session.close();
		}
		this.sessions.clear();
		this.mostActiveSession.clear();
		if(!reuse){
			this.executor.close();
			this.heartbeatExecutor.close();;
			this.chains.clear();
			this.handlers.clear();
			this.callbackHandlers.clear();
			for(List<Function<ProcessorContext, Boolean>> chain : this.beforeCmdChains.values()){
				chain.clear();
			}
			this.beforeCmdChains.clear();
			for(List<Function<ProcessorContext, Boolean>> chain : this.afterCmdChains.values()){
				chain.clear();
			}
			this.afterCmdChains.clear();
			if(periodtask != null){
				periodtask.shutdownNow();
				periodtask = null;
			}
		}
	}
	
	private void checkCallbackHandlerTimeout(){
		Set<Integer> tmSet = new HashSet<Integer>();
		for(Entry<Integer, CallbackHandler> entry : this.callbackHandlers.entrySet()){
			CallbackHandler cb = entry.getValue();
			if(System.currentTimeMillis() >= cb.time + cb.timeout){
				tmSet.add(entry.getKey());
				Exception err = new Exception("timeout");
				try{
					if(cb.errorHandler != null){
						cb.errorHandler.accept(err);
					}
				}catch(Exception e){
					String msg = ConsoleUtility.getStackTrace(e);
					QueueLog.error(log(), msg);
				}
			}
		}
		for(Integer key : tmSet){
			this.callbackHandlers.remove(key);
		}
	}
	
	public synchronized void registerCallback(int callbackno, Consumer<ProcessorContext> handler, int timeoutSec, Consumer<Throwable> errorHandler){
		if(this.periodtask == null){
			this.periodtask = new ScheduledThreadPoolExecutor(1, new ExecutionGroup.ExeGroupThreadFactory("CheckCallbackPeriodTask"));
			this.periodtask.scheduleWithFixedDelay(()->{
				try{
					checkCallbackHandlerTimeout();
				}catch(Exception e){
					QueueLog.error(log(), e);
				}
			}, 1, 10, TimeUnit.SECONDS);
		}
		
		CallbackHandler cb = new CallbackHandler(handler, timeoutSec*1000, errorHandler);
		this.callbackHandlers.put(callbackno, cb);
	}
	
	public void removeCallback(int cbno){
		this.callbackHandlers.remove(cbno);
	}

	@Override
	public void registerHeartbeatHandle(int command, Consumer<ProcessorContext> handler){
		this.heartbeatHandlers.put(command, handler);
	}
	
	@Override
	public void register(int command, Consumer<ProcessorContext> handler) {
		handlers.put(command, handler);
	}

	@Override
	public void unregister(int command) {
		handlers.remove(command);
	}
	
	@Override
	synchronized public void addChain(Function<ProcessorContext, Boolean> fun){
		this.chains.add(fun);
	}
	
	@Override
	synchronized public void addAfterChain(Function<ProcessorContext, Boolean> fun){
		this.afterChains.add(fun);
	}
	
	@Override
	synchronized public void addBeforeCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		List<Function<ProcessorContext, Boolean>> cmdchain = this.beforeCmdChains.get(command);
		if(cmdchain == null){
			cmdchain = new ArrayList<Function<ProcessorContext, Boolean>>();
			this.beforeCmdChains.put(command, cmdchain);
		}
		cmdchain.add(fun);
	}
	
	@Override
	synchronized public void addAfterCmdChain(int command, Function<ProcessorContext, Boolean> fun){
		List<Function<ProcessorContext, Boolean>> cmdchain = this.afterCmdChains.get(command);
		if(cmdchain == null){
			cmdchain = new ArrayList<Function<ProcessorContext, Boolean>>();
			this.afterCmdChains.put(command, cmdchain);
		}
		cmdchain.add(fun);
	}
	
	@Override
	synchronized public NettySession setupSession(ProcessorContext context, String sessionId){
		Long oldkey = this.sessionIds.get(sessionId);
		long key = context.getClientNum();
		if(oldkey != null && oldkey.longValue() != key){
			NettySession sess = this.sessions.get(oldkey);
			if(sess != null){
				sess.getChannel().close();
				this.sessionIds.remove(sessionId);
				this.sessions.remove(oldkey);
				sess.reject();
			}
		}
		
		NettySession sess = this.sessions.get(key);
		if(sess == null){
			QueueLog.error(log(), "session with key:{} has removed, so cannot setup", key);
			this.sessionIds.remove(key);
			return null;
		}
		
		sess.setId(sessionId);
		sess.setContext(context);
		this.sessionIds.put(sessionId, key);
		
		return sess;
	}
	
	synchronized public NettySession addSession(Channel channel){
		String[] parts = channel.remoteAddress().toString().replaceAll("/", "").split(":");
		long clientNum = ServerAddress.getDistinctCode(IPUtility.convert(parts[0]), ConvertUtility.getValueAsInt(parts[1]));
		NettySession sess = new NettySession();
		this.sessions.put(clientNum, sess);
		return sess;
	}
		
	synchronized public int countSession(){
		return sessions.size();
	}
			
	synchronized public NettySession removeSession(Channel channel){
		String clientAddr = channel.remoteAddress().toString();
		String[] parts = clientAddr.replaceAll("/", "").split(":");
		long key = ServerAddress.getDistinctCode(IPUtility.convert(parts[0]), ConvertUtility.getValueAsInt(parts[1]));
		NettySession sess = this.sessions.remove(key);
		if(sess == null){
			return null;
		}
		
		String sessid = sess.getId();
		if(!StringUtility.isNullOrEmpty(sessid)){
			this.sessionIds.remove(sessid);
		}
		sess.reject();
		
		return sess;
	}
		
	public NettySession getSession(String sessionId){
		if(StringUtility.isNullOrEmpty(sessionId)){
			return null;
		}
		Long key = this.sessionIds.get(sessionId);
		if(key == null){
			return null;
		}
		NettySession sess =  this.sessions.get(key);
		return sess;
	}
	
	public String getSessionId(long clientAddr){
		NettySession sess = this.sessions.get(clientAddr);
		if(sess == null){
			return "";
		}
		
		return sess.getId();
	}
	
	synchronized public NettySession[] getAllSessions(){
		NettySession[] res = new NettySession[this.sessions.size()];
		this.sessions.values().toArray(res);
		return res;
	}
	
	synchronized public Long[] getAllClientAddress(){
		int sz = this.sessions.size();
		Long[] clients = new Long[sz];
		this.sessions.keySet().toArray(clients);
		return clients;
	}
	
	public void markVeryActive(NettySession session){
		this.mostActiveSession.enqueue(session);
	}

	public void unmarkVeryActive(NettySession session){
		this.mostActiveSession.remove(session);
	}
	
	public NettySession[] getMostActiveSessions(){
		List<NettySession> res = this.mostActiveSession.allObjects();
		NettySession[] ary = new NettySession[res.size()];
		ary = res.toArray(ary);
		for(int i=0; i<ary.length/2; i++){
			int j = ary.length - i - 1;
			NettySession tmp = ary[j];
			ary[j] = ary[i];
			ary[i] = tmp;
		}
		return ary;
	}

	public void broadcast(Function<Object, Datagram> fun){
		for(Entry<Long, NettySession> entry : this.sessions.entrySet()){
			NettySession sess = entry.getValue();
			if(sess.getContext() == null){
				continue;
			}
			Datagram data = fun.apply(sess.getAttach());
			if(data != null){
				try{
					sess.getContext().send(data);
				}catch(Exception e){
					e.printStackTrace();
				}
			}
		}
	}
	
	public List<Object> getAttachList(){
		List<Object> list = new ArrayList<Object>();
		for(NettySession sess : this.sessions.values()){
			Object obj = sess.getAttach();
			if(obj != null){
				list.add(obj);
			}
		}
		return list;
	}
	
	public void treatAttach(Consumer<Object> consumer){
		for(NettySession sess : this.sessions.values()){
			Object obj = sess.getAttach();
			if(obj != null){
				consumer.accept(obj);
			}
		}
	}
	
	public void log(Logger log){
		this.log = log;
	}
	
	public Logger log(){
		if(log == null){
			this.log = ProcessorExecution.globalLog;
		}
		return this.log;
	}
	
	
	private static class CallbackHandler{
		private Consumer<ProcessorContext> handler;
		private Consumer<Throwable> errorHandler;
		private long time;
		private int timeout; // in ms
		
		public CallbackHandler(Consumer<ProcessorContext> handler, int timeoutMS, Consumer<Throwable> errorHandler){
			this.handler = handler;
			this.timeout = timeoutMS;
			this.time = System.currentTimeMillis();
			this.errorHandler = errorHandler;
		}
		
		public Consumer<ProcessorContext> getHandler(){
			return this.handler;
		}
		
	}


}
