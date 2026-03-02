package boundless.utility.img;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOInvalidTreeException;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.metadata.IIOMetadataNode;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.swing.ImageIcon;

import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import boundless.io.FileUtility;
import boundless.log.AppLoggers;
import boundless.log.QueueLog;
import boundless.utility.ConvertUtility;
import boundless.utility.ProcessUtility;
import boundless.utility.StringUtility;

public class GifUtility {
	public static final String DISPOSE_NONE = "none";
	public static final String DISPOSE_PREVIOUS = "restoreToPrevious";
	public static final String DISPOSE_BACKGROUND = "restoreToBackgroundColor";
	
	public static void configure(IIOMetadata meta, String delayTime, String dispose, int imageIndex) {
		String metaFormat = meta.getNativeMetadataFormatName();

		if (!"javax_imageio_gif_image_1.0".equals(metaFormat)) {
			throw new IllegalArgumentException(
					"Unfamiliar gif metadata format: " + metaFormat);
		}

		Node root = meta.getAsTree(metaFormat);

		//find the GraphicControlExtension node
		Node child = root.getFirstChild();
		while (child != null) {
			if ("GraphicControlExtension".equals(child.getNodeName())) {
				break;
			}
			child = child.getNextSibling();
		}

		IIOMetadataNode gce = (IIOMetadataNode) child;
		gce.setAttribute("userInputFlag", "FALSE");
		gce.setAttribute("disposalMethod", dispose);
		gce.setAttribute("delayTime", delayTime);

		//only the first node needs the ApplicationExtensions node
		if (imageIndex == 0) {
			IIOMetadataNode aes =
					new IIOMetadataNode("ApplicationExtensions");
			IIOMetadataNode ae =
					new IIOMetadataNode("ApplicationExtension");
			ae.setAttribute("applicationID", "NETSCAPE");
			ae.setAttribute("authenticationCode", "2.0");
			byte[] uo = new byte[]{
					//last two bytes is an unsigned short (little endian) that
					//indicates the the number of times to loop.
					//0 means loop forever.
					0x1, 0x0, 0x0
			};
			ae.setUserObject(uo);
			aes.appendChild(ae);
			root.appendChild(aes);
		}

		try {
			meta.setFromTree(metaFormat, root);
		} catch (IIOInvalidTreeException e) {
			//shouldn't happen
			throw new RuntimeException(e);
		}
	}

	public static void saveAnimate(BufferedImage[] frames, String delayTime, String dispose, File file) throws Exception {
		FileUtility.createDirectory(file.getAbsolutePath());
		ImageWriter iw = ImageIO.getImageWritersByFormatName("gif").next();

		ImageOutputStream ios = ImageIO.createImageOutputStream(file);
		iw.setOutput(ios);
		iw.prepareWriteSequence(null);

		for (int i = 0; i < frames.length; i++) {
			BufferedImage src = frames[i];
			ImageWriteParam iwp = iw.getDefaultWriteParam();
			IIOMetadata metadata = iw.getDefaultImageMetadata(
					new ImageTypeSpecifier(src), iwp);

			configure(metadata, delayTime, dispose, i);

			IIOImage ii = new IIOImage(src, null, metadata);
			iw.writeToSequence(ii, (ImageWriteParam) null);
		}

		iw.endWriteSequence();

		ios.close();
	}

	public static void saveAnimate(ImageFrame[] frames, File file) throws Exception {
		FileUtility.createDirectory(file.getAbsolutePath());
		ImageWriter iw = ImageIO.getImageWritersByFormatName("gif").next();

		ImageOutputStream ios = ImageIO.createImageOutputStream(file);
		iw.setOutput(ios);
		iw.prepareWriteSequence(null);

		for (int i = 0; i < frames.length; i++) {
			BufferedImage src = frames[i].getImage();
			ImageWriteParam iwp = iw.getDefaultWriteParam();
			IIOMetadata metadata = iw.getDefaultImageMetadata(
					new ImageTypeSpecifier(src), iwp);

			configure(metadata, frames[i].getDelay()+"", frames[i].getDisposal(), i);

			IIOImage ii = new IIOImage(src, null, metadata);
			iw.writeToSequence(ii, (ImageWriteParam) null);
		}

		iw.endWriteSequence();

		ios.close();
	}
	
	public static void saveGif(GifImage gif, File file){
		try {
			saveAnimate(gif.frames, file);
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
	
	public static void saveGif(GifImage gif, String filename){
		File file = new File(filename);
		saveGif(gif, file);
	}


	public static GifImage readGIF(ImageReader reader) throws IOException {
	    ArrayList<ImageFrame> frames = new ArrayList<ImageFrame>(2);

	    int width = -1;
	    int height = -1;

	    IIOMetadata metadata = reader.getStreamMetadata();
	    if (metadata != null) {
	        IIOMetadataNode globalRoot = (IIOMetadataNode) metadata.getAsTree(metadata.getNativeMetadataFormatName());

	        NodeList globalScreenDescriptor = globalRoot.getElementsByTagName("LogicalScreenDescriptor");

	        if (globalScreenDescriptor != null && globalScreenDescriptor.getLength() > 0) {
	            IIOMetadataNode screenDescriptor = (IIOMetadataNode) globalScreenDescriptor.item(0);

	            if (screenDescriptor != null) {
	                width = Integer.parseInt(screenDescriptor.getAttribute("logicalScreenWidth"));
	                height = Integer.parseInt(screenDescriptor.getAttribute("logicalScreenHeight"));
	            }
	        }
	    }

	    BufferedImage master = null;
	    Graphics2D masterGraphics = null;
	    int failcnt = 0;
	    for (int frameIndex = 0;; frameIndex++) {
	        BufferedImage image;
	        try {
	            image = reader.read(frameIndex);
	        } catch (IndexOutOfBoundsException io) {
	        	if(failcnt < 3){
	        		failcnt++;
	        		continue;
	        	}
	            break;
	        }
	        failcnt = 0;
	        
	        if (width == -1 || height == -1) {
	            width = image.getWidth();
	            height = image.getHeight();
	        }

	        IIOMetadataNode root = (IIOMetadataNode) reader.getImageMetadata(frameIndex).getAsTree("javax_imageio_gif_image_1.0");
	        IIOMetadataNode gce = (IIOMetadataNode) root.getElementsByTagName("GraphicControlExtension").item(0);
	        int delay = Integer.valueOf(gce.getAttribute("delayTime"));
	        String disposal = gce.getAttribute("disposalMethod");

	        int x = 0;
	        int y = 0;

	        if (master == null) {
	            master = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
	            masterGraphics = master.createGraphics();
	            masterGraphics.setBackground(new Color(0, 0, 0, 0));
	        } else {
	            NodeList children = root.getChildNodes();
	            for (int nodeIndex = 0; nodeIndex < children.getLength(); nodeIndex++) {
	                Node nodeItem = children.item(nodeIndex);
	                if (nodeItem.getNodeName().equals("ImageDescriptor")) {
	                    NamedNodeMap map = nodeItem.getAttributes();
	                    x = Integer.valueOf(map.getNamedItem("imageLeftPosition").getNodeValue());
	                    y = Integer.valueOf(map.getNamedItem("imageTopPosition").getNodeValue());
	                }
	            }
	        }
	        masterGraphics.drawImage(image, x, y, null);

	        BufferedImage copy = new BufferedImage(master.getColorModel(), master.copyData(null), master.isAlphaPremultiplied(), null);
	        ImageFrame frame = new ImageFrame(copy, delay, disposal);
	        frames.add(frame);

	        if (disposal.equals("restoreToPrevious")) {
	            BufferedImage from = null;
	            for (int i = frameIndex - 1; i >= 0; i--) {
	                if (!frames.get(i).getDisposal().equals("restoreToPrevious") || frameIndex == 0) {
	                    from = frames.get(i).getImage();
	                    break;
	                }
	            }
	            if(frameIndex == 0){
	            	from = frames.get(0).getImage();
	            }
	            if(from != null){
		            master = new BufferedImage(from.getColorModel(), from.copyData(null), from.isAlphaPremultiplied(), null);
		            masterGraphics = master.createGraphics();
		            masterGraphics.setBackground(new Color(0, 0, 0, 0));
	            }else{
	            	masterGraphics.clearRect(x, y, image.getWidth(), image.getHeight());
	            }
	        } else if (disposal.equals("restoreToBackgroundColor")) {
	            masterGraphics.clearRect(x, y, image.getWidth(), image.getHeight());
	        }
	    }
	    reader.dispose();

	    GifImage gif = new GifImage();
	    gif.frames = frames.toArray(new ImageFrame[frames.size()]);
	    gif.width = width;
	    gif.height = height;
	    return gif;
	}

	public static GifImage readGIF(String gifFile){
		ImageReader ir = null;
		ImageInputStream iis = null;
		try{
			ir = ImageIO.getImageReadersByFormatName("gif").next();
			File file = new File(gifFile);
			iis = ImageIO.createImageInputStream(file);
			ir.setInput(iis);
			
			return readGIF(ir);
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(iis != null){
				try{
					iis.close();
				}catch(Exception e){
					
				}
			}
		}
		
	}
	
	public static GifImage readGIF(byte[] data){
		InputStream ins = new ByteArrayInputStream(data);
		return readGIF(ins);
	}

	public static GifImage readGIF(InputStream instream){
		ImageReader ir = null;
		ImageInputStream iis = null;
		try{
			ir = ImageIO.getImageReadersByFormatName("gif").next();
			iis = ImageIO.createImageInputStream(instream);
			ir.setInput(iis);
			
			return readGIF(ir);
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(iis != null){
				try{
					iis.close();
				}catch(Exception e){
					
				}
			}
		}
		
	}
	
	public static GifImage readGIF(File file){
		InputStream ins = null;
		GifImage gif = null;
		try{
			ins = new FileInputStream(file);
			gif = GifUtility.readGIF(ins);
		}catch(Exception e){
			throw new RuntimeException(e);
		}finally{
			if(ins != null){
				try {
					ins.close();
				} catch (IOException e) {
				}
			}
		}
		return gif;
	}
	
	public static GifImage readBadGif(String filename){
		ImageIcon icon = new ImageIcon(filename);
		Image image = icon.getImage();
		int w = image.getWidth(null);
		int h = image.getHeight(null);
		BufferedImage buffImage = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
		Graphics2D g = buffImage.createGraphics();
        g.setColor(Color.white);
        g.fillRect(0, 0, w, h);
	    g.drawImage(image, 0, 0, null);
	    g.dispose();
	    
	    ImageFrame frame = new ImageFrame(buffImage, 10, DISPOSE_PREVIOUS);
	    
	    GifImage gif = new GifImage();
	    gif.frames = new ImageFrame[]{ frame };
	    gif.width = w;
	    gif.height = h;
	    gif.filename = filename;
	    
	    return gif;
	}

	public static GifImage readGifByIM(String impath, String filename){
		String identify = impath + "identify";
		String[] cmds = new String[]{
			identify, filename
		};
			
		List<String> lines = new ArrayList<String>();
		ProcessUtility.execute((line)->{
		}, (list)->{
			lines.addAll(list);
		}, cmds);
		
		String convert = impath + "convert";
		int i = 0;
		GifImage gif = new GifImage();
		gif.filename = filename;
		List<ImageFrame> frames = new ArrayList<ImageFrame>();
		for(String line : lines){
			String frame = String.format("%s[%d]", filename, i);
			String tmpfn = String.format("%s_%d.gif", filename, i);
			i++;
			cmds = new String[]{
				convert, frame, tmpfn
			};
			ProcessUtility.execute((str)->{
			}, (list)->{
			}, cmds);
			
			String[] parts = StringUtility.splitString(line, ' ');
			String[] dim = StringUtility.splitString(parts[3], '+');
			String[] wh = StringUtility.splitString(dim[0], 'x');
			int w = ConvertUtility.getValueAsInt(wh[0]);
			int h = ConvertUtility.getValueAsInt(wh[1]);
			int x = ConvertUtility.getValueAsInt(dim[1]);
			int y = ConvertUtility.getValueAsInt(dim[2]);
			if(gif.width == 0){
				gif.width = w;
				gif.height = h;
			}
			
			GifImage tmpgif = GifUtility.readGIF(tmpfn);
			ImageFrame tmpframe = tmpgif.frames[0];
			BufferedImage buf = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
			Graphics2D g = buf.createGraphics();
			g.drawImage(tmpframe.getImage(), x, y, null);
			g.dispose();
			
			ImageFrame frm = new ImageFrame(buf, tmpframe.getDelay(), tmpframe.getDisposal());
			frames.add(frm);
			FileUtility.delete(tmpfn);
		}
		
		gif.frames = new ImageFrame[frames.size()];
		if(gif.frames.length > 0){
			frames.toArray(gif.frames);
		}
		return gif;

	}
	
	public static GifImage resize(GifImage gif, int newWidth, int newHeight){
		GifImage newGif = new GifImage();
		newGif.width = newWidth;
		newGif.height = newHeight;
		newGif.frames = new ImageFrame[gif.frames.length];
		
		double wratio = newWidth*1.0 / gif.width;
		double hratio = newHeight*1.0 / gif.height;
		
		for(int i=0; i<gif.frames.length; i++){
			ImageFrame orgframe = gif.frames[i];
			BufferedImage orgimg = orgframe.getImage();
			int ow = orgframe.getWidth();
			int oh = orgframe.getHeight();
			int w = ConvertUtility.getValueAsInt(ow * wratio);
			int h = ConvertUtility.getValueAsInt(oh * hratio);
			BufferedImage destimg = null;
			if(orgimg.isAlphaPremultiplied()){
				destimg = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
			}else{
				destimg = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
			}
			Graphics2D g = destimg.createGraphics();
			g.drawImage(orgimg, 0, 0, w, h, 0, 0, ow, oh, null);
			g.dispose();
			
			ImageFrame destframe = new ImageFrame(destimg, orgframe.getDelay(), orgframe.getDisposal());
			newGif.frames[i] = destframe;
		}
		
		return newGif;
	}
	
	public static GifImage resize(InputStream instream, int newWidth, int newHeight){
		GifImage gif = readGIF(instream);
		return resize(gif, newWidth, newHeight);
	}
	
	public static GifImage resize(String file, int newWidth, int newHeight){
		InputStream ins = FileUtility.getInputStreamFromFile(file);
		GifImage gif = resize(ins, newWidth, newHeight);
		try {
			ins.close();
		} catch (IOException e) {
			QueueLog.error(AppLoggers.ErrorLogger, e);
		}
		return gif;
	}
	
	public static GifImage resize(byte[] data, int newWidth, int newHeight){
		InputStream ins = new ByteArrayInputStream(data);
		return resize(ins, newWidth, newHeight);
	}

}
