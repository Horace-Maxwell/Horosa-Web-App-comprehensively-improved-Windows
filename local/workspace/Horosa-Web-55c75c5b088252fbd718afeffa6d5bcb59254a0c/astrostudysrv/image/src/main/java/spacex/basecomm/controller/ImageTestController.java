package spacex.basecomm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.spring.help.interceptor.TransData;
import boundless.types.FileType;
import boundless.utility.StringUtility;
import boundless.utility.img.ImageUtility;

@Controller
@RequestMapping("/test")
public class ImageTestController {

	@RequestMapping("/qrcode")
	@ResponseBody
	public void qrcode() {
    	String[] txt = new String[] {
    			"WLYHXWHYSDE0591DDC-D-4-1", "WLYHXWHYSDE0591DDC-D-WD-5__^title^__现场控制器", "wlyhxwhzx0D0591DDC_D_WD_5"
    	};
    	String logob64 = TransData.getValueAsString("Logo");
    	String str = TransData.getValueAsString("Text");
    	if(!StringUtility.isNullOrEmpty(str)) {
    		txt = new String[] {str};
    	}

    	byte[] qrimg = ImageUtility.getQRCodeWithLogoBase64(txt, 600, logob64, 40, 2000, true);
    	TransData.setRawData(qrimg, FileType.PNG, StringUtility.getUUID());
	} 
	
	
}
