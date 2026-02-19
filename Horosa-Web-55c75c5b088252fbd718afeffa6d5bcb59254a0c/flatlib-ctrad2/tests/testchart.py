from flatlib import const
from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.predictives.primarydirections import PrimaryDirections
from flatlib.predictives.primarydirections import PDTable



if __name__ == '__main__':
    date = Datetime('1976/07/06', '21:07', '+08:00')
    pos = GeoPos('26n05', '119e18')
    chart = Chart(date, pos, hsys=const.HOUSES_WHOLE_SIGN)
    darkmoon = chart.get(const.DARKMOON)
    asc = chart.get(const.ASC)
    purpleclouds = chart.get(const.PURPLE_CLOUDS)
    print(darkmoon)
    print(asc)

    aspList = [0, 60, 90, 120, 180]
    pd = PrimaryDirections(chart)
    tbl = PDTable(chart, aspList)
    list = tbl.byPromissor(const.PURPLE_CLOUDS)
    siglist = tbl.bySignificator(const.DARKMOON)

    for item in list:
        print(item)

