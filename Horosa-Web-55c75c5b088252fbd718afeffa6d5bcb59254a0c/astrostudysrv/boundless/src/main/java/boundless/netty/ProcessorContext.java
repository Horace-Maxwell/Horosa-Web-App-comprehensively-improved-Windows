package boundless.netty;

import java.io.Serializable;
import java.net.SocketAddress;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.IPUtility;
import boundless.utility.StringUtility;
import io.netty.channel.Channel;

public class ProcessorContext implements Serializable{
	private static final long serialVersionUID = -6630224495240780971L;

	private static Logger globalLog = LoggerFactory.getLogger(ProcessorContext.class);
			
	transient private Logger log;
	transient private Logger datalog;
	
	transient private Channel channel;
	transient private Sessionable sessionable;

	private Datagram inData;
	private Object attach;
	
	private String info = "";
	private String id = "";
	
	private long serverNum;
	private long clientNum;
	
	private boolean allowSending = true;
	
	
	public ProcessorContext(Channel ctx, Datagram inData, long serverNum){
		SocketAddress addr = ctx.remoteAddress();
		if(addr == null){
			addr = ctx.localAddress();
		}
		
		String[] parts = addr.toString().replaceAll("/", "").split(":");

		this.channel = ctx;
		this.inData = inData;
		this.serverNum = serverNum;
		this.clientNum = ServerAddress.getDistinctCode(IPUtility.convert(parts[0]), ConvertUtility.getValueAsInt(parts[1]));
	}
		
	public Datagram getInData(){
		return inData;
	}
	
	public void send(Datagram outData){
		if(!this.allowSending){
			throw new RuntimeException("not allow sending datagram");
		}
		
		outData.id(this.id());
		outData.info(this.info());
		outData.log(this.datalog);
		try{
			this.channel.writeAndFlush(outData);
		}catch(Throwable e){
			QueueLog.error(log(), "exception:{}, errmsg:{}", e.getClass().getName(), e.getMessage());
		}
	}
	
	public boolean isAllowSending(){
		return this.allowSending;
	}
	
	public void setAllowSend(boolean value){
		this.allowSending = value;
	}
	
	public void setAttach(Object obj){
		this.attach = obj;
	}
	
	public Object getAttach(){
		return this.attach;
	}
	
	public void close(){
		this.channel.close();
		if(this.channel.remoteAddress() != null){
			QueueLog.info(log, "channel closed: {}", channel.remoteAddress().toString());
		}else{
			QueueLog.info(log, "channel closed: {}", channel.toString());
		}
	}
	
	public Channel getChannel(){
		return this.channel;
	}
	
	void setSessionable(Sessionable sess){
		this.sessionable = sess;
	}
	
	void setChannel(Channel value){
		this.channel = value;
	}
	
	public NettySession setupSession(String sessionId){
		NettySession sess = this.sessionable.setupSession(this, sessionId);
		return sess;
	}
	
	public long getClientNum(){
		return this.clientNum;
	}
	
	public NettySession getSession(){
		long key = getClientNum();
		String sessid = this.sessionable.getSessionId(key);
		if(StringUtility.isNullOrEmpty(sessid)){
			return null;
		}
		return this.sessionable.getSession(sessid);
	}
	
	public void markSignificantActive(){
		NettySession sess = getSession();
		if(sess != null){
			this.sessionable.markVeryActive(sess);
		}
	}
	
	public String info(){
		return this.info;
	}
	
	public void info(String str){
		this.info = str;
	}
	
	public String id(){
		return this.id;
	}
	
	public void id(String str){
		this.id = str;
	}
	
	public void datalog(Logger log){
		this.datalog = log;
	}
	
	public void log(Logger log){
		this.log = log;
	}
	
	public Logger log(){
		if(log == null){
			this.log = ProcessorContext.globalLog;
		}
		return this.log;
	}
	
	public long serverNum(){
		return this.serverNum;
	}
	
}
