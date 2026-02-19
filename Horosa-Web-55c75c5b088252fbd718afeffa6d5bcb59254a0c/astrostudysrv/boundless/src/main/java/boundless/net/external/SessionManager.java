package boundless.net.external;

import java.util.*;
import java.util.function.Consumer;

import boundless.net.*;
import boundless.function.*;

/**
 * 客户端会话管理。线程安全
 *
 * @param <T_PacketReader>
 */
public class SessionManager<T_PacketReader extends IPacketReader> implements ISessionManager<T_PacketReader>
{
	private static final Object EXIST_FLAG=new Object(); 
	
    //创建新会话时的事件处理方法
    private ConsumerDelegate<ClientSession<T_PacketReader>> _addDelegate=new ConsumerDelegate<ClientSession<T_PacketReader>>();

    //移除会话时的事件处理方法
    public ConsumerDelegate<ClientSession<T_PacketReader>> _removeDelegate=new ConsumerDelegate<ClientSession<T_PacketReader>>();

    //{Key:连接ID,Value:会话对象}
    private Hashtable<Integer, ClientSession<T_PacketReader>> _sessionDic = new Hashtable<Integer, ClientSession<T_PacketReader>>();
    //{Key:包编号,Value:无作用}
    private HashMap<Integer,Object> _unsessionPacketIds = new HashMap<Integer,Object>();

    public ClientSession<T_PacketReader> getSession(int connectionId)
    {
        return _sessionDic.get(Integer.valueOf(connectionId));
    }

    public void addSession(ClientSession<T_PacketReader> session)
    {
    	_sessionDic.put(session.client().connectionId(),session);

        try
        {
            _addDelegate.execute(session);
        }
        catch (Exception ex)
        {
        	System.err.println("addSession error");
        	ex.printStackTrace();
        }

        try
        {
            EventCenter.publishLoginSuccessful(session.client());
        }
        catch (Exception ex)
        {
        	System.err.println("publishLoginSuccessful error");
        	ex.printStackTrace();
        }
    }

    public void removeSession(int connectionId)
    {
    	Integer key=Integer.valueOf(connectionId);
        if (!_sessionDic.containsKey(key)) return;
        ClientSession<T_PacketReader> session=_sessionDic.remove(connectionId);
        try
        {
            if (session != null ) _removeDelegate.execute(session);
        }
        catch (Exception ex)
        {
        	System.err.println("removeSession error");
        	ex.printStackTrace();
        }
    }

    /**
     * 注册不需要会话的包编号
     * 要在系统启动时，同个线程里被调用
     */
    public void registerUnsessionPacketId(int packetId)
    {
        _unsessionPacketIds.put(Integer.valueOf(packetId),EXIST_FLAG);
    }

    /**
     * 注销不需要会话的包编号
     * 要在系统启动时，同个线程里被调用
     * 
     * @param packetId
     */
    public void unregisterUnsessionPacketId(int packetId)
    {
        _unsessionPacketIds.remove(packetId);
    }

    public boolean validatePacketId(int connectionId, int packetId)
    {
        if (_unsessionPacketIds.containsKey(packetId)) return true;
        return getSession(connectionId) != null;
    }

    public void addOnAddSession(Consumer<ClientSession<T_PacketReader>> ls)
    {
        _addDelegate.add(ls);
    }

    public void removeOnAddSession(Consumer<ClientSession<T_PacketReader>> ls)
    {
    	_addDelegate.remove(ls);
    }

    public void addOnRemoveSession(Consumer<ClientSession<T_PacketReader>> ls)
    {
        _removeDelegate.add(ls);
    }

    public void removeOnRemoveSession(Consumer<ClientSession<T_PacketReader>> ls)
    {
    	_removeDelegate.remove(ls);
    }

    public ClientSession<T_PacketReader>[] sessions()
    {
    	ClientSession<T_PacketReader>[] result=new ClientSession[_sessionDic.size()];
        return this._sessionDic.values().toArray(result);
    }
}
