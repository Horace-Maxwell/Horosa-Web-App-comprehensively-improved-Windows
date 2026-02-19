"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)

"""

import os
import site


__version__ = '0.2.3-3'

# sitedir = site.getsitepackages()
# Library and resource paths
PATH_LIB = os.path.dirname(__file__) + os.sep
#PATH_LIB = sitedir[0] + os.sep + 'flatlib' + os.sep
PATH_RES = PATH_LIB + 'resources' + os.sep

print(PATH_RES)
