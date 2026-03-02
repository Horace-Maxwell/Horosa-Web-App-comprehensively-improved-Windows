package boundless.netty;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;

public interface Server extends Broadcast {
	public int port();
	public void broadcast(Function<Object, Datagram> fun);
	public int countConnection();
	public int countRunning();
	public List<Object> getAttachList();
	public void treatAttach(Consumer<Object> consumer);
	public NettySession[] getMostActiveSessions();
	public NettySession getSession(String sessionId);
	public NettySession[] getAllSessions();
	public Logger log();
	
	default public Logger focusLog(){
		return log();
	}
	
	default public Long[] getAllClientAddress(){
		return new Long[0];
	}
}
