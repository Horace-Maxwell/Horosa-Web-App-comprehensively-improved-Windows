package boundless.threading;

import java.time.LocalDateTime;

/**
 * 断续器助手
 *
 */
public interface ITickAssistant
{
	/**
	 * 休眠
	 * @param milliseconds 计划休眠时间
	 * @return 实际休眠时间
	 */
    int sleep(int milliseconds);

    /**
     * 
     * @param milliseconds 休眠时间与当次轮询时间总和
     */
    void onTick(long milliseconds);

    /**
     * 获得当前时间表示的毫秒
     * @return
     */
    long currentTimeMillis();
    
    /**
     * 获得当前时间
     * @return
     */
    LocalDateTime currentDateTime();
}
