package boundless.threading;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Map.Entry;
import java.util.concurrent.*;
import java.util.function.*;

import boundless.function.*;
import boundless.log.*;

/**
 * 断续器抽象线程
 *
 */
public class TickThread implements ITicker
{
	private static final Object EXIST_FLAG=new Object();
	
    private static Hashtable<Thread, TickThread> _tickerThreads = new Hashtable<Thread, TickThread>();

    /**
     * 所有的线程列表
     * @return
     */
    public static Entry<Thread, TickThread>[] threads()
    {
    	
    	Entry<Thread, TickThread>[] result=new Entry[_tickerThreads.size()];
    	_tickerThreads.entrySet().toArray(result);
    	return result;
    }

    //当闲置时触发
    private ConsumerDelegate<TickThread> _idleDelegate=new ConsumerDelegate<TickThread>();
    
    private ThreadProxy _proxy = null;
    private HashMap<ITicker, Object> _tickers = new HashMap<ITicker, Object>();
    private AsyncCallbackProcesser _asyncCallbackProcesser = new AsyncCallbackProcesser();
    private ThreadChannel _threadChannel = new ThreadChannel();
    private Logger _logger;

    //缓存要增加或移除的ticker。{Key:ticker,Value:true新增/false移除}
    private ConcurrentLinkedQueue<Entry<ITicker, Boolean>> _pendingTickers = new ConcurrentLinkedQueue<Entry<ITicker, Boolean>>();
    private int _sleepMilliseconds=1;
    private ITickAssistant _assistant;
    
    public TickThread()
    {
    	this(new DefaultTickAssistant());
    }

    public TickThread(ITickAssistant assistant)
    {
        this._assistant = assistant;
    }

    /**
     * 开启线程
     */
    public void start()
    {
        this._proxy = new ThreadProxy();
        this._proxy.start();
    }

    /**
     * 停止线程
     */
    public void stop()
    {
        this._proxy.stop();
        this._proxy = null;
        this._idleDelegate.clear();
    }

    public void restart()
    {
        if (this._proxy == null) return;
        try
        {
            this._proxy.interrupt();
        }
        catch (Throwable ex) { }
        this._proxy = null;

        start();
    }

    public void addOnIdle(Consumer<TickThread> ls){
    	_idleDelegate.add(ls);
    }
    
    public void removeOnIdle(Consumer<TickThread> ls){
    	_idleDelegate.remove(ls);
    }
    
    /**
     * 是否运行中
     * @return
     */
    public boolean isRunning()
    {
    	return _proxy!=null;
    }

    /**
     * 获得包含的Ticker数量
     * @return
     */
    public int tickerCount()
    {
    	return _pendingTickers.size() + _tickers.size();
    }

    protected void beginRun()
    {
    }

    protected void endRun()
    {
    }

    /**
     * 处理异步任务
     * @return
     */
    protected boolean processAsyncWorks()
    {
        boolean busy = false;
        if (processTickers()) busy=true;

        try
        {
            _asyncCallbackProcesser.tick();
            if (_asyncCallbackProcesser.isBusy()) busy = true;
        }
        catch (Throwable ex)
        {
            if (_logger != null) _logger.writeLog(ex);
        }

        if (_threadChannel.tick())busy=true;
        return busy;
    }

    /**
     * 注册成故事板
     */
    protected void registerStoryboard()
    {
        _tickerThreads.put(Thread.currentThread(),this);
    }

    /**
     * 注销故事板
     */
    protected void unregisterStoryboard()
    {
        _tickerThreads.remove(Thread.currentThread());
    }

    /**
     * 获得每次线程轮询的睡眠时间，单位毫秒
     * @return
     */
    public int sleepMilliseconds()
    {
        return _sleepMilliseconds;
    }
    /**
     * 设置每次线程轮询的睡眠时间，单位毫秒
     * @param value
     */
    public void sleepMilliseconds(int value){
    	this._sleepMilliseconds=value;
    }

    public void tick()
    {
    }

    /**
     * 增加断续器
     * @param ticker
     */
    public void addTicker(ITicker ticker)
    {
        _pendingTickers.add(new TickerEntry(ticker,true));
    }

    /**
     * 增加断续器
     * @param tickers
     */
    public void addTickerRange(ITicker[] tickers)
    {
        for (ITicker item : tickers)
        {
            addTicker(item);
        }
    }

    /**
     * 移除断续器
     * @param ticker
     */
    public void removeTicker(ITicker ticker)
    {
        if (ticker == null) return;
        _pendingTickers.add(new TickerEntry(ticker,false));
    }

    /**
     * 放入执行任务
     * @param work
     * 
     */
    public void queueWork(Supplier<Object> work)
    {
    	queueWork(work, null);
    }

    /**
     * 放入执行任务。
     * @param work 任务
     * @param callback 任务执行完的回调函数
     */
    public void queueWork(Supplier<Object> work, Consumer<Object> callback)
    {
        _threadChannel.queueWork(work, callback);
    }

    protected boolean processTickers()
    {
        boolean busy = false;
        Iterator<Entry<ITicker,Object>> iterator = _tickers.entrySet().iterator();
        while(iterator.hasNext())
        {
            busy = true;
            Entry<ITicker,Object> item=iterator.next();
            try
            {
            	item.getKey().tick();
            }
            catch (Throwable ex)
            {
                if (_logger != null) _logger.writeLog(ex);
            }
        }

        Entry<ITicker,Boolean> tickerItem;
        while ((tickerItem=_pendingTickers.poll())!=null)
        {
            if (tickerItem.getValue().booleanValue())
            {
                _tickers.put(tickerItem.getKey(),EXIST_FLAG);
                busy = true;
            }
            else _tickers.remove(tickerItem.getKey());
        }
        return busy;
    }

    /**
     * 获得当前断续器线程
     * @return
     */
    public static TickThread current()
    {
        return _tickerThreads.get(Thread.currentThread());
    }

    /**
     * 获得日志处理类
     * @return
     */
    public Logger logger()
    {
    	return _logger;
    }
    /**
     * 设置日志处理类
     * @param value
     */
    public void logger(Logger value){
    	this._logger = value;
        if (_asyncCallbackProcesser.logger() == null) _asyncCallbackProcesser.logger(value);
    }

    public ITickAssistant assistant()
    {
        return _assistant;
    }

    public long currentTimeMillis()
    {
    	return this.assistant().currentTimeMillis();
    }
    
    public LocalDateTime currentDateTime()
    {
    	return this.assistant().currentDateTime();
    }
    
    private class ThreadProxy implements Runnable
    {
        private Thread _thread = null;
        private boolean _active=false;

        /// <summary>
        /// 开启线程
        /// </summary>
        public void start()
        {
            this._thread = new Thread(this);
            this._thread.start();
        }

        /// <summary>
        /// 停止线程
        /// </summary>
        public void stop()
        {
            this._active = false;
            this._thread = null;
        }

        public void interrupt()
        {
            this._active = false;
            try
            {
                this._thread.interrupt();
            }
            catch (Throwable ex) { }
            this._thread = null;
        }

        @Override
        public void run()
        {
            this._active = true;
            _tickerThreads.put(Thread.currentThread(),TickThread.this);
            try
            {
                beginRun();
                execute();
                endRun();
            }
            finally
            {
                _tickerThreads.remove(Thread.currentThread());
            }
        }

        private void execute()
        {
            try
            {
                while (this._active)
                {
                    long beginMillis=System.currentTimeMillis();

                    try
                    {
                        tick();
                    }
                    catch (Throwable ex)
                    {
                        if (_logger != null) _logger.writeLog(ex);
                    }

                    boolean busy = false;
                    if (processAsyncWorks()) busy = true;

                    if (!busy) _idleDelegate.execute(TickThread.this);

                    long elapsedMillis=System.currentTimeMillis()-beginMillis;
                    long sleepMS = _sleepMilliseconds - elapsedMillis;
                    if (sleepMS < 0) sleepMS = 1;
                    int realSleep = _assistant.sleep((int)sleepMS);
                    _assistant.onTick(realSleep + elapsedMillis);
                }
            }
            catch (Throwable ex)
            {
            	ex.printStackTrace();
                execute();
            }
        }
    }
    
    private class TickerEntry implements Map.Entry<ITicker, Boolean>{
    	private ITicker _key;
    	private Boolean _value;
    	
    	public TickerEntry(ITicker key,boolean value){
    		this._key=key;
    		this._value=value;
    	}
    	
		@Override
		public ITicker getKey() {
			return _key;
		}

		@Override
		public Boolean getValue() {
			return _value;
		}

		@Override
		public Boolean setValue(Boolean arg0) {
			_value=arg0;
			return getValue();
		}
    	
    }
}

class DefaultTickAssistant implements ITickAssistant {
	public int sleep(int milliseconds) {
		try {
			Thread.sleep(milliseconds);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
		return milliseconds;
	}

	public void onTick(long milliseconds) {
	}

	public long currentTimeMillis() {
		return System.currentTimeMillis();
	}
	
	public LocalDateTime currentDateTime(){
		return LocalDateTime.now();
	}
}
