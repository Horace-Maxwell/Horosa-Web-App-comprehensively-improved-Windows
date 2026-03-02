package boundless.netty;

import boundless.model.HierarchicalMap;
import boundless.utility.StringUtility;

public class BroadcastConfig implements IBroadcastConfig {
	private int id;
	private int port;
	private int serverType;
	private String name;
	private String address;
	private boolean trackPacket;
	private int boss;
	private int worker;
	private int taskThreshold;

	private String encoderClass;
	private String decoderClass;
	private String initPluginClass;
	private String periodTaskClass;
	private String loggerName;
	private String errorLogger;
	
	private boolean closeOnException;
	private boolean exceptionMsgReturn;
	private String exceptionDatagram;
	private int exceptionPacketId;
	
	public BroadcastConfig() {
		
	}
	
	public BroadcastConfig(HierarchicalMap map){
		this.id = map.getAttributeAsInt("id");
		this.port = map.getAttributeAsInt("port");
		this.serverType = map.getAttributeAsInt("serverType");
		this.name = map.getAttributeAsString("name");
		this.address = map.getAttributeAsString("addr");
		this.trackPacket = map.getAttributeAsBool("trackPacket", true);
		this.taskThreshold=map.getAttributeAsInt("taskThreshold");
		this.worker=map.getAttributeAsInt("worker");
		this.decoderClass = map.getAttributeAsString("decoder");
		this.encoderClass = map.getAttributeAsString("encoder");
		this.initPluginClass = map.getAttributeAsString("initPlugin");
		this.periodTaskClass = map.getAttributeAsString("periodTask");
		this.loggerName = map.getAttributeAsString("logger");
		this.errorLogger = map.getAttributeAsString("errorLogger");
		this.exceptionMsgReturn = map.getAttributeAsBool("exceptionMsgReturn", false);
		this.closeOnException = map.getAttributeAsBool("closeOnException", false);
		this.exceptionDatagram = map.getAttributeAsString("exceptionDatagram");
		this.exceptionPacketId = map.getAttributeAsInt("exceptionPacketId");
	}
	
	public BroadcastConfig(int id, String addr, int port){
		this.id = id;
		this.address = addr;
		this.port = port;
		this.trackPacket = false;
	}
	
	public int serverType(){
		return this.serverType;
	}
	
	public void serverType(int value){
		this.serverType = value;
	}
	
	@Override
	public int broadcastId(){
		return this.id;
	}
	
	@Override
	public String broadcastName() {
		return name;
	}

	@Override
	public String broadcastAddress() {
		if(StringUtility.isNullOrEmpty(address)){
			return "255.255.255.255";
		}
		return address;
	}

	@Override
	public int broadcastPort() {
		return port;
	}

	@Override
	public boolean trackPacket() {
		return trackPacket;
	}

	@Override
	public void broadcastName(String name){
		this.name = name;
	}
	
	@Override
	public void broadcastAddress(String addr){
		this.address = addr;
	}
	
	@Override
	public void broadcastPort(int port){
		this.port = port;
	}
	
	@Override
	public void trackPacket(boolean value){
		this.trackPacket = value;
	}
	
	@Override
	public void broadcastId(int id){
		this.id = id;
	}
	
	public int boss() {
		return this.boss;
	}
	public void boss(int n){
		boss = n;
	}

	public int worker(){
		return worker;
	}
	
	public void worker(int n){
		worker = n;
	}

	public String decoderClass(){
		return this.decoderClass;
	}
	
	public void decoderClass(String value){
		this.decoderClass = value;
	}
	
	public String encoderClass(){
		return this.encoderClass;
	}
	
	public void encoderClass(String value){
		this.encoderClass = value;
	}
	
	public String initPluginClass(){
		return this.initPluginClass;
	}
	
	public void initPluginClass(String value){
		this.initPluginClass = value;
	}
	
	public String periodTaskClass(){
		return this.periodTaskClass;
	}
	
	public void periodTaskClass(String value){
		this.periodTaskClass = value;
	}
	
	public void loggerName(String value){
		this.loggerName = value;
	}
	
	public String loggerName(){
		return this.loggerName;
	}

    public String errorLoggerName(){
    	return this.errorLogger;
    }
    
    public void errorLoggerName(String value){}
    
    public boolean exceptionMsgReturn(){ 
    	return this.exceptionMsgReturn; 
    }
    public IBroadcastConfig exceptionMsgReturn(boolean value) { 
    	this.exceptionMsgReturn = value;
    	return this; 
    }
    
    public boolean closeOnException(){ 
    	return this.closeOnException; 
    }
    public IBroadcastConfig closeOnException(boolean value) { 
    	this.closeOnException = value;
    	return this; 
    }
    
    public String exceptionDatagram(){ 
    	return this.exceptionDatagram; 
    }
    public IBroadcastConfig exceptionDatagram(String classname){
    	this.exceptionDatagram = classname;
    	return this;
    }

    public int exceptionPacketId(){ 
    	return this.exceptionPacketId; 
    }
    public IBroadcastConfig exceptionPacketId(int packetid){ 
    	this.exceptionPacketId = packetid;
    	return this; 
    }

    public int taskThreshold(){
    	return this.taskThreshold;
    }
    public IBroadcastConfig taskThreshold(int value){
    	this.taskThreshold = value;
    	return this;
    }

}
