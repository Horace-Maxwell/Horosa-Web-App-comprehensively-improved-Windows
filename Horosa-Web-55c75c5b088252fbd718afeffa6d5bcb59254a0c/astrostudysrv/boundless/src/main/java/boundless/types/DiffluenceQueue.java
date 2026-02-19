package boundless.types;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Date;
import java.util.Objects;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;

import boundless.function.ConsumerDelegate;
import boundless.log.Logger;


/**
 * 分流队列，该类的对象会把队列里元素分流给多个并行线程处理.<br>
 * 例如游服把资料上传到游戏平台，游服后台统一把要上传的数据放入队列，然后会并行几个工作线程上传到平台上，
 *
 */
public class DiffluenceQueue<T extends DiffluenceQueue.IDiffluenceQueueItem> {
	/**
	 * 在放入队列时触发。参数:数据项
	 */
	private ConsumerDelegate<T> onEnqueue = new ConsumerDelegate<T>();
	
	/**
	 * 在被工作线程成功处理完后触发。参数:数据项
	 */
	private ConsumerDelegate<T> onSuccess = new ConsumerDelegate<T>();
	
	/**
	 * 在被工作线程处理失败时触发。参数:数据项
	 */
	private ConsumerDelegate<T> onFail;

    private Semaphore _sem = new Semaphore(0);
    private ConcurrentLinkedQueue<T> _innerQueue = new ConcurrentLinkedQueue<T>();
    private IDiffluenceQueueAssistant<T> _assistant;
    private WorkThread[] _workThreads;
    private ExceptionWorkThread _exceptionWorkThread;
    private Timer _doctorTimer;
    private int _maxLength = 0;
    private Logger _errorLogger;

    /**
     * 
     * @param threadCount 线程数量
     * @param workFunc 逻辑功能,参数:要处理的数据项,返回:每个数据项的处理结果,true表示成功
     * @param threadRigescentSeconds 检测线程僵死时间，单位秒
     * @param bufferCount 每个线程缓存记录的笔数
     * @param bufferSeconds 每个线程缓存记录的最大时间，单位秒
     */
    public DiffluenceQueue(IDiffluenceQueueAssistant<T> assistant){
    	this._assistant=assistant;
    	
        this._exceptionWorkThread = new ExceptionWorkThread(this);
        this._workThreads = new WorkThread[assistant.threadCount()+1];
        this._workThreads[0] = this._exceptionWorkThread;
        for (int i = 0; i < this._workThreads.length - 1; i++)
        {
            this._workThreads[i+1] = new NormalWorkThread(this);
        }
    }
    
    /**
     * 入分流队列时的事件处理
     * @param delegate 事件处理函数
     */
    public void addOnEnqueue(Consumer<T> delegate){
    	this.onEnqueue.add(delegate);
    }

    /**
     * 工作逻辑处理队列中的数据如果成功，则调用此回调函数
     * @param delegate 事件处理函数
     */
    public void addOnSuccess(Consumer<T> delegate){
    	this.onSuccess.add(delegate);
    }

    /**
     * 工作逻辑处理队列中的数据如果失败后，则调用此回调函数
     * @param delegate 事件处理函数
     */
    public void addOnFail(Consumer<T> delegate){
    	this.onFail.add(delegate);
    }

    /**
     * 获得队列的最大长度。小于等于0表示不限
     * 
     * @return
     */
    public int getMaxLength(){
    	return _maxLength;
    }
    
    /**
     * 设置队列的最大长度。小于等于0表示不限
     * 当队列已达最大长度时，新放入的数据项被丢弃
     * @param len
     */
    public void setMaxLength(int len){
    	_maxLength = len;
    }
    
    /**
     * 获取记录错误的日志对象
     * @return
     */
    public Logger getErrorLogger(){
    	return _errorLogger;
    }
	
    /**
     * 设置记录错误的日志对象
     * @param logger
     */
    public void setErrorLogger(Logger logger){
    	_errorLogger = logger;
    }
    
    
    public void enqueue(T item)
    {
        if (getMaxLength() > 0 && _innerQueue.size() + _exceptionWorkThread.size() >= getMaxLength())
        {
            if (getErrorLogger() != null) getErrorLogger().writeLog("分流队列已达最大长度，新放入的数据项被丢弃");
            return;
        }
        if (onEnqueue != null) onEnqueue.execute(item);
        _innerQueue.add(item);
        _sem.release();
    }
 
    /**
     * 开始运行
     */
    public void start()
    {
        if (_doctorTimer != null) return;

        for (int i = 0; i < this._workThreads.length; i++)
        {
            this._workThreads[i].start();
        }

        TimerTask task = new TimerTask(){
			@Override
			public void run() {
				for(WorkThread w : _workThreads){
	                try
	                {
	                    if (!w.isAlive()) w.restart();
	                }
	                catch (Exception ex)
	                {
	                    System.out.println(ex.getMessage());
	                }					
				}
			}        	
        };
        _doctorTimer = new Timer();
        _doctorTimer.schedule(task, 1000, 1000);
    }

    /**
     * 结束运行
     */
    public void stop()
    {
        _doctorTimer.cancel();
        _doctorTimer = null;

        for (int i = 0; i < this._workThreads.length; i++)
        {
            this._workThreads[i].stop(null);
        }
    }

    
    private void writeLog(Exception ex)
    {
        if (getErrorLogger() != null) getErrorLogger().writeLog(ex);
    }
    
    
	/**
	 * 分流队列数据项
	 * @author zjf
	 *
	 */
	public interface IDiffluenceQueueItem {
		Object itemType();
		boolean noDelay();
	}
	
	
	/**
	 * 工作线程
	 * @author zjf
	 *
	 */
	private static abstract class WorkThread {
		private Thread _t = null;
		private boolean _active = false;
		
        public void start()
        {
            if (this._t != null) return;
            this._t = new Thread(()->{
            	run();
            });
            this._active = true;
            this._t.start();
        }

        public void stop(Object stateInfo)
        {
            if (this._t == null) return;
            this._active = false;
            try
            {
                this._t = null;
            }
            catch (Exception ex) { }
            this._t = null;
        }

        public void restart()
        {
            stop("线程僵死被重启");
            start();
        }

        /**
         * 是否活着，防止down住
         * @return
         */
        public abstract boolean isAlive();

        private void run()
        {
            while (this._active)
            {
                try
                {
                    int sleepMilliseconds = tick();
                    if (sleepMilliseconds > 0) Thread.sleep(sleepMilliseconds);
                }
                catch (Exception ex)
                {
                    try {
						Thread.sleep(3000);
					} catch (InterruptedException e) {
						e.printStackTrace();
					}
                }
            }
        }
		
        /**
         * 睡眠时间，单位毫秒
         * @return
         */
        protected abstract int tick();
	}
	
	/**
	 * 正常工作线程
	 * @author zjf
	 *
	 */
	private class NormalWorkThread extends WorkThread {
        private static final int TIMEOUT_MINUTES = 2;

        private DiffluenceQueue<T> _queue;
        private List<T> _buffers = new ArrayList<T>();
        //是否正在执行逻辑功能
        private boolean _executingWorkFunc = false;
        //执行时间
        private Date _executeTime = new Date();
        private Date _timeoutTime = null;

        public NormalWorkThread(DiffluenceQueue<T> queue)
        {
            this._queue = queue;
        }

		@Override
		public boolean isAlive() {
            if (!_executingWorkFunc) return true;
            if (_queue._assistant.threadRigescentSeconds() <= 0) return true;
            Date curr = new Date();
            long delta = curr.getTime() - _executeTime.getTime();
            long totalSeconds = delta / 1000;
            if (totalSeconds > _queue._assistant.threadRigescentSeconds()) return false;
            return true;
		}

		@Override
		protected int tick() {
            boolean state = false;
            if (_buffers.size() == 0){
            	try {
					_queue._sem.acquire();
	            	state = true;
				} catch (InterruptedException e) {
					e.printStackTrace();
					state = false;
				}
            }else{
            	try {
					state = _queue._sem.tryAcquire(_queue._assistant.bufferSeconds() * 1000, TimeUnit.MILLISECONDS);
				} catch (InterruptedException e) {
					e.printStackTrace();
					state = false;
				}
            }

            if (_buffers.size() == 0 && !state) return 1000;

            if (state)
            {
                if (_timeoutTime == null){
                	Calendar cal = Calendar.getInstance();
                	cal.add(Calendar.MINUTE, TIMEOUT_MINUTES);
                	_timeoutTime = cal.getTime();
                }
                T item = _queue._innerQueue.poll();
                if (item != null)
                {
                    _buffers.add(item);
                    Date curr = new Date();
                    if (curr.getTime() < _timeoutTime.getTime() && !item.noDelay() && _buffers.size() < _queue._assistant.bufferCount()) 
                    	return 0;
                }
            }
            if (_buffers.size() == 0) return 1000;

            T[] items = _queue._assistant.newArray(_buffers.size());
        	_buffers.toArray(items);

            _executeTime = new Date();
            _executingWorkFunc = true;
            boolean[] states = null;
            try
            {
                states = _queue._assistant.workFunc().apply(items);
            }
            catch (Exception ex)
            {
                _queue.writeLog(ex);
            }
            finally
            {
                _executingWorkFunc = false;
                _executeTime = new Date();
                _buffers.clear();
            }

            for (int i = 0; i < items.length; i++)
            {
                //失败放到异常线程里处理
                if (states == null || states.length <= i || !states[i])
                {
                    _queue._exceptionWorkThread.enqueue(items[i]);
                    if (_queue.onFail != null) _queue.onFail.execute(items[i]);
                    continue;
                }

                try
                {
                    if (_queue.onSuccess != null) _queue.onSuccess.execute(items[i]);
                }
                catch (Exception ex)
                {
                    _queue.writeLog(ex);
                }
            }

            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.MINUTE, TIMEOUT_MINUTES);
            _timeoutTime = cal.getTime();

            return 0;
		}
		
	}
	
	/**
	 * 异常工作线程
	 * @author zjf
	 *
	 */
	private class ExceptionWorkThread extends WorkThread {
        private DiffluenceQueue<T> _queue;
        private Object _are = new Object();
        private ConcurrentHashMap<Object, ConcurrentLinkedQueue<T>> _queueDic = new ConcurrentHashMap<Object, ConcurrentLinkedQueue<T>>();
        private Integer _balanceItemCount = 0;
        //是否正在执行逻辑功能
        private boolean _executingWorkFunc = false;
        //执行时间
        private Date _executeTime = new Date();

        public ExceptionWorkThread(DiffluenceQueue<T> queue)
        {
            this._queue = queue;
        }

        /**
         * 是否活着，防止down住
         * @return
         */
        @Override
        public boolean isAlive()
        {
            if (!_executingWorkFunc) return true;
            if (_queue._assistant.threadRigescentSeconds() <= 0) return true;
            Date curr = new Date();
            long delta = curr.getTime() - _executeTime.getTime();
            long totalSeconds = delta / 1000;
            if (totalSeconds > _queue._assistant.threadRigescentSeconds()) return false;
            return true;
        }

        public int size()
        {
            return _balanceItemCount;
        }

        public void enqueue(T item)
        {
            privateEnqueue(item, false);
        }

        private void privateEnqueue(T item, boolean force)
        {
            if (!force && _balanceItemCount >= _queue.getMaxLength()) return;

            ConcurrentLinkedQueue<T> queue;

            synchronized (this)
            {
            	queue = _queueDic.get(item.itemType());
                if (queue == null)
                {
                    queue = new ConcurrentLinkedQueue<T>();
                    _queueDic.put(item.itemType(), queue);
                }
            }

            queue.add(item);
            if (!force) {
            	synchronized(_balanceItemCount){
            		_balanceItemCount++;
            	}
            }

            _are.notify();
        }

        @Override
        protected int tick()
        {
            try {
				_are.wait();
			} catch (Exception e) {
				return 1000;
			}
            for (ConcurrentLinkedQueue<T> q : _queueDic.values())
            {
                executeQueue(q);
            }
            return 1000;
        }

        private void executeQueue(ConcurrentLinkedQueue<T> queue)
        {
            List<T> itemList = new ArrayList<T>();
            T item = queue.poll();

            while (item != null)
            {
                itemList.add(item);
                if (itemList.size() >= _queue._assistant.bufferCount())
                {
                	T[] items=_assistant.newArray(itemList.size());
                	itemList.toArray(items);
                    executeItems(items);
                    itemList.clear();
                }
            }

            if (itemList.size() > 0) {
            	T[] items=_assistant.newArray(itemList.size());
            	itemList.toArray(items);
            	executeItems(items);
            }
        }

        private void executeItems(T[] items)
        {
            _executeTime = new Date();
            _executingWorkFunc = true;
            boolean[] states = null;
            try
            {
                states = _queue._assistant.workFunc().apply(items);
            }
            catch (Exception ex)
            {
                _queue.writeLog(ex);
            }
            finally
            {
                _executingWorkFunc = false;
                _executeTime = new Date();
            }

            for (int i = 0; i < items.length; i++)
            {
                //失败重新放回队列
                if (states == null || states.length <= i || !states[i])
                {
                    privateEnqueue(items[i], true);
                    if (_queue.onFail != null) _queue.onFail.execute(items[i]);
                    continue;
                }

                synchronized(_balanceItemCount){
                	_balanceItemCount++;
                }

                try
                {
                    if (_queue.onSuccess != null) _queue.onSuccess.execute(items[i]);
                }
                catch (Exception ex)
                {
                    _queue.writeLog(ex);
                }
            }
        }
	}
	
	/**
	 * 助手，提供各种控制参数 
	 * @param <T>
	 */
	public static interface IDiffluenceQueueAssistant<T extends IDiffluenceQueueItem> {
    	/**
    	 * 线程数量
    	 * @return
    	 */
		int threadCount();
		
		/**
		 * 逻辑功能,参数:要处理的数据项,返回:每个数据项的处理结果,true表示成功
		 * @return
		 */
    	Function<T[],boolean[]> workFunc();
    	
    	/**
    	 * 检测线程僵死时间，单位秒
    	 * @return
    	 */
    	int threadRigescentSeconds();
    	
    	/**
    	 * 每个线程缓存记录的笔数
    	 * @return
    	 */
    	int bufferCount();
    	
    	/**
    	 * 每个线程缓存记录的最大时间，单位秒
    	 * @return
    	 */
    	int bufferSeconds();
    	
    	/**
    	 * 生成数组
    	 * @param size
    	 * @return
    	 */
    	T[] newArray(int size);
    }
	
	public static abstract class AbstractDiffluenceQueueAssistant<T extends IDiffluenceQueueItem> implements IDiffluenceQueueAssistant<T>{
		private int _threadCount=2; 
		private Function<T[],boolean[]> _workFunc;
		private int _threadRigescentSeconds=60;
		private int _bufferCount=200;
		private int _bufferSeconds=30;
    	
		public AbstractDiffluenceQueueAssistant(Function<T[], boolean[]> workFunc) {
			Objects.requireNonNull(workFunc, "逻辑功能参数不能为空");
			this._workFunc=workFunc;
		}
		
		public int threadCount(){
    	  return _threadCount;
    	}
		public void threadCount(int value){
	      _threadCount=value;
	    }
		
    	public Function<T[],boolean[]> workFunc(){
    		return _workFunc;
    	}
        public void workFunc(Function<T[],boolean[]> value){
    		_workFunc=value;
    	}
    	
    	public int threadRigescentSeconds(){
    		return _threadRigescentSeconds;
    	}
        public void threadRigescentSeconds(int value){
        	_threadRigescentSeconds=value;
    	}
    	
    	public int bufferCount(){
    		return _bufferCount;
    	}
        public void bufferCount(int value){
        	_bufferCount=value;
    	}
    	
    	public int bufferSeconds(){
    		return _bufferSeconds;
    	}
        public void bufferSeconds(int value){
    		_bufferSeconds=value;
    	}
        
        public abstract T[] newArray(int size);
    }
}
