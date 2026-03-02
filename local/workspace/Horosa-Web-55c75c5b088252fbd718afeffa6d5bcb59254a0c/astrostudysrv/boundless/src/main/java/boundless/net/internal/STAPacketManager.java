package boundless.net.internal;

import java.util.*;

import boundless.net.*;
import boundless.net.external.*;
import boundless.threading.*;

/**
 * 单线程交互包管理器。在此类里注册的包处理器，在同一个线程里执行
 *
 * @param <T_PacketReader>
 * @param <T_Client>
 * @param <T_PacketEventArgs>
 */
class STAPacketManager<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>, T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader, T_Client>>
{
    private GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> _manager;
    private HashMap<Integer, ArrayList<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>>> _handlers = new HashMap<Integer, ArrayList<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>>>();
    private PacketWorker _worker = null;
    private IPacketTransmitter<T_PacketReader, T_Client, T_PacketEventArgs> _transmitter = null;
    private TickThread _workThread=null;

    /**
     * 建置
     * @param manager
     * @return
     */
    public ITicker[] build(GenericPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> manager)
    {
        _manager=manager;
        _worker = new PacketWorker(this);
        _transmitter = new PacketTransmitter(_worker);
        return new ITicker[] { _worker };
    }

    /**
     * 注册包处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param packetId >包编号
     * @param handler 包处理器
     */
    public void registerHandler(int packetId, PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs> handler)
    {
        ArrayList<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>> hlList;
        hlList=_handlers.get(packetId);
        if (hlList==null)
        {
            hlList = new ArrayList<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>>();
            _handlers.put(packetId,hlList);
        }
        hlList.add(handler);

        _manager.registerTransmitter(packetId,_transmitter);
    }

    /// <summary>
    /// 处理包
    /// </summary>
    /// <param name="context">包环境</param>
    
    /**
     * 处理包
     * @param e
     */
    private void handle(T_PacketEventArgs e)
    {
        ArrayList<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>> handlers;
        handlers=_handlers.get(e.packetId());
        if (handlers!=null)
        {
            for (PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs> hl : handlers)
            {
                try
                {
                    e.reset();
                    hl.handle(e);
                }
                catch (Throwable ex)
                {
                    _manager.logger().writeLog(ex);
                }
            }
        }
    }

    public TickThread workThread()
    {
        return _workThread;
    }

    private class PacketWorker implements ITicker
    {
        private STAPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> _manager;
        private Queue<T_PacketEventArgs> _eventQueue = new LinkedList<T_PacketEventArgs>();

        public PacketWorker(STAPacketManager<T_PacketReader, T_Client, T_PacketEventArgs> manger)
        {
            this._manager = manger;
        }

        public void input(T_PacketEventArgs e)
        {
            synchronized (_eventQueue) {
            	_eventQueue.add(e);
            }
        }

        public void tick()
        {
            if (_workThread == null) _workThread = TickThread.current();

            while (true)
            {
                List<T_PacketEventArgs> list = new ArrayList<T_PacketEventArgs>();
                synchronized (_eventQueue)
                {
                    while (_eventQueue.size() > 0)
                    {
                        T_PacketEventArgs e=_eventQueue.poll();
                        if (e == null) break;
                        list.add(e);
                    }
                }
                if (list.size() == 0) break;
                for (T_PacketEventArgs e : list)
                {
                    this._manager.handle(e);    
                }
            }
        }
    }

    private class PacketTransmitter implements IPacketTransmitter<T_PacketReader, T_Client, T_PacketEventArgs>
    {
    	private PacketWorker _worker;

        public PacketTransmitter(PacketWorker worker)
        {
            this._worker = worker;
        }
        
        public boolean transmit(T_PacketEventArgs e)
        {
        	this._worker.input(e);
            return true;
        }
    }
}
