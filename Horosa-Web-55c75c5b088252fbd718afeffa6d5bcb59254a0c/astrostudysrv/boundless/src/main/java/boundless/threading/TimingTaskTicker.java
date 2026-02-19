package boundless.threading;

import java.time.*;

/**
 * 定时执行任务的断续器
 *
 */
public abstract class TimingTaskTicker implements ITicker
{
    private LocalDateTime _nextTime=LocalDateTime.now();
    private int _today;
    private int _interval;
    private LocalTime _fixTime; //执行任务的时间
    private boolean _completed = false; //标识今日是否已执行

    /**
     * 
     * @param hour 小时
     * @param minute 分钟
     */
    public TimingTaskTicker(int hour, int minute){
    	this(hour,minute,5);
    }
    
    /**
     * 
     * @param hour 小时
     * @param minute 分钟
     * @param interval 轮询间隔，单位秒(对精确度要求不高可以设置大一点)
     */
    public TimingTaskTicker(int hour, int minute, int interval)
    {
        _today = LocalDateTime.now().getDayOfMonth();
        _interval = interval;
        
        _fixTime = LocalTime.of(hour,minute,0);

        if (LocalTime.now().isAfter(_fixTime)) _completed = true; //时间已经过去了
    }

    public void Tick()
    {
    	LocalDateTime now=LocalDateTime.now();
        //过了一日 重置执行标识
        if (_today != now.getDayOfMonth())
        {
            _completed = false;
            _today = now.getDayOfMonth();
        }
        if (_completed) return; //今日已执行 跳过
        if (_nextTime.isAfter(now)) return;
        _nextTime = now.plusSeconds(_interval);

        if (LocalTime.now().isAfter(_fixTime))
        {
            onTask();
            _completed = true;
        }
    }

    /**
     * 到时间后将要执行的任务
     */
    protected abstract void onTask();
}