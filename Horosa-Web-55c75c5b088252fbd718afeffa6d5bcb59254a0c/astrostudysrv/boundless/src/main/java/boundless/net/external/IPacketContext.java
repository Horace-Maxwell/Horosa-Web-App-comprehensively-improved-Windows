package boundless.net.external;

import boundless.log.*;
import boundless.net.*;

public interface IPacketContext<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
    /**
     * 是否跟踪包
     * @return
     */
    boolean trackPacket();

    /**
     * 获得日志对象
     * @return
     */
    Logger logger();
    
    /**
     * 创建包读取器
     * @param data
     * @return
     */
    T_PacketReader createReader(byte[] data);

    /**
     * 创建包事件对象
     * @param reader
     * @param client
     * @return
     */
    T_PacketEventArgs createEventArgs(T_PacketReader reader, T_Client client);
}
