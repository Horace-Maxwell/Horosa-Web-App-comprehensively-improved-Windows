package boundless.threading;

import java.util.*;

/**
 * 可自动缩放线程数量的线程池
 *
 */
public class ScaleThreadPool
{
    private int _minThreadCount;
    private int _perThreadMaxTickerCount;
    private List<TickThread> _threads = new ArrayList<TickThread>();
    private int _circleIndex = 0;

    /**
     * 
     * @param minThreadCount 最小线程数量
     * @param perThreadMaxTickerCount 每个线程里最大的Ticker数量，超过时会自动增长线程数
     * 
     */
    public ScaleThreadPool(int minThreadCount, int perThreadMaxTickerCount)
    {
        if (minThreadCount <= 0) throw new Error("参数@minThreadCount需大于0");
        if (perThreadMaxTickerCount <= 0) throw new Error("参数@perThreadMaxTickerCount需大于0");

        this._minThreadCount = minThreadCount;
        this._perThreadMaxTickerCount = perThreadMaxTickerCount;
        for (int i = 0; i < minThreadCount; i++)
        {
            addThread(null);
        }
    }

    /**
     * 增加Ticker
     * @param ticker
     * @return Ticker所在的线程
     */
    public TickThread addTicker(ITicker ticker)
    {
        synchronized (_threads)
        {
            if (_circleIndex >= _threads.size()) _circleIndex = 0;
            TickThread thread = _threads.get(_circleIndex);
            _circleIndex++;
            if (thread.tickerCount() >= _perThreadMaxTickerCount)
            {
                return addThread(ticker);
            }
            else
            {
                thread.addTicker(ticker);
                return thread;
            }
        }
    }

    private TickThread addThread(ITicker ticker)
    {
        TickThread thread = new TickThread();
        synchronized (_threads)
        {
            _threads.add(thread);
        }
        if (ticker!=null) thread.addTicker(ticker);

        thread.addOnIdle((t)->
        {
        	synchronized (_threads)
            {
                if (_threads.size() <= _minThreadCount) return;
                t.stop();
                _threads.remove(t);
            }
        });

        thread.start();
        return thread;
    }
}
