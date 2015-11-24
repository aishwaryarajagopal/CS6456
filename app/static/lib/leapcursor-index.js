(function(e, t, n) {
    function i(n, s) {
        if (!t[n]) {
            if (!e[n]) {
                var o = typeof require == "function" && require;
                if (!s && o) {
                    return o(n, !0);
                }
                if (r) {
                    return r(n, !0);
                }
                throw new Error("Cannot find module '" + n + "'");
            }
            var u = t[n] = {
                exports: {}
            };
            e[n][0].call(u.exports, function(t) {
                var r = e[n][1][t];
                return i(r ? r : t);
            }, u, u.exports);
        }
        return t[n].exports;
    }
    var r = typeof require == "function" && require;
    for (var s = 0; s < n.length; s++) {
        i(n[s]);
    }
    return i;
})({
    1: [function(require, module, exports) {
        var chooseProtocol = require("./protocol").chooseProtocol,
            EventEmitter = require("events").EventEmitter,
            _ = require("underscore");
        var BaseConnection = module.exports = function(opts) {
            this.opts = _.defaults(opts || {}, {
                host: "127.0.0.1",
                enableGestures: false,
                port: 6437,
                enableHeartbeat: true,
                heartbeatInterval: 100,
                requestProtocolVersion: 3
            });
            this.host = this.opts.host;
            this.port = this.opts.port;
            this.on("ready", function() {
                this.enableGestures(this.opts.enableGestures);
                if (this.opts.enableHeartbeat) {
                    this.startHeartbeat();
                }
            });
            this.on("disconnect", function() {
                if (this.opts.enableHeartbeat) {
                    this.stopHeartbeat();
                }
            });
            this.heartbeatTimer = null;
        };
        BaseConnection.prototype.getUrl = function() {
            return "ws://" + this.host + ":" + this.port + "/v" + this.opts.requestProtocolVersion + ".json";
        };
        BaseConnection.prototype.sendHeartbeat = function() {
            if (this.protocol) {
                this.setHeartbeatState(true);
                this.protocol.sendHeartbeat(this);
            }
        };
        BaseConnection.prototype.handleOpen = function() {
            this.emit("connect");
        };
        BaseConnection.prototype.enableGestures = function(enabled) {
            this.gesturesEnabled = enabled ? true : false;
            this.send(this.protocol.encode({
                "enableGestures": this.gesturesEnabled
            }));
        };
        BaseConnection.prototype.handleClose = function() {
            this.disconnect();
            this.startReconnection();
        };
        BaseConnection.prototype.startReconnection = function() {
            var connection = this;
            setTimeout(function() {
                connection.connect();
            }, 1000);
        };
        BaseConnection.prototype.disconnect = function() {
            if (!this.socket) {
                return;
            }
            this.socket.close();
            delete this.socket;
            delete this.protocol;
            this.emit("disconnect");
        };
        BaseConnection.prototype.handleData = function(data) {
            var message = JSON.parse(data);
            var messageEvent;
            if (this.protocol === undefined) {
                messageEvent = this.protocol = chooseProtocol(message);
                this.emit("ready");
            } else {
                messageEvent = this.protocol(message);
            }
            this.emit(messageEvent.type, messageEvent);
        };
        BaseConnection.prototype.connect = function() {
            if (this.socket) {
                return;
            }
            this.socket = this.setupSocket();
            return true;
        };
        BaseConnection.prototype.send = function(data) {
            this.socket.send(data);
        };
        BaseConnection.prototype.stopHeartbeat = function() {
            if (!this.heartbeatTimer) {
                return;
            }
            clearInterval(this.heartbeatTimer);
            delete this.heartbeatTimer;
            this.setHeartbeatState(false);
        };
        BaseConnection.prototype.setHeartbeatState = function(state) {
            if (this.heartbeatState === state) {
                return;
            }
            this.heartbeatState = state;
            this.emit(this.heartbeatState ? "focus" : "blur");
        };
        _.extend(BaseConnection.prototype, EventEmitter.prototype);
    }, {
        "./protocol": 12,
        "events": 17,
        "underscore": 20
    }],
    2: [function(require, module, exports) {
        var CircularBuffer = module.exports = function(size) {
            this.pos = 0;
            this._buf = [];
            this.size = size;
        };
        CircularBuffer.prototype.get = function(i) {
            if (i == undefined) {
                i = 0;
            }
            if (i >= this.size) {
                return undefined;
            }
            if (i >= this._buf.length) {
                return undefined;
            }
            return this._buf[(this.pos - i - 1) % this.size];
        };
        CircularBuffer.prototype.push = function(o) {
            this._buf[this.pos % this.size] = o;
            return this.pos++;
        };
    }, {}],
    3: [function(require, module, exports) {
        var Connection = module.exports = require("./base_connection");
        Connection.prototype.setupSocket = function() {
            var connection = this;
            var socket = new WebSocket(this.getUrl());
            socket.onopen = function() {
                connection.handleOpen();
            };
            socket.onmessage = function(message) {
                connection.handleData(message.data);
            };
            socket.onclose = function() {
                connection.handleClose();
            };
            return socket;
        };
        Connection.prototype.startHeartbeat = function() {
            if (!this.protocol.sendHeartbeat || this.heartbeatTimer) {
                return;
            }
            var connection = this;
            var propertyName = null;
            if (typeof document.hidden !== "undefined") {
                propertyName = "hidden";
            } else {
                if (typeof document.mozHidden !== "undefined") {
                    propertyName = "mozHidden";
                } else {
                    if (typeof document.msHidden !== "undefined") {
                        propertyName = "msHidden";
                    } else {
                        if (typeof document.webkitHidden !== "undefined") {
                            propertyName = "webkitHidden";
                        } else {
                            propertyName = undefined;
                        }
                    }
                }
            }
            var windowVisible = true;
            var focusListener = window.addEventListener("focus", function(e) {
                windowVisible = true;
            });
            var blurListener = window.addEventListener("blur", function(e) {
                windowVisible = false;
            });
            this.on("disconnect", function() {
                if (connection.heartbeatTimer) {
                    clearTimeout(connection.heartbeatTimer);
                    delete connection.heartbeatTimer;
                }
                window.removeEventListener(focusListener);
                window.removeEventListener(blurListener);
            });
            this.heartbeatTimer = setInterval(function() {
                var isVisible = propertyName === undefined ? true : document[propertyName] === false;
                if (isVisible && windowVisible) {
                    connection.sendHeartbeat();
                } else {
                    connection.setHeartbeatState(false);
                }
            }, this.opts.heartbeatInterval);
        };
    }, {
        "./base_connection": 1
    }],
    4: [function(require, module, exports) {
        (function(process) {
            var Frame = require("./frame"),
                CircularBuffer = require("./circular_buffer"),
                Pipeline = require("./pipeline"),
                EventEmitter = require("events").EventEmitter,
                gestureListener = require("./gesture").gestureListener,
                _ = require("underscore");
            var Controller = module.exports = function(opts) {
                var inNode = typeof(process) !== "undefined" && process.title === "node";
                opts = _.defaults(opts || {}, {
                    inNode: inNode
                });
                this.inNode = opts.inNode;
                opts = _.defaults(opts || {}, {
                    frameEventName: this.useAnimationLoop() ? "animationFrame" : "deviceFrame",
                    supressAnimationLoop: false,
                });
                this.supressAnimationLoop = opts.supressAnimationLoop;
                this.frameEventName = opts.frameEventName;
                this.history = new CircularBuffer(200);
                this.lastFrame = Frame.Invalid;
                this.lastValidFrame = Frame.Invalid;
                this.lastConnectionFrame = Frame.Invalid;
                this.accumulatedGestures = [];
                if (opts.connectionType === undefined) {
                    this.connectionType = (this.inBrowser() ? require("./connection") : require("./node_connection"));
                } else {
                    this.connectionType = opts.connectionType;
                }
                this.connection = new this.connectionType(opts);
                this.setupConnectionEvents();
            };
            Controller.prototype.gesture = function(type, cb) {
                var creator = gestureListener(this, type);
                if (cb !== undefined) {
                    creator.stop(cb);
                }
                return creator;
            };
            Controller.prototype.inBrowser = function() {
                return !this.inNode;
            };
            Controller.prototype.useAnimationLoop = function() {
                return this.inBrowser() && typeof(chrome) === "undefined";
            };
            Controller.prototype.connect = function() {
                var controller = this;
                if (this.connection.connect() && this.inBrowser() && !controller.supressAnimationLoop) {
                    var callback = function() {
                        controller.emit("animationFrame", controller.lastConnectionFrame);
                        window.requestAnimFrame(callback);
                    };
                    window.requestAnimFrame(callback);
                }
            };
            Controller.prototype.disconnect = function() {
                this.connection.disconnect();
            };
            Controller.prototype.frame = function(num) {
                return this.history.get(num) || Frame.Invalid;
            };
            Controller.prototype.loop = function(callback) {
                switch (callback.length) {
                    case 1:
                        this.on(this.frameEventName, callback);
                        break;
                    case 2:
                        var controller = this;
                        var scheduler = null;
                        var immediateRunnerCallback = function(frame) {
                            callback(frame, function() {
                                if (controller.lastFrame != frame) {
                                    immediateRunnerCallback(controller.lastFrame);
                                } else {
                                    controller.once(controller.frameEventName, immediateRunnerCallback);
                                }
                            });
                        };
                        this.once(this.frameEventName, immediateRunnerCallback);
                        break;
                }
                this.connect();
            };
            Controller.prototype.addStep = function(step) {
                if (!this.pipeline) {
                    this.pipeline = new Pipeline(this);
                }
                this.pipeline.addStep(step);
            };
            Controller.prototype.processFrame = function(frame) {
                if (frame.gestures) {
                    this.accumulatedGestures = this.accumulatedGestures.concat(frame.gestures);
                }
                if (this.pipeline) {
                    frame = this.pipeline.run(frame);
                    if (!frame) {
                        frame = Frame.Invalid;
                    }
                }
                this.lastConnectionFrame = frame;
                this.emit("deviceFrame", frame);
            };
            Controller.prototype.processFinishedFrame = function(frame) {
                this.lastFrame = frame;
                if (frame.valid) {
                    this.lastValidFrame = frame;
                }
                frame.controller = this;
                frame.historyIdx = this.history.push(frame);
                if (frame.gestures) {
                    frame.gestures = this.accumulatedGestures;
                    this.accumulatedGestures = [];
                    for (var gestureIdx = 0; gestureIdx != frame.gestures.length; gestureIdx++) {
                        this.emit("gesture", frame.gestures[gestureIdx], frame);
                    }
                }
                this.emit("frame", frame);
            };
            Controller.prototype.setupConnectionEvents = function() {
                var controller = this;
                this.connection.on("frame", function(frame) {
                    controller.processFrame(frame);
                });
                this.on(this.frameEventName, function(frame) {
                    controller.processFinishedFrame(frame);
                });
                this.connection.on("disconnect", function() {
                    controller.emit("disconnect");
                });
                this.connection.on("ready", function() {
                    controller.emit("ready");
                });
                this.connection.on("connect", function() {
                    controller.emit("connect");
                });
                this.connection.on("focus", function() {
                    controller.emit("focus");
                });
                this.connection.on("blur", function() {
                    controller.emit("blur");
                });
                this.connection.on("protocol", function(protocol) {
                    controller.emit("protocol", protocol);
                });
                this.connection.on("deviceConnect", function(evt) {
                    controller.emit(evt.state ? "deviceConnected" : "deviceDisconnected");
                });
            };
            _.extend(Controller.prototype, EventEmitter.prototype);
        })(require("__browserify_process"));
    }, {
        "./circular_buffer": 2,
        "./connection": 3,
        "./frame": 5,
        "./gesture": 6,
        "./node_connection": 16,
        "./pipeline": 10,
        "__browserify_process": 18,
        "events": 17,
        "underscore": 20
    }],
    5: [function(require, module, exports) {
        var Hand = require("./hand"),
            Pointable = require("./pointable"),
            createGesture = require("./gesture").createGesture,
            glMatrix = require("gl-matrix"),
            mat3 = glMatrix.mat3,
            vec3 = glMatrix.vec3,
            InteractionBox = require("./interaction_box"),
            _ = require("underscore");
        var Frame = module.exports = function(data) {
            this.valid = true;
            this.id = data.id;
            this.timestamp = data.timestamp;
            this.hands = [];
            this.handsMap = {};
            this.pointables = [];
            this.tools = [];
            this.fingers = [];
            if (data.interactionBox) {
                this.interactionBox = new InteractionBox(data.interactionBox);
            }
            this.gestures = [];
            this.pointablesMap = {};
            this._translation = data.t;
            this._rotation = _.flatten(data.r);
            this._scaleFactor = data.s;
            this.data = data;
            this.type = "frame";
            this.currentFrameRate = data.currentFrameRate;
            var handMap = {};
            for (var handIdx = 0, handCount = data.hands.length; handIdx != handCount; handIdx++) {
                var hand = new Hand(data.hands[handIdx]);
                hand.frame = this;
                this.hands.push(hand);
                this.handsMap[hand.id] = hand;
                handMap[hand.id] = handIdx;
            }
            for (var pointableIdx = 0, pointableCount = data.pointables.length; pointableIdx != pointableCount; pointableIdx++) {
                var pointable = new Pointable(data.pointables[pointableIdx]);
                pointable.frame = this;
                this.pointables.push(pointable);
                this.pointablesMap[pointable.id] = pointable;
                (pointable.tool ? this.tools : this.fingers).push(pointable);
                if (pointable.handId !== undefined && handMap.hasOwnProperty(pointable.handId)) {
                    var hand = this.hands[handMap[pointable.handId]];
                    hand.pointables.push(pointable);
                    (pointable.tool ? hand.tools : hand.fingers).push(pointable);
                }
            }
            if (data.gestures) {
                for (var gestureIdx = 0, gestureCount = data.gestures.length; gestureIdx != gestureCount; gestureIdx++) {
                    this.gestures.push(createGesture(data.gestures[gestureIdx]));
                }
            }
        };
        Frame.prototype.tool = function(id) {
            var pointable = this.pointable(id);
            return pointable.tool ? pointable : Pointable.Invalid;
        };
        Frame.prototype.pointable = function(id) {
            return this.pointablesMap[id] || Pointable.Invalid;
        };
        Frame.prototype.finger = function(id) {
            var pointable = this.pointable(id);
            return !pointable.tool ? pointable : Pointable.Invalid;
        };
        Frame.prototype.hand = function(id) {
            return this.handsMap[id] || Hand.Invalid;
        };
        Frame.prototype.rotationAngle = function(sinceFrame, axis) {
            if (!this.valid || !sinceFrame.valid) {
                return 0;
            }
            var rot = this.rotationMatrix(sinceFrame);
            var cs = (rot[0] + rot[4] + rot[8] - 1) * 0.5;
            var angle = Math.acos(cs);
            angle = isNaN(angle) ? 0 : angle;
            if (axis !== undefined) {
                var rotAxis = this.rotationAxis(sinceFrame);
                angle *= vec3.dot(rotAxis, vec3.normalize(vec3.create(), axis));
            }
            return angle;
        };
        Frame.prototype.rotationAxis = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return vec3.create();
            }
            return vec3.normalize(vec3.create(), [this._rotation[7] - sinceFrame._rotation[5], this._rotation[2] - sinceFrame._rotation[6], this._rotation[3] - sinceFrame._rotation[1]]);
        };
        Frame.prototype.rotationMatrix = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return mat3.create();
            }
            var transpose = mat3.transpose(mat3.create(), this._rotation);
            return mat3.multiply(mat3.create(), sinceFrame._rotation, transpose);
        };
        Frame.prototype.scaleFactor = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return 1;
            }
            return Math.exp(this._scaleFactor - sinceFrame._scaleFactor);
        };
        Frame.prototype.translation = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return vec3.create();
            }
            return vec3.subtract(vec3.create(), this._translation, sinceFrame._translation);
        };
        Frame.prototype.toString = function() {
            var str = "Frame [ id:" + this.id + " | timestamp:" + this.timestamp + " | Hand count:(" + this.hands.length + ") | Pointable count:(" + this.pointables.length + ")";
            if (this.gestures) {
                str += " | Gesture count:(" + this.gestures.length + ")";
            }
            str += " ]";
            return str;
        };
        Frame.prototype.dump = function() {
            var out = "";
            out += "Frame Info:<br/>";
            out += this.toString();
            out += "<br/><br/>Hands:<br/>";
            for (var handIdx = 0, handCount = this.hands.length; handIdx != handCount; handIdx++) {
                out += "  " + this.hands[handIdx].toString() + "<br/>";
            }
            out += "<br/><br/>Pointables:<br/>";
            for (var pointableIdx = 0, pointableCount = this.pointables.length; pointableIdx != pointableCount; pointableIdx++) {
                out += "  " + this.pointables[pointableIdx].toString() + "<br/>";
            }
            if (this.gestures) {
                out += "<br/><br/>Gestures:<br/>";
                for (var gestureIdx = 0, gestureCount = this.gestures.length; gestureIdx != gestureCount; gestureIdx++) {
                    out += "  " + this.gestures[gestureIdx].toString() + "<br/>";
                }
            }
            out += "<br/><br/>Raw JSON:<br/>";
            out += JSON.stringify(this.data);
            return out;
        };
        Frame.Invalid = {
            valid: false,
            hands: [],
            fingers: [],
            tools: [],
            gestures: [],
            pointables: [],
            pointable: function() {
                return Pointable.Invalid;
            },
            finger: function() {
                return Pointable.Invalid;
            },
            hand: function() {
                return Hand.Invalid;
            },
            toString: function() {
                return "invalid frame";
            },
            dump: function() {
                return this.toString();
            },
            rotationAngle: function() {
                return 0;
            },
            rotationMatrix: function() {
                return mat3.create();
            },
            rotationAxis: function() {
                return vec3.create();
            },
            scaleFactor: function() {
                return 1;
            },
            translation: function() {
                return vec3.create();
            }
        };
    }, {
        "./gesture": 6,
        "./hand": 7,
        "./interaction_box": 9,
        "./pointable": 11,
        "gl-matrix": 19,
        "underscore": 20
    }],
    6: [function(require, module, exports) {
        var glMatrix = require("gl-matrix"),
            vec3 = glMatrix.vec3,
            EventEmitter = require("events").EventEmitter,
            _ = require("underscore");
        var createGesture = exports.createGesture = function(data) {
            var gesture;
            switch (data.type) {
                case "circle":
                    gesture = new CircleGesture(data);
                    break;
                case "swipe":
                    gesture = new SwipeGesture(data);
                    break;
                case "screenTap":
                    gesture = new ScreenTapGesture(data);
                    break;
                case "keyTap":
                    gesture = new KeyTapGesture(data);
                    break;
                default:
                    throw "unkown gesture type";
            }
            gesture.id = data.id;
            gesture.handIds = data.handIds;
            gesture.pointableIds = data.pointableIds;
            gesture.duration = data.duration;
            gesture.state = data.state;
            gesture.type = data.type;
            return gesture;
        };
        var gestureListener = exports.gestureListener = function(controller, type) {
            var handlers = {};
            var gestureMap = {};
            var gestureCreator = function() {
                var candidateGesture = gestureMap[gesture.id];
                if (candidateGesture !== undefined) {
                    gesture.update(gesture, frame);
                }
                if (gesture.state == "start" || gesture.state == "stop") {
                    if (type == gesture.type && gestureMap[gesture.id] === undefined) {
                        gestureMap[gesture.id] = new Gesture(gesture, frame);
                        gesture.update(gesture, frame);
                    }
                    if (gesture.state == "stop") {
                        delete gestureMap[gesture.id];
                    }
                }
            };
            controller.on("gesture", function(gesture, frame) {
                if (gesture.type == type) {
                    if (gesture.state == "start" || gesture.state == "stop") {
                        if (gestureMap[gesture.id] === undefined) {
                            var gestureTracker = new Gesture(gesture, frame);
                            gestureMap[gesture.id] = gestureTracker;
                            _.each(handlers, function(cb, name) {
                                gestureTracker.on(name, cb);
                            });
                        }
                    }
                    gestureMap[gesture.id].update(gesture, frame);
                    if (gesture.state == "stop") {
                        delete gestureMap[gesture.id];
                    }
                }
            });
            var builder = {
                start: function(cb) {
                    handlers["start"] = cb;
                    return builder;
                },
                stop: function(cb) {
                    handlers["stop"] = cb;
                    return builder;
                },
                complete: function(cb) {
                    handlers["stop"] = cb;
                    return builder;
                },
                update: function(cb) {
                    handlers["update"] = cb;
                    return builder;
                }
            };
            return builder;
        };
        var Gesture = exports.Gesture = function(gesture, frame) {
            this.gestures = [gesture];
            this.frames = [frame];
        };
        Gesture.prototype.update = function(gesture, frame) {
            this.gestures.push(gesture);
            this.frames.push(frame);
            this.emit(gesture.state, this);
        };
        _.extend(Gesture.prototype, EventEmitter.prototype);
        var CircleGesture = function(data) {
            this.center = data.center;
            this.normal = data.normal;
            this.progress = data.progress;
            this.radius = data.radius;
        };
        CircleGesture.prototype.toString = function() {
            return "CircleGesture [" + JSON.stringify(this) + "]";
        };
        var SwipeGesture = function(data) {
            this.startPosition = data.startPosition;
            this.position = data.position;
            this.direction = data.direction;
            this.speed = data.speed;
        };
        SwipeGesture.prototype.toString = function() {
            return "SwipeGesture [" + JSON.stringify(this) + "]";
        };
        var ScreenTapGesture = function(data) {
            this.position = data.position;
            this.direction = data.direction;
            this.progress = data.progress;
        };
        ScreenTapGesture.prototype.toString = function() {
            return "ScreenTapGesture [" + JSON.stringify(this) + "]";
        };
        var KeyTapGesture = function(data) {
            this.position = data.position;
            this.direction = data.direction;
            this.progress = data.progress;
        };
        KeyTapGesture.prototype.toString = function() {
            return "KeyTapGesture [" + JSON.stringify(this) + "]";
        };
    }, {
        "events": 17,
        "gl-matrix": 19,
        "underscore": 20
    }],
    7: [function(require, module, exports) {
        var Pointable = require("./pointable"),
            glMatrix = require("gl-matrix"),
            mat3 = glMatrix.mat3,
            vec3 = glMatrix.vec3,
            _ = require("underscore");
        var Hand = module.exports = function(data) {
            this.id = data.id;
            this.palmPosition = data.palmPosition;
            this.direction = data.direction;
            this.palmVelocity = data.palmVelocity;
            this.palmNormal = data.palmNormal;
            this.sphereCenter = data.sphereCenter;
            this.sphereRadius = data.sphereRadius;
            this.valid = true;
            this.pointables = [];
            this.fingers = [];
            this.tools = [];
            this._translation = data.t;
            this._rotation = _.flatten(data.r);
            this._scaleFactor = data.s;
            this.timeVisible = data.timeVisible;
            this.stabilizedPalmPosition = data.stabilizedPalmPosition;
        };
        Hand.prototype.finger = function(id) {
            var finger = this.frame.finger(id);
            return (finger && finger.handId == this.id) ? finger : Pointable.Invalid;
        };
        Hand.prototype.rotationAngle = function(sinceFrame, axis) {
            if (!this.valid || !sinceFrame.valid) {
                return 0;
            }
            var sinceHand = sinceFrame.hand(this.id);
            if (!sinceHand.valid) {
                return 0;
            }
            var rot = this.rotationMatrix(sinceFrame);
            var cs = (rot[0] + rot[4] + rot[8] - 1) * 0.5;
            var angle = Math.acos(cs);
            angle = isNaN(angle) ? 0 : angle;
            if (axis !== undefined) {
                var rotAxis = this.rotationAxis(sinceFrame);
                angle *= vec3.dot(rotAxis, vec3.normalize(vec3.create(), axis));
            }
            return angle;
        };
        Hand.prototype.rotationAxis = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return vec3.create();
            }
            var sinceHand = sinceFrame.hand(this.id);
            if (!sinceHand.valid) {
                return vec3.create();
            }
            return vec3.normalize(vec3.create(), [this._rotation[7] - sinceHand._rotation[5], this._rotation[2] - sinceHand._rotation[6], this._rotation[3] - sinceHand._rotation[1]]);
        };
        Hand.prototype.rotationMatrix = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return mat3.create();
            }
            var sinceHand = sinceFrame.hand(this.id);
            if (!sinceHand.valid) {
                return mat3.create();
            }
            var transpose = mat3.transpose(mat3.create(), this._rotation);
            var m = mat3.multiply(mat3.create(), sinceHand._rotation, transpose);
            return m;
        };
        Hand.prototype.scaleFactor = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return 1;
            }
            var sinceHand = sinceFrame.hand(this.id);
            if (!sinceHand.valid) {
                return 1;
            }
            return Math.exp(this._scaleFactor - sinceHand._scaleFactor);
        };
        Hand.prototype.translation = function(sinceFrame) {
            if (!this.valid || !sinceFrame.valid) {
                return vec3.create();
            }
            var sinceHand = sinceFrame.hand(this.id);
            if (!sinceHand.valid) {
                return vec3.create();
            }
            return [this._translation[0] - sinceHand._translation[0], this._translation[1] - sinceHand._translation[1], this._translation[2] - sinceHand._translation[2]];
        };
        Hand.prototype.toString = function() {
            return "Hand [ id: " + this.id + " | palm velocity:" + this.palmVelocity + " | sphere center:" + this.sphereCenter + " ] ";
        };
        Hand.Invalid = {
            valid: false,
            fingers: [],
            tools: [],
            pointables: [],
            pointable: function() {
                return Pointable.Invalid;
            },
            finger: function() {
                return Pointable.Invalid;
            },
            toString: function() {
                return "invalid frame";
            },
            dump: function() {
                return this.toString();
            },
            rotationAngle: function() {
                return 0;
            },
            rotationMatrix: function() {
                return mat3.create();
            },
            rotationAxis: function() {
                return vec3.create();
            },
            scaleFactor: function() {
                return 1;
            },
            translation: function() {
                return vec3.create();
            }
        };
    }, {
        "./pointable": 11,
        "gl-matrix": 19,
        "underscore": 20
    }],
    8: [function(require, module, exports) {
        (function() {
            module.exports = {
                Controller: require("./controller"),
                Frame: require("./frame"),
                Gesture: require("./gesture"),
                Hand: require("./hand"),
                Pointable: require("./pointable"),
                InteractionBox: require("./interaction_box"),
                Connection: require("./connection"),
                CircularBuffer: require("./circular_buffer"),
                UI: require("./ui"),
                glMatrix: require("gl-matrix"),
                mat3: require("gl-matrix").mat3,
                vec3: require("gl-matrix").vec3,
                loopController: undefined,
                loop: function(opts, callback) {
                    if (callback === undefined) {
                        callback = opts;
                        opts = {};
                    }
                    if (!this.loopController) {
                        this.loopController = new this.Controller(opts);
                    }
                    this.loopController.loop(callback);
                }
            };
        })();
    }, {
        "./circular_buffer": 2,
        "./connection": 3,
        "./controller": 4,
        "./frame": 5,
        "./gesture": 6,
        "./hand": 7,
        "./interaction_box": 9,
        "./pointable": 11,
        "./ui": 13,
        "gl-matrix": 19
    }],
    9: [function(require, module, exports) {
        var glMatrix = require("gl-matrix"),
            vec3 = glMatrix.vec3;
        var InteractionBox = module.exports = function(data) {
            this.valid = true;
            this.center = data.center;
            this.size = data.size;
            this.width = data.size[0];
            this.height = data.size[1];
            this.depth = data.size[2];
        };
        InteractionBox.prototype.denormalizePoint = function(normalizedPosition) {
            return vec3.fromValues((normalizedPosition[0] - 0.5) * this.size[0] + this.center[0], (normalizedPosition[1] - 0.5) * this.size[1] + this.center[1], (normalizedPosition[2] - 0.5) * this.size[2] + this.center[2]);
        };
        InteractionBox.prototype.normalizePoint = function(position, clamp) {
            var vec = vec3.fromValues(((position[0] - this.center[0]) / this.size[0]) + 0.5, ((position[1] - this.center[1]) / this.size[1]) + 0.5, ((position[2] - this.center[2]) / this.size[2]) + 0.5);
            if (clamp) {
                vec[0] = Math.min(Math.max(vec[0], 0), 1);
                vec[1] = Math.min(Math.max(vec[1], 0), 1);
                vec[2] = Math.min(Math.max(vec[2], 0), 1);
            }
            return vec;
        };
        InteractionBox.prototype.toString = function() {
            return "InteractionBox [ width:" + this.width + " | height:" + this.height + " | depth:" + this.depth + " ]";
        };
        InteractionBox.Invalid = {
            valid: false
        };
    }, {
        "gl-matrix": 19
    }],
    10: [function(require, module, exports) {
        var Pipeline = module.exports = function() {
            this.steps = [];
        };
        Pipeline.prototype.addStep = function(step) {
            this.steps.push(step);
        };
        Pipeline.prototype.run = function(frame) {
            var stepsLength = this.steps.length;
            for (var i = 0; i != stepsLength; i++) {
                if (!frame) {
                    break;
                }
                frame = this.steps[i](frame);
            }
            return frame;
        };
    }, {}],
    11: [function(require, module, exports) {
        var glMatrix = require("gl-matrix"),
            vec3 = glMatrix.vec3;
        var Pointable = module.exports = function(data) {
            this.valid = true;
            this.id = data.id;
            this.handId = data.handId;
            this.length = data.length;
            this.tool = data.tool;
            this.width = data.width;
            this.direction = data.direction;
            this.stabilizedTipPosition = data.stabilizedTipPosition;
            this.tipPosition = data.tipPosition;
            this.tipVelocity = data.tipVelocity;
            this.touchZone = data.touchZone;
            this.touchDistance = data.touchDistance;
            this.timeVisible = data.timeVisible;
        };
        Pointable.prototype.toString = function() {
            if (this.tool == true) {
                return "Pointable [ id:" + this.id + " " + this.length + "mmx | with:" + this.width + "mm | direction:" + this.direction + " ]";
            } else {
                return "Pointable [ id:" + this.id + " " + this.length + "mmx | direction: " + this.direction + " ]";
            }
        };
        Pointable.Invalid = {
            valid: false
        };
    }, {
        "gl-matrix": 19
    }],
    12: [function(require, module, exports) {
        var Frame = require("./frame");
        var Event = function(data) {
            this.type = data.type;
            this.state = data.state;
        };
        var chooseProtocol = exports.chooseProtocol = function(header) {
            var protocol;
            switch (header.version) {
                case 1:
                    protocol = JSONProtocol(1, function(data) {
                        return new Frame(data);
                    });
                    break;
                case 2:
                    protocol = JSONProtocol(2, function(data) {
                        return new Frame(data);
                    });
                    protocol.sendHeartbeat = function(connection) {
                        connection.send(protocol.encode({
                            heartbeat: true
                        }));
                    };
                    break;
                case 3:
                    protocol = JSONProtocol(3, function(data) {
                        return data.event ? new Event(data.event) : new Frame(data);
                    });
                    protocol.sendHeartbeat = function(connection) {
                        connection.send(protocol.encode({
                            heartbeat: true
                        }));
                    };
                    break;
                default:
                    throw "unrecognized version";
            }
            return protocol;
        };
        var JSONProtocol = function(version, cb) {
            var protocol = cb;
            protocol.encode = function(message) {
                return JSON.stringify(message);
            };
            protocol.version = version;
            protocol.versionLong = "Version " + version;
            protocol.type = "protocol";
            return protocol;
        };
    }, {
        "./frame": 5
    }],
    13: [function(require, module, exports) {
        exports.UI = {
            Region: require("./ui/region"),
            Cursor: require("./ui/cursor")
        };
    }, {
        "./ui/cursor": 14,
        "./ui/region": 15
    }],
    14: [function(require, module, exports) {
        var Cursor = module.exports = function() {
            return function(frame) {
                var pointable = frame.pointables.sort(function(a, b) {
                    return a.z - b.z;
                })[0];
                if (pointable && pointable.valid) {
                    frame.cursorPosition = pointable.tipPosition;
                }
                return frame;
            };
        };
    }, {}],
    15: [function(require, module, exports) {
        var EventEmitter = require("events").EventEmitter,
            _ = require("underscore");
        var Region = module.exports = function(start, end) {
            this.start = new Vector(start);
            this.end = new Vector(end);
            this.enteredFrame = null;
        };
        Region.prototype.hasPointables = function(frame) {
            for (var i = 0; i != frame.pointables.length; i++) {
                var position = frame.pointables[i].tipPosition;
                if (position.x >= this.start.x && position.x <= this.end.x && position.y >= this.start.y && position.y <= this.end.y && position.z >= this.start.z && position.z <= this.end.z) {
                    return true;
                }
            }
            return false;
        };
        Region.prototype.listener = function(opts) {
            var region = this;
            if (opts && opts.nearThreshold) {
                this.setupNearRegion(opts.nearThreshold);
            }
            return function(frame) {
                return region.updatePosition(frame);
            };
        };
        Region.prototype.clipper = function() {
            var region = this;
            return function(frame) {
                region.updatePosition(frame);
                return region.enteredFrame ? frame : null;
            };
        };
        Region.prototype.setupNearRegion = function(distance) {
            var nearRegion = this.nearRegion = new Region([this.start.x - distance, this.start.y - distance, this.start.z - distance], [this.end.x + distance, this.end.y + distance, this.end.z + distance]);
            var region = this;
            nearRegion.on("enter", function(frame) {
                region.emit("near", frame);
            });
            nearRegion.on("exit", function(frame) {
                region.emit("far", frame);
            });
            region.on("exit", function(frame) {
                region.emit("near", frame);
            });
        };
        Region.prototype.updatePosition = function(frame) {
            if (this.nearRegion) {
                this.nearRegion.updatePosition(frame);
            }
            if (this.hasPointables(frame) && this.enteredFrame == null) {
                this.enteredFrame = frame;
                this.emit("enter", this.enteredFrame);
            } else {
                if (!this.hasPointables(frame) && this.enteredFrame != null) {
                    this.enteredFrame = null;
                    this.emit("exit", this.enteredFrame);
                }
            }
            return frame;
        };
        Region.prototype.normalize = function(position) {
            return new Vector([(position.x - this.start.x) / (this.end.x - this.start.x), (position.y - this.start.y) / (this.end.y - this.start.y), (position.z - this.start.z) / (this.end.z - this.start.z)]);
        };
        Region.prototype.mapToXY = function(position, width, height) {
            var normalized = this.normalize(position);
            var x = normalized.x,
                y = normalized.y;
            if (x > 1) {
                x = 1;
            } else {
                if (x < -1) {
                    x = -1;
                }
            }
            if (y > 1) {
                y = 1;
            } else {
                if (y < -1) {
                    y = -1;
                }
            }
            return [(x + 1) / 2 * width, (1 - y) / 2 * height, normalized.z];
        };
        _.extend(Region.prototype, EventEmitter.prototype);
    }, {
        "events": 17,
        "underscore": 20
    }],
    16: [function(require, module, exports) {}, {}],
    17: [function(require, module, exports) {
        (function(process) {
            if (!process.EventEmitter) {
                process.EventEmitter = function() {};
            }
            var EventEmitter = exports.EventEmitter = process.EventEmitter;
            var isArray = typeof Array.isArray === "function" ? Array.isArray : function(xs) {
                return Object.prototype.toString.call(xs) === "[object Array]";
            };

            function indexOf(xs, x) {
                if (xs.indexOf) {
                    return xs.indexOf(x);
                }
                for (var i = 0; i < xs.length; i++) {
                    if (x === xs[i]) {
                        return i;
                    }
                }
                return -1;
            }
            var defaultMaxListeners = 10;
            EventEmitter.prototype.setMaxListeners = function(n) {
                if (!this._events) {
                    this._events = {};
                }
                this._events.maxListeners = n;
            };
            EventEmitter.prototype.emit = function(type) {
                if (type === "error") {
                    if (!this._events || !this._events.error || (isArray(this._events.error) && !this._events.error.length)) {
                        if (arguments[1] instanceof Error) {
                            throw arguments[1];
                        } else {
                            throw new Error("Uncaught, unspecified 'error' event.");
                        }
                        return false;
                    }
                }
                if (!this._events) {
                    return false;
                }
                var handler = this._events[type];
                if (!handler) {
                    return false;
                }
                if (typeof handler == "function") {
                    switch (arguments.length) {
                        case 1:
                            handler.call(this);
                            break;
                        case 2:
                            handler.call(this, arguments[1]);
                            break;
                        case 3:
                            handler.call(this, arguments[1], arguments[2]);
                            break;
                        default:
                            var args = Array.prototype.slice.call(arguments, 1);
                            handler.apply(this, args);
                    }
                    return true;
                } else {
                    if (isArray(handler)) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        var listeners = handler.slice();
                        for (var i = 0, l = listeners.length; i < l; i++) {
                            listeners[i].apply(this, args);
                        }
                        return true;
                    } else {
                        return false;
                    }
                }
            };
            EventEmitter.prototype.addListener = function(type, listener) {
                if ("function" !== typeof listener) {
                    throw new Error("addListener only takes instances of Function");
                }
                if (!this._events) {
                    this._events = {};
                }
                this.emit("newListener", type, listener);
                if (!this._events[type]) {
                    this._events[type] = listener;
                } else {
                    if (isArray(this._events[type])) {
                        if (!this._events[type].warned) {
                            var m;
                            if (this._events.maxListeners !== undefined) {
                                m = this._events.maxListeners;
                            } else {
                                m = defaultMaxListeners;
                            }
                            if (m && m > 0 && this._events[type].length > m) {
                                this._events[type].warned = true;
                                console.error("(node) warning: possible EventEmitter memory " + "leak detected. %d listeners added. " + "Use emitter.setMaxListeners() to increase limit.", this._events[type].length);
                                console.trace();
                            }
                        }
                        this._events[type].push(listener);
                    } else {
                        this._events[type] = [this._events[type], listener];
                    }
                }
                return this;
            };
            EventEmitter.prototype.on = EventEmitter.prototype.addListener;
            EventEmitter.prototype.once = function(type, listener) {
                var self = this;
                self.on(type, function g() {
                    self.removeListener(type, g);
                    listener.apply(this, arguments);
                });
                return this;
            };
            EventEmitter.prototype.removeListener = function(type, listener) {
                if ("function" !== typeof listener) {
                    throw new Error("removeListener only takes instances of Function");
                }
                if (!this._events || !this._events[type]) {
                    return this;
                }
                var list = this._events[type];
                if (isArray(list)) {
                    var i = indexOf(list, listener);
                    if (i < 0) {
                        return this;
                    }
                    list.splice(i, 1);
                    if (list.length == 0) {
                        delete this._events[type];
                    }
                } else {
                    if (this._events[type] === listener) {
                        delete this._events[type];
                    }
                }
                return this;
            };
            EventEmitter.prototype.removeAllListeners = function(type) {
                if (arguments.length === 0) {
                    this._events = {};
                    return this;
                }
                if (type && this._events && this._events[type]) {
                    this._events[type] = null;
                }
                return this;
            };
            EventEmitter.prototype.listeners = function(type) {
                if (!this._events) {
                    this._events = {};
                }
                if (!this._events[type]) {
                    this._events[type] = [];
                }
                if (!isArray(this._events[type])) {
                    this._events[type] = [this._events[type]];
                }
                return this._events[type];
            };
        })(require("__browserify_process"));
    }, {
        "__browserify_process": 18
    }],
    18: [function(require, module, exports) {
        var process = module.exports = {};
        process.nextTick = (function() {
            var canSetImmediate = typeof window !== "undefined" && window.setImmediate;
            var canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener;
            if (canSetImmediate) {
                return function(f) {
                    return window.setImmediate(f);
                };
            }
            if (canPost) {
                var queue = [];
                window.addEventListener("message", function(ev) {
                    if (ev.source === window && ev.data === "process-tick") {
                        ev.stopPropagation();
                        if (queue.length > 0) {
                            var fn = queue.shift();
                            fn();
                        }
                    }
                }, true);
                return function nextTick(fn) {
                    queue.push(fn);
                    window.postMessage("process-tick", "*");
                };
            }
            return function nextTick(fn) {
                setTimeout(fn, 0);
            };
        })();
        process.title = "browser";
        process.browser = true;
        process.env = {};
        process.argv = [];
        process.binding = function(name) {
            throw new Error("process.binding is not supported");
        };
        process.cwd = function() {
            return "/";
        };
        process.chdir = function(dir) {
            throw new Error("process.chdir is not supported");
        };
    }, {}],
    19: [function(require, module, exports) {
        (function() {
            (function() {
                var shim = {};
                if (typeof(exports) === "undefined") {
                    if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
                        shim.exports = {};
                        define(function() {
                            return shim.exports;
                        });
                    } else {
                        shim.exports = window;
                    }
                } else {
                    shim.exports = exports;
                }(function(exports) {
                    var vec2 = {};
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    vec2.create = function() {
                        return new Float32Array(2);
                    };
                    vec2.clone = function(a) {
                        var out = new Float32Array(2);
                        out[0] = a[0];
                        out[1] = a[1];
                        return out;
                    };
                    vec2.fromValues = function(x, y) {
                        var out = new Float32Array(2);
                        out[0] = x;
                        out[1] = y;
                        return out;
                    };
                    vec2.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        return out;
                    };
                    vec2.set = function(out, x, y) {
                        out[0] = x;
                        out[1] = y;
                        return out;
                    };
                    vec2.add = function(out, a, b) {
                        out[0] = a[0] + b[0];
                        out[1] = a[1] + b[1];
                        return out;
                    };
                    vec2.sub = vec2.subtract = function(out, a, b) {
                        out[0] = a[0] - b[0];
                        out[1] = a[1] - b[1];
                        return out;
                    };
                    vec2.mul = vec2.multiply = function(out, a, b) {
                        out[0] = a[0] * b[0];
                        out[1] = a[1] * b[1];
                        return out;
                    };
                    vec2.div = vec2.divide = function(out, a, b) {
                        out[0] = a[0] / b[0];
                        out[1] = a[1] / b[1];
                        return out;
                    };
                    vec2.min = function(out, a, b) {
                        out[0] = Math.min(a[0], b[0]);
                        out[1] = Math.min(a[1], b[1]);
                        return out;
                    };
                    vec2.max = function(out, a, b) {
                        out[0] = Math.max(a[0], b[0]);
                        out[1] = Math.max(a[1], b[1]);
                        return out;
                    };
                    vec2.scale = function(out, a, b) {
                        out[0] = a[0] * b;
                        out[1] = a[1] * b;
                        return out;
                    };
                    vec2.dist = vec2.distance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1];
                        return Math.sqrt(x * x + y * y);
                    };
                    vec2.sqrDist = vec2.squaredDistance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1];
                        return x * x + y * y;
                    };
                    vec2.len = vec2.length = function(a) {
                        var x = a[0],
                            y = a[1];
                        return Math.sqrt(x * x + y * y);
                    };
                    vec2.sqrLen = vec2.squaredLength = function(a) {
                        var x = a[0],
                            y = a[1];
                        return x * x + y * y;
                    };
                    vec2.negate = function(out, a) {
                        out[0] = -a[0];
                        out[1] = -a[1];
                        return out;
                    };
                    vec2.normalize = function(out, a) {
                        var x = a[0],
                            y = a[1];
                        var len = x * x + y * y;
                        if (len > 0) {
                            len = 1 / Math.sqrt(len);
                            out[0] = a[0] * len;
                            out[1] = a[1] * len;
                        }
                        return out;
                    };
                    vec2.dot = function(a, b) {
                        return a[0] * b[0] + a[1] * b[1];
                    };
                    vec2.cross = function(out, a, b) {
                        var z = a[0] * b[1] - a[1] * b[0];
                        out[0] = out[1] = 0;
                        out[2] = z;
                        return out;
                    };
                    vec2.lerp = function(out, a, b, t) {
                        var ax = a[0],
                            ay = a[1];
                        out[0] = ax + t * (b[0] - ax);
                        out[1] = ay + t * (b[1] - ay);
                        return out;
                    };
                    vec2.transformMat2 = function(out, a, m) {
                        var x = a[0],
                            y = a[1];
                        out[0] = x * m[0] + y * m[1];
                        out[1] = x * m[2] + y * m[3];
                        return out;
                    };
                    vec2.forEach = (function() {
                        var vec = new Float32Array(2);
                        return function(a, stride, offset, count, fn, arg) {
                            var i, l;
                            if (!stride) {
                                stride = 2;
                            }
                            if (!offset) {
                                offset = 0;
                            }
                            if (count) {
                                l = Math.min((count * stride) + offset, a.length);
                            } else {
                                l = a.length;
                            }
                            for (i = offset; i < l; i += stride) {
                                vec[0] = a[i];
                                vec[1] = a[i + 1];
                                fn(vec, vec, arg);
                                a[i] = vec[0];
                                a[i + 1] = vec[1];
                            }
                            return a;
                        };
                    })();
                    vec2.str = function(a) {
                        return "vec2(" + a[0] + ", " + a[1] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.vec2 = vec2;
                    }
                    var vec3 = {};
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    vec3.create = function() {
                        return new Float32Array(3);
                    };
                    vec3.clone = function(a) {
                        var out = new Float32Array(3);
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        return out;
                    };
                    vec3.fromValues = function(x, y, z) {
                        var out = new Float32Array(3);
                        out[0] = x;
                        out[1] = y;
                        out[2] = z;
                        return out;
                    };
                    vec3.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        return out;
                    };
                    vec3.set = function(out, x, y, z) {
                        out[0] = x;
                        out[1] = y;
                        out[2] = z;
                        return out;
                    };
                    vec3.add = function(out, a, b) {
                        out[0] = a[0] + b[0];
                        out[1] = a[1] + b[1];
                        out[2] = a[2] + b[2];
                        return out;
                    };
                    vec3.sub = vec3.subtract = function(out, a, b) {
                        out[0] = a[0] - b[0];
                        out[1] = a[1] - b[1];
                        out[2] = a[2] - b[2];
                        return out;
                    };
                    vec3.mul = vec3.multiply = function(out, a, b) {
                        out[0] = a[0] * b[0];
                        out[1] = a[1] * b[1];
                        out[2] = a[2] * b[2];
                        return out;
                    };
                    vec3.div = vec3.divide = function(out, a, b) {
                        out[0] = a[0] / b[0];
                        out[1] = a[1] / b[1];
                        out[2] = a[2] / b[2];
                        return out;
                    };
                    vec3.min = function(out, a, b) {
                        out[0] = Math.min(a[0], b[0]);
                        out[1] = Math.min(a[1], b[1]);
                        out[2] = Math.min(a[2], b[2]);
                        return out;
                    };
                    vec3.max = function(out, a, b) {
                        out[0] = Math.max(a[0], b[0]);
                        out[1] = Math.max(a[1], b[1]);
                        out[2] = Math.max(a[2], b[2]);
                        return out;
                    };
                    vec3.scale = function(out, a, b) {
                        out[0] = a[0] * b;
                        out[1] = a[1] * b;
                        out[2] = a[2] * b;
                        return out;
                    };
                    vec3.dist = vec3.distance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1],
                            z = b[2] - a[2];
                        return Math.sqrt(x * x + y * y + z * z);
                    };
                    vec3.sqrDist = vec3.squaredDistance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1],
                            z = b[2] - a[2];
                        return x * x + y * y + z * z;
                    };
                    vec3.len = vec3.length = function(a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2];
                        return Math.sqrt(x * x + y * y + z * z);
                    };
                    vec3.sqrLen = vec3.squaredLength = function(a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2];
                        return x * x + y * y + z * z;
                    };
                    vec3.negate = function(out, a) {
                        out[0] = -a[0];
                        out[1] = -a[1];
                        out[2] = -a[2];
                        return out;
                    };
                    vec3.normalize = function(out, a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2];
                        var len = x * x + y * y + z * z;
                        if (len > 0) {
                            len = 1 / Math.sqrt(len);
                            out[0] = a[0] * len;
                            out[1] = a[1] * len;
                            out[2] = a[2] * len;
                        }
                        return out;
                    };
                    vec3.dot = function(a, b) {
                        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                    };
                    vec3.cross = function(out, a, b) {
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            bx = b[0],
                            by = b[1],
                            bz = b[2];
                        out[0] = ay * bz - az * by;
                        out[1] = az * bx - ax * bz;
                        out[2] = ax * by - ay * bx;
                        return out;
                    };
                    vec3.lerp = function(out, a, b, t) {
                        var ax = a[0],
                            ay = a[1],
                            az = a[2];
                        out[0] = ax + t * (b[0] - ax);
                        out[1] = ay + t * (b[1] - ay);
                        out[2] = az + t * (b[2] - az);
                        return out;
                    };
                    vec3.transformMat4 = function(out, a, m) {
                        var x = a[0],
                            y = a[1],
                            z = a[2];
                        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
                        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
                        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
                        return out;
                    };
                    vec3.transformQuat = function(out, a, q) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            qx = q[0],
                            qy = q[1],
                            qz = q[2],
                            qw = q[3],
                            ix = qw * x + qy * z - qz * y,
                            iy = qw * y + qz * x - qx * z,
                            iz = qw * z + qx * y - qy * x,
                            iw = -qx * x - qy * y - qz * z;
                        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
                        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
                        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
                        return out;
                    };
                    vec3.forEach = (function() {
                        var vec = new Float32Array(3);
                        return function(a, stride, offset, count, fn, arg) {
                            var i, l;
                            if (!stride) {
                                stride = 3;
                            }
                            if (!offset) {
                                offset = 0;
                            }
                            if (count) {
                                l = Math.min((count * stride) + offset, a.length);
                            } else {
                                l = a.length;
                            }
                            for (i = offset; i < l; i += stride) {
                                vec[0] = a[i];
                                vec[1] = a[i + 1];
                                vec[2] = a[i + 2];
                                fn(vec, vec, arg);
                                a[i] = vec[0];
                                a[i + 1] = vec[1];
                                a[i + 2] = vec[2];
                            }
                            return a;
                        };
                    })();
                    vec3.str = function(a) {
                        return "vec3(" + a[0] + ", " + a[1] + ", " + a[2] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.vec3 = vec3;
                    }
                    var vec4 = {};
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    vec4.create = function() {
                        return new Float32Array(4);
                    };
                    vec4.clone = function(a) {
                        var out = new Float32Array(4);
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        return out;
                    };
                    vec4.fromValues = function(x, y, z, w) {
                        var out = new Float32Array(4);
                        out[0] = x;
                        out[1] = y;
                        out[2] = z;
                        out[3] = w;
                        return out;
                    };
                    vec4.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        return out;
                    };
                    vec4.set = function(out, x, y, z, w) {
                        out[0] = x;
                        out[1] = y;
                        out[2] = z;
                        out[3] = w;
                        return out;
                    };
                    vec4.add = function(out, a, b) {
                        out[0] = a[0] + b[0];
                        out[1] = a[1] + b[1];
                        out[2] = a[2] + b[2];
                        out[3] = a[3] + b[3];
                        return out;
                    };
                    vec4.sub = vec4.subtract = function(out, a, b) {
                        out[0] = a[0] - b[0];
                        out[1] = a[1] - b[1];
                        out[2] = a[2] - b[2];
                        out[3] = a[3] - b[3];
                        return out;
                    };
                    vec4.mul = vec4.multiply = function(out, a, b) {
                        out[0] = a[0] * b[0];
                        out[1] = a[1] * b[1];
                        out[2] = a[2] * b[2];
                        out[3] = a[3] * b[3];
                        return out;
                    };
                    vec4.div = vec4.divide = function(out, a, b) {
                        out[0] = a[0] / b[0];
                        out[1] = a[1] / b[1];
                        out[2] = a[2] / b[2];
                        out[3] = a[3] / b[3];
                        return out;
                    };
                    vec4.min = function(out, a, b) {
                        out[0] = Math.min(a[0], b[0]);
                        out[1] = Math.min(a[1], b[1]);
                        out[2] = Math.min(a[2], b[2]);
                        out[3] = Math.min(a[3], b[3]);
                        return out;
                    };
                    vec4.max = function(out, a, b) {
                        out[0] = Math.max(a[0], b[0]);
                        out[1] = Math.max(a[1], b[1]);
                        out[2] = Math.max(a[2], b[2]);
                        out[3] = Math.max(a[3], b[3]);
                        return out;
                    };
                    vec4.scale = function(out, a, b) {
                        out[0] = a[0] * b;
                        out[1] = a[1] * b;
                        out[2] = a[2] * b;
                        out[3] = a[3] * b;
                        return out;
                    };
                    vec4.dist = vec4.distance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1],
                            z = b[2] - a[2],
                            w = b[3] - a[3];
                        return Math.sqrt(x * x + y * y + z * z + w * w);
                    };
                    vec4.sqrDist = vec4.squaredDistance = function(a, b) {
                        var x = b[0] - a[0],
                            y = b[1] - a[1],
                            z = b[2] - a[2],
                            w = b[3] - a[3];
                        return x * x + y * y + z * z + w * w;
                    };
                    vec4.len = vec4.length = function(a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            w = a[3];
                        return Math.sqrt(x * x + y * y + z * z + w * w);
                    };
                    vec4.sqrLen = vec4.squaredLength = function(a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            w = a[3];
                        return x * x + y * y + z * z + w * w;
                    };
                    vec4.negate = function(out, a) {
                        out[0] = -a[0];
                        out[1] = -a[1];
                        out[2] = -a[2];
                        out[3] = -a[3];
                        return out;
                    };
                    vec4.normalize = function(out, a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            w = a[3];
                        var len = x * x + y * y + z * z + w * w;
                        if (len > 0) {
                            len = 1 / Math.sqrt(len);
                            out[0] = a[0] * len;
                            out[1] = a[1] * len;
                            out[2] = a[2] * len;
                            out[3] = a[3] * len;
                        }
                        return out;
                    };
                    vec4.dot = function(a, b) {
                        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
                    };
                    vec4.lerp = function(out, a, b, t) {
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3];
                        out[0] = ax + t * (b[0] - ax);
                        out[1] = ay + t * (b[1] - ay);
                        out[2] = az + t * (b[2] - az);
                        out[3] = aw + t * (b[3] - aw);
                        return out;
                    };
                    vec4.transformMat4 = function(out, a, m) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            w = a[3];
                        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
                        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
                        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
                        out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
                        return out;
                    };
                    vec4.transformQuat = function(out, a, q) {
                        var x = a[0],
                            y = a[1],
                            z = a[2],
                            qx = q[0],
                            qy = q[1],
                            qz = q[2],
                            qw = q[3],
                            ix = qw * x + qy * z - qz * y,
                            iy = qw * y + qz * x - qx * z,
                            iz = qw * z + qx * y - qy * x,
                            iw = -qx * x - qy * y - qz * z;
                        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
                        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
                        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
                        return out;
                    };
                    vec4.forEach = (function() {
                        var vec = new Float32Array(4);
                        return function(a, stride, offset, count, fn, arg) {
                            var i, l;
                            if (!stride) {
                                stride = 4;
                            }
                            if (!offset) {
                                offset = 0;
                            }
                            if (count) {
                                l = Math.min((count * stride) + offset, a.length);
                            } else {
                                l = a.length;
                            }
                            for (i = offset; i < l; i += stride) {
                                vec[0] = a[i];
                                vec[1] = a[i + 1];
                                vec[2] = a[i + 2];
                                vec[3] = a[i + 3];
                                fn(vec, vec, arg);
                                a[i] = vec[0];
                                a[i + 1] = vec[1];
                                a[i + 2] = vec[2];
                                a[i + 3] = vec[3];
                            }
                            return a;
                        };
                    })();
                    vec4.str = function(a) {
                        return "vec4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.vec4 = vec4;
                    }
                    var mat2 = {};
                    var mat2Identity = new Float32Array([1, 0, 0, 1]);
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    mat2.create = function() {
                        return new Float32Array(mat2Identity);
                    };
                    mat2.clone = function(a) {
                        var out = new Float32Array(4);
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        return out;
                    };
                    mat2.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        return out;
                    };
                    mat2.identity = function(out) {
                        out[0] = 1;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 1;
                        return out;
                    };
                    mat2.transpose = function(out, a) {
                        if (out === a) {
                            var a1 = a[1];
                            out[1] = a[2];
                            out[2] = a1;
                        } else {
                            out[0] = a[0];
                            out[1] = a[2];
                            out[2] = a[1];
                            out[3] = a[3];
                        }
                        return out;
                    };
                    mat2.invert = function(out, a) {
                        var a0 = a[0],
                            a1 = a[1],
                            a2 = a[2],
                            a3 = a[3],
                            det = a0 * a3 - a2 * a1;
                        if (!det) {
                            return null;
                        }
                        det = 1 / det;
                        out[0] = a3 * det;
                        out[1] = -a1 * det;
                        out[2] = -a2 * det;
                        out[3] = a0 * det;
                        return out;
                    };
                    mat2.adjoint = function(out, a) {
                        var a0 = a[0];
                        out[0] = a[3];
                        out[1] = -a[1];
                        out[2] = -a[2];
                        out[3] = a0;
                        return out;
                    };
                    mat2.determinant = function(a) {
                        return a[0] * a[3] - a[2] * a[1];
                    };
                    mat2.mul = mat2.multiply = function(out, a, b) {
                        var a0 = a[0],
                            a1 = a[1],
                            a2 = a[2],
                            a3 = a[3];
                        var b0 = b[0],
                            b1 = b[1],
                            b2 = b[2],
                            b3 = b[3];
                        out[0] = a0 * b0 + a1 * b2;
                        out[1] = a0 * b1 + a1 * b3;
                        out[2] = a2 * b0 + a3 * b2;
                        out[3] = a2 * b1 + a3 * b3;
                        return out;
                    };
                    mat2.rotate = function(out, a, rad) {
                        var a0 = a[0],
                            a1 = a[1],
                            a2 = a[2],
                            a3 = a[3],
                            s = Math.sin(rad),
                            c = Math.cos(rad);
                        out[0] = a0 * c + a1 * s;
                        out[1] = a0 * -s + a1 * c;
                        out[2] = a2 * c + a3 * s;
                        out[3] = a2 * -s + a3 * c;
                        return out;
                    };
                    mat2.scale = function(out, a, v) {
                        var a0 = a[0],
                            a1 = a[1],
                            a2 = a[2],
                            a3 = a[3],
                            v0 = v[0],
                            v1 = v[1];
                        out[0] = a0 * v0;
                        out[1] = a1 * v1;
                        out[2] = a2 * v0;
                        out[3] = a3 * v1;
                        return out;
                    };
                    mat2.str = function(a) {
                        return "mat2(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.mat2 = mat2;
                    }
                    var mat3 = {};
                    var mat3Identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    mat3.create = function() {
                        return new Float32Array(mat3Identity);
                    };
                    mat3.clone = function(a) {
                        var out = new Float32Array(9);
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        out[4] = a[4];
                        out[5] = a[5];
                        out[6] = a[6];
                        out[7] = a[7];
                        out[8] = a[8];
                        return out;
                    };
                    mat3.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        out[4] = a[4];
                        out[5] = a[5];
                        out[6] = a[6];
                        out[7] = a[7];
                        out[8] = a[8];
                        return out;
                    };
                    mat3.identity = function(out) {
                        out[0] = 1;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 0;
                        out[4] = 1;
                        out[5] = 0;
                        out[6] = 0;
                        out[7] = 0;
                        out[8] = 1;
                        return out;
                    };
                    mat3.transpose = function(out, a) {
                        if (out === a) {
                            var a01 = a[1],
                                a02 = a[2],
                                a12 = a[5];
                            out[1] = a[3];
                            out[2] = a[6];
                            out[3] = a01;
                            out[5] = a[7];
                            out[6] = a02;
                            out[7] = a12;
                        } else {
                            out[0] = a[0];
                            out[1] = a[3];
                            out[2] = a[6];
                            out[3] = a[1];
                            out[4] = a[4];
                            out[5] = a[7];
                            out[6] = a[2];
                            out[7] = a[5];
                            out[8] = a[8];
                        }
                        return out;
                    };
                    mat3.invert = function(out, a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a10 = a[3],
                            a11 = a[4],
                            a12 = a[5],
                            a20 = a[6],
                            a21 = a[7],
                            a22 = a[8],
                            b01 = a22 * a11 - a12 * a21,
                            b11 = -a22 * a10 + a12 * a20,
                            b21 = a21 * a10 - a11 * a20,
                            det = a00 * b01 + a01 * b11 + a02 * b21;
                        if (!det) {
                            return null;
                        }
                        det = 1 / det;
                        out[0] = b01 * det;
                        out[1] = (-a22 * a01 + a02 * a21) * det;
                        out[2] = (a12 * a01 - a02 * a11) * det;
                        out[3] = b11 * det;
                        out[4] = (a22 * a00 - a02 * a20) * det;
                        out[5] = (-a12 * a00 + a02 * a10) * det;
                        out[6] = b21 * det;
                        out[7] = (-a21 * a00 + a01 * a20) * det;
                        out[8] = (a11 * a00 - a01 * a10) * det;
                        return out;
                    };
                    mat3.adjoint = function(out, a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a10 = a[3],
                            a11 = a[4],
                            a12 = a[5],
                            a20 = a[6],
                            a21 = a[7],
                            a22 = a[8];
                        out[0] = (a11 * a22 - a12 * a21);
                        out[1] = (a02 * a21 - a01 * a22);
                        out[2] = (a01 * a12 - a02 * a11);
                        out[3] = (a12 * a20 - a10 * a22);
                        out[4] = (a00 * a22 - a02 * a20);
                        out[5] = (a02 * a10 - a00 * a12);
                        out[6] = (a10 * a21 - a11 * a20);
                        out[7] = (a01 * a20 - a00 * a21);
                        out[8] = (a00 * a11 - a01 * a10);
                        return out;
                    };
                    mat3.determinant = function(a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a10 = a[3],
                            a11 = a[4],
                            a12 = a[5],
                            a20 = a[6],
                            a21 = a[7],
                            a22 = a[8];
                        return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
                    };
                    mat3.mul = mat3.multiply = function(out, a, b) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a10 = a[3],
                            a11 = a[4],
                            a12 = a[5],
                            a20 = a[6],
                            a21 = a[7],
                            a22 = a[8],
                            b00 = b[0],
                            b01 = b[1],
                            b02 = b[2],
                            b10 = b[3],
                            b11 = b[4],
                            b12 = b[5],
                            b20 = b[6],
                            b21 = b[7],
                            b22 = b[8];
                        out[0] = b00 * a00 + b01 * a10 + b02 * a20;
                        out[1] = b00 * a01 + b01 * a11 + b02 * a21;
                        out[2] = b00 * a02 + b01 * a12 + b02 * a22;
                        out[3] = b10 * a00 + b11 * a10 + b12 * a20;
                        out[4] = b10 * a01 + b11 * a11 + b12 * a21;
                        out[5] = b10 * a02 + b11 * a12 + b12 * a22;
                        out[6] = b20 * a00 + b21 * a10 + b22 * a20;
                        out[7] = b20 * a01 + b21 * a11 + b22 * a21;
                        out[8] = b20 * a02 + b21 * a12 + b22 * a22;
                        return out;
                    };
                    mat3.str = function(a) {
                        return "mat3(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.mat3 = mat3;
                    }
                    var mat4 = {};
                    var mat4Identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    mat4.create = function() {
                        return new Float32Array(mat4Identity);
                    };
                    mat4.clone = function(a) {
                        var out = new Float32Array(16);
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        out[4] = a[4];
                        out[5] = a[5];
                        out[6] = a[6];
                        out[7] = a[7];
                        out[8] = a[8];
                        out[9] = a[9];
                        out[10] = a[10];
                        out[11] = a[11];
                        out[12] = a[12];
                        out[13] = a[13];
                        out[14] = a[14];
                        out[15] = a[15];
                        return out;
                    };
                    mat4.copy = function(out, a) {
                        out[0] = a[0];
                        out[1] = a[1];
                        out[2] = a[2];
                        out[3] = a[3];
                        out[4] = a[4];
                        out[5] = a[5];
                        out[6] = a[6];
                        out[7] = a[7];
                        out[8] = a[8];
                        out[9] = a[9];
                        out[10] = a[10];
                        out[11] = a[11];
                        out[12] = a[12];
                        out[13] = a[13];
                        out[14] = a[14];
                        out[15] = a[15];
                        return out;
                    };
                    mat4.identity = function(out) {
                        out[0] = 1;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 0;
                        out[4] = 0;
                        out[5] = 1;
                        out[6] = 0;
                        out[7] = 0;
                        out[8] = 0;
                        out[9] = 0;
                        out[10] = 1;
                        out[11] = 0;
                        out[12] = 0;
                        out[13] = 0;
                        out[14] = 0;
                        out[15] = 1;
                        return out;
                    };
                    mat4.transpose = function(out, a) {
                        if (out === a) {
                            var a01 = a[1],
                                a02 = a[2],
                                a03 = a[3],
                                a12 = a[6],
                                a13 = a[7],
                                a23 = a[11];
                            out[1] = a[4];
                            out[2] = a[8];
                            out[3] = a[12];
                            out[4] = a01;
                            out[6] = a[9];
                            out[7] = a[13];
                            out[8] = a02;
                            out[9] = a12;
                            out[11] = a[14];
                            out[12] = a03;
                            out[13] = a13;
                            out[14] = a23;
                        } else {
                            out[0] = a[0];
                            out[1] = a[4];
                            out[2] = a[8];
                            out[3] = a[12];
                            out[4] = a[1];
                            out[5] = a[5];
                            out[6] = a[9];
                            out[7] = a[13];
                            out[8] = a[2];
                            out[9] = a[6];
                            out[10] = a[10];
                            out[11] = a[14];
                            out[12] = a[3];
                            out[13] = a[7];
                            out[14] = a[11];
                            out[15] = a[15];
                        }
                        return out;
                    };
                    mat4.invert = function(out, a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11],
                            a30 = a[12],
                            a31 = a[13],
                            a32 = a[14],
                            a33 = a[15],
                            b00 = a00 * a11 - a01 * a10,
                            b01 = a00 * a12 - a02 * a10,
                            b02 = a00 * a13 - a03 * a10,
                            b03 = a01 * a12 - a02 * a11,
                            b04 = a01 * a13 - a03 * a11,
                            b05 = a02 * a13 - a03 * a12,
                            b06 = a20 * a31 - a21 * a30,
                            b07 = a20 * a32 - a22 * a30,
                            b08 = a20 * a33 - a23 * a30,
                            b09 = a21 * a32 - a22 * a31,
                            b10 = a21 * a33 - a23 * a31,
                            b11 = a22 * a33 - a23 * a32,
                            det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
                        if (!det) {
                            return null;
                        }
                        det = 1 / det;
                        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
                        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
                        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
                        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
                        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
                        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
                        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
                        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
                        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
                        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
                        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
                        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
                        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
                        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
                        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
                        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
                        return out;
                    };
                    mat4.adjoint = function(out, a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11],
                            a30 = a[12],
                            a31 = a[13],
                            a32 = a[14],
                            a33 = a[15];
                        out[0] = (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
                        out[1] = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
                        out[2] = (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
                        out[3] = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
                        out[4] = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
                        out[5] = (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
                        out[6] = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
                        out[7] = (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
                        out[8] = (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
                        out[9] = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
                        out[10] = (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
                        out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
                        out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
                        out[13] = (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
                        out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
                        out[15] = (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
                        return out;
                    };
                    mat4.determinant = function(a) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11],
                            a30 = a[12],
                            a31 = a[13],
                            a32 = a[14],
                            a33 = a[15],
                            b00 = a00 * a11 - a01 * a10,
                            b01 = a00 * a12 - a02 * a10,
                            b02 = a00 * a13 - a03 * a10,
                            b03 = a01 * a12 - a02 * a11,
                            b04 = a01 * a13 - a03 * a11,
                            b05 = a02 * a13 - a03 * a12,
                            b06 = a20 * a31 - a21 * a30,
                            b07 = a20 * a32 - a22 * a30,
                            b08 = a20 * a33 - a23 * a30,
                            b09 = a21 * a32 - a22 * a31,
                            b10 = a21 * a33 - a23 * a31,
                            b11 = a22 * a33 - a23 * a32;
                        return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
                    };
                    mat4.mul = mat4.multiply = function(out, a, b) {
                        var a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11],
                            a30 = a[12],
                            a31 = a[13],
                            a32 = a[14],
                            a33 = a[15];
                        var b0 = b[0],
                            b1 = b[1],
                            b2 = b[2],
                            b3 = b[3];
                        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
                        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
                        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
                        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
                        b0 = b[4];
                        b1 = b[5];
                        b2 = b[6];
                        b3 = b[7];
                        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
                        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
                        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
                        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
                        b0 = b[8];
                        b1 = b[9];
                        b2 = b[10];
                        b3 = b[11];
                        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
                        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
                        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
                        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
                        b0 = b[12];
                        b1 = b[13];
                        b2 = b[14];
                        b3 = b[15];
                        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
                        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
                        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
                        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
                        return out;
                    };
                    mat4.translate = function(out, a, v) {
                        var x = v[0],
                            y = v[1],
                            z = v[2],
                            a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23;
                        if (a === out) {
                            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
                            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
                            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
                            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
                        } else {
                            a00 = a[0];
                            a01 = a[1];
                            a02 = a[2];
                            a03 = a[3];
                            a10 = a[4];
                            a11 = a[5];
                            a12 = a[6];
                            a13 = a[7];
                            a20 = a[8];
                            a21 = a[9];
                            a22 = a[10];
                            a23 = a[11];
                            out[0] = a00;
                            out[1] = a01;
                            out[2] = a02;
                            out[3] = a03;
                            out[4] = a10;
                            out[5] = a11;
                            out[6] = a12;
                            out[7] = a13;
                            out[8] = a20;
                            out[9] = a21;
                            out[10] = a22;
                            out[11] = a23;
                            out[12] = a00 * x + a10 * y + a20 * z + a[12];
                            out[13] = a01 * x + a11 * y + a21 * z + a[13];
                            out[14] = a02 * x + a12 * y + a22 * z + a[14];
                            out[15] = a03 * x + a13 * y + a23 * z + a[15];
                        }
                        return out;
                    };
                    mat4.scale = function(out, a, v) {
                        var x = v[0],
                            y = v[1],
                            z = v[2];
                        out[0] = a[0] * x;
                        out[1] = a[1] * x;
                        out[2] = a[2] * x;
                        out[3] = a[3] * x;
                        out[4] = a[4] * y;
                        out[5] = a[5] * y;
                        out[6] = a[6] * y;
                        out[7] = a[7] * y;
                        out[8] = a[8] * z;
                        out[9] = a[9] * z;
                        out[10] = a[10] * z;
                        out[11] = a[11] * z;
                        out[12] = a[12];
                        out[13] = a[13];
                        out[14] = a[14];
                        out[15] = a[15];
                        return out;
                    };
                    mat4.rotate = function(out, a, rad, axis) {
                        var x = axis[0],
                            y = axis[1],
                            z = axis[2],
                            len = Math.sqrt(x * x + y * y + z * z),
                            s, c, t, a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, b00, b01, b02, b10, b11, b12, b20, b21, b22;
                        if (Math.abs(len) < GLMAT_EPSILON) {
                            return null;
                        }
                        len = 1 / len;
                        x *= len;
                        y *= len;
                        z *= len;
                        s = Math.sin(rad);
                        c = Math.cos(rad);
                        t = 1 - c;
                        a00 = a[0];
                        a01 = a[1];
                        a02 = a[2];
                        a03 = a[3];
                        a10 = a[4];
                        a11 = a[5];
                        a12 = a[6];
                        a13 = a[7];
                        a20 = a[8];
                        a21 = a[9];
                        a22 = a[10];
                        a23 = a[11];
                        b00 = x * x * t + c;
                        b01 = y * x * t + z * s;
                        b02 = z * x * t - y * s;
                        b10 = x * y * t - z * s;
                        b11 = y * y * t + c;
                        b12 = z * y * t + x * s;
                        b20 = x * z * t + y * s;
                        b21 = y * z * t - x * s;
                        b22 = z * z * t + c;
                        out[0] = a00 * b00 + a10 * b01 + a20 * b02;
                        out[1] = a01 * b00 + a11 * b01 + a21 * b02;
                        out[2] = a02 * b00 + a12 * b01 + a22 * b02;
                        out[3] = a03 * b00 + a13 * b01 + a23 * b02;
                        out[4] = a00 * b10 + a10 * b11 + a20 * b12;
                        out[5] = a01 * b10 + a11 * b11 + a21 * b12;
                        out[6] = a02 * b10 + a12 * b11 + a22 * b12;
                        out[7] = a03 * b10 + a13 * b11 + a23 * b12;
                        out[8] = a00 * b20 + a10 * b21 + a20 * b22;
                        out[9] = a01 * b20 + a11 * b21 + a21 * b22;
                        out[10] = a02 * b20 + a12 * b21 + a22 * b22;
                        out[11] = a03 * b20 + a13 * b21 + a23 * b22;
                        if (a !== out) {
                            out[12] = a[12];
                            out[13] = a[13];
                            out[14] = a[14];
                            out[15] = a[15];
                        }
                        return out;
                    };
                    mat4.rotateX = function(out, a, rad) {
                        var s = Math.sin(rad),
                            c = Math.cos(rad),
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11];
                        if (a !== out) {
                            out[0] = a[0];
                            out[1] = a[1];
                            out[2] = a[2];
                            out[3] = a[3];
                            out[12] = a[12];
                            out[13] = a[13];
                            out[14] = a[14];
                            out[15] = a[15];
                        }
                        out[4] = a10 * c + a20 * s;
                        out[5] = a11 * c + a21 * s;
                        out[6] = a12 * c + a22 * s;
                        out[7] = a13 * c + a23 * s;
                        out[8] = a20 * c - a10 * s;
                        out[9] = a21 * c - a11 * s;
                        out[10] = a22 * c - a12 * s;
                        out[11] = a23 * c - a13 * s;
                        return out;
                    };
                    mat4.rotateY = function(out, a, rad) {
                        var s = Math.sin(rad),
                            c = Math.cos(rad),
                            a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a20 = a[8],
                            a21 = a[9],
                            a22 = a[10],
                            a23 = a[11];
                        if (a !== out) {
                            out[4] = a[4];
                            out[5] = a[5];
                            out[6] = a[6];
                            out[7] = a[7];
                            out[12] = a[12];
                            out[13] = a[13];
                            out[14] = a[14];
                            out[15] = a[15];
                        }
                        out[0] = a00 * c - a20 * s;
                        out[1] = a01 * c - a21 * s;
                        out[2] = a02 * c - a22 * s;
                        out[3] = a03 * c - a23 * s;
                        out[8] = a00 * s + a20 * c;
                        out[9] = a01 * s + a21 * c;
                        out[10] = a02 * s + a22 * c;
                        out[11] = a03 * s + a23 * c;
                        return out;
                    };
                    mat4.rotateZ = function(out, a, rad) {
                        var s = Math.sin(rad),
                            c = Math.cos(rad),
                            a00 = a[0],
                            a01 = a[1],
                            a02 = a[2],
                            a03 = a[3],
                            a10 = a[4],
                            a11 = a[5],
                            a12 = a[6],
                            a13 = a[7];
                        if (a !== out) {
                            out[8] = a[8];
                            out[9] = a[9];
                            out[10] = a[10];
                            out[11] = a[11];
                            out[12] = a[12];
                            out[13] = a[13];
                            out[14] = a[14];
                            out[15] = a[15];
                        }
                        out[0] = a00 * c + a10 * s;
                        out[1] = a01 * c + a11 * s;
                        out[2] = a02 * c + a12 * s;
                        out[3] = a03 * c + a13 * s;
                        out[4] = a10 * c - a00 * s;
                        out[5] = a11 * c - a01 * s;
                        out[6] = a12 * c - a02 * s;
                        out[7] = a13 * c - a03 * s;
                        return out;
                    };
                    mat4.fromRotationTranslation = function(out, q, v) {
                        var x = q[0],
                            y = q[1],
                            z = q[2],
                            w = q[3],
                            x2 = x + x,
                            y2 = y + y,
                            z2 = z + z,
                            xx = x * x2,
                            xy = x * y2,
                            xz = x * z2,
                            yy = y * y2,
                            yz = y * z2,
                            zz = z * z2,
                            wx = w * x2,
                            wy = w * y2,
                            wz = w * z2;
                        out[0] = 1 - (yy + zz);
                        out[1] = xy + wz;
                        out[2] = xz - wy;
                        out[3] = 0;
                        out[4] = xy - wz;
                        out[5] = 1 - (xx + zz);
                        out[6] = yz + wx;
                        out[7] = 0;
                        out[8] = xz + wy;
                        out[9] = yz - wx;
                        out[10] = 1 - (xx + yy);
                        out[11] = 0;
                        out[12] = v[0];
                        out[13] = v[1];
                        out[14] = v[2];
                        out[15] = 1;
                        return out;
                    };
                    mat4.frustum = function(out, left, right, bottom, top, near, far) {
                        var rl = 1 / (right - left),
                            tb = 1 / (top - bottom),
                            nf = 1 / (near - far);
                        out[0] = (near * 2) * rl;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 0;
                        out[4] = 0;
                        out[5] = (near * 2) * tb;
                        out[6] = 0;
                        out[7] = 0;
                        out[8] = (right + left) * rl;
                        out[9] = (top + bottom) * tb;
                        out[10] = (far + near) * nf;
                        out[11] = -1;
                        out[12] = 0;
                        out[13] = 0;
                        out[14] = (far * near * 2) * nf;
                        out[15] = 0;
                        return out;
                    };
                    mat4.perspective = function(out, fovy, aspect, near, far) {
                        var f = 1 / Math.tan(fovy / 2),
                            nf = 1 / (near - far);
                        out[0] = f / aspect;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 0;
                        out[4] = 0;
                        out[5] = f;
                        out[6] = 0;
                        out[7] = 0;
                        out[8] = 0;
                        out[9] = 0;
                        out[10] = (far + near) * nf;
                        out[11] = -1;
                        out[12] = 0;
                        out[13] = 0;
                        out[14] = (2 * far * near) * nf;
                        out[15] = 0;
                        return out;
                    };
                    mat4.ortho = function(out, left, right, bottom, top, near, far) {
                        var lr = 1 / (left - right),
                            bt = 1 / (bottom - top),
                            nf = 1 / (near - far);
                        out[0] = -2 * lr;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 0;
                        out[4] = 0;
                        out[5] = -2 * bt;
                        out[6] = 0;
                        out[7] = 0;
                        out[8] = 0;
                        out[9] = 0;
                        out[10] = 2 * nf;
                        out[11] = 0;
                        out[12] = (left + right) * lr;
                        out[13] = (top + bottom) * bt;
                        out[14] = (far + near) * nf;
                        out[15] = 1;
                        return out;
                    };
                    mat4.lookAt = function(out, eye, center, up) {
                        var x0, x1, x2, y0, y1, y2, z0, z1, z2, len, eyex = eye[0],
                            eyey = eye[1],
                            eyez = eye[2],
                            upx = up[0],
                            upy = up[1],
                            upz = up[2],
                            centerx = center[0],
                            centery = center[1],
                            centerz = center[2];
                        if (Math.abs(eyex - centerx) < GLMAT_EPSILON && Math.abs(eyey - centery) < GLMAT_EPSILON && Math.abs(eyez - centerz) < GLMAT_EPSILON) {
                            return mat4.identity(out);
                        }
                        z0 = eyex - centerx;
                        z1 = eyey - centery;
                        z2 = eyez - centerz;
                        len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
                        z0 *= len;
                        z1 *= len;
                        z2 *= len;
                        x0 = upy * z2 - upz * z1;
                        x1 = upz * z0 - upx * z2;
                        x2 = upx * z1 - upy * z0;
                        len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
                        if (!len) {
                            x0 = 0;
                            x1 = 0;
                            x2 = 0;
                        } else {
                            len = 1 / len;
                            x0 *= len;
                            x1 *= len;
                            x2 *= len;
                        }
                        y0 = z1 * x2 - z2 * x1;
                        y1 = z2 * x0 - z0 * x2;
                        y2 = z0 * x1 - z1 * x0;
                        len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
                        if (!len) {
                            y0 = 0;
                            y1 = 0;
                            y2 = 0;
                        } else {
                            len = 1 / len;
                            y0 *= len;
                            y1 *= len;
                            y2 *= len;
                        }
                        out[0] = x0;
                        out[1] = y0;
                        out[2] = z0;
                        out[3] = 0;
                        out[4] = x1;
                        out[5] = y1;
                        out[6] = z1;
                        out[7] = 0;
                        out[8] = x2;
                        out[9] = y2;
                        out[10] = z2;
                        out[11] = 0;
                        out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
                        out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
                        out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
                        out[15] = 1;
                        return out;
                    };
                    mat4.str = function(a) {
                        return "mat4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ", " + a[9] + ", " + a[10] + ", " + a[11] + ", " + a[12] + ", " + a[13] + ", " + a[14] + ", " + a[15] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.mat4 = mat4;
                    }
                    var quat = {};
                    var quatIdentity = new Float32Array([0, 0, 0, 1]);
                    if (!GLMAT_EPSILON) {
                        var GLMAT_EPSILON = 0.000001;
                    }
                    quat.create = function() {
                        return new Float32Array(quatIdentity);
                    };
                    quat.clone = vec4.clone;
                    quat.fromValues = vec4.fromValues;
                    quat.copy = vec4.copy;
                    quat.set = vec4.set;
                    quat.identity = function(out) {
                        out[0] = 0;
                        out[1] = 0;
                        out[2] = 0;
                        out[3] = 1;
                        return out;
                    };
                    quat.setAxisAngle = function(out, axis, rad) {
                        rad = rad * 0.5;
                        var s = Math.sin(rad);
                        out[0] = s * axis[0];
                        out[1] = s * axis[1];
                        out[2] = s * axis[2];
                        out[3] = Math.cos(rad);
                        return out;
                    };
                    quat.add = vec4.add;
                    quat.mul = quat.multiply = function(out, a, b) {
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3],
                            bx = b[0],
                            by = b[1],
                            bz = b[2],
                            bw = b[3];
                        out[0] = ax * bw + aw * bx + ay * bz - az * by;
                        out[1] = ay * bw + aw * by + az * bx - ax * bz;
                        out[2] = az * bw + aw * bz + ax * by - ay * bx;
                        out[3] = aw * bw - ax * bx - ay * by - az * bz;
                        return out;
                    };
                    quat.scale = vec4.scale;
                    quat.rotateX = function(out, a, rad) {
                        rad *= 0.5;
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3],
                            bx = Math.sin(rad),
                            bw = Math.cos(rad);
                        out[0] = ax * bw + aw * bx;
                        out[1] = ay * bw + az * bx;
                        out[2] = az * bw - ay * bx;
                        out[3] = aw * bw - ax * bx;
                        return out;
                    };
                    quat.rotateY = function(out, a, rad) {
                        rad *= 0.5;
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3],
                            by = Math.sin(rad),
                            bw = Math.cos(rad);
                        out[0] = ax * bw - az * by;
                        out[1] = ay * bw + aw * by;
                        out[2] = az * bw + ax * by;
                        out[3] = aw * bw - ay * by;
                        return out;
                    };
                    quat.rotateZ = function(out, a, rad) {
                        rad *= 0.5;
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3],
                            bz = Math.sin(rad),
                            bw = Math.cos(rad);
                        out[0] = ax * bw + ay * bz;
                        out[1] = ay * bw - ax * bz;
                        out[2] = az * bw + aw * bz;
                        out[3] = aw * bw - az * bz;
                        return out;
                    };
                    quat.calculateW = function(out, a) {
                        var x = a[0],
                            y = a[1],
                            z = a[2];
                        out[0] = x;
                        out[1] = y;
                        out[2] = z;
                        out[3] = -Math.sqrt(Math.abs(1 - x * x - y * y - z * z));
                        return out;
                    };
                    quat.dot = vec4.dot;
                    quat.lerp = vec4.lerp;
                    quat.slerp = function(out, a, b, t) {
                        var ax = a[0],
                            ay = a[1],
                            az = a[2],
                            aw = a[3],
                            bx = b[0],
                            by = b[1],
                            bz = b[2],
                            bw = a[3];
                        var cosHalfTheta = ax * bx + ay * by + az * bz + aw * bw,
                            halfTheta, sinHalfTheta, ratioA, ratioB;
                        if (Math.abs(cosHalfTheta) >= 1) {
                            if (out !== a) {
                                out[0] = ax;
                                out[1] = ay;
                                out[2] = az;
                                out[3] = aw;
                            }
                            return out;
                        }
                        halfTheta = Math.acos(cosHalfTheta);
                        sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
                        if (Math.abs(sinHalfTheta) < 0.001) {
                            out[0] = (ax * 0.5 + bx * 0.5);
                            out[1] = (ay * 0.5 + by * 0.5);
                            out[2] = (az * 0.5 + bz * 0.5);
                            out[3] = (aw * 0.5 + bw * 0.5);
                            return out;
                        }
                        ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
                        ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
                        out[0] = (ax * ratioA + bx * ratioB);
                        out[1] = (ay * ratioA + by * ratioB);
                        out[2] = (az * ratioA + bz * ratioB);
                        out[3] = (aw * ratioA + bw * ratioB);
                        return out;
                    };
                    quat.invert = function(out, a) {
                        var a0 = a[0],
                            a1 = a[1],
                            a2 = a[2],
                            a3 = a[3],
                            dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3,
                            invDot = dot ? 1 / dot : 0;
                        out[0] = -a0 * invDot;
                        out[1] = -a1 * invDot;
                        out[2] = -a2 * invDot;
                        out[3] = a3 * invDot;
                        return out;
                    };
                    quat.conjugate = function(out, a) {
                        out[0] = -a[0];
                        out[1] = -a[1];
                        out[2] = -a[2];
                        out[3] = a[3];
                        return out;
                    };
                    quat.len = quat.length = vec4.length;
                    quat.sqrLen = quat.squaredLength = vec4.squaredLength;
                    quat.normalize = vec4.normalize;
                    quat.str = function(a) {
                        return "quat(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
                    };
                    if (typeof(exports) !== "undefined") {
                        exports.quat = quat;
                    }
                })(shim.exports);
            })();
        })();
    }, {}],
    20: [function(require, module, exports) {
        (function() {
            (function() {
                var root = this;
                var previousUnderscore = root._;
                var breaker = {};
                var ArrayProto = Array.prototype,
                    ObjProto = Object.prototype,
                    FuncProto = Function.prototype;
                var push = ArrayProto.push,
                    slice = ArrayProto.slice,
                    concat = ArrayProto.concat,
                    toString = ObjProto.toString,
                    hasOwnProperty = ObjProto.hasOwnProperty;
                var nativeForEach = ArrayProto.forEach,
                    nativeMap = ArrayProto.map,
                    nativeReduce = ArrayProto.reduce,
                    nativeReduceRight = ArrayProto.reduceRight,
                    nativeFilter = ArrayProto.filter,
                    nativeEvery = ArrayProto.every,
                    nativeSome = ArrayProto.some,
                    nativeIndexOf = ArrayProto.indexOf,
                    nativeLastIndexOf = ArrayProto.lastIndexOf,
                    nativeIsArray = Array.isArray,
                    nativeKeys = Object.keys,
                    nativeBind = FuncProto.bind;
                var _ = function(obj) {
                    if (obj instanceof _) {
                        return obj;
                    }
                    if (!(this instanceof _)) {
                        return new _(obj);
                    }
                    this._wrapped = obj;
                };
                if (typeof exports !== "undefined") {
                    if (typeof module !== "undefined" && module.exports) {
                        exports = module.exports = _;
                    }
                    exports._ = _;
                } else {
                    root._ = _;
                }
                _.VERSION = "1.4.4";
                var each = _.each = _.forEach = function(obj, iterator, context) {
                    if (obj == null) {
                        return;
                    }
                    if (nativeForEach && obj.forEach === nativeForEach) {
                        obj.forEach(iterator, context);
                    } else {
                        if (obj.length === +obj.length) {
                            for (var i = 0, l = obj.length; i < l; i++) {
                                if (iterator.call(context, obj[i], i, obj) === breaker) {
                                    return;
                                }
                            }
                        } else {
                            for (var key in obj) {
                                if (_.has(obj, key)) {
                                    if (iterator.call(context, obj[key], key, obj) === breaker) {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                };
                _.map = _.collect = function(obj, iterator, context) {
                    var results = [];
                    if (obj == null) {
                        return results;
                    }
                    if (nativeMap && obj.map === nativeMap) {
                        return obj.map(iterator, context);
                    }
                    each(obj, function(value, index, list) {
                        results[results.length] = iterator.call(context, value, index, list);
                    });
                    return results;
                };
                var reduceError = "Reduce of empty array with no initial value";
                _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
                    var initial = arguments.length > 2;
                    if (obj == null) {
                        obj = [];
                    }
                    if (nativeReduce && obj.reduce === nativeReduce) {
                        if (context) {
                            iterator = _.bind(iterator, context);
                        }
                        return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
                    }
                    each(obj, function(value, index, list) {
                        if (!initial) {
                            memo = value;
                            initial = true;
                        } else {
                            memo = iterator.call(context, memo, value, index, list);
                        }
                    });
                    if (!initial) {
                        throw new TypeError(reduceError);
                    }
                    return memo;
                };
                _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
                    var initial = arguments.length > 2;
                    if (obj == null) {
                        obj = [];
                    }
                    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
                        if (context) {
                            iterator = _.bind(iterator, context);
                        }
                        return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
                    }
                    var length = obj.length;
                    if (length !== +length) {
                        var keys = _.keys(obj);
                        length = keys.length;
                    }
                    each(obj, function(value, index, list) {
                        index = keys ? keys[--length] : --length;
                        if (!initial) {
                            memo = obj[index];
                            initial = true;
                        } else {
                            memo = iterator.call(context, memo, obj[index], index, list);
                        }
                    });
                    if (!initial) {
                        throw new TypeError(reduceError);
                    }
                    return memo;
                };
                _.find = _.detect = function(obj, iterator, context) {
                    var result;
                    any(obj, function(value, index, list) {
                        if (iterator.call(context, value, index, list)) {
                            result = value;
                            return true;
                        }
                    });
                    return result;
                };
                _.filter = _.select = function(obj, iterator, context) {
                    var results = [];
                    if (obj == null) {
                        return results;
                    }
                    if (nativeFilter && obj.filter === nativeFilter) {
                        return obj.filter(iterator, context);
                    }
                    each(obj, function(value, index, list) {
                        if (iterator.call(context, value, index, list)) {
                            results[results.length] = value;
                        }
                    });
                    return results;
                };
                _.reject = function(obj, iterator, context) {
                    return _.filter(obj, function(value, index, list) {
                        return !iterator.call(context, value, index, list);
                    }, context);
                };
                _.every = _.all = function(obj, iterator, context) {
                    iterator || (iterator = _.identity);
                    var result = true;
                    if (obj == null) {
                        return result;
                    }
                    if (nativeEvery && obj.every === nativeEvery) {
                        return obj.every(iterator, context);
                    }
                    each(obj, function(value, index, list) {
                        if (!(result = result && iterator.call(context, value, index, list))) {
                            return breaker;
                        }
                    });
                    return !!result;
                };
                var any = _.some = _.any = function(obj, iterator, context) {
                    iterator || (iterator = _.identity);
                    var result = false;
                    if (obj == null) {
                        return result;
                    }
                    if (nativeSome && obj.some === nativeSome) {
                        return obj.some(iterator, context);
                    }
                    each(obj, function(value, index, list) {
                        if (result || (result = iterator.call(context, value, index, list))) {
                            return breaker;
                        }
                    });
                    return !!result;
                };
                _.contains = _.include = function(obj, target) {
                    if (obj == null) {
                        return false;
                    }
                    if (nativeIndexOf && obj.indexOf === nativeIndexOf) {
                        return obj.indexOf(target) != -1;
                    }
                    return any(obj, function(value) {
                        return value === target;
                    });
                };
                _.invoke = function(obj, method) {
                    var args = slice.call(arguments, 2);
                    var isFunc = _.isFunction(method);
                    return _.map(obj, function(value) {
                        return (isFunc ? method : value[method]).apply(value, args);
                    });
                };
                _.pluck = function(obj, key) {
                    return _.map(obj, function(value) {
                        return value[key];
                    });
                };
                _.where = function(obj, attrs, first) {
                    if (_.isEmpty(attrs)) {
                        return first ? null : [];
                    }
                    return _[first ? "find" : "filter"](obj, function(value) {
                        for (var key in attrs) {
                            if (attrs[key] !== value[key]) {
                                return false;
                            }
                        }
                        return true;
                    });
                };
                _.findWhere = function(obj, attrs) {
                    return _.where(obj, attrs, true);
                };
                _.max = function(obj, iterator, context) {
                    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
                        return Math.max.apply(Math, obj);
                    }
                    if (!iterator && _.isEmpty(obj)) {
                        return -Infinity;
                    }
                    var result = {
                        computed: -Infinity,
                        value: -Infinity
                    };
                    each(obj, function(value, index, list) {
                        var computed = iterator ? iterator.call(context, value, index, list) : value;
                        computed >= result.computed && (result = {
                            value: value,
                            computed: computed
                        });
                    });
                    return result.value;
                };
                _.min = function(obj, iterator, context) {
                    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
                        return Math.min.apply(Math, obj);
                    }
                    if (!iterator && _.isEmpty(obj)) {
                        return Infinity;
                    }
                    var result = {
                        computed: Infinity,
                        value: Infinity
                    };
                    each(obj, function(value, index, list) {
                        var computed = iterator ? iterator.call(context, value, index, list) : value;
                        computed < result.computed && (result = {
                            value: value,
                            computed: computed
                        });
                    });
                    return result.value;
                };
                _.shuffle = function(obj) {
                    var rand;
                    var index = 0;
                    var shuffled = [];
                    each(obj, function(value) {
                        rand = _.random(index++);
                        shuffled[index - 1] = shuffled[rand];
                        shuffled[rand] = value;
                    });
                    return shuffled;
                };
                var lookupIterator = function(value) {
                    return _.isFunction(value) ? value : function(obj) {
                        return obj[value];
                    };
                };
                _.sortBy = function(obj, value, context) {
                    var iterator = lookupIterator(value);
                    return _.pluck(_.map(obj, function(value, index, list) {
                        return {
                            value: value,
                            index: index,
                            criteria: iterator.call(context, value, index, list)
                        };
                    }).sort(function(left, right) {
                        var a = left.criteria;
                        var b = right.criteria;
                        if (a !== b) {
                            if (a > b || a === void 0) {
                                return 1;
                            }
                            if (a < b || b === void 0) {
                                return -1;
                            }
                        }
                        return left.index < right.index ? -1 : 1;
                    }), "value");
                };
                var group = function(obj, value, context, behavior) {
                    var result = {};
                    var iterator = lookupIterator(value || _.identity);
                    each(obj, function(value, index) {
                        var key = iterator.call(context, value, index, obj);
                        behavior(result, key, value);
                    });
                    return result;
                };
                _.groupBy = function(obj, value, context) {
                    return group(obj, value, context, function(result, key, value) {
                        (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
                    });
                };
                _.countBy = function(obj, value, context) {
                    return group(obj, value, context, function(result, key) {
                        if (!_.has(result, key)) {
                            result[key] = 0;
                        }
                        result[key]++;
                    });
                };
                _.sortedIndex = function(array, obj, iterator, context) {
                    iterator = iterator == null ? _.identity : lookupIterator(iterator);
                    var value = iterator.call(context, obj);
                    var low = 0,
                        high = array.length;
                    while (low < high) {
                        var mid = (low + high) >>> 1;
                        iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
                    }
                    return low;
                };
                _.toArray = function(obj) {
                    if (!obj) {
                        return [];
                    }
                    if (_.isArray(obj)) {
                        return slice.call(obj);
                    }
                    if (obj.length === +obj.length) {
                        return _.map(obj, _.identity);
                    }
                    return _.values(obj);
                };
                _.size = function(obj) {
                    if (obj == null) {
                        return 0;
                    }
                    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
                };
                _.first = _.head = _.take = function(array, n, guard) {
                    if (array == null) {
                        return void 0;
                    }
                    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
                };
                _.initial = function(array, n, guard) {
                    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
                };
                _.last = function(array, n, guard) {
                    if (array == null) {
                        return void 0;
                    }
                    if ((n != null) && !guard) {
                        return slice.call(array, Math.max(array.length - n, 0));
                    } else {
                        return array[array.length - 1];
                    }
                };
                _.rest = _.tail = _.drop = function(array, n, guard) {
                    return slice.call(array, (n == null) || guard ? 1 : n);
                };
                _.compact = function(array) {
                    return _.filter(array, _.identity);
                };
                var flatten = function(input, shallow, output) {
                    each(input, function(value) {
                        if (_.isArray(value)) {
                            shallow ? push.apply(output, value) : flatten(value, shallow, output);
                        } else {
                            output.push(value);
                        }
                    });
                    return output;
                };
                _.flatten = function(array, shallow) {
                    return flatten(array, shallow, []);
                };
                _.without = function(array) {
                    return _.difference(array, slice.call(arguments, 1));
                };
                _.uniq = _.unique = function(array, isSorted, iterator, context) {
                    if (_.isFunction(isSorted)) {
                        context = iterator;
                        iterator = isSorted;
                        isSorted = false;
                    }
                    var initial = iterator ? _.map(array, iterator, context) : array;
                    var results = [];
                    var seen = [];
                    each(initial, function(value, index) {
                        if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
                            seen.push(value);
                            results.push(array[index]);
                        }
                    });
                    return results;
                };
                _.union = function() {
                    return _.uniq(concat.apply(ArrayProto, arguments));
                };
                _.intersection = function(array) {
                    var rest = slice.call(arguments, 1);
                    return _.filter(_.uniq(array), function(item) {
                        return _.every(rest, function(other) {
                            return _.indexOf(other, item) >= 0;
                        });
                    });
                };
                _.difference = function(array) {
                    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
                    return _.filter(array, function(value) {
                        return !_.contains(rest, value);
                    });
                };
                _.zip = function() {
                    var args = slice.call(arguments);
                    var length = _.max(_.pluck(args, "length"));
                    var results = new Array(length);
                    for (var i = 0; i < length; i++) {
                        results[i] = _.pluck(args, "" + i);
                    }
                    return results;
                };
                _.object = function(list, values) {
                    if (list == null) {
                        return {};
                    }
                    var result = {};
                    for (var i = 0, l = list.length; i < l; i++) {
                        if (values) {
                            result[list[i]] = values[i];
                        } else {
                            result[list[i][0]] = list[i][1];
                        }
                    }
                    return result;
                };
                _.indexOf = function(array, item, isSorted) {
                    if (array == null) {
                        return -1;
                    }
                    var i = 0,
                        l = array.length;
                    if (isSorted) {
                        if (typeof isSorted == "number") {
                            i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
                        } else {
                            i = _.sortedIndex(array, item);
                            return array[i] === item ? i : -1;
                        }
                    }
                    if (nativeIndexOf && array.indexOf === nativeIndexOf) {
                        return array.indexOf(item, isSorted);
                    }
                    for (; i < l; i++) {
                        if (array[i] === item) {
                            return i;
                        }
                    }
                    return -1;
                };
                _.lastIndexOf = function(array, item, from) {
                    if (array == null) {
                        return -1;
                    }
                    var hasIndex = from != null;
                    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
                        return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
                    }
                    var i = (hasIndex ? from : array.length);
                    while (i--) {
                        if (array[i] === item) {
                            return i;
                        }
                    }
                    return -1;
                };
                _.range = function(start, stop, step) {
                    if (arguments.length <= 1) {
                        stop = start || 0;
                        start = 0;
                    }
                    step = arguments[2] || 1;
                    var len = Math.max(Math.ceil((stop - start) / step), 0);
                    var idx = 0;
                    var range = new Array(len);
                    while (idx < len) {
                        range[idx++] = start;
                        start += step;
                    }
                    return range;
                };
                _.bind = function(func, context) {
                    if (func.bind === nativeBind && nativeBind) {
                        return nativeBind.apply(func, slice.call(arguments, 1));
                    }
                    var args = slice.call(arguments, 2);
                    return function() {
                        return func.apply(context, args.concat(slice.call(arguments)));
                    };
                };
                _.partial = function(func) {
                    var args = slice.call(arguments, 1);
                    return function() {
                        return func.apply(this, args.concat(slice.call(arguments)));
                    };
                };
                _.bindAll = function(obj) {
                    var funcs = slice.call(arguments, 1);
                    if (funcs.length === 0) {
                        funcs = _.functions(obj);
                    }
                    each(funcs, function(f) {
                        obj[f] = _.bind(obj[f], obj);
                    });
                    return obj;
                };
                _.memoize = function(func, hasher) {
                    var memo = {};
                    hasher || (hasher = _.identity);
                    return function() {
                        var key = hasher.apply(this, arguments);
                        return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
                    };
                };
                _.delay = function(func, wait) {
                    var args = slice.call(arguments, 2);
                    return setTimeout(function() {
                        return func.apply(null, args);
                    }, wait);
                };
                _.defer = function(func) {
                    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
                };
                _.throttle = function(func, wait) {
                    var context, args, timeout, result;
                    var previous = 0;
                    var later = function() {
                        previous = new Date;
                        timeout = null;
                        result = func.apply(context, args);
                    };
                    return function() {
                        var now = new Date;
                        var remaining = wait - (now - previous);
                        context = this;
                        args = arguments;
                        if (remaining <= 0) {
                            clearTimeout(timeout);
                            timeout = null;
                            previous = now;
                            result = func.apply(context, args);
                        } else {
                            if (!timeout) {
                                timeout = setTimeout(later, remaining);
                            }
                        }
                        return result;
                    };
                };
                _.debounce = function(func, wait, immediate) {
                    var timeout, result;
                    return function() {
                        var context = this,
                            args = arguments;
                        var later = function() {
                            timeout = null;
                            if (!immediate) {
                                result = func.apply(context, args);
                            }
                        };
                        var callNow = immediate && !timeout;
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                        if (callNow) {
                            result = func.apply(context, args);
                        }
                        return result;
                    };
                };
                _.once = function(func) {
                    var ran = false,
                        memo;
                    return function() {
                        if (ran) {
                            return memo;
                        }
                        ran = true;
                        memo = func.apply(this, arguments);
                        func = null;
                        return memo;
                    };
                };
                _.wrap = function(func, wrapper) {
                    return function() {
                        var args = [func];
                        push.apply(args, arguments);
                        return wrapper.apply(this, args);
                    };
                };
                _.compose = function() {
                    var funcs = arguments;
                    return function() {
                        var args = arguments;
                        for (var i = funcs.length - 1; i >= 0; i--) {
                            args = [funcs[i].apply(this, args)];
                        }
                        return args[0];
                    };
                };
                _.after = function(times, func) {
                    if (times <= 0) {
                        return func();
                    }
                    return function() {
                        if (--times < 1) {
                            return func.apply(this, arguments);
                        }
                    };
                };
                _.keys = nativeKeys || function(obj) {
                    if (obj !== Object(obj)) {
                        throw new TypeError("Invalid object");
                    }
                    var keys = [];
                    for (var key in obj) {
                        if (_.has(obj, key)) {
                            keys[keys.length] = key;
                        }
                    }
                    return keys;
                };
                _.values = function(obj) {
                    var values = [];
                    for (var key in obj) {
                        if (_.has(obj, key)) {
                            values.push(obj[key]);
                        }
                    }
                    return values;
                };
                _.pairs = function(obj) {
                    var pairs = [];
                    for (var key in obj) {
                        if (_.has(obj, key)) {
                            pairs.push([key, obj[key]]);
                        }
                    }
                    return pairs;
                };
                _.invert = function(obj) {
                    var result = {};
                    for (var key in obj) {
                        if (_.has(obj, key)) {
                            result[obj[key]] = key;
                        }
                    }
                    return result;
                };
                _.functions = _.methods = function(obj) {
                    var names = [];
                    for (var key in obj) {
                        if (_.isFunction(obj[key])) {
                            names.push(key);
                        }
                    }
                    return names.sort();
                };
                _.extend = function(obj) {
                    each(slice.call(arguments, 1), function(source) {
                        if (source) {
                            for (var prop in source) {
                                obj[prop] = source[prop];
                            }
                        }
                    });
                    return obj;
                };
                _.pick = function(obj) {
                    var copy = {};
                    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
                    each(keys, function(key) {
                        if (key in obj) {
                            copy[key] = obj[key];
                        }
                    });
                    return copy;
                };
                _.omit = function(obj) {
                    var copy = {};
                    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
                    for (var key in obj) {
                        if (!_.contains(keys, key)) {
                            copy[key] = obj[key];
                        }
                    }
                    return copy;
                };
                _.defaults = function(obj) {
                    each(slice.call(arguments, 1), function(source) {
                        if (source) {
                            for (var prop in source) {
                                if (obj[prop] == null) {
                                    obj[prop] = source[prop];
                                }
                            }
                        }
                    });
                    return obj;
                };
                _.clone = function(obj) {
                    if (!_.isObject(obj)) {
                        return obj;
                    }
                    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
                };
                _.tap = function(obj, interceptor) {
                    interceptor(obj);
                    return obj;
                };
                var eq = function(a, b, aStack, bStack) {
                    if (a === b) {
                        return a !== 0 || 1 / a == 1 / b;
                    }
                    if (a == null || b == null) {
                        return a === b;
                    }
                    if (a instanceof _) {
                        a = a._wrapped;
                    }
                    if (b instanceof _) {
                        b = b._wrapped;
                    }
                    var className = toString.call(a);
                    if (className != toString.call(b)) {
                        return false;
                    }
                    switch (className) {
                        case "[object String]":
                            return a == String(b);
                        case "[object Number]":
                            return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
                        case "[object Date]":
                        case "[object Boolean]":
                            return +a == +b;
                        case "[object RegExp]":
                            return a.source == b.source && a.global == b.global && a.multiline == b.multiline && a.ignoreCase == b.ignoreCase;
                    }
                    if (typeof a != "object" || typeof b != "object") {
                        return false;
                    }
                    var length = aStack.length;
                    while (length--) {
                        if (aStack[length] == a) {
                            return bStack[length] == b;
                        }
                    }
                    aStack.push(a);
                    bStack.push(b);
                    var size = 0,
                        result = true;
                    if (className == "[object Array]") {
                        size = a.length;
                        result = size == b.length;
                        if (result) {
                            while (size--) {
                                if (!(result = eq(a[size], b[size], aStack, bStack))) {
                                    break;
                                }
                            }
                        }
                    } else {
                        var aCtor = a.constructor,
                            bCtor = b.constructor;
                        if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) && _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
                            return false;
                        }
                        for (var key in a) {
                            if (_.has(a, key)) {
                                size++;
                                if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) {
                                    break;
                                }
                            }
                        }
                        if (result) {
                            for (key in b) {
                                if (_.has(b, key) && !(size--)) {
                                    break;
                                }
                            }
                            result = !size;
                        }
                    }
                    aStack.pop();
                    bStack.pop();
                    return result;
                };
                _.isEqual = function(a, b) {
                    return eq(a, b, [], []);
                };
                _.isEmpty = function(obj) {
                    if (obj == null) {
                        return true;
                    }
                    if (_.isArray(obj) || _.isString(obj)) {
                        return obj.length === 0;
                    }
                    for (var key in obj) {
                        if (_.has(obj, key)) {
                            return false;
                        }
                    }
                    return true;
                };
                _.isElement = function(obj) {
                    return !!(obj && obj.nodeType === 1);
                };
                _.isArray = nativeIsArray || function(obj) {
                    return toString.call(obj) == "[object Array]";
                };
                _.isObject = function(obj) {
                    return obj === Object(obj);
                };
                each(["Arguments", "Function", "String", "Number", "Date", "RegExp"], function(name) {
                    _["is" + name] = function(obj) {
                        return toString.call(obj) == "[object " + name + "]";
                    };
                });
                if (!_.isArguments(arguments)) {
                    _.isArguments = function(obj) {
                        return !!(obj && _.has(obj, "callee"));
                    };
                }
                if (typeof(/./) !== "function") {
                    _.isFunction = function(obj) {
                        return typeof obj === "function";
                    };
                }
                _.isFinite = function(obj) {
                    return isFinite(obj) && !isNaN(parseFloat(obj));
                };
                _.isNaN = function(obj) {
                    return _.isNumber(obj) && obj != +obj;
                };
                _.isBoolean = function(obj) {
                    return obj === true || obj === false || toString.call(obj) == "[object Boolean]";
                };
                _.isNull = function(obj) {
                    return obj === null;
                };
                _.isUndefined = function(obj) {
                    return obj === void 0;
                };
                _.has = function(obj, key) {
                    return hasOwnProperty.call(obj, key);
                };
                _.noConflict = function() {
                    root._ = previousUnderscore;
                    return this;
                };
                _.identity = function(value) {
                    return value;
                };
                _.times = function(n, iterator, context) {
                    var accum = Array(n);
                    for (var i = 0; i < n; i++) {
                        accum[i] = iterator.call(context, i);
                    }
                    return accum;
                };
                _.random = function(min, max) {
                    if (max == null) {
                        max = min;
                        min = 0;
                    }
                    return min + Math.floor(Math.random() * (max - min + 1));
                };
                var entityMap = {
                    escape: {
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#x27;",
                        "/": "&#x2F;"
                    }
                };
                entityMap.unescape = _.invert(entityMap.escape);
                var entityRegexes = {
                    escape: new RegExp("[" + _.keys(entityMap.escape).join("") + "]", "g"),
                    unescape: new RegExp("(" + _.keys(entityMap.unescape).join("|") + ")", "g")
                };
                _.each(["escape", "unescape"], function(method) {
                    _[method] = function(string) {
                        if (string == null) {
                            return "";
                        }
                        return ("" + string).replace(entityRegexes[method], function(match) {
                            return entityMap[method][match];
                        });
                    };
                });
                _.result = function(object, property) {
                    if (object == null) {
                        return null;
                    }
                    var value = object[property];
                    return _.isFunction(value) ? value.call(object) : value;
                };
                _.mixin = function(obj) {
                    each(_.functions(obj), function(name) {
                        var func = _[name] = obj[name];
                        _.prototype[name] = function() {
                            var args = [this._wrapped];
                            push.apply(args, arguments);
                            return result.call(this, func.apply(_, args));
                        };
                    });
                };
                var idCounter = 0;
                _.uniqueId = function(prefix) {
                    var id = ++idCounter + "";
                    return prefix ? prefix + id : id;
                };
                _.templateSettings = {
                    evaluate: /<%([\s\S]+?)%>/g,
                    interpolate: /<%=([\s\S]+?)%>/g,
                    escape: /<%-([\s\S]+?)%>/g
                };
                var noMatch = /(.)^/;
                var escapes = {
                    "'": "'",
                    "\\": "\\",
                    "\r": "r",
                    "\n": "n",
                    "\t": "t",
                    "\u2028": "u2028",
                    "\u2029": "u2029"
                };
                var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
                _.template = function(text, data, settings) {
                    var render;
                    settings = _.defaults({}, settings, _.templateSettings);
                    var matcher = new RegExp([(settings.escape || noMatch).source, (settings.interpolate || noMatch).source, (settings.evaluate || noMatch).source].join("|") + "|$", "g");
                    var index = 0;
                    var source = "__p+='";
                    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
                        source += text.slice(index, offset).replace(escaper, function(match) {
                            return "\\" + escapes[match];
                        });
                        if (escape) {
                            source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
                        }
                        if (interpolate) {
                            source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
                        }
                        if (evaluate) {
                            source += "';\n" + evaluate + "\n__p+='";
                        }
                        index = offset + match.length;
                        return match;
                    });
                    source += "';\n";
                    if (!settings.variable) {
                        source = "with(obj||{}){\n" + source + "}\n";
                    }
                    source = "var __t,__p='',__j=Array.prototype.join," + "print=function(){__p+=__j.call(arguments,'');};\n" + source + "return __p;\n";
                    try {
                        render = new Function(settings.variable || "obj", "_", source);
                    } catch (e) {
                        e.source = source;
                        throw e;
                    }
                    if (data) {
                        return render(data, _);
                    }
                    var template = function(data) {
                        return render.call(this, data, _);
                    };
                    template.source = "function(" + (settings.variable || "obj") + "){\n" + source + "}";
                    return template;
                };
                _.chain = function(obj) {
                    return _(obj).chain();
                };
                var result = function(obj) {
                    return this._chain ? _(obj).chain() : obj;
                };
                _.mixin(_);
                each(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function(name) {
                    var method = ArrayProto[name];
                    _.prototype[name] = function() {
                        var obj = this._wrapped;
                        method.apply(obj, arguments);
                        if ((name == "shift" || name == "splice") && obj.length === 0) {
                            delete obj[0];
                        }
                        return result.call(this, obj);
                    };
                });
                each(["concat", "join", "slice"], function(name) {
                    var method = ArrayProto[name];
                    _.prototype[name] = function() {
                        return result.call(this, method.apply(this._wrapped, arguments));
                    };
                });
                _.extend(_.prototype, {
                    chain: function() {
                        this._chain = true;
                        return this;
                    },
                    value: function() {
                        return this._wrapped;
                    }
                });
            }).call(this);
        })();
    }, {}],
    21: [function(require, module, exports) {
        window.requestAnimFrame = (function() {
            return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
        })();
        Leap = require("../lib/index");
    }, {
        "../lib/index": 8
    }]
}, {}, [21]);
var Detector = {
    canvas: !!window.CanvasRenderingContext2D,
    webgl: (function() {
        try {
            return !!window.WebGLRenderingContext && !!document.createElement("canvas").getContext("experimental-webgl");
        } catch (e) {
            return false;
        }
    })(),
    workers: !!window.Worker,
    fileapi: window.File && window.FileReader && window.FileList && window.Blob,
    getWebGLErrorMessage: function() {
        var element = document.createElement("div");
        element.id = "webgl-error-message";
        element.style.fontFamily = "monospace";
        element.style.fontSize = "13px";
        element.style.fontWeight = "normal";
        element.style.textAlign = "center";
        element.style.background = "#fff";
        element.style.color = "#000";
        element.style.padding = "1.5em";
        element.style.width = "400px";
        element.style.margin = "5em auto 0";
        if (!this.webgl) {
            element.innerHTML = window.WebGLRenderingContext ? ['Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />', 'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'].join("\n") : ['Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>', 'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'].join("\n");
        }
        return element;
    },
    addGetWebGLMessage: function(parameters) {
        var parent, id, element;
        parameters = parameters || {};
        parent = parameters.parent !== undefined ? parameters.parent : document.body;
        id = parameters.id !== undefined ? parameters.id : "oldie";
        element = Detector.getWebGLErrorMessage();
        element.id = id;
        parent.appendChild(element);
    }
};
//three.js - http://github.com/mrdoob/three.js
'use strict';
var THREE = THREE || {
    REVISION: "60"
};
self.console = self.console || {
    info: function() {},
    log: function() {},
    debug: function() {},
    warn: function() {},
    error: function() {}
};
String.prototype.trim = String.prototype.trim || function() {
    return this.replace(/^\s+|\s+$/g, "")
};
THREE.extend = function(a, b) {
    if (Object.keys)
        for (var c = Object.keys(b), d = 0, e = c.length; d < e; d++) {
            var f = c[d];
            Object.defineProperty(a, f, Object.getOwnPropertyDescriptor(b, f))
        } else
            for (f in c = {}.hasOwnProperty, b) c.call(b, f) && (a[f] = b[f]);
    return a
};
(function() {
    for (var a = 0, b = ["ms", "moz", "webkit", "o"], c = 0; c < b.length && !self.requestAnimationFrame; ++c) self.requestAnimationFrame = self[b[c] + "RequestAnimationFrame"], self.cancelAnimationFrame = self[b[c] + "CancelAnimationFrame"] || self[b[c] + "CancelRequestAnimationFrame"];
    void 0 === self.requestAnimationFrame && void 0 !== self.setTimeout && (self.requestAnimationFrame = function(b) {
        var c = Date.now(),
            f = Math.max(0, 16 - (c - a)),
            h = self.setTimeout(function() {
                b(c + f)
            }, f);
        a = c + f;
        return h
    });
    void 0 === self.cancelAnimationFrame && void 0 !==
        self.clearTimeout && (self.cancelAnimationFrame = function(a) {
            self.clearTimeout(a)
        })
})();
THREE.CullFaceNone = 0;
THREE.CullFaceBack = 1;
THREE.CullFaceFront = 2;
THREE.CullFaceFrontBack = 3;
THREE.FrontFaceDirectionCW = 0;
THREE.FrontFaceDirectionCCW = 1;
THREE.BasicShadowMap = 0;
THREE.PCFShadowMap = 1;
THREE.PCFSoftShadowMap = 2;
THREE.FrontSide = 0;
THREE.BackSide = 1;
THREE.DoubleSide = 2;
THREE.NoShading = 0;
THREE.FlatShading = 1;
THREE.SmoothShading = 2;
THREE.NoColors = 0;
THREE.FaceColors = 1;
THREE.VertexColors = 2;
THREE.NoBlending = 0;
THREE.NormalBlending = 1;
THREE.AdditiveBlending = 2;
THREE.SubtractiveBlending = 3;
THREE.MultiplyBlending = 4;
THREE.CustomBlending = 5;
THREE.AddEquation = 100;
THREE.SubtractEquation = 101;
THREE.ReverseSubtractEquation = 102;
THREE.ZeroFactor = 200;
THREE.OneFactor = 201;
THREE.SrcColorFactor = 202;
THREE.OneMinusSrcColorFactor = 203;
THREE.SrcAlphaFactor = 204;
THREE.OneMinusSrcAlphaFactor = 205;
THREE.DstAlphaFactor = 206;
THREE.OneMinusDstAlphaFactor = 207;
THREE.DstColorFactor = 208;
THREE.OneMinusDstColorFactor = 209;
THREE.SrcAlphaSaturateFactor = 210;
THREE.MultiplyOperation = 0;
THREE.MixOperation = 1;
THREE.AddOperation = 2;
THREE.UVMapping = function() {};
THREE.CubeReflectionMapping = function() {};
THREE.CubeRefractionMapping = function() {};
THREE.SphericalReflectionMapping = function() {};
THREE.SphericalRefractionMapping = function() {};
THREE.RepeatWrapping = 1E3;
THREE.ClampToEdgeWrapping = 1001;
THREE.MirroredRepeatWrapping = 1002;
THREE.NearestFilter = 1003;
THREE.NearestMipMapNearestFilter = 1004;
THREE.NearestMipMapLinearFilter = 1005;
THREE.LinearFilter = 1006;
THREE.LinearMipMapNearestFilter = 1007;
THREE.LinearMipMapLinearFilter = 1008;
THREE.UnsignedByteType = 1009;
THREE.ByteType = 1010;
THREE.ShortType = 1011;
THREE.UnsignedShortType = 1012;
THREE.IntType = 1013;
THREE.UnsignedIntType = 1014;
THREE.FloatType = 1015;
THREE.UnsignedShort4444Type = 1016;
THREE.UnsignedShort5551Type = 1017;
THREE.UnsignedShort565Type = 1018;
THREE.AlphaFormat = 1019;
THREE.RGBFormat = 1020;
THREE.RGBAFormat = 1021;
THREE.LuminanceFormat = 1022;
THREE.LuminanceAlphaFormat = 1023;
THREE.RGB_S3TC_DXT1_Format = 2001;
THREE.RGBA_S3TC_DXT1_Format = 2002;
THREE.RGBA_S3TC_DXT3_Format = 2003;
THREE.RGBA_S3TC_DXT5_Format = 2004;
THREE.Color = function(a) {
    void 0 !== a && this.set(a);
    return this
};
THREE.Color.prototype = {
    constructor: THREE.Color,
    r: 1,
    g: 1,
    b: 1,
    set: function(a) {
        a instanceof THREE.Color ? this.copy(a) : "number" === typeof a ? this.setHex(a) : "string" === typeof a && this.setStyle(a);
        return this
    },
    setHex: function(a) {
        a = Math.floor(a);
        this.r = (a >> 16 & 255) / 255;
        this.g = (a >> 8 & 255) / 255;
        this.b = (a & 255) / 255;
        return this
    },
    setRGB: function(a, b, c) {
        this.r = a;
        this.g = b;
        this.b = c;
        return this
    },
    setHSL: function(a, b, c) {
        if (0 === b) this.r = this.g = this.b = c;
        else {
            var d = function(a, b, c) {
                    0 > c && (c += 1);
                    1 < c && (c -= 1);
                    return c < 1 / 6 ? a + 6 * (b - a) *
                        c : 0.5 > c ? b : c < 2 / 3 ? a + 6 * (b - a) * (2 / 3 - c) : a
                },
                b = 0.5 >= c ? c * (1 + b) : c + b - c * b,
                c = 2 * c - b;
            this.r = d(c, b, a + 1 / 3);
            this.g = d(c, b, a);
            this.b = d(c, b, a - 1 / 3)
        }
        return this
    },
    setStyle: function(a) {
        if (/^rgb\((\d+),(\d+),(\d+)\)$/i.test(a)) return a = /^rgb\((\d+),(\d+),(\d+)\)$/i.exec(a), this.r = Math.min(255, parseInt(a[1], 10)) / 255, this.g = Math.min(255, parseInt(a[2], 10)) / 255, this.b = Math.min(255, parseInt(a[3], 10)) / 255, this;
        if (/^rgb\((\d+)\%,(\d+)\%,(\d+)\%\)$/i.test(a)) return a = /^rgb\((\d+)\%,(\d+)\%,(\d+)\%\)$/i.exec(a), this.r = Math.min(100,
            parseInt(a[1], 10)) / 100, this.g = Math.min(100, parseInt(a[2], 10)) / 100, this.b = Math.min(100, parseInt(a[3], 10)) / 100, this;
        if (/^\#([0-9a-f]{6})$/i.test(a)) return a = /^\#([0-9a-f]{6})$/i.exec(a), this.setHex(parseInt(a[1], 16)), this;
        if (/^\#([0-9a-f])([0-9a-f])([0-9a-f])$/i.test(a)) return a = /^\#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(a), this.setHex(parseInt(a[1] + a[1] + a[2] + a[2] + a[3] + a[3], 16)), this;
        if (/^(\w+)$/i.test(a)) return this.setHex(THREE.ColorKeywords[a]), this
    },
    copy: function(a) {
        this.r = a.r;
        this.g = a.g;
        this.b =
            a.b;
        return this
    },
    copyGammaToLinear: function(a) {
        this.r = a.r * a.r;
        this.g = a.g * a.g;
        this.b = a.b * a.b;
        return this
    },
    copyLinearToGamma: function(a) {
        this.r = Math.sqrt(a.r);
        this.g = Math.sqrt(a.g);
        this.b = Math.sqrt(a.b);
        return this
    },
    convertGammaToLinear: function() {
        var a = this.r,
            b = this.g,
            c = this.b;
        this.r = a * a;
        this.g = b * b;
        this.b = c * c;
        return this
    },
    convertLinearToGamma: function() {
        this.r = Math.sqrt(this.r);
        this.g = Math.sqrt(this.g);
        this.b = Math.sqrt(this.b);
        return this
    },
    getHex: function() {
        return 255 * this.r << 16 ^ 255 * this.g << 8 ^ 255 *
            this.b << 0
    },
    getHexString: function() {
        return ("000000" + this.getHex().toString(16)).slice(-6)
    },
    getHSL: function() {
        var a = {
            h: 0,
            s: 0,
            l: 0
        };
        return function() {
            var b = this.r,
                c = this.g,
                d = this.b,
                e = Math.max(b, c, d),
                f = Math.min(b, c, d),
                h, g = (f + e) / 2;
            if (f === e) f = h = 0;
            else {
                var i = e - f,
                    f = 0.5 >= g ? i / (e + f) : i / (2 - e - f);
                switch (e) {
                    case b:
                        h = (c - d) / i + (c < d ? 6 : 0);
                        break;
                    case c:
                        h = (d - b) / i + 2;
                        break;
                    case d:
                        h = (b - c) / i + 4
                }
                h /= 6
            }
            a.h = h;
            a.s = f;
            a.l = g;
            return a
        }
    }(),
    getStyle: function() {
        return "rgb(" + (255 * this.r | 0) + "," + (255 * this.g | 0) + "," + (255 * this.b | 0) + ")"
    },
    offsetHSL: function(a,
        b, c) {
        var d = this.getHSL();
        d.h += a;
        d.s += b;
        d.l += c;
        this.setHSL(d.h, d.s, d.l);
        return this
    },
    add: function(a) {
        this.r += a.r;
        this.g += a.g;
        this.b += a.b;
        return this
    },
    addColors: function(a, b) {
        this.r = a.r + b.r;
        this.g = a.g + b.g;
        this.b = a.b + b.b;
        return this
    },
    addScalar: function(a) {
        this.r += a;
        this.g += a;
        this.b += a;
        return this
    },
    multiply: function(a) {
        this.r *= a.r;
        this.g *= a.g;
        this.b *= a.b;
        return this
    },
    multiplyScalar: function(a) {
        this.r *= a;
        this.g *= a;
        this.b *= a;
        return this
    },
    lerp: function(a, b) {
        this.r += (a.r - this.r) * b;
        this.g += (a.g - this.g) * b;
        this.b += (a.b - this.b) * b;
        return this
    },
    equals: function(a) {
        return a.r === this.r && a.g === this.g && a.b === this.b
    },
    fromArray: function(a) {
        this.r = a[0];
        this.g = a[1];
        this.b = a[2];
        return this
    },
    toArray: function() {
        return [this.r, this.g, this.b]
    },
    clone: function() {
        return (new THREE.Color).setRGB(this.r, this.g, this.b)
    }
};
THREE.ColorKeywords = {
    aliceblue: 15792383,
    antiquewhite: 16444375,
    aqua: 65535,
    aquamarine: 8388564,
    azure: 15794175,
    beige: 16119260,
    bisque: 16770244,
    black: 0,
    blanchedalmond: 16772045,
    blue: 255,
    blueviolet: 9055202,
    brown: 10824234,
    burlywood: 14596231,
    cadetblue: 6266528,
    chartreuse: 8388352,
    chocolate: 13789470,
    coral: 16744272,
    cornflowerblue: 6591981,
    cornsilk: 16775388,
    crimson: 14423100,
    cyan: 65535,
    darkblue: 139,
    darkcyan: 35723,
    darkgoldenrod: 12092939,
    darkgray: 11119017,
    darkgreen: 25600,
    darkgrey: 11119017,
    darkkhaki: 12433259,
    darkmagenta: 9109643,
    darkolivegreen: 5597999,
    darkorange: 16747520,
    darkorchid: 10040012,
    darkred: 9109504,
    darksalmon: 15308410,
    darkseagreen: 9419919,
    darkslateblue: 4734347,
    darkslategray: 3100495,
    darkslategrey: 3100495,
    darkturquoise: 52945,
    darkviolet: 9699539,
    deeppink: 16716947,
    deepskyblue: 49151,
    dimgray: 6908265,
    dimgrey: 6908265,
    dodgerblue: 2003199,
    firebrick: 11674146,
    floralwhite: 16775920,
    forestgreen: 2263842,
    fuchsia: 16711935,
    gainsboro: 14474460,
    ghostwhite: 16316671,
    gold: 16766720,
    goldenrod: 14329120,
    gray: 8421504,
    green: 32768,
    greenyellow: 11403055,
    grey: 8421504,
    honeydew: 15794160,
    hotpink: 16738740,
    indianred: 13458524,
    indigo: 4915330,
    ivory: 16777200,
    khaki: 15787660,
    lavender: 15132410,
    lavenderblush: 16773365,
    lawngreen: 8190976,
    lemonchiffon: 16775885,
    lightblue: 11393254,
    lightcoral: 15761536,
    lightcyan: 14745599,
    lightgoldenrodyellow: 16448210,
    lightgray: 13882323,
    lightgreen: 9498256,
    lightgrey: 13882323,
    lightpink: 16758465,
    lightsalmon: 16752762,
    lightseagreen: 2142890,
    lightskyblue: 8900346,
    lightslategray: 7833753,
    lightslategrey: 7833753,
    lightsteelblue: 11584734,
    lightyellow: 16777184,
    lime: 65280,
    limegreen: 3329330,
    linen: 16445670,
    magenta: 16711935,
    maroon: 8388608,
    mediumaquamarine: 6737322,
    mediumblue: 205,
    mediumorchid: 12211667,
    mediumpurple: 9662683,
    mediumseagreen: 3978097,
    mediumslateblue: 8087790,
    mediumspringgreen: 64154,
    mediumturquoise: 4772300,
    mediumvioletred: 13047173,
    midnightblue: 1644912,
    mintcream: 16121850,
    mistyrose: 16770273,
    moccasin: 16770229,
    navajowhite: 16768685,
    navy: 128,
    oldlace: 16643558,
    olive: 8421376,
    olivedrab: 7048739,
    orange: 16753920,
    orangered: 16729344,
    orchid: 14315734,
    palegoldenrod: 15657130,
    palegreen: 10025880,
    paleturquoise: 11529966,
    palevioletred: 14381203,
    papayawhip: 16773077,
    peachpuff: 16767673,
    peru: 13468991,
    pink: 16761035,
    plum: 14524637,
    powderblue: 11591910,
    purple: 8388736,
    red: 16711680,
    rosybrown: 12357519,
    royalblue: 4286945,
    saddlebrown: 9127187,
    salmon: 16416882,
    sandybrown: 16032864,
    seagreen: 3050327,
    seashell: 16774638,
    sienna: 10506797,
    silver: 12632256,
    skyblue: 8900331,
    slateblue: 6970061,
    slategray: 7372944,
    slategrey: 7372944,
    snow: 16775930,
    springgreen: 65407,
    steelblue: 4620980,
    tan: 13808780,
    teal: 32896,
    thistle: 14204888,
    tomato: 16737095,
    turquoise: 4251856,
    violet: 15631086,
    wheat: 16113331,
    white: 16777215,
    whitesmoke: 16119285,
    yellow: 16776960,
    yellowgreen: 10145074
};
THREE.Quaternion = function(a, b, c, d) {
    this._x = a || 0;
    this._y = b || 0;
    this._z = c || 0;
    this._w = void 0 !== d ? d : 1
};
THREE.Quaternion.prototype = {
    constructor: THREE.Quaternion,
    _x: 0,
    _y: 0,
    _z: 0,
    _w: 0,
    _euler: void 0,
    _updateEuler: function() {
        void 0 !== this._euler && this._euler.setFromQuaternion(this, void 0, !1)
    },
    get x() {
        return this._x
    },
    set x(a) {
        this._x = a;
        this._updateEuler()
    },
    get y() {
        return this._y
    },
    set y(a) {
        this._y = a;
        this._updateEuler()
    },
    get z() {
        return this._z
    },
    set z(a) {
        this._z = a;
        this._updateEuler()
    },
    get w() {
        return this._w
    },
    set w(a) {
        this._w = a;
        this._updateEuler()
    },
    set: function(a, b, c, d) {
        this._x = a;
        this._y = b;
        this._z = c;
        this._w = d;
        this._updateEuler();
        return this
    },
    copy: function(a) {
        this._x = a._x;
        this._y = a._y;
        this._z = a._z;
        this._w = a._w;
        this._updateEuler();
        return this
    },
    setFromEuler: function(a, b) {
        if (!1 === a instanceof THREE.Euler) throw Error("ERROR: Quaternion's .setFromEuler() now expects a Euler rotation rather than a Vector3 and order.  Please update your code.");
        var c = Math.cos(a._x / 2),
            d = Math.cos(a._y / 2),
            e = Math.cos(a._z / 2),
            f = Math.sin(a._x / 2),
            h = Math.sin(a._y / 2),
            g = Math.sin(a._z / 2);
        "XYZ" === a.order ? (this._x = f * d * e + c * h * g, this._y = c * h *
            e - f * d * g, this._z = c * d * g + f * h * e, this._w = c * d * e - f * h * g) : "YXZ" === a.order ? (this._x = f * d * e + c * h * g, this._y = c * h * e - f * d * g, this._z = c * d * g - f * h * e, this._w = c * d * e + f * h * g) : "ZXY" === a.order ? (this._x = f * d * e - c * h * g, this._y = c * h * e + f * d * g, this._z = c * d * g + f * h * e, this._w = c * d * e - f * h * g) : "ZYX" === a.order ? (this._x = f * d * e - c * h * g, this._y = c * h * e + f * d * g, this._z = c * d * g - f * h * e, this._w = c * d * e + f * h * g) : "YZX" === a.order ? (this._x = f * d * e + c * h * g, this._y = c * h * e + f * d * g, this._z = c * d * g - f * h * e, this._w = c * d * e - f * h * g) : "XZY" === a.order && (this._x = f * d * e - c * h * g, this._y = c * h * e - f * d * g, this._z =
            c * d * g + f * h * e, this._w = c * d * e + f * h * g);
        !1 !== b && this._updateEuler();
        return this
    },
    setFromAxisAngle: function(a, b) {
        var c = b / 2,
            d = Math.sin(c);
        this._x = a.x * d;
        this._y = a.y * d;
        this._z = a.z * d;
        this._w = Math.cos(c);
        this._updateEuler();
        return this
    },
    setFromRotationMatrix: function(a) {
        var b = a.elements,
            c = b[0],
            a = b[4],
            d = b[8],
            e = b[1],
            f = b[5],
            h = b[9],
            g = b[2],
            i = b[6],
            b = b[10],
            k = c + f + b;
        0 < k ? (c = 0.5 / Math.sqrt(k + 1), this._w = 0.25 / c, this._x = (i - h) * c, this._y = (d - g) * c, this._z = (e - a) * c) : c > f && c > b ? (c = 2 * Math.sqrt(1 + c - f - b), this._w = (i - h) / c, this._x = 0.25 * c,
            this._y = (a + e) / c, this._z = (d + g) / c) : f > b ? (c = 2 * Math.sqrt(1 + f - c - b), this._w = (d - g) / c, this._x = (a + e) / c, this._y = 0.25 * c, this._z = (h + i) / c) : (c = 2 * Math.sqrt(1 + b - c - f), this._w = (e - a) / c, this._x = (d + g) / c, this._y = (h + i) / c, this._z = 0.25 * c);
        this._updateEuler();
        return this
    },
    inverse: function() {
        this.conjugate().normalize();
        return this
    },
    conjugate: function() {
        this._x *= -1;
        this._y *= -1;
        this._z *= -1;
        this._updateEuler();
        return this
    },
    lengthSq: function() {
        return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w
    },
    length: function() {
        return Math.sqrt(this._x *
            this._x + this._y * this._y + this._z * this._z + this._w * this._w)
    },
    normalize: function() {
        var a = this.length();
        0 === a ? (this._z = this._y = this._x = 0, this._w = 1) : (a = 1 / a, this._x *= a, this._y *= a, this._z *= a, this._w *= a);
        return this
    },
    multiply: function(a, b) {
        return void 0 !== b ? (console.warn("DEPRECATED: Quaternion's .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead."), this.multiplyQuaternions(a, b)) : this.multiplyQuaternions(this, a)
    },
    multiplyQuaternions: function(a, b) {
        var c = a._x,
            d = a._y,
            e = a._z,
            f =
            a._w,
            h = b._x,
            g = b._y,
            i = b._z,
            k = b._w;
        this._x = c * k + f * h + d * i - e * g;
        this._y = d * k + f * g + e * h - c * i;
        this._z = e * k + f * i + c * g - d * h;
        this._w = f * k - c * h - d * g - e * i;
        this._updateEuler();
        return this
    },
    multiplyVector3: function(a) {
        console.warn("DEPRECATED: Quaternion's .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead.");
        return a.applyQuaternion(this)
    },
    slerp: function(a, b) {
        var c = this._x,
            d = this._y,
            e = this._z,
            f = this._w,
            h = f * a._w + c * a._x + d * a._y + e * a._z;
        0 > h ? (this._w = -a._w, this._x = -a._x, this._y = -a._y, this._z = -a._z, h = -h) : this.copy(a);
        if (1 <= h) return this._w = f, this._x = c, this._y = d, this._z = e, this;
        var g = Math.acos(h),
            i = Math.sqrt(1 - h * h);
        if (0.0010 > Math.abs(i)) return this._w = 0.5 * (f + this._w), this._x = 0.5 * (c + this._x), this._y = 0.5 * (d + this._y), this._z = 0.5 * (e + this._z), this;
        h = Math.sin((1 - b) * g) / i;
        g = Math.sin(b * g) / i;
        this._w = f * h + this._w * g;
        this._x = c * h + this._x * g;
        this._y = d * h + this._y * g;
        this._z = e * h + this._z * g;
        this._updateEuler();
        return this
    },
    equals: function(a) {
        return a._x === this._x && a._y === this._y && a._z === this._z && a._w === this._w
    },
    fromArray: function(a) {
        this._x = a[0];
        this._y = a[1];
        this._z = a[2];
        this._w = a[3];
        this._updateEuler();
        return this
    },
    toArray: function() {
        return [this._x, this._y, this._z, this._w]
    },
    clone: function() {
        return new THREE.Quaternion(this._x, this._y, this._z, this._w)
    }
};
THREE.Quaternion.slerp = function(a, b, c, d) {
    return c.copy(a).slerp(b, d)
};
THREE.Vector2 = function(a, b) {
    this.x = a || 0;
    this.y = b || 0
};
THREE.Vector2.prototype = {
    constructor: THREE.Vector2,
    set: function(a, b) {
        this.x = a;
        this.y = b;
        return this
    },
    setX: function(a) {
        this.x = a;
        return this
    },
    setY: function(a) {
        this.y = a;
        return this
    },
    setComponent: function(a, b) {
        switch (a) {
            case 0:
                this.x = b;
                break;
            case 1:
                this.y = b;
                break;
            default:
                throw Error("index is out of range: " + a);
        }
    },
    getComponent: function(a) {
        switch (a) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            default:
                throw Error("index is out of range: " + a);
        }
    },
    copy: function(a) {
        this.x = a.x;
        this.y = a.y;
        return this
    },
    add: function(a,
        b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector2's .add() now only accepts one argument. Use .addVectors( a, b ) instead."), this.addVectors(a, b);
        this.x += a.x;
        this.y += a.y;
        return this
    },
    addVectors: function(a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        return this
    },
    addScalar: function(a) {
        this.x += a;
        this.y += a;
        return this
    },
    sub: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector2's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."), this.subVectors(a, b);
        this.x -= a.x;
        this.y -=
            a.y;
        return this
    },
    subVectors: function(a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        return this
    },
    multiplyScalar: function(a) {
        this.x *= a;
        this.y *= a;
        return this
    },
    divideScalar: function(a) {
        0 !== a ? (a = 1 / a, this.x *= a, this.y *= a) : this.y = this.x = 0;
        return this
    },
    min: function(a) {
        this.x > a.x && (this.x = a.x);
        this.y > a.y && (this.y = a.y);
        return this
    },
    max: function(a) {
        this.x < a.x && (this.x = a.x);
        this.y < a.y && (this.y = a.y);
        return this
    },
    clamp: function(a, b) {
        this.x < a.x ? this.x = a.x : this.x > b.x && (this.x = b.x);
        this.y < a.y ? this.y = a.y : this.y > b.y && (this.y = b.y);
        return this
    },
    negate: function() {
        return this.multiplyScalar(-1)
    },
    dot: function(a) {
        return this.x * a.x + this.y * a.y
    },
    lengthSq: function() {
        return this.x * this.x + this.y * this.y
    },
    length: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    },
    normalize: function() {
        return this.divideScalar(this.length())
    },
    distanceTo: function(a) {
        return Math.sqrt(this.distanceToSquared(a))
    },
    distanceToSquared: function(a) {
        var b = this.x - a.x,
            a = this.y - a.y;
        return b * b + a * a
    },
    setLength: function(a) {
        var b = this.length();
        0 !== b && a !== b && this.multiplyScalar(a /
            b);
        return this
    },
    lerp: function(a, b) {
        this.x += (a.x - this.x) * b;
        this.y += (a.y - this.y) * b;
        return this
    },
    equals: function(a) {
        return a.x === this.x && a.y === this.y
    },
    fromArray: function(a) {
        this.x = a[0];
        this.y = a[1];
        return this
    },
    toArray: function() {
        return [this.x, this.y]
    },
    clone: function() {
        return new THREE.Vector2(this.x, this.y)
    }
};
THREE.Vector3 = function(a, b, c) {
    this.x = a || 0;
    this.y = b || 0;
    this.z = c || 0
};
THREE.Vector3.prototype = {
    constructor: THREE.Vector3,
    set: function(a, b, c) {
        this.x = a;
        this.y = b;
        this.z = c;
        return this
    },
    setX: function(a) {
        this.x = a;
        return this
    },
    setY: function(a) {
        this.y = a;
        return this
    },
    setZ: function(a) {
        this.z = a;
        return this
    },
    setComponent: function(a, b) {
        switch (a) {
            case 0:
                this.x = b;
                break;
            case 1:
                this.y = b;
                break;
            case 2:
                this.z = b;
                break;
            default:
                throw Error("index is out of range: " + a);
        }
    },
    getComponent: function(a) {
        switch (a) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            case 2:
                return this.z;
            default:
                throw Error("index is out of range: " +
                    a);
        }
    },
    copy: function(a) {
        this.x = a.x;
        this.y = a.y;
        this.z = a.z;
        return this
    },
    add: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector3's .add() now only accepts one argument. Use .addVectors( a, b ) instead."), this.addVectors(a, b);
        this.x += a.x;
        this.y += a.y;
        this.z += a.z;
        return this
    },
    addScalar: function(a) {
        this.x += a;
        this.y += a;
        this.z += a;
        return this
    },
    addVectors: function(a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this
    },
    sub: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector3's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),
            this.subVectors(a, b);
        this.x -= a.x;
        this.y -= a.y;
        this.z -= a.z;
        return this
    },
    subVectors: function(a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this
    },
    multiply: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector3's .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead."), this.multiplyVectors(a, b);
        this.x *= a.x;
        this.y *= a.y;
        this.z *= a.z;
        return this
    },
    multiplyScalar: function(a) {
        this.x *= a;
        this.y *= a;
        this.z *= a;
        return this
    },
    multiplyVectors: function(a, b) {
        this.x = a.x *
            b.x;
        this.y = a.y * b.y;
        this.z = a.z * b.z;
        return this
    },
    applyMatrix3: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            a = a.elements;
        this.x = a[0] * b + a[3] * c + a[6] * d;
        this.y = a[1] * b + a[4] * c + a[7] * d;
        this.z = a[2] * b + a[5] * c + a[8] * d;
        return this
    },
    applyMatrix4: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            a = a.elements;
        this.x = a[0] * b + a[4] * c + a[8] * d + a[12];
        this.y = a[1] * b + a[5] * c + a[9] * d + a[13];
        this.z = a[2] * b + a[6] * c + a[10] * d + a[14];
        return this
    },
    applyProjection: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            a = a.elements,
            e = 1 / (a[3] * b + a[7] * c + a[11] * d + a[15]);
        this.x = (a[0] * b + a[4] * c + a[8] * d + a[12]) * e;
        this.y = (a[1] * b + a[5] * c + a[9] * d + a[13]) * e;
        this.z = (a[2] * b + a[6] * c + a[10] * d + a[14]) * e;
        return this
    },
    applyQuaternion: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            e = a.x,
            f = a.y,
            h = a.z,
            a = a.w,
            g = a * b + f * d - h * c,
            i = a * c + h * b - e * d,
            k = a * d + e * c - f * b,
            b = -e * b - f * c - h * d;
        this.x = g * a + b * -e + i * -h - k * -f;
        this.y = i * a + b * -f + k * -e - g * -h;
        this.z = k * a + b * -h + g * -f - i * -e;
        return this
    },
    transformDirection: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            a = a.elements;
        this.x = a[0] * b + a[4] * c + a[8] * d;
        this.y = a[1] * b + a[5] * c + a[9] * d;
        this.z = a[2] *
            b + a[6] * c + a[10] * d;
        this.normalize();
        return this
    },
    divide: function(a) {
        this.x /= a.x;
        this.y /= a.y;
        this.z /= a.z;
        return this
    },
    divideScalar: function(a) {
        0 !== a ? (a = 1 / a, this.x *= a, this.y *= a, this.z *= a) : this.z = this.y = this.x = 0;
        return this
    },
    min: function(a) {
        this.x > a.x && (this.x = a.x);
        this.y > a.y && (this.y = a.y);
        this.z > a.z && (this.z = a.z);
        return this
    },
    max: function(a) {
        this.x < a.x && (this.x = a.x);
        this.y < a.y && (this.y = a.y);
        this.z < a.z && (this.z = a.z);
        return this
    },
    clamp: function(a, b) {
        this.x < a.x ? this.x = a.x : this.x > b.x && (this.x = b.x);
        this.y <
            a.y ? this.y = a.y : this.y > b.y && (this.y = b.y);
        this.z < a.z ? this.z = a.z : this.z > b.z && (this.z = b.z);
        return this
    },
    negate: function() {
        return this.multiplyScalar(-1)
    },
    dot: function(a) {
        return this.x * a.x + this.y * a.y + this.z * a.z
    },
    lengthSq: function() {
        return this.x * this.x + this.y * this.y + this.z * this.z
    },
    length: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
    },
    lengthManhattan: function() {
        return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z)
    },
    normalize: function() {
        return this.divideScalar(this.length())
    },
    setLength: function(a) {
        var b = this.length();
        0 !== b && a !== b && this.multiplyScalar(a / b);
        return this
    },
    lerp: function(a, b) {
        this.x += (a.x - this.x) * b;
        this.y += (a.y - this.y) * b;
        this.z += (a.z - this.z) * b;
        return this
    },
    cross: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector3's .cross() now only accepts one argument. Use .crossVectors( a, b ) instead."), this.crossVectors(a, b);
        var c = this.x,
            d = this.y,
            e = this.z;
        this.x = d * a.z - e * a.y;
        this.y = e * a.x - c * a.z;
        this.z = c * a.y - d * a.x;
        return this
    },
    crossVectors: function(a, b) {
        var c =
            a.x,
            d = a.y,
            e = a.z,
            f = b.x,
            h = b.y,
            g = b.z;
        this.x = d * g - e * h;
        this.y = e * f - c * g;
        this.z = c * h - d * f;
        return this
    },
    angleTo: function(a) {
        a = this.dot(a) / (this.length() * a.length());
        return Math.acos(THREE.Math.clamp(a, -1, 1))
    },
    distanceTo: function(a) {
        return Math.sqrt(this.distanceToSquared(a))
    },
    distanceToSquared: function(a) {
        var b = this.x - a.x,
            c = this.y - a.y,
            a = this.z - a.z;
        return b * b + c * c + a * a
    },
    setEulerFromRotationMatrix: function() {
        console.error("REMOVED: Vector3's setEulerFromRotationMatrix has been removed in favor of Euler.setFromRotationMatrix(), please update your code.")
    },
    setEulerFromQuaternion: function() {
        console.error("REMOVED: Vector3's setEulerFromQuaternion: has been removed in favor of Euler.setFromQuaternion(), please update your code.")
    },
    getPositionFromMatrix: function(a) {
        this.x = a.elements[12];
        this.y = a.elements[13];
        this.z = a.elements[14];
        return this
    },
    getScaleFromMatrix: function(a) {
        var b = this.set(a.elements[0], a.elements[1], a.elements[2]).length(),
            c = this.set(a.elements[4], a.elements[5], a.elements[6]).length(),
            a = this.set(a.elements[8], a.elements[9], a.elements[10]).length();
        this.x = b;
        this.y = c;
        this.z = a;
        return this
    },
    getColumnFromMatrix: function(a, b) {
        var c = 4 * a,
            d = b.elements;
        this.x = d[c];
        this.y = d[c + 1];
        this.z = d[c + 2];
        return this
    },
    equals: function(a) {
        return a.x === this.x && a.y === this.y && a.z === this.z
    },
    fromArray: function(a) {
        this.x = a[0];
        this.y = a[1];
        this.z = a[2];
        return this
    },
    toArray: function() {
        return [this.x, this.y, this.z]
    },
    clone: function() {
        return new THREE.Vector3(this.x, this.y, this.z)
    }
};
THREE.extend(THREE.Vector3.prototype, {
    applyEuler: function() {
        var a = new THREE.Quaternion;
        return function(b) {
            !1 === b instanceof THREE.Euler && console.error("ERROR: Vector3's .applyEuler() now expects a Euler rotation rather than a Vector3 and order.  Please update your code.");
            this.applyQuaternion(a.setFromEuler(b));
            return this
        }
    }(),
    applyAxisAngle: function() {
        var a = new THREE.Quaternion;
        return function(b, c) {
            this.applyQuaternion(a.setFromAxisAngle(b, c));
            return this
        }
    }(),
    projectOnVector: function() {
        var a = new THREE.Vector3;
        return function(b) {
            a.copy(b).normalize();
            b = this.dot(a);
            return this.copy(a).multiplyScalar(b)
        }
    }(),
    projectOnPlane: function() {
        var a = new THREE.Vector3;
        return function(b) {
            a.copy(this).projectOnVector(b);
            return this.sub(a)
        }
    }(),
    reflect: function() {
        var a = new THREE.Vector3;
        return function(b) {
            a.copy(this).projectOnVector(b).multiplyScalar(2);
            return this.subVectors(a, this)
        }
    }()
});
THREE.Vector4 = function(a, b, c, d) {
    this.x = a || 0;
    this.y = b || 0;
    this.z = c || 0;
    this.w = void 0 !== d ? d : 1
};
THREE.Vector4.prototype = {
    constructor: THREE.Vector4,
    set: function(a, b, c, d) {
        this.x = a;
        this.y = b;
        this.z = c;
        this.w = d;
        return this
    },
    setX: function(a) {
        this.x = a;
        return this
    },
    setY: function(a) {
        this.y = a;
        return this
    },
    setZ: function(a) {
        this.z = a;
        return this
    },
    setW: function(a) {
        this.w = a;
        return this
    },
    setComponent: function(a, b) {
        switch (a) {
            case 0:
                this.x = b;
                break;
            case 1:
                this.y = b;
                break;
            case 2:
                this.z = b;
                break;
            case 3:
                this.w = b;
                break;
            default:
                throw Error("index is out of range: " + a);
        }
    },
    getComponent: function(a) {
        switch (a) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            case 2:
                return this.z;
            case 3:
                return this.w;
            default:
                throw Error("index is out of range: " + a);
        }
    },
    copy: function(a) {
        this.x = a.x;
        this.y = a.y;
        this.z = a.z;
        this.w = void 0 !== a.w ? a.w : 1;
        return this
    },
    add: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector4's .add() now only accepts one argument. Use .addVectors( a, b ) instead."), this.addVectors(a, b);
        this.x += a.x;
        this.y += a.y;
        this.z += a.z;
        this.w += a.w;
        return this
    },
    addScalar: function(a) {
        this.x += a;
        this.y += a;
        this.z += a;
        this.w += a;
        return this
    },
    addVectors: function(a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        this.w = a.w + b.w;
        return this
    },
    sub: function(a, b) {
        if (void 0 !== b) return console.warn("DEPRECATED: Vector4's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."), this.subVectors(a, b);
        this.x -= a.x;
        this.y -= a.y;
        this.z -= a.z;
        this.w -= a.w;
        return this
    },
    subVectors: function(a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        this.w = a.w - b.w;
        return this
    },
    multiplyScalar: function(a) {
        this.x *= a;
        this.y *= a;
        this.z *= a;
        this.w *= a;
        return this
    },
    applyMatrix4: function(a) {
        var b = this.x,
            c = this.y,
            d = this.z,
            e = this.w,
            a = a.elements;
        this.x = a[0] * b + a[4] * c + a[8] * d + a[12] * e;
        this.y = a[1] * b + a[5] * c + a[9] * d + a[13] * e;
        this.z = a[2] * b + a[6] * c + a[10] * d + a[14] * e;
        this.w = a[3] * b + a[7] * c + a[11] * d + a[15] * e;
        return this
    },
    divideScalar: function(a) {
        0 !== a ? (a = 1 / a, this.x *= a, this.y *= a, this.z *= a, this.w *= a) : (this.z = this.y = this.x = 0, this.w = 1);
        return this
    },
    setAxisAngleFromQuaternion: function(a) {
        this.w = 2 * Math.acos(a.w);
        var b = Math.sqrt(1 - a.w * a.w);
        1E-4 > b ? (this.x = 1, this.z = this.y = 0) : (this.x = a.x / b,
            this.y = a.y / b, this.z = a.z / b);
        return this
    },
    setAxisAngleFromRotationMatrix: function(a) {
        var b, c, d, a = a.elements,
            e = a[0];
        d = a[4];
        var f = a[8],
            h = a[1],
            g = a[5],
            i = a[9];
        c = a[2];
        b = a[6];
        var k = a[10];
        if (0.01 > Math.abs(d - h) && 0.01 > Math.abs(f - c) && 0.01 > Math.abs(i - b)) {
            if (0.1 > Math.abs(d + h) && 0.1 > Math.abs(f + c) && 0.1 > Math.abs(i + b) && 0.1 > Math.abs(e + g + k - 3)) return this.set(1, 0, 0, 0), this;
            a = Math.PI;
            e = (e + 1) / 2;
            g = (g + 1) / 2;
            k = (k + 1) / 2;
            d = (d + h) / 4;
            f = (f + c) / 4;
            i = (i + b) / 4;
            e > g && e > k ? 0.01 > e ? (b = 0, d = c = 0.707106781) : (b = Math.sqrt(e), c = d / b, d = f / b) : g > k ? 0.01 > g ?
                (b = 0.707106781, c = 0, d = 0.707106781) : (c = Math.sqrt(g), b = d / c, d = i / c) : 0.01 > k ? (c = b = 0.707106781, d = 0) : (d = Math.sqrt(k), b = f / d, c = i / d);
            this.set(b, c, d, a);
            return this
        }
        a = Math.sqrt((b - i) * (b - i) + (f - c) * (f - c) + (h - d) * (h - d));
        0.0010 > Math.abs(a) && (a = 1);
        this.x = (b - i) / a;
        this.y = (f - c) / a;
        this.z = (h - d) / a;
        this.w = Math.acos((e + g + k - 1) / 2);
        return this
    },
    min: function(a) {
        this.x > a.x && (this.x = a.x);
        this.y > a.y && (this.y = a.y);
        this.z > a.z && (this.z = a.z);
        this.w > a.w && (this.w = a.w);
        return this
    },
    max: function(a) {
        this.x < a.x && (this.x = a.x);
        this.y < a.y && (this.y =
            a.y);
        this.z < a.z && (this.z = a.z);
        this.w < a.w && (this.w = a.w);
        return this
    },
    clamp: function(a, b) {
        this.x < a.x ? this.x = a.x : this.x > b.x && (this.x = b.x);
        this.y < a.y ? this.y = a.y : this.y > b.y && (this.y = b.y);
        this.z < a.z ? this.z = a.z : this.z > b.z && (this.z = b.z);
        this.w < a.w ? this.w = a.w : this.w > b.w && (this.w = b.w);
        return this
    },
    negate: function() {
        return this.multiplyScalar(-1)
    },
    dot: function(a) {
        return this.x * a.x + this.y * a.y + this.z * a.z + this.w * a.w
    },
    lengthSq: function() {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    },
    length: function() {
        return Math.sqrt(this.x *
            this.x + this.y * this.y + this.z * this.z + this.w * this.w)
    },
    lengthManhattan: function() {
        return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w)
    },
    normalize: function() {
        return this.divideScalar(this.length())
    },
    setLength: function(a) {
        var b = this.length();
        0 !== b && a !== b && this.multiplyScalar(a / b);
        return this
    },
    lerp: function(a, b) {
        this.x += (a.x - this.x) * b;
        this.y += (a.y - this.y) * b;
        this.z += (a.z - this.z) * b;
        this.w += (a.w - this.w) * b;
        return this
    },
    equals: function(a) {
        return a.x === this.x && a.y === this.y && a.z === this.z &&
            a.w === this.w
    },
    fromArray: function(a) {
        this.x = a[0];
        this.y = a[1];
        this.z = a[2];
        this.w = a[3];
        return this
    },
    toArray: function() {
        return [this.x, this.y, this.z, this.w]
    },
    clone: function() {
        return new THREE.Vector4(this.x, this.y, this.z, this.w)
    }
};
THREE.Euler = function(a, b, c, d) {
    this._x = a || 0;
    this._y = b || 0;
    this._z = c || 0;
    this._order = d || THREE.Euler.DefaultOrder
};
THREE.Euler.RotationOrders = "XYZ YZX ZXY XZY YXZ ZYX".split(" ");
THREE.Euler.DefaultOrder = "XYZ";
THREE.Euler.prototype = {
    constructor: THREE.Euler,
    _x: 0,
    _y: 0,
    _z: 0,
    _order: THREE.Euler.DefaultOrder,
    _quaternion: void 0,
    _updateQuaternion: function() {
        void 0 !== this._quaternion && this._quaternion.setFromEuler(this, !1)
    },
    get x() {
        return this._x
    },
    set x(a) {
        this._x = a;
        this._updateQuaternion()
    },
    get y() {
        return this._y
    },
    set y(a) {
        this._y = a;
        this._updateQuaternion()
    },
    get z() {
        return this._z
    },
    set z(a) {
        this._z = a;
        this._updateQuaternion()
    },
    get order() {
        return this._order
    },
    set order(a) {
        this._order = a;
        this._updateQuaternion()
    },
    set: function(a, b, c, d) {
        this._x = a;
        this._y = b;
        this._z = c;
        this._order = d || this._order;
        this._updateQuaternion();
        return this
    },
    copy: function(a) {
        this._x = a._x;
        this._y = a._y;
        this._z = a._z;
        this._order = a._order;
        this._updateQuaternion();
        return this
    },
    setFromRotationMatrix: function(a, b) {
        function c(a) {
            return Math.min(Math.max(a, -1), 1)
        }
        var d = a.elements,
            e = d[0],
            f = d[4],
            h = d[8],
            g = d[1],
            i = d[5],
            k = d[9],
            m = d[2],
            l = d[6],
            d = d[10],
            b = b || this._order;
        "XYZ" === b ? (this._y = Math.asin(c(h)), 0.99999 > Math.abs(h) ? (this._x = Math.atan2(-k, d), this._z =
            Math.atan2(-f, e)) : (this._x = Math.atan2(l, i), this._z = 0)) : "YXZ" === b ? (this._x = Math.asin(-c(k)), 0.99999 > Math.abs(k) ? (this._y = Math.atan2(h, d), this._z = Math.atan2(g, i)) : (this._y = Math.atan2(-m, e), this._z = 0)) : "ZXY" === b ? (this._x = Math.asin(c(l)), 0.99999 > Math.abs(l) ? (this._y = Math.atan2(-m, d), this._z = Math.atan2(-f, i)) : (this._y = 0, this._z = Math.atan2(g, e))) : "ZYX" === b ? (this._y = Math.asin(-c(m)), 0.99999 > Math.abs(m) ? (this._x = Math.atan2(l, d), this._z = Math.atan2(g, e)) : (this._x = 0, this._z = Math.atan2(-f, i))) : "YZX" === b ? (this._z =
            Math.asin(c(g)), 0.99999 > Math.abs(g) ? (this._x = Math.atan2(-k, i), this._y = Math.atan2(-m, e)) : (this._x = 0, this._y = Math.atan2(h, d))) : "XZY" === b ? (this._z = Math.asin(-c(f)), 0.99999 > Math.abs(f) ? (this._x = Math.atan2(l, i), this._y = Math.atan2(h, e)) : (this._x = Math.atan2(-k, d), this._y = 0)) : console.warn("WARNING: Euler.setFromRotationMatrix() given unsupported order: " + b);
        this._order = b;
        this._updateQuaternion();
        return this
    },
    setFromQuaternion: function(a, b, c) {
        function d(a) {
            return Math.min(Math.max(a, -1), 1)
        }
        var e = a.x * a.x,
            f =
            a.y * a.y,
            h = a.z * a.z,
            g = a.w * a.w,
            b = b || this._order;
        "XYZ" === b ? (this._x = Math.atan2(2 * (a.x * a.w - a.y * a.z), g - e - f + h), this._y = Math.asin(d(2 * (a.x * a.z + a.y * a.w))), this._z = Math.atan2(2 * (a.z * a.w - a.x * a.y), g + e - f - h)) : "YXZ" === b ? (this._x = Math.asin(d(2 * (a.x * a.w - a.y * a.z))), this._y = Math.atan2(2 * (a.x * a.z + a.y * a.w), g - e - f + h), this._z = Math.atan2(2 * (a.x * a.y + a.z * a.w), g - e + f - h)) : "ZXY" === b ? (this._x = Math.asin(d(2 * (a.x * a.w + a.y * a.z))), this._y = Math.atan2(2 * (a.y * a.w - a.z * a.x), g - e - f + h), this._z = Math.atan2(2 * (a.z * a.w - a.x * a.y), g - e + f - h)) : "ZYX" ===
            b ? (this._x = Math.atan2(2 * (a.x * a.w + a.z * a.y), g - e - f + h), this._y = Math.asin(d(2 * (a.y * a.w - a.x * a.z))), this._z = Math.atan2(2 * (a.x * a.y + a.z * a.w), g + e - f - h)) : "YZX" === b ? (this._x = Math.atan2(2 * (a.x * a.w - a.z * a.y), g - e + f - h), this._y = Math.atan2(2 * (a.y * a.w - a.x * a.z), g + e - f - h), this._z = Math.asin(d(2 * (a.x * a.y + a.z * a.w)))) : "XZY" === b ? (this._x = Math.atan2(2 * (a.x * a.w + a.y * a.z), g - e + f - h), this._y = Math.atan2(2 * (a.x * a.z + a.y * a.w), g + e - f - h), this._z = Math.asin(d(2 * (a.z * a.w - a.x * a.y)))) : console.warn("WARNING: Euler.setFromQuaternion() given unsupported order: " +
                b);
        this._order = b;
        !1 !== c && this._updateQuaternion();
        return this
    },
    reorder: function() {
        var a = new THREE.Quaternion;
        return function(b) {
            a.setFromEuler(this);
            this.setFromQuaternion(a, b)
        }
    }(),
    fromArray: function(a) {
        this._x = a[0];
        this._y = a[1];
        this._z = a[2];
        void 0 !== a[3] && (this._order = a[3]);
        this._updateQuaternion();
        return this
    },
    toArray: function() {
        return [this._x, this._y, this._z, this._order]
    },
    equals: function(a) {
        return a._x === this._x && a._y === this._y && a._z === this._z && a._order === this._order
    },
    clone: function() {
        return new THREE.Euler(this._x,
            this._y, this._z, this._order)
    }
};
THREE.Line3 = function(a, b) {
    this.start = void 0 !== a ? a : new THREE.Vector3;
    this.end = void 0 !== b ? b : new THREE.Vector3
};
THREE.Line3.prototype = {
    constructor: THREE.Line3,
    set: function(a, b) {
        this.start.copy(a);
        this.end.copy(b);
        return this
    },
    copy: function(a) {
        this.start.copy(a.start);
        this.end.copy(a.end);
        return this
    },
    center: function(a) {
        return (a || new THREE.Vector3).addVectors(this.start, this.end).multiplyScalar(0.5)
    },
    delta: function(a) {
        return (a || new THREE.Vector3).subVectors(this.end, this.start)
    },
    distanceSq: function() {
        return this.start.distanceToSquared(this.end)
    },
    distance: function() {
        return this.start.distanceTo(this.end)
    },
    at: function(a,
        b) {
        var c = b || new THREE.Vector3;
        return this.delta(c).multiplyScalar(a).add(this.start)
    },
    closestPointToPointParameter: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function(c, d) {
            a.subVectors(c, this.start);
            b.subVectors(this.end, this.start);
            var e = b.dot(b),
                e = b.dot(a) / e;
            d && (e = THREE.Math.clamp(e, 0, 1));
            return e
        }
    }(),
    closestPointToPoint: function(a, b, c) {
        a = this.closestPointToPointParameter(a, b);
        c = c || new THREE.Vector3;
        return this.delta(c).multiplyScalar(a).add(this.start)
    },
    applyMatrix4: function(a) {
        this.start.applyMatrix4(a);
        this.end.applyMatrix4(a);
        return this
    },
    equals: function(a) {
        return a.start.equals(this.start) && a.end.equals(this.end)
    },
    clone: function() {
        return (new THREE.Line3).copy(this)
    }
};
THREE.Box2 = function(a, b) {
    this.min = void 0 !== a ? a : new THREE.Vector2(Infinity, Infinity);
    this.max = void 0 !== b ? b : new THREE.Vector2(-Infinity, -Infinity)
};
THREE.Box2.prototype = {
    constructor: THREE.Box2,
    set: function(a, b) {
        this.min.copy(a);
        this.max.copy(b);
        return this
    },
    setFromPoints: function(a) {
        if (0 < a.length) {
            var b = a[0];
            this.min.copy(b);
            this.max.copy(b);
            for (var c = 1, d = a.length; c < d; c++) b = a[c], b.x < this.min.x ? this.min.x = b.x : b.x > this.max.x && (this.max.x = b.x), b.y < this.min.y ? this.min.y = b.y : b.y > this.max.y && (this.max.y = b.y)
        } else this.makeEmpty();
        return this
    },
    setFromCenterAndSize: function() {
        var a = new THREE.Vector2;
        return function(b, c) {
            var d = a.copy(c).multiplyScalar(0.5);
            this.min.copy(b).sub(d);
            this.max.copy(b).add(d);
            return this
        }
    }(),
    copy: function(a) {
        this.min.copy(a.min);
        this.max.copy(a.max);
        return this
    },
    makeEmpty: function() {
        this.min.x = this.min.y = Infinity;
        this.max.x = this.max.y = -Infinity;
        return this
    },
    empty: function() {
        return this.max.x < this.min.x || this.max.y < this.min.y
    },
    center: function(a) {
        return (a || new THREE.Vector2).addVectors(this.min, this.max).multiplyScalar(0.5)
    },
    size: function(a) {
        return (a || new THREE.Vector2).subVectors(this.max, this.min)
    },
    expandByPoint: function(a) {
        this.min.min(a);
        this.max.max(a);
        return this
    },
    expandByVector: function(a) {
        this.min.sub(a);
        this.max.add(a);
        return this
    },
    expandByScalar: function(a) {
        this.min.addScalar(-a);
        this.max.addScalar(a);
        return this
    },
    containsPoint: function(a) {
        return a.x < this.min.x || a.x > this.max.x || a.y < this.min.y || a.y > this.max.y ? !1 : !0
    },
    containsBox: function(a) {
        return this.min.x <= a.min.x && a.max.x <= this.max.x && this.min.y <= a.min.y && a.max.y <= this.max.y ? !0 : !1
    },
    getParameter: function(a) {
        return new THREE.Vector2((a.x - this.min.x) / (this.max.x - this.min.x),
            (a.y - this.min.y) / (this.max.y - this.min.y))
    },
    isIntersectionBox: function(a) {
        return a.max.x < this.min.x || a.min.x > this.max.x || a.max.y < this.min.y || a.min.y > this.max.y ? !1 : !0
    },
    clampPoint: function(a, b) {
        return (b || new THREE.Vector2).copy(a).clamp(this.min, this.max)
    },
    distanceToPoint: function() {
        var a = new THREE.Vector2;
        return function(b) {
            return a.copy(b).clamp(this.min, this.max).sub(b).length()
        }
    }(),
    intersect: function(a) {
        this.min.max(a.min);
        this.max.min(a.max);
        return this
    },
    union: function(a) {
        this.min.min(a.min);
        this.max.max(a.max);
        return this
    },
    translate: function(a) {
        this.min.add(a);
        this.max.add(a);
        return this
    },
    equals: function(a) {
        return a.min.equals(this.min) && a.max.equals(this.max)
    },
    clone: function() {
        return (new THREE.Box2).copy(this)
    }
};
THREE.Box3 = function(a, b) {
    this.min = void 0 !== a ? a : new THREE.Vector3(Infinity, Infinity, Infinity);
    this.max = void 0 !== b ? b : new THREE.Vector3(-Infinity, -Infinity, -Infinity)
};
THREE.Box3.prototype = {
    constructor: THREE.Box3,
    set: function(a, b) {
        this.min.copy(a);
        this.max.copy(b);
        return this
    },
    addPoint: function(a) {
        a.x < this.min.x ? this.min.x = a.x : a.x > this.max.x && (this.max.x = a.x);
        a.y < this.min.y ? this.min.y = a.y : a.y > this.max.y && (this.max.y = a.y);
        a.z < this.min.z ? this.min.z = a.z : a.z > this.max.z && (this.max.z = a.z)
    },
    setFromPoints: function(a) {
        if (0 < a.length) {
            var b = a[0];
            this.min.copy(b);
            this.max.copy(b);
            for (var b = 1, c = a.length; b < c; b++) this.addPoint(a[b])
        } else this.makeEmpty();
        return this
    },
    setFromCenterAndSize: function() {
        var a =
            new THREE.Vector3;
        return function(b, c) {
            var d = a.copy(c).multiplyScalar(0.5);
            this.min.copy(b).sub(d);
            this.max.copy(b).add(d);
            return this
        }
    }(),
    setFromObject: function() {
        var a = new THREE.Vector3;
        return function(b) {
            var c = this;
            b.updateMatrixWorld(!0);
            this.makeEmpty();
            b.traverse(function(b) {
                if (void 0 !== b.geometry && void 0 !== b.geometry.vertices)
                    for (var e = b.geometry.vertices, f = 0, h = e.length; f < h; f++) a.copy(e[f]), a.applyMatrix4(b.matrixWorld), c.expandByPoint(a)
            });
            return this
        }
    }(),
    copy: function(a) {
        this.min.copy(a.min);
        this.max.copy(a.max);
        return this
    },
    makeEmpty: function() {
        this.min.x = this.min.y = this.min.z = Infinity;
        this.max.x = this.max.y = this.max.z = -Infinity;
        return this
    },
    empty: function() {
        return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z
    },
    center: function(a) {
        return (a || new THREE.Vector3).addVectors(this.min, this.max).multiplyScalar(0.5)
    },
    size: function(a) {
        return (a || new THREE.Vector3).subVectors(this.max, this.min)
    },
    expandByPoint: function(a) {
        this.min.min(a);
        this.max.max(a);
        return this
    },
    expandByVector: function(a) {
        this.min.sub(a);
        this.max.add(a);
        return this
    },
    expandByScalar: function(a) {
        this.min.addScalar(-a);
        this.max.addScalar(a);
        return this
    },
    containsPoint: function(a) {
        return a.x < this.min.x || a.x > this.max.x || a.y < this.min.y || a.y > this.max.y || a.z < this.min.z || a.z > this.max.z ? !1 : !0
    },
    containsBox: function(a) {
        return this.min.x <= a.min.x && a.max.x <= this.max.x && this.min.y <= a.min.y && a.max.y <= this.max.y && this.min.z <= a.min.z && a.max.z <= this.max.z ? !0 : !1
    },
    getParameter: function(a) {
        return new THREE.Vector3((a.x - this.min.x) / (this.max.x - this.min.x),
            (a.y - this.min.y) / (this.max.y - this.min.y), (a.z - this.min.z) / (this.max.z - this.min.z))
    },
    isIntersectionBox: function(a) {
        return a.max.x < this.min.x || a.min.x > this.max.x || a.max.y < this.min.y || a.min.y > this.max.y || a.max.z < this.min.z || a.min.z > this.max.z ? !1 : !0
    },
    clampPoint: function(a, b) {
        return (b || new THREE.Vector3).copy(a).clamp(this.min, this.max)
    },
    distanceToPoint: function() {
        var a = new THREE.Vector3;
        return function(b) {
            return a.copy(b).clamp(this.min, this.max).sub(b).length()
        }
    }(),
    getBoundingSphere: function() {
        var a =
            new THREE.Vector3;
        return function(b) {
            b = b || new THREE.Sphere;
            b.center = this.center();
            b.radius = 0.5 * this.size(a).length();
            return b
        }
    }(),
    intersect: function(a) {
        this.min.max(a.min);
        this.max.min(a.max);
        return this
    },
    union: function(a) {
        this.min.min(a.min);
        this.max.max(a.max);
        return this
    },
    applyMatrix4: function() {
        var a = [new THREE.Vector3, new THREE.Vector3, new THREE.Vector3, new THREE.Vector3, new THREE.Vector3, new THREE.Vector3, new THREE.Vector3, new THREE.Vector3];
        return function(b) {
            a[0].set(this.min.x, this.min.y,
                this.min.z).applyMatrix4(b);
            a[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(b);
            a[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(b);
            a[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(b);
            a[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(b);
            a[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(b);
            a[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(b);
            a[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(b);
            this.makeEmpty();
            this.setFromPoints(a);
            return this
        }
    }(),
    translate: function(a) {
        this.min.add(a);
        this.max.add(a);
        return this
    },
    equals: function(a) {
        return a.min.equals(this.min) && a.max.equals(this.max)
    },
    clone: function() {
        return (new THREE.Box3).copy(this)
    }
};
THREE.Matrix3 = function(a, b, c, d, e, f, h, g, i) {
    this.elements = new Float32Array(9);
    this.set(void 0 !== a ? a : 1, b || 0, c || 0, d || 0, void 0 !== e ? e : 1, f || 0, h || 0, g || 0, void 0 !== i ? i : 1)
};
THREE.Matrix3.prototype = {
    constructor: THREE.Matrix3,
    set: function(a, b, c, d, e, f, h, g, i) {
        var k = this.elements;
        k[0] = a;
        k[3] = b;
        k[6] = c;
        k[1] = d;
        k[4] = e;
        k[7] = f;
        k[2] = h;
        k[5] = g;
        k[8] = i;
        return this
    },
    identity: function() {
        this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        return this
    },
    copy: function(a) {
        a = a.elements;
        this.set(a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]);
        return this
    },
    multiplyVector3: function(a) {
        console.warn("DEPRECATED: Matrix3's .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead.");
        return a.applyMatrix3(this)
    },
    multiplyVector3Array: function() {
        var a = new THREE.Vector3;
        return function(b) {
            for (var c = 0, d = b.length; c < d; c += 3) a.x = b[c], a.y = b[c + 1], a.z = b[c + 2], a.applyMatrix3(this), b[c] = a.x, b[c + 1] = a.y, b[c + 2] = a.z;
            return b
        }
    }(),
    multiplyScalar: function(a) {
        var b = this.elements;
        b[0] *= a;
        b[3] *= a;
        b[6] *= a;
        b[1] *= a;
        b[4] *= a;
        b[7] *= a;
        b[2] *= a;
        b[5] *= a;
        b[8] *= a;
        return this
    },
    determinant: function() {
        var a = this.elements,
            b = a[0],
            c = a[1],
            d = a[2],
            e = a[3],
            f = a[4],
            h = a[5],
            g = a[6],
            i = a[7],
            a = a[8];
        return b * f * a - b * h * i - c * e * a + c * h * g + d * e * i - d * f * g
    },
    getInverse: function(a,
        b) {
        var c = a.elements,
            d = this.elements;
        d[0] = c[10] * c[5] - c[6] * c[9];
        d[1] = -c[10] * c[1] + c[2] * c[9];
        d[2] = c[6] * c[1] - c[2] * c[5];
        d[3] = -c[10] * c[4] + c[6] * c[8];
        d[4] = c[10] * c[0] - c[2] * c[8];
        d[5] = -c[6] * c[0] + c[2] * c[4];
        d[6] = c[9] * c[4] - c[5] * c[8];
        d[7] = -c[9] * c[0] + c[1] * c[8];
        d[8] = c[5] * c[0] - c[1] * c[4];
        c = c[0] * d[0] + c[1] * d[3] + c[2] * d[6];
        if (0 === c) {
            if (b) throw Error("Matrix3.getInverse(): can't invert matrix, determinant is 0");
            console.warn("Matrix3.getInverse(): can't invert matrix, determinant is 0");
            this.identity();
            return this
        }
        this.multiplyScalar(1 /
            c);
        return this
    },
    transpose: function() {
        var a, b = this.elements;
        a = b[1];
        b[1] = b[3];
        b[3] = a;
        a = b[2];
        b[2] = b[6];
        b[6] = a;
        a = b[5];
        b[5] = b[7];
        b[7] = a;
        return this
    },
    getNormalMatrix: function(a) {
        this.getInverse(a).transpose();
        return this
    },
    transposeIntoArray: function(a) {
        var b = this.elements;
        a[0] = b[0];
        a[1] = b[3];
        a[2] = b[6];
        a[3] = b[1];
        a[4] = b[4];
        a[5] = b[7];
        a[6] = b[2];
        a[7] = b[5];
        a[8] = b[8];
        return this
    },
    clone: function() {
        var a = this.elements;
        return new THREE.Matrix3(a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8])
    }
};
THREE.Matrix4 = function(a, b, c, d, e, f, h, g, i, k, m, l, n, t, q, p) {
    var r = this.elements = new Float32Array(16);
    r[0] = void 0 !== a ? a : 1;
    r[4] = b || 0;
    r[8] = c || 0;
    r[12] = d || 0;
    r[1] = e || 0;
    r[5] = void 0 !== f ? f : 1;
    r[9] = h || 0;
    r[13] = g || 0;
    r[2] = i || 0;
    r[6] = k || 0;
    r[10] = void 0 !== m ? m : 1;
    r[14] = l || 0;
    r[3] = n || 0;
    r[7] = t || 0;
    r[11] = q || 0;
    r[15] = void 0 !== p ? p : 1
};
THREE.Matrix4.prototype = {
    constructor: THREE.Matrix4,
    set: function(a, b, c, d, e, f, h, g, i, k, m, l, n, t, q, p) {
        var r = this.elements;
        r[0] = a;
        r[4] = b;
        r[8] = c;
        r[12] = d;
        r[1] = e;
        r[5] = f;
        r[9] = h;
        r[13] = g;
        r[2] = i;
        r[6] = k;
        r[10] = m;
        r[14] = l;
        r[3] = n;
        r[7] = t;
        r[11] = q;
        r[15] = p;
        return this
    },
    identity: function() {
        this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        return this
    },
    copy: function(a) {
        this.elements.set(a.elements);
        return this
    },
    extractPosition: function(a) {
        console.warn("DEPRECATED: Matrix4's .extractPosition() has been renamed to .copyPosition().");
        return this.copyPosition(a)
    },
    copyPosition: function(a) {
        var b = this.elements,
            a = a.elements;
        b[12] = a[12];
        b[13] = a[13];
        b[14] = a[14];
        return this
    },
    extractRotation: function() {
        var a = new THREE.Vector3;
        return function(b) {
            var c = this.elements,
                b = b.elements,
                d = 1 / a.set(b[0], b[1], b[2]).length(),
                e = 1 / a.set(b[4], b[5], b[6]).length(),
                f = 1 / a.set(b[8], b[9], b[10]).length();
            c[0] = b[0] * d;
            c[1] = b[1] * d;
            c[2] = b[2] * d;
            c[4] = b[4] * e;
            c[5] = b[5] * e;
            c[6] = b[6] * e;
            c[8] = b[8] * f;
            c[9] = b[9] * f;
            c[10] = b[10] * f;
            return this
        }
    }(),
    makeRotationFromEuler: function(a) {
        !1 ===
            a instanceof THREE.Euler && console.error("ERROR: Matrix's .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.  Please update your code.");
        var b = this.elements,
            c = a.x,
            d = a.y,
            e = a.z,
            f = Math.cos(c),
            c = Math.sin(c),
            h = Math.cos(d),
            d = Math.sin(d),
            g = Math.cos(e),
            e = Math.sin(e);
        if ("XYZ" === a.order) {
            var a = f * g,
                i = f * e,
                k = c * g,
                m = c * e;
            b[0] = h * g;
            b[4] = -h * e;
            b[8] = d;
            b[1] = i + k * d;
            b[5] = a - m * d;
            b[9] = -c * h;
            b[2] = m - a * d;
            b[6] = k + i * d;
            b[10] = f * h
        } else "YXZ" === a.order ? (a = h * g, i = h * e, k = d * g, m = d * e, b[0] = a + m * c, b[4] = k * c - i, b[8] =
            f * d, b[1] = f * e, b[5] = f * g, b[9] = -c, b[2] = i * c - k, b[6] = m + a * c, b[10] = f * h) : "ZXY" === a.order ? (a = h * g, i = h * e, k = d * g, m = d * e, b[0] = a - m * c, b[4] = -f * e, b[8] = k + i * c, b[1] = i + k * c, b[5] = f * g, b[9] = m - a * c, b[2] = -f * d, b[6] = c, b[10] = f * h) : "ZYX" === a.order ? (a = f * g, i = f * e, k = c * g, m = c * e, b[0] = h * g, b[4] = k * d - i, b[8] = a * d + m, b[1] = h * e, b[5] = m * d + a, b[9] = i * d - k, b[2] = -d, b[6] = c * h, b[10] = f * h) : "YZX" === a.order ? (a = f * h, i = f * d, k = c * h, m = c * d, b[0] = h * g, b[4] = m - a * e, b[8] = k * e + i, b[1] = e, b[5] = f * g, b[9] = -c * g, b[2] = -d * g, b[6] = i * e + k, b[10] = a - m * e) : "XZY" === a.order && (a = f * h, i = f * d, k = c * h, m = c * d, b[0] =
            h * g, b[4] = -e, b[8] = d * g, b[1] = a * e + m, b[5] = f * g, b[9] = i * e - k, b[2] = k * e - i, b[6] = c * g, b[10] = m * e + a);
        b[3] = 0;
        b[7] = 0;
        b[11] = 0;
        b[12] = 0;
        b[13] = 0;
        b[14] = 0;
        b[15] = 1;
        return this
    },
    setRotationFromQuaternion: function(a) {
        console.warn("DEPRECATED: Matrix4's .setRotationFromQuaternion() has been deprecated in favor of makeRotationFromQuaternion.  Please update your code.");
        return this.makeRotationFromQuaternion(a)
    },
    makeRotationFromQuaternion: function(a) {
        var b = this.elements,
            c = a.x,
            d = a.y,
            e = a.z,
            f = a.w,
            h = c + c,
            g = d + d,
            i = e + e,
            a = c * h,
            k = c * g,
            c =
            c * i,
            m = d * g,
            d = d * i,
            e = e * i,
            h = f * h,
            g = f * g,
            f = f * i;
        b[0] = 1 - (m + e);
        b[4] = k - f;
        b[8] = c + g;
        b[1] = k + f;
        b[5] = 1 - (a + e);
        b[9] = d - h;
        b[2] = c - g;
        b[6] = d + h;
        b[10] = 1 - (a + m);
        b[3] = 0;
        b[7] = 0;
        b[11] = 0;
        b[12] = 0;
        b[13] = 0;
        b[14] = 0;
        b[15] = 1;
        return this
    },
    lookAt: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3,
            c = new THREE.Vector3;
        return function(d, e, f) {
            var h = this.elements;
            c.subVectors(d, e).normalize();
            0 === c.length() && (c.z = 1);
            a.crossVectors(f, c).normalize();
            0 === a.length() && (c.x += 1E-4, a.crossVectors(f, c).normalize());
            b.crossVectors(c, a);
            h[0] = a.x;
            h[4] = b.x;
            h[8] = c.x;
            h[1] = a.y;
            h[5] = b.y;
            h[9] = c.y;
            h[2] = a.z;
            h[6] = b.z;
            h[10] = c.z;
            return this
        }
    }(),
    multiply: function(a, b) {
        return void 0 !== b ? (console.warn("DEPRECATED: Matrix4's .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead."), this.multiplyMatrices(a, b)) : this.multiplyMatrices(this, a)
    },
    multiplyMatrices: function(a, b) {
        var c = a.elements,
            d = b.elements,
            e = this.elements,
            f = c[0],
            h = c[4],
            g = c[8],
            i = c[12],
            k = c[1],
            m = c[5],
            l = c[9],
            n = c[13],
            t = c[2],
            q = c[6],
            p = c[10],
            r = c[14],
            s = c[3],
            u = c[7],
            w = c[11],
            c = c[15],
            E = d[0],
            D = d[4],
            F = d[8],
            y = d[12],
            x = d[1],
            z = d[5],
            O = d[9],
            B = d[13],
            C = d[2],
            I = d[6],
            v = d[10],
            A = d[14],
            G = d[3],
            R = d[7],
            J = d[11],
            d = d[15];
        e[0] = f * E + h * x + g * C + i * G;
        e[4] = f * D + h * z + g * I + i * R;
        e[8] = f * F + h * O + g * v + i * J;
        e[12] = f * y + h * B + g * A + i * d;
        e[1] = k * E + m * x + l * C + n * G;
        e[5] = k * D + m * z + l * I + n * R;
        e[9] = k * F + m * O + l * v + n * J;
        e[13] = k * y + m * B + l * A + n * d;
        e[2] = t * E + q * x + p * C + r * G;
        e[6] = t * D + q * z + p * I + r * R;
        e[10] = t * F + q * O + p * v + r * J;
        e[14] = t * y + q * B + p * A + r * d;
        e[3] = s * E + u * x + w * C + c * G;
        e[7] = s * D + u * z + w * I + c * R;
        e[11] = s * F + u * O + w * v + c * J;
        e[15] = s * y + u * B + w * A + c * d;
        return this
    },
    multiplyToArray: function(a, b,
        c) {
        var d = this.elements;
        this.multiplyMatrices(a, b);
        c[0] = d[0];
        c[1] = d[1];
        c[2] = d[2];
        c[3] = d[3];
        c[4] = d[4];
        c[5] = d[5];
        c[6] = d[6];
        c[7] = d[7];
        c[8] = d[8];
        c[9] = d[9];
        c[10] = d[10];
        c[11] = d[11];
        c[12] = d[12];
        c[13] = d[13];
        c[14] = d[14];
        c[15] = d[15];
        return this
    },
    multiplyScalar: function(a) {
        var b = this.elements;
        b[0] *= a;
        b[4] *= a;
        b[8] *= a;
        b[12] *= a;
        b[1] *= a;
        b[5] *= a;
        b[9] *= a;
        b[13] *= a;
        b[2] *= a;
        b[6] *= a;
        b[10] *= a;
        b[14] *= a;
        b[3] *= a;
        b[7] *= a;
        b[11] *= a;
        b[15] *= a;
        return this
    },
    multiplyVector3: function(a) {
        console.warn("DEPRECATED: Matrix4's .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) or vector.applyProjection( matrix ) instead.");
        return a.applyProjection(this)
    },
    multiplyVector4: function(a) {
        console.warn("DEPRECATED: Matrix4's .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead.");
        return a.applyMatrix4(this)
    },
    multiplyVector3Array: function() {
        var a = new THREE.Vector3;
        return function(b) {
            for (var c = 0, d = b.length; c < d; c += 3) a.x = b[c], a.y = b[c + 1], a.z = b[c + 2], a.applyProjection(this), b[c] = a.x, b[c + 1] = a.y, b[c + 2] = a.z;
            return b
        }
    }(),
    rotateAxis: function(a) {
        console.warn("DEPRECATED: Matrix4's .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead.");
        a.transformDirection(this)
    },
    crossVector: function(a) {
        console.warn("DEPRECATED: Matrix4's .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead.");
        return a.applyMatrix4(this)
    },
    determinant: function() {
        var a = this.elements,
            b = a[0],
            c = a[4],
            d = a[8],
            e = a[12],
            f = a[1],
            h = a[5],
            g = a[9],
            i = a[13],
            k = a[2],
            m = a[6],
            l = a[10],
            n = a[14];
        return a[3] * (+e * g * m - d * i * m - e * h * l + c * i * l + d * h * n - c * g * n) + a[7] * (+b * g * n - b * i * l + e * f * l - d * f * n + d * i * k - e * g * k) + a[11] * (+b * i * m - b * h * n - e * f * m + c * f * n + e * h * k - c * i * k) + a[15] * (-d * h * k - b * g * m + b * h * l + d * f * m - c * f *
            l + c * g * k)
    },
    transpose: function() {
        var a = this.elements,
            b;
        b = a[1];
        a[1] = a[4];
        a[4] = b;
        b = a[2];
        a[2] = a[8];
        a[8] = b;
        b = a[6];
        a[6] = a[9];
        a[9] = b;
        b = a[3];
        a[3] = a[12];
        a[12] = b;
        b = a[7];
        a[7] = a[13];
        a[13] = b;
        b = a[11];
        a[11] = a[14];
        a[14] = b;
        return this
    },
    flattenToArray: function(a) {
        var b = this.elements;
        a[0] = b[0];
        a[1] = b[1];
        a[2] = b[2];
        a[3] = b[3];
        a[4] = b[4];
        a[5] = b[5];
        a[6] = b[6];
        a[7] = b[7];
        a[8] = b[8];
        a[9] = b[9];
        a[10] = b[10];
        a[11] = b[11];
        a[12] = b[12];
        a[13] = b[13];
        a[14] = b[14];
        a[15] = b[15];
        return a
    },
    flattenToArrayOffset: function(a, b) {
        var c = this.elements;
        a[b] = c[0];
        a[b + 1] = c[1];
        a[b + 2] = c[2];
        a[b + 3] = c[3];
        a[b + 4] = c[4];
        a[b + 5] = c[5];
        a[b + 6] = c[6];
        a[b + 7] = c[7];
        a[b + 8] = c[8];
        a[b + 9] = c[9];
        a[b + 10] = c[10];
        a[b + 11] = c[11];
        a[b + 12] = c[12];
        a[b + 13] = c[13];
        a[b + 14] = c[14];
        a[b + 15] = c[15];
        return a
    },
    getPosition: function() {
        var a = new THREE.Vector3;
        return function() {
            console.warn("DEPRECATED: Matrix4's .getPosition() has been removed. Use Vector3.getPositionFromMatrix( matrix ) instead.");
            var b = this.elements;
            return a.set(b[12], b[13], b[14])
        }
    }(),
    setPosition: function(a) {
        var b = this.elements;
        b[12] = a.x;
        b[13] = a.y;
        b[14] = a.z;
        return this
    },
    getInverse: function(a, b) {
        var c = this.elements,
            d = a.elements,
            e = d[0],
            f = d[4],
            h = d[8],
            g = d[12],
            i = d[1],
            k = d[5],
            m = d[9],
            l = d[13],
            n = d[2],
            t = d[6],
            q = d[10],
            p = d[14],
            r = d[3],
            s = d[7],
            u = d[11],
            d = d[15];
        c[0] = m * p * s - l * q * s + l * t * u - k * p * u - m * t * d + k * q * d;
        c[4] = g * q * s - h * p * s - g * t * u + f * p * u + h * t * d - f * q * d;
        c[8] = h * l * s - g * m * s + g * k * u - f * l * u - h * k * d + f * m * d;
        c[12] = g * m * t - h * l * t - g * k * q + f * l * q + h * k * p - f * m * p;
        c[1] = l * q * r - m * p * r - l * n * u + i * p * u + m * n * d - i * q * d;
        c[5] = h * p * r - g * q * r + g * n * u - e * p * u - h * n * d + e * q * d;
        c[9] = g * m * r - h * l * r - g * i * u + e * l * u + h * i * d -
            e * m * d;
        c[13] = h * l * n - g * m * n + g * i * q - e * l * q - h * i * p + e * m * p;
        c[2] = k * p * r - l * t * r + l * n * s - i * p * s - k * n * d + i * t * d;
        c[6] = g * t * r - f * p * r - g * n * s + e * p * s + f * n * d - e * t * d;
        c[10] = f * l * r - g * k * r + g * i * s - e * l * s - f * i * d + e * k * d;
        c[14] = g * k * n - f * l * n - g * i * t + e * l * t + f * i * p - e * k * p;
        c[3] = m * t * r - k * q * r - m * n * s + i * q * s + k * n * u - i * t * u;
        c[7] = f * q * r - h * t * r + h * n * s - e * q * s - f * n * u + e * t * u;
        c[11] = h * k * r - f * m * r - h * i * s + e * m * s + f * i * u - e * k * u;
        c[15] = f * m * n - h * k * n + h * i * t - e * m * t - f * i * q + e * k * q;
        c = e * c[0] + i * c[4] + n * c[8] + r * c[12];
        if (0 == c) {
            if (b) throw Error("Matrix4.getInverse(): can't invert matrix, determinant is 0");
            console.warn("Matrix4.getInverse(): can't invert matrix, determinant is 0");
            this.identity();
            return this
        }
        this.multiplyScalar(1 / c);
        return this
    },
    translate: function() {
        console.warn("DEPRECATED: Matrix4's .translate() has been removed.")
    },
    rotateX: function() {
        console.warn("DEPRECATED: Matrix4's .rotateX() has been removed.")
    },
    rotateY: function() {
        console.warn("DEPRECATED: Matrix4's .rotateY() has been removed.")
    },
    rotateZ: function() {
        console.warn("DEPRECATED: Matrix4's .rotateZ() has been removed.")
    },
    rotateByAxis: function() {
        console.warn("DEPRECATED: Matrix4's .rotateByAxis() has been removed.")
    },
    scale: function(a) {
        var b = this.elements,
            c = a.x,
            d = a.y,
            a = a.z;
        b[0] *= c;
        b[4] *= d;
        b[8] *= a;
        b[1] *= c;
        b[5] *= d;
        b[9] *= a;
        b[2] *= c;
        b[6] *= d;
        b[10] *= a;
        b[3] *= c;
        b[7] *= d;
        b[11] *= a;
        return this
    },
    getMaxScaleOnAxis: function() {
        var a = this.elements;
        return Math.sqrt(Math.max(a[0] * a[0] + a[1] * a[1] + a[2] * a[2], Math.max(a[4] * a[4] + a[5] * a[5] + a[6] * a[6], a[8] * a[8] + a[9] * a[9] + a[10] * a[10])))
    },
    makeTranslation: function(a, b, c) {
        this.set(1, 0, 0, a, 0, 1, 0, b, 0, 0, 1, c, 0, 0, 0, 1);
        return this
    },
    makeRotationX: function(a) {
        var b = Math.cos(a),
            a = Math.sin(a);
        this.set(1,
            0, 0, 0, 0, b, -a, 0, 0, a, b, 0, 0, 0, 0, 1);
        return this
    },
    makeRotationY: function(a) {
        var b = Math.cos(a),
            a = Math.sin(a);
        this.set(b, 0, a, 0, 0, 1, 0, 0, -a, 0, b, 0, 0, 0, 0, 1);
        return this
    },
    makeRotationZ: function(a) {
        var b = Math.cos(a),
            a = Math.sin(a);
        this.set(b, -a, 0, 0, a, b, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        return this
    },
    makeRotationAxis: function(a, b) {
        var c = Math.cos(b),
            d = Math.sin(b),
            e = 1 - c,
            f = a.x,
            h = a.y,
            g = a.z,
            i = e * f,
            k = e * h;
        this.set(i * f + c, i * h - d * g, i * g + d * h, 0, i * h + d * g, k * h + c, k * g - d * f, 0, i * g - d * h, k * g + d * f, e * g * g + c, 0, 0, 0, 0, 1);
        return this
    },
    makeScale: function(a, b, c) {
        this.set(a,
            0, 0, 0, 0, b, 0, 0, 0, 0, c, 0, 0, 0, 0, 1);
        return this
    },
    compose: function(a, b, c) {
        this.makeRotationFromQuaternion(b);
        this.scale(c);
        this.setPosition(a);
        return this
    },
    decompose: function() {
        var a = new THREE.Vector3,
            b = new THREE.Matrix4;
        return function(c, d, e) {
            var f = this.elements,
                h = a.set(f[0], f[1], f[2]).length(),
                g = a.set(f[4], f[5], f[6]).length(),
                i = a.set(f[8], f[9], f[10]).length();
            c.x = f[12];
            c.y = f[13];
            c.z = f[14];
            b.elements.set(this.elements);
            var c = 1 / h,
                f = 1 / g,
                k = 1 / i;
            b.elements[0] *= c;
            b.elements[1] *= c;
            b.elements[2] *= c;
            b.elements[4] *=
                f;
            b.elements[5] *= f;
            b.elements[6] *= f;
            b.elements[8] *= k;
            b.elements[9] *= k;
            b.elements[10] *= k;
            d.setFromRotationMatrix(b);
            e.x = h;
            e.y = g;
            e.z = i;
            return this
        }
    }(),
    makeFrustum: function(a, b, c, d, e, f) {
        var h = this.elements;
        h[0] = 2 * e / (b - a);
        h[4] = 0;
        h[8] = (b + a) / (b - a);
        h[12] = 0;
        h[1] = 0;
        h[5] = 2 * e / (d - c);
        h[9] = (d + c) / (d - c);
        h[13] = 0;
        h[2] = 0;
        h[6] = 0;
        h[10] = -(f + e) / (f - e);
        h[14] = -2 * f * e / (f - e);
        h[3] = 0;
        h[7] = 0;
        h[11] = -1;
        h[15] = 0;
        return this
    },
    makePerspective: function(a, b, c, d) {
        var a = c * Math.tan(THREE.Math.degToRad(0.5 * a)),
            e = -a;
        return this.makeFrustum(e *
            b, a * b, e, a, c, d)
    },
    makeOrthographic: function(a, b, c, d, e, f) {
        var h = this.elements,
            g = b - a,
            i = c - d,
            k = f - e;
        h[0] = 2 / g;
        h[4] = 0;
        h[8] = 0;
        h[12] = -((b + a) / g);
        h[1] = 0;
        h[5] = 2 / i;
        h[9] = 0;
        h[13] = -((c + d) / i);
        h[2] = 0;
        h[6] = 0;
        h[10] = -2 / k;
        h[14] = -((f + e) / k);
        h[3] = 0;
        h[7] = 0;
        h[11] = 0;
        h[15] = 1;
        return this
    },
    fromArray: function(a) {
        this.elements.set(a);
        return this
    },
    toArray: function() {
        var a = this.elements;
        return [a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]]
    },
    clone: function() {
        var a = this.elements;
        return new THREE.Matrix4(a[0],
            a[4], a[8], a[12], a[1], a[5], a[9], a[13], a[2], a[6], a[10], a[14], a[3], a[7], a[11], a[15])
    }
};
THREE.Ray = function(a, b) {
    this.origin = void 0 !== a ? a : new THREE.Vector3;
    this.direction = void 0 !== b ? b : new THREE.Vector3
};
THREE.Ray.prototype = {
    constructor: THREE.Ray,
    set: function(a, b) {
        this.origin.copy(a);
        this.direction.copy(b);
        return this
    },
    copy: function(a) {
        this.origin.copy(a.origin);
        this.direction.copy(a.direction);
        return this
    },
    at: function(a, b) {
        return (b || new THREE.Vector3).copy(this.direction).multiplyScalar(a).add(this.origin)
    },
    recast: function() {
        var a = new THREE.Vector3;
        return function(b) {
            this.origin.copy(this.at(b, a));
            return this
        }
    }(),
    closestPointToPoint: function(a, b) {
        var c = b || new THREE.Vector3;
        c.subVectors(a, this.origin);
        var d = c.dot(this.direction);
        return 0 > d ? c.copy(this.origin) : c.copy(this.direction).multiplyScalar(d).add(this.origin)
    },
    distanceToPoint: function() {
        var a = new THREE.Vector3;
        return function(b) {
            var c = a.subVectors(b, this.origin).dot(this.direction);
            if (0 > c) return this.origin.distanceTo(b);
            a.copy(this.direction).multiplyScalar(c).add(this.origin);
            return a.distanceTo(b)
        }
    }(),
    distanceSqToSegment: function(a, b, c, d) {
        var e = a.clone().add(b).multiplyScalar(0.5),
            f = b.clone().sub(a).normalize(),
            h = 0.5 * a.distanceTo(b),
            g = this.origin.clone().sub(e),
            a = -this.direction.dot(f),
            b = g.dot(this.direction),
            i = -g.dot(f),
            k = g.lengthSq(),
            m = Math.abs(1 - a * a),
            l, n;
        0 <= m ? (g = a * i - b, l = a * b - i, n = h * m, 0 <= g ? l >= -n ? l <= n ? (h = 1 / m, g *= h, l *= h, a = g * (g + a * l + 2 * b) + l * (a * g + l + 2 * i) + k) : (l = h, g = Math.max(0, -(a * l + b)), a = -g * g + l * (l + 2 * i) + k) : (l = -h, g = Math.max(0, -(a * l + b)), a = -g * g + l * (l + 2 * i) + k) : l <= -n ? (g = Math.max(0, -(-a * h + b)), l = 0 < g ? -h : Math.min(Math.max(-h, -i), h), a = -g * g + l * (l + 2 * i) + k) : l <= n ? (g = 0, l = Math.min(Math.max(-h, -i), h), a = l * (l + 2 * i) + k) : (g = Math.max(0, -(a * h + b)), l = 0 < g ? h : Math.min(Math.max(-h, -i), h), a = -g * g + l * (l + 2 * i) + k)) : (l = 0 < a ? -h : h, g = Math.max(0, -(a * l + b)), a = -g * g + l * (l + 2 * i) + k);
        c && c.copy(this.direction.clone().multiplyScalar(g).add(this.origin));
        d && d.copy(f.clone().multiplyScalar(l).add(e));
        return a
    },
    isIntersectionSphere: function(a) {
        return this.distanceToPoint(a.center) <= a.radius
    },
    isIntersectionPlane: function(a) {
        var b = a.distanceToPoint(this.origin);
        return 0 === b || 0 > a.normal.dot(this.direction) * b ? !0 : !1
    },
    distanceToPlane: function(a) {
        var b = a.normal.dot(this.direction);
        if (0 == b) return 0 == a.distanceToPoint(this.origin) ?
            0 : null;
        a = -(this.origin.dot(a.normal) + a.constant) / b;
        return 0 <= a ? a : null
    },
    intersectPlane: function(a, b) {
        var c = this.distanceToPlane(a);
        return null === c ? null : this.at(c, b)
    },
    isIntersectionBox: function() {
        var a = new THREE.Vector3;
        return function(b) {
            return null !== this.intersectBox(b, a)
        }
    }(),
    intersectBox: function(a, b) {
        var c, d, e, f, h;
        d = 1 / this.direction.x;
        f = 1 / this.direction.y;
        h = 1 / this.direction.z;
        var g = this.origin;
        0 <= d ? (c = (a.min.x - g.x) * d, d *= a.max.x - g.x) : (c = (a.max.x - g.x) * d, d *= a.min.x - g.x);
        0 <= f ? (e = (a.min.y - g.y) * f, f *=
            a.max.y - g.y) : (e = (a.max.y - g.y) * f, f *= a.min.y - g.y);
        if (c > f || e > d) return null;
        if (e > c || c !== c) c = e;
        if (f < d || d !== d) d = f;
        0 <= h ? (e = (a.min.z - g.z) * h, h *= a.max.z - g.z) : (e = (a.max.z - g.z) * h, h *= a.min.z - g.z);
        if (c > h || e > d) return null;
        if (e > c || c !== c) c = e;
        if (h < d || d !== d) d = h;
        return 0 > d ? null : this.at(0 <= c ? c : d, b)
    },
    intersectTriangle: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3,
            c = new THREE.Vector3,
            d = new THREE.Vector3;
        return function(e, f, h, g, i) {
            b.subVectors(f, e);
            c.subVectors(h, e);
            d.crossVectors(b, c);
            f = this.direction.dot(d);
            if (0 <
                f) {
                if (g) return null;
                g = 1
            } else if (0 > f) g = -1, f = -f;
            else return null;
            a.subVectors(this.origin, e);
            e = g * this.direction.dot(c.crossVectors(a, c));
            if (0 > e) return null;
            h = g * this.direction.dot(b.cross(a));
            if (0 > h || e + h > f) return null;
            e = -g * a.dot(d);
            return 0 > e ? null : this.at(e / f, i)
        }
    }(),
    applyMatrix4: function(a) {
        this.direction.add(this.origin).applyMatrix4(a);
        this.origin.applyMatrix4(a);
        this.direction.sub(this.origin);
        this.direction.normalize();
        return this
    },
    equals: function(a) {
        return a.origin.equals(this.origin) && a.direction.equals(this.direction)
    },
    clone: function() {
        return (new THREE.Ray).copy(this)
    }
};
THREE.Sphere = function(a, b) {
    this.center = void 0 !== a ? a : new THREE.Vector3;
    this.radius = void 0 !== b ? b : 0
};
THREE.Sphere.prototype = {
    constructor: THREE.Sphere,
    set: function(a, b) {
        this.center.copy(a);
        this.radius = b;
        return this
    },
    setFromPoints: function() {
        var a = new THREE.Box3;
        return function(b, c) {
            var d = this.center;
            void 0 !== c ? d.copy(c) : a.setFromPoints(b).center(d);
            for (var e = 0, f = 0, h = b.length; f < h; f++) e = Math.max(e, d.distanceToSquared(b[f]));
            this.radius = Math.sqrt(e);
            return this
        }
    }(),
    copy: function(a) {
        this.center.copy(a.center);
        this.radius = a.radius;
        return this
    },
    empty: function() {
        return 0 >= this.radius
    },
    containsPoint: function(a) {
        return a.distanceToSquared(this.center) <=
            this.radius * this.radius
    },
    distanceToPoint: function(a) {
        return a.distanceTo(this.center) - this.radius
    },
    intersectsSphere: function(a) {
        var b = this.radius + a.radius;
        return a.center.distanceToSquared(this.center) <= b * b
    },
    clampPoint: function(a, b) {
        var c = this.center.distanceToSquared(a),
            d = b || new THREE.Vector3;
        d.copy(a);
        c > this.radius * this.radius && (d.sub(this.center).normalize(), d.multiplyScalar(this.radius).add(this.center));
        return d
    },
    getBoundingBox: function(a) {
        a = a || new THREE.Box3;
        a.set(this.center, this.center);
        a.expandByScalar(this.radius);
        return a
    },
    applyMatrix4: function(a) {
        this.center.applyMatrix4(a);
        this.radius *= a.getMaxScaleOnAxis();
        return this
    },
    translate: function(a) {
        this.center.add(a);
        return this
    },
    equals: function(a) {
        return a.center.equals(this.center) && a.radius === this.radius
    },
    clone: function() {
        return (new THREE.Sphere).copy(this)
    }
};
THREE.Frustum = function(a, b, c, d, e, f) {
    this.planes = [void 0 !== a ? a : new THREE.Plane, void 0 !== b ? b : new THREE.Plane, void 0 !== c ? c : new THREE.Plane, void 0 !== d ? d : new THREE.Plane, void 0 !== e ? e : new THREE.Plane, void 0 !== f ? f : new THREE.Plane]
};
THREE.Frustum.prototype = {
    constructor: THREE.Frustum,
    set: function(a, b, c, d, e, f) {
        var h = this.planes;
        h[0].copy(a);
        h[1].copy(b);
        h[2].copy(c);
        h[3].copy(d);
        h[4].copy(e);
        h[5].copy(f);
        return this
    },
    copy: function(a) {
        for (var b = this.planes, c = 0; 6 > c; c++) b[c].copy(a.planes[c]);
        return this
    },
    setFromMatrix: function(a) {
        var b = this.planes,
            c = a.elements,
            a = c[0],
            d = c[1],
            e = c[2],
            f = c[3],
            h = c[4],
            g = c[5],
            i = c[6],
            k = c[7],
            m = c[8],
            l = c[9],
            n = c[10],
            t = c[11],
            q = c[12],
            p = c[13],
            r = c[14],
            c = c[15];
        b[0].setComponents(f - a, k - h, t - m, c - q).normalize();
        b[1].setComponents(f +
            a, k + h, t + m, c + q).normalize();
        b[2].setComponents(f + d, k + g, t + l, c + p).normalize();
        b[3].setComponents(f - d, k - g, t - l, c - p).normalize();
        b[4].setComponents(f - e, k - i, t - n, c - r).normalize();
        b[5].setComponents(f + e, k + i, t + n, c + r).normalize();
        return this
    },
    intersectsObject: function() {
        var a = new THREE.Sphere;
        return function(b) {
            var c = b.geometry;
            null === c.boundingSphere && c.computeBoundingSphere();
            a.copy(c.boundingSphere);
            a.applyMatrix4(b.matrixWorld);
            return this.intersectsSphere(a)
        }
    }(),
    intersectsSphere: function(a) {
        for (var b = this.planes,
                c = a.center, a = -a.radius, d = 0; 6 > d; d++)
            if (b[d].distanceToPoint(c) < a) return !1;
        return !0
    },
    intersectsBox: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function(c) {
            for (var d = this.planes, e = 0; 6 > e; e++) {
                var f = d[e];
                a.x = 0 < f.normal.x ? c.min.x : c.max.x;
                b.x = 0 < f.normal.x ? c.max.x : c.min.x;
                a.y = 0 < f.normal.y ? c.min.y : c.max.y;
                b.y = 0 < f.normal.y ? c.max.y : c.min.y;
                a.z = 0 < f.normal.z ? c.min.z : c.max.z;
                b.z = 0 < f.normal.z ? c.max.z : c.min.z;
                var h = f.distanceToPoint(a),
                    f = f.distanceToPoint(b);
                if (0 > h && 0 > f) return !1
            }
            return !0
        }
    }(),
    containsPoint: function(a) {
        for (var b =
                this.planes, c = 0; 6 > c; c++)
            if (0 > b[c].distanceToPoint(a)) return !1;
        return !0
    },
    clone: function() {
        return (new THREE.Frustum).copy(this)
    }
};
THREE.Plane = function(a, b) {
    this.normal = void 0 !== a ? a : new THREE.Vector3(1, 0, 0);
    this.constant = void 0 !== b ? b : 0
};
THREE.Plane.prototype = {
    constructor: THREE.Plane,
    set: function(a, b) {
        this.normal.copy(a);
        this.constant = b;
        return this
    },
    setComponents: function(a, b, c, d) {
        this.normal.set(a, b, c);
        this.constant = d;
        return this
    },
    setFromNormalAndCoplanarPoint: function(a, b) {
        this.normal.copy(a);
        this.constant = -b.dot(this.normal);
        return this
    },
    setFromCoplanarPoints: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function(c, d, e) {
            d = a.subVectors(e, d).cross(b.subVectors(c, d)).normalize();
            this.setFromNormalAndCoplanarPoint(d,
                c);
            return this
        }
    }(),
    copy: function(a) {
        this.normal.copy(a.normal);
        this.constant = a.constant;
        return this
    },
    normalize: function() {
        var a = 1 / this.normal.length();
        this.normal.multiplyScalar(a);
        this.constant *= a;
        return this
    },
    negate: function() {
        this.constant *= -1;
        this.normal.negate();
        return this
    },
    distanceToPoint: function(a) {
        return this.normal.dot(a) + this.constant
    },
    distanceToSphere: function(a) {
        return this.distanceToPoint(a.center) - a.radius
    },
    projectPoint: function(a, b) {
        return this.orthoPoint(a, b).sub(a).negate()
    },
    orthoPoint: function(a,
        b) {
        var c = this.distanceToPoint(a);
        return (b || new THREE.Vector3).copy(this.normal).multiplyScalar(c)
    },
    isIntersectionLine: function(a) {
        var b = this.distanceToPoint(a.start),
            a = this.distanceToPoint(a.end);
        return 0 > b && 0 < a || 0 > a && 0 < b
    },
    intersectLine: function() {
        var a = new THREE.Vector3;
        return function(b, c) {
            var d = c || new THREE.Vector3,
                e = b.delta(a),
                f = this.normal.dot(e);
            if (0 == f) {
                if (0 == this.distanceToPoint(b.start)) return d.copy(b.start)
            } else return f = -(b.start.dot(this.normal) + this.constant) / f, 0 > f || 1 < f ? void 0 : d.copy(e).multiplyScalar(f).add(b.start)
        }
    }(),
    coplanarPoint: function(a) {
        return (a || new THREE.Vector3).copy(this.normal).multiplyScalar(-this.constant)
    },
    applyMatrix4: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function(c, d) {
            var d = d || (new THREE.Matrix3).getNormalMatrix(c),
                e = a.copy(this.normal).applyMatrix3(d),
                f = this.coplanarPoint(b);
            f.applyMatrix4(c);
            this.setFromNormalAndCoplanarPoint(e, f);
            return this
        }
    }(),
    translate: function(a) {
        this.constant -= a.dot(this.normal);
        return this
    },
    equals: function(a) {
        return a.normal.equals(this.normal) &&
            a.constant == this.constant
    },
    clone: function() {
        return (new THREE.Plane).copy(this)
    }
};
THREE.Math = {
    PI2: 2 * Math.PI,
    generateUUID: function() {
        var a = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),
            b = Array(36),
            c = 0,
            d;
        return function() {
            for (var e = 0; 36 > e; e++) 8 == e || 13 == e || 18 == e || 23 == e ? b[e] = "-" : 14 == e ? b[e] = "4" : (2 >= c && (c = 33554432 + 16777216 * Math.random() | 0), d = c & 15, c >>= 4, b[e] = a[19 == e ? d & 3 | 8 : d]);
            return b.join("")
        }
    }(),
    clamp: function(a, b, c) {
        return a < b ? b : a > c ? c : a
    },
    clampBottom: function(a, b) {
        return a < b ? b : a
    },
    mapLinear: function(a, b, c, d, e) {
        return d + (a - b) * (e - d) / (c - b)
    },
    smoothstep: function(a,
        b, c) {
        if (a <= b) return 0;
        if (a >= c) return 1;
        a = (a - b) / (c - b);
        return a * a * (3 - 2 * a)
    },
    smootherstep: function(a, b, c) {
        if (a <= b) return 0;
        if (a >= c) return 1;
        a = (a - b) / (c - b);
        return a * a * a * (a * (6 * a - 15) + 10)
    },
    random16: function() {
        return (65280 * Math.random() + 255 * Math.random()) / 65535
    },
    randInt: function(a, b) {
        return a + Math.floor(Math.random() * (b - a + 1))
    },
    randFloat: function(a, b) {
        return a + Math.random() * (b - a)
    },
    randFloatSpread: function(a) {
        return a * (0.5 - Math.random())
    },
    sign: function(a) {
        return 0 > a ? -1 : 0 < a ? 1 : 0
    },
    degToRad: function() {
        var a = Math.PI /
            180;
        return function(b) {
            return b * a
        }
    }(),
    radToDeg: function() {
        var a = 180 / Math.PI;
        return function(b) {
            return b * a
        }
    }()
};
THREE.Spline = function(a) {
    function b(a, b, c, d, e, f, h) {
        a = 0.5 * (c - a);
        d = 0.5 * (d - b);
        return (2 * (b - c) + a + d) * h + (-3 * (b - c) - 2 * a - d) * f + a * e + b
    }
    this.points = a;
    var c = [],
        d = {
            x: 0,
            y: 0,
            z: 0
        },
        e, f, h, g, i, k, m, l, n;
    this.initFromArray = function(a) {
        this.points = [];
        for (var b = 0; b < a.length; b++) this.points[b] = {
            x: a[b][0],
            y: a[b][1],
            z: a[b][2]
        }
    };
    this.getPoint = function(a) {
        e = (this.points.length - 1) * a;
        f = Math.floor(e);
        h = e - f;
        c[0] = 0 === f ? f : f - 1;
        c[1] = f;
        c[2] = f > this.points.length - 2 ? this.points.length - 1 : f + 1;
        c[3] = f > this.points.length - 3 ? this.points.length - 1 :
            f + 2;
        k = this.points[c[0]];
        m = this.points[c[1]];
        l = this.points[c[2]];
        n = this.points[c[3]];
        g = h * h;
        i = h * g;
        d.x = b(k.x, m.x, l.x, n.x, h, g, i);
        d.y = b(k.y, m.y, l.y, n.y, h, g, i);
        d.z = b(k.z, m.z, l.z, n.z, h, g, i);
        return d
    };
    this.getControlPointsArray = function() {
        var a, b, c = this.points.length,
            d = [];
        for (a = 0; a < c; a++) b = this.points[a], d[a] = [b.x, b.y, b.z];
        return d
    };
    this.getLength = function(a) {
        var b, c, d, e = b = b = 0,
            f = new THREE.Vector3,
            h = new THREE.Vector3,
            g = [],
            i = 0;
        g[0] = 0;
        a || (a = 100);
        c = this.points.length * a;
        f.copy(this.points[0]);
        for (a = 1; a < c; a++) b =
            a / c, d = this.getPoint(b), h.copy(d), i += h.distanceTo(f), f.copy(d), b *= this.points.length - 1, b = Math.floor(b), b != e && (g[b] = i, e = b);
        g[g.length] = i;
        return {
            chunks: g,
            total: i
        }
    };
    this.reparametrizeByArcLength = function(a) {
        var b, c, d, e, f, h, g = [],
            i = new THREE.Vector3,
            k = this.getLength();
        g.push(i.copy(this.points[0]).clone());
        for (b = 1; b < this.points.length; b++) {
            c = k.chunks[b] - k.chunks[b - 1];
            h = Math.ceil(a * c / k.total);
            e = (b - 1) / (this.points.length - 1);
            f = b / (this.points.length - 1);
            for (c = 1; c < h - 1; c++) d = e + c * (1 / h) * (f - e), d = this.getPoint(d),
                g.push(i.copy(d).clone());
            g.push(i.copy(this.points[b]).clone())
        }
        this.points = g
    }
};
THREE.Triangle = function(a, b, c) {
    this.a = void 0 !== a ? a : new THREE.Vector3;
    this.b = void 0 !== b ? b : new THREE.Vector3;
    this.c = void 0 !== c ? c : new THREE.Vector3
};
THREE.Triangle.normal = function() {
    var a = new THREE.Vector3;
    return function(b, c, d, e) {
        e = e || new THREE.Vector3;
        e.subVectors(d, c);
        a.subVectors(b, c);
        e.cross(a);
        b = e.lengthSq();
        return 0 < b ? e.multiplyScalar(1 / Math.sqrt(b)) : e.set(0, 0, 0)
    }
}();
THREE.Triangle.barycoordFromPoint = function() {
    var a = new THREE.Vector3,
        b = new THREE.Vector3,
        c = new THREE.Vector3;
    return function(d, e, f, h, g) {
        a.subVectors(h, e);
        b.subVectors(f, e);
        c.subVectors(d, e);
        var d = a.dot(a),
            e = a.dot(b),
            f = a.dot(c),
            i = b.dot(b),
            h = b.dot(c),
            k = d * i - e * e,
            g = g || new THREE.Vector3;
        if (0 == k) return g.set(-2, -1, -1);
        k = 1 / k;
        i = (i * f - e * h) * k;
        d = (d * h - e * f) * k;
        return g.set(1 - i - d, d, i)
    }
}();
THREE.Triangle.containsPoint = function() {
    var a = new THREE.Vector3;
    return function(b, c, d, e) {
        b = THREE.Triangle.barycoordFromPoint(b, c, d, e, a);
        return 0 <= b.x && 0 <= b.y && 1 >= b.x + b.y
    }
}();
THREE.Triangle.prototype = {
    constructor: THREE.Triangle,
    set: function(a, b, c) {
        this.a.copy(a);
        this.b.copy(b);
        this.c.copy(c);
        return this
    },
    setFromPointsAndIndices: function(a, b, c, d) {
        this.a.copy(a[b]);
        this.b.copy(a[c]);
        this.c.copy(a[d]);
        return this
    },
    copy: function(a) {
        this.a.copy(a.a);
        this.b.copy(a.b);
        this.c.copy(a.c);
        return this
    },
    area: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function() {
            a.subVectors(this.c, this.b);
            b.subVectors(this.a, this.b);
            return 0.5 * a.cross(b).length()
        }
    }(),
    midpoint: function(a) {
        return (a ||
            new THREE.Vector3).addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3)
    },
    normal: function(a) {
        return THREE.Triangle.normal(this.a, this.b, this.c, a)
    },
    plane: function(a) {
        return (a || new THREE.Plane).setFromCoplanarPoints(this.a, this.b, this.c)
    },
    barycoordFromPoint: function(a, b) {
        return THREE.Triangle.barycoordFromPoint(a, this.a, this.b, this.c, b)
    },
    containsPoint: function(a) {
        return THREE.Triangle.containsPoint(a, this.a, this.b, this.c)
    },
    equals: function(a) {
        return a.a.equals(this.a) && a.b.equals(this.b) && a.c.equals(this.c)
    },
    clone: function() {
        return (new THREE.Triangle).copy(this)
    }
};
THREE.Vertex = function(a) {
    console.warn("THREE.Vertex has been DEPRECATED. Use THREE.Vector3 instead.");
    return a
};
THREE.UV = function(a, b) {
    console.warn("THREE.UV has been DEPRECATED. Use THREE.Vector2 instead.");
    return new THREE.Vector2(a, b)
};
THREE.Clock = function(a) {
    this.autoStart = void 0 !== a ? a : !0;
    this.elapsedTime = this.oldTime = this.startTime = 0;
    this.running = !1
};
THREE.Clock.prototype = {
    constructor: THREE.Clock,
    start: function() {
        this.oldTime = this.startTime = void 0 !== self.performance && void 0 !== self.performance.now ? self.performance.now() : Date.now();
        this.running = !0
    },
    stop: function() {
        this.getElapsedTime();
        this.running = !1
    },
    getElapsedTime: function() {
        this.getDelta();
        return this.elapsedTime
    },
    getDelta: function() {
        var a = 0;
        this.autoStart && !this.running && this.start();
        if (this.running) {
            var b = void 0 !== self.performance && void 0 !== self.performance.now ? self.performance.now() : Date.now(),
                a = 0.0010 * (b - this.oldTime);
            this.oldTime = b;
            this.elapsedTime += a
        }
        return a
    }
};
THREE.EventDispatcher = function() {};
THREE.EventDispatcher.prototype = {
    constructor: THREE.EventDispatcher,
    apply: function(a) {
        a.addEventListener = THREE.EventDispatcher.prototype.addEventListener;
        a.hasEventListener = THREE.EventDispatcher.prototype.hasEventListener;
        a.removeEventListener = THREE.EventDispatcher.prototype.removeEventListener;
        a.dispatchEvent = THREE.EventDispatcher.prototype.dispatchEvent
    },
    addEventListener: function(a, b) {
        void 0 === this._listeners && (this._listeners = {});
        var c = this._listeners;
        void 0 === c[a] && (c[a] = []); - 1 === c[a].indexOf(b) &&
            c[a].push(b)
    },
    hasEventListener: function(a, b) {
        if (void 0 === this._listeners) return !1;
        var c = this._listeners;
        return void 0 !== c[a] && -1 !== c[a].indexOf(b) ? !0 : !1
    },
    removeEventListener: function(a, b) {
        if (void 0 !== this._listeners) {
            var c = this._listeners,
                d = c[a].indexOf(b); - 1 !== d && c[a].splice(d, 1)
        }
    },
    dispatchEvent: function(a) {
        if (void 0 !== this._listeners) {
            var b = this._listeners[a.type];
            if (void 0 !== b) {
                a.target = this;
                for (var c = 0, d = b.length; c < d; c++) b[c].call(this, a)
            }
        }
    }
};
(function(a) {
    a.Raycaster = function(b, c, d, e) {
        this.ray = new a.Ray(b, c);
        this.near = d || 0;
        this.far = e || Infinity
    };
    var b = new a.Sphere,
        c = new a.Ray;
    new a.Plane;
    new a.Vector3;
    var d = new a.Vector3,
        e = new a.Matrix4,
        f = function(a, b) {
            return a.distance - b.distance
        },
        h = new a.Vector3,
        g = new a.Vector3,
        i = new a.Vector3,
        k = function(f, m, t) {
            if (f instanceof a.Particle) {
                d.getPositionFromMatrix(f.matrixWorld);
                var q = m.ray.distanceToPoint(d);
                if (q > f.scale.x) return t;
                t.push({
                    distance: q,
                    point: f.position,
                    face: null,
                    object: f
                })
            } else if (f instanceof a.LOD) d.getPositionFromMatrix(f.matrixWorld), q = m.ray.origin.distanceTo(d), k(f.getObjectForDistance(q), m, t);
            else if (f instanceof a.Mesh) {
                var p = f.geometry;
                null === p.boundingSphere && p.computeBoundingSphere();
                b.copy(p.boundingSphere);
                b.applyMatrix4(f.matrixWorld);
                if (!1 === m.ray.isIntersectionSphere(b)) return t;
                e.getInverse(f.matrixWorld);
                c.copy(m.ray).applyMatrix4(e);
                if (null !== p.boundingBox && !1 === c.isIntersectionBox(p.boundingBox)) return t;
                var r = p.vertices;
                if (p instanceof a.BufferGeometry) {
                    var s = f.material;
                    if (void 0 === s || !1 === p.dynamic) return t;
                    var u, w, E = m.precision;
                    if (void 0 !== p.attributes.index)
                        for (var r = p.offsets, D = p.attributes.index.array, F = p.attributes.position.array, y = p.offsets.length, x = p.attributes.index.array.length / 3, x = 0; x < y; ++x)
                            for (var q = r[x].start, z = r[x].index, p = q, O = q + r[x].count; p < O; p += 3) q = z + D[p], u = z + D[p + 1], w = z + D[p + 2], h.set(F[3 * q], F[3 * q + 1], F[3 * q + 2]), g.set(F[3 * u], F[3 * u + 1], F[3 * u + 2]), i.set(F[3 * w], F[3 * w + 1], F[3 * w + 2]), u = c.intersectTriangle(h, g, i, s.side !== a.DoubleSide), null !== u && (u.applyMatrix4(f.matrixWorld),
                                q = m.ray.origin.distanceTo(u), q < E || (q < m.near || q > m.far) || t.push({
                                    distance: q,
                                    point: u,
                                    face: null,
                                    faceIndex: null,
                                    object: f
                                }));
                    else {
                        F = p.attributes.position.array;
                        x = p.attributes.position.array.length;
                        for (p = 0; p < x; p += 3) q = p, u = p + 1, w = p + 2, h.set(F[3 * q], F[3 * q + 1], F[3 * q + 2]), g.set(F[3 * u], F[3 * u + 1], F[3 * u + 2]), i.set(F[3 * w], F[3 * w + 1], F[3 * w + 2]), u = c.intersectTriangle(h, g, i, s.side !== a.DoubleSide), null !== u && (u.applyMatrix4(f.matrixWorld), q = m.ray.origin.distanceTo(u), q < E || (q < m.near || q > m.far) || t.push({
                            distance: q,
                            point: u,
                            face: null,
                            faceIndex: null,
                            object: f
                        }))
                    }
                } else if (p instanceof a.Geometry) {
                    D = f.material instanceof a.MeshFaceMaterial;
                    F = !0 === D ? f.material.materials : null;
                    E = m.precision;
                    y = 0;
                    for (x = p.faces.length; y < x; y++) z = p.faces[y], s = !0 === D ? F[z.materialIndex] : f.material, void 0 !== s && (q = r[z.a], u = r[z.b], w = r[z.c], u = c.intersectTriangle(q, u, w, s.side !== a.DoubleSide), null !== u && (u.applyMatrix4(f.matrixWorld), q = m.ray.origin.distanceTo(u), q < E || (q < m.near || q > m.far) || t.push({
                        distance: q,
                        point: u,
                        face: z,
                        faceIndex: y,
                        object: f
                    })))
                }
            } else if (f instanceof a.Line) {
                E = m.linePrecision;
                s = E * E;
                p = f.geometry;
                null === p.boundingSphere && p.computeBoundingSphere();
                b.copy(p.boundingSphere);
                b.applyMatrix4(f.matrixWorld);
                if (!1 === m.ray.isIntersectionSphere(b)) return t;
                e.getInverse(f.matrixWorld);
                c.copy(m.ray).applyMatrix4(e);
                r = p.vertices;
                E = r.length;
                u = new a.Vector3;
                w = new a.Vector3;
                x = f.type === a.LineStrip ? 1 : 2;
                for (p = 0; p < E - 1; p += x) c.distanceSqToSegment(r[p], r[p + 1], w, u) > s || (q = c.origin.distanceTo(w), q < m.near || q > m.far || t.push({
                    distance: q,
                    point: u.clone().applyMatrix4(f.matrixWorld),
                    face: null,
                    faceIndex: null,
                    object: f
                }))
            }
        },
        m = function(a, b, c) {
            for (var a = a.getDescendants(), d = 0, e = a.length; d < e; d++) k(a[d], b, c)
        };
    a.Raycaster.prototype.precision = 1E-4;
    a.Raycaster.prototype.linePrecision = 1;
    a.Raycaster.prototype.set = function(a, b) {
        this.ray.set(a, b)
    };
    a.Raycaster.prototype.intersectObject = function(a, b) {
        var c = [];
        !0 === b && m(a, this, c);
        k(a, this, c);
        c.sort(f);
        return c
    };
    a.Raycaster.prototype.intersectObjects = function(a, b) {
        for (var c = [], d = 0, e = a.length; d < e; d++) k(a[d], this, c), !0 === b && m(a[d], this, c);
        c.sort(f);
        return c
    }
})(THREE);
THREE.Object3D = function() {
    this.id = THREE.Object3DIdCount++;
    this.uuid = THREE.Math.generateUUID();
    this.name = "";
    this.parent = void 0;
    this.children = [];
    this.up = new THREE.Vector3(0, 1, 0);
    this.position = new THREE.Vector3;
    this.rotation = new THREE.Euler;
    this.quaternion = new THREE.Quaternion;
    this.scale = new THREE.Vector3(1, 1, 1);
    this.rotation._quaternion = this.quaternion;
    this.quaternion._euler = this.rotation;
    this.renderDepth = null;
    this.rotationAutoUpdate = !0;
    this.matrix = new THREE.Matrix4;
    this.matrixWorld = new THREE.Matrix4;
    this.visible = this.matrixWorldNeedsUpdate = this.matrixAutoUpdate = !0;
    this.receiveShadow = this.castShadow = !1;
    this.frustumCulled = !0;
    this.userData = {}
};
THREE.Object3D.prototype = {
    constructor: THREE.Object3D,
    get eulerOrder() {
        console.warn("DEPRECATED: Object3D's .eulerOrder has been moved to Object3D's .rotation.order.");
        return this.rotation.order
    },
    set eulerOrder(a) {
        console.warn("DEPRECATED: Object3D's .eulerOrder has been moved to Object3D's .rotation.order.");
        this.rotation.order = a
    },
    get useQuaternion() {
        console.warn("DEPRECATED: Object3D's .useQuaternion has been removed. The library now uses quaternions by default.")
    },
    set useQuaternion(a) {
        console.warn("DEPRECATED: Object3D's .useQuaternion has been removed. The library now uses quaternions by default.")
    },
    applyMatrix: function() {
        var a = new THREE.Matrix4;
        return function(b) {
            this.matrix.multiplyMatrices(b, this.matrix);
            this.position.getPositionFromMatrix(this.matrix);
            this.scale.getScaleFromMatrix(this.matrix);
            a.extractRotation(this.matrix);
            this.quaternion.setFromRotationMatrix(a)
        }
    }(),
    setRotationFromAxisAngle: function(a, b) {
        this.quaternion.setFromAxisAngle(a, b)
    },
    setRotationFromEuler: function(a) {
        this.quaternion.setFromEuler(a, !0)
    },
    setRotationFromMatrix: function(a) {
        this.quaternion.setFromRotationMatrix(a)
    },
    setRotationFromQuaternion: function(a) {
        this.quaternion.copy(a)
    },
    rotateOnAxis: function() {
        var a = new THREE.Quaternion;
        return function(b, c) {
            a.setFromAxisAngle(b, c);
            this.quaternion.multiply(a);
            return this
        }
    }(),
    rotateX: function() {
        var a = new THREE.Vector3(1, 0, 0);
        return function(b) {
            return this.rotateOnAxis(a, b)
        }
    }(),
    rotateY: function() {
        var a = new THREE.Vector3(0, 1, 0);
        return function(b) {
            return this.rotateOnAxis(a, b)
        }
    }(),
    rotateZ: function() {
        var a = new THREE.Vector3(0, 0, 1);
        return function(b) {
            return this.rotateOnAxis(a,
                b)
        }
    }(),
    translateOnAxis: function() {
        var a = new THREE.Vector3;
        return function(b, c) {
            a.copy(b);
            a.applyQuaternion(this.quaternion);
            this.position.add(a.multiplyScalar(c));
            return this
        }
    }(),
    translate: function(a, b) {
        console.warn("DEPRECATED: Object3D's .translate() has been removed. Use .translateOnAxis( axis, distance ) instead. Note args have been changed.");
        return this.translateOnAxis(b, a)
    },
    translateX: function() {
        var a = new THREE.Vector3(1, 0, 0);
        return function(b) {
            return this.translateOnAxis(a, b)
        }
    }(),
    translateY: function() {
        var a =
            new THREE.Vector3(0, 1, 0);
        return function(b) {
            return this.translateOnAxis(a, b)
        }
    }(),
    translateZ: function() {
        var a = new THREE.Vector3(0, 0, 1);
        return function(b) {
            return this.translateOnAxis(a, b)
        }
    }(),
    localToWorld: function(a) {
        return a.applyMatrix4(this.matrixWorld)
    },
    worldToLocal: function() {
        var a = new THREE.Matrix4;
        return function(b) {
            return b.applyMatrix4(a.getInverse(this.matrixWorld))
        }
    }(),
    lookAt: function() {
        var a = new THREE.Matrix4;
        return function(b) {
            a.lookAt(b, this.position, this.up);
            this.quaternion.setFromRotationMatrix(a)
        }
    }(),
    add: function(a) {
        if (a === this) console.warn("THREE.Object3D.add: An object can't be added as a child of itself.");
        else if (a instanceof THREE.Object3D) {
            void 0 !== a.parent && a.parent.remove(a);
            a.parent = this;
            a.dispatchEvent({
                type: "added"
            });
            this.children.push(a);
            for (var b = this; void 0 !== b.parent;) b = b.parent;
            void 0 !== b && b instanceof THREE.Scene && b.__addObject(a)
        }
    },
    remove: function(a) {
        var b = this.children.indexOf(a);
        if (-1 !== b) {
            a.parent = void 0;
            a.dispatchEvent({
                type: "removed"
            });
            this.children.splice(b, 1);
            for (b = this; void 0 !==
                b.parent;) b = b.parent;
            void 0 !== b && b instanceof THREE.Scene && b.__removeObject(a)
        }
    },
    traverse: function(a) {
        a(this);
        for (var b = 0, c = this.children.length; b < c; b++) this.children[b].traverse(a)
    },
    getObjectById: function(a, b) {
        for (var c = 0, d = this.children.length; c < d; c++) {
            var e = this.children[c];
            if (e.id === a || !0 === b && (e = e.getObjectById(a, b), void 0 !== e)) return e
        }
    },
    getObjectByName: function(a, b) {
        for (var c = 0, d = this.children.length; c < d; c++) {
            var e = this.children[c];
            if (e.name === a || !0 === b && (e = e.getObjectByName(a, b), void 0 !==
                    e)) return e
        }
    },
    getChildByName: function(a, b) {
        console.warn("DEPRECATED: Object3D's .getChildByName() has been renamed to .getObjectByName().");
        return this.getObjectByName(a, b)
    },
    getDescendants: function(a) {
        void 0 === a && (a = []);
        Array.prototype.push.apply(a, this.children);
        for (var b = 0, c = this.children.length; b < c; b++) this.children[b].getDescendants(a);
        return a
    },
    updateMatrix: function() {
        this.matrix.compose(this.position, this.quaternion, this.scale);
        this.matrixWorldNeedsUpdate = !0
    },
    updateMatrixWorld: function(a) {
        !0 ===
            this.matrixAutoUpdate && this.updateMatrix();
        if (!0 === this.matrixWorldNeedsUpdate || !0 === a) void 0 === this.parent ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix), this.matrixWorldNeedsUpdate = !1, a = !0;
        for (var b = 0, c = this.children.length; b < c; b++) this.children[b].updateMatrixWorld(a)
    },
    clone: function(a, b) {
        void 0 === a && (a = new THREE.Object3D);
        void 0 === b && (b = !0);
        a.name = this.name;
        a.up.copy(this.up);
        a.position.copy(this.position);
        a.quaternion.copy(this.quaternion);
        a.scale.copy(this.scale);
        a.renderDepth = this.renderDepth;
        a.rotationAutoUpdate = this.rotationAutoUpdate;
        a.matrix.copy(this.matrix);
        a.matrixWorld.copy(this.matrixWorld);
        a.matrixAutoUpdate = this.matrixAutoUpdate;
        a.matrixWorldNeedsUpdate = this.matrixWorldNeedsUpdate;
        a.visible = this.visible;
        a.castShadow = this.castShadow;
        a.receiveShadow = this.receiveShadow;
        a.frustumCulled = this.frustumCulled;
        a.userData = JSON.parse(JSON.stringify(this.userData));
        if (!0 === b)
            for (var c = 0; c < this.children.length; c++) a.add(this.children[c].clone());
        return a
    }
};
THREE.EventDispatcher.prototype.apply(THREE.Object3D.prototype);
THREE.Object3DIdCount = 0;
THREE.Projector = function() {
    function a() {
        if (i === m) {
            var a = new THREE.RenderableVertex;
            k.push(a);
            m++;
            i++;
            return a
        }
        return k[i++]
    }

    function b(a, b) {
        return a.z !== b.z ? b.z - a.z : a.id !== b.id ? a.id - b.id : 0
    }

    function c(a, b) {
        var c = 0,
            d = 1,
            e = a.z + a.w,
            f = b.z + b.w,
            h = -a.z + a.w,
            g = -b.z + b.w;
        if (0 <= e && 0 <= f && 0 <= h && 0 <= g) return !0;
        if (0 > e && 0 > f || 0 > h && 0 > g) return !1;
        0 > e ? c = Math.max(c, e / (e - f)) : 0 > f && (d = Math.min(d, e / (e - f)));
        0 > h ? c = Math.max(c, h / (h - g)) : 0 > g && (d = Math.min(d, h / (h - g)));
        if (d < c) return !1;
        a.lerp(b, c);
        b.lerp(a, 1 - d);
        return !0
    }
    var d, e, f = [],
        h =
        0,
        g, i, k = [],
        m = 0,
        l, n, t = [],
        q = 0,
        p, r, s = [],
        u = 0,
        w, E, D = [],
        F = 0,
        y = {
            objects: [],
            sprites: [],
            lights: [],
            elements: []
        },
        x = new THREE.Vector3,
        z = new THREE.Vector4,
        O = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)),
        B = new THREE.Box3,
        C = Array(3),
        I = new THREE.Matrix4,
        v = new THREE.Matrix4,
        A, G = new THREE.Matrix4,
        R = new THREE.Matrix3,
        J = new THREE.Matrix3,
        ca = new THREE.Vector3,
        qa = new THREE.Frustum,
        ra = new THREE.Vector4,
        N = new THREE.Vector4;
    this.projectVector = function(a, b) {
        b.matrixWorldInverse.getInverse(b.matrixWorld);
        v.multiplyMatrices(b.projectionMatrix, b.matrixWorldInverse);
        return a.applyProjection(v)
    };
    this.unprojectVector = function(a, b) {
        b.projectionMatrixInverse.getInverse(b.projectionMatrix);
        v.multiplyMatrices(b.matrixWorld, b.projectionMatrixInverse);
        return a.applyProjection(v)
    };
    this.pickingRay = function(a, b) {
        a.z = -1;
        var c = new THREE.Vector3(a.x, a.y, 1);
        this.unprojectVector(a, b);
        this.unprojectVector(c, b);
        c.sub(a).normalize();
        return new THREE.Raycaster(a, c)
    };
    var M = function(a) {
            if (e === h) {
                var b = new THREE.RenderableObject;
                f.push(b);
                h++;
                e++;
                d = b
            } else d = f[e++];
            d.id = a.id;
            d.object = a;
            null !== a.renderDepth ? d.z = a.renderDepth : (x.getPositionFromMatrix(a.matrixWorld), x.applyProjection(v), d.z = x.z);
            return d
        },
        Q = function(a) {
            if (!1 !== a.visible) {
                a instanceof THREE.Light ? y.lights.push(a) : a instanceof THREE.Mesh || a instanceof THREE.Line ? (!1 === a.frustumCulled || !0 === qa.intersectsObject(a)) && y.objects.push(M(a)) : (a instanceof THREE.Sprite || a instanceof THREE.Particle) && y.sprites.push(M(a));
                for (var b = 0, c = a.children.length; b < c; b++) Q(a.children[b])
            }
        };
    this.projectScene = function(d, f, h, m) {
        var x = !1,
            M, $, fa, V, P, Y, T, ma, va, ja, Pa, Ja;
        E = r = n = 0;
        y.elements.length = 0;
        !0 === d.autoUpdate && d.updateMatrixWorld();
        void 0 === f.parent && f.updateMatrixWorld();
        I.copy(f.matrixWorldInverse.getInverse(f.matrixWorld));
        v.multiplyMatrices(f.projectionMatrix, I);
        J.getNormalMatrix(I);
        qa.setFromMatrix(v);
        e = 0;
        y.objects.length = 0;
        y.sprites.length = 0;
        y.lights.length = 0;
        Q(d);
        !0 === h && y.objects.sort(b);
        d = 0;
        for (h = y.objects.length; d < h; d++)
            if (T = y.objects[d].object, A = T.matrixWorld, i = 0, T instanceof THREE.Mesh) {
                ma = T.geometry;
                fa = ma.vertices;
                va = ma.faces;
                ma = ma.faceVertexUvs;
                R.getNormalMatrix(A);
                Pa = T.material instanceof THREE.MeshFaceMaterial;
                Ja = !0 === Pa ? T.material : null;
                M = 0;
                for ($ = fa.length; M < $; M++) {
                    g = a();
                    g.positionWorld.copy(fa[M]).applyMatrix4(A);
                    g.positionScreen.copy(g.positionWorld).applyMatrix4(v);
                    var ga = 1 / g.positionScreen.w;
                    g.positionScreen.x *= ga;
                    g.positionScreen.y *= ga;
                    g.positionScreen.z *= ga;
                    g.visible = !(-1 > g.positionScreen.x || 1 < g.positionScreen.x || -1 > g.positionScreen.y || 1 < g.positionScreen.y ||
                        -1 > g.positionScreen.z || 1 < g.positionScreen.z)
                }
                fa = 0;
                for (M = va.length; fa < M; fa++)
                    if ($ = va[fa], ga = !0 === Pa ? Ja.materials[$.materialIndex] : T.material, void 0 !== ga && (Y = ga.side, V = k[$.a], P = k[$.b], ja = k[$.c], C[0] = V.positionScreen, C[1] = P.positionScreen, C[2] = ja.positionScreen, !0 === V.visible || !0 === P.visible || !0 === ja.visible || O.isIntersectionBox(B.setFromPoints(C))))
                        if (x = 0 > (ja.positionScreen.x - V.positionScreen.x) * (P.positionScreen.y - V.positionScreen.y) - (ja.positionScreen.y - V.positionScreen.y) * (P.positionScreen.x - V.positionScreen.x),
                            Y === THREE.DoubleSide || x === (Y === THREE.FrontSide)) {
                            if (n === q) {
                                var Ha = new THREE.RenderableFace3;
                                t.push(Ha);
                                q++;
                                n++;
                                l = Ha
                            } else l = t[n++];
                            l.id = T.id;
                            l.v1.copy(V);
                            l.v2.copy(P);
                            l.v3.copy(ja);
                            l.normalModel.copy($.normal);
                            !1 === x && (Y === THREE.BackSide || Y === THREE.DoubleSide) && l.normalModel.negate();
                            l.normalModel.applyMatrix3(R).normalize();
                            l.normalModelView.copy(l.normalModel).applyMatrix3(J);
                            l.centroidModel.copy($.centroid).applyMatrix4(A);
                            ja = $.vertexNormals;
                            V = 0;
                            for (P = Math.min(ja.length, 3); V < P; V++) Ha = l.vertexNormalsModel[V],
                                Ha.copy(ja[V]), !1 === x && (Y === THREE.BackSide || Y === THREE.DoubleSide) && Ha.negate(), Ha.applyMatrix3(R).normalize(), l.vertexNormalsModelView[V].copy(Ha).applyMatrix3(J);
                            l.vertexNormalsLength = ja.length;
                            x = 0;
                            for (V = Math.min(ma.length, 3); x < V; x++)
                                if (ja = ma[x][fa], void 0 !== ja) {
                                    P = 0;
                                    for (Y = ja.length; P < Y; P++) l.uvs[x][P] = ja[P]
                                }
                            l.color = $.color;
                            l.material = ga;
                            ca.copy(l.centroidModel).applyProjection(v);
                            l.z = ca.z;
                            y.elements.push(l)
                        }
            } else if (T instanceof THREE.Line) {
            G.multiplyMatrices(v, A);
            fa = T.geometry.vertices;
            V = a();
            V.positionScreen.copy(fa[0]).applyMatrix4(G);
            va = T.type === THREE.LinePieces ? 2 : 1;
            M = 1;
            for ($ = fa.length; M < $; M++) V = a(), V.positionScreen.copy(fa[M]).applyMatrix4(G), 0 < (M + 1) % va || (P = k[i - 2], ra.copy(V.positionScreen), N.copy(P.positionScreen), !0 === c(ra, N) && (ra.multiplyScalar(1 / ra.w), N.multiplyScalar(1 / N.w), r === u ? (ma = new THREE.RenderableLine, s.push(ma), u++, r++, p = ma) : p = s[r++], p.id = T.id, p.v1.positionScreen.copy(ra), p.v2.positionScreen.copy(N), p.z = Math.max(ra.z, N.z), p.material = T.material, T.material.vertexColors === THREE.VertexColors && (p.vertexColors[0].copy(T.geometry.colors[M]),
                p.vertexColors[1].copy(T.geometry.colors[M - 1])), y.elements.push(p)))
        }
        d = 0;
        for (h = y.sprites.length; d < h; d++) T = y.sprites[d].object, A = T.matrixWorld, T instanceof THREE.Particle && (z.set(A.elements[12], A.elements[13], A.elements[14], 1), z.applyMatrix4(v), ga = 1 / z.w, z.z *= ga, 0 < z.z && 1 > z.z && (E === F ? (va = new THREE.RenderableParticle, D.push(va), F++, E++, w = va) : w = D[E++], w.id = T.id, w.x = z.x * ga, w.y = z.y * ga, w.z = z.z, w.object = T, w.rotation = T.rotation.z, w.scale.x = T.scale.x * Math.abs(w.x - (z.x + f.projectionMatrix.elements[0]) / (z.w + f.projectionMatrix.elements[12])),
            w.scale.y = T.scale.y * Math.abs(w.y - (z.y + f.projectionMatrix.elements[5]) / (z.w + f.projectionMatrix.elements[13])), w.material = T.material, y.elements.push(w)));
        !0 === m && y.elements.sort(b);
        return y
    }
};
THREE.Face3 = function(a, b, c, d, e, f) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.normal = d instanceof THREE.Vector3 ? d : new THREE.Vector3;
    this.vertexNormals = d instanceof Array ? d : [];
    this.color = e instanceof THREE.Color ? e : new THREE.Color;
    this.vertexColors = e instanceof Array ? e : [];
    this.vertexTangents = [];
    this.materialIndex = void 0 !== f ? f : 0;
    this.centroid = new THREE.Vector3
};
THREE.Face3.prototype = {
    constructor: THREE.Face3,
    clone: function() {
        var a = new THREE.Face3(this.a, this.b, this.c);
        a.normal.copy(this.normal);
        a.color.copy(this.color);
        a.centroid.copy(this.centroid);
        a.materialIndex = this.materialIndex;
        var b, c;
        b = 0;
        for (c = this.vertexNormals.length; b < c; b++) a.vertexNormals[b] = this.vertexNormals[b].clone();
        b = 0;
        for (c = this.vertexColors.length; b < c; b++) a.vertexColors[b] = this.vertexColors[b].clone();
        b = 0;
        for (c = this.vertexTangents.length; b < c; b++) a.vertexTangents[b] = this.vertexTangents[b].clone();
        return a
    }
};
THREE.Face4 = function(a, b, c, d, e, f, h) {
    return new THREE.Face3(a, b, c, e, f, h)
};
THREE.Geometry = function() {
    this.id = THREE.GeometryIdCount++;
    this.uuid = THREE.Math.generateUUID();
    this.name = "";
    this.vertices = [];
    this.colors = [];
    this.normals = [];
    this.faces = [];
    this.faceVertexUvs = [
        []
    ];
    this.morphTargets = [];
    this.morphColors = [];
    this.morphNormals = [];
    this.skinWeights = [];
    this.skinIndices = [];
    this.lineDistances = [];
    this.boundingSphere = this.boundingBox = null;
    this.hasTangents = !1;
    this.dynamic = !0;
    this.buffersNeedUpdate = this.lineDistancesNeedUpdate = this.colorsNeedUpdate = this.tangentsNeedUpdate = this.normalsNeedUpdate =
        this.uvsNeedUpdate = this.elementsNeedUpdate = this.verticesNeedUpdate = !1
};
THREE.Geometry.prototype = {
    constructor: THREE.Geometry,
    applyMatrix: function(a) {
        for (var b = (new THREE.Matrix3).getNormalMatrix(a), c = 0, d = this.vertices.length; c < d; c++) this.vertices[c].applyMatrix4(a);
        c = 0;
        for (d = this.faces.length; c < d; c++) {
            var e = this.faces[c];
            e.normal.applyMatrix3(b).normalize();
            for (var f = 0, h = e.vertexNormals.length; f < h; f++) e.vertexNormals[f].applyMatrix3(b).normalize();
            e.centroid.applyMatrix4(a)
        }
        this.boundingBox instanceof THREE.Box3 && this.computeBoundingBox();
        this.boundingSphere instanceof
        THREE.Sphere && this.computeBoundingSphere()
    },
    computeCentroids: function() {
        var a, b, c;
        a = 0;
        for (b = this.faces.length; a < b; a++) c = this.faces[a], c.centroid.set(0, 0, 0), c.centroid.add(this.vertices[c.a]), c.centroid.add(this.vertices[c.b]), c.centroid.add(this.vertices[c.c]), c.centroid.divideScalar(3)
    },
    computeFaceNormals: function() {
        for (var a = new THREE.Vector3, b = new THREE.Vector3, c = 0, d = this.faces.length; c < d; c++) {
            var e = this.faces[c],
                f = this.vertices[e.a],
                h = this.vertices[e.b];
            a.subVectors(this.vertices[e.c], h);
            b.subVectors(f,
                h);
            a.cross(b);
            a.normalize();
            e.normal.copy(a)
        }
    },
    computeVertexNormals: function(a) {
        var b, c, d, e;
        if (void 0 === this.__tmpVertices) {
            e = this.__tmpVertices = Array(this.vertices.length);
            b = 0;
            for (c = this.vertices.length; b < c; b++) e[b] = new THREE.Vector3;
            b = 0;
            for (c = this.faces.length; b < c; b++) d = this.faces[b], d.vertexNormals = [new THREE.Vector3, new THREE.Vector3, new THREE.Vector3]
        } else {
            e = this.__tmpVertices;
            b = 0;
            for (c = this.vertices.length; b < c; b++) e[b].set(0, 0, 0)
        }
        if (a) {
            var f, h, g = new THREE.Vector3,
                i = new THREE.Vector3;
            new THREE.Vector3;
            new THREE.Vector3;
            new THREE.Vector3;
            b = 0;
            for (c = this.faces.length; b < c; b++) d = this.faces[b], a = this.vertices[d.a], f = this.vertices[d.b], h = this.vertices[d.c], g.subVectors(h, f), i.subVectors(a, f), g.cross(i), e[d.a].add(g), e[d.b].add(g), e[d.c].add(g)
        } else {
            b = 0;
            for (c = this.faces.length; b < c; b++) d = this.faces[b], e[d.a].add(d.normal), e[d.b].add(d.normal), e[d.c].add(d.normal)
        }
        b = 0;
        for (c = this.vertices.length; b < c; b++) e[b].normalize();
        b = 0;
        for (c = this.faces.length; b < c; b++) d = this.faces[b], d.vertexNormals[0].copy(e[d.a]), d.vertexNormals[1].copy(e[d.b]),
            d.vertexNormals[2].copy(e[d.c])
    },
    computeMorphNormals: function() {
        var a, b, c, d, e;
        c = 0;
        for (d = this.faces.length; c < d; c++) {
            e = this.faces[c];
            e.__originalFaceNormal ? e.__originalFaceNormal.copy(e.normal) : e.__originalFaceNormal = e.normal.clone();
            e.__originalVertexNormals || (e.__originalVertexNormals = []);
            a = 0;
            for (b = e.vertexNormals.length; a < b; a++) e.__originalVertexNormals[a] ? e.__originalVertexNormals[a].copy(e.vertexNormals[a]) : e.__originalVertexNormals[a] = e.vertexNormals[a].clone()
        }
        var f = new THREE.Geometry;
        f.faces =
            this.faces;
        a = 0;
        for (b = this.morphTargets.length; a < b; a++) {
            if (!this.morphNormals[a]) {
                this.morphNormals[a] = {};
                this.morphNormals[a].faceNormals = [];
                this.morphNormals[a].vertexNormals = [];
                e = this.morphNormals[a].faceNormals;
                var h = this.morphNormals[a].vertexNormals,
                    g, i;
                c = 0;
                for (d = this.faces.length; c < d; c++) g = new THREE.Vector3, i = {
                    a: new THREE.Vector3,
                    b: new THREE.Vector3,
                    c: new THREE.Vector3
                }, e.push(g), h.push(i)
            }
            h = this.morphNormals[a];
            f.vertices = this.morphTargets[a].vertices;
            f.computeFaceNormals();
            f.computeVertexNormals();
            c = 0;
            for (d = this.faces.length; c < d; c++) e = this.faces[c], g = h.faceNormals[c], i = h.vertexNormals[c], g.copy(e.normal), i.a.copy(e.vertexNormals[0]), i.b.copy(e.vertexNormals[1]), i.c.copy(e.vertexNormals[2])
        }
        c = 0;
        for (d = this.faces.length; c < d; c++) e = this.faces[c], e.normal = e.__originalFaceNormal, e.vertexNormals = e.__originalVertexNormals
    },
    computeTangents: function() {
        var a, b, c, d, e, f, h, g, i, k, m, l, n, t, q, p, r, s = [],
            u = [];
        c = new THREE.Vector3;
        var w = new THREE.Vector3,
            E = new THREE.Vector3,
            D = new THREE.Vector3,
            F = new THREE.Vector3;
        a = 0;
        for (b = this.vertices.length; a < b; a++) s[a] = new THREE.Vector3, u[a] = new THREE.Vector3;
        a = 0;
        for (b = this.faces.length; a < b; a++) e = this.faces[a], f = this.faceVertexUvs[0][a], d = e.a, r = e.b, e = e.c, h = this.vertices[d], g = this.vertices[r], i = this.vertices[e], k = f[0], m = f[1], l = f[2], f = g.x - h.x, n = i.x - h.x, t = g.y - h.y, q = i.y - h.y, g = g.z - h.z, h = i.z - h.z, i = m.x - k.x, p = l.x - k.x, m = m.y - k.y, k = l.y - k.y, l = 1 / (i * k - p * m), c.set((k * f - m * n) * l, (k * t - m * q) * l, (k * g - m * h) * l), w.set((i * n - p * f) * l, (i * q - p * t) * l, (i * h - p * g) * l), s[d].add(c), s[r].add(c), s[e].add(c), u[d].add(w),
            u[r].add(w), u[e].add(w);
        w = ["a", "b", "c", "d"];
        a = 0;
        for (b = this.faces.length; a < b; a++) {
            e = this.faces[a];
            for (c = 0; c < Math.min(e.vertexNormals.length, 3); c++) F.copy(e.vertexNormals[c]), d = e[w[c]], r = s[d], E.copy(r), E.sub(F.multiplyScalar(F.dot(r))).normalize(), D.crossVectors(e.vertexNormals[c], r), d = D.dot(u[d]), d = 0 > d ? -1 : 1, e.vertexTangents[c] = new THREE.Vector4(E.x, E.y, E.z, d)
        }
        this.hasTangents = !0
    },
    computeLineDistances: function() {
        for (var a = 0, b = this.vertices, c = 0, d = b.length; c < d; c++) 0 < c && (a += b[c].distanceTo(b[c - 1])), this.lineDistances[c] =
            a
    },
    computeBoundingBox: function() {
        null === this.boundingBox && (this.boundingBox = new THREE.Box3);
        this.boundingBox.setFromPoints(this.vertices)
    },
    computeBoundingSphere: function() {
        null === this.boundingSphere && (this.boundingSphere = new THREE.Sphere);
        this.boundingSphere.setFromPoints(this.vertices)
    },
    mergeVertices: function() {
        var a = {},
            b = [],
            c = [],
            d, e = Math.pow(10, 4),
            f, h;
        this.__tmpVertices = void 0;
        f = 0;
        for (h = this.vertices.length; f < h; f++) d = this.vertices[f], d = Math.round(d.x * e) + "_" + Math.round(d.y * e) + "_" + Math.round(d.z *
            e), void 0 === a[d] ? (a[d] = f, b.push(this.vertices[f]), c[f] = b.length - 1) : c[f] = c[a[d]];
        a = [];
        f = 0;
        for (h = this.faces.length; f < h; f++) {
            e = this.faces[f];
            e.a = c[e.a];
            e.b = c[e.b];
            e.c = c[e.c];
            e = [e.a, e.b, e.c];
            for (d = 0; 3 > d; d++)
                if (e[d] == e[(d + 1) % 3]) {
                    a.push(f);
                    break
                }
        }
        for (f = a.length - 1; 0 <= f; f--) {
            this.faces.splice(f, 1);
            c = 0;
            for (h = this.faceVertexUvs.length; c < h; c++) this.faceVertexUvs[c].splice(f, 1)
        }
        f = this.vertices.length - b.length;
        this.vertices = b;
        return f
    },
    clone: function() {
        for (var a = new THREE.Geometry, b = this.vertices, c = 0, d = b.length; c <
            d; c++) a.vertices.push(b[c].clone());
        b = this.faces;
        c = 0;
        for (d = b.length; c < d; c++) a.faces.push(b[c].clone());
        b = this.faceVertexUvs[0];
        c = 0;
        for (d = b.length; c < d; c++) {
            for (var e = b[c], f = [], h = 0, g = e.length; h < g; h++) f.push(new THREE.Vector2(e[h].x, e[h].y));
            a.faceVertexUvs[0].push(f)
        }
        return a
    },
    dispose: function() {
        this.dispatchEvent({
            type: "dispose"
        })
    }
};
THREE.EventDispatcher.prototype.apply(THREE.Geometry.prototype);
THREE.GeometryIdCount = 0;
THREE.BufferGeometry = function() {
    this.id = THREE.GeometryIdCount++;
    this.uuid = THREE.Math.generateUUID();
    this.name = "";
    this.attributes = {};
    this.dynamic = !0;
    this.offsets = [];
    this.boundingSphere = this.boundingBox = null;
    this.hasTangents = !1;
    this.morphTargets = []
};
THREE.BufferGeometry.prototype = {
    constructor: THREE.BufferGeometry,
    applyMatrix: function(a) {
        var b, c;
        this.attributes.position && (b = this.attributes.position.array);
        this.attributes.normal && (c = this.attributes.normal.array);
        void 0 !== b && (a.multiplyVector3Array(b), this.verticesNeedUpdate = !0);
        void 0 !== c && ((new THREE.Matrix3).getNormalMatrix(a).multiplyVector3Array(c), this.normalizeNormals(), this.normalsNeedUpdate = !0)
    },
    computeBoundingBox: function() {
        null === this.boundingBox && (this.boundingBox = new THREE.Box3);
        var a =
            this.attributes.position.array;
        if (a) {
            var b = this.boundingBox,
                c, d, e;
            3 <= a.length && (b.min.x = b.max.x = a[0], b.min.y = b.max.y = a[1], b.min.z = b.max.z = a[2]);
            for (var f = 3, h = a.length; f < h; f += 3) c = a[f], d = a[f + 1], e = a[f + 2], c < b.min.x ? b.min.x = c : c > b.max.x && (b.max.x = c), d < b.min.y ? b.min.y = d : d > b.max.y && (b.max.y = d), e < b.min.z ? b.min.z = e : e > b.max.z && (b.max.z = e)
        }
        if (void 0 === a || 0 === a.length) this.boundingBox.min.set(0, 0, 0), this.boundingBox.max.set(0, 0, 0)
    },
    computeBoundingSphere: function() {
        var a = new THREE.Box3,
            b = new THREE.Vector3;
        return function() {
            null ===
                this.boundingSphere && (this.boundingSphere = new THREE.Sphere);
            var c = this.attributes.position.array;
            if (c) {
                for (var d = this.boundingSphere.center, e = 0, f = c.length; e < f; e += 3) b.set(c[e], c[e + 1], c[e + 2]), a.addPoint(b);
                a.center(d);
                for (var h = 0, e = 0, f = c.length; e < f; e += 3) b.set(c[e], c[e + 1], c[e + 2]), h = Math.max(h, d.distanceToSquared(b));
                this.boundingSphere.radius = Math.sqrt(h)
            }
        }
    }(),
    computeVertexNormals: function() {
        if (this.attributes.position) {
            var a, b, c, d;
            a = this.attributes.position.array.length;
            if (void 0 === this.attributes.normal) this.attributes.normal = {
                itemSize: 3,
                array: new Float32Array(a)
            };
            else {
                a = 0;
                for (b = this.attributes.normal.array.length; a < b; a++) this.attributes.normal.array[a] = 0
            }
            var e = this.attributes.position.array,
                f = this.attributes.normal.array,
                h, g, i, k, m, l, n = new THREE.Vector3,
                t = new THREE.Vector3,
                q = new THREE.Vector3,
                p = new THREE.Vector3,
                r = new THREE.Vector3;
            if (this.attributes.index) {
                var s = this.attributes.index.array,
                    u = this.offsets;
                c = 0;
                for (d = u.length; c < d; ++c) {
                    b = u[c].start;
                    h = u[c].count;
                    var w = u[c].index;
                    a = b;
                    for (b += h; a < b; a += 3) h = w + s[a], g = w + s[a + 1], i =
                        w + s[a + 2], k = e[3 * h], m = e[3 * h + 1], l = e[3 * h + 2], n.set(k, m, l), k = e[3 * g], m = e[3 * g + 1], l = e[3 * g + 2], t.set(k, m, l), k = e[3 * i], m = e[3 * i + 1], l = e[3 * i + 2], q.set(k, m, l), p.subVectors(q, t), r.subVectors(n, t), p.cross(r), f[3 * h] += p.x, f[3 * h + 1] += p.y, f[3 * h + 2] += p.z, f[3 * g] += p.x, f[3 * g + 1] += p.y, f[3 * g + 2] += p.z, f[3 * i] += p.x, f[3 * i + 1] += p.y, f[3 * i + 2] += p.z
                }
            } else {
                a = 0;
                for (b = e.length; a < b; a += 9) k = e[a], m = e[a + 1], l = e[a + 2], n.set(k, m, l), k = e[a + 3], m = e[a + 4], l = e[a + 5], t.set(k, m, l), k = e[a + 6], m = e[a + 7], l = e[a + 8], q.set(k, m, l), p.subVectors(q, t), r.subVectors(n, t), p.cross(r),
                    f[a] = p.x, f[a + 1] = p.y, f[a + 2] = p.z, f[a + 3] = p.x, f[a + 4] = p.y, f[a + 5] = p.z, f[a + 6] = p.x, f[a + 7] = p.y, f[a + 8] = p.z
            }
            this.normalizeNormals();
            this.normalsNeedUpdate = !0
        }
    },
    normalizeNormals: function() {
        for (var a = this.attributes.normal.array, b, c, d, e = 0, f = a.length; e < f; e += 3) b = a[e], c = a[e + 1], d = a[e + 2], b = 1 / Math.sqrt(b * b + c * c + d * d), a[e] *= b, a[e + 1] *= b, a[e + 2] *= b
    },
    computeTangents: function() {
        function a(a) {
            qa.x = d[3 * a];
            qa.y = d[3 * a + 1];
            qa.z = d[3 * a + 2];
            ra.copy(qa);
            M = g[a];
            J.copy(M);
            J.sub(qa.multiplyScalar(qa.dot(M))).normalize();
            ca.crossVectors(ra,
                M);
            Q = ca.dot(i[a]);
            N = 0 > Q ? -1 : 1;
            h[4 * a] = J.x;
            h[4 * a + 1] = J.y;
            h[4 * a + 2] = J.z;
            h[4 * a + 3] = N
        }
        if (void 0 === this.attributes.index || void 0 === this.attributes.position || void 0 === this.attributes.normal || void 0 === this.attributes.uv) console.warn("Missing required attributes (index, position, normal or uv) in BufferGeometry.computeTangents()");
        else {
            var b = this.attributes.index.array,
                c = this.attributes.position.array,
                d = this.attributes.normal.array,
                e = this.attributes.uv.array,
                f = c.length / 3;
            void 0 === this.attributes.tangent && (this.attributes.tangent = {
                itemSize: 4,
                array: new Float32Array(4 * f)
            });
            for (var h = this.attributes.tangent.array, g = [], i = [], k = 0; k < f; k++) g[k] = new THREE.Vector3, i[k] = new THREE.Vector3;
            var m, l, n, t, q, p, r, s, u, w, E, D, F, y, x, f = new THREE.Vector3,
                k = new THREE.Vector3,
                z, O, B, C, I, v, A, G = this.offsets;
            B = 0;
            for (C = G.length; B < C; ++B) {
                O = G[B].start;
                I = G[B].count;
                var R = G[B].index;
                z = O;
                for (O += I; z < O; z += 3) I = R + b[z], v = R + b[z + 1], A = R + b[z + 2], m = c[3 * I], l = c[3 * I + 1], n = c[3 * I + 2], t = c[3 * v], q = c[3 * v + 1], p = c[3 * v + 2], r = c[3 * A], s = c[3 * A + 1], u = c[3 * A + 2], w = e[2 * I], E = e[2 * I + 1], D = e[2 * v], F =
                    e[2 * v + 1], y = e[2 * A], x = e[2 * A + 1], t -= m, m = r - m, q -= l, l = s - l, p -= n, n = u - n, D -= w, w = y - w, F -= E, E = x - E, x = 1 / (D * E - w * F), f.set((E * t - F * m) * x, (E * q - F * l) * x, (E * p - F * n) * x), k.set((D * m - w * t) * x, (D * l - w * q) * x, (D * n - w * p) * x), g[I].add(f), g[v].add(f), g[A].add(f), i[I].add(k), i[v].add(k), i[A].add(k)
            }
            var J = new THREE.Vector3,
                ca = new THREE.Vector3,
                qa = new THREE.Vector3,
                ra = new THREE.Vector3,
                N, M, Q;
            B = 0;
            for (C = G.length; B < C; ++B) {
                O = G[B].start;
                I = G[B].count;
                R = G[B].index;
                z = O;
                for (O += I; z < O; z += 3) I = R + b[z], v = R + b[z + 1], A = R + b[z + 2], a(I), a(v), a(A)
            }
            this.tangentsNeedUpdate =
                this.hasTangents = !0
        }
    },
    dispose: function() {
        this.dispatchEvent({
            type: "dispose"
        })
    }
};
THREE.EventDispatcher.prototype.apply(THREE.BufferGeometry.prototype);
THREE.Camera = function() {
    THREE.Object3D.call(this);
    this.matrixWorldInverse = new THREE.Matrix4;
    this.projectionMatrix = new THREE.Matrix4;
    this.projectionMatrixInverse = new THREE.Matrix4
};
THREE.Camera.prototype = Object.create(THREE.Object3D.prototype);
THREE.Camera.prototype.lookAt = function() {
    var a = new THREE.Matrix4;
    return function(b) {
        a.lookAt(this.position, b, this.up);
        this.quaternion.setFromRotationMatrix(a)
    }
}();
THREE.Camera.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Camera);
    THREE.Object3D.prototype.clone.call(this, a);
    a.matrixWorldInverse.copy(this.matrixWorldInverse);
    a.projectionMatrix.copy(this.projectionMatrix);
    a.projectionMatrixInverse.copy(this.projectionMatrixInverse);
    return a
};
THREE.OrthographicCamera = function(a, b, c, d, e, f) {
    THREE.Camera.call(this);
    this.left = a;
    this.right = b;
    this.top = c;
    this.bottom = d;
    this.near = void 0 !== e ? e : 0.1;
    this.far = void 0 !== f ? f : 2E3;
    this.updateProjectionMatrix()
};
THREE.OrthographicCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.OrthographicCamera.prototype.updateProjectionMatrix = function() {
    this.projectionMatrix.makeOrthographic(this.left, this.right, this.top, this.bottom, this.near, this.far)
};
THREE.OrthographicCamera.prototype.clone = function() {
    var a = new THREE.OrthographicCamera;
    THREE.Camera.prototype.clone.call(this, a);
    a.left = this.left;
    a.right = this.right;
    a.top = this.top;
    a.bottom = this.bottom;
    a.near = this.near;
    a.far = this.far;
    return a
};
THREE.PerspectiveCamera = function(a, b, c, d) {
    THREE.Camera.call(this);
    this.fov = void 0 !== a ? a : 50;
    this.aspect = void 0 !== b ? b : 1;
    this.near = void 0 !== c ? c : 0.1;
    this.far = void 0 !== d ? d : 2E3;
    this.updateProjectionMatrix()
};
THREE.PerspectiveCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.PerspectiveCamera.prototype.setLens = function(a, b) {
    void 0 === b && (b = 24);
    this.fov = 2 * THREE.Math.radToDeg(Math.atan(b / (2 * a)));
    this.updateProjectionMatrix()
};
THREE.PerspectiveCamera.prototype.setViewOffset = function(a, b, c, d, e, f) {
    this.fullWidth = a;
    this.fullHeight = b;
    this.x = c;
    this.y = d;
    this.width = e;
    this.height = f;
    this.updateProjectionMatrix()
};
THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function() {
    if (this.fullWidth) {
        var a = this.fullWidth / this.fullHeight,
            b = Math.tan(THREE.Math.degToRad(0.5 * this.fov)) * this.near,
            c = -b,
            d = a * c,
            a = Math.abs(a * b - d),
            c = Math.abs(b - c);
        this.projectionMatrix.makeFrustum(d + this.x * a / this.fullWidth, d + (this.x + this.width) * a / this.fullWidth, b - (this.y + this.height) * c / this.fullHeight, b - this.y * c / this.fullHeight, this.near, this.far)
    } else this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far)
};
THREE.PerspectiveCamera.prototype.clone = function() {
    var a = new THREE.PerspectiveCamera;
    THREE.Camera.prototype.clone.call(this, a);
    a.fov = this.fov;
    a.aspect = this.aspect;
    a.near = this.near;
    a.far = this.far;
    return a
};
THREE.Light = function(a) {
    THREE.Object3D.call(this);
    this.color = new THREE.Color(a)
};
THREE.Light.prototype = Object.create(THREE.Object3D.prototype);
THREE.Light.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Light);
    THREE.Object3D.prototype.clone.call(this, a);
    a.color.copy(this.color);
    return a
};
THREE.AmbientLight = function(a) {
    THREE.Light.call(this, a)
};
THREE.AmbientLight.prototype = Object.create(THREE.Light.prototype);
THREE.AmbientLight.prototype.clone = function() {
    var a = new THREE.AmbientLight;
    THREE.Light.prototype.clone.call(this, a);
    return a
};
THREE.AreaLight = function(a, b) {
    THREE.Light.call(this, a);
    this.normal = new THREE.Vector3(0, -1, 0);
    this.right = new THREE.Vector3(1, 0, 0);
    this.intensity = void 0 !== b ? b : 1;
    this.height = this.width = 1;
    this.constantAttenuation = 1.5;
    this.linearAttenuation = 0.5;
    this.quadraticAttenuation = 0.1
};
THREE.AreaLight.prototype = Object.create(THREE.Light.prototype);
THREE.DirectionalLight = function(a, b) {
    THREE.Light.call(this, a);
    this.position.set(0, 1, 0);
    this.target = new THREE.Object3D;
    this.intensity = void 0 !== b ? b : 1;
    this.onlyShadow = this.castShadow = !1;
    this.shadowCameraNear = 50;
    this.shadowCameraFar = 5E3;
    this.shadowCameraLeft = -500;
    this.shadowCameraTop = this.shadowCameraRight = 500;
    this.shadowCameraBottom = -500;
    this.shadowCameraVisible = !1;
    this.shadowBias = 0;
    this.shadowDarkness = 0.5;
    this.shadowMapHeight = this.shadowMapWidth = 512;
    this.shadowCascade = !1;
    this.shadowCascadeOffset = new THREE.Vector3(0,
        0, -1E3);
    this.shadowCascadeCount = 2;
    this.shadowCascadeBias = [0, 0, 0];
    this.shadowCascadeWidth = [512, 512, 512];
    this.shadowCascadeHeight = [512, 512, 512];
    this.shadowCascadeNearZ = [-1, 0.99, 0.998];
    this.shadowCascadeFarZ = [0.99, 0.998, 1];
    this.shadowCascadeArray = [];
    this.shadowMatrix = this.shadowCamera = this.shadowMapSize = this.shadowMap = null
};
THREE.DirectionalLight.prototype = Object.create(THREE.Light.prototype);
THREE.DirectionalLight.prototype.clone = function() {
    var a = new THREE.DirectionalLight;
    THREE.Light.prototype.clone.call(this, a);
    a.target = this.target.clone();
    a.intensity = this.intensity;
    a.castShadow = this.castShadow;
    a.onlyShadow = this.onlyShadow;
    return a
};
THREE.HemisphereLight = function(a, b, c) {
    THREE.Light.call(this, a);
    this.position.set(0, 100, 0);
    this.groundColor = new THREE.Color(b);
    this.intensity = void 0 !== c ? c : 1
};
THREE.HemisphereLight.prototype = Object.create(THREE.Light.prototype);
THREE.HemisphereLight.prototype.clone = function() {
    var a = new THREE.HemisphereLight;
    THREE.Light.prototype.clone.call(this, a);
    a.groundColor.copy(this.groundColor);
    a.intensity = this.intensity;
    return a
};
THREE.PointLight = function(a, b, c) {
    THREE.Light.call(this, a);
    this.intensity = void 0 !== b ? b : 1;
    this.distance = void 0 !== c ? c : 0
};
THREE.PointLight.prototype = Object.create(THREE.Light.prototype);
THREE.PointLight.prototype.clone = function() {
    var a = new THREE.PointLight;
    THREE.Light.prototype.clone.call(this, a);
    a.intensity = this.intensity;
    a.distance = this.distance;
    return a
};
THREE.SpotLight = function(a, b, c, d, e) {
    THREE.Light.call(this, a);
    this.position.set(0, 1, 0);
    this.target = new THREE.Object3D;
    this.intensity = void 0 !== b ? b : 1;
    this.distance = void 0 !== c ? c : 0;
    this.angle = void 0 !== d ? d : Math.PI / 3;
    this.exponent = void 0 !== e ? e : 10;
    this.onlyShadow = this.castShadow = !1;
    this.shadowCameraNear = 50;
    this.shadowCameraFar = 5E3;
    this.shadowCameraFov = 50;
    this.shadowCameraVisible = !1;
    this.shadowBias = 0;
    this.shadowDarkness = 0.5;
    this.shadowMapHeight = this.shadowMapWidth = 512;
    this.shadowMatrix = this.shadowCamera = this.shadowMapSize =
        this.shadowMap = null
};
THREE.SpotLight.prototype = Object.create(THREE.Light.prototype);
THREE.SpotLight.prototype.clone = function() {
    var a = new THREE.SpotLight;
    THREE.Light.prototype.clone.call(this, a);
    a.target = this.target.clone();
    a.intensity = this.intensity;
    a.distance = this.distance;
    a.angle = this.angle;
    a.exponent = this.exponent;
    a.castShadow = this.castShadow;
    a.onlyShadow = this.onlyShadow;
    return a
};
THREE.Loader = function(a) {
    this.statusDomElement = (this.showStatus = a) ? THREE.Loader.prototype.addStatusElement() : null;
    this.onLoadStart = function() {};
    this.onLoadProgress = function() {};
    this.onLoadComplete = function() {}
};
THREE.Loader.prototype = {
    constructor: THREE.Loader,
    crossOrigin: "anonymous",
    addStatusElement: function() {
        var a = document.createElement("div");
        a.style.position = "absolute";
        a.style.right = "0px";
        a.style.top = "0px";
        a.style.fontSize = "0.8em";
        a.style.textAlign = "left";
        a.style.background = "rgba(0,0,0,0.25)";
        a.style.color = "#fff";
        a.style.width = "120px";
        a.style.padding = "0.5em 0.5em 0.5em 0.5em";
        a.style.zIndex = 1E3;
        a.innerHTML = "Loading ...";
        return a
    },
    updateProgress: function(a) {
        var b = "Loaded ",
            b = a.total ? b + ((100 * a.loaded /
                a.total).toFixed(0) + "%") : b + ((a.loaded / 1E3).toFixed(2) + " KB");
        this.statusDomElement.innerHTML = b
    },
    extractUrlBase: function(a) {
        a = a.split("/");
        a.pop();
        return (1 > a.length ? "." : a.join("/")) + "/"
    },
    initMaterials: function(a, b) {
        for (var c = [], d = 0; d < a.length; ++d) c[d] = THREE.Loader.prototype.createMaterial(a[d], b);
        return c
    },
    needsTangents: function(a) {
        for (var b = 0, c = a.length; b < c; b++)
            if (a[b] instanceof THREE.ShaderMaterial) return !0;
        return !1
    },
    createMaterial: function(a, b) {
        function c(a) {
            a = Math.log(a) / Math.LN2;
            return Math.floor(a) ==
                a
        }

        function d(a) {
            a = Math.log(a) / Math.LN2;
            return Math.pow(2, Math.round(a))
        }

        function e(a, e, f, g, i, k, r) {
            var s = /\.dds$/i.test(f),
                u = b + "/" + f;
            if (s) {
                var w = THREE.ImageUtils.loadCompressedTexture(u);
                a[e] = w
            } else w = document.createElement("canvas"), a[e] = new THREE.Texture(w);
            a[e].sourceFile = f;
            g && (a[e].repeat.set(g[0], g[1]), 1 !== g[0] && (a[e].wrapS = THREE.RepeatWrapping), 1 !== g[1] && (a[e].wrapT = THREE.RepeatWrapping));
            i && a[e].offset.set(i[0], i[1]);
            k && (f = {
                    repeat: THREE.RepeatWrapping,
                    mirror: THREE.MirroredRepeatWrapping
                }, void 0 !==
                f[k[0]] && (a[e].wrapS = f[k[0]]), void 0 !== f[k[1]] && (a[e].wrapT = f[k[1]]));
            r && (a[e].anisotropy = r);
            if (!s) {
                var E = a[e],
                    a = new Image;
                a.onload = function() {
                    if (!c(this.width) || !c(this.height)) {
                        var a = d(this.width),
                            b = d(this.height);
                        E.image.width = a;
                        E.image.height = b;
                        E.image.getContext("2d").drawImage(this, 0, 0, a, b)
                    } else E.image = this;
                    E.needsUpdate = !0
                };
                a.crossOrigin = h.crossOrigin;
                a.src = u
            }
        }

        function f(a) {
            return (255 * a[0] << 16) + (255 * a[1] << 8) + 255 * a[2]
        }
        var h = this,
            g = "MeshLambertMaterial",
            i = {
                color: 15658734,
                opacity: 1,
                map: null,
                lightMap: null,
                normalMap: null,
                bumpMap: null,
                wireframe: !1
            };
        if (a.shading) {
            var k = a.shading.toLowerCase();
            "phong" === k ? g = "MeshPhongMaterial" : "basic" === k && (g = "MeshBasicMaterial")
        }
        void 0 !== a.blending && void 0 !== THREE[a.blending] && (i.blending = THREE[a.blending]);
        if (void 0 !== a.transparent || 1 > a.opacity) i.transparent = a.transparent;
        void 0 !== a.depthTest && (i.depthTest = a.depthTest);
        void 0 !== a.depthWrite && (i.depthWrite = a.depthWrite);
        void 0 !== a.visible && (i.visible = a.visible);
        void 0 !== a.flipSided && (i.side = THREE.BackSide);
        void 0 !== a.doubleSided && (i.side = THREE.DoubleSide);
        void 0 !== a.wireframe && (i.wireframe = a.wireframe);
        void 0 !== a.vertexColors && ("face" === a.vertexColors ? i.vertexColors = THREE.FaceColors : a.vertexColors && (i.vertexColors = THREE.VertexColors));
        a.colorDiffuse ? i.color = f(a.colorDiffuse) : a.DbgColor && (i.color = a.DbgColor);
        a.colorSpecular && (i.specular = f(a.colorSpecular));
        a.colorAmbient && (i.ambient = f(a.colorAmbient));
        a.transparency && (i.opacity = a.transparency);
        a.specularCoef && (i.shininess = a.specularCoef);
        a.mapDiffuse &&
            b && e(i, "map", a.mapDiffuse, a.mapDiffuseRepeat, a.mapDiffuseOffset, a.mapDiffuseWrap, a.mapDiffuseAnisotropy);
        a.mapLight && b && e(i, "lightMap", a.mapLight, a.mapLightRepeat, a.mapLightOffset, a.mapLightWrap, a.mapLightAnisotropy);
        a.mapBump && b && e(i, "bumpMap", a.mapBump, a.mapBumpRepeat, a.mapBumpOffset, a.mapBumpWrap, a.mapBumpAnisotropy);
        a.mapNormal && b && e(i, "normalMap", a.mapNormal, a.mapNormalRepeat, a.mapNormalOffset, a.mapNormalWrap, a.mapNormalAnisotropy);
        a.mapSpecular && b && e(i, "specularMap", a.mapSpecular, a.mapSpecularRepeat,
            a.mapSpecularOffset, a.mapSpecularWrap, a.mapSpecularAnisotropy);
        a.mapBumpScale && (i.bumpScale = a.mapBumpScale);
        a.mapNormal ? (g = THREE.ShaderLib.normalmap, k = THREE.UniformsUtils.clone(g.uniforms), k.tNormal.value = i.normalMap, a.mapNormalFactor && k.uNormalScale.value.set(a.mapNormalFactor, a.mapNormalFactor), i.map && (k.tDiffuse.value = i.map, k.enableDiffuse.value = !0), i.specularMap && (k.tSpecular.value = i.specularMap, k.enableSpecular.value = !0), i.lightMap && (k.tAO.value = i.lightMap, k.enableAO.value = !0), k.uDiffuseColor.value.setHex(i.color),
            k.uSpecularColor.value.setHex(i.specular), k.uAmbientColor.value.setHex(i.ambient), k.uShininess.value = i.shininess, void 0 !== i.opacity && (k.uOpacity.value = i.opacity), g = new THREE.ShaderMaterial({
                fragmentShader: g.fragmentShader,
                vertexShader: g.vertexShader,
                uniforms: k,
                lights: !0,
                fog: !0
            }), i.transparent && (g.transparent = !0)) : g = new THREE[g](i);
        void 0 !== a.DbgName && (g.name = a.DbgName);
        return g
    }
};
THREE.XHRLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.XHRLoader.prototype = {
    constructor: THREE.XHRLoader,
    load: function(a, b, c, d) {
        var e = this,
            f = new XMLHttpRequest;
        void 0 !== b && f.addEventListener("load", function(c) {
            b(c.target.responseText);
            e.manager.itemEnd(a)
        }, !1);
        void 0 !== c && f.addEventListener("progress", function(a) {
            c(a)
        }, !1);
        void 0 !== d && f.addEventListener("error", function(a) {
            d(a)
        }, !1);
        void 0 !== this.crossOrigin && (f.crossOrigin = this.crossOrigin);
        f.open("GET", a, !0);
        f.send(null);
        e.manager.itemStart(a)
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    }
};
THREE.ImageLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.ImageLoader.prototype = {
    constructor: THREE.ImageLoader,
    load: function(a, b, c, d) {
        var e = this,
            f = document.createElement("img");
        void 0 !== b && f.addEventListener("load", function() {
            e.manager.itemEnd(a);
            b(this)
        }, !1);
        void 0 !== c && f.addEventListener("progress", function(a) {
            c(a)
        }, !1);
        void 0 !== d && f.addEventListener("error", function(a) {
            d(a)
        }, !1);
        void 0 !== this.crossOrigin && (f.crossOrigin = this.crossOrigin);
        f.src = a;
        e.manager.itemStart(a)
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    }
};
THREE.JSONLoader = function(a) {
    THREE.Loader.call(this, a);
    this.withCredentials = !1
};
THREE.JSONLoader.prototype = Object.create(THREE.Loader.prototype);
THREE.JSONLoader.prototype.load = function(a, b, c) {
    c = c && "string" === typeof c ? c : this.extractUrlBase(a);
    this.onLoadStart();
    this.loadAjaxJSON(this, a, b, c)
};
THREE.JSONLoader.prototype.loadAjaxJSON = function(a, b, c, d, e) {
    var f = new XMLHttpRequest,
        h = 0;
    f.onreadystatechange = function() {
        if (f.readyState === f.DONE)
            if (200 === f.status || 0 === f.status) {
                if (f.responseText) {
                    var g = JSON.parse(f.responseText),
                        g = a.parse(g, d);
                    c(g.geometry, g.materials)
                } else console.warn("THREE.JSONLoader: [" + b + "] seems to be unreachable or file there is empty");
                a.onLoadComplete()
            } else console.error("THREE.JSONLoader: Couldn't load [" + b + "] [" + f.status + "]");
        else f.readyState === f.LOADING ? e && (0 === h &&
            (h = f.getResponseHeader("Content-Length")), e({
                total: h,
                loaded: f.responseText.length
            })) : f.readyState === f.HEADERS_RECEIVED && void 0 !== e && (h = f.getResponseHeader("Content-Length"))
    };
    f.open("GET", b, !0);
    f.withCredentials = this.withCredentials;
    f.send(null)
};
THREE.JSONLoader.prototype.parse = function(a, b) {
    var c = new THREE.Geometry,
        d = void 0 !== a.scale ? 1 / a.scale : 1,
        e, f, h, g, i, k, m, l, n, t, q, p, r, s, u = a.faces;
    n = a.vertices;
    var w = a.normals,
        E = a.colors,
        D = 0;
    if (void 0 !== a.uvs) {
        for (e = 0; e < a.uvs.length; e++) a.uvs[e].length && D++;
        for (e = 0; e < D; e++) c.faceVertexUvs[e] = []
    }
    g = 0;
    for (i = n.length; g < i;) k = new THREE.Vector3, k.x = n[g++] * d, k.y = n[g++] * d, k.z = n[g++] * d, c.vertices.push(k);
    g = 0;
    for (i = u.length; g < i;)
        if (n = u[g++], t = n & 1, h = n & 2, e = n & 8, m = n & 16, q = n & 32, k = n & 64, n &= 128, t) {
            t = new THREE.Face3;
            t.a = u[g];
            t.b = u[g + 1];
            t.c = u[g + 3];
            p = new THREE.Face3;
            p.a = u[g + 1];
            p.b = u[g + 2];
            p.c = u[g + 3];
            g += 4;
            h && (h = u[g++], t.materialIndex = h, p.materialIndex = h);
            h = c.faces.length;
            if (e)
                for (e = 0; e < D; e++) {
                    r = a.uvs[e];
                    c.faceVertexUvs[e][h] = [];
                    c.faceVertexUvs[e][h + 1] = [];
                    for (f = 0; 4 > f; f++) l = u[g++], s = r[2 * l], l = r[2 * l + 1], s = new THREE.Vector2(s, l), 2 !== f && c.faceVertexUvs[e][h].push(s), 0 !== f && c.faceVertexUvs[e][h + 1].push(s)
                }
            m && (m = 3 * u[g++], t.normal.set(w[m++], w[m++], w[m]), p.normal.copy(t.normal));
            if (q)
                for (e = 0; 4 > e; e++) m = 3 * u[g++], q = new THREE.Vector3(w[m++],
                    w[m++], w[m]), 2 !== e && t.vertexNormals.push(q), 0 !== e && p.vertexNormals.push(q);
            k && (k = u[g++], k = E[k], t.color.setHex(k), p.color.setHex(k));
            if (n)
                for (e = 0; 4 > e; e++) k = u[g++], k = E[k], 2 !== e && t.vertexColors.push(new THREE.Color(k)), 0 !== e && p.vertexColors.push(new THREE.Color(k));
            c.faces.push(t);
            c.faces.push(p)
        } else {
            t = new THREE.Face3;
            t.a = u[g++];
            t.b = u[g++];
            t.c = u[g++];
            h && (h = u[g++], t.materialIndex = h);
            h = c.faces.length;
            if (e)
                for (e = 0; e < D; e++) {
                    r = a.uvs[e];
                    c.faceVertexUvs[e][h] = [];
                    for (f = 0; 3 > f; f++) l = u[g++], s = r[2 * l], l = r[2 * l + 1],
                        s = new THREE.Vector2(s, l), c.faceVertexUvs[e][h].push(s)
                }
            m && (m = 3 * u[g++], t.normal.set(w[m++], w[m++], w[m]));
            if (q)
                for (e = 0; 3 > e; e++) m = 3 * u[g++], q = new THREE.Vector3(w[m++], w[m++], w[m]), t.vertexNormals.push(q);
            k && (k = u[g++], t.color.setHex(E[k]));
            if (n)
                for (e = 0; 3 > e; e++) k = u[g++], t.vertexColors.push(new THREE.Color(E[k]));
            c.faces.push(t)
        }
    if (a.skinWeights) {
        g = 0;
        for (i = a.skinWeights.length; g < i; g += 2) u = a.skinWeights[g], w = a.skinWeights[g + 1], c.skinWeights.push(new THREE.Vector4(u, w, 0, 0))
    }
    if (a.skinIndices) {
        g = 0;
        for (i = a.skinIndices.length; g <
            i; g += 2) u = a.skinIndices[g], w = a.skinIndices[g + 1], c.skinIndices.push(new THREE.Vector4(u, w, 0, 0))
    }
    c.bones = a.bones;
    c.animation = a.animation;
    if (void 0 !== a.morphTargets) {
        g = 0;
        for (i = a.morphTargets.length; g < i; g++) {
            c.morphTargets[g] = {};
            c.morphTargets[g].name = a.morphTargets[g].name;
            c.morphTargets[g].vertices = [];
            E = c.morphTargets[g].vertices;
            D = a.morphTargets[g].vertices;
            u = 0;
            for (w = D.length; u < w; u += 3) n = new THREE.Vector3, n.x = D[u] * d, n.y = D[u + 1] * d, n.z = D[u + 2] * d, E.push(n)
        }
    }
    if (void 0 !== a.morphColors) {
        g = 0;
        for (i = a.morphColors.length; g <
            i; g++) {
            c.morphColors[g] = {};
            c.morphColors[g].name = a.morphColors[g].name;
            c.morphColors[g].colors = [];
            w = c.morphColors[g].colors;
            E = a.morphColors[g].colors;
            d = 0;
            for (u = E.length; d < u; d += 3) D = new THREE.Color(16755200), D.setRGB(E[d], E[d + 1], E[d + 2]), w.push(D)
        }
    }
    c.computeCentroids();
    c.computeFaceNormals();
    c.computeBoundingSphere();
    if (void 0 === a.materials) return {
        geometry: c
    };
    d = this.initMaterials(a.materials, b);
    this.needsTangents(d) && c.computeTangents();
    return {
        geometry: c,
        materials: d
    }
};
THREE.LoadingManager = function(a, b, c) {
    var d = this,
        e = 0,
        f = 0;
    this.onLoad = a;
    this.onProgress = b;
    this.onError = c;
    this.itemStart = function() {
        f++
    };
    this.itemEnd = function(a) {
        e++;
        if (void 0 !== d.onProgress) d.onProgress(a, e, f);
        if (e === f && void 0 !== d.onLoad) d.onLoad()
    }
};
THREE.DefaultLoadingManager = new THREE.LoadingManager;
THREE.BufferGeometryLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.BufferGeometryLoader.prototype = {
    constructor: THREE.BufferGeometryLoader,
    load: function(a, b) {
        var c = this,
            d = new THREE.XHRLoader;
        d.setCrossOrigin(this.crossOrigin);
        d.load(a, function(a) {
            b(c.parse(JSON.parse(a)))
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    },
    parse: function(a) {
        var b = new THREE.BufferGeometry,
            c = a.attributes,
            d = a.offsets,
            a = a.boundingSphere,
            e;
        for (e in c) {
            var f = c[e];
            b.attributes[e] = {
                itemSize: f.itemSize,
                array: new self[f.type](f.array)
            }
        }
        void 0 !== d && (b.offsets = JSON.parse(JSON.stringify(d)));
        void 0 !== a && (b.boundingSphere = new THREE.Sphere((new THREE.Vector3).fromArray(void 0 !== a.center ? a.center : [0, 0, 0]), a.radius));
        return b
    }
};
THREE.GeometryLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.GeometryLoader.prototype = {
    constructor: THREE.GeometryLoader,
    load: function(a, b) {
        var c = this,
            d = new THREE.XHRLoader;
        d.setCrossOrigin(this.crossOrigin);
        d.load(a, function(a) {
            b(c.parse(JSON.parse(a)))
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    },
    parse: function() {}
};
THREE.MaterialLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.MaterialLoader.prototype = {
    constructor: THREE.MaterialLoader,
    load: function(a, b) {
        var c = this,
            d = new THREE.XHRLoader;
        d.setCrossOrigin(this.crossOrigin);
        d.load(a, function(a) {
            b(c.parse(JSON.parse(a)))
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    },
    parse: function(a) {
        var b = new THREE[a.type];
        void 0 !== a.color && b.color.setHex(a.color);
        void 0 !== a.ambient && b.ambient.setHex(a.ambient);
        void 0 !== a.emissive && b.emissive.setHex(a.emissive);
        void 0 !== a.specular && b.specular.setHex(a.specular);
        void 0 !== a.shininess &&
            (b.shininess = a.shininess);
        void 0 !== a.vertexColors && (b.vertexColors = a.vertexColors);
        void 0 !== a.blending && (b.blending = a.blending);
        void 0 !== a.opacity && (b.opacity = a.opacity);
        void 0 !== a.transparent && (b.transparent = a.transparent);
        void 0 !== a.wireframe && (b.wireframe = a.wireframe);
        if (void 0 !== a.materials)
            for (var c = 0, d = a.materials.length; c < d; c++) b.materials.push(this.parse(a.materials[c]));
        return b
    }
};
THREE.ObjectLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.ObjectLoader.prototype = {
    constructor: THREE.ObjectLoader,
    load: function(a, b) {
        var c = this,
            d = new THREE.XHRLoader(c.manager);
        d.setCrossOrigin(this.crossOrigin);
        d.load(a, function(a) {
            b(c.parse(JSON.parse(a)))
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    },
    parse: function(a) {
        var b = this.parseGeometries(a.geometries),
            c = this.parseMaterials(a.materials);
        return this.parseObject(a.object, b, c)
    },
    parseGeometries: function(a) {
        var b = {};
        if (void 0 !== a)
            for (var c = new THREE.JSONLoader, d = new THREE.BufferGeometryLoader,
                    e = 0, f = a.length; e < f; e++) {
                var h, g = a[e];
                switch (g.type) {
                    case "PlaneGeometry":
                        h = new THREE.PlaneGeometry(g.width, g.height, g.widthSegments, g.heightSegments);
                        break;
                    case "CubeGeometry":
                        h = new THREE.CubeGeometry(g.width, g.height, g.depth, g.widthSegments, g.heightSegments, g.depthSegments);
                        break;
                    case "CylinderGeometry":
                        h = new THREE.CylinderGeometry(g.radiusTop, g.radiusBottom, g.height, g.radiusSegments, g.heightSegments, g.openEnded);
                        break;
                    case "SphereGeometry":
                        h = new THREE.SphereGeometry(g.radius, g.widthSegments, g.heightSegments,
                            g.phiStart, g.phiLength, g.thetaStart, g.thetaLength);
                        break;
                    case "IcosahedronGeometry":
                        h = new THREE.IcosahedronGeometry(g.radius, g.detail);
                        break;
                    case "TorusGeometry":
                        h = new THREE.TorusGeometry(g.radius, g.tube, g.radialSegments, g.tubularSegments, g.arc);
                        break;
                    case "TorusKnotGeometry":
                        h = new THREE.TorusKnotGeometry(g.radius, g.tube, g.radialSegments, g.tubularSegments, g.p, g.q, g.heightScale);
                        break;
                    case "BufferGeometry":
                        h = d.parse(g.data);
                        break;
                    case "Geometry":
                        h = c.parse(g.data).geometry
                }
                h.uuid = g.uuid;
                void 0 !== g.name &&
                    (h.name = g.name);
                b[g.uuid] = h
            }
        return b
    },
    parseMaterials: function(a) {
        var b = {};
        if (void 0 !== a)
            for (var c = new THREE.MaterialLoader, d = 0, e = a.length; d < e; d++) {
                var f = a[d],
                    h = c.parse(f);
                h.uuid = f.uuid;
                void 0 !== f.name && (h.name = f.name);
                b[f.uuid] = h
            }
        return b
    },
    parseObject: function() {
        var a = new THREE.Matrix4;
        return function(b, c, d) {
            var e;
            switch (b.type) {
                case "Scene":
                    e = new THREE.Scene;
                    break;
                case "PerspectiveCamera":
                    e = new THREE.PerspectiveCamera(b.fov, b.aspect, b.near, b.far);
                    break;
                case "OrthographicCamera":
                    e = new THREE.OrthographicCamera(b.left,
                        b.right, b.top, b.bottom, b.near, b.far);
                    break;
                case "AmbientLight":
                    e = new THREE.AmbientLight(b.color);
                    break;
                case "DirectionalLight":
                    e = new THREE.DirectionalLight(b.color, b.intensity);
                    break;
                case "PointLight":
                    e = new THREE.PointLight(b.color, b.intensity, b.distance);
                    break;
                case "SpotLight":
                    e = new THREE.SpotLight(b.color, b.intensity, b.distance, b.angle, b.exponent);
                    break;
                case "HemisphereLight":
                    e = new THREE.HemisphereLight(b.color, b.groundColor, b.intensity);
                    break;
                case "Mesh":
                    e = c[b.geometry];
                    var f = d[b.material];
                    void 0 ===
                        e && console.error("THREE.ObjectLoader: Undefined geometry " + b.geometry);
                    void 0 === f && console.error("THREE.ObjectLoader: Undefined material " + b.material);
                    e = new THREE.Mesh(e, f);
                    break;
                default:
                    e = new THREE.Object3D
            }
            e.uuid = b.uuid;
            void 0 !== b.name && (e.name = b.name);
            void 0 !== b.matrix ? (a.fromArray(b.matrix), a.decompose(e.position, e.quaternion, e.scale)) : (void 0 !== b.position && e.position.fromArray(b.position), void 0 !== b.rotation && e.rotation.fromArray(b.rotation), void 0 !== b.scale && e.scale.fromArray(b.scale));
            void 0 !==
                b.visible && (e.visible = b.visible);
            void 0 !== b.userData && (e.userData = b.userData);
            if (void 0 !== b.children)
                for (var h in b.children) e.add(this.parseObject(b.children[h], c, d));
            return e
        }
    }()
};
THREE.SceneLoader = function() {
    this.onLoadStart = function() {};
    this.onLoadProgress = function() {};
    this.onLoadComplete = function() {};
    this.callbackSync = function() {};
    this.callbackProgress = function() {};
    this.geometryHandlers = {};
    this.hierarchyHandlers = {};
    this.addGeometryHandler("ascii", THREE.JSONLoader)
};
THREE.SceneLoader.prototype = {
    constructor: THREE.SceneLoader,
    load: function(a, b) {
        var c = this,
            d = new THREE.XHRLoader(c.manager);
        d.setCrossOrigin(this.crossOrigin);
        d.load(a, function(d) {
            c.parse(JSON.parse(d), b, a)
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    },
    addGeometryHandler: function(a, b) {
        this.geometryHandlers[a] = {
            loaderClass: b
        }
    },
    addHierarchyHandler: function(a, b) {
        this.hierarchyHandlers[a] = {
            loaderClass: b
        }
    },
    parse: function(a, b, c) {
        function d(a, b) {
            return "relativeToHTML" == b ? a : n + "/" + a
        }

        function e() {
            f(z.scene,
                B.objects)
        }

        function f(a, b) {
            var c, e, h, i, k, m, n;
            for (n in b) {
                var r = z.objects[n],
                    s = b[n];
                if (void 0 === r) {
                    if (s.type && s.type in l.hierarchyHandlers) {
                        if (void 0 === s.loading) {
                            e = {
                                type: 1,
                                url: 1,
                                material: 1,
                                position: 1,
                                rotation: 1,
                                scale: 1,
                                visible: 1,
                                children: 1,
                                userData: 1,
                                skin: 1,
                                morph: 1,
                                mirroredLoop: 1,
                                duration: 1
                            };
                            h = {};
                            for (var D in s) D in e || (h[D] = s[D]);
                            q = z.materials[s.material];
                            s.loading = !0;
                            e = l.hierarchyHandlers[s.type].loaderObject;
                            e.options ? e.load(d(s.url, B.urlBaseType), g(n, a, q, s)) : e.load(d(s.url, B.urlBaseType), g(n,
                                a, q, s), h)
                        }
                    } else if (void 0 !== s.geometry) {
                        if (t = z.geometries[s.geometry]) {
                            r = !1;
                            q = z.materials[s.material];
                            r = q instanceof THREE.ShaderMaterial;
                            h = s.position;
                            i = s.rotation;
                            k = s.scale;
                            c = s.matrix;
                            m = s.quaternion;
                            s.material || (q = new THREE.MeshFaceMaterial(z.face_materials[s.geometry]));
                            q instanceof THREE.MeshFaceMaterial && 0 === q.materials.length && (q = new THREE.MeshFaceMaterial(z.face_materials[s.geometry]));
                            if (q instanceof THREE.MeshFaceMaterial)
                                for (e = 0; e < q.materials.length; e++) r = r || q.materials[e] instanceof THREE.ShaderMaterial;
                            r && t.computeTangents();
                            s.skin ? r = new THREE.SkinnedMesh(t, q) : s.morph ? (r = new THREE.MorphAnimMesh(t, q), void 0 !== s.duration && (r.duration = s.duration), void 0 !== s.time && (r.time = s.time), void 0 !== s.mirroredLoop && (r.mirroredLoop = s.mirroredLoop), q.morphNormals && t.computeMorphNormals()) : r = new THREE.Mesh(t, q);
                            r.name = n;
                            c ? (r.matrixAutoUpdate = !1, r.matrix.set(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13], c[14], c[15])) : (r.position.fromArray(h), m ? r.quaternion.fromArray(m) : r.rotation.fromArray(i),
                                r.scale.fromArray(k));
                            r.visible = s.visible;
                            r.castShadow = s.castShadow;
                            r.receiveShadow = s.receiveShadow;
                            a.add(r);
                            z.objects[n] = r
                        }
                    } else "DirectionalLight" === s.type || "PointLight" === s.type || "AmbientLight" === s.type ? (w = void 0 !== s.color ? s.color : 16777215, E = void 0 !== s.intensity ? s.intensity : 1, "DirectionalLight" === s.type ? (h = s.direction, u = new THREE.DirectionalLight(w, E), u.position.fromArray(h), s.target && (O.push({
                        object: u,
                        targetName: s.target
                    }), u.target = null)) : "PointLight" === s.type ? (h = s.position, e = s.distance, u = new THREE.PointLight(w,
                        E, e), u.position.fromArray(h)) : "AmbientLight" === s.type && (u = new THREE.AmbientLight(w)), a.add(u), u.name = n, z.lights[n] = u, z.objects[n] = u) : "PerspectiveCamera" === s.type || "OrthographicCamera" === s.type ? (h = s.position, i = s.rotation, m = s.quaternion, "PerspectiveCamera" === s.type ? p = new THREE.PerspectiveCamera(s.fov, s.aspect, s.near, s.far) : "OrthographicCamera" === s.type && (p = new THREE.OrthographicCamera(s.left, s.right, s.top, s.bottom, s.near, s.far)), p.name = n, p.position.fromArray(h), void 0 !== m ? p.quaternion.fromArray(m) :
                        void 0 !== i && p.rotation.fromArray(i), a.add(p), z.cameras[n] = p, z.objects[n] = p) : (h = s.position, i = s.rotation, k = s.scale, m = s.quaternion, r = new THREE.Object3D, r.name = n, r.position.fromArray(h), m ? r.quaternion.fromArray(m) : r.rotation.fromArray(i), r.scale.fromArray(k), r.visible = void 0 !== s.visible ? s.visible : !1, a.add(r), z.objects[n] = r, z.empties[n] = r);
                    if (r) {
                        if (void 0 !== s.userData)
                            for (var x in s.userData) r.userData[x] = s.userData[x];
                        if (void 0 !== s.groups)
                            for (e = 0; e < s.groups.length; e++) h = s.groups[e], void 0 === z.groups[h] &&
                                (z.groups[h] = []), z.groups[h].push(n)
                    }
                }
                void 0 !== r && void 0 !== s.children && f(r, s.children)
            }
        }

        function h(a) {
            return function(b, c) {
                b.name = a;
                z.geometries[a] = b;
                z.face_materials[a] = c;
                e();
                D -= 1;
                l.onLoadComplete();
                k()
            }
        }

        function g(a, b, c, d) {
            return function(f) {
                var f = f.content ? f.content : f.dae ? f.scene : f,
                    h = d.rotation,
                    g = d.quaternion,
                    i = d.scale;
                f.position.fromArray(d.position);
                g ? f.quaternion.fromArray(g) : f.rotation.fromArray(h);
                f.scale.fromArray(i);
                c && f.traverse(function(a) {
                    a.material = c
                });
                var m = void 0 !== d.visible ? d.visible :
                    !0;
                f.traverse(function(a) {
                    a.visible = m
                });
                b.add(f);
                f.name = a;
                z.objects[a] = f;
                e();
                D -= 1;
                l.onLoadComplete();
                k()
            }
        }

        function i(a) {
            return function(b, c) {
                b.name = a;
                z.geometries[a] = b;
                z.face_materials[a] = c
            }
        }

        function k() {
            l.callbackProgress({
                totalModels: y,
                totalTextures: x,
                loadedModels: y - D,
                loadedTextures: x - F
            }, z);
            l.onLoadProgress();
            if (0 === D && 0 === F) {
                for (var a = 0; a < O.length; a++) {
                    var c = O[a],
                        d = z.objects[c.targetName];
                    d ? c.object.target = d : (c.object.target = new THREE.Object3D, z.scene.add(c.object.target));
                    c.object.target.userData.targetInverse =
                        c.object
                }
                b(z)
            }
        }

        function m(a, b) {
            b(a);
            if (void 0 !== a.children)
                for (var c in a.children) m(a.children[c], b)
        }
        var l = this,
            n = THREE.Loader.prototype.extractUrlBase(c),
            t, q, p, r, s, u, w, E, D, F, y, x, z, O = [],
            B = a,
            C;
        for (C in this.geometryHandlers) a = this.geometryHandlers[C].loaderClass, this.geometryHandlers[C].loaderObject = new a;
        for (C in this.hierarchyHandlers) a = this.hierarchyHandlers[C].loaderClass, this.hierarchyHandlers[C].loaderObject = new a;
        F = D = 0;
        z = {
            scene: new THREE.Scene,
            geometries: {},
            face_materials: {},
            materials: {},
            textures: {},
            objects: {},
            cameras: {},
            lights: {},
            fogs: {},
            empties: {},
            groups: {}
        };
        if (B.transform && (C = B.transform.position, a = B.transform.rotation, c = B.transform.scale, C && z.scene.position.fromArray(C), a && z.scene.rotation.fromArray(a), c && z.scene.scale.fromArray(c), C || a || c)) z.scene.updateMatrix(), z.scene.updateMatrixWorld();
        C = function(a) {
            return function() {
                F -= a;
                k();
                l.onLoadComplete()
            }
        };
        for (var I in B.fogs) a = B.fogs[I], "linear" === a.type ? r = new THREE.Fog(0, a.near, a.far) : "exp2" === a.type && (r = new THREE.FogExp2(0, a.density)), a = a.color,
            r.color.setRGB(a[0], a[1], a[2]), z.fogs[I] = r;
        for (var v in B.geometries) r = B.geometries[v], r.type in this.geometryHandlers && (D += 1, l.onLoadStart());
        for (var A in B.objects) m(B.objects[A], function(a) {
            a.type && a.type in l.hierarchyHandlers && (D += 1, l.onLoadStart())
        });
        y = D;
        for (v in B.geometries)
            if (r = B.geometries[v], "cube" === r.type) t = new THREE.CubeGeometry(r.width, r.height, r.depth, r.widthSegments, r.heightSegments, r.depthSegments), t.name = v, z.geometries[v] = t;
            else if ("plane" === r.type) t = new THREE.PlaneGeometry(r.width,
            r.height, r.widthSegments, r.heightSegments), t.name = v, z.geometries[v] = t;
        else if ("sphere" === r.type) t = new THREE.SphereGeometry(r.radius, r.widthSegments, r.heightSegments), t.name = v, z.geometries[v] = t;
        else if ("cylinder" === r.type) t = new THREE.CylinderGeometry(r.topRad, r.botRad, r.height, r.radSegs, r.heightSegs), t.name = v, z.geometries[v] = t;
        else if ("torus" === r.type) t = new THREE.TorusGeometry(r.radius, r.tube, r.segmentsR, r.segmentsT), t.name = v, z.geometries[v] = t;
        else if ("icosahedron" === r.type) t = new THREE.IcosahedronGeometry(r.radius,
            r.subdivisions), t.name = v, z.geometries[v] = t;
        else if (r.type in this.geometryHandlers) {
            A = {};
            for (s in r) "type" !== s && "url" !== s && (A[s] = r[s]);
            this.geometryHandlers[r.type].loaderObject.load(d(r.url, B.urlBaseType), h(v), A)
        } else "embedded" === r.type && (A = B.embeds[r.id], A.metadata = B.metadata, A && (A = this.geometryHandlers.ascii.loaderObject.parse(A, ""), i(v)(A.geometry, A.materials)));
        for (var G in B.textures)
            if (v = B.textures[G], v.url instanceof Array) {
                F += v.url.length;
                for (s = 0; s < v.url.length; s++) l.onLoadStart()
            } else F +=
                1, l.onLoadStart();
        x = F;
        for (G in B.textures) {
            v = B.textures[G];
            void 0 !== v.mapping && void 0 !== THREE[v.mapping] && (v.mapping = new THREE[v.mapping]);
            if (v.url instanceof Array) {
                A = v.url.length;
                r = [];
                for (s = 0; s < A; s++) r[s] = d(v.url[s], B.urlBaseType);
                s = (s = /\.dds$/i.test(r[0])) ? THREE.ImageUtils.loadCompressedTextureCube(r, v.mapping, C(A)) : THREE.ImageUtils.loadTextureCube(r, v.mapping, C(A))
            } else s = /\.dds$/i.test(v.url), A = d(v.url, B.urlBaseType), r = C(1), s = s ? THREE.ImageUtils.loadCompressedTexture(A, v.mapping, r) : THREE.ImageUtils.loadTexture(A,
                v.mapping, r), void 0 !== THREE[v.minFilter] && (s.minFilter = THREE[v.minFilter]), void 0 !== THREE[v.magFilter] && (s.magFilter = THREE[v.magFilter]), v.anisotropy && (s.anisotropy = v.anisotropy), v.repeat && (s.repeat.set(v.repeat[0], v.repeat[1]), 1 !== v.repeat[0] && (s.wrapS = THREE.RepeatWrapping), 1 !== v.repeat[1] && (s.wrapT = THREE.RepeatWrapping)), v.offset && s.offset.set(v.offset[0], v.offset[1]), v.wrap && (A = {
                    repeat: THREE.RepeatWrapping,
                    mirror: THREE.MirroredRepeatWrapping
                }, void 0 !== A[v.wrap[0]] && (s.wrapS = A[v.wrap[0]]), void 0 !==
                A[v.wrap[1]] && (s.wrapT = A[v.wrap[1]]));
            z.textures[G] = s
        }
        var R, J;
        for (R in B.materials) {
            G = B.materials[R];
            for (J in G.parameters) "envMap" === J || "map" === J || "lightMap" === J || "bumpMap" === J ? G.parameters[J] = z.textures[G.parameters[J]] : "shading" === J ? G.parameters[J] = "flat" === G.parameters[J] ? THREE.FlatShading : THREE.SmoothShading : "side" === J ? G.parameters[J] = "double" == G.parameters[J] ? THREE.DoubleSide : "back" == G.parameters[J] ? THREE.BackSide : THREE.FrontSide : "blending" === J ? G.parameters[J] = G.parameters[J] in THREE ? THREE[G.parameters[J]] :
                THREE.NormalBlending : "combine" === J ? G.parameters[J] = G.parameters[J] in THREE ? THREE[G.parameters[J]] : THREE.MultiplyOperation : "vertexColors" === J ? "face" == G.parameters[J] ? G.parameters[J] = THREE.FaceColors : G.parameters[J] && (G.parameters[J] = THREE.VertexColors) : "wrapRGB" === J && (C = G.parameters[J], G.parameters[J] = new THREE.Vector3(C[0], C[1], C[2]));
            void 0 !== G.parameters.opacity && 1 > G.parameters.opacity && (G.parameters.transparent = !0);
            G.parameters.normalMap ? (C = THREE.ShaderLib.normalmap, v = THREE.UniformsUtils.clone(C.uniforms),
                s = G.parameters.color, A = G.parameters.specular, r = G.parameters.ambient, I = G.parameters.shininess, v.tNormal.value = z.textures[G.parameters.normalMap], G.parameters.normalScale && v.uNormalScale.value.set(G.parameters.normalScale[0], G.parameters.normalScale[1]), G.parameters.map && (v.tDiffuse.value = G.parameters.map, v.enableDiffuse.value = !0), G.parameters.envMap && (v.tCube.value = G.parameters.envMap, v.enableReflection.value = !0, v.uReflectivity.value = G.parameters.reflectivity), G.parameters.lightMap && (v.tAO.value = G.parameters.lightMap,
                    v.enableAO.value = !0), G.parameters.specularMap && (v.tSpecular.value = z.textures[G.parameters.specularMap], v.enableSpecular.value = !0), G.parameters.displacementMap && (v.tDisplacement.value = z.textures[G.parameters.displacementMap], v.enableDisplacement.value = !0, v.uDisplacementBias.value = G.parameters.displacementBias, v.uDisplacementScale.value = G.parameters.displacementScale), v.uDiffuseColor.value.setHex(s), v.uSpecularColor.value.setHex(A), v.uAmbientColor.value.setHex(r), v.uShininess.value = I, G.parameters.opacity &&
                (v.uOpacity.value = G.parameters.opacity), q = new THREE.ShaderMaterial({
                    fragmentShader: C.fragmentShader,
                    vertexShader: C.vertexShader,
                    uniforms: v,
                    lights: !0,
                    fog: !0
                })) : q = new THREE[G.type](G.parameters);
            q.name = R;
            z.materials[R] = q
        }
        for (R in B.materials)
            if (G = B.materials[R], G.parameters.materials) {
                J = [];
                for (s = 0; s < G.parameters.materials.length; s++) J.push(z.materials[G.parameters.materials[s]]);
                z.materials[R].materials = J
            }
        e();
        z.cameras && B.defaults.camera && (z.currentCamera = z.cameras[B.defaults.camera]);
        z.fogs && B.defaults.fog &&
            (z.scene.fog = z.fogs[B.defaults.fog]);
        l.callbackSync(z);
        k()
    }
};
THREE.TextureLoader = function(a) {
    this.manager = void 0 !== a ? a : THREE.DefaultLoadingManager
};
THREE.TextureLoader.prototype = {
    constructor: THREE.TextureLoader,
    load: function(a, b) {
        var c = new THREE.ImageLoader(this.manager);
        c.setCrossOrigin(this.crossOrigin);
        c.load(a, function(a) {
            a = new THREE.Texture(a);
            a.needsUpdate = !0;
            void 0 !== b && b(a)
        })
    },
    setCrossOrigin: function(a) {
        this.crossOrigin = a
    }
};
THREE.Material = function() {
    this.id = THREE.MaterialIdCount++;
    this.uuid = THREE.Math.generateUUID();
    this.name = "";
    this.side = THREE.FrontSide;
    this.opacity = 1;
    this.transparent = !1;
    this.blending = THREE.NormalBlending;
    this.blendSrc = THREE.SrcAlphaFactor;
    this.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.blendEquation = THREE.AddEquation;
    this.depthWrite = this.depthTest = !0;
    this.polygonOffset = !1;
    this.overdraw = this.alphaTest = this.polygonOffsetUnits = this.polygonOffsetFactor = 0;
    this.needsUpdate = this.visible = !0
};
THREE.Material.prototype = {
    constructor: THREE.Material,
    setValues: function(a) {
        if (void 0 !== a)
            for (var b in a) {
                var c = a[b];
                if (void 0 === c) console.warn("THREE.Material: '" + b + "' parameter is undefined.");
                else if (b in this) {
                    var d = this[b];
                    d instanceof THREE.Color ? d.set(c) : d instanceof THREE.Vector3 && c instanceof THREE.Vector3 ? d.copy(c) : this[b] = "overdraw" == b ? Number(c) : c
                }
            }
    },
    clone: function(a) {
        void 0 === a && (a = new THREE.Material);
        a.name = this.name;
        a.side = this.side;
        a.opacity = this.opacity;
        a.transparent = this.transparent;
        a.blending = this.blending;
        a.blendSrc = this.blendSrc;
        a.blendDst = this.blendDst;
        a.blendEquation = this.blendEquation;
        a.depthTest = this.depthTest;
        a.depthWrite = this.depthWrite;
        a.polygonOffset = this.polygonOffset;
        a.polygonOffsetFactor = this.polygonOffsetFactor;
        a.polygonOffsetUnits = this.polygonOffsetUnits;
        a.alphaTest = this.alphaTest;
        a.overdraw = this.overdraw;
        a.visible = this.visible;
        return a
    },
    dispose: function() {
        this.dispatchEvent({
            type: "dispose"
        })
    }
};
THREE.EventDispatcher.prototype.apply(THREE.Material.prototype);
THREE.MaterialIdCount = 0;
THREE.LineBasicMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.linewidth = 1;
    this.linejoin = this.linecap = "round";
    this.vertexColors = !1;
    this.fog = !0;
    this.setValues(a)
};
THREE.LineBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.LineBasicMaterial.prototype.clone = function() {
    var a = new THREE.LineBasicMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.linewidth = this.linewidth;
    a.linecap = this.linecap;
    a.linejoin = this.linejoin;
    a.vertexColors = this.vertexColors;
    a.fog = this.fog;
    return a
};
THREE.LineDashedMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.scale = this.linewidth = 1;
    this.dashSize = 3;
    this.gapSize = 1;
    this.vertexColors = !1;
    this.fog = !0;
    this.setValues(a)
};
THREE.LineDashedMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.LineDashedMaterial.prototype.clone = function() {
    var a = new THREE.LineDashedMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.linewidth = this.linewidth;
    a.scale = this.scale;
    a.dashSize = this.dashSize;
    a.gapSize = this.gapSize;
    a.vertexColors = this.vertexColors;
    a.fog = this.fog;
    return a
};
THREE.MeshBasicMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.envMap = this.specularMap = this.lightMap = this.map = null;
    this.combine = THREE.MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.fog = !0;
    this.shading = THREE.SmoothShading;
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.wireframeLinejoin = this.wireframeLinecap = "round";
    this.vertexColors = THREE.NoColors;
    this.morphTargets = this.skinning = !1;
    this.setValues(a)
};
THREE.MeshBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshBasicMaterial.prototype.clone = function() {
    var a = new THREE.MeshBasicMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.map = this.map;
    a.lightMap = this.lightMap;
    a.specularMap = this.specularMap;
    a.envMap = this.envMap;
    a.combine = this.combine;
    a.reflectivity = this.reflectivity;
    a.refractionRatio = this.refractionRatio;
    a.fog = this.fog;
    a.shading = this.shading;
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    a.wireframeLinecap = this.wireframeLinecap;
    a.wireframeLinejoin =
        this.wireframeLinejoin;
    a.vertexColors = this.vertexColors;
    a.skinning = this.skinning;
    a.morphTargets = this.morphTargets;
    return a
};
THREE.MeshLambertMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.ambient = new THREE.Color(16777215);
    this.emissive = new THREE.Color(0);
    this.wrapAround = !1;
    this.wrapRGB = new THREE.Vector3(1, 1, 1);
    this.envMap = this.specularMap = this.lightMap = this.map = null;
    this.combine = THREE.MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.fog = !0;
    this.shading = THREE.SmoothShading;
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.wireframeLinejoin = this.wireframeLinecap =
        "round";
    this.vertexColors = THREE.NoColors;
    this.morphNormals = this.morphTargets = this.skinning = !1;
    this.setValues(a)
};
THREE.MeshLambertMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshLambertMaterial.prototype.clone = function() {
    var a = new THREE.MeshLambertMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.ambient.copy(this.ambient);
    a.emissive.copy(this.emissive);
    a.wrapAround = this.wrapAround;
    a.wrapRGB.copy(this.wrapRGB);
    a.map = this.map;
    a.lightMap = this.lightMap;
    a.specularMap = this.specularMap;
    a.envMap = this.envMap;
    a.combine = this.combine;
    a.reflectivity = this.reflectivity;
    a.refractionRatio = this.refractionRatio;
    a.fog = this.fog;
    a.shading = this.shading;
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    a.wireframeLinecap = this.wireframeLinecap;
    a.wireframeLinejoin = this.wireframeLinejoin;
    a.vertexColors = this.vertexColors;
    a.skinning = this.skinning;
    a.morphTargets = this.morphTargets;
    a.morphNormals = this.morphNormals;
    return a
};
THREE.MeshPhongMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.ambient = new THREE.Color(16777215);
    this.emissive = new THREE.Color(0);
    this.specular = new THREE.Color(1118481);
    this.shininess = 30;
    this.metal = !1;
    this.perPixel = !0;
    this.wrapAround = !1;
    this.wrapRGB = new THREE.Vector3(1, 1, 1);
    this.bumpMap = this.lightMap = this.map = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalScale = new THREE.Vector2(1, 1);
    this.envMap = this.specularMap = null;
    this.combine = THREE.MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.fog = !0;
    this.shading = THREE.SmoothShading;
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.wireframeLinejoin = this.wireframeLinecap = "round";
    this.vertexColors = THREE.NoColors;
    this.morphNormals = this.morphTargets = this.skinning = !1;
    this.setValues(a)
};
THREE.MeshPhongMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshPhongMaterial.prototype.clone = function() {
    var a = new THREE.MeshPhongMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.ambient.copy(this.ambient);
    a.emissive.copy(this.emissive);
    a.specular.copy(this.specular);
    a.shininess = this.shininess;
    a.metal = this.metal;
    a.perPixel = this.perPixel;
    a.wrapAround = this.wrapAround;
    a.wrapRGB.copy(this.wrapRGB);
    a.map = this.map;
    a.lightMap = this.lightMap;
    a.bumpMap = this.bumpMap;
    a.bumpScale = this.bumpScale;
    a.normalMap = this.normalMap;
    a.normalScale.copy(this.normalScale);
    a.specularMap = this.specularMap;
    a.envMap = this.envMap;
    a.combine = this.combine;
    a.reflectivity = this.reflectivity;
    a.refractionRatio = this.refractionRatio;
    a.fog = this.fog;
    a.shading = this.shading;
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    a.wireframeLinecap = this.wireframeLinecap;
    a.wireframeLinejoin = this.wireframeLinejoin;
    a.vertexColors = this.vertexColors;
    a.skinning = this.skinning;
    a.morphTargets = this.morphTargets;
    a.morphNormals = this.morphNormals;
    return a
};
THREE.MeshDepthMaterial = function(a) {
    THREE.Material.call(this);
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.setValues(a)
};
THREE.MeshDepthMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshDepthMaterial.prototype.clone = function() {
    var a = new THREE.MeshDepthMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    return a
};
THREE.MeshNormalMaterial = function(a) {
    THREE.Material.call(this, a);
    this.shading = THREE.FlatShading;
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.morphTargets = !1;
    this.setValues(a)
};
THREE.MeshNormalMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshNormalMaterial.prototype.clone = function() {
    var a = new THREE.MeshNormalMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.shading = this.shading;
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    return a
};
THREE.MeshFaceMaterial = function(a) {
    this.materials = a instanceof Array ? a : []
};
THREE.MeshFaceMaterial.prototype.clone = function() {
    return new THREE.MeshFaceMaterial(this.materials.slice(0))
};
THREE.ParticleBasicMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.map = null;
    this.size = 1;
    this.sizeAttenuation = !0;
    this.vertexColors = !1;
    this.fog = !0;
    this.setValues(a)
};
THREE.ParticleBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.ParticleBasicMaterial.prototype.clone = function() {
    var a = new THREE.ParticleBasicMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.map = this.map;
    a.size = this.size;
    a.sizeAttenuation = this.sizeAttenuation;
    a.vertexColors = this.vertexColors;
    a.fog = this.fog;
    return a
};
THREE.ParticleCanvasMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.program = function() {};
    this.setValues(a)
};
THREE.ParticleCanvasMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.ParticleCanvasMaterial.prototype.clone = function() {
    var a = new THREE.ParticleCanvasMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.program = this.program;
    return a
};
THREE.ShaderMaterial = function(a) {
    THREE.Material.call(this);
    this.vertexShader = this.fragmentShader = "void main() {}";
    this.uniforms = {};
    this.defines = {};
    this.attributes = null;
    this.shading = THREE.SmoothShading;
    this.linewidth = 1;
    this.wireframe = !1;
    this.wireframeLinewidth = 1;
    this.lights = this.fog = !1;
    this.vertexColors = THREE.NoColors;
    this.morphNormals = this.morphTargets = this.skinning = !1;
    this.defaultAttributeValues = {
        color: [1, 1, 1],
        uv: [0, 0],
        uv2: [0, 0]
    };
    this.index0AttributeName = "position";
    this.setValues(a)
};
THREE.ShaderMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.ShaderMaterial.prototype.clone = function() {
    var a = new THREE.ShaderMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.fragmentShader = this.fragmentShader;
    a.vertexShader = this.vertexShader;
    a.uniforms = THREE.UniformsUtils.clone(this.uniforms);
    a.attributes = this.attributes;
    a.defines = this.defines;
    a.shading = this.shading;
    a.wireframe = this.wireframe;
    a.wireframeLinewidth = this.wireframeLinewidth;
    a.fog = this.fog;
    a.lights = this.lights;
    a.vertexColors = this.vertexColors;
    a.skinning = this.skinning;
    a.morphTargets =
        this.morphTargets;
    a.morphNormals = this.morphNormals;
    return a
};
THREE.SpriteMaterial = function(a) {
    THREE.Material.call(this);
    this.color = new THREE.Color(16777215);
    this.map = new THREE.Texture;
    this.useScreenCoordinates = !0;
    this.depthTest = !this.useScreenCoordinates;
    this.sizeAttenuation = !this.useScreenCoordinates;
    this.scaleByViewport = !this.sizeAttenuation;
    this.alignment = THREE.SpriteAlignment.center.clone();
    this.fog = !1;
    this.uvOffset = new THREE.Vector2(0, 0);
    this.uvScale = new THREE.Vector2(1, 1);
    this.setValues(a);
    a = a || {};
    void 0 === a.depthTest && (this.depthTest = !this.useScreenCoordinates);
    void 0 === a.sizeAttenuation && (this.sizeAttenuation = !this.useScreenCoordinates);
    void 0 === a.scaleByViewport && (this.scaleByViewport = !this.sizeAttenuation)
};
THREE.SpriteMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.SpriteMaterial.prototype.clone = function() {
    var a = new THREE.SpriteMaterial;
    THREE.Material.prototype.clone.call(this, a);
    a.color.copy(this.color);
    a.map = this.map;
    a.useScreenCoordinates = this.useScreenCoordinates;
    a.sizeAttenuation = this.sizeAttenuation;
    a.scaleByViewport = this.scaleByViewport;
    a.alignment.copy(this.alignment);
    a.uvOffset.copy(this.uvOffset);
    a.uvScale.copy(this.uvScale);
    a.fog = this.fog;
    return a
};
THREE.SpriteAlignment = {};
THREE.SpriteAlignment.topLeft = new THREE.Vector2(1, -1);
THREE.SpriteAlignment.topCenter = new THREE.Vector2(0, -1);
THREE.SpriteAlignment.topRight = new THREE.Vector2(-1, -1);
THREE.SpriteAlignment.centerLeft = new THREE.Vector2(1, 0);
THREE.SpriteAlignment.center = new THREE.Vector2(0, 0);
THREE.SpriteAlignment.centerRight = new THREE.Vector2(-1, 0);
THREE.SpriteAlignment.bottomLeft = new THREE.Vector2(1, 1);
THREE.SpriteAlignment.bottomCenter = new THREE.Vector2(0, 1);
THREE.SpriteAlignment.bottomRight = new THREE.Vector2(-1, 1);
THREE.Texture = function(a, b, c, d, e, f, h, g, i) {
    this.id = THREE.TextureIdCount++;
    this.uuid = THREE.Math.generateUUID();
    this.name = "";
    this.image = a;
    this.mipmaps = [];
    this.mapping = void 0 !== b ? b : new THREE.UVMapping;
    this.wrapS = void 0 !== c ? c : THREE.ClampToEdgeWrapping;
    this.wrapT = void 0 !== d ? d : THREE.ClampToEdgeWrapping;
    this.magFilter = void 0 !== e ? e : THREE.LinearFilter;
    this.minFilter = void 0 !== f ? f : THREE.LinearMipMapLinearFilter;
    this.anisotropy = void 0 !== i ? i : 1;
    this.format = void 0 !== h ? h : THREE.RGBAFormat;
    this.type = void 0 !== g ? g : THREE.UnsignedByteType;
    this.offset = new THREE.Vector2(0, 0);
    this.repeat = new THREE.Vector2(1, 1);
    this.generateMipmaps = !0;
    this.premultiplyAlpha = !1;
    this.flipY = !0;
    this.unpackAlignment = 4;
    this.needsUpdate = !1;
    this.onUpdate = null
};
THREE.Texture.prototype = {
    constructor: THREE.Texture,
    clone: function(a) {
        void 0 === a && (a = new THREE.Texture);
        a.image = this.image;
        a.mipmaps = this.mipmaps.slice(0);
        a.mapping = this.mapping;
        a.wrapS = this.wrapS;
        a.wrapT = this.wrapT;
        a.magFilter = this.magFilter;
        a.minFilter = this.minFilter;
        a.anisotropy = this.anisotropy;
        a.format = this.format;
        a.type = this.type;
        a.offset.copy(this.offset);
        a.repeat.copy(this.repeat);
        a.generateMipmaps = this.generateMipmaps;
        a.premultiplyAlpha = this.premultiplyAlpha;
        a.flipY = this.flipY;
        a.unpackAlignment =
            this.unpackAlignment;
        return a
    },
    dispose: function() {
        this.dispatchEvent({
            type: "dispose"
        })
    }
};
THREE.EventDispatcher.prototype.apply(THREE.Texture.prototype);
THREE.TextureIdCount = 0;
THREE.CompressedTexture = function(a, b, c, d, e, f, h, g, i, k, m) {
    THREE.Texture.call(this, null, f, h, g, i, k, d, e, m);
    this.image = {
        width: b,
        height: c
    };
    this.mipmaps = a;
    this.generateMipmaps = !1
};
THREE.CompressedTexture.prototype = Object.create(THREE.Texture.prototype);
THREE.CompressedTexture.prototype.clone = function() {
    var a = new THREE.CompressedTexture;
    THREE.Texture.prototype.clone.call(this, a);
    return a
};
THREE.DataTexture = function(a, b, c, d, e, f, h, g, i, k, m) {
    THREE.Texture.call(this, null, f, h, g, i, k, d, e, m);
    this.image = {
        data: a,
        width: b,
        height: c
    }
};
THREE.DataTexture.prototype = Object.create(THREE.Texture.prototype);
THREE.DataTexture.prototype.clone = function() {
    var a = new THREE.DataTexture;
    THREE.Texture.prototype.clone.call(this, a);
    return a
};
THREE.Particle = function(a) {
    THREE.Object3D.call(this);
    this.material = a
};
THREE.Particle.prototype = Object.create(THREE.Object3D.prototype);
THREE.Particle.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Particle(this.material));
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.ParticleSystem = function(a, b) {
    THREE.Object3D.call(this);
    this.geometry = void 0 !== a ? a : new THREE.Geometry;
    this.material = void 0 !== b ? b : new THREE.ParticleBasicMaterial({
        color: 16777215 * Math.random()
    });
    this.frustumCulled = this.sortParticles = !1
};
THREE.ParticleSystem.prototype = Object.create(THREE.Object3D.prototype);
THREE.ParticleSystem.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.ParticleSystem(this.geometry, this.material));
    a.sortParticles = this.sortParticles;
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.Line = function(a, b, c) {
    THREE.Object3D.call(this);
    this.geometry = void 0 !== a ? a : new THREE.Geometry;
    this.material = void 0 !== b ? b : new THREE.LineBasicMaterial({
        color: 16777215 * Math.random()
    });
    this.type = void 0 !== c ? c : THREE.LineStrip
};
THREE.LineStrip = 0;
THREE.LinePieces = 1;
THREE.Line.prototype = Object.create(THREE.Object3D.prototype);
THREE.Line.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Line(this.geometry, this.material, this.type));
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.Mesh = function(a, b) {
    THREE.Object3D.call(this);
    this.geometry = void 0 !== a ? a : new THREE.Geometry;
    this.material = void 0 !== b ? b : new THREE.MeshBasicMaterial({
        color: 16777215 * Math.random()
    });
    this.updateMorphTargets()
};
THREE.Mesh.prototype = Object.create(THREE.Object3D.prototype);
THREE.Mesh.prototype.updateMorphTargets = function() {
    if (0 < this.geometry.morphTargets.length) {
        this.morphTargetBase = -1;
        this.morphTargetForcedOrder = [];
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (var a = 0, b = this.geometry.morphTargets.length; a < b; a++) this.morphTargetInfluences.push(0), this.morphTargetDictionary[this.geometry.morphTargets[a].name] = a
    }
};
THREE.Mesh.prototype.getMorphTargetIndexByName = function(a) {
    if (void 0 !== this.morphTargetDictionary[a]) return this.morphTargetDictionary[a];
    console.log("THREE.Mesh.getMorphTargetIndexByName: morph target " + a + " does not exist. Returning 0.");
    return 0
};
THREE.Mesh.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Mesh(this.geometry, this.material));
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.Bone = function(a) {
    THREE.Object3D.call(this);
    this.skin = a;
    this.skinMatrix = new THREE.Matrix4
};
THREE.Bone.prototype = Object.create(THREE.Object3D.prototype);
THREE.Bone.prototype.update = function(a, b) {
    this.matrixAutoUpdate && (b |= this.updateMatrix());
    if (b || this.matrixWorldNeedsUpdate) a ? this.skinMatrix.multiplyMatrices(a, this.matrix) : this.skinMatrix.copy(this.matrix), this.matrixWorldNeedsUpdate = !1, b = !0;
    var c, d = this.children.length;
    for (c = 0; c < d; c++) this.children[c].update(this.skinMatrix, b)
};
THREE.SkinnedMesh = function(a, b, c) {
    THREE.Mesh.call(this, a, b);
    this.useVertexTexture = void 0 !== c ? c : !0;
    this.identityMatrix = new THREE.Matrix4;
    this.bones = [];
    this.boneMatrices = [];
    var d, e, f;
    if (this.geometry && void 0 !== this.geometry.bones) {
        for (a = 0; a < this.geometry.bones.length; a++) c = this.geometry.bones[a], d = c.pos, e = c.rotq, f = c.scl, b = this.addBone(), b.name = c.name, b.position.set(d[0], d[1], d[2]), b.quaternion.set(e[0], e[1], e[2], e[3]), void 0 !== f ? b.scale.set(f[0], f[1], f[2]) : b.scale.set(1, 1, 1);
        for (a = 0; a < this.bones.length; a++) c =
            this.geometry.bones[a], b = this.bones[a], -1 === c.parent ? this.add(b) : this.bones[c.parent].add(b);
        a = this.bones.length;
        this.useVertexTexture ? (this.boneTextureHeight = this.boneTextureWidth = a = 256 < a ? 64 : 64 < a ? 32 : 16 < a ? 16 : 8, this.boneMatrices = new Float32Array(4 * this.boneTextureWidth * this.boneTextureHeight), this.boneTexture = new THREE.DataTexture(this.boneMatrices, this.boneTextureWidth, this.boneTextureHeight, THREE.RGBAFormat, THREE.FloatType), this.boneTexture.minFilter = THREE.NearestFilter, this.boneTexture.magFilter =
            THREE.NearestFilter, this.boneTexture.generateMipmaps = !1, this.boneTexture.flipY = !1) : this.boneMatrices = new Float32Array(16 * a);
        this.pose()
    }
};
THREE.SkinnedMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.SkinnedMesh.prototype.addBone = function(a) {
    void 0 === a && (a = new THREE.Bone(this));
    this.bones.push(a);
    return a
};
THREE.SkinnedMesh.prototype.updateMatrixWorld = function() {
    var a = new THREE.Matrix4;
    return function(b) {
        this.matrixAutoUpdate && this.updateMatrix();
        if (this.matrixWorldNeedsUpdate || b) this.parent ? this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix) : this.matrixWorld.copy(this.matrix), this.matrixWorldNeedsUpdate = !1;
        for (var b = 0, c = this.children.length; b < c; b++) {
            var d = this.children[b];
            d instanceof THREE.Bone ? d.update(this.identityMatrix, !1) : d.updateMatrixWorld(!0)
        }
        if (void 0 == this.boneInverses) {
            this.boneInverses = [];
            b = 0;
            for (c = this.bones.length; b < c; b++) d = new THREE.Matrix4, d.getInverse(this.bones[b].skinMatrix), this.boneInverses.push(d)
        }
        b = 0;
        for (c = this.bones.length; b < c; b++) a.multiplyMatrices(this.bones[b].skinMatrix, this.boneInverses[b]), a.flattenToArrayOffset(this.boneMatrices, 16 * b);
        this.useVertexTexture && (this.boneTexture.needsUpdate = !0)
    }
}();
THREE.SkinnedMesh.prototype.pose = function() {
    this.updateMatrixWorld(!0);
    this.normalizeSkinWeights()
};
THREE.SkinnedMesh.prototype.normalizeSkinWeights = function() {
    if (this.geometry instanceof THREE.Geometry)
        for (var a = 0; a < this.geometry.skinIndices.length; a++) {
            var b = this.geometry.skinWeights[a],
                c = 1 / b.lengthManhattan();
            Infinity !== c ? b.multiplyScalar(c) : b.set(1)
        }
};
THREE.SkinnedMesh.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.SkinnedMesh(this.geometry, this.material, this.useVertexTexture));
    THREE.Mesh.prototype.clone.call(this, a);
    return a
};
THREE.MorphAnimMesh = function(a, b) {
    THREE.Mesh.call(this, a, b);
    this.duration = 1E3;
    this.mirroredLoop = !1;
    this.currentKeyframe = this.lastKeyframe = this.time = 0;
    this.direction = 1;
    this.directionBackwards = !1;
    this.setFrameRange(0, this.geometry.morphTargets.length - 1)
};
THREE.MorphAnimMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.MorphAnimMesh.prototype.setFrameRange = function(a, b) {
    this.startKeyframe = a;
    this.endKeyframe = b;
    this.length = this.endKeyframe - this.startKeyframe + 1
};
THREE.MorphAnimMesh.prototype.setDirectionForward = function() {
    this.direction = 1;
    this.directionBackwards = !1
};
THREE.MorphAnimMesh.prototype.setDirectionBackward = function() {
    this.direction = -1;
    this.directionBackwards = !0
};
THREE.MorphAnimMesh.prototype.parseAnimations = function() {
    var a = this.geometry;
    a.animations || (a.animations = {});
    for (var b, c = a.animations, d = /([a-z]+)(\d+)/, e = 0, f = a.morphTargets.length; e < f; e++) {
        var h = a.morphTargets[e].name.match(d);
        if (h && 1 < h.length) {
            h = h[1];
            c[h] || (c[h] = {
                start: Infinity,
                end: -Infinity
            });
            var g = c[h];
            e < g.start && (g.start = e);
            e > g.end && (g.end = e);
            b || (b = h)
        }
    }
    a.firstAnimation = b
};
THREE.MorphAnimMesh.prototype.setAnimationLabel = function(a, b, c) {
    this.geometry.animations || (this.geometry.animations = {});
    this.geometry.animations[a] = {
        start: b,
        end: c
    }
};
THREE.MorphAnimMesh.prototype.playAnimation = function(a, b) {
    var c = this.geometry.animations[a];
    c ? (this.setFrameRange(c.start, c.end), this.duration = 1E3 * ((c.end - c.start) / b), this.time = 0) : console.warn("animation[" + a + "] undefined")
};
THREE.MorphAnimMesh.prototype.updateAnimation = function(a) {
    var b = this.duration / this.length;
    this.time += this.direction * a;
    if (this.mirroredLoop) {
        if (this.time > this.duration || 0 > this.time) this.direction *= -1, this.time > this.duration && (this.time = this.duration, this.directionBackwards = !0), 0 > this.time && (this.time = 0, this.directionBackwards = !1)
    } else this.time %= this.duration, 0 > this.time && (this.time += this.duration);
    a = this.startKeyframe + THREE.Math.clamp(Math.floor(this.time / b), 0, this.length - 1);
    a !== this.currentKeyframe &&
        (this.morphTargetInfluences[this.lastKeyframe] = 0, this.morphTargetInfluences[this.currentKeyframe] = 1, this.morphTargetInfluences[a] = 0, this.lastKeyframe = this.currentKeyframe, this.currentKeyframe = a);
    b = this.time % b / b;
    this.directionBackwards && (b = 1 - b);
    this.morphTargetInfluences[this.currentKeyframe] = b;
    this.morphTargetInfluences[this.lastKeyframe] = 1 - b
};
THREE.MorphAnimMesh.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.MorphAnimMesh(this.geometry, this.material));
    a.duration = this.duration;
    a.mirroredLoop = this.mirroredLoop;
    a.time = this.time;
    a.lastKeyframe = this.lastKeyframe;
    a.currentKeyframe = this.currentKeyframe;
    a.direction = this.direction;
    a.directionBackwards = this.directionBackwards;
    THREE.Mesh.prototype.clone.call(this, a);
    return a
};
THREE.Ribbon = function(a, b) {
    THREE.Object3D.call(this);
    this.geometry = a;
    this.material = b
};
THREE.Ribbon.prototype = Object.create(THREE.Object3D.prototype);
THREE.Ribbon.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Ribbon(this.geometry, this.material));
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.LOD = function() {
    THREE.Object3D.call(this);
    this.objects = []
};
THREE.LOD.prototype = Object.create(THREE.Object3D.prototype);
THREE.LOD.prototype.addLevel = function(a, b) {
    void 0 === b && (b = 0);
    for (var b = Math.abs(b), c = 0; c < this.objects.length && !(b < this.objects[c].distance); c++);
    this.objects.splice(c, 0, {
        distance: b,
        object: a
    });
    this.add(a)
};
THREE.LOD.prototype.getObjectForDistance = function(a) {
    for (var b = 1, c = this.objects.length; b < c && !(a < this.objects[b].distance); b++);
    return this.objects[b - 1].object
};
THREE.LOD.prototype.update = function() {
    var a = new THREE.Vector3,
        b = new THREE.Vector3;
    return function(c) {
        if (1 < this.objects.length) {
            a.getPositionFromMatrix(c.matrixWorld);
            b.getPositionFromMatrix(this.matrixWorld);
            c = a.distanceTo(b);
            this.objects[0].object.visible = !0;
            for (var d = 1, e = this.objects.length; d < e; d++)
                if (c >= this.objects[d].distance) this.objects[d - 1].object.visible = !1, this.objects[d].object.visible = !0;
                else break;
            for (; d < e; d++) this.objects[d].object.visible = !1
        }
    }
}();
THREE.LOD.prototype.clone = function() {};
THREE.Sprite = function(a) {
    THREE.Object3D.call(this);
    this.material = void 0 !== a ? a : new THREE.SpriteMaterial;
    this.rotation3d = this.rotation;
    this.rotation = 0
};
THREE.Sprite.prototype = Object.create(THREE.Object3D.prototype);
THREE.Sprite.prototype.updateMatrix = function() {
    this.rotation3d.set(0, 0, this.rotation, this.rotation3d.order);
    this.quaternion.setFromEuler(this.rotation3d);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = !0
};
THREE.Sprite.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Sprite(this.material));
    THREE.Object3D.prototype.clone.call(this, a);
    return a
};
THREE.Scene = function() {
    THREE.Object3D.call(this);
    this.overrideMaterial = this.fog = null;
    this.autoUpdate = !0;
    this.matrixAutoUpdate = !1;
    this.__objects = [];
    this.__lights = [];
    this.__objectsAdded = [];
    this.__objectsRemoved = []
};
THREE.Scene.prototype = Object.create(THREE.Object3D.prototype);
THREE.Scene.prototype.__addObject = function(a) {
    if (a instanceof THREE.Light) - 1 === this.__lights.indexOf(a) && this.__lights.push(a), a.target && void 0 === a.target.parent && this.add(a.target);
    else if (!(a instanceof THREE.Camera || a instanceof THREE.Bone) && -1 === this.__objects.indexOf(a)) {
        this.__objects.push(a);
        this.__objectsAdded.push(a);
        var b = this.__objectsRemoved.indexOf(a); - 1 !== b && this.__objectsRemoved.splice(b, 1)
    }
    for (b = 0; b < a.children.length; b++) this.__addObject(a.children[b])
};
THREE.Scene.prototype.__removeObject = function(a) {
    if (a instanceof THREE.Light) {
        var b = this.__lights.indexOf(a); - 1 !== b && this.__lights.splice(b, 1)
    } else a instanceof THREE.Camera || (b = this.__objects.indexOf(a), -1 !== b && (this.__objects.splice(b, 1), this.__objectsRemoved.push(a), b = this.__objectsAdded.indexOf(a), -1 !== b && this.__objectsAdded.splice(b, 1)));
    for (b = 0; b < a.children.length; b++) this.__removeObject(a.children[b])
};
THREE.Scene.prototype.clone = function(a) {
    void 0 === a && (a = new THREE.Scene);
    THREE.Object3D.prototype.clone.call(this, a);
    null !== this.fog && (a.fog = this.fog.clone());
    null !== this.overrideMaterial && (a.overrideMaterial = this.overrideMaterial.clone());
    a.autoUpdate = this.autoUpdate;
    a.matrixAutoUpdate = this.matrixAutoUpdate;
    return a
};
THREE.Fog = function(a, b, c) {
    this.name = "";
    this.color = new THREE.Color(a);
    this.near = void 0 !== b ? b : 1;
    this.far = void 0 !== c ? c : 1E3
};
THREE.Fog.prototype.clone = function() {
    return new THREE.Fog(this.color.getHex(), this.near, this.far)
};
THREE.FogExp2 = function(a, b) {
    this.name = "";
    this.color = new THREE.Color(a);
    this.density = void 0 !== b ? b : 2.5E-4
};
THREE.FogExp2.prototype.clone = function() {
    return new THREE.FogExp2(this.color.getHex(), this.density)
};
THREE.CanvasRenderer = function(a) {
    function b(a, b, c) {
        for (var d = 0, e = E.length; d < e; d++) {
            var f = E[d];
            Pa.copy(f.color);
            if (f instanceof THREE.DirectionalLight) {
                var h = wa.getPositionFromMatrix(f.matrixWorld).normalize(),
                    g = b.dot(h);
                0 >= g || (g *= f.intensity, c.add(Pa.multiplyScalar(g)))
            } else f instanceof THREE.PointLight && (h = wa.getPositionFromMatrix(f.matrixWorld), g = b.dot(wa.subVectors(h, a).normalize()), 0 >= g || (g *= 0 == f.distance ? 1 : 1 - Math.min(a.distanceTo(h) / f.distance, 1), 0 != g && (g *= f.intensity, c.add(Pa.multiplyScalar(g)))))
        }
    }

    function c(a, b, c, d) {
        m(b);
        l(c);
        n(d);
        t(a.getStyle());
        B.stroke();
        ta.expandByScalar(2 * b)
    }

    function d(a) {
        q(a.getStyle());
        B.fill()
    }

    function e(a, b, c, e, f, h, g, j, i, k, m, l, n) {
        if (!(n instanceof THREE.DataTexture || void 0 === n.image || 0 == n.image.width)) {
            if (!0 === n.needsUpdate) {
                var p = n.wrapS == THREE.RepeatWrapping,
                    t = n.wrapT == THREE.RepeatWrapping;
                Ja[n.id] = B.createPattern(n.image, !0 === p && !0 === t ? "repeat" : !0 === p && !1 === t ? "repeat-x" : !1 === p && !0 === t ? "repeat-y" : "no-repeat");
                n.needsUpdate = !1
            }
            void 0 === Ja[n.id] ? q("rgba(0,0,0,1)") :
                q(Ja[n.id]);
            var p = n.offset.x / n.repeat.x,
                t = n.offset.y / n.repeat.y,
                r = n.image.width * n.repeat.x,
                s = n.image.height * n.repeat.y,
                g = (g + p) * r,
                j = (1 - j + t) * s,
                c = c - a,
                e = e - b,
                f = f - a,
                h = h - b,
                i = (i + p) * r - g,
                k = (1 - k + t) * s - j,
                m = (m + p) * r - g,
                l = (1 - l + t) * s - j,
                p = i * l - m * k;
            0 === p ? (void 0 === ga[n.id] && (b = document.createElement("canvas"), b.width = n.image.width, b.height = n.image.height, b = b.getContext("2d"), b.drawImage(n.image, 0, 0), ga[n.id] = b.getImageData(0, 0, n.image.width, n.image.height).data), b = ga[n.id], g = 4 * (Math.floor(g) + Math.floor(j) * n.image.width),
                V.setRGB(b[g] / 255, b[g + 1] / 255, b[g + 2] / 255), d(V)) : (p = 1 / p, n = (l * c - k * f) * p, k = (l * e - k * h) * p, c = (i * f - m * c) * p, e = (i * h - m * e) * p, a = a - n * g - c * j, g = b - k * g - e * j, B.save(), B.transform(n, k, c, e, a, g), B.fill(), B.restore())
        }
    }

    function f(a, b, c, d, e, f, h, g, j, i, k, m, l) {
        var n, p;
        n = l.width - 1;
        p = l.height - 1;
        h *= n;
        g *= p;
        c -= a;
        d -= b;
        e -= a;
        f -= b;
        j = j * n - h;
        i = i * p - g;
        k = k * n - h;
        m = m * p - g;
        p = 1 / (j * m - k * i);
        n = (m * c - i * e) * p;
        i = (m * d - i * f) * p;
        c = (j * e - k * c) * p;
        d = (j * f - k * d) * p;
        a = a - n * h - c * g;
        b = b - i * h - d * g;
        B.save();
        B.transform(n, i, c, d, a, b);
        B.clip();
        B.drawImage(l, 0, 0);
        B.restore()
    }

    function h(a,
        b, c, d) {
        xa[0] = 255 * a.r | 0;
        xa[1] = 255 * a.g | 0;
        xa[2] = 255 * a.b | 0;
        xa[4] = 255 * b.r | 0;
        xa[5] = 255 * b.g | 0;
        xa[6] = 255 * b.b | 0;
        xa[8] = 255 * c.r | 0;
        xa[9] = 255 * c.g | 0;
        xa[10] = 255 * c.b | 0;
        xa[12] = 255 * d.r | 0;
        xa[13] = 255 * d.g | 0;
        xa[14] = 255 * d.b | 0;
        j.putImageData(Ra, 0, 0);
        Ia.drawImage(Sa, 0, 0);
        return ya
    }

    function g(a, b, c) {
        var d = b.x - a.x,
            e = b.y - a.y,
            f = d * d + e * e;
        0 !== f && (c /= Math.sqrt(f), d *= c, e *= c, b.x += d, b.y += e, a.x -= d, a.y -= e)
    }

    function i(a) {
        v !== a && (v = B.globalAlpha = a)
    }

    function k(a) {
        A !== a && (a === THREE.NormalBlending ? B.globalCompositeOperation = "source-over" :
            a === THREE.AdditiveBlending ? B.globalCompositeOperation = "lighter" : a === THREE.SubtractiveBlending && (B.globalCompositeOperation = "darker"), A = a)
    }

    function m(a) {
        J !== a && (J = B.lineWidth = a)
    }

    function l(a) {
        ca !== a && (ca = B.lineCap = a)
    }

    function n(a) {
        qa !== a && (qa = B.lineJoin = a)
    }

    function t(a) {
        G !== a && (G = B.strokeStyle = a)
    }

    function q(a) {
        R !== a && (R = B.fillStyle = a)
    }

    function p(a, b) {
        if (ra !== a || N !== b) B.setLineDash([a, b]), ra = a, N = b
    }
    console.log("THREE.CanvasRenderer", THREE.REVISION);
    var r = THREE.Math.smoothstep,
        a = a || {},
        s = this,
        u, w, E, D =
        new THREE.Projector,
        F = void 0 !== a.canvas ? a.canvas : document.createElement("canvas"),
        y, x, z, O, B = F.getContext("2d"),
        C = new THREE.Color(0),
        I = 0,
        v = 1,
        A = 0,
        G = null,
        R = null,
        J = null,
        ca = null,
        qa = null,
        ra = null,
        N = 0,
        M, Q, K, ea;
    new THREE.RenderableVertex;
    new THREE.RenderableVertex;
    var Da, Fa, ba, Ea, $, fa, V = new THREE.Color,
        P = new THREE.Color,
        Y = new THREE.Color,
        T = new THREE.Color,
        ma = new THREE.Color,
        va = new THREE.Color,
        ja = new THREE.Color,
        Pa = new THREE.Color,
        Ja = {},
        ga = {},
        Ha, Xa, Ta, za, hb, ib, tb, ub, vb, jb, Ka = new THREE.Box2,
        na = new THREE.Box2,
        ta = new THREE.Box2,
        kb = new THREE.Color,
        ua = new THREE.Color,
        ha = new THREE.Color,
        wa = new THREE.Vector3,
        Sa, j, Ra, xa, ya, Ia, Ua = 16;
    Sa = document.createElement("canvas");
    Sa.width = Sa.height = 2;
    j = Sa.getContext("2d");
    j.fillStyle = "rgba(0,0,0,1)";
    j.fillRect(0, 0, 2, 2);
    Ra = j.getImageData(0, 0, 2, 2);
    xa = Ra.data;
    ya = document.createElement("canvas");
    ya.width = ya.height = Ua;
    Ia = ya.getContext("2d");
    Ia.translate(-Ua / 2, -Ua / 2);
    Ia.scale(Ua, Ua);
    Ua--;
    void 0 === B.setLineDash && (B.setLineDash = void 0 !== B.mozDash ? function(a) {
        B.mozDash = null !== a[0] ?
            a : null
    } : function() {});
    this.domElement = F;
    this.devicePixelRatio = void 0 !== a.devicePixelRatio ? a.devicePixelRatio : void 0 !== window.devicePixelRatio ? window.devicePixelRatio : 1;
    this.sortElements = this.sortObjects = this.autoClear = !0;
    this.info = {
        render: {
            vertices: 0,
            faces: 0
        }
    };
    this.supportsVertexTextures = function() {};
    this.setFaceCulling = function() {};
    this.setSize = function(a, b, c) {
        y = a * this.devicePixelRatio;
        x = b * this.devicePixelRatio;
        z = Math.floor(y / 2);
        O = Math.floor(x / 2);
        F.width = y;
        F.height = x;
        1 !== this.devicePixelRatio && !1 !==
            c && (F.style.width = a + "px", F.style.height = b + "px");
        Ka.set(new THREE.Vector2(-z, -O), new THREE.Vector2(z, O));
        na.set(new THREE.Vector2(-z, -O), new THREE.Vector2(z, O));
        v = 1;
        A = 0;
        qa = ca = J = R = G = null
    };
    this.setClearColor = function(a, b) {
        C.set(a);
        I = void 0 !== b ? b : 1;
        na.set(new THREE.Vector2(-z, -O), new THREE.Vector2(z, O))
    };
    this.setClearColorHex = function(a, b) {
        console.warn("DEPRECATED: .setClearColorHex() is being removed. Use .setClearColor() instead.");
        this.setClearColor(a, b)
    };
    this.getMaxAnisotropy = function() {
        return 0
    };
    this.clear = function() {
        B.setTransform(1, 0, 0, -1, z, O);
        !1 === na.empty() && (na.intersect(Ka), na.expandByScalar(2), 1 > I && B.clearRect(na.min.x | 0, na.min.y | 0, na.max.x - na.min.x | 0, na.max.y - na.min.y | 0), 0 < I && (k(THREE.NormalBlending), i(1), q("rgba(" + Math.floor(255 * C.r) + "," + Math.floor(255 * C.g) + "," + Math.floor(255 * C.b) + "," + I + ")"), B.fillRect(na.min.x | 0, na.min.y | 0, na.max.x - na.min.x | 0, na.max.y - na.min.y | 0)), na.makeEmpty())
    };
    this.render = function(a, j) {
        if (!1 === j instanceof THREE.Camera) console.error("THREE.CanvasRenderer.render: camera is not an instance of THREE.Camera.");
        else {
            !0 === this.autoClear && this.clear();
            B.setTransform(1, 0, 0, -1, z, O);
            s.info.render.vertices = 0;
            s.info.render.faces = 0;
            u = D.projectScene(a, j, this.sortObjects, this.sortElements);
            w = u.elements;
            E = u.lights;
            M = j;
            kb.setRGB(0, 0, 0);
            ua.setRGB(0, 0, 0);
            ha.setRGB(0, 0, 0);
            for (var x = 0, G = E.length; x < G; x++) {
                var y = E[x],
                    F = y.color;
                y instanceof THREE.AmbientLight ? kb.add(F) : y instanceof THREE.DirectionalLight ? ua.add(F) : y instanceof THREE.PointLight && ha.add(F)
            }
            x = 0;
            for (G = w.length; x < G; x++) {
                var v = w[x],
                    A = v.material;
                if (!(void 0 === A ||
                        !1 === A.visible)) {
                    ta.makeEmpty();
                    if (v instanceof THREE.RenderableParticle) {
                        Q = v;
                        Q.x *= z;
                        Q.y *= O;
                        var y = Q,
                            F = v,
                            J = A;
                        i(J.opacity);
                        k(J.blending);
                        var N = A = v = void 0,
                            C = void 0,
                            I = void 0,
                            R = void 0,
                            ca = void 0;
                        J instanceof THREE.ParticleBasicMaterial ? null === J.map ? (N = F.object.scale.x, C = F.object.scale.y, N *= F.scale.x * z, C *= F.scale.y * O, ta.min.set(y.x - N, y.y - C), ta.max.set(y.x + N, y.y + C), !1 === Ka.isIntersectionBox(ta) ? ta.makeEmpty() : (q(J.color.getStyle()), B.save(), B.translate(y.x, y.y), B.rotate(-F.rotation), B.scale(N, C), B.fillRect(-1, -1, 2, 2), B.restore())) : (I = J.map.image, R = I.width >> 1, ca = I.height >> 1, N = F.scale.x * z, C = F.scale.y * O, v = N * R, A = C * ca, ta.min.set(y.x - v, y.y - A), ta.max.set(y.x + v, y.y + A), !1 === Ka.isIntersectionBox(ta) ? ta.makeEmpty() : (B.save(), B.translate(y.x, y.y), B.rotate(-F.rotation), B.scale(N, -C), B.translate(-R, -ca), B.drawImage(I, 0, 0), B.restore())) : J instanceof THREE.ParticleCanvasMaterial && (v = F.scale.x * z, A = F.scale.y * O, ta.min.set(y.x - v, y.y - A), ta.max.set(y.x + v, y.y + A), !1 === Ka.isIntersectionBox(ta) ? ta.makeEmpty() : (t(J.color.getStyle()),
                            q(J.color.getStyle()), B.save(), B.translate(y.x, y.y), B.rotate(-F.rotation), B.scale(v, A), J.program(B), B.restore()))
                    } else if (v instanceof THREE.RenderableLine) {
                        if (Q = v.v1, K = v.v2, Q.positionScreen.x *= z, Q.positionScreen.y *= O, K.positionScreen.x *= z, K.positionScreen.y *= O, ta.setFromPoints([Q.positionScreen, K.positionScreen]), !0 === Ka.isIntersectionBox(ta))
                            if (y = Q, F = K, J = v, v = A, i(v.opacity), k(v.blending), B.beginPath(), B.moveTo(y.positionScreen.x, y.positionScreen.y), B.lineTo(F.positionScreen.x, F.positionScreen.y),
                                v instanceof THREE.LineBasicMaterial) {
                                m(v.linewidth);
                                l(v.linecap);
                                n(v.linejoin);
                                if (v.vertexColors !== THREE.VertexColors) t(v.color.getStyle());
                                else if (A = J.vertexColors[0].getStyle(), J = J.vertexColors[1].getStyle(), A === J) t(A);
                                else {
                                    try {
                                        var ga = B.createLinearGradient(y.positionScreen.x, y.positionScreen.y, F.positionScreen.x, F.positionScreen.y);
                                        ga.addColorStop(0, A);
                                        ga.addColorStop(1, J)
                                    } catch (qa) {
                                        ga = A
                                    }
                                    t(ga)
                                }
                                B.stroke();
                                ta.expandByScalar(2 * v.linewidth)
                            } else v instanceof THREE.LineDashedMaterial && (m(v.linewidth),
                                l(v.linecap), n(v.linejoin), t(v.color.getStyle()), p(v.dashSize, v.gapSize), B.stroke(), ta.expandByScalar(2 * v.linewidth), p(null, null))
                    } else if (v instanceof THREE.RenderableFace3) {
                        Q = v.v1;
                        K = v.v2;
                        ea = v.v3;
                        if (-1 > Q.positionScreen.z || 1 < Q.positionScreen.z) continue;
                        if (-1 > K.positionScreen.z || 1 < K.positionScreen.z) continue;
                        if (-1 > ea.positionScreen.z || 1 < ea.positionScreen.z) continue;
                        Q.positionScreen.x *= z;
                        Q.positionScreen.y *= O;
                        K.positionScreen.x *= z;
                        K.positionScreen.y *= O;
                        ea.positionScreen.x *= z;
                        ea.positionScreen.y *= O;
                        0 < A.overdraw && (g(Q.positionScreen, K.positionScreen, A.overdraw), g(K.positionScreen, ea.positionScreen, A.overdraw), g(ea.positionScreen, Q.positionScreen, A.overdraw));
                        ta.setFromPoints([Q.positionScreen, K.positionScreen, ea.positionScreen]);
                        if (!0 === Ka.isIntersectionBox(ta)) {
                            y = Q;
                            F = K;
                            J = ea;
                            s.info.render.vertices += 3;
                            s.info.render.faces++;
                            i(A.opacity);
                            k(A.blending);
                            Da = y.positionScreen.x;
                            Fa = y.positionScreen.y;
                            ba = F.positionScreen.x;
                            Ea = F.positionScreen.y;
                            $ = J.positionScreen.x;
                            fa = J.positionScreen.y;
                            var N = Da,
                                C = Fa,
                                I = ba,
                                R = Ea,
                                ca = $,
                                ra = fa;
                            B.beginPath();
                            B.moveTo(N, C);
                            B.lineTo(I, R);
                            B.lineTo(ca, ra);
                            B.closePath();
                            (A instanceof THREE.MeshLambertMaterial || A instanceof THREE.MeshPhongMaterial) && null === A.map ? (va.copy(A.color), ja.copy(A.emissive), A.vertexColors === THREE.FaceColors && va.multiply(v.color), !1 === A.wireframe && A.shading == THREE.SmoothShading && 3 == v.vertexNormalsLength ? (P.copy(kb), Y.copy(kb), T.copy(kb), b(v.v1.positionWorld, v.vertexNormalsModel[0], P), b(v.v2.positionWorld, v.vertexNormalsModel[1], Y), b(v.v3.positionWorld,
                                    v.vertexNormalsModel[2], T), P.multiply(va).add(ja), Y.multiply(va).add(ja), T.multiply(va).add(ja), ma.addColors(Y, T).multiplyScalar(0.5), Ta = h(P, Y, T, ma), f(Da, Fa, ba, Ea, $, fa, 0, 0, 1, 0, 0, 1, Ta)) : (V.copy(kb), b(v.centroidModel, v.normalModel, V), V.multiply(va).add(ja), !0 === A.wireframe ? c(V, A.wireframeLinewidth, A.wireframeLinecap, A.wireframeLinejoin) : d(V))) : A instanceof THREE.MeshBasicMaterial || A instanceof THREE.MeshLambertMaterial || A instanceof THREE.MeshPhongMaterial ? null !== A.map ? A.map.mapping instanceof THREE.UVMapping &&
                                (za = v.uvs[0], e(Da, Fa, ba, Ea, $, fa, za[0].x, za[0].y, za[1].x, za[1].y, za[2].x, za[2].y, A.map)) : null !== A.envMap ? A.envMap.mapping instanceof THREE.SphericalReflectionMapping && (wa.copy(v.vertexNormalsModelView[0]), hb = 0.5 * wa.x + 0.5, ib = 0.5 * wa.y + 0.5, wa.copy(v.vertexNormalsModelView[1]), tb = 0.5 * wa.x + 0.5, ub = 0.5 * wa.y + 0.5, wa.copy(v.vertexNormalsModelView[2]), vb = 0.5 * wa.x + 0.5, jb = 0.5 * wa.y + 0.5, e(Da, Fa, ba, Ea, $, fa, hb, ib, tb, ub, vb, jb, A.envMap)) : (V.copy(A.color), A.vertexColors === THREE.FaceColors && V.multiply(v.color), !0 === A.wireframe ?
                                    c(V, A.wireframeLinewidth, A.wireframeLinecap, A.wireframeLinejoin) : d(V)) : A instanceof THREE.MeshDepthMaterial ? (Ha = M.near, Xa = M.far, P.r = P.g = P.b = 1 - r(y.positionScreen.z * y.positionScreen.w, Ha, Xa), Y.r = Y.g = Y.b = 1 - r(F.positionScreen.z * F.positionScreen.w, Ha, Xa), T.r = T.g = T.b = 1 - r(J.positionScreen.z * J.positionScreen.w, Ha, Xa), ma.addColors(Y, T).multiplyScalar(0.5), Ta = h(P, Y, T, ma), f(Da, Fa, ba, Ea, $, fa, 0, 0, 1, 0, 0, 1, Ta)) : A instanceof THREE.MeshNormalMaterial && (y = void 0, A.shading == THREE.FlatShading ? (y = v.normalModelView, V.setRGB(y.x,
                                    y.y, y.z).multiplyScalar(0.5).addScalar(0.5), !0 === A.wireframe ? c(V, A.wireframeLinewidth, A.wireframeLinecap, A.wireframeLinejoin) : d(V)) : A.shading == THREE.SmoothShading && (y = v.vertexNormalsModelView[0], P.setRGB(y.x, y.y, y.z).multiplyScalar(0.5).addScalar(0.5), y = v.vertexNormalsModelView[1], Y.setRGB(y.x, y.y, y.z).multiplyScalar(0.5).addScalar(0.5), y = v.vertexNormalsModelView[2], T.setRGB(y.x, y.y, y.z).multiplyScalar(0.5).addScalar(0.5), ma.addColors(Y, T).multiplyScalar(0.5), Ta = h(P, Y, T, ma), f(Da, Fa, ba, Ea, $, fa, 0, 0,
                                    1, 0, 0, 1, Ta)))
                        }
                    }
                    na.union(ta)
                }
            }
            B.setTransform(1, 0, 0, 1, 0, 0)
        }
    }
};
THREE.ShaderChunk = {
    fog_pars_fragment: "#ifdef USE_FOG\nuniform vec3 fogColor;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;\nuniform float fogFar;\n#endif\n#endif",
    fog_fragment: "#ifdef USE_FOG\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\n#ifdef FOG_EXP2\nconst float LOG2 = 1.442695;\nfloat fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );\nfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n#else\nfloat fogFactor = smoothstep( fogNear, fogFar, depth );\n#endif\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n#endif",
    envmap_pars_fragment: "#ifdef USE_ENVMAP\nuniform float reflectivity;\nuniform samplerCube envMap;\nuniform float flipEnvMap;\nuniform int combine;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nuniform bool useRefract;\nuniform float refractionRatio;\n#else\nvarying vec3 vReflect;\n#endif\n#endif",
    envmap_fragment: "#ifdef USE_ENVMAP\nvec3 reflectVec;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );\nif ( useRefract ) {\nreflectVec = refract( cameraToVertex, normal, refractionRatio );\n} else { \nreflectVec = reflect( cameraToVertex, normal );\n}\n#else\nreflectVec = vReflect;\n#endif\n#ifdef DOUBLE_SIDED\nfloat flipNormal = ( -1.0 + 2.0 * float( gl_FrontFacing ) );\nvec4 cubeColor = textureCube( envMap, flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#else\nvec4 cubeColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#endif\n#ifdef GAMMA_INPUT\ncubeColor.xyz *= cubeColor.xyz;\n#endif\nif ( combine == 1 ) {\ngl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, specularStrength * reflectivity );\n} else if ( combine == 2 ) {\ngl_FragColor.xyz += cubeColor.xyz * specularStrength * reflectivity;\n} else {\ngl_FragColor.xyz = mix( gl_FragColor.xyz, gl_FragColor.xyz * cubeColor.xyz, specularStrength * reflectivity );\n}\n#endif",
    envmap_pars_vertex: "#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvarying vec3 vReflect;\nuniform float refractionRatio;\nuniform bool useRefract;\n#endif",
    worldpos_vertex: "#if defined( USE_ENVMAP ) || defined( PHONG ) || defined( LAMBERT ) || defined ( USE_SHADOWMAP )\n#ifdef USE_SKINNING\nvec4 worldPosition = modelMatrix * skinned;\n#endif\n#if defined( USE_MORPHTARGETS ) && ! defined( USE_SKINNING )\nvec4 worldPosition = modelMatrix * vec4( morphed, 1.0 );\n#endif\n#if ! defined( USE_MORPHTARGETS ) && ! defined( USE_SKINNING )\nvec4 worldPosition = modelMatrix * vec4( position, 1.0 );\n#endif\n#endif",
    envmap_vertex: "#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvec3 worldNormal = mat3( modelMatrix[ 0 ].xyz, modelMatrix[ 1 ].xyz, modelMatrix[ 2 ].xyz ) * objectNormal;\nworldNormal = normalize( worldNormal );\nvec3 cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\nif ( useRefract ) {\nvReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n} else {\nvReflect = reflect( cameraToVertex, worldNormal );\n}\n#endif",
    map_particle_pars_fragment: "#ifdef USE_MAP\nuniform sampler2D map;\n#endif",
    map_particle_fragment: "#ifdef USE_MAP\ngl_FragColor = gl_FragColor * texture2D( map, vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y ) );\n#endif",
    map_pars_vertex: "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;\nuniform vec4 offsetRepeat;\n#endif",
    map_pars_fragment: "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;\n#endif\n#ifdef USE_MAP\nuniform sampler2D map;\n#endif",
    map_vertex: "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvUv = uv * offsetRepeat.zw + offsetRepeat.xy;\n#endif",
    map_fragment: "#ifdef USE_MAP\nvec4 texelColor = texture2D( map, vUv );\n#ifdef GAMMA_INPUT\ntexelColor.xyz *= texelColor.xyz;\n#endif\ngl_FragColor = gl_FragColor * texelColor;\n#endif",
    lightmap_pars_fragment: "#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\nuniform sampler2D lightMap;\n#endif",
    lightmap_pars_vertex: "#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\n#endif",
    lightmap_fragment: "#ifdef USE_LIGHTMAP\ngl_FragColor = gl_FragColor * texture2D( lightMap, vUv2 );\n#endif",
    lightmap_vertex: "#ifdef USE_LIGHTMAP\nvUv2 = uv2;\n#endif",
    bumpmap_pars_fragment: "#ifdef USE_BUMPMAP\nuniform sampler2D bumpMap;\nuniform float bumpScale;\nvec2 dHdxy_fwd() {\nvec2 dSTdx = dFdx( vUv );\nvec2 dSTdy = dFdy( vUv );\nfloat Hll = bumpScale * texture2D( bumpMap, vUv ).x;\nfloat dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;\nfloat dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;\nreturn vec2( dBx, dBy );\n}\nvec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {\nvec3 vSigmaX = dFdx( surf_pos );\nvec3 vSigmaY = dFdy( surf_pos );\nvec3 vN = surf_norm;\nvec3 R1 = cross( vSigmaY, vN );\nvec3 R2 = cross( vN, vSigmaX );\nfloat fDet = dot( vSigmaX, R1 );\nvec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\nreturn normalize( abs( fDet ) * surf_norm - vGrad );\n}\n#endif",
    normalmap_pars_fragment: "#ifdef USE_NORMALMAP\nuniform sampler2D normalMap;\nuniform vec2 normalScale;\nvec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {\nvec3 q0 = dFdx( eye_pos.xyz );\nvec3 q1 = dFdy( eye_pos.xyz );\nvec2 st0 = dFdx( vUv.st );\nvec2 st1 = dFdy( vUv.st );\nvec3 S = normalize(  q0 * st1.t - q1 * st0.t );\nvec3 T = normalize( -q0 * st1.s + q1 * st0.s );\nvec3 N = normalize( surf_norm );\nvec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\nmapN.xy = normalScale * mapN.xy;\nmat3 tsn = mat3( S, T, N );\nreturn normalize( tsn * mapN );\n}\n#endif",
    specularmap_pars_fragment: "#ifdef USE_SPECULARMAP\nuniform sampler2D specularMap;\n#endif",
    specularmap_fragment: "float specularStrength;\n#ifdef USE_SPECULARMAP\nvec4 texelSpecular = texture2D( specularMap, vUv );\nspecularStrength = texelSpecular.r;\n#else\nspecularStrength = 1.0;\n#endif",
    lights_lambert_pars_vertex: "uniform vec3 ambient;\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif",
    lights_lambert_vertex: "vLightFront = vec3( 0.0 );\n#ifdef DOUBLE_SIDED\nvLightBack = vec3( 0.0 );\n#endif\ntransformedNormal = normalize( transformedNormal );\n#if MAX_DIR_LIGHTS > 0\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( transformedNormal, dirVector );\nvec3 directionalLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 directionalLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 directionalLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 directionalLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\ndirectionalLightWeighting = mix( directionalLightWeighting, directionalLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\ndirectionalLightWeightingBack = mix( directionalLightWeightingBack, directionalLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += directionalLightColor[ i ] * directionalLightWeighting;\n#ifdef DOUBLE_SIDED\nvLightBack += directionalLightColor[ i ] * directionalLightWeightingBack;\n#endif\n}\n#endif\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nfloat dotProduct = dot( transformedNormal, lVector );\nvec3 pointLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 pointLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 pointLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 pointLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\npointLightWeighting = mix( pointLightWeighting, pointLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\npointLightWeightingBack = mix( pointLightWeightingBack, pointLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += pointLightColor[ i ] * pointLightWeighting * lDistance;\n#ifdef DOUBLE_SIDED\nvLightBack += pointLightColor[ i ] * pointLightWeightingBack * lDistance;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - worldPosition.xyz ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nfloat dotProduct = dot( transformedNormal, lVector );\nvec3 spotLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 spotLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 spotLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 spotLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\nspotLightWeighting = mix( spotLightWeighting, spotLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\nspotLightWeightingBack = mix( spotLightWeightingBack, spotLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += spotLightColor[ i ] * spotLightWeighting * lDistance * spotEffect;\n#ifdef DOUBLE_SIDED\nvLightBack += spotLightColor[ i ] * spotLightWeightingBack * lDistance * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( transformedNormal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nfloat hemiDiffuseWeightBack = -0.5 * dotProduct + 0.5;\nvLightFront += mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\n#ifdef DOUBLE_SIDED\nvLightBack += mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeightBack );\n#endif\n}\n#endif\nvLightFront = vLightFront * diffuse + ambient * ambientLightColor + emissive;\n#ifdef DOUBLE_SIDED\nvLightBack = vLightBack * diffuse + ambient * ambientLightColor + emissive;\n#endif",
    lights_phong_pars_vertex: "#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\nvarying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif",
    lights_phong_vertex: "#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nvPointLight[ i ] = vec4( lVector, lDistance );\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nvSpotLight[ i ] = vec4( lVector, lDistance );\n}\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvWorldPosition = worldPosition.xyz;\n#endif",
    lights_phong_pars_fragment: "uniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#else\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\n#else\nvarying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;",
    lights_phong_fragment: "vec3 normal = normalize( vNormal );\nvec3 viewPosition = normalize( vViewPosition );\n#ifdef DOUBLE_SIDED\nnormal = normal * ( -1.0 + 2.0 * float( gl_FrontFacing ) );\n#endif\n#ifdef USE_NORMALMAP\nnormal = perturbNormal2Arb( -vViewPosition, normal );\n#elif defined( USE_BUMPMAP )\nnormal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );\n#endif\n#if MAX_POINT_LIGHTS > 0\nvec3 pointDiffuse  = vec3( 0.0 );\nvec3 pointSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz + vViewPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vPointLight[ i ].xyz );\nfloat lDistance = vPointLight[ i ].w;\n#endif\nfloat dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat pointDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n#else\nfloat pointDiffuseWeight = max( dotProduct, 0.0 );\n#endif\npointDiffuse  += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;\nvec3 pointHalfVector = normalize( lVector + viewPosition );\nfloat pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );\nfloat pointSpecularWeight = specularStrength * max( pow( pointDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, pointHalfVector ), 5.0 );\npointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance * specularNormalization;\n#else\npointSpecular += specular * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nvec3 spotDiffuse  = vec3( 0.0 );\nvec3 spotSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz + vViewPosition.xyz;\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vSpotLight[ i ].xyz );\nfloat lDistance = vSpotLight[ i ].w;\n#endif\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\nfloat dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat spotDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat spotDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 spotDiffuseWeight = mix( vec3 ( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );\n#else\nfloat spotDiffuseWeight = max( dotProduct, 0.0 );\n#endif\nspotDiffuse += diffuse * spotLightColor[ i ] * spotDiffuseWeight * lDistance * spotEffect;\nvec3 spotHalfVector = normalize( lVector + viewPosition );\nfloat spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );\nfloat spotSpecularWeight = specularStrength * max( pow( spotDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, spotHalfVector ), 5.0 );\nspotSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * specularNormalization * spotEffect;\n#else\nspotSpecular += specular * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec3 dirDiffuse  = vec3( 0.0 );\nvec3 dirSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, dirVector );\n#ifdef WRAP_AROUND\nfloat dirDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );\n#else\nfloat dirDiffuseWeight = max( dotProduct, 0.0 );\n#endif\ndirDiffuse  += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;\nvec3 dirHalfVector = normalize( dirVector + viewPosition );\nfloat dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );\nfloat dirSpecularWeight = specularStrength * max( pow( dirDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( dirVector, dirHalfVector ), 5.0 );\ndirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n#else\ndirSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nvec3 hemiDiffuse  = vec3( 0.0 );\nvec3 hemiSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nvec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\nhemiDiffuse += diffuse * hemiColor;\nvec3 hemiHalfVectorSky = normalize( lVector + viewPosition );\nfloat hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;\nfloat hemiSpecularWeightSky = specularStrength * max( pow( hemiDotNormalHalfSky, shininess ), 0.0 );\nvec3 lVectorGround = -lVector;\nvec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );\nfloat hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;\nfloat hemiSpecularWeightGround = specularStrength * max( pow( hemiDotNormalHalfGround, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat dotProductGround = dot( normal, lVectorGround );\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlickSky = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, hemiHalfVectorSky ), 5.0 );\nvec3 schlickGround = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 5.0 );\nhemiSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );\n#else\nhemiSpecular += specular * hemiColor * ( hemiSpecularWeightSky + hemiSpecularWeightGround ) * hemiDiffuseWeight;\n#endif\n}\n#endif\nvec3 totalDiffuse = vec3( 0.0 );\nvec3 totalSpecular = vec3( 0.0 );\n#if MAX_DIR_LIGHTS > 0\ntotalDiffuse += dirDiffuse;\ntotalSpecular += dirSpecular;\n#endif\n#if MAX_HEMI_LIGHTS > 0\ntotalDiffuse += hemiDiffuse;\ntotalSpecular += hemiSpecular;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalDiffuse += pointDiffuse;\ntotalSpecular += pointSpecular;\n#endif\n#if MAX_SPOT_LIGHTS > 0\ntotalDiffuse += spotDiffuse;\ntotalSpecular += spotSpecular;\n#endif\n#ifdef METAL\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient + totalSpecular );\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient ) + totalSpecular;\n#endif",
    color_pars_fragment: "#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",
    color_fragment: "#ifdef USE_COLOR\ngl_FragColor = gl_FragColor * vec4( vColor, opacity );\n#endif",
    color_pars_vertex: "#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",
    color_vertex: "#ifdef USE_COLOR\n#ifdef GAMMA_INPUT\nvColor = color * color;\n#else\nvColor = color;\n#endif\n#endif",
    skinning_pars_vertex: "#ifdef USE_SKINNING\n#ifdef BONE_TEXTURE\nuniform sampler2D boneTexture;\nmat4 getBoneMatrix( const in float i ) {\nfloat j = i * 4.0;\nfloat x = mod( j, N_BONE_PIXEL_X );\nfloat y = floor( j / N_BONE_PIXEL_X );\nconst float dx = 1.0 / N_BONE_PIXEL_X;\nconst float dy = 1.0 / N_BONE_PIXEL_Y;\ny = dy * ( y + 0.5 );\nvec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );\nvec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );\nvec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );\nvec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );\nmat4 bone = mat4( v1, v2, v3, v4 );\nreturn bone;\n}\n#else\nuniform mat4 boneGlobalMatrices[ MAX_BONES ];\nmat4 getBoneMatrix( const in float i ) {\nmat4 bone = boneGlobalMatrices[ int(i) ];\nreturn bone;\n}\n#endif\n#endif",
    skinbase_vertex: "#ifdef USE_SKINNING\nmat4 boneMatX = getBoneMatrix( skinIndex.x );\nmat4 boneMatY = getBoneMatrix( skinIndex.y );\n#endif",
    skinning_vertex: "#ifdef USE_SKINNING\n#ifdef USE_MORPHTARGETS\nvec4 skinVertex = vec4( morphed, 1.0 );\n#else\nvec4 skinVertex = vec4( position, 1.0 );\n#endif\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\n#endif",
    morphtarget_pars_vertex: "#ifdef USE_MORPHTARGETS\n#ifndef USE_MORPHNORMALS\nuniform float morphTargetInfluences[ 8 ];\n#else\nuniform float morphTargetInfluences[ 4 ];\n#endif\n#endif",
    morphtarget_vertex: "#ifdef USE_MORPHTARGETS\nvec3 morphed = vec3( 0.0 );\nmorphed += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];\nmorphed += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];\nmorphed += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];\nmorphed += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];\n#ifndef USE_MORPHNORMALS\nmorphed += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];\nmorphed += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];\nmorphed += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];\nmorphed += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];\n#endif\nmorphed += position;\n#endif",
    default_vertex: "vec4 mvPosition;\n#ifdef USE_SKINNING\nmvPosition = modelViewMatrix * skinned;\n#endif\n#if !defined( USE_SKINNING ) && defined( USE_MORPHTARGETS )\nmvPosition = modelViewMatrix * vec4( morphed, 1.0 );\n#endif\n#if !defined( USE_SKINNING ) && ! defined( USE_MORPHTARGETS )\nmvPosition = modelViewMatrix * vec4( position, 1.0 );\n#endif\ngl_Position = projectionMatrix * mvPosition;",
    morphnormal_vertex: "#ifdef USE_MORPHNORMALS\nvec3 morphedNormal = vec3( 0.0 );\nmorphedNormal +=  ( morphNormal0 - normal ) * morphTargetInfluences[ 0 ];\nmorphedNormal +=  ( morphNormal1 - normal ) * morphTargetInfluences[ 1 ];\nmorphedNormal +=  ( morphNormal2 - normal ) * morphTargetInfluences[ 2 ];\nmorphedNormal +=  ( morphNormal3 - normal ) * morphTargetInfluences[ 3 ];\nmorphedNormal += normal;\n#endif",
    skinnormal_vertex: "#ifdef USE_SKINNING\nmat4 skinMatrix = skinWeight.x * boneMatX;\nskinMatrix \t+= skinWeight.y * boneMatY;\n#ifdef USE_MORPHNORMALS\nvec4 skinnedNormal = skinMatrix * vec4( morphedNormal, 0.0 );\n#else\nvec4 skinnedNormal = skinMatrix * vec4( normal, 0.0 );\n#endif\n#endif",
    defaultnormal_vertex: "vec3 objectNormal;\n#ifdef USE_SKINNING\nobjectNormal = skinnedNormal.xyz;\n#endif\n#if !defined( USE_SKINNING ) && defined( USE_MORPHNORMALS )\nobjectNormal = morphedNormal;\n#endif\n#if !defined( USE_SKINNING ) && ! defined( USE_MORPHNORMALS )\nobjectNormal = normal;\n#endif\n#ifdef FLIP_SIDED\nobjectNormal = -objectNormal;\n#endif\nvec3 transformedNormal = normalMatrix * objectNormal;",
    shadowmap_pars_fragment: "#ifdef USE_SHADOWMAP\nuniform sampler2D shadowMap[ MAX_SHADOWS ];\nuniform vec2 shadowMapSize[ MAX_SHADOWS ];\nuniform float shadowDarkness[ MAX_SHADOWS ];\nuniform float shadowBias[ MAX_SHADOWS ];\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nfloat unpackDepth( const in vec4 rgba_depth ) {\nconst vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );\nfloat depth = dot( rgba_depth, bit_shift );\nreturn depth;\n}\n#endif",
    shadowmap_fragment: "#ifdef USE_SHADOWMAP\n#ifdef SHADOWMAP_DEBUG\nvec3 frustumColors[3];\nfrustumColors[0] = vec3( 1.0, 0.5, 0.0 );\nfrustumColors[1] = vec3( 0.0, 1.0, 0.8 );\nfrustumColors[2] = vec3( 0.0, 0.5, 1.0 );\n#endif\n#ifdef SHADOWMAP_CASCADE\nint inFrustumCount = 0;\n#endif\nfloat fDepth;\nvec3 shadowColor = vec3( 1.0 );\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;\nbvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );\nbool inFrustum = all( inFrustumVec );\n#ifdef SHADOWMAP_CASCADE\ninFrustumCount += int( inFrustum );\nbvec3 frustumTestVec = bvec3( inFrustum, inFrustumCount == 1, shadowCoord.z <= 1.0 );\n#else\nbvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\n#endif\nbool frustumTest = all( frustumTestVec );\nif ( frustumTest ) {\nshadowCoord.z += shadowBias[ i ];\n#if defined( SHADOWMAP_TYPE_PCF )\nfloat shadow = 0.0;\nconst float shadowDelta = 1.0 / 9.0;\nfloat xPixelOffset = 1.0 / shadowMapSize[ i ].x;\nfloat yPixelOffset = 1.0 / shadowMapSize[ i ].y;\nfloat dx0 = -1.25 * xPixelOffset;\nfloat dy0 = -1.25 * yPixelOffset;\nfloat dx1 = 1.25 * xPixelOffset;\nfloat dy1 = 1.25 * yPixelOffset;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nshadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );\n#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\nfloat shadow = 0.0;\nfloat xPixelOffset = 1.0 / shadowMapSize[ i ].x;\nfloat yPixelOffset = 1.0 / shadowMapSize[ i ].y;\nfloat dx0 = -1.0 * xPixelOffset;\nfloat dy0 = -1.0 * yPixelOffset;\nfloat dx1 = 1.0 * xPixelOffset;\nfloat dy1 = 1.0 * yPixelOffset;\nmat3 shadowKernel;\nmat3 depthKernel;\ndepthKernel[0][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );\ndepthKernel[0][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );\ndepthKernel[0][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );\ndepthKernel[1][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );\ndepthKernel[1][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );\ndepthKernel[1][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );\ndepthKernel[2][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );\ndepthKernel[2][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );\ndepthKernel[2][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );\nvec3 shadowZ = vec3( shadowCoord.z );\nshadowKernel[0] = vec3(lessThan(depthKernel[0], shadowZ ));\nshadowKernel[0] *= vec3(0.25);\nshadowKernel[1] = vec3(lessThan(depthKernel[1], shadowZ ));\nshadowKernel[1] *= vec3(0.25);\nshadowKernel[2] = vec3(lessThan(depthKernel[2], shadowZ ));\nshadowKernel[2] *= vec3(0.25);\nvec2 fractionalCoord = 1.0 - fract( shadowCoord.xy * shadowMapSize[i].xy );\nshadowKernel[0] = mix( shadowKernel[1], shadowKernel[0], fractionalCoord.x );\nshadowKernel[1] = mix( shadowKernel[2], shadowKernel[1], fractionalCoord.x );\nvec4 shadowValues;\nshadowValues.x = mix( shadowKernel[0][1], shadowKernel[0][0], fractionalCoord.y );\nshadowValues.y = mix( shadowKernel[0][2], shadowKernel[0][1], fractionalCoord.y );\nshadowValues.z = mix( shadowKernel[1][1], shadowKernel[1][0], fractionalCoord.y );\nshadowValues.w = mix( shadowKernel[1][2], shadowKernel[1][1], fractionalCoord.y );\nshadow = dot( shadowValues, vec4( 1.0 ) );\nshadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );\n#else\nvec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );\nfloat fDepth = unpackDepth( rgbaDepth );\nif ( fDepth < shadowCoord.z )\nshadowColor = shadowColor * vec3( 1.0 - shadowDarkness[ i ] );\n#endif\n}\n#ifdef SHADOWMAP_DEBUG\n#ifdef SHADOWMAP_CASCADE\nif ( inFrustum && inFrustumCount == 1 ) gl_FragColor.xyz *= frustumColors[ i ];\n#else\nif ( inFrustum ) gl_FragColor.xyz *= frustumColors[ i ];\n#endif\n#endif\n}\n#ifdef GAMMA_OUTPUT\nshadowColor *= shadowColor;\n#endif\ngl_FragColor.xyz = gl_FragColor.xyz * shadowColor;\n#endif",
    shadowmap_pars_vertex: "#ifdef USE_SHADOWMAP\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nuniform mat4 shadowMatrix[ MAX_SHADOWS ];\n#endif",
    shadowmap_vertex: "#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;\n}\n#endif",
    alphatest_fragment: "#ifdef ALPHATEST\nif ( gl_FragColor.a < ALPHATEST ) discard;\n#endif",
    linear_to_gamma_fragment: "#ifdef GAMMA_OUTPUT\ngl_FragColor.xyz = sqrt( gl_FragColor.xyz );\n#endif"
};
THREE.UniformsUtils = {
    merge: function(a) {
        var b, c, d, e = {};
        for (b = 0; b < a.length; b++)
            for (c in d = this.clone(a[b]), d) e[c] = d[c];
        return e
    },
    clone: function(a) {
        var b, c, d, e = {};
        for (b in a)
            for (c in e[b] = {}, a[b]) d = a[b][c], e[b][c] = d instanceof THREE.Color || d instanceof THREE.Vector2 || d instanceof THREE.Vector3 || d instanceof THREE.Vector4 || d instanceof THREE.Matrix4 || d instanceof THREE.Texture ? d.clone() : d instanceof Array ? d.slice() : d;
        return e
    }
};
THREE.UniformsLib = {
    common: {
        diffuse: {
            type: "c",
            value: new THREE.Color(15658734)
        },
        opacity: {
            type: "f",
            value: 1
        },
        map: {
            type: "t",
            value: null
        },
        offsetRepeat: {
            type: "v4",
            value: new THREE.Vector4(0, 0, 1, 1)
        },
        lightMap: {
            type: "t",
            value: null
        },
        specularMap: {
            type: "t",
            value: null
        },
        envMap: {
            type: "t",
            value: null
        },
        flipEnvMap: {
            type: "f",
            value: -1
        },
        useRefract: {
            type: "i",
            value: 0
        },
        reflectivity: {
            type: "f",
            value: 1
        },
        refractionRatio: {
            type: "f",
            value: 0.98
        },
        combine: {
            type: "i",
            value: 0
        },
        morphTargetInfluences: {
            type: "f",
            value: 0
        }
    },
    bump: {
        bumpMap: {
            type: "t",
            value: null
        },
        bumpScale: {
            type: "f",
            value: 1
        }
    },
    normalmap: {
        normalMap: {
            type: "t",
            value: null
        },
        normalScale: {
            type: "v2",
            value: new THREE.Vector2(1, 1)
        }
    },
    fog: {
        fogDensity: {
            type: "f",
            value: 2.5E-4
        },
        fogNear: {
            type: "f",
            value: 1
        },
        fogFar: {
            type: "f",
            value: 2E3
        },
        fogColor: {
            type: "c",
            value: new THREE.Color(16777215)
        }
    },
    lights: {
        ambientLightColor: {
            type: "fv",
            value: []
        },
        directionalLightDirection: {
            type: "fv",
            value: []
        },
        directionalLightColor: {
            type: "fv",
            value: []
        },
        hemisphereLightDirection: {
            type: "fv",
            value: []
        },
        hemisphereLightSkyColor: {
            type: "fv",
            value: []
        },
        hemisphereLightGroundColor: {
            type: "fv",
            value: []
        },
        pointLightColor: {
            type: "fv",
            value: []
        },
        pointLightPosition: {
            type: "fv",
            value: []
        },
        pointLightDistance: {
            type: "fv1",
            value: []
        },
        spotLightColor: {
            type: "fv",
            value: []
        },
        spotLightPosition: {
            type: "fv",
            value: []
        },
        spotLightDirection: {
            type: "fv",
            value: []
        },
        spotLightDistance: {
            type: "fv1",
            value: []
        },
        spotLightAngleCos: {
            type: "fv1",
            value: []
        },
        spotLightExponent: {
            type: "fv1",
            value: []
        }
    },
    particle: {
        psColor: {
            type: "c",
            value: new THREE.Color(15658734)
        },
        opacity: {
            type: "f",
            value: 1
        },
        size: {
            type: "f",
            value: 1
        },
        scale: {
            type: "f",
            value: 1
        },
        map: {
            type: "t",
            value: null
        },
        fogDensity: {
            type: "f",
            value: 2.5E-4
        },
        fogNear: {
            type: "f",
            value: 1
        },
        fogFar: {
            type: "f",
            value: 2E3
        },
        fogColor: {
            type: "c",
            value: new THREE.Color(16777215)
        }
    },
    shadowmap: {
        shadowMap: {
            type: "tv",
            value: []
        },
        shadowMapSize: {
            type: "v2v",
            value: []
        },
        shadowBias: {
            type: "fv1",
            value: []
        },
        shadowDarkness: {
            type: "fv1",
            value: []
        },
        shadowMatrix: {
            type: "m4v",
            value: []
        }
    }
};
THREE.ShaderLib = {
    basic: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.fog, THREE.UniformsLib.shadowmap]),
        vertexShader: [THREE.ShaderChunk.map_pars_vertex, THREE.ShaderChunk.lightmap_pars_vertex, THREE.ShaderChunk.envmap_pars_vertex, THREE.ShaderChunk.color_pars_vertex, THREE.ShaderChunk.morphtarget_pars_vertex, THREE.ShaderChunk.skinning_pars_vertex, THREE.ShaderChunk.shadowmap_pars_vertex, "void main() {", THREE.ShaderChunk.map_vertex, THREE.ShaderChunk.lightmap_vertex, THREE.ShaderChunk.color_vertex,
            THREE.ShaderChunk.skinbase_vertex, "#ifdef USE_ENVMAP", THREE.ShaderChunk.morphnormal_vertex, THREE.ShaderChunk.skinnormal_vertex, THREE.ShaderChunk.defaultnormal_vertex, "#endif", THREE.ShaderChunk.morphtarget_vertex, THREE.ShaderChunk.skinning_vertex, THREE.ShaderChunk.default_vertex, THREE.ShaderChunk.worldpos_vertex, THREE.ShaderChunk.envmap_vertex, THREE.ShaderChunk.shadowmap_vertex, "}"
        ].join("\n"),
        fragmentShader: ["uniform vec3 diffuse;\nuniform float opacity;", THREE.ShaderChunk.color_pars_fragment, THREE.ShaderChunk.map_pars_fragment,
            THREE.ShaderChunk.lightmap_pars_fragment, THREE.ShaderChunk.envmap_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, THREE.ShaderChunk.shadowmap_pars_fragment, THREE.ShaderChunk.specularmap_pars_fragment, "void main() {\ngl_FragColor = vec4( diffuse, opacity );", THREE.ShaderChunk.map_fragment, THREE.ShaderChunk.alphatest_fragment, THREE.ShaderChunk.specularmap_fragment, THREE.ShaderChunk.lightmap_fragment, THREE.ShaderChunk.color_fragment, THREE.ShaderChunk.envmap_fragment, THREE.ShaderChunk.shadowmap_fragment,
            THREE.ShaderChunk.linear_to_gamma_fragment, THREE.ShaderChunk.fog_fragment, "}"
        ].join("\n")
    },
    lambert: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.fog, THREE.UniformsLib.lights, THREE.UniformsLib.shadowmap, {
            ambient: {
                type: "c",
                value: new THREE.Color(16777215)
            },
            emissive: {
                type: "c",
                value: new THREE.Color(0)
            },
            wrapRGB: {
                type: "v3",
                value: new THREE.Vector3(1, 1, 1)
            }
        }]),
        vertexShader: ["#define LAMBERT\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\nvarying vec3 vLightBack;\n#endif",
            THREE.ShaderChunk.map_pars_vertex, THREE.ShaderChunk.lightmap_pars_vertex, THREE.ShaderChunk.envmap_pars_vertex, THREE.ShaderChunk.lights_lambert_pars_vertex, THREE.ShaderChunk.color_pars_vertex, THREE.ShaderChunk.morphtarget_pars_vertex, THREE.ShaderChunk.skinning_pars_vertex, THREE.ShaderChunk.shadowmap_pars_vertex, "void main() {", THREE.ShaderChunk.map_vertex, THREE.ShaderChunk.lightmap_vertex, THREE.ShaderChunk.color_vertex, THREE.ShaderChunk.morphnormal_vertex, THREE.ShaderChunk.skinbase_vertex, THREE.ShaderChunk.skinnormal_vertex,
            THREE.ShaderChunk.defaultnormal_vertex, THREE.ShaderChunk.morphtarget_vertex, THREE.ShaderChunk.skinning_vertex, THREE.ShaderChunk.default_vertex, THREE.ShaderChunk.worldpos_vertex, THREE.ShaderChunk.envmap_vertex, THREE.ShaderChunk.lights_lambert_vertex, THREE.ShaderChunk.shadowmap_vertex, "}"
        ].join("\n"),
        fragmentShader: ["uniform float opacity;\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\nvarying vec3 vLightBack;\n#endif", THREE.ShaderChunk.color_pars_fragment, THREE.ShaderChunk.map_pars_fragment, THREE.ShaderChunk.lightmap_pars_fragment,
            THREE.ShaderChunk.envmap_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, THREE.ShaderChunk.shadowmap_pars_fragment, THREE.ShaderChunk.specularmap_pars_fragment, "void main() {\ngl_FragColor = vec4( vec3 ( 1.0 ), opacity );", THREE.ShaderChunk.map_fragment, THREE.ShaderChunk.alphatest_fragment, THREE.ShaderChunk.specularmap_fragment, "#ifdef DOUBLE_SIDED\nif ( gl_FrontFacing )\ngl_FragColor.xyz *= vLightFront;\nelse\ngl_FragColor.xyz *= vLightBack;\n#else\ngl_FragColor.xyz *= vLightFront;\n#endif", THREE.ShaderChunk.lightmap_fragment,
            THREE.ShaderChunk.color_fragment, THREE.ShaderChunk.envmap_fragment, THREE.ShaderChunk.shadowmap_fragment, THREE.ShaderChunk.linear_to_gamma_fragment, THREE.ShaderChunk.fog_fragment, "}"
        ].join("\n")
    },
    phong: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.bump, THREE.UniformsLib.normalmap, THREE.UniformsLib.fog, THREE.UniformsLib.lights, THREE.UniformsLib.shadowmap, {
            ambient: {
                type: "c",
                value: new THREE.Color(16777215)
            },
            emissive: {
                type: "c",
                value: new THREE.Color(0)
            },
            specular: {
                type: "c",
                value: new THREE.Color(1118481)
            },
            shininess: {
                type: "f",
                value: 30
            },
            wrapRGB: {
                type: "v3",
                value: new THREE.Vector3(1, 1, 1)
            }
        }]),
        vertexShader: ["#define PHONG\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;", THREE.ShaderChunk.map_pars_vertex, THREE.ShaderChunk.lightmap_pars_vertex, THREE.ShaderChunk.envmap_pars_vertex, THREE.ShaderChunk.lights_phong_pars_vertex, THREE.ShaderChunk.color_pars_vertex, THREE.ShaderChunk.morphtarget_pars_vertex, THREE.ShaderChunk.skinning_pars_vertex, THREE.ShaderChunk.shadowmap_pars_vertex,
            "void main() {", THREE.ShaderChunk.map_vertex, THREE.ShaderChunk.lightmap_vertex, THREE.ShaderChunk.color_vertex, THREE.ShaderChunk.morphnormal_vertex, THREE.ShaderChunk.skinbase_vertex, THREE.ShaderChunk.skinnormal_vertex, THREE.ShaderChunk.defaultnormal_vertex, "vNormal = normalize( transformedNormal );", THREE.ShaderChunk.morphtarget_vertex, THREE.ShaderChunk.skinning_vertex, THREE.ShaderChunk.default_vertex, "vViewPosition = -mvPosition.xyz;", THREE.ShaderChunk.worldpos_vertex, THREE.ShaderChunk.envmap_vertex,
            THREE.ShaderChunk.lights_phong_vertex, THREE.ShaderChunk.shadowmap_vertex, "}"
        ].join("\n"),
        fragmentShader: ["uniform vec3 diffuse;\nuniform float opacity;\nuniform vec3 ambient;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;", THREE.ShaderChunk.color_pars_fragment, THREE.ShaderChunk.map_pars_fragment, THREE.ShaderChunk.lightmap_pars_fragment, THREE.ShaderChunk.envmap_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, THREE.ShaderChunk.lights_phong_pars_fragment, THREE.ShaderChunk.shadowmap_pars_fragment,
            THREE.ShaderChunk.bumpmap_pars_fragment, THREE.ShaderChunk.normalmap_pars_fragment, THREE.ShaderChunk.specularmap_pars_fragment, "void main() {\ngl_FragColor = vec4( vec3 ( 1.0 ), opacity );", THREE.ShaderChunk.map_fragment, THREE.ShaderChunk.alphatest_fragment, THREE.ShaderChunk.specularmap_fragment, THREE.ShaderChunk.lights_phong_fragment, THREE.ShaderChunk.lightmap_fragment, THREE.ShaderChunk.color_fragment, THREE.ShaderChunk.envmap_fragment, THREE.ShaderChunk.shadowmap_fragment, THREE.ShaderChunk.linear_to_gamma_fragment,
            THREE.ShaderChunk.fog_fragment, "}"
        ].join("\n")
    },
    particle_basic: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.particle, THREE.UniformsLib.shadowmap]),
        vertexShader: ["uniform float size;\nuniform float scale;", THREE.ShaderChunk.color_pars_vertex, THREE.ShaderChunk.shadowmap_pars_vertex, "void main() {", THREE.ShaderChunk.color_vertex, "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n#ifdef USE_SIZEATTENUATION\ngl_PointSize = size * ( scale / length( mvPosition.xyz ) );\n#else\ngl_PointSize = size;\n#endif\ngl_Position = projectionMatrix * mvPosition;",
            THREE.ShaderChunk.worldpos_vertex, THREE.ShaderChunk.shadowmap_vertex, "}"
        ].join("\n"),
        fragmentShader: ["uniform vec3 psColor;\nuniform float opacity;", THREE.ShaderChunk.color_pars_fragment, THREE.ShaderChunk.map_particle_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, THREE.ShaderChunk.shadowmap_pars_fragment, "void main() {\ngl_FragColor = vec4( psColor, opacity );", THREE.ShaderChunk.map_particle_fragment, THREE.ShaderChunk.alphatest_fragment, THREE.ShaderChunk.color_fragment, THREE.ShaderChunk.shadowmap_fragment,
            THREE.ShaderChunk.fog_fragment, "}"
        ].join("\n")
    },
    dashed: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.fog, {
            scale: {
                type: "f",
                value: 1
            },
            dashSize: {
                type: "f",
                value: 1
            },
            totalSize: {
                type: "f",
                value: 2
            }
        }]),
        vertexShader: ["uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;", THREE.ShaderChunk.color_pars_vertex, "void main() {", THREE.ShaderChunk.color_vertex, "vLineDistance = scale * lineDistance;\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\ngl_Position = projectionMatrix * mvPosition;\n}"].join("\n"),
        fragmentShader: ["uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;", THREE.ShaderChunk.color_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, "void main() {\nif ( mod( vLineDistance, totalSize ) > dashSize ) {\ndiscard;\n}\ngl_FragColor = vec4( diffuse, opacity );", THREE.ShaderChunk.color_fragment, THREE.ShaderChunk.fog_fragment, "}"].join("\n")
    },
    depth: {
        uniforms: {
            mNear: {
                type: "f",
                value: 1
            },
            mFar: {
                type: "f",
                value: 2E3
            },
            opacity: {
                type: "f",
                value: 1
            }
        },
        vertexShader: "void main() {\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
        fragmentShader: "uniform float mNear;\nuniform float mFar;\nuniform float opacity;\nvoid main() {\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\nfloat color = 1.0 - smoothstep( mNear, mFar, depth );\ngl_FragColor = vec4( vec3( color ), opacity );\n}"
    },
    normal: {
        uniforms: {
            opacity: {
                type: "f",
                value: 1
            }
        },
        vertexShader: ["varying vec3 vNormal;", THREE.ShaderChunk.morphtarget_pars_vertex, "void main() {\nvNormal = normalize( normalMatrix * normal );",
            THREE.ShaderChunk.morphtarget_vertex, THREE.ShaderChunk.default_vertex, "}"
        ].join("\n"),
        fragmentShader: "uniform float opacity;\nvarying vec3 vNormal;\nvoid main() {\ngl_FragColor = vec4( 0.5 * normalize( vNormal ) + 0.5, opacity );\n}"
    },
    normalmap: {
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights, THREE.UniformsLib.shadowmap, {
            enableAO: {
                type: "i",
                value: 0
            },
            enableDiffuse: {
                type: "i",
                value: 0
            },
            enableSpecular: {
                type: "i",
                value: 0
            },
            enableReflection: {
                type: "i",
                value: 0
            },
            enableDisplacement: {
                type: "i",
                value: 0
            },
            tDisplacement: {
                type: "t",
                value: null
            },
            tDiffuse: {
                type: "t",
                value: null
            },
            tCube: {
                type: "t",
                value: null
            },
            tNormal: {
                type: "t",
                value: null
            },
            tSpecular: {
                type: "t",
                value: null
            },
            tAO: {
                type: "t",
                value: null
            },
            uNormalScale: {
                type: "v2",
                value: new THREE.Vector2(1, 1)
            },
            uDisplacementBias: {
                type: "f",
                value: 0
            },
            uDisplacementScale: {
                type: "f",
                value: 1
            },
            uDiffuseColor: {
                type: "c",
                value: new THREE.Color(16777215)
            },
            uSpecularColor: {
                type: "c",
                value: new THREE.Color(1118481)
            },
            uAmbientColor: {
                type: "c",
                value: new THREE.Color(16777215)
            },
            uShininess: {
                type: "f",
                value: 30
            },
            uOpacity: {
                type: "f",
                value: 1
            },
            useRefract: {
                type: "i",
                value: 0
            },
            uRefractionRatio: {
                type: "f",
                value: 0.98
            },
            uReflectivity: {
                type: "f",
                value: 0.5
            },
            uOffset: {
                type: "v2",
                value: new THREE.Vector2(0, 0)
            },
            uRepeat: {
                type: "v2",
                value: new THREE.Vector2(1, 1)
            },
            wrapRGB: {
                type: "v3",
                value: new THREE.Vector3(1, 1, 1)
            }
        }]),
        fragmentShader: ["uniform vec3 uAmbientColor;\nuniform vec3 uDiffuseColor;\nuniform vec3 uSpecularColor;\nuniform float uShininess;\nuniform float uOpacity;\nuniform bool enableDiffuse;\nuniform bool enableSpecular;\nuniform bool enableAO;\nuniform bool enableReflection;\nuniform sampler2D tDiffuse;\nuniform sampler2D tNormal;\nuniform sampler2D tSpecular;\nuniform sampler2D tAO;\nuniform samplerCube tCube;\nuniform vec2 uNormalScale;\nuniform bool useRefract;\nuniform float uRefractionRatio;\nuniform float uReflectivity;\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif\nvarying vec3 vWorldPosition;\nvarying vec3 vViewPosition;",
            THREE.ShaderChunk.shadowmap_pars_fragment, THREE.ShaderChunk.fog_pars_fragment, "void main() {\ngl_FragColor = vec4( vec3( 1.0 ), uOpacity );\nvec3 specularTex = vec3( 1.0 );\nvec3 normalTex = texture2D( tNormal, vUv ).xyz * 2.0 - 1.0;\nnormalTex.xy *= uNormalScale;\nnormalTex = normalize( normalTex );\nif( enableDiffuse ) {\n#ifdef GAMMA_INPUT\nvec4 texelColor = texture2D( tDiffuse, vUv );\ntexelColor.xyz *= texelColor.xyz;\ngl_FragColor = gl_FragColor * texelColor;\n#else\ngl_FragColor = gl_FragColor * texture2D( tDiffuse, vUv );\n#endif\n}\nif( enableAO ) {\n#ifdef GAMMA_INPUT\nvec4 aoColor = texture2D( tAO, vUv );\naoColor.xyz *= aoColor.xyz;\ngl_FragColor.xyz = gl_FragColor.xyz * aoColor.xyz;\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * texture2D( tAO, vUv ).xyz;\n#endif\n}\nif( enableSpecular )\nspecularTex = texture2D( tSpecular, vUv ).xyz;\nmat3 tsb = mat3( normalize( vTangent ), normalize( vBinormal ), normalize( vNormal ) );\nvec3 finalNormal = tsb * normalTex;\n#ifdef FLIP_SIDED\nfinalNormal = -finalNormal;\n#endif\nvec3 normal = normalize( finalNormal );\nvec3 viewPosition = normalize( vViewPosition );\n#if MAX_POINT_LIGHTS > 0\nvec3 pointDiffuse = vec3( 0.0 );\nvec3 pointSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 pointVector = lPosition.xyz + vViewPosition.xyz;\nfloat pointDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\npointDistance = 1.0 - min( ( length( pointVector ) / pointLightDistance[ i ] ), 1.0 );\npointVector = normalize( pointVector );\n#ifdef WRAP_AROUND\nfloat pointDiffuseWeightFull = max( dot( normal, pointVector ), 0.0 );\nfloat pointDiffuseWeightHalf = max( 0.5 * dot( normal, pointVector ) + 0.5, 0.0 );\nvec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n#else\nfloat pointDiffuseWeight = max( dot( normal, pointVector ), 0.0 );\n#endif\npointDiffuse += pointDistance * pointLightColor[ i ] * uDiffuseColor * pointDiffuseWeight;\nvec3 pointHalfVector = normalize( pointVector + viewPosition );\nfloat pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );\nfloat pointSpecularWeight = specularTex.r * max( pow( pointDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( pointVector, pointHalfVector ), 5.0 );\npointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * pointDistance * specularNormalization;\n#else\npointSpecular += pointDistance * pointLightColor[ i ] * uSpecularColor * pointSpecularWeight * pointDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nvec3 spotDiffuse = vec3( 0.0 );\nvec3 spotSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 spotVector = lPosition.xyz + vViewPosition.xyz;\nfloat spotDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nspotDistance = 1.0 - min( ( length( spotVector ) / spotLightDistance[ i ] ), 1.0 );\nspotVector = normalize( spotVector );\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\n#ifdef WRAP_AROUND\nfloat spotDiffuseWeightFull = max( dot( normal, spotVector ), 0.0 );\nfloat spotDiffuseWeightHalf = max( 0.5 * dot( normal, spotVector ) + 0.5, 0.0 );\nvec3 spotDiffuseWeight = mix( vec3 ( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );\n#else\nfloat spotDiffuseWeight = max( dot( normal, spotVector ), 0.0 );\n#endif\nspotDiffuse += spotDistance * spotLightColor[ i ] * uDiffuseColor * spotDiffuseWeight * spotEffect;\nvec3 spotHalfVector = normalize( spotVector + viewPosition );\nfloat spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );\nfloat spotSpecularWeight = specularTex.r * max( pow( spotDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( spotVector, spotHalfVector ), 5.0 );\nspotSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * spotDistance * specularNormalization * spotEffect;\n#else\nspotSpecular += spotDistance * spotLightColor[ i ] * uSpecularColor * spotSpecularWeight * spotDiffuseWeight * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec3 dirDiffuse = vec3( 0.0 );\nvec3 dirSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\n#ifdef WRAP_AROUND\nfloat directionalLightWeightingFull = max( dot( normal, dirVector ), 0.0 );\nfloat directionalLightWeightingHalf = max( 0.5 * dot( normal, dirVector ) + 0.5, 0.0 );\nvec3 dirDiffuseWeight = mix( vec3( directionalLightWeightingFull ), vec3( directionalLightWeightingHalf ), wrapRGB );\n#else\nfloat dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );\n#endif\ndirDiffuse += directionalLightColor[ i ] * uDiffuseColor * dirDiffuseWeight;\nvec3 dirHalfVector = normalize( dirVector + viewPosition );\nfloat dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );\nfloat dirSpecularWeight = specularTex.r * max( pow( dirDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( dirVector, dirHalfVector ), 5.0 );\ndirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n#else\ndirSpecular += directionalLightColor[ i ] * uSpecularColor * dirSpecularWeight * dirDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nvec3 hemiDiffuse  = vec3( 0.0 );\nvec3 hemiSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nvec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\nhemiDiffuse += uDiffuseColor * hemiColor;\nvec3 hemiHalfVectorSky = normalize( lVector + viewPosition );\nfloat hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;\nfloat hemiSpecularWeightSky = specularTex.r * max( pow( hemiDotNormalHalfSky, uShininess ), 0.0 );\nvec3 lVectorGround = -lVector;\nvec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );\nfloat hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;\nfloat hemiSpecularWeightGround = specularTex.r * max( pow( hemiDotNormalHalfGround, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat dotProductGround = dot( normal, lVectorGround );\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlickSky = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( lVector, hemiHalfVectorSky ), 5.0 );\nvec3 schlickGround = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 5.0 );\nhemiSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );\n#else\nhemiSpecular += uSpecularColor * hemiColor * ( hemiSpecularWeightSky + hemiSpecularWeightGround ) * hemiDiffuseWeight;\n#endif\n}\n#endif\nvec3 totalDiffuse = vec3( 0.0 );\nvec3 totalSpecular = vec3( 0.0 );\n#if MAX_DIR_LIGHTS > 0\ntotalDiffuse += dirDiffuse;\ntotalSpecular += dirSpecular;\n#endif\n#if MAX_HEMI_LIGHTS > 0\ntotalDiffuse += hemiDiffuse;\ntotalSpecular += hemiSpecular;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalDiffuse += pointDiffuse;\ntotalSpecular += pointSpecular;\n#endif\n#if MAX_SPOT_LIGHTS > 0\ntotalDiffuse += spotDiffuse;\ntotalSpecular += spotSpecular;\n#endif\n#ifdef METAL\ngl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * uAmbientColor + totalSpecular );\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * uAmbientColor ) + totalSpecular;\n#endif\nif ( enableReflection ) {\nvec3 vReflect;\nvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );\nif ( useRefract ) {\nvReflect = refract( cameraToVertex, normal, uRefractionRatio );\n} else {\nvReflect = reflect( cameraToVertex, normal );\n}\nvec4 cubeColor = textureCube( tCube, vec3( -vReflect.x, vReflect.yz ) );\n#ifdef GAMMA_INPUT\ncubeColor.xyz *= cubeColor.xyz;\n#endif\ngl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, specularTex.r * uReflectivity );\n}",
            THREE.ShaderChunk.shadowmap_fragment, THREE.ShaderChunk.linear_to_gamma_fragment, THREE.ShaderChunk.fog_fragment, "}"
        ].join("\n"),
        vertexShader: ["attribute vec4 tangent;\nuniform vec2 uOffset;\nuniform vec2 uRepeat;\nuniform bool enableDisplacement;\n#ifdef VERTEX_TEXTURES\nuniform sampler2D tDisplacement;\nuniform float uDisplacementScale;\nuniform float uDisplacementBias;\n#endif\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\nvarying vec3 vWorldPosition;\nvarying vec3 vViewPosition;",
            THREE.ShaderChunk.skinning_pars_vertex, THREE.ShaderChunk.shadowmap_pars_vertex, "void main() {", THREE.ShaderChunk.skinbase_vertex, THREE.ShaderChunk.skinnormal_vertex, "#ifdef USE_SKINNING\nvNormal = normalize( normalMatrix * skinnedNormal.xyz );\nvec4 skinnedTangent = skinMatrix * vec4( tangent.xyz, 0.0 );\nvTangent = normalize( normalMatrix * skinnedTangent.xyz );\n#else\nvNormal = normalize( normalMatrix * normal );\nvTangent = normalize( normalMatrix * tangent.xyz );\n#endif\nvBinormal = normalize( cross( vNormal, vTangent ) * tangent.w );\nvUv = uv * uRepeat + uOffset;\nvec3 displacedPosition;\n#ifdef VERTEX_TEXTURES\nif ( enableDisplacement ) {\nvec3 dv = texture2D( tDisplacement, uv ).xyz;\nfloat df = uDisplacementScale * dv.x + uDisplacementBias;\ndisplacedPosition = position + normalize( normal ) * df;\n} else {\n#ifdef USE_SKINNING\nvec4 skinVertex = vec4( position, 1.0 );\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\ndisplacedPosition  = skinned.xyz;\n#else\ndisplacedPosition = position;\n#endif\n}\n#else\n#ifdef USE_SKINNING\nvec4 skinVertex = vec4( position, 1.0 );\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\ndisplacedPosition  = skinned.xyz;\n#else\ndisplacedPosition = position;\n#endif\n#endif\nvec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );\nvec4 worldPosition = modelMatrix * vec4( displacedPosition, 1.0 );\ngl_Position = projectionMatrix * mvPosition;\nvWorldPosition = worldPosition.xyz;\nvViewPosition = -mvPosition.xyz;\n#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;\n}\n#endif\n}"
        ].join("\n")
    },
    cube: {
        uniforms: {
            tCube: {
                type: "t",
                value: null
            },
            tFlip: {
                type: "f",
                value: -1
            }
        },
        vertexShader: "varying vec3 vWorldPosition;\nvoid main() {\nvec4 worldPosition = modelMatrix * vec4( position, 1.0 );\nvWorldPosition = worldPosition.xyz;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
        fragmentShader: "uniform samplerCube tCube;\nuniform float tFlip;\nvarying vec3 vWorldPosition;\nvoid main() {\ngl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );\n}"
    },
    depthRGBA: {
        uniforms: {},
        vertexShader: [THREE.ShaderChunk.morphtarget_pars_vertex, THREE.ShaderChunk.skinning_pars_vertex, "void main() {", THREE.ShaderChunk.skinbase_vertex, THREE.ShaderChunk.morphtarget_vertex, THREE.ShaderChunk.skinning_vertex, THREE.ShaderChunk.default_vertex, "}"].join("\n"),
        fragmentShader: "vec4 pack_depth( const in float depth ) {\nconst vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );\nconst vec4 bit_mask  = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );\nvec4 res = fract( depth * bit_shift );\nres -= res.xxyz * bit_mask;\nreturn res;\n}\nvoid main() {\ngl_FragData[ 0 ] = pack_depth( gl_FragCoord.z );\n}"
    }
};
THREE.WebGLRenderer = function(a) {
    function b(a, b) {
        var c = a.vertices.length,
            d = b.material;
        if (d.attributes) {
            void 0 === a.__webglCustomAttributesList && (a.__webglCustomAttributesList = []);
            for (var e in d.attributes) {
                var f = d.attributes[e];
                if (!f.__webglInitialized || f.createUniqueBuffers) {
                    f.__webglInitialized = !0;
                    var h = 1;
                    "v2" === f.type ? h = 2 : "v3" === f.type ? h = 3 : "v4" === f.type ? h = 4 : "c" === f.type && (h = 3);
                    f.size = h;
                    f.array = new Float32Array(c * h);
                    f.buffer = j.createBuffer();
                    f.buffer.belongsToAttribute = e;
                    f.needsUpdate = !0
                }
                a.__webglCustomAttributesList.push(f)
            }
        }
    }

    function c(a, b) {
        var c = b.geometry,
            h = a.faces3,
            g = 3 * h.length,
            i = 1 * h.length,
            k = 3 * h.length,
            h = d(b, a),
            m = f(h),
            l = e(h),
            n = h.vertexColors ? h.vertexColors : !1;
        a.__vertexArray = new Float32Array(3 * g);
        l && (a.__normalArray = new Float32Array(3 * g));
        c.hasTangents && (a.__tangentArray = new Float32Array(4 * g));
        n && (a.__colorArray = new Float32Array(3 * g));
        m && (0 < c.faceVertexUvs.length && (a.__uvArray = new Float32Array(2 * g)), 1 < c.faceVertexUvs.length && (a.__uv2Array = new Float32Array(2 * g)));
        b.geometry.skinWeights.length && b.geometry.skinIndices.length &&
            (a.__skinIndexArray = new Float32Array(4 * g), a.__skinWeightArray = new Float32Array(4 * g));
        a.__faceArray = new Uint16Array(3 * i);
        a.__lineArray = new Uint16Array(2 * k);
        if (a.numMorphTargets) {
            a.__morphTargetsArrays = [];
            c = 0;
            for (m = a.numMorphTargets; c < m; c++) a.__morphTargetsArrays.push(new Float32Array(3 * g))
        }
        if (a.numMorphNormals) {
            a.__morphNormalsArrays = [];
            c = 0;
            for (m = a.numMorphNormals; c < m; c++) a.__morphNormalsArrays.push(new Float32Array(3 * g))
        }
        a.__webglFaceCount = 3 * i;
        a.__webglLineCount = 2 * k;
        if (h.attributes) {
            void 0 === a.__webglCustomAttributesList &&
                (a.__webglCustomAttributesList = []);
            for (var p in h.attributes) {
                var i = h.attributes[p],
                    k = {},
                    t;
                for (t in i) k[t] = i[t];
                if (!k.__webglInitialized || k.createUniqueBuffers) k.__webglInitialized = !0, c = 1, "v2" === k.type ? c = 2 : "v3" === k.type ? c = 3 : "v4" === k.type ? c = 4 : "c" === k.type && (c = 3), k.size = c, k.array = new Float32Array(g * c), k.buffer = j.createBuffer(), k.buffer.belongsToAttribute = p, i.needsUpdate = !0, k.__original = i;
                a.__webglCustomAttributesList.push(k)
            }
        }
        a.__inittedArrays = !0
    }

    function d(a, b) {
        return a.material instanceof THREE.MeshFaceMaterial ?
            a.material.materials[b.materialIndex] : a.material
    }

    function e(a) {
        return a instanceof THREE.MeshBasicMaterial && !a.envMap || a instanceof THREE.MeshDepthMaterial ? !1 : a && void 0 !== a.shading && a.shading === THREE.SmoothShading ? THREE.SmoothShading : THREE.FlatShading
    }

    function f(a) {
        return a.map || a.lightMap || a.bumpMap || a.normalMap || a.specularMap || a instanceof THREE.ShaderMaterial ? !0 : !1
    }

    function h(a) {
        Ka[a] || (j.enableVertexAttribArray(a), Ka[a] = !0)
    }

    function g() {
        for (var a in Ka) Ka[a] && (j.disableVertexAttribArray(a), Ka[a] = !1)
    }

    function i(a, b) {
        return a.z !== b.z ? b.z - a.z : a.id - b.id
    }

    function k(a, b) {
        return b[0] - a[0]
    }

    function m(a, b, c) {
        if (a.length)
            for (var d = 0, e = a.length; d < e; d++) fa = Fa = null, Ea = $ = T = Y = ga = Ja = ma = -1, wa = !0, a[d].render(b, c, vb, jb), fa = Fa = null, Ea = $ = T = Y = ga = Ja = ma = -1, wa = !0
    }

    function l(a, b, c, d, e, f, h, g) {
        var j, i, k, m;
        b ? (i = a.length - 1, m = b = -1) : (i = 0, b = a.length, m = 1);
        for (var l = i; l !== b; l += m)
            if (j = a[l], j.render) {
                i = j.object;
                k = j.buffer;
                if (g) j = g;
                else {
                    j = j[c];
                    if (!j) continue;
                    h && K.setBlending(j.blending, j.blendEquation, j.blendSrc, j.blendDst);
                    K.setDepthTest(j.depthTest);
                    K.setDepthWrite(j.depthWrite);
                    z(j.polygonOffset, j.polygonOffsetFactor, j.polygonOffsetUnits)
                }
                K.setMaterialFaces(j);
                k instanceof THREE.BufferGeometry ? K.renderBufferDirect(d, e, f, j, k, i) : K.renderBuffer(d, e, f, j, k, i)
            }
    }

    function n(a, b, c, d, e, f, h) {
        for (var g, j, i = 0, k = a.length; i < k; i++)
            if (g = a[i], j = g.object, j.visible) {
                if (h) g = h;
                else {
                    g = g[b];
                    if (!g) continue;
                    f && K.setBlending(g.blending, g.blendEquation, g.blendSrc, g.blendDst);
                    K.setDepthTest(g.depthTest);
                    K.setDepthWrite(g.depthWrite);
                    z(g.polygonOffset,
                        g.polygonOffsetFactor, g.polygonOffsetUnits)
                }
                K.renderImmediateObject(c, d, e, g, j)
            }
    }

    function t(a, d) {
        var e, f, h, g;
        if (void 0 === a.__webglInit && (a.__webglInit = !0, a._modelViewMatrix = new THREE.Matrix4, a._normalMatrix = new THREE.Matrix3, void 0 !== a.geometry && void 0 === a.geometry.__webglInit && (a.geometry.__webglInit = !0, a.geometry.addEventListener("dispose", Jb)), f = a.geometry, void 0 !== f))
            if (f instanceof THREE.BufferGeometry) {
                var i, k;
                for (i in f.attributes) k = "index" === i ? j.ELEMENT_ARRAY_BUFFER : j.ARRAY_BUFFER, g = f.attributes[i],
                    void 0 === g.numItems && (g.numItems = g.array.length), g.buffer = j.createBuffer(), j.bindBuffer(k, g.buffer), j.bufferData(k, g.array, j.STATIC_DRAW)
            } else if (a instanceof THREE.Mesh) {
            h = a.material;
            if (void 0 === f.geometryGroups) {
                i = f;
                var m, l, n;
                k = {};
                var p = i.morphTargets.length,
                    t = i.morphNormals.length,
                    r = h instanceof THREE.MeshFaceMaterial;
                i.geometryGroups = {};
                h = 0;
                for (m = i.faces.length; h < m; h++) l = i.faces[h], l = r ? l.materialIndex : 0, void 0 === k[l] && (k[l] = {
                        hash: l,
                        counter: 0
                    }), n = k[l].hash + "_" + k[l].counter, void 0 === i.geometryGroups[n] &&
                    (i.geometryGroups[n] = {
                        faces3: [],
                        materialIndex: l,
                        vertices: 0,
                        numMorphTargets: p,
                        numMorphNormals: t
                    }), 65535 < i.geometryGroups[n].vertices + 3 && (k[l].counter += 1, n = k[l].hash + "_" + k[l].counter, void 0 === i.geometryGroups[n] && (i.geometryGroups[n] = {
                        faces3: [],
                        materialIndex: l,
                        vertices: 0,
                        numMorphTargets: p,
                        numMorphNormals: t
                    })), i.geometryGroups[n].faces3.push(h), i.geometryGroups[n].vertices += 3;
                i.geometryGroupsList = [];
                for (g in i.geometryGroups) i.geometryGroups[g].id = V++, i.geometryGroupsList.push(i.geometryGroups[g])
            }
            for (e in f.geometryGroups)
                if (g =
                    f.geometryGroups[e], !g.__webglVertexBuffer) {
                    i = g;
                    i.__webglVertexBuffer = j.createBuffer();
                    i.__webglNormalBuffer = j.createBuffer();
                    i.__webglTangentBuffer = j.createBuffer();
                    i.__webglColorBuffer = j.createBuffer();
                    i.__webglUVBuffer = j.createBuffer();
                    i.__webglUV2Buffer = j.createBuffer();
                    i.__webglSkinIndicesBuffer = j.createBuffer();
                    i.__webglSkinWeightsBuffer = j.createBuffer();
                    i.__webglFaceBuffer = j.createBuffer();
                    i.__webglLineBuffer = j.createBuffer();
                    p = k = void 0;
                    if (i.numMorphTargets) {
                        i.__webglMorphTargetsBuffers = [];
                        k = 0;
                        for (p = i.numMorphTargets; k < p; k++) i.__webglMorphTargetsBuffers.push(j.createBuffer())
                    }
                    if (i.numMorphNormals) {
                        i.__webglMorphNormalsBuffers = [];
                        k = 0;
                        for (p = i.numMorphNormals; k < p; k++) i.__webglMorphNormalsBuffers.push(j.createBuffer())
                    }
                    K.info.memory.geometries++;
                    c(g, a);
                    f.verticesNeedUpdate = !0;
                    f.morphTargetsNeedUpdate = !0;
                    f.elementsNeedUpdate = !0;
                    f.uvsNeedUpdate = !0;
                    f.normalsNeedUpdate = !0;
                    f.tangentsNeedUpdate = !0;
                    f.colorsNeedUpdate = !0
                }
        } else a instanceof THREE.Ribbon ? f.__webglVertexBuffer || (g = f, g.__webglVertexBuffer =
            j.createBuffer(), g.__webglColorBuffer = j.createBuffer(), g.__webglNormalBuffer = j.createBuffer(), K.info.memory.geometries++, g = f, i = g.vertices.length, g.__vertexArray = new Float32Array(3 * i), g.__colorArray = new Float32Array(3 * i), g.__normalArray = new Float32Array(3 * i), g.__webglVertexCount = i, b(g, a), f.verticesNeedUpdate = !0, f.colorsNeedUpdate = !0, f.normalsNeedUpdate = !0) : a instanceof THREE.Line ? f.__webglVertexBuffer || (g = f, g.__webglVertexBuffer = j.createBuffer(), g.__webglColorBuffer = j.createBuffer(), g.__webglLineDistanceBuffer =
            j.createBuffer(), K.info.memory.geometries++, g = f, i = g.vertices.length, g.__vertexArray = new Float32Array(3 * i), g.__colorArray = new Float32Array(3 * i), g.__lineDistanceArray = new Float32Array(1 * i), g.__webglLineCount = i, b(g, a), f.verticesNeedUpdate = !0, f.colorsNeedUpdate = !0, f.lineDistancesNeedUpdate = !0) : a instanceof THREE.ParticleSystem && !f.__webglVertexBuffer && (g = f, g.__webglVertexBuffer = j.createBuffer(), g.__webglColorBuffer = j.createBuffer(), K.info.memory.geometries++, g = f, i = g.vertices.length, g.__vertexArray = new Float32Array(3 *
            i), g.__colorArray = new Float32Array(3 * i), g.__sortArray = [], g.__webglParticleCount = i, b(g, a), f.verticesNeedUpdate = !0, f.colorsNeedUpdate = !0);
        if (void 0 === a.__webglActive) {
            if (a instanceof THREE.Mesh)
                if (f = a.geometry, f instanceof THREE.BufferGeometry) q(d.__webglObjects, f, a);
                else {
                    if (f instanceof THREE.Geometry)
                        for (e in f.geometryGroups) g = f.geometryGroups[e], q(d.__webglObjects, g, a)
                } else a instanceof THREE.Ribbon || a instanceof THREE.Line || a instanceof THREE.ParticleSystem ? (f = a.geometry, q(d.__webglObjects, f, a)) :
                a instanceof THREE.ImmediateRenderObject || a.immediateRenderCallback ? d.__webglObjectsImmediate.push({
                    id: null,
                    object: a,
                    opaque: null,
                    transparent: null,
                    z: 0
                }) : a instanceof THREE.Sprite ? d.__webglSprites.push(a) : a instanceof THREE.LensFlare && d.__webglFlares.push(a);
            a.__webglActive = !0
        }
    }

    function q(a, b, c) {
        a.push({
            id: null,
            buffer: b,
            object: c,
            opaque: null,
            transparent: null,
            z: 0
        })
    }

    function p(a) {
        for (var b in a.attributes)
            if (a.attributes[b].needsUpdate) return !0;
        return !1
    }

    function r(a) {
        for (var b in a.attributes) a.attributes[b].needsUpdate = !1
    }

    function s(a, b) {
        a instanceof THREE.Mesh || a instanceof THREE.ParticleSystem || a instanceof THREE.Ribbon || a instanceof THREE.Line ? u(b.__webglObjects, a) : a instanceof THREE.Sprite ? w(b.__webglSprites, a) : a instanceof THREE.LensFlare ? w(b.__webglFlares, a) : (a instanceof THREE.ImmediateRenderObject || a.immediateRenderCallback) && u(b.__webglObjectsImmediate, a);
        delete a.__webglActive
    }

    function u(a, b) {
        for (var c = a.length - 1; 0 <= c; c--) a[c].object === b && a.splice(c, 1)
    }

    function w(a, b) {
        for (var c = a.length - 1; 0 <= c; c--) a[c] ===
            b && a.splice(c, 1)
    }

    function E(a, b, c, d, e) {
        P = 0;
        d.needsUpdate && (d.program && Nb(d), K.initMaterial(d, b, c, e), d.needsUpdate = !1);
        d.morphTargets && !e.__webglMorphTargetInfluences && (e.__webglMorphTargetInfluences = new Float32Array(K.maxMorphTargets));
        var f = !1,
            g = d.program,
            h = g.uniforms,
            i = d.uniforms;
        g !== Fa && (j.useProgram(g), Fa = g, f = !0);
        d.id !== Ea && (Ea = d.id, f = !0);
        if (f || a !== fa) j.uniformMatrix4fv(h.projectionMatrix, !1, a.projectionMatrix.elements), a !== fa && (fa = a);
        if (d.skinning)
            if (Eb && e.useVertexTexture) {
                if (null !== h.boneTexture) {
                    var k =
                        D();
                    j.uniform1i(h.boneTexture, k);
                    K.setTexture(e.boneTexture, k)
                }
            } else null !== h.boneGlobalMatrices && j.uniformMatrix4fv(h.boneGlobalMatrices, !1, e.boneMatrices);
        if (f) {
            c && d.fog && (i.fogColor.value = c.color, c instanceof THREE.Fog ? (i.fogNear.value = c.near, i.fogFar.value = c.far) : c instanceof THREE.FogExp2 && (i.fogDensity.value = c.density));
            if (d instanceof THREE.MeshPhongMaterial || d instanceof THREE.MeshLambertMaterial || d.lights) {
                if (wa) {
                    for (var m, l = k = 0, n = 0, p, t, r, q = Sa, s = q.directional.colors, u = q.directional.positions,
                            w = q.point.colors, v = q.point.positions, z = q.point.distances, E = q.spot.colors, x = q.spot.positions, B = q.spot.distances, J = q.spot.directions, N = q.spot.anglesCos, O = q.spot.exponents, I = q.hemi.skyColors, V = q.hemi.groundColors, R = q.hemi.positions, M = 0, T = 0, Y = 0, Da = 0, $ = 0, xc = 0, X = 0, W = 0, Q = m = 0, c = r = Q = 0, f = b.length; c < f; c++) m = b[c], m.onlyShadow || (p = m.color, t = m.intensity, r = m.distance, m instanceof THREE.AmbientLight ? m.visible && (K.gammaInput ? (k += p.r * p.r, l += p.g * p.g, n += p.b * p.b) : (k += p.r, l += p.g, n += p.b)) : m instanceof THREE.DirectionalLight ?
                        ($ += 1, m.visible && (ha.getPositionFromMatrix(m.matrixWorld), ua.getPositionFromMatrix(m.target.matrixWorld), ha.sub(ua), ha.normalize(), 0 === ha.x && 0 === ha.y && 0 === ha.z || (m = 3 * M, u[m] = ha.x, u[m + 1] = ha.y, u[m + 2] = ha.z, K.gammaInput ? F(s, m, p, t * t) : y(s, m, p, t), M += 1))) : m instanceof THREE.PointLight ? (xc += 1, m.visible && (Q = 3 * T, K.gammaInput ? F(w, Q, p, t * t) : y(w, Q, p, t), ua.getPositionFromMatrix(m.matrixWorld), v[Q] = ua.x, v[Q + 1] = ua.y, v[Q + 2] = ua.z, z[T] = r, T += 1)) : m instanceof THREE.SpotLight ? (X += 1, m.visible && (Q = 3 * Y, K.gammaInput ? F(E, Q, p,
                            t * t) : y(E, Q, p, t), ua.getPositionFromMatrix(m.matrixWorld), x[Q] = ua.x, x[Q + 1] = ua.y, x[Q + 2] = ua.z, B[Y] = r, ha.copy(ua), ua.getPositionFromMatrix(m.target.matrixWorld), ha.sub(ua), ha.normalize(), J[Q] = ha.x, J[Q + 1] = ha.y, J[Q + 2] = ha.z, N[Y] = Math.cos(m.angle), O[Y] = m.exponent, Y += 1)) : m instanceof THREE.HemisphereLight && (W += 1, m.visible && (ha.getPositionFromMatrix(m.matrixWorld), ha.normalize(), 0 === ha.x && 0 === ha.y && 0 === ha.z || (r = 3 * Da, R[r] = ha.x, R[r + 1] = ha.y, R[r + 2] = ha.z, p = m.color, m = m.groundColor, K.gammaInput ? (t *= t, F(I, r, p, t), F(V,
                            r, m, t)) : (y(I, r, p, t), y(V, r, m, t)), Da += 1))));
                    c = 3 * M;
                    for (f = Math.max(s.length, 3 * $); c < f; c++) s[c] = 0;
                    c = 3 * T;
                    for (f = Math.max(w.length, 3 * xc); c < f; c++) w[c] = 0;
                    c = 3 * Y;
                    for (f = Math.max(E.length, 3 * X); c < f; c++) E[c] = 0;
                    c = 3 * Da;
                    for (f = Math.max(I.length, 3 * W); c < f; c++) I[c] = 0;
                    c = 3 * Da;
                    for (f = Math.max(V.length, 3 * W); c < f; c++) V[c] = 0;
                    q.directional.length = M;
                    q.point.length = T;
                    q.spot.length = Y;
                    q.hemi.length = Da;
                    q.ambient[0] = k;
                    q.ambient[1] = l;
                    q.ambient[2] = n;
                    wa = !1
                }
                c = Sa;
                i.ambientLightColor.value = c.ambient;
                i.directionalLightColor.value = c.directional.colors;
                i.directionalLightDirection.value = c.directional.positions;
                i.pointLightColor.value = c.point.colors;
                i.pointLightPosition.value = c.point.positions;
                i.pointLightDistance.value = c.point.distances;
                i.spotLightColor.value = c.spot.colors;
                i.spotLightPosition.value = c.spot.positions;
                i.spotLightDistance.value = c.spot.distances;
                i.spotLightDirection.value = c.spot.directions;
                i.spotLightAngleCos.value = c.spot.anglesCos;
                i.spotLightExponent.value = c.spot.exponents;
                i.hemisphereLightSkyColor.value = c.hemi.skyColors;
                i.hemisphereLightGroundColor.value =
                    c.hemi.groundColors;
                i.hemisphereLightDirection.value = c.hemi.positions
            }
            if (d instanceof THREE.MeshBasicMaterial || d instanceof THREE.MeshLambertMaterial || d instanceof THREE.MeshPhongMaterial) {
                i.opacity.value = d.opacity;
                K.gammaInput ? i.diffuse.value.copyGammaToLinear(d.color) : i.diffuse.value = d.color;
                i.map.value = d.map;
                i.lightMap.value = d.lightMap;
                i.specularMap.value = d.specularMap;
                d.bumpMap && (i.bumpMap.value = d.bumpMap, i.bumpScale.value = d.bumpScale);
                d.normalMap && (i.normalMap.value = d.normalMap, i.normalScale.value.copy(d.normalScale));
                var ba;
                d.map ? ba = d.map : d.specularMap ? ba = d.specularMap : d.normalMap ? ba = d.normalMap : d.bumpMap && (ba = d.bumpMap);
                void 0 !== ba && (c = ba.offset, ba = ba.repeat, i.offsetRepeat.value.set(c.x, c.y, ba.x, ba.y));
                i.envMap.value = d.envMap;
                i.flipEnvMap.value = d.envMap instanceof THREE.WebGLRenderTargetCube ? 1 : -1;
                i.reflectivity.value = d.reflectivity;
                i.refractionRatio.value = d.refractionRatio;
                i.combine.value = d.combine;
                i.useRefract.value = d.envMap && d.envMap.mapping instanceof THREE.CubeRefractionMapping
            }
            d instanceof THREE.LineBasicMaterial ?
                (i.diffuse.value = d.color, i.opacity.value = d.opacity) : d instanceof THREE.LineDashedMaterial ? (i.diffuse.value = d.color, i.opacity.value = d.opacity, i.dashSize.value = d.dashSize, i.totalSize.value = d.dashSize + d.gapSize, i.scale.value = d.scale) : d instanceof THREE.ParticleBasicMaterial ? (i.psColor.value = d.color, i.opacity.value = d.opacity, i.size.value = d.size, i.scale.value = G.height / 2, i.map.value = d.map) : d instanceof THREE.MeshPhongMaterial ? (i.shininess.value = d.shininess, K.gammaInput ? (i.ambient.value.copyGammaToLinear(d.ambient),
                    i.emissive.value.copyGammaToLinear(d.emissive), i.specular.value.copyGammaToLinear(d.specular)) : (i.ambient.value = d.ambient, i.emissive.value = d.emissive, i.specular.value = d.specular), d.wrapAround && i.wrapRGB.value.copy(d.wrapRGB)) : d instanceof THREE.MeshLambertMaterial ? (K.gammaInput ? (i.ambient.value.copyGammaToLinear(d.ambient), i.emissive.value.copyGammaToLinear(d.emissive)) : (i.ambient.value = d.ambient, i.emissive.value = d.emissive), d.wrapAround && i.wrapRGB.value.copy(d.wrapRGB)) : d instanceof THREE.MeshDepthMaterial ?
                (i.mNear.value = a.near, i.mFar.value = a.far, i.opacity.value = d.opacity) : d instanceof THREE.MeshNormalMaterial && (i.opacity.value = d.opacity);
            if (e.receiveShadow && !d._shadowPass && i.shadowMatrix) {
                c = ba = 0;
                for (f = b.length; c < f; c++)
                    if (k = b[c], k.castShadow && (k instanceof THREE.SpotLight || k instanceof THREE.DirectionalLight && !k.shadowCascade)) i.shadowMap.value[ba] = k.shadowMap, i.shadowMapSize.value[ba] = k.shadowMapSize, i.shadowMatrix.value[ba] = k.shadowMatrix, i.shadowDarkness.value[ba] = k.shadowDarkness, i.shadowBias.value[ba] =
                        k.shadowBias, ba++
            }
            b = d.uniformsList;
            i = 0;
            for (ba = b.length; i < ba; i++)
                if (f = g.uniforms[b[i][1]])
                    if (c = b[i][0], l = c.type, k = c.value, "i" === l) j.uniform1i(f, k);
                    else if ("f" === l) j.uniform1f(f, k);
            else if ("v2" === l) j.uniform2f(f, k.x, k.y);
            else if ("v3" === l) j.uniform3f(f, k.x, k.y, k.z);
            else if ("v4" === l) j.uniform4f(f, k.x, k.y, k.z, k.w);
            else if ("c" === l) j.uniform3f(f, k.r, k.g, k.b);
            else if ("iv1" === l) j.uniform1iv(f, k);
            else if ("iv" === l) j.uniform3iv(f, k);
            else if ("fv1" === l) j.uniform1fv(f, k);
            else if ("fv" === l) j.uniform3fv(f, k);
            else if ("v2v" ===
                l) {
                void 0 === c._array && (c._array = new Float32Array(2 * k.length));
                l = 0;
                for (n = k.length; l < n; l++) q = 2 * l, c._array[q] = k[l].x, c._array[q + 1] = k[l].y;
                j.uniform2fv(f, c._array)
            } else if ("v3v" === l) {
                void 0 === c._array && (c._array = new Float32Array(3 * k.length));
                l = 0;
                for (n = k.length; l < n; l++) q = 3 * l, c._array[q] = k[l].x, c._array[q + 1] = k[l].y, c._array[q + 2] = k[l].z;
                j.uniform3fv(f, c._array)
            } else if ("v4v" === l) {
                void 0 === c._array && (c._array = new Float32Array(4 * k.length));
                l = 0;
                for (n = k.length; l < n; l++) q = 4 * l, c._array[q] = k[l].x, c._array[q + 1] =
                    k[l].y, c._array[q + 2] = k[l].z, c._array[q + 3] = k[l].w;
                j.uniform4fv(f, c._array)
            } else if ("m4" === l) void 0 === c._array && (c._array = new Float32Array(16)), k.flattenToArray(c._array), j.uniformMatrix4fv(f, !1, c._array);
            else if ("m4v" === l) {
                void 0 === c._array && (c._array = new Float32Array(16 * k.length));
                l = 0;
                for (n = k.length; l < n; l++) k[l].flattenToArrayOffset(c._array, 16 * l);
                j.uniformMatrix4fv(f, !1, c._array)
            } else if ("t" === l) {
                if (q = k, k = D(), j.uniform1i(f, k), q)
                    if (q.image instanceof Array && 6 === q.image.length) {
                        if (c = q, f = k, 6 === c.image.length)
                            if (c.needsUpdate) {
                                c.image.__webglTextureCube ||
                                    (c.addEventListener("dispose", Kb), c.image.__webglTextureCube = j.createTexture(), K.info.memory.textures++);
                                j.activeTexture(j.TEXTURE0 + f);
                                j.bindTexture(j.TEXTURE_CUBE_MAP, c.image.__webglTextureCube);
                                j.pixelStorei(j.UNPACK_FLIP_Y_WEBGL, c.flipY);
                                f = c instanceof THREE.CompressedTexture;
                                k = [];
                                for (l = 0; 6 > l; l++) K.autoScaleCubemaps && !f ? (n = k, q = l, s = c.image[l], w = rc, s.width <= w && s.height <= w || (v = Math.max(s.width, s.height), u = Math.floor(s.width * w / v), w = Math.floor(s.height * w / v), v = document.createElement("canvas"), v.width =
                                    u, v.height = w, v.getContext("2d").drawImage(s, 0, 0, s.width, s.height, 0, 0, u, w), s = v), n[q] = s) : k[l] = c.image[l];
                                l = k[0];
                                n = 0 === (l.width & l.width - 1) && 0 === (l.height & l.height - 1);
                                q = A(c.format);
                                s = A(c.type);
                                C(j.TEXTURE_CUBE_MAP, c, n);
                                for (l = 0; 6 > l; l++)
                                    if (f) {
                                        w = k[l].mipmaps;
                                        v = 0;
                                        for (z = w.length; v < z; v++) u = w[v], j.compressedTexImage2D(j.TEXTURE_CUBE_MAP_POSITIVE_X + l, v, q, u.width, u.height, 0, u.data)
                                    } else j.texImage2D(j.TEXTURE_CUBE_MAP_POSITIVE_X + l, 0, q, q, s, k[l]);
                                c.generateMipmaps && n && j.generateMipmap(j.TEXTURE_CUBE_MAP);
                                c.needsUpdate = !1;
                                if (c.onUpdate) c.onUpdate()
                            } else j.activeTexture(j.TEXTURE0 + f), j.bindTexture(j.TEXTURE_CUBE_MAP, c.image.__webglTextureCube)
                    } else q instanceof THREE.WebGLRenderTargetCube ? (c = q, j.activeTexture(j.TEXTURE0 + k), j.bindTexture(j.TEXTURE_CUBE_MAP, c.__webglTexture)) : K.setTexture(q, k)
            } else if ("tv" === l) {
                void 0 === c._array && (c._array = []);
                l = 0;
                for (n = c.value.length; l < n; l++) c._array[l] = D();
                j.uniform1iv(f, c._array);
                l = 0;
                for (n = c.value.length; l < n; l++) q = c.value[l], k = c._array[l], q && K.setTexture(q, k)
            } else console.warn("THREE.WebGLRenderer: Unknown uniform type: " +
                l);
            if ((d instanceof THREE.ShaderMaterial || d instanceof THREE.MeshPhongMaterial || d.envMap) && null !== h.cameraPosition) ua.getPositionFromMatrix(a.matrixWorld), j.uniform3f(h.cameraPosition, ua.x, ua.y, ua.z);
            (d instanceof THREE.MeshPhongMaterial || d instanceof THREE.MeshLambertMaterial || d instanceof THREE.ShaderMaterial || d.skinning) && null !== h.viewMatrix && j.uniformMatrix4fv(h.viewMatrix, !1, a.matrixWorldInverse.elements)
        }
        j.uniformMatrix4fv(h.modelViewMatrix, !1, e._modelViewMatrix.elements);
        h.normalMatrix && j.uniformMatrix3fv(h.normalMatrix, !1, e._normalMatrix.elements);
        null !== h.modelMatrix && j.uniformMatrix4fv(h.modelMatrix, !1, e.matrixWorld.elements);
        return g
    }

    function D() {
        var a = P;
        a >= Wb && console.warn("WebGLRenderer: trying to use " + a + " texture units while this GPU supports only " + Wb);
        P += 1;
        return a
    }

    function F(a, b, c, d) {
        a[b] = c.r * c.r * d;
        a[b + 1] = c.g * c.g * d;
        a[b + 2] = c.b * c.b * d
    }

    function y(a, b, c, d) {
        a[b] = c.r * d;
        a[b + 1] = c.g * d;
        a[b + 2] = c.b * d
    }

    function x(a) {
        a !== za && (j.lineWidth(a), za = a)
    }

    function z(a, b, c) {
        Ha !== a && (a ? j.enable(j.POLYGON_OFFSET_FILL) : j.disable(j.POLYGON_OFFSET_FILL),
            Ha = a);
        if (a && (Xa !== b || Ta !== c)) j.polygonOffset(b, c), Xa = b, Ta = c
    }

    function O(a) {
        for (var a = a.split("\n"), b = 0, c = a.length; b < c; b++) a[b] = b + 1 + ": " + a[b];
        return a.join("\n")
    }

    function B(a, b) {
        var c;
        "fragment" === a ? c = j.createShader(j.FRAGMENT_SHADER) : "vertex" === a && (c = j.createShader(j.VERTEX_SHADER));
        j.shaderSource(c, b);
        j.compileShader(c);
        return !j.getShaderParameter(c, j.COMPILE_STATUS) ? (console.error(j.getShaderInfoLog(c)), console.error(O(b)), null) : c
    }

    function C(a, b, c) {
        c ? (j.texParameteri(a, j.TEXTURE_WRAP_S, A(b.wrapS)),
            j.texParameteri(a, j.TEXTURE_WRAP_T, A(b.wrapT)), j.texParameteri(a, j.TEXTURE_MAG_FILTER, A(b.magFilter)), j.texParameteri(a, j.TEXTURE_MIN_FILTER, A(b.minFilter))) : (j.texParameteri(a, j.TEXTURE_WRAP_S, j.CLAMP_TO_EDGE), j.texParameteri(a, j.TEXTURE_WRAP_T, j.CLAMP_TO_EDGE), j.texParameteri(a, j.TEXTURE_MAG_FILTER, v(b.magFilter)), j.texParameteri(a, j.TEXTURE_MIN_FILTER, v(b.minFilter)));
        if (ya && b.type !== THREE.FloatType && (1 < b.anisotropy || b.__oldAnisotropy)) j.texParameterf(a, ya.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(b.anisotropy,
            Xb)), b.__oldAnisotropy = b.anisotropy
    }

    function I(a, b) {
        j.bindRenderbuffer(j.RENDERBUFFER, a);
        b.depthBuffer && !b.stencilBuffer ? (j.renderbufferStorage(j.RENDERBUFFER, j.DEPTH_COMPONENT16, b.width, b.height), j.framebufferRenderbuffer(j.FRAMEBUFFER, j.DEPTH_ATTACHMENT, j.RENDERBUFFER, a)) : b.depthBuffer && b.stencilBuffer ? (j.renderbufferStorage(j.RENDERBUFFER, j.DEPTH_STENCIL, b.width, b.height), j.framebufferRenderbuffer(j.FRAMEBUFFER, j.DEPTH_STENCIL_ATTACHMENT, j.RENDERBUFFER, a)) : j.renderbufferStorage(j.RENDERBUFFER,
            j.RGBA4, b.width, b.height)
    }

    function v(a) {
        return a === THREE.NearestFilter || a === THREE.NearestMipMapNearestFilter || a === THREE.NearestMipMapLinearFilter ? j.NEAREST : j.LINEAR
    }

    function A(a) {
        if (a === THREE.RepeatWrapping) return j.REPEAT;
        if (a === THREE.ClampToEdgeWrapping) return j.CLAMP_TO_EDGE;
        if (a === THREE.MirroredRepeatWrapping) return j.MIRRORED_REPEAT;
        if (a === THREE.NearestFilter) return j.NEAREST;
        if (a === THREE.NearestMipMapNearestFilter) return j.NEAREST_MIPMAP_NEAREST;
        if (a === THREE.NearestMipMapLinearFilter) return j.NEAREST_MIPMAP_LINEAR;
        if (a === THREE.LinearFilter) return j.LINEAR;
        if (a === THREE.LinearMipMapNearestFilter) return j.LINEAR_MIPMAP_NEAREST;
        if (a === THREE.LinearMipMapLinearFilter) return j.LINEAR_MIPMAP_LINEAR;
        if (a === THREE.UnsignedByteType) return j.UNSIGNED_BYTE;
        if (a === THREE.UnsignedShort4444Type) return j.UNSIGNED_SHORT_4_4_4_4;
        if (a === THREE.UnsignedShort5551Type) return j.UNSIGNED_SHORT_5_5_5_1;
        if (a === THREE.UnsignedShort565Type) return j.UNSIGNED_SHORT_5_6_5;
        if (a === THREE.ByteType) return j.BYTE;
        if (a === THREE.ShortType) return j.SHORT;
        if (a === THREE.UnsignedShortType) return j.UNSIGNED_SHORT;
        if (a === THREE.IntType) return j.INT;
        if (a === THREE.UnsignedIntType) return j.UNSIGNED_INT;
        if (a === THREE.FloatType) return j.FLOAT;
        if (a === THREE.AlphaFormat) return j.ALPHA;
        if (a === THREE.RGBFormat) return j.RGB;
        if (a === THREE.RGBAFormat) return j.RGBA;
        if (a === THREE.LuminanceFormat) return j.LUMINANCE;
        if (a === THREE.LuminanceAlphaFormat) return j.LUMINANCE_ALPHA;
        if (a === THREE.AddEquation) return j.FUNC_ADD;
        if (a === THREE.SubtractEquation) return j.FUNC_SUBTRACT;
        if (a ===
            THREE.ReverseSubtractEquation) return j.FUNC_REVERSE_SUBTRACT;
        if (a === THREE.ZeroFactor) return j.ZERO;
        if (a === THREE.OneFactor) return j.ONE;
        if (a === THREE.SrcColorFactor) return j.SRC_COLOR;
        if (a === THREE.OneMinusSrcColorFactor) return j.ONE_MINUS_SRC_COLOR;
        if (a === THREE.SrcAlphaFactor) return j.SRC_ALPHA;
        if (a === THREE.OneMinusSrcAlphaFactor) return j.ONE_MINUS_SRC_ALPHA;
        if (a === THREE.DstAlphaFactor) return j.DST_ALPHA;
        if (a === THREE.OneMinusDstAlphaFactor) return j.ONE_MINUS_DST_ALPHA;
        if (a === THREE.DstColorFactor) return j.DST_COLOR;
        if (a === THREE.OneMinusDstColorFactor) return j.ONE_MINUS_DST_COLOR;
        if (a === THREE.SrcAlphaSaturateFactor) return j.SRC_ALPHA_SATURATE;
        if (void 0 !== Ia) {
            if (a === THREE.RGB_S3TC_DXT1_Format) return Ia.COMPRESSED_RGB_S3TC_DXT1_EXT;
            if (a === THREE.RGBA_S3TC_DXT1_Format) return Ia.COMPRESSED_RGBA_S3TC_DXT1_EXT;
            if (a === THREE.RGBA_S3TC_DXT3_Format) return Ia.COMPRESSED_RGBA_S3TC_DXT3_EXT;
            if (a === THREE.RGBA_S3TC_DXT5_Format) return Ia.COMPRESSED_RGBA_S3TC_DXT5_EXT
        }
        return 0
    }
    console.log("THREE.WebGLRenderer", THREE.REVISION);
    var a = a || {},
        G = void 0 !== a.canvas ? a.canvas : document.createElement("canvas"),
        R = void 0 !== a.precision ? a.precision : "highp",
        J = void 0 !== a.alpha ? a.alpha : !0,
        ca = void 0 !== a.premultipliedAlpha ? a.premultipliedAlpha : !0,
        qa = void 0 !== a.antialias ? a.antialias : !1,
        ra = void 0 !== a.stencil ? a.stencil : !0,
        N = void 0 !== a.preserveDrawingBuffer ? a.preserveDrawingBuffer : !1,
        M = new THREE.Color(0),
        Q = 0;
    void 0 !== a.clearColor && (console.warn("DEPRECATED: clearColor in WebGLRenderer constructor parameters is being removed. Use .setClearColor() instead."),
        M.setHex(a.clearColor));
    void 0 !== a.clearAlpha && (console.warn("DEPRECATED: clearAlpha in WebGLRenderer constructor parameters is being removed. Use .setClearColor() instead."), Q = a.clearAlpha);
    this.domElement = G;
    this.context = null;
    this.devicePixelRatio = void 0 !== a.devicePixelRatio ? a.devicePixelRatio : void 0 !== window.devicePixelRatio ? window.devicePixelRatio : 1;
    this.autoUpdateObjects = this.sortObjects = this.autoClearStencil = this.autoClearDepth = this.autoClearColor = this.autoClear = !0;
    this.shadowMapEnabled = this.physicallyBasedShading =
        this.gammaOutput = this.gammaInput = !1;
    this.shadowMapAutoUpdate = !0;
    this.shadowMapType = THREE.PCFShadowMap;
    this.shadowMapCullFace = THREE.CullFaceFront;
    this.shadowMapCascade = this.shadowMapDebug = !1;
    this.maxMorphTargets = 8;
    this.maxMorphNormals = 4;
    this.autoScaleCubemaps = !0;
    this.renderPluginsPre = [];
    this.renderPluginsPost = [];
    this.info = {
        memory: {
            programs: 0,
            geometries: 0,
            textures: 0
        },
        render: {
            calls: 0,
            vertices: 0,
            faces: 0,
            points: 0
        }
    };
    var K = this,
        ea = [],
        Da = 0,
        Fa = null,
        ba = null,
        Ea = -1,
        $ = null,
        fa = null,
        V = 0,
        P = 0,
        Y = -1,
        T = -1,
        ma = -1,
        va = -1,
        ja = -1,
        Pa = -1,
        Ja = -1,
        ga = -1,
        Ha = null,
        Xa = null,
        Ta = null,
        za = null,
        hb = 0,
        ib = 0,
        tb = 0,
        ub = 0,
        vb = 0,
        jb = 0,
        Ka = {},
        na = new THREE.Frustum,
        ta = new THREE.Matrix4,
        kb = new THREE.Matrix4,
        ua = new THREE.Vector3,
        ha = new THREE.Vector3,
        wa = !0,
        Sa = {
            ambient: [0, 0, 0],
            directional: {
                length: 0,
                colors: [],
                positions: []
            },
            point: {
                length: 0,
                colors: [],
                positions: [],
                distances: []
            },
            spot: {
                length: 0,
                colors: [],
                positions: [],
                distances: [],
                directions: [],
                anglesCos: [],
                exponents: []
            },
            hemi: {
                length: 0,
                skyColors: [],
                groundColors: [],
                positions: []
            }
        },
        j, Ra, xa, ya, Ia;
    try {
        var Ua = {
            alpha: J,
            premultipliedAlpha: ca,
            antialias: qa,
            stencil: ra,
            preserveDrawingBuffer: N
        };
        j = G.getContext("webgl", Ua) || G.getContext("experimental-webgl", Ua);
        if (null === j) throw "Error creating WebGL context.";
    } catch (pc) {
        console.error(pc)
    }
    Ra = j.getExtension("OES_texture_float");
    j.getExtension("OES_texture_float_linear");
    xa = j.getExtension("OES_standard_derivatives");
    ya = j.getExtension("EXT_texture_filter_anisotropic") || j.getExtension("MOZ_EXT_texture_filter_anisotropic") || j.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    Ia = j.getExtension("WEBGL_compressed_texture_s3tc") || j.getExtension("MOZ_WEBGL_compressed_texture_s3tc") || j.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
    Ra || console.log("THREE.WebGLRenderer: Float textures not supported.");
    xa || console.log("THREE.WebGLRenderer: Standard derivatives not supported.");
    ya || console.log("THREE.WebGLRenderer: Anisotropic texture filtering not supported.");
    Ia || console.log("THREE.WebGLRenderer: S3TC compressed textures not supported.");
    void 0 === j.getShaderPrecisionFormat &&
        (j.getShaderPrecisionFormat = function() {
            return {
                rangeMin: 1,
                rangeMax: 1,
                precision: 1
            }
        });
    j.clearColor(0, 0, 0, 1);
    j.clearDepth(1);
    j.clearStencil(0);
    j.enable(j.DEPTH_TEST);
    j.depthFunc(j.LEQUAL);
    j.frontFace(j.CCW);
    j.cullFace(j.BACK);
    j.enable(j.CULL_FACE);
    j.enable(j.BLEND);
    j.blendEquation(j.FUNC_ADD);
    j.blendFunc(j.SRC_ALPHA, j.ONE_MINUS_SRC_ALPHA);
    j.clearColor(M.r, M.g, M.b, Q);
    this.context = j;
    var Wb = j.getParameter(j.MAX_TEXTURE_IMAGE_UNITS),
        qc = j.getParameter(j.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    j.getParameter(j.MAX_TEXTURE_SIZE);
    var rc = j.getParameter(j.MAX_CUBE_MAP_TEXTURE_SIZE),
        Xb = ya ? j.getParameter(ya.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0,
        Ib = 0 < qc,
        Eb = Ib && Ra;
    Ia && j.getParameter(j.COMPRESSED_TEXTURE_FORMATS);
    var sc = j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.HIGH_FLOAT),
        tc = j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.MEDIUM_FLOAT);
    j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.LOW_FLOAT);
    var uc = j.getShaderPrecisionFormat(j.FRAGMENT_SHADER, j.HIGH_FLOAT),
        vc = j.getShaderPrecisionFormat(j.FRAGMENT_SHADER, j.MEDIUM_FLOAT);
    j.getShaderPrecisionFormat(j.FRAGMENT_SHADER,
        j.LOW_FLOAT);
    j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.HIGH_INT);
    j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.MEDIUM_INT);
    j.getShaderPrecisionFormat(j.VERTEX_SHADER, j.LOW_INT);
    j.getShaderPrecisionFormat(j.FRAGMENT_SHADER, j.HIGH_INT);
    j.getShaderPrecisionFormat(j.FRAGMENT_SHADER, j.MEDIUM_INT);
    j.getShaderPrecisionFormat(j.FRAGMENT_SHADER, j.LOW_INT);
    var wc = 0 < sc.precision && 0 < uc.precision,
        Yb = 0 < tc.precision && 0 < vc.precision;
    "highp" === R && !wc && (Yb ? (R = "mediump", console.warn("WebGLRenderer: highp not supported, using mediump")) :
        (R = "lowp", console.warn("WebGLRenderer: highp and mediump not supported, using lowp")));
    "mediump" === R && !Yb && (R = "lowp", console.warn("WebGLRenderer: mediump not supported, using lowp"));
    this.getContext = function() {
        return j
    };
    this.supportsVertexTextures = function() {
        return Ib
    };
    this.supportsFloatTextures = function() {
        return Ra
    };
    this.supportsStandardDerivatives = function() {
        return xa
    };
    this.supportsCompressedTextureS3TC = function() {
        return Ia
    };
    this.getMaxAnisotropy = function() {
        return Xb
    };
    this.getPrecision = function() {
        return R
    };
    this.setSize = function(a, b, c) {
        G.width = a * this.devicePixelRatio;
        G.height = b * this.devicePixelRatio;
        1 !== this.devicePixelRatio && !1 !== c && (G.style.width = a + "px", G.style.height = b + "px");
        this.setViewport(0, 0, G.width, G.height)
    };
    this.setViewport = function(a, b, c, d) {
        hb = void 0 !== a ? a : 0;
        ib = void 0 !== b ? b : 0;
        tb = void 0 !== c ? c : G.width;
        ub = void 0 !== d ? d : G.height;
        j.viewport(hb, ib, tb, ub)
    };
    this.setScissor = function(a, b, c, d) {
        j.scissor(a, b, c, d)
    };
    this.enableScissorTest = function(a) {
        a ? j.enable(j.SCISSOR_TEST) : j.disable(j.SCISSOR_TEST)
    };
    this.setClearColor = function(a, b) {
        M.set(a);
        Q = void 0 !== b ? b : 1;
        j.clearColor(M.r, M.g, M.b, Q)
    };
    this.setClearColorHex = function(a, b) {
        console.warn("DEPRECATED: .setClearColorHex() is being removed. Use .setClearColor() instead.");
        this.setClearColor(a, b)
    };
    this.getClearColor = function() {
        return M
    };
    this.getClearAlpha = function() {
        return Q
    };
    this.clear = function(a, b, c) {
        var d = 0;
        if (void 0 === a || a) d |= j.COLOR_BUFFER_BIT;
        if (void 0 === b || b) d |= j.DEPTH_BUFFER_BIT;
        if (void 0 === c || c) d |= j.STENCIL_BUFFER_BIT;
        j.clear(d)
    };
    this.clearTarget =
        function(a, b, c, d) {
            this.setRenderTarget(a);
            this.clear(b, c, d)
        };
    this.addPostPlugin = function(a) {
        a.init(this);
        this.renderPluginsPost.push(a)
    };
    this.addPrePlugin = function(a) {
        a.init(this);
        this.renderPluginsPre.push(a)
    };
    this.updateShadowMap = function(a, b) {
        Fa = null;
        Ea = $ = ga = Ja = ma = -1;
        wa = !0;
        T = Y = -1;
        this.shadowMapPlugin.update(a, b)
    };
    var Jb = function(a) {
            a = a.target;
            a.removeEventListener("dispose", Jb);
            a.__webglInit = void 0;
            if (a instanceof THREE.BufferGeometry) {
                var b = a.attributes,
                    c;
                for (c in b) void 0 !== b[c].buffer && j.deleteBuffer(b[c].buffer);
                K.info.memory.geometries--
            } else if (void 0 !== a.geometryGroups)
                for (b in a.geometryGroups) {
                    c = a.geometryGroups[b];
                    if (void 0 !== c.numMorphTargets)
                        for (var d = 0, e = c.numMorphTargets; d < e; d++) j.deleteBuffer(c.__webglMorphTargetsBuffers[d]);
                    if (void 0 !== c.numMorphNormals) {
                        d = 0;
                        for (e = c.numMorphNormals; d < e; d++) j.deleteBuffer(c.__webglMorphNormalsBuffers[d])
                    }
                    Ob(c)
                } else Ob(a)
        },
        Kb = function(a) {
            a = a.target;
            a.removeEventListener("dispose", Kb);
            a.image && a.image.__webglTextureCube ? j.deleteTexture(a.image.__webglTextureCube) :
                a.__webglInit && (a.__webglInit = !1, j.deleteTexture(a.__webglTexture));
            K.info.memory.textures--
        },
        Lb = function(a) {
            a = a.target;
            a.removeEventListener("dispose", Lb);
            if (a && a.__webglTexture)
                if (j.deleteTexture(a.__webglTexture), a instanceof THREE.WebGLRenderTargetCube)
                    for (var b = 0; 6 > b; b++) j.deleteFramebuffer(a.__webglFramebuffer[b]), j.deleteRenderbuffer(a.__webglRenderbuffer[b]);
                else j.deleteFramebuffer(a.__webglFramebuffer), j.deleteRenderbuffer(a.__webglRenderbuffer);
            K.info.memory.textures--
        },
        Mb = function(a) {
            a =
                a.target;
            a.removeEventListener("dispose", Mb);
            Nb(a)
        },
        Ob = function(a) {
            void 0 !== a.__webglVertexBuffer && j.deleteBuffer(a.__webglVertexBuffer);
            void 0 !== a.__webglNormalBuffer && j.deleteBuffer(a.__webglNormalBuffer);
            void 0 !== a.__webglTangentBuffer && j.deleteBuffer(a.__webglTangentBuffer);
            void 0 !== a.__webglColorBuffer && j.deleteBuffer(a.__webglColorBuffer);
            void 0 !== a.__webglUVBuffer && j.deleteBuffer(a.__webglUVBuffer);
            void 0 !== a.__webglUV2Buffer && j.deleteBuffer(a.__webglUV2Buffer);
            void 0 !== a.__webglSkinIndicesBuffer &&
                j.deleteBuffer(a.__webglSkinIndicesBuffer);
            void 0 !== a.__webglSkinWeightsBuffer && j.deleteBuffer(a.__webglSkinWeightsBuffer);
            void 0 !== a.__webglFaceBuffer && j.deleteBuffer(a.__webglFaceBuffer);
            void 0 !== a.__webglLineBuffer && j.deleteBuffer(a.__webglLineBuffer);
            void 0 !== a.__webglLineDistanceBuffer && j.deleteBuffer(a.__webglLineDistanceBuffer);
            if (void 0 !== a.__webglCustomAttributesList)
                for (var b in a.__webglCustomAttributesList) j.deleteBuffer(a.__webglCustomAttributesList[b].buffer);
            K.info.memory.geometries--
        },
        Nb = function(a) {
            var b = a.program;
            if (void 0 !== b) {
                a.program = void 0;
                var c, d, e = !1,
                    a = 0;
                for (c = ea.length; a < c; a++)
                    if (d = ea[a], d.program === b) {
                        d.usedTimes--;
                        0 === d.usedTimes && (e = !0);
                        break
                    }
                if (!0 === e) {
                    e = [];
                    a = 0;
                    for (c = ea.length; a < c; a++) d = ea[a], d.program !== b && e.push(d);
                    ea = e;
                    j.deleteProgram(b);
                    K.info.memory.programs--
                }
            }
        };
    this.renderBufferImmediate = function(a, b, c) {
        a.hasPositions && !a.__webglVertexBuffer && (a.__webglVertexBuffer = j.createBuffer());
        a.hasNormals && !a.__webglNormalBuffer && (a.__webglNormalBuffer = j.createBuffer());
        a.hasUvs && !a.__webglUvBuffer && (a.__webglUvBuffer = j.createBuffer());
        a.hasColors && !a.__webglColorBuffer && (a.__webglColorBuffer = j.createBuffer());
        a.hasPositions && (j.bindBuffer(j.ARRAY_BUFFER, a.__webglVertexBuffer), j.bufferData(j.ARRAY_BUFFER, a.positionArray, j.DYNAMIC_DRAW), j.enableVertexAttribArray(b.attributes.position), j.vertexAttribPointer(b.attributes.position, 3, j.FLOAT, !1, 0, 0));
        if (a.hasNormals) {
            j.bindBuffer(j.ARRAY_BUFFER, a.__webglNormalBuffer);
            if (c.shading === THREE.FlatShading) {
                var d, e, f, g, h, i,
                    k, l, m, n, p, q = 3 * a.count;
                for (p = 0; p < q; p += 9) n = a.normalArray, d = n[p], e = n[p + 1], f = n[p + 2], g = n[p + 3], i = n[p + 4], l = n[p + 5], h = n[p + 6], k = n[p + 7], m = n[p + 8], d = (d + g + h) / 3, e = (e + i + k) / 3, f = (f + l + m) / 3, n[p] = d, n[p + 1] = e, n[p + 2] = f, n[p + 3] = d, n[p + 4] = e, n[p + 5] = f, n[p + 6] = d, n[p + 7] = e, n[p + 8] = f
            }
            j.bufferData(j.ARRAY_BUFFER, a.normalArray, j.DYNAMIC_DRAW);
            j.enableVertexAttribArray(b.attributes.normal);
            j.vertexAttribPointer(b.attributes.normal, 3, j.FLOAT, !1, 0, 0)
        }
        a.hasUvs && c.map && (j.bindBuffer(j.ARRAY_BUFFER, a.__webglUvBuffer), j.bufferData(j.ARRAY_BUFFER,
            a.uvArray, j.DYNAMIC_DRAW), j.enableVertexAttribArray(b.attributes.uv), j.vertexAttribPointer(b.attributes.uv, 2, j.FLOAT, !1, 0, 0));
        a.hasColors && c.vertexColors !== THREE.NoColors && (j.bindBuffer(j.ARRAY_BUFFER, a.__webglColorBuffer), j.bufferData(j.ARRAY_BUFFER, a.colorArray, j.DYNAMIC_DRAW), j.enableVertexAttribArray(b.attributes.color), j.vertexAttribPointer(b.attributes.color, 3, j.FLOAT, !1, 0, 0));
        j.drawArrays(j.TRIANGLES, 0, a.count);
        a.count = 0
    };
    this.renderBufferDirect = function(a, b, c, d, e, f) {
        if (!1 !== d.visible) {
            var i,
                k, l, m;
            i = E(a, b, c, d, f);
            b = i.attributes;
            a = e.attributes;
            c = !1;
            i = 16777215 * e.id + 2 * i.id + (d.wireframe ? 1 : 0);
            i !== $ && ($ = i, c = !0);
            c && g();
            if (f instanceof THREE.Mesh)
                if (f = a.index) {
                    e = e.offsets;
                    1 < e.length && (c = !0);
                    for (var n = 0, p = e.length; n < p; n++) {
                        var q = e[n].index;
                        if (c) {
                            for (k in b) l = b[k], i = a[k], 0 <= l && (i ? (m = i.itemSize, j.bindBuffer(j.ARRAY_BUFFER, i.buffer), h(l), j.vertexAttribPointer(l, m, j.FLOAT, !1, 0, 4 * q * m)) : d.defaultAttributeValues && (2 === d.defaultAttributeValues[k].length ? j.vertexAttrib2fv(l, d.defaultAttributeValues[k]) :
                                3 === d.defaultAttributeValues[k].length && j.vertexAttrib3fv(l, d.defaultAttributeValues[k])));
                            j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, f.buffer)
                        }
                        j.drawElements(j.TRIANGLES, e[n].count, j.UNSIGNED_SHORT, 2 * e[n].start);
                        K.info.render.calls++;
                        K.info.render.vertices += e[n].count;
                        K.info.render.faces += e[n].count / 3
                    }
                } else {
                    if (c)
                        for (k in b) "index" !== k && (l = b[k], i = a[k], 0 <= l && (i ? (m = i.itemSize, j.bindBuffer(j.ARRAY_BUFFER, i.buffer), h(l), j.vertexAttribPointer(l, m, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && d.defaultAttributeValues[k] &&
                            (2 === d.defaultAttributeValues[k].length ? j.vertexAttrib2fv(l, d.defaultAttributeValues[k]) : 3 === d.defaultAttributeValues[k].length && j.vertexAttrib3fv(l, d.defaultAttributeValues[k]))));
                    d = e.attributes.position;
                    j.drawArrays(j.TRIANGLES, 0, d.numItems / 3);
                    K.info.render.calls++;
                    K.info.render.vertices += d.numItems / 3;
                    K.info.render.faces += d.numItems / 3 / 3
                } else if (f instanceof THREE.ParticleSystem) {
                if (c) {
                    for (k in b) l = b[k], i = a[k], 0 <= l && (i ? (m = i.itemSize, j.bindBuffer(j.ARRAY_BUFFER, i.buffer), h(l), j.vertexAttribPointer(l,
                        m, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && d.defaultAttributeValues[k] && (2 === d.defaultAttributeValues[k].length ? j.vertexAttrib2fv(l, d.defaultAttributeValues[k]) : 3 === d.defaultAttributeValues[k].length && j.vertexAttrib3fv(l, d.defaultAttributeValues[k])));
                    d = a.position;
                    j.drawArrays(j.POINTS, 0, d.numItems / 3);
                    K.info.render.calls++;
                    K.info.render.points += d.numItems / 3
                }
            } else if (f instanceof THREE.Line && c) {
                for (k in b) l = b[k], i = a[k], 0 <= l && (i ? (m = i.itemSize, j.bindBuffer(j.ARRAY_BUFFER, i.buffer), h(l), j.vertexAttribPointer(l,
                    m, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && d.defaultAttributeValues[k] && (2 === d.defaultAttributeValues[k].length ? j.vertexAttrib2fv(l, d.defaultAttributeValues[k]) : 3 === d.defaultAttributeValues[k].length && j.vertexAttrib3fv(l, d.defaultAttributeValues[k])));
                k = f.type === THREE.LineStrip ? j.LINE_STRIP : j.LINES;
                x(d.linewidth);
                d = a.position;
                j.drawArrays(k, 0, d.numItems / 3);
                K.info.render.calls++;
                K.info.render.points += d.numItems
            }
        }
    };
    this.renderBuffer = function(a, b, c, d, e, f) {
        if (!1 !== d.visible) {
            var i, l, c = E(a, b, c, d, f),
                a = c.attributes,
                b = !1,
                c = 16777215 * e.id + 2 * c.id + (d.wireframe ? 1 : 0);
            c !== $ && ($ = c, b = !0);
            b && g();
            if (!d.morphTargets && 0 <= a.position) b && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglVertexBuffer), h(a.position), j.vertexAttribPointer(a.position, 3, j.FLOAT, !1, 0, 0));
            else if (f.morphTargetBase) {
                c = d.program.attributes; - 1 !== f.morphTargetBase && 0 <= c.position ? (j.bindBuffer(j.ARRAY_BUFFER, e.__webglMorphTargetsBuffers[f.morphTargetBase]), h(c.position), j.vertexAttribPointer(c.position, 3, j.FLOAT, !1, 0, 0)) : 0 <= c.position && (j.bindBuffer(j.ARRAY_BUFFER,
                    e.__webglVertexBuffer), h(c.position), j.vertexAttribPointer(c.position, 3, j.FLOAT, !1, 0, 0));
                if (f.morphTargetForcedOrder.length) {
                    var m = 0;
                    l = f.morphTargetForcedOrder;
                    for (i = f.morphTargetInfluences; m < d.numSupportedMorphTargets && m < l.length;) 0 <= c["morphTarget" + m] && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglMorphTargetsBuffers[l[m]]), h(c["morphTarget" + m]), j.vertexAttribPointer(c["morphTarget" + m], 3, j.FLOAT, !1, 0, 0)), 0 <= c["morphNormal" + m] && d.morphNormals && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglMorphNormalsBuffers[l[m]]),
                        h(c["morphNormal" + m]), j.vertexAttribPointer(c["morphNormal" + m], 3, j.FLOAT, !1, 0, 0)), f.__webglMorphTargetInfluences[m] = i[l[m]], m++
                } else {
                    l = [];
                    i = f.morphTargetInfluences;
                    var n, p = i.length;
                    for (n = 0; n < p; n++) m = i[n], 0 < m && l.push([m, n]);
                    l.length > d.numSupportedMorphTargets ? (l.sort(k), l.length = d.numSupportedMorphTargets) : l.length > d.numSupportedMorphNormals ? l.sort(k) : 0 === l.length && l.push([0, 0]);
                    for (m = 0; m < d.numSupportedMorphTargets;) l[m] ? (n = l[m][1], 0 <= c["morphTarget" + m] && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglMorphTargetsBuffers[n]),
                        h(c["morphTarget" + m]), j.vertexAttribPointer(c["morphTarget" + m], 3, j.FLOAT, !1, 0, 0)), 0 <= c["morphNormal" + m] && d.morphNormals && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglMorphNormalsBuffers[n]), h(c["morphNormal" + m]), j.vertexAttribPointer(c["morphNormal" + m], 3, j.FLOAT, !1, 0, 0)), f.__webglMorphTargetInfluences[m] = i[n]) : f.__webglMorphTargetInfluences[m] = 0, m++
                }
                null !== d.program.uniforms.morphTargetInfluences && j.uniform1fv(d.program.uniforms.morphTargetInfluences, f.__webglMorphTargetInfluences)
            }
            if (b) {
                if (e.__webglCustomAttributesList) {
                    i =
                        0;
                    for (l = e.__webglCustomAttributesList.length; i < l; i++) c = e.__webglCustomAttributesList[i], 0 <= a[c.buffer.belongsToAttribute] && (j.bindBuffer(j.ARRAY_BUFFER, c.buffer), h(a[c.buffer.belongsToAttribute]), j.vertexAttribPointer(a[c.buffer.belongsToAttribute], c.size, j.FLOAT, !1, 0, 0))
                }
                0 <= a.color && (0 < f.geometry.colors.length || 0 < f.geometry.faces.length ? (j.bindBuffer(j.ARRAY_BUFFER, e.__webglColorBuffer), h(a.color), j.vertexAttribPointer(a.color, 3, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && j.vertexAttrib3fv(a.color,
                    d.defaultAttributeValues.color));
                0 <= a.normal && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglNormalBuffer), h(a.normal), j.vertexAttribPointer(a.normal, 3, j.FLOAT, !1, 0, 0));
                0 <= a.tangent && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglTangentBuffer), h(a.tangent), j.vertexAttribPointer(a.tangent, 4, j.FLOAT, !1, 0, 0));
                0 <= a.uv && (f.geometry.faceVertexUvs[0] ? (j.bindBuffer(j.ARRAY_BUFFER, e.__webglUVBuffer), h(a.uv), j.vertexAttribPointer(a.uv, 2, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && j.vertexAttrib2fv(a.uv, d.defaultAttributeValues.uv));
                0 <= a.uv2 && (f.geometry.faceVertexUvs[1] ? (j.bindBuffer(j.ARRAY_BUFFER, e.__webglUV2Buffer), h(a.uv2), j.vertexAttribPointer(a.uv2, 2, j.FLOAT, !1, 0, 0)) : d.defaultAttributeValues && j.vertexAttrib2fv(a.uv2, d.defaultAttributeValues.uv2));
                d.skinning && (0 <= a.skinIndex && 0 <= a.skinWeight) && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglSkinIndicesBuffer), h(a.skinIndex), j.vertexAttribPointer(a.skinIndex, 4, j.FLOAT, !1, 0, 0), j.bindBuffer(j.ARRAY_BUFFER, e.__webglSkinWeightsBuffer), h(a.skinWeight), j.vertexAttribPointer(a.skinWeight,
                    4, j.FLOAT, !1, 0, 0));
                0 <= a.lineDistance && (j.bindBuffer(j.ARRAY_BUFFER, e.__webglLineDistanceBuffer), h(a.lineDistance), j.vertexAttribPointer(a.lineDistance, 1, j.FLOAT, !1, 0, 0))
            }
            f instanceof THREE.Mesh ? (d.wireframe ? (x(d.wireframeLinewidth), b && j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, e.__webglLineBuffer), j.drawElements(j.LINES, e.__webglLineCount, j.UNSIGNED_SHORT, 0)) : (b && j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, e.__webglFaceBuffer), j.drawElements(j.TRIANGLES, e.__webglFaceCount, j.UNSIGNED_SHORT, 0)), K.info.render.calls++,
                K.info.render.vertices += e.__webglFaceCount, K.info.render.faces += e.__webglFaceCount / 3) : f instanceof THREE.Line ? (f = f.type === THREE.LineStrip ? j.LINE_STRIP : j.LINES, x(d.linewidth), j.drawArrays(f, 0, e.__webglLineCount), K.info.render.calls++) : f instanceof THREE.ParticleSystem ? (j.drawArrays(j.POINTS, 0, e.__webglParticleCount), K.info.render.calls++, K.info.render.points += e.__webglParticleCount) : f instanceof THREE.Ribbon && (j.drawArrays(j.TRIANGLE_STRIP, 0, e.__webglVertexCount), K.info.render.calls++)
        }
    };
    this.render =
        function(a, b, c, d) {
            if (!1 === b instanceof THREE.Camera) console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");
            else {
                var e, f, g, h, k = a.__lights,
                    p = a.fog;
                Ea = -1;
                wa = !0;
                !0 === a.autoUpdate && a.updateMatrixWorld();
                void 0 === b.parent && b.updateMatrixWorld();
                b.matrixWorldInverse.getInverse(b.matrixWorld);
                ta.multiplyMatrices(b.projectionMatrix, b.matrixWorldInverse);
                na.setFromMatrix(ta);
                this.autoUpdateObjects && this.initWebGLObjects(a);
                m(this.renderPluginsPre, a, b);
                K.info.render.calls = 0;
                K.info.render.vertices = 0;
                K.info.render.faces = 0;
                K.info.render.points = 0;
                this.setRenderTarget(c);
                (this.autoClear || d) && this.clear(this.autoClearColor, this.autoClearDepth, this.autoClearStencil);
                h = a.__webglObjects;
                d = 0;
                for (e = h.length; d < e; d++)
                    if (f = h[d], g = f.object, f.id = d, f.render = !1, g.visible && (!(g instanceof THREE.Mesh || g instanceof THREE.ParticleSystem) || !g.frustumCulled || na.intersectsObject(g))) {
                        var q = g;
                        q._modelViewMatrix.multiplyMatrices(b.matrixWorldInverse, q.matrixWorld);
                        q._normalMatrix.getNormalMatrix(q._modelViewMatrix);
                        var q = f,
                            t = q.buffer,
                            r = void 0,
                            s = r = void 0,
                            s = q.object.material;
                        if (s instanceof THREE.MeshFaceMaterial) r = t.materialIndex, r = s.materials[r], r.transparent ? (q.transparent = r, q.opaque = null) : (q.opaque = r, q.transparent = null);
                        else if (r = s) r.transparent ? (q.transparent = r, q.opaque = null) : (q.opaque = r, q.transparent = null);
                        f.render = !0;
                        !0 === this.sortObjects && (null !== g.renderDepth ? f.z = g.renderDepth : (ua.getPositionFromMatrix(g.matrixWorld), ua.applyProjection(ta), f.z = ua.z))
                    }
                this.sortObjects && h.sort(i);
                h = a.__webglObjectsImmediate;
                d = 0;
                for (e = h.length; d < e; d++) f = h[d], g = f.object, g.visible && (g._modelViewMatrix.multiplyMatrices(b.matrixWorldInverse, g.matrixWorld), g._normalMatrix.getNormalMatrix(g._modelViewMatrix), g = f.object.material, g.transparent ? (f.transparent = g, f.opaque = null) : (f.opaque = g, f.transparent = null));
                a.overrideMaterial ? (d = a.overrideMaterial, this.setBlending(d.blending, d.blendEquation, d.blendSrc, d.blendDst), this.setDepthTest(d.depthTest), this.setDepthWrite(d.depthWrite), z(d.polygonOffset, d.polygonOffsetFactor, d.polygonOffsetUnits),
                    l(a.__webglObjects, !1, "", b, k, p, !0, d), n(a.__webglObjectsImmediate, "", b, k, p, !1, d)) : (d = null, this.setBlending(THREE.NoBlending), l(a.__webglObjects, !0, "opaque", b, k, p, !1, d), n(a.__webglObjectsImmediate, "opaque", b, k, p, !1, d), l(a.__webglObjects, !1, "transparent", b, k, p, !0, d), n(a.__webglObjectsImmediate, "transparent", b, k, p, !0, d));
                m(this.renderPluginsPost, a, b);
                c && (c.generateMipmaps && c.minFilter !== THREE.NearestFilter && c.minFilter !== THREE.LinearFilter) && (c instanceof THREE.WebGLRenderTargetCube ? (j.bindTexture(j.TEXTURE_CUBE_MAP,
                    c.__webglTexture), j.generateMipmap(j.TEXTURE_CUBE_MAP), j.bindTexture(j.TEXTURE_CUBE_MAP, null)) : (j.bindTexture(j.TEXTURE_2D, c.__webglTexture), j.generateMipmap(j.TEXTURE_2D), j.bindTexture(j.TEXTURE_2D, null)));
                this.setDepthTest(!0);
                this.setDepthWrite(!0)
            }
        };
    this.renderImmediateObject = function(a, b, c, d, e) {
        var f = E(a, b, c, d, e);
        $ = -1;
        K.setMaterialFaces(d);
        e.immediateRenderCallback ? e.immediateRenderCallback(f, j, na) : e.render(function(a) {
            K.renderBufferImmediate(a, f, d)
        })
    };
    this.initWebGLObjects = function(a) {
        a.__webglObjects ||
            (a.__webglObjects = [], a.__webglObjectsImmediate = [], a.__webglSprites = [], a.__webglFlares = []);
        for (; a.__objectsAdded.length;) t(a.__objectsAdded[0], a), a.__objectsAdded.splice(0, 1);
        for (; a.__objectsRemoved.length;) s(a.__objectsRemoved[0], a), a.__objectsRemoved.splice(0, 1);
        for (var b = 0, g = a.__webglObjects.length; b < g; b++) {
            var h = a.__webglObjects[b].object;
            void 0 === h.__webglInit && (void 0 !== h.__webglActive && s(h, a), t(h, a));
            var i = h,
                l = i.geometry,
                m = void 0,
                n = void 0,
                q = void 0;
            if (l instanceof THREE.BufferGeometry) {
                var u =
                    j.DYNAMIC_DRAW,
                    w = !l.dynamic,
                    v = l.attributes,
                    z = void 0,
                    y = void 0;
                for (z in v) y = v[z], y.needsUpdate && ("index" === z ? (j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, y.buffer), j.bufferData(j.ELEMENT_ARRAY_BUFFER, y.array, u)) : (j.bindBuffer(j.ARRAY_BUFFER, y.buffer), j.bufferData(j.ARRAY_BUFFER, y.array, u)), y.needsUpdate = !1), w && !y.dynamic && (y.array = null)
            } else if (i instanceof THREE.Mesh) {
                for (var E = 0, A = l.geometryGroupsList.length; E < A; E++)
                    if (m = l.geometryGroupsList[E], q = d(i, m), l.buffersNeedUpdate && c(m, i), n = q.attributes && p(q), l.verticesNeedUpdate ||
                        l.morphTargetsNeedUpdate || l.elementsNeedUpdate || l.uvsNeedUpdate || l.normalsNeedUpdate || l.colorsNeedUpdate || l.tangentsNeedUpdate || n) {
                        var x = m,
                            B = i,
                            D = j.DYNAMIC_DRAW,
                            F = !l.dynamic,
                            G = q;
                        if (x.__inittedArrays) {
                            var J = e(G),
                                K = G.vertexColors ? G.vertexColors : !1,
                                N = f(G),
                                O = J === THREE.SmoothShading,
                                C = void 0,
                                I = void 0,
                                V = void 0,
                                M = void 0,
                                R = void 0,
                                Q = void 0,
                                T = void 0,
                                ba = void 0,
                                Y = void 0,
                                Da = void 0,
                                $ = void 0,
                                P = void 0,
                                X = void 0,
                                W = void 0,
                                Fa = void 0,
                                fa = void 0,
                                Ea = void 0,
                                ca = void 0,
                                ea = void 0,
                                ja = void 0,
                                ga = void 0,
                                ha = void 0,
                                ma = void 0,
                                na = void 0,
                                qa = void 0,
                                ra = void 0,
                                va = void 0,
                                wa = void 0,
                                xa = void 0,
                                Ga = void 0,
                                Ha = void 0,
                                Ja = void 0,
                                Ia = void 0,
                                Pa = void 0,
                                Va = void 0,
                                Ka = void 0,
                                ya = void 0,
                                za = void 0,
                                Ta = void 0,
                                Ua = void 0,
                                fb = 0,
                                gb = 0,
                                Ra = 0,
                                Sa = 0,
                                Xa = 0,
                                lb = 0,
                                Wa = 0,
                                yb = 0,
                                cb = 0,
                                sa = 0,
                                Aa = 0,
                                L = 0,
                                Qa = void 0,
                                mb = x.__vertexArray,
                                hb = x.__uvArray,
                                ib = x.__uv2Array,
                                Ab = x.__normalArray,
                                Ya = x.__tangentArray,
                                nb = x.__colorArray,
                                Za = x.__skinIndexArray,
                                $a = x.__skinWeightArray,
                                tb = x.__morphTargetsArrays,
                                ub = x.__morphNormalsArrays,
                                vb = x.__webglCustomAttributesList,
                                H = void 0,
                                jb = x.__faceArray,
                                Bb = x.__lineArray,
                                La = B.geometry,
                                Ib = La.elementsNeedUpdate,
                                Eb = La.uvsNeedUpdate,
                                Kb = La.normalsNeedUpdate,
                                Wb = La.tangentsNeedUpdate,
                                Xb = La.colorsNeedUpdate,
                                Yb = La.morphTargetsNeedUpdate,
                                yc = La.vertices,
                                aa = x.faces3,
                                ob = La.faces,
                                Jb = La.faceVertexUvs[0],
                                Lb = La.faceVertexUvs[1],
                                zc = La.skinIndices,
                                Zb = La.skinWeights,
                                $b = La.morphTargets,
                                Mb = La.morphNormals;
                            if (La.verticesNeedUpdate) {
                                C = 0;
                                for (I = aa.length; C < I; C++) M = ob[aa[C]], P = yc[M.a], X = yc[M.b], W = yc[M.c], mb[gb] = P.x, mb[gb + 1] = P.y, mb[gb + 2] = P.z, mb[gb + 3] = X.x, mb[gb + 4] = X.y, mb[gb + 5] = X.z, mb[gb + 6] = W.x,
                                    mb[gb + 7] = W.y, mb[gb + 8] = W.z, gb += 9;
                                j.bindBuffer(j.ARRAY_BUFFER, x.__webglVertexBuffer);
                                j.bufferData(j.ARRAY_BUFFER, mb, D)
                            }
                            if (Yb) {
                                Va = 0;
                                for (Ka = $b.length; Va < Ka; Va++) {
                                    C = Aa = 0;
                                    for (I = aa.length; C < I; C++) Ta = aa[C], M = ob[Ta], P = $b[Va].vertices[M.a], X = $b[Va].vertices[M.b], W = $b[Va].vertices[M.c], ya = tb[Va], ya[Aa] = P.x, ya[Aa + 1] = P.y, ya[Aa + 2] = P.z, ya[Aa + 3] = X.x, ya[Aa + 4] = X.y, ya[Aa + 5] = X.z, ya[Aa + 6] = W.x, ya[Aa + 7] = W.y, ya[Aa + 8] = W.z, G.morphNormals && (O ? (Ua = Mb[Va].vertexNormals[Ta], ca = Ua.a, ea = Ua.b, ja = Ua.c) : ja = ea = ca = Mb[Va].faceNormals[Ta],
                                        za = ub[Va], za[Aa] = ca.x, za[Aa + 1] = ca.y, za[Aa + 2] = ca.z, za[Aa + 3] = ea.x, za[Aa + 4] = ea.y, za[Aa + 5] = ea.z, za[Aa + 6] = ja.x, za[Aa + 7] = ja.y, za[Aa + 8] = ja.z), Aa += 9;
                                    j.bindBuffer(j.ARRAY_BUFFER, x.__webglMorphTargetsBuffers[Va]);
                                    j.bufferData(j.ARRAY_BUFFER, tb[Va], D);
                                    G.morphNormals && (j.bindBuffer(j.ARRAY_BUFFER, x.__webglMorphNormalsBuffers[Va]), j.bufferData(j.ARRAY_BUFFER, ub[Va], D))
                                }
                            }
                            if (Zb.length) {
                                C = 0;
                                for (I = aa.length; C < I; C++) M = ob[aa[C]], na = Zb[M.a], qa = Zb[M.b], ra = Zb[M.c], $a[sa] = na.x, $a[sa + 1] = na.y, $a[sa + 2] = na.z, $a[sa + 3] = na.w,
                                    $a[sa + 4] = qa.x, $a[sa + 5] = qa.y, $a[sa + 6] = qa.z, $a[sa + 7] = qa.w, $a[sa + 8] = ra.x, $a[sa + 9] = ra.y, $a[sa + 10] = ra.z, $a[sa + 11] = ra.w, va = zc[M.a], wa = zc[M.b], xa = zc[M.c], Za[sa] = va.x, Za[sa + 1] = va.y, Za[sa + 2] = va.z, Za[sa + 3] = va.w, Za[sa + 4] = wa.x, Za[sa + 5] = wa.y, Za[sa + 6] = wa.z, Za[sa + 7] = wa.w, Za[sa + 8] = xa.x, Za[sa + 9] = xa.y, Za[sa + 10] = xa.z, Za[sa + 11] = xa.w, sa += 12;
                                0 < sa && (j.bindBuffer(j.ARRAY_BUFFER, x.__webglSkinIndicesBuffer), j.bufferData(j.ARRAY_BUFFER, Za, D), j.bindBuffer(j.ARRAY_BUFFER, x.__webglSkinWeightsBuffer), j.bufferData(j.ARRAY_BUFFER,
                                    $a, D))
                            }
                            if (Xb && K) {
                                C = 0;
                                for (I = aa.length; C < I; C++) M = ob[aa[C]], T = M.vertexColors, ba = M.color, 3 === T.length && K === THREE.VertexColors ? (ga = T[0], ha = T[1], ma = T[2]) : ma = ha = ga = ba, nb[cb] = ga.r, nb[cb + 1] = ga.g, nb[cb + 2] = ga.b, nb[cb + 3] = ha.r, nb[cb + 4] = ha.g, nb[cb + 5] = ha.b, nb[cb + 6] = ma.r, nb[cb + 7] = ma.g, nb[cb + 8] = ma.b, cb += 9;
                                0 < cb && (j.bindBuffer(j.ARRAY_BUFFER, x.__webglColorBuffer), j.bufferData(j.ARRAY_BUFFER, nb, D))
                            }
                            if (Wb && La.hasTangents) {
                                C = 0;
                                for (I = aa.length; C < I; C++) M = ob[aa[C]], Y = M.vertexTangents, Fa = Y[0], fa = Y[1], Ea = Y[2], Ya[Wa] = Fa.x, Ya[Wa +
                                    1] = Fa.y, Ya[Wa + 2] = Fa.z, Ya[Wa + 3] = Fa.w, Ya[Wa + 4] = fa.x, Ya[Wa + 5] = fa.y, Ya[Wa + 6] = fa.z, Ya[Wa + 7] = fa.w, Ya[Wa + 8] = Ea.x, Ya[Wa + 9] = Ea.y, Ya[Wa + 10] = Ea.z, Ya[Wa + 11] = Ea.w, Wa += 12;
                                j.bindBuffer(j.ARRAY_BUFFER, x.__webglTangentBuffer);
                                j.bufferData(j.ARRAY_BUFFER, Ya, D)
                            }
                            if (Kb && J) {
                                C = 0;
                                for (I = aa.length; C < I; C++)
                                    if (M = ob[aa[C]], R = M.vertexNormals, Q = M.normal, 3 === R.length && O)
                                        for (Ga = 0; 3 > Ga; Ga++) Ja = R[Ga], Ab[lb] = Ja.x, Ab[lb + 1] = Ja.y, Ab[lb + 2] = Ja.z, lb += 3;
                                    else
                                        for (Ga = 0; 3 > Ga; Ga++) Ab[lb] = Q.x, Ab[lb + 1] = Q.y, Ab[lb + 2] = Q.z, lb += 3;
                                j.bindBuffer(j.ARRAY_BUFFER,
                                    x.__webglNormalBuffer);
                                j.bufferData(j.ARRAY_BUFFER, Ab, D)
                            }
                            if (Eb && Jb && N) {
                                C = 0;
                                for (I = aa.length; C < I; C++)
                                    if (V = aa[C], Da = Jb[V], void 0 !== Da)
                                        for (Ga = 0; 3 > Ga; Ga++) Ia = Da[Ga], hb[Ra] = Ia.x, hb[Ra + 1] = Ia.y, Ra += 2;
                                0 < Ra && (j.bindBuffer(j.ARRAY_BUFFER, x.__webglUVBuffer), j.bufferData(j.ARRAY_BUFFER, hb, D))
                            }
                            if (Eb && Lb && N) {
                                C = 0;
                                for (I = aa.length; C < I; C++)
                                    if (V = aa[C], $ = Lb[V], void 0 !== $)
                                        for (Ga = 0; 3 > Ga; Ga++) Pa = $[Ga], ib[Sa] = Pa.x, ib[Sa + 1] = Pa.y, Sa += 2;
                                0 < Sa && (j.bindBuffer(j.ARRAY_BUFFER, x.__webglUV2Buffer), j.bufferData(j.ARRAY_BUFFER, ib, D))
                            }
                            if (Ib) {
                                C =
                                    0;
                                for (I = aa.length; C < I; C++) jb[Xa] = fb, jb[Xa + 1] = fb + 1, jb[Xa + 2] = fb + 2, Xa += 3, Bb[yb] = fb, Bb[yb + 1] = fb + 1, Bb[yb + 2] = fb, Bb[yb + 3] = fb + 2, Bb[yb + 4] = fb + 1, Bb[yb + 5] = fb + 2, yb += 6, fb += 3;
                                j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, x.__webglFaceBuffer);
                                j.bufferData(j.ELEMENT_ARRAY_BUFFER, jb, D);
                                j.bindBuffer(j.ELEMENT_ARRAY_BUFFER, x.__webglLineBuffer);
                                j.bufferData(j.ELEMENT_ARRAY_BUFFER, Bb, D)
                            }
                            if (vb) {
                                Ga = 0;
                                for (Ha = vb.length; Ga < Ha; Ga++)
                                    if (H = vb[Ga], H.__original.needsUpdate) {
                                        L = 0;
                                        if (1 === H.size)
                                            if (void 0 === H.boundTo || "vertices" === H.boundTo) {
                                                C =
                                                    0;
                                                for (I = aa.length; C < I; C++) M = ob[aa[C]], H.array[L] = H.value[M.a], H.array[L + 1] = H.value[M.b], H.array[L + 2] = H.value[M.c], L += 3
                                            } else {
                                                if ("faces" === H.boundTo) {
                                                    C = 0;
                                                    for (I = aa.length; C < I; C++) Qa = H.value[aa[C]], H.array[L] = Qa, H.array[L + 1] = Qa, H.array[L + 2] = Qa, L += 3
                                                }
                                            } else if (2 === H.size)
                                            if (void 0 === H.boundTo || "vertices" === H.boundTo) {
                                                C = 0;
                                                for (I = aa.length; C < I; C++) M = ob[aa[C]], P = H.value[M.a], X = H.value[M.b], W = H.value[M.c], H.array[L] = P.x, H.array[L + 1] = P.y, H.array[L + 2] = X.x, H.array[L + 3] = X.y, H.array[L + 4] = W.x, H.array[L + 5] = W.y, L += 6
                                            } else {
                                                if ("faces" ===
                                                    H.boundTo) {
                                                    C = 0;
                                                    for (I = aa.length; C < I; C++) W = X = P = Qa = H.value[aa[C]], H.array[L] = P.x, H.array[L + 1] = P.y, H.array[L + 2] = X.x, H.array[L + 3] = X.y, H.array[L + 4] = W.x, H.array[L + 5] = W.y, L += 6
                                                }
                                            } else if (3 === H.size) {
                                            var pa;
                                            pa = "c" === H.type ? ["r", "g", "b"] : ["x", "y", "z"];
                                            if (void 0 === H.boundTo || "vertices" === H.boundTo) {
                                                C = 0;
                                                for (I = aa.length; C < I; C++) M = ob[aa[C]], P = H.value[M.a], X = H.value[M.b], W = H.value[M.c], H.array[L] = P[pa[0]], H.array[L + 1] = P[pa[1]], H.array[L + 2] = P[pa[2]], H.array[L + 3] = X[pa[0]], H.array[L + 4] = X[pa[1]], H.array[L + 5] = X[pa[2]],
                                                    H.array[L + 6] = W[pa[0]], H.array[L + 7] = W[pa[1]], H.array[L + 8] = W[pa[2]], L += 9
                                            } else if ("faces" === H.boundTo) {
                                                C = 0;
                                                for (I = aa.length; C < I; C++) W = X = P = Qa = H.value[aa[C]], H.array[L] = P[pa[0]], H.array[L + 1] = P[pa[1]], H.array[L + 2] = P[pa[2]], H.array[L + 3] = X[pa[0]], H.array[L + 4] = X[pa[1]], H.array[L + 5] = X[pa[2]], H.array[L + 6] = W[pa[0]], H.array[L + 7] = W[pa[1]], H.array[L + 8] = W[pa[2]], L += 9
                                            } else if ("faceVertices" === H.boundTo) {
                                                C = 0;
                                                for (I = aa.length; C < I; C++) Qa = H.value[aa[C]], P = Qa[0], X = Qa[1], W = Qa[2], H.array[L] = P[pa[0]], H.array[L + 1] = P[pa[1]],
                                                    H.array[L + 2] = P[pa[2]], H.array[L + 3] = X[pa[0]], H.array[L + 4] = X[pa[1]], H.array[L + 5] = X[pa[2]], H.array[L + 6] = W[pa[0]], H.array[L + 7] = W[pa[1]], H.array[L + 8] = W[pa[2]], L += 9
                                            }
                                        } else if (4 === H.size)
                                            if (void 0 === H.boundTo || "vertices" === H.boundTo) {
                                                C = 0;
                                                for (I = aa.length; C < I; C++) M = ob[aa[C]], P = H.value[M.a], X = H.value[M.b], W = H.value[M.c], H.array[L] = P.x, H.array[L + 1] = P.y, H.array[L + 2] = P.z, H.array[L + 3] = P.w, H.array[L + 4] = X.x, H.array[L + 5] = X.y, H.array[L + 6] = X.z, H.array[L + 7] = X.w, H.array[L + 8] = W.x, H.array[L + 9] = W.y, H.array[L + 10] = W.z, H.array[L +
                                                    11] = W.w, L += 12
                                            } else if ("faces" === H.boundTo) {
                                            C = 0;
                                            for (I = aa.length; C < I; C++) W = X = P = Qa = H.value[aa[C]], H.array[L] = P.x, H.array[L + 1] = P.y, H.array[L + 2] = P.z, H.array[L + 3] = P.w, H.array[L + 4] = X.x, H.array[L + 5] = X.y, H.array[L + 6] = X.z, H.array[L + 7] = X.w, H.array[L + 8] = W.x, H.array[L + 9] = W.y, H.array[L + 10] = W.z, H.array[L + 11] = W.w, L += 12
                                        } else if ("faceVertices" === H.boundTo) {
                                            C = 0;
                                            for (I = aa.length; C < I; C++) Qa = H.value[aa[C]], P = Qa[0], X = Qa[1], W = Qa[2], H.array[L] = P.x, H.array[L + 1] = P.y, H.array[L + 2] = P.z, H.array[L + 3] = P.w, H.array[L + 4] = X.x, H.array[L +
                                                5] = X.y, H.array[L + 6] = X.z, H.array[L + 7] = X.w, H.array[L + 8] = W.x, H.array[L + 9] = W.y, H.array[L + 10] = W.z, H.array[L + 11] = W.w, L += 12
                                        }
                                        j.bindBuffer(j.ARRAY_BUFFER, H.buffer);
                                        j.bufferData(j.ARRAY_BUFFER, H.array, D)
                                    }
                            }
                            F && (delete x.__inittedArrays, delete x.__colorArray, delete x.__normalArray, delete x.__tangentArray, delete x.__uvArray, delete x.__uv2Array, delete x.__faceArray, delete x.__vertexArray, delete x.__lineArray, delete x.__skinIndexArray, delete x.__skinWeightArray)
                        }
                    }
                l.verticesNeedUpdate = !1;
                l.morphTargetsNeedUpdate = !1;
                l.elementsNeedUpdate = !1;
                l.uvsNeedUpdate = !1;
                l.normalsNeedUpdate = !1;
                l.colorsNeedUpdate = !1;
                l.tangentsNeedUpdate = !1;
                l.buffersNeedUpdate = !1;
                q.attributes && r(q)
            } else if (i instanceof THREE.Ribbon) {
                q = d(i, l);
                n = q.attributes && p(q);
                if (l.verticesNeedUpdate || l.colorsNeedUpdate || l.normalsNeedUpdate || n) {
                    var ab = l,
                        ac = j.DYNAMIC_DRAW,
                        Pb = void 0,
                        Qb = void 0,
                        Rb = void 0,
                        bc = void 0,
                        da = void 0,
                        cc = void 0,
                        dc = void 0,
                        ec = void 0,
                        Nb = void 0,
                        Ba = void 0,
                        Fb = void 0,
                        ka = void 0,
                        Ma = void 0,
                        Ob = ab.vertices,
                        Fc = ab.colors,
                        Gc = ab.normals,
                        pc = Ob.length,
                        qc = Fc.length,
                        rc = Gc.length,
                        fc = ab.__vertexArray,
                        gc = ab.__colorArray,
                        hc = ab.__normalArray,
                        sc = ab.colorsNeedUpdate,
                        tc = ab.normalsNeedUpdate,
                        Ac = ab.__webglCustomAttributesList;
                    if (ab.verticesNeedUpdate) {
                        for (Pb = 0; Pb < pc; Pb++) bc = Ob[Pb], da = 3 * Pb, fc[da] = bc.x, fc[da + 1] = bc.y, fc[da + 2] = bc.z;
                        j.bindBuffer(j.ARRAY_BUFFER, ab.__webglVertexBuffer);
                        j.bufferData(j.ARRAY_BUFFER, fc, ac)
                    }
                    if (sc) {
                        for (Qb = 0; Qb < qc; Qb++) cc = Fc[Qb], da = 3 * Qb, gc[da] = cc.r, gc[da + 1] = cc.g, gc[da + 2] = cc.b;
                        j.bindBuffer(j.ARRAY_BUFFER, ab.__webglColorBuffer);
                        j.bufferData(j.ARRAY_BUFFER,
                            gc, ac)
                    }
                    if (tc) {
                        for (Rb = 0; Rb < rc; Rb++) dc = Gc[Rb], da = 3 * Rb, hc[da] = dc.x, hc[da + 1] = dc.y, hc[da + 2] = dc.z;
                        j.bindBuffer(j.ARRAY_BUFFER, ab.__webglNormalBuffer);
                        j.bufferData(j.ARRAY_BUFFER, hc, ac)
                    }
                    if (Ac) {
                        ec = 0;
                        for (Nb = Ac.length; ec < Nb; ec++)
                            if (ka = Ac[ec], ka.needsUpdate && (void 0 === ka.boundTo || "vertices" === ka.boundTo)) {
                                da = 0;
                                Fb = ka.value.length;
                                if (1 === ka.size)
                                    for (Ba = 0; Ba < Fb; Ba++) ka.array[Ba] = ka.value[Ba];
                                else if (2 === ka.size)
                                    for (Ba = 0; Ba < Fb; Ba++) Ma = ka.value[Ba], ka.array[da] = Ma.x, ka.array[da + 1] = Ma.y, da += 2;
                                else if (3 === ka.size)
                                    if ("c" ===
                                        ka.type)
                                        for (Ba = 0; Ba < Fb; Ba++) Ma = ka.value[Ba], ka.array[da] = Ma.r, ka.array[da + 1] = Ma.g, ka.array[da + 2] = Ma.b, da += 3;
                                    else
                                        for (Ba = 0; Ba < Fb; Ba++) Ma = ka.value[Ba], ka.array[da] = Ma.x, ka.array[da + 1] = Ma.y, ka.array[da + 2] = Ma.z, da += 3;
                                else if (4 === ka.size)
                                    for (Ba = 0; Ba < Fb; Ba++) Ma = ka.value[Ba], ka.array[da] = Ma.x, ka.array[da + 1] = Ma.y, ka.array[da + 2] = Ma.z, ka.array[da + 3] = Ma.w, da += 4;
                                j.bindBuffer(j.ARRAY_BUFFER, ka.buffer);
                                j.bufferData(j.ARRAY_BUFFER, ka.array, ac)
                            }
                    }
                }
                l.verticesNeedUpdate = !1;
                l.colorsNeedUpdate = !1;
                l.normalsNeedUpdate = !1;
                q.attributes && r(q)
            } else if (i instanceof THREE.Line) {
                q = d(i, l);
                n = q.attributes && p(q);
                if (l.verticesNeedUpdate || l.colorsNeedUpdate || l.lineDistancesNeedUpdate || n) {
                    var bb = l,
                        ic = j.DYNAMIC_DRAW,
                        Sb = void 0,
                        Tb = void 0,
                        Ub = void 0,
                        jc = void 0,
                        oa = void 0,
                        kc = void 0,
                        Hc = bb.vertices,
                        Ic = bb.colors,
                        Jc = bb.lineDistances,
                        uc = Hc.length,
                        vc = Ic.length,
                        wc = Jc.length,
                        lc = bb.__vertexArray,
                        mc = bb.__colorArray,
                        Kc = bb.__lineDistanceArray,
                        Pc = bb.colorsNeedUpdate,
                        Qc = bb.lineDistancesNeedUpdate,
                        Bc = bb.__webglCustomAttributesList,
                        nc = void 0,
                        Lc = void 0,
                        Ca = void 0,
                        Gb = void 0,
                        Na = void 0,
                        la = void 0;
                    if (bb.verticesNeedUpdate) {
                        for (Sb = 0; Sb < uc; Sb++) jc = Hc[Sb], oa = 3 * Sb, lc[oa] = jc.x, lc[oa + 1] = jc.y, lc[oa + 2] = jc.z;
                        j.bindBuffer(j.ARRAY_BUFFER, bb.__webglVertexBuffer);
                        j.bufferData(j.ARRAY_BUFFER, lc, ic)
                    }
                    if (Pc) {
                        for (Tb = 0; Tb < vc; Tb++) kc = Ic[Tb], oa = 3 * Tb, mc[oa] = kc.r, mc[oa + 1] = kc.g, mc[oa + 2] = kc.b;
                        j.bindBuffer(j.ARRAY_BUFFER, bb.__webglColorBuffer);
                        j.bufferData(j.ARRAY_BUFFER, mc, ic)
                    }
                    if (Qc) {
                        for (Ub = 0; Ub < wc; Ub++) Kc[Ub] = Jc[Ub];
                        j.bindBuffer(j.ARRAY_BUFFER, bb.__webglLineDistanceBuffer);
                        j.bufferData(j.ARRAY_BUFFER, Kc, ic)
                    }
                    if (Bc) {
                        nc = 0;
                        for (Lc = Bc.length; nc < Lc; nc++)
                            if (la = Bc[nc], la.needsUpdate && (void 0 === la.boundTo || "vertices" === la.boundTo)) {
                                oa = 0;
                                Gb = la.value.length;
                                if (1 === la.size)
                                    for (Ca = 0; Ca < Gb; Ca++) la.array[Ca] = la.value[Ca];
                                else if (2 === la.size)
                                    for (Ca = 0; Ca < Gb; Ca++) Na = la.value[Ca], la.array[oa] = Na.x, la.array[oa + 1] = Na.y, oa += 2;
                                else if (3 === la.size)
                                    if ("c" === la.type)
                                        for (Ca = 0; Ca < Gb; Ca++) Na = la.value[Ca], la.array[oa] = Na.r, la.array[oa + 1] = Na.g, la.array[oa + 2] = Na.b, oa += 3;
                                    else
                                        for (Ca = 0; Ca < Gb; Ca++) Na =
                                            la.value[Ca], la.array[oa] = Na.x, la.array[oa + 1] = Na.y, la.array[oa + 2] = Na.z, oa += 3;
                                else if (4 === la.size)
                                    for (Ca = 0; Ca < Gb; Ca++) Na = la.value[Ca], la.array[oa] = Na.x, la.array[oa + 1] = Na.y, la.array[oa + 2] = Na.z, la.array[oa + 3] = Na.w, oa += 4;
                                j.bindBuffer(j.ARRAY_BUFFER, la.buffer);
                                j.bufferData(j.ARRAY_BUFFER, la.array, ic)
                            }
                    }
                }
                l.verticesNeedUpdate = !1;
                l.colorsNeedUpdate = !1;
                l.lineDistancesNeedUpdate = !1;
                q.attributes && r(q)
            } else if (i instanceof THREE.ParticleSystem) {
                q = d(i, l);
                n = q.attributes && p(q);
                if (l.verticesNeedUpdate || l.colorsNeedUpdate ||
                    i.sortParticles || n) {
                    var pb = l,
                        Cc = j.DYNAMIC_DRAW,
                        Vb = i,
                        Oa = void 0,
                        qb = void 0,
                        rb = void 0,
                        U = void 0,
                        sb = void 0,
                        zb = void 0,
                        oc = pb.vertices,
                        Dc = oc.length,
                        Ec = pb.colors,
                        Mc = Ec.length,
                        Cb = pb.__vertexArray,
                        Db = pb.__colorArray,
                        wb = pb.__sortArray,
                        Nc = pb.verticesNeedUpdate,
                        Oc = pb.colorsNeedUpdate,
                        xb = pb.__webglCustomAttributesList,
                        db = void 0,
                        Hb = void 0,
                        Z = void 0,
                        eb = void 0,
                        ia = void 0,
                        S = void 0;
                    if (Vb.sortParticles) {
                        kb.copy(ta);
                        kb.multiply(Vb.matrixWorld);
                        for (Oa = 0; Oa < Dc; Oa++) rb = oc[Oa], ua.copy(rb), ua.applyProjection(kb), wb[Oa] = [ua.z,
                            Oa
                        ];
                        wb.sort(k);
                        for (Oa = 0; Oa < Dc; Oa++) rb = oc[wb[Oa][1]], U = 3 * Oa, Cb[U] = rb.x, Cb[U + 1] = rb.y, Cb[U + 2] = rb.z;
                        for (qb = 0; qb < Mc; qb++) U = 3 * qb, zb = Ec[wb[qb][1]], Db[U] = zb.r, Db[U + 1] = zb.g, Db[U + 2] = zb.b;
                        if (xb) {
                            db = 0;
                            for (Hb = xb.length; db < Hb; db++)
                                if (S = xb[db], void 0 === S.boundTo || "vertices" === S.boundTo)
                                    if (U = 0, eb = S.value.length, 1 === S.size)
                                        for (Z = 0; Z < eb; Z++) sb = wb[Z][1], S.array[Z] = S.value[sb];
                                    else if (2 === S.size)
                                for (Z = 0; Z < eb; Z++) sb = wb[Z][1], ia = S.value[sb], S.array[U] = ia.x, S.array[U + 1] = ia.y, U += 2;
                            else if (3 === S.size)
                                if ("c" === S.type)
                                    for (Z =
                                        0; Z < eb; Z++) sb = wb[Z][1], ia = S.value[sb], S.array[U] = ia.r, S.array[U + 1] = ia.g, S.array[U + 2] = ia.b, U += 3;
                                else
                                    for (Z = 0; Z < eb; Z++) sb = wb[Z][1], ia = S.value[sb], S.array[U] = ia.x, S.array[U + 1] = ia.y, S.array[U + 2] = ia.z, U += 3;
                            else if (4 === S.size)
                                for (Z = 0; Z < eb; Z++) sb = wb[Z][1], ia = S.value[sb], S.array[U] = ia.x, S.array[U + 1] = ia.y, S.array[U + 2] = ia.z, S.array[U + 3] = ia.w, U += 4
                        }
                    } else {
                        if (Nc)
                            for (Oa = 0; Oa < Dc; Oa++) rb = oc[Oa], U = 3 * Oa, Cb[U] = rb.x, Cb[U + 1] = rb.y, Cb[U + 2] = rb.z;
                        if (Oc)
                            for (qb = 0; qb < Mc; qb++) zb = Ec[qb], U = 3 * qb, Db[U] = zb.r, Db[U + 1] = zb.g, Db[U + 2] = zb.b;
                        if (xb) {
                            db = 0;
                            for (Hb = xb.length; db < Hb; db++)
                                if (S = xb[db], S.needsUpdate && (void 0 === S.boundTo || "vertices" === S.boundTo))
                                    if (eb = S.value.length, U = 0, 1 === S.size)
                                        for (Z = 0; Z < eb; Z++) S.array[Z] = S.value[Z];
                                    else if (2 === S.size)
                                for (Z = 0; Z < eb; Z++) ia = S.value[Z], S.array[U] = ia.x, S.array[U + 1] = ia.y, U += 2;
                            else if (3 === S.size)
                                if ("c" === S.type)
                                    for (Z = 0; Z < eb; Z++) ia = S.value[Z], S.array[U] = ia.r, S.array[U + 1] = ia.g, S.array[U + 2] = ia.b, U += 3;
                                else
                                    for (Z = 0; Z < eb; Z++) ia = S.value[Z], S.array[U] = ia.x, S.array[U + 1] = ia.y, S.array[U + 2] = ia.z, U += 3;
                            else if (4 ===
                                S.size)
                                for (Z = 0; Z < eb; Z++) ia = S.value[Z], S.array[U] = ia.x, S.array[U + 1] = ia.y, S.array[U + 2] = ia.z, S.array[U + 3] = ia.w, U += 4
                        }
                    }
                    if (Nc || Vb.sortParticles) j.bindBuffer(j.ARRAY_BUFFER, pb.__webglVertexBuffer), j.bufferData(j.ARRAY_BUFFER, Cb, Cc);
                    if (Oc || Vb.sortParticles) j.bindBuffer(j.ARRAY_BUFFER, pb.__webglColorBuffer), j.bufferData(j.ARRAY_BUFFER, Db, Cc);
                    if (xb) {
                        db = 0;
                        for (Hb = xb.length; db < Hb; db++)
                            if (S = xb[db], S.needsUpdate || Vb.sortParticles) j.bindBuffer(j.ARRAY_BUFFER, S.buffer), j.bufferData(j.ARRAY_BUFFER, S.array, Cc)
                    }
                }
                l.verticesNeedUpdate = !1;
                l.colorsNeedUpdate = !1;
                q.attributes && r(q)
            }
        }
    };
    this.initMaterial = function(a, b, c, d) {
        var e, f, g, h;
        a.addEventListener("dispose", Mb);
        var i, k, l, m, n;
        a instanceof THREE.MeshDepthMaterial ? n = "depth" : a instanceof THREE.MeshNormalMaterial ? n = "normal" : a instanceof THREE.MeshBasicMaterial ? n = "basic" : a instanceof THREE.MeshLambertMaterial ? n = "lambert" : a instanceof THREE.MeshPhongMaterial ? n = "phong" : a instanceof THREE.LineBasicMaterial ? n = "basic" : a instanceof THREE.LineDashedMaterial ? n = "dashed" : a instanceof THREE.ParticleBasicMaterial &&
            (n = "particle_basic");
        if (n) {
            var p = THREE.ShaderLib[n];
            a.uniforms = THREE.UniformsUtils.clone(p.uniforms);
            a.vertexShader = p.vertexShader;
            a.fragmentShader = p.fragmentShader
        }
        var q = e = 0,
            t = 0,
            r = p = 0;
        for (f = b.length; r < f; r++) g = b[r], g.onlyShadow || (g instanceof THREE.DirectionalLight && e++, g instanceof THREE.PointLight && q++, g instanceof THREE.SpotLight && t++, g instanceof THREE.HemisphereLight && p++);
        f = q;
        g = t;
        h = p;
        t = p = 0;
        for (q = b.length; t < q; t++) r = b[t], r.castShadow && (r instanceof THREE.SpotLight && p++, r instanceof THREE.DirectionalLight &&
            !r.shadowCascade && p++);
        m = p;
        Eb && d && d.useVertexTexture ? l = 1024 : (b = j.getParameter(j.MAX_VERTEX_UNIFORM_VECTORS), b = Math.floor((b - 20) / 4), void 0 !== d && d instanceof THREE.SkinnedMesh && (b = Math.min(d.bones.length, b), b < d.bones.length && console.warn("WebGLRenderer: too many bones - " + d.bones.length + ", this GPU supports just " + b + " (try OpenGL instead of ANGLE)")), l = b);
        a: {
            var t = a.fragmentShader,
                q = a.vertexShader,
                p = a.uniforms,
                b = a.attributes,
                r = a.defines,
                c = {
                    map: !!a.map,
                    envMap: !!a.envMap,
                    lightMap: !!a.lightMap,
                    bumpMap: !!a.bumpMap,
                    normalMap: !!a.normalMap,
                    specularMap: !!a.specularMap,
                    vertexColors: a.vertexColors,
                    fog: c,
                    useFog: a.fog,
                    fogExp: c instanceof THREE.FogExp2,
                    sizeAttenuation: a.sizeAttenuation,
                    skinning: a.skinning,
                    maxBones: l,
                    useVertexTexture: Eb && d && d.useVertexTexture,
                    boneTextureWidth: d && d.boneTextureWidth,
                    boneTextureHeight: d && d.boneTextureHeight,
                    morphTargets: a.morphTargets,
                    morphNormals: a.morphNormals,
                    maxMorphTargets: this.maxMorphTargets,
                    maxMorphNormals: this.maxMorphNormals,
                    maxDirLights: e,
                    maxPointLights: f,
                    maxSpotLights: g,
                    maxHemiLights: h,
                    maxShadows: m,
                    shadowMapEnabled: this.shadowMapEnabled && d.receiveShadow,
                    shadowMapType: this.shadowMapType,
                    shadowMapDebug: this.shadowMapDebug,
                    shadowMapCascade: this.shadowMapCascade,
                    alphaTest: a.alphaTest,
                    metal: a.metal,
                    perPixel: a.perPixel,
                    wrapAround: a.wrapAround,
                    doubleSided: a.side === THREE.DoubleSide,
                    flipSided: a.side === THREE.BackSide
                },
                d = a.index0AttributeName,
                s, u, w;
            e = [];
            n ? e.push(n) : (e.push(t), e.push(q));
            for (u in r) e.push(u), e.push(r[u]);
            for (s in c) e.push(s), e.push(c[s]);
            n = e.join();
            s = 0;
            for (u = ea.length; s < u; s++)
                if (e =
                    ea[s], e.code === n) {
                    e.usedTimes++;
                    k = e.program;
                    break a
                }
            s = "SHADOWMAP_TYPE_BASIC";
            c.shadowMapType === THREE.PCFShadowMap ? s = "SHADOWMAP_TYPE_PCF" : c.shadowMapType === THREE.PCFSoftShadowMap && (s = "SHADOWMAP_TYPE_PCF_SOFT");
            u = [];
            for (w in r) e = r[w], !1 !== e && (e = "#define " + w + " " + e, u.push(e));
            e = u.join("\n");
            w = j.createProgram();
            u = ["precision " + R + " float;", "precision " + R + " int;", e, Ib ? "#define VERTEX_TEXTURES" : "", K.gammaInput ? "#define GAMMA_INPUT" : "", K.gammaOutput ? "#define GAMMA_OUTPUT" : "", K.physicallyBasedShading ? "#define PHYSICALLY_BASED_SHADING" :
                "", "#define MAX_DIR_LIGHTS " + c.maxDirLights, "#define MAX_POINT_LIGHTS " + c.maxPointLights, "#define MAX_SPOT_LIGHTS " + c.maxSpotLights, "#define MAX_HEMI_LIGHTS " + c.maxHemiLights, "#define MAX_SHADOWS " + c.maxShadows, "#define MAX_BONES " + c.maxBones, c.map ? "#define USE_MAP" : "", c.envMap ? "#define USE_ENVMAP" : "", c.lightMap ? "#define USE_LIGHTMAP" : "", c.bumpMap ? "#define USE_BUMPMAP" : "", c.normalMap ? "#define USE_NORMALMAP" : "", c.specularMap ? "#define USE_SPECULARMAP" : "", c.vertexColors ? "#define USE_COLOR" : "", c.skinning ?
                "#define USE_SKINNING" : "", c.useVertexTexture ? "#define BONE_TEXTURE" : "", c.boneTextureWidth ? "#define N_BONE_PIXEL_X " + c.boneTextureWidth.toFixed(1) : "", c.boneTextureHeight ? "#define N_BONE_PIXEL_Y " + c.boneTextureHeight.toFixed(1) : "", c.morphTargets ? "#define USE_MORPHTARGETS" : "", c.morphNormals ? "#define USE_MORPHNORMALS" : "", c.perPixel ? "#define PHONG_PER_PIXEL" : "", c.wrapAround ? "#define WRAP_AROUND" : "", c.doubleSided ? "#define DOUBLE_SIDED" : "", c.flipSided ? "#define FLIP_SIDED" : "", c.shadowMapEnabled ? "#define USE_SHADOWMAP" :
                "", c.shadowMapEnabled ? "#define " + s : "", c.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "", c.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "", c.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "", "uniform mat4 modelMatrix;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform mat4 viewMatrix;\nuniform mat3 normalMatrix;\nuniform vec3 cameraPosition;\nattribute vec3 position;\nattribute vec3 normal;\nattribute vec2 uv;\nattribute vec2 uv2;\n#ifdef USE_COLOR\nattribute vec3 color;\n#endif\n#ifdef USE_MORPHTARGETS\nattribute vec3 morphTarget0;\nattribute vec3 morphTarget1;\nattribute vec3 morphTarget2;\nattribute vec3 morphTarget3;\n#ifdef USE_MORPHNORMALS\nattribute vec3 morphNormal0;\nattribute vec3 morphNormal1;\nattribute vec3 morphNormal2;\nattribute vec3 morphNormal3;\n#else\nattribute vec3 morphTarget4;\nattribute vec3 morphTarget5;\nattribute vec3 morphTarget6;\nattribute vec3 morphTarget7;\n#endif\n#endif\n#ifdef USE_SKINNING\nattribute vec4 skinIndex;\nattribute vec4 skinWeight;\n#endif\n"
            ].join("\n");
            s = ["precision " + R + " float;", "precision " + R + " int;", c.bumpMap || c.normalMap ? "#extension GL_OES_standard_derivatives : enable" : "", e, "#define MAX_DIR_LIGHTS " + c.maxDirLights, "#define MAX_POINT_LIGHTS " + c.maxPointLights, "#define MAX_SPOT_LIGHTS " + c.maxSpotLights, "#define MAX_HEMI_LIGHTS " + c.maxHemiLights, "#define MAX_SHADOWS " + c.maxShadows, c.alphaTest ? "#define ALPHATEST " + c.alphaTest : "", K.gammaInput ? "#define GAMMA_INPUT" : "", K.gammaOutput ? "#define GAMMA_OUTPUT" : "", K.physicallyBasedShading ? "#define PHYSICALLY_BASED_SHADING" :
                "", c.useFog && c.fog ? "#define USE_FOG" : "", c.useFog && c.fogExp ? "#define FOG_EXP2" : "", c.map ? "#define USE_MAP" : "", c.envMap ? "#define USE_ENVMAP" : "", c.lightMap ? "#define USE_LIGHTMAP" : "", c.bumpMap ? "#define USE_BUMPMAP" : "", c.normalMap ? "#define USE_NORMALMAP" : "", c.specularMap ? "#define USE_SPECULARMAP" : "", c.vertexColors ? "#define USE_COLOR" : "", c.metal ? "#define METAL" : "", c.perPixel ? "#define PHONG_PER_PIXEL" : "", c.wrapAround ? "#define WRAP_AROUND" : "", c.doubleSided ? "#define DOUBLE_SIDED" : "", c.flipSided ? "#define FLIP_SIDED" :
                "", c.shadowMapEnabled ? "#define USE_SHADOWMAP" : "", c.shadowMapEnabled ? "#define " + s : "", c.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "", c.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "", "uniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\n"
            ].join("\n");
            u = B("vertex", u + q);
            s = B("fragment", s + t);
            j.attachShader(w, u);
            j.attachShader(w, s);
            d && j.bindAttribLocation(w, 0, d);
            j.linkProgram(w);
            j.getProgramParameter(w, j.LINK_STATUS) || (console.error("Could not initialise shader\nVALIDATE_STATUS: " + j.getProgramParameter(w,
                j.VALIDATE_STATUS) + ", gl error [" + j.getError() + "]"), console.error("Program Info Log: " + j.getProgramInfoLog(w)));
            j.deleteShader(s);
            j.deleteShader(u);
            w.uniforms = {};
            w.attributes = {};
            var v;
            s = "viewMatrix modelViewMatrix projectionMatrix normalMatrix modelMatrix cameraPosition morphTargetInfluences".split(" ");
            c.useVertexTexture ? s.push("boneTexture") : s.push("boneGlobalMatrices");
            for (v in p) s.push(v);
            v = s;
            s = 0;
            for (u = v.length; s < u; s++) p = v[s], w.uniforms[p] = j.getUniformLocation(w, p);
            s = "position normal uv uv2 tangent color skinIndex skinWeight lineDistance".split(" ");
            for (v = 0; v < c.maxMorphTargets; v++) s.push("morphTarget" + v);
            for (v = 0; v < c.maxMorphNormals; v++) s.push("morphNormal" + v);
            for (k in b) s.push(k);
            k = s;
            v = 0;
            for (b = k.length; v < b; v++) s = k[v], w.attributes[s] = j.getAttribLocation(w, s);
            w.id = Da++;
            ea.push({
                program: w,
                code: n,
                usedTimes: 1
            });
            K.info.memory.programs = ea.length;
            k = w
        }
        a.program = k;
        v = a.program.attributes;
        if (a.morphTargets) {
            a.numSupportedMorphTargets = 0;
            b = "morphTarget";
            for (k = 0; k < this.maxMorphTargets; k++) w = b + k, 0 <= v[w] && a.numSupportedMorphTargets++
        }
        if (a.morphNormals) {
            a.numSupportedMorphNormals =
                0;
            b = "morphNormal";
            for (k = 0; k < this.maxMorphNormals; k++) w = b + k, 0 <= v[w] && a.numSupportedMorphNormals++
        }
        a.uniformsList = [];
        for (i in a.uniforms) a.uniformsList.push([a.uniforms[i], i])
    };
    this.setFaceCulling = function(a, b) {
        a === THREE.CullFaceNone ? j.disable(j.CULL_FACE) : (b === THREE.FrontFaceDirectionCW ? j.frontFace(j.CW) : j.frontFace(j.CCW), a === THREE.CullFaceBack ? j.cullFace(j.BACK) : a === THREE.CullFaceFront ? j.cullFace(j.FRONT) : j.cullFace(j.FRONT_AND_BACK), j.enable(j.CULL_FACE))
    };
    this.setMaterialFaces = function(a) {
        var b =
            a.side === THREE.DoubleSide,
            a = a.side === THREE.BackSide;
        Y !== b && (b ? j.disable(j.CULL_FACE) : j.enable(j.CULL_FACE), Y = b);
        T !== a && (a ? j.frontFace(j.CW) : j.frontFace(j.CCW), T = a)
    };
    this.setDepthTest = function(a) {
        Ja !== a && (a ? j.enable(j.DEPTH_TEST) : j.disable(j.DEPTH_TEST), Ja = a)
    };
    this.setDepthWrite = function(a) {
        ga !== a && (j.depthMask(a), ga = a)
    };
    this.setBlending = function(a, b, c, d) {
        a !== ma && (a === THREE.NoBlending ? j.disable(j.BLEND) : a === THREE.AdditiveBlending ? (j.enable(j.BLEND), j.blendEquation(j.FUNC_ADD), j.blendFunc(j.SRC_ALPHA,
            j.ONE)) : a === THREE.SubtractiveBlending ? (j.enable(j.BLEND), j.blendEquation(j.FUNC_ADD), j.blendFunc(j.ZERO, j.ONE_MINUS_SRC_COLOR)) : a === THREE.MultiplyBlending ? (j.enable(j.BLEND), j.blendEquation(j.FUNC_ADD), j.blendFunc(j.ZERO, j.SRC_COLOR)) : a === THREE.CustomBlending ? j.enable(j.BLEND) : (j.enable(j.BLEND), j.blendEquationSeparate(j.FUNC_ADD, j.FUNC_ADD), j.blendFuncSeparate(j.SRC_ALPHA, j.ONE_MINUS_SRC_ALPHA, j.ONE, j.ONE_MINUS_SRC_ALPHA)), ma = a);
        if (a === THREE.CustomBlending) {
            if (b !== va && (j.blendEquation(A(b)), va = b),
                c !== ja || d !== Pa) j.blendFunc(A(c), A(d)), ja = c, Pa = d
        } else Pa = ja = va = null
    };
    this.setTexture = function(a, b) {
        if (a.needsUpdate) {
            a.__webglInit || (a.__webglInit = !0, a.addEventListener("dispose", Kb), a.__webglTexture = j.createTexture(), K.info.memory.textures++);
            j.activeTexture(j.TEXTURE0 + b);
            j.bindTexture(j.TEXTURE_2D, a.__webglTexture);
            j.pixelStorei(j.UNPACK_FLIP_Y_WEBGL, a.flipY);
            j.pixelStorei(j.UNPACK_PREMULTIPLY_ALPHA_WEBGL, a.premultiplyAlpha);
            j.pixelStorei(j.UNPACK_ALIGNMENT, a.unpackAlignment);
            var c = a.image,
                d = 0 ===
                (c.width & c.width - 1) && 0 === (c.height & c.height - 1),
                e = A(a.format),
                f = A(a.type);
            C(j.TEXTURE_2D, a, d);
            var g = a.mipmaps;
            if (a instanceof THREE.DataTexture)
                if (0 < g.length && d) {
                    for (var h = 0, i = g.length; h < i; h++) c = g[h], j.texImage2D(j.TEXTURE_2D, h, e, c.width, c.height, 0, e, f, c.data);
                    a.generateMipmaps = !1
                } else j.texImage2D(j.TEXTURE_2D, 0, e, c.width, c.height, 0, e, f, c.data);
            else if (a instanceof THREE.CompressedTexture) {
                h = 0;
                for (i = g.length; h < i; h++) c = g[h], j.compressedTexImage2D(j.TEXTURE_2D, h, e, c.width, c.height, 0, c.data)
            } else if (0 <
                g.length && d) {
                h = 0;
                for (i = g.length; h < i; h++) c = g[h], j.texImage2D(j.TEXTURE_2D, h, e, e, f, c);
                a.generateMipmaps = !1
            } else j.texImage2D(j.TEXTURE_2D, 0, e, e, f, a.image);
            a.generateMipmaps && d && j.generateMipmap(j.TEXTURE_2D);
            a.needsUpdate = !1;
            if (a.onUpdate) a.onUpdate()
        } else j.activeTexture(j.TEXTURE0 + b), j.bindTexture(j.TEXTURE_2D, a.__webglTexture)
    };
    this.setRenderTarget = function(a) {
        var b = a instanceof THREE.WebGLRenderTargetCube;
        if (a && !a.__webglFramebuffer) {
            void 0 === a.depthBuffer && (a.depthBuffer = !0);
            void 0 === a.stencilBuffer &&
                (a.stencilBuffer = !0);
            a.addEventListener("dispose", Lb);
            a.__webglTexture = j.createTexture();
            K.info.memory.textures++;
            var c = 0 === (a.width & a.width - 1) && 0 === (a.height & a.height - 1),
                d = A(a.format),
                e = A(a.type);
            if (b) {
                a.__webglFramebuffer = [];
                a.__webglRenderbuffer = [];
                j.bindTexture(j.TEXTURE_CUBE_MAP, a.__webglTexture);
                C(j.TEXTURE_CUBE_MAP, a, c);
                for (var f = 0; 6 > f; f++) {
                    a.__webglFramebuffer[f] = j.createFramebuffer();
                    a.__webglRenderbuffer[f] = j.createRenderbuffer();
                    j.texImage2D(j.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, d, a.width,
                        a.height, 0, d, e, null);
                    var g = a,
                        h = j.TEXTURE_CUBE_MAP_POSITIVE_X + f;
                    j.bindFramebuffer(j.FRAMEBUFFER, a.__webglFramebuffer[f]);
                    j.framebufferTexture2D(j.FRAMEBUFFER, j.COLOR_ATTACHMENT0, h, g.__webglTexture, 0);
                    I(a.__webglRenderbuffer[f], a)
                }
                c && j.generateMipmap(j.TEXTURE_CUBE_MAP)
            } else a.__webglFramebuffer = j.createFramebuffer(), a.__webglRenderbuffer = a.shareDepthFrom ? a.shareDepthFrom.__webglRenderbuffer : j.createRenderbuffer(), j.bindTexture(j.TEXTURE_2D, a.__webglTexture), C(j.TEXTURE_2D, a, c), j.texImage2D(j.TEXTURE_2D,
                0, d, a.width, a.height, 0, d, e, null), d = j.TEXTURE_2D, j.bindFramebuffer(j.FRAMEBUFFER, a.__webglFramebuffer), j.framebufferTexture2D(j.FRAMEBUFFER, j.COLOR_ATTACHMENT0, d, a.__webglTexture, 0), a.shareDepthFrom ? a.depthBuffer && !a.stencilBuffer ? j.framebufferRenderbuffer(j.FRAMEBUFFER, j.DEPTH_ATTACHMENT, j.RENDERBUFFER, a.__webglRenderbuffer) : a.depthBuffer && a.stencilBuffer && j.framebufferRenderbuffer(j.FRAMEBUFFER, j.DEPTH_STENCIL_ATTACHMENT, j.RENDERBUFFER, a.__webglRenderbuffer) : I(a.__webglRenderbuffer, a), c && j.generateMipmap(j.TEXTURE_2D);
            b ? j.bindTexture(j.TEXTURE_CUBE_MAP, null) : j.bindTexture(j.TEXTURE_2D, null);
            j.bindRenderbuffer(j.RENDERBUFFER, null);
            j.bindFramebuffer(j.FRAMEBUFFER, null)
        }
        a ? (b = b ? a.__webglFramebuffer[a.activeCubeFace] : a.__webglFramebuffer, c = a.width, a = a.height, e = d = 0) : (b = null, c = tb, a = ub, d = hb, e = ib);
        b !== ba && (j.bindFramebuffer(j.FRAMEBUFFER, b), j.viewport(d, e, c, a), ba = b);
        vb = c;
        jb = a
    };
    this.shadowMapPlugin = new THREE.ShadowMapPlugin;
    this.addPrePlugin(this.shadowMapPlugin);
    this.addPostPlugin(new THREE.SpritePlugin);
    this.addPostPlugin(new THREE.LensFlarePlugin)
};
THREE.WebGLRenderTarget = function(a, b, c) {
    this.width = a;
    this.height = b;
    c = c || {};
    this.wrapS = void 0 !== c.wrapS ? c.wrapS : THREE.ClampToEdgeWrapping;
    this.wrapT = void 0 !== c.wrapT ? c.wrapT : THREE.ClampToEdgeWrapping;
    this.magFilter = void 0 !== c.magFilter ? c.magFilter : THREE.LinearFilter;
    this.minFilter = void 0 !== c.minFilter ? c.minFilter : THREE.LinearMipMapLinearFilter;
    this.anisotropy = void 0 !== c.anisotropy ? c.anisotropy : 1;
    this.offset = new THREE.Vector2(0, 0);
    this.repeat = new THREE.Vector2(1, 1);
    this.format = void 0 !== c.format ? c.format :
        THREE.RGBAFormat;
    this.type = void 0 !== c.type ? c.type : THREE.UnsignedByteType;
    this.depthBuffer = void 0 !== c.depthBuffer ? c.depthBuffer : !0;
    this.stencilBuffer = void 0 !== c.stencilBuffer ? c.stencilBuffer : !0;
    this.generateMipmaps = !0;
    this.shareDepthFrom = null
};
THREE.WebGLRenderTarget.prototype = {
    constructor: THREE.WebGLRenderTarget,
    clone: function() {
        var a = new THREE.WebGLRenderTarget(this.width, this.height);
        a.wrapS = this.wrapS;
        a.wrapT = this.wrapT;
        a.magFilter = this.magFilter;
        a.minFilter = this.minFilter;
        a.anisotropy = this.anisotropy;
        a.offset.copy(this.offset);
        a.repeat.copy(this.repeat);
        a.format = this.format;
        a.type = this.type;
        a.depthBuffer = this.depthBuffer;
        a.stencilBuffer = this.stencilBuffer;
        a.generateMipmaps = this.generateMipmaps;
        a.shareDepthFrom = this.shareDepthFrom;
        return a
    },
    dispose: function() {
        this.dispatchEvent({
            type: "dispose"
        })
    }
};
THREE.EventDispatcher.prototype.apply(THREE.WebGLRenderTarget.prototype);
THREE.WebGLRenderTargetCube = function(a, b, c) {
    THREE.WebGLRenderTarget.call(this, a, b, c);
    this.activeCubeFace = 0
};
THREE.WebGLRenderTargetCube.prototype = Object.create(THREE.WebGLRenderTarget.prototype);
THREE.RenderableVertex = function() {
    this.positionWorld = new THREE.Vector3;
    this.positionScreen = new THREE.Vector4;
    this.visible = !0
};
THREE.RenderableVertex.prototype.copy = function(a) {
    this.positionWorld.copy(a.positionWorld);
    this.positionScreen.copy(a.positionScreen)
};
THREE.RenderableFace3 = function() {
    this.id = 0;
    this.v1 = new THREE.RenderableVertex;
    this.v2 = new THREE.RenderableVertex;
    this.v3 = new THREE.RenderableVertex;
    this.centroidModel = new THREE.Vector3;
    this.normalModel = new THREE.Vector3;
    this.normalModelView = new THREE.Vector3;
    this.vertexNormalsLength = 0;
    this.vertexNormalsModel = [new THREE.Vector3, new THREE.Vector3, new THREE.Vector3];
    this.vertexNormalsModelView = [new THREE.Vector3, new THREE.Vector3, new THREE.Vector3];
    this.material = this.color = null;
    this.uvs = [
        []
    ];
    this.z =
        0
};
THREE.RenderableObject = function() {
    this.id = 0;
    this.object = null;
    this.z = 0
};
THREE.RenderableParticle = function() {
    this.id = 0;
    this.object = null;
    this.z = this.y = this.x = 0;
    this.rotation = null;
    this.scale = new THREE.Vector2;
    this.material = null
};
THREE.RenderableLine = function() {
    this.id = 0;
    this.v1 = new THREE.RenderableVertex;
    this.v2 = new THREE.RenderableVertex;
    this.vertexColors = [new THREE.Color, new THREE.Color];
    this.material = null;
    this.z = 0
};
THREE.GeometryUtils = {
    merge: function(a, b, c) {
        var d, e, f = a.vertices.length,
            h = b instanceof THREE.Mesh ? b.geometry : b,
            g = a.vertices,
            i = h.vertices,
            k = a.faces,
            m = h.faces,
            a = a.faceVertexUvs[0],
            h = h.faceVertexUvs[0];
        void 0 === c && (c = 0);
        b instanceof THREE.Mesh && (b.matrixAutoUpdate && b.updateMatrix(), d = b.matrix, e = (new THREE.Matrix3).getNormalMatrix(d));
        for (var b = 0, l = i.length; b < l; b++) {
            var n = i[b].clone();
            d && n.applyMatrix4(d);
            g.push(n)
        }
        b = 0;
        for (l = m.length; b < l; b++) {
            var n = m[b],
                t, q, p = n.vertexNormals,
                r = n.vertexColors;
            t = new THREE.Face3(n.a +
                f, n.b + f, n.c + f);
            t.normal.copy(n.normal);
            e && t.normal.applyMatrix3(e).normalize();
            g = 0;
            for (i = p.length; g < i; g++) q = p[g].clone(), e && q.applyMatrix3(e).normalize(), t.vertexNormals.push(q);
            t.color.copy(n.color);
            g = 0;
            for (i = r.length; g < i; g++) q = r[g], t.vertexColors.push(q.clone());
            t.materialIndex = n.materialIndex + c;
            t.centroid.copy(n.centroid);
            d && t.centroid.applyMatrix4(d);
            k.push(t)
        }
        b = 0;
        for (l = h.length; b < l; b++) {
            c = h[b];
            d = [];
            g = 0;
            for (i = c.length; g < i; g++) d.push(new THREE.Vector2(c[g].x, c[g].y));
            a.push(d)
        }
    },
    randomPointInTriangle: function() {
        var a =
            new THREE.Vector3;
        return function(b, c, d) {
            var e = new THREE.Vector3,
                f = THREE.Math.random16(),
                h = THREE.Math.random16();
            1 < f + h && (f = 1 - f, h = 1 - h);
            var g = 1 - f - h;
            e.copy(b);
            e.multiplyScalar(f);
            a.copy(c);
            a.multiplyScalar(h);
            e.add(a);
            a.copy(d);
            a.multiplyScalar(g);
            e.add(a);
            return e
        }
    }(),
    randomPointInFace: function(a, b) {
        return THREE.GeometryUtils.randomPointInTriangle(b.vertices[a.a], b.vertices[a.b], b.vertices[a.c])
    },
    randomPointsInGeometry: function(a, b) {
        function c(a) {
            function b(c, d) {
                if (d < c) return c;
                var e = c + Math.floor((d -
                    c) / 2);
                return k[e] > a ? b(c, e - 1) : k[e] < a ? b(e + 1, d) : e
            }
            return b(0, k.length - 1)
        }
        var d, e, f = a.faces,
            h = a.vertices,
            g = f.length,
            i = 0,
            k = [],
            m, l, n;
        for (e = 0; e < g; e++) d = f[e], m = h[d.a], l = h[d.b], n = h[d.c], d._area = THREE.GeometryUtils.triangleArea(m, l, n), i += d._area, k[e] = i;
        d = [];
        for (e = 0; e < b; e++) h = THREE.Math.random16() * i, h = c(h), d[e] = THREE.GeometryUtils.randomPointInFace(f[h], a, !0);
        return d
    },
    triangleArea: function() {
        var a = new THREE.Vector3,
            b = new THREE.Vector3;
        return function(c, d, e) {
            a.subVectors(d, c);
            b.subVectors(e, c);
            a.cross(b);
            return 0.5 *
                a.length()
        }
    }(),
    center: function(a) {
        a.computeBoundingBox();
        var b = a.boundingBox,
            c = new THREE.Vector3;
        c.addVectors(b.min, b.max);
        c.multiplyScalar(-0.5);
        a.applyMatrix((new THREE.Matrix4).makeTranslation(c.x, c.y, c.z));
        a.computeBoundingBox();
        return c
    },
    triangulateQuads: function(a) {
        var b, c, d, e, f = [],
            h = [];
        b = 0;
        for (c = a.faceVertexUvs.length; b < c; b++) h[b] = [];
        b = 0;
        for (c = a.faces.length; b < c; b++) {
            f.push(a.faces[b]);
            d = 0;
            for (e = a.faceVertexUvs.length; d < e; d++) h[d].push(a.faceVertexUvs[d][b])
        }
        a.faces = f;
        a.faceVertexUvs = h;
        a.computeCentroids();
        a.computeFaceNormals();
        a.computeVertexNormals();
        a.hasTangents && a.computeTangents()
    }
};
THREE.ImageUtils = {
    crossOrigin: "anonymous",
    loadTexture: function(a, b, c) {
        var d = new Image,
            e = new THREE.Texture(d, b),
            b = new THREE.ImageLoader;
        b.crossOrigin = this.crossOrigin;
        b.load(a, function(a) {
            e.image = a;
            e.needsUpdate = !0;
            c && c(e)
        });
        e.sourceFile = a;
        return e
    },
    loadCompressedTexture: function(a, b, c, d) {
        var e = new THREE.CompressedTexture;
        e.mapping = b;
        var f = new XMLHttpRequest;
        f.onload = function() {
            var a = THREE.ImageUtils.parseDDS(f.response, !0);
            e.format = a.format;
            e.mipmaps = a.mipmaps;
            e.image.width = a.width;
            e.image.height =
                a.height;
            e.generateMipmaps = !1;
            e.needsUpdate = !0;
            c && c(e)
        };
        f.onerror = d;
        f.open("GET", a, !0);
        f.responseType = "arraybuffer";
        f.send(null);
        return e
    },
    loadTextureCube: function(a, b, c, d) {
        var e = [];
        e.loadCount = 0;
        var f = new THREE.Texture;
        f.image = e;
        void 0 !== b && (f.mapping = b);
        f.flipY = !1;
        for (var b = 0, h = a.length; b < h; ++b) {
            var g = new Image;
            e[b] = g;
            g.onload = function() {
                e.loadCount += 1;
                6 === e.loadCount && (f.needsUpdate = !0, c && c(f))
            };
            g.onerror = d;
            g.crossOrigin = this.crossOrigin;
            g.src = a[b]
        }
        return f
    },
    loadCompressedTextureCube: function(a,
        b, c, d) {
        var e = [];
        e.loadCount = 0;
        var f = new THREE.CompressedTexture;
        f.image = e;
        void 0 !== b && (f.mapping = b);
        f.flipY = !1;
        f.generateMipmaps = !1;
        b = function(a, b) {
            return function() {
                var d = THREE.ImageUtils.parseDDS(a.response, !0);
                b.format = d.format;
                b.mipmaps = d.mipmaps;
                b.width = d.width;
                b.height = d.height;
                e.loadCount += 1;
                6 === e.loadCount && (f.format = d.format, f.needsUpdate = !0, c && c(f))
            }
        };
        if (a instanceof Array)
            for (var h = 0, g = a.length; h < g; ++h) {
                var i = {};
                e[h] = i;
                var k = new XMLHttpRequest;
                k.onload = b(k, i);
                k.onerror = d;
                i = a[h];
                k.open("GET",
                    i, !0);
                k.responseType = "arraybuffer";
                k.send(null)
            } else k = new XMLHttpRequest, k.onload = function() {
                var a = THREE.ImageUtils.parseDDS(k.response, !0);
                if (a.isCubemap) {
                    for (var b = a.mipmaps.length / a.mipmapCount, d = 0; d < b; d++) {
                        e[d] = {
                            mipmaps: []
                        };
                        for (var g = 0; g < a.mipmapCount; g++) e[d].mipmaps.push(a.mipmaps[d * a.mipmapCount + g]), e[d].format = a.format, e[d].width = a.width, e[d].height = a.height
                    }
                    f.format = a.format;
                    f.needsUpdate = !0;
                    c && c(f)
                }
            }, k.onerror = d, k.open("GET", a, !0), k.responseType = "arraybuffer", k.send(null);
        return f
    },
    parseDDS: function(a,
        b) {
        function c(a) {
            return a.charCodeAt(0) + (a.charCodeAt(1) << 8) + (a.charCodeAt(2) << 16) + (a.charCodeAt(3) << 24)
        }
        var d = {
                mipmaps: [],
                width: 0,
                height: 0,
                format: null,
                mipmapCount: 1
            },
            e = c("DXT1"),
            f = c("DXT3"),
            h = c("DXT5"),
            g = new Int32Array(a, 0, 31);
        if (542327876 !== g[0]) return console.error("ImageUtils.parseDDS(): Invalid magic number in DDS header"), d;
        if (!g[20] & 4) return console.error("ImageUtils.parseDDS(): Unsupported format, must contain a FourCC code"), d;
        var i = g[21];
        switch (i) {
            case e:
                e = 8;
                d.format = THREE.RGB_S3TC_DXT1_Format;
                break;
            case f:
                e = 16;
                d.format = THREE.RGBA_S3TC_DXT3_Format;
                break;
            case h:
                e = 16;
                d.format = THREE.RGBA_S3TC_DXT5_Format;
                break;
            default:
                return console.error("ImageUtils.parseDDS(): Unsupported FourCC code: ", String.fromCharCode(i & 255, i >> 8 & 255, i >> 16 & 255, i >> 24 & 255)), d
        }
        d.mipmapCount = 1;
        g[2] & 131072 && !1 !== b && (d.mipmapCount = Math.max(1, g[7]));
        d.isCubemap = g[28] & 512 ? !0 : !1;
        d.width = g[4];
        d.height = g[3];
        for (var g = g[1] + 4, f = d.width, h = d.height, i = d.isCubemap ? 6 : 1, k = 0; k < i; k++) {
            for (var m = 0; m < d.mipmapCount; m++) {
                var l = Math.max(4, f) /
                    4 * Math.max(4, h) / 4 * e,
                    n = {
                        data: new Uint8Array(a, g, l),
                        width: f,
                        height: h
                    };
                d.mipmaps.push(n);
                g += l;
                f = Math.max(0.5 * f, 1);
                h = Math.max(0.5 * h, 1)
            }
            f = d.width;
            h = d.height
        }
        return d
    },
    getNormalMap: function(a, b) {
        var c = function(a) {
                var b = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
                return [a[0] / b, a[1] / b, a[2] / b]
            },
            b = b | 1,
            d = a.width,
            e = a.height,
            f = document.createElement("canvas");
        f.width = d;
        f.height = e;
        var h = f.getContext("2d");
        h.drawImage(a, 0, 0);
        for (var g = h.getImageData(0, 0, d, e).data, i = h.createImageData(d, e), k = i.data, m = 0; m < d; m++)
            for (var l =
                    0; l < e; l++) {
                var n = 0 > l - 1 ? 0 : l - 1,
                    t = l + 1 > e - 1 ? e - 1 : l + 1,
                    q = 0 > m - 1 ? 0 : m - 1,
                    p = m + 1 > d - 1 ? d - 1 : m + 1,
                    r = [],
                    s = [0, 0, g[4 * (l * d + m)] / 255 * b];
                r.push([-1, 0, g[4 * (l * d + q)] / 255 * b]);
                r.push([-1, -1, g[4 * (n * d + q)] / 255 * b]);
                r.push([0, -1, g[4 * (n * d + m)] / 255 * b]);
                r.push([1, -1, g[4 * (n * d + p)] / 255 * b]);
                r.push([1, 0, g[4 * (l * d + p)] / 255 * b]);
                r.push([1, 1, g[4 * (t * d + p)] / 255 * b]);
                r.push([0, 1, g[4 * (t * d + m)] / 255 * b]);
                r.push([-1, 1, g[4 * (t * d + q)] / 255 * b]);
                n = [];
                q = r.length;
                for (t = 0; t < q; t++) {
                    var p = r[t],
                        u = r[(t + 1) % q],
                        p = [p[0] - s[0], p[1] - s[1], p[2] - s[2]],
                        u = [u[0] - s[0], u[1] - s[1], u[2] - s[2]];
                    n.push(c([p[1] * u[2] - p[2] * u[1], p[2] * u[0] - p[0] * u[2], p[0] * u[1] - p[1] * u[0]]))
                }
                r = [0, 0, 0];
                for (t = 0; t < n.length; t++) r[0] += n[t][0], r[1] += n[t][1], r[2] += n[t][2];
                r[0] /= n.length;
                r[1] /= n.length;
                r[2] /= n.length;
                s = 4 * (l * d + m);
                k[s] = 255 * ((r[0] + 1) / 2) | 0;
                k[s + 1] = 255 * ((r[1] + 1) / 2) | 0;
                k[s + 2] = 255 * r[2] | 0;
                k[s + 3] = 255
            }
        h.putImageData(i, 0, 0);
        return f
    },
    generateDataTexture: function(a, b, c) {
        for (var d = a * b, e = new Uint8Array(3 * d), f = Math.floor(255 * c.r), h = Math.floor(255 * c.g), c = Math.floor(255 * c.b), g = 0; g < d; g++) e[3 * g] = f, e[3 * g + 1] = h, e[3 * g + 2] = c;
        a = new THREE.DataTexture(e,
            a, b, THREE.RGBFormat);
        a.needsUpdate = !0;
        return a
    }
};
THREE.SceneUtils = {
    createMultiMaterialObject: function(a, b) {
        for (var c = new THREE.Object3D, d = 0, e = b.length; d < e; d++) c.add(new THREE.Mesh(a, b[d]));
        return c
    },
    detach: function(a, b, c) {
        a.applyMatrix(b.matrixWorld);
        b.remove(a);
        c.add(a)
    },
    attach: function(a, b, c) {
        var d = new THREE.Matrix4;
        d.getInverse(c.matrixWorld);
        a.applyMatrix(d);
        b.remove(a);
        c.add(a)
    }
};
THREE.FontUtils = {
    faces: {},
    face: "helvetiker",
    weight: "normal",
    style: "normal",
    size: 150,
    divisions: 10,
    getFace: function() {
        return this.faces[this.face][this.weight][this.style]
    },
    loadFace: function(a) {
        var b = a.familyName.toLowerCase();
        this.faces[b] = this.faces[b] || {};
        this.faces[b][a.cssFontWeight] = this.faces[b][a.cssFontWeight] || {};
        this.faces[b][a.cssFontWeight][a.cssFontStyle] = a;
        return this.faces[b][a.cssFontWeight][a.cssFontStyle] = a
    },
    drawText: function(a) {
        for (var b = this.getFace(), c = this.size / b.resolution, d =
                0, e = String(a).split(""), f = e.length, h = [], a = 0; a < f; a++) {
            var g = new THREE.Path,
                g = this.extractGlyphPoints(e[a], b, c, d, g),
                d = d + g.offset;
            h.push(g.path)
        }
        return {
            paths: h,
            offset: d / 2
        }
    },
    extractGlyphPoints: function(a, b, c, d, e) {
        var f = [],
            h, g, i, k, m, l, n, t, q, p, r, s = b.glyphs[a] || b.glyphs["?"];
        if (s) {
            if (s.o) {
                b = s._cachedOutline || (s._cachedOutline = s.o.split(" "));
                k = b.length;
                for (a = 0; a < k;) switch (i = b[a++], i) {
                    case "m":
                        i = b[a++] * c + d;
                        m = b[a++] * c;
                        e.moveTo(i, m);
                        break;
                    case "l":
                        i = b[a++] * c + d;
                        m = b[a++] * c;
                        e.lineTo(i, m);
                        break;
                    case "q":
                        i = b[a++] *
                            c + d;
                        m = b[a++] * c;
                        t = b[a++] * c + d;
                        q = b[a++] * c;
                        e.quadraticCurveTo(t, q, i, m);
                        if (h = f[f.length - 1]) {
                            l = h.x;
                            n = h.y;
                            h = 1;
                            for (g = this.divisions; h <= g; h++) {
                                var u = h / g;
                                THREE.Shape.Utils.b2(u, l, t, i);
                                THREE.Shape.Utils.b2(u, n, q, m)
                            }
                        }
                        break;
                    case "b":
                        if (i = b[a++] * c + d, m = b[a++] * c, t = b[a++] * c + d, q = b[a++] * -c, p = b[a++] * c + d, r = b[a++] * -c, e.bezierCurveTo(i, m, t, q, p, r), h = f[f.length - 1]) {
                            l = h.x;
                            n = h.y;
                            h = 1;
                            for (g = this.divisions; h <= g; h++) u = h / g, THREE.Shape.Utils.b3(u, l, t, p, i), THREE.Shape.Utils.b3(u, n, q, r, m)
                        }
                }
            }
            return {
                offset: s.ha * c,
                path: e
            }
        }
    }
};
THREE.FontUtils.generateShapes = function(a, b) {
    var b = b || {},
        c = void 0 !== b.curveSegments ? b.curveSegments : 4,
        d = void 0 !== b.font ? b.font : "helvetiker",
        e = void 0 !== b.weight ? b.weight : "normal",
        f = void 0 !== b.style ? b.style : "normal";
    THREE.FontUtils.size = void 0 !== b.size ? b.size : 100;
    THREE.FontUtils.divisions = c;
    THREE.FontUtils.face = d;
    THREE.FontUtils.weight = e;
    THREE.FontUtils.style = f;
    c = THREE.FontUtils.drawText(a).paths;
    d = [];
    e = 0;
    for (f = c.length; e < f; e++) Array.prototype.push.apply(d, c[e].toShapes());
    return d
};
(function(a) {
    var b = function(a) {
        for (var b = a.length, e = 0, f = b - 1, h = 0; h < b; f = h++) e += a[f].x * a[h].y - a[h].x * a[f].y;
        return 0.5 * e
    };
    a.Triangulate = function(a, d) {
        var e = a.length;
        if (3 > e) return null;
        var f = [],
            h = [],
            g = [],
            i, k, m;
        if (0 < b(a))
            for (k = 0; k < e; k++) h[k] = k;
        else
            for (k = 0; k < e; k++) h[k] = e - 1 - k;
        var l = 2 * e;
        for (k = e - 1; 2 < e;) {
            if (0 >= l--) {
                console.log("Warning, unable to triangulate polygon!");
                break
            }
            i = k;
            e <= i && (i = 0);
            k = i + 1;
            e <= k && (k = 0);
            m = k + 1;
            e <= m && (m = 0);
            var n;
            a: {
                var t = n = void 0,
                    q = void 0,
                    p = void 0,
                    r = void 0,
                    s = void 0,
                    u = void 0,
                    w = void 0,
                    E =
                    void 0,
                    t = a[h[i]].x,
                    q = a[h[i]].y,
                    p = a[h[k]].x,
                    r = a[h[k]].y,
                    s = a[h[m]].x,
                    u = a[h[m]].y;
                if (1E-10 > (p - t) * (u - q) - (r - q) * (s - t)) n = !1;
                else {
                    var D = void 0,
                        F = void 0,
                        y = void 0,
                        x = void 0,
                        z = void 0,
                        O = void 0,
                        B = void 0,
                        C = void 0,
                        I = void 0,
                        v = void 0,
                        I = C = B = E = w = void 0,
                        D = s - p,
                        F = u - r,
                        y = t - s,
                        x = q - u,
                        z = p - t,
                        O = r - q;
                    for (n = 0; n < e; n++)
                        if (!(n === i || n === k || n === m))
                            if (w = a[h[n]].x, E = a[h[n]].y, B = w - t, C = E - q, I = w - p, v = E - r, w -= s, E -= u, I = D * v - F * I, B = z * C - O * B, C = y * E - x * w, -1E-10 <= I && -1E-10 <= C && -1E-10 <= B) {
                                n = !1;
                                break a
                            }
                    n = !0
                }
            }
            if (n) {
                f.push([a[h[i]], a[h[k]], a[h[m]]]);
                g.push([h[i],
                    h[k], h[m]
                ]);
                i = k;
                for (m = k + 1; m < e; i++, m++) h[i] = h[m];
                e--;
                l = 2 * e
            }
        }
        return d ? g : f
    };
    a.Triangulate.area = b;
    return a
})(THREE.FontUtils);
self._typeface_js = {
    faces: THREE.FontUtils.faces,
    loadFace: THREE.FontUtils.loadFace
};
THREE.typeface_js = self._typeface_js;
THREE.Curve = function() {};
THREE.Curve.prototype.getPoint = function() {
    console.log("Warning, getPoint() not implemented!");
    return null
};
THREE.Curve.prototype.getPointAt = function(a) {
    a = this.getUtoTmapping(a);
    return this.getPoint(a)
};
THREE.Curve.prototype.getPoints = function(a) {
    a || (a = 5);
    var b, c = [];
    for (b = 0; b <= a; b++) c.push(this.getPoint(b / a));
    return c
};
THREE.Curve.prototype.getSpacedPoints = function(a) {
    a || (a = 5);
    var b, c = [];
    for (b = 0; b <= a; b++) c.push(this.getPointAt(b / a));
    return c
};
THREE.Curve.prototype.getLength = function() {
    var a = this.getLengths();
    return a[a.length - 1]
};
THREE.Curve.prototype.getLengths = function(a) {
    a || (a = this.__arcLengthDivisions ? this.__arcLengthDivisions : 200);
    if (this.cacheArcLengths && this.cacheArcLengths.length == a + 1 && !this.needsUpdate) return this.cacheArcLengths;
    this.needsUpdate = !1;
    var b = [],
        c, d = this.getPoint(0),
        e, f = 0;
    b.push(0);
    for (e = 1; e <= a; e++) c = this.getPoint(e / a), f += c.distanceTo(d), b.push(f), d = c;
    return this.cacheArcLengths = b
};
THREE.Curve.prototype.updateArcLengths = function() {
    this.needsUpdate = !0;
    this.getLengths()
};
THREE.Curve.prototype.getUtoTmapping = function(a, b) {
    var c = this.getLengths(),
        d = 0,
        e = c.length,
        f;
    f = b ? b : a * c[e - 1];
    for (var h = 0, g = e - 1, i; h <= g;)
        if (d = Math.floor(h + (g - h) / 2), i = c[d] - f, 0 > i) h = d + 1;
        else if (0 < i) g = d - 1;
    else {
        g = d;
        break
    }
    d = g;
    if (c[d] == f) return d / (e - 1);
    h = c[d];
    return c = (d + (f - h) / (c[d + 1] - h)) / (e - 1)
};
THREE.Curve.prototype.getTangent = function(a) {
    var b = a - 1E-4,
        a = a + 1E-4;
    0 > b && (b = 0);
    1 < a && (a = 1);
    b = this.getPoint(b);
    return this.getPoint(a).clone().sub(b).normalize()
};
THREE.Curve.prototype.getTangentAt = function(a) {
    a = this.getUtoTmapping(a);
    return this.getTangent(a)
};
THREE.Curve.Utils = {
    tangentQuadraticBezier: function(a, b, c, d) {
        return 2 * (1 - a) * (c - b) + 2 * a * (d - c)
    },
    tangentCubicBezier: function(a, b, c, d, e) {
        return -3 * b * (1 - a) * (1 - a) + 3 * c * (1 - a) * (1 - a) - 6 * a * c * (1 - a) + 6 * a * d * (1 - a) - 3 * a * a * d + 3 * a * a * e
    },
    tangentSpline: function(a) {
        return 6 * a * a - 6 * a + (3 * a * a - 4 * a + 1) + (-6 * a * a + 6 * a) + (3 * a * a - 2 * a)
    },
    interpolate: function(a, b, c, d, e) {
        var a = 0.5 * (c - a),
            d = 0.5 * (d - b),
            f = e * e;
        return (2 * b - 2 * c + a + d) * e * f + (-3 * b + 3 * c - 2 * a - d) * f + a * e + b
    }
};
THREE.Curve.create = function(a, b) {
    a.prototype = Object.create(THREE.Curve.prototype);
    a.prototype.getPoint = b;
    return a
};
THREE.CurvePath = function() {
    this.curves = [];
    this.bends = [];
    this.autoClose = !1
};
THREE.CurvePath.prototype = Object.create(THREE.Curve.prototype);
THREE.CurvePath.prototype.add = function(a) {
    this.curves.push(a)
};
THREE.CurvePath.prototype.checkConnection = function() {};
THREE.CurvePath.prototype.closePath = function() {
    var a = this.curves[0].getPoint(0),
        b = this.curves[this.curves.length - 1].getPoint(1);
    a.equals(b) || this.curves.push(new THREE.LineCurve(b, a))
};
THREE.CurvePath.prototype.getPoint = function(a) {
    for (var b = a * this.getLength(), c = this.getCurveLengths(), a = 0; a < c.length;) {
        if (c[a] >= b) return b = c[a] - b, a = this.curves[a], b = 1 - b / a.getLength(), a.getPointAt(b);
        a++
    }
    return null
};
THREE.CurvePath.prototype.getLength = function() {
    var a = this.getCurveLengths();
    return a[a.length - 1]
};
THREE.CurvePath.prototype.getCurveLengths = function() {
    if (this.cacheLengths && this.cacheLengths.length == this.curves.length) return this.cacheLengths;
    var a = [],
        b = 0,
        c, d = this.curves.length;
    for (c = 0; c < d; c++) b += this.curves[c].getLength(), a.push(b);
    return this.cacheLengths = a
};
THREE.CurvePath.prototype.getBoundingBox = function() {
    var a = this.getPoints(),
        b, c, d, e, f, h;
    b = c = Number.NEGATIVE_INFINITY;
    e = f = Number.POSITIVE_INFINITY;
    var g, i, k, m, l = a[0] instanceof THREE.Vector3;
    m = l ? new THREE.Vector3 : new THREE.Vector2;
    i = 0;
    for (k = a.length; i < k; i++) g = a[i], g.x > b ? b = g.x : g.x < e && (e = g.x), g.y > c ? c = g.y : g.y < f && (f = g.y), l && (g.z > d ? d = g.z : g.z < h && (h = g.z)), m.add(g);
    a = {
        minX: e,
        minY: f,
        maxX: b,
        maxY: c,
        centroid: m.divideScalar(k)
    };
    l && (a.maxZ = d, a.minZ = h);
    return a
};
THREE.CurvePath.prototype.createPointsGeometry = function(a) {
    a = this.getPoints(a, !0);
    return this.createGeometry(a)
};
THREE.CurvePath.prototype.createSpacedPointsGeometry = function(a) {
    a = this.getSpacedPoints(a, !0);
    return this.createGeometry(a)
};
THREE.CurvePath.prototype.createGeometry = function(a) {
    for (var b = new THREE.Geometry, c = 0; c < a.length; c++) b.vertices.push(new THREE.Vector3(a[c].x, a[c].y, a[c].z || 0));
    return b
};
THREE.CurvePath.prototype.addWrapPath = function(a) {
    this.bends.push(a)
};
THREE.CurvePath.prototype.getTransformedPoints = function(a, b) {
    var c = this.getPoints(a),
        d, e;
    b || (b = this.bends);
    d = 0;
    for (e = b.length; d < e; d++) c = this.getWrapPoints(c, b[d]);
    return c
};
THREE.CurvePath.prototype.getTransformedSpacedPoints = function(a, b) {
    var c = this.getSpacedPoints(a),
        d, e;
    b || (b = this.bends);
    d = 0;
    for (e = b.length; d < e; d++) c = this.getWrapPoints(c, b[d]);
    return c
};
THREE.CurvePath.prototype.getWrapPoints = function(a, b) {
    var c = this.getBoundingBox(),
        d, e, f, h, g, i;
    d = 0;
    for (e = a.length; d < e; d++) f = a[d], h = f.x, g = f.y, i = h / c.maxX, i = b.getUtoTmapping(i, h), h = b.getPoint(i), g = b.getNormalVector(i).multiplyScalar(g), f.x = h.x + g.x, f.y = h.y + g.y;
    return a
};
THREE.Gyroscope = function() {
    THREE.Object3D.call(this)
};
THREE.Gyroscope.prototype = Object.create(THREE.Object3D.prototype);
THREE.Gyroscope.prototype.updateMatrixWorld = function(a) {
    this.matrixAutoUpdate && this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || a) this.parent ? (this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix), this.matrixWorld.decompose(this.translationWorld, this.quaternionWorld, this.scaleWorld), this.matrix.decompose(this.translationObject, this.quaternionObject, this.scaleObject), this.matrixWorld.compose(this.translationWorld, this.quaternionObject, this.scaleWorld)) : this.matrixWorld.copy(this.matrix),
        this.matrixWorldNeedsUpdate = !1, a = !0;
    for (var b = 0, c = this.children.length; b < c; b++) this.children[b].updateMatrixWorld(a)
};
THREE.Gyroscope.prototype.translationWorld = new THREE.Vector3;
THREE.Gyroscope.prototype.translationObject = new THREE.Vector3;
THREE.Gyroscope.prototype.quaternionWorld = new THREE.Quaternion;
THREE.Gyroscope.prototype.quaternionObject = new THREE.Quaternion;
THREE.Gyroscope.prototype.scaleWorld = new THREE.Vector3;
THREE.Gyroscope.prototype.scaleObject = new THREE.Vector3;
THREE.Path = function(a) {
    THREE.CurvePath.call(this);
    this.actions = [];
    a && this.fromPoints(a)
};
THREE.Path.prototype = Object.create(THREE.CurvePath.prototype);
THREE.PathActions = {
    MOVE_TO: "moveTo",
    LINE_TO: "lineTo",
    QUADRATIC_CURVE_TO: "quadraticCurveTo",
    BEZIER_CURVE_TO: "bezierCurveTo",
    CSPLINE_THRU: "splineThru",
    ARC: "arc",
    ELLIPSE: "ellipse"
};
THREE.Path.prototype.fromPoints = function(a) {
    this.moveTo(a[0].x, a[0].y);
    for (var b = 1, c = a.length; b < c; b++) this.lineTo(a[b].x, a[b].y)
};
THREE.Path.prototype.moveTo = function(a, b) {
    var c = Array.prototype.slice.call(arguments);
    this.actions.push({
        action: THREE.PathActions.MOVE_TO,
        args: c
    })
};
THREE.Path.prototype.lineTo = function(a, b) {
    var c = Array.prototype.slice.call(arguments),
        d = this.actions[this.actions.length - 1].args,
        d = new THREE.LineCurve(new THREE.Vector2(d[d.length - 2], d[d.length - 1]), new THREE.Vector2(a, b));
    this.curves.push(d);
    this.actions.push({
        action: THREE.PathActions.LINE_TO,
        args: c
    })
};
THREE.Path.prototype.quadraticCurveTo = function(a, b, c, d) {
    var e = Array.prototype.slice.call(arguments),
        f = this.actions[this.actions.length - 1].args,
        f = new THREE.QuadraticBezierCurve(new THREE.Vector2(f[f.length - 2], f[f.length - 1]), new THREE.Vector2(a, b), new THREE.Vector2(c, d));
    this.curves.push(f);
    this.actions.push({
        action: THREE.PathActions.QUADRATIC_CURVE_TO,
        args: e
    })
};
THREE.Path.prototype.bezierCurveTo = function(a, b, c, d, e, f) {
    var h = Array.prototype.slice.call(arguments),
        g = this.actions[this.actions.length - 1].args,
        g = new THREE.CubicBezierCurve(new THREE.Vector2(g[g.length - 2], g[g.length - 1]), new THREE.Vector2(a, b), new THREE.Vector2(c, d), new THREE.Vector2(e, f));
    this.curves.push(g);
    this.actions.push({
        action: THREE.PathActions.BEZIER_CURVE_TO,
        args: h
    })
};
THREE.Path.prototype.splineThru = function(a) {
    var b = Array.prototype.slice.call(arguments),
        c = this.actions[this.actions.length - 1].args,
        c = [new THREE.Vector2(c[c.length - 2], c[c.length - 1])];
    Array.prototype.push.apply(c, a);
    c = new THREE.SplineCurve(c);
    this.curves.push(c);
    this.actions.push({
        action: THREE.PathActions.CSPLINE_THRU,
        args: b
    })
};
THREE.Path.prototype.arc = function(a, b, c, d, e, f) {
    var h = this.actions[this.actions.length - 1].args;
    this.absarc(a + h[h.length - 2], b + h[h.length - 1], c, d, e, f)
};
THREE.Path.prototype.absarc = function(a, b, c, d, e, f) {
    this.absellipse(a, b, c, c, d, e, f)
};
THREE.Path.prototype.ellipse = function(a, b, c, d, e, f, h) {
    var g = this.actions[this.actions.length - 1].args;
    this.absellipse(a + g[g.length - 2], b + g[g.length - 1], c, d, e, f, h)
};
THREE.Path.prototype.absellipse = function(a, b, c, d, e, f, h) {
    var g = Array.prototype.slice.call(arguments),
        i = new THREE.EllipseCurve(a, b, c, d, e, f, h);
    this.curves.push(i);
    i = i.getPoint(h ? 1 : 0);
    g.push(i.x);
    g.push(i.y);
    this.actions.push({
        action: THREE.PathActions.ELLIPSE,
        args: g
    })
};
THREE.Path.prototype.getSpacedPoints = function(a) {
    a || (a = 40);
    for (var b = [], c = 0; c < a; c++) b.push(this.getPoint(c / a));
    return b
};
THREE.Path.prototype.getPoints = function(a, b) {
    if (this.useSpacedPoints) return console.log("tata"), this.getSpacedPoints(a, b);
    var a = a || 12,
        c = [],
        d, e, f, h, g, i, k, m, l, n, t, q, p;
    d = 0;
    for (e = this.actions.length; d < e; d++) switch (f = this.actions[d], h = f.action, f = f.args, h) {
        case THREE.PathActions.MOVE_TO:
            c.push(new THREE.Vector2(f[0], f[1]));
            break;
        case THREE.PathActions.LINE_TO:
            c.push(new THREE.Vector2(f[0], f[1]));
            break;
        case THREE.PathActions.QUADRATIC_CURVE_TO:
            g = f[2];
            i = f[3];
            l = f[0];
            n = f[1];
            0 < c.length ? (h = c[c.length - 1], t = h.x,
                q = h.y) : (h = this.actions[d - 1].args, t = h[h.length - 2], q = h[h.length - 1]);
            for (f = 1; f <= a; f++) p = f / a, h = THREE.Shape.Utils.b2(p, t, l, g), p = THREE.Shape.Utils.b2(p, q, n, i), c.push(new THREE.Vector2(h, p));
            break;
        case THREE.PathActions.BEZIER_CURVE_TO:
            g = f[4];
            i = f[5];
            l = f[0];
            n = f[1];
            k = f[2];
            m = f[3];
            0 < c.length ? (h = c[c.length - 1], t = h.x, q = h.y) : (h = this.actions[d - 1].args, t = h[h.length - 2], q = h[h.length - 1]);
            for (f = 1; f <= a; f++) p = f / a, h = THREE.Shape.Utils.b3(p, t, l, k, g), p = THREE.Shape.Utils.b3(p, q, n, m, i), c.push(new THREE.Vector2(h, p));
            break;
        case THREE.PathActions.CSPLINE_THRU:
            h =
                this.actions[d - 1].args;
            p = [new THREE.Vector2(h[h.length - 2], h[h.length - 1])];
            h = a * f[0].length;
            p = p.concat(f[0]);
            p = new THREE.SplineCurve(p);
            for (f = 1; f <= h; f++) c.push(p.getPointAt(f / h));
            break;
        case THREE.PathActions.ARC:
            g = f[0];
            i = f[1];
            n = f[2];
            k = f[3];
            h = f[4];
            l = !!f[5];
            t = h - k;
            q = 2 * a;
            for (f = 1; f <= q; f++) p = f / q, l || (p = 1 - p), p = k + p * t, h = g + n * Math.cos(p), p = i + n * Math.sin(p), c.push(new THREE.Vector2(h, p));
            break;
        case THREE.PathActions.ELLIPSE:
            g = f[0];
            i = f[1];
            n = f[2];
            m = f[3];
            k = f[4];
            h = f[5];
            l = !!f[6];
            t = h - k;
            q = 2 * a;
            for (f = 1; f <= q; f++) p = f / q, l ||
                (p = 1 - p), p = k + p * t, h = g + n * Math.cos(p), p = i + m * Math.sin(p), c.push(new THREE.Vector2(h, p))
    }
    d = c[c.length - 1];
    1E-10 > Math.abs(d.x - c[0].x) && 1E-10 > Math.abs(d.y - c[0].y) && c.splice(c.length - 1, 1);
    b && c.push(c[0]);
    return c
};
THREE.Path.prototype.toShapes = function(a) {
    var b, c, d, e, f = [],
        h = new THREE.Path;
    b = 0;
    for (c = this.actions.length; b < c; b++) d = this.actions[b], e = d.args, d = d.action, d == THREE.PathActions.MOVE_TO && 0 != h.actions.length && (f.push(h), h = new THREE.Path), h[d].apply(h, e);
    0 != h.actions.length && f.push(h);
    if (0 == f.length) return [];
    var g;
    e = [];
    if (1 == f.length) return d = f[0], g = new THREE.Shape, g.actions = d.actions, g.curves = d.curves, e.push(g), e;
    b = !THREE.Shape.Utils.isClockWise(f[0].getPoints());
    if (a ? !b : b) {
        g = new THREE.Shape;
        b = 0;
        for (c =
            f.length; b < c; b++) d = f[b], h = THREE.Shape.Utils.isClockWise(d.getPoints()), (h = a ? !h : h) ? (g.actions = d.actions, g.curves = d.curves, e.push(g), g = new THREE.Shape) : g.holes.push(d)
    } else {
        g = void 0;
        b = 0;
        for (c = f.length; b < c; b++) d = f[b], h = THREE.Shape.Utils.isClockWise(d.getPoints()), (h = a ? !h : h) ? (g && e.push(g), g = new THREE.Shape, g.actions = d.actions, g.curves = d.curves) : g.holes.push(d);
        e.push(g)
    }
    return e
};
THREE.Shape = function() {
    THREE.Path.apply(this, arguments);
    this.holes = []
};
THREE.Shape.prototype = Object.create(THREE.Path.prototype);
THREE.Shape.prototype.extrude = function(a) {
    return new THREE.ExtrudeGeometry(this, a)
};
THREE.Shape.prototype.makeGeometry = function(a) {
    return new THREE.ShapeGeometry(this, a)
};
THREE.Shape.prototype.getPointsHoles = function(a) {
    var b, c = this.holes.length,
        d = [];
    for (b = 0; b < c; b++) d[b] = this.holes[b].getTransformedPoints(a, this.bends);
    return d
};
THREE.Shape.prototype.getSpacedPointsHoles = function(a) {
    var b, c = this.holes.length,
        d = [];
    for (b = 0; b < c; b++) d[b] = this.holes[b].getTransformedSpacedPoints(a, this.bends);
    return d
};
THREE.Shape.prototype.extractAllPoints = function(a) {
    return {
        shape: this.getTransformedPoints(a),
        holes: this.getPointsHoles(a)
    }
};
THREE.Shape.prototype.extractPoints = function(a) {
    return this.useSpacedPoints ? this.extractAllSpacedPoints(a) : this.extractAllPoints(a)
};
THREE.Shape.prototype.extractAllSpacedPoints = function(a) {
    return {
        shape: this.getTransformedSpacedPoints(a),
        holes: this.getSpacedPointsHoles(a)
    }
};
THREE.Shape.Utils = {
    removeHoles: function(a, b) {
        var c = a.concat(),
            d = c.concat(),
            e, f, h, g, i, k, m, l, n, t, q = [];
        for (i = 0; i < b.length; i++) {
            k = b[i];
            Array.prototype.push.apply(d, k);
            f = Number.POSITIVE_INFINITY;
            for (e = 0; e < k.length; e++) {
                n = k[e];
                t = [];
                for (l = 0; l < c.length; l++) m = c[l], m = n.distanceToSquared(m), t.push(m), m < f && (f = m, h = e, g = l)
            }
            e = 0 <= g - 1 ? g - 1 : c.length - 1;
            f = 0 <= h - 1 ? h - 1 : k.length - 1;
            var p = [k[h], c[g], c[e]];
            l = THREE.FontUtils.Triangulate.area(p);
            var r = [k[h], k[f], c[g]];
            n = THREE.FontUtils.Triangulate.area(r);
            t = g;
            m = h;
            g += 1;
            h += -1;
            0 >
                g && (g += c.length);
            g %= c.length;
            0 > h && (h += k.length);
            h %= k.length;
            e = 0 <= g - 1 ? g - 1 : c.length - 1;
            f = 0 <= h - 1 ? h - 1 : k.length - 1;
            p = [k[h], c[g], c[e]];
            p = THREE.FontUtils.Triangulate.area(p);
            r = [k[h], k[f], c[g]];
            r = THREE.FontUtils.Triangulate.area(r);
            l + n > p + r && (g = t, h = m, 0 > g && (g += c.length), g %= c.length, 0 > h && (h += k.length), h %= k.length, e = 0 <= g - 1 ? g - 1 : c.length - 1, f = 0 <= h - 1 ? h - 1 : k.length - 1);
            l = c.slice(0, g);
            n = c.slice(g);
            t = k.slice(h);
            m = k.slice(0, h);
            f = [k[h], k[f], c[g]];
            q.push([k[h], c[g], c[e]]);
            q.push(f);
            c = l.concat(t).concat(m).concat(n)
        }
        return {
            shape: c,
            isolatedPts: q,
            allpoints: d
        }
    },
    triangulateShape: function(a, b) {
        var c = THREE.Shape.Utils.removeHoles(a, b),
            d = c.allpoints,
            e = c.isolatedPts,
            c = THREE.FontUtils.Triangulate(c.shape, !1),
            f, h, g, i, k = {};
        f = 0;
        for (h = d.length; f < h; f++) i = d[f].x + ":" + d[f].y, void 0 !== k[i] && console.log("Duplicate point", i), k[i] = f;
        f = 0;
        for (h = c.length; f < h; f++) {
            g = c[f];
            for (d = 0; 3 > d; d++) i = g[d].x + ":" + g[d].y, i = k[i], void 0 !== i && (g[d] = i)
        }
        f = 0;
        for (h = e.length; f < h; f++) {
            g = e[f];
            for (d = 0; 3 > d; d++) i = g[d].x + ":" + g[d].y, i = k[i], void 0 !== i && (g[d] = i)
        }
        return c.concat(e)
    },
    isClockWise: function(a) {
        return 0 > THREE.FontUtils.Triangulate.area(a)
    },
    b2p0: function(a, b) {
        var c = 1 - a;
        return c * c * b
    },
    b2p1: function(a, b) {
        return 2 * (1 - a) * a * b
    },
    b2p2: function(a, b) {
        return a * a * b
    },
    b2: function(a, b, c, d) {
        return this.b2p0(a, b) + this.b2p1(a, c) + this.b2p2(a, d)
    },
    b3p0: function(a, b) {
        var c = 1 - a;
        return c * c * c * b
    },
    b3p1: function(a, b) {
        var c = 1 - a;
        return 3 * c * c * a * b
    },
    b3p2: function(a, b) {
        return 3 * (1 - a) * a * a * b
    },
    b3p3: function(a, b) {
        return a * a * a * b
    },
    b3: function(a, b, c, d, e) {
        return this.b3p0(a, b) + this.b3p1(a, c) + this.b3p2(a, d) +
            this.b3p3(a, e)
    }
};
THREE.LineCurve = function(a, b) {
    this.v1 = a;
    this.v2 = b
};
THREE.LineCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.LineCurve.prototype.getPoint = function(a) {
    var b = this.v2.clone().sub(this.v1);
    b.multiplyScalar(a).add(this.v1);
    return b
};
THREE.LineCurve.prototype.getPointAt = function(a) {
    return this.getPoint(a)
};
THREE.LineCurve.prototype.getTangent = function() {
    return this.v2.clone().sub(this.v1).normalize()
};
THREE.QuadraticBezierCurve = function(a, b, c) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c
};
THREE.QuadraticBezierCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.QuadraticBezierCurve.prototype.getPoint = function(a) {
    var b;
    b = THREE.Shape.Utils.b2(a, this.v0.x, this.v1.x, this.v2.x);
    a = THREE.Shape.Utils.b2(a, this.v0.y, this.v1.y, this.v2.y);
    return new THREE.Vector2(b, a)
};
THREE.QuadraticBezierCurve.prototype.getTangent = function(a) {
    var b;
    b = THREE.Curve.Utils.tangentQuadraticBezier(a, this.v0.x, this.v1.x, this.v2.x);
    a = THREE.Curve.Utils.tangentQuadraticBezier(a, this.v0.y, this.v1.y, this.v2.y);
    b = new THREE.Vector2(b, a);
    b.normalize();
    return b
};
THREE.CubicBezierCurve = function(a, b, c, d) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c;
    this.v3 = d
};
THREE.CubicBezierCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.CubicBezierCurve.prototype.getPoint = function(a) {
    var b;
    b = THREE.Shape.Utils.b3(a, this.v0.x, this.v1.x, this.v2.x, this.v3.x);
    a = THREE.Shape.Utils.b3(a, this.v0.y, this.v1.y, this.v2.y, this.v3.y);
    return new THREE.Vector2(b, a)
};
THREE.CubicBezierCurve.prototype.getTangent = function(a) {
    var b;
    b = THREE.Curve.Utils.tangentCubicBezier(a, this.v0.x, this.v1.x, this.v2.x, this.v3.x);
    a = THREE.Curve.Utils.tangentCubicBezier(a, this.v0.y, this.v1.y, this.v2.y, this.v3.y);
    b = new THREE.Vector2(b, a);
    b.normalize();
    return b
};
THREE.SplineCurve = function(a) {
    this.points = void 0 == a ? [] : a
};
THREE.SplineCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.SplineCurve.prototype.getPoint = function(a) {
    var b = new THREE.Vector2,
        c = [],
        d = this.points,
        e;
    e = (d.length - 1) * a;
    a = Math.floor(e);
    e -= a;
    c[0] = 0 == a ? a : a - 1;
    c[1] = a;
    c[2] = a > d.length - 2 ? d.length - 1 : a + 1;
    c[3] = a > d.length - 3 ? d.length - 1 : a + 2;
    b.x = THREE.Curve.Utils.interpolate(d[c[0]].x, d[c[1]].x, d[c[2]].x, d[c[3]].x, e);
    b.y = THREE.Curve.Utils.interpolate(d[c[0]].y, d[c[1]].y, d[c[2]].y, d[c[3]].y, e);
    return b
};
THREE.EllipseCurve = function(a, b, c, d, e, f, h) {
    this.aX = a;
    this.aY = b;
    this.xRadius = c;
    this.yRadius = d;
    this.aStartAngle = e;
    this.aEndAngle = f;
    this.aClockwise = h
};
THREE.EllipseCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.EllipseCurve.prototype.getPoint = function(a) {
    var b = this.aEndAngle - this.aStartAngle;
    this.aClockwise || (a = 1 - a);
    b = this.aStartAngle + a * b;
    a = this.aX + this.xRadius * Math.cos(b);
    b = this.aY + this.yRadius * Math.sin(b);
    return new THREE.Vector2(a, b)
};
THREE.ArcCurve = function(a, b, c, d, e, f) {
    THREE.EllipseCurve.call(this, a, b, c, c, d, e, f)
};
THREE.ArcCurve.prototype = Object.create(THREE.EllipseCurve.prototype);
THREE.LineCurve3 = THREE.Curve.create(function(a, b) {
    this.v1 = a;
    this.v2 = b
}, function(a) {
    var b = new THREE.Vector3;
    b.subVectors(this.v2, this.v1);
    b.multiplyScalar(a);
    b.add(this.v1);
    return b
});
THREE.QuadraticBezierCurve3 = THREE.Curve.create(function(a, b, c) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c
}, function(a) {
    var b, c;
    b = THREE.Shape.Utils.b2(a, this.v0.x, this.v1.x, this.v2.x);
    c = THREE.Shape.Utils.b2(a, this.v0.y, this.v1.y, this.v2.y);
    a = THREE.Shape.Utils.b2(a, this.v0.z, this.v1.z, this.v2.z);
    return new THREE.Vector3(b, c, a)
});
THREE.CubicBezierCurve3 = THREE.Curve.create(function(a, b, c, d) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c;
    this.v3 = d
}, function(a) {
    var b, c;
    b = THREE.Shape.Utils.b3(a, this.v0.x, this.v1.x, this.v2.x, this.v3.x);
    c = THREE.Shape.Utils.b3(a, this.v0.y, this.v1.y, this.v2.y, this.v3.y);
    a = THREE.Shape.Utils.b3(a, this.v0.z, this.v1.z, this.v2.z, this.v3.z);
    return new THREE.Vector3(b, c, a)
});
THREE.SplineCurve3 = THREE.Curve.create(function(a) {
    this.points = void 0 == a ? [] : a
}, function(a) {
    var b = new THREE.Vector3,
        c = [],
        d = this.points,
        e, a = (d.length - 1) * a;
    e = Math.floor(a);
    a -= e;
    c[0] = 0 == e ? e : e - 1;
    c[1] = e;
    c[2] = e > d.length - 2 ? d.length - 1 : e + 1;
    c[3] = e > d.length - 3 ? d.length - 1 : e + 2;
    e = d[c[0]];
    var f = d[c[1]],
        h = d[c[2]],
        c = d[c[3]];
    b.x = THREE.Curve.Utils.interpolate(e.x, f.x, h.x, c.x, a);
    b.y = THREE.Curve.Utils.interpolate(e.y, f.y, h.y, c.y, a);
    b.z = THREE.Curve.Utils.interpolate(e.z, f.z, h.z, c.z, a);
    return b
});
THREE.ClosedSplineCurve3 = THREE.Curve.create(function(a) {
    this.points = void 0 == a ? [] : a
}, function(a) {
    var b = new THREE.Vector3,
        c = [],
        d = this.points,
        e;
    e = (d.length - 0) * a;
    a = Math.floor(e);
    e -= a;
    a += 0 < a ? 0 : (Math.floor(Math.abs(a) / d.length) + 1) * d.length;
    c[0] = (a - 1) % d.length;
    c[1] = a % d.length;
    c[2] = (a + 1) % d.length;
    c[3] = (a + 2) % d.length;
    b.x = THREE.Curve.Utils.interpolate(d[c[0]].x, d[c[1]].x, d[c[2]].x, d[c[3]].x, e);
    b.y = THREE.Curve.Utils.interpolate(d[c[0]].y, d[c[1]].y, d[c[2]].y, d[c[3]].y, e);
    b.z = THREE.Curve.Utils.interpolate(d[c[0]].z,
        d[c[1]].z, d[c[2]].z, d[c[3]].z, e);
    return b
});
THREE.AnimationHandler = function() {
    var a = [],
        b = {},
        c = {
            update: function(b) {
                for (var c = 0; c < a.length; c++) a[c].update(b)
            },
            addToUpdate: function(b) {
                -1 === a.indexOf(b) && a.push(b)
            },
            removeFromUpdate: function(b) {
                b = a.indexOf(b); - 1 !== b && a.splice(b, 1)
            },
            add: function(a) {
                void 0 !== b[a.name] && console.log("THREE.AnimationHandler.add: Warning! " + a.name + " already exists in library. Overwriting.");
                b[a.name] = a;
                if (!0 !== a.initialized) {
                    for (var c = 0; c < a.hierarchy.length; c++) {
                        for (var d = 0; d < a.hierarchy[c].keys.length; d++)
                            if (0 > a.hierarchy[c].keys[d].time &&
                                (a.hierarchy[c].keys[d].time = 0), void 0 !== a.hierarchy[c].keys[d].rot && !(a.hierarchy[c].keys[d].rot instanceof THREE.Quaternion)) {
                                var g = a.hierarchy[c].keys[d].rot;
                                a.hierarchy[c].keys[d].rot = new THREE.Quaternion(g[0], g[1], g[2], g[3])
                            }
                        if (a.hierarchy[c].keys.length && void 0 !== a.hierarchy[c].keys[0].morphTargets) {
                            g = {};
                            for (d = 0; d < a.hierarchy[c].keys.length; d++)
                                for (var i = 0; i < a.hierarchy[c].keys[d].morphTargets.length; i++) {
                                    var k = a.hierarchy[c].keys[d].morphTargets[i];
                                    g[k] = -1
                                }
                            a.hierarchy[c].usedMorphTargets = g;
                            for (d = 0; d < a.hierarchy[c].keys.length; d++) {
                                var m = {};
                                for (k in g) {
                                    for (i = 0; i < a.hierarchy[c].keys[d].morphTargets.length; i++)
                                        if (a.hierarchy[c].keys[d].morphTargets[i] === k) {
                                            m[k] = a.hierarchy[c].keys[d].morphTargetsInfluences[i];
                                            break
                                        }
                                    i === a.hierarchy[c].keys[d].morphTargets.length && (m[k] = 0)
                                }
                                a.hierarchy[c].keys[d].morphTargetsInfluences = m
                            }
                        }
                        for (d = 1; d < a.hierarchy[c].keys.length; d++) a.hierarchy[c].keys[d].time === a.hierarchy[c].keys[d - 1].time && (a.hierarchy[c].keys.splice(d, 1), d--);
                        for (d = 0; d < a.hierarchy[c].keys.length; d++) a.hierarchy[c].keys[d].index =
                            d
                    }
                    d = parseInt(a.length * a.fps, 10);
                    a.JIT = {};
                    a.JIT.hierarchy = [];
                    for (c = 0; c < a.hierarchy.length; c++) a.JIT.hierarchy.push(Array(d));
                    a.initialized = !0
                }
            },
            get: function(a) {
                if ("string" === typeof a) {
                    if (b[a]) return b[a];
                    console.log("THREE.AnimationHandler.get: Couldn't find animation " + a);
                    return null
                }
            },
            parse: function(a) {
                var b = [];
                if (a instanceof THREE.SkinnedMesh)
                    for (var c = 0; c < a.bones.length; c++) b.push(a.bones[c]);
                else d(a, b);
                return b
            }
        },
        d = function(a, b) {
            b.push(a);
            for (var c = 0; c < a.children.length; c++) d(a.children[c],
                b)
        };
    c.LINEAR = 0;
    c.CATMULLROM = 1;
    c.CATMULLROM_FORWARD = 2;
    return c
}();
THREE.Animation = function(a, b, c) {
    this.root = a;
    this.data = THREE.AnimationHandler.get(b);
    this.hierarchy = THREE.AnimationHandler.parse(a);
    this.currentTime = 0;
    this.timeScale = 1;
    this.isPlaying = !1;
    this.loop = this.isPaused = !0;
    this.interpolationType = void 0 !== c ? c : THREE.AnimationHandler.LINEAR;
    this.points = [];
    this.target = new THREE.Vector3
};
THREE.Animation.prototype.play = function(a, b) {
    if (!1 === this.isPlaying) {
        this.isPlaying = !0;
        this.loop = void 0 !== a ? a : !0;
        this.currentTime = void 0 !== b ? b : 0;
        var c, d = this.hierarchy.length,
            e;
        for (c = 0; c < d; c++) {
            e = this.hierarchy[c];
            e.matrixAutoUpdate = !0;
            void 0 === e.animationCache && (e.animationCache = {}, e.animationCache.prevKey = {
                pos: 0,
                rot: 0,
                scl: 0
            }, e.animationCache.nextKey = {
                pos: 0,
                rot: 0,
                scl: 0
            }, e.animationCache.originalMatrix = e instanceof THREE.Bone ? e.skinMatrix : e.matrix);
            var f = e.animationCache.prevKey;
            e = e.animationCache.nextKey;
            f.pos = this.data.hierarchy[c].keys[0];
            f.rot = this.data.hierarchy[c].keys[0];
            f.scl = this.data.hierarchy[c].keys[0];
            e.pos = this.getNextKeyWith("pos", c, 1);
            e.rot = this.getNextKeyWith("rot", c, 1);
            e.scl = this.getNextKeyWith("scl", c, 1)
        }
        this.update(0)
    }
    this.isPaused = !1;
    THREE.AnimationHandler.addToUpdate(this)
};
THREE.Animation.prototype.pause = function() {
    !0 === this.isPaused ? THREE.AnimationHandler.addToUpdate(this) : THREE.AnimationHandler.removeFromUpdate(this);
    this.isPaused = !this.isPaused
};
THREE.Animation.prototype.stop = function() {
    this.isPaused = this.isPlaying = !1;
    THREE.AnimationHandler.removeFromUpdate(this)
};
THREE.Animation.prototype.update = function(a) {
    if (!1 !== this.isPlaying) {
        var b = ["pos", "rot", "scl"],
            c, d, e, f, h, g, i, k, m;
        m = this.currentTime += a * this.timeScale;
        k = this.currentTime %= this.data.length;
        parseInt(Math.min(k * this.data.fps, this.data.length * this.data.fps), 10);
        for (var l = 0, n = this.hierarchy.length; l < n; l++) {
            a = this.hierarchy[l];
            i = a.animationCache;
            for (var t = 0; 3 > t; t++) {
                c = b[t];
                h = i.prevKey[c];
                g = i.nextKey[c];
                if (g.time <= m) {
                    if (k < m)
                        if (this.loop) {
                            h = this.data.hierarchy[l].keys[0];
                            for (g = this.getNextKeyWith(c, l, 1); g.time <
                                k;) h = g, g = this.getNextKeyWith(c, l, g.index + 1)
                        } else {
                            this.stop();
                            return
                        } else {
                        do h = g, g = this.getNextKeyWith(c, l, g.index + 1); while (g.time < k)
                    }
                    i.prevKey[c] = h;
                    i.nextKey[c] = g
                }
                a.matrixAutoUpdate = !0;
                a.matrixWorldNeedsUpdate = !0;
                d = (k - h.time) / (g.time - h.time);
                e = h[c];
                f = g[c];
                if (0 > d || 1 < d) console.log("THREE.Animation.update: Warning! Scale out of bounds:" + d + " on bone " + l), d = 0 > d ? 0 : 1;
                if ("pos" === c)
                    if (c = a.position, this.interpolationType === THREE.AnimationHandler.LINEAR) c.x = e[0] + (f[0] - e[0]) * d, c.y = e[1] + (f[1] - e[1]) * d, c.z = e[2] +
                        (f[2] - e[2]) * d;
                    else {
                        if (this.interpolationType === THREE.AnimationHandler.CATMULLROM || this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD) this.points[0] = this.getPrevKeyWith("pos", l, h.index - 1).pos, this.points[1] = e, this.points[2] = f, this.points[3] = this.getNextKeyWith("pos", l, g.index + 1).pos, d = 0.33 * d + 0.33, e = this.interpolateCatmullRom(this.points, d), c.x = e[0], c.y = e[1], c.z = e[2], this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD && (d = this.interpolateCatmullRom(this.points, 1.01 * d),
                            this.target.set(d[0], d[1], d[2]), this.target.sub(c), this.target.y = 0, this.target.normalize(), d = Math.atan2(this.target.x, this.target.z), a.rotation.set(0, d, 0))
                    } else "rot" === c ? THREE.Quaternion.slerp(e, f, a.quaternion, d) : "scl" === c && (c = a.scale, c.x = e[0] + (f[0] - e[0]) * d, c.y = e[1] + (f[1] - e[1]) * d, c.z = e[2] + (f[2] - e[2]) * d)
            }
        }
    }
};
THREE.Animation.prototype.interpolateCatmullRom = function(a, b) {
    var c = [],
        d = [],
        e, f, h, g, i, k;
    e = (a.length - 1) * b;
    f = Math.floor(e);
    e -= f;
    c[0] = 0 === f ? f : f - 1;
    c[1] = f;
    c[2] = f > a.length - 2 ? f : f + 1;
    c[3] = f > a.length - 3 ? f : f + 2;
    f = a[c[0]];
    g = a[c[1]];
    i = a[c[2]];
    k = a[c[3]];
    c = e * e;
    h = e * c;
    d[0] = this.interpolate(f[0], g[0], i[0], k[0], e, c, h);
    d[1] = this.interpolate(f[1], g[1], i[1], k[1], e, c, h);
    d[2] = this.interpolate(f[2], g[2], i[2], k[2], e, c, h);
    return d
};
THREE.Animation.prototype.interpolate = function(a, b, c, d, e, f, h) {
    a = 0.5 * (c - a);
    d = 0.5 * (d - b);
    return (2 * (b - c) + a + d) * h + (-3 * (b - c) - 2 * a - d) * f + a * e + b
};
THREE.Animation.prototype.getNextKeyWith = function(a, b, c) {
    for (var d = this.data.hierarchy[b].keys, c = this.interpolationType === THREE.AnimationHandler.CATMULLROM || this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ? c < d.length - 1 ? c : d.length - 1 : c % d.length; c < d.length; c++)
        if (void 0 !== d[c][a]) return d[c];
    return this.data.hierarchy[b].keys[0]
};
THREE.Animation.prototype.getPrevKeyWith = function(a, b, c) {
    for (var d = this.data.hierarchy[b].keys, c = this.interpolationType === THREE.AnimationHandler.CATMULLROM || this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ? 0 < c ? c : 0 : 0 <= c ? c : c + d.length; 0 <= c; c--)
        if (void 0 !== d[c][a]) return d[c];
    return this.data.hierarchy[b].keys[d.length - 1]
};
THREE.KeyFrameAnimation = function(a, b, c) {
    this.root = a;
    this.data = THREE.AnimationHandler.get(b);
    this.hierarchy = THREE.AnimationHandler.parse(a);
    this.currentTime = 0;
    this.timeScale = 0.0010;
    this.isPlaying = !1;
    this.loop = this.isPaused = !0;
    this.JITCompile = void 0 !== c ? c : !0;
    a = 0;
    for (b = this.hierarchy.length; a < b; a++) {
        var c = this.data.hierarchy[a].sids,
            d = this.hierarchy[a];
        if (this.data.hierarchy[a].keys.length && c) {
            for (var e = 0; e < c.length; e++) {
                var f = c[e],
                    h = this.getNextKeyWith(f, a, 0);
                h && h.apply(f)
            }
            d.matrixAutoUpdate = !1;
            this.data.hierarchy[a].node.updateMatrix();
            d.matrixWorldNeedsUpdate = !0
        }
    }
};
THREE.KeyFrameAnimation.prototype.play = function(a, b) {
    if (!this.isPlaying) {
        this.isPlaying = !0;
        this.loop = void 0 !== a ? a : !0;
        this.currentTime = void 0 !== b ? b : 0;
        this.startTimeMs = b;
        this.startTime = 1E7;
        this.endTime = -this.startTime;
        var c, d = this.hierarchy.length,
            e, f;
        for (c = 0; c < d; c++) e = this.hierarchy[c], f = this.data.hierarchy[c], void 0 === f.animationCache && (f.animationCache = {}, f.animationCache.prevKey = null, f.animationCache.nextKey = null, f.animationCache.originalMatrix = e instanceof THREE.Bone ? e.skinMatrix : e.matrix), e = this.data.hierarchy[c].keys,
            e.length && (f.animationCache.prevKey = e[0], f.animationCache.nextKey = e[1], this.startTime = Math.min(e[0].time, this.startTime), this.endTime = Math.max(e[e.length - 1].time, this.endTime));
        this.update(0)
    }
    this.isPaused = !1;
    THREE.AnimationHandler.addToUpdate(this)
};
THREE.KeyFrameAnimation.prototype.pause = function() {
    this.isPaused ? THREE.AnimationHandler.addToUpdate(this) : THREE.AnimationHandler.removeFromUpdate(this);
    this.isPaused = !this.isPaused
};
THREE.KeyFrameAnimation.prototype.stop = function() {
    this.isPaused = this.isPlaying = !1;
    THREE.AnimationHandler.removeFromUpdate(this);
    for (var a = 0; a < this.data.hierarchy.length; a++) {
        var b = this.hierarchy[a],
            c = this.data.hierarchy[a];
        if (void 0 !== c.animationCache) {
            var d = c.animationCache.originalMatrix;
            b instanceof THREE.Bone ? (d.copy(b.skinMatrix), b.skinMatrix = d) : (d.copy(b.matrix), b.matrix = d);
            delete c.animationCache
        }
    }
};
THREE.KeyFrameAnimation.prototype.update = function(a) {
    if (this.isPlaying) {
        var b, c, d, e, f = this.data.JIT.hierarchy,
            h, g, i;
        g = this.currentTime += a * this.timeScale;
        h = this.currentTime %= this.data.length;
        h < this.startTimeMs && (h = this.currentTime = this.startTimeMs + h);
        e = parseInt(Math.min(h * this.data.fps, this.data.length * this.data.fps), 10);
        if ((i = h < g) && !this.loop) {
            for (var a = 0, k = this.hierarchy.length; a < k; a++) {
                var m = this.data.hierarchy[a].keys,
                    f = this.data.hierarchy[a].sids;
                d = m.length - 1;
                e = this.hierarchy[a];
                if (m.length) {
                    for (m =
                        0; m < f.length; m++) h = f[m], (g = this.getPrevKeyWith(h, a, d)) && g.apply(h);
                    this.data.hierarchy[a].node.updateMatrix();
                    e.matrixWorldNeedsUpdate = !0
                }
            }
            this.stop()
        } else if (!(h < this.startTime)) {
            a = 0;
            for (k = this.hierarchy.length; a < k; a++) {
                d = this.hierarchy[a];
                b = this.data.hierarchy[a];
                var m = b.keys,
                    l = b.animationCache;
                if (this.JITCompile && void 0 !== f[a][e]) d instanceof THREE.Bone ? (d.skinMatrix = f[a][e], d.matrixWorldNeedsUpdate = !1) : (d.matrix = f[a][e], d.matrixWorldNeedsUpdate = !0);
                else if (m.length) {
                    this.JITCompile && l && (d instanceof THREE.Bone ? d.skinMatrix = l.originalMatrix : d.matrix = l.originalMatrix);
                    b = l.prevKey;
                    c = l.nextKey;
                    if (b && c) {
                        if (c.time <= g) {
                            if (i && this.loop) {
                                b = m[0];
                                for (c = m[1]; c.time < h;) b = c, c = m[b.index + 1]
                            } else if (!i)
                                for (var n = m.length - 1; c.time < h && c.index !== n;) b = c, c = m[b.index + 1];
                            l.prevKey = b;
                            l.nextKey = c
                        }
                        c.time >= h ? b.interpolate(c, h) : b.interpolate(c, c.time)
                    }
                    this.data.hierarchy[a].node.updateMatrix();
                    d.matrixWorldNeedsUpdate = !0
                }
            }
            if (this.JITCompile && void 0 === f[0][e]) {
                this.hierarchy[0].updateMatrixWorld(!0);
                for (a = 0; a < this.hierarchy.length; a++) f[a][e] =
                    this.hierarchy[a] instanceof THREE.Bone ? this.hierarchy[a].skinMatrix.clone() : this.hierarchy[a].matrix.clone()
            }
        }
    }
};
THREE.KeyFrameAnimation.prototype.getNextKeyWith = function(a, b, c) {
    b = this.data.hierarchy[b].keys;
    for (c %= b.length; c < b.length; c++)
        if (b[c].hasTarget(a)) return b[c];
    return b[0]
};
THREE.KeyFrameAnimation.prototype.getPrevKeyWith = function(a, b, c) {
    b = this.data.hierarchy[b].keys;
    for (c = 0 <= c ? c : c + b.length; 0 <= c; c--)
        if (b[c].hasTarget(a)) return b[c];
    return b[b.length - 1]
};
THREE.CubeCamera = function(a, b, c) {
    THREE.Object3D.call(this);
    var d = new THREE.PerspectiveCamera(90, 1, a, b);
    d.up.set(0, -1, 0);
    d.lookAt(new THREE.Vector3(1, 0, 0));
    this.add(d);
    var e = new THREE.PerspectiveCamera(90, 1, a, b);
    e.up.set(0, -1, 0);
    e.lookAt(new THREE.Vector3(-1, 0, 0));
    this.add(e);
    var f = new THREE.PerspectiveCamera(90, 1, a, b);
    f.up.set(0, 0, 1);
    f.lookAt(new THREE.Vector3(0, 1, 0));
    this.add(f);
    var h = new THREE.PerspectiveCamera(90, 1, a, b);
    h.up.set(0, 0, -1);
    h.lookAt(new THREE.Vector3(0, -1, 0));
    this.add(h);
    var g = new THREE.PerspectiveCamera(90,
        1, a, b);
    g.up.set(0, -1, 0);
    g.lookAt(new THREE.Vector3(0, 0, 1));
    this.add(g);
    var i = new THREE.PerspectiveCamera(90, 1, a, b);
    i.up.set(0, -1, 0);
    i.lookAt(new THREE.Vector3(0, 0, -1));
    this.add(i);
    this.renderTarget = new THREE.WebGLRenderTargetCube(c, c, {
        format: THREE.RGBFormat,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter
    });
    this.updateCubeMap = function(a, b) {
        var c = this.renderTarget,
            n = c.generateMipmaps;
        c.generateMipmaps = !1;
        c.activeCubeFace = 0;
        a.render(b, d, c);
        c.activeCubeFace = 1;
        a.render(b, e, c);
        c.activeCubeFace =
            2;
        a.render(b, f, c);
        c.activeCubeFace = 3;
        a.render(b, h, c);
        c.activeCubeFace = 4;
        a.render(b, g, c);
        c.generateMipmaps = n;
        c.activeCubeFace = 5;
        a.render(b, i, c)
    }
};
THREE.CubeCamera.prototype = Object.create(THREE.Object3D.prototype);
THREE.CombinedCamera = function(a, b, c, d, e, f, h) {
    THREE.Camera.call(this);
    this.fov = c;
    this.left = -a / 2;
    this.right = a / 2;
    this.top = b / 2;
    this.bottom = -b / 2;
    this.cameraO = new THREE.OrthographicCamera(a / -2, a / 2, b / 2, b / -2, f, h);
    this.cameraP = new THREE.PerspectiveCamera(c, a / b, d, e);
    this.zoom = 1;
    this.toPerspective()
};
THREE.CombinedCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.CombinedCamera.prototype.toPerspective = function() {
    this.near = this.cameraP.near;
    this.far = this.cameraP.far;
    this.cameraP.fov = this.fov / this.zoom;
    this.cameraP.updateProjectionMatrix();
    this.projectionMatrix = this.cameraP.projectionMatrix;
    this.inPerspectiveMode = !0;
    this.inOrthographicMode = !1
};
THREE.CombinedCamera.prototype.toOrthographic = function() {
    var a = this.cameraP.aspect,
        b = (this.cameraP.near + this.cameraP.far) / 2,
        b = Math.tan(this.fov / 2) * b,
        a = 2 * b * a / 2,
        b = b / this.zoom,
        a = a / this.zoom;
    this.cameraO.left = -a;
    this.cameraO.right = a;
    this.cameraO.top = b;
    this.cameraO.bottom = -b;
    this.cameraO.updateProjectionMatrix();
    this.near = this.cameraO.near;
    this.far = this.cameraO.far;
    this.projectionMatrix = this.cameraO.projectionMatrix;
    this.inPerspectiveMode = !1;
    this.inOrthographicMode = !0
};
THREE.CombinedCamera.prototype.setSize = function(a, b) {
    this.cameraP.aspect = a / b;
    this.left = -a / 2;
    this.right = a / 2;
    this.top = b / 2;
    this.bottom = -b / 2
};
THREE.CombinedCamera.prototype.setFov = function(a) {
    this.fov = a;
    this.inPerspectiveMode ? this.toPerspective() : this.toOrthographic()
};
THREE.CombinedCamera.prototype.updateProjectionMatrix = function() {
    this.inPerspectiveMode ? this.toPerspective() : (this.toPerspective(), this.toOrthographic())
};
THREE.CombinedCamera.prototype.setLens = function(a, b) {
    void 0 === b && (b = 24);
    var c = 2 * THREE.Math.radToDeg(Math.atan(b / (2 * a)));
    this.setFov(c);
    return c
};
THREE.CombinedCamera.prototype.setZoom = function(a) {
    this.zoom = a;
    this.inPerspectiveMode ? this.toPerspective() : this.toOrthographic()
};
THREE.CombinedCamera.prototype.toFrontView = function() {
    this.rotation.x = 0;
    this.rotation.y = 0;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CombinedCamera.prototype.toBackView = function() {
    this.rotation.x = 0;
    this.rotation.y = Math.PI;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CombinedCamera.prototype.toLeftView = function() {
    this.rotation.x = 0;
    this.rotation.y = -Math.PI / 2;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CombinedCamera.prototype.toRightView = function() {
    this.rotation.x = 0;
    this.rotation.y = Math.PI / 2;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CombinedCamera.prototype.toTopView = function() {
    this.rotation.x = -Math.PI / 2;
    this.rotation.y = 0;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CombinedCamera.prototype.toBottomView = function() {
    this.rotation.x = Math.PI / 2;
    this.rotation.y = 0;
    this.rotation.z = 0;
    this.rotationAutoUpdate = !1
};
THREE.CircleGeometry = function(a, b, c, d) {
    THREE.Geometry.call(this);
    var a = a || 50,
        c = void 0 !== c ? c : 0,
        d = void 0 !== d ? d : 2 * Math.PI,
        b = void 0 !== b ? Math.max(3, b) : 8,
        e, f = [];
    e = new THREE.Vector3;
    var h = new THREE.Vector2(0.5, 0.5);
    this.vertices.push(e);
    f.push(h);
    for (e = 0; e <= b; e++) {
        var g = new THREE.Vector3,
            i = c + e / b * d;
        g.x = a * Math.cos(i);
        g.y = a * Math.sin(i);
        this.vertices.push(g);
        f.push(new THREE.Vector2((g.x / a + 1) / 2, (g.y / a + 1) / 2))
    }
    c = new THREE.Vector3(0, 0, 1);
    for (e = 1; e <= b; e++) this.faces.push(new THREE.Face3(e, e + 1, 0, [c, c, c])), this.faceVertexUvs[0].push([f[e],
        f[e + 1], h
    ]);
    this.computeCentroids();
    this.computeFaceNormals();
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3, a)
};
THREE.CircleGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.CubeGeometry = function(a, b, c, d, e, f) {
    function h(a, b, c, d, e, f, h, p) {
        var r, s = g.widthSegments,
            u = g.heightSegments,
            w = e / 2,
            E = f / 2,
            D = g.vertices.length;
        if ("x" === a && "y" === b || "y" === a && "x" === b) r = "z";
        else if ("x" === a && "z" === b || "z" === a && "x" === b) r = "y", u = g.depthSegments;
        else if ("z" === a && "y" === b || "y" === a && "z" === b) r = "x", s = g.depthSegments;
        var F = s + 1,
            y = u + 1,
            x = e / s,
            z = f / u,
            O = new THREE.Vector3;
        O[r] = 0 < h ? 1 : -1;
        for (e = 0; e < y; e++)
            for (f = 0; f < F; f++) {
                var B = new THREE.Vector3;
                B[a] = (f * x - w) * c;
                B[b] = (e * z - E) * d;
                B[r] = h;
                g.vertices.push(B)
            }
        for (e =
            0; e < u; e++)
            for (f = 0; f < s; f++) E = f + F * e, a = f + F * (e + 1), b = f + 1 + F * (e + 1), c = f + 1 + F * e, d = new THREE.Vector2(f / s, 1 - e / u), h = new THREE.Vector2(f / s, 1 - (e + 1) / u), r = new THREE.Vector2((f + 1) / s, 1 - (e + 1) / u), w = new THREE.Vector2((f + 1) / s, 1 - e / u), E = new THREE.Face3(E + D, a + D, c + D), E.normal.copy(O), E.vertexNormals.push(O.clone(), O.clone(), O.clone()), E.materialIndex = p, g.faces.push(E), g.faceVertexUvs[0].push([d, h, w]), E = new THREE.Face3(a + D, b + D, c + D), E.normal.copy(O), E.vertexNormals.push(O.clone(), O.clone(), O.clone()), E.materialIndex = p, g.faces.push(E),
                g.faceVertexUvs[0].push([h.clone(), r, w.clone()])
    }
    THREE.Geometry.call(this);
    var g = this;
    this.width = a;
    this.height = b;
    this.depth = c;
    this.widthSegments = d || 1;
    this.heightSegments = e || 1;
    this.depthSegments = f || 1;
    a = this.width / 2;
    b = this.height / 2;
    c = this.depth / 2;
    h("z", "y", -1, -1, this.depth, this.height, a, 0);
    h("z", "y", 1, -1, this.depth, this.height, -a, 1);
    h("x", "z", 1, 1, this.width, this.depth, b, 2);
    h("x", "z", 1, -1, this.width, this.depth, -b, 3);
    h("x", "y", 1, -1, this.width, this.height, c, 4);
    h("x", "y", -1, -1, this.width, this.height, -c,
        5);
    this.computeCentroids();
    this.mergeVertices()
};
THREE.CubeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.CylinderGeometry = function(a, b, c, d, e, f) {
    THREE.Geometry.call(this);
    this.radiusTop = a = void 0 !== a ? a : 20;
    this.radiusBottom = b = void 0 !== b ? b : 20;
    this.height = c = void 0 !== c ? c : 100;
    this.radialSegments = d = d || 8;
    this.heightSegments = e = e || 1;
    this.openEnded = f = void 0 !== f ? f : !1;
    var h = c / 2,
        g, i, k = [],
        m = [];
    for (i = 0; i <= e; i++) {
        var l = [],
            n = [],
            t = i / e,
            q = t * (b - a) + a;
        for (g = 0; g <= d; g++) {
            var p = g / d,
                r = new THREE.Vector3;
            r.x = q * Math.sin(2 * p * Math.PI);
            r.y = -t * c + h;
            r.z = q * Math.cos(2 * p * Math.PI);
            this.vertices.push(r);
            l.push(this.vertices.length - 1);
            n.push(new THREE.Vector2(p,
                1 - t))
        }
        k.push(l);
        m.push(n)
    }
    c = (b - a) / c;
    for (g = 0; g < d; g++) {
        0 !== a ? (l = this.vertices[k[0][g]].clone(), n = this.vertices[k[0][g + 1]].clone()) : (l = this.vertices[k[1][g]].clone(), n = this.vertices[k[1][g + 1]].clone());
        l.setY(Math.sqrt(l.x * l.x + l.z * l.z) * c).normalize();
        n.setY(Math.sqrt(n.x * n.x + n.z * n.z) * c).normalize();
        for (i = 0; i < e; i++) {
            var t = k[i][g],
                q = k[i + 1][g],
                p = k[i + 1][g + 1],
                r = k[i][g + 1],
                s = l.clone(),
                u = l.clone(),
                w = n.clone(),
                E = n.clone(),
                D = m[i][g].clone(),
                F = m[i + 1][g].clone(),
                y = m[i + 1][g + 1].clone(),
                x = m[i][g + 1].clone();
            this.faces.push(new THREE.Face3(t,
                q, r, [s, u, E]));
            this.faceVertexUvs[0].push([D, F, x]);
            this.faces.push(new THREE.Face3(q, p, r, [u, w, E]));
            this.faceVertexUvs[0].push([F, y, x])
        }
    }
    if (!1 === f && 0 < a) {
        this.vertices.push(new THREE.Vector3(0, h, 0));
        for (g = 0; g < d; g++) t = k[0][g], q = k[0][g + 1], p = this.vertices.length - 1, s = new THREE.Vector3(0, 1, 0), u = new THREE.Vector3(0, 1, 0), w = new THREE.Vector3(0, 1, 0), D = m[0][g].clone(), F = m[0][g + 1].clone(), y = new THREE.Vector2(F.u, 0), this.faces.push(new THREE.Face3(t, q, p, [s, u, w])), this.faceVertexUvs[0].push([D, F, y])
    }
    if (!1 === f && 0 <
        b) {
        this.vertices.push(new THREE.Vector3(0, -h, 0));
        for (g = 0; g < d; g++) t = k[i][g + 1], q = k[i][g], p = this.vertices.length - 1, s = new THREE.Vector3(0, -1, 0), u = new THREE.Vector3(0, -1, 0), w = new THREE.Vector3(0, -1, 0), D = m[i][g + 1].clone(), F = m[i][g].clone(), y = new THREE.Vector2(F.u, 1), this.faces.push(new THREE.Face3(t, q, p, [s, u, w])), this.faceVertexUvs[0].push([D, F, y])
    }
    this.computeCentroids();
    this.computeFaceNormals()
};
THREE.CylinderGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ExtrudeGeometry = function(a, b) {
    "undefined" !== typeof a && (THREE.Geometry.call(this), a = a instanceof Array ? a : [a], this.shapebb = a[a.length - 1].getBoundingBox(), this.addShapeList(a, b), this.computeCentroids(), this.computeFaceNormals())
};
THREE.ExtrudeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ExtrudeGeometry.prototype.addShapeList = function(a, b) {
    for (var c = a.length, d = 0; d < c; d++) this.addShape(a[d], b)
};
THREE.ExtrudeGeometry.prototype.addShape = function(a, b) {
    function c(a, b, c) {
        b || console.log("die");
        return b.clone().multiplyScalar(c).add(a)
    }

    function d(a, b, c) {
        var d = THREE.ExtrudeGeometry.__v1,
            e = THREE.ExtrudeGeometry.__v2,
            f = THREE.ExtrudeGeometry.__v3,
            g = THREE.ExtrudeGeometry.__v4,
            h = THREE.ExtrudeGeometry.__v5,
            i = THREE.ExtrudeGeometry.__v6;
        d.set(a.x - b.x, a.y - b.y);
        e.set(a.x - c.x, a.y - c.y);
        d = d.normalize();
        e = e.normalize();
        f.set(-d.y, d.x);
        g.set(e.y, -e.x);
        h.copy(a).add(f);
        i.copy(a).add(g);
        if (h.equals(i)) return g.clone();
        h.copy(b).add(f);
        i.copy(c).add(g);
        f = d.dot(g);
        g = i.sub(h).dot(g);
        0 === f && (console.log("Either infinite or no solutions!"), 0 === g ? console.log("Its finite solutions.") : console.log("Too bad, no solutions."));
        g /= f;
        return 0 > g ? (b = Math.atan2(b.y - a.y, b.x - a.x), a = Math.atan2(c.y - a.y, c.x - a.x), b > a && (a += 2 * Math.PI), c = (b + a) / 2, a = -Math.cos(c), c = -Math.sin(c), new THREE.Vector2(a, c)) : d.multiplyScalar(g).add(h).sub(a).clone()
    }

    function e(c, d) {
        var e, f;
        for (N = c.length; 0 <= --N;) {
            e = N;
            f = N - 1;
            0 > f && (f = c.length - 1);
            for (var g = 0, h = t + 2 * m,
                    g = 0; g < h; g++) {
                var i = ca * g,
                    k = ca * (g + 1),
                    l = d + e + i,
                    i = d + f + i,
                    n = d + f + k,
                    k = d + e + k,
                    p = c,
                    q = g,
                    r = h,
                    s = e,
                    v = f,
                    l = l + C,
                    i = i + C,
                    n = n + C,
                    k = k + C;
                B.faces.push(new THREE.Face3(l, i, k, null, null, u));
                B.faces.push(new THREE.Face3(i, n, k, null, null, u));
                l = w.generateSideWallUV(B, a, p, b, l, i, n, k, q, r, s, v);
                B.faceVertexUvs[0].push([l[0], l[1], l[3]]);
                B.faceVertexUvs[0].push([l[1], l[2], l[3]])
            }
        }
    }

    function f(a, b, c) {
        B.vertices.push(new THREE.Vector3(a, b, c))
    }

    function h(c, d, e, f) {
        c += C;
        d += C;
        e += C;
        B.faces.push(new THREE.Face3(c, d, e, null, null, s));
        c = f ? w.generateBottomUV(B,
            a, b, c, d, e) : w.generateTopUV(B, a, b, c, d, e);
        B.faceVertexUvs[0].push(c)
    }
    var g = void 0 !== b.amount ? b.amount : 100,
        i = void 0 !== b.bevelThickness ? b.bevelThickness : 6,
        k = void 0 !== b.bevelSize ? b.bevelSize : i - 2,
        m = void 0 !== b.bevelSegments ? b.bevelSegments : 3,
        l = void 0 !== b.bevelEnabled ? b.bevelEnabled : !0,
        n = void 0 !== b.curveSegments ? b.curveSegments : 12,
        t = void 0 !== b.steps ? b.steps : 1,
        q = b.extrudePath,
        p, r = !1,
        s = b.material,
        u = b.extrudeMaterial,
        w = void 0 !== b.UVGenerator ? b.UVGenerator : THREE.ExtrudeGeometry.WorldUVGenerator,
        E, D, F, y;
    q && (p =
        q.getSpacedPoints(t), r = !0, l = !1, E = void 0 !== b.frames ? b.frames : new THREE.TubeGeometry.FrenetFrames(q, t, !1), D = new THREE.Vector3, F = new THREE.Vector3, y = new THREE.Vector3);
    l || (k = i = m = 0);
    var x, z, O, B = this,
        C = this.vertices.length,
        n = a.extractPoints(n),
        I = n.shape,
        n = n.holes;
    if (q = !THREE.Shape.Utils.isClockWise(I)) {
        I = I.reverse();
        z = 0;
        for (O = n.length; z < O; z++) x = n[z], THREE.Shape.Utils.isClockWise(x) && (n[z] = x.reverse());
        q = !1
    }
    var v = THREE.Shape.Utils.triangulateShape(I, n),
        q = I;
    z = 0;
    for (O = n.length; z < O; z++) x = n[z], I = I.concat(x);
    var A, G, R, J, ca = I.length,
        qa = v.length,
        ra = [],
        N = 0,
        M = q.length;
    A = M - 1;
    for (G = N + 1; N < M; N++, A++, G++) A === M && (A = 0), G === M && (G = 0), ra[N] = d(q[N], q[A], q[G]);
    var Q = [],
        K, ea = ra.concat();
    z = 0;
    for (O = n.length; z < O; z++) {
        x = n[z];
        K = [];
        N = 0;
        M = x.length;
        A = M - 1;
        for (G = N + 1; N < M; N++, A++, G++) A === M && (A = 0), G === M && (G = 0), K[N] = d(x[N], x[A], x[G]);
        Q.push(K);
        ea = ea.concat(K)
    }
    for (A = 0; A < m; A++) {
        x = A / m;
        R = i * (1 - x);
        G = k * Math.sin(x * Math.PI / 2);
        N = 0;
        for (M = q.length; N < M; N++) J = c(q[N], ra[N], G), f(J.x, J.y, -R);
        z = 0;
        for (O = n.length; z < O; z++) {
            x = n[z];
            K = Q[z];
            N = 0;
            for (M = x.length; N <
                M; N++) J = c(x[N], K[N], G), f(J.x, J.y, -R)
        }
    }
    G = k;
    for (N = 0; N < ca; N++) J = l ? c(I[N], ea[N], G) : I[N], r ? (F.copy(E.normals[0]).multiplyScalar(J.x), D.copy(E.binormals[0]).multiplyScalar(J.y), y.copy(p[0]).add(F).add(D), f(y.x, y.y, y.z)) : f(J.x, J.y, 0);
    for (x = 1; x <= t; x++)
        for (N = 0; N < ca; N++) J = l ? c(I[N], ea[N], G) : I[N], r ? (F.copy(E.normals[x]).multiplyScalar(J.x), D.copy(E.binormals[x]).multiplyScalar(J.y), y.copy(p[x]).add(F).add(D), f(y.x, y.y, y.z)) : f(J.x, J.y, g / t * x);
    for (A = m - 1; 0 <= A; A--) {
        x = A / m;
        R = i * (1 - x);
        G = k * Math.sin(x * Math.PI / 2);
        N = 0;
        for (M =
            q.length; N < M; N++) J = c(q[N], ra[N], G), f(J.x, J.y, g + R);
        z = 0;
        for (O = n.length; z < O; z++) {
            x = n[z];
            K = Q[z];
            N = 0;
            for (M = x.length; N < M; N++) J = c(x[N], K[N], G), r ? f(J.x, J.y + p[t - 1].y, p[t - 1].x + R) : f(J.x, J.y, g + R)
        }
    }
    if (l) {
        i = 0 * ca;
        for (N = 0; N < qa; N++) g = v[N], h(g[2] + i, g[1] + i, g[0] + i, !0);
        i = ca * (t + 2 * m);
        for (N = 0; N < qa; N++) g = v[N], h(g[0] + i, g[1] + i, g[2] + i, !1)
    } else {
        for (N = 0; N < qa; N++) g = v[N], h(g[2], g[1], g[0], !0);
        for (N = 0; N < qa; N++) g = v[N], h(g[0] + ca * t, g[1] + ca * t, g[2] + ca * t, !1)
    }
    g = 0;
    e(q, g);
    g += q.length;
    z = 0;
    for (O = n.length; z < O; z++) x = n[z], e(x, g), g += x.length
};
THREE.ExtrudeGeometry.WorldUVGenerator = {
    generateTopUV: function(a, b, c, d, e, f) {
        b = a.vertices[e].x;
        e = a.vertices[e].y;
        c = a.vertices[f].x;
        f = a.vertices[f].y;
        return [new THREE.Vector2(a.vertices[d].x, a.vertices[d].y), new THREE.Vector2(b, e), new THREE.Vector2(c, f)]
    },
    generateBottomUV: function(a, b, c, d, e, f) {
        return this.generateTopUV(a, b, c, d, e, f)
    },
    generateSideWallUV: function(a, b, c, d, e, f, h, g) {
        var b = a.vertices[e].x,
            c = a.vertices[e].y,
            e = a.vertices[e].z,
            d = a.vertices[f].x,
            i = a.vertices[f].y,
            f = a.vertices[f].z,
            k = a.vertices[h].x,
            m = a.vertices[h].y,
            h = a.vertices[h].z,
            l = a.vertices[g].x,
            n = a.vertices[g].y,
            a = a.vertices[g].z;
        return 0.01 > Math.abs(c - i) ? [new THREE.Vector2(b, 1 - e), new THREE.Vector2(d, 1 - f), new THREE.Vector2(k, 1 - h), new THREE.Vector2(l, 1 - a)] : [new THREE.Vector2(c, 1 - e), new THREE.Vector2(i, 1 - f), new THREE.Vector2(m, 1 - h), new THREE.Vector2(n, 1 - a)]
    }
};
THREE.ExtrudeGeometry.__v1 = new THREE.Vector2;
THREE.ExtrudeGeometry.__v2 = new THREE.Vector2;
THREE.ExtrudeGeometry.__v3 = new THREE.Vector2;
THREE.ExtrudeGeometry.__v4 = new THREE.Vector2;
THREE.ExtrudeGeometry.__v5 = new THREE.Vector2;
THREE.ExtrudeGeometry.__v6 = new THREE.Vector2;
THREE.ShapeGeometry = function(a, b) {
    THREE.Geometry.call(this);
    !1 === a instanceof Array && (a = [a]);
    this.shapebb = a[a.length - 1].getBoundingBox();
    this.addShapeList(a, b);
    this.computeCentroids();
    this.computeFaceNormals()
};
THREE.ShapeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ShapeGeometry.prototype.addShapeList = function(a, b) {
    for (var c = 0, d = a.length; c < d; c++) this.addShape(a[c], b);
    return this
};
THREE.ShapeGeometry.prototype.addShape = function(a, b) {
    void 0 === b && (b = {});
    var c = b.material,
        d = void 0 === b.UVGenerator ? THREE.ExtrudeGeometry.WorldUVGenerator : b.UVGenerator,
        e, f, h, g = this.vertices.length;
    e = a.extractPoints(void 0 !== b.curveSegments ? b.curveSegments : 12);
    var i = e.shape,
        k = e.holes;
    if (!THREE.Shape.Utils.isClockWise(i)) {
        i = i.reverse();
        e = 0;
        for (f = k.length; e < f; e++) h = k[e], THREE.Shape.Utils.isClockWise(h) && (k[e] = h.reverse())
    }
    var m = THREE.Shape.Utils.triangulateShape(i, k);
    e = 0;
    for (f = k.length; e < f; e++) h = k[e],
        i = i.concat(h);
    k = i.length;
    f = m.length;
    for (e = 0; e < k; e++) h = i[e], this.vertices.push(new THREE.Vector3(h.x, h.y, 0));
    for (e = 0; e < f; e++) k = m[e], i = k[0] + g, h = k[1] + g, k = k[2] + g, this.faces.push(new THREE.Face3(i, h, k, null, null, c)), this.faceVertexUvs[0].push(d.generateBottomUV(this, a, b, i, h, k))
};
THREE.LatheGeometry = function(a, b, c, d) {
    THREE.Geometry.call(this);
    for (var b = b || 12, c = c || 0, d = d || 2 * Math.PI, e = 1 / (a.length - 1), f = 1 / b, h = 0, g = b; h <= g; h++)
        for (var i = c + h * f * d, k = Math.cos(i), m = Math.sin(i), i = 0, l = a.length; i < l; i++) {
            var n = a[i],
                t = new THREE.Vector3;
            t.x = k * n.x - m * n.y;
            t.y = m * n.x + k * n.y;
            t.z = n.z;
            this.vertices.push(t)
        }
    c = a.length;
    h = 0;
    for (g = b; h < g; h++) {
        i = 0;
        for (l = a.length - 1; i < l; i++) {
            var b = m = i + c * h,
                d = m + c,
                k = m + 1 + c,
                m = m + 1,
                n = h * f,
                t = i * e,
                q = n + f,
                p = t + e;
            this.faces.push(new THREE.Face3(b, d, m));
            this.faceVertexUvs[0].push([new THREE.Vector2(n,
                t), new THREE.Vector2(q, t), new THREE.Vector2(n, p)]);
            this.faces.push(new THREE.Face3(d, k, m));
            this.faceVertexUvs[0].push([new THREE.Vector2(q, t), new THREE.Vector2(q, p), new THREE.Vector2(n, p)])
        }
    }
    this.mergeVertices();
    this.computeCentroids();
    this.computeFaceNormals();
    this.computeVertexNormals()
};
THREE.LatheGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.PlaneGeometry = function(a, b, c, d) {
    THREE.Geometry.call(this);
    this.width = a;
    this.height = b;
    this.widthSegments = c || 1;
    this.heightSegments = d || 1;
    for (var e = a / 2, f = b / 2, c = this.widthSegments, d = this.heightSegments, h = c + 1, g = d + 1, i = this.width / c, k = this.height / d, m = new THREE.Vector3(0, 0, 1), a = 0; a < g; a++)
        for (b = 0; b < h; b++) this.vertices.push(new THREE.Vector3(b * i - e, -(a * k - f), 0));
    for (a = 0; a < d; a++)
        for (b = 0; b < c; b++) {
            var l = b + h * a,
                e = b + h * (a + 1),
                f = b + 1 + h * (a + 1),
                g = b + 1 + h * a,
                i = new THREE.Vector2(b / c, 1 - a / d),
                k = new THREE.Vector2(b / c, 1 - (a + 1) /
                    d),
                n = new THREE.Vector2((b + 1) / c, 1 - (a + 1) / d),
                t = new THREE.Vector2((b + 1) / c, 1 - a / d),
                l = new THREE.Face3(l, e, g);
            l.normal.copy(m);
            l.vertexNormals.push(m.clone(), m.clone(), m.clone());
            this.faces.push(l);
            this.faceVertexUvs[0].push([i, k, t]);
            l = new THREE.Face3(e, f, g);
            l.normal.copy(m);
            l.vertexNormals.push(m.clone(), m.clone(), m.clone());
            this.faces.push(l);
            this.faceVertexUvs[0].push([k.clone(), n, t.clone()])
        }
    this.computeCentroids()
};
THREE.PlaneGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.RingGeometry = function(a, b, c, d, e, f) {
    THREE.Geometry.call(this);
    for (var a = a || 0, b = b || 50, e = void 0 !== e ? e : 0, f = void 0 !== f ? f : 2 * Math.PI, c = void 0 !== c ? Math.max(3, c) : 8, d = void 0 !== d ? Math.max(3, d) : 8, h = [], g = a, i = (b - a) / d, a = 0; a <= d; a++) {
        for (b = 0; b <= c; b++) {
            var k = new THREE.Vector3,
                m = e + b / c * f;
            k.x = g * Math.cos(m);
            k.y = g * Math.sin(m);
            this.vertices.push(k);
            h.push(new THREE.Vector2((k.x / g + 1) / 2, -(k.y / g + 1) / 2 + 1))
        }
        g += i
    }
    e = new THREE.Vector3(0, 0, 1);
    for (a = 0; a < d; a++) {
        f = a * c;
        for (b = 0; b <= c; b++) {
            var m = b + f,
                i = m + a,
                k = m + c + a,
                l = m + c + 1 + a;
            this.faces.push(new THREE.Face3(i,
                k, l, [e, e, e]));
            this.faceVertexUvs[0].push([h[i], h[k], h[l]]);
            i = m + a;
            k = m + c + 1 + a;
            l = m + 1 + a;
            this.faces.push(new THREE.Face3(i, k, l, [e, e, e]));
            this.faceVertexUvs[0].push([h[i], h[k], h[l]])
        }
    }
    this.computeCentroids();
    this.computeFaceNormals();
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3, g)
};
THREE.RingGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.SphereGeometry = function(a, b, c, d, e, f, h) {
    THREE.Geometry.call(this);
    this.radius = a = a || 50;
    this.widthSegments = b = Math.max(3, Math.floor(b) || 8);
    this.heightSegments = c = Math.max(2, Math.floor(c) || 6);
    this.phiStart = d = void 0 !== d ? d : 0;
    this.phiLength = e = void 0 !== e ? e : 2 * Math.PI;
    this.thetaStart = f = void 0 !== f ? f : 0;
    this.thetaLength = h = void 0 !== h ? h : Math.PI;
    var g, i, k = [],
        m = [];
    for (i = 0; i <= c; i++) {
        var l = [],
            n = [];
        for (g = 0; g <= b; g++) {
            var t = g / b,
                q = i / c,
                p = new THREE.Vector3;
            p.x = -a * Math.cos(d + t * e) * Math.sin(f + q * h);
            p.y = a * Math.cos(f + q * h);
            p.z = a * Math.sin(d + t * e) * Math.sin(f + q * h);
            this.vertices.push(p);
            l.push(this.vertices.length - 1);
            n.push(new THREE.Vector2(t, 1 - q))
        }
        k.push(l);
        m.push(n)
    }
    for (i = 0; i < this.heightSegments; i++)
        for (g = 0; g < this.widthSegments; g++) {
            var b = k[i][g + 1],
                c = k[i][g],
                d = k[i + 1][g],
                e = k[i + 1][g + 1],
                f = this.vertices[b].clone().normalize(),
                h = this.vertices[c].clone().normalize(),
                l = this.vertices[d].clone().normalize(),
                n = this.vertices[e].clone().normalize(),
                t = m[i][g + 1].clone(),
                q = m[i][g].clone(),
                p = m[i + 1][g].clone(),
                r = m[i + 1][g + 1].clone();
            Math.abs(this.vertices[b].y) ===
                this.radius ? (this.faces.push(new THREE.Face3(b, d, e, [f, l, n])), this.faceVertexUvs[0].push([t, p, r])) : Math.abs(this.vertices[d].y) === this.radius ? (this.faces.push(new THREE.Face3(b, c, d, [f, h, l])), this.faceVertexUvs[0].push([t, q, p])) : (this.faces.push(new THREE.Face3(b, c, e, [f, h, n])), this.faceVertexUvs[0].push([t, q, r]), this.faces.push(new THREE.Face3(c, d, e, [h, l, n])), this.faceVertexUvs[0].push([q.clone(), p, r.clone()]))
        }
    this.computeCentroids();
    this.computeFaceNormals();
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3,
        a)
};
THREE.SphereGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TextGeometry = function(a, b) {
    var b = b || {},
        c = THREE.FontUtils.generateShapes(a, b);
    b.amount = void 0 !== b.height ? b.height : 50;
    void 0 === b.bevelThickness && (b.bevelThickness = 10);
    void 0 === b.bevelSize && (b.bevelSize = 8);
    void 0 === b.bevelEnabled && (b.bevelEnabled = !1);
    THREE.ExtrudeGeometry.call(this, c, b)
};
THREE.TextGeometry.prototype = Object.create(THREE.ExtrudeGeometry.prototype);
THREE.TorusGeometry = function(a, b, c, d, e) {
    THREE.Geometry.call(this);
    this.radius = a || 100;
    this.tube = b || 40;
    this.radialSegments = c || 8;
    this.tubularSegments = d || 6;
    this.arc = e || 2 * Math.PI;
    e = new THREE.Vector3;
    a = [];
    b = [];
    for (c = 0; c <= this.radialSegments; c++)
        for (d = 0; d <= this.tubularSegments; d++) {
            var f = d / this.tubularSegments * this.arc,
                h = 2 * c / this.radialSegments * Math.PI;
            e.x = this.radius * Math.cos(f);
            e.y = this.radius * Math.sin(f);
            var g = new THREE.Vector3;
            g.x = (this.radius + this.tube * Math.cos(h)) * Math.cos(f);
            g.y = (this.radius + this.tube *
                Math.cos(h)) * Math.sin(f);
            g.z = this.tube * Math.sin(h);
            this.vertices.push(g);
            a.push(new THREE.Vector2(d / this.tubularSegments, c / this.radialSegments));
            b.push(g.clone().sub(e).normalize())
        }
    for (c = 1; c <= this.radialSegments; c++)
        for (d = 1; d <= this.tubularSegments; d++) {
            var e = (this.tubularSegments + 1) * c + d - 1,
                f = (this.tubularSegments + 1) * (c - 1) + d - 1,
                h = (this.tubularSegments + 1) * (c - 1) + d,
                g = (this.tubularSegments + 1) * c + d,
                i = new THREE.Face3(e, f, g, [b[e], b[f], b[g]]);
            i.normal.add(b[e]);
            i.normal.add(b[f]);
            i.normal.add(b[g]);
            i.normal.normalize();
            this.faces.push(i);
            this.faceVertexUvs[0].push([a[e].clone(), a[f].clone(), a[g].clone()]);
            i = new THREE.Face3(f, h, g, [b[f], b[h], b[g]]);
            i.normal.add(b[f]);
            i.normal.add(b[h]);
            i.normal.add(b[g]);
            i.normal.normalize();
            this.faces.push(i);
            this.faceVertexUvs[0].push([a[f].clone(), a[h].clone(), a[g].clone()])
        }
    this.computeCentroids()
};
THREE.TorusGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TorusKnotGeometry = function(a, b, c, d, e, f, h) {
    function g(a, b, c, d, e) {
        var f = Math.cos(a),
            g = Math.sin(a),
            a = b / c * a,
            b = Math.cos(a),
            f = 0.5 * (d * (2 + b)) * f,
            g = 0.5 * d * (2 + b) * g,
            d = 0.5 * e * d * Math.sin(a);
        return new THREE.Vector3(f, g, d)
    }
    THREE.Geometry.call(this);
    this.radius = a || 100;
    this.tube = b || 40;
    this.radialSegments = c || 64;
    this.tubularSegments = d || 8;
    this.p = e || 2;
    this.q = f || 3;
    this.heightScale = h || 1;
    this.grid = Array(this.radialSegments);
    c = new THREE.Vector3;
    d = new THREE.Vector3;
    e = new THREE.Vector3;
    for (a = 0; a < this.radialSegments; ++a) {
        this.grid[a] =
            Array(this.tubularSegments);
        b = 2 * (a / this.radialSegments) * this.p * Math.PI;
        f = g(b, this.q, this.p, this.radius, this.heightScale);
        b = g(b + 0.01, this.q, this.p, this.radius, this.heightScale);
        c.subVectors(b, f);
        d.addVectors(b, f);
        e.crossVectors(c, d);
        d.crossVectors(e, c);
        e.normalize();
        d.normalize();
        for (b = 0; b < this.tubularSegments; ++b) {
            var i = 2 * (b / this.tubularSegments) * Math.PI,
                h = -this.tube * Math.cos(i),
                i = this.tube * Math.sin(i),
                k = new THREE.Vector3;
            k.x = f.x + h * d.x + i * e.x;
            k.y = f.y + h * d.y + i * e.y;
            k.z = f.z + h * d.z + i * e.z;
            this.grid[a][b] =
                this.vertices.push(k) - 1
        }
    }
    for (a = 0; a < this.radialSegments; ++a)
        for (b = 0; b < this.tubularSegments; ++b) {
            var e = (a + 1) % this.radialSegments,
                f = (b + 1) % this.tubularSegments,
                c = this.grid[a][b],
                d = this.grid[e][b],
                e = this.grid[e][f],
                f = this.grid[a][f],
                h = new THREE.Vector2(a / this.radialSegments, b / this.tubularSegments),
                i = new THREE.Vector2((a + 1) / this.radialSegments, b / this.tubularSegments),
                k = new THREE.Vector2((a + 1) / this.radialSegments, (b + 1) / this.tubularSegments),
                m = new THREE.Vector2(a / this.radialSegments, (b + 1) / this.tubularSegments);
            this.faces.push(new THREE.Face3(c, d, f));
            this.faceVertexUvs[0].push([h, i, m]);
            this.faces.push(new THREE.Face3(d, e, f));
            this.faceVertexUvs[0].push([i.clone(), k, m.clone()])
        }
    this.computeCentroids();
    this.computeFaceNormals();
    this.computeVertexNormals()
};
THREE.TorusKnotGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TubeGeometry = function(a, b, c, d, e) {
    THREE.Geometry.call(this);
    this.path = a;
    this.segments = b || 64;
    this.radius = c || 1;
    this.radialSegments = d || 8;
    this.closed = e || !1;
    this.grid = [];
    var f, h, d = this.segments + 1,
        g, i, k, e = new THREE.Vector3,
        m, l, b = new THREE.TubeGeometry.FrenetFrames(this.path, this.segments, this.closed);
    m = b.normals;
    l = b.binormals;
    this.tangents = b.tangents;
    this.normals = m;
    this.binormals = l;
    for (b = 0; b < d; b++) {
        this.grid[b] = [];
        c = b / (d - 1);
        k = a.getPointAt(c);
        f = m[b];
        h = l[b];
        for (c = 0; c < this.radialSegments; c++) g = 2 * (c / this.radialSegments) *
            Math.PI, i = -this.radius * Math.cos(g), g = this.radius * Math.sin(g), e.copy(k), e.x += i * f.x + g * h.x, e.y += i * f.y + g * h.y, e.z += i * f.z + g * h.z, this.grid[b][c] = this.vertices.push(new THREE.Vector3(e.x, e.y, e.z)) - 1
    }
    for (b = 0; b < this.segments; b++)
        for (c = 0; c < this.radialSegments; c++) e = this.closed ? (b + 1) % this.segments : b + 1, m = (c + 1) % this.radialSegments, a = this.grid[b][c], d = this.grid[e][c], e = this.grid[e][m], m = this.grid[b][m], l = new THREE.Vector2(b / this.segments, c / this.radialSegments), f = new THREE.Vector2((b + 1) / this.segments, c / this.radialSegments),
            h = new THREE.Vector2((b + 1) / this.segments, (c + 1) / this.radialSegments), i = new THREE.Vector2(b / this.segments, (c + 1) / this.radialSegments), this.faces.push(new THREE.Face3(a, d, m)), this.faceVertexUvs[0].push([l, f, i]), this.faces.push(new THREE.Face3(d, e, m)), this.faceVertexUvs[0].push([f.clone(), h, i.clone()]);
    this.computeCentroids();
    this.computeFaceNormals();
    this.computeVertexNormals()
};
THREE.TubeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TubeGeometry.FrenetFrames = function(a, b, c) {
    new THREE.Vector3;
    var d = new THREE.Vector3;
    new THREE.Vector3;
    var e = [],
        f = [],
        h = [],
        g = new THREE.Vector3,
        i = new THREE.Matrix4,
        b = b + 1,
        k, m, l;
    this.tangents = e;
    this.normals = f;
    this.binormals = h;
    for (k = 0; k < b; k++) m = k / (b - 1), e[k] = a.getTangentAt(m), e[k].normalize();
    f[0] = new THREE.Vector3;
    h[0] = new THREE.Vector3;
    a = Number.MAX_VALUE;
    k = Math.abs(e[0].x);
    m = Math.abs(e[0].y);
    l = Math.abs(e[0].z);
    k <= a && (a = k, d.set(1, 0, 0));
    m <= a && (a = m, d.set(0, 1, 0));
    l <= a && d.set(0, 0, 1);
    g.crossVectors(e[0],
        d).normalize();
    f[0].crossVectors(e[0], g);
    h[0].crossVectors(e[0], f[0]);
    for (k = 1; k < b; k++) f[k] = f[k - 1].clone(), h[k] = h[k - 1].clone(), g.crossVectors(e[k - 1], e[k]), 1E-4 < g.length() && (g.normalize(), d = Math.acos(THREE.Math.clamp(e[k - 1].dot(e[k]), -1, 1)), f[k].applyMatrix4(i.makeRotationAxis(g, d))), h[k].crossVectors(e[k], f[k]);
    if (c) {
        d = Math.acos(THREE.Math.clamp(f[0].dot(f[b - 1]), -1, 1));
        d /= b - 1;
        0 < e[0].dot(g.crossVectors(f[0], f[b - 1])) && (d = -d);
        for (k = 1; k < b; k++) f[k].applyMatrix4(i.makeRotationAxis(e[k], d * k)), h[k].crossVectors(e[k],
            f[k])
    }
};
THREE.PolyhedronGeometry = function(a, b, c, d) {
    function e(a) {
        var b = a.normalize().clone();
        b.index = g.vertices.push(b) - 1;
        var c = Math.atan2(a.z, -a.x) / 2 / Math.PI + 0.5,
            a = Math.atan2(-a.y, Math.sqrt(a.x * a.x + a.z * a.z)) / Math.PI + 0.5;
        b.uv = new THREE.Vector2(c, 1 - a);
        return b
    }

    function f(a, b, c) {
        var d = new THREE.Face3(a.index, b.index, c.index, [a.clone(), b.clone(), c.clone()]);
        d.centroid.add(a).add(b).add(c).divideScalar(3);
        g.faces.push(d);
        d = Math.atan2(d.centroid.z, -d.centroid.x);
        g.faceVertexUvs[0].push([h(a.uv, a, d), h(b.uv, b, d),
            h(c.uv, c, d)
        ])
    }

    function h(a, b, c) {
        0 > c && 1 === a.x && (a = new THREE.Vector2(a.x - 1, a.y));
        0 === b.x && 0 === b.z && (a = new THREE.Vector2(c / 2 / Math.PI + 0.5, a.y));
        return a.clone()
    }
    THREE.Geometry.call(this);
    for (var c = c || 1, d = d || 0, g = this, i = 0, k = a.length; i < k; i++) e(new THREE.Vector3(a[i][0], a[i][1], a[i][2]));
    for (var m = this.vertices, a = [], i = 0, k = b.length; i < k; i++) {
        var l = m[b[i][0]],
            n = m[b[i][1]],
            t = m[b[i][2]];
        a[i] = new THREE.Face3(l.index, n.index, t.index, [l.clone(), n.clone(), t.clone()])
    }
    i = 0;
    for (k = a.length; i < k; i++) {
        n = a[i];
        m = d;
        b = Math.pow(2,
            m);
        Math.pow(4, m);
        for (var m = e(g.vertices[n.a]), l = e(g.vertices[n.b]), q = e(g.vertices[n.c]), n = [], t = 0; t <= b; t++) {
            n[t] = [];
            for (var p = e(m.clone().lerp(q, t / b)), r = e(l.clone().lerp(q, t / b)), s = b - t, u = 0; u <= s; u++) n[t][u] = 0 == u && t == b ? p : e(p.clone().lerp(r, u / s))
        }
        for (t = 0; t < b; t++)
            for (u = 0; u < 2 * (b - t) - 1; u++) m = Math.floor(u / 2), 0 == u % 2 ? f(n[t][m + 1], n[t + 1][m], n[t][m]) : f(n[t][m + 1], n[t + 1][m + 1], n[t + 1][m])
    }
    i = 0;
    for (k = this.faceVertexUvs[0].length; i < k; i++) d = this.faceVertexUvs[0][i], a = d[0].x, b = d[1].x, m = d[2].x, l = Math.max(a, Math.max(b, m)),
        n = Math.min(a, Math.min(b, m)), 0.9 < l && 0.1 > n && (0.2 > a && (d[0].x += 1), 0.2 > b && (d[1].x += 1), 0.2 > m && (d[2].x += 1));
    i = 0;
    for (k = this.vertices.length; i < k; i++) this.vertices[i].multiplyScalar(c);
    this.mergeVertices();
    this.computeCentroids();
    this.computeFaceNormals();
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3, c)
};
THREE.PolyhedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.IcosahedronGeometry = function(a, b) {
    this.radius = a;
    this.detail = b;
    var c = (1 + Math.sqrt(5)) / 2;
    THREE.PolyhedronGeometry.call(this, [
        [-1, c, 0],
        [1, c, 0],
        [-1, -c, 0],
        [1, -c, 0],
        [0, -1, c],
        [0, 1, c],
        [0, -1, -c],
        [0, 1, -c],
        [c, 0, -1],
        [c, 0, 1],
        [-c, 0, -1],
        [-c, 0, 1]
    ], [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1]
    ], a, b)
};
THREE.IcosahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.OctahedronGeometry = function(a, b) {
    THREE.PolyhedronGeometry.call(this, [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1]
    ], [
        [0, 2, 4],
        [0, 4, 3],
        [0, 3, 5],
        [0, 5, 2],
        [1, 2, 5],
        [1, 5, 3],
        [1, 3, 4],
        [1, 4, 2]
    ], a, b)
};
THREE.OctahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TetrahedronGeometry = function(a, b) {
    THREE.PolyhedronGeometry.call(this, [
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1]
    ], [
        [2, 1, 0],
        [0, 3, 2],
        [1, 3, 0],
        [2, 3, 1]
    ], a, b)
};
THREE.TetrahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ParametricGeometry = function(a, b, c) {
    THREE.Geometry.call(this);
    var d = this.vertices,
        e = this.faces,
        f = this.faceVertexUvs[0],
        h, g, i, k, m = b + 1;
    for (h = 0; h <= c; h++) {
        k = h / c;
        for (g = 0; g <= b; g++) i = g / b, i = a(i, k), d.push(i)
    }
    var l, n, t, q;
    for (h = 0; h < c; h++)
        for (g = 0; g < b; g++) a = h * m + g, d = h * m + g + 1, k = (h + 1) * m + g + 1, i = (h + 1) * m + g, l = new THREE.Vector2(g / b, h / c), n = new THREE.Vector2((g + 1) / b, h / c), t = new THREE.Vector2((g + 1) / b, (h + 1) / c), q = new THREE.Vector2(g / b, (h + 1) / c), e.push(new THREE.Face3(a, d, i)), f.push([l, n, q]), e.push(new THREE.Face3(d, k, i)),
            f.push([n.clone(), t, q.clone()]);
    this.computeCentroids();
    this.computeFaceNormals();
    this.computeVertexNormals()
};
THREE.ParametricGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.AxisHelper = function(a) {
    var a = a || 1,
        b = new THREE.Geometry;
    b.vertices.push(new THREE.Vector3, new THREE.Vector3(a, 0, 0), new THREE.Vector3, new THREE.Vector3(0, a, 0), new THREE.Vector3, new THREE.Vector3(0, 0, a));
    b.colors.push(new THREE.Color(16711680), new THREE.Color(16755200), new THREE.Color(65280), new THREE.Color(11206400), new THREE.Color(255), new THREE.Color(43775));
    a = new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors
    });
    THREE.Line.call(this, b, a, THREE.LinePieces)
};
THREE.AxisHelper.prototype = Object.create(THREE.Line.prototype);
THREE.ArrowHelper = function(a, b, c, d) {
    THREE.Object3D.call(this);
    void 0 === d && (d = 16776960);
    void 0 === c && (c = 1);
    this.position = b;
    b = new THREE.Geometry;
    b.vertices.push(new THREE.Vector3(0, 0, 0));
    b.vertices.push(new THREE.Vector3(0, 1, 0));
    this.line = new THREE.Line(b, new THREE.LineBasicMaterial({
        color: d
    }));
    this.line.matrixAutoUpdate = !1;
    this.add(this.line);
    b = new THREE.CylinderGeometry(0, 0.05, 0.25, 5, 1);
    b.applyMatrix((new THREE.Matrix4).makeTranslation(0, 0.875, 0));
    this.cone = new THREE.Mesh(b, new THREE.MeshBasicMaterial({
        color: d
    }));
    this.cone.matrixAutoUpdate = !1;
    this.add(this.cone);
    this.setDirection(a);
    this.setLength(c)
};
THREE.ArrowHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.ArrowHelper.prototype.setDirection = function() {
    var a = new THREE.Vector3,
        b;
    return function(c) {
        0.99999 < c.y ? this.quaternion.set(0, 0, 0, 1) : -0.99999 > c.y ? this.quaternion.set(1, 0, 0, 0) : (a.set(c.z, 0, -c.x).normalize(), b = Math.acos(c.y), this.quaternion.setFromAxisAngle(a, b))
    }
}();
THREE.ArrowHelper.prototype.setLength = function(a) {
    this.scale.set(a, a, a)
};
THREE.ArrowHelper.prototype.setColor = function(a) {
    this.line.material.color.setHex(a);
    this.cone.material.color.setHex(a)
};
THREE.BoxHelper = function(a) {
    var b = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, 1, 1), new THREE.Vector3(-1, -1, 1), new THREE.Vector3(1, -1, 1), new THREE.Vector3(1, 1, -1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, -1, -1)];
    this.vertices = b;
    var c = new THREE.Geometry;
    c.vertices.push(b[0], b[1], b[1], b[2], b[2], b[3], b[3], b[0], b[4], b[5], b[5], b[6], b[6], b[7], b[7], b[4], b[0], b[4], b[1], b[5], b[2], b[6], b[3], b[7]);
    THREE.Line.call(this, c, new THREE.LineBasicMaterial({
        color: 16776960
    }), THREE.LinePieces);
    void 0 !== a && this.update(a)
};
THREE.BoxHelper.prototype = Object.create(THREE.Line.prototype);
THREE.BoxHelper.prototype.update = function(a) {
    var b = a.geometry;
    null === b.boundingBox && b.computeBoundingBox();
    var c = b.boundingBox.min,
        b = b.boundingBox.max,
        d = this.vertices;
    d[0].set(b.x, b.y, b.z);
    d[1].set(c.x, b.y, b.z);
    d[2].set(c.x, c.y, b.z);
    d[3].set(b.x, c.y, b.z);
    d[4].set(b.x, b.y, c.z);
    d[5].set(c.x, b.y, c.z);
    d[6].set(c.x, c.y, c.z);
    d[7].set(b.x, c.y, c.z);
    this.geometry.computeBoundingSphere();
    this.geometry.verticesNeedUpdate = !0;
    this.matrixAutoUpdate = !1;
    this.matrixWorld = a.matrixWorld
};
THREE.BoundingBoxHelper = function(a, b) {
    var c = b || 8947848;
    this.object = a;
    this.box = new THREE.Box3;
    THREE.Mesh.call(this, new THREE.CubeGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
        color: c,
        wireframe: !0
    }))
};
THREE.BoundingBoxHelper.prototype = Object.create(THREE.Mesh.prototype);
THREE.BoundingBoxHelper.prototype.update = function() {
    this.box.setFromObject(this.object);
    this.box.size(this.scale);
    this.box.center(this.position)
};
THREE.CameraHelper = function(a) {
    function b(a, b, d) {
        c(a, d);
        c(b, d)
    }

    function c(a, b) {
        d.vertices.push(new THREE.Vector3);
        d.colors.push(new THREE.Color(b));
        void 0 === f[a] && (f[a] = []);
        f[a].push(d.vertices.length - 1)
    }
    var d = new THREE.Geometry,
        e = new THREE.LineBasicMaterial({
            color: 16777215,
            vertexColors: THREE.FaceColors
        }),
        f = {};
    b("n1", "n2", 16755200);
    b("n2", "n4", 16755200);
    b("n4", "n3", 16755200);
    b("n3", "n1", 16755200);
    b("f1", "f2", 16755200);
    b("f2", "f4", 16755200);
    b("f4", "f3", 16755200);
    b("f3", "f1", 16755200);
    b("n1", "f1", 16755200);
    b("n2", "f2", 16755200);
    b("n3", "f3", 16755200);
    b("n4", "f4", 16755200);
    b("p", "n1", 16711680);
    b("p", "n2", 16711680);
    b("p", "n3", 16711680);
    b("p", "n4", 16711680);
    b("u1", "u2", 43775);
    b("u2", "u3", 43775);
    b("u3", "u1", 43775);
    b("c", "t", 16777215);
    b("p", "c", 3355443);
    b("cn1", "cn2", 3355443);
    b("cn3", "cn4", 3355443);
    b("cf1", "cf2", 3355443);
    b("cf3", "cf4", 3355443);
    THREE.Line.call(this, d, e, THREE.LinePieces);
    this.camera = a;
    this.matrixWorld = a.matrixWorld;
    this.matrixAutoUpdate = !1;
    this.pointMap = f;
    this.update()
};
THREE.CameraHelper.prototype = Object.create(THREE.Line.prototype);
THREE.CameraHelper.prototype.update = function() {
    var a = new THREE.Vector3,
        b = new THREE.Camera,
        c = new THREE.Projector;
    return function() {
        function d(d, h, g, i) {
            a.set(h, g, i);
            c.unprojectVector(a, b);
            d = e.pointMap[d];
            if (void 0 !== d) {
                h = 0;
                for (g = d.length; h < g; h++) e.geometry.vertices[d[h]].copy(a)
            }
        }
        var e = this;
        b.projectionMatrix.copy(this.camera.projectionMatrix);
        d("c", 0, 0, -1);
        d("t", 0, 0, 1);
        d("n1", -1, -1, -1);
        d("n2", 1, -1, -1);
        d("n3", -1, 1, -1);
        d("n4", 1, 1, -1);
        d("f1", -1, -1, 1);
        d("f2", 1, -1, 1);
        d("f3", -1, 1, 1);
        d("f4", 1, 1, 1);
        d("u1",
            0.7, 1.1, -1);
        d("u2", -0.7, 1.1, -1);
        d("u3", 0, 2, -1);
        d("cf1", -1, 0, 1);
        d("cf2", 1, 0, 1);
        d("cf3", 0, -1, 1);
        d("cf4", 0, 1, 1);
        d("cn1", -1, 0, -1);
        d("cn2", 1, 0, -1);
        d("cn3", 0, -1, -1);
        d("cn4", 0, 1, -1);
        this.geometry.verticesNeedUpdate = !0
    }
}();
THREE.DirectionalLightHelper = function(a, b) {
    THREE.Object3D.call(this);
    this.light = a;
    this.light.updateMatrixWorld();
    this.matrixWorld = a.matrixWorld;
    this.matrixAutoUpdate = !1;
    var c = new THREE.PlaneGeometry(b, b),
        d = new THREE.MeshBasicMaterial({
            wireframe: !0,
            fog: !1
        });
    d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
    this.lightPlane = new THREE.Mesh(c, d);
    this.add(this.lightPlane);
    c = new THREE.Geometry;
    c.vertices.push(new THREE.Vector3);
    c.vertices.push(new THREE.Vector3);
    c.computeLineDistances();
    d = new THREE.LineBasicMaterial({
        fog: !1
    });
    d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
    this.targetLine = new THREE.Line(c, d);
    this.add(this.targetLine);
    this.update()
};
THREE.DirectionalLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.DirectionalLightHelper.prototype.update = function() {
    var a = new THREE.Vector3;
    return function() {
        a.getPositionFromMatrix(this.light.matrixWorld).negate();
        this.lightPlane.lookAt(a);
        this.lightPlane.material.color.copy(this.light.color).multiplyScalar(this.light.intensity);
        this.targetLine.geometry.vertices[1].copy(a);
        this.targetLine.geometry.verticesNeedUpdate = !0;
        this.targetLine.material.color.copy(this.lightPlane.material.color)
    }
}();
THREE.FaceNormalsHelper = function(a, b, c, d) {
    this.object = a;
    this.size = b || 1;
    for (var a = c || 16776960, d = d || 1, b = new THREE.Geometry, c = 0, e = this.object.geometry.faces.length; c < e; c++) b.vertices.push(new THREE.Vector3), b.vertices.push(new THREE.Vector3);
    THREE.Line.call(this, b, new THREE.LineBasicMaterial({
        color: a,
        linewidth: d
    }), THREE.LinePieces);
    this.matrixAutoUpdate = !1;
    this.normalMatrix = new THREE.Matrix3;
    this.update()
};
THREE.FaceNormalsHelper.prototype = Object.create(THREE.Line.prototype);
THREE.FaceNormalsHelper.prototype.update = function() {
    var a = new THREE.Vector3;
    return function() {
        this.object.updateMatrixWorld(!0);
        this.normalMatrix.getNormalMatrix(this.object.matrixWorld);
        for (var b = this.geometry.vertices, c = this.object.geometry.faces, d = this.object.matrixWorld, e = 0, f = c.length; e < f; e++) {
            var h = c[e];
            a.copy(h.normal).applyMatrix3(this.normalMatrix).normalize().multiplyScalar(this.size);
            var g = 2 * e;
            b[g].copy(h.centroid).applyMatrix4(d);
            b[g + 1].addVectors(b[g], a)
        }
        this.geometry.verticesNeedUpdate = !0;
        return this
    }
}();
THREE.GridHelper = function(a, b) {
    var c = new THREE.Geometry,
        d = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors
        });
    this.color1 = new THREE.Color(4473924);
    this.color2 = new THREE.Color(8947848);
    for (var e = -a; e <= a; e += b) {
        c.vertices.push(new THREE.Vector3(-a, 0, e), new THREE.Vector3(a, 0, e), new THREE.Vector3(e, 0, -a), new THREE.Vector3(e, 0, a));
        var f = 0 === e ? this.color1 : this.color2;
        c.colors.push(f, f, f, f)
    }
    THREE.Line.call(this, c, d, THREE.LinePieces)
};
THREE.GridHelper.prototype = Object.create(THREE.Line.prototype);
THREE.GridHelper.prototype.setColors = function(a, b) {
    this.color1.set(a);
    this.color2.set(b);
    this.geometry.colorsNeedUpdate = !0
};
THREE.HemisphereLightHelper = function(a, b) {
    THREE.Object3D.call(this);
    this.light = a;
    this.light.updateMatrixWorld();
    this.matrixWorld = a.matrixWorld;
    this.matrixAutoUpdate = !1;
    this.colors = [new THREE.Color, new THREE.Color];
    var c = new THREE.SphereGeometry(b, 4, 2);
    c.applyMatrix((new THREE.Matrix4).makeRotationX(-Math.PI / 2));
    for (var d = 0; 8 > d; d++) c.faces[d].color = this.colors[4 > d ? 0 : 1];
    d = new THREE.MeshBasicMaterial({
        vertexColors: THREE.FaceColors,
        wireframe: !0
    });
    this.lightSphere = new THREE.Mesh(c, d);
    this.add(this.lightSphere);
    this.update()
};
THREE.HemisphereLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.HemisphereLightHelper.prototype.update = function() {
    var a = new THREE.Vector3;
    return function() {
        this.colors[0].copy(this.light.color).multiplyScalar(this.light.intensity);
        this.colors[1].copy(this.light.groundColor).multiplyScalar(this.light.intensity);
        this.lightSphere.lookAt(a.getPositionFromMatrix(this.light.matrixWorld).negate());
        this.lightSphere.geometry.colorsNeedUpdate = !0
    }
}();
THREE.PointLightHelper = function(a, b) {
    this.light = a;
    this.light.updateMatrixWorld();
    var c = new THREE.SphereGeometry(b, 4, 2),
        d = new THREE.MeshBasicMaterial({
            wireframe: !0,
            fog: !1
        });
    d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
    THREE.Mesh.call(this, c, d);
    this.matrixWorld = this.light.matrixWorld;
    this.matrixAutoUpdate = !1
};
THREE.PointLightHelper.prototype = Object.create(THREE.Mesh.prototype);
THREE.PointLightHelper.prototype.update = function() {
    this.material.color.copy(this.light.color).multiplyScalar(this.light.intensity)
};
THREE.SpotLightHelper = function(a) {
    THREE.Object3D.call(this);
    this.light = a;
    this.light.updateMatrixWorld();
    this.matrixWorld = a.matrixWorld;
    this.matrixAutoUpdate = !1;
    a = new THREE.CylinderGeometry(0, 1, 1, 8, 1, !0);
    a.applyMatrix((new THREE.Matrix4).makeTranslation(0, -0.5, 0));
    a.applyMatrix((new THREE.Matrix4).makeRotationX(-Math.PI / 2));
    var b = new THREE.MeshBasicMaterial({
        wireframe: !0,
        fog: !1
    });
    this.cone = new THREE.Mesh(a, b);
    this.add(this.cone);
    this.update()
};
THREE.SpotLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.SpotLightHelper.prototype.update = function() {
    var a = new THREE.Vector3,
        b = new THREE.Vector3;
    return function() {
        var c = this.light.distance ? this.light.distance : 1E4,
            d = c * Math.tan(this.light.angle);
        this.cone.scale.set(d, d, c);
        a.getPositionFromMatrix(this.light.matrixWorld);
        b.getPositionFromMatrix(this.light.target.matrixWorld);
        this.cone.lookAt(b.sub(a));
        this.cone.material.color.copy(this.light.color).multiplyScalar(this.light.intensity)
    }
}();
THREE.VertexNormalsHelper = function(a, b, c, d) {
    this.object = a;
    this.size = b || 1;
    for (var b = c || 16711680, d = d || 1, c = new THREE.Geometry, a = a.geometry.faces, e = 0, f = a.length; e < f; e++)
        for (var h = 0, g = a[e].vertexNormals.length; h < g; h++) c.vertices.push(new THREE.Vector3), c.vertices.push(new THREE.Vector3);
    THREE.Line.call(this, c, new THREE.LineBasicMaterial({
        color: b,
        linewidth: d
    }), THREE.LinePieces);
    this.matrixAutoUpdate = !1;
    this.normalMatrix = new THREE.Matrix3;
    this.update()
};
THREE.VertexNormalsHelper.prototype = Object.create(THREE.Line.prototype);
THREE.VertexNormalsHelper.prototype.update = function() {
    var a = new THREE.Vector3;
    return function() {
        var b = ["a", "b", "c", "d"];
        this.object.updateMatrixWorld(!0);
        this.normalMatrix.getNormalMatrix(this.object.matrixWorld);
        for (var c = this.geometry.vertices, d = this.object.geometry.vertices, e = this.object.geometry.faces, f = this.object.matrixWorld, h = 0, g = 0, i = e.length; g < i; g++)
            for (var k = e[g], m = 0, l = k.vertexNormals.length; m < l; m++) {
                var n = k.vertexNormals[m];
                c[h].copy(d[k[b[m]]]).applyMatrix4(f);
                a.copy(n).applyMatrix3(this.normalMatrix).normalize().multiplyScalar(this.size);
                a.add(c[h]);
                h += 1;
                c[h].copy(a);
                h += 1
            }
        this.geometry.verticesNeedUpdate = !0;
        return this
    }
}();
THREE.VertexTangentsHelper = function(a, b, c, d) {
    this.object = a;
    this.size = b || 1;
    for (var b = c || 255, d = d || 1, c = new THREE.Geometry, a = a.geometry.faces, e = 0, f = a.length; e < f; e++)
        for (var h = 0, g = a[e].vertexTangents.length; h < g; h++) c.vertices.push(new THREE.Vector3), c.vertices.push(new THREE.Vector3);
    THREE.Line.call(this, c, new THREE.LineBasicMaterial({
        color: b,
        linewidth: d
    }), THREE.LinePieces);
    this.matrixAutoUpdate = !1;
    this.update()
};
THREE.VertexTangentsHelper.prototype = Object.create(THREE.Line.prototype);
THREE.VertexTangentsHelper.prototype.update = function() {
    var a = new THREE.Vector3;
    return function() {
        var b = ["a", "b", "c", "d"];
        this.object.updateMatrixWorld(!0);
        for (var c = this.geometry.vertices, d = this.object.geometry.vertices, e = this.object.geometry.faces, f = this.object.matrixWorld, h = 0, g = 0, i = e.length; g < i; g++)
            for (var k = e[g], m = 0, l = k.vertexTangents.length; m < l; m++) {
                var n = k.vertexTangents[m];
                c[h].copy(d[k[b[m]]]).applyMatrix4(f);
                a.copy(n).transformDirection(f).multiplyScalar(this.size);
                a.add(c[h]);
                h += 1;
                c[h].copy(a);
                h += 1
            }
        this.geometry.verticesNeedUpdate = !0;
        return this
    }
}();
THREE.WireframeHelper = function(a) {
    for (var b = [0, 0], c = {}, d = function(a, b) {
            return a - b
        }, e = ["a", "b", "c", "d"], f = new THREE.Geometry, h = a.geometry.vertices, g = a.geometry.faces, i = 0, k = g.length; i < k; i++)
        for (var m = g[i], l = 0; 3 > l; l++) {
            b[0] = m[e[l]];
            b[1] = m[e[(l + 1) % 3]];
            b.sort(d);
            var n = b.toString();
            void 0 === c[n] && (f.vertices.push(h[b[0]]), f.vertices.push(h[b[1]]), c[n] = !0)
        }
    THREE.Line.call(this, f, new THREE.LineBasicMaterial({
        color: 16777215
    }), THREE.LinePieces);
    this.matrixAutoUpdate = !1;
    this.matrixWorld = a.matrixWorld
};
THREE.WireframeHelper.prototype = Object.create(THREE.Line.prototype);
THREE.ImmediateRenderObject = function() {
    THREE.Object3D.call(this);
    this.render = function() {}
};
THREE.ImmediateRenderObject.prototype = Object.create(THREE.Object3D.prototype);
THREE.LensFlare = function(a, b, c, d, e) {
    THREE.Object3D.call(this);
    this.lensFlares = [];
    this.positionScreen = new THREE.Vector3;
    this.customUpdateCallback = void 0;
    void 0 !== a && this.add(a, b, c, d, e)
};
THREE.LensFlare.prototype = Object.create(THREE.Object3D.prototype);
THREE.LensFlare.prototype.add = function(a, b, c, d, e, f) {
    void 0 === b && (b = -1);
    void 0 === c && (c = 0);
    void 0 === f && (f = 1);
    void 0 === e && (e = new THREE.Color(16777215));
    void 0 === d && (d = THREE.NormalBlending);
    c = Math.min(c, Math.max(0, c));
    this.lensFlares.push({
        texture: a,
        size: b,
        distance: c,
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotation: 1,
        opacity: f,
        color: e,
        blending: d
    })
};
THREE.LensFlare.prototype.updateLensFlares = function() {
    var a, b = this.lensFlares.length,
        c, d = 2 * -this.positionScreen.x,
        e = 2 * -this.positionScreen.y;
    for (a = 0; a < b; a++) c = this.lensFlares[a], c.x = this.positionScreen.x + d * c.distance, c.y = this.positionScreen.y + e * c.distance, c.wantedRotation = 0.25 * c.x * Math.PI, c.rotation += 0.25 * (c.wantedRotation - c.rotation)
};
THREE.MorphBlendMesh = function(a, b) {
    THREE.Mesh.call(this, a, b);
    this.animationsMap = {};
    this.animationsList = [];
    var c = this.geometry.morphTargets.length;
    this.createAnimation("__default", 0, c - 1, c / 1);
    this.setAnimationWeight("__default", 1)
};
THREE.MorphBlendMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.MorphBlendMesh.prototype.createAnimation = function(a, b, c, d) {
    b = {
        startFrame: b,
        endFrame: c,
        length: c - b + 1,
        fps: d,
        duration: (c - b) / d,
        lastFrame: 0,
        currentFrame: 0,
        active: !1,
        time: 0,
        direction: 1,
        weight: 1,
        directionBackwards: !1,
        mirroredLoop: !1
    };
    this.animationsMap[a] = b;
    this.animationsList.push(b)
};
THREE.MorphBlendMesh.prototype.autoCreateAnimations = function(a) {
    for (var b = /([a-z]+)(\d+)/, c, d = {}, e = this.geometry, f = 0, h = e.morphTargets.length; f < h; f++) {
        var g = e.morphTargets[f].name.match(b);
        if (g && 1 < g.length) {
            var i = g[1];
            d[i] || (d[i] = {
                start: Infinity,
                end: -Infinity
            });
            g = d[i];
            f < g.start && (g.start = f);
            f > g.end && (g.end = f);
            c || (c = i)
        }
    }
    for (i in d) g = d[i], this.createAnimation(i, g.start, g.end, a);
    this.firstAnimation = c
};
THREE.MorphBlendMesh.prototype.setAnimationDirectionForward = function(a) {
    if (a = this.animationsMap[a]) a.direction = 1, a.directionBackwards = !1
};
THREE.MorphBlendMesh.prototype.setAnimationDirectionBackward = function(a) {
    if (a = this.animationsMap[a]) a.direction = -1, a.directionBackwards = !0
};
THREE.MorphBlendMesh.prototype.setAnimationFPS = function(a, b) {
    var c = this.animationsMap[a];
    c && (c.fps = b, c.duration = (c.end - c.start) / c.fps)
};
THREE.MorphBlendMesh.prototype.setAnimationDuration = function(a, b) {
    var c = this.animationsMap[a];
    c && (c.duration = b, c.fps = (c.end - c.start) / c.duration)
};
THREE.MorphBlendMesh.prototype.setAnimationWeight = function(a, b) {
    var c = this.animationsMap[a];
    c && (c.weight = b)
};
THREE.MorphBlendMesh.prototype.setAnimationTime = function(a, b) {
    var c = this.animationsMap[a];
    c && (c.time = b)
};
THREE.MorphBlendMesh.prototype.getAnimationTime = function(a) {
    var b = 0;
    if (a = this.animationsMap[a]) b = a.time;
    return b
};
THREE.MorphBlendMesh.prototype.getAnimationDuration = function(a) {
    var b = -1;
    if (a = this.animationsMap[a]) b = a.duration;
    return b
};
THREE.MorphBlendMesh.prototype.playAnimation = function(a) {
    var b = this.animationsMap[a];
    b ? (b.time = 0, b.active = !0) : console.warn("animation[" + a + "] undefined")
};
THREE.MorphBlendMesh.prototype.stopAnimation = function(a) {
    if (a = this.animationsMap[a]) a.active = !1
};
THREE.MorphBlendMesh.prototype.update = function(a) {
    for (var b = 0, c = this.animationsList.length; b < c; b++) {
        var d = this.animationsList[b];
        if (d.active) {
            var e = d.duration / d.length;
            d.time += d.direction * a;
            if (d.mirroredLoop) {
                if (d.time > d.duration || 0 > d.time) d.direction *= -1, d.time > d.duration && (d.time = d.duration, d.directionBackwards = !0), 0 > d.time && (d.time = 0, d.directionBackwards = !1)
            } else d.time %= d.duration, 0 > d.time && (d.time += d.duration);
            var f = d.startFrame + THREE.Math.clamp(Math.floor(d.time / e), 0, d.length - 1),
                h = d.weight;
            f !== d.currentFrame && (this.morphTargetInfluences[d.lastFrame] = 0, this.morphTargetInfluences[d.currentFrame] = 1 * h, this.morphTargetInfluences[f] = 0, d.lastFrame = d.currentFrame, d.currentFrame = f);
            e = d.time % e / e;
            d.directionBackwards && (e = 1 - e);
            this.morphTargetInfluences[d.currentFrame] = e * h;
            this.morphTargetInfluences[d.lastFrame] = (1 - e) * h
        }
    }
};
THREE.LensFlarePlugin = function() {
    function a(a, c) {
        var d = b.createProgram(),
            e = b.createShader(b.FRAGMENT_SHADER),
            f = b.createShader(b.VERTEX_SHADER),
            g = "precision " + c + " float;\n";
        b.shaderSource(e, g + a.fragmentShader);
        b.shaderSource(f, g + a.vertexShader);
        b.compileShader(e);
        b.compileShader(f);
        b.attachShader(d, e);
        b.attachShader(d, f);
        b.linkProgram(d);
        return d
    }
    var b, c, d, e, f, h, g, i, k, m, l, n, t;
    this.init = function(q) {
        b = q.context;
        c = q;
        d = q.getPrecision();
        e = new Float32Array(16);
        f = new Uint16Array(6);
        q = 0;
        e[q++] = -1;
        e[q++] = -1;
        e[q++] = 0;
        e[q++] = 0;
        e[q++] = 1;
        e[q++] = -1;
        e[q++] = 1;
        e[q++] = 0;
        e[q++] = 1;
        e[q++] = 1;
        e[q++] = 1;
        e[q++] = 1;
        e[q++] = -1;
        e[q++] = 1;
        e[q++] = 0;
        e[q++] = 1;
        q = 0;
        f[q++] = 0;
        f[q++] = 1;
        f[q++] = 2;
        f[q++] = 0;
        f[q++] = 2;
        f[q++] = 3;
        h = b.createBuffer();
        g = b.createBuffer();
        b.bindBuffer(b.ARRAY_BUFFER, h);
        b.bufferData(b.ARRAY_BUFFER, e, b.STATIC_DRAW);
        b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, g);
        b.bufferData(b.ELEMENT_ARRAY_BUFFER, f, b.STATIC_DRAW);
        i = b.createTexture();
        k = b.createTexture();
        b.bindTexture(b.TEXTURE_2D, i);
        b.texImage2D(b.TEXTURE_2D, 0, b.RGB, 16, 16,
            0, b.RGB, b.UNSIGNED_BYTE, null);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_S, b.CLAMP_TO_EDGE);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_T, b.CLAMP_TO_EDGE);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MAG_FILTER, b.NEAREST);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MIN_FILTER, b.NEAREST);
        b.bindTexture(b.TEXTURE_2D, k);
        b.texImage2D(b.TEXTURE_2D, 0, b.RGBA, 16, 16, 0, b.RGBA, b.UNSIGNED_BYTE, null);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_S, b.CLAMP_TO_EDGE);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_T, b.CLAMP_TO_EDGE);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MAG_FILTER, b.NEAREST);
        b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MIN_FILTER, b.NEAREST);
        0 >= b.getParameter(b.MAX_VERTEX_TEXTURE_IMAGE_UNITS) ? (m = !1, l = a(THREE.ShaderFlares.lensFlare, d)) : (m = !0, l = a(THREE.ShaderFlares.lensFlareVertexTexture, d));
        n = {};
        t = {};
        n.vertex = b.getAttribLocation(l, "position");
        n.uv = b.getAttribLocation(l, "uv");
        t.renderType = b.getUniformLocation(l, "renderType");
        t.map = b.getUniformLocation(l, "map");
        t.occlusionMap = b.getUniformLocation(l, "occlusionMap");
        t.opacity =
            b.getUniformLocation(l, "opacity");
        t.color = b.getUniformLocation(l, "color");
        t.scale = b.getUniformLocation(l, "scale");
        t.rotation = b.getUniformLocation(l, "rotation");
        t.screenPosition = b.getUniformLocation(l, "screenPosition")
    };
    this.render = function(a, d, e, f) {
        var a = a.__webglFlares,
            u = a.length;
        if (u) {
            var w = new THREE.Vector3,
                E = f / e,
                D = 0.5 * e,
                F = 0.5 * f,
                y = 16 / f,
                x = new THREE.Vector2(y * E, y),
                z = new THREE.Vector3(1, 1, 0),
                O = new THREE.Vector2(1, 1),
                B = t,
                y = n;
            b.useProgram(l);
            b.enableVertexAttribArray(n.vertex);
            b.enableVertexAttribArray(n.uv);
            b.uniform1i(B.occlusionMap, 0);
            b.uniform1i(B.map, 1);
            b.bindBuffer(b.ARRAY_BUFFER, h);
            b.vertexAttribPointer(y.vertex, 2, b.FLOAT, !1, 16, 0);
            b.vertexAttribPointer(y.uv, 2, b.FLOAT, !1, 16, 8);
            b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, g);
            b.disable(b.CULL_FACE);
            b.depthMask(!1);
            var C, I, v, A, G;
            for (C = 0; C < u; C++)
                if (y = 16 / f, x.set(y * E, y), A = a[C], w.set(A.matrixWorld.elements[12], A.matrixWorld.elements[13], A.matrixWorld.elements[14]), w.applyMatrix4(d.matrixWorldInverse), w.applyProjection(d.projectionMatrix), z.copy(w), O.x = z.x * D + D,
                    O.y = z.y * F + F, m || 0 < O.x && O.x < e && 0 < O.y && O.y < f) {
                    b.activeTexture(b.TEXTURE1);
                    b.bindTexture(b.TEXTURE_2D, i);
                    b.copyTexImage2D(b.TEXTURE_2D, 0, b.RGB, O.x - 8, O.y - 8, 16, 16, 0);
                    b.uniform1i(B.renderType, 0);
                    b.uniform2f(B.scale, x.x, x.y);
                    b.uniform3f(B.screenPosition, z.x, z.y, z.z);
                    b.disable(b.BLEND);
                    b.enable(b.DEPTH_TEST);
                    b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0);
                    b.activeTexture(b.TEXTURE0);
                    b.bindTexture(b.TEXTURE_2D, k);
                    b.copyTexImage2D(b.TEXTURE_2D, 0, b.RGBA, O.x - 8, O.y - 8, 16, 16, 0);
                    b.uniform1i(B.renderType, 1);
                    b.disable(b.DEPTH_TEST);
                    b.activeTexture(b.TEXTURE1);
                    b.bindTexture(b.TEXTURE_2D, i);
                    b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0);
                    A.positionScreen.copy(z);
                    A.customUpdateCallback ? A.customUpdateCallback(A) : A.updateLensFlares();
                    b.uniform1i(B.renderType, 2);
                    b.enable(b.BLEND);
                    I = 0;
                    for (v = A.lensFlares.length; I < v; I++) G = A.lensFlares[I], 0.0010 < G.opacity && 0.0010 < G.scale && (z.x = G.x, z.y = G.y, z.z = G.z, y = G.size * G.scale / f, x.x = y * E, x.y = y, b.uniform3f(B.screenPosition, z.x, z.y, z.z), b.uniform2f(B.scale, x.x, x.y), b.uniform1f(B.rotation, G.rotation),
                        b.uniform1f(B.opacity, G.opacity), b.uniform3f(B.color, G.color.r, G.color.g, G.color.b), c.setBlending(G.blending, G.blendEquation, G.blendSrc, G.blendDst), c.setTexture(G.texture, 1), b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0))
                }
            b.enable(b.CULL_FACE);
            b.enable(b.DEPTH_TEST);
            b.depthMask(!0)
        }
    }
};
THREE.ShadowMapPlugin = function() {
    var a, b, c, d, e, f, h = new THREE.Frustum,
        g = new THREE.Matrix4,
        i = new THREE.Vector3,
        k = new THREE.Vector3,
        m = new THREE.Vector3;
    this.init = function(g) {
        a = g.context;
        b = g;
        var g = THREE.ShaderLib.depthRGBA,
            h = THREE.UniformsUtils.clone(g.uniforms);
        c = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h
        });
        d = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            morphTargets: !0
        });
        e = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            skinning: !0
        });
        f = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            morphTargets: !0,
            skinning: !0
        });
        c._shadowPass = !0;
        d._shadowPass = !0;
        e._shadowPass = !0;
        f._shadowPass = !0
    };
    this.render = function(a, c) {
        b.shadowMapEnabled && b.shadowMapAutoUpdate && this.update(a, c)
    };
    this.update = function(l, n) {
        var t, q, p, r, s, u, w, E, D, F = [];
        r = 0;
        a.clearColor(1, 1, 1, 1);
        a.disable(a.BLEND);
        a.enable(a.CULL_FACE);
        a.frontFace(a.CCW);
        b.shadowMapCullFace === THREE.CullFaceFront ?
            a.cullFace(a.FRONT) : a.cullFace(a.BACK);
        b.setDepthTest(!0);
        t = 0;
        for (q = l.__lights.length; t < q; t++)
            if (p = l.__lights[t], p.castShadow)
                if (p instanceof THREE.DirectionalLight && p.shadowCascade)
                    for (s = 0; s < p.shadowCascadeCount; s++) {
                        var y;
                        if (p.shadowCascadeArray[s]) y = p.shadowCascadeArray[s];
                        else {
                            D = p;
                            w = s;
                            y = new THREE.DirectionalLight;
                            y.isVirtual = !0;
                            y.onlyShadow = !0;
                            y.castShadow = !0;
                            y.shadowCameraNear = D.shadowCameraNear;
                            y.shadowCameraFar = D.shadowCameraFar;
                            y.shadowCameraLeft = D.shadowCameraLeft;
                            y.shadowCameraRight = D.shadowCameraRight;
                            y.shadowCameraBottom = D.shadowCameraBottom;
                            y.shadowCameraTop = D.shadowCameraTop;
                            y.shadowCameraVisible = D.shadowCameraVisible;
                            y.shadowDarkness = D.shadowDarkness;
                            y.shadowBias = D.shadowCascadeBias[w];
                            y.shadowMapWidth = D.shadowCascadeWidth[w];
                            y.shadowMapHeight = D.shadowCascadeHeight[w];
                            y.pointsWorld = [];
                            y.pointsFrustum = [];
                            E = y.pointsWorld;
                            u = y.pointsFrustum;
                            for (var x = 0; 8 > x; x++) E[x] = new THREE.Vector3, u[x] = new THREE.Vector3;
                            E = D.shadowCascadeNearZ[w];
                            D = D.shadowCascadeFarZ[w];
                            u[0].set(-1, -1, E);
                            u[1].set(1, -1, E);
                            u[2].set(-1,
                                1, E);
                            u[3].set(1, 1, E);
                            u[4].set(-1, -1, D);
                            u[5].set(1, -1, D);
                            u[6].set(-1, 1, D);
                            u[7].set(1, 1, D);
                            y.originalCamera = n;
                            u = new THREE.Gyroscope;
                            u.position = p.shadowCascadeOffset;
                            u.add(y);
                            u.add(y.target);
                            n.add(u);
                            p.shadowCascadeArray[s] = y;
                            console.log("Created virtualLight", y)
                        }
                        w = p;
                        E = s;
                        D = w.shadowCascadeArray[E];
                        D.position.copy(w.position);
                        D.target.position.copy(w.target.position);
                        D.lookAt(D.target);
                        D.shadowCameraVisible = w.shadowCameraVisible;
                        D.shadowDarkness = w.shadowDarkness;
                        D.shadowBias = w.shadowCascadeBias[E];
                        u = w.shadowCascadeNearZ[E];
                        w = w.shadowCascadeFarZ[E];
                        D = D.pointsFrustum;
                        D[0].z = u;
                        D[1].z = u;
                        D[2].z = u;
                        D[3].z = u;
                        D[4].z = w;
                        D[5].z = w;
                        D[6].z = w;
                        D[7].z = w;
                        F[r] = y;
                        r++
                    } else F[r] = p, r++;
        t = 0;
        for (q = F.length; t < q; t++) {
            p = F[t];
            p.shadowMap || (s = THREE.LinearFilter, b.shadowMapType === THREE.PCFSoftShadowMap && (s = THREE.NearestFilter), p.shadowMap = new THREE.WebGLRenderTarget(p.shadowMapWidth, p.shadowMapHeight, {
                minFilter: s,
                magFilter: s,
                format: THREE.RGBAFormat
            }), p.shadowMapSize = new THREE.Vector2(p.shadowMapWidth, p.shadowMapHeight), p.shadowMatrix = new THREE.Matrix4);
            if (!p.shadowCamera) {
                if (p instanceof THREE.SpotLight) p.shadowCamera = new THREE.PerspectiveCamera(p.shadowCameraFov, p.shadowMapWidth / p.shadowMapHeight, p.shadowCameraNear, p.shadowCameraFar);
                else if (p instanceof THREE.DirectionalLight) p.shadowCamera = new THREE.OrthographicCamera(p.shadowCameraLeft, p.shadowCameraRight, p.shadowCameraTop, p.shadowCameraBottom, p.shadowCameraNear, p.shadowCameraFar);
                else {
                    console.error("Unsupported light type for shadow");
                    continue
                }
                l.add(p.shadowCamera);
                !0 === l.autoUpdate && l.updateMatrixWorld()
            }
            p.shadowCameraVisible &&
                !p.cameraHelper && (p.cameraHelper = new THREE.CameraHelper(p.shadowCamera), p.shadowCamera.add(p.cameraHelper));
            if (p.isVirtual && y.originalCamera == n) {
                s = n;
                r = p.shadowCamera;
                u = p.pointsFrustum;
                D = p.pointsWorld;
                i.set(Infinity, Infinity, Infinity);
                k.set(-Infinity, -Infinity, -Infinity);
                for (w = 0; 8 > w; w++) E = D[w], E.copy(u[w]), THREE.ShadowMapPlugin.__projector.unprojectVector(E, s), E.applyMatrix4(r.matrixWorldInverse), E.x < i.x && (i.x = E.x), E.x > k.x && (k.x = E.x), E.y < i.y && (i.y = E.y), E.y > k.y && (k.y = E.y), E.z < i.z && (i.z = E.z), E.z > k.z &&
                    (k.z = E.z);
                r.left = i.x;
                r.right = k.x;
                r.top = k.y;
                r.bottom = i.y;
                r.updateProjectionMatrix()
            }
            r = p.shadowMap;
            u = p.shadowMatrix;
            s = p.shadowCamera;
            s.position.getPositionFromMatrix(p.matrixWorld);
            m.getPositionFromMatrix(p.target.matrixWorld);
            s.lookAt(m);
            s.updateMatrixWorld();
            s.matrixWorldInverse.getInverse(s.matrixWorld);
            p.cameraHelper && (p.cameraHelper.visible = p.shadowCameraVisible);
            p.shadowCameraVisible && p.cameraHelper.update();
            u.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
            u.multiply(s.projectionMatrix);
            u.multiply(s.matrixWorldInverse);
            g.multiplyMatrices(s.projectionMatrix, s.matrixWorldInverse);
            h.setFromMatrix(g);
            b.setRenderTarget(r);
            b.clear();
            D = l.__webglObjects;
            p = 0;
            for (r = D.length; p < r; p++)
                if (w = D[p], u = w.object, w.render = !1, u.visible && u.castShadow && (!(u instanceof THREE.Mesh || u instanceof THREE.ParticleSystem) || !u.frustumCulled || h.intersectsObject(u))) u._modelViewMatrix.multiplyMatrices(s.matrixWorldInverse, u.matrixWorld), w.render = !0;
            p = 0;
            for (r = D.length; p < r; p++) w = D[p], w.render && (u = w.object, w = w.buffer, x = u.material instanceof THREE.MeshFaceMaterial ?
                u.material.materials[0] : u.material, E = 0 < u.geometry.morphTargets.length && x.morphTargets, x = u instanceof THREE.SkinnedMesh && x.skinning, E = u.customDepthMaterial ? u.customDepthMaterial : x ? E ? f : e : E ? d : c, w instanceof THREE.BufferGeometry ? b.renderBufferDirect(s, l.__lights, null, E, w, u) : b.renderBuffer(s, l.__lights, null, E, w, u));
            D = l.__webglObjectsImmediate;
            p = 0;
            for (r = D.length; p < r; p++) w = D[p], u = w.object, u.visible && u.castShadow && (u._modelViewMatrix.multiplyMatrices(s.matrixWorldInverse, u.matrixWorld), b.renderImmediateObject(s,
                l.__lights, null, c, u))
        }
        t = b.getClearColor();
        q = b.getClearAlpha();
        a.clearColor(t.r, t.g, t.b, q);
        a.enable(a.BLEND);
        b.shadowMapCullFace === THREE.CullFaceFront && a.cullFace(a.BACK)
    }
};
THREE.ShadowMapPlugin.__projector = new THREE.Projector;
THREE.SpritePlugin = function() {
    function a(a, b) {
        return a.z !== b.z ? b.z - a.z : b.id - a.id
    }
    var b, c, d, e, f, h, g, i, k, m;
    this.init = function(a) {
        b = a.context;
        c = a;
        d = a.getPrecision();
        e = new Float32Array(16);
        f = new Uint16Array(6);
        a = 0;
        e[a++] = -1;
        e[a++] = -1;
        e[a++] = 0;
        e[a++] = 0;
        e[a++] = 1;
        e[a++] = -1;
        e[a++] = 1;
        e[a++] = 0;
        e[a++] = 1;
        e[a++] = 1;
        e[a++] = 1;
        e[a++] = 1;
        e[a++] = -1;
        e[a++] = 1;
        e[a++] = 0;
        e[a++] = 1;
        a = 0;
        f[a++] = 0;
        f[a++] = 1;
        f[a++] = 2;
        f[a++] = 0;
        f[a++] = 2;
        f[a++] = 3;
        h = b.createBuffer();
        g = b.createBuffer();
        b.bindBuffer(b.ARRAY_BUFFER, h);
        b.bufferData(b.ARRAY_BUFFER,
            e, b.STATIC_DRAW);
        b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, g);
        b.bufferData(b.ELEMENT_ARRAY_BUFFER, f, b.STATIC_DRAW);
        var a = THREE.ShaderSprite.sprite,
            n = b.createProgram(),
            t = b.createShader(b.FRAGMENT_SHADER),
            q = b.createShader(b.VERTEX_SHADER),
            p = "precision " + d + " float;\n";
        b.shaderSource(t, p + a.fragmentShader);
        b.shaderSource(q, p + a.vertexShader);
        b.compileShader(t);
        b.compileShader(q);
        b.attachShader(n, t);
        b.attachShader(n, q);
        b.linkProgram(n);
        i = n;
        k = {};
        m = {};
        k.position = b.getAttribLocation(i, "position");
        k.uv = b.getAttribLocation(i,
            "uv");
        m.uvOffset = b.getUniformLocation(i, "uvOffset");
        m.uvScale = b.getUniformLocation(i, "uvScale");
        m.rotation = b.getUniformLocation(i, "rotation");
        m.scale = b.getUniformLocation(i, "scale");
        m.alignment = b.getUniformLocation(i, "alignment");
        m.color = b.getUniformLocation(i, "color");
        m.map = b.getUniformLocation(i, "map");
        m.opacity = b.getUniformLocation(i, "opacity");
        m.useScreenCoordinates = b.getUniformLocation(i, "useScreenCoordinates");
        m.sizeAttenuation = b.getUniformLocation(i, "sizeAttenuation");
        m.screenPosition = b.getUniformLocation(i,
            "screenPosition");
        m.modelViewMatrix = b.getUniformLocation(i, "modelViewMatrix");
        m.projectionMatrix = b.getUniformLocation(i, "projectionMatrix");
        m.fogType = b.getUniformLocation(i, "fogType");
        m.fogDensity = b.getUniformLocation(i, "fogDensity");
        m.fogNear = b.getUniformLocation(i, "fogNear");
        m.fogFar = b.getUniformLocation(i, "fogFar");
        m.fogColor = b.getUniformLocation(i, "fogColor");
        m.alphaTest = b.getUniformLocation(i, "alphaTest")
    };
    this.render = function(d, e, f, q) {
        var p = d.__webglSprites,
            r = p.length;
        if (r) {
            var s = k,
                u = m,
                w = q /
                f,
                f = 0.5 * f,
                E = 0.5 * q;
            b.useProgram(i);
            b.enableVertexAttribArray(s.position);
            b.enableVertexAttribArray(s.uv);
            b.disable(b.CULL_FACE);
            b.enable(b.BLEND);
            b.bindBuffer(b.ARRAY_BUFFER, h);
            b.vertexAttribPointer(s.position, 2, b.FLOAT, !1, 16, 0);
            b.vertexAttribPointer(s.uv, 2, b.FLOAT, !1, 16, 8);
            b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, g);
            b.uniformMatrix4fv(u.projectionMatrix, !1, e.projectionMatrix.elements);
            b.activeTexture(b.TEXTURE0);
            b.uniform1i(u.map, 0);
            var D = s = 0,
                F = d.fog;
            F ? (b.uniform3f(u.fogColor, F.color.r, F.color.g, F.color.b),
                F instanceof THREE.Fog ? (b.uniform1f(u.fogNear, F.near), b.uniform1f(u.fogFar, F.far), b.uniform1i(u.fogType, 1), D = s = 1) : F instanceof THREE.FogExp2 && (b.uniform1f(u.fogDensity, F.density), b.uniform1i(u.fogType, 2), D = s = 2)) : (b.uniform1i(u.fogType, 0), D = s = 0);
            for (var y, x, z = [], F = 0; F < r; F++) y = p[F], x = y.material, y.visible && 0 !== x.opacity && (x.useScreenCoordinates ? y.z = -y.position.z : (y._modelViewMatrix.multiplyMatrices(e.matrixWorldInverse, y.matrixWorld), y.z = -y._modelViewMatrix.elements[14]));
            p.sort(a);
            for (F = 0; F < r; F++) y =
                p[F], x = y.material, y.visible && 0 !== x.opacity && (x.map && x.map.image && x.map.image.width) && (b.uniform1f(u.alphaTest, x.alphaTest), !0 === x.useScreenCoordinates ? (b.uniform1i(u.useScreenCoordinates, 1), b.uniform3f(u.screenPosition, (y.position.x * c.devicePixelRatio - f) / f, (E - y.position.y * c.devicePixelRatio) / E, Math.max(0, Math.min(1, y.position.z))), z[0] = c.devicePixelRatio, z[1] = c.devicePixelRatio) : (b.uniform1i(u.useScreenCoordinates, 0), b.uniform1i(u.sizeAttenuation, x.sizeAttenuation ? 1 : 0), b.uniformMatrix4fv(u.modelViewMatrix, !1, y._modelViewMatrix.elements), z[0] = 1, z[1] = 1), e = d.fog && x.fog ? D : 0, s !== e && (b.uniform1i(u.fogType, e), s = e), e = 1 / (x.scaleByViewport ? q : 1), z[0] *= e * w * y.scale.x, z[1] *= e * y.scale.y, b.uniform2f(u.uvScale, x.uvScale.x, x.uvScale.y), b.uniform2f(u.uvOffset, x.uvOffset.x, x.uvOffset.y), b.uniform2f(u.alignment, x.alignment.x, x.alignment.y), b.uniform1f(u.opacity, x.opacity), b.uniform3f(u.color, x.color.r, x.color.g, x.color.b), b.uniform1f(u.rotation, y.rotation), b.uniform2fv(u.scale, z), c.setBlending(x.blending, x.blendEquation,
                    x.blendSrc, x.blendDst), c.setDepthTest(x.depthTest), c.setDepthWrite(x.depthWrite), c.setTexture(x.map, 0), b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0));
            b.enable(b.CULL_FACE)
        }
    }
};
THREE.DepthPassPlugin = function() {
    this.enabled = !1;
    this.renderTarget = null;
    var a, b, c, d, e, f, h = new THREE.Frustum,
        g = new THREE.Matrix4;
    this.init = function(g) {
        a = g.context;
        b = g;
        var g = THREE.ShaderLib.depthRGBA,
            h = THREE.UniformsUtils.clone(g.uniforms);
        c = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h
        });
        d = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            morphTargets: !0
        });
        e = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            skinning: !0
        });
        f = new THREE.ShaderMaterial({
            fragmentShader: g.fragmentShader,
            vertexShader: g.vertexShader,
            uniforms: h,
            morphTargets: !0,
            skinning: !0
        });
        c._shadowPass = !0;
        d._shadowPass = !0;
        e._shadowPass = !0;
        f._shadowPass = !0
    };
    this.render = function(a, b) {
        this.enabled && this.update(a, b)
    };
    this.update = function(i, k) {
        var m, l, n, t, q, p;
        a.clearColor(1, 1, 1, 1);
        a.disable(a.BLEND);
        b.setDepthTest(!0);
        !0 === i.autoUpdate && i.updateMatrixWorld();
        k.matrixWorldInverse.getInverse(k.matrixWorld);
        g.multiplyMatrices(k.projectionMatrix,
            k.matrixWorldInverse);
        h.setFromMatrix(g);
        b.setRenderTarget(this.renderTarget);
        b.clear();
        p = i.__webglObjects;
        m = 0;
        for (l = p.length; m < l; m++)
            if (n = p[m], q = n.object, n.render = !1, q.visible && (!(q instanceof THREE.Mesh || q instanceof THREE.ParticleSystem) || !q.frustumCulled || h.intersectsObject(q))) q._modelViewMatrix.multiplyMatrices(k.matrixWorldInverse, q.matrixWorld), n.render = !0;
        var r;
        m = 0;
        for (l = p.length; m < l; m++)
            if (n = p[m], n.render && (q = n.object, n = n.buffer, !(q instanceof THREE.ParticleSystem) || q.customDepthMaterial))(r =
                q.material instanceof THREE.MeshFaceMaterial ? q.material.materials[0] : q.material) && b.setMaterialFaces(q.material), t = 0 < q.geometry.morphTargets.length && r.morphTargets, r = q instanceof THREE.SkinnedMesh && r.skinning, t = q.customDepthMaterial ? q.customDepthMaterial : r ? t ? f : e : t ? d : c, n instanceof THREE.BufferGeometry ? b.renderBufferDirect(k, i.__lights, null, t, n, q) : b.renderBuffer(k, i.__lights, null, t, n, q);
        p = i.__webglObjectsImmediate;
        m = 0;
        for (l = p.length; m < l; m++) n = p[m], q = n.object, q.visible && (q._modelViewMatrix.multiplyMatrices(k.matrixWorldInverse,
            q.matrixWorld), b.renderImmediateObject(k, i.__lights, null, c, q));
        m = b.getClearColor();
        l = b.getClearAlpha();
        a.clearColor(m.r, m.g, m.b, l);
        a.enable(a.BLEND)
    }
};
THREE.ShaderFlares = {
    lensFlareVertexTexture: {
        vertexShader: "uniform lowp int renderType;\nuniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nuniform sampler2D occlusionMap;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nvUV = uv;\nvec2 pos = position;\nif( renderType == 2 ) {\nvec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );\nvisibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );\nvVisibility =        visibility.r / 9.0;\nvVisibility *= 1.0 - visibility.g / 9.0;\nvVisibility *=       visibility.b / 9.0;\nvVisibility *= 1.0 - visibility.a / 9.0;\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",
        fragmentShader: "uniform lowp int renderType;\nuniform sampler2D map;\nuniform float opacity;\nuniform vec3 color;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( 1.0, 0.0, 1.0, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nvec4 texture = texture2D( map, vUV );\ntexture.a *= opacity * vVisibility;\ngl_FragColor = texture;\ngl_FragColor.rgb *= color;\n}\n}"
    },
    lensFlare: {
        vertexShader: "uniform lowp int renderType;\nuniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvoid main() {\nvUV = uv;\nvec2 pos = position;\nif( renderType == 2 ) {\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",
        fragmentShader: "precision mediump float;\nuniform lowp int renderType;\nuniform sampler2D map;\nuniform sampler2D occlusionMap;\nuniform float opacity;\nuniform vec3 color;\nvarying vec2 vUV;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( texture2D( map, vUV ).rgb, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nfloat visibility = texture2D( occlusionMap, vec2( 0.5, 0.1 ) ).a;\nvisibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) ).a;\nvisibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) ).a;\nvisibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) ).a;\nvisibility = ( 1.0 - visibility / 4.0 );\nvec4 texture = texture2D( map, vUV );\ntexture.a *= opacity * visibility;\ngl_FragColor = texture;\ngl_FragColor.rgb *= color;\n}\n}"
    }
};
THREE.ShaderSprite = {
    sprite: {
        vertexShader: "uniform int useScreenCoordinates;\nuniform int sizeAttenuation;\nuniform vec3 screenPosition;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform float rotation;\nuniform vec2 scale;\nuniform vec2 alignment;\nuniform vec2 uvOffset;\nuniform vec2 uvScale;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvoid main() {\nvUV = uvOffset + uv * uvScale;\nvec2 alignedPosition = position + alignment;\nvec2 rotatedPosition;\nrotatedPosition.x = ( cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y ) * scale.x;\nrotatedPosition.y = ( sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y ) * scale.y;\nvec4 finalPosition;\nif( useScreenCoordinates != 0 ) {\nfinalPosition = vec4( screenPosition.xy + rotatedPosition, screenPosition.z, 1.0 );\n} else {\nfinalPosition = projectionMatrix * modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\nfinalPosition.xy += rotatedPosition * ( sizeAttenuation == 1 ? 1.0 : finalPosition.z );\n}\ngl_Position = finalPosition;\n}",
        fragmentShader: "uniform vec3 color;\nuniform sampler2D map;\nuniform float opacity;\nuniform int fogType;\nuniform vec3 fogColor;\nuniform float fogDensity;\nuniform float fogNear;\nuniform float fogFar;\nuniform float alphaTest;\nvarying vec2 vUV;\nvoid main() {\nvec4 texture = texture2D( map, vUV );\nif ( texture.a < alphaTest ) discard;\ngl_FragColor = vec4( color * texture.xyz, texture.a * opacity );\nif ( fogType > 0 ) {\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\nfloat fogFactor = 0.0;\nif ( fogType == 1 ) {\nfogFactor = smoothstep( fogNear, fogFar, depth );\n} else {\nconst float LOG2 = 1.442695;\nfloat fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );\nfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n}\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n}\n}"
    }
};

/*
 * The MIT License (MIT)
 * 
 * Copyright (c) 2013 Robert O'Leary
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * ------------------------------------------- NOTE -------------------------------------------
 *
 * The default recognition function in this version of LeapTrainer is geometric template matching.  
 * 
 * The implementation below is based on work at the University of Washington, described here:
 * 
 * 	http://depts.washington.edu/aimgroup/proj/dollar/pdollar.html
 * 
 * This implementation has been somewhat modified, functions in three dimensions, and has been 
 * optimized for performance.
 * 
 * --------------------------------------------------------------------------------------------
 */
var LeapTrainer = {};
(function() {
    var initializing = false,
        fnTest = /xyz/.test(function() {
            xyz;
        }) ? /\b_super\b/ : /.*/;
    this.Class = function() {};
    Class.extend = function(prop) {
        var _super = this.prototype;
        initializing = true, prototype = new this();
        initializing = false;
        for (var name in prop) {
            prototype[name] = typeof prop[name] == "function" && typeof _super[name] == "function" && fnTest.test(prop[name]) ? (function(name, fn) {
                return function() {
                    var tmp = this._super;
                    this._super = _super[name];
                    var ret = fn.apply(this, arguments);
                    this._super = tmp;
                    return ret;
                };
            })(name, prop[name]) : prop[name];
        }

        function Class() {
            if (!initializing && this.initialize) {
                this.initialize.apply(this, arguments);
            }
        }
        Class.prototype = prototype;
        Class.prototype.constructor = Class;
        Class.extend = arguments.callee;
        Class.overidden = prop;
        return Class;
    };
})();
LeapTrainer.Controller = Class.extend({
    controller: null,
    pauseOnWindowBlur: true,
    background: false,
    minRecordingVelocity: 300,
    minGestureFrames: 5,
    hitThreshold: 0.15,
    pose: null,
    prePose: null,
    poseName: null,
    firedPoseEvent: false,
    poseHitThreshold: 0.929,
    trainingCountdown: 3,
    trainingGestures: 1,
    convolutionFactor: 0,
    downtime: 1000,
    lastHit: 0,
    gestures: {},
    trainingGesture: null,
    listeners: {},
    paused: false,
    renderableGesture: null,
    initialize: function(options) {
        if (options) {
            for (var optionName in options) {
                if (options.hasOwnProperty(optionName)) {
                    this[optionName] = options[optionName];
                }
            }
        }
        this.templateMatcher = new LeapTrainer.TemplateMatcher();
        var connectController = !this.controller;
        if (connectController) {
            this.controller = new Leap.Controller();
        }
        this.bindFrameListener();
        if (connectController) {
            this.controller.connect();
        }
    },
    onFrame: function() {},
    bindFrameListener: function() {
        var recording = false,
            frameCount = 0,
            gesture = [],
            poseFrame = [],
            poseHit, recordValue = function(val) {
                gesture.push(isNaN(val) ? 0 : val);
            },
            recordVector = function(v) {
                recordValue(v[0]);
                recordValue(v[1]);
                recordValue(v[2]);
            },
            recordPoseValue = function(val) {
                poseFrame.push(isNaN(val) ? 0 : val);
            },
            recordPoseVector = function(v) {
                recordPoseValue(v[0]);
                recordPoseValue(v[1]);
                recordPoseValue(v[2]);
            };
        this.onFrame = function(frame) {
            if (this.paused) {
                return;
            }
            if (this.pose) {
                poseFrame = [];
                poseHit = 0;
                this.recordFrame(frame, this.prePose, recordPoseVector, recordPoseValue);
                if (poseFrame.length > 0) {
                    poseHit = this.correlate(this.poseName, [this.templateMatcher.process(poseFrame)], this.pose);
                }
                if (poseHit > this.poseHitThreshold) {
                    if (!this.firedPoseEvent) {
                        this.firedPoseEvent = true;
                        this.fire("holding-pose", this.poseName);
                    }
                } else {
                    this.firedPoseEvent = false;
                    this.pose = null;
                    this.fire("released-pose", this.poseName);
                }
            }
            if (new Date().getTime() - this.lastHit < this.downtime) {
                return;
            }
            if (this.recordableFrame(frame, this.minRecordingVelocity)) {
                if (!recording) {
                    recording = true;
                    frameCount = 0;
                    gesture = [];
                    this.renderableGesture = [];
                    this.fire("started-recording");
                }
                frameCount++;
                this.recordFrame(frame, this.controller.frame(1), recordVector, recordValue);
                this.recordRenderableFrame(frame, this.controller.frame(1));
            } else {
                if (recording) {
                    recording = false;
                    this.fire("stopped-recording");
                    if (frameCount >= this.minGestureFrames) {
                        this.fire("gesture-detected", gesture, frameCount);
                        var gestureName = this.trainingGesture;
                        if (gestureName) {
                            this.saveTrainingGesture(gestureName, gesture);
                        } else {
                            this.recognize(gesture, frameCount);
                        }
                        this.lastHit = new Date().getTime();
                    }
                }
            }
        };
        this.controller.on("frame", this.onFrame.bind(this));
        if (this.pauseOnWindowBlur) {
            this.controller.on("blur", this.pause.bind(this));
            this.controller.on("focus", this.resume.bind(this));
        }
    },
    recordableFrame: function(frame, min) {
        var hands = frame.hands,
            j, hand, fingers, palmVelocity, tipVelocity;
        for (var i = 0, l = hands.length; i < l; i++) {
            hand = hands[i];
            palmVelocity = hand.palmVelocity;
            if (Math.max(Math.abs(palmVelocity[0]), Math.abs(palmVelocity[1]), Math.abs(palmVelocity[2])) >= min) {
                return true;
            }
            fingers = hand.fingers;
            for (j = 0, k = fingers.length; j < k; j++) {
                tipVelocity = fingers[j].tipVelocity;
                if (Math.max(Math.abs(tipVelocity[0]), Math.abs(tipVelocity[1]), Math.abs(tipVelocity[2])) >= min) {
                    return true;
                }
            }
        }
    },
    recordFrame: function(frame, lastFrame, recordVector, recordValue) {
        var hands = frame.hands;
        var handCount = hands.length;
        var hand, finger, fingers, fingerCount;
        for (var i = 0, l = handCount; i < l; i++) {
            hand = hands[i];
            recordVector(hand.stabilizedPalmPosition);
            fingers = hand.fingers;
            fingerCount = fingers.length;
            for (var j = 0, k = fingerCount; j < k; j++) {
                finger = fingers[j];
                recordVector(finger.stabilizedTipPosition);
            }
        }
    },
    recordRenderableFrame: function(frame, lastFrame) {
        var frameData = [];
        var hands = frame.hands;
        var handCount = hands.length;
        var hand, finger, fingers, fingerCount, handData, fingersData;
        for (var i = 0, l = handCount; i < l; i++) {
            hand = hands[i];
            handData = {
                position: hand.stabilizedPalmPosition,
                direction: hand.direction,
                palmNormal: hand.palmNormal
            };
            fingers = hand.fingers;
            fingerCount = fingers.length;
            fingersData = [];
            for (var j = 0, k = fingerCount; j < k; j++) {
                finger = fingers[j];
                fingersData.push({
                    position: finger.stabilizedTipPosition,
                    direction: finger.direction,
                    length: finger.length
                });
            }
            handData.fingers = fingersData;
            frameData.push(handData);
        }
        this.renderableGesture.push(frameData);
    },
    create: function(gestureName, skipTraining) {
        this.gestures[gestureName] = [];
        this.fire("gesture-created", gestureName, skipTraining);
        if (typeof skipTraining == "undefined" || !skipTraining) {
            this.pause();
            this.startTraining(gestureName, this.trainingCountdown);
        }
    },
    startTraining: function(gestureName, countdown) {
        if (countdown > 0) {
            this.fire("training-countdown", countdown);
            countdown--;
            setTimeout(function() {
                this.startTraining(gestureName, countdown);
            }.bind(this), 1000);
            return;
        }
        this.resume();
        this.trainingGesture = gestureName;
        this.fire("training-started", gestureName);
    },
    retrain: function(gestureName) {
        var storedGestures = this.gestures[gestureName];
        if (storedGestures) {
            storedGestures.length = 0;
            this.startTraining(gestureName, this.trainingCountdown);
            return true;
        }
        return false;
    },
    trainAlgorithm: function(gestureName, trainingGestures) {
        for (var i = 0, l = trainingGestures.length; i < l; i++) {
            trainingGestures[i] = this.templateMatcher.process(trainingGestures[i]);
        }
    },
    saveTrainingGesture: function(gestureName, gesture) {
        var trainingGestures = this.gestures[gestureName];
        trainingGestures.push(gesture);
        if (trainingGestures.length == this.trainingGestures) {
            this.gestures[gestureName] = this.distribute(trainingGestures);
            this.trainingGesture = null;
            this.trainAlgorithm(gestureName, trainingGestures);
            this.fire("training-complete", gestureName, trainingGestures);
        } else {
            this.fire("training-gesture-saved", gestureName, trainingGestures);
        }
    },
    distribute: function(trainingGestures) {
        var factor = this.convolutionFactor;
        if (factor == 0) {
            return trainingGestures;
        }
        var gesture, generatedGesture, value;
        for (var i = 0, p = factor; i < p; i++) {
            for (var j = 0, l = trainingGestures.length; j < l; j++) {
                gesture = trainingGestures[j];
                generatedGesture = [];
                for (var k = 0, m = gesture.length; k < m; k++) {
                    value = gesture[k];
                    generatedGesture[k] = Math.round((Math.random() * 2 - 1) + (Math.random() * 2 - 1) + (Math.random() * 2 - 1) * ((value * 10000) / 50) + (value * 10000)) / 10000;
                }
                trainingGestures.push(generatedGesture);
            }
        }
        return trainingGestures;
    },
    recognize: function(gesture, frameCount) {
        var gestures = this.gestures;
        var threshold = this.hitThreshold;
        var allHits = {};
        var hit = 0;
        var bestHit = 0;
        var recognized = false;
        var closestGestureName = null;
        for (var gestureName in gestures) {
            hit = this.correlate(gestureName, gestures[gestureName], gesture);
            allHits[gestureName] = hit;
            if (hit >= threshold) {
                recognized = true;
            }
            if (hit > bestHit) {
                bestHit = hit;
                closestGestureName = gestureName;
            }
        }
        if (recognized) {
            this.pose = gesture.slice(gesture.length - (gesture.length / frameCount));
            this.prePose = this.controller.frame(1);
            this.poseName = closestGestureName;
            this.fire("gesture-recognized", bestHit, closestGestureName, allHits);
            this.fire(closestGestureName);
        } else {
            this.fire("gesture-unknown", allHits);
        }
    },
    correlate: function(gestureName, trainingGestures, gesture) {
        gesture = this.templateMatcher.process(gesture);
        var nearest = +Infinity,
            foundMatch = false,
            distance;
        for (var i = 0, l = trainingGestures.length; i < l; i++) {
            distance = this.templateMatcher.match(gesture, trainingGestures[i]);
            if (distance < nearest) {
                nearest = distance;
                foundMatch = true;
            }
        }
        return (!foundMatch) ? 0 : (Math.min(parseInt(100 * Math.max(nearest - 4) / -4, 0), 100) / 100);
    },
    getRecordingTriggerStrategy: function() {
        return "Frame velocity";
    },
    getFrameRecordingStrategy: function() {
        return "3D Geometric Positioning";
    },
    getRecognitionStrategy: function() {
        return "Geometric Template Matching";
    },
    toJSON: function(gestureName) {
        var gesture = this.gestures[gestureName];
        if (gesture) {
            return JSON.stringify({
                name: gestureName,
                data: gesture
            });
        }
    },
    fromJSON: function(json) {
        var imp = JSON.parse(json);
        var gestureName = imp.name;
        this.create(gestureName, true);
        this.gestures[gestureName] = imp.data;
        return imp;
    },
    on: function(event, listener) {
        var listening = this.listeners[event];
        if (!listening) {
            listening = [];
        }
        listening.push(listener);
        this.listeners[event] = listening;
        return this;
    },
    off: function(event, listener) {
        if (!event) {
            return this;
        }
        var listening = this.listeners[event];
        if (listening) {
            listening.splice(listening.indexOf(listener), 1);
            this.listeners[event] = listening;
        }
        return this;
    },
    fire: function(event) {
        var listening = this.listeners[event];
        if (listening) {
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            for (var i = 0, l = listening.length; i < l; i++) {
                listening[i].apply(this, args);
            }
        }
        return this;
    },
    pause: function() {
        this.paused = true;
        return this;
    },
    resume: function() {
        this.paused = false;
        return this;
    },
    destroy: function() {
        this.controller.removeListener("frame", this.onFrame);
    }
});
/*
 * --------------------------------------------------------------------------------------------------------
 * 
 * 										GEOMETRIC TEMPLATE MATCHER
 * 
 * --------------------------------------------------------------------------------------------------------
 * 
 * Everything below this point is a geometric template matching implementation. This object implements the current 
 * DEFAULT default recognition strategy used by the framework.
 * 
 * This implementation is based on work at the University of Washington, described here:
 * 
 * 	http://depts.washington.edu/aimgroup/proj/dollar/pdollar.html
 * 
 * This implementation has been somewhat modified, functions in three dimensions, and has been 
 * optimized for performance.
 * 
 * Theoretically this implementation CAN support multi-stroke gestures - but there is not yet support in the LeapTrainer 
 * Controller or training UI for these kinds of gesture.
 * 
 * --------------------------------------------------------------------------------------------------------
 */
LeapTrainer.Point = function(x, y, z, stroke) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.stroke = stroke;
};
LeapTrainer.TemplateMatcher = Class.extend({
    pointCount: 100,
    origin: new LeapTrainer.Point(0, 0, 0),
    process: function(gesture) {
        var points = [];
        var stroke = 1;
        for (var i = 0, l = gesture.length; i < l; i += 3) {
            points.push(new LeapTrainer.Point(gesture[i], gesture[i + 1], gesture[i + 2], stroke));
        }
        return this.translateTo(this.scale(this.resample(points, this.pointCount)), this.origin);
    },
    match: function(gesture, trainingGesture) {
        var l = gesture.length,
            step = Math.floor(Math.pow(l, 1 - this.e)),
            min = +Infinity,
            minf = Math.min;
        for (var i = 0; i < l; i += step) {
            min = minf(min, minf(this.gestureDistance(gesture, trainingGesture, i), this.gestureDistance(trainingGesture, gesture, i)));
        }
        return min;
    },
    gestureDistance: function(gesture1, gesture2, start) {
        var p1l = gesture1.length;
        var matched = new Array(p1l);
        var sum = 0,
            i = start,
            index, min, d;
        do {
            index = -1, min = +Infinity;
            for (var j = 0; j < p1l; j++) {
                if (!matched[j]) {
                    if (gesture1[i] == null || gesture2[j] == null) {
                        continue;
                    }
                    d = this.distance(gesture1[i], gesture2[j]);
                    if (d < min) {
                        min = d;
                        index = j;
                    }
                }
            }
            matched[index] = true;
            sum += (1 - ((i - start + p1l) % p1l) / p1l) * min;
            i = (i + 1) % p1l;
        } while (i != start);
        return sum;
    },
    resample: function(gesture, newLength) {
        var target = newLength - 1;
        var interval = this.pathLength(gesture) / target,
            dist = 0,
            resampledGesture = new Array(gesture[0]),
            d, p, pp, ppx, ppy, ppz, q;
        for (var i = 1, l = gesture.length; i < l; i++) {
            p = gesture[i];
            pp = gesture[i - 1];
            if (p.stroke == pp.stroke) {
                d = this.distance(pp, p);
                if ((dist + d) >= interval) {
                    ppx = pp.x;
                    ppy = pp.y;
                    ppz = pp.z;
                    q = new LeapTrainer.Point((ppx + ((interval - dist) / d) * (p.x - ppx)), (ppy + ((interval - dist) / d) * (p.y - ppy)), (ppz + ((interval - dist) / d) * (p.z - ppz)), p.stroke);
                    resampledGesture.push(q);
                    gesture.splice(i, 0, q);
                    dist = 0;
                } else {
                    dist += d;
                }
            }
        }
        if (resampledGesture.length != target) {
            p = gesture[gesture.length - 1];
            resampledGesture.push(new LeapTrainer.Point(p.x, p.y, p.z, p.stroke));
        }
        return resampledGesture;
    },
    scale: function(gesture) {
        var minX = +Infinity,
            maxX = -Infinity,
            minY = +Infinity,
            maxY = -Infinity,
            minZ = +Infinity,
            maxZ = -Infinity,
            l = gesture.length,
            g, x, y, z, min = Math.min,
            max = Math.max;
        for (var i = 0; i < l; i++) {
            g = gesture[i];
            x = g.x;
            y = g.y;
            z = g.z;
            minX = min(minX, x);
            minY = min(minY, y);
            minZ = min(minZ, z);
            maxX = max(maxX, x);
            maxY = max(maxY, y);
            maxZ = max(maxZ, z);
        }
        var size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
        for (var i = 0; i < l; i++) {
            g = gesture[i];
            gesture[i] = new LeapTrainer.Point((g.x - minX) / size, (g.y - minY) / size, (g.z - minZ) / size, g.stroke);
        }
        return gesture;
    },
    translateTo: function(gesture, centroid) {
        var center = this.centroid(gesture),
            g;
        for (var i = 0, l = gesture.length; i < l; i++) {
            g = gesture[i];
            gesture[i] = new LeapTrainer.Point((g.x + centroid.x - center.x), (g.y + centroid.y - center.y), (g.z + centroid.z - center.z), g.stroke);
        }
        return gesture;
    },
    centroid: function(gesture) {
        var x = 0,
            y = 0,
            z = 0,
            l = gesture.length,
            g;
        for (var i = 0; i < l; i++) {
            g = gesture[i];
            x += g.x;
            y += g.y;
            z += g.z;
        }
        return new LeapTrainer.Point(x / l, y / l, z / l, 0);
    },
    pathDistance: function(gesture1, gesture2) {
        var d = 0,
            l = gesture1.length;
        for (var i = 0; i < l; i++) {
            d += this.distance(gesture1[i], gesture2[i]);
        }
        return d / l;
    },
    pathLength: function(gesture) {
        var d = 0,
            g, gg;
        for (var i = 1, l = gesture.length; i < l; i++) {
            g = gesture[i];
            gg = gesture[i - 1];
            if (g.stroke == gg.stroke) {
                d += this.distance(gg, g);
            }
        }
        return d;
    },
    distance: function(p1, p2) {
        var dx = p1.x - p2.x;
        var dy = p1.y - p2.y;
        var dz = p1.z - p2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
});


var LeapCursor = function(options) {
    this.initialize(options || {});
};
LeapCursor.prototype = {
    canvas: null,
    controller: null,
    trainer: null,
    trainerEnabled: false,
    evtController: null,
    highlightedElm: null,
    target: window,
    width: 110,
    height: 110,
    top: null,
    left: null,
    defaultHandPosition: false,
    gestureColor: "#88CFEB",
    color: "#000000",
    yOffset: -160,
    palms: null,
    fingers: null,
    renderer: null,
    material: null,
    recordingMaterial: null,
    palmGeometry: null,
    fingerGeometry: null,
    shadowPlane: null,
    camera: null,
    light: null,
    scene: null,
    lastFrame: null,
    speed: [0, 0, 0],
    dampening: 0.95,
    scrollSpeed: 0,
    initialize: function(options) {
        for (var optionName in options) {
            if (options.hasOwnProperty(optionName)) {
                this[optionName] = options[optionName];
            }
        }
        if (options.controller) {
            this.trainerEnabled = options.controller.controller != null;
        } else {
            this.trainerEnabled = typeof LeapTrainer == "object";
            this.controller = this.trainerEnabled ? new LeapTrainer.Controller({
                pauseOnWindowBlur: false
            }) : new Leap.Controller();
        }
        this.evtController = (this.trainerEnabled ? this.controller.controller : this.controller);
        this.evtController.on("connect", function() {
            this.createCursor(options);
        }.bind(this));
        if (!this.trainerEnabled) {
            this.controller.connect();
        } else {
            this.trainer = this.controller;
            this.initDefaultGestures();
        }
    },
    initDefaultGestures: function() {
        this.trainer.fromJSON('{"name":"TAP","data":[[{"x":0.03185018841689369,"y":-0.2955364919879749,"z":0.30395151229974915,"stroke":1},{"x":0.007577409512100508,"y":-0.143194645412326,"z":0.19583884160435477,"stroke":1},{"x":-0.01669536939269267,"y":0.009147201163322904,"z":0.08772617090896045,"stroke":1},{"x":-0.04096814829748574,"y":0.16148904773897182,"z":-0.020386499786433865,"stroke":1},{"x":-0.06524092720227892,"y":0.31383089431462075,"z":-0.12849917048182818,"stroke":1},{"x":0.07782081571377697,"y":0.22476552136320582,"z":-0.1333397144261559,"stroke":1},{"x":0.23307373058642433,"y":0.11811240326038724,"z":-0.13065635809070106,"stroke":1},{"x":0.3883266454590718,"y":0.011459285157568666,"z":-0.1279730017552462,"stroke":1},{"x":0.4352681776798024,"y":-0.0009652123270492141,"z":-0.12706884891425413,"stroke":1},{"x":0.3081486887178203,"y":0.13803971088137734,"z":-0.12902395213255644,"stroke":1},{"x":0.17468263510031368,"y":0.17148676740131702,"z":-0.10384411619161024,"stroke":1},{"x":0.03273981198368481,"y":0.06394578498928477,"z":-0.04242158249047845,"stroke":1},{"x":-0.10920301113294412,"y":-0.04359519742274748,"z":0.019000951210653316,"stroke":1},{"x":-0.25114583424957293,"y":-0.15113617983477973,"z":0.08042348491178514,"stroke":1},{"x":-0.39308865736620174,"y":-0.2586771622468122,"z":0.1418460186129169,"stroke":1},{"x":-0.3676876892078774,"y":-0.2980322196198223,"z":0.18794861619097114,"stroke":1},{"x":-0.1837044150586537,"y":-0.2727713079961436,"z":0.2195333713111643,"stroke":1},{"x":0.0002788590905699051,"y":-0.24751039637246458,"z":0.25111812643135767,"stroke":1},{"x":-0.010260994114239419,"y":-0.09918735642352758,"z":0.15251566678561213,"stroke":1},{"x":-0.030960057779212846,"y":0.05556275509441916,"z":0.0471140191357452,"stroke":1},{"x":-0.05165912144418616,"y":0.21031286661236592,"z":-0.0582876285141217,"stroke":1},{"x":-0.025351960830330755,"y":0.2967565986430546,"z":-0.13573927637868743,"stroke":1},{"x":0.13185969510169626,"y":0.1929784553588551,"z":-0.1353548361044802,"stroke":1},{"x":0.28907135103372306,"y":0.08920031207465556,"z":-0.13497039583027298,"stroke":1},{"x":-0.5647318223201976,"y":-0.24648143440976086,"z":-0.2794513983064423,"stroke":1}]]}');
        this.trainer.on("TAP", function() {
            this.fire("click");
        }.bind(this));
    },
    createCursor: function() {
        if (this.canvas == null) {
            this.canvas = document.createElement("div");
            this.canvas.style.position = "fixed";
            this.canvas.style.width = this.width + "px";
            this.canvas.style.height = this.height + "px";
            this.canvas.style.zIndex = 999999999;
            document.body.appendChild(this.canvas);
        }
        this.renderer = Detector.webgl ? new THREE.WebGLRenderer({
            antialias: true
        }) : new THREE.CanvasRenderer();
        this.renderer.setSize(this.width, this.height);
        this.renderer.shadowMapEnabled = true;
        this.material = new THREE.MeshBasicMaterial({
            color: this.color
        });
        this.recordingMaterial = new THREE.MeshBasicMaterial({
            color: this.gestureColor
        });
        this.palmGeometry = new THREE.CubeGeometry(60, 10, 60);
        this.fingerGeometry = Detector.webgl ? new THREE.SphereGeometry(5, 20, 10) : new THREE.TorusGeometry(1, 5, 5, 5);
        this.scene = new THREE.Scene();
        this.light = new THREE.SpotLight();
        this.light.castShadow = true;
        this.scene.add(this.light);
        this.camera = new THREE.PerspectiveCamera(45, 1, 1, 3000);
        this.canvas.appendChild(this.renderer.domElement);
        this.palms = [this.createPalm(), this.createPalm()];
        this.palms[1].visible = false;
        this.scene.add(this.palms[0]);
        this.scene.add(this.palms[1]);
        var finger;
        this.fingers = [];
        for (var j = 0; j < 10; j++) {
            finger = this.createFinger();
            finger.visible = j < 5;
            this.scene.add(finger);
            this.fingers.push(finger);
        }
        this.createShadowPlane();
        this.setDefaultPosition();
        if (window.addEventListener) {
            window.addEventListener("resize", this.setDefaultPosition.bind(this), false);
        } else {
            if (elem.attachEvent) {
                window.attachEvent("onResize", this.setDefaultPosition.bind(this));
            }
        }
        if (this.trainerEnabled) {
            this.controller.on("started-recording", function() {
                this.setHandMaterial(this.recordingMaterial);
            }.bind(this)).on("stopped-recording", function() {
                this.setHandMaterial(this.material);
            }.bind(this));
        }
        window.requestAnimFrame = (function() {
            return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
        })();
        requestAnimFrame(this.updateRender.bind(this));
        var hand, palm, handFingers, handFingerCount, finger, handCount, elm;
        var clock = new THREE.Clock();
        clock.previousTime = 1000000;
        this.evtController.on("frame", function(frame) {
            if (clock.previousTime === 1000000) {
                this.scroll(frame);
                handCount = frame.hands.length;
                if (handCount > 0 && handCount <2) {
                    hand = frame.hands[0];
                    var top = (-hand.stabilizedPalmPosition[1] * 3) + (window.innerHeight);
                    var left = (hand.stabilizedPalmPosition[0] * 3) + (window.innerWidth / 2);
                    this.canvas.style.top = top -20 + "px";
                    this.canvas.style.left = left -20+ "px";
                    setXY(this.canvas.style.top, this.canvas.style.left);
                    this.canvas.style.display = "none";
                    elm = document.elementFromPoint(left, top + 20);
                    this.canvas.style.display = "block";
                    if (elm != this.highlightedElm) {
                        this.fire("mouseleave");
                        this.highlightedElm = elm;
                        this.fire("mouseenter");
                    }
                } else {
                    if (!this.defaultHandPosition) {
                        this.setDefaultPosition();
                    }
                    return;
                }
                for (var i = 0; i < 1; i++) {
                    palm = this.palms[i];
                    if (i >= handCount) {
                        if (!this.defaultHandPosition) {
                            palm.visible = false;
                            for (var j = 0, k = 5, p; j < k; j++) {
                                p = (i * 5) + j;
                                this.fingers[p].visible = false;
                            }
                        }
                    } else {
                        this.defaultHandPosition = false;
                        hand = frame.hands[i];
                        this.positionPalm(hand, palm);
                        palm.visible = true;
                        handFingers = hand.fingers;
                        handFingerCount = handFingers.length;
                        for (var j = 0, k = 5; j < k; j++) {
                            finger = this.fingers[(i * 5) + j];
                            if (j >= handFingerCount) {
                                finger.visible = false;
                            } else {
                                this.positionFinger(handFingers[j], finger, palm);
                                finger.visible = true;
                            }
                        }
                    }
                }
            }
        }.bind(this));
    },
    updateRender: function() {
        this.renderer.render(this.scene, this.camera);
        requestAnimFrame(this.updateRender.bind(this));
    },
    createPalm: function() {
        var palm = new THREE.Mesh(this.palmGeometry, this.material);
        palm.castShadow = true;
        palm.receiveShadow = true;
        return palm;
    },
    createFinger: function() {
        var finger = new THREE.Mesh(this.fingerGeometry, this.material);
        finger.castShadow = true;
        finger.receiveShadow = true;
        return finger;
    },
    createShadowPlane: function() {
        var planeFragmentShader = ["uniform vec3 diffuse;", "uniform float opacity;", THREE.ShaderChunk["color_pars_fragment"], THREE.ShaderChunk["map_pars_fragment"], THREE.ShaderChunk["lightmap_pars_fragment"], THREE.ShaderChunk["envmap_pars_fragment"], THREE.ShaderChunk["fog_pars_fragment"], THREE.ShaderChunk["shadowmap_pars_fragment"], THREE.ShaderChunk["specularmap_pars_fragment"], "void main() {", "gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );", THREE.ShaderChunk["map_fragment"], THREE.ShaderChunk["alphatest_fragment"], THREE.ShaderChunk["specularmap_fragment"], THREE.ShaderChunk["lightmap_fragment"], THREE.ShaderChunk["color_fragment"], THREE.ShaderChunk["envmap_fragment"], THREE.ShaderChunk["shadowmap_fragment"], THREE.ShaderChunk["linear_to_gamma_fragment"], THREE.ShaderChunk["fog_fragment"], "gl_FragColor = vec4( 0.0, 0.0, 0.0, min(0.1, 1.0 - shadowColor.x) );", "}"].join("\n");
        var planeMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.ShaderLib["basic"].uniforms,
            vertexShader: THREE.ShaderLib["basic"].vertexShader,
            fragmentShader: planeFragmentShader,
            color: 255
        });
        this.shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.width * 4, this.height * 4, 50), planeMaterial);
        this.shadowPlane.receiveShadow = true;
        this.scene.add(this.shadowPlane);
    },
    setDefaultPosition: function() {
        this.canvas.style.top = ((this.top) ? this.top : window.innerHeight - this.height - 20) + "px";
        this.canvas.style.left = ((this.left) ? this.left : window.innerWidth - this.width - 20) + "px";
        if (this.defaultHandPosition) {
            return;
        }
        this.defaultHandPosition = true;
        this.camera.position.set(0, 0, 350);
        this.shadowPlane.position.set(0, 0, -25);
        this.light.position.set(0, 0, 650);
        this.light.lookAt(this.shadowPlane);
        this.palms[0].position.set(25.62994, -37.67400000000001, 96.368);
        this.palms[0].rotation.set(-1.9921488149553126, 0.051271951412566935, -2.6597446090413466);
        this.fingers[0].position.set(64.179, 24.22, 28.7022);
        this.fingers[0].rotation.set(-2.677879785829599, 0.02183472660404244, 3.133282166633954);
        this.fingers[0].scale.z = 8;
        this.fingers[0].visible = true;
        this.fingers[1].position.set(83.8033, -15.913000000000011, 32.6661);
        this.fingers[1].rotation.set(-2.6753644328170965, 0.22532594370921782, 3.056111568660471);
        this.fingers[1].scale.z = 5;
        this.fingers[1].visible = true;
        this.fingers[2].position.set(34.69965, 49.19499999999999, 31.643);
        this.fingers[2].rotation.set(-2.500622653205929, 0.033504548426940645, 3.121471314695975);
        this.fingers[2].scale.z = 9;
        this.fingers[2].visible = true;
        this.fingers[3].position.set(8.7075, 50.976, 50.363);
        this.fingers[3].rotation.set(-2.443443897235925, 0.04106473211751575, 3.113625377842598);
        this.fingers[3].scale.z = 8;
        this.fingers[3].visible = true;
        this.fingers[4].position.set(-40.6532, -33.772999999999996, 84.7031);
        this.fingers[4].rotation.set(-2.489002343898949, -0.4631619960981157, -2.872745378807403);
        this.fingers[4].scale.z = 6;
        this.fingers[4].visible = true;
    },
    setHandMaterial: function(m) {
        this.palms[0].material = m;
        this.palms[1].material = m;
        for (var i = 0, l = this.fingers.length; i < l; i++) {
            this.fingers[i].material = m;
        }
    },
    positionPalm: function(hand, palm) {
        var position = hand.stabilizedPalmPosition;
        palm.position.set(position[0], position[1] + this.yOffset, palm.position.z);
        this.camera.position.x = this.shadowPlane.position.x = palm.position.x;
        this.camera.position.y = this.shadowPlane.position.y = palm.position.y;
        this.light.position.x = position[0];
        this.light.position.y = position[1];
        var direction = hand.direction;
        palm.lookAt(new THREE.Vector3(direction[0], direction[1], direction[2]).add(palm.position));
        var normal = hand.palmNormal;
        palm.rotation.z = Math.atan2(normal[0], normal[1]);
    },
    positionFinger: function(handFinger, finger, palm) {
        var position = handFinger.stabilizedTipPosition;
        finger.position.set(position[0], position[1] + this.yOffset, position[2]);
        var direction = handFinger.direction;
        finger.lookAt(new THREE.Vector3(direction[0], direction[1], direction[2]).add(finger.position));
        finger.scale.z = 0.1 * handFinger.length;
    },
    scroll: function(frame) {
        if (!this.lastFrame) {
            this.lastFrame = frame;
            return;
        }
        var hands = frame.hands;
        if (hands.length == 0) {
            this.speed[0] *= this.dampening;
            this.speed[1] *= this.dampening;
            this.speed[2] *= this.dampening;
            this.lastFrame = null;
        } else {
            if (hands.length == 1) {
                var velocity = frame.translation(this.lastFrame);
                this.speed[0] = this.scrollSpeed * velocity[0];
                this.speed[1] = this.scrollSpeed * velocity[1];
                this.speed[2] = this.scrollSpeed * velocity[2];
            }
        }
        if (Math.abs(this.speed[0] + this.speed[1] + this.speed[2]) > 3) {
            var doc = document.documentElement,
                body = document.body;
            var left = (doc && doc.scrollLeft || body && body.scrollLeft || 0);
            var top = (doc && doc.scrollTop || body && body.scrollTop || 0);
            var target = this.target;
            if (target == window) {
                top = (doc && doc.scrollTop || body && body.scrollTop || 0);
                left = (doc && doc.scrollLeft || body && body.scrollLeft || 0);
            } else {
                top = target.scrollTop || 0;
                left = target.scrollLeft || 0;
            }
            target.scrollTo(left + this.speed[0], top - this.speed[1]);
        }
    },
    fire: function(evt) {
        var elm = this.highlightedElm;
        if (!elm) {
            return;
        }
        var event;
        if (document.createEvent) {
            event = document.createEvent("HTMLEvents");
            event.initEvent(evt, true, true);
        } else {
            event = document.createEventObject();
            event.eventType = evt;
        }
        event.eventName = evt;
        if (event.initEvent) {
            event.initEvent(event.type, true, true);
        }
        if (document.createEvent) {
            elm.dispatchEvent(event);
        } else {
            elm.fireEvent("on" + event.eventType, event);
        }
    }
};

function parseQuery(query) {
    var parameters = new Object();
    if (!query) {
        return parameters;
    }
    var pairs = query.split(/[;&]/);
    for (var i = 0; i < pairs.length; i++) {
        var KeyVal = pairs[i].split("=");
        if (!KeyVal || KeyVal.length != 2) {
            continue;
        }
        var key = unescape(KeyVal[0]);
        var val = unescape(KeyVal[1]);
        val = val.replace(/\+/g, " ");
        parameters[key] = val;
    }
    return parameters;
}
var scripts = document.getElementsByTagName("script");
var params = this.parseQuery(scripts[scripts.length - 1].src.replace(/^[^\?]+\??/, ""));
// if (window.addEventListener) {
//     window.addEventListener("load", function() {
//         window.leapCursor = new LeapCursor(params);
//     }, false);
// } else {
//     if (elem.attachEvent) {
//         window.attachEvent("onLoad", function() {
//             window.leapCursor = new LeapCursor(params);
//         });
//     }
// }