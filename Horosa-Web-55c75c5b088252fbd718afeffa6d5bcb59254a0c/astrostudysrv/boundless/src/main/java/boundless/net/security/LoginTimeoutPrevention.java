package boundless.net.security;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.Map.Entry;

import boundless.net.*;
import boundless.net.external.TcpServer;
import boundless.threading.*;

/**
 * 已连接在超时时间内未登陆
 *
 */
class LoginTimeoutPrevention implements ITicker
{
    private static final int TIMEOUT_SECONDS = 60;
    private Hashtable<Integer, TcpChannel<PacketReader>> _userConnections = new Hashtable<Integer, TcpChannel<PacketReader>>();
    private TcpServer _server;

    public LoginTimeoutPrevention(TcpServer server)
    {
        server.addOnConnect((client)->{
        	_userConnections.put(client.connectionId(),client);
        });
        server.addOnDisconnect((client)->{
        	removeConnection(client.connectionId());
        });
        this._server = server;

        EventCenter.<PacketReader>subscribeLoginSuccessful((client,args)->{
        	removeConnection(client.connectionId());
        });
    }

    private void removeConnection(int connectionId)
    {
        if (!_userConnections.containsKey(connectionId))
            return;

        _userConnections.remove(connectionId);
    }

    public void tick()
    {
    	Enumeration<TcpChannel<PacketReader>> enumeration=_userConnections.elements();
    	while (enumeration.hasMoreElements()){
    		TcpChannel<PacketReader> item=enumeration.nextElement();
            LoginFailPrevention fail=SecurityPrevention.getLoginFail(_server);
            LocalDateTime lastTime = fail == null ? item.createTime() : fail.lastFailTime(item.connectionId());
            if (lastTime == null) lastTime = item.createTime();
            long gapSeconds=ChronoUnit.SECONDS.between(lastTime, LocalDateTime.now());
            if (gapSeconds > TIMEOUT_SECONDS)
            {
                SecurityPrevention.logger(_server).writeLog(errorHeader() + ",client:" + item.description());
                item.close();
            }
        }
    }

    protected String errorHeader()
    {
        return "久未登陆";
    }
}