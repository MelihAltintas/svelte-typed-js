(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.SvelteTypedJs = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_slots(slots) {
        const result = {};
        for (const key in slots) {
            result[key] = true;
        }
        return result;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var typed = createCommonjsModule(function (module, exports) {
    /*!
     * 
     *   typed.js - A JavaScript Typing Animation Library
     *   Author: Matt Boldt <me@mattboldt.com>
     *   Version: v2.0.11
     *   Url: https://github.com/mattboldt/typed.js
     *   License(s): MIT
     * 
     */
    (function webpackUniversalModuleDefinition(root, factory) {
    	module.exports = factory();
    })(commonjsGlobal, function() {
    return /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
    /******/
    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId])
    /******/ 			return installedModules[moduleId].exports;
    /******/
    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			exports: {},
    /******/ 			id: moduleId,
    /******/ 			loaded: false
    /******/ 		};
    /******/
    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    /******/
    /******/ 		// Flag the module as loaded
    /******/ 		module.loaded = true;
    /******/
    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(0);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports, __webpack_require__) {
    	
    	Object.defineProperty(exports, '__esModule', {
    	  value: true
    	});
    	
    	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
    	
    	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }
    	
    	var _initializerJs = __webpack_require__(1);
    	
    	var _htmlParserJs = __webpack_require__(3);
    	
    	/**
    	 * Welcome to Typed.js!
    	 * @param {string} elementId HTML element ID _OR_ HTML element
    	 * @param {object} options options object
    	 * @returns {object} a new Typed object
    	 */
    	
    	var Typed = (function () {
    	  function Typed(elementId, options) {
    	    _classCallCheck(this, Typed);
    	
    	    // Initialize it up
    	    _initializerJs.initializer.load(this, options, elementId);
    	    // All systems go!
    	    this.begin();
    	  }
    	
    	  /**
    	   * Toggle start() and stop() of the Typed instance
    	   * @public
    	   */
    	
    	  _createClass(Typed, [{
    	    key: 'toggle',
    	    value: function toggle() {
    	      this.pause.status ? this.start() : this.stop();
    	    }
    	
    	    /**
    	     * Stop typing / backspacing and enable cursor blinking
    	     * @public
    	     */
    	  }, {
    	    key: 'stop',
    	    value: function stop() {
    	      if (this.typingComplete) return;
    	      if (this.pause.status) return;
    	      this.toggleBlinking(true);
    	      this.pause.status = true;
    	      this.options.onStop(this.arrayPos, this);
    	    }
    	
    	    /**
    	     * Start typing / backspacing after being stopped
    	     * @public
    	     */
    	  }, {
    	    key: 'start',
    	    value: function start() {
    	      if (this.typingComplete) return;
    	      if (!this.pause.status) return;
    	      this.pause.status = false;
    	      if (this.pause.typewrite) {
    	        this.typewrite(this.pause.curString, this.pause.curStrPos);
    	      } else {
    	        this.backspace(this.pause.curString, this.pause.curStrPos);
    	      }
    	      this.options.onStart(this.arrayPos, this);
    	    }
    	
    	    /**
    	     * Destroy this instance of Typed
    	     * @public
    	     */
    	  }, {
    	    key: 'destroy',
    	    value: function destroy() {
    	      this.reset(false);
    	      this.options.onDestroy(this);
    	    }
    	
    	    /**
    	     * Reset Typed and optionally restarts
    	     * @param {boolean} restart
    	     * @public
    	     */
    	  }, {
    	    key: 'reset',
    	    value: function reset() {
    	      var restart = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];
    	
    	      clearInterval(this.timeout);
    	      this.replaceText('');
    	      if (this.cursor && this.cursor.parentNode) {
    	        this.cursor.parentNode.removeChild(this.cursor);
    	        this.cursor = null;
    	      }
    	      this.strPos = 0;
    	      this.arrayPos = 0;
    	      this.curLoop = 0;
    	      if (restart) {
    	        this.insertCursor();
    	        this.options.onReset(this);
    	        this.begin();
    	      }
    	    }
    	
    	    /**
    	     * Begins the typing animation
    	     * @private
    	     */
    	  }, {
    	    key: 'begin',
    	    value: function begin() {
    	      var _this = this;
    	
    	      this.options.onBegin(this);
    	      this.typingComplete = false;
    	      this.shuffleStringsIfNeeded(this);
    	      this.insertCursor();
    	      if (this.bindInputFocusEvents) this.bindFocusEvents();
    	      this.timeout = setTimeout(function () {
    	        // Check if there is some text in the element, if yes start by backspacing the default message
    	        if (!_this.currentElContent || _this.currentElContent.length === 0) {
    	          _this.typewrite(_this.strings[_this.sequence[_this.arrayPos]], _this.strPos);
    	        } else {
    	          // Start typing
    	          _this.backspace(_this.currentElContent, _this.currentElContent.length);
    	        }
    	      }, this.startDelay);
    	    }
    	
    	    /**
    	     * Called for each character typed
    	     * @param {string} curString the current string in the strings array
    	     * @param {number} curStrPos the current position in the curString
    	     * @private
    	     */
    	  }, {
    	    key: 'typewrite',
    	    value: function typewrite(curString, curStrPos) {
    	      var _this2 = this;
    	
    	      if (this.fadeOut && this.el.classList.contains(this.fadeOutClass)) {
    	        this.el.classList.remove(this.fadeOutClass);
    	        if (this.cursor) this.cursor.classList.remove(this.fadeOutClass);
    	      }
    	
    	      var humanize = this.humanizer(this.typeSpeed);
    	      var numChars = 1;
    	
    	      if (this.pause.status === true) {
    	        this.setPauseStatus(curString, curStrPos, true);
    	        return;
    	      }
    	
    	      // contain typing function in a timeout humanize'd delay
    	      this.timeout = setTimeout(function () {
    	        // skip over any HTML chars
    	        curStrPos = _htmlParserJs.htmlParser.typeHtmlChars(curString, curStrPos, _this2);
    	
    	        var pauseTime = 0;
    	        var substr = curString.substr(curStrPos);
    	        // check for an escape character before a pause value
    	        // format: \^\d+ .. eg: ^1000 .. should be able to print the ^ too using ^^
    	        // single ^ are removed from string
    	        if (substr.charAt(0) === '^') {
    	          if (/^\^\d+/.test(substr)) {
    	            var skip = 1; // skip at least 1
    	            substr = /\d+/.exec(substr)[0];
    	            skip += substr.length;
    	            pauseTime = parseInt(substr);
    	            _this2.temporaryPause = true;
    	            _this2.options.onTypingPaused(_this2.arrayPos, _this2);
    	            // strip out the escape character and pause value so they're not printed
    	            curString = curString.substring(0, curStrPos) + curString.substring(curStrPos + skip);
    	            _this2.toggleBlinking(true);
    	          }
    	        }
    	
    	        // check for skip characters formatted as
    	        // "this is a `string to print NOW` ..."
    	        if (substr.charAt(0) === '`') {
    	          while (curString.substr(curStrPos + numChars).charAt(0) !== '`') {
    	            numChars++;
    	            if (curStrPos + numChars > curString.length) break;
    	          }
    	          // strip out the escape characters and append all the string in between
    	          var stringBeforeSkip = curString.substring(0, curStrPos);
    	          var stringSkipped = curString.substring(stringBeforeSkip.length + 1, curStrPos + numChars);
    	          var stringAfterSkip = curString.substring(curStrPos + numChars + 1);
    	          curString = stringBeforeSkip + stringSkipped + stringAfterSkip;
    	          numChars--;
    	        }
    	
    	        // timeout for any pause after a character
    	        _this2.timeout = setTimeout(function () {
    	          // Accounts for blinking while paused
    	          _this2.toggleBlinking(false);
    	
    	          // We're done with this sentence!
    	          if (curStrPos >= curString.length) {
    	            _this2.doneTyping(curString, curStrPos);
    	          } else {
    	            _this2.keepTyping(curString, curStrPos, numChars);
    	          }
    	          // end of character pause
    	          if (_this2.temporaryPause) {
    	            _this2.temporaryPause = false;
    	            _this2.options.onTypingResumed(_this2.arrayPos, _this2);
    	          }
    	        }, pauseTime);
    	
    	        // humanized value for typing
    	      }, humanize);
    	    }
    	
    	    /**
    	     * Continue to the next string & begin typing
    	     * @param {string} curString the current string in the strings array
    	     * @param {number} curStrPos the current position in the curString
    	     * @private
    	     */
    	  }, {
    	    key: 'keepTyping',
    	    value: function keepTyping(curString, curStrPos, numChars) {
    	      // call before functions if applicable
    	      if (curStrPos === 0) {
    	        this.toggleBlinking(false);
    	        this.options.preStringTyped(this.arrayPos, this);
    	      }
    	      // start typing each new char into existing string
    	      // curString: arg, this.el.html: original text inside element
    	      curStrPos += numChars;
    	      var nextString = curString.substr(0, curStrPos);
    	      this.replaceText(nextString);
    	      // loop the function
    	      this.typewrite(curString, curStrPos);
    	    }
    	
    	    /**
    	     * We're done typing the current string
    	     * @param {string} curString the current string in the strings array
    	     * @param {number} curStrPos the current position in the curString
    	     * @private
    	     */
    	  }, {
    	    key: 'doneTyping',
    	    value: function doneTyping(curString, curStrPos) {
    	      var _this3 = this;
    	
    	      // fires callback function
    	      this.options.onStringTyped(this.arrayPos, this);
    	      this.toggleBlinking(true);
    	      // is this the final string
    	      if (this.arrayPos === this.strings.length - 1) {
    	        // callback that occurs on the last typed string
    	        this.complete();
    	        // quit if we wont loop back
    	        if (this.loop === false || this.curLoop === this.loopCount) {
    	          return;
    	        }
    	      }
    	      this.timeout = setTimeout(function () {
    	        _this3.backspace(curString, curStrPos);
    	      }, this.backDelay);
    	    }
    	
    	    /**
    	     * Backspaces 1 character at a time
    	     * @param {string} curString the current string in the strings array
    	     * @param {number} curStrPos the current position in the curString
    	     * @private
    	     */
    	  }, {
    	    key: 'backspace',
    	    value: function backspace(curString, curStrPos) {
    	      var _this4 = this;
    	
    	      if (this.pause.status === true) {
    	        this.setPauseStatus(curString, curStrPos, true);
    	        return;
    	      }
    	      if (this.fadeOut) return this.initFadeOut();
    	
    	      this.toggleBlinking(false);
    	      var humanize = this.humanizer(this.backSpeed);
    	
    	      this.timeout = setTimeout(function () {
    	        curStrPos = _htmlParserJs.htmlParser.backSpaceHtmlChars(curString, curStrPos, _this4);
    	        // replace text with base text + typed characters
    	        var curStringAtPosition = curString.substr(0, curStrPos);
    	        _this4.replaceText(curStringAtPosition);
    	
    	        // if smartBack is enabled
    	        if (_this4.smartBackspace) {
    	          // the remaining part of the current string is equal of the same part of the new string
    	          var nextString = _this4.strings[_this4.arrayPos + 1];
    	          if (nextString && curStringAtPosition === nextString.substr(0, curStrPos)) {
    	            _this4.stopNum = curStrPos;
    	          } else {
    	            _this4.stopNum = 0;
    	          }
    	        }
    	
    	        // if the number (id of character in current string) is
    	        // less than the stop number, keep going
    	        if (curStrPos > _this4.stopNum) {
    	          // subtract characters one by one
    	          curStrPos--;
    	          // loop the function
    	          _this4.backspace(curString, curStrPos);
    	        } else if (curStrPos <= _this4.stopNum) {
    	          // if the stop number has been reached, increase
    	          // array position to next string
    	          _this4.arrayPos++;
    	          // When looping, begin at the beginning after backspace complete
    	          if (_this4.arrayPos === _this4.strings.length) {
    	            _this4.arrayPos = 0;
    	            _this4.options.onLastStringBackspaced();
    	            _this4.shuffleStringsIfNeeded();
    	            _this4.begin();
    	          } else {
    	            _this4.typewrite(_this4.strings[_this4.sequence[_this4.arrayPos]], curStrPos);
    	          }
    	        }
    	        // humanized value for typing
    	      }, humanize);
    	    }
    	
    	    /**
    	     * Full animation is complete
    	     * @private
    	     */
    	  }, {
    	    key: 'complete',
    	    value: function complete() {
    	      this.options.onComplete(this);
    	      if (this.loop) {
    	        this.curLoop++;
    	      } else {
    	        this.typingComplete = true;
    	      }
    	    }
    	
    	    /**
    	     * Has the typing been stopped
    	     * @param {string} curString the current string in the strings array
    	     * @param {number} curStrPos the current position in the curString
    	     * @param {boolean} isTyping
    	     * @private
    	     */
    	  }, {
    	    key: 'setPauseStatus',
    	    value: function setPauseStatus(curString, curStrPos, isTyping) {
    	      this.pause.typewrite = isTyping;
    	      this.pause.curString = curString;
    	      this.pause.curStrPos = curStrPos;
    	    }
    	
    	    /**
    	     * Toggle the blinking cursor
    	     * @param {boolean} isBlinking
    	     * @private
    	     */
    	  }, {
    	    key: 'toggleBlinking',
    	    value: function toggleBlinking(isBlinking) {
    	      if (!this.cursor) return;
    	      // if in paused state, don't toggle blinking a 2nd time
    	      if (this.pause.status) return;
    	      if (this.cursorBlinking === isBlinking) return;
    	      this.cursorBlinking = isBlinking;
    	      if (isBlinking) {
    	        this.cursor.classList.add('typed-cursor--blink');
    	      } else {
    	        this.cursor.classList.remove('typed-cursor--blink');
    	      }
    	    }
    	
    	    /**
    	     * Speed in MS to type
    	     * @param {number} speed
    	     * @private
    	     */
    	  }, {
    	    key: 'humanizer',
    	    value: function humanizer(speed) {
    	      return Math.round(Math.random() * speed / 2) + speed;
    	    }
    	
    	    /**
    	     * Shuffle the sequence of the strings array
    	     * @private
    	     */
    	  }, {
    	    key: 'shuffleStringsIfNeeded',
    	    value: function shuffleStringsIfNeeded() {
    	      if (!this.shuffle) return;
    	      this.sequence = this.sequence.sort(function () {
    	        return Math.random() - 0.5;
    	      });
    	    }
    	
    	    /**
    	     * Adds a CSS class to fade out current string
    	     * @private
    	     */
    	  }, {
    	    key: 'initFadeOut',
    	    value: function initFadeOut() {
    	      var _this5 = this;
    	
    	      this.el.className += ' ' + this.fadeOutClass;
    	      if (this.cursor) this.cursor.className += ' ' + this.fadeOutClass;
    	      return setTimeout(function () {
    	        _this5.arrayPos++;
    	        _this5.replaceText('');
    	
    	        // Resets current string if end of loop reached
    	        if (_this5.strings.length > _this5.arrayPos) {
    	          _this5.typewrite(_this5.strings[_this5.sequence[_this5.arrayPos]], 0);
    	        } else {
    	          _this5.typewrite(_this5.strings[0], 0);
    	          _this5.arrayPos = 0;
    	        }
    	      }, this.fadeOutDelay);
    	    }
    	
    	    /**
    	     * Replaces current text in the HTML element
    	     * depending on element type
    	     * @param {string} str
    	     * @private
    	     */
    	  }, {
    	    key: 'replaceText',
    	    value: function replaceText(str) {
    	      if (this.attr) {
    	        this.el.setAttribute(this.attr, str);
    	      } else {
    	        if (this.isInput) {
    	          this.el.value = str;
    	        } else if (this.contentType === 'html') {
    	          this.el.innerHTML = str;
    	        } else {
    	          this.el.textContent = str;
    	        }
    	      }
    	    }
    	
    	    /**
    	     * If using input elements, bind focus in order to
    	     * start and stop the animation
    	     * @private
    	     */
    	  }, {
    	    key: 'bindFocusEvents',
    	    value: function bindFocusEvents() {
    	      var _this6 = this;
    	
    	      if (!this.isInput) return;
    	      this.el.addEventListener('focus', function (e) {
    	        _this6.stop();
    	      });
    	      this.el.addEventListener('blur', function (e) {
    	        if (_this6.el.value && _this6.el.value.length !== 0) {
    	          return;
    	        }
    	        _this6.start();
    	      });
    	    }
    	
    	    /**
    	     * On init, insert the cursor element
    	     * @private
    	     */
    	  }, {
    	    key: 'insertCursor',
    	    value: function insertCursor() {
    	      if (!this.showCursor) return;
    	      if (this.cursor) return;
    	      this.cursor = document.createElement('span');
    	      this.cursor.className = 'typed-cursor';
    	      this.cursor.innerHTML = this.cursorChar;
    	      this.el.parentNode && this.el.parentNode.insertBefore(this.cursor, this.el.nextSibling);
    	    }
    	  }]);
    	
    	  return Typed;
    	})();
    	
    	exports['default'] = Typed;
    	module.exports = exports['default'];

    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {
    	
    	Object.defineProperty(exports, '__esModule', {
    	  value: true
    	});
    	
    	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };
    	
    	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
    	
    	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
    	
    	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }
    	
    	var _defaultsJs = __webpack_require__(2);
    	
    	var _defaultsJs2 = _interopRequireDefault(_defaultsJs);
    	
    	/**
    	 * Initialize the Typed object
    	 */
    	
    	var Initializer = (function () {
    	  function Initializer() {
    	    _classCallCheck(this, Initializer);
    	  }
    	
    	  _createClass(Initializer, [{
    	    key: 'load',
    	
    	    /**
    	     * Load up defaults & options on the Typed instance
    	     * @param {Typed} self instance of Typed
    	     * @param {object} options options object
    	     * @param {string} elementId HTML element ID _OR_ instance of HTML element
    	     * @private
    	     */
    	
    	    value: function load(self, options, elementId) {
    	      // chosen element to manipulate text
    	      if (typeof elementId === 'string') {
    	        self.el = document.querySelector(elementId);
    	      } else {
    	        self.el = elementId;
    	      }
    	
    	      self.options = _extends({}, _defaultsJs2['default'], options);
    	
    	      // attribute to type into
    	      self.isInput = self.el.tagName.toLowerCase() === 'input';
    	      self.attr = self.options.attr;
    	      self.bindInputFocusEvents = self.options.bindInputFocusEvents;
    	
    	      // show cursor
    	      self.showCursor = self.isInput ? false : self.options.showCursor;
    	
    	      // custom cursor
    	      self.cursorChar = self.options.cursorChar;
    	
    	      // Is the cursor blinking
    	      self.cursorBlinking = true;
    	
    	      // text content of element
    	      self.elContent = self.attr ? self.el.getAttribute(self.attr) : self.el.textContent;
    	
    	      // html or plain text
    	      self.contentType = self.options.contentType;
    	
    	      // typing speed
    	      self.typeSpeed = self.options.typeSpeed;
    	
    	      // add a delay before typing starts
    	      self.startDelay = self.options.startDelay;
    	
    	      // backspacing speed
    	      self.backSpeed = self.options.backSpeed;
    	
    	      // only backspace what doesn't match the previous string
    	      self.smartBackspace = self.options.smartBackspace;
    	
    	      // amount of time to wait before backspacing
    	      self.backDelay = self.options.backDelay;
    	
    	      // Fade out instead of backspace
    	      self.fadeOut = self.options.fadeOut;
    	      self.fadeOutClass = self.options.fadeOutClass;
    	      self.fadeOutDelay = self.options.fadeOutDelay;
    	
    	      // variable to check whether typing is currently paused
    	      self.isPaused = false;
    	
    	      // input strings of text
    	      self.strings = self.options.strings.map(function (s) {
    	        return s.trim();
    	      });
    	
    	      // div containing strings
    	      if (typeof self.options.stringsElement === 'string') {
    	        self.stringsElement = document.querySelector(self.options.stringsElement);
    	      } else {
    	        self.stringsElement = self.options.stringsElement;
    	      }
    	
    	      if (self.stringsElement) {
    	        self.strings = [];
    	        self.stringsElement.style.display = 'none';
    	        var strings = Array.prototype.slice.apply(self.stringsElement.children);
    	        var stringsLength = strings.length;
    	
    	        if (stringsLength) {
    	          for (var i = 0; i < stringsLength; i += 1) {
    	            var stringEl = strings[i];
    	            self.strings.push(stringEl.innerHTML.trim());
    	          }
    	        }
    	      }
    	
    	      // character number position of current string
    	      self.strPos = 0;
    	
    	      // current array position
    	      self.arrayPos = 0;
    	
    	      // index of string to stop backspacing on
    	      self.stopNum = 0;
    	
    	      // Looping logic
    	      self.loop = self.options.loop;
    	      self.loopCount = self.options.loopCount;
    	      self.curLoop = 0;
    	
    	      // shuffle the strings
    	      self.shuffle = self.options.shuffle;
    	      // the order of strings
    	      self.sequence = [];
    	
    	      self.pause = {
    	        status: false,
    	        typewrite: true,
    	        curString: '',
    	        curStrPos: 0
    	      };
    	
    	      // When the typing is complete (when not looped)
    	      self.typingComplete = false;
    	
    	      // Set the order in which the strings are typed
    	      for (var i in self.strings) {
    	        self.sequence[i] = i;
    	      }
    	
    	      // If there is some text in the element
    	      self.currentElContent = this.getCurrentElContent(self);
    	
    	      self.autoInsertCss = self.options.autoInsertCss;
    	
    	      this.appendAnimationCss(self);
    	    }
    	  }, {
    	    key: 'getCurrentElContent',
    	    value: function getCurrentElContent(self) {
    	      var elContent = '';
    	      if (self.attr) {
    	        elContent = self.el.getAttribute(self.attr);
    	      } else if (self.isInput) {
    	        elContent = self.el.value;
    	      } else if (self.contentType === 'html') {
    	        elContent = self.el.innerHTML;
    	      } else {
    	        elContent = self.el.textContent;
    	      }
    	      return elContent;
    	    }
    	  }, {
    	    key: 'appendAnimationCss',
    	    value: function appendAnimationCss(self) {
    	      var cssDataName = 'data-typed-js-css';
    	      if (!self.autoInsertCss) {
    	        return;
    	      }
    	      if (!self.showCursor && !self.fadeOut) {
    	        return;
    	      }
    	      if (document.querySelector('[' + cssDataName + ']')) {
    	        return;
    	      }
    	
    	      var css = document.createElement('style');
    	      css.type = 'text/css';
    	      css.setAttribute(cssDataName, true);
    	
    	      var innerCss = '';
    	      if (self.showCursor) {
    	        innerCss += '\n        .typed-cursor{\n          opacity: 1;\n        }\n        .typed-cursor.typed-cursor--blink{\n          animation: typedjsBlink 0.7s infinite;\n          -webkit-animation: typedjsBlink 0.7s infinite;\n                  animation: typedjsBlink 0.7s infinite;\n        }\n        @keyframes typedjsBlink{\n          50% { opacity: 0.0; }\n        }\n        @-webkit-keyframes typedjsBlink{\n          0% { opacity: 1; }\n          50% { opacity: 0.0; }\n          100% { opacity: 1; }\n        }\n      ';
    	      }
    	      if (self.fadeOut) {
    	        innerCss += '\n        .typed-fade-out{\n          opacity: 0;\n          transition: opacity .25s;\n        }\n        .typed-cursor.typed-cursor--blink.typed-fade-out{\n          -webkit-animation: 0;\n          animation: 0;\n        }\n      ';
    	      }
    	      if (css.length === 0) {
    	        return;
    	      }
    	      css.innerHTML = innerCss;
    	      document.body.appendChild(css);
    	    }
    	  }]);
    	
    	  return Initializer;
    	})();
    	
    	exports['default'] = Initializer;
    	var initializer = new Initializer();
    	exports.initializer = initializer;

    /***/ }),
    /* 2 */
    /***/ (function(module, exports) {
    	
    	Object.defineProperty(exports, '__esModule', {
    	  value: true
    	});
    	var defaults = {
    	  /**
    	   * @property {array} strings strings to be typed
    	   * @property {string} stringsElement ID of element containing string children
    	   */
    	  strings: ['These are the default values...', 'You know what you should do?', 'Use your own!', 'Have a great day!'],
    	  stringsElement: null,
    	
    	  /**
    	   * @property {number} typeSpeed type speed in milliseconds
    	   */
    	  typeSpeed: 0,
    	
    	  /**
    	   * @property {number} startDelay time before typing starts in milliseconds
    	   */
    	  startDelay: 0,
    	
    	  /**
    	   * @property {number} backSpeed backspacing speed in milliseconds
    	   */
    	  backSpeed: 0,
    	
    	  /**
    	   * @property {boolean} smartBackspace only backspace what doesn't match the previous string
    	   */
    	  smartBackspace: true,
    	
    	  /**
    	   * @property {boolean} shuffle shuffle the strings
    	   */
    	  shuffle: false,
    	
    	  /**
    	   * @property {number} backDelay time before backspacing in milliseconds
    	   */
    	  backDelay: 700,
    	
    	  /**
    	   * @property {boolean} fadeOut Fade out instead of backspace
    	   * @property {string} fadeOutClass css class for fade animation
    	   * @property {boolean} fadeOutDelay Fade out delay in milliseconds
    	   */
    	  fadeOut: false,
    	  fadeOutClass: 'typed-fade-out',
    	  fadeOutDelay: 500,
    	
    	  /**
    	   * @property {boolean} loop loop strings
    	   * @property {number} loopCount amount of loops
    	   */
    	  loop: false,
    	  loopCount: Infinity,
    	
    	  /**
    	   * @property {boolean} showCursor show cursor
    	   * @property {string} cursorChar character for cursor
    	   * @property {boolean} autoInsertCss insert CSS for cursor and fadeOut into HTML <head>
    	   */
    	  showCursor: true,
    	  cursorChar: '|',
    	  autoInsertCss: true,
    	
    	  /**
    	   * @property {string} attr attribute for typing
    	   * Ex: input placeholder, value, or just HTML text
    	   */
    	  attr: null,
    	
    	  /**
    	   * @property {boolean} bindInputFocusEvents bind to focus and blur if el is text input
    	   */
    	  bindInputFocusEvents: false,
    	
    	  /**
    	   * @property {string} contentType 'html' or 'null' for plaintext
    	   */
    	  contentType: 'html',
    	
    	  /**
    	   * Before it begins typing
    	   * @param {Typed} self
    	   */
    	  onBegin: function onBegin(self) {},
    	
    	  /**
    	   * All typing is complete
    	   * @param {Typed} self
    	   */
    	  onComplete: function onComplete(self) {},
    	
    	  /**
    	   * Before each string is typed
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  preStringTyped: function preStringTyped(arrayPos, self) {},
    	
    	  /**
    	   * After each string is typed
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  onStringTyped: function onStringTyped(arrayPos, self) {},
    	
    	  /**
    	   * During looping, after last string is typed
    	   * @param {Typed} self
    	   */
    	  onLastStringBackspaced: function onLastStringBackspaced(self) {},
    	
    	  /**
    	   * Typing has been stopped
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  onTypingPaused: function onTypingPaused(arrayPos, self) {},
    	
    	  /**
    	   * Typing has been started after being stopped
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  onTypingResumed: function onTypingResumed(arrayPos, self) {},
    	
    	  /**
    	   * After reset
    	   * @param {Typed} self
    	   */
    	  onReset: function onReset(self) {},
    	
    	  /**
    	   * After stop
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  onStop: function onStop(arrayPos, self) {},
    	
    	  /**
    	   * After start
    	   * @param {number} arrayPos
    	   * @param {Typed} self
    	   */
    	  onStart: function onStart(arrayPos, self) {},
    	
    	  /**
    	   * After destroy
    	   * @param {Typed} self
    	   */
    	  onDestroy: function onDestroy(self) {}
    	};
    	
    	exports['default'] = defaults;
    	module.exports = exports['default'];

    /***/ }),
    /* 3 */
    /***/ (function(module, exports) {
    	
    	Object.defineProperty(exports, '__esModule', {
    	  value: true
    	});
    	
    	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
    	
    	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }
    	
    	var HTMLParser = (function () {
    	  function HTMLParser() {
    	    _classCallCheck(this, HTMLParser);
    	  }
    	
    	  _createClass(HTMLParser, [{
    	    key: 'typeHtmlChars',
    	
    	    /**
    	     * Type HTML tags & HTML Characters
    	     * @param {string} curString Current string
    	     * @param {number} curStrPos Position in current string
    	     * @param {Typed} self instance of Typed
    	     * @returns {number} a new string position
    	     * @private
    	     */
    	
    	    value: function typeHtmlChars(curString, curStrPos, self) {
    	      if (self.contentType !== 'html') return curStrPos;
    	      var curChar = curString.substr(curStrPos).charAt(0);
    	      if (curChar === '<' || curChar === '&') {
    	        var endTag = '';
    	        if (curChar === '<') {
    	          endTag = '>';
    	        } else {
    	          endTag = ';';
    	        }
    	        while (curString.substr(curStrPos + 1).charAt(0) !== endTag) {
    	          curStrPos++;
    	          if (curStrPos + 1 > curString.length) {
    	            break;
    	          }
    	        }
    	        curStrPos++;
    	      }
    	      return curStrPos;
    	    }
    	
    	    /**
    	     * Backspace HTML tags and HTML Characters
    	     * @param {string} curString Current string
    	     * @param {number} curStrPos Position in current string
    	     * @param {Typed} self instance of Typed
    	     * @returns {number} a new string position
    	     * @private
    	     */
    	  }, {
    	    key: 'backSpaceHtmlChars',
    	    value: function backSpaceHtmlChars(curString, curStrPos, self) {
    	      if (self.contentType !== 'html') return curStrPos;
    	      var curChar = curString.substr(curStrPos).charAt(0);
    	      if (curChar === '>' || curChar === ';') {
    	        var endTag = '';
    	        if (curChar === '>') {
    	          endTag = '<';
    	        } else {
    	          endTag = '&';
    	        }
    	        while (curString.substr(curStrPos - 1).charAt(0) !== endTag) {
    	          curStrPos--;
    	          if (curStrPos < 0) {
    	            break;
    	          }
    	        }
    	        curStrPos--;
    	      }
    	      return curStrPos;
    	    }
    	  }]);
    	
    	  return HTMLParser;
    	})();
    	
    	exports['default'] = HTMLParser;
    	var htmlParser = new HTMLParser();
    	exports.htmlParser = htmlParser;

    /***/ })
    /******/ ])
    });
    });

    /* src\components\SvelteTypedJs.svelte generated by Svelte v3.29.4 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-c2yv0h-style";
    	style.textContent = ".typed-element.svelte-c2yv0h{display:flex;align-items:center}@keyframes svelte-c2yv0h-typedjsBlink{50%{opacity:0}}";
    	append(document.head, style);
    }

    function create_fragment(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr(div, "class", "typed-element svelte-c2yv0h");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[3](div);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[3](null);
    		}
    	};
    }

    function throwError(message) {
    	throw new TypeError(message);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	const $$slots = compute_slots(slots);
    	let typedObj = null;
    	let typedElement = null;

    	function initTypedJS() {
    		const $typed = typedElement.querySelector(".typing");

    		if ($$slots.default == undefined) {
    			throwError(`Just one child element allowed inside  component.`);
    		} else if ($$slots.default == true) {
    			typedObj = new typed($typed, $$props);
    		}
    	}

    	onMount(() => {
    		initTypedJS();
    	});

    	onDestroy(() => {
    		typedObj.destroy();
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			typedElement = $$value;
    			$$invalidate(0, typedElement);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(7, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("$$scope" in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	$$props = exclude_internal_props($$props);
    	return [typedElement, $$scope, slots, div_binding];
    }

    class SvelteTypedJs extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-c2yv0h-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    return SvelteTypedJs;

})));
