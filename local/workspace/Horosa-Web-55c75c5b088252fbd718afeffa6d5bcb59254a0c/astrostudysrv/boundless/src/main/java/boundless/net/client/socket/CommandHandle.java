package boundless.net.client.socket;

import boundless.netty.Datagram;

public interface CommandHandle {
	public void accept(Datagram packet);
}
