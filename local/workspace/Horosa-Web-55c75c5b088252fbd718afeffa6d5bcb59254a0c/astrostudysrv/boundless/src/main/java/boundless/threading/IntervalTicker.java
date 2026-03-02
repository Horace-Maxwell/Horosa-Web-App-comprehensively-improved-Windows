package boundless.threading;

import java.time.*;

/**
 * 带间隔时间的断续器
 *
 */
public abstract class IntervalTicker implements ITicker
{
    private LocalDateTime _nextTime=LocalDateTime.now();
    private int _interval;

    /**
     * 
     * @param interval 间隔时间，单位秒
     */
    public IntervalTicker(int interval)
    {
        this._interval = interval;
    }

    public void tick()
    {
        if (_nextTime.isAfter(LocalDateTime.now())) return;
        _nextTime = LocalDateTime.now().plusSeconds(_interval);
        onTime();
    }

    /**
     * 时间到的处理逻辑
     */
    protected abstract void onTime();
}
