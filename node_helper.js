/* Magic Mirror
 * Node Helper: MMM-OnScreenMenu
 *
 * By shbatm
 * MIT Licensed.
 */
/* jshint node: true, esversion: 6*/

"use strict";

var NodeHelper = require("node_helper");
var url = require("url");
const exec = require("child_process").exec;
// const os = require("os");


module.exports = NodeHelper.create({

    start: function() {
        this.started = false;
        this.config = {};
    },


    processAction: function(payload) {
        var self = this;
        var opts = { timeout: 8000 };
        var screenStatus;
        var win;

        switch (payload) {
            case "monitorOn":
                screenStatus = exec("tvservice --status", opts,
                    function(error, stdout, stderr) {
                        if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                        }
                        self.checkForExecError(error, stdout, stderr);
                    });
                break;
            case "monitorOff":
                exec("tvservice -o", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                break;
            case "monitorToggle":
                screenStatus = exec("tvservice --status", opts,
                    function(error, stdout, stderr) {
                        if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                        } else if (stdout.indexOf("HDMI") !== -1) {
                            // Screen is ON, turn it OFF
                            exec("tvservice -o", (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                        }
                        self.checkForExecError(error, stdout, stderr);
                    });
                break;
            case "restart":
                this.restartMM();
                self.sendSocketNotification("RESTART");
                /* Old Method Below:
                exec("pm2 restart mm", opts, (error, stdout, stderr) => {
                    console.log("Restarting MagicMirror via pm2...");
                    self.sendSocketNotification("RESTART");
                    self.checkForExecError(error, stdout, stderr);
                }); */
                break;
            case "stop" :
                this.stopMM();
                self.sendSocketNotification("STOP");
                break;
            case "shutdown":
                exec("sudo shutdown -h now", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                break;
            case "reboot":
                exec("sudo shutdown -r now", opts, (error, stdout, stderr) => { self.checkForExecError(error, stdout, stderr); });
                break;
            case "minimize":
                win = require("electron").BrowserWindow.getFocusedWindow();
                win.minimize();
                break;
            case "toggleFullscreen":
                win = require("electron").BrowserWindow.getFocusedWindow();
                win.setFullScreen(!win.isFullScreen());
                break;
            case "openDevTools":
                win = require("electron").BrowserWindow.getFocusedWindow();
                win.webContents.openDevTools();
                break;
            default:
                // Should never get here, but OK:
                console.log(`MMM-OnScreenMenu Helper received request to process a ${payload} event
                                but there is no handler for this action.`);
        }
    },

    // Override socketNotificationReceived method.

    /* socketNotificationReceived(notification, payload)
     * This method is called when a socket notification arrives.
     *
     * argument notification string - The identifier of the noitication.
     * argument payload mixed - The payload of the notification.
     */
    socketNotificationReceived: function(notification, payload) {
        var self = this;
        if (notification === 'CONFIG') {
            if (!this.started) {
                this.config = payload;
                this.started = true;
            }
            this.sendSocketNotification("STARTED", payload.name);
        }
        if (notification === "PROCESS_ACTION") {
            this.processAction(payload);
        }
    },

    checkForExecError: function(error, stdout, stderr) {
        if (stderr) {
            console.log('stderr: "' + stderr + '"');
            return 1;
        }
        if (error !== null) {
            console.log('exec error: ' + error);
            return 1;
        }
        return 0;
    },

    stopMM: function() {
        var pm2 = require('pm2');

        pm2.connect((err) => {
            if (err) {
                console.error(err);
            }

            console.log("Stopping PM2 process: " + this.config.pm2ProcessName);
            pm2.stop(this.config.pm2ProcessName, function(err, apps) {
                pm2.disconnect();
                if (err) { console.log(err); }
            });
        });
    },

    restartMM: function() {
        var pm2 = require('pm2');

        pm2.connect((err) => {
            if (err) {
                console.error(err);
            }

            console.log("Restarting PM2 process: " + this.config.pm2ProcessName);
            pm2.restart(this.config.pm2ProcessName, function(err, apps) {
                pm2.disconnect();
                if (err) { console.log(err); }
            });
        });
    },
});
