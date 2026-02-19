package boundless.net.external;

public interface IServerConfiguration {
	/**
	 * 获得服务器编号
	 * @return
	 */
    short serverId();

    /**
     * 获得服务器名称
     * @return
     */
    String serverName();

    /**
     * 获得服务器类型
     * @return
     */
    byte serverType();

    /**
     * 获得服务器监听端口
     * @return
     */
    int port();

    /**
     * 是否允许端口复用
     * @return
     */
    default boolean isReuseAddress(){
    	return false;
    }

    /**
     * 获得服务器支撑的最大客户端数。0没限制
     * @return
     */
    default int maxClient(){
    	return 30000;
    }

    /**
     * 获得是否跟踪包
     * @return
     */
    default boolean trackPacket(){
    	return true;
    }
    
    default IServerConfiguration trackPacket(boolean value){
    	return this;
    }

    /**
     * 获得是否检查连接是否处于活动状态，即是否定时有发心跳包
     * @return
     */
    default boolean checkAlive(){
    	return true;
    }
    
    default int timeout(){
    	return 60;
    }
    
    default IServerConfiguration timeout(int n){
    	return this;
    }
    
    default public int boss(){
		return 0;
	}
	
    default public IServerConfiguration boss(int n){
		return this;
	}

    default public int worker(){
		return 0;
	}
	
    default public IServerConfiguration worker(int n){
		return this;
	}
    
    default public String decoderClass(){
    	return null;
    }
    
    default public String encoderClass(){
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
    
    default public String focusLoggerName(){
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
    default public void focusLoggerName(String value){}
    default public void errorLoggerName(String value){}
    
    default public boolean exceptionMsgReturn(){ return false; }
    default public IServerConfiguration exceptionMsgReturn(boolean value) { return this; }
    
    default public boolean closeOnException(){ return false; }
    default public IServerConfiguration closeOnException(boolean value) { return this; }
    
    default public String exceptionDatagram(){ return null; }
    default public IServerConfiguration exceptionDatagram(String classname){ return this; }
    
    default public int exceptionPacketId(){ return 0; }
    default public IServerConfiguration exceptionPacketId(int packetid){ return this; }
    
    default public IServerConfiguration udpPort(int port){ return this; }
    default public int udpPort() { return 0; }

    default public String broadAddr(){ return "255.255.255.255"; }

    default public String resType(){ return null; }
    default public IServerConfiguration resType(String type){ return this; }
    
    default public String udpLoggerName(){ return null; }
    default public void udpLoggerName(String value){}

    default public int taskThreshold(){ return 0; }
    default public IServerConfiguration taskThreshold(int value) { return this; }
    
    default public String rsaServerModulus(){ return null; }
    default public String rsaServerPublicExp(){ return null; }
    default public String rsaServerPrivateExp(){ return null; }
    default public String rsaClientModulus(){ return null; }
    default public String rsaClientPublicExp(){ return null; }
    default public boolean useRSA(){ return false; }
    default public boolean inverseRSA(){ return true; }
    
    default public IServerConfiguration rsaServerModulus(String value){ return this; }
    default public IServerConfiguration rsaServerPublicExp(String value){ return this; }
    default public IServerConfiguration rsaServerPrivateExp(String value){ return this; }
    default public IServerConfiguration rsaClientModulus(String value){ return this; }
    default public IServerConfiguration rsaClientPublicExp(String value){ return this; }
    default public IServerConfiguration useRSA(boolean value){ return this; }
    default public IServerConfiguration inverseRSA(boolean value){ return this; }
}
