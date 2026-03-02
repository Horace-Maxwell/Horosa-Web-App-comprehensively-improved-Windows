package boundless.net;

/**
 * 发送缓存策略 
 */
public interface ISendBufferPolicy {
	
	/**
	 * 当缓存未溢出时加入缓存队列时执行
	 * @param newReader 正要加入缓存的数据
	 * @return false:把包丢弃
	 */
	default boolean onEnqueue(IPacketReader newReader){
		return true;
	}
	
	/**
	 * 当缓存未溢出时加入缓存队列时执行
	 * @param newWriter 正要加入缓存的数据
	 * @return false:把包丢弃
	 */
	default boolean onEnqueue(IPacketWriter newWriter){
		return true;
	}
	
	/**
	 * 缓存最大容量
	 * @return 0:无限
	 */
	default int maxCapacity(){
		return 0;
	}
	
	/**
	 * 当缓存溢出时执行
	 * @param newReader 正要加入缓存的数据
	 * @return false:把包丢弃
	 */
	default boolean onOverflow(IPacketReader newReader){
		return false;
	}
	
	/**
	 * 当缓存溢出时
	 * @param newWriter 正要加入缓存的数据
	 * @return false:把包丢弃
	 */
	default boolean onOverflow(IPacketWriter newWriter){
		return false;
	}
}
