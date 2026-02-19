package spacex.basecomm.controller;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;

@Controller
@RequestMapping("/auth")
public class AuthController {

	@RequestMapping("/rtmp")
	@ResponseBody
	public void rtmp(HttpServletRequest request, HttpServletResponse response){
		String app = TransData.getValueAsString("app");
		String stream = TransData.getValueAsString("name");
		
		String rapp = TransData.getValueAsString("RealApp");
		String rstream = TransData.getValueAsString("RealStream");
		if(!rapp.equals(app) || !rstream.equals(stream)) {
			throw new ErrorCodeException(9000001, "params.error");
		}
	}

	@RequestMapping("/err")
	@ResponseBody
	public String err(HttpServletRequest request, HttpServletResponse response){
		return "auth.error";
	}



}
