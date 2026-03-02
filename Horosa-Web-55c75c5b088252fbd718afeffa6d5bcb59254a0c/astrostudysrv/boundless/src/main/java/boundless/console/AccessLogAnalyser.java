package boundless.console;

import java.util.HashMap;
import java.util.Map;

import boundless.io.FileUtility;
import boundless.types.OutParameter;
import boundless.utility.ConvertUtility;
import boundless.utility.StringUtility;

public class AccessLogAnalyser {
	
	public static LogAnalyser analyse(String[] logfiles, String keysplit, String msPrefix, String transPrefix){
		long st = System.currentTimeMillis();
		LogAnalyser analyser = new LogAnalyser();

		OutParameter<Long> counter = new OutParameter<Long>();
		counter.value = 0l;
		
		for(String logfile : logfiles){
			long fst = System.currentTimeMillis();
			OutParameter<Long> fcounter = new OutParameter<Long>();
			fcounter.value = 0l;
			FileUtility.readTextFile(logfile, (line)->{
				analyseLine(line, keysplit, msPrefix, transPrefix, analyser);
				counter.value++;
				fcounter.value++;
				if(counter.value % 100 == 0){
					System.out.println(String.format("processed %d lines ", counter.value));
				}
			});
			long delta = System.currentTimeMillis() - fst;
			System.out.println(String.format("finished in %d ms to processed %s, total %d lines ", delta, logfile, fcounter.value));
		}
		
		long delta = System.currentTimeMillis() - st;
		System.out.println(String.format("finished in %d ms to processed all logfiles, total %d lines ", delta, counter.value));
		
		return analyser;
	}

	public static LogAnalyser analyse(String logfile, String keysplit, String msPrefix, String transPrefix){
		long st = System.currentTimeMillis();
		LogAnalyser analyser = new LogAnalyser();

		OutParameter<Long> counter = new OutParameter<Long>();
		counter.value = 0l;
		
		FileUtility.readTextFile(logfile, (line)->{
			analyseLine(line, keysplit, msPrefix, transPrefix, analyser);
			counter.value++;
			if(counter.value % 100 == 0){
				System.out.println(String.format("processed %d lines ", counter.value));
			}
		});
		
		long delta = System.currentTimeMillis() - st;
		System.out.println(String.format("finished in %d ms to processed %s, total %d lines ", delta, logfile, counter.value));
		
		return analyser;
	}

	public static void analyseLine(String line, String keysplit, String msPrefix, String transPrefix, LogAnalyser analyser){
		String[] parts = line.split(keysplit);
		if(parts.length < 2 || !parts[1].startsWith(msPrefix) || !parts[1].contains(transPrefix)){
			return;
		}
		try{
			String str = parts[1].substring(msPrefix.length());
			parts = str.split(transPrefix);
			String[] tm = parts[0].split(" ");
			String[] trans = StringUtility.splitString(parts[1], '?');
			
			int ms = ConvertUtility.getValueAsInt(tm[0]);
			String transcode = trans[0];
			
			analyser.add(transcode, ms);
		}catch(Exception e){
			e.printStackTrace();
		}
	}
	
	private static class AnalyseEntry{
		public int count = 0;
		public float percent = 0;
		
		public String toString(){
			return String.format("response-count: %d; percent: %f%%", count, percent*100);
		}
	}
	
	public static class TransAnalyser{
		public String transCode;
		
		private AnalyseEntry zone10 = new AnalyseEntry();
		private AnalyseEntry zone50 = new AnalyseEntry();
		private AnalyseEntry zone100 = new AnalyseEntry();
		private AnalyseEntry zone300 = new AnalyseEntry();
		private AnalyseEntry zone500 = new AnalyseEntry();
		private AnalyseEntry zone700 = new AnalyseEntry();
		private AnalyseEntry zone1000 = new AnalyseEntry();
		private AnalyseEntry zone5000 = new AnalyseEntry();
		private AnalyseEntry zone10000 = new AnalyseEntry();
		private AnalyseEntry zoneMax = new AnalyseEntry();
		
		private int calcPercent(){
			int n = 0;
			n += zone10.count;
			n += zone50.count;
			n += zone100.count;
			n += zone300.count;
			n += zone500.count;
			n += zone700.count;
			n += zone1000.count;
			n += zone5000.count;
			n += zone10000.count;
			n += zoneMax.count;
			
			zone10.percent = zone10.count*1f/n;
			zone50.percent = zone50.count*1f/n;
			zone100.percent = zone100.count*1f/n;
			zone300.percent = zone300.count*1f/n;
			zone500.percent = zone500.count*1f/n;
			zone700.percent = zone700.count*1f/n;
			zone1000.percent = zone1000.count*1f/n;
			zone5000.percent = zone5000.count*1f/n;
			zone10000.percent = zone10000.count*1f/n;
			zoneMax.percent = zoneMax.count*1f/n;
			
			return n;
		}
		
		public void addResponseTime(int ms){
			if(ms < 10){
				zone10.count++;
			}else if(10 <= ms && ms <50){
				zone50.count++;
			}else if(50 <= ms && ms <100){
				zone100.count++;
			}else if(100 <= ms && ms <300){
				zone300.count++;
			}else if(300 <= ms && ms <500){
				zone500.count++;
			}else if(500 <= ms && ms <700){
				zone700.count++;
			}else if(700 <= ms && ms <1000){
				zone1000.count++;
			}else if(1000 <= ms && ms <5000){
				zone5000.count++;
			}else if(5000 <= ms && ms <10000){
				zone10000.count++;
			}else{
				zoneMax.count++;
			}
			
		}
		
		public String toString(){
			int total = calcPercent();
			
			StringBuilder sb = new StringBuilder();
			sb.append(transCode).append(": total ").append(total).append(" responses \r\n");
			sb.append(String.format("\t0 ~ 10ms, %s\r\n", zone10.toString()));
			sb.append(String.format("\t10 ~ 50ms, %s\r\n", zone50.toString()));
			sb.append(String.format("\t50 ~ 100ms, %s\r\n", zone100.toString()));
			sb.append(String.format("\t100 ~ 300ms, %s\r\n", zone300.toString()));
			sb.append(String.format("\t300 ~ 500ms, %s\r\n", zone500.toString()));
			sb.append(String.format("\t500 ~ 700ms, %s\r\n", zone700.toString()));
			sb.append(String.format("\t700 ~ 1000ms, %s\r\n", zone1000.toString()));
			sb.append(String.format("\t1000 ~ 5000ms, %s\r\n", zone5000.toString()));
			sb.append(String.format("\t5000 ~ 10000ms, %s\r\n", zone10000.toString()));
			sb.append(String.format("\t>10000ms, %s\r\n", zoneMax.toString()));
			
			return sb.toString();
		}
		
	}
	
	public static class LogAnalyser{
		private Map<String, TransAnalyser> map = new HashMap<String, TransAnalyser>();
		
		public void add(String transcode, int ms){
			TransAnalyser analyser = map.get(transcode);
			if(analyser == null){
				analyser = new TransAnalyser();
				analyser.transCode = transcode;
				map.put(transcode, analyser);
			}
			analyser.addResponseTime(ms);
		}
		
		public String toString(){
			StringBuilder sb = new StringBuilder();
			
			for(TransAnalyser analyser : map.values()){
				sb.append(analyser.toString()).append("\r\n");
			}
			
			return sb.toString();
		}
		
	}
	
}
