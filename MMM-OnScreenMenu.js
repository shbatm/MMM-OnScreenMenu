/* global document, Module, window, Mousetrap, console */
/* jshint esversion:6 */
/* Magic Mirror
 * Module: MMM-OnScreenMenu
 *
 * By shbatm
 * MIT Licensed.
 */

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
        enableKeyBindings: false,
        keyBindingsMode: "OSM",
        keyBindings: {
            Up: "ArrowUp",
            Down: "ArrowDown",
            Select: "Enter",
            Close: "Return",
            Menu: "Menu"
        },
        kbMultiInstance: true,
        keyBindingsTakeFocus: "Menu", // Can also be object: { KeyName:"Menu", KeyState:"KEY_LONGPRESSED" }
        pm2ProcessName: "mm"
    },

    requiresVersion: "2.1.0", // Required version of MagicMirror

    hovering: false,
    manualOpen: false,
    menuOpen: false,
    selectedMenuItem: '',
    actionTimers: {},

    start: function() {
        console.log(this.name + " has started...");

        this.sendSocketNotification("CONFIG", this.config);

        this.kbInstance = (["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1", undefined, "0.0.0.0"].indexOf(
            window.location.hostname) > -1) ? "SERVER" : "LOCAL";
        Object.keys(this.config.menuItems).forEach(k => {
            if ("source" in this.config.menuItems[k] &&
                (this.config.menuItems[k].source !== this.kbInstance &&
                    this.config.menuItems[k].source !== "ALL")) {
                delete this.config.menuItems[k];
            }
        });

        if (this.config.enableKeyboard) {
            this.setupMousetrap();
        } else if (this.config.enableKeyBindings) {
            this.setupKeyBindings();
        }
    },

    setupMousetrap: function() {
        Mousetrap.bind('up', () => this.selectMenuItem(-1));
        Mousetrap.bind('down', () => this.selectMenuItem());
        Mousetrap.bind('enter', () => this.doMenuActionCB());
        Mousetrap.addKeycodes({ 93: 'menu' });
        Mousetrap.bind('menu', (e) => {
            this.toggleMenu();
            e.preventDefault();
            return false;
        }, 'keyup');
    },

    getScripts: function() {
        return ['mousetrap.min.js'];
    },

    getStyles: function() {
        return [`${this.name}.css`, 'font-awesome.css'];
    },

    getDom: function() {
        return this.createMenu();
    },

    // socketNotificationReceived from helper
    socketNotificationReceived: function(notification, payload) {
        // console.log("Working notification system. Notification:", notification, "payload: ", payload);
        if (notification === "RESTART") {
            setTimeout(function() {
                document.location.reload();
                console.log('Delayed REFRESH');
            }, 45000);
        }
    },

    notificationReceived: function(notification, payload, sender) {
        if (this.config.enableKeyBindings) {
            if (this.validateKeyPress(notification, payload)) {
                return;
            }
        }

        if (notification === "DOM_OBJECTS_CREATED") {
            // do nothing
        }
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
            if (this.config.enableKeyBindings && !this.menuOpen) {
                this.keyPressReleaseFocus();
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
            this.sendSocketNotification("PROCESS_ACTION", actionName);
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

    delayedAction: function (timer) {    
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
        if (this.config.enableKeyBindings &&
            this.currentKeyPressMode !== this.config.keyBindingsMode) {
            this.keyPressFocusReceived();
        }
    },

    mouseoutCB: function() {
        this.hovering = false;
        this.menuOpen = this.manualOpen;
        if (this.config.enableKeyBindings && !this.menuOpen &&
            this.currentKeyPressMode === this.config.keyBindingsMode) {
            this.keyPressReleaseFocus();
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

        var div = document.createElement("div");
        div.className = this.data.position;
        if (this.config.touchMode) {
            div.classList.add("touchMode");
        }
        div.id = "osm" + this.config.menuName;

        var nav = document.createElement("nav");
        nav.id = "menuContainer";
        nav.className = "osmContainer";
        nav.onmouseenter = () => this.mouseenterCB();
        nav.onmouseout = () => this.mouseoutCB();

        var fab = document.createElement("span");
        fab.className = "osmButtons menu";
        fab.setAttribute("tooltip", "Close");
        fab.onclick = () => this.toggleMenu();
        fab.innerHTML = `<i class="fa fa-bars closed" aria-hidden="true"></i>
                         <i class="fa fa-times opened" aria-hidden="true"></i>`;

        if (this.data.position.startsWith("top")) {
            nav.appendChild(fab);
        }

        Object.keys(this.config.menuItems).forEach(k => {
            var span = document.createElement("span");
            span.id = "osm" + this.config.menuName + "_" + k;
            span.innerHTML = `<i class="fa fa-${this.config.menuItems[k].icon}" aria-hidden="true"></i>`;
            span.className = "osmButtons item";
            span.setAttribute("tooltip", this.config.menuItems[k].title);
            span.onclick = makeOnClickHandler(k);
            nav.appendChild(span);
        });

        if (this.data.position.startsWith("bottom")) {
            nav.appendChild(fab);
        }

        div.appendChild(nav);
        return div;

        /* FLOATING ACTION BUTTON MENU HTML SHOULD LOOK LIKE THIS:
          <div id="menu" class="bottom_right">
          <nav id="menuContainer" class="container" onmouseenter="mouseenterCB()" onmouseout="mouseoutCB();"> 
            <span class="buttons item" id="monitorOff" onclick="clicked('Turn Off Display')" tooltip="Turn Off Display">
              <i class="fa fa-television" aria-hidden="true"></i></span>
            <span class="buttons item" id="restart" onclick="clicked('Restart MagicMirror')" tooltip="Restart MagicMirror">
              <i class="fa fa-refresh" aria-hidden="true"></i></span>
            <span class="buttons item" id="reboot" onclick="clicked('Reboot')" tooltip="Reboot">
              <i class="fa fa-spinner" aria-hidden="true"></i></span>
            <span class="buttons item" id="shutdown" onclick="clicked('Shutdown')" tooltip="Shutdown">
              <i class="fa fa-power-off" aria-hidden="true"></i></span>
            <span onclick="toggleMenu()" class="buttons menu" tooltip="Close">
              <i class="fa fa-bars closed" aria-hidden="true"></i>
              <i class="fa fa-times opened" aria-hidden="true"></i>
            </span>
          </nav>
          </div>
        */
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
        var menu = document.getElementById("osm" + this.config.menuName);
        menu.classList.toggle("touchMode");
    },

    setupKeyBindings: function() {
        this.currentKeyPressMode = "DEFAULT";
        if (typeof this.config.kbMultiInstance === undefined) {
            this.config.kbMultiInstance = true;
        }
        this.reverseKBMap = {};
        for (var eKey in this.config.keyBindings) {
            if (this.config.keyBindings.hasOwnProperty(eKey)) {
                this.reverseKBMap[this.config.keyBindings[eKey]] = eKey;
            }
        }
    },

    validateKeyPress: function(notification, payload) {
        // Handle KEYPRESS mode change events from the MMM-KeyBindings Module
        if (notification === "KEYPRESS_MODE_CHANGED") {
            this.currentKeyPressMode = payload;
            return true;
        }

        // Uncomment line below for diagnostics & to confirm keypresses are being recieved
        // if (notification === "KEYPRESS") { console.log(payload, this.currentKeyPressMode); }

        // Validate Keypresses
        if (notification === "KEYPRESS" && this.currentKeyPressMode === this.config.keyBindingsMode) {
            if (this.config.kbMultiInstance && payload.Sender !== this.kbInstance) {
                return false; // Wrong Instance
            }
            if (!(payload.KeyName in this.reverseKBMap)) {
                return false; // Not a key we listen for
            }
            this.validKeyPress(payload);
            return true;
        }

        // Test for focus key pressed and need to take focus:
        if (notification === "KEYPRESS" && ("keyBindingsTakeFocus" in this.config)) {
            if (this.currentKeyPressMode === this.config.keyBindingsMode) {
                return false; // Already have focus.
            }
            if (this.config.kbMultiInstance && payload.Sender !== this.kbInstance) {
                return false; // Wrong Instance
            }
            if (typeof this.config.keyBindingsTakeFocus === "object") {
                if (this.config.keyBindingsTakeFocus.KeyPress !== payload.KeyPress ||
                    this.config.keyBindingsTakeFocus.KeyState !== payload.KeyState) {
                    return false; // Wrong KeyName/KeyPress Combo
                }
            } else if (typeof this.config.keyBindingsTakeFocus === "string" &&
                payload.KeyName !== this.config.keyBindingsTakeFocus) {
                return false; // Wrong Key;
            }

            this.keyPressFocusReceived();
            return true;
        }

        return false;
    },

    validKeyPress: function(kp) {
        if (kp.KeyName === this.config.keyBindings.Up) {
            this.selectMenuItem(-1);
        } else if (kp.KeyName === this.config.keyBindings.Down) {
            this.selectMenuItem();
        } else if (kp.KeyName === this.config.keyBindings.Select) {
            this.doMenuActionCB();
        } else if (kp.KeyName === this.config.keyBindings.Close) {
            this.toggleMenu(true);
        } else if (kp.KeyName === this.config.keyBindings.Menu) {
            this.toggleMenu();
        }
    },

    keyPressFocusReceived: function(kp) {
        // console.log(this.name + "HAS FOCUS!");
        this.sendNotification("KEYPRESS_MODE_CHANGED", this.config.keyBindingsMode);
        this.currentKeyPressMode = this.config.keyBindingsMode;
        if (!this.menuOpen) { this.toggleMenu(); }
    },

    keyPressReleaseFocus: function() {
        // console.log(this.name + "HAS RELEASED FOCUS!");
        this.sendNotification("KEYPRESS_MODE_CHANGED", "DEFAULT");
        this.currentKeyPressMode = "DEFAULT";
    },

    /***** FULL SCREEN OVERLAY, NOT USED AT THIS TIME *****/
    /*    createOverlay: function(brightness) {
            var overlay = document.getElementById('osm-overlay');
            if (!overlay) {
                // if not existing, create overlay
                var overlayNew = document.createElement("div");
                overlayNew.id = "osm-overlay";
                var parent = document.body;
                parent.insertBefore(overlayNew, parent.firstChild);
            }
            overlay.style.className = "osm overlay";
        },

        removeOverlay: function() {
            var overlay = document.getElementById('osm-overlay');
            if (overlay) {
                var parent = document.body;
                parent.removeChild(overlay);
            }
        },*/

    /***** FULL SCREEN MODAL MENU, NOT USED AT THIS TIME *****/
    /*    createMenu: function() {
            var self = this;

            function makeOnClickHandler(a) {
                return function () {
                    self.doMenuAction(a);
                };
            }

            var existingMenu = document.getElementById('osm-menu');
            
            if (!existingMenu) {
                var wrapper = document.createElement("div");
                wrapper.id = "osm-menu";
                wrapper.className = "osm modal";

                var ul = document.createElement("ul");
                ul.id = "osm";
                ul.className = "osm";

                Object.keys(this.config.menuItems).foreach(k => {
                    var li = document.createElement("li");
                    li.innerHTML = `<span id=osm_${k}><i class="fa fa-${this.config.menuItems[k].icon} fa-fw" aria-hidden="true"></i>&nbsp; ${this.config.menuItems[k].title}</span>`;
                    li.className = "osm";
                    li.onclick = makeOnClickHandler(k);
                    ul.appendChild(li);
                });

                wrapper.appendChild(ul);
                var parent = document.body;
                parent.insertBefore(wrapper, parent.firstChild);
                existingMenu = wrapper;
            }
            existingMenu.style.visibility = "visible";
        },

        hideMenu: function() {
            var menu = document.getElementById('osm-menu');
            if (menu) {
                var parent = document.body;
                parent.removeChild(menu);
                menu.style.visibility = "hidden";
            }
        },

        toggleMenu: function(visible) {
            if (visible) {
                this.createOverlay();
                this.createMenu();
            } else {
                this.removeOverlay();
                this.hideMenu();
            }
        },*/

});
