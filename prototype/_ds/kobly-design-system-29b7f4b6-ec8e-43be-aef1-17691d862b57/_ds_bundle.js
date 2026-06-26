/* @ds-bundle: {"format":3,"namespace":"KoblyDesignSystem_29b7f4","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"STATUS_TONE","sourcePath":"components/core/Badge.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Checklist","sourcePath":"components/core/Checklist.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"MetricCard","sourcePath":"components/core/MetricCard.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"StatusLine","sourcePath":"components/core/StatusLine.jsx"},{"name":"TemplateCard","sourcePath":"components/core/TemplateCard.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"NavButton","sourcePath":"components/navigation/NavButton.jsx"},{"name":"NavRail","sourcePath":"components/navigation/NavRail.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"d23287323007","components/core/Badge.jsx":"c88e9106d3b5","components/core/Button.jsx":"32d8f8ed005c","components/core/Card.jsx":"2f2e2ceab03b","components/core/Checklist.jsx":"75cf297935a3","components/core/Icon.jsx":"a0761dce722f","components/core/IconButton.jsx":"3e7a87c5f4e1","components/core/Input.jsx":"505edf54587a","components/core/MetricCard.jsx":"7a6a8747e76e","components/core/Select.jsx":"9b58a4fb57f7","components/core/StatusLine.jsx":"b172a59631a0","components/core/TemplateCard.jsx":"f0abd0fe5e12","components/data/DataTable.jsx":"8b11f8617da4","components/navigation/NavButton.jsx":"ab471a411f72","components/navigation/NavRail.jsx":"60c399af5cce","ui_kits/app/App.jsx":"754dbe1c5cc4","ui_kits/app/Campaigns.jsx":"52d1aa3444b0","ui_kits/app/Clients.jsx":"f2c0e9d949c9","ui_kits/app/Dashboard.jsx":"ea4d652c40e6","ui_kits/app/Integrations.jsx":"8df3780e88af","ui_kits/app/Leads.jsx":"a00a4ed750d2","ui_kits/app/Support.jsx":"fccb1264fa27","ui_kits/app/Topbar.jsx":"b85fc50738f3","ui_kits/app/data.js":"8adf42c481d1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.KoblyDesignSystem_29b7f4 = window.KoblyDesignSystem_29b7f4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Round avatar showing an initial (user/workspace). Navy tile, white glyph. */
function Avatar({
  name = '',
  size = 'md',
  src = null,
  tone = 'navy',
  style = {},
  ...rest
}) {
  const sizes = {
    sm: 28,
    md: 36,
    lg: 44
  };
  const fonts = {
    sm: 12,
    md: 14,
    lg: 17
  };
  const dim = sizes[size] || sizes.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const tones = {
    navy: {
      background: 'var(--surface-raised)',
      color: 'var(--text-strong)'
    },
    teal: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)'
    },
    slate: {
      background: 'var(--ink-600)',
      color: 'var(--ink-100)'
    }
  };
  const t = tones[tone] || tones.navy;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim,
      height: dim,
      borderRadius: '50%',
      flex: 'none',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--fw-bold)',
      fontSize: fonts[size] || 14,
      ...t,
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initial);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  success: {
    fg: 'var(--status-success-fg)',
    bg: 'var(--status-success-bg)'
  },
  warning: {
    fg: 'var(--status-warning-fg)',
    bg: 'var(--status-warning-bg)'
  },
  danger: {
    fg: 'var(--status-danger-fg)',
    bg: 'var(--status-danger-bg)'
  },
  info: {
    fg: 'var(--status-info-fg)',
    bg: 'var(--status-info-bg)'
  },
  neutral: {
    fg: 'var(--status-neutral-fg)',
    bg: 'var(--status-neutral-bg)'
  }
};

/** Maps Kobly domain states → tone, so badges stay consistent across the app. */
const STATUS_TONE = {
  active: 'success',
  purchase_approved: 'success',
  completed: 'success',
  paused: 'warning',
  pix_generated: 'warning',
  processing: 'warning',
  queued: 'warning',
  dead_letter: 'danger',
  blocked: 'danger',
  error: 'danger',
  cart_abandoned: 'danger',
  sandbox: 'info',
  draft: 'neutral',
  archived: 'neutral',
  cancelled: 'neutral'
};

/**
 * Status pill. Pass `tone` directly, or `status` to auto-map a Kobly domain state.
 * `dot` adds a leading status dot.
 */
function Badge({
  children,
  tone,
  status,
  dot = false,
  size = 'md',
  style = {},
  ...rest
}) {
  const resolvedTone = tone || STATUS_TONE[status] || 'neutral';
  const t = TONES[resolvedTone] || TONES.neutral;
  const sizes = {
    sm: {
      padding: '2px 8px',
      fontSize: '11px'
    },
    md: {
      padding: '3px 10px',
      fontSize: 'var(--text-xs)'
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--fw-semibold)',
      fontSize: s.fontSize,
      lineHeight: 1.5,
      padding: s.padding,
      borderRadius: 'var(--radius-pill)',
      color: t.fg,
      background: t.bg,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: t.fg,
      flex: 'none'
    }
  }), children);
}
Object.assign(__ds_scope, { STATUS_TONE, Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * White content panel — 1px subtle border, 8px radius, soft shadow (spec default).
 * Optional `title`/`action` header. `pad` toggles inner padding; `flush` removes it.
 */
function Card({
  children,
  title,
  subtitle,
  action,
  pad = true,
  style = {},
  bodyStyle = {},
  ...rest
}) {
  const hasHeader = title || action;
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      ...style
    }
  }, rest), hasHeader && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '16px 20px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, subtitle)), action), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: pad ? '20px' : 0,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/**
 * Pure-React Lucide icon. Renders the SVG directly from window.lucide.icons data —
 * it never mutates the DOM, so it survives React reconciliation (unlike lucide.createIcons()).
 * `name` is a kebab-case Lucide name (e.g. "layout-dashboard").
 */
function toPascal(name) {
  return String(name || '').split(/[-_ ]+/).filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
function camel(k) {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  style = {},
  ...rest
}) {
  const lucide = typeof window !== 'undefined' ? window.lucide : null;
  const node = lucide && lucide.icons ? lucide.icons[toPascal(name)] : null;
  if (!node) {
    // Fallback: reserve space until lucide data is available / unknown name.
    return React.createElement('span', {
      style: {
        display: 'inline-block',
        width: size,
        height: size,
        flex: 'none',
        ...style
      },
      'aria-hidden': true,
      ...rest
    });
  }
  const children = node.map((tuple, i) => {
    const tag = tuple[0];
    const attrs = tuple[1] || {};
    const props = {
      key: i
    };
    for (const k in attrs) props[camel(k)] = attrs[k];
    return React.createElement(tag, props);
  });
  return React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: {
      display: 'block',
      flex: 'none',
      ...style
    },
    'aria-hidden': true,
    ...rest
  }, children);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Kobly primary action button. Variants: primary (dark navy), secondary, ghost, danger.
 * Sizes: sm | md | lg. Sentence-case labels (pt-BR), never ALL CAPS.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '6px 12px',
      fontSize: 'var(--text-sm)',
      height: 32,
      gap: 6,
      icon: 15
    },
    md: {
      padding: '9px 16px',
      fontSize: 'var(--text-md)',
      height: 40,
      gap: 8,
      icon: 17
    },
    lg: {
      padding: '12px 22px',
      fontSize: 'var(--text-lg)',
      height: 48,
      gap: 9,
      icon: 19
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: 'var(--primary-bg)',
      color: 'var(--primary-fg)',
      border: '1px solid var(--primary-bg)'
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-strong)',
      border: '1px solid var(--border-default)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--red-500)',
      color: '#fff',
      border: '1px solid var(--red-500)'
    }
  };
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    className: `kbly-btn kbly-btn--${variant}`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--fw-semibold)',
      fontSize: s.fontSize,
      lineHeight: 1,
      padding: s.padding,
      minHeight: s.height,
      width: fullWidth ? '100%' : 'auto',
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast), box-shadow var(--dur-fast)',
      whiteSpace: 'nowrap',
      ...v,
      ...style
    }
  }, rest), iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: s.icon
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.icon
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Checklist.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Onboarding "Primeiros passos" checklist with a progress bar.
 * `items`: [{ label, done }]. Computes progress from done count.
 */
function Checklist({
  title = 'Primeiros passos',
  items = [],
  style = {},
  ...rest
}) {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)'
    }
  }, done, "/", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunken)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: '100%',
      background: 'var(--accent)',
      borderRadius: 'var(--radius-pill)',
      transition: 'width var(--dur-med) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      flex: 'none',
      borderRadius: '50%',
      border: it.done ? 'none' : '1.5px solid var(--border-default)',
      background: it.done ? 'var(--green-500)' : 'transparent',
      color: 'var(--ink-900)'
    }
  }, it.done && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      color: it.done ? 'var(--text-muted)' : 'var(--text-body)',
      textDecoration: it.done ? 'line-through' : 'none'
    }
  }, it.label)))));
}
Object.assign(__ds_scope, { Checklist });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checklist.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Square icon-only button. Variants match Button. Always pass aria-label.
 */
function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: 30,
    md: 36,
    lg: 42
  };
  const iconSizes = {
    sm: 15,
    md: 17,
    lg: 19
  };
  const dim = sizes[size] || sizes.md;
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid transparent'
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-default)'
    },
    primary: {
      background: 'var(--primary-bg)',
      color: 'var(--primary-fg)',
      border: '1px solid var(--primary-bg)'
    },
    danger: {
      background: 'transparent',
      color: 'var(--red-500)',
      border: '1px solid transparent'
    }
  };
  const v = variants[variant] || variants.ghost;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    disabled: disabled,
    onClick: onClick,
    className: `kbly-iconbtn kbly-iconbtn--${variant}`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim,
      height: dim,
      borderRadius: 'var(--radius-md)',
      padding: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard), color var(--dur-fast)',
      ...v,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSizes[size] || 17
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input with label, optional leading Lucide icon and error state. */
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon = null,
  error = null,
  hint = null,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const inputId = id || (label ? `kbly-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-medium)',
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    style: {
      position: 'absolute',
      insetInlineStart: 12,
      color: 'var(--text-subtle)'
    }
  }), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    className: "kbly-input",
    style: {
      width: '100%',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-md)',
      color: 'var(--text-strong)',
      background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
      border: `1px solid ${error ? 'var(--red-500)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      padding: icon ? '9px 13px 9px 36px' : '9px 13px',
      minHeight: 40,
      outline: 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
    }
  }, rest))), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--status-danger-fg)'
    }
  }, error), !error && hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/MetricCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Dashboard KPI tile — big value, label, optional delta and Lucide icon.
 * Used for "Eventos aceitos", "Jobs na fila", "Dispatches enviados", "Budget restante".
 */
function MetricCard({
  label,
  value,
  icon = null,
  delta = null,
  deltaTone = 'neutral',
  accent = false,
  style = {},
  ...rest
}) {
  const deltaColors = {
    up: 'var(--status-success-fg)',
    down: 'var(--status-danger-fg)',
    neutral: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }
  }, rest), accent && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      insetInlineStart: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: 'var(--accent)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      fontWeight: 'var(--fw-medium)'
    }
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--text-strong)',
      letterSpacing: 'var(--ls-tight)',
      lineHeight: 1
    }
  }, value), delta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: deltaColors[deltaTone] || deltaColors.neutral
    }
  }, delta)));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select styled to match Kobly inputs. `options`: [{value,label}] or strings. */
function Select({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const selId = id || (label ? `kbly-sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-medium)',
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selId,
    value: value,
    onChange: onChange,
    disabled: disabled,
    className: "kbly-input",
    style: {
      width: '100%',
      appearance: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-md)',
      color: 'var(--text-strong)',
      background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '9px 36px 9px 13px',
      minHeight: 40,
      outline: 'none',
      cursor: 'pointer'
    }
  }, rest), opts.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16,
    style: {
      position: 'absolute',
      insetInlineEnd: 12,
      color: 'var(--text-subtle)',
      pointerEvents: 'none'
    }
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusLine.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  success: {
    fg: 'var(--status-success-fg)',
    bg: 'var(--status-success-bg)',
    icon: 'circle-check'
  },
  error: {
    fg: 'var(--status-danger-fg)',
    bg: 'var(--status-danger-bg)',
    icon: 'circle-alert'
  },
  warning: {
    fg: 'var(--status-warning-fg)',
    bg: 'var(--status-warning-bg)',
    icon: 'triangle-alert'
  },
  info: {
    fg: 'var(--status-info-fg)',
    bg: 'var(--status-info-bg)',
    icon: 'info'
  },
  loading: {
    fg: 'var(--text-muted)',
    bg: 'var(--surface-sunken)',
    icon: 'loader'
  }
};

/** Inline status message line — success / error / warning / info / loading. */
function StatusLine({
  children,
  tone = 'info',
  icon,
  style = {},
  ...rest
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-medium)',
      color: t.fg,
      background: t.bg,
      padding: '9px 13px',
      borderRadius: 'var(--radius-md)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t.icon,
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { StatusLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusLine.jsx", error: String((e && e.message) || e) }); }

// components/core/TemplateCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Campaign-template chooser tile (the "Nova campanha" grid). Icon, title, description.
 * `disabled` dims it (no write permission). `selected` shows the teal active ring.
 */
function TemplateCard({
  icon = 'sparkles',
  title,
  description,
  selected = false,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    className: "kbly-template",
    style: {
      textAlign: 'start',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: '100%',
      background: 'var(--surface-card)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
      boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-xs)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      opacity: disabled ? 0.55 : 1,
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-raised)',
      color: 'var(--accent)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 19
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)'
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--lh-snug)'
    }
  }, description));
}
Object.assign(__ds_scope, { TemplateCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TemplateCard.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Operational table for clientes / campanhas / leads / integrações.
 * `columns`: [{ key, header, width, align, render(row) }]. `rows`: array of objects.
 * Set `empty` for the empty-state message. Row hover wash via .kbly-row class.
 */
function DataTable({
  columns = [],
  rows = [],
  empty = 'Sem registros',
  rowKey = 'id',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: '100%',
      overflowX: 'auto',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || 'start',
      padding: '11px 16px',
      width: c.width,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
      whiteSpace: 'nowrap',
      background: 'var(--surface-card)'
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      padding: '32px 16px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: 'var(--text-sm)'
    }
  }, empty)) : rows.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: row[rowKey] ?? ri,
    className: "kbly-row",
    style: {
      transition: 'background var(--dur-fast)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      textAlign: c.align || 'start',
      padding: '13px 16px',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)',
      borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
      verticalAlign: 'middle'
    }
  }, c.render ? c.render(row) : row[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Single nav item in the navy rail. Active = translucent teal wash + teal text + left bar. */
function NavButton({
  icon,
  label,
  active = false,
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    className: "kbly-nav-btn",
    "aria-current": active ? 'page' : undefined,
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      textAlign: 'start',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-md)',
      fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
      color: active ? '#fff' : 'var(--text-on-dark-muted)',
      background: active ? 'var(--surface-nav-active)' : 'transparent',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
      cursor: 'pointer',
      transition: 'background var(--dur-fast), color var(--dur-fast)',
      ...style
    }
  }, rest), active && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      insetInlineStart: 0,
      top: 8,
      bottom: 8,
      width: 3,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent)'
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    style: {
      color: active ? 'var(--accent)' : 'currentColor'
    }
  }), /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { NavButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavButton.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavRail.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The navy 260px sidebar: brand header, primary nav, workspace footer.
 * `items`: [{ id, icon, label }]. `active` is the current id. `markSrc` = logo URL.
 */
function NavRail({
  items = [],
  active,
  onNavigate,
  brand = 'Kobly',
  markSrc = null,
  workspaceName = 'Agência Demo',
  workspaceMeta = 'Plano starter',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      width: 'var(--sidebar-width)',
      flex: 'none',
      minHeight: '100%',
      background: 'var(--surface-nav)',
      display: 'flex',
      flexDirection: 'column',
      borderInlineEnd: '1px solid var(--border-nav)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '20px 18px 18px'
    }
  }, markSrc ? /*#__PURE__*/React.createElement("img", {
    src: markSrc,
    alt: brand,
    width: "34",
    height: "34",
    style: {
      display: 'block',
      borderRadius: 9
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'var(--fw-extra)',
      fontSize: 18
    }
  }, "K"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: 'var(--ls-tight)'
    }
  }, brand)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '6px 12px',
      flex: 1
    }
  }, items.map(it => /*#__PURE__*/React.createElement(__ds_scope.NavButton, {
    key: it.id,
    icon: it.icon,
    label: it.label,
    active: active === it.id,
    onClick: () => onNavigate && onNavigate(it.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 16px',
      margin: 12,
      borderRadius: 'var(--radius-md)',
      background: 'rgba(255,255,255,0.05)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: workspaceName,
    tone: "teal",
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, workspaceName), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-on-dark-muted)',
      fontSize: 'var(--text-xs)'
    }
  }, workspaceMeta))));
}
Object.assign(__ds_scope, { NavRail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/App.jsx
try { (() => {
// Kobly UI kit — App shell. window.KoblyApp
const {
  NavRail,
  Button
} = window.KoblyDesignSystem_29b7f4;
const ROUTES = {
  dashboard: {
    title: 'Dashboard',
    screen: 'KoblyDashboard'
  },
  clients: {
    title: 'Clientes',
    screen: 'KoblyClients'
  },
  campaigns: {
    title: 'Campanhas',
    screen: 'KoblyCampaigns'
  },
  leads: {
    title: 'Leads',
    screen: 'KoblyLeads'
  },
  integrations: {
    title: 'Integrações',
    screen: 'KoblyIntegrations'
  },
  support: {
    title: 'Suporte',
    screen: 'KoblySupport'
  }
};
function App() {
  const D = window.KoblyData;
  const Topbar = window.KoblyTopbar;
  const [view, setView] = React.useState('dashboard');
  const route = ROUTES[view];
  const Screen = window[route.screen];
  const eyebrow = `${D.session.role} / ${D.session.workspace}`;
  const actions = view === 'dashboard' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconLeft: "refresh-cw"
  }, "Rodar worker"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    iconLeft: "zap"
  }, "Simular webhook")) : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--surface-app)'
    }
  }, /*#__PURE__*/React.createElement(NavRail, {
    items: D.nav,
    active: view,
    onNavigate: setView,
    markSrc: "../../assets/kobly-mark.svg",
    workspaceName: D.session.workspace,
    workspaceMeta: D.session.plan
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    eyebrow: eyebrow,
    title: route.title,
    actions: actions
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--content-pad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--content-max)',
      margin: '0 auto'
    }
  }, Screen ? /*#__PURE__*/React.createElement(Screen, null) : null))));
}
window.KoblyApp = App;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Campaigns.jsx
try { (() => {
// Kobly UI kit — Campanhas screen (list + Nova campanha). window.KoblyCampaigns
const {
  Card,
  DataTable,
  Badge,
  Button,
  IconButton,
  TemplateCard,
  StatusLine,
  Icon
} = window.KoblyDesignSystem_29b7f4;
function Breadcrumb({
  trail
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16
    }
  }, trail.map((t, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 15,
    style: {
      color: 'var(--text-subtle)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: i === trail.length - 1 ? 'var(--fw-semibold)' : 'var(--fw-medium)',
      color: i === trail.length - 1 ? 'var(--text-strong)' : 'var(--text-muted)'
    }
  }, t))));
}
function Campaigns() {
  const D = window.KoblyData;
  const [list, setList] = React.useState(D.campaigns);
  const [mode, setMode] = React.useState('list'); // list | new
  const [status, setStatus] = React.useState(null);
  function toggle(id) {
    setList(rows => rows.map(r => {
      if (r.id !== id || r.status === 'archived') return r;
      const next = r.status === 'active' ? 'paused' : 'active';
      return {
        ...r,
        status: next,
        statusLabel: next === 'active' ? 'Ativa' : 'Pausada'
      };
    }));
  }
  function archive(id) {
    setList(rows => rows.map(r => r.id === id ? {
      ...r,
      status: 'archived',
      statusLabel: 'Arquivada'
    } : r));
    setStatus({
      tone: 'info',
      msg: 'Campanha arquivada (delete lógico — histórico preservado).'
    });
  }
  function createFrom(tpl) {
    const id = 'c' + (list.length + 1) + Date.now().toString().slice(-3);
    const name = tpl.id === 't0' ? 'Nova campanha' : tpl.title;
    setList(rows => [{
      id,
      name,
      trigger: 'Abandono de carrinho',
      triggerProvider: 'Hotmart',
      cadence: '1 passo · E-mail',
      status: 'draft',
      statusLabel: 'Rascunho'
    }, ...rows]);
    setMode('list');
    setStatus({
      tone: 'success',
      msg: 'Campanha criada'
    });
  }
  const columns = [{
    key: 'name',
    header: 'Campanha',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-strong)'
      }
    }, r.name)
  }, {
    key: 'trigger',
    header: 'Gatilho',
    render: r => /*#__PURE__*/React.createElement("span", null, r.trigger, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-subtle)'
      }
    }, " \xB7 ", r.triggerProvider))
  }, {
    key: 'cadence',
    header: 'Cadência'
  }, {
    key: 'status',
    header: 'Status',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      status: r.status,
      dot: true
    }, r.statusLabel)
  }, {
    key: 'actions',
    header: '',
    align: 'end',
    width: 130,
    render: r => r.status === 'archived' ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        color: 'var(--text-subtle)'
      }
    }, "Somente leitura") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: r.status === 'active' ? 'pause' : 'play',
      "aria-label": r.status === 'active' ? 'Pausar' : 'Ativar',
      onClick: () => toggle(r.id)
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "pencil",
      "aria-label": "Renomear"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "archive",
      variant: "danger",
      "aria-label": "Arquivar",
      onClick: () => archive(r.id)
    }))
  }];
  if (mode === 'new') {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Breadcrumb, {
      trail: ['Minhas campanhas', 'Nova campanha']
    }), /*#__PURE__*/React.createElement(Card, {
      title: "Escolha um template",
      subtitle: "Comece de um preset de neg\xF3cio ou em branco",
      action: /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "sm",
        iconLeft: "arrow-left",
        onClick: () => setMode('list')
      }, "Voltar")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12
      }
    }, D.templates.map(t => /*#__PURE__*/React.createElement(TemplateCard, {
      key: t.id,
      icon: t.icon,
      title: t.title,
      description: t.desc,
      onClick: () => createFrom(t)
    })))));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Breadcrumb, {
    trail: ['Minhas campanhas']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, list.length, " campanhas neste workspace"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: "plus",
    onClick: () => {
      setMode('new');
      setStatus(null);
    }
  }, "Nova campanha")), status && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(StatusLine, {
    tone: status.tone
  }, status.msg)), /*#__PURE__*/React.createElement(Card, {
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: list,
    empty: "Simule um webhook para iniciar a cad\xEAncia"
  })));
}
window.KoblyCampaigns = Campaigns;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Campaigns.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Clients.jsx
try { (() => {
// Kobly UI kit — Clientes screen. window.KoblyClients
const {
  Card,
  DataTable,
  Badge,
  Avatar,
  Button
} = window.KoblyDesignSystem_29b7f4;
function Clients() {
  const rows = [{
    id: 'w1',
    name: 'Agência Demo',
    tenant: 'demo',
    domain: 'sandbox',
    campaigns: 4,
    leads: 312
  }, {
    id: 'w2',
    name: 'Loja Vega',
    tenant: 'vega',
    domain: 'sandbox',
    campaigns: 2,
    leads: 188
  }, {
    id: 'w3',
    name: 'InfoPro Cursos',
    tenant: 'infopro',
    domain: 'sandbox',
    campaigns: 1,
    leads: 54
  }];
  const columns = [{
    key: 'name',
    header: 'Workspace',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: r.name,
      tone: "teal",
      size: "sm"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-strong)'
      }
    }, r.name))
  }, {
    key: 'tenant',
    header: 'Tenant',
    render: r => /*#__PURE__*/React.createElement("code", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)'
      }
    }, r.tenant)
  }, {
    key: 'domain',
    header: 'Domínio',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      status: "sandbox"
    }, "Sandbox")
  }, {
    key: 'campaigns',
    header: 'Campanhas',
    align: 'center'
  }, {
    key: 'leads',
    header: 'Leads',
    align: 'center'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: "plus"
  }, "Novo workspace")), /*#__PURE__*/React.createElement(Card, {
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: rows
  })));
}
window.KoblyClients = Clients;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Clients.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Dashboard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Kobly UI kit — Dashboard screen. window.KoblyDashboard
const {
  MetricCard,
  Card,
  Checklist,
  Badge,
  Icon
} = window.KoblyDesignSystem_29b7f4;
function EventRow({
  ev
}) {
  const D = window.KoblyData;
  const tone = D.providerTone[ev.type] || 'neutral';
  return /*#__PURE__*/React.createElement("li", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 34,
      height: 34,
      flex: 'none',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-raised)',
      color: 'var(--accent)',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "webhook",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, ev.email), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, ev.product, " \xB7 ", ev.provider)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    status: ev.type,
    dot: true,
    size: "sm"
  }, ev.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-subtle)',
      whiteSpace: 'nowrap'
    }
  }, ev.when)));
}
function Dashboard() {
  const D = window.KoblyData;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16
    }
  }, D.metrics.map((m, i) => /*#__PURE__*/React.createElement(MetricCard, _extends({
    key: i
  }, m)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "\xDAltimos eventos",
    subtitle: "Eventos de checkout aceitos por webhook"
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, D.events.map(ev => /*#__PURE__*/React.createElement(EventRow, {
    key: ev.id,
    ev: ev
  })))), /*#__PURE__*/React.createElement(Checklist, {
    items: D.onboarding
  })));
}
window.KoblyDashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Integrations.jsx
try { (() => {
// Kobly UI kit — Integrações screen. window.KoblyIntegrations
const {
  Card,
  DataTable,
  Badge,
  Button,
  IconButton
} = window.KoblyDesignSystem_29b7f4;
function Integrations() {
  const D = window.KoblyData;
  const columns = [{
    key: 'provider',
    header: 'Provedor',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-strong)'
      }
    }, r.provider)
  }, {
    key: 'kind',
    header: 'Tipo'
  }, {
    key: 'signature',
    header: 'Assinatura',
    render: r => r.signature ? /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "HMAC exigida") : /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Opcional")
  }, {
    key: 'status',
    header: 'Status',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      status: r.status
    }, "Sandbox")
  }, {
    key: 'actions',
    header: '',
    align: 'end',
    render: () => /*#__PURE__*/React.createElement(IconButton, {
      icon: "settings",
      "aria-label": "Configurar"
    })
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Webhook sandbox",
    subtitle: "Endpoint de checkout normalizado para o contrato interno CheckoutEvent",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: "play"
    }, "Simular webhook")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, "POST"), /*#__PURE__*/React.createElement("span", {
    style: {
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }
  }, "/api/webhooks/checkout/{provider}"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "copy",
    "aria-label": "Copiar"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)'
    }
  }, "x-kobly-signature: t=<unix>,v1=<hmac-sha256> \xB7 janela 300s")), /*#__PURE__*/React.createElement(Card, {
    title: "Provedores & adapters",
    subtitle: "Checkout (Hotmart \xB7 Braip \xB7 Vega) e envio (Brevo \xB7 WhatsApp \xB7 SMS)",
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: D.integrations
  })));
}
window.KoblyIntegrations = Integrations;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Integrations.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Leads.jsx
try { (() => {
// Kobly UI kit — Leads screen. window.KoblyLeads
const {
  Card,
  DataTable,
  Badge,
  Input,
  Icon
} = window.KoblyDesignSystem_29b7f4;
function OptOut({
  channels
}) {
  const D = window.KoblyData;
  if (!channels.length) return /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Ativo em todos");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, channels.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 'var(--text-xs)',
      color: 'var(--status-danger-fg)',
      background: 'var(--status-danger-bg)',
      padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: D.channelIcon[c],
    size: 12
  }), c)));
}
function Leads() {
  const D = window.KoblyData;
  const [q, setQ] = React.useState('');
  const rows = D.leads.filter(l => (l.name + l.email).toLowerCase().includes(q.toLowerCase()));
  const columns = [{
    key: 'name',
    header: 'Lead',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-strong)'
      }
    }, r.name)
  }, {
    key: 'email',
    header: 'E-mail',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)'
      }
    }, r.email)
  }, {
    key: 'phone',
    header: 'Telefone',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)'
      }
    }, r.phone)
  }, {
    key: 'optout',
    header: 'Opt-out',
    render: r => /*#__PURE__*/React.createElement(OptOut, {
      channels: r.optout
    })
  }, {
    key: 'workspace',
    header: 'Workspace'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "Buscar leads\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, rows.length, " leads")), /*#__PURE__*/React.createElement(Card, {
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: rows,
    empty: "Nenhum lead encontrado"
  })));
}
window.KoblyLeads = Leads;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Leads.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Support.jsx
try { (() => {
// Kobly UI kit — Suporte screen. window.KoblySupport
const {
  Card,
  DataTable,
  Badge,
  MetricCard,
  Button,
  IconButton,
  Icon
} = window.KoblyDesignSystem_29b7f4;
function Support() {
  const D = window.KoblyData;
  const dlCols = [{
    key: 'campaign',
    header: 'Campanha',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-strong)'
      }
    }, r.campaign)
  }, {
    key: 'channel',
    header: 'Canal',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: D.channelIcon[r.channel],
      size: 14,
      style: {
        color: 'var(--text-muted)'
      }
    }), r.channel)
  }, {
    key: 'reason',
    header: 'Motivo',
    render: r => /*#__PURE__*/React.createElement("code", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--status-danger-fg)',
        background: 'var(--status-danger-bg)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-xs)'
      }
    }, r.reason)
  }, {
    key: 'attempts',
    header: 'Tentativas',
    align: 'center'
  }, {
    key: 'when',
    header: '',
    align: 'end',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        color: 'var(--text-subtle)'
      }
    }, r.when)
  }];
  const brCols = [{
    key: 'provider',
    header: 'Provedor',
    render: r => /*#__PURE__*/React.createElement("code", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-strong)'
      }
    }, r.provider)
  }, {
    key: 'status',
    header: 'Circuito',
    render: r => r.status === 'open' ? /*#__PURE__*/React.createElement(Badge, {
      tone: "danger",
      dot: true
    }, "Aberto") : /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Fechado")
  }, {
    key: 'reason',
    header: 'Motivo'
  }, {
    key: 'actions',
    header: '',
    align: 'end',
    render: r => r.status === 'open' ? /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: "rotate-ccw"
    }, "Reabrir") : null
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(MetricCard, {
    label: "Dead letters",
    value: "2",
    icon: "alert-octagon"
  }), /*#__PURE__*/React.createElement(MetricCard, {
    label: "Circuitos abertos",
    value: "1",
    icon: "zap-off"
  }), /*#__PURE__*/React.createElement(MetricCard, {
    label: "Modo",
    value: "Sandbox",
    icon: "flask-conical"
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Dead letters",
    subtitle: "Jobs que estouraram o limite de tentativas \u2014 payload preservado",
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: dlCols,
    rows: D.deadLetters,
    empty: "Sem dead letters"
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Circuit breakers",
    subtitle: "Bloqueio por provedor/canal ap\xF3s falhas",
    pad: false
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: brCols,
    rows: D.breakers
  })));
}
window.KoblySupport = Support;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Support.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Topbar.jsx
try { (() => {
// Kobly UI kit — Topbar. window.KoblyTopbar
const {
  Avatar
} = window.KoblyDesignSystem_29b7f4;
function Topbar({
  eyebrow,
  title,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      height: 'var(--topbar-height)',
      padding: '0 var(--content-pad)',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      letterSpacing: 'var(--ls-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--text-strong)',
      letterSpacing: 'var(--ls-tight)',
      marginTop: 2
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, actions, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 30,
      background: 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: window.KoblyData.session.name
  })));
}
window.KoblyTopbar = Topbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Topbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
// Kobly UI kit — sample data (fake, pt-BR). Exposes window.KoblyData.
window.KoblyData = {
  session: {
    name: 'Vitor Andrade',
    role: 'Gestor',
    workspace: 'Agência Demo',
    plan: 'Plano starter'
  },
  nav: [{
    id: 'dashboard',
    icon: 'layout-dashboard',
    label: 'Dashboard'
  }, {
    id: 'clients',
    icon: 'users',
    label: 'Clientes'
  }, {
    id: 'campaigns',
    icon: 'megaphone',
    label: 'Campanhas'
  }, {
    id: 'leads',
    icon: 'user-round',
    label: 'Leads'
  }, {
    id: 'integrations',
    icon: 'plug',
    label: 'Integrações'
  }, {
    id: 'support',
    icon: 'life-buoy',
    label: 'Suporte'
  }],
  metrics: [{
    label: 'Eventos aceitos',
    value: '1.284',
    icon: 'inbox',
    delta: '+12%',
    deltaTone: 'up'
  }, {
    label: 'Jobs na fila',
    value: '37',
    icon: 'list-checks',
    delta: '+4',
    deltaTone: 'neutral'
  }, {
    label: 'Dispatches enviados',
    value: '961',
    icon: 'send',
    delta: '+8%',
    deltaTone: 'up'
  }, {
    label: 'Budget restante',
    value: '8.450',
    icon: 'wallet',
    accent: true
  }],
  onboarding: [{
    label: 'Configurar perfil',
    done: true
  }, {
    label: 'Criar primeira campanha',
    done: true
  }, {
    label: 'Integrar ferramentas',
    done: false
  }],
  events: [{
    id: 'e1',
    provider: 'Hotmart',
    type: 'cart_abandoned',
    label: 'Abandono de carrinho',
    email: 'ana.souza@email.com',
    product: 'Curso de Tráfego',
    when: 'há 2 min'
  }, {
    id: 'e2',
    provider: 'Braip',
    type: 'pix_generated',
    label: 'PIX gerado',
    email: 'lucas.m@email.com',
    product: 'Mentoria Pro',
    when: 'há 6 min'
  }, {
    id: 'e3',
    provider: 'Vega',
    type: 'purchase_approved',
    label: 'Compra aprovada',
    email: 'carla.r@email.com',
    product: 'E-book Vendas',
    when: 'há 11 min'
  }, {
    id: 'e4',
    provider: 'Hotmart',
    type: 'cart_abandoned',
    label: 'Abandono de carrinho',
    email: 'pedro.alves@email.com',
    product: 'Curso de Tráfego',
    when: 'há 18 min'
  }, {
    id: 'e5',
    provider: 'Braip',
    type: 'purchase_approved',
    label: 'Compra aprovada',
    email: 'julia.f@email.com',
    product: 'Mentoria Pro',
    when: 'há 24 min'
  }],
  campaigns: [{
    id: 'c1',
    name: 'Recuperação de carrinho',
    trigger: 'Abandono de carrinho',
    triggerProvider: 'Hotmart',
    cadence: '3 passos · E-mail · WhatsApp',
    status: 'active',
    statusLabel: 'Ativa'
  }, {
    id: 'c2',
    name: 'PIX gerado — lembrete',
    trigger: 'PIX gerado',
    triggerProvider: 'Braip',
    cadence: '2 passos · WhatsApp · SMS',
    status: 'paused',
    statusLabel: 'Pausada'
  }, {
    id: 'c3',
    name: 'Pós-venda curso',
    trigger: 'Compra aprovada',
    triggerProvider: 'Vega',
    cadence: '4 passos · E-mail',
    status: 'active',
    statusLabel: 'Ativa'
  }, {
    id: 'c4',
    name: 'Nutrição de leads',
    trigger: 'Compra aprovada',
    triggerProvider: 'Hotmart',
    cadence: '5 passos · E-mail',
    status: 'draft',
    statusLabel: 'Rascunho'
  }, {
    id: 'c5',
    name: 'Cupom de desconto',
    trigger: 'Abandono de carrinho',
    triggerProvider: 'Braip',
    cadence: '2 passos · WhatsApp',
    status: 'archived',
    statusLabel: 'Arquivada'
  }],
  templates: [{
    id: 't0',
    icon: 'plus',
    title: 'Criar em branco',
    desc: 'Comece sem preset de negócio.'
  }, {
    id: 't1',
    icon: 'shopping-cart',
    title: 'Abandono de carrinho',
    desc: 'Recupera carrinhos em uma cadência multicanal.'
  }, {
    id: 't2',
    icon: 'graduation-cap',
    title: 'Vender curso',
    desc: 'Sequência para conversão de cursos.'
  }, {
    id: 't3',
    icon: 'gift',
    title: 'Indique e ganhe',
    desc: 'Campanha de indicação para a base.'
  }, {
    id: 't4',
    icon: 'heart-handshake',
    title: 'Pós-venda',
    desc: 'Relacionamento após a compra aprovada.'
  }, {
    id: 't5',
    icon: 'badge-percent',
    title: 'Cupom de desconto',
    desc: 'Promoção com código de desconto.'
  }, {
    id: 't6',
    icon: 'message-square-reply',
    title: 'Resposta automática',
    desc: 'Resposta imediata a um evento.'
  }, {
    id: 't7',
    icon: 'sprout',
    title: 'Nutrição de leads',
    desc: 'Educa e aquece leads ao longo do tempo.'
  }],
  leads: [{
    id: 'l1',
    name: 'Ana Souza',
    email: 'ana.souza@email.com',
    phone: '+55 11 98xxx-1234',
    optout: [],
    workspace: 'Agência Demo'
  }, {
    id: 'l2',
    name: 'Lucas Martins',
    email: 'lucas.m@email.com',
    phone: '+55 21 99xxx-8890',
    optout: ['sms'],
    workspace: 'Agência Demo'
  }, {
    id: 'l3',
    name: 'Carla Ribeiro',
    email: 'carla.r@email.com',
    phone: '+55 31 98xxx-4521',
    optout: [],
    workspace: 'Loja Vega'
  }, {
    id: 'l4',
    name: 'Pedro Alves',
    email: 'pedro.alves@email.com',
    phone: '—',
    optout: ['whatsapp', 'sms'],
    workspace: 'Agência Demo'
  }, {
    id: 'l5',
    name: 'Julia Ferreira',
    email: 'julia.f@email.com',
    phone: '+55 41 99xxx-2017',
    optout: [],
    workspace: 'Loja Vega'
  }],
  deadLetters: [{
    id: 'd1',
    campaign: 'PIX gerado — lembrete',
    channel: 'sms',
    reason: 'budget_exhausted',
    attempts: 5,
    when: 'há 1 h'
  }, {
    id: 'd2',
    campaign: 'Recuperação de carrinho',
    channel: 'whatsapp',
    reason: 'provider_circuit_open',
    attempts: 5,
    when: 'há 3 h'
  }],
  breakers: [{
    id: 'b1',
    provider: 'whatsapp_demo',
    status: 'open',
    reason: 'Falhas consecutivas no adapter'
  }, {
    id: 'b2',
    provider: 'sms_demo',
    status: 'closed',
    reason: '—'
  }],
  integrations: [{
    id: 'i1',
    provider: 'Hotmart',
    kind: 'Webhook de checkout',
    status: 'sandbox',
    signature: true
  }, {
    id: 'i2',
    provider: 'Braip',
    kind: 'Webhook de checkout',
    status: 'sandbox',
    signature: true
  }, {
    id: 'i3',
    provider: 'Vega',
    kind: 'Webhook de checkout',
    status: 'sandbox',
    signature: false
  }, {
    id: 'i4',
    provider: 'Brevo',
    kind: 'Adapter de e-mail',
    status: 'sandbox',
    signature: false
  }, {
    id: 'i5',
    provider: 'WhatsApp demo',
    kind: 'Adapter de WhatsApp',
    status: 'sandbox',
    signature: false
  }, {
    id: 'i6',
    provider: 'SMS demo',
    kind: 'Adapter de SMS',
    status: 'sandbox',
    signature: false
  }],
  channelIcon: {
    email: 'mail',
    whatsapp: 'message-circle',
    sms: 'smartphone'
  },
  providerTone: {
    cart_abandoned: 'danger',
    pix_generated: 'warning',
    purchase_approved: 'success'
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.STATUS_TONE = __ds_scope.STATUS_TONE;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Checklist = __ds_scope.Checklist;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.StatusLine = __ds_scope.StatusLine;

__ds_ns.TemplateCard = __ds_scope.TemplateCard;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.NavButton = __ds_scope.NavButton;

__ds_ns.NavRail = __ds_scope.NavRail;

})();
