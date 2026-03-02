package boundless.threading;

import java.util.concurrent.*;
import java.util.function.*;

/**
 * 线程信道。此信道用于线程间互相安全地并发执行方法
 *
 */
public class ThreadChannel
{
    private ConcurrentLinkedQueue<AsyncThreadWork> _workQueue = new ConcurrentLinkedQueue<AsyncThreadWork>();

    /**
     * 放入执行任务。
     * @param work 任务
     * @param callback 任务执行完的回调函数
     */
    public void queueWork(Supplier<Object> work, Consumer<Object> callback)
    {
    	AsyncThreadWork context = new AsyncThreadWork(work, callback);
        _workQueue.add(context);
    }

    /**
     * 移出并获得队列的头个并发执行环境
     * @return
     */
    AsyncThreadWork dequeueWork()
    {
    	return _workQueue.poll();
    }

    private boolean internalProcessWorks()
    {
    	boolean busy = false;
        while (true)
        {
        	AsyncThreadWork context = this.dequeueWork();
            if (context == null) break;
            busy = true;
            context.execute();
        }
        return busy;
    }

    boolean tick()
    {
        boolean busy = false;
        if (internalProcessWorks()) busy=true;
        return busy;
    }
}

class AsyncThreadWork
{
    private Supplier<Object> _work;
    private AsyncCallbackProcesser _callbackProcesser = null;
    private Consumer<Object> _callback;

    AsyncThreadWork(Supplier<Object> work, Consumer<Object> callback)
    {
        this._work = work;
        this._callback = callback;
        if (callback != null) _callbackProcesser = AsyncCallbackProcesser.current();
    }

    void execute()
    {
        try
        {
            complete(_work.get());
        }
        catch (Throwable ex)
        {
        	ex.printStackTrace();
        	error(ex);
        }
    }

    private void complete(Object result)
    {
        if (_callback != null && _callbackProcesser != null) _callbackProcesser.callback(_callback, result);
    }

    private void error(Throwable ex)
    {
        if (_callback != null && _callbackProcesser != null) _callbackProcesser.callback(_callback, ex);
    }
}