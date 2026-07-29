#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../kcd_sdk/dist/core/html/HtmlTree.js
var require_HtmlTree = __commonJS({
  "../kcd_sdk/dist/core/html/HtmlTree.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.HtmlTree = void 0;
    exports2.HtmlTree = new class HtmlTree {
      VOID = /* @__PURE__ */ new Set(["meta", "link", "input", "br", "hr", "img", "source", "col", "area", "base", "wbr"]);
      RAW = /* @__PURE__ */ new Set(["script", "style"]);
      // ── Construction ───────────────────────────────────────────────────────────
      /** Parse an HTML string into a normalized node tree. Returns the synthetic `#document` root. */
      parse(html) {
        const root = { type: "el", tag: "#document", attrs: {}, kids: [] };
        const stack = [root];
        const top = () => stack[stack.length - 1];
        let i = 0;
        while (i < html.length) {
          if (html[i] !== "<") {
            const next = html.indexOf("<", i);
            const end = next < 0 ? html.length : next;
            const text = html.slice(i, end);
            const value = text.trim() !== "" ? this.decode(text) : text === "" ? "" : " ";
            if (value)
              top().kids.push({ type: "text", value });
            i = end;
            continue;
          }
          if (html.startsWith("<!--", i)) {
            const e2 = html.indexOf("-->", i + 4);
            i = e2 < 0 ? html.length : e2 + 3;
            continue;
          }
          if (html[i + 1] === "!") {
            const e2 = html.indexOf(">", i);
            i = e2 < 0 ? html.length : e2 + 1;
            continue;
          }
          if (html[i + 1] === "/") {
            const e2 = html.indexOf(">", i);
            const name = html.slice(i + 2, e2 < 0 ? html.length : e2).trim().toLowerCase();
            const closeEnd = e2 < 0 ? html.length : e2 + 1;
            for (let s = stack.length - 1; s > 0; s--)
              if (stack[s].tag === name) {
                for (let k = s; k < stack.length; k++)
                  stack[k].end = closeEnd;
                stack.length = s;
                break;
              }
            i = closeEnd;
            continue;
          }
          const tagStart = i;
          const e = this.tagEnd(html, i);
          const inner = html.slice(i + 1, e).trim();
          const selfClose = inner.endsWith("/");
          const { tag, attrs } = this.parseTag(selfClose ? inner.slice(0, -1) : inner);
          const el = { type: "el", tag, attrs, kids: [], start: tagStart, end: e + 1 };
          top().kids.push(el);
          i = e + 1;
          if (selfClose || this.VOID.has(tag))
            continue;
          if (this.RAW.has(tag)) {
            const close = html.toLowerCase().indexOf("</" + tag, i);
            const end = close < 0 ? html.length : close;
            if (html.slice(i, end) !== "")
              el.kids.push({ type: "text", value: html.slice(i, end) });
            const gt = html.indexOf(">", end);
            el.end = gt < 0 ? html.length : gt + 1;
            i = gt < 0 ? html.length : gt + 1;
            continue;
          }
          stack.push(el);
        }
        return root;
      }
      /** Wrap a real DOM element/Document into the same normalized node tree. */
      fromDOM(dom) {
        const conv = (n) => {
          if (n.nodeType === 3)
            return { type: "text", value: n.nodeValue };
          if (n.nodeType !== 1)
            return null;
          const attrs = {};
          for (const at of n.attributes)
            attrs[at.name.toLowerCase()] = at.value;
          const el = { type: "el", tag: n.tagName.toLowerCase(), attrs, kids: [] };
          for (const c of n.childNodes) {
            const k = conv(c);
            if (k)
              el.kids.push(k);
          }
          return el;
        };
        const root = { type: "el", tag: "#document", attrs: {}, kids: [] };
        const node = dom.documentElement ? dom.documentElement : dom;
        const top = conv(node);
        if (top)
          root.kids.push(top);
        return root;
      }
      // ── Navigation ( the shared traversal surface ) ──────────────────────────────
      isEl(n) {
        return !!n && n.type === "el";
      }
      has(el, attr) {
        return this.isEl(el) && attr in el.attrs;
      }
      get(el, attr) {
        return this.isEl(el) ? el.attrs[attr] : void 0;
      }
      /** Concatenated text of the whole subtree, descendants included. */
      textOf(el) {
        if (!this.isEl(el))
          return el.value;
        let out = "";
        for (const k of el.kids)
          out += k.type === "text" ? k.value : this.textOf(k);
        return out;
      }
      /** Depth-first walk over element descendants ( text nodes skipped ). */
      walk(el, fn) {
        for (const k of el.kids)
          if (this.isEl(k)) {
            fn(k);
            this.walk(k, fn);
          }
      }
      /** Self + every element descendant matching `pred`, in document order. */
      collect(el, pred) {
        const out = [];
        if (this.isEl(el) && pred(el))
          out.push(el);
        if (this.isEl(el))
          this.walk(el, (d) => {
            if (pred(d))
              out.push(d);
          });
        return out;
      }
      /** First match of `pred` in the subtree, or null. */
      first(el, pred) {
        return this.collect(el, pred)[0] ?? null;
      }
      /**
       * Re-serialize an element's children back to an HTML string — the section-body payload.
       * NORMALIZED, not byte-original: the source's incidental whitespace/quote style is not preserved.
       * That is fine by ruling — the section body is the substrate-coupled half of the seam, free to
       * change; parity is asserted on section NAMES / links / policy, never on body bytes.
       */
      innerHtml(el) {
        let out = "";
        for (const k of el.kids)
          out += this.serialize(k);
        return out.trim();
      }
      serialize(n) {
        if (n.type === "text")
          return this.escapeText(n.value);
        const attrs = Object.entries(n.attrs).map(([k, v]) => v === "" ? ` ${k}` : ` ${k}="${this.escapeAttr(v)}"`).join("");
        if (this.VOID.has(n.tag))
          return `<${n.tag}${attrs}>`;
        const kids = n.kids.map((k) => this.serialize(k)).join("");
        return `<${n.tag}${attrs}>${kids}</${n.tag}>`;
      }
      // ── Lexer internals ──────────────────────────────────────────────────────────
      tagEnd(html, i) {
        let q = null;
        for (let j = i + 1; j < html.length; j++) {
          const c = html[j];
          if (q) {
            if (c === q)
              q = null;
            continue;
          }
          if (c === '"' || c === "'")
            q = c;
          else if (c === ">")
            return j;
        }
        return html.length;
      }
      parseTag(inner) {
        const m = inner.match(/^([a-zA-Z0-9:_-]+)/);
        const tag = m ? m[1].toLowerCase() : "";
        const attrs = {};
        const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|(\S+)))?/g;
        let a, first = true;
        while ((a = re.exec(inner)) !== null) {
          if (first) {
            first = false;
            continue;
          }
          const raw = a[3] !== void 0 ? a[3] : a[4] !== void 0 ? a[4] : a[5];
          attrs[a[1].toLowerCase()] = raw === void 0 ? "" : this.decode(raw);
        }
        return { tag, attrs };
      }
      decode(s) {
        return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
      }
      escapeText(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      escapeAttr(s) {
        return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/KcdAddress.js
var require_KcdAddress = __commonJS({
  "../kcd_sdk/dist/core/html/KcdAddress.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdAddress = void 0;
    var HtmlTree_1 = require_HtmlTree();
    exports2.KcdAddress = new class KcdAddress {
      // ── The closed sets ( protocol §2, §4 ) ──────────────────────────────────────
      TYPES = ["lens", "plan", "reference", "note", "how-to", "framework", "template", "nav-index", "habit", "contract", "generator", "analyzer", "audit"];
      STATUSES = ["draft", "active", "observation", "composed", "disabled", "deployed", "complete", "retired", "paused"];
      AUDIENCES = ["human", "agent", "both"];
      MERGES = ["additive", "declarative", "union"];
      REGIONS = ["know", "care", "do"];
      /** The closed Care-region section vocabulary. `core-mental-model` and `philosophy-prerogatives`
       *  were retired 2026-07-12 — Care is Purpose + Philosophy ( + Open Questions ). */
      CARE_SECTIONS = ["purpose", "philosophy", "open-questions"];
      SLOT_FIELDS = ["what", "where", "why"];
      PARAM_FIELDS = ["name", "type", "default", "description"];
      /** The one idiom every routable artifact ( reference, habit, contract, plan, anything else a
       *  slot can point at ) shares — same three states MCP tool exposure already uses. Absent on a
       *  slot ⇒ 'on', the default. See PolicyEntry / SlotMode in primitives/types.ts. */
      MODES = ["off", "on", "suggested"];
      /** The closed slot-KIND vocabulary ( protocol §3 — `data-kcd-slot="<kind>"` ). Dredge roles
       *  ( reference / habit / contract / tool / rule ) plus the non-dredge kinds ( `link` = a nav row
       *  carrying an href, `table-data` = a plain faux-table row ); `domains` folds into `reference`.
       *  Every slot MUST name one — a bare `data-kcd-slot` is invalid ( KcdValidate: `unkinded-slot` ). */
      SLOT_KINDS = ["reference", "habit", "contract", "tool", "rule", "link", "table-data"];
      KNOWN_ATTRS = [
        "data-kcd",
        "data-kcd-frontmatter",
        "data-kcd-field",
        "data-kcd-type",
        "data-kcd-region",
        "data-kcd-section",
        "data-kcd-heading",
        "data-kcd-merge",
        "data-kcd-merge-key",
        "data-kcd-slot",
        "data-kcd-param",
        "data-kcd-params",
        "data-kcd-mode",
        "data-kcd-habit-class",
        "data-kcd-table",
        "data-kcd-head",
        "data-kcd-chips",
        "data-kcd-tag",
        "data-kcd-audience",
        "data-kcd-chrome",
        "data-kcd-live",
        "data-kcd-script",
        "data-kcd-address"
      ];
      // ── Patterns ──────────────────────────────────────────────────────────────────
      // slug: kebab, optional single leading `_` sort-prefix ( `_lens-base` ); internal `_` is illegal.
      SLUG_RE = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;
      DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
      URL_RE = /^(?:https?:)?\/\/\S+$/;
      // ── Field-type validators ( the SettingField-shared vocabulary, protocol §1.6 ) ──
      FIELD = {
        text: () => true,
        slug: (v) => v === "" || this.SLUG_RE.test(v),
        enum: (v) => v !== "" && !/\s/.test(v),
        number: (v) => this.NUMBER_RE.test(v),
        date: (v) => this.DATE_RE.test(v),
        path: (v) => v !== "",
        url: (v) => this.URL_RE.test(v),
        list: () => true,
        // address ( protocol §1.1 ): a LOCATION, not an assertion that anything occupies it. Checked for
        // well-formedness only — occupancy is never validated, because vacancy is a legal state.
        address: (v) => v === "" || this.isAddressValue(v)
      };
      isFieldType(declared) {
        return !!declared && declared in this.FIELD;
      }
      validates(declared, value) {
        const f = this.FIELD[declared];
        return !!f && f(value);
      }
      // ── Addresses ( protocol §1.1 ) ────────────────────────────────────────────────
      // An address is a location that MAY be occupied. Two value shapes, told apart by their own form:
      // an artifact NAME ( a slug — resolved through the same name index `base`/`lens` use, so it
      // survives any move ), or a project-root-relative PATH ( for targets that have no name ).
      // Well-formed means: no whitespace, not absolute, and no `../` chain — a `../` escapes the project
      // root, which is the one thing that can never resolve ( see `resolveHref` ).
      /** A `../` segment anywhere in the value — the shape that cannot resolve from the project root. */
      DOTDOT_RE = /(?:^|\/)\.\.(?:\/|$)/;
      isAddressValue(v) {
        if (v === "" || /\s/.test(v))
          return false;
        if (this.SLUG_RE.test(v))
          return true;
        if (v.startsWith("/") || /^[A-Za-z]:/.test(v))
          return false;
        if (this.DOTDOT_RE.test(v))
          return false;
        return true;
      }
      isAddress(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-address");
      }
      /**
       * An address element's value. The visible TEXT is the address by default ( the core law's
       * one-element-two-duties rule, with no machine copy ); the attribute carries it only when the
       * prose has to read differently — the same escape hatch `href` already provides.
       */
      addressOf(el) {
        const attr = HtmlTree_1.HtmlTree.get(el, "data-kcd-address");
        return (attr !== void 0 && attr !== "" ? attr : HtmlTree_1.HtmlTree.textOf(el)).trim();
      }
      // ── Component predicates ( protocol §2 ) ───────────────────────────────────────
      isArticle(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd");
      }
      isFrontmatter(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-frontmatter");
      }
      isRegion(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-region");
      }
      isSection(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-section");
      }
      isSlot(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-slot");
      }
      isParam(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-param");
      }
      isField(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-field");
      }
      isTag(el) {
        return HtmlTree_1.HtmlTree.has(el, "data-kcd-tag");
      }
      /** This element's audience, default `both` ( protocol §5 — the dual-extraction strip control ). */
      audienceOf(el) {
        return HtmlTree_1.HtmlTree.get(el, "data-kcd-audience") ?? "both";
      }
      isHumanOnly(el) {
        return this.audienceOf(el) === "human";
      }
      /**
       * A section's CROSS-ARTIFACT fusion key ( context-optimization plan, Phase 2 ) — deliberately a
       * SEPARATE attribute from `data-kcd-merge`. That attribute is already load-bearing today as the
       * intra-file duplicate-section-name dedup STRATEGY ( protocol §3, `additive|declarative|union` —
       * ~35 files already write `data-kcd-merge="union"` on an unrelated `references` section each ).
       * Reusing its value as a merge KEY would silently fuse every one of those unrelated sections
       * together the moment two such artifacts loaded in the same context. `data-kcd-merge-key` is the
       * new, orthogonal slot the plan actually needs; `data-kcd-merge` is untouched.
       */
      mergeKeyOf(el) {
        return HtmlTree_1.HtmlTree.get(el, "data-kcd-merge-key");
      }
      // ── Value extraction ( the core law §1.1–§1.2: the field's content IS the value ) ──
      // Link fields ( an <a>, or a path/url type ) yield their href; everything else yields its text.
      fieldValue(el, declared) {
        if (declared === "address")
          return { isLink: false, value: this.addressOf(el) };
        const isLink = el.tag === "a" || declared === "path" || declared === "url";
        if (!isLink)
          return { isLink: false, value: HtmlTree_1.HtmlTree.textOf(el).trim() };
        let href = HtmlTree_1.HtmlTree.get(el, "href");
        if (href === void 0) {
          const a = HtmlTree_1.HtmlTree.first(el, (d) => d.tag === "a" && HtmlTree_1.HtmlTree.has(d, "href"));
          href = a ? HtmlTree_1.HtmlTree.get(a, "href") : "";
        }
        return { isLink: true, value: (href ?? "").trim() };
      }
      /** A field's ( key, declaredType, value ) triple — the unit both heads read. */
      readField(el) {
        const key = HtmlTree_1.HtmlTree.get(el, "data-kcd-field") ?? "";
        const declared = HtmlTree_1.HtmlTree.get(el, "data-kcd-type");
        const { isLink, value } = this.fieldValue(el, declared);
        return { key, declared, value, isLink };
      }
      /** The chip texts of a `list`-type field ( <ul data-kcd-chips><li data-kcd-tag>… ). */
      chipsOf(el) {
        return HtmlTree_1.HtmlTree.collect(el, (d) => this.isTag(d)).map((t) => HtmlTree_1.HtmlTree.textOf(t).trim()).filter((v) => v !== "");
      }
    }();
  }
});

// ../kcd_sdk/dist/core/VaultLayout.js
var require_VaultLayout = __commonJS({
  "../kcd_sdk/dist/core/VaultLayout.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.VaultLayout = void 0;
    var LAYOUT = [
      // ── Agent layer — the Know + Care + Do artifacts an agent is composed from ──
      {
        dir: "lenses",
        type: "lens",
        layer: "agent",
        indexed: true,
        purpose: "Know+Care personalities. One folder per lens, each holding its lens file and a context/ of support material."
      },
      {
        dir: "analyzers",
        type: "analyzer",
        layer: "agent",
        indexed: true,
        purpose: "Read-anywhere, write-one-report agents."
      },
      {
        dir: "generators",
        type: "generator",
        layer: "agent",
        indexed: true,
        purpose: "Manifest-driven write agents \u2014 broad write authority, no judgment of their own."
      },
      {
        dir: "habits",
        type: "habit",
        layer: "agent",
        indexed: true,
        purpose: "Atomic behavior fragments. Flat files, no subfolders."
      },
      // ── Data / output layer — what a project accumulates as it runs ──
      {
        dir: "references",
        type: "reference",
        layer: "data",
        indexed: true,
        purpose: "The project knowledge store, categorized by folder \u2014 the folder IS the category."
      },
      {
        dir: "contracts",
        type: "contract",
        layer: "data",
        indexed: true,
        purpose: "Behavioral agreements \u2014 composable prose a third party can evaluate against."
      },
      {
        dir: "utilities",
        type: "utility",
        layer: "data",
        indexed: true,
        purpose: "The registered tool tier \u2014 draft/ (unapproved) and deployed/ (approved), with a registry."
      },
      {
        dir: "plans",
        type: "plan",
        layer: "data",
        indexed: true,
        purpose: "Promoted plans that authorize action, plus the plans_complete/ and plans_deferred/ buckets beneath."
      },
      // ── Data / output layer, untyped ──
      // Real, expected directories that hold no governed artifacts. Listed rather than omitted so a
      // deploy knows to create them and the index knows to skip them — a directory absent from this
      // table is genuinely unrecognized, which is a different and useful signal. Agentic work generates
      // drift and throwaway content fast; these are where it is allowed to land.
      {
        dir: "work",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "Per-lens scratch space (AI/, human/, plans/). Cheap and discardable until something is promoted out of it."
      },
      {
        dir: "logs",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "Session log plus per-lens completed/, todo/, and agent-status/."
      },
      {
        dir: "reports",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "Analyzer output."
      },
      {
        dir: "audits",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "Generator raw output and vault backups. Deliberately unindexed \u2014 backup copies here are what made the library accrue duplicate references."
      },
      {
        dir: "scratch",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "Free scratch space with no per-lens structure."
      },
      {
        dir: "dev-utilities",
        type: "unknown",
        layer: "data",
        indexed: false,
        purpose: "The dev command deck \u2014 JSON-declared scripts run against the project, not governed artifacts."
      }
    ];
    var NAV_INDEX_FILE = "nav-index.html";
    var FRAMEWORK_ROOT_FILES = ["root.html", "root-context.html", "kcd_framework.html"];
    var LENS_MAX_DEPTH = 3;
    var VaultLayout2 = class _VaultLayout {
      /** Every row, in table order — for the doc generator and anything enumerating the structure. */
      static all() {
        return LAYOUT;
      }
      /**
       * The row governing a vault-relative path ( the part BELOW the doc root ), or null when nothing
       * owns it. Longest matching directory prefix wins, so a more specific row always beats a shorter
       * one it also sits under.
       */
      static entryFor(sub) {
        const norm = sub.replace(/\\/g, "/");
        let best = null;
        for (const entry of LAYOUT) {
          if (norm !== entry.dir && !norm.startsWith(entry.dir + "/"))
            continue;
          if (best && best.dir.length >= entry.dir.length)
            continue;
          best = entry;
        }
        return best;
      }
      /**
       * A vault-root-relative path ( `_Claude/...` ) to its artifact type — the one path taxonomy.
       *
       * Four rules run before the table, because none of them is decided by which folder a file sits
       * in: a nav-index is a nav-index anywhere; a root-level framework file is `framework` regardless
       * of the table; a `context/` descendant is support material for whatever owns it; and inside
       * `lenses/`, only the lens's own file is the lens. Everything else is the table.
       */
      static classify(relPath, docRoot = "_Claude") {
        const norm = relPath.replace(/\\/g, "/");
        if (!norm.startsWith(docRoot + "/"))
          return "unknown";
        if (norm.endsWith("/" + NAV_INDEX_FILE))
          return "nav-index";
        const sub = norm.slice(docRoot.length + 1);
        if (FRAMEWORK_ROOT_FILES.includes(sub))
          return "framework";
        if (sub.includes("/context/"))
          return "reference";
        const entry = _VaultLayout.entryFor(sub);
        if (!entry)
          return "unknown";
        if (entry.dir === "lenses" && sub.split("/").length > LENS_MAX_DEPTH)
          return "reference";
        return entry.type;
      }
      /**
       * The top-level directory names the library index descends into — the scanner's whitelist gates
       * only immediate children of the doc root, so a nested indexed row ( `kcd/templates` ) folds into
       * its top-level segment ( `kcd` ) rather than appearing on its own.
       */
      static indexedDirs() {
        const out = /* @__PURE__ */ new Set();
        for (const entry of LAYOUT) {
          if (!entry.indexed)
            continue;
          out.add(entry.dir.split("/")[0]);
        }
        return [...out];
      }
      /**
       * The inverse of `indexedDirs` — scratch and output space. These directories are not part of the
       * library and are NOT installed into a user's vault, so occupancy inside them can never be
       * asserted. Protocol §1.1 therefore forbids a link into one; an address is the correct encoding.
       *
       * Derived from the registry rather than written out, so the ban tracks the layout automatically
       * and there is no second list to keep in step.
       */
      static ephemeralDirs() {
        const indexed = new Set(_VaultLayout.indexedDirs());
        const out = /* @__PURE__ */ new Set();
        for (const entry of LAYOUT) {
          const top = entry.dir.split("/")[0];
          if (!indexed.has(top))
            out.add(top);
        }
        return [...out];
      }
      /**
       * Does a project-root-relative href land in ephemeral space? Hrefs resolve against the PROJECT
       * root ( `resolveHref` ), so a vault target carries its doc-root segment — `_Claude/work/x` — and
       * that segment is stripped before the first path element is judged.
       */
      static isEphemeralHref(href, docRoot = "_Claude") {
        const parts = href.replace(/\\/g, "/").replace(/^\.\//, "").split("/").filter((p) => p !== "");
        const anchor = parts.lastIndexOf(docRoot);
        const top = anchor >= 0 ? parts[anchor + 1] : parts[0];
        return top !== void 0 && _VaultLayout.ephemeralDirs().includes(top);
      }
    };
    exports2.VaultLayout = VaultLayout2;
  }
});

// ../kcd_sdk/dist/core/html/KcdValidate.js
var require_KcdValidate = __commonJS({
  "../kcd_sdk/dist/core/html/KcdValidate.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdValidate = void 0;
    var HtmlTree_1 = require_HtmlTree();
    var KcdAddress_1 = require_KcdAddress();
    var VaultLayout_1 = require_VaultLayout();
    exports2.KcdValidate = new class KcdValidate {
      AUTHOR_RE = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
      // Name <email>
      SCOPE_RE = /^(?:universal|lens:[a-z0-9-]+)$/;
      // ── Frontmatter spec ( tier + expected type + per-field extras ) ──────────────
      FRONTMATTER = {
        name: { required: true, type: "slug" },
        // plus nameOk() extras ( ≤64, no claude/anthropic )
        description: { required: true, type: "text", nonEmpty: true, maxLen: 1024 },
        type: { required: true, type: "enum" },
        status: { required: true, type: "enum", oneOf: KcdAddress_1.KcdAddress.STATUSES, emptyOkForType: "template" },
        "schema-version": { type: "text" },
        author: { type: "text", pattern: this.AUTHOR_RE },
        updated: { type: "date" },
        created: { type: "date" },
        audience: { type: "enum", oneOf: KcdAddress_1.KcdAddress.AUDIENCES },
        tags: { type: "list" },
        domain: { type: "list" },
        origin: { type: "slug" },
        hash: { type: "text" },
        base: { type: "slug" },
        "dredge-depth": { type: "number" },
        scope: { type: "enum", pattern: this.SCOPE_RE },
        "habit-class": { type: "slug" },
        lens: { type: "slug" },
        // todo / completed are ADDRESSES, not paths ( protocol §1.1 ). A lens declares WHERE its log
        // lives; it does not assert that one has been written. Most lenses name a log file that does
        // not exist yet, and that is a legal state rather than a defect.
        todo: { type: "address" },
        completed: { type: "address" }
      };
      /**
       * Validate one artifact.
       * @param input  an HTML string, a real DOM element/Document, or an already-normalized HtmlEl root.
       */
      validate(input, opts) {
        const root = typeof input === "string" ? HtmlTree_1.HtmlTree.parse(input) : input && input.nodeType !== void 0 ? HtmlTree_1.HtmlTree.fromDOM(input) : input;
        const errors = [], warnings = [];
        const err = (code, where, msg) => {
          errors.push({ code, where, msg });
        };
        const warn = (code, where, msg) => {
          warnings.push({ code, where, msg });
        };
        const articles = HtmlTree_1.HtmlTree.collect(root, (el) => KcdAddress_1.KcdAddress.isArticle(el));
        if (articles.length === 0) {
          err("no-root", "document", 'no <article data-kcd="\u2026"> root found');
          return this.result(null, null, errors, warnings);
        }
        if (articles.length > 1)
          err("multi-root", "document", `${articles.length} artifact roots; exactly one per file`);
        const article = articles[0];
        const rootType = HtmlTree_1.HtmlTree.get(article, "data-kcd");
        if (rootType === "utility")
          err("utility-dropped", "data-kcd", "utility is not a document type \u2014 it is declarative code ( UtilityObject )");
        else if (!KcdAddress_1.KcdAddress.TYPES.includes(rootType))
          err("unknown-type", "data-kcd", `unknown artifact type "${rootType}"`);
        if (rootType === "template")
          return this.result(rootType, null, errors, warnings);
        const name = this.checkFrontmatter(article, rootType, err, warn);
        this.checkStructure(article, rootType, err, warn);
        this.checkAddressing(article, err, opts?.path);
        if (rootType === "habit")
          this.checkHabit(article, err, warn);
        return this.result(rootType, name, errors, warnings);
      }
      // ── Frontmatter pass ──────────────────────────────────────────────────────────
      checkFrontmatter(article, rootType, err, _warn) {
        const blocks = HtmlTree_1.HtmlTree.collect(article, (el) => KcdAddress_1.KcdAddress.isFrontmatter(el));
        if (blocks.length === 0) {
          err("no-frontmatter", "frontmatter", "missing <dl data-kcd-frontmatter>");
          return null;
        }
        if (blocks.length > 1)
          err("multi-frontmatter", "frontmatter", "more than one frontmatter block");
        const fm = blocks[0];
        const seen = {};
        let name = null;
        for (const field of HtmlTree_1.HtmlTree.collect(fm, (el) => KcdAddress_1.KcdAddress.isField(el))) {
          const key = HtmlTree_1.HtmlTree.get(field, "data-kcd-field");
          const declared = HtmlTree_1.HtmlTree.get(field, "data-kcd-type");
          const spec = this.FRONTMATTER[key];
          if (!declared)
            err("no-type", `field:${key}`, `field "${key}" has no data-kcd-type`);
          else if (!KcdAddress_1.KcdAddress.isFieldType(declared))
            err("bad-type", `field:${key}`, `unknown data-kcd-type "${declared}"`);
          if (!spec) {
            err("unknown-field", `field:${key}`, `frontmatter field "${key}" is not in the locked set`);
            continue;
          }
          seen[key] = true;
          if (spec.type === "list") {
            this.checkList(field, key, err);
            if (key === "name")
              name = HtmlTree_1.HtmlTree.textOf(field).trim();
            continue;
          }
          const { value } = KcdAddress_1.KcdAddress.fieldValue(field, declared ?? spec.type);
          if (key === "name")
            name = value;
          if (spec.required && value === "") {
            const okEmpty = spec.emptyOkForType && rootType === spec.emptyOkForType;
            if (!okEmpty)
              err("empty-required", `field:${key}`, `required field "${key}" is empty`);
            continue;
          }
          if (value === "")
            continue;
          if (!KcdAddress_1.KcdAddress.validates(spec.type, value))
            err("bad-value", `field:${key}`, `"${value}" is not a valid ${spec.type}`);
          if (spec.type === "slug") {
            const fix = this.slugUnderscore(value);
            if (fix)
              err("underscore-slug", `field:${key}`, `"${value}" has internal underscores \u2014 slugs are hyphenated ( use "${fix}" )`);
          }
          if (spec.oneOf && !spec.oneOf.includes(value))
            err("not-allowed", `field:${key}`, `"${value}" not in { ${spec.oneOf.join(" | ")} }`);
          if (spec.pattern && !spec.pattern.test(value))
            err("bad-format", `field:${key}`, `"${value}" does not match the expected form`);
          if (spec.maxLen && value.length > spec.maxLen)
            err("too-long", `field:${key}`, `"${key}" exceeds ${spec.maxLen} chars`);
          if (key === "name" && !this.nameOk(value))
            err("bad-name", "field:name", `"${value}" must be kebab-case, \u226464 chars, no "claude"/"anthropic"`);
          if (key === "type" && value !== rootType)
            err("type-mismatch", "field:type", `frontmatter type "${value}" \u2260 root data-kcd "${rootType}"`);
          if (declared && spec.type !== declared)
            err("type-drift", `field:${key}`, `declared type "${declared}" \u2260 expected "${spec.type}"`);
        }
        for (const [key, spec] of Object.entries(this.FRONTMATTER))
          if (spec.required && !seen[key])
            err("missing-required", `field:${key}`, `required frontmatter field "${key}" is absent`);
        return name;
      }
      // ── Structure pass ──────────────────────────────────────────────────────────
      checkStructure(article, rootType, err, _warn) {
        const habitClasses = {};
        const fmBlock = HtmlTree_1.HtmlTree.collect(article, (el) => KcdAddress_1.KcdAddress.isFrontmatter(el))[0];
        const fmFields = new Set(fmBlock ? HtmlTree_1.HtmlTree.collect(fmBlock, (el) => KcdAddress_1.KcdAddress.isField(el)) : []);
        HtmlTree_1.HtmlTree.walk(article, (el) => {
          if (el.tag === "table") {
            const carries = HtmlTree_1.HtmlTree.collect(el, (d) => HtmlTree_1.HtmlTree.has(d, "data-kcd-field") || HtmlTree_1.HtmlTree.has(d, "data-kcd-slot") || HtmlTree_1.HtmlTree.has(d, "data-kcd-param")).length > 0;
            if (carries)
              err("table-carries-fields", "table", "canonical fields inside a <table> \u2014 use a faux-table ( a real <table> may only hold non-canonical chrome )");
          }
          for (const a of Object.keys(el.attrs))
            if (a.startsWith("data-kcd") && !KcdAddress_1.KcdAddress.KNOWN_ATTRS.includes(a))
              err("unknown-attr", a, `"${a}" is not in the closed attribute set`);
          if (KcdAddress_1.KcdAddress.isRegion(el)) {
            const v = HtmlTree_1.HtmlTree.get(el, "data-kcd-region");
            if (!KcdAddress_1.KcdAddress.REGIONS.includes(v))
              err("bad-region", `region:${v}`, `region must be one of { ${KcdAddress_1.KcdAddress.REGIONS.join(" | ")} }`);
            if (rootType !== "lens")
              err("region-non-lens", `region:${v}`, "regions are lens-only");
            if (this.isEmptyContainer(el))
              err("empty-region", `region:${v}`, "empty region \u2014 omit it ( no empty containers )");
          }
          if (KcdAddress_1.KcdAddress.isSection(el)) {
            const v = HtmlTree_1.HtmlTree.get(el, "data-kcd-section");
            if (!v)
              err("unnamed-section", "section", "section has an empty name");
            if (this.isEmptyContainer(el))
              err("empty-section", `section:${v}`, "empty section \u2014 omit it ( no empty containers )");
            const merge = HtmlTree_1.HtmlTree.get(el, "data-kcd-merge");
            if (merge && !KcdAddress_1.KcdAddress.MERGES.includes(merge))
              err("bad-merge", `section:${v}`, `merge must be one of { ${KcdAddress_1.KcdAddress.MERGES.join(" | ")} }`);
          }
          if (KcdAddress_1.KcdAddress.isSlot(el)) {
            const kind = HtmlTree_1.HtmlTree.get(el, "data-kcd-slot");
            if (!kind)
              err("unkinded-slot", "slot", `slot carries no kind \u2014 data-kcd-slot must name one of { ${KcdAddress_1.KcdAddress.SLOT_KINDS.join(" | ")} }`);
            else if (!KcdAddress_1.KcdAddress.SLOT_KINDS.includes(kind))
              err("bad-slot-kind", `slot:${kind}`, `slot kind "${kind}" not in { ${KcdAddress_1.KcdAddress.SLOT_KINDS.join(" | ")} }`);
            const hc = HtmlTree_1.HtmlTree.get(el, "data-kcd-habit-class");
            if (hc)
              habitClasses[hc] = (habitClasses[hc] ?? 0) + 1;
            if (HtmlTree_1.HtmlTree.collect(el, (d) => KcdAddress_1.KcdAddress.isField(d)).length === 0)
              err("unaddressed-slot", "slot", "slot row carries no data-kcd-field \u2014 its cells are invisible to the parser");
            const mode = HtmlTree_1.HtmlTree.get(el, "data-kcd-mode");
            if (mode && !KcdAddress_1.KcdAddress.MODES.includes(mode))
              err("bad-mode", `mode:${mode}`, `mode must be one of { ${KcdAddress_1.KcdAddress.MODES.join(" | ")} }`);
          }
          if (KcdAddress_1.KcdAddress.isParam(el)) {
            const fields = HtmlTree_1.HtmlTree.collect(el, (d) => KcdAddress_1.KcdAddress.isField(d)).map((d) => HtmlTree_1.HtmlTree.get(d, "data-kcd-field"));
            for (const need of KcdAddress_1.KcdAddress.PARAM_FIELDS)
              if (!fields.includes(need))
                err("param-missing-cell", "param", `param row missing "${need}" cell`);
          }
          if (KcdAddress_1.KcdAddress.isField(el) && !fmFields.has(el)) {
            const key = HtmlTree_1.HtmlTree.get(el, "data-kcd-field");
            const declared = HtmlTree_1.HtmlTree.get(el, "data-kcd-type");
            if (!declared)
              err("no-type", `cell:${key}`, `cell "${key}" has no data-kcd-type`);
            else if (!KcdAddress_1.KcdAddress.isFieldType(declared))
              err("bad-type", `cell:${key}`, `unknown data-kcd-type "${declared}"`);
            else {
              const { isLink, value } = KcdAddress_1.KcdAddress.fieldValue(el, declared);
              if (isLink && value === "")
                err("empty-link", `cell:${key}`, `link cell "${key}" has no href`);
              else if (value !== "" && !KcdAddress_1.KcdAddress.validates(declared, value))
                err("bad-value", `cell:${key}`, `"${value}" is not a valid ${declared}`);
              if (declared === "slug") {
                const fix = this.slugUnderscore(value);
                if (fix)
                  err("underscore-slug", `cell:${key}`, `"${value}" has internal underscores \u2014 slugs are hyphenated ( use "${fix}" )`);
              }
            }
          }
        });
        for (const region of HtmlTree_1.HtmlTree.collect(article, (el) => KcdAddress_1.KcdAddress.isRegion(el) && HtmlTree_1.HtmlTree.get(el, "data-kcd-region") === "care"))
          for (const sec of HtmlTree_1.HtmlTree.collect(region, (el) => KcdAddress_1.KcdAddress.isSection(el))) {
            const v = HtmlTree_1.HtmlTree.get(sec, "data-kcd-section");
            if (v && !KcdAddress_1.KcdAddress.CARE_SECTIONS.includes(v))
              err("bad-care-section", `section:${v}`, `Care section "${v}" not in { ${KcdAddress_1.KcdAddress.CARE_SECTIONS.join(" | ")} }`);
          }
        for (const [hc, n] of Object.entries(habitClasses))
          if (n > 1)
            err("dup-habit-class", `habit-class:${hc}`, `${n} slots share habit-class "${hc}" \u2014 at most one per file ( \xA76 )`);
      }
      // ── Habit pass — the four-field contract ( see _habit_template ) ────────────────
      // `why` is REQUIRED ( the trigger; a habit with no why can't fire — renamed from `when`,
      // Bryan 2026-07-13, so the field matches the canonical What|Where|Why convention: it's the
      // same prose a lens's own Why cell can defer to via `mode:habit` ). `action` + `explanation` are
      // the dense-form body — warned-on when absent rather than hard-required, so a `don't`-style habit
      // ( rules, no action ) and an in-progress migration both still validate. `rules` is optional. EXTRA
      // sections ( format / example / homes / … ) are allowed — they ride only on a full on-demand read,
      // never in the dense projection, so the four-field shape doesn't forbid a habit from carrying more.
      checkHabit(article, err, warn) {
        const names = new Set(HtmlTree_1.HtmlTree.collect(article, (el) => KcdAddress_1.KcdAddress.isSection(el)).map((el) => HtmlTree_1.HtmlTree.get(el, "data-kcd-section")).filter((v) => !!v));
        if (!names.has("why"))
          err("habit-no-why", "section:why", "a habit must declare a `why` section ( the trigger it fires on )");
        if (!names.has("action") && !names.has("rules"))
          warn("habit-no-behavior", "section", "a habit has neither an `action` nor a `rules` section \u2014 nothing to do");
        if (!names.has("explanation"))
          warn("habit-no-explanation", "section:explanation", "a habit has no `explanation` \u2014 the dense suggested form will carry no rationale");
      }
      // ── Helpers ───────────────────────────────────────────────────────────────────
      // ── Addressing pass ( protocol §1.1 ) ─────────────────────────────────────────
      /**
       * The link-versus-address law, enforced on the body.
       *
       * A link ASSERTS that a document is there. An address does not — it names a location that may be
       * occupied now, later, or never. Two rules follow, and only one of them is about occupancy:
       *
       *  1. An address must be WELL-FORMED. Its occupancy is never checked here or anywhere else;
       *     vacancy is a legal state and reporting it would recreate the noise the primitive removes.
       *  2. A link may never point into ephemeral space. Those directories are not installed into a
       *     user's vault at all, so the assertion a link makes is false by construction — regardless of
       *     whether the target happens to exist on the authoring machine.
       */
      checkAddressing(article, err, selfPath) {
        const selfEphemeral = selfPath !== void 0 && VaultLayout_1.VaultLayout.isEphemeralHref(selfPath);
        for (const el of HtmlTree_1.HtmlTree.collect(article, (d) => KcdAddress_1.KcdAddress.isAddress(d))) {
          const value = KcdAddress_1.KcdAddress.addressOf(el);
          if (!KcdAddress_1.KcdAddress.isAddressValue(value))
            err("bad-address", "address", `"${value}" is not a well-formed address \u2014 expected an artifact name or a project-root-relative path, with no "../" and no absolute root`);
        }
        if (selfEphemeral)
          return;
        for (const a of HtmlTree_1.HtmlTree.collect(article, (d) => d.tag === "a" && HtmlTree_1.HtmlTree.has(d, "href"))) {
          const href = (HtmlTree_1.HtmlTree.get(a, "href") ?? "").trim();
          if (href === "" || href.startsWith("#") || href.includes("{"))
            continue;
          if (/^(?:https?:)?\/\//.test(href) || /^mailto:/.test(href))
            continue;
          if (VaultLayout_1.VaultLayout.isEphemeralHref(href))
            err("ephemeral-link", "address", `"${href}" links into ephemeral space ( ${VaultLayout_1.VaultLayout.ephemeralDirs().join(", ")} ), which is not installed into a vault \u2014 use <code data-kcd-address> instead`);
        }
      }
      checkList(field, key, err) {
        const tags = HtmlTree_1.HtmlTree.collect(field, (el) => KcdAddress_1.KcdAddress.isTag(el));
        for (const t of tags)
          if (HtmlTree_1.HtmlTree.textOf(t).trim() === "")
            err("empty-tag", `field:${key}`, "empty chip in a list field");
      }
      nameOk(v) {
        return v.length <= 64 && KcdAddress_1.KcdAddress.SLUG_RE.test(v) && !/claude|anthropic/i.test(v);
      }
      // slug hygiene: internal underscores ( `lens_crafter` ) are illegal — return the hyphenated
      // suggestion, or null if clean. The leading `_` sort-prefix ( `_lens-base` ) is preserved.
      slugUnderscore(value) {
        if (!/[a-z0-9]_[a-z0-9]/.test(value))
          return null;
        return value.replace(/([a-z0-9])_([a-z0-9])/g, "$1-$2");
      }
      isEmptyContainer(el) {
        if (HtmlTree_1.HtmlTree.textOf(el).trim() !== "")
          return false;
        return HtmlTree_1.HtmlTree.collect(el, (d) => d !== el && (HtmlTree_1.HtmlTree.has(d, "data-kcd-field") || HtmlTree_1.HtmlTree.has(d, "data-kcd-slot") || HtmlTree_1.HtmlTree.has(d, "data-kcd-param"))).length === 0;
      }
      result(type, name, errors, warnings) {
        return { ok: errors.length === 0, type, name, errors, warnings };
      }
    }();
  }
});

// ../kcd_sdk/dist/primitives/errors.js
var require_errors = __commonJS({
  "../kcd_sdk/dist/primitives/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KCDValidationError = exports2.KCDParseError = void 0;
    var KCDParseError = class extends Error {
      path;
      rawContent;
      line;
      constructor(message, path3, rawContent, line) {
        super(message);
        this.name = "KCDParseError";
        this.path = path3;
        this.rawContent = rawContent;
        this.line = line;
      }
    };
    exports2.KCDParseError = KCDParseError;
    var KCDValidationError = class extends Error {
      path;
      expected;
      got;
      field;
      section;
      constructor(message, path3, expected, got, opts) {
        super(message);
        this.name = "KCDValidationError";
        this.path = path3;
        this.expected = expected;
        this.got = got;
        this.field = opts?.field;
        this.section = opts?.section;
      }
    };
    exports2.KCDValidationError = KCDValidationError;
  }
});

// ../kcd_sdk/dist/core/html/KcdParse.js
var require_KcdParse = __commonJS({
  "../kcd_sdk/dist/core/html/KcdParse.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdParse = void 0;
    var HtmlTree_1 = require_HtmlTree();
    var KcdAddress_1 = require_KcdAddress();
    var KcdValidate_1 = require_KcdValidate();
    var KCDPrimitive_1 = require_KCDPrimitive();
    var errors_1 = require_errors();
    var SLOT_ROLE = {
      references: "reference",
      domains: "reference",
      domain: "reference",
      habits: "habit",
      contracts: "contract",
      tools: "tool",
      rules: "rule"
    };
    function inferSlotKind(section, where) {
      return section && SLOT_ROLE[section] || (where ? "link" : "table-data");
    }
    exports2.KcdParse = new class KcdParse {
      /** Strict: a conforming document → its object model; a malformed one THROWS. The protected door. */
      parse(html, path3) {
        const report = KcdValidate_1.KcdValidate.validate(html, { path: path3 });
        if (!report.ok) {
          const first = report.errors[0];
          throw new errors_1.KCDValidationError(`KCD document failed validation ( ${report.errors.length} error(s) ): ${first.code} @ ${first.where} \u2014 ${first.msg}`, path3, "conforming KCD HTML", null);
        }
        return this.build(HtmlTree_1.HtmlTree.parse(html), path3);
      }
      /** Lenient: returns null instead of throwing — for the scanner's skip-and-continue sweep. */
      tryParse(html, path3) {
        const report = KcdValidate_1.KcdValidate.validate(html, { path: path3 });
        if (!report.ok)
          return null;
        return this.build(HtmlTree_1.HtmlTree.parse(html), path3);
      }
      // ── Assembly ( runs only on an already-conforming tree ) ─────────────────────
      build(root, path3) {
        const article = HtmlTree_1.HtmlTree.first(root, (el) => KcdAddress_1.KcdAddress.isArticle(el));
        const type = HtmlTree_1.HtmlTree.get(article, "data-kcd") ?? "unknown";
        const acc = { links: [], addresses: [], slots: [], params: [] };
        this.scan(article, void 0, void 0, acc);
        const slots = acc.slots;
        return {
          path: path3,
          type,
          frontmatter: this.frontmatter(article),
          sections: this.sections(article),
          body: HtmlTree_1.HtmlTree.innerHtml(article),
          links: acc.links,
          addresses: acc.addresses,
          included: true,
          policy: this.policy(slots),
          params: acc.params,
          slots,
          toolModes: this.toolModes(slots)
        };
      }
      // ── Tools ( a lens's MCP tool composition — the `tool`-kind slots ) ──
      // A tool is NOT a path artifact: its slot names the tool ( the `what` cell ) and carries a mode, no
      // `where`, so it never enters `policy` ( which skips where-less rows ). Keyed on the explicit slot KIND
      // now ( `data-kcd-slot="tool"` ), decoupled from the section NAME — the migration's whole point. Bare
      // tool slots still resolve via `inferSlotKind` ( tools-section → tool ). A row without a `what` or with
      // mode `off` contributes nothing.
      toolModes(slots) {
        const out = {};
        for (const s of slots) {
          if (s.kind !== "tool" || !s.what || s.mode === "off")
            continue;
          out[s.what] = s.mode;
        }
        return out;
      }
      // ── Frontmatter ( <dl data-kcd-frontmatter> → Record, replacing YAML ) ─────────
      // Coerced by declared type so downstream reads match the old js-yaml result ( number stays
      // number, list stays string[] ). Empty optional fields are skipped — an empty <dd> must not mint
      // a key the markdown never carried ( protects key-set parity ).
      frontmatter(article) {
        const dl = HtmlTree_1.HtmlTree.first(article, (el) => KcdAddress_1.KcdAddress.isFrontmatter(el));
        const out = {};
        if (!dl)
          return out;
        for (const dd of HtmlTree_1.HtmlTree.collect(dl, (el) => KcdAddress_1.KcdAddress.isField(el))) {
          const { key, declared, value } = KcdAddress_1.KcdAddress.readField(dd);
          if (declared === "list") {
            const chips = KcdAddress_1.KcdAddress.chipsOf(dd);
            if (chips.length)
              out[key] = chips;
            continue;
          }
          if (value === "")
            continue;
          out[key] = declared === "number" ? Number(value) : value;
        }
        return out;
      }
      // ── Sections ( name → inner HTML; the frozen section-NAME set, body free to change ) ──
      // Duplicate section names MERGE ( additive ) — collapsing overlapping mappings into one entity,
      // the same model the lens uses to fold its context. Real declarative/union merge is richer-model.
      sections(article) {
        const out = {};
        for (const sec of HtmlTree_1.HtmlTree.collect(article, (el) => KcdAddress_1.KcdAddress.isSection(el))) {
          const name = HtmlTree_1.HtmlTree.get(sec, "data-kcd-section") ?? "";
          if (!name)
            continue;
          const body = HtmlTree_1.HtmlTree.innerHtml(sec);
          out[name] = out[name] ? `${out[name]}
${body}` : body;
        }
        return out;
      }
      // ── Policy ( every region — one dredge idiom for reference, habit, contract, anything routable ) ──
      // In the md world this was LensObject parsing the `## Know` markdown table, know-only. A Do-region
      // habit/contract slot now feeds the SAME policy list — `mode` alone decides what rides ( off /
      // on-routing-row / suggested-full-text ), so no artifact type needs its own carve-out downstream.
      policy(slots) {
        const out = [];
        for (const s of slots) {
          if (!s.where)
            continue;
          out.push({ what: s.what, href: s.where, why: s.why, mode: s.mode, type: (0, KCDPrimitive_1.classifyHref)(s.where), section: s.section });
        }
        return out;
      }
      // ── One descent ( links + slots + params, each tagged with its region + section ) ──
      scan(el, region, section, acc) {
        for (const kid of el.kids) {
          if (!HtmlTree_1.HtmlTree.isEl(kid))
            continue;
          const reg = KcdAddress_1.KcdAddress.isRegion(kid) ? HtmlTree_1.HtmlTree.get(kid, "data-kcd-region") || region : region;
          const sect = KcdAddress_1.KcdAddress.isSection(kid) ? HtmlTree_1.HtmlTree.get(kid, "data-kcd-section") || section : section;
          if (kid.tag === "a" && HtmlTree_1.HtmlTree.has(kid, "href")) {
            const href = HtmlTree_1.HtmlTree.get(kid, "href");
            acc.links.push({ text: HtmlTree_1.HtmlTree.textOf(kid).trim(), href, type: (0, KCDPrimitive_1.classifyHref)(href), section: sect });
          }
          if (KcdAddress_1.KcdAddress.isAddress(kid)) {
            acc.addresses.push({ value: KcdAddress_1.KcdAddress.addressOf(kid), text: HtmlTree_1.HtmlTree.textOf(kid).trim(), section: sect });
          }
          if (KcdAddress_1.KcdAddress.isSlot(kid))
            acc.slots.push(this.readSlot(kid, reg, sect));
          if (KcdAddress_1.KcdAddress.isParam(kid))
            acc.params.push(this.readParam(kid, sect));
          this.scan(kid, reg, sect, acc);
        }
      }
      readSlot(slot, region, section) {
        const cells = this.cells(slot);
        const rawMode = HtmlTree_1.HtmlTree.get(slot, "data-kcd-mode");
        const where = cells.where ?? "";
        return {
          what: cells.what ?? "",
          where,
          why: cells.why ?? "",
          kind: HtmlTree_1.HtmlTree.get(slot, "data-kcd-slot") || inferSlotKind(section, where),
          mode: rawMode === "off" || rawMode === "suggested" ? rawMode : "on",
          habitClass: HtmlTree_1.HtmlTree.get(slot, "data-kcd-habit-class"),
          region,
          section
        };
      }
      readParam(param, section) {
        const cells = this.cells(param);
        return {
          name: cells.name ?? "",
          type: cells.type ?? "",
          default: cells.default ?? "",
          description: cells.description ?? "",
          section
        };
      }
      /** A row's addressable cells as a { fieldName → value } bag — the row reader both slots/params share. */
      cells(row) {
        const out = {};
        for (const f of HtmlTree_1.HtmlTree.collect(row, (el) => KcdAddress_1.KcdAddress.isField(el))) {
          const { key, value } = KcdAddress_1.KcdAddress.readField(f);
          if (key)
            out[key] = value;
        }
        return out;
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/KcdEmit.js
var require_KcdEmit = __commonJS({
  "../kcd_sdk/dist/core/html/KcdEmit.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdEmit = void 0;
    var HtmlTree_1 = require_HtmlTree();
    var KcdAddress_1 = require_KcdAddress();
    var KcdValidate_1 = require_KcdValidate();
    var CSS_HOME = "kcd.css";
    exports2.KcdEmit = new class KcdEmit {
      /**
       * A full artifact → a full HTML document string ( doctype through `</html>` ).
       *
       * `vaultPath` is the artifact's VAULT-RELATIVE destination ( `plans/x.html` ), and it exists for
       * one reason: the stylesheet link is a plain relative href, so its correct value depends on how
       * deep the document sits. Omit it and the link is emitted bare — correct only at the vault root.
       * Every caller that WRITES TO DISK must pass it; a preview or a test that never lands a file can
       * leave it off. ( Deliberately not inferred from `artifact.path`: that field is absent on the
       * agent-supplied save shape and carries a different form depending on who built it, so guessing
       * from it would emit a confidently wrong depth. )
       */
      emit(artifact, vaultPath) {
        const dl = this.frontmatterBlock(artifact.frontmatter);
        const article = this.spliceFrontmatter(artifact.body, dl);
        return this.document(artifact.type, this.titleOf(artifact), article, this.cssHref(vaultPath));
      }
      /**
       * The stylesheet href for a document living at `vaultPath` — one `../` per directory level, then
       * `kcd.css` at the vault root. The mirror of `VaultUtilities.fixStylesheetLinks`'s depth math, so
       * a freshly emitted document already agrees with what the corpus-wide sweep would rewrite it to.
       *
       * An absent or root-level path yields the bare filename. Backslashes are normalized first, since
       * a Windows-shaped path would otherwise count as a single segment and silently emit depth 0.
       */
      cssHref(vaultPath) {
        const rel = (vaultPath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
        if (!rel)
          return CSS_HOME;
        return "../".repeat(rel.split("/").length - 1) + CSS_HOME;
      }
      /** frontmatter → `<dl data-kcd-frontmatter>…</dl>`, the inverse of `KcdParse.frontmatter()`.
       *  Keys are emitted in the record's own iteration order; an absent / empty-string value is
       *  skipped ( never mint a key the source didn't carry — mirrors the parser's own skip rule ). */
      frontmatterBlock(frontmatter) {
        const rows = Object.entries(frontmatter).filter(([, v]) => v !== void 0 && v !== "" && !(Array.isArray(v) && v.length === 0)).map(([key, v]) => this.row(key, v));
        return `<dl data-kcd-frontmatter>
${rows.join("\n")}
</dl>`;
      }
      /** One `<dt>`+`<dd>` pair. Type comes from the locked `KcdValidate.FRONTMATTER` spec ( falling back
       *  to `text` for a key outside the closed set — never fatal, just unenforced ). A `path`/`url` field
       *  carries its value as a real `href` ( not just text ) so `KcdAddress.fieldValue` resolves it on
       *  read-back — text-only would round-trip as an empty link per the addressing contract. */
      row(key, value) {
        const type = KcdValidate_1.KcdValidate.FRONTMATTER[key]?.type ?? "text";
        if (type === "list") {
          const items = (Array.isArray(value) ? value : [value]).map(String);
          const chips = items.map((v) => `<li data-kcd-tag>${HtmlTree_1.HtmlTree.escapeText(v)}</li>`).join("");
          return `	<dt>${key}</dt><dd data-kcd-field="${key}" data-kcd-type="list"><ul data-kcd-chips>${chips}</ul></dd>`;
        }
        const text = HtmlTree_1.HtmlTree.escapeText(String(value));
        if (type === "path" || type === "url") {
          const href = HtmlTree_1.HtmlTree.escapeAttr(String(value));
          return `	<dt>${key}</dt><dd data-kcd-field="${key}" data-kcd-type="${type}" href="${href}">${text}</dd>`;
        }
        return `	<dt>${key}</dt><dd data-kcd-field="${key}" data-kcd-type="${type}">${text}</dd>`;
      }
      /** Replace the existing `<dl data-kcd-frontmatter>` inside a body-HTML fragment with a freshly
       *  built one, leaving every sibling ( regions/sections/slots ) byte-for-byte as parsed. No existing
       *  block ( shouldn't happen on a validated artifact ) falls back to prepending it. */
      spliceFrontmatter(body, dlHtml) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        const replacement = HtmlTree_1.HtmlTree.parse(dlHtml).kids.find(HtmlTree_1.HtmlTree.isEl);
        if (!this.replaceFirst(root, (el) => KcdAddress_1.KcdAddress.isFrontmatter(el), replacement)) {
          root.kids.unshift(replacement);
        }
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      /** Depth-first find-and-replace-in-place ( `HtmlTree` has no mutation helper — this is the one
       *  emit-only exception, kept here rather than growing the shared reader's surface for one caller ). */
      replaceFirst(el, pred, replacement) {
        for (let i = 0; i < el.kids.length; i++) {
          const kid = el.kids[i];
          if (!HtmlTree_1.HtmlTree.isEl(kid))
            continue;
          if (pred(kid)) {
            el.kids[i] = replacement;
            return true;
          }
          if (this.replaceFirst(kid, pred, replacement))
            return true;
        }
        return false;
      }
      /** Wrap an `<article>`'s inner HTML in a full document — doctype, a minimal head ( the
       *  `kcd.css` link mirrors every hand-authored artifact; Starmind itself never loads it live —
       *  the sanitized body is styled by the renderer's own ported rules, which is why a wrong href
       *  here stays invisible until someone opens the file in a browser ), and the body.
       *
       *  `cssHref` defaults to the bare filename ( vault-root depth ). Callers reach this through
       *  `emit`, which computes it from the destination path — see `cssHref`. */
      document(type, title, articleInner, cssHref = CSS_HOME) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>${HtmlTree_1.HtmlTree.escapeText(title)}</title>
	<link rel="stylesheet" href="${cssHref}">
</head>
<body>

<article data-kcd="${type}">
` + articleInner + "\n</article>\n\n</body>\n</html>\n";
      }
      /** The document `<title>` — cosmetic only ( dropped by `HtmlSanitize`, unread by `KcdParse` ) —
       *  so a missing/blank name never breaks the write. */
      titleOf(artifact) {
        const name = artifact.frontmatter["name"];
        return typeof name === "string" && name ? name : artifact.type;
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/KcdContext.js
var require_KcdContext = __commonJS({
  "../kcd_sdk/dist/core/html/KcdContext.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdContext = void 0;
    var HtmlTree_1 = require_HtmlTree();
    var KcdAddress_1 = require_KcdAddress();
    var FRONTMATTER_KEEP = ["name", "description", "status"];
    exports2.KcdContext = new class KcdContext {
      HEADINGS = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
      // Chrome + machine-only structure — never part of the prompt body. `dl` is the frontmatter
      // block, rendered separately by `frontmatter()` from the structured field, not walked here.
      SKIP = /* @__PURE__ */ new Set(["head", "style", "script", "link", "meta", "dl"]);
      /** One artifact's structured model → lean AI-audience text. */
      project(artifact) {
        const header = `# [${artifact.type}] ${artifact.path}`;
        const front = this.frontmatter(artifact.frontmatter);
        const body = artifact.type === "habit" ? this.projectHabit(artifact) : this.body(artifact.body);
        return [header, front, body].filter(Boolean).join("\n\n");
      }
      /** The keep-set, one `key: value` line each; list values join on comma. Empty/absent fields
       *  emit nothing — an empty line must not mint a key the artifact never carried. */
      frontmatter(fm) {
        const lines = [];
        for (const key of FRONTMATTER_KEEP) {
          const v = fm[key];
          if (v === void 0 || v === "")
            continue;
          lines.push(`${key}: ${Array.isArray(v) ? v.join(", ") : v}`);
        }
        return lines.join("\n");
      }
      /** Reparse the artifact's body HTML and walk it to plain, audience-stripped text. Empty /
       *  unparseable input yields ''. */
      body(html) {
        if (!html || !html.trim())
          return "";
        const root = HtmlTree_1.HtmlTree.parse(html);
        return this.renderNodes(root.kids);
      }
      /** `block()` over an already-collected node array, joined/collapsed the same way `body()` is —
       *  the shared tail both the flat projector and the per-region-block projector render through. */
      renderNodes(nodes) {
        const out = [];
        this.block(nodes, out);
        return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      }
      /**
       * Decompose one artifact into region-blocks ( Phase 2 ). A lens's own top-level content
       * ( outside any `data-kcd-region` — its `<h1>` + lede ) is the `care` block: identity prose, the
       * "personality" half of Know+Care. Everything inside a `data-kcd-region` wrapper is split further,
       * one block per `data-kcd-section` found inside it, tagged with that region and carrying its
       * `data-kcd-merge-key` if it declares one. A non-lens artifact never carries a region wrapper, so
       * its sections ( and any un-sectioned lede ) all default to `defaultRegion` — the caller passes
       * its `getRole()` ( `know` for reference/plan/etc., `do` for habit/contract/generator/analyzer/
       * utility ), since role is a KCDPrimitive concept this pure projector doesn't otherwise have.
       */
      projectBlocks(artifact, defaultRegion = "know") {
        if (artifact.type === "habit") {
          const text = this.projectHabit(artifact);
          return text ? [{ region: defaultRegion, section: "habit", mergeKey: null, text }] : [];
        }
        const ledeRegion = artifact.type === "lens" ? "care" : defaultRegion;
        const out = [];
        if (!artifact.body || !artifact.body.trim())
          return out;
        const root = HtmlTree_1.HtmlTree.parse(artifact.body);
        for (const raw of this.collectRegions(root, ledeRegion)) {
          const text = this.renderNodes(this.stripNonCanonicalHeadings(raw.nodes));
          if (!text)
            continue;
          const rows = this.collectRows(raw.nodes);
          out.push({ region: raw.region, section: raw.section, mergeKey: raw.mergeKey ?? null, text, ...rows.length ? { rows } : {} });
        }
        return out;
      }
      /**
       * One un-rendered region-block candidate — `collectRegions` gathers the node groups, leaving
       * the actual text rendering ( shared with the flat path ) to the caller. Each recursion level
       * ( the root's own top-level kids, or one `data-kcd-region`'s own kids ) keeps its OWN lede
       * buffer, tagged with ITS OWN region — a Know-region's intro paragraph before its first named
       * section belongs to `know`, not to the artifact-level `ledeRegion` a naive single shared buffer
       * would wrongly stamp it with.
       */
      collectRegions(root, ledeRegion) {
        const out = [];
        const visit = (kids, region) => {
          let lede = [];
          const flushLede = () => {
            if (lede.length) {
              out.push({ region, section: null, nodes: lede });
              lede = [];
            }
          };
          for (const kid of kids) {
            if (!HtmlTree_1.HtmlTree.isEl(kid)) {
              lede.push(kid);
              continue;
            }
            if (KcdAddress_1.KcdAddress.isHumanOnly(kid))
              continue;
            if (KcdAddress_1.KcdAddress.isRegion(kid)) {
              flushLede();
              const r = HtmlTree_1.HtmlTree.get(kid, "data-kcd-region") ?? region;
              visit(this.dropRegionLabel(kid.kids), r);
              continue;
            }
            if (KcdAddress_1.KcdAddress.isSection(kid)) {
              flushLede();
              out.push({
                region,
                section: HtmlTree_1.HtmlTree.get(kid, "data-kcd-section") ?? null,
                mergeKey: KcdAddress_1.KcdAddress.mergeKeyOf(kid),
                nodes: [kid]
              });
              continue;
            }
            lede.push(kid);
          }
          flushLede();
        };
        visit(root.kids, ledeRegion);
        return out;
      }
      /** The heading NUKE ( Bryan, 2026-07-13 ): raw `<h1>`–`<h6>` in an artifact body are human chrome and
       *  never ride the wire AS headings — the parser strips the whole superset up front rather than
       *  selectively sanitizing the doc title, the K/C/D labels, etc. one at a time. The ONE survivor is a
       *  heading an author marked canonical with `data-kcd-heading`; it's kept, and `block()` gives it the
       *  hash treatment at its own tag level ( `<h3 data-kcd-heading>` → `###` ). So the compiled heading
       *  structure — what heading-level folding keys on — depends only on the headings we chose to keep, never
       *  on hand-authored HTML. Recurses, so a junk / canonical heading is caught at any depth. Wire path only:
       *  the flat `project()` ( human Atlas preview ) keeps every authored heading. */
      stripNonCanonicalHeadings(nodes) {
        const out = [];
        for (const n of nodes) {
          if (!HtmlTree_1.HtmlTree.isEl(n)) {
            out.push(n);
            continue;
          }
          if (this.HEADINGS.has(n.tag) && !HtmlTree_1.HtmlTree.has(n, "data-kcd-heading"))
            continue;
          out.push({ ...n, kids: this.stripNonCanonicalHeadings(n.kids) });
        }
        return out;
      }
      /** A `data-kcd-region` wrapper's own direct-child heading is the Know/Care/Do label — build-time
       *  chrome, not content ( Bryan, 2026-07-12: strip K/C/D from compiled context entirely; the region
       *  still organizes the assembly for us — sort tier, block decomposition — it just never names itself
       *  to the agent ). Drops ONLY the region's DIRECT heading children; every `data-kcd-section` nested
       *  inside keeps its own heading, since those sit a level deeper and are not direct children here. */
      dropRegionLabel(kids) {
        return kids.filter((k) => !(HtmlTree_1.HtmlTree.isEl(k) && this.HEADINGS.has(k.tag)));
      }
      /** Walk a node array, emitting block boundaries. Containers recurse; leaf blocks emit their
       *  collapsed inline text and stop ( so a `<blockquote><p>…` is not counted twice ). */
      block(kids, out) {
        for (const kid of kids) {
          if (kid.type === "text") {
            const t = this.inline(kid);
            if (t)
              out.push(t);
            continue;
          }
          if (KcdAddress_1.KcdAddress.isHumanOnly(kid))
            continue;
          if (HtmlTree_1.HtmlTree.has(kid, "data-kcd-head"))
            continue;
          const tag = kid.tag;
          if (this.SKIP.has(tag))
            continue;
          if (KcdAddress_1.KcdAddress.isSection(kid) && HtmlTree_1.HtmlTree.get(kid, "data-kcd-section") === "tools")
            continue;
          if (KcdAddress_1.KcdAddress.isRegion(kid)) {
            this.block(this.dropRegionLabel(kid.kids), out);
            continue;
          }
          if (KcdAddress_1.KcdAddress.isSlot(kid)) {
            if (HtmlTree_1.HtmlTree.get(kid, "data-kcd-slot") === "tool")
              continue;
            out.push(this.slotLine(kid));
            continue;
          }
          if (this.HEADINGS.has(tag)) {
            out.push("", "#".repeat(Number(tag[1])) + " " + this.inline(kid), "");
            continue;
          }
          if (tag === "li") {
            out.push("- " + this.inline(kid));
            continue;
          }
          if (tag === "p" || tag === "blockquote") {
            out.push("", this.inline(kid), "");
            continue;
          }
          if (tag === "tr") {
            const cells = kid.kids.filter(HtmlTree_1.HtmlTree.isEl).map((c) => this.inline(c)).filter(Boolean);
            if (cells.length)
              out.push("- " + cells.join(" \xB7 "));
            continue;
          }
          this.block(kid.kids, out);
        }
      }
      /** A dredge/nav slot's fields, read structurally — the data half of `slotLine`, shared by the flat
       *  render path and the structured `rows` collection ( `collectRows` ) a routing merge dedupes on. */
      readSlot(slot) {
        const cells = {};
        for (const f of HtmlTree_1.HtmlTree.collect(slot, (el) => KcdAddress_1.KcdAddress.isField(el))) {
          const { key, value } = KcdAddress_1.KcdAddress.readField(f);
          if (key)
            cells[key] = value;
        }
        return { what: cells["what"] ?? "", where: cells["where"] ?? "", why: cells["why"] ?? "" };
      }
      /** A `SlotRow` → one tight line. `where` rides as a parenthesized route, not a markdown link — the
       *  agent has no browser, only the addressable path/url text, and that text is routing content, not
       *  decoration ( plan ruling ). The ONE render path — a lone slot's flat render (`slotLine`) and a
       *  routing merge's re-render of its deduped survivors both go through this, so the two can never
       *  drift into two different row shapes. */
      renderRow(row) {
        const text = [row.what, row.why].filter(Boolean).join(" \u2014 ");
        return "- " + (row.where ? `${text} (${row.where})` : text);
      }
      /** A dredge/nav slot ( `what` / `where` / `why` fields ) → one tight line. Thin: read, then render. */
      slotLine(slot) {
        return this.renderRow(this.readSlot(slot));
      }
      /** Every `data-kcd-slot` row inside a node array, structured — the data `projectBlocks` attaches to
       *  a `ContextBlock` as `rows` alongside its rendered `text`. Recurses through containers exactly
       *  like `block()` does, so a slot nested inside a `data-kcd-table` wrapper ( the normal shape ) is
       *  found regardless of nesting depth. */
      collectRows(nodes) {
        const out = [];
        const visit = (kids) => {
          for (const kid of kids) {
            if (!HtmlTree_1.HtmlTree.isEl(kid))
              continue;
            if (KcdAddress_1.KcdAddress.isHumanOnly(kid))
              continue;
            if (KcdAddress_1.KcdAddress.isSlot(kid)) {
              out.push(this.readSlot(kid));
              continue;
            }
            visit(kid.kids);
          }
        };
        visit(nodes);
        return out;
      }
      /** The four-field habit projection — the dense, agent-facing behavioral directive ( see
       *  `_habit_template` ). Reads the habit's `why` / `action` / `explanation` / `rules` sections and
       *  renders the blessed two-line grammar; a `don't`-style habit ( no `action` ) folds its rules onto
       *  line one. Pure concatenation — the authored fields are written to read correctly in the grammar,
       *  so this never rewrites text. The ONE home for the dense form: both `project()` ( flat/preview ) and
       *  `projectBlocks()` ( the wire ) route a habit through here, so a habit can never render two ways.
       *  `why` was `when` until 2026-07-13 — renamed to match the canonical What|Where|Why convention;
       *  it's the same trigger prose a lens's Why cell defers to via `mode:habit`. The rendered grammar
       *  keeps the English word "when" as a connector — only the section id / source field changed. */
      projectHabit(artifact) {
        const name = String(artifact.frontmatter["name"] ?? "").trim();
        const secs = this.habitSections(artifact.body);
        const when = secs["why"]?.text ?? "";
        const action = secs["action"]?.text ?? "";
        const explanation = secs["explanation"]?.text ?? "";
        const rules = (secs["rules"]?.items ?? []).join("; ");
        const line1 = action ? `${name} \u2014 when ${when}, execute ${action}.` : `${name} \u2014 when ${when}${rules ? `: ${rules}` : ""}.`;
        const tail = [explanation, action ? rules : ""].filter(Boolean);
        const line2 = tail.length ? `\u21B3 ${tail.join(" \xB7 ")}` : "";
        return [line1, line2].filter(Boolean).join("\n");
      }
      /** section-name → { text, items } for a flat-sectioned artifact ( a habit ). `text` is the section's
       *  prose with its heading and any list stripped; `items` is its `<li>` texts ( the rules bullets ).
       *  Human-only sections ( scaffold notes ) are skipped — they never reach the agent. */
      habitSections(html) {
        const out = {};
        if (!html || !html.trim())
          return out;
        const root = HtmlTree_1.HtmlTree.parse(html);
        for (const el of HtmlTree_1.HtmlTree.collect(root, (e) => KcdAddress_1.KcdAddress.isSection(e))) {
          if (KcdAddress_1.KcdAddress.isHumanOnly(el))
            continue;
          const name = HtmlTree_1.HtmlTree.get(el, "data-kcd-section");
          if (name)
            out[name] = this.readSection(el);
        }
        return out;
      }
      /** One section's { text, items }: prose ( paragraphs/blockquotes, the heading dropped ) joined into
       *  `text`; every `<li>` collected into `items` ( the rules bullets ). */
      readSection(el) {
        const parts = [];
        const items = [];
        const walk = (kids) => {
          for (const k of kids) {
            if (!HtmlTree_1.HtmlTree.isEl(k))
              continue;
            if (this.HEADINGS.has(k.tag))
              continue;
            if (k.tag === "li") {
              const t2 = this.inline(k);
              if (t2)
                items.push(t2);
              continue;
            }
            if (k.tag === "ul" || k.tag === "ol") {
              walk(k.kids);
              continue;
            }
            const t = this.inline(k);
            if (t)
              parts.push(t);
          }
        };
        walk(el.kids);
        return { text: parts.join(" "), items };
      }
      /** Collapse a node's whole-subtree text to a single trimmed line. */
      inline(n) {
        return HtmlTree_1.HtmlTree.textOf(n).replace(/\s+/g, " ").trim();
      }
    }();
  }
});

// ../kcd_sdk/dist/primitives/framework/KCDPrimitive.js
var require_KCDPrimitive = __commonJS({
  "../kcd_sdk/dist/primitives/framework/KCDPrimitive.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KCDPrimitive = exports2.DREDGE_MAX = void 0;
    exports2.clampDepth = clampDepth;
    exports2.classifyHref = classifyHref;
    exports2.classifyRelPath = classifyRelPath;
    var KcdParse_1 = require_KcdParse();
    var KcdEmit_1 = require_KcdEmit();
    var KcdContext_1 = require_KcdContext();
    var VaultLayout_1 = require_VaultLayout();
    exports2.DREDGE_MAX = 4;
    function clampDepth(_depth) {
      return 2;
    }
    var KCDPrimitive2 = class _KCDPrimitive {
      // ── Hydrator registry ─────────────────────────────────────────────────────
      static _hydrators = /* @__PURE__ */ new Map();
      /**
       * Register a type's wire-hydrator so `fromSerialized` rebuilds the right subclass
       * (real prototype → real getRole/toContextBlock). Registered centrally from the
       * primitives barrel, the one place that already pulls in every subclass.
       */
      static registerHydrator(type, fn) {
        _KCDPrimitive._hydrators.set(type, fn);
      }
      // ── Instance state ────────────────────────────────────────────────────────
      path;
      type;
      body;
      links;
      sections;
      frontmatter;
      isDirty;
      /** Tuned state: whether this artifact contributes to the next outbound request.
       *  Runtime tuning, not document content — rides serialization so both process
       *  copies agree, but never reaches disk. */
      isIncluded = true;
      constructor(path3, type) {
        this.path = path3;
        this.type = type;
        this.body = "";
        this.links = [];
        this.sections = {};
        this.frontmatter = {};
        this.isDirty = false;
      }
      // ── Static entry points ──────────────────────────────────────────────────
      /**
       * The HTML front end ( parser-family row 1 ): validate-first, then hydrate the right subclass.
       * The parser produces a `ParsedArtifact` ( a SerializedArtifact superset ), so the existing
       * `fromSerialized` dispatch builds the correct prototype with no md parse pipeline. A malformed
       * document never reaches here — `KcdParse.parse` throws, all-or-nothing.
       */
      static fromHtml(html, absPath) {
        return _KCDPrimitive.fromSerialized(KcdParse_1.KcdParse.parse(html, absPath));
      }
      /**
       * The HTML back end ( parser-family row 5, the inverse of `fromHtml` ): this instance's current
       * state → a full HTML document string. Regenerates frontmatter only — sections/regions/slots ride
       * through from `body` untouched ( see KcdEmit's doc comment ). Callers ( `KcdService.save` ) are
       * expected to validate the result before writing; this method does not.
       */
      toHtml() {
        return KcdEmit_1.KcdEmit.emit(this.serialize());
      }
      /**
       * Hydrate from wire JSON — dispatched by type to the registered subclass hydrator so a
       * serialized habit comes back a HabitObject, a lens a LensObject (with its nodes). Falls
       * back to a base primitive for types with no hydrator. Trusts the state as already valid;
       * this is the seam both the parser ( via fromHtml ) and the bridge cross.
       */
      static fromSerialized(json) {
        const fn = _KCDPrimitive._hydrators.get(json.type);
        if (fn)
          return fn(json);
        return _KCDPrimitive.hydrateBase(json);
      }
      /** The typeless hydration body — the fallback for types with no registered hydrator. */
      static hydrateBase(json) {
        const obj = new _KCDPrimitive(json.path, json.type);
        obj.hydrateFrom(json);
        return obj;
      }
      /** Copy the common wire fields onto a freshly-constructed instance. Every subclass
       *  hydrator runs through here — a new serialized field lands once, not ten times. */
      hydrateFrom(json) {
        this.frontmatter = { ...json.frontmatter };
        this.sections = { ...json.sections };
        this.body = json.body;
        this.links = [...json.links];
        this.isIncluded = json.included ?? true;
      }
      static collectWrites(objects) {
        const writes = {};
        for (const obj of objects) {
          if (obj.isDirty)
            writes[obj.path] = obj.serialize();
        }
        return writes;
      }
      // ── KCD role & structural validation ─────────────────────────────────────
      /**
       * This artifact's KCD role — determines which context dock it belongs to.
       * Default is 'know'. Do-role artifacts (Habit, Contract, Generator, Analyzer,
       * Utility) override to return 'do'. LensObject overrides to return 'lens'.
       */
      getRole() {
        return "know";
      }
      /**
       * Non-throwing structural validation. Conformance is enforced at parse time by the shared
       * KcdValidate ( a malformed document never becomes an object — `fromHtml` throws ), so a
       * hydrated object is valid by construction and has no per-subclass checks left to re-run.
       * Kept as the stable seam for callers ( e.g. the MCP health sweep, which already treats a
       * parse throw as the error ); returns no issues for a well-formed object.
       */
      typeCheck() {
        return [];
      }
      getPolicy() {
        return [];
      }
      // ── Serialization ────────────────────────────────────────────────────────
      serialize() {
        return {
          path: this.path,
          type: this.type,
          frontmatter: { ...this.frontmatter },
          sections: { ...this.sections },
          body: this.body,
          links: [...this.links],
          included: this.isIncluded
        };
      }
      toContextBlock() {
        return KcdContext_1.KcdContext.project(this.serialize());
      }
      // ── Contribution (tuned state) ───────────────────────────────────────────
      /** This artifact's contribution to the outbound request, per its tuned state.
       *  The atom of the recursive context query — an excluded artifact contributes
       *  nothing; everything else renders its context block. */
      contribute() {
        return this.isIncluded ? this.toContextBlock() : "";
      }
      /**
       * This artifact's region-block decomposition ( context-optimization plan, Phase 2 ) — the unit
       * `ContextAssembler` merges and sorts across a whole loaded set. An excluded artifact contributes
       * no blocks, mirroring `contribute()`. Every block here defaults to this artifact's OWN
       * `getRole()` ( `do` for habit/contract/generator/analyzer/utility, `know` for everything else ) —
       * a lens's `data-kcd-region` wrappers override that per-section inside `KcdContext.projectBlocks`.
       * `sourceLayer` defaults `'lens'` ( "part of the normal dredge graph" ); `LensObject` overrides to
       * tag its `injected` children `'injected'` instead. `habitClass` comes straight from this
       * artifact's own `habit-class` frontmatter field ( protocol §6 ) — every block a classed habit
       * contributes carries the SAME class, since the mutual-exclusion cascade resolves at the whole-
       * artifact level, not per section.
       */
      getContextBlocks() {
        if (!this.isIncluded)
          return [];
        const region = this.getRole() === "do" ? "do" : "know";
        const habitClass = this.frontmatter["habit-class"] ?? null;
        return KcdContext_1.KcdContext.projectBlocks(this.serialize(), region).map((b) => ({ ...b, sourceLayer: "lens", path: this.path, artifactType: this.type, habitClass }));
      }
      /**
       * The token COST of this artifact's contribution — literally `getContextBlocks()` priced per block, so
       * it INHERITS that method's recursion instead of re-implementing it: a leaf sums its own region blocks,
       * a `LensObject` sums its dredged + injected children's ( `getContextBlocks()` already folds them in ),
       * and no per-type override is needed for either. An excluded artifact contributes no blocks, so it costs
       * 0 by construction. Deliberately loose — a ±5% variance is expected and fine ( per-block sums run a hair
       * above a single-pile estimate ); the only EXACT count is the real wire usage the agent reads back off a
       * response. ( `Agent` is not a `KCDPrimitive` and its context carries bound env beyond
       * `getContextBlocks()`, so it defines its OWN `estimateTokens()` over its compiled blocks — the same
       * price-the-blocks shape, one level up. )
       */
      estimateTokens() {
        return this.getContextBlocks().reduce((sum, b) => sum + (b.text ? _KCDPrimitive._estimateTokens(b.text) : 0), 0);
      }
      /**
       * The one token estimator — chars ÷ 4, floored at 1 for a present-but-tiny block. Lives here beside the
       * hydrator registry + path utilities, so every artifact and both process-side `Utils` baskets share ONE
       * formula with no separate import ( the `_` marks it the shared primitive `estimateTokens()` piles text
       * into, not a public surface ). The real per-token count is a connector concern; this is the cheap,
       * always-available estimate the whole budget UI runs on. Identical to the renderer's old
       * `Utils.estimateTokens`, which now delegates here.
       */
      static _estimateTokens(text) {
        return Math.max(1, Math.round(text.length / 4));
      }
      /**
       * This artifact's FULL-body context cost — its whole projected block priced regardless of tuned state,
       * i.e. what it weighs at `suggested` mode. Distinct from `estimateTokens()`, which respects inclusion and
       * returns 0 when excluded: a composition card asks "what would this cost if it rode full-body", which is
       * this. ( The home for `Composition.contextTokens( primitive )`. )
       */
      bodyTokens() {
        return _KCDPrimitive._estimateTokens(this.toContextBlock());
      }
      /**
       * This artifact's `on`-mode ROUTING-ROW cost — the single manifest line `- {name} — {why} ({path})` it
       * reduces to when demoted from full body to a pointer. `why` is composition copy ( the lens slot's
       * description ), passed in because it lives on the lens→artifact relationship, not on the artifact
       * itself; name + path are the artifact's own. ( The home for `Composition.stubTokens( name, why, href )`. )
       */
      stubTokens(why) {
        return _KCDPrimitive._estimateTokens(`- ${this.getName()} \u2014 ${why} (${this.getPath()})`);
      }
      /**
       * This artifact's cost at a given slot mode — the ONE home for the off/on/suggested split, so every
       * composition row reads the same number the compile actually pays: `off` = 0, `on` = the routing row
       * ( `stubTokens` ), `suggested` = the full body ( `bodyTokens` ). The artifact-axis mirror of the tool
       * axis' baked per-mode counts. ( The home for `Composition.habitModeTokens( node, mode, name, why )`. )
       */
      modeTokens(mode, why = "") {
        if (mode === "off")
          return 0;
        return mode === "suggested" ? this.bodyTokens() : this.stubTokens(why);
      }
      get included() {
        return this.isIncluded;
      }
      setIncluded(on) {
        this.isIncluded = on;
      }
      // ── Getters ──────────────────────────────────────────────────────────────
      /** frontmatter.name if present, otherwise the filename stem ( extension stripped ). */
      getName() {
        const fmName = this.frontmatter["name"];
        if (typeof fmName === "string" && fmName)
          return fmName;
        const stem = this.path.split(/[\\/]/).pop() ?? "artifact";
        return stem.replace(/\.html?$/i, "");
      }
      /** Internal links as typed references — this artifact's outbound edges, classified
       *  by the same path taxonomy the dredge uses (hrefs are vault-root-relative). */
      getBacklinks() {
        const out = [];
        for (const link of this.links) {
          if (link.type !== "internal")
            continue;
          out.push({ name: link.text || link.href, type: classifyRelPath(link.href) });
        }
        return out;
      }
      getPath() {
        return this.path;
      }
      getType() {
        return this.type;
      }
      getFrontmatter() {
        return { ...this.frontmatter };
      }
      getSections() {
        return { ...this.sections };
      }
      getLinks() {
        return [...this.links];
      }
      get dirty() {
        return this.isDirty;
      }
    };
    exports2.KCDPrimitive = KCDPrimitive2;
    function classifyHref(href) {
      if (href.startsWith("#"))
        return "anchor";
      if (href.startsWith("http://") || href.startsWith("https://"))
        return "external";
      return "internal";
    }
    function classifyRelPath(rel, docRoot = "_Claude") {
      return VaultLayout_1.VaultLayout.classify(rel, docRoot);
    }
  }
});

// ../kcd_sdk/dist/primitives/framework/ContextAssembler.js
var require_ContextAssembler = __commonJS({
  "../kcd_sdk/dist/primitives/framework/ContextAssembler.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ContextAssembler = exports2.MANIFEST_SECTIONS = void 0;
    var KcdContext_1 = require_KcdContext();
    exports2.MANIFEST_SECTIONS = ["references", "domains", "habits", "contracts"];
    var MANIFEST_SECTION_SET = new Set(exports2.MANIFEST_SECTIONS);
    var KNOWLEDGE_HEADING = "# Knowledge\n_Required reading \u2014 injected in full; read all of it before acting._";
    var MANIFEST_HEADING = "# Manifest\n_Lookup surface \u2014 fetch these on demand; not required reading now._";
    var MANIFEST_TITLE = Object.fromEntries(["files", ...exports2.MANIFEST_SECTIONS].map((s) => [s, `## ${s.charAt(0).toUpperCase()}${s.slice(1)}`]));
    exports2.ContextAssembler = new class ContextAssembler {
      /** The merged + sorted list — care → memory → core → manifest → injected — before the join. The one place
       *  both `assemble()`'s text join and any future per-block projection ( e.g. token weights, the
       *  compiled-context plan's `Agent.compiledBlocks()` ) read, so inclusion can never be computed two
       *  different ways. */
      assembleBlocks(blocks) {
        return this.sort(this.merge(blocks));
      }
      /** Merge by key, sort care → memory → core → manifest → injected, then join. `sep` defaults to the
       *  separator every other context-layer join already uses ( see `Agent.SYSTEM_SEP` ). */
      assemble(blocks, sep = "\n\n---\n\n") {
        return this.assembleBlocks(blocks).map((b) => b.text).join(sep);
      }
      /** The key a block merges on — its authored `mergeKey`, or an implicit `manifest:<section>` key
       *  for a References/Habits section ( see the class doc ). `null` for anything else, which passes
       *  through unmerged as before. */
      effectiveKey(b) {
        if (b.mergeKey)
          return b.mergeKey;
        if (b.section && MANIFEST_SECTION_SET.has(b.section))
          return `manifest:${b.section}`;
        return null;
      }
      /** Blocks sharing an effective key ( see `effectiveKey` ) fuse into one; unkeyed blocks pass
       *  through untouched. A manifest key ( `manifest:<section>` ) compresses via `mergeManifest`
       *  ( rows extracted + deduped, one heading ); any other key ( an authored `data-kcd-merge-key` )
       *  keeps the original stack-the-full-texts behavior ( lens-first, then load order ). Either way
       *  the fused block's other fields ( region/section/sourceLayer/path/artifactType ) stay the FIRST
       *  occurrence's — only `text` is a function of the whole group. */
      merge(blocks) {
        const out = [];
        const groups = /* @__PURE__ */ new Map();
        const placeholder = /* @__PURE__ */ new Map();
        for (const b of blocks) {
          const key = this.effectiveKey(b);
          if (!key) {
            out.push(b);
            continue;
          }
          const existing = groups.get(key);
          if (existing) {
            existing.push(b);
            continue;
          }
          groups.set(key, [b]);
          const clone = { ...b };
          placeholder.set(key, clone);
          out.push(clone);
        }
        for (const [key, members] of groups) {
          if (key.startsWith("manifest:")) {
            const section = members[0].section ?? "";
            placeholder.get(key).text = this.mergeManifest(members, this.title(section));
            continue;
          }
          const ordered = [...members].sort((a, c) => this.lensRank(a) - this.lensRank(c));
          placeholder.get(key).text = ordered.map((m) => m.text).join("\n\n");
        }
        return out;
      }
      /** Compress N sources' manifest sections into ONE table: every member's structured `rows` ( real
       *  `SlotRow` data, not text ), deduped in a `Set` keyed on each row's actual `where` ( first-seen
       *  wins — the earliest-loaded member's framing of a shared target survives, matching the "lens's
       *  own content leads" precedence the generic merge already gives ), then rendered once via
       *  `KcdContext.renderRow` under one canonical heading. A `where`-less row ( rare — a slot with no
       *  link ) keys on its own `what`+`why` instead, since it has no other identity to dedupe by. See
       *  the class doc for why this reads structured data rather than pattern-matching rendered text. */
      mergeManifest(members, title) {
        const seen = /* @__PURE__ */ new Set();
        const lines = [];
        for (const m of members) {
          for (const row of m.rows ?? []) {
            const key = row.where || `${row.what} ${row.why}`;
            if (seen.has(key))
              continue;
            seen.add(key);
            lines.push(KcdContext_1.KcdContext.renderRow(row));
          }
        }
        return [title, ...lines].join("\n");
      }
      /** The canonical merged manifest table for one section ( `references` | `habits` ) across many source
       *  blocks — the building block of `Agent.compile`'s bottom-of-context manifest. Reuses `mergeManifest` +
       *  the canonical `MANIFEST_TITLE` so a table rendered into the manifest and one merged inline can never
       *  differ in shape. */
      manifestTable(members, section) {
        return this.mergeManifest(members, this.title(section));
      }
      /** The canonical heading for one manifest section — the single source both the merged manifest tables
       *  and the synthesized `Files` roster head read, so no caller hardcodes a `##` string. Falls back to
       *  a capitalized section name for a section not ( yet ) in `MANIFEST_TITLE`. */
      title(section) {
        return MANIFEST_TITLE[section] ?? `## ${section.charAt(0).toUpperCase()}${section.slice(1)}`;
      }
      /** A lens's own content leads within a merge group; everything else is a tie ( a stable sort
       *  then keeps them in load order ). */
      lensRank(b) {
        return b.artifactType === "lens" ? 0 : 1;
      }
      /** The sort tiers, by MEANING — care → memory → core → manifest → injected ( band model re-ratified
       *  2026-07-13: memory moved ABOVE core, "after the lenses but before knowledge"; routing renamed
       *  manifest ). Named ( not bare literals scattered through `tierOf`/`bandHeading`/`Agent.compiledBlocks` )
       *  so a caller references a tier by what it IS, and reordering one is a single edit here rather than a
       *  hunt for every magic number. Surfaced band names: care→by-kind `# Purpose` / `# Philosophy` ( no
       *  wrapper, built by `Agent.buildCareBands` ), memory→Memory, core→Knowledge, manifest→Manifest ( `bandHeading` ). */
      TIER = { care: 0, memory: 1, core: 2, manifest: 3, injected: 4 };
      /** This block's sort tier ( see `TIER` ). Exposed ( not just a `sort()`-local closure ) so
       *  `withBandHeadings` — and anything else that needs to know a tier boundary rather than just the
       *  final order — reads the exact same ranking, never a second derivation of it. */
      tierOf(b) {
        if (b.sourceLayer === "injected")
          return this.TIER.injected;
        if (b.region === "care")
          return this.TIER.care;
        if (b.section === "memory")
          return this.TIER.memory;
        if (b.section && MANIFEST_SECTION_SET.has(b.section))
          return this.TIER.manifest;
        return this.TIER.core;
      }
      /** Care ( Lenses ) first, then memory, then core content ( Knowledge ), then the manifest tables,
       *  injected last — load order preserved within each tier ( see the class doc for the full rationale ). */
      sort(blocks) {
        return blocks.map((b, i) => ({ b, i })).sort((x, y) => this.tierOf(x.b) - this.tierOf(y.b) || x.i - y.i).map((x) => x.b);
      }
      /** Display-band heading per tier ( compiled-context plan, band model re-ratified 2026-07-13 ) —
       *  deliberately NOT the internal region/tier vocabulary: "Knowledge," not "Know"/"core," since
       *  Know/Care/Do's future as internal categories is unsettled. The `care` tier gets NO wrapper heading
       *  here: care is grouped by KIND into top-level `# Purpose` / `# Philosophy` bands ( no "## Lenses"
       *  parent — Bryan's attention model: the output is grouped by kind, and each source lens is a labeled
       *  `## {lens}` sub-section under it ), built by `Agent.buildCareBands` since it knows lens names + primacy.
       *  Knowledge / Manifest carry a directive line ( forced-read vs read-on-demand ). `null` for any tier with
       *  no settled heading — including `care` ( the kind headings live one layer up ) and `injected`
       *  ( session-dropped content is NOT the plan's "Turn History" band — see Phase 6 ). */
      bandHeading(tier) {
        return {
          [this.TIER.memory]: "# Memory",
          [this.TIER.core]: KNOWLEDGE_HEADING,
          [this.TIER.manifest]: MANIFEST_HEADING
        }[tier] ?? null;
      }
      /** One synthetic heading block — no source artifact, so tagged neutrally like every other
       *  compiler-synthesized block ( the dividers, the manifest tables ). `region` defaults to `'know'`;
       *  a care-tier band/sub-heading ( the Lenses band's `### {name}` rows ) passes `'care'` so it sorts
       *  into the care tier alongside the identity prose it labels. */
      headingBlock(text, region = "know") {
        return { region, section: null, mergeKey: null, text, sourceLayer: "agent", path: "", artifactType: "unknown", habitClass: null };
      }
      /** Splice a band heading before the first block of each tier run in an ALREADY tier-sorted list
       *  ( `assembleBlocks`'s output, or any other list sharing its ordering ). A tier with no settled
       *  heading ( `bandHeading` returns `null` ) gets none; a tier with no members contributes nothing
       *  to splice around — this never invents a heading for an empty band. Kept as an explicit, opt-in
       *  step rather than folded into `assembleBlocks`/`sort` themselves, so every EXISTING caller
       *  ( `LensObject.serializeForContext`, the unit tests ) keeps its plain merged+sorted list with no
       *  behavior change; only a caller that wants display bands asks for them. */
      withBandHeadings(sorted) {
        const out = [];
        let lastTier = null;
        for (const b of sorted) {
          const t = this.tierOf(b);
          if (t !== lastTier) {
            const heading = this.bandHeading(t);
            if (heading)
              out.push(this.headingBlock(heading));
            lastTier = t;
          }
          out.push(b);
        }
        return out;
      }
    }();
  }
});

// ../kcd_sdk/dist/primitives/framework/SlotResolver.js
var require_SlotResolver = __commonJS({
  "../kcd_sdk/dist/primitives/framework/SlotResolver.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SlotResolver = void 0;
    var ContextAssembler_1 = require_ContextAssembler();
    exports2.SlotResolver = new class SlotResolver {
      /** Specificity ranking — lower wins a class. `injected` ( session-dropped ) is most specific, then
       *  `agent` ( a component the agent bolts on itself — its own base-habit choice ), then `lens` ( what
       *  a lens contributes ). So an agent's habit supersedes the lens's in a contended slot: the
       *  composability of behaviour. The plan's Constellation layer ( between injected and agent ) stays
       *  unrealized — no distinct tag exists yet. Every ranking decision reads through `rank()`, so adding
       *  it later is a one-line edit, not a redesign. */
      RANK = { injected: 0, agent: 1, lens: 2 };
      rank(layer) {
        return this.RANK[layer];
      }
      /**
       * THE shared computation. The CANDIDATE unit is one ARTIFACT ( grouped by `path` ), not one
       * block — a classed habit routinely emits several blocks ( its head, its `when`, its `action`,
       * … ), and those must all stand or fall together, never compete against EACH OTHER as if they
       * were rival occupants of the same slot. For each `habitClass`, groups its blocks by `path`
       * first, picks the winning artifact ( lowest-rank source layer; the first-encountered artifact
       * breaks a same-rank tie ), then filters the ORIGINAL block list down to classless blocks plus
       * EVERY block belonging to each class's one winning artifact, preserving load order throughout.
       */
      compilePlan(blocks) {
        const byClass = /* @__PURE__ */ new Map();
        for (const b of blocks) {
          if (!b.habitClass)
            continue;
          if (!byClass.has(b.habitClass))
            byClass.set(b.habitClass, /* @__PURE__ */ new Map());
          const byPath = byClass.get(b.habitClass);
          if (!byPath.has(b.path))
            byPath.set(b.path, []);
          byPath.get(b.path).push(b);
        }
        const winningPathOf = /* @__PURE__ */ new Map();
        const slots = [];
        for (const [habitClass, byPath] of byClass) {
          const candidates = [...byPath.values()].map((bs) => bs[0]);
          const winner = candidates.reduce((best, m) => this.rank(m.sourceLayer) < this.rank(best.sourceLayer) ? m : best);
          winningPathOf.set(habitClass, winner.path);
          slots.push({
            habitClass,
            winner: this.toCandidate(winner, true),
            candidates: candidates.map((m) => this.toCandidate(m, m.path === winner.path))
          });
        }
        const survivors = blocks.filter((b) => !b.habitClass || winningPathOf.get(b.habitClass) === b.path);
        return { slots, survivors };
      }
      toCandidate(b, won) {
        return { path: b.path, artifactType: b.artifactType, sourceLayer: b.sourceLayer, won };
      }
      /** The visualization view — every slot's candidates and winner. A thin read of `compilePlan()`;
       *  never a separately-derived computation. */
      describe(blocks) {
        return this.compilePlan(blocks).slots;
      }
      /** The actual compilation an orchestrator consumes: losing habit-class members dropped, the
       *  survivors merged (`data-kcd-merge-key`) and sorted (Care-first, injected-last) by
       *  `ContextAssembler`. */
      compile(blocks, sep = "\n\n---\n\n") {
        return ContextAssembler_1.ContextAssembler.assemble(this.compilePlan(blocks).survivors, sep);
      }
    }();
  }
});

// ../kcd_sdk/dist/primitives/framework/LensObject.js
var require_LensObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/LensObject.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.LensObject = void 0;
    var path3 = __importStar(require("path"));
    var KCDPrimitive_1 = require_KCDPrimitive();
    var SlotResolver_1 = require_SlotResolver();
    var LENS_DEFAULT_DEPTH = 2;
    var DISK_IS_MAIN_ONLY = (absPath) => {
      throw new Error(`LensObject.read: disk read is a main-process capability (path: ${absPath})`);
    };
    var LensObject = class _LensObject extends KCDPrimitive_1.KCDPrimitive {
      // ── Path resolution utilities ─────────────────────────────────────────────
      static DEFAULT_DOC_ROOT = "_Claude";
      // inferProjectRoot moved node-side (it needs fs) → @kcd/node `inferProjectRoot`.
      static resolveHref(href, projectRoot) {
        return path3.resolve(projectRoot, href);
      }
      /** Absolute path → ArtifactType. A thin wrapper: relativize, then the one shared taxonomy. */
      static classifyByPath(absPath, projectRoot, docRoot = _LensObject.DEFAULT_DOC_ROOT) {
        return (0, KCDPrimitive_1.classifyRelPath)(path3.relative(projectRoot, absPath), docRoot);
      }
      // ── Spine state ───────────────────────────────────────────────────────────
      policy = [];
      nodes = [];
      /** Dynamically injected Know nodes — dropped onto the agent at session time (the
       *  GUI equivalent of pasting context into a chat window). NOT dredged from the lens
       *  markdown; kept apart from `nodes` so a re-dredge never clobbers them and so they
       *  serialize distinctly (they ride the wire but never reach disk). They contribute
       *  as always-loaded Know — see getNodes / addInjected. */
      injected = [];
      /** Per-tool three-state inclusion the lens CONTRIBUTES ( tool name → mode ), parsed from the lens's
       *  Tools table. Unlike references/habits a tool is not a dredged node, so it lives here, not in `nodes`.
       *  The composition baseline an agent's own `toolModes` overrides per-tool ( Agent.effectiveToolModes ). */
      toolModes = {};
      projectRoot;
      dredgeDepth = LENS_DEFAULT_DEPTH;
      /** When set, the dredge follows conditional (non-`always`) links too, marking
       *  them not-included. See LensLoadOptions.eager — the display-vs-context axis. */
      eager = false;
      /** Injected disk capability (Strategy). Default throws — main attaches a real reader at load(). */
      read = DISK_IS_MAIN_ONLY;
      constructor(filePath) {
        super(filePath, "lens");
      }
      // ── Static entry points ──────────────────────────────────────────────────
      static load(lensPath, opts) {
        const abs = path3.resolve(lensPath);
        const raw = opts.read(abs);
        const lens = KCDPrimitive_1.KCDPrimitive.fromHtml(raw, abs);
        lens.projectRoot = opts.projectRoot;
        lens.read = opts.read;
        lens.eager = opts.eager ?? false;
        const depth = (0, KCDPrimitive_1.clampDepth)(opts.depth ?? lens.dredgeDepth);
        lens.nodes = lens.dredgeFrom(lens, depth, /* @__PURE__ */ new Set([abs])).slice(1);
        return lens;
      }
      /**
       * Rebuild a lens from wire JSON — and recurse: each dredged child is hydrated through its
       * OWN registered fromSerialized, so a habit comes back a HabitObject. `nodes` is absent on a
       * shallow (non-dredged) serialization; an empty graph is the honest result there.
       */
      static fromSerialized(json) {
        const obj = new _LensObject(json.path);
        obj.hydrateFrom(json);
        obj.policy = json.policy ?? [];
        const children = json.nodes ?? [];
        obj.nodes = children.map((n) => KCDPrimitive_1.KCDPrimitive.fromSerialized(n));
        const injected = json.injected ?? [];
        obj.injected = injected.map((n) => KCDPrimitive_1.KCDPrimitive.fromSerialized(n));
        obj.toolModes = { ...json.toolModes ?? {} };
        return obj;
      }
      /** Carry policy on the wire. The receiver prefers it over re-deriving — load-bearing for an
       *  HTML lens, whose sections hold inner HTML, not a re-parseable markdown dredge table. */
      serialize() {
        return { ...super.serialize(), policy: [...this.policy] };
      }
      /** The wire form for crossing the bridge: this lens plus its dredged children and any
       *  injected nodes (each serialized, children only — the lens isn't its own child). The
       *  receiver rebuilds via fromSerialized. */
      serializeForWire() {
        return {
          ...this.serialize(),
          nodes: this.nodes.map((n) => n.serialize()),
          injected: this.injected.map((n) => n.serialize()),
          toolModes: { ...this.toolModes }
        };
      }
      // ── Dredge orchestration ──────────────────────────────────────────────────
      dredgeFrom(node, remaining, visited) {
        const out = [node];
        if (remaining <= 1)
          return out;
        for (const entry of node.getPolicy()) {
          if (entry.type !== "internal")
            continue;
          if (entry.mode === "off")
            continue;
          if (!this.eager)
            continue;
          const childAbs = _LensObject.resolveHref(entry.href, this.projectRoot);
          if (_LensObject.classifyByPath(childAbs, this.projectRoot) === "plan")
            continue;
          if (visited.has(childAbs))
            continue;
          visited.add(childAbs);
          let child;
          try {
            const raw = this.read(childAbs);
            child = KCDPrimitive_1.KCDPrimitive.fromHtml(raw, childAbs);
          } catch {
            continue;
          }
          child.setIncluded(entry.mode === "suggested");
          out.push(...this.dredgeFrom(child, remaining - 1, visited));
        }
        return out;
      }
      // ── Policy ────────────────────────────────────────────────────────────────
      // The dredge policy is computed by the parser ( know-region slots, the `always` gate ) and
      // rides the wire; the lens just exposes it. The markdown Know-table parse is gone.
      getPolicy() {
        return [...this.policy];
      }
      /** The vault root this lens was loaded against — the base every loaded file's path is relativized to
       *  for the compiled manifest. Undefined on a wire-hydrated lens ( render never dredges ). */
      getProjectRoot() {
        return this.projectRoot;
      }
      /** An absolute path in vault-relative, forward-slashed form — the file's ID in the compiled manifest
       *  ( Bryan, 2026-07-12: vault-relative paths, no project-resolution magic yet ). Passthrough when no
       *  projectRoot is known. */
      vaultRelative(abs) {
        return this.projectRoot ? path3.relative(this.projectRoot, abs).replace(/\\/g, "/") : abs;
      }
      /** The full Know graph: dredged children plus any session-injected nodes. The single
       *  percolation point — the spiral, the count, Composition, and contribute() all read
       *  through here, so injected context appears everywhere with no per-consumer wiring. */
      getNodes() {
        return [...this.nodes, ...this.injected];
      }
      /** The context contributors in order: the lens itself, then every node (dredged + injected). */
      getContributors() {
        return [this, ...this.getNodes()];
      }
      /**
       * Inject a Know node at session time — the GUI "drop context onto the agent" hook
       * (equivalent to pasting context into a chat window). The node joins the Know graph
       * as always-loaded context: it shows in the spiral/count and rides contribute(). Not
       * dredged, not written to disk — it lives only on the live object and its wire form.
       * Forces included on; a dropped item is an intent to load.
       */
      addInjected(node) {
        node.setIncluded(true);
        this.injected.push(node);
      }
      /** The per-tool modes this lens contributes ( tool name → mode ) — the composition baseline the agent
       *  layers its own `toolModes` over. A tool is not a node, so this is its own read, not `getNodes()`. */
      getToolModes() {
        return { ...this.toolModes };
      }
      getRole() {
        return "lens";
      }
      // ── Context assembly ──────────────────────────────────────────────────────
      /**
       * This lens's full region-block set ( context-optimization plan, Phase 2 ) — its own Know/Care/Do
       * content, then each dredged node's blocks, then the "Available on request" stub (if any), then
       * each INJECTED node's blocks retagged `sourceLayer: 'injected'`. `ContextAssembler` does the
       * actual Care-hoist / injected-sink sort; this method only needs to get injected blocks tagged
       * correctly, since `getNodes()`'s simple append-order is no longer what guarantees "injected
       * last" once multiple lenses are in play.
       */
      /**
       * A lens's region-block set for the compiled context. The MODEL ( ruling corrected, Bryan 2026-07-12,
       * superseding the overzealous "links-only for `suggested`" framing ): a slot's mode is a
       * suggestion surface, NOT a fetch policy — `off` excludes; `on` is the DECK POINTER ( a routing ROW
       * only, ~90% of habits live here ); `suggested` is an IMPLICIT INJECTION — the target's body rides,
       * a deliberate "this one matters" highlight the user operates. A session-INJECTED node is the same
       * force by another door ( retagged `injected` ). A habit body that rides projects to the dense
       * four-field form ( `KcdContext.projectHabit` ), never a raw file dump. Routing rows render from this
       * lens's own section ( `references` / `habits` / `contracts` ) and hoist into the bottom-of-context
       * manifest ( `Agent.compile` ); the agent reads a deck file by its manifest path on demand.
       *
       * ⚠ The `dredgeFrom` mechanism BELOW is mid-rework and does NOT yet cleanly realize this model for
       * every mode ( it half-fetches, half-links ). Dredge is being redesigned around this behavior and is
       * NOT canonical for habits — do not treat the current fetch/links split as the intended contract.
       */
      getContextBlocks() {
        if (!this.isIncluded)
          return [];
        const own = super.getContextBlocks();
        const dredged = this.nodes.flatMap((n) => n.getContextBlocks());
        const injected = this.injected.flatMap((n) => n.getContextBlocks()).map((b) => ({ ...b, sourceLayer: "injected" }));
        const stub = this.stubBlock();
        return [...own, ...dredged, ...stub ? [stub] : [], ...injected];
      }
      /** The "Available on request" stub — every `on`-mode internal link this lens's policy names (the
       *  routing-row case, any artifact type), plus any `suggested` link the current dredge depth
       *  didn't reach. One synthetic block, folded into `getContextBlocks()` so the unified assembler
       *  sees it like any other contribution instead of `serializeForContext()` special-casing it.
       *  `off`-mode links never appear here — the user excluded them entirely, not just deferred them.
       *  Silently omitted (not thrown) with no projectRoot — a display nicety, not something that
       *  should crash a context call from an unloaded lens.
       *
       *  Dedupe is against CONTRIBUTING paths ( `.included`, i.e. `suggested` content already rendered
       *  full-body elsewhere ), not merely FETCHED paths — Bryan, 2026-07-13: an `on`-mode habit is
       *  fetched too ( `dredgeFrom` needs its `habit-class` regardless of mode ) but contributes nothing
       *  to `getContextBlocks()` while excluded; the old "already loaded ⇒ skip" filter caught that
       *  fetch-for-metadata case and silently dropped the row it was the ONLY source for. */
      stubBlock() {
        if (!this.projectRoot)
          return null;
        const included = new Set(this.getContributors().filter((n) => n.included).map((n) => n.getPath()));
        const byPath = new Map(this.nodes.map((n) => [n.getPath(), n]));
        const stubs = this.policy.filter((e) => e.type === "internal" && e.mode !== "off" && !included.has(_LensObject.resolveHref(e.href, this.projectRoot)));
        if (!stubs.length)
          return null;
        const rows = stubs.map((e) => {
          const why = _LensObject.resolveWhy(e, byPath.get(_LensObject.resolveHref(e.href, this.projectRoot)));
          return `- ${e.what} \u2014 ${why} (${e.href})`;
        }).join("\n");
        return { region: "know", section: "stub", mergeKey: null, text: `# Available on request

${rows}`, sourceLayer: "lens", path: this.path, artifactType: "lens", habitClass: null };
      }
      /** The reason text a routing/stub row shows. The Care-table Why cell is now a tri-state: real
       *  hand-written prose is an override and rides as-is; `always`, `habit`, or an empty cell are all
       *  "no override" sentinels — Bryan, 2026-07-13 — that DEFER to the target's own declared `why`
       *  ( `habit` is the authoring default, so most rows never restate a reason at all ). Duck-typed
       *  ( `getWhy` ) rather than importing `HabitObject` here — only habits carry this field today, and
       *  the check degrades safely for any other artifact type or an unfetched target. */
      static resolveWhy(entry, node) {
        const cell = entry.why.trim().toLowerCase();
        const isSentinel = cell === "" || cell === "habit" || cell === "always";
        if (!isSentinel)
          return entry.why;
        const getWhy = node?.getWhy;
        const why = typeof getWhy === "function" ? getWhy.call(node) : "";
        return why || entry.why;
      }
      serializeForContext() {
        if (!this.projectRoot)
          throw new Error("serializeForContext requires a loaded lens (no projectRoot)");
        return SlotResolver_1.SlotResolver.compile(this.getContextBlocks());
      }
    };
    exports2.LensObject = LensObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/FrameworkObject.js
var require_FrameworkObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/FrameworkObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FrameworkObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var FrameworkObject = class _FrameworkObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "framework");
      }
      static fromSerialized(json) {
        const obj = new _FrameworkObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
    };
    exports2.FrameworkObject = FrameworkObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/PlanObject.js
var require_PlanObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/PlanObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PlanObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var PlanObject = class _PlanObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "plan");
      }
      static fromSerialized(json) {
        const obj = new _PlanObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
    };
    exports2.PlanObject = PlanObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/IndexObject.js
var require_IndexObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/IndexObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.IndexObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var IndexObject = class _IndexObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "nav-index");
      }
      static fromSerialized(json) {
        const obj = new _IndexObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
    };
    exports2.IndexObject = IndexObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/ReferenceObject.js
var require_ReferenceObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/ReferenceObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ReferenceObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var KcdContext_1 = require_KcdContext();
    var ReferenceObject = class _ReferenceObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "reference");
      }
      static fromSerialized(json) {
        const obj = new _ReferenceObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      /** This reference's own `why` section, if it has one — the SAME "default inclusion reason, defer
       *  unless overridden" pattern habits got ( `HabitObject.getWhy`, 2026-07-13 ), extended to references
       *  per Bryan: "this is actually a pattern we will be using on the references later." OPTIONAL, unlike
       *  a habit's ( references stay free-form, no required structure ) — `LensObject.resolveWhy()` is
       *  already duck-typed on `getWhy`, so an empty string here just falls through to its existing
       *  fallback ( the lens's own hand-written Why cell, or nothing ) with zero regression for a reference
       *  that hasn't been migrated to carry one yet. */
      getWhy() {
        return KcdContext_1.KcdContext.habitSections(this.body)["why"]?.text ?? "";
      }
    };
    exports2.ReferenceObject = ReferenceObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/TemplateObject.js
var require_TemplateObject = __commonJS({
  "../kcd_sdk/dist/primitives/framework/TemplateObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TemplateObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var TemplateObject = class _TemplateObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "template");
      }
      static fromSerialized(json) {
        const obj = new _TemplateObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
    };
    exports2.TemplateObject = TemplateObject;
  }
});

// ../kcd_sdk/dist/primitives/framework/index.js
var require_framework = __commonJS({
  "../kcd_sdk/dist/primitives/framework/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TemplateObject = exports2.ReferenceObject = exports2.IndexObject = exports2.PlanObject = exports2.FrameworkObject = exports2.SlotResolver = exports2.ContextAssembler = exports2.LensObject = exports2.classifyRelPath = exports2.classifyHref = exports2.clampDepth = exports2.DREDGE_MAX = exports2.KCDPrimitive = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    Object.defineProperty(exports2, "KCDPrimitive", { enumerable: true, get: function() {
      return KCDPrimitive_1.KCDPrimitive;
    } });
    Object.defineProperty(exports2, "DREDGE_MAX", { enumerable: true, get: function() {
      return KCDPrimitive_1.DREDGE_MAX;
    } });
    Object.defineProperty(exports2, "clampDepth", { enumerable: true, get: function() {
      return KCDPrimitive_1.clampDepth;
    } });
    Object.defineProperty(exports2, "classifyHref", { enumerable: true, get: function() {
      return KCDPrimitive_1.classifyHref;
    } });
    Object.defineProperty(exports2, "classifyRelPath", { enumerable: true, get: function() {
      return KCDPrimitive_1.classifyRelPath;
    } });
    var LensObject_1 = require_LensObject();
    Object.defineProperty(exports2, "LensObject", { enumerable: true, get: function() {
      return LensObject_1.LensObject;
    } });
    var ContextAssembler_1 = require_ContextAssembler();
    Object.defineProperty(exports2, "ContextAssembler", { enumerable: true, get: function() {
      return ContextAssembler_1.ContextAssembler;
    } });
    var SlotResolver_1 = require_SlotResolver();
    Object.defineProperty(exports2, "SlotResolver", { enumerable: true, get: function() {
      return SlotResolver_1.SlotResolver;
    } });
    var FrameworkObject_1 = require_FrameworkObject();
    Object.defineProperty(exports2, "FrameworkObject", { enumerable: true, get: function() {
      return FrameworkObject_1.FrameworkObject;
    } });
    var PlanObject_1 = require_PlanObject();
    Object.defineProperty(exports2, "PlanObject", { enumerable: true, get: function() {
      return PlanObject_1.PlanObject;
    } });
    var IndexObject_1 = require_IndexObject();
    Object.defineProperty(exports2, "IndexObject", { enumerable: true, get: function() {
      return IndexObject_1.IndexObject;
    } });
    var ReferenceObject_1 = require_ReferenceObject();
    Object.defineProperty(exports2, "ReferenceObject", { enumerable: true, get: function() {
      return ReferenceObject_1.ReferenceObject;
    } });
    var TemplateObject_1 = require_TemplateObject();
    Object.defineProperty(exports2, "TemplateObject", { enumerable: true, get: function() {
      return TemplateObject_1.TemplateObject;
    } });
  }
});

// ../kcd_sdk/dist/primitives/procedure/AnalyzerObject.js
var require_AnalyzerObject = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/AnalyzerObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.AnalyzerObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var AnalyzerObject = class _AnalyzerObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "analyzer");
      }
      static fromSerialized(json) {
        const obj = new _AnalyzerObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      getRole() {
        return "do";
      }
    };
    exports2.AnalyzerObject = AnalyzerObject;
  }
});

// ../kcd_sdk/dist/primitives/procedure/ContractObject.js
var require_ContractObject = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/ContractObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ContractObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var ContractObject = class _ContractObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "contract");
      }
      static fromSerialized(json) {
        const obj = new _ContractObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      getRole() {
        return "do";
      }
    };
    exports2.ContractObject = ContractObject;
  }
});

// ../kcd_sdk/dist/primitives/procedure/GeneratorObject.js
var require_GeneratorObject = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/GeneratorObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.GeneratorObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var GeneratorObject = class _GeneratorObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "generator");
      }
      static fromSerialized(json) {
        const obj = new _GeneratorObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      getRole() {
        return "do";
      }
    };
    exports2.GeneratorObject = GeneratorObject;
  }
});

// ../kcd_sdk/dist/primitives/procedure/HabitObject.js
var require_HabitObject = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/HabitObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.HabitObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var KcdContext_1 = require_KcdContext();
    var HabitObject = class _HabitObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "habit");
      }
      static fromSerialized(json) {
        const obj = new _HabitObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      getRole() {
        return "do";
      }
      /** This habit's own `why` section — the SAME trigger prose the dense `suggested` form folds
       *  into line one, read standalone so a lens's Why cell can default to it ( `mode:habit` ) without
       *  fetching the full body into context. A cheap parse of a section already in memory ( this habit
       *  was fetched to learn its `habit-class` regardless of mode ) — not a second dredge. */
      getWhy() {
        return KcdContext_1.KcdContext.habitSections(this.body)["why"]?.text ?? "";
      }
    };
    exports2.HabitObject = HabitObject;
  }
});

// ../kcd_sdk/dist/primitives/procedure/UtilityObject.js
var require_UtilityObject = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/UtilityObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UtilityObject = void 0;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var UtilityObject = class _UtilityObject extends KCDPrimitive_1.KCDPrimitive {
      constructor(filePath) {
        super(filePath, "utility");
      }
      static fromSerialized(json) {
        const obj = new _UtilityObject(json.path);
        obj.hydrateFrom(json);
        return obj;
      }
      getRole() {
        return "do";
      }
      // ── Typed frontmatter accessors ──────────────────────────────────────────
      // The basic properties a utility is expected to carry. `name` comes from the base
      // ( getName ); the rest are surfaced here so consumers read a utility's shape without
      // reaching into the raw frontmatter bag.
      /** Human-facing summary — what the tool does. Empty string when absent. */
      getDescription() {
        return String(this.frontmatter["description"] ?? "");
      }
      /** Lifecycle tier: `'draft'` (proposed) or `'deployed'` (approved + runnable). */
      getStatus() {
        return String(this.frontmatter["status"] ?? "");
      }
      /** The utility's parameters — user-set inputs (NODE-set, never agent-set: the security
       *  barrier). Stored as a comma/space-separated `params` list; returned split, [] when absent.
       *  These are the seed of the general `parameters` idiom (a SettingField-typed variable). */
      getParams() {
        const raw = this.frontmatter["params"];
        if (!raw)
          return [];
        return String(raw).split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
      }
    };
    exports2.UtilityObject = UtilityObject;
  }
});

// ../kcd_sdk/dist/primitives/procedure/index.js
var require_procedure = __commonJS({
  "../kcd_sdk/dist/primitives/procedure/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UtilityObject = exports2.HabitObject = exports2.GeneratorObject = exports2.ContractObject = exports2.AnalyzerObject = void 0;
    var AnalyzerObject_1 = require_AnalyzerObject();
    Object.defineProperty(exports2, "AnalyzerObject", { enumerable: true, get: function() {
      return AnalyzerObject_1.AnalyzerObject;
    } });
    var ContractObject_1 = require_ContractObject();
    Object.defineProperty(exports2, "ContractObject", { enumerable: true, get: function() {
      return ContractObject_1.ContractObject;
    } });
    var GeneratorObject_1 = require_GeneratorObject();
    Object.defineProperty(exports2, "GeneratorObject", { enumerable: true, get: function() {
      return GeneratorObject_1.GeneratorObject;
    } });
    var HabitObject_1 = require_HabitObject();
    Object.defineProperty(exports2, "HabitObject", { enumerable: true, get: function() {
      return HabitObject_1.HabitObject;
    } });
    var UtilityObject_1 = require_UtilityObject();
    Object.defineProperty(exports2, "UtilityObject", { enumerable: true, get: function() {
      return UtilityObject_1.UtilityObject;
    } });
  }
});

// ../kcd_sdk/dist/primitives/types.js
var require_types = __commonJS({
  "../kcd_sdk/dist/primitives/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SLOT_MODES = void 0;
    exports2.SLOT_MODES = ["off", "on", "suggested"];
  }
});

// ../kcd_sdk/dist/primitives/index.js
var require_primitives = __commonJS({
  "../kcd_sdk/dist/primitives/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SLOT_MODES = exports2.KCDValidationError = exports2.KCDParseError = void 0;
    __exportStar(require_framework(), exports2);
    __exportStar(require_procedure(), exports2);
    var errors_1 = require_errors();
    Object.defineProperty(exports2, "KCDParseError", { enumerable: true, get: function() {
      return errors_1.KCDParseError;
    } });
    Object.defineProperty(exports2, "KCDValidationError", { enumerable: true, get: function() {
      return errors_1.KCDValidationError;
    } });
    var types_1 = require_types();
    Object.defineProperty(exports2, "SLOT_MODES", { enumerable: true, get: function() {
      return types_1.SLOT_MODES;
    } });
    var KCDPrimitive_1 = require_KCDPrimitive();
    var LensObject_1 = require_LensObject();
    var PlanObject_1 = require_PlanObject();
    var IndexObject_1 = require_IndexObject();
    var ReferenceObject_1 = require_ReferenceObject();
    var FrameworkObject_1 = require_FrameworkObject();
    var TemplateObject_1 = require_TemplateObject();
    var HabitObject_1 = require_HabitObject();
    var ContractObject_1 = require_ContractObject();
    var GeneratorObject_1 = require_GeneratorObject();
    var AnalyzerObject_1 = require_AnalyzerObject();
    var UtilityObject_1 = require_UtilityObject();
    KCDPrimitive_1.KCDPrimitive.registerHydrator("lens", LensObject_1.LensObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("plan", PlanObject_1.PlanObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("nav-index", IndexObject_1.IndexObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("index", IndexObject_1.IndexObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("reference", ReferenceObject_1.ReferenceObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("framework", FrameworkObject_1.FrameworkObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("template", TemplateObject_1.TemplateObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("habit", HabitObject_1.HabitObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("contract", ContractObject_1.ContractObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("generator", GeneratorObject_1.GeneratorObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("analyzer", AnalyzerObject_1.AnalyzerObject.fromSerialized);
    KCDPrimitive_1.KCDPrimitive.registerHydrator("utility", UtilityObject_1.UtilityObject.fromSerialized);
  }
});

// ../kcd_sdk/dist/agent/Model.js
var require_Model = __commonJS({
  "../kcd_sdk/dist/agent/Model.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_MODEL_KEY = void 0;
    exports2.DEFAULT_MODEL_KEY = "test.lorem";
  }
});

// ../kcd_sdk/dist/agent/Agent.js
var require_Agent = __commonJS({
  "../kcd_sdk/dist/agent/Agent.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Agent = void 0;
    var LensObject_1 = require_LensObject();
    var SlotResolver_1 = require_SlotResolver();
    var ContextAssembler_1 = require_ContextAssembler();
    var KcdContext_1 = require_KcdContext();
    var KCDPrimitive_1 = require_KCDPrimitive();
    var Model_1 = require_Model();
    function _pathsOfType(nodes, type) {
      return nodes.filter((n) => n.getType() === type).map((n) => n.getPath());
    }
    function _union(base, composed) {
      return [.../* @__PURE__ */ new Set([...base, ...composed])];
    }
    var Agent = class _Agent {
      id;
      name;
      icon;
      color;
      model;
      systemPrompt;
      /** The composed lenses (materialized graphs). `[]` = draft; `[0]` = primary. */
      lenses;
      // ── base{X}: bolted directly here; dumb strings; the user's add/subtract surface ──
      baseTools;
      baseHabits;
      baseReferences;
      basePlans;
      /** Per-tool three-state inclusion, keyed by tool name (see SerializedAgent.toolModes). */
      toolModes;
      /** On/off exclusion sets for the agent's own base references/habits (see SerializedAgent.referenceOff). */
      referenceOff;
      habitOff;
      /** Per-reference override — EITHER a lens-inherited reference OR one of this agent's own `baseReferences`
       *  (see SerializedAgent.referenceModes). Absent key = inherit; present = the agent forces off/on/suggested. */
      referenceModes;
      /** Per-habit override of an INHERITED lens habit's slot mode (see SerializedAgent.habitModes). Absent
       *  key = inherit the lens's mode; present = the agent forces off/on/suggested. */
      habitModes;
      fields;
      system;
      // ── Runtime identity ──
      createdAt;
      folder;
      notes;
      // ── composed{X}: MATERIALIZED by compose(); never persisted, never crosses the wire ──
      composedTools = [];
      composedHabits = [];
      composedReferences = [];
      composedPlans = [];
      /** Per-tool modes CONTRIBUTED by the lenses ( tool name → mode ), materialized in compose() from each
       *  lens's `getToolModes()`. The composition baseline; `effectiveToolModes()` overlays this agent's own
       *  authored `toolModes` on top, agent-wins-per-tool. Never persisted — rebuilt from the lenses. */
      composedToolModes = {};
      /**
       * The agent's OWN base habits as LOADED objects ( the `agent` source layer at composition ). Disk is
       * a main capability, so main materializes these from `baseHabits` ( the paths ) and they ride the wire
       * for the renderer's structured view. Never persisted to the DB ( `baseHabits` is ) — rebuilt from the
       * paths on every load/save so it can't go stale. Empty until materialized ( a draft, or a bare wire ). */
      baseHabitNodes = [];
      /** The agent's OWN base references as LOADED objects — the reference sibling of `baseHabitNodes`,
       *  identical shape and identical reason. Never persisted; rebuilt from `baseReferences` on every
       *  load/save. Empty until materialized ( a draft, or a bare wire ). */
      baseReferenceNodes = [];
      // ── Bound environment: the wire's EXTERNAL layers, injected post-hydration ( `bindEnv` ) ──
      // The three inputs the compiled context needs that aren't the agent's own object graph: the
      // model-bound root context, the live MCP tool defs ( for the manifest + suggested surface ), and the
      // baseline PRELOAD memory. Set from OUTSIDE ( the renderer's Agent store, the main orchestrator ) the
      // same way `baseHabitNodes` is — never persisted, never crosses the wire, flush-and-filled on change.
      // With these bound, the agent answers `compiledContext()`/`wireSystem()`/`estimateTokens()` ALONE.
      /** The model-bound root-context text ( CLAUDE.md / Winston.html et al. ) — leads the compiled context.
       *  '' when the agent's model declares none. */
      rootContext = "";
      /** The live tool defs available to this agent — the flat set the manifest + suggested surface read,
       *  each carrying its BAKED per-mode counts. Bound from the MCP store; `[]` until bound. */
      toolDefs = [];
      /** The baseline PRELOAD memory prose ( the system-fired top-N selection ). Rides only when the agent's
       *  own `system.memoryEnabled` gate is on. '' until bound / when the query came back dry. */
      memory = "";
      constructor(id, name, icon, color, model, systemPrompt, lenses, baseTools, baseHabits, baseReferences, basePlans, toolModes, referenceOff, referenceModes, habitOff, habitModes, fields, system, createdAt, folder, notes) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.color = color;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.lenses = lenses;
        this.baseTools = baseTools;
        this.baseHabits = baseHabits;
        this.baseReferences = baseReferences;
        this.basePlans = basePlans;
        this.toolModes = toolModes;
        this.referenceOff = referenceOff;
        this.referenceModes = referenceModes;
        this.habitOff = habitOff;
        this.habitModes = habitModes;
        this.fields = fields;
        this.system = system;
        this.createdAt = createdAt;
        this.folder = folder;
        this.notes = notes;
        this.compose();
      }
      // ── Static entry points ──────────────────────────────────────────────────
      /** Compose an agent. A lensless draft is legal — running is what demands a lens. */
      static create(opts = {}) {
        const lenses = opts.lenses ?? [];
        return new _Agent(opts.id ?? crypto.randomUUID(), opts.name ?? lenses[0]?.getName() ?? "agent", opts.icon ?? null, opts.color ?? null, opts.model ?? Model_1.DEFAULT_MODEL_KEY, opts.systemPrompt ?? null, lenses, opts.baseTools ?? [], opts.baseHabits ?? [], opts.baseReferences ?? [], opts.basePlans ?? [], opts.toolModes ?? {}, opts.referenceOff ?? [], opts.referenceModes ?? {}, opts.habitOff ?? [], opts.habitModes ?? {}, opts.fields ?? [], opts.system ?? {}, Date.now(), opts.folder, opts.notes ?? null);
      }
      /** Rebuild from the wire / DB seed — each lens hydrates through its own registered hydrator;
       *  the constructor re-runs compose() so the materialized graph arrives fresh, never stale. */
      static fromSerialized(json) {
        const lenses = (json.lenses ?? []).map((l) => LensObject_1.LensObject.fromSerialized(l));
        const agent = new _Agent(json.id, json.name, json.icon, json.color, json.model ?? Model_1.DEFAULT_MODEL_KEY, json.systemPrompt ?? null, lenses, json.baseTools ?? [], json.baseHabits ?? [], json.baseReferences ?? [], json.basePlans ?? [], json.toolModes ?? {}, json.referenceOff ?? [], json.referenceModes ?? {}, json.habitOff ?? [], json.habitModes ?? {}, json.fields ?? [], json.system ?? {}, json.createdAt, json.folder, json.notes ?? null);
        agent.baseHabitNodes = (json.baseHabitNodes ?? []).map((n) => KCDPrimitive_1.KCDPrimitive.fromSerialized(n));
        agent.baseReferenceNodes = (json.baseReferenceNodes ?? []).map((n) => KCDPrimitive_1.KCDPrimitive.fromSerialized(n));
        return agent;
      }
      /** One function, many purposes: the bridge wire form, the save form, the reconstruction source.
       *  Ships base strings + serialized lenses only — composed{X} is rebuilt on arrival. */
      serializeForWire() {
        return {
          id: this.id,
          name: this.name,
          icon: this.icon,
          color: this.color,
          model: this.model,
          systemPrompt: this.systemPrompt,
          lenses: this.lenses.map((l) => l.serializeForWire()),
          baseTools: [...this.baseTools],
          baseHabits: [...this.baseHabits],
          baseReferences: [...this.baseReferences],
          basePlans: [...this.basePlans],
          toolModes: { ...this.toolModes },
          referenceOff: [...this.referenceOff],
          referenceModes: { ...this.referenceModes },
          habitOff: [...this.habitOff],
          habitModes: { ...this.habitModes },
          fields: this.fields.map((f) => ({ ...f })),
          system: { ...this.system },
          createdAt: this.createdAt,
          folder: this.folder,
          notes: this.notes,
          baseHabitNodes: this.baseHabitNodes.map((n) => n.serialize()),
          baseReferenceNodes: this.baseReferenceNodes.map((n) => n.serialize())
        };
      }
      // ── Composition (flush-and-fill; trust the children) ──────────────────────
      /**
       * Rebuild every `composed{X}` from the current lenses — wholesale, no deltas. Ask each lens
       * for its Know graph and sort the contributed paths by artifact type. Cheap (in-memory; the
       * expensive dredge already happened when the lens was loaded), so call it freely: at
       * construction, and whenever a base string or a lens changes.
       *
       * `composedTools` ( the dumb inventory of tool NAMES ) stays empty — a tool is not a dredged node, so
       * the lens's tool contribution is a per-tool MODE map ( `composedToolModes` ), materialized from each
       * lens's `getToolModes()`. Later lenses override earlier per-tool; the agent's own `toolModes` then
       * overrides all of them ( `effectiveToolModes()` ).
       */
      compose() {
        const nodes = this.lenses.flatMap((l) => l.getNodes());
        this.composedReferences = _pathsOfType(nodes, "reference");
        this.composedPlans = _pathsOfType(nodes, "plan");
        this.composedHabits = _pathsOfType(nodes, "habit");
        this.composedTools = [];
        this.composedToolModes = {};
        for (const l of this.lenses)
          Object.assign(this.composedToolModes, l.getToolModes());
      }
      /**
       * Bind the wire's EXTERNAL layers onto the agent — the environment `compiledContext()` needs beyond the
       * agent's own object graph. Flush-and-fill, like `compose()`: pass the whole environment ( a partial
       * overwrites only the keys it names ), call it whenever a source changes, and trust the fresh rebuild.
       * Cheap; there is no delta path to keep in sync. The renderer's Agent store calls this when the MCP tool
       * defs / model root context / baseline memory change ( then `triggerRef` ); the orchestrator calls it per
       * round on the canonical agent. Never persisted — this is live environment, not agent identity.
       */
      bindEnv(env) {
        if (env.rootContext !== void 0)
          this.rootContext = env.rootContext;
        if (env.toolDefs !== void 0)
          this.toolDefs = env.toolDefs;
        if (env.memory !== void 0)
          this.memory = env.memory;
      }
      /** What this agent actually carries = bolted-on ∪ inherited-from-lenses. The permissions
       *  gate reads `effectiveTools`; the composer reads each pair to show base (editable here)
       *  vs composed (edit at the lens). */
      effectiveTools() {
        return _union(this.baseTools, this.composedTools);
      }
      effectiveHabits() {
        return _union(this.baseHabits, this.composedHabits);
      }
      effectiveReferences() {
        return _union(this.baseReferences, this.composedReferences);
      }
      effectivePlans() {
        return _union(this.basePlans, this.composedPlans);
      }
      /** The per-tool modes actually in force: the lenses' contribution ( `composedToolModes` ) with this
       *  agent's OWN authored `toolModes` overlaid on top — agent wins per-tool, so an agent can promote,
       *  demote, or `off`-out any tool a lens set. THE surface every tool-wire reader should consult ( the
       *  turn manifest + suggested-injection ), so the composability of tools mirrors habits' lens→agent
       *  override. A draft with no lens just returns its own `toolModes`. */
      effectiveToolModes() {
        return { ...this.composedToolModes, ...this.toolModes };
      }
      /**
       * What a LENS supplies for one path, before any agent override — the authored mode off the lens POLICY,
       * or `on` for a node a lens dredges without naming in its table. `null` when no lens supplies the path
       * at all, which is also the "is there anything to inherit?" question every composition surface asks.
       *
       * Read from POLICY, deliberately — never from the node's live `included` flag, which `getContextBlocks`
       * MUTATES on every compile ( see its doc comment: "never off the node's live `included`, which we
       * mutate here" ). `effectiveHabitMode` used to read exactly that mutated flag, so the inherited mode it
       * reported depended on whether a compile had run since — and the agent screen's "is this overridden?"
       * could disagree with the write path's idea of the natural mode, writing a same-value override that
       * could never be cleared. Policy is authored state; it holds still.
       *
       * Floored at `on`: a lens that authors `off` is declining to push the thing, not forcing it out of an
       * agent that wears the lens — taking something fully off is the AGENT's call, and that floor is what
       * makes `off` unambiguously an agent-level decision on every row.
       */
      lensNaturalMode(path3) {
        const norm = (s) => s.replace(/\\/g, "/");
        const entry = this.getPolicy().find((e) => e.href && norm(path3).endsWith(norm(e.href)));
        if (entry)
          return entry.mode === "off" ? "on" : entry.mode;
        return this.getNodes().some((n) => n.getPath() === path3) ? "on" : null;
      }
      /** One habit's NATURAL resting mode — what it is with no agent override at all: the lens's authored
       *  mode where a lens supplies it, else `suggested` for the agent's own pick ( adding a habit means
       *  wanting it; the legacy binary `habitOff` set still forces `off` ). `null` for a path this agent
       *  carries no habit for. THE read the write path compares a click against, so clicking a row's own
       *  resting value clears the override instead of re-storing it. */
      naturalHabitMode(path3) {
        const lensMode = this.lensNaturalMode(path3);
        if (lensMode !== null)
          return lensMode;
        if (this.baseHabitNodes.some((n) => n.getPath() === path3))
          return this.habitOff.includes(path3) ? "off" : "suggested";
        return null;
      }
      /** The reference sibling of `naturalHabitMode` — identical shape, identical reason, one inventory
       *  ( `baseReferenceNodes` / `referenceOff` ) different. */
      naturalReferenceMode(path3) {
        const lensMode = this.lensNaturalMode(path3);
        if (lensMode !== null)
          return lensMode;
        if (this.baseReferenceNodes.some((n) => n.getPath() === path3))
          return this.referenceOff.includes(path3) ? "off" : "suggested";
        return null;
      }
      /** The effective slot mode of one habit ( keyed by path ) — this agent's override if it authored one,
       *  else the natural mode. The habit sibling of `effectiveToolModes`: the ONE read the compile and the
       *  agent screen share, so a row's colour and what actually compiles can't drift. */
      effectiveHabitMode(path3) {
        return this.habitModes[path3] ?? this.naturalHabitMode(path3);
      }
      /** The effective slot mode of one reference ( keyed by path ) — EITHER a lens-inherited reference OR one
       *  of this agent's own `baseReferences`. The reference sibling of `effectiveHabitMode`. */
      effectiveReferenceMode(path3) {
        return this.referenceModes[path3] ?? this.naturalReferenceMode(path3);
      }
      // ── Lens surface ──────────────────────────────────────────────────────────
      /** The primary lens, or null for a draft. */
      get primaryLens() {
        return this.lenses[0] ?? null;
      }
      /** A draft cannot run: no lens has been composed onto it yet. */
      isDraft() {
        return this.lenses.length === 0;
      }
      /** The primary lens's path — the agent's path identity — or null for a draft. */
      getPath() {
        return this.primaryLens?.getPath() ?? null;
      }
      // ── The lens read surface, aggregated across every composed lens (null-safe) ──
      getNodes() {
        return this.lenses.flatMap((l) => l.getNodes());
      }
      getPolicy() {
        return this.lenses.flatMap((l) => l.getPolicy());
      }
      getContributors() {
        return this.lenses.flatMap((l) => l.getContributors());
      }
      getFrontmatter() {
        return this.primaryLens?.getFrontmatter() ?? {};
      }
      getSections() {
        return this.primaryLens?.getSections() ?? {};
      }
      // ── Context assembly ────────────────────────────────────────────────────────
      /**
       * THE context-composition point — the fat-object query, and the ONE source of truth every reader
       * below shares. It asks each lens for its region-blocks ( a lens recursively folds its own dredged +
       * injected nodes ), then adds this agent's OWN materialized base habits tagged the `agent` source
       * layer ( so they OUTRANK the lens in a contended slot — an agent's habit choice supersedes the
       * lens's, the composability of behaviour ). Deduped so one artifact contributes ONCE, from its most
       * specific source. `contribute()` ( the wire text ) and `slots()` ( the structured view ) are both
       * thin reads of this, so a composition screen can never show a resolution the compiled context
       * doesn't honour, and neither can drift into a leak the other doesn't see.
       */
      getContextBlocks() {
        const norm = (s) => s.replace(/\\/g, "/");
        const offHabits = /* @__PURE__ */ new Set();
        const offRefs = /* @__PURE__ */ new Set();
        for (const lens of this.lenses) {
          const policy = lens.getPolicy();
          const lensModeFor = (p) => policy.find((e) => e.href && norm(p).endsWith(norm(e.href)))?.mode ?? "on";
          for (const node of lens.getNodes()) {
            const type = node.getType();
            if (type !== "habit" && type !== "reference")
              continue;
            const path3 = node.getPath();
            const overrides = type === "habit" ? this.habitModes : this.referenceModes;
            const override = overrides[path3];
            const inPolicy = policy.some((e) => e.href && norm(path3).endsWith(norm(e.href)));
            if (!override && !inPolicy)
              continue;
            const effective = override ?? lensModeFor(path3);
            node.setIncluded(effective === "suggested");
            if (effective === "off")
              (type === "habit" ? offHabits : offRefs).add(path3);
          }
        }
        let lensBlocks = this.lenses.flatMap((lens) => lens.getContextBlocks());
        if (offHabits.size)
          lensBlocks = _Agent.dropRows(lensBlocks, offHabits, "habits");
        if (offRefs.size)
          lensBlocks = _Agent.dropRows(lensBlocks, offRefs, "references");
        const ownBlocks = (nodes, modes, off) => nodes.map((node) => {
          const path3 = node.getPath();
          const effective = modes[path3] ?? (off.includes(path3) ? "off" : "suggested");
          if (effective === "off")
            return null;
          node.setIncluded(effective === "suggested");
          return node;
        }).filter((n) => n !== null).flatMap((node) => node.getContextBlocks().map((b) => ({ ...b, sourceLayer: "agent" })));
        const habitBlocks = ownBlocks(this.baseHabitNodes, this.habitModes, this.habitOff);
        const referenceBlocks = ownBlocks(this.baseReferenceNodes, this.referenceModes, this.referenceOff);
        return _Agent.dedupeBySource([...lensBlocks, ...habitBlocks, ...referenceBlocks]);
      }
      /** Strike `off`-overridden rows from a manifest section table ( `habits` or `references` ). A habit's
       *  or reference's row lives in its lens's own SECTION block ( not on the node itself ), so an agent `off`
       *  override that already excluded the body must also drop the row — matched by the row's `where` href
       *  being the tail of the off artifact's absolute path. Rows-only surgery: the routing tier re-renders
       *  every table from `rows` ( `ContextAssembler.mergeManifest` ), so the wire + manifest both follow this
       *  filter with no text rewrite. A block whose rows are unchanged passes through by identity. */
      static dropRows(blocks, offPaths, section) {
        const norm = (s) => s.replace(/\\/g, "/");
        const offNorm = [...offPaths].map(norm);
        const isOff = (where) => !!where && offNorm.some((p) => p.endsWith(norm(where)));
        return blocks.map((b) => {
          const cur = b.rows ?? [];
          if (b.section !== section || !cur.length)
            return b;
          const rows = cur.filter((r) => !isOff(r.where));
          return rows.length === cur.length ? b : { ...b, rows };
        });
      }
      /**
       * The anti-leak core: one ARTIFACT contributes once, from its most-specific ( lowest-rank ) source
       * layer. When the same path arrives from two layers — a base habit the lens also dredges, an injected
       * node already loaded — the more specific layer's blocks win and every block of the losing layer is
       * dropped BEFORE slot resolution, so a duplicate can never survive into the corpus. Same-path,
       * same-rank blocks all stay ( one artifact's several regions ), and load order is preserved throughout.
       */
      static dedupeBySource(blocks) {
        const best = /* @__PURE__ */ new Map();
        for (const b of blocks) {
          const r = SlotResolver_1.SlotResolver.rank(b.sourceLayer);
          const cur = best.get(b.path);
          if (cur === void 0 || r < cur)
            best.set(b.path, r);
        }
        return blocks.filter((b) => SlotResolver_1.SlotResolver.rank(b.sourceLayer) === best.get(b.path));
      }
      /**
       * The recursive context query as one source-blind string: `getContextBlocks()` run through
       * `SlotResolver` ( habit-class contention resolved — a losing session-log-never never rides alongside
       * the session-log-aggressive it lost to ) and `ContextAssembler` ( merged by `data-kcd-merge-key`,
       * sorted Care-first / injected-last ). A draft ( no lens ) contributes nothing. ( The `systemPrompt`
       * lever rides the wire but is not yet prepended here — that lands with deploy-time assembly; base
       * references + tools join once their own resolver seams turn them into objects, the way base habits
       * now do. )
       */
      contribute() {
        if (!this.lenses.length)
          return "";
        return SlotResolver_1.SlotResolver.compile(this.getContextBlocks(), _Agent.SYSTEM_SEP);
      }
      /**
       * THE compiled context surface ( the context-compiler, 2026-07-12 ) — the Agent owns the WHOLE
       * assembly, not just identity. Shape: the merged body FIRST, then a MANIFEST at the very bottom
       * ( once ). The lens's identity + prose is the cache-stable prefix that rarely changes turn to turn,
       * so it leads; the manifest is the changeable, curated surface of affordances, so it trails ( Bryan,
       * 2026-07-12: "place all manifest at the bottom of the context window" ).
       *
       * The manifest is what/where/why tables — the one format ( `- what — why (where)` ) that stays
       * identical for agents and engineers all the way through: a `Files` table naming every loaded lens
       * ( name — description — vault-relative path, the file's ID ), then one deduped routing table per
       * `MANIFEST_SECTIONS` entry ( References / Domains / Habits / Contracts ) listing every affordance the
       * agent can hit indirectly. It is NOT an index of "where the content is" — it is a section of tools /
       * interactable surfaces, and its curation is a first-class lever.
       *
       * The body is every loaded artifact's full text, habit-class-resolved ( `SlotResolver` ) then merged
       * + sorted ( `ContextAssembler` ), with NO per-artifact header: a loaded file's identity lives once
       * in the manifest, its content merges into the body at its point. The legacy `stub` ( Available-on-
       * request ) block is dropped — the References table already carries those rows. A draft ( no lens )
       * compiles to nothing.
       */
      compile() {
        return this.compiledBlocks().map((b) => b.text).join("\n\n");
      }
      /**
       * THE compiled-block currency ( the compiled-context plan, 2026-07-12/13 ) — the flat, merged,
       * post-resolution `TaggedBlock[]` `compile()` now projects to text. Shape ( band model re-ratified
       * 2026-07-13 ): the merged body — **Care** ( by-kind `# Purpose` / `# Philosophy` bands, `buildCareBands` ) → **Memory**
       * ( reserved, empty ) → **Knowledge** ( core, forced-read ), via `ContextAssembler.assembleBlocks` +
       * `withBandHeadings` — first, then the bottom-of-context **Manifest** blocks ( `manifestBlocks()` —
       * Files, then each non-empty `MANIFEST_SECTIONS` table, in `INDEX_ORDER` ), each pair of PRESENT
       * segments separated by a literal `---` divider block. Kept as TWO separate assembles rather than one
       * combined pass through `ContextAssembler.sort` on purpose: a single pass would tier `injected` BELOW
       * `manifest` ( matching `ContextAssembler`'s own documented intent ), but today's actual wire puts
       * injected content ABOVE the manifest — unifying the sort would silently change output whenever a
       * session has injected content, which is a real behavior change, not a refactor. Flagged in the plan;
       * not resolved either way here.
       *
       * `extras` ( Phase 2, 2026-07-13 ): `before` rides ahead of the body ( the model-bound root context —
       * the ONE layer that genuinely leads everything else ), `after` trails the manifest ( the on-mode
       * tool manifest, every suggested tool's full schema — today assembled renderer-side in
       * `Session.wireSystemFor` ). A flat trailing array couldn't express "some extras lead, some trail";
       * this is the real positioning the Phase 1 doc comment deferred to Phase 2.
       *
       * `memory` ( memory-system plan, 2026-07-13 ) — the system-fired PRELOAD baseline ( `Agent.memoryBlock`,
       * built by the orchestrator from `database.baseline_memories` ). Unlike `before`/`after` it does NOT
       * bracket the join: it joins the BODY block list and sorts into the `memory` tier ( now BETWEEN the
       * Lenses band and Knowledge — `ContextAssembler.tierOf` ), because its position is a property of the
       * merged sort, not a fixed lead/trail slot. Its `## Memory` band heading is spliced by
       * `withBandHeadings` like any other body tier; while no memory rides ( the reserved-but-empty case ),
       * `withBandHeadings` emits nothing for the tier, so the wire carries no bare `## Memory`.
       */
      compiledBlocks(extras = {}) {
        const before = extras.before ?? [];
        const after = extras.after ?? [];
        const memory = extras.memory ?? [];
        if (!this.lenses.length)
          return _Agent.joinSegments([before, memory, after]);
        const blocks = [...SlotResolver_1.SlotResolver.compilePlan(this.getContextBlocks()).survivors, ...memory];
        const inIndex = (b) => b.section !== null && _Agent.INDEX_SECTIONS.has(b.section);
        const body = blocks.filter((b) => !inIndex(b) && b.section !== "stub");
        const careBlocks = body.filter((b) => b.region === "care");
        const rest = body.filter((b) => b.region !== "care");
        const careBands = this.buildCareBands(careBlocks);
        const bodyBlocks = ContextAssembler_1.ContextAssembler.withBandHeadings(ContextAssembler_1.ContextAssembler.assembleBlocks([...careBands, ...rest]));
        const rawManifest = this.manifestBlocks(blocks.filter(inIndex));
        const manifestBlocks = rawManifest.length ? [ContextAssembler_1.ContextAssembler.headingBlock(ContextAssembler_1.ContextAssembler.bandHeading(ContextAssembler_1.ContextAssembler.TIER.manifest)), ...rawManifest] : [];
        return _Agent.joinSegments([before, bodyBlocks, manifestBlocks, after]);
      }
      // ── Self-assembling context ( the fat-object surface; fed by `bindEnv` ) ──────
      // Everything the Session store used to hand-gather into `compiledBlocks`'s extras bag now comes off the
      // agent's own bound environment, so ONE zero-arg call answers "what is my context" and both the renderer
      // preview and ( Phase 5 ) the send path read the SAME method — no second door, no drift by construction.
      /**
       * THE compiled context for this agent's live wire — `compiledBlocks()` with the bound environment folded
       * in as real blocks: the model root context LEADS ( `before` ), the baseline memory sorts into its tier,
       * and the `on`-mode tool manifest + every `suggested` tool's full schema TRAIL ( `after` ). Memory rides
       * only when the agent's own `system.memoryEnabled` gate is on. Zero-arg: the extras that used to be
       * hand-gathered in `Session.compiledBlocksFor` are the agent's own bound env now.
       */
      compiledContext() {
        const manifest = this.toolManifest();
        const suggested = this.suggestedToolDefs();
        const memory = this.system["memoryEnabled"] !== false ? this.memory : "";
        return this.compiledBlocks({
          before: _Agent.joinSegments([
            // The agent's OWN authored instruction leads everything — it is the most specific statement of
            // who this agent is, and it led the wire long before the compile existed ( the orchestrator's
            // old `assembleSystem([ systemPrompt, ... ])` put it first ). Folding it in HERE is what closes
            // the preview ≠ wire gap on the system half: the preview showed the compile WITHOUT the system
            // prompt while the wire always carried it, so every context gauge read low by its weight.
            this.systemPrompt ? [_Agent.extraBlock("system-prompt", this.systemPrompt)] : [],
            this.rootContext ? [_Agent.extraBlock("root-context", this.rootContext)] : []
          ]),
          memory: memory ? [_Agent.memoryBlock(memory)] : [],
          after: _Agent.joinSegments([
            manifest ? [_Agent.extraBlock("tool-manifest", manifest)] : [],
            suggested ? [_Agent.extraBlock("suggested-tools", suggested)] : []
          ])
        });
      }
      /** The system half a real turn sends — `compiledContext()` projected to text. THE one string: the
       *  renderer preview and the orchestrator's `_buildReq` both read this method, so preview == wire on
       *  the stable half by construction. Its dynamic twin is `session.wireMessages()`. */
      wireSystem() {
        return this.compiledContext().map((b) => b.text).join("\n\n");
      }
      /** This agent's whole-context token ESTIMATE — a single pile over its assembled `wireSystem()`, so it
       *  equals the estimate of the exact string that rides ( the atom the budget gauge reads ). The agent's
       *  own `estimateTokens` ( it is not a `KCDPrimitive`, but shares the shape one level up ). Deliberately
       *  loose; only the wire `usage` is exact. */
      estimateTokens() {
        return KCDPrimitive_1.KCDPrimitive._estimateTokens(this.wireSystem());
      }
      /** The compiled currency summed by coarse budget bucket — System ( root context ) / Lenses ( the agent's
       *  own identity + routing ) / Tools ( manifest + suggested ). Read per-block off `compiledContext()`'s own
       *  `section` tags, the same split the ring + legend group by. Attached files + conversation turns aren't
       *  compiled blocks, so they stay their own reads wherever this is summed. */
      compiledBudget() {
        const out = { system: 0, lenses: 0, tools: 0 };
        for (const b of this.compiledContext())
          out[_Agent.bucketOf(b)] += b.text ? KCDPrimitive_1.KCDPrimitive._estimateTokens(b.text) : 0;
        return out;
      }
      /** Group tool defs by their owning MCP server ( `ToolDef.server`, stamped main-side ), preserving
       *  first-seen order — the folder split the roster + drawer already show, now shared onto the wire. A def
       *  with no `server` ( a test double / pre-seam ) falls into a trailing "Other tools" bucket so nothing is
       *  ever dropped from the manifest. */
      static groupByServer(defs) {
        const order = [];
        const groups = /* @__PURE__ */ new Map();
        for (const t of defs) {
          const key = t.server?.id ?? "";
          if (!groups.has(key)) {
            groups.set(key, { name: t.server?.name ?? "Other tools", doc: t.server?.doc ?? "", tools: [] });
            order.push(key);
          }
          groups.get(key).tools.push(t);
        }
        return order.map((k) => groups.get(k));
      }
      /** The system-prompt tool MANIFEST — grouped by SERVER ( folder ): each server heads its block with its
       *  own description, then one `- name — description` line per `on`-mode tool, so the agent knows the tool
       *  exists and can request it while its server stays lazy. Off the bound `toolDefs` + `effectiveToolModes()`;
       *  '' when nothing is `on`. The `###` server headings let the fold view + drawer reproduce the folders. */
      toolManifest() {
        const modes = this.effectiveToolModes();
        const on = this.toolDefs.filter((t) => modes[t.name] === "on");
        if (!on.length)
          return "";
        const sections = _Agent.groupByServer(on).map((g) => {
          const head = g.doc ? `### ${g.name}
${g.doc}` : `### ${g.name}`;
          return head + "\n" + g.tools.map((t) => `- ${t.name} \u2014 ${t.description}`).join("\n");
        });
        return "## Available tools\n\n" + sections.join("\n\n");
      }
      /** Every `suggested`-mode tool's FULL definition ( name + description + input schema — the real wire
       *  weight of the injected surface ), grouped by SERVER the same way the manifest is: a `###` server band
       *  ( name + description ) over its tools' `####` full defs. '' when nothing is `suggested`. */
      suggestedToolDefs() {
        const modes = this.effectiveToolModes();
        const suggested = this.toolDefs.filter((t) => modes[t.name] === "suggested");
        if (!suggested.length)
          return "";
        const sections = _Agent.groupByServer(suggested).map((g) => {
          const head = g.doc ? `### ${g.name}
${g.doc}` : `### ${g.name}`;
          const defs = g.tools.map((t) => `#### ${t.name}

${t.description}

\`\`\`json
${JSON.stringify(t.inputSchema, null, 2)}
\`\`\``).join("\n\n");
          return head + "\n\n" + defs;
        });
        return "## Suggested tools\n\n" + sections.join("\n\n");
      }
      /** The tool names this agent injects as `suggested` — the set that rides the wire as structured `tools`,
       *  distinct from the `on` manifest. */
      suggestedToolNames() {
        const modes = this.effectiveToolModes();
        return Object.entries(modes).filter(([, m]) => m === "suggested").map(([n]) => n);
      }
      /** A plain string wrapped as a synthetic wire-order `TaggedBlock` — root context / tool manifest /
       *  suggested schemas ride `compiledBlocks()`'s one list this way instead of being hand-concatenated onto
       *  its text a second time. `section` labels which extra it is ( the budget bucket keys off it ); never
       *  read by the compiler itself. */
      static extraBlock(section, text) {
        return { region: "know", section, mergeKey: null, text, sourceLayer: "agent", path: "", artifactType: "unknown", habitClass: null };
      }
      /** The coarse budget bucket one compiled block groups under — read straight off its `section` tag ( the
       *  system-prompt + root-context extras are System, the tool extras are Tools, everything else —
       *  identity, routing, memory, headings — is Lenses ). One read of a field the block already carries,
       *  no second compilation. */
      static bucketOf(b) {
        if (b.section === "system-prompt" || b.section === "root-context")
          return "system";
        if (b.section === "tool-manifest" || b.section === "suggested-tools")
          return "tools";
        return "lenses";
      }
      /**
       * The by-KIND care bands ( compilation pass, 2026-07-19 ) — Purpose and Philosophy each become ONE
       * block that MERGES every active lens's contribution as a labeled sub-section, instead of one band per
       * lens. The primary lens leads and is marked `( Primary )` ( disputes resolve in its favor ); `_lens_base`
       * follows, labeled `Base lens`. This is the true "group by KIND, decouple from source" output — the
       * reader sees each identity kind ONCE, its sources folded underneath — where the earlier per-lens
       * `# {Name} - Lens` band was a half-step ( it repeated base's care into every lens, the duplicate chips ).
       *
       * Each merged block is `# {Kind}` over, per contributing lens, `## {label}` over that lens's care prose.
       * A care block carries its section's OWN surviving `### heading` ( the `data-kcd-heading` survivor ) —
       * stripped here so the `# {Kind}` band isn't shadowed by a near-duplicate, keeping only the prose. Kinds
       * surface in first-appearance order ( Purpose before Philosophy — natural authoring order ). The block
       * keeps its first member's care/section tagging ( so it sorts into the care tier and labels as its kind );
       * only `text` is synthesized. A care block belonging to no active lens ( an injected-care drop ) rides at
       * the tail of its kind, never dropped. A base-only agent shows base AS the lens, unmarked.
       */
      buildCareBands(careBlocks) {
        const norm = (s) => s.replace(/\\/g, "/");
        const isBase = (l) => norm(l.getPath() ?? "").endsWith("_lens_base.html");
        const reals = this.lenses.filter((l) => !isBase(l));
        const bases = this.lenses.filter(isBase);
        const ordered = reals.length ? [...reals, ...bases] : bases;
        const allPaths = new Set(this.lenses.map((l) => norm(l.getPath() ?? "")));
        const title = (k) => k ? k.charAt(0).toUpperCase() + k.slice(1) : "Care";
        const lensLabel = (l) => isBase(l) && reals.length ? "Base lens" : `${l.getName()}${l === reals[0] ? " ( Primary )" : ""}`;
        const prose = (text) => {
          const lines = text.split("\n");
          let i = 0;
          while (i < lines.length && lines[i].trim() === "")
            i++;
          return i < lines.length && /^#{1,6}\s/.test(lines[i].trim()) ? lines.slice(i + 1).join("\n").trim() : text.trim();
        };
        const kinds = [];
        for (const b of careBlocks) {
          const k = b.section ?? "";
          if (!kinds.includes(k))
            kinds.push(k);
        }
        const out = [];
        for (const kind of kinds) {
          const members = careBlocks.filter((b) => (b.section ?? "") === kind);
          const parts = [`# ${title(kind)}`];
          for (const lens of ordered) {
            const mine = members.filter((b) => norm(b.path) === norm(lens.getPath() ?? ""));
            if (!mine.length)
              continue;
            parts.push(`## ${lensLabel(lens)}`);
            for (const m of mine)
              parts.push(prose(m.text));
          }
          const orphans = members.filter((b) => !allPaths.has(norm(b.path)));
          if (orphans.length) {
            parts.push("## Injected");
            for (const o of orphans)
              parts.push(prose(o.text));
          }
          out.push({ ...members[0], text: parts.join("\n\n"), mergeKey: null });
        }
        return out;
      }
      /** Join several block-list SEGMENTS with a literal `---` divider block between each pair of
       *  segments that BOTH have content — an empty segment ( no root context bound, no `suggested`
       *  tools armed, a draft with no body ) contributes nothing, not even a stray divider. The same
       *  `.filter(Boolean).join(SEP)` semantics `wireSystemFor` used to hand-roll over raw strings, now a
       *  block-list operation any caller stitching wire-order layers can reuse. */
      static joinSegments(segments) {
        const out = [];
        for (const seg of segments.filter((s) => s.length)) {
          if (out.length)
            out.push(_Agent.dividerBlock());
          out.push(...seg);
        }
        return out;
      }
      /** The literal `---` boundary block between two wire-order segments ( see `joinSegments` ).
       *  Synthetic — no source artifact — so it carries the same neutral tagging every other
       *  compiler-synthesized block does. */
      static dividerBlock() {
        return { region: "know", section: null, mergeKey: null, text: "---", sourceLayer: "agent", path: "", artifactType: "unknown", habitClass: null };
      }
      /** The KCD manifest sections — the what/where/why routing tables. Each is hoisted OUT of the body and
       *  into the bottom-of-context manifest as its own deduped table; every other section is prose that
       *  stays in the body. Derived from `MANIFEST_SECTIONS` ( the ONE registry shared with
       *  `ContextAssembler`, so the hoist set and the routing-tier/heading logic can never drift apart );
       *  `INDEX_ORDER` is the manifest's table order after `## Files`. */
      static INDEX_ORDER = ContextAssembler_1.MANIFEST_SECTIONS;
      static INDEX_SECTIONS = new Set(ContextAssembler_1.MANIFEST_SECTIONS);
      /**
       * The bottom-of-context manifest ( see `compiledBlocks` ), AS BLOCKS: a `Files` block naming every
       * loaded lens, then one routing-table block per non-empty manifest section ( References / Domains /
       * Habits / Contracts ), in `INDEX_ORDER`. Every row is one what/where/why line; every file appears
       * exactly once, deduped across sources by `ContextAssembler.manifestTable` so a manifest table and an
       * inline merge can't differ. The `Files` heading is itself a manifest section — single-sourced via
       * `ContextAssembler.title` so no caller hardcodes a `###` string. Paths are vault-relative — the
       * primary lens's `vaultRelative`, so a stack sharing a vault root all resolve against it.
       */
      manifestBlocks(index) {
        const root = this.primaryLens;
        const out = [];
        const fileRows = this.lenses.map((l) => KcdContext_1.KcdContext.renderRow({
          what: l.getName(),
          where: (root ?? l).vaultRelative(l.getPath() ?? ""),
          why: String(l.getFrontmatter()["description"] ?? "")
        }));
        if (fileRows.length) {
          out.push(_Agent.manifestBlock("files", [ContextAssembler_1.ContextAssembler.title("files"), ...fileRows].join("\n")));
        }
        for (const section of _Agent.INDEX_ORDER) {
          const members = index.filter((b) => b.section === section);
          if (members.length)
            out.push(_Agent.manifestBlock(section, ContextAssembler_1.ContextAssembler.manifestTable(members, section)));
        }
        return out;
      }
      /** One manifest-table block — synthetic ( no single source artifact, so tagged neutrally ), `region:
       *  'know'` since it's routing content, never Care identity prose. */
      static manifestBlock(section, text) {
        return { region: "know", section, mergeKey: null, text, sourceLayer: "agent", path: "", artifactType: "unknown", habitClass: null };
      }
      /** One PRELOAD-memory block — the system-fired baseline selection ( memory-system plan, 2026-07-13 ),
       *  passed to `compiledBlocks({ memory })`. `section: 'memory'` is the single marker that ( a ) sorts it
       *  into the `memory` tier ( `ContextAssembler.tierOf` — after the lens body, before the routing
       *  manifest ) and ( b ) keeps it OUT of the manifest hoist ( 'memory' is not a `MANIFEST_SECTIONS`
       *  name, so `INDEX_SECTIONS` never claims it ). Synthetic ( no source artifact ), so tagged neutrally
       *  like the manifest/divider blocks. The `## Memory` heading is a band heading spliced at render, so
       *  `text` is the bare prose dump — the ONE factory both the live wire ( Orchestrator ) and the
       *  renderer preview ( Session ) build from, so injection parity holds by construction. */
      static memoryBlock(text) {
        return { region: "know", section: "memory", mergeKey: null, text, sourceLayer: "agent", path: "", artifactType: "unknown", habitClass: null };
      }
      /**
       * The habit-class slot resolution across this agent's WHOLE composed set — the visualization twin of
       * `contribute()`, for the Slot UI to show every class's candidates and which one won. Reads the exact
       * same `getContextBlocks()` and resolves it through the same `SlotResolver`, so this view can never
       * show a different winner than the one actually compiled into the wire text.
       */
      slots() {
        if (!this.lenses.length)
          return [];
        return SlotResolver_1.SlotResolver.describe(this.getContextBlocks());
      }
      /**
       * The habit cascade as a COMPOSITION surface sees it — every habit this agent carries, from either
       * layer, each with its effective mode, whether or not it currently rides the wire.
       *
       * This exists because `slots()` is the wrong source for an editor and always was. `slots()` reads
       * `getContextBlocks()` — the COMPILE — which correctly drops anything at `off`: an off habit emits no
       * blocks, so it vanishes from the resolution, its class reads uncovered, and the agent screen redrew
       * the row as an empty slot. Turning a habit off LOOKED like deleting it. The compile is right to drop
       * it; the editor is wrong to read the compile. This read is built from the INVENTORY instead — the
       * lens's dredged habit nodes plus the agent's own `baseHabitNodes` — so `off` is a state a row is IN,
       * not an absence, exactly as the four-state model requires.
       *
       * Same `SlotResolver.RANK` as the real resolution ( agent beats lens ), so the winner shown here is
       * still the winner that compiles. Pure: no `setIncluded` mutation, so calling it never perturbs what a
       * later compile produces — the bug that made the old path order-dependent.
       *
       * Classless habits ride along, one entry each with `habitClass: null` and a single candidate: nothing
       * contends a slot they don't have, but a composition surface still wants them in the same currency.
       */
      habitSlots() {
        const candidates = [];
        const seen = /* @__PURE__ */ new Set();
        const add = (node, sourceLayer) => {
          const path3 = node.getPath();
          if (seen.has(path3))
            return;
          seen.add(path3);
          const cls = node.getFrontmatter()["habit-class"];
          candidates.push({
            path: path3,
            habitClass: typeof cls === "string" && cls ? cls : null,
            sourceLayer,
            mode: (sourceLayer === "agent" ? this.effectiveHabitMode(path3) : this.habitModes[path3] ?? this.lensNaturalMode(path3)) ?? "on",
            natural: this.naturalHabitMode(path3) ?? "on",
            won: false
          });
        };
        for (const n of this.baseHabitNodes)
          add(n, "agent");
        for (const n of this.getNodes())
          if (n.getType() === "habit")
            add(n, "lens");
        const views = [];
        const byClass = /* @__PURE__ */ new Map();
        for (const c of candidates) {
          if (!c.habitClass) {
            views.push({ habitClass: null, winner: { ...c, won: true }, candidates: [{ ...c, won: true }] });
            continue;
          }
          if (!byClass.has(c.habitClass))
            byClass.set(c.habitClass, []);
          byClass.get(c.habitClass).push(c);
        }
        for (const [habitClass, group] of byClass) {
          const winner = group.reduce((best, c) => SlotResolver_1.SlotResolver.rank(c.sourceLayer) < SlotResolver_1.SlotResolver.rank(best.sourceLayer) ? c : best);
          views.push({
            habitClass,
            winner: { ...winner, won: true },
            candidates: group.map((c) => ({ ...c, won: c.path === winner.path }))
          });
        }
        return views;
      }
      /** The separator between system-prompt layers — the one place the live turn and the Constellation
       *  commit-bake agree on how the layers join, so they can never drift apart. */
      static SYSTEM_SEP = "\n\n---\n\n";
      /**
       * Join system layers in order, dropping empties, with the canonical separator. The ONE formula shared
       * by the live turn (the orchestrator's per-round system assembly) and the Constellation commit-bake —
       * extract-once so the two surfaces can't drift.
       */
      static assembleSystem(parts) {
        return parts.filter(Boolean).join(_Agent.SYSTEM_SEP);
      }
      /**
       * This agent's frozen IDENTITY — the "who": its `systemPrompt` over its recursive lens contribution
       * (Know/Care/Do). The Constellation bakes this onto a work node at commit, so the run carries the
       * agent's whole KCD framework rather than a bare model. (The live session interleaves the — currently
       * empty — above-lens layer between the two; here there is nothing between them.)
       */
      identity() {
        return _Agent.assembleSystem([this.systemPrompt, this.compile()]);
      }
      /**
       * The agent's identity BROKEN OUT by source — the PRE-MERGE, per-source twin of `identity()`, in
       * flat load order (systemPrompt, then per lens its header block + each contributing node). This
       * is the Atlas's human-audience view — the context-optimization plan's design deliberately keeps
       * it separate from the wire: `identity()`/`contribute()` now run every lens's blocks through
       * `ContextAssembler` (Care-hoisted, `data-kcd-merge-key` groups fused, injected sunk last), so
       * joining these segments no longer reproduces `identity()` byte-for-byte once a session has
       * Care content, a merge group, or injected context. Reconciling the two views is Phase 5; today
       * they intentionally diverge — see the plan's "Atlas is the human audience; the wire is the AI
       * audience" ruling. Token counts are filled at run time (null here — the tokenizer lives
       * main-side, on the connector).
       */
      identitySegments() {
        const segs = [];
        if (this.systemPrompt)
          segs.push({ source: "system", label: "system prompt", text: this.systemPrompt, tokens: null });
        for (const lens of this.lenses) {
          const block = lens.toContextBlock();
          if (block)
            segs.push({ source: "lens", label: lens.getPath() ?? "lens", text: block, tokens: null });
          for (const node of lens.getNodes()) {
            const text = node.contribute();
            if (text)
              segs.push({ source: node.getType(), label: node.getName(), text, tokens: null });
          }
        }
        return segs;
      }
    };
    exports2.Agent = Agent;
  }
});

// ../kcd_sdk/dist/agent/ToolMode.js
var require_ToolMode = __commonJS({
  "../kcd_sdk/dist/agent/ToolMode.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TOOL_MODES = void 0;
    exports2.TOOL_MODES = ["off", "on", "suggested"];
  }
});

// ../kcd_sdk/dist/agent/ToolDef.js
var require_ToolDef = __commonJS({
  "../kcd_sdk/dist/agent/ToolDef.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../kcd_sdk/dist/agent/index.js
var require_agent = __commonJS({
  "../kcd_sdk/dist/agent/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_Agent(), exports2);
    __exportStar(require_Model(), exports2);
    __exportStar(require_ToolMode(), exports2);
    __exportStar(require_ToolDef(), exports2);
  }
});

// ../kcd_sdk/dist/core/Assert.js
var require_Assert = __commonJS({
  "../kcd_sdk/dist/core/Assert.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Assert = void 0;
    exports2.Assert = {
      /** Exhaustiveness guard for a discriminated union — see the module note. */
      never(x) {
        throw new Error(`unhandled variant: ${String(x)}`);
      }
    };
  }
});

// ../kcd_sdk/dist/session/TurnEntry.js
var require_TurnEntry = __commonJS({
  "../kcd_sdk/dist/session/TurnEntry.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Transcript = exports2.MIN_COMPACTION_TURNS = void 0;
    exports2.frameCompaction = frameCompaction;
    var KCDPrimitive_1 = require_KCDPrimitive();
    var Assert_1 = require_Assert();
    var WIRE_KINDS = /* @__PURE__ */ new Set(["user", "assistant", "tool-call", "tool-result", "injected-file", "image"]);
    exports2.MIN_COMPACTION_TURNS = 4;
    function frameFile(name, text) {
      return `[injected file \u2014 ${name}]
${text}`;
    }
    function frameCompaction(summary) {
      return "[compacted summary of the earlier conversation \u2014 a REPORT about what happened, not a transcript of it. Details here are paraphrased and may have lost exact wording; re-read source files rather than trusting quotations below.]\n\n" + summary + "\n\n[end compacted summary]";
    }
    var IMAGE_TOKENS_PER_PIXEL = 1 / 750;
    var IMAGE_FALLBACK_TOKENS = 1600;
    function estimateImageTokens(width, height) {
      if (width && height)
        return Math.max(1, Math.round(width * height * IMAGE_TOKENS_PER_PIXEL));
      return IMAGE_FALLBACK_TOKENS;
    }
    var Transcript = class _Transcript {
      turns;
      constructor(turns = []) {
        this.turns = turns;
      }
      static empty() {
        return new _Transcript([]);
      }
      // ── Reads ────────────────────────────────────────────────────────────────
      /** The raw ordered turn list — what the Turns inspector folder iterates. The ARRAY is a copy, so a
       *  reader can't add, remove, or reorder turns; the Turn objects in it are the LIVE ones, so
       *  `turn.entries` IS the transcript's entry list and pushing onto it edits the transcript. Shared by
       *  convention, not sealed by construction: the one caller reads a finished turn's entries out on every
       *  completed turn, and deep-cloning that path to buy a guarantee nobody's call site needs would cost
       *  more than the guarantee is worth. Treat what comes back as read-only. */
      allTurns() {
        return [...this.turns];
      }
      isEmpty() {
        return this.turns.length === 0;
      }
      /**
       * This transcript narrowed to the turns a policy admits — a PURE query returning a NEW Transcript
       * over the kept turns. Nothing is mutated and nothing is dropped from the original: the policy
       * decides what rides the next request, it does not edit history ( the standing ruling ). Callers
       * project the result ( `wireMessages()` / `estimateTokens()` ); the unwindowed original still answers
       * `rows()`, because the inspector's itinerary shows everything that happened.
       */
      windowed(policy) {
        const included = this.turns.filter((t) => t.include);
        if (policy.kind === "lastN")
          return new _Transcript(policy.n <= 0 ? [] : included.slice(-policy.n));
        return new _Transcript(included);
      }
      /**
       * This transcript with the active summary put in FRONT of it — a PURE query exactly as `windowed` is:
       * a new Transcript, nothing mutated and nothing dropped from the original. Compose it after
       * windowed( retention ), which reads naturally rather than because the order is load-bearing: the turns
       * this summary covers already left, at `compactThrough()` time, and cannot come back.
       *
       * The NEWEST active compaction wins — an older one covers a prefix of what the newer one covers, since
       * the newer pass read the older summary plus everything after it. That is what makes compacting twice
       * compose instead of conflict.
       *
       * `mode: 'off'` skips a compaction, and what that MEANS has changed with the flag model: the summary
       * stops riding, and the span it covered stays gone rather than coming back. An inert compaction is a
       * deliberate "drop this whole stretch", not an undo — a compacted turn is history, not context, and
       * nothing re-includes it.
       *
       * The summary rides as a synthetic USER turn: it stands in for turns that were BOTH roles, and
       * attributing it to the assistant would have the model reading a paraphrase as its own verbatim words.
       * Synthetic because it exists only HERE, in the throwaway projection — the bound transcript keeps every
       * real turn, so `turnRows()` still shows what actually happened.
       */
      compacted(compactions) {
        const active = compactions.filter((c) => c.mode !== "off").sort((a, b) => a.createdAt - b.createdAt);
        const newest = active[active.length - 1];
        if (!newest)
          return new _Transcript([...this.turns]);
        const summary = {
          id: `compaction-${newest.id}`,
          startedAt: newest.createdAt,
          entries: [{ at: newest.createdAt, kind: "user", text: frameCompaction(newest.summary) }],
          include: true,
          compacted: false
        };
        return new _Transcript([summary, ...this.turns]);
      }
      // ── Appends ( in-flight — the orchestrator lands entries here as a turn runs ) ──
      /** Open a fresh turn and return it — the in-flight appender pushes entries onto it as rounds resolve.
       *  Born INCLUDED and uncompacted, which is what makes the turn being dispatched right now ride without
       *  anyone having to say so: whether the current turn is in the window was never a policy question. */
      openTurn(id, startedAt) {
        const turn = { id, startedAt, entries: [], include: true, compacted: false };
        this.turns.push(turn);
        return turn;
      }
      /**
       * Append one entry — onto the TURN the caller holds, or, when none is given, onto the last open turn
       * ( opening an anonymous one if there is none — a defensive fallback for a caller that appends without
       * opening ).
       *
       * Passing the `openTurn()` result is what makes a wrong-turn append unrepresentable. Two turns running
       * concurrently against ONE session ( a room seat beside the chat surface, two Constellation steps ) both
       * see the same "last turn", so the second turn's entries landed on the first turn's object. Nothing
       * main-side enforces one-at-a-time: the renderer's `pending` flag is a chat-surface guard and
       * `Session.turnStatus` is advisory.
       */
      append(entry, turn) {
        const target = turn ?? this.turns[this.turns.length - 1] ?? this.openTurn(`t${this.turns.length + 1}`, entry.at);
        target.entries.push(entry);
      }
      // ── Compaction ( the covered prefix is marked once, here ) ──
      /**
       * Mark every turn through `throughTurnId` ( INCLUSIVE ) as compacted — `compacted: true` and
       * `include: false`, set together, in the one place that sets either. A summary stands in for them from
       * now on, and they never ride again: a compacted turn is history, not context. The mode switch's clear
       * skips them and the manual toggle refuses them, so this is a one-way door by design.
       *
       * Both flags move here rather than at two call sites because they are one fact said twice — a turn
       * marked compacted but still included would ride alongside the summary that replaced it, paying for
       * the same history twice, and the inverse would go dark with nothing on screen explaining why.
       *
       * Returns how many turns it marked. 0 means the id names no turn in this transcript ( its exchange was
       * deleted from the DB ) — the caller decides what that is worth. This neither guesses at a prefix nor
       * throws: guessing is what the old timestamp fallback did, and it existed only because the window was
       * re-derived on every projection instead of being recorded once, here.
       */
      compactThrough(throughTurnId) {
        const at = this.turns.findIndex((t) => t.id === throughTurnId);
        if (at === -1)
          return 0;
        for (const turn of this.turns.slice(0, at + 1)) {
          turn.compacted = true;
          turn.include = false;
        }
        return at + 1;
      }
      // ── Projection: to the WIRE ────────────────────────────────────────────────
      /**
       * Project the transcript to the neutral message list a connector sends. Walks every turn's entries in
       * order and batches them into alternating role messages: assistant text + its tool-calls become ONE
       * assistant message ( text block then tool_use blocks ); tool-results become a following user message
       * of tool_result blocks; user text and injected files are user messages. `thinking` is SKIPPED — the
       * scratchpad never rides the wire.
       *
       * No windowing here: it projects whatever turns are bound. The policy that decides WHICH turns ride
       * ( RetentionPolicy ) is applied by the caller binding only the in-window set — a Phase 3 seam.
       *
       * `opts.clearToolResultsBefore` ( ms ) stubs any tool-result older than the cutoff — the cheapest
       * context-engineering lever ( operate on the transcript, don't just append ); the full text stays on
       * the entry for the inspector. Dormant when absent.
       */
      wireMessages(opts) {
        const messages = [];
        for (const turn of this.turns) {
          for (const entry of turn.entries) {
            switch (entry.kind) {
              case "thinking":
                break;
              // display-only — never rides
              case "user":
                messages.push({ role: "user", content: entry.text });
                break;
              case "injected-file":
                this._appendBlock(messages, "user", { type: "text", text: frameFile(entry.name, entry.text) });
                break;
              case "image":
                this._appendBlock(messages, "user", { type: "image", mediaType: entry.mediaType, data: entry.data });
                break;
              case "assistant":
                this._appendBlock(messages, "assistant", { type: "text", text: entry.text });
                break;
              case "tool-call":
                this._appendBlock(messages, "assistant", { type: "tool_use", id: entry.id, name: entry.name, input: entry.input });
                break;
              case "tool-result": {
                const cleared = opts?.clearToolResultsBefore != null && entry.at < opts.clearToolResultsBefore;
                this._appendBlock(messages, "user", { type: "tool_result", tool_use_id: entry.toolUseId, content: cleared ? "[tool result cleared to save context]" : entry.content, ...entry.isError ? { is_error: true } : {} });
                break;
              }
              default:
                Assert_1.Assert.never(entry);
            }
          }
        }
        return messages;
      }
      /** Append a block to the last message when it is the same role AND already block-shaped; otherwise
       *  start a new message. Keeps assistant text + its tool-calls in one message and batches consecutive
       *  tool-results, matching the tool-loop wire shape. */
      _appendBlock(messages, role, block) {
        const last = messages[messages.length - 1];
        if (last && last.role === role && Array.isArray(last.content)) {
          last.content.push(block);
          return;
        }
        messages.push({ role, content: [block] });
      }
      // ── Projection: to the INSPECTOR ───────────────────────────────────────────
      /**
       * The time-ordered itinerary the Turns folder renders — one BLOCK per turn, each carrying the entries
       * that happened inside it ( thinking included ) with their self-priced wire weight.
       *
       * Grouped rather than flat because a turn is the unit a user reasons about and the unit the window
       * policy operates on. A flat entry stream reads as an undifferentiated log; blocks let the display be
       * honest about the structure that actually exists — this is what you asked, and here is everything
       * that happened because of it.
       */
      turnRows() {
        return this.turns.map((turn) => {
          const rows = turn.entries.map((entry) => this._row(entry));
          return {
            id: turn.id,
            startedAt: turn.startedAt,
            rows,
            tokens: rows.reduce((sum, r) => sum + r.tokens, 0)
          };
        });
      }
      _row(entry) {
        const displayOnly = !WIRE_KINDS.has(entry.kind);
        return {
          at: entry.at,
          kind: entry.kind,
          label: _Transcript._label(entry),
          text: _Transcript._entryText(entry),
          tokens: displayOnly ? 0 : _Transcript._entryTokens(entry),
          displayOnly,
          display: _Transcript._display(entry),
          // a non-text row carries its bytes so the inspector can thumbnail it inline
          ...entry.kind === "image" ? { media: {
            mediaType: entry.mediaType,
            data: entry.data,
            ...entry.width ? { width: entry.width } : {},
            ...entry.height ? { height: entry.height } : {}
          } } : {}
        };
      }
      // ── Cost ───────────────────────────────────────────────────────────────────
      /** The transcript's wire token weight — the self-priced sum over the WIRE-bearing entries ( thinking
       *  excluded ). Folds onto agent.estimateTokens() to give the session's whole context cost. */
      estimateTokens() {
        let total = 0;
        for (const turn of this.turns) {
          for (const entry of turn.entries) {
            if (!WIRE_KINDS.has(entry.kind))
              continue;
            total += _Transcript._entryTokens(entry);
          }
        }
        return total;
      }
      // ── Per-entry helpers ( static — pure over one entry ) ─────────────────────
      /** The token weight of ONE wire-bearing entry — the one place a kind's cost formula lives. Text kinds
       *  are chars÷4 ( KCDPrimitive._estimateTokens over the body ); an image is priced by pixel area
       *  ( estimateImageTokens ), NOT its text. Callers gate on WIRE_KINDS first, so a display-only kind
       *  ( thinking ) never reaches here. */
      static _entryTokens(entry) {
        if (entry.kind === "image")
          return estimateImageTokens(entry.width, entry.height);
        return KCDPrimitive_1.KCDPrimitive._estimateTokens(_Transcript._entryText(entry));
      }
      /** The entry's body as text — what it costs and what the itinerary shows. */
      static _entryText(entry) {
        switch (entry.kind) {
          case "user":
            return entry.text;
          case "assistant":
            return entry.text;
          case "thinking":
            return entry.text;
          case "tool-call":
            return `${entry.name} ${JSON.stringify(entry.input ?? {})}`;
          case "tool-result":
            return entry.content;
          case "injected-file":
            return frameFile(entry.name, entry.text);
          case "image":
            return (entry.name ?? "(image)") + (entry.width && entry.height ? ` ${entry.width}\xD7${entry.height}` : "");
          default:
            return Assert_1.Assert.never(entry);
        }
      }
      /**
       * How ONE entry presents — the single kind→look table for the whole app ( see RowDisplay ).
       *
       * Colours are the house tokens each kind already wears elsewhere, so the itinerary agrees with the
       * surfaces around it by construction: `--know` for the human and `--care` for the model ( the chat's
       * own per-role turn tints ), `--thinking` amber for reasoning, `--accent` for an action.
       *
       * A tool result is deliberately NOT the tool call's icon: a call and what it returned are different
       * events, and giving them one glyph made a tool loop read as a stutter rather than a round trip. It
       * also branches on `isError` — the one place that flag is known, and the reason this is computed per
       * row instead of being a static lookup on `kind`.
       */
      static _display(entry) {
        switch (entry.kind) {
          case "user":
            return { icon: "user", color: "--know" };
          case "assistant":
            return { icon: "sparkle", color: "--care" };
          case "thinking":
            return { icon: "lightbulb", color: "--thinking" };
          case "tool-call":
            return { icon: "pulse", color: "--accent" };
          case "tool-result":
            return entry.isError ? { icon: "warning", color: "--error" } : { icon: "package", color: "--plugin" };
          case "injected-file":
            return { icon: "file", color: "--reference" };
          case "image":
            return { icon: "camera", color: "--external" };
          default:
            return Assert_1.Assert.never(entry);
        }
      }
      /** A one-line label for an itinerary row. */
      static _label(entry) {
        switch (entry.kind) {
          case "user":
            return "user";
          case "assistant":
            return "assistant";
          case "thinking":
            return "thinking";
          case "tool-call":
            return `\u2192 tool ${entry.name}`;
          case "tool-result":
            return entry.isError ? "tool result (error)" : "tool result";
          case "injected-file":
            return `file ${entry.name}`;
          case "image":
            return "image";
          default:
            return Assert_1.Assert.never(entry);
        }
      }
    };
    exports2.Transcript = Transcript;
  }
});

// ../kcd_sdk/dist/session/Session.js
var require_Session = __commonJS({
  "../kcd_sdk/dist/session/Session.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Session = void 0;
    var TurnEntry_1 = require_TurnEntry();
    var DEFAULT_POLICIES = {
      retention: { kind: "all" },
      compaction: { enabled: false, threshold: 12e4 }
    };
    var Session = class _Session {
      id;
      /** Mutable now ( was readonly ) — a draft session is born agentless ('') and reassigned once the
       *  user picks an agent. '' is the unassigned sentinel; hasAgent() is the readable check. */
      agentId;
      title;
      /** Grouping label — flat, one level. Null = ungrouped. */
      folder;
      tags;
      createdAt;
      lastActive;
      status;
      zoom;
      fontFamily;
      /** Every POLICY acting on this session's context, by name. PERSISTED session configuration — the
       *  deliberate counterpart to the non-persisted `transcript` below: the transcript is the durable
       *  account of what happened, these are the lenses over it. Changing one NEVER edits history; it only
       *  changes what the next `wireMessages()` projects. */
      policies;
      /** Is a turn in flight right now — the run-state that used to live ( wrongly, and dead ) on the
       *  Agent. See `TurnStatus` for the full reasoning. Runtime-only: born 'idle', never persisted, so a
       *  crash mid-turn can never leave a session stuck 'thinking'. */
      turnStatus = "idle";
      /** The session's DYNAMIC context — the typed, ordered transcript of turns ( user / assistant /
       *  tool-call / tool-result / injected-file, plus display-only thinking ). NON-PERSISTED object state,
       *  the mirror of agent.bindEnv: never in SerializedSession, rebuilt on arrival via bindTranscript().
       *  Its home of record is the DB `entries` rows ( hydrated on load — see bindTranscript ). Empty until
       *  bound, so it is never null. */
      transcript = TurnEntry_1.Transcript.empty();
      /** The COMPACTIONS acting on this session — the summaries that stand in for the turns they cover. The
       *  same species as `transcript`: NON-PERSISTED object state, never in SerializedSession, rebuilt on
       *  arrival via bindCompactions(). Its home of record is the `session_compactions` table. Empty until
       *  bound, so the projection below is a no-op on a session that has never compacted. */
      compactions = [];
      constructor(id, agentId, title, folder, tags, createdAt, lastActive, status, zoom, fontFamily, policies) {
        this.id = id;
        this.agentId = agentId;
        this.title = title;
        this.folder = folder;
        this.tags = tags;
        this.createdAt = createdAt;
        this.lastActive = lastActive;
        this.status = status;
        this.zoom = zoom;
        this.fontFamily = fontFamily;
        this.policies = policies;
      }
      // ── Static entry points ──────────────────────────────────────────────────
      /** Spawn a fresh session. `agentId` may be omitted / '' for a DRAFT (agentless) session — it's inert
       *  until reassign() binds it to an agent. */
      static create(opts) {
        const now = Date.now();
        return new _Session(opts.id ?? crypto.randomUUID(), opts.agentId ?? "", opts.title ?? null, opts.folder ?? null, opts.tags ?? [], opts.createdAt ?? now, opts.lastActive ?? now, opts.status ?? "active", opts.zoom ?? null, opts.fontFamily ?? null, _Session.policiesFrom(opts.policies));
      }
      /** Rebuild from the wire / DB seed. */
      static fromSerialized(json) {
        return new _Session(json.id, json.agentId ?? "", json.title ?? null, json.folder ?? null, json.tags ?? [], json.createdAt, json.lastActive ?? json.createdAt, json.status ?? "active", json.zoom ?? null, json.fontFamily ?? null, _Session.policiesFrom(json.policies));
      }
      /**
       * Hydrate a policy bag from anything a wire / row might hold — the ONE place the legacy shape is
       * understood, so every other reader can assume the container.
       *
       * Three inputs land here: the container itself, a BARE legacy retention policy ( `{ kind: … }`, what
       * sessions stored before compaction existed — it becomes the `retention` entry ), and nothing at all.
       * Deliberately forgiving in the same spirit as the service-side parse: an unreadable policy must never
       * make a session's history unreachable, and every default is inert.
       */
      static policiesFrom(raw) {
        const v = raw ?? null;
        if (!v || typeof v !== "object")
          return { ...DEFAULT_POLICIES };
        if (typeof v["kind"] === "string") {
          return { retention: v, compaction: { ...DEFAULT_POLICIES.compaction } };
        }
        return {
          retention: v["retention"] ?? { ...DEFAULT_POLICIES.retention },
          compaction: v["compaction"] ?? { ...DEFAULT_POLICIES.compaction }
        };
      }
      /** The bridge wire form, the save form, the reconstruction source — one function, many purposes. */
      serializeForWire() {
        return {
          id: this.id,
          agentId: this.agentId,
          title: this.title,
          folder: this.folder,
          tags: [...this.tags],
          createdAt: this.createdAt,
          lastActive: this.lastActive,
          status: this.status,
          zoom: this.zoom,
          fontFamily: this.fontFamily,
          policies: this.policies,
          turnStatus: this.turnStatus
        };
      }
      // ── Mutators ───────────────────────────────────────────────────────────────
      /** Rename the session; null clears back to the derived title. */
      rename(title) {
        this.title = title;
      }
      /** Bind ( or rebind ) this session to an agent — the draft-session assignment path. '' clears it
       *  back to unassigned. Mutates in place; the caller persists ( DB update_session_agent ). */
      reassign(agentId) {
        this.agentId = agentId;
      }
      /** True once this session has a real source agent — the readable form of `agentId !== ''`. A draft
       *  session ( false ) is inert: it can't take a turn until an agent is assigned. */
      hasAgent() {
        return this.agentId !== "";
      }
      /** Move this session into a grouping folder ( flat label ); null = ungrouped. */
      setFolder(folder) {
        this.folder = folder;
      }
      /** Stamp lastActive to now — called when a turn lands, so the switcher sorts by recency. */
      touch() {
        this.lastActive = Date.now();
      }
      hasTag(tag) {
        return this.tags.includes(tag);
      }
      /** Add a tag (no-op if already present). Free-form — the user coins their own vocabulary. */
      addTag(tag) {
        if (!this.tags.includes(tag))
          this.tags.push(tag);
      }
      removeTag(tag) {
        this.tags = this.tags.filter((t) => t !== tag);
      }
      /** Set this session's chat-surface zoom + font family ( either may be null to fall back to
       *  the render side's default ). The chat header's A-/A+ and font controls call this. */
      setDisplay(zoom, fontFamily) {
        this.zoom = zoom;
        this.fontFamily = fontFamily;
      }
      // ── Transcript ( the dynamic half of the wire ) ─────────────────────────────
      /** Rebuild the transcript wholesale from a turn list — the flush-and-fill mirror of agent.bindEnv().
       *  Aggressive rebuild is cheap and always correct; the source is the DB `entries` rows on load, or the
       *  live turn list the renderer projects. Non-persisted: it is never written by serializeForWire. */
      bindTranscript(turns) {
        this.transcript = new TurnEntry_1.Transcript(turns);
      }
      /** Rebuild the compaction list wholesale — the flush-and-fill twin of bindTranscript(). Bound from the
       *  same load as the transcript, and rebound whenever a pass writes a new one, so the very next send is
       *  narrowed by it rather than waiting for a reload. Oldest→newest; the projection re-sorts defensively
       *  rather than trusting the caller's order. */
      bindCompactions(compactions) {
        this.compactions = compactions;
      }
      /** Set ONE named policy, leaving its siblings alone. Pure configuration: no policy touches the
       *  transcript, so nothing is ever lost by changing one. The caller persists the whole bag ( DB
       *  update_session_policy ).
       *
       *  Named rather than whole-bag ( `setPolicies( bag )` ) because every real caller is a single control
       *  changing a single lever — a whole-bag setter would make each of them read, spread, and write back
       *  the others, which is exactly how one control silently reverts another. */
      setPolicy(name, policy) {
        this.policies = { ...this.policies, [name]: policy };
      }
      /** Flip the run state around a turn. Deliberately has NO persistence counterpart — the caller
       *  broadcasts it and nothing writes it ( see `TurnStatus` ). Bracket every turn idle → thinking →
       *  idle from a `finally`, so a failure can't strand a session lit. */
      setTurnStatus(status) {
        this.turnStatus = status;
      }
      /** The transcript as it will actually RIDE — retention first ( which turns survive, read off each
       *  turn's own `include` flag ), compaction second ( the summary put in front of what survived ).
       *
       *  The order no longer carries the weight it used to. Compaction ran last to stop a narrow retention
       *  from smuggling a covered turn back in — impossible now, because a covered turn was marked
       *  `include: false` once by `compactThrough()` and `windowed()` has already dropped it before
       *  `compacted()` is reached. The sequence is what reads naturally, not a rule holding a bug shut.
       *
       *  Private and SHARED, because wireMessages() and estimateTokens() are the two readers that must never
       *  disagree about what rides — the moment they compose the policies separately, the gauge starts lying
       *  about the send. A third policy composes here and both readers get it for free.
       *
       *  Neither step edits the transcript: both build a new one, and the itinerary still shows every turn
       *  that ever happened. Note the asymmetry in what re-widening buys, though — a retention change hands
       *  back the turns it dropped, while a compacted turn is gone from the wire for good. It stays in the
       *  account of what happened; it is simply no longer context. */
      _projected() {
        return this.transcript.windowed(this.policies.retention).compacted(this.compactions);
      }
      /** The DYNAMIC half of the wire — the projected transcript as neutral messages a connector maps to its
       *  provider format ( thinking excluded ). Joins agent.wireSystem() ( the stable half ) at send: the
       *  whole request is { system: agent.wireSystem(), messages: session.wireMessages() }. Every policy is
       *  applied HERE, at the projection — the transcript itself is never edited. */
      wireMessages() {
        return this._projected().wireMessages();
      }
      /** The inspector itinerary — one BLOCK per turn, each carrying the entries that happened inside it
       *  ( thinking included ). DELIBERATELY UNWINDOWED: the Turns folder is the account of what actually
       *  happened, and a narrow policy must not make history look like it vanished. ( Marking which turns
       *  are in-window is a display concern for the folder itself. ) The System folder reads
       *  agent.wireSystem(). */
      transcriptTurns() {
        return this.transcript.turnRows();
      }
      /** The session's own context cost — the wire weight of the PROJECTED transcript ( self-priced per
       *  entry ), so it prices what will actually ride rather than everything ever said: a compacted session
       *  is priced on its summary, which is the whole reason a user compacts one. Reads the same _projected()
       *  the wire does, so the number cannot drift from the send. The whole-context estimate folds this onto
       *  agent.estimateTokens(); a caller sums the two halves. */
      estimateTokens() {
        return this._projected().estimateTokens();
      }
      /**
       * A display title even when none was set. An untitled session is a session whose first prompt has not
       * been named yet — either it has not taken a turn, or the house agent's naming pass is still thinking —
       * so the placeholder says exactly that and nothing more.
       *
       * It used to be a creation timestamp, back when a titleless session was a permanent state. It isn't
       * one any more: a title arrives on its own within a turn, and a stamp would have read like a real name
       * that just happened to be useless.
       */
      displayTitle() {
        if (this.title)
          return this.title;
        return "New session";
      }
    };
    exports2.Session = Session;
  }
});

// ../kcd_sdk/dist/session/RoomSession.js
var require_RoomSession = __commonJS({
  "../kcd_sdk/dist/session/RoomSession.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.RoomSession = exports2.ROOM_DEFAULT_BUDGET = void 0;
    exports2.ROOM_DEFAULT_BUDGET = 6;
    var RoomSession = class _RoomSession {
      id;
      title;
      participants;
      mode;
      brief;
      budget;
      window;
      createdAt;
      lastActive;
      status;
      constructor(id, title, participants, mode, brief, budget, window, createdAt, lastActive, status) {
        this.id = id;
        this.title = title;
        this.participants = participants;
        this.mode = mode;
        this.brief = brief;
        this.budget = budget;
        this.window = window;
        this.createdAt = createdAt;
        this.lastActive = lastActive;
        this.status = status;
      }
      // ── Static entry points ──────────────────────────────────────────────────
      /** Spawn a fresh room. Born empty — seats are added one at a time, so a room with one
       *  participant (or none) is a legal, inert state rather than an error. */
      static create(opts) {
        const now = Date.now();
        return new _RoomSession(opts.id ?? crypto.randomUUID(), opts.title ?? "", opts.participants ?? [], opts.mode ?? "manual", opts.brief ?? "", opts.budget ?? exports2.ROOM_DEFAULT_BUDGET, opts.window ?? 0, opts.createdAt ?? now, opts.lastActive ?? now, opts.status ?? "active");
      }
      /** Rebuild from the wire / DB seed. */
      static fromSerialized(json) {
        return new _RoomSession(json.id, json.title ?? "", json.participants ?? [], json.mode ?? "manual", json.brief ?? "", json.budget ?? exports2.ROOM_DEFAULT_BUDGET, json.window ?? 0, json.createdAt, json.lastActive ?? json.createdAt, json.status ?? "active");
      }
      /** The bridge wire form, the save form, the reconstruction source — one function, many purposes. */
      serializeForWire() {
        return {
          id: this.id,
          title: this.title,
          participants: this.participants.map((p) => ({ ...p })),
          mode: this.mode,
          brief: this.brief,
          budget: this.budget,
          window: this.window,
          createdAt: this.createdAt,
          lastActive: this.lastActive,
          status: this.status
        };
      }
      // ── Seats ──────────────────────────────────────────────────────────────────
      /** Seat someone. Returns the born participant so the caller can address it immediately.
       *  The id is minted here and is the room's addressing currency from then on — a caller
       *  never addresses an agentId. */
      addParticipant(spec) {
        const participant = {
          id: "seat-" + crypto.randomUUID().slice(0, 8),
          kind: spec.kind,
          ref: spec.ref ?? "",
          label: spec.label,
          color: spec.color ?? "var(--care)"
        };
        this.participants.push(participant);
        return participant;
      }
      /** Unseat a participant. The transcript is untouched — their past messages keep their
       *  fromId, and the label lookup degrades to 'unknown' rather than rewriting history. */
      removeParticipant(id) {
        const before = this.participants.length;
        this.participants = this.participants.filter((p) => p.id !== id);
        return this.participants.length !== before;
      }
      /** One seat by id, or null when there is no such seat. Absence, not failure — a stale id
       *  from a removed participant is an ordinary read miss. */
      participant(id) {
        return this.participants.find((p) => p.id === id) ?? null;
      }
      /** The seats that can be MADE to speak — agent kind only. A human speaks through the
       *  composer and an external participant appends on its own schedule; neither can be driven
       *  from in here, so neither belongs in a "whose turn next" list. */
      drivable() {
        return this.participants.filter((p) => p.kind === "agent");
      }
      // ── Mutators ───────────────────────────────────────────────────────────────
      rename(title) {
        this.title = title;
      }
      setMode(mode) {
        this.mode = mode;
      }
      /** Replace the room's framing text. The one knob worth turning while a room is live. */
      setBrief(brief) {
        this.brief = brief;
      }
      /** Clamp the auto-advance ceiling into a sane range — 0 disables auto-advance entirely, and the
       *  upper bound exists because a typo must not be able to spend fifty turns. */
      setBudget(budget) {
        if (!Number.isFinite(budget))
          return;
        this.budget = Math.max(0, Math.min(40, Math.floor(budget)));
      }
      /** Set the trailing-message window; 0 = the whole transcript. Floored at 0 and otherwise
       *  unbounded — a big window is a legitimate choice, an unbounded one is the default already. */
      setWindow(window) {
        if (!Number.isFinite(window))
          return;
        this.window = Math.max(0, Math.floor(window));
      }
      /** The trailing slice of a transcript this room shows a seat — the LAST `window` messages, or
       *  everything when the window is 0. Lives here rather than in the projector because it is a
       *  property of the ROOM's policy, not of how one speaker's window gets flattened. */
      windowed(rows) {
        if (this.window <= 0 || rows.length <= this.window)
          return rows;
        return rows.slice(rows.length - this.window);
      }
      /** Stamp lastActive to now — called when an utterance lands, so a roster sorts by recency. */
      touch() {
        this.lastActive = Date.now();
      }
      /** A display title even when none was set. */
      displayTitle() {
        if (this.title)
          return this.title;
        return "Room " + new Date(this.createdAt).toISOString().slice(0, 16).replace("T", " ");
      }
    };
    exports2.RoomSession = RoomSession;
  }
});

// ../kcd_sdk/dist/session/index.js
var require_session = __commonJS({
  "../kcd_sdk/dist/session/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_Session(), exports2);
    __exportStar(require_RoomSession(), exports2);
    __exportStar(require_TurnEntry(), exports2);
  }
});

// ../kcd_sdk/dist/constellation/Validation.js
var require_Validation = __commonJS({
  "../kcd_sdk/dist/constellation/Validation.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ConstellationError = void 0;
    exports2.ConstellationError = {
      NOT_COMMITTED: "Constellation is not committed \u2014 call .commit() before running it.",
      EMPTY: "Constellation has no nodes.",
      duplicateId: (id) => `Duplicate node id "${id}".`,
      emptyStepRef: (id) => `Step node "${id}" references no Step.`,
      agentNoRef: (id) => `Agent node "${id}" references no agent.`,
      branchNoContract: (id) => `Branch node "${id}" has no contract.`,
      branchDeadPorts: (id) => `Branch node "${id}" wires neither a pass nor a fail port.`,
      utilityNoCode: (id) => `Utility node "${id}" has no code to run.`,
      boolBranchDead: (id) => `Boolean-branch node "${id}" wires neither a pass nor a fail port.`
    };
  }
});

// ../kcd_sdk/dist/constellation/Constellation.js
var require_Constellation = __commonJS({
  "../kcd_sdk/dist/constellation/Constellation.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Constellation = void 0;
    var Validation_1 = require_Validation();
    var Constellation = class _Constellation {
      id;
      _nodes;
      _committed;
      _cursor;
      // where the next verb appends (top-level by default)
      _ids;
      // node-id counter, shared across the builder tree
      constructor(id, nodes = [], committed = false, ids = { n: 0 }) {
        this.id = id;
        this._nodes = nodes;
        this._committed = committed;
        this._cursor = this._nodes;
        this._ids = ids;
      }
      // ── Authoring ──────────────────────────────────────────────────────────────
      static define(id) {
        return new _Constellation(id);
      }
      /** Append a Start node — the read head's entry point (the board's gray "Start" box). */
      start() {
        this._guardOpen();
        this._cursor.push({ kind: "start", id: this._mint("start") });
        return this;
      }
      /** Append an End node — a terminal marker; the head reaching one ends the run as done. */
      end() {
        this._guardOpen();
        this._cursor.push({ kind: "end", id: this._mint("end") });
        return this;
      }
      /** Append an Agent node — the executor the head runs the chained work as. */
      agent(agentId) {
        this._guardOpen();
        this._cursor.push({ kind: "agent", id: this._mint("agent"), agent: agentId });
        return this;
      }
      /** Append a Step to the spine. `ref` is the registry Step id the Navigator resolves. */
      then(ref) {
        this._guardOpen();
        this._cursor.push({ kind: "step", id: this._mint("step"), ref });
        return this;
      }
      /**
       * Append a Utility — a self-evaluating code node. `language` selects the runtime (vanilla JS only,
       * for now); `code` is the body that returns the boolean verdict; `args` are node-set (never agent-set
       * — the security barrier). Single exit; pair it with a `.booleanBranch()` to route on its verdict.
       */
      utility(spec) {
        this._guardOpen();
        this._cursor.push({
          kind: "utility",
          id: this._mint("utility"),
          language: spec.language ?? "javascript",
          code: spec.code,
          args: spec.args ?? []
        });
        return this;
      }
      /**
       * Append a Boolean Branch — routes the head on the PRIOR node's boolean verdict (decoupled from
       * evaluation: the upstream utility/contract produced the boolean; this only routes it). `pass` / `fail`
       * are sub-builders; an omitted port terminates that path (pass = success, fail = failed).
       */
      booleanBranch(ports) {
        this._guardOpen();
        const node = { kind: "boolean-branch", id: this._mint("boolbranch"), pass: null, fail: null };
        if (ports.pass)
          node.pass = this._sub(ports.pass);
        if (ports.fail)
          node.fail = this._sub(ports.fail);
        this._cursor.push(node);
        return this;
      }
      /**
       * Append a branch that routes on a contract. `pass` / `fail` are sub-builders (`w => w.then(…)`)
       * authored against a fresh cursor; an omitted port stays null (= terminate that path). The
       * contract is stored now; routing on it lands in Phase 3.
       */
      branch(contract, ports) {
        this._guardOpen();
        const node = { kind: "branch", id: this._mint("branch"), contract, pass: null, fail: null };
        if (ports.pass)
          node.pass = this._sub(ports.pass);
        if (ports.fail)
          node.fail = this._sub(ports.fail);
        this._cursor.push(node);
        return this;
      }
      /** Append a parallel fan-out. Each lane is a sub-builder authored against its own cursor. */
      parallel(lanes) {
        this._guardOpen();
        this._cursor.push({ kind: "parallel", id: this._mint("parallel"), lanes: lanes.map((l) => this._sub(l)) });
        return this;
      }
      /** Freeze the tree. Validation is read via `validate()` / `isExecutable()`; an invalid one still freezes. */
      commit() {
        this._committed = true;
        return this;
      }
      // ── Validation (strings, not objects) ──────────────────────────────────────
      isCommitted() {
        return this._committed;
      }
      isExecutable() {
        return this._committed && this.validate().length === 0;
      }
      /**
       * Structural validation — pure, runs in the renderer. An extensible rule list: as the system
       * grows, add rules here (orphan / seam-shape / fail-loop governor). Returns plain strings.
       */
      validate() {
        const errors = [];
        if (!this._nodes.length)
          errors.push(Validation_1.ConstellationError.EMPTY);
        const seen = /* @__PURE__ */ new Set();
        this._walk(this._nodes, (n) => {
          if (seen.has(n.id))
            errors.push(Validation_1.ConstellationError.duplicateId(n.id));
          seen.add(n.id);
          if (n.kind === "step" && !n.ref)
            errors.push(Validation_1.ConstellationError.emptyStepRef(n.id));
          if (n.kind === "agent" && !n.agent)
            errors.push(Validation_1.ConstellationError.agentNoRef(n.id));
          if (n.kind === "utility" && !n.code.trim())
            errors.push(Validation_1.ConstellationError.utilityNoCode(n.id));
          if (n.kind === "branch" && !n.contract)
            errors.push(Validation_1.ConstellationError.branchNoContract(n.id));
          if (n.kind === "branch" && !n.pass && !n.fail)
            errors.push(Validation_1.ConstellationError.branchDeadPorts(n.id));
          if (n.kind === "boolean-branch" && !n.pass && !n.fail)
            errors.push(Validation_1.ConstellationError.boolBranchDead(n.id));
        });
        return errors;
      }
      // ── Bridge (mirrors Agent) ──────────────────────────────────────────────────
      serializeForWire() {
        return { id: this.id, nodes: structuredClone(this._nodes) };
      }
      static fromSerialized(json) {
        return new _Constellation(json.id, structuredClone(json.nodes), true);
      }
      /** The committed spine (read-only access for the Navigator's walk). */
      nodes() {
        return this._nodes;
      }
      // ── internals ────────────────────────────────────────────────────────────────
      _guardOpen() {
        if (this._committed)
          throw new Error(`Constellation "${this.id}" is committed \u2014 cannot author further.`);
      }
      /** Author a sub-sequence against a transient builder that SHARES this tree's id counter. */
      _sub(build) {
        const sub = new _Constellation(this.id, [], false, this._ids);
        build(sub);
        return sub._nodes;
      }
      _mint(prefix) {
        this._ids.n += 1;
        return `${prefix}-${this._ids.n}`;
      }
      /** Depth-first visit of every node, descending into branch ports and parallel lanes. */
      _walk(nodes, visit) {
        for (const n of nodes) {
          visit(n);
          if (n.kind === "branch" || n.kind === "boolean-branch") {
            if (n.pass)
              this._walk(n.pass, visit);
            if (n.fail)
              this._walk(n.fail, visit);
          } else if (n.kind === "parallel") {
            for (const lane of n.lanes)
              this._walk(lane, visit);
          }
        }
      }
    };
    exports2.Constellation = Constellation;
  }
});

// ../kcd_sdk/dist/constellation/types.js
var require_types2 = __commonJS({
  "../kcd_sdk/dist/constellation/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../kcd_sdk/dist/constellation/index.js
var require_constellation = __commonJS({
  "../kcd_sdk/dist/constellation/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_Constellation(), exports2);
    __exportStar(require_types2(), exports2);
    __exportStar(require_Validation(), exports2);
  }
});

// ../kcd_sdk/dist/core/InstallManifest.js
var require_InstallManifest = __commonJS({
  "../kcd_sdk/dist/core/InstallManifest.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.InstallManifest = void 0;
    var MANIFEST = [
      {
        bundleSource: "lenses/_lens_base.html",
        vaultHome: "lenses/_lens_base.html",
        required: true,
        purpose: "The base lens, auto-loaded into every session. A vault without it has no floor to stand on."
      },
      {
        bundleSource: "lenses/lens_crafter",
        vaultHome: "lenses/lens_crafter",
        required: true,
        purpose: 'The authoring lens. REQUIRED, not a nicety: the bundled kcd-onboard skill defers all lens-authoring taste to it ( `kcd_compile { lenses: ["lens_crafter"] }` ) before writing anything, so a vault without it leaves the only shipped skill compiling nothing at the exact step where it starts producing value. Shipped as a directory so the lens keeps its `{name}/{name}.html` + `context/` anatomy.'
      },
      {
        bundleSource: "habits",
        vaultHome: "habits",
        required: true,
        purpose: "Atomic behavior fragments the base lens and every domain lens link into."
      },
      {
        bundleSource: "analyzers/_analyzer_base.html",
        vaultHome: "analyzers/_analyzer_base.html",
        required: true,
        purpose: "The shared analyzer contract every read-anywhere, write-one-report agent extends."
      },
      {
        bundleSource: "generators",
        vaultHome: "generators",
        required: true,
        purpose: "The base generator contract plus the bundled manifest-driven write agents."
      },
      {
        bundleSource: "contracts",
        vaultHome: "contracts",
        required: true,
        purpose: "The behavioral agreements the bundled lenses and generators are evaluated against."
      },
      {
        bundleSource: "references/kcd_sdk",
        vaultHome: "references/kcd_sdk",
        required: true,
        purpose: "The protocol and primitives references the framework itself assumes a vault can link to."
      },
      {
        bundleSource: "references/how-to",
        vaultHome: "references/how-to",
        required: true,
        purpose: 'Procedural references the bundled lenses link into by path. Currently read-a-survey, which lens_crafter loads when proposing artifacts for an unfamiliar codebase \u2014 the "read this INSTEAD of exploring" instruction that the whole survey-as-anchor design rests on.'
      },
      {
        bundleSource: "utilities/deployed",
        vaultHome: "utilities/deployed",
        required: false,
        purpose: "Bundled example utilities for the registered tool tier \u2014 a starting point, not a requirement."
      },
      {
        bundleSource: "root.html",
        vaultHome: "root.html",
        required: true,
        purpose: "THE ENTRY DOCUMENT \u2014 the first thing every session reads, and what the generated CLAUDE.md points at. Required in the strongest sense: `root-context.html` instructs the agent to open it three times over, so a vault without it hands every new user a broken first instruction. It was missing entirely until 2026-07-26. Shipped as a starting point and meant to be edited; `lens-index` splices its Lenses table."
      },
      {
        bundleSource: "root-context.html",
        vaultHome: "root-context.html",
        required: true,
        purpose: "The host-seed carrier \u2014 CLAUDE.md / AGENTS.md / GEMINI.md are generated from this."
      },
      {
        bundleSource: "kcd.css",
        vaultHome: "kcd.css",
        required: true,
        purpose: "The vault-wide stylesheet every governed document links."
      },
      {
        bundleSource: "kcd_framework.html",
        vaultHome: "kcd_framework.html",
        required: false,
        purpose: "The framework's own self-description \u2014 useful context, not load-bearing."
      }
    ];
    var InstallManifest = class {
      /** Every row, in table order. */
      static all() {
        return MANIFEST;
      }
      /**
       * The row governing a vault-relative deployed path, or null when nothing in the manifest owns
       * it. Longest matching `vaultHome` prefix wins, mirroring `VaultLayout.entryFor` — a specific row
       * ( `references/kcd_sdk` ) can sit inside a directory this table does not otherwise cover.
       */
      static entryFor(vaultRelPath) {
        const norm = vaultRelPath.replace(/\\/g, "/");
        let best = null;
        for (const entry of MANIFEST) {
          if (norm !== entry.vaultHome && !norm.startsWith(entry.vaultHome + "/"))
            continue;
          if (best && best.vaultHome.length >= entry.vaultHome.length)
            continue;
          best = entry;
        }
        return best;
      }
    };
    exports2.InstallManifest = InstallManifest;
  }
});

// ../kcd_sdk/dist/core/FileTypes.js
var require_FileTypes = __commonJS({
  "../kcd_sdk/dist/core/FileTypes.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../kcd_sdk/dist/core/TextTypes.js
var require_TextTypes = __commonJS({
  "../kcd_sdk/dist/core/TextTypes.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TextTypes = void 0;
    exports2.TextTypes = {
      /** Lowercase extensions WITHOUT the leading dot. The one place to edit to add a text type. */
      extensions: /* @__PURE__ */ new Set([
        // prose / docs
        "txt",
        "md",
        "markdown",
        "mdx",
        "rst",
        "adoc",
        // data / config
        "json",
        "jsonc",
        "json5",
        "yaml",
        "yml",
        "toml",
        "ini",
        "cfg",
        "conf",
        "env",
        "properties",
        // insight documents — JSON under our own extension ( the SIG / starmind_insight substrate )
        "sig",
        // web / scripts
        "js",
        "mjs",
        "cjs",
        "jsx",
        "ts",
        "mts",
        "cts",
        "tsx",
        "vue",
        "svelte",
        "html",
        "htm",
        "xml",
        "svg",
        "css",
        "scss",
        "sass",
        "less",
        // languages
        "py",
        "rb",
        "go",
        "rs",
        "java",
        "kt",
        "c",
        "h",
        "cpp",
        "hpp",
        "cc",
        "cs",
        "php",
        "swift",
        "lua",
        "r",
        "pl",
        // shells
        "sh",
        "bash",
        "zsh",
        "fish",
        "ps1",
        "bat",
        "cmd",
        // queries / tabular / logs
        "sql",
        "graphql",
        "gql",
        "csv",
        "tsv",
        "log",
        "diff",
        "patch",
        // extensionless-as-name (matched whole, see isText)
        "gitignore",
        "gitattributes",
        "editorconfig",
        "dockerfile",
        "makefile"
      ]),
      /** Is this path a known text type? Reads the trailing extension, or the bare name for
       *  extensionless config files (`.gitignore`, `Dockerfile`). */
      isText(path3) {
        const name = path3.replace(/\\/g, "/").split("/").pop() ?? "";
        const dot = name.lastIndexOf(".");
        const key = dot > 0 ? name.slice(dot + 1) : name.replace(/^\./, "");
        return this.extensions.has(key.toLowerCase());
      }
    };
  }
});

// ../kcd_sdk/dist/core/Glob.js
var require_Glob = __commonJS({
  "../kcd_sdk/dist/core/Glob.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Glob = void 0;
    var Glob = class {
      /** Does a '/'-normalized relative path match the glob pattern? Anchored, full-string match. */
      static matches(relativePath, pattern) {
        const regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "").replace(/\*/g, "[^/]*").replace(/\x01/g, ".*");
        return new RegExp(`^${regexStr}$`).test(relativePath);
      }
    };
    exports2.Glob = Glob;
  }
});

// ../kcd_sdk/dist/core/NameMatch.js
var require_NameMatch = __commonJS({
  "../kcd_sdk/dist/core/NameMatch.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.NameMatch = void 0;
    var NameMatch = class {
      /** Does `name` contain `query`, case-insensitively? A blank query matches nothing — the caller
       *  guards against turning an empty search into "list every file on the machine". */
      static matches(name, query) {
        const q = query.trim();
        if (!q)
          return false;
        return name.toLowerCase().includes(q.toLowerCase());
      }
    };
    exports2.NameMatch = NameMatch;
  }
});

// ../kcd_sdk/dist/core/EsCsv.js
var require_EsCsv = __commonJS({
  "../kcd_sdk/dist/core/EsCsv.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EsCsv = void 0;
    var EsCsv = class _EsCsv {
      /** Column order is FIXED by the exact flag order SdkFileAccess._esArgs passes to es.exe: Name,
       *  Filename (the FULL absolute path — es.exe's naming, not ours), Attributes ('D' present iff
       *  it's a directory), Size, Date Modified (ISO-8601 UTC, via -date-format 3). A row that doesn't
       *  parse into 5 columns is skipped, not fatal — one bad line never drops the rest. */
      static parse(text) {
        const out = [];
        for (const line of text.split(/\r?\n/)) {
          if (!line)
            continue;
          const cols = _EsCsv._row(line);
          if (cols.length < 5)
            continue;
          const [name, path3, attrs, sizeStr, dateStr] = cols;
          const isDir = attrs.includes("D");
          const mtime = Date.parse(dateStr);
          out.push({
            name,
            path: path3,
            isDir,
            size: Number(sizeStr) || 0,
            ext: isDir ? "" : _EsCsv._ext(name),
            mtime: Number.isFinite(mtime) ? mtime : 0
          });
        }
        return out;
      }
      /** One RFC4180 CSV line -> its fields. Windows paths routinely contain commas — seen LIVE on the
       *  dev machine ( "…Packages\CoreEditorFonts,version=17.7.40001.1,productarch=neutral\_package.json" )
       *  — which es.exe correctly quotes; a naive split(',') would silently corrupt those rows. Handles
       *  quoted fields and "" as an escaped quote inside one. */
      static _row(line) {
        const out = [];
        let field = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i += 1) {
          const c = line[i];
          if (inQuotes) {
            if (c === '"') {
              if (line[i + 1] === '"') {
                field += '"';
                i += 1;
              } else
                inQuotes = false;
            } else
              field += c;
          } else if (c === '"') {
            inQuotes = true;
          } else if (c === ",") {
            out.push(field);
            field = "";
          } else {
            field += c;
          }
        }
        out.push(field);
        return out;
      }
      static _ext(name) {
        const dot = name.lastIndexOf(".");
        return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
      }
    };
    exports2.EsCsv = EsCsv;
  }
});

// ../kcd_sdk/dist/core/html/KcdExcise.js
var require_KcdExcise = __commonJS({
  "../kcd_sdk/dist/core/html/KcdExcise.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdExcise = void 0;
    var HtmlTree_1 = require_HtmlTree();
    exports2.KcdExcise = new class KcdExcise {
      /** Remove every link matching `matches( href )` from an HTML source string. */
      html(source, matches) {
        const root = HtmlTree_1.HtmlTree.parse(source);
        const slots = /* @__PURE__ */ new Set();
        const unwraps = [];
        this.scan(root, void 0, matches, slots, unwraps);
        const cuts = [];
        for (const slot of slots)
          cuts.push(this.removeSpan(source, slot));
        for (const u of unwraps)
          if (!u.slot || !slots.has(u.slot))
            cuts.push(this.unwrapSpan(source, u.a));
        cuts.sort((x, y) => y.start - x.start);
        let out = source;
        for (const c of cuts)
          out = out.slice(0, c.start) + c.text + out.slice(c.end);
        return out;
      }
      /** The `.js` comment-body counterpart: unwrap `[text](href)` → `text` for a matching href. */
      js(source, matches) {
        return source.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (whole, text, href) => matches(href) ? text : whole);
      }
      // ── internals ──────────────────────────────────────────────────────────────
      /** Depth-first walk carrying the nearest enclosing data-kcd-slot; buckets each matching `<a>` into a
       *  whole-slot removal ( it is a slot field ) or an unwrap ( a bare prose link ). */
      scan(el, slot, matches, slots, unwraps) {
        const here = HtmlTree_1.HtmlTree.has(el, "data-kcd-slot") ? el : slot;
        if (el.tag === "a" && HtmlTree_1.HtmlTree.has(el, "href") && matches(HtmlTree_1.HtmlTree.get(el, "href"))) {
          if (HtmlTree_1.HtmlTree.has(el, "data-kcd-field") && here)
            slots.add(here);
          else
            unwraps.push({ a: el, slot: here });
        }
        for (const k of el.kids)
          if (HtmlTree_1.HtmlTree.isEl(k))
            this.scan(k, here, matches, slots, unwraps);
      }
      /** A whole-element removal, widened to swallow its own line ( leading indent + trailing newline ) so
       *  no blank row is left where a record used to be. */
      removeSpan(source, el) {
        let a = el.start, b = el.end;
        const lineStart = source.lastIndexOf("\n", a - 1) + 1;
        if (source.slice(lineStart, a).trim() === "")
          a = lineStart;
        if (source[b] === "\r")
          b++;
        if (source[b] === "\n")
          b++;
        return { start: a, end: b, text: "" };
      }
      /** Replace an `<a>…</a>` with its own inner source ( the link's text, verbatim — never re-escaped ). */
      unwrapSpan(source, a) {
        const openEnd = source.indexOf(">", a.start) + 1;
        const closeStart = a.end - "</a>".length;
        return { start: a.start, end: a.end, text: source.slice(openEnd, closeStart) };
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/KcdEdit.js
var require_KcdEdit = __commonJS({
  "../kcd_sdk/dist/core/html/KcdEdit.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdEdit = void 0;
    var HtmlTree_1 = require_HtmlTree();
    exports2.KcdEdit = new class KcdEdit {
      // ── slot addressing ─────────────────────────────────────────────────────────
      /** The slot whose `where` href ends with `refPath` ( the node's absolute path ends with the slot's
       *  vault-relative href ), searched anywhere in `scope`. Mirrors the old `_findSlot`. */
      findSlot(scope, refPath) {
        const key = refPath.replace(/\\/g, "/");
        return HtmlTree_1.HtmlTree.first(scope, (el) => {
          if (!HtmlTree_1.HtmlTree.has(el, "data-kcd-slot"))
            return false;
          const where = HtmlTree_1.HtmlTree.first(el, (c) => c.tag === "a" && HtmlTree_1.HtmlTree.get(c, "data-kcd-field") === "where");
          const href = where ? HtmlTree_1.HtmlTree.get(where, "href") : void 0;
          return href != null && key.endsWith(href.replace(/\\/g, "/"));
        });
      }
      /** The `[data-kcd-table]` under `[data-kcd-region=REGION]` › `[data-kcd-section=SECTION]`, or null —
       *  the HtmlTree read of the descendant-combinator selectors the renderer helpers used. */
      table(root, region, section) {
        const reg = HtmlTree_1.HtmlTree.first(root, (el) => HtmlTree_1.HtmlTree.get(el, "data-kcd-region") === region);
        if (!reg)
          return null;
        const sec = HtmlTree_1.HtmlTree.first(reg, (el) => HtmlTree_1.HtmlTree.get(el, "data-kcd-section") === section);
        if (!sec)
          return null;
        return HtmlTree_1.HtmlTree.first(sec, (el) => HtmlTree_1.HtmlTree.has(el, "data-kcd-table"));
      }
      /** A vault-root-relative href ( `_Claude/…` ) from an absolute artifact path. */
      vaultHref(absPath) {
        const norm = absPath.replace(/\\/g, "/");
        const i = norm.lastIndexOf("/_Claude/");
        return i >= 0 ? norm.slice(i + 1) : norm;
      }
      // ── tree construction / mutation ( HtmlTree is plain objects, so we build + splice directly ) ──
      el(tag, attrs, kids = []) {
        return { type: "el", tag, attrs, kids };
      }
      text(value) {
        return { type: "text", value };
      }
      /** Remove `target` from anywhere under `root` by identity. Returns whether it was found + removed. */
      drop(root, target) {
        const i = root.kids.indexOf(target);
        if (i >= 0) {
          root.kids.splice(i, 1);
          return true;
        }
        for (const k of root.kids)
          if (HtmlTree_1.HtmlTree.isEl(k) && this.drop(k, target))
            return true;
        return false;
      }
      /** A fresh `<div data-kcd-slot="<kind>">` ( what · where · why ), `data-kcd-mode` gating auto-load:
       *  `suggested` = rides inline ( Included ), `on` = routing row only ( Conditional ). `kind` is the
       *  explicit slot role ( `reference` / `habit` — protocol §3 ), stamped so a newly-added slot carries the
       *  same kind the rest of the corpus does ( never a bare `data-kcd-slot`, which the validator rejects ). */
      buildSlot(name, vaultHref, included, kind, habitClass) {
        const attrs = { "data-kcd-slot": kind, "data-kcd-mode": included ? "suggested" : "on" };
        if (habitClass)
          attrs["data-kcd-habit-class"] = habitClass;
        return this.el("div", attrs, [
          this.el("span", { "data-kcd-field": "what", "data-kcd-type": "text" }, [this.text(name)]),
          this.el("a", { "data-kcd-field": "where", "data-kcd-type": "path", href: vaultHref }, [this.text(name)]),
          this.el("span", { "data-kcd-field": "why", "data-kcd-type": "text" }, [])
        ]);
      }
      // ── reference / habit ops ─────────────────────────────────────────────────────
      /** Set / clear a conditional reference's condition ( the slot's `why` text ). */
      setCondition(body, refPath, why) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        const slot = this.findSlot(root, refPath);
        const w = slot ? HtmlTree_1.HtmlTree.first(slot, (el) => HtmlTree_1.HtmlTree.get(el, "data-kcd-field") === "why") : null;
        if (!w)
          return null;
        w.kids = why ? [this.text(why)] : [];
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      /** Set a slot's `data-kcd-mode` gate: `included` ⇒ `suggested` ( full text inline ), else `on`
       *  ( a routing row ). Matched by where-href, so it serves the reference move AND the habit mode toggle. */
      setMode(body, path3, included) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        const slot = this.findSlot(root, path3);
        if (!slot)
          return null;
        slot.attrs["data-kcd-mode"] = included ? "suggested" : "on";
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      /** Remove a reference's whole slot from the lens. */
      removeRef(body, refPath) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        const slot = this.findSlot(root, refPath);
        if (!slot || !this.drop(root, slot))
          return null;
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      /** Add a reference to the lens's References table ( default always-loaded ). No-op if already present. */
      addRef(body, refPath, name) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        if (this.findSlot(root, refPath))
          return null;
        const table = this.table(root, "know", "references");
        if (!table)
          return null;
        table.kids.push(this.buildSlot(name, this.vaultHref(refPath), true, "reference"));
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      /** Choose ( or clear ) the habit for a class — the slot RADIO: every existing slot of the class is
       *  dropped, then the pick is appended ( `on` false just clears ). A classless habit adds/removes only
       *  its own slot. */
      setHabit(body, habitClass, habitPath, name, on) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        const table = this.table(root, "do", "habits");
        if (!table)
          return null;
        if (habitClass) {
          for (const s of HtmlTree_1.HtmlTree.collect(table, (el) => HtmlTree_1.HtmlTree.has(el, "data-kcd-slot") && HtmlTree_1.HtmlTree.get(el, "data-kcd-habit-class") === habitClass))
            this.drop(root, s);
        } else {
          const s = this.findSlot(table, habitPath);
          if (s)
            this.drop(root, s);
        }
        if (on)
          table.kids.push(this.buildSlot(name, this.vaultHref(habitPath), true, "habit", habitClass ?? void 0));
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
      // ── tool ops ( where-LESS slots under the Do region's `tools` section ) ────────
      toolTable(root) {
        return this.table(root, "do", "tools");
      }
      /** The Tools table, minting the whole `<section data-kcd-section="tools">` ( heading + table head )
       *  under the Do region if the lens has none yet — the first tool docked mints it. */
      ensureToolTable(root) {
        const existing = this.toolTable(root);
        if (existing)
          return existing;
        const doRegion = HtmlTree_1.HtmlTree.first(root, (el) => HtmlTree_1.HtmlTree.get(el, "data-kcd-region") === "do");
        if (!doRegion)
          return null;
        const head = this.el("div", { "data-kcd-head": "" }, ["Tool", "Mode"].map((l) => this.el("span", {}, [this.text(l)])));
        const table = this.el("div", { "data-kcd-table": "" }, [head]);
        doRegion.kids.push(this.el("section", { "data-kcd-section": "tools" }, [this.el("h3", {}, [this.text("Tools")]), table]));
        return table;
      }
      /** The where-less tool slot whose `what` names `toolName`, or null. */
      findToolSlot(table, toolName) {
        return HtmlTree_1.HtmlTree.first(table, (el) => {
          if (!HtmlTree_1.HtmlTree.has(el, "data-kcd-slot"))
            return false;
          if (HtmlTree_1.HtmlTree.first(el, (c) => c.tag === "a" && HtmlTree_1.HtmlTree.get(c, "data-kcd-field") === "where"))
            return false;
          const what = HtmlTree_1.HtmlTree.first(el, (c) => HtmlTree_1.HtmlTree.get(c, "data-kcd-field") === "what");
          return !!what && HtmlTree_1.HtmlTree.textOf(what).trim() === toolName;
        });
      }
      buildToolSlot(toolName, mode) {
        return this.el("div", { "data-kcd-slot": "tool", "data-kcd-mode": mode }, [
          this.el("span", { "data-kcd-field": "what", "data-kcd-type": "text" }, [this.text(toolName)]),
          this.el("span", { "data-kcd-field": "why", "data-kcd-type": "text" }, [this.text(mode)])
        ]);
      }
      /** Set ( or clear ) a tool's mode on the lens's Tools table. `off` REMOVES the row ( a lens carries only
       *  the tools it contributes — off is absence ); `on`/`suggested` replace the row's mode, minting the
       *  section on first use. The agent's own `toolModes` still overrides this at compile. */
      setTool(body, toolName, mode) {
        const root = HtmlTree_1.HtmlTree.parse(body);
        if (mode === "off") {
          const table2 = this.toolTable(root);
          const slot = table2 ? this.findToolSlot(table2, toolName) : null;
          if (!slot)
            return null;
          this.drop(root, slot);
          return HtmlTree_1.HtmlTree.innerHtml(root);
        }
        const table = this.ensureToolTable(root);
        if (!table)
          return null;
        const prior = this.findToolSlot(table, toolName);
        if (prior)
          this.drop(root, prior);
        table.kids.push(this.buildToolSlot(toolName, mode));
        return HtmlTree_1.HtmlTree.innerHtml(root);
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/KcdText.js
var require_KcdText = __commonJS({
  "../kcd_sdk/dist/core/html/KcdText.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdText = void 0;
    var HtmlTree_1 = require_HtmlTree();
    exports2.KcdText = new class KcdText {
      HEADINGS = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
      // Chrome + machine-only structure — never part of the prompt body. `dl` is the frontmatter block.
      SKIP = /* @__PURE__ */ new Set(["head", "style", "script", "link", "meta", "dl"]);
      /** Emit an HTML string as faithful readable text. Prefers the `<article>` body; falls back to the
       *  whole document when there is no article. Empty string for empty / unparseable input. */
      emit(html) {
        if (!html || !html.trim())
          return "";
        const root = HtmlTree_1.HtmlTree.parse(html);
        const article = HtmlTree_1.HtmlTree.first(root, (el) => el.tag === "article") ?? root;
        const out = [];
        this.block(article, out);
        return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      }
      /** Walk one element's children, emitting block boundaries. Containers recurse; leaf blocks emit
       *  their collapsed inline text and stop ( so a `<blockquote><p>…` is not counted twice ). */
      block(el, out) {
        for (const kid of el.kids) {
          if (kid.type === "text") {
            const t = this.inline(kid);
            if (t)
              out.push(t);
            continue;
          }
          const tag = kid.tag;
          if (this.SKIP.has(tag))
            continue;
          if (this.HEADINGS.has(tag)) {
            out.push("", "#".repeat(Number(tag[1])) + " " + this.inline(kid), "");
            continue;
          }
          if (tag === "li") {
            out.push("- " + this.inline(kid));
            continue;
          }
          if (tag === "p" || tag === "blockquote") {
            out.push("", this.inline(kid), "");
            continue;
          }
          if (tag === "tr") {
            const cells = kid.kids.filter(HtmlTree_1.HtmlTree.isEl).map((c) => this.inline(c)).filter(Boolean);
            if (cells.length)
              out.push("- " + cells.join(" \xB7 "));
            continue;
          }
          this.block(kid, out);
        }
      }
      /** Collapse a node's whole-subtree text to a single trimmed line. */
      inline(n) {
        return HtmlTree_1.HtmlTree.textOf(n).replace(/\s+/g, " ").trim();
      }
    }();
  }
});

// ../kcd_sdk/dist/core/html/index.js
var require_html = __commonJS({
  "../kcd_sdk/dist/core/html/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KcdText = exports2.KcdContext = exports2.KcdEdit = exports2.KcdExcise = exports2.KcdEmit = exports2.KcdParse = exports2.KcdValidate = exports2.KcdAddress = exports2.HtmlTree = void 0;
    var HtmlTree_1 = require_HtmlTree();
    Object.defineProperty(exports2, "HtmlTree", { enumerable: true, get: function() {
      return HtmlTree_1.HtmlTree;
    } });
    var KcdAddress_1 = require_KcdAddress();
    Object.defineProperty(exports2, "KcdAddress", { enumerable: true, get: function() {
      return KcdAddress_1.KcdAddress;
    } });
    var KcdValidate_1 = require_KcdValidate();
    Object.defineProperty(exports2, "KcdValidate", { enumerable: true, get: function() {
      return KcdValidate_1.KcdValidate;
    } });
    var KcdParse_1 = require_KcdParse();
    Object.defineProperty(exports2, "KcdParse", { enumerable: true, get: function() {
      return KcdParse_1.KcdParse;
    } });
    var KcdEmit_1 = require_KcdEmit();
    Object.defineProperty(exports2, "KcdEmit", { enumerable: true, get: function() {
      return KcdEmit_1.KcdEmit;
    } });
    var KcdExcise_1 = require_KcdExcise();
    Object.defineProperty(exports2, "KcdExcise", { enumerable: true, get: function() {
      return KcdExcise_1.KcdExcise;
    } });
    var KcdEdit_1 = require_KcdEdit();
    Object.defineProperty(exports2, "KcdEdit", { enumerable: true, get: function() {
      return KcdEdit_1.KcdEdit;
    } });
    var KcdContext_1 = require_KcdContext();
    Object.defineProperty(exports2, "KcdContext", { enumerable: true, get: function() {
      return KcdContext_1.KcdContext;
    } });
    var KcdText_1 = require_KcdText();
    Object.defineProperty(exports2, "KcdText", { enumerable: true, get: function() {
      return KcdText_1.KcdText;
    } });
  }
});

// ../kcd_sdk/dist/core/index.js
var require_core = __commonJS({
  "../kcd_sdk/dist/core/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_primitives(), exports2);
    __exportStar(require_agent(), exports2);
    __exportStar(require_session(), exports2);
    __exportStar(require_constellation(), exports2);
    __exportStar(require_Assert(), exports2);
    __exportStar(require_VaultLayout(), exports2);
    __exportStar(require_InstallManifest(), exports2);
    __exportStar(require_FileTypes(), exports2);
    __exportStar(require_TextTypes(), exports2);
    __exportStar(require_Glob(), exports2);
    __exportStar(require_NameMatch(), exports2);
    __exportStar(require_EsCsv(), exports2);
    __exportStar(require_html(), exports2);
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/common.js
var require_common = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/common.js"(exports2, module2) {
    "use strict";
    function isNothing(subject) {
      return typeof subject === "undefined" || subject === null;
    }
    function isObject(subject) {
      return typeof subject === "object" && subject !== null;
    }
    function toArray(sequence) {
      if (Array.isArray(sequence)) return sequence;
      else if (isNothing(sequence)) return [];
      return [sequence];
    }
    function extend(target, source) {
      if (source) {
        const sourceKeys = Object.keys(source);
        for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
          const key = sourceKeys[index];
          target[key] = source[key];
        }
      }
      return target;
    }
    function repeat(string, count) {
      let result = "";
      for (let cycle = 0; cycle < count; cycle += 1) {
        result += string;
      }
      return result;
    }
    function isNegativeZero(number) {
      return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
    }
    module2.exports.isNothing = isNothing;
    module2.exports.isObject = isObject;
    module2.exports.toArray = toArray;
    module2.exports.repeat = repeat;
    module2.exports.isNegativeZero = isNegativeZero;
    module2.exports.extend = extend;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/exception.js
var require_exception = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/exception.js"(exports2, module2) {
    "use strict";
    function formatError(exception, compact) {
      let where = "";
      const message = exception.reason || "(unknown reason)";
      if (!exception.mark) return message;
      if (exception.mark.name) {
        where += 'in "' + exception.mark.name + '" ';
      }
      where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
      if (!compact && exception.mark.snippet) {
        where += "\n\n" + exception.mark.snippet;
      }
      return message + " " + where;
    }
    function YAMLException(reason, mark) {
      Error.call(this);
      this.name = "YAMLException";
      this.reason = reason;
      this.mark = mark;
      this.message = formatError(this, false);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error().stack || "";
      }
    }
    YAMLException.prototype = Object.create(Error.prototype);
    YAMLException.prototype.constructor = YAMLException;
    YAMLException.prototype.toString = function toString(compact) {
      return this.name + ": " + formatError(this, compact);
    };
    module2.exports = YAMLException;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/snippet.js
var require_snippet = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/snippet.js"(exports2, module2) {
    "use strict";
    var common = require_common();
    function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
      let head = "";
      let tail = "";
      const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
      if (position - lineStart > maxHalfLength) {
        head = " ... ";
        lineStart = position - maxHalfLength + head.length;
      }
      if (lineEnd - position > maxHalfLength) {
        tail = " ...";
        lineEnd = position + maxHalfLength - tail.length;
      }
      return {
        str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
        pos: position - lineStart + head.length
        // relative position
      };
    }
    function padStart(string, max) {
      return common.repeat(" ", max - string.length) + string;
    }
    function makeSnippet(mark, options) {
      options = Object.create(options || null);
      if (!mark.buffer) return null;
      if (!options.maxLength) options.maxLength = 79;
      if (typeof options.indent !== "number") options.indent = 1;
      if (typeof options.linesBefore !== "number") options.linesBefore = 3;
      if (typeof options.linesAfter !== "number") options.linesAfter = 2;
      const re = /\r?\n|\r|\0/g;
      const lineStarts = [0];
      const lineEnds = [];
      let match;
      let foundLineNo = -1;
      while (match = re.exec(mark.buffer)) {
        lineEnds.push(match.index);
        lineStarts.push(match.index + match[0].length);
        if (mark.position <= match.index && foundLineNo < 0) {
          foundLineNo = lineStarts.length - 2;
        }
      }
      if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
      let result = "";
      const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
      const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
      for (let i = 1; i <= options.linesBefore; i++) {
        if (foundLineNo - i < 0) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo - i],
          lineEnds[foundLineNo - i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
          maxLineLength
        );
        result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
      }
      const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
      result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
      result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
      for (let i = 1; i <= options.linesAfter; i++) {
        if (foundLineNo + i >= lineEnds.length) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo + i],
          lineEnds[foundLineNo + i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
          maxLineLength
        );
        result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
      }
      return result.replace(/\n$/, "");
    }
    module2.exports = makeSnippet;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type.js
var require_type = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type.js"(exports2, module2) {
    "use strict";
    var YAMLException = require_exception();
    var TYPE_CONSTRUCTOR_OPTIONS = [
      "kind",
      "multi",
      "resolve",
      "construct",
      "instanceOf",
      "predicate",
      "represent",
      "representName",
      "defaultStyle",
      "styleAliases"
    ];
    var YAML_NODE_KINDS = [
      "scalar",
      "sequence",
      "mapping"
    ];
    function compileStyleAliases(map) {
      const result = {};
      if (map !== null) {
        Object.keys(map).forEach(function(style) {
          map[style].forEach(function(alias) {
            result[String(alias)] = style;
          });
        });
      }
      return result;
    }
    function Type(tag, options) {
      options = options || {};
      Object.keys(options).forEach(function(name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
          throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
        }
      });
      this.options = options;
      this.tag = tag;
      this.kind = options["kind"] || null;
      this.resolve = options["resolve"] || function() {
        return true;
      };
      this.construct = options["construct"] || function(data) {
        return data;
      };
      this.instanceOf = options["instanceOf"] || null;
      this.predicate = options["predicate"] || null;
      this.represent = options["represent"] || null;
      this.representName = options["representName"] || null;
      this.defaultStyle = options["defaultStyle"] || null;
      this.multi = options["multi"] || false;
      this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
      if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
      }
    }
    module2.exports = Type;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/schema.js
var require_schema = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/schema.js"(exports2, module2) {
    "use strict";
    var YAMLException = require_exception();
    var Type = require_type();
    function compileList(schema, name) {
      const result = [];
      schema[name].forEach(function(currentType) {
        let newIndex = result.length;
        result.forEach(function(previousType, previousIndex) {
          if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
            newIndex = previousIndex;
          }
        });
        result[newIndex] = currentType;
      });
      return result;
    }
    function compileMap() {
      const result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      };
      function collectType(type) {
        if (type.multi) {
          result.multi[type.kind].push(type);
          result.multi["fallback"].push(type);
        } else {
          result[type.kind][type.tag] = result["fallback"][type.tag] = type;
        }
      }
      for (let index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
      }
      return result;
    }
    function Schema(definition) {
      return this.extend(definition);
    }
    Schema.prototype.extend = function extend(definition) {
      let implicit = [];
      let explicit = [];
      if (definition instanceof Type) {
        explicit.push(definition);
      } else if (Array.isArray(definition)) {
        explicit = explicit.concat(definition);
      } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
        if (definition.implicit) implicit = implicit.concat(definition.implicit);
        if (definition.explicit) explicit = explicit.concat(definition.explicit);
      } else {
        throw new YAMLException("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
      }
      implicit.forEach(function(type) {
        if (!(type instanceof Type)) {
          throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
        if (type.loadKind && type.loadKind !== "scalar") {
          throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
        }
        if (type.multi) {
          throw new YAMLException("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
        }
      });
      explicit.forEach(function(type) {
        if (!(type instanceof Type)) {
          throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
      });
      const result = Object.create(Schema.prototype);
      result.implicit = (this.implicit || []).concat(implicit);
      result.explicit = (this.explicit || []).concat(explicit);
      result.compiledImplicit = compileList(result, "implicit");
      result.compiledExplicit = compileList(result, "explicit");
      result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
      return result;
    };
    module2.exports = Schema;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/str.js
var require_str = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/str.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    module2.exports = new Type("tag:yaml.org,2002:str", {
      kind: "scalar",
      construct: function(data) {
        return data !== null ? data : "";
      }
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/seq.js
var require_seq = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/seq.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    module2.exports = new Type("tag:yaml.org,2002:seq", {
      kind: "sequence",
      construct: function(data) {
        return data !== null ? data : [];
      }
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/map.js
var require_map = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/map.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    module2.exports = new Type("tag:yaml.org,2002:map", {
      kind: "mapping",
      construct: function(data) {
        return data !== null ? data : {};
      }
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/schema/failsafe.js
var require_failsafe = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/schema/failsafe.js"(exports2, module2) {
    "use strict";
    var Schema = require_schema();
    module2.exports = new Schema({
      explicit: [
        require_str(),
        require_seq(),
        require_map()
      ]
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/null.js
var require_null = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/null.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    function resolveYamlNull(data) {
      if (data === null) return true;
      const max = data.length;
      return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
    }
    function constructYamlNull() {
      return null;
    }
    function isNull(object) {
      return object === null;
    }
    module2.exports = new Type("tag:yaml.org,2002:null", {
      kind: "scalar",
      resolve: resolveYamlNull,
      construct: constructYamlNull,
      predicate: isNull,
      represent: {
        canonical: function() {
          return "~";
        },
        lowercase: function() {
          return "null";
        },
        uppercase: function() {
          return "NULL";
        },
        camelcase: function() {
          return "Null";
        },
        empty: function() {
          return "";
        }
      },
      defaultStyle: "lowercase"
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/bool.js
var require_bool = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/bool.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    function resolveYamlBoolean(data) {
      if (data === null) return false;
      const max = data.length;
      return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
    }
    function constructYamlBoolean(data) {
      return data === "true" || data === "True" || data === "TRUE";
    }
    function isBoolean(object) {
      return Object.prototype.toString.call(object) === "[object Boolean]";
    }
    module2.exports = new Type("tag:yaml.org,2002:bool", {
      kind: "scalar",
      resolve: resolveYamlBoolean,
      construct: constructYamlBoolean,
      predicate: isBoolean,
      represent: {
        lowercase: function(object) {
          return object ? "true" : "false";
        },
        uppercase: function(object) {
          return object ? "TRUE" : "FALSE";
        },
        camelcase: function(object) {
          return object ? "True" : "False";
        }
      },
      defaultStyle: "lowercase"
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/int.js
var require_int = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/int.js"(exports2, module2) {
    "use strict";
    var common = require_common();
    var Type = require_type();
    function isHexCode(c) {
      return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
    }
    function isOctCode(c) {
      return c >= 48 && c <= 55;
    }
    function isDecCode(c) {
      return c >= 48 && c <= 57;
    }
    function resolveYamlInteger(data) {
      if (data === null) return false;
      const max = data.length;
      let index = 0;
      let hasDigits = false;
      if (!max) return false;
      let ch = data[index];
      if (ch === "-" || ch === "+") {
        ch = data[++index];
      }
      if (ch === "0") {
        if (index + 1 === max) return true;
        ch = data[++index];
        if (ch === "b") {
          index++;
          for (; index < max; index++) {
            ch = data[index];
            if (ch !== "0" && ch !== "1") return false;
            hasDigits = true;
          }
          return hasDigits && Number.isFinite(parseYamlInteger(data));
        }
        if (ch === "x") {
          index++;
          for (; index < max; index++) {
            if (!isHexCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && Number.isFinite(parseYamlInteger(data));
        }
        if (ch === "o") {
          index++;
          for (; index < max; index++) {
            if (!isOctCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && Number.isFinite(parseYamlInteger(data));
        }
      }
      for (; index < max; index++) {
        if (!isDecCode(data.charCodeAt(index))) {
          return false;
        }
        hasDigits = true;
      }
      if (!hasDigits) return false;
      return Number.isFinite(parseYamlInteger(data));
    }
    function parseYamlInteger(data) {
      let value = data;
      let sign = 1;
      let ch = value[0];
      if (ch === "-" || ch === "+") {
        if (ch === "-") sign = -1;
        value = value.slice(1);
        ch = value[0];
      }
      if (value === "0") return 0;
      if (ch === "0") {
        if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
        if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
        if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
      }
      return sign * parseInt(value, 10);
    }
    function constructYamlInteger(data) {
      return parseYamlInteger(data);
    }
    function isInteger(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
    }
    module2.exports = new Type("tag:yaml.org,2002:int", {
      kind: "scalar",
      resolve: resolveYamlInteger,
      construct: constructYamlInteger,
      predicate: isInteger,
      represent: {
        binary: function(obj) {
          return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
        },
        octal: function(obj) {
          return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
        },
        decimal: function(obj) {
          return obj.toString(10);
        },
        hexadecimal: function(obj) {
          return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
        }
      },
      defaultStyle: "decimal",
      styleAliases: {
        binary: [2, "bin"],
        octal: [8, "oct"],
        decimal: [10, "dec"],
        hexadecimal: [16, "hex"]
      }
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/float.js
var require_float = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/float.js"(exports2, module2) {
    "use strict";
    var common = require_common();
    var Type = require_type();
    var YAML_FLOAT_PATTERN = new RegExp(
      // 2.5e4, 2.5 and integers
      "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    var YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
      "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    function resolveYamlFloat(data) {
      if (data === null) return false;
      if (!YAML_FLOAT_PATTERN.test(data)) {
        return false;
      }
      if (Number.isFinite(parseFloat(data, 10))) {
        return true;
      }
      return YAML_FLOAT_SPECIAL_PATTERN.test(data);
    }
    function constructYamlFloat(data) {
      let value = data.toLowerCase();
      const sign = value[0] === "-" ? -1 : 1;
      if ("+-".indexOf(value[0]) >= 0) {
        value = value.slice(1);
      }
      if (value === ".inf") {
        return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      } else if (value === ".nan") {
        return NaN;
      }
      return sign * parseFloat(value, 10);
    }
    var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
    function representYamlFloat(object, style) {
      if (isNaN(object)) {
        switch (style) {
          case "lowercase":
            return ".nan";
          case "uppercase":
            return ".NAN";
          case "camelcase":
            return ".NaN";
        }
      } else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return ".inf";
          case "uppercase":
            return ".INF";
          case "camelcase":
            return ".Inf";
        }
      } else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return "-.inf";
          case "uppercase":
            return "-.INF";
          case "camelcase":
            return "-.Inf";
        }
      } else if (common.isNegativeZero(object)) {
        return "-0.0";
      }
      const res = object.toString(10);
      return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
    }
    function isFloat(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
    }
    module2.exports = new Type("tag:yaml.org,2002:float", {
      kind: "scalar",
      resolve: resolveYamlFloat,
      construct: constructYamlFloat,
      predicate: isFloat,
      represent: representYamlFloat,
      defaultStyle: "lowercase"
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/schema/json.js
var require_json = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/schema/json.js"(exports2, module2) {
    "use strict";
    module2.exports = require_failsafe().extend({
      implicit: [
        require_null(),
        require_bool(),
        require_int(),
        require_float()
      ]
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/schema/core.js
var require_core2 = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/schema/core.js"(exports2, module2) {
    "use strict";
    module2.exports = require_json();
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/timestamp.js
var require_timestamp = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/timestamp.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    var YAML_DATE_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
    );
    var YAML_TIMESTAMP_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
    );
    function resolveYamlTimestamp(data) {
      if (data === null) return false;
      if (YAML_DATE_REGEXP.exec(data) !== null) return true;
      if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
      return false;
    }
    function constructYamlTimestamp(data) {
      let fraction = 0;
      let delta = null;
      let match = YAML_DATE_REGEXP.exec(data);
      if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
      if (match === null) throw new Error("Date resolve error");
      const year = +match[1];
      const month = +match[2] - 1;
      const day = +match[3];
      if (!match[4]) {
        return new Date(Date.UTC(year, month, day));
      }
      const hour = +match[4];
      const minute = +match[5];
      const second = +match[6];
      if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) {
          fraction += "0";
        }
        fraction = +fraction;
      }
      if (match[9]) {
        const tzHour = +match[10];
        const tzMinute = +(match[11] || 0);
        delta = (tzHour * 60 + tzMinute) * 6e4;
        if (match[9] === "-") delta = -delta;
      }
      const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
      if (delta) date.setTime(date.getTime() - delta);
      return date;
    }
    function representYamlTimestamp(object) {
      return object.toISOString();
    }
    module2.exports = new Type("tag:yaml.org,2002:timestamp", {
      kind: "scalar",
      resolve: resolveYamlTimestamp,
      construct: constructYamlTimestamp,
      instanceOf: Date,
      represent: representYamlTimestamp
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/merge.js
var require_merge = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/merge.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    function resolveYamlMerge(data) {
      return data === "<<" || data === null;
    }
    module2.exports = new Type("tag:yaml.org,2002:merge", {
      kind: "scalar",
      resolve: resolveYamlMerge
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/binary.js
var require_binary = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/binary.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
    function resolveYamlBinary(data) {
      if (data === null) return false;
      let bitlen = 0;
      const max = data.length;
      const map = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        const code = map.indexOf(data.charAt(idx));
        if (code > 64) continue;
        if (code < 0) return false;
        bitlen += 6;
      }
      return bitlen % 8 === 0;
    }
    function constructYamlBinary(data) {
      const input = data.replace(/[\r\n=]/g, "");
      const max = input.length;
      const map = BASE64_MAP;
      let bits = 0;
      const result = [];
      for (let idx = 0; idx < max; idx++) {
        if (idx % 4 === 0 && idx) {
          result.push(bits >> 16 & 255);
          result.push(bits >> 8 & 255);
          result.push(bits & 255);
        }
        bits = bits << 6 | map.indexOf(input.charAt(idx));
      }
      const tailbits = max % 4 * 6;
      if (tailbits === 0) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      } else if (tailbits === 18) {
        result.push(bits >> 10 & 255);
        result.push(bits >> 2 & 255);
      } else if (tailbits === 12) {
        result.push(bits >> 4 & 255);
      }
      return new Uint8Array(result);
    }
    function representYamlBinary(object) {
      let result = "";
      let bits = 0;
      const max = object.length;
      const map = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        if (idx % 3 === 0 && idx) {
          result += map[bits >> 18 & 63];
          result += map[bits >> 12 & 63];
          result += map[bits >> 6 & 63];
          result += map[bits & 63];
        }
        bits = (bits << 8) + object[idx];
      }
      const tail = max % 3;
      if (tail === 0) {
        result += map[bits >> 18 & 63];
        result += map[bits >> 12 & 63];
        result += map[bits >> 6 & 63];
        result += map[bits & 63];
      } else if (tail === 2) {
        result += map[bits >> 10 & 63];
        result += map[bits >> 4 & 63];
        result += map[bits << 2 & 63];
        result += map[64];
      } else if (tail === 1) {
        result += map[bits >> 2 & 63];
        result += map[bits << 4 & 63];
        result += map[64];
        result += map[64];
      }
      return result;
    }
    function isBinary(obj) {
      return Object.prototype.toString.call(obj) === "[object Uint8Array]";
    }
    module2.exports = new Type("tag:yaml.org,2002:binary", {
      kind: "scalar",
      resolve: resolveYamlBinary,
      construct: constructYamlBinary,
      predicate: isBinary,
      represent: representYamlBinary
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/omap.js
var require_omap = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/omap.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var _toString = Object.prototype.toString;
    function resolveYamlOmap(data) {
      if (data === null) return true;
      const objectKeys = [];
      const object = data;
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        let pairHasKey = false;
        if (_toString.call(pair) !== "[object Object]") return false;
        let pairKey;
        for (pairKey in pair) {
          if (_hasOwnProperty.call(pair, pairKey)) {
            if (!pairHasKey) pairHasKey = true;
            else return false;
          }
        }
        if (!pairHasKey) return false;
        if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
        else return false;
      }
      return true;
    }
    function constructYamlOmap(data) {
      return data !== null ? data : [];
    }
    module2.exports = new Type("tag:yaml.org,2002:omap", {
      kind: "sequence",
      resolve: resolveYamlOmap,
      construct: constructYamlOmap
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/pairs.js
var require_pairs = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/pairs.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    var _toString = Object.prototype.toString;
    function resolveYamlPairs(data) {
      if (data === null) return true;
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        if (_toString.call(pair) !== "[object Object]") return false;
        const keys = Object.keys(pair);
        if (keys.length !== 1) return false;
        result[index] = [keys[0], pair[keys[0]]];
      }
      return true;
    }
    function constructYamlPairs(data) {
      if (data === null) return [];
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        const keys = Object.keys(pair);
        result[index] = [keys[0], pair[keys[0]]];
      }
      return result;
    }
    module2.exports = new Type("tag:yaml.org,2002:pairs", {
      kind: "sequence",
      resolve: resolveYamlPairs,
      construct: constructYamlPairs
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/type/set.js
var require_set = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/type/set.js"(exports2, module2) {
    "use strict";
    var Type = require_type();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    function resolveYamlSet(data) {
      if (data === null) return true;
      const object = data;
      for (const key in object) {
        if (_hasOwnProperty.call(object, key)) {
          if (object[key] !== null) return false;
        }
      }
      return true;
    }
    function constructYamlSet(data) {
      return data !== null ? data : {};
    }
    module2.exports = new Type("tag:yaml.org,2002:set", {
      kind: "mapping",
      resolve: resolveYamlSet,
      construct: constructYamlSet
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/schema/default.js
var require_default = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/schema/default.js"(exports2, module2) {
    "use strict";
    module2.exports = require_core2().extend({
      implicit: [
        require_timestamp(),
        require_merge()
      ],
      explicit: [
        require_binary(),
        require_omap(),
        require_pairs(),
        require_set()
      ]
    });
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/loader.js
var require_loader = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/loader.js"(exports2, module2) {
    "use strict";
    var common = require_common();
    var YAMLException = require_exception();
    var makeSnippet = require_snippet();
    var DEFAULT_SCHEMA = require_default();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var CONTEXT_FLOW_IN = 1;
    var CONTEXT_FLOW_OUT = 2;
    var CONTEXT_BLOCK_IN = 3;
    var CONTEXT_BLOCK_OUT = 4;
    var CHOMPING_CLIP = 1;
    var CHOMPING_STRIP = 2;
    var CHOMPING_KEEP = 3;
    var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
    var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
    var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
    var PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
    function _class(obj) {
      return Object.prototype.toString.call(obj);
    }
    function isEol(c) {
      return c === 10 || c === 13;
    }
    function isWhiteSpace(c) {
      return c === 9 || c === 32;
    }
    function isWsOrEol(c) {
      return c === 9 || c === 32 || c === 10 || c === 13;
    }
    function isFlowIndicator(c) {
      return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
    }
    function fromHexCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      const lc = c | 32;
      if (lc >= 97 && lc <= 102) {
        return lc - 97 + 10;
      }
      return -1;
    }
    function escapedHexLen(c) {
      if (c === 120) {
        return 2;
      }
      if (c === 117) {
        return 4;
      }
      if (c === 85) {
        return 8;
      }
      return 0;
    }
    function fromDecimalCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      return -1;
    }
    function simpleEscapeSequence(c) {
      switch (c) {
        case 48:
          return "\0";
        case 97:
          return "\x07";
        case 98:
          return "\b";
        case 116:
          return "	";
        case 9:
          return "	";
        case 110:
          return "\n";
        case 118:
          return "\v";
        case 102:
          return "\f";
        case 114:
          return "\r";
        case 101:
          return "\x1B";
        case 32:
          return " ";
        case 34:
          return '"';
        case 47:
          return "/";
        case 92:
          return "\\";
        case 78:
          return "\x85";
        case 95:
          return "\xA0";
        case 76:
          return "\u2028";
        case 80:
          return "\u2029";
        default:
          return "";
      }
    }
    function charFromCodepoint(c) {
      if (c <= 65535) {
        return String.fromCharCode(c);
      }
      return String.fromCharCode(
        (c - 65536 >> 10) + 55296,
        (c - 65536 & 1023) + 56320
      );
    }
    function setProperty(object, key, value) {
      if (key === "__proto__") {
        Object.defineProperty(object, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } else {
        object[key] = value;
      }
    }
    var simpleEscapeCheck = new Array(256);
    var simpleEscapeMap = new Array(256);
    for (let i = 0; i < 256; i++) {
      simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
      simpleEscapeMap[i] = simpleEscapeSequence(i);
    }
    function State(input, options) {
      this.input = input;
      this.filename = options["filename"] || null;
      this.schema = options["schema"] || DEFAULT_SCHEMA;
      this.onWarning = options["onWarning"] || null;
      this.legacy = options["legacy"] || false;
      this.json = options["json"] || false;
      this.listener = options["listener"] || null;
      this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
      this.maxMergeSeqLength = typeof options["maxMergeSeqLength"] === "number" ? options["maxMergeSeqLength"] : 20;
      this.implicitTypes = this.schema.compiledImplicit;
      this.typeMap = this.schema.compiledTypeMap;
      this.length = input.length;
      this.position = 0;
      this.line = 0;
      this.lineStart = 0;
      this.lineIndent = 0;
      this.depth = 0;
      this.firstTabInLine = -1;
      this.documents = [];
      this.anchorMapTransactions = [];
    }
    function generateError(state, message) {
      const mark = {
        name: state.filename,
        buffer: state.input.slice(0, -1),
        // omit trailing \0
        position: state.position,
        line: state.line,
        column: state.position - state.lineStart
      };
      mark.snippet = makeSnippet(mark);
      return new YAMLException(message, mark);
    }
    function throwError(state, message) {
      throw generateError(state, message);
    }
    function throwWarning(state, message) {
      if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
      }
    }
    function storeAnchor(state, name, value) {
      const transactions = state.anchorMapTransactions;
      if (transactions.length !== 0) {
        const transaction = transactions[transactions.length - 1];
        if (!_hasOwnProperty.call(transaction, name)) {
          transaction[name] = {
            existed: _hasOwnProperty.call(state.anchorMap, name),
            value: state.anchorMap[name]
          };
        }
      }
      state.anchorMap[name] = value;
    }
    function beginAnchorTransaction(state) {
      state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
    }
    function commitAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const transactions = state.anchorMapTransactions;
      if (transactions.length === 0) return;
      const parent = transactions[transactions.length - 1];
      const names = Object.keys(transaction);
      for (let index = 0, length = names.length; index < length; index += 1) {
        const name = names[index];
        if (!_hasOwnProperty.call(parent, name)) {
          parent[name] = transaction[name];
        }
      }
    }
    function rollbackAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const names = Object.keys(transaction);
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const entry = transaction[names[index]];
        if (entry.existed) {
          state.anchorMap[names[index]] = entry.value;
        } else {
          delete state.anchorMap[names[index]];
        }
      }
    }
    function snapshotState(state) {
      return {
        position: state.position,
        line: state.line,
        lineStart: state.lineStart,
        lineIndent: state.lineIndent,
        firstTabInLine: state.firstTabInLine,
        tag: state.tag,
        anchor: state.anchor,
        kind: state.kind,
        result: state.result
      };
    }
    function restoreState(state, snapshot) {
      state.position = snapshot.position;
      state.line = snapshot.line;
      state.lineStart = snapshot.lineStart;
      state.lineIndent = snapshot.lineIndent;
      state.firstTabInLine = snapshot.firstTabInLine;
      state.tag = snapshot.tag;
      state.anchor = snapshot.anchor;
      state.kind = snapshot.kind;
      state.result = snapshot.result;
    }
    var directiveHandlers = {
      YAML: function handleYamlDirective(state, name, args) {
        if (state.version !== null) {
          throwError(state, "duplication of %YAML directive");
        }
        if (args.length !== 1) {
          throwError(state, "YAML directive accepts exactly one argument");
        }
        const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
        if (match === null) {
          throwError(state, "ill-formed argument of the YAML directive");
        }
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major !== 1) {
          throwError(state, "unacceptable YAML version of the document");
        }
        state.version = args[0];
        state.checkLineBreaks = minor < 2;
        if (minor !== 1 && minor !== 2) {
          throwWarning(state, "unsupported YAML version of the document");
        }
      },
      TAG: function handleTagDirective(state, name, args) {
        let prefix;
        if (args.length !== 2) {
          throwError(state, "TAG directive accepts exactly two arguments");
        }
        const handle = args[0];
        prefix = args[1];
        if (!PATTERN_TAG_HANDLE.test(handle)) {
          throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
        }
        if (_hasOwnProperty.call(state.tagMap, handle)) {
          throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
        }
        if (!PATTERN_TAG_URI.test(prefix)) {
          throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
        }
        try {
          prefix = decodeURIComponent(prefix);
        } catch (err) {
          throwError(state, "tag prefix is malformed: " + prefix);
        }
        state.tagMap[handle] = prefix;
      }
    };
    function captureSegment(state, start, end, checkJson) {
      if (start < end) {
        const _result = state.input.slice(start, end);
        if (checkJson) {
          for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
            const _character = _result.charCodeAt(_position);
            if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
              throwError(state, "expected valid JSON character");
            }
          }
        } else if (PATTERN_NON_PRINTABLE.test(_result)) {
          throwError(state, "the stream contains non-printable characters");
        }
        state.result += _result;
      }
    }
    function mergeMappings(state, destination, source, overridableKeys) {
      if (!common.isObject(source)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
      }
      const sourceKeys = Object.keys(source);
      for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        const key = sourceKeys[index];
        if (!_hasOwnProperty.call(destination, key)) {
          setProperty(destination, key, source[key]);
          overridableKeys[key] = true;
        }
      }
    }
    function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
      if (Array.isArray(keyNode)) {
        keyNode = Array.prototype.slice.call(keyNode);
        for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
          if (Array.isArray(keyNode[index])) {
            throwError(state, "nested arrays are not supported inside keys");
          }
          if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
            keyNode[index] = "[object Object]";
          }
        }
      }
      if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
        keyNode = "[object Object]";
      }
      keyNode = String(keyNode);
      if (_result === null) {
        _result = {};
      }
      if (keyTag === "tag:yaml.org,2002:merge") {
        if (Array.isArray(valueNode)) {
          if (valueNode.length > state.maxMergeSeqLength) {
            throwError(state, "merge sequence length exceeded maxMergeSeqLength (" + state.maxMergeSeqLength + ")");
          }
          const seen = /* @__PURE__ */ new Set();
          for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
            const src = valueNode[index];
            if (seen.has(src)) continue;
            seen.add(src);
            mergeMappings(state, _result, src, overridableKeys);
          }
        } else {
          mergeMappings(state, _result, valueNode, overridableKeys);
        }
      } else {
        if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
          state.line = startLine || state.line;
          state.lineStart = startLineStart || state.lineStart;
          state.position = startPos || state.position;
          throwError(state, "duplicated mapping key");
        }
        setProperty(_result, keyNode, valueNode);
        delete overridableKeys[keyNode];
      }
      return _result;
    }
    function readLineBreak(state) {
      const ch = state.input.charCodeAt(state.position);
      if (ch === 10) {
        state.position++;
      } else if (ch === 13) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 10) {
          state.position++;
        }
      } else {
        throwError(state, "a line break is expected");
      }
      state.line += 1;
      state.lineStart = state.position;
      state.firstTabInLine = -1;
    }
    function skipSeparationSpace(state, allowComments, checkIndent) {
      let lineBreaks = 0;
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          if (ch === 9 && state.firstTabInLine === -1) {
            state.firstTabInLine = state.position;
          }
          ch = state.input.charCodeAt(++state.position);
        }
        if (allowComments && ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 10 && ch !== 13 && ch !== 0);
        }
        if (isEol(ch)) {
          readLineBreak(state);
          ch = state.input.charCodeAt(state.position);
          lineBreaks++;
          state.lineIndent = 0;
          while (ch === 32) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
          }
        } else {
          break;
        }
      }
      if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, "deficient indentation");
      }
      return lineBreaks;
    }
    function testDocumentSeparator(state) {
      let _position = state.position;
      let ch = state.input.charCodeAt(_position);
      if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
        _position += 3;
        ch = state.input.charCodeAt(_position);
        if (ch === 0 || isWsOrEol(ch)) {
          return true;
        }
      }
      return false;
    }
    function writeFoldedLines(state, count) {
      if (count === 1) {
        state.result += " ";
      } else if (count > 1) {
        state.result += common.repeat("\n", count - 1);
      }
    }
    function readPlainScalar(state, nodeIndent, withinFlowCollection) {
      let captureStart;
      let captureEnd;
      let hasPendingContent;
      let _line;
      let _lineStart;
      let _lineIndent;
      const _kind = state.kind;
      const _result = state.result;
      let ch = state.input.charCodeAt(state.position);
      if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
        return false;
      }
      if (ch === 63 || ch === 45) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          return false;
        }
      }
      state.kind = "scalar";
      state.result = "";
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
      while (ch !== 0) {
        if (ch === 58) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
            break;
          }
        } else if (ch === 35) {
          const preceding = state.input.charCodeAt(state.position - 1);
          if (isWsOrEol(preceding)) {
            break;
          }
        } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
          break;
        } else if (isEol(ch)) {
          _line = state.line;
          _lineStart = state.lineStart;
          _lineIndent = state.lineIndent;
          skipSeparationSpace(state, false, -1);
          if (state.lineIndent >= nodeIndent) {
            hasPendingContent = true;
            ch = state.input.charCodeAt(state.position);
            continue;
          } else {
            state.position = captureEnd;
            state.line = _line;
            state.lineStart = _lineStart;
            state.lineIndent = _lineIndent;
            break;
          }
        }
        if (hasPendingContent) {
          captureSegment(state, captureStart, captureEnd, false);
          writeFoldedLines(state, state.line - _line);
          captureStart = captureEnd = state.position;
          hasPendingContent = false;
        }
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position + 1;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, captureEnd, false);
      if (state.result) {
        return true;
      }
      state.kind = _kind;
      state.result = _result;
      return false;
    }
    function readSingleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 39) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 39) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (ch === 39) {
            captureStart = state.position;
            state.position++;
            captureEnd = state.position;
          } else {
            return true;
          }
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a single quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a single quoted scalar");
    }
    function readDoubleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 34) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 34) {
          captureSegment(state, captureStart, state.position, true);
          state.position++;
          return true;
        } else if (ch === 92) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (isEol(ch)) {
            skipSeparationSpace(state, false, nodeIndent);
          } else if (ch < 256 && simpleEscapeCheck[ch]) {
            state.result += simpleEscapeMap[ch];
            state.position++;
          } else if ((tmp = escapedHexLen(ch)) > 0) {
            let hexLength = tmp;
            let hexResult = 0;
            for (; hexLength > 0; hexLength--) {
              ch = state.input.charCodeAt(++state.position);
              if ((tmp = fromHexCode(ch)) >= 0) {
                hexResult = (hexResult << 4) + tmp;
              } else {
                throwError(state, "expected hexadecimal character");
              }
            }
            state.result += charFromCodepoint(hexResult);
            state.position++;
          } else {
            throwError(state, "unknown escape sequence");
          }
          captureStart = captureEnd = state.position;
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a double quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a double quoted scalar");
    }
    function readFlowCollection(state, nodeIndent) {
      let readNext = true;
      let _line;
      let _lineStart;
      let _pos;
      const _tag = state.tag;
      let _result;
      const _anchor = state.anchor;
      let terminator;
      let isPair;
      let isExplicitPair;
      let isMapping;
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyNode;
      let keyTag;
      let valueNode;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 91) {
        terminator = 93;
        isMapping = false;
        _result = [];
      } else if (ch === 123) {
        terminator = 125;
        isMapping = true;
        _result = {};
      } else {
        return false;
      }
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      ch = state.input.charCodeAt(++state.position);
      while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === terminator) {
          state.position++;
          state.tag = _tag;
          state.anchor = _anchor;
          state.kind = isMapping ? "mapping" : "sequence";
          state.result = _result;
          return true;
        } else if (!readNext) {
          throwError(state, "missed comma between flow collection entries");
        } else if (ch === 44) {
          throwError(state, "expected the node content, but found ','");
        }
        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;
        if (ch === 63) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following)) {
            isPair = isExplicitPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
          }
        }
        _line = state.line;
        _lineStart = state.lineStart;
        _pos = state.position;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if ((isExplicitPair || state.line === _line) && ch === 58) {
          isPair = true;
          ch = state.input.charCodeAt(++state.position);
          skipSeparationSpace(state, true, nodeIndent);
          composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
          valueNode = state.result;
        }
        if (isMapping) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
        } else if (isPair) {
          _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
        } else {
          _result.push(keyNode);
        }
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === 44) {
          readNext = true;
          ch = state.input.charCodeAt(++state.position);
        } else {
          readNext = false;
        }
      }
      throwError(state, "unexpected end of the stream within a flow collection");
    }
    function readBlockScalar(state, nodeIndent) {
      let folding;
      let chomping = CHOMPING_CLIP;
      let didReadContent = false;
      let detectedIndent = false;
      let textIndent = nodeIndent;
      let emptyLines = 0;
      let atMoreIndented = false;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 124) {
        folding = false;
      } else if (ch === 62) {
        folding = true;
      } else {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
        if (ch === 43 || ch === 45) {
          if (CHOMPING_CLIP === chomping) {
            chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
          } else {
            throwError(state, "repeat of a chomping mode identifier");
          }
        } else if ((tmp = fromDecimalCode(ch)) >= 0) {
          if (tmp === 0) {
            throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
          } else if (!detectedIndent) {
            textIndent = nodeIndent + tmp - 1;
            detectedIndent = true;
          } else {
            throwError(state, "repeat of an indentation width identifier");
          }
        } else {
          break;
        }
      }
      if (isWhiteSpace(ch)) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (isWhiteSpace(ch));
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (!isEol(ch) && ch !== 0);
        }
      }
      while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);
        while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
        if (!detectedIndent && state.lineIndent > textIndent) {
          textIndent = state.lineIndent;
        }
        if (isEol(ch)) {
          emptyLines++;
          continue;
        }
        if (!detectedIndent && textIndent === 0) {
          throwError(state, "missing indentation for block scalar");
        }
        if (state.lineIndent < textIndent) {
          if (chomping === CHOMPING_KEEP) {
            state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (chomping === CHOMPING_CLIP) {
            if (didReadContent) {
              state.result += "\n";
            }
          }
          break;
        }
        if (folding) {
          if (isWhiteSpace(ch)) {
            atMoreIndented = true;
            state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (atMoreIndented) {
            atMoreIndented = false;
            state.result += common.repeat("\n", emptyLines + 1);
          } else if (emptyLines === 0) {
            if (didReadContent) {
              state.result += " ";
            }
          } else {
            state.result += common.repeat("\n", emptyLines);
          }
        } else {
          state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        }
        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        const captureStart = state.position;
        while (!isEol(ch) && ch !== 0) {
          ch = state.input.charCodeAt(++state.position);
        }
        captureSegment(state, captureStart, state.position, false);
      }
      return true;
    }
    function readBlockSequence(state, nodeIndent) {
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = [];
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        if (ch !== 45) {
          break;
        }
        const following = state.input.charCodeAt(state.position + 1);
        if (!isWsOrEol(following)) {
          break;
        }
        detected = true;
        state.position++;
        if (skipSeparationSpace(state, true, -1)) {
          if (state.lineIndent <= nodeIndent) {
            _result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
          }
        }
        const _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a sequence entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "sequence";
        state.result = _result;
        return true;
      }
      return false;
    }
    function readBlockMapping(state, nodeIndent, flowIndent) {
      let allowCompact;
      let _keyLine;
      let _keyLineStart;
      let _keyPos;
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = {};
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyTag = null;
      let keyNode = null;
      let valueNode = null;
      let atExplicitKey = false;
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (!atExplicitKey && state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        const following = state.input.charCodeAt(state.position + 1);
        const _line = state.line;
        if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
          if (ch === 63) {
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = true;
            allowCompact = true;
          } else if (atExplicitKey) {
            atExplicitKey = false;
            allowCompact = true;
          } else {
            throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
          }
          state.position += 1;
          ch = following;
        } else {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
          if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
            break;
          }
          if (state.line === _line) {
            ch = state.input.charCodeAt(state.position);
            while (isWhiteSpace(ch)) {
              ch = state.input.charCodeAt(++state.position);
            }
            if (ch === 58) {
              ch = state.input.charCodeAt(++state.position);
              if (!isWsOrEol(ch)) {
                throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
              }
              if (atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
                keyTag = keyNode = valueNode = null;
              }
              detected = true;
              atExplicitKey = false;
              allowCompact = false;
              keyTag = state.tag;
              keyNode = state.result;
            } else if (detected) {
              throwError(state, "can not read an implicit mapping pair; a colon is missed");
            } else {
              state.tag = _tag;
              state.anchor = _anchor;
              return true;
            }
          } else if (detected) {
            throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        }
        if (state.line === _line || state.lineIndent > nodeIndent) {
          if (atExplicitKey) {
            _keyLine = state.line;
            _keyLineStart = state.lineStart;
            _keyPos = state.position;
          }
          if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
            if (atExplicitKey) {
              keyNode = state.result;
            } else {
              valueNode = state.result;
            }
          }
          if (!atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          skipSeparationSpace(state, true, -1);
          ch = state.input.charCodeAt(state.position);
        }
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a mapping entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "mapping";
        state.result = _result;
      }
      return detected;
    }
    function readTagProperty(state) {
      let isVerbatim = false;
      let isNamed = false;
      let tagHandle;
      let tagName;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 33) return false;
      if (state.tag !== null) {
        throwError(state, "duplication of a tag property");
      }
      ch = state.input.charCodeAt(++state.position);
      if (ch === 60) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
      } else if (ch === 33) {
        isNamed = true;
        tagHandle = "!!";
        ch = state.input.charCodeAt(++state.position);
      } else {
        tagHandle = "!";
      }
      let _position = state.position;
      if (isVerbatim) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 62);
        if (state.position < state.length) {
          tagName = state.input.slice(_position, state.position);
          ch = state.input.charCodeAt(++state.position);
        } else {
          throwError(state, "unexpected end of the stream within a verbatim tag");
        }
      } else {
        while (ch !== 0 && !isWsOrEol(ch)) {
          if (ch === 33) {
            if (!isNamed) {
              tagHandle = state.input.slice(_position - 1, state.position + 1);
              if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                throwError(state, "named tag handle cannot contain such characters");
              }
              isNamed = true;
              _position = state.position + 1;
            } else {
              throwError(state, "tag suffix cannot contain exclamation marks");
            }
          }
          ch = state.input.charCodeAt(++state.position);
        }
        tagName = state.input.slice(_position, state.position);
        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
          throwError(state, "tag suffix cannot contain flow indicator characters");
        }
      }
      if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, "tag name cannot contain such characters: " + tagName);
      }
      try {
        tagName = decodeURIComponent(tagName);
      } catch (err) {
        throwError(state, "tag name is malformed: " + tagName);
      }
      if (isVerbatim) {
        state.tag = tagName;
      } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;
      } else if (tagHandle === "!") {
        state.tag = "!" + tagName;
      } else if (tagHandle === "!!") {
        state.tag = "tag:yaml.org,2002:" + tagName;
      } else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
      }
      return true;
    }
    function readAnchorProperty(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 38) return false;
      if (state.anchor !== null) {
        throwError(state, "duplication of an anchor property");
      }
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an anchor node must contain at least one character");
      }
      state.anchor = state.input.slice(_position, state.position);
      return true;
    }
    function readAlias(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 42) return false;
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an alias node must contain at least one character");
      }
      const alias = state.input.slice(_position, state.position);
      if (!_hasOwnProperty.call(state.anchorMap, alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
      }
      state.result = state.anchorMap[alias];
      skipSeparationSpace(state, true, -1);
      return true;
    }
    function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
      const fallbackState = snapshotState(state);
      beginAnchorTransaction(state);
      restoreState(state, propertyStart);
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
        commitAnchorTransaction(state);
        return true;
      }
      rollbackAnchorTransaction(state);
      restoreState(state, fallbackState);
      return false;
    }
    function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
      let allowBlockScalars;
      let allowBlockCollections;
      let indentStatus = 1;
      let atNewLine = false;
      let hasContent = false;
      let propertyStart = null;
      let type;
      let flowIndent;
      let blockIndent;
      if (state.depth >= state.maxDepth) {
        throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
      }
      state.depth += 1;
      if (state.listener !== null) {
        state.listener("open", state);
      }
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
      if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        }
      }
      if (indentStatus === 1) {
        while (true) {
          const ch = state.input.charCodeAt(state.position);
          const propertyState = snapshotState(state);
          if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
            break;
          }
          if (!readTagProperty(state) && !readAnchorProperty(state)) {
            break;
          }
          if (propertyStart === null) {
            propertyStart = propertyState;
          }
          if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            allowBlockCollections = allowBlockStyles;
            if (state.lineIndent > parentIndent) {
              indentStatus = 1;
            } else if (state.lineIndent === parentIndent) {
              indentStatus = 0;
            } else if (state.lineIndent < parentIndent) {
              indentStatus = -1;
            }
          } else {
            allowBlockCollections = false;
          }
        }
      }
      if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
      }
      if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
          flowIndent = parentIndent;
        } else {
          flowIndent = parentIndent + 1;
        }
        blockIndent = state.position - state.lineStart;
        if (indentStatus === 1) {
          if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
            hasContent = true;
          } else {
            const ch = state.input.charCodeAt(state.position);
            if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
              state,
              propertyStart,
              propertyStart.position - propertyStart.lineStart,
              flowIndent
            )) {
              hasContent = true;
            } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
              hasContent = true;
            } else if (readAlias(state)) {
              hasContent = true;
              if (state.tag !== null || state.anchor !== null) {
                throwError(state, "alias node should not have any properties");
              }
            } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
              hasContent = true;
              if (state.tag === null) {
                state.tag = "?";
              }
            }
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
          }
        } else if (indentStatus === 0) {
          hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
      }
      if (state.tag === null) {
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      } else if (state.tag === "?") {
        if (state.result !== null && state.kind !== "scalar") {
          throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
        }
        for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
          type = state.implicitTypes[typeIndex];
          if (type.resolve(state.result)) {
            state.result = type.construct(state.result);
            state.tag = type.tag;
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
            break;
          }
        }
      } else if (state.tag !== "!") {
        if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
          type = state.typeMap[state.kind || "fallback"][state.tag];
        } else {
          type = null;
          const typeList = state.typeMap.multi[state.kind || "fallback"];
          for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
            if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
              type = typeList[typeIndex];
              break;
            }
          }
        }
        if (!type) {
          throwError(state, "unknown tag !<" + state.tag + ">");
        }
        if (state.result !== null && type.kind !== state.kind) {
          throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
        }
        if (!type.resolve(state.result, state.tag)) {
          throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
        } else {
          state.result = type.construct(state.result, state.tag);
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      }
      if (state.listener !== null) {
        state.listener("close", state);
      }
      state.depth -= 1;
      return state.tag !== null || state.anchor !== null || hasContent;
    }
    function readDocument(state) {
      const documentStart = state.position;
      let hasDirectives = false;
      let ch;
      state.version = null;
      state.checkLineBreaks = state.legacy;
      state.tagMap = /* @__PURE__ */ Object.create(null);
      state.anchorMap = /* @__PURE__ */ Object.create(null);
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if (state.lineIndent > 0 || ch !== 37) {
          break;
        }
        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        let _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        const directiveName = state.input.slice(_position, state.position);
        const directiveArgs = [];
        if (directiveName.length < 1) {
          throwError(state, "directive name must not be less than one character in length");
        }
        while (ch !== 0) {
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 35) {
            do {
              ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0 && !isEol(ch));
            break;
          }
          if (isEol(ch)) break;
          _position = state.position;
          while (ch !== 0 && !isWsOrEol(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          directiveArgs.push(state.input.slice(_position, state.position));
        }
        if (ch !== 0) readLineBreak(state);
        if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
          directiveHandlers[directiveName](state, directiveName, directiveArgs);
        } else {
          throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
      }
      skipSeparationSpace(state, true, -1);
      if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      } else if (hasDirectives) {
        throwError(state, "directives end mark is expected");
      }
      composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
      skipSeparationSpace(state, true, -1);
      if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
        throwWarning(state, "non-ASCII line breaks are interpreted as content");
      }
      state.documents.push(state.result);
      if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 46) {
          state.position += 3;
          skipSeparationSpace(state, true, -1);
        }
        return;
      }
      if (state.position < state.length - 1) {
        throwError(state, "end of the stream or a document separator is expected");
      }
    }
    function loadDocuments(input, options) {
      input = String(input);
      options = options || {};
      if (input.length !== 0) {
        if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
          input += "\n";
        }
        if (input.charCodeAt(0) === 65279) {
          input = input.slice(1);
        }
      }
      const state = new State(input, options);
      const nullpos = input.indexOf("\0");
      if (nullpos !== -1) {
        state.position = nullpos;
        throwError(state, "null byte is not allowed in input");
      }
      state.input += "\0";
      while (state.input.charCodeAt(state.position) === 32) {
        state.lineIndent += 1;
        state.position += 1;
      }
      while (state.position < state.length - 1) {
        readDocument(state);
      }
      return state.documents;
    }
    function loadAll(input, iterator, options) {
      if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
        options = iterator;
        iterator = null;
      }
      const documents = loadDocuments(input, options);
      if (typeof iterator !== "function") {
        return documents;
      }
      for (let index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
      }
    }
    function load(input, options) {
      const documents = loadDocuments(input, options);
      if (documents.length === 0) {
        return void 0;
      } else if (documents.length === 1) {
        return documents[0];
      }
      throw new YAMLException("expected a single document in the stream, but found more");
    }
    module2.exports.loadAll = loadAll;
    module2.exports.load = load;
  }
});

// ../kcd_sdk/node_modules/js-yaml/lib/dumper.js
var require_dumper = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/lib/dumper.js"(exports2, module2) {
    "use strict";
    var common = require_common();
    var YAMLException = require_exception();
    var DEFAULT_SCHEMA = require_default();
    var _toString = Object.prototype.toString;
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var CHAR_BOM = 65279;
    var CHAR_TAB = 9;
    var CHAR_LINE_FEED = 10;
    var CHAR_CARRIAGE_RETURN = 13;
    var CHAR_SPACE = 32;
    var CHAR_EXCLAMATION = 33;
    var CHAR_DOUBLE_QUOTE = 34;
    var CHAR_SHARP = 35;
    var CHAR_PERCENT = 37;
    var CHAR_AMPERSAND = 38;
    var CHAR_SINGLE_QUOTE = 39;
    var CHAR_ASTERISK = 42;
    var CHAR_COMMA = 44;
    var CHAR_MINUS = 45;
    var CHAR_COLON = 58;
    var CHAR_EQUALS = 61;
    var CHAR_GREATER_THAN = 62;
    var CHAR_QUESTION = 63;
    var CHAR_COMMERCIAL_AT = 64;
    var CHAR_LEFT_SQUARE_BRACKET = 91;
    var CHAR_RIGHT_SQUARE_BRACKET = 93;
    var CHAR_GRAVE_ACCENT = 96;
    var CHAR_LEFT_CURLY_BRACKET = 123;
    var CHAR_VERTICAL_LINE = 124;
    var CHAR_RIGHT_CURLY_BRACKET = 125;
    var ESCAPE_SEQUENCES = {};
    ESCAPE_SEQUENCES[0] = "\\0";
    ESCAPE_SEQUENCES[7] = "\\a";
    ESCAPE_SEQUENCES[8] = "\\b";
    ESCAPE_SEQUENCES[9] = "\\t";
    ESCAPE_SEQUENCES[10] = "\\n";
    ESCAPE_SEQUENCES[11] = "\\v";
    ESCAPE_SEQUENCES[12] = "\\f";
    ESCAPE_SEQUENCES[13] = "\\r";
    ESCAPE_SEQUENCES[27] = "\\e";
    ESCAPE_SEQUENCES[34] = '\\"';
    ESCAPE_SEQUENCES[92] = "\\\\";
    ESCAPE_SEQUENCES[133] = "\\N";
    ESCAPE_SEQUENCES[160] = "\\_";
    ESCAPE_SEQUENCES[8232] = "\\L";
    ESCAPE_SEQUENCES[8233] = "\\P";
    var DEPRECATED_BOOLEANS_SYNTAX = [
      "y",
      "Y",
      "yes",
      "Yes",
      "YES",
      "on",
      "On",
      "ON",
      "n",
      "N",
      "no",
      "No",
      "NO",
      "off",
      "Off",
      "OFF"
    ];
    var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
    function compileStyleMap(schema, map) {
      if (map === null) return {};
      const result = {};
      const keys = Object.keys(map);
      for (let index = 0, length = keys.length; index < length; index += 1) {
        let tag = keys[index];
        let style = String(map[tag]);
        if (tag.slice(0, 2) === "!!") {
          tag = "tag:yaml.org,2002:" + tag.slice(2);
        }
        const type = schema.compiledTypeMap["fallback"][tag];
        if (type && _hasOwnProperty.call(type.styleAliases, style)) {
          style = type.styleAliases[style];
        }
        result[tag] = style;
      }
      return result;
    }
    function encodeHex(character) {
      let handle;
      let length;
      const string = character.toString(16).toUpperCase();
      if (character <= 255) {
        handle = "x";
        length = 2;
      } else if (character <= 65535) {
        handle = "u";
        length = 4;
      } else if (character <= 4294967295) {
        handle = "U";
        length = 8;
      } else {
        throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
      }
      return "\\" + handle + common.repeat("0", length - string.length) + string;
    }
    var QUOTING_TYPE_SINGLE = 1;
    var QUOTING_TYPE_DOUBLE = 2;
    function State(options) {
      this.schema = options["schema"] || DEFAULT_SCHEMA;
      this.indent = Math.max(1, options["indent"] || 2);
      this.noArrayIndent = options["noArrayIndent"] || false;
      this.skipInvalid = options["skipInvalid"] || false;
      this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
      this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
      this.sortKeys = options["sortKeys"] || false;
      this.lineWidth = options["lineWidth"] || 80;
      this.noRefs = options["noRefs"] || false;
      this.noCompatMode = options["noCompatMode"] || false;
      this.condenseFlow = options["condenseFlow"] || false;
      this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
      this.forceQuotes = options["forceQuotes"] || false;
      this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
      this.implicitTypes = this.schema.compiledImplicit;
      this.explicitTypes = this.schema.compiledExplicit;
      this.tag = null;
      this.result = "";
      this.duplicates = [];
      this.usedDuplicates = null;
    }
    function indentString(string, spaces) {
      const ind = common.repeat(" ", spaces);
      let position = 0;
      let result = "";
      const length = string.length;
      while (position < length) {
        let line;
        const next = string.indexOf("\n", position);
        if (next === -1) {
          line = string.slice(position);
          position = length;
        } else {
          line = string.slice(position, next + 1);
          position = next + 1;
        }
        if (line.length && line !== "\n") result += ind;
        result += line;
      }
      return result;
    }
    function generateNextLine(state, level) {
      return "\n" + common.repeat(" ", state.indent * level);
    }
    function testImplicitResolving(state, str) {
      for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        const type = state.implicitTypes[index];
        if (type.resolve(str)) {
          return true;
        }
      }
      return false;
    }
    function isWhitespace(c) {
      return c === CHAR_SPACE || c === CHAR_TAB;
    }
    function isPrintable(c) {
      return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
    }
    function isNsCharOrWhitespace(c) {
      return isPrintable(c) && c !== CHAR_BOM && // - b-char
      c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
    }
    function isPlainSafe(c, prev, inblock) {
      const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
      const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
      return (
        // ns-plain-safe
        (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
        c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
        c !== CHAR_SHARP && // false on '#'
        !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
        isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
        prev === CHAR_COLON && cIsNsChar
      );
    }
    function isPlainSafeFirst(c) {
      return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
      // - (c-indicator ::=
      // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
      c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
      c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
      c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
    }
    function isPlainSafeLast(c) {
      return !isWhitespace(c) && c !== CHAR_COLON;
    }
    function codePointAt(string, pos) {
      const first = string.charCodeAt(pos);
      let second;
      if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
        second = string.charCodeAt(pos + 1);
        if (second >= 56320 && second <= 57343) {
          return (first - 55296) * 1024 + second - 56320 + 65536;
        }
      }
      return first;
    }
    function needIndentIndicator(string) {
      const leadingSpaceRe = /^\n* /;
      return leadingSpaceRe.test(string);
    }
    var STYLE_PLAIN = 1;
    var STYLE_SINGLE = 2;
    var STYLE_LITERAL = 3;
    var STYLE_FOLDED = 4;
    var STYLE_DOUBLE = 5;
    function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
      let i;
      let char = 0;
      let prevChar = null;
      let hasLineBreak = false;
      let hasFoldableLine = false;
      const shouldTrackWidth = lineWidth !== -1;
      let previousLineBreak = -1;
      let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
      if (singleLineOnly || forceQuotes) {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
      } else {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (char === CHAR_LINE_FEED) {
            hasLineBreak = true;
            if (shouldTrackWidth) {
              hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
              i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
              previousLineBreak = i;
            }
          } else if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
        hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
      }
      if (!hasLineBreak && !hasFoldableLine) {
        if (plain && !forceQuotes && !testAmbiguousType(string)) {
          return STYLE_PLAIN;
        }
        return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
      }
      if (indentPerLevel > 9 && needIndentIndicator(string)) {
        return STYLE_DOUBLE;
      }
      if (!forceQuotes) {
        return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    function writeScalar(state, string, level, iskey, inblock) {
      state.dump = function() {
        if (string.length === 0) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
        }
        if (!state.noCompatMode) {
          if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
            return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
          }
        }
        const indent = state.indent * Math.max(1, level);
        const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
        const singleLineOnly = iskey || // No block styles in flow mode.
        state.flowLevel > -1 && level >= state.flowLevel;
        function testAmbiguity(string2) {
          return testImplicitResolving(state, string2);
        }
        switch (chooseScalarStyle(
          string,
          singleLineOnly,
          state.indent,
          lineWidth,
          testAmbiguity,
          state.quotingType,
          state.forceQuotes && !iskey,
          inblock
        )) {
          case STYLE_PLAIN:
            return string;
          case STYLE_SINGLE:
            return "'" + string.replace(/'/g, "''") + "'";
          case STYLE_LITERAL:
            return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
          case STYLE_FOLDED:
            return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
          case STYLE_DOUBLE:
            return '"' + escapeString(string, lineWidth) + '"';
          default:
            throw new YAMLException("impossible error: invalid scalar style");
        }
      }();
    }
    function blockHeader(string, indentPerLevel) {
      const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
      const clip = string[string.length - 1] === "\n";
      const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
      const chomp = keep ? "+" : clip ? "" : "-";
      return indentIndicator + chomp + "\n";
    }
    function dropEndingNewline(string) {
      return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
    }
    function foldString(string, width) {
      const lineRe = /(\n+)([^\n]*)/g;
      let result = function() {
        let nextLF = string.indexOf("\n");
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
      }();
      let prevMoreIndented = string[0] === "\n" || string[0] === " ";
      let moreIndented;
      let match;
      while (match = lineRe.exec(string)) {
        const prefix = match[1];
        const line = match[2];
        moreIndented = line[0] === " ";
        result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
        prevMoreIndented = moreIndented;
      }
      return result;
    }
    function foldLine(line, width) {
      if (line === "" || line[0] === " ") return line;
      const breakRe = / [^ ]/g;
      let match;
      let start = 0;
      let end;
      let curr = 0;
      let next = 0;
      let result = "";
      while (match = breakRe.exec(line)) {
        next = match.index;
        if (next - start > width) {
          end = curr > start ? curr : next;
          result += "\n" + line.slice(start, end);
          start = end + 1;
        }
        curr = next;
      }
      result += "\n";
      if (line.length - start > width && curr > start) {
        result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
      } else {
        result += line.slice(start);
      }
      return result.slice(1);
    }
    function escapeString(string) {
      let result = "";
      let char = 0;
      for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        const escapeSeq = ESCAPE_SEQUENCES[char];
        if (!escapeSeq && isPrintable(char)) {
          result += string[i];
          if (char >= 65536) result += string[i + 1];
        } else {
          result += escapeSeq || encodeHex(char);
        }
      }
      return result;
    }
    function writeFlowSequence(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
          if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = "[" + _result + "]";
    }
    function writeBlockSequence(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
          if (!compact || _result !== "") {
            _result += generateNextLine(state, level);
          }
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            _result += "-";
          } else {
            _result += "- ";
          }
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = _result || "[]";
    }
    function writeFlowMapping(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (_result !== "") pairBuffer += ", ";
        if (state.condenseFlow) pairBuffer += '"';
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level, objectKey, false, false)) {
          continue;
        }
        if (state.dump.length > 1024) pairBuffer += "? ";
        pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
        if (!writeNode(state, level, objectValue, false, false)) {
          continue;
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = "{" + _result + "}";
    }
    function writeBlockMapping(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      if (state.sortKeys === true) {
        objectKeyList.sort();
      } else if (typeof state.sortKeys === "function") {
        objectKeyList.sort(state.sortKeys);
      } else if (state.sortKeys) {
        throw new YAMLException("sortKeys must be a boolean or a function");
      }
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (!compact || _result !== "") {
          pairBuffer += generateNextLine(state, level);
        }
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
          continue;
        }
        const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
        if (explicitPair) {
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += "?";
          } else {
            pairBuffer += "? ";
          }
        }
        pairBuffer += state.dump;
        if (explicitPair) {
          pairBuffer += generateNextLine(state, level);
        }
        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
          continue;
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += ":";
        } else {
          pairBuffer += ": ";
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = _result || "{}";
    }
    function detectType(state, object, explicit) {
      const typeList = explicit ? state.explicitTypes : state.implicitTypes;
      for (let index = 0, length = typeList.length; index < length; index += 1) {
        const type = typeList[index];
        if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
          if (explicit) {
            if (type.multi && type.representName) {
              state.tag = type.representName(object);
            } else {
              state.tag = type.tag;
            }
          } else {
            state.tag = "?";
          }
          if (type.represent) {
            const style = state.styleMap[type.tag] || type.defaultStyle;
            let _result;
            if (_toString.call(type.represent) === "[object Function]") {
              _result = type.represent(object, style);
            } else if (_hasOwnProperty.call(type.represent, style)) {
              _result = type.represent[style](object, style);
            } else {
              throw new YAMLException("!<" + type.tag + '> tag resolver accepts not "' + style + '" style');
            }
            state.dump = _result;
          }
          return true;
        }
      }
      return false;
    }
    function writeNode(state, level, object, block, compact, iskey, isblockseq) {
      state.tag = null;
      state.dump = object;
      if (!detectType(state, object, false)) {
        detectType(state, object, true);
      }
      const type = _toString.call(state.dump);
      const inblock = block;
      if (block) {
        block = state.flowLevel < 0 || state.flowLevel > level;
      }
      const objectOrArray = type === "[object Object]" || type === "[object Array]";
      let duplicateIndex;
      let duplicate;
      if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
      }
      if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
        compact = false;
      }
      if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = "*ref_" + duplicateIndex;
      } else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
          state.usedDuplicates[duplicateIndex] = true;
        }
        if (type === "[object Object]") {
          if (block && Object.keys(state.dump).length !== 0) {
            writeBlockMapping(state, level, state.dump, compact);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowMapping(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type === "[object Array]") {
          if (block && state.dump.length !== 0) {
            if (state.noArrayIndent && !isblockseq && level > 0) {
              writeBlockSequence(state, level - 1, state.dump, compact);
            } else {
              writeBlockSequence(state, level, state.dump, compact);
            }
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowSequence(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type === "[object String]") {
          if (state.tag !== "?") {
            writeScalar(state, state.dump, level, iskey, inblock);
          }
        } else if (type === "[object Undefined]") {
          return false;
        } else {
          if (state.skipInvalid) return false;
          throw new YAMLException("unacceptable kind of an object to dump " + type);
        }
        if (state.tag !== null && state.tag !== "?") {
          let tagStr = encodeURI(
            state.tag[0] === "!" ? state.tag.slice(1) : state.tag
          ).replace(/!/g, "%21");
          if (state.tag[0] === "!") {
            tagStr = "!" + tagStr;
          } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
            tagStr = "!!" + tagStr.slice(18);
          } else {
            tagStr = "!<" + tagStr + ">";
          }
          state.dump = tagStr + " " + state.dump;
        }
      }
      return true;
    }
    function getDuplicateReferences(object, state) {
      const objects = [];
      const duplicatesIndexes = [];
      inspectNode(object, objects, duplicatesIndexes);
      const length = duplicatesIndexes.length;
      for (let index = 0; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
      }
      state.usedDuplicates = new Array(length);
    }
    function inspectNode(object, objects, duplicatesIndexes) {
      if (object !== null && typeof object === "object") {
        const index = objects.indexOf(object);
        if (index !== -1) {
          if (duplicatesIndexes.indexOf(index) === -1) {
            duplicatesIndexes.push(index);
          }
        } else {
          objects.push(object);
          if (Array.isArray(object)) {
            for (let i = 0, length = object.length; i < length; i += 1) {
              inspectNode(object[i], objects, duplicatesIndexes);
            }
          } else {
            const objectKeyList = Object.keys(object);
            for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
              inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
            }
          }
        }
      }
    }
    function dump(input, options) {
      options = options || {};
      const state = new State(options);
      if (!state.noRefs) getDuplicateReferences(input, state);
      let value = input;
      if (state.replacer) {
        value = state.replacer.call({ "": value }, "", value);
      }
      if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
      return "";
    }
    module2.exports.dump = dump;
  }
});

// ../kcd_sdk/node_modules/js-yaml/index.js
var require_js_yaml = __commonJS({
  "../kcd_sdk/node_modules/js-yaml/index.js"(exports2, module2) {
    "use strict";
    var loader = require_loader();
    var dumper = require_dumper();
    function renamed(from, to) {
      return function() {
        throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
      };
    }
    module2.exports.Type = require_type();
    module2.exports.Schema = require_schema();
    module2.exports.FAILSAFE_SCHEMA = require_failsafe();
    module2.exports.JSON_SCHEMA = require_json();
    module2.exports.CORE_SCHEMA = require_core2();
    module2.exports.DEFAULT_SCHEMA = require_default();
    module2.exports.load = loader.load;
    module2.exports.loadAll = loader.loadAll;
    module2.exports.dump = dumper.dump;
    module2.exports.YAMLException = require_exception();
    module2.exports.types = {
      binary: require_binary(),
      float: require_float(),
      map: require_map(),
      null: require_null(),
      pairs: require_pairs(),
      set: require_set(),
      timestamp: require_timestamp(),
      bool: require_bool(),
      int: require_int(),
      merge: require_merge(),
      omap: require_omap(),
      seq: require_seq(),
      str: require_str()
    };
    module2.exports.safeLoad = renamed("safeLoad", "load");
    module2.exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
    module2.exports.safeDump = renamed("safeDump", "dump");
  }
});

// ../kcd_sdk/dist/scanner/scanner.js
var require_scanner = __commonJS({
  "../kcd_sdk/dist/scanner/scanner.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.scan = scan;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var yaml = __importStar(require_js_yaml());
    var KcdParse_1 = require_KcdParse();
    var SCAN_EXTS = [".html", ".js"];
    var JS_FRONTMATTER_RE = /^\/\*---\r?\n([\s\S]*?)\r?\n---\s*\*\/\r?\n?([\s\S]*)$/;
    var LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
    function scan(root, opts) {
      const absRoot = path3.resolve(root);
      const topDirs = opts?.includeDirs ? new Set(opts.includeDirs) : null;
      const files = walkFiles(absRoot, topDirs);
      return files.map((absPath) => parseFile(absPath, absRoot)).filter((f) => f !== null).filter((f) => !opts?.filter || f.relativePath.includes(opts.filter));
    }
    function walkFiles(dir, topDirs, atRoot = true) {
      const results = [];
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return results;
      }
      for (const entry of entries) {
        const fullPath = path3.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (atRoot && topDirs && !topDirs.has(entry.name))
            continue;
          results.push(...walkFiles(fullPath, topDirs, false));
        } else if (entry.isFile() && SCAN_EXTS.some((ext) => entry.name.endsWith(ext))) {
          results.push(fullPath);
        }
      }
      return results;
    }
    function parseFile(absPath, absRoot) {
      const raw = fs.readFileSync(absPath, "utf-8");
      const relativePath = path3.relative(absRoot, absPath).replace(/\\/g, "/");
      if (/\.html?$/i.test(absPath)) {
        const parsed = KcdParse_1.KcdParse.tryParse(raw, absPath);
        if (!parsed)
          return null;
        return {
          path: absPath,
          relativePath,
          frontmatter: parsed.frontmatter,
          rawLinks: parsed.links.map((l) => ({ text: l.text, href: l.href })),
          rawAddresses: (parsed.addresses ?? []).map((a) => ({ value: a.value, text: a.text })),
          body: parsed.body
        };
      }
      const { frontmatter, body } = parseJsFrontmatter(raw);
      return { path: absPath, relativePath, frontmatter, rawLinks: extractLinks(body), rawAddresses: [], body };
    }
    function parseJsFrontmatter(content) {
      const match = content.match(JS_FRONTMATTER_RE);
      if (!match)
        return { frontmatter: {}, body: content };
      let frontmatter = {};
      try {
        const parsed = yaml.load(match[1]);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          frontmatter = parsed;
        }
      } catch {
      }
      return { frontmatter, body: match[2] ?? "" };
    }
    function extractLinks(body) {
      const links = [];
      LINK_RE.lastIndex = 0;
      let match;
      while ((match = LINK_RE.exec(body)) !== null) {
        links.push({ text: match[1], href: match[2] });
      }
      return links;
    }
  }
});

// ../kcd_sdk/dist/scanner/index.js
var require_scanner2 = __commonJS({
  "../kcd_sdk/dist/scanner/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.scan = void 0;
    var scanner_1 = require_scanner();
    Object.defineProperty(exports2, "scan", { enumerable: true, get: function() {
      return scanner_1.scan;
    } });
  }
});

// ../kcd_sdk/dist/server/McpServer.js
var require_McpServer = __commonJS({
  "../kcd_sdk/dist/server/McpServer.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.McpServer = void 0;
    var readline3 = __importStar(require("readline"));
    var PARSE_ERROR2 = -32700;
    var INVALID_REQUEST2 = -32600;
    var METHOD_NOT_FOUND2 = -32601;
    var INVALID_PARAMS2 = -32602;
    var PROTOCOL_VERSION2 = "2024-11-05";
    var McpServer2 = class {
      info;
      tools = /* @__PURE__ */ new Map();
      constructor(info) {
        this.info = info;
      }
      /** Register a tool. Last registration of a name wins. */
      registerTool(def) {
        this.tools.set(def.name, def);
      }
      /**
       * Start the read loop. Resolves when stdin closes (client disconnected) — the
       * caller can then exit. Each input line is one JSON-RPC message.
       */
      connect() {
        const rl = readline3.createInterface({ input: process.stdin });
        rl.on("line", (line) => {
          const trimmed = line.trim();
          if (trimmed.length === 0)
            return;
          void this.handleLine(trimmed);
        });
        return new Promise((resolve3) => rl.on("close", resolve3));
      }
      // ── Dispatch ────────────────────────────────────────────────────────────────
      async handleLine(line) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          this.sendError(null, PARSE_ERROR2, "Parse error: invalid JSON");
          return;
        }
        if (typeof msg.method !== "string") {
          if (msg.id !== void 0)
            this.sendError(msg.id, INVALID_REQUEST2, "Invalid request: missing method");
          return;
        }
        const isNotification = msg.id === void 0;
        try {
          switch (msg.method) {
            case "initialize":
              this.reply(msg.id, this.onInitialize(msg.params));
              return;
            case "tools/list":
              this.reply(msg.id, this.onToolsList());
              return;
            case "tools/call":
              this.reply(msg.id, await this.onToolsCall(msg.params));
              return;
            case "ping":
              this.reply(msg.id, {});
              return;
            default:
              if (!isNotification)
                this.sendError(msg.id, METHOD_NOT_FOUND2, `Method not found: ${msg.method}`);
              return;
          }
        } catch (e) {
          if (!isNotification)
            this.sendError(msg.id, INVALID_PARAMS2, errorText3(e));
        }
      }
      // ── Method handlers ───────────────────────────────────────────────────────────
      onInitialize(params) {
        const requested = typeof params?.["protocolVersion"] === "string" ? params["protocolVersion"] : PROTOCOL_VERSION2;
        return {
          protocolVersion: requested,
          capabilities: { tools: {} },
          serverInfo: { name: this.info.name, version: this.info.version }
        };
      }
      /**
       * The wire tool surface — the exact array `tools/list` sends, exposed publicly so tooling can read a
       * built server's surface WITHOUT spawning it over stdio (the promotion script regenerates the committed
       * `tools.snapshot.json` from this — authoritative by construction, since it is the same projection the
       * wire uses). No handlers, no protocol framing: just the descriptors a client sees.
       */
      listTools() {
        return [...this.tools.values()].map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          // Only emit the key when a tool declares hints — a client sees `annotations` or nothing.
          ...t.annotations ? { annotations: t.annotations } : {},
          ...t.example ? { example: t.example } : {},
          ...t.doc ? { doc: t.doc } : {}
        }));
      }
      onToolsList() {
        return { tools: this.listTools() };
      }
      async onToolsCall(params) {
        const name = params?.["name"];
        if (typeof name !== "string") {
          throw new Error('tools/call requires a string "name"');
        }
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }
        const args = params?.["arguments"] ?? {};
        return this.invoke(name, args);
      }
      /**
       * Run a registered tool in-process by name — the dispatch a COMPOSING tool ( e.g. a batch ) uses
       * without going over the wire. Same contract as a wire call: a handler that throws folds into an
       * isError result, never propagating. An unknown tool is an isError result too — unlike a wire
       * tools/call ( which raises a protocol error ), there is no protocol layer here, so a caller can
       * treat every outcome uniformly as a ToolResult.
       */
      async invoke(name, args) {
        const tool = this.tools.get(name);
        if (!tool)
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
        try {
          return await tool.handler(args);
        } catch (e) {
          return { content: [{ type: "text", text: errorText3(e) }], isError: true };
        }
      }
      // ── Wire I/O ──────────────────────────────────────────────────────────────────
      reply(id, result) {
        this.write({ jsonrpc: "2.0", id, result });
      }
      sendError(id, code, message) {
        this.write({ jsonrpc: "2.0", id: id ?? void 0, error: { code, message } });
      }
      write(msg) {
        process.stdout.write(JSON.stringify(msg) + "\n");
      }
    };
    exports2.McpServer = McpServer2;
    function errorText3(e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
});

// ../kcd_sdk/dist/server/verify.js
var require_verify = __commonJS({
  "../kcd_sdk/dist/server/verify.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runVerify = runVerify2;
    async function runVerify2(registrations, manifest) {
      const tools = [];
      for (const { def, spec } of registrations) {
        const cases = [];
        for (const tc of spec)
          cases.push(await runCase2(def, tc));
        const passed = cases.filter((c) => c.pass).length;
        tools.push({ name: def.name, passed, failed: cases.length - passed, cases });
      }
      return {
        server_id: manifest.id,
        version: manifest.version,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        tools,
        overall: tools.every((t) => t.failed === 0) ? "pass" : "fail"
      };
    }
    async function runCase2(def, tc) {
      let result;
      try {
        result = await def.handler(tc.input);
      } catch (e) {
        result = { content: [{ type: "text", text: errorText3(e) }], isError: true };
      }
      return { label: tc.label, ...judge2(tc.assertions, result) };
    }
    function judge2(assertions, result) {
      if (assertions.some((a) => a.type === "error_expected")) {
        return result.isError === true ? { pass: true } : { pass: false, detail: "expected an error result, got success" };
      }
      if (result.isError) {
        return { pass: false, detail: `unexpected error: ${textOf2(result)}` };
      }
      if (assertions.length === 0)
        return { pass: true };
      let data;
      try {
        data = JSON.parse(textOf2(result));
      } catch {
        return { pass: false, detail: "result payload was not JSON, but assertions require a JSON object" };
      }
      for (const a of assertions) {
        const detail = checkOne2(a, data);
        if (detail)
          return { pass: false, detail };
      }
      return { pass: true };
    }
    function checkOne2(a, data) {
      switch (a.type) {
        case "has_key":
          return a.key in data ? "" : `missing key "${a.key}"`;
        case "type_is": {
          const actual = typeName2(data[a.key]);
          return actual === a.expected ? "" : `key "${a.key}" is ${actual}, expected ${a.expected}`;
        }
        case "value_eq":
          return JSON.stringify(data[a.key]) === JSON.stringify(a.expected) ? "" : `key "${a.key}" did not equal the expected value`;
        case "error_expected":
          return "";
      }
    }
    function typeName2(v) {
      if (v === null)
        return "null";
      if (Array.isArray(v))
        return "array";
      return typeof v;
    }
    function textOf2(result) {
      return result.content[0]?.text ?? "";
    }
    function errorText3(e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
});

// ../kcd_sdk/dist/server/StarmindServer.js
var require_StarmindServer = __commonJS({
  "../kcd_sdk/dist/server/StarmindServer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.StarmindServer = void 0;
    var McpServer_1 = require_McpServer();
    var verify_1 = require_verify();
    var StarmindServer = class {
      /**
       * Declared by every subclass. Read statically so tooling can inventory a
       * server without constructing one (the promotion script reads it directly).
       */
      static manifest;
      server;
      registrations = [];
      built = false;
      constructor() {
        const m = this.ownManifest();
        this.server = new McpServer_1.McpServer({ name: m.name, version: m.version });
      }
      /**
       * Register a tool and (optionally) the TestSpecs that verify it, in one call.
       * Config-object shape — mirrors Anthropic's tool descriptor. The wire fields
       * pass through to the McpServer; the spec is stashed for verify().
       */
      registerTool(def) {
        const { spec, ...tool } = def;
        const example = tool.example ?? spec?.[0]?.input;
        this.server.registerTool(example ? { ...tool, example } : tool);
        this.registrations.push({ def: tool, spec: spec ?? [] });
      }
      /** Prove every tool against its TestSpecs, in-process. Delegated to verify.ts. */
      async verify() {
        this.ensureBuilt();
        return (0, verify_1.runVerify)(this.registrations, this.ownManifest());
      }
      /**
       * The built wire tool surface — the exact `tools/list` array, without spawning the server. Builds
       * first (idempotent), then reads it off the underlying McpServer. The promotion script uses this to
       * regenerate the committed tool snapshot authoritatively (the cache the app boots dormant from).
       */
      wireTools() {
        this.ensureBuilt();
        return this.server.listTools();
      }
      /** Build the tool surface, then serve it on stdio until the client disconnects. */
      async run() {
        this.ensureBuilt();
        await this.server.connect();
      }
      /**
       * Run a registered tool in-process by name — the seam a COMPOSING tool ( e.g. a batch ) dispatches
       * through to run other tools in sequence. Builds first ( idempotent ), then delegates to the
       * McpServer's own dispatch, so an internal call obeys the exact same contract as a wire call. A
       * subclass wires this into such a tool at build() time ( `batchTools( ( n, a ) => this.invoke( n, a ) )` ).
       */
      invoke(name, args) {
        this.ensureBuilt();
        return this.server.invoke(name, args);
      }
      // ── Internals ─────────────────────────────────────────────────────────────────
      ensureBuilt() {
        if (this.built)
          return;
        this.build();
        this.built = true;
      }
      /** The subclass's static manifest, reached through the instance's constructor. */
      ownManifest() {
        return this.constructor.manifest;
      }
      // ── Live doc ──────────────────────────────────────────────────────────────────
      /**
       * The server's doc-block as served right now — the recursive parent of its tools' docs,
       * generated fresh rather than frozen at author-time. Default: the static manifest's authored
       * `doc`, unchanged. A subclass overrides this to fold in runtime data (live config, current
       * state) so what an agent reads reflects the server as it stands at the moment its tools are
       * attached to context, not just what was true when the manifest was written.
       */
      liveDoc() {
        return this.ownManifest().doc ?? "";
      }
    };
    exports2.StarmindServer = StarmindServer;
  }
});

// ../kcd_sdk/dist/server/index.js
var require_server = __commonJS({
  "../kcd_sdk/dist/server/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.StarmindServer = exports2.McpServer = void 0;
    var McpServer_1 = require_McpServer();
    Object.defineProperty(exports2, "McpServer", { enumerable: true, get: function() {
      return McpServer_1.McpServer;
    } });
    var StarmindServer_1 = require_StarmindServer();
    Object.defineProperty(exports2, "StarmindServer", { enumerable: true, get: function() {
      return StarmindServer_1.StarmindServer;
    } });
  }
});

// ../kcd_sdk/dist/node/io.js
var require_io = __commonJS({
  "../kcd_sdk/dist/node/io.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.fsReader = void 0;
    exports2.inferProjectRoot = inferProjectRoot2;
    exports2.loadLensFromDisk = loadLensFromDisk;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var core_1 = require_core();
    var fsReader = (absPath) => fs.readFileSync(absPath, "utf-8");
    exports2.fsReader = fsReader;
    function inferProjectRoot2(startPath, docRoot = core_1.LensObject.DEFAULT_DOC_ROOT) {
      let dir = path3.dirname(path3.resolve(startPath));
      while (true) {
        if (fs.existsSync(path3.join(dir, docRoot)))
          return dir;
        const parent = path3.dirname(dir);
        if (parent === dir)
          break;
        dir = parent;
      }
      throw new Error(`Could not infer projectRoot from "${startPath}" \u2014 no ancestor contains "${docRoot}"`);
    }
    function loadLensFromDisk(lensPath, opts) {
      const projectRoot = opts?.projectRoot ?? inferProjectRoot2(lensPath);
      return core_1.LensObject.load(lensPath, { projectRoot, depth: opts?.depth, eager: opts?.eager, read: exports2.fsReader });
    }
  }
});

// ../kcd_sdk/dist/node/Vault.js
var require_Vault = __commonJS({
  "../kcd_sdk/dist/node/Vault.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Vault = void 0;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var core_1 = require_core();
    var scanner_1 = require_scanner2();
    var io_1 = require_io();
    var NAV_INDEX_FILE = "nav-index.html";
    var Vault3 = class _Vault {
      projectRoot;
      docRoot;
      /** Absolute vault root — projectRoot/docRoot, resolved once. */
      root;
      constructor(projectRoot, docRoot = core_1.LensObject.DEFAULT_DOC_ROOT) {
        this.projectRoot = projectRoot;
        this.docRoot = docRoot;
        this.root = path3.resolve(path3.join(projectRoot, docRoot));
      }
      /** Build a Vault by walking up from a start path until an ancestor holds the doc root. */
      static infer(startPath, docRoot = core_1.LensObject.DEFAULT_DOC_ROOT) {
        return new _Vault((0, io_1.inferProjectRoot)(startPath, docRoot), docRoot);
      }
      // ── Path math ───────────────────────────────────────────────────────────
      /**
       * Vault-relative path → absolute path anchored at the vault root.
       * Absolute inputs are normalized as-is ( isInside still rejects out-of-vault ones ),
       * so callers passing absolute paths keep working regardless of process cwd.
       */
      toAbs(vaultRelative) {
        return path3.isAbsolute(vaultRelative) ? path3.normalize(vaultRelative) : path3.resolve(this.root, vaultRelative);
      }
      /** Absolute ( or vault-relative ) path → vault-relative path, for return payloads. */
      toVaultRel(anyPath) {
        return path3.relative(this.root, this.toAbs(anyPath));
      }
      /** True when the path resolves inside the vault root — the path-jail predicate. */
      isInside(anyPath) {
        const rel = path3.relative(this.root, this.toAbs(anyPath));
        return !rel.startsWith("..") && !path3.isAbsolute(rel);
      }
      // ── KCD semantics ─────────────────────────────────────────────────────────
      /** Classify a path ( vault-relative or absolute ) into its ArtifactType. */
      classify(anyPath) {
        return core_1.LensObject.classifyByPath(this.toAbs(anyPath), this.projectRoot, this.docRoot);
      }
      /** Resolve a raw link href to an absolute path, against this vault's project root. */
      resolveHref(href) {
        return core_1.LensObject.resolveHref(href, this.projectRoot);
      }
      /**
       * Is this vault-relative path part of the LIBRARY — i.e. a governed artifact rather than scratch?
       *
       * `VaultLayout` already marks six directories `indexed: false` and calls them, in its own words,
       * "scratch and output space, not a gap". Validation has never honoured that: `scan()` walks the
       * whole root, so backups, work notes, and `.js` dev utilities were all graded as KCD documents.
       * That accounted for roughly half of every issue this vault has ever reported. Reported drift in
       * a frozen backup is not drift; it is a category error.
       */
      isLibraryPath(relPath) {
        return !core_1.VaultLayout.isEphemeralHref(relPath);
      }
      /** Is anything on disk at this href/address? A plain fact — never a verdict ( protocol §1.1 ). */
      exists(href) {
        return fs.existsSync(this.resolveHref(href));
      }
      /** A scanned file → its ArtifactRef ( vault-relative path + type + display name ). */
      toRef(file) {
        return {
          path: file.relativePath,
          type: this.classify(file.path),
          name: typeof file.frontmatter["name"] === "string" ? file.frontmatter["name"] : path3.basename(file.relativePath, ".html")
        };
      }
      // ── Disk ────────────────────────────────────────────────────────────────
      /** Scan the whole vault, returning every artifact file with parsed frontmatter and links. */
      scan() {
        return (0, scanner_1.scan)(this.root);
      }
      /**
       * How many artifacts this vault holds — a COUNT, not a scan.
       *
       * Walks the same `VaultLayout` indexed directories the real index walks and counts `.html` files
       * without opening any of them. `scan()` parses frontmatter and links on every file, which is the
       * right cost when you need the artifacts and far too much when you only need the number: this
       * answers a landing card for EVERY registered project, including the ones that are not open and
       * therefore have no in-memory index to ask.
       *
       * `nav-index.html` is excluded, matching the library chart — a navigation stub is scaffolding for
       * the artifacts, not one of them, and counting it would inflate a fresh vault to look non-empty.
       *
       * Total: an unreadable directory is skipped, not thrown. A count is orientation, and a permission
       * error on one folder should cost that folder's files, not the whole number.
       */
      countArtifacts() {
        let total = 0;
        const walk = (dir) => {
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            if (entry.isDirectory()) {
              walk(path3.join(dir, entry.name));
              continue;
            }
            const name = entry.name.toLowerCase();
            if (!name.endsWith(".html") || name === NAV_INDEX_FILE)
              continue;
            total += 1;
          }
        };
        for (const dir of core_1.VaultLayout.indexedDirs())
          walk(path3.join(this.root, dir));
        return total;
      }
      /** Scanned files whose vault-relative path matches a glob ( * within a segment, ** across ). */
      glob(pattern) {
        return this.scan().filter((f) => core_1.Glob.matches(f.relativePath, pattern));
      }
      /** Raw file content at a vault path ( HTML for artifacts ). */
      read(vaultRelative) {
        return fs.readFileSync(this.toAbs(vaultRelative), "utf-8");
      }
      /** Write content to a vault path ( creating parent dirs ); returns the vault-relative path written. */
      write(vaultRelative, content) {
        const abs = this.toAbs(vaultRelative);
        fs.mkdirSync(path3.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf-8");
        return this.toVaultRel(abs);
      }
      /** Dredge a lens from a vault path, with the real fs reader injected. */
      loadLens(vaultRelative, opts) {
        return (0, io_1.loadLensFromDisk)(this.toAbs(vaultRelative), {
          projectRoot: this.projectRoot,
          depth: opts?.depth,
          eager: opts?.eager
        });
      }
      // ── Authoring / heal ──────────────────────────────────────────────────────
      /**
       * Move ( or rename ) an artifact AND heal every inbound link so the graph never rots.
       *
       * Every referrer authors the target as a project-root-relative href ( `_Claude/...` ), so healing
       * is a targeted swap of that one authored string in each referrer — keyed off the link's RESOLVED
       * identity, not a text grep — which preserves the hand-authored formatting a full HtmlTree
       * round-trip would normalize away. The HealPlan is computed first, then applied unless `dryRun`
       * ( the approval seam ). On apply it rewrites each referrer, renames the file, and asserts the
       * post-condition: no link may still resolve to the old path ( a residual throws — fail loud ).
       */
      move(from, to, opts) {
        const fromAbs = this.toAbs(from);
        const destAbs = this.toAbs(to);
        if (!fs.existsSync(fromAbs))
          throw new Error(`Cannot move: source "${from}" does not exist`);
        if (fs.existsSync(destAbs))
          throw new Error(`Cannot move: destination "${to}" already exists`);
        const newHref = `${this.docRoot}/${to}`.replace(/\\/g, "/");
        const plan = { op: "move", from, to, edits: this.inboundEdits(fromAbs, newHref) };
        if (opts?.dryRun)
          return plan;
        for (const edit of plan.edits)
          this.rewriteHref(edit);
        fs.mkdirSync(path3.dirname(destAbs), { recursive: true });
        fs.renameSync(fromAbs, destAbs);
        this.assertNoResidual(fromAbs, "move");
        return plan;
      }
      /**
       * Every inbound link to `targetAbs`, as heal edits — the referrer, its exact authored href, and
       * ( on a move ) the replacement. Matches on RESOLVED identity, so an href authored in any relative
       * form still counts; skips the target's own file.
       */
      inboundEdits(targetAbs, newHref) {
        const edits = [];
        for (const f of this.scan()) {
          if (f.path === targetAbs)
            continue;
          for (const link of f.rawLinks) {
            if (this.resolveHref(link.href) !== targetAbs)
              continue;
            edits.push({ file: f.relativePath, oldHref: link.href, newHref });
          }
        }
        return edits;
      }
      /**
       * Apply one move edit to disk — swap the authored old href for the new one in the referrer, in
       * both HTML ( `href="…"` / `href='…'` ) and `.js` comment ( `[text](…)` ) forms. Literal replace of
       * every occurrence ( split/join, never a regex — a path with metacharacters is safe ). A no-op
       * ( nothing matched ) is left for assertNoResidual to catch rather than silently swallowed.
       */
      rewriteHref(edit) {
        if (edit.newHref === void 0)
          return;
        const abs = this.toAbs(edit.file);
        const before = fs.readFileSync(abs, "utf-8");
        const after = before.split(`href="${edit.oldHref}"`).join(`href="${edit.newHref}"`).split(`href='${edit.oldHref}'`).join(`href='${edit.newHref}'`).split(`](${edit.oldHref})`).join(`](${edit.newHref})`);
        if (after !== before)
          fs.writeFileSync(abs, after, "utf-8");
      }
      /**
       * Post-condition guard: after an apply, NO link in the vault may still resolve to the old path.
       * A residual means a reference form the healer did not cover ( e.g. an href authored in a shape the
       * swap did not match ) — throw rather than leave the graph rotted.
       */
      assertNoResidual(targetAbs, op) {
        const residual = this.inboundEdits(targetAbs);
        if (residual.length === 0)
          return;
        const where = residual.map((e) => e.file).join(", ");
        throw new Error(`${op} heal incomplete: ${residual.length} link(s) still resolve to "${this.toVaultRel(targetAbs)}" ( in ${where} )`);
      }
      /**
       * Delete an artifact AND cascade the removal through every referrer, so the graph stays viable.
       *
       * BLOCKS ( nothing deleted ) if anything references the target by IDENTITY — a `base`/`lens` slug
       * naming it. An identity ref survives a move and is not a movable link; silently unparenting the
       * dependents would be wrong, so the caller repoints or renames them first. Otherwise every inbound
       * href reference is EXCISED from its referrer: a slot-field link takes its whole data-kcd-slot record,
       * a bare prose `<a>` unwraps to its text — span-precise ( KcdExcise ), so formatting elsewhere is
       * untouched. Computes the HealPlan first ( `dryRun` = preview ), then applies, removes the file, and
       * asserts no link still resolves to it ( a residual throws — fail loud ).
       */
      delete(target, opts) {
        const targetAbs = this.toAbs(target);
        if (!fs.existsSync(targetAbs))
          throw new Error(`Cannot delete: "${target}" does not exist`);
        const dependents = this.identityDependents(targetAbs);
        if (dependents.length > 0)
          throw new Error(`Cannot delete "${target}": ${dependents.length} artifact(s) reference it by identity ( ${dependents.join(", ")} ) \u2014 repoint or rename those first`);
        const plan = { op: "delete", from: target, edits: this.inboundEdits(targetAbs) };
        if (opts?.dryRun)
          return plan;
        this.exciseReferrers(plan.edits, targetAbs);
        fs.rmSync(targetAbs);
        this.assertNoResidual(targetAbs, "delete");
        return plan;
      }
      /** Artifacts that reference `targetAbs` by IDENTITY — a `base` or `lens` frontmatter slug naming it.
       *  These block a delete ( unlike href links, which heal ). Returns their vault-relative paths. */
      identityDependents(targetAbs) {
        const files = this.scan();
        const target = files.find((f) => f.path === targetAbs);
        const name = target && typeof target.frontmatter["name"] === "string" ? target.frontmatter["name"] : "";
        if (!name)
          return [];
        const out = [];
        for (const f of files) {
          if (f.path === targetAbs)
            continue;
          if (f.frontmatter["base"] === name || f.frontmatter["lens"] === name)
            out.push(f.relativePath);
        }
        return out;
      }
      /** Excise every deleted-target reference from its referrers — one parse+splice per file ( a file may
       *  hold several ), routed to the HTML or `.js` surgeon by extension, matched on resolved identity. */
      exciseReferrers(edits, targetAbs) {
        const matches = (href) => this.resolveHref(href) === targetAbs;
        for (const file of new Set(edits.map((e) => e.file))) {
          const abs = this.toAbs(file);
          const before = fs.readFileSync(abs, "utf-8");
          const after = abs.endsWith(".js") ? core_1.KcdExcise.js(before, matches) : core_1.KcdExcise.html(before, matches);
          if (after !== before)
            fs.writeFileSync(abs, after, "utf-8");
        }
      }
      // ── Reference integrity ────────────────────────────────────────────────────
      /**
       * Reference-integrity findings across the vault ( or one file, when `onlyFile` is given ) — the
       * hygiene half of health, complementing the per-file structural typeCheck:
       *
       *   • Dangling links — an internal link href whose target does not exist on disk. Code-file links
       *     count ( a lens Know table legitimately points at `.ts` ); external URLs, `#anchors`, and
       *     `{placeholder}` template hrefs are skipped.
       *   • Broken identity refs — a `base` / `lens` slug that names no artifact in the vault. The `cross`
       *     sentinel ( a multi-lens plan's `lens` ) is not a reference and is skipped.
       *
       * All findings are `warn`: advisory, never a parse-blocking error. `names` is built from the whole
       * scan even when scoped to one file, so a scoped identity ref still resolves against the full vault.
       */
      referenceIssues(onlyFile) {
        const files = this.scan();
        const names = new Set(files.map((f) => typeof f.frontmatter["name"] === "string" ? f.frontmatter["name"] : ""));
        const targets = onlyFile ? files.filter((f) => f.path === this.toAbs(onlyFile)) : files.filter((f) => this.isLibraryPath(f.relativePath));
        const issues = [];
        for (const f of targets) {
          for (const link of f.rawLinks) {
            const href = link.href;
            if (href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://"))
              continue;
            if (href.includes("{"))
              continue;
            if (!fs.existsSync(this.resolveHref(href)))
              issues.push({ path: f.relativePath, severity: "warn", message: `link target missing on disk: "${href}"`, ref: href });
          }
          for (const key of ["base", "lens"]) {
            const v = f.frontmatter[key];
            if (typeof v !== "string" || v === "" || v === "cross")
              continue;
            if (!names.has(v))
              issues.push({ path: f.relativePath, severity: "warn", message: `${key} "${v}" names no artifact in the vault`, ref: v });
          }
        }
        return issues;
      }
      /**
       * Which addresses in the vault are currently VACANT — nothing occupies them yet.
       *
       * Deliberately NOT part of `referenceIssues`, and deliberately not an issue of any severity
       * ( protocol §1.1, rule 3 ). A vacant address is a legal state; surfacing it in the health stream
       * would recreate exactly the noise the address primitive was introduced to remove. This is an
       * on-request inventory for someone who wants to know what has been promised and not yet written —
       * a to-do list, not a defect list.
       *
       * An address resolves either as an artifact NAME ( through the same name index `base`/`lens` use,
       * so it survives a move ) or as a project-root-relative PATH.
       */
      vacantAddresses(onlyFile) {
        const files = this.scan();
        const names = new Set(files.map((f) => typeof f.frontmatter["name"] === "string" ? f.frontmatter["name"] : "").filter((n) => n !== ""));
        const targets = onlyFile ? files.filter((f) => f.path === this.toAbs(onlyFile)) : files;
        const out = [];
        for (const f of targets) {
          for (const a of f.rawAddresses ?? []) {
            if (names.has(a.value))
              continue;
            if (fs.existsSync(this.resolveHref(a.value)))
              continue;
            out.push({ path: f.relativePath, address: a.value, text: a.text });
          }
        }
        return out;
      }
    };
    exports2.Vault = Vault3;
  }
});

// ../kcd_sdk/dist/node/VaultUtilities.js
var require_VaultUtilities = __commonJS({
  "../kcd_sdk/dist/node/VaultUtilities.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.VaultUtilities = void 0;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var primitives_1 = require_primitives();
    var core_1 = require_core();
    var ROOT_CONTEXT_PATH = "root-context.html";
    var DOC_ROOT_PREFIX = "_Claude";
    var VaultUtilities4 = class _VaultUtilities {
      /**
       * Validate one artifact ( `onlyFile` given ) or the whole vault ( omitted ) on two axes:
       *
       *   STRUCTURAL ( per file ) — parse the artifact and run its type rules. A parse failure
       *   becomes an `error` issue rather than aborting the sweep.
       *
       *   REFERENCE INTEGRITY ( cross-file, advisory ) — dangling links and unresolved base/lens
       *   refs. The logic lives in `vault.referenceIssues`; this only folds it into one list.
       *
       * Returns `{ issues, summary }`. The pre-flight before a save/move sweep and the observable
       * form of the "internal state always viable" invariant.
       */
      static health(vault, onlyFile) {
        const issues = [];
        const checkFile = (filePath) => {
          const rel = vault.toVaultRel(filePath);
          try {
            const artifact = primitives_1.KCDPrimitive.fromHtml(vault.read(filePath), vault.toAbs(filePath));
            for (const issue of artifact.typeCheck())
              issues.push({ path: rel, ...issue });
          } catch (e) {
            issues.push({
              path: rel,
              severity: "error",
              message: e instanceof Error ? e.message : String(e)
            });
          }
        };
        if (onlyFile) {
          checkFile(onlyFile);
        } else {
          for (const f of vault.scan())
            if (vault.isLibraryPath(f.relativePath) && /\.html?$/i.test(f.relativePath))
              checkFile(f.path);
        }
        for (const ri of vault.referenceIssues(onlyFile || void 0))
          issues.push({ path: ri.path, severity: ri.severity, message: ri.message });
        return {
          issues,
          summary: {
            total: issues.length,
            errors: issues.filter((i) => i.severity === "error").length,
            warnings: issues.filter((i) => i.severity === "warn").length
          }
        };
      }
      /**
       * Compile one or more lenses to a context string — Daedalus's LENS-scoped compiler.
       *
       * Deliberately NOT the agent compiler: it reuses only the stable low-level primitives a lens
       * already self-compiles through ( `LensObject.getContextBlocks` → `SlotResolver.compile`, exactly
       * what `LensObject.serializeForContext` does ), and touches none of the agent's environment-folding
       * ( root context, live MCP tool defs, DB memory ) — those are RUNTIME layers a standalone vault has
       * no source for, and they belong to Starmind. For a single lens the output equals that lens's own
       * `serializeForContext()`; multiple lenses fold into one context, cross-lens habit contention resolved
       * together. The "basic compilation framework" — advanced composition ( full agents ) requires Starmind.
       *
       * Each name is a bare lens name ( mapped to the `lenses/{name}/{name}.html` convention ) OR a raw
       * vault-relative path. `[0]` is primary. Throws on an empty list or a name that resolves to nothing.
       */
      static compile(vault, lensNames) {
        if (lensNames.length === 0)
          throw new Error("compile requires at least one lens");
        const lenses = lensNames.map((name) => {
          const rel = this.lensPath(name);
          if (!fs.existsSync(vault.toAbs(rel)))
            throw new Error(`no lens found for "${name}" ( looked for ${rel} )`);
          return vault.loadLens(rel);
        });
        const blocks = lenses.flatMap((l) => l.getContextBlocks());
        const text = primitives_1.SlotResolver.compile(blocks);
        return { lenses: lensNames, text, tokens: primitives_1.KCDPrimitive._estimateTokens(text) };
      }
      /**
       * A lens's compiled-context DETAIL — the structured breakdown behind the `show` chart. Reads the same
       * lens-scoped composition `compile()` produces, but keeps it decomposed: `slots[0]` is the lens's OWN
       * identity ( its Care/Know body + the routing tables it authors ), and each following row is one dredge
       * SLOT off the lens's policy — its state ( off / on / suggested, or `empty` when the slot is a
       * placeholder nothing fills ) and the tokens that component contributes. Single lens only ( a lens is
       * what you inspect; a multi-lens compile is `compile()` ).
       */
      static lensView(vault, name) {
        const rel = this.lensPath(name);
        if (!fs.existsSync(vault.toAbs(rel)))
          throw new Error(`no lens found for "${name}" ( looked for ${rel} )`);
        const lens = vault.loadLens(rel);
        const base = (p) => p.replace(/\\/g, "/").split("/").pop() ?? "";
        const lensPath = lens.getPath() ?? rel;
        const slots = [
          // The lens's own identity — its Care/Know body, always fully in.
          { what: "identity", kind: "lens", state: "suggested", tokens: lens.bodyTokens() }
        ];
        for (const entry of lens.getPolicy()) {
          const href = entry.href?.trim() ?? "";
          if (href === "" || /^\{.*\}$/.test(href)) {
            slots.push({ what: entry.what || "( unnamed )", kind: "", state: "empty", tokens: 0 });
            continue;
          }
          const target = this.tryLoad(vault, href);
          slots.push({
            what: entry.what || (target ? target.getName() : base(href)),
            kind: target ? target.getType() : this.kindFromHref(href),
            state: entry.mode,
            // The cost the compile ACTUALLY pays at this slot's mode — `on` reduces to its routing row
            // ( ~tens of tokens ), `suggested` rides the full body ( ~hundreds ), `off` contributes nothing.
            // The same `modeTokens` split the Starmind composition UI reads, so the two never disagree.
            tokens: target ? target.modeTokens(entry.mode, entry.why) : 0
          });
        }
        return {
          lens: lens.getName() || name,
          path: lensPath,
          slots,
          tokens: slots.reduce((sum, s) => sum + s.tokens, 0)
        };
      }
      /** Resolve a policy href to disk ( the resolver the dredge uses ) and load the full artifact — for the
       *  `show` breakdown, which prices every slot regardless of mode. Null on an unresolvable or unreadable
       *  target ( a dangling link ), so the caller falls back to an href-inferred kind and zero weight. */
      static tryLoad(vault, href) {
        try {
          const abs = vault.resolveHref(href);
          if (!fs.existsSync(abs))
            return null;
          return primitives_1.KCDPrimitive.fromHtml(fs.readFileSync(abs, "utf-8"), abs);
        } catch {
          return null;
        }
      }
      /** Best-effort artifact kind from an href's path segment — the fallback when a slot's target can't be
       *  loaded ( a dangling link ), so its real `getType()` is unavailable. */
      static kindFromHref(href) {
        const h = href.replace(/\\/g, "/");
        if (/(^|\/)references?\//.test(h))
          return "reference";
        if (/(^|\/)habits?\//.test(h))
          return "habit";
        if (/(^|\/)plans?\//.test(h))
          return "plan";
        if (/(^|\/)contracts?\//.test(h))
          return "contract";
        return "";
      }
      /** A bare name → the lens-file convention; a value already carrying a slash or an `.html` tail is a
       *  raw vault-relative path, used as-is. */
      static lensPath(nameOrPath) {
        if (nameOrPath.includes("/") || /\.html?$/i.test(nameOrPath))
          return nameOrPath;
        return `lenses/${nameOrPath}/${nameOrPath}.html`;
      }
      /**
       * The single read-query over a vault — glob, type, and text, AND-combined over one scan.
       * `glob` short-circuits through the Vault's own path filter; `type`/`text` narrow the
       * survivors. `groupBy: 'type'` returns a census instead of refs — the cheapest orientation
       * call, and how `kcd_query`'s inspector example works. Moved out of the MCP handler ( 1.i ):
       * this was the one tool whose filtering logic lived only on one face.
       */
      static query(vault, opts = {}) {
        const needle = opts.text?.toLowerCase();
        let files = opts.glob ? vault.glob(opts.glob) : vault.scan();
        if (opts.type)
          files = files.filter((f) => vault.classify(f.path) === opts.type);
        if (needle)
          files = files.filter((f) => (f.body + "\n" + JSON.stringify(f.frontmatter)).toLowerCase().includes(needle));
        if (opts.groupBy === "type") {
          const counts = {};
          for (const f of files) {
            const t = vault.classify(f.path);
            counts[t] = (counts[t] ?? 0) + 1;
          }
          return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
        }
        return files.map((f) => vault.toRef(f));
      }
      /**
       * The link graph around one artifact: `outbound` ( what it declares, resolved ), `addresses`
       * ( its own, each flagged `occupied` — a fact, never a verdict, protocol §1.1 ), and `inbound`
       * ( every other file whose links resolve here, found by scanning + resolving the whole vault ).
       * Moved out of the MCP handler ( 1.i ), same reason as `query`.
       */
      static links(vault, path4) {
        const abs = vault.toAbs(path4);
        const artifact = primitives_1.KCDPrimitive.fromHtml(vault.read(path4), abs);
        const outbound = artifact.getLinks();
        const names = new Set(vault.scan().map((f) => typeof f.frontmatter["name"] === "string" ? f.frontmatter["name"] : "").filter((n) => n !== ""));
        const addresses = (artifact.serialize().addresses ?? []).map((a) => ({
          ...a,
          occupied: names.has(a.value) || vault.exists(a.value)
        }));
        const inbound = vault.scan().filter((f) => f.rawLinks.some((l) => vault.resolveHref(l.href) === abs)).map((f) => ({ path: f.relativePath, relativePath: f.relativePath }));
        return { outbound, addresses, inbound };
      }
      /**
       * Parse every §10 seed payload out of the seed source. A seed is the "§5 non-executing script
       * idiom with a markdown type" — `<script type="text/kcd-md" data-kcd-seed="host"
       * data-kcd-target="…" data-kcd-mode="…">payload</script>` — one block per agent host. Attribute
       * order is NOT assumed ( each is matched independently within the captured tag ), so a document
       * author reordering them cannot silently break extraction. A `<script>` without
       * `type="text/kcd-md"` is skipped, not an error — root-context may grow other script content
       * later.
       */
      static parseSeeds(vault) {
        return _VaultUtilities.parseSeedsFrom(vault.read(ROOT_CONTEXT_PATH));
      }
      /**
       * The same parse, against raw HTML rather than a deployed vault.
       *
       * The two currencies are genuinely different, not a convenience wrapper: at INSTALL time there is
       * no vault yet, and the caller needs the seed declarations out of the BUNDLE's `root-context.html`
       * — which is the only place the set of agent entry-point filenames is written down. Anchoring an
       * install on "the folder containing CLAUDE.md" without this would mean hardcoding that filename in
       * the CLI, and there would then be two lists of host targets that could disagree.
       */
      static parseSeedsFrom(html) {
        const out = [];
        const scriptRe = /<script\s+([^>]*?)>([\s\S]*?)<\/script>/g;
        let m;
        while ((m = scriptRe.exec(html)) !== null) {
          const [, attrs, body] = m;
          if (!/type="text\/kcd-md"/.test(attrs))
            continue;
          const host = /data-kcd-seed="([^"]+)"/.exec(attrs)?.[1];
          const target = /data-kcd-target="([^"]+)"/.exec(attrs)?.[1];
          const mode = /data-kcd-mode="([^"]+)"/.exec(attrs)?.[1];
          if (!host || !target)
            continue;
          out.push({ host, target, mode: mode ?? "prepend", payload: body.trim() });
        }
        return out;
      }
      /**
       * Apply one seed to its target, confirm-gated like `reset`: no `confirm` only reports what
       * would change, nothing on disk moves.
       *
       * `create-only` writes the whole file, and only when nothing is there yet — re-running this
       * against an existing target is always a no-op by design (`changed: false`), never a silent
       * overwrite of a project's own content.
       *
       * `prepend` maintains a MANAGED BLOCK at the top of the target, delimited by
       * `<!-- kcd:begin -->` / `<!-- kcd:end -->` — re-extraction replaces only what lies between the
       * markers and leaves everything below them alone, which is what lets a vault deploy over a
       * project whose `CLAUDE.md` already says things of its own. First extraction ( no markers yet )
       * PREPENDS the block above whatever the file already held; a target that does not exist yet gets
       * just the block.
       */
      static applySeed(projectRoot, seed, opts) {
        const targetAbs = path3.resolve(projectRoot, seed.target);
        const existed = fs.existsSync(targetAbs);
        if (seed.mode === "create-only") {
          const changed2 = !existed;
          if (changed2 && opts?.confirm) {
            fs.mkdirSync(path3.dirname(targetAbs), { recursive: true });
            fs.writeFileSync(targetAbs, seed.payload + "\n", "utf-8");
          }
          return { host: seed.host, target: seed.target, mode: seed.mode, targetExisted: existed, hadManagedBlock: false, changed: changed2, applied: !!opts?.confirm && changed2 };
        }
        const current = existed ? fs.readFileSync(targetAbs, "utf-8") : "";
        const blockRe = /<!--\s*kcd:begin\s*-->[\s\S]*?<!--\s*kcd:end\s*-->/;
        const hadBlock = blockRe.test(current);
        const block = `<!-- kcd:begin -->
${seed.payload}
<!-- kcd:end -->`;
        const next = hadBlock ? current.replace(blockRe, block) : block + (current ? "\n\n" + current : "\n");
        const changed = next !== current;
        if (changed && opts?.confirm) {
          fs.mkdirSync(path3.dirname(targetAbs), { recursive: true });
          fs.writeFileSync(targetAbs, next, "utf-8");
        }
        return { host: seed.host, target: seed.target, mode: seed.mode, targetExisted: existed, hadManagedBlock: hadBlock, changed, applied: !!opts?.confirm && changed };
      }
      /**
       * The inverse of `applySeed` — take OUR managed block back out of a host entry file, leaving
       * everything the project wrote itself exactly where it was.
       *
       * The uninstall half of the seed contract, and the reason `clear` can be offered at all: because
       * `applySeed` never owned more than the region between its markers, removal is subtraction rather
       * than deletion. The file survives with the user's own instructions intact. It is deleted ONLY
       * when our block was the entire content — i.e. we created it and nobody added anything since —
       * which is the one case where leaving an empty file behind would be litter rather than courtesy.
       *
       * `create-only` seeds are never removed: that mode writes a whole file and then never touches it
       * again, so after the first install the content is indistinguishable from the project's own.
       * Guessing there would mean deleting something we cannot prove we wrote.
       */
      static removeSeed(projectRoot, seed, opts) {
        const targetAbs = path3.resolve(projectRoot, seed.target);
        const existed = fs.existsSync(targetAbs);
        const base = { host: seed.host, target: seed.target, targetExisted: existed };
        if (!existed || seed.mode === "create-only") {
          return { ...base, hadManagedBlock: false, fileRemoved: false, changed: false, applied: false };
        }
        const current = fs.readFileSync(targetAbs, "utf-8");
        const blockRe = /<!--\s*kcd:begin\s*-->[\s\S]*?<!--\s*kcd:end\s*-->\r?\n?/;
        const hadBlock = blockRe.test(current);
        if (!hadBlock)
          return { ...base, hadManagedBlock: false, fileRemoved: false, changed: false, applied: false };
        const next = current.replace(blockRe, "").replace(/^\s+/, "");
        const fileRemoved = next.trim().length === 0;
        if (opts?.confirm) {
          if (fileRemoved)
            fs.rmSync(targetAbs);
          else
            fs.writeFileSync(targetAbs, next, "utf-8");
        }
        return { ...base, hadManagedBlock: true, fileRemoved, changed: true, applied: !!opts?.confirm };
      }
      /**
       * Maintain a managed block in the project's `.gitignore`, confirm-gated like every other write.
       *
       * WHY THIS IS A FUNCTION AND NOT A PARAGRAPH OF ADVICE: an install writes six paths into a
       * version-controlled repository, and "I do not want this in my git history" is the one objection
       * a cautious developer actually has. It was previously answered with prose telling them to edit
       * `.gitignore` themselves — which is a chore attached to the least confident moment of the
       * install. It also replaces "workspace mode" outright ( ruled 2026-07-26 ): a vault outside the
       * repository breaks `inferProjectRoot`'s upward walk and is an alternate topology, whereas the
       * concern behind it is fully served by three lines in a file.
       *
       * The three scopes are the three honest answers, and `none` exists so the choice is reversible:
       *
       *   scratch  the default recommendation — `audits/` and `work/` are regenerable churn; the rest
       *            of the vault is project knowledge and belongs in history
       *   vault    the whole vault, for someone who wants to try this without touching their repo
       *   none     remove the managed block entirely, restoring whatever they had before
       *
       * Managed-block idiom deliberately mirrors `applySeed`'s ( `# kcd:begin` / `# kcd:end`, comment
       * syntax swapped for the file format ) so there is ONE mechanism for "a file we co-own with the
       * user" rather than two that drift. The block is APPENDED, not prepended — a `.gitignore`'s own
       * rules should stay where its author put them.
       */
      static gitignore(projectRoot, docRoot, scope, opts) {
        const targetAbs = path3.resolve(projectRoot, ".gitignore");
        const existed = fs.existsSync(targetAbs);
        const current = existed ? fs.readFileSync(targetAbs, "utf-8") : "";
        const entries = scope === "vault" ? [`${docRoot}/`] : scope === "scratch" ? [`${docRoot}/audits/`, `${docRoot}/work/`, `${docRoot}/scratch/`] : [];
        const blockRe = /#\s*kcd:begin\s*[\s\S]*?#\s*kcd:end\s*\n?/;
        const hadBlock = blockRe.test(current);
        let next;
        if (entries.length === 0) {
          next = hadBlock ? current.replace(blockRe, "").replace(/\n{3,}$/, "\n") : current;
        } else {
          const block = `# kcd:begin
${entries.join("\n")}
# kcd:end
`;
          next = hadBlock ? current.replace(blockRe, block) : current + (current && !current.endsWith("\n") ? "\n" : "") + (current ? "\n" : "") + block;
        }
        const changed = next !== current;
        if (changed && opts?.confirm)
          fs.writeFileSync(targetAbs, next, "utf-8");
        return { target: ".gitignore", scope, entries, targetExisted: existed, hadManagedBlock: hadBlock, changed, applied: !!opts?.confirm && changed };
      }
      /**
       * The entry document's Lenses table, freshly computed from the vault's real lens files —
       * `what`/`where`/`why` sourced from each lens's OWN frontmatter, never hand-copied. This is
       * deliberately authoritative-over-editorial: a lens's description is the one place its pitch is
       * written, and a curated-but-separate copy in the entry document is exactly the kind of thing
       * that drifts silently. `_lens-base` ( and any other `_`-prefixed, auto-loaded infrastructure
       * lens ) is excluded — it is never picked, it is automatic.
       */
      static lensIndex(vault) {
        return vault.scan().filter((f) => vault.classify(f.path) === "lens").filter((f) => !path3.basename(f.relativePath).startsWith("_")).map((f) => ({
          // The FOLDER name, not frontmatter.name — this is the slug `!name` and
          // `kcd_compile`'s own `lenses/{name}/{name}.html` convention actually resolve. At
          // least three lenses' authored `name` disagrees with their folder ( hyphen vs.
          // underscore ) — using frontmatter here would put an unresolvable slug in the one
          // table whose whole job is telling an agent what to type.
          what: path3.basename(path3.dirname(f.relativePath)),
          where: `${DOC_ROOT_PREFIX}/${f.relativePath}`.replace(/\\/g, "/"),
          why: typeof f.frontmatter["description"] === "string" ? f.frontmatter["description"] : ""
        })).sort((a, b) => a.what.localeCompare(b.what));
      }
      /**
       * Splice freshly-computed rows into the entry document's `data-kcd-section="lenses"` table,
       * leaving every other section — hard rules, stacking, framework reference, all hand-authored
       * prose — untouched. Locates the table by its OWN structural markers ( the section id, the
       * head row, the section's own closing tag ), not a line-number or whitespace assumption, so a
       * human editing prose elsewhere in the document cannot break the splice. Throws rather than
       * guessing if the section is not found in the expected shape — a silent wrong-place write to a
       * hard-rule-protected document is worse than a loud refusal.
       */
      static spliceLensIndex(rootHtml, rows) {
        const sectionRe = /<section data-kcd-section="lenses">[\s\S]*?<\/section>/;
        const section = sectionRe.exec(rootHtml);
        if (!section)
          throw new Error('spliceLensIndex: no <section data-kcd-section="lenses"> found in the entry document');
        const headRe = /<div data-kcd-head>[\s\S]*?<\/div>\r?\n/;
        const head = headRe.exec(section[0]);
        if (!head)
          throw new Error("spliceLensIndex: found the lenses section but not its table head row");
        const headEndInSection = head.index + head[0].length;
        const closeRe = /\r?\n(\t*)<\/div>\r?\n(\t*)<\/section>$/;
        const close = closeRe.exec(section[0]);
        if (!close)
          throw new Error("spliceLensIndex: found the lenses table head but not its closing tags");
        const rendered = rows.map((r) => `			<div data-kcd-slot="reference" data-kcd-mode="on">\r
				<span data-kcd-field="what"  data-kcd-type="text">${r.what}</span>\r
				<a    data-kcd-field="where" data-kcd-type="path" href="${r.where}">${r.what}</a>\r
				<span data-kcd-field="why"   data-kcd-type="text">${r.why}</span>\r
			</div>`).join("\r\n");
        const newSection = section[0].slice(0, headEndInSection) + rendered + section[0].slice(close.index);
        const html = rootHtml.slice(0, section.index) + newSection + rootHtml.slice(section.index + section[0].length);
        return { rows, html, changed: html !== rootHtml };
      }
      /**
       * Restore ONE deployed artifact to canonical from the bundle — the opposite of `VaultDeploy`,
       * which only ever FILLS ( `force: false`, an existing file is never touched ). Reset is the
       * deliberate overwrite `VaultDeploy` refuses to be.
       *
       * The canonical counterpart of a deployed path is resolved through `InstallManifest`, the same
       * table `VaultDeploy` fills FROM — no second mapping to drift out of step with the first. A
       * target with no covering row ( content the manifest never declared ) simply has no canonical
       * counterpart; that is a normal, reportable outcome, not an error.
       *
       * CONFIRM-FIRST, per-artifact: called with no `opts` ( or `confirm: false` ), this only
       * reports — `applied` is always `false` and nothing on disk changes. Pass `confirm: true` to
       * actually overwrite, and only once the caller has seen the report. A target already
       * `identical` to canonical is left untouched even with `confirm: true` — reset does not
       * touch mtimes for no reason.
       */
      static reset(vault, targetPath, substrateSource, opts) {
        const rel = targetPath.replace(/\\/g, "/").replace(/^\/+/, "");
        const targetAbs = vault.toAbs(rel);
        const entry = core_1.InstallManifest.entryFor(rel);
        if (!entry)
          return { path: rel, canonicalPath: "", hasCanonical: false, targetExisted: fs.existsSync(targetAbs), identical: false, applied: false };
        const tail = rel === entry.vaultHome ? "" : rel.slice(entry.vaultHome.length + 1);
        const canonicalPath = path3.join(substrateSource, entry.bundleSource, tail);
        const hasCanonical = fs.existsSync(canonicalPath) && fs.statSync(canonicalPath).isFile();
        const targetExisted = fs.existsSync(targetAbs);
        if (!hasCanonical)
          return { path: rel, canonicalPath, hasCanonical, targetExisted, identical: false, applied: false };
        const canonicalContent = fs.readFileSync(canonicalPath, "utf-8");
        const identical = targetExisted && fs.readFileSync(targetAbs, "utf-8") === canonicalContent;
        const apply = !!opts?.confirm && !identical;
        if (apply)
          vault.write(rel, canonicalContent);
        return { path: rel, canonicalPath, hasCanonical, targetExisted, identical, applied: apply };
      }
      /**
       * Categorize every file under `kcd/` into one of the three real migration states. `overrides`
       * maps a `kcd/`-stripped PREFIX to its real target prefix ( e.g. `{ 'docs/': 'references/kcd_sdk/'
       * }` ) for the cases where the flat mirror of a `kcd/` path is not an actual home — deliberately a
       * CALLER-supplied table, not baked in here: a different project's `kcd/` shape will need different
       * overrides, and this function stays generic by not guessing at one project's history.
       *
       * Duplicate detection runs on the UN-overridden flat path — a file already deployed at its
       * natural mirror is a duplicate regardless of where an unrelated file's override sends it.
       */
      static planKcdMigration(vault, overrides = {}) {
        const actions = [];
        const notes = [];
        for (const f of vault.scan()) {
          const rel = f.relativePath.replace(/\\/g, "/");
          if (rel !== "kcd" && !rel.startsWith("kcd/"))
            continue;
          const stripped = rel.slice(4);
          if (stripped.startsWith("templates/")) {
            actions.push({ kind: "extract-template", kcdPath: rel });
            continue;
          }
          if (vault.exists(`${DOC_ROOT_PREFIX}/${stripped}`)) {
            const diverged = vault.read(rel) !== vault.read(stripped);
            actions.push({ kind: "delete-duplicate", kcdPath: rel, deployedPath: stripped, diverged });
            continue;
          }
          let target = stripped;
          for (const [from, to] of Object.entries(overrides)) {
            if (stripped.startsWith(from)) {
              target = to + stripped.slice(from.length);
              break;
            }
          }
          actions.push({ kind: "relocate", kcdPath: rel, targetPath: target });
        }
        if (actions.some((a) => a.kcdPath === "kcd/kcd.css"))
          notes.push("kcd/kcd.css is linked via a plain <link> tag, not a data-kcd-* href \u2014 no heal here sees it. Run fixStylesheetLinks() once its new home is settled.");
        return { actions, notes };
      }
      /**
       * Apply a plan's `delete-duplicate` and `relocate` actions — confirm-gated like every other
       * write in this class. `extract-template` is reported, never applied: its destination is OUTSIDE
       * the vault, in whatever package consumes this project, and that mapping is not this generic
       * utility's to know. `relocate` reuses `vault.move()` verbatim — link-healing for free, same
       * proven mechanism `kcd_move` already runs. `delete-duplicate` cannot use `move()` ( its
       * destination already exists, which `move()` refuses by design ) — so it re-derives the same
       * repoint-then-remove shape by hand: every inbound link to the `kcd/` copy is rewritten to point
       * at the real deployed copy, then the stale file is removed, then the same post-condition
       * `move()`/`delete()` both assert — no link may still resolve to the old path — is checked here too.
       */
      static applyKcdMigration(vault, plan, opts) {
        const reports = [];
        for (const action of plan.actions) {
          if (action.kind === "extract-template") {
            reports.push({ action, applied: false, error: "extract-template is not applied here \u2014 relocate it outside the vault, then delete the kcd/ source separately" });
            continue;
          }
          if (!opts?.confirm) {
            reports.push({ action, applied: false });
            continue;
          }
          try {
            if (action.kind === "delete-duplicate") {
              const kcdAbs = vault.toAbs(action.kcdPath);
              const newHref = `${DOC_ROOT_PREFIX}/${action.deployedPath}`;
              for (const edit of vault.inboundEdits(kcdAbs, newHref))
                vault.rewriteHref(edit);
              fs.unlinkSync(kcdAbs);
              vault.assertNoResidual(kcdAbs, "migrate");
            } else {
              vault.move(action.kcdPath, action.targetPath);
            }
            reports.push({ action, applied: true });
          } catch (e) {
            reports.push({ action, applied: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return reports;
      }
      /**
       * Fix every document's stylesheet `<link>` to point at `kcd.css`'s CURRENT location, recomputed
       * fresh from each file's own depth. Deliberately unconditional — every document in the vault
       * shares the one stylesheet, so this recomputes every link rather than trying to detect which
       * ones point at a stale path; a link already correct is simply reported `applied: false`
       * ( nothing to do ), not skipped.
       */
      static fixStylesheetLinks(vault, cssHome, opts) {
        const reports = [];
        const linkRe = /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/;
        for (const f of vault.scan()) {
          const rel = f.relativePath.replace(/\\/g, "/");
          if (rel === cssHome)
            continue;
          const raw = vault.read(rel);
          const m = linkRe.exec(raw);
          if (!m)
            continue;
          const depth = rel.split("/").length - 1;
          const newHref = (depth === 0 ? "" : "../".repeat(depth)) + cssHome;
          const oldHref = m[1];
          if (oldHref === newHref) {
            reports.push({ path: rel, oldHref, newHref, applied: false });
            continue;
          }
          if (opts?.confirm) {
            const before = raw.slice(0, m.index);
            const after = raw.slice(m.index + m[0].length);
            vault.write(rel, before + m[0].replace(oldHref, newHref) + after);
          }
          reports.push({ path: rel, oldHref, newHref, applied: !!opts?.confirm });
        }
        return reports;
      }
    };
    exports2.VaultUtilities = VaultUtilities4;
  }
});

// ../kcd_sdk/dist/node/VaultDeploy.js
var require_VaultDeploy = __commonJS({
  "../kcd_sdk/dist/node/VaultDeploy.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.VaultDeploy = void 0;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var core_1 = require_core();
    var COPY_EXCLUDE = [".git"];
    var VaultDeploy2 = class _VaultDeploy {
      /** What this vault is missing, changing nothing. The 4.e maintenance read: point it at any
       *  project and it answers "is this vault whole?" without touching disk. */
      static inspect(projectRoot, opts) {
        return _VaultDeploy._run(projectRoot, opts, false);
      }
      /** Fill every gap `inspect()` would report. Idempotent: anything already present is left exactly
       *  as it is, so running this against a healthy vault is a no-op that still returns a full report. */
      static apply(projectRoot, opts) {
        return _VaultDeploy._run(projectRoot, opts, true);
      }
      /**
       * The one walk both operations share. `write` is the only difference between a preview and a
       * deployment — every decision about WHAT should exist is made identically either way.
       */
      static _run(projectRoot, opts, write) {
        const docRoot = opts?.docRoot ?? core_1.LensObject.DEFAULT_DOC_ROOT;
        const vault = path3.resolve(projectRoot, docRoot);
        const items = [];
        if (write)
          fs.mkdirSync(vault, { recursive: true });
        for (const entry of core_1.VaultLayout.all()) {
          const abs = path3.join(vault, entry.dir);
          const present = fs.existsSync(abs);
          items.push({ kind: "dir", path: entry.dir, present, note: entry.purpose });
          if (!present && write)
            fs.mkdirSync(abs, { recursive: true });
        }
        items.push(..._VaultDeploy._manifest(vault, opts?.substrateSource, write));
        items.push(_VaultDeploy._navIndex(vault, write));
        items.push(_VaultDeploy._commandDeck(vault, write));
        const missing = items.filter((i) => !i.present).length;
        return { root: projectRoot, docRoot, items, missing, applied: write };
      }
      /**
       * Every `InstallManifest` row, filled from the bundle. `force: false` is what makes this a FILL
       * rather than a reset — an existing file is never overwritten, so a project that has been running
       * for months keeps whatever it has and only gains what it lacks.
       *
       * A missing bundle, or a row absent from it, is reported per-row rather than thrown: a deploy that
       * cannot find part of its source should say so plainly and keep filling everything else, because
       * one missing optional row is not a reason to leave the rest of the vault half-built.
       */
      static _manifest(vault, source, write) {
        const items = [];
        for (const entry of core_1.InstallManifest.all()) {
          const dest = path3.join(vault, entry.vaultHome);
          const src = source ? path3.join(source, entry.bundleSource) : void 0;
          if (!src || !fs.existsSync(src)) {
            items.push({
              kind: "substrate",
              path: entry.vaultHome,
              present: fs.existsSync(dest),
              note: !source ? "no substrate source given" : `${entry.required ? "required" : "optional"} \u2014 not found in bundle at "${entry.bundleSource}"`
            });
            continue;
          }
          const isDir = fs.statSync(src).isDirectory();
          const gaps = isDir ? _VaultDeploy._missingUnder(src, dest) : fs.existsSync(dest) ? [] : [entry.bundleSource];
          const item = {
            kind: "substrate",
            path: entry.vaultHome,
            present: gaps.length === 0,
            note: gaps.length === 0 ? "complete" : `${gaps.length} file(s) missing: ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? "\u2026" : ""}`
          };
          if (gaps.length > 0 && write) {
            if (isDir) {
              fs.mkdirSync(dest, { recursive: true });
              fs.cpSync(src, dest, {
                recursive: true,
                force: false,
                // never overwrite — this fills, it does not reset
                errorOnExist: false,
                filter: (s) => !COPY_EXCLUDE.includes(path3.basename(s))
              });
            } else {
              fs.mkdirSync(path3.dirname(dest), { recursive: true });
              fs.copyFileSync(src, dest);
            }
          }
          items.push(item);
        }
        return items;
      }
      /** Every file under `source` ( excluding the copy-excluded names ) with no counterpart under
       *  `dest`, as source-relative paths. The measurement behind "is the substrate complete?". */
      static _missingUnder(source, dest) {
        const out = [];
        const walk = (rel) => {
          const here = path3.join(source, rel);
          for (const entry of fs.readdirSync(here, { withFileTypes: true })) {
            if (COPY_EXCLUDE.includes(entry.name))
              continue;
            const childRel = rel ? path3.join(rel, entry.name) : entry.name;
            if (entry.isDirectory()) {
              walk(childRel);
              continue;
            }
            if (!fs.existsSync(path3.join(dest, childRel)))
              out.push(childRel.replace(/\\/g, "/"));
          }
        };
        if (!fs.existsSync(source))
          return out;
        walk("");
        return out;
      }
      /** The vault's root nav-index — the entry map a reader ( human or agent ) lands on. Written only
       *  when absent, and deliberately minimal: it is a starting point the project grows, not a
       *  generated artifact that would fight being edited. */
      static _navIndex(vault, write) {
        const rel = "nav-index.html";
        const dest = path3.join(vault, rel);
        const present = fs.existsSync(dest);
        const item = { kind: "file", path: rel, present, note: "the vault entry map" };
        if (present || !write)
          return item;
        fs.writeFileSync(dest, _VaultDeploy._navIndexHtml(), "utf-8");
        return item;
      }
      /**
       * The command deck's one file. The deck's location is CONVENTION, not configuration — it is always
       * `<docRoot>/dev-utilities/commands.json` — so the deck panel computes that path rather than asking
       * the user for it. That only holds if the file reliably exists, which is this step's whole job: every
       * deployed project gets one, and a repair on an older project fills it in.
       *
       * Seeded EMPTY. JSON carries no comments, so there is nowhere to explain the schema in the file, and a
       * placeholder entry would render as a launcher button that does nothing — worse than an empty deck,
       * which states the path it read and invites the first real command. The directory itself comes from
       * the layout table like every other folder.
       */
      static _commandDeck(vault, write) {
        const rel = "dev-utilities/commands.json";
        const dest = path3.join(vault, rel);
        const present = fs.existsSync(dest);
        const item = { kind: "file", path: rel, present, note: "the command deck's launchers" };
        if (present || !write)
          return item;
        fs.mkdirSync(path3.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, "[]\n", "utf-8");
        return item;
      }
      static _navIndexHtml() {
        const rows = core_1.VaultLayout.all().filter((e) => !e.dir.includes("/")).map((e) => `			<div data-kcd-slot="link">
				<span data-kcd-field="what"  data-kcd-type="text">${e.dir}</span>
				<a    data-kcd-field="where" data-kcd-type="path" href="_Claude/${e.dir}/">${e.dir}</a>
				<span data-kcd-field="why"   data-kcd-type="text">${e.purpose}</span>
			</div>`).join("\n");
        return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Vault \u2014 Navigation Index</title>
	<link rel="stylesheet" href="kcd.css">
</head>
<body>

<article data-kcd="nav-index">

	<dl data-kcd-frontmatter>
		<dt>name</dt>          <dd data-kcd-field="name"           data-kcd-type="slug">vault</dd>
		<dt>description</dt>   <dd data-kcd-field="description"    data-kcd-type="text">The entry map for this project's KCD vault \u2014 every top-level folder and what belongs in it.</dd>
		<dt>type</dt>          <dd data-kcd-field="type"           data-kcd-type="enum">nav-index</dd>
		<dt>status</dt>        <dd data-kcd-field="status"         data-kcd-type="enum">active</dd>
		<dt>schema-version</dt><dd data-kcd-field="schema-version" data-kcd-type="text">0.1</dd>
	</dl>

	<h1>Vault \u2014 Index</h1>

	<p>The entry map for this project's KCD vault. Structure is defined in code by the
	<code>VaultLayout</code> table; this index is yours to grow.</p>

	<section data-kcd-section="structure">
		<h2>Structure</h2>
		<div data-kcd-table>
			<div data-kcd-head><span>What</span><span>Where</span><span>Why</span></div>
${rows}
		</div>
	</section>

</article>

</body>
</html>
`;
      }
    };
    exports2.VaultDeploy = VaultDeploy2;
  }
});

// ../kcd_sdk/dist/node/Survey.js
var require_Survey = __commonJS({
  "../kcd_sdk/dist/node/Survey.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Survey = void 0;
    var fs = __importStar(require("fs"));
    var path3 = __importStar(require("path"));
    var DEFAULT_DOC_ROOT2 = "_Claude";
    var SKIP_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      ".git",
      ".svn",
      ".hg",
      "dist",
      "build",
      "out",
      "target",
      "bin",
      "obj",
      ".next",
      ".nuxt",
      ".venv",
      "venv",
      "__pycache__",
      ".tox",
      ".gradle",
      ".idea",
      ".vscode",
      "vendor",
      "coverage",
      ".pytest_cache",
      ".mypy_cache",
      "Pods",
      "DerivedData"
    ]);
    var LANGUAGES = {
      ".ts": "TypeScript",
      ".tsx": "TypeScript",
      ".mts": "TypeScript",
      ".cts": "TypeScript",
      ".js": "JavaScript",
      ".jsx": "JavaScript",
      ".mjs": "JavaScript",
      ".cjs": "JavaScript",
      ".vue": "Vue",
      ".svelte": "Svelte",
      ".py": "Python",
      ".pyi": "Python",
      ".go": "Go",
      ".rs": "Rust",
      ".cs": "C#",
      ".fs": "F#",
      ".vb": "Visual Basic",
      ".java": "Java",
      ".kt": "Kotlin",
      ".kts": "Kotlin",
      ".scala": "Scala",
      ".groovy": "Groovy",
      ".rb": "Ruby",
      ".php": "PHP",
      ".pl": "Perl",
      ".c": "C",
      ".h": "C",
      ".cpp": "C++",
      ".cc": "C++",
      ".cxx": "C++",
      ".hpp": "C++",
      ".m": "Objective-C",
      ".mm": "Objective-C++",
      ".swift": "Swift",
      ".sh": "Shell",
      ".bash": "Shell",
      ".zsh": "Shell",
      ".ps1": "PowerShell",
      ".sql": "SQL",
      ".r": "R",
      ".lua": "Lua",
      ".dart": "Dart",
      ".ex": "Elixir",
      ".exs": "Elixir",
      ".html": "HTML",
      ".css": "CSS",
      ".scss": "Sass",
      ".less": "Less",
      ".md": "Markdown"
    };
    var MANIFESTS = {
      "package.json": "npm",
      "deno.json": "deno",
      "requirements.txt": "python",
      "pyproject.toml": "python",
      "setup.py": "python",
      "Pipfile": "python",
      "go.mod": "go",
      "Cargo.toml": "rust",
      "pom.xml": "java",
      "build.gradle": "java",
      "build.gradle.kts": "java",
      "Gemfile": "ruby",
      "composer.json": "php",
      "pubspec.yaml": "dart",
      "mix.exs": "elixir",
      "*.csproj": "dotnet"
    };
    var CONVENTIONAL_ENTRIES = [
      "src/index.ts",
      "src/index.js",
      "src/main.ts",
      "src/main.js",
      "index.ts",
      "index.js",
      "src/main.py",
      "main.py",
      "__main__.py",
      "app.py",
      "manage.py",
      "main.go",
      "cmd/main.go",
      "src/main.rs",
      "src/lib.rs",
      "Program.cs",
      "src/Program.cs",
      "main.swift"
    ];
    var APP_FRAMEWORKS = [
      "electron",
      "next",
      "nuxt",
      "@angular/core",
      "react-scripts",
      "express",
      "fastify",
      "@nestjs/core",
      "django",
      "flask"
    ];
    var TEST_DIRS = /* @__PURE__ */ new Set(["__tests__", "test", "tests", "spec", "specs", "testing", "e2e"]);
    var TEST_PATTERNS = [
      { pattern: "*.test.*", test: (f) => /\.test\.[a-z]+$/i.test(f) },
      { pattern: "*.spec.*", test: (f) => /\.spec\.[a-z]+$/i.test(f) },
      { pattern: "*_test.go", test: (f) => /_test\.go$/i.test(f) },
      { pattern: "test_*.py", test: (f) => /^test_.+\.py$/i.test(f) },
      { pattern: "*_test.py", test: (f) => /_test\.py$/i.test(f) },
      { pattern: "*Test.java", test: (f) => /Test\.java$/.test(f) },
      { pattern: "*Tests.cs", test: (f) => /Tests?\.cs$/.test(f) }
    ];
    var MAX_FILES = 6e4;
    var MAX_COMPONENTS = 64;
    var MAX_LANGUAGES = 10;
    var MAX_ENTRY_POINTS = 8;
    var MAX_TEST_DIRS = 8;
    var INDEX_FILE = "index.json";
    var Survey3 = class _Survey {
      /**
       * Walk `projectRoot` and produce the report. Never throws on odd trees.
       *
       * The vault is EXCLUDED. A survey reconnoitres the project the vault sits beside, so counting the
       * vault's own artifacts as the user's code is not a rounding error — it is the wrong answer to the
       * only question this asks. Left unskipped, a freshly installed vault ( ~44 framework documents )
       * swamps a small project entirely, and every agent reading the roster concludes the project is
       * made of KCD HTML. Found 2026-07-25, when a 6-file test project surveyed as 50 files.
       */
      static run(projectRoot, opts) {
        const root = path3.resolve(projectRoot);
        const maxFiles = opts?.maxFiles ?? MAX_FILES;
        const docRoot = opts?.docRoot ?? DEFAULT_DOC_ROOT2;
        const files = [];
        const manifests = [];
        let directories = 0, truncated = false;
        const rel = (abs) => path3.relative(root, abs).split(path3.sep).join("/");
        const walk = (dir, inTestDir) => {
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            if (files.length >= maxFiles) {
              truncated = true;
              return;
            }
            const abs = path3.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (SKIP_DIRS.has(entry.name) || entry.name === docRoot || entry.name.startsWith("."))
                continue;
              directories++;
              const isTest = TEST_DIRS.has(entry.name.toLowerCase());
              walk(abs, inTestDir || isTest);
              continue;
            }
            if (!entry.isFile())
              continue;
            let size = 0;
            try {
              size = fs.statSync(abs).size;
            } catch {
            }
            files.push({ rel: rel(abs), size, inTestDir, base: entry.name });
            const eco = MANIFESTS[entry.name] ?? (entry.name.endsWith(".csproj") ? "dotnet" : void 0);
            if (eco)
              manifests.push({ dir: rel(path3.dirname(abs)), file: rel(abs), ecosystem: eco });
          }
        };
        walk(root, false);
        const components = _Survey._components(root, files, manifests);
        return {
          schema: "survey/1",
          generated: (/* @__PURE__ */ new Date()).toISOString(),
          root: root.split(path3.sep).join("/"),
          components,
          totals: {
            components: components.length,
            files: files.length,
            bytes: files.reduce((n, f) => n + f.size, 0)
          },
          capabilities: { tsScan: fs.existsSync(path3.join(root, "tsconfig.json")) },
          limits: { maxFiles, truncated }
        };
      }
      /**
       * Flush and fill `outDir` with the survey tree: a roster at `index.json` plus one file per
       * component, FLAT beside it. Deliberately shallow — an agent should be able to list one directory
       * and see every component, then open exactly the one it needs.
       *
       * Destructive by design. The survey is a derived, temporary artifact; a stale component file left
       * behind after a rename would be worse than no file at all, so the directory is emptied first.
       * Refuses to flush anything that does not look like a survey directory.
       */
      static write(report, outDir) {
        const dir = path3.resolve(outDir);
        if (fs.existsSync(dir)) {
          const stray = fs.readdirSync(dir).filter((f) => !f.endsWith(".json"));
          if (stray.length)
            throw new Error(`refusing to flush ${dir}: it holds non-survey files ( ${stray.slice(0, 3).join(", ")} )`);
          for (const f of fs.readdirSync(dir))
            fs.rmSync(path3.join(dir, f), { force: true });
        } else {
          fs.mkdirSync(dir, { recursive: true });
        }
        const written = [];
        const emit = (name, data) => {
          fs.writeFileSync(path3.join(dir, name), JSON.stringify(data, null, "	") + "\n");
          written.push(name);
        };
        emit(INDEX_FILE, {
          schema: report.schema,
          generated: report.generated,
          root: report.root,
          totals: report.totals,
          capabilities: report.capabilities,
          limits: report.limits,
          components: report.components.map((c) => ({
            id: c.id,
            kind: c.kind,
            path: c.path,
            file: `${c.id}.json`,
            description: c.description
          }))
        });
        for (const c of report.components)
          emit(`${c.id}.json`, { schema: report.schema, ...c });
        return written;
      }
      /**
       * The lean text projection — what an agent actually READS.
       *
       * Raw JSON is the right thing to store and a poor thing to prompt with: repeated keys and
       * punctuation cost roughly 1.5–2× the tokens of an equivalent outline, and small models score
       * worse retrieving from it. So the stored tree stays JSON and this is served instead. `stats`
       * drops whole — the same partition `layout` gets in an insight document.
       */
      static project(report) {
        const out = [];
        out.push(`# survey \xB7 ${report.root} \xB7 ${report.totals.components} components`);
        if (report.limits.truncated)
          out.push(`PARTIAL: walk stopped at ${report.limits.maxFiles} files \u2014 treat absences as unknown, not absent.`);
        out.push("");
        for (const c of report.components) {
          out.push(`## ${c.id} \xB7 ${c.kind}${c.ecosystem ? ` \xB7 ${c.ecosystem}` : ""}`);
          out.push(`path        ${c.path}`);
          out.push(`about       ${c.description}`);
          if (c.languages.length)
            out.push(`languages   ${c.languages.map((l) => `${l.language}(${l.files})`).join(", ")}`);
          if (c.entryPoints.length)
            out.push(`entry       ${c.entryPoints.map((e) => e.path).join(", ")}`);
          out.push(`tests       ${c.tests.present ? `${c.tests.files} files \xB7 ${c.tests.patterns.join(" ") || "by directory"}` : "none found"}`);
          if (c.contains.length)
            out.push(`contains    ${c.contains.join(", ")}`);
          out.push("");
        }
        return out.join("\n");
      }
      // ── Internals ─────────────────────────────────────────────────────────────
      /** Build the component set, attributing every file to the deepest component that contains it. */
      static _components(root, files, manifests) {
        const roots = /* @__PURE__ */ new Map();
        for (const m of manifests) {
          const key = m.dir === "" ? "." : m.dir;
          if (!roots.has(key))
            roots.set(key, { ecosystem: m.ecosystem, manifest: m.file });
        }
        if (!roots.has("."))
          roots.set(".", { ecosystem: "", manifest: "" });
        const ordered = [...roots.keys()].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).slice(0, MAX_COMPONENTS);
        const ids = _Survey._mintIds(ordered);
        const byDepth = ordered.filter((r) => r !== ".").sort((a, b) => b.split("/").length - a.split("/").length);
        const owner = (rel) => byDepth.find((r) => rel === r || rel.startsWith(r + "/")) ?? ".";
        const buckets = new Map(ordered.map((r) => [r, []]));
        for (const f of files)
          buckets.get(owner(f.rel))?.push(f);
        const parentOf = /* @__PURE__ */ new Map();
        for (const r of ordered) {
          if (r === ".")
            continue;
          parentOf.set(r, byDepth.find((o) => o !== r && r.startsWith(o + "/")) ?? ".");
        }
        return ordered.map((cRoot) => {
          const meta = roots.get(cRoot);
          const bucket = buckets.get(cRoot) ?? [];
          const abs = path3.join(root, cRoot === "." ? "" : cRoot);
          const langs = /* @__PURE__ */ new Map();
          let bytes = 0, testFiles = 0;
          const testDirs = /* @__PURE__ */ new Set(), patterns = /* @__PURE__ */ new Set();
          for (const f of bucket) {
            bytes += f.size;
            const language = LANGUAGES[path3.extname(f.base).toLowerCase()];
            if (language)
              langs.set(language, (langs.get(language) ?? 0) + 1);
            let matched = false;
            for (const p of TEST_PATTERNS)
              if (p.test(f.base)) {
                patterns.add(p.pattern);
                matched = true;
              }
            if (matched || f.inTestDir) {
              testFiles++;
              const d = f.rel.slice(0, f.rel.lastIndexOf("/"));
              if (d)
                testDirs.add(d);
            }
          }
          const languages = [...langs.entries()].map(([language, n]) => ({ language, files: n })).sort((a, b) => b.files - a.files).slice(0, MAX_LANGUAGES);
          const meta2 = meta.manifest ? _Survey._manifestMeta(path3.join(root, meta.manifest)) : {};
          const entryPoints = _Survey._entryPoints(abs, meta.manifest ? path3.join(root, meta.manifest) : void 0);
          const contains = ordered.filter((o) => parentOf.get(o) === cRoot).map((o) => ids.get(o));
          const kind = _Survey._kind(cRoot, meta.ecosystem, meta2.name, languages, meta2.hasBin, meta2.isApp);
          const stats = { files: bucket.length, bytes };
          const c = {
            id: ids.get(cRoot),
            kind,
            path: cRoot,
            name: meta2.name,
            version: meta2.version,
            ecosystem: meta.ecosystem || void 0,
            manifest: meta.manifest || void 0,
            description: "",
            languages,
            entryPoints: entryPoints.slice(0, MAX_ENTRY_POINTS),
            tests: {
              present: testFiles > 0,
              files: testFiles,
              directories: [...testDirs].sort().slice(0, MAX_TEST_DIRS),
              patterns: [...patterns].sort()
            },
            contains,
            stats
          };
          c.description = _Survey._describe(c);
          return c;
        });
      }
      /** Short, stable, filename-safe, collision-free ids derived from the component's own directory. */
      static _mintIds(roots) {
        const ids = /* @__PURE__ */ new Map();
        const seen = /* @__PURE__ */ new Set([INDEX_FILE.replace(/\.json$/, "")]);
        const safe = (s) => s.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
        for (const r of roots) {
          const segs = r === "." ? ["root"] : r.split("/");
          let id = "component";
          for (let take = 1; take <= segs.length; take++) {
            id = segs.slice(segs.length - take).map(safe).filter(Boolean).join("-") || "component";
            if (!seen.has(id))
              break;
          }
          const base = id;
          for (let n = 2; seen.has(id); n++)
            id = `${base}-${n}`;
          seen.add(id);
          ids.set(r, id);
        }
        return ids;
      }
      /** The coarsest honest classification. `unknown` is a fine answer. */
      static _kind(cRoot, ecosystem, name, languages, hasBin, isApp) {
        if (/(^|\/)(plugins?|extensions?|addons?)(\/|$)/i.test(cRoot) || /-plugin$|^plugin-/i.test(name ?? ""))
          return "plugin";
        if (isApp)
          return "application";
        if (hasBin)
          return "tool";
        const top = languages[0]?.language;
        if (!ecosystem && (top === "HTML" || top === "Markdown"))
          return "docs";
        if (!ecosystem)
          return "unknown";
        return cRoot === "." ? "application" : "library";
      }
      /** The mechanical sentence — a PROTOTYPE description, meant to be rewritten by whoever knows better. */
      static _describe(c) {
        const langs = c.languages.slice(0, 3).map((l) => l.language).join("/");
        const bits = [];
        bits.push(`${langs || "Non-code"} ${c.ecosystem ? `${c.ecosystem} ` : ""}${c.kind}`);
        bits.push(`${c.stats.files} files`);
        if (c.entryPoints.length)
          bits.push(`entry ${c.entryPoints[0].path}`);
        bits.push(c.tests.present ? `${c.tests.files} test files` : "no tests found");
        if (c.contains.length)
          bits.push(`${c.contains.length} sub-component${c.contains.length === 1 ? "" : "s"}`);
        return bits.join(", ") + ".";
      }
      /**
       * Name / version / bin off a manifest, best-effort. JSON is parsed; everything else is matched
       * with a narrow regex rather than pulling TOML/YAML/XML parsers into the SDK for two fields. A
       * miss returns nothing — a manifest's PRESENCE is the load-bearing signal, not its metadata.
       */
      static _manifestMeta(abs) {
        let text;
        try {
          text = fs.readFileSync(abs, "utf8");
        } catch {
          return {};
        }
        if (text.length > 2e5)
          return {};
        if (abs.endsWith(".json")) {
          try {
            const j = JSON.parse(text);
            const declared = { ...j.dependencies, ...j.devDependencies };
            return {
              name: typeof j.name === "string" ? j.name : void 0,
              version: typeof j.version === "string" ? j.version : void 0,
              hasBin: Boolean(j.bin),
              isApp: APP_FRAMEWORKS.some((f) => f in declared)
            };
          } catch {
            return {};
          }
        }
        return {
          name: text.match(/^\s*(?:name|module)\s*[=:]\s*["']?([^"'\n\r]+)/mi)?.[1]?.trim(),
          version: text.match(/^\s*version\s*[=:]\s*["']?([^"'\n\r]+)/mi)?.[1]?.trim()
        };
      }
      /** Declared entry points first ( a manifest saying so is evidence ), conventional ones second. */
      static _entryPoints(componentAbs, manifestAbs) {
        const found = /* @__PURE__ */ new Map();
        if (manifestAbs?.endsWith(".json")) {
          try {
            const pkg = JSON.parse(fs.readFileSync(manifestAbs, "utf8"));
            const put = (v, field) => {
              if (typeof v === "string")
                found.set(v, { path: v, source: "manifest", note: field });
            };
            put(pkg.main, "main");
            put(pkg.module, "module");
            if (typeof pkg.bin === "string")
              put(pkg.bin, "bin");
            else if (pkg.bin && typeof pkg.bin === "object")
              for (const [k, v] of Object.entries(pkg.bin))
                put(v, `bin.${k}`);
          } catch {
          }
        }
        for (const cand of CONVENTIONAL_ENTRIES) {
          if (found.has(cand))
            continue;
          if (fs.existsSync(path3.join(componentAbs, cand)))
            found.set(cand, { path: cand, source: "convention" });
        }
        return [...found.values()].sort((a, b) => a.source === b.source ? a.path.localeCompare(b.path) : a.source === "manifest" ? -1 : 1);
      }
    };
    exports2.Survey = Survey3;
  }
});

// ../kcd_sdk/dist/node/SdkFileAccess.js
var require_SdkFileAccess = __commonJS({
  "../kcd_sdk/dist/node/SdkFileAccess.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SdkFileAccess = exports2.SEARCH_ES_TIMEOUT_MS = exports2.SEARCH_YIELD_EVERY = exports2.SEARCH_WALK_CAP = exports2.SEARCH_MATCH_CAP = exports2.GLOB_WALK_CAP = exports2.GLOB_CAP = exports2.READ_CAP_BYTES = exports2.LIST_CAP = void 0;
    var fs_1 = require("fs");
    var path_1 = require("path");
    var os_1 = require("os");
    var child_process_1 = require("child_process");
    var util_1 = require("util");
    var TextTypes_1 = require_TextTypes();
    var Glob_1 = require_Glob();
    var NameMatch_1 = require_NameMatch();
    var EsCsv_1 = require_EsCsv();
    var _execFile = (0, util_1.promisify)(child_process_1.execFile);
    exports2.LIST_CAP = 1e3;
    exports2.READ_CAP_BYTES = 1048576;
    exports2.GLOB_CAP = 1e3;
    exports2.GLOB_WALK_CAP = 5e4;
    exports2.SEARCH_MATCH_CAP = 2e3;
    exports2.SEARCH_WALK_CAP = 2e6;
    exports2.SEARCH_YIELD_EVERY = 500;
    exports2.SEARCH_ES_TIMEOUT_MS = 5e3;
    function _tick() {
      return new Promise((resolve3) => setImmediate(resolve3));
    }
    var SdkFileAccess = class _SdkFileAccess {
      onWarn;
      esBin;
      constructor(onWarn, esBin) {
        this.onWarn = onWarn;
        this.esBin = esBin;
      }
      /** The browser's navigation anchors: the user's home dir + every existing drive root. */
      roots() {
        return { home: (0, os_1.homedir)(), drives: this._drives() };
      }
      /** One directory's immediate children — dirs first, then files, each alphabetical. Capped at
       *  LIST_CAP (a warn marks a truncated dir). Cheap: sorts off the dirent's own type and caps BEFORE
       *  statting, so a 50k folder costs 50k dirents, not 50k stats. A missing / denied dir folds to []. */
      list(path3) {
        let dirents;
        try {
          dirents = (0, fs_1.readdirSync)(path3, { withFileTypes: true }).map((d) => ({ name: d.name, isDir: d.isDirectory() }));
        } catch (err) {
          this._warn("list_failed", { path: path3, message: this._msg(err) });
          return [];
        }
        dirents.sort((a, b) => a.isDir !== b.isDir ? a.isDir ? -1 : 1 : a.name.localeCompare(b.name));
        if (dirents.length > exports2.LIST_CAP) {
          this._warn("list_truncated", { path: path3, total: dirents.length, cap: exports2.LIST_CAP });
        }
        const out = [];
        for (const d of dirents.slice(0, exports2.LIST_CAP)) {
          const entry = this._entry(path3, d.name, d.isDir);
          if (entry)
            out.push(entry);
        }
        return out;
      }
      /** One entry's metadata, or null when it can't be stat'd. */
      stat(path3) {
        try {
          const s = (0, fs_1.statSync)(path3);
          return { isDir: s.isDirectory(), size: s.size, mtime: s.mtimeMs };
        } catch (err) {
          this._warn("stat_failed", { path: path3, message: this._msg(err) });
          return null;
        }
      }
      /** A text file's contents, or null. Gated THREE ways: a known text extension (TextTypes — the
       *  whitelist, not a guess from bytes), a size under READ_CAP, and a successful read. A binary /
       *  oversized / unreadable file → null + warn; never a heap-blowing slurp, never a throw. */
      read(path3) {
        if (!TextTypes_1.TextTypes.isText(path3)) {
          this._warn("read_skipped_nontext", { path: path3 });
          return null;
        }
        try {
          const s = (0, fs_1.statSync)(path3);
          if (s.size > exports2.READ_CAP_BYTES) {
            this._warn("read_too_large", { path: path3, size: s.size, cap: exports2.READ_CAP_BYTES });
            return null;
          }
          return (0, fs_1.readFileSync)(path3, "utf-8");
        } catch (err) {
          this._warn("read_failed", { path: path3, message: this._msg(err) });
          return null;
        }
      }
      /** Recursively match entries under `root` against a glob ( * within a segment, ** across ), using
       *  the shared Glob matcher so disk-walk results match Vault's vault-glob exactly. Matches BOTH
       *  files and dirs (an agent may be hunting a directory, not just files); every dir is traversed
       *  regardless of whether it matched. Paths match relative to `root`, '/'-normalized. Bounded two
       *  ways: at GLOB_CAP matches and GLOB_WALK_CAP visited entries — when either trips the walk halts
       *  with what it has and warns (made-safe-locally, bubble-up). A denied / missing subtree folds to
       *  a skip + warn, never a throw — the same guard-and-default contract as list/read. */
      glob(root, pattern) {
        const out = [];
        const stack = [root];
        let visited = 0;
        while (stack.length > 0) {
          const dir = stack.pop();
          let dirents;
          try {
            dirents = (0, fs_1.readdirSync)(dir, { withFileTypes: true }).map((d) => ({ name: d.name, isDir: d.isDirectory() }));
          } catch (err) {
            this._warn("glob_walk_failed", { dir, message: this._msg(err) });
            continue;
          }
          for (const d of dirents) {
            visited += 1;
            if (visited > exports2.GLOB_WALK_CAP) {
              this._warn("glob_walk_capped", { root, pattern, cap: exports2.GLOB_WALK_CAP });
              return out;
            }
            const full = (0, path_1.join)(dir, d.name);
            const rel = (0, path_1.relative)(root, full).split(path_1.sep).join("/");
            if (Glob_1.Glob.matches(rel, pattern)) {
              const entry = this._entry(dir, d.name, d.isDir);
              if (entry) {
                out.push(entry);
              }
              if (out.length >= exports2.GLOB_CAP) {
                this._warn("glob_truncated", { root, pattern, cap: exports2.GLOB_CAP });
                return out;
              }
            }
            if (d.isDir) {
              stack.push(full);
            }
          }
        }
        return out;
      }
      /** Recursively find entries whose NAME contains `query` (case-insensitive substring — see
       *  NameMatch). `roots` is EITHER a subfolder scope (one entry) OR the whole computer (an EMPTY
       *  array — not an enumerated drive list; both this method and _esSearch expand '[]' to every
       *  drive themselves, so the caller never has to know how "everywhere" is represented).
       *
       *  Tries the ES fast path FIRST when a binary was injected (see the constructor) — a real,
       *  already-live Everything instance answers in tens of milliseconds instead of walking disk; see
       *  _Claude/plans/search-all-files.html Phase 5. Any failure there (missing binary, Everything not
       *  running, a timeout, a multi-root call ES's -path can't express) falls through silently to the
       *  walk below — the fast path is a pure accelerant, never a hard dependency.
       *
       *  The walk itself is ASYNC and yields the event loop every SEARCH_YIELD_EVERY visited entries: a
       *  whole-drive walk run synchronously would freeze the entire Electron main process, not just this
       *  feature, and a cancel could never be noticed mid-walk. Pass a SearchToken and flip `.cancelled`
       *  from elsewhere to stop it at its next yield point — it returns what it has so far, never throws.
       *  A blank query returns [] immediately (never silently lists the whole machine). Bounded by
       *  SEARCH_MATCH_CAP / SEARCH_WALK_CAP, same degrade-and-warn contract as glob(). */
      async search(roots, query, token = { cancelled: false }) {
        const q = query.trim();
        if (!q || token.cancelled)
          return [];
        if (this.esBin) {
          const fast = await this._esSearch(roots, q);
          if (fast !== null)
            return fast;
        }
        const out = [];
        const stack = roots.length > 0 ? [...roots] : this._drives();
        let visited = 0;
        while (stack.length > 0) {
          const dir = stack.pop();
          let dirents;
          try {
            dirents = (0, fs_1.readdirSync)(dir, { withFileTypes: true }).map((d) => ({ name: d.name, isDir: d.isDirectory() }));
          } catch (err) {
            this._warn("search_walk_failed", { dir, message: this._msg(err) });
            continue;
          }
          for (const d of dirents) {
            visited += 1;
            if (visited > exports2.SEARCH_WALK_CAP) {
              this._warn("search_walk_capped", { query, cap: exports2.SEARCH_WALK_CAP });
              return out;
            }
            if (NameMatch_1.NameMatch.matches(d.name, q)) {
              const entry = this._entry(dir, d.name, d.isDir);
              if (entry)
                out.push(entry);
              if (out.length >= exports2.SEARCH_MATCH_CAP) {
                this._warn("search_truncated", { query, cap: exports2.SEARCH_MATCH_CAP });
                return out;
              }
            }
            if (d.isDir)
              stack.push((0, path_1.join)(dir, d.name));
            if (visited % exports2.SEARCH_YIELD_EVERY === 0) {
              await _tick();
              if (token.cancelled) {
                this._warn("search_cancelled", { query, matched: out.length, visited });
                return out;
              }
            }
          }
        }
        return out;
      }
      /** The fast path: ask a real, already-live Everything instance instead of walking disk. Returns
       *  `null` — never throws — on ANY failure, which `search()` reads as "fall through to the walk":
       *  missing binary (ENOENT), Everything not running, a timeout, unparseable output. Only engages
       *  for zero or ONE root — es.exe's `-path` takes a single directory, and neither of our own
       *  callers (folder scope, whole-computer scope) ever ask for more than that; a genuine multi-root
       *  call skips straight to the walk rather than trying to fan out N processes for one query. */
      async _esSearch(roots, query) {
        if (!this.esBin || roots.length > 1)
          return null;
        let stdout2;
        try {
          ({ stdout: stdout2 } = await _execFile(this.esBin, _SdkFileAccess._esArgs(roots, query), { timeout: exports2.SEARCH_ES_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }));
        } catch (err) {
          this._warn("search_es_unavailable", { message: this._msg(err) });
          return null;
        }
        try {
          return EsCsv_1.EsCsv.parse(stdout2);
        } catch (err) {
          this._warn("search_es_parse_failed", { message: this._msg(err) });
          return null;
        }
      }
      /** The es.exe argv for one search — a pure builder ( no spawn, no fs ) so the "-path
       *  present/absent" scoping logic is directly testable without a real process. Column order is
       *  FIXED by this exact flag order: Name, Filename ( full path ), Attributes, Size, Date Modified
       *  — EsCsv.parse relies on it positionally ( -no-header ). -date-format 3 = ISO-8601 UTC,
       *  parseable unambiguously regardless of the machine's local timezone. `roots.length === 0` (
       *  whole computer ) omits -path entirely rather than enumerating drives — es.exe already searches
       *  every indexed volume by default. */
      static _esArgs(roots, query) {
        const args = [
          "-csv",
          "-no-header",
          "-name",
          "-filename-column",
          "-attributes",
          "-size",
          "-date-modified",
          "-date-format",
          "3",
          "-max-results",
          String(exports2.SEARCH_MATCH_CAP)
        ];
        if (roots.length === 1 && roots[0])
          args.push("-path", roots[0]);
        args.push(query);
        return args;
      }
      // ── writes ───────────────────────────────────────────────────────────────────────
      // The mutation half: pure `fs`, framework-free, the same degrade-and-default contract as the reads
      // but with a BOOLEAN currency — a write the caller must know succeeded, not a value that folds to
      // null. Every op guards-and-warns: a denied / colliding / failed write returns `false` and pings
      // `onWarn`, never a throw. Collision POLICY lives in the caller (MainFileService) — these are the
      // raw levers, exact-path-in. The Electron-only ops (recycle-bin trash, OS reveal) are NOT here:
      // they need `shell`, which would couple this framework-free core to one host — they live on the
      // service instead. NOTE: this is filesystem MANAGEMENT (mkdir/touch/move/copy/rename); writing file
      // CONTENT (the editor save) is a separate, later lever.
      /** Make a directory ( recursive — parents created as needed ). */
      mkdir(path3) {
        try {
          (0, fs_1.mkdirSync)(path3, { recursive: true });
          return true;
        } catch (err) {
          this._warn("mkdir_failed", { path: path3, message: this._msg(err) });
          return false;
        }
      }
      /** Create a new EMPTY file. The `wx` flag refuses to clobber an existing file (a fresh touch only,
       *  never an overwrite) — the caller de-collides the name first, so a collision here is a real fault. */
      createFile(path3) {
        try {
          (0, fs_1.writeFileSync)(path3, "", { flag: "wx" });
          return true;
        } catch (err) {
          this._warn("create_failed", { path: path3, message: this._msg(err) });
          return false;
        }
      }
      /** Save text CONTENT to a file ( the editor save ) — the parent dir is created if missing, and an
       *  existing file is OVERWRITTEN ( unlike createFile's no-clobber touch; overwriting is the point of a
       *  save ). Boolean + warn like its siblings; the consumer surfaces the failure to the user ( a toast ),
       *  this core just reports it and routes the OS reason to the warn hook. */
      write(path3, content) {
        try {
          (0, fs_1.mkdirSync)((0, path_1.dirname)(path3), { recursive: true });
          (0, fs_1.writeFileSync)(path3, content, "utf-8");
          return true;
        } catch (err) {
          this._warn("write_failed", { path: path3, message: this._msg(err) });
          return false;
        }
      }
      /** Rename / move by exact paths — the raw lever. `from` → `to`, no collision check (the caller owns
       *  that policy). A cross-volume move surfaces as EXDEV; for that, use `move`, which falls back. */
      rename(from, to) {
        try {
          (0, fs_1.renameSync)(from, to);
          return true;
        } catch (err) {
          this._warn("rename_failed", { from, to, message: this._msg(err) });
          return false;
        }
      }
      /** Recursively copy `from` to the exact path `to` ( file or whole directory ). */
      copy(from, to) {
        try {
          (0, fs_1.cpSync)(from, to, { recursive: true });
          return true;
        } catch (err) {
          this._warn("copy_failed", { from, to, message: this._msg(err) });
          return false;
        }
      }
      /** Move `from` to the exact path `to`. A plain rename first ( atomic, same-volume ); on a cross-volume
       *  EXDEV failure, fall back to copy-then-remove so a move across drives still works. */
      move(from, to) {
        try {
          (0, fs_1.renameSync)(from, to);
          return true;
        } catch (err) {
          if (err?.code === "EXDEV") {
            try {
              (0, fs_1.cpSync)(from, to, { recursive: true });
              (0, fs_1.rmSync)(from, { recursive: true, force: true });
              return true;
            } catch (err2) {
              this._warn("move_failed", { from, to, message: this._msg(err2) });
              return false;
            }
          }
          this._warn("move_failed", { from, to, message: this._msg(err) });
          return false;
        }
      }
      /** A non-colliding variant of `desired`: the path itself if it's free, else the same name with a
       *  numeric suffix ( "report.md" → "report 2.md", "Notes" → "Notes 2" ) — files keep their extension.
       *  Pure: `existsSync` only, no mutation. The caller writes to the returned path. */
      uniquePath(desired) {
        if (!(0, fs_1.existsSync)(desired))
          return desired;
        const dir = (0, path_1.dirname)(desired);
        const ext = (0, path_1.extname)(desired);
        const stem = (0, path_1.basename)(desired, ext);
        for (let n = 2; n < 1e4; n += 1) {
          const candidate = (0, path_1.join)(dir, `${stem} ${n}${ext}`);
          if (!(0, fs_1.existsSync)(candidate))
            return candidate;
        }
        return desired;
      }
      /** Pure path containment — resolve `path` and return it iff it sits inside one of `roots`, else
       *  null. No fs touch, no instance state (static). `..` segments resolve away first, so an escaping
       *  path lands outside every root and returns null; the `sep` boundary stops `/foo/bar` from matching
       *  a `/foo/ba` root. The primitive `WhitelistGuard` turns a null into a loud GuardError. */
      static jail(path3, roots) {
        const target = (0, path_1.resolve)(path3);
        const fold = process.platform === "win32" ? (s) => s.toLowerCase() : (s) => s;
        const t = fold(target);
        for (const root of roots) {
          const base = fold((0, path_1.resolve)(root));
          if (t === base || t.startsWith(base + path_1.sep))
            return target;
        }
        return null;
      }
      // ── private ──────────────────────────────────────────────────────────────────────
      /** Build one FileEntry, or null when the child can't be stat'd (a broken symlink, a permission
       *  wall) — one bad child never aborts the whole listing. `isDir` comes from the dirent (cheaper
       *  and symlink-honest enough for v1); size/mtime need the stat. */
      _entry(dir, name, isDir) {
        const full = (0, path_1.join)(dir, name);
        try {
          const s = (0, fs_1.statSync)(full);
          return {
            name,
            path: full,
            isDir,
            size: s.size,
            ext: (0, path_1.extname)(name).replace(/^\./, "").toLowerCase(),
            mtime: s.mtimeMs
          };
        } catch {
          return null;
        }
      }
      /** Existing drive roots. Windows: probe A:..Z: (cheap existsSync). POSIX: the single '/'. */
      _drives() {
        if (process.platform !== "win32")
          return ["/"];
        const out = [];
        for (let c = 65; c <= 90; c += 1) {
          const root = `${String.fromCharCode(c)}:\\`;
          if ((0, fs_1.existsSync)(root))
            out.push(root);
        }
        return out;
      }
      _warn(event, detail) {
        this.onWarn?.(event, detail);
      }
      _msg(err) {
        return err instanceof Error ? err.message : String(err);
      }
    };
    exports2.SdkFileAccess = SdkFileAccess;
  }
});

// ../kcd_sdk/dist/node/index.js
var require_node = __commonJS({
  "../kcd_sdk/dist/node/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SEARCH_ES_TIMEOUT_MS = exports2.SEARCH_YIELD_EVERY = exports2.SEARCH_WALK_CAP = exports2.SEARCH_MATCH_CAP = exports2.GLOB_WALK_CAP = exports2.GLOB_CAP = exports2.READ_CAP_BYTES = exports2.LIST_CAP = exports2.SdkFileAccess = exports2.Survey = exports2.VaultDeploy = exports2.VaultUtilities = exports2.Vault = exports2.loadLensFromDisk = exports2.inferProjectRoot = exports2.fsReader = void 0;
    __exportStar(require_core(), exports2);
    __exportStar(require_scanner2(), exports2);
    __exportStar(require_server(), exports2);
    var io_1 = require_io();
    Object.defineProperty(exports2, "fsReader", { enumerable: true, get: function() {
      return io_1.fsReader;
    } });
    Object.defineProperty(exports2, "inferProjectRoot", { enumerable: true, get: function() {
      return io_1.inferProjectRoot;
    } });
    Object.defineProperty(exports2, "loadLensFromDisk", { enumerable: true, get: function() {
      return io_1.loadLensFromDisk;
    } });
    var Vault_1 = require_Vault();
    Object.defineProperty(exports2, "Vault", { enumerable: true, get: function() {
      return Vault_1.Vault;
    } });
    var VaultUtilities_1 = require_VaultUtilities();
    Object.defineProperty(exports2, "VaultUtilities", { enumerable: true, get: function() {
      return VaultUtilities_1.VaultUtilities;
    } });
    var VaultDeploy_1 = require_VaultDeploy();
    Object.defineProperty(exports2, "VaultDeploy", { enumerable: true, get: function() {
      return VaultDeploy_1.VaultDeploy;
    } });
    var Survey_1 = require_Survey();
    Object.defineProperty(exports2, "Survey", { enumerable: true, get: function() {
      return Survey_1.Survey;
    } });
    var SdkFileAccess_1 = require_SdkFileAccess();
    Object.defineProperty(exports2, "SdkFileAccess", { enumerable: true, get: function() {
      return SdkFileAccess_1.SdkFileAccess;
    } });
    Object.defineProperty(exports2, "LIST_CAP", { enumerable: true, get: function() {
      return SdkFileAccess_1.LIST_CAP;
    } });
    Object.defineProperty(exports2, "READ_CAP_BYTES", { enumerable: true, get: function() {
      return SdkFileAccess_1.READ_CAP_BYTES;
    } });
    Object.defineProperty(exports2, "GLOB_CAP", { enumerable: true, get: function() {
      return SdkFileAccess_1.GLOB_CAP;
    } });
    Object.defineProperty(exports2, "GLOB_WALK_CAP", { enumerable: true, get: function() {
      return SdkFileAccess_1.GLOB_WALK_CAP;
    } });
    Object.defineProperty(exports2, "SEARCH_MATCH_CAP", { enumerable: true, get: function() {
      return SdkFileAccess_1.SEARCH_MATCH_CAP;
    } });
    Object.defineProperty(exports2, "SEARCH_WALK_CAP", { enumerable: true, get: function() {
      return SdkFileAccess_1.SEARCH_WALK_CAP;
    } });
    Object.defineProperty(exports2, "SEARCH_YIELD_EVERY", { enumerable: true, get: function() {
      return SdkFileAccess_1.SEARCH_YIELD_EVERY;
    } });
    Object.defineProperty(exports2, "SEARCH_ES_TIMEOUT_MS", { enumerable: true, get: function() {
      return SdkFileAccess_1.SEARCH_ES_TIMEOUT_MS;
    } });
  }
});

// ../kcd_sdk/dist/index.js
var require_dist = __commonJS({
  "../kcd_sdk/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_node(), exports2);
  }
});

// src/cli/Cli.ts
var path2 = __toESM(require("path"));
var import_child_process = require("child_process");
var import_fs2 = require("fs");
var import_kcd_sdk6 = __toESM(require_dist());

// src/Config.ts
var path = __toESM(require("path"));
var import_fs = require("fs");
var import_kcd_sdk = __toESM(require_dist());
var HOST_SLICE_ENV = "STARMIND_PACKAGE_STORE";
var PROJECT_ROOT_ENV = "DAEDALUS_PROJECT_ROOT";
var DOC_ROOT_ENV = "DAEDALUS_DOC_ROOT";
var DEFAULT_DOC_ROOT = "_Claude";
var Config = class _Config {
  static argument = {};
  /**
   * The argument tier. Called once at startup by whoever parsed the arguments — index.ts from
   * argv today, the CLI shell ( plan 1.c ) later. Blank and undefined values are ignored rather
   * than stored, so a flag that was never passed cannot shadow the tiers beneath it.
   */
  static override(values) {
    const root = _Config.str(values.projectRoot);
    const doc = _Config.str(values.docRoot);
    if (root) _Config.argument.projectRoot = root;
    if (doc) _Config.argument.docRoot = doc;
  }
  /**
   * Resolve both fields through the tiers. Read fresh on every call: the host slice is a live
   * file, and freshness is the contract every consumer here already relies on.
   */
  static resolve() {
    const slice = _Config.slice();
    const docRoot = _Config.pick([
      ["argument", _Config.argument.docRoot],
      ["host-slice", slice["docRoot"]],
      ["environment", process.env[DOC_ROOT_ENV]]
    ]) ?? { value: DEFAULT_DOC_ROOT, source: "fallback" };
    const projectRoot = _Config.pick([
      ["argument", _Config.argument.projectRoot],
      ["host-slice", slice["projectRoot"]],
      ["environment", process.env[PROJECT_ROOT_ENV]]
    ]) ?? _Config.infer(docRoot.value);
    return {
      projectRoot: path.resolve(projectRoot.value),
      docRoot: docRoot.value,
      source: { projectRoot: projectRoot.source, docRoot: docRoot.source }
    };
  }
  /** The first tier holding a usable value, carrying its name; null when every tier is empty. */
  static pick(tiers) {
    for (const [source, value] of tiers) {
      const clean = _Config.str(value);
      if (clean) return { value: clean, source };
    }
    return null;
  }
  /**
   * The inferred tier — walk up from the working directory for an ancestor holding the doc root.
   * inferProjectRoot starts at its argument's PARENT, so the doc root itself is handed in as the
   * start path: its parent is the working directory, which makes the walk cwd-inclusive.
   *
   * No ancestor holds one → the working directory, so the server still starts and `doctor` can
   * report a vault it could not find, rather than the process dying before it can say so.
   */
  static infer(docRoot) {
    const cwd = process.cwd();
    try {
      return { value: (0, import_kcd_sdk.inferProjectRoot)(path.join(cwd, docRoot), docRoot), source: "inferred" };
    } catch {
      return { value: cwd, source: "fallback" };
    }
  }
  /**
   * The host slice — a JSON file whose absolute path the host puts in HOST_SLICE_ENV at spawn.
   * Any failure ( no var, no file, bad JSON ) degrades to empty, because no host at all is the
   * ordinary standalone case rather than an error.
   */
  static slice() {
    const file = process.env[HOST_SLICE_ENV];
    if (!file) return {};
    try {
      return JSON.parse((0, import_fs.readFileSync)(file, "utf8"));
    } catch {
      return {};
    }
  }
  /** A non-empty string, or null — so a blank or garbled value falls through to the next tier. */
  static str(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }
};

// src/cli/Prompt.ts
var readline = __toESM(require("node:readline/promises"));
var import_node_process = require("node:process");
var Prompt = class {
  static rl = null;
  /** True only when BOTH ends are a terminal. stdout alone is not enough — a piped stdin has no
   *  one to answer, and asking would hang the process forever waiting on EOF. */
  static get interactive() {
    return Boolean(import_node_process.stdin.isTTY && import_node_process.stdout.isTTY);
  }
  static io() {
    if (!this.rl) this.rl = readline.createInterface({ input: import_node_process.stdin, output: import_node_process.stdout });
    return this.rl;
  }
  /** Release the handle, or the process hangs with the terminal in a half-owned state. */
  static close() {
    this.rl?.close();
    this.rl = null;
  }
  // ── Colour ────────────────────────────────────────────────────────────────
  static DIM = "\x1B[2m";
  static BOLD = "\x1B[1m";
  static CYAN = "\x1B[36m";
  static OFF = "\x1B[0m";
  static tint(code, s) {
    return import_node_process.stdout.isTTY ? `${code}${s}${this.OFF}` : s;
  }
  // ── Questions ─────────────────────────────────────────────────────────────
  /** Yes/no. `def` is what Enter means, and what a non-TTY run gets. */
  static async confirm(question, def, note) {
    if (!this.interactive) return def;
    import_node_process.stdout.write(`
${this.tint(this.CYAN, "?")} ${this.tint(this.BOLD, question)}
`);
    if (note) import_node_process.stdout.write(`${this.tint(this.DIM, "  " + note)}
`);
    const hint = def ? "Y/n" : "y/N";
    const answer = (await this.io().question(`  ${this.tint(this.DIM, `(${hint})`)} \u203A `)).trim().toLowerCase();
    if (!answer) return def;
    return answer.startsWith("y");
  }
  /**
   * Pick one. Returns the chosen option's `value`. Out-of-range or unparseable input re-asks
   * rather than silently taking the default — a mistyped answer to "what should I delete" must
   * never be read as consent.
   */
  static async select(question, options, defIndex = 0, note) {
    if (!this.interactive || options.length === 0) return options[defIndex]?.value;
    for (; ; ) {
      import_node_process.stdout.write(`
${this.tint(this.CYAN, "?")} ${this.tint(this.BOLD, question)}
`);
      if (note) import_node_process.stdout.write(`${this.tint(this.DIM, "  " + note)}
`);
      options.forEach((o, i) => {
        const mark = i === defIndex ? this.tint(this.CYAN, "\u203A") : " ";
        import_node_process.stdout.write(`  ${mark} ${i + 1}) ${o.label}${o.note ? this.tint(this.DIM, "  \u2014 " + o.note) : ""}
`);
      });
      const raw = (await this.io().question(`  ${this.tint(this.DIM, `(1-${options.length}, Enter = ${defIndex + 1})`)} \u203A `)).trim();
      if (!raw) return options[defIndex].value;
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
      import_node_process.stdout.write(`  ${this.tint(this.DIM, `not one of 1-${options.length} \u2014 try again`)}
`);
    }
  }
  /**
   * Pick any number. Comma-separated numbers, `all`, or `none`; Enter takes the pre-selected set.
   * Returns the chosen options' values in the order they were offered, not the order typed.
   */
  static async multiselect(question, options, defSelected, note) {
    const fallback = () => defSelected.map((i) => options[i]?.value).filter((v) => v !== void 0);
    if (!this.interactive || options.length === 0) return fallback();
    for (; ; ) {
      import_node_process.stdout.write(`
${this.tint(this.CYAN, "?")} ${this.tint(this.BOLD, question)}
`);
      if (note) import_node_process.stdout.write(`${this.tint(this.DIM, "  " + note)}
`);
      options.forEach((o, i) => {
        const mark = defSelected.includes(i) ? this.tint(this.CYAN, "\xB7") : " ";
        import_node_process.stdout.write(`  ${mark} ${i + 1}) ${o.label}${o.note ? this.tint(this.DIM, "  \u2014 " + o.note) : ""}
`);
      });
      const raw = (await this.io().question(`  ${this.tint(this.DIM, 'comma-separated, "all", "none", Enter = marked')} \u203A `)).trim().toLowerCase();
      if (!raw) return fallback();
      if (raw === "all") return options.map((o) => o.value);
      if (raw === "none") return [];
      const picked = raw.split(",").map((s) => Number(s.trim()));
      if (picked.every((n) => Number.isInteger(n) && n >= 1 && n <= options.length)) {
        const set = new Set(picked.map((n) => n - 1));
        return options.filter((_o, i) => set.has(i)).map((o) => o.value);
      }
      import_node_process.stdout.write(`  ${this.tint(this.DIM, `numbers between 1 and ${options.length}, please`)}
`);
    }
  }
  /** A section heading between steps, so a stepper reads as progress rather than a wall. */
  static step(n, total, title) {
    import_node_process.stdout.write(`
${this.tint(this.DIM, `\u2500\u2500 step ${n}/${total} ` + "\u2500".repeat(Math.max(0, 46 - title.length)))} ${this.tint(this.BOLD, title)}
`);
  }
};

// src/mcp/McpServer.ts
var readline2 = __toESM(require("readline"));
var PARSE_ERROR = -32700;
var INVALID_REQUEST = -32600;
var METHOD_NOT_FOUND = -32601;
var INVALID_PARAMS = -32602;
var PROTOCOL_VERSION = "2024-11-05";
var McpServer = class {
  constructor(info) {
    this.info = info;
  }
  tools = /* @__PURE__ */ new Map();
  /** Register a tool. Last registration of a name wins. */
  registerTool(def) {
    this.tools.set(def.name, def);
  }
  /**
   * Start the read loop. Resolves when stdin closes (client disconnected) — the
   * caller can then exit. Each input line is one JSON-RPC message.
   */
  connect() {
    const rl = readline2.createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      void this.handleLine(trimmed);
    });
    return new Promise((resolve3) => rl.on("close", resolve3));
  }
  // ── Dispatch ────────────────────────────────────────────────────────────────
  async handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      this.sendError(null, PARSE_ERROR, "Parse error: invalid JSON");
      return;
    }
    if (typeof msg.method !== "string") {
      if (msg.id !== void 0) this.sendError(msg.id, INVALID_REQUEST, "Invalid request: missing method");
      return;
    }
    const isNotification = msg.id === void 0;
    try {
      switch (msg.method) {
        case "initialize":
          this.reply(msg.id, this.onInitialize(msg.params));
          return;
        case "tools/list":
          this.reply(msg.id, this.onToolsList());
          return;
        case "tools/call":
          this.reply(msg.id, await this.onToolsCall(msg.params));
          return;
        case "ping":
          this.reply(msg.id, {});
          return;
        default:
          if (!isNotification) this.sendError(msg.id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
          return;
      }
    } catch (e) {
      if (!isNotification) this.sendError(msg.id, INVALID_PARAMS, errorText(e));
    }
  }
  // ── Method handlers ───────────────────────────────────────────────────────────
  onInitialize(params) {
    const requested = typeof params?.["protocolVersion"] === "string" ? params["protocolVersion"] : PROTOCOL_VERSION;
    return {
      protocolVersion: requested,
      capabilities: { tools: {} },
      serverInfo: { name: this.info.name, version: this.info.version }
    };
  }
  /**
   * The wire tool surface — the exact array `tools/list` sends, exposed publicly so tooling can read a
   * built server's surface WITHOUT spawning it over stdio (the promotion script regenerates the committed
   * `tools.snapshot.json` from this — authoritative by construction, since it is the same projection the
   * wire uses). No handlers, no protocol framing: just the descriptors a client sees.
   */
  listTools() {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      // Only emit the key when a tool declares hints — a client sees `annotations` or nothing.
      ...t.annotations ? { annotations: t.annotations } : {},
      ...t.example ? { example: t.example } : {},
      ...t.doc ? { doc: t.doc } : {}
    }));
  }
  onToolsList() {
    return { tools: this.listTools() };
  }
  async onToolsCall(params) {
    const name = params?.["name"];
    if (typeof name !== "string") {
      throw new Error('tools/call requires a string "name"');
    }
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const args = params?.["arguments"] ?? {};
    return this.invoke(name, args);
  }
  /**
   * Run a registered tool in-process by name — the dispatch a COMPOSING tool ( e.g. a batch ) uses
   * without going over the wire. Same contract as a wire call: a handler that throws folds into an
   * isError result, never propagating. An unknown tool is an isError result too — unlike a wire
   * tools/call ( which raises a protocol error ), there is no protocol layer here, so a caller can
   * treat every outcome uniformly as a ToolResult.
   */
  async invoke(name, args) {
    const tool = this.tools.get(name);
    if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    try {
      return await tool.handler(args);
    } catch (e) {
      return { content: [{ type: "text", text: errorText(e) }], isError: true };
    }
  }
  // ── Wire I/O ──────────────────────────────────────────────────────────────────
  reply(id, result) {
    this.write({ jsonrpc: "2.0", id, result });
  }
  sendError(id, code, message) {
    this.write({ jsonrpc: "2.0", id: id ?? void 0, error: { code, message } });
  }
  write(msg) {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }
};
function errorText(e) {
  return e instanceof Error ? e.message : String(e);
}

// src/mcp/verify.ts
async function runVerify(registrations, manifest) {
  const tools = [];
  for (const { def, spec } of registrations) {
    const cases = [];
    for (const tc of spec) cases.push(await runCase(def, tc));
    const passed = cases.filter((c) => c.pass).length;
    tools.push({ name: def.name, passed, failed: cases.length - passed, cases });
  }
  return {
    server_id: manifest.id,
    version: manifest.version,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tools,
    overall: tools.every((t) => t.failed === 0) ? "pass" : "fail"
  };
}
async function runCase(def, tc) {
  let result;
  try {
    result = await def.handler(tc.input);
  } catch (e) {
    result = { content: [{ type: "text", text: errorText2(e) }], isError: true };
  }
  return { label: tc.label, ...judge(tc.assertions, result) };
}
function judge(assertions, result) {
  if (assertions.some((a) => a.type === "error_expected")) {
    return result.isError === true ? { pass: true } : { pass: false, detail: "expected an error result, got success" };
  }
  if (result.isError) {
    return { pass: false, detail: `unexpected error: ${textOf(result)}` };
  }
  if (assertions.length === 0) return { pass: true };
  let data;
  try {
    data = JSON.parse(textOf(result));
  } catch {
    return { pass: false, detail: "result payload was not JSON, but assertions require a JSON object" };
  }
  for (const a of assertions) {
    const detail = checkOne(a, data);
    if (detail) return { pass: false, detail };
  }
  return { pass: true };
}
function checkOne(a, data) {
  switch (a.type) {
    case "has_key":
      return a.key in data ? "" : `missing key "${a.key}"`;
    case "type_is": {
      const actual = typeName(data[a.key]);
      return actual === a.expected ? "" : `key "${a.key}" is ${actual}, expected ${a.expected}`;
    }
    case "value_eq":
      return JSON.stringify(data[a.key]) === JSON.stringify(a.expected) ? "" : `key "${a.key}" did not equal the expected value`;
    case "error_expected":
      return "";
  }
}
function typeName(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function textOf(result) {
  return result.content[0]?.text ?? "";
}
function errorText2(e) {
  return e instanceof Error ? e.message : String(e);
}

// src/guards/AbstractGuard.ts
var GuardError = class extends Error {
  /** Short machine-readable rejection code for logging and error mapping. */
  code;
  constructor(message, code = "GUARD_REJECTED") {
    super(message);
    this.name = "GuardError";
    this.code = code;
  }
};
var AbstractGuard = class {
};

// src/guards/GuardChain.ts
var GuardChain = class {
  guards = [];
  constructor(...guards) {
    this.guards = [...guards];
  }
  /** Run all guards against the request. Throws GuardError on the first rejection. */
  run(req) {
    for (const guard of this.guards) {
      guard.validate(req);
    }
  }
  /** Append a guard to the end of the chain. */
  add(guard) {
    this.guards.push(guard);
  }
};

// src/MCPUtils.ts
var import_kcd_sdk2 = __toESM(require_dist());
var MCPUtils = class {
  static cacheKey = "";
  static cacheVault = null;
  /**
   * The vault bound to this server's CURRENT configured root. A GETTER, not a fixed field: it
   * resolves config fresh through Config's tiers on each access, so a root a host rewrites is
   * picked up on the next tool call with no respawn. The Vault is cached by config value, so it's
   * only rebuilt when the root actually changes — repeated accesses are cheap.
   */
  static get vault() {
    const { projectRoot, docRoot } = Config.resolve();
    const key = `${projectRoot}\0${docRoot}`;
    if (key !== this.cacheKey || this.cacheVault === null) {
      this.cacheVault = new import_kcd_sdk2.Vault(projectRoot, docRoot);
      this.cacheKey = key;
    }
    return this.cacheVault;
  }
  /** Wrap any serialisable value in the MCP text-content envelope, as pretty JSON. */
  static result(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
  /** Return already-formatted prose AS-IS — no JSON wrapping. For payloads that are meant to be
   *  read as text ( a lean projection, a rendered chart ), where JSON.stringify's quotes and
   *  escaped newlines would defeat the whole point of the format. */
  static text(body) {
    return { content: [{ type: "text", text: body }] };
  }
  /** Error response the MCP client surfaces as a tool failure. */
  static error(message) {
    return { content: [{ type: "text", text: message }], isError: true };
  }
};

// src/guards/PathGuard.ts
var PathGuard = class extends AbstractGuard {
  validate(req) {
    const p = req.params;
    for (const key of ["path", "from", "to"]) {
      if (typeof p[key] === "string") this.jail(p[key]);
    }
    if (req.tool === "kcd_save" && typeof p["path"] === "string") {
      this.checkType(p["path"], p["artifact"]);
    }
  }
  /**
   * Assert that absPath resolves inside the vault root.
   * Throws GuardError if it resolves to a path outside or equal to the vault root itself.
   */
  jail(inputPath) {
    if (!MCPUtils.vault.isInside(inputPath)) {
      throw new GuardError(
        `Path "${inputPath}" is outside the vault ("${MCPUtils.vault.root}")`,
        "PATH_OUTSIDE_VAULT"
      );
    }
  }
  /**
   * On a save, assert the artifact's declared type matches the type its target directory implies —
   * a lens cannot be saved into references/, etc. ( the path itself is jailed by validate() ). A
   * missing/unknown declared type is left to KcdValidate downstream; this only catches a real mismatch.
   */
  checkType(writePath, artifact) {
    const inferredType = MCPUtils.vault.classify(writePath);
    const fm = typeof artifact === "object" && artifact !== null ? artifact["frontmatter"] : void 0;
    const declaredType = typeof fm === "object" && fm !== null ? String(fm["type"] ?? "") : "";
    if (declaredType && inferredType !== "unknown" && declaredType !== inferredType) {
      throw new GuardError(
        `Type mismatch at "${writePath}": directory implies "${inferredType}", artifact declares "${declaredType}"`,
        "TYPE_MISMATCH"
      );
    }
  }
  /**
   * Nonce validation slot — inert in Phase 2 (stdio transport).
   * Named-pipe transport passes the session nonce here; this method becomes
   * the single enforcement point without touching any tool handler.
   */
  validateNonce(_token) {
    return true;
  }
};

// src/tools/discovery.ts
var import_kcd_sdk3 = __toESM(require_dist());
function discoveryTools(chain) {
  return [
    {
      name: "kcd_query",
      annotations: { readOnlyHint: true },
      example: { type: "lens" },
      spec: [
        { label: "lists the lenses subtree", input: { glob: "lenses/**" }, assertions: [] },
        { label: "lists all lenses", input: { type: "lens" }, assertions: [] },
        { label: "finds a body/frontmatter term", input: { text: "lens" }, assertions: [] },
        { label: "censuses the vault by type", input: { groupBy: "type" }, assertions: [] }
      ],
      description: "Find artifacts by path glob, type, and body text \u2014 the place to start when you don't know the path.",
      doc: 'The single read-query over the vault \u2014 subsumes the old glob/list/search/types tools. Any of `glob` ( vault-relative path pattern; `*` within a segment, `**` across ), `type` ( artifact classifier: lens, plan, habit, reference, contract, generator, analyzer, template, framework, nav-index ), and `text` ( case-insensitive substring across body + serialized frontmatter ) may be combined; they AND together. With no filter it returns the whole vault. Returns an array of refs ( path + type + name ) \u2014 read one with kcd_get, walk its edges with kcd_links. Pass `groupBy: "type"` to get `{ type, count }[]` ( sorted by count, descending ) instead of refs \u2014 the cheapest orientation call. Read-only.',
      inputSchema: {
        type: "object",
        properties: {
          glob: { type: "string", description: "Vault-relative path glob; * within a segment, ** across segments." },
          type: {
            type: "string",
            enum: ["lens", "plan", "habit", "reference", "contract", "generator", "analyzer", "template", "framework", "nav-index"],
            description: "Artifact-type filter."
          },
          text: { type: "string", description: "Case-insensitive substring across body + serialized frontmatter." },
          groupBy: { type: "string", enum: ["type"], description: "Return { type, count }[] instead of refs." }
        },
        required: []
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_query", params: args });
          const result = import_kcd_sdk3.VaultUtilities.query(MCPUtils.vault, {
            glob: typeof args["glob"] === "string" ? args["glob"] : void 0,
            type: typeof args["type"] === "string" ? args["type"] : void 0,
            text: typeof args["text"] === "string" ? args["text"] : void 0,
            groupBy: args["groupBy"] === "type" ? "type" : void 0
          });
          return MCPUtils.result(result);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    }
  ];
}

// src/tools/read.ts
var import_kcd_sdk4 = __toESM(require_dist());
function readTools(chain) {
  return [
    {
      name: "kcd_get",
      annotations: { readOnlyHint: true },
      spec: [
        { label: "reads a lens artifact", input: { path: "lenses/parser/parser.html" }, assertions: [] },
        { label: "PathGuard jails an out-of-vault path", input: { path: "C:/Windows/System32/drivers/etc/hosts" }, assertions: [{ type: "error_expected" }] }
      ],
      description: "Load one artifact; for a lens, `depth` pulls in the context it always brings with it.",
      doc: "Load one artifact by vault-relative `path`, parse it, and return its serialized shape (frontmatter + sections + body + resolved links). For a lens, `depth` controls dredge: 1 (default) returns the lens alone; 2+ pulls its always-policy children that many levels deep, so the returned object carries the composed Know set. Non-lens types ignore `depth`. The path is PathGuard-jailed to the vault; an out-of-vault path returns a structured error. Use kcd_links instead when you only need the link graph, not the full body. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Vault-relative path to the artifact." },
          depth: { type: "integer", minimum: 1, maximum: 4, default: 1, description: "Lens dredge depth; 1 = artifact only." }
        },
        required: ["path"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_get", params: args });
          const vault = MCPUtils.vault;
          const filePath = String(args["path"] ?? "");
          const depth = typeof args["depth"] === "number" ? args["depth"] : void 0;
          const type = vault.classify(filePath);
          if (type === "lens") {
            const lens = vault.loadLens(filePath, { depth: depth ?? 1 });
            return MCPUtils.result(lens.serialize());
          }
          const artifact = import_kcd_sdk4.KCDPrimitive.fromHtml(vault.read(filePath), vault.toAbs(filePath));
          return MCPUtils.result(artifact.serialize());
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_links",
      annotations: { readOnlyHint: true },
      spec: [
        { label: "resolves links for a lens", input: { path: "lenses/parser/parser.html" }, assertions: [] }
      ],
      description: "See an artifact's outbound links, and everything pointing back at it.",
      doc: "Resolve the link graph around one artifact. Returns `{ outbound, inbound }`: outbound = the links the artifact itself declares (resolved to their targets); inbound = every other file in the vault whose links resolve TO this one (backlinks), found by scanning + resolving the whole vault. The graph primitive behind the editor's reference fan and the backlink panel. Cheaper than kcd_get when you only need edges, not the body. Read-only.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Vault-relative path to the artifact." } },
        required: ["path"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_links", params: args });
          const result = import_kcd_sdk4.VaultUtilities.links(MCPUtils.vault, String(args["path"] ?? ""));
          return MCPUtils.result(result);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_health",
      annotations: { readOnlyHint: true },
      spec: [
        { label: "validates the whole vault", input: {}, assertions: [] }
      ],
      description: "Validate one artifact, or the whole vault, for dangling links and broken refs.",
      doc: 'Validate artifacts on two axes. STRUCTURAL ( per file ): required frontmatter, sections, and type rules \u2014 a parse failure becomes an error issue rather than aborting the run. REFERENCE INTEGRITY ( cross-file, advisory warnings ): internal links whose target is missing on disk ( code-file links count; external URLs, #anchors, and {placeholder} hrefs are skipped ), and `base`/`lens` slugs that name no artifact ( the `cross` sentinel is skipped ). Pass `path` to check one file; omit it to sweep the whole vault. Returns `{ issues, summary }` \u2014 each issue carries its path, severity (error/warn), and message; the summary totals errors vs warnings. The pre-flight before a save or move sweep, and the observable form of the "always viable" invariant. Read-only.',
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Optional vault-relative path; omit to check the whole vault." } },
        required: []
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_health", params: args });
          const inputPath = typeof args["path"] === "string" ? args["path"] : "";
          const report = import_kcd_sdk4.VaultUtilities.health(MCPUtils.vault, inputPath || void 0);
          return MCPUtils.result(report);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_compile",
      annotations: { readOnlyHint: true },
      spec: [
        { label: "compiles a single lens", input: { lenses: ["lens_crafter"] }, assertions: [] }
      ],
      description: "Compile one or more lenses into one composed context string \u2014 first lens is primary.",
      doc: "The LENS compiler \u2014 Daedalus's basic context-compilation surface. Give it lens names ( a bare `parser` maps to `lenses/parser/parser.html`; a vault path is used as-is ) and it dredges each lens to its OWN authored depth, folds their context blocks together, resolves habit-class contention, and assembles one context string ( Care-first, manifest tables ). For a single lens the output equals that lens's own compiled context; multiple lenses compose into one, first = primary. Returns `{ lenses, text, tokens }`. This is lens composition only \u2014 the live runtime layers ( model root context, active MCP tool schemas, session memory ) are Starmind's job, not the vault's. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          lenses: {
            type: "array",
            items: { type: "string" },
            description: "Lens names or vault-relative paths to compile; the first is primary.",
            minItems: 1
          }
        },
        required: ["lenses"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_compile", params: args });
          const lenses = Array.isArray(args["lenses"]) ? args["lenses"].map(String) : [];
          const result = import_kcd_sdk4.VaultUtilities.compile(MCPUtils.vault, lenses);
          return MCPUtils.result(result);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_survey",
      annotations: { readOnlyHint: true },
      // Two cases because this tool has two RETURN SHAPES. The lean default is prose, so it can only be
      // smoke-tested (no assertion can read a key off text) — and it stays FIRST because the first spec's
      // input becomes the tool's `example` in tools/list, and the idiomatic call is the argument-less one.
      // The `full: true` case is where the real assertions live, since that shape is a SurveyReport object.
      spec: [
        { label: "surveys the configured project", input: {}, assertions: [] },
        {
          label: "full: true returns a structured report",
          input: { full: true },
          assertions: [
            { type: "has_key", key: "components" },
            { type: "type_is", key: "components", expected: "array" },
            { type: "has_key", key: "totals" }
          ]
        }
      ],
      description: "Reconnoitre the project beside the vault \u2014 a filename-level census of components, languages, and entry points.",
      doc: "Walk the configured project root and return a structured reconnaissance of it. This is a CENSUS: it reads filenames and small manifests only \u2014 no source is parsed and no model runs \u2014 so it produces a real answer on a Python, Go or C# project exactly as on TypeScript. The unit is the COMPONENT ( the root, plus every directory carrying its own package manifest ); each file is attributed to the deepest component containing it, so a monorepo reads as its real parts. By default returns the LEAN TEXT PROJECTION \u2014 the orientation read, geometry-free, the form a small model reasons over best. Pass `full: true` for the complete `SurveyReport` object ( components with languages, entryPoints, tests, contains, stats ). What a survey does NOT tell you: what the code does, which component matters, or that an absent thing is truly absent \u2014 treat it as orientation, not authority ( see the read-a-survey reference ). Read-only; surveys the project, writes nothing. The CLI `survey` command writes the same data as a JSON tree.",
      inputSchema: {
        type: "object",
        properties: {
          full: { type: "boolean", default: false, description: "Return the full structured SurveyReport instead of the lean text projection." }
        },
        required: []
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_survey", params: args });
          const { projectRoot } = Config.resolve();
          const report = import_kcd_sdk4.Survey.run(projectRoot);
          return args["full"] === true ? MCPUtils.result(report) : MCPUtils.text(import_kcd_sdk4.Survey.project(report));
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    }
  ];
}

// src/tools/write.ts
var import_kcd_sdk5 = __toESM(require_dist());
function writeTools(chain) {
  return [
    {
      name: "kcd_save",
      annotations: { destructiveHint: true },
      example: {
        path: "references/domain/my-note.html",
        artifact: {
          type: "reference",
          frontmatter: { name: "my-note", description: "A worked example.", type: "reference", status: "active" },
          body: "<h1>My Note</h1>\n<p>The body content.</p>"
        }
      },
      spec: [
        { label: "jails an out-of-vault path", input: { path: "C:/Windows/x.html", artifact: { type: "reference", frontmatter: {}, body: "" } }, assertions: [{ type: "error_expected" }] },
        { label: "refuses an artifact that fails validation", input: { path: "references/domain/x.html", artifact: { type: "reference", frontmatter: {}, body: "" } }, assertions: [{ type: "error_expected" }] }
      ],
      description: "Write an artifact, validated first \u2014 a malformed one is refused and nothing lands.",
      doc: "Persist one artifact by vault-relative `path` from its `artifact` ( a SerializedArtifact \u2014 the shape kcd_get returns ). Emits HTML with KcdEmit: frontmatter is rebuilt from `artifact.frontmatter`, the `body` passes through \u2014 an existing body has its frontmatter block replaced ( the edit path: kcd_get \u2192 mutate \u2192 kcd_save ), a body with none gets one prepended ( the create path ). The result is validated with KcdValidate BEFORE any write: a structural failure returns a structured error and writes NOTHING ( the write-time gate \u2014 can't save a malformed artifact ). On success it writes and returns `{ saved, warnings }`. PathGuard jails the path and checks the declared type matches the target directory. NOTE: agent-authored body HTML is not yet sanitized here ( the render layer sanitizes on display; a save-time sanitize pass is a named deferral ), and structured section/region/slot synthesis ( create a lens from fields alone ) is not built \u2014 supply body HTML.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Vault-relative destination path." },
          artifact: {
            type: "object",
            description: "The SerializedArtifact to write.",
            properties: {
              type: { type: "string", description: "Artifact type (lens, plan, habit, reference, \u2026) \u2014 must match the target directory." },
              frontmatter: { type: "object", additionalProperties: true, description: "Frontmatter fields (name, description, status, \u2026) \u2014 rebuilt into the HTML header block." },
              body: { type: "string", description: "Body HTML, no frontmatter block. Omit only when creating from fields alone (not yet supported \u2014 supply body HTML)." }
            },
            required: ["type", "frontmatter", "body"]
          }
        },
        required: ["path", "artifact"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_save", params: args });
          const filePath = String(args["path"] ?? "");
          const raw = args["artifact"] ?? {};
          const artifact = { ...raw, body: typeof raw["body"] === "string" ? raw["body"] : "" };
          const html = import_kcd_sdk5.KcdEmit.emit(artifact, filePath);
          const report = import_kcd_sdk5.KcdValidate.validate(html);
          if (!report.ok) {
            const detail = report.errors.map((e) => `${e.code} @ ${e.where}: ${e.msg}`).join("; ");
            return MCPUtils.error(`kcd_save refused "${filePath}": artifact failed validation \u2014 ${detail}`);
          }
          const saved = MCPUtils.vault.write(filePath, html);
          return MCPUtils.result({ saved, warnings: report.warnings });
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_move",
      annotations: { destructiveHint: true },
      example: { from: "references/domain/old-name.html", to: "references/domain/new-name.html" },
      spec: [
        { label: "jails an out-of-vault source", input: { from: "C:/Windows/System32/drivers/etc/hosts", to: "x.html" }, assertions: [{ type: "error_expected" }] },
        { label: "missing source \u2192 structured error", input: { from: "does-not-exist-xyz.html", to: "work/mcp/AI/nope.html" }, assertions: [{ type: "error_expected" }] }
      ],
      description: "Move or rename an artifact, healing every inbound link across the vault.",
      doc: "Rename or relocate one artifact by vault-relative `from` \u2192 `to`, then HEAL the graph: every other file whose links resolve to `from` has that href rewritten to the new location, so no backlink rots. Referrers are matched by RESOLVED identity ( not a text grep ), and the swap preserves their hand-authored formatting. Returns the HealPlan \u2014 `{ op, from, to, edits }`, where each edit is the referrer + old/new href. Refuses if `from` is missing or `to` already exists ( structured error ), and asserts afterward that no link still resolves to `from` \u2014 a residual fails loud rather than leaving the vault dangling. Both paths are PathGuard-jailed. Destructive: it writes referrers and renames the file.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Current vault-relative path." },
          to: { type: "string", description: "Destination vault-relative path." }
        },
        required: ["from", "to"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_move", params: args });
          const from = String(args["from"] ?? "");
          const to = String(args["to"] ?? "");
          const plan = MCPUtils.vault.move(from, to);
          return MCPUtils.result(plan);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    },
    {
      name: "kcd_delete",
      annotations: { destructiveHint: true },
      example: { path: "references/domain/obsolete-note.html" },
      spec: [
        { label: "jails an out-of-vault path", input: { path: "C:/Windows/System32/drivers/etc/hosts" }, assertions: [{ type: "error_expected" }] },
        { label: "missing target \u2192 structured error", input: { path: "does-not-exist-xyz.html" }, assertions: [{ type: "error_expected" }] }
      ],
      description: "Delete an artifact, cascading the removal through every referrer.",
      doc: 'Remove one artifact by vault-relative `path` and CASCADE the removal: every inbound reference is excised from its referrer so the graph stays viable \u2014 a slot-field link takes its whole record row, a bare prose <a> unwraps to its text, span-precise so surrounding formatting is untouched. BLOCKS ( structured error, nothing deleted ) if any artifact references the target by IDENTITY ( a base/lens slug naming it ) \u2014 those are not movable links and must be repointed or renamed first. Returns the HealPlan \u2014 `{ op:"delete", from, edits }`, each edit a referrer touched. Refuses a missing target, PathGuard-jails the path, and asserts afterward that no link still resolves to it ( a residual fails loud ). Destructive: it writes referrers and removes the file.',
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Vault-relative path to the artifact to delete." } },
        required: ["path"]
      },
      handler: async (args) => {
        try {
          chain.run({ tool: "kcd_delete", params: args });
          const filePath = String(args["path"] ?? "");
          const plan = MCPUtils.vault.delete(filePath);
          return MCPUtils.result(plan);
        } catch (e) {
          return MCPUtils.error(e instanceof Error ? e.message : String(e));
        }
      }
    }
  ];
}

// src/tools/batch.ts
function batchTools(invoke) {
  const textOf2 = (r) => r.content.map((c) => c.text).join("");
  return [
    {
      name: "kcd_batch",
      // No fixed destructiveHint would be honest either way — a batch of reads is harmless,
      // one that dispatches kcd_move/kcd_delete is not. Defensively true: a client that trusts
      // the hint should be warned, not surprised, and a false negative is the worse failure mode.
      annotations: { destructiveHint: true },
      example: {
        calls: [
          { tool: "kcd_query", args: { type: "lens" } },
          { tool: "kcd_get", args: { path: "lenses/mcp/mcp.html" } }
        ]
      },
      spec: [
        { label: "runs a read sequence", input: { calls: [{ tool: "kcd_query", args: { groupBy: "type" } }] }, assertions: [] },
        { label: "reports a bad call without throwing", input: { calls: [{ tool: "does-not-exist" }] }, assertions: [] }
      ],
      description: "Run an ordered sequence of tool calls, stopping at the first failure.",
      doc: "Execute `calls` \u2014 `[{ tool, args? }]` \u2014 IN ORDER through the server's internal dispatch, as a single tool call, so an agent that stacks a few operations gets one round-trip. Stops at the FIRST failure ( a step whose result is an error ). Returns `{ completed, failed, remaining }`: `completed` is `[{ tool, output }]` for every step that succeeded ( output is that tool's own result text ); `failed` is `{ index, tool, error }` or null; `remaining` is the tool names never reached. A nested `kcd_batch` is rejected. This tool is only as destructive as the tools it invokes \u2014 bundle heals ( move/delete ) and reads freely \u2014 but the sequence is NOT atomic: a mid-sequence failure leaves the earlier steps applied.",
      inputSchema: {
        type: "object",
        properties: {
          calls: {
            type: "array",
            description: "Ordered tool calls; the batch stops at the first that fails.",
            items: {
              type: "object",
              properties: {
                tool: { type: "string", description: "Registered tool name to invoke." },
                args: { type: "object", additionalProperties: true, description: "Arguments for that tool." }
              },
              required: ["tool"]
            }
          }
        },
        required: ["calls"]
      },
      handler: async (args) => {
        const calls = Array.isArray(args["calls"]) ? args["calls"] : [];
        const completed = [];
        for (let i = 0; i < calls.length; i++) {
          const call = calls[i] ?? {};
          const tool = typeof call["tool"] === "string" ? call["tool"] : "";
          const callArgs = call["args"] ?? {};
          const fail = (error) => MCPUtils.result({
            completed,
            failed: { index: i, tool, error },
            remaining: calls.slice(i + 1).map((c) => typeof c?.["tool"] === "string" ? c["tool"] : "?")
          });
          if (!tool) return fail('call is missing a "tool" name');
          if (tool === "kcd_batch") return fail("kcd_batch cannot be nested");
          const result = await invoke(tool, callArgs);
          if (result.isError) return fail(textOf2(result));
          completed.push({ tool, output: textOf2(result) });
        }
        return MCPUtils.result({ completed, failed: null, remaining: [] });
      }
    }
  ];
}

// src/server.ts
var DaedalusServer = class _DaedalusServer {
  /**
   * Declared statically so tooling can inventory the server without constructing one.
   * The lifecycle fields ( installed / exposed / entryPoint ) are Starmind interop and
   * are deliberately kept — see `./mcp/manifest.ts`'s header.
   *
   * The id was re-keyed `starmind_kcd` → `daedalus` on 2026-07-24 — the full cluster rename an
   * earlier note deferred to Phase 4. It was pulled forward and done in ONE pass across every
   * coupled site, because a half-migrated id is where this project keeps drawing blood. The id is
   * simultaneously the MCP server identity ( here + the plugin manifest ), a key in Starmind's
   * package registry ( `MasterRegistry.daedalus` ), the partition name of the on-disk config slice
   * ( `pkg.daedalus.json` — the old `pkg.starmind_kcd.json` is orphaned userData that simply
   * regenerates ), and the target of the tool-monitor widget and a subscription test. All moved
   * together; the coupling holds because nothing was left behind.
   */
  static manifest = {
    id: "daedalus",
    name: "Daedalus",
    version: "0.1.0",
    entryPoint: "dist/index.js",
    transport: "stdio",
    credentials: [],
    installed: false,
    exposed: false,
    doc: "The KCD library gate \u2014 read/write access to the artifact vault (lenses, plans, habits, contracts, references, generators, analyzers, utilities, templates). A thin I/O surface over kcd_sdk: one query (kcd_query), reads (get/links/health), writes (save/move/delete), and a batch (kcd_batch) that runs an ordered sequence of calls in one shot. Move and delete HEAL the link graph \u2014 a rename rewrites every inbound reference, a delete cascades through every referrer. Every path is jailed to the vault by the PathGuard before any disk touch; reads are free, writes carry a destructive hint. Judgment lives in the model above and kcd_sdk beneath \u2014 these tools only gate I/O."
  };
  server;
  registrations = [];
  built = false;
  chain = new GuardChain(new PathGuard());
  constructor() {
    const m = _DaedalusServer.manifest;
    this.server = new McpServer({ name: m.name, version: m.version });
  }
  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  /** Build the tool surface, then serve it on stdio until the client disconnects. */
  async run() {
    this.ensureBuilt();
    await this.server.connect();
  }
  /** Prove every tool against its TestSpecs, in-process. Reached by `scripts/verify.ts`. */
  async verify() {
    this.ensureBuilt();
    return runVerify(this.registrations, _DaedalusServer.manifest);
  }
  /**
   * The built wire tool surface — the exact `tools/list` array, without spawning the server.
   * Builds first ( idempotent ), then reads it off the underlying McpServer. This is what
   * regenerates the committed tool snapshot, and what a `mcp tools` command prints.
   */
  wireTools() {
    this.ensureBuilt();
    return this.server.listTools();
  }
  /**
   * Run a registered tool in-process by name — the seam a COMPOSING tool ( the batch ) dispatches
   * through to run other tools in sequence. Builds first ( idempotent ), then delegates to the
   * McpServer's own dispatch, so an internal call obeys the exact same contract as a wire call.
   */
  invoke(name, args) {
    this.ensureBuilt();
    return this.server.invoke(name, args);
  }
  // ── Tool surface ──────────────────────────────────────────────────────────────
  /** Register every tool through one shared guard chain. Runs once, via ensureBuilt(). */
  build() {
    const tools = [
      ...discoveryTools(this.chain),
      ...readTools(this.chain),
      ...writeTools(this.chain),
      // batch dispatches the others through the in-process invoke seam ( no guard chain of
      // its own — each dispatched call runs its own handler + PathGuard ).
      ...batchTools((name, args) => this.invoke(name, args))
    ];
    for (const tool of tools) this.registerTool(tool);
  }
  /**
   * Register a tool and ( optionally ) the TestSpecs that verify it, in one call. The wire fields
   * pass through to the McpServer; the spec is stashed for verify().
   *
   * House convention: the first verify input doubles as the tool's inspector sample — the example
   * you prove a tool with is the example a user sees prepopulated. An explicit `example` on the def
   * wins; otherwise borrow the first spec's input.
   */
  registerTool(def) {
    const { spec, ...tool } = def;
    const example = tool.example ?? spec?.[0]?.input;
    this.server.registerTool(example ? { ...tool, example } : tool);
    this.registrations.push({ def: tool, spec: spec ?? [] });
  }
  ensureBuilt() {
    if (this.built) return;
    this.build();
    this.built = true;
  }
  // ── Live doc ──────────────────────────────────────────────────────────────────
  /**
   * The server's doc-block as served right now — generated fresh rather than frozen at
   * author-time. Folds the live vault root and a fresh type census into the manifest's authored
   * doc, so an agent that gets this server's doc already knows where the vault lives and roughly
   * what is in it — a cheaper orientation than a kcd_query({ groupBy: 'type' }) round-trip. Read
   * fresh each time ( MCPUtils.vault re-resolves config on access ), the same freshness contract
   * every tool here uses.
   */
  liveDoc() {
    const base = _DaedalusServer.manifest.doc ?? "";
    const vault = MCPUtils.vault;
    const counts = {};
    for (const f of vault.scan()) {
      const t = vault.classify(f.path);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    const census = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${type}: ${count}`).join(", ");
    return `${base}

Vault root (live): ${vault.root}
Census (live): ${census || "empty"}`;
  }
};

// src/cli/Cli.ts
var ROOT_CONTEXT = "root-context.html";
var Cli = class {
  static async run(argv) {
    const args = this.parse(argv);
    Config.override({ projectRoot: args.root, docRoot: args.docRoot });
    if (args.help || !args.command) {
      this.printHelp();
      process.exit(args.help ? 0 : 2);
    }
    switch (args.command) {
      case "validate":
        return this.validate(args);
      case "compile":
        return this.compile(args);
      case "show":
        return this.show(args);
      case "survey":
        return this.survey(args);
      case "mcp":
        return this.mcp(args);
      case "doctor":
        return this.doctor(args);
      case "maintain":
        return this.maintain(args);
      case "reset":
        return this.reset(args);
      case "fix-css":
        return this.fixCss(args);
      case "query":
        return this.query(args);
      case "links":
        return this.links(args);
      case "seed":
        return this.seed(args);
      case "lens-index":
        return this.lensIndex(args);
      case "init":
        return this.init(args);
      case "clear":
        return this.clear(args);
      case "get-started":
        return this.getStarted(args);
      default:
        process.stderr.write(`daedalus: unknown command "${args.command}"

`);
        this.printHelp();
        process.exit(2);
    }
  }
  // ── Commands ──────────────────────────────────────────────────────────────
  /**
   * `daedalus validate [path]` — validate one artifact ( path given ) or the whole vault.
   * The proving command: it exercises config resolution, the shared engine, both output modes,
   * and the error/clean exit split in one path.
   */
  static validate(args) {
    const target = args.positionals[0];
    const vault = this.vault();
    const report = import_kcd_sdk6.VaultUtilities.health(vault, target || void 0);
    if (args.json) {
      this.emit(report);
    } else {
      this.renderHealth(report, target);
    }
    process.exit(report.summary.errors > 0 ? 1 : 0);
  }
  /**
   * `daedalus compile <lens...>` — compile one or more lenses to a single context string ( the
   * lens-scoped compiler; see VaultUtilities.compile ). Default output is the raw compiled text on
   * stdout — pure payload, ready to pipe or paste before a prompt — with a one-line summary on
   * stderr; `--json` emits `{ lenses, text, tokens }` instead.
   */
  static compile(args) {
    try {
      const result = import_kcd_sdk6.VaultUtilities.compile(this.vault(), args.positionals);
      if (args.json) {
        this.emit(result);
      } else {
        process.stderr.write(`compiled ${result.lenses.join(", ")} \u2014 ~${result.tokens} tokens
`);
        process.stdout.write(result.text + "\n");
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus show <lens>` — the compiled-context chart for one lens: its identity plus every dredge
   * slot, colour-coded by state ( grey off / blue on / green suggested, dim empty ), with per-component
   * and total token counts. `--json` emits the `LensView` object.
   */
  static show(args) {
    const name = args.positionals[0];
    if (!name) {
      process.stderr.write("daedalus: show requires a lens name\n");
      process.exit(2);
    }
    try {
      const view = import_kcd_sdk6.VaultUtilities.lensView(this.vault(), name);
      if (args.json) this.emit(view);
      else this.renderLensView(view);
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus survey` — reconnoitre the PROJECT the vault sits beside and write it as a JSON tree.
   *
   * The odd one out: every other command reads the vault ( the artifact store ), but a survey walks
   * the PROJECT ROOT ( the code ). It flushes and refills <vault>/audits/survey/ — a roster plus one
   * file per component — then prints the lean projection so a run both persists the artifact AND
   * shows what it found. `--json` emits the full report to stdout instead of the projection ( survey
   * is the one command whose primary payload is the structured object, not the human view ).
   */
  static survey(args) {
    try {
      const { projectRoot } = Config.resolve();
      const report = import_kcd_sdk6.Survey.run(projectRoot);
      const outAbs = this.vault().toAbs("audits/survey");
      const written = import_kcd_sdk6.Survey.write(report, outAbs);
      if (args.json) {
        this.emit(report);
      } else {
        process.stderr.write(`surveyed ${projectRoot} \u2014 ${report.totals.components} components, ${report.totals.files} files \u2192 ${written.length} files in audits/survey/
`);
        process.stdout.write(import_kcd_sdk6.Survey.project(report) + "\n");
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus init [confirm]` — the whole onboarding flow, one command: detect the shape, deploy
   * the vault in place, extract every host seed found, register the MCP for Claude Code, and run
   * the survey. No `confirm` previews every step and writes nothing, same convention as
   * `maintain`/`reset`/`seed`.
   *
   * NO ROLLBACK ( Bryan, 2026-07-25 ): every step below is independently idempotent — re-running
   * `init` on a partially-completed install fills only what is still missing, exactly like
   * `VaultDeploy` already does. A failed or interrupted run is repaired by running it again, never
   * by unwinding it.
   *
   * PREFLIGHT: an INFERRED root above the working directory means an ancestor already has a vault
   * — almost certainly not what running `init` from a subfolder meant. Refuses rather than quietly
   * repairing the wrong project; `--root .` forces a new vault at the actual working directory.
   */
  /**
   * `daedalus clear [all] [confirm]` — take the install back out.
   *
   * A COURTESY, and a trust argument. An installer that cannot uninstall asks a stranger to make an
   * irreversible change to their repository on first acquaintance; being able to point at this
   * command is most of why `init` is an easy yes.
   *
   * It removes WHAT THE INSTALL ADDED AND NOTHING ELSE — this is subtraction, never `rm -rf`:
   *
   *   • host entry files  the managed block only; the project's own instructions stay, and the file
   *                       is deleted only when our block was its entire content
   *   • .mcp.json         our `daedalus` entry only; other registered servers are untouched, and the
   *                       file survives unless it is left holding nothing
   *   • .claude/skills/   only bundled skills that are still byte-identical to what we shipped. A
   *                       skill you edited is YOURS and is kept, with a line saying so
   *   • .gitignore        our managed block only
   *
   * THE VAULT IS NOT TOUCHED without `all`. By the time anyone runs this, `_Claude/` holds lenses
   * and references somebody wrote — deleting a knowledge store as the default reading of "clear"
   * would be indefensible. `all` adds it, and says how many artifacts are at stake first.
   */
  static async clear(args) {
    const withVault = args.positionals.includes("all");
    let confirm = args.positionals.includes("confirm");
    const { projectRoot, docRoot } = Config.resolve();
    const vault = new import_kcd_sdk6.Vault(projectRoot, docRoot);
    process.stdout.write(
      `
${this.tint(this.C.bold, "daedalus clear")} \u2014 ${confirm ? "removing" : "PREVIEW ( nothing will be removed )"}
project: ${projectRoot}

Removes what the install added, and nothing else. Anything you wrote or edited stays.
`
    );
    const removals = [];
    const kept = [];
    if ((0, import_fs2.existsSync)(vault.toAbs(ROOT_CONTEXT))) {
      for (const seed of import_kcd_sdk6.VaultUtilities.parseSeeds(vault)) {
        const r = import_kcd_sdk6.VaultUtilities.removeSeed(projectRoot, seed, { confirm });
        if (r.changed) removals.push({ label: r.target, detail: r.fileRemoved ? "file removed ( it held only our block )" : "managed block removed, your content kept" });
      }
    }
    const mcpPath = path2.join(projectRoot, ".mcp.json");
    if ((0, import_fs2.existsSync)(mcpPath)) {
      try {
        const doc = JSON.parse((0, import_fs2.readFileSync)(mcpPath, "utf-8"));
        if (doc.mcpServers?.["daedalus"]) {
          delete doc.mcpServers["daedalus"];
          const empty = Object.keys(doc.mcpServers).length === 0 && Object.keys(doc).length === 1;
          removals.push({ label: ".mcp.json", detail: empty ? "file removed ( no other servers registered )" : `daedalus entry removed, ${Object.keys(doc.mcpServers).length} other server(s) kept` });
          if (confirm) {
            if (empty) (0, import_fs2.rmSync)(mcpPath);
            else (0, import_fs2.writeFileSync)(mcpPath, JSON.stringify(doc, null, 2) + "\n", "utf-8");
          }
        }
      } catch {
        kept.push(".mcp.json \u2014 not valid JSON, left alone rather than guessed at");
      }
    }
    const skillsSrc = this.skillsRoot();
    if ((0, import_fs2.existsSync)(skillsSrc)) {
      for (const name of (0, import_fs2.readdirSync)(skillsSrc)) {
        if (!(0, import_fs2.statSync)(path2.join(skillsSrc, name)).isDirectory()) continue;
        const dest = path2.join(projectRoot, ".claude", "skills", name);
        if (!(0, import_fs2.existsSync)(dest)) continue;
        if (this.dirsMatch(path2.join(skillsSrc, name), dest)) {
          removals.push({ label: `.claude/skills/${name}`, detail: "unchanged since install" });
          if (confirm) (0, import_fs2.rmSync)(dest, { recursive: true });
        } else {
          kept.push(`.claude/skills/${name} \u2014 you edited it, so it stays`);
        }
      }
    }
    const ig = import_kcd_sdk6.VaultUtilities.gitignore(projectRoot, docRoot, "none", { confirm });
    if (ig.changed) removals.push({ label: ".gitignore", detail: "managed block removed" });
    const vaultAbs = path2.join(projectRoot, docRoot);
    if ((0, import_fs2.existsSync)(vaultAbs)) {
      let count = 0;
      try {
        count = vault.scan().length;
      } catch {
        count = 0;
      }
      if (withVault) {
        removals.push({ label: `${docRoot}/`, detail: `the whole vault \u2014 ${count} artifact(s), including anything you authored` });
        if (confirm) (0, import_fs2.rmSync)(vaultAbs, { recursive: true });
      } else {
        kept.push(`${docRoot}/ \u2014 ${count} artifact(s) kept. Re-run as "daedalus clear all" to remove the vault too`);
      }
    }
    if (removals.length === 0 && kept.length === 0) {
      process.stdout.write("\nNothing to remove \u2014 this project has no daedalus install.\n\n");
      process.exit(0);
    }
    if (removals.length) {
      process.stdout.write(`
${this.tint(this.C.bold, confirm ? "Removed" : "Would remove")}
`);
      for (const r of removals) process.stdout.write(`  ${confirm ? "\u2713" : "\xB7"} ${r.label.padEnd(26)} ${this.tint(this.C.dim, r.detail)}
`);
    }
    if (kept.length) {
      process.stdout.write(`
${this.tint(this.C.bold, "Kept")}
`);
      for (const k of kept) process.stdout.write(`  \xB7 ${k}
`);
    }
    if (!confirm && removals.length) {
      confirm = await Prompt.confirm("Remove these now?", false, "Nothing has been removed yet.");
      Prompt.close();
      if (confirm) return this.clear({ ...args, positionals: [...args.positionals, "confirm"] });
      process.stdout.write(`
${this.tint(this.C.bold, "Nothing was removed.")} To go ahead:

    daedalus clear${withVault ? " all" : ""} confirm

`);
    } else {
      process.stdout.write("\n");
    }
    process.exit(0);
  }
  /** Byte-for-byte directory comparison — the "is this still exactly what we shipped?" test that
   *  lets `clear` delete a bundled skill without ever deleting an edited one. */
  static dirsMatch(a, b) {
    const listing = (dir) => (0, import_fs2.readdirSync)(dir).sort();
    const an = listing(a);
    const bn = listing(b);
    if (an.length !== bn.length || an.some((n, i) => n !== bn[i])) return false;
    for (const name of an) {
      const ap = path2.join(a, name);
      const bp = path2.join(b, name);
      const ad = (0, import_fs2.statSync)(ap).isDirectory();
      if (ad !== (0, import_fs2.statSync)(bp).isDirectory()) return false;
      if (ad) {
        if (!this.dirsMatch(ap, bp)) return false;
      } else if ((0, import_fs2.readFileSync)(ap, "utf-8") !== (0, import_fs2.readFileSync)(bp, "utf-8")) {
        return false;
      }
    }
    return true;
  }
  static async init(args) {
    let confirm = args.positionals.includes("confirm");
    const cwd = path2.resolve(process.cwd());
    let before = Config.resolve();
    if (!this.nodeOk()) {
      process.stderr.write(
        `daedalus: Node ${this.NODE_MIN} or newer is required \u2014 this is v${process.versions.node}.
the bundled server uses syntax older runtimes cannot parse; upgrade Node, then re-run init.
`
      );
      process.exit(2);
    }
    if (before.source.projectRoot === "inferred" && path2.resolve(before.projectRoot) !== cwd) {
      process.stderr.write(
        `daedalus: found an existing vault at "${before.projectRoot}", above this directory.
if you meant to create a new one HERE, re-run with --root .
`
      );
      process.exit(2);
    }
    let adoptedFrom = null;
    if (!args.root) {
      const marker = this.markerRoot(cwd);
      if (marker && marker !== path2.resolve(before.projectRoot)) {
        adoptedFrom = marker;
        Config.override({ projectRoot: marker, docRoot: args.docRoot });
        before = Config.resolve();
      }
    }
    const { projectRoot, docRoot } = before;
    const substrateSource = this.substrateRoot();
    const vault = new import_kcd_sdk6.Vault(projectRoot, docRoot);
    process.stdout.write(
      `
${this.tint(this.C.bold, "daedalus init")} \u2014 ${confirm ? "installing" : "PREVIEW ( nothing will be written )"}
project: ${projectRoot}

This installs a KCD vault beside your code. It moves none of your files and
overwrites nothing you have edited \u2014 every step below fills only what is missing,
so running it twice repairs rather than duplicates.

`
    );
    if (adoptedFrom) {
      process.stdout.write(
        `${this.tint(this.C.bold, "Installing one level up, not here.")}
   ${adoptedFrom} already has an agent entry point ( ${this.hostMarkers().join(", ")} ),
   so that is where this repository configures agents, and the vault belongs beside it.
   One vault per repository is the rule \u2014 the LENS is the per-component unit, not the vault.
   To install in ${cwd} instead, re-run with ${this.tint(this.C.bold, "--root .")}

`
      );
    }
    const hosts = this.hostMarkers();
    const choices = {
      hosts,
      mcp: true,
      skills: true,
      ignore: "none"
    };
    const gitRoot = this.gitRoot(projectRoot);
    const stepping = Prompt.interactive && !confirm;
    if (!stepping && !confirm) {
      process.stdout.write(
        `${this.tint(this.C.dim, "non-interactive ( no terminal attached ) \u2014 using defaults for every choice.")}
${this.tint(this.C.dim, "Run `daedalus init` yourself in a terminal to be asked instead.")}

`
      );
    }
    if (stepping) {
      const total = gitRoot ? 6 : 5;
      let count = 0;
      const step = (title) => Prompt.step(++count, total, title);
      step("What gets created");
      process.stdout.write(
        "\n  Everything KCD governs lives in ONE folder beside your code. Alongside it go two\n  or three small files at your project root that point your agent at that folder.\n  Nothing of yours is moved, renamed, or overwritten.\n\n"
      );
      process.stdout.write(this.installTree(projectRoot, docRoot, choices, true));
      if (!await Prompt.confirm(
        `Create this in ${projectRoot}?`,
        true,
        "The steps after this one trim the root files. Nothing has been written yet."
      )) {
        Prompt.close();
        process.stdout.write(
          `
${this.tint(this.C.bold, "Nothing was written.")} Run ${this.tint(this.C.bold, "daedalus init")} again whenever you like.

`
        );
        process.exit(0);
      }
      step("Agent entry points");
      choices.hosts = await Prompt.multiselect(
        "Which agents should be pointed at this vault?",
        hosts.map((h) => ({
          label: h,
          note: h.startsWith("CLAUDE") ? "Claude Code" : h.startsWith("AGENTS") ? "Codex and others" : h.startsWith("GEMINI") ? "Gemini" : "",
          value: h
        })),
        hosts.map((_h, i) => i),
        "A small managed block is added at the top of each. Your own content is kept below it."
      );
      step("What goes in your entry files");
      const seeds = this.hostSeeds().filter((s) => choices.hosts.includes(s.target));
      for (const s of seeds) {
        const abs = path2.join(projectRoot, s.target);
        const present = (0, import_fs2.existsSync)(abs);
        const ownsText = present && this.hasOwnContent(abs);
        process.stdout.write(
          `
  ${this.tint(this.C.bold, s.target)} \u2014 ` + (!present ? "does not exist yet, will be created" : ownsText ? this.tint(this.C.blue, "already exists and has your own content \u2014 it is kept, in full, below our block") : "already exists") + "\n"
        );
      }
      if (seeds.length) {
        const sample = seeds[0].payload.split("\n").slice(0, 5);
        process.stdout.write(
          `
  ${this.tint(this.C.dim, "The block added at the top, between markers we own and only ever rewrite between:")}
  ${this.tint(this.C.dim, "<!-- kcd:begin -->")}
` + sample.map((l) => `  ${this.tint(this.C.dim, l.length > 74 ? l.slice(0, 73) + "\u2026" : l)}`).join("\n") + `
  ${this.tint(this.C.dim, `\u2026 ${Math.max(0, seeds[0].payload.split("\n").length - 5)} more lines`)}
  ${this.tint(this.C.dim, "<!-- kcd:end -->")}
`
        );
      }
      if (!await Prompt.confirm("Happy with that?", true, "Answer no to stop; nothing has been written.")) {
        Prompt.close();
        process.stdout.write(`
${this.tint(this.C.bold, "Nothing was written.")}

`);
        process.exit(0);
      }
      step("The MCP server");
      choices.mcp = await Prompt.confirm(
        "Register the daedalus MCP server in .mcp.json?",
        true,
        "This is what gives your agent the kcd_* tools. Without it the vault is just files."
      );
      step("Bundled skills");
      choices.skills = await Prompt.confirm(
        "Install the bundled skills into .claude/skills/?",
        true,
        "kcd-onboard walks you through turning a fresh vault into one about YOUR project."
      );
      if (gitRoot) {
        step("Git");
        process.stdout.write(
          `
  ${this.tint(this.C.dim, `This is a git repository ( ${gitRoot} ).`)}
`
        );
        choices.ignore = await Prompt.select(
          "Should this go into your repository, or be ignored?",
          [
            { label: "Commit the vault, ignore its scratch dirs", note: "recommended", value: "scratch" },
            { label: "Commit everything", note: "nothing added to .gitignore", value: "none" },
            { label: "Ignore the whole vault", note: "try it without touching your repo", value: "vault" }
          ],
          0,
          "The vault is project knowledge and is usually worth committing \u2014 it is how a team shares\n  the context. audits/ and work/ are regenerable churn and rarely are."
        );
      }
      const summary = `
${this.tint(this.C.bold, "Ready to install")}
  project        ${before.projectRoot}
  vault          ${before.docRoot}/
  entry points   ${choices.hosts.length ? choices.hosts.join(", ") : "none"}
  MCP server     ${choices.mcp ? "registered in .mcp.json" : "skipped"}
  skills         ${choices.skills ? "installed" : "skipped"}
` + (gitRoot ? `  .gitignore     ${choices.ignore === "none" ? "untouched" : choices.ignore === "vault" ? "whole vault ignored" : "scratch dirs ignored"}
` : "");
      process.stdout.write(summary);
      confirm = await Prompt.confirm("Install now?", true, "Nothing has been written yet.");
      Prompt.close();
      if (!confirm) {
        process.stdout.write(`
${this.tint(this.C.bold, "Nothing was written.")} Run ${this.tint(this.C.bold, "daedalus init")} again whenever you like.

`);
        process.exit(0);
      }
    }
    const deployBefore = import_kcd_sdk6.VaultDeploy.inspect(projectRoot, { docRoot, substrateSource });
    const shape = deployBefore.items.some((i) => i.present) ? "repairing" : "creating";
    process.stdout.write(
      // No number. The stepper above owns the numbering ( "step 3/5" ); a second 1..4 sequence
      // running underneath it reads as two competing progress bars.
      `${this.tint(this.C.bold, "The vault")} \u2014 ${shape}, ${deployBefore.missing} item(s) to fill

`
    );
    if (!stepping) process.stdout.write(this.installTree(projectRoot, docRoot, choices));
    const deployed = confirm ? import_kcd_sdk6.VaultDeploy.apply(projectRoot, { docRoot, substrateSource }) : deployBefore;
    const filled = deployed.items.filter((i) => !i.present).length;
    process.stdout.write(`
  ${confirm ? "\u2713" : "\xB7"} ${confirm ? "filled" : "would fill"} ${filled} item(s) from the bundled floor. The rest is yours to grow.
`);
    process.stdout.write(
      `
${this.tint(this.C.bold, "Agent entry points")}
   Anything already in those files is kept \u2014 the block goes above it, between markers,
   and only what is between them is ever rewritten.
`
    );
    if ((0, import_fs2.existsSync)(vault.toAbs(ROOT_CONTEXT))) {
      const seeds = import_kcd_sdk6.VaultUtilities.parseSeeds(vault).filter((s) => choices.hosts.includes(s.target));
      const reports = seeds.map((s) => import_kcd_sdk6.VaultUtilities.applySeed(projectRoot, s, { confirm }));
      if (seeds.length === 0) process.stdout.write("  seed     \u2014 none selected\n");
      for (const r of reports) {
        const state = !r.targetExisted ? "creates" : !r.changed ? "current" : r.applied ? "updated" : "pending";
        process.stdout.write(`  seed     ${r.target.padEnd(12)} ( ${r.host} ) \u2014 ${state}
`);
      }
      const conflicts = reports.filter((r) => r.mode === "prepend" && r.targetExisted).filter((r) => this.hasOwnContent(path2.join(projectRoot, r.target))).map((r) => r.target);
      if (conflicts.length) {
        process.stdout.write(
          `
  ${this.tint(this.C.bold, "Worth reading before you trust it:")} ${conflicts.join(", ")} already instructed your agent.
  Nothing of yours was touched \u2014 the KCD block sits above what was already there. But
  both halves are live now, and if they disagree the agent has no way to know which
  wins. Read the merged file once and delete whichever half is stale.
`
        );
      }
    } else {
      process.stdout.write(`  ${this.tint(this.C.dim, 'written once the vault above exists \u2014 re-run with "confirm" and they land together')}
`);
    }
    const mcpPath = path2.join(projectRoot, ".mcp.json");
    let mcpDoc = {};
    if ((0, import_fs2.existsSync)(mcpPath)) {
      try {
        mcpDoc = JSON.parse((0, import_fs2.readFileSync)(mcpPath, "utf-8"));
      } catch {
        process.stderr.write(`daedalus: "${mcpPath}" is not valid JSON \u2014 fix or remove it, then re-run init
`);
        process.exit(2);
      }
    }
    const entry = { command: "node", args: [path2.join(this.packageRoot(), "dist", "index.js")] };
    const already = mcpDoc.mcpServers?.["daedalus"];
    const mcpChanged = choices.mcp && JSON.stringify(already) !== JSON.stringify(entry);
    process.stdout.write(
      `
${this.tint(this.C.bold, "The MCP server")} \u2014 .mcp.json: ${!choices.mcp ? "skipped" : !already ? "registers" : mcpChanged ? "updates" : "already current"}
   Gives your agent the kcd_* tools. Any other server you have registered is left alone.
`
    );
    if (confirm && mcpChanged) {
      mcpDoc.mcpServers = { ...mcpDoc.mcpServers, daedalus: entry };
      (0, import_fs2.writeFileSync)(mcpPath, JSON.stringify(mcpDoc, null, 2) + "\n", "utf-8");
    }
    process.stdout.write(
      `
${this.tint(this.C.bold, "Skills")}
   A skill already there is never overwritten \u2014 once it exists it is yours to edit.
`
    );
    const skillsSrc = this.skillsRoot();
    if (!choices.skills) {
      process.stdout.write("  skill    \u2014 skipped\n");
    } else if ((0, import_fs2.existsSync)(skillsSrc)) {
      for (const name of (0, import_fs2.readdirSync)(skillsSrc)) {
        const src = path2.join(skillsSrc, name);
        if (!(0, import_fs2.statSync)(src).isDirectory()) continue;
        const dest = path2.join(projectRoot, ".claude", "skills", name);
        const present = (0, import_fs2.existsSync)(dest);
        process.stdout.write(`  skill    ${name.padEnd(12)} \u2014 ${present ? "already present" : confirm ? "installs" : "would install"}
`);
        if (!present && confirm) {
          (0, import_fs2.mkdirSync)(path2.dirname(dest), { recursive: true });
          (0, import_fs2.cpSync)(src, dest, { recursive: true });
        }
      }
    }
    process.stdout.write(
      `
${this.tint(this.C.bold, "In your repository")}
   None of the above is generated noise, so the usual answer is "commit it" \u2014 the vault is
   project knowledge and committing it is how a team shares the context. Only ${docRoot}/audits
   and ${docRoot}/work are regenerable churn.
`
    );
    if (!gitRoot) {
    } else if (stepping && choices.ignore !== "none") {
      const ig = import_kcd_sdk6.VaultUtilities.gitignore(projectRoot, docRoot, choices.ignore, { confirm });
      process.stdout.write(
        `
${this.tint(this.C.bold, "Git")} \u2014 .gitignore: ${ig.changed ? ig.applied ? "updated" : "would change" : "already current"}
`
      );
      for (const e of ig.entries) process.stdout.write(`  ${ig.applied ? "\u2713" : "\xB7"} ${e}
`);
    } else if (!stepping) {
      const scratch = import_kcd_sdk6.VaultUtilities.gitignore(projectRoot, docRoot, "scratch");
      process.stdout.write(
        `
${this.tint(this.C.bold, "Git")} \u2014 .gitignore: ${scratch.hadManagedBlock ? "already carries a kcd block" : "untouched"}
   Nothing is written there unless you ask for it. If you want the regenerable churn
   kept out of history, these are the lines \u2014 yours to add, move, or ignore:

` + scratch.entries.map((e) => `       ${e}
`).join("") + `
   Or ignore ${docRoot}/ outright to try this without touching your repository at all.
`
      );
    }
    if (!confirm) {
      process.stdout.write(`
${this.tint(this.C.bold, "Nothing was written.")} Re-run to install:

    daedalus init confirm

`);
      process.exit(0);
    }
    process.stdout.write(
      `
${this.tint(this.C.green, "\u2713 Installed.")} ${this.tint(this.C.bold, "One more step \u2014 this one matters:")}

   Your agent reads .mcp.json and .claude/skills/ only when a session STARTS.
   The tools just registered do not exist in your current session. Restart it \u2014
   exit your agent and open it again in this directory \u2014 then run:

       ${this.tint(this.C.bold, "daedalus get-started")}

   That surveys your project and hands you a prompt to paste in, so you can watch the
   tools work against your own code before trusting them with anything.

   ${this.tint(this.C.dim, "Changed your mind? `daedalus clear` removes everything this added and nothing else.")}

`
    );
    process.exit(0);
  }
  /**
   * `daedalus get-started` — everything that only makes sense AFTER the agent session has restarted,
   * split out of `init` for exactly that reason ( Bryan, 2026-07-25 ): a physical install and the
   * things that depend on a live MCP connection are two different moments, and pretending they are
   * one is what made the restart step invisible.
   *
   * Runs the survey — deliberately HERE rather than in `init`, because its real consumer is the
   * agent that is only now able to read it — then prints a verification prompt built from what the
   * survey actually found. A live test the user can watch, not an assurance they have to take.
   */
  static getStarted(args) {
    const { projectRoot, docRoot } = Config.resolve();
    const vault = new import_kcd_sdk6.Vault(projectRoot, docRoot);
    if (!(0, import_fs2.existsSync)(vault.toAbs(ROOT_CONTEXT))) {
      process.stderr.write(
        `daedalus: no vault found at ${path2.join(projectRoot, docRoot)}.
run "daedalus init confirm" first.
`
      );
      process.exit(2);
    }
    const report = import_kcd_sdk6.Survey.run(projectRoot);
    const written = import_kcd_sdk6.Survey.write(report, vault.toAbs("audits/survey"));
    if (args.json) {
      this.emit(report);
      process.exit(0);
    }
    process.stdout.write(
      `
${this.tint(this.C.bold, "daedalus get-started")}
project: ${projectRoot}

${this.tint(this.C.bold, "Surveyed your project")} \u2014 ${report.totals.components} component(s), ${report.totals.files} file(s) \u2192 ${written.length} file(s) in ${docRoot}/audits/survey/
   A factual census of your code: components, languages, entry points. Everything an
   agent authors from here is anchored to this file rather than to guesswork.
`
    );
    const named = report.components.slice(0, 4).map((c) => c.name).filter(Boolean);
    if (named.length) process.stdout.write(`   Found: ${named.join(", ")}${report.totals.components > named.length ? ", \u2026" : ""}
`);
    process.stdout.write(
      `
${this.tint(this.C.bold, "Now check it works.")} Paste this to your agent:

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Use the kcd_health tool to check this project's vault, and kcd_query to
list what artifact types it holds. Then read the survey roster at
${docRoot}/audits/survey/index.json and tell me, in a few lines, what
this project is made of. If you do not have tools whose names start with
kcd_, say so plainly instead of guessing \u2014 it means the session needs a
restart to pick them up.
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

   A healthy answer names your real components and reports 0 errors. If the agent says
   it has no kcd_ tools, the session has not restarted yet \u2014 restart and paste it again.

${this.tint(this.C.bold, "Then build your vault:")} ask your agent to use the ${this.tint(this.C.bold, "kcd-onboard")} skill.
   It reads the survey and walks you through authoring lenses for this project.

`
    );
    process.exit(0);
  }
  /**
   * `daedalus query [json-filter]` — the CLI face of `kcd_query`, closing the gap 1.i flagged
   * ( it was the one tool with no CLI counterpart ). The filter set ( glob/type/text/groupBy )
   * is a small JSON object, matching `mcp call`'s own json-args idiom — one option among several
   * and rarely all set at once is the honest shape, not worth growing the shared flag parser for.
   */
  static query(args) {
    let opts = {};
    const raw = args.positionals[0];
    if (raw) {
      try {
        opts = JSON.parse(raw);
      } catch {
        process.stderr.write("daedalus: query filter must be valid JSON\n");
        process.exit(2);
      }
    }
    try {
      const result = import_kcd_sdk6.VaultUtilities.query(this.vault(), opts);
      if (args.json) {
        this.emit(result);
        process.exit(0);
      }
      if (opts.groupBy === "type") {
        for (const row of result)
          process.stdout.write(`${String(row.count).padStart(4)}  ${row.type}
`);
      } else {
        for (const ref of result)
          process.stdout.write(`${ref.type.padEnd(10)} ${ref.path}
`);
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /** `daedalus links <path>` — the CLI face of `kcd_links`, same gap, same fix. */
  static links(args) {
    const target = args.positionals[0];
    if (!target) {
      process.stderr.write("daedalus: links requires a vault-relative path\n");
      process.exit(2);
    }
    try {
      const result = import_kcd_sdk6.VaultUtilities.links(this.vault(), target);
      if (args.json) {
        this.emit(result);
        process.exit(0);
      }
      process.stdout.write(`outbound ( ${result.outbound.length} )
`);
      for (const l of result.outbound) process.stdout.write(`  ${l.type.padEnd(8)} ${l.href}
`);
      if (result.addresses.length > 0) {
        process.stdout.write(`
addresses ( ${result.addresses.length} )
`);
        for (const a of result.addresses) process.stdout.write(`  ${a.occupied ? "occupied" : "vacant  "} ${a.value}
`);
      }
      process.stdout.write(`
inbound ( ${result.inbound.length} )
`);
      for (const i of result.inbound) process.stdout.write(`  ${i.path}
`);
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus seed [host] [confirm]` — extract §10 seed payloads from `root-context.html` into
   * their targets ( `CLAUDE.md` and siblings ). No host = every seed found; a host name filters to
   * one. No `confirm` only reports what would change — same preview-then-confirm shape as
   * `maintain`/`reset`, and for the same reason: these are project-root files outside the vault,
   * two of which ( `CLAUDE.md`, and the entry document `lens-index` writes to ) are hard-rule
   * protected.
   */
  static seed(args) {
    const confirm = args.positionals.includes("confirm");
    const hostFilter = args.positionals.find((p) => p !== "confirm");
    try {
      const { projectRoot } = Config.resolve();
      const seeds = import_kcd_sdk6.VaultUtilities.parseSeeds(this.vault()).filter((s) => !hostFilter || s.host === hostFilter);
      if (seeds.length === 0) {
        process.stderr.write("daedalus: no seed blocks found ( or none match that host )\n");
        process.exit(1);
      }
      const reports = seeds.map((s) => import_kcd_sdk6.VaultUtilities.applySeed(projectRoot, s, { confirm }));
      if (args.json) {
        this.emit(reports);
        process.exit(0);
      }
      for (const r of reports) {
        const state = !r.targetExisted ? "creates" : !r.changed ? "already current" : r.applied ? "updated" : "would update";
        process.stdout.write(`${r.host.padEnd(8)} ${r.target.padEnd(12)} ${state}
`);
      }
      if (!confirm && reports.some((r) => r.changed))
        process.stdout.write('\npass "confirm" to write.\n');
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus lens-index [confirm]` — regenerate the entry document's Lenses table from the
   * vault's real lens files, so `!name` stays live after an agent authors a new one without a
   * human hand-editing the table. No `confirm` only reports the recomputed rows and whether they
   * differ; `root.html` is hard-rule protected, so this never writes without it.
   */
  static lensIndex(args) {
    const confirm = args.positionals[0] === "confirm";
    try {
      const vault = this.vault();
      const rows = import_kcd_sdk6.VaultUtilities.lensIndex(vault);
      const report = import_kcd_sdk6.VaultUtilities.spliceLensIndex(vault.read("root.html"), rows);
      if (args.json) {
        this.emit(report);
        process.exit(0);
      }
      process.stdout.write(`${rows.length} lenses \u2014 ${report.changed ? "root.html differs" : "root.html already current"}
`);
      for (const r of rows) process.stdout.write(`  ${r.what}
`);
      if (report.changed && confirm) {
        vault.write("root.html", report.html);
        process.stdout.write("\nwrote root.html\n");
      } else if (report.changed) {
        process.stdout.write('\npass "confirm" to write root.html.\n');
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  /**
   * `daedalus mcp status|tools|call` — the MCP group. Everything here builds the server
   * IN-PROCESS ( `wireTools()` / `invoke()` ) — no stdio spawn, no separate process. That is
   * deliberately the cheap half of introspection; `doctor` below is what proves the actual
   * built process still speaks the wire correctly.
   */
  static async mcp(args) {
    switch (args.positionals[0]) {
      case "status":
        return this.mcpStatus(args);
      case "tools":
        return this.mcpTools(args);
      case "call":
        return this.mcpCall(args);
      default:
        process.stderr.write("daedalus: mcp requires a subcommand ( status | tools | call )\n");
        process.exit(2);
    }
  }
  /**
   * `daedalus mcp status` — two different truths, kept separate on purpose: what the CODE
   * would register if spawned right now ( `wireTools()`, in-process, always current ) versus
   * what the COMMITTED snapshot says ( `tools.snapshot.json` — what a lazily-activated host is
   * actually showing an agent while the process stays dormant ). A mismatch is drift a host
   * client cannot see for itself.
   */
  static mcpStatus(args) {
    const live = new DaedalusServer().wireTools();
    const snap = this.readSnapshot();
    const config = Config.resolve();
    const drift = snap ? this.toolDrift(live, snap.tools) : null;
    if (args.json) {
      this.emit({ server: DaedalusServer.manifest, config, live, snapshot: snap, drift });
      process.exit(0);
    }
    process.stdout.write(`${DaedalusServer.manifest.id} v${DaedalusServer.manifest.version}
`);
    process.stdout.write(`vault: ${config.projectRoot} ( projectRoot: ${config.source.projectRoot}, docRoot: ${config.source.docRoot} )

`);
    process.stdout.write(`registered ( would spawn ):  ${live.length} tools
`);
    if (!snap) {
      process.stdout.write('snapshot ( committed ):      none found \u2014 run "npm run snapshot"\n');
    } else {
      process.stdout.write(`snapshot ( committed ):      ${snap.tools.length} tools, v${snap.version}
`);
      if (drift && drift.length > 0) {
        process.stdout.write("\n\u26A0 drift \u2014 snapshot does not match the live surface:\n");
        for (const line of drift) process.stdout.write(`    ${line}
`);
      } else {
        process.stdout.write("snapshot matches the live surface.\n");
      }
    }
    process.exit(0);
  }
  /** `daedalus mcp tools` — the live tool surface, built in-process. `--json` for the raw wire array. */
  static mcpTools(args) {
    const tools = new DaedalusServer().wireTools();
    if (args.json) {
      this.emit(tools);
    } else {
      for (const t of tools)
        process.stdout.write(`${this.tint(this.C.bold, String(t.name))}
    ${String(t.description)}
`);
    }
    process.exit(0);
  }
  /**
   * `daedalus mcp call <tool> [json-args]` — invoke a tool in-process and print exactly what the
   * agent would see. Seeing a tool's real output without paying for a model turn is the whole
   * point of the CLI being a first-class face rather than a validator with extras.
   */
  static async mcpCall(args) {
    const name = args.positionals[1];
    if (!name) {
      process.stderr.write("daedalus: mcp call requires a tool name\n");
      process.exit(2);
    }
    let toolArgs = {};
    const raw = args.positionals[2];
    if (raw) {
      try {
        toolArgs = JSON.parse(raw);
      } catch {
        process.stderr.write("daedalus: tool arguments must be valid JSON\n");
        process.exit(2);
      }
    }
    const result = await new DaedalusServer().invoke(name, toolArgs);
    const text = result.content.map((c) => c.text).join("\n");
    if (args.json) {
      this.emit(result);
    } else if (result.isError) {
      process.stderr.write(text + "\n");
    } else {
      process.stdout.write(text + "\n");
    }
    process.exit(result.isError ? 1 : 0);
  }
  /**
   * `daedalus doctor` — one command, five checks, each with a one-line fix. The highest-value
   * command for a first install: a bad install discovered here is a line of output, not a
   * confused agent turn later. Node / vault / MCP failures fail the process; PATH is advisory
   * ( the global-install shim is real but not yet the only supported way to run this ).
   */
  static async doctor(args) {
    const lines = [];
    let failed = false;
    const fail = (ok) => {
      if (!ok) failed = true;
    };
    const nodeOk = this.nodeOk();
    lines.push(this.checkLine("Node", nodeOk, `v${process.versions.node}`, `install Node ${this.NODE_MIN} or newer`));
    fail(nodeOk);
    const root = this.packageRoot();
    const entry = path2.join(root, "dist", "index.js");
    const built = (0, import_fs2.existsSync)(entry);
    lines.push(this.checkLine("Install", built, root, `run "npm run build" in ${root}`));
    fail(built);
    const onPath = await this.resolveOnPath("daedalus");
    lines.push(this.checkLine("PATH", onPath, onPath ? "daedalus resolves on PATH" : "not on PATH", 'run "npm install -g ." from the package root'));
    let vaultOk = false, vaultMsg = "";
    try {
      const config = Config.resolve();
      const health = import_kcd_sdk6.VaultUtilities.health(this.vault());
      vaultOk = health.summary.errors === 0;
      vaultMsg = `${config.projectRoot} \u2014 ${health.summary.errors} error(s), ${health.summary.warnings} warning(s)`;
    } catch (e) {
      vaultMsg = e instanceof Error ? e.message : String(e);
    }
    lines.push(this.checkLine("Vault", vaultOk, vaultMsg, 'run "daedalus validate" for the full report'));
    fail(vaultOk);
    const probe = built ? await this.probeServer(entry) : { ok: false, error: "entry point missing \u2014 build first" };
    lines.push(this.checkLine(
      "MCP",
      probe.ok,
      probe.ok ? `handshake ok \u2014 ${probe.toolCount} tools` : probe.error ?? "unknown failure",
      'run "npm run build" then "npm run verify" in the package root'
    ));
    fail(probe.ok);
    process.stdout.write(lines.join("\n") + "\n");
    process.exit(failed ? 1 : 0);
  }
  /** One doctor line: a mark, the label, the detail, and — only on failure — the fix. */
  static checkLine(label, ok, detail, fix) {
    const mark = ok ? this.tint(this.C.green, "\u2713") : this.tint(this.C.red, "\u2717");
    const line = `${mark} ${label.padEnd(8)} ${detail}`;
    return ok ? line : `${line}
    fix: ${fix}`;
  }
  /** `where`/`which daedalus`, no shell — a fixed literal, never user input, spawned directly. */
  static resolveOnPath(bin) {
    return new Promise((resolve3) => {
      const cmd = process.platform === "win32" ? "where" : "which";
      const proc = (0, import_child_process.spawn)(cmd, [bin], { stdio: ["ignore", "ignore", "ignore"] });
      proc.on("close", (code) => resolve3(code === 0));
      proc.on("error", () => resolve3(false));
    });
  }
  /**
   * Spawn the real built entry point and run the actual wire handshake ( initialize → tools/list )
   * over stdio — the one check that proves the BUILT artifact still speaks MCP, as opposed to
   * `mcp status`'s in-process build which only proves the source registers cleanly. 5s timeout;
   * the child is always killed before this resolves.
   */
  static probeServer(entry) {
    return new Promise((resolve3) => {
      const proc = (0, import_child_process.spawn)(process.execPath, [entry], { stdio: ["pipe", "pipe", "pipe"] });
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        proc.kill();
        resolve3(result);
      };
      const timer = setTimeout(() => finish({ ok: false, error: "timed out waiting for a response" }), 5e3);
      let buf = "";
      proc.stdout.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === 1) {
              proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
            } else if (msg.id === 2) {
              finish({ ok: true, toolCount: msg.result?.tools?.length ?? 0 });
            }
          } catch {
          }
        }
      });
      proc.on("error", (e) => finish({ ok: false, error: e.message }));
      proc.on("exit", (code) => {
        if (!settled) finish({ ok: false, error: `server exited early ( code ${code} )` });
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }) + "\n");
    });
  }
  /** The committed tool snapshot, or null if absent/unreadable — `mcp status`'s drift comparand. */
  static readSnapshot() {
    const file = path2.join(this.packageRoot(), "tools.snapshot.json");
    if (!(0, import_fs2.existsSync)(file)) return null;
    try {
      return JSON.parse((0, import_fs2.readFileSync)(file, "utf8"));
    } catch {
      return null;
    }
  }
  /** Tool names present on one side and not the other — empty array means no drift. */
  static toolDrift(live, snapshot) {
    const liveNames = new Set(live.map((t) => String(t.name)));
    const snapNames = new Set(snapshot.map((t) => String(t.name)));
    const added = [...liveNames].filter((n) => !snapNames.has(n));
    const removed = [...snapNames].filter((n) => !liveNames.has(n));
    const out = [];
    if (added.length) out.push(`in code, not snapshot: ${added.join(", ")}`);
    if (removed.length) out.push(`in snapshot, not code: ${removed.join(", ")}`);
    return out;
  }
  /** Walk up from this file looking for the package root ( nearest ancestor with a package.json ). */
  static packageRoot() {
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
      if ((0, import_fs2.existsSync)(path2.join(dir, "package.json"))) return dir;
      const parent = path2.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return __dirname;
  }
  /** The bundled canonical substrate — `InstallManifest`'s source, shipped alongside this package
   *  at `substrate/`. What `maintain fill` and `reset` restore FROM. */
  static substrateRoot() {
    return path2.join(this.packageRoot(), "substrate");
  }
  /** The bundled Claude skills, shipped alongside this package at `skills/` — what `init`'s skill
   *  step installs into `.claude/skills/`. */
  static skillsRoot() {
    return path2.join(this.packageRoot(), "skills");
  }
  /**
   * The agent entry-point filenames — CLAUDE.md, AGENTS.md, GEMINI.md today — read from the
   * BUNDLE's `root-context.html` seed declarations rather than written down here.
   *
   * NOT HARDCODED, deliberately ( Bryan, 2026-07-26: "CLAUDE.md is fine for now, but make it
   * variable" ). Those §10 seed blocks are already the one place the host targets are declared;
   * a literal list in the CLI would be a second one, and the day a fourth host is added the
   * install would seed it but never anchor on it. Returns [] rather than throwing if the bundle
   * is unreadable — anchoring is an optimisation, and losing it must not fail an install.
   */
  static hostMarkers() {
    return this.hostSeeds().map((s) => s.target);
  }
  /** The bundle's own seed declarations, before any vault exists. The install needs these BEFORE
   *  step 1 has run — to anchor the project root, to offer the entry points as a choice, and to
   *  show the user the block they are about to have added to a file they already own. */
  static hostSeeds() {
    try {
      const src = path2.join(this.substrateRoot(), ROOT_CONTEXT);
      if (!(0, import_fs2.existsSync)(src)) return [];
      return import_kcd_sdk6.VaultUtilities.parseSeedsFrom((0, import_fs2.readFileSync)(src, "utf-8"));
    } catch {
      return [];
    }
  }
  /**
   * The install, drawn as a folder tree rooted at the project.
   *
   * Folders, not files. A fresh vault is ~50 files and listing them was an unreadable wall that
   * told a newcomer nothing — what matters on first contact is the SHAPE: a `_Claude/` beside your
   * code, holding a handful of directories with obvious jobs, plus two or three files at the
   * project root. Directory names and their one-line purposes come from `VaultLayout`, so this
   * picture cannot drift from what deploy actually creates.
   *
   * `pending` draws it as the stepper's FIRST question, before any choice has been made — the vault
   * half is settled ( that is what is being agreed to ), the root files are still up for discussion,
   * and saying so on the picture is what keeps it from being a promise the later steps then break.
   */
  static installTree(projectRoot, docRoot, choices, pending = false) {
    const short = (purpose) => {
      const first = purpose.split(/[.—]/)[0].trim();
      return first.length > 52 ? first.slice(0, 51).replace(/\s+\S*$/, "") + "\u2026" : first;
    };
    const rows = import_kcd_sdk6.VaultLayout.all().filter((e) => !e.dir.includes("/"));
    const agent = rows.filter((e) => e.layer === "agent");
    const data = rows.filter((e) => e.layer === "data" && e.indexed);
    const scratch = rows.filter((e) => e.layer === "data" && !e.indexed);
    const dim = (s) => this.tint(this.C.dim, s);
    const pad = (s) => s.padEnd(18);
    const out = [];
    out.push(`${this.tint(this.C.bold, path2.basename(projectRoot) || projectRoot)}/`);
    out.push("\u2502");
    out.push(`\u251C\u2500 ${this.tint(this.C.bold, pad(docRoot + "/"))}${dim("The vault \u2014 everything governed lives here")}`);
    out.push("\u2502  \u2502");
    const group = (entries, label) => {
      if (entries.length === 0) return;
      out.push(`\u2502  \u2502  ${dim(label)}`);
      for (const e of entries) out.push(`\u2502  \u251C\u2500 ${pad(e.dir + "/")}${dim(short(e.purpose))}`);
      out.push("\u2502  \u2502");
    };
    group(agent, "What an agent is composed from");
    group(data, "What the project accumulates");
    if (scratch.length) {
      out.push(`\u2502  \u2502  ${dim("Scratch and output space")}`);
      out.push(`\u2502  \u251C\u2500 ${scratch.map((e) => e.dir + "/").join("  ")}`);
      out.push("\u2502  \u2502");
    }
    out.push(`\u2502  \u251C\u2500 ${pad("root.html")}${dim("The entry document \u2014 read first, and yours to edit")}`);
    out.push(`\u2502  \u2514\u2500 ${pad("root-context.html")}${dim("Generates the entry files below")}`);
    out.push("\u2502");
    if (pending) out.push(`\u2502  ${dim("At your project root \u2014 each one is a question in the steps below")}`);
    const hostWhy = (h) => h.startsWith("CLAUDE") ? "Points Claude Code at the vault" : h.startsWith("AGENTS") ? "The same, for Codex and others" : h.startsWith("GEMINI") ? "The same, for Gemini" : "Points your agent at the vault";
    const leaves = [];
    for (const h of choices.hosts) leaves.push([h, hostWhy(h)]);
    if (choices.mcp) leaves.push([".mcp.json", "Registers the kcd_* tools"]);
    if (choices.skills) leaves.push([".claude/skills/", "The bundled onboarding skill"]);
    leaves.forEach(([name, why], i) => {
      const last = i === leaves.length - 1;
      out.push(`${last ? "\u2514\u2500" : "\u251C\u2500"} ${pad(name)}${dim(why)}`);
    });
    return out.join("\n") + "\n";
  }
  /** Nearest ancestor of `from` ( inclusive ) holding any host marker file, or null. Same upward
   *  walk `inferProjectRoot` uses for the vault, against a different marker — because on a FIRST
   *  install there is no vault to find yet, and CLAUDE.md is the marker that already exists. */
  static markerRoot(from) {
    const markers = this.hostMarkers();
    if (!markers.length) return null;
    let dir = path2.resolve(from);
    for (; ; ) {
      if (markers.some((m) => (0, import_fs2.existsSync)(path2.join(dir, m)))) return dir;
      const parent = path2.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  /**
   * Nearest ancestor of `from` ( inclusive ) that is a git working tree, or null.
   *
   * Tests EXISTENCE, not directory-ness: `.git` is a directory in an ordinary clone but a FILE in a
   * worktree, a submodule, or anything else using a gitdir pointer, and treating those as "not a
   * repository" would silently drop the ignore question for exactly the people most likely to care.
   *
   * Walks up for the same reason the vault does — a repo root above the install directory still
   * governs it. The block itself is always written to a `.gitignore` at the PROJECT root, which is
   * correct whether or not that is also the repo root: git honours nested ignore files, and the
   * entries are relative to the file that holds them.
   */
  static gitRoot(from) {
    let dir = path2.resolve(from);
    for (; ; ) {
      if ((0, import_fs2.existsSync)(path2.join(dir, ".git"))) return dir;
      const parent = path2.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  /** Does this file hold anything besides our managed block? The conflict signal for a host entry
   *  point that was already instructing agents before we arrived. */
  static hasOwnContent(absPath) {
    if (!(0, import_fs2.existsSync)(absPath)) return false;
    const body = (0, import_fs2.readFileSync)(absPath, "utf-8").replace(/<!--\s*kcd:begin\s*-->[\s\S]*?<!--\s*kcd:end\s*-->/, "");
    return body.trim().length > 0;
  }
  /** The Node floor, defined ONCE — `init` gates on it before acting and `doctor` reports it after.
   *  Two copies of a version number is exactly how the two faces drift apart. */
  static NODE_MIN = 18;
  static nodeOk() {
    return Number(process.versions.node.split(".")[0]) >= this.NODE_MIN;
  }
  /**
   * `daedalus maintain [fill]` — vault STRUCTURE against `VaultLayout`, distinct from `validate`'s
   * document-validity. No argument previews only ( `VaultDeploy.inspect`, changes nothing ); `fill`
   * runs `apply()` and then inspects AGAIN — a fresh, independent call, not a trust of apply's own
   * bookkeeping — so what prints after a fill is proof the gaps are gone, not a promise they should be.
   */
  static maintain(args) {
    const { projectRoot, docRoot } = Config.resolve();
    const substrateSource = this.substrateRoot();
    const doFill = args.positionals[0] === "fill";
    if (!doFill) {
      const report = import_kcd_sdk6.VaultDeploy.inspect(projectRoot, { docRoot, substrateSource });
      if (args.json) {
        this.emit(report);
        process.exit(report.missing > 0 ? 1 : 0);
      }
      this.renderDeployReport(report, "inspect");
      process.exit(report.missing > 0 ? 1 : 0);
    }
    const before = import_kcd_sdk6.VaultDeploy.inspect(projectRoot, { docRoot, substrateSource });
    import_kcd_sdk6.VaultDeploy.apply(projectRoot, { docRoot, substrateSource });
    const after = import_kcd_sdk6.VaultDeploy.inspect(projectRoot, { docRoot, substrateSource });
    if (args.json) {
      this.emit({ before, after });
      process.exit(after.missing > 0 ? 1 : 0);
    }
    this.renderDeployReport(before, "before");
    process.stdout.write(`
filled ${before.missing - after.missing} item(s)
`);
    this.renderDeployReport(after, "after");
    process.exit(after.missing > 0 ? 1 : 0);
  }
  /** One `VaultDeploy` report — every step, present or not, with its note. */
  static renderDeployReport(report, label) {
    process.stdout.write(`
${label} \u2014 ${report.root}/${report.docRoot} ( ${report.missing} missing )
`);
    for (const item of report.items) {
      const mark = item.present ? this.tint(this.C.green, "\u2713") : this.tint(this.C.red, "\u2717");
      process.stdout.write(`  ${mark} ${item.kind.padEnd(9)} ${item.path}${item.note ? `  \u2014 ${item.note}` : ""}
`);
    }
  }
  /**
   * `daedalus fix-css [confirm]` — recompute every document's stylesheet `<link>` from its own
   * depth. No `confirm` previews only, matching `maintain` and `reset`.
   *
   * This exists because the stylesheet is linked by a plain `<link href>`, not a `data-kcd-*`
   * address — so no heal, no validator, and no link-check sees it. `VaultUtilities.fixStylesheetLinks`
   * has been able to repair it since the 2026-07-08 cutover left itself a note to run it "once its
   * new home is settled"; the home settled and nothing ever called it. A library function with no
   * caller is a fix that does not exist, which is why this is a verb and not a script.
   *
   * Reports the links it CHANGED, plus a count of those already correct.
   *
   * KNOWN GAP: `fixStylesheetLinks` matches on `/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/`
   * — first match only, exact attribute order. A document whose link tag differs ( `href` before
   * `rel`, extra attributes, unusual whitespace ) is skipped WITHOUT a report, so it cannot be
   * distinguished here from a file that has no link at all. The totals below are therefore
   * "of the links we recognized", not "of every document". Teaching the sweep to report unmatched
   * files is a small change to `VaultUtilities` and worth making before trusting this at scale.
   */
  static fixCss(args) {
    const confirm = args.positionals[0] === "confirm";
    try {
      const vault = this.vault();
      const reports = import_kcd_sdk6.VaultUtilities.fixStylesheetLinks(vault, import_kcd_sdk6.KcdEmit.cssHref(), { confirm });
      if (args.json) {
        this.emit(reports);
        process.exit(0);
      }
      const changed = reports.filter((r) => r.oldHref !== r.newHref);
      const correct = reports.length - changed.length;
      for (const r of changed) {
        const mark = confirm ? this.tint(this.C.green, "\u2713") : this.tint(this.C.grey, "\xB7");
        process.stdout.write(`  ${mark} ${r.path}
      ${r.oldHref}  \u2192  ${r.newHref}
`);
      }
      process.stdout.write(
        `
${changed.length} link(s) ${confirm ? "rewritten" : "would be rewritten"}, ${correct} already correct.
`
      );
      if (!confirm && changed.length) {
        process.stdout.write('run again with "confirm" to apply.\n');
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: fix-css failed \u2014 ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(1);
    }
  }
  /**
   * `daedalus reset <path> [confirm]` — restore ONE deployed artifact to canonical from the
   * substrate. No `confirm` previews only, exactly like `maintain`: report what would change,
   * write nothing. `confirm` performs the overwrite — never on a target already identical to
   * canonical, matching `VaultUtilities.reset`'s own no-op-when-identical rule.
   */
  static reset(args) {
    const target = args.positionals[0];
    if (!target) {
      process.stderr.write("daedalus: reset requires a vault-relative path\n");
      process.exit(2);
    }
    const confirm = args.positionals[1] === "confirm";
    try {
      const report = import_kcd_sdk6.VaultUtilities.reset(this.vault(), target, this.substrateRoot(), { confirm });
      if (args.json) {
        this.emit(report);
        process.exit(0);
      }
      if (!report.hasCanonical) {
        process.stdout.write(
          report.canonicalPath ? `no canonical counterpart at "${report.canonicalPath}" \u2014 nothing to reset from
` : `"${report.path}" is not covered by the install manifest \u2014 nothing to reset from
`
        );
        process.exit(1);
      }
      if (report.identical) {
        process.stdout.write(`"${report.path}" already matches canonical \u2014 nothing to do
`);
        process.exit(0);
      }
      if (report.applied) {
        process.stdout.write(`reset "${report.path}" from "${report.canonicalPath}"
`);
      } else {
        process.stdout.write(
          `"${report.path}" differs from canonical "${report.canonicalPath}"${report.targetExisted ? "" : " ( target does not exist yet )"} \u2014 pass "confirm" to overwrite
`
        );
      }
      process.exit(0);
    } catch (e) {
      process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  // ── Rendering ─────────────────────────────────────────────────────────────
  /** ANSI palette — applied only to a TTY, so piped/redirected output stays plain text. */
  static C = {
    reset: "\x1B[0m",
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    grey: "\x1B[90m",
    blue: "\x1B[94m",
    green: "\x1B[92m",
    red: "\x1B[91m"
  };
  /** Wrap `s` in an ANSI code, but only when stdout is a terminal. */
  static tint(code, s) {
    return process.stdout.isTTY ? code + s + this.C.reset : s;
  }
  /** The colour a slot state renders in: grey off, blue on, green suggested, dim empty. */
  static stateColor(state) {
    if (state === "suggested") return this.C.green;
    if (state === "on") return this.C.blue;
    if (state === "off") return this.C.grey;
    return this.C.dim;
  }
  /** The lens slot chart — a small, aligned, colour-coded table of the compiled-context breakdown. */
  static renderLensView(view) {
    const fmt = (n) => n > 0 ? n.toLocaleString("en-US") : "\u2014";
    const rows = view.slots;
    const modeW = Math.max(9, ...rows.map((r) => r.state.length));
    const compW = Math.max("COMPONENT".length, ...rows.map((r) => r.what.length));
    const kindW = Math.max("KIND".length, ...rows.map((r) => r.kind.length));
    const tokW = Math.max("TOKENS".length, ...rows.map((r) => fmt(r.tokens).length));
    const ruleW = 3 + modeW + 2 + compW + 2 + kindW + 2 + tokW;
    const rule = this.tint(this.C.dim, "  " + "\u2500".repeat(ruleW - 2));
    const out = [];
    out.push("");
    out.push("  " + this.tint(this.C.bold, view.lens) + this.tint(this.C.dim, "  \xB7  Lens"));
    out.push("");
    out.push(this.tint(
      this.C.dim,
      "   " + "MODE".padEnd(modeW) + "  " + "COMPONENT".padEnd(compW) + "  " + "KIND".padEnd(kindW) + "  " + "TOKENS".padStart(tokW)
    ));
    out.push(rule);
    for (const r of rows) {
      const col = this.stateColor(r.state);
      const mode = this.tint(col, r.state.padEnd(modeW));
      const comp = this.tint(col, r.what.padEnd(compW));
      const kind = this.tint(this.C.dim, r.kind.padEnd(kindW));
      const tok = fmt(r.tokens).padStart(tokW);
      out.push("   " + mode + "  " + comp + "  " + kind + "  " + (r.tokens > 0 ? tok : this.tint(this.C.dim, tok)));
    }
    out.push(rule);
    const count = (s) => rows.filter((r) => r.state === s).length;
    const tally = ["suggested", "on", "off", "empty"].filter((s) => count(s) > 0).map((s) => this.tint(this.stateColor(s), `${s} ${count(s)}`)).join("   ");
    out.push("   " + tally + this.tint(this.C.dim, `      total  ~${view.tokens.toLocaleString("en-US")}`));
    out.push("");
    process.stdout.write(out.join("\n") + "\n");
  }
  /** Human-readable health output — issues grouped by artifact, then a one-line tally. */
  static renderHealth(report, scope) {
    const where = scope ? scope : "vault";
    if (report.issues.length === 0) {
      process.stdout.write(`\u2713 ${where}: no issues
`);
      return;
    }
    const byPath = /* @__PURE__ */ new Map();
    for (const issue of report.issues) {
      const bucket = byPath.get(issue.path) ?? [];
      bucket.push(issue);
      byPath.set(issue.path, bucket);
    }
    for (const [path3, issues] of byPath) {
      process.stdout.write(`${path3}
`);
      for (const i of issues)
        process.stdout.write(`    ${i.severity === "error" ? "error" : "warn "}  ${i.message}
`);
      process.stdout.write("\n");
    }
    const { total, errors, warnings } = report.summary;
    process.stdout.write(`${total} issue${total === 1 ? "" : "s"} across ${byPath.size} file${byPath.size === 1 ? "" : "s"} \u2014 ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}
`);
  }
  // ── Plumbing ──────────────────────────────────────────────────────────────
  /** The vault bound to the resolved config — the CLI's one-shot equivalent of MCPUtils.vault. */
  static vault() {
    const { projectRoot, docRoot } = Config.resolve();
    return new import_kcd_sdk6.Vault(projectRoot, docRoot);
  }
  /** Raw SDK object to stdout — the `--json` form. Data on stdout so `| jq` sees only payload. */
  static emit(data) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
  /**
   * argv → ParsedArgs. Deliberately hand-rolled and small: the first bare token is the command,
   * later bare tokens are its positionals, and a short fixed set of flags is recognised. Value
   * flags ( --root, --doc-root ) consume the following token; boolean flags ( --json, --help ) do
   * not. Unknown `--flags` are ignored here rather than erroring, so a command can grow its own
   * without a central schema to update.
   */
  static parse(argv) {
    const out = { command: "", positionals: [], json: false, help: false };
    for (let i = 0; i < argv.length; i++) {
      const token = argv[i];
      if (token === "--root") {
        out.root = argv[++i];
        continue;
      }
      if (token === "--doc-root") {
        out.docRoot = argv[++i];
        continue;
      }
      if (token === "--json") {
        out.json = true;
        continue;
      }
      if (token === "--help" || token === "-h") {
        out.help = true;
        continue;
      }
      if (token.startsWith("-")) continue;
      if (!out.command) out.command = token;
      else out.positionals.push(token);
    }
    return out;
  }
  static printHelp() {
    process.stdout.write(
      `daedalus \u2014 a context compiler

Usage: daedalus <command> [options]

Commands:
  init [confirm]    Install into this project. In a terminal it steps you through the choices; "confirm" takes the defaults and writes.
  get-started       After restarting your agent session: survey the project and print a prompt to verify the tools are live.
  validate [path]   Validate one artifact, or the whole vault when no path is given.
  compile <lens...> Compile one or more lenses to a context string ( first = primary ).
  show <lens>       Chart one lens's compiled context \u2014 slots, states, token counts.
  survey            Reconnoitre the project beside the vault \u2192 a JSON tree in audits/survey/.
  mcp status        Compare the live tool surface against the committed snapshot.
  mcp tools         List the live tool surface ( in-process, no spawn ).
  mcp call <tool> [json-args]   Invoke a tool in-process and print its result.
  doctor            Five checks \u2014 Node, install, PATH, vault, MCP end-to-end \u2014 each with a fix.
  maintain [fill]   Vault STRUCTURE vs VaultLayout ( preview only, unless "fill" ).
  reset <path> [confirm]   Restore one artifact to canonical from the substrate ( preview only, unless "confirm" ).
  fix-css [confirm]        Recompute every document's stylesheet link from its own depth ( preview only, unless "confirm" ).
  query [json-filter]   Find artifacts by glob/type/text, or census by type ( e.g. '{"groupBy":"type"}' ).
  links <path>      An artifact's outbound links/addresses, plus everything pointing back at it.
  seed [host] [confirm]      Extract root-context seed payloads into CLAUDE.md etc ( preview only, unless "confirm" ).
  lens-index [confirm]       Regenerate the entry doc's Lenses table from real lenses ( preview only, unless "confirm" ).
  clear [all] [confirm]      Take the install back out. Removes only what it added; "all" also removes the vault.

Options:
  --root <dir>      Project root the vault sits under ( default: inferred by walking up ).
  --doc-root <dir>  Doc root within the project ( default: the standard vault folder ).
  --json            Emit the raw result object instead of formatted lines.
  -h, --help        Show this help.

Exit codes: 0 = clean, 1 = errors found, 2 = usage error.
`
    );
  }
};

// src/cli/index.ts
Cli.run(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`daedalus: ${e instanceof Error ? e.message : String(e)}
`);
  process.exit(1);
});
//# sourceMappingURL=index.js.map
