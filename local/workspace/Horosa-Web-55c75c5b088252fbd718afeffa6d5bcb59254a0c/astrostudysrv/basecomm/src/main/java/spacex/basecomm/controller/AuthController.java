package spacex.basecomm.controller;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequestMapping("/auth")
public class AuthController {

	@RequestMapping("/err")
	@ResponseBody
	public String err(HttpServletRequest request, HttpServletResponse response){
		return "auth.error";
	}



}
