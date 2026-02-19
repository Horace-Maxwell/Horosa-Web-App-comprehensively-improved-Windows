package boundless.threading;

/**
 * 断续器
 * @author Administrator
 *
 */
public interface ITicker
{
    /**
     * 每次断续的处理逻辑
     */
    void tick();
}