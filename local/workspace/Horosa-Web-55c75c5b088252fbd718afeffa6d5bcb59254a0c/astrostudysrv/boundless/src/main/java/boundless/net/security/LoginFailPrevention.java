package boundless.net.security;

import java.time.LocalDateTime;

import boundless.net.*;
import boundless.net.external.*;

/**
 * 登陆失败
 *
 */
class LoginFailPrevention extends ErrorPrevention<LoginFailPrevention.FailData> {
	public LoginFailPrevention(TcpServer server) {
		super(server);
		ERROR_COUNT = 5;

		EventCenter.<PacketReader> subscribeLoginSuccessful((client,args) -> {
			clearError(client.connectionId());
		});
		EventCenter.<PacketReader> subscribeLoginFail((data,args) -> {
			error(data,args);
		});
	}

	@Override
	protected void error(FailData error) {
		super.error(error);
		error.failTime(LocalDateTime.now());
	}

	@Override
	protected FailData newError(TcpChannel<PacketReader> client) {
		return new FailData();
	}

	/**
	 * 获得上一次登陆失败时间
	 * 
	 * @param connectionId
	 * @return
	 */
	public LocalDateTime lastFailTime(int connectionId) {
		if (!_userConnections.containsKey(connectionId))
			return null;

		return _userConnections.get(connectionId).failTime();
	}

	@Override
	protected String errorHeader(LoginFailPrevention.FailData error) {
		return "登陆失败";
	}
	
	public class FailData extends ErrorData {
		private LocalDateTime _failTime = LocalDateTime.now();

		public LocalDateTime failTime() {
			return _failTime;
		}

		public void failTime(LocalDateTime value) {
			_failTime = value;
		}
	}
}
