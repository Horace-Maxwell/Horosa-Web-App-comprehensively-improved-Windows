package spacex.basecomm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import boundless.types.message.SmsAt;

@Controller
@RequestMapping("/test")
public class IotTestController {
	
	@RequestMapping("/com")
	@ResponseBody
	public void testCom() {
		String[] coms = SmsAt.listAllSerialPorts();
		TransData.set("ports", coms);
	}

}
