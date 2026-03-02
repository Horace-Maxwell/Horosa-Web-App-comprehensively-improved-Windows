package boundless.net.internal;

import java.util.*;

import boundless.net.*;
import boundless.net.external.*;
import boundless.threading.*;

/**
 * 单线程交互包管理器。在此类里注册的包处理器，在同一个线程里执行
 *
 */
public final class STAPacketManagerFactory
{
    private static HashMap<Object, Object> _managers = new HashMap<Object, Object>();
    private static ArrayList<ITicker> _tickers = new ArrayList<ITicker>();
    private static TickThread _workThread;

    /**
     * 建置
     * @return
     */
    public static ITicker[] build()
    {
        return new ITicker[] { new InnerTicker()};
    }

    /**
     * 注册包处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param server
     * @param packetId 包编号
     * @param handler 包处理器。在同个线程里执行
     */
    public static void registerHandler(TcpServer server, int packetId, PacketHandler<PacketReader, TcpChannel<PacketReader>, PacketEventArgs> handler)
    {
    	STAPacketManagerFactory.<PacketReader, TcpChannel<PacketReader>, PacketEventArgs>registerHandler(server, server.packetManager(), packetId, handler);
    }

    /**
     * 注册包处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param server
     * @param packetId 包编号
     * @param handler 包处理器。在同个线程里执行
     */
    public static void registerHandler(TcpInternalServer server,int packetId, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> handler)
    {
        registerHandler(server.packetManager(), packetId, handler);
    }

    /**
     * 注册包处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param client
     * @param packetId 包编号
     * @param handler 包处理器。在同个线程里执行
     */
    public static void registerHandler(TcpInternalClient client, int packetId, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> handler)
    {
        registerHandler(client.packetManager(), packetId, handler);
    }

    /**
     * 注册包处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param manager
     * @param packetId 包编号
     * @param handler 包处理器。在同个线程里执行
     */
    public static void registerHandler(GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> manager, int packetId, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> handler)
    {
    	STAPacketManagerFactory.<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs>registerHandler(manager, manager, packetId, handler);
    }

    /**
     * 清楚所有包处理器
     * @param manager
     */
    public static void clearHandlers(GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> manager)
    {
        _managers.remove(manager);
    }

    /**
     * 注册包处理器
     * @param target
     * @param targetManager
     * @param packetId 包编号
     * @param handler 包处理器
     */
    private static <T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>, T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader, T_Client>> void registerHandler(Object target,GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> targetManager, int packetId, PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs> handler)
    {
        STAPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> mgr = null;

        Object mgrObj = _managers.get(target);
        if (mgrObj!=null)
        {
            mgr = (STAPacketManager<T_PacketReader, T_Client, T_PacketEventArgs>)mgrObj;
        }

        if (mgrObj == null)
        {
            mgr = new STAPacketManager<T_PacketReader, T_Client, T_PacketEventArgs>();
            _managers.put(target,mgr);
            for(ITicker t:mgr.build(targetManager)) _tickers.add(t);
        }

        mgr.registerHandler(packetId, handler);
    }

    /// <summary>
    /// 获得工作线程
    /// </summary>
    public static TickThread workThread()
    {
        return _workThread;
    }

    private static class InnerTicker implements ITicker
    {
        public void tick()
        {
            if (_workThread == null) _workThread = TickThread.current();

            for (ITicker t : _tickers)
            {
                t.tick();
            }
        }
    }
}
