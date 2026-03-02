package boundless.threading;

import java.time.*;
import java.util.*;
import java.util.function.*;

import boundless.function.*;

/**
 * 把执行任务放入队列执行，当执行不成功时，会下一次再被执行，直到执行成功或超时为止
 *
 */
public class RetryTaskTicker implements ITicker
{
    private List<RetryTask> _pendingList = new ArrayList<RetryTask>();
    private Queue<RetryTask> _doingTaskQueue = new LinkedList<RetryTask>();
    private Queue<RetryTask> _switchTaskQueue = new LinkedList<RetryTask>();

    @Override
    public void tick()
    {
        synchronized (_pendingList) {
            for (RetryTask item : _pendingList)
            {
                _doingTaskQueue.add(item);
            }
            _pendingList.clear();
        }

        while (_doingTaskQueue.size() > 0)
        {
            RetryTask task = _doingTaskQueue.poll();
            if (task.nextRunTime()>System.currentTimeMillis())
            {
                _switchTaskQueue.add(task);
            }
            else
            {
                if (!execute(task))
                {
                    task.retryCount(task.retryCount()+1);
                    _switchTaskQueue.add(task);
                }
            }
        }
        Queue<RetryTask> temp = _doingTaskQueue;
        _doingTaskQueue = _switchTaskQueue;
        _switchTaskQueue = temp;
    }

    private boolean execute(RetryTask task)
    {
        if (task.expire().isBefore(LocalDateTime.now()))
        {
            task.raiseTimeout();
            return true;
        }
        try
        {
            return task.execute();
        }
        catch (Throwable ex)
        {
            ex.printStackTrace();
            return true;
        }
    }

    /**
     * 把执行任务放入队列执行，当执行不成功时，会下一次再被执行，直到执行成功或超时为止
     * @param work 执行方法
     * @param timeoutSeconds 要求在多长时间内执行成功，单位秒
     * @param timeoutCallback 超时时的回调方法
     */
    public void queueWork(Supplier<Boolean> work,long timeoutSeconds,Consumer0 timeoutCallback)
    {
        RetryTask task = new RetryTask(work, timeoutSeconds, timeoutCallback);
        synchronized (_pendingList) {
        	_pendingList.add(task);
        }
    }

    private class RetryTask
    {
        private Supplier<Boolean> _work;
        private Consumer0 _timeoutCallback;
        private int _retryCount;
        private TickThread _callThread;
        private LocalDateTime _expire;
        private long _nextRunTime=System.currentTimeMillis();

        public RetryTask(Supplier<Boolean> work, long timeoutSeconds, Consumer0 timeoutCallback)
        {
            this._work = work;
            this._timeoutCallback = timeoutCallback;
            this._expire = LocalDateTime.now().plusSeconds(timeoutSeconds);
            if (timeoutCallback!=null) this._callThread = TickThread.current();
        }

        public LocalDateTime expire()
        {
            return _expire;
        }

        public boolean execute()
        {
            if (_work == null) return true;
            return _work.get();
        }

        public void raiseTimeout()
        {
            if (_timeoutCallback==null) return;
            try
            {
                if (_callThread == null) _timeoutCallback.accept();
                else _callThread.queueWork(()->
                {
                    _timeoutCallback.accept();
                    return true;
                });

            }
            catch (Throwable ex)
            {
            	ex.printStackTrace();
            }
        }

        public int retryCount()
        {
        	return _retryCount;
        }

        public void retryCount(int value){
            _retryCount=value;
            this._nextRunTime = System.currentTimeMillis()+100*_retryCount;
        }

        public long nextRunTime()
        {
            return _nextRunTime;
        }
    }
}
