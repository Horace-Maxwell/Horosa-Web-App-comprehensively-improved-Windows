package boundless.netty;

import io.netty.channel.Channel;


interface Sessionable {
	public NettySession setupSession(ProcessorContext context, String sessionId);
	public NettySession addSession(Channel channel);
	public NettySession removeSession(Channel channel);
	public NettySession getSession(String sessionId);
	public String getSessionId(long clientAddr);
	public void markVeryActive(NettySession session);
	public void unmarkVeryActive(NettySession session);
	public NettySession[] getMostActiveSessions();
}
