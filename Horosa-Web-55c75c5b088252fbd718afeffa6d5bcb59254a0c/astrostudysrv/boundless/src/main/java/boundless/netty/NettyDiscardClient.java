package boundless.netty;

public class NettyDiscardClient extends NettyClient {
	
	public NettyDiscardClient(String servaddr, int port){
		super(servaddr, port, DiscardDecoder.class, null);
	}
	

}
