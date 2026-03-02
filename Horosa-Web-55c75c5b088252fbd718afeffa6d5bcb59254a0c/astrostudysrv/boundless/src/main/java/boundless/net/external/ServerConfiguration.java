package boundless.net.external;

import boundless.model.HierarchicalMap;
import boundless.utility.StringUtility;

public class ServerConfiguration implements IServerConfiguration {
	private short serverId = 0;
	private String serverName = "default-server";
	private byte serverType = 0;
	private int port;
	private int maxClient=3000;
	private boolean trackPacket=true;
	private int boss = 3;
	private int worker = 3;
	private int timeout;
	
	private boolean exceptionMsgReturn = false;
	private boolean closeOnException = false;
	private int taskThreshold = 0;
	
	private String encoderClass;
	private String decoderClass;
	private String initPluginClass;
	private String periodTaskClass;
	private String loggerName;
	private String errorLoggerName;
	private String focusLoggerName;
	private String exceptionDatagram;
	private int exceptionPacketId;
	
	private int udpport;
	private String resType;
	private String udpLoggerName;
	private String broadAddr;
	
	private String rsaServerModulus;
	private String rsaServerPublicExp;
	private String rsaServerPrivateExp;
	private String rsaClientModulus;
	private String rsaClientPublicExp;
	private boolean useRSA;
	private boolean inverseRSA;
	
	
	public ServerConfiguration(){
	}
	
	public ServerConfiguration(HierarchicalMap map){
		this.serverId=(short)map.getAttributeAsInt("serverId");
		this.serverName=map.getAttributeAsString("serverName");
		this.serverType=(byte)map.getAttributeAsInt("serverType");
		this.port=map.getAttributeAsInt("port");
		this.udpport=map.getAttributeAsInt("udpPort");
		this.trackPacket=map.getAttributeAsBool("trackPacket",true);
		this.maxClient=map.getAttributeAsInt("maxClient");
		this.boss=map.getAttributeAsInt("boss");
		this.worker=map.getAttributeAsInt("worker");
		this.timeout=map.getAttributeAsInt("timeout");
		this.decoderClass = map.getAttributeAsString("decoder");
		this.encoderClass = map.getAttributeAsString("encoder");
		this.initPluginClass = map.getAttributeAsString("initPlugin");
		this.periodTaskClass = map.getAttributeAsString("periodTask");
		this.loggerName = map.getAttributeAsString("logger");
		this.errorLoggerName = map.getAttributeAsString("errorLogger");
		this.focusLoggerName = map.getAttributeAsString("focusLogger");
		this.exceptionMsgReturn=map.getAttributeAsBool("exceptionMsgReturn",false);
		this.closeOnException=map.getAttributeAsBool("closeOnException",false);
		this.exceptionDatagram = map.getAttributeAsString("exceptionDatagram");
		this.exceptionPacketId = map.getAttributeAsInt("exceptionPacketId");
		this.resType = map.getAttributeAsString("restype");
		this.udpLoggerName = map.getAttributeAsString("udpLogger");
		this.taskThreshold = map.getAttributeAsInt("taskThreshold");
		this.broadAddr = map.getAttributeAsString("broadAddr");
		this.rsaServerModulus = map.getAttributeAsString("rsaServerModulus");
		this.rsaServerPublicExp = map.getAttributeAsString("rsaServerPublicExp");
		this.rsaServerPrivateExp = map.getAttributeAsString("rsaServerPrivateExp");
		this.rsaClientModulus = map.getAttributeAsString("rsaClientModulus");
		this.rsaClientPublicExp = map.getAttributeAsString("rsaClientPublicExp");
		this.useRSA=map.getAttributeAsBool("useRSA", false);
		this.inverseRSA=map.getAttributeAsBool("inverseRSA", true);
		
		if(this.taskThreshold < 0){
			this.taskThreshold = 0;
		}
		if(this.worker <= 0){
			this.worker = 3;
		}
		if(this.boss <= 0){
			this.boss = 3;
		}
		if(StringUtility.isNullOrEmpty(this.broadAddr)){
			this.broadAddr = "255.255.255.255";
		}
	}
	
	@Override
	public short serverId() {
		return serverId;
	}
	public ServerConfiguration serverId(short value) {
		serverId=value;
		return this;
	}

	@Override
	public String serverName() {
		return serverName;
	}
	public ServerConfiguration serverName(String value) {
		serverName=value;
		return this;
	}

	@Override
	public byte serverType() {
		return serverType;
	}
	public ServerConfiguration serverType(byte value) {
		serverType=value;
		return this;
	}

	@Override
	public int port() {
		return port;
	}
	public ServerConfiguration port(int value) {
		port=value;
		return this;
	}
	
	public int maxClient(){
    	return maxClient;
    }
	public ServerConfiguration maxClient(int value){
    	maxClient=value;
    	return this;
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

	public void errorLoggerName(String value){
		this.errorLoggerName = value;
	}
	
	public String errorLoggerName(){
		return this.errorLoggerName;
	}

	public void focusLoggerName(String value){
		this.focusLoggerName = value;
	}
	
	public String focusLoggerName(){
		return this.focusLoggerName;
	}

	public boolean exceptionMsgReturn(){
    	return exceptionMsgReturn;
    }
	public ServerConfiguration exceptionMsgReturn(boolean value){
		exceptionMsgReturn = value;
    	return this;
    }
	
	public boolean closeOnException(){
    	return closeOnException;
    }
	public ServerConfiguration closeOnException(boolean value){
		closeOnException = value;
    	return this;
    }
	
    /**
     * 获得是否跟踪包
     * @return
     */
	public boolean trackPacket(){
    	return trackPacket;
    }
	public ServerConfiguration trackPacket(boolean value){
    	trackPacket=value;
    	return this;
    }
	
	public int timeout(){
		return this.timeout;
	}
	public IServerConfiguration timeout(int n){
		timeout = n;
		return this;
	}
	
	public int boss(){
		return boss;
	}
	
	public ServerConfiguration boss(int n){
		if(n <= 0){
			return this;
		}
		boss = n;
		return this;
	}

	public int worker(){
		return worker;
	}
	
	public ServerConfiguration worker(int n){
		if(n <= 0){
			return this;
		}
		worker = n;
		return this;
	}
	
    public String exceptionDatagram(){ 
    	return this.exceptionDatagram; 
    }
    public IServerConfiguration exceptionDatagram(String classname){
    	this.exceptionDatagram = classname;
    	return this;
    }
	
    @Override
	public int exceptionPacketId() {
		return this.exceptionPacketId;
	}

	@Override
	public IServerConfiguration exceptionPacketId(int packetid) {
		this.exceptionPacketId = packetid;
		return this;
	}

	public String resType(){ 
    	return this.resType; 
    }
    public IServerConfiguration resType(String value){
    	this.resType = value;
    	return this;
    }
	
    
    public IServerConfiguration udpPort(int port){ 
    	this.udpport = port;
    	return null; 
    }
    public int udpPort() { 
    	return this.udpport; 
    }

    public String broadAddr(){
    	return this.broadAddr;
    }

    public String udpLoggerName(){ 
    	return this.udpLoggerName; 
    }
    public void udpLoggerName(String value){
    	this.udpLoggerName = value;
    }

    public int taskThreshold(){
    	return this.taskThreshold;
    }
    public IServerConfiguration taskThreshold(int value){
    	if(value < 0){
    		return this;
    	}
    	this.taskThreshold = value;
    	return this;
    }
    
    public String rsaServerModulus(){ return this.rsaServerModulus; }
    public String rsaServerPublicExp(){ return this.rsaServerPublicExp; }
    public String rsaServerPrivateExp(){ return this.rsaServerPrivateExp; }
    public String rsaClientModulus(){ return this.rsaClientModulus; }
    public String rsaClientPublicExp(){ return this.rsaClientPublicExp; }
    public boolean useRSA(){ return this.useRSA; }
    public boolean inverseRSA(){ return this.inverseRSA; }
    
    public IServerConfiguration rsaServerModulus(String value){ 
    	this.rsaServerModulus = value;
    	return this; 
    }
    public IServerConfiguration rsaServerPublicExp(String value){
    	this.rsaServerPublicExp = value;
    	return this; 
    }
    public IServerConfiguration rsaServerPrivateExp(String value){
    	this.rsaServerPrivateExp = value;
    	return this; 
    }
    public IServerConfiguration rsaClientModulus(String value){ 
    	this.rsaClientModulus = value;
    	return this; 
    }
    public IServerConfiguration rsaClientPublicExp(String value){ 
    	this.rsaClientPublicExp = value;
    	return this; 
    }
    public IServerConfiguration useRSA(boolean value){ 
    	this.useRSA = value;
    	return this; 
    }
    public IServerConfiguration inverseRSA(boolean value){ 
    	this.inverseRSA = value;
    	return this; 
    }
    
}
