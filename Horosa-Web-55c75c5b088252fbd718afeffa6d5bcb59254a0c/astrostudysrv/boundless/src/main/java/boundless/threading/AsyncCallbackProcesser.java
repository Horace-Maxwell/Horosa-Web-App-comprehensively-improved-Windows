package boundless.threading;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

import boundless.log.*;

/**
 * 异步回调处理器
 *
 */
public class AsyncCallbackProcesser implements ITicker
{
  private static Hashtable<Thread, AsyncCallbackProcesser> _processers = new Hashtable<Thread, AsyncCallbackProcesser>();

  private ConcurrentLinkedQueue<CallbackExecutor> _callbackQueue = new ConcurrentLinkedQueue<CallbackExecutor>();
  private boolean _busy=false;
  private boolean _binding = false;
  private Logger _logger;

  public void tick()
  {
      this._busy= false;
      if (!_binding) {
          _binding = true;
          _processers.put(Thread.currentThread(),this);
      }
      processCallback();
  }

  boolean isBusy()
  {
      return _busy;
  }

  /**
   * 回调结果
   * @param callback
   * @param args
   */
  void callback(Consumer<Object> callback,Object args)
  {
      this._callbackQueue.add(new CallbackExecutor(callback,args));
  }

  private void processCallback()
  {
      while (true)
      {
    	  CallbackExecutor executor =_callbackQueue.poll();
          if (executor == null) break;
          try
          {
              this._busy = true;
              executor.execute();
          }
          catch (Throwable ex)
          {
              if (_logger != null) _logger.writeLog(ex);
          }
      }
  }

  /**
   * 获得日志处理类
   * @return
   */
  public Logger logger()
  {
      return _logger;
  }
  /**
   * 设置日志处理类
   * @param value
   */
  public void logger(Logger value)
  {
      _logger=value;
  }

  /**
   * 获得当前异步回调处理器
   * @return
   */
  public static AsyncCallbackProcesser current()
  {
      return _processers.get(Thread.currentThread());
  }
  
  private class CallbackExecutor{
	  private Consumer<Object> _callback;
	  private Object _args;
	  
	  public CallbackExecutor(Consumer<Object> callback,Object args){
		  this._callback=callback;
		  this._args=args;
	  }
	  
	  public void execute(){
		  if (_callback!=null) _callback.accept(_args);
	  }
  }
}
