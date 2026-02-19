package boundless.threading.animation;

/**
 * 等待动画
 *
 */
public class WaitAnimation extends Animation<Float>
{
    /**
     * 
     * @param seconds 等待的秒。需大于0，否则会抛异常
     */
    public WaitAnimation(float seconds)
    {
        reset(seconds);
    }

    @Override
    protected Float calculateCurrentTimeValue()
    {
        if (this.duration() <= 0) return this.to();
        double len = this.to() - this.from();
        float rate = (this._thread.currentTimeMillis() - this.startTimeMillis()) / this.duration();
        return (float)(this.from() + len * rate);
    }

    @Override
    protected AnimationRunner createRunner()
    {
        return new MyAnimationRunner();
    }

    /**
     * 重置
     * @param seconds 等待的秒。需大于0，否则会抛异常
     */
    public void reset(float seconds)
    {
        super.reset();
        if (seconds <= 0) throw new Error("seconds can not been zero or less than zero");
        this.from(0f);
        this.to(seconds);
        this._frameMillis = (long)(seconds * 1000);
        this.duration(0, 0,0, (long)(seconds * 1000));
    }

    /**
     * 获得时间总长度,单位秒
     * @return
     */
    public float totalLength()
    {
    	return this.to();
    }

    /// <summary>
    /// 获得时间剩余长度,单位秒
    /// </summary>
    public float balanceLength()
    {
    	if (this.isRunning()) return this.to() - (float)(this._thread.currentTimeMillis() - startTimeMillis())/1000f;
        return this.totalLength();
    }

    private class MyAnimationRunner extends AnimationRunner
    {
    	@Override
        protected Float calculateFrameValue(int totalFramceCount)
        {
            return to() / totalFramceCount;
        }

    	@Override
        protected Float calculateCurrentFrameValue(int completedFrameCount, Float frameValue)
        {
            return frameValue * completedFrameCount;
        }
    }
}
