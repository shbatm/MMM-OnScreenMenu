## [0.1.5] - Added "instance" option for toggling menus per #11

## [0.1.4] - Added autoCloseTimeout option as requested in #7

* Added a autoCloseTimeout option to the config options. Set to something other than 0 to automatically close the menu after X ms.

## [0.1.3] - Added MINIMIZE, FULLSCREEN and DEVTOOLS options

* Added "minimize" menu option to minimize the MM window if using electron
* Added "toggleFullscreen" menu option to toggle full screen mode
* Added "openDevTools" menu option to open the DevTools window.
* Changed method for restarting or stopping the PM2 instance from `exec` to use the PM2 NodeJS module.  Note: you must run `npm install` on the module directory to update.

## [0.1.2] - Added STOP option to stop the MM PM2 Process

* Added the ability to add a "STOP" menu item to exit the MM process via PM2.
* Added dependency on PM2 NodeJS module for "native" control over the MM PM2 process.

## [0.1.1] - Added delayed menu items

* Added the ability to call menu items after a delay either via dedicated menu item for the delayed action or via notification from another module.
    - Example uses: refresh the page after X seconds, or turn off the monitor after X seconds.

## [0.1.0] - Added Notification Control Options & Multi-Instance

* Added the ability to control the menu itself via notifications from other modules. See [README](readme.md#controlling-the-menu-from-another-module) for additional details.
* Added support for multiple instances of the module (multiple menus) by setting the `menuName` property in the config for each menu.

## [0.0.9] - First public release for testing

First public release
