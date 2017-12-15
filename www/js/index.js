/* global mainPage, deviceList, refreshButton */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/ //
var inu = 0;
var osc;
var live = false;
var save = true;

var dirPath = "";

var logOb;
var logOb_2;

'use strict';

function fail(e) {
	console.log("FileSystem Error");
	console.dir(e);
}

// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

// this is Nordic's UART service
/*var bluefruit = {
    serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
    txCharacteristic: '0000ffe1-0000-1000-8000-00805f9b34fb', // transmit is from the phone's perspective
    rxCharacteristic: '0000ffe1-0000-1000-8000-00805f9b34fb'  // receive is from the phone's perspective
};*/
var bluefruit = {
    serviceUUID: 'ffe0',
    txCharacteristic: 'ffe1', // transmit is from the phone's perspective
    rxCharacteristic: 'ffe1'  // receive is from the phone's perspective
};

var app = {
    initialize: function() {
        this.bindEvents();
        detailPage.hidden = true;
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        refreshButton.addEventListener('touchstart', this.refreshDeviceList, false);
        sendButton.addEventListener('click', this.sendData, false);
        disconnectButton.addEventListener('touchstart', this.disconnect, false);
        deviceList.addEventListener('touchstart', this.connect, false); // assume not scrolling
    },
    onDeviceReady: function() {
        app.refreshDeviceList();
				cordova.plugins.backgroundMode.enable();

        osc = new OSC();

				app.logFile("test");

				live = false;
				save = true;

				document.getElementById("storage").style.background = "#008cdc";
		    document.getElementById("storage").style.color = "#eee";

		    document.getElementById("live").style.background = "#fff";
		    document.getElementById("live").style.color = "#444";
    },
		logFile: function(e, t) {
			if (cordova.platformId === 'android') {
				window.resolveLocalFileSystemURL(cordova.file.externalApplicationStorageDirectory, function(dir) {
					console.log("Android");
					//console.log(dir);
					dirPath = dir.nativeURL;
					console.log(dirPath);
					var currentdate = new Date();
					var datetime = currentdate.getDate() + "_"
				                + (currentdate.getMonth()+1)  + "_"
				                + currentdate.getFullYear() + "_"
				                + currentdate.getHours() + "_"
				                + currentdate.getMinutes() + "_"
				                + currentdate.getSeconds();
					dir.getFile(e+"_"+datetime+".txt", {create:true}, function(file) {
						if(t){
							logOb = file;
						}else{
							logOb_2 = file;
						}
						//writeLog("Start");//Test
					});
				});
			}else{
				window.resolveLocalFileSystemURL(cordova.file.documentsDirectory, function(dir) {
					console.log("iPhone");
					//console.log(dir);
					dirPath = dir.nativeURL;
					console.log(dirPath);
					var currentdate = new Date();
					var datetime = currentdate.getDate() + "_"
				                + (currentdate.getMonth()+1)  + "_"
				                + currentdate.getFullYear() + "_"
				                + currentdate.getHours() + "_"
				                + currentdate.getMinutes() + "_"
				                + currentdate.getSeconds();
					dir.getFile(e+"_"+datetime+".txt", {create:true}, function(file) {
						if(t){
							logOb = file;
						}else{
							logOb_2 = file;
						}
						//writeLog("Start");//Test
					});
				});
			}
    },
    refreshDeviceList: function() {
        deviceList.innerHTML = ''; // empties the list
        if (cordova.platformId === 'android') { // Android filtering is broken
            ble.scan([], 5, app.onDiscoverDevice, app.onError);
        } else {
            ble.scan([bluefruit.serviceUUID], 5, app.onDiscoverDevice, app.onError);
        }
    },
    onDiscoverDevice: function(device) {
        var listItem = document.createElement('li'),
            html = '<b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                device.id;

        listItem.dataset.deviceId = device.id;
        listItem.innerHTML = html;
        deviceList.appendChild(listItem);
    },
    connect: function(e) {
        var deviceId = e.target.dataset.deviceId,
            onConnect = function(peripheral) {
                app.determineWriteType(peripheral);

                // subscribe for incoming data
                ble.startNotification(deviceId, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onData, app.onError);
                sendButton.dataset.deviceId = deviceId;
                disconnectButton.dataset.deviceId = deviceId;
                resultDiv.innerHTML = "";
                app.showDetailPage();
            };

        ble.connect(deviceId, onConnect, app.onError);
    },
    determineWriteType: function(peripheral) {
        // Adafruit nRF8001 breakout uses WriteWithoutResponse for the TX characteristic
        // Newer Bluefruit devices use Write Request for the TX characteristic

        var characteristic = peripheral.characteristics.filter(function(element) {
            if (element.characteristic.toLowerCase() === bluefruit.txCharacteristic) {
                return element;
            }
        })[0];

        if (characteristic.properties.indexOf('WriteWithoutResponse') > -1) {
            app.writeWithoutResponse = true;
        } else {
            app.writeWithoutResponse = false;
        }

    },
    onData: function(data) { // data received from Arduino
        resultDiv.innerHTML = "Recibiendo: " + bytesToString(data) + "<br/>";
        resultDiv.scrollTop = resultDiv.scrollHeight;

        inu = parseInt( bytesToString(data) );

        if(live === true && save === false){
          var ipAd = document.getElementById('ips').value;
          var portAd = parseInt( document.getElementById('port').value);
          osc.send({
              remoteAddress: ipAd,
              remotePort: portAd,
              address: '/ecg',
              arguments: [inu]
          });
        }else if(save === true && live === false){
          writeLog( bytesToString(data) );
        }
    },
    sendData: function(event) { // send data to Arduino

        var success = function() {
            console.log("success");
            resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + messageInput.value + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function() {
            alert("Failed writing data to the bluefruit le");
        };

        var data = stringToBytes(messageInput.value);
        var deviceId = event.target.dataset.deviceId;

        if (app.writeWithoutResponse) {
            ble.writeWithoutResponse(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        } else {
            ble.write(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        }

    },
    disconnect: function(event) {
        var deviceId = event.target.dataset.deviceId;
        ble.disconnect(deviceId, app.showMainPage, app.onError);
    },
    showMainPage: function() {
        mainPage.hidden = false;
        detailPage.hidden = true;
    },
    showDetailPage: function() {
        mainPage.hidden = true;
        detailPage.hidden = false;
    },
    onError: function(reason) {
        alert("ERROR: " + reason); // real apps should use notification.alert
    },
		sendFile: function(e) {
			//Data IP
			var ipAd = document.getElementById('ips').value;
			var portAd = parseInt( document.getElementById('port').value);

			//Data File
			if (cordova.platformId === 'android') {
      	var fileURL = "file:///storage/emulated/0"+e;
			}else{
				var fileURL = dirPath+e.replace("/","");
			}
			console.log(fileURL);
      var fileName = fileURL.substr(fileURL.lastIndexOf('/') + 1).slice(0, -4);

      var options = new FileUploadOptions();
      options.fileKey = "file";
      options.mimeType = "text/plain";
      options.fileName = fileName;

      var ft = new FileTransfer();
      ft.upload(fileURL, encodeURI("http://"+ipAd+":"+portAd+"/api/file/"),
        function (res) {
          console.log("Code = " + res.responseCode);
					window.resolveLocalFileSystemURL(fileURL, function(file) {
		        file.remove(function(){
		          console.log("deleted");
		        },function (error) {
		          console.log(error);
		        });
		      }, function (error) {
	          console.log(error);
	        });
        },
        function (error) {
          console.log(error);
        },
        options);
    }
};

//STORAGE
function writeLog(str) {
	if(!logOb) return;
	var log = str;
	logOb.createWriter(function(fileWriter) {

		fileWriter.seek(fileWriter.length);

		var blob = new Blob([log], {type:'text/plain'});
		fileWriter.write(blob);
	}, fail);
}

function listDir(path){
	console.log("listDir Works");
	console.log(path);
  window.resolveLocalFileSystemURL(path,
    function (fileSystem) {
      var reader = fileSystem.createReader();
      reader.readEntries(
        function (entries) {
					console.log(entries);
					for (var i = 0; i < entries.length; i++) {
						if(entries[i].isFile === true){
							console.log(entries[i].fullPath);
							app.sendFile(entries[i].fullPath);
						}
					}
        },
        function (err) {
          console.log(err);
        }
      );
    }, function (err) {
      console.log(err);
    }
  );
}

//LISTENERs
document.getElementById("live").addEventListener("click", function(){
    live = true;
    save = false;

    document.getElementById("live").style.background = "#ff0926";
    document.getElementById("live").style.color = "#eee";

    document.getElementById("storage").style.background = "#fff";
    document.getElementById("storage").style.color = "#444";
});

document.getElementById("storage").addEventListener("click", function(){
    live = false;
    save = true;

    document.getElementById("storage").style.background = "#008cdc";
    document.getElementById("storage").style.color = "#eee";

    document.getElementById("live").style.background = "#fff";
    document.getElementById("live").style.color = "#444";
});

document.getElementById("log_name").addEventListener("click", function(){
	var name = document.getElementById('name').value;
	var name_2 = document.getElementById('name2').value;

	app.logFile(name, true);
	app.logFile(name_2, false);
});

document.getElementById("sinc").addEventListener("click", function(){
	listDir(dirPath);
});
