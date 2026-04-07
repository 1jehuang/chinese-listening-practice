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
    var a3, h3, p3, v3, y3, _2, g2, m3 = t3 && t3.__k || w, b2 = l3.length;
    for (f3 = T(u3, l3, m3, f3, b2), a3 = 0; a3 < b2; a3++) null != (p3 = u3.__k[a3]) && (h3 = -1 != p3.__i && m3[p3.__i] || d, p3.__i = a3, _2 = q(n2, p3, h3, i3, r3, o3, e3, f3, c3, s3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), s3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), (g2 = !!(4 & p3.__u)) || h3.__k === p3.__k ? (f3 = j(p3, f3, n2, g2), g2 && h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _2 ? f3 = _2 : v3 && (f3 = v3.nextSibling), p3.__u &= -7);
    return u3.__e = y3, f3;
  }
  function T(n2, l3, u3, t3, i3) {
    var r3, o3, e3, f3, c3, s3 = u3.length, a3 = s3, h3 = 0;
    for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f3 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u3, f3, a3)) && (a3--, (e3 = u3[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > s3 ? h3-- : i3 < s3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f3 && (c3 == f3 - 1 ? h3-- : c3 == f3 + 1 ? h3++ : (c3 > f3 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
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
    var a3, h3, p3, v3, y3, d3, _2, k3, x2, M, $2, I2, P2, A3, H2, T3 = u3.type;
    if (void 0 !== u3.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f3 = u3.__e = t3.__e]), (a3 = l.__b) && a3(u3);
    n: if ("function" == typeof T3) try {
      if (k3 = u3.props, x2 = T3.prototype && T3.prototype.render, M = (a3 = T3.contextType) && i3[a3.__c], $2 = a3 ? M ? M.props.value : a3.__ : i3, t3.__c ? _2 = (h3 = u3.__c = t3.__c).__ = h3.__E : (x2 ? u3.__c = h3 = new T3(k3, $2) : (u3.__c = h3 = new C(k3, $2), h3.constructor = T3, h3.render = Q), M && M.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), x2 && null == h3.__s && (h3.__s = h3.state), x2 && null != T3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = m({}, h3.__s)), m(h3.__s, T3.getDerivedStateFromProps(k3, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = u3, p3) x2 && null == T3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), x2 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
      else {
        if (x2 && null == T3.getDerivedStateFromProps && k3 !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(k3, $2), u3.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(k3, h3.__s, $2)) {
          u3.__v != t3.__v && (h3.props = k3, h3.state = h3.__s, h3.__d = false), u3.__e = t3.__e, u3.__k = t3.__k, u3.__k.some(function(n3) {
            n3 && (n3.__ = u3);
          }), w.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
          break n;
        }
        null != h3.componentWillUpdate && h3.componentWillUpdate(k3, h3.__s, $2), x2 && null != h3.componentDidUpdate && h3.__h.push(function() {
          h3.componentDidUpdate(v3, y3, d3);
        });
      }
      if (h3.context = $2, h3.props = k3, h3.__P = n2, h3.__e = false, I2 = l.__r, P2 = 0, x2) h3.state = h3.__s, h3.__d = false, I2 && I2(u3), a3 = h3.render(h3.props, h3.state, h3.context), w.push.apply(h3.__h, h3._sb), h3._sb = [];
      else do {
        h3.__d = false, I2 && I2(u3), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
      } while (h3.__d && ++P2 < 25);
      h3.state = h3.__s, null != h3.getChildContext && (i3 = m(m({}, i3), h3.getChildContext())), x2 && !p3 && null != h3.getSnapshotBeforeUpdate && (d3 = h3.getSnapshotBeforeUpdate(v3, y3)), A3 = null != a3 && a3.type === S && null == a3.key ? E(a3.props.children) : a3, f3 = L(n2, g(A3) ? A3 : [A3], u3, t3, i3, r3, o3, e3, f3, c3, s3), h3.base = u3.__e, u3.__u &= -161, h3.__h.length && e3.push(h3), _2 && (h3.__E = h3.__ = null);
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
    var a3, h3, p3, v3, y3, w3, _2, m3 = i3.props || d, k3 = t3.props, x2 = t3.type;
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
      for (a3 in k3) y3 = k3[a3], "children" == a3 ? v3 = y3 : "dangerouslySetInnerHTML" == a3 ? h3 = y3 : "value" == a3 ? w3 = y3 : "checked" == a3 ? _2 = y3 : c3 && "function" != typeof y3 || m3[a3] === y3 || N(u3, a3, y3, m3[a3], o3);
      if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u3.innerHTML) || (u3.innerHTML = h3.__html), t3.__k = [];
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
  function d2(n2) {
    return o2 = 1, h2(D2, n2);
  }
  function h2(n2, u3, i3) {
    var o3 = p2(t2++, 2);
    if (o3.t = n2, !o3.__c && (o3.__ = [i3 ? i3(u3) : D2(void 0, u3), function(n3) {
      var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
      t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
    }], o3.__c = r2, !r2.__f)) {
      var f3 = function(n3, t3, r3) {
        if (!o3.__c.__H) return true;
        var u4 = o3.__c.__H.__.filter(function(n4) {
          return n4.__c;
        });
        if (u4.every(function(n4) {
          return !n4.__N;
        })) return !c3 || c3.call(this, n3, t3, r3);
        var i4 = o3.__c.props !== n3;
        return u4.some(function(n4) {
          if (n4.__N) {
            var t4 = n4.__[0];
            n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i4 = true);
          }
        }), c3 && c3.call(this, n3, t3, r3) || i4;
      };
      r2.__f = true;
      var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
      r2.componentWillUpdate = function(n3, t3, r3) {
        if (this.__e) {
          var u4 = c3;
          c3 = void 0, f3(n3, t3, r3), c3 = u4;
        }
        e3 && e3.call(this, n3, t3, r3);
      }, r2.shouldComponentUpdate = f3;
    }
    return o3.__N || o3.__;
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
  function D2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // src/drill-shared.js
  function normalizeShortcut(value, fallback = { code: "KeyA", shift: true, ctrl: false, alt: false, label: "\u21E7+A" }) {
    if (!value) return fallback;
    if (typeof value === "string") {
      const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
      const shortcut = { code: null, key: null, shift: false, ctrl: false, alt: false };
      parts.forEach((part) => {
        const upper = part.toUpperCase();
        if (upper === "SHIFT") shortcut.shift = true;
        else if (upper === "CTRL" || upper === "CONTROL") shortcut.ctrl = true;
        else if (upper === "ALT" || upper === "OPTION") shortcut.alt = true;
        else if (upper.startsWith("KEY")) shortcut.code = part;
        else shortcut.key = part;
      });
      shortcut.code = shortcut.code || (shortcut.key ? `Key${shortcut.key.toUpperCase()}` : fallback.code);
      shortcut.label = shortcutLabel(shortcut);
      return { ...fallback, ...shortcut };
    }
    if (typeof value === "object") {
      const shortcut = {
        code: value.code || (value.key ? `Key${String(value.key).toUpperCase()}` : fallback.code),
        key: value.key || null,
        shift: Boolean(value.shift),
        ctrl: Boolean(value.ctrl),
        alt: Boolean(value.alt)
      };
      shortcut.label = value.label || shortcutLabel(shortcut);
      return { ...fallback, ...shortcut };
    }
    return fallback;
  }
  function shortcutLabel(shortcut) {
    const parts = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("\u21E7");
    const keyPart = shortcut.key ? shortcut.key.toUpperCase() : shortcut.code && shortcut.code.startsWith("Key") ? shortcut.code.slice(3).toUpperCase() : "A";
    parts.push(keyPart);
    return parts.join("+");
  }
  function isReplayShortcut(event, shortcut) {
    if (!shortcut) return false;
    if (shortcut.shift !== void 0 && shortcut.shift !== event.shiftKey) return false;
    if (shortcut.ctrl !== void 0 && shortcut.ctrl !== event.ctrlKey) return false;
    if (shortcut.alt !== void 0 && shortcut.alt !== event.altKey) return false;
    if (shortcut.code) return event.code === shortcut.code;
    if (shortcut.key) return event.key.toLowerCase() === shortcut.key.toLowerCase();
    return false;
  }
  function resolveUrl(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch (error) {
      return path;
    }
  }
  function cloneDataset(data) {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      return (data == null ? void 0 : data.slice) ? data.slice() : data;
    }
  }
  function getEmbeddedDataset(datasetKey) {
    if (!datasetKey) return null;
    const store = window.__CONTEXT_DATASETS__;
    if (!store) return null;
    const data = store[datasetKey];
    if (!Array.isArray(data)) return null;
    return cloneDataset(data);
  }
  function fetchViaXHR(url) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== XMLHttpRequest.DONE) return;
          if (xhr.status === 0 || xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (parseError) {
              reject(parseError);
            }
          } else {
            reject(new Error(`XHR failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("XHR network error"));
        xhr.send();
      } catch (error) {
        reject(error);
      }
    });
  }
  async function loadDataset({ dataUrl, datasetKey }) {
    const isFileProtocol = window.location.protocol === "file:";
    const resolvedUrl = resolveUrl(dataUrl);
    if (isFileProtocol) {
      const embedded = getEmbeddedDataset(datasetKey);
      if (embedded) return embedded;
    }
    try {
      const response = await fetch(resolvedUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load prompts: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (isFileProtocol) {
        try {
          return await fetchViaXHR(resolvedUrl);
        } catch (_2) {
          const embedded = getEmbeddedDataset(datasetKey);
          if (embedded) return embedded;
        }
      }
      throw error;
    }
  }
  function cancelSpeech() {
    if (typeof window.stopActiveAudio === "function") {
      window.stopActiveAudio();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
  function speakSentence(sentence) {
    if (!sentence) return;
    cancelSpeech();
    if (typeof window.playSentenceAudio === "function") {
      window.playSentenceAudio(sentence);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "zh-CN";
    if (typeof window.getQuizTtsRate === "function") {
      utterance.rate = window.getQuizTtsRate();
    }
    window.speechSynthesis.speak(utterance);
  }
  function playFeedbackSound(audioState, type) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioState.context) {
      audioState.context = new AudioCtx();
    }
    const ctx = audioState.context;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
      });
    }
    const startTime = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, startTime);
      osc.frequency.linearRampToValueAtTime(880, startTime + 0.25);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, startTime);
      osc.frequency.linearRampToValueAtTime(160, startTime + 0.2);
    }
    gain.gain.setValueAtTime(1e-4, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(1e-4, startTime + 0.35);
    osc.start(startTime);
    osc.stop(startTime + 0.35);
  }
  function shuffleArray(array) {
    const next = array.slice();
    for (let i3 = next.length - 1; i3 > 0; i3 -= 1) {
      const j3 = Math.floor(Math.random() * (i3 + 1));
      [next[i3], next[j3]] = [next[j3], next[i3]];
    }
    return next;
  }

  // src/context-listening.jsx
  var DEFAULT_CONFIG = {
    dataUrl: "data/context-listening.json",
    autoAdvanceDelay: 2200,
    replayShortcut: { code: "KeyA", shift: true, ctrl: false, alt: false, label: "\u21E7+A" },
    datasetKey: null
  };
  var STOP_WORDS = /* @__PURE__ */ new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "get",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "out",
    "than",
    "that",
    "the",
    "their",
    "then",
    "there",
    "this",
    "to",
    "up",
    "was",
    "were",
    "with",
    "your"
  ]);
  function HighlightedSentence({ sentence, target }) {
    const index = sentence.indexOf(target);
    if (index === -1) {
      return sentence;
    }
    return [
      sentence.slice(0, index),
      /* @__PURE__ */ k("span", { className: "bg-yellow-200 text-gray-900 px-1 rounded" }, sentence.slice(index, index + target.length)),
      sentence.slice(index + target.length)
    ];
  }
  function ChoiceButton({ option, onSelect }) {
    const classes = ["w-full", "text-left", "px-4", "py-3", "border-2", "rounded-lg", "transition", "text-gray-800"];
    if (option.correct && option.revealed) {
      classes.push("border-green-500", "bg-green-50");
    } else if (option.incorrect) {
      classes.push("border-red-500", "bg-red-50", "opacity-70");
    } else if (option.revealed) {
      classes.push("opacity-70");
    } else {
      classes.push("border-gray-200", "hover:border-blue-400", "hover:bg-blue-50");
    }
    return /* @__PURE__ */ k("button", { type: "button", className: classes.join(" "), disabled: option.disabled, onClick: () => onSelect(option.id) }, option.text);
  }
  function App({ config, prompts, currentIndex, answer, meaningVisible, feedback, completed, options, onAnswerChange, onCheck, onChoiceSelect, onToggleMeaning, onPrev, onNext, onRandom, onReplay, replayEnabled }) {
    const inputRef = A2(null);
    const item = prompts[currentIndex] || null;
    y2(() => {
      if (!completed && inputRef.current) {
        inputRef.current.focus();
      }
    }, [currentIndex, completed]);
    const keyboardHint = T2(() => {
      var _a;
      const parts = ["Keyboard: \u2190 previous", "\u2192 next", "Space reveal meaning", "Enter check"];
      if ((_a = config.replayShortcut) == null ? void 0 : _a.label) {
        parts.push(`${config.replayShortcut.label} replay audio`);
      }
      if (config.autoAdvanceDelay <= 0) {
        parts.push("Correct answers auto-advance");
      }
      parts.push("Tap Shift replay audio");
      return parts.join(" \u2022 ");
    }, [config.autoAdvanceDelay, config.replayShortcut]);
    return /* @__PURE__ */ k("div", { className: "bg-gray-100 min-h-screen p-4 md:p-8" }, /* @__PURE__ */ k("a", { href: "home.html", className: "fixed top-4 left-4 bg-white hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow border border-gray-200 transition text-sm" }, "\u2190 Home"), /* @__PURE__ */ k("div", { className: "max-w-4xl mx-auto mt-16 md:mt-0 bg-white rounded-xl shadow-lg p-6 md:p-8" }, /* @__PURE__ */ k("h1", { className: "text-3xl font-bold text-center mb-3 text-gray-800" }, config.autoAdvanceDelay <= 0 ? "Context Listening \xB7 Easy Mode" : "Context Listening Comprehension"), /* @__PURE__ */ k("p", { className: "text-gray-600 text-center mb-6" }, config.autoAdvanceDelay <= 0 ? "Simpler sentences with instant advance: listen as each prompt plays, read along, and confirm the highlighted chunk\u2019s meaning by typing or selecting a choice." : "Each sentence auto-plays as you advance. Listen, read along, and capture the highlighted chunk's meaning by typing it or choosing the closest option."), /* @__PURE__ */ k("div", { className: "bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8" }, /* @__PURE__ */ k("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4" }, /* @__PURE__ */ k("span", { className: "text-sm uppercase tracking-widest text-gray-400" }, item ? `${currentIndex + 1} / ${prompts.length}` : "Loading\u2026"), /* @__PURE__ */ k(
      "button",
      {
        type: "button",
        className: `bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2 rounded-lg transition${replayEnabled ? "" : " opacity-60 cursor-not-allowed"}`,
        onClick: onReplay,
        disabled: !replayEnabled
      },
      "\u{1F501} Replay audio"
    )), !replayEnabled ? /* @__PURE__ */ k("div", { className: "text-sm text-yellow-600 mb-4 text-center" }, "Your browser does not support speech synthesis; rely on the on-screen sentence.") : null, /* @__PURE__ */ k("div", { className: "text-2xl leading-relaxed text-center text-gray-900 mb-6" }, item ? /* @__PURE__ */ k(HighlightedSentence, { sentence: item.sentence, target: item.target }) : "Loading prompts\u2026"), /* @__PURE__ */ k("div", { className: "flex flex-col items-center gap-4 mb-6" }, /* @__PURE__ */ k("div", { className: "text-center text-lg text-gray-700" }, "\u{1F449} \u5728\u8FD9\u53E5\u91CC\uFF0C\u300C", /* @__PURE__ */ k("span", { className: "font-semibold text-gray-900" }, (item == null ? void 0 : item.target) || "\u2014"), "\u300D\u662F\u4EC0\u4E48\u610F\u601D\uFF1F")), /* @__PURE__ */ k("div", { className: "space-y-3 mb-6" }, /* @__PURE__ */ k("label", { htmlFor: "answerInput", className: "block text-sm font-medium text-gray-600" }, "Type what the highlighted chunk means (optional):"), /* @__PURE__ */ k(
      "input",
      {
        id: "answerInput",
        ref: inputRef,
        type: "text",
        className: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg",
        placeholder: "Type your understanding of the highlighted chunk...",
        value: answer,
        disabled: !item || completed,
        onInput: (event) => onAnswerChange(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCheck();
          }
        }
      }
    ), /* @__PURE__ */ k("button", { type: "button", className: "w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition", onClick: onCheck, disabled: !item || completed }, "Check answer")), /* @__PURE__ */ k("div", { className: "mb-2" }, /* @__PURE__ */ k("div", { className: "text-sm font-medium text-gray-600 mb-2" }, "Or pick the closest meaning:"), /* @__PURE__ */ k("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" }, options.map((option) => /* @__PURE__ */ k(ChoiceButton, { key: option.id, option, onSelect: onChoiceSelect })))), /* @__PURE__ */ k("div", { className: `mt-4 text-center text-lg font-semibold ${(feedback == null ? void 0 : feedback.status) === true ? "text-green-600" : (feedback == null ? void 0 : feedback.status) === false ? "text-red-600" : "text-gray-600"}` }, (feedback == null ? void 0 : feedback.message) || ""), /* @__PURE__ */ k("div", { className: "flex flex-col items-center gap-3 mt-6" }, /* @__PURE__ */ k("button", { type: "button", className: "w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition", onClick: onToggleMeaning, "aria-expanded": meaningVisible ? "true" : "false" }, meaningVisible ? "Hide meaning" : "Show meaning"), meaningVisible ? /* @__PURE__ */ k("div", { className: "w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-left" }, /* @__PURE__ */ k("div", { className: "text-xs uppercase tracking-widest text-blue-500 mb-1" }, "Meaning in context"), /* @__PURE__ */ k("p", { className: "text-lg text-blue-900 leading-relaxed" }, (item == null ? void 0 : item.meaning) || "")) : null)), /* @__PURE__ */ k("div", { className: "flex flex-wrap justify-center gap-3 mt-6" }, /* @__PURE__ */ k("button", { type: "button", className: "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition", onClick: onPrev }, "Previous"), /* @__PURE__ */ k("button", { type: "button", className: "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition", onClick: onNext }, "Next"), /* @__PURE__ */ k("button", { type: "button", className: "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition", onClick: onRandom }, "Random")), /* @__PURE__ */ k("div", { className: "text-center text-sm text-gray-500 mt-6" }, keyboardHint)));
  }
  function normalizeConfig(overrides) {
    const merged = { ...DEFAULT_CONFIG, ...overrides };
    merged.autoAdvanceDelay = typeof merged.autoAdvanceDelay === "number" ? merged.autoAdvanceDelay : DEFAULT_CONFIG.autoAdvanceDelay;
    merged.replayShortcut = normalizeShortcut(overrides.replayShortcut || DEFAULT_CONFIG.replayShortcut);
    merged.datasetKey = overrides.datasetKey || DEFAULT_CONFIG.datasetKey;
    return merged;
  }
  function normalizeAnswer(text) {
    return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function getCandidateAnswers(item) {
    const answers = /* @__PURE__ */ new Set();
    answers.add(item.meaning);
    const noParens = item.meaning.replace(/\s*\([^)]*\)/g, "").trim();
    if (noParens) answers.add(noParens);
    item.meaning.split(/[;,]/).forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) answers.add(trimmed);
    });
    if (Array.isArray(item.acceptedAnswers)) {
      item.acceptedAnswers.forEach((answer) => {
        const trimmed = String(answer || "").trim();
        if (trimmed) answers.add(trimmed);
      });
    }
    return Array.from(answers);
  }
  function tokenizeMeaning(text) {
    const result = /* @__PURE__ */ new Set();
    text.split(" ").forEach((word) => {
      if (word.length <= 2) return;
      if (STOP_WORDS.has(word)) return;
      result.add(word);
    });
    return result;
  }
  function wordOverlap(a3, b2) {
    const wordsA = tokenizeMeaning(a3);
    const wordsB = tokenizeMeaning(b2);
    if (!wordsA.size || !wordsB.size) return 0;
    let matches = 0;
    wordsA.forEach((word) => {
      if (wordsB.has(word)) matches += 1;
    });
    return matches / Math.max(wordsA.size, wordsB.size);
  }
  function levenshtein(a3, b2) {
    const matrix = Array.from({ length: a3.length + 1 }, (_2, i3) => {
      const row = new Array(b2.length + 1);
      row[0] = i3;
      return row;
    });
    for (let j3 = 0; j3 <= b2.length; j3 += 1) {
      matrix[0][j3] = j3;
    }
    for (let i3 = 1; i3 <= a3.length; i3 += 1) {
      for (let j3 = 1; j3 <= b2.length; j3 += 1) {
        if (a3[i3 - 1] === b2[j3 - 1]) {
          matrix[i3][j3] = matrix[i3 - 1][j3 - 1];
        } else {
          matrix[i3][j3] = Math.min(matrix[i3 - 1][j3] + 1, matrix[i3][j3 - 1] + 1, matrix[i3 - 1][j3 - 1] + 1);
        }
      }
    }
    return matrix[a3.length][b2.length];
  }
  function stringSimilarity(a3, b2) {
    const maxLen = Math.max(a3.length, b2.length);
    if (!maxLen) return 1;
    return 1 - levenshtein(a3, b2) / maxLen;
  }
  function isFuzzyMatch(input, item) {
    const normalizedInput = normalizeAnswer(input);
    if (!normalizedInput) return false;
    return getCandidateAnswers(item).some((candidate) => {
      const normalizedCandidate = normalizeAnswer(candidate);
      if (!normalizedCandidate) return false;
      if (normalizedCandidate === normalizedInput) return true;
      if (normalizedCandidate.includes(normalizedInput) && normalizedInput.length >= Math.min(5, normalizedCandidate.length)) return true;
      if (normalizedInput.includes(normalizedCandidate) && normalizedCandidate.length >= 5) return true;
      if (stringSimilarity(normalizedInput, normalizedCandidate) >= 0.72) return true;
      return wordOverlap(normalizedInput, normalizedCandidate) >= 0.6;
    });
  }
  function buildChoiceOptions(prompts, index) {
    const correctMeaning = prompts[index].meaning;
    const pool = prompts.map((item) => item.meaning).filter((meaning, currentIndex) => currentIndex !== index);
    const distractors = shuffleArray(pool).slice(0, Math.min(3, pool.length));
    return shuffleArray([
      { text: correctMeaning, correct: true },
      ...distractors.map((text) => ({ text, correct: false }))
    ]).map((option, optionIndex) => ({ ...option, id: `${optionIndex}:${option.text}` }));
  }
  function ContextListeningApp() {
    const [config] = d2(() => {
      const rawConfig = window.CONTEXT_DRILL_CONFIG || {};
      delete window.CONTEXT_DRILL_CONFIG;
      return normalizeConfig(rawConfig);
    });
    const [prompts, setPrompts] = d2([]);
    const [currentIndex, setCurrentIndex] = d2(0);
    const [answer, setAnswer] = d2("");
    const [meaningVisible, setMeaningVisible] = d2(false);
    const [feedback, setFeedback] = d2({ status: null, message: "" });
    const [completed, setCompleted] = d2(false);
    const [choiceOptions, setChoiceOptions] = d2([]);
    const [replayEnabled, setReplayEnabled] = d2("speechSynthesis" in window || typeof window.playSentenceAudio === "function");
    const audioStateRef = A2({ context: null });
    const pendingShiftReplayRef = A2(false);
    const advanceTimeoutRef = A2(null);
    const currentItem = prompts[currentIndex] || null;
    y2(() => {
      if (typeof window.initCommandPalette === "function") {
        window.initCommandPalette();
      }
    }, []);
    y2(() => {
      let cancelled = false;
      loadDataset(config).then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error("Invalid prompt format (expected array).");
        const nextPrompts = data.filter((item) => item && item.sentence && item.target && item.meaning);
        if (!nextPrompts.length) throw new Error("No prompts found in data file.");
        setPrompts(nextPrompts);
        setCurrentIndex(0);
      }).catch((error) => {
        console.error(error);
        const extra = window.location.protocol === "file:" ? " Tip: when opening these files directly from disk, the browser blocks loading JSON. Run a simple local server (e.g., python -m http.server) and open the page via http://localhost to unlock the dataset." : "";
        setFeedback({ status: false, message: "Failed to load prompt data." + extra });
        setReplayEnabled(false);
      });
      return () => {
        cancelled = true;
        cancelSpeech();
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
      };
    }, [config]);
    y2(() => {
      if (!currentItem) return void 0;
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
      setAnswer("");
      setMeaningVisible(false);
      setFeedback({ status: null, message: "" });
      setCompleted(false);
      setChoiceOptions(buildChoiceOptions(prompts, currentIndex));
      speakSentence(currentItem.sentence);
      return () => cancelSpeech();
    }, [currentItem == null ? void 0 : currentItem.sentence, prompts, currentIndex]);
    y2(() => {
      const onKeyDown = (event) => {
        const targetTag = event.target && event.target.tagName;
        const isInputTarget = targetTag === "INPUT" || targetTag === "TEXTAREA";
        if (event.key === "Shift") {
          pendingShiftReplayRef.current = true;
          return;
        }
        if (isReplayShortcut(event, config.replayShortcut)) {
          event.preventDefault();
          pendingShiftReplayRef.current = false;
          if (currentItem) speakSentence(currentItem.sentence);
          return;
        }
        if (pendingShiftReplayRef.current) {
          pendingShiftReplayRef.current = false;
        }
        if (isInputTarget) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setCurrentIndex((index) => prompts.length ? (index + 1) % prompts.length : index);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          setCurrentIndex((index) => prompts.length ? (index - 1 + prompts.length) % prompts.length : index);
        } else if (event.key === " ") {
          event.preventDefault();
          setMeaningVisible((value) => !value);
        }
      };
      const onKeyUp = (event) => {
        if (event.key === "Shift") {
          if (pendingShiftReplayRef.current && currentItem) {
            speakSentence(currentItem.sentence);
          }
          pendingShiftReplayRef.current = false;
        }
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("keyup", onKeyUp);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
      };
    }, [config.replayShortcut, currentItem, prompts.length]);
    const advance = () => {
      setCurrentIndex((index) => prompts.length ? (index + 1) % prompts.length : index);
    };
    const handleCorrectAnswer = (message) => {
      setFeedback({ status: true, message });
      setMeaningVisible(true);
      setCompleted(true);
      setChoiceOptions((options) => options.map((option) => ({ ...option, disabled: true, revealed: true })));
      playFeedbackSound(audioStateRef.current, "success");
      if (prompts.length > 1) {
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        if (config.autoAdvanceDelay <= 0) {
          advance();
        } else {
          advanceTimeoutRef.current = setTimeout(advance, config.autoAdvanceDelay);
        }
      }
    };
    const handleTypeCheck = () => {
      if (completed || !currentItem) return;
      const input = answer.trim();
      if (!input) {
        setFeedback({ status: false, message: "Enter what you think it means before checking." });
        playFeedbackSound(audioStateRef.current, "error");
        return;
      }
      if (isFuzzyMatch(input, currentItem)) {
        handleCorrectAnswer("Looks good! Your phrasing captures the meaning.");
      } else {
        setFeedback({ status: false, message: "Close? Compare with the reveal, tweak your wording, or listen again." });
        playFeedbackSound(audioStateRef.current, "error");
      }
    };
    const handleChoiceSelect = (optionId) => {
      if (completed) return;
      const selected = choiceOptions.find((option) => option.id === optionId);
      if (!selected) return;
      if (selected.correct) {
        handleCorrectAnswer("Correct! Nice work.");
        return;
      }
      setChoiceOptions((options) => options.map((option) => option.id === optionId ? { ...option, disabled: true, incorrect: true } : option));
      setFeedback({ status: false, message: "Not quite. Try again or type your own meaning." });
      playFeedbackSound(audioStateRef.current, "error");
    };
    return /* @__PURE__ */ k(
      App,
      {
        config,
        prompts,
        currentIndex,
        answer,
        meaningVisible,
        feedback,
        completed,
        options: choiceOptions,
        replayEnabled,
        onAnswerChange: setAnswer,
        onCheck: handleTypeCheck,
        onChoiceSelect: handleChoiceSelect,
        onToggleMeaning: () => setMeaningVisible((value) => !value),
        onPrev: () => setCurrentIndex((index) => prompts.length ? (index - 1 + prompts.length) % prompts.length : index),
        onNext: () => setCurrentIndex((index) => prompts.length ? (index + 1) % prompts.length : index),
        onRandom: () => {
          if (prompts.length <= 1) return;
          let next = currentIndex;
          while (next === currentIndex) {
            next = Math.floor(Math.random() * prompts.length);
          }
          setCurrentIndex(next);
        },
        onReplay: () => currentItem && speakSentence(currentItem.sentence)
      }
    );
  }
  var root = document.getElementById("contextDrillApp");
  if (root) {
    R(/* @__PURE__ */ k(ContextListeningApp, null), root);
  }
})();
