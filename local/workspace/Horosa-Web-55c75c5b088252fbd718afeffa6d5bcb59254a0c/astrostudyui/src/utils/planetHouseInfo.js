export function appendPlanetHouseInfoById(label, _chartObj, _id, enabled) {
  return enabled ? `${label || ''}` : `${label || ''}`;
}

export function splitPlanetHouseInfoText(text) {
  return {
    label: `${text || ''}`,
    info: '',
  };
}
