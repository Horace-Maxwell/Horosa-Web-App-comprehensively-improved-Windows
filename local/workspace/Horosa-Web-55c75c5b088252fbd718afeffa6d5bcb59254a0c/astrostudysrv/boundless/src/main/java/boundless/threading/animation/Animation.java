package boundless.threading.animation;

import java.time.*;
import java.util.function.Consumer;

import boundless.function.*;
import boundless.types.*;
import boundless.threading.*;

/**
 * 动画定义
 *
 * @param <T_Value> 起始值和结束值类型
 */
public abstract class Animation<T_Value> implements ObjectPool.IReuseObject
{
    /// <summary>
    /// 每桢的时间，单位毫秒
    /// </summary>
    protected long _frameMillis = 40;

    //动画完成事件
    private ConsumerDelegate<Animation<T_Value>> _completedDelegate=new ConsumerDelegate<Animation<T_Value>>();
    //动画执行中事件
    public ConsumerDelegate<Animation<T_Value>> _processingDelegate=new ConsumerDelegate<Animation<T_Value>>();

    private T_Value _from;
    private T_Value _to;
    private T_Value _priorValue;
    private T_Value _currentValue;
    private AnimationRunner _runner = null;
    private boolean _willStop=false;
    private boolean _running = false;
    private LocalDateTime _startDateTime;
    private long _startTimeMillis;
    private long _duration;
    private Consumer2<Animation<T_Value>,T_Value> _tickConsumer;
    protected TickThread _thread;

    public Animation()
    {
        this._runner = createRunner();
    }

    /**
     * 创建动画运行器。动画的执行过程由运行器负责
     * @return
     */
    protected abstract AnimationRunner createRunner();

    /**
     * 计算当前时刻的值
     * 虽然动画运行器会计算当前值，但运行器中是以每桢累加当前值，如果动画停止时间落在桢间隔上，此时就需要调用此方法获得一个精确的当前值
     * @return
     */
    protected abstract T_Value calculateCurrentTimeValue();

    /**
     * 获得动画开始值
     * @return
     */
    public T_Value from()
    {
        return _from;
    }
    /**
     * 设置动画开始值
     * @param value
     */
    public void from(T_Value value){
    	_from=value;
    }

    /**
     * 获得动画结束值
     * @return
     */
    public T_Value to()
    {
        return _to;
    }
    /**
     * 设置动画结束值
     * @param value
     */
    public void to(T_Value value){
    	_to=value;
    }

    /**
     * 获得动画持续时间。单位毫秒
     * @return
     */
    public long duration()
    {
        return _duration;
    }
    /**
     * 设置动画持续时间
     * @param hours
     * @param minutes
     * @param seconds 
     * @param millis
     */
    public void duration(int hours,int minutes,long seconds,long millis)
    {
        _duration=millis+seconds*1000+minutes*60*1000+hours*60*60*1000;
    }

    /**
     * 获得动画滴答函数。参数1:动画对象,参数2:当前值
     */
    public Consumer2<Animation<T_Value>,T_Value> tickConsumer(){
    	return _tickConsumer;
    }
    /**
     * 设置动画滴答函数。参数1:动画对象,参数2:当前值
     * @param consumer
     */
    public void tickConsumer(Consumer2<Animation<T_Value>,T_Value> consumer){
    	_tickConsumer=consumer;
    }

    /**
     * 获得开始时间
     * @return
     */
    public LocalDateTime startDateTime()
    {
        return _startDateTime;
    }
    
    public long startTimeMillis()
    {
        return _startTimeMillis;
    }

    /**
     * 启动动画
     */
    public void start()
    {
        if (_running) return;
        _willStop = false;
        _thread = TickThread.current();
        _startDateTime = _thread.currentDateTime();
        _startTimeMillis=_thread.currentTimeMillis();
        _runner.reset();
        if (_thread != null)
        {
            this._running = true;
            _thread.addTicker(this._runner);
        }
    }

    /**
     * 停止动画
     */
    public void stop()
    {
        if (this._running ==false)
            return;
        _willStop = true;
        this.executeTickConsumer(calculateCurrentTimeValue(),false);
        if (_thread != null) _thread.removeTicker(this._runner);
        this._running = false;
    }

    /**
     * 重置
     */
    public void reset()
    {
        stop();
    }

    /**
     * 获得上一次的值
     * @return
     */
    public T_Value priorValue()
    {
        return _priorValue;
    }

    /**
     * 获得当前值
     * @return
     */
    public T_Value currentValue()
    {
        return _currentValue;
    }

    public boolean isRunning()
    {
        return this._running;
    }

    public boolean isWillStop()
    {
        return _willStop;
    }

    /**
     * 强制动画播放到当前时间点的状态。由于动画依据线程轮循播放，当线程繁忙，动画无法及时播放,此时可通过此方法强制动画播放到当前时间点的状态
     */
    public void refresh()
    {
        if (this.isInvalid()) return;
        this._runner.tick();
    }

    private void complete()
    {
        boolean invalid = this.isInvalid();
        stop();
        if (invalid) return;
        this._completedDelegate.execute(this);
    }

    private boolean isInvalid()
    {
    	return !this._running;
    }

    private void executeTickConsumer(T_Value currentValue,boolean processing)
    {
        try
        {
            this._priorValue = this._currentValue;
            this._currentValue = currentValue;
            if (this._tickConsumer!=null) this._tickConsumer.accept(this, currentValue);
            _processingDelegate.execute(this);
        }
        catch (Throwable ex) { }
    }
    
    public void addOnCompleted(Consumer<Animation<T_Value>> ls){
    	_completedDelegate.add(ls);
    }

    /**
     * 动画运行器
     * 动画运行器以每桢累加的方式计算当前值，采用此方式的目的是加法在指令级别上的速度被除法快
     */
    protected abstract class AnimationRunner implements ITicker
    {
        //每桢的种子
        private T_Value _frameValue;
        //最后1桢的时间花费
        private long _lastCostMillis;
        //剩余桢数
        protected int _balanceFrameCount;
        //完成的桢数
        protected int _completedFrameCount;
        private long _lastTimeMillis;

        public void reset()
        {
            this._lastTimeMillis = _thread.currentTimeMillis();
            this._completedFrameCount = 0;

            //计算桢数和种子--begin
            _balanceFrameCount = calculateTotalFrameCount();
            _frameValue = calculateFrameValue(_balanceFrameCount);
            //计算桢数和种子--end
        }

        /**
         * 计算总帧数
         * @return
         */
        protected int calculateTotalFrameCount()
        {
            int frameCount = (int)((_duration - 1) / _frameMillis) + 1;
            //如果最后1桢的时间ticks小于CoordinateAnimation.FRAME_TIME的一半，把最后2桢合并为1桢
            long discTime = _duration - ((frameCount - 1) * _frameMillis);
            if (discTime < _frameMillis / 2)
            {
                frameCount--;
            }
            _lastCostMillis = _duration - (frameCount - 1) * _frameMillis;

            return frameCount;
        }

        /**
         * 计算每桢的种子，即每桢递增的值
         * @param totalFramceCount
         * @return
         */
        protected abstract T_Value calculateFrameValue(int totalFramceCount);

        public void tick()
        {
            if (isInvalid()) return;

            if (_balanceFrameCount <= 0)
            {
                executeTickConsumer(to(),false);
                if (isInvalid()) return;
                complete();
                return;
            }

            long gapMillis = _thread.currentTimeMillis() - this._lastTimeMillis;
            if (_balanceFrameCount <= 1)
            {
                if (gapMillis < _lastCostMillis) return;
                executeTickConsumer(to(), false);
                if (isInvalid()) return;
                complete();
                return;
            }
            else if (gapMillis < _frameMillis) return;

            this._lastTimeMillis = _thread.currentTimeMillis();

            int frameCount = 0;
            while (true)
            {
            	gapMillis = gapMillis - _frameMillis;
                if (gapMillis < 0) break;
                frameCount++;
            }

            //把gapTicks的余数补回去
            this._lastTimeMillis=this._lastTimeMillis-(gapMillis + _frameMillis);

            _balanceFrameCount -= frameCount;
            if (_balanceFrameCount <= 0)
            {
            	executeTickConsumer(to(), false);
                if (isInvalid()) return;
                complete();
                return;
            }
            _completedFrameCount += frameCount;
            T_Value currentValue = calculateCurrentFrameValue(_completedFrameCount, _frameValue);
            executeTickConsumer(currentValue,true);
        }

        /**
         * 计算当前桢的值
         * @param completedFrameCount 已完成的桢
         * @param frameValue
         * @return
         */
        protected abstract T_Value calculateCurrentFrameValue(int completedFrameCount, T_Value frameValue);

        protected TickThread thread()
        {
        	return _thread;
        }
    }
}
