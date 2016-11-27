"use strict";

/*
*   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
*
*   This program is free software; you can redistribute it and/or
*   modify it under the terms of the GNU Lesser General Public
*   License as published by the Free Software Foundation, either
*   version 3 of the License, or (at your option) any later version.
*
*   This program is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
*   Lesser General Public License for more details.
*
*   You should have received a copy of the GNU Lesser General Public
*   License along with this program; if not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Interface for the Spark Core module
 * @constructor
 */
var Constructor = function Constructor() {};

Constructor.prototype = {
    classname: "ISparkCore",
    socket: null,

    startupProtocol: function startupProtocol() {
        this.handshake(this.hello, this.disconnect);
    },

    handshake: function handshake(onSuccess, onFail) {
        throw new Error("Not yet implemented");
    },
    hello: function hello(onSuccess, onFail) {
        throw new Error("Not yet implemented");
    },
    disconnect: function disconnect() {
        throw new Error("Not yet implemented");
    },

    /**
     * Connect to API
     */
    onApiMessage: function onApiMessage(sender, msg) {
        throw new Error("Not yet implemented");
    },

    /**
     * Connect to API
     */
    sendApiResponse: function sendApiResponse(sender, msg) {
        throw new Error("Not yet implemented");
    },

    foo: null
};
module.exports = Constructor;