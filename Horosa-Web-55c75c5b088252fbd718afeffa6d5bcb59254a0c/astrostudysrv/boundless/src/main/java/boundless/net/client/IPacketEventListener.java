package boundless.net.client;

import java.util.*;

public interface IPacketEventListener extends EventListener {
	/**
	 * 获得关注的包编号
	 * @return 小于0表示关注全部
	 */
	int getAttentionId();
	
	/**
	 * 收到包时触发
	 * @param e
	 */
	void recevie(PacketEvent e);
}
