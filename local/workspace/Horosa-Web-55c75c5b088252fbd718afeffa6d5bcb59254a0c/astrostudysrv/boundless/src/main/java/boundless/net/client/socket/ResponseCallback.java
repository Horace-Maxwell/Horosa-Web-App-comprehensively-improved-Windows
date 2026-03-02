package boundless.net.client.socket;

import boundless.netty.Datagram;

public interface ResponseCallback {
	public void callback(Datagram packet);
}
