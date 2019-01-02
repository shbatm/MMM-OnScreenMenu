/* global document, Module, window, Mousetrap, console */
/* jshint esversion:6 */
/* Magic Mirror
 * Module: MMM-OnScreenMenu
 *
 * By shbatm
 * MIT Licensed.
 */

// Establish the root object, `window` in the browser, or `global` on the server.
var global = this;

Module.register("MMM-OnScreenMenu", {
    defaults: {
        touchMode: true,
        menuName: "MAIN",
        menuItems: {
            monitorOff: { title: "Turn Off Monitor", icon: "television", source: "SERVER" },
            restart: { title: "Restart MagicMirror", icon: "recycle", source: "ALL" },
            refresh: { title: "Refresh MagicMirror", icon: "refresh", source: "LOCAL" },
            reboot: { title: "Reboot", icon: "spinner", source: "ALL" },
            shutdown: { title: "Shutdown", icon: "power-off", source: "ALL" },
        },
        enableKeyboard: true,

        // MMM-KeyBindings Settings
        keyBindings: {
            enabled: true
        },
    },

    keyBindings: {
        enabled: false,
        mode: "OSM",
        map: {
            Up: "ArrowUp",
            Down: "ArrowDown",
            Select: "Enter",
            Close: "Return",
            Menu: "Menu"
        },
        multiInstance: true,
        takeFocus: "Menu"
    },

    requiresVersion: "2.1.0", // Required version of MagicMirror

    // Allow for control on muliple instances
    instance: (global.location && ["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1", undefined, "0.0.0.0"].indexOf(global.location.hostname) > -1) ? "SERVER" : "LOCAL",

    hovering: false,
    manualOpen: false,
    menuOpen: false,
    selectedMenuItem: '',
    actionTimers: {},

    start: function() {
        console.log(this.name + " has started...");

        Object.keys(this.config.menuItems).forEach(k => {
            if ("source" in this.config.menuItems[k] &&
                (this.config.menuItems[k].source !== this.instance &&
                    this.config.menuItems[k].source !== "ALL")) {
                delete this.config.menuItems[k];
            }
        });

        if (this.config.enableKeyboard) {
            this.setupMousetrap();
        }
    },

    setupMousetrap: function() {
        Mousetrap.bind('up', () => this.selectMenuItem(-1));
        Mousetrap.bind('down', () => this.selectMenuItem());
        Mousetrap.bind('enter', () => this.doMenuActionCB());
        Mousetrap.addKeycodes({ 93: 'Menu' });
        Mousetrap.bind('Menu', (e) => {
            this.toggleMenu();
            e.preventDefault();
            return false;
        }, 'keyup');
    },

    getScripts: function() {
        let scripts = [
            this.file('js/jquery-3.2.1.min.js'),
            this.file('js/popper.min.js'),
            this.file('js/bootstrap.min.js')
        ];
        if (this.config.enableKeyboard) { scripts.push(this.file('js/mousetrap.min.js')); }

        return scripts;
    },

    getStyles: function() {
        return [`${this.name}.css`, 'font-awesome.css'];
    },

    getDom: function() {
        return this.createMenu();
    },

    notificationReceived: function(notification, payload, sender) {
        if (notification === "DOM_OBJECTS_CREATED") {
            // Register Key Handler
            if (this.config.keyBindings.enabled &&
                MM.getModules().filter(kb => kb.name === "MMM-KeyBindings").length > 0) {
                this.keyBindings = Object.assign({}, this.keyBindings, this.config.keyBindings);
                KeyHandler.register(this.name, {
                    sendNotification: (n, p) => { this.sendNotification(n, p); },
                    validKeyPress: (kp) => { this.validKeyPress(kp); },
                    onFocus: () => {
                        if (!this.menuOpen) { this.toggleMenu(); }
                    },
                    onFocusReleased: () => {
                        if (this.menuOpen) { this.toggleMenu(); }
                    }
                });
                this.keyHandler = KeyHandler.create(this.name, this.keyBindings);
            }
            this.sendNotification("REGISTER_API", {
                module: "MMM-OnScreenMenu",
                path: "onscreenmenu",
                actions: {}
            });
        }
        if (this.keyHandler && this.keyHandler.validate(notification, payload)) { return; }

        if (notification === "ALL_MODULES_STARTED") {
            // do nothing
        }
        if (notification === "ONSCREENMENU_PROCESS_ACTION") {
            this.doMenuAction(payload);
        }
        if (notification === "ONSCREENMENU_TOGGLE_MENU") {
            if ((typeof payload === "object" && "menuName" in payload && payload.menuName === this.config.menuName) || typeof payload !== "object") {
                this.toggleMenu();
            }
        }
        if (notification === "ONSCREENMENU_BY_NUMBER") {
            if (typeof payload === "object" && "menuName" in payload && payload.menuName === this.config.menuName) {
                this.clickByNumber(payload.itemNumber);
            }
            if (typeof payload === "number") {
                this.clickByNumber(payload);
            }
        }
    },

    /********** ON SCREEN MENU FUNCTIONS **********/
    clickByNumber: function(itemNumber) {
        if (!this.menuOpen) {
            // Correct menu must be opened first
            return;
        }
        var k = Object.keys(this.config.menuItems);
        if (itemNumber < 0 || itemNumber >= k.length) {
            // Invalid selection
            return;
        }
        this.doMenuAction(k[itemNumber]);
    },

    clearSelection: function() {
        var k = Object.keys(this.config.menuItems);
        k.forEach(s => {
            var item = document.getElementById(`osm${this.config.menuName}_${s}`);
            item.classList.remove("selected");
        });
        this.selectedMenuItem = '';
    },

    toggleMenu: function(forceClose) {
        var menu = document.getElementById("osm" + this.config.menuName);
        // console.log(`Hovering: ${this.hovering}, Manual: ${this.manualOpen}, Open: ${this.menuOpen}, forceClose: ${forceClose}`);
        if (forceClose || this.manualOpen) {
            this.clearSelection();
            menu.classList.remove("openMenu");
            this.manualOpen = false;
            this.menuOpen = this.hovering;
            if (this.config.keyBindings.enabled && !this.menuOpen) {
                this.keyHandler.releaseFocus();
            }
            return;
        } else {
            menu.classList.add("openMenu");
            this.menuOpen = true;
            this.manualOpen = true;
            return;
        }
    },

    doMenuActionCB: function() {
        if (this.selectedMenuItem) {
            this.doMenuAction(this.selectedMenuItem);
        } else {
            this.toggleMenu(true);
        }
    },

    doMenuAction: function(action) {
        var actionDetail = {};
        if (typeof action === "object") {
            actionDetail = action;
            actionName = actionDetail.actionName;
        } else {
            actionName = action;
            actionDetail = this.config.menuItems[action];
        }

        console.log(`OSM Menu Item Clicked: ${actionName}\n${JSON.stringify(actionDetail)}`);

        var nodeActions = ["monitorOn", "monitorOff", "monitorToggle", "restart", "reboot", "shutdown", "stop", "minimize", "toggleFullscreen", "openDevTools"];

        // Module Actions
        if (actionName.startsWith("module")) {
            this.handleModuleAction(actionName);
        } else if (actionName.startsWith("notify")) {
            this.sendNotification(actionDetail.notification,
                actionDetail.payload);
        } else if (nodeActions.indexOf(actionName) !== -1) {
            this.sendNotification("REMOTE_ACTION", { action: actionName.toUpperCase() });
        } else if (actionName === "refresh") {
            window.location.reload(true);
        } else if (actionName === "toggleTouchMode") {
            this.toggleTouchMode();
        } else if (actionName.startsWith("changeMenuPosition_")) {
            this.changeMenuPosition(actionName.replace("changeMenuPosition_", ""));
        } else if (actionName.startsWith("delayed")) {
            if (!("actionName" in actionDetail)) {
                actionDetail.actionName = actionName;
            }
            this.delayedAction(actionDetail);
        } else {
            alert(`Unknown OSM Menu Item Clicked: ${actionName}`);
        }

        this.toggleMenu(true);
    },

    delayedAction: function(timer) {
        // Restart the timer
        if (timer.actionName in this.actionTimers) {
            clearTimeout(this.actionTimers[timer.actionName]);
            delete this.actionTimers[timer.actionName];
        }
        if (!timer.abort) {
            this.actionTimers[timer.actionName] = setTimeout(() => { this.doMenuAction(timer.action); }, timer.delay);
        }
    },

    handleModuleAction: function(action) {
        var modules = MM.getModules().exceptModule(this).filter((m) => {
            if ("instance" in this.config.menuItems[action]) {
                return (m.name === this.config.menuItems[action].name && m.data.config.instance === this.config.menuItems[action].instance);
            } else {
                return m.name === this.config.menuItems[action].name;
            }
        }, this);

        if (typeof modules !== "undefined") {
            modules.forEach(k => {
                if (action.indexOf("Hide") > -1 ||
                    (action.indexOf("Toggle") > -1 && !k.hidden)) {
                    console.log(`Hiding ${this.config.menuItems[action].name}`);
                    k.hide(0, { lockString: "osm" });
                } else if (action.indexOf("Show") > -1 ||
                    (action.indexOf("Toggle") > -1 && k.hidden)) {
                    console.log(`Showing ${this.config.menuItems[action].name}`);
                    k.show(1500, { lockString: "osm" });
                }
            });
        }
    },

    selectMenuItem: function(direction = 1) {
        if (!this.menuOpen) {
            return false;
        }

        var menu = document.getElementById("osm" + this.config.menuName).children[0];
        var k = Object.keys(this.config.menuItems);
        if (!this.selectedMenuItem) {
            this.selectedMenuItem = k[0];
        } else {
            var i = k.indexOf(this.selectedMenuItem);
            var newI = i + direction;
            if (newI >= k.length) {
                newI = 0;
            } else if (newI < 0) {
                newI = k.length - 1;
            }
            this.selectedMenuItem = k[newI];
        }

        k.forEach(s => {
            var item = document.getElementById(`osm${this.config.menuName}_${s}`);
            item.classList.toggle("selected", s === this.selectedMenuItem);
        });
    },

    mouseenterCB: function() {
        this.hovering = true;
        this.menuOpen = true;
        if (this.config.keyBindings.enabled &&
            this.keyHandler.currentMode !== this.config.keyBindings.mode) {

        }
    },

    mouseoutCB: function() {
        this.hovering = false;
        this.menuOpen = this.manualOpen;
        if (this.config.keyBindings.enabled && !this.menuOpen &&
            this.currentKeyPressMode === this.config.keyBindingsMode) {
            this.keyHandler.releaseFocus();
        }
    },

    createMenu: function() {
        var self = this;

        // Check position is valid:
        var positions = ['top_right', 'top_left', 'bottom_right', 'bottom_left'];
        if (positions.indexOf(this.data.position) === -1) { this.data.position = 'top_right'; }

        function makeOnClickHandler(a) {
            return function() {
                self.doMenuAction(a);
            };
        }

        var $div = $('<div />').attr("id", `osm${this.config.menuName}`)
            .addClass(this.data.position + ((this.config.touchMode) ? " touchMode" : ""));

        var $nav = $('<nav />').attr("id", "menuContainer").addClass("osmContainer")
            .on("mouseenter", () => this.mouseenterCB()).on("mouseout", () => this.mouseoutCB());

        var $fab = $('<span />').addClass("osmButtons menu").attr("tooltip", "Close")
            .html(`<i class="fa fa-bars closed" aria-hidden="true"></i>
                   <i class="fa fa-times opened" aria-hidden="true"></i>`);

        if (this.data.position.startsWith("top")) {
            $nav.append($fab);
        }

        if (this.config.useMMMRC) {
            this.createMMMRCframe($fab);
        } else {
            $fab.on("click", () => this.toggleMenu());
            Object.keys(this.config.menuItems).forEach(k => {
                let $span = $('<span />').attr('id', `osm${this.config.menuName}_${k}`)
                    .html(`<i class="fa fa-${this.config.menuItems[k].icon}" aria-hidden="true"></i>`)
                    .addClass('osmButtons item').attr('tooltip', this.config.menuItems[k].title);
                if (k === "remote") {
                    this.createMMMRCframe($span);
                } else {
                    $span.on("click", makeOnClickHandler(k));
                }
                $nav.append($span);
            });
        }

        if (this.data.position.startsWith("bottom")) {
            $nav.append($fab);
        }

        $div.append($nav);
        return $div[0];
    },

    /* Function to change position of the menu. 
     * Not used by default, just available from demo */
    changeMenuPosition: function(newPosition) {
        var menu = document.getElementById("osm" + this.config.menuName);
        var nav = menu.children[0];
        menu.classList.toggle("top_left", newPosition === "top_left");
        menu.classList.toggle("top_right", newPosition === "top_right");
        menu.classList.toggle("bottom_left", newPosition === "bottom_left");
        menu.classList.toggle("bottom_right", newPosition === "bottom_right");
        var menuBtn = nav.getElementsByClassName("osmButtons menu")[0];
        if (newPosition.startsWith("bottom")) {
            nav.appendChild(menuBtn);
        } else {
            nav.insertBefore(menuBtn, nav.children[0]);
        }
    },

    /* Function to toggle "touchMode" of the button (always visible). 
     * Not used by default, just available from demo */
    toggleTouchMode: function() {
        $(`#osm${this.config.menuName}`).toggleClass('touchMode');
    },

    validKeyPress: function(kp) {
        if (kp.keyName === this.keyHandler.config.map.Up) {
            this.selectMenuItem(-1);
        } else if (kp.keyName === this.keyHandler.config.map.Down) {
            this.selectMenuItem();
        } else if (kp.keyName === this.keyHandler.config.map.Select) {
            this.doMenuActionCB();
        } else if (kp.keyName === this.keyHandler.config.map.Close) {
            this.toggleMenu(true);
        } else if (kp.keyName === this.keyHandler.config.map.Menu) {
            this.toggleMenu();
        }
    },

    createMMMRCframe: function($item) {
        $item.popover({
            html: true,
            placement: "auto",
            content: function() {
                return '<iframe src="/remote.html" style="border:none; height: 600px; width: 400px"></iframe>';
            }
        }).on('inserted.bs.popover', function(evt) {
            var $popup = $('#' + $(evt.target).attr('aria-describedby'));
            // var $popup = $(this).next('.popover');
            $popup.find('button').click(function(e) {
                $popup.popover('hide');
                if (this.id !== "btnClose") { that.handleControlEvent(evt.target, this.id); }
            });
        });
        $(document).on('click', function(e) {
            $('[data-toggle="popover"],[data-original-title]').each(function() {
                if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                    (($(this).popover('hide').data('bs.popover') || {}).inState || {}).click = false; // fix for BS 3.3.6
                }

            });
        });
    },
});