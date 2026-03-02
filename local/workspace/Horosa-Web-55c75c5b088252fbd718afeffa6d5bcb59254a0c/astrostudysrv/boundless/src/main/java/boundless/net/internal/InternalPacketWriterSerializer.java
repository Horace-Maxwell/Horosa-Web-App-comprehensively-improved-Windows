package boundless.net.internal;

import boundless.net.*;

/**
 * 可输出数据的序列化器,把可输出数据序列化成内部包写入器对象
 *
 */
public interface InternalPacketWriterSerializer {
	/**
	 * 序列化
	 * @param receiver
	 * @param output
	 * @return
	 */
    InternalPacketWriter[] serialize(IDataReceiver receiver,IOutputData output);
}
