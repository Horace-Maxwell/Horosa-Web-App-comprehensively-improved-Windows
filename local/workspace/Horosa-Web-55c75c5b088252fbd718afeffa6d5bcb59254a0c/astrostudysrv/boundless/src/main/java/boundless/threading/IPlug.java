package boundless.threading;

/**
 * 功能模块接入系统的插头。每个功能模块要接入到系统中，要开发一个IPlug的实现类，系统会使用这个类的对象把模块接入系统，功能模块的IPlug对象只有一个
 *
 */
public interface IPlug
{
	/**
	 * 安装模块
	 * @return 需放入主线程轮询的断续器列表
	 */
    ITicker[] install();

    /**
     * 卸载模块
     */
    void uninstall();

    /**
     * 获得需放入主线程轮询的断续器列表
     * @return
     */
    ITicker[] tickers();
}
