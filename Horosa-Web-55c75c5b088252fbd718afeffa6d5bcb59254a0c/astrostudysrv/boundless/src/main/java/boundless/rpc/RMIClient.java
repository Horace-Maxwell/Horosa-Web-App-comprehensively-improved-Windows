package boundless.rpc;

import org.springframework.remoting.rmi.RmiProxyFactoryBean;

public class RMIClient {
	
	/**
	 * 创建RMI Client对象
	 * @param interfaceClass 接口类型
	 * @param url rmi远程地址
	 * @return 接口对象
	 */
	public static Object create(Class<?> interfaceClass,String url){
        RmiProxyFactoryBean rmiProxyFactoryBean = new RmiProxyFactoryBean(); 
        rmiProxyFactoryBean.setServiceInterface(interfaceClass); 
        rmiProxyFactoryBean.setServiceUrl(url); 
        rmiProxyFactoryBean.afterPropertiesSet();  
        //更改ServiceInterface或ServiceUrl之后必须调用该方法，来获取远程调用桩
        rmiProxyFactoryBean.afterPropertiesSet(); 
        return rmiProxyFactoryBean.getObject();
	}
}
