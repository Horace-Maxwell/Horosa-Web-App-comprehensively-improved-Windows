package boundless.net;

/**
 * 可输出的数据。
 * 在游戏中都会需要把相关数据往外输出，定义此借口作为可输出数据的协议
 * 而数据一般都是序列化成字节数组做输出，如何序列化成字节数组，则依据数据类型代码获得序列化器来实现
 * 
 * @author Administrator
 *
 */
public interface IOutputData
{
    /**
     * 获得数据类型代码
     * @return
     */
    int dataTypeId();

    /**
     * 获得数据哪个连接发出来或要发给哪个连接，实际意义由具体包自定
     * @return
     */
    int connectionId();

    /**
     * 获得原始数据
     * @return
     */
    Object sourceData();
}