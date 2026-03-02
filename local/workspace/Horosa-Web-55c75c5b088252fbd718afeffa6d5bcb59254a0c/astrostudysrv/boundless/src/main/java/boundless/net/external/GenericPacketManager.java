package boundless.net.external;

import java.util.*;

import boundless.log.*;
import boundless.net.*;
import boundless.utility.ConvertUtility;

public class GenericPacketManager<T_PacketReader extends IPacketReader, T_Client extends TcpChannel<T_PacketReader>,T_PacketEventArgs extends GenericPacketEventArgs<T_PacketReader,T_Client>>{
	//静态包处理函数列表，在系统启动时就确定下来的，在系统运行中不会动态增加，所以采用线程不安全的结构即可。{Key:包编号,Value:处理函数列表}
    private HashMap<Integer, List<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>>> _handlers = new HashMap<Integer, List<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>>>();
    //动态包处理函数列表，在系统运行中会动态增加，所以采用线程安全的结构。{Key:包编号,Value:处理函数}
    private Hashtable<Integer, PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>> _dynamicHandlers = new Hashtable<Integer, PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>>();

    private HashMap<Integer, IPacketTransmitter<T_PacketReader, T_Client, T_PacketEventArgs>> _transimitters = new HashMap<Integer, IPacketTransmitter<T_PacketReader, T_Client, T_PacketEventArgs>>();
    private List<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>> _defaultHandlers = new ArrayList<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>>();
    private RequestPacketFilterChain<T_PacketReader, T_Client, T_PacketEventArgs> _filterChain = null;
    private IPacketContext<T_PacketReader, T_Client, T_PacketEventArgs> _context;

    public GenericPacketManager(IPacketContext<T_PacketReader, T_Client, T_PacketEventArgs> context)
    {
        this._filterChain = new RequestPacketFilterChain<T_PacketReader, T_Client, T_PacketEventArgs>(this);
        this._context = context;
    }

    /**
     * 注册默认的包处理器。当根据包代码找不到对应包处理器时，会调用默认的包处理器处理包
     * 要在系统启动时，同个线程里被调用
     * 
     * @param handler 逻辑处理方法。在并发环境里执行
     */
    public void registerDefaultHandler(PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs> handler)
    {
        if (!this._defaultHandlers.contains(handler)) this._defaultHandlers.add(handler);
    }

    /**
     * 注册非响应包的处理器
     * 要在系统启动时，同个线程里被调用
     * 
     * @param packetId 包编号
     * @param handler 包处理器。如果旧的已存在,则会往后添加。在并发环境里执行
     */
    public void registerHandler(int packetId, PacketHandler<T_PacketReader,T_Client,T_PacketEventArgs> handler)
    {
        List<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>> hlList=_handlers.get(packetId);
        if (hlList==null) {
            hlList = new ArrayList<PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs>>();
            _handlers.put(packetId, hlList);
        }
        hlList.add(handler);
    }

    /**
     * 在系统运行过程中动态注册包处理器。线程安全
     * @param packetId 包编号
     * @param handler 包处理器。如果旧的已存在会把旧的覆盖。在并发环境里执行
     */
    public void dynamicRegisterHandler(int packetId, PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs> handler)
    {
        _dynamicHandlers.put(packetId,handler);
    }

    /**
     * 处理包
     * @param e
     * @return false:找不到处理器
     */
    boolean handle(T_PacketEventArgs e)
    {
    	boolean exist = false;

        if (e.reader().packetType() != PacketType.RESPONSE)
        {
            List<PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs>> constHandlers=_handlers.get(e.packetId());
            if (constHandlers!=null)
            {
                exist = true;
                for (PacketHandler<T_PacketReader, T_Client, T_PacketEventArgs> hl : constHandlers)
                {
                    e.reset();
                    hl.handle(e);
                }
            }
        }

        PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs> dynamicHandler=_dynamicHandlers.get(e.packetId());
        if (dynamicHandler!=null)
        {
            exist = true;
            e.reset();
            dynamicHandler.handle(e);
        }

        if (exist)
        {
            e.consume();
            return true;
        }

        for (PacketHandler<T_PacketReader, T_Client,T_PacketEventArgs> hl : _defaultHandlers)
        {
            exist = true;
            e.reset();
            hl.handle(e);
        }

        if (exist) e.consume();

        return exist;
    }

    /**
     * 提交包
     * @param e
     */
    public void post(T_PacketEventArgs e)
    {
        if (e.reader().packetType() != PacketType.RESPONSE)
        {
            if (transmit(e))
            {
                e.consume();
                return;
            }
        }
        this.handle(e);
    }

    /**
     * 注册包转发器。要在系统启动时，同个线程里被调用
     * @param packetId 包编号
     * @param transmitter 包转发器。在并发环境里执行
     */
    public void registerTransmitter(int packetId, IPacketTransmitter<T_PacketReader,T_Client,T_PacketEventArgs> transmitter)
    {
        _transimitters.put(packetId,transmitter);
    }

    /**
     * 获得包转发器
     * @param packetId
     * @return
     */
    public IPacketTransmitter<T_PacketReader, T_Client,T_PacketEventArgs> getTransmitter(int packetId)
    {
        return _transimitters.get(packetId);
    }

    /**
     * 转发包
     * @param e
     * @return 是否转发成功
     */
    private boolean transmit(T_PacketEventArgs e)
    {
        IPacketTransmitter<T_PacketReader, T_Client,T_PacketEventArgs> transmitter = getTransmitter(e.packetId());
        if (transmitter != null)
        {
            return transmitter.transmit(e);
        }
        return false;
    }

    /**
     * 增加包在处理前的过滤器。过滤器可以用于拦截请求包
     * 要在系统启动时，同个线程里被调用
     * 
     * @param filter 在并发环境里执行
     */
    public void addBeforeFilter(IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs> filter)
    {
        _filterChain.addBeforeFilter(filter);
    }

    /**
     * 增加包在处理后的过滤器。过滤器可以用于拦截请求包
     * 要在系统启动时，同个线程里被调用
     * 
     * @param filter 在并发环境里执行
     */
    public void addAfterFilter(IRequestPacketFilter<T_PacketReader, T_Client, T_PacketEventArgs> filter)
    {
        _filterChain.addAfterFilter(filter);
    }

    public void Close()
    {
    }

    /**
     * 获得日志对象
     * @return
     */
    public Logger logger()
    {
    	return _context.logger();
    }

    /**
     * 处理接收到的包
     * @param client
     * @param reader
     */
    public void receive(T_Client client, T_PacketReader reader)
    {
        if (reader == null) return;
        if (_context.logger() != null && _context.trackPacket())
        {
            _context.logger().writeLog("Receive Packet, Id:"+reader.packetId()+",client:"+client.description()+",size:"+reader.length()+",receive time:"+DateTimeFormatUtility.currentTime());
            if(Logger.isDebug) _context.logger().writeLog("Packet data: " + ConvertUtility.getValueAsString(reader.inputData()));
        }

        T_PacketEventArgs eventArgs = null;

        try
        {
            eventArgs = _context.createEventArgs(reader, client);
        }
        catch (Exception ex)
        {
            if (_context.logger() != null) _context.logger().writeLog("反序列化包错误,Packet Id:" + reader.packetId(), ex);
            return;
        }

        try
        {
            _filterChain.execute(eventArgs);
        }
        catch (Exception ex)
        {
            if (_context.logger() != null) _context.logger().writeLog("提交包错误,Packet Id:" + reader.packetId(), ex);
            return;
        }
    }
    
    public IPacketContext<T_PacketReader, T_Client, T_PacketEventArgs> context(){
    	return _context;
    }
}