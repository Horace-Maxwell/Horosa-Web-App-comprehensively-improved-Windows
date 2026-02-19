package boundless.net.internal;

import boundless.net.IDataReceiver;

/**
 * 输出数据过滤器
 *
 */
public interface IOutputFilter
{
	/**
	 * 过滤输出数据包
	 * @param receiver 接收者
	 * @param ipw 输出数据包
	 * @return true:过滤掉输出包，不进行输出
	 */
    boolean filter(IDataReceiver receiver,InternalPacketWriter ipw);
}
