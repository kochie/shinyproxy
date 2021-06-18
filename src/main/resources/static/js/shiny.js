// noinspection ES6ConvertVarToLetConst

/*
 * ShinyProxy
 *
 * Copyright (C) 2016-2021 Open Analytics
 *
 * ===========================================================================
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Apache License as published by
 * The Apache Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * Apache License for more details.
 *
 * You should have received a copy of the Apache License
 * along with this program.  If not, see <http://www.apache.org/licenses/>
 */
function ErrorHandlingWebSocket(url, protocols) {
    console.log("Called ErrorHandlingWebSocket");
    var res = new WebSocket(url, protocols);

    function handler() {
        console.log("Handling error of websocket connection.")
        setTimeout(Shiny.handleWebSocketError, 1); // execute async to not block other error handling code
    }

    res.addEventListener("error", function (event) {
        handler();
    });

    res.addEventListener("close", function (event) {
        if (!event.wasClean) {
            handler();
        }
    });

    Shiny.websocketConnections.push(res);

    return res;
}

ErrorHandlingWebSocket.prototype = WebSocket.prototype;


window.Shiny = {

    navigatingAway: false,
    proxyId: null,
    appName: null,
    appInstanceName: null,
    reloaded: false,
    containerPath: null,
    webSocketReconnectionMode: null,
    injectorIntervalId: null,
    appWasLoaded: false,
    tryingToReconnect: false,
    reloadAttempts: 0,
    maxReloadAttempts: 10,
    reloadDismissed: false,
    updateSecondsIntervalId: null,
    heartBeatRate: null,
    websocketConnections: [],
    lastHeartbeatTime: null,
    contextPath: null,
    appStopped: false,

    /**
     * Determines whether this is a Shiny app.
     */
    isShiny: function () {
        try {
            var _shinyFrame = document.getElementById('shinyframe');
            if (typeof _shinyFrame.contentWindow.Shiny !== 'undefined' &&
                typeof _shinyFrame.contentWindow.Shiny.shinyapp !== 'undefined' &&
                typeof _shinyFrame.contentWindow.Shiny.shinyapp.reconnect === 'function') {
                return true;
            }
        } catch (error) {

        }
        return false;
    },

    /**
     * Handles a WebSocket error (i.e. close).
     */
    handleWebSocketError: function () {
        if (Shiny.navigatingAway) {
            return;
        }
        if (Shiny.tryingToReconnect) {
            // ignore error
            return;
        }
        if (Shiny.webSocketReconnectionMode === "None") {
            // ignore error
            return;
        }
        if (Shiny.reloadDismissed) {
            // user already dismissed confirmation -> do not ask again
            return;
        }
        if (Shiny.appStopped) {
            // app has been stopped -> no need to reconnect
            return;
        }

        // Check if the app has been stopped by another tab
        Shiny.checkAppHasBeenStopped(function (isStopped) {
            if (isStopped) {
                // app was stopped, show stopped screen
                Shiny.onProxyStopped();
                return;
            }
            if (Shiny.webSocketReconnectionMode === "Auto"
                || (Shiny.webSocketReconnectionMode === "Confirm"
                    && confirm("Connection to server lost, try to reconnect to the application?"))
            ) {
                Shiny.reloadPage();
            } else {
                Shiny.reloadDismissed = true;
            }

        });

    },

    /**
     * Effectively reloads the application.
     */
    reloadPage: function () {

        if (Shiny.reloadAttempts === Shiny.maxReloadAttempts) {
            // reload full page
            if (confirm("Cannot restore connection server, reload full page?")) {
                window.location.reload();
                return;
            }
            Shiny.showFailedToReloadPage(); // show app again
            return;  // give up
        }

        var _shinyFrame = document.getElementById('shinyframe');
        Shiny.tryingToReconnect = true;
        Shiny.showLoading();
        Shiny.reloadAttempts++;
        Shiny.updateLoadingTxt();
        if (Shiny.isShiny()) {
            setTimeout(() => {
                if (!_shinyFrame.contentWindow.Shiny.shinyapp.isConnected()) {
                    _shinyFrame.contentWindow.Shiny.shinyapp.reconnect();
                }
                Shiny.checkShinyReloadSucceeded();
            }, 50);
        } else {
            $("#shinyframe").remove();
            Shiny.setupIframe();
            Shiny.setShinyFrameHeight();
            Shiny.checkReloadSucceeded();
        }
    },

    /**
     * Reloads the page, after X seconds. X is the current amount of reload attempts.
     * Therefore, there will be more time between each attempt to reload the page, creating a backoff mechanism.
     * If the Shiny.maxReloadAttempts is reached, the user will be asked whether they want to perform a full reload.
     */
    reloadPageBackOff: function () {
        console.log("[Reload attempt " + Shiny.reloadAttempts + "/" + Shiny.maxReloadAttempts + "] Reload not succeeded, trying to reload again in " + Shiny.reloadAttempts + " seconds.");
        setTimeout(Shiny.reloadPage, 1000 * Shiny.reloadAttempts);
    },

    /**
     * Check whether the iframe contains the message that ShinyProxy is starting up.
     * If this the case, the iframe looks like it has properly loaded, however, the iframe just contains a message
     * and not the appropriate app.
     */
    checkIfIframeHasStartupMessage: function () {
        try {
            var _shinyFrame = document.getElementById('shinyframe');
            return (_shinyFrame.contentDocument.documentElement.textContent || _shinyFrame.contentDocument.documentElement.innerText).indexOf('ShinyProxy is starting up') > -1;
        } catch {
        }
        return false;
    },

    /**
     * Checks whether the reload of the application was a success.
     * This is checked 10 times with 250ms between each check.
     * If after 10 checks the app isn't loaded yet, the application is reloaded using Shiny.reloadPageBackOff().
     */
    checkReloadSucceeded: function (checks = 0) {
        var completed = document.getElementById('shinyframe').contentDocument !== null
            && document.getElementById('shinyframe').contentDocument.readyState === "complete"
            && document.getElementById('shinyframe').contentDocument.baseURI !== "about:blank"
            && !Shiny.checkIfIframeHasStartupMessage();

        if (completed) {
            // we're ok
            Shiny.hideLoading();
            Shiny.tryingToReconnect = false;
            Shiny.reloadAttempts = 0;
            return;
        }

        if (checks === 10) {
            Shiny.reloadPageBackOff();
            return;
        }

        // re-check in 250 ms, in total the page has 2.5 seconds to complete reloading
        setTimeout(() => Shiny.checkReloadSucceeded(checks + 1), 250);
    },

    /**
     * Checks whether the reload of the application was a success in case this is a Shiny app.
     * This is checked 19 times with 250ms between each check.
     * If after 10 checks the app isn't loaded yet, the application is reloaded using Shiny.reloadPageBackOff().
     */
    checkShinyReloadSucceeded: function (checks = 0) {
        var _shinyFrame = document.getElementById('shinyframe');
        if (_shinyFrame.contentWindow.Shiny.shinyapp.$socket !== null && _shinyFrame.contentWindow.Shiny.shinyapp.$socket.readyState === WebSocket.OPEN) {
            Shiny.hideLoading();
            Shiny.tryingToReconnect = false;
            Shiny.reloadAttempts = 0;
            return;
        }

        if (checks === 10) {
            Shiny.reloadPageBackOff();
            return;
        }

        setTimeout(() => Shiny.checkShinyReloadSucceeded(checks + 1), 250);
    },

    /**
     * Injects the ErrorHandlingWebSocket into the iframe.
     */
    injectWebSocket: function () {
        var shinyWindow = document.getElementById('shinyframe').contentWindow;
        var shinySubFrames = shinyWindow.document.querySelectorAll("iframe");

        shinyWindow.WebSocket = ErrorHandlingWebSocket;
        shinySubFrames.forEach(d => d.contentWindow.document.WebSocket = ErrorHandlingWebSocket);

        Shiny.replaceOpen(shinyWindow.XMLHttpRequest.prototype);
        shinySubFrames.forEach(d => Shiny.replaceOpen(d.contentWindow.XMLHttpRequest.prototype));

        Shiny.replaceFetch(shinyWindow);
        shinySubFrames.forEach(d => Shiny.replaceFetch(d.contentWindow));
    },

    /**
     * Starts the injection of the ErrorHandlingWebSocket into the iframe.
     * The idea is to poll the iframe every 50ms for its readyState. If the readyState has changed from something
     * different than `complete` to `complete` we know that the injection was successful.
     *
     * The goal is to inject between the `interactive` and `DOMContentLoaded` states.
     * Unfortunately, there is no event generated by the browser which we could use. Therefore we have to fallback to
     * a polling approach.
     *
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/readystatechange_event
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState
     */
    startInjector: function () {
        if (Shiny.injectorIntervalId !== null) {
            Shiny.stopInjector();
        }

        var replaced = false;
        Shiny.injectorIntervalId = setInterval(function () {
            try {
                var state = document.getElementById('shinyframe').contentWindow.document.readyState
            } catch {
                return;
            }
            if (replaced && state === "complete") {
                // ok
                Shiny.stopInjector();
            } else if (state !== "complete") {
                Shiny.injectWebSocket();
                replaced = true;
            }
        }, 50);
    },

    /**
     * Stops the Injector.
     */
    stopInjector: function () {
        clearInterval(Shiny.injectorIntervalId);
    },

    /***
     * Setups the iframe of the application.
     */
    setupIframe: function () {
        var $iframe = $('<iframe id="shinyframe" width="100%" style="display:none;" frameBorder="0"></iframe>')
        // IMPORTANT: start the injector before setting the `src` property of the iframe
        // This is required to ensure that the polling catches all events and therefore the injector works properly.
        Shiny.startInjector();
        $iframe.attr("src", Shiny.containerPath);
        $('#iframeinsert').before($iframe); // insert the iframe into the HTML.
        Shiny.setShinyFrameHeight();
    },

    /**
     * Shows the loading page.
     * If the application already has loaded, the message will contains `Reconnecting` instead of `Launching`.
     */
    showLoading: function () {
        $('#shinyframe').hide();
        if (!Shiny.appWasLoaded) {
            $("#loading").show();
        } else {
            $("#reconnecting").show();
        }
    },

    /**
     *  Hides the loading page.
     */
    hideLoading: function () {
        $('#shinyframe').show();
        if (!Shiny.appWasLoaded) {
            $("#loading").fadeOut("slow");
        } else {
            $("#reconnecting").fadeOut("slow");
        }
    },

    /**
     * Start the Shiny Application.
     * @param containerPath
     * @param webSocketReconnectionMode
     * @param proxyId
     * @param heartBeatRate
     * @param contextPath
     * @param appName
     * @param appInstanceName
     */
    start: function (containerPath, webSocketReconnectionMode, proxyId, heartBeatRate, contextPath, appName, appInstanceName) {
        Shiny.heartBeatRate = heartBeatRate;
        Shiny.contextPath = contextPath;
        Shiny.appName = appName;
        Shiny.appInstanceName = appInstanceName;
        Shiny.instancesModal.template = Handlebars.templates['switch_instances'];
        if (containerPath === "") {
            Shiny.setShinyFrameHeight();
            Shiny.showLoading();
            $.post(window.location.pathname + window.location.search, function (response) {
                Shiny.containerPath = response.containerPath;
                Shiny.webSocketReconnectionMode = response.webSocketReconnectionMode;
                Shiny.proxyId = response.proxyId;
                Shiny.setupIframe();
                Shiny.hideLoading();
                Shiny.appWasLoaded = true;
                Shiny.startHeartBeats();
            }).fail(function (request) {
                if (!Shiny.navigatingAway) {
                    var newDoc = document.open("text/html", "replace");
                    newDoc.write(request.responseText);
                    newDoc.close();
                }
            });
        } else {
            Shiny.containerPath = containerPath;
            Shiny.webSocketReconnectionMode = webSocketReconnectionMode;
            Shiny.proxyId = proxyId;
            Shiny.setupIframe();
            Shiny.hideLoading();
            Shiny.appWasLoaded = true;
            Shiny.startHeartBeats();
        }
    },

    /**
     * Update the frame height.
     */
    setShinyFrameHeight: function () {
        $('#shinyframe').css('height', ($(window).height()) + 'px');
    },

    updateLoadingTxt: function () {
        if (Shiny.updateSecondsIntervalId !== null) {
            clearInterval(Shiny.updateSecondsIntervalId);
        }

        function updateSeconds(seconds) {
            if (seconds < 0) {
                clearInterval(Shiny.updateSecondsIntervalId);
                return;
            }
            if (seconds === 0) {
                $('#retryInXSeconds').hide();
                $('#retryNow').show();
            } else {
                $('#retryNow').hide();
                $('#retryInXSeconds').show();
                $('.retrySeconds').text(seconds);
            }
        }

        $('.reloadAttempts').text(Shiny.reloadAttempts);
        $('.maxReloadAttempts').text(Shiny.maxReloadAttempts);
        updateSeconds(Shiny.reloadAttempts);

        var currentSeconds = Shiny.reloadAttempts;
        Shiny.updateSecondsIntervalId = setInterval(() => {
            currentSeconds--;
            updateSeconds(currentSeconds);
        }, 1000);
    },

    showFailedToReloadPage: function () {
        $('#shinyframe').hide();
        $("#loading").hide();
        $("#reconnecting").hide();
        $("#reloadFailed").show();
    },

    /**
     * Starts the process of sending heartbeats. This method is only used as fallback when we cannot piggy-back
     * heartbeats on either a websocket connection or AJAX requests of the Shiny app itself.
     * Therefore heartbeats are only sent when no WebSocket connection is open and when there were no AJAX requests
     * in the last `Shiny.heartBeatRate` milliseconds.
     */
    startHeartBeats: function () {
        setInterval(function () {
            if (!Shiny.webSocketConnectionIsOpen()) {
                var lastHeartbeat = Date.now() - Shiny.lastHeartbeatTime;
                if (lastHeartbeat > Shiny.heartBeatRate && Shiny.proxyId !== null) {

                    // contextPath is guaranteed to end with a slash
                    $.post(Shiny.contextPath + "heartbeat/" + Shiny.proxyId);
                }
            }
        }, Shiny.heartBeatRate);
    },

    checkAppHasBeenStopped: function (cb) {
        $.post(Shiny.contextPath + "heartbeat/" + Shiny.proxyId, function () {
            cb(false);
        }).fail(function (response) {
            var res = JSON.parse(response.responseText);
            if (res !== null && res.status === "error" && res.message === "app_stopped_or_non_existent") {
                cb(true);
                return;
            }

            cb(false);
        });

    },

    /**
     * @returns {boolean} whether at least one WebSocket connection is open
     */
    webSocketConnectionIsOpen: function () {
        for (var idx = 0; idx < Shiny.websocketConnections.length; idx++) {
            if (Shiny.websocketConnections[idx].readyState === WebSocket.OPEN) {
                return true;
            }
        }

        return false;
    },

    /**
     * Replaces the `open` function on the `parent` object by a wrapper function that keeps tracks of the
     * Shiny.lastHeartbeatTime.
     * This can be called on window.XMLHttpRequest.prototype to update the Shiny.lastHeartbeatTime everytime an AJAX
     * request is sent.
     * Note: the only side-effect when a Shiny app would circumvents this function is that more heartbeats than
     * strictly needed are sent.
     * @param parent
     */
    replaceOpen: function (parent) {
        var originalOpen = parent.open;

        parent.open = function () {
            this.addEventListener('load', function () {
                if (this.status === 410) {
                    var res = JSON.parse(this.responseText);
                    if (res !== null && res.status === "error" && res.message === "app_stopped_or_non_existent") {
                        // app stopped
                        Shiny.onProxyStopped();
                    }
                }
            });
            Shiny.lastHeartbeatTime = Date.now();

            return originalOpen.apply(this, arguments);
        }
    },

    /**
     * Replaces the `fetch` function on the `parent` object by a wrapper function that keeps tracks of the
     * Shiny.lastHeartbeatTime.
     * This can be called on window.fetch to update the Shiny.lastHeartbeatTime everytime a fetch
     * request is sent.
     * Note: the only side-effect when a Shiny app would circumvents this function is that more heartbeats than
     * strictly needed are sent.
     * @param parent
     */
    replaceFetch: function (parent) {
        var originalFetch = parent.fetch;

        parent.fetch = function () {
            Shiny.lastHeartbeatTime = Date.now();

            return new Promise((resolve, reject) => {
                originalFetch.apply(this, arguments)
                    .then((response) => {
                        if (response.status === 410) {
                            response.clone().json().then(function(clonedResponse) {
                                if (clonedResponse.status === "error" && clonedResponse.message === "app_stopped_or_non_existent") {
                                    Shiny.onProxyStopped();
                                }
                            });
                        }
                        resolve(response);
                    })
                    .catch((error) => {
                        reject(error);
                    })
            });
        }
    },

    api: {
        getProxies: function (cb) {
            $.get(Shiny.contextPath + "api/proxy", function (proxies) {
                cb(proxies);
            }).fail(function (request) {
                // TODO
            });
        },
        deleteProxy: function (cb) {
            Shiny.api.deleteProxyById(Shiny.proxyId, cb);
        },
        deleteProxyById: function (id, cb) {
            $.ajax({
                url: Shiny.contextPath + "api/proxy/" + id,
                type: 'DELETE',
                success: cb,
                error: function (result) {
                    // TODO
                }
            });
        },
        getProxyId: function (appName, instanceName, cb) {
            Shiny.api.getProxies(function (proxies) {
                for (var i = 0; i < proxies.length; i++) {
                    // TODO check if properties exists
                    if (proxies[i].spec.id === appName && proxies[i].runtimeValues.SHINYPROXY_APP_INSTANCE === instanceName) {
                        cb(proxies[i].id);
                        return;
                    }
                }
                cb(null);
            });
        }
    },

    onProxyStopped: function () {
        $('#shinyframe').remove();
        $('#switchInstancesModal').modal('hide')
        $('#appStopped').show();
    },

    instancesModal: {
        template: null,
        nameRegex: new RegExp('^[a-zA-Z0-9_.-]*$'),
        onShow: function () {
            Shiny.api.getProxies(function (proxies) {
                var templateData = {'instances': []};

                for (var idx = 0; idx < proxies.length; idx++) {
                    var proxy = proxies[idx];

                    if (proxy.hasOwnProperty('spec') && proxy.spec.hasOwnProperty('id') &&
                        proxy.hasOwnProperty('runtimeValues') && proxy.runtimeValues.hasOwnProperty('SHINYPROXY_APP_INSTANCE')) {

                        var appInstance = proxy.runtimeValues.SHINYPROXY_APP_INSTANCE;
                        if (proxy.spec.id !== Shiny.appName) {
                            continue;
                        }

                        if (proxy.status !== "Up" && proxy.status !== "Starting" && proxy.status !== "New") {
                            continue;
                        }

                        var proxyName = ""
                        if (appInstance === "_") {
                            proxyName = "Default";
                        } else {
                            proxyName = appInstance;
                        }

                        var active = Shiny.appInstanceName === appInstance;
                        var url = Shiny.instancesModal.createUrlForInstance(appInstance);

                        templateData['instances'].push({name: proxyName, active: active, url: url});
                    } else {
                        console.log("Received invalid proxy object from server.");
                    }
                }

                templateData['instances'].sort(function (a, b) {
                    return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
                });

                document.getElementById('appInstances').innerHTML = Shiny.instancesModal.template(templateData);
            });
        },
        createUrlForInstance: function (instance) {
            return Shiny.contextPath + "app/" + Shiny.appName + "/" + instance + "/";
        },
        newInstance: function () {
            var inputField = $("#instanceNameField");
            var instance = inputField.val().trim();

            if (instance === "") {
                return;
            }

            if (instance.length > 64) {
                alert("The provide name is too long (maximum 64 characters)");
                return;
            }

            if (!Shiny.instancesModal.nameRegex.test(instance)) {
                alert("The provide name contains invalid characters (ony alphanumeric characters, '_', '-' and '.' are allowed.)");
                return;
            }

            if (instance === Shiny.appInstanceName) {
                alert("This instance is already opened in the current tab");
                return;
            }

            window.open(Shiny.instancesModal.createUrlForInstance(instance), "_blank");
            inputField.val('');
            $('#switchInstancesModal').modal('hide')
        },
        onDeleteInstance: function (instanceName) {
            if (instanceName === Shiny.appInstanceName) {
                Shiny.appStopped = true;
                $('#shinyframe').remove();
            }
            if (instanceName === "Default") {
                instanceName = "_";
            }
            Shiny.api.getProxyId(Shiny.appName, instanceName, function (proxyId) {
                Shiny.api.deleteProxyById(proxyId, function () {
                    if (instanceName === Shiny.appInstanceName) {
                        Shiny.onProxyStopped();
                    }
                });
            });
        }
    }
}


window.onbeforeunload = function (e) {
    window.Shiny.navigatingAway = true;
};
window.addEventListener("load", Shiny.setShinyFrameHeight);
window.addEventListener("resize", Shiny.setShinyFrameHeight);
window.addEventListener("load", function () {
    $('#switchInstancesModal-btn').click(function () {
        Shiny.instancesModal.onShow();
    });
    $('#newInstanceForm').submit(function (e) {
        e.preventDefault();
        Shiny.instancesModal.newInstance();
    });
});

$(window).on('load', function () {
    $('#switchInstancesModal').on('shown.bs.modal', function () {
        console.log('on modal show');
        setTimeout(function () {
            $("#instanceNameField").focus();
        }, 10);
    });
});