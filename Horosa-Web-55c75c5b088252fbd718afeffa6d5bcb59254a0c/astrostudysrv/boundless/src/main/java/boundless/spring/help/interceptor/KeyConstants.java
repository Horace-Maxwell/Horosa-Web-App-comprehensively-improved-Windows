package boundless.spring.help.interceptor;

import java.util.HashMap;
import java.util.Map;


public class KeyConstants {
	public static final String AttrExceptionOccured = "_ExceptionOccured_";
	public static final String AttrExceptionObj = "_ExceptionObj_";
	public static final String AttrExceptionMsg = "_ExceptionMsg_";
	public static final String AttrExceptionCode = "_ExceptionCode_";
	public static final String AttrTransBeginTimeKey = "_TransBeginTime_";
	
	public static final String Scheme = "_Scheme_";
	public static final String Host = "_Host_";
	public static final String Port = "_Port_";
	public static final String RequestObject = "_HttpRequestObject_";
	public static final String ResponseObject = "_HttpResponseObject_";
	public static final String MultipartObject = "_MultipartObject_";
	public static final String CurrentUser = "_CurrentUserObject_";
	public static final String CurrentUserMap = "_CurrentUserMap_";
	public static final String CurrentUserId = "_CurrentUserId_";

	public static final String ResponseOnlyList = "_ResponseOnlyList_";
	public static final String ResponseOnlyObj = "_ResponseOnlyObj_";
	
	public static final String SessionUid = "_SessionUid_";
	public static final String PlainBody = "__PlainBody__";

	public static final String ResultCode = "ResultCode";
	public static final String ResultMessage = "Result";
	public static final String NeedLoginKey = "NeedLogin";
	public static final String ResultKey = "Result";
	public static final String BodyEncryptType = "BodyEncryptType";

	public static final int SuccessCode = 0;
	public static final int FailCode = 999;
	
	public static final String PID = "PID";
	public static final String MT = "MT";
	public static final String DivideVersion = "DivideVersion";
	public static final String SupPhone = "SupPhone";
	public static final String SupFirm = "SupFirm";
	public static final String IMEI = "IMEI";
	public static final String IMSI = "IMSI";
	public static final String SessionId = "SessionId";
	public static final String CUID = "CUID";
	public static final String ProtocolVersion = "ProtocolVersion";
	public static final String ChannelID = "ChannelID";
	public static final String Language = "Language";
	public static final String CountryCode = "CountryCode";
	public static final String Sign = "Sign";
	public static final String Token = "Token";
	public static final String UID = "UID";

	public static final String Signature = "Signature";

	public static final String DefaultRequestList = "DefaultRequestList";
	public static final String DefaultRequestStr = "DefaultRequestStr";
	
	public static final String ErrorCodePrefix = "resultcode.";

	public static final String RowIndex = "_RowIndex_";
	public static final String PageIndex = "PageIndex";
	public static final String PageSize = "PageSize";
	public static final String IsAdmin = "_IsAdmin_";
	public static final String IsSelfAdmin = "_IsSelfAdmin_";

	public static final String TransCode = "_TransCode_";
	public static final String RsaParam = "_rsaparam_";
	
	public static final String NoRestful = "_norestful_";
	public static final String NoRestTransCode = "_NoRestTransCode_";
	
	public static String getErrorKey(int code){
		return "resultcode." + code;
	}
	
	public static Map<String, Object> newResult(){
		Map<String, Object> map = new HashMap<String, Object>();
		map.put(KeyConstants.ResultCode, KeyConstants.SuccessCode);
		map.put(KeyConstants.ResultMessage, "");
		
		return map;
	}
	
	
}
