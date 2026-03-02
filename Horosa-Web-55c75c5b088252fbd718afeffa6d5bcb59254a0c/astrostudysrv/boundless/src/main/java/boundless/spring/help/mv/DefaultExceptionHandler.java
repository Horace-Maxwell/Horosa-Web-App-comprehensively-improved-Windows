package boundless.spring.help.mv;

import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.ModelAndView;


import boundless.exception.ActionIdInvalidException;
import boundless.exception.CustomizeException;
import boundless.exception.DataVerifyFailException;
import boundless.exception.DecryptException;
import boundless.exception.EncryptException;
import boundless.exception.ErrorCodeException;
import boundless.exception.NeedLoginException;
import boundless.exception.NoDataException;
import boundless.exception.ParamsErrorException;
import boundless.exception.ParamsIllegalException;
import boundless.exception.RequestDataTooLongException;
import boundless.exception.ServerInMaintenanceException;
import boundless.exception.ServiceInterfaceException;
import boundless.exception.SignatureException;
import boundless.exception.StateResultException;
import boundless.exception.UnimplementedException;
import boundless.exception.UserExistException;
import boundless.exception.UserNotLoginException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.PropertyPlaceholder;
import boundless.spring.help.interceptor.ActionResultCode;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.types.OutParameter;
import boundless.utility.StringUtility;

@Component
public class DefaultExceptionHandler implements HandlerExceptionResolver {
	@Override
	public ModelAndView resolveException(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
		ModelAndView mv = null;
		
		request.setAttribute(KeyConstants.AttrExceptionOccured, true);
		
		OutParameter<String> msg = new OutParameter<String>();
		String errmsg = null;
		String encmsg = null;
		int errcode = -1;
		Map<String, Object> errmap = new HashMap<String, Object>();
		if(ex instanceof NeedLoginException){
			response.addHeader(KeyConstants.NeedLoginKey, "1");
			String loginurl = ex.getMessage();
			if(StringUtility.isNullOrEmpty(loginurl)){
				mv = ErrorModelAndView.getDefaultStringError("user.need.login");
			}else{
				mv = new ModelAndView(loginurl);
			}
			
		}else if(ex instanceof StateResultException){
			errmsg = ex.getMessage();
			mv = ErrorModelAndView.getDefaultStateResultError(errmsg);
			
		}else if(ex instanceof ErrorCodeException){
			ErrorCodeException errEx = (ErrorCodeException) ex;
			errcode = errEx.getCode();
			String key = "resultcode." + errEx.getCode();
			errmsg = PropertyPlaceholder.getProperty(key);
			if(StringUtility.isNullOrEmpty(errmsg) || errmsg.equals(key)){
				errmsg = errEx.getMessage();
			}
		}else{
			ActionResultCode code = getActionResultCode(ex, msg);
			errcode = code.getCode();
			errmsg = msg.value;
			if(StringUtility.isNullOrEmpty(errmsg)){
				errmsg = code.getDesc();
			}
			if(StringUtility.isNullOrEmpty(errmsg)){
				errmsg = ex.getMessage();
			}
		}
		
		encmsg = errmsg;
		try{
			encmsg = URLEncoder.encode(errmsg, "UTF-8");
		}catch(Exception e){
		}
		response.setHeader(KeyConstants.ResultCode, errcode + "");
		response.setHeader(KeyConstants.ResultMessage, encmsg);
		errmap.put(KeyConstants.ResultCode, errcode);
		errmap.put(KeyConstants.ResultMessage, errmsg);

		if(mv == null){
			mv = ErrorModelAndView.getDefaultJsonError(errmap);
		}
		
		QueueLog.error(AppLoggers.ErrorLogger, ex);
		
		return mv;
	}

	private ActionResultCode getActionResultCode(Exception ex, OutParameter<String> msg) {
		ActionResultCode code = null;
		if(ex instanceof SignatureException || ex instanceof DataVerifyFailException){
			code = ActionResultCode.R000005_DataVerifyFail;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000005", "");
		}else if(ex instanceof ActionIdInvalidException){
			code = ActionResultCode.R000002_ActionIdInvalid;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000002", "");
		}else if(ex instanceof DecryptException){
			code = ActionResultCode.R000007_DescryptFail;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000007", "");
		}else if(ex instanceof EncryptException){
			code = ActionResultCode.R000006_EncryptFail;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000006", "");
		}else if(ex instanceof ParamsErrorException){
			code = ActionResultCode.R000003_ParamsError;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000003", "");
		}else if(ex instanceof ParamsIllegalException){
			code = ActionResultCode.R000004_ParamsIllegal;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000004", "");
		}else if(ex instanceof ServerInMaintenanceException){
			code = ActionResultCode.R000998_ServerInMaintenance;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000998", "");
		}else if(ex instanceof RequestDataTooLongException){
			code = ActionResultCode.R000997_RequestDataTooLong;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000997", "");
		}else if(ex instanceof UnimplementedException){
			code = ActionResultCode.R000____UnImplement;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000", "");
		}else if(ex instanceof UserExistException){
			code = ActionResultCode.R000009_UserExist;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000009", "");
		}else if(ex instanceof UserNotLoginException){
			code = ActionResultCode.R000001_UserNotLogin;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000001", "");
		}else if(ex instanceof CustomizeException){
			code = ActionResultCode.R000995_CustomizeError;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000995", "");
		}else if(ex instanceof ServiceInterfaceException){
			code = ActionResultCode.R000996_ServiceInterfaceFail;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000996", "");
		}else if(ex instanceof NoDataException){
			code = ActionResultCode.R000011_NoData;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000011", "");
		}else if(ex instanceof ErrorCodeException){
			ErrorCodeException codeex = (ErrorCodeException)ex;
			String codemsgkey = KeyConstants.ErrorCodePrefix + codeex.getCode();
			msg.value = PropertyPlaceholder.getProperty(codemsgkey);
			if(msg.value == null || msg.value.equals(codemsgkey)){
				msg.value = codeex.getMessage();
			}
			code = new ActionResultCode(codeex.getCode(), msg.value);
		}else{
			code = ActionResultCode.R000999_ServerInternalError;
			msg.value = PropertyPlaceholder.getProperty("resultcode.R000999", "");
		}
		
		if(msg.value == null){
			msg.value = ex.toString();
			code.setDesc(msg.value);
		}
		
		return code;
	}
}
