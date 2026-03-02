"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    

    This module provides functions and classes for handling 
    dates and times.
    
    The classes implemented in this file are <Date>, <Time> 
    and <Datetime>. Since time is similar to angles (same 
    string separators and base 60), the <Time> class uses 
    angular functions for internal conversions.

"""
import swisseph
from . import angle


# Calendar types
GREGORIAN = 0
JULIAN = 1


# === Julian Day Number conversions === #

def dateJDN(year, month, day, calendar):
    """ Converts date to Julian Day Number. """
    a = (14 - month) // 12
    y = year + 4800 - a
    if year < 0:
        y = y + 1
    m = month + 12*a - 3
    cal = calendar
    if year < 1582 or (year == 1582 and month < 10) or (year == 1582 and month == 10 and day < 15):
        cal = JULIAN

    if cal == GREGORIAN:
        return day + (153*m + 2)//5 + 365*y + y//4 - y//100 + y//400 - 32045
    else:
        return day + (153*m + 2)//5 + 365*y + y//4 - 32083
    
def jdnDate(jdn):
    """ Converts Julian Day Number to Gregorian date. """
    a = jdn + 32044
    b = (4*a + 3) // 146097
    c = a - (146097*b) // 4
    d = (4*c + 3) // 1461
    e = c - (1461*d) // 4
    m = (5*e + 2) // 153
    day = e + 1 - (153*m + 2) // 5
    month = m + 3 - 12*(m//10)
    year = 100*b + d - 4800 + m//10
    return [year, month, day]

def sweJdnDate(jdn, utcoffset):
    geodt = Datetime('1582/10/15', '00:00', utcoffset)
    localJD = jdn + utcoffset.value / 24.0
    geojd = geodt.jd
    geoflag = 1 if jdn >= geojd else 0
    return swisseph.jdut1_to_utc(localJD, geoflag)



# ------------------ #
#     Date Class     #
# ------------------ #

class Date:
    """ This class represents a calendar date. It is
    internally represented by a JDN integer.
    
    Objects of this class can be instantiated with 
    dates of type string, list and int (jdn).
    String and date lists are like 'yyyy/mm/dd'.
    
    """
    
    # Calendar types
    GREGORIAN = GREGORIAN
    JULIAN = JULIAN
    
    def __init__(self, value, calendar=GREGORIAN):
        if isinstance(value, str):
            dtstr = Datetime.cnStrToEnStr(value)
            # Assume string date such as "2015/03/29"
            value = [int(v) for v in dtstr.split('/')]
            value = dateJDN(value[0], value[1], value[2], calendar)
        elif isinstance(value, list):
            # Assume list date such as [2015,03,29]
            value = dateJDN(value[0], value[1], value[2], calendar)
        self.jdn = int(value)

    def dayofweek(self):
        """ Returns the day of week starting on Sunday as zero. """
        return (self.jdn + 1) % 7
    
    def date(self):
        """ Returns date as list [yyyy,mm,dd]. """
        return jdnDate(self.jdn)
    
    def toList(self):
        """ Returns date as signed list. """
        date = self.date()
        sign = '+' if date[0] >= 0 else '-'
        date[0] = abs(date[0])
        return list(sign) + date
    
    def toString(self):
        """ Returns date as string. """
        slist = self.toList()
        sign = '' if slist[0] == '+' else '-'
        string = '/'.join(['%02d' % v for v in slist[1:]])
        return sign + string

    def toCNString(self):
        list = self.date()
        y = list[0]
        if y<=0:
            y = y -1
        year = '%02d' % y
        month = '%02d' % list[1]
        day = '%02d' % list[2]
        return '{0}-{1}-{2}'.format(year, month, day)


    def ad(self):
        date = self.date()
        if date[0] <= 0:
            return -1
        else:
            return 1

    def __str__(self):
        return '<%s>' % self.toString()
    

# ------------------ #
#     Time Class     #
# ------------------ #

class Time:
    """ This class represents a time in the library.
    A time from this class can have negative values.
    
    Objects of this class can be instantiated with
    strings, signed lists or float values.
    String and time lists are like 'hh:mm:ss.'
    
    """
    
    def __init__(self, value):
        self.value = angle.toFloat(value)
        
    def getUTC(self, utcoffset):
        """ Returns a new Time object set to UTC given 
        an offset Time object.
        
        """
        newTime = (self.value - utcoffset.value) % 24
        return Time(newTime)
    
    def time(self):
        """ Returns time as list [hh,mm,ss]. """
        slist = self.toList()
        if slist[0] == '-':
            slist[1] *= -1
            # We must do a trick if we want to 
            # make negative zeros explicit
            if slist[1] == -0:
                slist[1] = -0.0
        return slist[1:]
    
    def toList(self):
        """ Returns time as signed list. """
        slist = angle.toList(self.value)
        # Keep hours in 0..23
        slist[1] = slist[1] % 24
        return slist
    
    def toString(self):
        """ Returns time as string. """
        slist = self.toList()
        string = angle.slistStr(slist)
        return string if slist[0] == '-' else string[1:]
    
    def __str__(self):
        return '<%s>' % self.toString()


# ------------------ #
#   Datetime Class   #
# ------------------ #

class Datetime:
    """ This class represents a specific moment in time given by
    a date, a time and an UTC Offset. The UTC Offset is zero
    by default (UTC+0) although an offset can be given.
    
    """
    
    # Calendar types
    GREGORIAN = GREGORIAN
    JULIAN = JULIAN
    
    def __init__(self, date, time=0, utcoffset=0, calendar=GREGORIAN):
        # Prepare the variables
        if isinstance(date, Date):
            self.date = date
        else:
            self.date = Date(date, calendar)
            
        if isinstance(time, Time):
            self.time = time
        else:
            self.time = Time(time)

        if isinstance(utcoffset, Time):
            self.utcoffset = utcoffset
        else:
            self.utcoffset = Time(utcoffset)
            
        # Compute jd
        self.jd = self.date.jdn + self.time.value/24.0 - \
                  self.utcoffset.value/24.0 - 0.5


    @staticmethod
    def fromJD(jd, utcoffset):
        """ Builds a Datetime object given a jd and utc offset. """
        if not isinstance(utcoffset, Time):
            utcoffset = Time(utcoffset)
        localJD = jd + utcoffset.value / 24.0
        date = Date(round(localJD))
        time = Time((localJD + 0.5 - date.jdn) * 24)
        return Datetime(date, time, utcoffset)

    @staticmethod
    def cnStrToEnStr(dtstr):
        parts = dtstr.split('-')
        if len(parts) == 3:
            return '{0}/{1}/{2}'.format(parts[0], parts[1], parts[2])
        elif len(parts) == 4:
            return '-{0}/{1}/{2}'.format(parts[1], parts[2], parts[3])
        else:
            return dtstr

    def getUTC(self):
        """ Returns this Datetime localized for UTC. """
        timeUTC = self.time.getUTC(self.utcoffset)
        dateUTC = Date(round(self.jd))
        return Datetime(dateUTC, timeUTC)

    def getLocalGregoDate(self):
        list = sweJdnDate(self.jd, self.utcoffset)
        year = list[0]
        if year <= 0:
            year = year - 1
        return (year, list[1], list[2], list[3], list[4], list[5])

    def toCNString(self):
        list = self.getLocalGregoDate()
        year = '%02d' % list[0]
        month = '%02d' % list[1]
        day = '%02d' % list[2]
        hour = '%02d' % list[3]
        min = '%02d' % list[4]
        sec = '%02d' % list[5]
        return '{0}-{1}-{2} {3}:{4}:{5}'.format(year, month, day, hour, min, sec)

    def ad(self):
        return self.date.ad()

    def calcZeroHourJd(self):
        ztm = Datetime(self.date, 0, self.utcoffset)
        return ztm.jd

    def __str__(self):
        return self.toCNString()
