package boundless.utility;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.LinkedList;
import java.util.List;
import java.util.function.Consumer;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.types.ExecutionGroup;
import boundless.types.OutParameter;

public class ProcessUtility {
	private static ExecutionGroup executor = new ExecutionGroup(64, "ProcessUtility");

	public static void execute(String cmd){
		try{
			Process p = Runtime.getRuntime().exec(cmd.toString());
			p.waitFor();
			p.destroy();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static void execute(String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			Process p = pb.start();
			p.waitFor();
			p.destroy();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void execute(String workdir, String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			pb.directory(new File(workdir));
			
			Process p = pb.start();
			p.waitFor();
			p.destroy();
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	private static void execute(Process p, Consumer<String> loglineHandle, Consumer<List<String>> finishHandle){
		try{
			InputStream ins = p.getInputStream();
			InputStream errs = p.getErrorStream();
			List<String> list = new LinkedList<String>();
			OutParameter<Boolean> insflag = new OutParameter<Boolean>();
			OutParameter<Boolean> errsflag = new OutParameter<Boolean>();
			insflag.value = false;
			errsflag.value = false;
			
			executor.execute(()->{
				BufferedReader reader = null;
				try {
					reader = new BufferedReader(new InputStreamReader(ins, "UTF-8"));
					String line = reader.readLine();
					while(line != null){
						list.add(line);
						try{
							if(loglineHandle != null){
								loglineHandle.accept(line);
							}
						}catch(Exception e){
							QueueLog.error(AppLoggers.ErrorLogger, e);
						}
						line = reader.readLine();
					}
				}catch(Exception e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}finally{
					insflag.value = true;
					if(reader != null){
						try {
							reader.close();
						} catch (Exception e) {
							e.printStackTrace();
						}
					}
				}
			});
			
			executor.execute(()->{
				BufferedReader reader = null;
				try {
					reader = new BufferedReader(new InputStreamReader(errs, "UTF-8"));
					String line = reader.readLine();
					while(line != null){
						list.add(line);
						try{
							if(loglineHandle != null){
								loglineHandle.accept(line);
							}
						}catch(Exception e){
							QueueLog.error(AppLoggers.ErrorLogger, e);
						}
						line = reader.readLine();
					}
				}catch(Exception e) {
					QueueLog.error(AppLoggers.ErrorLogger, e);
				}finally{
					errsflag.value = true;
					if(reader != null){
						try {
							reader.close();
						} catch (Exception e) {
							e.printStackTrace();
						}
					}
				}
			});
			
			p.waitFor();
			
			long ms = System.currentTimeMillis();
			while(!insflag.value || !errsflag.value){
				QueueLog.debug(AppLoggers.DebugLogger, "wait for finish receiving program output");
				
				Thread.sleep(100);
				long delta = System.currentTimeMillis() - ms;
				if(delta > 10000){
					long sec = delta / 1000;
					QueueLog.error(AppLoggers.ErrorLogger, "wait {} sec for finish receiving program output", sec);
				}
			}
			if(finishHandle != null){
				finishHandle.accept(list);
			}
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}

	public static void execute(String cmd, Consumer<String> loglineHandle, Consumer<List<String>> finishHandle){
		try{
			Process p = Runtime.getRuntime().exec(cmd.toString());
			execute(p, loglineHandle, finishHandle);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void execute(Consumer<String> loglineHandle, Consumer<List<String>> finishHandle, String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			
			Process p = pb.start();
			execute(p, loglineHandle, finishHandle);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void execute(String workdir, Consumer<String> loglineHandle, Consumer<List<String>> finishHandle, String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			pb.directory(new File(workdir));
			
			Process p = pb.start();
			execute(p, loglineHandle, finishHandle);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	
	public static void execute(Consumer<String> loglineHandle, String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			
			Process p = pb.start();
			execute(p, loglineHandle, null);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void execute(String workdir, Consumer<String> loglineHandle, String... cmds){
		try{
			ProcessBuilder pb = new ProcessBuilder(cmds);
			pb.directory(new File(workdir));
			
			Process p = pb.start();
			execute(p, loglineHandle, null);
		}catch(Exception e){
			throw new RuntimeException(e);
		}
	}
	
	public static void shutdown(){
		executor.close();
	}
	
}
