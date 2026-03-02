package boundless.net;

import io.netty.bootstrap.Bootstrap;
import io.netty.channel.ChannelFuture;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioSocketChannel;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.*;

import boundless.utility.*;
import boundless.types.KeyValuePair;

/**
 * Socket实用工具包
 *
 */
public class SocketUtility
{
	/**
	 * 选择可通达的最近连接地址
	 * @param endpoints 可选的地址列表.{Key:地址,Value:端口}
	 * @return {Key:地址,Value:端口}.null:未找到
	 */
    public static KeyValuePair<String, Integer> selectNearEndpoint(KeyValuePair<String, Integer>[] endpoints)
    {
        HashMap<String, ArrayList<Integer>> ipGroup = new HashMap<String, ArrayList<Integer>>();
        for (KeyValuePair<String, Integer> item : endpoints)
        {
        	ArrayList<Integer> portList=ipGroup.get(item.getKey());
            if (portList==null)
            {
                portList = new ArrayList<Integer>();
                ipGroup.put(item.getKey(),portList);
            }
            portList.add(item.getValue());
        }

        String nearIp = "";
        String[] ipArray=new String[ipGroup.size()];
        ipGroup.keySet().toArray(ipArray);
        for (String ip : IPUtility.sortNearIps(ipArray))
        {
            for (Integer port : ipGroup.get(ip))
            {
            	if (connect(ip,port)) return new KeyValuePair<String, Integer>(ip, port);
            }
        }

        return null;
    }
    
    private static boolean connect(String ip,int port){
    	java.net.Socket s=null;
    	try {
        	s=new java.net.Socket();
        	s.connect(new InetSocketAddress(ip, port));
			return true;
		} catch (Throwable e) {
			return false;
		} finally{
			if (s!=null)
				try {
					s.close();
				} catch (IOException e) {
				}
		}
    }
}
