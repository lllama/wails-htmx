/*
Wails Extension
============================
This extension adds support for Wails functions to htmx.
Based off the htmx websocket and SSE extensions.
*/

(function(){

    /** @type {import("../htmx").HtmxInternalApi} */
    let api;

    htmx.defineExtension("wails", {
        /**
         * Init saves the provided reference to the internal HTMX API.
         * 
         * @param {import("../htmx").HtmxInternalApi} api 
         * @returns void
         */
        init: function(apiRef) {
            // store a reference to the internal API.
            api = apiRef;
        },

        /**
         * onEvent handles all events passed to this extension.
         * 
         * @param {string} name 
         * @param {Event} evt 
         * @returns void
         */
        onEvent: function(name, evt) {
            switch (name) {
                case "htmx:afterProcessNode":
                    addWailsHandlers(evt.target);
            }
        }
    });

    /**
     * addWailsHandlers adds the handlers for the Wails events from the backend
     * and for emitting events to the backend
     */
    function addWailsHandlers(elt, retryCount) {

        if (elt == null) {
            return null;
        }

        const internalData = api.getInternalData(elt);

        // Add event handlers for every `wails-on` attribute
        for (const child of queryAttributeOnThisOrChildren(elt, "wails-on")) {

            const wailsOnAttribute = api.getAttributeValue(child, "wails-on");
            const wailsEventNames = wailsOnAttribute.split(",");

            for (let i = 0 ; i < wailsEventNames.length ; i++) {
                const wailsEventName = wailsEventNames[i].trim();
                const listener = function(event) {
                    // swap the response into the DOM and trigger a notification
                    swap(child, event);
                    api.triggerEvent(elt, "htmx:wailsMessage", event);
                };

                window.runtime.EventsOn(wailsEventName, listener);

                // Register the new listener
                api.getInternalData(elt).wailsEventListener = listener;
            }
        }

        for (const child of queryAttributeOnThisOrChildren(elt, "wails-emit")) {

            const wailsEvent = api.getAttributeValue(child, "wails-emit");

            const triggerSpecs = api.getTriggerSpecs(elt)
            const nodeData = api.getInternalData(elt);

            for (const triggerSpec of triggerSpecs) {
                // For "naked" triggers, don't do anything at all
                api.addTriggerHandler(child, triggerSpec, nodeData, function () {
                    const results = api.getInputValues(child, 'POST');
                    const errors = results.errors;
                    const rawParameters = results.values;
                    const expressionVars = api.getExpressionVars(child);
                    const allParameters = api.mergeObjects(rawParameters, expressionVars);
                    const filteredParameters = api.filterValues(allParameters, child);
                    window.runtime.EventsEmit(wailsEvent, filteredParameters)
                })
            }
        }

        for (const child of queryAttributeOnThisOrChildren(elt, "wails-call")) {

            const wailsEvent = api.getAttributeValue(child, "wails-call");

            let struct = "App"
            let method = ""


            if (wailsEvent.indexOf(":") >= 0) {
                [struct, method] = wailsEvent.split(":", 2)
            } else {
                method = wailsEvent
            }

            const triggerSpecs = api.getTriggerSpecs(child)
            const nodeData = api.getInternalData(child)

            const myMethod = function(arg1) {return window.go.main[struct][method](arg1)}

            for (const triggerSpec of triggerSpecs) {
                api.addTriggerHandler(child, triggerSpec, nodeData, function () {
                    const results = api.getInputValues(child, 'POST')
                    const errors = results.errors
                    const rawParameters = results.values
                    const expressionVars = api.getExpressionVars(child)
                    const allParameters = api.mergeObjects(rawParameters, expressionVars)
                    const filteredParameters = api.filterValues(allParameters, child)
                    myMethod(filteredParameters).then((res) => {
                        swap(child, res)
                    })
                })
            }
        }

        // Add message handlers for every `hx-trigger="wails:*"` attribute
        for (const child of queryAttributeOnThisOrChildren(elt, "hx-trigger")) {

            const wailsEventName = api.getAttributeValue(child, "hx-trigger");
            if (wailsEventName == null) {
                return;
            }

            // Only process hx-triggers for events with the "wails:" prefix
            if (wailsEventName.slice(0, 5) !== "wails:") {
                return;
            }

            const listener = function(event) {

                // Trigger events to be handled by the rest of htmx
                htmx.trigger(child, wailsEventName, event);
                htmx.trigger(child, "htmx:wailsMessage", event);
            }

            // Register the new listener
            api.getInternalData(elt).wailsEventListener = listener;
        }
    }

    /**
     * queryAttributeOnThisOrChildren returns all nodes that contain the requested attributeName, INCLUDING THE PROVIDED ROOT ELEMENT.
     * 
     * @param {HTMLElement} elt 
     * @param {string} attributeName 
     */
    function queryAttributeOnThisOrChildren(elt, attributeName) {

        const result = [];

        // If the parent element also contains the requested attribute, then add it to the results too.
        if (api.hasAttribute(elt, attributeName)) {
            result.push(elt);
        }

        // Search all child nodes that match the requested attribute
        for (const node of elt.querySelectorAll(`[${attributeName}], [data-${attributeName}]`)) {
            result.push(node);
        }

        return result;
    }

    /**
     * @param {HTMLElement} elt
     * @param {string} content 
     */
    function swap(elt, content) {

        let myContent

        api.withExtensions(elt, function(extension) {
            myContent = extension.transformResponse(content, null, elt);
        });

        const swapSpec = api.getSwapSpecification(elt);
        const target = api.getTarget(elt);
        const settleInfo = api.makeSettleInfo(elt);

        if (typeof(api.selectAndSwap) === "function") {
            // htmx version 1.x
            api.selectAndSwap(swapSpec.swapStyle, target, elt, myContent, settleInfo);
        } else {
            api.swap(target, myContent, swapSpec);
        }

        for (const elt of settleInfo.elts) {
            if (elt.classList) {
                elt.classList.add(htmx.config.settlingClass);
            }
            api.triggerEvent(elt, 'htmx:beforeSettle');
        }

        // Handle settle tasks (with delay if requested)
        if (swapSpec.settleDelay > 0) {
            setTimeout(doSettle(settleInfo), swapSpec.settleDelay);
        } else {
            doSettle(settleInfo)();
        }
    }

    /**
     * doSettle mirrors much of the functionality in htmx that 
     * settles elements after their content has been swapped.
     * TODO: this should be published by htmx, and not duplicated here
     * @param {import("../htmx").HtmxSettleInfo} settleInfo 
     * @returns () => void
     */
    function doSettle(settleInfo) {

        return function() {
            for (const task of settleInfo.tasks) {
                task.call();
            }

            for (const elt of settleInfo.elts) {
                if (elt.classList) {
                    elt.classList.remove(htmx.config.settlingClass);
                }
                api.triggerEvent(elt, 'htmx:afterSettle');
            };
        }
    }
})()

