package boundless.net.client;

import boundless.net.*;

public interface ITimeoutListener {
	/**
	 * trigger when timeout, currently only used in sending request to server synchronously
	 * @param pw a PacketWriter object who is sent to server, but timeout
	 * 		
	 */
	public void timeout(PacketWriter pw);
}
