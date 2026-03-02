"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This subpackage implements a simple Ephemeris using 
    the Python port of the Swiss Ephemeris (Pyswisseph).
    
    The pyswisseph library must be already installed and
    accessible.
  
"""

import os
import flatlib
from . import swe


def _is_ephe_dir(path):
    if not path or not os.path.isdir(path):
        return False
    if os.path.isfile(os.path.join(path, 'fixstars.cat')):
        return True
    try:
        for name in os.listdir(path):
            lower = name.lower()
            if lower.endswith('.se1') or lower.endswith('.se2') or lower.endswith('.se3') or lower.endswith('.se4'):
                return True
    except Exception:
        return False
    return False


def _candidate_ephe_paths():
    for key in ('HOROSA_SWEPH_PATH', 'SE_EPHE_PATH', 'SWEPH_PATH'):
        val = os.environ.get(key)
        if val:
            yield val
    yield os.path.join(flatlib.PATH_RES, 'swefiles')
    cwd = os.getcwd()
    yield os.path.join(cwd, 'sweph', 'ephe')
    yield os.path.join(cwd, 'flatlib-ctrad2', 'flatlib', 'resources', 'swefiles')


def _resolve_ephe_path():
    seen = set()
    for candidate in _candidate_ephe_paths():
        if not candidate:
            continue
        norm = os.path.abspath(candidate)
        if norm in seen:
            continue
        seen.add(norm)
        if _is_ephe_dir(norm):
            return norm
    return os.path.join(flatlib.PATH_RES, 'swefiles')


_DEFAULT_EPHE_PATH = _resolve_ephe_path()
swe.setPath(_DEFAULT_EPHE_PATH)


def setPath(path):
    swe.setPath(path if path else _DEFAULT_EPHE_PATH)
