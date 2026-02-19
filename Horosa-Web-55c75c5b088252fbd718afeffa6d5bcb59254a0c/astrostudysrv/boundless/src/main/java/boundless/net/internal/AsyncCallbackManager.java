package boundless.net.internal;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Map.Entry;

import boundless.threading.TickThread;
import boundless.types.*;
import boundless.function.Consumer0;
import boundless.net.IDataReceiver;
import boundless.net.PacketType;
import boundless.net.external.*;

public class AsyncCallbackManager
{
//超时时间（秒）
private static final int TIME_OUT_SECONDS = (int)(0.5*60);

private GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> _packetManager;
private ResponseIdPool _resposeIdPool=new ResponseIdPool();
//key:packetID,value:{Key:responseID}
private HashMap<Integer, Hashtable<Short, CallBackItem>> _callbackDic = new HashMap<Integer, Hashtable<Short, CallBackItem>>();
private BitMarker _marker = new BitMarker(12000);
private java.util.Timer _timeoutTimer;

public AsyncCallbackManager(GenericPacketManager<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> packetManager)
{
    _packetManager = packetManager;

    _timeoutTimer = new java.util.Timer();
    _timeoutTimer.schedule(new TimerTask(){
    	@Override
    	public void run() {
    		checkTimeout();
    	}
    }, 30 *1000, 30 *1000);
}

/// <summary>
/// 轮询，找出超时回调方法并移除
/// </summary>
private void checkTimeout()
{
    Entry<Integer, Hashtable<Short, CallBackItem>>[] callItems=new Entry[_callbackDic.size()];

    synchronized (_marker)
    {
        _callbackDic.entrySet().toArray(callItems);
    }

    LocalDateTime nowTime=LocalDateTime.now();
    for (Entry<Integer, Hashtable<Short, CallBackItem>> dic : callItems)
    {
    	Enumeration<CallBackItem> iterator=dic.getValue().elements();
        while (iterator.hasMoreElements())
        {
        	CallBackItem item=iterator.nextElement();
            //已超时
            if (nowTime.isAfter(item.timeOut()))
            {
                dic.getValue().remove(item.responseId());
                _resposeIdPool.putbackResponseId(item.responseId());
                item.handleTimeout();
                System.err.println("回调超时，packetID="+dic.getKey()+",responseID="+item.responseId());
            }
        }
    }
}

public void sendAsync(IDataReceiver receiver, InternalPacketWriter ipw, IInternalPacketSender sender, PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> callback, Consumer0 timeoutCallback)
{
    if (sender == null) return;

    ipw.responseId(_resposeIdPool.getResponseId(ipw));
    ipw.packetType(PacketType.REQUEST);

    Hashtable<Short, CallBackItem> dic;

    synchronized (_marker)
    {
        int responsePacketId=ipw.packetId();
        if (!_marker.isSigned(responsePacketId))
        {
            dic = new Hashtable<Short, CallBackItem>();
            _callbackDic.put(responsePacketId,dic);
            _packetManager.dynamicRegisterHandler(responsePacketId, (e)->{receive(e);});
            _marker.sign(responsePacketId);
        }
        else
        {
            dic = _callbackDic.get(responsePacketId);
        }
    }

    if (callback != null) dic.put(ipw.responseId(),new CallBackItem(ipw.responseId(),callback, timeoutCallback));

    sender.send(receiver, ipw);
}

private void receive(InternalPacketEventArgs e)
{
    if (e.reader().packetType() != PacketType.RESPONSE) return;

    Hashtable<Short, CallBackItem> dic;

    synchronized (_marker)
    {
    	dic=_callbackDic.get(e.packetId());
    }

    if (dic == null) return;

    CallBackItem callback=dic.remove(e.reader().responseId());
    if (callback != null)
    {
        _resposeIdPool.putbackResponseId(e.reader().responseId());
        try
        {
            callback.handleSuccess(e);
        }
        catch (Throwable ex)
        {
        	ex.printStackTrace();
        }
    }
}

/**
 * 回调方法包装类
 *
 */
private class CallBackItem
{
    private short _responseId;
	private PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> _successHandler;
    private Consumer0 _timeoutHandler;
    private TickThread _callThread;
    private LocalDateTime _timeOut=LocalDateTime.now().plusSeconds(TIME_OUT_SECONDS);

    public CallBackItem(short responseId,PacketHandler<InternalPacketReader, TcpInternalChannel, InternalPacketEventArgs> successHandler, Consumer0 timeoutHandler)
    {
    	this._responseId=responseId;
        this._callThread = TickThread.current();
        this._successHandler = successHandler;
        this._timeoutHandler = timeoutHandler;
    }

    public short responseId(){
    	return _responseId;
    }
    
    public LocalDateTime timeOut() {
    	return _timeOut;
    }

    public void handleSuccess(InternalPacketEventArgs e)
    {
        if (_callThread == null) _successHandler.handle(e);
        _callThread.queueWork(()->
        {
        	_successHandler.handle(e);
            return true;
        });
    }

    public void handleTimeout()
    {
        if (_callThread == null && _timeoutHandler!=null) _timeoutHandler.accept();
        else if (_timeoutHandler != null)
        {
            _callThread.queueWork(()->
            {
            	_timeoutHandler.accept();
                return true;
            });
        }
    }
}

/**
 * 响应代码池
 *
 */
private class ResponseIdPool
{
    private ConcurrentIntPool _valPool = new ConcurrentIntPool(1000);

    public short getResponseId(InternalPacketWriter ipw)
    {
        return (short)_valPool.getValue();
    }

    public void putbackResponseId(short responseId)
    {
        _valPool.putback(responseId);
    }
}
}
