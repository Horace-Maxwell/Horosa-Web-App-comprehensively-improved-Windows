/*-------------------------------------------------------------------------
 |   RXTX License v 2.1 - LGPL v 2.1 + Linking Over Controlled Interface.
 |   RXTX is a native interface to serial ports in java.
 |   Copyright 1997-2007 by Trent Jarvi tjarvi@qbang.org and others who
 |   actually wrote it.  See individual source files for more information.
 |
 |   A copy of the LGPL v 2.1 may be found at
 |   http://www.gnu.org/licenses/lgpl.txt on March 4th 2007.  A copy is
 |   here for your convenience.
 |
 |   This library is free software; you can redistribute it and/or
 |   modify it under the terms of the GNU Lesser General Public
 |   License as published by the Free Software Foundation; either
 |   version 2.1 of the License, or (at your option) any later version.
 |
 |   This library is distributed in the hope that it will be useful,
 |   but WITHOUT ANY WARRANTY; without even the implied warranty of
 |   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 |   Lesser General Public License for more details.
 |
 |   An executable that contains no derivative of any portion of RXTX, but
 |   is designed to work with RXTX by being dynamically linked with it,
 |   is considered a "work that uses the Library" subject to the terms and
 |   conditions of the GNU Lesser General Public License.
 |
 |   The following has been added to the RXTX License to remove
 |   any confusion about linking to RXTX.   We want to allow in part what
 |   section 5, paragraph 2 of the LGPL does not permit in the special
 |   case of linking over a controlled interface.  The intent is to add a
 |   Java Specification Request or standards body defined interface in the 
 |   future as another exception but one is not currently available.
 |
 |   http://www.fsf.org/licenses/gpl-faq.html#LinkingOverControlledInterface
 |
 |   As a special exception, the copyright holders of RXTX give you
 |   permission to link RXTX with independent modules that communicate with
 |   RXTX solely through the Sun Microsytems CommAPI interface version 2,
 |   regardless of the license terms of these independent modules, and to copy
 |   and distribute the resulting combined work under terms of your choice,
 |   provided that every copy of the combined work is accompanied by a complete
 |   copy of the source code of RXTX (the version of RXTX used to produce the
 |   combined work), being distributed under the terms of the GNU Lesser General
 |   Public License plus this exception.  An independent module is a
 |   module which is not derived from or based on RXTX.
 |
 |   Note that people who make modified versions of RXTX are not obligated
 |   to grant this special exception for their modified versions; it is
 |   their choice whether to do so.  The GNU Lesser General Public License
 |   gives permission to release a modified version without this exception; this
 |   exception also makes it possible to release a modified version which
 |   carries forward this exception.
 |
 |   You should have received a copy of the GNU Lesser General Public
 |   License along with this library; if not, write to the Free
 |   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 |   All trademarks belong to their respective owners.
 --------------------------------------------------------------------------*/
package gnu.io;

import java.util.*;

/**
 * @author Trent Jarvi
 * @author Bartłomiej P. Prokop
 * @version 2.3
 */
public class SerialPortEvent extends EventObject {

    /**
     * The DATA_AVAILABLE port event notifies that new data was received on the
     * port. When this event type is received, the user will typically schedule
     * a read on the input stream.
     */
    public static final int DATA_AVAILABLE = 1;
    /**
     * The OUTPUT_BUFFER_EMPTY port event notifies that all data in the ports
     * output buffer was processed. The user might use this event to continue
     * writing data to the ports output stream.
     */
    public static final int OUTPUT_BUFFER_EMPTY = 2;
    /**
     * The CTS port event is triggered when the Clear To Send line on the port
     * changes its logic level.
     */
    public static final int CTS = 3;
    /**
     * The DSR port event is triggered when the Data Set Ready line on the port
     * changes its logic level.
     */
    public static final int DSR = 4;
    /**
     * The RI port event is triggered when the Ring Indicator line on the port
     * changes its logic level.
     */
    public static final int RI = 5;
    /**
     * The CD port event is triggered when the Data Carrier Detect line on the
     * port changes its logic level.
     */
    public static final int CD = 6;
    /**
     * The OE port event signals an overrun error. This event is triggered, when
     * the port hardware receives data and the application does not read it or
     * does not read it fast enough. As a result a buffer located in hardware
     * and/or the driver overflows and data is lost.
     */
    public static final int OE = 7;
    /**
     * The PE port event signals a parity error. This event is triggered when
     * the port is configured to use parity bits and a datum with wrong parity
     * value is received. This means it is very likely that a datum with wrong
     * value has been received.
     */
    public static final int PE = 8;
    /**
     * The FE port event signals a framing error.
     */
    public static final int FE = 9;
    /**
     * The BI port event signals a break interrupt.
     */
    public static final int BI = 10;

    private final boolean oldValue;
    private final boolean newValue;
    private final int eventType;
    /*public int eventType           =0; depricated */

    /**
     * Creates a new <code>SerialPortEvent</code> of specified event type.
     *
     * @param srcport the port which is associated with the event
     * @param eventType the type of the event
     * @param oldValue the value of the signal before the event
     * @param newValue the value of the signal after the event
     */
    public SerialPortEvent(SerialPort srcport, int eventType, boolean oldValue, boolean newValue) {
        super(srcport);
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.eventType = eventType;
    }

    /**
     * Returns the type of the event which occurred.
     *
     * @return the event type
     */
    public int getEventType() {
        return eventType;
    }

    /**
     * Returns the value of the event context object after the event occurred.
     * For CTS, DSR this is the new logic level of the CTS or DSR line
     * respectively.
     *
     * @return the new value
     */
    //TODO (by Alexander Graf): check wich voltage level corresponds to which boolean value
    public boolean getNewValue() {
        return newValue;
    }

    /**
     * Returns the value of the event context object before the event occurred.
     * For CTS, DSR this is the old logic level of the CTS or DSR line
     * respectively.
     *
     * @return the old value
     */
    public boolean getOldValue() {
        return oldValue;
    }
}
