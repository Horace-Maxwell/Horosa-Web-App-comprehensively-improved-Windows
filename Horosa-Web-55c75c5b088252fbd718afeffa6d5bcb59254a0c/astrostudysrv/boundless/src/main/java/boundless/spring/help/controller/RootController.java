package boundless.spring.help.controller;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import org.springframework.aop.support.AopUtils;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import boundless.exception.ErrorCodeException;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.spring.help.interceptor.KeyConstants;
import boundless.spring.help.interceptor.TransData;
import boundless.types.Tuple;

@Controller
public class RootController implements ApplicationContextAware {
	
	private static Map<String, Tuple<Object, Method>> transMap = new HashMap<String, Tuple<Object, Method>>();
	
	private ApplicationContext appContext;
	
	@Override
	public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
		this.appContext = applicationContext;
	}
	
	private void initTransMap() {
		Map<String, Object> controllers = appContext.getBeansWithAnnotation(Controller.class);
		for(Map.Entry<String, Object> entry : controllers.entrySet()) {
			Object value = entry.getValue();
			String beanname = entry.getKey();
			Class<?> cls = AopUtils.getTargetClass(value);
			RequestMapping mapping = cls.getAnnotation(RequestMapping.class);
			if(mapping == null) {
				continue;
			}
			String[] pathes = mapping.value();
			if(pathes == null || pathes.length == 0) {
				continue;
			}
			
			String path = null;
			for(String p : pathes) {
				if(p.startsWith("/norest")) {
					path = p;
					break;
				}
			}
			if(path == null) {
				continue;
			}
			
			Object obj = appContext.getBean(beanname);
			
			Method[] methods = cls.getMethods();
			for(Method meth : methods) {
				RequestMapping funmapping = meth.getAnnotation(RequestMapping.class);
				if(funmapping == null) {
					continue;
				}
				String[] ary = funmapping.value();
				if(ary == null || ary.length == 0) {
					continue;
				}
				
				for(String p : ary) {
					String key = String.format("/norest/%s", p);
					if(p.startsWith("/")) {
						key = String.format("/norest%s", p);
					}
					
					Tuple<Object, Method> tuple = new Tuple<Object, Method>(obj, meth);
					transMap.put(key, tuple);
				}
			}
		}
		
	}
	
	private Object doTrans() {
		if(transMap.isEmpty()) {
			initTransMap();
		}
		
		String trans = (String)TransData.getRequestHeader(KeyConstants.NoRestTransCode);
		if(trans == null) {
			throw new ErrorCodeException(5999999, "err_miss_transcode");
		}
		String trancode = String.format("/norest/%s", trans);
		if(trans.startsWith("/")) {
			trancode = String.format("/norest%s", trans);
		}
		TransData.setNoRestTransCode(trancode);
		
		Tuple<Object, Method> tuple = transMap.get(trancode);
		if(tuple == null) {
			throw new ErrorCodeException(6000000, "err_unimplemented");
		}
		
		Object obj = tuple.item1();
		Method method = tuple.item2();
		try {
			return method.invoke(obj);			 
		}catch(InvocationTargetException e) {
			Throwable err = e.getTargetException();
			if(err instanceof ErrorCodeException) {
				throw (ErrorCodeException)err;
			}
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new ErrorCodeException(err);
		}catch(Exception e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
			throw new ErrorCodeException(999, "err_inner_error");
		}
	}
	
	@RequestMapping("/")
	@ResponseBody
	public Object execute() {
		boolean norestful = TransData.isNoRestful();
		if(!norestful) {
			return null;
		}
		
		return doTrans();
	}

}
