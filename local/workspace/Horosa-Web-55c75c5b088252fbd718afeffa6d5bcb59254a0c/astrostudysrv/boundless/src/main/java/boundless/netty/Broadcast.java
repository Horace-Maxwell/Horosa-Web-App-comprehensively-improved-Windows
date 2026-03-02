package boundless.netty;

public interface Broadcast {
	public void broadcast(Datagram data);
	public void close();	
}
