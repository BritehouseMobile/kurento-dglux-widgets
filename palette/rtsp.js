var dbg;

var juliansElementList = [];

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
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

            this.videoName = guid();
            this.videoElement = document.createElement('video');
            this.videoElement.id = this.videoName;
            this.videoElement.style.position = "absolute";
            this.videoElement.style.width = "100%";
            this.paused = false;
            div.appendChild(this.videoElement);

	    this.ws_uri = 'wss://10.0.1.128:283/kurento';
	    this.address = 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov';
            
	    juliansElementList.push(this);
        }
        
        MyWidget.prototype.timer = 0;
        
        MyWidget.prototype.seekTime = 0;

	MyWidget.prototype.setIceCandidateCallbacks = function (webRtcEndpoint, webRtcPeer, onError){
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
	};

	MyWidget.prototype.pause = function () {
	    if (!this.paused) {
		console.log("pausing...");
		document.getElementById(this.videoName).pause();
		this.player.pause();
		this.paused = true;
	    } else {
		console.log("unpausing...");
		document.getElementById(this.videoName).play();
		this.player.play();
		this.paused = false;
	    }
	}

	MyWidget.prototype.stop = function () {
	    clearInterval(this.timer);

	    if (this.webRtcPeer) {
		this.webRtcPeer.dispose();
		this.webRtcPeer = null;
	    }
	    if(this.pipeline){
		this.pipeline.release();
		this.pipeline = null;
	    }
	}


	MyWidget.prototype.start = function () {
            var widget = this;
	    var videoOutput = document.getElementById(this.videoName);
	    
	    if(!this.address){
		console.log("You must set the video source URL first");
		return;
	    } else {
		console.log("DEBUG: the address at time of start() is " + this.address);
	    }

	    var options = {
		remoteVideo : videoOutput
	    };

	    widget.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
		function(error){
		    if(error){
			return console.error(error);
		    }
		    widget.webRtcPeer.generateOffer(function(error, sdpOffer) {
			    if(error) return onError(error);

			    var kc = kurentoClient(widget.ws_uri, function(error, kurentoClient) {
				if(error) return onError(error);

				kurentoClient.create("MediaPipeline", function(error, p) {
				    if(error) return onError(error);

				    widget.pipeline = p;

				    widget.pipeline.create("PlayerEndpoint", {uri: widget.address}, function(error, pl){
					if(error) return onError(error);
					
					widget.player = pl;

					widget.pipeline.create("WebRtcEndpoint", function(error, webRtcEndpoint){
					    if(error) return onError(error);

					    widget.setIceCandidateCallbacks(webRtcEndpoint, widget.webRtcPeer, onError);

					    webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer){
						if(error) return onError(error);

						webRtcEndpoint.gatherCandidates(onError);

						widget.webRtcPeer.processAnswer(sdpAnswer);
					    });

					    widget.player.connect(webRtcEndpoint, function(error){
						if(error) return onError(error);

						console.log("PlayerEndpoint-->WebRtcEndpoint connection established");
						
						widget.player.play(function(error){
						    if(error) return onError(error);

						    console.log("DEBUG: the address at the end of start() is " + widget.address);

						    videoOutput.autoplay = true;

						    try {
							    videoOutput.play();

							    if (videoOutput.paused == true) {
								videoOutput.play();
							    } else {
							    } 
						    } catch(err) {
						        console.log(err);
						    }

						    widget.updateModelValue("sessionId", kc.sessionId);
						    widget.updateModelValue("object", widget.player.id.split("/")[0]);
						});
					    });
					});
				    });
				});
			    });
		    });
		    widget.webRtcPeer.peerConnection.addEventListener('iceconnectionstatechange', function(event){
			if(widget.webRtcPeer && widget.webRtcPeer.peerConnection){
			    console.log("oniceconnectionstatechange -> " + widget.webRtcPeer.peerConnection.iceConnectionState);
			    console.log('icegatheringstate -> ' + widget.webRtcPeer.peerConnection.iceGatheringState);
			}
		    });
		});
	}
        
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
                    { "t": "string", "n": "videoWidth" },
                    { "t": "string", "n": "videoHeight" },
                    { "t": "bool", "n": "isMediaFlowingOut" },
                    { "t": "trigger", "n": "seek" },
                    { "t": "bool", "n": "mute" },
                    { "t": "string", "n": "sessionId" },
                    { "t": "string", "n": "object" }
                ],
                "layout": {
                    "type": "vbox",
                    "children": ["start", "pause", "stop", "wsUri", "sourceUri", "currentTime", "seekTime", "videoWidth", "videoHeight", "isMediaFlowingOut", "seek", "mute", "sessionId", "object"] // order of properties
                }
            };
        };

        MyWidget.myPropMap = {
            "start": function (widget, value) {
                if (value != undefined) {
		    if (widget.paused == true) {
			console.log("unpausing after start");
			widget.pause();
			return;
		    }

                    widget.stop();

                    widget.start();
                    
                    widget.timer = setInterval(function() {
                        if (widget.player != undefined) {
                            widget.player.getPosition().then(function(result) {
				if (false && result != 0) {
					console.log("setting current time to " + result);
				}

                                widget.updateModelValue('currentTime', result);
				widget.updateModelValue('videoWidth', widget.videoElement.videoWidth);
				widget.updateModelValue('videoHeight', widget.videoElement.videoHeight);
			        widget.player.isMediaFlowingOut("VIDEO").then(function(result) {
					widget.updateModelValue("isMediaFlowingOut", result);
				});
                            });
                        }
                    }, 1000);
                }
            },
            "pause": function(widget, value) {
                if (value != undefined) {
                    widget.player.getPosition().then(function(result) {
                        widget.updateModelValue('currentTime', result);
                    });
		    console.log("pause was hit!!!");
                    widget.pause();
                }
            },
            "stop": function (widget, value) {
                if (value != undefined) {
                    widget.stop();
		    widget.updateModelValue("isMediaFlowingOut", false);
                }
            },
            "wsUri": function (widget, value) {
                if (value != undefined)
                    widget.ws_uri = value;
            },
            "sourceUri": function (widget, value) {
                if (value != undefined)
                    widget.address = value;
	        else
		    widget.address = null;
            },
            "currentTime": function (widget, value) {
            },
            "seekTime": function (widget, value) {
                if (value != undefined)
                    widget.seekTime = value;
            },
	    "videoWidth": function(widget, value) {
	    },
	    "videoHeight": function(widget, value) {
	    },
	    "isMediaFlowingOut": function(widget, value) {
	    },
            "seek": function (widget, value) {
                if (value != undefined) {
		    console.log("seeking to " + widget.seekTime);
                    widget.player.setPosition(widget.seekTime).then(function(result) {
                    });
                }
            },
	    "mute": function (widget, value) {
		if (value != undefined) {
			if (value) {
				document.getElementById(widget.videoName).muted = true;
			} else {
				document.getElementById(widget.videoName).muted = false;
			}
		}
	    },
	    "sessionId": function (widget, value) {
	    },
	    "object": function (widget, value) {
	    }
        };

        MyWidget.prototype.getPropMap = function () {
            return MyWidget.myPropMap;
        };

        MyWidget.prototype.destroy = function () {
	    console.log("destroying " + this.videoName);
            this.videoElement.remove();
	    var index = juliansElementList.indexOf(this);
	    if (index > -1) juliansElementList.splice(index, 1);
	    this.stop();
        };
        
        return MyWidget;
    }(dgluxjs.Widget));

    function dgNewWidget(div, model) {
        return new MyWidget(div, model);
    }

    return {'dgNewWidget' : dgNewWidget};
});
