package boundless.net.internal;

import boundless.net.*;
import boundless.net.external.*;

/// <summary>
/// 服务器配置信息序列化器
/// </summary>
public class ServerConfigurationSerializer
{
    public static IServerConfiguration deserialize(InternalPacketReader reader)
    {
        StreamReader pr = reader.paramsReader();
        ServerConfiguration config=new ServerConfiguration();
        config.serverId(pr.readInt16())
              .serverName(pr.readShortString())
              .serverType(pr.readByte())
              .port(pr.readInt32())
              .maxClient(pr.readInt32())
              .trackPacket(pr.readBoolean());
        return config;
    }

    public static byte[] serialize(IServerConfiguration config)
    {
        StreamWriter pw = new StreamWriter();
        pw.write(config.serverId());
        pw.writeShortString(config.serverName());
        pw.write((byte)config.serverType());
        pw.write(config.port());
        pw.write(config.maxClient());
        pw.write(config.trackPacket());

        return pw.toArray();
    }
}
