"""
Catalog (enum <-> display label) stability test for the primary direction
multi-method buildout. This test is the visible-name guard: when any new
method / time-key is added (P1+), this test prevents accidental label drift
that would break the AI export presets or the front-end Select options.

The catalog is internally curated (self-developed); no external data source
is referenced.
"""
import pytest

from astrostudy.perpredict import STATIC_TIME_KEY_SCALES, _PD_METHOD_REGISTRY


# The full P0 surface — internal canonical naming, matching front-end Select option values.
P0_METHODS = {
    'core_alchabitius': 'Alcabitius',
    'horosa_legacy': 'Horosa Legacy',
    'placidus': 'Placidus',
}

P0_TIME_KEYS = {
    'Ptolemy': 'Ptolemy (1°/year)',
    'Naibod': 'Naibod (0.9856°/year)',
}


def test_p0_method_keys_registered():
    for k in P0_METHODS.keys():
        assert k in _PD_METHOD_REGISTRY, f'missing method registration for {k}'


def test_p0_time_key_values_present_in_static_table():
    for k in P0_TIME_KEYS.keys():
        assert k in STATIC_TIME_KEY_SCALES, f'missing time-key scale for {k}'


def test_default_method_is_alcabitius():
    """Iron Rule ①: default pdMethod must remain core_alchabitius."""
    from astrostudy import perchart

    pc = perchart.PerChart({
        'date': '2024/04/05',
        'time': '05:06:00',
        'zone': '-08:00',
        'lat': '57S52',
        'lon': '124W46',
        'ad': 1,
        'hsys': 'PLACIDUS',
    })
    assert pc.pdMethod == 'core_alchabitius'
    assert pc.pdTimeKey == 'Ptolemy'
    assert pc.pdtype == 0


def test_unknown_method_normalized_to_default():
    """perchart.PerChart whitelist must collapse unknown pdMethod to default."""
    from astrostudy import perchart

    pc = perchart.PerChart({
        'date': '2024/04/05', 'time': '05:06:00', 'zone': '-08:00',
        'lat': '57S52', 'lon': '124W46', 'ad': 1, 'hsys': 'PLACIDUS',
        'pdMethod': 'some_unknown_method_string',
    })
    assert pc.pdMethod == 'core_alchabitius', (
        'unknown pdMethod must fall back to core_alchabitius (Iron Rule ①)'
    )


def test_placidus_method_passes_whitelist():
    from astrostudy import perchart

    pc = perchart.PerChart({
        'date': '2024/04/05', 'time': '05:06:00', 'zone': '-08:00',
        'lat': '57S52', 'lon': '124W46', 'ad': 1, 'hsys': 'PLACIDUS',
        'pdMethod': 'placidus',
    })
    assert pc.pdMethod == 'placidus'
