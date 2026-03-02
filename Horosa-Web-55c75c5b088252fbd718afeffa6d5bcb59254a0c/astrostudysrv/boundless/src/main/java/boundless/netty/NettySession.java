package boundless.netty;

import io.netty.channel.Channel;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import boundless.function.Consumer0;

public class NettySession implements Transfer, Serializable{
	private static final long serialVersionUID = 6039379345801639451L;

	transient private ProcessorContext context;
	
	private String id;
	private Object attach;
	private boolean removed;
	
	private List<Consumer<NettySession>> onCloseListeners;
	private Consumer0 rejectHandler;
	
	NettySession(){
		this.onCloseListeners = new ArrayList<Consumer<NettySession>>();
		this.removed = false;
	}
	
	NettySession(ProcessorContext ctx){
		this();
		this.context = ctx;
	}
	
	public void close(){
		if(this.context != null){
			this.context.close();
			this.context = null;
		}
		clearData();
		this.removed = true;
	}
	
	public void reject(){
		this.removed = true;
		if(this.rejectHandler != null){
			this.rejectHandler.accept();
		}
	}
	
	public boolean isRemoved(){
		boolean sessflag = context.getSession() == null;
		boolean samesessflag = context.getSession() != this;
		return this.removed || sessflag || samesessflag;
	}
	
	public void reset(){
		this.removed = false;
	}
	
	void clearData(){
		for(Consumer<NettySession> consume : this.onCloseListeners){
			try{
				consume.accept(this);
			}catch(Exception e){
				e.printStackTrace();
			}
		}
		this.attach = null;
		this.onCloseListeners.clear();
		this.rejectHandler = null;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}
	
	public long getClientAddress(){
		return this.context.getClientNum();
	}
	
	public ProcessorContext getContext(){
		return this.context;
	}
	
	void setContext(ProcessorContext value){
		this.context = value;
	}
	
	public void setAttach(Object value){
		this.attach = value;
	}
	
	public Object getAttach(){
		return this.attach;
	}
	
	public void send(Datagram data){
		this.context.send(data);
	}
	
	public Channel getChannel(){
		return this.context.getChannel();
	}
	
	public void addOnCloseListener(Consumer<NettySession> consume){
		this.onCloseListeners.add(consume);
	}
	
	public void removeOnCloseListener(Consumer<NettySession> consume){
		this.onCloseListeners.add(consume);
	}
	
	public void setRejctHandler(Consumer0 handler){
		this.rejectHandler = handler;
	}
	
}
