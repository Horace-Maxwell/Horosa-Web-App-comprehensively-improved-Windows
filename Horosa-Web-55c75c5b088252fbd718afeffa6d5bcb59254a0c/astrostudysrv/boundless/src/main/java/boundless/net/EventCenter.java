package boundless.net;

import java.util.*;

public class EventCenter {
	private static Hashtable<Class,EventBranch> _branchHT = new Hashtable<Class,EventBranch>();

    /**
     * 发布登陆成功事件
     * @param client
     */
    public static <T_PacketReader extends IPacketReader> void publishLoginSuccessful(TcpChannel<T_PacketReader> client)
    {
    	EventCenter.<T_PacketReader>branch().publishLoginSuccessful(client);
    }

    /**
     * 发布登陆失败事件
     * @param client
     */
    public static <T_PacketReader extends IPacketReader> void publishLoginFail(TcpChannel<T_PacketReader> client)
    {
    	EventCenter.<T_PacketReader>branch().publishLoginFail(client);
    }

    /**
     * 发布包不存在事件
     * @param client
     */
    public static <T_PacketReader extends IPacketReader> void publishPacketNotFound(TcpChannel<T_PacketReader> client,IPacketReader reader)
    {
    	EventCenter.<T_PacketReader>branch().publishPacketNotFound(client,reader);
    }

    /**
     * 发布会话错误事件
     * @param client
     */
    public static <T_PacketReader extends IPacketReader> void publishSessionError(TcpChannel<T_PacketReader> client)
    {
    	EventCenter.<T_PacketReader>branch().publishSessionError(client);
    }

    /**
     * 发布自定义玩家错误事件
     * @param errorCode
     * @param client
     */
    public static <T_PacketReader extends IPacketReader> void publishCustomizeUserError(short errorCode, TcpChannel<T_PacketReader> client)
    {
    	EventCenter.<T_PacketReader>branch().publishCustomizeUserError(errorCode,client);
    }

    /**
     * 订阅登陆成功事件
     * @param handler
     */
    public static <T_PacketReader extends IPacketReader> void subscribeLoginSuccessful(UserEventHandler<T_PacketReader> handler)
    {
    	EventCenter.<T_PacketReader>branch().subscribeLoginSuccessful(handler);
    }

    /**
     * 订阅登陆失败事件
     * @param handler
     */
    public static <T_PacketReader extends IPacketReader> void subscribeLoginFail(UserEventHandler<T_PacketReader> handler)
    {
    	EventCenter.<T_PacketReader>branch().subscribeLoginFail(handler);
    }

    /**
     * 订阅包不存在事件
     * @param handler
     */
    public static <T_PacketReader extends IPacketReader> void subscribePacketNotFound(UserEventHandler<T_PacketReader> handler)
    {
    	EventCenter.<T_PacketReader>branch().subscribePacketNotFound(handler);
    }

    /**
     * 订阅会话错误事件
     * @param handler
     */
    public static <T_PacketReader extends IPacketReader> void subscribeSessionError(UserEventHandler<T_PacketReader> handler)
    {
    	EventCenter.<T_PacketReader>branch().subscribeSessionError(handler);
    }

    /**
     * 订阅会话错误事件
     * @param handler
     */
    public static <T_PacketReader extends IPacketReader> void subscribeCustomizeUserError(CustomizeUserErrorEventHandler<T_PacketReader> handler)
    {
    	EventCenter.<T_PacketReader>branch().subscribeCustomizeUserError(handler);
    }
    
    private static <T_PacketReader extends IPacketReader> EventBranch<T_PacketReader> branch(){
    	Class c=EventBranch.<T_PacketReader>type();
    	EventBranch branch=_branchHT.get(c);
    	if (branch==null){
    		branch=new EventBranch<T_PacketReader>();
    		_branchHT.put(c, branch);
    	}
    	return branch;
    }
}

class EventBranch<T_PacketReader extends IPacketReader> {
	public static <T_PacketReader extends IPacketReader> Class type(){
		EventBranch<T_PacketReader> branch=new EventBranch<T_PacketReader>(true);
		return branch.getClass();
	}
	
	private UserEventHandlerList<T_PacketReader> _loginSuccessfulHandlers = null;
    private UserEventHandlerList<T_PacketReader> _loginFailHandlers = null;
    private UserEventHandlerList<T_PacketReader> _packetNotFoundHandlers = null;
    private UserEventHandlerList<T_PacketReader> _sessionErrorHandlers = null;
    private CustomizeUserErrorEventHandlerList<T_PacketReader> _customizeErrorHandlers = null;

    public EventBranch(){
    	this(false);
    }
    
    private EventBranch(boolean empty){
    	if (empty) return;
    	
    	_loginSuccessfulHandlers = new UserEventHandlerList<T_PacketReader>();
        _loginFailHandlers = new UserEventHandlerList<T_PacketReader>();
        _packetNotFoundHandlers = new UserEventHandlerList<T_PacketReader>();
        _sessionErrorHandlers = new UserEventHandlerList<T_PacketReader>();
        _customizeErrorHandlers = new CustomizeUserErrorEventHandlerList<T_PacketReader>();
    }
    
    /**
     * 发布登陆成功事件
     * @param client
     */
    public void publishLoginSuccessful(TcpChannel<T_PacketReader> client)
    {
        _loginSuccessfulHandlers.execute(client,null);
    }

    /**
     * 发布登陆失败事件
     * @param client
     */
    public void publishLoginFail(TcpChannel<T_PacketReader> client)
    {
        _loginFailHandlers.execute(client,null);
    }

    /**
     * 发布包不存在事件
     * @param client
     */
    public void publishPacketNotFound(TcpChannel<T_PacketReader> client,IPacketReader reader)
    {
        _packetNotFoundHandlers.execute(client,reader);
    }

    /**
     * 发布会话错误事件
     * @param client
     */
    public void publishSessionError(TcpChannel<T_PacketReader> client)
    {
        _sessionErrorHandlers.execute(client,null);
    }

    /**
     * 发布自定义玩家错误事件
     * @param errorCode
     * @param client
     */
    public void publishCustomizeUserError(short errorCode, TcpChannel<T_PacketReader> client)
    {
        _customizeErrorHandlers.execute(errorCode, client);
    }

    /**
     * 订阅登陆成功事件
     * @param handler
     */
    public void subscribeLoginSuccessful(UserEventHandler<T_PacketReader> handler)
    {
        _loginSuccessfulHandlers.addHandler(handler);
    }

    /**
     * 订阅登陆失败事件
     * @param handler
     */
    public void subscribeLoginFail(UserEventHandler<T_PacketReader> handler)
    {
        _loginFailHandlers.addHandler(handler);
    }

    /**
     * 订阅包不存在事件
     * @param handler
     */
    public void subscribePacketNotFound(UserEventHandler<T_PacketReader> handler)
    {
        _packetNotFoundHandlers.addHandler(handler);
    }

    /**
     * 订阅会话错误事件
     * @param handler
     */
    public void subscribeSessionError(UserEventHandler<T_PacketReader> handler)
    {
        _sessionErrorHandlers.addHandler(handler);
    }

    /**
     * 订阅会话错误事件
     * @param handler
     */
    public void subscribeCustomizeUserError(CustomizeUserErrorEventHandler<T_PacketReader> handler)
    {
        _customizeErrorHandlers.addHandler(handler);
    }
}

class UserEventHandlerList<T_PacketReader extends IPacketReader>
{
    private ArrayList<UserEventHandler<T_PacketReader>> _handlers = new ArrayList<UserEventHandler<T_PacketReader>>();

    public void addHandler(UserEventHandler<T_PacketReader> handler)
    {
    	synchronized (_handlers)
        {
    		_handlers.add(handler);
        }
    }

    public void removeHandler(UserEventHandler<T_PacketReader> handler)
    {
    	synchronized (_handlers)
        {
    		_handlers.remove(handler);
        }
    }

    public void execute(TcpChannel<T_PacketReader> client,Object args)
    {
    	synchronized (_handlers)
        {
            for (UserEventHandler<T_PacketReader> h : _handlers)
            {
                h.handle(client,args);
            }
        }
    }
}

class CustomizeUserErrorEventHandlerList<T_PacketReader extends IPacketReader>
{
    private ArrayList<CustomizeUserErrorEventHandler<T_PacketReader>> _handlers = new ArrayList<CustomizeUserErrorEventHandler<T_PacketReader>>();

    public void addHandler(CustomizeUserErrorEventHandler<T_PacketReader> handler)
    {
    	synchronized (_handlers)
        {
    		_handlers.add(handler);
        }
    }

    public void removeHandler(CustomizeUserErrorEventHandler<T_PacketReader> handler)
    {
    	synchronized (_handlers)
        {
    		_handlers.remove(handler);
        }
    }

    public void execute(short errorCode,TcpChannel<T_PacketReader> client)
    {
    	synchronized (_handlers)
        {
            for (CustomizeUserErrorEventHandler<T_PacketReader> h : _handlers)
            {
                h.handle(errorCode,client);
            }
        }
    }
}
