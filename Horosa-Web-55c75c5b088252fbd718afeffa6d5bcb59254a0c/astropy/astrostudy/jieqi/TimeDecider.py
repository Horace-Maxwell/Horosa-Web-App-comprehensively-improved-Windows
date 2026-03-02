
class TimeDecider:

    def __init__(self, data):
        date = data['date']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']
        self.pos = GeoPos(self.lat, self.lon)

        self.ad = 1
        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 3:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]
            if int(self.year) < 0:
                self.ad = -1
        else:
            self.ad = -1
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]

        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)
        self.dateTime = Datetime(self.date, '05:00:00', self.zone)

