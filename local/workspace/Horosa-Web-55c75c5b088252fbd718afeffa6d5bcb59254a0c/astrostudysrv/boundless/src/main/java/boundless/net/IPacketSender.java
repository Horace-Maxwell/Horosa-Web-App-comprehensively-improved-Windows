package boundless.net;

public interface IPacketSender {
	void sendAsync(IDataReceiver receiver, IPacketWriter pw);
    void sendAsync(IPacketReader reader);
    void output(IDataReceiver receiver, IOutputData output);
    
    /**
     * 清除未发送的数据
     */
    void clearBuffer();
    
    /**
     * 设置发送缓存策略
     * @param value
     */
    void bufferPolicy(ISendBufferPolicy value);
}
