package name.prokop.bart.rxtx;

import java.awt.*;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.util.*;

/**
 * A small GUId app. that shows many system and environment properties. Designed
 * to be compatible with Java 1.4+ (hence many requirements like no foreach, no
 * generics, no StringBuilder..).
 *
 * @author Andrew Thompson
 * @version 2008-06-29
 */
class SystemProperties {

    static String sentence = "The quick brown fox jumped over the lazy dog.";
    static String sep = System.getProperty("line.separator");
    static String fontText
            = sentence
            + sep
            + sentence.toUpperCase()
            + sep
            + "0123456789 !@#$%^&*()_+ []\\;',./ {}|:\"<>?";

    static String[] convertObjectToSortedStringArray(Object[] unsorted) {
        String[] sorted = new String[unsorted.length];
        for (int ii = 0; ii < sorted.length; ii++) {
            sorted[ii] = (String) unsorted[ii];
        }
        Arrays.sort(sorted);
        return sorted;
    }

    static String dataPairToTableRow(String property, Object value) {
        String val = valueToString(property, value);
        return "<tr>"
                + "<th>"
                + "<code>"
                + property
                + "</code>"
                + "</th>"
                + "<td>"
                + val
                + "</td>"
                + "</tr>";
    }

    static String valueToString(String property, Object value) {
        if (value instanceof Color) {
            Color color = (Color) value;
            String converted
                    = "<div style='width: 100%; height: 100%; "
                    + "background-color: #"
                    + Integer.toHexString(color.getRed())
                    + Integer.toHexString(color.getGreen())
                    + Integer.toHexString(color.getBlue())
                    + ";'>"
                    + value.toString()
                    + "</div>";
            return converted;
        } else if (property.toLowerCase().endsWith("path")
                || property.toLowerCase().endsWith("dirs")) {
            return delimitedToHtmlList(
                    (String) value,
                    System.getProperty("path.separator"));
        } else {
            return value.toString();
        }
    }

    static String delimitedToHtmlList(String values, String delimiter) {
        String[] parts = values.split(delimiter);
        StringBuffer sb = new StringBuffer();
        sb.append("<ol>");
        for (int ii = 0; ii < parts.length; ii++) {
            sb.append("<li>");
            sb.append(parts[ii]);
            sb.append("</li>");
        }
        return sb.toString();
    }

    static Component getExampleOfFont(String fontFamily) {
        Font font = new Font(fontFamily, Font.PLAIN, 24);
        JTextArea ta = new JTextArea();
        ta.setFont(font);
        ta.setText(fontText);
        ta.setEditable(false);
        // don't allow these to get focus, as it
        // interferes with desired scroll behavior
        ta.setFocusable(false);
        return ta;
    }

    static public JScrollPane getOutputWidgetForContent(String content) {
        JEditorPane op = new JEditorPane();
        op.setContentType("text/html");
        op.setEditable(false);

        op.setText(content);

        return new JScrollPane(op);
    }

    public static void main(String[] args) {
        JTabbedPane tabPane = new JTabbedPane();
        StringBuffer sb;
        String header = "<html><body><table border=1 width=100%>";

        sb = new StringBuffer(header);
        Properties prop = System.getProperties();
        String[] propStrings = convertObjectToSortedStringArray(
                prop.stringPropertyNames().toArray());
        for (int ii = 0; ii < propStrings.length; ii++) {
            sb.append(
                    dataPairToTableRow(
                            propStrings[ii],
                            System.getProperty(propStrings[ii])));
        }
        tabPane.addTab(
                "System",
                getOutputWidgetForContent(sb.toString()));

        sb = new StringBuffer(header);
        Map environment = System.getenv();
        String[] envStrings = convertObjectToSortedStringArray(
                environment.keySet().toArray());
        for (int ii = 0; ii < envStrings.length; ii++) {
            sb.append(
                    dataPairToTableRow(
                            envStrings[ii],
                            environment.get(envStrings[ii])));
        }
        tabPane.addTab(
                "Environment",
                getOutputWidgetForContent(sb.toString()));

        sb = new StringBuffer(header);
        GraphicsEnvironment ge = GraphicsEnvironment.getLocalGraphicsEnvironment();
        GraphicsDevice[] gs = ge.getScreenDevices();
        for (int j = 0; j < gs.length; j++) {
            GraphicsDevice gd = gs[j];
            sb.append(
                    dataPairToTableRow(
                            "Device " + j,
                            gd.toString()
                            + "  "
                            + gd.getIDstring()));
            GraphicsConfiguration[] gc
                    = gd.getConfigurations();
            for (int i = 0; i < gc.length; i++) {
                sb.append(
                        dataPairToTableRow(
                                "Config "
                                + i,
                                (int) gc[i].getBounds().getWidth()
                                + "x"
                                + (int) gc[i].getBounds().getHeight()
                                + " "
                                + gc[i].getColorModel()
                                + ", "
                                + "  Accelerated: "
                                + gc[i].getImageCapabilities().isAccelerated()
                                + "  True Volatile: "
                                + gc[i].getImageCapabilities().isTrueVolatile()));
            }
        }
        tabPane.addTab(
                "Graphics Environment",
                getOutputWidgetForContent(sb.toString()));

        String[] fonts = ge.getAvailableFontFamilyNames();
        JPanel fontTable = new JPanel(new BorderLayout(3, 1));
        // to enable key based scrolling in the font panel
        fontTable.setFocusable(true);
        JPanel fontNameCol = new JPanel(new GridLayout(0, 1, 2, 2));
        JPanel fontExampleCol = new JPanel(new GridLayout(0, 1, 2, 2));
        fontTable.add(fontNameCol, BorderLayout.WEST);
        fontTable.add(fontExampleCol, BorderLayout.CENTER);
        for (int ii = 0; ii < fonts.length; ii++) {
            fontNameCol.add(new JLabel(fonts[ii]));
            fontExampleCol.add(getExampleOfFont(fonts[ii]));
        }
        tabPane.add("Fonts", new JScrollPane(fontTable));

        sb = new StringBuffer(header);

        sb.append("<thead>");
        sb.append("<tr>");
        sb.append("<th>");
        sb.append("Code");
        sb.append("</th>");
        sb.append("<th>");
        sb.append("Language");
        sb.append("</th>");
        sb.append("<th>");
        sb.append("Country");
        sb.append("</th>");
        sb.append("<th>");
        sb.append("Variant");
        sb.append("</th>");
        sb.append("</tr>");
        sb.append("</thead>");

        Locale[] locales = Locale.getAvailableLocales();
        SortableLocale[] sortableLocale = new SortableLocale[locales.length];
        for (int ii = 0; ii < locales.length; ii++) {
            sortableLocale[ii] = new SortableLocale(locales[ii]);
        }
        Arrays.sort(sortableLocale);
        for (int ii = 0; ii < locales.length; ii++) {
            String prefix = "";
            String suffix = "";
            Locale locale = sortableLocale[ii].getLocale();
            if (locale.equals(Locale.getDefault())) {
                prefix = "<b>";
                suffix = "</b>";
            }
            sb.append(dataPairToTableRow(
                    prefix
                    + locale.toString()
                    + suffix,
                    prefix
                    + locale.getDisplayLanguage()
                    + suffix
                    + "</td><td>"
                    + prefix
                    + locale.getDisplayCountry()
                    + suffix
                    + "</td><td>"
                    + prefix
                    + locale.getDisplayVariant()
                    + suffix));
        }
        tabPane.add("Locales",
                getOutputWidgetForContent(sb.toString()));

        Locale.getDefault();
        int border = 5;
        JPanel p = new JPanel(new BorderLayout());
        p.setBorder(new EmptyBorder(border, border, border, border));
        p.add(tabPane, BorderLayout.CENTER);
        p.setPreferredSize(new Dimension(400, 400));
        JFrame f = new JFrame("Properties");
        f.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        f.getContentPane().add(p, BorderLayout.CENTER);
        f.pack();
        f.setMinimumSize(f.getPreferredSize());
        f.setSize(600, 500);
        f.setLocationRelativeTo(null);
        f.setVisible(true);
    }
}

class SortableLocale implements Comparable {

    Locale locale;

    SortableLocale(Locale locale) {
        this.locale = locale;
    }

    public String toString() {
        return locale.toString();
    }

    public Locale getLocale() {
        return locale;
    }

    public int compareTo(Object object2) {
        SortableLocale locale2 = (SortableLocale) object2;
        //Locale locale2 = (Locale)object2;
        return locale.toString().compareTo(
                locale2.toString());
    }
}
