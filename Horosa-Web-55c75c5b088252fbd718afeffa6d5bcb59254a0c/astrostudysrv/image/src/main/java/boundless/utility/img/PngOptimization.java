package boundless.utility.img;

import com.googlecode.pngtastic.core.PngChunk;
import com.googlecode.pngtastic.core.PngFilterType;
import com.googlecode.pngtastic.core.PngImage;
import com.googlecode.pngtastic.core.PngProcessor;
import com.googlecode.pngtastic.core.processing.PngByteArrayOutputStream;
import com.googlecode.pngtastic.core.processing.ZopfliCompressionHandler;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

/**
 * Optimizes PNG images for smallest possible filesize.
 *
 * @author rayvanderborght
 */
public class PngOptimization extends PngProcessor {

	private boolean generateDataUriCss = false;
	public void setGenerateDataUriCss(boolean generateDataUriCss) { this.generateDataUriCss = generateDataUriCss; }

	private final List<OptimizerResult> results = new ArrayList<OptimizerResult>();
	public List<OptimizerResult> getResults() { return results; }

	public PngOptimization() {
		this("NONE");
	}

	public PngOptimization(String logLevel) {
		super(logLevel);
	}

	/** */
	public void optimize(byte[] imgdata, String outputFileName, boolean removeGamma, Integer compressionLevel)
			throws IOException {

		QueueLog.debug(AppLoggers.DebugLogger, "=== OPTIMIZING ===");

		final long start = System.currentTimeMillis();
		ByteArrayInputStream bis = new ByteArrayInputStream(imgdata);
		PngImage image = new PngImage(bis);
		final PngImage optimized = optimize(image, removeGamma, compressionLevel);

		final ByteArrayOutputStream optimizedBytes = new ByteArrayOutputStream();
		final long optimizedSize = optimized.writeDataOutputStream(optimizedBytes).size();

		final long originalFileSize = imgdata.length;

		final byte[] optimalBytes = (optimizedSize < originalFileSize) ? optimizedBytes.toByteArray() : imgdata;

		final File exported = optimized.export(outputFileName, optimalBytes);

		final long optimizedFileSize = exported.length();
		final long time = System.currentTimeMillis() - start;

		QueueLog.debug(AppLoggers.DebugLogger, "Optimized in {} milliseconds, size {}", time, optimizedSize);
		QueueLog.debug(AppLoggers.DebugLogger, "Original length in bytes: {} ({})", originalFileSize, image.getFileName());
		QueueLog.debug(AppLoggers.DebugLogger, "Final length in bytes: {} ({})", optimizedFileSize, outputFileName);

		final long fileSizeDifference = (optimizedFileSize <= originalFileSize)
				? (originalFileSize - optimizedFileSize) : -(optimizedFileSize - originalFileSize);

		QueueLog.debug(AppLoggers.DebugLogger, "{}% :{}dB ->{}dB ({}dB saved) - {}",
				fileSizeDifference / Float.valueOf(originalFileSize) * 100,
				originalFileSize, optimizedFileSize, fileSizeDifference, outputFileName);

		final String dataUri = (generateDataUriCss) ? pngCompressionHandler.encodeBytes(optimalBytes) : null;

		results.add(new OptimizerResult(image.getFileName(), originalFileSize, optimizedFileSize, image.getWidth(), image.getHeight(), dataUri));
	}

	public void optimize(InputStream imgIns, long imgsz, String outputFileName, boolean removeGamma, Integer compressionLevel)
			throws IOException {

		QueueLog.debug(AppLoggers.DebugLogger, "=== OPTIMIZING ===");

		final long start = System.currentTimeMillis();
		PngImage image = new PngImage(imgIns);
		final PngImage optimized = optimize(image, removeGamma, compressionLevel);

		final ByteArrayOutputStream optimizedBytes = new ByteArrayOutputStream();
		final long optimizedSize = optimized.writeDataOutputStream(optimizedBytes).size();

		final long originalFileSize = imgsz;

		final byte[] optimalBytes = (optimizedSize < originalFileSize) ? optimizedBytes.toByteArray() : FileUtility.getBytesFromStream(imgIns);

		final File exported = optimized.export(outputFileName, optimalBytes);

		final long optimizedFileSize = exported.length();
		final long time = System.currentTimeMillis() - start;

		QueueLog.debug(AppLoggers.DebugLogger, "Optimized in {} milliseconds, size {}", time, optimizedSize);
		QueueLog.debug(AppLoggers.DebugLogger, "Original length in bytes: {} ({})", originalFileSize, image.getFileName());
		QueueLog.debug(AppLoggers.DebugLogger, "Final length in bytes: {} ({})", optimizedFileSize, outputFileName);

		final long fileSizeDifference = (optimizedFileSize <= originalFileSize)
				? (originalFileSize - optimizedFileSize) : -(optimizedFileSize - originalFileSize);

		QueueLog.debug(AppLoggers.DebugLogger, "{}% :{}dB ->{}dB ({}dB saved) - {}",
				fileSizeDifference / Float.valueOf(originalFileSize) * 100,
				originalFileSize, optimizedFileSize, fileSizeDifference, outputFileName);

		final String dataUri = (generateDataUriCss) ? pngCompressionHandler.encodeBytes(optimalBytes) : null;

		results.add(new OptimizerResult(image.getFileName(), originalFileSize, optimizedFileSize, image.getWidth(), image.getHeight(), dataUri));
	}

	/** */
	public PngImage optimize(PngImage image) throws IOException {
		return optimize(image, false, null);
	}

	/** */
	public PngImage optimize(PngImage image, boolean removeGamma, Integer compressionLevel) throws IOException {
		// FIXME: support low bit depth interlaced images
		if (image.getInterlace() == 1 && image.getSampleBitCount() < 8) {
			return image;
		}

		final PngImage result = new PngImage(log);
		result.setInterlace((short) 0);

		final Iterator<PngChunk> itChunks = image.getChunks().iterator();
		PngChunk chunk = processHeadChunks(result, removeGamma, itChunks);

		// collect image data chunks
		final PngByteArrayOutputStream inflatedImageData = getInflatedImageData(chunk, itChunks);

		final int scanlineLength = (int)(Math.ceil(image.getWidth() * image.getSampleBitCount() / 8F)) + 1;

		final List<byte[]> originalScanlines = (image.getInterlace() == 1)
				? pngInterlaceHandler.deInterlace((int) image.getWidth(), (int) image.getHeight(), image.getSampleBitCount(), inflatedImageData)
				: getScanlines(inflatedImageData, image.getSampleBitCount(), scanlineLength, image.getHeight());

		// TODO: use this for bit depth reduction
//		Map<PngPixel, Integer> colors = getColors(image, originalScanlines, 32);

		// apply each type of filtering
		final Map<PngFilterType, List<byte[]>> filteredScanlines = new HashMap<PngFilterType, List<byte[]>>();
		for (PngFilterType filterType : PngFilterType.standardValues()) {
			QueueLog.debug(AppLoggers.DebugLogger, "Applying filter: {}", filterType);
			final List<byte[]> scanlines = copyScanlines(originalScanlines);
			pngFilterHandler.applyFiltering(filterType, scanlines, image.getSampleBitCount());

			filteredScanlines.put(filterType, scanlines);
		}

		// pick the filter that compresses best
		PngFilterType bestFilterType = null;
		byte[] deflatedImageData = null;
		for (Entry<PngFilterType, List<byte[]>> entry : filteredScanlines.entrySet()) {
			final byte[] imageResult = pngCompressionHandler.deflate(serialize(entry.getValue()), compressionLevel, true);
			if (deflatedImageData == null || imageResult.length < deflatedImageData.length) {
				deflatedImageData = imageResult;
				bestFilterType = entry.getKey();
			}
		}

		// see if adaptive filtering results in even better compression
		final List<byte[]> scanlines = copyScanlines(originalScanlines);
		pngFilterHandler.applyAdaptiveFiltering(inflatedImageData, scanlines, filteredScanlines, image.getSampleBitCount());

		final byte[] adaptiveImageData = pngCompressionHandler.deflate(inflatedImageData, compressionLevel, true);
		QueueLog.debug(AppLoggers.DebugLogger, "Original={}, Adaptive={}, {}={}", image.getImageData().length, adaptiveImageData.length,
				bestFilterType, (deflatedImageData == null) ? 0 : deflatedImageData.length);

		if (deflatedImageData == null || adaptiveImageData.length < deflatedImageData.length) {
			deflatedImageData = adaptiveImageData;
			bestFilterType = PngFilterType.ADAPTIVE;
		}

		final PngChunk imageChunk = new PngChunk(PngChunk.IMAGE_DATA.getBytes(), deflatedImageData);
		result.addChunk(imageChunk);

		// finish it
		while (chunk != null) {
			if (chunk.isCritical() && !PngChunk.IMAGE_DATA.equals(chunk.getTypeString())) {
				ByteArrayOutputStream bytes = new ByteArrayOutputStream(chunk.getLength());
				DataOutputStream data = new DataOutputStream(bytes);

				data.write(chunk.getData());
				data.close();

				PngChunk newChunk = new PngChunk(chunk.getType(), bytes.toByteArray());
				result.addChunk(newChunk);
			}
			chunk = itChunks.hasNext() ? itChunks.next() : null;
		}

		// make sure we have the IEND chunk
		final List<PngChunk> chunks = result.getChunks();
		if (chunks != null && !PngChunk.IMAGE_TRAILER.equals(chunks.get(chunks.size() - 1).getTypeString())) {
			result.addChunk(new PngChunk(PngChunk.IMAGE_TRAILER.getBytes(), new byte[] { }));
		}

		return result;
	}

	/* */
	private List<byte[]> copyScanlines(List<byte[]> original) {
		final List<byte[]> copy = new ArrayList<byte[]>(original.size());
		for (byte[] scanline : original) {
			copy.add(scanline.clone());
		}

		return copy;
	}

	/* */
	private PngByteArrayOutputStream serialize(List<byte[]> scanlines) {
		final int scanlineLength = scanlines.get(0).length;
		final byte[] imageData = new byte[scanlineLength * scanlines.size()];
		for (int i = 0; i < scanlines.size(); i++) {
			final int offset = i * scanlineLength;
			final byte[] scanline = scanlines.get(i);
			System.arraycopy(scanline, 0, imageData, offset, scanlineLength);
		}

		return new PngByteArrayOutputStream(imageData);
	}

	/**
	 * Holds info about an image file optimization
	 */
	public static class OptimizerResult {
		private long originalFileSize;
		public long getOriginalFileSize() { return originalFileSize; }

		private long optimizedFileSize;
		public long getOptimizedFileSize() { return optimizedFileSize; }

		private String fileName;
		private long width;
		private long height;
		private String dataUri;

		public OptimizerResult(String fileName, long originalFileSize, long optimizedFileSize, long width, long height, String dataUri) {
			this.originalFileSize = originalFileSize;
			this.optimizedFileSize = optimizedFileSize;
			this.fileName = fileName;
			this.width = width;
			this.height = height;
			this.dataUri = dataUri;
		}
	}

	/**
	 * Get the number of bytes saved in all images processed so far
	 *
	 * @return The number of bytes saved
	 */
	public long getTotalSavings() {
		long totalSavings = 0;
		for (OptimizerResult result : results) {
			totalSavings += (result.getOriginalFileSize() - result.getOptimizedFileSize());
		}

		return totalSavings;
	}

	/**
	 * Get the css containing data uris of the images processed by the optimizer
	 */
	public void generateDataUriCss(String dir) throws IOException {
		final String path = (dir == null) ? "" : dir + "/";
		final PrintWriter out = new PrintWriter(path + "DataUriCss.html");

		try {
			out.append("<html>\n<head>\n\t<style>");

			for (OptimizerResult result : results) {
				final String name = result.fileName.replaceAll("[^A-Za-z0-9]", "_");
				out.append('#').append(name).append(" {\n")
						.append("\tbackground: url(\"data:image/png;base64,")
						.append(result.dataUri).append("\") no-repeat left top;\n")
						.append("\twidth: ").append(String.valueOf(result.width)).append("px;\n")
						.append("\theight: ").append(String.valueOf(result.height)).append("px;\n")
						.append("}\n");
			}
			out.append("\t</style>\n</head>\n<body>\n");

			for (OptimizerResult result : results) {
				final String name = result.fileName.replaceAll("[^A-Za-z0-9]", "_");
				out.append("\t<div id=\"").append(name).append("\"></div>\n");
			}

			out.append("</body>\n</html>");
		} finally {
			if (out != null) {
				out.close();
			}
		}
	}

	protected void printData(byte[] inflatedImageData) {
		final StringBuilder result = new StringBuilder();
		for (byte b : inflatedImageData) {
			result.append(String.format("%2x|", b));
		}
		QueueLog.debug(AppLoggers.DebugLogger, result.toString());
	}

	public void setCompressor(String compressor, Integer iterations) {
		if ("zopfli".equals(compressor)) {
			if (iterations != null) {
				pngCompressionHandler = new ZopfliCompressionHandler(log, iterations);
			} else {
				pngCompressionHandler = new ZopfliCompressionHandler(log);
			}
		}
	}
}
