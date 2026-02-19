package boundless.netty;


public interface IBroadcastConfig {
	public int serverType();
	public int broadcastId();
	public String broadcastName();
	default public String broadcastAddress(){ return "255.255.255.255"; }
	public int broadcastPort();
	public boolean trackPacket();
	
	public void serverType(int value);
	public void broadcastName(String name);
	public void broadcastAddress(String addr);
	public void broadcastPort(int port);
	public void trackPacket(boolean value);
	public void broadcastId(int id);
	
	
    default public int worker(){
		return 0;
	}
	
    default public void worker(int n){
	}
    
    default public String encoderClass(){
    	return null;
    }
    
    default public String decoderClass(){
    	return null;
    }
    
    default public String initPluginClass(){
    	return null;
    }
    
    default public String periodTaskClass(){
    	return null;
    }
    
    default public String loggerName(){
    	return null;
    }
    
    default public String errorLoggerName(){
    	return null;
    }

    default public void encoderClass(String value){}
    default public void decoderClass(String value){}
    default public void initPluginClass(String value){}
    default public void periodTaskClass(String value){}
    default public void loggerName(String value){}
    default public void errorLoggerName(String value){}
    
    default public boolean exceptionMsgReturn(){ return false; }
    default public IBroadcastConfig exceptionMsgReturn(boolean value) { return this; }
    
    default public boolean closeOnException(){ return false; }
    default public IBroadcastConfig closeOnException(boolean value) { return this; }
    
    default public String exceptionDatagram(){ return null; }
    default public IBroadcastConfig exceptionDatagram(String classname){ return this; }
    
    default public int exceptionPacketId(){ return 0; }
    default public IBroadcastConfig exceptionPacketId(int packetid){ return this; }
    
    default public int taskThreshold(){
    	return 0;
    }
    default public IBroadcastConfig taskThreshold(int value){ return this; }
    
    default public String rsaServerModulus(){ return null; }
    default public String rsaServerPublicExp(){ return null; }
    default public String rsaServerPrivateExp(){ return null; }
    default public String rsaClientModulus(){ return null; }
    default public String rsaClientPublicExp(){ return null; }
    default public boolean useRSA(){ return false; }
    default public boolean inverseRSA(){ return true; }
    
    default public IBroadcastConfig rsaServerModulus(String value){ return this; }
    default public IBroadcastConfig rsaServerPublicExp(String value){ return this; }
    default public IBroadcastConfig rsaServerPrivateExp(String value){ return this; }
    default public IBroadcastConfig rsaClientModulus(String value){ return this; }
    default public IBroadcastConfig rsaClientPublicExp(String value){ return this; }
    default public IBroadcastConfig useRSA(boolean value){ return this; }
    default public IBroadcastConfig inverseRSA(boolean value){ return this; }
    
}
