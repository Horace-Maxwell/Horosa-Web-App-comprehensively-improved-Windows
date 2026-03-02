package boundless.spring.help.interceptor;

import java.util.HashMap;
import java.util.Map;

import boundless.exception.ActionIdInvalidException;
import boundless.exception.AppException;
import boundless.exception.CustomizeException;
import boundless.exception.DataVerifyFailException;
import boundless.exception.DecryptException;
import boundless.exception.EncryptException;
import boundless.exception.NoDataException;
import boundless.exception.ParamsErrorException;
import boundless.exception.ParamsIllegalException;
import boundless.exception.RequestDataTooLongException;
import boundless.exception.ServerInMaintenanceException;
import boundless.exception.ServerInternalErrorException;
import boundless.exception.ServiceInterfaceException;
import boundless.exception.UnimplementedException;
import boundless.exception.UserExistException;
import boundless.exception.UserNotLoginException;

public class ActionResultCode {
	public static final ActionResultCode R000____UnImplement = new ActionResultCode(-1,"接口未实现");
	public static final ActionResultCode R000000_Success = new ActionResultCode(0,"成功");
	public static final ActionResultCode R000001_UserNotLogin = new ActionResultCode(1,"用户未登录");
	public static final ActionResultCode R000002_ActionIdInvalid = new ActionResultCode(2,"无效的接口编号");
	public static final ActionResultCode R000003_ParamsError = new ActionResultCode(3,"请求的参数错误");
	public static final ActionResultCode R000004_ParamsIllegal = new ActionResultCode(4,"传递的参数值非法(如:电话号码、IMSI、IMEI中含有英文字母)");
	public static final ActionResultCode R000005_DataVerifyFail = new ActionResultCode(5,"数据校验失败");
	public static final ActionResultCode R000006_EncryptFail = new ActionResultCode(6,"数据加密失败");
	public static final ActionResultCode R000007_DescryptFail = new ActionResultCode(7,"数据解密失败");
	public static final ActionResultCode R000008_UserNotLogin = new ActionResultCode(8,"用户未登录");
	public static final ActionResultCode R000009_UserExist = new ActionResultCode(9,"该用户已存在");
	public static final ActionResultCode R000011_NoData = new ActionResultCode(11,"无数据");
	public static final ActionResultCode R000995_CustomizeError = new ActionResultCode(995,"自定义错误");
	public static final ActionResultCode R000996_ServiceInterfaceFail = new ActionResultCode(996,"获取接口数据失败");
	public static final ActionResultCode R000997_RequestDataTooLong = new ActionResultCode(997,"发送的请求数据长度太长");
	public static final ActionResultCode R000998_ServerInMaintenance = new ActionResultCode(998,"服务器维护中……造成不便请您谅解");
	public static final ActionResultCode R000999_ServerInternalError = new ActionResultCode(999,"服务器内部错误");
	
	private static Map<Integer, AppException> map = new HashMap<Integer, AppException>();
	static{
		map.put(-1, new UnimplementedException());
		map.put(1, new UserNotLoginException());
		map.put(2, new ActionIdInvalidException());
		map.put(3, new ParamsErrorException());
		map.put(4, new ParamsIllegalException());
		map.put(5, new DataVerifyFailException());
		map.put(6, new EncryptException());
		map.put(7, new DecryptException());
		map.put(8, new UserNotLoginException());
		map.put(9, new UserExistException());
		map.put(11, new NoDataException());
		map.put(995, new CustomizeException());
		map.put(996, new ServiceInterfaceException());
		map.put(997, new RequestDataTooLongException());
		map.put(998, new ServerInMaintenanceException());
		map.put(999, new ServerInternalErrorException());
	}
	
	public static AppException fromCode(int code){
		AppException act = map.get(code);
		return act;
	}
	
	private int code;
	private String desc;
	
	public int getCode() {
		return code;
	}

	public String getDesc() {
		return desc;
	}
	
	public ActionResultCode(int code,String desc){
		this.code = code;
		this.desc = desc;
	}
	
	public void setDesc(String msg){
		this.desc = msg;
	}
}
