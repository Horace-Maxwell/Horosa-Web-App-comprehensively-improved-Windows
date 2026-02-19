package boundless.utility;

import java.io.File;

import org.apache.commons.io.monitor.FileAlterationListener;
import org.apache.commons.io.monitor.FileAlterationMonitor;
import org.apache.commons.io.monitor.FileAlterationObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import boundless.log.AppLoggers;
import boundless.log.QueueLog;

public class FilePathWatcher {
	
	static private FileAlterationMonitor _monitor = new FileAlterationMonitor();
	

	public static void stopMonitor() {
		if (_monitor != null) {
			try {
				_monitor.stop();
			} catch (Exception e) {
				e.printStackTrace();
			}
			_monitor = null;
		}
	}
	
	public static void startMonitor(){
		try {
			if(_monitor == null){
				_monitor = new FileAlterationMonitor();
			}
			_monitor.start();
			QueueLog.info(AppLoggers.InfoLogger, "start to file directory monitor ");
		} catch (Exception e) {
			throw new RuntimeException();
		}
	}


	protected String _fileName;
	protected String _xmlFilePath;
	protected String _path;

	public FilePathWatcher(String xmlFilePath) {
		File xmlfile = new File(xmlFilePath);
		this._fileName = xmlfile.getName();
		this._xmlFilePath = xmlFilePath;
		this._path = xmlfile.getParent();
		QueueLog.info(AppLoggers.InfoLogger, "create FilePathWatcher, ready to monitor file: " + this._xmlFilePath);

		FileAlterationObserver observer = generateObserver();
		if(_monitor == null){
			_monitor = new FileAlterationMonitor();
		}
		_monitor.addObserver(observer);
	}
	
	protected FileAlterationObserver generateObserver(){
		File pathfile = new File(this._path);
		FileAlterationObserver observer = new FileAlterationObserver(pathfile);
		observer.addListener( new FileAlterationListener() {

			// here you have to implement some methods, this is the pertinent
			// one for you:
			@Override
			public void onDirectoryDelete(File directory) {
				QueueLog.info(AppLoggers.InfoLogger, directory.getName() + " deleted");
			}

			@Override
			public void onDirectoryChange(File arg0) {
				QueueLog.info(AppLoggers.InfoLogger, arg0.getName() + " changed");
			}

			@Override
			public void onDirectoryCreate(File arg0) {
				QueueLog.info(AppLoggers.InfoLogger, arg0.getName() + " created");
			}

			@Override
			public void onFileChange(File arg0) {
				String filename = arg0.getName();
				doChange(filename);
			}

			@Override
			public void onFileCreate(File arg0) {
				QueueLog.info(AppLoggers.InfoLogger, arg0.getName() + " created");

			}

			@Override
			public void onFileDelete(File arg0) {
				QueueLog.info(AppLoggers.InfoLogger, arg0.getName() + " deleted");
			}

			@Override
			public void onStart(FileAlterationObserver arg0) {
				// String dir = arg0.getDirectory().getAbsolutePath();
				// log.info("started checking dir: " + dir);
			}

			@Override
			public void onStop(FileAlterationObserver arg0) {
				// String dir = arg0.getDirectory().getAbsolutePath();
				// log.info("stopped checking dir: " + dir);
			}
		});
		
		return observer;
	}

	protected void doChange(String filename) {
		QueueLog.info(AppLoggers.InfoLogger, filename + " has changed");
	}

}
