package boundless.threading.animation;

/**
 * 定时器动画
 *
 */
public class TimerAnimation extends Animation<Integer>
{
    private MyAnimationRunner _runner;
    private float _intervalSeconds;

    /**
     * 
     * @param intervalSeconds 间隔时间，单位秒。需大于0，否则会抛异常
     * @param totalDurationSeconds 总持续时间，单位秒
     * @throws Exception 
     */
    public TimerAnimation(float intervalSeconds, float totalDurationSeconds)
    {
        reset(intervalSeconds,totalDurationSeconds);
    }

    /**
     * 使定时器继续@durationSeconds秒后结束
     * @param durationSeconds
     * @throws Exception 
     */
    public void goOn(float durationSeconds)
    {
        if (this.isRunning()) _runner.goOn(durationSeconds);
        else
        {
            reset(this._intervalSeconds,durationSeconds);
            start();
        }
    }

    @Override
    protected Integer calculateCurrentTimeValue()
    {
        if (this.duration()<=0) return this.to();
        int len = this.to() - this.from();
        double gapMillis = (this._thread.currentTimeMillis() - this.startTimeMillis());
        if (gapMillis >= this.duration()) return len;
        float rate = (float)(gapMillis / this.duration());
        return (int)(this.from() + len * rate);
    }

    @Override
    protected AnimationRunner createRunner()
    {
        if (_runner==null) _runner=new MyAnimationRunner();
        return _runner;
    }

    /**
     * 重置
     * @param intervalSeconds 间隔时间，单位秒。需大于0，否则会抛异常
     * @param totalDurationSeconds 总持续时间，单位秒
     * @throws Exception 
     */
    public void reset(float intervalSeconds, float totalDurationSeconds)
    {
        super.reset();
        if (intervalSeconds <= 0) throw new Error("intervalSeconds can not been zero or less than zero");
        this._frameMillis = (long)(intervalSeconds * 1000);
        this.duration(0, 0, 0, (long)(totalDurationSeconds * 1000));
        this._intervalSeconds = intervalSeconds;
    }

    /**
     * 获得本次轮循距离上次经历的次数
     * @return
     */
    public int currentThroughCount()
    {
    	return this.currentValue() - this.priorValue();
    }

    /**
     * 获得时间总长度,单位秒
     * @return
     */
    public float totalLength()
    {
    	return (float)this.duration()/1000f;
    }

    /**
     * 获得时间剩余长度,单位秒
     * @return
     */
    public float balanceLength()
    {
    	if (this.isRunning()) return this.totalLength() - (float)(this._thread.currentTimeMillis() - startTimeMillis())/1000f;
        return this.totalLength();
    }

    private class MyAnimationRunner extends AnimationRunner
    {
    	@Override
        public void reset()
        {
            super.reset();
            from(0);
            to(super._balanceFrameCount);
        }

    	@Override
        protected Integer calculateFrameValue(int totalFramceCount)
        {
            return 1;
        }

    	@Override
        protected Integer calculateCurrentFrameValue(int completedFrameCount, Integer frameValue)
        {
            return completedFrameCount;
        }

        /**
         * 使定时器继续@durationSeconds秒后结束
         * @param durationSeconds
         */
        public void goOn(float durationSeconds)
        {
            double milliseconds = (thread().currentTimeMillis() - startTimeMillis()) + (durationSeconds * 1000);
            duration(0, 0, 0, (long)milliseconds);
            int totalFrameCount=calculateTotalFrameCount();
            _balanceFrameCount = totalFrameCount - _completedFrameCount;
            to(totalFrameCount);
        }
    }
}
