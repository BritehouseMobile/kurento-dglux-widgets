var args = {
        ws_uri: 'wss://10.0.1.128:283/kurento',
        address: 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov',
        ice_servers: undefined
};

var pipeline;
var player;
var webRtcPeer;
var paused;

function start() {
    var videoOutput = document.getElementById('videoOutput');
    
    if(!args.address){
        window.alert("You must set the video source URL first");
        return;
    }
    var options = {
        remoteVideo : videoOutput
    };
    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
        function(error){
            if(error){
                return console.error(error);
            }
            webRtcPeer.generateOffer(onOffer);
            webRtcPeer.peerConnection.addEventListener('iceconnectionstatechange', function(event){
                if(webRtcPeer && webRtcPeer.peerConnection){
                    console.log("oniceconnectionstatechange -> " + webRtcPeer.peerConnection.iceConnectionState);
                    console.log('icegatheringstate -> ' + webRtcPeer.peerConnection.iceGatheringState);
                }
            });
        });
}
function pause() {
    if (!paused) {
        document.getElementById("videoOutput").pause();
        player.pause();
        paused = true;
    } else {
        document.getElementById("videoOutput").play();
        player.play();
        paused = false;
    }
}

function onOffer(error, sdpOffer){
    if(error) return onError(error);

    kurentoClient(args.ws_uri, function(error, kurentoClient) {
        if(error) return onError(error);

        kurentoClient.create("MediaPipeline", function(error, p) {
            if(error) return onError(error);

            pipeline = p;

            pipeline.create("PlayerEndpoint", {uri: args.address}, function(error, pl){
                if(error) return onError(error);
                
                player = pl;

                pipeline.create("WebRtcEndpoint", function(error, webRtcEndpoint){
                    if(error) return onError(error);

                    setIceCandidateCallbacks(webRtcEndpoint, webRtcPeer, onError);

                    webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer){
                        if(error) return onError(error);

                        webRtcEndpoint.gatherCandidates(onError);

                        webRtcPeer.processAnswer(sdpAnswer);
                    });

                    player.connect(webRtcEndpoint, function(error){
                        if(error) return onError(error);

                        console.log("PlayerEndpoint-->WebRtcEndpoint connection established");

                        player.play(function(error){
                            if(error) return onError(error);

                            document.getElementById("videoOutput").play();
                            console.log("Player playing ...");
                        });
                    });
                });
            });
        });
    });
}

function stop() {
    if (webRtcPeer) {
        webRtcPeer.dispose();
        webRtcPeer = null;
    }
    if(pipeline){
        pipeline.release();
        pipeline = null;
    }
}

function setIceCandidateCallbacks(webRtcEndpoint, webRtcPeer, onError){
    webRtcPeer.on('icecandidate', function(candidate){
        console.log("Local icecandidate " + JSON.stringify(candidate));

        candidate = kurentoClient.register.complexTypes.IceCandidate(candidate);

        webRtcEndpoint.addIceCandidate(candidate, onError);

    });
    webRtcEndpoint.on('OnIceCandidate', function(event){
        var candidate = event.candidate;

        console.log("Remote icecandidate " + JSON.stringify(candidate));

        webRtcPeer.addIceCandidate(candidate, onError);
    });
}

function onError(error) {
    if(error)
    {
        console.error(error);
        stop();
    }
}

define([
    "lib/kurento/webrtc/adapter.js",
    "lib/kurento/webrtc/kurento-client.js",
    "lib/kurento/webrtc/kurento-utils.js"
],function() {
    var MyWidget = (function (_super) {
        __extends(MyWidget, _super);

        function MyWidget(div, model) {
            _super.call(this, div, model);

            this.videoElement = document.createElement('video');
            this.videoElement.id = "videoOutput";
            this.videoElement.style.position = "absolute";
            this.videoElement.style.width = "100%";
            div.appendChild(this.videoElement);
            
        }
        
        MyWidget.prototype.timer = 0;
        
        MyWidget.prototype.seekTime = 0;
        
        MyWidget.prototype.getDefinition = function () {
            return {
                "name": "",
                "variables": [
                    { "t": "trigger", "n": "start" },
                    { "t": "trigger", "n": "pause" },
                    { "t": "trigger", "n": "stop" },
                    { "t": "string", "n": "wsUri" },
                    { "t": "string", "n": "sourceUri" },
                    { "t": "number", "n": "currentTime" },
                    { "t": "number", "n": "seekTime" },
                    { "t": "trigger", "n": "seek" }
                ],
                "layout": {
                    "type": "vbox",
                    "children": ["start", "pause", "stop", "wsUri", "sourceUri", "currentTime", "seekTime", "seek"] // order of properties
                }
            };
        };
        
        MyWidget.myPropMap = {
            "start": function (widget, value) {
                if (value != undefined) {
                    start();
                    
                    this.timer = setInterval(function() {
                        if (player != undefined) {
                            player.getPosition().then(function(result) {
                                console.log("setting current time to " + result);
                                widget.updateModelValue('currentTime', result);
                            });
                        }
                    }, 1000);
                }
            },
            "pause": function(widget, value) {
                if (value != undefined) {
                    player.getPosition().then(function(result) {
                        widget.updateModelValue('currentTime', result);
                    });
                    pause();
                }
            },
            "stop": function (widget, value) {
                if (value != undefined) {
                    stop();
                    clearInterval(this.timer);
                }
            },
            "wsUri": function (widget, value) {
                if (value != undefined)
                    args.ws_uri = value;
            },
            "sourceUri": function (widget, value) {
                if (value != undefined)
                    args.address = value;
            },
            "seekTime": function (widget, value) {
                if (value != undefined)
                    this.seekTime = value;
            },
            "seek": function (widget, value) {
                if (value != undefined) {
                    player.setPosition(this.seekTime).then(function() {
                    });
                }
            }
        };

        MyWidget.prototype.getPropMap = function () {
            return MyWidget.myPropMap;
        };

        MyWidget.prototype.destroy = function () {
            this.videoOutput.remove();
        };
        
        return MyWidget;
    }(dgluxjs.Widget));

    function dgNewWidget(div, model) {
        return new MyWidget(div, model);
    }

    return {'dgNewWidget' : dgNewWidget};
});
