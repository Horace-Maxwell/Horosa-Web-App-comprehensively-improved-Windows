package spacex.astroesp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.spring.help.interceptor.TransData;
import spacex.basecomm.helper.MqttHelper;

@Controller
@RequestMapping("/door")
public class DoorLockController {
	
	@ResponseBody
	@RequestMapping("/locktrigger")
	public void trigger() {
		if(!TransData.containsParam("LockAction")) {
			throw new ErrorCodeException("miss.lock.action");
		}
		int lock = TransData.getValueAsInt("LockAction", 0);
		if(lock == 0) {
			MqttHelper.lockDoor();			
		}else if(lock == 1) {
			MqttHelper.unlockDoor();			
		}
	}

}
