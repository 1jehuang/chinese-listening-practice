(() => {
  // node_modules/preact/dist/preact.module.js
  var n;
  var l;
  var u;
  var t;
  var i;
  var r;
  var o;
  var e;
  var f;
  var c;
  var s;
  var a;
  var h;
  var p;
  var v;
  var y;
  var d = {};
  var w = [];
  var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  var g = Array.isArray;
  function m(n2, l3) {
    for (var u3 in l3) n2[u3] = l3[u3];
    return n2;
  }
  function b(n2) {
    n2 && n2.parentNode && n2.parentNode.removeChild(n2);
  }
  function k(l3, u3, t3) {
    var i3, r3, o3, e3 = {};
    for (o3 in u3) "key" == o3 ? i3 = u3[o3] : "ref" == o3 ? r3 = u3[o3] : e3[o3] = u3[o3];
    if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
    return x(l3, e3, i3, r3, null);
  }
  function x(n2, t3, i3, r3, o3) {
    var e3 = { type: n2, props: t3, key: i3, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
    return null == o3 && null != l.vnode && l.vnode(e3), e3;
  }
  function S(n2) {
    return n2.children;
  }
  function C(n2, l3) {
    this.props = n2, this.context = l3;
  }
  function $(n2, l3) {
    if (null == l3) return n2.__ ? $(n2.__, n2.__i + 1) : null;
    for (var u3; l3 < n2.__k.length; l3++) if (null != (u3 = n2.__k[l3]) && null != u3.__e) return u3.__e;
    return "function" == typeof n2.type ? $(n2) : null;
  }
  function I(n2) {
    if (n2.__P && n2.__d) {
      var u3 = n2.__v, t3 = u3.__e, i3 = [], r3 = [], o3 = m({}, u3);
      o3.__v = u3.__v + 1, l.vnode && l.vnode(o3), q(n2.__P, o3, u3, n2.__n, n2.__P.namespaceURI, 32 & u3.__u ? [t3] : null, i3, null == t3 ? $(u3) : t3, !!(32 & u3.__u), r3), o3.__v = u3.__v, o3.__.__k[o3.__i] = o3, D(i3, o3, r3), u3.__e = u3.__ = null, o3.__e != t3 && P(o3);
    }
  }
  function P(n2) {
    if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
      if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
    }), P(n2);
  }
  function A(n2) {
    (!n2.__d && (n2.__d = true) && i.push(n2) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
  }
  function H() {
    try {
      for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, I(n2);
    } finally {
      i.length = H.__r = 0;
    }
  }
  function L(n2, l3, u3, t3, i3, r3, o3, e3, f3, c3, s3) {
    var a3, h2, p3, v3, y3, _2, g2, m3 = t3 && t3.__k || w, b2 = l3.length;
    for (f3 = T(u3, l3, m3, f3, b2), a3 = 0; a3 < b2; a3++) null != (p3 = u3.__k[a3]) && (h2 = -1 != p3.__i && m3[p3.__i] || d, p3.__i = a3, _2 = q(n2, p3, h2, i3, r3, o3, e3, f3, c3, s3), v3 = p3.__e, p3.ref && h2.ref != p3.ref && (h2.ref && J(h2.ref, null, p3), s3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), (g2 = !!(4 & p3.__u)) || h2.__k === p3.__k ? (f3 = j(p3, f3, n2, g2), g2 && h2.__e && (h2.__e = null)) : "function" == typeof p3.type && void 0 !== _2 ? f3 = _2 : v3 && (f3 = v3.nextSibling), p3.__u &= -7);
    return u3.__e = y3, f3;
  }
  function T(n2, l3, u3, t3, i3) {
    var r3, o3, e3, f3, c3, s3 = u3.length, a3 = s3, h2 = 0;
    for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f3 = r3 + h2, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u3, f3, a3)) && (a3--, (e3 = u3[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > s3 ? h2-- : i3 < s3 && h2++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f3 && (c3 == f3 - 1 ? h2-- : c3 == f3 + 1 ? h2++ : (c3 > f3 ? h2-- : h2++, o3.__u |= 4))) : n2.__k[r3] = null;
    if (a3) for (r3 = 0; r3 < s3; r3++) null != (e3 = u3[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = $(e3)), K(e3, e3));
    return t3;
  }
  function j(n2, l3, u3, t3) {
    var i3, r3;
    if ("function" == typeof n2.type) {
      for (i3 = n2.__k, r3 = 0; i3 && r3 < i3.length; r3++) i3[r3] && (i3[r3].__ = n2, l3 = j(i3[r3], l3, u3, t3));
      return l3;
    }
    n2.__e != l3 && (t3 && (l3 && n2.type && !l3.parentNode && (l3 = $(n2)), u3.insertBefore(n2.__e, l3 || null)), l3 = n2.__e);
    do {
      l3 = l3 && l3.nextSibling;
    } while (null != l3 && 8 == l3.nodeType);
    return l3;
  }
  function O(n2, l3, u3, t3) {
    var i3, r3, o3, e3 = n2.key, f3 = n2.type, c3 = l3[u3], s3 = null != c3 && 0 == (2 & c3.__u);
    if (null === c3 && null == e3 || s3 && e3 == c3.key && f3 == c3.type) return u3;
    if (t3 > (s3 ? 1 : 0)) {
      for (i3 = u3 - 1, r3 = u3 + 1; i3 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f3 == c3.type) return o3;
    }
    return -1;
  }
  function z(n2, l3, u3) {
    "-" == l3[0] ? n2.setProperty(l3, null == u3 ? "" : u3) : n2[l3] = null == u3 ? "" : "number" != typeof u3 || _.test(l3) ? u3 : u3 + "px";
  }
  function N(n2, l3, u3, t3, i3) {
    var r3, o3;
    n: if ("style" == l3) if ("string" == typeof u3) n2.style.cssText = u3;
    else {
      if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u3 && l3 in u3 || z(n2.style, l3, "");
      if (u3) for (l3 in u3) t3 && u3[l3] == t3[l3] || z(n2.style, l3, u3[l3]);
    }
    else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(a, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u3, u3 ? t3 ? u3[s] = t3[s] : (u3[s] = h, n2.addEventListener(l3, r3 ? v : p, r3)) : n2.removeEventListener(l3, r3 ? v : p, r3);
    else {
      if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
        n2[l3] = null == u3 ? "" : u3;
        break n;
      } catch (n3) {
      }
      "function" == typeof u3 || (null == u3 || false === u3 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u3 ? "" : u3));
    }
  }
  function V(n2) {
    return function(u3) {
      if (this.l) {
        var t3 = this.l[u3.type + n2];
        if (null == u3[c]) u3[c] = h++;
        else if (u3[c] < t3[s]) return;
        return t3(l.event ? l.event(u3) : u3);
      }
    };
  }
  function q(n2, u3, t3, i3, r3, o3, e3, f3, c3, s3) {
    var a3, h2, p3, v3, y3, d2, _2, k3, x2, M, $2, I2, P2, A3, H2, T3 = u3.type;
    if (void 0 !== u3.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f3 = u3.__e = t3.__e]), (a3 = l.__b) && a3(u3);
    n: if ("function" == typeof T3) try {
      if (k3 = u3.props, x2 = T3.prototype && T3.prototype.render, M = (a3 = T3.contextType) && i3[a3.__c], $2 = a3 ? M ? M.props.value : a3.__ : i3, t3.__c ? _2 = (h2 = u3.__c = t3.__c).__ = h2.__E : (x2 ? u3.__c = h2 = new T3(k3, $2) : (u3.__c = h2 = new C(k3, $2), h2.constructor = T3, h2.render = Q), M && M.sub(h2), h2.state || (h2.state = {}), h2.__n = i3, p3 = h2.__d = true, h2.__h = [], h2._sb = []), x2 && null == h2.__s && (h2.__s = h2.state), x2 && null != T3.getDerivedStateFromProps && (h2.__s == h2.state && (h2.__s = m({}, h2.__s)), m(h2.__s, T3.getDerivedStateFromProps(k3, h2.__s))), v3 = h2.props, y3 = h2.state, h2.__v = u3, p3) x2 && null == T3.getDerivedStateFromProps && null != h2.componentWillMount && h2.componentWillMount(), x2 && null != h2.componentDidMount && h2.__h.push(h2.componentDidMount);
      else {
        if (x2 && null == T3.getDerivedStateFromProps && k3 !== v3 && null != h2.componentWillReceiveProps && h2.componentWillReceiveProps(k3, $2), u3.__v == t3.__v || !h2.__e && null != h2.shouldComponentUpdate && false === h2.shouldComponentUpdate(k3, h2.__s, $2)) {
          u3.__v != t3.__v && (h2.props = k3, h2.state = h2.__s, h2.__d = false), u3.__e = t3.__e, u3.__k = t3.__k, u3.__k.some(function(n3) {
            n3 && (n3.__ = u3);
          }), w.push.apply(h2.__h, h2._sb), h2._sb = [], h2.__h.length && e3.push(h2);
          break n;
        }
        null != h2.componentWillUpdate && h2.componentWillUpdate(k3, h2.__s, $2), x2 && null != h2.componentDidUpdate && h2.__h.push(function() {
          h2.componentDidUpdate(v3, y3, d2);
        });
      }
      if (h2.context = $2, h2.props = k3, h2.__P = n2, h2.__e = false, I2 = l.__r, P2 = 0, x2) h2.state = h2.__s, h2.__d = false, I2 && I2(u3), a3 = h2.render(h2.props, h2.state, h2.context), w.push.apply(h2.__h, h2._sb), h2._sb = [];
      else do {
        h2.__d = false, I2 && I2(u3), a3 = h2.render(h2.props, h2.state, h2.context), h2.state = h2.__s;
      } while (h2.__d && ++P2 < 25);
      h2.state = h2.__s, null != h2.getChildContext && (i3 = m(m({}, i3), h2.getChildContext())), x2 && !p3 && null != h2.getSnapshotBeforeUpdate && (d2 = h2.getSnapshotBeforeUpdate(v3, y3)), A3 = null != a3 && a3.type === S && null == a3.key ? E(a3.props.children) : a3, f3 = L(n2, g(A3) ? A3 : [A3], u3, t3, i3, r3, o3, e3, f3, c3, s3), h2.base = u3.__e, u3.__u &= -161, h2.__h.length && e3.push(h2), _2 && (h2.__E = h2.__ = null);
    } catch (n3) {
      if (u3.__v = null, c3 || null != o3) if (n3.then) {
        for (u3.__u |= c3 ? 160 : 128; f3 && 8 == f3.nodeType && f3.nextSibling; ) f3 = f3.nextSibling;
        o3[o3.indexOf(f3)] = null, u3.__e = f3;
      } else {
        for (H2 = o3.length; H2--; ) b(o3[H2]);
        B(u3);
      }
      else u3.__e = t3.__e, u3.__k = t3.__k, n3.then || B(u3);
      l.__e(n3, u3, t3);
    }
    else null == o3 && u3.__v == t3.__v ? (u3.__k = t3.__k, u3.__e = t3.__e) : f3 = u3.__e = G(t3.__e, u3, t3, i3, r3, o3, e3, c3, s3);
    return (a3 = l.diffed) && a3(u3), 128 & u3.__u ? void 0 : f3;
  }
  function B(n2) {
    n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(B));
  }
  function D(n2, u3, t3) {
    for (var i3 = 0; i3 < t3.length; i3++) J(t3[i3], t3[++i3], t3[++i3]);
    l.__c && l.__c(u3, n2), n2.some(function(u4) {
      try {
        n2 = u4.__h, u4.__h = [], n2.some(function(n3) {
          n3.call(u4);
        });
      } catch (n3) {
        l.__e(n3, u4.__v);
      }
    });
  }
  function E(n2) {
    return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : g(n2) ? n2.map(E) : m({}, n2);
  }
  function G(u3, t3, i3, r3, o3, e3, f3, c3, s3) {
    var a3, h2, p3, v3, y3, w3, _2, m3 = i3.props || d, k3 = t3.props, x2 = t3.type;
    if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
      for (a3 = 0; a3 < e3.length; a3++) if ((y3 = e3[a3]) && "setAttribute" in y3 == !!x2 && (x2 ? y3.localName == x2 : 3 == y3.nodeType)) {
        u3 = y3, e3[a3] = null;
        break;
      }
    }
    if (null == u3) {
      if (null == x2) return document.createTextNode(k3);
      u3 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
    }
    if (null == x2) m3 === k3 || c3 && u3.data == k3 || (u3.data = k3);
    else {
      if (e3 = e3 && n.call(u3.childNodes), !c3 && null != e3) for (m3 = {}, a3 = 0; a3 < u3.attributes.length; a3++) m3[(y3 = u3.attributes[a3]).name] = y3.value;
      for (a3 in m3) y3 = m3[a3], "dangerouslySetInnerHTML" == a3 ? p3 = y3 : "children" == a3 || a3 in k3 || "value" == a3 && "defaultValue" in k3 || "checked" == a3 && "defaultChecked" in k3 || N(u3, a3, null, y3, o3);
      for (a3 in k3) y3 = k3[a3], "children" == a3 ? v3 = y3 : "dangerouslySetInnerHTML" == a3 ? h2 = y3 : "value" == a3 ? w3 = y3 : "checked" == a3 ? _2 = y3 : c3 && "function" != typeof y3 || m3[a3] === y3 || N(u3, a3, y3, m3[a3], o3);
      if (h2) c3 || p3 && (h2.__html == p3.__html || h2.__html == u3.innerHTML) || (u3.innerHTML = h2.__html), t3.__k = [];
      else if (p3 && (u3.innerHTML = ""), L("template" == t3.type ? u3.content : u3, g(v3) ? v3 : [v3], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f3, e3 ? e3[0] : i3.__k && $(i3, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) b(e3[a3]);
      c3 || (a3 = "value", "progress" == x2 && null == w3 ? u3.removeAttribute("value") : null != w3 && (w3 !== u3[a3] || "progress" == x2 && !w3 || "option" == x2 && w3 != m3[a3]) && N(u3, a3, w3, m3[a3], o3), a3 = "checked", null != _2 && _2 != u3[a3] && N(u3, a3, _2, m3[a3], o3));
    }
    return u3;
  }
  function J(n2, u3, t3) {
    try {
      if ("function" == typeof n2) {
        var i3 = "function" == typeof n2.__u;
        i3 && n2.__u(), i3 && null == u3 || (n2.__u = n2(u3));
      } else n2.current = u3;
    } catch (n3) {
      l.__e(n3, t3);
    }
  }
  function K(n2, u3, t3) {
    var i3, r3;
    if (l.unmount && l.unmount(n2), (i3 = n2.ref) && (i3.current && i3.current != n2.__e || J(i3, null, u3)), null != (i3 = n2.__c)) {
      if (i3.componentWillUnmount) try {
        i3.componentWillUnmount();
      } catch (n3) {
        l.__e(n3, u3);
      }
      i3.base = i3.__P = null;
    }
    if (i3 = n2.__k) for (r3 = 0; r3 < i3.length; r3++) i3[r3] && K(i3[r3], u3, t3 || "function" != typeof n2.type);
    t3 || b(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
  }
  function Q(n2, l3, u3) {
    return this.constructor(n2, u3);
  }
  function R(u3, t3, i3) {
    var r3, o3, e3, f3;
    t3 == document && (t3 = document.documentElement), l.__ && l.__(u3, t3), o3 = (r3 = "function" == typeof i3) ? null : i3 && i3.__k || t3.__k, e3 = [], f3 = [], q(t3, u3 = (!r3 && i3 || t3).__k = k(S, null, [u3]), o3 || d, d, t3.namespaceURI, !r3 && i3 ? [i3] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i3 ? i3 : o3 ? o3.__e : t3.firstChild, r3, f3), D(e3, u3, f3);
  }
  n = w.slice, l = { __e: function(n2, l3, u3, t3) {
    for (var i3, r3, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
      if ((r3 = i3.constructor) && null != r3.getDerivedStateFromError && (i3.setState(r3.getDerivedStateFromError(n2)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n2, t3 || {}), o3 = i3.__d), o3) return i3.__E = i3;
    } catch (l4) {
      n2 = l4;
    }
    throw n2;
  } }, u = 0, t = function(n2) {
    return null != n2 && void 0 === n2.constructor;
  }, C.prototype.setState = function(n2, l3) {
    var u3;
    u3 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n2 && (n2 = n2(m({}, u3), this.props)), n2 && m(u3, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), A(this));
  }, C.prototype.forceUpdate = function(n2) {
    this.__v && (this.__e = true, n2 && this.__h.push(n2), A(this));
  }, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
    return n2.__v.__b - l3.__v.__b;
  }, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, s = "__a" + f, a = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

  // node_modules/preact/hooks/dist/hooks.module.js
  var t2;
  var r2;
  var u2;
  var i2;
  var o2 = 0;
  var f2 = [];
  var c2 = l;
  var e2 = c2.__b;
  var a2 = c2.__r;
  var v2 = c2.diffed;
  var l2 = c2.__c;
  var m2 = c2.unmount;
  var s2 = c2.__;
  function p2(n2, t3) {
    c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
    var u3 = r2.__H || (r2.__H = { __: [], __h: [] });
    return n2 >= u3.__.length && u3.__.push({}), u3.__[n2];
  }
  function y2(n2, u3) {
    var i3 = p2(t2++, 3);
    !c2.__s && C2(i3.__H, u3) && (i3.__ = n2, i3.u = u3, r2.__H.__h.push(i3));
  }
  function A2(n2) {
    return o2 = 5, T2(function() {
      return { current: n2 };
    }, []);
  }
  function T2(n2, r3) {
    var u3 = p2(t2++, 7);
    return C2(u3.__H, r3) && (u3.__ = n2(), u3.__H = r3, u3.__h = n2), u3.__;
  }
  function j2() {
    for (var n2; n2 = f2.shift(); ) {
      var t3 = n2.__H;
      if (n2.__P && t3) try {
        t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
      } catch (r3) {
        t3.__h = [], c2.__e(r3, n2.__v);
      }
    }
  }
  c2.__b = function(n2) {
    r2 = null, e2 && e2(n2);
  }, c2.__ = function(n2, t3) {
    n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
  }, c2.__r = function(n2) {
    a2 && a2(n2), t2 = 0;
    var i3 = (r2 = n2.__c).__H;
    i3 && (u2 === r2 ? (i3.__h = [], r2.__h = [], i3.__.some(function(n3) {
      n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
    })) : (i3.__h.some(z2), i3.__h.some(B2), i3.__h = [], t2 = 0)), u2 = r2;
  }, c2.diffed = function(n2) {
    v2 && v2(n2);
    var t3 = n2.__c;
    t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
      n3.u && (n3.__H = n3.u), n3.u = void 0;
    })), u2 = r2 = null;
  }, c2.__c = function(n2, t3) {
    t3.some(function(n3) {
      try {
        n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
          return !n4.__ || B2(n4);
        });
      } catch (r3) {
        t3.some(function(n4) {
          n4.__h && (n4.__h = []);
        }), t3 = [], c2.__e(r3, n3.__v);
      }
    }), l2 && l2(n2, t3);
  }, c2.unmount = function(n2) {
    m2 && m2(n2);
    var t3, r3 = n2.__c;
    r3 && r3.__H && (r3.__H.__.some(function(n3) {
      try {
        z2(n3);
      } catch (n4) {
        t3 = n4;
      }
    }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
  };
  var k2 = "function" == typeof requestAnimationFrame;
  function w2(n2) {
    var t3, r3 = function() {
      clearTimeout(u3), k2 && cancelAnimationFrame(t3), setTimeout(n2);
    }, u3 = setTimeout(r3, 35);
    k2 && (t3 = requestAnimationFrame(r3));
  }
  function z2(n2) {
    var t3 = r2, u3 = n2.__c;
    "function" == typeof u3 && (n2.__c = void 0, u3()), r2 = t3;
  }
  function B2(n2) {
    var t3 = r2;
    n2.__c = n2.__(), r2 = t3;
  }
  function C2(n2, t3) {
    return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
      return t4 !== n2[r3];
    });
  }

  // src/sentence-mode-ui.jsx
  function DifficultyButton({ option, selected, onSelect }) {
    return /* @__PURE__ */ k(
      "button",
      {
        type: "button",
        className: `sentence-mode-chip${selected ? " is-selected" : ""}`,
        "aria-pressed": selected ? "true" : "false",
        onClick: () => onSelect(option.id)
      },
      option.label
    );
  }
  function AnswerOption({ option, onSelect }) {
    const classes = ["sentence-mode-option"];
    if (option.highlighted) classes.push("is-highlighted");
    if (option.correct) classes.push("is-correct");
    if (option.incorrect) classes.push("is-incorrect");
    return /* @__PURE__ */ k(
      "button",
      {
        type: "button",
        className: classes.join(" "),
        disabled: option.disabled,
        "aria-pressed": option.selected ? "true" : "false",
        onClick: () => onSelect(option.value)
      },
      option.value
    );
  }
  function FeedbackBanner({ feedback, locked, onContinue }) {
    if (!feedback) return null;
    return /* @__PURE__ */ k("div", { className: `sentence-mode-feedback is-${feedback.type}` }, /* @__PURE__ */ k("div", { className: "sentence-mode-feedback-title" }, feedback.title), /* @__PURE__ */ k("div", { className: "sentence-mode-feedback-message" }, feedback.message), feedback.detail ? /* @__PURE__ */ k("div", { className: "sentence-mode-feedback-detail" }, feedback.detail) : null, locked && feedback.type === "correct" ? /* @__PURE__ */ k("button", { type: "button", className: "sentence-mode-continue", onClick: onContinue }, "Continue") : null);
  }
  function SentenceModeView({
    title,
    subtitle,
    sentence,
    sentenceHtml,
    prompt,
    helperText,
    difficultyLabel,
    difficultyDescription,
    difficultyOptions,
    activeDifficulty,
    inputValue,
    options,
    feedback,
    locked,
    onSelectDifficulty,
    onInputChange,
    onSubmit,
    onSelectOption,
    onContinue,
    onReplay
  }) {
    const inputRef = A2(null);
    y2(() => {
      if (!locked && inputRef.current) {
        const input = inputRef.current;
        const scrollContainer = input.closest(".quiz-display");
        try {
          input.focus({ preventScroll: true });
        } catch (error) {
          input.focus();
        }
        const value = input.value || "";
        if (typeof input.setSelectionRange === "function") {
          input.setSelectionRange(value.length, value.length);
        }
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }
    }, [sentence, locked, inputValue]);
    return /* @__PURE__ */ k("div", { className: "sentence-mode-shell" }, /* @__PURE__ */ k("div", { className: "sentence-mode-header" }, /* @__PURE__ */ k("div", { className: "sentence-mode-kicker" }, title), difficultyOptions.length > 1 ? /* @__PURE__ */ k(S, null, /* @__PURE__ */ k("div", { className: "sentence-mode-toolbar-label" }, difficultyLabel), /* @__PURE__ */ k("div", { className: "sentence-mode-toolbar" }, difficultyOptions.map((option) => /* @__PURE__ */ k(
      DifficultyButton,
      {
        key: option.id,
        option,
        selected: option.id === activeDifficulty,
        onSelect: onSelectDifficulty
      }
    ))), difficultyDescription ? /* @__PURE__ */ k("div", { className: "sentence-mode-description" }, difficultyDescription) : null) : null), /* @__PURE__ */ k("div", { className: "sentence-mode-card sentence-mode-card--sentence" }, /* @__PURE__ */ k("div", { className: "sentence-mode-sentence-header" }, /* @__PURE__ */ k("div", { className: "sentence-mode-subtitle" }, subtitle), /* @__PURE__ */ k(
      "button",
      {
        type: "button",
        className: "sentence-mode-replay",
        onClick: onReplay
      },
      "\u{1F50A} Replay ",
      /* @__PURE__ */ k("span", { className: "sentence-mode-replay-shortcut" }, "Space")
    )), /* @__PURE__ */ k(
      "div",
      {
        className: "sentence-mode-sentence",
        dangerouslySetInnerHTML: { __html: sentenceHtml || sentence || "" }
      }
    )), /* @__PURE__ */ k("div", { className: "sentence-mode-card sentence-mode-card--prompt" }, /* @__PURE__ */ k("div", { className: "sentence-mode-prompt" }, "\u{1F449} ", prompt), /* @__PURE__ */ k("div", { className: "sentence-mode-helper" }, helperText)), /* @__PURE__ */ k("div", { className: "sentence-mode-card sentence-mode-answer-panel" }, /* @__PURE__ */ k("div", { className: "sentence-mode-answer-label" }, "Answer choices"), /* @__PURE__ */ k("div", { className: "sentence-mode-filter-row" }, /* @__PURE__ */ k(
      "input",
      {
        ref: inputRef,
        type: "text",
        className: "sentence-mode-filter-input",
        value: inputValue,
        disabled: locked,
        placeholder: "Type to filter sentence meanings...",
        onInput: (event) => onInputChange(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === " " && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            onReplay();
          }
        }
      }
    )), /* @__PURE__ */ k("div", { className: "sentence-mode-option-list" }, options.map((option) => /* @__PURE__ */ k(AnswerOption, { key: option.value, option, onSelect: onSelectOption }))), /* @__PURE__ */ k(FeedbackBanner, { feedback, locked, onContinue })));
  }
  function render(container, props) {
    if (!container) return;
    R(/* @__PURE__ */ k(SentenceModeView, { ...props }), container);
  }
  function unmount(container) {
    if (!container) return;
    R(null, container);
  }
  window.JcodeSentenceModeUI = {
    render,
    unmount
  };
})();
