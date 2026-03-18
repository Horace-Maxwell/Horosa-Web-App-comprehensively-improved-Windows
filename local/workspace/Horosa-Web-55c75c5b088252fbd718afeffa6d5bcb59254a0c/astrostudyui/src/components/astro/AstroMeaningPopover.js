import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import * as Constants from '../../utils/constants';
import { genHtml } from '../../utils/helper';

const MAIN_TOOLTIP_CONTENT_STYLE = {
  position: 'absolute',
  left: '-9999px',
  top: '-9999px',
  width: '560px',
  maxWidth: '72vw',
  maxHeight: '60vh',
  overflowX: 'hidden',
  overflowY: 'auto',
  textAlign: 'left',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
  lineHeight: 1.4,
  padding: '8px 10px',
  font: '13px sans-serif',
  background: '#ffffff',
  color: '#262626',
  border: '1px solid #e8e8e8',
  borderRadius: 8,
  boxShadow: '0 6px 18px rgba(0,0,0,0.16)',
  pointerEvents: 'none',
  zIndex: 9999,
  opacity: 0.92,
};

const TOOLTIP_MARGIN = 12;
const TOOLTIP_OFFSET = 18;

function normalizeFlag(value) {
  return value === true || value === 1 || value === '1';
}

function readMeaningEnabledFromStorage() {
  try {
    const json = localStorage.getItem(Constants.GlobalSetupKey);
    if (!json) {
      return false;
    }
    const cfg = JSON.parse(json);
    return normalizeFlag(cfg.showAstroAnnotation) || normalizeFlag(cfg.showAstroMeaning);
  } catch (e) {
    return false;
  }
}

export function isMeaningEnabled(enabled) {
  if (enabled === undefined || enabled === null) {
    return readMeaningEnabledFromStorage();
  }
  return normalizeFlag(enabled);
}

function clampTooltipPos(val, min, max) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(val, min), max);
}

function getEventPoint(evt) {
  if (!evt) {
    return null;
  }
  const nativeEvt = evt.nativeEvent || evt;
  const doc = document.documentElement || {};
  const scrollX =
    window.pageXOffset !== undefined ? window.pageXOffset : doc.scrollLeft || 0;
  const scrollY =
    window.pageYOffset !== undefined ? window.pageYOffset : doc.scrollTop || 0;
  return {
    pageX:
      nativeEvt.pageX !== undefined ? nativeEvt.pageX : scrollX + (nativeEvt.clientX || 0),
    pageY:
      nativeEvt.pageY !== undefined ? nativeEvt.pageY : scrollY + (nativeEvt.clientY || 0),
  };
}

function positionTooltipNode(node, point) {
  if (!node || !point) {
    return;
  }
  const doc = document.documentElement || {};
  const scrollX =
    window.pageXOffset !== undefined ? window.pageXOffset : doc.scrollLeft || 0;
  const scrollY =
    window.pageYOffset !== undefined ? window.pageYOffset : doc.scrollTop || 0;
  const viewportWidth = window.innerWidth || doc.clientWidth || 0;
  const viewportHeight = window.innerHeight || doc.clientHeight || 0;
  const viewportLeft = scrollX + TOOLTIP_MARGIN;
  const viewportTop = scrollY + TOOLTIP_MARGIN;
  const viewportRight = scrollX + viewportWidth - TOOLTIP_MARGIN;
  const viewportBottom = scrollY + viewportHeight - TOOLTIP_MARGIN;
  const tooltipWidth = node.offsetWidth || node.scrollWidth || 0;
  const tooltipHeight = node.offsetHeight || node.scrollHeight || 0;

  let left = point.pageX + TOOLTIP_OFFSET;
  if (left + tooltipWidth > viewportRight) {
    left = point.pageX - tooltipWidth - TOOLTIP_OFFSET;
  }
  left = clampTooltipPos(left, viewportLeft, viewportRight - tooltipWidth);

  let top = point.pageY + TOOLTIP_OFFSET;
  if (top + tooltipHeight > viewportBottom) {
    top = point.pageY - tooltipHeight - TOOLTIP_OFFSET;
  }
  top = clampTooltipPos(top, viewportTop, viewportBottom - tooltipHeight);

  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function mergeHandler(originHandler, nextHandler) {
  return (evt) => {
    if (originHandler) {
      originHandler(evt);
    }
    if (!evt || !evt.isPropagationStopped || !evt.isPropagationStopped()) {
      nextHandler(evt);
    }
  };
}

function MeaningHoverTrigger({ triggerNode, html }) {
  const tooltipRef = useRef(null);
  const rafRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [point, setPoint] = useState(null);

  const placeTooltip = useCallback((nextPoint) => {
    if (!tooltipRef.current || !nextPoint) {
      return;
    }
    positionTooltipNode(tooltipRef.current, nextPoint);
  }, []);

  const schedulePlaceTooltip = useCallback(
    (nextPoint) => {
      if (!nextPoint) {
        return;
      }
      placeTooltip(nextPoint);
      if (window.requestAnimationFrame) {
        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = window.requestAnimationFrame(() => {
          placeTooltip(nextPoint);
        });
      }
    },
    [placeTooltip],
  );

  useLayoutEffect(() => {
    if (visible && point) {
      schedulePlaceTooltip(point);
    }
  }, [visible, point, schedulePlaceTooltip]);

  useLayoutEffect(() => () => {
    if (rafRef.current && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const handleEnter = useCallback(
    (evt) => {
      const nextPoint = getEventPoint(evt);
      setVisible(true);
      setPoint(nextPoint);
      schedulePlaceTooltip(nextPoint);
    },
    [schedulePlaceTooltip],
  );

  const handleMove = useCallback(
    (evt) => {
      const nextPoint = getEventPoint(evt);
      setPoint(nextPoint);
      if (visible) {
        placeTooltip(nextPoint);
      }
    },
    [placeTooltip, visible],
  );

  const handleLeave = useCallback(() => {
    setVisible(false);
  }, []);

  const portal =
    visible && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            className='astroMeaningTooltipContent'
            style={MAIN_TOOLTIP_CONTENT_STYLE}
            dangerouslySetInnerHTML={{ __html: html }}
          />,
          document.body,
        )
      : null;

  return (
    <>
      {cloneElement(triggerNode, {
        onMouseEnter: mergeHandler(triggerNode.props?.onMouseEnter, handleEnter),
        onMouseMove: mergeHandler(triggerNode.props?.onMouseMove, handleMove),
        onMouseLeave: mergeHandler(triggerNode.props?.onMouseLeave, handleLeave),
        onBlur: mergeHandler(triggerNode.props?.onBlur, handleLeave),
      })}
      {portal}
    </>
  );
}

export function wrapWithMeaning(node, enabled, tipobj) {
  if (!isMeaningEnabled(enabled) || !tipobj) {
    return node;
  }
  const html = genHtml(tipobj, true);
  if (!html) {
    return node;
  }
  const canReuseNode =
    isValidElement(node) && typeof node.type === 'string' && node.type !== React.Fragment;
  const triggerNode = canReuseNode
    ? cloneElement(node, {
        style: {
          ...(node.props?.style || {}),
          cursor: 'help',
        },
      })
    : <span style={{ cursor: 'help' }}>{node}</span>;
  return <MeaningHoverTrigger triggerNode={triggerNode} html={html} />;
}
